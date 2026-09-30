# Faiiya Pay — Enterprise WordPress Closed-Loop Digital Wallet & Monnify Gateway

[![License: GPL-2.0-or-later](https://img.shields.io/badge/License-GPL--2.0--or--later-emerald.svg)](http://www.gnu.org/licenses/gpl-2.0.txt)
[![PHP](https://img.shields.io/badge/PHP-8.1%20%7C%208.2%20%7C%208.3-777BB4?logo=php&logoColor=white)](https://www.php.net/)
[![WordPress](https://img.shields.io/badge/WordPress-6.0+-21759B?logo=wordpress&logoColor=white)](https://wordpress.org/)
[![WooCommerce](https://img.shields.io/badge/WooCommerce-8.0+-96588A?logo=woocommerce&logoColor=white)](https://woocommerce.com/)
[![Monnify API](https://img.shields.io/badge/Monnify-v2%20API-00B0FF)](https://monnify.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## 📌 Executive Summary

**Faiiya Pay** is an enterprise-grade fintech software suite comprising:
1. **A Production-Ready WordPress & WooCommerce Plugin (`faiiya-pay.zip`)**: Built following modern **PSR-4 autoloading** and modular architecture. It provisions a closed-loop digital wallet ledger, reserves dedicated Nigerian bank accounts via Monnify, validates government KYC identities with legal name synchronization, powers zero-friction WooCommerce checkout, and runs a viral tiered referral program.
2. **A High-Fidelity Web Simulation & Demonstration Application**: A reactive TypeScript/React dashboard designed for fintech merchants, developers, and administrators to test identity verification, simulate Monnify webhooks with cryptographic HMAC-SHA512 signatures, explore REST API endpoints, inspect database ledger rows, and download the compiled plugin ZIP package.

---

## 🏗️ System Architecture & Core Modules

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FAIIYA PAY ARCHITECTURE                           │
├───────────────────────────────────┬─────────────────────────────────────────┤
│       CUSTOMER CHANNELS           │           ADMIN & BACKEND               │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ • Responsive Customer Web Portal  │ • WordPress Admin Dashboard             │
│ • WooCommerce Checkout Gateway    │ • Wallet Query & Manual Adjustments     │
│ • Auto-Generated Portal Pages     │ • Monnify Gateway & Webhook Settings    │
│ • Headless Mobile REST APIs       │ • Cryptographic SHA-512 Audit Ledger    │
└───────────────────────────────────┴─────────────────────────────────────────┘
                                     │
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │                 MONNIFY FINTECH ENGINE                   │
        ├─────────────────────────────────────────────────────────┤
        │ • Identity Verification (NIN / BVN Match)               │
        │ • Reserved Account Generation (Wema, Sterling, Moniepoint)
        │ • Webhook Notifications (HMAC-SHA512 Authenticated)    │
        │ • Real-Time Notification & Atomic MySQL Row Locks       │
        └─────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. Government KYC Verification & Legal Name Compliance (Module A)
- **Primary NIN / BVN Input**: Compliant registration form featuring **First Name**, **Other Names (optional)**, and **Last Name**.
- **Live Monnify API Verification**: Connects directly to Monnify's verification endpoints (`/api/v1/vas/bvn-details-match` and `/api/v2/bank-transfer/reserved-accounts`).
- **Strict Compliance Name Replacement**: When NIN or BVN is verified, the user's First, Other, and Last names are automatically replaced and synchronized with the official government (NIMC / NIBSS) records, preventing synthetic identity fraud.
- **Zero Raw Storage Guarantee**: Raw 11-digit BVN/NIN numbers are verified over encrypted TLS 1.3 and are *never stored* in the database; only a masked token (e.g., `*******7821`) and compliance verification timestamps are recorded.

### 2. Dedicated Virtual Bank Accounts (DVA) (Module B)
- **Triple-Bank Redundancy**: Automatically provisions 3 dedicated accounts per customer:
  - **Wema Bank (ALAT)**
  - **Sterling Bank**
  - **Moniepoint Microfinance Bank**
- **Dynamic Naming Standards**:
  - **Account Name**: Strictly mapped to **The User's First Name** (e.g., `Chinedu`).
  - **Bank Name & Code**: Dynamically retrieved and labeled as supplied by the Monnify API.
- **Mobile Convenience**: One-tap copy buttons with visual feedback and touch optimization for mobile banking apps.

### 3. High-Concurrency Atomic Ledger & Webhooks (Module C)
- **Cryptographic Signature Verification**: Incoming webhook requests from Monnify (`POST /wp-json/faiiya/v1/webhook/monnify`) are verified against the secret key using **HMAC-SHA512**. Requests with mismatched hashes are rejected immediately with HTTP 401.
- **Atomic MySQL Row-Level Locking**: Implements `SELECT ... FOR UPDATE` row locks on `wp_faiiya_wallets` to eliminate race conditions, double-credit vulnerabilities, and simultaneous deposit conflicts.
- **Idempotency Shield**: Every Monnify `transactionReference` and `paymentReference` is tracked in a dedicated audit log table. Duplicate webhooks are logged and acknowledged with HTTP 200 without double-crediting balances.
- **Complete Audit Trail**: Every movement logs `balance_before`, `balance_after`, `reference`, `amount`, and a cryptographically unique `UUIDv4`.

### 4. WooCommerce Closed-Loop Wallet Gateway (Module D)
- **1-Click Checkout**: Seamless checkout option inside standard WooCommerce checkout (`WC_Gateway_Faiiya_Pay`).
- **Instant Balance Validation**: Customers with sufficient balance can complete orders without entering credit cards or leaving the store.
- **Order Synchronization**: Automatically marks paid orders as `processing` / `completed`, attaches ledger transaction references to order notes, and debits the customer's wallet atomically.

### 5. Viral Tiered Referral Engine (Module E)
- **Unique Referral Codes**: Automatically generated 8-character uppercase referral codes (e.g., `CHIN8921`) upon account registration.
- **Flexible Reward Triggers**:
  - **Trigger A (Recommended)**: Credited on the referee's first successful wallet deposit.
  - **Trigger B**: Credited upon registration and KYC verification.
- **Customer Referral Dashboard**: 1-click shareable links, live conversion statistics, and total referral bonus earnings.

### 6. WordPress Admin Dashboard & Dedicated Wallet Query Module (Module F)
- **Interactive Wallet Query Module**:
  - Search any customer wallet instantly by **User ID**, **Email Address**, **Customer Name**, or **Dedicated Virtual Account Number**.
  - Quick-select user chips for rapid customer assistance.
- **Fund Operations Panel (Add / Remove Funds)**:
  - **+ Add Funds (Credit)**: Admin courtesy deposits, promo gifts, bank transfer reconciliations.
  - **- Remove Funds (Debit)**: Dispute settlements, chargebacks, or administrative corrections.
  - **Live Balance Projection**: Real-time projected balance indicator with automated overdraft protection to prevent negative balances.
  - **Mandatory Audit Narration**: Enforces mandatory audit reasons stored directly in the transaction ledger.
- **Executive SaaS KPIs**:
  - System Custody Liquidity float indicator.
  - KYC Compliance Rate monitor (% of verified user base).
  - Monnify API health status and webhook delivery latency logger.

---

## 📱 Mobile-First SaaS Design & Experience

- **High-Density Mobile Quick-Action Dock**: Provides mobile users with immediate touch actions (**Fund Wallet**, **KYC NIN/BVN**, **Copy DVA**, and **Refer & Earn**).
- **Mobile Responsive Transaction Cards**: Small screens display clean, card-based ledger entries with status badges, eliminating horizontal table scroll fatigue.
- **Balance Privacy Eye Toggle**: Allows users in public spaces to toggle balance visibility (`₦••••••••` vs `₦50,000.00`) with one tap.
- **SaaS Typography & Aesthetics**: Styled with **Plus Jakarta Sans**, multi-layered box shadows (`shadow-saas`), smooth curves (`rounded-2xl`, `rounded-3xl`), and subtle micro-animations.

---

## 📂 Repository Structure

```
├── public/
│   └── faiiya-pay.zip              # Pre-compiled, verified WordPress plugin archive
├── plugin-source/
│   └── faiiya-pay/                 # Standalone PSR-4 WordPress plugin source code
│       ├── faiiya-pay.php          # Main bootstrap & WooCommerce loader
│       ├── composer.json           # Composer configuration & autoloader
│       ├── includes/
│       │   ├── Activator.php       # Database table installer (dbDelta) & page creator
│       │   ├── Deactivator.php     # Safe cleanup & transient flusher
│       │   ├── Admin/              # Admin pages, settings, & WP_List_Table
│       │   ├── API/                # Headless REST API controllers
│       │   ├── Frontend/           # Shortcodes & WooCommerce My Account portal
│       │   ├── Gateways/           # WooCommerce payment gateway integration
│       │   ├── Models/             # Database models with row-level locks
│       │   └── Services/           # Monnify API client & encryption
├── scripts/
│   └── compile-plugin-zip.ts       # Automated clean compiler with integrity checks
├── src/
│   ├── components/                 # React UI simulation components
│   │   ├── WPAdminDashboard.tsx    # Admin dashboard & wallet query module
│   │   ├── CustomerWalletView.tsx  # Mobile-responsive customer portal
│   │   ├── RegisterModal.tsx       # KYC onboarding & legal name compliance
│   │   ├── WooCommerceCheckout.tsx # Headless store & 1-click cart checkout
│   │   ├── ApiExplorer.tsx         # Interactive REST API testing console
│   │   └── CodeExplorer.tsx        # Plugin source browser & download manager
│   ├── services/
│   │   ├── faiiyaEngine.ts         # In-memory reactive state & Monnify engine
│   │   ├── zipExport.ts            # Robust browser blob download manager
│   │   └── pluginFiles.ts          # Registered production PHP source definitions
│   └── types/                      # TypeScript domain definitions
├── index.html                      # App entry point
├── package.json                    # Project dependencies & scripts
├── vite.config.ts                  # Vite build configuration
└── README.md                       # Comprehensive documentation
```

---

## 🔌 Headless REST API Reference

All endpoints are registered under the `/wp-json/faiiya/v1/` namespace.

| Method | Endpoint | Description | Auth Required |
|:-------|:---------|:------------|:-------------:|
| `POST` | `/auth/register` | Register new customer with First, Other, and Last names | No |
| `POST` | `/wallet/verify-kyc` | Verify NIN/BVN via Monnify & replace names | Yes |
| `GET`  | `/wallet/balance` | Retrieve active customer balance & status | Yes |
| `GET`  | `/wallet/transactions` | Query filtered wallet transaction ledger | Yes |
| `GET`  | `/wallet/virtual-accounts` | List dedicated Monnify bank accounts | Yes |
| `GET`  | `/referrals/stats` | Get referral code, invite link, & bonus stats | Yes |
| `POST` | `/checkout/wallet-pay` | Process headless 1-click checkout debit | Yes |
| `POST` | `/admin/wallet/adjust` | Administrative credit/debit with audit reason | Admin |
| `POST` | `/webhook/monnify` | Monnify automated bank transfer listener | Monnify HMAC |

### Sample Webhook Request Header & Payload

```http
POST /wp-json/faiiya/v1/webhook/monnify HTTP/1.1
Host: yourdomain.com
Content-Type: application/json
monnify-signature: a3b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9...

{
  "eventType": "SUCCESSFUL_TRANSACTION",
  "eventData": {
    "transactionReference": "MNFY_TX_9872134561",
    "paymentReference": "PAY_REF_1728000000",
    "amountPaid": 50000.00,
    "paymentStatus": "PAID",
    "customer": {
      "email": "customer@example.ng"
    },
    "destinationAccountInformation": {
      "accountNumber": "9928374182",
      "bankCode": "035"
    }
  }
}
```

---

## 🛠️ WordPress Installation & Production Setup

### 1. Download & Upload Plugin
1. Download the compiled `faiiya-pay.zip` archive directly from the application or from `/public/faiiya-pay.zip`.
2. In your WordPress Admin, navigate to **Plugins > Add New > Upload Plugin**.
3. Choose `faiiya-pay.zip` and click **Install Now**.
4. Click **Activate Plugin**.

### 2. Auto-Provisioned Database Tables
On activation, `FaiiyaPay\Activator` executes `dbDelta()` to create 5 production MySQL tables:
- `wp_faiiya_wallets`: Customer balances, statuses, and currencies.
- `wp_faiiya_transactions`: Audit log ledger with UUIDs and before/after balances.
- `wp_faiiya_virtual_accounts`: Reserved accounts linked to user IDs.
- `wp_faiiya_referrals`: Referral associations and reward payout statuses.
- `wp_faiiya_webhook_logs`: Monnify incoming payloads, timestamps, and hashes.

### 3. Automatic Shortcode Pages
The plugin automatically creates and publishes the following pages:
- **`/faiiya-wallet`**: Customer wallet dashboard (`[faiiya_wallet]`).
- **`/faiiya-referrals`**: Referral engine and earnings hub (`[faiiya_referrals]`).
- **`/faiiya-topup`**: Dedicated bank transfer instructions (`[faiiya_topup]`).
- **`/faiiya-dashboard`**: Unified customer portal (`[faiiya_pay_dashboard]`).

### 4. Monnify Credentials Configuration
1. In WordPress Admin, navigate to **Faiiya Pay > Monnify Gateway**.
2. Set Environment Mode: **Sandbox** (for testing) or **Live** (for production).
3. Enter your **Monnify API Key**, **Secret Key**, and **Contract Code**.
4. Copy your unique webhook URL:
   ```
   https://yourdomain.com/wp-json/faiiya/v1/webhook/monnify
   ```
5. Log into your [Monnify Merchant Dashboard](https://app.monnify.com/), navigate to **Settings > Webhooks**, paste the Webhook URL, and save changes.

### 5. Enable WooCommerce Payment Gateway
1. Navigate to **WooCommerce > Settings > Payments**.
2. Locate **Faiiya Pay Digital Wallet** and toggle it **On**.
3. Click **Manage** to customize gateway title, description, and order status mapping.

---

## 💻 Local Development & Build

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/faiiya-pay.git
cd faiiya-pay

# Install dependencies
npm install
```

### Development Server
```bash
# Start Vite development server on port 3000
npm run dev
```

### Compiling the WordPress Plugin ZIP
```bash
# Deletes previous zip, verifies all files, and compiles public/faiiya-pay.zip
npm run compile:zip
```

### Full Production Build
```bash
# Compiles the zip archive and builds the Vite frontend bundle into /dist
npm run build
```

### Code Quality & Validation
```bash
# Run TypeScript compilation checks
npm run lint
```

---

## 🛡️ Security & Anti-Fraud Standards

- **CBN & NDPR Compliance**: Raw identity numbers (BVN/NIN) are never persisted to disk or database. Verification is conducted over encrypted HTTPS/TLS 1.3 channels.
- **Timing Attack Mitigation**: Webhook signature verification uses PHP's constant-time string comparison function `hash_equals()`.
- **SQL Injection Prevention**: All database interactions use prepared statements via `$wpdb->prepare()`.
- **Cross-Site Request Forgery (CSRF)**: All administrative balance adjustments and settings updates require valid WordPress nonces (`check_admin_referer()`).
- **Strict Role-Based Access Control**: Manual balance modifications are restricted to users with the `manage_options` capability.

---

## 📄 License

This software is released under the **GNU General Public License v2.0 or later** (GPL-2.0-or-later). See the [LICENSE](http://www.gnu.org/licenses/gpl-2.0.txt) file for details.
