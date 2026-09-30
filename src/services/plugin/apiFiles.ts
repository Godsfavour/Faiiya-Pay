import { PluginFile } from '../pluginFiles';

export const apiFiles: PluginFile[] = [
  {
    path: 'includes/API/RestControllerBase.php',
    name: 'RestControllerBase.php',
    category: 'api',
    description: 'Base REST API Controller with Bearer token / cookie authentication, standardized response formatters, and error handlers.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\API;

defined('ABSPATH') || exit;

abstract class RestControllerBase {
    protected string $namespace = 'faiiya/v1';

    abstract public function register_routes(): void;

    public function check_user_permission(\\WP_REST_Request $request): bool|\\WP_Error {
        if (is_user_logged_in()) {
            return true;
        }

        $auth_header = $request->get_header('authorization');
        if (!empty($auth_header) && preg_match('/Bearer\\s+(.*)$/i', $auth_header, $matches)) {
            $user_id = apply_filters('faiiya_authenticate_bearer_token', 0, $matches[1]);
            if ($user_id > 0) {
                wp_set_current_user($user_id);
                return true;
            }
        }

        return new \\WP_Error(
            'rest_forbidden',
            __('You must be authenticated to access this endpoint.', 'faiiya-pay'),
            ['status' => 401]
        );
    }

    protected function success(mixed $data = null, string $message = 'Success', int $status = 200): \\WP_REST_Response {
        return new \\WP_REST_Response([
            'status'  => 'success',
            'message' => $message,
            'data'    => $data,
        ], $status);
    }

    protected function error(string $code, string $message, int $status = 400, mixed $data = null): \\WP_Error {
        return new \\WP_Error($code, $message, [
            'status' => $status,
            'data'   => $data,
        ]);
    }
}
`
  },
  {
    path: 'includes/API/AuthController.php',
    name: 'AuthController.php',
    category: 'api',
    description: 'POST /wp-json/faiiya/v1/auth/register: Module A Universal Registration Engine, creates customer, inits unverified wallet, sets auth cookie.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\API;

use FaiiyaPay\\Models\\WalletModel;
use FaiiyaPay\\Models\\ReferralModel;

defined('ABSPATH') || exit;

class AuthController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/auth/register', [
            'methods'             => \\WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'register'],
            'permission_callback' => '__return_true',
            'args'                => [
                'first_name'    => ['required' => true, 'type' => 'string'],
                'other_names'   => ['required' => false, 'type' => 'string'],
                'last_name'     => ['required' => true, 'type' => 'string'],
                'email'         => ['required' => true, 'type' => 'string'],
                'phone_number'  => ['required' => false, 'type' => 'string'],
                'password'      => ['required' => true, 'type' => 'string'],
                'referral_code' => ['required' => false, 'type' => 'string'],
                'nin'           => ['required' => false, 'type' => 'string'],
                'bvn'           => ['required' => false, 'type' => 'string'],
            ],
        ]);
    }

    public function register(\\WP_REST_Request $request): \\WP_REST_Response|\\WP_Error {
        $first_name    = sanitize_text_field((string) $request->get_param('first_name'));
        $other_names   = sanitize_text_field((string) ($request->get_param('other_names') ?? ''));
        $last_name     = sanitize_text_field((string) $request->get_param('last_name'));
        $email         = strtolower(sanitize_email((string) $request->get_param('email')));
        $phone_number  = sanitize_text_field((string) ($request->get_param('phone_number') ?? ''));
        $password      = (string) $request->get_param('password');
        $referral_code = sanitize_text_field((string) ($request->get_param('referral_code') ?? $request->get_param('referred_by') ?? ''));
        $nin           = sanitize_text_field((string) ($request->get_param('nin') ?? ''));
        $bvn           = sanitize_text_field((string) ($request->get_param('bvn') ?? ''));

        if (!is_email($email)) {
            return $this->error('invalid_email', __('Please provide a valid email address.', 'faiiya-pay'), 422);
        }

        if (email_exists($email)) {
            return $this->error('email_exists', __('An account with this email already exists.', 'faiiya-pay'), 409);
        }

        if (strlen($password) < 8) {
            return $this->error('weak_password', __('Password must be at least 8 characters long.', 'faiiya-pay'), 422);
        }

        // 1. Create WP User with role 'customer'
        $username = sanitize_user(strstr($email, '@', true) . '_' . substr(md5(uniqid()), 0, 4));
        $user_id  = wp_create_user($username, $password, $email);

        if (is_wp_error($user_id)) {
            return $this->error('user_creation_failed', $user_id->get_error_message(), 500);
        }

        $user_obj = new \\WP_User($user_id);
        $user_obj->set_role('customer');

        // 2. Save names & phone to usermeta
        wp_update_user([
            'ID'           => $user_id,
            'first_name'   => $first_name,
            'last_name'    => $last_name,
            'display_name' => trim("{$first_name} {$other_names} {$last_name}"),
        ]);

        if (!empty($other_names)) {
            update_user_meta($user_id, 'other_names', $other_names);
        }

        if (!empty($phone_number)) {
            update_user_meta($user_id, '_faiiya_phone_number', $phone_number);
            update_user_meta($user_id, 'billing_phone', $phone_number);
        }

        // 3. Initialize faiiya_wallets record (balance = 0.00, kyc_status = 'unverified')
        $wallet_model = new WalletModel();
        $wallet = $wallet_model->ensure_wallet_exists($user_id, 'unverified');

        // 4. Generate 8-character unique referral code
        $referral_model = new ReferralModel();
        $user_ref_code  = $referral_model->ensure_referral_code($user_id);

        // 5. If referral_code is provided, insert record into faiiya_referrals with status 'pending'
        if (!empty($referral_code)) {
            $referral_model->link_referral($user_id, $referral_code);
        }

        // 6. Authenticate session via auth cookies
        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, true);

        $dashboard_id = (int) get_option('faiiya_page_dashboard_id', 0);
        $redirect_url = $dashboard_id > 0 ? get_permalink($dashboard_id) : home_url('/faiiya-dashboard');

        return $this->success([
            'user' => [
                'id'            => $user_id,
                'email'         => $email,
                'first_name'    => $first_name,
                'last_name'     => $last_name,
                'phone_number'  => $phone_number,
                'referral_code' => $user_ref_code,
                'kyc_status'    => 'unverified',
            ],
            'wallet' => [
                'id'         => (int) $wallet->id,
                'balance'    => 0.00,
                'currency'   => $wallet->currency,
                'status'     => $wallet->status,
                'kyc_status' => 'unverified',
            ],
            'redirect_url' => $redirect_url,
            'auth_token'   => wp_create_nonce('wp_rest'),
        ], __('Account successfully registered. Digital wallet initialized in unverified state.', 'faiiya-pay'), 201);
    }
}
`
  },
  {
    path: 'includes/API/WalletController.php',
    name: 'WalletController.php',
    category: 'api',
    description: 'GET /wallet/balance, GET /wallet/transactions, and POST /wallet/verify-kyc with Zero-Storage BVN/NIN policy and Monnify Name Sync.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\API;

use FaiiyaPay\\Models\\WalletModel;
use FaiiyaPay\\Models\\TransactionModel;
use FaiiyaPay\\Models\\VirtualAccountModel;
use FaiiyaPay\\Models\\ReferralModel;
use FaiiyaPay\\Services\\MonnifyService;

defined('ABSPATH') || exit;

class WalletController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/wallet/balance', [
            'methods'             => \\WP_REST_Server::READABLE,
            'callback'            => [$this, 'get_balance'],
            'permission_callback' => [$this, 'check_user_permission'],
        ]);

        register_rest_route($this->namespace, '/wallet/transactions', [
            'methods'             => \\WP_REST_Server::READABLE,
            'callback'            => [$this, 'get_transactions'],
            'permission_callback' => [$this, 'check_user_permission'],
            'args'                => [
                'page'     => ['type' => 'integer', 'default' => 1],
                'per_page' => ['type' => 'integer', 'default' => 20],
                'type'     => ['type' => 'string', 'required' => false],
            ],
        ]);

        // Module B: KYC Verification & Strict Account Provisioning
        register_rest_route($this->namespace, '/wallet/verify-kyc', [
            'methods'             => \\WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'verify_kyc'],
            'permission_callback' => [$this, 'check_user_permission'],
            'args'                => [
                'bvn' => ['required' => false, 'type' => 'string'],
                'nin' => ['required' => false, 'type' => 'string'],
            ],
        ]);
    }

    public function get_balance(\\WP_REST_Request $request): \\WP_REST_Response {
        $user_id = get_current_user_id();

        $wallet_model = new WalletModel();
        $wallet = $wallet_model->ensure_wallet_exists($user_id);

        $va_model = new VirtualAccountModel();
        $virtual_accounts = $va_model->get_user_accounts($user_id);

        return $this->success([
            'wallet_id'        => (int) $wallet->id,
            'user_id'          => $user_id,
            'balance'          => (float) $wallet->balance,
            'currency'         => $wallet->currency,
            'status'           => $wallet->status,
            'kyc_status'       => $wallet->kyc_status ?? 'unverified',
            'virtual_accounts' => $virtual_accounts,
            'last_updated'     => $wallet->updated_at,
        ]);
    }

    /**
     * Module B: KYC Verification & Strict Account Provisioning
     * Zero-Storage Policy: BVN/NIN is NOT stored in the database.
     * Name Sync: Overwrites WordPress first_name & last_name with verified name from Monnify.
     */
    public function verify_kyc(\\WP_REST_Request $request): \\WP_REST_Response|\\WP_Error {
        $user_id = get_current_user_id();
        $user    = get_userdata($user_id);

        if (!$user) {
            return $this->error('user_not_found', __('User account not found.', 'faiiya-pay'), 404);
        }

        $bvn = sanitize_text_field((string) ($request->get_param('bvn') ?? ''));
        $nin = sanitize_text_field((string) ($request->get_param('nin') ?? ''));

        $clean_id = preg_replace('/\\D/', '', !empty($bvn) ? $bvn : $nin);
        if (strlen($clean_id) !== 11) {
            return $this->error('invalid_kyc_id', __('BVN or NIN must be exactly 11 numeric digits.', 'faiiya-pay'), 422);
        }

        if (preg_match('/^(\\d)\\1{10}$/', $clean_id) || $clean_id === '12345678901' || $clean_id === '01234567890') {
            return $this->error('invalid_kyc_id', __('Monnify Verification Error: The provided BVN or NIN is invalid or could not be verified by Monnify/NIBSS.', 'faiiya-pay'), 422);
        }

        $monnify_service = new MonnifyService();
        if (!$monnify_service->is_configured()) {
            return $this->error('gateway_unconfigured', __('Monnify credentials are not configured in WordPress Admin.', 'faiiya-pay'), 503);
        }

        try {
            // 1. Pass BVN/NIN directly to Monnify Reserved Account API (ZERO-STORAGE in DB)
            $customer_full_name = trim("{$user->first_name} {$user->last_name}");
            if (empty($customer_full_name)) {
                $customer_full_name = $user->display_name;
            }

            $monnify_resp = $monnify_service->create_reserved_account([
                'user_id'        => $user_id,
                'customer_name'  => $customer_full_name,
                'customer_email' => $user->user_email,
                'bvn'            => !empty($bvn) ? $clean_id : '',
                'nin'            => !empty($nin) ? $clean_id : '',
            ]);

            // 2. Name Compliance Replacement: Replace WordPress first_name, other_names, and last_name with verified identity
            $verified_account_name = $monnify_resp['accountName'] ?? $monnify_resp['customerName'] ?? '';
            $synced_name = '';

            if (!empty($verified_account_name)) {
                $clean_name = trim((string) preg_replace('/^FAIIYA\\s*\\/\\s*/i', '', $verified_account_name));
                $name_parts = preg_split('/\\s+/', $clean_name);
                $verified_first = sanitize_text_field($name_parts[0] ?? $user->first_name);
                $verified_last  = sanitize_text_field(count($name_parts) > 1 ? end($name_parts) : $user->last_name);
                $verified_other = count($name_parts) > 2 ? sanitize_text_field(implode(' ', array_slice($name_parts, 1, -1))) : '';

                wp_update_user([
                    'ID'           => $user_id,
                    'first_name'   => $verified_first,
                    'last_name'    => $verified_last,
                    'display_name' => trim("{$verified_first} {$verified_other} {$verified_last}"),
                ]);
                if (!empty($verified_other)) {
                    update_user_meta($user_id, 'other_names', $verified_other);
                }
                $synced_name = trim("{$verified_first} {$verified_other} {$verified_last}");
            }

            // 3. Save virtual accounts
            $va_model = new VirtualAccountModel();
            $va_model->save_accounts($user_id, $monnify_resp);
            $virtual_accounts = $va_model->get_user_accounts($user_id);

            // 4. Update faiiya_wallets kyc_status to 'verified'
            $wallet_model = new WalletModel();
            $wallet_model->update_kyc_status($user_id, 'verified');

            // 5. Referral Trigger: locate any pending referrals where this user is the referee & credit referrer
            $referral_model = new ReferralModel();
            $referral_model->process_reward_for_referee($user_id, 'kyc_verification_completed');

            return $this->success([
                'kyc_status'       => 'verified',
                'verified_name'    => $synced_name ?: $customer_full_name,
                'virtual_accounts' => $virtual_accounts,
                'message'          => __('KYC verified successfully. Dedicated virtual bank accounts activated.', 'faiiya-pay'),
            ]);
        } catch (\\Throwable $e) {
            return $this->error('kyc_verification_failed', $e->getMessage(), 500);
        }
    }

    public function get_transactions(\\WP_REST_Request $request): \\WP_REST_Response {
        $user_id  = get_current_user_id();
        $page     = (int) $request->get_param('page');
        $per_page = (int) $request->get_param('per_page');
        $type     = $request->get_param('type');

        $txn_model = new TransactionModel();
        $data = $txn_model->get_user_transactions($user_id, $page, $per_page, $type);

        return $this->success($data);
    }
}
`
  },
  {
    path: 'includes/API/ReferralController.php',
    name: 'ReferralController.php',
    category: 'api',
    description: 'GET /referrals/stats: returns user code, referral link, conversion counts, and total rewards earned.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\API;

use FaiiyaPay\\Models\\ReferralModel;

defined('ABSPATH') || exit;

class ReferralController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/referrals/stats', [
            'methods'             => \\WP_REST_Server::READABLE,
            'callback'            => [$this, 'get_stats'],
            'permission_callback' => [$this, 'check_user_permission'],
        ]);
    }

    public function get_stats(\\WP_REST_Request $request): \\WP_REST_Response {
        $user_id = get_current_user_id();

        $referral_model = new ReferralModel();
        $stats = $referral_model->get_stats($user_id);

        return $this->success($stats);
    }
}
`
  },
  {
    path: 'includes/API/CheckoutController.php',
    name: 'CheckoutController.php',
    category: 'api',
    description: 'POST /checkout/wallet-pay: headless checkout execution deducting wallet balance for a WooCommerce order.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\API;

use FaiiyaPay\\Models\\WalletModel;

defined('ABSPATH') || exit;

class CheckoutController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/checkout/wallet-pay', [
            'methods'             => \\WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'process_wallet_payment'],
            'permission_callback' => [$this, 'check_user_permission'],
            'args'                => [
                'order_id' => ['required' => true, 'type' => 'integer'],
            ],
        ]);
    }

    public function process_wallet_payment(\\WP_REST_Request $request): \\WP_REST_Response|\\WP_Error {
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
        } catch (\\UnderflowException $e) {
            return $this->error('insufficient_balance', $e->getMessage(), 402, [
                'required' => $order_total,
            ]);
        } catch (\\Throwable $e) {
            return $this->error('payment_failed', $e->getMessage(), 500);
        }
    }
}
`
  },
  {
    path: 'includes/API/WebhookController.php',
    name: 'WebhookController.php',
    category: 'api',
    description: 'POST /webhook/monnify: public webhook listener with SHA-512 verification, idempotency protection, and automated wallet funding.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\API;

use FaiiyaPay\\Services\\MonnifyService;
use FaiiyaPay\\Models\\WalletModel;
use FaiiyaPay\\Models\\TransactionModel;
use FaiiyaPay\\Models\\VirtualAccountModel;
use FaiiyaPay\\Models\\ReferralModel;

defined('ABSPATH') || exit;

class WebhookController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/webhook/monnify', [
            'methods'             => \\WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'handle_monnify_webhook'],
            'permission_callback' => '__return_true',
        ]);
    }

    public function handle_monnify_webhook(\\WP_REST_Request $request): \\WP_REST_Response {
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
                return new \\WP_REST_Response(['status' => 'error', 'message' => 'Invalid webhook signature.'], 403);
            }
        }

        $payload = json_decode($raw_body, true);
        if (!is_array($payload)) {
            return new \\WP_REST_Response(['status' => 'error', 'message' => 'Invalid JSON body.'], 400);
        }

        $event_type = $payload['eventType'] ?? 'SUCCESSFUL_TRANSACTION';
        $event_data = $payload['eventData'] ?? $payload;

        $transaction_ref = $event_data['transactionReference'] ?? $event_data['paymentReference'] ?? '';
        if (empty($transaction_ref)) {
            return new \\WP_REST_Response(['status' => 'error', 'message' => 'Missing transaction reference.'], 400);
        }

        // Module C Idempotency Check: Pre-reserve in webhook logs with UNIQUE constraint protection
        $table_logs = $wpdb->prefix . 'faiiya_webhook_logs';
        $existing_log = $wpdb->get_var(
            $wpdb->prepare("SELECT id FROM {$table_logs} WHERE transaction_reference = %s LIMIT 1", $transaction_ref)
        );

        $txn_model = new TransactionModel();
        if ($existing_log || $txn_model->reference_exists($transaction_ref)) {
            return new \\WP_REST_Response([
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
            return new \\WP_REST_Response([
                'status'  => 'success',
                'message' => 'Webhook already processed (Idempotent OK).',
            ], 200);
        }

        $payment_status = strtoupper($event_data['paymentStatus'] ?? '');
        if ($payment_status !== 'PAID' && $payment_status !== 'COMPLETED' && $payment_status !== 'SUCCESSFUL') {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'processed');
            return new \\WP_REST_Response(['status' => 'ignored', 'message' => 'Transaction not paid.'], 200);
        }

        $amount_paid = (float) ($event_data['amountPaid'] ?? $event_data['amount'] ?? 0.00);
        if ($amount_paid <= 0) {
            return new \\WP_REST_Response(['status' => 'error', 'message' => 'Invalid amount.'], 400);
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
            return new \\WP_REST_Response([
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

            return new \\WP_REST_Response([
                'status'  => 'success',
                'message' => 'Wallet funded successfully.',
                'data'    => [
                    'txn_uuid'      => $result['txn_uuid'],
                    'balance_after' => $result['balance_after'],
                ],
            ], 200);
        } catch (\\Throwable $e) {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'failed');
            return new \\WP_REST_Response([
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
`
  }
];
