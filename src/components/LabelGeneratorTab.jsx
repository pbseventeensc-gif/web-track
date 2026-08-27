import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { supabase } from '../supabaseClient';

export default function LabelGeneratorTab({ isDarkMode, onOpenImageModal }) {
  const [labelData, setLabelData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [headerLogoUrl, setHeaderLogoUrl] = useState(() => localStorage.getItem('wellen_header_logo') || '');
  const [sjFormatType, setSjFormatType] = useState('modern');

  const generateNumericTrackingId = (spk, address) => {
    const rawKey = `${spk}_${address}`;
    let hash = 0;
    for (let i = 0; i < rawKey.length; i++) {
      hash = (hash << 5) - hash + rawKey.charCodeAt(i);
      hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    const randomSuffix = String(positiveHash % 9000 + 1000);
    
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}-${randomSuffix}`;
  };

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
        NO_SPK: "SPK-0826-03388", PO_NUMBER: "4500122101", NO_SJ: "SJ-0826-01920", CLIENT: "PT ASPIRASI HIDUP INDONESIA TBK",
        PROJECT: "ATARU GRAND WISATA", NO_WPP: "WPP 0826-301349", BRAND: "ATARU", RECIPIENT_NAME: "ADAM RIAN", RECIPIENT_PHONE: "0812.4161.2709",
        DELIVERY_ADDRESS: "STORE ATARU GRAND WISATA",
        ITEM_DESCRIPTION: "BALON ORANGE ATARU", MEDIA: "BALON", UKURAN: "1.00 x 1.00", QTY_TOTAL: 150, QTY_PER_KOLI: 50,
        DATE_PRODUCTION: "27-Aug-2026", SENDER: "WELLEN PRINT", SENDER_TELP: "021-5506999"
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateSampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_WellenPrint");
    XLSX.writeFile(wb, "Template_Import_WellenPrint.xlsx");
  };

  const parseExcelDate = (val) => {
    if (!val) return '-';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (!isNaN(val) && (typeof val === 'number' || String(val).match(/^\d{5}$/))) {
      const serial = Number(val);
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const jsDate = new Date(excelEpoch.getTime() + serial * 86400000);
      const day = String(jsDate.getUTCDate()).padStart(2, '0');
      const month = monthNames[jsDate.getUTCMonth()];
      const year = jsDate.getUTCFullYear();
      return `${day}-${month}-${year}`;
    }

    return String(val).trim();
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0]; 
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        if (!rawData || rawData.length === 0) {
          return alert('❌ File Excel kosong atau tidak terbaca!');
        }

        const cleanedData = rawData.map((row) => {
          const rawQty = row.QTY_TOTAL || row['Qty Total'] || row.qty_total || row.QTY || row['Total Qty'] || 0;
          const rawKoli = row.QTY_PER_KOLI || row['Qty Per Koli'] || row.qty_per_koli || row['ISI PER KOLI'] || 50;
          const rawDate = row.DATE_PRODUCTION || row['Date Production'] || row['Tgl Produksi'] || row.date_production;
          const deliveryAddress = String(row.DELIVERY_ADDRESS || row['Delivery Address'] || row.delivery_address || row['Alamat Penerima'] || '').trim();
          const spkVal = String(row.NO_SPK || row['No SPK'] || row.no_spk || '').trim();
          
          return {
            NO_SPK: spkVal,
            PO_NUMBER: String(row.PO_NUMBER || row['PO Number'] || '').trim(),
            NO_SJ: String(row.NO_SJ || row['NO SJ'] || `WL-${Math.floor(10 + Math.random() * 90)}`).trim(),
            CLIENT: String(row.CLIENT || row.Client || row.COMPANY || '').trim(),
            PROJECT: String(row.PROJECT || row['Project Name'] || row.project || '').trim(),
            NO_WPP: String(row.NO_WPP || row['No WPP'] || row.no_wpp || '').trim(),
            BRAND: String(row.BRAND || row.Brand || row['FILE NAME'] || '').trim(),
            RECIPIENT_NAME: String(row.RECIPIENT_NAME || row['Recipient Name'] || row['Nama Penerima'] || '').trim(),
            RECIPIENT_PHONE: String(row.RECIPIENT_PHONE || row['Recipient Phone'] || '').trim(),
            DELIVERY_ADDRESS: deliveryAddress,
            ITEM_DESCRIPTION: String(row.ITEM_DESCRIPTION || row['Item Description'] || '').trim(),
            MEDIA: String(row.MEDIA || row.Media || '').trim(),
            UKURAN: String(row.UKURAN || row.Ukuran || '').trim(),
            QTY_TOTAL: Number(String(rawQty).replace(/[^0-9]/g, '')) || 0,
            QTY_PER_KOLI: Number(String(rawKoli).replace(/[^0-9]/g, '')) || 50,
            DATE_PRODUCTION: parseExcelDate(rawDate),
            SENDER: String(row.SENDER || 'WELLEN PRINT').trim(),
            SENDER_TELP: String(row.SENDER_TELP || '021-5506999').trim(),
            VISUAL_IMAGE: String(row.VISUAL_IMAGE || '').trim(),
            VISUAL_IMAGE_2: String(row.VISUAL_IMAGE_2 || '').trim(),
            TRACKING_ID: generateNumericTrackingId(spkVal, deliveryAddress)
          };
        }).filter((item) => item.NO_SPK !== '' || item.CLIENT !== '' || item.QTY_TOTAL > 0);

        setLabelData(cleanedData); 
        setSelectedRows(cleanedData.map((_, i) => i));
        alert(`✅ Sukses Validasi! ${cleanedData.length} baris data berhasil di-import.`);
      } catch (err) { 
        alert('Gagal membaca file Excel: ' + err.message); 
      }
    };
    reader.readAsArrayBuffer(file); 
    e.target.value = '';
  };

  const handleUpdateKoliRow = (index, newKoliVal) => {
    const val = Math.max(1, Number(newKoliVal) || 1);
    setLabelData(prev => prev.map((item, idx) => idx === index ? { ...item, QTY_PER_KOLI: val } : item));
  };

  const handleBatchUploadGlobal = async (e, field) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (labelData.length === 0) {
      return alert('⚠️ Harap import data Excel terlebih dahulu sebelum melakukan upload gambar massal!');
    }

    const newLabelData = [...labelData];
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (i >= newLabelData.length) break;
      const file = files[i];
      
      const readFileAsDataURL = (fileObj) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve(evt.target.result);
          reader.readAsDataURL(fileObj);
        });
      };

      const base64Url = await readFileAsDataURL(file);
      const fileNameFull = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const cleanFileName = fileNameFull.toLowerCase().trim();

      let targetIndex = newLabelData.findIndex(item => {
        const spk = (item.NO_SPK || '').toLowerCase().trim();
        const brand = (item.BRAND || '').toLowerCase().trim();
        return (spk && (cleanFileName.includes(spk) || spk.includes(cleanFileName))) || (brand && (cleanFileName.includes(brand) || brand.includes(cleanFileName)));
      });

      if (targetIndex === -1) {
        targetIndex = i;
      }

      if (targetIndex < newLabelData.length) {
        newLabelData[targetIndex][field] = base64Url;
        successCount++;
      }
    }

    setLabelData(newLabelData);
    alert(`✅ Sukses! ${successCount} gambar berhasil diunggah dan dipetakan ke tabel.`);
    e.target.value = '';
  };

  const handleImageUploadRow = (e, index, field = 'VISUAL_IMAGE') => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Url = evt.target.result;
      setLabelData(prev => prev.map((item, i) => (i === index ? { ...item, [field]: base64Url } : item)));
    };
    reader.readAsDataURL(file);
  };

  const renderHeaderLogoHtmlLabel = () => {
    if (headerLogoUrl) return `<img src="${headerLogoUrl}" style="height:110px; max-width:180px; object-fit:contain; display:block; margin:auto;">`;
    return `<div style="font-weight:900; font-size:26px; line-height:1; color:#000; text-align:center;">WELLEN<br><span style="font-size:14px; letter-spacing:5px;">PRINT</span></div>`;
  };

  // Logo KOP Surat Jalan ditarik ke atas alamat, ukuran besar
  const renderHeaderLogoHtmlSJ = () => {
    if (headerLogoUrl) {
      return `<div style="display:flex; flex-direction:column; gap:6px;">
        <img src="${headerLogoUrl}" style="height:75px; max-width:210px; object-fit:contain; display:block;">
        <div style="font-size:10.5px; font-weight:bold; color:#111; line-height:1.25;">
          Jl. Raya Pasar Minggu No. 49 RT.002 RW.007 Duren Tiga, Jakarta Selatan<br>
          Telp: 021-5506999 &nbsp;|&nbsp; Email: order@wellenprint.com
        </div>
      </div>`;
    }
    return `<div style="display:flex; flex-direction:column; gap:4px;">
      <div style="font-weight:900; font-size:24px; line-height:1; color:#000;">WELLEN<br><span style="font-size:12px; letter-spacing:3px;">PRINT</span></div>
      <div style="font-size:10px; font-weight:bold; color:#222; line-height:1.25;">
        Jl. Raya Pasar Minggu No. 49 RT.002 RW.007 Duren Tiga, Jakarta Selatan<br>
        Telp: 021-5506999 &nbsp;|&nbsp; Email: order@wellenprint.com
      </div>
    </div>`;
  };

  const openPrintWindow = (htmlContent) => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWin = window.open(url, '_blank');
    if (!printWin) {
      alert('⚠️ Pop-up diblokir oleh browser! Mohon izinkan pop-up untuk situs ini.');
    }
  };

  const groupSelectedRows = () => {
    const itemsToProcess = selectedRows.length > 0 
      ? labelData.filter((_, idx) => selectedRows.includes(idx))
      : labelData;

    const groupedMap = {};

    itemsToProcess.forEach(item => {
      const groupKey = `${item.NO_SPK || 'SPK'}_${item.DELIVERY_ADDRESS || 'ADDRESS'}`;
      if (!groupedMap[groupKey]) {
        groupedMap[groupKey] = {
          ...item,
          TRACKING_ID: item.TRACKING_ID || generateNumericTrackingId(item.NO_SPK, item.DELIVERY_ADDRESS),
          itemsList: [],
          totalCombinedQty: 0
        };
      }
      groupedMap[groupKey].itemsList.push(item);
      groupedMap[groupKey].totalCombinedQty += Number(item.QTY_TOTAL || 0);

      if (!groupedMap[groupKey].VISUAL_IMAGE && item.VISUAL_IMAGE) {
        groupedMap[groupKey].VISUAL_IMAGE = item.VISUAL_IMAGE;
      }
      if (!groupedMap[groupKey].VISUAL_IMAGE_2 && item.VISUAL_IMAGE_2) {
        groupedMap[groupKey].VISUAL_IMAGE_2 = item.VISUAL_IMAGE_2;
      }
    });

    const firstAvailableImage = labelData.find(d => d.VISUAL_IMAGE)?.VISUAL_IMAGE || '';
    const firstAvailableImage2 = labelData.find(d => d.VISUAL_IMAGE_2)?.VISUAL_IMAGE_2 || '';

    Object.values(groupedMap).forEach(group => {
      if (!group.VISUAL_IMAGE) group.VISUAL_IMAGE = firstAvailableImage;
      if (!group.VISUAL_IMAGE_2) group.VISUAL_IMAGE_2 = firstAvailableImage2;
    });

    return Object.values(groupedMap);
  };

  const syncToPackingDatabase = async (groupedItems) => {
    for (const item of groupedItems) {
      const payload = {
        tracking_id: item.TRACKING_ID,
        no_spk: item.NO_SPK,
        client_pt: item.CLIENT || '-',
        promo_title: item.PROJECT || '-',
        store_name: item.DELIVERY_ADDRESS || 'Store Utama',
        recipient_name: item.RECIPIENT_NAME || '-',
        total_qty: item.totalCombinedQty,
        status_qc_label: 'PENDING',
        status_qc_packing: 'PENDING',
        status_qc_checker: 'PENDING',
        status_deliver: 'PENDING',
        updated_at: new Date().toISOString()
      };
      await supabase.from('packing_tracking').upsert(payload, { onConflict: 'tracking_id' });
    }
  };

  const handlePrintLabels = async () => {
    if (labelData.length === 0) return alert('⚠️ Belum ada data yang di-import!');
    const groupedItems = groupSelectedRows();
    await syncToPackingDatabase(groupedItems);
    
    let allLabelBoxes = [];
    for (const group of groupedItems) {
      const trackingCode = group.TRACKING_ID;
      const qrText = `https://web-track-phi-gilt.vercel.app/?scan=${trackingCode}`;

      let qrDataUrl = ''; 
      try { 
        qrDataUrl = await QRCode.toDataURL(qrText, { width: 150, margin: 1 }); 
      } catch (e) { 
        console.error(e); 
      }

      const totalQty = Number(group.totalCombinedQty || 0);
      const qtyPerKoli = Number(group.QTY_PER_KOLI || 50) > 0 ? Number(group.QTY_PER_KOLI || 50) : 50;
      const totalKoliCalculated = Math.max(1, Math.ceil(totalQty / qtyPerKoli));

      for (let koliNum = 1; koliNum <= totalKoliCalculated; koliNum++) {
        let currentKoliQty = qtyPerKoli;
        if (koliNum === totalKoliCalculated) {
          const remainder = totalQty % qtyPerKoli;
          if (remainder > 0) currentKoliQty = remainder;
        }

        allLabelBoxes.push({
          ...group,
          currentKoli: koliNum,
          totalKoli: totalKoliCalculated,
          currentQty: currentKoliQty,
          qrDataUrl: qrDataUrl,
          displayTrackingId: trackingCode
        });
      }
    }

    const pagePairs = [];
    for (let i = 0; i < allLabelBoxes.length; i += 2) {
      pagePairs.push(allLabelBoxes.slice(i, i + 2));
    }

    const pagesHtml = await Promise.all(pagePairs.map(async (pair) => {
      const labelsHtml = await Promise.all(pair.map(async (item) => {
        const img1 = item.VISUAL_IMAGE ? `<img src="${item.VISUAL_IMAGE}" class="preview-img">` : '';
        const img2 = item.VISUAL_IMAGE_2 ? `<img src="${item.VISUAL_IMAGE_2}" class="preview-img">` : '';
        const noImg = (!item.VISUAL_IMAGE && !item.VISUAL_IMAGE_2) ? `<div style="font-size:11px; opacity:0.5;">[ No Image ]</div>` : '';

        const itemsHtml = item.itemsList.map(it => 
          `• ${it.ITEM_DESCRIPTION || '-'} (${it.MEDIA || ''} - ${it.UKURAN || ''}) [<strong>${it.QTY_TOTAL} Pcs</strong>]`
        ).join('<br>');

        return `
          <div class="label-box">
            <table class="header-table"><tr>
              <td style="width: 26%; vertical-align: middle; padding: 4px 6px;">${renderHeaderLogoHtmlLabel()}</td>
              <td style="width: 54%; text-align:center; font-size:9px; line-height: 1.3; vertical-align: middle; padding: 4px 6px;">
                <strong style="font-size:12px;">WELLEN PRINT</strong><br>
                Green Sedayu Bizpark. Jl. Daan Mogot KM.18 blok DM3 No.18, Kalideres, RT.11/RW.6, Kalideres, Jakarta Barat, 11840
              </td>
              <td style="width: 20%; text-align:center; vertical-align: middle; padding: 4px 6px;">
                ${item.qrDataUrl ? `<img src="${item.qrDataUrl}" style="width:65px; height:65px; display:block; margin:auto;">` : ''}
                <div style="font-size: 8.5px; font-weight: bold; margin-top: 2px;">${item.displayTrackingId}</div>
              </td>
            </tr></table>
            
            <div class="content-grid">
              <div class="grid-box">
                <table class="align-table">
                  <tr><td class="label-col">SENDER</td><td class="sep-col">:</td><td class="val-col"><strong>${item.SENDER || 'WELLEN PRINT'}</strong></td></tr>
                  <tr><td class="label-col">NO. TELP</td><td class="sep-col">:</td><td class="val-col">${item.SENDER_TELP || '021-5506999'}</td></tr>
                </table>
              </div>
              <div class="grid-box">
                <table class="align-table">
                  <tr><td class="label-col">CLIENT</td><td class="sep-col">:</td><td class="val-col"><strong>${item.CLIENT || '-'}</strong></td></tr>
                  <tr><td class="label-col">Delivery Address</td><td class="sep-col">:</td><td class="val-col">${item.DELIVERY_ADDRESS || '-'}</td></tr>
                  <tr><td class="label-col">Recipient Name</td><td class="sep-col">:</td><td class="val-col"><strong>${item.RECIPIENT_NAME || '-'}</strong></td></tr>
                  <tr><td class="label-col">Recipient Phone</td><td class="sep-col">:</td><td class="val-col">${item.RECIPIENT_PHONE || '-'}</td></tr>
                </table>
              </div>
              <div class="grid-box">
                <table class="align-table">
                  <tr><td class="label-col">PROJECT</td><td class="sep-col">:</td><td class="val-col"><strong>${item.PROJECT || '-'}</strong></td></tr>
                  <tr><td class="label-col">PO NUMBER</td><td class="sep-col">:</td><td class="val-col">${item.PO_NUMBER || '-'}</td></tr>
                  <tr><td class="label-col">NO. WPP</td><td class="sep-col">:</td><td class="val-col">${item.NO_WPP || '-'}</td></tr>
                  <tr><td class="label-col">NO. SPK</td><td class="sep-col">:</td><td class="val-col">${item.NO_SPK || '-'}</td></tr>
                  <tr><td class="label-col" style="vertical-align:top;">ITEM LIST</td><td class="sep-col" style="vertical-align:top;">:</td><td class="val-col">${itemsHtml}</td></tr>
                  <tr><td class="label-col">QTY KOLI INI</td><td class="sep-col">:</td><td class="val-col"><strong style="font-size:11px; color:#2563EB;">${item.currentQty} PCS (Koli ${item.currentKoli}/${item.totalKoli})</strong></td></tr>
                  <tr><td class="label-col">DATE PRODUCTION</td><td class="sep-col">:</td><td class="val-col">${item.DATE_PRODUCTION || '-'}</td></tr>
                </table>
              </div>
              
              <div class="grid-box visual-box">
                <div class="visual-title">VISUAL IMAGE :</div>
                <div class="koli-title">${item.currentKoli} OF ${item.totalKoli}</div>
                <div class="visual-img-container">
                  ${img1}
                  ${img2}
                  ${noImg}
                </div>
              </div>
            </div>
          </div>
        `;
      }));

      return `<div class="label-page">${labelsHtml.join('<div class="cut-guide"></div>')}</div>`;
    }));

    const fullHtml = `<!DOCTYPE html><html><head><title>Print & Download PDF Label - Wellen Print</title><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #555; } 
      .action-bar { position: fixed; top: 0; left: 0; width: 100%; background: #1e1e1e; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.4); font-size: 12px; }
      .control-group { display: flex; align-items: center; gap: 8px; }
      .control-group select, .control-group label { background: #333; color: #fff; border: 1px solid #555; padding: 6px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; }
      .action-bar button { background: #4F46E5; color: white; border: none; padding: 8px 14px; font-weight: bold; border-radius: 6px; cursor: pointer; }
      .action-bar button:hover { background: #4338CA; }
      .page-wrapper { margin-top: 65px; display: flex; flex-direction: column; align-items: center; gap: 0px; }
      .label-page { width: 210mm; height: 297mm; max-height: 297mm; padding: 4mm 8mm; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5); margin-bottom: 20px; overflow: hidden; } 
      .label-box { border: 2px solid #000; width: 100%; height: 133mm; max-height: 133mm; display: flex; flex-direction: column; box-sizing: border-box; background: #fff; overflow: hidden; } 
      .cut-guide { width: 100%; border-top: 1.5px dashed #444; margin: 1mm 0; }
      .header-table { width: 100%; border-bottom: 2px solid #000; border-collapse: collapse; } 
      .header-table td { border: none; vertical-align: middle; } 
      .content-grid { display: grid; grid-template-columns: 1fr 1fr; flex-grow: 1; } 
      .grid-box { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 6px; font-size: 9.5px; line-height: 1.25; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; } 
      .grid-box:nth-child(2n) { border-right: none; } 
      .grid-box:nth-child(3), .grid-box:nth-child(4) { border-bottom: none; } 
      .align-table { width: 100%; border-collapse: collapse; }
      .align-table td { border: none; padding: 1px 0; vertical-align: middle; font-size: 9px; }
      .label-col { width: 38%; font-weight: bold; }
      .sep-col { width: 4%; text-align: center; }
      .val-col { width: 58%; }
      .visual-box { display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 4px !important; } 
      .visual-title { font-size: 9.5px; font-weight: bold; width: 100%; text-align: center; margin-bottom: 1px; }
      .koli-title { font-size: 12px; font-weight: bold; margin: 1px 0; } 
      .visual-img-container { width: 100%; flex-grow: 1; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 6px; overflow: hidden; }
      .preview-img { max-width: 95%; max-height: 110px; object-fit: contain; display: block; } 
      @media print { 
        body { background: #fff; margin: 0; padding: 0; }
        .action-bar { display: none; }
        .page-wrapper { margin-top: 0; gap: 0; }
        .label-page { box-shadow: none; margin-bottom: 0; width: 210mm; height: 297mm; max-height: 297mm; padding: 4mm 8mm; page-break-after: always; break-after: page; page-break-inside: avoid; overflow: hidden; } 
        @page { size: A4 portrait; margin: 0mm; }
      }
    </style></head><body>
      <div class="action-bar">
        <span><b>🖨️ Pengaturan Printer Office & Cetak Label</b></span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="window.print()" style="background:#0D9488;">🖨️ Print / Setting Printer</button>
          <button onclick="window.print()" style="background:#4F46E5;">📥 Download PDF</button>
        </div>
      </div>
      <div class="page-wrapper">${pagesHtml}</div>
    </body></html>`;

    openPrintWindow(fullHtml);
  };

  const handlePrintSuratJalan = async () => {
    if (labelData.length === 0) return alert('⚠️ Belum ada data yang di-import!');
    const groupedItems = groupSelectedRows();
    await syncToPackingDatabase(groupedItems);

    const pagesHtml = groupedItems.map((group) => {
      let grandTotal = 0;
      const rowsHtml = group.itemsList.map((it, idx) => {
        const qty = Number(it.QTY_TOTAL || 0);
        grandTotal += qty;
        return sjFormatType === 'modern' ? `
          <tr>
            <td style="text-align: center; width: 8%; font-size: 12px; font-weight: bold;">${idx + 1}</td>
            <td style="width: 38%; font-size: 12px; font-weight: bold;">${it.ITEM_DESCRIPTION || '-'}</td>
            <td style="width: 34%; font-size: 11.5px; font-weight: bold;">${it.MEDIA || '-'}<br><span style="font-size: 11px;">Ukuran: ${it.UKURAN || '-'}</span></td>
            <td style="text-align: right; padding-right: 10px; width: 20%; font-size: 13px; font-weight: bold;">${qty.toLocaleString()}</td>
          </tr>
        ` : `
          <tr>
            <td style="text-align: center; width: 8%; font-size: 12px; font-weight: bold;">${idx + 1}</td>
            <td style="width: 55%; font-size: 12px; font-weight: bold;">${it.ITEM_DESCRIPTION || '-'} ${it.BRAND ? '_' + it.BRAND : ''}</td>
            <td style="text-align: center; width: 22%; font-size: 11.5px; font-weight: bold;">${it.UKURAN || '-'}</td>
            <td style="text-align: right; padding-right: 10px; width: 15%; font-size: 13px; font-weight: bold;">${qty.toLocaleString()}</td>
          </tr>
        `;
      }).join('');

      if (sjFormatType === 'modern') {
        return `
          <div class="sj-page">
            <div class="sj-top-header">
              <div class="logo-sec">${renderHeaderLogoHtmlSJ()}</div>
              <div style="text-align: right;">
                <div class="sj-title">SURAT JALAN</div>
                <div style="font-size: 11px; font-weight: bold; margin-top: 1px;">Tracking ID: ${group.TRACKING_ID}</div>
              </div>
            </div>
            <div class="info-row">
              <div class="info-box left-box">
                <div class="info-line font-bold" style="font-size: 11px;">Kepada Yth :</div>
                <div class="info-line font-bold" style="font-size: 12px;">${group.CLIENT || '-'}</div>
                <div class="info-line" style="font-size: 11px; line-height: 1.25; font-weight: bold;">${group.DELIVERY_ADDRESS || '-'}</div>
                <div class="info-line" style="font-size: 11px; font-weight: bold;">UP : ${group.RECIPIENT_NAME || '-'} ${group.RECIPIENT_PHONE || ''}</div>
              </div>
              <div class="right-box-container">
                <table class="meta-table">
                  <tr><td class="font-bold">NO PO</td><td class="font-bold">: ${group.PO_NUMBER || '-'}</td></tr>
                  <tr><td class="font-bold">BRAND</td><td class="font-bold">: ${group.BRAND || '-'}</td></tr>
                  <tr><td class="font-bold">NO SJ</td><td class="font-bold">: ${group.NO_SJ || '-'}</td></tr>
                </table>
                <div class="date-box">
                  <div class="date-header">TANGGAL</div>
                  <div class="date-value">${group.DATE_PRODUCTION || '-'}</div>
                </div>
              </div>
            </div>
            <table class="item-grid-table">
              <thead>
                <tr><th>NO</th><th>NAMA ITEM / PRODUK</th><th>MEDIA & UKURAN</th><th>QTY</th></tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
              <tfoot>
                <tr><td colspan="3" class="text-center font-bold" style="font-size: 12px;">TOTAL KESELURUHAN</td><td style="text-align: right; padding-right: 10px; font-size: 13px;" class="font-bold">${grandTotal.toLocaleString()}</td></tr>
              </tfoot>
            </table>
            <div class="signature-section">
              <div class="signature-top-line"></div>
              <div class="signature-content-row">
                <div class="sig-info-col">
                  <div>Tgl &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${group.DATE_PRODUCTION || '-'}</div>
                  <div>Nama File &nbsp;&nbsp;: ${group.BRAND || '-'}</div>
                  <div>Inv &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${group.NO_WPP || '-'}</div>
                  <div>PO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${group.PO_NUMBER || '-'}</div>
                </div>
                <div class="sig-box font-bold">DIBUAT OLEH</div>
                <div class="sig-box font-bold">DIKIRIM OLEH</div>
                <div class="sig-box font-bold">DITERIMA OLEH</div>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="sj-page classic-page">
            <div class="sj-top-classic">
              <div class="logo-sec-cl">${renderHeaderLogoHtmlSJ()}</div>
              <div class="sj-title-cl">
                <div style="font-size: 20px; font-weight: bold;">SURAT JALAN</div>
                <div style="font-size: 13px; font-weight: bold; margin-top: 1px;">${group.NO_SJ || 'SJ-0826-01920'}</div>
                <div style="font-size: 10.5px; font-weight: bold; margin-top: 1px;">Tracking ID: ${group.TRACKING_ID}</div>
                <div style="font-size: 11px; margin-top: 3px; text-align: left; line-height: 1.25; font-weight: bold;">
                  Kepada Yth, :<br>
                  <strong>${group.CLIENT || '-'}</strong><br>
                  ${group.DELIVERY_ADDRESS || '-'} - UP: ${group.RECIPIENT_NAME || '-'} (${group.RECIPIENT_PHONE || ''})
                </div>
              </div>
            </div>
            
            <table class="item-grid-table classic-table">
              <thead>
                <tr><th style="width: 8%;">No.</th><th>Nama Barang</th><th style="width: 22%;">Ukuran</th><th style="width: 15%;">Qty</th></tr>
              </thead>
              <tbody>
                ${rowsHtml}
                <tr style="height: 30px;"><td colspan="4"></td></tr>
              </tbody>
              <tfoot>
                <tr><td colspan="3" style="text-align: right; font-weight: bold; padding-right: 10px; font-size: 12px;">TOTAL</td><td style="text-align: right; padding-right: 10px; font-weight: bold; font-size: 13px;">${grandTotal.toLocaleString()}</td></tr>
              </tfoot>
            </table>

            <div class="signature-section">
              <div class="signature-top-line"></div>
              <div class="signature-content-row">
                <div class="footer-left font-bold" style="font-size: 10.5px; width: 35%;">
                  <div>Tgl &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${group.DATE_PRODUCTION || '-'}</div>
                  <div>Nama File &nbsp;&nbsp;: ${group.BRAND || '-'}</div>
                  <div>Inv &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${group.NO_WPP || '-'}</div>
                  <div>PO &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${group.PO_NUMBER || '-'}</div>
                </div>
                <div class="sig-col font-bold">DIBUAT OLEH</div>
                <div class="sig-col font-bold">DIKIRIM OLEH</div>
                <div class="sig-col font-bold">DITERIMA OLEH</div>
              </div>
            </div>
          </div>
        `;
      }
    }).join('');

    const fullSjHtml = `<!DOCTYPE html><html><head><title>Print & Download PDF Surat Jalan - Wellen Print</title><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #555; color: #000; } 
      .action-bar { position: fixed; top: 0; left: 0; width: 100%; background: #1e1e1e; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; box-shadow: 0 2px 10px rgba(0,0,0,0.4); font-size: 12px; }
      .control-group { display: flex; align-items: center; gap: 8px; }
      .control-group select, .control-group label { background: #333; color: #fff; border: 1px solid #555; padding: 6px 10px; border-radius: 6px; font-size: 11px; cursor: pointer; }
      .action-bar button { background: #4F46E5; color: white; border: none; padding: 8px 14px; font-weight: bold; border-radius: 6px; cursor: pointer; }
      .action-bar button:hover { background: #4338CA; }
      .page-wrapper { margin-top: 65px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
      
      .sj-page { width: 210mm; height: 140mm; padding: 5mm 7mm; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; background: #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5); margin-bottom: 20px; font-size: 11px; } 
      
      .font-bold { font-weight: bold; } .font-normal { font-weight: normal; } .text-center { text-align: center; } 
      .sj-top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; } 
      .sj-title { font-size: 22px; font-weight: bold; text-align: right; } 
      .info-row { display: flex; gap: 10px; margin-bottom: 4px; } 
      .info-box { border: 1.5px solid #000; padding: 5px 8px; font-size: 11px; line-height: 1.3; } 
      .left-box { flex: 1; height: 68px; } .right-box-container { width: 44%; display: flex; flex-direction: column; gap: 3px; } 
      .meta-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; } 
      .meta-table td { padding: 2px 5px; border: none; } 
      .date-box { border: 1.5px solid #000; height: 35px; display: flex; flex-direction: column; text-align: center; font-size: 11px; } 
      .date-header { border-bottom: 1.5px solid #000; font-weight: bold; padding: 1px 0; background: #f8f8f8; font-size: 10px; } 
      .date-value { padding-top: 3px; font-weight: bold; font-size: 12px; } 
      .item-grid-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; margin-bottom: 6px; } 
      .item-grid-table th, .item-grid-table td { border: 1.5px solid #000; padding: 5px 7px; } 
      .item-grid-table th { text-align: center; background: #f8f8f8; font-size: 11px; font-weight: bold; } 
      .item-grid-table tfoot td { background: #f8f8f8; font-size: 12px; } 
      
      .signature-section { border: 1.5px solid #000; border-top: none; margin-top: auto; }
      .signature-top-line { width: 100%; border-top: 2px solid #000; }
      .signature-content-row { display: flex; justify-content: space-around; text-align: center; font-size: 11px; font-weight: bold; padding: 6px; } 
      .sig-box { flex: 1; border-right: 1.5px solid #000; padding-top: 24px; font-size: 11px; } 
      .sig-box:last-child { border-right: none; }
      .sig-info-col { flex: 1.2; border-right: 1.5px solid #000; text-align: left; padding: 2px 6px; font-size: 10.5px; line-height: 1.3; }

      .classic-page { padding: 5mm 7mm !important; }
      .sj-top-classic { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 5px; }
      .logo-sec-cl { width: 45%; }
      .sj-title-cl { width: 52%; border: 1.5px solid #000; padding: 5px; font-size: 11px; }
      .classic-table th, .classic-table td { border: 1px solid #000; padding: 5px 7px; font-size: 11px; }
      
      .footer-left { padding: 2px 6px; border-right: 1.5px solid #000; line-height: 1.3; font-size: 10.5px; text-align: left; }
      .footer-right { display: flex; flex: 2; }
      .sig-col { flex: 1; border-right: 1.5px solid #000; text-align: center; padding: 3px; display: flex; flex-direction: column; justify-content: space-between; height: 44px; font-size: 10.5px; font-weight: bold; }
      .sig-col:last-child { border-right: none; }

      @media print { 
        body { background: #fff; margin: 0; padding: 0; }
        .action-bar { display: none; }
        .page-wrapper { margin-top: 0; gap: 0; }
        .sj-page { box-shadow: none; margin-bottom: 0; width: 210mm; height: 140mm; page-break-after: always; break-after: page; page-break-inside: avoid; } 
        @page { size: 210mm 140mm landscape; margin: 0mm; }
      }
    </style></head><body>
      <div class="action-bar">
        <span><b>🖨️ Surat Jalan (Clean Header & Top Line)</b></span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="window.print()" style="background:#0D9488;">🖨️ Print / Setting Printer</button>
          <button onclick="window.print()" style="background:#4F46E5;">📥 Download PDF</button>
        </div>
      </div>
      <div class="page-wrapper">${pagesHtml}</div>
    </body></html>`;

    openPrintWindow(fullSjHtml);
  };

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <div className="flex items-center gap-3">
          <div className="w-20 h-14 rounded-xl border bg-stone-50 dark:bg-neutral-900 flex items-center justify-center overflow-hidden p-1">
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

      <div className={`p-4 rounded-2xl border flex flex-col lg:flex-row justify-between items-center gap-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <label className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm transition-all ${isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#6B8E85] hover:bg-[#57756D]'}`}>
            📁 Import Excel Format Label & SJ <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" />
          </label>
          <button onClick={handleDownloadTemplate} className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all">📥 Download Template Excel</button>
          
          <div className="flex items-center gap-1.5 ml-1 bg-stone-100 dark:bg-neutral-900 p-1.5 rounded-xl border border-stone-300 dark:border-neutral-700">
            <span className="text-[10px] font-bold px-1 opacity-70">Format SJ:</span>
            <button onClick={() => setSjFormatType('modern')} className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${sjFormatType === 'modern' ? 'bg-indigo-600 text-white shadow-sm' : 'opacity-60 hover:opacity-100'}`}>Modern</button>
            <button onClick={() => setSjFormatType('classic')} className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${sjFormatType === 'classic' ? 'bg-indigo-600 text-white shadow-sm' : 'opacity-60 hover:opacity-100'}`}>Klasik</button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm bg-teal-600 hover:bg-teal-500 transition-all flex items-center gap-1.5">
            🖼️ Upload Massal Gbr 1 (Kiri) <input type="file" accept="image/*" multiple onChange={(e) => handleBatchUploadGlobal(e, 'VISUAL_IMAGE')} className="hidden" />
          </label>
          <label className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm bg-cyan-600 hover:bg-cyan-500 transition-all flex items-center gap-1.5">
            🖼️ Upload Massal Gbr 2 (Kanan) <input type="file" accept="image/*" multiple onChange={(e) => handleBatchUploadGlobal(e, 'VISUAL_IMAGE_2')} className="hidden" />
          </label>
          {labelData.length > 0 && <button onClick={() => { if(confirm('Bersihkan data?')) { setLabelData([]); setSelectedRows([]); } }} className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all">🧹 Bersihkan</button>}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handlePrintSuratJalan} className="px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95">
            📄 Cetak Surat Jalan
          </button>
          <button onClick={handlePrintLabels} className="px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95">
            🏷️ Cetak Label Koli
          </button>
        </div>
      </div>

      <div className={`overflow-x-auto rounded-2xl border shadow-sm ${isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2]'}`}>
        <table className="w-full text-left text-xs">
          <thead className={`font-bold border-b ${isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'}`}>
            <tr>
              <th className="p-3 text-center w-10"><input type="checkbox" checked={labelData.length > 0 && selectedRows.length === labelData.length} onChange={() => setSelectedRows(selectedRows.length === labelData.length ? [] : labelData.map((_, idx) => idx))} className="cursor-pointer accent-indigo-600" /></th>
              <th className="p-3">No SPK / Tracking ID</th>
              <th className="p-3">Client & Brand</th>
              <th className="p-3">Penerima & Alamat</th>
              <th className="p-3">Deskripsi / Media / Ukuran</th>
              <th className="p-3">Total Qty</th>
              <th className="p-3">Isi/Koli (Edit)</th>
              <th className="p-3">Visual Image (1 & 2)</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
            {labelData.length === 0 ? (
              <tr><td colSpan="8" className="p-6 text-center opacity-60">Tabel kosong. Silakan klik tombol <strong>"Download Template Excel"</strong> di atas.</td></tr>
            ) : (
              labelData.map((row, idx) => {
                const total = Number(row.QTY_TOTAL || 0); 
                const koli = Number(row.QTY_PER_KOLI || 50); 
                const totalKoliCalc = Math.max(1, Math.ceil(total / koli));
                const isChecked = selectedRows.includes(idx);

                return (
                  <tr key={idx} className={`transition-colors ${isChecked ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70' : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'}`}>
                    <td className="p-3 text-center"><input type="checkbox" checked={isChecked} onChange={() => setSelectedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} className="cursor-pointer accent-indigo-600" /></td>
                    <td className="p-3 font-bold text-blue-500">{row.NO_SPK || '-'}<br /><span className="font-normal text-[10px] opacity-70">PO: {row.PO_NUMBER || '-'}</span><br /><span className="font-mono text-[10px] text-emerald-500 font-bold">ID: {row.TRACKING_ID}</span></td>
                    <td className="p-3"><strong className="text-xs">{row.CLIENT || '-'}</strong><br /><span className="text-[10px] opacity-70">{row.BRAND || '-'}</span></td>
                    <td className="p-3"><strong>{row.RECIPIENT_NAME || '-'}</strong> ({row.RECIPIENT_PHONE || '-'})<br /><span className="text-[10px] opacity-70">{row.DELIVERY_ADDRESS || '-'}</span></td>
                    <td className="p-3">{row.ITEM_DESCRIPTION || '-'}<br /><span className="text-[10px] opacity-70">{row.MEDIA || '-'} ({row.UKURAN || '-'} )</span></td>
                    <td className="p-3 font-bold">{total.toLocaleString()} Pcs</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="number" 
                          value={row.QTY_PER_KOLI || 50} 
                          onChange={(e) => handleUpdateKoliRow(idx, e.target.value)} 
                          className="w-16 px-2 py-1 rounded border text-xs font-bold text-center bg-white dark:bg-neutral-900 dark:border-neutral-700" 
                        />
                        <span className="text-[10px] opacity-70">Pcs (<strong>{totalKoliCalc} Koli</strong>)</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold opacity-70">Gbr 1:</span>
                          {row.VISUAL_IMAGE ? <img src={row.VISUAL_IMAGE} alt="1" onClick={() => onOpenImageModal(row.VISUAL_IMAGE, `Visual 1`)} className="w-10 h-6 object-contain border rounded bg-white cursor-pointer" /> : <span className="text-[10px] opacity-40">-</span>}
                          <label className="cursor-pointer px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold">
                            Upload <input type="file" accept="image/*" onChange={(e) => handleImageUploadRow(e, idx, 'VISUAL_IMAGE')} className="hidden" />
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold opacity-70">Gbr 2:</span>
                          {row.VISUAL_IMAGE_2 ? <img src={row.VISUAL_IMAGE_2} alt="2" onClick={() => onOpenImageModal(row.VISUAL_IMAGE_2, `Visual 2`)} className="w-10 h-6 object-contain border rounded bg-white cursor-pointer" /> : <span className="text-[10px] opacity-40">-</span>}
                          <label className="cursor-pointer px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold">
                            Upload <input type="file" accept="image/*" onChange={(e) => handleImageUploadRow(e, idx, 'VISUAL_IMAGE_2')} className="hidden" />
                          </label>
                        </div>
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