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
} from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';
import { User, TransactionType } from '../types';

interface CustomerWalletViewProps {
  currentUser: User;
  onOpenRegister: () => void;
}

export const CustomerWalletView: React.FC<CustomerWalletViewProps> = ({
  currentUser,
  onOpenRegister,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(50000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<string>('Wema Bank (ALAT)');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hideBalance, setHideBalance] = useState<boolean>(false);

  const wallet = faiiyaEngine.getWallet(currentUser.id);
  const isKycVerified = wallet.kycStatus === 'verified' && currentUser.kycStatus !== 'unverified';

  // KYC Verification state: NIN is primary / shown first!
  const [kycType, setKycType] = useState<'nin' | 'bvn'>('nin');
  const [kycInput, setKycInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [showVerifiedCard, setShowVerifiedCard] = useState<boolean>(false);

  const virtualAccounts = faiiyaEngine.getVirtualAccounts(currentUser.id);
  const transactions = faiiyaEngine.getTransactions(
    currentUser.id,
    filterType === 'all' ? undefined : filterType
  );
  const referralStats = faiiyaEngine.getReferralStats(currentUser.id);

  // Financial Analytics Calculations
  const allUserTxns = faiiyaEngine.getTransactions(currentUser.id);
  const totalInflows = allUserTxns
    .filter((tx) => tx.type === 'deposit' || tx.type === 'referral_bonus' || (tx.type === 'admin_adjustment' && tx.balanceAfter > tx.balanceBefore))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalOutflows = allUserTxns
    .filter((tx) => tx.type === 'debit_order' || (tx.type === 'admin_adjustment' && tx.balanceAfter < tx.balanceBefore))
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

  const handleVerifyKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycError(null);
    const cleanId = kycInput.replace(/\D/g, '');
    if (cleanId.length !== 11) {
      setKycError(
        `Please enter a valid 11-digit ${
          kycType === 'nin' ? 'National ID Number (NIN)' : 'Bank Verification Number (BVN)'
        }.`
      );
      return;
    }

    setIsVerifying(true);
    try {
      // Query Monnify API strictly with no fallbacks
      const verified = await faiiyaEngine.verifyKycWithMonnify({
        bvnOrNin: cleanId,
        type: kycType,
        nameHint: {
          firstName: currentUser.firstName,
          otherNames: currentUser.otherNames,
          lastName: currentUser.lastName,
        },
      });

      const res = faiiyaEngine.verifyKyc({
        userId: currentUser.id,
        bvnOrNin: cleanId,
        verifiedNames: {
          firstName: verified.firstName,
          otherNames: verified.otherNames,
          lastName: verified.lastName,
        },
      });

      setIsVerifying(false);
      setKycInput('');
      setShowVerifiedCard(false);
      showToast(
        `✓ Identity successfully verified with ${kycType.toUpperCase()}! Dedicated virtual accounts activated for ${
          res.user.firstName
        } (Account Name: ${res.user.firstName}).`
      );
    } catch (err: any) {
      setIsVerifying(false);
      setKycError(err.message || 'Monnify KYC verification failed. Please check your BVN or NIN.');
    }
  };

  const fillDemoNIN = () => {
    setKycType('nin');
    setKycInput('11223344556');
    setKycError(null);
  };

  const fillDemoBVN = () => {
    setKycType('bvn');
    setKycInput('22345678901');
    setKycError(null);
  };

  const handleSimulateBankTransfer = () => {
    if (!isKycVerified) {
      showToast('⚠️ Please verify your NIN or BVN in the verification card above to unlock bank transfer top-ups.');
      const cardEl = document.getElementById('verification-card');
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    const finalAmount = customAmount ? parseFloat(customAmount) : topUpAmount;
    if (isNaN(finalAmount) || finalAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const targetAccount = virtualAccounts.find((va) => va.bankName.includes(selectedBank.split(' ')[0])) || virtualAccounts[0];
    const txRef = 'MNFY_TEST_' + Math.floor(1000000000 + Math.random() * 9000000000);

    const payload = {
      eventType: 'SUCCESSFUL_TRANSACTION',
      eventData: {
        transactionReference: txRef,
        paymentReference: 'PAY_REF_' + Date.now(),
        amountPaid: finalAmount,
        paymentStatus: 'PAID',
        customer: { email: currentUser.email },
        destinationAccountInformation: {
          accountNumber: targetAccount ? targetAccount.accountNumber : '9928374182',
          bankCode: targetAccount ? targetAccount.bankCode : '035',
        },
      },
    };

    const res = faiiyaEngine.processMonnifyWebhook(payload);
    setIsTopUpOpen(false);
    setCustomAmount('');
    showToast(`✓ Monnify Bank Transfer credited ₦${finalAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })} to your wallet!`);
  };

  const handleSimulateReferralSignup = () => {
    const randomFirstNames = ['Tunde', 'Fatima', 'Emeka', 'Kemi', 'Zainab', 'Babatunde'];
    const randomLastNames = ['Balogun', 'Danjuma', 'Adeyemi', 'Okoro', 'Ibrahim'];
    const fn = randomFirstNames[Math.floor(Math.random() * randomFirstNames.length)];
    const ln = randomLastNames[Math.floor(Math.random() * randomLastNames.length)];
    const email = `${fn.toLowerCase()}.${Math.floor(Math.random() * 999)}@example.ng`;
    const randomBvn = '22' + Math.floor(100000000 + Math.random() * 900000000);

    try {
      const res = faiiyaEngine.registerUser({
        firstName: fn,
        lastName: ln,
        email,
        referredBy: referralStats.referralCode,
      });

      // Automatically complete KYC for simulated referee to provision virtual accounts
      const kycRes = faiiyaEngine.verifyKyc({
        userId: res.user.id,
        bvnOrNin: randomBvn,
      });

      showToast(`🎉 New user "${fn} ${ln}" registered & KYC verified with your referral code ${referralStats.referralCode}! ₦${referralStats.rewardPerReferral} bonus unlocked!`);
      
      // If reward trigger is on deposit, simulate deposit for the referee
      if (referralStats.trigger === 'on_first_wallet_deposit' && kycRes.virtualAccounts.length > 0) {
        setTimeout(() => {
          faiiyaEngine.processMonnifyWebhook({
            eventType: 'SUCCESSFUL_TRANSACTION',
            eventData: {
              transactionReference: 'REF_DEP_' + Date.now(),
              paymentReference: 'MNFY_REF_' + Date.now(),
              amountPaid: 10000,
              paymentStatus: 'PAID',
              customer: { email: res.user.email },
              destinationAccountInformation: {
                accountNumber: kycRes.virtualAccounts[0].accountNumber,
                bankCode: kycRes.virtualAccounts[0].bankCode,
              },
            },
          });
          showToast(`💰 Referee ${fn} made their 1st deposit! ₦${referralStats.rewardPerReferral} referral bonus credited to your wallet!`);
        }, 1200);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-400/40 text-sm font-semibold animate-bounce">
          <Sparkles className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Welcome & Balance */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 border border-emerald-900/40 p-4 sm:p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-6">
          <div className="space-y-2 w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-500/30">
                Closed-Loop Digital Wallet
              </span>
              {isKycVerified ? (
                <button
                  type="button"
                  onClick={() => setShowVerifiedCard((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors"
                  title="Click to view KYC verification card"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Verified Identity: {currentUser.maskedBvn || 'Active'}</span>
                </button>
              ) : (
                <a
                  href="#verification-card"
                  className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-md border border-amber-500/40 animate-pulse"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>KYC Unverified &bull; Submit NIN (or BVN)</span>
                </a>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome, {currentUser.firstName} {currentUser.lastName}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
              Instant automated funding via Monnify Reserved Virtual Accounts. Debited seamlessly across WooCommerce and headless checkout channels.
            </p>
          </div>

          {/* Balance Display Card */}
          <div className="bg-slate-950/90 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-saas w-full md:w-auto min-w-0 sm:min-w-[280px] flex flex-col justify-between relative overflow-hidden group">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>Available Wallet Balance</span>
                <button
                  type="button"
                  onClick={() => setHideBalance(!hideBalance)}
                  className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                  title={hideBalance ? 'Show balance' : 'Hide balance for privacy'}
                >
                  {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {isKycVerified ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  Locked
                </span>
              )}
            </div>
            <div className="mt-2 text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight font-mono flex items-center">
              <span className="text-emerald-400 font-sans mr-1">₦</span>
              {hideBalance ? (
                <span className="tracking-widest text-slate-400 select-none">••••••••</span>
              ) : (
                wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              )}
            </div>
            <div className="mt-3 sm:mt-4 flex items-center gap-2">
              <button
                onClick={() => setIsTopUpOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <ArrowDownLeft className="w-4 h-4" />
                Fund Wallet (Transfer)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended SaaS Metric & Cashflow Cards (Mobile responsive, rounded containers, box shadow) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Total Inflows */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 shadow-saas hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] sm:text-xs font-semibold">Total Inflows</span>
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-mono text-sm sm:text-base md:text-lg font-bold text-emerald-400">
            ₦{totalInflows.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500">Deposits & Bonuses</span>
        </div>

        {/* Metric 2: Total Spent */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 shadow-saas hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] sm:text-xs font-semibold">Total Outflows</span>
            <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-mono text-sm sm:text-base md:text-lg font-bold text-slate-200">
            ₦{totalOutflows.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-slate-500">Orders & Debits</span>
        </div>

        {/* Metric 3: KYC Tier Limit */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 shadow-saas hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] sm:text-xs font-semibold">Daily Limit</span>
            <div className="p-1 rounded-lg bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-mono text-sm sm:text-base md:text-lg font-bold text-white">
            {isKycVerified ? '₦5,000,000' : '₦50,000'}
          </div>
          <span className="text-[10px] text-slate-500">
            {isKycVerified ? 'CBN Tier-1 Verified' : 'Tier-0 Restricted'}
          </span>
        </div>

        {/* Metric 4: Monnify Webhook Speed */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 shadow-saas hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] sm:text-xs font-semibold">Credit Speed</span>
            <div className="p-1 rounded-lg bg-teal-500/10 text-teal-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-mono text-sm sm:text-base md:text-lg font-bold text-teal-300">
            &lt; 3.5s
          </div>
          <span className="text-[10px] text-emerald-400/80 font-medium">99.98% Monnify Uptime</span>
        </div>
      </div>

      {/* Mobile-Friendly Quick Actions Bar */}
      <div className="sm:hidden bg-slate-900/90 border border-slate-800 p-2.5 rounded-2xl shadow-saas flex items-center justify-around gap-1 text-center">
        <button
          onClick={() => setIsTopUpOpen(true)}
          className="flex-1 py-2 px-1 flex flex-col items-center gap-1 text-slate-300 hover:text-white"
        >
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold">Fund</span>
        </button>

        {!isKycVerified && (
          <a
            href="#verification-card"
            className="flex-1 py-2 px-1 flex flex-col items-center gap-1 text-amber-300 hover:text-white"
          >
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Fingerprint className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold">KYC</span>
          </a>
        )}

        {virtualAccounts.length > 0 && (
          <button
            onClick={() => copyToClipboard(virtualAccounts[0].accountNumber, 'mob-dva')}
            className="flex-1 py-2 px-1 flex flex-col items-center gap-1 text-slate-300 hover:text-white"
          >
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {copiedKey === 'mob-dva' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </div>
            <span className="text-[11px] font-bold">Copy DVA</span>
          </button>
        )}

        <button
          onClick={handleSimulateReferralSignup}
          className="flex-1 py-2 px-1 flex flex-col items-center gap-1 text-slate-300 hover:text-white"
        >
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Gift className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold">Refer</span>
        </button>
      </div>

      {/* Front Page Verification Card - Mobile Responsive, Shows NIN First then "or BVN" */}
      {(!isKycVerified || showVerifiedCard) && (
        <div
          id="verification-card"
          className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-xl ${
            isKycVerified
              ? 'bg-slate-900/95 border-emerald-500/40'
              : 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border-amber-500/40'
          } p-4 sm:p-6 md:p-8`}
        >
          {/* Background Ambient Glow */}
          <div
            className={`absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 rounded-full blur-3xl pointer-events-none ${
              isKycVerified ? 'bg-emerald-500/10' : 'bg-amber-500/10'
            }`}
          />

          <div className="relative z-10 flex flex-col gap-5 sm:gap-6">
            {/* Header / Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                    isKycVerified
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {isKycVerified ? (
                    <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <Lock className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        isKycVerified
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      {isKycVerified ? 'Verified KYC Profile (Tier-1)' : 'Identity Verification Required (Tier-1)'}
                    </span>
                    <span className="text-[10px] sm:text-xs font-medium text-slate-400">
                      Module B &bull; Monnify Reserved Accounts
                    </span>
                  </div>
                  <h2 className="text-base sm:text-xl md:text-2xl font-black text-white tracking-tight mt-1">
                    {isKycVerified
                      ? 'Official Identity & Account Verification'
                      : 'Unlock Dedicated Virtual Bank Accounts with NIN (or BVN)'}
                  </h2>
                </div>
              </div>

              {isKycVerified && (
                <button
                  type="button"
                  onClick={() => setShowVerifiedCard(false)}
                  className="self-start sm:self-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors"
                >
                  Close Card &times;
                </button>
              )}
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              In strict compliance with Central Bank of Nigeria (CBN) and NDPR data regulations, submit your{' '}
              <strong className="text-emerald-300 font-semibold">National Identity Number (NIN)</strong> or{' '}
              <strong className="text-emerald-300 font-semibold">Bank Verification Number (BVN)</strong>.
              Upon verification, Monnify provisions 3 dedicated Nigerian bank accounts (Wema Bank, Sterling Bank, Moniepoint) with instant name synchronization.
            </p>

            {/* Zero-Storage Guarantee Badge */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-400">
              <div className="flex items-start sm:items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <span>
                  <strong className="text-slate-200">Zero-Storage Guarantee:</strong> Raw NIN/BVN numbers are passed directly to Monnify over encrypted TLS 1.3 and are <em>never stored</em> on our servers or databases.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <Fingerprint className="w-3.5 h-3.5" />
                <span>NDPR & CBN Certified</span>
              </div>
            </div>

            {/* Error Message */}
            {kycError && (
              <div className="bg-rose-950/60 border border-rose-800/80 p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm text-rose-200 flex items-start gap-2.5 shadow-md">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="font-medium">{kycError}</span>
              </div>
            )}

            {/* Verification Form (NIN First, then "or BVN") */}
            <form onSubmit={handleVerifyKyc} className="space-y-4">
              {/* Type Selection Pills: NIN FIRST, then "or BVN" */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2 uppercase tracking-wider">
                  Select Verification Method:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-lg">
                  {/* Option 1: NIN (FIRST) */}
                  <label
                    onClick={() => {
                      setKycType('nin');
                      setKycError(null);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      kycType === 'nin'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          kycType === 'nin' ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600'
                        }`}
                      >
                        {kycType === 'nin' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                          <span>National ID Number (NIN)</span>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">Primary</span>
                        </div>
                        <div className="text-[11px] text-slate-400">11-digit National Identity Number</div>
                      </div>
                    </div>
                  </label>

                  {/* Option 2: or BVN */}
                  <label
                    onClick={() => {
                      setKycType('bvn');
                      setKycError(null);
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      kycType === 'bvn'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          kycType === 'bvn' ? 'border-emerald-400 bg-emerald-400' : 'border-slate-600'
                        }`}
                      >
                        {kycType === 'bvn' && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white">
                          or Bank Verification Number (BVN)
                        </div>
                        <div className="text-[11px] text-slate-400">11-digit Bank Verification Number</div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Form Input + Submit Button Row (Mobile Responsive) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {kycType === 'nin'
                      ? 'National Identity Number (NIN) (or BVN)'
                      : 'Bank Verification Number (BVN) (or NIN)'}{' '}
                    <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono font-medium ${
                      kycInput.replace(/\D/g, '').length === 11 ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {kycInput.replace(/\D/g, '').length}/11 digits
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      value={kycInput}
                      onChange={(e) => {
                        setKycInput(e.target.value.replace(/\D/g, ''));
                        setKycError(null);
                      }}
                      placeholder={
                        kycType === 'nin'
                          ? 'Enter 11-digit NIN (or BVN)'
                          : 'Enter 11-digit BVN (or NIN)'
                      }
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 sm:py-2.5 text-sm sm:text-base font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all tracking-wider"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || kycInput.replace(/\D/g, '').length !== 11}
                    className={`w-full sm:w-auto min-h-[46px] sm:min-h-[42px] px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                      kycInput.replace(/\D/g, '').length === 11 && !isVerifying
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 hover:scale-[1.01]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Verifying with Monnify...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify {kycType === 'nin' ? 'NIN (or BVN)' : 'BVN (or NIN)'} & Unlock →</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Demo Autofill Helper Pills (Touch friendly on mobile) */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-400 text-[11px] font-medium mr-1">Quick Demo Autofill:</span>
                <button
                  type="button"
                  onClick={fillDemoNIN}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono text-[11px] flex items-center gap-1.5 transition-colors"
                >
                  <Fingerprint className="w-3 h-3 text-emerald-400" />
                  <span>Demo NIN: 11223344556</span>
                </button>
                <button
                  type="button"
                  onClick={fillDemoBVN}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-700 font-mono text-[11px] flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>or Demo BVN: 22345678901</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid: Virtual Accounts & Referral Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monnify Virtual Accounts (2 Columns on desktop) */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Monnify Dedicated Virtual Accounts</h2>
                <p className="text-xs text-slate-400">
                  Transfer funds from any Nigerian banking app. Wallet is credited automatically in seconds.
                </p>
              </div>
            </div>
            {isKycVerified && (
              <button
                onClick={() => setIsTopUpOpen(true)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline underline-offset-4 self-start sm:self-auto"
              >
                Test Webhook Transfer &rarr;
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {!isKycVerified || virtualAccounts.length === 0 ? (
              <div className="col-span-full bg-slate-950/70 border border-dashed border-amber-500/30 rounded-xl p-5 sm:p-6 text-center">
                <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 mx-auto mb-2 opacity-80" />
                <h3 className="text-sm font-bold text-white mb-1">
                  Dedicated Virtual Bank Accounts Locked
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-3.5 leading-relaxed">
                  Dedicated Wema Bank, Sterling Bank, and Moniepoint account numbers will be generated automatically once your 11-digit NIN (or BVN) is verified above.
                </p>
                <a
                  href="#verification-card"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  <span>Verify with NIN (or BVN) Above &uarr;</span>
                </a>
              </div>
            ) : (
              virtualAccounts.map((va) => {
                const isCopied = copiedKey === va.accountNumber;
                return (
                  <div
                    key={va.id}
                    className="bg-slate-950/70 border border-slate-800 hover:border-emerald-500/40 p-4 rounded-xl transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-semibold text-slate-300">{va.bankName}</span>
                        <span className="font-mono text-[10px] text-slate-500">Code: {va.bankCode}</span>
                      </div>
                      <div className="mt-2 font-mono text-lg font-bold text-white tracking-wider break-all">
                        {va.accountNumber}
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] flex items-center justify-between">
                        <span className="text-slate-500">Account Name:</span>
                        <span className="text-emerald-400 font-semibold tracking-wide">{va.accountName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => copyToClipboard(va.accountNumber, va.accountNumber)}
                      className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors min-h-[38px]"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Account</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2 text-xs text-slate-400">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>How it works:</strong> Monnify webhook listener receives instant notifications at{' '}
              <code className="bg-slate-800 text-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">/wp-json/faiiya/v1/webhook/monnify</code>,
              verifies the SHA-512 cryptographic signature, and executes an atomic MySQL row lock (<code className="text-emerald-300">SELECT ... FOR UPDATE</code>) to credit your wallet safely.
            </span>
          </div>
        </div>

        {/* Tiered Referral Engine Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Refer & Earn Program</h2>
                <p className="text-xs text-slate-400">
                  Earn ₦{referralStats.rewardPerReferral.toLocaleString()} bonus on each referred customer.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Your Referral Code</label>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 px-3 py-2 rounded-lg">
                  <span className="font-mono text-base font-extrabold text-emerald-400 tracking-wider">
                    {referralStats.referralCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(referralStats.referralCode, 'ref-code')}
                    className="text-slate-400 hover:text-white"
                  >
                    {copiedKey === 'ref-code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Shareable Invite Link</label>
                <div className="flex items-center justify-between bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 truncate">
                  <span className="truncate">{referralStats.shareableLink}</span>
                  <button
                    onClick={() => copyToClipboard(referralStats.shareableLink, 'ref-link')}
                    className="text-slate-400 hover:text-white shrink-0 ml-2"
                  >
                    {copiedKey === 'ref-link' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Referral Stats Summary */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Invited</div>
                <div className="text-base font-bold text-white font-mono">{referralStats.totalReferrals}</div>
              </div>
              <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Converted</div>
                <div className="text-base font-bold text-emerald-400 font-mono">{referralStats.successfulReferrals}</div>
              </div>
              <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-400">Earned</div>
                <div className="text-sm font-bold text-emerald-300 font-mono">
                  ₦{referralStats.totalEarnings.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <button
              onClick={handleSimulateReferralSignup}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-lg text-xs font-semibold text-emerald-300 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Simulate Friend Sign-up with Code
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Wallet Transaction History</h2>
            <p className="text-xs text-slate-400">
              Complete audit ledger with UUID tracking and before/after balance snapshots.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
            {(['all', 'deposit', 'debit_order', 'referral_bonus', 'admin_adjustment'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                  filterType === t
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'All Transactions' : t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No transactions found for the selected category.
          </div>
        ) : (
          <div>
            {/* Mobile View: High-density Touch Cards */}
            <div className="space-y-3 sm:hidden">
              {transactions.map((tx) => {
                const isCredit =
                  tx.type === 'deposit' ||
                  tx.type === 'referral_bonus' ||
                  (tx.type === 'admin_adjustment' && tx.balanceAfter > tx.balanceBefore);
                const isCopied = copiedKey === tx.txnUuid;

                return (
                  <div
                    key={tx.id}
                    className="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-3.5 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            isCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs capitalize">
                            {tx.type.replace('_', ' ')}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate max-w-[140px]">
                            {tx.reference}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-mono font-bold text-sm ${
                            isCredit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isCredit ? '+' : '-'}₦{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {tx.status}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <div>
                        Bal: <span className="text-slate-300">₦{tx.balanceAfter.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">
                          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(tx.txnUuid, tx.txnUuid)}
                          className="bg-slate-900 border border-slate-800 text-[10px] px-1.5 py-0.5 rounded text-slate-400 hover:text-white"
                          title="Copy UUID"
                        >
                          {isCopied ? 'Copied' : 'UUID'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Responsive Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider">
                  <tr>
                    <th className="pb-3 px-3">Type & Reference</th>
                    <th className="pb-3 px-3">Amount</th>
                    <th className="pb-3 px-3">Balance Snapshot</th>
                    <th className="pb-3 px-3">Txn UUID</th>
                    <th className="pb-3 px-3">Timestamp</th>
                    <th className="pb-3 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {transactions.map((tx) => {
                    const isCredit =
                      tx.type === 'deposit' ||
                      tx.type === 'referral_bonus' ||
                      (tx.type === 'admin_adjustment' && tx.balanceAfter > tx.balanceBefore);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1.5 rounded-md ${
                                isCredit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}
                            >
                              {isCredit ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-200 capitalize">
                                {tx.type.replace('_', ' ')}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 truncate max-w-[150px]">
                                {tx.reference}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-sm whitespace-nowrap">
                          <span className={isCredit ? 'text-emerald-400' : 'text-rose-400'}>
                            {isCredit ? '+' : '-'}₦{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                          <div>
                            Before: <span className="text-slate-300">₦{tx.balanceBefore.toLocaleString()}</span>
                          </div>
                          <div>
                            After: <span className="text-slate-200 font-semibold">₦{tx.balanceAfter.toLocaleString()}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                          <span
                            className="bg-slate-950 px-2 py-1 rounded border border-slate-800 hover:border-slate-700 cursor-pointer"
                            onClick={() => copyToClipboard(tx.txnUuid, tx.txnUuid)}
                            title="Click to copy UUID"
                          >
                            {tx.txnUuid.slice(0, 13)}...
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString()}{' '}
                          {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Top-Up Simulator Modal */}
      {isTopUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Simulate Monnify Bank Transfer</h3>
              </div>
              <button
                onClick={() => setIsTopUpOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Simulates a Nigerian bank transfer to your dedicated Monnify virtual account, triggering the webhook listener with full cryptographic verification.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Destination Virtual Account
                </label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {virtualAccounts.map((va) => (
                    <option key={va.id} value={va.bankName}>
                      {va.bankName} - {va.accountNumber} ({va.accountName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Select Quick Transfer Amount
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[10000, 25000, 50000, 100000, 250000, 500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setTopUpAmount(amt);
                        setCustomAmount('');
                      }}
                      className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold transition-all ${
                        topUpAmount === amt && !customAmount
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Or Custom Amount (₦ NGN)
                </label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="e.g. 75000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="text-slate-200">{currentUser.firstName} {currentUser.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Simulated Webhook:</span>
                  <span className="text-emerald-400 font-mono">POST /wp-json/faiiya/v1/webhook/monnify</span>
                </div>
                <div className="flex justify-between">
                  <span>Signature Check:</span>
                  <span className="text-slate-200">HMAC-SHA512 (Automated)</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTopUpOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSimulateBankTransfer}
                  className="px-5 py-2.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02]"
                >
                  Send Bank Transfer (Top Up)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
