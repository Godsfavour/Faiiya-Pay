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

    public function get_wallet(int $user_id): ?object {
        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$this->table_wallets} WHERE user_id = %d LIMIT 1", $user_id)
        );
        return $row ?: null;
    }

    public function ensure_wallet_exists(int $user_id, string $kyc_status = 'unverified'): object {
        $wallet = $this->get_wallet($user_id);
        if ($wallet) {
            return $wallet;
        }

        global $wpdb;
        $now = current_time('mysql');
        $wpdb->insert(
            $this->table_wallets,
            [
                'user_id'    => $user_id,
                'balance'    => 0.00,
                'currency'   => 'NGN',
                'kyc_status' => in_array($kyc_status, ['unverified', 'verified'], true) ? $kyc_status : 'unverified',
                'status'     => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            ['%d', '%f', '%s', '%s', '%s', '%s', '%s']
        );

        return (object) [
            'id'         => (int) $wpdb->insert_id,
            'user_id'    => $user_id,
            'balance'    => '0.00',
            'currency'   => 'NGN',
            'kyc_status' => $kyc_status,
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
        $this->ensure_wallet_exists($user_id);

        $wpdb->query('START TRANSACTION');

        try {
            $wallet = $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT * FROM {$this->table_wallets} WHERE user_id = %d FOR UPDATE",
                    $user_id
                )
            );

            if (!$wallet) {
                throw new \\RuntimeException('Wallet not found for locked update.');
            }

            if ($wallet->status !== 'active') {
                throw new \\RuntimeException("Wallet is {$wallet->status} and cannot receive funds.");
            }

            $balance_before = (float) $wallet->balance;
            $balance_after  = round($balance_before + $amount, 2);
            $now = current_time('mysql');

            $updated = $wpdb->update(
                $this->table_wallets,
                [
                    'balance'    => $balance_after,
                    'updated_at' => $now,
                ],
                ['id' => $wallet->id],
                ['%f', '%s'],
                ['%d']
            );

            if ($updated === false) {
                throw new \\RuntimeException('Failed to update wallet balance.');
            }

            $txn_uuid = $this->generate_uuid_v4();

            $wpdb->insert(
                $this->table_transactions,
                [
                    'txn_uuid'       => $txn_uuid,
                    'wallet_id'      => $wallet->id,
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

            $wpdb->query('COMMIT');

            return [
                'success'        => true,
                'txn_uuid'       => $txn_uuid,
                'wallet_id'      => (int) $wallet->id,
                'user_id'        => $user_id,
                'amount'         => $amount,
                'balance_before' => $balance_before,
                'balance_after'  => $balance_after,
                'reference'      => $reference,
            ];
        } catch (\\Throwable $e) {
            $wpdb->query('ROLLBACK');
            throw $e;
        }
    }

    public function debit(
        int $user_id,
        float $amount,
        string $type,
        string $reference,
        array $metadata = []
    ): array {
        if ($amount <= 0) {
            throw new \\InvalidArgumentException('Debit amount must be greater than zero.');
        }

        global $wpdb;
        $this->ensure_wallet_exists($user_id);

        $wpdb->query('START TRANSACTION');

        try {
            $wallet = $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT * FROM {$this->table_wallets} WHERE user_id = %d FOR UPDATE",
                    $user_id
                )
            );

            if (!$wallet) {
                throw new \\RuntimeException('Wallet record could not be locked.');
            }

            if ($wallet->status !== 'active') {
                throw new \\RuntimeException("Wallet is {$wallet->status} and cannot be debited.");
            }

            $balance_before = (float) $wallet->balance;

            if ($balance_before < $amount) {
                throw new \\UnderflowException(
                    sprintf(
                        __('Insufficient wallet funds. Current balance: ₦%s, Required: ₦%s', 'faiiya-pay'),
                        number_format($balance_before, 2),
                        number_format($amount, 2)
                    )
                );
            }

            $balance_after = round($balance_before - $amount, 2);
            $now = current_time('mysql');

            $updated = $wpdb->update(
                $this->table_wallets,
                [
                    'balance'    => $balance_after,
                    'updated_at' => $now,
                ],
                ['id' => $wallet->id],
                ['%f', '%s'],
                ['%d']
            );

            if ($updated === false) {
                throw new \\RuntimeException('Failed to update wallet balance during debit.');
            }

            $txn_uuid = $this->generate_uuid_v4();

            $wpdb->insert(
                $this->table_transactions,
                [
                    'txn_uuid'       => $txn_uuid,
                    'wallet_id'      => $wallet->id,
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

            $wpdb->query('COMMIT');

            return [
                'success'        => true,
                'txn_uuid'       => $txn_uuid,
                'wallet_id'      => (int) $wallet->id,
                'user_id'        => $user_id,
                'amount'         => $amount,
                'balance_before' => $balance_before,
                'balance_after'  => $balance_after,
                'reference'      => $reference,
            ];
        } catch (\\Throwable $e) {
            $wpdb->query('ROLLBACK');
            throw $e;
        }
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
        $account_name = $monnify_response['accountName'] ?? '';
        $raw_response = wp_json_encode($monnify_response);
        $accounts = $monnify_response['accounts'] ?? [];

        $user = get_userdata($user_id);
        $display_acc_name = ($user && !empty($user->first_name)) ? $user->first_name : $account_name;

        if (!empty($accounts) && is_array($accounts)) {
            $wpdb->delete($this->table_name, ['user_id' => $user_id], ['%d']);

            $now = current_time('mysql');
            foreach ($accounts as $acc) {
                $wpdb->insert(
                    $this->table_name,
                    [
                        'user_id'            => $user_id,
                        'account_reference'  => $account_reference,
                        'bank_name'          => sanitize_text_field($acc['bankName'] ?? 'Bank'),
                        'bank_code'          => sanitize_text_field($acc['bankCode'] ?? ''),
                        'account_number'     => sanitize_text_field($acc['accountNumber'] ?? ''),
                        'account_name'       => sanitize_text_field($display_acc_name),
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
            $user_id = $wpdb->get_var(
                $wpdb->prepare("SELECT user_id FROM {$this->table_name} WHERE account_number = %s LIMIT 1", $account_number)
            );
            if ($user_id) {
                return (int) $user_id;
            }
        }

        $user_id = $wpdb->get_var(
            $wpdb->prepare("SELECT user_id FROM {$this->table_name} WHERE account_reference = %s LIMIT 1", $account_reference)
        );

        return $user_id ? (int) $user_id : null;
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
