<?php
declare(strict_types=1);

namespace FaiiyaPay\Models;

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
            throw new \InvalidArgumentException('Credit amount must be greater than zero.');
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
            throw new InvalidArgumentException('Debit amount must be greater than zero.');
        }

        global $wpdb;
        $wallet = $this->ensure_wallet_exists($user_id);

        if ($wallet->status !== 'active' && $type !== 'admin_adjustment') {
            throw new RuntimeException("Wallet is {$wallet->status} and cannot be debited.");
        }

        $now = current_time('mysql');
        // Always calculate from TRUE current balance so subtractions are mathematically exact
        $balance_before = $this->get_balance($user_id);

        if ($balance_before < $amount) {
            throw new UnderflowException(
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
