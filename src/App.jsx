import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import KawanLamaTab from './components/KawanLamaTab'; // Memanggil tab cabang yang sudah dipisah

const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzh4DKAVUWYfGzzD90yc7Oy6oE0h1RfWYro0abbgFpSBEjNNoen1O1bu6vYtbe-CXLpuQ/exec";

const STAFF_QC_LIST = [
  "Budi (QC Paking)", "Siti (QC Paking)", "Agus (QC Checker)",
  "Dewi (QC Checker)", "Eko (QC Deliver)", "Rian (QC Deliver)"
];

function CircularGaugeCard({ title, percent, color, detailText }) {
  const strokeDasharray = 2 * Math.PI * 36;
  const strokeDashoffset = strokeDasharray - (percent / 100) * strokeDasharray;
  return (
    <div className="bg-white/80 dark:bg-neutral-800/80 p-5 rounded-3xl border border-[#D8D2C2] dark:border-neutral-700 flex flex-col items-center shadow-sm transition-all hover:scale-105">
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

/* ==========================================
   MODAL LOGIN
========================================== */
function BranchLoginModal({ isOpen, onLoginSuccess }) {
  const [accessCode, setAccessCode] = useState('');
  const [pinCode, setPinCode] = useState('');
  if (!isOpen) return null;
  const handleLogin = async (e) => {
    e.preventDefault();
    const { data } = await supabase.from('kl_branch_access').select('*, kl_branches(branch_name)').eq('access_code', accessCode.toUpperCase()).eq('pin_code', pinCode).maybeSingle();
    if (data) onLoginSuccess({ role: 'branch', branch_id: data.branch_id, branch_name: data.kl_branches.branch_name });
    else alert('❌ Kode Cabang atau PIN Salah!');
  };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="w-full max-w-sm p-6 bg-white rounded-3xl text-center shadow-2xl">
        <div className="text-4xl mb-3">🔑</div>
        <h3 className="font-bold text-lg text-black mb-4">Login Cabang</h3>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Kode Cabang (Misal: AZKO-001)" value={accessCode} onChange={e=>setAccessCode(e.target.value)} className="w-full p-3 border rounded-xl font-bold text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="password" placeholder="PIN 6 Digit" value={pinCode} onChange={e=>setPinCode(e.target.value)} className="w-full p-3 border rounded-xl text-center tracking-widest text-black focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">Masuk / Login 🚀</button>
        </form>
      </div>
    </div>
  );
}

function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  if (!isOpen) return null;
  const handleLogin = (e) => {
    e.preventDefault();
    if (username.toUpperCase() === 'ADMIN' && password === '123456') onLoginSuccess({ role: 'admin', name: 'Administrator' });
    else alert('❌ Admin Username/Password salah!');
  };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="w-full max-w-sm p-6 bg-white rounded-3xl text-center shadow-2xl">
        <div className="text-4xl mb-3">🔐</div>
        <h3 className="font-bold text-lg text-black mb-4">Login Admin Operasional</h3>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 border rounded-xl text-black font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 border rounded-xl text-center tracking-widest text-black focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border py-3 rounded-xl font-bold text-black hover:bg-stone-100 transition-all">Batal</button>
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">Masuk</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   KOMPONEN TAB: CETAK LABEL & SURAT JALAN (VERSI FULL)
   ========================================================= */
function LabelGeneratorTab({ isDarkMode, onOpenImageModal }) {
  const [labelData, setLabelData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [headerLogoUrl, setHeaderLogoUrl] = useState(() => localStorage.getItem('wellen_header_logo') || '');

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
    const templateSampleData = [{
      NO_SPK: "SPK-0826-00101", PO_NUMBER: "4500122101", NO_SJ: "WL-26-88-01", CLIENT: "PT TRI SAKTI PURWOSARI MAKMUR",
      BRAND: "Production Sunscreen Juara Intens", RECIPIENT_NAME: "Pak Pajri Hidayah", RECIPIENT_PHONE: "0838-3041-0548",
      DELIVERY_ADDRESS: "Management Support (DC Marunda) JL. Kebantenan IV No. 15, Semper Timur, Cilincing, JAKARTA UTARA 14130",
      ITEM_DESCRIPTION: "SUNSCREEN BANNER", MEDIA: "FLEXY CINA 280 GR", UKURAN: "2 X 0.75 M", QTY_TOTAL: 300, QTY_PER_KOLI: 20,
      DATE_PRODUCTION: "12-Aug-26", SENDER: "WELLEN PRINT", WELLEN_PIC: "BPK. JHONNY", SENDER_TELP: "021-5506999", SENDER_EMAIL: "info@wellenprint.com"
    }];
    const ws = XLSX.utils.json_to_sheet(templateSampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_WellenPrint");
    XLSX.writeFile(wb, "Template_Import_WellenPrint.xlsx");
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rawData || rawData.length === 0) return alert('❌ File Excel kosong atau tidak terbaca!');
        const cleanedData = rawData.map((row) => {
          const rawQty = row.QTY_TOTAL || row['Qty Total'] || row.qty_total || row.QTY || row['Total Qty'] || 0;
          const rawKoli = row.QTY_PER_KOLI || row['Qty Per Koli'] || row.qty_per_koli || row['ISI PER KOLI'] || 20;
          const deliveryAddress = String(row.DELIVERY_ADDRESS || row['Delivery Address'] || row.delivery_address || row['Alamat Penerima'] || '').trim();
          return {
            NO_SPK: String(row.NO_SPK || row['No SPK'] || row.no_spk || '').trim(),
            PO_NUMBER: String(row.PO_NUMBER || row['PO Number'] || '').trim(),
            NO_SJ: String(row.NO_SJ || row['NO SJ'] || `WL-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`).trim(),
            CLIENT: String(row.CLIENT || row.Client || row.COMPANY || '').trim(),
            BRAND: String(row.BRAND || row.Brand || row.ITEM_DESCRIPTION || '').trim(),
            RECIPIENT_NAME: String(row.RECIPIENT_NAME || row['Recipient Name'] || row['Nama Penerima'] || '').trim(),
            RECIPIENT_PHONE: String(row.RECIPIENT_PHONE || row['Recipient Phone'] || '').trim(),
            DELIVERY_ADDRESS: deliveryAddress,
            ITEM_DESCRIPTION: String(row.ITEM_DESCRIPTION || row['Item Description'] || '').trim(),
            MEDIA: String(row.MEDIA || row.Media || '').trim(),
            UKURAN: String(row.UKURAN || row.Ukuran || '').trim(),
            QTY_TOTAL: Number(String(rawQty).replace(/[^0-9]/g, '')) || 0,
            QTY_PER_KOLI: Number(String(rawKoli).replace(/[^0-9]/g, '')) || 20,
            DATE_PRODUCTION: String(row.DATE_PRODUCTION || row['Date Production'] || '12-Aug-26').trim(),
            SENDER: String(row.SENDER || 'WELLEN PRINT').trim(),
            WELLEN_PIC: String(row.WELLEN_PIC || 'BPK. JHONNY').trim(),
            SENDER_TELP: String(row.SENDER_TELP || '021-5506999').trim(),
            SENDER_EMAIL: String(row.SENDER_EMAIL || 'info@wellenprint.com').trim(),
            VISUAL_IMAGE: String(row.VISUAL_IMAGE || '').trim()
          };
        }).filter((item) => item.NO_SPK !== '' || item.CLIENT !== '' || item.QTY_TOTAL > 0);
        setLabelData(cleanedData); setSelectedRows([]); alert(`✅ Sukses Validasi! ${cleanedData.length} baris data berhasil di-import.`);
      } catch (err) { alert('Gagal membaca file Excel: ' + err.message); }
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const handleImageUploadRow = (e, index) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Url = evt.target.result;
      setLabelData(prev => prev.map((item, i) => (i === index ? { ...item, VISUAL_IMAGE: base64Url } : item)));
    };
    reader.readAsDataURL(file);
  };

  const renderHeaderLogoHtml = () => {
    if (headerLogoUrl) return `<img src="${headerLogoUrl}" style="height:65px; max-width:200px; object-fit:contain; display:block;">`;
    return `<div style="font-weight:900; font-size:22px; line-height:1; color:#000;">WELLEN<br><span style="font-size:13px; letter-spacing:6px;">PRINT</span></div>`;
  };

  const handlePrintLabels = async () => {
    if (selectedRows.length === 0) return alert('⚠️ Silakan centang minimal 1 baris data untuk dicetak!');
    const itemsToPrint = labelData.filter((_, idx) => selectedRows.includes(idx));
    const pagesHtml = await Promise.all(itemsToPrint.map(async (item) => {
      const totalQty = Number(item.QTY_TOTAL || 0); const qtyPerKoli = Number(item.QTY_PER_KOLI || 20);
      const totalKoli = Math.ceil(totalQty / qtyPerKoli) || 1;
      let koliHtmls = [];
      for (let k = 1; k <= totalKoli; k++) {
        const currentQty = (k === totalKoli && totalQty % qtyPerKoli !== 0) ? (totalQty % qtyPerKoli) : qtyPerKoli;
        const qrAddress = item.NO_SPK ? `SPK:${item.NO_SPK}|KOLI:${k}/${totalKoli}` : 'WELLEN-PRINT';
        let qrDataUrl = ''; try { qrDataUrl = await QRCode.toDataURL(qrAddress, { width: 120, margin: 1 }); } catch (e) { console.error(e); }
        koliHtmls.push(`
          <div class="label-page"><div class="label-box">
            <table class="header-table"><tr>
              <td style="width: 25%; vertical-align: middle;">${renderHeaderLogoHtml()}</td>
              <td style="width: 55%; text-align:center; font-size:9px; line-height: 1.2; vertical-align: middle;">
                <strong style="font-size:13px;">PT. WELLEN PRINT</strong><br>
                Green Sedayu Bizpark. Jl. Daan Mogot KM.18 blok DM3 No.18, Kalideres,<br>
                RT.11/RW.6, Kalideres, Kec. Kalideres, Kota Jakarta Barat, 11840
              </td>
              <td style="width: 20%; text-align:right; vertical-align: middle;">${qrDataUrl ? `<img src="${qrDataUrl}" style="width:65px; height:65px; display:inline-block;">` : ''}</td>
            </tr></table>
            <div class="content-grid">
              <div class="grid-box"><strong>SENDER:</strong> ${item.SENDER || 'WELLEN PRINT'}<br><strong>WELLEN PIC:</strong> ${item.WELLEN_PIC || 'BPK. JHONNY'}<br><strong>NO. TELP:</strong> ${item.SENDER_TELP || '021-5506999'}<br><strong>EMAIL:</strong> ${item.SENDER_EMAIL || 'info@wellenprint.com'}</div>
              <div class="grid-box"><strong>CLIENT:</strong> ${item.CLIENT || '-'}<br><strong>Delivery Address:</strong> ${item.DELIVERY_ADDRESS || '-'}<br><strong>Recipient Name:</strong> ${item.RECIPIENT_NAME || '-'}<br><strong>Recipient Phone:</strong> ${item.RECIPIENT_PHONE || '-'}</div>
              <div class="grid-box"><strong>PO NUMBER:</strong> ${item.PO_NUMBER || '-'}<br><strong>NO. SPK:</strong> ${item.NO_SPK || '-'}<br><strong>ITEM DESCRIPTION:</strong> ${item.ITEM_DESCRIPTION || '-'}<br><strong>MEDIA:</strong> ${item.MEDIA || '-'}<br><strong>UKURAN:</strong> ${item.UKURAN || '-'}<br><strong>QUANTITY:</strong> ${currentQty} PCS<br><strong>DATE PRODUCTION:</strong> ${item.DATE_PRODUCTION || '-'}</div>
              <div class="grid-box visual-box"><div><strong>VISUAL IMAGE :</strong></div><div class="koli-title">${k} OF ${totalKoli}</div>${item.VISUAL_IMAGE ? `<img src="${item.VISUAL_IMAGE}" class="preview-img">` : `<div style="font-size:10px; opacity:0.5;">[ No Image ]</div>`}</div>
            </div>
          </div></div>
        `);
      }
      return koliHtmls.join('');
    }));
    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Print Label Wellen Print</title><style>body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; } .label-page { width: 210mm; height: 148mm; padding: 5mm; box-sizing: border-box; page-break-after: always; break-after: page; } .label-box { border: 2px solid #000; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; } .header-table { width: 100%; border-bottom: 2px solid #000; border-collapse: collapse; } .header-table td { border: none; padding: 6px; vertical-align: middle; } .content-grid { display: grid; grid-template-columns: 1fr 1fr; flex-grow: 1; } .grid-box { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 6px; font-size: 11px; line-height: 1.4; box-sizing: border-box; } .grid-box:nth-child(2n) { border-right: none; } .grid-box:nth-child(3), .grid-box:nth-child(4) { border-bottom: none; } .visual-box { text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; } .koli-title { font-size: 20px; font-weight: bold; margin: 2px 0; } .preview-img { max-width: 95%; max-height: 90px; object-fit: contain; } @media print { body { padding: 0; } .label-page { page-break-after: always; break-after: page; } }</style></head><body>${pagesHtml.join('')}</body></html>`);
    printWin.document.close(); setTimeout(() => { printWin.print(); }, 500);
  };

  const handlePrintSuratJalan = () => {
    if (selectedRows.length === 0) return alert('⚠️ Silakan centang minimal 1 baris data untuk dicetak Surat Jalan!');
    const itemsToPrint = labelData.filter((_, idx) => selectedRows.includes(idx));
    const pagesHtml = itemsToPrint.map((item) => `
      <div class="sj-page">
        <div class="sj-top-header"><div class="logo-sec">${renderHeaderLogoHtml()}</div><div class="sj-title">Tanda Terima</div></div>
        <div class="info-row">
          <div class="info-box left-box"><div class="info-line">Kepada Yth :</div><div class="info-line font-bold">${item.CLIENT || '-'}</div><div class="info-line">${item.DELIVERY_ADDRESS || '-'}</div><div class="info-line">UP : ${item.RECIPIENT_NAME || '-'} ${item.RECIPIENT_PHONE || ''}</div></div>
          <div class="right-box-container">
            <table class="meta-table"><tr><td class="font-bold">NO PO</td><td>: ${item.PO_NUMBER || '-'}</td></tr><tr><td class="font-bold">BRAND</td><td>: ${item.BRAND || item.ITEM_DESCRIPTION || '-'}</td></tr><tr><td class="font-bold">NO SJ</td><td>: ${item.NO_SJ || '-'}</td></tr></table>
            <div class="date-box"><div class="date-header">TANGGAL</div><div class="date-value">${item.DATE_PRODUCTION || '12-Aug-26'}</div></div>
          </div>
        </div>
        <table class="item-grid-table">
          <thead><tr><th style="width: 8%;">NO</th><th style="width: 25%;">AMO/DEPO</th><th style="width: 27%;">AMO</th><th><div>${item.ITEM_DESCRIPTION || 'SUNSCREEN'}</div><div class="font-normal" style="font-size: 11px;">${item.BRAND || 'JUARA INTENS'}</div></th></tr></thead>
          <tbody><tr><td style="text-align: center;">1</td><td>AMO/DEPO</td><td></td><td style="text-align: right; padding-right: 15px;">${Number(item.QTY_TOTAL || 0).toLocaleString()}</td></tr></tbody>
          <tfoot><tr><td colspan="3" class="text-center font-bold">TOTAL</td><td style="text-align: right; padding-right: 15px;" class="font-bold">${Number(item.QTY_TOTAL || 0).toLocaleString()}</td></tr></tfoot>
        </table>
        <div class="signature-row"><div class="sig-box">PENGIRIM</div><div class="sig-box">PENERIMA</div></div>
      </div>
    `).join('');

    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`<!DOCTYPE html><html><head><title>Print Surat Jalan - Wellen Print</title><style>body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; } .sj-page { width: 210mm; height: 148mm; padding: 8mm; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; } .font-bold { font-weight: bold; } .font-normal { font-weight: normal; } .text-center { text-align: center; } .sj-top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; } .sj-title { font-size: 26px; font-weight: bold; text-align: right; } .info-row { display: flex; gap: 15px; margin-bottom: 10px; } .info-box { border: 1.5px solid #000; padding: 6px 10px; font-size: 11px; line-height: 1.4; } .left-box { flex: 1; height: 75px; } .right-box-container { width: 42%; display: flex; flex-direction: column; gap: 6px; } .meta-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; } .meta-table td { padding: 2px 6px; border: none; } .date-box { border: 1.5px solid #000; height: 38px; display: flex; flex-direction: column; text-align: center; font-size: 10px; } .date-header { border-bottom: 1px solid #000; font-weight: bold; padding: 1px 0; background: #f8f8f8; } .date-value { padding-top: 3px; font-weight: bold; font-size: 11px; } .item-grid-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; margin-bottom: 15px; } .item-grid-table th, .item-grid-table td { border: 1.5px solid #000; padding: 5px; } .item-grid-table th { text-align: center; background: #f8f8f8; } .item-grid-table tfoot td { background: #f8f8f8; } .signature-row { display: flex; justify-space-around; text-align: center; font-size: 11px; font-weight: bold; margin-top: 15px; } .sig-box { width: 200px; border-top: 1px solid transparent; padding-top: 40px; } @media print { body { padding: 0; } .sj-page { page-break-after: always; break-after: page; } }</style></head><body>${pagesHtml}</body></html>`);
    printWin.document.close(); setTimeout(() => { printWin.print(); }, 500);
  };

  return (
    <div className="space-y-4">
      {/* Panel Upload Logo KOP Header */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <div className="flex items-center gap-3">
          <div className="w-16 h-12 rounded-xl border bg-stone-50 dark:bg-neutral-900 flex items-center justify-center overflow-hidden p-1">
            {headerLogoUrl ? <img src={headerLogoUrl} alt="Logo Header" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] font-bold opacity-50 text-center">No Logo</span>}
          </div>
          <div>
            <h4 className="font-bold text-xs">🖼️ Logo Header KOP (Label & Surat Jalan)</h4>
            <p className="text-[11px] opacity-70">{headerLogoUrl ? '✅ Logo KOP aktif (Tersimpan)' : '⚠️ Menggunakan teks default "WELLEN PRINT"'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm bg-purple-600 hover:bg-purple-500 transition-all active:scale-95">
            🖼️ Upload Logo KOP Wellen <input type="file" accept="image/*" onChange={handleUploadHeaderLogo} className="hidden" />
          </label>
          {headerLogoUrl && <button onClick={handleResetHeaderLogo} className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all">Reset</button>}
        </div>
      </div>

      {/* Top Action Controls */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <label className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm transition-all ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#6B8E85] hover:bg-[#57756D]'}`}>
            📁 Import Excel Format Label & SJ <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" />
          </label>
          <button onClick={handleDownloadTemplate} className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all">📥 Download Template Excel</button>
          {labelData.length > 0 && <button onClick={() => { if(confirm('Bersihkan data?')) { setLabelData([]); setSelectedRows([]); } }} className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all">🧹 Bersihkan Import</button>}
          <span className="text-xs opacity-70 ml-2">Terisi: <strong>{labelData.length}</strong> Baris Valid</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrintSuratJalan} disabled={selectedRows.length === 0} className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${selectedRows.length > 0 ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95' : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 cursor-not-allowed'}`}>
            📄 Cetak Surat Jalan ({selectedRows.length})
          </button>
          <button onClick={handlePrintLabels} disabled={selectedRows.length === 0} className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${selectedRows.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95' : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 cursor-not-allowed'}`}>
            🏷️ Cetak Label ({selectedRows.length})
          </button>
        </div>
      </div>

      {/* Grid Table Data Preview */}
      <div className={`overflow-x-auto rounded-2xl border shadow-sm ${isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2]'}`}>
        <table className="w-full text-left text-xs">
          <thead className={`font-bold border-b ${isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'}`}>
            <tr>
              <th className="p-3 text-center w-10"><input type="checkbox" checked={labelData.length > 0 && selectedRows.length === labelData.length} onChange={() => setSelectedRows(selectedRows.length === labelData.length ? [] : labelData.map((_, idx) => idx))} className="cursor-pointer accent-indigo-600" /></th>
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
              <tr><td colSpan="8" className="p-6 text-center opacity-60">Tabel kosong. Silakan klik tombol <strong>"Download Template Excel"</strong> di atas.</td></tr>
            ) : (
              labelData.map((row, idx) => {
                const total = Number(row.QTY_TOTAL || 0); const koli = Number(row.QTY_PER_KOLI || 20); const isChecked = selectedRows.includes(idx);
                return (
                  <tr key={idx} className={`transition-colors ${isChecked ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70' : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'}`}>
                    <td className="p-3 text-center"><input type="checkbox" checked={isChecked} onChange={() => setSelectedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} className="cursor-pointer accent-indigo-600" /></td>
                    <td className="p-3 font-bold text-blue-500">{row.NO_SPK || '-'}<br /><span className="font-normal text-[10px] opacity-70">PO: {row.PO_NUMBER || '-'}</span><br /><span className="font-normal text-[10px] text-emerald-500">SJ: {row.NO_SJ || '-'}</span></td>
                    <td className="p-3"><strong className="text-xs">{row.CLIENT || '-'}</strong><br /><span className="text-[10px] opacity-70">{row.BRAND || '-'}</span></td>
                    <td className="p-3"><strong>{row.RECIPIENT_NAME || '-'}</strong> ({row.RECIPIENT_PHONE || '-'})<br /><span className="text-[10px] opacity-70">{row.DELIVERY_ADDRESS || '-'}</span></td>
                    <td className="p-3">{row.ITEM_DESCRIPTION || '-'}<br /><span className="text-[10px] opacity-70">{row.MEDIA || '-'} ({row.UKURAN || '-'})</span></td>
                    <td className="p-3 font-bold">{total.toLocaleString()} Pcs</td>
                    <td className="p-3">{koli} Pcs</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {row.VISUAL_IMAGE ? (
                          <img src={row.VISUAL_IMAGE} alt="Preview" onClick={() => onOpenImageModal(row.VISUAL_IMAGE, `Visual Item SPK: ${row.NO_SPK}`)} className="w-12 h-8 object-contain border rounded bg-white cursor-pointer hover:scale-105 transition-transform" />
                        ) : (<span className="text-[10px] opacity-50">Belum ada</span>)}
                        <label className="cursor-pointer px-2 py-1 bg-stone-200 dark:bg-neutral-700 hover:bg-stone-300 rounded text-[10px] font-bold">
                          Upload <input type="file" accept="image/*" onChange={(e) => handleImageUploadRow(e, idx)} className="hidden" />
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

/* =========================================================
   KOMPONEN UTAMA APP
   ========================================================= */
export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isBranchMode = searchParams.get('mode') === 'cabang';

  const [spkList, setSpkList] = useState([]);
  const [activeTab, setActiveTab] = useState(isBranchMode ? 'kawan_lama' : 'dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [modalImageInfo, setModalImageModalInfo] = useState({ isOpen: false, url: '', title: '' });
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

  const [currentAdmin, setCurrentAdmin] = useState(() => { const s = localStorage.getItem('kl_admin_session'); return s ? JSON.parse(s) : null; });
  const [currentBranch, setCurrentBranch] = useState(() => { const s = localStorage.getItem('kl_branch_session'); return s ? JSON.parse(s) : null; });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showBranchLoginModal, setShowBranchLoginModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => { if (isBranchMode && !currentBranch) setShowBranchLoginModal(true); }, [isBranchMode, currentBranch]);
  useEffect(() => { fetchSpkData(); }, []);

  const openImageModal = (url, title) => { if (url) setModalImageModalInfo({ isOpen: true, url, title: title || 'Preview' }); };
  const closeImageModal = () => setModalImageModalInfo({ isOpen: false, url: '', title: '' });
  const toggleTheme = () => setIsDarkMode(prev => { localStorage.setItem('theme', !prev ? 'dark' : 'light'); return !prev; });

  const fetchSpkData = async () => {
    const { data } = await supabase.from('spk_data').select('*').order('id', { ascending: false });
    if (data) { setSpkList(data); if (data.length > 0 && !selectedSpkId) initFinishingForm(data[0]); }
  };

  const initFinishingForm = (item) => {
    if (!item) return; setSelectedSpkId(item.id);
    setFinishingForm({ finishing_type: item.finishing_type || 'inhouse', sub_vendor_name: item.sub_vendor_name || '', qty_finish_sub_out: item.qty_finish_sub_out || 0, qty_finish: item.qty_finish || 0 });
  };

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId); const item = spkList.find(s => String(s.id) === String(spkId));
    if (item) setFinishingForm({ finishing_type: item.finishing_type || 'inhouse', sub_vendor_name: item.sub_vendor_name || '', qty_finish_sub_out: item.qty_finish_sub_out || 0, qty_finish: item.qty_finish || 0 });
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds(prev => { const exist = prev.includes(id); if (!exist) handleSelectSpk(id); return exist ? prev.filter(item => item !== id) : [...prev, id]; });
  };

  const handleToggleSelectAll = (filteredItems) => {
    if (selectedSpkIds.length === filteredItems.length && filteredItems.length > 0) setSelectedSpkIds([]);
    else { setSelectedSpkIds(filteredItems.map(item => item.id)); if (filteredItems.length > 0) handleSelectSpk(filteredItems[0].id); }
  };

  const handleUpdateField = async (id, payload) => {
    const { error } = await supabase.from('spk_data').update(payload).eq('id', id);
    if (!error) setSpkList(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
    else alert('Gagal memperbarui data: ' + error.message);
  };

  const handleUpdateQty = async (id, field, value, maxAllowed, customErrorMessage) => {
    const val = Number(value) || 0;
    if (val > maxAllowed) return alert(customErrorMessage || `❌ Gagal: Jumlah tidak boleh melebihi ${maxAllowed.toLocaleString()} pcs!`);
    handleUpdateField(id, { [field]: val });
  };

  const handleProcessScan = async (codeValue) => {
    if (!codeValue) return;
    const cleanCode = codeValue.toString().replace(/[\r\n]+/g, '').trim().toLowerCase();
    const targetItem = spkList.find(item => (item.qr_address||'').toLowerCase().includes(cleanCode) || (item.store_code||'').toLowerCase() === cleanCode || (item.no_spk||'').toLowerCase().includes(cleanCode) || (item.project||'').toLowerCase().includes(cleanCode));
    if (!targetItem) { setLastScanMessage(`❌ SPK "${cleanCode}" tidak ditemukan!`); setScannedInput(''); return; }
    
    const updaterValue = qcStaffName ? `${qcStaffName} (OK)` : 'VERIFIED (OK)';
    let updatePayload = { tes_scan: updaterValue };
    if (scanTargetColumn === 'qc_paking') updatePayload.qc_paking = updaterValue;
    if (scanTargetColumn === 'qc_checker') updatePayload.qc_checker = updaterValue;
    if (scanTargetColumn === 'qc_deliver') updatePayload.qc_deliver = updaterValue;
    if (scanTargetColumn === 'qty_finish') updatePayload.qty_finish = targetItem.qty_order;

    await handleUpdateField(targetItem.id, updatePayload);
    setLastScanMessage(`✅ SUKSES UPDATE SPK ${targetItem.no_spk}!`); setScannedInput('');
  };

  const handleSubmitInput = (e) => { e.preventDefault(); handleProcessScan(scannedInput); };

  const handleBatchPrint = async () => {
    const items = spkList.filter(item => selectedSpkIds.includes(item.id));
    if (items.length === 0) return alert('⚠️ Centang minimal 1 SPK!');
    const html = items.map(item => `<div style="page-break-after:always; padding:20px; font-family:Arial; border:2px solid #000;"><h2>STORE: ${item.project}</h2><p>SPK: ${item.no_spk}</p></div>`).join('');
    const pw = window.open('', '_blank', 'width=800,height=800'); pw.document.write(`<html><body>${html}</body></html>`); pw.document.close(); setTimeout(() => pw.print(), 500);
  };

  const handleUploadSuratJalan = async (e, item) => {
    const file = e.target.files[0]; if (!file) return;
    const fileName = `sj_${item.no_spk}_${Date.now()}`;
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      handleUpdateField(item.id, { surat_jalan_url: data.publicUrl });
      alert('Surat Jalan Diunggah!');
    }
  };

  const processImportData = async (rawData) => {
    const formattedData = rawData.filter(row => row['Store Name'] || row['Nama Project'] || row['COMPANY']).map(row => ({
      no_spk: String(row['SPK/WPP'] || row['No SPK'] || '-').split('/')[0].trim(),
      client: String(row['COMPANY'] || row['Nama Klient'] || '-'),
      project: String(row['Store Name'] || row['Nama Project'] || '-'),
      bahan: String(row['Nama Bahan'] || 'Art Paper'),
      ukuran: String(row['Ukuran'] || 'A5'),
      qty_order: Number(row['TOTAL QTY ORDER'] || 40),
      qty_print: 0, qty_finish: 0, qty_pack: 0, qty_ship: 0,
      store_code: String(row['NO. STORE'] || '-'), delivery_route: String(row['DELIVERY'] || 'DALAM KOTA')
    }));
    if (formattedData.length > 0) {
      await supabase.from('spk_data').insert(formattedData);
      alert(`✅ Sukses Import ${formattedData.length} SPK`); fetchSpkData();
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 });
      await processImportData(rawData);
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));
  const getStatusBadge = (p) => p >= 100 ? { text: 'text-green-800 bg-green-100', icon: '🟢' } : p > 0 ? { text: 'text-yellow-800 bg-yellow-100', icon: '🟡' } : { text: 'text-red-800 bg-red-100', icon: '🔴' };

  const totalSpk = spkList.length;
  const totalOrderPcs = spkList.reduce((acc, curr) => acc + (Number(curr.qty_order) || 0), 0);
  const displayedList = spkList.filter(item => (item.no_spk||'').toLowerCase().includes(searchTerm.toLowerCase()) || (item.project||'').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`min-h-screen p-6 font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-gradient-to-br from-[#FBF9F5] via-[#F3EFE6] to-[#E5E0D5] text-[#2F3E3B]'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER UTAMA */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white/80 border-[#D8D2C2] backdrop-blur-md'} gap-4`}>
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>
              {isBranchMode ? 'FORM CABANG KAWAN LAMA' : 'WEB-TRACK MONITORING'}
            </h1>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>
              {isBranchMode ? 'Sistem Terpadu Portal Cabang' : 'Sistem Pelacak Progress Produksi & Pengiriman SPK'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleTheme} className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-yellow-300 border-neutral-600' : 'bg-white hover:bg-stone-100 text-slate-700 border-[#D8D2C2]'}`}>
              {isDarkMode ? '☀️ Tema Terang' : '🌙 Tema Gelap'}
            </button>
            {!isBranchMode && (currentAdmin ? <button onClick={() => {localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard');}} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Admin</button> : <button onClick={() => setShowAdminLoginModal(true)} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95">🔑 Login Admin</button>)}
            {isBranchMode && currentBranch && <button onClick={() => {localStorage.removeItem('kl_branch_session'); setCurrentBranch(null);}} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Cabang</button>}
            {!isBranchMode && <button onClick={() => setShowScanModal(true)} className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95">📷 Scan QC Station</button>}
            {!isBranchMode && <label className={`px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#6B8E85] hover:bg-[#57756D] text-white'}`}>📁 Upload SPK Excel<input type="file" accept=".xlsx" onChange={handleExcelUpload} className="hidden" /></label>}
          </div>
        </div>

        {/* TABS MENU */}
        {!isBranchMode && (
          <div className={`flex gap-2 overflow-x-auto border-b pb-2 ${isDarkMode ? 'border-neutral-800' : 'border-[#D8D2C2]'}`}>
            {['dashboard', 'produksi', 'finishing', 'paking', 'pengiriman', 'label', 'kawan_lama'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all whitespace-nowrap ${activeTab === t ? (isDarkMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#6B8E85] text-white shadow-sm') : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700' : 'bg-white/70 text-[#4A5D58] hover:bg-white border border-[#D8D2C2]/70')}`}>
                {t === 'label' ? '🏷️ Cetak Label & SJ' : t === 'kawan_lama' ? '🏢 Project Kawan Lama' : t}
              </button>
            ))}
          </div>
        )}

        {/* DASHBOARD WIDGET */}
        {!isBranchMode && activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CircularGaugeCard title="Total SPK" percent={100} color="#4F46E5" detailText={`${totalSpk} Data Aktif`} />
            <CircularGaugeCard title="Produksi" percent={80} color="#D97706" detailText="Print & Finish" />
            <CircularGaugeCard title="Paking" percent={60} color="#9333EA" detailText="Siap Kirim" />
            <CircularGaugeCard title="Terkirim" percent={40} color="#0D9488" detailText="Delivery Done" />
          </div>
        )}

        {/* TAB KAWAN LAMA */}
        {(isBranchMode || activeTab === 'kawan_lama') && (
          <KawanLamaTab isDarkMode={isDarkMode} currentUser={isBranchMode ? currentBranch : currentAdmin} isBranchMode={isBranchMode} />
        )}
        
        {/* TAB CETAK LABEL & SURAT JALAN (FULL VERSION) */}
        {!isBranchMode && activeTab === 'label' && (
          <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
        )}

        {/* TRACKING TABLE FULL (Admin Tabs) */}
        {!isBranchMode && activeTab !== 'label' && activeTab !== 'kawan_lama' && (
          <div className="space-y-4">
            {/* Table Header Controls */}
            <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white/90 border-[#D8D2C2]'}`}>
              <div className="flex items-center gap-2 flex-1 w-full">
                <span className="text-sm">🔍</span>
                <input type="text" placeholder="Cari SPK, Client, atau Store Name..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className={`w-full text-xs bg-transparent focus:outline-none ${isDarkMode ? 'text-white' : 'text-[#2F3E3B]'}`} />
              </div>
              <button onClick={handleBatchPrint} disabled={selectedSpkIds.length === 0} className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${selectedSpkIds.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95' : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 cursor-not-allowed'}`}>
                🖨️ Cetak {selectedSpkIds.length} Surat Form Sekaligus
              </button>
            </div>

            {/* Main Table */}
            <div className={`overflow-x-auto rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2] backdrop-blur-md'}`}>
              <table className="w-full text-xs text-left">
                <thead className={`font-bold border-b transition-colors ${isDarkMode ? 'bg-neutral-800/80 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'}`}>
                  <tr>
                    <th className="p-4 w-10 text-center"><input type="checkbox" checked={spkList.length>0 && selectedSpkIds.length === spkList.length} onChange={() => handleToggleSelectAll(spkList)} className="w-4 h-4 cursor-pointer accent-indigo-600" /></th>
                    <th className="p-4">SPK & Info</th>
                    <th className="p-4">Print</th>
                    <th className="p-4">Finish</th>
                    <th className="p-4">Paking & Foto</th>
                    <th className="p-4">QC Check</th>
                    <th className="p-4">Ship & Surat Jalan</th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
                  {displayedList.map(i => {
                    const pPrint = getPercent(i.qty_print, i.qty_order); const pFinish = getPercent(i.qty_finish, i.qty_order); const pPack = getPercent(i.qty_pack, i.qty_order); const pShip = getPercent(i.qty_ship, i.qty_order);
                    const isChecked = selectedSpkIds.includes(i.id);
                    return (
                      <tr key={i.id} className={`transition-colors ${isChecked ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70' : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'}`}>
                        <td className="p-4 text-center"><input type="checkbox" checked={isChecked} onChange={() => handleToggleCheck(i.id)} className="w-4 h-4 cursor-pointer accent-indigo-600" /></td>
                        <td className="p-4">
                          <strong className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>{i.no_spk}</strong><br/>
                          <span className={`font-semibold ${isDarkMode ? 'text-neutral-200' : 'text-[#2F3E3B]'}`}>{i.client} - {i.project}</span><br/>
                          <span className={`text-[10px] ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>Order: {i.qty_order} Pcs</span>
                        </td>
                        
                        {/* Kolom Print */}
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pPrint).text}`}>{pPrint}%</span><br/>
                          {activeTab==='produksi' && <input type="number" value={i.qty_print||0} onChange={e=>handleUpdateQty(i.id, 'qty_print', e.target.value, i.qty_order)} className={`mt-1.5 w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />}
                        </td>
                        
                        {/* Kolom Finish */}
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pFinish).text}`}>{pFinish}%</span><br/>
                          {activeTab==='finishing' && <input type="number" value={i.qty_finish||0} onChange={e=>handleUpdateQty(i.id, 'qty_finish', e.target.value, i.qty_order)} className={`mt-1.5 w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />}
                        </td>
                        
                        {/* Kolom Paking */}
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pPack).text}`}>{pPack}%</span><br/>
                          {activeTab==='paking' && (
                            <div className="mt-1.5 space-y-1.5">
                              <input type="number" value={i.qty_pack||0} onChange={e=>handleUpdateQty(i.id, 'qty_pack', e.target.value, i.qty_finish)} className={`w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />
                              <label className={`block text-center rounded-lg px-2 py-1 text-[10px] cursor-pointer font-bold transition-all border ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-600' : 'bg-[#EFECE6] hover:bg-[#E5E0D5] text-[#3D4F4B] border-[#D8D2C2]'}`}>
                                📷 Upload Foto Paking
                                <input type="file" accept="image/*" onChange={e => {const f=e.target.files[0]; if(f){const r=new FileReader(); r.onload=ev=>handleUpdateField(i.id, {packing_visual_url: ev.target.result}); r.readAsDataURL(f);}}} className="hidden" />
                              </label>
                              {i.packing_visual_url && <img src={i.packing_visual_url} alt="Paking" onClick={() => openImageModal(i.packing_visual_url, `Foto Paking: ${i.no_spk}`)} className="w-12 h-8 object-cover rounded border cursor-pointer hover:scale-110" />}
                            </div>
                          )}
                        </td>

                        {/* Kolom QC */}
                        <td className="p-4 space-y-1.5">
                          <select value={i.qc_checker||''} onChange={e=>handleUpdateField(i.id, {qc_checker: e.target.value})} className={`block w-full rounded-lg border p-1 text-[10px] focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`}><option value="">-- QC Checker --</option>{STAFF_QC_LIST.map(s=><option key={s}>{s}</option>)}</select>
                          <select value={i.qc_paking||''} onChange={e=>handleUpdateField(i.id, {qc_paking: e.target.value})} className={`block w-full rounded-lg border p-1 text-[10px] focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`}><option value="">-- QC Paking --</option>{STAFF_QC_LIST.map(s=><option key={s}>{s}</option>)}</select>
                        </td>

                        {/* Kolom Pengiriman */}
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pShip).text}`}>{pShip}%</span><br/>
                          {activeTab==='pengiriman' && (
                            <div className="mt-1.5 space-y-1.5">
                              <input type="number" value={i.qty_ship||0} onChange={e=>handleUpdateQty(i.id, 'qty_ship', e.target.value, i.qty_pack)} className={`w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />
                              <label className={`block text-center rounded-lg px-2 py-1 text-[10px] cursor-pointer font-bold transition-all border ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-600' : 'bg-[#EFECE6] hover:bg-[#E5E0D5] text-[#3D4F4B] border-[#D8D2C2]'}`}>
                                📤 Upload Surat Jalan
                                <input type="file" onChange={e=>handleUploadSuratJalan(e, i)} accept="image/*,application/pdf" className="hidden"/>
                              </label>
                            </div>
                          )}
                          {i.surat_jalan_url && <a href={i.surat_jalan_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-[10px] block mt-1">📄 Lihat SJ</a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL SCAN QC */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-neutral-700 border-stone-200">
              <h3 className="font-bold">📷 Scan QC Station</h3>
              <button onClick={()=>setShowScanModal(false)} className="hover:text-red-500">✕</button>
            </div>
            <form onSubmit={handleSubmitInput} className="space-y-4 text-sm">
              <select value={scanTargetColumn} onChange={e=>setScanTargetColumn(e.target.value)} className={`w-full p-2.5 rounded-xl border focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-[#C5BEAD] text-black'}`}>
                <option value="qc_checker">QC Checker</option><option value="qc_paking">QC Paking</option><option value="qty_finish">Auto Set Finish (Max Qty)</option>
              </select>
              <input type="text" autoFocus placeholder="Arahkan Scanner Barcode Ke Sini..." value={scannedInput} onChange={e=>setScannedInput(e.target.value)} className={`w-full p-3 rounded-xl border font-mono text-center focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-[#C5BEAD] text-black'}`} />
              <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl active:scale-95 transition-all">⚡ Proses Scan Input</button>
            </form>
            {lastScanMessage && <div className={`mt-3 p-3 text-center text-xs font-bold rounded-xl border ${lastScanMessage.includes('✅') ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>{lastScanMessage}</div>}
          </div>
        </div>
      )}

      {/* MODAL IMAGE PREVIEW */}
      {modalImageInfo.isOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4" onClick={closeImageModal}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={closeImageModal} className="absolute -top-10 right-0 text-white hover:text-red-500 text-3xl">✕</button>
            <img src={modalImageInfo.url} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-stone-700" />
            <div className="text-center mt-3 text-white font-bold text-sm tracking-widest">{modalImageInfo.title}</div>
          </div>
        </div>
      )}

      <AdminLoginModal isOpen={showAdminLoginModal} onClose={() => setShowAdminLoginModal(false)} onLoginSuccess={(admin) => { setCurrentAdmin(admin); setShowAdminLoginModal(false); }} />
      <BranchLoginModal isOpen={showBranchLoginModal} onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} />
    </div>
  );
}