import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../supabaseClient';

export default function PackingPanel({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState(null);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [isSuratJalanPrinting, setIsSuratJalanPrinting] = useState(false);
  const [suratJalanGroup, setSuratJalanGroup] = useState(null);

  // Filter & Search States
  const [filterDelivery, setFilterDelivery] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // In-App Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTargetStage, setScannerTargetStage] = useState('status_qc_packing');
  const [lastScanFeedback, setLastScanFeedback] = useState(null);

  // Google Sheets Modal State
  const [isGSheetModalOpen, setIsGSheetModalOpen] = useState(false);
  const [gSheetUrlInput, setGSheetUrlInput] = useState('');

  // Custom Sheet Selector States
  const [isSheetSelectorOpen, setIsSheetSelectorOpen] = useState(false);
  const [pendingWorkbook, setPendingWorkbook] = useState(null);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);

  // Modal Custom Image Override
  const [editingRowItem, setEditingRowItem] = useState(null);

  const stages = [
    { id: 'status_qc_label', label: 'QC LABEL', staff: 'Bagian: Staff Label', color: 'bg-blue-500' },
    { id: 'status_qc_packing', label: 'QC PACKING', staff: 'Bagian: Staff Paking', color: 'bg-emerald-500' },
    { id: 'status_qc_checker', label: 'QC CHECKER', staff: 'Bagian: Staff Checker', color: 'bg-amber-500' },
    { id: 'status_deliver', label: 'DELIVER', staff: 'Bagian: Staff Deliver', color: 'bg-purple-500' }
  ];

  const parseItems = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  useEffect(() => {
    fetchPackingData();

    const channel = supabase
      .channel('packing_tracking_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packing_tracking' },
        () => {
          fetchPackingData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let qrScanner = null;
    if (isScannerOpen) {
      qrScanner = new Html5QrcodeScanner(
        "qr-reader-container",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      qrScanner.render(
        async (decodedText) => {
          handleQrScanSuccess(decodedText);
        },
        (error) => {}
      );
    }

    return () => {
      if (qrScanner) {
        qrScanner.clear().catch(() => {});
      }
    };
  }, [isScannerOpen, scannerTargetStage, packingList]);

  const fetchPackingData = async () => {
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      const normalizedData = data.map(item => ({
        ...item,
        items_detail: parseItems(item.items_detail)
      }));
      setPackingList(normalizedData);
    }
  };

  const cleanKey = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const extractCoreCode = (str) => {
    if (!str) return '';
    const afterDot = str.includes('.') ? str.split('.').pop() : str;
    return cleanKey(afterDot);
  };

  // Kompresi File Gambar menjadi JPEG Blob Tajam
  const compressToBlob = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob || file);
          }, 'image/jpeg', 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleQrScanSuccess = async (decodedText) => {
    const cleanScanned = cleanKey(decodedText);
    const targetItem = packingList.find(
      (item) =>
        cleanKey(item.tracking_id) === cleanScanned ||
        cleanKey(item.qr_address) === cleanScanned ||
        cleanScanned.includes(cleanKey(item.box_code))
    );

    if (!targetItem) {
      setLastScanFeedback({ success: false, text: `⚠️ QR (${decodedText}) tidak terdaftar!` });
      return;
    }

    if (targetItem[scannerTargetStage] === 'DONE') {
      setLastScanFeedback({ success: true, text: `ℹ️ ${targetItem.box_code} (${targetItem.store_name}) sudah berstatus DONE sebelumnya.` });
      return;
    }

    const { error } = await supabase
      .from('packing_tracking')
      .update({
        [scannerTargetStage]: 'DONE',
        updated_at: new Date().toISOString()
      })
      .eq('id', targetItem.id);

    if (!error) {
      setLastScanFeedback({
        success: true,
        text: `✅ ${targetItem.box_code} - ${targetItem.store_name} BERHASIL diverifikasi!`
      });
      fetchPackingData();
    }
  };

  const handleToggleStatus = async (id, fieldName, currentValue) => {
    const nextValue = currentValue === 'DONE' ? 'PENDING' : 'DONE';
    setPackingList((prev) => prev.map((item) => (item.id === id ? { ...item, [fieldName]: nextValue } : item)));

    const { error } = await supabase
      .from('packing_tracking')
      .update({ [fieldName]: nextValue, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      alert('❌ Gagal memperbarui status: ' + error.message);
      fetchPackingData();
    }
  };

  const openSheetSelectorModal = (wb) => {
    const allSheets = wb.SheetNames || [];
    const defaultSelected = allSheets.filter(
      (s) => !s.toUpperCase().includes('LABEL') && !s.toUpperCase().includes('DATA STORE')
    );

    setPendingWorkbook(wb);
    setAvailableSheets(allSheets);
    setSelectedSheets(defaultSelected.length > 0 ? defaultSelected : allSheets);
    setIsSheetSelectorOpen(true);
  };

  const handleExecuteSelectedSheetsImport = async () => {
    if (!pendingWorkbook || selectedSheets.length === 0) {
      return alert('⚠️ Silakan centang minimal 1 sheet untuk di-import.');
    }

    setIsImporting(true);
    try {
      let parsedRecords = [];

      selectedSheets.forEach((sheetName) => {
        const ws = pendingWorkbook.Sheets[sheetName];
        if (!ws) return;

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!data || data.length < 7) return;

        const rowCodes = data[1] || [];
        const rowDescs = data[2] || [];
        const rowMaterials = data[3] || [];
        const rowSizes = data[4] || [];

        let catalogItems = [];
        for (let colIdx = 12; colIdx < rowCodes.length; colIdx++) {
          if (rowCodes[colIdx]) {
            catalogItems.push({
              colIndex: colIdx,
              code: String(rowCodes[colIdx]).trim(),
              desc: rowDescs[colIdx] ? String(rowDescs[colIdx]).trim() : 'LAMINATE',
              material: rowMaterials[colIdx] ? String(rowMaterials[colIdx]).trim() : 'PVC',
              size: rowSizes[colIdx] ? String(rowSizes[colIdx]).trim() : '-'
            });
          }
        }

        for (let r = 6; r < data.length; r++) {
          const row = data[r];
          if (!row || !row[1]) continue;

          const storeNo = row[1];
          const prCode = row[2] || '';
          const boxCode = row[3] || `B${r - 5}`;
          const storeId = row[4] || '';
          const clientPt = row[5] || 'CV. MAJU MAKMUR RETALINDO';
          const storeName = row[6] || '';
          const noPo = row[7] || '';
          const spkWpp = row[8] || '';
          const deliveryType = row[9] || 'DALAM KOTA';
          const qrAddress = row[10] || `${prCode}_${storeId}_${storeName}`;

          let storeItems = [];
          let totalQty = 0;

          catalogItems.forEach((cat) => {
            const qtyVal = Number(row[cat.colIndex]) || 0;
            if (qtyVal > 0) {
              storeItems.push({
                code: cat.code,
                desc: cat.desc,
                material: cat.material,
                size: cat.size,
                qty: qtyVal,
                unit: 'Pcs',
                image_url: ''
              });
              totalQty += qtyVal;
            }
          });

          const trackingId = `${prCode || 'PR'}-${boxCode}-${storeId || storeNo}`;

          parsedRecords.push({
            tracking_id: trackingId,
            no_spk: spkWpp.split('/')[0]?.trim() || spkWpp,
            client_pt: clientPt,
            promo_title: noPo,
            store_name: storeName,
            recipient_name: `Store #${storeNo} (${storeId})`,
            total_qty: totalQty,
            box_code: boxCode,
            area_code: 'Q1',
            delivery_type: deliveryType,
            qr_address: qrAddress,
            items_detail: storeItems,
            status_qc_label: 'DONE',
            status_qc_packing: 'PENDING',
            status_qc_checker: 'PENDING',
            status_deliver: 'PENDING',
            updated_at: new Date().toISOString()
          });
        }
      });

      if (parsedRecords.length === 0) {
        throw new Error('Tidak ada data matriks toko yang terbaca.');
      }

      const { error } = await supabase
        .from('packing_tracking')
        .upsert(parsedRecords, { onConflict: 'tracking_id' });

      if (error) throw error;

      alert(`✅ Berhasil mengimport ${parsedRecords.length} data box toko!`);
      setIsSheetSelectorOpen(false);
      setPendingWorkbook(null);
      fetchPackingData();
    } catch (err) {
      alert('❌ Gagal Import Sheet: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        openSheetSelectorModal(wb);
      } catch (err) {
        alert('❌ Gagal membaca file Excel: ' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleFetchGoogleSheet = async () => {
    if (!gSheetUrlInput.trim()) {
      return alert('⚠️ Silakan masukkan URL Google Sheets terlebih dahulu.');
    }

    setIsImporting(true);
    try {
      const match = gSheetUrlInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match || !match[1]) {
        throw new Error('URL Google Spreadsheet tidak valid.');
      }
      const sheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

      const res = await fetch(exportUrl);
      if (!res.ok) {
        throw new Error('Gagal mengakses Google Sheets. Pastikan akses disetel ke "Anyone with the link can view".');
      }

      const arrayBuffer = await res.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      
      setIsGSheetModalOpen(false);
      setGSheetUrlInput('');
      openSheetSelectorModal(wb);
    } catch (err) {
      alert('❌ Gagal mengambil Google Sheets: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Upload Foto Desain ke Supabase Storage (URL Asli CDN, Anti-Gagal & Anti-Rusak)
  const handleBulkUploadDesignImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    if (packingList.length === 0) {
      alert('⚠️ Silakan Import Data Toko terlebih dahulu!');
      e.target.value = '';
      return;
    }

    setIsUploadingImages(true);
    try {
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      // 1. Upload semua file ke Supabase Storage Bucket 'surat-jalan'
      const imageList = await Promise.all(
        files.map(async (file, idx) => {
          const rawFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const normalizedKey = cleanKey(rawFileName);
          const coreKey = extractCoreCode(rawFileName);
          const blob = await compressToBlob(file);

          const uniqueName = `desain_${normalizedKey}_${Date.now()}_${idx}.jpg`;
          
          const { error: uploadError } = await supabase.storage
            .from('surat-jalan')
            .upload(uniqueName, blob, { contentType: 'image/jpeg', upsert: true });

          let publicUrl = '';
          if (!uploadError) {
            const { data } = supabase.storage.from('surat-jalan').getPublicUrl(uniqueName);
            publicUrl = data?.publicUrl || '';
          }

          return { 
            index: idx, 
            fileName: rawFileName,
            rawKey: normalizedKey, 
            coreKey: coreKey, 
            url: publicUrl 
          };
        })
      );

      let matchCount = 0;
      const updatedRows = [];

      const newPackingList = packingList.map((row) => {
        const details = parseItems(row.items_detail);
        if (details.length === 0) return row;

        const newDetails = details.map((item, itemIdx) => {
          const itemCodeClean = cleanKey(item.code);
          const itemCore = extractCoreCode(item.code);

          // 1. Cek Exact Match
          let matched = imageList.find((img) => img.rawKey === itemCodeClean || itemCodeClean.includes(img.rawKey));
          // 2. Cek Core Match
          if (!matched) {
            matched = imageList.find((img) => img.coreKey === itemCore || itemCodeClean.includes(img.coreKey));
          }
          // 3. Fallback Urutan Posisi Slot (File 1 -> Baris 1, File 2 -> Baris 2)
          if (!matched && imageList[itemIdx]) {
            matched = imageList[itemIdx];
          }

          if (matched && matched.url) {
            return { ...item, image_url: matched.url };
          }
          return item;
        });

        matchCount++;
        const updatedRow = { ...row, items_detail: newDetails, updated_at: new Date().toISOString() };
        updatedRows.push(updatedRow);
        return updatedRow;
      });

      setPackingList(newPackingList);

      if (updatedRows.length > 0) {
        await Promise.all(
          updatedRows.map((r) =>
            supabase
              .from('packing_tracking')
              .update({ items_detail: r.items_detail, updated_at: r.updated_at })
              .eq('id', r.id)
          )
        );
      }

      alert(`✅ Berhasil! ${files.length} foto desain telah diunggah ke Storage dan aktif di ${matchCount} box toko.`);
    } catch (err) {
      alert('❌ Gagal upload foto desain: ' + err.message);
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleSingleImageOverride = async (rowId, itemIndex, file) => {
    if (!file) return;
    try {
      const blob = await compressToBlob(file);
      const uniqueName = `desain_single_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('surat-jalan')
        .upload(uniqueName, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(uniqueName);
      const publicUrl = data?.publicUrl || '';

      const targetRow = packingList.find((p) => p.id === rowId);
      if (!targetRow) return;

      const currentDetails = parseItems(targetRow.items_detail);
      const updatedItems = [...currentDetails];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], image_url: publicUrl };

      setPackingList((prev) =>
        prev.map((p) => (p.id === rowId ? { ...p, items_detail: updatedItems } : p))
      );

      const { error } = await supabase
        .from('packing_tracking')
        .update({ items_detail: updatedItems, updated_at: new Date().toISOString() })
        .eq('id', rowId);

      if (error) throw error;

      alert('✅ Foto item berhasil diperbarui!');
      if (editingRowItem) {
        setEditingRowItem((prev) => ({ ...prev, items_detail: updatedItems }));
      }
    } catch (err) {
      alert('❌ Gagal mengubah gambar: ' + err.message);
    }
  };

  const triggerSafePrint = () => {
    setTimeout(() => {
      window.print();
    }, 600);
  };

  const handlePrintLabel = (item) => {
    setIsSuratJalanPrinting(false);
    setIsBatchPrinting(false);

    const freshItem = packingList.find((p) => p.id === item.id) || item;
    setSelectedLabelItem({
      ...freshItem,
      items_detail: parseItems(freshItem.items_detail)
    });
    triggerSafePrint();
  };

  const handleBatchPrintAll = () => {
    if (filteredList.length === 0) return alert('⚠️ Tidak ada data label yang dapat dicetak.');
    setIsSuratJalanPrinting(false);
    setIsBatchPrinting(true);
    setSelectedLabelItem(null);
    triggerSafePrint();
  };

  const handlePrintSuratJalan = (itemsToPrint) => {
    setIsBatchPrinting(false);
    setSelectedLabelItem(null);
    setIsSuratJalanPrinting(true);
    setSuratJalanGroup(itemsToPrint);
    triggerSafePrint();
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.7);
        };
      };
    });
  };

  const handleCameraCapture = async (e, rowId, trackingId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(rowId);
    try {
      const compressedBlob = await compressImage(file);
      const cleanTrackingId = trackingId ? String(trackingId).replace(/[^a-zA-Z0-9-_]/g, '_') : 'item';
      const fileName = `bukti_paking_${cleanTrackingId}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('surat-jalan')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('packing_tracking')
        .update({ 
          bukti_paking_url: urlData.publicUrl, 
          status_qc_packing: 'DONE',
          updated_at: new Date().toISOString() 
        })
        .eq('id', rowId);

      if (updateError) throw updateError;

      alert('✅ Bukti paking berhasil diunggah!');
      fetchPackingData();
    } catch (err) {
      alert('❌ Gagal upload foto: ' + err.message);
    }
    setUploadingId(null);
  };

  const handleDownloadPackingReport = async () => {
    try {
      if (packingList.length === 0) return alert('⚠️ Belum ada data paking untuk di-export.');

      const formattedData = packingList.map((item, index) => ({
        No: index + 1,
        'Tracking ID': item.tracking_id || '-',
        'No. SPK': item.no_spk || '-',
        'Client / PT': item.client_pt || '-',
        'Promo / Project': item.promo_title || '-',
        'Nama Toko / Alamat': item.store_name || '-',
        Penerima: item.recipient_name || '-',
        'Total Qty': item.total_qty || '-',
        'Status QC Label': item.status_qc_label || 'PENDING',
        'Status QC Packing': item.status_qc_packing || 'PENDING',
        'Status QC Checker': item.status_qc_checker || 'PENDING',
        'Status Deliver': item.status_deliver || 'PENDING',
        'Terakhir Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report_Paking');

      const todayStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Report_Paking_Wellen_${todayStr}.xlsx`);
      alert('✅ Report Excel Paking berhasil di-download!');
    } catch (err) {
      alert('Gagal download report: ' + err.message);
    }
  };

  const handleClearAllPackingData = async () => {
    if (confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data paking di database?')) {
      try {
        const { error } = await supabase.from('packing_tracking').delete().not('tracking_id', 'is', null);
        if (error) throw error;
        alert('✅ Seluruh data paking berhasil dikosongkan!');
        setPackingList([]);
      } catch (err) {
        alert('❌ Gagal menghapus: ' + err.message);
      }
    }
  };

  const filteredList = packingList.filter((item) => {
    const matchDelivery = filterDelivery === 'ALL' || item.delivery_type === filterDelivery;
    const matchSearch =
      searchTerm === '' ||
      item.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.no_spk?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.box_code?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchDelivery && matchSearch;
  });

  const totalSpk = packingList.length;

  const renderSingleLabelSheet = (item) => {
    const details = parseItems(item.items_detail);
    const filledDetails = details.length > 0 
      ? [...details, ...Array(Math.max(0, 6 - details.length)).fill({})]
      : Array(6).fill({});

    return (
      <div className="label-page" style={{ width: '195mm', height: '270mm', border: '2px solid #000', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', overflow: 'hidden', pageBreakAfter: 'always', margin: '0 auto 10mm auto' }}>
        <div style={{ height: '36mm', display: 'grid', gridTemplateColumns: '30mm 1fr 28mm', borderBottom: '2px solid #000', boxSizing: 'border-box' }}>
          <div style={{ borderRight: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '900', color: '#dc2626' }}>
            {item.box_code || 'B1'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '2px solid #000' }}>
            <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '13px', borderBottom: '1px solid #000', padding: '2px 0', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
              {item.client_pt}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '26mm 4mm 16mm 26mm 1fr', fontSize: '10px', borderBottom: '1px solid #000', height: '6mm', alignItems: 'center' }}>
              <div style={{ paddingLeft: '4px', fontWeight: 'bold' }}>NOMOR TOKO</div>
              <div style={{ textAlign: 'center' }}>:</div>
              <div style={{ fontWeight: '900', textAlign: 'center' }}>{item.recipient_name?.match(/\d+/)?.[0] || '-'}</div>
              <div style={{ textAlign: 'center', fontWeight: '900', color: '#fff', background: item.delivery_type === 'DALAM KOTA' ? '#dc2626' : '#2563eb', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
                {item.delivery_type || 'DALAM KOTA'}
              </div>
              <div style={{ borderLeft: '1px solid #000', textAlign: 'center', fontWeight: '900', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.recipient_name?.match(/\((.*?)\)/)?.[1] || '-'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '26mm 4mm 1fr', fontSize: '10px', borderBottom: '1px solid #000', height: '6mm', alignItems: 'center' }}>
              <div style={{ paddingLeft: '4px', fontWeight: 'bold' }}>MINISO</div>
              <div style={{ textAlign: 'center' }}>:</div>
              <div style={{ fontWeight: '900', paddingLeft: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.store_name}
              </div>
            </div>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9px', borderBottom: '1px solid #000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '1px 0' }}>
              {item.promo_title}
            </div>
            <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '9px', padding: '1px 0' }}>
              {item.no_spk}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
            <QRCodeSVG value={item.qr_address || item.tracking_id} size={42} />
            <span style={{ fontWeight: '900', fontSize: '13px', marginTop: '1px' }}>{item.area_code || 'Q1'}</span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {filledDetails.slice(0, 6).map((sub, idx) => (
            <div key={idx} style={{ height: '38.5mm', borderBottom: idx === 5 ? 'none' : '2px solid #000', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
              <div style={{ height: '5mm', borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px', background: '#f5f5f5', fontSize: '9px', fontWeight: 'bold' }}>
                <span>{sub.material || (sub.code ? 'PVC' : '')}</span>
                <span>{sub.size ? `Ukuran : ${sub.size}` : ''}</span>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '70mm 25mm 1fr', alignItems: 'stretch' }}>
                <div style={{ borderRight: '1px solid #000', padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#dc2626', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                    {sub.code || ''}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#262626', lineHeight: 1.1 }}>
                    {sub.desc || ''}
                  </div>
                </div>
                <div style={{ borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                  <span style={{ fontSize: '24px', fontWeight: '900', lineHeight: 1 }}>{sub.qty || (sub.code ? 0 : '')}</span>
                  {sub.code && <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#525252' }}>{sub.unit || 'Pcs'}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', background: '#fafafa', overflow: 'hidden' }}>
                  {sub.image_url ? (
                    <img 
                      src={sub.image_url} 
                      alt="" 
                      style={{ maxHeight: '30mm', maxWidth: '100%', objectFit: 'contain', display: 'block' }} 
                    />
                  ) : (
                    sub.code && <div style={{ width: '100%', height: '100%', background: '#bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#6b7280', fontStyle: 'italic' }}>Preview Desain</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Panel Kontrol Paking & Penanggung Jawab Scan
          </h2>
          <span className="text-xs font-bold px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            Total Box Koli: {totalSpk}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stages.map((stage) => {
            const completedCount = packingList.filter((s) => s[stage.id] === 'DONE' || (s[stage.id] && String(s[stage.id]).includes('DONE'))).length;
            const percent = totalSpk > 0 ? Math.round((completedCount / totalSpk) * 100) : 0;

            return (
              <div key={stage.id} className={`p-6 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`}></div> {stage.label}
                    </h3>
                    <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-500">{percent}%</span>
                  </div>
                  <p className="text-[11px] font-bold text-stone-400 mb-6">{stage.staff}</p>

                  <div className="text-center py-6 space-y-1">
                    <span className="text-3xl font-black tracking-tight block text-stone-800 dark:text-neutral-100">
                      {completedCount} <span className="text-sm font-medium text-stone-400">/ {totalSpk}</span>
                    </span>
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">Box Selesai</span>
                  </div>
                </div>

                <div className={`mt-6 pt-3 border-t text-[11px] font-bold flex justify-between items-center ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-100 text-stone-500'}`}>
                  <span>Status:</span>
                  <span className={percent === 100 ? 'text-emerald-500 font-black' : 'text-amber-500 font-bold'}>
                    {percent === 100 ? '🟢 100% Selesai' : '🟡 In Progress'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              📷 Mode Scan Gudang (QC/Checker)
            </button>

            <button
              onClick={() => setIsGSheetModalOpen(true)}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              🌐 Import Google Sheet
            </button>

            <label className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
              {isImporting ? '⏳ Membaca File...' : '📤 Import Excel Matriks'}
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} disabled={isImporting} />
            </label>

            <label className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
              {isUploadingImages ? '⏳ Mengunggah ke Storage...' : '🖼️ Upload Desain (Smart Match)'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkUploadDesignImages} disabled={isUploadingImages} />
            </label>

            <button
              onClick={handleBatchPrintAll}
              className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              🖨️ Batch Print Label A4
            </button>

            <button
              onClick={() => handlePrintSuratJalan(filteredList)}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              📄 Cetak Surat Jalan
            </button>

            <button
              onClick={handleDownloadPackingReport}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              📥 Report Excel
            </button>

            <button
              onClick={handleClearAllPackingData}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              🗑️ Hapus Data
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t dark:border-neutral-700">
          <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-neutral-700/50 p-1 rounded-xl w-full sm:w-auto">
            {['ALL', 'DALAM KOTA', 'LUAR KOTA'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterDelivery(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterDelivery === type
                    ? 'bg-white dark:bg-neutral-800 shadow-sm text-stone-900 dark:text-white'
                    : 'text-stone-500 hover:text-stone-900 dark:text-stone-400'
                }`}
              >
                {type === 'ALL' ? 'Semua Box' : type}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="🔍 Cari Store, SPK, atau Box..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-1.5 rounded-xl border text-xs bg-stone-50 dark:bg-neutral-900 border-stone-200 dark:border-neutral-700 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-200 text-stone-500'}`}>
              <tr>
                <th className="py-3 px-4">Box</th>
                <th className="py-3 px-4">Nama Store / SPK</th>
                <th className="py-3 px-4">Tipe Kirim</th>
                <th className="py-3 px-4 text-center">Label & Desain</th>
                <th className="py-3 px-4 text-center">Status Packing</th>
                <th className="py-3 px-4 text-center">Status Checker</th>
                <th className="py-3 px-4 text-center">Bukti Foto</th>
                <th className="py-3 px-4 text-center">Aksi Kamera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-700/50">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center opacity-60">
                    Tidak ada data box yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const isPackingDone = item.status_qc_packing === 'DONE';
                  const isCheckerDone = item.status_qc_checker === 'DONE';

                  return (
                    <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50'}`}>
                      <td className="py-3 px-4 font-black text-indigo-500">{item.box_code || '-'}</td>
                      <td className="py-3 px-4 font-semibold">
                        <div>{item.store_name || '-'}</div>
                        <div className="text-[10px] text-stone-400 font-normal">{item.no_spk} | {item.promo_title}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${item.delivery_type === 'DALAM KOTA' ? 'bg-red-500/10 text-red-600' : 'bg-blue-500/10 text-blue-600'}`}>
                          {item.delivery_type || 'DALAM KOTA'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handlePrintLabel(item)}
                            className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold rounded-xl text-[11px] transition-all shadow-sm active:scale-95"
                          >
                            🖨️ Cetak
                          </button>
                          <button
                            onClick={() => setEditingRowItem(item)}
                            className="px-2 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-neutral-700 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-[11px] transition-all active:scale-95"
                          >
                            ✏️ Foto
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(item.id, 'status_qc_packing', item.status_qc_packing)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 ${
                            isPackingDone
                              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                              : 'bg-stone-200 dark:bg-neutral-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                          }`}
                        >
                          {isPackingDone ? '✓ DONE' : '▢ PENDING'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(item.id, 'status_qc_checker', item.status_qc_checker)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 ${
                            isCheckerDone
                              ? 'bg-amber-500 text-white shadow-amber-500/20'
                              : 'bg-stone-200 dark:bg-neutral-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                          }`}
                        >
                          {isCheckerDone ? '✓ CHECKED' : '▢ PENDING'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {item.bukti_paking_url ? (
                          <div className="flex justify-center">
                            <img
                              src={item.bukti_paking_url}
                              alt="Bukti Paking"
                              onClick={() => onOpenImageModal(item.bukti_paking_url, `Bukti Paking - ${item.tracking_id}`)}
                              className="w-10 h-10 object-cover rounded-xl border border-stone-300 dark:border-neutral-600 cursor-pointer hover:scale-110 transition-transform shadow-md"
                            />
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-[10px]">No Foto</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <label className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all shadow-md ${
                          uploadingId === item.id ? 'bg-stone-400 text-white cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                        }`}>
                          {uploadingId === item.id ? '⏳' : '📸 Foto'}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleCameraCapture(e, item.id, item.tracking_id)}
                            disabled={uploadingId === item.id}
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isSheetSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-neutral-700">
              <div>
                <h3 className="font-black text-sm uppercase flex items-center gap-2">📑 Pilih Sheet yang Akan Di-Import</h3>
                <p className="text-xs text-stone-400">Total {availableSheets.length} sheet ditemukan</p>
              </div>
              <button
                onClick={() => { setIsSheetSelectorOpen(false); setPendingWorkbook(null); }}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-stone-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400">
                {selectedSheets.length} sheet dipilih
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSheets(availableSheets)}
                  className="text-xs text-indigo-500 font-bold hover:underline cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-stone-300">|</span>
                <button
                  onClick={() => setSelectedSheets([])}
                  className="text-xs text-rose-500 font-bold hover:underline cursor-pointer"
                >
                  Hapus Pilihan
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 p-2 rounded-2xl bg-stone-50 dark:bg-neutral-900 border border-stone-200 dark:border-neutral-700 mb-6">
              {availableSheets.map((sheetName) => {
                const isChecked = selectedSheets.includes(sheetName);
                return (
                  <label
                    key={sheetName}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors border ${
                      isChecked
                        ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'hover:bg-stone-100 dark:hover:bg-neutral-800 border-transparent text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSheets((prev) => [...prev, sheetName]);
                        } else {
                          setSelectedSheets((prev) => prev.filter((s) => s !== sheetName));
                        }
                      }}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs flex-1">{sheetName}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setIsSheetSelectorOpen(false); setPendingWorkbook(null); }}
                className="px-4 py-2 bg-stone-200 dark:bg-neutral-700 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteSelectedSheetsImport}
                disabled={isImporting || selectedSheets.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isImporting ? '⏳ Mengimport...' : `⚡ Import ${selectedSheets.length} Sheet`}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGSheetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-neutral-700">
              <h3 className="font-black text-sm uppercase flex items-center gap-2">🌐 Tarik Data Google Spreadsheet</h3>
              <button
                onClick={() => setIsGSheetModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-stone-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 leading-relaxed">
              Pastikan Spreadsheet Anda telah disetel akses publik (<strong>Anyone with the link can view</strong>), lalu tempel tautan URL di bawah:
            </p>

            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={gSheetUrlInput}
              onChange={(e) => setGSheetUrlInput(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border text-xs bg-stone-50 dark:bg-neutral-900 border-stone-200 dark:border-neutral-700 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4 font-mono"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsGSheetModalOpen(false)}
                className="px-4 py-2 bg-stone-200 dark:bg-neutral-700 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleFetchGoogleSheet}
                disabled={isImporting}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-black rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
              >
                {isImporting ? '⏳ Mengambil Sheet...' : '⚡ Lanjut Pilih Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-neutral-700">
              <h3 className="font-black text-sm uppercase flex items-center gap-2">📷 In-App QR Scanner</h3>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-stone-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 mb-4 bg-stone-100 dark:bg-neutral-700 p-1.5 rounded-2xl">
              <button
                onClick={() => setScannerTargetStage('status_qc_packing')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  scannerTargetStage === 'status_qc_packing' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-500 dark:text-stone-300'
                }`}
              >
                QC PACKING
              </button>
              <button
                onClick={() => setScannerTargetStage('status_qc_checker')}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  scannerTargetStage === 'status_qc_checker' ? 'bg-amber-500 text-white shadow-md' : 'text-stone-500 dark:text-stone-300'
                }`}
              >
                QC CHECKER
              </button>
            </div>

            <div id="qr-reader-container" className="rounded-2xl overflow-hidden border-2 border-dashed border-stone-300 dark:border-neutral-600 bg-black min-h-[260px]"></div>

            {lastScanFeedback && (
              <div className={`mt-4 p-3 rounded-2xl text-xs font-bold text-center animate-fade-in ${
                lastScanFeedback.success ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
              }`}>
                {lastScanFeedback.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL KELOLA FOTO TOKO */}
      {editingRowItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 overflow-y-auto shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-3 dark:border-neutral-700">
              <div>
                <h3 className="font-black text-base uppercase">Kelola Foto Desain Toko</h3>
                <p className="text-xs text-stone-400 font-bold">{editingRowItem.store_name} ({editingRowItem.box_code})</p>
              </div>
              <button
                onClick={() => setEditingRowItem(null)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-stone-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {parseItems(editingRowItem.items_detail).map((itm, i) => (
                <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-neutral-700/40 border-neutral-600' : 'bg-stone-50 border-stone-200'}`}>
                  <div className="flex-1">
                    <div className="font-black text-sm text-red-500">{itm.code}</div>
                    <div className="text-xs font-semibold">{itm.desc}</div>
                    <div className="text-[11px] text-stone-400 font-mono">Ukuran: {itm.size} | Qty: {itm.qty} Pcs</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {itm.image_url ? (
                      <img src={itm.image_url} alt="Desain" className="w-16 h-10 object-contain rounded-lg border bg-white" />
                    ) : (
                      <div className="w-16 h-10 rounded-lg bg-stone-200 dark:bg-neutral-600 flex items-center justify-center text-[9px] text-stone-400 italic">No Foto</div>
                    )}
                    <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95">
                      Ganti Foto
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleSingleImageOverride(editingRowItem.id, i, e.target.files[0])} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRINT CONTAINER A4 */}
      <div className="print-area hidden print:block">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 5mm !important;
            }
            html, body {
              width: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * {
              visibility: hidden !important;
            }
            .print-area, .print-area * {
              visibility: visible !important;
            }
            .print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 auto !important;
            }
            .label-page {
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-after: page !important;
            }
          }
        `}</style>

        {isSuratJalanPrinting && suratJalanGroup ? (
          <div className="label-page p-6 font-sans text-black bg-white">
            <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight">SURAT JALAN & PACKING LIST</h1>
                <p className="text-xs font-bold text-stone-600">PT. WELLEN PRINTING INDONESIA</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">Tanggal: {new Date().toLocaleDateString('id-ID')}</p>
                <p className="font-mono font-bold">Total Koli: {suratJalanGroup.length} Box</p>
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-xs mb-8">
              <thead>
                <tr className="bg-stone-100 font-black">
                  <th className="border border-black p-2 text-center w-12">No</th>
                  <th className="border border-black p-2">Box Code</th>
                  <th className="border border-black p-2">Nama Toko & Tujuan</th>
                  <th className="border border-black p-2">No. SPK / PO</th>
                  <th className="border border-black p-2 text-center">Tipe</th>
                  <th className="border border-black p-2 text-center">Status QC</th>
                </tr>
              </thead>
              <tbody>
                {suratJalanGroup.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="border border-black p-2 text-center font-bold">{idx + 1}</td>
                    <td className="border border-black p-2 font-black text-red-600">{item.box_code}</td>
                    <td className="border border-black p-2 font-bold">{item.store_name} ({item.recipient_name})</td>
                    <td className="border border-black p-2">{item.no_spk}</td>
                    <td className="border border-black p-2 text-center font-bold">{item.delivery_type}</td>
                    <td className="border border-black p-2 text-center font-black text-emerald-600">
                      {item.status_qc_checker === 'DONE' ? '✓ CHECKED' : 'PENDING'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-3 text-center text-xs font-bold pt-12">
              <div>
                <p>Bagian Packing</p>
                <div className="h-16"></div>
                <p>( ................................ )</p>
              </div>
              <div>
                <p>Ekspedisi / Driver</p>
                <div className="h-16"></div>
                <p>( ................................ )</p>
              </div>
              <div>
                <p>Penerima Toko</p>
                <div className="h-16"></div>
                <p>( ................................ )</p>
              </div>
            </div>
          </div>
        ) : isBatchPrinting ? (
          filteredList.map((item) => <React.Fragment key={item.id}>{renderSingleLabelSheet(item)}</React.Fragment>)
        ) : (
          selectedLabelItem && renderSingleLabelSheet(selectedLabelItem)
        )}
      </div>
    </div>
  );
}