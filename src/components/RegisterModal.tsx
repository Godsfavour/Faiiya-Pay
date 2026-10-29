import React, { useState } from 'react';
import {
  Lock,
  Building2,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  User as UserIcon,
  Ticket,
  ArrowRight,
  LogIn,
  Eye,
  EyeOff,
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
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [firstName, setFirstName] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [loginEmailOrPhone, setLoginEmailOrPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please provide your First Name and Last Name.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      // Standard Tier 0 Registration (no NIN/BVN on registration)
      const res = faiiyaEngine.registerUser({
        firstName: firstName.trim(),
        otherNames: otherNames.trim() || undefined,
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        email: email.trim(),
        referredBy: referralCode.trim() || undefined,
      });

      setLoading(false);
      onSuccess(res.user.id);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Registration failed.');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const query = loginEmailOrPhone.trim().toLowerCase();
    if (!query) {
      setError('Please enter your email or username to log in.');
      return;
    }

    const allUsers = faiiyaEngine.getUsers();
    const found = allUsers.find(
      (u) =>
        u.email.toLowerCase() === query ||
        u.username.toLowerCase() === query ||
        (u.phoneNumber && u.phoneNumber.replace(/\D/g, '') === query.replace(/\D/g, ''))
    );

    if (found) {
      faiiyaEngine.setCurrentUserId(found.id);
      onSuccess(found.id);
      onClose();
    } else {
      setError(`No account found matching "${loginEmailOrPhone}". Please check your details or sign up.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <span className="text-xl font-bold leading-none">&times;</span>
        </button>

        {/* Dynamic WordPress Site Logo Header - Twice the size (w-24 h-24), consistent styling */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-24 h-24 rounded-2xl bg-white border border-slate-700/60 shadow-xl flex items-center justify-center p-3 mb-4 transition-transform hover:scale-105">
            <svg
              className="w-full h-full text-slate-900"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* WordPress Official Brand Mark */}
              <circle cx="50" cy="50" r="48" fill="#0073AA" />
              <path
                d="M50 8C26.8 8 8 26.8 8 50c0 10.3 3.7 19.7 9.9 27L36.3 27.2c.4-1.1.8-2.2.8-3.1 0-1.4-1-2.4-2.8-2.6-.4 0-.7-.1-1.1-.1h-1.5V19h15.4v2.4h-1.5c-2.4.2-3.1 2-3.1 3.5 0 .9.3 2 .8 3.1l11.4 33.2 6.5-19.4c.4-1.2.6-2.3.6-3.1 0-1.4-.9-2.3-2.6-2.5-.4 0-.8-.1-1.1-.1h-1.5V19h14.7v2.4h-1.5c-2.3.2-3.2 2-3.2 3.5 0 .9.3 2 .8 3.1l11.3 32.8L82 77.2C88.2 69.8 92 60.3 92 50c0-23.2-18.8-42-42-42zm-2.8 77.8L31.8 40.4 17.5 79.5c8.6 6.1 19 9.7 30.2 9.7 1.5 0 3-.1 4.5-.3-1.6-.9-3.7-2-5-3.1zm22.4-44.5L59 69.2l13.7 11.5c5.3-7.2 8.5-16 8.5-25.7 0-4.5-.7-8.8-2-12.8L69.6 41.3z"
                fill="#ffffff"
              />
            </svg>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Signup / login
          </h2>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mt-4 w-full">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Log In
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-rose-950/60 border border-rose-800/80 p-3.5 rounded-2xl text-xs text-rose-200 flex items-start gap-2.5 shadow-sm animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {mode === 'signup' ? (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            {/* First Name on its own separate line */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                First Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Babatunde"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Other Names (optional) on its own separate line */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Other Names <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={otherNames}
                onChange={(e) => setOtherNames(e.target.value)}
                placeholder="e.g. Oluwaseun"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Last Name on its own separate line */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Last Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Adeyemi"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Phone Number on its own separate line */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Phone Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 08031234567"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Email Address on its own separate line */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chinedu@example.ng"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Password on its own separate line */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password (min 8 characters) <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-white p-1 rounded-lg transition-colors focus:outline-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Referral Code (Optional) on its own separate line */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Referral Code <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="e.g. CHIN8921"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono uppercase placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Wallet</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Email Address or Username
              </label>
              <input
                type="text"
                required
                value={loginEmailOrPhone}
                onChange={(e) => setLoginEmailOrPhone(e.target.value)}
                placeholder="e.g. babatunde@example.ng"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In to Wallet</span>
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-500">
          {mode === 'signup' ? (
            <span>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-emerald-400 font-bold hover:underline"
              >
                Log In
              </button>
            </span>
          ) : (
            <span>
              Need a new wallet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="text-emerald-400 font-bold hover:underline"
              >
                Sign Up
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
