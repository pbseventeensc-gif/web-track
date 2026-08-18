import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CustomLabelGenerator({ isDarkMode }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [templateType, setTemplateType] = useState('standard');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('customer_name');
    if (data) setCustomers(data);
  };

  const handlePrint = () => {
    if (!selectedCustomer) return alert('Pilih customer terlebih dahulu!');
    
    // Di sini nanti kita arahkan ke logika cetak berdasarkan templateType
    alert(`Mencetak label untuk ${selectedCustomer} dengan format: ${templateType.toUpperCase()}`);
    // Logika window.print() akan dipanggil di sini setelah kita buat layout cetaknya
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <h2 className="font-black text-lg mb-4 text-indigo-600 dark:text-indigo-400">🏷️ Generator Label & Surat Jalan</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-bold mb-1 opacity-70">Pilih Customer</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          >
            <option value="">-- Pilih Customer --</option>
            {customers.map(c => <option key={c.id} value={c.customer_name}>{c.customer_name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1 opacity-70">Pilih Template Label</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
          >
            <option value="standard">Standard (Umum)</option>
            <option value="premium">Premium (Logo Khusus)</option>
            <option value="compact">Compact (Thermal/Kecil)</option>
          </select>
        </div>
      </div>

      <button 
        onClick={handlePrint}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all"
      >
        🖨️ Generate & Cetak
      </button>
    </div>
  );
}