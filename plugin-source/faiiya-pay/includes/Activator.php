<?php
declare(strict_types=1);

namespace FaiiyaPay;

defined('ABSPATH') || exit;

class Activator {
    public static function activate(): void {
        self::create_tables();
        self::set_default_options();
        self::create_default_pages();
        flush_rewrite_rules();
    }

    private static function create_tables(): void {
        global $wpdb;

        $charset_collate = $wpdb->get_charset_collate();
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        // 1. faiiya_wallets
        $table_wallets = $wpdb->prefix . 'faiiya_wallets';
        $sql_wallets = "CREATE TABLE {$table_wallets} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT(20) UNSIGNED NOT NULL,
            balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
            currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
            kyc_status ENUM('unverified', 'verified') NOT NULL DEFAULT 'unverified',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_user_id (user_id),
            KEY idx_kyc_status (kyc_status),
            KEY idx_status (status)
        ) {$charset_collate};";

        // 2. faiiya_transactions
        $table_transactions = $wpdb->prefix . 'faiiya_transactions';
        $sql_transactions = "CREATE TABLE {$table_transactions} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            txn_uuid VARCHAR(64) NOT NULL,
            wallet_id BIGINT(20) UNSIGNED NOT NULL,
            user_id BIGINT(20) UNSIGNED NOT NULL,
            type ENUM('deposit', 'debit_order', 'referral_bonus', 'refund', 'admin_adjustment') NOT NULL,
            amount DECIMAL(12, 2) NOT NULL,
            balance_before DECIMAL(12, 2) NOT NULL,
            balance_after DECIMAL(12, 2) NOT NULL,
            reference VARCHAR(100) NOT NULL,
            metadata LONGTEXT DEFAULT NULL,
            status ENUM('pending', 'completed', 'failed', 'reversed') NOT NULL DEFAULT 'completed',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_txn_uuid (txn_uuid),
            UNIQUE KEY uk_reference (reference),
            KEY idx_wallet_id (wallet_id),
            KEY idx_user_id (user_id),
            KEY idx_type (type),
            KEY idx_status (status),
            KEY idx_created_at (created_at)
        ) {$charset_collate};";

        // 3. faiiya_virtual_accounts
        $table_virtual_accounts = $wpdb->prefix . 'faiiya_virtual_accounts';
        $sql_virtual_accounts = "CREATE TABLE {$table_virtual_accounts} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT(20) UNSIGNED NOT NULL,
            account_reference VARCHAR(64) NOT NULL,
            bank_name VARCHAR(100) NOT NULL,
            bank_code VARCHAR(20) NOT NULL,
            account_number VARCHAR(20) NOT NULL,
            account_name VARCHAR(150) NOT NULL,
            reservation_status VARCHAR(20) NOT NULL DEFAULT 'active',
            raw_response LONGTEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_account_reference (account_reference),
            KEY idx_user_id (user_id),
            KEY idx_account_number (account_number)
        ) {$charset_collate};";

        // 4. faiiya_referrals
        $table_referrals = $wpdb->prefix . 'faiiya_referrals';
        $sql_referrals = "CREATE TABLE {$table_referrals} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            referrer_id BIGINT(20) UNSIGNED NOT NULL,
            referee_id BIGINT(20) UNSIGNED NOT NULL,
            referral_code VARCHAR(32) NOT NULL,
            reward_amount DECIMAL(12, 2) NOT NULL DEFAULT 500.00,
            status ENUM('pending', 'credited', 'cancelled') NOT NULL DEFAULT 'pending',
            credited_at DATETIME DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_referee (referee_id),
            KEY idx_referrer_id (referrer_id),
            KEY idx_referral_code (referral_code),
            KEY idx_status (status)
        ) {$charset_collate};";

        // 5. faiiya_webhook_logs
        $table_webhook_logs = $wpdb->prefix . 'faiiya_webhook_logs';
        $sql_webhook_logs = "CREATE TABLE {$table_webhook_logs} (
            id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            gateway VARCHAR(30) NOT NULL DEFAULT 'monnify',
            event_type VARCHAR(50) NOT NULL DEFAULT 'SUCCESSFUL_TRANSACTION',
            transaction_reference VARCHAR(100) NOT NULL,
            request_hash VARCHAR(128) NOT NULL,
            payload LONGTEXT NOT NULL,
            processed_status ENUM('received', 'processed', 'duplicate', 'failed') NOT NULL DEFAULT 'received',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_transaction_reference (transaction_reference),
            KEY idx_gateway (gateway),
            KEY idx_processed_status (processed_status)
        ) {$charset_collate};";

        dbDelta($sql_wallets);
        dbDelta($sql_transactions);
        dbDelta($sql_virtual_accounts);
        dbDelta($sql_referrals);
        dbDelta($sql_webhook_logs);

        update_option('faiiya_pay_db_version', FAIIYA_PAY_VERSION);
    }

    private static function set_default_options(): void {
        add_option('faiiya_monnify_mode', 'sandbox');
        add_option('faiiya_monnify_api_key', '');
        add_option('faiiya_monnify_secret_key', '');
        add_option('faiiya_monnify_contract_code', '');
        add_option('faiiya_referral_enabled', 'yes');
        add_option('faiiya_referral_reward_amount', '500.00');
        add_option('faiiya_referral_trigger', 'on_first_wallet_deposit');
    }

    /**
     * Automatically creates standard customer frontend pages if they do not exist.
     */
    public static function create_default_pages(): void {
        $pages = [
            'faiiya_page_register_id' => [
                'title'   => __('Register with Faiiya Pay', 'faiiya-pay'),
                'slug'    => 'faiiya-register',
                'content' => '[faiiya_pay_register]',
            ],
            'faiiya_page_dashboard_id' => [
                'title'   => __('Faiiya Pay Dashboard', 'faiiya-pay'),
                'slug'    => 'faiiya-dashboard',
                'content' => '[faiiya_pay_dashboard]',
            ],
            'faiiya_page_wallet_id' => [
                'title'   => __('My Wallet', 'faiiya-pay'),
                'slug'    => 'faiiya-wallet',
                'content' => '[faiiya_wallet]',
            ],
            'faiiya_page_referrals_id' => [
                'title'   => __('Referral Program', 'faiiya-pay'),
                'slug'    => 'faiiya-referrals',
                'content' => '[faiiya_referrals]',
            ],
            'faiiya_page_topup_id' => [
                'title'   => __('Wallet Top-Up', 'faiiya-pay'),
                'slug'    => 'faiiya-topup',
                'content' => '[faiiya_topup]',
            ],
        ];

        foreach ($pages as $option_key => $page_data) {
            $existing_id = (int) get_option($option_key, 0);
            $page_exists = false;

            if ($existing_id > 0) {
                $post = get_post($existing_id);
                if ($post && $post->post_status !== 'trash') {
                    $page_exists = true;
                }
            }

            if (!$page_exists) {
                $found = get_page_by_path($page_data['slug']);
                if ($found && $found->post_status !== 'trash') {
                    update_option($option_key, (int) $found->ID);
                } else {
                    $new_id = wp_insert_post([
                        'post_title'     => $page_data['title'],
                        'post_name'      => $page_data['slug'],
                        'post_content'   => $page_data['content'],
                        'post_status'    => 'publish',
                        'post_type'      => 'page',
                        'comment_status' => 'closed',
                        'ping_status'    => 'closed',
                    ]);

                    if (!is_wp_error($new_id) && $new_id > 0) {
                        update_option($option_key, (int) $new_id);
                    }
                }
            }
        }
    }
}
