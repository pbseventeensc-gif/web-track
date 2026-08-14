import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminBranchMonitoring({ isDarkMode }) {
  const [branchStatus, setBranchStatus] = useState([]);
  const [reminderHours, setReminderHours] = useState(24); // Setting durasi jam reminder (default 24 jam)
  const [customMessage, setCustomMessage] = useState('Mohon segera melakukan input dan submit order promosi melalui portal Kawan Lama.');

  useEffect(() => {
    fetchBranchStatus();
  }, []);

  const fetchBranchStatus = async () => {
    const { data: branches } = await supabase.from('kl_branches').select('id, branch_name, phone, email');
    const { data: orders } = await supabase.from('kl_orders').select('branch_id, status');

    const result = branches?.map(b => {
      const hasSubmitted = orders?.some(o => o.branch_id === b.id);
      return {
        ...b,
        status: hasSubmitted ? 'SUDAH SUBMIT' : 'BELUM SUBMIT'
      };
    });

    if (result) setBranchStatus(result);
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

  const broadcastWhatsAppAll = () => {
    const unsubmitted = branchStatus.filter(b => b.status === 'BELUM SUBMIT');
    if (unsubmitted.length === 0) return alert('Semua cabang sudah submit!');
    
    // Kirim ke cabang pertama yang belum submit sebagai contoh broadcast langsung
    alert(`Mengirim pengingat massal untuk ${unsubmitted.length} cabang yang belum submit.`);
    sendWhatsAppReminder(unsubmitted[0]);
  };

  return (
    <div className="space-y-6">
      {/* Panel Kontrol Setting Reminder Jam & Pesan Custom */}
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
            <span className="text-[10px] opacity-60 mt-1 block">Digunakan sebagai acuan durasi deadline pada teks pengingat.</span>
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

      {/* Tabel Monitoring Status Cabang */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-600 dark:text-indigo-400">📊 Monitoring Status Cabang (Sudah / Belum Submit)</h3>
          <button 
            onClick={broadcastWhatsAppAll}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            📢 Broadcast WhatsApp ke Cabang Belum Submit
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700 text-neutral-300' : 'bg-stone-100 border-stone-300 text-stone-700'}`}>
                <th className="p-3.5 text-left">Nama Cabang</th>
                <th className="p-3.5 text-center">Status Respon</th>
                <th className="p-3.5 text-center">Aksi Reminder Custom</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
              {branchStatus.map(b => (
                <tr key={b.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                  <td className="p-3.5 font-bold">{b.branch_name}</td>
                  <td className="p-3.5 text-center">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-black ${b.status === 'SUDAH SUBMIT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-center space-x-2">
                    {b.status === 'BELUM SUBMIT' && (
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
                    )}
                    {b.status === 'SUDAH SUBMIT' && (
                      <span className="opacity-50 text-[11px] font-bold">✅ Selesai</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}