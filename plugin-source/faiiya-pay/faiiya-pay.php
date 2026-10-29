<?php
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
    $prefix = 'FaiiyaPay\\';
    $base_dir = FAIIYA_PAY_PLUGIN_DIR . 'includes/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

/**
 * Activation & Deactivation hooks.
 */
register_activation_hook(__FILE__, function (): void {
    require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Activator.php';
    \FaiiyaPay\Activator::activate();
});

register_deactivation_hook(__FILE__, function (): void {
    require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Deactivator.php';
    \FaiiyaPay\Deactivator::deactivate();
});

/**
 * Declare HPOS (Custom Order Tables) & Cart/Checkout Blocks Compatibility.
 */
add_action('before_woocommerce_init', function (): void {
    if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', FAIIYA_PAY_PLUGIN_FILE, true);
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', FAIIYA_PAY_PLUGIN_FILE, true);
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
            \FaiiyaPay\Activator::activate();
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
        \FaiiyaPay\Frontend\Shortcodes::init();
        \FaiiyaPay\Frontend\WooCommerceAccount::init();

        if (is_admin()) {
            \FaiiyaPay\Admin\AdminSettings::init();
            \FaiiyaPay\Admin\AdminWalletTable::init();
        }
    }

    public function register_rest_routes(): void {
        (new \FaiiyaPay\API\AuthController())->register_routes();
        (new \FaiiyaPay\API\WalletController())->register_routes();
        (new \FaiiyaPay\API\ReferralController())->register_routes();
        (new \FaiiyaPay\API\CheckoutController())->register_routes();
        (new \FaiiyaPay\API\WebhookController())->register_routes();
    }

    public function register_woocommerce_gateway(array $gateways): array {
        if (class_exists('WC_Payment_Gateway')) {
            require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Gateway_Faiiya_Pay.php';
            require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Gateway_Monnify.php';
            $gateways[] = \FaiiyaPay\Gateways\WC_Gateway_Faiiya_Pay::class;
            $gateways[] = \FaiiyaPay\Gateways\WC_Gateway_Monnify::class;
        }
        return $gateways;
    }

    public function filter_gateway_is_available(bool $is_available, \WC_Payment_Gateway $gateway): bool {
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
            $wallet_gw = new \FaiiyaPay\Gateways\WC_Gateway_Faiiya_Pay();
            if ($wallet_gw->is_available()) {
                $available_gateways['faiiya_pay_wallet'] = $wallet_gw;
            }
        }

        if (!isset($available_gateways['faiiya_pay_monnify'])) {
            $monnify_gw = new \FaiiyaPay\Gateways\WC_Gateway_Monnify();
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
        if (!class_exists('\Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType')) {
            return;
        }

        require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Block_Faiiya_Pay.php';
        require_once FAIIYA_PAY_PLUGIN_DIR . 'includes/Gateways/WC_Block_Monnify.php';

        add_action(
            'woocommerce_blocks_payment_method_type_registration',
            function (\Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry $registry): void {
                $registry->register(new \FaiiyaPay\Gateways\WC_Block_Faiiya_Pay());
                $registry->register(new \FaiiyaPay\Gateways\WC_Block_Monnify());
            }
        );
    }

    public function on_user_registered(int $user_id, array $userdata = []): void {
        $wallet_model = new \FaiiyaPay\Models\WalletModel();
        $wallet_model->ensure_wallet_exists($user_id);

        $referral_model = new \FaiiyaPay\Models\ReferralModel();
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
    public function on_user_login(string $user_login, \WP_User $user): void {
        try {
            $user_id = (int) $user->ID;
            if ($user_id > 0) {
                $monnify_service = new \FaiiyaPay\Services\MonnifyService();
                if ($monnify_service->is_configured()) {
                    $monnify_service->sync_customer_reserved_transactions($user_id);
                }
            }
        } catch (\Throwable $e) {
            // Fail silent during login
        }
    }
}

// Bootstrap
Plugin::instance();