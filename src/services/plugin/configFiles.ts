import { PluginFile } from '../pluginFiles';

export const configFiles: PluginFile[] = [
  {
    path: 'composer.json',
    name: 'composer.json',
    category: 'config',
    description: 'Composer package definition with PSR-4 autoloading and PHP 8.1+ configuration.',
    content: `{
  "name": "faiiya/faiiya-pay",
  "description": "Closed-loop digital wallet, automated Monnify virtual accounts top-up, tiered referral system, and headless REST API for WooCommerce.",
  "type": "wordpress-plugin",
  "license": "GPL-2.0-or-later",
  "authors": [
    {
      "name": "Faiiya Fintech Engineering",
      "email": "dev@faiiyapay.com"
    }
  ],
  "require": {
    "php": ">=8.1",
    "ext-json": "*",
    "ext-openssl": "*"
  },
  "autoload": {
    "psr-4": {
      "FaiiyaPay\\\\": "includes/"
    }
  }
}`
  },
  {
    path: 'README.md',
    name: 'README.md',
    category: 'config',
    description: 'Plugin documentation, installation steps, webhook setup, shortcodes, and API reference.',
    content: `# Faiiya Pay - WordPress / WooCommerce Fintech Plugin

Enterprise-grade closed-loop digital wallet, automated bank transfer top-ups via Monnify Reserved Accounts, tiered referral engine, and headless-ready REST API for WordPress & WooCommerce.

## 🚀 Key Features

1. **Closed-Loop Digital Wallet**
   - High-concurrency wallet ledger with atomic transactions and row-level locking (\`SELECT ... FOR UPDATE\`).
   - Audit trail tracking balance before, balance after, reference, and UUIDv4 for every movement.
   - Built-in WooCommerce Payment Gateway (\`faiiya_pay_wallet\`) for 1-click cart checkout.

2. **Automated Monnify Virtual Accounts Top-Up**
   - Provisions dedicated Nigerian bank accounts (Wema Bank, Sterling Bank, Moniepoint) per customer.
   - SHA-512 webhook verification (\`/wp-json/faiiya/v1/webhook/monnify\`).
   - Idempotent deposit processing with duplicate reference shielding.

3. **Tiered Viral Referral System**
   - Generates unique 8-character referral code per customer.
   - 1-click shareable links.
   - Configurable rewards (default ₦500.00) triggered either upon first wallet deposit or registration.

4. **Automatic WordPress Pages & Shortcodes**
   - **\`[faiiya_wallet]\`**: Complete self-contained customer wallet portal (balance, top-up bank accounts, live transaction ledger).
   - **\`[faiiya_referrals]\`**: Customer referral dashboard with stats, code, and 1-click copy link.
   - **\`[faiiya_topup]\`**: Dedicated bank transfer top-up instructions with copyable virtual account numbers.
   - Automatically creates \`/faiiya-wallet\`, \`/faiiya-referrals\`, and \`/faiiya-topup\` upon plugin activation.
   - Seamlessly adds "My Wallet" and "Referrals" into WooCommerce My Account menu!

5. **Headless & Mobile Ready REST APIs**
   - \`POST /wp-json/faiiya/v1/auth/register\`
   - \`GET  /wp-json/faiiya/v1/wallet/balance\`
   - \`GET  /wp-json/faiiya/v1/wallet/transactions\`
   - \`GET  /wp-json/faiiya/v1/referrals/stats\`
   - \`POST /wp-json/faiiya/v1/checkout/wallet-pay\`
   - \`POST /wp-json/faiiya/v1/webhook/monnify\`

## 📦 Installation
1. Upload the downloaded \`faiiya-pay.zip\` via **Plugins > Add New > Upload Plugin** in WordPress.
2. Click **Activate Plugin**.
3. Go to **Faiiya Pay > Settings** to configure your Monnify API Key, Secret Key, and Contract Code.
4. Copy the Webhook URL into your Monnify Merchant Dashboard.
5. In **WooCommerce > Settings > Payments**, ensure **Faiiya Pay Digital Wallet** is enabled.
`
  }
];
