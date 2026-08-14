import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminPromoManager({ isDarkMode }) {
  const [promos, setPromos] = useState([]);
  
  // State default nominal angka untuk Budget A, B, dan C (bisa diedit langsung oleh admin)
  const [defaultBudgets, setDefaultBudgets] = useState({
    'Budget A': 5000000,
    'Budget B': 3000000,
    'Budget C': 1500000
  });

  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    budget_type: 'Budget A', 
    budget_nominal: 5000000, 
    is_active: true 
  });

  useEffect(() => { fetchPromos(); }, []);

  const fetchPromos = async () => {
    const { data } = await supabase.from('kl_promos').select('*').order('created_at', { ascending: false });
    if (data) setPromos(data);
  };

  const handleTypeSelect = (type) => {
    let nominal = form.budget_nominal;
    if (type !== 'Custom') {
      nominal = defaultBudgets[type] || 0;
    }
    setForm({ ...form, budget_type: type, budget_nominal: nominal });
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    if (!form.title) return alert('Judul promo wajib diisi!');
    
    await supabase.from('kl_promos').insert([{
      title: form.title,
      description: form.description,
      budget_type: form.budget_type,
      custom_budget: Number(form.budget_nominal) || 0,
      is_active: true
    }]);

    setForm({ title: '', description: '', budget_type: 'Budget A', budget_nominal: defaultBudgets['Budget A'], is_active: true });
    fetchPromos();
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  return (
    <div className="space-y-6">
      {/* Form Buat Promo & Pengaturan Nominal Budget A, B, C, Custom */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h3 className="font-extrabold text-sm mb-4 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">📢 Buat & Share Promo / Kampanye Baru</h3>
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

          <div>
            <label className="block font-bold mb-1 opacity-80">Pilih Kategori Budget</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Budget A', 'Budget B', 'Budget C', 'Custom'].map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => handleTypeSelect(type)}
                  className={`py-2.5 px-4 rounded-xl font-bold border transition-all ${form.budget_type === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-stone-50 border-stone-300 text-stone-700'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1 opacity-80">
              Nominal {form.budget_type} (Bisa Diedit / Ubah Angka)
            </label>
            <input 
              type="number" 
              value={form.budget_nominal} 
              onChange={e => {
                const val = Number(e.target.value) || 0;
                setForm({...form, budget_nominal: val});
                if (form.budget_type !== 'Custom') {
                  setDefaultBudgets({...defaultBudgets, [form.budget_type]: val});
                }
              }} 
              className={`w-full p-3 border rounded-xl font-mono font-bold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-emerald-400' : 'bg-stone-50 border-stone-300 text-emerald-600'}`} 
            />
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

      {/* Riwayat Promo Terkirim */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h3 className="font-extrabold text-sm mb-4 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">Riwayat Promo Terkirim</h3>
        <div className="space-y-3">
          {promos.map(p => (
            <div key={p.id} className={`p-4 border rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-stone-50 border-[#E5E0D5]'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{p.title}</span>
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                    {p.budget_type} ({formatRupiah(p.custom_budget)})
                  </span>
                </div>
                <p className="opacity-70 text-[11px] mt-1">{p.description || 'Tidak ada deskripsi.'}</p>
              </div>
              <span className={`px-3 py-1 rounded-xl text-[10px] font-bold ${p.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-stone-200 text-stone-700 dark:bg-neutral-700 dark:text-neutral-400'}`}>
                {p.is_active ? 'AKTIF' : 'SELESAI'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}