<?php
declare(strict_types=1);

namespace FaiiyaPay\API;

use FaiiyaPay\Models\WalletModel;
use FaiiyaPay\Models\ReferralModel;

defined('ABSPATH') || exit;

class AuthController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/auth/register', [
            'methods'             => \WP_REST_Server::CREATABLE,
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

    public function register(\WP_REST_Request $request): \WP_REST_Response|\WP_Error {
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

        $user_obj = new \WP_User($user_id);
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
