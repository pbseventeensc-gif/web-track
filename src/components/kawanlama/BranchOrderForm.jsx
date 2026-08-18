import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import PinModal from './PinModal';
import { updateBranchPin } from './PinManager';

export default function BranchOrderForm({ isDarkMode, currentUser }) {
  const [items, setItems] = useState([]);
  const [activePromo, setActivePromo] = useState(null);
  const [existingOrder, setExistingOrder] = useState(null);
  const [hasOrdered, setHasOrdered] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [orderQty, setOrderQty] = useState({});
  const [loading, setLoading] = useState(false);
  
  const [sortOrder, setSortOrder] = useState('asc');

  // State untuk Modal Ganti PIN Mandiri di Sisi Cabang
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Ambil ID cabang yang sedang aktif secara aman
  const currentBranchId = currentUser?.branch_id || currentUser?.id;

  useEffect(() => {
    fetchActivePromo();
  }, [currentUser]);

  // Fungsi untuk memfilter item berdasarkan promo aktif atau mengambil semua jika tidak ada item khusus
  const fetchMasterItems = async (activePromoId) => {
    if (activePromoId) {
      // 1. Cek apakah promo ini punya daftar item khusus di kl_promo_items
      const { data: promoItemsData } = await supabase
        .from('kl_promo_items')
        .select('item_id')
        .eq('promo_id', activePromoId);

      if (promoItemsData && promoItemsData.length > 0) {
        const specificItemIds = promoItemsData.map(pi => pi.item_id);
        
        // Ambil HANYA item yang dipilih admin untuk promo ini
        const { data: filteredItems } = await supabase
          .from('kl_master_items')
          .select('*')
          .in('id', specificItemIds)
          .order('item_name', { ascending: true });

        if (filteredItems) {
          setItems(filteredItems);
          return;
        }
      }
    }

    // 2. Fallback: Jika admin tidak memilih item khusus, tampilkan semua master item
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
      fetchMasterItems(promoData.id);

      if (currentBranchId) {
        const { data: orderData } = await supabase
          .from('kl_orders')
          .select('*, kl_order_items(item_id, qty)')
          .eq('branch_id', currentBranchId)
          .eq('promo_id', promoData.id)
          .maybeSingle();

        if (orderData) {
          setExistingOrder(orderData);
          if (orderData.lock_status === 'UNLOCKED') {
            setHasOrdered(false);
            const qtyMap = {};
            orderData.kl_order_items?.forEach(i => { qtyMap[i.item_id] = i.qty; });
            setOrderQty(qtyMap);
          } else {
            setHasOrdered(true);
            const qtyMap = {};
            orderData.kl_order_items?.forEach(i => { qtyMap[i.item_id] = i.qty; });
            setOrderQty(qtyMap);
          }
        } else {
          setExistingOrder(null);
          setOrderQty({});
          setHasOrdered(false);
          setShowNotification(true);
        }
      }
    } else {
      fetchMasterItems(null);
    }
  };

  // Logika Pengecekan H-3 Deadline
  const isLockedByDeadline = (deadlineDateStr) => {
    if (!deadlineDateStr) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const deadline = new Date(deadlineDateStr);
    deadline.setHours(0, 0, 0, 0);
    
    const diffTime = deadline - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays <= 3;
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
    if (!currentUser || !currentBranchId) return alert('Silakan login cabang terlebih dahulu');
    
    const totalOrder = calculateTotalOrderValue(orderQty);
    const maxBudgetLimit = activePromo ? Number(activePromo.custom_budget || 0) : 0;

    if (maxBudgetLimit > 0 && totalOrder > maxBudgetLimit) {
      alert(`❌ Gagal Submit: Total nilai pesanan melewati batas alokasi ${activePromo.budget_type}! Mohon kurangi kuantiti barang.`);
      return;
    }

    setLoading(true);
    
    let targetOrderId = existingOrder?.id;

    if (targetOrderId) {
      await supabase.from('kl_orders').update({
        status: 'SUBMITTED',
        lock_status: 'LOCKED',
        project_name: activePromo ? activePromo.title : 'Order Cabang'
      }).eq('id', targetOrderId);

      await supabase.from('kl_order_items').delete().eq('order_id', targetOrderId);
    } else {
      const { data: orderData, error: orderError } = await supabase
        .from('kl_orders')
        .insert({ 
          branch_id: currentBranchId, 
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

  // Handler Ganti PIN Mandiri oleh Cabang
  const handleBranchChangePinSubmit = async ({ oldPin, newPin }) => {
    if (!currentBranchId) {
      alert("ID Cabang tidak valid.");
      return;
    }

    const { data: branchData, error: fetchErr } = await supabase
      .from('kl_branches')
      .select('pin_code')
      .eq('id', currentBranchId)
      .single();

    if (fetchErr || !branchData || String(branchData.pin_code) !== String(oldPin)) {
      alert("❌ PIN Lama yang Anda masukkan salah!");
      return;
    }

    const res = await updateBranchPin(currentBranchId, newPin);
    if (res.success) {
      alert("✅ PIN Berhasil diubah! Silakan gunakan PIN baru untuk sesi login berikutnya.");
      setIsPinModalOpen(false);
    } else {
      alert("❌ Gagal memperbarui PIN: " + res.error);
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const nameA = (a.item_name || '').toLowerCase();
    const nameB = (b.item_name || '').toLowerCase();
    if (sortOrder === 'asc') {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });

  const toggleSort = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const currentTotalOrder = calculateTotalOrderValue(orderQty);
  const maxBudget = activePromo ? Number(activePromo.custom_budget || 0) : 0;
  const percentage = maxBudget > 0 ? Math.min(Math.round((currentTotalOrder / maxBudget) * 100), 100) : 0;

  let progressColor = 'bg-emerald-500'; 
  if (percentage > 50 && percentage <= 90) {
    progressColor = 'bg-amber-500'; 
  } else if (percentage > 90) {
    progressColor = 'bg-orange-500'; 
  }

  const isDeadlineLocked = isLockedByDeadline(activePromo?.deadline_date);

  return (
    <div className="space-y-6 relative">
      
      {/* Tombol Akses Cepat Ganti PIN di Sudut Kanan Atas Portal Cabang */}
      <div className="flex justify-end">
        <button
          onClick={() => setIsPinModalOpen(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          🔒 Ganti PIN Mandiri
        </button>
      </div>

      {showNotification && !hasOrdered && activePromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`p-8 rounded-3xl border shadow-2xl max-w-md w-full animate-in fade-in zoom-in ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
            <div className="text-4xl mb-3">📢</div>
            <h2 className="font-black text-base uppercase mb-2 text-indigo-600 dark:text-indigo-400">Pengingat: Order Belum Disubmit!</h2>
            <p className="text-xs opacity-80 mb-6 leading-relaxed">
              Halo Cabang, kampanye atau promo aktif <strong>"{activePromo.title}"</strong> sedang berjalan. Anda belum melakukan submit order. Mohon segera isi formulir pesanan logistik Anda.
            </p>
            <button 
              onClick={() => setShowNotification(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 text-xs"
            >
              Saya Mengerti, Lanjutkan ke Form
            </button>
          </div>
        </div>
      )}

      <div className={`p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div className="space-y-2 flex-1">
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
            {isDeadlineLocked && (
              <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300">
                ⚠️ H-3 Deadline (Lempar Pusat Dikunci)
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mt-2">{activePromo ? activePromo.title : 'Belum Ada Promo Aktif'}</h3>
          
          {activePromo && (
            <div className="pt-2 space-y-1.5 max-w-xl">
              <div className={`w-full h-3 rounded-full overflow-hidden p-0.5 ${isDarkMode ? 'bg-neutral-900 border border-neutral-700' : 'bg-stone-200 border border-stone-300'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          )}

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
              disabled={loading || existingOrder?.lock_status === 'REQUEST_UNLOCK' || isDeadlineLocked}
              className={`px-5 py-3.5 font-bold rounded-2xl shadow-md transition-all active:scale-95 text-xs whitespace-nowrap ${
                isDeadlineLocked 
                  ? 'bg-stone-400 cursor-not-allowed text-white' 
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {isDeadlineLocked ? '🔒 Terkunci (H-3 Deadline)' : '🔑 Minta Buka Kunci ke Admin'}
            </button>
          )}

          {!hasOrdered && (
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <button 
                onClick={submitOrder}
                disabled={loading || !activePromo || isDeadlineLocked}
                className={`w-full md:w-auto px-6 py-3.5 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 whitespace-nowrap ${
                  !activePromo || isDeadlineLocked 
                    ? 'bg-stone-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {loading ? 'Memproses...' : (isDeadlineLocked ? '🔒 Lempar Pusat Dikunci (H-3 Deadline)' : (existingOrder?.lock_status === 'UNLOCKED' ? '🔄 Resubmit / Perbarui Order' : '🚀 Submit Order Cabang'))}
              </button>
              {isDeadlineLocked && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold text-center">
                  ⚠️ Pengiriman/lempar pusat telah dikunci karena memasuki H-3 deadline.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h2 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
            {hasOrdered ? 'Form Permintaan (Terkunci - Telah Disubmit)' : 'Form Permintaan / Order Logistik Cabang'}
          </h2>

          <button
            onClick={toggleSort}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
              isDarkMode 
                ? 'bg-neutral-700 border-neutral-600 text-neutral-200 hover:bg-neutral-600' 
                : 'bg-stone-100 border-stone-300 text-stone-700 hover:bg-stone-200'
            }`}
          >
            🔤 Urutkan Nama: {sortOrder === 'asc' ? 'A → Z (Naik)' : 'Z → A (Turun)'}
          </button>
        </div>

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
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center opacity-60">Tidak ada item barang tersedia untuk promo ini.</td>
                </tr>
              ) : (
                sortedItems.map(item => {
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
                          disabled={hasOrdered || isDeadlineLocked}
                          value={orderQty[item.id] || ''}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          className={`w-24 p-2 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            hasOrdered || isDeadlineLocked
                              ? 'opacity-50 cursor-not-allowed bg-stone-200 dark:bg-neutral-900' 
                              : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'
                          }`}
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PinModal 
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSubmit={handleBranchChangePinSubmit}
        title="Ganti PIN Mandiri"
        subtitle="Masukkan PIN lama Anda untuk verifikasi, lalu masukkan 6 digit PIN baru."
        isDarkMode={isDarkMode}
        requireOldPin={true}
      />

    </div>
  );
}