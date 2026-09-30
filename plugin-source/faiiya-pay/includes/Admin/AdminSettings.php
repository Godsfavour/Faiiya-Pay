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
