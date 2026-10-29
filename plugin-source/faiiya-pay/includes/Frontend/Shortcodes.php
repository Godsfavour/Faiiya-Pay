<?php
declare(strict_types=1);

namespace FaiiyaPay\Frontend;

use FaiiyaPay\Models\WalletModel;
use FaiiyaPay\Models\VirtualAccountModel;
use FaiiyaPay\Models\TransactionModel;
use FaiiyaPay\Models\ReferralModel;
use FaiiyaPay\Services\MonnifyService;

defined('ABSPATH') || exit;

class Shortcodes {
    public static function init(): void {
        add_shortcode('faiiya_pay_register', [self::class, 'render_register']);
        add_shortcode('faiiya_pay_dashboard', [self::class, 'render_dashboard']);
        add_shortcode('faiiya_wallet', [self::class, 'render_dashboard']);
        add_shortcode('faiiya_referrals', [self::class, 'render_referrals']);
        add_shortcode('faiiya_topup', [self::class, 'render_topup']);
    }

    /**
     * Module D: Custom Web Registration Form [faiiya_pay_register]
     */
    public static function render_register(array $atts = []): string {
        if (is_user_logged_in()) {
            $dash_url = get_permalink(get_option('faiiya_page_dashboard_id', 0)) ?: home_url('/faiiya-dashboard');
            return '<div style="max-width: 500px; margin: 20px auto; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center;">' .
                '<p style="margin: 0 0 14px 0; color: #166534; font-weight: 600;">' . esc_html__('You are already logged in to your account.', 'faiiya-pay') . '</p>' .
                '<a href="' . esc_url($dash_url) . '" style="display: inline-block; background: #059669; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">' .
                esc_html__('Go to Faiiya Pay Dashboard →', 'faiiya-pay') . '</a>' .
                '</div>';
        }

        $ref_code = sanitize_text_field($_GET['ref'] ?? $_COOKIE['faiiya_ref'] ?? '');
        $rest_register_url = esc_url_raw(rest_url('faiiya/v1/auth/register'));
        $nonce = wp_create_nonce('wp_rest');

        ob_start();
        ?>
        <div id="faiiya-register-wrapper" style="max-width: 520px; margin: 30px auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); padding: 32px; box-sizing: border-box;">
            <style>
                @media (max-width: 600px) {
                    #faiiya-register-wrapper { padding: 20px 16px !important; margin: 15px auto !important; }
                    .faiiya-reg-grid { grid-template-columns: 1fr !important; }
                }
            </style>
            <?php
            $custom_logo_id = get_theme_mod('custom_logo');
            $logo_url = '';
            if ($custom_logo_id) {
                $logo_data = wp_get_attachment_image_src($custom_logo_id, 'full');
                if ($logo_data && !empty($logo_data[0])) {
                    $logo_url = $logo_data[0];
                }
            }
            if (empty($logo_url)) {
                $logo_url = get_site_icon_url(96);
            }
            ?>
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
                    <?php if (!empty($logo_url)) : ?>
                        <img src="<?php echo esc_url($logo_url); ?>" alt="<?php echo esc_attr(get_bloginfo('name')); ?>" style="width: 96px; height: 96px; object-fit: contain; border-radius: 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: #ffffff; display: block; margin: 0 auto;" />
                    <?php else : ?>
                        <div style="width: 96px; height: 96px; border-radius: 18px; background: #0073aa; display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 4px 14px rgba(0,115,170,0.3); margin: 0 auto;">
                            <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="50" cy="50" r="48" fill="#0073AA"/>
                                <path d="M50 8C26.8 8 8 26.8 8 50c0 10.3 3.7 19.7 9.9 27L36.3 27.2c.4-1.1.8-2.2.8-3.1 0-1.4-1-2.4-2.8-2.6-.4 0-.7-.1-1.1-.1h-1.5V19h15.4v2.4h-1.5c-2.4.2-3.1 2-3.1 3.5 0 .9.3 2 .8 3.1l11.4 33.2 6.5-19.4c.4-1.2.6-2.3.6-3.1 0-1.4-.9-2.3-2.6-2.5-.4 0-.8-.1-1.1-.1h-1.5V19h14.7v2.4h-1.5c-2.3.2-3.2 2-3.2 3.5 0 .9.3 2 .8 3.1l11.3 32.8L82 77.2C88.2 69.8 92 60.3 92 50c0-23.2-18.8-42-42-42zm-2.8 77.8L31.8 40.4 17.5 79.5c8.6 6.1 19 9.7 30.2 9.7 1.5 0 3-.1 4.5-.3-1.6-.9-3.7-2-5-3.1zm22.4-44.5L59 69.2l13.7 11.5c5.3-7.2 8.5-16 8.5-25.7 0-4.5-.7-8.8-2-12.8L69.6 41.3z" fill="#ffffff"/>
                            </svg>
                        </div>
                    <?php endif; ?>
                </div>
                <h2 style="margin: 0; font-size: 26px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
                    <?php esc_html_e('Signup  / login', 'faiiya-pay'); ?>
                </h2>
            </div>

            <div id="faiiya-reg-alert" style="display: none; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.4;"></div>

            <form id="faiiya-pay-reg-form" style="display: flex; flex-direction: column; gap: 14px;">
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('First Name', 'faiiya-pay'); ?> *
                    </label>
                    <input type="text" name="first_name" id="faiiya-reg-first-name" required style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. Babatunde" />
                </div>
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Other Names', 'faiiya-pay'); ?> <span style="font-weight: 400; color: #64748b;">(optional)</span>
                    </label>
                    <input type="text" name="other_names" id="faiiya-reg-other-names" style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. Oluwaseun" />
                </div>
                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Last Name', 'faiiya-pay'); ?> *
                    </label>
                    <input type="text" name="last_name" id="faiiya-reg-last-name" required style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. Adeyemi" />
                </div>

                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Phone Number', 'faiiya-pay'); ?> *
                    </label>
                    <input type="tel" name="phone_number" required style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. 08031234567" />
                </div>

                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Email Address', 'faiiya-pay'); ?> *
                    </label>
                    <input type="email" name="email" required style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="chinedu@example.ng" />
                </div>

                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Password (min 8 characters)', 'faiiya-pay'); ?> *
                    </label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="password" name="password" id="faiiya-reg-password" minlength="8" required style="width: 100%; padding: 12px 44px 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="••••••••" />
                        <button type="button" id="faiiya-reg-password-toggle" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; color: #64748b; padding: 6px; display: flex; align-items: center; justify-content: center;" title="<?php esc_attr_e('Show / Hide Password', 'faiiya-pay'); ?>" aria-label="<?php esc_attr_e('Toggle password visibility', 'faiiya-pay'); ?>">
                            <svg id="faiiya-pwd-eye-icon" style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <div>
                    <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Referral Code (Optional)', 'faiiya-pay'); ?>
                    </label>
                    <input type="text" name="referral_code" value="<?php echo esc_attr($ref_code); ?>" style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box; text-transform: uppercase;" placeholder="e.g. CHIN8921" />
                </div>

                <button type="submit" id="faiiya-reg-submit" style="width: 100%; background: #059669; color: #ffffff; border: none; padding: 14px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; margin-top: 6px; box-shadow: 0 4px 6px -1px rgba(5,150,105,0.25);">
                    <?php esc_html_e('Create Account & Wallet →', 'faiiya-pay'); ?>
                </button>
            </form>

            <div style="margin-top: 18px; text-align: center; font-size: 12px; color: #64748b;">
                <?php esc_html_e('Already registered?', 'faiiya-pay'); ?>
                <a href="<?php echo esc_url(wp_login_url()); ?>" style="color: #059669; font-weight: 600; text-decoration: underline;">
                    <?php esc_html_e('Log In', 'faiiya-pay'); ?>
                </a>
            </div>
        </div>

        <script>
        (function() {
            const form = document.getElementById('faiiya-pay-reg-form');
            const alertBox = document.getElementById('faiiya-reg-alert');
            const submitBtn = document.getElementById('faiiya-reg-submit');

            if (!form) return;

            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                submitBtn.disabled = true;
                submitBtn.innerText = '<?php echo esc_js(__('Creating Account...', 'faiiya-pay')); ?>';
                alertBox.style.display = 'none';

                const formData = new FormData(form);
                const payload = {
                    first_name: formData.get('first_name'),
                    other_names: formData.get('other_names'),
                    last_name: formData.get('last_name'),
                    phone_number: formData.get('phone_number'),
                    email: formData.get('email'),
                    password: formData.get('password'),
                    referral_code: formData.get('referral_code')
                };

                try {
                    const response = await fetch('<?php echo $rest_register_url; ?>', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-WP-Nonce': '<?php echo $nonce; ?>'
                        },
                        body: JSON.stringify(payload)
                    });

                    const data = await response.json();

                    if (response.ok && data.status === 'success') {
                        // Compliance Name Replacement: update input fields with official verified names if returned
                        if (data.data && data.data.user) {
                            if (data.data.user.first_name) {
                                document.getElementById('faiiya-reg-first-name').value = data.data.user.first_name;
                            }
                            if (data.data.user.other_names) {
                                document.getElementById('faiiya-reg-other-names').value = data.data.user.other_names;
                            }
                            if (data.data.user.last_name) {
                                document.getElementById('faiiya-reg-last-name').value = data.data.user.last_name;
                            }
                        }

                        alertBox.style.display = 'block';
                        alertBox.style.background = '#ecfdf5';
                        alertBox.style.border = '1px solid #a7f3d0';
                        alertBox.style.color = '#065f46';
                        alertBox.innerHTML = '<strong>' + (data.message || 'Registration successful!') + '</strong> <?php echo esc_js(__('Redirecting to your dashboard...', 'faiiya-pay')); ?>';

                        setTimeout(function() {
                            window.location.href = data.data.redirect_url || '<?php echo home_url('/faiiya-dashboard'); ?>';
                        }, 1000);
                    } else {
                        throw new Error(data.message || 'Registration failed.');
                    }
                } catch (err) {
                    alertBox.style.display = 'block';
                    alertBox.style.background = '#fef2f2';
                    alertBox.style.border = '1px solid #fecaca';
                    alertBox.style.color = '#991b1b';
                    alertBox.innerText = err.message;
                    submitBtn.disabled = false;
                    submitBtn.innerText = '<?php echo esc_js(__('Create Account & Wallet →', 'faiiya-pay')); ?>';
                }
            });

            // Password Visibility Toggle
            const pwdInput = document.getElementById('faiiya-reg-password');
            const pwdToggle = document.getElementById('faiiya-reg-password-toggle');
            if (pwdInput && pwdToggle) {
                pwdToggle.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (pwdInput.type === 'password') {
                        pwdInput.type = 'text';
                        pwdToggle.innerHTML = '<svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path></svg>';
                    } else {
                        pwdInput.type = 'password';
                        pwdToggle.innerHTML = '<svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>';
                    }
                });
            }
        })();
        </script>
        <?php
        return ob_get_clean() ?: '';
    }

    /**
     * Module D: Custom Web Dashboard [faiiya_pay_dashboard] & [faiiya_wallet]
     * Interrogates wallet status: If unverified, renders locked state KYC form. If verified, renders complete wallet portal.
     */
    public static function render_dashboard(array $atts = []): string {
        if (!is_user_logged_in()) {
            return '<div class="faiiya-notice" style="padding: 24px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; color: #92400e; font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 20px auto; text-align: center;">' .
                '<h3 style="margin-top:0; color:#b45309; font-size: 18px;">' . esc_html__('Authentication Required', 'faiiya-pay') . '</h3>' .
                '<p style="margin: 8px 0 16px 0; font-size: 14px;">' . esc_html__('Please log in or register to access your Faiiya digital wallet dashboard.', 'faiiya-pay') . '</p>' .
                '<div style="display: flex; gap: 10px; justify-content: center;">' .
                '<a href="' . esc_url(wp_login_url(get_permalink())) . '" style="background: #059669; color: #fff; padding: 9px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">' . esc_html__('Log In', 'faiiya-pay') . '</a>' .
                '<a href="' . esc_url(get_permalink(get_option('faiiya_page_register_id', 0)) ?: home_url('/faiiya-register')) . '" style="background: #ffffff; color: #059669; border: 1px solid #059669; padding: 9px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">' . esc_html__('Create Account', 'faiiya-pay') . '</a>' .
                '</div>' .
                '</div>';
        }

        $user_id = get_current_user_id();
        $user = get_userdata($user_id);

        $wallet_model = new WalletModel();
        $wallet = $wallet_model->ensure_wallet_exists($user_id);

        $va_model = new VirtualAccountModel();
        $virtual_accounts = $va_model->get_user_accounts($user_id);

        // If virtual accounts already exist in DB, ensure wallet is marked verified
        if (!empty($virtual_accounts) && ($wallet->kyc_status ?? '') !== 'verified') {
            $wallet_model->update_kyc_status($user_id, 'verified');
            $wallet->kyc_status = 'verified';
            update_user_meta($user_id, 'faiiya_kyc_status', 'verified');
        }

        // If virtual accounts are empty, query Monnify live to check if account was already verified/upgraded
        if (empty($virtual_accounts)) {
            $monnify_service = new MonnifyService();
            if ($monnify_service->is_configured()) {
                $account_ref = get_user_meta($user_id, '_faiiya_account_reference', true) ?: ('FP_VA_' . $user_id);
                $monnify_data = $monnify_service->get_reserved_account((string) $account_ref);
                if (!empty($monnify_data) && !empty($monnify_data['accounts'])) {
                    $va_model->save_accounts($user_id, $monnify_data);
                    $virtual_accounts = $va_model->get_user_accounts($user_id);
                    $wallet_model->update_kyc_status($user_id, 'verified');
                    $wallet->kyc_status = 'verified';
                    update_user_meta($user_id, 'faiiya_kyc_status', 'verified');
                }
            }
        }

        $kyc_status = $wallet->kyc_status ?? 'unverified';
        $meta_status = get_user_meta($user_id, 'faiiya_kyc_status', true);
        $is_verified = (!empty($virtual_accounts) || $kyc_status === 'verified' || $kyc_status === 'tier1_verified' || $meta_status === 'verified');

        // Automatic Self-Healing Sync: If user is verified, query Monnify for any incoming deposits made while offline
        if ($is_verified) {
            $monnify_service = new MonnifyService();
            if ($monnify_service->is_configured()) {
                $monnify_service->sync_customer_reserved_transactions($user_id);
            }
        }

        // Always fetch fresh wallet record from database (ensures admin manual adjustments reflect immediately)
        $wallet = $wallet_model->get_wallet($user_id) ?: $wallet_model->ensure_wallet_exists($user_id);

        $txn_model = new TransactionModel();
        $transactions_data = $txn_model->get_user_transactions($user_id, 1, 10);
        $transactions = $transactions_data['transactions'] ?? [];

        global $wpdb;
        $latest_txn_id = (int) $wpdb->get_var(
            $wpdb->prepare("SELECT COALESCE(MAX(id), 0) FROM {$wpdb->prefix}faiiya_transactions WHERE user_id = %d", $user_id)
        );
        $server_now = current_time('mysql');

        $ref_model = new ReferralModel();
        $ref_stats = $ref_model->get_stats($user_id);

        $verify_kyc_url = esc_url_raw(rest_url('faiiya/v1/wallet/verify-kyc'));
        $check_deposit_url = esc_url_raw(rest_url('faiiya/v1/wallet/check-deposit'));
        $nonce = wp_create_nonce('wp_rest');

        ob_start();
        ?>
        <div id="faiiya-dashboard-container" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; color: #0f172a; box-sizing: border-box; padding: 0 12px;">
            <style>
                @media (max-width: 640px) {
                    #faiiya-dashboard-container { padding: 0 4px !important; }
                    #faiiya-locked-kyc-card { padding: 18px 14px !important; }
                    .faiiya-kyc-wrap { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
                    .faiiya-kyc-input-row { flex-direction: column !important; }
                    .faiiya-kyc-input-row input { width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
                    .faiiya-kyc-input-row button { width: 100% !important; min-height: 44px !important; }
                    .faiiya-radio-row { flex-direction: column !important; gap: 8px !important; }
                    .faiiya-reg-grid { grid-template-columns: 1fr !important; }
                    #faiiya-register-wrapper { padding: 20px 14px !important; margin: 15px auto !important; }
                }
            </style>
            
            <!-- KYC Status Header Banner (Only shown if unverified) -->
            <div id="faiiya-kyc-banner" style="display: <?php echo $is_verified ? 'none' : 'flex'; ?>; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px 20px; margin-bottom: 20px; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; transition: all 0.3s ease;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span id="faiiya-kyc-icon" style="font-size: 20px;">⚠️</span>
                    <div>
                        <div id="faiiya-kyc-title" style="font-size: 14px; font-weight: 700; color: #92400e;">
                            <?php esc_html_e('KYC Verification Pending (Tier 1)', 'faiiya-pay'); ?>
                        </div>
                        <div id="faiiya-kyc-desc" style="font-size: 12px; color: #b45309;">
                            <?php esc_html_e('Bank transfer deposit accounts are locked until your identity is verified with your National Identity Number (NIN).', 'faiiya-pay'); ?>
                        </div>
                    </div>
                </div>
                <div id="faiiya-kyc-badge-wrap" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 20px; background: #fde68a; color: #92400e;">
                    <span id="kyc-badge-text"><?php esc_html_e('UNVERIFIED', 'faiiya-pay'); ?></span>
                </div>
            </div>

            <!-- UNVERIFIED: LOCKED STATE UI (Module D) - Mobile Responsive National Identification Number (NIN) -->
            <div id="faiiya-locked-kyc-card" style="display: <?php echo $is_verified ? 'none' : 'block'; ?>; background: #ffffff; border: 1px solid #fed7aa; border-radius: 16px; padding: 28px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); box-sizing: border-box;">
                <div class="faiiya-kyc-wrap" style="display: flex; gap: 16px; align-items: flex-start;">
                    <div style="background: #ffedd5; color: #ea580c; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                        🔒
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #9a3412;">
                            <?php esc_html_e('Unlock Virtual Bank Accounts with National ID (NIN)', 'faiiya-pay'); ?>
                        </h3>
                        <p style="margin: 0 0 16px 0; font-size: 13px; color: #4b5563; line-height: 1.5;">
                            <?php esc_html_e('In compliance with Central Bank of Nigeria (CBN) and NDPR data regulations, submit your 11-digit National Identity Number (NIN) below. We will provision your dedicated Monnify bank transfer accounts and activate your wallet immediately.', 'faiiya-pay'); ?>
                        </p>

                        <!-- Zero-Storage Guarantee Badge -->
                        <div style="display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; font-size: 11px; color: #475569; margin-bottom: 18px; max-width: 100%; box-sizing: border-box; flex-wrap: wrap;">
                            <span>🔒</span>
                            <span><?php esc_html_e('Zero-Storage Guarantee: Your NIN is verified directly with NIMC via Monnify API and never stored on this server.', 'faiiya-pay'); ?></span>
                        </div>

                        <div id="faiiya-kyc-form-alert" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

                        <form id="faiiya-kyc-verify-form" style="display: flex; flex-direction: column; gap: 14px; max-width: 520px;">
                            <input type="hidden" name="kyc_type" value="nin" />

                            <div class="faiiya-kyc-input-row" style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <input type="text" id="kyc_id_input" name="kyc_id" required maxlength="11" minlength="11" pattern="\d{11}" placeholder="<?php esc_attr_e('Enter 11-digit NIN', 'faiiya-pay'); ?>" style="flex: 1; min-width: 200px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; letter-spacing: 0.05em; font-family: monospace; box-sizing: border-box;" />
                                <button type="submit" id="faiiya-kyc-submit-btn" style="background: #059669; color: #ffffff; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; min-height: 44px; box-sizing: border-box;">
                                    <?php esc_html_e('Verify NIN & Unlock →', 'faiiya-pay'); ?>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- UNLOCKED / VERIFIED WALLET INTERFACE (Module D) -->
            <div id="faiiya-unlocked-section" style="display: <?php echo $is_verified ? 'block' : 'none'; ?>;">
                <!-- Account Details & Clean Balance Card -->
                <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; padding: 24px 28px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.3); margin-bottom: 24px;">
                    <!-- Full Profile Name at top of Account Details -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid rgba(255, 255, 255, 0.2); padding-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">👤</span>
                            <span id="faiiya-profile-fullname" style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.01em;">
                                <?php echo esc_html(trim("{$user->first_name} {$user->last_name}") ?: $user->display_name); ?>
                            </span>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; opacity: 0.85; letter-spacing: 0.05em; text-transform: uppercase;">
                            <?php esc_html_e('FAIIYA WALLET', 'faiiya-pay'); ?>
                        </span>
                    </div>

                    <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9; margin-bottom: 4px;">
                        <?php esc_html_e('Available Wallet Balance', 'faiiya-pay'); ?>
                    </div>

                    <div style="font-size: 38px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 6px; line-height: 1.1;">
                        ₦<span id="faiiya-live-balance"><?php echo number_format($wallet_model->get_balance($user_id), 2); ?></span>
                    </div>

                    <!-- Clean Verified Status badge directly under Amount -->
                    <div style="margin-bottom: 16px;">
                        <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(4px); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; color: #ffffff;">
                            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #34d399;"></span>
                            <span id="faiiya-card-kyc-status"><?php echo esc_html($is_verified ? 'Verified (Tier 1)' : 'Pending Verification'); ?></span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button type="button" id="faiiya-open-fund-modal-btn" style="background: #ffffff; color: #065f46; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                            + <?php esc_html_e('Fund Account', 'faiiya-pay'); ?>
                        </button>
                        <a href="<?php echo esc_url(get_permalink(get_option('faiiya_page_referrals_id', 0)) ?: '#faiiya-ref-box'); ?>" style="display: inline-block; background: rgba(255, 255, 255, 0.2); color: #ffffff; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
                            🎁 <?php esc_html_e('Refer & Earn ₦500', 'faiiya-pay'); ?>
                        </a>
                    </div>
                </div>

                <!-- Dedicated Virtual Bank Accounts -->
                <div id="faiiya-va-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">
                            🏦 <?php esc_html_e('Dedicated Bank Transfer Virtual Accounts', 'faiiya-pay'); ?>
                        </h3>
                        <span style="font-size: 12px; color: #059669; font-weight: 600;">⚡ <?php esc_html_e('Instant Automated Top-Up', 'faiiya-pay'); ?></span>
                    </div>
                    <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
                        <?php esc_html_e('Transfer funds to any of your dedicated Monnify accounts below. Your wallet will be credited automatically and instantly.', 'faiiya-pay'); ?>
                    </p>

                    <div id="faiiya-va-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
                        <?php if (!empty($virtual_accounts)) : ?>
                            <?php foreach ($virtual_accounts as $acc) : ?>
                                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <span style="font-size: 13px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.05em;"><?php echo esc_html($acc['bank_name']); ?></span>
                                        <span style="background: #ecfdf5; color: #065f46; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">ACTIVE NUBAN</span>
                                    </div>
                                    <div style="font-size: 24px; font-weight: 800; color: #0f172a; font-family: monospace; letter-spacing: 0.06em; margin-bottom: 12px;">
                                        <?php echo esc_html($acc['account_number']); ?>
                                    </div>

                                    <!-- Prominent Account Name Display -->
                                    <div style="background: #f1f5f9; border-left: 3px solid #0284c7; padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 14px;">
                                        <div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.04em;"><?php esc_html_e('Account Name (Destination):', 'faiiya-pay'); ?></div>
                                        <div style="font-size: 13px; font-weight: 800; color: #0f172a; word-break: break-word;"><?php echo esc_html($acc['account_name'] ?: ($user->first_name . ' ' . $user->last_name)); ?></div>
                                    </div>

                                    <button type="button" onclick="navigator.clipboard.writeText('<?php echo esc_attr($acc['account_number']); ?>'); this.innerText='✓ Copied!'; setTimeout(() => this.innerText='📋 Copy Number', 2000);" style="width: 100%; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; transition: background 0.15s;">
                                        📋 <?php esc_html_e('Copy Number', 'faiiya-pay'); ?>
                                    </button>
                                </div>
                            <?php endforeach; ?>
                        <?php else : ?>
                            <div style="padding: 16px; background: #f1f5f9; border-radius: 8px; font-size: 13px; color: #475569; grid-column: 1 / -1;">
                                <?php esc_html_e('Virtual accounts will appear here immediately once your NIN is verified below.', 'faiiya-pay'); ?>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>

                <!-- Referral Summary Bar -->
                <div id="faiiya-ref-box" style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">
                            <?php esc_html_e('Your Referral Code (Earn ₦500)', 'faiiya-pay'); ?>
                        </div>
                        <div style="font-size: 20px; font-weight: 800; color: #0f172a; font-family: monospace;">
                            <?php echo esc_html($ref_stats['referral_code'] ?? 'FP' . $user_id); ?>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" readonly value="<?php echo esc_attr($ref_stats['shareable_link'] ?? home_url('/faiiya-register?ref=' . ($ref_stats['referral_code'] ?? ''))); ?>" id="faiiya-ref-link-dash" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 12px; width: 220px; background: #fff;" />
                        <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('faiiya-ref-link-dash').value); alert('Referral link copied!');" style="background: #059669; color: #ffffff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">
                            <?php esc_html_e('Copy Link', 'faiiya-pay'); ?>
                        </button>
                    </div>
                </div>

                <!-- Recent Transactions Table -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
                    <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; font-weight: 700; color: #1e293b;">
                        📋 <?php esc_html_e('Recent Wallet Transactions', 'faiiya-pay'); ?>
                    </h3>

                    <?php if (!empty($transactions)) : ?>
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #f1f5f9; color: #64748b; font-weight: 600;">
                                        <th style="padding: 10px 8px;"><?php esc_html_e('Date', 'faiiya-pay'); ?></th>
                                        <th style="padding: 10px 8px;"><?php esc_html_e('Type', 'faiiya-pay'); ?></th>
                                        <th style="padding: 10px 8px;"><?php esc_html_e('Reference', 'faiiya-pay'); ?></th>
                                        <th style="padding: 10px 8px; text-align: right;"><?php esc_html_e('Amount', 'faiiya-pay'); ?></th>
                                        <th style="padding: 10px 8px; text-align: right;"><?php esc_html_e('Balance After', 'faiiya-pay'); ?></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($transactions as $txn) : 
                                        $is_positive = in_array($txn['type'], ['deposit', 'referral_bonus', 'refund'], true);
                                        if ($txn['type'] === 'admin_adjustment') {
                                            $meta = !empty($txn['metadata']) ? (is_string($txn['metadata']) ? json_decode($txn['metadata'], true) : $txn['metadata']) : [];
                                            if (isset($meta['direction'])) {
                                                $is_positive = ($meta['direction'] === 'credit');
                                            } else {
                                                $is_positive = ((float) ($txn['balance_after'] ?? 0) >= (float) ($txn['balance_before'] ?? 0));
                                            }
                                        }
                                        $type_labels = [
                                            'deposit'          => __('Deposit', 'faiiya-pay'),
                                            'debit_order'      => __('Order Payment', 'faiiya-pay'),
                                            'referral_bonus'   => __('Referral Bonus', 'faiiya-pay'),
                                            'refund'           => __('Refund', 'faiiya-pay'),
                                            'admin_adjustment' => __('Admin Adjustment', 'faiiya-pay'),
                                        ];
                                    ?>
                                        <tr style="border-bottom: 1px solid #f1f5f9;">
                                            <td style="padding: 12px 8px; color: #64748b;">
                                                <?php echo esc_html(date_i18n('M j, Y H:i', strtotime($txn['created_at']))); ?>
                                            </td>
                                            <td style="padding: 12px 8px; font-weight: 600;">
                                                <?php echo esc_html($type_labels[$txn['type']] ?? $txn['type']); ?>
                                            </td>
                                            <td style="padding: 12px 8px; color: #475569; font-family: monospace; font-size: 11px;">
                                                <?php echo esc_html($txn['reference']); ?>
                                            </td>
                                            <td style="padding: 12px 8px; text-align: right; font-weight: 700; color: <?php echo $is_positive ? '#059669' : '#dc2626'; ?>;">
                                                <?php echo ($is_positive ? '+₦' : '-₦') . number_format((float) $txn['amount'], 2); ?>
                                            </td>
                                            <td style="padding: 12px 8px; text-align: right; color: #334155; font-weight: 500;">
                                                ₦<?php echo number_format((float) $txn['balance_after'], 2); ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php else : ?>
                        <p style="margin: 0; color: #64748b; font-size: 13px;">
                            <?php esc_html_e('No wallet transactions recorded yet. Transfer funds to start using your wallet.', 'faiiya-pay'); ?>
                        </p>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <!-- FUND ACCOUNT MODAL (Amount Prompt -> Virtual Account -> Live Monnify Confirmation) -->
        <style>
            @keyframes faiiyaPulseRadar {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
            .faiiya-radar-circle {
                animation: faiiyaPulseRadar 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
            }
            @keyframes faiiyaBlink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
            .faiiya-live-dot {
                animation: faiiyaBlink 1.2s infinite;
            }
        </style>

        <div id="faiiya-fund-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); z-index: 999999; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
            <div style="background: #ffffff; border-radius: 20px; max-width: 500px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; position: relative; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #f1f5f9; background: #fafafa;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 36px; height: 36px; border-radius: 10px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold;">₦</div>
                        <div>
                            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;" id="faiiya-modal-title"><?php esc_html_e('Fund Your Wallet', 'faiiya-pay'); ?></h3>
                            <p style="margin: 0; font-size: 12px; color: #64748b;" id="faiiya-modal-subtitle"><?php esc_html_e('Instant automated top-up via Monnify', 'faiiya-pay'); ?></p>
                        </div>
                    </div>
                    <button type="button" id="faiiya-modal-close-btn" style="background: none; border: none; font-size: 24px; line-height: 1; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 6px;">&times;</button>
                </div>

                <div style="padding: 24px;">
                    <!-- STEP 1: Enter Amount -->
                    <div id="faiiya-fund-step-1">
                        <label style="display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">
                            <?php esc_html_e('Select or Enter Amount to Fund (₦)', 'faiiya-pay'); ?>
                        </label>

                        <!-- Amount Presets -->
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px;">
                            <button type="button" class="faiiya-preset-btn" data-amount="2000" style="padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; font-weight: 600; font-size: 13px; color: #1e293b; cursor: pointer;">₦2,000</button>
                            <button type="button" class="faiiya-preset-btn" data-amount="5000" style="padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; font-weight: 600; font-size: 13px; color: #1e293b; cursor: pointer;">₦5,000</button>
                            <button type="button" class="faiiya-preset-btn active" data-amount="10000" style="padding: 10px; border: 2px solid #059669; background: #ecfdf5; border-radius: 8px; font-weight: 700; font-size: 13px; color: #065f46; cursor: pointer;">₦10,000</button>
                            <button type="button" class="faiiya-preset-btn" data-amount="20000" style="padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; font-weight: 600; font-size: 13px; color: #1e293b; cursor: pointer;">₦20,000</button>
                            <button type="button" class="faiiya-preset-btn" data-amount="50000" style="padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; font-weight: 600; font-size: 13px; color: #1e293b; cursor: pointer;">₦50,000</button>
                            <button type="button" class="faiiya-preset-btn" data-amount="100000" style="padding: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; font-weight: 600; font-size: 13px; color: #1e293b; cursor: pointer;">₦100,000</button>
                        </div>

                        <!-- Custom Input -->
                        <div style="position: relative; margin-bottom: 16px;">
                            <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-weight: bold; font-size: 18px; color: #64748b;">₦</span>
                            <input type="number" id="faiiya-custom-fund-amount" value="10000" min="100" max="5000000" step="100" style="width: 100%; box-sizing: border-box; padding: 12px 14px 12px 34px; font-size: 20px; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 10px; font-family: monospace;" />
                        </div>

                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 8px;">
                            <span>🛡️</span>
                            <span><?php esc_html_e('0% transfer fee. Automatic verification via Monnify real-time webhooks.', 'faiiya-pay'); ?></span>
                        </div>

                        <button type="button" id="faiiya-proceed-to-transfer-btn" style="width: 100%; background: #059669; color: #ffffff; border: none; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 15px; cursor: pointer; transition: background 0.2s;">
                            <?php esc_html_e('Proceed to Bank Transfer →', 'faiiya-pay'); ?>
                        </button>
                    </div>

                    <!-- STEP 2: Dedicated Account & Waiting for Payment Radar -->
                    <div id="faiiya-fund-step-2" style="display: none;">
                        <div style="text-align: center; margin-bottom: 18px;">
                            <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;"><?php esc_html_e('Transfer Exact Amount', 'faiiya-pay'); ?></div>
                            <div style="font-size: 28px; font-weight: 800; color: #059669; margin: 4px 0;" id="faiiya-step2-amount-display">₦10,000.00</div>
                            <div style="font-size: 12px; color: #64748b;"><?php esc_html_e('Transfer from any Nigerian banking app or USSD', 'faiiya-pay'); ?></div>
                        </div>

                        <!-- Account Card -->
                        <div style="background: #0f172a; color: #ffffff; border-radius: 14px; padding: 18px; margin-bottom: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; opacity: 0.8; font-size: 12px;">
                                <span id="faiiya-step2-bank-name"><?php echo esc_html($virtual_accounts[0]['bank_name'] ?? 'Wema Bank / Monnify'); ?></span>
                                <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 10px;">DEDICATED ACCOUNT</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div>
                                    <div style="font-size: 11px; opacity: 0.7;"><?php esc_html_e('Account Number', 'faiiya-pay'); ?></div>
                                    <div style="font-size: 24px; font-weight: 800; font-family: monospace; letter-spacing: 0.08em;" id="faiiya-step2-acc-num">
                                        <?php echo esc_html($virtual_accounts[0]['account_number'] ?? ''); ?>
                                    </div>
                                </div>
                                <button type="button" id="faiiya-step2-copy-btn" style="background: #059669; color: #ffffff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">
                                    📋 <?php esc_html_e('Copy', 'faiiya-pay'); ?>
                                </button>
                            </div>

                            <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 10px; display: flex; justify-content: space-between; font-size: 12px;">
                                <span style="opacity: 0.7;"><?php esc_html_e('Account Name', 'faiiya-pay'); ?>:</span>
                                <span style="font-weight: 700;" id="faiiya-step2-acc-name"><?php echo esc_html($user->first_name ?: ($virtual_accounts[0]['account_name'] ?? 'Wallet Customer')); ?></span>
                            </div>
                        </div>

                        <!-- Clean Waiting For Payment State -->
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 16px; text-align: center; margin-bottom: 18px;">
                            <div style="display: flex; justify-content: center; margin-bottom: 10px;">
                                <div class="faiiya-radar-circle" style="width: 40px; height: 40px; border-radius: 50%; background: #059669; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                                    ⏳
                                </div>
                            </div>
                            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                                <?php esc_html_e('Waiting for payment...', 'faiiya-pay'); ?>
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                                <?php esc_html_e('Transfer to the account above. Your wallet balance will automatically update once received.', 'faiiya-pay'); ?>
                            </div>
                            <div id="faiiya-check-status-msg" style="display: none; margin-top: 8px; font-size: 11px; color: #059669; font-weight: 600;"></div>
                        </div>

                        <div style="display: flex; gap: 8px;">
                            <button type="button" id="faiiya-step2-back-btn" style="flex: 1; background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer;">
                                ← <?php esc_html_e('Change Amount', 'faiiya-pay'); ?>
                            </button>
                            <button type="button" id="faiiya-step2-check-now-btn" style="flex: 1; background: #059669; color: #ffffff; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer;">
                                🔄 <?php esc_html_e('Check Status Now', 'faiiya-pay'); ?>
                            </button>
                        </div>
                    </div>

                    <!-- STEP 3: Success Screen -->
                    <div id="faiiya-fund-step-3" style="display: none; text-align: center; padding: 10px 0;">
                        <div style="width: 60px; height: 60px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px auto;">
                            ✓
                        </div>
                        <h3 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #0f172a;">
                            <?php esc_html_e('Payment Confirmed!', 'faiiya-pay'); ?>
                        </h3>
                        <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748b;">
                            <?php esc_html_e('Monnify has confirmed your transfer and your wallet has been credited successfully.', 'faiiya-pay'); ?>
                        </p>

                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;"><?php esc_html_e('Amount Credited', 'faiiya-pay'); ?></div>
                            <div style="font-size: 24px; font-weight: 800; color: #059669;" id="faiiya-success-amount">+₦10,000.00</div>
                            <div style="font-size: 12px; color: #475569; margin-top: 6px;">
                                <?php esc_html_e('New Wallet Balance', 'faiiya-pay'); ?>: <strong id="faiiya-success-new-bal">₦10,000.00</strong>
                            </div>
                        </div>

                        <button type="button" id="faiiya-success-close-btn" style="width: 100%; background: #059669; color: #ffffff; border: none; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 15px; cursor: pointer;">
                            <?php esc_html_e('Done & View Wallet', 'faiiya-pay'); ?>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <script>
        (function() {
            // KYC Unlock Handling
            const kycForm = document.getElementById('faiiya-kyc-verify-form');
            const alertBox = document.getElementById('faiiya-kyc-form-alert');
            const submitBtn = document.getElementById('faiiya-kyc-submit-btn');
            const inputField = document.getElementById('kyc_id_input');

            if (kycForm) {
                kycForm.addEventListener('submit', async function(e) {
                    e.preventDefault();
                    const kycTypeEl = kycForm.querySelector('input[name="kyc_type"]');
                    const kycType = kycTypeEl ? kycTypeEl.value : 'nin';
                    const kycVal = inputField.value.trim().replace(/D/g, '');

                    if (kycVal.length !== 11) {
                        alertBox.style.display = 'block';
                        alertBox.style.background = '#fef2f2';
                        alertBox.style.color = '#991b1b';
                        alertBox.innerText = '<?php echo esc_js(__('Please enter an exact 11-digit NIN.', 'faiiya-pay')); ?>';
                        return;
                    }

                    submitBtn.disabled = true;
                    submitBtn.innerText = '<?php echo esc_js(__('Verifying with Monnify...', 'faiiya-pay')); ?>';
                    alertBox.style.display = 'none';

                    const payload = {};
                    payload[kycType] = kycVal;

                    try {
                        const response = await fetch('<?php echo $verify_kyc_url; ?>', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-WP-Nonce': '<?php echo $nonce; ?>'
                            },
                            body: JSON.stringify(payload)
                        });

                        const resData = await response.json();

                        if (response.ok && resData.status === 'success') {
                            // 1. Immediately transition UI from locked to unlocked state without reload
                            const lockedCard = document.getElementById('faiiya-locked-kyc-card');
                            if (lockedCard) lockedCard.style.display = 'none';

                            const unlockedSec = document.getElementById('faiiya-unlocked-section');
                            if (unlockedSec) unlockedSec.style.display = 'block';

                            // 2. Hide top banner for clean unified card presentation
                            const banner = document.getElementById('faiiya-kyc-banner');
                            if (banner) banner.style.display = 'none';

                            const vName = (resData.data && resData.data.verified_name) ? resData.data.verified_name : 'Verified Customer';
                            const profNameEl = document.getElementById('faiiya-profile-fullname');
                            if (profNameEl) profNameEl.innerText = vName;

                            const cardKycStatus = document.getElementById('faiiya-card-kyc-status');
                            if (cardKycStatus) cardKycStatus.innerText = 'Verified (Tier 1)';

                            // 3. Render Virtual Accounts Grid with Prominent Account Name
                            const grid = document.getElementById('faiiya-va-grid');
                            if (grid && resData.data && resData.data.virtual_accounts && resData.data.virtual_accounts.length > 0) {
                                let html = '';
                                resData.data.virtual_accounts.forEach(function(acc) {
                                    const accName = acc.account_name || vName;
                                    html += '<div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative;">' +
                                        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">' +
                                        '<span style="font-size: 13px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.05em;">' + acc.bank_name + '</span>' +
                                        '<span style="background: #ecfdf5; color: #065f46; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">ACTIVE NUBAN</span>' +
                                        '</div>' +
                                        '<div style="font-size: 24px; font-weight: 800; color: #0f172a; font-family: monospace; letter-spacing: 0.06em; margin-bottom: 12px;">' + acc.account_number + '</div>' +
                                        '<div style="background: #f1f5f9; border-left: 3px solid #0284c7; padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 14px;">' +
                                        '<div style="font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.04em;">Account Name (Destination):</div>' +
                                        '<div style="font-size: 13px; font-weight: 800; color: #0f172a; word-break: break-word;">' + accName + '</div>' +
                                        '</div>' +
                                        '<button type="button" onclick="navigator.clipboard.writeText(\'' + acc.account_number + '\'); this.innerText=\'✓ Copied!\'; var b=this; setTimeout(function(){b.innerText=\'📋 Copy Number\';}, 2000);" style="width: 100%; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 8px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer;">📋 Copy Number</button>' +
                                        '</div>';
                                });
                                grid.innerHTML = html;

                                // Also update the modal values
                                const firstAcc = resData.data.virtual_accounts[0];
                                if (firstAcc) {
                                    const modalAcc = document.getElementById('faiiya-step2-acc-num');
                                    const modalBank = document.getElementById('faiiya-step2-bank-name');
                                    const modalName = document.getElementById('faiiya-step2-acc-name');
                                    if (modalAcc) modalAcc.innerText = firstAcc.account_number;
                                    if (modalBank) modalBank.innerText = firstAcc.bank_name;
                                    if (modalName) modalName.innerText = firstAcc.account_name || vName;
                                }
                            }

                            // 4. Show clean inline success notification banner (no blocking alert)
                            const prevToast = document.getElementById('faiiya-kyc-success-toast');
                            if (prevToast) prevToast.remove();

                            const successBanner = document.createElement('div');
                            successBanner.id = 'faiiya-kyc-success-toast';
                            successBanner.style.cssText = 'background: #ecfdf5; border: 1.5px solid #6ee7b7; color: #065f46; padding: 14px 18px; border-radius: 10px; margin-bottom: 18px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);';
                            successBanner.innerHTML = '<span>✅ <strong>KYC Verified!</strong> Virtual accounts created for <strong>' + vName + '</strong>. Your wallet is unlocked and ready for deposits.</span><button type="button" onclick="this.parentElement.remove();" style="background:none; border:none; font-size:18px; cursor:pointer; color:#065f46;">&times;</button>';
                            
                            if (banner) {
                                banner.insertAdjacentElement('afterend', successBanner);
                            }
                        } else {
                            throw new Error(resData.message || 'KYC verification failed.');
                        }
                    } catch (err) {
                        alertBox.style.display = 'block';
                        alertBox.style.background = '#fef2f2';
                        alertBox.style.color = '#991b1b';
                        alertBox.innerText = err.message;
                        submitBtn.disabled = false;
                        submitBtn.innerText = '<?php echo esc_js(__('Verify & Unlock →', 'faiiya-pay')); ?>';
                    }
                });
            }

            // Fund Account Modal & Live Monnify Polling
            const openFundBtn = document.getElementById('faiiya-open-fund-modal-btn');
            const overlay = document.getElementById('faiiya-fund-modal-overlay');
            const closeBtn = document.getElementById('faiiya-modal-close-btn');
            const successCloseBtn = document.getElementById('faiiya-success-close-btn');
            const step1 = document.getElementById('faiiya-fund-step-1');
            const step2 = document.getElementById('faiiya-fund-step-2');
            const step3 = document.getElementById('faiiya-fund-step-3');
            const customAmountInput = document.getElementById('faiiya-custom-fund-amount');
            const proceedBtn = document.getElementById('faiiya-proceed-to-transfer-btn');
            const step2BackBtn = document.getElementById('faiiya-step2-back-btn');
            const checkNowBtn = document.getElementById('faiiya-step2-check-now-btn');
            const copyAccBtn = document.getElementById('faiiya-step2-copy-btn');
            const presetBtns = document.querySelectorAll('.faiiya-preset-btn');

            let pollInterval = null;
            let lastKnownTxnId = <?php echo (int) $latest_txn_id; ?>;
            let fundStartTime = '<?php echo esc_js($server_now); ?>';
            let targetFundAmount = 10000;

            function stopPolling() {
                if (pollInterval) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                }
            }

            function openModal() {
                if (!overlay) return;
                step1.style.display = 'block';
                step2.style.display = 'none';
                step3.style.display = 'none';
                overlay.style.display = 'flex';
            }

            function closeModal() {
                stopPolling();
                if (overlay) overlay.style.display = 'none';
            }

            if (openFundBtn) {
                openFundBtn.addEventListener('click', openModal);
            }
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (successCloseBtn) {
                successCloseBtn.addEventListener('click', function() {
                    closeModal();
                    window.location.reload();
                });
            }

            overlay?.addEventListener('click', function(e) {
                if (e.target === overlay) closeModal();
            });

            // Preset Buttons Click
            presetBtns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    presetBtns.forEach(b => {
                        b.style.borderColor = '#e2e8f0';
                        b.style.background = '#f8fafc';
                        b.style.color = '#1e293b';
                        b.style.fontWeight = '600';
                    });
                    this.style.borderColor = '#059669';
                    this.style.background = '#ecfdf5';
                    this.style.color = '#065f46';
                    this.style.fontWeight = '700';
                    if (customAmountInput) customAmountInput.value = this.dataset.amount;
                });
            });

            // Copy Account Number
            if (copyAccBtn) {
                copyAccBtn.addEventListener('click', function() {
                    const accNum = document.getElementById('faiiya-step2-acc-num')?.innerText.trim();
                    if (accNum) {
                        navigator.clipboard.writeText(accNum);
                        const origText = copyAccBtn.innerHTML;
                        copyAccBtn.innerText = 'Copied!';
                        setTimeout(() => { copyAccBtn.innerHTML = origText; }, 2000);
                    }
                });
            }

            // Step 1 -> Step 2
            if (proceedBtn) {
                proceedBtn.addEventListener('click', async function() {
                    const val = parseFloat(customAmountInput?.value || '0');
                    if (isNaN(val) || val <= 0) {
                        alert('Please enter a valid funding amount.');
                        return;
                    }

                    targetFundAmount = val;
                    const formatted = '₦' + val.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const displayEl = document.getElementById('faiiya-step2-amount-display');
                    if (displayEl) displayEl.innerText = formatted;

                    // Fetch freshest max txn id from server to guarantee no older transactions match
                    try {
                        const txRes = await fetch('<?php echo esc_url(rest_url("faiiya/v1/wallet/transactions")); ?>?per_page=1', {
                            headers: { 'X-WP-Nonce': '<?php echo $nonce; ?>', 'Accept': 'application/json' }
                        });
                        const txJson = await txRes.json();
                        if (txJson && txJson.data && txJson.data.transactions && txJson.data.transactions[0]) {
                            lastKnownTxnId = Math.max(lastKnownTxnId, parseInt(txJson.data.transactions[0].id, 10) || 0);
                        }
                    } catch (e) {}

                    step1.style.display = 'none';
                    step2.style.display = 'block';

                    startDepositPolling();
                });
            }

            if (step2BackBtn) {
                step2BackBtn.addEventListener('click', function() {
                    stopPolling();
                    step2.style.display = 'none';
                    step1.style.display = 'block';
                });
            }

            async function checkDepositStatus() {
                try {
                    const checkUrl = '<?php echo esc_url(rest_url("faiiya/v1/wallet/check-deposit")); ?>?since_id=' + encodeURIComponent(lastKnownTxnId) + '&expected_amount=' + encodeURIComponent(targetFundAmount);
                    const res = await fetch(checkUrl, {
                        headers: {
                            'X-WP-Nonce': '<?php echo $nonce; ?>',
                            'Accept': 'application/json'
                        }
                    });
                    const data = await res.json();

                    if (data && data.data && data.data.funded === true) {
                        stopPolling();
                        if (data.data.txn_id) {
                            lastKnownTxnId = Math.max(lastKnownTxnId, parseInt(data.data.txn_id, 10));
                        }
                        const creditedAmount = '₦' + parseFloat(data.data.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        const newBal = '₦' + parseFloat(data.data.balance_after).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                        const succAmt = document.getElementById('faiiya-success-amount');
                        const succBal = document.getElementById('faiiya-success-new-bal');
                        const liveBal = document.getElementById('faiiya-live-balance');

                        if (succAmt) succAmt.innerText = '+' + creditedAmount;
                        if (succBal) succBal.innerText = newBal;
                        if (liveBal) liveBal.innerText = parseFloat(data.data.balance_after).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                        step2.style.display = 'none';
                        step3.style.display = 'block';
                        return data.data;
                    }
                    return data ? data.data : null;
                } catch (err) {
                    console.error('Error polling Monnify deposit status:', err);
                    return null;
                }
            }

            function startDepositPolling() {
                stopPolling();
                pollInterval = setInterval(checkDepositStatus, 3000);
            }

            if (checkNowBtn) {
                checkNowBtn.addEventListener('click', async function() {
                    const statusMsg = document.getElementById('faiiya-check-status-msg');
                    this.disabled = true;
                    this.innerText = 'Checking payment...';
                    if (statusMsg) {
                        statusMsg.style.display = 'block';
                        statusMsg.innerText = 'Connecting to Monnify gateway...';
                    }
                    const res = await checkDepositStatus();
                    this.disabled = false;
                    this.innerText = '🔄 Check Status Now';
                    if (statusMsg && (!res || !res.funded)) {
                        statusMsg.innerText = 'No bank transfer detected yet. Still listening...';
                        setTimeout(() => { if (statusMsg) statusMsg.style.display = 'none'; }, 4000);
                    }
                });
            }

            // Dynamic Background Wallet Balance Synchronizer
            // Polls /wallet/balance to guarantee instant reflection of manual admin adjustments or deposits
            let lastKnownBalance = parseFloat('<?php echo (float) $wallet->balance; ?>') || 0;
            async function syncWalletBalanceDynamically() {
                try {
                    const balUrl = '<?php echo esc_url(rest_url("faiiya/v1/wallet/balance")); ?>';
                    const res = await fetch(balUrl, {
                        headers: {
                            'X-WP-Nonce': '<?php echo $nonce; ?>',
                            'Accept': 'application/json'
                        }
                    });
                    if (!res.ok) return;
                    const json = await res.json();
                    if (json && json.status === 'success' && json.data) {
                        const newBal = parseFloat(json.data.balance || 0);
                        const liveBalEl = document.getElementById('faiiya-live-balance');
                        if (liveBalEl) {
                            liveBalEl.innerText = newBal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                        if (Math.abs(newBal - lastKnownBalance) > 0.001) {
                            lastKnownBalance = newBal;
                            if (liveBalEl && liveBalEl.parentElement) {
                                liveBalEl.parentElement.style.transition = 'transform 0.25s ease';
                                liveBalEl.parentElement.style.transform = 'scale(1.04)';
                                setTimeout(() => { liveBalEl.parentElement.style.transform = 'scale(1)'; }, 350);
                            }
                        }
                    }
                } catch (e) {
                    // Fail silently in background
                }
            }

            // Initial immediate sync + recurring every 5 seconds
            setTimeout(syncWalletBalanceDynamically, 1000);
            setInterval(syncWalletBalanceDynamically, 5000);
        })();
        </script>
        <?php
        return ob_get_clean() ?: '';
    }

    public static function render_referrals(array $atts = []): string {
        if (!is_user_logged_in()) {
            return '<div class="faiiya-notice" style="padding: 18px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; color: #92400e; font-family: sans-serif;">' .
                '<p>' . sprintf(
                    __('Please <a href="%s" style="color: #059669; font-weight: bold;">log in</a> to access your referral dashboard and start earning rewards.', 'faiiya-pay'),
                    esc_url(wp_login_url(get_permalink()))
                ) . '</p>' .
                '</div>';
        }

        $user_id = get_current_user_id();
        $ref_model = new ReferralModel();
        $stats = $ref_model->get_stats($user_id);

        ob_start();
        ?>
        <div class="faiiya-referrals-dashboard" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; color: #0f172a;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 28px; border-radius: 16px; margin-bottom: 24px;">
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800;">
                    🎁 <?php esc_html_e('Invite Friends & Earn ₦500', 'faiiya-pay'); ?>
                </h2>
                <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 14px;">
                    <?php esc_html_e('Share your personal referral code. When a friend signs up and funds their wallet, you earn ₦500 credited automatically to your wallet balance!', 'faiiya-pay'); ?>
                </p>

                <!-- Code & Link Box -->
                <div style="background: rgba(255, 255, 255, 0.15); border-radius: 10px; padding: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.8;">
                            <?php esc_html_e('Your Unique Code', 'faiiya-pay'); ?>
                        </div>
                        <div style="font-size: 22px; font-weight: 800; letter-spacing: 0.1em; font-family: monospace;">
                            <?php echo esc_html($stats['referral_code']); ?>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <input type="text" readonly value="<?php echo esc_attr($stats['shareable_link']); ?>" id="faiiya-ref-link" style="padding: 8px 12px; border-radius: 6px; border: none; font-size: 12px; width: 220px; background: #ffffff; color: #0f172a;" />
                        <button type="button" onclick="navigator.clipboard.writeText(document.getElementById('faiiya-ref-link').value); alert('Referral link copied!');" style="background: #ffffff; color: #4338ca; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">
                            <?php esc_html_e('Copy Link', 'faiiya-pay'); ?>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px;">
                        <?php esc_html_e('Total Friends Referred', 'faiiya-pay'); ?>
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: #0f172a;">
                        <?php echo esc_html($stats['total_referrals']); ?>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px;">
                        <?php esc_html_e('Successful Conversions', 'faiiya-pay'); ?>
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: #059669;">
                        <?php echo esc_html($stats['successful_referrals']); ?>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center;">
                    <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 6px;">
                        <?php esc_html_e('Total Earned & Paid', 'faiiya-pay'); ?>
                    </div>
                    <div style="font-size: 32px; font-weight: 800; color: #4f46e5;">
                        ₦<?php echo number_format((float) $stats['total_earnings'], 2); ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean() ?: '';
    }

    public static function render_topup(array $atts = []): string {
        if (!is_user_logged_in()) {
            return '<div class="faiiya-notice" style="padding: 18px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; color: #92400e;">' .
                '<p>' . sprintf(
                    __('Please <a href="%s" style="color: #059669; font-weight: bold;">log in</a> to view your top-up account numbers.', 'faiiya-pay'),
                    esc_url(wp_login_url(get_permalink()))
                ) . '</p>' .
                '</div>';
        }

        $user_id = get_current_user_id();
        $va_model = new VirtualAccountModel();
        $virtual_accounts = $va_model->get_user_accounts($user_id);

        ob_start();
        ?>
        <div class="faiiya-topup-container" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; color: #0f172a;">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <h2 style="margin-top: 0; font-size: 22px; font-weight: 800; color: #0f172a;">
                    💳 <?php esc_html_e('Top Up Your Faiiya Wallet', 'faiiya-pay'); ?>
                </h2>
                <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">
                    <?php esc_html_e('Transfer any amount from your Nigerian bank app (GTBank, Access, Zenith, Kuda, OPay, Palmpay, etc.) to your dedicated virtual account. Credit is processed in under 3 seconds.', 'faiiya-pay'); ?>
                </p>

                <?php if (!empty($virtual_accounts)) : ?>
                    <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
                        <?php foreach ($virtual_accounts as $acc) : ?>
                            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 10px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-size: 13px; font-weight: 700; color: #059669; text-transform: uppercase;">
                                        <?php echo esc_html($acc['bank_name']); ?>
                                    </div>
                                    <div style="font-size: 22px; font-weight: 800; color: #0f172a; font-family: monospace;">
                                        <?php echo esc_html($acc['account_number']); ?>
                                    </div>
                                    <div style="font-size: 12px; color: #64748b;">
                                        <?php echo esc_html($acc['account_name']); ?>
                                    </div>
                                </div>
                                <button type="button" onclick="navigator.clipboard.writeText('<?php echo esc_attr($acc['account_number']); ?>'); alert('Account number copied: <?php echo esc_attr($acc['account_number']); ?>');" style="background: #059669; color: #ffffff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">
                                    <?php esc_html_e('Copy', 'faiiya-pay'); ?>
                                </button>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>

                <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px; border-radius: 6px; font-size: 13px; color: #1e40af;">
                    <strong>ℹ️ <?php esc_html_e('Tips for smooth funding:', 'faiiya-pay'); ?></strong>
                    <ul style="margin: 6px 0 0 16px; padding: 0;">
                        <li><?php esc_html_e('Funds deposited will reflect instantly in your wallet balance.', 'faiiya-pay'); ?></li>
                        <li><?php esc_html_e('No deposit transaction fees charged by Faiiya Pay.', 'faiiya-pay'); ?></li>
                        <li><?php esc_html_e('Use your wallet balance to checkout on WooCommerce in 1 click.', 'faiiya-pay'); ?></li>
                    </ul>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean() ?: '';
    }
}
