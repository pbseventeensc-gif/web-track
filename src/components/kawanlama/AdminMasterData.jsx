import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminMasterData({ isDarkMode }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item_name: '', material: '', size: '', price: '' });

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('kl_master_items')
      .select('*')
      .order('item_name', { ascending: true });
    if (data) setItems(data);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.item_name) return alert('Nama barang wajib diisi!');
    await supabase.from('kl_master_items').insert([{
      item_name: form.item_name,
      material: form.material,
      size: form.size,
      price: Number(form.price) || 0
    }]);
    setForm({ item_name: '', material: '', size: '', price: '' });
    fetchItems();
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  return (
    <div className="space-y-6">
      {/* Form Tambah Master */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h3 className="font-extrabold text-sm mb-4 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">➕ Tambah Master Barang Baru</h3>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <input 
            type="text" 
            placeholder="Nama Barang" 
            value={form.item_name} 
            onChange={e => setForm({...form, item_name: e.target.value})} 
            className={`p-3 border rounded-xl font-semibold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
          />
          <input 
            type="text" 
            placeholder="Material / Bahan" 
            value={form.material} 
            onChange={e => setForm({...form, material: e.target.value})} 
            className={`p-3 border rounded-xl focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
          />
          <input 
            type="text" 
            placeholder="Ukuran (Cth: 59x84 cm)" 
            value={form.size} 
            onChange={e => setForm({...form, size: e.target.value})} 
            className={`p-3 border rounded-xl focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
          />
          <input 
            type="number" 
            placeholder="Harga Satuan (Rp)" 
            value={form.price} 
            onChange={e => setForm({...form, price: e.target.value})} 
            className={`p-3 border rounded-xl focus:outline-none font-mono ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3 transition-all active:scale-95 shadow-sm">
            Simpan Barang
          </button>
        </form>
      </div>

      {/* Tabel Master Data */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h3 className="font-extrabold text-sm mb-4 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">Daftar Master Data Barang (Urut A-Z)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700 text-neutral-300' : 'bg-stone-100 border-stone-300 text-stone-700'}`}>
                <th className="p-3.5 text-left">Nama Barang</th>
                <th className="p-3.5 text-left">Material / Bahan</th>
                <th className="p-3.5 text-left">Ukuran (Size)</th>
                <th className="p-3.5 text-right">Harga Satuan</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
              {items.map(i => (
                <tr key={i.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                  <td className="p-3.5 font-bold">{i.item_name}</td>
                  <td className="p-3.5 opacity-80 uppercase font-medium">{i.material || '-'}</td>
                  <td className="p-3.5 opacity-80 uppercase font-mono">{i.size || '-'}</td>
                  <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatRupiah(i.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}