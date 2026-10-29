import { PluginFile } from '../pluginFiles';

export const gatewayFiles: PluginFile[] = [
  {
    path: 'includes/Gateways/WC_Gateway_Faiiya_Pay.php',
    name: 'WC_Gateway_Faiiya_Pay.php',
    category: 'gateway',
    description: 'WooCommerce Payment Gateway (faiiya_pay_wallet) with checkout balance display and atomic payment execution.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Gateways;

defined('ABSPATH') || exit;

if (!class_exists('WC_Payment_Gateway')) {
    return;
}

class WC_Gateway_Faiiya_Pay extends \\WC_Payment_Gateway {
    public function __construct() {
        $this->id                 = 'faiiya_pay_wallet';
        $this->icon               = apply_filters('woocommerce_faiiya_pay_icon', '');
        $this->has_fields         = true;
        $this->method_title       = __('Faiiya Pay Wallet', 'faiiya-pay');
        $this->method_description = __('Allow customers to pay instantly using their internal Faiiya digital wallet balance.', 'faiiya-pay');
        $this->supports           = ['products'];

        $this->init_form_fields();
        $this->init_settings();

        $this->title       = $this->get_option('title', __('Faiiya Pay Digital Wallet', 'faiiya-pay'));
        $this->description = $this->get_option('description', __('Pay instantly using your Faiiya Pay wallet balance.', 'faiiya-pay'));
        $this->enabled     = $this->get_option('enabled', 'yes');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
    }

    public function init_form_fields(): void {
        $this->form_fields = [
            'enabled' => [
                'title'   => __('Enable/Disable', 'faiiya-pay'),
                'type'    => 'checkbox',
                'label'   => __('Enable Faiiya Pay Wallet Payment', 'faiiya-pay'),
                'default' => 'yes',
            ],
            'title' => [
                'title'       => __('Title', 'faiiya-pay'),
                'type'        => 'text',
                'description' => __('This controls the payment method title which the user sees during checkout.', 'faiiya-pay'),
                'default'     => __('Faiiya Pay Digital Wallet', 'faiiya-pay'),
                'desc_tip'    => true,
            ],
            'description' => [
                'title'       => __('Description', 'faiiya-pay'),
                'type'        => 'textarea',
                'description' => __('Payment method description displayed at checkout.', 'faiiya-pay'),
                'default'     => __('Pay instantly using your available digital wallet balance.', 'faiiya-pay'),
            ],
        ];
    }

    public function is_available(): bool {
        if (isset($this->enabled) && ($this->enabled === 'no' || $this->enabled === false || $this->enabled === '0' || $this->enabled === 0)) {
            return false;
        }

        // Never hide gateway at checkout: allows customers to see their balance, log in, or top up
        return true;
    }

    public function payment_fields(): void {
        if (!is_user_logged_in()) {
            echo '<div class="faiiya-checkout-notice" style="padding: 12px 15px; border-radius: 6px; background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; margin: 8px 0; font-size: 13px;">' .
                 esc_html__('Please log in or create an account during checkout to pay with your Faiiya digital wallet balance.', 'faiiya-pay') .
                 '</div>';
            return;
        }

        $user_id = get_current_user_id();
        $wallet_model = new \\FaiiyaPay\\Models\\WalletModel();
        $balance = $wallet_model->get_balance($user_id);
        $order_total = (function_exists('WC') && WC() && WC()->cart) ? (float) WC()->cart->get_total('edit') : 0.00;

        echo '<div class="faiiya-pay-checkout-box" style="padding: 16px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; margin-top: 10px;">';
        echo '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">';
        echo '<span style="font-weight: 600; color: #0f172a; font-size: 14px;">' . esc_html__('Your Wallet Balance:', 'faiiya-pay') . '</span>';
        echo '<span style="font-size: 18px; font-weight: 700; color: #059669;">₦' . number_format($balance, 2) . '</span>';
        echo '</div>';

        if ($balance < $order_total) {
            $shortfall = $order_total - $balance;
            echo '<div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 4px; color: #991b1b; font-size: 13px;">';
            echo '<p style="margin: 0 0 6px 0; font-weight: 600;">' .
                 sprintf(esc_html__('Insufficient balance. You need ₦%s more to complete this purchase.', 'faiiya-pay'), number_format($shortfall, 2)) .
                 '</p>';
            
            $va_model = new \\FaiiyaPay\\Models\\VirtualAccountModel();
            $accounts = $va_model->get_user_accounts($user_id);

            if (!empty($accounts)) {
                echo '<p style="margin: 0; font-size: 12px; color: #475569;">' .
                     esc_html__('Top up instantly by transferring funds to your dedicated Monnify account:', 'faiiya-pay') .
                     '</p>';
                echo '<ul style="margin: 6px 0 0 16px; font-size: 12px; color: #334155; padding: 0;">';
                foreach ($accounts as $acc) {
                    echo '<li><strong>' . esc_html($acc['bank_name']) . ':</strong> <code>' . esc_html($acc['account_number']) . '</code> (' . esc_html($acc['account_name']) . ')</li>';
                }
                echo '</ul>';
            }
            echo '</div>';
        } else {
            echo '<p style="margin: 0; font-size: 13px; color: #166534;">' .
                 esc_html__('✓ Your wallet has sufficient balance. ₦', 'faiiya-pay') .
                 number_format($order_total, 2) .
                 esc_html__(' will be deducted instantly upon placing the order.', 'faiiya-pay') .
                 '</p>';
        }

        echo '</div>';
    }

    public function process_payment($order_id): array {
        $order = wc_get_order($order_id);
        if (!$order) {
            wc_add_notice(__('Invalid order specified.', 'faiiya-pay'), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        }

        $user_id = $order->get_user_id() ?: get_current_user_id();

        if (!$user_id) {
            wc_add_notice(__('Faiiya Pay digital wallet payments require a logged-in customer account.', 'faiiya-pay'), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        }

        $order_total = (float) $order->get_total();
        $reference   = 'WC-ORDER-' . $order->get_id() . '-' . time();

        $wallet_model = new \\FaiiyaPay\\Models\\WalletModel();

        try {
            $result = $wallet_model->debit(
                $user_id,
                $order_total,
                'debit_order',
                $reference,
                [
                    'order_id'     => $order->get_id(),
                    'order_number' => $order->get_order_number(),
                    'currency'     => $order->get_currency(),
                ]
            );

            $order->payment_complete($result['txn_uuid']);
            $order->add_order_note(
                sprintf(
                    __('Payment completed via Faiiya Pay Wallet. Debited: ₦%s. Txn UUID: %s. Remaining Balance: ₦%s', 'faiiya-pay'),
                    number_format($order_total, 2),
                    $result['txn_uuid'],
                    number_format($result['balance_after'], 2)
                )
            );

            if (function_exists('WC') && WC() && WC()->cart) {
                WC()->cart->empty_cart();
            }

            return [
                'result'   => 'success',
                'redirect' => $this->get_return_url($order),
            ];
        } catch (\\UnderflowException $e) {
            wc_add_notice($e->getMessage(), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        } catch (\\Throwable $e) {
            wc_add_notice(__('Wallet payment failed: ', 'faiiya-pay') . $e->getMessage(), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        }
    }
}
`
  },
  {
    path: 'includes/Gateways/WC_Gateway_Monnify.php',
    name: 'WC_Gateway_Monnify.php',
    category: 'gateway',
    description: 'WooCommerce Payment Gateway for Monnify Direct Online Checkout (Cards, Bank Transfer, USSD).',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Gateways;

use FaiiyaPay\\Services\\MonnifyService;

defined('ABSPATH') || exit;

if (!class_exists('WC_Payment_Gateway')) {
    return;
}

class WC_Gateway_Monnify extends \\WC_Payment_Gateway {
    public function __construct() {
        $this->id                 = 'faiiya_pay_monnify';
        $this->icon               = apply_filters('woocommerce_monnify_icon', '');
        $this->has_fields         = false;
        $this->method_title       = __('Monnify (Debit Card / Bank Transfer / USSD)', 'faiiya-pay');
        $this->method_description = __('Accept instant online payments with Nigerian Debit/Credit Cards (Mastercard, Visa, Verve), Bank Transfer, and USSD directly through Monnify.', 'faiiya-pay');
        $this->supports           = ['products', 'refunds'];

        $this->init_form_fields();
        $this->init_settings();

        $this->title       = $this->get_option('title', __('Debit Card / Bank Transfer / USSD (Monnify)', 'faiiya-pay'));
        $this->description = $this->get_option('description', __('Pay securely with your ATM Card (Mastercard, Visa, Verve), Direct Bank Transfer, or USSD via Monnify.', 'faiiya-pay'));
        $this->enabled     = $this->get_option('enabled', 'yes');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
    }

    public function init_form_fields(): void {
        $this->form_fields = [
            'enabled' => [
                'title'   => __('Enable/Disable', 'faiiya-pay'),
                'type'    => 'checkbox',
                'label'   => __('Enable Monnify Direct Gateway', 'faiiya-pay'),
                'default' => 'yes',
            ],
            'title' => [
                'title'       => __('Title', 'faiiya-pay'),
                'type'        => 'text',
                'description' => __('Payment method title displayed to customers during checkout.', 'faiiya-pay'),
                'default'     => __('Debit Card / Bank Transfer / USSD (Monnify)', 'faiiya-pay'),
                'desc_tip'    => true,
            ],
            'description' => [
                'title'       => __('Description', 'faiiya-pay'),
                'type'        => 'textarea',
                'description' => __('Payment method description displayed at checkout.', 'faiiya-pay'),
                'default'     => __('Pay securely with your ATM Card (Mastercard, Visa, Verve), Direct Bank Transfer, or USSD via Monnify.', 'faiiya-pay'),
            ],
        ];
    }

    public function is_available(): bool {
        if (isset($this->enabled) && ($this->enabled === 'no' || $this->enabled === false || $this->enabled === '0' || $this->enabled === 0)) {
            return false;
        }

        // Always available when enabled so customers can choose to pay via Monnify
        return true;
    }

    public function payment_fields(): void {
        echo '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin: 8px 0; font-size: 13px; color: #334155;">';
        echo '<p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5;">' . esc_html($this->description) . '</p>';
        echo '<div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">';
        echo '<span style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #0284c7;">💳 Cards (Mastercard, Visa, Verve)</span>';
        echo '<span style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #059669;">🏦 Bank Transfer</span>';
        echo '<span style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #7c3aed;">📱 USSD</span>';
        echo '</div>';
        echo '<p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">🔒 ' . esc_html__('Secure, encrypted 256-bit checkout powered by Monnify (CBN Licensed).', 'faiiya-pay') . '</p>';
        echo '</div>';
    }

    public function process_payment($order_id): array {
        $order = wc_get_order($order_id);
        if (!$order) {
            wc_add_notice(__('Invalid order specified.', 'faiiya-pay'), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        }

        $monnify_service = new MonnifyService();
        if (!$monnify_service->is_configured()) {
            wc_add_notice(__('Monnify API credentials are not yet configured in WordPress Admin > Faiiya Pay.', 'faiiya-pay'), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        }

        $order_total   = (float) $order->get_total();
        $billing_name  = trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name());
        $billing_email = $order->get_billing_email();

        if (empty($billing_name)) {
            $billing_name = 'Customer';
        }

        $payment_ref = 'WC-ORDER-' . $order->get_id() . '-' . time();
        $redirect_url = $this->get_return_url($order);

        try {
            $init_resp = $monnify_service->initialize_transaction([
                'amount'              => $order_total,
                'customer_name'       => $billing_name,
                'customer_email'      => $billing_email,
                'payment_reference'   => $payment_ref,
                'payment_description' => sprintf(__('Payment for Order #%s', 'faiiya-pay'), $order->get_order_number()),
                'currency_code'       => $order->get_currency() ?: 'NGN',
                'redirect_url'        => $redirect_url,
            ]);

            $checkout_url = $init_resp['checkoutUrl'] ?? '';
            $txn_ref      = $init_resp['transactionReference'] ?? '';

            if (empty($checkout_url)) {
                throw new \\RuntimeException(__('Monnify did not return a checkout URL.', 'faiiya-pay'));
            }

            $order->update_meta_data('_monnify_payment_ref', $payment_ref);
            if (!empty($txn_ref)) {
                $order->update_meta_data('_monnify_txn_ref', $txn_ref);
            }
            $order->save();

            // Clear cart so order is placed
            if (function_exists('WC') && WC() && WC()->cart) {
                WC()->cart->empty_cart();
            }

            return [
                'result'   => 'success',
                'redirect' => $checkout_url,
            ];
        } catch (\\Throwable $e) {
            wc_add_notice(__('Monnify Checkout Error: ', 'faiiya-pay') . $e->getMessage(), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        }
    }
}
`
  },
  {
    path: 'includes/Gateways/WC_Block_Faiiya_Pay.php',
    name: 'WC_Block_Faiiya_Pay.php',
    category: 'gateway',
    description: 'WooCommerce Blocks integration for Faiiya Pay Digital Wallet.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Gateways;

use Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType;

defined('ABSPATH') || exit;

final class WC_Block_Faiiya_Pay extends AbstractPaymentMethodType {
    protected $name = 'faiiya_pay_wallet';

    public function initialize(): void {
        $this->settings = get_option('woocommerce_faiiya_pay_wallet_settings', []);
    }

    public function is_active(): bool {
        return !empty($this->settings['enabled']) && 'no' !== $this->settings['enabled'];
    }

    public function get_payment_method_script_handles(): array {
        wp_register_script(
            'wc-faiiya-pay-blocks-js',
            FAIIYA_PAY_PLUGIN_URL . 'assets/js/faiiya-checkout-blocks.js',
            ['wc-blocks-registry', 'wp-element', 'wp-html-entities', 'wp-i18n'],
            FAIIYA_PAY_VERSION,
            true
        );
        return ['wc-faiiya-pay-blocks-js'];
    }

    public function get_payment_method_data(): array {
        return [
            'title'       => $this->get_setting('title', __('Faiiya Pay Digital Wallet', 'faiiya-pay')),
            'description' => $this->get_setting('description', __('Pay instantly using your available digital wallet balance.', 'faiiya-pay')),
            'supports'    => ['products'],
        ];
    }
}
`
  },
  {
    path: 'includes/Gateways/WC_Block_Monnify.php',
    name: 'WC_Block_Monnify.php',
    category: 'gateway',
    description: 'WooCommerce Blocks integration for Monnify Direct Online Checkout.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Gateways;

use Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType;

defined('ABSPATH') || exit;

final class WC_Block_Monnify extends AbstractPaymentMethodType {
    protected $name = 'faiiya_pay_monnify';

    public function initialize(): void {
        $this->settings = get_option('woocommerce_faiiya_pay_monnify_settings', []);
    }

    public function is_active(): bool {
        return !empty($this->settings['enabled']) && 'no' !== $this->settings['enabled'];
    }

    public function get_payment_method_script_handles(): array {
        wp_register_script(
            'wc-faiiya-pay-blocks-js',
            FAIIYA_PAY_PLUGIN_URL . 'assets/js/faiiya-checkout-blocks.js',
            ['wc-blocks-registry', 'wp-element', 'wp-html-entities', 'wp-i18n'],
            FAIIYA_PAY_VERSION,
            true
        );
        return ['wc-faiiya-pay-blocks-js'];
    }

    public function get_payment_method_data(): array {
        return [
            'title'       => $this->get_setting('title', __('Debit Card / Bank Transfer / USSD (Monnify)', 'faiiya-pay')),
            'description' => $this->get_setting('description', __('Pay securely with ATM Card, Direct Bank Transfer, or USSD via Monnify.', 'faiiya-pay')),
            'supports'    => ['products'],
        ];
    }
}
`
  }
];
