<?php
declare(strict_types=1);

namespace FaiiyaPay\Services;

defined('ABSPATH') || exit;

class MonnifyService {
    private string $api_key;
    private string $secret_key;
    private string $contract_code;
    private string $base_url;

    public function __construct() {
        $mode = get_option('faiiya_monnify_mode', 'sandbox');
        $this->base_url = ($mode === 'live') ? 'https://api.monnify.com' : 'https://sandbox.monnify.com';
        $this->api_key = (string) get_option('faiiya_monnify_api_key', '');
        $this->secret_key = (string) get_option('faiiya_monnify_secret_key', '');
        $this->contract_code = (string) get_option('faiiya_monnify_contract_code', '');
    }

    public function get_access_token(): string {
        $cached_token = get_transient('faiiya_monnify_access_token');
        if (!empty($cached_token)) {
            return (string) $cached_token;
        }

        if (empty($this->api_key) || empty($this->secret_key)) {
            throw new \RuntimeException(__('Monnify API credentials are not configured.', 'faiiya-pay'));
        }

        $credentials = base64_encode($this->api_key . ':' . $this->secret_key);
        $response = wp_remote_post($this->base_url . '/api/v1/auth/login', [
            'headers' => [
                'Authorization' => 'Basic ' . $credentials,
                'Content-Type'  => 'application/json',
            ],
            'timeout' => 25,
        ]);

        if (is_wp_error($response)) {
            throw new \RuntimeException('Monnify Auth Error: ' . $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200 || empty($body['responseBody']['accessToken'])) {
            $msg = $body['responseMessage'] ?? 'Failed to authenticate with Monnify';
            throw new \RuntimeException('Monnify Auth Failed [' . $code . ']: ' . $msg);
        }

        $token = $body['responseBody']['accessToken'];
        $expires_in = (int) ($body['responseBody']['expiresIn'] ?? 3500);

        set_transient('faiiya_monnify_access_token', $token, max(300, $expires_in - 120));
        return $token;
    }

    public function create_reserved_account(array $params): array {
        $token = $this->get_access_token();

        $account_reference = $params['account_reference'] ?? ('FP_VA_' . $params['user_id'] . '_' . time());
        $payload = [
            'accountReference'      => $account_reference,
            'accountName'           => sanitize_text_field($params['customer_name'] ?? 'Faiiya Customer'),
            'currencyCode'          => 'NGN',
            'contractCode'          => $this->contract_code,
            'customerEmail'         => sanitize_email($params['customer_email']),
            'customerName'          => sanitize_text_field($params['customer_name']),
            'customerBVN'           => sanitize_text_field($params['bvn'] ?? ''),
            'getAllAvailableBanks'  => true,
        ];

        if (!empty($params['nin'])) {
            $payload['nin'] = sanitize_text_field($params['nin']);
        }

        $response = wp_remote_post($this->base_url . '/api/v2/bank-transfer/reserved-accounts', [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type'  => 'application/json',
            ],
            'body'    => wp_json_encode($payload),
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            throw new \RuntimeException('Reserved Account Request Error: ' . $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200 && $code !== 201) {
            $msg = $body['responseMessage'] ?? 'Failed to reserve virtual account with Monnify.';
            throw new \RuntimeException('Monnify Reserved Account Failed: ' . $msg);
        }

        return $body['responseBody'] ?? $body;
    }

    public function verify_webhook_signature(string $raw_body, ?string $header_signature = null): bool {
        if (empty($this->secret_key) || empty($raw_body) || empty($header_signature)) {
            return false;
        }

        $clean_sig = strtolower(trim($header_signature));

        // Standard Monnify SHA-512 HMAC: hash_hmac('sha512', $raw_body, $secret_key)
        $computed_hmac = hash_hmac('sha512', $raw_body, $this->secret_key);
        if (hash_equals(strtolower($computed_hmac), $clean_sig)) {
            return true;
        }

        // Monnify concatenated SHA-512: hash('sha512', $secret_key . $raw_body)
        $computed_concat = hash('sha512', $this->secret_key . $raw_body);
        if (hash_equals(strtolower($computed_concat), $clean_sig)) {
            return true;
        }

        return false;
    }

    public function is_configured(): bool {
        return !empty($this->api_key) && !empty($this->secret_key) && !empty($this->contract_code);
    }
}
