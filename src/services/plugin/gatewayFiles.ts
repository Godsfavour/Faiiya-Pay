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
        if ('yes' !== $this->enabled) {
            return false;
        }

        if (is_admin()) {
            return parent::is_available();
        }

        if (!is_user_logged_in()) {
            // Keep visible at checkout so guest knows wallet is accepted, prompting login
            return apply_filters('faiiya_pay_gateway_available_for_guests', true);
        }

        $user_id = get_current_user_id();
        $wallet_model = new \\FaiiyaPay\\Models\\WalletModel();
        $wallet = $wallet_model->ensure_wallet_exists($user_id);

        if ($wallet->status !== 'active') {
            return false;
        }

        return parent::is_available();
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
        $wallet = $wallet_model->ensure_wallet_exists($user_id);
        $balance = (float) $wallet->balance;
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
  }
];
