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

  const handleUpdateDesignStatus = async (orderId, newStatus) => {
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
    const projectName = o.project_name || '';
    const idStr = o.id || '';
    const q = searchTerm.toLowerCase();
    return branchName.toLowerCase().includes(q) || projectName.toLowerCase().includes(q) || idStr.includes(q);
  });

  // Mengambil nama promo aktif terbaru dari order
  const activePromoName = orders.length > 0 && orders[0].project_name 
    ? orders[0].project_name 
    : 'PROMO NASIONAL KAWAN LAMA GROUP';

  return (
    <div className="space-y-6">
      {/* Sticky Header Banner: Promo Aktif & Kontrol Filter */}
      <div className={`sticky top-0 z-20 p-4 rounded-2xl border shadow-md backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-colors ${
        isDarkMode ? 'bg-neutral-900/95 border-neutral-700 text-white' : 'bg-white/95 border-[#D8D2C2] text-stone-800'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white">
              Promo Sedang Berjalan
            </span>
            <span className="text-xs font-mono opacity-60">Total: {orders.length} Toko Approved</span>
          </div>
          <h2 className="text-sm font-black mt-1 text-indigo-600 dark:text-indigo-400">
            📢 {activePromoName}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs w-full sm:w-64 ${
            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-stone-50 border-stone-200'
          }`}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Cari Cabang / Promo / ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent focus:outline-none text-xs"
            />
          </div>

          <div className="flex items-center gap-3 text-[11px] whitespace-nowrap">
            <span className="flex items-center gap-1 font-bold text-amber-500">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span> ⏳ Proses File
            </span>
            <span className="flex items-center gap-1 font-bold text-emerald-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ✅ Ready Cetak
            </span>
          </div>
        </div>
      </div>

      {/* Grid Tabel Pemantauan File Desain dengan Sticky Header */}
      <div className={`max-h-[620px] overflow-y-auto relative rounded-2xl border shadow-sm ${
        isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white border-[#D8D2C2]'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-10 font-bold border-b shadow-sm ${
            isDarkMode ? 'bg-neutral-900 text-neutral-200 border-neutral-700' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'
          }`}>
            <tr>
              <th className="p-3.5">Nama Promo & Cabang</th>
              <th className="p-3.5">Detail Item Order</th>
              <th className="p-3.5 w-44 text-center">Status Kesiapan File</th>
              <th className="p-3.5">Catatan Teknis Desain</th>
              <th className="p-3.5 text-center w-36">Aksi Checklist</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-stone-100'}`}>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center opacity-60">
                  Belum ada antrean desain untuk order yang sudah di-approve.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                const isReady = order.design_status === 'READY';
                const promoTitle = order.project_name || activePromoName;

                return (
                  <tr key={order.id} className={`transition-colors ${
                    isReady 
                      ? (isDarkMode ? 'bg-emerald-950/20 hover:bg-emerald-950/30' : 'bg-emerald-50/50 hover:bg-emerald-50/80') 
                      : (isDarkMode ? 'bg-amber-950/20 hover:bg-amber-950/30' : 'bg-amber-50/50 hover:bg-amber-50/80')
                  }`}>
                    <td className="p-3.5 align-top">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide block">
                        🏷️ {promoTitle}
                      </span>
                      <strong className="text-xs block mt-0.5">
                        🏢 {order.kl_branches?.branch_name || 'Kantor Cabang'}
                      </strong>
                      <span className="text-[10px] font-mono opacity-50 block mt-0.5">
                        ID: {order.id.slice(0, 8)}
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <div className="space-y-1">
                        {order.kl_order_items?.map((item, idx) => (
                          <div key={idx} className="text-[11px]">
                            • <strong>{item.kl_master_items?.item_name}</strong> ({item.qty} pcs)
                            <span className="opacity-70 ml-1 text-[10px]">[{item.kl_master_items?.size || '-'}]</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-center align-top">
                      <span className={`inline-flex px-3 py-1 rounded-xl text-[10px] font-black tracking-wide border shadow-sm ${
                        isReady
                          ? 'bg-emerald-500/20 text-emerald-600 border-emerald-500/40 dark:text-emerald-400'
                          : 'bg-amber-500/20 text-amber-600 border-amber-500/40 dark:text-amber-400 animate-pulse'
                      }`}>
                        {isReady ? '✅ READY CETAK' : '⏳ PROSES DESAIN'}
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <input
                        type="text"
                        defaultValue={order.design_notes || ''}
                        onBlur={e => handleSaveNotes(order.id, e.target.value)}
                        placeholder="Contoh: File resolusi 300dpi OK, siap print..."
                        className={`w-full p-2 rounded-xl border text-xs focus:outline-none transition-all ${
                          isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-stone-800'
                        }`}
                      />
                    </td>

                    <td className="p-3.5 text-center align-top">
                      <button
                        onClick={() => handleUpdateDesignStatus(order.id, isReady ? 'PROSES' : 'READY')}
                        className={`px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 whitespace-nowrap ${
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