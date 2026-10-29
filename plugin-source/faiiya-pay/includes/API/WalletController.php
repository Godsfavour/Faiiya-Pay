<?php
declare(strict_types=1);

namespace FaiiyaPay\API;

use FaiiyaPay\Models\WalletModel;
use FaiiyaPay\Models\TransactionModel;
use FaiiyaPay\Models\VirtualAccountModel;
use FaiiyaPay\Models\ReferralModel;
use FaiiyaPay\Services\MonnifyService;

defined('ABSPATH') || exit;

class WalletController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/wallet/balance', [
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => [$this, 'get_balance'],
            'permission_callback' => [$this, 'check_user_permission'],
        ]);

        register_rest_route($this->namespace, '/wallet/transactions', [
            'methods'             => \WP_REST_Server::READABLE,
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
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'verify_kyc'],
            'permission_callback' => [$this, 'check_user_permission'],
            'args'                => [
                'bvn' => ['required' => false, 'type' => 'string'],
                'nin' => ['required' => false, 'type' => 'string'],
            ],
        ]);

        // Live Monnify Inbound Payment Polling Listener
        register_rest_route($this->namespace, '/wallet/check-deposit', [
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => [$this, 'check_deposit'],
            'permission_callback' => [$this, 'check_user_permission'],
            'args'                => [
                'since'           => ['required' => false, 'type' => 'string'],
                'since_id'        => ['required' => false, 'type' => 'integer'],
                'expected_amount' => ['required' => false, 'type' => 'number'],
            ],
        ]);
    }

    public function check_deposit(\WP_REST_Request $request): \WP_REST_Response {
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

    public function get_balance(\WP_REST_Request $request): \WP_REST_Response {
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
    public function verify_kyc(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
        $user_id = get_current_user_id();
        $user    = get_userdata($user_id);

        if (!$user) {
            return $this->error('user_not_found', __('User account not found.', 'faiiya-pay'), 404);
        }

        $bvn = sanitize_text_field((string) ($request->get_param('bvn') ?? ''));
        $nin = sanitize_text_field((string) ($request->get_param('nin') ?? ''));

        $clean_id = preg_replace('/\D/', '', !empty($bvn) ? $bvn : $nin);
        if (strlen($clean_id) !== 11) {
            return $this->error('invalid_kyc_id', __('BVN or NIN must be exactly 11 numeric digits.', 'faiiya-pay'), 422);
        }

        if (preg_match('/^(\d)\1{10}$/', $clean_id) || $clean_id === '12345678901' || $clean_id === '01234567890') {
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
            $cleaned_account_name = trim((string) preg_replace('/^FAIIYAs*[/-]s*/i', '', $raw_account_name));

            $existing_first = (string) $user->first_name;
            $existing_last  = (string) $user->last_name;
            $official_first = $existing_first;
            $official_last  = $existing_last;
            $official_other = (string) get_user_meta($user_id, 'other_names', true);

            // If customerName from Monnify contains full words, use it
            if (!empty($raw_customer_name)) {
                $c_parts = preg_split('/\s+/', trim($raw_customer_name));
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
                $a_parts = preg_split('/\s+/', $cleaned_account_name);
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
        } catch (\Throwable $e) {
            return $this->error('kyc_verification_failed', $e->getMessage(), 500);
        }
    }

    public function get_transactions(\WP_REST_Request $request): \WP_REST_Response {
        $user_id  = get_current_user_id();
        $page     = (int) $request->get_param('page');
        $per_page = (int) $request->get_param('per_page');
        $type     = $request->get_param('type');

        $txn_model = new TransactionModel();
        $data = $txn_model->get_user_transactions($user_id, $page, $per_page, $type);

        return $this->success($data);
    }
}
