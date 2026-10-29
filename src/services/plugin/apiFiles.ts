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

        // Live Monnify Inbound Payment Polling Listener
        register_rest_route($this->namespace, '/wallet/check-deposit', [
            'methods'             => \\WP_REST_Server::READABLE,
            'callback'            => [$this, 'check_deposit'],
            'permission_callback' => [$this, 'check_user_permission'],
            'args'                => [
                'since'           => ['required' => false, 'type' => 'string'],
                'since_id'        => ['required' => false, 'type' => 'integer'],
                'expected_amount' => ['required' => false, 'type' => 'number'],
            ],
        ]);
    }

    public function check_deposit(\\WP_REST_Request $request): \\WP_REST_Response {
        global $wpdb;
        $user_id = get_current_user_id();
        $wallet_model = new WalletModel();
        $wallet = $wallet_model->ensure_wallet_exists($user_id);

        $table_txns = $wpdb->prefix . 'faiiya_transactions';
        $since_id = (int) ($request->get_param('since_id') ?? 0);
        $since_time = sanitize_text_field((string) ($request->get_param('since') ?? ''));

        // 1. Check local database strictly for a completed deposit that was created AFTER the modal was opened
        $latest = null;
        if ($since_id > 0) {
            $latest = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table_txns} 
                 WHERE user_id = %d AND type = 'deposit' AND status = 'completed' AND id > %d 
                 ORDER BY id DESC LIMIT 1",
                $user_id,
                $since_id
            ));
        } elseif (!empty($since_time)) {
            // Strictly check created_at greater than the modal open timestamp (NEVER fallback to past deposits)
            $latest = $wpdb->get_row($wpdb->prepare(
                "SELECT * FROM {$table_txns} 
                 WHERE user_id = %d AND type = 'deposit' AND status = 'completed' AND created_at > %s 
                 ORDER BY id DESC LIMIT 1",
                $user_id,
                $since_time
            ));
        }

        if ($latest) {
            return $this->success([
                'funded'        => true,
                'amount'        => (float) $latest->amount,
                'reference'     => $latest->reference,
                'balance_after' => (float) $latest->balance_after,
                'created_at'    => $latest->created_at,
                'txn_id'        => (int) $latest->id,
            ]);
        }

        // 2. Active Direct Sync with Monnify API:
        // In case the webhook was delayed or blocked by host bot-protection/security,
        // synchronize directly with Monnify API reserved accounts right now.
        $monnify_service = new MonnifyService();
        if ($monnify_service->is_configured()) {
            $sync_res = $monnify_service->sync_customer_reserved_transactions($user_id);
            if (!empty($sync_res['credited']) && is_array($sync_res['credited'])) {
                $latest_credited = end($sync_res['credited']);
                return $this->success([
                    'funded'        => true,
                    'amount'        => (float) $latest_credited['amount'],
                    'reference'     => $latest_credited['reference'],
                    'balance_after' => (float) $latest_credited['balance_after'],
                    'created_at'    => current_time('mysql'),
                    'txn_id'        => (int) ($latest_credited['txn_id'] ?? 0),
                ]);
            }
        }

        return $this->success([
            'funded'  => false,
            'balance' => $wallet_model->get_balance($user_id),
        ]);
    }

    public function get_balance(\\WP_REST_Request $request): \\WP_REST_Response {
        $user_id = get_current_user_id();

        $wallet_model = new WalletModel();
        $wallet = $wallet_model->get_wallet($user_id) ?: $wallet_model->ensure_wallet_exists($user_id);

        $va_model = new VirtualAccountModel();
        $virtual_accounts = $va_model->get_user_accounts($user_id);

        return $this->success([
            'wallet_id'        => (int) ($wallet->id ?? 0),
            'user_id'          => $user_id,
            'balance'          => $wallet_model->get_balance($user_id),
            'currency'         => $wallet->currency ?? 'NGN',
            'status'           => $wallet->status ?? 'active',
            'kyc_status'       => $wallet->kyc_status ?? 'unverified',
            'virtual_accounts' => $virtual_accounts,
            'last_updated'     => $wallet->updated_at ?? current_time('mysql'),
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

            // 2. Name Compliance Replacement: Keep complete registered name or verified customer full name. NEVER truncate to 3 letters!
            $raw_account_name = (string) ($monnify_resp['accountName'] ?? '');
            $raw_customer_name = (string) ($monnify_resp['customerName'] ?? '');

            // Clean any corporate prefixes like "FAIIYA / " or "FAIIYA - "
            $cleaned_account_name = trim((string) preg_replace('/^FAIIYA\s*[\/\-]\s*/i', '', $raw_account_name));

            $existing_first = (string) $user->first_name;
            $existing_last  = (string) $user->last_name;
            $official_first = $existing_first;
            $official_last  = $existing_last;
            $official_other = (string) get_user_meta($user_id, 'other_names', true);

            // If customerName from Monnify contains full words, use it
            if (!empty($raw_customer_name)) {
                $c_parts = preg_split('/\\s+/', trim($raw_customer_name));
                if (count($c_parts) >= 2) {
                    $official_first = sanitize_text_field($c_parts[0]);
                    $official_last  = sanitize_text_field(end($c_parts));
                    if (count($c_parts) > 2) {
                        $official_other = sanitize_text_field(implode(' ', array_slice($c_parts, 1, -1)));
                    }
                } elseif (count($c_parts) === 1 && strlen($c_parts[0]) > 3) {
                    $official_first = sanitize_text_field($c_parts[0]);
                }
            } elseif (!empty($cleaned_account_name)) {
                // Only parse cleaned_account_name if it is NOT a 3-letter abbreviation
                $a_parts = preg_split('/\\s+/', $cleaned_account_name);
                if (count($a_parts) >= 2) {
                    $official_first = sanitize_text_field($a_parts[0]);
                    $official_last  = sanitize_text_field(end($a_parts));
                } elseif (count($a_parts) === 1 && strlen($a_parts[0]) > 3 && empty($existing_first)) {
                    $official_first = sanitize_text_field($a_parts[0]);
                }
            }

            if (empty($official_first)) {
                $official_first = $user->display_name ?: 'Customer';
            }

            wp_update_user([
                'ID'           => $user_id,
                'first_name'   => $official_first,
                'last_name'    => $official_last,
                'display_name' => trim("{$official_first} {$official_other} {$official_last}"),
            ]);
            if (!empty($official_other)) {
                update_user_meta($user_id, 'other_names', $official_other);
            }
            update_user_meta($user_id, 'faiiya_kyc_status', 'verified');
            $synced_name = trim("{$official_first} {$official_other} {$official_last}");

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

        $payload = json_decode($raw_body, true);
        if (!is_array($payload)) {
            $this->log_webhook_attempt('monnify', 'UNKNOWN', 'INVALID_JSON', $raw_body, 'failed: invalid_json');
            return new \\WP_REST_Response(['status' => 'error', 'message' => 'Invalid JSON body.'], 400);
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
            return new \\WP_REST_Response(['status' => 'error', 'message' => 'Invalid webhook signature.'], 403);
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
            return new \\WP_REST_Response([
                'status'  => 'ignored',
                'message' => 'Event type ' . esc_html($event_type) . ' safely acknowledged (not required for wallet).',
            ], 200);
        }

        // Handle Monnify Wallet Statement & Activity Notifications
        if ($event_type === 'WALLET_ACTIVITY') {
            $this->log_webhook_attempt('monnify', $event_type, $event_data['reference'] ?? 'WALLET_PING', $raw_body, 'processed');
            return new \\WP_REST_Response(['status' => 'success', 'message' => 'Wallet activity logged.'], 200);
        }

        // Handle Outbound Disbursement Status Webhooks
        if ($event_type === 'SUCCESSFUL_DISBURSEMENT' || $event_type === 'FAILED_DISBURSEMENT') {
            $disburse_ref = $event_data['reference'] ?? $event_data['batchReference'] ?? '';
            $this->log_webhook_attempt('monnify', $event_type, $disburse_ref, $raw_body, 'processed');
            return new \\WP_REST_Response(['status' => 'success', 'message' => 'Disbursement webhook received.'], 200);
        }

        if (empty($transaction_ref)) {
            $this->log_webhook_attempt('monnify', $event_type, 'NO_REF', $raw_body, 'failed: missing_reference');
            return new \\WP_REST_Response(['status' => 'error', 'message' => 'Missing transaction reference.'], 400);
        }

        // Module C Idempotency Check: Pre-reserve in webhook logs with UNIQUE constraint protection
        $table_logs = $wpdb->prefix . 'faiiya_webhook_logs';
        $existing_log = $wpdb->get_var(
            $wpdb->prepare("SELECT id FROM {$table_logs} WHERE transaction_reference = %s AND processed_status = 'processed' LIMIT 1", $transaction_ref)
        );

        $txn_model = new TransactionModel();
        if ($existing_log || $txn_model->reference_exists($transaction_ref)) {
            return new \\WP_REST_Response([
                'status'  => 'success',
                'message' => 'Webhook already processed (Idempotent OK).',
            ], 200);
        }

        $payment_status = strtoupper((string) ($event_data['paymentStatus'] ?? ''));
        if ($payment_status !== 'PAID' && $payment_status !== 'COMPLETED' && $payment_status !== 'SUCCESSFUL') {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'ignored: not_paid');
            return new \\WP_REST_Response(['status' => 'ignored', 'message' => 'Transaction not paid.'], 200);
        }

        $amount_paid = (float) ($event_data['amountPaid'] ?? $event_data['amount'] ?? 0.00);
        if ($amount_paid <= 0) {
            $this->log_webhook_attempt('monnify', $event_type, $transaction_ref, $raw_body, 'failed: invalid_amount');
            return new \\WP_REST_Response(['status' => 'error', 'message' => 'Invalid amount.'], 400);
        }

        $payment_ref = (string) ($event_data['paymentReference'] ?? '');

        // 1. Direct WooCommerce Order Checkout Payment Webhook
        if (!empty($payment_ref) && (str_starts_with($payment_ref, 'WC-') || str_starts_with($payment_ref, 'WC_'))) {
            $order_id = 0;
            if (preg_match('/^WC(?:[-_]ORDER)?[-_](\\d+)/i', $payment_ref, $matches)) {
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
                    return new \\WP_REST_Response([
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
        $account_num = preg_replace('/\\D/', '', $raw_account_num);
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
            return new \\WP_REST_Response([
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
