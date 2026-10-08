import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Download, Upload, Loader2, X } from 'lucide-react';

export default function SpkExcelImporter({ isDarkMode, onImportSuccess, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "No SPK": "SPK-1026-01255",
        "Client": "PT MUJARA KREASI INDONESIA",
        "Project": "Produksi Display Inpraboard",
        "No": 1,
        "Mesin": "1SWISSQ",
        "Nama Barang": "INPRABOARD 5 MM 1 SISI - Heypeko",
        "Ukuran": "0.09 x 0.18",
        "Qty": 10,
        "Finishing": "POTONG BENTUK",
        "Store Code": "STORE-01",
        "Delivery Route": "REGULER"
      },
      {
        "No SPK": "SPK-1026-01255",
        "Client": "PT MUJARA KREASI INDONESIA",
        "Project": "Produksi Display Inpraboard",
        "No": 2,
        "Mesin": "2SWISSQ",
        "Nama Barang": "INPRABOARD 5 MM 1 SISI - Infused Water",
        "Ukuran": "0.10 x 0.10",
        "Qty": 6,
        "Finishing": "POTONG BENTUK",
        "Store Code": "STORE-01",
        "Delivery Route": "REGULER"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_SPK");
    XLSX.writeFile(wb, "Template_Upload_SPK_Wellen.xlsx");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

        if (!rawData || rawData.length === 0) {
          alert('❌ File Excel kosong atau tidak terbaca!');
          return;
        }

        const formattedData = rawData.map((row, index) => {
          const noSpk = String(row['No SPK'] || row['NO_SPK'] || row['no_spk'] || `SPK-${Date.now()}-${index}`).trim();
          const client = String(row['Client'] || row['CLIENT'] || row['client'] || 'PT MUJARA KREASI INDONESIA').trim();
          const project = String(row['Project'] || row['PROJECT'] || row['project'] || 'Project SPK').trim();
          const bahan = String(row['Nama Barang'] || row['NAMA_BARANG'] || row['Bahan'] || row['bahan'] || 'Material Standar').trim();
          const ukuran = String(row['Ukuran'] || row['UKURAN'] || row['ukuran'] || '-').trim();
          const rawQty = row['Qty'] || row['QTY'] || row['qty'] || row['Jumlah'] || 1;
          const qtyOrder = Number(String(rawQty).replace(/[^0-9]/g, '')) || 1;
          const storeCode = String(row['Store Code'] || row['STORE_CODE'] || row['store_code'] || '-').trim();
          const deliveryRoute = String(row['Delivery Route'] || row['DELIVERY_ROUTE'] || row['Finishing'] || row['finishing'] || '-').trim();

          if (!noSpk && !bahan) return null;

          return {
            no_spk: noSpk,
            client: client,
            project: project,
            bahan: bahan,
            ukuran: ukuran,
            qty_order: qtyOrder,
            qty_print: 0,
            qty_finish: 0,
            qty_pack: 0,
            qty_ship: 0,
            store_code: storeCode,
            delivery_route: deliveryRoute
          };
        }).filter(item => item !== null);

        if (formattedData.length > 0) {
          const { error } = await supabase.from('spk_data').insert(formattedData);
          if (!error) {
            alert(`✅ Sukses! Berhasil mengimport ${formattedData.length} data SPK dari Excel.`);
            if (onImportSuccess) onImportSuccess();
            if (onClose) onClose();
          } else {
            alert('❌ Gagal menyimpan ke database Supabase: ' + error.message);
          }
        } else {
          alert('⚠️ Format baris Excel tidak dikenali atau kosong.');
        }
      } catch (err) {
        alert('❌ Gagal memproses file Excel: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl transition-all ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-base">Import SPK dari Excel</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
          Unggah file Excel (.xlsx / .xls) dengan format data SPK (No SPK, Client, Project, Nama Barang, Ukuran, Qty, Finishing) untuk dimasukkan otomatis ke sistem tracking produksi.
        </p>

        <div className="space-y-3.5">
          <button
            onClick={handleDownloadTemplate}
            className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-white'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download Template Excel SPK
          </button>

          <label className={`block w-full py-3 px-4 rounded-xl cursor-pointer text-xs font-black text-center transition-all shadow-sm ${
            loading
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98'
          }`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Mengimport ke Database...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Pilih & Upload File Excel SPK
              </span>
            )}
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
