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
            throw new \InvalidArgumentException('Credit amount must be greater than zero.');
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
                throw new \RuntimeException('Wallet not found for locked update.');
            }

            if ($wallet->status !== 'active') {
                throw new \RuntimeException("Wallet is {$wallet->status} and cannot receive funds.");
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
                throw new \RuntimeException('Failed to update wallet balance.');
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
        } catch (\Throwable $e) {
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
            throw new \InvalidArgumentException('Debit amount must be greater than zero.');
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
                throw new \RuntimeException('Wallet record could not be locked.');
            }

            if ($wallet->status !== 'active') {
                throw new \RuntimeException("Wallet is {$wallet->status} and cannot be debited.");
            }

            $balance_before = (float) $wallet->balance;

            if ($balance_before < $amount) {
                throw new \UnderflowException(
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
                throw new \RuntimeException('Failed to update wallet balance during debit.');
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
        } catch (\Throwable $e) {
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
