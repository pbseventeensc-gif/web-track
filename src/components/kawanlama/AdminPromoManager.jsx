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
  Pause,
  Sparkles,
  Tag
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
    <div className="p-6 rounded-3xl shadow-xs space-y-6 border bg-white border-slate-200 text-black">
      {successMessage && (
        <div className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* Form Buat Promo (REMOVED STICKY OVERLAY BUG) */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-slate-50/80 text-slate-900 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-200">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-800">
            Broadcast & Create New Promo Campaign
          </h3>

          {/* FIX GAMBAR 2: CLEAN WHITE BUTTON FOR EDIT BUDGET NAMES */}
          <button 
            type="button"
            onClick={() => setIsEditingBudgetNames(!isEditingBudgetNames)}
            className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            {isEditingBudgetNames ? (
              <><Save className="w-3.5 h-3.5 text-slate-900" /> Save Budget Names & Tiers</>
            ) : (
              <><Pencil className="w-3.5 h-3.5 text-slate-900" /> Edit Budget Names & Tiers</>
            )}
          </button>
        </div>

        <form onSubmit={handleCreatePromo} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1.5 text-slate-800">Promo / Campaign Title</label>
            <input 
              type="text" 
              placeholder="Example: Eid Promotion 2026"
              value={form.title} 
              onChange={e => setForm({...form, title: e.target.value})} 
              className="w-full p-3 border border-slate-200/90 rounded-xl font-semibold bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {isEditingBudgetNames && (
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3">
              <p className="font-extrabold text-[11px] text-amber-800">💡 Modify budget category names and standard nominal values below:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {budgets.map((b, idx) => (
                  <div key={b.key} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Category Name {idx + 1}</label>
                    <input 
                      type="text"
                      value={b.name}
                      onChange={(e) => handleUpdateBudgetDetail(idx, 'name', e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg font-bold bg-white text-black"
                    />
                    <label className="text-[10px] font-bold text-slate-600">Standard Nominal (Rp)</label>
                    <input 
                      type="text"
                      value={b.nominal === 0 ? '' : b.nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        handleUpdateBudgetDetail(idx, 'nominal', raw);
                      }}
                      className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700 bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1.5 text-slate-800">Select Budget Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {budgets.map((b) => (
                <button
                  type="button"
                  key={b.key}
                  onClick={() => handleSelectBudget(b)}
                  className={`py-3 px-3 rounded-xl transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    form.budget_type === b.name 
                      ? 'bg-[#ebf3fe] text-[#2563eb] border border-[#d2e3fc] font-semibold shadow-2xs'
                      : 'bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-100/80 font-medium'
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
            <label className="block font-semibold mb-1.5 text-slate-800">
              Selected Budget ({form.budget_type}) — Rupiah Format: <span className="text-emerald-700 font-mono font-bold">{formatRupiah(form.budget_nominal)}</span>
            </label>
            <input 
              type="text" 
              value={form.budget_nominal === 0 ? '' : form.budget_nominal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} 
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setForm({...form, budget_nominal: Number(raw) || 0});
              }}
              className="w-full p-3 border border-slate-200/90 rounded-xl font-mono font-bold bg-white text-emerald-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block font-semibold text-slate-800">
                Select Special Items for This Promo <span className="text-slate-900 font-bold">({selectedItemIds.length} selected from {masterItems.length} items)</span>
              </label>
              <button
                type="button"
                onClick={handleSelectAllItems}
                className="text-xs font-semibold text-slate-900 hover:underline cursor-pointer"
              >
                {selectedItemIds.length === masterItems.length ? 'Deselect All' : 'Select All Items'}
              </button>
            </div>
            
            <div className="max-h-48 overflow-y-auto border border-slate-200/90 p-3 rounded-xl space-y-2 bg-white custom-scrollbar">
              {masterItems.length === 0 ? (
                <p className="text-xs text-slate-500 font-medium text-center py-2">No master items available yet.</p>
              ) : (
                masterItems.map(item => (
                  <label key={item.id} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedItemIds.includes(item.id) ? 'bg-slate-100 border border-slate-300' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleCheckboxChange(item.id)}
                        className="rounded accent-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-semibold text-slate-900">{item.item_name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono font-medium">
                      {item.material} • {item.size} • {formatRupiah(item.price)}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1.5 text-slate-800">Promo Description / Branch Instructions</label>
            <textarea 
              placeholder="Enter special instructions or notes for branches..."
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})} 
              className="w-full p-3 border border-slate-200/90 rounded-xl bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              rows="3" 
            />
          </div>

          <button type="submit" className="w-full py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-2xl shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer">
            Broadcast Promo to All Branches
          </button>
        </form>
      </div>

      {/* Riwayat Promo Terkirim */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xs">
        <h3 className="font-bold text-sm tracking-wide uppercase text-slate-800 mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-slate-900" /> Broadcast Promo History & Status ({promos.length})
        </h3>

        {promos.length === 0 ? (
          <p className="text-center text-xs text-slate-400 font-medium py-8">No promos have been created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promos.map(p => (
              <div key={p.id} className="p-5 border border-slate-200/90 rounded-2xl flex flex-col justify-between gap-3 text-xs shadow-2xs bg-white hover:border-slate-300 transition-colors">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-extrabold text-sm text-slate-900">{p.title}</span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${p.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {p.is_active ? 'ACTIVE' : 'COMPLETED'}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="px-3 py-1 rounded-xl text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 inline-block">
                      {p.budget_type}: {formatRupiah(p.custom_budget)}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed font-medium">{p.description || 'No description provided.'}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-mono font-medium">
                    Created: {new Date(p.created_at).toLocaleDateString()}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTogglePromoStatus(p.id, p.is_active, p.title)}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-[10px] transition-all active:scale-95 flex items-center gap-1 cursor-pointer border ${
                        p.is_active 
                          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {p.is_active ? <><Check className="w-3.5 h-3.5" /> Complete</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDeletePromo(p.id, p.title)}
                      title="Delete Promo"
                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-700" />
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