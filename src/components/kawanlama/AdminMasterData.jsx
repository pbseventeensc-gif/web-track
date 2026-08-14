import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

export default function AdminMasterData({ isDarkMode }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item_name: '', material: '', size: '' });

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('kl_master_items')
      .select('*')
      .order('item_name', { ascending: true }); // Diurutkan A-Z
    if (data) setItems(data);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.item_name) return alert('Nama barang wajib diisi!');
    await supabase.from('kl_master_items').insert([form]);
    setForm({ item_name: '', material: '', size: '' });
    fetchItems();
  };

  return (
    <div className="space-y-4">
      <div className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <h3 className="font-bold text-sm mb-3">➕ Tambah Master Barang Baru</h3>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <input type="text" placeholder="Nama Barang" value={form.item_name} onChange={e=>setForm({...form, item_name: e.target.value})} className="p-2.5 border rounded-xl dark:bg-neutral-900" />
          <input type="text" placeholder="Material / Bahan" value={form.material} onChange={e=>setForm({...form, material: e.target.value})} className="p-2.5 border rounded-xl dark:bg-neutral-900" />
          <input type="text" placeholder="Ukuran (Size)" value={form.size} onChange={e=>setForm({...form, size: e.target.value})} className="p-2.5 border rounded-xl dark:bg-neutral-900" />
          <button type="submit" className="bg-blue-600 text-white font-bold rounded-xl py-2.5">Simpan Item</button>
        </form>
      </div>

      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <h3 className="font-bold text-sm mb-3">Daftar Master Data Barang (Urut A-Z)</h3>
        <table className="w-full text-xs">
          <thead className="border-b">
            <tr><th className="p-2 text-left">Nama Barang</th><th className="p-2 text-left">Material</th><th className="p-2 text-left">Ukuran</th></tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id} className="border-b">
                <td className="p-2 font-semibold">{i.item_name}</td>
                <td className="p-2 opacity-80">{i.material || '-'}</td>
                <td className="p-2 opacity-80">{i.size || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}