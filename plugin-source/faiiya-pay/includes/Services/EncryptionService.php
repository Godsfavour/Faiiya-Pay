<?php
declare(strict_types=1);

namespace FaiiyaPay\Services;

defined('ABSPATH') || exit;

class EncryptionService {
    private const CIPHER = 'AES-256-CBC';

    private static function get_key(): string {
        $salt = defined('SECURE_AUTH_KEY') ? SECURE_AUTH_KEY : 'faiiya_pay_fallback_secure_salt_key_32b';
        return hash('sha256', $salt, true);
    }

    public static function encrypt(string $plain_text): string {
        if (empty($plain_text)) {
            return '';
        }

        $key = self::get_key();
        $iv_length = openssl_cipher_iv_length(self::CIPHER);
        $iv = openssl_random_pseudo_bytes($iv_length);

        $ciphertext = openssl_encrypt($plain_text, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        if ($ciphertext === false) {
            throw new \RuntimeException('Encryption failed.');
        }

        $hmac = hash_hmac('sha256', $iv . $ciphertext, $key, true);
        return base64_encode($iv . $hmac . $ciphertext);
    }

    public static function decrypt(string $payload): ?string {
        if (empty($payload)) {
            return null;
        }

        $raw = base64_decode($payload, true);
        if ($raw === false) {
            return null;
        }

        $key = self::get_key();
        $iv_length = openssl_cipher_iv_length(self::CIPHER);
        $hmac_length = 32;

        if (strlen($raw) < ($iv_length + $hmac_length)) {
            return null;
        }

        $iv = substr($raw, 0, $iv_length);
        $hmac = substr($raw, $iv_length, $hmac_length);
        $ciphertext = substr($raw, $iv_length + $hmac_length);

        $expected_hmac = hash_hmac('sha256', $iv . $ciphertext, $key, true);
        if (!hash_equals($hmac, $expected_hmac)) {
            return null;
        }

        $decrypted = openssl_decrypt($ciphertext, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv);
        return $decrypted !== false ? $decrypted : null;
    }

    public static function mask(string $plain_text): string {
        $len = strlen($plain_text);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }
        return str_repeat('*', $len - 4) . substr($plain_text, -4);
    }
}
