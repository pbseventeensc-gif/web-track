import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminApprovalPanel({ isDarkMode }) {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPendingOrders();
  }, []);

  const fetchPendingOrders = async () => {
    const { data } = await supabase
      .from('kl_orders')
      .select('*, kl_branches(branch_name), kl_order_items(*, kl_master_items(*))')
      .eq('status', 'SUBMITTED')
      .order('created_at', { ascending: false });

    if (data) setPendingOrders(data);
  };

  const handleUpdateItemQty = async (itemId, newQty) => {
    const qty = Number(newQty) || 0;
    await supabase.from('kl_order_items').update({ qty }).eq('id', itemId);
    fetchPendingOrders();
  };

  const handleApproveOrder = async (orderId) => {
    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ status: 'APPROVED' })
      .eq('id', orderId);

    if (!error) {
      alert('✅ Order berhasil disetujui (Approved)!');
      fetchPendingOrders();
    } else {
      alert('Gagal approve: ' + error.message);
    }
    setLoading(false);
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <h2 className="font-bold text-base mb-1">🔒 Panel Approval & Rekapitulasi Order Cabang</h2>
        <p className="text-xs opacity-70">Review kuantiti pesanan, koreksi harga/qty, dan setujui order masuk dari kantor cabang.</p>
      </div>

      {pendingOrders.length === 0 ? (
        <div className={`p-10 text-center rounded-3xl border text-xs opacity-60 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
          📭 Tidak ada order baru dari cabang yang menunggu approval.
        </div>
      ) : (
        pendingOrders.map(order => {
          // Hitung Grand Total Harga per Order
          const grandTotal = order.kl_order_items?.reduce((acc, item) => {
            const price = Number(item.kl_master_items?.price || 0);
            const qty = Number(item.qty || 0);
            return acc + (price * qty);
          }, 0) || 0;

          return (
            <div key={order.id} className={`p-6 rounded-3xl border shadow-sm space-y-4 transition-all ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
              
              {/* Header Card Order */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                      🏢 {order.kl_branches?.branch_name || 'Kantor Cabang'}
                    </span>
                    <span className="text-[10px] font-mono opacity-60">ID: {order.id.slice(0, 8)}</span>
                  </div>
                  <p className="text-[11px] opacity-70 mt-1">Waktu Submit: {new Date(order.created_at).toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => handleApproveOrder(order.id)}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  {loading ? 'Memproses...' : '✅ Approve & Teruskan Order'}
                </button>
              </div>

              {/* Tabel Item Pesanan Beserta Harga Satuan & Subtotal */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className={`border-b ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-200 text-stone-500'}`}>
                    <tr>
                      <th className="p-2.5 text-left">Nama Barang</th>
                      <th className="p-2.5 text-left">Material / Ukuran</th>
                      <th className="p-2.5 text-right">Harga Satuan</th>
                      <th className="p-2.5 text-center w-28">Qty Order</th>
                      <th className="p-2.5 text-right">Subtotal Harga</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
                    {order.kl_order_items?.map((item) => {
                      const unitPrice = Number(item.kl_master_items?.price || 0);
                      const subtotal = unitPrice * Number(item.qty || 0);

                      return (
                        <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                          <td className="p-3 font-semibold">{item.kl_master_items?.item_name || 'Barang Logistik'}</td>
                          <td className="p-3 opacity-70">
                            {item.kl_master_items?.material || '-'} / {item.kl_master_items?.size || '-'}
                          </td>
                          <td className="p-3 text-right font-mono opacity-90">{formatRupiah(unitPrice)}</td>
                          <td className="p-3 text-center">
                            <input 
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => handleUpdateItemQty(item.id, e.target.value)}
                              className={`w-20 p-1.5 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'}`}
                            />
                          </td>
                          <td className="p-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {formatRupiah(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Grand Total */}
              <div className={`p-4 rounded-2xl flex justify-between items-center ${isDarkMode ? 'bg-neutral-900/80 border border-neutral-700' : 'bg-[#F8F6F0] border border-[#E5E0D5]'}`}>
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">Estimasi Grand Total Biaya Order:</span>
                <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">{formatRupiah(grandTotal)}</span>
              </div>

            </div>
          );
        })
      )}
    </div>
  );
}