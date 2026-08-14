import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function BranchOrderHistory({ isDarkMode, currentUser }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (currentUser) fetchOrders();
  }, [currentUser]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('kl_orders')
      .select('*, kl_order_items(*, kl_master_items(*))')
      .eq('branch_id', currentUser.branch_id)
      .order('created_at', { ascending: false });
      
    if (data) setOrders(data);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-sm">Riwayat & Tracking Order Cabang</h2>
      {orders.length === 0 ? (
        <div className="p-6 text-center opacity-60 text-xs">Belum ada riwayat pesanan yang dibuat.</div>
      ) : (
        orders.map(order => (
          <div key={order.id} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-xs uppercase opacity-70">Order ID: {order.id.slice(0, 8)}</span>
              <span className={`px-2 py-1 rounded text-[10px] font-bold ${order.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {order.status}
              </span>
            </div>
            <p className="text-[10px] opacity-60">Dibuat: {new Date(order.created_at).toLocaleString()}</p>
            <div className="mt-2 text-xs space-y-1">
              {order.kl_order_items?.map((item, idx) => (
                <div key={idx} className="flex justify-between border-b py-1">
                  <span>{item.kl_master_items?.item_name || 'Item'}</span>
                  <span className="font-bold">{item.qty} pcs</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}