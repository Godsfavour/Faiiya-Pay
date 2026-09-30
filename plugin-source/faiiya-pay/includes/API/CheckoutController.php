<?php
declare(strict_types=1);

namespace FaiiyaPay\API;

use FaiiyaPay\Models\WalletModel;

defined('ABSPATH') || exit;

class CheckoutController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/checkout/wallet-pay', [
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'process_wallet_payment'],
            'permission_callback' => [$this, 'check_user_permission'],
            'args'                => [
                'order_id' => ['required' => true, 'type' => 'integer'],
            ],
        ]);
    }

    public function process_wallet_payment(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
        $user_id  = get_current_user_id();
        $order_id = (int) $request->get_param('order_id');

        if (!function_exists('wc_get_order')) {
            return $this->error('woocommerce_missing', __('WooCommerce is required for checkout processing.', 'faiiya-pay'), 500);
        }

        $order = wc_get_order($order_id);
        if (!$order) {
            return $this->error('order_not_found', __('Order not found.', 'faiiya-pay'), 404);
        }

        if ((int) $order->get_user_id() !== $user_id && !current_user_can('manage_woocommerce')) {
            return $this->error('order_forbidden', __('You do not have permission to pay for this order.', 'faiiya-pay'), 403);
        }

        if ($order->is_paid()) {
            return $this->error('order_already_paid', __('This order has already been paid.', 'faiiya-pay'), 400);
        }

        $order_total = (float) $order->get_total();
        $reference   = 'WC-HEADLESS-' . $order_id . '-' . time();

        $wallet_model = new WalletModel();

        try {
            $txn = $wallet_model->debit(
                $user_id,
                $order_total,
                'debit_order',
                $reference,
                [
                    'source'       => 'headless_rest_api',
                    'order_id'     => $order_id,
                    'order_number' => $order->get_order_number(),
                ]
            );

            $order->set_payment_method('faiiya_pay_wallet');
            $order->set_payment_method_title(__('Faiiya Pay Digital Wallet (Headless)', 'faiiya-pay'));
            $order->payment_complete($txn['txn_uuid']);
            $order->add_order_note(
                sprintf(
                    __('Paid via Headless REST API. Amount: ₦%s. Txn UUID: %s. Remaining: ₦%s', 'faiiya-pay'),
                    number_format($order_total, 2),
                    $txn['txn_uuid'],
                    number_format($txn['balance_after'], 2)
                )
            );

            return $this->success([
                'order_id'       => $order_id,
                'order_status'   => $order->get_status(),
                'order_total'    => $order_total,
                'txn_uuid'       => $txn['txn_uuid'],
                'balance_after'  => $txn['balance_after'],
            ], __('Payment completed successfully.', 'faiiya-pay'));
        } catch (\UnderflowException $e) {
            return $this->error('insufficient_balance', $e->getMessage(), 402, [
                'required' => $order_total,
            ]);
        } catch (\Throwable $e) {
            return $this->error('payment_failed', $e->getMessage(), 500);
        }
    }
}
