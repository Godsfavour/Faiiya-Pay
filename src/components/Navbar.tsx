import React from 'react';
import {
  Wallet,
  ShoppingBag,
  Sliders,
  Code,
  Terminal,
  User as UserIcon,
  Sparkles,
  Download,
} from 'lucide-react';
import { faiiyaEngine } from '../services/faiiyaEngine';
import { User } from '../types';

export type ActiveTab = 'wallet' | 'store' | 'admin' | 'api' | 'code';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: User;
  users: User[];
  onSwitchUser: (userId: number) => void;
  onOpenRegister: () => void;
  onDownloadZip: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  users,
  onSwitchUser,
  onOpenRegister,
  onDownloadZip,
}) => {
  const wallet = faiiyaEngine.getWallet(currentUser.id);

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  Faiiya Pay
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  WP & Headless
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Closed-Loop Wallet &bull; Monnify Reserved Accounts &bull; WooCommerce
              </p>
            </div>
          </div>

          {/* Navigation Mode Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'wallet'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              Customer Wallet
            </button>

            <button
              onClick={() => setActiveTab('store')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'store'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              WooCommerce Store
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'admin'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              WP Admin
            </button>

            <button
              onClick={() => setActiveTab('api')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'api'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              REST API
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'code'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              Plugin Code
            </button>
          </nav>

          {/* Right Actions: User Switcher & ZIP Export */}
          <div className="flex items-center gap-2.5">
            {/* User Switcher Dropdown */}
            <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={currentUser.id}
                onChange={(e) => onSwitchUser(Number(e.target.value))}
                className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
                title="Switch simulated logged-in user"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-slate-200">
                    {u.firstName} {u.lastName} ({u.role === 'administrator' ? 'Admin' : 'Customer'})
                  </option>
                ))}
              </select>
            </div>

            {/* Register New User trigger */}
            <button
              onClick={onOpenRegister}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white transition-all hover:scale-[1.02] shadow-sm"
              title="Open KYC Registration Form"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">Register User (KYC)</span>
              <span className="sm:hidden text-[11px] font-bold">Register</span>
            </button>

            {/* 1-Click ZIP Download */}
            <button
              onClick={onDownloadZip}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02]"
              title="Download production-ready faiiya-pay.zip"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Plugin .ZIP</span>
              <span className="sm:hidden text-[11px]">.ZIP</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden overflow-x-auto py-2 gap-1.5 border-t border-slate-800/80 no-scrollbar">
          {[
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'store', label: 'Store', icon: ShoppingBag },
            { id: 'admin', label: 'WP Admin', icon: Sliders },
            { id: 'api', label: 'REST API', icon: Terminal },
            { id: 'code', label: 'Code', icon: Code },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCur = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isCur
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-900/90 border border-slate-800/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
