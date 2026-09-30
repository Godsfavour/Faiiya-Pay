<?php
declare(strict_types=1);

namespace FaiiyaPay\Models;

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
