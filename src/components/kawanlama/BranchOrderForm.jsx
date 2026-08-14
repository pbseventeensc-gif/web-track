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
    const { data } = await supabase.from('kl_master_items').select('*');
    if (data) setItems(data);
  };

  const fetchActivePromo = async () => {
    // Mengambil promo aktif terbaru yang dibagikan admin
    const { data } = await supabase
      .from('kl_promos')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) setActivePromo(data);
  };

  const handleQtyChange = (itemId, val) => {
    setOrderQty(prev => ({ ...prev, [itemId]: Number(val) }));
  };

  const submitOrder = async () => {
    if (!currentUser) return alert('Silakan login cabang terlebih dahulu');
    setLoading(true);
    
    // Create Header Order
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

    // Create Order Items (Hanya Item Name, Material, Size, Qty)
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
    <div className="space-y-4">
      {/* INFO PROMO & BUDGET (Tanpa Nominal Budget) */}
      <div className={`p-5 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800">Kampanye / Promo Aktif</span>
          <h3 className="font-bold text-base mt-2">{activePromo ? activePromo.title : 'Belum Ada Promo Aktif'}</h3>
          <p className="text-xs opacity-70 mt-0.5">{activePromo ? activePromo.description : 'Silakan menunggu instruksi admin.'}</p>
        </div>
        <div className={`px-4 py-3 rounded-2xl border text-center ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-[#E5E0D5]'}`}>
          <div className="text-[10px] font-bold opacity-60 uppercase">Status Alokasi Budget Cabang</div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">🔒 Alokasi Tersedia (Valid)</div>
        </div>
      </div>

      {/* GRID INPUT ORDER (Tanpa Harga, Hanya Item, Material, Size, Qty) */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <h2 className="font-bold text-sm mb-4">Form Permintaan / Order Logistik Cabang</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className={`border-b ${isDarkMode ? 'border-neutral-700 text-neutral-300' : 'border-stone-200 text-stone-700'}`}>
              <tr>
                <th className="p-3 text-left">Nama Barang (Item Name)</th>
                <th className="p-3 text-left">Material / Bahan</th>
                <th className="p-3 text-left">Ukuran (Size)</th>
                <th className="p-3 text-center w-32">Qty Order</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700' : 'divide-stone-100'}`}>
              {items.map(item => (
                <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-700/40' : 'hover:bg-stone-50'}>
                  <td className="p-3 font-semibold">{item.item_name}</td>
                  <td className="p-3 opacity-80">{item.material || 'Standard'}</td>
                  <td className="p-3 opacity-80">{item.size || '-'}</td>
                  <td className="p-3 text-center">
                    <input 
                      type="number" 
                      min="0"
                      value={orderQty[item.id] || ''}
                      onChange={(e) => handleQtyChange(item.id, e.target.value)}
                      className={`w-24 p-2 border rounded-xl text-center font-bold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
                      placeholder="0"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button 
          onClick={submitOrder}
          disabled={loading || !activePromo}
          className={`mt-6 w-full py-3.5 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 ${!activePromo ? 'bg-stone-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          {loading ? 'Memproses...' : '🚀 Submit Order Cabang'}
        </button>
      </div>
    </div>
  );
}