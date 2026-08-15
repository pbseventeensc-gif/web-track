import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminBranchMonitoring({ isDarkMode }) {
  // === SIMULASI ROLE (Untuk Testing) ===
  const [adminRole, setAdminRole] = useState('PUSAT'); // Pilihan: PUSAT, CIKOKOL, PASMING

  const [branchStatus, setBranchStatus] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('belum'); 
  const [reminderHours, setReminderHours] = useState(24);
  const [customMessage, setCustomMessage] = useState('Mohon segera melakukan input dan submit order promosi melalui portal Kawan Lama.');
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState(null);
  const [activePromoId, setActivePromoId] = useState(null);

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

    if (activePromo) setActivePromoId(activePromo.id);

    // 2. Ambil Master Cabang
    const { data: branches, error: branchError } = await supabase
      .from('kl_branches')
      .select('*');

    if (branchError) {
      setDbError(`Error DB kl_branches: ${branchError.message}`);
      setIsLoading(false);
      return;
    }

    // 3. Ambil data Order (Untuk melihat status & status lemparan)
    let query = supabase.from('kl_orders').select('*');
    if (activePromo) {
      query = query.eq('promo_id', activePromo.id);
    }
    const { data: orders } = await query;

    // 4. Petakan Data Gabungan
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
      const region = branch.region || 'PUSAT'; // Default ke pusat jika kosong
      const isDelegated = matchedOrder?.is_delegated_to_pusat || false;

      return {
        id: branch.id,
        order_id: matchedOrder?.id || null, // Penting untuk fungsi update nanti
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

  // === FILTERING DATA BERDASARKAN ROLE ===
  const displayedBranches = branchStatus.filter(b => {
    if (adminRole === 'PUSAT') {
      // Pusat melihat cabang aslinya + cabang yang dilempar dari sub kantor
      return b.region === 'PUSAT' || b.is_delegated === true;
    } else {
      // Cikokol/Pasming HANYA melihat cabangnya sendiri yang BELUM dilempar
      return b.region === adminRole && b.is_delegated === false;
    }
  });

  const unsubmittedList = displayedBranches.filter(b => b.status === 'BELUM SUBMIT');
  const submittedList = displayedBranches.filter(b => b.status !== 'BELUM SUBMIT');

  // === FUNGSI LEMPAR TUGAS KE PUSAT ===
  const handleDelegateToPusat = async (branch) => {
    if (!activePromoId) {
      alert("Tidak ada promo aktif, tidak bisa melempar tugas.");
      return;
    }
    
    const confirmThrow = window.confirm(`Apakah Anda yakin ingin melempar ${branch.branch_name} ke Pusat? Toko ini akan hilang dari daftar Anda untuk sesi ini.`);
    if (!confirmThrow) return;

    // Jika belum ada row order-nya, kita INSERT sekalian buat row kosong
    if (!branch.order_id) {
      await supabase.from('kl_orders').insert({
        branch_id: branch.id,
        promo_id: activePromoId,
        status: 'BELUM SUBMIT',
        is_delegated_to_pusat: true
      });
    } else {
      // Jika sudah ada, tinggal UPDATE flag-nya
      await supabase.from('kl_orders').update({
        is_delegated_to_pusat: true
      }).eq('id', branch.order_id);
    }
    
    // Refresh otomatis setelah lempar
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
      
      {/* KOTAK SIMULASI ROLE (KHUSUS UNTUK TESTING) */}
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
        <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-neutral-700">
          <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            📊 Tugas Follow-Up <span className="text-slate-400 font-medium">({displayedBranches.length} Toko)</span>
          </h3>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => setActiveTabFilter('belum')} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'belum' ? 'bg-red-50 border-red-200 text-red-700 shadow-sm dark:bg-red-900/40 dark:border-red-800 dark:text-red-300' : isDarkMode ? 'bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-700' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}>⏳ Belum ({unsubmittedList.length})</button>
            <button onClick={() => setActiveTabFilter('sudah')} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${activeTabFilter === 'sudah' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-300' : isDarkMode ? 'bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-700' : 'bg-transparent border-slate-200 text-slate-500 hover:bg-slate-50'}`}>✅ Sudah ({submittedList.length})</button>
          </div>
        </div>

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
                <tr><td colSpan="3" className="px-6 py-12 text-center font-bold animate-pulse">Memuat data...</td></tr>
              ) : (activeTabFilter === 'belum' ? unsubmittedList : submittedList).length === 0 ? (
                <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-400 font-medium">Tidak ada toko di daftar ini.</td></tr>
              ) : (
                (activeTabFilter === 'belum' ? unsubmittedList : submittedList).map(b => (
                  <tr key={b.id} className={`group transition-colors ${isDarkMode ? 'hover:bg-neutral-700/40' : 'hover:bg-slate-50/70'}`}>
                    
                    <td className="px-6 py-4 font-bold text-xs sm:text-sm uppercase whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span>{b.branch_name}</span>
                        {/* Label Khusus jika Pusat menerima titipan dari Sub Kantor */}
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
                            
                            {/* Tombol Lempar (Hanya muncul jika Role Sub Kantor) */}
                            {adminRole !== 'PUSAT' && (
                              <button 
                                onClick={() => handleDelegateToPusat(b)} 
                                className="px-3 py-1.5 bg-slate-200 text-slate-700 dark:bg-neutral-700 dark:text-neutral-300 rounded-lg font-bold text-xs hover:bg-orange-200 hover:text-orange-800 transition-colors shadow-sm border border-transparent hover:border-orange-300 flex items-center gap-1"
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