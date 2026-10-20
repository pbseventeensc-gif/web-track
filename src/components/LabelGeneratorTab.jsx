import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { supabase } from '../supabaseClient';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Image as ImageIcon,
  FileText,
  Trash2,
  Tag,
  RefreshCw,
  Search,
  X,
  RotateCcw
} from 'lucide-react';

export default function LabelGeneratorTab({ isDarkMode, onOpenImageModal }) {
  const [labelData, setLabelData] = useState([]);
  const [previousLabelData, setPreviousLabelData] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [headerLogoUrl, setHeaderLogoUrl] = useState(() => localStorage.getItem('wellen_header_logo') || '');
  const [sjFormatType, setSjFormatType] = useState('modern');
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    fetchPackingData();

    let debounceTimer = null;
    const channel = supabase
      .channel('label_generator_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packing_tracking' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchPackingData();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPackingData = async () => {
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('id, no_spk, box_code, client_pt, promo_title, recipient_name, store_name, total_qty, tracking_id, items_detail, created_at')
      .order('id', { ascending: false })
      .limit(300);

    if (!error && data) {
      const formatted = [];
      data.forEach((item) => {
        let details = [];
        if (Array.isArray(item.items_detail)) {
          details = item.items_detail;
        } else if (typeof item.items_detail === 'string') {
          try { details = JSON.parse(item.items_detail); } catch (e) { details = []; }
        }

        if (details.length === 0) {
          formatted.push({
            NO_SPK: item.no_spk || '',
            PO_NUMBER: '',
            NO_SJ: item.box_code || '',
            CLIENT: item.client_pt || '',
            PROJECT: item.promo_title || '',
            NO_WPP: item.no_spk || '',
            BRAND: '',
            RECIPIENT_NAME: item.recipient_name || '',
            RECIPIENT_PHONE: '',
            DELIVERY_ADDRESS: item.store_name || '',
            ITEM_DESCRIPTION: item.promo_title || '',
            MEDIA: '',
            UKURAN: '',
            QTY_TOTAL: Number(item.total_qty) || 0,
            QTY_PER_KOLI: 50,
            DATE_PRODUCTION: '-',
            SENDER: 'WELLEN PRINT',
            SENDER_TELP: '021-5506999',
            VISUAL_IMAGE: '',
            VISUAL_IMAGE_2: '',
            TRACKING_ID: item.tracking_id
          });
        } else {
          details.forEach((d) => {
            formatted.push({
              NO_SPK: item.no_spk || '',
              PO_NUMBER: d.po_number || '',
              NO_SJ: d.no_sj || item.box_code || '',
              CLIENT: item.client_pt || '',
              PROJECT: d.desc || item.promo_title || '',
              NO_WPP: d.no_wpp || item.no_spk || '',
              BRAND: d.brand || d.code || '',
              RECIPIENT_NAME: item.recipient_name || '',
              RECIPIENT_PHONE: d.recipient_phone || '',
              DELIVERY_ADDRESS: item.store_name || '',
              ITEM_DESCRIPTION: d.desc || '',
              MEDIA: d.material || '',
              UKURAN: d.size || '',
              QTY_TOTAL: Number(d.qty) || Number(item.total_qty) || 0,
              QTY_PER_KOLI: Number(d.qty_per_koli) || 50,
              DATE_PRODUCTION: d.date_production || '-',
              SENDER: d.sender || 'WELLEN PRINT',
              SENDER_TELP: d.sender_telp || '021-5506999',
              VISUAL_IMAGE: d.visual_image || '',
              VISUAL_IMAGE_2: d.visual_image_2 || '',
              TRACKING_ID: item.tracking_id
            });
          });
        }
      });

      setLabelData(formatted);
      setSelectedRows(prev => prev.length === 0 ? formatted.map((_, i) => i) : prev);
    }
  };

  const saveItemsToSupabase = async (itemsToSave) => {
    if (!itemsToSave || itemsToSave.length === 0) return;

    const targetTrackingIds = Array.from(new Set(itemsToSave.map(item => {
      const spkVal = (item.NO_SPK && item.NO_SPK !== '-') ? item.NO_SPK : 'SPK';
      const addressVal = (item.DELIVERY_ADDRESS && item.DELIVERY_ADDRESS !== '-') ? item.DELIVERY_ADDRESS : ((item.RECIPIENT_NAME && item.RECIPIENT_NAME !== '-') ? item.RECIPIENT_NAME : 'STORE');
      return item.TRACKING_ID || generateNumericTrackingId(spkVal, addressVal);
    }))).filter(Boolean);

    // Preservasi status jika tracking_id sudah ada di database Supabase (hanya query tracking_id yang bersangkutan)
    let existingRows = [];
    if (targetTrackingIds.length > 0) {
      const { data } = await supabase
        .from('packing_tracking')
        .select('tracking_id, status_qc_packing, status_qc_checker, status_qc_label, status_deliver, items_detail')
        .in('tracking_id', targetTrackingIds);
      if (data) existingRows = data;
    }
    const existingMap = {};
    if (existingRows) {
      existingRows.forEach(r => { existingMap[r.tracking_id] = r; });
    }

    // Group itemsToSave by SPK + Delivery Address
    const groupedMap = {};
    itemsToSave.forEach(item => {
      const spkVal = (item.NO_SPK && item.NO_SPK !== '-') ? item.NO_SPK : 'SPK';
      const addressVal = (item.DELIVERY_ADDRESS && item.DELIVERY_ADDRESS !== '-') ? item.DELIVERY_ADDRESS : ((item.RECIPIENT_NAME && item.RECIPIENT_NAME !== '-') ? item.RECIPIENT_NAME : 'STORE');
      const trackingCode = item.TRACKING_ID || generateNumericTrackingId(spkVal, addressVal);
      const groupKey = `${spkVal}_${addressVal}`;

      const validProject = (item.PROJECT && item.PROJECT !== '-') ? item.PROJECT : ((item.ITEM_DESCRIPTION && item.ITEM_DESCRIPTION !== '-') ? item.ITEM_DESCRIPTION : '-');
      const validStore = (item.DELIVERY_ADDRESS && item.DELIVERY_ADDRESS !== '-') ? item.DELIVERY_ADDRESS : ((item.RECIPIENT_NAME && item.RECIPIENT_NAME !== '-') ? item.RECIPIENT_NAME : (item.CLIENT && item.CLIENT !== '-' ? item.CLIENT : 'Store Utama'));
      const validBox = (item.NO_SJ && item.NO_SJ !== '-') ? item.NO_SJ : (item.box_code && item.box_code !== '-' ? item.box_code : 'WL-01');

      if (!groupedMap[groupKey]) {
        groupedMap[groupKey] = {
          tracking_id: trackingCode,
          no_spk: (item.NO_SPK && item.NO_SPK !== '-') ? item.NO_SPK : '-',
          client_pt: (item.CLIENT && item.CLIENT !== '-') ? item.CLIENT : '-',
          promo_title: validProject,
          store_name: validStore,
          recipient_name: (item.RECIPIENT_NAME && item.RECIPIENT_NAME !== '-') ? item.RECIPIENT_NAME : '-',
          box_code: validBox,
          itemsList: [],
          totalCombinedQty: 0
        };
      }
      groupedMap[groupKey].itemsList.push({
        code: item.BRAND || item.NO_SPK || 'ITEM',
        desc: item.ITEM_DESCRIPTION || item.PROJECT || '-',
        material: item.MEDIA || '-',
        size: item.UKURAN || '-',
        qty: Number(item.QTY_TOTAL) || 0,
        unit: 'Pcs',
        po_number: item.PO_NUMBER || '',
        no_sj: item.NO_SJ || '',
        no_wpp: item.NO_WPP || '',
        brand: item.BRAND || '',
        recipient_phone: item.RECIPIENT_PHONE || '',
        qty_per_koli: Number(item.QTY_PER_KOLI) || 50,
        date_production: item.DATE_PRODUCTION || '-',
        sender: item.SENDER || 'WELLEN PRINT',
        sender_telp: item.SENDER_TELP || '021-5506999',
        visual_image: item.VISUAL_IMAGE || '',
        visual_image_2: item.VISUAL_IMAGE_2 || ''
      });
      groupedMap[groupKey].totalCombinedQty += Number(item.QTY_TOTAL) || 0;
    });

    const payloads = Object.values(groupedMap).map((group) => {
      const existing = existingMap[group.tracking_id] || {};
      const qrAddress = `${group.no_spk}_${group.tracking_id}_${group.client_pt}_${group.store_name}`;

      let combinedDetails = group.itemsList;
      if (existing.items_detail) {
        let prevDetails = [];
        if (Array.isArray(existing.items_detail)) prevDetails = existing.items_detail;
        else if (typeof existing.items_detail === 'string') {
          try { prevDetails = JSON.parse(existing.items_detail); } catch (e) { prevDetails = []; }
        }
        combinedDetails = [...prevDetails, ...group.itemsList];
      }

      const totalQtySum = combinedDetails.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

      return {
        tracking_id: group.tracking_id,
        no_spk: group.no_spk,
        client_pt: group.client_pt,
        promo_title: group.promo_title,
        store_name: group.store_name,
        recipient_name: group.recipient_name,
        total_qty: totalQtySum,
        box_code: group.box_code,
        delivery_type: 'DALAM KOTA',
        qr_address: qrAddress,
        source: 'label_sj',
        items_detail: combinedDetails,
        status_qc_label: existing.status_qc_label || 'PENDING',
        status_qc_packing: existing.status_qc_packing || 'PENDING',
        status_qc_checker: existing.status_qc_checker || 'PENDING',
        status_deliver: existing.status_deliver || 'PENDING',
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await supabase.from('packing_tracking').upsert(payloads, { onConflict: 'tracking_id' });
    if (error) {
      console.error('Error saving to Supabase packing_tracking:', error);
      alert('Gagal menyimpan data ke basis data: ' + error.message);
    }
  };

  const handleUploadHeaderLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Logo = evt.target.result;
      setHeaderLogoUrl(base64Logo);
      localStorage.setItem('wellen_header_logo', base64Logo);
      alert('Logo Kop Dokumen berhasil diunggah dan disimpan.');
    };
    reader.readAsDataURL(file);
  };

  const handleResetHeaderLogo = () => {
    if (confirm('Hapus logo kop dokumen kustom dan kembali ke teks standar?')) {
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

  const getExcelVal = (row, keys, fallback = '') => {
    if (!row) return fallback;
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null) {
        const val = String(row[k]).trim();
        if (val !== '' && val !== '-') return val;
      }
    }
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedKey = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === kNorm);
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
        const val = String(row[matchedKey]).trim();
        if (val !== '' && val !== '-') return val;
      }
    }
    return fallback;
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
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        
        if (!rawData || rawData.length === 0) {
          return alert('Berkas Excel kosong atau tidak dapat dibaca.');
        }

        const cleanedData = rawData.map((row) => {
          const rawQty = getExcelVal(row, ['QTY_TOTAL', 'Qty Total', 'qty_total', 'QTY', 'Total Qty', 'Qty', 'Jumlah'], '0');
          const rawKoli = getExcelVal(row, ['QTY_PER_KOLI', 'Qty Per Koli', 'qty_per_koli', 'ISI PER KOLI', 'Koli', 'KOLI'], '50');
          const rawDate = getExcelVal(row, ['DATE_PRODUCTION', 'Date Production', 'Tgl Produksi', 'date_production', 'Tanggal', 'Tgl']);
          
          const spkVal = getExcelVal(row, ['NO_SPK', 'No SPK', 'no_spk', 'SPK', 'Spk', 'NO SPK', 'SPK/WPP', 'SPK WPP', 'No. SPK', 'NO. SPK']);
          const deliveryAddress = getExcelVal(row, ['DELIVERY_ADDRESS', 'Delivery Address', 'delivery_address', 'Alamat Penerima', 'Store Name', 'STORE NAME', 'Nama Store', 'NAMA STORE', 'Nama Toko', 'NAMA TOKO', 'Store', 'STORE', 'Destination', 'DESTINATION', 'Cabang', 'CABANG', 'Toko', 'TOKO', 'Alamat', 'ALAMAT']);
          const projectVal = getExcelVal(row, ['PROJECT', 'Project Name', 'PROJECT NAME', 'Nama Project', 'NAMA PROJECT', 'Nama Projek', 'NAMA PROJEK', 'Projek', 'PROJEK', 'Project', 'project', 'Promo', 'PROMO', 'Nama Promo', 'NAMA PROMO', 'Title', 'TITLE', 'Item Description', 'ITEM_DESCRIPTION']);
          const noSjVal = getExcelVal(row, ['NO_SJ', 'NO SJ', 'No SJ', 'no_sj', 'BOX', 'Box', 'box', 'Box Code', 'BOX CODE', 'Surat Jalan', 'SURAT JALAN', 'No Box', 'NO_BOX']);
          const clientVal = getExcelVal(row, ['CLIENT', 'Client', 'client', 'COMPANY', 'Company', 'company', 'PT', 'Client PT', 'CLIENT PT', 'Nama Client', 'NAMA CLIENT']);
          const recipientNameVal = getExcelVal(row, ['RECIPIENT_NAME', 'Recipient Name', 'Nama Penerima', 'NAMA PENERIMA', 'Penerima', 'PENERIMA', 'Recipient', 'RECIPIENT']);
          const recipientPhoneVal = getExcelVal(row, ['RECIPIENT_PHONE', 'Recipient Phone', 'No Telp Penerima', 'Telepon Penerima', 'Phone', 'No HP']);
          const itemDescVal = getExcelVal(row, ['ITEM_DESCRIPTION', 'Item Description', 'item_description', 'Deskripsi', 'DESKRIPSI', 'Nama Barang', 'NAMA BARANG', 'Produk', 'PRODUK', 'Item', 'ITEM']);
          const brandVal = getExcelVal(row, ['BRAND', 'Brand', 'brand', 'FILE NAME', 'File Name', 'FILE_NAME', 'Kode Barang', 'KODE BARANG']);
          const mediaVal = getExcelVal(row, ['MEDIA', 'Media', 'media', 'Bahan', 'BAHAN', 'Material', 'MATERIAL']);
          const ukuranVal = getExcelVal(row, ['UKURAN', 'Ukuran', 'ukuran', 'Size', 'SIZE']);
          const poVal = getExcelVal(row, ['PO_NUMBER', 'PO Number', 'po_number', 'NO PO', 'No PO', 'PO']);
          const wppVal = getExcelVal(row, ['NO_WPP', 'No WPP', 'no_wpp', 'WPP']);

          return {
            NO_SPK: spkVal,
            PO_NUMBER: poVal,
            NO_SJ: noSjVal || `WL-${Math.floor(10 + Math.random() * 90)}`,
            CLIENT: clientVal,
            PROJECT: projectVal,
            NO_WPP: wppVal,
            BRAND: brandVal,
            RECIPIENT_NAME: recipientNameVal,
            RECIPIENT_PHONE: recipientPhoneVal,
            DELIVERY_ADDRESS: deliveryAddress,
            ITEM_DESCRIPTION: itemDescVal,
            MEDIA: mediaVal,
            UKURAN: ukuranVal,
            QTY_TOTAL: Number(String(rawQty).replace(/[^0-9]/g, '')) || 0,
            QTY_PER_KOLI: Number(String(rawKoli).replace(/[^0-9]/g, '')) || 50,
            DATE_PRODUCTION: parseExcelDate(rawDate),
            SENDER: getExcelVal(row, ['SENDER', 'Sender', 'Pengirim'], 'WELLEN PRINT'),
            SENDER_TELP: getExcelVal(row, ['SENDER_TELP', 'Sender Telp', 'Telp Pengirim'], '021-5506999'),
            VISUAL_IMAGE: getExcelVal(row, ['VISUAL_IMAGE', 'Visual Image']),
            VISUAL_IMAGE_2: getExcelVal(row, ['VISUAL_IMAGE_2', 'Visual Image 2']),
            TRACKING_ID: generateNumericTrackingId(spkVal, deliveryAddress || recipientNameVal || 'STORE')
          };
        }).filter((item) => item.NO_SPK !== '' || item.CLIENT !== '' || item.DELIVERY_ADDRESS !== '' || item.QTY_TOTAL > 0);

        setPreviousLabelData(labelData);
        const combinedData = [...cleanedData, ...labelData];
        setLabelData(combinedData);
        setSelectedRows(combinedData.map((_, i) => i));

        // Auto Save Online to Supabase
        await saveItemsToSupabase(cleanedData);

        alert(`Berhasil memvalidasi dan menyimpan data secara daring. ${cleanedData.length} baris baru ditambahkan (Total: ${combinedData.length} baris).`);
      } catch (err) { 
        alert('Gagal membaca berkas Excel: ' + err.message); 
      }
    };
    reader.readAsArrayBuffer(file); 
    e.target.value = '';
  };

  const handleUndoImport = () => {
    if (!previousLabelData) return alert('Tidak ada riwayat impor sebelumnya untuk dipulihkan.');
    if (confirm('Pulihkan data ke kondisi sebelum impor terakhir?')) {
      setLabelData(previousLabelData);
      setSelectedRows(previousLabelData.map((_, i) => i));
      setPreviousLabelData(null);
      alert('Data berhasil dipulihkan ke kondisi sebelum impor.');
    }
  };

  const handleUpdateKoliRow = async (index, newKoliVal) => {
    const val = Math.max(1, Number(newKoliVal) || 1);
    const updated = labelData.map((item, idx) => idx === index ? { ...item, QTY_PER_KOLI: val } : item);
    setLabelData(updated);
    if (updated[index]) {
      await saveItemsToSupabase([updated[index]]);
    }
  };

  const handleBatchUploadGlobal = async (e, field) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (labelData.length === 0) {
      return alert('Harap mengimpor data Excel terlebih dahulu sebelum melakukan pengunggahan gambar massal.');
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
    await saveItemsToSupabase(newLabelData);
    alert(`Berhasil mengunggah dan menyimpan ${successCount} gambar visual ke basis data.`);
    e.target.value = '';
  };

  const handleImageUploadRow = (e, index, field = 'VISUAL_IMAGE') => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64Url = evt.target.result;
      const updated = labelData.map((item, i) => (i === index ? { ...item, [field]: base64Url } : item));
      setLabelData(updated);
      if (updated[index]) {
        await saveItemsToSupabase([updated[index]]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearAllData = async () => {
    if (confirm('Apakah Anda yakin ingin menghapus seluruh data yang tersimpan di basis data?')) {
      const { error } = await supabase.from('packing_tracking').delete().gt('id', 0);
      if (!error) {
        setLabelData([]);
        setSelectedRows([]);
        alert('Seluruh data berhasil dihapus.');
      } else {
        alert('Gagal menghapus data: ' + error.message);
      }
    }
  };

  const renderHeaderLogoHtmlLabel = () => {
    if (headerLogoUrl) return `<img src="${headerLogoUrl}" style="height:110px; max-width:180px; object-fit:contain; display:block; margin:auto;">`;
    return `<div style="font-weight:900; font-size:26px; line-height:1; color:#000; text-align:center;">WELLEN<br><span style="font-size:14px; letter-spacing:5px;">PRINT</span></div>`;
  };

  const renderHeaderLogoHtmlSJ = () => {
    if (headerLogoUrl) {
      return `<div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
        <img src="${headerLogoUrl}" style="height:140px; max-width:380px; object-fit:contain; display:block;">
        <div style="font-size:10px; font-weight:bold; color:#111; line-height:1.25; margin-top:2px;">
          Jl. Raya Pasar Minggu No. 49 RT.002 RW.007 Duren Tiga, Jakarta Selatan<br>
          Telp: 021-5506999 &nbsp;|&nbsp; Email: order@wellenprint.com
        </div>
      </div>`;
    }
    return `<div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
      <div style="font-weight:900; font-size:38px; line-height:1; color:#000;">WELLEN<br><span style="font-size:16px; letter-spacing:4px;">PRINT</span></div>
      <div style="font-size:10px; font-weight:bold; color:#222; line-height:1.25; margin-top:2px;">
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
      alert('Jendela cetak diblokir oleh peramban. Mohon izinkan pop-up untuk situs ini.');
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
    if (!groupedItems || groupedItems.length === 0) return;
    await saveItemsToSupabase(groupedItems);
  };

  const handlePrintLabels = async () => {
    if (labelData.length === 0) return alert('Belum ada data yang diimpor untuk dicetak.');
    const groupedItems = groupSelectedRows();
    await syncToPackingDatabase(groupedItems);
    
    let allLabelBoxes = [];
    for (const group of groupedItems) {
      const trackingCode = group.NO_SPK || group.TRACKING_ID;
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
        const noImg = (!item.VISUAL_IMAGE && !item.VISUAL_IMAGE_2) ? `<div style="font-size:11px; opacity:0.5;">[ Tanpa Visual ]</div>` : '';

        const itemsHtml = item.itemsList.map(it => 
          `• ${it.ITEM_DESCRIPTION || it.BRAND || it.PROJECT || '-'} (${it.MEDIA || ''} ${it.UKURAN ? '- ' + it.UKURAN : ''}) [<strong>${it.QTY_TOTAL || 0} Pcs</strong>]`
        ).join('<br>');

        return `
          <div class="label-box">
            <table class="header-table"><tr>
              <td style="width: 25%; vertical-align: middle; padding: 5px 8px;">${renderHeaderLogoHtmlLabel()}</td>
              <td style="width: 53%; text-align:center; font-size:10px; line-height: 1.35; vertical-align: middle; padding: 5px 6px;">
                <strong style="font-size:14px; letter-spacing: 0.3px;">WELLEN PRINT</strong><br>
                Green Sedayu Bizpark. Jl. Daan Mogot KM.18 blok DM3 No.18, Kalideres, RT.11/RW.6, Kalideres, Jakarta Barat, 11840
              </td>
              <td style="width: 22%; text-align:center; vertical-align: middle; padding: 5px 8px;">
                ${item.qrDataUrl ? `<img src="${item.qrDataUrl}" style="width:70px; height:72px; display:block; margin:auto;">` : ''}
                <div style="font-size: 9.5px; font-weight: 800; margin-top: 2px;">${item.displayTrackingId}</div>
              </td>
            </tr></table>
            
            <div class="content-grid">
              <div class="grid-box">
                <table class="align-table">
                  <tr><td class="label-col">SENDER</td><td class="sep-col">:</td><td class="val-col"><strong style="font-size:12.5px; color:#000;">${item.SENDER || 'WELLEN PRINT'}</strong></td></tr>
                  <tr><td class="label-col">NO. TELP</td><td class="sep-col">:</td><td class="val-col" style="font-size:12px; font-weight:700;">${item.SENDER_TELP || '021-5506999'}</td></tr>
                </table>
              </div>
              <div class="grid-box">
                <table class="align-table">
                  <tr><td class="label-col">CLIENT</td><td class="sep-col">:</td><td class="val-col"><strong style="font-size:12.5px; color:#000;">${item.CLIENT || '-'}</strong></td></tr>
                  <tr><td class="label-col">Delivery Address</td><td class="sep-col">:</td><td class="val-col" style="font-size:11.5px; font-weight:600; line-height:1.35;">${item.DELIVERY_ADDRESS || '-'}</td></tr>
                  <tr><td class="label-col">Recipient Name</td><td class="sep-col">:</td><td class="val-col"><strong style="font-size:12.5px; color:#000;">${item.RECIPIENT_NAME || '-'}</strong></td></tr>
                  <tr><td class="label-col">Recipient Phone</td><td class="sep-col">:</td><td class="val-col" style="font-size:11.5px; font-weight:600;">${item.RECIPIENT_PHONE || '-'}</td></tr>
                </table>
              </div>
              <div class="grid-box">
                <table class="align-table">
                  <tr><td class="label-col">PROJECT</td><td class="sep-col">:</td><td class="val-col"><strong style="font-size:12.5px; color:#000;">${item.PROJECT || '-'}</strong></td></tr>
                  <tr><td class="label-col">PO NUMBER</td><td class="sep-col">:</td><td class="val-col" style="font-size:11.5px; font-weight:700;">${item.PO_NUMBER || '-'}</td></tr>
                  <tr><td class="label-col">NO. WPP</td><td class="sep-col">:</td><td class="val-col" style="font-size:11.5px; font-weight:700;">${item.NO_WPP || '-'}</td></tr>
                  <tr><td class="label-col">NO. SPK</td><td class="sep-col">:</td><td class="val-col" style="font-size:12px; font-weight:800; color:#000;">${item.NO_SPK || '-'}</td></tr>
                  <tr><td class="label-col" style="vertical-align:top; padding: 2px 0;">ITEM LIST</td><td class="sep-col" style="vertical-align:top; padding: 2px 0;">:</td><td class="val-col" style="font-size:10px; line-height:1.25; font-weight:600; padding: 2px 0;">${itemsHtml}</td></tr>
                  <tr><td class="label-col">QTY KOLI INI</td><td class="sep-col">:</td><td class="val-col"><strong style="font-size:13.5px; font-weight:900; color:#1d4ed8;">${item.currentQty} PCS (Koli ${item.currentKoli}/${item.totalKoli})</strong></td></tr>
                  <tr><td class="label-col">DATE PRODUCTION</td><td class="sep-col">:</td><td class="val-col" style="font-size:11.5px; font-weight:700;">${item.DATE_PRODUCTION || '-'}</td></tr>
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

    const fullHtml = `<!DOCTYPE html><html><head><title>Cetak & Unduh PDF Label Kolian - Wellen Print</title><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f1f5f9; } 
      .action-bar { position: fixed; top: 0; left: 0; width: 100%; background: #ffffff; color: #0f172a; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; border-bottom: 1px solid #e2e8f0; box-sizing: border-box; font-size: 12px; }
      .action-bar button { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 8px 14px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 12px; }
      .action-bar button:hover { background: #dbeafe; }
      .page-wrapper { margin-top: 65px; display: flex; flex-direction: column; align-items: center; gap: 0px; }
      .label-page { width: 210mm; height: 297mm; max-height: 297mm; padding: 2mm 8mm; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; } 
      .label-box { border: 2px solid #000; width: 100%; height: 143mm; max-height: 143mm; display: flex; flex-direction: column; box-sizing: border-box; background: #fff; overflow: hidden; }
      .cut-guide { width: 100%; border-top: 1px dashed #444; margin: 0.5mm 0; }
      .header-table { width: 100%; border-bottom: 2px solid #000; border-collapse: collapse; } 
      .header-table td { border: none; vertical-align: middle; } 
      .content-grid { display: grid; grid-template-columns: 1fr 1fr; flex-grow: 1; } 
      .grid-box { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 8px; font-size: 11.5px; line-height: 1.35; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; }
      .grid-box:nth-child(2n) { border-right: none; } 
      .grid-box:nth-child(3), .grid-box:nth-child(4) { border-bottom: none; } 
      .grid-box:nth-child(3) { justify-content: flex-start; padding-top: 6px; padding-bottom: 6px; }
      .align-table { width: 100%; border-collapse: collapse; }
      .align-table td { border: none; padding: 1.5px 0; vertical-align: middle; font-size: 11.5px; }
      .label-col { width: 34%; font-weight: 800; color: #000; }
      .sep-col { width: 4%; text-align: center; font-weight: 800; }
      .val-col { width: 62%; color: #000; word-break: break-word; }
      .visual-box { display: flex; flex-direction: column; justify-content: space-between; align-items: center; text-align: center; padding: 6px !important; }
      .visual-title { font-size: 11.5px; font-weight: 800; width: 100%; text-align: center; margin-bottom: 2px; letter-spacing: 0.3px; }
      .koli-title { font-size: 15px; font-weight: 900; margin: 2px 0; color: #000; }
      .visual-img-container { width: 100%; flex-grow: 1; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; overflow: hidden; }
      .preview-img { max-width: 98%; max-height: 95px; object-fit: contain; display: block; border-radius: 4px; }
      @media print { 
        body { background: #fff; margin: 0; padding: 0; }
        .action-bar { display: none; }
        .page-wrapper { margin-top: 0; gap: 0; }
        .label-page { box-shadow: none; margin-bottom: 0; width: 210mm; height: 297mm; max-height: 297mm; padding: 2mm 8mm; page-break-after: always; break-after: page; page-break-inside: avoid; overflow: hidden; } 
        @page { size: A4 portrait; margin: 0mm; }
      }
    </style></head><body>
      <div class="action-bar">
        <span><b>Pengaturan Cetak & Unduh Label Kolian</b></span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="window.print()">Cetak / Pengaturan Printer</button>
          <button onclick="window.print()" style="background:#ecfdf5; color:#047857; border-color:#a7f3d0;">Simpan sebagai PDF</button>
        </div>
      </div>
      <div class="page-wrapper">${pagesHtml}</div>
    </body></html>`;

    openPrintWindow(fullHtml);
  };

  const handlePrintSuratJalan = async () => {
    if (labelData.length === 0) return alert('Belum ada data yang diimpor untuk dicetak.');
    const groupedItems = groupSelectedRows();
    await syncToPackingDatabase(groupedItems);

    const pagesHtml = groupedItems.map((group) => {
      let grandTotal = 0;
      const rowsHtml = group.itemsList.map((it, idx) => {
        const qty = Number(it.QTY_TOTAL || 0);
        grandTotal += qty;
        
        // Menggabungkan PROJECT dan MEDIA sebagai Nama Barang pada Surat Jalan secara otomatis
        const namaBarangVal = it.PROJECT 
          ? `${it.PROJECT}${it.MEDIA ? ' - ' + it.MEDIA : ''}` 
          : (it.ITEM_DESCRIPTION || '-');

        return sjFormatType === 'modern' ? `
          <tr>
            <td style="text-align: center; width: 8%; font-size: 12px; font-weight: bold;">${idx + 1}</td>
            <td style="width: 38%; font-size: 12px; font-weight: bold;">${namaBarangVal}</td>
            <td style="width: 34%; font-size: 11.5px; font-weight: bold;">${it.MEDIA || '-'}<br><span style="font-size: 11px;">Ukuran: ${it.UKURAN || '-'}</span></td>
            <td style="text-align: right; padding-right: 10px; width: 20%; font-size: 13px; font-weight: bold;">${qty.toLocaleString()}</td>
          </tr>
        ` : `
          <tr>
            <td style="text-align: center; width: 8%; font-size: 12px; font-weight: bold;">${idx + 1}</td>
            <td style="width: 55%; font-size: 12px; font-weight: bold;">${namaBarangVal}</td>
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
                <div class="sig-box font-bold">DIBUAT OLEH<br><br><span style="font-size:12px; font-weight:bold;">Nining</span></div>
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
                <div class="sig-col font-bold">DIBUAT OLEH<br><br><span style="font-size:12px; font-weight:bold;">Nining</span></div>
                <div class="sig-col font-bold">DIKIRIM OLEH</div>
                <div class="sig-col font-bold">DITERIMA OLEH</div>
              </div>
            </div>
          </div>
        `;
      }
    }).join('');

    const fullSjHtml = `<!DOCTYPE html><html><head><title>Cetak & Unduh PDF Surat Jalan - Wellen Print</title><style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f1f5f9; color: #000; } 
      .action-bar { position: fixed; top: 0; left: 0; width: 100%; background: #ffffff; color: #0f172a; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; border-bottom: 1px solid #e2e8f0; box-sizing: border-box; font-size: 12px; }
      .action-bar button { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 8px 14px; font-weight: 700; border-radius: 8px; cursor: pointer; font-size: 12px; }
      .action-bar button:hover { background: #dbeafe; }
      .page-wrapper { margin-top: 65px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
      
      .sj-page { width: 210mm; height: 140mm; padding: 5mm 7mm; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 20px; font-size: 11px; } 
      
      .font-bold { font-weight: bold; } .font-normal { font-weight: normal; } .text-center { text-align: center; } 
      .sj-top-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; } 
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
      .sig-box { flex: 1; border-right: 1.5px solid #000; padding-top: 14px; padding-bottom: 6px; font-size: 11px; } 
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
        <span><b>Pratinjau Cetak Surat Jalan</b></span>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button onclick="window.print()">Cetak / Pengaturan Printer</button>
          <button onclick="window.print()" style="background:#ecfdf5; color:#047857; border-color:#a7f3d0;">Simpan sebagai PDF</button>
        </div>
      </div>
      <div class="page-wrapper">${pagesHtml}</div>
    </body></html>`;

    openPrintWindow(fullSjHtml);
  };

  const filteredData = labelData
    .map((item, originalIndex) => ({ ...item, _origIdx: originalIndex }))
    .filter((row) => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      return (
        (row.NO_SPK && String(row.NO_SPK).toLowerCase().includes(q)) ||
        (row.CLIENT && String(row.CLIENT).toLowerCase().includes(q)) ||
        (row.BRAND && String(row.BRAND).toLowerCase().includes(q)) ||
        (row.RECIPIENT_NAME && String(row.RECIPIENT_NAME).toLowerCase().includes(q)) ||
        (row.DELIVERY_ADDRESS && String(row.DELIVERY_ADDRESS).toLowerCase().includes(q)) ||
        (row.ITEM_DESCRIPTION && String(row.ITEM_DESCRIPTION).toLowerCase().includes(q)) ||
        (row.PROJECT && String(row.PROJECT).toLowerCase().includes(q)) ||
        (row.NO_SJ && String(row.NO_SJ).toLowerCase().includes(q)) ||
        (row.PO_NUMBER && String(row.PO_NUMBER).toLowerCase().includes(q)) ||
        (row.NO_WPP && String(row.NO_WPP).toLowerCase().includes(q)) ||
        (row.MEDIA && String(row.MEDIA).toLowerCase().includes(q)) ||
        (row.UKURAN && String(row.UKURAN).toLowerCase().includes(q))
      );
    });

  return (
    <div className="space-y-4">
      {/* Header Logo Card */}
      <div className={`p-4 rounded-2xl border shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
        <div className="flex items-center gap-3">
          <div className="w-20 h-14 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 flex items-center justify-center overflow-hidden p-1">
            {headerLogoUrl ? <img src={headerLogoUrl} alt="Logo Kop" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] font-bold text-slate-400 text-center">Tanpa Logo</span>}
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Logo Kop Dokumen (Label & Surat Jalan)
            </h4>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {headerLogoUrl ? 'Logo kop kustom aktif dan tersimpan di memori perangkat' : 'Menggunakan identitas teks standar "WELLEN PRINT"'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all active:scale-95 shadow-2xs flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Unggah Logo Kop <input type="file" accept="image/*" onChange={handleUploadHeaderLogo} className="hidden" />
          </label>
          {headerLogoUrl && (
            <button onClick={handleResetHeaderLogo} className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Atur Ulang
            </button>
          )}
        </div>
      </div>

      {/* Action Toolbar Card */}
      <div className={`p-4 rounded-2xl border shadow-2xs flex flex-col xl:flex-row items-center justify-between gap-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 transition-all shadow-2xs flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Impor Data Excel (Label & SJ) <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" />
          </label>
          <button onClick={handleDownloadTemplate} className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Unduh Templat Excel
          </button>
          
          <div className="flex items-center gap-1.5 ml-1 bg-slate-100/80 dark:bg-neutral-800 p-1 rounded-xl border border-slate-200/80 dark:border-neutral-700">
            <span className="text-[11px] font-semibold px-1.5 text-slate-500 dark:text-slate-400">Format SJ:</span>
            <button onClick={() => setSjFormatType('modern')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${sjFormatType === 'modern' ? 'bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Modern</button>
            <button onClick={() => setSjFormatType('classic')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${sjFormatType === 'classic' ? 'bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Klasik</button>
          </div>

          <label className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all flex items-center gap-1.5 shadow-2xs">
            <Upload className="w-3.5 h-3.5" /> Unggah Massal Visual 1 (Kiri) <input type="file" accept="image/*" multiple onChange={(e) => handleBatchUploadGlobal(e, 'VISUAL_IMAGE')} className="hidden" />
          </label>
          <label className="px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all flex items-center gap-1.5 shadow-2xs">
            <Upload className="w-3.5 h-3.5" /> Unggah Massal Visual 2 (Kanan) <input type="file" accept="image/*" multiple onChange={(e) => handleBatchUploadGlobal(e, 'VISUAL_IMAGE_2')} className="hidden" />
          </label>
          {previousLabelData && (
            <button onClick={handleUndoImport} className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" /> Batalkan Impor Terakhir
            </button>
          )}
          {labelData.length > 0 && (
            <button onClick={handleClearAllData} className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Hapus Semua Data
            </button>
          )}
        </div>

        {/* PRINT BUTTONS: SOFT TONAL PASTEL SURFACES */}
        <div className="flex items-center gap-2.5">
          <button onClick={handlePrintSuratJalan} className="h-10 px-4 rounded-xl font-semibold text-xs bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95">
            <FileText className="w-4 h-4" /> Cetak Surat Jalan
          </button>
          <button onClick={handlePrintLabels} className="h-10 px-4 rounded-xl font-semibold text-xs bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95">
            <Tag className="w-4 h-4" /> Cetak Label Kolian
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari Nomor SPK, Klien, Merek, Penerima, Alamat, Deskripsi, Nomor PO/SJ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-9 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100 placeholder-neutral-500' : 'bg-slate-50/80 border-slate-200/90 text-slate-800 placeholder-slate-400 focus:bg-white'}`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
              title="Hapus pencarian"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold whitespace-nowrap px-1 flex items-center gap-2">
          {searchTerm ? (
            <span>Hasil Pencarian: <strong className="text-blue-600 dark:text-blue-400 font-bold">{filteredData.length}</strong> dari {labelData.length} SPK</span>
          ) : (
            <span>Total: <strong className="text-slate-900 dark:text-slate-100 font-bold">{labelData.length}</strong> SPK</span>
          )}
          {selectedRows.length > 0 && (
            <span className="bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 px-2.5 py-1 rounded-lg font-bold">
              {selectedRows.length} Terpilih
            </span>
          )}
        </div>
      </div>

      {/* ENTERPRISE GRID TABLE */}
      <div className={`max-h-[680px] overflow-y-auto overflow-x-auto relative rounded-2xl border shadow-2xs custom-scrollbar ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200/80'}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-20 border-b font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-neutral-800/95 border-neutral-700 text-slate-300' : 'bg-slate-50/95 border-slate-200/80 text-slate-500'}`}>
            <tr>
              <th className="p-3.5 text-center w-10">
                <input
                  type="checkbox"
                  checked={filteredData.length > 0 && filteredData.every(r => selectedRows.includes(r._origIdx))}
                  onChange={() => {
                    const allFilteredSelected = filteredData.length > 0 && filteredData.every(r => selectedRows.includes(r._origIdx));
                    if (allFilteredSelected) {
                      const filteredSet = new Set(filteredData.map(r => r._origIdx));
                      setSelectedRows(prev => prev.filter(i => !filteredSet.has(i)));
                    } else {
                      const filteredIndices = filteredData.map(r => r._origIdx);
                      setSelectedRows(prev => Array.from(new Set([...prev, ...filteredIndices])));
                    }
                  }}
                  className="cursor-pointer accent-blue-600 w-4 h-4"
                />
              </th>
              <th className="p-3.5">NOMOR SPK</th>
              <th className="p-3.5">KLIEN & MEREK</th>
              <th className="p-3.5">PENERIMA & ALAMAT TUJUAN</th>
              <th className="p-3.5">SPESIFIKASI / MEDIA / UKURAN</th>
              <th className="p-3.5 text-center">TOTAL KUANTITAS</th>
              <th className="p-3.5 text-center">ISI PER KOLIAN</th>
              <th className="p-3.5 text-center">VISUAL PRODUK</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-slate-100'}`}>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-8 text-center text-slate-400 dark:text-neutral-500 font-medium">
                  {searchTerm ? (
                    <span>Tidak ditemukan data yang sesuai dengan kata kunci pencarian "<strong>{searchTerm}</strong>".</span>
                  ) : (
                    <span>Tabel masih kosong. Silakan klik tombol <strong>"Unduh Templat Excel"</strong> atau impor berkas data alokasi di atas.</span>
                  )}
                </td>
              </tr>
            ) : (
              filteredData.map((row) => {
                const idx = row._origIdx;
                const total = Number(row.QTY_TOTAL || 0); 
                const koli = Number(row.QTY_PER_KOLI || 50); 
                const totalKoliCalc = Math.max(1, Math.ceil(total / koli));
                const isChecked = selectedRows.includes(idx);

                return (
                  <tr key={idx} className={`transition-colors ${isChecked ? (isDarkMode ? 'bg-blue-950/25 hover:bg-blue-950/35' : 'bg-blue-50/50 hover:bg-blue-50/80') : (isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-slate-50/80')}`}>
                    <td className="p-3 align-middle text-center">
                      <input type="checkbox" checked={isChecked} onChange={() => setSelectedRows(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} className="cursor-pointer accent-blue-600 w-4 h-4" />
                    </td>
                    <td className="p-3 align-middle min-w-[150px]">
                      {(() => {
                        const raw = String(row.NO_SPK || '-').trim();
                        const parts = raw.split('/');
                        const mainSpk = parts[0]?.trim() || '-';
                        const subSpk = parts.slice(1).join('/').trim();
                        return (
                          <div className="flex flex-col">
                            <span className="font-mono text-slate-900 dark:text-slate-100 font-extrabold text-xs sm:text-sm whitespace-nowrap">
                              {mainSpk}
                            </span>
                            {subSpk && (
                              <span className="font-mono text-slate-400 font-bold text-[10px] whitespace-nowrap">
                                {subSpk}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3 align-middle max-w-[220px]">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate" title={row.CLIENT}>{row.CLIENT || '-'}</div>
                      <div className="text-[10px] font-mono text-slate-400 font-medium truncate" title={row.BRAND}>{row.BRAND || '-'}</div>
                    </td>
                    <td className="p-3 align-middle max-w-[260px]">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">{row.RECIPIENT_NAME || '-'} {row.RECIPIENT_PHONE ? `(${row.RECIPIENT_PHONE})` : ''}</div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate" title={row.DELIVERY_ADDRESS}>{row.DELIVERY_ADDRESS || '-'}</div>
                    </td>
                    <td className="p-3 align-middle max-w-[200px]">
                      <div className="font-medium text-slate-700 dark:text-slate-300 text-xs truncate" title={row.ITEM_DESCRIPTION}>{row.ITEM_DESCRIPTION || '-'}</div>
                      <div className="text-[10px] text-slate-400 font-medium truncate">{row.MEDIA || '-'} {row.UKURAN ? `(${row.UKURAN})` : ''}</div>
                    </td>
                    <td className="p-3 align-middle text-center font-extrabold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">{total.toLocaleString()} Pcs</td>
                    <td className="p-3 align-middle text-center">
                      <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <input 
                          type="number" 
                          value={row.QTY_PER_KOLI || 50} 
                          onChange={(e) => handleUpdateKoliRow(idx, e.target.value)} 
                          className={`w-16 px-2 py-1 rounded-lg border text-xs font-bold text-center ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                        />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Pcs (<strong className="text-slate-900 dark:text-slate-100">{totalKoliCalc} Koli</strong>)</span>
                      </div>
                    </td>
                    <td className="p-3 align-middle text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400">Vis 1:</span>
                          {row.VISUAL_IMAGE ? <img src={row.VISUAL_IMAGE} alt="1" onClick={() => onOpenImageModal(row.VISUAL_IMAGE, `Visual 1`, row.DELIVERY_ADDRESS, row.PROJECT, row.NO_SPK)} className="w-8 h-6 object-contain border border-slate-300 dark:border-neutral-700 rounded-md bg-white cursor-pointer hover:scale-110 transition-transform shadow-2xs" /> : <span className="text-[10px] text-slate-400 font-medium">-</span>}
                          <label className="cursor-pointer px-2 py-0.5 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-md text-[10px] font-semibold transition-all shadow-2xs">
                            Unggah <input type="file" accept="image/*" onChange={(e) => handleImageUploadRow(e, idx, 'VISUAL_IMAGE')} className="hidden" />
                          </label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400">Vis 2:</span>
                          {row.VISUAL_IMAGE_2 ? <img src={row.VISUAL_IMAGE_2} alt="2" onClick={() => onOpenImageModal(row.VISUAL_IMAGE_2, `Visual 2`, row.DELIVERY_ADDRESS, row.PROJECT, row.NO_SPK)} className="w-8 h-6 object-contain border border-slate-300 dark:border-neutral-700 rounded-md bg-white cursor-pointer hover:scale-110 transition-transform shadow-2xs" /> : <span className="text-[10px] text-slate-400 font-medium">-</span>}
                          <label className="cursor-pointer px-2 py-0.5 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-md text-[10px] font-semibold transition-all shadow-2xs">
                            Unggah <input type="file" accept="image/*" onChange={(e) => handleImageUploadRow(e, idx, 'VISUAL_IMAGE_2')} className="hidden" />
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