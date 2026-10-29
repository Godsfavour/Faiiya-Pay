import { PluginFile } from '../pluginFiles';

export const coreFiles: PluginFile[] = [
  {
    path: 'faiiya-pay.php',
    name: 'faiiya-pay.php',
    category: 'core',
    description: 'Main plugin bootstrap file, headers, PSR-4 autoloader, and WooCommerce dependency validation.',
    content: `<?php
/**
 * Plugin Name:       Faiiya Pay
 * Plugin URI:        https://faiiyapay.com
 * Description:       Closed-loop digital wallet, automated Monnify virtual accounts top-up, tiered referral system, and headless REST API for WooCommerce.
 * Version:           1.0.2
 * Author:            Faiiya Fintech Engineering
 * Author URI:        https://faiiyapay.com
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       faiiya-pay
 * Domain Path:       /languages
 * Requires at least: 6.0
 * Requires PHP:      8.1
 * WC requires at least: 8.0
 */

declare(strict_types=1);

namespace FaiiyaPay;

defined('ABSPATH') || exit;

define('FAIIYA_PAY_VERSION', '1.0.2');
define('FAIIYA_PAY_PLUGIN_FILE', __FILE__);
define('FAIIYA_PAY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FAIIYA_PAY_PLUGIN_URL', plugin_dir_url(__FILE__));
define('FAIIYA_PAY_TEXT_DOMAIN', 'faiiya-pay');

/**
 * Autoloader for FaiiyaPay PSR-4 classes.
 */
spl_autoload_register(function (string $class): void {
    $prefix = 'FaiiyaPay\\\\';
    $base_dir = FAIIYA_PAY_PLUGIN_DIR . 'includes/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\\\', '/', $relative_class) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

/**
 * Activation & Deactivation hooks.
 */
register_activation_hook(__FILE__, function (): void {
    require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Activator.php';
    \\FaiiyaPay\\Activator::activate();
});

register_deactivation_hook(__FILE__, function (): void {
    require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Deactivator.php';
    \\FaiiyaPay\\Deactivator::deactivate();
});

/**
 * Declare HPOS (Custom Order Tables) & Cart/Checkout Blocks Compatibility.
 */
add_action('before_woocommerce_init', function (): void {
    if (class_exists('\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil')) {
        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility('custom_order_tables', FAIIYA_PAY_PLUGIN_FILE, true);
        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility('cart_checkout_blocks', FAIIYA_PAY_PLUGIN_FILE, true);
    }
});

/**
 * Main Plugin Bootstrap Singleton.
 */
final class Plugin {
    private static ?Plugin $instance = null;

    public static function instance(): Plugin {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->init_hooks();
    }

    private function init_hooks(): void {
        add_action('plugins_loaded', [$this, 'on_plugins_loaded']);
        add_action('init', [$this, 'on_init']);
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('user_register', [$this, 'on_user_registered'], 10, 2);
        add_action('wp_login', [$this, 'on_user_login'], 10, 2);
        add_filter('woocommerce_payment_gateways', [$this, 'register_woocommerce_gateway']);
        add_filter('woocommerce_payment_gateway_is_available', [$this, 'filter_gateway_is_available'], 10, 2);
        add_filter('woocommerce_available_payment_gateways', [$this, 'filter_available_gateways'], 9999);
        add_filter('the_content', [$this, 'filter_checkout_page_content'], 1);
        add_action('woocommerce_blocks_loaded', [$this, 'register_woocommerce_blocks_support']);
    }

    public function on_plugins_loaded(): void {
        load_plugin_textdomain(
            FAIIYA_PAY_TEXT_DOMAIN,
            false,
            dirname(plugin_basename(__FILE__)) . '/languages'
        );

        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', function (): void {
                echo '<div class="notice notice-warning is-dismissible"><p>' .
                     esc_html__('Faiiya Pay recommends WooCommerce for checkout integration, though standalone wallet & REST APIs work independently.', 'faiiya-pay') .
                     '</p></div>';
            });
        }
    }

    public function on_init(): void {
        // Automatically ensure DB tables and pages are provisioned if updated or missed during activation
        if (get_option('faiiya_pay_db_version') !== FAIIYA_PAY_VERSION) {
            require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Activator.php';
            \\FaiiyaPay\\Activator::activate();
        }

        // Auto-initialize WooCommerce options for both gateways if not present
        if (get_option('woocommerce_faiiya_pay_wallet_settings') === false) {
            update_option('woocommerce_faiiya_pay_wallet_settings', [
                'enabled'     => 'yes',
                'title'       => 'Faiiya Pay Digital Wallet',
                'description' => 'Pay instantly using your available digital wallet balance.',
            ]);
        }
        if (get_option('woocommerce_faiiya_pay_monnify_settings') === false) {
            update_option('woocommerce_faiiya_pay_monnify_settings', [
                'enabled'     => 'yes',
                'title'       => 'Debit Card / Bank Transfer / USSD (Monnify)',
                'description' => 'Pay securely with your ATM Card (Mastercard, Visa, Verve), Direct Bank Transfer, or USSD via Monnify.',
            ]);
        }

        // Auto-fix WooCommerce checkout page if it has the problematic Gutenberg block
        $checkout_page_id = (int) get_option('woocommerce_checkout_page_id', 0);
        if ($checkout_page_id > 0) {
            $checkout_post = get_post($checkout_page_id);
            if ($checkout_post && (has_block('woocommerce/checkout', $checkout_post->post_content) || strpos($checkout_post->post_content, 'wp:woocommerce/checkout') !== false)) {
                wp_update_post([
                    'ID'           => $checkout_page_id,
                    'post_content' => '<!-- wp:shortcode -->[woocommerce_checkout]<!-- /wp:shortcode -->',
                ]);
            }
        }

        // Register frontend shortcodes and WooCommerce My Account endpoints
        \\FaiiyaPay\\Frontend\\Shortcodes::init();
        \\FaiiyaPay\\Frontend\\WooCommerceAccount::init();

        if (is_admin()) {
            \\FaiiyaPay\\Admin\\AdminSettings::init();
            \\FaiiyaPay\\Admin\\AdminWalletTable::init();
        }
    }

    public function register_rest_routes(): void {
        (new \\FaiiyaPay\\API\\AuthController())->register_routes();
        (new \\FaiiyaPay\\API\\WalletController())->register_routes();
        (new \\FaiiyaPay\\API\\ReferralController())->register_routes();
        (new \\FaiiyaPay\\API\\CheckoutController())->register_routes();
        (new \\FaiiyaPay\\API\\WebhookController())->register_routes();
    }

    public function register_woocommerce_gateway(array $gateways): array {
        if (class_exists('WC_Payment_Gateway')) {
            require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Gateway_Faiiya_Pay.php';
            require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Gateway_Monnify.php';
            $gateways[] = \\FaiiyaPay\\Gateways\\WC_Gateway_Faiiya_Pay::class;
            $gateways[] = \\FaiiyaPay\\Gateways\\WC_Gateway_Monnify::class;
        }
        return $gateways;
    }

    public function filter_gateway_is_available(bool $is_available, \\WC_Payment_Gateway $gateway): bool {
        if ($gateway->id === 'faiiya_pay_wallet' || $gateway->id === 'faiiya_pay_monnify') {
            if (!isset($gateway->enabled) || ($gateway->enabled !== 'no' && $gateway->enabled !== false)) {
                return true;
            }
        }
        return $is_available;
    }

    /**
     * Force available payment gateways injection at checkout.
     * Guarantees both Faiiya Wallet and Monnify Direct are always available in WooCommerce checkout.
     */
    public function filter_available_gateways(array $available_gateways): array {
        if (!class_exists('WC_Payment_Gateway')) {
            return $available_gateways;
        }

        require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Gateway_Faiiya_Pay.php';
        require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Gateway_Monnify.php';

        if (!isset($available_gateways['faiiya_pay_wallet'])) {
            $wallet_gw = new \\FaiiyaPay\\Gateways\\WC_Gateway_Faiiya_Pay();
            if ($wallet_gw->is_available()) {
                $available_gateways['faiiya_pay_wallet'] = $wallet_gw;
            }
        }

        if (!isset($available_gateways['faiiya_pay_monnify'])) {
            $monnify_gw = new \\FaiiyaPay\\Gateways\\WC_Gateway_Monnify();
            if ($monnify_gw->is_available()) {
                $available_gateways['faiiya_pay_monnify'] = $monnify_gw;
            }
        }

        return $available_gateways;
    }

    /**
     * Seamlessly renders Classic Checkout Shortcode if the Checkout page contains Gutenberg Checkout Blocks.
     * Gutenberg Checkout Blocks lack support for standard PHP payment gateways and cause "no payment methods available".
     */
    public function filter_checkout_page_content(string $content): string {
        if (function_exists('is_checkout') && is_checkout() && !is_order_received_page()) {
            if (has_block('woocommerce/checkout', $content) || strpos($content, 'wp:woocommerce/checkout') !== false) {
                return do_shortcode('[woocommerce_checkout]');
            }
        }
        return $content;
    }

    /**
     * Registers WooCommerce Blocks Client Script Support for environments retaining the Checkout Block.
     */
    public function register_woocommerce_blocks_support(): void {
        if (!class_exists('\\Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType')) {
            return;
        }

        require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Block_Faiiya_Pay.php';
        require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Block_Monnify.php';

        add_action(
            'woocommerce_blocks_payment_method_type_registration',
            function (\\Automattic\\WooCommerce\\Blocks\\Payments\\PaymentMethodRegistry $registry): void {
                $registry->register(new \\FaiiyaPay\\Gateways\\WC_Block_Faiiya_Pay());
                $registry->register(new \\FaiiyaPay\\Gateways\\WC_Block_Monnify());
            }
        );
    }

    public function on_user_registered(int $user_id, array $userdata = []): void {
        $wallet_model = new \\FaiiyaPay\\Models\\WalletModel();
        $wallet_model->ensure_wallet_exists($user_id);

        $referral_model = new \\FaiiyaPay\\Models\\ReferralModel();
        $referral_model->ensure_referral_code($user_id);

        $ref_code = sanitize_text_field($_REQUEST['referral_code'] ?? $_COOKIE['faiiya_ref'] ?? '');
        if (!empty($ref_code)) {
            $referral_model->link_referral($user_id, $ref_code);
        }
    }

    /**
     * Automatic Monnify Balance Sync on User Login:
     * When any user logs in, automatically sync their dedicated Monnify transactions.
     * Guarantees funds sent while offline or delayed webhooks are credited immediately upon login.
     */
    public function on_user_login(string $user_login, \\WP_User $user): void {
        try {
            $user_id = (int) $user->ID;
            if ($user_id > 0) {
                $monnify_service = new \\FaiiyaPay\\Services\\MonnifyService();
                if ($monnify_service->is_configured()) {
                    $monnify_service->sync_customer_reserved_transactions($user_id);
                }
            }
        } catch (\\Throwable $e) {
            // Fail silent during login
        }
    }
}

// Bootstrap
Plugin::instance();`
  },
  {
    path: 'includes/Activator.php',
    name: 'Activator.php',
    category: 'core',
    description: 'Custom database creation using dbDelta() and automatic creation of essential WordPress pages (My Wallet, Referrals, Top-Up).',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay;

defined('ABSPATH') || exit;

class Activator {
    public static function activate(): void {
        self::create_tables();
        self::set_default_options();
        self::create_default_pages();
        self::fix_woocommerce_checkout();
        update_option('faiiya_pay_db_version', FAIIYA_PAY_VERSION);
        flush_rewrite_rules();
    }

    public static function fix_woocommerce_checkout(): void {
        if (get_option('woocommerce_faiiya_pay_wallet_settings') === false) {
            update_option('woocommerce_faiiya_pay_wallet_settings', [
                'enabled'     => 'yes',
                'title'       => 'Faiiya Pay Digital Wallet',
                'description' => 'Pay instantly using your available digital wallet balance.',
            ]);
        }
        if (get_option('woocommerce_faiiya_pay_monnify_settings') === false) {
            update_option('woocommerce_faiiya_pay_monnify_settings', [
                'enabled'     => 'yes',
                'title'       => 'Debit Card / Bank Transfer / USSD (Monnify)',
                'description' => 'Pay securely with your ATM Card (Mastercard, Visa, Verve), Direct Bank Transfer, or USSD via Monnify.',
            ]);
        }

        $checkout_page_id = (int) get_option('woocommerce_checkout_page_id', 0);
        if ($checkout_page_id > 0) {
            $checkout_post = get_post($checkout_page_id);
            if ($checkout_post && (has_block('woocommerce/checkout', $checkout_post->post_content) || strpos($checkout_post->post_content, 'wp:woocommerce/checkout') !== false)) {
                wp_update_post([
                    'ID'           => $checkout_page_id,
                    'post_content' => '<!-- wp:shortcode -->[woocommerce_checkout]<!-- /wp:shortcode -->',
                ]);
            }
        }
    }

    public static function create_tables(): void {
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

        // De-duplicate wp_faiiya_wallets so each user has strictly ONE row
        $wpdb->query("DELETE w1 FROM {$table_wallets} w1 INNER JOIN {$table_wallets} w2 WHERE w1.user_id = w2.user_id AND w1.id < w2.id");

        // Guarantee UNIQUE KEY on user_id directly via ALTER TABLE
        $has_uk = $wpdb->get_var("SHOW INDEX FROM {$table_wallets} WHERE Key_name = 'uk_user_id'");
        if (!$has_uk) {
            $wpdb->query("ALTER TABLE {$table_wallets} ADD UNIQUE KEY uk_user_id (user_id)");
        }

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
`
  },
  {
    path: 'includes/Deactivator.php',
    name: 'Deactivator.php',
    category: 'core',
    description: 'Clean deactivation, flushes rewrite rules and clears cached transients.',
    content: `<?php
declare(strict_types=1);

namespace FaiiyaPay;

defined('ABSPATH') || exit;

class Deactivator {
    public static function deactivate(): void {
        flush_rewrite_rules();
        delete_transient('faiiya_monnify_access_token');
    }
}
`
  }
];
