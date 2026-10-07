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
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  FolderKanban,
  Box,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';

import PackingView from './packing/PackingView';

// Global memory cache untuk link gambar aktif di browser
if (!window.__ACTIVE_DESIGN_URLS__) {
  window.__ACTIVE_DESIGN_URLS__ = {};
}

export default function PackingPanel({ isDarkMode, spkList = [], handleUpdateField, onOpenImageModal, isPackingRole }) {
  if (isPackingRole) {
    return <PackingView isDarkMode={isDarkMode} onOpenImageModal={onOpenImageModal} />;
  }

  const [packingList, setPackingList] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState(null);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);
  const [isSuratJalanPrinting, setIsSuratJalanPrinting] = useState(false);
  const [suratJalanGroup, setSuratJalanGroup] = useState(null);
  const [openDetailCard, setOpenDetailCard] = useState(null);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  // Filter & Search States
  const [filterSource, setFilterSource] = useState('ALL'); // 'ALL', 'google_sheet', 'label_sj'
  const [filterDelivery, setFilterDelivery] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'IN_PROGRESS', 'COMPLETED'
  const [filterStage, setFilterStage] = useState('ALL'); // 'ALL', 'status_qc_label', 'status_qc_packing', 'status_qc_checker', 'status_deliver'
  const [filterProject, setFilterProject] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [printListOverride, setPrintListOverride] = useState(null);

  // Google Sheets Modal State
  const [isGSheetModalOpen, setIsGSheetModalOpen] = useState(false);
  const [gSheetUrlInput, setGSheetUrlInput] = useState('');

  // Custom Sheet Selector States
  const [isSheetSelectorOpen, setIsSheetSelectorOpen] = useState(false);
  const [pendingWorkbook, setPendingWorkbook] = useState(null);
  const [availableSheets, setAvailableSheets] = useState([]);
  const [selectedSheets, setSelectedSheets] = useState([]);

  // Desk Print Auto-Match States
  const [isDeskPrintModalOpen, setIsDeskPrintModalOpen] = useState(false);
  const [deskPrintFolders, setDeskPrintFolders] = useState([]);
  const [selectedDeskFolderId, setSelectedDeskFolderId] = useState('');

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
      .order('id', { ascending: false });

    if (!error && data) {
      if (data.length > 0) {
        const normalizedData = data.map(item => {
          const details = parseItems(item.items_detail).map((sub, idx) => {
            const itemCode = sub.code || '';
            const itemCore = extractCoreCode(itemCode);

            const activeUrl = sub.image_url ||
                             window.__ACTIVE_DESIGN_URLS__[itemCode] ||
                             window.__ACTIVE_DESIGN_URLS__[cleanKey(itemCode)] ||
                             (itemCore ? window.__ACTIVE_DESIGN_URLS__[itemCore] : '') ||
                             '';

            return { ...sub, image_url: activeUrl };
          });

          // Set status sesuai data DB, hormati nilai DONE jika di database sudah DONE (hasil scan)
          const hasPhoto = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url.length > 5;
          const statusPacking = item.status_qc_packing === 'DONE' || hasPhoto ? 'DONE' : 'PENDING';
          const statusChecker = item.status_qc_checker === 'DONE' ? 'DONE' : 'PENDING';

          return {
            ...item,
            status_qc_packing: statusPacking,
            status_qc_checker: statusChecker,
            items_detail: details
          };
        });
        setPackingList(normalizedData);
      } else {
        setPackingList([]);
      }
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

  const getCleanStoreName = (rawStore) => {
    if (!rawStore || rawStore === '-') return '-';
    const str = String(rawStore).trim();
    const commaParts = str.split(',');
    if (commaParts.length > 1 && commaParts[0].trim().length > 0) {
      return commaParts[0].trim();
    }
    const jlIdx = str.search(/\b(jl\.|jalan)\b/i);
    if (jlIdx > 0) {
      return str.slice(0, jlIdx).replace(/[,.\s]+$/, '').trim();
    }
    return str;
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
    const targetItem = packingList.find(i => i.id === id);

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

        // Auto-Detect Header Column Positions from rows 0..5
        let colMap = {
          storeNo: -1,
          prCode: -1,
          boxCode: -1,
          storeId: -1,
          company: -1,
          storeName: -1,
          noPo: -1,
          spkWpp: -1,
          delivery: -1,
          region: -1,
          qrAddress: -1,
          qr: -1
        };

        for (let r = 0; r < Math.min(6, data.length); r++) {
          const row = data[r] || [];
          row.forEach((val, c) => {
            const h = String(val || '').toUpperCase().trim();
            if (h.includes('NO. STORE') || h.includes('STORE NO') || h === 'NO STORE') colMap.storeNo = c;
            else if (h.includes('PR. KODE') || h.includes('PR KODE') || h === 'PR CODE') colMap.prCode = c;
            else if (h.includes('NO. URUT') || h.includes('NO URUT') || h === 'URUT') colMap.boxCode = c;
            else if (h.includes('STORE ID') || h === 'ID STORE') colMap.storeId = c;
            else if (h.includes('COMPANY') || h.includes('CLIENT PT') || h === 'PT') colMap.company = c;
            else if (h.includes('STORE NAME') || h.includes('NAMA TOKO')) colMap.storeName = c;
            else if (h.includes('NO. PO') || h.includes('NO PO') || h === 'PO') colMap.noPo = c;
            else if (h.includes('SPK/WPP') || h.includes('SPK WPP') || h.includes('SPK')) colMap.spkWpp = c;
            else if (h.includes('DELIVERY') || h.includes('PENGIRIMAN')) colMap.delivery = c;
            else if (h.includes('REGION') || h.includes('PROVINSI') || h.includes('WILAYAH')) colMap.region = c;
            else if (h.includes('QR ADDRES') || h.includes('QR ADDRESS')) colMap.qrAddress = c;
            else if (h === 'QR' || h === 'QR CODE') colMap.qr = c;
          });
        }

        // Apply fallback indices if header names were not found explicitly
        const idxStoreNo = colMap.storeNo !== -1 ? colMap.storeNo : 0;
        const idxPrCode = colMap.prCode !== -1 ? colMap.prCode : 1;
        const idxBoxCode = colMap.boxCode !== -1 ? colMap.boxCode : 2;
        const idxStoreId = colMap.storeId !== -1 ? colMap.storeId : 3;
        const idxCompany = colMap.company !== -1 ? colMap.company : 4;
        const idxStoreName = colMap.storeName !== -1 ? colMap.storeName : 5;
        const idxNoPo = colMap.noPo !== -1 ? colMap.noPo : 6;
        const idxSpkWpp = colMap.spkWpp !== -1 ? colMap.spkWpp : 7;
        const idxDelivery = colMap.delivery !== -1 ? colMap.delivery : 8;
        const idxRegion = colMap.region !== -1 ? colMap.region : 9;
        const idxQrAddress = colMap.qrAddress !== -1 ? colMap.qrAddress : 10;
        const idxQr = colMap.qr !== -1 ? colMap.qr : 11;

        // Item catalog starts after QR column (col 12 by default if QR column exists, or after last metadata column)
        const itemStartColIdx = Math.max(
          12,
          idxQr !== -1 ? idxQr + 1 : (idxQrAddress !== -1 ? idxQrAddress + 1 : 12)
        );

        // Smart Header Row Detection for Item Codes
        let codeRowIdx = 0;
        for (let r = 0; r < Math.min(6, data.length); r++) {
          const row = data[r] || [];
          const hasCodes = row.some((val, c) => c >= itemStartColIdx && val && String(val).trim() !== '');
          if (hasCodes) {
            codeRowIdx = r;
            break;
          }
        }

        const rowCodes = data[codeRowIdx] || [];
        const rowMaterials = data[codeRowIdx + 1] || [];
        const rowSizes = data[codeRowIdx + 2] || [];

        let catalogItems = [];
        for (let colIdx = itemStartColIdx; colIdx < Math.max(rowCodes.length, rowMaterials.length, rowSizes.length); colIdx++) {
          const rawCode = rowCodes[colIdx] ? String(rowCodes[colIdx]).trim() : '';
          const rawMat = rowMaterials[colIdx] ? String(rowMaterials[colIdx]).trim() : '';
          const rawSize = rowSizes[colIdx] ? String(rowSizes[colIdx]).trim() : '';

          if (rawCode && !rawCode.toUpperCase().includes('QR') && rawCode !== '') {
            catalogItems.push({
              colIndex: colIdx,
              code: rawCode,
              desc: rawCode,
              material: rawMat || 'PVC',
              size: rawSize || '-'
            });
          }
        }

        // Smart Store Row Scan (start scanning from r = 1)
        for (let r = 1; r < data.length; r++) {
          const row = data[r];
          if (!row) continue;

          const rawStoreNo = String(row[idxStoreNo] || '').trim();
          if (!rawStoreNo || rawStoreNo.toUpperCase().includes('STORE') || rawStoreNo.toUpperCase().includes('NOMOR') || rawStoreNo.toUpperCase().includes('NO.')) continue;

          const storeNo = rawStoreNo;
          const prCode = row[idxPrCode] ? String(row[idxPrCode]).trim() : '';
          const boxCode = row[idxBoxCode] ? String(row[idxBoxCode]).trim() : `B${r}`;
          const storeId = row[idxStoreId] ? String(row[idxStoreId]).trim() : '';
          const clientPt = row[idxCompany] ? String(row[idxCompany]).trim() : 'PT. Sukses Prima Jayaindo';
          const storeName = row[idxStoreName] ? String(row[idxStoreName]).trim() : '';
          const noPo = row[idxNoPo] ? String(row[idxNoPo]).trim() : '';
          const spkWpp = row[idxSpkWpp] ? String(row[idxSpkWpp]).trim() : '';
          const deliveryType = row[idxDelivery] ? String(row[idxDelivery]).trim() : 'DALAM KOTA';
          const regionStr = row[idxRegion] ? String(row[idxRegion]).trim() : '-';

          // READ / GENERATE QR ADDRESS (Format: STORENO_BOXCODE_STOREID_STORENAME)
          const explicitQrAddress = row[idxQrAddress] ? String(row[idxQrAddress]).trim() : '';
          const qrAddress = explicitQrAddress || `${storeNo}_${boxCode}_${storeId}_${storeName}`;
          const trackingId = `${prCode || 'PR'}-${boxCode}-${storeId || storeNo}`;

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

          // Extract area code from boxCode or prCode
          const areaCodeMatch = boxCode.match(/^[A-Za-z0-9]+/);
          const areaCode = areaCodeMatch ? areaCodeMatch[0] : 'A1';

          parsedRecords.push({
            tracking_id: trackingId,
            no_spk: spkWpp,
            client_pt: clientPt,
            promo_title: noPo,
            store_name: storeName,
            recipient_name: `Store #${storeNo} (${storeId})`,
            total_qty: totalQty,
            box_code: boxCode,
            area_code: areaCode,
            delivery_type: deliveryType,
            region: regionStr,
            qr_address: qrAddress,
            source: 'google_sheet',
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

      let { error } = await supabase
        .from('packing_tracking')
        .upsert(parsedRecords, { onConflict: 'tracking_id' });

      // Smart Fallback: Jika kolom 'region' belum ada di tabel Supabase, otomatis strip kolom 'region' dan retry
      if (error && error.message && error.message.includes('region')) {
        const fallbackRecords = parsedRecords.map(({ region, ...rest }) => rest);
        const retryRes = await supabase
          .from('packing_tracking')
          .upsert(fallbackRecords, { onConflict: 'tracking_id' });
        error = retryRes.error;
      }

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

  const handleLocalExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target.result;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        openSheetSelectorModal(wb);
      } catch (err) {
        alert('❌ Gagal membaca file Excel: ' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      alert('❌ Gagal membaca file Excel.');
      setIsImporting(false);
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
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

  // Auto-Match Gambar Desain dari Desk Print
  const handleOpenDeskPrintModal = () => {
    let localFolders = [];
    try {
      const data = localStorage.getItem('desk_print_folders');
      if (data) localFolders = JSON.parse(data);
    } catch (e) {
      console.error(e);
    }
    if (window.__DESK_PRINT_FOLDERS__ && window.__DESK_PRINT_FOLDERS__.length > 0) {
      localFolders = window.__DESK_PRINT_FOLDERS__;
    }
    setDeskPrintFolders(localFolders);
    if (localFolders.length > 0) {
      setSelectedDeskFolderId(localFolders[0].id);
    }
    setIsDeskPrintModalOpen(true);
  };

  const handleExecuteAutoMatchDeskPrint = async () => {
    if (!selectedDeskFolderId) return alert('⚠️ Silakan pilih Folder Project terlebih dahulu.');
    const targetFolder = deskPrintFolders.find(f => f.id === selectedDeskFolderId);
    if (!targetFolder || !targetFolder.images || targetFolder.images.length === 0) {
      return alert('⚠️ Folder Project yang dipilih belum memiliki gambar desain.');
    }

    if (packingList.length === 0) {
      return alert('⚠️ Silakan Import Data Toko di Packing Station terlebih dahulu!');
    }

    setIsUploadingImages(true);
    let matchedCount = 0;

    const folderImageMap = {};
    targetFolder.images.forEach(img => {
      if (img.item_code) folderImageMap[cleanKey(img.item_code)] = img.image_url;
      if (img.core_code) folderImageMap[img.core_code] = img.image_url;
    });

    const updatedList = await Promise.all(
      packingList.map(async (row) => {
        let isRowChanged = false;
        const details = parseItems(row.items_detail);

        const updatedDetails = details.map((sub, idx) => {
          const itemCode = sub.code || '';
          const itemCore = extractCoreCode(itemCode);
          const matchedUrl = folderImageMap[cleanKey(itemCode)] || folderImageMap[itemCore] || folderImageMap[idx];

          if (matchedUrl) {
            matchedCount++;
            isRowChanged = true;
            return { ...sub, image_url: matchedUrl };
          }
          return sub;
        });

        if (isRowChanged) {
          try {
            await supabase
              .from('packing_tracking')
              .update({ items_detail: JSON.stringify(updatedDetails) })
              .eq('id', row.id);
          } catch (e) {
            console.error(e);
          }
          return { ...row, items_detail: updatedDetails };
        }
        return row;
      })
    );

    setPackingList(updatedList);
    setIsUploadingImages(false);
    setIsDeskPrintModalOpen(false);
    alert(`✅ Berhasil mencocokkan & memasang ${matchedCount} gambar desain dari Desk Print (${targetFolder.name})!`);
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
    setPrintListOverride(null);

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

  const handlePrintProjectLabels = (projectGroupKey) => {
    const projectItems = sourceList.filter(item => getProjectGroupKey(item.promo_title).toLowerCase() === projectGroupKey.toLowerCase());
    if (projectItems.length === 0) return alert(`⚠️ Tidak ada data label untuk project "${projectGroupKey}".`);

    setIsSuratJalanPrinting(false);
    setIsBatchPrinting(true);
    setSelectedLabelItem(null);
    setPrintListOverride(projectItems);

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

  const handleDeleteProject = async (projectGroupKey) => {
    if (!confirm(`Hapus seluruh data untuk project "${projectGroupKey}" dari database?`)) return;
    const projectItems = sourceList.filter(item => getProjectGroupKey(item.promo_title).toLowerCase() === projectGroupKey.toLowerCase());
    const idsToDelete = projectItems.map(i => i.id);
    if (idsToDelete.length === 0) return;
    const { error } = await supabase.from('packing_tracking').delete().in('id', idsToDelete);
    if (!error) {
      await fetchPackingData();
      alert(`✅ Project "${projectGroupKey}" berhasil dihapus.`);
    } else {
      alert('Gagal menghapus project: ' + error.message);
    }
  };

  const handleBatchPrintAll = () => {
    const listToFilter = selectedRowIds.length > 0
      ? filteredList.filter(item => selectedRowIds.includes(item.id))
      : filteredList;
    const listToPrint = listToFilter.filter(item => item.source === 'google_sheet');

    if (listToPrint.length === 0) {
      return alert('⚠️ Fitur Print Label A4 non-aktif untuk data dari Tab Cetak Label & SJ (sudah dicetak di Tab Label).');
    }
    setIsSuratJalanPrinting(false);
    setIsBatchPrinting(true);
    setSelectedLabelItem(null);
    setPrintListOverride(listToPrint);

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
    const targetList = itemsToPrint || filteredList;
    const validItems = targetList.filter(item => item.source === 'google_sheet');

    if (validItems.length === 0) {
      return alert('⚠️ Fitur Surat Jalan non-aktif untuk data dari Tab Cetak Label & SJ (Surat Jalan sudah dibuat di Tab Label).');
    }
    setIsBatchPrinting(false);
    setSelectedLabelItem(null);
    setPrintListOverride(null);
    setIsSuratJalanPrinting(true);
    setSuratJalanGroup(validItems);

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
          const MAX_DIM = 2560;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          // Smooth High Quality Interpolation Filter
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.98);
        };
      };
    });
  };

  const processImageForUpload = async (file) => {
    if (file.size <= 15 * 1024 * 1024) {
      return file;
    }
    return await compressImage(file);
  };

  const handleCameraCapture = async (e, rowId, trackingId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(rowId);
    try {
      const uploadBlob = await processImageForUpload(file);
      const cleanTrackingId = trackingId ? String(trackingId).replace(/[^a-zA-Z0-9-_]/g, '_') : 'item';
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `bukti_paking_${cleanTrackingId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('surat-jalan')
        .upload(fileName, uploadBlob, { contentType: file.type || 'image/jpeg', upsert: true });

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

      alert('✅ Bukti paking Ultra HD berhasil diunggah!');
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
      const uploadBlob = await processImageForUpload(file);
      const cleanCode = boxCode ? String(boxCode).replace(/[^a-zA-Z0-9-_]/g, '_') : 'box';
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `outbound_${cleanCode}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('surat-jalan')
        .upload(fileName, uploadBlob, { contentType: file.type || 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const nowIso = new Date().toISOString();
      const staffName = 'Staff Outbound';

      // Update di Supabase packing_tracking (dukung kolom outbound_url & staff_outbound dengan fallback)
      let { error: updateError } = await supabase
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
        console.warn('Extended outbound columns missing in Supabase, using fallback update:', updateError);
        const { error: fallbackError } = await supabase
          .from('packing_tracking')
          .update({
            catatan: publicUrl,
            updated_at: nowIso
          })
          .eq('id', rowId);
        if (fallbackError) console.error('Fallback update error:', fallbackError);
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

  const generateViewerUrl = (rawUrl, title, item) => {
    if (!rawUrl || rawUrl === 'No Foto' || rawUrl === '-') return '-';
    if (rawUrl.startsWith('data:')) {
      return '[Base64 Image Data]';
    }
    if (rawUrl.length > 500) {
      return rawUrl.slice(0, 500);
    }
    return rawUrl;
  };

  const handleDownloadPackingReport = async () => {
    try {
      const dataToExport = filteredList.length > 0 ? filteredList : packingList;
      if (dataToExport.length === 0) return alert('⚠️ Belum ada data paking untuk di-export.');

      const formattedData = dataToExport.map((item, index) => {
        const details = parseItems(item.items_detail);
        const designUrls = details
          .map(sub => sub.image_url || sub.visual_image)
          .filter(url => url && typeof url === 'string' && url.trim() !== '');
        const rawDesignUrl = Array.from(new Set(designUrls))[0] || '';

        const rawPakingUrl = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' ? item.bukti_paking_url : '';
        const rawOutboundUrl = item.bukti_outbound_url || item.outbound_url || (item.catatan?.startsWith('http') ? item.catatan : '');

        return {
          No: index + 1,
          'Box Code': item.box_code || '-',
          'Tracking ID': item.tracking_id || '-',
          'No. SPK': item.no_spk || '-',
          'Client / PT': item.client_pt || '-',
          'Promo / Project': item.promo_title || '-',
          'Nama Toko / Alamat': item.store_name || '-',
          Penerima: item.recipient_name || '-',
          'Total Qty': item.total_qty || 0,
          'Tipe Pengiriman': item.delivery_type || '-',
          'Status QC Label': item.status_qc_label || 'PENDING',
          'Status QC Packing': item.status_qc_packing || 'PENDING',
          'Status QC Checker': item.status_qc_checker || 'PENDING',
          'Status Deliver': item.status_deliver || 'PENDING',
          '📸 Link Foto Bukti Paking': generateViewerUrl(rawPakingUrl, 'Foto Bukti Paking', item),
          '🚚 Link Foto Outbound': generateViewerUrl(rawOutboundUrl, 'Foto Outbound', item),
          '🎨 Link Foto Desain / Visual': generateViewerUrl(rawDesignUrl, 'Foto Desain Visual', item),
          'Terakhir Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);

      // Otomatis ubah sel berisi link HTTP/HTTPS menjadi hyperlink interaktif di Excel / Google Sheets
      if (worksheet['!ref']) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];
            if (cell && typeof cell.v === 'string') {
              if (cell.v.length > 32767) {
                cell.v = cell.v.slice(0, 32000) + '...';
              }
              if (cell.v.startsWith('http') && cell.v.length <= 1000) {
                cell.l = { Target: cell.v, Tooltip: 'Klik untuk Buka / Lihat Foto' };
              }
            }
          }
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report_Paking');

      const todayStr = new Date().toISOString().slice(0, 10);
      let fileNameStr = `Report_Paking_Semua_${todayStr}.xlsx`;

      if (filterProject !== 'ALL') {
        const cleanProj = String(filterProject).replace(/[/\\?%*:|"<>]/g, '_').trim();
        fileNameStr = `Report_Paking_${cleanProj}_${todayStr}.xlsx`;
      }

      XLSX.writeFile(workbook, fileNameStr);
      alert(`✅ Report Excel Paking (${fileNameStr}) berhasil di-download!`);
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

  const handleSyncFromSpkData = async (isManual = false) => {
    try {
      let rowsToSync = [];
      const { data: spkRows, error } = await supabase.from('spk_data').select('*').order('id', { ascending: true });
      if (!error && spkRows && spkRows.length > 0) {
        rowsToSync = spkRows;
      } else if (spkList && spkList.length > 0) {
        rowsToSync = spkList;
      }

      if (rowsToSync.length === 0) {
        if (isManual) {
          alert('⚠️ Tidak ada data SPK untuk disinkronkan.');
        }
        return;
      }

      const payloads = rowsToSync.map((spk) => {
        const trackingCode = spk.tracking_id || `${spk.no_spk || 'SPK'}-${spk.id || Date.now()}`;
        return {
          tracking_id: trackingCode,
          no_spk: spk.no_spk || `SPK-${spk.id}`,
          client_pt: spk.client_pt || spk.client_name || spk.client || 'Wellen Customer',
          promo_title: spk.promo_title || spk.project_name || spk.item_name || 'Project Utama',
          store_name: spk.store_name || spk.branch_name || spk.destination || 'Store Utama',
          recipient_name: spk.recipient_name || spk.pic_name || 'Penerima',
          total_qty: Number(spk.qty_order || spk.total_qty || spk.qty_finish || 100),
          box_code: spk.box_code || 'WL-01',
          delivery_type: spk.delivery_type || 'DALAM KOTA',
          status_qc_label: spk.status_qc_label || 'PENDING',
          status_qc_packing: spk.status_qc_packing || 'PENDING',
          status_qc_checker: spk.status_qc_checker || 'PENDING',
          status_deliver: spk.status_deliver || 'PENDING',
          items_detail: spk.items_detail || [{
            code: spk.no_spk || 'ITEM-01',
            desc: spk.promo_title || spk.project_name || 'Item Pesanan',
            qty: Number(spk.qty_order || spk.total_qty || 100)
          }],
          updated_at: new Date().toISOString()
        };
      });

      await supabase.from('packing_tracking').upsert(payloads, { onConflict: 'tracking_id' });
      await fetchPackingData();
      if (isManual) {
        alert(`✅ Berhasil memulihkan & menyinkronkan ${payloads.length} data paking!`);
      }
    } catch (err) {
      if (isManual) {
        alert('❌ Gagal sinkronisasi data: ' + err.message);
      }
    }
  };

  const sourceList = packingList.filter(item => {
    const hasOutbound = (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' && item.bukti_paking_url.length > 5) &&
                        ((item.bukti_outbound_url && item.bukti_outbound_url !== 'No Foto' && item.bukti_outbound_url !== '-' && item.bukti_outbound_url.length > 5) ||
                         item.outbound_url ||
                         item.status_deliver === 'DONE');
    return !hasOutbound;
  });

  const completedBoxCount = sourceList.filter(item => item.status_qc_packing === 'DONE' || item.status_qc_checker === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto')).length;
  const pendingBoxCount = sourceList.length - completedBoxCount;

  // Filter list by status & delivery first so uniqueProjects only shows projects matching current status (e.g. Done)
  const statusFilteredList = sourceList.filter((item) => {
    const matchDelivery = filterDelivery === 'ALL' || item.delivery_type === filterDelivery;
    const matchSource = filterSource === 'ALL' || (filterSource === 'google_sheet' ? item.source === 'google_sheet' : item.source !== 'google_sheet');
    const isDone = item.status_qc_packing === 'DONE' || item.status_qc_checker === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto');
    const matchStatus = filterStatus === 'ALL' || (filterStatus === 'COMPLETED' ? isDone : !isDone);

    let matchStage = true;
    if (filterStage !== 'ALL') {
      const val = item[filterStage];
      const isStageDone = val === 'DONE' || val === 'CHECKED' || (filterStage === 'status_qc_packing' && (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto'));
      matchStage = isStageDone;
    }

    return matchDelivery && matchSource && matchStatus && matchStage;
  });

  const getProjectGroupKey = (promoTitle) => {
    if (!promoTitle) return '-';
    let str = String(promoTitle).trim();
    str = str.replace(/^NO\s*PO\s*[:\-]?\s*\d+\s*/i, '');
    str = str.replace(/^\d+\s+/, '');
    return str.trim();
  };

  const uniqueProjects = Array.from(
    new Set(
      statusFilteredList
        .map(item => getProjectGroupKey(item.promo_title))
        .filter(str => str !== '-' && str !== '')
    )
  ).sort((a, b) => a.localeCompare(b));

  const sortedStatusList = [...statusFilteredList].sort((a, b) => {
    const projA = getProjectGroupKey(a.promo_title).toLowerCase();
    const projB = getProjectGroupKey(b.promo_title).toLowerCase();
    if (projA !== projB) {
      return sortOrder === 'asc' ? projA.localeCompare(projB) : projB.localeCompare(projA);
    }
    const storeA = (a.store_name || '').toLowerCase();
    const storeB = (b.store_name || '').toLowerCase();
    return sortOrder === 'asc' ? storeA.localeCompare(storeB) : storeB.localeCompare(storeA);
  });

  const filteredList = sortedStatusList.filter((item) => {
    const matchProject = filterProject === 'ALL' || getProjectGroupKey(item.promo_title).toLowerCase() === filterProject.trim().toLowerCase();

    const matchSearch =
      searchTerm === '' ||
      item.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.no_spk?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.promo_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.box_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getProjectGroupKey(item.promo_title).toLowerCase().includes(searchTerm.toLowerCase());

    return matchProject && matchSearch;
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
              <div style={{ height: '48mm', display: 'grid', gridTemplateColumns: '32mm 1fr', borderBottom: '3px solid #000', boxSizing: 'border-box' }}>
                {/* Left Section: Area / Box Code (e.g. A77) & QR Code */}
                <div style={{ borderRight: '2px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ height: '14mm', borderBottom: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: '900', color: '#dc2626', lineHeight: '1' }}>
                    {item.area_code && item.area_code !== 'Q1' ? item.area_code : (item.box_code || 'B1')}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                    <QRCodeSVG value={item.source === 'google_sheet' ? (item.qr_address || item.tracking_id) : `https://web-track-phi-gilt.vercel.app/?scan=${item.tracking_id}`} size={92} />
                  </div>
                </div>

                {/* Right Section: Kop Info Grid */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Row 1: Client PT */}
                  <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '18px', borderBottom: '1px solid #000', padding: '3px 0', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.client_pt || 'PT. Sukses Prima Jayaindo'}
                  </div>

                  {/* Row 2: NO TOKO | LUAR KOTA / DALAM KOTA | REGION */}
                  <div style={{ display: 'grid', gridTemplateColumns: '25mm 4mm 16mm 1fr 1.2fr', fontSize: '13px', height: '8.5mm', alignItems: 'stretch', borderBottom: '1px solid #000' }}>
                    <div style={{ paddingLeft: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #000' }}>NO TOKO</div>
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000' }}>:</div>
                    <div style={{ fontWeight: '900', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000' }}>
                      {item.recipient_name?.match(/\d+/)?.[0] || '-'}
                    </div>
                    <div style={{ fontWeight: '900', color: item.delivery_type === 'DALAM KOTA' ? '#000' : '#fff', background: item.delivery_type === 'DALAM KOTA' ? '#facc15' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', borderRight: '1px solid #000' }}>
                      {item.delivery_type || 'DALAM KOTA'}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', textTransform: 'uppercase', padding: '0 4px' }}>
                      {item.region || item.area_region || '-'}
                    </div>
                  </div>

                  {/* Row 3: MINISO : STORE NAME (gb 1 - CENTERED & EQUAL HEIGHT) | STORE ID */}
                  <div style={{ display: 'grid', gridTemplateColumns: '25mm 4mm 1fr 28mm', fontSize: '13px', height: '8.5mm', alignItems: 'stretch', borderBottom: '1px solid #000' }}>
                    <div style={{ paddingLeft: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderRight: '1px solid #000' }}>MINISO</div>
                    <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #000' }}>:</div>
                    <div style={{ fontWeight: '900', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', borderRight: '1px solid #000' }}>
                      {item.store_name}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      {item.recipient_name?.match(/\((.*?)\)/)?.[1] || '-'}
                    </div>
                  </div>

                  {/* Bottom Area: NO PO & SPK on Left (EQUAL HEIGHTS), 1 OF 1 FULL HEIGHT on Right */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 28mm', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #000' }}>
                      {/* Row 4: NO PO (gb 2 - CENTERED & EQUAL HEIGHT) */}
                      <div style={{ height: '8.5mm', padding: '0 6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid #000', fontSize: '12px' }}>
                        {item.promo_title?.toUpperCase().startsWith('NO PO') ? item.promo_title : `NO PO : ${item.promo_title}`}
                      </div>
                      {/* Row 5: SPK / WPP (gb 3 - CENTERED & EQUAL HEIGHT TO NO PO) */}
                      <div style={{ height: '8.5mm', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', fontWeight: '900', fontSize: '13px', textAlign: 'center' }}>
                        {item.no_spk}
                      </div>
                    </div>

                    {/* 1 OF 1 FULL HEIGHT DOWN TO BOTTOM (CENTERED) */}
                    <div style={{ textAlign: 'center', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                      {currentPage} OF {totalPages}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chunk.map((sub, idx) => (
                  <div key={idx} style={{ minHeight: '45mm', height: 'auto', borderBottom: idx === chunk.length - 1 ? 'none' : '2px solid #000', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', pageBreakInside: 'avoid' }}>
                    <div style={{ minHeight: '8mm', height: 'auto', borderBottom: '1px solid #000', display: 'grid', gridTemplateColumns: '115mm 1fr', alignItems: 'center', background: sub.material?.toUpperCase().includes('WPB') ? '#e9d5ff' : '#bfdbfe', color: '#000', fontWeight: '900', boxSizing: 'border-box' }}>
                      <div style={{ fontSize: sub.material?.toUpperCase().includes('WPB') ? '18px' : '13px', fontWeight: 'bold', padding: '3px 10px', lineHeight: '1.1' }}>{sub.material || (sub.code ? 'PVC' : '')}</div>
                      <div style={{ textAlign: 'center', fontSize: '15px', padding: '0 5px' }}>{sub.size && sub.size !== '-' ? `Ukuran : ${sub.size}` : 'Ukuran : -'}</div>
                    </div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '80mm 35mm 1fr', alignItems: 'stretch', minHeight: '37mm' }}>
                      <div style={{ borderRight: '1px solid #000', padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', wordBreak: 'break-word', overflowWrap: 'break-word', overflow: 'hidden' }}>
                        {(() => {
                          const len = (sub.code || '').trim().length;
                          let fSize = '44px';
                          if (len > 35) fSize = '18px';
                          else if (len > 25) fSize = '22px';
                          else if (len > 15) fSize = '28px';
                          else if (len > 8) fSize = '34px';

                          return (
                            <div style={{ fontSize: fSize, fontWeight: '900', color: '#dc2626', letterSpacing: '-0.5px', lineHeight: '1.08', wordBreak: 'break-word' }}>
                              {sub.code || ''}
                            </div>
                          );
                        })()}
                        {sub.desc && sub.desc.trim().toLowerCase() !== (sub.code || '').trim().toLowerCase() && sub.desc.trim().toLowerCase() !== (sub.material || '').trim().toLowerCase() && (
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#000', lineHeight: '1.1', textTransform: 'uppercase', marginTop: '2px' }}>
                            {sub.desc}
                          </div>
                        )}
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
    <div className="space-y-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-black" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <h2 className="text-base font-bold uppercase tracking-wider text-black">
            Packing Control Panel
          </h2>
          <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-800 rounded-lg">
            Total Boxes: {totalSpk}
          </span>
        </div>

        {/* TOP METRIC CARDS WITH INTERACTIVE DETAILS BREAKDOWN (QC Stages) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">

          {/* Card 1: QC LABEL */}
          <div
            onClick={() => setFilterStage(filterStage === 'status_qc_label' ? 'ALL' : 'status_qc_label')}
            className={`bg-white p-5 rounded-2xl border shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${filterStage === 'status_qc_label' ? 'ring-2 ring-indigo-600 border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-400'}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Box className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">QC LABEL</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'qc_label' ? null : 'qc_label'); }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  Details {openDetailCard === 'qc_label' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {packingList.filter(s => s.status_qc_label === 'DONE' || (s.status_qc_label && String(s.status_qc_label).includes('DONE'))).length} <span className="text-xs font-medium text-slate-500">/ {totalSpk}</span>
              </div>
            </div>

            {openDetailCard === 'qc_label' && (
              <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-20 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">QC LABEL BREAKDOWN</span>
                  <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Completed / Pending</span>
                      <span>{packingList.filter(s => s.status_qc_label === 'DONE' || (s.status_qc_label && String(s.status_qc_label).includes('DONE'))).length} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full" style={{ width: `${totalSpk > 0 ? (packingList.filter(s => s.status_qc_label === 'DONE' || (s.status_qc_label && String(s.status_qc_label).includes('DONE'))).length / totalSpk) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: QC PACKING */}
          <div
            onClick={() => setFilterStage(filterStage === 'status_qc_packing' ? 'ALL' : 'status_qc_packing')}
            className={`bg-white p-5 rounded-2xl border shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${filterStage === 'status_qc_packing' ? 'ring-2 ring-indigo-600 border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-400'}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">QC PACKING</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'qc_packing' ? null : 'qc_packing'); }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  Details {openDetailCard === 'qc_packing' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {packingList.filter(s => s.status_qc_packing === 'DONE' || (s.status_qc_packing && String(s.status_qc_packing).includes('DONE'))).length} <span className="text-xs font-medium text-slate-500">/ {totalSpk}</span>
              </div>
            </div>

            {openDetailCard === 'qc_packing' && (
              <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-20 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">QC PACKING BREAKDOWN</span>
                  <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Completed / Pending</span>
                      <span>{packingList.filter(s => s.status_qc_packing === 'DONE' || (s.status_qc_packing && String(s.status_qc_packing).includes('DONE'))).length} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${totalSpk > 0 ? (packingList.filter(s => s.status_qc_packing === 'DONE' || (s.status_qc_packing && String(s.status_qc_packing).includes('DONE'))).length / totalSpk) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: QC CHECKER */}
          <div
            onClick={() => setFilterStage(filterStage === 'status_qc_checker' ? 'ALL' : 'status_qc_checker')}
            className={`bg-white p-5 rounded-2xl border shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${filterStage === 'status_qc_checker' ? 'ring-2 ring-indigo-600 border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-400'}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">QC CHECKER</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'qc_checker' ? null : 'qc_checker'); }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  Details {openDetailCard === 'qc_checker' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {packingList.filter(s => s.status_qc_checker === 'DONE' || (s.status_qc_checker && String(s.status_qc_checker).includes('DONE'))).length} <span className="text-xs font-medium text-slate-500">/ {totalSpk}</span>
              </div>
            </div>

            {openDetailCard === 'qc_checker' && (
              <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-20 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">QC CHECKER BREAKDOWN</span>
                  <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Completed / Pending</span>
                      <span>{packingList.filter(s => s.status_qc_checker === 'DONE' || (s.status_qc_checker && String(s.status_qc_checker).includes('DONE'))).length} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-600 h-full rounded-full" style={{ width: `${totalSpk > 0 ? (packingList.filter(s => s.status_qc_checker === 'DONE' || (s.status_qc_checker && String(s.status_qc_checker).includes('DONE'))).length / totalSpk) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: DELIVER */}
          <div
            onClick={() => setFilterStage(filterStage === 'status_deliver' ? 'ALL' : 'status_deliver')}
            className={`bg-white p-5 rounded-2xl border shadow-2xs relative flex flex-col justify-between cursor-pointer transition-all ${filterStage === 'status_deliver' ? 'ring-2 ring-indigo-600 border-indigo-500 bg-indigo-50/40' : 'border-slate-200 hover:border-slate-400'}`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">DELIVER</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'deliver' ? null : 'deliver'); }}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  Details {openDetailCard === 'deliver' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {packingList.filter(s => s.status_deliver === 'DONE' || (s.status_deliver && String(s.status_deliver).includes('DONE'))).length} <span className="text-xs font-medium text-slate-500">/ {totalSpk}</span>
              </div>
            </div>

            {openDetailCard === 'deliver' && (
              <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-20 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">DELIVER BREAKDOWN</span>
                  <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Completed / Pending</span>
                      <span>{packingList.filter(s => s.status_deliver === 'DONE' || (s.status_deliver && String(s.status_deliver).includes('DONE'))).length} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-600 h-full rounded-full" style={{ width: `${totalSpk > 0 ? (packingList.filter(s => s.status_deliver === 'DONE' || (s.status_deliver && String(s.status_deliver).includes('DONE'))).length / totalSpk) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="p-6 rounded-2xl border bg-white border-slate-200 shadow-2xs">

        {/* MODERN FILTER & SEARCH TOOLBAR (Gambar 3) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 mb-5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">

            {/* Left side: Search & Dropdown Filters */}
            <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">

              {/* Actions Dropdown Button */}
              {!isPackingRole && (
                <div className="relative">
                  <button
                    onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                  >
                    <span>Actions</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {isActionsDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        Management Actions
                      </div>

                      <label className="w-full px-3 py-2 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        <span>{isImporting ? 'Mengimport...' : 'Import File Excel'}</span>
                        <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => { handleLocalExcelUpload(e); setIsActionsDropdownOpen(false); }} disabled={isImporting} />
                      </label>

                      <button
                        onClick={() => { setIsGSheetModalOpen(true); setIsActionsDropdownOpen(false); }}
                        className="w-full px-3 py-2 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                      >
                        <Globe className="w-4 h-4 text-slate-600" />
                        <span>Import Google Sheet</span>
                      </button>

                      <label className="w-full px-3 py-2 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer">
                        <Upload className="w-4 h-4 text-slate-600" />
                        <span>{isUploadingImages ? 'Memasang Foto...' : 'Upload Desain'}</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleBulkUploadDesignImages(e); setIsActionsDropdownOpen(false); }} disabled={isUploadingImages} />
                      </label>

                      <button
                        onClick={() => { handleOpenDeskPrintModal(); setIsActionsDropdownOpen(false); }}
                        className="w-full px-3 py-2 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                      >
                        <FolderKanban className="w-4 h-4 text-teal-600" />
                        <span>Auto-Match Desk Print</span>
                      </button>

                      <button
                        onClick={() => { handleSyncFromSpkData(true); setIsActionsDropdownOpen(false); }}
                        className="w-full px-3 py-2 hover:bg-amber-50 text-amber-900 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                      >
                        <RefreshCw className="w-4 h-4 text-amber-600" />
                        <span>Pulihkan Data Paking</span>
                      </button>

                      {(() => {
                        const isAllLabelSj = filteredList.length > 0 && filteredList.every(i => i.source !== 'google_sheet');
                        const isPrintDisabled = filterSource === 'label_sj' || isAllLabelSj;
                        return (
                          <>
                            <button
                              onClick={() => { handleBatchPrintAll(); setIsActionsDropdownOpen(false); }}
                              disabled={isPrintDisabled}
                              className={`w-full px-3 py-2 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 text-left ${isPrintDisabled ? 'opacity-40 cursor-not-allowed text-slate-400' : 'hover:bg-slate-50 text-slate-800 cursor-pointer'}`}
                            >
                              <Printer className="w-4 h-4 text-slate-600" />
                              <span>Print Label A4</span>
                            </button>

                            <button
                              onClick={() => { handlePrintSuratJalan(filteredList); setIsActionsDropdownOpen(false); }}
                              disabled={isPrintDisabled}
                              className={`w-full px-3 py-2 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 text-left ${isPrintDisabled ? 'opacity-40 cursor-not-allowed text-slate-400' : 'hover:bg-slate-50 text-slate-800 cursor-pointer'}`}
                            >
                              <FileText className="w-4 h-4 text-slate-600" />
                              <span>Surat Jalan</span>
                            </button>
                          </>
                        );
                      })()}

                      <button
                        onClick={() => { handleDownloadPackingReport(); setIsActionsDropdownOpen(false); }}
                        className="w-full px-3 py-2 hover:bg-slate-50 text-slate-800 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                      >
                        <Download className="w-4 h-4 text-slate-600" />
                        <span>Export Excel</span>
                      </button>

                      <div className="border-t border-slate-100 my-1"></div>

                      <button
                        onClick={() => { handleClearAllPackingData(); setIsActionsDropdownOpen(false); }}
                        className="w-full px-3 py-2 hover:bg-rose-50 text-rose-700 font-semibold rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                      >
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>Clear Data</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

        {/* MODERN FILTER & SEARCH TOOLBAR (Gambar 3) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 mb-5">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">

            {/* Left side: Search & Dropdown Filters */}
            <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">

              {/* Search Box */}
              <div className="relative flex-1 sm:flex-initial min-w-[260px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search SPK no., order, customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs transition-all"
                />
              </div>

              {/* Status Filter Dropdown */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4.5 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer min-w-[170px] sm:min-w-[200px]"
              >
                <option value="ALL">All statuses</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>

              {/* Design Status Dropdown */}
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="px-4.5 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer min-w-[170px] sm:min-w-[200px]"
              >
                <option value="ALL">All staff</option>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>

              {/* Origins Filter Dropdown */}
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-4.5 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer min-w-[170px] sm:min-w-[200px]"
              >
                <option value="ALL">All origins</option>
                <option value="google_sheet">Google Sheets</option>
                <option value="label_sj">Label & SJ</option>
              </select>

              {/* Branches / Delivery Filter Dropdown */}
              <select
                value={filterDelivery}
                onChange={(e) => setFilterDelivery(e.target.value)}
                className="px-4.5 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer min-w-[170px] sm:min-w-[200px]"
              >
                <option value="ALL">All City</option>
                <option value="DALAM KOTA">Dalam Kota</option>
                <option value="LUAR KOTA">Luar Kota</option>
              </select>

              {/* Machines / Project Filter Dropdown */}
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-4.5 py-2.5 sm:py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer min-w-[180px] sm:min-w-[220px]"
              >
                <option value="ALL">All Project</option>
                {uniqueProjects.map((projName, i) => (
                  <option key={i} value={projName}>{projName}</option>
                ))}
              </select>
            </div>



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
                    title="Select All Rows"
                  >
                    {selectedRowIds.length === filteredList.length && filteredList.length > 0 && (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    )}
                  </button>
                </th>
                <th className="py-4 pl-1 pr-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors cursor-pointer select-none"
                    title="Urutkan Ascending / Descending"
                  >
                    <span>BOX</span>
                    <span className="flex flex-col -space-y-1.5 text-slate-500">
                      <ChevronUp className={`w-3 h-3 ${sortOrder === 'asc' ? 'text-indigo-600 stroke-[3]' : 'opacity-40'}`} />
                      <ChevronDown className={`w-3 h-3 ${sortOrder === 'desc' ? 'text-indigo-600 stroke-[3]' : 'opacity-40'}`} />
                    </span>
                  </button>
                </th>
                <th className="py-4 px-4 font-semibold">STORE NAME / SPK</th>
                <th className="py-4 px-4 font-semibold">SHIPPING TYPE</th>
                <th className="py-4 px-4 text-center font-semibold">IMPORT DATE</th>
                <th className="py-4 px-4 text-center font-semibold">LABEL & DESIGN</th>
                <th className="py-4 px-4 text-center font-semibold">PHOTO PROOF</th>
                <th className="py-4 px-4 text-center font-semibold">PACKING STATUS</th>
                {!isPackingRole && (
                  <>
                    <th className="py-4 px-4 text-center font-semibold">CHECKER STATUS</th>
                    <th className="py-4 px-4 text-center font-semibold">OUTBOUND</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={isPackingRole ? "8" : "10"} className="p-8 text-center text-slate-500 font-semibold text-xs">
                    No matching box data found.
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const isPackingDone = item.status_qc_packing === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto');
                  const isCheckerDone = item.status_qc_checker === 'DONE';
                  const isRowComplete = isPackingDone || isCheckerDone;
                  const isSelected = selectedRowIds.includes(item.id);
                  const currentGroupKey = getProjectGroupKey(item.promo_title);
                  const prevGroupKey = idx > 0 ? getProjectGroupKey(filteredList[idx - 1]?.promo_title) : null;
                  const showProjectDivider = idx === 0 || currentGroupKey !== prevGroupKey;

                  return (
                    <React.Fragment key={item.id}>
                      {showProjectDivider && (
                        <tr className="bg-amber-100/90 border-y-2 border-amber-300">
                          <td colSpan={isPackingRole ? "8" : "10"} className="py-2 px-3 font-bold text-amber-950 text-[11px] tracking-wider uppercase shadow-2xs">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-black text-amber-950">{currentGroupKey}</span>
                                <span className="text-amber-800/40">|</span>
                                <div className="flex items-center gap-1.5 flex-wrap normal-case">
                                  {(() => {
                                    const projItems = sourceList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase());
                                    const totalProj = projItems.length;
                                    const labelDone = projItems.filter(p => p.status_qc_label === 'DONE' || String(p.status_qc_label).includes('DONE')).length;
                                    const packingDone = projItems.filter(p => p.status_qc_packing === 'DONE' || (p.bukti_paking_url && p.bukti_paking_url !== 'No Foto')).length;
                                    const checkerDone = projItems.filter(p => p.status_qc_checker === 'DONE').length;
                                    return (
                                      <>
                                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-300">
                                          Label: {labelDone}/{totalProj}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px] border border-emerald-300">
                                          Packing: {packingDone}/{totalProj}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
                                          Checker: {checkerDone}/{totalProj}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px] border border-purple-300">
                                          Total Box: {totalProj}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                              {!isPackingRole && (
                                <div className="flex items-center gap-1.5">
                                  {(() => {
                                    const projRowIds = sourceList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase()).map(p => p.id);
                                    const isAllProjSelected = projRowIds.length > 0 && projRowIds.every(id => selectedRowIds.includes(id));

                                    return (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isAllProjSelected) {
                                            setSelectedRowIds(prev => prev.filter(id => !projRowIds.includes(id)));
                                          } else {
                                            setSelectedRowIds(prev => Array.from(new Set([...prev, ...projRowIds])));
                                          }
                                        }}
                                        className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95 ${
                                          isAllProjSelected ? 'bg-emerald-600 text-white border border-emerald-600' : 'bg-transparent text-emerald-700 border border-emerald-700/40 hover:bg-emerald-100/60'
                                        }`}
                                        title={isAllProjSelected ? 'Batal pilih semua store di project ini' : 'Pilih semua store di project ini'}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    );
                                  })()}
                                  {(() => {
                                    const projectItems = sourceList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase());
                                    const isLabelSjProject = projectItems.length > 0 && projectItems.every(p => p.source !== 'google_sheet');
                                    if (!isLabelSjProject) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handlePrintProjectLabels(currentGroupKey)}
                                          className="p-1 bg-transparent text-emerald-800 border border-emerald-800/40 hover:bg-emerald-100/60 rounded-md transition-all cursor-pointer shadow-2xs flex items-center justify-center active:scale-95"
                                          title="Cetak Label"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                        </button>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProject(currentGroupKey)}
                                    className="p-1 bg-transparent text-rose-700 border border-rose-700/40 hover:bg-rose-600 hover:text-white rounded-md transition-all cursor-pointer shadow-2xs flex items-center justify-center active:scale-95"
                                    title="Hapus Project Ini"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
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

                        <td className="py-3.5 px-4 max-w-[280px]">
                          <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 flex-wrap tracking-tight">
                            <span>{getCleanStoreName(item.store_name)}</span>
                          </div>
                          {item.no_spk && (
                            <div className="text-xs font-mono text-slate-500 font-bold mt-0.5">{item.no_spk}</div>
                          )}
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

                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="font-mono text-xs text-slate-700 font-semibold block">
                            {formatDateTime(item.created_at || item.updated_at) || '-'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {item.source !== 'google_sheet' ? (
                            <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold">
                              Label SJ (Tab Label)
                            </span>
                          ) : (
                            <>
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
                            </>
                          )}
                        </td>

                        {/* 1. BUKTI FOTO (Layout: Foto -> User ID -> Timestamp) */}
                        <td className="py-3.5 px-4 text-center">
                          {item.bukti_paking_url ? (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img
                                src={item.bukti_paking_url}
                                alt="Bukti Paking"
                                onClick={() => onOpenImageModal(
                                  item.bukti_paking_url,
                                  `Bukti Paking - ${item.tracking_id || ''}`,
                                  item.destination || item.store_name || item.branch_name || '',
                                  item.project || item.project_name || '',
                                  item.no_spk || item.spk_no || item.tracking_id || ''
                                )}
                                className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl border-2 border-slate-300 cursor-pointer hover:scale-105 transition-transform shadow-sm"
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
                                      onClick={() => onOpenImageModal(
                                        outboundImgUrl,
                                        `Foto Outbound - ${item.box_code || item.tracking_id || ''}`,
                                        item.destination || item.store_name || item.branch_name || '',
                                        item.project || item.project_name || '',
                                        item.no_spk || item.spk_no || item.tracking_id || ''
                                      )}
                                      className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl border-2 border-emerald-500 cursor-pointer hover:scale-105 transition-transform shadow-sm"
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
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 font-bold'
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
                      className="w-4 h-4 rounded accent-orange-600 focus:ring-orange-500 cursor-pointer"
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
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isImporting ? 'Mengimport...' : `Import ${selectedSheets.length} Sheet`}
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

      {/* MODAL AUTO-MATCH DESK PRINT */}
      {isDeskPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-neutral-700">
              <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-teal-500" /> Auto-Match Gambar dari Desk Print
              </h3>
              <button
                onClick={() => setIsDeskPrintModalOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-stone-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 leading-relaxed">
              Pilih Folder Project dari <strong>Desk Print</strong>. Sistem akan mencocokkan kode item toko di Packing Station dengan gambar desain yang ada di folder tersebut secara otomatis:
            </p>

            {deskPrintFolders.length === 0 ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs text-center mb-4">
                Belum ada Folder Project di Desk Print. Silakan masuk ke menu <strong>Desk Print</strong> di sidebar untuk membuat folder dan mengunggah gambar terlebih dahulu.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
                {deskPrintFolders.map(folder => {
                  const isSelected = folder.id === selectedDeskFolderId;
                  const imgCount = (folder.images || []).length;
                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedDeskFolderId(folder.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400 font-bold'
                          : 'bg-stone-50 dark:bg-neutral-900 border-stone-200 dark:border-neutral-700 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold">{folder.name}</h4>
                        <p className="text-[11px] text-stone-400 font-normal">{imgCount} gambar desain tersimpan</p>
                      </div>
                      {isSelected && <span className="text-xs font-bold text-teal-500">✓ Terpilih</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeskPrintModalOpen(false)}
                className="px-4 py-2 bg-stone-200 dark:bg-neutral-700 text-stone-700 dark:text-stone-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteAutoMatchDeskPrint}
                disabled={deskPrintFolders.length === 0}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                ⚡ Pasang Gambar Desain
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
                    <label className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95">
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
          (printListOverride || (selectedRowIds.length > 0 ? filteredList.filter(item => selectedRowIds.includes(item.id)) : filteredList)).map((item) => <React.Fragment key={item.id}>{renderSingleLabelSheet(item)}</React.Fragment>)
        ) : (
          selectedLabelItem && renderSingleLabelSheet(selectedLabelItem)
        )}
      </div>
    </div>
  </div>
  </div>
  </div>
  );
}