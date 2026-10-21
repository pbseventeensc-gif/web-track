import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import PmgExcelImporter from './PmgExcelImporter';
import { Trash2, MapPin, Plus } from 'lucide-react';

export default function PmgDestinationManager({ isDarkMode }) {
  const [destinations, setDestinations] = useState([]);
  const [form, setForm] = useState({ client_name: '', address: '', pic_name: '', phone: '' });
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
    if (!form.client_name || !form.address) return alert('Nama klien dan alamat tujuan wajib diisi.');

    setLoading(true);
    const payload = {
      client_name: form.client_name.trim(),
      address: form.address.trim()
    };
    const { error } = await supabase.from('pmg_destinations').insert([payload]);
    if (!error) {
      setForm({ client_name: '', address: '', pic_name: '', phone: '' });
      fetchDestinations();
    } else {
      alert('Gagal menambahkan alamat tujuan: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus alamat tujuan "${name}"?`)) return;
    const { error } = await supabase.from('pmg_destinations').delete().eq('id', id);
    if (!error) fetchDestinations();
    else alert('Gagal menghapus alamat tujuan: ' + error.message);
  };

  return (
    <div className={`p-4 rounded-2xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
      <div>
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-0.5 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Data Master Alamat Klien & Tujuan
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Kelola daftar alamat tujuan pengiriman secara manual atau melalui impor massal.
        </p>
      </div>

      {/* Import Widget */}
      <PmgExcelImporter isDarkMode={isDarkMode} onImportSuccess={fetchDestinations} />

      <form onSubmit={handleAddDestination} className="space-y-2.5 text-xs pt-1">
        <input 
          type="text"
          placeholder="Nama Klien / Perusahaan (contoh: HO Nestle)"
          value={form.client_name}
          onChange={e => setForm({ ...form, client_name: e.target.value })}
          className={`w-full p-2.5 border rounded-xl font-medium text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100 placeholder:text-neutral-500' : 'bg-slate-50/80 border-slate-200/90 text-slate-800 placeholder:text-slate-400'}`}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Nama PIC / Penerima"
            value={form.pic_name}
            onChange={e => setForm({ ...form, pic_name: e.target.value })}
            className={`w-full p-2.5 border rounded-xl font-medium text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100 placeholder:text-neutral-500' : 'bg-slate-50/80 border-slate-200/90 text-slate-800 placeholder:text-slate-400'}`}
          />
          <input
            type="text"
            placeholder="Nomor Telepon / No HP"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            className={`w-full p-2.5 border rounded-xl font-medium text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100 placeholder:text-neutral-500' : 'bg-slate-50/80 border-slate-200/90 text-slate-800 placeholder:text-slate-400'}`}
          />
        </div>
        <textarea
          placeholder="Alamat lengkap tujuan pengiriman..."
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          className={`w-full p-2.5 border rounded-xl font-medium text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100 placeholder:text-neutral-500' : 'bg-slate-50/80 border-slate-200/90 text-slate-800 placeholder:text-slate-400'}`}
          rows="2"
          required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-2.5 px-3 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-2xs inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {loading ? 'Menyimpan...' : 'Tambah Alamat Tujuan'}
        </button>
      </form>

      <div className="max-h-60 overflow-y-auto space-y-2 text-xs pr-0.5">
        {destinations.map(d => (
          <div key={d.id} className="p-3 border rounded-xl flex justify-between items-start gap-3 border-slate-200/80 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/40">
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">{d.client_name}</p>
              <p className="text-[11px] mt-0.5 text-slate-600 dark:text-slate-400">{d.address}</p>
              <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                {(d.pic_name || d.pic) && <span>👤 PIC: {d.pic_name || d.pic}</span>}
                {d.phone && <span>📞 Telp: {d.phone}</span>}
              </div>
            </div>
            <button 
              onClick={() => handleDelete(d.id, d.client_name)}
              title="Hapus Alamat"
              className="bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 p-1.5 rounded-lg whitespace-nowrap cursor-pointer transition-all flex items-center justify-center flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}