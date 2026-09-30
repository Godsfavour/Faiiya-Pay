<?php
declare(strict_types=1);

namespace FaiiyaPay\Models;

defined('ABSPATH') || exit;

class ReferralModel {
    private string $table_referrals;

    public function __construct() {
        global $wpdb;
        $this->table_referrals = $wpdb->prefix . 'faiiya_referrals';
    }

    public function ensure_referral_code(int $user_id): string {
        $existing = get_user_meta($user_id, '_faiiya_referral_code', true);
        if (!empty($existing)) {
            return (string) $existing;
        }

        $code = $this->generate_unique_code();
        update_user_meta($user_id, '_faiiya_referral_code', $code);
        return $code;
    }

    private function generate_unique_code(): string {
        global $wpdb;
        do {
            $code = strtoupper(substr(bin2hex(random_bytes(6)), 0, 8));
            $exists = $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_faiiya_referral_code' AND meta_value = %s LIMIT 1",
                    $code
                )
            );
        } while (!empty($exists));

        return $code;
    }

    public function find_referrer_by_code(string $code): ?int {
        global $wpdb;
        $code = strtoupper(trim($code));
        $user_id = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key = '_faiiya_referral_code' AND meta_value = %s LIMIT 1",
                $code
            )
        );

        return $user_id ? (int) $user_id : null;
    }

    public function link_referral(int $referee_id, string $code): bool {
        global $wpdb;

        $enabled = get_option('faiiya_referral_enabled', 'yes');
        if ($enabled !== 'yes') {
            return false;
        }

        $referrer_id = $this->find_referrer_by_code($code);
        if (!$referrer_id || $referrer_id === $referee_id) {
            return false;
        }

        $already_linked = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT id FROM {$this->table_referrals} WHERE referee_id = %d LIMIT 1",
                $referee_id
            )
        );

        if ($already_linked) {
            return false;
        }

        $reward_amount = (float) get_option('faiiya_referral_reward_amount', '500.00');
        $now = current_time('mysql');

        $inserted = $wpdb->insert(
            $this->table_referrals,
            [
                'referrer_id'   => $referrer_id,
                'referee_id'    => $referee_id,
                'referral_code' => strtoupper($code),
                'reward_amount' => $reward_amount,
                'status'        => 'pending',
                'created_at'    => $now,
            ],
            ['%d', '%d', '%s', '%f', '%s', '%s']
        );

        if (!$inserted) {
            return false;
        }

        $trigger = get_option('faiiya_referral_trigger', 'on_first_wallet_deposit');
        if ($trigger === 'on_registration') {
            $this->process_reward_for_referee($referee_id, 'registration_completed');
        }

        return true;
    }

    public function process_reward_for_referee(int $referee_id, string $reason = ''): bool {
        global $wpdb;

        $referral = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$this->table_referrals} WHERE referee_id = %d AND status = 'pending' LIMIT 1",
                $referee_id
            )
        );

        if (!$referral) {
            return false;
        }

        $reward_amount = (float) $referral->reward_amount;
        $referrer_id = (int) $referral->referrer_id;
        $wallet_model = new WalletModel();
        $ref_number = 'REF-BONUS-' . $referral->id . '-' . time();

        try {
            $wallet_model->credit(
                $referrer_id,
                $reward_amount,
                'referral_bonus',
                $ref_number,
                [
                    'referral_id' => (int) $referral->id,
                    'referee_id'  => $referee_id,
                    'trigger'     => $reason,
                ]
            );

            $wpdb->update(
                $this->table_referrals,
                [
                    'status'      => 'credited',
                    'credited_at' => current_time('mysql'),
                ],
                ['id' => $referral->id],
                ['%s', '%s'],
                ['%d']
            );

            return true;
        } catch (\Throwable $e) {
            error_log('Faiiya Pay Referral Reward Error: ' . $e->getMessage());
            return false;
        }
    }

    public function get_stats(int $user_id): array {
        global $wpdb;

        $code = $this->ensure_referral_code($user_id);
        $shareable_link = home_url('/faiiya-wallet?ref=' . $code);

        $total_referred = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$this->table_referrals} WHERE referrer_id = %d", $user_id)
        );

        $successful_referrals = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM {$this->table_referrals} WHERE referrer_id = %d AND status = 'credited'", $user_id)
        );

        $total_earnings = (float) $wpdb->get_var(
            $wpdb->prepare("SELECT COALESCE(SUM(reward_amount), 0) FROM {$this->table_referrals} WHERE referrer_id = %d AND status = 'credited'", $user_id)
        );

        return [
            'referral_code'        => $code,
            'shareable_link'       => $shareable_link,
            'total_referrals'      => $total_referred,
            'successful_referrals' => $successful_referrals,
            'total_earnings'       => $total_earnings,
            'currency'             => 'NGN',
            'reward_per_referral'  => (float) get_option('faiiya_referral_reward_amount', '500.00'),
            'trigger'              => get_option('faiiya_referral_trigger', 'on_first_wallet_deposit'),
        ];
    }
}
