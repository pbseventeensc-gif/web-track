import React, { useState } from 'react';
import BranchOrderForm from './kawanlama/BranchOrderForm';
import BranchOrderHistory from './kawanlama/BranchOrderHistory';
import AdminApprovalPanel from './kawanlama/AdminApprovalPanel';
import AdminMasterData from './kawanlama/AdminMasterData';
import AdminPromoManager from './kawanlama/AdminPromoManager';
import AdminBranchMonitoring from './kawanlama/AdminBranchMonitoring';

export default function KawanLamaTab({ isDarkMode, currentUser, isBranchMode }) {
  const [activeSubTab, setActiveSubTab] = useState(isBranchMode ? 'order_baru' : 'master');

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Tab Navigasi Admin / Cabang */}
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveSubTab('master')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeSubTab === 'master' ? 'bg-blue-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
            >
              📦 Master Data
            </button>
            <button 
              onClick={() => setActiveSubTab('promo')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeSubTab === 'promo' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
            >
              📢 Kelola & Share Promo
            </button>
            <button 
              onClick={() => setActiveSubTab('monitoring')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeSubTab === 'monitoring' ? 'bg-purple-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
            >
              📊 Status Cabang (Submit / Belum)
            </button>
            <button 
              onClick={() => setActiveSubTab('approval')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeSubTab === 'approval' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
            >
              🔒 Approval & Grouping Order
            </button>
          </>
        )}
        {isBranchMode && (
          <>
            <button 
              onClick={() => setActiveSubTab('order_baru')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeSubTab => activeSubTab === 'order_baru' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
            >
              ➕ Order Baru
            </button>
            <button 
              onClick={() => setActiveSubTab('riwayat')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${activeSubTab === 'riwayat' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
            >
              🚚 Tracking Order
            </button>
          </>
        )}
      </div>

      {/* Routing Konten */}
      {activeSubTab === 'master' && <AdminMasterData isDarkMode={isDarkMode} />}
      {activeSubTab === 'promo' && <AdminPromoManager isDarkMode={isDarkMode} />}
      {activeSubTab === 'monitoring' && <AdminBranchMonitoring isDarkMode={isDarkMode} />}
      {activeSubTab === 'approval' && <AdminApprovalPanel isDarkMode={isDarkMode} />}
      {activeSubTab === 'order_baru' && <BranchOrderForm isDarkMode={isDarkMode} currentUser={currentUser} isBranchMode={isBranchMode} />}
      {activeSubTab === 'riwayat' && <BranchOrderHistory isDarkMode={isDarkMode} currentUser={currentUser} />}
    </div>
  );
}