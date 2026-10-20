import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Bell,
  Send,
  Search,
  Check,
  Mail,
  EyeOff,
  Eye,
  ShieldCheck,
  Globe,
  Share2
} from 'lucide-react';
import CustomDropdown from '../ui/CustomDropdown';

export default function AdminBranchMonitoring({ isDarkMode }) {
  // Pilihan: NASIONAL (Semua 103 Cabang), PUSAT (Khusus Pusat), CIKOKOL, PASMING
  const [adminRole, setAdminRole] = useState('NASIONAL'); 

  const [branchStatus, setBranchStatus] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('belum'); 
  const [reminderHours, setReminderHours] = useState(24);
  const [customMessage, setCustomMessage] = useState('Mohon segera menyelesaikan pengajuan pesanan program promosi melalui portal resmi Kawan Lama.');
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [activePromoId, setActivePromoId] = useState(null);

  // State Pencarian
  const [searchQuery, setSearchQuery] = useState('');

  // State Pilihan Massal
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  
  // State Menyembunyikan Cabang dari Layar
  const [hiddenBranchIds, setHiddenBranchIds] = useState([]);

  useEffect(() => {
    fetchBranchStatus();
  }, []);

  useEffect(() => {
    setSelectedBranchIds([]);
  }, [activeTabFilter, adminRole]);

  const fetchBranchStatus = async () => {
    setIsLoading(true);
    setDbError(null);
    
    const { data: activePromo } = await supabase
      .from('kl_promos')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    if (activePromo) setActivePromoId(activePromo.id);

    const { data: branches, error: branchError } = await supabase
      .from('kl_branches')
      .select('id, branch_id, branch_name, name, nama_cabang, region, phone, whatsapp, email')
      .order('id', { ascending: true });

    if (branchError) {
      setDbError(`Kendala Basis Data kl_branches: ${branchError.message}`);
      setIsLoading(false);
      return;
    }

    let query = supabase.from('kl_orders').select('id, branch_id, status, lock_status, is_delegated_to_pusat');
    if (activePromo) {
      query = query.eq('promo_id', activePromo.id);
    }
    const { data: orders } = await query;

    const mappedData = (branches || []).map(branch => {
      const matchedOrder = (orders || []).find(o => 
        String(o.branch_id) === String(branch.id) || 
        String(o.branch_id) === String(branch.branch_id)
      );

      let statusText = 'BELUM SUBMIT';
      if (matchedOrder) {
        if (matchedOrder.status === 'APPROVED' || matchedOrder.status === 'approved' || matchedOrder.lock_status === 'LOCKED') {
          statusText = 'SUDAH SUBMIT & APPROVED';
        } else if (matchedOrder.status === 'SUBMITTED') {
          statusText = 'SUDAH SUBMIT';
        }
      }

      const storeName = branch.branch_name || branch.name || branch.nama_cabang || `CABANG ID: ${branch.id}`;
      const region = branch.region || 'PUSAT'; 
      const isDelegated = matchedOrder?.is_delegated_to_pusat || false;

      return {
        id: branch.id,
        order_id: matchedOrder?.id || null, 
        branch_name: storeName,
        region: region.toUpperCase(),
        phone: branch.phone || branch.whatsapp || '628123456789',
        email: branch.email || 'cabang@email.com',
        status: statusText,
        is_delegated: isDelegated
      };
    });

    setBranchStatus(mappedData);
    setIsLoading(false);
  };

  const displayedBranches = branchStatus.filter(b => {
    if (hiddenBranchIds.includes(b.id)) return false;

    const matchSearch = b.branch_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    if (adminRole === 'NASIONAL') {
      return true;
    } else if (adminRole === 'PUSAT') {
      return b.region === 'PUSAT' || b.is_delegated === true;
    } else {
      return b.region === adminRole && b.is_delegated === false;
    }
  });

  const unsubmittedList = displayedBranches.filter(b => b.status === 'BELUM SUBMIT');
  const submittedList = displayedBranches.filter(b => b.status !== 'BELUM SUBMIT');
  const currentList = activeTabFilter === 'belum' ? unsubmittedList : submittedList;

  const handleToggleSelect = (branchId) => {
    if (selectedBranchIds.includes(branchId)) {
      setSelectedBranchIds(selectedBranchIds.filter(id => id !== branchId));
    } else {
      setSelectedBranchIds([...selectedBranchIds, branchId]);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = currentList.map(b => b.id);
      setSelectedBranchIds(allIds);
    } else {
      setSelectedBranchIds([]);
    }
  };

  const handleHideSelected = () => {
    if (selectedBranchIds.length === 0) {
      alert("Silakan pilih minimal 1 cabang yang ingin disembunyikan.");
      return;
    }
    setHiddenBranchIds(prev => [...prev, ...selectedBranchIds]);
    setSelectedBranchIds([]);
  };

  const handleShowAllHidden = () => {
    setHiddenBranchIds([]);
  };

  const handleDelegateToPusat = async (branch) => {
    if (!activePromoId) {
      alert("Tidak ada program promosi aktif saat ini, tidak dapat mengalihkan tindak lanjut cabang.");
      return;
    }
    
    const confirmThrow = window.confirm(`Apakah Anda yakin ingin mengalihkan tindak lanjut cabang ${branch.branch_name} ke Koordinator Pusat? Cabang ini akan dipindahkan dari daftar wilayah Anda pada sesi ini.`);
    if (!confirmThrow) return;

    if (!branch.order_id) {
      await supabase.from('kl_orders').insert({
        branch_id: branch.id,
        promo_id: activePromoId,
        status: 'BELUM SUBMIT',
        is_delegated_to_pusat: true
      });
    } else {
      await supabase.from('kl_orders').update({
        is_delegated_to_pusat: true
      }).eq('id', branch.order_id);
    }
    
    fetchBranchStatus();
  };

  const sendWhatsAppReminder = (branch) => {
    const text = encodeURIComponent(`Yth. Tim ${branch.branch_name} (Batas Waktu: ${reminderHours} Jam),\n\n${customMessage}\n\nTerima kasih atas kerja samanya.`);
    window.open(`https://wa.me/${branch.phone}?text=${text}`, '_blank');
  };

  const sendEmailReminder = (branch) => {
    const subject = encodeURIComponent(`PENGINGAT: Pengajuan Pesanan Kawan Lama (Batas Waktu ${reminderHours} Jam)`);
    const body = encodeURIComponent(`Yth. Tim ${branch.branch_name},\n\n${customMessage}\n\nMohon agar dapat segera diselesaikan.\n\nTerima kasih.`);
    window.open(`mailto:${branch.email}?subject=${subject}&body=${body}`);
  };

  return (
    <div className={`space-y-6 p-6 rounded-3xl border shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>
      
      {dbError && (
        <div className="p-4 rounded-2xl bg-rose-50/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 text-xs font-semibold">
          {dbError}
        </div>
      )}

      {/* Pemilih Zona Wilayah */}
      <div className={`p-4 rounded-2xl border shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700' : 'bg-slate-50/80 border-slate-200/80'}`}>
        <div className="font-bold text-xs sm:text-sm flex items-center gap-2 text-slate-800 dark:text-white">
          <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Filter Zona Wilayah:
        </div>
        <CustomDropdown 
          value={adminRole} 
          onChange={(e) => setAdminRole(e.target.value)}
          className="w-full sm:w-auto min-w-[280px]"
        >
          <option value="NASIONAL">Zona Nasional (Seluruh 103 Cabang)</option>
          <option value="PUSAT">Zona Pusat (Koordinator Pusat)</option>
          <option value="CIKOKOL">Sub-Zona Wilayah Cikokol</option>
          <option value="PASMING">Sub-Zona Wilayah Pasar Minggu</option>
        </CustomDropdown>
      </div>

      {/* Pengaturan Pesan Pengingat */}
      <div className={`p-6 rounded-2xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700' : 'bg-white border-slate-200/90'}`}>
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Pengaturan Pesan Pengingat Cabang
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div>
            <label className="block font-semibold mb-1.5 text-slate-700 dark:text-neutral-300">Batas Waktu Penyelesaian (Jam)</label>
            <input 
              type="number" 
              value={reminderHours} 
              onChange={e => setReminderHours(Number(e.target.value))} 
              className={`w-full p-2.5 border rounded-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`} 
            />
          </div>
          <div>
            <label className="block font-semibold mb-1.5 text-slate-700 dark:text-neutral-300">Isi Pesan Pengingat</label>
            <input 
              type="text" 
              value={customMessage} 
              onChange={e => setCustomMessage(e.target.value)} 
              className={`w-full p-2.5 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`} 
            />
          </div>
        </div>
      </div>

      {/* Tabel Tugas Tindak Lanjut Cabang */}
      <div className={`rounded-2xl border shadow-2xs flex flex-col overflow-hidden ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200/90'}`}>
        <div className={`p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b ${isDarkMode ? 'border-neutral-800' : 'border-slate-200/80'}`}>
          
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-sm uppercase tracking-wide text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Daftar Tindak Lanjut Cabang <span className="text-slate-500 dark:text-neutral-400 font-semibold">({displayedBranches.length} Cabang)</span>
            </h3>
            {hiddenBranchIds.length > 0 && (
              <button 
                onClick={handleShowAllHidden} 
                className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5 text-left hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3 h-3" /> Tampilkan kembali {hiddenBranchIds.length} cabang yang disembunyikan
              </button>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-start sm:items-center">
            
            {/* Input Pencarian */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Cari nama cabang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-2xs ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white placeholder-neutral-500' : 'bg-white border-slate-200/90 text-slate-900 placeholder-slate-400'}`}
              />
            </div>

            {/* Filter Tab & Tombol Tindakan */}
            <div className="flex gap-2 w-full sm:w-auto flex-wrap items-center">
              <button 
                onClick={() => setActiveTabFilter('belum')} 
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTabFilter === 'belum' 
                    ? 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 shadow-2xs' 
                    : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                }`}
              >
                Belum Mengajukan ({unsubmittedList.length})
              </button>
              <button 
                onClick={() => setActiveTabFilter('sudah')} 
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTabFilter === 'sudah' 
                    ? 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs' 
                    : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                }`}
              >
                Sudah Mengajukan ({submittedList.length})
              </button>
              
              {/* Tombol Kirim Pengingat WhatsApp Massal */}
              {activeTabFilter === 'belum' && unsubmittedList.length > 0 && (
                <button 
                  onClick={() => {
                    if(window.confirm(`Apakah Anda yakin ingin mengirim pesan pengingat WhatsApp ke ${unsubmittedList.length} cabang yang belum mengajukan pesanan?`)) {
                      unsubmittedList.forEach((b, index) => {
                        setTimeout(() => {
                          const text = encodeURIComponent(`Yth. Tim ${b.branch_name} (Batas Waktu: ${reminderHours} Jam),\n\n${customMessage}\n\nTerima kasih.`);
                          window.open(`https://wa.me/${b.phone}?text=${text}`, '_blank');
                        }, index * 1000);
                      });
                    }
                  }}
                  className="px-4 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Kirim WA Massal ({unsubmittedList.length})
                </button>
              )}

              {/* Tombol Sembunyikan Terpilih */}
              {selectedBranchIds.length > 0 && (
                <button 
                  onClick={handleHideSelected}
                  className="px-4 py-2 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Sembunyikan Terpilih ({selectedBranchIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabel Data Cabang */}
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] w-full custom-scrollbar">
          <table className="w-full text-xs text-left relative border-collapse">
            <thead className={`border-b font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-400' : 'bg-slate-50/95 border-slate-200/80 text-slate-500'}`}>
              <tr>
                <th className="px-4 py-3.5 w-12 text-center">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={currentList.length > 0 && selectedBranchIds.length === currentList.length}
                    className="rounded border-slate-300 accent-indigo-600 cursor-pointer w-4 h-4"
                  />
                </th>
                <th className="px-6 py-3.5">NAMA CABANG / TOKO</th>
                <th className="px-6 py-3.5 text-center">STATUS PENGAJUAN</th>
                <th className="px-6 py-3.5 text-center">TINDAKAN PENGINGAT</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-slate-100'}`}>
              {isLoading ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center font-semibold animate-pulse text-slate-400">Memuat data cabang...</td></tr>
              ) : currentList.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">
                    {searchQuery ? `Tidak ditemukan cabang dengan nama "${searchQuery}".` : 'Tidak ada data cabang pada daftar ini.'}
                  </td>
                </tr>
              ) : (
                currentList.map(b => (
                  <tr key={b.id} className={`transition-colors ${isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-slate-50/80'}`}>
                    
                    <td className="px-4 py-3.5 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedBranchIds.includes(b.id)}
                        onChange={() => handleToggleSelect(b.id)}
                        className="rounded border-slate-300 accent-indigo-600 cursor-pointer w-4 h-4"
                      />
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm uppercase">{b.branch_name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-500 dark:text-neutral-400 font-medium">
                            Zona Wilayah: {b.region}
                          </span>
                          {adminRole !== 'NASIONAL' && b.is_delegated && (
                            <span className="text-[10px] font-semibold bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 px-2 py-0.5 rounded-md inline-block">
                              Limpahan Wilayah
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
                        b.status !== 'BELUM SUBMIT'
                          ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                          : 'bg-amber-50/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${b.status !== 'BELUM SUBMIT' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {b.status !== 'BELUM SUBMIT' ? 'Sudah Mengajukan' : 'Belum Mengajukan'}
                      </span>
                    </td>

                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        {b.status === 'BELUM SUBMIT' ? (
                          <>
                            <button
                              onClick={() => sendWhatsAppReminder(b)}
                              title="Kirim Pengingat WhatsApp"
                              className="px-3 py-1.5 rounded-xl bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 flex items-center gap-1.5 font-semibold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" /> WhatsApp
                            </button>
                            <button
                              onClick={() => sendEmailReminder(b)}
                              title="Kirim Pengingat Surel"
                              className="px-3 py-1.5 rounded-xl bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 flex items-center gap-1.5 font-semibold text-xs transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" /> Surel
                            </button>

                            {adminRole !== 'NASIONAL' && adminRole !== 'PUSAT' && (
                              <button
                                onClick={() => handleDelegateToPusat(b)}
                                className="px-3 py-1.5 bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 rounded-xl font-semibold text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title="Alihkan tindak lanjut cabang ini ke Koordinator Pusat"
                              >
                                <Share2 className="w-3.5 h-3.5" /> Alihkan ke Pusat
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="px-3 py-1 rounded-xl bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold text-xs inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Tuntas
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}