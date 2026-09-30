import React, { useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Lock,
  Building2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Fingerprint,
} from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: number) => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [firstName, setFirstName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVerifyingKyc, setIsVerifyingKyc] = useState(false);
  const [kycSynced, setKycSynced] = useState<boolean>(false);
  const [kycProvider, setKycProvider] = useState<string | null>(null);

  if (!isOpen) return null;

  const isNinValid = /^\d{11}$/.test(nin);
  const isBvnValid = /^\d{11}$/.test(bvn);
  const hasKyc = isNinValid || isBvnValid;

  // Live Monnify API Verification & Name Replacement
  const handleVerifyAndSyncNames = async () => {
    const targetId = nin || bvn;
    const targetType: 'nin' | 'bvn' = nin ? 'nin' : 'bvn';

    if (!targetId || targetId.length !== 11) {
      setError(`Please enter a valid 11-digit ${targetType.toUpperCase()} to query Monnify API.`);
      return;
    }

    setError(null);
    setIsVerifyingKyc(true);

    try {
      const res = await faiiyaEngine.verifyKycWithMonnify({
        bvnOrNin: targetId,
        type: targetType,
        nameHint: {
          firstName: firstName.trim(),
          otherNames: otherNames.trim(),
          lastName: lastName.trim(),
        },
      });

      // Strict Compliance: Replace the names on the form with the official names from the BVN/NIN!
      setFirstName(res.firstName);
      setOtherNames(res.otherNames || '');
      setLastName(res.lastName);
      setKycSynced(true);
      setKycProvider(res.provider);
      setError(null);
    } catch (err: any) {
      setKycSynced(false);
      setError(err.message || 'Monnify KYC Verification failed.');
    } finally {
      setIsVerifyingKyc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const kycTarget = nin || bvn;
    const kycType = nin ? 'nin' : 'bvn';

    if (nin && !isNinValid) {
      setError('National Identity Number (NIN) must be exactly 11 numeric digits.');
      return;
    }

    if (bvn && !isBvnValid) {
      setError('Bank Verification Number (BVN) must be exactly 11 numeric digits.');
      return;
    }

    setLoading(true);

    try {
      let verifiedFirst = firstName.trim();
      let verifiedOther = otherNames.trim();
      let verifiedLast = lastName.trim();

      // If NIN or BVN is provided, query Monnify API strictly with no fake fallbacks
      if (kycTarget) {
        const monnifyResult = await faiiyaEngine.verifyKycWithMonnify({
          bvnOrNin: kycTarget,
          type: kycType,
          nameHint: {
            firstName: verifiedFirst,
            otherNames: verifiedOther,
            lastName: verifiedLast,
          },
        });

        // Replace names with verified legal identity for full Monnify/NIBSS compliance
        verifiedFirst = monnifyResult.firstName;
        verifiedOther = monnifyResult.otherNames;
        verifiedLast = monnifyResult.lastName;
        setFirstName(verifiedFirst);
        setOtherNames(verifiedOther);
        setLastName(verifiedLast);
      }

      // Register the user with compliant names
      const res = faiiyaEngine.registerUser({
        firstName: verifiedFirst,
        otherNames: verifiedOther || undefined,
        lastName: verifiedLast,
        email,
        referredBy: referralCode || undefined,
      });

      // Verify KYC and provision virtual accounts (Account Name = User First Name)
      if (kycTarget) {
        faiiyaEngine.verifyKyc({
          userId: res.user.id,
          bvnOrNin: kycTarget,
          verifiedNames: {
            firstName: verifiedFirst,
            otherNames: verifiedOther,
            lastName: verifiedLast,
          },
        });
      }

      setLoading(false);
      onSuccess(res.user.id);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Registration and verification failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-4 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Customer Onboarding & Monnify KYC
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Module A & B: Virtual bank account reservation with NIN or BVN.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 rounded-lg"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-rose-950/60 border border-rose-800/80 p-3 rounded-xl text-xs text-rose-200 flex items-start gap-2 shadow-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {kycSynced && (
          <div className="mb-4 bg-emerald-950/60 border border-emerald-800/80 p-3 rounded-xl text-xs text-emerald-200 flex items-start gap-2 shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block text-emerald-300 font-bold mb-0.5">
                ✓ Identity Verified & Compliant Names Synchronized
              </strong>
              Form names replaced with official {kycProvider || 'Monnify/NIBSS'} verified record:{' '}
              <span className="font-semibold text-white">
                {firstName} {otherNames ? otherNames + ' ' : ''}{lastName}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          {/* Name Fields: First Name, Other Names (optional), Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                First Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setKycSynced(false);
                }}
                placeholder="e.g. Babatunde"
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none ${
                  kycSynced
                    ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-200 font-semibold'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Other Names <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={otherNames}
                onChange={(e) => {
                  setOtherNames(e.target.value);
                  setKycSynced(false);
                }}
                placeholder="e.g. Oluwaseun"
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none ${
                  kycSynced
                    ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-200 font-semibold'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Last Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setKycSynced(false);
                }}
                placeholder="e.g. Adeyemi"
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none ${
                  kycSynced
                    ? 'border-emerald-500/80 bg-emerald-950/20 text-emerald-200 font-semibold'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Email Address <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="babatunde@example.ng"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Password <span className="text-rose-400">*</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Identification Section: Shows NIN First then "or BVN" */}
          <div className="bg-slate-950/80 p-3 sm:p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-200">
                Government KYC Verification (NIN First, or BVN)
              </span>
              <span className="text-[11px] text-slate-400">
                Direct Monnify API query with live Name Compliance
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                    <span>National ID (NIN)</span>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1 py-0.2 rounded uppercase">Primary</span>
                  </label>
                  {nin && (
                    <span
                      className={`text-[10px] font-mono ${
                        isNinValid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {nin.length}/11
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={11}
                  inputMode="numeric"
                  value={nin}
                  onChange={(e) => {
                    setNin(e.target.value.replace(/\D/g, ''));
                    setKycSynced(false);
                    setError(null);
                  }}
                  placeholder="11223344556"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>or BVN (11 Digits)</span>
                  </label>
                  {bvn && (
                    <span
                      className={`text-[10px] font-mono ${
                        isBvnValid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {bvn.length}/11
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  maxLength={11}
                  inputMode="numeric"
                  value={bvn}
                  onChange={(e) => {
                    setBvn(e.target.value.replace(/\D/g, ''));
                    setKycSynced(false);
                    setError(null);
                  }}
                  placeholder="22345678901"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Verify & Replace Names Action Button */}
            {(nin || bvn) && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleVerifyAndSyncNames}
                  disabled={isVerifyingKyc || (!isNinValid && !isBvnValid)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                >
                  {isVerifyingKyc ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Querying Monnify API...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verify & Replace Names for Compliance</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] text-slate-500 italic">
                  Live verification replaces First, Other, Last names
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Referral Code (Optional)
            </label>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="e.g. CHIN8921"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 font-mono uppercase focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Fintech Zero-Storage & Name Replacement Guarantee:</span>
            </div>
            <p>
              Submit your <strong>NIN (or BVN)</strong>. Verified names will automatically replace the form input to comply with Monnify and CBN anti-fraud rules. Raw numbers are never stored in the database.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || isVerifyingKyc || (nin.length > 0 && !isNinValid) || (bvn.length > 0 && !isBvnValid)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all text-center"
            >
              {loading
                ? 'Verifying & Reserving Accounts...'
                : hasKyc
                ? 'Register & Verify NIN (or BVN)'
                : 'Create Account & Wallet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

