import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

// URL Google Apps Script milik Anda
const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzh4DKAVUWYfGzzD90yc7Oy6oE0h1RfWYro0abbgFpSBEjNNoen1O1bu6vYtbe-CXLpuQ/exec";

// Daftar 6 Petugas QC
const STAFF_QC_LIST = [
  "Budi (QC Paking)",
  "Siti (QC Paking)",
  "Agus (QC Checker)",
  "Dewi (QC Checker)",
  "Eko (QC Deliver)",
  "Rian (QC Deliver)"
];

// FUNGSI GENERATE LOGO WELLEN PRINT BASE64
const createWellenLogoDataUrl = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.moveTo(10, 90);
  ctx.quadraticCurveTo(10, 50, 25, 45);
  ctx.lineTo(25, 90);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FF6600';
  ctx.beginPath();
  ctx.moveTo(30, 90);
  ctx.quadraticCurveTo(30, 30, 50, 22);
  ctx.lineTo(50, 90);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.moveTo(55, 90);
  ctx.quadraticCurveTo(55, 10, 80, 2);
  ctx.lineTo(80, 90);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillText('WELLEN', 95, 52);

  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillText('P R I N T', 100, 80);

  return canvas.toDataURL('image/png');
};

function CircularGaugeCard({ title, percent, color, detailText }) {
  const strokeDasharray = 2 * Math.PI * 36;
  const strokeDashoffset = strokeDasharray - (percent / 100) * strokeDasharray;

  return (
    <div className="bg-white/80 dark:bg-neutral-800/80 p-5 rounded-3xl border border-[#D8D2C2] dark:border-neutral-700 flex flex-col items-center shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-3">{title}</h4>
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="7" className="text-stone-200 dark:text-neutral-700 fill-none" />
          <circle cx="40" cy="40" r="36" stroke={color} strokeWidth="7" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="fill-none transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black">{percent}%</span>
          <span className="text-[9px] font-bold opacity-60 uppercase">Progress</span>
        </div>
      </div>
      <p className="text-xs font-bold mt-3 opacity-80">{detailText}</p>
    </div>
  );
}

