<?php
declare(strict_types=1);

namespace FaiiyaPay;

defined('ABSPATH') || exit;

class Deactivator {
    public static function deactivate(): void {
        flush_rewrite_rules();
        delete_transient('faiiya_monnify_access_token');
    }
}
