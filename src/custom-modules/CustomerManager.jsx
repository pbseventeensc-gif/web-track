import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient'; // Pastikan path ke supabaseClient benar

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
    if (!name.trim()) return alert('Nama customer wajib diisi!');
    
    setLoading(true);
    const { error } = await supabase.from('customers').insert([{ customer_name: name }]);
    
    if (!error) {
      setName('');
      fetchCustomers();
    } else {
      alert('Gagal menambah customer: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id, cName) => {
    if (!window.confirm(`Yakin ingin menghapus ${cName}?`)) return;
    
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      fetchCustomers();
    } else {
      alert('Gagal menghapus: ' + error.message);
    }
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <h2 className="font-black text-lg mb-4 text-indigo-600 dark:text-indigo-400">👥 Manajemen Customer</h2>
      
      <form onSubmit={handleAddCustomer} className="flex gap-2 mb-6">
        <input 
          type="text"
          placeholder="Nama Customer Baru..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`flex-1 p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
        />
        <button 
          type="submit" 
          disabled={loading}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl active:scale-95 transition-all"
        >
          {loading ? '...' : 'Tambah'}
        </button>
      </form>

      <div className="space-y-2">
        {customers.map(c => (
          <div key={c.id} className="flex justify-between items-center p-3 border rounded-xl dark:border-neutral-700">
            <span className="font-bold text-sm">{c.customer_name}</span>
            <button 
              onClick={() => handleDelete(c.id, c.customer_name)}
              className="text-rose-500 hover:text-rose-600 font-bold text-xs px-3 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-lg"
            >
              Hapus
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}