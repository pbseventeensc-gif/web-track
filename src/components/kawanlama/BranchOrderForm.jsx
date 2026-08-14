import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function BranchOrderForm({ isDarkMode, currentUser }) {
  const [items, setItems] = useState([]);
  const [activePromo, setActivePromo] = useState(null);
  const [orderQty, setOrderQty] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMasterItems();
    fetchActivePromo();
  }, []);

  const fetchMasterItems = async () => {
    const { data } = await supabase
      .from('kl_master_items')
      .select('*')
      .order('item_name', { ascending: true });
    if (data) setItems(data);
  };

  const fetchActivePromo = async () => {
    const { data } = await supabase
      .from('kl_promos')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setActivePromo(data);
  };

  // Hitung total estimasi harga pesanan saat ini berdasarkan item master dan qty yang diinput
  const calculateTotalOrderValue = (currentQtyMap) => {
    return items.reduce((acc, item) => {
      const qty = Number(currentQtyMap[item.id] || 0);
      const price = Number(item.price || 0);
      return acc + (qty * price);
    }, 0);
  };

  const handleQtyChange = (itemId, val) => {
    const newQty = Number(val) || 0;
    const targetItem = items.find(i => i.id === itemId);
    const itemPrice = Number(targetItem?.price || 0);

    // Simulasi map qty baru
    const simulatedQtyMap = { ...orderQty, [itemId]: newQty };
    const projectedTotal = calculateTotalOrderValue(simulatedQtyMap);

    // Ambil batas maksimal budget dari promo aktif (jika ada)
    const maxBudgetLimit = activePromo ? Number(activePromo.custom_budget || 0) : 0;

    // Validasi Over Budget secara Real-time sebelum submit
    if (maxBudgetLimit > 0 && projectedTotal > maxBudgetLimit) {
      alert(`⚠️ Peringatan: Penambahan kuantiti ini membuat total estimasi pesanan melebihi batas alokasi ${activePromo.budget_type}! Kuantiti dibatasi.`);
      return; // Tolak perubahan jika melewati budget
    }

    setOrderQty(simulatedQtyMap);
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
    
    const { data: orderData, error: orderError } = await supabase
      .from('kl_orders')
      .insert({ 
        branch_id: currentUser.branch_id, 
        promo_id: activePromo ? activePromo.id : null,
        status: 'SUBMITTED' 
      })
      .select()
      .single();

    if (orderError) {
      alert('Gagal submit order: ' + orderError.message);
      setLoading(false);
      return;
    }

    const orderItems = Object.entries(orderQty)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        order_id: orderData.id,
        item_id: itemId,
        qty: qty
      }));

    if (orderItems.length > 0) {
      await supabase.from('kl_order_items').insert(orderItems);
    }
    
    alert('✅ Order Berhasil Disubmit!');
    setOrderQty({});
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Keterangan Promo Aktif & Tampilkan Jenis Budget (Tanpa Nominal Angka Budget) */}
      <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
              Kampanye / Promo Aktif
            </span>
            {activePromo?.budget_type && (
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                Alokasi: {activePromo.budget_type}
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mt-2">{activePromo ? activePromo.title : 'Belum Ada Promo Aktif'}</h3>
          <p className="text-xs opacity-70 mt-1">{activePromo ? activePromo.description : 'Silakan menunggu instruksi admin.'}</p>
        </div>
        <button 
          onClick={submitOrder}
          disabled={loading || !activePromo}
          className={`w-full md:w-auto px-6 py-3.5 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 whitespace-nowrap ${!activePromo ? 'bg-stone-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          {loading ? 'Memproses...' : '🚀 Submit Order Cabang'}
        </button>
      </div>

      {/* Grid Input Order Cabang (Master Data Lengkap, Harga Di-hide, Validasi Budget Aktif) */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h2 className="font-extrabold text-sm mb-4 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">Form Permintaan / Order Logistik Cabang</h2>
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
                        value={orderQty[item.id] || ''}
                        onChange={(e) => handleQtyChange(item.id, e.target.value)}
                        className={`w-24 p-2 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
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