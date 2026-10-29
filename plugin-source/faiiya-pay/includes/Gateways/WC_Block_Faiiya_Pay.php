<?php
declare(strict_types=1);

namespace FaiiyaPay\Gateways;

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

defined('ABSPATH') || exit;

final class WC_Block_Faiiya_Pay extends AbstractPaymentMethodType {
    protected $name = 'faiiya_pay_wallet';

    public function initialize(): void {
        $this->settings = get_option('woocommerce_faiiya_pay_wallet_settings', []);
    }

    public function is_active(): bool {
        return !empty($this->settings['enabled']) && 'no' !== $this->settings['enabled'];
    }

    public function get_payment_method_script_handles(): array {
        wp_register_script(
            'wc-faiiya-pay-blocks-js',
            FAIIYA_PAY_PLUGIN_URL . 'assets/js/faiiya-checkout-blocks.js',
            ['wc-blocks-registry', 'wp-element', 'wp-html-entities', 'wp-i18n'],
            FAIIYA_PAY_VERSION,
            true
        );
        return ['wc-faiiya-pay-blocks-js'];
    }

    public function get_payment_method_data(): array {
        return [
            'title'       => $this->get_setting('title', __('Faiiya Pay Digital Wallet', 'faiiya-pay')),
            'description' => $this->get_setting('description', __('Pay instantly using your available digital wallet balance.', 'faiiya-pay')),
            'supports'    => ['products'],
        ];
    }
}
