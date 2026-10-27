<?php
declare(strict_types=1);

namespace FaiiyaPay\Frontend;

use FaiiyaPay\Models\WalletModel;
use FaiiyaPay\Models\VirtualAccountModel;
use FaiiyaPay\Models\TransactionModel;
use FaiiyaPay\Models\ReferralModel;

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
                    <input type="password" name="password" minlength="8" required style="width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; box-sizing: border-box;" placeholder="••••••••" />
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
        $kyc_status = $wallet->kyc_status ?? 'unverified';
        $is_verified = ($kyc_status === 'verified' || $kyc_status === 'tier1_verified' || !empty($virtual_accounts));

        $va_model = new VirtualAccountModel();
        $virtual_accounts = $va_model->get_user_accounts($user_id);

        $txn_model = new TransactionModel();
        $transactions_data = $txn_model->get_user_transactions($user_id, 1, 10);
        $transactions = $transactions_data['transactions'] ?? [];

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
            
            <!-- KYC Status Header Banner -->
            <div id="faiiya-kyc-banner" style="background: <?php echo $is_verified ? '#f0fdf4' : '#fffbeb'; ?>; border: 1px solid <?php echo $is_verified ? '#bbf7d0' : '#fef3c7'; ?>; border-radius: 12px; padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;"><?php echo $is_verified ? '🛡️' : '⚠️'; ?></span>
                    <div>
                        <div style="font-size: 14px; font-weight: 700; color: <?php echo $is_verified ? '#166534' : '#92400e'; ?>;">
                            <?php echo $is_verified 
                                ? sprintf(esc_html__('Verified KYC Profile: %s', 'faiiya-pay'), esc_html("{$user->first_name} {$user->last_name}"))
                                : esc_html__('KYC Verification Pending (Tier 1)', 'faiiya-pay'); ?>
                        </div>
                        <div style="font-size: 12px; color: <?php echo $is_verified ? '#15803d' : '#b45309'; ?>;">
                            <?php echo $is_verified
                                ? esc_html__('Strict Monnify name sync active. Dedicated bank transfer accounts enabled.', 'faiiya-pay')
                                : esc_html__('Bank transfer deposit accounts are locked until your identity is verified with NIN or BVN.', 'faiiya-pay'); ?>
                        </div>
                    </div>
                </div>
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 20px; background: <?php echo $is_verified ? '#dcfce7' : '#fde68a'; ?>; color: <?php echo $is_verified ? '#166534' : '#92400e'; ?>;">
                    <span id="kyc-badge-text"><?php echo esc_html(strtoupper($is_verified ? 'verified' : 'unverified')); ?></span>
                </div>
            </div>

            <!-- UNVERIFIED: LOCKED STATE UI (Module D) - Mobile Responsive, Shows NIN First then "or BVN" -->
            <div id="faiiya-locked-kyc-card" style="display: <?php echo $is_verified ? 'none' : 'block'; ?>; background: #ffffff; border: 1px solid #fed7aa; border-radius: 16px; padding: 28px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); box-sizing: border-box;">
                <div class="faiiya-kyc-wrap" style="display: flex; gap: 16px; align-items: flex-start;">
                    <div style="background: #ffedd5; color: #ea580c; width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                        🔒
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 800; color: #9a3412;">
                            <?php esc_html_e('Unlock Virtual Bank Accounts with NIN (or BVN)', 'faiiya-pay'); ?>
                        </h3>
                        <p style="margin: 0 0 16px 0; font-size: 13px; color: #4b5563; line-height: 1.5;">
                            <?php esc_html_e('In compliance with Central Bank of Nigeria (CBN) and NDPR data regulations, submit your National Identity Number (NIN) or Bank Verification Number (BVN) below. We will provision your dedicated Monnify bank transfer accounts and activate your wallet immediately.', 'faiiya-pay'); ?>
                        </p>

                        <!-- Zero-Storage Guarantee Badge -->
                        <div style="display: inline-flex; align-items: center; gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; font-size: 11px; color: #475569; margin-bottom: 18px; max-width: 100%; box-sizing: border-box; flex-wrap: wrap;">
                            <span>🔒</span>
                            <span><?php esc_html_e('Zero-Storage Guarantee: Your NIN/BVN is verified via Monnify API and never stored on this server.', 'faiiya-pay'); ?></span>
                        </div>

                        <div id="faiiya-kyc-form-alert" style="display: none; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;"></div>

                        <form id="faiiya-kyc-verify-form" style="display: flex; flex-direction: column; gap: 14px; max-width: 520px;">
                            <div class="faiiya-radio-row" style="display: flex; gap: 16px; font-size: 13px; flex-wrap: wrap;">
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-weight: 600; color: #0f172a;">
                                    <input type="radio" name="kyc_type" value="nin" checked />
                                    <span><?php esc_html_e('National ID Number (NIN)', 'faiiya-pay'); ?></span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #334155;">
                                    <input type="radio" name="kyc_type" value="bvn" />
                                    <span><?php esc_html_e('or Bank Verification Number (BVN)', 'faiiya-pay'); ?></span>
                                </label>
                            </div>

                            <div class="faiiya-kyc-input-row" style="display: flex; gap: 8px; flex-wrap: wrap;">
                                <input type="text" id="kyc_id_input" name="kyc_id" required maxlength="11" minlength="11" pattern="\d{11}" placeholder="<?php esc_attr_e('Enter 11-digit NIN (or BVN)', 'faiiya-pay'); ?>" style="flex: 1; min-width: 200px; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; letter-spacing: 0.05em; font-family: monospace; box-sizing: border-box;" />
                                <button type="submit" id="faiiya-kyc-submit-btn" style="background: #059669; color: #ffffff; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap; min-height: 44px; box-sizing: border-box;">
                                    <?php esc_html_e('Verify NIN (or BVN) & Unlock →', 'faiiya-pay'); ?>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <!-- UNLOCKED / VERIFIED WALLET INTERFACE (Module D) -->
            <div id="faiiya-unlocked-section" style="display: <?php echo $is_verified ? 'block' : 'none'; ?>;">
                <!-- Balance Banner -->
                <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; padding: 28px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.3); margin-bottom: 24px;">
                    <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9; margin-bottom: 6px;">
                        <?php esc_html_e('Available Wallet Balance', 'faiiya-pay'); ?>
                    </div>
                    <div style="font-size: 38px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 14px;">
                        ₦<span id="faiiya-live-balance"><?php echo number_format((float) $wallet->balance, 2); ?></span>
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

                    <div id="faiiya-va-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px;">
                        <?php if (!empty($virtual_accounts)) : ?>
                            <?php foreach ($virtual_accounts as $acc) : ?>
                                <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; position: relative;">
                                    <div style="font-size: 12px; font-weight: 600; color: #059669; margin-bottom: 4px;">
                                        <?php echo esc_html($acc['bank_name']); ?>
                                    </div>
                                    <div style="font-size: 20px; font-weight: 700; color: #0f172a; font-family: monospace; letter-spacing: 0.05em; margin-bottom: 4px;">
                                        <?php echo esc_html($acc['account_number']); ?>
                                    </div>
                                    <div style="font-size: 12px; color: #64748b; margin-bottom: 10px;">
                                        <?php echo esc_html($acc['account_name']); ?>
                                    </div>
                                    <button type="button" onclick="navigator.clipboard.writeText('<?php echo esc_attr($acc['account_number']); ?>'); alert('Account number copied: <?php echo esc_attr($acc['account_number']); ?>');" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 5px 10px; border-radius: 5px; font-size: 11px; font-weight: 600; cursor: pointer;">
                                        📋 <?php esc_html_e('Copy Number', 'faiiya-pay'); ?>
                                    </button>
                                </div>
                            <?php endforeach; ?>
                        <?php else : ?>
                            <div style="padding: 12px; background: #f1f5f9; border-radius: 6px; font-size: 13px; color: #475569;">
                                <?php esc_html_e('Virtual accounts will appear here once KYC verification is completed.', 'faiiya-pay'); ?>
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
                                        $is_positive = in_array($txn['type'], ['deposit', 'referral_bonus', 'refund']);
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

                        <!-- Radar Waiting Animation Box -->
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 18px;">
                            <div style="display: flex; justify-content: center; margin-bottom: 12px;">
                                <div class="faiiya-radar-circle" style="width: 44px; height: 44px; border-radius: 50%; background: #059669; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                                    ⚡
                                </div>
                            </div>
                            <div style="font-size: 14px; font-weight: 700; color: #166534; margin-bottom: 4px;">
                                <?php esc_html_e('Waiting for Monnify Payment Notification...', 'faiiya-pay'); ?>
                            </div>
                            <div style="font-size: 12px; color: #15803d; line-height: 1.4;">
                                <?php esc_html_e('Listening live. Make the bank transfer now. Your wallet will automatically update the moment Monnify confirms the transaction.', 'faiiya-pay'); ?>
                            </div>
                            <div style="margin-top: 10px; font-size: 11px; color: #047857; font-family: monospace;">
                                <span class="faiiya-live-dot" style="display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-right: 6px;"></span>
                                <?php esc_html_e('Status: Actively polling Monnify every 3 seconds', 'faiiya-pay'); ?>
                            </div>
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
                    const kycType = kycForm.querySelector('input[name="kyc_type"]:checked').value;
                    const kycVal = inputField.value.trim();

                    if (kycVal.length !== 11) {
                        alertBox.style.display = 'block';
                        alertBox.style.background = '#fef2f2';
                        alertBox.style.color = '#991b1b';
                        alertBox.innerText = '<?php echo esc_js(__('Please enter an exact 11-digit number.', 'faiiya-pay')); ?>';
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
                            document.getElementById('faiiya-locked-kyc-card').style.display = 'none';
                            document.getElementById('faiiya-unlocked-section').style.display = 'block';
                            document.getElementById('kyc-badge-text').innerText = 'VERIFIED';
                            document.getElementById('faiiya-kyc-banner').style.background = '#f0fdf4';
                            document.getElementById('faiiya-kyc-banner').style.borderColor = '#bbf7d0';

                            const grid = document.getElementById('faiiya-va-grid');
                            if (grid && resData.data && resData.data.virtual_accounts) {
                                let html = '';
                                resData.data.virtual_accounts.forEach(function(acc) {
                                    html += '<div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">' +
                                        '<div style="font-size: 12px; font-weight: 600; color: #059669; margin-bottom: 4px;">' + acc.bank_name + '</div>' +
                                        '<div style="font-size: 20px; font-weight: 700; color: #0f172a; font-family: monospace; margin-bottom: 4px;">' + acc.account_number + '</div>' +
                                        '<div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">' + acc.account_name + '</div>' +
                                        '<button type="button" onclick="navigator.clipboard.writeText(\'' + acc.account_number + '\'); alert(\'Copied!\');" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">Copy</button>' +
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
                                    if (modalName) modalName.innerText = firstAcc.account_name;
                                }
                            }

                            alert('KYC Verified! Official name synced: ' + (resData.data.verified_name || 'Verified Customer') + '. Dedicated virtual accounts unlocked.');
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
            let fundStartTime = null;

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
            if (successCloseBtn) successCloseBtn.addEventListener('click', closeModal);

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
                proceedBtn.addEventListener('click', function() {
                    const val = parseFloat(customAmountInput?.value || '0');
                    if (isNaN(val) || val <= 0) {
                        alert('Please enter a valid funding amount.');
                        return;
                    }

                    const formatted = '₦' + val.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const displayEl = document.getElementById('faiiya-step2-amount-display');
                    if (displayEl) displayEl.innerText = formatted;

                    fundStartTime = new Date().toISOString();
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
                    const checkUrl = '<?php echo esc_url(rest_url("faiiya/v1/wallet/check-deposit")); ?>?since=' + encodeURIComponent(fundStartTime || '');
                    const res = await fetch(checkUrl, {
                        headers: {
                            'X-WP-Nonce': '<?php echo $nonce; ?>',
                            'Accept': 'application/json'
                        }
                    });
                    const data = await res.json();

                    if (data && data.data && data.data.funded) {
                        stopPolling();
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
                    }
                } catch (err) {
                    console.error('Error polling Monnify deposit status:', err);
                }
            }

            function startDepositPolling() {
                stopPolling();
                pollInterval = setInterval(checkDepositStatus, 3000);
            }

            if (checkNowBtn) {
                checkNowBtn.addEventListener('click', async function() {
                    this.disabled = true;
                    this.innerText = 'Checking...';
                    await checkDepositStatus();
                    this.disabled = false;
                    this.innerText = '🔄 Check Status Now';
                });
            }
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
