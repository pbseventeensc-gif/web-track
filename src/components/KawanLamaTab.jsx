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

  // Deteksi peran admin (admin pusat, admin wilayah pasming/cikokol)
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
      alert("PIN lama yang Anda masukkan tidak sesuai.");
      return;
    }

    const res = await updateBranchPin(currentBranchId, newPin);
    if (res.success) {
      alert("PIN berhasil diperbarui. Silakan gunakan PIN baru untuk sesi masuk berikutnya.");
      setIsPinModalOpen(false);
    } else {
      alert("Gagal memperbarui PIN: " + res.error);
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
            <div className={`p-6 rounded-3xl border shadow-2xs space-y-4 ${
              isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-stone-200/80 text-stone-800'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-neutral-300' : 'text-slate-600'}`}>
                  Portal Resmi Kantor Cabang
                </span>
                <h2 className={`text-lg font-extrabold tracking-wide uppercase mt-1 ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  FORMULIR CABANG: {branchName || currentUser?.branch_name || 'KANTOR CABANG'}
                </h2>
                <p className={`text-xs font-medium mt-0.5 ${isDarkMode ? 'text-neutral-300' : 'text-slate-600'}`}>
                  Sistem Terpadu Portal Logistik & Pengadaan Kawan Lama
                </p>
              </div>

              {/* Tombol Pesanan Baru, Riwayat Pesanan, & Ubah PIN */}
              <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-stone-200/80 dark:border-neutral-700">
                <div className="flex gap-2.5 items-center">
                  <button 
                    onClick={() => setActiveSubTab('order_baru')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      activeSubTab === 'order_baru' 
                        ? 'bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 font-bold shadow-2xs'
                        : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Buat Pesanan Baru
                  </button>
                  <button 
                    onClick={() => setActiveSubTab('riwayat')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      activeSubTab === 'riwayat' 
                        ? 'bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 font-bold shadow-2xs'
                        : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" /> Pelacakan & Riwayat Pesanan
                  </button>
                </div>

                <button 
                  onClick={() => setIsPinModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
                >
                  <Lock className="w-3.5 h-3.5" /> Ubah PIN Akses
                </button>
              </div>
            </div>
          )}

          {/* Header Info Khusus Admin */}
          {isAdmin && (
            <div className={`p-4 rounded-2xl border shadow-2xs flex justify-between items-center ${
              isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-white' : 'bg-white border-slate-200/80 text-slate-900'
            }`}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                  {currentUser?.role === 'admin_wilayah' ? `Koordinator Wilayah (${currentUser?.region?.toUpperCase()})` : 'Administrasi Pusat Kawan Lama'}
                </span>
                <h3 className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-neutral-300' : 'text-slate-600'}`}>
                  Manajemen Program Promosi, Persetujuan Pesanan, Pemantauan Cabang, & Pencetakan Label
                </h3>
              </div>
              <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-slate-100/80 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:text-slate-200 dark:border-neutral-700">
                Pengguna: {currentUser?.username || 'Admin'}
              </span>
            </div>
          )}

          {/* Tab Navigasi Sub-Menu khusus Admin */}
          {isAdmin && (
            <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-1">
              {[
                { id: 'master', label: 'Data Master', icon: Database },
                { id: 'promo', label: 'Kelola Program Promosi', icon: Megaphone },
                { id: 'approval', label: 'Persetujuan & Pengelompokan Pesanan', icon: Lock },
                { id: 'monitoring', label: 'Status Pengajuan Cabang', icon: BarChart3 },
                { id: 'labels', label: 'Cetak Label Massal', icon: Tag },
                { id: 'food_labels', label: 'Label Makanan & Surat Jalan', icon: Utensils }
              ].map(subItem => {
                const isActive = activeSubTab === subItem.id;
                const SubIcon = subItem.icon;
                return (
                  <button
                    key={subItem.id}
                    onClick={() => setActiveSubTab(subItem.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs'
                        : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 font-medium'
                    }`}
                  >
                    {SubIcon && <SubIcon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-neutral-400'}`} />}
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
        title="Ubah PIN Mandiri"
        subtitle="Masukkan PIN lama Anda untuk verifikasi, kemudian masukkan 6 digit PIN baru."
        isDarkMode={isDarkMode}
        requireOldPin={true}
      />
    </div>
  );
}