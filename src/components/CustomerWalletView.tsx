import React, { useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Building2,
  Users,
  Gift,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Clock,
  Sparkles,
  AlertCircle,
  Lock,
  ShieldAlert,
  Fingerprint,
  Eye,
  EyeOff,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Share2,
  Download,
  Snowflake,
  Banknote,
  X,
  CreditCard,
  Send,
  ArrowRight,
} from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';
import { User, TransactionType, WithdrawalRequest } from '../types';

interface CustomerWalletViewProps {
  currentUser: User;
  onOpenRegister: () => void;
}

const NIGERIAN_BANKS = [
  { name: 'Wema Bank (ALAT)', code: '035' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'Access Bank', code: '044' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'OPay Digital Services', code: '999992' },
  { name: 'Kuda Microfinance Bank', code: '50211' },
  { name: 'Sterling Bank', code: '232' },
];

export const CustomerWalletView: React.FC<CustomerWalletViewProps> = ({
  currentUser,
  onOpenRegister,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [fundStep, setFundStep] = useState<'amount' | 'waiting' | 'success'>('amount');
  const [topUpAmount, setTopUpAmount] = useState<number>(5000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('Wema Bank (ALAT)');
  const [fundSuccessTxn, setFundSuccessTxn] = useState<any>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(false);

  // Bank Withdrawal Modal State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawBank, setWithdrawBank] = useState(NIGERIAN_BANKS[0].name);
  const [withdrawBankCode, setWithdrawBankCode] = useState(NIGERIAN_BANKS[0].code);
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('10000');
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<WithdrawalRequest | null>(null);

  const wallet = faiiyaEngine.getWallet(currentUser.id);
  const isFrozen = wallet.status === 'frozen';
  let virtualAccounts = faiiyaEngine.getVirtualAccounts(currentUser.id);
  const isKycVerified =
    wallet.kycStatus === 'verified' ||
    currentUser.kycStatus === 'verified' ||
    virtualAccounts.length > 0;

  // Auto-sync virtual accounts if account is verified but accounts haven't been provisioned yet
  if (isKycVerified && virtualAccounts.length === 0) {
    virtualAccounts = faiiyaEngine.provisionDedicatedVirtualAccounts(currentUser);
  }

  // KYC Verification state: National Identification Number (NIN)
  const [kycInput, setKycInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [showVerifiedCard, setShowVerifiedCard] = useState<boolean>(false);
  const transactions = faiiyaEngine.getTransactions(
    currentUser.id,
    filterType === 'all' ? undefined : filterType
  );
  const userWithdrawals = faiiyaEngine.getWithdrawals(currentUser.id);
  const referralStats = faiiyaEngine.getReferralStats(currentUser.id);
  const settings = faiiyaEngine.getSettings();

  // Financial Analytics Calculations
  const allUserTxns = faiiyaEngine.getTransactions(currentUser.id);
  const totalInflows = allUserTxns
    .filter(
      (tx) =>
        tx.type === 'deposit' ||
        tx.type === 'referral_bonus' ||
        (tx.type === 'admin_adjustment' && tx.balanceAfter > tx.balanceBefore)
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalOutflows = allUserTxns
    .filter(
      (tx) =>
        tx.type === 'debit_order' ||
        tx.type === 'withdrawal' ||
        (tx.type === 'admin_adjustment' && tx.balanceAfter < tx.balanceBefore)
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --- KYC VERIFICATION (NIN ONLY) ---
  const handleVerifyKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycError(null);
    const cleanId = kycInput.replace(/\D/g, '');
    if (cleanId.length !== 11) {
      setKycError('Please enter a valid 11-digit National Identification Number (NIN).');
      return;
    }

    setIsVerifying(true);
    try {
      const verified = await faiiyaEngine.verifyKycWithMonnify({
        bvnOrNin: cleanId,
        type: 'nin',
        nameHint: {
          firstName: currentUser.firstName,
          otherNames: currentUser.otherNames,
          lastName: currentUser.lastName,
        },
      });

      faiiyaEngine.verifyKyc({
        userId: currentUser.id,
        bvnOrNin: cleanId,
        verifiedNames: {
          firstName: verified.firstName,
          otherNames: verified.otherNames,
          lastName: verified.lastName,
        },
      });

      setShowVerifiedCard(true);
      showToast('✓ Identity verified via live NIMC gateway! Dedicated Virtual Accounts activated.');
    } catch (err: any) {
      setKycError(err.message || 'Identity verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  // --- TOP UP SIMULATION ---
  const handleSimulateDeposit = (bankName: string, accNum: string) => {
    if (isFrozen) {
      alert('Wallet is currently frozen. Deposits are restricted.');
      return;
    }

    const amount = customAmount ? parseFloat(customAmount) : topUpAmount;
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    try {
      const txn = faiiyaEngine.simulateMonnifyTransferDeposit({
        userId: currentUser.id,
        amount,
        bankName,
        accountNumber: accNum,
      });

      setFundSuccessTxn(txn);
      setFundStep('success');
      showToast(`✓ Monnify Payment Received: ₦${amount.toLocaleString()} credited to your wallet!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- WITHDRAWAL PIPELINE ---
  const handleResolveAccount = () => {
    const clean = withdrawAccountNumber.replace(/\D/g, '');
    if (clean.length !== 10) {
      setWithdrawError('Account number must be exactly 10 digits.');
      return;
    }

    setWithdrawError(null);
    setIsResolvingAccount(true);

    setTimeout(() => {
      // Simulate authoritative NIP Name Enquiry
      setWithdrawAccountName(`${currentUser.firstName.toUpperCase()} ${currentUser.lastName.toUpperCase()}`);
      setIsResolvingAccount(false);
    }, 400);
  };

  const handleExecuteWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFrozen) {
      alert('Your wallet is frozen. Withdrawals are blocked.');
      return;
    }

    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount.');
      return;
    }

    if (amt > wallet.balance) {
      setWithdrawError(
        `Insufficient wallet balance. You have ₦${wallet.balance.toLocaleString()} available.`
      );
      return;
    }

    if (!withdrawAccountName) {
      setWithdrawError('Please verify the destination account name first.');
      return;
    }

    setWithdrawError(null);

    try {
      const req = faiiyaEngine.requestWithdrawal({
        userId: currentUser.id,
        accountNumber: withdrawAccountNumber,
        bankCode: withdrawBankCode,
        bankName: withdrawBank,
        accountName: withdrawAccountName,
        amount: amt,
      });

      setWithdrawSuccess(req);
      showToast(`✓ Withdrawal request for ₦${amt.toLocaleString()} submitted successfully!`);
    } catch (err: any) {
      setWithdrawError(err.message);
    }
  };

  // --- DOWNLOAD CSV STATEMENT ---
  const handleDownloadStatement = () => {
    const csv = faiiyaEngine.exportTransactionsCsv({ userId: currentUser.id });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `faiiya_pay_statement_${currentUser.firstName.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('✓ Account statement CSV downloaded successfully.');
  };

  const withdrawalFee =
    settings.withdrawalFeeType === 'flat'
      ? settings.withdrawalFeeValue
      : ((parseFloat(withdrawAmount) || 0) * settings.withdrawalFeeValue) / 100;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* COMPLIANCE FROZEN BANNER */}
      {isFrozen && (
        <div className="bg-red-950/80 border-2 border-red-500/80 rounded-3xl p-5 shadow-2xl flex items-start gap-4 text-red-200 animate-pulse">
          <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
            <Snowflake className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>Account Administratively Suspended / Frozen</span>
              <span className="px-2 py-0.5 text-2xs font-extrabold uppercase rounded-lg bg-red-500 text-slate-950">
                Action Required
              </span>
            </h3>
            <p className="text-xs text-red-200/90 leading-relaxed">
              Your Faiiya Pay wallet has been placed on temporary hold by compliance. Outbound transfers, store checkout, and withdrawals are temporarily restricted.
            </p>
            {wallet.freezeReason && (
              <p className="text-xs font-mono text-red-300 mt-1">
                Reason: &quot;{wallet.freezeReason}&quot;
              </p>
            )}
            <p className="text-2xs text-red-400 mt-2 font-semibold">
              To resolve this hold, please contact compliance support at{' '}
              <span className="underline text-white">compliance@faiiyastore.ng</span>.
            </p>
          </div>
        </div>
      )}

      {/* Main Wallet Header Card */}
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden text-white">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 flex-1">
            {/* Full Profile Name at the top of Account Details */}
            <div className="flex items-center justify-between border-b border-white/20 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">👤</span>
                <span className="text-base font-extrabold text-white tracking-tight">
                  {currentUser.firstName} {currentUser.lastName}
                </span>
              </div>
              <span className="text-2xs font-bold uppercase tracking-wider text-emerald-100/90">
                FAIIYA WALLET
              </span>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-100/80 font-semibold flex items-center gap-2">
                <span>Available Balance</span>
                <button
                  onClick={() => setHideBalance(!hideBalance)}
                  className="text-emerald-200 hover:text-white transition-colors"
                >
                  {hideBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="text-3xl sm:text-5xl font-black text-white font-mono tracking-tight mt-1">
                {hideBalance ? '••••••••' : `₦${wallet.balance.toLocaleString()}`}
                <span className="text-sm sm:text-base font-normal text-emerald-100 font-sans ml-2">
                  NGN
                </span>
              </div>

              {/* Clean verified status directly under Amount details */}
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-white/20 backdrop-blur-sm text-white">
                  <span className="w-2 h-2 rounded-full bg-emerald-300" />
                  <span>{isKycVerified ? 'Verified (Tier 1)' : 'Pending Verification'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsTopUpOpen(true)}
              disabled={isFrozen}
              className="px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Fund Wallet (Deposit)</span>
            </button>

            <button
              onClick={() => {
                setWithdrawError(null);
                setWithdrawSuccess(null);
                setIsWithdrawOpen(true);
              }}
              disabled={isFrozen || wallet.balance <= 0}
              className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span>Withdraw to Bank</span>
            </button>
          </div>
        </div>

        {/* Quick Analytics Summary */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">Total Inflows</div>
            <div className="text-base sm:text-lg font-bold text-emerald-400 font-mono mt-0.5">
              ₦{totalInflows.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">Total Outflows</div>
            <div className="text-base sm:text-lg font-bold text-amber-400 font-mono mt-0.5">
              ₦{totalOutflows.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">Pending Outflows</div>
            <div className="text-base sm:text-lg font-bold text-cyan-400 font-mono mt-0.5">
              {userWithdrawals.filter((w) => w.status === 'pending').length}
            </div>
          </div>

          <div>
            <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">Referral Earnings</div>
            <div className="text-base sm:text-lg font-bold text-purple-400 font-mono mt-0.5">
              ₦{referralStats.totalEarned.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* KYC Verification Banner (if unverified) */}
      {!isKycVerified && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>National Identification Number (NIN) Verification</span>
                  <span className="text-2xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    CBN Mandate
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  In compliance with Central Bank of Nigeria (CBN) regulations, submit your 11-digit National Identity Number (NIN) to activate personal Dedicated Virtual Accounts and unlock unlimited instant bank deposits.
                </p>
              </div>

              <form onSubmit={handleVerifyKyc} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  maxLength={11}
                  placeholder="Enter 11-digit NIN (e.g. 11223344556)..."
                  value={kycInput}
                  onChange={(e) => setKycInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={isVerifying || kycInput.replace(/\D/g, '').length !== 11}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shrink-0 transition-transform active:scale-95"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Verifying with Monnify...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify NIN & Unlock Accounts →</span>
                    </>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-2 text-2xs text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero-Storage Guarantee: Your NIN is verified directly with NIMC via Monnify API and never stored on this server.</span>
              </div>

              {kycError && (
                <div className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{kycError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Virtual Accounts Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <span>Dedicated Monnify Virtual Accounts (Reserved For You)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Direct bank transfer to any of these accounts automatically credits your Faiiya Pay wallet in under 10 seconds.
            </p>
          </div>

          <button
            onClick={() => setIsTopUpOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulate Transfer Inflow</span>
          </button>
        </div>

        {virtualAccounts.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            No virtual accounts provisioned yet. Complete KYC above to generate your dedicated bank accounts.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {virtualAccounts.map((va) => (
              <div
                key={va.id}
                className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 space-y-4 transition-all relative overflow-hidden group shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{va.bankName}</div>
                      <div className="text-2xs text-slate-500">Instant Automated Credit</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-2xs font-extrabold uppercase">
                    Active
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-850 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">
                      Account Number
                    </div>
                    <div className="text-lg font-black text-white font-mono tracking-widest mt-0.5">
                      {va.accountNumber}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(va.accountNumber, `va_${va.id}`)}
                    className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    {copiedKey === `va_${va.id}` ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="text-xs text-slate-400 pt-1 flex items-center justify-between">
                  <span>Account Name:</span>
                  <span className="font-bold text-slate-200">{va.accountName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History & Statement Export */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              <span>Wallet Transaction History</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time audit ledger of deposits, store checkout debits, withdrawals, and referral bonuses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Transactions</option>
              <option value="deposit">Deposits</option>
              <option value="debit_order">WooCommerce Purchases</option>
              <option value="withdrawal">Withdrawals</option>
              <option value="referral_bonus">Referral Rewards</option>
              <option value="admin_adjustment">Adjustments</option>
            </select>

            <button
              onClick={handleDownloadStatement}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Statement (.CSV)</span>
            </button>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
            No transactions found. Fund your wallet or complete an order in the store to see activity.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Reference / Description</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-850/40 transition-colors">
                    <td className="py-3.5 px-3 text-slate-300 font-sans text-xs">
                      {new Date(t.createdAt).toLocaleDateString()}{' '}
                      <span className="text-slate-500 text-2xs">
                        {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
                            : t.type === 'referral_bonus'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-sans">
                      <div className="text-slate-200 text-xs font-semibold">{t.reference}</div>
                      <div className="text-2xs text-slate-400 truncate max-w-xs">
                        {t.metadata?.bank
                          ? `Bank Inflow (${t.metadata.bank})`
                          : t.metadata?.orderNumber
                          ? `Order Payment #${t.metadata.orderNumber}`
                          : t.metadata?.destinationBank
                          ? `Withdrawal to ${t.metadata.destinationBank}`
                          : t.metadata?.auditReason || 'Ledger event'}
                      </div>
                    </td>
                    <td
                      className={`py-3.5 px-3 text-right font-bold text-sm ${
                        t.balanceAfter >= t.balanceBefore ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {t.balanceAfter >= t.balanceBefore ? '+' : '-'}₦{t.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right text-slate-300 font-bold">
                      ₦{t.balanceAfter.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-2xs font-bold uppercase">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FUND WALLET / ADD MONEY MODAL (2-Step Workflow with Monnify Live Waiting Animation) */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => {
                setIsTopUpOpen(false);
                setFundStep('amount');
                setFundSuccessTxn(null);
              }}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {fundStep === 'amount' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <ArrowDownLeft className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Fund Your Wallet</h3>
                    <p className="text-xs text-slate-400">Step 1 of 2: Specify the deposit amount to add</p>
                  </div>
                </div>

                <div>
                  <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-2">
                    Quick Preset Amounts
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[2000, 5000, 10000, 20000, 50000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setTopUpAmount(amt);
                          setCustomAmount('');
                        }}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                          topUpAmount === amt && !customAmount
                            ? 'bg-emerald-500 text-slate-950 shadow-md font-extrabold'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        ₦{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                    Or Enter Custom Amount (NGN)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">₦</span>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Deposit Amount:</span>
                    <span className="font-mono font-bold text-white">
                      ₦{(customAmount ? parseFloat(customAmount) || 0 : topUpAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monnify Processing Fee:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {settings.feeBearer === 'merchant' ? '₦0 (Absorbed by Merchant)' : 'Deducted from Credit'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/80 pt-1.5 font-bold text-white">
                    <span>Net Wallet Credit:</span>
                    <span className="font-mono text-emerald-400">
                      ₦{(customAmount ? parseFloat(customAmount) || 0 : topUpAmount).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const amt = customAmount ? parseFloat(customAmount) : topUpAmount;
                    if (isNaN(amt) || amt <= 0) {
                      alert('Please select or enter a valid funding amount.');
                      return;
                    }
                    setFundStep('waiting');
                  }}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span>Proceed to Dedicated Bank Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {fundStep === 'waiting' && (() => {
              const targetVa = virtualAccounts.find((va) => va.bankName === selectedBank) || virtualAccounts[0] || {
                bankName: 'Wema Bank (ALAT)',
                accountNumber: '9981240182',
                accountName: currentUser.firstName,
              };
              const amt = customAmount ? parseFloat(customAmount) : topUpAmount;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
                      Step 2 of 2: Inbound Bank Transfer
                    </span>
                    <button
                      type="button"
                      onClick={() => setFundStep('amount')}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      Change Amount
                    </button>
                  </div>

                  {/* Bank Account Details Card */}
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Destination Bank</span>
                      {virtualAccounts.length > 1 ? (
                        <select
                          value={selectedBank}
                          onChange={(e) => setSelectedBank(e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-semibold px-2.5 py-1"
                        >
                          {virtualAccounts.map((va) => (
                            <option key={va.id} value={va.bankName}>
                              {va.bankName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs font-bold text-emerald-400">{targetVa.bankName}</span>
                      )}
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-2xs text-slate-400 uppercase font-bold">Account Number</div>
                        <div className="text-2xl font-black text-white font-mono tracking-wider">
                          {targetVa.accountNumber}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(targetVa.accountNumber, 'fund-acc')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        {copiedKey === 'fund-acc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'fund-acc' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-2xs text-slate-500 font-semibold">Account Name</div>
                        <div className="text-white font-bold truncate">{targetVa.accountName}</div>
                      </div>
                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-2xs text-slate-500 font-semibold">Exact Amount to Pay</div>
                        <div className="text-emerald-400 font-bold font-mono">₦{amt.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* CLEAN WAITING FOR PAYMENT STATE */}
                  <div className="text-center py-4 px-4 bg-slate-950/70 border border-slate-800/80 rounded-2xl relative overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mx-auto flex items-center justify-center text-emerald-400 mb-2.5">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    </div>

                    <div className="text-sm font-bold text-white mb-1">
                      Waiting for payment...
                    </div>

                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Transfer <strong className="text-white font-mono">₦{amt.toLocaleString()}</strong> to the account above. Your wallet balance will automatically update once received.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSimulateDeposit(targetVa.bankName, targetVa.accountNumber)}
                      className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Check Status Now</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {fundStep === 'success' && (
              <div className="text-center py-4 space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Payment Received & Credited!</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Monnify confirmed inbound bank transfer. Your wallet balance has been updated.
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reference:</span>
                    <span className="text-white font-bold">{fundSuccessTxn?.reference || 'MNFY_PAYMENT'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount Credited:</span>
                    <span className="text-emerald-400 font-bold">₦{fundSuccessTxn?.amount?.toLocaleString() || topUpAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5 font-bold">
                    <span className="text-slate-400">New Available Balance:</span>
                    <span className="text-white font-black text-sm">₦{wallet.balance.toLocaleString()} NGN</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsTopUpOpen(false);
                    setFundStep('amount');
                    setFundSuccessTxn(null);
                  }}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* WITHDRAWAL TO BANK MODAL */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setIsWithdrawOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {withdrawSuccess ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white">Withdrawal Request Received</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  Your withdrawal of <span className="text-emerald-400 font-bold">₦{withdrawSuccess.amount.toLocaleString()}</span> has been debited from your wallet and is queued for automated disbursement.
                </p>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-left space-y-2 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reference:</span>
                    <span className="text-white font-bold">{withdrawSuccess.transactionReference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination Bank:</span>
                    <span className="text-white">{withdrawSuccess.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Beneficiary:</span>
                    <span className="text-white">{withdrawSuccess.accountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Net Transfer:</span>
                    <span className="text-emerald-400 font-bold">₦{withdrawSuccess.netPayout.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsWithdrawOpen(false)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm transition-all"
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <ArrowUpRight className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Withdraw Funds to Nigerian Bank</h3>
                    <p className="text-xs text-slate-400">Instant outbound bank settlement via Monnify</p>
                  </div>
                </div>

                <form onSubmit={handleExecuteWithdrawal} className="space-y-4">
                  <div>
                    <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      Destination Bank
                    </label>
                    <select
                      value={withdrawBank}
                      onChange={(e) => {
                        const b = NIGERIAN_BANKS.find((bk) => bk.name === e.target.value);
                        if (b) {
                          setWithdrawBank(b.name);
                          setWithdrawBankCode(b.code);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
                    >
                      {NIGERIAN_BANKS.map((b) => (
                        <option key={b.code} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-2xs uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                      10-Digit NUBAN Account Number
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="0123456789"
                        value={withdrawAccountNumber}
                        onChange={(e) => {
                          setWithdrawAccountNumber(e.target.value.replace(/\D/g, ''));
                          setWithdrawAccountName('');
                        }}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={handleResolveAccount}
                        disabled={isResolvingAccount || withdrawAccountNumber.length !== 10}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold rounded-xl text-xs transition-colors"
                      >
                        {isResolvingAccount ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>
                  </div>

                  {withdrawAccountName && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                      <span>Beneficiary Name:</span>
                      <span className="font-bold font-mono">{withdrawAccountName}</span>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-2xs uppercase tracking-wider text-slate-400 font-bold">
                        Withdrawal Amount (NGN)
                      </label>
                      <span className="text-2xs text-slate-400">
                        Available: ₦{wallet.balance.toLocaleString()}
                      </span>
                    </div>

                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white font-mono font-bold"
                    />

                    <div className="flex gap-2 mt-2">
                      {[5000, 10000, 25000, 50000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setWithdrawAmount(val.toString())}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-2xs font-semibold text-slate-300"
                        >
                          ₦{val.toLocaleString()}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setWithdrawAmount(wallet.balance.toString())}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-2xs font-bold text-emerald-400 ml-auto"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Withdrawal Fee:</span>
                      <span className="font-mono text-slate-200">₦{withdrawalFee.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800">
                      <span>Net Bank Payout:</span>
                      <span className="font-mono text-emerald-400">
                        ₦{Math.max(0, (parseFloat(withdrawAmount) || 0) - withdrawalFee).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {withdrawError && (
                    <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{withdrawError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!withdrawAccountName || parseFloat(withdrawAmount) <= 0}
                    className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Bank Withdrawal</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
