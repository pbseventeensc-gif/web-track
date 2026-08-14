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

  const handleQtyChange = (itemId, val) => {
    setOrderQty(prev => ({ ...prev, [itemId]: Number(val) }));
  };

  const submitOrder = async () => {
    if (!currentUser) return alert('Silakan login cabang terlebih dahulu');
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
      {/* Keterangan Promo Aktif */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
          Kampanye / Promo Aktif
        </span>
        <h3 className="font-bold text-base mt-2">{activePromo ? activePromo.title : 'Belum Ada Promo Aktif'}</h3>
        <p className="text-xs opacity-70 mt-1">{activePromo ? activePromo.description : 'Silakan menunggu instruksi admin.'}</p>
      </div>

      {/* Grid Input Order Cabang dengan Sticky Header */}
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