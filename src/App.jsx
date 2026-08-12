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
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="7"
            className="text-stone-200 dark:text-neutral-700 fill-none"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="fill-none transition-all duration-700 ease-out"
          />
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

function LabelGeneratorTab({ isDarkMode }) {
  const [labelData, setLabelData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [headerLogoUrl, setHeaderLogoUrl] = useState(() => {
    return localStorage.getItem('wellen_header_logo') || '';
  });

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
    reader.onload = (evt) => {
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

        const cleanedData = rawData
          .map((row) => {
            const noSpk = String(row.NO_SPK || row['No SPK'] || row.no_spk || '').trim();
            const client = String(row.CLIENT || row.Client || row.client || row.COMPANY || row['Nama Klient'] || '').trim();
            const itemDesc = String(row.ITEM_DESCRIPTION || row['Item Description'] || row.item_description || '').trim();
            
            const rawQty = 
              row.QTY_TOTAL || row['Qty Total'] || row.qty_total || 
              row.QTY || row.Qty || row.qty || 
              row.QUANTITY || row.Quantity || row.quantity || 
              row['TOTAL QTY ORDER'] || row['qty Order'] || row['QTY ORDER'] || row['Total Qty'] ||
              row['QTY PACKING'] || row['QTY ORDER (PCS)'] || 0;

            const rawKoli = 
              row.QTY_PER_KOLI || row['Qty Per Koli'] || row.qty_per_koli || 
              row['ISI PER KOLI'] || row['ISI/KOLI'] || row['QTY/KOLI'] || 20;

            const deliveryAddress = String(
              row.DELIVERY_ADDRESS || row['Delivery Address'] || row.delivery_address || 
              row['ALAMAT_PENERIMA'] || row['Alamat Penerima'] || row['alamat_penerima'] || 
              row['ALAMAT'] || row['Alamat'] || row['alamat'] || row['Alamat Kirim'] || ''
            ).trim();

            return {
              NO_SPK: noSpk,
              PO_NUMBER: String(row.PO_NUMBER || row['PO Number'] || row.po_number || row['NO PO'] || '').trim(),
              NO_SJ: String(row.NO_SJ || row['NO SJ'] || row.no_sj || `WL-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`).trim(),
              CLIENT: client,
              BRAND: String(row.BRAND || row.Brand || row.brand || itemDesc).trim(),
              RECIPIENT_NAME: String(row.RECIPIENT_NAME || row['Recipient Name'] || row.recipient_name || row['UP'] || row['Nama Penerima'] || '').trim(),
              RECIPIENT_PHONE: String(row.RECIPIENT_PHONE || row['Recipient Phone'] || row.recipient_phone || row['No Telp Penerima'] || '').trim(),
              DELIVERY_ADDRESS: deliveryAddress,
              ITEM_DESCRIPTION: itemDesc,
              MEDIA: String(row.MEDIA || row.Media || row.media || '').trim(),
              UKURAN: String(row.UKURAN || row.Ukuran || row.ukuran || '').trim(),
              QTY_TOTAL: Number(String(rawQty).replace(/[^0-9]/g, '')) || 0,
              QTY_PER_KOLI: Number(String(rawKoli).replace(/[^0-9]/g, '')) || 20,
              DATE_PRODUCTION: String(row.DATE_PRODUCTION || row['Date Production'] || row.date_production || row['TANGGAL'] || '12-Aug-26').trim(),
              SENDER: String(row.SENDER || row.Sender || 'WELLEN PRINT').trim(),
              WELLEN_PIC: String(row.WELLEN_PIC || row['Wellen PIC'] || 'BPK. JHONNY').trim(),
              SENDER_TELP: String(row.SENDER_TELP || row['Sender Telp'] || '021-5506999').trim(),
              SENDER_EMAIL: String(row.SENDER_EMAIL || row['Sender Email'] || 'info@wellenprint.com').trim(),
              VISUAL_IMAGE: String(row.VISUAL_IMAGE || row['Visual Image'] || '').trim()
            };
          })
          .filter((item) => item.NO_SPK !== '' || item.CLIENT !== '' || item.ITEM_DESCRIPTION !== '' || item.QTY_TOTAL > 0);

        if (cleanedData.length === 0) {
          alert('❌ Validasi Gagal: Format kolom Excel tidak cocok!');
          setLabelData([]);
          return;
        }

        setLabelData(cleanedData);
        setSelectedRows([]);
        alert(`✅ Sukses Validasi! ${cleanedData.length} baris data berhasil di-import.`);
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImageUploadRow = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Url = evt.target.result;
      setLabelData((prev) =>
        prev.map((item, i) => (i === index ? { ...item, VISUAL_IMAGE: base64Url } : item))
      );
    };
    reader.readAsDataURL(file);
  };

  const handleClearData = () => {
    if (confirm('Apakah Anda yakin ingin membersihkan seluruh data import pada tabel?')) {
      setLabelData([]);
      setSelectedRows([]);
    }
  };

  const handleToggleCheck = (index) => {
    setSelectedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === labelData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(labelData.map((_, idx) => idx));
    }
  };

  const renderHeaderLogoHtml = () => {
    if (headerLogoUrl) {
      return `<img src="${headerLogoUrl}" style="height:65px; max-width:200px; object-fit:contain; display:block;">`;
    }
    return `
      <div style="font-weight:900; font-size:22px; line-height:1; color:#000;">
        WELLEN<br><span style="font-size:13px; letter-spacing:6px;">PRINT</span>
      </div>
    `;
  };

  const handlePrintLabels = async () => {
    if (selectedRows.length === 0) {
      alert('⚠️ Silakan centang minimal 1 baris data untuk dicetak!');
      return;
    }

    const itemsToPrint = labelData.filter((_, idx) => selectedRows.includes(idx));

    const pagesHtml = await Promise.all(
      itemsToPrint.map(async (item) => {
        const totalQty = Number(item.QTY_TOTAL || 0);
        const qtyPerKoli = Number(item.QTY_PER_KOLI || 20);
        const totalKoli = Math.ceil(totalQty / qtyPerKoli) || 1;

        let koliHtmls = [];
        for (let k = 1; k <= totalKoli; k++) {
          const currentQty = (k === totalKoli && totalQty % qtyPerKoli !== 0) ? (totalQty % qtyPerKoli) : qtyPerKoli;
          const qrAddress = item.NO_SPK ? `SPK:${item.NO_SPK}|KOLI:${k}/${totalKoli}` : 'WELLEN-PRINT';
          
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
                    <td style="width: 25%; vertical-align: middle;">${renderHeaderLogoHtml()}</td>
                    <td style="width: 55%; text-align:center; font-size:9px; line-height: 1.2; vertical-align: middle;">
                      <strong style="font-size:13px;">PT. WELLEN PRINT</strong><br>
                      Green Sedayu Bizpark. Jl. Daan Mogot KM.18 blok DM3 No.18, Kalideres,<br>
                      RT.11/RW.6, Kalideres, Kec. Kalideres, Kota Jakarta Barat, 11840
                    </td>
                    <td style="width: 20%; text-align:right; vertical-align: middle;">
                      ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:65px; height:65px; display:inline-block;">` : ''}
                    </td>
                  </tr>
                </table>

                <div class="content-grid">
                  <div class="grid-box">
                    <strong>SENDER:</strong> ${item.SENDER || 'WELLEN PRINT'}<br>
                    <strong>WELLEN PIC:</strong> ${item.WELLEN_PIC || 'BPK. JHONNY'}<br>
                    <strong>NO. TELP:</strong> ${item.SENDER_TELP || '021-5506999'}<br>
                    <strong>EMAIL:</strong> ${item.SENDER_EMAIL || 'info@wellenprint.com'}
                  </div>
                  <div class="grid-box">
                    <strong>CLIENT:</strong> ${item.CLIENT || '-'}<br>
                    <strong>Delivery Address:</strong> ${item.DELIVERY_ADDRESS || '-'}<br>
                    <strong>Recipient Name:</strong> ${item.RECIPIENT_NAME || '-'}<br>
                    <strong>Recipient Phone:</strong> ${item.RECIPIENT_PHONE || '-'}
                  </div>
                  <div class="grid-box">
                    <strong>PO NUMBER:</strong> ${item.PO_NUMBER || '-'}<br>
                    <strong>NO. SPK:</strong> ${item.NO_SPK || '-'}<br>
                    <strong>ITEM DESCRIPTION:</strong> ${item.ITEM_DESCRIPTION || '-'}<br>
                    <strong>MEDIA:</strong> ${item.MEDIA || '-'}<br>
                    <strong>UKURAN:</strong> ${item.UKURAN || '-'}<br>
                    <strong>QUANTITY:</strong> ${currentQty} PCS<br>
                    <strong>DATE PRODUCTION:</strong> ${item.DATE_PRODUCTION || '-'}
                  </div>
                  <div class="grid-box visual-box">
                    <div><strong>VISUAL IMAGE :</strong></div>
                    <div class="koli-title">${k} OF ${totalKoli}</div>
                    ${item.VISUAL_IMAGE ? `<img src="${item.VISUAL_IMAGE}" class="preview-img">` : `<div style="font-size:10px; opacity:0.5;">[ No Image ]</div>`}
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
          @media print {
            body { padding: 0; }
            .label-page { page-break-after: always; break-after: page; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml.join('')}
      </body>
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

    const itemsToPrint = labelData.filter((_, idx) => selectedRows.includes(idx));

    const pagesHtml = itemsToPrint.map((item) => {
      return `
        <div class="sj-page">
          <!-- Top Header -->
          <div class="sj-top-header">
            <div class="logo-sec">
              ${renderHeaderLogoHtml()}
            </div>
            <div class="sj-title">Tanda Terima</div>
          </div>

          <!-- Info Boxes Header -->
          <div class="info-row">
            <div class="info-box left-box">
              <div class="info-line">Kepada Yth :</div>
              <div class="info-line font-bold">${item.CLIENT || '-'}</div>
              <div class="info-line">${item.DELIVERY_ADDRESS || '-'}</div>
              <div class="info-line">UP : ${item.RECIPIENT_NAME || '-'} ${item.RECIPIENT_PHONE || ''}</div>
            </div>

            <div class="right-box-container">
              <table class="meta-table">
                <tr>
                  <td class="font-bold">NO PO</td>
                  <td>: ${item.PO_NUMBER || '-'}</td>
                </tr>
                <tr>
                  <td class="font-bold">BRAND</td>
                  <td>: ${item.BRAND || item.ITEM_DESCRIPTION || '-'}</td>
                </tr>
                <tr>
                  <td class="font-bold">NO SJ</td>
                  <td>: ${item.NO_SJ || '-'}</td>
                </tr>
              </table>

              <div class="date-box">
                <div class="date-header">TANGGAL</div>
                <div class="date-value">${item.DATE_PRODUCTION || '12-Aug-26'}</div>
              </div>
            </div>
          </div>

          <!-- Main Table Detail Barang -->
          <table class="item-grid-table">
            <thead>
              <tr>
                <th style="width: 8%;">NO</th>
                <th style="width: 25%;">AMO/DEPO</th>
                <th style="width: 27%;">AMO</th>
                <th>
                  <div>${item.ITEM_DESCRIPTION || 'SUNSCREEN'}</div>
                  <div class="font-normal" style="font-size: 11px;">${item.BRAND || 'JUARA INTENS'}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center;">1</td>
                <td>AMO/DEPO</td>
                <td></td>
                <td style="text-align: right; padding-right: 15px;">${Number(item.QTY_TOTAL || 0).toLocaleString()}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-center font-bold">TOTAL</td>
                <td style="text-align: right; padding-right: 15px;" class="font-bold">${Number(item.QTY_TOTAL || 0).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          <!-- Signature Box Bottom -->
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
          
          /* Top Header */
          .sj-top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .sj-title { font-size: 26px; font-weight: bold; text-align: right; }

          /* Info Rows */
          .info-row { display: flex; gap: 15px; margin-bottom: 10px; }
          .info-box { border: 1.5px solid #000; padding: 6px 10px; font-size: 11px; line-height: 1.4; }
          .left-box { flex: 1; height: 75px; }
          .right-box-container { width: 42%; display: flex; flex-direction: column; gap: 6px; }

          .meta-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; }
          .meta-table td { padding: 2px 6px; border: none; }
          
          .date-box { border: 1.5px solid #000; height: 38px; display: flex; flex-direction: column; text-align: center; font-size: 10px; }
          .date-header { border-bottom: 1px solid #000; font-weight: bold; padding: 1px 0; background: #f8f8f8; }
          .date-value { padding-top: 3px; font-weight: bold; font-size: 11px; }

          /* Grid Table */
          .item-grid-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; margin-bottom: 15px; }
          .item-grid-table th, .item-grid-table td { border: 1.5px solid #000; padding: 5px; }
          .item-grid-table th { text-align: center; background: #f8f8f8; }
          .item-grid-table tfoot td { background: #f8f8f8; }

          /* Signatures */
          .signature-row { display: flex; justify-space-around; text-align: center; font-size: 11px; font-weight: bold; margin-top: 15px; }
          .sig-box { width: 200px; border-top: 1px solid transparent; padding-top: 40px; }

          @media print {
            body { padding: 0; }
            .sj-page { page-break-after: always; break-after: page; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
  };

  return (
    <div className="space-y-4">
      {/* Panel Upload Logo KOP Header */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-[#D8D2C2]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-16 h-12 rounded-xl border bg-stone-50 dark:bg-neutral-900 flex items-center justify-center overflow-hidden p-1">
            {headerLogoUrl ? (
              <img src={headerLogoUrl} alt="Logo Header" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[10px] font-bold opacity-50 text-center">No Logo</span>
            )}
          </div>
          <div>
            <h4 className="font-bold text-xs">🖼️ Logo Header KOP (Label & Surat Jalan)</h4>
            <p className="text-[11px] opacity-70">
              {headerLogoUrl ? '✅ Logo KOP aktif (Tersimpan)' : '⚠️ Menggunakan teks default "WELLEN PRINT"'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm bg-purple-600 hover:bg-purple-500 transition-all active:scale-95">
            🖼️ Upload Logo KOP Wellen
            <input type="file" accept="image/*" onChange={handleUploadHeaderLogo} className="hidden" />
          </label>

          {headerLogoUrl && (
            <button
              onClick={handleResetHeaderLogo}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Top Action Controls */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${
        isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <label className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm transition-all ${
            isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#6B8E85] hover:bg-[#57756D]'
          }`}>
            📁 Import Excel Format Label & SJ
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" />
          </label>

          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            📥 Download Template Excel
          </button>

          {labelData.length > 0 && (
            <button
              onClick={handleClearData}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
            >
              🧹 Bersihkan Import
            </button>
          )}

          <span className="text-xs opacity-70 ml-2">
            Terisi: <strong>{labelData.length}</strong> Baris Data Valid
          </span>
        </div>

        {/* Buttons Action Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintSuratJalan}
            disabled={selectedRows.length === 0}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${
              selectedRows.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            📄 Cetak Surat Jalan ({selectedRows.length})
          </button>

          <button
            onClick={handlePrintLabels}
            disabled={selectedRows.length === 0}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${
              selectedRows.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95'
                : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            🏷️ Cetak Label ({selectedRows.length})
          </button>
        </div>
      </div>

      {/* Grid Table Data Preview */}
      <div className={`overflow-x-auto rounded-2xl border shadow-sm ${
        isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2]'
      }`}>
        <table className="w-full text-left text-xs">
          <thead className={`font-bold border-b ${
            isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'
          }`}>
            <tr>
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={labelData.length > 0 && selectedRows.length === labelData.length}
                  onChange={handleSelectAll}
                  className="cursor-pointer accent-indigo-600"
                />
              </th>
              <th className="p-3">No SPK / PO / SJ</th>
              <th className="p-3">Client & Brand</th>
              <th className="p-3">Penerima & Alamat</th>
              <th className="p-3">Deskripsi / Media / Ukuran</th>
              <th className="p-3">Total Qty</th>
              <th className="p-3">Isi/Koli</th>
              <th className="p-3">Visual Image</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
            {labelData.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-6 text-center opacity-60">
                  Tabel kosong. Silakan klik tombol <strong>"Download Template Excel"</strong> di atas.
                </td>
              </tr>
            ) : (
              labelData.map((row, idx) => {
                const total = Number(row.QTY_TOTAL || 0);
                const koli = Number(row.QTY_PER_KOLI || 20);
                const isChecked = selectedRows.includes(idx);

                return (
                  <tr key={idx} className={`transition-colors ${
                    isChecked
                      ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70'
                      : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'
                  }`}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCheck(idx)}
                        className="cursor-pointer accent-indigo-600"
                      />
                    </td>
                    <td className="p-3 font-bold text-blue-500">
                      {row.NO_SPK || '-'}<br />
                      <span className="font-normal text-[10px] opacity-70">PO: {row.PO_NUMBER || '-'}</span><br />
                      <span className="font-normal text-[10px] text-emerald-500">SJ: {row.NO_SJ || '-'}</span>
                    </td>
                    <td className="p-3">
                      <strong className="text-xs">{row.CLIENT || '-'}</strong><br />
                      <span className="text-[10px] opacity-70">{row.BRAND || '-'}</span>
                    </td>
                    <td className="p-3">
                      <strong>{row.RECIPIENT_NAME || '-'}</strong> ({row.RECIPIENT_PHONE || '-'})<br />
                      <span className="text-[10px] opacity-70">{row.DELIVERY_ADDRESS || '-'}</span>
                    </td>
                    <td className="p-3">
                      {row.ITEM_DESCRIPTION || '-'}<br />
                      <span className="text-[10px] opacity-70">{row.MEDIA || '-'} ({row.UKURAN || '-'})</span>
                    </td>
                    <td className="p-3 font-bold">{total.toLocaleString()} Pcs</td>
                    <td className="p-3">{koli} Pcs</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {row.VISUAL_IMAGE ? (
                          <img src={row.VISUAL_IMAGE} alt="Preview" className="w-12 h-8 object-contain border rounded bg-white" />
                        ) : (
                          <span className="text-[10px] opacity-50">Belum ada</span>
                        )}
                        <label className="cursor-pointer px-2 py-1 bg-stone-200 dark:bg-neutral-700 hover:bg-stone-300 rounded text-[10px] font-bold">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUploadRow(e, idx)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </td>
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
  
  // State untuk Checkbox Pilihan SPK (Batch Print)
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);

  // State Modal Link Google Sheet
  const [showGSheetModal, setShowGSheetModal] = useState(false);
  const [gSheetUrl, setGSheetUrl] = useState('');
  const [importingGSheet, setImportingGSheet] = useState(false);

  // State Modal Scanner & Input Manual
  const [showScanModal, setShowScanModal] = useState(false);
  const [inputMode, setInputMode] = useState('scan');
  const [scanTargetColumn, setScanTargetColumn] = useState('qc_checker');
  const [qcStaffName, setQcStaffName] = useState(STAFF_QC_LIST[2]);
  const [scannedInput, setScannedInput] = useState('');
  const [lastScanMessage, setLastScanMessage] = useState('');

  // State Form Panel Finishing
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({
    finishing_type: 'inhouse',
    sub_vendor_name: '',
    qty_finish_sub_out: 0,
    qty_finish: 0,
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    fetchSpkData();
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const nextMode = !prev;
      localStorage.setItem('theme', nextMode ? 'dark' : 'light');
      return nextMode;
    });
  };

  const fetchSpkData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('spk_data')
      .select('*')
      .order('id', { ascending: false });
      
    if (error) {
      console.error('Error fetching data:', error);
    } else {
      setSpkList(data || []);
      if (data && data.length > 0 && !selectedSpkId) {
        initFinishingForm(data[0]);
      }
    }
    setLoading(false);
  };

  const initFinishingForm = (item) => {
    if (!item) return;
    setSelectedSpkId(item.id);
    setFinishingForm({
      finishing_type: item.finishing_type || 'inhouse',
      sub_vendor_name: item.sub_vendor_name || '',
      qty_finish_sub_out: item.qty_finish_sub_out || 0,
      qty_finish: item.qty_finish || 0,
    });
  };

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId);
    const item = spkList.find((s) => String(s.id) === String(spkId));
    if (item) {
      setFinishingForm({
        finishing_type: item.finishing_type || 'inhouse',
        sub_vendor_name: item.sub_vendor_name || '',
        qty_finish_sub_out: item.qty_finish_sub_out || 0,
        qty_finish: item.qty_finish || 0,
      });
    }
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds((prev) => {
      const isExist = prev.includes(id);
      const updated = isExist ? prev.filter((item) => item !== id) : [...prev, id];
      
      if (!isExist) {
        handleSelectSpk(id);
      }
      return updated;
    });
  };

  const handleToggleSelectAll = (filteredItems) => {
    if (selectedSpkIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedSpkIds([]);
    } else {
      setSelectedSpkIds(filteredItems.map((item) => item.id));
      if (filteredItems.length > 0) {
        handleSelectSpk(filteredItems[0].id);
      }
    }
  };

  const handleSubmitInput = (e) => {
    if (e) e.preventDefault();
    if (!scannedInput.trim()) return;
    handleProcessScan(scannedInput);
  };

  const handleProcessScan = async (codeValue) => {
    if (!codeValue) return;

    const cleanCode = codeValue.toString().replace(/[\r\n]+/g, '').trim();
    const val = cleanCode.toLowerCase();
    
    const targetItem = spkList.find((item) => {
      const qr = (item.qr_address || '').toLowerCase();
      const store = (item.store_code || '').toLowerCase();
      const spk = (item.no_spk || '').toLowerCase();
      const proj = (item.project || '').toLowerCase();

      return qr.includes(val) || store === val || spk.includes(val) || proj.includes(val) || val.includes(spk);
    });

    if (!targetItem) {
      setLastScanMessage(`❌ Toko/Kode/SPK "${cleanCode}" tidak ditemukan di Webtrack!`);
      setScannedInput('');
      return;
    }

    const updaterValue = qcStaffName ? `${qcStaffName} (OK)` : 'VERIFIED (OK)';

    let updatePayload = { tes_scan: updaterValue };
    if (scanTargetColumn === 'qc_paking') updatePayload.qc_paking = updaterValue;
    if (scanTargetColumn === 'qc_checker') updatePayload.qc_checker = updaterValue;
    if (scanTargetColumn === 'qc_deliver') updatePayload.qc_deliver = updaterValue;
    if (scanTargetColumn === 'qty_finish') updatePayload.qty_finish = targetItem.qty_order;

    setSpkList((prev) =>
      prev.map((item) => (item.id === targetItem.id ? { ...item, ...updatePayload } : item))
    );

    const { error } = await supabase
      .from('spk_data')
      .update(updatePayload)
      .eq('id', targetItem.id);

    if (error) {
      console.error("Error Supabase:", error);
      setLastScanMessage(`⚠️ Webtrack terupdate, tapi Supabase error: ${error.message}`);
      setScannedInput('');
      return;
    }

    try {
      const formData = new URLSearchParams();
      formData.append('scanned_code', cleanCode);
      formData.append('qc_checker', updaterValue);
      formData.append('column_target', scanTargetColumn);

      await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      setLastScanMessage(`✅ SUKSES! [${scanTargetColumn.toUpperCase()}] "${targetItem.project}" (${targetItem.no_spk}) terbaca di Webtrack & Google Sheets!`);
    } catch (err) {
      setLastScanMessage(`✅ Webtrack & Supabase terisi, tapi Sheets error: ${err.message}`);
    }

    setScannedInput('');
  };

  const handleBatchPrint = async () => {
    const itemsToPrint = spkList.filter((item) => selectedSpkIds.includes(item.id));
    
    if (itemsToPrint.length === 0) {
      alert('⚠️ Silakan centang minimal 1 SPK terlebih dahulu!');
      return;
    }

    const labelsHtmlArray = await Promise.all(
      itemsToPrint.map(async (item, idx) => {
        const qrAddress = item.qr_address || `204A_${item.client || 'MINISO'}_${item.project}`;
        let qrDataUrl = '';
        
        try {
          qrDataUrl = await QRCode.toDataURL(qrAddress, { width: 120, margin: 1 });
        } catch (err) {
          console.error("Gagal generate QR Code Base64:", err);
        }

        return `
          <div class="label-card">
            <table class="header-table">
              <tr>
                <td>
                  <div class="title">${item.client || 'PT. KREASI DIGITAL INDOMAJU'}</div>
                  <div>DELIVERY: <strong>${item.delivery_route || 'DALAM KOTA'}</strong></div>
                  <div>PROJECT: POP A5 & WOBBLER (PR 204)</div>
                </td>
                <td style="text-align: right;">
                  <div style="font-size: 16px; font-weight: bold;">NOMOR TOKO: ${item.store_code || '-'}</div>
                  <div>SPK: ${item.no_spk}</div>
                </td>
              </tr>
            </table>

            <div style="margin-top: 5px;">NAMA STORE: <strong>${item.project}</strong></div>
            <div>NO PO: ${item.po_number || '-'}</div>
            <div>QR ADDRESS: <code>${qrAddress}</code></div>

            <div class="qr-sec">
              ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" style="width: 100px; height: 100px; display: inline-block;" />` : `[QR: ${qrAddress}]`}
            </div>

            <table class="item-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Deskripsi Item</th>
                  <th>Bahan / Ukuran</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>1</td><td>A5 Member 1</td><td>Art Paper (A5)</td><td>5 Pcs</td></tr>
                <tr><td>2</td><td>A5 Member 2</td><td>Art Paper (A5)</td><td>5 Pcs</td></tr>
                <tr><td>3</td><td>A5 Member 3</td><td>Art Paper (A5)</td><td>5 Pcs</td></tr>
                <tr><td>4</td><td>Wobbler Member</td><td>Art Carton (10x10cm)</td><td>10 Pcs</td></tr>
                <tr><td>5</td><td>A5 Payday</td><td>Art Paper (A5)</td><td>5 Pcs</td></tr>
                <tr><td>6</td><td>Wobbler Payday</td><td>Art Carton (10x10cm)</td><td>10 Pcs</td></tr>
              </tbody>
            </table>

            <div style="margin-top: 10px; font-weight: bold;">
              QC Paking: ${item.qc_paking || '-'} | QC Checker: ${item.qc_checker || '-'} | QC Deliver: ${item.qc_deliver || '-'}
            </div>

            <div class="footer">
              TOTAL QTY PACKING: ${item.qty_order || 40} PCS (Halaman ${idx + 1} dari ${itemsToPrint.length})
            </div>
          </div>
        `;
      })
    );

    const printWindow = window.open('', '_blank', 'width=850,height=900');

    const fullDocumentHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Batch Label Print (${itemsToPrint.length} Store)</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; background: #f8f9fa; }
          .no-print-bar { 
            position: sticky; top: 0; background: #ffffff; padding: 15px; 
            border-bottom: 2px solid #e2e8f0; text-align: center; margin-bottom: 20px; z-index: 1000;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          }
          .btn-print { 
            padding: 10px 24px; font-size: 14px; font-weight: bold; 
            background: #4F46E5; color: white; border: none; border-radius: 8px; cursor: pointer; 
          }
          .btn-print:hover { background: #4338CA; }
          .label-card { 
            border: 2px solid #000; padding: 15px; max-width: 580px; margin: 0 auto 30px auto; 
            background: #ffffff; border-radius: 8px; page-break-after: always; break-after: page; 
          }
          .header-table { width: 100%; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
          .title { font-size: 14px; font-weight: bold; }
          .qr-sec { text-align: center; margin: 10px 0; }
          .item-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .item-table th, .item-table td { border: 1px solid #000; padding: 5px; text-align: left; }
          .item-table th { background: #f2f2f2; }
          .footer { margin-top: 12px; font-weight: bold; text-align: right; font-size: 12px; }
          @media print {
            body { padding: 0; background: #ffffff; }
            .no-print-bar { display: none; }
            .label-card { border: 2px solid #000; margin: 0 auto; page-break-after: always; break-after: page; }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <button class="btn-print" onclick="window.print()">🖨️ Cetak ${itemsToPrint.length} Label Sekaligus (Merge & Print PDF)</button>
        </div>
        ${labelsHtmlArray.join('')}
      </body>
      </html>
    `;

    printWindow.document.write(fullDocumentHtml);
    printWindow.document.close();
  };

  const handleTypeChange = (newType) => {
    const activeItem = spkList.find((s) => String(s.id) === String(selectedSpkId));
    const currentDbTypes = activeItem?.finishing_type || 'inhouse';

    if (newType === currentDbTypes) {
      setFinishingForm({
        finishing_type: newType,
        sub_vendor_name: activeItem?.sub_vendor_name || '',
        qty_finish_sub_out: activeItem?.qty_finish_sub_out || 0,
        qty_finish: activeItem?.qty_finish || 0,
      });
    } else {
      setFinishingForm({
        finishing_type: newType,
        sub_vendor_name: '',
        qty_finish_sub_out: 0,
        qty_finish: 0,
      });
    }
  };

  const processImportData = async (rawData) => {
    const formattedData = rawData
      .filter((row) => (row['Store Name'] || row['Nama Project'] || row['COMPANY'] || row['SPK/WPP'] || row['No SPK']))
      .map((row) => {
        const rawSpk = String(row['SPK/WPP'] || row['No SPK'] || '-');
        const cleanSpk = rawSpk.split('/')[0].trim();

        return {
          no_spk: cleanSpk,
          client: String(row['COMPANY'] || row['Nama Klient'] || '-'),
          project: String(row['Store Name'] || row['Nama Project'] || '-'),
          bahan: String(row['Nama Bahan'] || 'Art Paper & Art Carton'),
          ukuran: String(row['Ukuran'] || 'A5 & Wobbler 10x10cm'),
          qty_order: Number(row['TOTAL QTY ORDER'] || row['qty Order'] || 40),
          qty_print: 0,
          qty_finish: 0,
          qty_finish_sub_out: 0,
          finishing_type: 'inhouse',
          sub_vendor_name: '',
          qty_pack: 0,
          qty_ship: 0,
          store_code: String(row['NO. STORE'] || row['Store ID'] || '-'),
          delivery_route: String(row['DELIVERY'] || 'DALAM KOTA'),
          po_number: String(row['NO. PO'] || '-'),
          qr_address: String(row['QR ADDRESS'] || '-'),
          qc_paking: String(row['QC Paking'] || row['qc_paking'] || ''),
          qc_checker: String(row['QC Checker'] || row['qc_checker'] || ''),
          qc_deliver: String(row['QC Deliver'] || row['qc_deliver'] || ''),
          tes_scan: String(row['tes scan'] || row['Tes Scan'] || row['tes_scan'] || '')
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
      alert(`✅ Sukses! ${formattedData.length} Data SPK Valid Berhasil Diimport.`);
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
        
        const rawData = XLSX.utils.sheet_to_json(ws, { range: 2 });
        await processImportData(rawData);
      } catch (err) {
        alert('Format file Excel tidak sesuai: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportGoogleSheets = async () => {
    if (!gSheetUrl) {
      alert('⚠️ Masukkan link Google Sheets terlebih dahulu!');
      return;
    }

    setImportingGSheet(true);
    try {
      const matches = gSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!matches || !matches[1]) {
        throw new Error('Link Google Sheets tidak valid.');
      }

      const sheetId = matches[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Gagal mengambil data dari Google Sheets. Pastikan akses diset Publik.');
      }

      const csvText = await response.text();
      const wb = XLSX.read(csvText, { type: 'string' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];

      const rawData = XLSX.utils.sheet_to_json(ws, { range: 2 });
      await processImportData(rawData);

      setShowGSheetModal(false);
      setGSheetUrl('');
    } catch (err) {
      alert('❌ Error Import Google Sheets: ' + err.message);
    }
    setImportingGSheet(false);
  };

  const handleUpdateField = async (id, payload) => {
    const { error } = await supabase.from('spk_data').update(payload).eq('id', id);
    if (!error) {
      setSpkList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...payload } : item))
      );
    } else {
      alert('Gagal memperbarui data: ' + error.message);
    }
  };

  const handleUpdateQty = async (id, field, value, maxAllowed, customErrorMessage) => {
    const val = Number(value) || 0;

    if (val > maxAllowed) {
      alert(customErrorMessage || `❌ Gagal: Jumlah tidak boleh melebihi ${maxAllowed.toLocaleString()} pcs!`);
      return;
    }

    handleUpdateField(id, { [field]: val });
  };

  // HANDLER FINISHING DENGAN LOGIKA SET VALUE (TANPA AKUMULASI GANDA) & VALIDASI BERANTAI
  const handleSubmitFinishing = async (e) => {
    e.preventDefault();
    const activeItem = spkList.find((s) => String(s.id) === String(selectedSpkId));
    if (!activeItem) return;

    const { finishing_type, sub_vendor_name, qty_finish_sub_out, qty_finish } = finishingForm;

    const outQty = Number(qty_finish_sub_out) || 0;
    const backQty = Number(qty_finish) || 0;

    // KALKULASI BATASAN TERHADAP QTY PRINT (JIKA PRINT KOSONG, GUNAKAN QTY ORDER)
    const maxFinishingAllowed = Number(activeItem.qty_print > 0 ? activeItem.qty_print : activeItem.qty_order || 0);

    if (finishing_type === 'sub') {
      if (outQty > maxFinishingAllowed) {
        alert(`❌ Gagal: Jumlah barang keluar ke vendor (${outQty} pcs) tidak boleh melebihi Qty Print (${maxFinishingAllowed} pcs)!`);
        return;
      }
      if (outQty === 0 && backQty > 0) {
        alert(`❌ Gagal: Barang belum pernah dikirim ke vendor (Out = 0 pcs). Tidak bisa mengisi Terima Back!`);
        return;
      }
      if (backQty > outQty) {
        alert(`❌ Gagal: Jumlah barang balik (${backQty} pcs) melebihi jumlah yang dikirim ke vendor (${outQty} pcs)!`);
        return;
      }
    } else {
      if (backQty > maxFinishingAllowed) {
        alert(`❌ Gagal: Jumlah Selesai Finishing (${backQty} pcs) tidak boleh melebihi Qty Print (${maxFinishingAllowed} pcs)!`);
        return;
      }
    }

    const payload = {
      finishing_type,
      sub_vendor_name: finishing_type === 'sub' ? sub_vendor_name : '',
      qty_finish_sub_out: finishing_type === 'sub' ? outQty : 0,
      qty_finish: backQty,
    };

    const { error } = await supabase.from('spk_data').update(payload).eq('id', activeItem.id);
    if (error) {
      alert('Gagal menyimpan data finishing: ' + error.message);
    } else {
      alert(`✅ Data Finishing SPK ${activeItem.no_spk} (${activeItem.client}) berhasil disimpan! Total Selesai: ${backQty} pcs.`);
      fetchSpkData();
    }
  };

  const handleUploadSuratJalan = async (e, item) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `surat_jalan_${item.no_spk}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('surat-jalan')
      .upload(filePath, file);

    if (uploadError) {
      alert('Gagal mengunggah surat jalan: ' + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('surat-jalan')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    const { error: updateError } = await supabase
      .from('spk_data')
      .update({ surat_jalan_url: publicUrl })
      .eq('id', item.id);

    if (updateError) {
      alert('Gagal menyimpan URL Surat Jalan: ' + updateError.message);
    } else {
      alert('Surat Jalan berhasil diunggah!');
      setSpkList((prev) =>
        prev.map((spk) => (spk.id === item.id ? { ...spk, surat_jalan_url: publicUrl } : spk))
      );
    }
  };

  const getPercent = (qty, total) => {
    if (!total || total <= 0) return 0;
    const calc = Math.round((qty / total) * 100);
    return calc > 100 ? 100 : calc;
  };

  const getStatusBadge = (percent) => {
    if (isDarkMode) {
      if (percent >= 100) return { icon: '🟢', text: 'text-green-400 bg-green-950/60 border-green-800' };
      if (percent > 0) return { icon: '🟡', text: 'text-yellow-400 bg-yellow-950/60 border-yellow-800' };
      return { icon: '🔴', text: 'text-red-400 bg-red-950/60 border-red-800' };
    } else {
      if (percent >= 100) return { icon: '🟢', text: 'text-[#2D5A27] bg-[#EAF2E8] border-[#C8E0C4]' };
      if (percent > 0) return { icon: '🟡', text: 'text-[#8A6200] bg-[#FFF8E6] border-[#FFE299]' };
      return { icon: '🔴', text: 'text-[#8C2B2B] bg-[#FCEAEA] border-[#F4C7C7]' };
    }
  };

  // KPI Calculator
  const totalSpk = spkList.length;
  const totalOrderPcs = spkList.reduce((acc, curr) => acc + (Number(curr.qty_order) || 0), 0);
  
  const spkWithAvg = spkList.map((item) => {
    const pPrint = getPercent(item.qty_print, item.qty_order);
    const pFinish = getPercent(item.qty_finish, item.qty_order);
    const pPack = getPercent(item.qty_pack, item.qty_order);
    const pShip = getPercent(item.qty_ship, item.qty_order);
    const avg = Math.round((pPrint + pFinish + pPack + pShip) / 4);
    return { ...item, avgProgress: avg, pPrint, pFinish, pPack, pShip };
  });

  const totalAvgProgress = totalSpk > 0 
    ? Math.round(spkWithAvg.reduce((acc, c) => acc + c.avgProgress, 0) / totalSpk) 
    : 0;

  const completedSpkCount = spkWithAvg.filter((item) => item.avgProgress >= 100).length;

  const filteredSpkList = spkWithAvg.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.no_spk?.toLowerCase().includes(q) ||
      item.client?.toLowerCase().includes(q) ||
      item.project?.toLowerCase().includes(q)
    );
  });

  const activeSpkItem = spkList.find((item) => String(item.id) === String(selectedSpkId)) || spkList[0];
  const displayedList = activeTab === 'dashboard' ? filteredSpkList : spkList;

  return (
    <div
      className={`min-h-screen p-6 font-sans antialiased transition-colors duration-300 ${
        isDarkMode
          ? 'bg-neutral-900 text-neutral-100'
          : 'bg-gradient-to-br from-[#FBF9F5] via-[#F3EFE6] to-[#E5E0D5] text-[#2F3E3B]'
      }`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl shadow-sm border transition-colors ${
            isDarkMode
              ? 'bg-neutral-800/90 border-neutral-700'
              : 'bg-white/80 border-[#D8D2C2] backdrop-blur-md'
          } gap-4`}
        >
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>
              WEB-TRACK MONITORING
            </h1>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>
              Sistem Pelacak Progress Produksi & Pengiriman SPK
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleTheme}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
                isDarkMode
                  ? 'bg-neutral-700 hover:bg-neutral-600 text-yellow-300 border-neutral-600'
                  : 'bg-white hover:bg-stone-100 text-slate-700 border-[#D8D2C2]'
              }`}
            >
              {isDarkMode ? '☀️ Mode Terang' : '🌙 Mode Gelap'}
            </button>

            {/* Tombol Scan / Input Manual Multi-Kolom */}
            <button
              onClick={() => setShowScanModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all bg-purple-600 hover:bg-purple-500 text-white active:scale-95"
            >
              <span>📷 Scan & Input Station</span>
            </button>

            {/* Tombol Upload Excel File */}
            <label
              className={`px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-[#6B8E85] hover:bg-[#57756D] text-white'
              }`}
            >
              <span>📁 Upload Excel SPK Store</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
            </label>

            {/* Tombol Import Link Google Sheets */}
            <button
              onClick={() => setShowGSheetModal(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 ${
                isDarkMode
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <span>🔗 Link Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={`flex gap-2 overflow-x-auto border-b pb-2 ${isDarkMode ? 'border-neutral-800' : 'border-[#D8D2C2]'}`}>
          {['dashboard', 'produksi', 'finishing', 'paking', 'pengiriman', 'label'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                activeTab === tab
                  ? isDarkMode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#6B8E85] text-white shadow-sm'
                  : isDarkMode
                  ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700'
                  : 'bg-white/70 text-[#4A5D58] hover:bg-white border border-[#D8D2C2]/70'
              }`}
            >
              {tab === 'label' ? '🏷️ Cetak Label & SJ' : tab}
            </button>
          ))}
        </div>

        {/* TAB 6: FITUR CETAK LABEL & SURAT JALAN BARU */}
        {activeTab === 'label' && (
          <LabelGeneratorTab isDarkMode={isDarkMode} />
        )}

        {/* Dashboard Circular */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CircularGaugeCard 
                title="Completion Rate" 
                percent={totalAvgProgress} 
                color="#2D5A27" 
                detailText={`${completedSpkCount} dari ${totalSpk} SPK Selesai`} 
              />
              <CircularGaugeCard 
                title="Total Target Order" 
                percent={totalSpk > 0 ? Math.round((spkWithAvg.reduce((a, b) => a + b.pPrint, 0) / (totalSpk * 100)) * 100) : 0} 
                color="#4F46E5" 
                detailText={`${totalOrderPcs.toLocaleString()} Pcs Order`} 
              />
              <CircularGaugeCard 
                title="Finishing Progress" 
                percent={totalSpk > 0 ? Math.round((spkWithAvg.reduce((a, b) => a + b.pFinish, 0) / (totalSpk * 100)) * 100) : 0} 
                color="#D97706" 
                detailText="Inhouse & Sub-Vendor" 
              />
              <CircularGaugeCard 
                title="Stage Pengiriman" 
                percent={totalSpk > 0 ? Math.round((spkWithAvg.reduce((a, b) => a + b.pShip, 0) / (totalSpk * 100)) * 100) : 0} 
                color="#0D9488" 
                detailText="Status Delivery SPK" 
              />
            </div>

            <div className={`p-3 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white/90 border-[#D8D2C2]'}`}>
              <span className="text-sm">🔍</span>
              <input
                type="text"
                placeholder="Cari berdasarkan No SPK, nama Klient, atau Store Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full text-xs bg-transparent focus:outline-none ${isDarkMode ? 'text-white' : 'text-[#2F3E3B]'}`}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-xs opacity-60 hover:opacity-100">
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Baris Tombol Aksi Batch Print (Merge & Print) */}
        {activeTab !== 'label' && (
          <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white/90 border-[#D8D2C2]'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">🖨️</span>
              <div>
                <h3 className="font-bold text-xs">Aksi Cetak Masal (Merge & Print)</h3>
                <p className="text-[11px] opacity-70">
                  Dicentang: <strong>{selectedSpkIds.length}</strong> dari <strong>{displayedList.length}</strong> SPK Toko
                </p>
              </div>
            </div>

            <button
              onClick={handleBatchPrint}
              disabled={selectedSpkIds.length === 0}
              className={`px-4 py-2 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${
                selectedSpkIds.length > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95'
                  : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 dark:text-neutral-500 cursor-not-allowed'
              }`}
            >
              <span>🏷️ Cetak {selectedSpkIds.length} Label Sekaligus (Merge & Print PDF)</span>
            </button>
          </div>
        )}

        {/* Panel Kontrol Finishing */}
        {activeTab === 'finishing' && activeSpkItem && (
          <form
            onSubmit={handleSubmitFinishing}
            className={`p-5 rounded-2xl border shadow-sm transition-colors space-y-4 ${
              isDarkMode
                ? 'bg-neutral-800/80 border-neutral-700'
                : 'bg-white/90 border-[#D8D2C2] backdrop-blur-md'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-3 border-black/10 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="text-xl">🛠️</span>
                <div>
                  <h3 className="font-bold text-sm">Panel Kontrol Finishing</h3>
                  <p className="text-xs opacity-70">Kelola pengerjaan Inhouse & Sub-Finishing (Makloon)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold">Pilih SPK:</label>
                <select
                  value={selectedSpkId}
                  onChange={(e) => handleSelectSpk(e.target.value)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold border focus:outline-none ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
                  }`}
                >
                  {spkList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.no_spk} - {item.client} ({item.project})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`grid grid-cols-2 ${finishingForm.finishing_type === 'sub' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 text-xs`}>
              <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-stone-50 border-[#E5E0D5]'}`}>
                <div className="opacity-70 text-[10px]">Qty Order</div>
                <div className="text-base font-bold">{activeSpkItem.qty_order?.toLocaleString()} pcs</div>
              </div>

              <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
                <div className="text-amber-600 dark:text-amber-400 font-medium text-[10px]">
                  {finishingForm.finishing_type === 'sub' ? 'Sisa Order (Belum Out)' : 'Sisa Order (Belum Selesai)'}
                </div>
                <div className="text-base font-bold text-amber-700 dark:text-amber-300">
                  {finishingForm.finishing_type === 'sub'
                    ? Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish_sub_out) || 0)).toLocaleString()
                    : Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()}{' '}
                  pcs
                </div>
              </div>

              {finishingForm.finishing_type === 'sub' ? (
                <>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-blue-950/30 border-blue-800/50' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="text-blue-600 dark:text-blue-400 font-medium text-[10px]">Dikirim ke Vendor (Out)</div>
                    <div className="text-base font-bold text-blue-700 dark:text-blue-300">
                      {(Number(finishingForm.qty_finish_sub_out) || 0).toLocaleString()} pcs
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-green-950/30 border-green-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">Sudah Balik Vendor (Back)</div>
                    <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                      {(Number(finishingForm.qty_finish) || 0).toLocaleString()} pcs
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="text-amber-600 dark:text-amber-400 font-medium text-[10px]">Belum Balik Vendor</div>
                    <div className="text-base font-bold text-amber-700 dark:text-amber-300">
                      {Math.max(0, (Number(finishingForm.qty_finish_sub_out) || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()} pcs
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-green-950/30 border-green-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">Total Selesai Inhouse</div>
                    <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                      {(Number(finishingForm.qty_finish) || 0).toLocaleString()} pcs
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-stone-50 border-[#E5E0D5]'}`}>
                    <div className="opacity-70 text-[10px]">Progres Finishing</div>
                    <div className="text-base font-bold">
                      {getPercent(Number(finishingForm.qty_finish) || 0, activeSpkItem.qty_order || 1)}%
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs pt-2">
              <div>
                <label className="block font-bold mb-1 opacity-80">Tipe Pengerjaan:</label>
                <select
                  value={finishingForm.finishing_type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className={`w-full p-2 rounded-xl font-semibold border ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
                  }`}
                >
                  <option value="inhouse">🏠 Inhouse (Internal)</option>
                  <option value="sub">🏭 Sub-Finishing (Vendor/Luar)</option>
                </select>
              </div>

              {finishingForm.finishing_type !== 'sub' ? (
                <div>
                  <label className="block font-bold mb-1 opacity-80">Jumlah Selesai (pcs):</label>
                  <input
                    type="number"
                    min="0"
                    max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
                    value={finishingForm.qty_finish}
                    onChange={(e) => {
                      let val = Number(e.target.value) || 0;
                      const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                      if (val > maxAllowed) {
                        alert(`❌ Gagal: Jumlah Finishing (${val} pcs) tidak boleh melebihi Qty Print (${maxAllowed} pcs)!`);
                        val = maxAllowed;
                      }
                      setFinishingForm({ ...finishingForm, qty_finish: val });
                    }}
                    className={`w-full p-2 rounded-xl font-semibold border ${
                      isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                    }`}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-bold mb-1 opacity-80">Nama Vendor / Makloon:</label>
                    <input
                      type="text"
                      placeholder="Misal: CV Poly Mas"
                      value={finishingForm.sub_vendor_name}
                      onChange={(e) => setFinishingForm({ ...finishingForm, sub_vendor_name: e.target.value })}
                      className={`w-full p-2 rounded-xl font-semibold border ${
                        isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 opacity-80">1. Kirim Out Vendor (pcs):</label>
                    <input
                      type="number"
                      min="0"
                      max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
                      value={finishingForm.qty_finish_sub_out}
                      onChange={(e) => {
                        let val = Number(e.target.value) || 0;
                        const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                        if (val > maxAllowed) {
                          alert(`❌ Gagal: Jumlah Out ke Vendor (${val} pcs) tidak boleh melebihi Qty Print (${maxAllowed} pcs)!`);
                          val = maxAllowed;
                        }
                        const currentBack = Number(finishingForm.qty_finish) || 0;
                        const adjustedBack = currentBack > val ? val : currentBack;
                        setFinishingForm({ ...finishingForm, qty_finish_sub_out: val, qty_finish: adjustedBack });
                      }}
                      className={`w-full p-2 rounded-xl font-semibold border ${
                        isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 opacity-80">2. Terima Back Vendor (pcs):</label>
                    <input
                      type="number"
                      min="0"
                      disabled={Number(finishingForm.qty_finish_sub_out) <= 0}
                      max={finishingForm.qty_finish_sub_out}
                      value={finishingForm.qty_finish}
                      onChange={(e) => {
                        let val = Number(e.target.value) || 0;
                        const maxBack = Number(finishingForm.qty_finish_sub_out) || 0;
                        if (val > maxBack) {
                          alert(`❌ Jumlah terima back tidak boleh melebihi jumlah yang dikirim ke vendor (${maxBack} pcs)!`);
                          val = maxBack;
                        }
                        setFinishingForm({ ...finishingForm, qty_finish: val });
                      }}
                      className={`w-full p-2 rounded-xl font-semibold border ${
                        Number(finishingForm.qty_finish_sub_out) <= 0
                          ? 'opacity-50 cursor-not-allowed bg-stone-200 dark:bg-neutral-800'
                          : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                      }`}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all text-white ${
                  isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#6B8E85] hover:bg-[#57756D]'
                }`}
              >
                💾 Submit / Simpan Progress Finishing
              </button>
            </div>
          </form>
        )}

        {/* Tabel Data Utama */}
        {activeTab !== 'label' && (
          <div
            className={`overflow-x-auto rounded-2xl border shadow-sm transition-colors ${
              isDarkMode
                ? 'bg-[#121829] border-neutral-800'
                : 'bg-white/90 border-[#D8D2C2] backdrop-blur-md'
            }`}
          >
            <table className="w-full text-left text-xs">
              <thead
                className={`font-bold border-b transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800/80 text-neutral-300 border-neutral-800'
                    : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'
                }`}
              >
                <tr>
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={displayedList.length > 0 && selectedSpkIds.length === displayedList.length}
                      onChange={() => handleToggleSelectAll(displayedList)}
                      className="w-4 h-4 cursor-pointer accent-indigo-600"
                    />
                  </th>
                  <th className="p-4">No SPK</th>
                  <th className="p-4">Klient / Store Name</th>
                  <th className="p-4">Bahan / Ukuran</th>
                  <th className="p-4">Order</th>
                  <th className="p-4">Print</th>
                  <th className="p-4">Finish</th>
                  <th className="p-4">Pack</th>
                  <th className="p-4">QC Paking</th>
                  <th className="p-4">QC Checker</th>
                  <th className="p-4">QC Deliver</th>
                  <th className="p-4">Tes Scan</th>
                  <th className="p-4">Ship</th>
                  <th className="p-4">Total Rata-Rata</th>
                </tr>
              </thead>
              <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
                {displayedList.map((item) => {
                  const pPrint = getPercent(item.qty_print, item.qty_order);
                  const pFinish = getPercent(item.qty_finish, item.qty_order);
                  const pPack = getPercent(item.qty_pack, item.qty_order);
                  const pShip = getPercent(item.qty_ship, item.qty_order);
                  const totalAvg = Math.round((pPrint + pFinish + pPack + pShip) / 4);

                  const isSubFinishing = item.finishing_type === 'sub';
                  const maxPackAllowed = Number(item.qty_finish || 0);
                  const maxShipAllowed = Number(item.qty_pack || 0);

                  const isChecked = selectedSpkIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isChecked
                          ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70'
                          : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'
                      }`}
                    >
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleCheck(item.id)}
                          className="w-4 h-4 cursor-pointer accent-indigo-600"
                        />
                      </td>
                      <td className={`p-4 font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>
                        {item.no_spk}
                      </td>
                      <td className="p-4">
                        <div className={`font-semibold ${isDarkMode ? 'text-neutral-200' : 'text-[#2F3E3B]'}`}>
                          {item.client}
                        </div>
                        <div className={`text-[11px] ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>
                          {item.project}
                        </div>
                      </td>
                      <td className={`p-4 text-[11px] ${isDarkMode ? 'text-neutral-300' : 'text-[#4A5D58]'}`}>
                        <div className="font-medium">{item.bahan}</div>
                        <div className={isDarkMode ? 'text-neutral-500' : 'text-[#8B9B96]'}>{item.ukuran}</div>
                      </td>
                      <td className={`p-4 font-bold ${isDarkMode ? 'text-neutral-200' : 'text-[#2F3E3B]'}`}>
                        {item.qty_order?.toLocaleString()} pcs
                      </td>

                      {/* Print */}
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${getStatusBadge(pPrint).text}`}>
                          <span>{getStatusBadge(pPrint).icon}</span>
                          <span>{pPrint}%</span>
                          <span className="font-normal opacity-70">({item.qty_print?.toLocaleString()})</span>
                        </div>
                        {activeTab === 'produksi' && (
                          <div className="mt-1.5">
                            <input
                              type="number"
                              value={item.qty_print}
                              disabled={item.qty_print >= item.qty_order}
                              onChange={(e) => handleUpdateQty(
                                item.id, 
                                'qty_print', 
                                e.target.value, 
                                item.qty_order,
                                `❌ Gagal: Qty Print tidak boleh melebihi Qty Order (${item.qty_order} pcs)!`
                              )}
                              className={`w-20 border rounded-lg px-2 py-1 text-xs focus:outline-none ${
                                item.qty_print >= item.qty_order
                                  ? isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed' : 'bg-[#EFECE6] border-[#D8D2C2] text-stone-500 cursor-not-allowed'
                                  : isDarkMode ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                              }`}
                            />
                          </div>
                        )}
                      </td>

                      {/* Finish */}
                      <td className="p-4 space-y-1">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${getStatusBadge(pFinish).text}`}>
                          <span>{getStatusBadge(pFinish).icon}</span>
                          <span>{pFinish}%</span>
                          <span className="font-normal opacity-70">({item.qty_finish?.toLocaleString()})</span>
                        </div>

                        {isSubFinishing && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            🛠️ Sub ({item.sub_vendor_name || 'Vendor'}) <br /> Out: {item.qty_finish_sub_out || 0} | Back: {item.qty_finish || 0} pcs
                          </div>
                        )}
                      </td>

                      {/* Pack */}
                      <td className="p-4 space-y-1">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${getStatusBadge(pPack).text}`}>
                          <span>{getStatusBadge(pPack).icon}</span>
                          <span>{pPack}%</span>
                          <span className="font-normal opacity-70">({item.qty_pack?.toLocaleString()})</span>
                        </div>

                        {activeTab === 'paking' && (
                          <div className="mt-1.5">
                            <input
                              type="number"
                              value={item.qty_pack}
                              disabled={item.qty_pack >= maxPackAllowed}
                              onChange={(e) =>
                                handleUpdateQty(
                                  item.id,
                                  'qty_pack',
                                  e.target.value,
                                  maxPackAllowed,
                                  `❌ Gagal: Qty Paking (${e.target.value} pcs) tidak boleh melebihi Qty Finishing yang sudah selesai (${maxPackAllowed} pcs)!`
                                )
                              }
                              className={`w-20 border rounded-lg px-2 py-1 text-xs focus:outline-none ${
                                item.qty_pack >= maxPackAllowed
                                  ? isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed' : 'bg-[#EFECE6] border-[#D8D2C2] text-stone-500 cursor-not-allowed'
                                  : isDarkMode ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                              }`}
                            />
                          </div>
                        )}
                      </td>

                      {/* QC Paking */}
                      <td className="p-4">
                        <select
                          value={item.qc_paking || ''}
                          onChange={(e) => handleUpdateField(item.id, { qc_paking: e.target.value })}
                          className={`p-1 rounded-lg border text-[11px] focus:outline-none ${
                            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                          }`}
                        >
                          <option value="">-- Pilih QC --</option>
                          {STAFF_QC_LIST.map((staff) => (
                            <option key={staff} value={staff}>{staff}</option>
                          ))}
                        </select>
                      </td>

                      {/* QC Checker */}
                      <td className="p-4">
                        <select
                          value={item.qc_checker || ''}
                          onChange={(e) => handleUpdateField(item.id, { qc_checker: e.target.value })}
                          className={`p-1 rounded-lg border text-[11px] font-semibold focus:outline-none ${
                            item.qc_checker 
                              ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/40 dark:text-purple-300' 
                              : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                          }`}
                        >
                          <option value="">-- Pilih QC --</option>
                          {STAFF_QC_LIST.map((staff) => (
                            <option key={staff} value={staff}>{staff}</option>
                          ))}
                        </select>
                      </td>

                      {/* QC Deliver */}
                      <td className="p-4">
                        <select
                          value={item.qc_deliver || ''}
                          onChange={(e) => handleUpdateField(item.id, { qc_deliver: e.target.value })}
                          className={`p-1 rounded-lg border text-[11px] focus:outline-none ${
                            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                          }`}
                        >
                          <option value="">-- Pilih QC --</option>
                          {STAFF_QC_LIST.map((staff) => (
                            <option key={staff} value={staff}>{staff}</option>
                          ))}
                        </select>
                      </td>

                      {/* Tes Scan */}
                      <td className="p-4">
                        <input
                          type="text"
                          placeholder="Hasil Scan"
                          value={item.tes_scan || ''}
                          onChange={(e) => handleUpdateField(item.id, { tes_scan: e.target.value })}
                          className={`w-28 p-1 rounded-lg border text-[11px] font-mono focus:outline-none ${
                            item.tes_scan
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                          }`}
                        />
                      </td>

                      {/* Ship & Surat Jalan */}
                      <td className="p-4 space-y-1">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${getStatusBadge(pShip).text}`}>
                          <span>{getStatusBadge(pShip).icon}</span>
                          <span>{pShip}%</span>
                          <span className="font-normal opacity-70">({item.qty_ship?.toLocaleString()})</span>
                        </div>
                        
                        {activeTab === 'pengiriman' && (
                          <div className="space-y-1.5 mt-1.5">
                            <input
                              type="number"
                              value={item.qty_ship}
                              disabled={item.qty_ship >= maxShipAllowed}
                              onChange={(e) => handleUpdateQty(
                                item.id, 
                                'qty_ship', 
                                e.target.value, 
                                maxShipAllowed,
                                `❌ Gagal: Qty Kirim (${e.target.value} pcs) tidak boleh melebihi Qty yang sudah di-Paking (${maxShipAllowed} pcs)!`
                              )}
                              className={`w-20 border rounded-lg px-2 py-1 text-xs focus:outline-none ${
                                item.qty_ship >= maxShipAllowed
                                  ? isDarkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed' : 'bg-[#EFECE6] border-[#D8D2C2] text-stone-500 cursor-not-allowed'
                                  : isDarkMode ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                              }`}
                            />
                            
                            <label
                              className={`block rounded-lg px-2 py-1 text-[10px] cursor-pointer text-center font-semibold transition-colors w-max border ${
                                isDarkMode
                                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-600'
                                  : 'bg-[#EFECE6] hover:bg-[#E5E0D5] text-[#3D4F4B] border-[#D8D2C2]'
                              }`}
                            >
                              📤 Upload Surat Jalan
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => handleUploadSuratJalan(e, item)}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )}

                        {item.surat_jalan_url && (
                          <a
                            href={item.surat_jalan_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex items-center gap-1 text-[11px] font-bold mt-1 hover:underline ${
                              isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'
                            }`}
                          >
                            📄 Lihat Surat Jalan
                          </a>
                        )}
                      </td>

                      {/* Total Average Progress */}
                      <td className="p-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-xs ${getStatusBadge(totalAvg).text}`}>
                          <span>{getStatusBadge(totalAvg).icon}</span>
                          <span>{totalAvg}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pop-Up Modal Scan & Input Manual */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-xl ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 border-black/10 dark:border-white/10">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>{inputMode === 'scan' ? '📷' : '⌨️'}</span> Input Data QC & Progress
              </h3>
              <button onClick={() => setShowScanModal(false)} className="text-xs opacity-60 hover:opacity-100 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex p-1 bg-stone-100 dark:bg-neutral-900 rounded-xl border dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => { setInputMode('scan'); setScannedInput(''); }}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    inputMode === 'scan'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900'
                  }`}
                >
                  📷 Mode Scan QR / Barcode
                </button>
                <button
                  type="button"
                  onClick={() => { setInputMode('manual'); setScannedInput(''); }}
                  className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${
                    inputMode === 'manual'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-stone-600 dark:text-neutral-400 hover:text-stone-900'
                  }`}
                >
                  ⌨️ Mode Input Manual
                </button>
              </div>

              <div>
                <label className="block font-bold mb-1 opacity-80">1. Target Kolom Update:</label>
                <select
                  value={scanTargetColumn}
                  onChange={(e) => setScanTargetColumn(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border focus:outline-none font-semibold ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
                  }`}
                >
                  <option value="qc_checker">🔍 QC Checker</option>
                  <option value="qc_paking">📦 QC Paking</option>
                  <option value="qc_deliver">🚚 QC Deliver / Driver</option>
                  <option value="qty_finish">⚙️ Finishing (Auto Complete Qty)</option>
                  <option value="tes_scan">🧪 Tes Scan Sahaja</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1 opacity-80">2. Petugas / Operator:</label>
                <select
                  value={qcStaffName}
                  onChange={(e) => setQcStaffName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border focus:outline-none font-semibold ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
                  }`}
                >
                  {STAFF_QC_LIST.map((staff) => (
                    <option key={staff} value={staff}>{staff}</option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleSubmitInput} className="space-y-3">
                <div>
                  <label className="block font-bold mb-1 opacity-80">
                    {inputMode === 'scan' ? '3. Arahkan Scanner Ke Sini:' : '3. Ketik No SPK / Kode Toko / QR:'}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={scannedInput}
                    onChange={(e) => setScannedInput(e.target.value)}
                    placeholder={
                      inputMode === 'scan'
                        ? 'Scan barcode disini (Otomatis Enter)...'
                        : 'Contoh: SPK-001 atau Store 204A...'
                    }
                    className={`w-full p-2.5 rounded-xl border focus:outline-none font-mono text-xs ${
                      isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
                    }`}
                  />
                  <p className="text-[10px] opacity-60 mt-1">
                    {inputMode === 'scan'
                      ? '⚡ Hardware/HP Scanner akan otomatis memproses saat mendapat karakter Enter.'
                      : '💡 Ketik manual lalu tekan Enter pada keyboard atau klik tombol Simpan.'}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowScanModal(false)}
                    className="px-4 py-2 rounded-xl font-bold opacity-70 hover:opacity-100 text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl font-bold text-white text-xs active:scale-95 transition-all ${
                      inputMode === 'scan' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'
                    }`}
                  >
                    {inputMode === 'scan' ? '⚡ Proses Scan' : '💾 Simpan Input'}
                  </button>
                </div>
              </form>

              {lastScanMessage && (
                <div className={`p-3 rounded-xl border text-xs font-semibold ${
                  lastScanMessage.includes('✅')
                    ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/60 dark:text-green-300'
                    : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300'
                }`}>
                  {lastScanMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pop-Up Modal Import Google Sheets */}
      {showGSheetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-lg p-6 rounded-3xl border shadow-xl ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
            <div className="flex justify-between items-center border-b pb-3 mb-4 border-black/10 dark:border-white/10">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span>🔗</span> Import Data dari Google Sheets
              </h3>
              <button onClick={() => setShowGSheetModal(false)} className="text-xs opacity-60 hover:opacity-100 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="opacity-80">
                Masukkan link Google Sheets publik Anda. Pastikan akses Google Sheet disetting ke <strong>"Siapa saja yang memiliki link (Anyone with the link)"</strong>.
              </p>

              <div>
                <label className="block font-bold mb-1">URL Google Sheets:</label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                  value={gSheetUrl}
                  onChange={(e) => setGSheetUrl(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border focus:outline-none font-mono text-[11px] ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowGSheetModal(false)}
                  className="px-4 py-2 rounded-xl font-bold opacity-70 hover:opacity-100"
                >
                  Batal
                </button>
                <button
                  onClick={handleImportGoogleSheets}
                  disabled={importingGSheet}
                  className={`px-5 py-2 rounded-xl font-bold text-white transition-all ${
                    importingGSheet ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95'
                  }`}
                >
                  {importingGSheet ? '⏳ Mengimport...' : '🚀 Import Data Google Sheets'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}