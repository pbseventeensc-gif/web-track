import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function BranchOrderHistory({ isDarkMode, currentUser }) {
  const [orders, setOrders] = useState([]);
  const [loadingOrderId, setLoadingOrderId] = useState(null);

  useEffect(() => {
    if (currentUser) fetchOrders();
  }, [currentUser]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('kl_orders')
      .select('*, kl_promos(title), kl_order_items(*, kl_master_items(*))')
      .eq('branch_id', currentUser.branch_id)
      .order('created_at', { ascending: false });
      
    if (data) setOrders(data);
  };

  // Fungsi untuk mengirim permintaan buka kunci ke admin
  const handleRequestUnlock = async (orderId) => {
    if (!window.confirm('Ajukan permintaan buka kunci order ini ke admin agar bisa direvisi?')) return;

    setLoadingOrderId(orderId);
    // Mengubah status atau lock_status menjadi REQUEST_UNLOCK
    const { error } = await supabase
      .from('kl_orders')
      .update({ status: 'REQUEST_UNLOCK', lock_status: 'REQUEST_UNLOCK' })
      .eq('id', orderId);

    if (!error) {
      alert('🔓 Permintaan buka kunci berhasil dikirim ke Admin!');
      fetchOrders();
    } else {
      alert('Gagal mengirim permintaan: ' + error.message);
    }
    setLoadingOrderId(null);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h2 className="font-extrabold text-base mb-1 tracking-wide">📦 Riwayat & Tracking Order Cabang</h2>
        <p className="text-xs opacity-70">Daftar pesanan logistik yang telah Anda submit ke kantor pusat.</p>
      </div>

      {orders.length === 0 ? (
        <div className={`p-10 text-center rounded-3xl border text-xs opacity-60 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
          📭 Belum ada riwayat pesanan yang dibuat.
        </div>
      ) : (
        orders.map(order => {
          const isApproved = order.status === 'APPROVED';
          const isRequesting = order.status === 'REQUEST_UNLOCK' || order.lock_status === 'REQUEST_UNLOCK';

          return (
            <div key={order.id} className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
              
              {/* Header Card Order */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      {order.kl_promos?.title || order.project_name || 'Order Logistik Cabang'}
                    </span>
                    <span className="text-[10px] font-mono opacity-60 px-2 py-0.5 rounded bg-stone-100 dark:bg-neutral-900">
                      ID: {order.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-70 mt-1">Waktu Submit: {new Date(order.created_at).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Badge Status */}
                  <span className={`px-3 py-1 rounded-xl text-xs font-black ${
                    order.status === 'SUBMITTED' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' 
                      : order.status === 'REQUEST_UNLOCK'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 animate-pulse'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                  }`}>
                    Status: {order.status}
                  </span>

                  {/* Tombol Minta Buka Kunci Muncul Jika Sudah Approved / Locked */}
                  {isApproved && !isRequesting && (
                    <button
                      onClick={() => handleRequestUnlock(order.id)}
                      disabled={loadingOrderId === order.id}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow transition-all active:scale-95"
                    >
                      {loadingOrderId === order.id ? 'Mengirim...' : '🔒 Minta Buka Kunci'}
                    </button>
                  )}

                  {isRequesting && (
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 italic">
                      Menunggu persetujuan admin...
                    </span>
                  )}
                </div>
              </div>

              {/* Tabel Detail Item */}
              <div className="max-h-[400px] overflow-y-auto relative rounded-2xl border border-stone-200 dark:border-neutral-700">
                <table className="w-full text-xs border-collapse">
                  <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
                    <tr>
                      <th className="p-3.5 text-left">Nama Barang</th>
                      <th className="p-3.5 text-left">Material / Bahan</th>
                      <th className="p-3.5 text-left">Ukuran (Size)</th>
                      <th className="p-3.5 text-center w-28">Qty Order</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
                    {order.kl_order_items?.map((item, idx) => {
                      const master = item.kl_master_items || {};
                      return (
                        <tr key={idx} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                          <td className="p-3.5 font-bold">{master.item_name || 'Barang Logistik'}</td>
                          <td className="p-3.5 opacity-80 uppercase font-medium">{master.material || '-'}</td>
                          <td className="p-3.5 opacity-80 uppercase font-mono">{master.size || '-'}</td>
                          <td className="p-3.5 text-center font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {item.qty} pcs
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          );
        })
      )}
    </div>
  );
}