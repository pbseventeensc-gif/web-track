import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function PmgDestinationManager({ isDarkMode }) {
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState({ client_name: '', address: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) setDestinations(data);
  };

  const handleAddDestination = async (e) => {
    e.preventDefault();
    if (!form.client_name || !form.address) return alert('Nama klien dan alamat wajib diisi!');

    setLoading(true);
    const { error } = await supabase.from('pmg_destinations').insert([form]);
    if (!error) {
      setForm({ client_name: '', address: '' });
      fetchDestinations();
    } else {
      alert('Gagal menambah alamat: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Hapus alamat "${name}"?`)) return;
    const { error } = await supabase.from('pmg_destinations').delete().eq('id', id);
    if (!error) fetchDestinations();
    else alert('Gagal menghapus: ' + error.message);
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <h3 className="font-extrabold text-sm uppercase text-indigo-600 dark:text-indigo-400 mb-2">
        📍 Master Alamat Klien / Tujuan PMG
      </h3>
      <p className="text-xs opacity-60 mb-4">Kelola data tujuan pengiriman (seperti HO Nestlé, Unilever, CCOD, dll.) sesuai format PMG.</p>

      <form onSubmit={handleAddDestination} className="space-y-3 mb-6 text-xs">
        <input 
          type="text"
          placeholder="Nama Klien / Perusahaan (Cth: HO Nestle)"
          value={form.client_name}
          onChange={e => setForm({ ...form, client_name: e.target.value })}
          className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          required
        />
        <textarea 
          placeholder="Alamat Lengkap Tujuan..."
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          rows="2"
          required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95"
        >
          {loading ? 'Menyimpan...' : '➕ Tambah Alamat Tujuan'}
        </button>
      </form>

      <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
        {destinations.map(d => (
          <div key={d.id} className="p-3 border rounded-xl flex justify-between items-start gap-3 dark:border-neutral-700">
            <div>
              <p className="font-bold text-indigo-500">{d.client_name}</p>
              <p className="opacity-75 text-[11px] mt-0.5">{d.address}</p>
            </div>
            <button 
              onClick={() => handleDelete(d.id, d.client_name)}
              className="text-rose-500 hover:text-rose-600 font-bold px-2.5 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-lg whitespace-nowrap"
            >
              Hapus
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}