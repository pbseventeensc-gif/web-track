import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';
import {
  Camera,
  Globe,
  Upload,
  Printer,
  FileText,
  Download,
  Trash2,
  Check,
  Clock,
  Search,
  Edit3,
  Image as ImageIcon,
  X,
  Sparkles
} from 'lucide-react';

// Global memory cache untuk link gambar aktif di browser
if (!window.__ACTIVE_DESIGN_URLS__) {
  window.__ACTIVE_DESIGN_URLS__ = {};
}

export default function PackingPanel({ isDarkMode, spkList = [], handleUpdateField, onOpenImageModal }) {
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
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'IN_PROGRESS', 'COMPLETED'
  const [searchTerm, setSearchTerm] = useState('');

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

  // Editable Note States
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [tempNoteText, setPendingNoteText] = useState('');

  // Row Selection Circle Checklist States
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  // Outbound QR Scan States
  const [showOutboundScanModal, setShowOutboundScanModal] = useState(false);
  const [outboundScannedCode, setOutboundScannedCode] = useState('');
  const [matchedOutboundItem, setMatchedOutboundItem] = useState(null);
  const [outboundScanMsg, setOutboundScanMsg] = useState('');

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

  const fetchPackingData = async () => {
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('*')
      .order('id', { ascending: true });

    if (!error && data) {
      const normalizedData = data.map(item => {
        const details = parseItems(item.items_detail).map((sub, idx) => {
          const itemCode = sub.code || '';
          const itemCore = extractCoreCode(itemCode);

          // RECOVERY LOGIC: Cari link gambar di memory berdasarkan berbagai kemungkinan kunci
          // Gunakan fallback ke string kosong jika undefined untuk menghindari "undefined" string
          const activeUrl = sub.image_url ||
                           window.__ACTIVE_DESIGN_URLS__[itemCode] ||
                           window.__ACTIVE_DESIGN_URLS__[cleanKey(itemCode)] ||
                           (itemCore ? window.__ACTIVE_DESIGN_URLS__[itemCore] : '') ||
                           '';

          return { ...sub, image_url: activeUrl };
        });
        return {
          ...item,
          items_detail: details
        };
      });
      setPackingList(normalizedData);
    }
  };

  const cleanKey = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const extractCoreCode = (str) => {
    if (!str) return '';
    // v5 Smart Match: Ambil bagian setelah pemisah terakhir (- atau .)
    // Contoh: "B.1-1" -> "1", "207 - B.3-5" -> "5", "B.10" -> "10"
    const parts = String(str).split(/[-.]/);
    const lastPart = parts[parts.length - 1].trim();

    // Jika bagian terakhir murni angka, kembalikan itu
    if (/^\d+$/.test(lastPart)) return lastPart;

    // Fallback: Ambil angka terakhir di dalam bagian tersebut
    const match = lastPart.match(/(\d+)$/);
    return match ? match[1] : lastPart.toLowerCase();
  };

  // Convert File ke Base64 (Lebih stabil untuk Print di Mac/Safari)
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${hours}:${mins} • ${day}/${month}`;
    } catch (e) {
      return null;
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

  const handleSaveNote = async (id, noteText) => {
    setPackingList((prev) => prev.map((item) => (item.id === id ? { ...item, catatan: noteText } : item)));

    const { error } = await supabase
      .from('packing_tracking')
      .update({ catatan: noteText, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Gagal memperbarui catatan:', error.message);
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.length === filteredList.length && filteredList.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filteredList.map((item) => item.id));
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
        if (!data || data.length < 2) return;

        // Smart Header Row Detection for Item Codes
        let codeRowIdx = 1;
        for (let r = 0; r < Math.min(6, data.length); r++) {
          const row = data[r] || [];
          const hasCodes = row.some((val, c) => c >= 10 && val && String(val).match(/^[A-Za-z0-9._-]+$/) && !String(val).toUpperCase().includes('QR'));
          if (hasCodes) {
            codeRowIdx = r;
            break;
          }
        }

        const rowCodes = data[codeRowIdx] || [];
        const rowDescs = data[codeRowIdx + 1] || [];
        const rowMaterials = data[codeRowIdx + 2] || [];
        const rowSizes = data[codeRowIdx + 3] || [];

        let catalogItems = [];
        for (let colIdx = 10; colIdx < rowCodes.length; colIdx++) {
          const rawCode = rowCodes[colIdx];
          if (rawCode && !String(rawCode).toUpperCase().includes('QR') && String(rawCode).trim() !== '') {
            catalogItems.push({
              colIndex: colIdx,
              code: String(rawCode).trim(),
              desc: rowDescs[colIdx] ? String(rowDescs[colIdx]).trim() : 'LAMINATE',
              material: rowMaterials[colIdx] ? String(rowMaterials[colIdx]).trim() : 'PVC',
              size: rowSizes[colIdx] ? String(rowSizes[colIdx]).trim() : '-'
            });
          }
        }

        // Smart Store Row Scan (start scanning from r = 4)
        for (let r = 4; r < data.length; r++) {
          const row = data[r];
          if (!row || !row[1] || String(row[1]).toUpperCase().includes('STORE') || String(row[1]).toUpperCase().includes('NOMOR')) continue;

          const storeNo = row[1];
          const prCode = row[2] || '';
          const boxCode = row[3] || `B${r - 3}`;
          const storeId = row[4] || '';
          const clientPt = row[5] || 'CV. MAJU MAKMUR RETALINDO';
          const storeName = row[6] || '';
          const noPo = row[7] || '';
          const spkWpp = row[8] || '';
          const deliveryType = row[9] || 'DALAM KOTA';

          // GENERATE QR CODE UNIK SISTEM SESUAI FORMAT ANDROID APP (Format: STORENO_BOXCODE_STOREID_STORENAME)
          const trackingId = `${prCode || 'PR'}-${boxCode}-${storeId || storeNo}`;
          const qrAddress = `${storeNo}_${boxCode}_${storeId}_${storeName}`;

          let storeItems = [];
          let totalQty = 0;

          catalogItems.forEach((cat, catIdx) => {
            const qtyVal = Number(row[cat.colIndex]) || 0;
            if (qtyVal > 0) {
              const activeImg = window.__ACTIVE_DESIGN_URLS__[cat.code] || window.__ACTIVE_DESIGN_URLS__[catIdx] || '';
              storeItems.push({
                code: cat.code,
                desc: cat.desc,
                material: cat.material,
                size: cat.size,
                qty: qtyVal,
                unit: 'Pcs',
                image_url: activeImg
              });
              totalQty += qtyVal;
            }
          });

          parsedRecords.push({
            tracking_id: trackingId,
            no_spk: spkWpp,
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

  // Upload Foto Desain Langsung (Instant Display ObjectURL)
  const handleBulkUploadDesignImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    if (packingList.length === 0) {
      alert('⚠️ Silakan Import Data Toko terlebih dahulu!');
      e.target.value = '';
      return;
    }

    setIsUploadingImages(true);
    console.log("=== START BULK UPLOAD MATCHING (v6 Base64) ===");
    try {
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      // Konversi semua file ke Base64 secara paralel
      const imageList = await Promise.all(files.map(async (file, idx) => {
        const rawFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const normalizedKey = cleanKey(rawFileName);
        const coreKey = extractCoreCode(rawFileName);

        // GUNAKAN BASE64 ALIH-ALIAH OBJECTURL
        const base64Data = await readFileAsBase64(file);

        window.__ACTIVE_DESIGN_URLS__[rawFileName] = base64Data;
        window.__ACTIVE_DESIGN_URLS__[normalizedKey] = base64Data;
        if (coreKey) window.__ACTIVE_DESIGN_URLS__[coreKey] = base64Data;

        return { 
          index: idx, 
          fileName: rawFileName,
          rawKey: normalizedKey, 
          coreKey: coreKey, 
          url: base64Data
        };
      }));

      let totalMatches = 0;
      const newPackingList = packingList.map((row) => {
        const details = parseItems(row.items_detail);
        if (details.length === 0) return row;

        const newDetails = details.map((item, itemIdx) => {
          const itemCodeClean = cleanKey(item.code);
          const itemCore = extractCoreCode(item.code);

          // 1. Cek Exact Match atau Partial Match Kunci Bersih
          let matched = imageList.find((img) =>
            img.rawKey === itemCodeClean ||
            itemCodeClean.endsWith(img.rawKey) ||
            img.rawKey.endsWith(itemCodeClean)
          );

          // 2. Cek Core Match (Pola akhiran angka yang sama, misal: "-1" atau ".5")
          if (!matched && itemCore) {
            matched = imageList.find((img) => img.coreKey === itemCore);
          }

          if (matched && matched.url) {
            totalMatches++;
            console.log(`✅ MATCH: Item [${item.code}] -> File [${matched.fileName}] (Core: ${itemCore})`);
            return { ...item, image_url: matched.url };
          }
          console.warn(`❌ FAIL: Item [${item.code}] (Core: ${itemCore}) found no match.`);
          return item;
        });

        return { ...row, items_detail: newDetails, updated_at: new Date().toISOString() };
      });

      // Update State UI Seketika
      setPackingList(newPackingList);

      alert(`✅ Selesai! Berhasil memasangkan ${totalMatches} desain ke item yang cocok.`);
    } catch (err) {
      alert('❌ Gagal mengunggah foto: ' + err.message);
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleSingleImageOverride = (rowId, itemIndex, file) => {
    if (!file) return;
    try {
      const displayUrl = getFileObjectUrl(file);
      const targetRow = packingList.find((p) => p.id === rowId);
      if (!targetRow) return;

      const currentDetails = parseItems(targetRow.items_detail);
      const updatedItems = [...currentDetails];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], image_url: displayUrl };

      setPackingList((prev) =>
        prev.map((p) => (p.id === rowId ? { ...p, items_detail: updatedItems } : p))
      );

      if (editingRowItem) {
        setEditingRowItem((prev) => ({ ...prev, items_detail: updatedItems }));
      }
      alert('✅ Foto berhasil diperbarui!');
    } catch (err) {
      alert('❌ Gagal mengubah gambar: ' + err.message);
    }
  };

  const handlePrintLabel = (item) => {
    setIsSuratJalanPrinting(false);
    setIsBatchPrinting(false);

    const freshItem = packingList.find((p) => p.id === item.id) || item;
    setSelectedLabelItem({
      ...freshItem,
      items_detail: parseItems(freshItem.items_detail)
    });

    // Tunggu render selesai dan pastikan semua gambar termuat sebelum dialog print muncul
    setTimeout(() => {
      const printArea = document.querySelector('.print-area');
      if (!printArea) return window.print();

      const images = printArea.querySelectorAll('img');
      if (images.length === 0) return window.print();

      const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });

      Promise.all(promises).then(() => {
        // Tambahan jeda ekstra agar Safari/Chrome sempat menggambar pixelnya
        setTimeout(() => window.print(), 300);
      });
    }, 800);
  };

  const handleBatchPrintAll = () => {
    if (filteredList.length === 0) return alert('⚠️ Tidak ada data label yang dapat dicetak.');
    setIsSuratJalanPrinting(false);
    setIsBatchPrinting(true);
    setSelectedLabelItem(null);

    setTimeout(() => {
      const images = document.querySelectorAll('.print-area img');
      const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      Promise.all(promises).then(() => {
        window.print();
      });
    }, 800);
  };

  const handlePrintSuratJalan = (itemsToPrint) => {
    setIsBatchPrinting(false);
    setSelectedLabelItem(null);
    setIsSuratJalanPrinting(true);
    setSuratJalanGroup(itemsToPrint);

    setTimeout(() => {
      const printArea = document.querySelector('.print-area');
      if (!printArea) return window.print();

      const images = printArea.querySelectorAll('img');
      const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });

      Promise.all(promises).then(() => {
        setTimeout(() => window.print(), 500);
      });
    }, 1200);
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
          const MAX_WIDTH = 2048;
          const MAX_HEIGHT = 2048;
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
          }, 'image/jpeg', 0.9);
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

  const handleOutboundCameraCapture = async (e, rowId, boxCode) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(`outbound-${rowId}`);
    try {
      const compressedBlob = await compressImage(file);
      const cleanCode = boxCode ? String(boxCode).replace(/[^a-zA-Z0-9-_]/g, '_') : 'box';
      const fileName = `outbound_${cleanCode}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('surat-jalan')
        .upload(fileName, compressedBlob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const nowIso = new Date().toISOString();
      const staffName = 'Staff Outbound';

      // Update di Supabase packing_tracking (dukung kolom outbound_url & staff_outbound)
      const { error: updateError } = await supabase
        .from('packing_tracking')
        .update({
          outbound_url: publicUrl,
          staff_outbound: staffName,
          bukti_outbound_url: publicUrl,
          outbound_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', rowId);

      if (updateError) {
        console.error('Update outbound_url error:', updateError);
      }

      // Update state lokal secara instan
      setPackingList((prev) =>
        prev.map((item) =>
          item.id === rowId
            ? {
                ...item,
                outbound_url: publicUrl,
                staff_outbound: staffName,
                bukti_outbound_url: publicUrl,
                outbound_at: nowIso,
                catatan: publicUrl
              }
            : item
        )
      );

      alert('✅ Foto Outbound berhasil diunggah!');
      fetchPackingData();
    } catch (err) {
      alert('❌ Gagal upload foto Outbound: ' + err.message);
    }
    setUploadingId(null);
  };

  const handleProcessOutboundScan = (codeValue) => {
    if (!codeValue || !codeValue.trim()) return;

    const rawCode = codeValue.trim();
    let cleanCode = rawCode;
    if (rawCode.includes('scan=')) {
      cleanCode = rawCode.split('scan=')[1]?.split('&')[0] || rawCode;
    }
    cleanCode = decodeURIComponent(cleanCode).trim();

    const found = packingList.find((item) => {
      const boxCode = (item.box_code || '').toLowerCase();
      const trackingId = (item.tracking_id || '').toLowerCase();
      const spk = (item.no_spk || '').toLowerCase();
      const searchTarget = cleanCode.toLowerCase();

      return boxCode === searchTarget || trackingId === searchTarget || spk === searchTarget || (item.store_name || '').toLowerCase().includes(searchTarget);
    });

    if (!found) {
      setOutboundScanMsg(`❌ Box / QR "${cleanCode}" tidak ditemukan di data paking!`);
      setOutboundScannedCode('');
      setMatchedOutboundItem(null);
      return;
    }

    setMatchedOutboundItem(found);
    setOutboundScanMsg(`✅ Box ditemukan: ${found.box_code || '-'} (${found.store_name}). Silakan ambil foto Outbound!`);
    setOutboundScannedCode('');
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
        'Bukti Paking Foto': item.bukti_paking_url || 'No Foto',
        'Outbound Foto': item.bukti_outbound_url || (item.catatan?.startsWith('http') ? item.catatan : '-'),
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
        const { error } = await supabase.from('packing_tracking').delete().gt('id', 0);
        if (error) throw error;
        alert('✅ Seluruh data paking berhasil dikosongkan!');
        setPackingList([]);
        window.__ACTIVE_DESIGN_URLS__ = {};
      } catch (err) {
        alert('❌ Gagal menghapus: ' + err.message);
      }
    }
  };

  const sourceList = packingList;

  const completedBoxCount = sourceList.filter(item => item.status_qc_packing === 'DONE' && item.status_qc_checker === 'DONE').length;
  const pendingBoxCount = sourceList.length - completedBoxCount;

  const filteredList = sourceList.filter((item) => {
    const matchDelivery = filterDelivery === 'ALL' || item.delivery_type === filterDelivery;

    const isDone = item.status_qc_packing === 'DONE' && item.status_qc_checker === 'DONE';
    const matchStatus = filterStatus === 'ALL' || (filterStatus === 'COMPLETED' ? isDone : !isDone);

    const matchSearch =
      searchTerm === '' ||
      item.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.no_spk?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.box_code?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchDelivery && matchStatus && matchSearch;
  });

  const totalSpk = sourceList.length;

  const renderSingleLabelSheet = (item) => {
    const details = parseItems(item.items_detail);

    // Chunking: Bagi item menjadi grup berisi maksimal 5 item per halaman agar gambar lebih besar
    const chunks = [];
    if (details.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < details.length; i += 5) {
        chunks.push(details.slice(i, i + 5));
      }
    }

    return (
      <>
        {chunks.map((chunk, pageIdx) => {
          const totalPages = chunks.length;
          const currentPage = pageIdx + 1;

          return (
            <div key={`${item.id}-page-${currentPage}`} className="label-page" style={{ width: '195mm', minHeight: '100mm', height: 'auto', border: '2px solid #000', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', overflow: 'hidden', marginBottom: '4mm', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <div style={{ height: '42mm', display: 'grid', gridTemplateColumns: '30mm 1fr 25mm', borderBottom: '3px solid #000', boxSizing: 'border-box' }}>
                {/* Left Section: Box Code & QR */}
                <div style={{ borderRight: '2px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ height: '12mm', borderBottom: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '38px', fontWeight: '900', color: '#dc2626', lineHeight: '1' }}>
                    {item.box_code || 'B1'}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px' }}>
                    <QRCodeSVG value={item.qr_address || item.tracking_id} size={95} />
                  </div>
                </div>

                {/* Middle Section: Kop Info */}
                <div style={{ display: 'flex', flexDirection: 'column', borderRight: '2px solid #000' }}>
                  <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '18px', borderBottom: '1px solid #000', padding: '4px 0', background: '#f8fafc' }}>
                    {item.client_pt}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '35mm 4mm 15mm 1fr 25mm', fontSize: '14px', height: '9mm', alignItems: 'stretch' }}>
                    <div style={{ paddingLeft: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>NOMOR TOKO</div>
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>:</div>
                    <div style={{ fontWeight: '900', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>{item.recipient_name?.match(/\d+/)?.[0] || '-'}</div>
                    <div style={{ fontWeight: '900', color: item.delivery_type === 'DALAM KOTA' ? '#000' : '#fff', background: item.delivery_type === 'DALAM KOTA' ? '#facc15' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>
                      {item.delivery_type || 'DALAM KOTA'}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', borderBottom: '1px solid #000' }}>
                      {item.recipient_name?.match(/\((.*?)\)/)?.[1] || '-'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '35mm 4mm 1fr', fontSize: '14px', height: '9mm', alignItems: 'stretch' }}>
                    <div style={{ paddingLeft: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>MINISO</div>
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000', borderBottom: '1px solid #000' }}>:</div>
                    <div style={{ fontWeight: '900', paddingLeft: '8px', fontSize: '18px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderBottom: '1px solid #000' }}>
                      {item.store_name}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2px' }}>
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', lineHeight: '1.1' }}>
                      {item.promo_title}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '12px', marginTop: '1px' }}>
                      {item.no_spk}
                    </div>
                  </div>
                </div>

                {/* Right Section: Pagination Only (Horizontal & Large) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                  <div style={{ fontWeight: '900', fontSize: '20px', textAlign: 'center', color: '#000', whiteSpace: 'nowrap' }}>
                    {currentPage} OF {totalPages}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chunk.map((sub, idx) => (
                  <div key={idx} style={{ minHeight: '45mm', height: 'auto', borderBottom: idx === chunk.length - 1 ? 'none' : '2px solid #000', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', pageBreakInside: 'avoid' }}>
                    <div style={{ minHeight: '8mm', height: 'auto', borderBottom: '1px solid #000', display: 'grid', gridTemplateColumns: '115mm 1fr', alignItems: 'center', background: sub.material?.toUpperCase().includes('WPB') ? '#e9d5ff' : '#bfdbfe', color: '#000', fontWeight: '900', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: sub.material?.toUpperCase().includes('WPB') ? '18px' : '11px', fontWeight: 'bold', padding: '3px 10px', lineHeight: '1.1' }}>{sub.material || (sub.code ? 'PVC' : '')}</div>
                      <div style={{ textAlign: 'center', fontSize: '18px', padding: '0 5px' }}>{sub.size ? `Ukuran : ${sub.size}` : ''}</div>
                    </div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '80mm 35mm 1fr', alignItems: 'stretch', minHeight: '37mm' }}>
                      <div style={{ borderRight: '1px solid #000', padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
                        <div style={{ fontSize: '40px', fontWeight: '900', color: '#dc2626', letterSpacing: '-1px', lineHeight: 1 }}>
                          {sub.code || ''}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#000', lineHeight: 1.1, textTransform: 'uppercase', marginTop: '2px' }}>
                          {sub.desc || ''}
                        </div>
                      </div>
                      <div style={{ borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                        <span style={{ fontSize: '64px', fontWeight: '900', lineHeight: 1 }}>{sub.qty || (sub.code ? 0 : '')}</span>
                        {sub.code && <span style={{ fontSize: '20px', fontWeight: '900', color: '#000', marginTop: '0px' }}>{sub.unit || 'Pcs'}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', background: '#fafafa', overflow: 'hidden' }}>
                        {sub.image_url ? (
                          <img
                            src={sub.image_url}
                            alt={`Preview ${sub.code}`}
                            decoding="sync"
                            loading="eager"
                            style={{
                              height: '35mm',
                              width: 'auto',
                              maxWidth: '100%',
                              objectFit: 'contain',
                              display: 'block',
                              margin: 'auto',
                              printColorAdjust: 'exact',
                              WebkitPrintColorAdjust: 'exact'
                            }}
                          />
                        ) : (
                          sub.code && <div style={{ width: '100%', height: '100%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>Preview Desain</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </>
    );
  };



  return (
    <div className="space-y-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-black">
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
          <h2 className="text-base font-bold uppercase tracking-wider text-black">
            Panel Kontrol Paking
          </h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-800 rounded-lg">
            Total Box Koli: {totalSpk}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map((stage) => {
            const completedCount = packingList.filter((s) => s[stage.id] === 'DONE' || (s[stage.id] && String(s[stage.id]).includes('DONE'))).length;
            const percent = totalSpk > 0 ? Math.round((completedCount / totalSpk) * 100) : 0;
            const is100Percent = percent === 100 && totalSpk > 0;

            return (
              <div
                key={stage.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  is100Percent
                    ? 'bg-emerald-50/80 border-emerald-400 shadow-xs'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-black">
                      <div className={`w-2 h-2 rounded-full ${stage.color}`}></div> {stage.label}
                    </h3>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                      is100Percent ? 'bg-emerald-600 text-white' : 'bg-amber-500/10 text-amber-800'
                    }`}>
                      {percent}%
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 mb-2">{stage.staff}</p>

                  <div className="text-center py-2 space-y-0.5">
                    <span className="text-xl font-extrabold tracking-tight block text-black">
                      {completedCount} <span className="text-xs font-medium text-slate-500">/ {totalSpk}</span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block">Box Selesai</span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/80 text-[10px] font-semibold flex justify-between items-center text-slate-700">
                  <span>Status:</span>
                  <span className={is100Percent ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                    {is100Percent ? '🟢 100% Selesai 🎉' : '🟡 In Progress'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 rounded-2xl border bg-white border-slate-200 shadow-2xs">

        {/* ENTERPRISE ACTION TOOLBAR */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsGSheetModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Globe className="w-4 h-4 text-white" /> Import Google Sheet
            </button>

            <button
              onClick={() => {
                setShowOutboundScanModal(true);
                setMatchedOutboundItem(null);
                setOutboundScanMsg('');
                setOutboundScannedCode('');
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Camera className="w-4 h-4 text-white" /> Scan QR Outbound
            </button>

            <label className="px-3.5 py-2 bg-white hover:bg-slate-100 text-black border border-slate-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95">
              <Upload className="w-3.5 h-3.5 text-slate-700" />
              {isUploadingImages ? 'Memasang Foto...' : 'Upload Desain'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkUploadDesignImages} disabled={isUploadingImages} />
            </label>

            <button
              onClick={handleBatchPrintAll}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-black border border-slate-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700" /> Print Label A4
            </button>

            <button
              onClick={() => handlePrintSuratJalan(filteredList)}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-black border border-slate-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-slate-700" /> Surat Jalan
            </button>

            <button
              onClick={handleDownloadPackingReport}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-black border border-slate-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-slate-700" /> Export Excel
            </button>

            <button
              onClick={handleClearAllPackingData}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-700" /> Clear Data
            </button>
          </div>
        </div>

        {/* SUB-HEADER SEGMENTED CONTROL & SEARCH */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Progress Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-white shadow-xs font-bold text-black'
                    : 'text-slate-700 hover:text-black font-semibold'
                }`}
              >
                Semua ({sourceList.length})
              </button>
              <button
                onClick={() => setFilterStatus('IN_PROGRESS')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === 'IN_PROGRESS'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-slate-700 hover:text-black font-semibold'
                }`}
              >
                ⏳ On Progress ({pendingBoxCount})
              </button>
              <button
                onClick={() => setFilterStatus('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterStatus === 'COMPLETED'
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-700 hover:text-black font-semibold'
                }`}
              >
                ✅ Done ({completedBoxCount})
              </button>
            </div>

            {/* Delivery Route Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {['ALL', 'DALAM KOTA', 'LUAR KOTA'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterDelivery(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                    filterDelivery === type
                      ? 'bg-white shadow-xs font-bold text-black'
                      : 'text-slate-700 hover:text-black font-semibold'
                  }`}
                >
                  {type === 'ALL' ? 'Semua Rute' : type}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full sm:w-80 relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Store, SPK, atau Box..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 text-xs bg-white text-black placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-semibold"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-600 font-bold"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ENTERPRISE DATA GRID TABLE (STICKY HEADER & INNER SCROLL) */}
        <div className="max-h-[620px] overflow-y-auto overflow-x-auto mt-4 border border-slate-300 rounded-2xl shadow-xs bg-white custom-scrollbar relative">
          <table className="w-full text-left border-collapse bg-white">
            <thead className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-slate-300 text-slate-800 font-bold uppercase tracking-wider text-xs">
              <tr>
                <th className="py-4 pl-4 pr-1 text-center w-8 font-semibold">
                  <button
                    onClick={handleToggleSelectAll}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer mx-auto ${
                      selectedRowIds.length === filteredList.length && filteredList.length > 0
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                        : 'border-slate-400 bg-white hover:border-emerald-600'
                    }`}
                    title="Pilih Semua Baris"
                  >
                    {selectedRowIds.length === filteredList.length && filteredList.length > 0 && (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    )}
                  </button>
                </th>
                <th className="py-4 pl-1 pr-4 font-semibold">BOX</th>
                <th className="py-4 px-4 font-semibold">NAMA STORE / SPK</th>
                <th className="py-4 px-4 font-semibold">TIPE KIRIM</th>
                <th className="py-4 px-4 text-center font-semibold">LABEL & DESAIN</th>
                <th className="py-4 px-4 text-center font-semibold">BUKTI FOTO</th>
                <th className="py-4 px-4 text-center font-semibold">STATUS PACKING</th>
                <th className="py-4 px-4 text-center font-semibold">STATUS CHECKER</th>
                <th className="py-4 px-4 text-center font-semibold">OUTBOUND</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-8 text-center text-slate-500 font-semibold text-xs">
                    Tidak ada data box yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const isPackingDone = item.status_qc_packing === 'DONE';
                  const isCheckerDone = item.status_qc_checker === 'DONE';
                  const isRowComplete = isPackingDone && isCheckerDone;
                  const isSelected = selectedRowIds.includes(item.id);

                  // Tampilkan Baris Blok Orange Pembatas Project/Promo jika ada perubahan project/batch
                  const showProjectDivider = idx > 0 && item.promo_title && item.promo_title !== filteredList[idx - 1]?.promo_title;

                  return (
                    <React.Fragment key={item.id}>
                      {showProjectDivider && (
                        <tr className="bg-amber-100/90 border-y-2 border-amber-300">
                          <td colSpan="9" className="py-2.5 px-4 text-center font-bold text-amber-950 text-xs tracking-wider uppercase shadow-2xs">
                            📦 --- PEMBATAS BATCH / PROJECT: {item.promo_title} ---
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-indigo-50/70 hover:bg-indigo-100/70'
                            : isRowComplete
                            ? 'bg-emerald-50/60 hover:bg-emerald-100/60'
                            : 'hover:bg-slate-50 bg-white'
                        }`}
                      >
                        <td className="py-4 pl-4 pr-1 text-center w-8">
                          <button
                            onClick={() => handleToggleSelectRow(item.id)}
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer mx-auto ${
                              isSelected
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                : 'border-slate-300 bg-white hover:border-emerald-500'
                            }`}
                            title={isSelected ? 'Hapus Pilihan' : 'Pilih Baris Ini'}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </button>
                        </td>
                        <td className="py-3.5 pl-1 pr-4 font-mono text-slate-900 font-semibold text-sm whitespace-nowrap">
                          <span className="font-bold text-slate-900">{item.box_code || '-'}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 text-sm flex items-center gap-2 flex-wrap tracking-tight">
                            {item.store_name || '-'}
                            {isRowComplete && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-xs font-semibold border border-emerald-400">
                                ✅ Done
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-500 font-medium mt-0.5">{item.no_spk} | {item.promo_title}</div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className={`inline-block whitespace-nowrap px-3.5 py-1.5 rounded-lg font-semibold text-xs uppercase tracking-wider text-center border ${
                            item.delivery_type === 'DALAM KOTA'
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-500 shadow-2xs'
                              : 'bg-blue-500/15 text-blue-900 border-blue-400'
                          }`}>
                            {item.delivery_type || 'DALAM KOTA'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handlePrintLabel(item)}
                              title="Cetak Label"
                              className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-900 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer border border-slate-300"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingRowItem(item)}
                              title="Foto Desain"
                              className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-900 flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer border border-slate-300"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-[10px] mt-1 text-slate-500 font-medium">
                            {parseItems(item.items_detail).filter(i => i.image_url).length} / {parseItems(item.items_detail).length} Desain
                          </div>
                        </td>

                        {/* 1. BUKTI FOTO (Layout: Foto -> User ID -> Timestamp) */}
                        <td className="py-3.5 px-4 text-center">
                          {item.bukti_paking_url ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img
                                src={item.bukti_paking_url}
                                alt="Bukti Paking"
                                onClick={() => onOpenImageModal(item.bukti_paking_url, `Bukti Paking - ${item.tracking_id}`)}
                                className="w-10 h-10 object-cover rounded-lg border-2 border-slate-300 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                              />
                              <div className="text-[10px] font-semibold text-slate-800 leading-tight">
                                <span className="block truncate max-w-[110px]">{item.foto_by || item.scanned_by || 'Staff QC'}</span>
                                <span className="text-[9px] font-mono text-slate-500 font-normal block">{formatDateTime(item.foto_at || item.updated_at) || '-'}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[11px]">No Foto</span>
                          )}
                        </td>

                        {/* 2. STATUS PACKING (Layout: Done/Pending -> User ID -> Timestamp) */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              onClick={() => handleToggleStatus(item.id, 'status_qc_packing', item.status_qc_packing)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                                isPackingDone
                                  ? 'bg-blue-50 text-blue-700 border-blue-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isPackingDone ? 'bg-blue-600' : 'bg-slate-400'}`} />
                              {isPackingDone ? 'Done' : 'Pending'}
                            </button>
                            {isPackingDone && (
                              <div className="text-[10px] font-semibold text-slate-800 leading-tight mt-0.5">
                                <span className="block truncate max-w-[110px]">{item.packing_by || item.scanned_by || 'Staff Packing'}</span>
                                <span className="text-[9px] font-mono text-slate-500 font-normal block">{formatDateTime(item.packing_at || item.updated_at) || '-'}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. STATUS CHECKER (Layout: Checked/Pending -> User ID -> Timestamp) */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <button
                              onClick={() => handleToggleStatus(item.id, 'status_qc_checker', item.status_qc_checker)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                                isCheckerDone
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isCheckerDone ? 'bg-amber-600' : 'bg-slate-400'}`} />
                              {isCheckerDone ? 'Checked' : 'Pending'}
                            </button>
                            {isCheckerDone && (
                              <div className="text-[10px] font-semibold text-slate-800 leading-tight mt-0.5">
                                <span className="block truncate max-w-[110px]">{item.checker_by || item.scanned_by || 'Staff Checker'}</span>
                                <span className="text-[9px] font-mono text-slate-500 font-normal block">{formatDateTime(item.checker_at || item.updated_at) || '-'}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 4. OUTBOUND (FOTO BUKTI OUTBOUND) */}
                        <td className="py-3.5 px-4 text-center">
                          {(() => {
                            const outboundImgUrl = item.outbound_url || item.bukti_outbound_url || (item.catatan?.startsWith('http') ? item.catatan : null);
                            const staffName = item.staff_outbound || item.outbound_by || item.scanned_by || 'Outbound';

                            if (uploadingId === `outbound-${item.id}`) {
                              return (
                                <div className="flex items-center justify-center gap-1 text-xs text-emerald-700 font-bold">
                                  <Clock className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                  <span>Uploading...</span>
                                </div>
                              );
                            }

                            if (outboundImgUrl) {
                              return (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <div className="relative group">
                                    <img
                                      src={outboundImgUrl}
                                      alt="Foto Outbound"
                                      onClick={() => onOpenImageModal(outboundImgUrl, `Foto Outbound - ${item.box_code || item.tracking_id}`)}
                                      className="w-10 h-10 object-cover rounded-lg border-2 border-emerald-500 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                                    />
                                    <label
                                      className="absolute -bottom-1 -right-1 bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded-full cursor-pointer shadow-xs border border-white"
                                      title="Ganti Foto Outbound"
                                    >
                                      <Camera className="w-2.5 h-2.5" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={(e) => handleOutboundCameraCapture(e, item.id, item.box_code || item.tracking_id)}
                                        className="hidden"
                                      />
                                    </label>
                                  </div>
                                  <div className="text-[10px] font-semibold text-slate-800 leading-tight">
                                    <span className="block truncate max-w-[110px]">{staffName}</span>
                                    <span className="text-[9px] font-mono text-slate-500 font-normal block">{formatDateTime(item.outbound_at || item.updated_at) || '-'}</span>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <label className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 flex items-center justify-center gap-1.5 shadow-2xs mx-auto active:scale-95">
                                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Outbound</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => handleOutboundCameraCapture(e, item.id, item.box_code || item.tracking_id)}
                                  className="hidden"
                                />
                              </label>
                            );
                          })()}
                        </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
            </tbody>
          </table>

          {/* BOTTOM PAGINATION BAR */}
          <div className="px-6 py-3 bg-[#F8FAFC] border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-semibold text-slate-600">
            <span>Showing 1-{filteredList.length} of {sourceList.length} items</span>
            <div className="flex items-center gap-2">
              <span>Page 1 of 1</span>
              <button className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-black hover:bg-slate-100 transition-all cursor-pointer">Previous</button>
              <button className="px-3 py-1 bg-white border border-slate-300 rounded-lg font-bold text-black hover:bg-slate-100 transition-all cursor-pointer">Next</button>
            </div>
          </div>
        </div>
      </div>

      {isSheetSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-neutral-700">
              <div>
                <h3 className="font-bold text-sm uppercase flex items-center gap-2">📑 Pilih Sheet yang Akan Di-Import</h3>
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
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
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
              <h3 className="font-bold text-sm uppercase flex items-center gap-2">🌐 Tarik Data Google Spreadsheet</h3>
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
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
              >
                {isImporting ? '⏳ Mengambil Sheet...' : '⚡ Lanjut Pilih Sheet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCAN QR CODE OUTBOUND */}
      {showOutboundScanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm uppercase">Scan QR Code Outbound</h3>
              </div>
              <button
                onClick={() => {
                  setShowOutboundScanModal(false);
                  setMatchedOutboundItem(null);
                  setOutboundScanMsg('');
                  setOutboundScannedCode('');
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-700 flex items-center justify-center font-bold hover:bg-rose-500 hover:text-white transition-all cursor-pointer text-stone-500"
              >
                ✕
              </button>
            </div>

            {!matchedOutboundItem ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessOutboundScan(outboundScannedCode);
                }}
                className="space-y-4 text-sm"
              >
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Arahkan Barcode Scanner / Kamera ke QR Code Label Box untuk mengambil foto Outbound.</span>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 opacity-80">Input / Scan Barcode QR Label Box:</label>
                  <input
                    type="text"
                    autoFocus
                    value={outboundScannedCode}
                    onChange={(e) => setOutboundScannedCode(e.target.value)}
                    placeholder="Scan QR Label / Input Box Code..."
                    className={`w-full p-3 rounded-2xl border font-mono text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Proses Scan QR Box</span>
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border-2 border-emerald-500 text-slate-900 dark:text-white space-y-1.5">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">📦 Data Box Terdeteksi</div>
                  <div className="text-base font-extrabold">{matchedOutboundItem.store_name}</div>
                  <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                    BOX: {matchedOutboundItem.box_code || '-'} | SPK: {matchedOutboundItem.no_spk}
                  </div>
                </div>

                <label className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 text-sm active:scale-95">
                  <Camera className="w-5 h-5" />
                  <span>Ambil / Upload Foto Outbound Now</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={async (e) => {
                      await handleOutboundCameraCapture(e, matchedOutboundItem.id, matchedOutboundItem.box_code || matchedOutboundItem.tracking_id);
                      setMatchedOutboundItem(null);
                      setShowOutboundScanModal(false);
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setMatchedOutboundItem(null)}
                  className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  🔄 Scan QR Box Lain
                </button>
              </div>
            )}

            {outboundScanMsg && (
              <div className={`mt-4 p-3 text-center text-xs font-bold rounded-2xl border ${
                outboundScanMsg.includes('✅')
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-rose-100 text-rose-900 border-rose-300'
              }`}>
                {outboundScanMsg}
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
                <h3 className="font-bold text-base uppercase">Kelola Foto Desain Toko</h3>
                <p className="text-xs text-stone-400 font-semibold">{editingRowItem.store_name} ({editingRowItem.box_code})</p>
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
                    <div className="font-bold text-sm text-red-500">{itm.code}</div>
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

      {/* PRINT CONTAINER A4 - Diposisikan di luar layar agar gambar tetap dimuat browser tanpa mengganggu UI */}
      <div className="print-area fixed top-0 left-0 -z-50 opacity-0 pointer-events-none print:static print:opacity-100 print:z-auto print:pointer-events-auto">
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
              page-break-after: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              margin-bottom: 6mm !important;
            }
            .label-page:last-child {
              page-break-after: auto !important;
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