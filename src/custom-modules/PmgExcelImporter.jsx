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
              address: address || 'Address pending',
              pic: picName,
              phone: phoneNum,
              hos_region: hosRegion
            });
          }
        });

        if (formattedData.length > 0) {
          const { error } = await supabase.from('pmg_destinations').insert(formattedData);
          if (!error) {
            alert(`Successfully imported ${formattedData.length} CCOD records complete with address, PIC, and phone!`);
            if (onImportSuccess) onImportSuccess();
          } else {
            alert('Failed to insert into database: ' + error.message);
          }
        } else {
          alert('Row format not recognized or empty.');
        }
      } catch (err) {
        alert('Failed to read file: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className={`p-4 rounded-2xl border shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-slate-50/80 border-slate-200 text-slate-800'}`}>
      <h4 className="font-bold text-xs uppercase text-slate-900 dark:text-white mb-2">Import CCOD Master Address</h4>
      <p className="text-[11px] opacity-70 mb-3">Upload Allocation CCOD Banner - X Banner file to automatically import CCOD Name, Address, PIC, and Phone No.</p>
      
      <label className={`block w-full py-2.5 px-3.5 rounded-xl cursor-pointer text-xs font-bold text-center transition-all shadow-2xs ${loading ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-600 text-white border border-sky-500 active:scale-95'}`}>
        {loading ? 'Importing to Supabase...' : 'Select & Import CCOD Allocation File'}
        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} className="hidden" />
      </label>
    </div>
  );
}