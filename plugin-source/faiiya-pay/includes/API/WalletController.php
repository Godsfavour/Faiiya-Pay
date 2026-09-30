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
    }

    public function get_balance(\WP_REST_Request $request): \WP_REST_Response {
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

            // 2. Name Compliance Replacement: Replace WordPress first_name, other_names, and last_name with verified identity
            $verified_account_name = $monnify_resp['accountName'] ?? $monnify_resp['customerName'] ?? '';
            $synced_name = '';

            if (!empty($verified_account_name)) {
                $clean_name = trim((string) preg_replace('/^FAIIYA\s*\/\s*/i', '', $verified_account_name));
                $name_parts = preg_split('/\s+/', $clean_name);
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
