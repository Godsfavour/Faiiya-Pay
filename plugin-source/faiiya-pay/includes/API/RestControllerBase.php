<?php
declare(strict_types=1);

namespace FaiiyaPay\API;

defined('ABSPATH') || exit;

abstract class RestControllerBase {
    protected string $namespace = 'faiiya/v1';

    abstract public function register_routes(): void;

    public function check_user_permission(\WP_REST_Request $request): bool|\WP_Error {
        if (is_user_logged_in()) {
            return true;
        }

        $auth_header = $request->get_header('authorization');
        if (!empty($auth_header) && preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
            $user_id = apply_filters('faiiya_authenticate_bearer_token', 0, $matches[1]);
            if ($user_id > 0) {
                wp_set_current_user($user_id);
                return true;
            }
        }

        return new \WP_Error(
            'rest_forbidden',
            __('You must be authenticated to access this endpoint.', 'faiiya-pay'),
            ['status' => 401]
        );
    }

    protected function success(mixed $data = null, string $message = 'Success', int $status = 200): \WP_REST_Response {
        return new \WP_REST_Response([
            'status'  => 'success',
            'message' => $message,
            'data'    => $data,
        ], $status);
    }

    protected function error(string $code, string $message, int $status = 400, mixed $data = null): \WP_Error {
        return new \WP_Error($code, $message, [
            'status' => $status,
            'data'   => $data,
        ]);
    }
}
