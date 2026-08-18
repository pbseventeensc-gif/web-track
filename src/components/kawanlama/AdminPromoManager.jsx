import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminPromoManager({ isDarkMode }) {
  const [promos, setPromos] = useState([]);
  const [masterItems, setMasterItems] = useState([]); // Daftar semua master barang
  const [selectedItemIds, setSelectedItemIds] = useState([]); // ID item yang dipilih admin untuk promo ini
  const [successMessage, setSuccessMessage] = useState('');
  
  const [budgets, setBudgets] = useState([
    { key: 'Budget A', name: 'Budget A', nominal: 5000000 },
    { key: 'Budget B', name: 'Budget B', nominal: 3000000 },
    { key: 'Budget C', name: 'Budget C', nominal: 1500000 }
  ]);

  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    budget_type: 'Budget A', 
    budget_nominal: 5000000, 
    is_active: true 
  });

  const [isEditingBudgetNames, setIsEditingBudgetNames] = useState(false);

  useEffect(() => { 
    fetchPromos(); 
    fetchMasterItems();
  }, []);

  const fetchPromos = async () => {
    const { data } = await supabase
      .from('kl_promos')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPromos(data);
  };

  const fetchMasterItems = async () => {
    const { data } = await supabase
      .from('kl_master_items')
      .select('*')
      .order('item_name', { ascending: true });
    if (data) setMasterItems(data);
  };

  const handleSelectBudget = (b) => {
    setForm({ 
      ...form, 
      budget_type: b.name, 
      budget_nominal: b.nominal 
    });
  };

  const handleUpdateBudgetDetail = (index, field, value) => {
    const updated = [...budgets];
    updated[index][field] = field === 'nominal' ? (Number(value) || 0) : value;
    setBudgets(updated);

    if (form.budget_type === updated[index].key || form.budget_type === updated[index].name) {
      setForm({
        ...form,
        budget_type: updated[index].name,
        budget_nominal: updated[index].nominal
      });
    }
  };

  const handleCheckboxChange = (itemId) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllItems = () => {
    if (selectedItemIds.length === masterItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(masterItems.map(i => i.id));
    }
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    if (!form.title) return alert('Judul promo wajib diisi!');
    
    // 1. Simpan promo baru ke kl_promos
    const { data: newPromo, error: promoError } = await supabase.from('kl_promos').insert([{
      title: form.title,
      description: form.description,
      budget_type: form.budget_type,
      custom_budget: Number(form.budget_nominal) || 0,
      is_active: true
    }]).select().single();

    if (promoError) {
      return alert('Gagal broadcast promo: ' + promoError.message);
    }

    // 2. Simpan relasi item terpilih ke kl_promo_items (jika ada yang dicentang)
    if (selectedItemIds.length > 0) {
      const promoItemsPayload = selectedItemIds.map(itemId => ({
        promo_id: newPromo.id,
        item_id: itemId
      }));

      const { error: itemsError } = await supabase.from('kl_promo_items').insert(promoItemsPayload);
      if (itemsError) {
        console.error('Gagal menyimpan item khusus promo:', itemsError.message);
      }
    }

    setSuccessMessage(`🚀 Berhasil! Promo "${form.title}" (${selectedItemIds.length > 0 ? `${selectedItemIds.length} item khusus` : 'semua item'}) telah sukses dibroadcast.`);
    setTimeout(() => setSuccessMessage(''), 5000);

    setForm({ title: '', description: '', budget_type: budgets[0]?.name || 'Budget A', budget_nominal: budgets[0]?.nominal || 0, is_active: true });
    setSelectedItemIds([]);
    fetchPromos();
  };

  // Fungsi Hapus Promo
  const handleDeletePromo = async (promoId, promoTitle) => {
    if (window.confirm(`⚠️ Yakin ingin menghapus promo "${promoTitle}"?\n\nPromo ini akan dihapus dari daftar sistem.`)) {
      const { error } = await supabase
        .from('kl_promos')
        .delete()
        .eq('id', promoId);

      if (!error) {
        setPromos(prev => prev.filter(p => p.id !== promoId));
        setSuccessMessage(`🗑️ Promo "${promoTitle}" berhasil dihapus.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        alert('Gagal menghapus promo: ' + error.message);
      }
    }
  };

  // Fungsi Ubah Status Promo (Aktif / Nonaktif)
  const handleTogglePromoStatus = async (promoId, currentStatus, promoTitle) => {
    const nextStatus = !currentStatus;
    const { error } = await supabase
      .from('kl_promos')
      .update({ is_active: nextStatus })
      .eq('id', promoId);

    if (!error) {
      setPromos(prev => prev.map(p => p.id === promoId ? { ...p, is_active: nextStatus } : p));
      setSuccessMessage(`Status promo "${promoTitle}" berhasil diubah menjadi ${nextStatus ? 'AKTIF' : 'SELESAI'}.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      alert('Gagal update status promo: ' + error.message);
    }
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg animate-bounce ${
          isDarkMode ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-xs font-bold opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Form Buat Promo dengan Header Sticky */}
      <div className={`p-6 rounded-3xl border shadow-sm sticky top-4 z-20 backdrop-blur-md ${isDarkMode ? 'bg-neutral-800/95 border-neutral-700 text-white' : 'bg-white/95 border-[#D8D2C2] text-stone-800'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">📢 Buat & Share Promo / Kampanye Baru</h3>
          <button 
            type="button"
            onClick={() => setIsEditingBudgetNames(!isEditingBudgetNames)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-stone-200 dark:bg-neutral-700 hover:opacity-80 transition-all"
          >
            {isEditingBudgetNames ? '💾 Selesai Edit Nama & Nominal Budget' : '✏️ Edit Nama & Nominal Budget'}
          </button>
        </div>

        <form onSubmit={handleCreatePromo} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1 opacity-80">Judul Promo / Kampanye</label>
            <input 
              type="text" 
              placeholder="Contoh: Promo Lebaran 2026" 
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              className={`w-full p-3 border rounded-xl font-semibold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
            />
          </div>

          {isEditingBudgetNames && (
            <div className={`p-4 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-neutral-900/80 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}>
              <p className="font-bold text-[11px] text-amber-600 dark:text-amber-400">💡 Ubah nama kategori budget dan nominal standarnya di bawah ini:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {budgets.map((b, idx) => (
                  <div key={b.key} className="space-y-1">
                    <label className="text-[10px] opacity-70">Nama Kategori {idx + 1}</label>
                    <input 
                      type="text"
                      value={b.name}
                      onChange={(e) => handleUpdateBudgetDetail(idx, 'name', e.target.value)}
                      className={`w-full p-2 border rounded-lg font-bold ${isDarkMode ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'}`}
                    />
                    <label className="text-[10px] opacity-70">Nominal Standar (Rp)</label>
                    <input 
                      type="text"
                      value={b.nominal === 0 ? '' : b.nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        handleUpdateBudgetDetail(idx, 'nominal', raw);
                      }}
                      className={`w-full p-2 border rounded-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 ${isDarkMode ? 'bg-neutral-800 border-neutral-600' : 'bg-white border-stone-300'}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold mb-1 opacity-80">Pilih Kategori Budget</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {budgets.map((b) => (
                <button
                  type="button"
                  key={b.key}
                  onClick={() => handleSelectBudget(b)}
                  className={`py-3 px-3 rounded-xl font-bold border transition-all text-center flex flex-col items-center justify-center gap-1 ${
                    form.budget_type === b.name 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                      : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-stone-50 border-stone-300 text-stone-700'
                  }`}
                >
                  <span className="font-black">{b.name}</span>
                  <span className="text-[10px] opacity-90 font-mono">
                    {formatRupiah(b.nominal)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 opacity-80">
              Nominal Terpilih ({form.budget_type}) — Format Rupiah: <span className="text-emerald-600 dark:text-emerald-400 font-mono">{formatRupiah(form.budget_nominal)}</span>
            </label>
            <input 
              type="text" 
              value={form.budget_nominal === 0 ? '' : form.budget_nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} 
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setForm({...form, budget_nominal: Number(raw) || 0});
              }}
              className={`w-full p-3 border rounded-xl font-mono font-bold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-emerald-400' : 'bg-stone-50 border-stone-300 text-emerald-600'}`} 
            />
          </div>

          {/* FITUR PILIH ITEM KHUSUS UNTUK CABANG */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block font-bold opacity-80">
                Pilih Item Barang Khusus untuk Promo Ini <span className="text-indigo-600 font-normal">({selectedItemIds.length} dipilih dari {masterItems.length} item)</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllItems}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {selectedItemIds.length === masterItems.length ? 'Batalkan Semua' : 'Pilih Semua Item'}
              </button>
            </div>
            <p className="text-[11px] opacity-60">Jika tidak ada item yang dicentang, cabang akan melihat seluruh katalog master barang secara otomatis.</p>
            
            <div className={`max-h-48 overflow-y-auto border p-3 rounded-xl space-y-2 ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}>
              {masterItems.length === 0 ? (
                <p className="text-xs opacity-60 text-center py-2">Belum ada master barang.</p>
              ) : (
                masterItems.map(item => (
                  <label key={item.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedItemIds.includes(item.id) ? (isDarkMode ? 'bg-indigo-950/50 border border-indigo-800' : 'bg-indigo-50 border border-indigo-200') : (isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-white')}`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleCheckboxChange(item.id)}
                        className="rounded accent-indigo-600 w-4 h-4"
                      />
                      <span className="font-bold">{item.item_name}</span>
                    </div>
                    <div className="text-[10px] opacity-70 font-mono">
                      {item.material} • {item.size} • {formatRupiah(item.price)}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 opacity-80">Deskripsi / Instruksi Promo untuk Cabang</label>
            <textarea 
              placeholder="Tuliskan petunjuk atau catatan khusus untuk cabang..." 
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})} 
              className={`w-full p-3 border rounded-xl focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
              rows="3" 
            />
          </div>

          <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95">
            Broadcast / Share ke Seluruh Cabang 🚀
          </button>
        </form>
      </div>

      {/* Riwayat Promo Terkirim dengan Kontrol Status & Tombol Hapus */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div className={`sticky top-28 z-10 py-3 mb-4 border-b backdrop-blur-md flex justify-between items-center ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white/90 border-stone-200'}`}>
          <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
            📋 Riwayat & Status Promo Terkirim ({promos.length})
          </h3>
        </div>

        {promos.length === 0 ? (
          <p className="text-center text-xs opacity-60 py-8">Belum ada promo yang dibuat.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promos.map(p => (
              <div key={p.id} className={`p-5 border rounded-2xl flex flex-col justify-between gap-3 text-xs shadow-sm transition-all ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700 hover:border-indigo-500' : 'bg-stone-50 border-[#E5E0D5] hover:border-indigo-400'}`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">{p.title}</span>
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black ${p.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-neutral-700 dark:text-neutral-400'}`}>
                      {p.is_active ? 'AKTIF' : 'SELESAI'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="px-3 py-1 rounded-xl text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 inline-block">
                      {p.budget_type}: {formatRupiah(p.custom_budget)}
                    </span>
                  </div>
                  <p className="opacity-75 text-[11px] leading-relaxed">{p.description || 'Tidak ada deskripsi.'}</p>
                </div>

                {/* Footer Card: Waktu Pembuatan & Tombol Aksi */}
                <div className="pt-3 border-t border-stone-200 dark:border-neutral-800 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] opacity-60 font-mono">
                    Dibuat: {new Date(p.created_at).toLocaleDateString()}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTogglePromoStatus(p.id, p.is_active, p.title)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-[10px] transition-all active:scale-95 ${
                        p.is_active 
                          ? 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 dark:text-amber-400' 
                          : 'bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 dark:text-emerald-400'
                      }`}
                    >
                      {p.is_active ? '⏸️ Selesaikan' : '▶️ Aktifkan'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDeletePromo(p.id, p.title)}
                      className="px-2.5 py-1.5 rounded-xl font-bold text-[10px] bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all active:scale-95 flex items-center gap-1"
                    >
                      🗑️ Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}