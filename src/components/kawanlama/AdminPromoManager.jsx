import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Megaphone,
  Pencil,
  Save,
  Trash2,
  Send,
  Check,
  Play,
  Tag,
  X
} from 'lucide-react';

export default function AdminPromoManager({ isDarkMode }) {
  const [promos, setPromos] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
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
      .select('id, title, budget_type, budget_nominal, is_active, created_at')
      .order('created_at', { ascending: false });
    if (data) setPromos(data);
  };

  const fetchMasterItems = async () => {
    const { data } = await supabase
      .from('kl_master_items')
      .select('id, item_code, item_name, unit, default_price')
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
    if (!form.title) return alert('Judul program promosi wajib diisi.');
    
    const { data: newPromo, error: promoError } = await supabase.from('kl_promos').insert([{
      title: form.title,
      description: form.description,
      budget_type: form.budget_type,
      custom_budget: Number(form.budget_nominal) || 0,
      is_active: true
    }]).select().single();

    if (promoError) {
      return alert('Gagal menyiarkan program promosi: ' + promoError.message);
    }

    if (selectedItemIds.length > 0) {
      const promoItemsPayload = selectedItemIds.map(itemId => ({
        promo_id: newPromo.id,
        item_id: itemId
      }));

      const { error: itemsError } = await supabase.from('kl_promo_items').insert(promoItemsPayload);
      if (itemsError) {
        console.error('Gagal menyimpan item khusus promosi:', itemsError.message);
      }
    }

    setSuccessMessage(`Program promosi "${form.title}" (${selectedItemIds.length > 0 ? `${selectedItemIds.length} item khusus` : 'seluruh item'}) telah berhasil disiarkan ke seluruh cabang.`);
    setTimeout(() => setSuccessMessage(''), 5000);

    setForm({ title: '', description: '', budget_type: budgets[0]?.name || 'Budget A', budget_nominal: budgets[0]?.nominal || 0, is_active: true });
    setSelectedItemIds([]);
    fetchPromos();
  };

  const handleDeletePromo = async (promoId, promoTitle) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus program promosi "${promoTitle}"?\n\nProgram promosi ini akan dihapus dari daftar sistem.`)) {
      const { error } = await supabase
        .from('kl_promos')
        .delete()
        .eq('id', promoId);

      if (!error) {
        setPromos(prev => prev.filter(p => p.id !== promoId));
        setSuccessMessage(`Program promosi "${promoTitle}" berhasil dihapus.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        alert('Gagal menghapus program promosi: ' + error.message);
      }
    }
  };

  const handleTogglePromoStatus = async (promoId, currentStatus, promoTitle) => {
    const nextStatus = !currentStatus;
    const { error } = await supabase
      .from('kl_promos')
      .update({ is_active: nextStatus })
      .eq('id', promoId);

    if (!error) {
      setPromos(prev => prev.map(p => p.id === promoId ? { ...p, is_active: nextStatus } : p));
      setSuccessMessage(`Status program promosi "${promoTitle}" berhasil diubah menjadi ${nextStatus ? 'AKTIF' : 'SELESAI'}.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      alert('Gagal memperbarui status program promosi: ' + error.message);
    }
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  return (
    <div className={`p-6 rounded-3xl shadow-2xs space-y-6 border ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="p-1 rounded-lg hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Formulir Buat Program Promosi */}
      <div className={`p-6 rounded-3xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700 text-white' : 'bg-slate-50/80 border-slate-200/90 text-slate-900'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200/80 dark:border-neutral-700">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Buat & Siarkan Program Promosi Baru
          </h3>

          <button 
            type="button"
            onClick={() => setIsEditingBudgetNames(!isEditingBudgetNames)}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            {isEditingBudgetNames ? (
              <><Save className="w-3.5 h-3.5" /> Simpan Kategori & Nominal Anggaran</>
            ) : (
              <><Pencil className="w-3.5 h-3.5" /> Ubah Kategori & Nominal Anggaran</>
            )}
          </button>
        </div>

        <form onSubmit={handleCreatePromo} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1.5 text-slate-800 dark:text-neutral-200">Judul Program Promosi / Kampanye</label>
            <input 
              type="text" 
              placeholder="Contoh: Program Promosi Idulfitri 2026"
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              className={`w-full p-3 border rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500' : 'bg-white border-slate-200/90 text-slate-900 placeholder:text-slate-400'}`}
            />
          </div>

          {isEditingBudgetNames && (
            <div className="p-4 rounded-2xl bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 space-y-3">
              <p className="font-bold text-[11px]">Sesuaikan nama kategori anggaran dan nilai nominal standar di bawah ini:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {budgets.map((b, idx) => (
                  <div key={b.key} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600 dark:text-neutral-300">Nama Kategori {idx + 1}</label>
                    <input 
                      type="text"
                      value={b.name}
                      onChange={(e) => handleUpdateBudgetDetail(idx, 'name', e.target.value)}
                      className={`w-full p-2 border rounded-lg font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                    />
                    <label className="text-[10px] font-bold text-slate-600 dark:text-neutral-300">Nominal Standar (Rp)</label>
                    <input 
                      type="text"
                      value={b.nominal === 0 ? '' : b.nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        handleUpdateBudgetDetail(idx, 'nominal', raw);
                      }}
                      className={`w-full p-2 border rounded-lg font-mono font-bold text-emerald-700 dark:text-emerald-400 ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-300'}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1.5 text-slate-800 dark:text-neutral-200">Pilih Kategori Anggaran</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {budgets.map((b) => (
                <button
                  type="button"
                  key={b.key}
                  onClick={() => handleSelectBudget(b)}
                  className={`py-3 px-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    form.budget_type === b.name 
                      ? 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold shadow-2xs'
                      : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 font-medium'
                  }`}
                >
                  <span className="font-semibold text-xs">{b.name}</span>
                  <span className="text-[10px] opacity-90 font-mono">
                    {formatRupiah(b.nominal)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1.5 text-slate-800 dark:text-neutral-200">
              Anggaran Terpilih ({form.budget_type}) — Nilai Rupiah: <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{formatRupiah(form.budget_nominal)}</span>
            </label>
            <input 
              type="text" 
              value={form.budget_nominal === 0 ? '' : form.budget_nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} 
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setForm({...form, budget_nominal: Number(raw) || 0});
              }}
              className={`w-full p-3 border rounded-xl font-mono font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-200/90'}`}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block font-semibold text-slate-800 dark:text-neutral-200">
                Pilih Item Khusus untuk Program Promosi Ini <span className="text-indigo-700 dark:text-indigo-300 font-bold">({selectedItemIds.length} dipilih dari {masterItems.length} item)</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllItems}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {selectedItemIds.length === masterItems.length ? 'Batalkan Semua Pilihan' : 'Pilih Semua Item'}
              </button>
            </div>
            
            <div className={`max-h-48 overflow-y-auto border p-3 rounded-xl space-y-2 custom-scrollbar ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-200/90'}`}>
              {masterItems.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium text-center py-2">Belum ada item master yang tersedia.</p>
              ) : (
                masterItems.map(item => (
                  <label key={item.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedItemIds.includes(item.id) 
                      ? 'bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60' 
                      : (isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-slate-50')
                  }`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleCheckboxChange(item.id)}
                        className="rounded accent-blue-600 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-900 dark:text-white">{item.item_name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono font-medium">
                      {item.material} • {item.size} • {formatRupiah(item.price)}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1.5 text-slate-800 dark:text-neutral-200">Deskripsi Program Promosi / Instruksi Cabang</label>
            <textarea 
              placeholder="Tuliskan instruksi khusus atau catatan pengajuan untuk cabang..."
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})} 
              className={`w-full p-3 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white placeholder:text-neutral-500' : 'bg-white border-slate-200/90 text-slate-900 placeholder:text-slate-400'}`}
              rows="3" 
            />
          </div>

          <button 
            type="submit" 
            className="w-full py-3.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-bold rounded-2xl shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" /> Siarkan Program Promosi ke Seluruh Cabang
          </button>
        </form>
      </div>

      {/* Riwayat Program Promosi Terkirim */}
      <div className={`p-6 rounded-3xl border shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>
        <h3 className="font-bold text-sm tracking-wide uppercase text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Riwayat & Status Program Promosi ({promos.length})
        </h3>

        {promos.length === 0 ? (
          <p className="text-center text-xs text-slate-400 font-medium py-8">Belum ada program promosi yang dibuat.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promos.map(p => (
              <div key={p.id} className={`p-5 border rounded-2xl flex flex-col justify-between gap-3 text-xs shadow-2xs transition-colors ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700 hover:border-neutral-600' : 'bg-white border-slate-200/90 hover:border-slate-300'}`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{p.title}</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      p.is_active 
                        ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60' 
                        : 'bg-slate-100/80 text-slate-700 border-slate-200/80 dark:bg-neutral-800 dark:text-slate-200 dark:border-neutral-700'
                    }`}>
                      {p.is_active ? 'AKTIF' : 'SELESAI'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="px-3 py-1 rounded-xl text-[10px] font-bold bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60 inline-block">
                      {p.budget_type}: {formatRupiah(p.custom_budget)}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-neutral-300 text-[11px] leading-relaxed font-medium">{p.description || 'Tidak ada deskripsi tambahan.'}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-neutral-700/70 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-mono font-medium">
                    Dibuat: {new Date(p.created_at).toLocaleDateString('id-ID')}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTogglePromoStatus(p.id, p.is_active, p.title)}
                      className={`px-3 py-1.5 rounded-xl font-semibold text-[11px] transition-all active:scale-95 flex items-center gap-1 cursor-pointer border ${
                        p.is_active 
                          ? 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60'
                          : 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60'
                      }`}
                    >
                      {p.is_active ? <><Check className="w-3.5 h-3.5" /> Tandai Selesai</> : <><Play className="w-3.5 h-3.5" /> Aktifkan Kembali</>}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDeletePromo(p.id, p.title)}
                      title="Hapus Program Promosi"
                      className="p-1.5 rounded-xl bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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