import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import PmgExcelImporter from './PmgExcelImporter';
import { Trash2 } from 'lucide-react';

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
    if (!form.client_name || !form.address) return alert('Client name and address are required!');

    setLoading(true);
    const { error } = await supabase.from('pmg_destinations').insert([form]);
    if (!error) {
      setForm({ client_name: '', address: '' });
      fetchDestinations();
    } else {
      alert('Failed to add address: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete address "${name}"?`)) return;
    const { error } = await supabase.from('pmg_destinations').delete().eq('id', id);
    if (!error) fetchDestinations();
    else alert('Failed to delete: ' + error.message);
  };

  return (
    <div className={`p-4 rounded-2xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
      <div>
        <h3 className="font-bold text-xs uppercase text-slate-900 dark:text-white mb-0.5">
          Client Address Master / PMG Destination
        </h3>
        <p className="text-[11px] opacity-70">Manage delivery destination data manually or bulk import.</p>
      </div>

      {/* Import Widget */}
      <PmgExcelImporter isDarkMode={isDarkMode} onImportSuccess={fetchDestinations} />

      <form onSubmit={handleAddDestination} className="space-y-2.5 text-xs pt-1">
        <input 
          type="text"
          placeholder="Client / Company Name (e.g. HO Nestle)"
          value={form.client_name}
          onChange={e => setForm({ ...form, client_name: e.target.value })}
          className={`w-full p-2.5 border rounded-xl font-medium text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
          required
        />
        <textarea 
          placeholder="Full Destination Address..."
          value={form.address}
          onChange={e => setForm({ ...form, address: e.target.value })}
          className={`w-full p-2.5 border rounded-xl font-medium text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
          rows="2"
          required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-2 bg-transparent hover:bg-slate-100 text-slate-800 dark:text-white border border-slate-300 font-semibold rounded-xl text-xs transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          {loading ? 'Saving...' : 'Add Destination Address'}
        </button>
      </form>

      <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
        {destinations.map(d => (
          <div key={d.id} className="p-3 border rounded-xl flex justify-between items-start gap-3 border-slate-200 dark:border-neutral-700">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">{d.client_name}</p>
              <p className="opacity-75 text-[11px] mt-0.5 text-slate-600 dark:text-neutral-300">{d.address}</p>
            </div>
            <button 
              onClick={() => handleDelete(d.id, d.client_name)}
              title="Delete"
              className="text-rose-600 hover:text-rose-700 p-1.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 rounded-lg whitespace-nowrap cursor-pointer transition-all flex items-center justify-center flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}