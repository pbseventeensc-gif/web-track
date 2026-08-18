import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CustomLabelGenerator({ isDarkMode }) {
  const [destinations, setDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState('');
  const [templateType, setTemplateType] = useState('product_identity');

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) {
      const cleanData = data.filter(d => d.client_name && !d.client_name.includes('Kolom'));
      setDestinations(cleanData);
    }
  };

  const handlePrint = () => {
    if (!selectedDest) return alert('Pilih tujuan klien terlebih dahulu!');
    const found = destinations.find(d => String(d.id) === String(selectedDest));
    alert(`Mencetak label PMG untuk: ${found ? found.client_name : ''} dengan format: ${templateType.toUpperCase()}`);
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <h2 className="font-black text-lg mb-4 text-indigo-600 dark:text-indigo-400">🏷️ Generator Label & Surat Jalan PMG</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">
        <div>
          <label className="block font-bold mb-1 opacity-70">Pilih Tujuan Klien PMG</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={selectedDest}
            onChange={(e) => setSelectedDest(e.target.value)}
          >
            <option value="">-- Pilih Tujuan Klien --</option>
            {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-bold mb-1 opacity-70">Pilih Template Label</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
          >
            <option value="product_identity">Product Identity (Gaya Nestlé)</option>
            <option value="hanging_poster">Hanging Poster (Gaya Coca-Cola)</option>
          </select>
        </div>
      </div>

      <button 
        onClick={handlePrint}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs"
      >
        🖨️ Generate & Cetak Label
      </button>
    </div>
  );
}