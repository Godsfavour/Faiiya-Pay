import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Lock, AlertCircle, X, KeyRound } from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';

interface AdminPinModalProps {
  isOpen: boolean;
  title: string;
  actionDescription: string;
  warningNote?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  title,
  actionDescription,
  warningNote,
  onSuccess,
  onClose,
}) => {
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPinDigits(['', '', '', '', '', '']);
      setError(null);
      setShake(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigitChange = (index: number, val: string) => {
    // Only accept numeric
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const newDigits = [...pinDigits];

    if (clean.length > 1) {
      // Pasting full PIN or multiple digits
      const chars = clean.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newDigits[i] = chars[i] || '';
      }
      setPinDigits(newDigits);
      const nextFocus = Math.min(chars.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    newDigits[index] = clean.slice(-1);
    setPinDigits(newDigits);
    setError(null);

    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pin = pinDigits.join('');
    if (pin.length !== 6) {
      setError('Please enter all 6 digits of your Admin Security PIN.');
      triggerShake();
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      const isValid = faiiyaEngine.verifyAdminPin(pin);
      if (isValid) {
        setIsVerifying(false);
        onSuccess();
      } else {
        setIsVerifying(false);
        setError('Invalid Admin Security PIN. Authorization declined.');
        triggerShake();
        setPinDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    }, 200);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-7 relative transition-all ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {title}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Admin 2FA Security Authorization
            </p>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 mb-5 text-sm text-slate-300">
          <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">
            Action to authorize
          </div>
          <div className="font-semibold text-slate-100">{actionDescription}</div>
          {warningNote && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{warningNote}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
            Enter 6-Digit Admin Security PIN
          </label>

          <div className="flex justify-center items-center gap-2.5 sm:gap-3 mb-4">
            {pinDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono rounded-2xl bg-slate-950 border ${
                  error
                    ? 'border-red-500 text-red-300'
                    : digit
                    ? 'border-emerald-500/70 text-emerald-400 bg-emerald-950/10'
                    : 'border-slate-800 text-white focus:border-cyan-500'
                } focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all shadow-inner`}
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-xs text-red-400 font-medium mb-4 bg-red-950/40 border border-red-900/50 py-2 px-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center text-xs text-slate-400 mb-6">
            Default Production PIN: <span className="font-mono text-cyan-400 font-bold">889922</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="flex-1 py-3 px-4 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || pinDigits.some((d) => !d)}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authorize Action</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
