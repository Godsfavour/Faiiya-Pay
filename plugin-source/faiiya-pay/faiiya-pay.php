<?php
/**
 * Plugin Name:       Faiiya Pay
 * Plugin URI:        https://faiiyapay.com
 * Description:       Closed-loop digital wallet, automated Monnify virtual accounts top-up, tiered referral system, and headless REST API for WooCommerce.
 * Version:           1.0.0
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

define('FAIIYA_PAY_VERSION', '1.0.0');
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
        add_filter('woocommerce_payment_gateways', [$this, 'register_woocommerce_gateway']);
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
            $gateways[] = \FaiiyaPay\Gateways\WC_Gateway_Faiiya_Pay::class;
        }
        return $gateways;
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
}

// Bootstrap
Plugin::instance();