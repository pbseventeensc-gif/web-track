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

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-sm">🔒 Panel Approval Order Cabang (Admin)</h2>
      {pendingOrders.length === 0 ? (
        <div className={`p-6 text-center rounded-2xl border text-xs opacity-60 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
          Tidak ada order baru yang menunggu approval.
        </div>
      ) : (
        pendingOrders.map(order => (
          <div key={order.id} className={`p-5 rounded-3xl border space-y-3 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <span className="font-bold text-xs">Cabang: {order.kl_branches?.branch_name || 'Cabang'}</span>
                <p className="text-[10px] opacity-60">ID Order: {order.id.slice(0, 8)} | Dibuat: {new Date(order.created_at).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => handleApproveOrder(order.id)}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
              >
                {loading ? 'Memproses...' : '✅ Approve Order'}
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold opacity-70">Daftar Barang & Koreksi Qty:</span>
              <div className="space-y-1.5">
                {order.kl_order_items?.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between p-2 rounded-xl border text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-[#E5E0D5]'}`}>
                    <span>{item.kl_master_items?.item_name || 'Barang'} ({item.kl_master_items?.size || '-'})</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] opacity-60">Qty:</span>
                      <input 
                        type="number"
                        min="0"
                        value={item.qty}
                        onChange={(e) => handleUpdateItemQty(item.id, e.target.value)}
                        className={`w-20 p-1 border rounded-lg text-center font-bold ${isDarkMode ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'}`}
                      />
                      <span className="text-[10px] opacity-60">pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}