import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { CustomerWalletView } from './components/CustomerWalletView';
import { WooCommerceCheckout } from './components/WooCommerceCheckout';
import { WPAdminDashboard } from './components/WPAdminDashboard';
import { ApiExplorer } from './components/ApiExplorer';
import { CodeExplorer } from './components/CodeExplorer';
import { RegisterModal } from './components/RegisterModal';
import { faiiyaEngine } from './services/faiiyaEngine';
import { downloadPluginZip } from './services/zipExport';
import { User } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('wallet');
  const [currentUser, setCurrentUser] = useState<User>(faiiyaEngine.getCurrentUser());
  const [users, setUsers] = useState<User[]>(faiiyaEngine.getUsers());
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [, setTick] = useState(0);

  // Subscribe to engine state updates
  useEffect(() => {
    const unsubscribe = faiiyaEngine.subscribe(() => {
      setCurrentUser(faiiyaEngine.getCurrentUser());
      setUsers(faiiyaEngine.getUsers());
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const handleSwitchUser = (userId: number) => {
    faiiyaEngine.setCurrentUserId(userId);
    setCurrentUser(faiiyaEngine.getCurrentUser());
  };

  const handleRegisterSuccess = (newUserId: number) => {
    handleSwitchUser(newUserId);
    setActiveTab('wallet');
  };

  const handleDownloadZip = async () => {
    try {
      setIsExporting(true);
      await downloadPluginZip();
    } catch (err: any) {
      alert('Failed to generate zip: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans antialiased">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        onOpenRegister={() => setIsRegisterOpen(true)}
        onDownloadZip={handleDownloadZip}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'wallet' && (
          <CustomerWalletView
            currentUser={currentUser}
            onOpenRegister={() => setIsRegisterOpen(true)}
          />
        )}

        {activeTab === 'store' && (
          <WooCommerceCheckout
            currentUser={currentUser}
            onGoToWallet={() => setActiveTab('wallet')}
          />
        )}

        {activeTab === 'admin' && <WPAdminDashboard />}

        {activeTab === 'api' && <ApiExplorer currentUser={currentUser} />}

        {activeTab === 'code' && <CodeExplorer onDownloadZip={handleDownloadZip} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-850 bg-slate-900/60 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400">Faiiya Pay WordPress Plugin</span>
            <span>&bull;</span>
            <span>PSR-4 Compliant &bull; Monnify Reserved Accounts &bull; WooCommerce</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('code')}
              className="hover:text-emerald-400 transition-colors"
            >
              Source Files (19)
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className="hover:text-emerald-400 transition-colors"
            >
              REST API Docs
            </button>
            <button
              onClick={handleDownloadZip}
              className="hover:text-emerald-400 font-semibold transition-colors"
            >
              {isExporting ? 'Zipping...' : 'Download Plugin (.zip)'}
            </button>
          </div>
        </div>
      </footer>

      {/* KYC Registration Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handleRegisterSuccess}
      />
    </div>
  );
}
