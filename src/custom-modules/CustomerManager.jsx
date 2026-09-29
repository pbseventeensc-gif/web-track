import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

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
    if (!name.trim()) return alert('Allocation name is required!');
    
    setLoading(true);
    const { error } = await supabase.from('customers').insert([{ customer_name: name }]);
    
    if (!error) {
      setName('');
      fetchCustomers();
    } else {
      alert('Failed to add allocation: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id, cName) => {
    if (!window.confirm(`Are you sure you want to delete ${cName}?`)) return;
    
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) {
      fetchCustomers();
    } else {
      alert('Failed to delete: ' + error.message);
    }
  };

  return (
    <div className={`p-4 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <h2 className="font-bold text-xs uppercase mb-3 text-black dark:text-white">BULK ALLOCATION</h2>
      
      <form onSubmit={handleAddCustomer} className="flex gap-2 mb-4">
        <input 
          type="text"
          placeholder="New Bulk Allocation Name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`flex-1 p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
        />
        <button 
          type="submit" 
          disabled={loading}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
        >
          {loading ? '...' : 'Add'}
        </button>
      </form>

      <div className="space-y-2">
        {customers.map(c => (
          <div key={c.id} className="flex justify-between items-center p-2.5 border rounded-xl dark:border-neutral-700">
            <span className="font-semibold text-xs text-black dark:text-white">{c.customer_name}</span>
            <button 
              onClick={() => handleDelete(c.id, c.customer_name)}
              className="text-rose-500 hover:text-rose-600 font-bold text-[11px] px-2.5 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-lg cursor-pointer"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}