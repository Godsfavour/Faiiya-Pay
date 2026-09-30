import React, { useState } from 'react';
import {
  Terminal,
  Play,
  Copy,
  Check,
  Code2,
  Server,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';
import { User } from '../types';

interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST';
  path: string;
  title: string;
  description: string;
  authRequired: boolean;
  sampleBody?: Record<string, any>;
  sampleParams?: Record<string, string>;
}

const ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'register',
    method: 'POST',
    path: '/wp-json/faiiya/v1/auth/register',
    title: 'Customer Registration (Module A)',
    description:
      'Creates standard WordPress user with customer role, initializes unverified wallet balance, sets authentication cookies, and handles optional referral linking.',
    authRequired: false,
    sampleBody: {
      first_name: 'Babatunde',
      last_name: 'Fashola',
      email: 'babatunde.fashola@example.ng',
      password: 'SecurePassword123!',
      phone_number: '08012345678',
      referral_code: 'CHIN8921',
    },
  },
  {
    id: 'verify_kyc',
    method: 'POST',
    path: '/wp-json/faiiya/v1/wallet/verify-kyc',
    title: 'KYC Verification & Monnify Sync (Module B)',
    description:
      'Zero-Storage Policy: Accepts NIN or BVN strictly in-memory, provisions dedicated Monnify virtual accounts, overwrites WP names with Monnify verified name, and marks wallet as verified.',
    authRequired: true,
    sampleBody: {
      nin: '11223344556',
      bvn: '22345678901',
    },
  },
  {
    id: 'balance',
    method: 'GET',
    path: '/wp-json/faiiya/v1/wallet/balance',
    title: 'Get User Wallet Balance & Virtual Accounts',
    description:
      'Retrieves the authenticated customer current digital wallet balance and assigned Monnify virtual accounts.',
    authRequired: true,
  },
  {
    id: 'transactions',
    method: 'GET',
    path: '/wp-json/faiiya/v1/wallet/transactions',
    title: 'Get Paginated Wallet Ledger',
    description:
      'Returns paginated transaction records including UUID, before/after balances, reference, and metadata.',
    authRequired: true,
    sampleParams: {
      page: '1',
      per_page: '10',
      type: 'all',
    },
  },
  {
    id: 'referrals',
    method: 'GET',
    path: '/wp-json/faiiya/v1/referrals/stats',
    title: 'Get Referral Code & Earnings',
    description:
      'Fetches the user unique referral code, shareable link, successful sign-up count, and total cash rewards earned.',
    authRequired: true,
  },
  {
    id: 'checkout',
    method: 'POST',
    path: '/wp-json/faiiya/v1/checkout/wallet-pay',
    title: 'Headless Checkout Payment Execution',
    description:
      'Debits customer wallet atomically, validates order balance, and transitions WooCommerce order status to processing.',
    authRequired: true,
    sampleBody: {
      order_id: 502,
      amount: 45000.0,
      idempotency_key: 'IDEMP_' + Date.now(),
    },
  },
  {
    id: 'webhook',
    method: 'POST',
    path: '/wp-json/faiiya/v1/webhook/monnify',
    title: 'Monnify Inbound Webhook Listener',
    description:
      'Validates SHA-512 signature, verifies idempotency against duplicate funding, and credits wallet with row-level locks.',
    authRequired: false,
    sampleBody: {
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        transactionReference: 'MNFY_LIVE_' + Math.floor(1000000000 + Math.random() * 9000000000),
        paymentReference: 'PAY_MNFY_' + Date.now(),
        amountPaid: 75000.0,
        paymentStatus: 'PAID',
        customer: { email: 'chinedu.okafor@example.ng' },
        destinationAccountInformation: {
          accountNumber: '9928374182',
          bankCode: '035',
        },
      },
    },
  },
];

interface ApiExplorerProps {
  currentUser: User;
}

