import React, { useState, useEffect } from 'react';
import BranchOrderForm from './kawanlama/BranchOrderForm';
import BranchOrderHistory from './kawanlama/BranchOrderHistory';
import AdminApprovalPanel from './kawanlama/AdminApprovalPanel';
import AdminMasterData from './kawanlama/AdminMasterData';
import AdminPromoManager from './kawanlama/AdminPromoManager';
import AdminBranchMonitoring from './kawanlama/AdminBranchMonitoring';
import KawanLamaMultiLabelGenerator from './kawanlama/KawanLamaMultiLabelGenerator';
import PinModal from './kawanlama/PinModal';
import { updateBranchPin } from './kawanlama/PinManager';
import { supabase } from '../supabaseClient';

export default function KawanLamaTab({ isDarkMode, currentUser, isBranchMode }) {
  const [activeSubTab, setActiveSubTab] = useState(isBranchMode ? 'order_baru' : 'master');
  const [branchName, setBranchName] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  const currentBranchId = currentUser?.branch_id || currentUser?.id;

  // Deteksi role admin (admin pusat, admin wilayah pasming/cikokol)
  const isAdmin = !isBranchMode && (
    currentUser?.role === 'admin' || 
    currentUser?.role === 'admin_pusat' || 
    currentUser?.role === 'admin_wilayah' || 
    Boolean(currentUser)
  );

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

  // Handler Ganti PIN Mandiri oleh Cabang
  const handleBranchChangePinSubmit = async ({ oldPin, newPin }) => {
    if (!currentBranchId) {
      alert("ID Cabang tidak valid.");
      return;
    }

    const { data: branchData, error: fetchErr } = await supabase
      .from('kl_branches')
      .select('pin_code')
      .eq('id', currentBranchId)
      .single();

    if (fetchErr || !branchData || String(branchData.pin_code) !== String(oldPin)) {
      alert("❌ PIN Lama yang Anda masukkan salah!");
      return;
    }

    const res = await updateBranchPin(currentBranchId, newPin);
    if (res.success) {
      alert("✅ PIN Berhasil diubah! Silakan gunakan PIN baru untuk sesi login berikutnya.");
      setIsPinModalOpen(false);
    } else {
      alert("❌ Gagal memperbarui PIN: " + res.error);
    }
  };

  return (
    <div className="relative">
      
      {/* === STICKY HEADER & TABS WRAPPER === */}
      <div className={`sticky top-0 z-50 pt-2 pb-4 mb-6 border-b backdrop-blur-xl transition-colors ${
        isDarkMode ? 'bg-neutral-900/95 border-neutral-800' : 'bg-stone-50/95 border-stone-200'
      }`}>
        
        <div className="space-y-4">
          {/* Header Info Khusus Cabang */}
          {isBranchMode && (
            <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
              isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-stone-200/80 text-stone-800'
            }`}>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                  Portal Resmi Kantor Cabang
                </span>
                <h2 className="text-lg font-black tracking-wide uppercase mt-2 text-indigo-600 dark:text-indigo-400">
                  FORM CABANG: {branchName || currentUser?.branch_name || 'KANTOR CABANG'}
                </h2>
                <p className="text-xs opacity-70 mt-0.5">Sistem Terpadu Portal Logistik & Pengadaan Kawan Lama</p>
              </div>

              {/* Tombol Order Baru, Tracking Order, & Ganti PIN Berderet dalam Satu Baris di Header Cabang */}
              <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-stone-200 dark:border-neutral-700">
                <div className="flex gap-2.5 items-center">
                  <button 
                    onClick={() => setActiveSubTab('order_baru')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                      activeSubTab === 'order_baru' 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : isDarkMode ? 'bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-neutral-800' : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'
                    }`}
                  >
                    ➕ Order Baru
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('riwayat')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                      activeSubTab === 'riwayat' 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : isDarkMode ? 'bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-neutral-800' : 'bg-stone-100 text-stone-700 border border-stone-200 hover:bg-stone-200'
                    }`}
                  >
                    🚚 Tracking Order
                  </button>
                </div>

                <button 
                  onClick={() => setIsPinModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-md bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shrink-0"
                >
                  🔒 Ganti PIN Mandiri
                </button>
              </div>
            </div>
          )}

          {/* Header Info Khusus Admin */}
          {isAdmin && (
            <div className={`p-4 rounded-2xl border shadow-sm flex justify-between items-center ${
              isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-white' : 'bg-white border-stone-200/80 text-stone-800'
            }`}>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white">
                  {currentUser?.role === 'admin_wilayah' ? `Admin Koordinator (${currentUser?.region?.toUpperCase()})` : 'Admin Pusat Kawan Lama'}
                </span>
                <h3 className="text-xs font-bold mt-1 text-stone-700 dark:text-neutral-200">
                  Pengelolaan Data Promo, Approval Order, Monitoring Cabang, & Multi-Label Generator
                </h3>
              </div>
              <span className="text-xs font-mono opacity-60">User: {currentUser?.username || 'Admin'}</span>
            </div>
          )}

          {/* Tab Navigasi Sub-Menu khusus Admin */}
          {isAdmin && (
            <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-1">
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
                📢 Kelola & Hapus Promo
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
                onClick={() => setActiveSubTab('labels')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm ${
                  activeSubTab === 'labels' 
                    ? 'bg-amber-600 text-white shadow-md' 
                    : isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700' : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                🏷️ Multi-Label Generator
              </button>
            </div>
          )}
        </div>
      </div>
      {/* === END OF STICKY WRAPPER === */}

      {/* Routing Konten Sub-Panel */}
      <div className="space-y-6">
        {isAdmin && activeSubTab === 'master' && (
          <AdminMasterData isDarkMode={isDarkMode} currentUser={currentUser} />
        )}
        {isAdmin && activeSubTab === 'promo' && (
          <AdminPromoManager isDarkMode={isDarkMode} currentUser={currentUser} />
        )}
        {isAdmin && activeSubTab === 'approval' && (
          <AdminApprovalPanel isDarkMode={isDarkMode} currentUser={currentUser} />
        )}
        {isAdmin && activeSubTab === 'monitoring' && (
          <AdminBranchMonitoring isDarkMode={isDarkMode} currentUser={currentUser} />
        )}
        {isAdmin && activeSubTab === 'labels' && (
          <KawanLamaMultiLabelGenerator isDarkMode={isDarkMode} />
        )}

        {isBranchMode && activeSubTab === 'order_baru' && (
          <BranchOrderForm isDarkMode={isDarkMode} currentUser={currentUser} isBranchMode={isBranchMode} />
        )}
        {isBranchMode && activeSubTab === 'riwayat' && (
          <BranchOrderHistory isDarkMode={isDarkMode} currentUser={currentUser} />
        )}
      </div>

      {/* Modal Ganti PIN Mandiri */}
      <PinModal 
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSubmit={handleBranchChangePinSubmit}
        title="Ganti PIN Mandiri"
        subtitle="Masukkan PIN lama Anda untuk verifikasi, lalu masukkan 6 digit PIN baru."
        isDarkMode={isDarkMode}
        requireOldPin={true}
      />
    </div>
  );
}