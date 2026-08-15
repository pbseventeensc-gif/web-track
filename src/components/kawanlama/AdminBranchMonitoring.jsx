import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminBranchMonitoring({ isDarkMode }) {
  const [branchStatus, setBranchStatus] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('belum'); 
  const [reminderHours, setReminderHours] = useState(24);
  const [customMessage, setCustomMessage] = useState('Mohon segera melakukan input dan submit order promosi melalui portal Kawan Lama.');
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    fetchBranchStatus();
  }, []);

  const fetchBranchStatus = async () => {
    setIsLoading(true);
    setDbError(null);
    
    // 1. Ambil Promo Aktif
    const { data: activePromo } = await supabase
      .from('kl_promos')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    // 2. Ambil data HANYA yang ada (mencegah error 400)
    const { data: branches, error: branchError } = await supabase
      .from('kl_branches')
      .select('*');

    if (branchError) {
      setDbError(`Error DB kl_branches: ${branchError.message}`);
      setIsLoading(false);
      return;
    }

    if (!branches || branches.length === 0) {
      setDbError(`Tabel kl_branches kosong atau terblokir RLS.`);
      setIsLoading(false);
      return;
    }

    // 3. Ambil data Order
    let query = supabase.from('kl_orders').select('*');
    if (activePromo) {
      query = query.eq('promo_id', activePromo.id);
    }
    const { data: orders } = await query;

    // 4. Petakan data
    const mappedData = (branches || []).map(branch => {
      const matchedOrder = (orders || []).find(o => 
        String(o.branch_id) === String(branch.id) || 
        String(o.branch_id) === String(branch.branch_id)
      );

      let statusText = 'BELUM SUBMIT';
      if (matchedOrder) {
        if (matchedOrder.status === 'APPROVED' || matchedOrder.status === 'approved' || matchedOrder.lock_status === 'LOCKED') {
          statusText = 'SUDAH SUBMIT & APPROVED';
        } else {
          statusText = 'SUDAH SUBMIT';
        }
      }

      const storeName = branch.branch_name || branch.name || branch.nama_cabang || `CABANG ID: ${branch.id}`;

      return {
        id: branch.id,
        branch_name: storeName,
        phone: branch.phone || branch.whatsapp || '628123456789', // Sesuaikan jika ada kolom aslinya
        email: branch.email || 'cabang@email.com',
        status: statusText
      };
    });

    setBranchStatus(mappedData);
    setIsLoading(false);
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

  const unsubmittedList = branchStatus.filter(b => b.status === 'BELUM SUBMIT');
  const submittedList = branchStatus.filter(b => b.status !== 'BELUM SUBMIT');

  return (
    <div className="space-y-6">
      {/* KOTAK PENGATURAN REMINDER */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
          ⚙️ Pengaturan Pengingat (Reminder)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
          <div>
            <label className="block font-bold mb-1.5 opacity-80 text-xs">Batas Waktu Reminder (Dalam Jam)</label>
            <input 
              type="number" 
              value={reminderHours} 
              onChange={e => setReminderHours(Number(e.target.value))} 
              className={`w-full p-3 border rounded-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-indigo-400' : 'bg-slate-50 border-slate-300 text-indigo-600'}`} 
            />
          </div>
          <div>
            <label className="block font-bold mb-1.5 opacity-80 text-xs">Isi Pesan Custom Pengingat</label>
            <input 
              type="text" 
              value={customMessage} 
              onChange={e => setCustomMessage(e.target.value)} 
              className={`w-full p-3 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-700'}`} 
            />
          </div>
        </div>
      </div>

      {/* KOTAK TABEL MONITORING */}
      <div className={`rounded-3xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        
        {/* HEADER TABEL & FILTER */}
        <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-neutral-700">
          <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            📊 Status Cabang <span className="text-slate-400 font-medium">({branchStatus.length} Total)</span>
          </h3>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => setActiveTabFilter('belum')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'belum' ? 'bg-red-50 border-red-200 text-red-700 shadow-sm dark:bg-red-900/40 dark:border-red-800 dark:text-red-300' : isDarkMode ? 'bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-700' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              ⏳ Belum ({unsubmittedList.length})
            </button>
            <button 
              onClick={() => setActiveTabFilter('sudah')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'sudah' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300' : isDarkMode ? 'bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-700' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              ✅ Sudah ({submittedList.length})
            </button>
          </div>
        </div>

        {dbError && (
          <div className="m-6 p-4 text-sm text-red-800 rounded-xl bg-red-100 border border-red-200 dark:bg-red-900/30 dark:text-red-400" role="alert">
            <span className="font-bold">⚠️ Error:</span> {dbError}
          </div>
        )}

        {/* BUNGKUSAN TABEL AGAR RAPI */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left">
            <thead className={`text-xs uppercase tracking-wider font-extrabold ${isDarkMode ? 'bg-neutral-900/50 text-neutral-400' : 'bg-slate-50 text-slate-500'}`}>
              <tr>
                <th className="px-6 py-4 rounded-tl-3xl">Nama Cabang</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center rounded-tr-3xl">Aksi / Reminder</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700' : 'divide-slate-100'}`}>
              {isLoading ? (
                <tr><td colSpan="3" className="px-6 py-12 text-center font-bold text-slate-400 animate-pulse">Memuat data cabang...</td></tr>
              ) : (activeTabFilter === 'belum' ? unsubmittedList : submittedList).length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center text-slate-400 font-medium">
                    {dbError ? 'Error memuat data.' : (activeTabFilter === 'belum' ? '🎉 Luar biasa! Semua cabang sudah submit.' : 'Belum ada cabang yang selesai.')}
                  </td>
                </tr>
              ) : (
                (activeTabFilter === 'belum' ? unsubmittedList : submittedList).map(b => (
                  <tr key={b.id} className={`group transition-colors ${isDarkMode ? 'hover:bg-neutral-700/40' : 'hover:bg-slate-50/70'}`}>
                    
                    {/* KOLOM NAMA CABANG */}
                    <td className="px-6 py-4 font-bold text-xs sm:text-sm uppercase whitespace-nowrap">
                      {b.branch_name}
                    </td>

                    {/* KOLOM STATUS (Dipercantik & Anti Gencet) */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-black uppercase whitespace-nowrap tracking-wide border ${b.status !== 'BELUM SUBMIT' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-100 text-red-600 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800'}`}>
                        {b.status}
                      </span>
                    </td>

                    {/* KOLOM TOMBOL AKSI (Dibikin Horizontal/Bersebelahan) */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {b.status === 'BELUM SUBMIT' ? (
                          <>
                            <button 
                              onClick={() => sendWhatsAppReminder(b)} 
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#25D366] text-white rounded-lg font-bold text-xs hover:bg-[#20bd5a] shadow-sm transition-all active:scale-95"
                            >
                              💬 WA
                            </button>
                            <button 
                              onClick={() => sendEmailReminder(b)} 
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 shadow-sm transition-all active:scale-95"
                            >
                              ✉️ Email
                            </button>
                          </>
                        ) : (
                          <span className="text-emerald-500 dark:text-emerald-400 font-bold text-xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            Selesai
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