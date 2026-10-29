<?php
declare(strict_types=1);

namespace FaiiyaPay\Admin;

use FaiiyaPay\Models\WalletModel;
use FaiiyaPay\Models\VirtualAccountModel;

defined('ABSPATH') || exit;

if (!class_exists('WP_List_Table')) {
    require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class AdminWalletTable extends \WP_List_Table {
    public function __construct() {
        parent::__construct([
            'singular' => __('Wallet', 'faiiya-pay'),
            'plural'   => __('Wallets', 'faiiya-pay'),
            'ajax'     => false,
        ]);
    }

    public static function init(): void {
        add_action('admin_post_faiiya_adjust_wallet', [self::class, 'handle_manual_adjustment']);
        add_action('wp_ajax_faiiya_adjust_wallet', [self::class, 'handle_manual_adjustment']);
    }

    public function get_columns(): array {
        return [
            'cb'               => '<input type="checkbox" />',
            'user'             => __('Customer', 'faiiya-pay'),
            'balance'          => __('Wallet Balance', 'faiiya-pay'),
            'status'           => __('Status', 'faiiya-pay'),
            'virtual_accounts' => __('Monnify Virtual Accounts', 'faiiya-pay'),
            'updated_at'       => __('Last Activity', 'faiiya-pay'),
            'actions'          => __('Actions', 'faiiya-pay'),
        ];
    }

    public function get_sortable_columns(): array {
        return [
            'balance'    => ['balance', false],
            'updated_at' => ['updated_at', true],
        ];
    }

    public function column_default($item, $column_name) {
        return esc_html($item[$column_name] ?? '');
    }

    public function column_cb($item): string {
        return sprintf('<input type="checkbox" name="wallet_ids[]" value="%d" />', (int) $item['id']);
    }

    public function column_user($item): string {
        $user_id = (int) $item['user_id'];
        $user = get_userdata($user_id);
        $name = $user ? $user->display_name : __('Unknown User', 'faiiya-pay');
        $email = $user ? $user->user_email : '';

        return sprintf(
            '<strong><a href="%s">%s</a></strong><br/><span style="color: #64748b; font-size: 12px;">%s (ID: %d)</span>',
            esc_url(get_edit_user_link($user_id)),
            esc_html($name),
            esc_html($email),
            $user_id
        );
    }

    public function column_balance($item): string {
        $user_id = (int) $item['user_id'];
        $wallet_model = new WalletModel();
        $bal = $wallet_model->get_balance($user_id);
        return sprintf(
            '<span style="font-weight: 700; font-size: 14px; color: #059669;">₦%s</span>',
            number_format($bal, 2)
        );
    }

    public function column_status($item): string {
        $status = strtolower((string) ($item['status'] ?? 'active'));
        $user_id = (int) $item['user_id'];
        
        // Accurate KYC verification check: If user has virtual accounts or meta flag, they are verified
        $va_model = new VirtualAccountModel();
        $accounts = $va_model->get_user_accounts($user_id);
        $has_va = !empty($accounts);
        $meta_kyc = get_user_meta($user_id, 'faiiya_kyc_status', true);
        
        $is_kyc_verified = ($item['kyc_status'] === 'verified' || $item['kyc_status'] === 'tier1_verified' || $has_va || $meta_kyc === 'verified');
        $kyc_label = $is_kyc_verified ? __('Verified (Tier 1)', 'faiiya-pay') : __('Unverified', 'faiiya-pay');

        $status_color = ($status === 'active') ? '#166534' : '#991b1b';
        $status_bg    = ($status === 'active') ? '#dcfce7' : '#fee2e2';

        $kyc_color    = $is_kyc_verified ? '#065f46' : '#92400e';
        $kyc_bg       = $is_kyc_verified ? '#ecfdf5' : '#fef3c7';

        return sprintf(
            '<div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">' .
            '<span style="background:%s; color:%s; padding:2px 7px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">%s</span>' .
            '<span style="background:%s; color:%s; padding:2px 7px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">KYC: %s</span>' .
            '</div>',
            $status_bg, $status_color, esc_html($status),
            $kyc_bg, $kyc_color, esc_html($kyc_label)
        );
    }

    public function column_virtual_accounts($item): string {
        $user_id = (int) $item['user_id'];
        $va_model = new VirtualAccountModel();
        $accounts = $va_model->get_user_accounts($user_id);

        if (empty($accounts)) {
            return '<span style="color: #94a3b8; font-size: 12px;">' . esc_html__('No accounts linked (Unverified)', 'faiiya-pay') . '</span>';
        }

        $out = '<div style="font-size: 12px; line-height: 1.5; display: flex; flex-direction: column; gap: 6px;">';
        foreach ($accounts as $acc) {
            $out .= sprintf(
                '<div style="padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">' .
                '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">' .
                '<strong style="color: #059669; font-size: 11px; text-transform: uppercase;">%s</strong>' .
                '<code style="font-size: 13px; font-weight: 800; background: #ffffff; padding: 2px 6px; border: 1px solid #cbd5e1; border-radius: 4px; color: #0f172a;">%s</code>' .
                '</div>' .
                '<div style="font-size: 11px; color: #334155; margin-top: 2px;">' .
                '<strong>' . esc_html__('Account Name:', 'faiiya-pay') . '</strong> ' .
                '<span style="font-weight: 700; color: #0369a1;">%s</span>' .
                '</div>' .
                '</div>',
                esc_html($acc['bank_name']),
                esc_html($acc['account_number']),
                esc_html($acc['account_name'] ?? 'Customer')
            );
        }
        $out .= '</div>';
        return $out;
    }

    public function column_updated_at($item): string {
        return esc_html(date_i18n('M j, Y H:i', strtotime($item['updated_at'])));
    }

    public function column_actions($item): string {
        $user_id = (int) $item['user_id'];
        $user = get_userdata($user_id);
        $name = $user ? $user->display_name : ('User #' . $user_id);
        $email = $user ? $user->user_email : '';
        $wallet_model = new WalletModel();
        $current_bal = $wallet_model->get_balance($user_id);

        $sync_url = wp_nonce_url(
            admin_url('admin-post.php?action=faiiya_sync_user_deposits&user_id=' . $user_id),
            'faiiya_sync_deposits_action',
            'faiiya_sync_nonce'
        );

        return sprintf(
            '<button type="button" class="button button-small faiiya-open-adjust-modal" data-userid="%d" data-name="%s" data-email="%s" data-balance="%s">⚡ %s</button>' .
            ' <a href="%s" class="button button-small" style="margin-left: 4px;" title="%s">🔄 %s</a>',
            $user_id,
            esc_attr($name),
            esc_attr($email),
            esc_attr(number_format($current_bal, 2)),
            esc_html__('Adjust Balance', 'faiiya-pay'),
            esc_url($sync_url),
            esc_attr__('Check Monnify API for any pending or uncredited deposits for this customer', 'faiiya-pay'),
            esc_html__('Sync Deposits', 'faiiya-pay')
        );
    }

    public function prepare_items(): void {
        global $wpdb;

        $tbl_wallets = $wpdb->prefix . 'faiiya_wallets';
        $tbl_va      = $wpdb->prefix . 'faiiya_virtual_accounts';
        $tbl_users   = $wpdb->users;
        $tbl_usermeta = $wpdb->usermeta;

        // 1. Mandatory Self-Healing: Guarantee DB tables exist even if user bypassed activation
        if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl_wallets}'") !== $tbl_wallets) {
            if (class_exists('\FaiiyaPay\Activator')) {
                \FaiiyaPay\Activator::create_tables();
            }
        }

        // 2. CRITICAL FOR WP_LIST_TABLE: Initialize column headers so WordPress renders table columns
        $columns  = $this->get_columns();
        $hidden   = [];
        $sortable = $this->get_sortable_columns();
        $this->_column_headers = [$columns, $hidden, $sortable];

        $per_page = 20;
        $current_page = $this->get_pagenum();
        $offset = ($current_page - 1) * $per_page;

        $search = trim(sanitize_text_field($_REQUEST['s'] ?? ''));
        $matched_ids = [];

        if (!empty($search)) {
            $like = '%' . $wpdb->esc_like($search) . '%';
            $clean_numeric = preg_replace('/\D/', '', $search);

            // 1. Search wp_users (email, login, display_name, nicename)
            $u_ids = $wpdb->get_col(
                $wpdb->prepare(
                    "SELECT ID FROM {$tbl_users} WHERE user_email LIKE %s OR display_name LIKE %s OR user_login LIKE %s OR user_nicename LIKE %s",
                    $like, $like, $like, $like
                )
            );
            if ($u_ids) {
                $matched_ids = array_merge($matched_ids, array_map('intval', $u_ids));
            }

            // 2. Search wp_usermeta for single terms and split words (first_name, last_name, phone)
            $search_tokens = preg_split('/\s+/', $search, -1, PREG_SPLIT_NO_EMPTY);
            foreach ($search_tokens as $token) {
                $tok_like = '%' . $wpdb->esc_like($token) . '%';
                $meta_u_ids = $wpdb->get_col(
                    $wpdb->prepare(
                        "SELECT user_id FROM {$tbl_usermeta} WHERE meta_key IN ('first_name', 'last_name', '_faiiya_phone_number', 'billing_phone', 'billing_first_name', 'billing_last_name', 'nickname') AND meta_value LIKE %s",
                        $tok_like
                    )
                );
                if ($meta_u_ids) {
                    $matched_ids = array_merge($matched_ids, array_map('intval', $meta_u_ids));
                }
            }

            // 3. Search faiiya_virtual_accounts (account_number, bank_name, account_name)
            if ($wpdb->get_var("SHOW TABLES LIKE '{$tbl_va}'") === $tbl_va) {
                $va_u_ids = $wpdb->get_col(
                    $wpdb->prepare(
                        "SELECT user_id FROM {$tbl_va} WHERE account_number LIKE %s OR bank_name LIKE %s OR account_name LIKE %s OR account_reference LIKE %s",
                        $like, $like, $like, $like
                    )
                );
                if ($va_u_ids) {
                    $matched_ids = array_merge($matched_ids, array_map('intval', $va_u_ids));
                }

                // 4. Also search by cleaned numeric digits for account numbers
                if (!empty($clean_numeric) && strlen($clean_numeric) >= 3) {
                    $num_like = '%' . $wpdb->esc_like($clean_numeric) . '%';
                    $num_va_ids = $wpdb->get_col(
                        $wpdb->prepare("SELECT user_id FROM {$tbl_va} WHERE account_number LIKE %s", $num_like)
                    );
                    if ($num_va_ids) {
                        $matched_ids = array_merge($matched_ids, array_map('intval', $num_va_ids));
                    }
                }
            }

            // 5. Direct User ID numeric match
            if (is_numeric($search)) {
                $matched_ids[] = (int) $search;
            }

            $matched_ids = array_filter(array_unique($matched_ids));
        }

        // Build WHERE clause
        $where_clauses = [];
        if (!empty($search)) {
            if (!empty($matched_ids)) {
                $in_list = implode(',', array_map('intval', $matched_ids));
                $where_clauses[] = "u.ID IN ({$in_list})";
            } else {
                $where_clauses[] = "0=1"; // No matches found for search
            }
        }

        $where_sql = !empty($where_clauses) ? 'WHERE ' . implode(' AND ', $where_clauses) : '';

        // Count total matching users (LEFT JOIN guarantees any WordPress user is discoverable)
        $count_sql = "SELECT COUNT(u.ID) FROM {$tbl_users} u LEFT JOIN {$tbl_wallets} w ON u.ID = w.user_id {$where_sql}";
        $total_items = (int) $wpdb->get_var($count_sql);

        // Sorting: Use COALESCE on dates so NULL records don't get lost
        $allowed_orderby = ['balance' => 'w.balance', 'updated_at' => 'COALESCE(w.updated_at, u.user_registered)', 'user_id' => 'u.ID'];
        $req_orderby = sanitize_key($_REQUEST['orderby'] ?? 'updated_at');
        $orderby_col = $allowed_orderby[$req_orderby] ?? 'COALESCE(w.updated_at, u.user_registered)';
        $order = (strtoupper($_REQUEST['order'] ?? 'DESC') === 'ASC') ? 'ASC' : 'DESC';

        // Select items with COALESCE to ensure seamless display even if wallet record is initializing
        $data_sql = "SELECT 
            u.ID as user_id,
            COALESCE(w.id, 0) as id,
            COALESCE(w.balance, 0.00) as balance,
            COALESCE(w.currency, 'NGN') as currency,
            COALESCE(w.status, 'active') as status,
            COALESCE(w.kyc_status, 'unverified') as kyc_status,
            COALESCE(w.created_at, u.user_registered) as created_at,
            COALESCE(w.updated_at, u.user_registered) as updated_at
        FROM {$tbl_users} u
        LEFT JOIN {$tbl_wallets} w ON u.ID = w.user_id
        {$where_sql}
        ORDER BY {$orderby_col} {$order}, u.ID DESC
        LIMIT %d OFFSET %d";

        $items = $wpdb->get_results(
            $wpdb->prepare($data_sql, $per_page, $offset),
            ARRAY_A
        );

        $wallet_model = new WalletModel();

        // 3. Fail-safe Native Fallback: If SQL returns empty and search is empty (or on unexpected DB glitch), populate directly via get_users()
        if (empty($items) && empty($search)) {
            $user_args = [
                'number'  => $per_page,
                'offset'  => $offset,
                'orderby' => 'ID',
                'order'   => 'DESC',
            ];
            $wp_users_list = get_users($user_args);
            $items = [];

            foreach ($wp_users_list as $wp_u) {
                $w = $wallet_model->ensure_wallet_exists((int) $wp_u->ID);
                $items[] = [
                    'user_id'    => (int) $wp_u->ID,
                    'id'         => (int) ($w->id ?? 0),
                    'balance'    => (float) ($w->balance ?? 0.00),
                    'currency'   => $w->currency ?? 'NGN',
                    'status'     => $w->status ?? 'active',
                    'kyc_status' => $w->kyc_status ?? 'unverified',
                    'created_at' => $w->created_at ?? $wp_u->user_registered,
                    'updated_at' => $w->updated_at ?? $wp_u->user_registered,
                ];
            }
            $total_items = (int) count_users()['total_users'];
        } elseif (!empty($items)) {
            // Ensure every displayed user has their wallet row saved in wp_faiiya_wallets and accurate balance populated
            foreach ($items as &$item_row) {
                $uid = (int) $item_row['user_id'];
                $w_fresh = $wallet_model->get_wallet($uid);
                if ($w_fresh) {
                    $item_row['id'] = (int) $w_fresh->id;
                    $item_row['balance'] = (float) $w_fresh->balance;
                    $item_row['status'] = $w_fresh->status;
                    $item_row['kyc_status'] = $w_fresh->kyc_status;
                }
            }
            unset($item_row);
        }

        $this->items = $items ?: [];

        $this->set_pagination_args([
            'total_items' => $total_items,
            'per_page'    => $per_page,
            'total_pages' => max(1, ceil($total_items / $per_page)),
        ]);
    }

    public static function handle_manual_adjustment(): void {
        if (!wp_verify_nonce($_REQUEST['faiiya_adjust_nonce'] ?? '', 'faiiya_adjust_wallet_action')) {
            if (wp_doing_ajax()) {
                wp_send_json_error(['message' => __('Security verification failed (invalid nonce).', 'faiiya-pay')]);
            }
            wp_die(__('Security verification failed (invalid nonce).', 'faiiya-pay'));
        }

        if (!current_user_can('manage_options')) {
            if (wp_doing_ajax()) {
                wp_send_json_error(['message' => __('Unauthorized capability.', 'faiiya-pay')]);
            }
            wp_die(__('Unauthorized capability.', 'faiiya-pay'));
        }

        $raw_input = trim((string) ($_REQUEST['user_id'] ?? ''));
        $user_id   = 0;

        // 1. Direct positive integer if user actually exists with that ID
        if (is_numeric($raw_input) && (int) $raw_input > 0 && strlen($raw_input) < 10) {
            $u_test = get_userdata((int) $raw_input);
            if ($u_test) {
                $user_id = (int) $u_test->ID;
            }
        }

        // 2. Check email
        if ($user_id <= 0 && is_email($raw_input)) {
            $u = get_user_by('email', $raw_input);
            if ($u) {
                $user_id = (int) $u->ID;
            }
        }

        // 3. Check virtual account number (NUBAN is 10 digits numeric, or matches alphanumeric account reference)
        if ($user_id <= 0) {
            global $wpdb;
            $tbl_va = $wpdb->prefix . 'faiiya_virtual_accounts';
            $clean_digits = preg_replace('/\D/', '', $raw_input);
            
            // Check if matching virtual account number
            if (!empty($clean_digits) && strlen($clean_digits) >= 6) {
                $va_uid = $wpdb->get_var(
                    $wpdb->prepare("SELECT user_id FROM {$tbl_va} WHERE account_number = %s LIMIT 1", $clean_digits)
                );
                if ($va_uid) {
                    $user_id = (int) $va_uid;
                }
            }
            if ($user_id <= 0 && !empty($raw_input)) {
                $va_uid = $wpdb->get_var(
                    $wpdb->prepare("SELECT user_id FROM {$tbl_va} WHERE account_number = %s OR account_reference = %s LIMIT 1", $raw_input, $raw_input)
                );
                if ($va_uid) {
                    $user_id = (int) $va_uid;
                }
            }
        }

        // 4. Check username
        if ($user_id <= 0 && !empty($raw_input)) {
            $u = get_user_by('login', $raw_input);
            if ($u) {
                $user_id = (int) $u->ID;
            }
        }

        // 5. Check phone number in usermeta
        if ($user_id <= 0 && !empty($raw_input)) {
            global $wpdb;
            $phone_digits = preg_replace('/\D/', '', $raw_input);
            if (!empty($phone_digits) && strlen($phone_digits) >= 9) {
                $phone_uid = $wpdb->get_var(
                    $wpdb->prepare(
                        "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key IN ('_faiiya_phone_number', 'billing_phone', 'phone_number') AND meta_value LIKE %s LIMIT 1",
                        '%' . $wpdb->esc_like($phone_digits) . '%'
                    )
                );
                if ($phone_uid) {
                    $user_id = (int) $phone_uid;
                }
            }
        }

        // 6. Check display_name or first/last name
        if ($user_id <= 0 && !empty($raw_input)) {
            global $wpdb;
            $like = '%' . $wpdb->esc_like($raw_input) . '%';
            $name_uid = $wpdb->get_var(
                $wpdb->prepare("SELECT ID FROM {$wpdb->users} WHERE display_name LIKE %s LIMIT 1", $like)
            );
            if ($name_uid) {
                $user_id = (int) $name_uid;
            } else {
                $name_uid = $wpdb->get_var(
                    $wpdb->prepare("SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key IN ('first_name', 'last_name') AND meta_value LIKE %s LIMIT 1", $like)
                );
                if ($name_uid) {
                    $user_id = (int) $name_uid;
                }
            }
        }

        // 7. If raw_input is purely numeric and all above failed, test if user ID exists
        if ($user_id <= 0 && is_numeric($raw_input) && (int) $raw_input > 0) {
            $u_fallback = get_userdata((int) $raw_input);
            if ($u_fallback) {
                $user_id = (int) $u_fallback->ID;
            }
        }

        $type   = strtolower(sanitize_text_field($_REQUEST['adjustment_type'] ?? 'credit'));
        if (!in_array($type, ['credit', 'debit'], true)) {
            $type = 'credit';
        }
        $amount = (float) ($_REQUEST['amount'] ?? 0.00);
        $reason = sanitize_text_field($_REQUEST['reason'] ?? 'Admin manual adjustment');

        if ($user_id <= 0) {
            $err_msg = __('Customer account could not be found. Please enter a valid User ID, Email, Customer Name, or Dedicated Virtual Account number.', 'faiiya-pay');
            if (wp_doing_ajax()) {
                wp_send_json_error(['message' => $err_msg]);
            }
            set_transient('faiiya_adj_notice', ['success' => false, 'message' => $err_msg], 60);
            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets'], admin_url('admin.php')));
            exit;
        }

        if ($amount <= 0) {
            $err_msg = __('Adjustment amount must be greater than zero.', 'faiiya-pay');
            if (wp_doing_ajax()) {
                wp_send_json_error(['message' => $err_msg]);
            }
            set_transient('faiiya_adj_notice', ['success' => false, 'message' => $err_msg], 60);
            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets'], admin_url('admin.php')));
            exit;
        }

        $wallet_model = new WalletModel();
        $wallet_model->ensure_wallet_exists($user_id);
        $reference = 'ADMIN-ADJ-' . $user_id . '-' . time() . '-' . wp_rand(100, 999);

        try {
            if ($type === 'credit') {
                $result = $wallet_model->credit($user_id, $amount, 'admin_adjustment', $reference, [
                    'admin_user_id' => get_current_user_id(),
                    'admin_login'   => wp_get_current_user()->user_login,
                    'reason'        => $reason,
                ]);
            } else {
                $result = $wallet_model->debit($user_id, $amount, 'admin_adjustment', $reference, [
                    'admin_user_id' => get_current_user_id(),
                    'admin_login'   => wp_get_current_user()->user_login,
                    'reason'        => $reason,
                ]);
            }

            $customer = get_userdata($user_id);
            $customer_name = $customer ? $customer->display_name : ('User #' . $user_id);
            $bal_after = (float) ($result['balance_after'] ?? $wallet_model->get_balance($user_id));

            if (wp_doing_ajax()) {
                wp_send_json_success([
                    'message'       => sprintf(
                        __('Successfully %sed ₦%s to %s. New balance: ₦%s', 'faiiya-pay'),
                        $type === 'credit' ? 'credit' : 'debit',
                        number_format($amount, 2),
                        $customer_name,
                        number_format($bal_after, 2)
                    ),
                    'user_id'       => $user_id,
                    'balance_after' => $bal_after,
                    'formatted_bal' => '₦' . number_format($bal_after, 2),
                ]);
            }

            set_transient('faiiya_adj_notice', [
                'success'       => true,
                'type'          => $type,
                'amount'        => $amount,
                'user_id'       => $user_id,
                'customer_name' => $customer_name,
                'balance_after' => $bal_after,
                'reason'        => $reason,
            ], 60);

            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets'], admin_url('admin.php')));
            exit;
        } catch (\Throwable $e) {
            if (wp_doing_ajax()) {
                wp_send_json_error(['message' => $e->getMessage()]);
            }

            set_transient('faiiya_adj_notice', [
                'success' => false,
                'message' => $e->getMessage(),
            ], 60);

            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets'], admin_url('admin.php')));
            exit;
        }
    }

    public static function render_page(): void {
        if (!current_user_can('manage_options')) {
            return;
        }

        $table = new self();
        $table->prepare_items();

        // Render transient notices (prevents URL-length errors and ModSecurity blocks on shared hosts)
        $adj_notice = get_transient('faiiya_adj_notice');
        if ($adj_notice) {
            delete_transient('faiiya_adj_notice');
            if (!empty($adj_notice['success'])) {
                $action_label = ($adj_notice['type'] === 'credit') ? __('Credited (+)', 'faiiya-pay') : __('Debited (-)', 'faiiya-pay');
                echo '<div class="notice notice-success is-dismissible" style="padding: 14px 18px; border-left: 4px solid #059669; background: #f0fdf4; margin: 18px 0; border-radius: 6px;">' .
                     '<p style="margin: 0; font-size: 14px; color: #166534;"><strong>✅ ' . sprintf(
                         esc_html__('Wallet Successfully Updated: %s ₦%s for %s (ID: %d). New Available Balance: ₦%s.', 'faiiya-pay'),
                         $action_label,
                         number_format((float) $adj_notice['amount'], 2),
                         esc_html($adj_notice['customer_name']),
                         (int) $adj_notice['user_id'],
                         number_format((float) $adj_notice['balance_after'], 2)
                     ) . '</strong></p>' .
                     '<p style="margin: 6px 0 0 0; color: #15803d; font-size: 12px;">' .
                     sprintf(esc_html__('Audit Reason: %s | Synchronized with customer frontend dashboard & WooCommerce checkout.', 'faiiya-pay'), esc_html($adj_notice['reason'])) .
                     '</p>' .
                     '</div>';
            } else {
                echo '<div class="notice notice-error is-dismissible" style="padding: 14px 18px; margin: 18px 0; border-radius: 6px;"><p style="margin: 0; font-size: 13px;"><strong>❌ ' .
                     esc_html__('Wallet Adjustment Failed: ', 'faiiya-pay') .
                     esc_html($adj_notice['message'] ?? 'Unknown error') .
                     '</strong></p></div>';
            }
        }

        if (isset($_GET['synced_user'])) {
            $user_id = (int) $_GET['synced_user'];
            $sync_result = get_transient('faiiya_sync_result_' . $user_id);
            if ($sync_result) {
                $is_ok = !empty($sync_result['success']);
                $class = $is_ok ? 'notice notice-success' : 'notice notice-error';
                echo '<div class="' . esc_attr($class) . ' is-dismissible"><p><strong>' . ($is_ok ? '✅ ' : '❌ ') . esc_html($sync_result['message']) . '</strong></p></div>';
            }
        }
        ?>
        <div class="wrap faiiya-pay-admin">
            <h1 class="wp-heading-inline"><?php esc_html_e('Faiiya Customer Wallets', 'faiiya-pay'); ?></h1>
            <hr class="wp-header-end" />

            <!-- MODULE: Query Wallet & Add/Remove Funds -->
            <div class="card" style="max-width: 100%; margin: 18px 0 24px 0; padding: 20px 24px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 16px;">
                    <div>
                        <h2 style="margin: 0; font-size: 16px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                            <span>💼 <?php esc_html_e('Query Wallet & Fund Management (Add / Remove Funds)', 'faiiya-pay'); ?></span>
                        </h2>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">
                            <?php esc_html_e('Query any customer wallet by User ID, Email, Customer Name, or Dedicated Virtual Account number to inspect balances and perform audited balance adjustments.', 'faiiya-pay'); ?>
                        </p>
                    </div>
                </div>

                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) 140px; gap: 12px; align-items: flex-end;">
                    <?php wp_nonce_field('faiiya_adjust_wallet_action', 'faiiya_adjust_nonce'); ?>
                    <input type="hidden" name="action" value="faiiya_adjust_wallet" />

                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                            <?php esc_html_e('Customer User ID, Email, or Account Number', 'faiiya-pay'); ?> *
                        </label>
                        <input type="text" name="user_id" required placeholder="<?php esc_attr_e('e.g. 11, user@example.ng, or 9981240182', 'faiiya-pay'); ?>" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    </div>

                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                            <?php esc_html_e('Action (Credit / Debit)', 'faiiya-pay'); ?> *
                        </label>
                        <select name="adjustment_type" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                            <option value="credit"><?php esc_html_e('➕ Add Funds (Credit)', 'faiiya-pay'); ?></option>
                            <option value="debit"><?php esc_html_e('➖ Remove Funds (Debit)', 'faiiya-pay'); ?></option>
                        </select>
                    </div>

                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                            <?php esc_html_e('Amount (₦ NGN)', 'faiiya-pay'); ?> *
                        </label>
                        <input type="number" step="0.01" min="1" name="amount" required placeholder="5000" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    </div>

                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                            <?php esc_html_e('Mandatory Audit Reason', 'faiiya-pay'); ?> *
                        </label>
                        <input type="text" name="reason" required placeholder="e.g. Bank transfer reconciliation" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    </div>

                    <div>
                        <button type="submit" class="button button-primary" style="width: 100%; padding: 6px 12px; font-weight: 700; height: 38px;">
                            <?php esc_html_e('Apply Funds', 'faiiya-pay'); ?>
                        </button>
                    </div>
                </form>
            </div>

            <form method="get">
                <input type="hidden" name="page" value="faiiya-pay-wallets" />
                <?php
                $table->search_box(__('Search Wallets', 'faiiya-pay'), 'faiiya-search');
                $table->display();
                ?>
            </form>

            <!-- Manual Adjustment Modal Dialog with Target Customer Details -->
            <div id="faiiya-modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(2px);">
                <div style="background: #ffffff; border-radius: 14px; width: 460px; max-width: 92%; padding: 26px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 1px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                        <div>
                            <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #0f172a;"><?php esc_html_e('Adjust Customer Wallet Balance', 'faiiya-pay'); ?></h2>
                            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;"><?php esc_html_e('Instantly credit or debit customer balance with automatic audit trail.', 'faiiya-pay'); ?></p>
                        </div>
                        <button type="button" onclick="document.getElementById('faiiya-modal-backdrop').style.display='none';" style="background: none; border: none; font-size: 22px; color: #94a3b8; cursor: pointer; line-height: 1;">&times;</button>
                    </div>

                    <!-- Target Customer Info Banner in Modal -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 18px;">
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em; margin-bottom: 4px;"><?php esc_html_e('Target Customer Account', 'faiiya-pay'); ?></div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span id="modal-customer-name" style="font-weight: 700; color: #0f172a; font-size: 14px;">Customer</span>
                            <span style="font-size: 13px; color: #059669; font-weight: 800; background: #ecfdf5; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;" id="modal-current-balance">₦0.00</span>
                        </div>
                        <div id="modal-customer-email" style="font-size: 12px; color: #64748b; margin-top: 4px;"></div>
                    </div>

                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" id="faiiya-modal-form">
                        <?php wp_nonce_field('faiiya_adjust_wallet_action', 'faiiya_adjust_nonce'); ?>
                        <input type="hidden" name="action" value="faiiya_adjust_wallet" />
                        <input type="hidden" name="user_id" id="modal-adjust-userid" value="" />

                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-weight: 600; font-size: 13px; color: #334155; margin-bottom: 6px;"><?php esc_html_e('Adjustment Type', 'faiiya-pay'); ?> *</label>
                            <select name="adjustment_type" id="modal-adjust-type" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;">
                                <option value="credit"><?php esc_html_e('➕ Credit (+ Add Funds)', 'faiiya-pay'); ?></option>
                                <option value="debit"><?php esc_html_e('➖ Debit (- Deduct Funds)', 'faiiya-pay'); ?></option>
                            </select>
                        </div>

                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-weight: 600; font-size: 13px; color: #334155; margin-bottom: 6px;"><?php esc_html_e('Amount (₦ NGN)', 'faiiya-pay'); ?> *</label>
                            <input type="number" step="0.01" min="1" name="amount" id="modal-adjust-amount" required placeholder="5000" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; font-weight: 600;" />
                        </div>

                        <div style="margin-bottom: 18px;">
                            <label style="display: block; font-weight: 600; font-size: 13px; color: #334155; margin-bottom: 6px;"><?php esc_html_e('Mandatory Audit Note / Reason', 'faiiya-pay'); ?> *</label>
                            <textarea name="reason" id="modal-adjust-reason" required rows="2" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;" placeholder="<?php esc_attr_e('e.g. Manual bank deposit reconciliation, customer support top-up', 'faiiya-pay'); ?>"></textarea>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                            <button type="button" class="button" onclick="document.getElementById('faiiya-modal-backdrop').style.display='none';"><?php esc_html_e('Cancel', 'faiiya-pay'); ?></button>
                            <button type="submit" id="modal-submit-btn" class="button button-primary" style="padding: 4px 16px; font-weight: 700;"><?php esc_html_e('Execute Adjustment', 'faiiya-pay'); ?></button>
                        </div>
                    </form>
                </div>
            </div>

            <script>
            document.addEventListener('DOMContentLoaded', function() {
                var modal = document.getElementById('faiiya-modal-backdrop');
                if (!modal) return;

                document.querySelectorAll('.faiiya-open-adjust-modal').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var uid = this.getAttribute('data-userid');
                        var name = this.getAttribute('data-name') || ('User #' + uid);
                        var email = this.getAttribute('data-email') || '';
                        var bal = this.getAttribute('data-balance') || '0.00';

                        document.getElementById('modal-adjust-userid').value = uid;
                        document.getElementById('modal-customer-name').textContent = name + ' (#' + uid + ')';
                        document.getElementById('modal-customer-email').textContent = email;
                        document.getElementById('modal-current-balance').textContent = '₦' + bal;
                        document.getElementById('modal-adjust-amount').value = '';
                        document.getElementById('modal-adjust-reason').value = '';
                        modal.style.display = 'flex';
                    });
                });

                modal.addEventListener('click', function(e) {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            });
            </script>
        </div>
        <?php
    }
}
