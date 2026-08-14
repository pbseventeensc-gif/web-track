import React, { useState, useEffect } from 'react';
import BranchOrderForm from './kawanlama/BranchOrderForm';
import BranchOrderHistory from './kawanlama/BranchOrderHistory';
import AdminApprovalPanel from './kawanlama/AdminApprovalPanel';
import AdminMasterData from './kawanlama/AdminMasterData';
import AdminPromoManager from './kawanlama/AdminPromoManager';
import AdminBranchMonitoring from './kawanlama/AdminBranchMonitoring';
import { supabase } from '../supabaseClient';

export default function KawanLamaTab({ isDarkMode, currentUser, isBranchMode }) {
  const [activeSubTab, setActiveSubTab] = useState(isBranchMode ? 'order_baru' : 'master');
  const [branchName, setBranchName] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isBranchMode && currentUser?.branch_id) {
      fetchBranchName();
    }
  }, [currentUser, isBranchMode]);

  const fetchBranchName = async () => {
    const { data } = await supabase
      .from('kl_branches')
      .select('branch_name')
      .eq('id', currentUser.branch_id)
      .maybeSingle();
    if (data) {
      setBranchName(data.branch_name);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Khusus Cabang dengan Nama Cabang Dinamis */}
      {isBranchMode && (
        <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-stone-200/80 text-stone-800'}`}>
          <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
            Portal Resmi Kantor Cabang
          </span>
          <h2 className="text-lg font-black tracking-wide uppercase mt-2 text-indigo-600 dark:text-indigo-400">
            FORM CABANG: {branchName || currentUser?.branch_name || 'KANTOR CABANG'}
          </h2>
          <p className="text-xs opacity-70 mt-0.5">Sistem Terpadu Portal Logistik & Pengadaan Kawan Lama</p>
        </div>
      )}

      {/* Tab Navigasi Admin / Cabang dengan Kontras Warna yang Jelas */}
      <div className="flex gap-2.5 border-b border-stone-200 dark:border-neutral-800 pb-3 overflow-x-auto">
        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveSubTab('master')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                activeSubTab === 'master' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              📦 Master Data
            </button>
            <button 
              onClick={() => setActiveSubTab('promo')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                activeSubTab === 'promo' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              📢 Kelola & Share Promo
            </button>
            <button 
              onClick={() => setActiveSubTab('monitoring')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                activeSubTab === 'monitoring' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              📊 Status Cabang (Submit / Belum)
            </button>
            <button 
              onClick={() => setActiveSubTab('approval')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                activeSubTab === 'approval' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              🔒 Approval & Grouping Order
            </button>
          </>
        )}
        {isBranchMode && (
          <>
            <button 
              onClick={() => setActiveSubTab('order_baru')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                activeSubTab === 'order_baru' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              ➕ Order Baru
            </button>
            <button 
              onClick={() => setActiveSubTab('riwayat')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                activeSubTab === 'riwayat' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
              }`}
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