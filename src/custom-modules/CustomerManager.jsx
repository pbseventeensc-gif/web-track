import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Users } from 'lucide-react';

export default function CustomerManager({ isDarkMode }) {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCustomers(data);
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Nama alokasi wajib diisi.');
    
    setLoading(true);
    const { error } = await supabase.from('customers').insert([{ customer_name: name }]);
    
    if (!error) {
      setName('');
      fetchCustomers();
    } else {
      alert('Gagal menambahkan data alokasi: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id, cName) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data alokasi "${cName}"?`)) return;
    
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      fetchCustomers();
    } else {
      alert('Gagal menghapus data alokasi: ' + error.message);
    }
  };

  return (
    <div className={`p-4 rounded-2xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Daftar Alokasi Massal
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola daftar kelompok alokasi distribusi pelanggan.
          </p>
        </div>
        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-slate-100/80 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700">
          {customers.length} Data
        </span>
      </div>
      
      <form onSubmit={handleAddCustomer} className="flex gap-2">
        <input 
          type="text"
          placeholder="Masukkan nama alokasi baru..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`flex-1 p-2.5 border rounded-xl font-medium text-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100 placeholder:text-neutral-500' : 'bg-slate-50/80 border-slate-200/90 text-slate-800 placeholder:text-slate-400'}`}
        />
        <button 
          type="submit" 
          disabled={loading}
          className="px-4 py-2 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold text-xs rounded-xl active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          {loading ? 'Menyimpan...' : 'Tambah'}
        </button>
      </form>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
        {customers.length === 0 ? (
          <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-xs text-slate-400 dark:text-neutral-500">
            Belum ada data alokasi terdaftar.
          </div>
        ) : (
          customers.map(c => (
            <div key={c.id} className="flex justify-between items-center p-2.5 border rounded-xl border-slate-200/80 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/40">
              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{c.customer_name}</span>
              <button 
                onClick={() => handleDelete(c.id, c.customer_name)}
                className="bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold text-[11px] px-2.5 py-1 rounded-lg cursor-pointer transition-all inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Hapus
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}