export const ApiExplorer: React.FC<ApiExplorerProps> = ({ currentUser }) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(ENDPOINTS[0]);
  const [requestBodyText, setRequestBodyText] = useState<string>(
    JSON.stringify(ENDPOINTS[0].sampleBody || {}, null, 2)
  );
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseBody, setResponseBody] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const handleSelectEndpoint = (ep: ApiEndpoint) => {
    setSelectedEndpoint(ep);
    setRequestBodyText(ep.sampleBody ? JSON.stringify(ep.sampleBody, null, 2) : '');
    setResponseStatus(null);
    setResponseBody(null);
  };

  const generateCurl = () => {
    let curl = `curl -X ${selectedEndpoint.method} "https://yourdomain.com${selectedEndpoint.path}" \\\n`;
    curl += `  -H "Content-Type: application/json" \\\n`;
    if (selectedEndpoint.authRequired) {
      curl += `  -H "Authorization: Bearer jwt_token_user_${currentUser.id}" \\\n`;
    }
    if (selectedEndpoint.method === 'POST' && requestBodyText.trim()) {
      curl += `  -d '${requestBodyText.replace(/\n/g, ' ')}'`;
    }
    return curl;
  };

  const handleRunRequest = () => {
    setLoading(true);
    setResponseStatus(null);
    setResponseBody(null);

    setTimeout(() => {
      try {
        const startTime = Date.now();
        let result: any = null;
        let status = 200;

        if (selectedEndpoint.id === 'register') {
          const parsed = JSON.parse(requestBodyText);
          const res = faiiyaEngine.registerUser({
            firstName: parsed.first_name,
            lastName: parsed.last_name,
            email: parsed.email,
            phoneNumber: parsed.phone_number,
            referredBy: parsed.referral_code,
          });
          status = 201;
          result = {
            status: 'success',
            message: 'User registered successfully. Proceed to verify KYC to unlock virtual accounts and full wallet features.',
            data: {
              user_id: res.user.id,
              username: res.user.username,
              email: res.user.email,
              first_name: res.user.firstName,
              last_name: res.user.lastName,
              role: res.user.role,
              referral_code: res.user.referralCode,
              wallet: {
                id: res.wallet.id,
                balance: res.wallet.balance,
                currency: res.wallet.currency,
                kyc_status: res.wallet.kycStatus,
              },
            },
          };
        } else if (selectedEndpoint.id === 'verify_kyc') {
          const parsed = JSON.parse(requestBodyText);
          const kycRes = faiiyaEngine.verifyKyc({
            userId: currentUser.id,
            bvnOrNin: parsed.bvn || parsed.nin,
          });
          status = 200;
          result = {
            status: 'success',
            message: 'KYC verified successfully. Monnify official name synchronized and dedicated virtual accounts provisioned.',
            data: {
              user_id: kycRes.user.id,
              first_name: kycRes.user.firstName,
              last_name: kycRes.user.lastName,
              kyc_status: kycRes.wallet.kycStatus,
              masked_id: kycRes.user.maskedBvn,
              zero_storage_policy: 'BVN/NIN processed strictly in-memory. Never written to database.',
              referral_bonus_unlocked: kycRes.referralCredited,
              virtual_accounts: kycRes.virtualAccounts.map((v) => ({
                bank_name: v.bankName,
                account_number: v.accountNumber,
                account_name: v.accountName,
                account_reference: v.accountReference,
              })),
            },
          };
        } else if (selectedEndpoint.id === 'balance') {
          const wallet = faiiyaEngine.getWallet(currentUser.id);
          const vas = faiiyaEngine.getVirtualAccounts(currentUser.id);
          result = {
            status: 'success',
            data: {
              wallet_id: wallet.id,
              user_id: currentUser.id,
              balance: wallet.balance,
              currency: wallet.currency,
              status: wallet.status,
              virtual_accounts: vas,
            },
          };
        } else if (selectedEndpoint.id === 'transactions') {
          const txns = faiiyaEngine.getTransactions(currentUser.id);
          result = {
            status: 'success',
            data: {
              total_records: txns.length,
              page: 1,
              per_page: 10,
              transactions: txns.slice(0, 10),
            },
          };
        } else if (selectedEndpoint.id === 'referrals') {
          const stats = faiiyaEngine.getReferralStats(currentUser.id);
          result = {
            status: 'success',
            data: stats,
          };
        } else if (selectedEndpoint.id === 'checkout') {
          const parsed = JSON.parse(requestBodyText);
          const wallet = faiiyaEngine.getWallet(currentUser.id);
          if (wallet.balance < parsed.amount) {
            status = 400;
            result = {
              code: 'faiiya_insufficient_funds',
              message: 'Insufficient wallet balance to cover the order total.',
              data: {
                current_balance: wallet.balance,
                required_amount: parsed.amount,
                shortfall: parsed.amount - wallet.balance,
              },
            };
          } else {
            const order = faiiyaEngine.processCheckout(currentUser.id, [
              {
                productId: 104,
                productName: 'API Direct Order Test',
                price: parsed.amount,
                quantity: 1,
              },
            ]);
            result = {
              status: 'success',
              message: 'Order debited atomically from wallet.',
              order_id: order.id,
              txn_uuid: order.txnUuid,
              remaining_balance: wallet.balance - parsed.amount,
            };
          }
        } else if (selectedEndpoint.id === 'webhook') {
          const parsed = JSON.parse(requestBodyText);
          const hookRes = faiiyaEngine.processMonnifyWebhook(parsed);
          status = hookRes.status === 'processed' ? 200 : hookRes.status === 'duplicate' ? 200 : 400;
          result = {
            gateway: 'monnify',
            signature_verification: 'VALID_SHA512',
            outcome: hookRes.status,
            message: hookRes.message,
            transaction: hookRes.txn,
          };
        }

        const duration = Date.now() - startTime;
        setResponseStatus(status);
        setResponseHeaders({
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Faiiya-Lock': 'row-level-mysql-pessimistic',
          'X-Response-Time': `${duration}ms`,
        });
        setResponseBody(result);
      } catch (err: any) {
        setResponseStatus(400);
        setResponseBody({
          code: 'bad_request',
          message: err.message,
        });
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              Headless REST API Console (/wp-json/faiiya/v1/*)
            </h1>
            <p className="text-xs text-slate-400">
              Interactive test console for React, Next.js, and React Native mobile client integrations.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Endpoint Directory (4 Cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider px-2 mb-2">
            Available Endpoints
          </div>
          {ENDPOINTS.map((ep) => {
            const isCur = selectedEndpoint.id === ep.id;
            return (
              <button
                key={ep.id}
                onClick={() => handleSelectEndpoint(ep)}
                className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                  isCur
                    ? 'bg-slate-800 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        ep.method === 'POST'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-xs font-bold truncate max-w-[190px]">
                      {ep.title}
                    </span>
                  </div>
                  {ep.authRequired && (
                    <span className="text-[10px] text-slate-500 font-mono">Auth</span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-400 truncate">
                  {ep.path}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Interactive Runner & Response Viewer (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Endpoint Info Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    selectedEndpoint.method === 'POST'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {selectedEndpoint.method}
                </span>
                <span className="text-slate-200 font-semibold">{selectedEndpoint.path}</span>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateCurl());
                  setCopiedCurl(true);
                  setTimeout(() => setCopiedCurl(false), 2000);
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy cURL</span>
              </button>
            </div>

            <p className="text-xs text-slate-300">{selectedEndpoint.description}</p>

            {selectedEndpoint.authRequired && (
              <div className="text-[11px] bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-400 flex items-center justify-between">
                <span>
                  Using mock auth session for user: <strong className="text-slate-200">{currentUser.email}</strong> (ID #{currentUser.id})
                </span>
                <span className="text-emerald-400 font-mono text-[10px]">Bearer Token Valid</span>
              </div>
            )}

            {/* Request Body Editor (if POST) */}
            {selectedEndpoint.method === 'POST' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Request Payload (JSON)
                </label>
                <textarea
                  rows={6}
                  value={requestBodyText}
                  onChange={(e) => setRequestBodyText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={loading}
                onClick={handleRunRequest}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {loading ? 'Executing...' : 'Send Request'}
              </button>
            </div>
          </div>

          {/* Response Viewer */}
          {responseStatus !== null && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300">HTTP Response:</span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      responseStatus >= 200 && responseStatus < 300
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {responseStatus} {responseStatus === 200 ? 'OK' : responseStatus === 201 ? 'CREATED' : 'BAD REQUEST'}
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  {responseHeaders['X-Response-Time']}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-1 font-mono">Response Body (application/json):</div>
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 overflow-x-auto max-h-80">
                  {JSON.stringify(responseBody, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
