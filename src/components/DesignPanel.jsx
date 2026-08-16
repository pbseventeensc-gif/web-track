import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function DesignPanel({ isDarkMode, onOpenImageModal }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchApprovedOrders();

    // Listener realtime untuk mendeteksi order baru yang di-approve
    const channel = supabase
      .channel('kl_design_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kl_orders' },
        () => {
          fetchApprovedOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchApprovedOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kl_orders')
      .select('*, kl_branches(branch_name), kl_order_items(*, kl_master_items(*))')
      .in('status', ['APPROVED', 'approved'])
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const handleUpdateDesignStatus = async (orderId, newStatus, currentNotes) => {
    const { error } = await supabase
      .from('kl_orders')
      .update({ 
        design_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, design_status: newStatus } : o));
    } else {
      alert('Gagal update status desain: ' + error.message);
    }
  };

  const handleSaveNotes = async (orderId, notes) => {
    await supabase
      .from('kl_orders')
      .update({ design_notes: notes })
      .eq('id', orderId);
  };

  const filteredOrders = orders.filter(o => {
    const branchName = o.kl_branches?.branch_name || '';
    const idStr = o.id || '';
    return branchName.toLowerCase().includes(searchTerm.toLowerCase()) || idStr.includes(searchTerm);
  });

  return (
    <div className="space-y-6">
      {/* Kontrol Pencarian & Filter */}
      <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3 ${
        isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'
      }`}>
        <div className="flex items-center gap-2 w-full sm:w-80">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Cari Cabang / ID Order..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-amber-500">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Sedang Proses File
          </span>
          <span className="flex items-center gap-1.5 font-bold text-emerald-500">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Ready Cetak
          </span>
        </div>
      </div>

      {/* Tabel Pemantauan File Desain */}
      <div className={`overflow-x-auto rounded-2xl border shadow-sm ${
        isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white border-[#D8D2C2]'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`font-bold border-b ${
            isDarkMode ? 'bg-neutral-900 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'
          }`}>
            <tr>
              <th className="p-3.5">Nama Toko / Cabang</th>
              <th className="p-3.5">Detail Item Order</th>
              <th className="p-3.5 w-48 text-center">Status Kesiapan File</th>
              <th className="p-3.5">Catatan Teknis Desain</th>
              <th className="p-3.5 text-center w-32">Aksi Checklist</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-stone-100'}`}>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center opacity-60">Belum ada antrean desain untuk order yang sudah di-approve.</td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                const isReady = order.design_status === 'READY';
                return (
                  <tr key={order.id} className={`transition-colors ${
                    isReady 
                      ? (isDarkMode ? 'bg-emerald-950/20' : 'bg-emerald-50/50') 
                      : (isDarkMode ? 'bg-amber-950/20' : 'bg-amber-50/50')
                  }`}>
                    <td className="p-3.5 font-bold">
                      🏢 {order.kl_branches?.branch_name || 'Kantor Cabang'}
                      <div className="text-[10px] font-mono opacity-50">ID: {order.id.slice(0, 8)}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="space-y-1">
                        {order.kl_order_items?.map((item, idx) => (
                          <div key={idx} className="text-[11px]">
                            • <strong>{item.kl_master_items?.item_name}</strong> ({item.qty} pcs) - <span className="opacity-70">{item.kl_master_items?.size || '-'}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-xl text-[11px] font-black tracking-wide border shadow-sm ${
                        isReady
                          ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40 dark:text-emerald-400'
                          : 'bg-amber-500/20 text-amber-600 border-amber-500/40 dark:text-amber-400 animate-pulse'
                      }`}>
                        {isReady ? '✅ READY CETAK' : '⏳ PROSES DESAIN'}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <input
                        type="text"
                        defaultValue={order.design_notes || ''}
                        onBlur={e => handleSaveNotes(order.id, e.target.value)}
                        placeholder="Contoh: Ukuran fix, resolusi 300dpi OK..."
                        className={`w-full p-1.5 rounded-lg border text-xs focus:outline-none ${
                          isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-stone-800'
                        }`}
                      />
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleUpdateDesignStatus(order.id, isReady ? 'PROSES' : 'READY')}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${
                          isReady
                            ? 'bg-neutral-600 hover:bg-neutral-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isReady ? '↩ Batalkan Ready' : '✔ Set Ready Cetak'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}