function LabelGeneratorTab({ isDarkMode, spkList, fetchSpkData, processAndInsertToSupabase }) {
  const [selectedRows, setSelectedRows] = useState([]);
  const [wellenLogoDataUrl, setWellenLogoDataUrl] = useState('');
  const [headerLogoUrl, setHeaderLogoUrl] = useState(() => {
    return localStorage.getItem('wellen_header_logo') || '';
  });

  useEffect(() => {
    try {
      setWellenLogoDataUrl(createWellenLogoDataUrl());
    } catch (err) {
      console.error('Failed to create canvas logo:', err);
    }
  }, []);

  const handleUploadHeaderLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Logo = evt.target.result;
      setHeaderLogoUrl(base64Logo);
      localStorage.setItem('wellen_header_logo', base64Logo);
      alert('✅ Logo Header KOP berhasil diunggah!');
    };
    reader.readAsDataURL(file);
  };

  const handleResetHeaderLogo = () => {
    if (confirm('Hapus logo header custom?')) {
      setHeaderLogoUrl('');
      localStorage.removeItem('wellen_header_logo');
    }
  };

  const handleDownloadTemplate = () => {
    const templateSampleData = [
      {
        NO_SPK: "SPK-0826-00101",
        PO_NUMBER: "4500122101",
        NO_SJ: "WL-26-88-01",
        CLIENT: "PT TRI SAKTI PURWOSARI MAKMUR",
        BRAND: "Production Sunscreen Juara Intens",
        RECIPIENT_NAME: "Pak Pajri Hidayah",
        RECIPIENT_PHONE: "0838-3041-0548",
        DELIVERY_ADDRESS: "Management Support (DC Marunda) JL. Kebantenan IV No. 15, Semper Timur, Cilincing, JAKARTA UTARA 14130",
        ITEM_DESCRIPTION: "SUNSCREEN BANNER",
        MEDIA: "FLEXY CINA 280 GR",
        UKURAN: "2 X 0.75 M",
        QTY_TOTAL: 300,
        QTY_PER_KOLI: 20,
        DATE_PRODUCTION: "12-Aug-26",
        SENDER: "WELLEN PRINT",
        WELLEN_PIC: "BPK. JHONNY",
        SENDER_TELP: "021-5506999",
        SENDER_EMAIL: "info@wellenprint.com"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateSampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_WellenPrint");
    XLSX.writeFile(wb, "Template_Import_WellenPrint.xlsx");
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (!rawData || rawData.length === 0) {
          alert('❌ File Excel kosong atau tidak terbaca!');
          return;
        }

        await processAndInsertToSupabase(rawData);
        setSelectedRows([]);
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleToggleCheck = (index) => {
    setSelectedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === spkList.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(spkList.map((_, idx) => idx));
    }
  };

  const getLogoHtml = () => {
    if (headerLogoUrl) {
      return `<img src="${headerLogoUrl}" style="height:65px; max-width:200px; object-fit:contain; display:block;">`;
    }
    const logoSrc = wellenLogoDataUrl || createWellenLogoDataUrl();
    if (logoSrc) {
      return `<img src="${logoSrc}" style="height:60px; max-width:190px; object-fit:contain; display:block;">`;
    }
    return `<div style="font-weight:bold; font-size:20px;">PT. WELLEN PRINT</div>`;
  };

  const handlePrintLabels = async () => {
    if (selectedRows.length === 0) {
      alert('⚠️ Silakan centang minimal 1 baris data untuk dicetak!');
      return;
    }

    const itemsToPrint = spkList.filter((_, idx) => selectedRows.includes(idx));
    const logoHtml = getLogoHtml();

    const pagesHtml = await Promise.all(
      itemsToPrint.map(async (item) => {
        const totalQty = Number(item.qty_order || item.QTY_TOTAL || 0);
        const qtyPerKoli = Number(item.QTY_PER_KOLI || 20);
        const totalKoli = Math.ceil(totalQty / qtyPerKoli) || 1;

        let koliHtmls = [];
        for (let k = 1; k <= totalKoli; k++) {
          const currentQty = (k === totalKoli && totalQty % qtyPerKoli !== 0) ? (totalQty % qtyPerKoli) : qtyPerKoli;
          const qrAddress = item.no_spk ? `SPK:${item.no_spk}|KOLI:${k}/${totalKoli}` : 'WELLEN-PRINT';
          
          let qrDataUrl = '';
          try {
            qrDataUrl = await QRCode.toDataURL(qrAddress, { width: 120, margin: 1 });
          } catch (e) {
            console.error(e);
          }

          koliHtmls.push(`
            <div class="label-page">
              <div class="label-box">
                <table class="header-table">
                  <tr>
                    <td style="width: 25%; vertical-align: middle;">${logoHtml}</td>
                    <td style="width: 55%; text-align:center; font-size:9px; line-height: 1.2; vertical-align: middle;">
                      <strong style="font-size:13px;">PT. WELLEN PRINT</strong><br>
                      Green Sedayu Bizpark. Jl. Daan Mogot KM.18 blok DM3 No.18, Kalideres,<br>
                      RT.11/RW.6, Kalideres, Kec. Kalideres, Kota Jakarta Barat, 11840
                    </td>
                    <td style="width: 20%; text-align:right; vertical-align: middle;">
                      ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:60px; height:60px; display:inline-block;">` : ''}
                    </td>
                  </tr>
                </table>

                <div class="content-grid">
                  <div class="grid-box">
                    <strong>SENDER:</strong> ${item.sender || 'WELLEN PRINT'}<br>
                    <strong>WELLEN PIC:</strong> ${item.wellen_pic || 'BPK. JHONNY'}<br>
                    <strong>NO. TELP:</strong> ${item.sender_telp || '021-5506999'}<br>
                    <strong>EMAIL:</strong> ${item.sender_email || 'info@wellenprint.com'}
                  </div>
                  <div class="grid-box">
                    <strong>CLIENT:</strong> ${item.client || '-'}<br>
                    <strong>Delivery Address:</strong> ${item.delivery_address || item.project || '-'}<br>
                    <strong>Recipient Name:</strong> ${item.recipient_name || '-'}<br>
                    <strong>Recipient Phone:</strong> ${item.recipient_phone || '-'}
                  </div>
                  <div class="grid-box">
                    <strong>PO NUMBER:</strong> ${item.po_number || '-'}<br>
                    <strong>NO. SPK:</strong> ${item.no_spk || '-'}<br>
                    <strong>ITEM DESCRIPTION:</strong> ${item.project || item.item_description || '-'}<br>
                    <strong>MEDIA:</strong> ${item.bahan || '-'}<br>
                    <strong>UKURAN:</strong> ${item.ukuran || '-'}<br>
                    <strong>QUANTITY:</strong> ${currentQty} PCS<br>
                    <strong>DATE PRODUCTION:</strong> ${item.date_production || '12-Aug-26'}
                  </div>
                  <div class="grid-box visual-box">
                    <div><strong>VISUAL IMAGE :</strong></div>
                    <div class="koli-title">${k} OF ${totalKoli}</div>
                    ${item.visual_image ? `<img src="${item.visual_image}" class="preview-img">` : `<div style="font-size:10px; opacity:0.5;">[ No Image ]</div>`}
                  </div>
                </div>
              </div>
            </div>
          `);
        }
        return koliHtmls.join('');
      })
    );

    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Label Wellen Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
          .label-page { width: 210mm; height: 148mm; padding: 5mm; box-sizing: border-box; page-break-after: always; break-after: page; }
          .label-box { border: 2px solid #000; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; }
          .header-table { width: 100%; border-bottom: 2px solid #000; border-collapse: collapse; }
          .header-table td { border: none; padding: 6px; vertical-align: middle; }
          .content-grid { display: grid; grid-template-columns: 1fr 1fr; flex-grow: 1; }
          .grid-box { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 6px; font-size: 11px; line-height: 1.4; box-sizing: border-box; }
          .grid-box:nth-child(2n) { border-right: none; }
          .grid-box:nth-child(3), .grid-box:nth-child(4) { border-bottom: none; }
          .visual-box { text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
          .koli-title { font-size: 20px; font-weight: bold; margin: 2px 0; }
          .preview-img { max-width: 95%; max-height: 90px; object-fit: contain; }
          @media print { body { padding: 0; } .label-page { page-break-after: always; break-after: page; } }
        </style>
      </head>
      <body>${pagesHtml.join('')}</body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
  };

  const handlePrintSuratJalan = () => {
    if (selectedRows.length === 0) {
      alert('⚠️ Silakan centang minimal 1 baris data untuk dicetak Surat Jalan!');
      return;
    }

    const itemsToPrint = spkList.filter((_, idx) => selectedRows.includes(idx));
    const logoHtml = getLogoHtml();

    const pagesHtml = itemsToPrint.map((item) => {
      return `
        <div class="sj-page">
          <div class="sj-top-header">
            <div class="logo-sec">${logoHtml}</div>
            <div class="sj-title">Tanda Terima</div>
          </div>
          <div class="info-row">
            <div class="info-box left-box">
              <div class="info-line">Kepada Yth :</div>
              <div class="info-line font-bold">${item.client || '-'}</div>
              <div class="info-line">${item.delivery_address || item.project || '-'}</div>
              <div class="info-line">UP : ${item.recipient_name || '-'} ${item.recipient_phone || ''}</div>
            </div>
            <div class="right-box-container">
              <table class="meta-table">
                <tr><td class="font-bold">NO PO</td><td>: ${item.po_number || '-'}</td></tr>
                <tr><td class="font-bold">BRAND</td><td>: ${item.brand || item.project || '-'}</td></tr>
                <tr><td class="font-bold">NO SJ</td><td>: ${item.no_sj || '-'}</td></tr>
              </table>
              <div class="date-box">
                <div class="date-header">TANGGAL</div>
                <div class="date-value">${item.date_production || '12-Aug-26'}</div>
              </div>
            </div>
          </div>
          <table class="item-grid-table">
            <thead>
              <tr>
                <th style="width: 8%;">NO</th>
                <th style="width: 25%;">AMO/DEPO</th>
                <th style="width: 27%;">AMO</th>
                <th>
                  <div>${item.project || 'SUNSCREEN'}</div>
                  <div class="font-normal" style="font-size: 11px;">${item.brand || '-'}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center;">1</td>
                <td>AMO/DEPO</td>
                <td></td>
                <td style="text-align: right; padding-right: 15px;">${Number(item.qty_order || 0).toLocaleString()}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-center font-bold">TOTAL</td>
                <td style="text-align: right; padding-right: 15px;" class="font-bold">${Number(item.qty_order || 0).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          <div class="signature-row">
            <div class="sig-box">PENGIRIM</div>
            <div class="sig-box">PENERIMA</div>
          </div>
        </div>
      `;
    }).join('');

    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Surat Jalan - Wellen Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          .sj-page { width: 210mm; height: 148mm; padding: 8mm; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; }
          .font-bold { font-weight: bold; }
          .font-normal { font-weight: normal; }
          .text-center { text-align: center; }
          .sj-top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .sj-title { font-size: 26px; font-weight: bold; text-align: right; }
          .info-row { display: flex; gap: 15px; margin-bottom: 10px; }
          .info-box { border: 1.5px solid #000; padding: 6px 10px; font-size: 11px; line-height: 1.4; }
          .left-box { flex: 1; height: 75px; }
          .right-box-container { width: 42%; display: flex; flex-direction: column; gap: 6px; }
          .meta-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; }
          .meta-table td { padding: 2px 6px; border: none; }
          .date-box { border: 1.5px solid #000; height: 38px; display: flex; flex-direction: column; text-align: center; font-size: 10px; }
          .date-header { border-bottom: 1px solid #000; font-weight: bold; padding: 1px 0; background: #f8f8f8; }
          .date-value { padding-top: 3px; font-weight: bold; font-size: 11px; }
          .item-grid-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; margin-bottom: 15px; }
          .item-grid-table th, .item-grid-table td { border: 1.5px solid #000; padding: 5px; }
          .item-grid-table th { text-align: center; background: #f8f8f8; }
          .item-grid-table tfoot td { background: #f8f8f8; }
          .signature-row { display: flex; justify-content: space-around; text-align: center; font-size: 11px; font-weight: bold; margin-top: 15px; }
          .sig-box { width: 200px; border-top: 1px solid transparent; padding-top: 40px; }
          @media print { body { padding: 0; } .sj-page { page-break-after: always; break-after: page; } }
        </style>
      </head>
      <body>${pagesHtml}</body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
  };

  return (
    <div className="space-y-4">
      {/* Panel Upload Logo Header KOP */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-[#D8D2C2]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-16 h-12 rounded-xl border bg-stone-50 dark:bg-neutral-900 flex items-center justify-center overflow-hidden p-1">
            {headerLogoUrl ? (
              <img src={headerLogoUrl} alt="Logo Header" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[10px] font-bold opacity-50 text-center">Default Logo</span>
            )}
          </div>
          <div>
            <h4 className="font-bold text-xs">🖼️ Logo Header KOP (Label & Surat Jalan)</h4>
            <p className="text-[11px] opacity-70">
              {headerLogoUrl ? '✅ Logo Custom Aktif' : 'ℹ️ Menggunakan Logo Wellen Print Default'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm bg-purple-600 hover:bg-purple-500 transition-all active:scale-95">
            🖼️ Upload Logo Custom KOP
            <input type="file" accept="image/*" onChange={handleUploadHeaderLogo} className="hidden" />
          </label>

          {headerLogoUrl && (
            <button onClick={handleResetHeaderLogo} className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${
        isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <label className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm transition-all ${
            isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#6B8E85] hover:bg-[#57756D]'
          }`}>
            📁 Import Excel Label & SJ (Auto Sync Cloud)
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" />
          </label>

          <button onClick={handleDownloadTemplate} className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all">
            📥 Download Template Excel
          </button>

          <span className="text-xs opacity-70 ml-2">
            Terisi: <strong>{spkList.length}</strong> Baris Data Online
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handlePrintSuratJalan} disabled={selectedRows.length === 0} className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${selectedRows.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 cursor-not-allowed'}`}>
            📄 Cetak Surat Jalan ({selectedRows.length})
          </button>
          <button onClick={handlePrintLabels} disabled={selectedRows.length === 0} className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${selectedRows.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer' : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 cursor-not-allowed'}`}>
            🏷️ Cetak Label ({selectedRows.length})
          </button>
        </div>
      </div>

      <div className={`overflow-x-auto rounded-2xl border shadow-sm ${isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2]'}`}>
        <table className="w-full text-left text-xs">
          <thead className={`font-bold border-b ${isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'}`}>
            <tr>
              <th className="p-3 text-center w-10">
                <input type="checkbox" checked={spkList.length > 0 && selectedRows.length === spkList.length} onChange={handleSelectAll} className="cursor-pointer accent-indigo-600" />
              </th>
              <th className="p-3">No SPK / PO / SJ</th>
              <th className="p-3">Client & Brand</th>
              <th className="p-3">Penerima & Alamat</th>
              <th className="p-3">Deskripsi / Media / Ukuran</th>
              <th className="p-3">Total Qty</th>
              <th className="p-3">Isi/Koli</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
            {spkList.length === 0 ? (
              <tr><td colSpan="7" className="p-6 text-center opacity-60">Database kosong. Silakan import Excel di atas.</td></tr>
            ) : (
              spkList.map((row, idx) => {
                const total = Number(row.qty_order || row.QTY_TOTAL || 0);
                const koli = Number(row.QTY_PER_KOLI || 20);
                const isChecked = selectedRows.includes(idx);

                const recipientName = row.recipient_name || row.RECIPIENT_NAME || '-';
                const recipientPhone = row.recipient_phone || row.RECIPIENT_PHONE || '';
                const deliveryAddress = row.delivery_address || row.DELIVERY_ADDRESS || row.project || '-';

                return (
                  <tr key={idx} className={`transition-colors ${isChecked ? (isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70') : (isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]')}`}>
                    <td className="p-3 text-center">
                      <input type="checkbox" checked={isChecked} onChange={() => handleToggleCheck(idx)} className="cursor-pointer accent-indigo-600" />
                    </td>
                    <td className="p-3 font-bold text-blue-500">
                      {row.no_spk || '-'}<br />
                      <span className="font-normal text-[10px] opacity-70">PO: {row.po_number || '-'}</span><br />
                      <span className="font-normal text-[10px] text-emerald-500">SJ: {row.no_sj || '-'}</span>
                    </td>
                    <td className="p-3"><strong className="text-xs">{row.client || '-'}</strong><br /><span className="text-[10px] opacity-70">{row.brand || row.project || '-'}</span></td>
                    <td className="p-3"><strong>{recipientName}</strong> ({recipientPhone})<br /><span className="text-[10px] opacity-70">{deliveryAddress}</span></td>
                    <td className="p-3">{row.project || row.item_description || '-'}<br /><span className="text-[10px] opacity-70">{row.bahan || '-'} ({row.ukuran || '-'})</span></td>
                    <td className="p-3 font-bold">{total.toLocaleString()} Pcs</td>
                    <td className="p-3">{koli} Pcs</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [spkList, setSpkList] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [showGSheetModal, setShowGSheetModal] = useState(false);
  const [gSheetUrl, setGSheetUrl] = useState('');
  const [importingGSheet, setImportingGSheet] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [inputMode, setInputMode] = useState('scan');
  const [scanTargetColumn, setScanTargetColumn] = useState('qc_checker');
  const [qcStaffName, setQcStaffName] = useState(STAFF_QC_LIST[2]);
  const [scannedInput, setScannedInput] = useState('');
  const [lastScanMessage, setLastScanMessage] = useState('');
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({ finishing_type: 'inhouse', sub_vendor_name: '', qty_finish_sub_out: 0, qty_finish: 0 });
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => { fetchSpkData(); }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const fetchSpkData = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('spk_data').select('*').order('id', { ascending: false });
    if (!error) {
      setSpkList(data || []);
      if (data && data.length > 0 && !selectedSpkId) initFinishingForm(data[0]);
    }
    setLoading(false);
  };

  const initFinishingForm = (item) => {
    if (!item) return;
    setSelectedSpkId(item.id);
    setFinishingForm({ finishing_type: item.finishing_type || 'inhouse', sub_vendor_name: item.sub_vendor_name || '', qty_finish_sub_out: item.qty_finish_sub_out || 0, qty_finish: item.qty_finish || 0 });
  };

  const processAndInsertToSupabase = async (rawData) => {
    const formattedData = rawData
      .filter((row) => (row['Store Name'] || row['Nama Project'] || row['COMPANY'] || row['SPK/WPP'] || row['No SPK'] || row['NO_SPK']))
      .map((row) => {
        const rawSpk = String(row['SPK/WPP'] || row['No SPK'] || row['NO_SPK'] || '-');
        const cleanSpk = rawSpk.split('/')[0].trim();
        const rawQty = row['TOTAL QTY ORDER'] || row['qty Order'] || row['QTY_TOTAL'] || row['Qty Total'] || row['QTY'] || 40;

        return {
          no_spk: cleanSpk,
          client: String(row['COMPANY'] || row['Nama Klient'] || row['CLIENT'] || row['Client'] || '-'),
          project: String(row['Store Name'] || row['Nama Project'] || row['ITEM_DESCRIPTION'] || row['Item Description'] || '-'),
          bahan: String(row['Nama Bahan'] || row['MEDIA'] || row['Media'] || 'Art Paper & Art Carton'),
          ukuran: String(row['Ukuran'] || row['UKURAN'] || 'A5 & Wobbler 10x10cm'),
          qty_order: Number(String(rawQty).replace(/[^0-9]/g, '')) || 40,
          qty_print: 0,
          qty_finish: 0,
          qty_finish_sub_out: 0,
          finishing_type: 'inhouse',
          sub_vendor_name: '',
          qty_pack: 0,
          qty_ship: 0,
          store_code: String(row['NO. STORE'] || row['Store ID'] || '-'),
          delivery_route: String(row['DELIVERY'] || 'DALAM KOTA'),
          po_number: String(row['NO. PO'] || row['PO_NUMBER'] || row['PO Number'] || '-'),
          qr_address: String(row['QR ADDRESS'] || '-'),
          qc_paking: String(row['QC Paking'] || row['qc_paking'] || ''),
          qc_checker: String(row['QC Checker'] || row['qc_checker'] || ''),
          qc_deliver: String(row['QC Deliver'] || row['qc_deliver'] || ''),
          tes_scan: String(row['tes scan'] || row['Tes Scan'] || row['tes_scan'] || ''),
          no_sj: String(row['NO_SJ'] || row['NO SJ'] || row['no_sj'] || `WL-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`),
          brand: String(row['BRAND'] || row['Brand'] || row['brand'] || ''),
          recipient_name: String(row['RECIPIENT_NAME'] || row['Recipient Name'] || row['recipient_name'] || row['UP'] || row['Nama Penerima'] || ''),
          recipient_phone: String(row['RECIPIENT_PHONE'] || row['Recipient Phone'] || row['recipient_phone'] || row['No Telp Penerima'] || ''),
          delivery_address: String(row['DELIVERY_ADDRESS'] || row['Delivery Address'] || row['delivery_address'] || row['ALAMAT_PENERIMA'] || row['Alamat Penerima'] || row['ALAMAT'] || row['Alamat'] || ''),
          date_production: String(row['DATE_PRODUCTION'] || row['Date Production'] || row['TANGGAL'] || '12-Aug-26'),
          sender: String(row['SENDER'] || row['Sender'] || 'WELLEN PRINT'),
          wellen_pic: String(row['WELLEN_PIC'] || row['Wellen PIC'] || 'BPK. JHONNY'),
          sender_telp: String(row['SENDER_TELP'] || row['Sender Telp'] || '021-5506999'),
          sender_email: String(row['SENDER_EMAIL'] || row['Sender Email'] || 'info@wellenprint.com')
        };
      })
      .filter((item) => item.no_spk !== '-' || item.client !== '-');

    if (formattedData.length === 0) {
      alert('❌ Validasi Gagal: Data Excel kosong atau header tidak sesuai!');
      return;
    }

    const { error } = await supabase.from('spk_data').insert(formattedData);
    if (error) {
      alert('Gagal simpan data ke Supabase: ' + error.message);
    } else {
      alert(`✅ SUKSES! ${formattedData.length} Data Excel Berhasil Disimpan ke Supabase & Tampil untuk Semua Orang!`);
      fetchSpkData();
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);
        await processAndInsertToSupabase(rawData);
      } catch (err) {
        alert('Format file Excel tidak sesuai: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className={`min-h-screen p-6 font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-gradient-to-br from-[#FBF9F5] via-[#F3EFE6] to-[#E5E0D5] text-[#2F3E3B]'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white/80 border-[#D8D2C2] backdrop-blur-md'} gap-4`}>
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>WEB-TRACK MONITORING</h1>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>Sistem Pelacak Progress Produksi & Pengiriman SPK</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleTheme} className={`px-3 py-2 rounded-xl text-xs font-semibold border ${isDarkMode ? 'bg-neutral-700 text-yellow-300 border-neutral-600' : 'bg-white text-slate-700 border-[#D8D2C2]'}`}>
              {isDarkMode ? '☀️ Mode Terang' : '🌙 Mode Gelap'}
            </button>
            <label className={`px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold shadow-sm text-white ${isDarkMode ? 'bg-blue-600' : 'bg-[#6B8E85]'}`}>
              <span>📁 Upload Excel SPK Store</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className={`flex gap-2 overflow-x-auto border-b pb-2 ${isDarkMode ? 'border-neutral-800' : 'border-[#D8D2C2]'}`}>
          {['dashboard', 'produksi', 'finishing', 'paking', 'pengiriman', 'label'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all whitespace-nowrap ${activeTab === tab ? (isDarkMode ? 'bg-blue-600 text-white' : 'bg-[#6B8E85] text-white') : (isDarkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-white/70 text-[#4A5D58]')}`}>
              {tab === 'label' ? '🏷️ Cetak Label & SJ' : tab}
            </button>
          ))}
        </div>

        {activeTab === 'label' && (
          <LabelGeneratorTab isDarkMode={isDarkMode} spkList={spkList} fetchSpkData={fetchSpkData} processAndInsertToSupabase={processAndInsertToSupabase} />
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CircularGaugeCard title="Completion Rate" percent={spkList.length > 0 ? 100 : 0} color="#2D5A27" detailText={`${spkList.length} SPK Online`} />
              <CircularGaugeCard title="Total Target Order" percent={spkList.length > 0 ? 100 : 0} color="#4F46E5" detailText={`${spkList.reduce((a, b) => a + (Number(b.qty_order) || 0), 0).toLocaleString()} Pcs`} />
              <CircularGaugeCard title="Finishing Progress" percent={100} color="#D97706" detailText="Inhouse & Sub-Vendor" />
              <CircularGaugeCard title="Stage Pengiriman" percent={100} color="#0D9488" detailText="Status Delivery SPK" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}