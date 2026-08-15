import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import * as XLSX from 'xlsx'; // Import pustaka xlsx untuk baca file excel

export default function AdminMasterData({ isDarkMode }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item_name: '', material: '', size: '', price: '' });
  const [loadingImport, setLoadingImport] = useState(false);

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

  // FUNGSI IMPORT EXCEL
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingImport(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert('File Excel kosong atau format tidak sesuai!');
          setLoadingImport(false);
          return;
        }

        // Mapping data dari Excel ke struktur tabel Supabase
        // Sesuaikan nama kolom Excel Anda: item_name / nama_barang, material, size / ukuran, price / harga
        const formattedItems = data.map(row => ({
          item_name: row.item_name || row.nama_barang || row['Nama Barang'] || 'Barang Baru',
          material: row.material || row['Material'] || '-',
          size: row.size || row.ukuran || row['Ukuran'] || '-',
          price: Number(row.price || row.harga || row['Harga'] || 0)
        }));

        // Masukkan data secara massal (bulk insert) ke Supabase
        const { error } = await supabase.from('kl_master_items').insert(formattedItems);

        if (error) {
          alert('Gagal mengimpor data ke database: ' + error.message);
        } else {
          alert(`✅ Berhasil mengimpor ${formattedItems.length} data barang baru!`);
          fetchItems(); // Refresh data agar langsung tampil dan terurut A-Z
        }
      } catch (err) {
        alert('Terjadi kesalahan saat membaca file Excel: ' + err.message);
      } finally {
        setLoadingImport(false);
        e.target.value = null; // Reset input file
      }
    };

    reader.readAsBinaryString(file);
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  return (
    <div className="space-y-6">
      
      {/* Panel Atas: Form Tambah Satuan & Import Excel */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        
        {/* Bagian Import Excel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-stone-200 dark:border-neutral-700">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">📊 Import Master Barang via Excel</h3>
            <p className="text-xs opacity-70 mt-0.5">Unggah file `.xlsx` atau `.xls` dengan kolom: <code className="font-mono text-indigo-500">item_name, material, size, price</code></p>
          </div>

          <label className={`cursor-pointer px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 ${loadingImport ? 'bg-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
            <span>{loadingImport ? '⏳ Mengimpor...' : '📁 Pilih & Import File Excel'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              disabled={loadingImport} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Form Tambah Master Manual */}
        <div>
          <h3 className="font-extrabold text-sm mb-3 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">➕ Tambah Master Barang Baru (Manual)</h3>
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

      </div>

      {/* Tabel Master Data dengan Urutan A-Z */}
      <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h3 className="font-extrabold text-sm mb-4 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">Daftar Master Data Barang (Urut A-Z)</h3>
        <div className="max-h-[500px] overflow-y-auto relative rounded-2xl border border-stone-200 dark:border-neutral-700">
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
              <tr>
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