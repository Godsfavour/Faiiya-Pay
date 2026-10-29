import React, { useState } from 'react';
import {
  Sliders,
  Settings,
  List,
  Activity,
  Search,
  Check,
  Copy,
  AlertCircle,
  Save,
  RotateCcw,
  Sparkles,
  Shield,
  FileText,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  Lock,
  UserCheck,
  TrendingUp,
  RefreshCw,
  Bell,
  Download,
  AlertTriangle,
  Snowflake,
  ShieldAlert,
  Send,
  Eye,
  Percent,
  Layers,
  Banknote,
  Calendar,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';
import { User, PluginSettings, WithdrawalRequest, NotificationLog, WebhookLog } from '../types';
import { AdminPinModal } from './AdminPinModal';

type AdminTab =
  | 'wallets'
  | 'withdrawals'
  | 'merchant_float'
  | 'reporting'
  | 'notifications'
  | 'settings'
  | 'webhooks';

export const WPAdminDashboard: React.FC = () => {
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('wallets');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Dedicated Query Wallet & Balance Operations Module State
  const users = faiiyaEngine.getUsers();
  const [walletQueryInput, setWalletQueryInput] = useState<string>('');
  const [queriedUser, setQueriedUser] = useState<User | null>(() => {
    // Default to first customer or null
    const firstCustomer = users.find((u) => u.role === 'customer');
    return firstCustomer || null;
  });
  const [queryError, setQueryError] = useState<string | null>(null);
  const [modAdjustmentType, setModAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [modAdjustmentAmount, setModAdjustmentAmount] = useState<string>('5000');
  const [modAuditReason, setModAuditReason] = useState<string>('');
  const [freezeReason, setFreezeReason] = useState<string>('');

  // 2FA Admin PIN Modal State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pending2faAction, setPending2faAction] = useState<{
    title: string;
    description: string;
    warning?: string;
    execute: () => void;
  } | null>(null);

  // Settings Form State
  const currentSettings = faiiyaEngine.getSettings();
  const [settingsForm, setSettingsForm] = useState<PluginSettings>(currentSettings);

  // Reporting Filters
  const [reportDateRange, setReportDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [reportTxnType, setReportTxnType] = useState<string>('all');

  // Withdrawal Filter
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('Account details mismatch');

  // Notification Filter
  const [notificationChannelFilter, setNotificationChannelFilter] = useState<'all' | 'sms' | 'email'>('all');
  const [selectedNotificationTemplate, setSelectedNotificationTemplate] = useState<NotificationLog | null>(null);

  const webhookLogs = faiiyaEngine.getWebhookLogs();
  const withdrawals = faiiyaEngine.getWithdrawals();
  const merchantFloat = faiiyaEngine.getMerchantFloat();
  const notificationLogs = faiiyaEngine.getNotificationLogs();
  const transactions = faiiyaEngine.getTransactions();

  const webhookUrl = 'https://yourdomain.com/wp-json/faiiya/v1/webhook/monnify';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const request2fa = (params: {
    title: string;
    description: string;
    warning?: string;
    execute: () => void;
  }) => {
    setPending2faAction(params);
    setIsPinModalOpen(true);
  };

  // --- WALLET QUERY & ADJUSTMENT ---
  const handleQueryWallet = (overrideQuery?: string) => {
    const term = (overrideQuery !== undefined ? overrideQuery : walletQueryInput).trim();
    if (!term) {
      setQueryError('Please enter a User ID, Email, Customer Name, or Dedicated Account Number.');
      return;
    }

    const res = faiiyaEngine.queryWallet(term);
    if (!res) {
      setQueryError(`No customer wallet found for query "${term}". Please check the ID or email.`);
      setQueriedUser(null);
    } else {
      setQueriedUser(res.user);
      setWalletQueryInput(res.user.id.toString());
      setQueryError(null);
    }
  };

  const handleExecuteAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queriedUser) return;

    const amt = parseFloat(modAdjustmentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid adjustment amount.');
      return;
    }

    if (!modAuditReason.trim()) {
      alert('Mandatory audit reason is required for manual balance adjustments.');
      return;
    }

    const currentBal = faiiyaEngine.getWallet(queriedUser.id).balance;
    if (modAdjustmentType === 'debit' && currentBal < amt) {
      alert(`Cannot debit ₦${amt.toLocaleString()}: User available balance is only ₦${currentBal.toLocaleString()}.`);
      return;
    }

    // Trigger 2FA PIN
    request2fa({
      title: `Authorize Wallet ${modAdjustmentType === 'credit' ? 'Credit (+)' : 'Debit (-)'}`,
      description: `${modAdjustmentType === 'credit' ? 'Credit' : 'Debit'} ₦${amt.toLocaleString()} to ${
        queriedUser.firstName
      } ${queriedUser.lastName} (${queriedUser.email}). Reason: "${modAuditReason}"`,
      warning:
        modAdjustmentType === 'debit'
          ? 'Warning: This will immediately deduct funds from customer available balance.'
          : undefined,
      execute: () => {
        try {
          faiiyaEngine.adminAdjustWallet({
            userId: queriedUser.id,
            type: modAdjustmentType,
            amount: amt,
            auditReason: modAuditReason.trim(),
          });
          showNotice(
            `✓ Successfully executed ${modAdjustmentType === 'credit' ? 'CREDIT (+)' : 'DEBIT (-)'} of ₦${amt.toLocaleString()} for ${
              queriedUser.firstName
            } ${queriedUser.lastName}`
          );
          setModAuditReason('');
        } catch (err: any) {
          alert(err.message);
        }
      },
    });
  };

  const handleToggleFreeze = (user: User) => {
    const wallet = faiiyaEngine.getWallet(user.id);
    const isFrozen = wallet.status === 'frozen';

    if (isFrozen) {
      request2fa({
        title: 'Authorize Wallet Unfreeze',
        description: `Restore ${user.firstName} ${user.lastName}'s account to Active status. Customer will be able to top up and withdraw.`,
        execute: () => {
          try {
            faiiyaEngine.unfreezeWallet(user.id, faiiyaEngine.getSettings().adminSecurityPin);
            showNotice(`✓ Unfroze account for ${user.firstName} ${user.lastName}. Wallet restored to Active.`);
          } catch (err: any) {
            alert(err.message);
          }
        },
      });
    } else {
      const reason = freezeReason.trim() || 'Suspicious velocity / Compliance check';
      request2fa({
        title: 'Authorize Account Suspension / Freeze',
        description: `Suspend ${user.firstName} ${user.lastName}'s wallet. Debits, withdrawals, and purchases will be blocked immediately.`,
        warning: 'Urgent compliance alert will be dispatched to customer email and SMS.',
        execute: () => {
          try {
            faiiyaEngine.freezeWallet(user.id, reason, faiiyaEngine.getSettings().adminSecurityPin);
            showNotice(`✓ Suspended account for ${user.firstName} ${user.lastName}. Reason: ${reason}`);
            setFreezeReason('');
          } catch (err: any) {
            alert(err.message);
          }
        },
      });
    }
  };

  // --- WITHDRAWAL APPROVALS ---
  const handleApproveWithdrawal = (w: WithdrawalRequest) => {
    request2fa({
      title: 'Authorize Outflow Bank Disbursement',
      description: `Approve withdrawal payout of ₦${w.netPayout.toLocaleString()} to ${w.accountName} (${w.bankName} - ${w.accountNumber}).`,
      warning: 'Outflow settlement will be debited against Monnify merchant float and marked paid.',
      execute: () => {
        try {
          faiiyaEngine.approveWithdrawal(w.id, faiiyaEngine.getSettings().adminSecurityPin);
          showNotice(`✓ Successfully approved withdrawal payout of ₦${w.netPayout.toLocaleString()} to ${w.accountName}`);
        } catch (err: any) {
          alert(err.message);
        }
      },
    });
  };

  const handleRejectWithdrawal = (w: WithdrawalRequest) => {
    const reason = prompt('Please enter reason for declining this withdrawal (customer will be notified):', rejectReasonInput);
    if (reason === null) return;
    if (!reason.trim()) {
      alert('A decline reason is mandatory.');
      return;
    }

    request2fa({
      title: 'Authorize Withdrawal Rejection & Refund',
      description: `Decline withdrawal of ₦${w.amount.toLocaleString()} for ${w.accountName} and immediately refund ₦${w.amount.toLocaleString()} to customer wallet.`,
      execute: () => {
        try {
          faiiyaEngine.rejectWithdrawal(w.id, reason, faiiyaEngine.getSettings().adminSecurityPin);
          showNotice(`✓ Declined withdrawal and refunded ₦${w.amount.toLocaleString()} to customer wallet.`);
        } catch (err: any) {
          alert(err.message);
        }
      },
    });
  };

  // --- FEE SETTINGS SAVE ---
  const handleSaveFeeSettings = (e: React.FormEvent) => {
    e.preventDefault();
    request2fa({
      title: 'Authorize Fee & Limit Rules Update',
      description: `Update platform fee configuration (Bearer: ${settingsForm.feeBearer}, Deposit Fee: ${settingsForm.depositFeeValue}${settingsForm.depositFeeType === 'percentage' ? '%' : ' NGN'}, Withdrawal Fee: ${settingsForm.withdrawalFeeValue} NGN).`,
      warning: 'These settings immediately apply to all real-time customer top-ups and bank outflows.',
      execute: () => {
        try {
          faiiyaEngine.updateFeeSettings(settingsForm, faiiyaEngine.getSettings().adminSecurityPin);
          showNotice('✓ Platform fee rules and transaction limits updated successfully.');
        } catch (err: any) {
          alert(err.message);
        }
      },
    });
  };

  // --- CSV EXPORT ---
  const handleDownloadCsv = () => {
    const csvContent = faiiyaEngine.exportTransactionsCsv({
      type: reportTxnType === 'all' ? undefined : reportTxnType,
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `faiiya_pay_statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotice('✓ Financial statement CSV exported successfully.');
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const cleanNum = searchQuery.replace(/\D/g, '');

    const nameMatch = `${u.firstName} ${u.otherNames || ''} ${u.lastName}`.toLowerCase().includes(q);
    const emailMatch = u.email.toLowerCase().includes(q);
    const idMatch = u.id.toString() === q || `#${u.id}` === q;
    const phoneMatch = (u.phoneNumber || '').toLowerCase().includes(q);
    const refMatch = (u.referralCode || '').toLowerCase().includes(q);

    const userVas = faiiyaEngine.getVirtualAccounts(u.id);
    const vaMatch = userVas.some(
      (va) =>
        va.accountNumber.includes(cleanNum || q) ||
        va.bankName.toLowerCase().includes(q) ||
        va.accountName.toLowerCase().includes(q)
    );

    return nameMatch || emailMatch || idMatch || phoneMatch || refMatch || vaMatch;
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (withdrawalFilter === 'all') return true;
    return w.status === withdrawalFilter;
  });

  const filteredNotifications = notificationLogs.filter((n) => {
    if (notificationChannelFilter === 'all') return true;
    return n.channel === notificationChannelFilter;
  });

  // Calculate Reporting Metrics
  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
  const totalDeposits = transactions
    .filter((t) => t.type === 'deposit')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalOrderDebits = transactions
    .filter((t) => t.type === 'debit_order')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawn = withdrawals
    .filter((w) => w.status === 'approved')
    .reduce((sum, w) => sum + w.netPayout, 0);
  const totalFees = withdrawals
    .filter((w) => w.status === 'approved')
    .reduce((sum, w) => sum + w.fee, 0);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Production Live Mode
              </span>
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
                Faiiya Pay v2.4 Enterprise
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              WordPress & Monnify Admin Console
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Real-time closed-loop wallet management, Monnify merchant float oversight, 2FA-secured balance adjustments, and bank outflow pipelines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5">
              <div className="text-xs text-slate-400 font-medium">Merchant Settled Float</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                ₦{merchantFloat.settledMerchantBalance.toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-2.5">
              <div className="text-xs text-slate-400 font-medium">Pending Withdrawals</div>
              <div className="text-lg font-bold text-amber-400 font-mono">
                {withdrawals.filter((w) => w.status === 'pending').length}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="mt-8 border-t border-slate-800 pt-4 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveAdminTab('wallets')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeAdminTab === 'wallets'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Wallets & Query Module</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('withdrawals')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeAdminTab === 'withdrawals'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Bank Outflows (Withdrawals)</span>
            {withdrawals.filter((w) => w.status === 'pending').length > 0 && (
              <span className="px-1.5 py-0.5 text-2xs font-extrabold rounded-full bg-amber-500 text-slate-950">
                {withdrawals.filter((w) => w.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('merchant_float')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeAdminTab === 'merchant_float'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Float Monitor & Fees</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('reporting')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeAdminTab === 'reporting'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Financial Statements</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('notifications')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeAdminTab === 'notifications'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>SMS & Email Alerts</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('settings')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeAdminTab === 'settings'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Gateway Settings</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('webhooks')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 ${
              activeAdminTab === 'webhooks'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Webhooks</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WALLETS & QUERY MODULE */}
      {/* ========================================================================= */}
      {activeAdminTab === 'wallets' && (
        <div className="space-y-6">
          {/* Query Module Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Search className="w-5 h-5 text-emerald-400" />
                  <span>Customer Wallet Query & Operations Engine</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Lookup any customer by User ID, Email, Customer Name, or Dedicated Virtual Account number to inspect real-time ledger balance and execute 2FA-protected operations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Quick Select:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setWalletQueryInput(e.target.value);
                      handleQueryWallet(e.target.value);
                    }
                  }}
                  value={queriedUser?.id.toString() || ''}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Registered Customers ({users.filter((u) => u.role === 'customer').length}) --</option>
                  {users
                    .filter((u) => u.role === 'customer')
                    .map((u) => (
                      <option key={u.id} value={u.id.toString()}>
                        #{u.id} - {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Query Search Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQueryWallet();
              }}
              className="flex flex-col sm:flex-row gap-3 mb-6"
            >
              <div className="relative flex-1">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Enter User ID (e.g. 2), Email, Full Name, or Virtual Account Number..."
                  value={walletQueryInput}
                  onChange={(e) => setWalletQueryInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Query Wallet</span>
              </button>
            </form>

            {queryError && (
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center gap-2 mb-6">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{queryError}</span>
              </div>
            )}

            {/* Queried User Details Card */}
            {queriedUser ? (
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold flex items-center justify-center text-lg shadow-md">
                      {queriedUser.firstName.charAt(0)}
                      {queriedUser.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white">
                          {queriedUser.firstName} {queriedUser.otherNames || ''} {queriedUser.lastName}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-mono">
                          User #{queriedUser.id}
                        </span>
                        {faiiyaEngine.getWallet(queriedUser.id).status === 'frozen' ? (
                          <span className="px-2 py-0.5 text-2xs font-extrabold uppercase rounded-lg bg-red-500/10 text-red-400 border border-red-500/30">
                            Frozen
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-2xs font-extrabold uppercase rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>{queriedUser.email}</span>
                        <span>&bull;</span>
                        <span>{queriedUser.phoneNumber || 'N/A'}</span>
                        <span>&bull;</span>
                        <span className="text-emerald-400 font-medium">NIMC/NIBSS Verified</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">
                        Available Balance
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        ₦{faiiyaEngine.getWallet(queriedUser.id).balance.toLocaleString()}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleFreeze(queriedUser)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        faiiyaEngine.getWallet(queriedUser.id).status === 'frozen'
                          ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                          : 'bg-red-500/10 border border-red-500/40 text-red-300 hover:bg-red-500/20'
                      }`}
                    >
                      <Snowflake className="w-3.5 h-3.5" />
                      <span>
                        {faiiyaEngine.getWallet(queriedUser.id).status === 'frozen'
                          ? 'Unfreeze Account'
                          : 'Freeze Account'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Dedicated Virtual Accounts Pill Bar */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2.5">
                    Dedicated Monnify Virtual Accounts (Reserved for Direct Inflow)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {faiiyaEngine.getVirtualAccounts(queriedUser.id).map((va) => (
                      <div
                        key={va.id}
                        className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
                      >
                        <div>
                          <div className="text-2xs text-slate-400 font-medium">{va.bankName}</div>
                          <div className="font-mono text-sm font-bold text-white tracking-wider">
                            {va.accountNumber}
                          </div>
                          <div className="text-2xs text-emerald-400">Account Name: {va.accountName}</div>
                        </div>
                        <button
                          onClick={() => copyToClipboard(va.accountNumber, `va_${va.id}`)}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-lg transition-colors"
                        >
                          {copiedKey === `va_${va.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balance Operations Form */}
                <form
                  onSubmit={handleExecuteAdjustment}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>2FA-Secured Balance Adjustment (Credit / Debit)</span>
                    </span>
                    <span className="text-2xs text-slate-400">Requires 6-Digit Admin Security PIN</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                        Operation Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setModAdjustmentType('credit')}
                          className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all ${
                            modAdjustmentType === 'credit'
                              ? 'bg-emerald-500 text-slate-950 shadow-md'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                          <span>Credit (+)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModAdjustmentType('debit')}
                          className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all ${
                            modAdjustmentType === 'debit'
                              ? 'bg-red-500 text-white shadow-md'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>Debit (-)</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                        Adjustment Amount (NGN)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={modAdjustmentAmount}
                        onChange={(e) => setModAdjustmentAmount(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                        placeholder="5000"
                      />
                    </div>

                    <div>
                      <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                        Mandatory Audit Reason
                      </label>
                      <input
                        type="text"
                        value={modAuditReason}
                        onChange={(e) => setModAuditReason(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. Monnify manual bank wire resolution"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                        modAdjustmentType === 'credit'
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                          : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <span>
                        Authorize {modAdjustmentType === 'credit' ? 'Credit (+)' : 'Debit (-)'} with 2FA PIN
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
                No customer selected. Use the query bar above or register a new customer in the store.
              </div>
            )}
          </div>

          {/* Customer Ledger Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <List className="w-5 h-5 text-emerald-400" />
                  <span>Customer Directory & Wallet Status</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Full list of live production accounts.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">Customer Legal Name</th>
                    <th className="py-3 px-3">Email & Phone</th>
                    <th className="py-3 px-3">Monnify Virtual Accounts</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Balance</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const w = faiiyaEngine.getWallet(u.id);
                    const userVas = faiiyaEngine.getVirtualAccounts(u.id);

                    return (
                      <tr key={u.id} className="hover:bg-slate-850/40 transition-colors">
                        <td className="py-3.5 px-3 font-mono text-slate-400 font-bold">#{u.id}</td>
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-white">
                            {u.firstName} {u.otherNames || ''} {u.lastName}
                          </div>
                          <div className="text-2xs text-slate-400">Ref Code: {u.referralCode}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-slate-300">{u.email}</div>
                          <div className="text-2xs text-slate-400">{u.phoneNumber || 'N/A'}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          {userVas.length === 0 ? (
                            <span className="text-2xs text-slate-500 italic">No virtual accounts (Unverified)</span>
                          ) : (
                            <div className="space-y-1">
                              {userVas.map((va) => (
                                <div key={va.id} className="flex items-center gap-1.5 font-mono text-2xs">
                                  <span className="text-emerald-400 font-bold">{va.bankName.split(' ')[0]}:</span>
                                  <span className="text-white font-bold">{va.accountNumber}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(va.accountNumber, `va_${va.id}`)}
                                    className="p-1 hover:text-emerald-400 text-slate-400 transition-colors"
                                    title="Copy account number"
                                  >
                                    {copiedKey === `va_${va.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5">
                            {w.status === 'frozen' ? (
                              <span className="px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 text-2xs font-extrabold uppercase">
                                Frozen
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-2xs font-extrabold uppercase">
                                Active
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-2xs font-medium">
                              {w.kycStatus === 'verified' ? 'Verified' : 'Unverified'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-sm text-emerald-400">
                          ₦{w.balance.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => {
                              setQueriedUser(u);
                              setWalletQueryInput(u.id.toString());
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BANK OUTFLOWS (WITHDRAWALS) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'withdrawals' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <div className="text-xs text-slate-400 font-medium">Pending Payouts</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                {withdrawals.filter((w) => w.status === 'pending').length}
              </div>
              <div className="text-2xs text-slate-500 mt-1">Requires 2FA Admin Authorization</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <div className="text-xs text-slate-400 font-medium">Total Paid Out</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                ₦
                {withdrawals
                  .filter((w) => w.status === 'approved')
                  .reduce((sum, w) => sum + w.netPayout, 0)
                  .toLocaleString()}
              </div>
              <div className="text-2xs text-slate-500 mt-1">Settled to beneficiary bank accounts</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <div className="text-xs text-slate-400 font-medium">Withdrawal Fees Retained</div>
              <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
                ₦
                {withdrawals
                  .filter((w) => w.status === 'approved')
                  .reduce((sum, w) => sum + w.fee, 0)
                  .toLocaleString()}
              </div>
              <div className="text-2xs text-slate-500 mt-1">Platform revenue from outflows</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                  <span>Customer Outflow Bank Withdrawal Pipeline</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customer withdrawal requests debit wallet upon submission and undergo compliance review before outbound NIP transfer.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filter:</span>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setWithdrawalFilter(s)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all ${
                      withdrawalFilter === s
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {filteredWithdrawals.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
                No withdrawal requests found under filter &quot;{withdrawalFilter}&quot;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-3">Reference / Date</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Destination Account</th>
                      <th className="py-3 px-3 text-right">Requested</th>
                      <th className="py-3 px-3 text-right">Net Payout</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredWithdrawals.map((w) => {
                      const user = faiiyaEngine.getUserById(w.userId);
                      return (
                        <tr key={w.id} className="hover:bg-slate-850/40 transition-colors">
                          <td className="py-3.5 px-3">
                            <div className="font-mono font-bold text-slate-300">{w.transactionReference}</div>
                            <div className="text-2xs text-slate-500">{new Date(w.createdAt).toLocaleString()}</div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-semibold text-white">
                              {user ? `${user.firstName} ${user.lastName}` : `User #${w.userId}`}
                            </div>
                            <div className="text-2xs text-slate-400">{user?.email}</div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-200">{w.accountName}</div>
                            <div className="text-2xs text-slate-400 font-mono">
                              {w.bankName} &bull; {w.accountNumber}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-300">
                            ₦{w.amount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-400">
                            ₦{w.netPayout.toLocaleString()}
                            <div className="text-2xs text-slate-400 font-normal">Fee: ₦{w.fee}</div>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {w.status === 'pending' && (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-2xs font-extrabold uppercase">
                                Pending
                              </span>
                            )}
                            {w.status === 'approved' && (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-2xs font-extrabold uppercase">
                                Approved & Paid
                              </span>
                            )}
                            {w.status === 'rejected' && (
                              <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 text-2xs font-extrabold uppercase">
                                Declined & Refunded
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            {w.status === 'pending' ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleApproveWithdrawal(w)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-2xs font-bold transition-all shadow-md"
                                >
                                  Approve & Pay
                                </button>
                                <button
                                  onClick={() => handleRejectWithdrawal(w)}
                                  className="px-2.5 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-2xs font-bold transition-all"
                                >
                                  Reject & Refund
                                </button>
                              </div>
                            ) : (
                              <span className="text-2xs text-slate-500 font-mono">
                                {w.processedAt ? new Date(w.processedAt).toLocaleDateString() : 'Processed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: FLOAT MONITOR & FEE SETTINGS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'merchant_float' && (
        <div className="space-y-6">
          {/* Monnify Merchant Float Monitor Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-emerald-400" />
                  <span>Monnify Merchant Settlement & Float Monitor</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time synchronization with Monnify merchant settlement account, monitoring liquidity buffer vs total customer ledger liabilities.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Live Gateway Stream Active
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                  Settled Merchant Float
                </div>
                <div className="text-xl font-black text-white font-mono mt-1">
                  ₦{merchantFloat.settledMerchantBalance.toLocaleString()}
                </div>
                <div className="text-2xs text-slate-500 mt-1">Monnify Settlement Balance</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                  Customer Float Liability
                </div>
                <div className="text-xl font-black text-amber-400 font-mono mt-1">
                  ₦{merchantFloat.customerLiabilities.toLocaleString()}
                </div>
                <div className="text-2xs text-slate-500 mt-1">Total active customer balances</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                  Net Liquid Merchant Float
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                  ₦{merchantFloat.netLiquidFloat.toLocaleString()}
                </div>
                <div className="text-2xs text-emerald-400 mt-1">100% Solvency Ratio Healthy</div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                  Settlement Destination
                </div>
                <div className="text-sm font-bold text-slate-200 mt-1">
                  {merchantFloat.monnifySettlementAccount}
                </div>
                <div className="text-2xs text-slate-500 mt-1">Next auto-sweep: 11:59 PM WAT</div>
              </div>
            </div>
          </div>

          {/* Fee & Limit Settings Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Percent className="w-5 h-5 text-emerald-400" />
                  <span>Gateway Fee Rules & Tier Limits</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure whether deposit fees are absorbed by the merchant or deducted from customer deposits, and define tier limits.
                </p>
              </div>

              <div className="flex items-center gap-2 text-2xs text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>2FA Protected</span>
              </div>
            </div>

            <form onSubmit={handleSaveFeeSettings} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Fee Bearer */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Deposit Gateway Fee Bearer
                  </label>
                  <p className="text-2xs text-slate-400">
                    Select who pays Monnify&apos;s transaction charge on virtual account deposits.
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, feeBearer: 'merchant' })}
                      className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
                        settingsForm.feeBearer === 'merchant'
                          ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div>Merchant Absorbs Fee</div>
                      <div className="text-2xs font-normal text-slate-400 mt-0.5">
                        Customer gets 100% credited (Recommended)
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, feeBearer: 'customer' })}
                      className={`p-3 rounded-2xl border text-xs font-bold text-left transition-all ${
                        settingsForm.feeBearer === 'customer'
                          ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div>Customer Pays Fee</div>
                      <div className="text-2xs font-normal text-slate-400 mt-0.5">
                        Fee deducted from wallet credit
                      </div>
                    </button>
                  </div>
                </div>

                {/* Deposit Fee Value & Cap */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Deposit Fee Rate ({settingsForm.depositFeeType === 'percentage' ? '%' : 'NGN'})
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={settingsForm.depositFeeType}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            depositFeeType: e.target.value as 'percentage' | 'flat',
                          })
                        }
                        className="bg-slate-950 border border-slate-700 text-xs text-white rounded-xl px-3 py-2"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Fee (₦)</option>
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        value={settingsForm.depositFeeValue}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            depositFeeValue: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
                      Deposit Fee Cap (NGN) (0 for no cap)
                    </label>
                    <input
                      type="number"
                      value={settingsForm.depositFeeCap}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          depositFeeCap: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Withdrawal Limits & Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                    Withdrawal Flat Fee (NGN)
                  </label>
                  <input
                    type="number"
                    value={settingsForm.withdrawalFeeValue}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        withdrawalFeeValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                  <div className="text-2xs text-slate-500 mt-1">Deducted from outbound bank transfer</div>
                </div>

                <div>
                  <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                    Min Deposit / Max Deposit (Tier 1)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settingsForm.minDeposit}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, minDeposit: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="Min"
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <input
                      type="number"
                      value={settingsForm.maxDepositTier1}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          maxDepositTier1: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="Max"
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                    Min / Max Single Withdrawal (NGN)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settingsForm.minWithdrawal}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          minWithdrawal: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="Min"
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                    <input
                      type="number"
                      value={settingsForm.maxWithdrawalTier1}
                      onChange={(e) =>
                        setSettingsForm({
                          ...settingsForm,
                          maxWithdrawalTier1: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="Max"
                      className="w-1/2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Authorize & Save Fee Rules (2FA)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FINANCIAL REPORTING & STATEMENTS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'reporting' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                Total Volume Processed
              </div>
              <div className="text-2xl font-black text-white font-mono mt-1">
                ₦{totalVolume.toLocaleString()}
              </div>
              <div className="text-2xs text-slate-500 mt-1">{transactions.length} Total Ledger Events</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                Total Customer Deposits
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                ₦{totalDeposits.toLocaleString()}
              </div>
              <div className="text-2xs text-emerald-400 mt-1">Via Monnify Virtual Accounts</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                Store Order Debits
              </div>
              <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
                ₦{totalOrderDebits.toLocaleString()}
              </div>
              <div className="text-2xs text-cyan-400 mt-1">WooCommerce Checkout Purchases</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
              <div className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                Total Fees Retained
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">
                ₦{totalFees.toLocaleString()}
              </div>
              <div className="text-2xs text-amber-400 mt-1">Platform Revenue</div>
            </div>
          </div>

          {/* Statement Controls & Ledger Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>Financial Statement & Audit Ledger</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immutable audit trail of all inflows, outflows, purchases, and manual adjustments.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={reportTxnType}
                  onChange={(e) => setReportTxnType(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">All Types</option>
                  <option value="deposit">Deposits</option>
                  <option value="debit_order">Order Debits</option>
                  <option value="withdrawal">Withdrawals</option>
                  <option value="admin_adjustment">Admin Adjustments</option>
                  <option value="referral_bonus">Referral Rewards</option>
                </select>

                <button
                  onClick={handleDownloadCsv}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Statement (.CSV)</span>
                </button>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
                No ledger transactions recorded yet in production mode.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-3">Date & UUID</th>
                      <th className="py-3 px-3">Customer</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3 text-right">Amount</th>
                      <th className="py-3 px-3 text-right">Bal Before</th>
                      <th className="py-3 px-3 text-right">Bal After</th>
                      <th className="py-3 px-3">Reference / Details</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {transactions
                      .filter((t) => (reportTxnType === 'all' ? true : t.type === reportTxnType))
                      .map((t) => {
                        const user = faiiyaEngine.getUserById(t.userId);
                        return (
                          <tr key={t.id} className="hover:bg-slate-850/40 transition-colors">
                            <td className="py-3.5 px-3">
                              <div className="text-slate-300 font-sans text-xs">
                                {new Date(t.createdAt).toLocaleString()}
                              </div>
                              <div className="text-2xs text-slate-500 truncate max-w-[120px]">
                                {t.txnUuid}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 font-sans">
                              <div className="font-bold text-white text-xs">
                                {user ? `${user.firstName} ${user.lastName}` : `User #${t.userId}`}
                              </div>
                              <div className="text-2xs text-slate-400 font-mono">ID: {t.userId}</div>
                            </td>
                            <td className="py-3.5 px-3 font-sans">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-2xs font-extrabold uppercase ${
                                  t.type === 'deposit'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : t.type === 'debit_order'
                                    ? 'bg-cyan-500/10 text-cyan-400'
                                    : t.type === 'withdrawal'
                                    ? 'bg-amber-500/10 text-amber-400'
                                    : t.type === 'admin_adjustment'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td
                              className={`py-3.5 px-3 text-right font-bold ${
                                t.balanceAfter >= t.balanceBefore ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {t.balanceAfter >= t.balanceBefore ? '+' : '-'}₦{t.amount.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-400">
                              ₦{t.balanceBefore.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-white">
                              ₦{t.balanceAfter.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-3 font-sans">
                              <div className="text-slate-200 text-xs truncate max-w-[180px]">
                                {t.reference}
                              </div>
                              <div className="text-2xs text-slate-500 truncate max-w-[200px]">
                                {t.metadata?.auditReason || t.metadata?.gateway || 'Direct Ledger'}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center font-sans">
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-2xs font-bold uppercase">
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUTOMATED NOTIFICATIONS (SMS & EMAIL) */}
      {/* ========================================================================= */}
      {activeAdminTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  <span>Automated Customer SMS & Email Dispatch Log</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time transactional dispatches triggered on wallet deposits, withdrawals, order purchases, referral bonuses, and administrative actions.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Channel:</span>
                {(['all', 'sms', 'email'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setNotificationChannelFilter(ch)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold uppercase transition-all ${
                      notificationChannelFilter === ch
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {filteredNotifications.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
                No notifications dispatched yet in production mode.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          n.channel === 'sms'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {n.channel === 'sms' ? <Send className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{n.subject}</span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-2xs font-extrabold uppercase ${
                              n.channel === 'sms'
                                ? 'bg-cyan-500/10 text-cyan-400'
                                : 'bg-purple-500/10 text-purple-400'
                            }`}
                          >
                            {n.channel.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans">{n.body}</p>
                        <div className="text-2xs text-slate-500 mt-1 flex items-center gap-2">
                          <span>To: {n.recipient}</span>
                          <span>&bull;</span>
                          <span>{new Date(n.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-2xs font-bold uppercase">
                        {n.deliveryStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SETTINGS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <span>WordPress & Monnify Live Gateway Credentials</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Configure your Monnify production API keys, Contract Code, and Webhook Signing Secrets.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                faiiyaEngine.updateSettings(settingsForm);
                showNotice('✓ Plugin gateway settings updated successfully.');
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Monnify API Key
                </label>
                <input
                  type="text"
                  value={settingsForm.monnifyApiKey}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifyApiKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Monnify Secret Key
                </label>
                <input
                  type="password"
                  value={settingsForm.monnifySecretKey}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifySecretKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Monnify Contract Code
                </label>
                <input
                  type="text"
                  value={settingsForm.monnifyContractCode}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifyContractCode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Monnify Parent Wallet Account Number (Statement &amp; Disbursal)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1042026202"
                  value={settingsForm.monnifyWalletAccountNumber || ''}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifyWalletAccountNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-white"
                />
                <p className="text-2xs text-slate-400 mt-1">
                  Required for querying parent wallet balance, automated disbursement withdrawals, and statement reconciliation according to Monnify Digital Wallet API specifications.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Gateway Settings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: WEBHOOKS */}
      {/* ========================================================================= */}
      {activeAdminTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <span>Monnify Webhook Endpoint &amp; Cryptographic Signature Verifier</span>
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Paste this URL into your Monnify Merchant Dashboard under &quot;Webhook URL&quot;. Inbound events are cryptographically verified via SHA-512 with idempotency protection.
            </p>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-4 mb-6">
              <span className="font-mono text-xs text-emerald-400 break-all">{webhookUrl}</span>
              <button
                onClick={() => copyToClipboard(webhookUrl, 'webhook_url')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center gap-1.5 shrink-0"
              >
                {copiedKey === 'webhook_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'webhook_url' ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>

            {/* Monnify Webhooks Triage Card */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Monnify Webhook Events Triage (7 Standard Types)
                </span>
                <span className="text-2xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  3 ACTIVE &bull; 4 AUTO-IGNORED (200 OK)
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-900/80 border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-white">1. Transaction Completion (SUCCESSFUL_TRANSACTION)</span>
                  </div>
                  <p className="text-2xs text-slate-400 pl-4">
                    <strong>REQUIRED:</strong> Triggers instant automatic wallet credit when a customer makes an inbound bank transfer.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/80 border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-white">2. Disbursement Notification</span>
                  </div>
                  <p className="text-2xs text-slate-400 pl-4">
                    <strong>REQUIRED:</strong> Confirms outbound customer bank withdrawal settlement or failure.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/80 border border-emerald-500/30 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-white">3. Wallet Activity Notification (WALLET_ACTIVITY)</span>
                  </div>
                  <p className="text-2xs text-slate-400 pl-4">
                    <strong>RECOMMENDED:</strong> Monitors Monnify merchant wallet balance movements and automated float status.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1 opacity-75">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="font-semibold text-slate-300">4. Refund Completion</span>
                  </div>
                  <p className="text-2xs text-slate-500 pl-4">
                    <em>Not Needed:</em> Faiiya Pay is a closed-loop wallet. Cleanly acknowledged and ignored with 200 OK.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1 opacity-75">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="font-semibold text-slate-300">5. Settlement Notification</span>
                  </div>
                  <p className="text-2xs text-slate-500 pl-4">
                    <em>Not Needed:</em> Bank account settlement is handled automatically by Monnify. Cleanly acknowledged with 200 OK.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1 opacity-75">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="font-semibold text-slate-300">6. Mandate &amp; 7. Bill Payment</span>
                  </div>
                  <p className="text-2xs text-slate-500 pl-4">
                    <em>Not Needed:</em> Direct debit recurring mandates and utility bills are outside wallet scope. Safely acknowledged with 200 OK.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                Recent Inbound Webhook Payloads ({webhookLogs.length})
              </div>
              {webhookLogs.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
                  No inbound webhooks received yet. Make a deposit via virtual account to test.
                </div>
              ) : (
                webhookLogs.map((log: WebhookLog) => (
                  <div key={log.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl font-mono text-xs">
                    <div className="flex items-center justify-between text-slate-400 text-2xs mb-2">
                      <span className="text-emerald-400 font-bold">{log.eventType}</span>
                      <span>Ref: {log.transactionReference} &bull; {new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <pre className="text-2xs text-slate-300 overflow-x-auto bg-slate-900/60 p-3 rounded-xl border border-slate-850">
                      {JSON.stringify(JSON.parse(log.payload), null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2FA Admin PIN Confirmation Modal */}
      {pending2faAction && (
        <AdminPinModal
          isOpen={isPinModalOpen}
          title={pending2faAction.title}
          actionDescription={pending2faAction.description}
          warningNote={pending2faAction.warning}
          onSuccess={() => {
            setIsPinModalOpen(false);
            pending2faAction.execute();
            setPending2faAction(null);
          }}
          onClose={() => {
            setIsPinModalOpen(false);
            setPending2faAction(null);
          }}
        />
      )}
    </div>
  );
};
