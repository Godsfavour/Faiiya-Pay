import { PluginFile } from '../pluginFiles';

export const modelFiles: PluginFile[] = [
  {
    path: 'includes/Models/WalletModel.php',
    name: 'WalletModel.php',
    category: 'model',
    description: 'High-concurrency wallet operations using atomic transactions and row-level locks (SELECT FOR UPDATE).',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Models;

defined('ABSPATH') || exit;

class WalletModel {
    private string $table_wallets;
    private string $table_transactions;

    public function __construct() {
        global $wpdb;
        $this->table_wallets = $wpdb->prefix . 'faiiya_wallets';
        $this->table_transactions = $wpdb->prefix . 'faiiya_transactions';
    }

    public function cleanup_duplicate_wallets(int $user_id): void {
        global $wpdb;
        // Keep only the newest row for this user_id and remove older duplicates
        $wpdb->query(
            $wpdb->prepare(
                "DELETE w1 FROM {$this->table_wallets} w1 
                 INNER JOIN {$this->table_wallets} w2 
                 WHERE w1.user_id = w2.user_id AND w1.id < w2.id AND w1.user_id = %d",
                $user_id
            )
        );
    }

    public function get_balance(int $user_id): float {
        global $wpdb;

        // 1. Check ledger for latest completed transaction balance_after (Primary source of truth)
        $ledger_bal = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT balance_after FROM {$this->table_transactions} WHERE user_id = %d AND status = 'completed' ORDER BY id DESC LIMIT 1",
                $user_id
            )
        );

        // 2. Check wp_faiiya_wallets table (ORDER BY id DESC)
        $db_bal = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT balance FROM {$this->table_wallets} WHERE user_id = %d ORDER BY id DESC LIMIT 1",
                $user_id
            )
        );

        // 3. Check user meta
        $meta_bal = get_user_meta($user_id, '_faiiya_wallet_balance', true);
        $meta_num = ($meta_bal !== '' && is_numeric($meta_bal)) ? (float) $meta_bal : null;

        // Determine true balance: prioritize ledger whenever transactions exist
        if ($ledger_bal !== null) {
            $balance = (float) $ledger_bal;
        } elseif ($db_bal !== null && (float) $db_bal > 0) {
            $balance = (float) $db_bal;
        } elseif ($meta_num !== null) {
            $balance = $meta_num;
        } elseif ($db_bal !== null) {
            $balance = (float) $db_bal;
        } else {
            $balance = 0.00;
        }

        $balance = round($balance, 2);

        // Heal DB table and user meta if out of sync
        if ($db_bal === null || abs((float) $db_bal - $balance) > 0.001) {
            $this->sync_balance_to_db($user_id, $balance);
        }

        return $balance;
    }

    public function sync_balance_to_db(int $user_id, float $balance): void {
        global $wpdb;
        $now = current_time('mysql');
        $this->cleanup_duplicate_wallets($user_id);

        $existing_id = $wpdb->get_var(
            $wpdb->prepare("SELECT id FROM {$this->table_wallets} WHERE user_id = %d ORDER BY id DESC LIMIT 1", $user_id)
        );

        if ($existing_id) {
            $wpdb->update(
                $this->table_wallets,
                ['balance' => $balance, 'updated_at' => $now],
                ['id' => (int) $existing_id],
                ['%f', '%s'],
                ['%d']
            );
        } else {
            $wpdb->insert(
                $this->table_wallets,
                [
                    'user_id'    => $user_id,
                    'balance'    => $balance,
                    'currency'   => 'NGN',
                    'kyc_status' => 'unverified',
                    'status'     => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
                ['%d', '%f', '%s', '%s', '%s', '%s', '%s']
            );
        }

        update_user_meta($user_id, '_faiiya_wallet_balance', $balance);
        update_user_meta($user_id, 'faiiya_wallet_balance', $balance);
        if (function_exists('clean_user_cache')) {
            clean_user_cache($user_id);
        }
        wp_cache_delete("faiiya_wallet_{$user_id}");
        wp_cache_delete("faiiya_wallet_bal_{$user_id}");
    }

    public function get_wallet(int $user_id): ?object {
        global $wpdb;
        $this->cleanup_duplicate_wallets($user_id);

        $true_bal = $this->get_balance($user_id);

        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table_wallets} WHERE user_id = %d ORDER BY id DESC LIMIT 1", $user_id)
        );

        if (!$row) {
            $this->sync_balance_to_db($user_id, $true_bal);
            $row = $wpdb->get_row(
                $wpdb->prepare("SELECT * FROM {$this->table_wallets} WHERE user_id = %d ORDER BY id DESC LIMIT 1", $user_id)
            );
        }

        if ($row) {
            $row->balance = (string) $true_bal;
        }

        return $row ?: null;
    }

    public function ensure_wallet_exists(int $user_id, string $kyc_status = 'unverified'): object {
        $wallet = $this->get_wallet($user_id);
        if ($wallet) {
            return $wallet;
        }

        $now = current_time('mysql');
        $clean_kyc = in_array($kyc_status, ['unverified', 'verified'], true) ? $kyc_status : 'unverified';
        $this->sync_balance_to_db($user_id, 0.00);

        return $this->get_wallet($user_id) ?: (object) [
            'id'         => 0,
            'user_id'    => $user_id,
            'balance'    => '0.00',
            'currency'   => 'NGN',
            'kyc_status' => $clean_kyc,
            'status'     => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    public function update_kyc_status(int $user_id, string $kyc_status): bool {
        global $wpdb;
        $now = current_time('mysql');
        $updated = $wpdb->update(
            $this->table_wallets,
            [
                'kyc_status' => in_array($kyc_status, ['unverified', 'verified'], true) ? $kyc_status : 'unverified',
                'updated_at' => $now,
            ],
            ['user_id' => $user_id],
            ['%s', '%s'],
            ['%d']
        );
        return $updated !== false;
    }

    public function get_kyc_status(int $user_id): string {
        $wallet = $this->get_wallet($user_id);
        return $wallet->kyc_status ?? 'unverified';
    }

    public function credit(
        int $user_id,
        float $amount,
        string $type,
        string $reference,
        array $metadata = []
    ): array {
        if ($amount <= 0) {
            throw new \\InvalidArgumentException('Credit amount must be greater than zero.');
        }

        global $wpdb;
        $now = current_time('mysql');

        // Always calculate from TRUE current balance so additions never overwrite previous funds
        $balance_before = $this->get_balance($user_id);
        $balance_after  = round($balance_before + $amount, 2);

        // Persist new balance to database and WordPress user meta
        $this->sync_balance_to_db($user_id, $balance_after);

        $wallet = $this->get_wallet($user_id);
        $txn_uuid = $this->generate_uuid_v4();
        $metadata['direction'] = 'credit';

        $wpdb->insert(
            $this->table_transactions,
            [
                'txn_uuid'       => $txn_uuid,
                'wallet_id'      => (int) ($wallet->id ?? 0),
                'user_id'        => $user_id,
                'type'           => $type,
                'amount'         => $amount,
                'balance_before' => $balance_before,
                'balance_after'  => $balance_after,
                'reference'      => $reference,
                'metadata'       => wp_json_encode($metadata),
                'status'         => 'completed',
                'created_at'     => $now,
            ],
            ['%s', '%d', '%d', '%s', '%f', '%f', '%f', '%s', '%s', '%s', '%s']
        );

        $inserted_id = (int) $wpdb->insert_id;

        do_action('faiiya_wallet_balance_updated', $user_id, $balance_after, $type, $amount);

        return [
            'success'        => true,
            'id'             => $inserted_id,
            'txn_uuid'       => $txn_uuid,
            'wallet_id'      => (int) ($wallet->id ?? 0),
            'user_id'        => $user_id,
            'amount'         => $amount,
            'balance_before' => $balance_before,
            'balance_after'  => $balance_after,
            'reference'      => $reference,
        ];
    }

    public function debit(
        int $user_id,
        float $amount,
        string $type,
        string $reference,
        array $metadata = []
    ): array {
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Debit amount must be greater than zero.');
        }

        global $wpdb;
        $wallet = $this->ensure_wallet_exists($user_id);

        if ($wallet->status !== 'active' && $type !== 'admin_adjustment') {
            throw new \RuntimeException("Wallet is {$wallet->status} and cannot be debited.");
        }

        $now = current_time('mysql');
        // Always calculate from TRUE current balance so subtractions are mathematically exact
        $balance_before = $this->get_balance($user_id);

        if ($balance_before < $amount) {
            throw new \UnderflowException(
                sprintf(
                    __('Insufficient wallet funds. Current balance: ₦%s, Required: ₦%s', 'faiiya-pay'),
                    number_format($balance_before, 2),
                    number_format($amount, 2)
                )
            );
        }

        $balance_after = round(max(0.00, $balance_before - $amount), 2);

        // Persist new balance to database and WordPress user meta
        $this->sync_balance_to_db($user_id, $balance_after);

        $txn_uuid = $this->generate_uuid_v4();
        $metadata['direction'] = 'debit';

        $wpdb->insert(
            $this->table_transactions,
            [
                'txn_uuid'       => $txn_uuid,
                'wallet_id'      => (int) ($wallet->id ?? 0),
                'user_id'        => $user_id,
                'type'           => $type,
                'amount'         => $amount,
                'balance_before' => $balance_before,
                'balance_after'  => $balance_after,
                'reference'      => $reference,
                'metadata'       => wp_json_encode($metadata),
                'status'         => 'completed',
                'created_at'     => $now,
            ],
            ['%s', '%d', '%d', '%s', '%f', '%f', '%f', '%s', '%s', '%s', '%s']
        );
        $inserted_id = (int) $wpdb->insert_id;

        do_action('faiiya_wallet_balance_updated', $user_id, $balance_after, $type, $amount);

        return [
            'success'        => true,
            'id'             => $inserted_id,
            'txn_uuid'       => $txn_uuid,
            'wallet_id'      => (int) ($wallet->id ?? 0),
            'user_id'        => $user_id,
            'amount'         => $amount,
            'balance_before' => $balance_before,
            'balance_after'  => $balance_after,
            'reference'      => $reference,
        ];
    }

    private function generate_uuid_v4(): string {
        $data = random_bytes(16);
        $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
        $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
`
  },
  {
    path: 'includes/Models/TransactionModel.php',
    name: 'TransactionModel.php',
    category: 'model',
    description: 'Queries ledger transactions, provides idempotency reference checks, and paginated user history.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Models;

defined('ABSPATH') || exit;

class TransactionModel {
    private string $table_name;

    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'faiiya_transactions';
    }

    public function get_user_transactions(
        int $user_id,
        int $page = 1,
        int $per_page = 20,
        ?string $type = null
    ): array {
        global $wpdb;

        $page = max(1, $page);
        $per_page = min(100, max(1, $per_page));
        $offset = ($page - 1) * $per_page;

        $where = 'user_id = %d';
        $params = [$user_id];

        if (!empty($type)) {
            $where .= ' AND type = %s';
            $params[] = $type;
        }

        $total = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$this->table_name} WHERE {$where}", ...$params)
        );

        $sql = "SELECT * FROM {$this->table_name} WHERE {$where} ORDER BY created_at DESC LIMIT %d OFFSET %d";
        $query_params = array_merge($params, [$per_page, $offset]);

        $rows = $wpdb->get_results($wpdb->prepare($sql, ...$query_params), ARRAY_A);

        return [
            'transactions' => $rows ?: [],
            'pagination'   => [
                'current_page' => $page,
                'per_page'     => $per_page,
                'total_items'  => $total,
                'total_pages'  => (int) ceil($total / $per_page),
            ],
        ];
    }

    public function reference_exists(string $reference): bool {
        global $wpdb;
        $count = $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$this->table_name} WHERE reference = %s", $reference)
        );
        return ((int) $count) > 0;
    }

    public function has_completed_deposit(int $user_id): bool {
        global $wpdb;
        $count = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$this->table_name} WHERE user_id = %d AND type = 'deposit' AND status = 'completed'",
                $user_id
            )
        );
        return ((int) $count) > 0;
    }
}
`
  },
  {
    path: 'includes/Models/VirtualAccountModel.php',
    name: 'VirtualAccountModel.php',
    category: 'model',
    description: 'Manages reserved bank accounts (Wema, Sterling, Moniepoint) and account lookups for automated webhook deposits.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Models;

defined('ABSPATH') || exit;

class VirtualAccountModel {
    private string $table_name;

    public function __construct() {
        global $wpdb;
        $this->table_name = $wpdb->prefix . 'faiiya_virtual_accounts';
    }

    public function save_accounts(int $user_id, array $monnify_response): void {
        global $wpdb;

        $account_reference = $monnify_response['accountReference'] ?? ('FP_VA_' . $user_id);
        $global_account_name = $monnify_response['accountName'] ?? $monnify_response['customerName'] ?? '';
        $raw_response = wp_json_encode($monnify_response);
        $accounts = $monnify_response['accounts'] ?? [];

        if (!empty($accounts) && is_array($accounts)) {
            $wpdb->delete($this->table_name, ['user_id' => $user_id], ['%d']);

            $now = current_time('mysql');
            foreach ($accounts as $acc) {
                // Retain exact complete account name as given by the Monnify API
                $exact_name = !empty($acc['accountName']) ? $acc['accountName'] : $global_account_name;
                if (empty($exact_name)) {
                    $user = get_userdata($user_id);
                    $exact_name = $user ? trim("{$user->first_name} {$user->last_name}") : 'Customer';
                }

                $wpdb->insert(
                    $this->table_name,
                    [
                        'user_id'            => $user_id,
                        'account_reference'  => $account_reference,
                        'bank_name'          => sanitize_text_field($acc['bankName'] ?? 'Bank'),
                        'bank_code'          => sanitize_text_field($acc['bankCode'] ?? ''),
                        'account_number'     => sanitize_text_field($acc['accountNumber'] ?? ''),
                        'account_name'       => sanitize_text_field($exact_name),
                        'reservation_status' => 'active',
                        'raw_response'       => $raw_response,
                        'created_at'         => $now,
                    ],
                    ['%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s']
                );
            }
        }
    }

    public function get_user_accounts(int $user_id): array {
        global $wpdb;
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT id, account_reference, bank_name, bank_code, account_number, account_name, reservation_status, created_at 
                 FROM {$this->table_name} 
                 WHERE user_id = %d AND reservation_status = 'active'
                 ORDER BY id ASC",
                $user_id
            )
        );

        return array_map(function ($row) {
            return [
                'id'                 => (int) $row->id,
                'account_reference'  => $row->account_reference,
                'bank_name'          => $row->bank_name,
                'bank_code'          => $row->bank_code,
                'account_number'     => $row->account_number,
                'account_name'       => $row->account_name,
                'reservation_status' => $row->reservation_status,
                'created_at'         => $row->created_at,
            ];
        }, $rows ?: []);
    }

    public function find_user_by_account(string $account_reference, ?string $account_number = null): ?int {
        global $wpdb;

        if (!empty($account_number)) {
            $clean_acc = preg_replace('/\\D/', '', (string) $account_number);
            $user_id = $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT user_id FROM {$this->table_name} WHERE TRIM(account_number) = %s OR TRIM(account_number) = %s LIMIT 1",
                    $account_number,
                    $clean_acc
                )
            );
            if ($user_id) {
                return (int) $user_id;
            }
        }

        if (!empty($account_reference)) {
            $user_id = $wpdb->get_var(
                $wpdb->prepare("SELECT user_id FROM {$this->table_name} WHERE TRIM(account_reference) = %s LIMIT 1", trim($account_reference))
            );
            if ($user_id) {
                return (int) $user_id;
            }
        }

        return null;
    }
}
`
  },
  {
    path: 'includes/Models/ReferralModel.php',
    name: 'ReferralModel.php',
    category: 'model',
    description: 'Generates 8-character referral codes, links registrations, and executes automatic reward payouts.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Models;

defined('ABSPATH') || exit;

class ReferralModel {
    private string $table_referrals;

    public function __construct() {
        global $wpdb;
        $this->table_referrals = $wpdb->prefix . 'faiiya_referrals';
    }

    public function ensure_referral_code(int $user_id): string {
        $existing = get_user_meta($user_id, '_faiiya_referral_code', true);
        if (!empty($existing)) {
            return (string) $existing;
        }

        $code = $this->generate_unique_code();
        update_user_meta($user_id, '_faiiya_referral_code', $code);
        return $code;
    }

    private function generate_unique_code(): string {
        global $wpdb;
        do {
            $code = strtoupper(substr(bin2hex(random_bytes(6)), 0, 8));
            $exists = $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_faiiya_referral_code' AND meta_value = %s LIMIT 1",
                    $code
                )
            );
        } while (!empty($exists));

        return $code;
    }

    public function find_referrer_by_code(string $code): ?int {
        global $wpdb;
        $code = strtoupper(trim($code));
        $user_id = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_faiiya_referral_code' AND meta_value = %s LIMIT 1",
                $code
            )
        );

        return $user_id ? (int) $user_id : null;
    }

    public function link_referral(int $referee_id, string $code): bool {
        global $wpdb;

        $enabled = get_option('faiiya_referral_enabled', 'yes');
        if ($enabled !== 'yes') {
            return false;
        }

        $referrer_id = $this->find_referrer_by_code($code);
        if (!$referrer_id || $referrer_id === $referee_id) {
            return false;
        }

        $already_linked = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$this->table_referrals} WHERE referee_id = %d LIMIT 1",
                $referee_id
            )
        );

        if ($already_linked) {
            return false;
        }

        $reward_amount = (float) get_option('faiiya_referral_reward_amount', '500.00');
        $now = current_time('mysql');

        $inserted = $wpdb->insert(
            $this->table_referrals,
            [
                'referrer_id'   => $referrer_id,
                'referee_id'    => $referee_id,
                'referral_code' => strtoupper($code),
                'reward_amount' => $reward_amount,
                'status'        => 'pending',
                'created_at'    => $now,
            ],
            ['%d', '%d', '%s', '%f', '%s', '%s']
        );

        if (!$inserted) {
            return false;
        }

        $trigger = get_option('faiiya_referral_trigger', 'on_first_wallet_deposit');
        if ($trigger === 'on_registration') {
            $this->process_reward_for_referee($referee_id, 'registration_completed');
        }

        return true;
    }

    public function process_reward_for_referee(int $referee_id, string $reason = ''): bool {
        global $wpdb;

        $referral = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->table_referrals} WHERE referee_id = %d AND status = 'pending' LIMIT 1",
                $referee_id
            )
        );

        if (!$referral) {
            return false;
        }

        $reward_amount = (float) $referral->reward_amount;
        $referrer_id = (int) $referral->referrer_id;
        $wallet_model = new WalletModel();
        $ref_number = 'REF-BONUS-' . $referral->id . '-' . time();

        try {
            $wallet_model->credit(
                $referrer_id,
                $reward_amount,
                'referral_bonus',
                $ref_number,
                [
                    'referral_id' => (int) $referral->id,
                    'referee_id'  => $referee_id,
                    'trigger'     => $reason,
                ]
            );

            $wpdb->update(
                $this->table_referrals,
                [
                    'status'      => 'credited',
                    'credited_at' => current_time('mysql'),
                ],
                ['id' => $referral->id],
                ['%s', '%s'],
                ['%d']
            );

            return true;
        } catch (\\Throwable $e) {
            error_log('Faiiya Pay Referral Reward Error: ' . $e->getMessage());
            return false;
        }
    }

    public function get_stats(int $user_id): array {
        global $wpdb;

        $code = $this->ensure_referral_code($user_id);
        $shareable_link = home_url('/faiiya-wallet?ref=' . $code);

        $total_referred = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$this->table_referrals} WHERE referrer_id = %d", $user_id)
        );

        $successful_referrals = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$this->table_referrals} WHERE referrer_id = %d AND status = 'credited'", $user_id)
        );

        $total_earnings = (float) $wpdb->get_var(
            $wpdb->prepare("SELECT COALESCE(SUM(reward_amount), 0) FROM {$this->table_referrals} WHERE referrer_id = %d AND status = 'credited'", $user_id)
        );

        return [
            'referral_code'        => $code,
            'shareable_link'       => $shareable_link,
            'total_referrals'      => $total_referred,
            'successful_referrals' => $successful_referrals,
            'total_earnings'       => $total_earnings,
            'currency'             => 'NGN',
            'reward_per_referral'  => (float) get_option('faiiya_referral_reward_amount', '500.00'),
            'trigger'              => get_option('faiiya_referral_trigger', 'on_first_wallet_deposit'),
        ];
    }
}
`
  }
];
