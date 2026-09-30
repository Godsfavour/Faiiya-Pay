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
} from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';
import { User, PluginSettings } from '../types';

export const WPAdminDashboard: React.FC = () => {
  const [activeAdminTab, setActiveAdminTab] = useState<'wallets' | 'settings' | 'pages' | 'webhooks'>('wallets');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<'wallet' | 'referrals' | 'topup' | null>(null);
  const [pagesRegenerated, setPagesRegenerated] = useState(false);

  // Manual Adjustment Modal State (legacy table modal)
  const [adjustmentTarget, setAdjustmentTarget] = useState<User | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('5000');
  const [auditReason, setAuditReason] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Dedicated Query Wallet & Balance Operations Module State
  const [walletQueryInput, setWalletQueryInput] = useState<string>('2');
  const [queriedUser, setQueriedUser] = useState<User | null>(() => {
    const list = faiiyaEngine.getUsers();
    return list.find((u) => u.id === 2) || list[0] || null;
  });
  const [queryError, setQueryError] = useState<string | null>(null);
  const [modAdjustmentType, setModAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [modAdjustmentAmount, setModAdjustmentAmount] = useState<string>('5000');
  const [modAuditReason, setModAuditReason] = useState<string>('');

  // Settings Form State
  const currentSettings = faiiyaEngine.getSettings();
  const [settingsForm, setSettingsForm] = useState<PluginSettings>(currentSettings);

  const users = faiiyaEngine.getUsers();
  const webhookLogs = faiiyaEngine.getWebhookLogs();

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

  const handleModuleExecuteAdjustment = (e: React.FormEvent) => {
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
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.id.toString() === q
    );
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    faiiyaEngine.updateSettings(settingsForm);
    showNotice('✓ Faiiya Pay settings successfully updated in WordPress database.');
  };

  const handleExecuteAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentTarget) return;

    const amt = parseFloat(adjustmentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (!auditReason.trim()) {
      alert('Mandatory audit reason is required for manual balance adjustments.');
      return;
    }

    try {
      faiiyaEngine.adminAdjustWallet({
        userId: adjustmentTarget.id,
        type: adjustmentType,
        amount: amt,
        auditReason: auditReason.trim(),
      });

      showNotice(`✓ Successfully executed ${adjustmentType} of ₦${amt.toLocaleString()} for ${adjustmentTarget.email}`);
      setAdjustmentTarget(null);
      setAuditReason('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // SaaS Administrative Overview Calculations
  const totalSystemLiquidity = users.reduce((sum, u) => {
    const w = faiiyaEngine.getWallet(u.id);
    return sum + (w ? w.balance : 0);
  }, 0);
  const kycVerifiedUsers = users.filter((u) => u.kycStatus === 'verified').length;
  const kycComplianceRate = users.length > 0 ? Math.round((kycVerifiedUsers / users.length) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Action Notification */}
      {actionNotice && (
        <div className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center justify-between text-xs font-semibold border border-emerald-400 animate-in fade-in">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-white hover:text-emerald-200">
            &times;
          </button>
        </div>
      )}

      {/* WordPress Admin Header Mock */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-saas space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-slate-800 border border-slate-700/80 rounded-2xl flex items-center justify-center text-emerald-400 shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">WordPress Admin &bull; Faiiya Pay</h1>
                <span className="text-[10px] font-mono bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full border border-slate-700 font-semibold">
                  v1.0.0 Live
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Core database manager, Monnify gateway settings, and audited wallet adjustments.
              </p>
            </div>
          </div>

          {/* Sub-navigation tabs (Mobile responsive horizontal scroll) */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setActiveAdminTab('wallets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeAdminTab === 'wallets'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Customer Wallets
            </button>

            <button
              onClick={() => setActiveAdminTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeAdminTab === 'settings'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Monnify Gateway
            </button>

            <button
              onClick={() => setActiveAdminTab('pages')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeAdminTab === 'pages'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Shortcode Pages
            </button>

            <button
              onClick={() => setActiveAdminTab('webhooks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeAdminTab === 'webhooks'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Webhooks ({webhookLogs.length})
            </button>
          </div>
        </div>

        {/* Admin Executive KPI Grid (Recommended for SaaS) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 shadow-inner">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>System Custody Liquidity</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-emerald-400 mt-1">
              ₦{totalSystemLiquidity.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-500">Across {users.length} accounts</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 shadow-inner">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>KYC Compliance</span>
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-white mt-1">
              {kycComplianceRate}%
            </div>
            <span className="text-[10px] text-slate-500">{kycVerifiedUsers} of {users.length} Verified</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 shadow-inner">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Monnify API Status</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="font-mono text-xs sm:text-sm font-bold text-emerald-300 mt-1 truncate">
              {currentSettings.monnifyApiKey ? 'Connected & Live' : 'Pending API Key'}
            </div>
            <span className="text-[10px] text-slate-500">Contract: {currentSettings.monnifyContractCode}</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 shadow-inner">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Webhook Delivery</span>
              <Activity className="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div className="font-mono text-base sm:text-lg font-bold text-white mt-1">
              {webhookLogs.length} Events
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono">100% SHA-512 Validated</span>
          </div>
        </div>
      </div>

      {/* TAB 1: Customer Wallets & Dedicated Query/Adjustment Module */}
      {activeAdminTab === 'wallets' && (
        <div className="space-y-6">
          {/* DEDICATED MODULE: Query Wallet & Balance Operations (Add / Remove Funds) */}
          <div id="query-wallet-module" className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span>Query Wallet & Fund Operations</span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 uppercase">
                      Add / Remove Funds
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Query any customer wallet by User ID, Email, Customer Name, or Dedicated Account Number to inspect balances and execute audited balance adjustments.
                  </p>
                </div>
              </div>

              {/* Quick Select Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Quick Select:</span>
                {users.slice(0, 4).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQueryWallet(u.id.toString())}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                      queriedUser?.id === u.id
                        ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    #{u.id} {u.firstName}
                  </button>
                ))}
              </div>
            </div>

            {/* Query Search Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQueryWallet();
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={walletQueryInput}
                  onChange={(e) => {
                    setWalletQueryInput(e.target.value);
                    setQueryError(null);
                  }}
                  placeholder="Enter User ID (e.g. 2), Email, Customer Name, or Virtual Account Number..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Query Wallet</span>
              </button>
            </form>

            {queryError && (
              <div className="bg-rose-950/60 border border-rose-800/80 p-3.5 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{queryError}</span>
              </div>
            )}

            {/* Queried User Wallet Details & Operations Panel */}
            {queriedUser && (() => {
              const qWallet = faiiyaEngine.getWallet(queriedUser.id);
              const qVAs = faiiyaEngine.getVirtualAccounts(queriedUser.id);
              const qTxns = faiiyaEngine.getTransactions(queriedUser.id).slice(0, 5);
              const parsedAmt = parseFloat(modAdjustmentAmount) || 0;
              const willBeBalance =
                modAdjustmentType === 'credit'
                  ? qWallet.balance + parsedAmt
                  : qWallet.balance - parsedAmt;
              const isDebitOverdraw = modAdjustmentType === 'debit' && qWallet.balance < parsedAmt;

              return (
                <div className="space-y-6 pt-2">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Customer Identity & Dedicated Accounts (5 Cols) */}
                    <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                              Customer #{queriedUser.id} &bull; {queriedUser.role}
                            </span>
                            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                              <span>
                                {queriedUser.firstName} {queriedUser.otherNames ? queriedUser.otherNames + ' ' : ''}{queriedUser.lastName}
                              </span>
                            </h3>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{queriedUser.email}</div>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              queriedUser.kycStatus === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {queriedUser.kycStatus === 'verified' ? '✓ Monnify KYC Verified' : '⚠️ Unverified'}
                          </span>
                        </div>

                        {queriedUser.phoneNumber && (
                          <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                            <span className="text-slate-500">Phone:</span>
                            <span>{queriedUser.phoneNumber}</span>
                          </div>
                        )}

                        {/* Dedicated Virtual Bank Accounts */}
                        <div className="pt-2 border-t border-slate-800/80 space-y-2">
                          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Dedicated Virtual Accounts:</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {qVAs.length} provisioned
                            </span>
                          </div>

                          {qVAs.length === 0 ? (
                            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-400 italic">
                              No virtual bank accounts provisioned yet (KYC pending).
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {qVAs.map((va) => (
                                <div
                                  key={va.id}
                                  className="bg-slate-900/80 border border-slate-800/90 rounded-lg p-2.5 text-xs flex items-center justify-between"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-200 text-[11px]">
                                      {va.bankName}
                                    </div>
                                    <div className="font-mono text-xs font-bold text-white tracking-wider">
                                      {va.accountNumber}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Account Name: <span className="text-emerald-400 font-semibold">{va.accountName}</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(va.accountNumber, `va-${va.id}`)}
                                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                                    title="Copy Account Number"
                                  >
                                    {copiedKey === `va-${va.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-800/80">
                        Referral Code: <span className="text-slate-300 font-bold">{queriedUser.referralCode}</span>
                      </div>
                    </div>

                    {/* Right: Balance & Add/Remove Funds Controls (7 Cols) */}
                    <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-5">
                      {/* Top: Current Balance Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div>
                          <span className="text-xs text-slate-400 font-medium block">Queried Available Balance</span>
                          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                            ₦{qWallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {qWallet.status}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">Currency: {qWallet.currency}</span>
                        </div>
                      </div>

                      {/* Adjustment Form */}
                      <form onSubmit={handleModuleExecuteAdjustment} className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-300 block mb-2 uppercase tracking-wider">
                            Choose Operation:
                          </label>
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setModAdjustmentType('credit')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                                modAdjustmentType === 'credit'
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                              <span>+ Add Funds (Credit)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setModAdjustmentType('debit')}
                              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                                modAdjustmentType === 'debit'
                                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-md shadow-rose-500/10'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <ArrowDownLeft className="w-4 h-4 text-rose-400" />
                              <span>- Remove Funds (Debit)</span>
                            </button>
                          </div>
                        </div>

                        {/* Amount & Quick Buttons */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold text-slate-300">
                              Adjustment Amount (₦ NGN) <span className="text-rose-400">*</span>
                            </label>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Preview: ₦{parsedAmt.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-xs sm:text-sm font-bold text-slate-400">₦</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              value={modAdjustmentAmount}
                              onChange={(e) => setModAdjustmentAmount(e.target.value)}
                              placeholder="5000"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-2 text-xs sm:text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          {/* Quick Amount Chips */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {['1000', '5000', '10000', '50000', '100000'].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => setModAdjustmentAmount(chip)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                                  modAdjustmentAmount === chip
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                              >
                                +₦{Number(chip).toLocaleString()}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Mandatory Audit Reason */}
                        <div>
                          <label className="text-xs font-semibold text-slate-300 block mb-1">
                            Mandatory Audit Reason / Narration <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={modAuditReason}
                            onChange={(e) => setModAuditReason(e.target.value)}
                            placeholder="e.g. Bank transfer reconciliation, courtesy order credit, etc."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Live Calculation Preview & Warning */}
                        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div>
                            <span className="text-slate-400">Projected Balance:</span>{' '}
                            <span className="font-mono text-slate-300">
                              ₦{qWallet.balance.toLocaleString()}
                            </span>{' '}
                            <span className="text-slate-500">&rarr;</span>{' '}
                            <span
                              className={`font-mono font-bold ${
                                isDebitOverdraw ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              ₦{willBeBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {isDebitOverdraw ? (
                            <span className="text-rose-400 font-semibold text-[11px]">
                              ⚠️ Insufficient balance for debit
                            </span>
                          ) : (
                            <span className="text-emerald-400/80 text-[11px] font-medium">
                              ✓ Atomic audited transaction
                            </span>
                          )}
                        </div>

                        {/* Submit Execution Button */}
                        <button
                          type="submit"
                          disabled={isDebitOverdraw || parsedAmt <= 0}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 ${
                            modAdjustmentType === 'credit'
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 disabled:opacity-50'
                              : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20 disabled:opacity-50'
                          }`}
                        >
                          {modAdjustmentType === 'credit' ? (
                            <>
                              <ArrowUpRight className="w-4 h-4" />
                              <span>Execute Credit (+₦{parsedAmt.toLocaleString()}) to Wallet</span>
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-4 h-4" />
                              <span>Execute Debit (-₦{parsedAmt.toLocaleString()}) from Wallet</span>
                            </>
                          )}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Queried User Mini Ledger History */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Recent Ledger Activity for {queriedUser.firstName}</span>
                      </h4>
                      <span className="text-[11px] font-mono text-slate-500">
                        {qTxns.length} recent transactions
                      </span>
                    </div>

                    {qTxns.length === 0 ? (
                      <div className="text-xs text-slate-500 italic py-2">No transactions recorded yet.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-slate-400 border-b border-slate-800 text-[11px] font-mono uppercase">
                            <tr>
                              <th className="pb-2">Type</th>
                              <th className="pb-2">Amount</th>
                              <th className="pb-2">Balance After</th>
                              <th className="pb-2">Reference</th>
                              <th className="pb-2 text-right">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {qTxns.map((t) => (
                              <tr key={t.id} className="text-slate-300 hover:bg-slate-900/50">
                                <td className="py-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      t.type === 'deposit' || t.type === 'referral_bonus'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-rose-500/10 text-rose-400'
                                    }`}
                                  >
                                    {t.type}
                                  </span>
                                </td>
                                <td className="py-2 font-bold text-white">
                                  ₦{t.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 text-slate-400">
                                  ₦{t.balanceAfter.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 text-slate-400 text-[11px] truncate max-w-[150px]">
                                  {t.reference}
                                </td>
                                <td className="py-2 text-right text-slate-500 text-[11px]">
                                  {new Date(t.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* WP_List_Table of All Registered Wallets */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">WP_List_Table &bull; Registered Wallets</h2>
                <p className="text-xs text-slate-400">
                  View all registered customer wallets, linked Monnify virtual accounts, and click "Query & Manage" to load any wallet into the operations module above.
                </p>
              </div>

              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter table by email, name or ID..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
                  <tr>
                    <th className="pb-3 px-3">User / Customer</th>
                    <th className="pb-3 px-3">Wallet Balance</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3">Monnify Virtual Accounts</th>
                    <th className="pb-3 px-3">Referral Code</th>
                    <th className="pb-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((user) => {
                    const userWallet = faiiyaEngine.getWallet(user.id);
                    const userVAs = faiiyaEngine.getVirtualAccounts(user.id);
                    const isCurrentlyQueried = queriedUser?.id === user.id;

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors ${
                          isCurrentlyQueried ? 'bg-emerald-950/20' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">
                            {user.firstName} {user.otherNames ? user.otherNames + ' ' : ''}{user.lastName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {user.email} (ID: #{user.id})
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-sm text-emerald-400">
                          ₦{userWallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              userWallet.kycStatus === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {userWallet.status} ({userWallet.kycStatus})
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                          {userVAs.length === 0 ? (
                            <span className="text-slate-500 italic">None provisioned</span>
                          ) : (
                            <div className="space-y-0.5">
                              {userVAs.map((va) => (
                                <div key={va.id}>
                                  <span className="text-slate-400">{va.bankName.split(' ')[0]}:</span>{' '}
                                  <span className="text-white font-bold">{va.accountNumber}</span>{' '}
                                  <span className="text-[10px] text-emerald-400">({va.accountName})</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono text-xs text-slate-300">
                          {user.referralCode}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                handleQueryWallet(user.id.toString());
                                const el = document.getElementById('query-wallet-module');
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
                                isCurrentlyQueried
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              }`}
                            >
                              Query & Manage
                            </button>
                            <button
                              onClick={() => setAdjustmentTarget(user)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors"
                            >
                              Modal
                            </button>
                          </div>
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

      {/* TAB 2: Plugin Settings & Monnify API */}
      {activeAdminTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-6">
          {/* Monnify Webhook Info Callout */}
          <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-emerald-300">Monnify Webhook Listener URL:</div>
              <code className="text-xs font-mono text-emerald-100 bg-slate-950 px-2 py-1 rounded mt-1 inline-block border border-slate-800">
                {webhookUrl}
              </code>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(webhookUrl, 'webhook-url')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shrink-0 transition-colors"
            >
              {copiedKey === 'webhook-url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy Webhook URL</span>
            </button>
          </div>

          {/* Monnify API Keys */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              1. Monnify API Credentials
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Environment Mode
                </label>
                <select
                  value={settingsForm.monnifyMode}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifyMode: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="sandbox">Sandbox / Test Mode</option>
                  <option value="live">Live / Production Mode</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Contract Code
                </label>
                <input
                  type="text"
                  value={settingsForm.monnifyContractCode}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifyContractCode: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Monnify API Key
                </label>
                <input
                  type="text"
                  value={settingsForm.monnifyApiKey}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifyApiKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Monnify Secret Key (Used for SHA-512 Verification)
                </label>
                <input
                  type="password"
                  value={settingsForm.monnifySecretKey}
                  onChange={(e) => setSettingsForm({ ...settingsForm, monnifySecretKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Referral Engine Settings */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              2. Referral Engine Configuration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Referral Program Status
                </label>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="ref_toggle"
                    checked={settingsForm.referralEnabled}
                    onChange={(e) => setSettingsForm({ ...settingsForm, referralEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="ref_toggle" className="text-xs text-slate-300 font-medium">
                    Enable Referral Rewards
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Reward Amount (₦ NGN)
                </label>
                <input
                  type="number"
                  step="50"
                  value={settingsForm.referralRewardAmount}
                  onChange={(e) => setSettingsForm({ ...settingsForm, referralRewardAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Payout Trigger Event
                </label>
                <select
                  value={settingsForm.referralTrigger}
                  onChange={(e) => setSettingsForm({ ...settingsForm, referralTrigger: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="on_first_wallet_deposit">On First Wallet Deposit (Recommended)</option>
                  <option value="on_registration">Immediately on Registration</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Automatic WordPress Pages & Gateway Verification */}
      {activeAdminTab === 'pages' && (
        <div className="space-y-6">
          {/* Automatic Pages Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">
                    Automatic WordPress Pages Created by Activator
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Activator::create_default_pages()
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Upon plugin activation, Faiiya Pay verifies and automatically provisions these three core customer-facing pages with their respective shortcodes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPagesRegenerated(true);
                  showNotice('✓ Verified all 3 pages exist in WordPress database with active shortcodes.');
                  setTimeout(() => setPagesRegenerated(false), 3000);
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${pagesRegenerated ? 'animate-spin' : ''}`} />
                <span>Verify / Regenerate Pages</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
                  <tr>
                    <th className="pb-3 px-3">Page Name</th>
                    <th className="pb-3 px-3">Permalink / Slug</th>
                    <th className="pb-3 px-3">Shortcode Executed</th>
                    <th className="pb-3 px-3">Status</th>
                    <th className="pb-3 px-3 text-right">Interactive Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">My Wallet</div>
                      <div className="text-[11px] text-slate-400">Main customer dashboard</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400">
                      /faiiya-wallet
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">[faiiya_wallet]</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3 h-3" /> Published (ID #401)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setPreviewPage('wallet')}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold transition-colors"
                      >
                        Preview Output ↗
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">Referral Program</div>
                      <div className="text-[11px] text-slate-400">Customer referral metrics & rewards</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400">
                      /faiiya-referrals
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">[faiiya_referrals]</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3 h-3" /> Published (ID #402)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setPreviewPage('referrals')}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold transition-colors"
                      >
                        Preview Output ↗
                      </button>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">Wallet Top-Up</div>
                      <div className="text-[11px] text-slate-400">Instant dedicated bank transfer page</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-emerald-400">
                      /faiiya-topup
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">[faiiya_topup]</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3 h-3" /> Published (ID #403)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setPreviewPage('topup')}
                        className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold transition-colors"
                      >
                        Preview Output ↗
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* WooCommerce Gateway Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-purple-900/30 border border-purple-500/30 rounded-xl flex items-center justify-center text-purple-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">WooCommerce Gateway Status</h3>
                  <p className="text-xs text-slate-400">
                    Registered via filter <code className="text-purple-300">woocommerce_payment_gateways</code> as <code className="text-emerald-400">faiiya_pay_wallet</code>
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ● Registered & Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium">Gateway ID</div>
                <div className="text-sm font-bold text-slate-200 font-mono mt-0.5">faiiya_pay_wallet</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium">Payment Title</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">Faiiya Pay Digital Wallet</div>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[11px] text-slate-400 font-medium">Checkout Availability</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">Visible to Guests & Users</div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-white">How WooCommerce sees Faiiya Pay:</div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
                <li>Appears in WooCommerce &gt; Settings &gt; Payments as a native toggleable gateway.</li>
                <li>Displays customer wallet balance directly on the checkout page before order submission.</li>
                <li>If balance is insufficient, displays dedicated Monnify account numbers for instant funding without leaving checkout.</li>
                <li>Debits wallet with pessimistic locking (<code className="text-purple-300">SELECT ... FOR UPDATE</code>) to guarantee zero double-spending.</li>
              </ul>
            </div>
          </div>

          {/* Shortcode Render Modal Preview */}
          {previewPage && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-2xl text-slate-900">
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      WordPress Frontend Preview &bull;{' '}
                      {previewPage === 'wallet' && 'My Wallet (/faiiya-wallet)'}
                      {previewPage === 'referrals' && 'Referral Program (/faiiya-referrals)'}
                      {previewPage === 'topup' && 'Wallet Top-Up (/faiiya-topup)'}
                    </h3>
                    <div className="text-xs text-slate-500 font-mono">
                      Rendered via {previewPage === 'wallet' && '[faiiya_wallet]'}
                      {previewPage === 'referrals' && '[faiiya_referrals]'}
                      {previewPage === 'topup' && '[faiiya_topup]'}
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewPage(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 font-bold"
                  >
                    &times; Close
                  </button>
                </div>

                {previewPage === 'wallet' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-tr from-emerald-700 to-teal-600 text-white p-5 rounded-xl shadow">
                      <div className="text-xs uppercase tracking-wider opacity-80">Available Wallet Balance</div>
                      <div className="text-3xl font-extrabold mt-1">₦85,000.00</div>
                      <div className="flex gap-2 mt-4 text-xs font-semibold">
                        <span className="bg-white text-emerald-800 px-3 py-1.5 rounded-lg shadow-sm">
                          + Add Money (Top-Up)
                        </span>
                        <span className="bg-white/20 text-white px-3 py-1.5 rounded-lg">
                          🎁 Refer & Earn ₦500
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border rounded-xl p-4">
                      <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide mb-2">
                        Instant Dedicated Bank Accounts
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 border rounded-lg">
                          <div className="text-[11px] font-bold text-emerald-700">WEMA BANK</div>
                          <div className="text-lg font-mono font-bold text-slate-800">9012345678</div>
                          <div className="text-[10px] text-slate-500">FAIIYA-CHINEDU OKONKWO</div>
                        </div>
                        <div className="bg-white p-3 border rounded-lg">
                          <div className="text-[11px] font-bold text-emerald-700">STERLING BANK</div>
                          <div className="text-lg font-mono font-bold text-slate-800">8012345678</div>
                          <div className="text-[10px] text-slate-500">FAIIYA-CHINEDU OKONKWO</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {previewPage === 'referrals' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-tr from-indigo-700 to-purple-600 text-white p-5 rounded-xl shadow">
                      <h4 className="font-extrabold text-lg">Invite Friends & Earn ₦500</h4>
                      <p className="text-xs opacity-90 mt-1">
                        When a friend signs up and funds their wallet, you earn ₦500 credited automatically to your digital wallet!
                      </p>
                      <div className="mt-4 bg-white/20 p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="text-[10px] uppercase opacity-80 font-bold">Your Unique Code</div>
                          <div className="text-xl font-mono font-black tracking-widest">CHIN8921</div>
                        </div>
                        <span className="bg-white text-indigo-700 px-3 py-1 rounded text-xs font-bold">
                          Copy Link
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-50 p-3 rounded-lg border">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Referred</div>
                        <div className="text-xl font-extrabold text-slate-900 mt-1">12</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Conversions</div>
                        <div className="text-xl font-extrabold text-emerald-600 mt-1">8</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Earned</div>
                        <div className="text-xl font-extrabold text-indigo-600 mt-1">₦4,000.00</div>
                      </div>
                    </div>
                  </div>
                )}

                {previewPage === 'topup' && (
                  <div className="space-y-4">
                    <div className="border border-emerald-200 bg-emerald-50/50 p-4 rounded-xl">
                      <h4 className="font-bold text-sm text-emerald-900">How to Top Up Your Wallet:</h4>
                      <p className="text-xs text-emerald-800 mt-1">
                        Send funds via any bank transfer app (Kuda, GTBank, Zenith, OPay, Palmpay) to your dedicated virtual account number below.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="bg-slate-50 border p-3.5 rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-emerald-700">WEMA BANK</div>
                          <div className="text-xl font-mono font-black text-slate-900">9012345678</div>
                          <div className="text-xs text-slate-500">Account Name: FAIIYA-CHINEDU OKONKWO</div>
                        </div>
                        <span className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                          Copy
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Webhook Audit Logs */}
      {activeAdminTab === 'webhooks' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div>
            <h2 className="text-base font-bold text-white">Monnify Webhook Ingestion Logs</h2>
            <p className="text-xs text-slate-400">
              Audit log of all incoming Monnify webhook payloads, idempotency verification, and processing status.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
                <tr>
                  <th className="pb-3 px-3">ID & Event</th>
                  <th className="pb-3 px-3">Transaction Reference</th>
                  <th className="pb-3 px-3">Request Hash (SHA-256)</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3 text-right">Received At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {webhookLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3 font-sans">
                      <div className="font-bold text-slate-200">#{log.id} {log.eventType}</div>
                      <div className="text-[10px] text-slate-400 uppercase">{log.gateway}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-200">
                      {log.transactionReference}
                    </td>

                    <td className="py-3 px-3 text-[11px] text-slate-400 truncate max-w-[200px]">
                      {log.requestHash}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          log.processedStatus === 'processed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : log.processedStatus === 'duplicate'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {log.processedStatus}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right text-slate-400 font-sans whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Wallet Adjustment Modal */}
      {adjustmentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-1">
              Manual Wallet Adjustment
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Customer: <span className="text-slate-200 font-semibold">{adjustmentTarget.email}</span> (ID: #{adjustmentTarget.id})
            </p>

            <form onSubmit={handleExecuteAdjustment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('credit')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                      adjustmentType === 'credit'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    + Credit (Add Funds)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('debit')}
                    className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                      adjustmentType === 'debit'
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    - Debit (Deduct Funds)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Amount (₦ NGN)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mandatory Audit Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  placeholder="e.g. Compensatory credit for delayed delivery in Order #1042"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
