import { PluginFile } from '../pluginFiles';

export const adminFiles: PluginFile[] = [
  {
    path: 'includes/Admin/AdminSettings.php',
    name: 'AdminSettings.php',
    category: 'admin',
    description: 'WP Admin Settings API: Monnify API credentials, referral rewards configuration, automatic pages status, and webhook endpoint display.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Admin;

use FaiiyaPay\\Activator;

defined('ABSPATH') || exit;

class AdminSettings {
    public static function init(): void {
        add_action('admin_menu', [self::class, 'add_menu_pages']);
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('admin_post_faiiya_regenerate_pages', [self::class, 'handle_regenerate_pages']);
    }

    public static function add_menu_pages(): void {
        add_menu_page(
            __('Faiiya Pay', 'faiiya-pay'),
            __('Faiiya Pay', 'faiiya-pay'),
            'manage_options',
            'faiiya-pay-wallets',
            [AdminWalletTable::class, 'render_page'],
            'dashicons-money-alt',
            56
        );

        add_submenu_page(
            'faiiya-pay-wallets',
            __('Customer Wallets', 'faiiya-pay'),
            __('Customer Wallets', 'faiiya-pay'),
            'manage_options',
            'faiiya-pay-wallets',
            [AdminWalletTable::class, 'render_page']
        );

        add_submenu_page(
            'faiiya-pay-wallets',
            __('Settings & Monnify API', 'faiiya-pay'),
            __('Settings', 'faiiya-pay'),
            'manage_options',
            'faiiya-pay-settings',
            [self::class, 'render_settings_page']
        );
    }

    public static function register_settings(): void {
        register_setting('faiiya_pay_settings_group', 'faiiya_monnify_mode', ['sanitize_callback' => 'sanitize_text_field', 'default' => 'sandbox']);
        register_setting('faiiya_pay_settings_group', 'faiiya_monnify_api_key', ['sanitize_callback' => 'sanitize_text_field']);
        register_setting('faiiya_pay_settings_group', 'faiiya_monnify_secret_key', ['sanitize_callback' => 'sanitize_text_field']);
        register_setting('faiiya_pay_settings_group', 'faiiya_monnify_contract_code', ['sanitize_callback' => 'sanitize_text_field']);
        register_setting('faiiya_pay_settings_group', 'faiiya_referral_enabled', ['sanitize_callback' => 'sanitize_text_field', 'default' => 'yes']);
        register_setting('faiiya_pay_settings_group', 'faiiya_referral_reward_amount', ['sanitize_callback' => 'sanitize_text_field', 'default' => '500.00']);
        register_setting('faiiya_pay_settings_group', 'faiiya_referral_trigger', ['sanitize_callback' => 'sanitize_text_field', 'default' => 'on_first_wallet_deposit']);
    }

    public static function handle_regenerate_pages(): void {
        check_admin_referer('faiiya_regenerate_pages_action', 'faiiya_regen_nonce');
        if (!current_user_can('manage_options')) {
            wp_die(__('Permission denied', 'faiiya-pay'));
        }

        Activator::create_default_pages();
        flush_rewrite_rules();

        wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-settings', 'pages_regenerated' => '1'], admin_url('admin.php')));
        exit;
    }

    public static function render_settings_page(): void {
        if (!current_user_can('manage_options')) {
            return;
        }

        $webhook_url = rest_url('faiiya/v1/webhook/monnify');
        $mode = get_option('faiiya_monnify_mode', 'sandbox');
        $api_key = get_option('faiiya_monnify_api_key', '');
        $secret_key = get_option('faiiya_monnify_secret_key', '');
        $contract_code = get_option('faiiya_monnify_contract_code', '');
        $ref_enabled = get_option('faiiya_referral_enabled', 'yes');
        $ref_reward = get_option('faiiya_referral_reward_amount', '500.00');
        $ref_trigger = get_option('faiiya_referral_trigger', 'on_first_wallet_deposit');

        $pages = [
            'Registration Page' => [
                'id'        => (int) get_option('faiiya_page_register_id', 0),
                'shortcode' => '[faiiya_pay_register]',
                'default'   => 'faiiya-register',
            ],
            'Dashboard (Main)' => [
                'id'        => (int) get_option('faiiya_page_dashboard_id', 0),
                'shortcode' => '[faiiya_pay_dashboard]',
                'default'   => 'faiiya-dashboard',
            ],
            'Wallet Dashboard' => [
                'id'        => (int) get_option('faiiya_page_wallet_id', 0),
                'shortcode' => '[faiiya_wallet]',
                'default'   => 'faiiya-wallet',
            ],
            'Referral Program' => [
                'id'        => (int) get_option('faiiya_page_referrals_id', 0),
                'shortcode' => '[faiiya_referrals]',
                'default'   => 'faiiya-referrals',
            ],
            'Wallet Top-Up' => [
                'id'        => (int) get_option('faiiya_page_topup_id', 0),
                'shortcode' => '[faiiya_topup]',
                'default'   => 'faiiya-topup',
            ],
        ];

        if (isset($_GET['pages_regenerated'])) {
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__('Default Faiiya Pay pages verified and regenerated successfully.', 'faiiya-pay') . '</p></div>';
        }
        ?>
        <div class="wrap faiiya-pay-admin">
            <h1><?php esc_html_e('Faiiya Pay Settings', 'faiiya-pay'); ?></h1>

            <!-- Webhook Notice -->
            <div class="notice notice-info" style="margin: 20px 0; padding: 14px 18px; border-left-color: #059669; background: #f0fdf4;">
                <p style="margin: 0; font-size: 14px; color: #166534;">
                    <strong><?php esc_html_e('Monnify Webhook URL:', 'faiiya-pay'); ?></strong>
                    <code style="background: #ffffff; padding: 4px 8px; border-radius: 4px; font-weight: 600; border: 1px solid #bbf7d0; margin-left: 6px;"><?php echo esc_url($webhook_url); ?></code>
                </p>
                <p style="margin: 6px 0 0 0; color: #15803d; font-size: 13px;">
                    <?php esc_html_e('Paste this exact URL into your Monnify Merchant Dashboard (Settings > Webhooks) to enable instant automatic wallet deposits.', 'faiiya-pay'); ?>
                </p>
            </div>

            <!-- Automatic Pages Box -->
            <div class="card" style="max-width: 900px; margin-bottom: 24px; padding: 18px 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px;"><?php esc_html_e('Automatic WordPress Pages & Shortcodes', 'faiiya-pay'); ?></h2>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">
                            <?php esc_html_e('These pages were created automatically on plugin activation to provide customer-facing portals.', 'faiiya-pay'); ?>
                        </p>
                    </div>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <?php wp_nonce_field('faiiya_regenerate_pages_action', 'faiiya_regen_nonce'); ?>
                        <input type="hidden" name="action" value="faiiya_regenerate_pages" />
                        <button type="submit" class="button button-secondary">
                            <?php esc_html_e('Regenerate Missing Pages', 'faiiya-pay'); ?>
                        </button>
                    </form>
                </div>

                <table class="widefat striped" style="margin-top: 10px;">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Feature', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('Page Title', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('Shortcode', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('Status', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('View Page', 'faiiya-pay'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($pages as $feature_name => $info) : 
                            $post = $info['id'] > 0 ? get_post($info['id']) : null;
                            $exists = $post && $post->post_status === 'publish';
                        ?>
                            <tr>
                                <td><strong><?php echo esc_html($feature_name); ?></strong></td>
                                <td><?php echo $post ? esc_html($post->post_title) : '<em>' . esc_html__('Missing', 'faiiya-pay') . '</em>'; ?></td>
                                <td><code><?php echo esc_html($info['shortcode']); ?></code></td>
                                <td>
                                    <?php if ($exists) : ?>
                                        <span class="dashicons dashicons-yes-alt" style="color: #059669;"></span> <strong style="color: #059669;"><?php esc_html_e('Published', 'faiiya-pay'); ?></strong>
                                    <?php else : ?>
                                        <span class="dashicons dashicons-warning" style="color: #dc2626;"></span> <span style="color: #dc2626;"><?php esc_html_e('Not Found', 'faiiya-pay'); ?></span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php if ($exists) : ?>
                                        <a href="<?php echo esc_url(get_permalink($post->ID)); ?>" target="_blank" class="button button-small">
                                            <?php esc_html_e('Visit Page ↗', 'faiiya-pay'); ?>
                                        </a>
                                    <?php else : ?>
                                        &mdash;
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Settings Form -->
            <form method="post" action="options.php" style="max-width: 900px;">
                <?php settings_fields('faiiya_pay_settings_group'); ?>

                <!-- Monnify Section -->
                <h2><?php esc_html_e('Monnify Integration Credentials', 'faiiya-pay'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="faiiya_monnify_mode"><?php esc_html_e('Environment Mode', 'faiiya-pay'); ?></label></th>
                        <td>
                            <select name="faiiya_monnify_mode" id="faiiya_monnify_mode">
                                <option value="sandbox" <?php selected($mode, 'sandbox'); ?>><?php esc_html_e('Sandbox (Testing)', 'faiiya-pay'); ?></option>
                                <option value="live" <?php selected($mode, 'live'); ?>><?php esc_html_e('Live (Production)', 'faiiya-pay'); ?></option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="faiiya_monnify_api_key"><?php esc_html_e('Monnify API Key', 'faiiya-pay'); ?></label></th>
                        <td>
                            <input type="text" name="faiiya_monnify_api_key" id="faiiya_monnify_api_key" value="<?php echo esc_attr($api_key); ?>" class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="faiiya_monnify_secret_key"><?php esc_html_e('Monnify Secret Key', 'faiiya-pay'); ?></label></th>
                        <td>
                            <input type="password" name="faiiya_monnify_secret_key" id="faiiya_monnify_secret_key" value="<?php echo esc_attr($secret_key); ?>" class="regular-text" />
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="faiiya_monnify_contract_code"><?php esc_html_e('Contract Code', 'faiiya-pay'); ?></label></th>
                        <td>
                            <input type="text" name="faiiya_monnify_contract_code" id="faiiya_monnify_contract_code" value="<?php echo esc_attr($contract_code); ?>" class="regular-text" />
                        </td>
                    </tr>
                </table>

                <!-- Referral Section -->
                <h2><?php esc_html_e('Tiered Referral Engine', 'faiiya-pay'); ?></h2>
                <table class="form-table">
                    <tr>
                        <th scope="row"><?php esc_html_e('Enable Referrals', 'faiiya-pay'); ?></th>
                        <td>
                            <label>
                                <input type="checkbox" name="faiiya_referral_enabled" value="yes" <?php checked($ref_enabled, 'yes'); ?> />
                                <?php esc_html_e('Enable viral customer referral rewards', 'faiiya-pay'); ?>
                            </label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="faiiya_referral_reward_amount"><?php esc_html_e('Reward Amount (₦)', 'faiiya-pay'); ?></label></th>
                        <td>
                            <input type="number" step="50" min="0" name="faiiya_referral_reward_amount" id="faiiya_referral_reward_amount" value="<?php echo esc_attr($ref_reward); ?>" class="small-text" /> NGN
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="faiiya_referral_trigger"><?php esc_html_e('Reward Trigger', 'faiiya-pay'); ?></label></th>
                        <td>
                            <select name="faiiya_referral_trigger" id="faiiya_referral_trigger">
                                <option value="on_first_wallet_deposit" <?php selected($ref_trigger, 'on_first_wallet_deposit'); ?>><?php esc_html_e('On First Wallet Deposit (Recommended)', 'faiiya-pay'); ?></option>
                                <option value="on_registration" <?php selected($ref_trigger, 'on_registration'); ?>><?php esc_html_e('Immediately on Registration', 'faiiya-pay'); ?></option>
                            </select>
                        </td>
                    </tr>
                </table>

                <?php submit_button(__('Save Settings', 'faiiya-pay')); ?>
            </form>
        </div>
        <?php
    }
}
`
  },
  {
    path: 'includes/Admin/AdminWalletTable.php',
    name: 'AdminWalletTable.php',
    category: 'admin',
    description: 'Complete WP_List_Table subclass rendering customer balances, linked virtual accounts, and manual adjustment modal with audit trail.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay\\Admin;

use FaiiyaPay\\Models\\WalletModel;
use FaiiyaPay\\Models\\VirtualAccountModel;

defined('ABSPATH') || exit;

if (!class_exists('WP_List_Table')) {
    require_once ABSPATH . 'wp-admin/includes/class-wp-list-table.php';
}

class AdminWalletTable extends \\WP_List_Table {
    public function __construct() {
        parent::__construct([
            'singular' => __('Wallet', 'faiiya-pay'),
            'plural'   => __('Wallets', 'faiiya-pay'),
            'ajax'     => false,
        ]);
    }

    public static function init(): void {
        add_action('admin_post_faiiya_adjust_wallet', [self::class, 'handle_manual_adjustment']);
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
        $bal = (float) $item['balance'];
        return sprintf(
            '<span style="font-weight: 700; font-size: 14px; color: #059669;">₦%s</span>',
            number_format($bal, 2)
        );
    }

    public function column_status($item): string {
        $status = strtolower((string) ($item['status'] ?? 'active'));
        $color = ($status === 'active') ? '#166534' : '#991b1b';
        $bg = ($status === 'active') ? '#dcfce7' : '#fee2e2';

        return sprintf(
            '<span style="background: %s; color: %s; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">%s</span>',
            $bg,
            $color,
            esc_html($status)
        );
    }

    public function column_virtual_accounts($item): string {
        $user_id = (int) $item['user_id'];
        $va_model = new VirtualAccountModel();
        $accounts = $va_model->get_user_accounts($user_id);

        if (empty($accounts)) {
            return '<span style="color: #94a3b8; font-size: 12px;">' . esc_html__('No accounts linked', 'faiiya-pay') . '</span>';
        }

        $out = '<div style="font-size: 12px; line-height: 1.4;">';
        foreach ($accounts as $acc) {
            $out .= sprintf(
                '<div><strong>%s:</strong> <code>%s</code></div>',
                esc_html($acc['bank_name']),
                esc_html($acc['account_number'])
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
        return sprintf(
            '<button type="button" class="button button-small faiiya-open-adjust-modal" data-userid="%d" data-balance="%s">%s</button>',
            $user_id,
            esc_attr($item['balance']),
            esc_html__('Adjust Balance', 'faiiya-pay')
        );
    }

    public function prepare_items(): void {
        global $wpdb;

        $table = $wpdb->prefix . 'faiiya_wallets';
        $per_page = 20;
        $current_page = $this->get_pagenum();
        $offset = ($current_page - 1) * $per_page;

        $search = sanitize_text_field($_REQUEST['s'] ?? '');
        $where = '1=1';

        if (!empty($search)) {
            $user_ids = $wpdb->get_col(
                $wpdb->prepare(
                    "SELECT ID FROM {$wpdb->users} WHERE user_email LIKE %s OR display_name LIKE %s",
                    '%' . $wpdb->esc_like($search) . '%',
                    '%' . $wpdb->esc_like($search) . '%'
                )
            );
            if (!empty($user_ids)) {
                $in = implode(',', array_map('intval', $user_ids));
                $where = "user_id IN ({$in})";
            } else {
                $where = '0=1';
            }
        }

        $total_items = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE {$where}");

        $orderby = sanitize_sql_orderby($_REQUEST['orderby'] ?? 'updated_at');
        $order = (strtoupper($_REQUEST['order'] ?? 'DESC') === 'ASC') ? 'ASC' : 'DESC';

        $items = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE {$where} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ),
            ARRAY_A
        );

        $this->items = $items ?: [];

        $this->set_pagination_args([
            'total_items' => $total_items,
            'per_page'    => $per_page,
            'total_pages' => ceil($total_items / $per_page),
        ]);
    }

    public static function handle_manual_adjustment(): void {
        check_admin_referer('faiiya_adjust_wallet_action', 'faiiya_adjust_nonce');

        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized user capability.', 'faiiya-pay'));
        }

        $user_id = (int) ($_POST['user_id'] ?? 0);
        $type    = sanitize_text_field($_POST['adjustment_type'] ?? 'credit');
        $amount  = (float) ($_POST['amount'] ?? 0.00);
        $reason  = sanitize_text_field($_POST['reason'] ?? 'Admin manual adjustment');

        if ($user_id <= 0 || $amount <= 0) {
            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets', 'error' => 'invalid_data'], admin_url('admin.php')));
            exit;
        }

        $wallet_model = new WalletModel();
        $reference = 'ADMIN-ADJ-' . $user_id . '-' . time();

        try {
            if ($type === 'credit') {
                $wallet_model->credit($user_id, $amount, 'admin_adjustment', $reference, [
                    'admin_user_id' => get_current_user_id(),
                    'reason'        => $reason,
                ]);
            } else {
                $wallet_model->debit($user_id, $amount, 'admin_adjustment', $reference, [
                    'admin_user_id' => get_current_user_id(),
                    'reason'        => $reason,
                ]);
            }

            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets', 'adjusted' => '1'], admin_url('admin.php')));
            exit;
        } catch (\\Throwable $e) {
            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets', 'error' => urlencode($e->getMessage())], admin_url('admin.php')));
            exit;
        }
    }

    public static function render_page(): void {
        if (!current_user_can('manage_options')) {
            return;
        }

        $table = new self();
        $table->prepare_items();

        if (isset($_GET['adjusted'])) {
            echo '<div class="notice notice-success is-dismissible"><p>' . esc_html__('Wallet balance adjusted successfully.', 'faiiya-pay') . '</p></div>';
        }
        if (isset($_GET['error'])) {
            echo '<div class="notice notice-error is-dismissible"><p>' . esc_html(urldecode($_GET['error'])) . '</p></div>';
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
                            <?php esc_html_e('Query any customer wallet by User ID, Email, or Dedicated Virtual Account number to inspect balances and perform audited balance adjustments.', 'faiiya-pay'); ?>
                        </p>
                    </div>
                </div>

                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) 140px; gap: 12px; align-items: flex-end;">
                    <?php wp_nonce_field('faiiya_adjust_wallet_action', 'faiiya_adjust_nonce'); ?>
                    <input type="hidden" name="action" value="faiiya_adjust_wallet" />

                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                            <?php esc_html_e('Customer User ID / Email', 'faiiya-pay'); ?> *
                        </label>
                        <input type="text" name="user_id" required placeholder="User ID e.g. 2 or Email" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;" />
                    </div>

                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                            <?php esc_html_e('Action (Credit / Debit)', 'faiiya-pay'); ?> *
                        </label>
                        <select name="adjustment_type" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px;">
                            <option value="credit"><?php esc_html_e('+ Add Funds (Credit)', 'faiiya-pay'); ?></option>
                            <option value="debit"><?php esc_html_e('- Remove Funds (Debit)', 'faiiya-pay'); ?></option>
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

            <!-- Manual Adjustment Modal Dialog -->
            <div id="faiiya-modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 99999; align-items: center; justify-content: center;">
                <div style="background: #ffffff; border-radius: 12px; width: 420px; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
                    <h2 style="margin-top: 0;"><?php esc_html_e('Manual Balance Adjustment', 'faiiya-pay'); ?></h2>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <?php wp_nonce_field('faiiya_adjust_wallet_action', 'faiiya_adjust_nonce'); ?>
                        <input type="hidden" name="action" value="faiiya_adjust_wallet" />
                        <input type="hidden" name="user_id" id="modal-adjust-userid" value="" />

                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px;"><?php esc_html_e('Adjustment Type', 'faiiya-pay'); ?></label>
                            <select name="adjustment_type" style="width: 100%;">
                                <option value="credit"><?php esc_html_e('Credit (+) Add Money', 'faiiya-pay'); ?></option>
                                <option value="debit"><?php esc_html_e('Debit (-) Deduct Money', 'faiiya-pay'); ?></option>
                            </select>
                        </div>

                        <div style="margin-bottom: 14px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px;"><?php esc_html_e('Amount (₦)', 'faiiya-pay'); ?></label>
                            <input type="number" step="0.01" min="1" name="amount" required style="width: 100%; padding: 8px;" />
                        </div>

                        <div style="margin-bottom: 18px;">
                            <label style="display: block; font-weight: 600; margin-bottom: 4px;"><?php esc_html_e('Audit Reason / Note', 'faiiya-pay'); ?></label>
                            <textarea name="reason" required rows="3" style="width: 100%;" placeholder="<?php esc_attr_e('e.g. Manual bank deposit reconciliation', 'faiiya-pay'); ?>"></textarea>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            <button type="button" class="button" onclick="document.getElementById('faiiya-modal-backdrop').style.display='none';"><?php esc_html_e('Cancel', 'faiiya-pay'); ?></button>
                            <button type="submit" class="button button-primary"><?php esc_html_e('Execute Adjustment', 'faiiya-pay'); ?></button>
                        </div>
                    </form>
                </div>
            </div>

            <script>
            document.addEventListener('DOMContentLoaded', function() {
                var modal = document.getElementById('faiiya-modal-backdrop');
                document.querySelectorAll('.faiiya-open-adjust-modal').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var uid = this.getAttribute('data-userid');
                        document.getElementById('modal-adjust-userid').value = uid;
                        modal.style.display = 'flex';
                    });
                });
            });
            </script>
        </div>
        <?php
    }
}
`
  }
];
