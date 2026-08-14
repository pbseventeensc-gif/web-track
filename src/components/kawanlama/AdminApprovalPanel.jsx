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
      .in('status', ['SUBMITTED'])
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
      .update({ status: 'APPROVED', lock_status: 'LOCKED' })
      .eq('id', orderId);

    if (!error) {
      alert('✅ Order berhasil disetujui (Approved)!');
      fetchPendingOrders();
    } else {
      alert('Gagal approve: ' + error.message);
    }
    setLoading(false);
  };

  const handleUnlockOrder = async (orderId) => {
    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ lock_status: 'UNLOCKED' })
      .eq('id', orderId);

    if (!error) {
      alert('🔓 Berhasil membuka kunci! Cabang kini dapat mengedit dan merevisi pesanan mereka.');
      fetchPendingOrders();
    } else {
      alert('Gagal membuka kunci: ' + error.message);
    }
    setLoading(false);
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h2 className="font-extrabold text-base mb-1 tracking-wide">🔒 Panel Approval & Rekapitulasi Order Cabang</h2>
        <p className="text-xs opacity-70">Review kuantiti pesanan, setujui order, atau berikan izin buka kunci (*unlock*) bagi cabang yang ingin merevisi.</p>
      </div>

      {pendingOrders.length === 0 ? (
        <div className={`p-10 text-center rounded-3xl border text-xs opacity-60 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
          📭 Tidak ada order baru dari cabang yang menunggu approval.
        </div>
      ) : (
        pendingOrders.map(order => {
          const grandTotal = order.kl_order_items?.reduce((acc, item) => {
            const price = Number(item.kl_master_items?.price || 0);
            const qty = Number(item.qty || 0);
            return acc + (price * qty);
          }, 0) || 0;

          const isRequestingUnlock = order.lock_status === 'REQUEST_UNLOCK';

          return (
            <div key={order.id} className={`p-6 rounded-3xl border shadow-sm space-y-4 transition-all ${
              isRequestingUnlock 
                ? (isDarkMode ? 'bg-red-950/30 border-red-700/60 text-white' : 'bg-red-50/60 border-red-300 text-stone-800')
                : (isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800')
            }`}>
              
              {/* Header Card Order */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Badge Nama Toko / Cabang Warna Hijau */}
                    <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                      🏢 {order.kl_branches?.branch_name || 'Kantor Cabang'}
                    </span>
                    <span className="text-[10px] font-mono opacity-60">ID: {order.id.slice(0, 8)}</span>
                    
                    {/* Badge Minta Buka Kunci Warna Merah Mencolok */}
                    {isRequestingUnlock && (
                      <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 animate-pulse">
                        ⚠️ MINTA BUKA KUNCI (REQUEST UNLOCK)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-70 mt-1.5">Waktu Submit: {new Date(order.created_at).toLocaleString()}</p>
                </div>

                <div className="flex items-center gap-2">
                  {isRequestingUnlock && (
                    <button 
                      onClick={() => handleUnlockOrder(order.id)}
                      disabled={loading}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
                    >
                      🔓 Setujui Buka Kunci
                    </button>
                  )}
                  <button 
                    onClick={() => handleApproveOrder(order.id)}
                    disabled={loading}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
                  >
                    {loading ? 'Memproses...' : '✅ Approve & Teruskan Order'}
                  </button>
                </div>
              </div>

              {/* Tabel Item Pesanan */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`border-b font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700 text-neutral-300' : 'bg-stone-100 border-stone-300 text-stone-700'}`}>
                      <th className="p-3 text-left">Nama Barang</th>
                      <th className="p-3 text-left">Material / Bahan</th>
                      <th className="p-3 text-left">Ukuran (Size)</th>
                      <th className="p-3 text-right">Harga Satuan</th>
                      <th className="p-3 text-center w-28">Qty Order</th>
                      <th className="p-3 text-right">Subtotal Harga</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
                    {order.kl_order_items?.map((item) => {
                      const unitPrice = Number(item.kl_master_items?.price || 0);
                      const subtotal = unitPrice * Number(item.qty || 0);
                      const materialStr = item.kl_master_items?.material || '-';
                      const sizeStr = item.kl_master_items?.size || '-';

                      return (
                        <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                          <td className="p-3.5 font-bold">{item.kl_master_items?.item_name || 'Barang Logistik'}</td>
                          <td className="p-3.5 opacity-80 uppercase font-medium">{materialStr}</td>
                          <td className="p-3.5 opacity-80 uppercase font-mono">{sizeStr}</td>
                          <td className="p-3.5 text-right font-mono opacity-90">{formatRupiah(unitPrice)}</td>
                          <td className="p-3.5 text-center">
                            <input 
                              type="number"
                              min="0"
                              value={item.qty}
                              onChange={(e) => handleUpdateItemQty(item.id, e.target.value)}
                              className={`w-20 p-1.5 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'}`}
                            />
                          </td>
                          <td className="p-3.5 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {formatRupiah(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grand Total */}
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