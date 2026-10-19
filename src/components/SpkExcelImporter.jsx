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
    XLSX.utils.book_append_sheet(wb, ws, "Templat_SPK");
    XLSX.writeFile(wb, "Templat_Impor_SPK_Wellen.xlsx");
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

        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        let formattedData = [];
        let detectedClient = 'WELLEN PRINT';
        let generatedSpkNo = `SPK-${Math.floor(1000 + Math.random() * 9000)}`;

        let headerRowIdx = -1;
        let colMap = { no: -1, mesin: -1, namaBarang: -1, ukuran: -1, qty: -1, finishing: -1 };

        rawRows.forEach((r, rIdx) => {
          if (!r || r.length === 0) return;
          const rowStr = r.map(c => String(c || '').trim()).join(' ').toLowerCase();

          if (rowStr.includes('pemberi kerja') || rowStr.includes('client')) {
            const foundClient = r.find(cell => cell && typeof cell === 'string' && !cell.toLowerCase().includes('pemberi kerja') && !cell.toLowerCase().includes('nama'));
            if (foundClient) detectedClient = foundClient.trim();
          }

          if (rowStr.includes('spk-') || rowStr.includes('no. spk') || rowStr.includes('no spk')) {
            const foundSpk = r.find(cell => cell && typeof cell === 'string' && cell.toUpperCase().includes('SPK'));
            if (foundSpk) generatedSpkNo = foundSpk.trim();
          }

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
              project: `Laporan SPK - ${detectedClient}`,
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

        if (formattedData.length === 0) {
          const rawData = XLSX.utils.sheet_to_json(ws);
          if (rawData && rawData.length > 0) {
            formattedData = rawData.map((row) => {
              const noSpk = String(row['No SPK'] || row['NO_SPK'] || row['no_spk'] || generatedSpkNo).trim();
              const client = String(row['Client'] || row['CLIENT'] || row['client'] || detectedClient).trim();
              const project = String(row['Project'] || row['PROJECT'] || row['project'] || 'Proyek SPK').trim();
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
          const { data: insertedData, error } = await supabase
            .from('spk_data')
            .insert(formattedData)
            .select('*');

          if (!error) {
            // Auto sync langsung ke packing_tracking
            const itemsToSync = insertedData && insertedData.length > 0 ? insertedData : formattedData;
            const packingPayloads = itemsToSync.map((spk, idx) => {
              const trackingCode = spk.tracking_id || `${spk.no_spk || 'SPK'}-${spk.id || Date.now() + idx}`;
              return {
                tracking_id: trackingCode,
                no_spk: spk.no_spk || `SPK-${spk.id || idx}`,
                client_pt: spk.client || spk.client_pt || 'Wellen Customer',
                promo_title: spk.project || spk.promo_title || 'Project Utama',
                store_name: spk.store_code || spk.store_name || 'Store Utama',
                recipient_name: spk.client || 'Penerima',
                total_qty: Number(spk.qty_order || 100),
                box_code: 'WL-01',
                delivery_type: spk.delivery_route || 'DALAM KOTA',
                status_qc_label: 'PENDING',
                status_qc_packing: 'PENDING',
                status_qc_checker: 'PENDING',
                status_deliver: 'PENDING',
                items_detail: [{
                  code: spk.no_spk || 'ITEM-01',
                  desc: spk.project || 'Item Pesanan',
                  material: spk.bahan || '-',
                  size: spk.ukuran || '-',
                  qty: Number(spk.qty_order || 100)
                }],
                updated_at: new Date().toISOString()
              };
            });

            await supabase.from('packing_tracking').upsert(packingPayloads, { onConflict: 'tracking_id' });

            alert(`✅ Sukses! Berhasil mengimport ${formattedData.length} data item SPK dari Excel & menyinkronkan ke Packing Station.`);
            if (onImportSuccess) onImportSuccess();
            if (onClose) onClose();
          } else {
            alert('Gagal menyimpan data ke basis data: ' + error.message);
          }
        } else {
          alert('Format kolom Excel tidak dikenali. Pastikan terdapat kolom "Nama Barang", "Ukuran", "Qty", dan "Finishing".');
        }
      } catch (err) {
        alert('Gagal memproses berkas Excel: ' + err.message);
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div className={`w-full max-w-md p-6 rounded-2xl border shadow-lg transition-all ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm">Impor Data SPK dari Excel</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
          Unggah berkas Excel (`.xlsx` atau `.xls`) sesuai struktur data SPK. Sistem mendukung format tabel standar maupun format pratinjau cetak yang memuat kolom <strong>Mesin</strong>, <strong>Nama Barang</strong>, <strong>Ukuran</strong>, <strong>Qty</strong>, dan <strong>Finishing</strong>.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleDownloadTemplate}
            className={`w-full py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isDarkMode
                ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-slate-200'
                : 'bg-slate-100/80 hover:bg-slate-200/70 border-slate-200/80 text-slate-700'
            }`}
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Unduh Templat Excel SPK
          </button>

          <label className={`block w-full py-3 px-4 rounded-xl cursor-pointer text-xs font-semibold text-center border transition-all ${
            loading
              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              : 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 active:scale-[0.99]'
          }`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Memproses Impor ke Basis Data...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Pilih & Unggah Berkas Excel SPK
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
