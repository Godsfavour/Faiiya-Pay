<?php
declare(strict_types=1);

namespace FaiiyaPay\Gateways;

use FaiiyaPay\Services\MonnifyService;

defined('ABSPATH') || exit;

if (!class_exists('WC_Payment_Gateway')) {
    return;
}

class WC_Gateway_Monnify extends \WC_Payment_Gateway {
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
                throw new \RuntimeException(__('Monnify did not return a checkout URL.', 'faiiya-pay'));
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
        } catch (\Throwable $e) {
            wc_add_notice(__('Monnify Checkout Error: ', 'faiiya-pay') . $e->getMessage(), 'error');
            return ['result' => 'failure', 'redirect' => ''];
        }
    }
}
