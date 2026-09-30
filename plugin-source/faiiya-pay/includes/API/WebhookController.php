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

        $monnify_service = new MonnifyService();

        if (!$monnify_service->verify_webhook_signature($raw_body, $signature_header)) {
            $bypass = apply_filters('faiiya_bypass_webhook_signature_for_test', false, $request);
            if (!$bypass) {
                $this->log_webhook_attempt('monnify', 'UNKNOWN', 'INVALID_SIGNATURE', $raw_body, 'failed');
                return new \WP_REST_Response(['status' => 'error', 'message' => 'Invalid webhook signature.'], 403);
            }
        }

        $payload = json_decode($raw_body, true);
        if (!is_array($payload)) {
            return new \WP_REST_Response(['status' => 'error', 'message' => 'Invalid JSON body.'], 400);
        }

        $event_type = $payload['eventType'] ?? 'SUCCESSFUL_TRANSACTION';
        $event_data = $payload['eventData'] ?? $payload;

        $transaction_ref = $event_data['transactionReference'] ?? $event_data['paymentReference'] ?? '';
        if (empty($transaction_ref)) {
            return new \WP_REST_Response(['status' => 'error', 'message' => 'Missing transaction reference.'], 400);
        }

        // Module C Idempotency Check: Pre-reserve in webhook logs with UNIQUE constraint protection
        $table_logs = $wpdb->prefix . 'faiiya_webhook_logs';
        $existing_log = $wpdb->get_var(
            $wpdb->prepare("SELECT id FROM {$table_logs} WHERE transaction_reference = %s LIMIT 1", $transaction_ref)
        );

        $txn_model = new TransactionModel();
        if ($existing_log || $txn_model->reference_exists($transaction_ref)) {
            return new \WP_REST_Response([
                'status'  => 'success',
                'message' => 'Webhook already processed (Idempotent OK).',
            ], 200);
        }

        $inserted_log = $wpdb->insert(
            $table_logs,
            [
                'gateway'               => 'monnify',
                'event_type'            => $event_type,
                'transaction_reference' => $transaction_ref,
                'request_hash'          => hash('sha256', $raw_body),
                'payload'               => $raw_body,
                'processed_status'      => 'received',
                'created_at'            => current_time('mysql'),
            ],
            ['%s', '%s', '%s', '%s', '%s', '%s', '%s']
        );

        if (!$inserted_log) {
            // Database unique constraint violation caught: abort and return 200 OK immediately
            return new \WP_REST_Response([
                'status'  => 'success',
                'message' => 'Webhook already processed (Idempotent OK).',
            ], 200);
        }

        $payment_status = strtoupper($event_data['paymentStatus'] ?? '');
        if ($payment_status !== 'PAID' && $payment_status !== 'COMPLETED' && $payment_status !== 'SUCCESSFUL') {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'processed');
            return new \WP_REST_Response(['status' => 'ignored', 'message' => 'Transaction not paid.'], 200);
        }

        $amount_paid = (float) ($event_data['amountPaid'] ?? $event_data['amount'] ?? 0.00);
        if ($amount_paid <= 0) {
            return new \WP_REST_Response(['status' => 'error', 'message' => 'Invalid amount.'], 400);
        }

        $va_model = new VirtualAccountModel();
        $account_ref = $event_data['product']['reference'] ?? $event_data['accountReference'] ?? '';
        $account_num = $event_data['destinationAccountInformation']['accountNumber'] ?? '';
        $customer_email = $event_data['customer']['email'] ?? '';

        $user_id = $va_model->find_user_by_account($account_ref, $account_num);
        if (!$user_id && !empty($customer_email)) {
            $user = get_user_by('email', $customer_email);
            if ($user) {
                $user_id = (int) $user->ID;
            }
        }

        if (!$user_id) {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'failed');
            return new \WP_REST_Response([
                'status'  => 'error',
                'message' => 'No matching customer wallet found for account reference/email.',
            ], 404);
        }

        $is_first_deposit = !$txn_model->has_completed_deposit($user_id);
        $wallet_model = new WalletModel();

        try {
            $result = $wallet_model->credit(
                $user_id,
                $amount_paid,
                'deposit',
                $transaction_ref,
                [
                    'source'           => 'monnify_webhook',
                    'event_type'       => $event_type,
                    'account_number'   => $account_num,
                    'bank_code'        => $event_data['destinationAccountInformation']['bankCode'] ?? '',
                    'payment_method'   => $event_data['paymentMethod'] ?? 'ACCOUNT_TRANSFER',
                    'paid_on'          => $event_data['paidOn'] ?? current_time('mysql'),
                ]
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
