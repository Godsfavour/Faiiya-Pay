<?php
declare(strict_types=1);

namespace FaiiyaPay\API;

use FaiiyaPay\Models\ReferralModel;

defined('ABSPATH') || exit;

class ReferralController extends RestControllerBase {
    public function register_routes(): void {
        register_rest_route($this->namespace, '/referrals/stats', [
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => [$this, 'get_stats'],
            'permission_callback' => [$this, 'check_user_permission'],
        ]);
    }

    public function get_stats(\WP_REST_Request $request): \WP_REST_Response {
        $user_id = get_current_user_id();

        $referral_model = new ReferralModel();
        $stats = $referral_model->get_stats($user_id);

        return $this->success($stats);
    }
}
