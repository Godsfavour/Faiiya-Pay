import { PluginFile } from '../pluginFiles';

export const serviceFiles: PluginFile[] = [
  {
    path: 'includes/Services/EncryptionService.php',
    name: 'EncryptionService.php',
    category: 'service',
    description: 'AES-256-CBC encryption and decryption with HMAC SHA-256 verification for BVN and NIN.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Services;

defined('ABSPATH') || exit;

class EncryptionService {
    private const CIPHER = 'AES-256-CBC';

    private static function get_key(): string {
        $salt = defined('SECURE_AUTH_KEY') ? SECURE_AUTH_KEY : 'faiiya_pay_fallback_secure_salt_key_32b';
        return hash('sha256', $salt, true);
    }

    public static function encrypt(string $plain_text): string {
        if (empty($plain_text)) {
            return '';
        }

        $key = self::get_key();
        $iv_length = openssl_cipher_iv_length(self::CIPHER);
        $iv = openssl_random_pseudo_bytes($iv_length);

        $ciphertext = openssl_encrypt($plain_text, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($ciphertext === false) {
            throw new \\RuntimeException('Encryption failed.');
        }

        $hmac = hash_hmac('sha256', $iv . $ciphertext, $key, true);
        return base64_encode($iv . $hmac . $ciphertext);
    }

    public static function decrypt(string $payload): ?string {
        if (empty($payload)) {
            return null;
        }

        $raw = base64_decode($payload, true);
        if ($raw === false) {
            return null;
        }

        $key = self::get_key();
        $iv_length = openssl_cipher_iv_length(self::CIPHER);
        $hmac_length = 32;

        if (strlen($raw) < ($iv_length + $hmac_length)) {
            return null;
        }

        $iv = substr($raw, 0, $iv_length);
        $hmac = substr($raw, $iv_length, $hmac_length);
        $ciphertext = substr($raw, $iv_length + $hmac_length);

        $expected_hmac = hash_hmac('sha256', $iv . $ciphertext, $key, true);
        if (!hash_equals($hmac, $expected_hmac)) {
            return null;
        }

        $decrypted = openssl_decrypt($ciphertext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        return $decrypted !== false ? $decrypted : null;
    }

    public static function mask(string $plain_text): string {
        $len = strlen($plain_text);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }
        return str_repeat('*', $len - 4) . substr($plain_text, -4);
    }
}
`
  },
  {
    path: 'includes/Services/MonnifyService.php',
    name: 'MonnifyService.php',
    category: 'service',
    description: 'Monnify API client, OAuth token management, reserved accounts provisioning, and SHA-512 signature check.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Services;

defined('ABSPATH') || exit;

class MonnifyService {
    private string $api_key;
    private string $secret_key;
    private string $contract_code;
    private string $wallet_account_number;
    private string $base_url;

    public function __construct() {
        $mode = get_option('faiiya_monnify_mode', 'sandbox');
        $this->base_url = ($mode === 'live') ? 'https://api.monnify.com' : 'https://sandbox.monnify.com';
        $this->api_key = (string) get_option('faiiya_monnify_api_key', '');
        $this->secret_key = (string) get_option('faiiya_monnify_secret_key', '');
        $this->contract_code = (string) get_option('faiiya_monnify_contract_code', '');
        $this->wallet_account_number = (string) get_option('faiiya_monnify_wallet_account_number', '');
    }

    public function get_access_token(): string {
        $cached_token = get_transient('faiiya_monnify_access_token');
        if (!empty($cached_token)) {
            return (string) $cached_token;
        }

        if (empty($this->api_key) || empty($this->secret_key)) {
            throw new \\RuntimeException(__('Monnify API credentials are not configured.', 'faiiya-pay'));
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
            throw new \\RuntimeException('Monnify Auth Error: ' . $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200 || empty($body['responseBody']['accessToken'])) {
            $msg = $body['responseMessage'] ?? 'Failed to authenticate with Monnify';
            throw new \\RuntimeException('Monnify Auth Failed [' . $code . ']: ' . $msg);
        }

        $token = $body['responseBody']['accessToken'];
        $expires_in = (int) ($body['responseBody']['expiresIn'] ?? 3500);

        set_transient('faiiya_monnify_access_token', $token, max(300, $expires_in - 120));
        return $token;
    }

    public function create_reserved_account(array $params): array {
        $token = $this->get_access_token();

        $account_reference = $params['account_reference'] ?? ('FP_VA_' . $params['user_id'] . '_' . time());
        $site_name = get_bloginfo('name') ?: 'Faiiya';
        $customer_name = sanitize_text_field($params['customer_name'] ?? 'Faiiya Customer');
        
        // Pass Customer Name - Brand Name so bank switches display Customer Name prominently
        $desired_account_name = $customer_name . ' - ' . $site_name;

        $payload = [
            'accountReference'      => $account_reference,
            'accountName'           => $desired_account_name,
            'currencyCode'          => 'NGN',
            'contractCode'          => $this->contract_code,
            'customerEmail'         => sanitize_email($params['customer_email']),
            'customerName'          => $customer_name,
            'getAllAvailableBanks'  => true,
        ];

        if (!empty($params['bvn'])) {
            $payload['customerBVN'] = sanitize_text_field($params['bvn']);
        }

        if (!empty($params['nin'])) {
            $payload['nin'] = sanitize_text_field($params['nin']);
        }

        // Cache reference on user for quick lookup
        if (!empty($params['user_id'])) {
            update_user_meta((int) $params['user_id'], '_faiiya_account_reference', $account_reference);
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
            throw new \\RuntimeException('Reserved Account Request Error: ' . $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200 && $code !== 201) {
            $msg = $body['responseMessage'] ?? 'Failed to reserve virtual account with Monnify.';
            throw new \\RuntimeException('Monnify Reserved Account Failed: ' . $msg);
        }

        return $body['responseBody'] ?? $body;
    }

    /**
     * Monnify Initialize Transaction API:
     * Endpoint: POST /api/v1/merchant/transactions/init-transaction
     * Used for WooCommerce Direct Checkout (Cards, Bank Transfer, USSD).
     */
    public function initialize_transaction(array $params): array {
        if (!$this->is_configured()) {
            throw new \\RuntimeException(__('Monnify API credentials are not configured in WordPress Admin.', 'faiiya-pay'));
        }

        $token = $this->get_access_token();

        $payload = [
            'amount'             => (float) $params['amount'],
            'customerName'       => sanitize_text_field($params['customer_name'] ?? 'Customer'),
            'customerEmail'      => sanitize_email($params['customer_email']),
            'paymentReference'   => sanitize_text_field($params['payment_reference']),
            'paymentDescription' => sanitize_text_field($params['payment_description'] ?? 'Store Order Payment'),
            'currencyCode'       => sanitize_text_field($params['currency_code'] ?? 'NGN'),
            'contractCode'       => $this->contract_code,
            'redirectUrl'        => esc_url_raw($params['redirect_url']),
            'paymentMethods'     => ['CARD', 'ACCOUNT_TRANSFER', 'USSD', 'PHONE_NUMBER'],
        ];

        $response = wp_remote_post($this->base_url . '/api/v1/merchant/transactions/init-transaction', [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Content-Type'  => 'application/json',
            ],
            'body'    => wp_json_encode($payload),
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            throw new \\RuntimeException('Monnify Connection Error: ' . $response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code !== 200 || empty($body['responseBody']['checkoutUrl'])) {
            $msg = $body['responseMessage'] ?? 'Failed to initialize Monnify transaction.';
            throw new \\RuntimeException('Monnify Checkout Error: ' . $msg);
        }

        return $body['responseBody'];
    }

    public function get_reserved_account(string $account_reference): ?array {
        if (!$this->is_configured() || empty($account_reference)) {
            return null;
        }

        try {
            $token = $this->get_access_token();
            $response = wp_remote_get($this->base_url . '/api/v2/bank-transfer/reserved-accounts/' . urlencode($account_reference), [
                'headers' => [
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ],
                'timeout' => 20,
            ]);

            if (is_wp_error($response)) {
                return null;
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (($code === 200 || $code === 201) && !empty($body['responseBody'])) {
                return $body['responseBody'];
            }
        } catch (\\Throwable $e) {
            // Suppress network or transient exception
        }

        return null;
    }

    /**
     * Fetch recent transactions associated with a reserved account.
     * Monnify API: GET /api/v1/bank-transfer/reserved-accounts/transactions?accountReference=...
     */
    public function get_reserved_account_transactions(string $account_reference, int $page = 0, int $size = 10): ?array {
        if (!$this->is_configured() || empty($account_reference)) {
            return null;
        }

        try {
            $token = $this->get_access_token();
            $url = $this->base_url . '/api/v1/bank-transfer/reserved-accounts/transactions?accountReference=' . urlencode($account_reference) . '&page=' . $page . '&size=' . $size;
            $response = wp_remote_get($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ],
                'timeout' => 20,
            ]);

            if (is_wp_error($response)) {
                return null;
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (($code === 200 || $code === 201) && !empty($body['responseBody'])) {
                return $body['responseBody']['content'] ?? $body['responseBody'];
            }
        } catch (\\Throwable $e) {
            // Suppress network exception
        }

        return null;
    }

    /**
     * Query single transaction status from Monnify.
     * Monnify API: GET /api/v2/merchant/transactions/query?transactionReference=...
     */
    public function query_transaction(string $transaction_ref): ?array {
        if (!$this->is_configured() || empty($transaction_ref)) {
            return null;
        }

        try {
            $token = $this->get_access_token();
            $url = $this->base_url . '/api/v2/merchant/transactions/query?transactionReference=' . urlencode($transaction_ref);
            $response = wp_remote_get($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ],
                'timeout' => 20,
            ]);

            if (is_wp_error($response)) {
                return null;
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (($code === 200 || $code === 201) && !empty($body['responseBody'])) {
                return $body['responseBody'];
            }
        } catch (\\Throwable $e) {
            // Suppress network exception
        }

        return null;
    }

    /**
     * Monnify Digital Wallet Statement API
     * Reference: https://developers.monnify.com/docs/wallets/wallet-statement
     * Endpoint: GET /api/v1/disbursements/wallet/{accountNumber}/statement
     */
    public function get_wallet_statement(int $page_no = 0, int $page_size = 20): ?array {
        if (!$this->is_configured() || empty($this->wallet_account_number)) {
            return null;
        }

        try {
            $token = $this->get_access_token();
            $url = $this->base_url . '/api/v1/disbursements/wallet/' . urlencode($this->wallet_account_number) . '/statement?pageNo=' . $page_no . '&pageSize=' . $page_size;
            $response = wp_remote_get($url, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $token,
                    'Content-Type'  => 'application/json',
                ],
                'timeout' => 20,
            ]);

            if (is_wp_error($response)) {
                return null;
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (($code === 200 || $code === 201) && !empty($body['responseBody'])) {
                return $body['responseBody'];
            }
        } catch (\\Throwable $e) {
            // Suppress network exception
        }

        return null;
    }

    /**
     * Verify Monnify webhook signature via HMAC-SHA512 header or body transactionHash.
     */
    public function verify_webhook_signature(string $raw_body, ?string $header_signature = null, ?array $event_data = null): bool {
        if (empty($this->secret_key)) {
            return false;
        }

        // 1. Check HTTP header signature (HMAC-SHA512)
        if (!empty($header_signature) && !empty($raw_body)) {
            $clean_sig = strtolower(trim($header_signature));
            $computed_hmac = hash_hmac('sha512', $raw_body, $this->secret_key);
            if (hash_equals(strtolower($computed_hmac), $clean_sig)) {
                return true;
            }

            $computed_concat = hash('sha512', $this->secret_key . $raw_body);
            if (hash_equals(strtolower($computed_concat), $clean_sig)) {
                return true;
            }
        }

        // 2. Check transactionHash embedded in eventData (Official Monnify formula)
        if (!empty($event_data) && !empty($event_data['transactionHash'])) {
            if ($this->verify_transaction_hash($event_data)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Monnify Transaction Hash Verification Formula:
     * SHA-512({clientSecret}|{paymentReference}|{amountPaid}|{paidOn}|{transactionReference})
     */
    public function verify_transaction_hash(array $event_data): bool {
        if (empty($this->secret_key) || empty($event_data['transactionHash'])) {
            return false;
        }

        $payment_ref = (string) ($event_data['paymentReference'] ?? '');
        $amount_paid = (string) ($event_data['amountPaid'] ?? $event_data['amount'] ?? '');
        $paid_on     = (string) ($event_data['paidOn'] ?? '');
        $txn_ref     = (string) ($event_data['transactionReference'] ?? '');
        $incoming    = strtolower(trim((string) $event_data['transactionHash']));

        // Try exact amount format as sent by Monnify
        $raw_strings = [
            $this->secret_key . '|' . $payment_ref . '|' . $amount_paid . '|' . $paid_on . '|' . $txn_ref,
            $this->secret_key . '|' . $payment_ref . '|' . number_format((float) $amount_paid, 2, '.', '') . '|' . $paid_on . '|' . $txn_ref,
        ];

        foreach ($raw_strings as $str) {
            $calc = hash('sha512', $str);
            if (hash_equals(strtolower($calc), $incoming)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Test connection to Monnify API.
     */
    public function test_connection(): array {
        if (!$this->is_configured()) {
            return [
                'success' => false,
                'message' => __('Monnify API Key, Secret Key, or Contract Code is missing.', 'faiiya-pay'),
            ];
        }

        try {
            $token = $this->get_access_token();
            $mode = get_option('faiiya_monnify_mode', 'sandbox');

            return [
                'success'       => true,
                'mode'          => $mode,
                'contract_code' => $this->contract_code,
                'token_sample'  => substr($token, 0, 12) . '...',
                'message'       => sprintf(__('Authentication successful! Connected to Monnify (%s environment).', 'faiiya-pay'), strtoupper($mode)),
            ];
        } catch (\\Throwable $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        }
    }

    /**
     * Synchronize and credit any missing completed deposits for a user's dedicated virtual accounts.
     */
    public function sync_customer_reserved_transactions(int $user_id): array {
        try {
            if (!$this->is_configured()) {
                return [
                    'success' => false,
                    'message' => __('Monnify API credentials are not configured in WordPress Admin Settings.', 'faiiya-pay'),
                    'synced'  => 0,
                ];
            }

            global $wpdb;
            $va_model = new \\FaiiyaPay\\Models\\VirtualAccountModel();
            $accounts = $va_model->get_user_accounts($user_id);

            // Self-healing: if accounts are empty in DB, check if user has account_reference or try to query Monnify
            if (empty($accounts)) {
                $account_ref = get_user_meta($user_id, '_faiiya_account_reference', true) ?: ('FP_VA_' . $user_id);
                $remote_va = $this->get_reserved_account((string) $account_ref);
                if (!empty($remote_va) && !empty($remote_va['accounts'])) {
                    $va_model->save_accounts($user_id, $remote_va);
                    $accounts = $va_model->get_user_accounts($user_id);
                }
            }

            if (empty($accounts)) {
                return [
                    'success' => false,
                    'message' => sprintf(__('User #%d has no dedicated virtual accounts registered yet. The user must complete KYC verification with their NIN first.', 'faiiya-pay'), $user_id),
                    'synced'  => 0,
                ];
            }

            $credited = [];
            $wallet_model = new \\FaiiyaPay\\Models\\WalletModel();
            $txn_model = new \\FaiiyaPay\\Models\\TransactionModel();

            // Also ensure wallet kyc_status is updated to verified if accounts exist
            $wallet_model->update_kyc_status($user_id, 'verified');
            update_user_meta($user_id, 'faiiya_kyc_status', 'verified');

            $checked_refs = [];
            foreach ($accounts as $acc) {
                $ref = $acc['account_reference'] ?? '';
                if (empty($ref) || in_array($ref, $checked_refs, true)) continue;
                $checked_refs[] = $ref;

                $resp = $this->get_reserved_account_transactions($ref, 0, 50);
                if (empty($resp)) continue;

                $tx_list = [];
                if (isset($resp['content']) && is_array($resp['content'])) {
                    $tx_list = $resp['content'];
                } elseif (isset($resp['responseBody']['content']) && is_array($resp['responseBody']['content'])) {
                    $tx_list = $resp['responseBody']['content'];
                } elseif (is_array($resp) && !empty($resp)) {
                    $tx_list = isset($resp[0]) ? $resp : [$resp];
                }

                foreach ($tx_list as $tx) {
                    if (!is_array($tx)) continue;
                    $status = strtoupper((string) ($tx['paymentStatus'] ?? $tx['status'] ?? ''));
                    if ($status === 'PAID' || $status === 'COMPLETED' || $status === 'SUCCESSFUL') {
                        $txn_ref = (string) ($tx['transactionReference'] ?? $tx['paymentReference'] ?? '');
                        $amount = (float) ($tx['amountPaid'] ?? $tx['amount'] ?? 0.00);

                        if (!empty($txn_ref) && $amount > 0 && !$txn_model->reference_exists($txn_ref)) {
                            $is_first = !$txn_model->has_completed_deposit($user_id);
                            $dest_bank = $tx['destinationAccountInformation']['bankName'] ?? $tx['bankName'] ?? ($acc['bank_name'] ?? 'Virtual Account');
                            $dest_acc  = $tx['destinationAccountInformation']['accountNumber'] ?? $tx['accountNumber'] ?? ($acc['account_number'] ?? '');
                            $payer_name = $tx['payerDetails']['payerName'] ?? ($tx['customerName'] ?? 'Bank Inflow');

                            $res = $wallet_model->credit(
                                $user_id,
                                $amount,
                                'deposit',
                                $txn_ref,
                                [
                                    'source'              => 'monnify_api_sync',
                                    'destination_bank'    => $dest_bank,
                                    'destination_account' => $dest_acc,
                                    'payer_name'          => $payer_name,
                                    'paid_on'             => $tx['paidOn'] ?? current_time('mysql'),
                                ]
                            );

                            if ($is_first) {
                                $ref_model = new \\FaiiyaPay\\Models\\ReferralModel();
                                $ref_model->process_reward_for_referee($user_id, 'first_wallet_deposit');
                            }

                            $credited[] = [
                                'reference'     => $txn_ref,
                                'amount'        => $amount,
                                'balance_after' => $res['balance_after'],
                                'bank'          => $dest_bank,
                                'txn_id'        => (int) ($res['id'] ?? 0),
                            ];
                        }
                    }
                }
            }

            return [
                'success'  => true,
                'synced'   => count($credited),
                'credited' => $credited,
                'message'  => count($credited) > 0 
                    ? sprintf(__('Successfully synchronized and credited %d new deposit(s) totaling ₦%s from Monnify!', 'faiiya-pay'), count($credited), number_format(array_sum(array_column($credited, 'amount')), 2))
                    : __('All Monnify transactions are already synchronized. No pending deposits found.', 'faiiya-pay'),
            ];
        } catch (\\Throwable $e) {
            return [
                'success' => false,
                'message' => __('Monnify Sync Error: ', 'faiiya-pay') . $e->getMessage(),
                'synced'  => 0,
            ];
        }
    }

    public function is_configured(): bool {
        return !empty($this->api_key) && !empty($this->secret_key) && !empty($this->contract_code);
    }
}
`
  }
];
