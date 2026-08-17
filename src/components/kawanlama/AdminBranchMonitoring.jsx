import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminBranchMonitoring({ isDarkMode }) {
  // === SIMULASI ROLE ===
  const [adminRole, setAdminRole] = useState('PUSAT'); // Pilihan: PUSAT, CIKOKOL, PASMING

  const [branchStatus, setBranchStatus] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('belum'); 
  const [reminderHours, setReminderHours] = useState(24);
  const [customMessage, setCustomMessage] = useState('Mohon segera melakukan input dan submit order promosi melalui portal Kawan Lama.');
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [activePromoId, setActivePromoId] = useState(null);

  // State untuk Pencarian (Search)
  const [searchQuery, setSearchQuery] = useState('');

  // State untuk checkbox pilihan massal
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  
  // State untuk menyimpan ID cabang yang disembunyikan sementara dari layar
  const [hiddenBranchIds, setHiddenBranchIds] = useState([]);

  useEffect(() => {
    fetchBranchStatus();
  }, []);

  // Setiap kali tab filter atau role berubah, reset pilihan checkbox
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
      .select('*');

    if (branchError) {
      setDbError(`Error DB kl_branches: ${branchError.message}`);
      setIsLoading(false);
      return;
    }

    let query = supabase.from('kl_orders').select('*');
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
    // 1. Sembunyikan cabang jika ID-nya ada di dalam daftar hiddenBranchIds
    if (hiddenBranchIds.includes(b.id)) return false;

    // 2. Filter berdasarkan Pencarian (Search)
    const matchSearch = b.branch_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    // 3. Filter berdasarkan Role
    if (adminRole === 'PUSAT') {
      return b.region === 'PUSAT' || b.is_delegated === true;
    } else {
      return b.region === adminRole && b.is_delegated === false;
    }
  });

  const unsubmittedList = displayedBranches.filter(b => b.status === 'BELUM SUBMIT');
  const submittedList = displayedBranches.filter(b => b.status !== 'BELUM SUBMIT');
  const currentList = activeTabFilter === 'belum' ? unsubmittedList : submittedList;

  // Toggle checkbox satuan
  const handleToggleSelect = (branchId) => {
    if (selectedBranchIds.includes(branchId)) {
      setSelectedBranchIds(selectedBranchIds.filter(id => id !== branchId));
    } else {
      setSelectedBranchIds([...selectedBranchIds, branchId]);
    }
  };

  // Toggle select all di tab yang sedang aktif
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = currentList.map(b => b.id);
      setSelectedBranchIds(allIds);
    } else {
      setSelectedBranchIds([]);
    }
  };

  // Eksekusi Sembunyikan Massal (HANYA DARI TAMPILAN LAYAR, DATABASE AMAN)
  const handleHideSelected = () => {
    if (selectedBranchIds.length === 0) {
      alert("Silakan centang minimal 1 toko yang ingin disembunyikan.");
      return;
    }
    setHiddenBranchIds(prev => [...prev, ...selectedBranchIds]);
    setSelectedBranchIds([]); // Kosongkan pilihan setelah disembunyikan
  };

  // Eksekusi Tampilkan Kembali Semua yang Disembunyikan
  const handleShowAllHidden = () => {
    setHiddenBranchIds([]);
  };

  const handleDelegateToPusat = async (branch) => {
    if (!activePromoId) {
      alert("Tidak ada promo aktif, tidak bisa melempar tugas.");
      return;
    }
    
    const confirmThrow = window.confirm(`Apakah Anda yakin ingin melempar ${branch.branch_name} ke Pusat? Toko ini akan hilang dari daftar Anda untuk sesi ini.`);
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
    const text = encodeURIComponent(`Halo ${branch.branch_name} (Batas Waktu: ${reminderHours} Jam),\n\n${customMessage}\n\nTerima kasih.`);
    window.open(`https://wa.me/${branch.phone}?text=${text}`, '_blank');
  };

  const sendEmailReminder = (branch) => {
    const subject = encodeURIComponent(`REMINDER: Submit Order Kawan Lama (Deadline ${reminderHours} Jam)`);
    const body = encodeURIComponent(`Halo ${branch.branch_name},\n\n${customMessage}\n\nMohon segera diselesaikan.\n\nTerima kasih.`);
    window.open(`mailto:${branch.email}?subject=${subject}&body=${body}`);
  };

  return (
    <div className="space-y-6">
      
      <div className={`p-4 rounded-3xl border shadow-sm flex items-center justify-between ${isDarkMode ? 'bg-indigo-900/30 border-indigo-700 text-indigo-200' : 'bg-indigo-50 border-indigo-200 text-indigo-800'}`}>
        <div className="font-bold text-sm flex items-center gap-2">
          <span>🎭 Simulasi Login Sebagai:</span>
        </div>
        <select 
          value={adminRole} 
          onChange={(e) => setAdminRole(e.target.value)}
          className={`p-2 rounded-xl text-sm font-bold border focus:outline-none ${isDarkMode ? 'bg-indigo-950 border-indigo-700' : 'bg-white border-indigo-300'}`}
        >
          <option value="PUSAT">👑 Admin Pusat (DM)</option>
          <option value="CIKOKOL">📍 Admin Sub Cikokol</option>
          <option value="PASMING">📍 Admin Sub Pasming</option>
        </select>
      </div>

      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400">⚙️ Pengaturan Reminder</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
          <div>
            <label className="block font-bold mb-1.5 opacity-80 text-xs">Batas Waktu (Jam)</label>
            <input type="number" value={reminderHours} onChange={e => setReminderHours(Number(e.target.value))} className={`w-full p-3 border rounded-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-indigo-400' : 'bg-slate-50 border-slate-300 text-indigo-600'}`} />
          </div>
          <div>
            <label className="block font-bold mb-1.5 opacity-80 text-xs">Isi Pesan Custom</label>
            <input type="text" value={customMessage} onChange={e => setCustomMessage(e.target.value)} className={`w-full p-3 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-700'}`} />
          </div>
        </div>
      </div>

      <div className={`rounded-3xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <div className="p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-200 dark:border-neutral-700">
          
          {/* Judul & Tombol Show Hidden */}
          <div className="flex flex-col">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
              📊 Tugas Follow-Up <span className="text-slate-400 font-medium">({displayedBranches.length} TOKO)</span>
            </h3>
            {hiddenBranchIds.length > 0 && (
              <button onClick={handleShowAllHidden} className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 text-left hover:underline">
                👀 Tampilkan kembali {hiddenBranchIds.length} toko yang disembunyikan
              </button>
            )}
          </div>
          
          {/* Filter, Search & Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-start sm:items-center">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50 text-sm">🔍</span>
              <input 
                type="text"
                placeholder="Cari nama cabang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all ${
                  isDarkMode ? 'bg-neutral-900 border-neutral-600 text-white placeholder-neutral-500' : 'bg-white border-slate-300 text-slate-800'
                }`}
              />
            </div>

            {/* Tab Filter & Action Buttons */}
            <div className="flex gap-2 w-full sm:w-auto flex-wrap items-center">
              <button onClick={() => setActiveTabFilter('belum')} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'belum' ? 'bg-red-50 border-red-200 text-red-700 shadow-sm dark:bg-red-900/40 dark:border-red-800 dark:text-red-300' : isDarkMode ? 'bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-700' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}>⏳ Belum ({unsubmittedList.length})</button>
              <button onClick={() => setActiveTabFilter('sudah')} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'sudah' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300' : isDarkMode ? 'bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-700' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}>✅ Sudah ({submittedList.length})</button>
              
              {/* Tombol Blast WA Massal */}
              {activeTabFilter === 'belum' && unsubmittedList.length > 0 && (
                <button 
                  onClick={() => {
                    if(window.confirm(`Yakin ingin mengirim Blast WA ke ${unsubmittedList.length} toko yang belum submit?`)) {
                      unsubmittedList.forEach((b, index) => {
                        setTimeout(() => {
                          const text = encodeURIComponent(`Halo ${b.branch_name} (Batas Waktu: ${reminderHours} Jam),\n\n${customMessage}\n\nTerima kasih.`);
                          window.open(`https://wa.me/${b.phone}?text=${text}`, '_blank');
                        }, index * 1000);
                      });
                    }
                  }}
                  className="px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  🚀 Blast WA ({unsubmittedList.length})
                </button>
              )}

              {/* Tombol Sembunyikan Massal (Aman) */}
              {selectedBranchIds.length > 0 && (
                <button 
                  onClick={handleHideSelected}
                  className="px-4 py-2.5 bg-stone-600 hover:bg-stone-700 dark:bg-neutral-600 dark:hover:bg-neutral-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap"
                >
                  👁️‍🗨️ Sembunyikan ({selectedBranchIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* --- BAGIAN SCROLL & STICKY HEADER --- */}
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] w-full custom-scrollbar">
          <table className="w-full text-sm text-left relative">
            <thead className={`text-xs uppercase tracking-wider font-extrabold sticky top-0 z-10 shadow-sm ${isDarkMode ? 'bg-neutral-900 text-neutral-400' : 'bg-slate-50 text-slate-500'}`}>
              <tr>
                <th className="px-4 py-4 rounded-tl-3xl w-12 text-center">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={currentList.length > 0 && selectedBranchIds.length === currentList.length}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">Nama Cabang</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center rounded-tr-3xl">Aksi / Reminder</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700' : 'divide-slate-100'}`}>
              {isLoading ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center font-bold animate-pulse">Memuat data...</td></tr>
              ) : currentList.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">
                    {searchQuery ? `Tidak ada cabang bernama "${searchQuery}".` : 'Tidak ada toko di daftar ini.'}
                  </td>
                </tr>
              ) : (
                currentList.map(b => (
                  <tr key={b.id} className={`group transition-colors ${isDarkMode ? 'hover:bg-neutral-700/40' : 'hover:bg-slate-50/70'}`}>
                    
                    <td className="px-4 py-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedBranchIds.includes(b.id)}
                        onChange={() => handleToggleSelect(b.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    <td className="px-6 py-4 font-bold text-xs sm:text-sm uppercase whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span>{b.branch_name}</span>
                        {adminRole === 'PUSAT' && b.is_delegated && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 w-fit px-2 py-0.5 rounded-md border border-orange-200">
                            🚨 Titipan dari {b.region}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1.5 rounded-md text-[10px] font-black uppercase whitespace-nowrap border ${b.status !== 'BELUM SUBMIT' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
                        {b.status}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {b.status === 'BELUM SUBMIT' ? (
                          <>
                            <button onClick={() => sendWhatsAppReminder(b)} className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg font-bold text-xs hover:bg-[#20bd5a] shadow-sm">💬 WA</button>
                            <button onClick={() => sendEmailReminder(b)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 shadow-sm">✉️ Email</button>
                            
                            {adminRole !== 'PUSAT' && (
                              <button 
                                onClick={() => handleDelegateToPusat(b)} 
                                className="px-3 py-1.5 bg-slate-800 text-slate-100 dark:bg-neutral-700 dark:text-neutral-300 rounded-lg font-bold text-xs hover:bg-orange-600 hover:text-white transition-colors shadow-sm flex items-center gap-1"
                                title="Keteteran? Lempar follow-up toko ini ke Pusat"
                              >
                                🏳️ Lempar Pusat
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-emerald-500 font-bold text-xs">✅ Selesai</span>
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