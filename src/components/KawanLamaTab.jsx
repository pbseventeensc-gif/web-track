import React, { useState, useEffect } from 'react';
import { Database, Megaphone, Lock, BarChart3, Tag, Utensils, PlusCircle, Truck } from 'lucide-react';
import BranchOrderForm from './kawanlama/BranchOrderForm';
import BranchOrderHistory from './kawanlama/BranchOrderHistory';
import AdminApprovalPanel from './kawanlama/AdminApprovalPanel';
import AdminMasterData from './kawanlama/AdminMasterData';
import AdminPromoManager from './kawanlama/AdminPromoManager';
import AdminBranchMonitoring from './kawanlama/AdminBranchMonitoring';
import KawanLamaMultiLabelGenerator from './kawanlama/KawanLamaMultiLabelGenerator';
import FoodLabelTab from './kawanlama/FoodLabelTab';
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
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Portal Resmi Kantor Cabang
                </span>
                <h2 className={`text-lg font-black tracking-wide uppercase mt-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  FORM CABANG: {branchName || currentUser?.branch_name || 'KANTOR CABANG'}
                </h2>
                <p className={`text-xs font-medium mt-0.5 ${isDarkMode ? 'text-neutral-300' : 'text-slate-600'}`}>Sistem Terpadu Portal Logistik & Pengadaan Kawan Lama</p>
              </div>

              {/* Tombol Order Baru, Tracking Order, & Ganti PIN Berderet dalam Satu Baris di Header Cabang */}
              <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-stone-200 dark:border-neutral-700">
                <div className="flex gap-2.5 items-center">
                  <button 
                    onClick={() => setActiveSubTab('order_baru')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      activeSubTab === 'order_baru' 
                        ? (isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700 font-extrabold' : 'bg-white text-indigo-600 border border-indigo-200 shadow-2xs font-extrabold')
                        : isDarkMode ? 'bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-neutral-800' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> New Order
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('riwayat')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      activeSubTab === 'riwayat' 
                        ? (isDarkMode ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700 font-extrabold' : 'bg-white text-indigo-600 border border-indigo-200 shadow-2xs font-extrabold')
                        : isDarkMode ? 'bg-neutral-900 text-neutral-300 border border-neutral-700 hover:bg-neutral-800' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" /> Order Tracking
                  </button>
                </div>

                <button 
                  onClick={() => setIsPinModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-amber-500 dark:text-slate-950 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" /> Change PIN
                </button>
              </div>
            </div>
          )}

          {/* Header Info Khusus Admin */}
          {isAdmin && (
            <div className={`p-4 rounded-2xl border shadow-xs flex justify-between items-center ${
              isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {currentUser?.role === 'admin_wilayah' ? `Regional Coordinator (${currentUser?.region?.toUpperCase()})` : 'Kawan Lama Central Admin'}
                </span>
                <h3 className={`text-xs font-semibold mt-1 ${isDarkMode ? 'text-neutral-200' : 'text-slate-700'}`}>
                  Promo Management, Order Approval, Branch Monitoring, & Label Generator
                </h3>
              </div>
              <span className={`text-xs font-mono font-medium ${isDarkMode ? 'text-neutral-300' : 'text-slate-700'}`}>User: {currentUser?.username || 'Admin'}</span>
            </div>
          )}

          {/* Tab Navigasi Sub-Menu khusus Admin */}
          {isAdmin && (
            <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-1">
              {[
                { id: 'master', label: 'Master Data', icon: Database },
                { id: 'promo', label: 'Manage Promo', icon: Megaphone },
                { id: 'approval', label: 'Approval & Grouping Order', icon: Lock },
                { id: 'monitoring', label: 'Branch Submission Status', icon: BarChart3 },
                { id: 'labels', label: 'Multi-Label Generator', icon: Tag },
                { id: 'food_labels', label: 'Label Food & Delivery Order', icon: null }
              ].map(subItem => {
                const isActive = activeSubTab === subItem.id;
                const SubIcon = subItem.icon;
                return (
                  <button
                    key={subItem.id}
                    onClick={() => setActiveSubTab(subItem.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? (isDarkMode ? 'bg-blue-950/70 text-blue-400 border border-blue-800 font-semibold' : 'bg-[#ebf3fe] text-[#2563eb] border border-[#d2e3fc] font-semibold shadow-xs')
                        : (isDarkMode ? 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 font-medium' : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-100/80 font-medium')
                    }`}
                  >
                    {SubIcon && <SubIcon className={`w-3.5 h-3.5 ${isActive ? (isDarkMode ? 'text-blue-400' : 'text-[#2563eb]') : 'text-slate-500 dark:text-neutral-400'}`} />}
                    <span>{subItem.label}</span>
                  </button>
                );
              })}
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
        {/* ⭐ ROUTING TAB FOOD LABEL */}
        {isAdmin && activeSubTab === 'food_labels' && (
          <FoodLabelTab isDarkMode={isDarkMode} />
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