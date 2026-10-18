import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import PinModal from './PinModal';
import { updateBranchPin } from './PinManager';
import {
  Bell,
  Lock,
  Unlock,
  Clock,
  AlertCircle,
  ArrowUpDown,
  Send
} from 'lucide-react';

export default function BranchOrderForm({ isDarkMode, currentUser }) {
  const [items, setItems] = useState([]);
  const [activePromo, setActivePromo] = useState(null);
  const [existingOrder, setExistingOrder] = useState(null);
  const [hasOrdered, setHasOrdered] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [orderQty, setOrderQty] = useState({});
  const [loading, setLoading] = useState(false);
  
  const [sortOrder, setSortOrder] = useState('asc');

  // State untuk Modal Ubah PIN Mandiri di Sisi Cabang
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Ambil ID cabang yang sedang aktif secara aman
  const currentBranchId = currentUser?.branch_id || currentUser?.id;

  useEffect(() => {
    fetchActivePromo();
  }, [currentUser]);

  // Fungsi untuk memfilter item berdasarkan program promosi aktif atau mengambil semua jika tidak ada item khusus
  const fetchMasterItems = async (activePromoId) => {
    if (activePromoId) {
      const { data: promoItemsData } = await supabase
        .from('kl_promo_items')
        .select('item_id')
        .eq('promo_id', activePromoId);

      if (promoItemsData && promoItemsData.length > 0) {
        const specificItemIds = promoItemsData.map(pi => pi.item_id);
        
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

  // Logika Pengecekan H-3 Batas Waktu
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
      alert(`Peringatan: Penambahan jumlah ini menyebabkan total nilai pesanan melampaui batas alokasi anggaran ${activePromo.budget_type}. Jumlah barang telah dibatasi.`);
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
      alert('Permohonan buka kunci telah dikirim kepada Administrasi Pusat. Mohon menunggu persetujuan.');
      fetchActivePromo();
    } else {
      alert('Gagal mengirim permohonan buka kunci: ' + error.message);
    }
    setLoading(false);
  };

  const submitOrder = async () => {
    if (!currentUser || !currentBranchId) return alert('Silakan masuk menggunakan akun cabang terlebih dahulu.');
    
    const totalOrder = calculateTotalOrderValue(orderQty);
    const maxBudgetLimit = activePromo ? Number(activePromo.custom_budget || 0) : 0;

    if (maxBudgetLimit > 0 && totalOrder > maxBudgetLimit) {
      alert(`Gagal Mengajukan Pesanan: Total nilai pesanan melampaui batas alokasi anggaran ${activePromo.budget_type}. Mohon sesuaikan kembali jumlah barang.`);
      return;
    }

    setLoading(true);
    
    let targetOrderId = existingOrder?.id;

    if (targetOrderId) {
      await supabase.from('kl_orders').update({
        status: 'SUBMITTED',
        lock_status: 'LOCKED',
        project_name: activePromo ? activePromo.title : 'Pesanan Cabang'
      }).eq('id', targetOrderId);

      await supabase.from('kl_order_items').delete().eq('order_id', targetOrderId);
    } else {
      const { data: orderData, error: orderError } = await supabase
        .from('kl_orders')
        .insert({ 
          branch_id: currentBranchId, 
          promo_id: activePromo ? activePromo.id : null,
          project_name: activePromo ? activePromo.title : 'Pesanan Cabang',
          status: 'SUBMITTED',
          lock_status: 'LOCKED'
        })
        .select()
        .single();

      if (orderError) {
        alert('Gagal mengajukan pesanan: ' + orderError.message);
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
    
    alert('Pesanan cabang berhasil diajukan dan disimpan.');
    setLoading(false);
    fetchActivePromo();
  };

  // Handler Ubah PIN Mandiri oleh Cabang
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
      alert("PIN lama yang Anda masukkan tidak sesuai.");
      return;
    }

    const res = await updateBranchPin(currentBranchId, newPin);
    if (res.success) {
      alert("PIN berhasil diperbarui. Silakan gunakan PIN baru untuk sesi masuk berikutnya.");
      setIsPinModalOpen(false);
    } else {
      alert("Gagal memperbarui PIN: " + res.error);
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

  // Warna Indikator Penggunaan Anggaran (Soft Pastel Fill)
  let progressColor = 'bg-emerald-400/80 dark:bg-emerald-500/60'; 
  if (percentage >= 75 && percentage < 100) {
    progressColor = 'bg-amber-400/80 dark:bg-amber-500/60'; 
  } else if (percentage >= 100) {
    progressColor = 'bg-rose-400/80 dark:bg-rose-500/60'; 
  }

  const isDeadlineLocked = isLockedByDeadline(activePromo?.deadline_date);

  return (
    <div className="space-y-6 relative">

      {showNotification && !hasOrdered && activePromo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className={`p-8 rounded-3xl border shadow-2xl max-w-md w-full animate-in fade-in zoom-in ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60 flex items-center justify-center mb-4">
              <Bell className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-base uppercase mb-2 text-indigo-700 dark:text-indigo-300">Pengingat: Pesanan Belum Diajukan</h2>
            <p className="text-xs text-slate-600 dark:text-neutral-300 mb-6 leading-relaxed">
              Yth. Tim Cabang, program promosi aktif <strong>"{activePromo.title}"</strong> sedang berlangsung. Cabang Anda tercatat belum mengajukan pesanan. Mohon segera melengkapi formulir pesanan logistik di bawah ini.
            </p>
            <button 
              onClick={() => setShowNotification(false)}
              className="w-full py-3 bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 font-semibold rounded-2xl shadow-2xs transition-all active:scale-95 text-xs cursor-pointer"
            >
              Saya Mengerti, Lanjutkan ke Formulir
            </button>
          </div>
        </div>
      )}

      {/* Kartu Informasi Program Promosi & Anggaran Aktif */}
      <div className={`sticky top-[105px] z-40 p-6 rounded-3xl border shadow-sm backdrop-blur-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${isDarkMode ? 'bg-neutral-900/95 border-neutral-800 text-white' : 'bg-white/95 border-slate-200/90 text-slate-800'}`}>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60">
              Program Promosi Aktif
            </span>
            {activePromo?.budget_type && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                Alokasi: {activePromo.budget_type}
              </span>
            )}
            {hasOrdered && existingOrder?.lock_status === 'LOCKED' && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-rose-50/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Terkunci (Telah Diajukan)
              </span>
            )}
            {existingOrder?.lock_status === 'REQUEST_UNLOCK' && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> Menunggu Persetujuan Buka Kunci
              </span>
            )}
            {existingOrder?.lock_status === 'UNLOCKED' && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 inline-flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Dibuka oleh Admin (Silakan Perbarui & Ajukan Ulang)
              </span>
            )}
            {isDeadlineLocked && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-xl bg-rose-50/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> H-3 Batas Waktu (Pengajuan Dikunci)
              </span>
            )}
          </div>
          <h3 className="font-bold text-base mt-2">{activePromo ? activePromo.title : 'Belum Ada Program Promosi Aktif'}</h3>
          
          {activePromo && (
            <div className="pt-2 space-y-2 max-w-xl">
              {/* Informasi Perhitungan Anggaran Cabang secara Waktu Nyata */}
              <div className="flex justify-between items-center text-xs font-semibold">
                <span>Penggunaan Anggaran: Rp {currentTotalOrder.toLocaleString('id-ID')}</span>
                <span>Batas Anggaran: Rp {maxBudget.toLocaleString('id-ID')} ({percentage}%)</span>
              </div>

              <div className={`w-full h-3 rounded-full overflow-hidden p-0.5 ${isDarkMode ? 'bg-neutral-950 border border-neutral-800' : 'bg-slate-100 border border-slate-200/80'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
            {hasOrdered && existingOrder?.lock_status === 'LOCKED'
              ? 'Pesanan Anda telah diajukan dan dikunci. Apabila diperlukan perubahan, silakan klik tombol "Ajukan Buka Kunci ke Admin".'
              : (activePromo ? activePromo.description : 'Silakan menunggu instruksi lebih lanjut dari Administrasi Pusat.')}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {hasOrdered && existingOrder?.lock_status === 'LOCKED' && (
            <button 
              onClick={requestUnlock}
              disabled={loading || existingOrder?.lock_status === 'REQUEST_UNLOCK' || isDeadlineLocked}
              className={`px-5 py-3.5 font-semibold rounded-2xl shadow-2xs transition-all active:scale-95 text-xs whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                isDeadlineLocked 
                  ? 'bg-slate-100/80 text-slate-400 border border-slate-200/80 cursor-not-allowed' 
                  : 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60'
              }`}
            >
              {isDeadlineLocked ? <><Lock className="w-3.5 h-3.5" /> Terkunci (H-3 Batas Waktu)</> : <><Unlock className="w-3.5 h-3.5" /> Ajukan Buka Kunci ke Admin</>}
            </button>
          )}

          {!hasOrdered && (
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <button 
                onClick={submitOrder}
                disabled={loading || !activePromo || isDeadlineLocked}
                className={`w-full md:w-auto px-6 py-3.5 font-semibold rounded-2xl shadow-2xs transition-all active:scale-95 whitespace-nowrap text-xs flex items-center justify-center gap-2 cursor-pointer ${
                  !activePromo || isDeadlineLocked 
                    ? 'bg-slate-100/80 text-slate-400 border border-slate-200/80 cursor-not-allowed' 
                    : 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'Memproses...' : (isDeadlineLocked ? 'Pengajuan Dikunci (H-3 Batas Waktu)' : (existingOrder?.lock_status === 'UNLOCKED' ? 'Perbarui & Ajukan Ulang Pesanan' : 'Ajukan Pesanan Cabang'))}</span>
              </button>
              {isDeadlineLocked && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold text-center">
                  Pengajuan pesanan telah dikunci karena memasuki H-3 batas waktu.
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`p-6 rounded-3xl border shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h2 className="font-bold text-sm tracking-wide uppercase text-indigo-700 dark:text-indigo-300">
            {hasOrdered ? 'Formulir Permintaan (Terkunci - Telah Diajukan)' : 'Formulir Pengajuan Pesanan Logistik Cabang'}
          </h2>

          <button
            onClick={toggleSort}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" /> Urutkan Nama Barang: {sortOrder === 'asc' ? 'A ke Z (Naik)' : 'Z ke A (Turun)'}
          </button>
        </div>

        <div className="max-h-[500px] overflow-y-auto relative rounded-2xl border border-slate-200/80 dark:border-neutral-800">
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-10 font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-neutral-900 text-neutral-300 border-b border-neutral-800' : 'bg-slate-50/95 text-slate-600 border-b border-slate-200/80'}`}>
              <tr>
                <th className="p-3.5 text-left">Nama Barang</th>
                <th className="p-3.5 text-left">Material / Bahan</th>
                <th className="p-3.5 text-left">Ukuran</th>
                <th className="p-3.5 text-center w-32">Jumlah Pesanan</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-slate-100'}`}>
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-400">Tidak ada item barang yang tersedia untuk program promosi ini.</td>
                </tr>
              ) : (
                sortedItems.map(item => {
                  const materialStr = item.material || '-';
                  const sizeStr = item.size || '-';

                  return (
                    <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50/70'}>
                      <td className="p-3.5 font-semibold">{item.item_name}</td>
                      <td className="p-3.5 text-slate-600 dark:text-neutral-300 uppercase font-medium">{materialStr}</td>
                      <td className="p-3.5 text-slate-500 dark:text-neutral-400 uppercase font-mono">{sizeStr}</td>
                      <td className="p-3.5 text-center">
                        <input 
                          type="number" 
                          min="0"
                          disabled={hasOrdered || isDeadlineLocked}
                          value={orderQty[item.id] || ''}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          className={`w-24 p-2 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                            hasOrdered || isDeadlineLocked
                              ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800' 
                              : isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'
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
        title="Ubah PIN Mandiri"
        subtitle="Masukkan PIN lama Anda untuk verifikasi, kemudian masukkan 6 digit PIN baru."
        isDarkMode={isDarkMode}
        requireOldPin={true}
      />

    </div>
  );
}