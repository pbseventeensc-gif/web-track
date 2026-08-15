import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminBranchMonitoring({ isDarkMode }) {
  const [branchStatus, setBranchStatus] = useState([]);
  const [activeTabFilter, setActiveTabFilter] = useState('belum'); 
  const [reminderHours, setReminderHours] = useState(24);
  const [customMessage, setCustomMessage] = useState('Mohon segera melakukan input dan submit order promosi melalui portal Kawan Lama.');

  useEffect(() => {
    fetchBranchStatus();
  }, []);

  const fetchBranchStatus = async () => {
    // 1. Ambil Promo Aktif
    const { data: activePromo } = await supabase
      .from('kl_promos')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();

    // 2. Kembalikan ke select('*') agar tidak error jika kolom phone/email tidak ada di tabel
    const { data: branches, error: branchError } = await supabase
      .from('kl_branch_access')
      .select('*');

    if (branchError) {
      console.error('⚠️ Error saat mengambil tabel kl_branch_access:', branchError.message);
      return;
    }

    // 3. Ambil data order
    let query = supabase.from('kl_orders').select('*');
    if (activePromo) {
      query = query.eq('promo_id', activePromo.id);
    }
    const { data: orders } = await query;

    // 4. Petakan data
    const mappedData = (branches || []).map(branch => {
      // Pastikan pencocokan ID tepat
      const matchedOrder = (orders || []).find(o => 
        String(o.branch_id) === String(branch.id) || 
        (o.branch_id && branch.branch_name && String(o.branch_id).toLowerCase() === String(branch.branch_name).toLowerCase())
      );

      let statusText = 'BELUM SUBMIT';
      if (matchedOrder) {
        if (matchedOrder.status === 'APPROVED' || matchedOrder.status === 'approved' || matchedOrder.lock_status === 'LOCKED') {
          statusText = 'SUDAH SUBMIT & APPROVED';
        } else {
          statusText = 'SUDAH SUBMIT';
        }
      }

      return {
        id: branch.id,
        // Fokus hanya pada branch_name sesuai nama kolom di database Anda
        branch_name: branch.branch_name || `Cabang ID: ${branch.id}`,
        phone: branch.phone || branch.whatsapp || '628123456789',
        email: branch.email || 'cabang@email.com',
        status: statusText
      };
    });

    setBranchStatus(mappedData);
  };

  const sendWhatsAppReminder = (branch) => {
    const phone = branch.phone || '628123456789';
    const text = encodeURIComponent(`Halo ${branch.branch_name} (Batas Waktu: ${reminderHours} Jam),\n\n${customMessage}\n\nTerima kasih.`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const sendEmailReminder = (branch) => {
    const email = branch.email || 'cabang@email.com';
    const subject = encodeURIComponent(`REMINDER: Submit Order Kawan Lama (Deadline ${reminderHours} Jam)`);
    const body = encodeURIComponent(`Halo ${branch.branch_name},\n\n${customMessage}\n\nMohon segera diselesaikan dalam waktu ${reminderHours} jam ke depan.\n\nTerima kasih.`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  const unsubmittedList = branchStatus.filter(b => b.status === 'BELUM SUBMIT');
  const submittedList = branchStatus.filter(b => b.status !== 'BELUM SUBMIT');

  return (
    <div className="space-y-6">
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400">⚙️ Pengaturan Pengingat (Reminder) Cabang</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold mb-1 opacity-80">Batas Waktu Reminder (Dalam Jam)</label>
            <input 
              type="number" 
              value={reminderHours} 
              onChange={e => setReminderHours(Number(e.target.value))} 
              className={`w-full p-3 border rounded-xl font-bold font-mono focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-amber-400' : 'bg-stone-50 border-stone-300 text-amber-600'}`} 
            />
          </div>

          <div>
            <label className="block font-bold mb-1 opacity-80">Isi Pesan Custom Pengingat</label>
            <input 
              type="text" 
              value={customMessage} 
              onChange={e => setCustomMessage(e.target.value)} 
              className={`w-full p-3 border rounded-xl font-semibold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
            />
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400">📊 STATUS MONITORING BROADCAST CABANG ({branchStatus.length} TOTAL TOKO)</h3>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTabFilter('belum')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTabFilter === 'belum' ? 'bg-amber-600 text-white shadow-md' : isDarkMode ? 'bg-neutral-900 text-neutral-400' : 'bg-stone-100 text-stone-600'}`}
            >
              ⏳ Belum Submit ({unsubmittedList.length})
            </button>
            <button 
              onClick={() => setActiveTabFilter('sudah')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTabFilter === 'sudah' ? 'bg-emerald-600 text-white shadow-md' : isDarkMode ? 'bg-neutral-900 text-neutral-400' : 'bg-stone-100 text-stone-600'}`}
            >
              ✅ Sudah Submit / Done ({submittedList.length})
            </button>
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto relative rounded-2xl border border-stone-200 dark:border-neutral-700">
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
              <tr>
                <th className="p-3.5 text-left">Nama Cabang</th>
                <th className="p-3.5 text-center">Status Respon</th>
                <th className="p-3.5 text-center">Aksi / Reminder</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
              {(activeTabFilter === 'belum' ? unsubmittedList : submittedList).length === 0 ? (
                <tr>
                  <td colSpan="3" className="p-8 text-center opacity-60">
                    {activeTabFilter === 'belum' ? '🎉 Luar biasa! Semua cabang sudah melakukan submit order.' : 'Belum ada cabang yang menyelesaikan order.'}
                  </td>
                </tr>
              ) : (
                (activeTabFilter === 'belum' ? unsubmittedList : submittedList).map(b => (
                  <tr key={b.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                    <td className="p-3.5 font-bold uppercase">{b.branch_name}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${b.status !== 'BELUM SUBMIT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center space-x-2">
                      {b.status === 'BELUM SUBMIT' ? (
                        <>
                          <button 
                            onClick={() => sendWhatsAppReminder(b)} 
                            className="px-3 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-500 shadow-sm transition-all active:scale-95"
                          >
                            💬 WA ({reminderHours} Jam)
                          </button>
                          <button 
                            onClick={() => sendEmailReminder(b)} 
                            className="px-3 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 shadow-sm transition-all active:scale-95"
                          >
                            ✉️ Email
                          </button>
                        </>
                      ) : (
                        <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 rounded-xl font-bold">
                          ✅ DONE (Selesai)
                        </span>
                      )}
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