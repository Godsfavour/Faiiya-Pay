<?php
declare(strict_types=1);

namespace FaiiyaPay\Admin;

use FaiiyaPay\Activator;

defined('ABSPATH') || exit;

class AdminSettings {
    public static function init(): void {
        add_action('admin_menu', [self::class, 'add_menu_pages']);
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('admin_post_faiiya_regenerate_pages', [self::class, 'handle_regenerate_pages']);
        add_action('admin_post_faiiya_test_monnify_connection', [self::class, 'handle_test_monnify_connection']);
        add_action('admin_post_faiiya_sync_user_deposits', [self::class, 'handle_sync_user_deposits']);
        add_action('admin_post_faiiya_convert_checkout_classic', [self::class, 'handle_convert_checkout']);
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
        register_setting('faiiya_pay_settings_group', 'faiiya_monnify_wallet_account_number', ['sanitize_callback' => 'sanitize_text_field']);
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

    public static function handle_test_monnify_connection(): void {
        check_admin_referer('faiiya_test_monnify_action', 'faiiya_test_nonce');
        if (!current_user_can('manage_options')) {
            wp_die(__('Permission denied', 'faiiya-pay'));
        }

        $monnify_service = new \FaiiyaPay\Services\MonnifyService();
        $test_result = $monnify_service->test_connection();

        set_transient('faiiya_monnify_test_result', $test_result, 60);
        wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-settings', 'test_run' => '1'], admin_url('admin.php')));
        exit;
    }

    public static function handle_sync_user_deposits(): void {
        check_admin_referer('faiiya_sync_deposits_action', 'faiiya_sync_nonce');
        if (!current_user_can('manage_options')) {
            wp_die(__('Permission denied', 'faiiya-pay'));
        }

        $user_id = (int) ($_REQUEST['user_id'] ?? 0);
        if ($user_id <= 0) {
            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets', 'error' => urlencode(__('Invalid User ID for synchronization.', 'faiiya-pay'))], admin_url('admin.php')));
            exit;
        }

        try {
            $monnify_service = new \FaiiyaPay\Services\MonnifyService();
            $sync_result = $monnify_service->sync_customer_reserved_transactions($user_id);

            set_transient('faiiya_sync_result_' . $user_id, $sync_result, 60);
            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets', 'synced_user' => $user_id], admin_url('admin.php')));
            exit;
        } catch (\Throwable $e) {
            $error_data = [
                'success' => false,
                'message' => __('Monnify Sync Error: ', 'faiiya-pay') . $e->getMessage(),
            ];
            set_transient('faiiya_sync_result_' . $user_id, $error_data, 60);
            wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-wallets', 'synced_user' => $user_id], admin_url('admin.php')));
            exit;
        }
    }

    public static function handle_convert_checkout(): void {
        check_admin_referer('faiiya_convert_checkout_action', 'faiiya_convert_nonce');
        if (!current_user_can('manage_options')) {
            wp_die(__('Permission denied', 'faiiya-pay'));
        }

        $checkout_page_id = (int) get_option('woocommerce_checkout_page_id', 0);
        if ($checkout_page_id > 0) {
            wp_update_post([
                'ID'           => $checkout_page_id,
                'post_content' => '<!-- wp:shortcode -->[woocommerce_checkout]<!-- /wp:shortcode -->',
            ]);
        }

        update_option('woocommerce_faiiya_pay_wallet_settings', [
            'enabled'     => 'yes',
            'title'       => 'Faiiya Pay Digital Wallet',
            'description' => 'Pay instantly using your available digital wallet balance.',
        ]);
        update_option('woocommerce_faiiya_pay_monnify_settings', [
            'enabled'     => 'yes',
            'title'       => 'Debit Card / Bank Transfer / USSD (Monnify)',
            'description' => 'Pay securely with your ATM Card (Mastercard, Visa, Verve), Direct Bank Transfer, or USSD via Monnify.',
        ]);

        wp_safe_redirect(add_query_arg(['page' => 'faiiya-pay-settings', 'checkout_converted' => '1'], admin_url('admin.php')));
        exit;
    }

    public static function render_settings_page(): void {
        if (!current_user_can('manage_options')) {
            return;
        }

        global $wpdb;
        $webhook_url = rest_url('faiiya/v1/webhook/monnify');
        $mode = get_option('faiiya_monnify_mode', 'sandbox');
        $api_key = get_option('faiiya_monnify_api_key', '');
        $secret_key = get_option('faiiya_monnify_secret_key', '');
        $contract_code = get_option('faiiya_monnify_contract_code', '');
        $wallet_account_number = get_option('faiiya_monnify_wallet_account_number', '');
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

        if (isset($_GET['checkout_converted'])) {
            echo '<div class="notice notice-success is-dismissible"><p><strong>✅ ' . esc_html__('WooCommerce Checkout page successfully converted to Classic Shortcode [woocommerce_checkout] and payment gateways re-verified.', 'faiiya-pay') . '</strong></p></div>';
        }

        if (isset($_GET['test_run'])) {
            $test_result = get_transient('faiiya_monnify_test_result');
            if ($test_result) {
                $is_ok = !empty($test_result['success']);
                $class = $is_ok ? 'notice notice-success' : 'notice notice-error';
                echo '<div class="' . esc_attr($class) . ' is-dismissible"><p><strong>' . ($is_ok ? '✅ ' : '❌ ') . esc_html($test_result['message']) . '</strong></p></div>';
            }
        }

        $table_webhook_logs = $wpdb->prefix . 'faiiya_webhook_logs';
        $recent_logs = $wpdb->get_results("SELECT * FROM {$table_webhook_logs} ORDER BY id DESC LIMIT 20", ARRAY_A);
        ?>
        <div class="wrap faiiya-pay-admin">
            <h1><?php esc_html_e('Faiiya Pay Settings & Monnify Diagnostics', 'faiiya-pay'); ?></h1>

            <!-- Webhook Notice & Diagnostic Guide -->
            <div class="notice notice-info" style="margin: 20px 0; padding: 18px 22px; border-left-color: #059669; background: #f0fdf4;">
                <p style="margin: 0; font-size: 14px; color: #166534;">
                    <strong><?php esc_html_e('Monnify Webhook URL:', 'faiiya-pay'); ?></strong>
                    <code style="background: #ffffff; padding: 5px 10px; border-radius: 4px; font-weight: 700; border: 1px solid #bbf7d0; margin-left: 6px; font-size: 13px;"><?php echo esc_url($webhook_url); ?></code>
                </p>
                <p style="margin: 8px 0 12px 0; color: #15803d; font-size: 13px;">
                    <?php esc_html_e('Crucial: You MUST paste this exact Webhook URL into your Monnify Merchant Dashboard (Settings > Developers > Webhook URL). Without this step, Monnify cannot notify your website when bank transfers arrive.', 'faiiya-pay'); ?>
                </p>

                <div style="background: #ffffff; border: 1px solid #d1fae5; border-radius: 8px; padding: 14px; margin-top: 10px;">
                    <strong style="color: #065f46; font-size: 13px; display: block; margin-bottom: 8px;"><?php esc_html_e('Monnify Webhooks Setup & Triage Checklist:', 'faiiya-pay'); ?></strong>
                    <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #374151; line-height: 1.7;">
                        <li>1️⃣ <strong><?php esc_html_e('Configure Webhook in Monnify', 'faiiya-pay'); ?></strong>: <?php esc_html_e('Login to Monnify Dashboard (app.monnify.com or sandbox.monnify.com) > Settings > Developers > paste the URL above.', 'faiiya-pay'); ?></li>
                        <li>2️⃣ <strong><?php esc_html_e('Transaction Completion (SUCCESSFUL_TRANSACTION)', 'faiiya-pay'); ?></strong>: <?php esc_html_e('REQUIRED - Instant automatic wallet top-up when customer transfers money to their virtual account.', 'faiiya-pay'); ?></li>
                        <li>3️⃣ <strong><?php esc_html_e('Disbursement Notification', 'faiiya-pay'); ?></strong>: <?php esc_html_e('REQUIRED - Updates bank withdrawal status when money is sent out to customer bank accounts.', 'faiiya-pay'); ?></li>
                        <li>4️⃣ <strong><?php esc_html_e('Localhost Note', 'faiiya-pay'); ?></strong>: <?php esc_html_e('If testing on a local machine (localhost), Monnify cannot reach your private IP. Use a public domain, staging server, or ngrok tunnel.', 'faiiya-pay'); ?></li>
                    </ul>
                </div>
            </div>

            <!-- Inbound Webhook Activity Logs Table (Live Diagnostic Inspector) -->
            <div class="card" style="max-width: 900px; margin-bottom: 24px; padding: 18px 24px;">
                <h2 style="margin: 0 0 6px 0; font-size: 18px; display: flex; align-items: center; justify-content: space-between;">
                    <span><?php esc_html_e('Inbound Monnify Webhook Activity Log', 'faiiya-pay'); ?></span>
                    <span style="font-size: 12px; font-weight: normal; color: #64748b;"><?php printf(esc_html__('Showing latest %d events', 'faiiya-pay'), count($recent_logs)); ?></span>
                </h2>
                <p style="margin: 0 0 14px 0; color: #64748b; font-size: 13px;">
                    <?php esc_html_e('Live inspector of webhook requests received by this website from Monnify. If this list is empty after making a bank transfer, Monnify has not delivered any webhook to your website.', 'faiiya-pay'); ?>
                </p>

                <?php if (empty($recent_logs)) : ?>
                    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px 18px; color: #92400e; font-size: 13px;">
                        <strong>⚠️ <?php esc_html_e('No webhooks have been received by your website yet.', 'faiiya-pay'); ?></strong><br />
                        <?php esc_html_e('If a payment reflected on your Monnify dashboard but not in the wallet:', 'faiiya-pay'); ?>
                        <ol style="margin: 8px 0 0 0; padding-left: 20px;">
                            <li><?php esc_html_e('Check that the Webhook URL above is pasted into your Monnify dashboard developer settings.', 'faiiya-pay'); ?></li>
                            <li><?php esc_html_e('Ensure your web host or firewall (Cloudflare/Wordfence) is not blocking POST requests to /wp-json/faiiya/v1/webhook/monnify.', 'faiiya-pay'); ?></li>
                            <li><?php esc_html_e('You can click "Sync Deposits" on any customer in Customer Wallets to immediately credit missing transfers via Monnify API.', 'faiiya-pay'); ?></li>
                        </ol>
                    </div>
                <?php else : ?>
                    <div style="overflow-x: auto;">
                        <table class="widefat striped" style="margin-top: 8px; font-size: 12px;">
                            <thead>
                                <tr>
                                    <th><?php esc_html_e('Date/Time', 'faiiya-pay'); ?></th>
                                    <th><?php esc_html_e('Event Type', 'faiiya-pay'); ?></th>
                                    <th><?php esc_html_e('Transaction Reference', 'faiiya-pay'); ?></th>
                                    <th><?php esc_html_e('Processing Status', 'faiiya-pay'); ?></th>
                                    <th><?php esc_html_e('Payload Inspector', 'faiiya-pay'); ?></th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($recent_logs as $log) : 
                                    $status = $log['processed_status'] ?? 'unknown';
                                    $is_success = ($status === 'processed');
                                    $is_failed = strpos($status, 'failed') !== false;
                                    $status_color = $is_success ? '#166534' : ($is_failed ? '#dc2626' : '#64748b');
                                    $status_bg = $is_success ? '#dcfce7' : ($is_failed ? '#fee2e2' : '#f1f5f9');
                                ?>
                                    <tr>
                                        <td><?php echo esc_html(date_i18n('M j, Y H:i:s', strtotime($log['created_at']))); ?></td>
                                        <td><strong><code><?php echo esc_html($log['event_type']); ?></code></strong></td>
                                        <td><code style="font-size: 11px;"><?php echo esc_html($log['transaction_reference']); ?></code></td>
                                        <td>
                                            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 11px; background: <?php echo esc_attr($status_bg); ?>; color: <?php echo esc_attr($status_color); ?>;">
                                                <?php echo esc_html(strtoupper($status)); ?>
                                            </span>
                                        </td>
                                        <td>
                                            <details>
                                                <summary style="cursor: pointer; color: #0284c7; font-weight: 600;"><?php esc_html_e('View JSON', 'faiiya-pay'); ?></summary>
                                                <pre style="background: #0f172a; color: #38bdf8; padding: 8px; border-radius: 6px; font-size: 10px; max-height: 200px; overflow-y: auto; margin-top: 6px;"><?php echo esc_html($log['payload']); ?></pre>
                                            </details>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>
            </div>

            <!-- WooCommerce Payment Gateways Diagnostic Card -->
            <div class="card" style="max-width: 900px; margin-bottom: 24px; padding: 18px 24px; border-left: 4px solid #7c3aed;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px; color: #1e1b4b;"><?php esc_html_e('WooCommerce Checkout & Payment Gateways', 'faiiya-pay'); ?></h2>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">
                            <?php esc_html_e('Manage how customers pay during WooCommerce store checkout. Two gateways are provided.', 'faiiya-pay'); ?>
                        </p>
                    </div>
                    <?php if (function_exists('admin_url')) : ?>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=wc-settings&tab=checkout')); ?>" class="button button-primary" style="background: #7c3aed; border-color: #6d28d9;">
                            ⚙️ <?php esc_html_e('Open WooCommerce Payments Settings ↗', 'faiiya-pay'); ?>
                        </a>
                    <?php endif; ?>
                </div>

                <table class="widefat striped" style="margin-top: 10px; font-size: 13px;">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Payment Gateway', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('Gateway ID', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('Target Audience', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('Status', 'faiiya-pay'); ?></th>
                            <th><?php esc_html_e('Action', 'faiiya-pay'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        $wallet_gw_settings = get_option('woocommerce_faiiya_pay_wallet_settings', []);
                        $monnify_gw_settings = get_option('woocommerce_faiiya_pay_monnify_settings', []);

                        $wallet_enabled = ($wallet_gw_settings['enabled'] ?? 'yes') === 'yes';
                        $monnify_enabled = ($monnify_gw_settings['enabled'] ?? 'yes') === 'yes';
                        ?>
                        <tr>
                            <td>
                                <strong>💳 <?php esc_html_e('Faiiya Pay Digital Wallet', 'faiiya-pay'); ?></strong>
                                <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;"><?php esc_html_e('Allows registered customers to pay with 1-click using their deposited wallet balance.', 'faiiya-pay'); ?></p>
                            </td>
                            <td><code>faiiya_pay_wallet</code></td>
                            <td><?php esc_html_e('Registered Users with Balance', 'faiiya-pay'); ?></td>
                            <td>
                                <?php if ($wallet_enabled) : ?>
                                    <span style="color: #059669; font-weight: 700;">✅ <?php esc_html_e('Enabled', 'faiiya-pay'); ?></span>
                                <?php else : ?>
                                    <span style="color: #dc2626; font-weight: 700;">❌ <?php esc_html_e('Disabled', 'faiiya-pay'); ?></span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <a href="<?php echo esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=faiiya_pay_wallet')); ?>" class="button button-small">
                                    <?php esc_html_e('Configure', 'faiiya-pay'); ?>
                                </a>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <strong>🏦 <?php esc_html_e('Monnify Direct (Cards, Bank Transfer, USSD)', 'faiiya-pay'); ?></strong>
                                <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;"><?php esc_html_e('Allows ANY customer (guest or registered) to pay with Mastercard/Visa/Verve ATM card, direct bank transfer, or USSD.', 'faiiya-pay'); ?></p>
                            </td>
                            <td><code>faiiya_pay_monnify</code></td>
                            <td><?php esc_html_e('All Shoppers & Guests', 'faiiya-pay'); ?></td>
                            <td>
                                <?php if ($monnify_enabled) : ?>
                                    <span style="color: #059669; font-weight: 700;">✅ <?php esc_html_e('Enabled', 'faiiya-pay'); ?></span>
                                <?php else : ?>
                                    <span style="color: #dc2626; font-weight: 700;">❌ <?php esc_html_e('Disabled', 'faiiya-pay'); ?></span>
                                <?php endif; ?>
                            </td>
                            <td>
                                <a href="<?php echo esc_url(admin_url('admin.php?page=wc-settings&tab=checkout&section=faiiya_pay_monnify')); ?>" class="button button-small">
                                    <?php esc_html_e('Configure', 'faiiya-pay'); ?>
                                </a>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <?php
                $checkout_page_id = (int) get_option('woocommerce_checkout_page_id', 0);
                $checkout_post = $checkout_page_id > 0 ? get_post($checkout_page_id) : null;
                $is_block_checkout = $checkout_post && (has_block('woocommerce/checkout', $checkout_post->post_content) || strpos($checkout_post->post_content, 'wp:woocommerce/checkout') !== false);
                ?>

                <?php if ($is_block_checkout) : ?>
                    <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 14px 18px; margin-top: 14px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                            <div style="max-width: 620px;">
                                <strong style="color: #9f1239; font-size: 13px; display: block; margin-bottom: 4px;">⚠️ <?php esc_html_e('Detected: WooCommerce Gutenberg Checkout Block in Use', 'faiiya-pay'); ?></strong>
                                <p style="margin: 0; color: #be123c; font-size: 12px; line-height: 1.5;">
                                    <?php esc_html_e('WooCommerce 8+ Gutenberg Checkout Blocks ignore standard PHP payment gateways, causing the error "There are no payment methods available. Please contact us for help placing your order." Click the button on the right to convert the checkout page to the Classic Shortcode [woocommerce_checkout] which guarantees all payment gateways appear.', 'faiiya-pay'); ?>
                                </p>
                            </div>
                            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                                <?php wp_nonce_field('faiiya_convert_checkout_action', 'faiiya_convert_nonce'); ?>
                                <input type="hidden" name="action" value="faiiya_convert_checkout_classic" />
                                <button type="submit" class="button button-primary" style="background: #e11d48; border-color: #be123c; font-weight: 700; padding: 4px 14px;">
                                    ⚡ <?php esc_html_e('Fix: Switch to Classic Checkout Shortcode', 'faiiya-pay'); ?>
                                </button>
                            </form>
                        </div>
                    </div>
                <?php else : ?>
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 14px; margin-top: 14px; font-size: 12px; color: #166534;">
                        ✅ <strong><?php esc_html_e('Checkout Page Ready', 'faiiya-pay'); ?>:</strong> <?php esc_html_e('Your store is configured with the classic shortcode [woocommerce_checkout]. All registered payment gateways will be displayed at checkout.', 'faiiya-pay'); ?>
                    </div>
                <?php endif; ?>

                <div style="margin-top: 14px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #581c87;">
                    <strong>💡 <?php esc_html_e('Why did checkout say "There are no payment methods available"?', 'faiiya-pay'); ?></strong>
                    <p style="margin: 4px 0 0 0; line-height: 1.5;">
                        <?php esc_html_e('In WooCommerce 8.0+, the default Gutenberg Checkout Block hides all traditional payment methods unless they have a custom React integration or the page uses the classic shortcode. Faiiya Pay now includes both: automatic filter injection at checkout, block script registration, and an automatic fallback so your payment options are never suppressed.', 'faiiya-pay'); ?>
                    </p>
                </div>
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
            <div class="card" style="max-width: 900px; padding: 18px 24px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
                    <div>
                        <h2 style="margin: 0; font-size: 18px;"><?php esc_html_e('Monnify Integration Credentials', 'faiiya-pay'); ?></h2>
                        <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">
                            <?php esc_html_e('Connect your Monnify merchant account to generate virtual bank accounts and receive automated deposits.', 'faiiya-pay'); ?>
                        </p>
                    </div>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <?php wp_nonce_field('faiiya_test_monnify_action', 'faiiya_test_nonce'); ?>
                        <input type="hidden" name="action" value="faiiya_test_monnify_connection" />
                        <button type="submit" class="button button-primary" style="background: #059669; border-color: #047857;">
                            🔌 <?php esc_html_e('Test Monnify API Connection', 'faiiya-pay'); ?>
                        </button>
                    </form>
                </div>

                <form method="post" action="options.php">
                    <?php settings_fields('faiiya_pay_settings_group'); ?>

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
                        <tr>
                            <th scope="row"><label for="faiiya_monnify_wallet_account_number"><?php esc_html_e('Monnify Wallet Account Number', 'faiiya-pay'); ?></label></th>
                            <td>
                                <input type="text" name="faiiya_monnify_wallet_account_number" id="faiiya_monnify_wallet_account_number" value="<?php echo esc_attr($wallet_account_number); ?>" class="regular-text" placeholder="e.g. 1042026202" />
                                <p class="description"><?php esc_html_e('Parent Monnify digital wallet account number (from Monnify Dashboard > Wallets). Used for digital wallet statements and automated disbursement withdrawals.', 'faiiya-pay'); ?></p>
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
        </div>
        <?php
    }
}
