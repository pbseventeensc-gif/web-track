import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';

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

        const formattedData = [];
        
        rawData.slice(1).forEach((row) => {
          const clientName = row[2] ? String(row[2]).trim() : '';
          const address = row[4] ? String(row[4]).trim() : '';
          const picName = row[5] ? String(row[5]).trim() : '-';
          const phoneNum = row[6] ? String(row[6]).trim() : '-';
          const hosRegion = row[1] ? String(row[1]).trim() : '-';

          if (clientName && clientName.length > 2 && !clientName.toLowerCase().includes('unnamed')) {
            formattedData.push({
              client_name: clientName,
              address: address || 'Alamat belum tersedia',
              pic: picName,
              pic_name: picName,
              phone: phoneNum,
              hos_region: hosRegion
            });
          }
        });

        if (formattedData.length > 0) {
          const { error } = await supabase.from('pmg_destinations').insert(formattedData);
          if (!error) {
            alert(`Berhasil mengimpor ${formattedData.length} data alokasi CCOD beserta alamat, PIC, dan nomor telepon.`);
            if (onImportSuccess) onImportSuccess();
          } else {
            alert('Gagal menyimpan data ke basis data: ' + error.message);
          }
        } else {
          alert('Format baris tidak dikenali atau berkas kosong.');
        }
      } catch (err) {
        alert('Gagal membaca berkas: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className={`p-4 rounded-2xl border shadow-2xs ${isDarkMode ? 'bg-neutral-900/90 border-neutral-800 text-slate-100' : 'bg-slate-50/80 border-slate-200/80 text-slate-800'}`}>
      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-1.5">
        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        Impor Data Alokasi CCOD
      </h4>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
        Unggah berkas Excel Alokasi CCOD untuk mengimpor nama klien, alamat tujuan, nama PIC, serta nomor telepon secara otomatis.
      </p>
      
      <label className={`w-full py-2.5 px-3.5 rounded-xl cursor-pointer text-xs font-semibold text-center transition-all shadow-2xs flex items-center justify-center gap-1.5 ${loading ? 'bg-slate-100/80 text-slate-400 border border-slate-200/80 dark:bg-neutral-800 dark:text-neutral-500 dark:border-neutral-700 cursor-not-allowed' : 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 active:scale-95'}`}>
        <FileSpreadsheet className="w-3.5 h-3.5" />
        {loading ? 'Mengimpor ke Basis Data...' : 'Pilih & Impor Berkas Alokasi CCOD'}
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} className="hidden" />
      </label>
    </div>
  );
}