<?php
declare(strict_types=1);

namespace FaiiyaPay\Frontend;

defined('ABSPATH') || exit;

class WooCommerceAccount {
    public static function init(): void {
        if (!class_exists('WooCommerce')) {
            return;
        }

        if (did_action('init')) {
            self::add_endpoints();
        } else {
            add_action('init', [self::class, 'add_endpoints']);
        }
        add_filter('woocommerce_account_menu_items', [self::class, 'add_menu_items']);
        add_action('woocommerce_account_faiiya-wallet_endpoint', [self::class, 'wallet_content']);
        add_action('woocommerce_account_faiiya-referrals_endpoint', [self::class, 'referrals_content']);
    }

    public static function add_endpoints(): void {
        add_rewrite_endpoint('faiiya-wallet', EP_ROOT | EP_PAGES);
        add_rewrite_endpoint('faiiya-referrals', EP_ROOT | EP_PAGES);
    }

    public static function add_menu_items(array $items): array {
        $new_items = [];
        foreach ($items as $key => $title) {
            $new_items[$key] = $title;
            if ($key === 'orders') {
                $new_items['faiiya-wallet'] = __('My Wallet (Faiiya)', 'faiiya-pay');
                $new_items['faiiya-referrals'] = __('Referrals & Rewards', 'faiiya-pay');
            }
        }
        return $new_items;
    }

    public static function wallet_content(): void {
        echo do_shortcode('[faiiya_wallet]');
    }

    public static function referrals_content(): void {
        echo do_shortcode('[faiiya_referrals]');
    }
}
