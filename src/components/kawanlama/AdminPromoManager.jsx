import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminPromoManager({ isDarkMode }) {
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', is_active: true });

  useEffect(() => { fetchPromos(); }, []);

  const fetchPromos = async () => {
    const { data } = await supabase.from('kl_promos').select('*').order('created_at', { ascending: false });
    if (data) setPromos(data);
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    if (!form.title) return alert('Judul promo wajib diisi!');
    await supabase.from('kl_promos').insert([form]);
    setForm({ title: '', description: '', is_active: true });
    fetchPromos();
  };

  return (
    <div className="space-y-4">
      <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <h3 className="font-bold text-sm mb-3">📢 Buat & Share Promo / Kampanye Baru</h3>
        <form onSubmit={handleCreatePromo} className="space-y-3 text-xs">
          <input type="text" placeholder="Judul Promo (Contoh: Promo Lebaran 2026)" value={form.title} onChange={e=>setForm({...form, title: e.target.value})} className="w-full p-2.5 border rounded-xl dark:bg-neutral-900" />
          <textarea placeholder="Deskripsi / Instruksi Promo untuk Cabang" value={form.description} onChange={e=>setForm({...form, description: e.target.value})} className="w-full p-2.5 border rounded-xl dark:bg-neutral-900" rows="3" />
          <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl">Broadcast / Share ke Seluruh Cabang 🚀</button>
        </form>
      </div>

      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <h3 className="font-bold text-sm mb-3">Riwayat Promo Terkirim</h3>
        <div className="space-y-2">
          {promos.map(p => (
            <div key={p.id} className="p-3 border rounded-xl flex justify-between items-center text-xs">
              <div>
                <strong>{p.title}</strong>
                <p className="opacity-70 text-[10px]">{p.description}</p>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-700'}`}>
                {p.is_active ? 'AKTIF' : 'SELESAI'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}