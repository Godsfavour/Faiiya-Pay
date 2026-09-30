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
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: #ecfdf5; border-radius: 12px; color: #059669; font-size: 24px; margin-bottom: 12px;">
                    💳
                </div>
                <h2 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 800; color: #0f172a;">
                    <?php esc_html_e('Create Your Faiiya Pay Wallet', 'faiiya-pay'); ?>
                </h2>
                <p style="margin: 0; font-size: 13px; color: #64748b;">
                    <?php esc_html_e('Instant bank transfer top-ups and one-click closed-loop checkout.', 'faiiya-pay'); ?>
                </p>
            </div>

            <div id="faiiya-reg-alert" style="display: none; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 1.4;"></div>

            <form id="faiiya-pay-reg-form" style="display: flex; flex-direction: column; gap: 16px;">
                <div class="faiiya-reg-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                            <?php esc_html_e('First Name', 'faiiya-pay'); ?> *
                        </label>
                        <input type="text" name="first_name" id="faiiya-reg-first-name" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. Babatunde" />
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                            <?php esc_html_e('Other Names', 'faiiya-pay'); ?> <span style="font-weight: 400; color: #64748b;">(optional)</span>
                        </label>
                        <input type="text" name="other_names" id="faiiya-reg-other-names" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. Oluwaseun" />
                    </div>
                    <div>
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                            <?php esc_html_e('Last Name', 'faiiya-pay'); ?> *
                        </label>
                        <input type="text" name="last_name" id="faiiya-reg-last-name" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. Adeyemi" />
                    </div>
                </div>

                <!-- Identification (NIN First, then or BVN) -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                    <div style="font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">
                        <?php esc_html_e('National ID Number (NIN) or BVN (11 Digits)', 'faiiya-pay'); ?>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                        <?php esc_html_e('When verified via Monnify, your registered names are automatically replaced and synchronized with official NIBSS/NIMC records for regulatory compliance.', 'faiiya-pay'); ?>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #059669; margin-bottom: 4px;">
                                <?php esc_html_e('NIN (11 Digits - Primary)', 'faiiya-pay'); ?>
                            </label>
                            <input type="text" name="nin" id="faiiya-reg-nin" maxlength="11" pattern="[0-9]{11}" placeholder="11223344556" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-family: monospace; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                                <?php esc_html_e('or BVN (11 Digits)', 'faiiya-pay'); ?>
                            </label>
                            <input type="text" name="bvn" id="faiiya-reg-bvn" maxlength="11" pattern="[0-9]{11}" placeholder="22345678901" style="width: 100%; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; font-family: monospace; box-sizing: border-box;" />
                        </div>
                    </div>
                </div>

                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Phone Number', 'faiiya-pay'); ?> *
                    </label>
                    <input type="tel" name="phone_number" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" placeholder="e.g. 08031234567" />
                </div>

                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Email Address', 'faiiya-pay'); ?> *
                    </label>
                    <input type="email" name="email" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" placeholder="chinedu@example.ng" />
                </div>

                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Password (min 8 characters)', 'faiiya-pay'); ?> *
                    </label>
                    <input type="password" name="password" minlength="8" required style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box;" placeholder="••••••••" />
                </div>

                <div>
                    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
                        <?php esc_html_e('Referral Code (Optional)', 'faiiya-pay'); ?>
                    </label>
                    <input type="text" name="referral_code" value="<?php echo esc_attr($ref_code); ?>" style="width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; box-sizing: border-box; text-transform: uppercase;" placeholder="e.g. CHIN8921" />
                </div>

                <button type="submit" id="faiiya-reg-submit" style="width: 100%; background: #059669; color: #ffffff; border: none; padding: 13px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; margin-top: 6px;">
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
                    referral_code: formData.get('referral_code'),
                    nin: formData.get('nin'),
                    bvn: formData.get('bvn')
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

        $va_model = new VirtualAccountModel();
        $virtual_accounts = $va_model->get_user_accounts($user_id);

        $txn_model = new TransactionModel();
        $transactions_data = $txn_model->get_user_transactions($user_id, 1, 10);
        $transactions = $transactions_data['transactions'] ?? [];

        $ref_model = new ReferralModel();
        $ref_stats = $ref_model->get_stats($user_id);

        $verify_kyc_url = esc_url_raw(rest_url('faiiya/v1/wallet/verify-kyc'));
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
            <div id="faiiya-kyc-banner" style="background: <?php echo $kyc_status === 'verified' ? '#f0fdf4' : '#fffbeb'; ?>; border: 1px solid <?php echo $kyc_status === 'verified' ? '#bbf7d0' : '#fef3c7'; ?>; border-radius: 12px; padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;"><?php echo $kyc_status === 'verified' ? '🛡️' : '⚠️'; ?></span>
                    <div>
                        <div style="font-size: 14px; font-weight: 700; color: <?php echo $kyc_status === 'verified' ? '#166534' : '#92400e'; ?>;">
                            <?php echo $kyc_status === 'verified' 
                                ? sprintf(esc_html__('Verified KYC Profile: %s', 'faiiya-pay'), esc_html("{$user->first_name} {$user->last_name}"))
                                : esc_html__('KYC Verification Pending (Tier 1)', 'faiiya-pay'); ?>
                        </div>
                        <div style="font-size: 12px; color: <?php echo $kyc_status === 'verified' ? '#15803d' : '#b45309'; ?>;">
                            <?php echo $kyc_status === 'verified'
                                ? esc_html__('Strict Monnify name sync active. Instant bank transfer accounts enabled.', 'faiiya-pay')
                                : esc_html__('Bank transfer deposit accounts are locked until your identity is verified with NIN or BVN.', 'faiiya-pay'); ?>
                        </div>
                    </div>
                </div>
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 20px; background: <?php echo $kyc_status === 'verified' ? '#dcfce7' : '#fde68a'; ?>; color: <?php echo $kyc_status === 'verified' ? '#166534' : '#92400e'; ?>;">
                    <span id="kyc-badge-text"><?php echo esc_html(strtoupper($kyc_status)); ?></span>
                </div>
            </div>

            <!-- UNVERIFIED: LOCKED STATE UI (Module D) - Mobile Responsive, Shows NIN First then "or BVN" -->
            <div id="faiiya-locked-kyc-card" style="display: <?php echo $kyc_status === 'verified' ? 'none' : 'block'; ?>; background: #ffffff; border: 1px solid #fed7aa; border-radius: 16px; padding: 28px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); box-sizing: border-box;">
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
                            {/* Shows NIN first, then "or BVN" */}
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
            <div id="faiiya-unlocked-section" style="display: <?php echo $kyc_status === 'verified' ? 'block' : 'none'; ?>;">
                <!-- Balance Banner -->
                <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); color: #ffffff; padding: 28px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(5, 150, 105, 0.3); margin-bottom: 24px;">
                    <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.9; margin-bottom: 6px;">
                        <?php esc_html_e('Available Wallet Balance', 'faiiya-pay'); ?>
                    </div>
                    <div style="font-size: 38px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 14px;">
                        ₦<span id="faiiya-live-balance"><?php echo number_format((float) $wallet->balance, 2); ?></span>
                    </div>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <a href="<?php echo esc_url(get_permalink(get_option('faiiya_page_topup_id', 0)) ?: '#faiiya-va-box'); ?>" style="display: inline-block; background: #ffffff; color: #065f46; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
                            + <?php esc_html_e('Add Money (Top-Up)', 'faiiya-pay'); ?>
                        </a>
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

        <script>
        (function() {
            const kycForm = document.getElementById('faiiya-kyc-verify-form');
            const alertBox = document.getElementById('faiiya-kyc-form-alert');
            const submitBtn = document.getElementById('faiiya-kyc-submit-btn');
            const inputField = document.getElementById('kyc_id_input');

            if (!kycForm) return;

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
                        // Smoothly transition UI to unlocked state!
                        document.getElementById('faiiya-locked-kyc-card').style.display = 'none';
                        document.getElementById('faiiya-unlocked-section').style.display = 'block';
                        document.getElementById('kyc-badge-text').innerText = 'VERIFIED';
                        document.getElementById('faiiya-kyc-banner').style.background = '#f0fdf4';
                        document.getElementById('faiiya-kyc-banner').style.borderColor = '#bbf7d0';

                        // Render new virtual accounts
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
