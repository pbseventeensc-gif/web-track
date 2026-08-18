import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function PmgExcelImporter({ isDarkMode, onImportSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

        // Parsing data dari baris Excel
        // Menyesuaikan dengan format kolom Excel Anda: Kolom indeks 1 (Nama) & Indeks 2 (Alamat)
        const formattedData = [];
        rawData.forEach((row) => {
          // Asumsi baris berisi nama klien dan alamat
          const clientName = row[1] ? String(row[1]).trim() : '';
          const address = row[2] ? String(row[2]).trim() : (row[1] && row[0] ? String(row[1]).trim() : '');

          // Validasi baris valid
          if (clientName && clientName.length > 3 && !clientName.toLowerCase().includes('unnamed')) {
            formattedData.push({
              client_name: clientName,
              address: address || 'Alamat menyusul / Sesuai master'
            });
          }
        });

        if (formattedData.length > 0) {
          const { error } = await supabase.from('pmg_destinations').insert(formattedData);
          if (!error) {
            alert(`✅ Berhasil mengimpor ${formattedData.length} data alamat klien PMG!`);
            if (onImportSuccess) onImportSuccess();
          } else {
            alert('Gagal memasukkan ke database: ' + error.message);
          }
        } else {
          alert('⚠️ Format baris Excel tidak dikenali atau kosong.');
        }
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-200'}`}>
      <h4 className="font-bold text-xs uppercase text-indigo-500 mb-2">📁 Import Master Alamat via Excel</h4>
      <p className="text-[11px] opacity-60 mb-3">Unggah file Excel daftar alamat klien PMG (seperti file Alamat PMG) untuk dimasukkan secara otomatis.</p>
      
      <label className={`block w-full py-2.5 px-4 rounded-xl cursor-pointer text-xs font-bold text-center transition-all shadow-sm ${loading ? 'bg-stone-400 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'}`}>
        {loading ? 'Sedang Mengimpor...' : '📂 Pilih & Import File Excel Alamat'}
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} className="hidden" />
      </label>
    </div>
  );
}