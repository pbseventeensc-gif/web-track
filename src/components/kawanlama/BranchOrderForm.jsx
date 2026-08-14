import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function BranchOrderForm({ isDarkMode, currentUser }) {
  const [items, setItems] = useState([]);
  const [activePromo, setActivePromo] = useState(null);
  const [existingOrder, setExistingOrder] = useState(null);
  const [hasOrdered, setHasOrdered] = useState(false);
  const [orderQty, setOrderQty] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMasterItems();
    fetchActivePromo();
  }, [currentUser]);

  const fetchMasterItems = async () => {
    const { data } = await supabase
      .from('kl_master_items')
      .select('*')
      .order('item_name', { ascending: true });
    if (data) setItems(data);
  };

  const fetchActivePromo = async () => {
    const { data: promoData } = await supabase
      .from('kl_promos')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (promoData) {
      setActivePromo(promoData);
      
      if (currentUser) {
        const { data: orderData } = await supabase
          .from('kl_orders')
          .select('*, kl_order_items(item_id, qty)')
          .eq('branch_id', currentUser.branch_id)
          .eq('promo_id', promoData.id)
          .maybeSingle();

        if (orderData) {
          setExistingOrder(orderData);
          // Jika status lock_status adalah 'UNLOCKED', maka cabang boleh edit meskipun sudah pernah submit
          if (orderData.lock_status === 'UNLOCKED') {
            setHasOrdered(false);
            // Muat qty yang sebelumnya sudah di-input ke form agar bisa diedit
            const qtyMap = {};
            orderData.kl_order_items?.forEach(i => { qtyMap[i.item_id] = i.qty; });
            setOrderQty(qtyMap);
          } else {
            setHasOrdered(true);
          }
        } else {
          setHasOrdered(false);
        }
      }
    }
  };

  const calculateTotalOrderValue = (currentQtyMap) => {
    return items.reduce((acc, item) => {
      const qty = Number(currentQtyMap[item.id] || 0);
      const price = Number(item.price || 0);
      return acc + (qty * price);
    }, 0);
  };

  const handleQtyChange = (itemId, val) => {
    if (hasOrdered) return;
    const newQty = Number(val) || 0;
    const simulatedQtyMap = { ...orderQty, [itemId]: newQty };
    const projectedTotal = calculateTotalOrderValue(simulatedQtyMap);
    const maxBudgetLimit = activePromo ? Number(activePromo.custom_budget || 0) : 0;

    if (maxBudgetLimit > 0 && projectedTotal > maxBudgetLimit) {
      alert(`⚠️ Peringatan: Penambahan kuantiti ini membuat total estimasi pesanan melebihi batas alokasi ${activePromo.budget_type}! Kuantiti dibatasi.`);
      return;
    }

    setOrderQty(simulatedQtyMap);
  };

  const requestUnlock = async () => {
    if (!existingOrder) return;
    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ lock_status: 'REQUEST_UNLOCK' })
      .eq('id', existingOrder.id);

    if (!error) {
      alert('🔓 Permintaan buka kunci telah dikirim ke Admin. Mohon tunggu persetujuan admin.');
      fetchActivePromo();
    } else {
      alert('Gagal mengirim permintaan: ' + error.message);
    }
    setLoading(false);
  };

  const submitOrder = async () => {
    if (!currentUser) return alert('Silakan login cabang terlebih dahulu');
    
    const totalOrder = calculateTotalOrderValue(orderQty);
    const maxBudgetLimit = activePromo ? Number(activePromo.custom_budget || 0) : 0;

    if (maxBudgetLimit > 0 && totalOrder > maxBudgetLimit) {
      alert(`❌ Gagal Submit: Total nilai pesanan Anda (${totalOrder}) melewati batas alokasi ${activePromo.budget_type}! Mohon kurangi kuantiti barang.`);
      return;
    }

    setLoading(true);
    
    let targetOrderId = existingOrder?.id;

    if (targetOrderId) {
      // Jika order sudah ada (sedang dalam status unlocked), update header order & hapus item lama untuk diganti yang baru
      await supabase.from('kl_orders').update({
        status: 'SUBMITTED',
        lock_status: 'LOCKED',
        project_name: activePromo ? activePromo.title : 'Order Cabang'
      }).eq('id', targetOrderId);

      await supabase.from('kl_order_items').delete().eq('order_id', targetOrderId);
    } else {
      // Buat order baru jika belum pernah ada
      const { data: orderData, error: orderError } = await supabase
        .from('kl_orders')
        .insert({ 
          branch_id: currentUser.branch_id, 
          promo_id: activePromo ? activePromo.id : null,
          project_name: activePromo ? activePromo.title : 'Order Cabang',
          status: 'SUBMITTED',
          lock_status: 'LOCKED'
        })
        .select()
        .single();

      if (orderError) {
        alert('Gagal submit order: ' + orderError.message);
        setLoading(false);
        return;
      }
      targetOrderId = orderData.id;
    }

    const orderItems = Object.entries(orderQty)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        order_id: targetOrderId,
        item_id: itemId,
        qty: qty
      }));

    if (orderItems.length > 0) {
      await supabase.from('kl_order_items').insert(orderItems);
    }
    
    alert('✅ Order Berhasil Disubmit / Diperbarui!');
    setLoading(false);
    fetchActivePromo();
  };

  return (
    <div className="space-y-6">
      {/* Keterangan Promo Aktif & Status Tombol Cabang */}
      <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              Kampanye / Promo Aktif
            </span>
            {activePromo?.budget_type && (
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                Alokasi: {activePromo.budget_type}
              </span>
            )}
            {hasOrdered && existingOrder?.lock_status === 'LOCKED' && (
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                🔒 Terkunci (Telah Disubmit)
              </span>
            )}
            {existingOrder?.lock_status === 'REQUEST_UNLOCK' && (
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                ⏳ Menunggu Persetujuan Admin Buka Kunci
              </span>
            )}
            {existingOrder?.lock_status === 'UNLOCKED' && (
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                🔓 Dibuka Admin (Silakan Edit & Resubmit)
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mt-2">{activePromo ? activePromo.title : 'Belum Ada Promo Aktif'}</h3>
          <p className="text-xs opacity-70 mt-1">
            {hasOrdered && existingOrder?.lock_status === 'LOCKED'
              ? 'Anda sudah melakukan submit order. Jika ingin mengubah pesanan, silakan klik tombol "Minta Buka Kunci ke Admin".'
              : (activePromo ? activePromo.description : 'Silakan menunggu instruksi admin.')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {hasOrdered && existingOrder?.lock_status === 'LOCKED' && (
            <button 
              onClick={requestUnlock}
              disabled={loading || existingOrder?.lock_status === 'REQUEST_UNLOCK'}
              className="px-5 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 text-xs whitespace-w-auto"
            >
              🔑 Minta Buka Kunci ke Admin
            </button>
          )}

          {!hasOrdered && (
            <button 
              onClick={submitOrder}
              disabled={loading || !activePromo}
              className={`w-full md:w-auto px-6 py-3.5 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 whitespace-nowrap ${!activePromo ? 'bg-stone-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
            >
              {loading ? 'Memproses...' : (existingOrder?.lock_status === 'UNLOCKED' ? '🔄 Resubmit / Perbarui Order' : '🚀 Submit Order Cabang')}
            </button>
          )}
        </div>
      </div>

      {/* Grid Input Order Cabang */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h2 className="font-extrabold text-sm mb-4 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
          {hasOrdered ? 'Form Permintaan (Terkunci - Telah Disubmit)' : 'Form Permintaan / Order Logistik Cabang'}
        </h2>
        <div className="max-h-[500px] overflow-y-auto relative rounded-2xl border border-stone-200 dark:border-neutral-700">
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
              <tr>
                <th className="p-3.5 text-left">Nama Barang</th>
                <th className="p-3.5 text-left">Material / Bahan</th>
                <th className="p-3.5 text-left">Ukuran (Size)</th>
                <th className="p-3.5 text-center w-32">Qty Order</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
              {items.map(item => {
                const materialStr = item.material || '-';
                const sizeStr = item.size || '-';

                return (
                  <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                    <td className="p-3.5 font-bold">{item.item_name}</td>
                    <td className="p-3.5 opacity-80 uppercase font-medium">{materialStr}</td>
                    <td className="p-3.5 opacity-80 uppercase font-mono">{sizeStr}</td>
                    <td className="p-3.5 text-center">
                      <input 
                        type="number" 
                        min="0"
                        disabled={hasOrdered}
                        value={orderQty[item.id] || ''}
                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                        className={`w-24 p-2 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          hasOrdered 
                            ? 'opacity-50 cursor-not-allowed bg-stone-200 dark:bg-neutral-900' 
                            : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'
                        }`}
                        placeholder="0"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}