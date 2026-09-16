import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Bell,
  Clock,
  Send,
  Search,
  Check,
  Mail,
  EyeOff,
  Layers,
  ShieldCheck,
  Globe,
  MapPin,
  Share2,
  X,
  SlidersHorizontal
} from 'lucide-react';

export default function AdminBranchMonitoring({ isDarkMode }) {
  // Pilihan: NASIONAL (Semua 103 Toko), PUSAT (Khusus Pusat), CIKOKOL, PASMING
  const [adminRole, setAdminRole] = useState('NASIONAL'); 

  const [branchStatus, setBranchStatus] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('belum'); 
  const [reminderHours, setReminderHours] = useState(24);
  const [customMessage, setCustomMessage] = useState('Please submit your promotion order immediately through the Kawan Lama portal.');
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [activePromoId, setActivePromoId] = useState(null);

  // State Pencarian (Search)
  const [searchQuery, setSearchQuery] = useState('');

  // State Checkbox Pilihan Massal
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
      .select('*')
      .order('id', { ascending: true });

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
    // 1. Sembunyikan jika ID-nya ada di daftar hide
    if (hiddenBranchIds.includes(b.id)) return false;

    // 2. Filter Pencarian (Search Bar)
    const matchSearch = b.branch_name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;

    // 3. Logika Filter Role & Wilayah
    if (adminRole === 'NASIONAL') {
      return true; // Menampilkan seluruh 103 cabang
    } else if (adminRole === 'PUSAT') {
      return b.region === 'PUSAT' || b.is_delegated === true; // Hanya cabang Pusat + titipan cabang luar
    } else {
      return b.region === adminRole && b.is_delegated === false; // Khusus Cikokol / Pasming
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
      alert("Silakan centang minimal 1 toko yang ingin disembunyikan.");
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
    <div className="space-y-6 bg-white p-6 rounded-3xl border border-slate-200 text-black shadow-xs">
      
      {/* Selector Role & Wilayah (Gambar 3: Zone Filter) */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white text-black shadow-2xs flex items-center justify-between">
        <div className="font-extrabold text-xs sm:text-sm flex items-center gap-2 text-black">
          <Globe className="w-4 h-4 text-indigo-600" /> Zone Filter:
        </div>
        <select 
          value={adminRole} 
          onChange={(e) => setAdminRole(e.target.value)}
          className="p-2.5 rounded-xl text-xs sm:text-sm font-extrabold border border-slate-300 bg-white text-black focus:outline-none cursor-pointer"
        >
          <option value="NASIONAL">National Zone (All 103 Stores)</option>
          <option value="PUSAT">Central Zone (DM)</option>
          <option value="CIKOKOL">Sub-Zone Cikokol</option>
          <option value="PASMING">Sub-Zone Pasming</option>
        </select>
      </div>

      {/* Pengaturan Reminder */}
      <div className="p-6 rounded-2xl border border-slate-200 bg-white text-black shadow-2xs space-y-4">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-indigo-600" /> REMINDER SETTINGS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
          <div>
            <label className="block font-bold mb-1.5 text-xs text-black">Time Limit (Hours)</label>
            <input type="number" value={reminderHours} onChange={e => setReminderHours(Number(e.target.value))} className="w-full p-2.5 border border-slate-300 rounded-xl font-extrabold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white text-black" />
          </div>
          <div>
            <label className="block font-bold mb-1.5 text-xs text-black">Custom Message</label>
            <input type="text" value={customMessage} onChange={e => setCustomMessage(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white text-black" />
          </div>
        </div>
      </div>

      {/* Tabel Tugas Follow-Up (Gambar 1: FOLLOW-UP TASKS) */}
      <div className="rounded-2xl border border-slate-200 bg-white text-black shadow-2xs flex flex-col">
        <div className="p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-200 bg-white">
          
          <div className="flex flex-col">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" /> FOLLOW-UP TASKS <span className="text-slate-500 font-bold">({displayedBranches.length} STORES)</span>
            </h3>
            {hiddenBranchIds.length > 0 && (
              <button onClick={handleShowAllHidden} className="text-[10px] text-amber-600 font-bold mt-1 text-left hover:underline">
                Restore {hiddenBranchIds.length} hidden stores
              </button>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-start sm:items-center">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search branch / store name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-black placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            {/* Tab Filter & Action Buttons */}
            <div className="flex gap-2 w-full sm:w-auto flex-wrap items-center">
              <button onClick={() => setActiveTabFilter('belum')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'belum' ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Drafts ({unsubmittedList.length})</button>
              <button onClick={() => setActiveTabFilter('sudah')} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'sudah' ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Submitted ({submittedList.length})</button>
              
              {/* Tombol Blast WA */}
              {activeTabFilter === 'belum' && unsubmittedList.length > 0 && (
                <button 
                  onClick={() => {
                    if(window.confirm(`Yakin ingin mengirim Blast WA ke ${unsubmittedList.length} toko yang belum submit?`)) {
                      unsubmittedList.forEach((b, index) => {
                        setTimeout(() => {
                          const text = encodeURIComponent(`Halo ${b.branch_name} (Deadline: ${reminderHours} Hours),\n\n${customMessage}\n\nThank you.`);
                          window.open(`https://wa.me/${b.phone}?text=${text}`, '_blank');
                        }, index * 1000);
                      });
                    }
                  }}
                  className="px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Blast WA ({unsubmittedList.length})
                </button>
              )}

              {/* Tombol Sembunyikan Massal */}
              {selectedBranchIds.length > 0 && (
                <button 
                  onClick={handleHideSelected}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Hide Selected ({selectedBranchIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabel Data Cabang (Gambar 2: REMINDER Header & Circle Buttons) */}
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] w-full custom-scrollbar bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <table className="w-full text-sm text-left relative border-collapse bg-white">
            <thead className="bg-[#F8FAFC] border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3.5 w-12 text-center">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={currentList.length > 0 && selectedBranchIds.length === currentList.length}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                  />
                </th>
                <th className="px-6 py-3.5">BRANCH / STORE NAME</th>
                <th className="px-6 py-3.5 text-center">STATUS</th>
                <th className="px-6 py-3.5 text-center">REMINDER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center font-bold animate-pulse text-slate-400">Memuat data...</td></tr>
              ) : currentList.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">
                    {searchQuery ? `Tidak ada cabang bernama "${searchQuery}".` : 'Tidak ada toko di daftar ini.'}
                  </td>
                </tr>
              ) : (
                currentList.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors bg-white">
                    
                    <td className="px-4 py-3.5 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedBranchIds.includes(b.id)}
                        onChange={() => handleToggleSelect(b.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                      />
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm uppercase">{b.branch_name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400 font-medium">
                            Zone: {b.region}
                          </span>
                          {adminRole !== 'NASIONAL' && b.is_delegated && (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200 inline-block">
                              Titipan
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                        b.status !== 'BELUM SUBMIT'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${b.status !== 'BELUM SUBMIT' ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                        {b.status !== 'BELUM SUBMIT' ? 'Submitted' : 'Draft'}
                      </span>
                    </td>

                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-center gap-2.5">
                        {b.status === 'BELUM SUBMIT' ? (
                          <>
                            <button
                              onClick={() => sendWhatsAppReminder(b)}
                              title="Send WhatsApp Reminder"
                              className="w-8 h-8 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => sendEmailReminder(b)}
                              title="Send Email Reminder"
                              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>

                            {adminRole !== 'NASIONAL' && adminRole !== 'PUSAT' && (
                              <button
                                onClick={() => handleDelegateToPusat(b)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer ml-1 active:scale-95"
                                title="Escalate follow-up for this store to Central HQ"
                              >
                                <Share2 className="w-3.5 h-3.5 text-amber-400" /> Escalate to HQ
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-emerald-700 font-extrabold text-xs inline-flex items-center gap-1">
                            <Check className="w-4 h-4 text-emerald-600" /> Completed
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