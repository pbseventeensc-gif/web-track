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
        const ws = wb.Sheets[sheetName];

        // Dual-mode parsing: Try raw array sheet_to_json({ header: 1 }) first to support Wellen Print print preview / direct format
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let formattedData = [];
        let detectedClient = 'WELLEN PRINT';
        let generatedSpkNo = `SPK-${Math.floor(1000 + Math.random() * 9000)}`;

        // Scan header metadata & tabular columns
        let headerRowIdx = -1;
        let colMap = { no: -1, mesin: -1, namaBarang: -1, ukuran: -1, qty: -1, finishing: -1 };

        rawRows.forEach((r, rIdx) => {
          if (!r || r.length === 0) return;
          const rowStr = r.map(c => String(c || '').trim()).join(' ').toLowerCase();

          // Extract Client Name if present
          if (rowStr.includes('pemberi kerja') || rowStr.includes('client')) {
            const foundClient = r.find(cell => cell && typeof cell === 'string' && !cell.toLowerCase().includes('pemberi kerja') && !cell.toLowerCase().includes('nama'));
            if (foundClient) detectedClient = foundClient.trim();
          }

          // Extract SPK No if present
          if (rowStr.includes('spk-') || rowStr.includes('no. spk') || rowStr.includes('no spk')) {
            const foundSpk = r.find(cell => cell && typeof cell === 'string' && cell.toUpperCase().includes('SPK'));
            if (foundSpk) generatedSpkNo = foundSpk.trim();
          }

          // Detect header row containing "nama barang", "ukuran", "qty", or "finishing"
          if ((rowStr.includes('nama barang') || rowStr.includes('barang') || rowStr.includes('finishing')) && headerRowIdx === -1) {
            headerRowIdx = rIdx;
            r.forEach((cell, cIdx) => {
              if (!cell) return;
              const c = String(cell).toLowerCase().trim();
              if (c === 'n' || c === 'no' || c === 'no.') colMap.no = cIdx;
              else if (c.includes('mesin')) colMap.mesin = cIdx;
              else if (c.includes('nama barang') || c.includes('barang') || c.includes('nama')) colMap.namaBarang = cIdx;
              else if (c.includes('ukuran')) colMap.ukuran = cIdx;
              else if (c === 'qty' || c === 'quantity' || c.includes('jumlah')) colMap.qty = cIdx;
              else if (c.includes('finishing') || c.includes('finish')) colMap.finishing = cIdx;
            });
          }
        });

        // If table header found via array rows, extract data rows below headerRowIdx
        if (headerRowIdx !== -1 && colMap.namaBarang !== -1) {
          for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
            const r = rawRows[i];
            if (!r || r.length === 0) continue;

            const bahan = r[colMap.namaBarang] ? String(r[colMap.namaBarang]).trim() : '';
            if (!bahan || bahan.toLowerCase().includes('total') || bahan.toLowerCase().includes('note')) continue;

            const mesin = colMap.mesin !== -1 && r[colMap.mesin] ? String(r[colMap.mesin]).trim() : '';
            const ukuran = colMap.ukuran !== -1 && r[colMap.ukuran] ? String(r[colMap.ukuran]).trim() : '-';
            const rawQty = colMap.qty !== -1 ? r[colMap.qty] : 1;
            const qtyOrder = Number(String(rawQty).replace(/[^0-9]/g, '')) || 1;
            const finishing = colMap.finishing !== -1 && r[colMap.finishing] ? String(r[colMap.finishing]).trim() : '-';

            const itemDescription = mesin ? `[Mesin: ${mesin}] ${bahan}` : bahan;

            formattedData.push({
              no_spk: generatedSpkNo,
              client: detectedClient,
              project: `SPK Report - ${detectedClient}`,
              bahan: itemDescription,
              ukuran: ukuran,
              qty_order: qtyOrder,
              qty_print: 0,
              qty_finish: 0,
              qty_pack: 0,
              qty_ship: 0,
              store_code: '-',
              delivery_route: finishing
            });
          }
        }

        // Fallback to standard keyed JSON object parsing if array parser found nothing
        if (formattedData.length === 0) {
          const rawData = XLSX.utils.sheet_to_json(ws);
          if (rawData && rawData.length > 0) {
            formattedData = rawData.map((row, index) => {
              const noSpk = String(row['No SPK'] || row['NO_SPK'] || row['no_spk'] || generatedSpkNo).trim();
              const client = String(row['Client'] || row['CLIENT'] || row['client'] || detectedClient).trim();
              const project = String(row['Project'] || row['PROJECT'] || row['project'] || 'Project SPK').trim();
              const bahan = String(row['Nama Barang'] || row['NAMA_BARANG'] || row['Bahan'] || row['bahan'] || '').trim();
              const ukuran = String(row['Ukuran'] || row['UKURAN'] || row['ukuran'] || '-').trim();
              const rawQty = row['Qty'] || row['QTY'] || row['qty'] || row['Jumlah'] || 1;
              const qtyOrder = Number(String(rawQty).replace(/[^0-9]/g, '')) || 1;
              const storeCode = String(row['Store Code'] || row['STORE_CODE'] || row['store_code'] || '-').trim();
              const deliveryRoute = String(row['Delivery Route'] || row['DELIVERY_ROUTE'] || row['Finishing'] || row['finishing'] || '-').trim();

              if (!bahan) return null;

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
          }
        }

        if (formattedData.length > 0) {
          const { error } = await supabase.from('spk_data').insert(formattedData);
          if (!error) {
            alert(`✅ Sukses! Berhasil mengimport ${formattedData.length} data item SPK dari Excel.`);
            if (onImportSuccess) onImportSuccess();
            if (onClose) onClose();
          } else {
            alert('❌ Gagal menyimpan ke database Supabase: ' + error.message);
          }
        } else {
          alert('⚠️ Format baris Excel tidak dikenali. Pastikan terdapat kolom "Nama Barang", "Ukuran", "Qty", dan "Finishing".');
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
          Unggah file Excel (.xlsx / .xls) dengan format data SPK (Mendukung format standar kolom & format cetak preview Wellen seperti <b>Mesin</b>, <b>Nama Barang</b>, <b>Ukuran</b>, <b>Qty</b>, dan <b>Finishing</b>).
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
