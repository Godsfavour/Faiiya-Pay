<?php
declare(strict_types=1);

namespace FaiiyaPay\API;

use FaiiyaPay\Services\MonnifyService;
use FaiiyaPay\Models\WalletModel;
use FaiiyaPay\Models\TransactionModel;
use FaiiyaPay\Models\VirtualAccountModel;
use FaiiyaPay\Models\ReferralModel;

defined('ABSPATH') || exit;

class WebhookController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/webhook/monnify', [
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'handle_monnify_webhook'],
            'permission_callback' => '__return_true',
        ]);
    }

    public function handle_monnify_webhook(\WP_REST_Request $request): \WP_REST_Response {
        global $wpdb;

        $raw_body = $request->get_body();
        $signature_header = $request->get_header('monnify-signature')
            ?: $request->get_header('monnify_signature')
            ?: $request->get_header('x-monnify-signature')
            ?: ($_SERVER['HTTP_MONNIFY_SIGNATURE'] ?? '');

        $payload = json_decode($raw_body, true);
        if (!is_array($payload)) {
            $this->log_webhook_attempt('monnify', 'UNKNOWN', 'INVALID_JSON', $raw_body, 'failed: invalid_json');
            return new \WP_REST_Response(['status' => 'error', 'message' => 'Invalid JSON body.'], 400);
        }

        $event_type = strtoupper((string) ($payload['eventType'] ?? 'SUCCESSFUL_TRANSACTION'));
        $event_data = $payload['eventData'] ?? $payload;
        $transaction_ref = (string) ($event_data['transactionReference'] ?? $event_data['paymentReference'] ?? '');

        $monnify_service = new MonnifyService();

        // 3-Tier Robust Verification:
        // Tier 1: Header HMAC-SHA512
        // Tier 2: Body transactionHash (Official formula: SHA-512 of secret|paymentRef|amount|paidOn|txnRef)
        // Tier 3: Query Monnify API directly if signature header was stripped by server proxy (Apache/Cloudflare/LiteSpeed)
        $is_verified = $monnify_service->verify_webhook_signature($raw_body, $signature_header, $event_data);

        if (!$is_verified && !empty($transaction_ref) && $monnify_service->is_configured()) {
            $query_check = $monnify_service->query_transaction($transaction_ref);
            if ($query_check && in_array(strtoupper((string) ($query_check['paymentStatus'] ?? '')), ['PAID', 'SUCCESSFUL', 'COMPLETED'], true)) {
                $is_verified = true;
            }
        }

        // Allow explicit test bypass filter
        if (!$is_verified) {
            $is_verified = apply_filters('faiiya_bypass_webhook_signature_for_test', false, $request);
        }

        if (!$is_verified) {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref ?: 'INVALID_SIG', $raw_body, 'failed: invalid_signature');
            return new \WP_REST_Response(['status' => 'error', 'message' => 'Invalid webhook signature.'], 403);
        }

        // Webhook Triage: Filter out unneeded webhooks with clean 200 OK
        $supported_events = [
            'SUCCESSFUL_TRANSACTION',
            'SUCCESSFUL_DISBURSEMENT',
            'FAILED_DISBURSEMENT',
            'WALLET_ACTIVITY'
        ];

        if (!in_array($event_type, $supported_events, true)) {
            // Acknowledge non-wallet webhooks (Refund, Settlement, Mandate, Bill Payment) cleanly
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref ?: 'IGNORED', $raw_body, 'ignored');
            return new \WP_REST_Response([
                'status'  => 'ignored',
                'message' => 'Event type ' . esc_html($event_type) . ' safely acknowledged (not required for wallet).',
            ], 200);
        }

        // Handle Monnify Wallet Statement & Activity Notifications
        if ($event_type === 'WALLET_ACTIVITY') {
            $this->log_webhook_attempt('monnify', $event_type, $event_data['reference'] ?? 'WALLET_PING', $raw_body, 'processed');
            return new \WP_REST_Response(['status' => 'success', 'message' => 'Wallet activity logged.'], 200);
        }

        // Handle Outbound Disbursement Status Webhooks
        if ($event_type === 'SUCCESSFUL_DISBURSEMENT' || $event_type === 'FAILED_DISBURSEMENT') {
            $disburse_ref = $event_data['reference'] ?? $event_data['batchReference'] ?? '';
            $this->log_webhook_attempt('monnify', $event_type, $disburse_ref, $raw_body, 'processed');
            return new \WP_REST_Response(['status' => 'success', 'message' => 'Disbursement webhook received.'], 200);
        }

        if (empty($transaction_ref)) {
            $this->log_webhook_attempt('monnify', $event_type, 'NO_REF', $raw_body, 'failed: missing_reference');
            return new \WP_REST_Response(['status' => 'error', 'message' => 'Missing transaction reference.'], 400);
        }

        // Module C Idempotency Check: Pre-reserve in webhook logs with UNIQUE constraint protection
        $table_logs = $wpdb->prefix . 'faiiya_webhook_logs';
        $existing_log = $wpdb->get_var(
            $wpdb->prepare("SELECT id FROM {$table_logs} WHERE transaction_reference = %s AND processed_status = 'processed' LIMIT 1", $transaction_ref)
        );

        $txn_model = new TransactionModel();
        if ($existing_log || $txn_model->reference_exists($transaction_ref)) {
            return new \WP_REST_Response([
                'status'  => 'success',
                'message' => 'Webhook already processed (Idempotent OK).',
            ], 200);
        }

        $payment_status = strtoupper((string) ($event_data['paymentStatus'] ?? ''));
        if ($payment_status !== 'PAID' && $payment_status !== 'COMPLETED' && $payment_status !== 'SUCCESSFUL') {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'ignored: not_paid');
            return new \WP_REST_Response(['status' => 'ignored', 'message' => 'Transaction not paid.'], 200);
        }

        $amount_paid = (float) ($event_data['amountPaid'] ?? $event_data['amount'] ?? 0.00);
        if ($amount_paid <= 0) {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'failed: invalid_amount');
            return new \WP_REST_Response(['status' => 'error', 'message' => 'Invalid amount.'], 400);
        }

        $payment_ref = (string) ($event_data['paymentReference'] ?? '');

        // 1. Direct WooCommerce Order Checkout Payment Webhook
        if (!empty($payment_ref) && (str_starts_with($payment_ref, 'WC-') || str_starts_with($payment_ref, 'WC_'))) {
            $order_id = 0;
            if (preg_match('/^WC(?:[-_]ORDER)?[-_](\d+)/i', $payment_ref, $matches)) {
                $order_id = (int) $matches[1];
            }
            if ($order_id > 0 && function_exists('wc_get_order')) {
                $order = wc_get_order($order_id);
                if ($order) {
                    if (!$order->is_paid()) {
                        $order->payment_complete($transaction_ref);
                        $order->add_order_note(
                            sprintf(
                                __('Monnify direct payment confirmed via webhook. Amount: ₦%s. Txn Ref: %s. Payment Ref: %s', 'faiiya-pay'),
                                number_format($amount_paid, 2),
                                $transaction_ref,
                                $payment_ref
                            )
                        );
                    }
                    $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'processed');
                    return new \WP_REST_Response([
                        'status'  => 'success',
                        'message' => 'WooCommerce Order #' . $order_id . ' payment marked complete.',
                    ], 200);
                }
            }
        }

        $va_model = new VirtualAccountModel();
        $account_ref = (string) ($event_data['product']['reference'] ?? $event_data['accountReference'] ?? '');
        $dest_acc_info = $event_data['destinationAccountInformation'] ?? [];
        $raw_account_num = (string) ($dest_acc_info['accountNumber'] ?? ($event_data['accountNumber'] ?? ''));
        $account_num = preg_replace('/\D/', '', $raw_account_num);
        $customer_email = sanitize_email(strtolower((string) ($event_data['customer']['email'] ?? '')));

        // Robust customer lookup: 1) Account number, 2) Account reference, 3) Customer email
        $user_id = $va_model->find_user_by_account($account_ref, $account_num);
        if (!$user_id && !empty($customer_email)) {
            $user = get_user_by('email', $customer_email);
            if ($user) {
                $user_id = (int) $user->ID;
            }
        }

        if (!$user_id) {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'failed: no_matching_customer_account');
            return new \WP_REST_Response([
                'status'  => 'error',
                'message' => 'No matching customer wallet found for account reference/number: ' . esc_html($account_num) . ' / email: ' . esc_html($customer_email),
            ], 404);
        }

        $is_first_deposit = !$txn_model->has_completed_deposit($user_id);
        $wallet_model = new WalletModel();

        // Rich Monnify metadata mapping from Monnify documentation
        $payer_info = $event_data['payerDetails'] ?? [];
        $meta_details = [
            'source'              => 'monnify_webhook',
            'event_type'          => $event_type,
            'destination_account' => $account_num,
            'destination_bank'    => $dest_acc_info['bankName'] ?? '',
            'bank_code'           => $dest_acc_info['bankCode'] ?? '',
            'payer_name'          => $payer_info['payerName'] ?? ($event_data['customer']['name'] ?? ''),
            'payer_account'       => $payer_info['payerAccountNumber'] ?? '',
            'payer_bank'          => $payer_info['payerBankCode'] ?? '',
            'channel'             => $event_data['paymentMethod'] ?? 'ACCOUNT_TRANSFER',
            'paid_on'             => $event_data['paidOn'] ?? current_time('mysql'),
            'settlement_amount'   => (float) ($event_data['settlementAmount'] ?? $amount_paid),
        ];

        try {
            $result = $wallet_model->credit(
                $user_id,
                $amount_paid,
                'deposit',
                $transaction_ref,
                $meta_details
            );

            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'processed');

            if ($is_first_deposit) {
                $referral_trigger = get_option('faiiya_referral_trigger', 'on_first_wallet_deposit');
                if ($referral_trigger === 'on_first_wallet_deposit') {
                    $referral_model = new ReferralModel();
                    $referral_model->process_reward_for_referee($user_id, 'first_wallet_deposit');
                }
            }

            return new \WP_REST_Response([
                'status'  => 'success',
                'message' => 'Wallet funded successfully.',
                'data'    => [
                    'txn_uuid'      => $result['txn_uuid'],
                    'balance_after' => $result['balance_after'],
                ],
            ], 200);
        } catch (\Throwable $e) {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'failed');
            return new \WP_REST_Response([
                'status'  => 'error',
                'message' => 'Transaction credit failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function log_webhook_attempt(
        string $gateway,
        string $event_type,
        string $reference,
        string $payload,
        string $status
    ): void {
        global $wpdb;
        $table = $wpdb->prefix . 'faiiya_webhook_logs';

        $wpdb->insert(
            $table,
            [
                'gateway'               => $gateway,
                'event_type'            => $event_type,
                'transaction_reference' => $reference,
                'request_hash'          => hash('sha256', $payload),
                'payload'               => $payload,
                'processed_status'      => $status,
                'created_at'            => current_time('mysql'),
            ],
            ['%s', '%s', '%s', '%s', '%s', '%s', '%s']
        );
    }
}
