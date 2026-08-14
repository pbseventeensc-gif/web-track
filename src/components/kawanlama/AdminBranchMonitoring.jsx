import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminBranchMonitoring({ isDarkMode }) {
  const [branchStatus, setBranchStatus] = useState([]);

  useEffect(() => {
    fetchBranchStatus();
  }, []);

  const fetchBranchStatus = async () => {
    // Menggabungkan data cabang dengan status order mereka
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
    const message = encodeURIComponent(`Halo ${branch.branch_name}, mohon segera melakukan input dan submit order promosi melalui portal Kawan Lama.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const sendEmailReminder = (branch) => {
    const email = branch.email || 'cabang@email.com';
    const subject = encodeURIComponent('Reminder: Submit Order Kawan Lama');
    const body = encodeURIComponent(`Halo ${branch.branch_name},\n\nMohon segera melakukan submit order promosi Anda di portal.\n\nTerima kasih.`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  return (
    <div className={`p-6 rounded-3xl border space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
      <h3 className="font-bold text-sm">📊 Monitoring Status Cabang (Sudah / Belum Submit)</h3>
      <table className="w-full text-xs">
        <thead className="border-b">
          <tr>
            <th className="p-3 text-left">Nama Cabang</th>
            <th className="p-3 text-center">Status Respon</th>
            <th className="p-3 text-center">Aksi Reminder</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {branchStatus.map(b => (
            <tr key={b.id}>
              <td className="p-3 font-semibold">{b.branch_name}</td>
              <td className="p-3 text-center">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${b.status === 'SUDAH SUBMIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {b.status}
                </span>
              </td>
              <td className="p-3 text-center space-x-2">
                {b.status === 'BELUM SUBMIT' && (
                  <>
                    <button onClick={() => sendWhatsAppReminder(b)} className="px-3 py-1.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-500">
                      💬 Reminder WA
                    </button>
                    <button onClick={() => sendEmailReminder(b)} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500">
                      ✉️ Reminder Email
                    </button>
                  </>
                )}
                {b.status === 'SUDAH SUBMIT' && (
                  <span className="opacity-50 text-[10px]">✅ Selesai</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}