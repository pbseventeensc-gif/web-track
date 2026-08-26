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

        // Parsing data dari baris Excel sesuai struktur Alokasi CCOD:
        // row[1] = Hos / Wilayah
        // row[2] = Nama CCOD (client_name)
        // row[4] = Alamat lengkap (address)
        // row[5] = PIC
        // row[6] = Contact Number (phone)
        const formattedData = [];
        
        // Mulai dari index 1 untuk melewati baris header judul tabel
        rawData.slice(1).forEach((row) => {
          const clientName = row[2] ? String(row[2]).trim() : '';
          const address = row[4] ? String(row[4]).trim() : '';
          const picName = row[5] ? String(row[5]).trim() : '-';
          const phoneNum = row[6] ? String(row[6]).trim() : '-';
          const hosRegion = row[1] ? String(row[1]).trim() : '-';

          // Validasi baris valid (pastikan Nama CCOD ada dan bukan baris kosong)
          if (clientName && clientName.length > 2 && !clientName.toLowerCase().includes('unnamed')) {
            formattedData.push({
              client_name: clientName,
              address: address || 'Alamat menyusul',
              pic: picName,
              phone: phoneNum,
              hos_region: hosRegion
            });
          }
        });

        if (formattedData.length > 0) {
          const { error } = await supabase.from('pmg_destinations').insert(formattedData);
          if (!error) {
            alert(`✅ Berhasil mengimpor ${formattedData.length} data CCOD lengkap dengan alamat, PIC, dan telepon!`);
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
    <div className={`p-4 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-800'}`}>
      <h4 className="font-bold text-xs uppercase text-indigo-500 mb-2">📁 Import Master Alamat CCOD via Excel</h4>
      <p className="text-[11px] opacity-60 mb-3">Unggah file Excel <strong>Alokasi CCOD Banner - X Banner.xlsx</strong> untuk mengimpor Nama CCOD, Alamat, PIC, dan No HP secara otomatis.</p>
      
      <label className={`block w-full py-3 px-4 rounded-xl cursor-pointer text-xs font-bold text-center transition-all shadow-sm ${loading ? 'bg-stone-400 text-white cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'}`}>
        {loading ? '⏳ Sedang Mengimpor ke Supabase...' : '📂 Pilih & Import File Alokasi CCOD'}
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} className="hidden" />
      </label>
    </div>
  );
}