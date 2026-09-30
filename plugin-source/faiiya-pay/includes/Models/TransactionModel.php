<?php
declare(strict_types=1);

namespace FaiiyaPay\Models;

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
