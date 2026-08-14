import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

export default function LabelGeneratorTab({ isDarkMode, onOpenImageModal }) {
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