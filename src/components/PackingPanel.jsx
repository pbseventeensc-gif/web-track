import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Layers,
  RefreshCw,
  FileSpreadsheet,
  FolderKanban,
  Box,
  CheckCircle2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Pin
} from 'lucide-react';

import PackingView from './packing/PackingView';
import CustomDropdown from './ui/CustomDropdown';
import { extractBaseProjectName, getProjectCategory, getItemMonthKey, getItemMonthLabel } from '../utils/projectGrouping';
import { useLanguage } from '../utils/i18n';

// Global memory cache untuk link gambar aktif di browser
if (!window.__ACTIVE_DESIGN_URLS__) {
  window.__ACTIVE_DESIGN_URLS__ = {};
}

export default function PackingPanel({
  isDarkMode,
  spkList = [],
  handleUpdateField,
  onOpenImageModal,
  isPackingRole,
  externalProjectFilter,
  onProjectFilterChange
}) {
  const { lang, t } = useLanguage();

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

  const actionsDropdownRef = useRef(null);
  const statCardsRef = useRef(null);

  useEffect(() => {
    if (!isActionsDropdownOpen && !openDetailCard) return;
    const handleClickOutside = (e) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target)) {
        setIsActionsDropdownOpen(false);
      }
      if (statCardsRef.current && !statCardsRef.current.contains(e.target)) {
        setOpenDetailCard(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isActionsDropdownOpen, openDetailCard]);

  // Filter & Search States
  const [filterSource, setFilterSource] = useState('ALL'); // 'ALL', 'google_sheet', 'label_sj'
  const [filterDelivery, setFilterDelivery] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'IN_PROGRESS', 'COMPLETED'
  const [filterStage, setFilterStage] = useState('ALL'); // 'ALL', 'status_qc_label', 'status_qc_packing', 'status_qc_checker', 'status_deliver'
  const [filterProject, setFilterProject] = useState(() => externalProjectFilter || 'ALL');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [printListOverride, setPrintListOverride] = useState(null);

  useEffect(() => {
    if (externalProjectFilter !== undefined && externalProjectFilter !== filterProject) {
      setFilterProject(externalProjectFilter);
    }
  }, [externalProjectFilter]);

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

  // Pinned Projects State (persisted to localStorage)
  const [pinnedProjects, setPinnedProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('pinned_packing_projects');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // PIN Kosongkan Seluruh Data States
  const [showClearPinModal, setShowClearPinModal] = useState(false);
  const [clearPinInput, setClearPinInput] = useState('');
  const [clearPinError, setClearPinError] = useState('');

  // Hapus Proyek dengan PIN States
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteProjectPinInput, setDeleteProjectPinInput] = useState('');
  const [deleteProjectPinError, setDeleteProjectPinError] = useState('');
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Outbound QR Scan States
  const [showOutboundScanModal, setShowOutboundScanModal] = useState(false);
  const [outboundScannedCode, setOutboundScannedCode] = useState('');
  const [matchedOutboundItem, setMatchedOutboundItem] = useState(null);
  const [outboundScanMsg, setOutboundScanMsg] = useState('');
  const [collapsedProjects, setCollapsedProjects] = useState({});

  const toggleProjectCollapse = (projKey) => {
    setCollapsedProjects(prev => ({ ...prev, [projKey]: !prev[projKey] }));
  };

  const stages = [
    { id: 'status_qc_label', label: 'QC LABEL', staff: 'Bagian: Staff Label', color: 'bg-blue-50/90 text-blue-700 border-blue-200/80' },
    { id: 'status_qc_packing', label: 'QC PACKING', staff: 'Bagian: Staff Paking', color: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80' },
    { id: 'status_qc_checker', label: 'QC CHECKER', staff: 'Bagian: Staff Checker', color: 'bg-amber-50/90 text-amber-800 border-amber-200/80' },
    { id: 'status_deliver', label: 'DELIVER', staff: 'Bagian: Staff Deliver', color: 'bg-purple-50/90 text-purple-700 border-purple-200/80' }
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

    let debounceTimer = null;
    const channel = supabase
      .channel('packing_tracking_realtime')
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
    try {
      let { data, error } = await supabase
        .from('packing_tracking')
        .select('*')
        .order('id', { ascending: false })
        .limit(300);

      if (error) console.error('Fetch packing_tracking error:', error);

      // Coba perbaikan / sinkronkan dari spk_data hanya jika packing_tracking kosong
      if (!error && (!data || data.length === 0)) {
        try {
          const { data: spkRows } = await supabase.from('spk_data').select('*').order('id', { ascending: true });
          if (spkRows && spkRows.length > 0) {
            const payloads = spkRows.map((spk, idx) => {
              const trackingCode = spk.tracking_id || `${spk.no_spk || 'SPK'}-${spk.id || Date.now() + idx}`;
              const promoVal = spk.project || spk.promo_title || spk.project_name || spk.item_name || spk.bahan || 'Project Utama';
              const clientVal = spk.client || spk.client_pt || spk.client_name || 'Pelanggan Utama';
              const storeVal = spk.store_code || spk.store_name || spk.branch_name || spk.destination || spk.client || 'Cabang Utama';
              const recipientVal = spk.recipient_name || spk.pic_name || spk.client || 'Penerima';
              const routeVal = spk.delivery_route || spk.delivery_type || 'DALAM KOTA';

              return {
                tracking_id: trackingCode,
                no_spk: spk.no_spk || `SPK-${spk.id || idx}`,
                client_pt: clientVal,
                promo_title: promoVal,
                store_name: storeVal,
                recipient_name: recipientVal,
                total_qty: Number(spk.qty_order || spk.total_qty || spk.qty_finish || 100),
                box_code: spk.box_code || 'WL-01',
                delivery_type: routeVal,
                status_qc_label: spk.status_qc_label || 'PENDING',
                status_qc_packing: spk.status_qc_packing || 'PENDING',
                status_qc_checker: spk.status_qc_checker || 'PENDING',
                status_deliver: spk.status_deliver || 'PENDING',
                items_detail: (Array.isArray(spk.items_detail) && spk.items_detail.length > 0)
                  ? spk.items_detail
                  : [{
                      code: spk.no_spk || 'ITEM-01',
                      desc: promoVal,
                      material: spk.bahan || '-',
                      size: spk.ukuran || '-',
                      qty: Number(spk.qty_order || spk.total_qty || 100)
                    }],
                updated_at: new Date().toISOString()
              };
            });

            await supabase.from('packing_tracking').upsert(payloads, { onConflict: 'tracking_id' });

            const { data: newData } = await supabase
              .from('packing_tracking')
              .select('*')
              .order('id', { ascending: false });

            if (newData) data = newData;
          }
        } catch (repairErr) {
          console.warn('Auto-repair sync skipped:', repairErr);
        }
      }

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

            const isValid = (val) => val && String(val).trim() !== '' && String(val).trim() !== '-' && String(val).trim() !== 'Project Utama' && String(val).trim() !== 'Proyek Utama';

            let cleanStore = isValid(item.store_name) ? String(item.store_name).trim() : '';
            if (!cleanStore) cleanStore = isValid(item.recipient_name) ? String(item.recipient_name).trim() : '';
            if (!cleanStore) cleanStore = isValid(item.client_pt) ? String(item.client_pt).trim() : '';
            if (!cleanStore) {
              for (const d of details) {
                if (isValid(d.delivery_address)) { cleanStore = String(d.delivery_address).trim(); break; }
                if (isValid(d.recipient_name)) { cleanStore = String(d.recipient_name).trim(); break; }
                if (isValid(d.brand)) { cleanStore = String(d.brand).trim(); break; }
              }
            }
            if (!cleanStore) cleanStore = '-';

            let cleanPromo = isValid(item.promo_title) ? String(item.promo_title).trim() : '';
            if (!cleanPromo) {
              for (const d of details) {
                if (isValid(d.desc)) { cleanPromo = String(d.desc).trim(); break; }
                if (isValid(d.brand)) { cleanPromo = String(d.brand).trim(); break; }
                if (isValid(d.po_number)) { cleanPromo = `PO: ${d.po_number}`.trim(); break; }
              }
            }
            if (!cleanPromo) cleanPromo = isValid(item.client_pt) ? String(item.client_pt).trim() : 'Proyek Utama';

            // Set status sesuai data DB, hormati nilai DONE jika di database sudah DONE (hasil scan)
            const hasPhoto = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url.length > 5;
            const statusPacking = item.status_qc_packing === 'DONE' || hasPhoto ? 'DONE' : 'PENDING';
            const statusChecker = item.status_qc_checker === 'DONE' ? 'DONE' : 'PENDING';

            return {
              ...item,
              store_name: cleanStore,
              promo_title: cleanPromo,
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
    } catch (err) {
      console.error('fetchPackingData error:', err);
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
      alert('Gagal memperbarui status: ' + error.message);
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
      return alert('Silakan pilih minimal 1 lembar kerja (sheet) untuk diimpor.');
    }

    setIsImporting(true);
    try {
      let parsedRecords = [];

      selectedSheets.forEach((sheetName, sheetIdx) => {
        const ws = pendingWorkbook.Sheets[sheetName];
        if (!ws) return;

        const cleanSheet = String(sheetName || '').trim();
        let sheetProject = '';
        let sheetBox = '';

        const dashParts = cleanSheet.split(/\s*[-–—]\s*/);
        if (dashParts.length >= 2) {
          sheetProject = dashParts[0].trim();
          sheetBox = dashParts.slice(1).join(' - ').trim();
        } else {
          sheetBox = cleanSheet;
        }

        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!data || data.length < 2) return;

        // Auto-Detect Header Column Positions from rows 0..5
        let colMap = {
          storeNo: -1,
          prCode: -1,
          boxCode: -1,
          urut: -1,
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
            else if (h.includes('KODE BOX') || h.includes('NO. BOX') || h.includes('NO BOX') || h === 'BOX' || h.includes('KODE KOLI') || h.includes('NO. KOLI') || h.includes('NO KOLI') || h === 'KOLI' || h.includes('KOLIAN')) colMap.boxCode = c;
            else if (h.includes('NO. URUT') || h.includes('NO URUT') || h === 'URUT') colMap.urut = c;
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
        const idxPrCode = colMap.prCode;
        const idxBoxCode = colMap.boxCode;
        const idxStoreId = colMap.storeId !== -1 ? colMap.storeId : 3;
        const idxCompany = colMap.company !== -1 ? colMap.company : 4;
        const idxStoreName = colMap.storeName !== -1 ? colMap.storeName : 5;
        const idxNoPo = colMap.noPo;
        const idxSpkWpp = colMap.spkWpp;
        const idxDelivery = colMap.delivery !== -1 ? colMap.delivery : 8;
        const idxRegion = colMap.region !== -1 ? colMap.region : 9;
        const idxQrAddress = colMap.qrAddress;
        const idxQr = colMap.qr;

        // Item catalog starts after QR column (col 12 by default if QR column exists, or after last metadata column)
        const itemStartColIdx = Math.max(
          12,
          idxQr !== -1 && idxQr !== undefined ? idxQr + 1 : (idxQrAddress !== -1 && idxQrAddress !== undefined ? idxQrAddress + 1 : 12)
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

        const rowCandidate0 = data[codeRowIdx] || [];
        const rowCandidate1 = data[codeRowIdx + 1] || [];
        const rowCandidate2 = data[codeRowIdx + 2] || [];
        const rowCandidate3 = data[codeRowIdx + 3] || [];

        const isMaterialStr = (str) => {
          const s = String(str || '').toUpperCase();
          return s.includes('PVC') || s.includes('MM') || s.includes('SISI') || s.includes('ACRYLIC') || s.includes('VINYL') || s.includes('ALBATROS') || s.includes('BANNER') || s.includes('STICKER') || s.includes('WPB');
        };

        let rowCodes = [];
        let rowNewCols = [];
        let rowMaterials = [];
        let rowSizes = [];

        if (rowCandidate1.some(val => isMaterialStr(val))) {
          // 3-row format (Code, Material, Size)
          rowNewCols = [];
          rowCodes = rowCandidate0;
          rowMaterials = rowCandidate1;
          rowSizes = rowCandidate2;
        } else {
          // 4-row format (Kolom baru, Code, Material, Size)
          rowNewCols = rowCandidate0; // kolom baru (e.g. Standing KTWB)
          rowCodes = rowCandidate1;     // kode utama (besar merah, e.g. 240 - A.3)
          rowMaterials = rowCandidate2; // material
          rowSizes = rowCandidate3;     // size
        }

        let catalogItems = [];
        for (let colIdx = itemStartColIdx; colIdx < Math.max(rowCodes.length, rowNewCols.length, rowMaterials.length, rowSizes.length); colIdx++) {
          const rawCode = rowCodes[colIdx] ? String(rowCodes[colIdx]).trim() : '';
          const rawNewCol = rowNewCols[colIdx] ? String(rowNewCols[colIdx]).trim() : '';
          const rawMat = rowMaterials[colIdx] ? String(rowMaterials[colIdx]).trim() : '';
          const rawSize = rowSizes[colIdx] ? String(rowSizes[colIdx]).trim() : '';

          if (rawCode && !rawCode.toUpperCase().includes('QR') && rawCode !== '') {
            catalogItems.push({
              colIndex: colIdx,
              code: rawCode,
              newCode: rawNewCol,
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
          const prCode = (idxPrCode !== -1 && row[idxPrCode]) ? String(row[idxPrCode]).trim() : (sheetProject || 'PR');

          let boxCode = '';
          if (idxBoxCode !== -1 && row[idxBoxCode]) {
            boxCode = String(row[idxBoxCode]).trim();
          } else if (sheetBox) {
            boxCode = sheetBox;
          } else if (colMap.urut !== -1 && row[colMap.urut]) {
            boxCode = String(row[colMap.urut]).trim();
          } else {
            boxCode = `B${sheetIdx + 1}-${r}`;
          }

          const storeId = (idxStoreId !== -1 && row[idxStoreId]) ? String(row[idxStoreId]).trim() : '';
          const clientPt = (idxCompany !== -1 && row[idxCompany]) ? String(row[idxCompany]).trim() : 'PT. Sukses Prima Jayaindo';
          const storeName = (idxStoreName !== -1 && row[idxStoreName]) ? String(row[idxStoreName]).trim() : '';
          const noPo = (idxNoPo !== -1 && row[idxNoPo]) ? String(row[idxNoPo]).trim() : '';
          const spkWpp = (idxSpkWpp !== -1 && row[idxSpkWpp]) ? String(row[idxSpkWpp]).trim() : '';
          const deliveryType = (idxDelivery !== -1 && row[idxDelivery]) ? String(row[idxDelivery]).trim() : 'DALAM KOTA';
          const regionStr = (idxRegion !== -1 && row[idxRegion]) ? String(row[idxRegion]).trim() : '-';

          // READ / GENERATE QR ADDRESS (Format: STORENO_BOXCODE_STOREID_STORENAME)
          const explicitQrAddress = (idxQrAddress !== -1 && row[idxQrAddress]) ? String(row[idxQrAddress]).trim() : '';
          const qrAddress = explicitQrAddress || `${storeNo}_${boxCode}_${storeId || storeNo}_${storeName}`;

          // Form unique, URL-safe tracking ID for each sheet, box, and store
          const cleanPr = (prCode || 'PR').replace(/[\s/]/g, '');
          const cleanBox = (boxCode || `S${sheetIdx + 1}`).replace(/[\s/]/g, '');
          const cleanStore = (storeId || storeNo || `R${r}`).replace(/[\s/]/g, '');
          const trackingId = `${cleanPr}-${cleanBox}-${cleanStore}`;

          const promoTitle = noPo || spkWpp || (sheetProject ? `PO ${sheetProject}` : cleanSheet);

          let storeItems = [];
          let totalQty = 0;

          catalogItems.forEach((cat, catIdx) => {
            const qtyVal = Number(row[cat.colIndex]) || 0;
            if (qtyVal > 0) {
              const activeImg = window.__ACTIVE_DESIGN_URLS__[cat.code] || window.__ACTIVE_DESIGN_URLS__[catIdx] || '';
              storeItems.push({
                code: cat.code,
                newCode: cat.newCode,
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

          // If catalog items were found in the sheet, skip stores with zero quantity in this sheet
          if (catalogItems.length > 0 && totalQty === 0) {
            continue;
          }

          // Area code on label (e.g. A 3, A 4, or boxCode)
          const areaCode = sheetBox || boxCode || 'A1';

          parsedRecords.push({
            tracking_id: trackingId,
            no_spk: spkWpp || prCode,
            client_pt: clientPt,
            promo_title: promoTitle,
            store_name: storeName,
            recipient_name: `Store #${storeNo} (${storeId || storeNo})`,
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

      // Deduplicate by tracking_id so PostgreSQL ON CONFLICT DO UPDATE command can never fail
      const recordMap = new Map();
      parsedRecords.forEach((record) => {
        if (!recordMap.has(record.tracking_id)) {
          recordMap.set(record.tracking_id, { ...record });
        } else {
          const existing = recordMap.get(record.tracking_id);
          existing.total_qty = (existing.total_qty || 0) + (record.total_qty || 0);
          existing.items_detail = [...(existing.items_detail || []), ...(record.items_detail || [])];
        }
      });
      const recordsToUpsert = Array.from(recordMap.values());

      if (recordsToUpsert.length === 0) {
        throw new Error('Tidak ada data matriks cabang yang terbaca.');
      }

      // Upsert in chunks of 100 to avoid request size limits
      const CHUNK_SIZE = 100;
      for (let i = 0; i < recordsToUpsert.length; i += CHUNK_SIZE) {
        const chunk = recordsToUpsert.slice(i, i + CHUNK_SIZE);
        let { error } = await supabase
          .from('packing_tracking')
          .upsert(chunk, { onConflict: 'tracking_id' });

        // Smart Fallback: Jika kolom 'region' belum ada di tabel Supabase, otomatis strip kolom 'region' dan retry
        if (error && error.message && error.message.includes('region')) {
          const fallbackChunk = chunk.map(({ region, ...rest }) => rest);
          const retryRes = await supabase
            .from('packing_tracking')
            .upsert(fallbackChunk, { onConflict: 'tracking_id' });
          error = retryRes.error;
        }

        if (error) throw error;
      }

      alert(`Berhasil mengimpor ${recordsToUpsert.length} data kolian cabang dari ${selectedSheets.length} lembar kerja.`);
      setIsSheetSelectorOpen(false);
      setPendingWorkbook(null);
      fetchPackingData();
    } catch (err) {
      alert('Gagal mengimpor lembar kerja: ' + err.message);
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
        alert('Gagal membaca berkas Excel: ' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      alert('Gagal membaca berkas Excel.');
      setIsImporting(false);
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFetchGoogleSheet = async () => {
    if (!gSheetUrlInput.trim()) {
      return alert('Silakan masukkan tautan URL Google Spreadsheet terlebih dahulu.');
    }

    setIsImporting(true);
    try {
      const match = gSheetUrlInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!match || !match[1]) {
        throw new Error('Tautan URL Google Spreadsheet tidak valid.');
      }
      const sheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

      const res = await fetch(exportUrl);
      if (!res.ok) {
        throw new Error('Gagal mengakses Google Spreadsheet. Pastikan akses berbagi telah diatur ke publik.');
      }

      const arrayBuffer = await res.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      
      setIsGSheetModalOpen(false);
      setGSheetUrlInput('');
      openSheetSelectorModal(wb);
    } catch (err) {
      alert('Gagal mengambil data Google Spreadsheet: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Upload Foto Desain Langsung (Instant Display ObjectURL)
  const handleBulkUploadDesignImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    if (packingList.length === 0) {
      alert('Silakan impor data cabang terlebih dahulu.');
      e.target.value = '';
      return;
    }

    setIsUploadingImages(true);
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

        const newDetails = details.map((item) => {
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
            return { ...item, image_url: matched.url };
          }
          return item;
        });

        return { ...row, items_detail: newDetails, updated_at: new Date().toISOString() };
      });

      // Update State UI Seketika
      setPackingList(newPackingList);

      alert(`Selesai. Berhasil memasangkan ${totalMatches} gambar desain ke item yang sesuai.`);
    } catch (err) {
      alert('Gagal mengunggah gambar desain: ' + err.message);
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
    if (!selectedDeskFolderId) return alert('Silakan pilih folder proyek terlebih dahulu.');
    const targetFolder = deskPrintFolders.find(f => f.id === selectedDeskFolderId);
    if (!targetFolder || !targetFolder.images || targetFolder.images.length === 0) {
      return alert('Folder proyek yang dipilih belum memiliki gambar desain.');
    }

    if (packingList.length === 0) {
      return alert('Silakan impor data cabang di Panel Kendali Paking terlebih dahulu.');
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
    alert(`Berhasil mencocokkan dan memasang ${matchedCount} gambar desain dari Desk Print (${targetFolder.name}).`);
  };

  const handleSingleImageOverride = (rowId, itemIndex, file) => {
    if (!file) return;
    try {
      const displayUrl = URL.createObjectURL(file);
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
      alert('Foto desain berhasil diperbarui.');
    } catch (err) {
      alert('Gagal mengubah gambar: ' + err.message);
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
    if (projectItems.length === 0) return alert(`Tidak ada data label untuk proyek "${projectGroupKey}".`);

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
    if (!confirm(`Hapus seluruh data untuk proyek "${projectGroupKey}" dari basis data?`)) return;
    const projectItems = sourceList.filter(item => getProjectGroupKey(item.promo_title).toLowerCase() === projectGroupKey.toLowerCase());
    const idsToDelete = projectItems.map(i => i.id);
    if (idsToDelete.length === 0) return;
    const { error } = await supabase.from('packing_tracking').delete().in('id', idsToDelete);
    if (!error) {
      await fetchPackingData();
      alert(`Proyek "${projectGroupKey}" berhasil dihapus.`);
    } else {
      alert('Gagal menghapus proyek: ' + error.message);
    }
  };

  const handleBatchPrintAll = () => {
    const listToFilter = selectedRowIds.length > 0
      ? filteredList.filter(item => selectedRowIds.includes(item.id))
      : filteredList;
    const listToPrint = listToFilter.filter(item => item.source === 'google_sheet');

    if (listToPrint.length === 0) {
      return alert('Fitur Cetak Label A4 tidak aktif untuk data dari Tab Cetak Label & Surat Jalan.');
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
      return alert('Fitur Surat Jalan tidak aktif untuk data dari Tab Cetak Label & Surat Jalan.');
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

      alert('Dokumentasi bukti paking berhasil diunggah.');
      fetchPackingData();
    } catch (err) {
      alert('Gagal mengunggah dokumentasi foto: ' + err.message);
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
      const staffName = 'Petugas Pengiriman';

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

      alert('Dokumentasi pengiriman (Outbound) berhasil diunggah.');
      fetchPackingData();
    } catch (err) {
      alert('Gagal mengunggah foto pengiriman: ' + err.message);
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
      setOutboundScanMsg(`Kode kolian / QR "${cleanCode}" tidak ditemukan dalam daftar paking.`);
      setOutboundScannedCode('');
      setMatchedOutboundItem(null);
      return;
    }

    setMatchedOutboundItem(found);
    setOutboundScanMsg(`Kolian ditemukan: ${found.box_code || '-'} (${found.store_name}). Silakan unggah dokumentasi pengiriman.`);
    setOutboundScannedCode('');
  };

  const generateViewerUrl = (rawUrl, title, item) => {
    if (!rawUrl || rawUrl === 'No Foto' || rawUrl === '-') return '-';
    if (rawUrl.startsWith('data:')) {
      return '[Data Gambar Base64]';
    }
    if (rawUrl.length > 500) {
      return rawUrl.slice(0, 500);
    }
    return rawUrl;
  };

  const handleDownloadPackingReport = async () => {
    try {
      const dataToExport = filteredList.length > 0 ? filteredList : packingList;
      if (dataToExport.length === 0) return alert('Belum ada data paking untuk diekspor.');

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
          'Kode Kolian': item.box_code || '-',
          'ID Pelacakan': item.tracking_id || '-',
          'Nomor SPK': item.no_spk || '-',
          'Perusahaan / Pelanggan': item.client_pt || '-',
          'Proyek / Promo': item.promo_title || '-',
          'Nama Cabang / Alamat': item.store_name || '-',
          Penerima: item.recipient_name || '-',
          'Total Kuantitas': item.total_qty || 0,
          'Jalur Pengiriman': item.delivery_type || '-',
          'Status QC Label': item.status_qc_label || 'PENDING',
          'Status QC Paking': item.status_qc_packing || 'PENDING',
          'Status QC Pemeriksa': item.status_qc_checker || 'PENDING',
          'Status Pengiriman': item.status_deliver || 'PENDING',
          'Tautan Foto Bukti Paking': generateViewerUrl(rawPakingUrl, 'Foto Bukti Paking', item),
          'Tautan Foto Pengiriman': generateViewerUrl(rawOutboundUrl, 'Foto Pengiriman', item),
          'Tautan Foto Desain Visual': generateViewerUrl(rawDesignUrl, 'Foto Desain Visual', item),
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
                cell.l = { Target: cell.v, Tooltip: 'Klik untuk Membuka Foto' };
              }
            }
          }
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan_Paking');

      const todayStr = new Date().toISOString().slice(0, 10);
      let fileNameStr = `Laporan_Paking_Semua_${todayStr}.xlsx`;

      if (filterProject !== 'ALL') {
        const cleanProj = String(filterProject).replace(/[/\\?%*:|"<>]/g, '_').trim();
        fileNameStr = `Laporan_Paking_${cleanProj}_${todayStr}.xlsx`;
      }

      XLSX.writeFile(workbook, fileNameStr);
      alert(`Laporan Excel Paking (${fileNameStr}) berhasil diunduh.`);
    } catch (err) {
      alert('Gagal mengunduh laporan: ' + err.message);
    }
  };

  const handleClearAllPackingData = () => {
    setClearPinInput('');
    setClearPinError('');
    setShowClearPinModal(true);
  };

  const handleConfirmClearAll = async (e) => {
    if (e) e.preventDefault();
    if (clearPinInput.trim() !== '123') {
      setClearPinError('PIN Keamanan salah! Silakan coba lagi.');
      return;
    }
    try {
      const { error } = await supabase.from('packing_tracking').delete().gt('id', 0);
      if (error) throw error;
      setPackingList([]);
      window.__ACTIVE_DESIGN_URLS__ = {};
      setShowClearPinModal(false);
      setClearPinInput('');
      setClearPinError('');
      alert('Seluruh data paking berhasil dikosongkan.');
    } catch (err) {
      alert('Gagal menghapus data: ' + err.message);
    }
  };

  const handleTogglePinProject = (groupKey) => {
    setPinnedProjects(prev => {
      const isPinned = prev.includes(groupKey);
      const updated = isPinned ? prev.filter(k => k !== groupKey) : [...prev, groupKey];
      try {
        localStorage.setItem('pinned_packing_projects', JSON.stringify(updated));
      } catch (e) {
        console.error('Gagal menyimpan status pin:', e);
      }
      return updated;
    });
  };

  const handleOpenDeleteProjectModal = (groupKey, rowIds, totalBoxes) => {
    setProjectToDelete({ name: groupKey, rowIds, totalBoxes });
    setDeleteProjectPinInput('');
    setDeleteProjectPinError('');
    setShowDeleteProjectModal(true);
  };

  const handleConfirmDeleteProject = async (e) => {
    if (e) e.preventDefault();
    if (deleteProjectPinInput.trim() !== '123') {
      setDeleteProjectPinError(t('modalClearError'));
      return;
    }
    if (!projectToDelete || !projectToDelete.rowIds || projectToDelete.rowIds.length === 0) {
      alert('Tidak ada data baris yang ditemukan untuk proyek ini.');
      setShowDeleteProjectModal(false);
      return;
    }

    setIsDeletingProject(true);
    try {
      const ids = projectToDelete.rowIds;
      // Hapus data secara presisi HANYA untuk ID milik proyek ini (batch 100 agar aman dan stabil)
      for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const { error } = await supabase.from('packing_tracking').delete().in('id', batch);
        if (error) throw error;
      }

      setPackingList(prev => prev.filter(item => !ids.includes(item.id)));
      setSelectedRowIds(prev => prev.filter(id => !ids.includes(id)));
      setPinnedProjects(prev => {
        const next = prev.filter(k => k !== projectToDelete.name);
        try {
          localStorage.setItem('pinned_packing_projects', JSON.stringify(next));
        } catch (e) {}
        return next;
      });

      const deletedName = projectToDelete.name;
      setShowDeleteProjectModal(false);
      setProjectToDelete(null);
      setDeleteProjectPinInput('');
      setDeleteProjectPinError('');

      await fetchPackingData();
      alert(`✅ ${t('deleteProjectSuccess')} (${deletedName})`);
    } catch (err) {
      console.error('Error deleting project:', err);
      alert(t('deleteProjectFail') + err.message);
    } finally {
      setIsDeletingProject(false);
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
          alert('Tidak ada data SPK untuk disinkronkan.');
        }
        return;
      }

      const payloads = rowsToSync.map((spk, idx) => {
        const trackingCode = spk.tracking_id || `${spk.no_spk || 'SPK'}-${spk.id || Date.now() + idx}`;
        const promoVal = spk.project || spk.promo_title || spk.project_name || spk.item_name || spk.bahan || 'Proyek Utama';
        const clientVal = spk.client || spk.client_pt || spk.client_name || 'Pelanggan Utama';
        const storeVal = spk.store_code || spk.store_name || spk.branch_name || spk.destination || spk.client || 'Cabang Utama';
        const recipientVal = spk.recipient_name || spk.pic_name || spk.client || 'Penerima';
        const routeVal = spk.delivery_route || spk.delivery_type || 'DALAM KOTA';

        return {
          tracking_id: trackingCode,
          no_spk: spk.no_spk || `SPK-${spk.id || idx}`,
          client_pt: clientVal,
          promo_title: promoVal,
          store_name: storeVal,
          recipient_name: recipientVal,
          total_qty: Number(spk.qty_order || spk.total_qty || spk.qty_finish || 100),
          box_code: spk.box_code || 'WL-01',
          delivery_type: routeVal,
          status_qc_label: spk.status_qc_label || 'PENDING',
          status_qc_packing: spk.status_qc_packing || 'PENDING',
          status_qc_checker: spk.status_qc_checker || 'PENDING',
          status_deliver: spk.status_deliver || 'PENDING',
          items_detail: (Array.isArray(spk.items_detail) && spk.items_detail.length > 0)
            ? spk.items_detail
            : [{
                code: spk.no_spk || 'ITEM-01',
                desc: promoVal,
                material: spk.bahan || '-',
                size: spk.ukuran || '-',
                qty: Number(spk.qty_order || spk.total_qty || 100)
              }],
          updated_at: new Date().toISOString()
        };
      });

      await supabase.from('packing_tracking').upsert(payloads, { onConflict: 'tracking_id' });
      await fetchPackingData();
      if (isManual) {
        alert(`Berhasil memulihkan dan menyinkronkan ${payloads.length} data paking.`);
      }
    } catch (err) {
      if (isManual) {
        alert('Gagal melakukan sinkronisasi data: ' + err.message);
      }
    }
  };

  // Logika Arsip: Data hanya pindah ke Arsip Proyek jika SUDAH ada bukti foto paking DAN scan dari checker/deliver
  const isClosedItem = (item) => {
    const hasPhoto = Boolean(item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' && item.bukti_paking_url.length > 5);
    const hasCheckerOrDeliver = Boolean(
      item.status_qc_checker === 'DONE' ||
      (item.bukti_outbound_url && item.bukti_outbound_url !== 'No Foto' && item.bukti_outbound_url !== '-' && item.bukti_outbound_url.length > 5) ||
      item.outbound_url ||
      item.status_deliver === 'DONE'
    );
    return hasPhoto && hasCheckerOrDeliver;
  };

  // Seluruh data aktif (termasuk label_sj & google_sheet) tetap tampil selama belum selesai foto + scan
  const sourceList = packingList.filter(item => !isClosedItem(item));

  // Filter list by status & delivery first so uniqueProjects only shows projects matching current status (e.g. Done)
  const statusFilteredList = sourceList.filter((item) => {
    const matchDelivery = filterDelivery === 'ALL' || item.delivery_type === filterDelivery;
    const matchSource = filterSource === 'ALL' || (filterSource === 'google_sheet' ? item.source === 'google_sheet' : item.source === 'label_sj');
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
    return extractBaseProjectName(promoTitle) || '-';
  };

  // Pengelompokan proyek paking aktif berdasarkan bulan dan kategori brand untuk dropdown
  const uniqueMonthsAndProjects = useMemo(() => {
    const monthMap = {};
    sourceList.forEach(item => {
      if (!item.promo_title || item.promo_title.trim() === '') return;
      const mKey = getItemMonthKey(item.created_at || item.updated_at);
      const mLabel = getItemMonthLabel(mKey, lang);
      const cat = getProjectCategory(item.promo_title);
      const proj = getProjectGroupKey(item.promo_title);

      if (!monthMap[mKey]) {
        monthMap[mKey] = { key: mKey, label: mLabel, totalBoxes: 0, brands: {} };
      }
      monthMap[mKey].totalBoxes++;
      if (!monthMap[mKey].brands[cat]) {
        monthMap[mKey].brands[cat] = { categoryName: cat, totalBoxes: 0, projects: {} };
      }
      monthMap[mKey].brands[cat].totalBoxes++;
      if (proj && proj !== '-') {
        monthMap[mKey].brands[cat].projects[proj] = (monthMap[mKey].brands[cat].projects[proj] || 0) + 1;
      }
    });

    return Object.keys(monthMap)
      .sort((a, b) => b.localeCompare(a))
      .map(k => {
        const m = monthMap[k];
        return {
          key: m.key,
          label: m.label,
          totalBoxes: m.totalBoxes,
          brands: Object.values(m.brands).map(b => ({
            categoryName: b.categoryName,
            totalBoxes: b.totalBoxes,
            projects: Object.entries(b.projects)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => a.name.localeCompare(b.name))
          })).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
        };
      });
  }, [sourceList, lang]);

  const uniqueProjects = Array.from(
    new Set(
      statusFilteredList
        .map(item => getProjectGroupKey(item.promo_title))
        .filter(str => str !== '-' && str !== '')
    )
  ).sort((a, b) => a.localeCompare(b));

  const sortedStatusList = [...statusFilteredList].sort((a, b) => {
    const groupA = getProjectGroupKey(a.promo_title);
    const groupB = getProjectGroupKey(b.promo_title);
    const isPinnedA = pinnedProjects.includes(groupA);
    const isPinnedB = pinnedProjects.includes(groupB);

    if (isPinnedA !== isPinnedB) {
      return isPinnedA ? -1 : 1;
    }

    const projA = groupA.toLowerCase();
    const projB = groupB.toLowerCase();
    if (projA !== projB) {
      return sortOrder === 'asc' ? projA.localeCompare(projB) : projB.localeCompare(projA);
    }
    const storeA = (a.store_name || '').toLowerCase();
    const storeB = (b.store_name || '').toLowerCase();
    return sortOrder === 'asc' ? storeA.localeCompare(storeB) : storeB.localeCompare(storeA);
  });

  const filteredList = sortedStatusList.filter((item) => {
    let matchProject = true;
    if (filterProject !== 'ALL') {
      const itemMonth = getItemMonthKey(item.created_at || item.updated_at);
      const itemCat = getProjectCategory(item.promo_title).toUpperCase();
      const itemKey = getProjectGroupKey(item.promo_title).toLowerCase();

      if (filterProject.startsWith('MONTH:')) {
        const clean = filterProject.replace('MONTH:', '');
        const [targetMonth, targetGroup] = clean.split('|GROUP:');
        if (itemMonth !== targetMonth) matchProject = false;
        else if (targetGroup && itemCat !== targetGroup.trim().toUpperCase()) matchProject = false;
      } else if (filterProject.startsWith('GROUP:')) {
        const cat = filterProject.replace('GROUP:', '').trim().toUpperCase();
        if (itemCat !== cat) matchProject = false;
      } else {
        const target = filterProject.trim().toLowerCase();
        if (itemKey !== target && itemCat !== target) matchProject = false;
      }
    }

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
            <div key={`${item.id}-page-${currentPage}`} className="label-page" style={{ width: '195mm', minHeight: '100mm', height: 'auto', border: '2px solid #000', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', overflow: 'hidden', marginBottom: '4mm', marginLeft: 'auto', marginRight: 'auto', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
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
                        {sub.newCode && (
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000', lineHeight: '1.1', textTransform: 'uppercase', marginTop: '2px' }}>
                            {sub.newCode}
                          </div>
                        )}
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
    <div className="space-y-4 text-[#1E293B] dark:text-slate-100 font-sans">
      {/* HEADER OPERASIONAL PACKING CONTROL PANEL (CRM STYLE) */}
      <div className="bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/60 flex items-center justify-center text-[#FF6422] shrink-0 shadow-xs">
            <Box className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {t('packingTitle')}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {t('packingLive')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('packingSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-start sm:justify-end">
          <button
            onClick={() => {
              const currentKeys = Array.from(new Set(filteredList.map(item => getProjectGroupKey(item.promo_title))));
              const isAllCollapsed = currentKeys.length > 0 && currentKeys.every(k => !!collapsedProjects[k]);
              const nextState = {};
              currentKeys.forEach(k => { nextState[k] = !isAllCollapsed; });
              setCollapsedProjects(nextState);
            }}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 select-none"
            title="Buka atau tutup seluruh rincian proyek"
          >
            {(() => {
              const currentKeys = Array.from(new Set(filteredList.map(item => getProjectGroupKey(item.promo_title))));
              const isAllCollapsed = currentKeys.length > 0 && currentKeys.every(k => !!collapsedProjects[k]);
              return isAllCollapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>{t('btnExpandAll')}</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>{t('btnCollapseAll')}</span>
                </>
              );
            })()}
          </button>

          <div className="px-3.5 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-neutral-700 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#FF6422]" />
            <span>{t('packingTotalBoxes')} <strong className="font-bold">{totalSpk}</strong></span>
          </div>
        </div>
      </div>

      {/* KARTU METRIK UTAMA CRM DASHBOARD DENGAN MINI SPARKLINE (DRIBBBLE SHOT) */}
      <div ref={statCardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: QC LABEL */}
        {(() => {
          const labelDoneCount = packingList.filter(s => s.status_qc_label === 'DONE' || (s.status_qc_label && String(s.status_qc_label).includes('DONE'))).length;
          const labelPct = totalSpk > 0 ? Math.round((labelDoneCount / totalSpk) * 100) : 0;
          const isSelected = filterStage === 'status_qc_label';
          return (
            <div
              onClick={() => setFilterStage(isSelected ? 'ALL' : 'status_qc_label')}
              className={`p-4 sm:p-5 rounded-2xl border relative flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-white dark:bg-neutral-900 border-[#FF6422] ring-2 ring-[#FF6422]/20 shadow-md'
                  : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t('packingQcLabel')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'qc_label' ? null : 'qc_label'); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title={t('packingDetail')}
                  >
                    {openDetailCard === 'qc_label' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {labelDoneCount}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">/ {totalSpk}</span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                      ↗ {labelPct}%
                    </span>
                  </div>

                  {/* Dribbble smooth orange wave sparkline */}
                  <svg className="w-20 h-7 overflow-visible text-[#FF6422] shrink-0" viewBox="0 0 100 30" fill="none">
                    <path d="M0 22 Q 25 5, 50 18 T 80 8 T 100 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {openDetailCard === 'qc_label' && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-xl p-4 z-30 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t('breakdownLabel')}</span>
                    <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span>{t('completedOfTotal')}</span>
                      <span className="font-bold">{labelDoneCount} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#FF6422] h-full rounded-full" style={{ width: `${labelPct}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Card 2: QC PACKING */}
        {(() => {
          const packingDoneCount = packingList.filter(s => s.status_qc_packing === 'DONE' || (s.status_qc_packing && String(s.status_qc_packing).includes('DONE'))).length;
          const packingPct = totalSpk > 0 ? Math.round((packingDoneCount / totalSpk) * 100) : 0;
          const isSelected = filterStage === 'status_qc_packing';
          return (
            <div
              onClick={() => setFilterStage(isSelected ? 'ALL' : 'status_qc_packing')}
              className={`p-4 sm:p-5 rounded-2xl border relative flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-white dark:bg-neutral-900 border-[#FF6422] ring-2 ring-[#FF6422]/20 shadow-md'
                  : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t('packingQcPacking')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'qc_packing' ? null : 'qc_packing'); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title={t('packingDetail')}
                  >
                    {openDetailCard === 'qc_packing' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {packingDoneCount}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">/ {totalSpk}</span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                      ↗ {packingPct}%
                    </span>
                  </div>

                  {/* Dribbble smooth orange wave sparkline */}
                  <svg className="w-20 h-7 overflow-visible text-[#FF6422] shrink-0" viewBox="0 0 100 30" fill="none">
                    <path d="M0 24 Q 20 10, 45 16 T 75 6 T 100 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {openDetailCard === 'qc_packing' && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-xl p-4 z-30 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t('breakdownPacking')}</span>
                    <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span>{t('completedOfTotal')}</span>
                      <span className="font-bold">{packingDoneCount} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#FF6422] h-full rounded-full" style={{ width: `${packingPct}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Card 3: QC CHECKER */}
        {(() => {
          const checkerDoneCount = packingList.filter(s => s.status_qc_checker === 'DONE' || (s.status_qc_checker && String(s.status_qc_checker).includes('DONE'))).length;
          const checkerPct = totalSpk > 0 ? Math.round((checkerDoneCount / totalSpk) * 100) : 0;
          const isSelected = filterStage === 'status_qc_checker';
          return (
            <div
              onClick={() => setFilterStage(isSelected ? 'ALL' : 'status_qc_checker')}
              className={`p-4 sm:p-5 rounded-2xl border relative flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-white dark:bg-neutral-900 border-[#FF6422] ring-2 ring-[#FF6422]/20 shadow-md'
                  : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t('packingQcChecker')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'qc_checker' ? null : 'qc_checker'); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title={t('packingDetail')}
                  >
                    {openDetailCard === 'qc_checker' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {checkerDoneCount}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">/ {totalSpk}</span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                      ↗ {checkerPct}%
                    </span>
                  </div>

                  {/* Dribbble smooth orange wave sparkline */}
                  <svg className="w-20 h-7 overflow-visible text-[#FF6422] shrink-0" viewBox="0 0 100 30" fill="none">
                    <path d="M0 18 Q 20 26, 45 10 T 75 16 T 100 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {openDetailCard === 'qc_checker' && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-xl p-4 z-30 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t('breakdownChecker')}</span>
                    <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span>{t('completedOfTotal')}</span>
                      <span className="font-bold">{checkerDoneCount} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#FF6422] h-full rounded-full" style={{ width: `${checkerPct}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Card 4: DELIVER */}
        {(() => {
          const deliverDoneCount = packingList.filter(s => s.status_deliver === 'DONE' || (s.status_deliver && String(s.status_deliver).includes('DONE'))).length;
          const deliverPct = totalSpk > 0 ? Math.round((deliverDoneCount / totalSpk) * 100) : 0;
          const isSelected = filterStage === 'status_deliver';
          return (
            <div
              onClick={() => setFilterStage(isSelected ? 'ALL' : 'status_deliver')}
              className={`p-4 sm:p-5 rounded-2xl border relative flex flex-col justify-between cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-white dark:bg-neutral-900 border-[#FF6422] ring-2 ring-[#FF6422]/20 shadow-md'
                  : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 hover:border-slate-300 shadow-xs hover:shadow-md'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t('packingReadyDeliver')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenDetailCard(openDetailCard === 'deliver' ? null : 'deliver'); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                    title={t('packingDetail')}
                  >
                    {openDetailCard === 'deliver' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      {deliverDoneCount}
                    </span>
                    <span className="text-xs text-slate-400 font-normal">/ {totalSpk}</span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                      ↗ {deliverPct}%
                    </span>
                  </div>

                  {/* Dribbble smooth orange wave sparkline */}
                  <svg className="w-20 h-7 overflow-visible text-[#FF6422] shrink-0" viewBox="0 0 100 30" fill="none">
                    <path d="M0 22 Q 25 18, 50 8 T 80 14 T 100 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {openDetailCard === 'deliver' && (
                <div onClick={(e) => e.stopPropagation()} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-xl p-4 z-30 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">{t('breakdownDeliver')}</span>
                    <button onClick={() => setOpenDetailCard(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span>{t('completedOfTotal')}</span>
                      <span className="font-bold">{deliverDoneCount} / {totalSpk}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#FF6422] h-full rounded-full" style={{ width: `${deliverPct}%` }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* HORIZONTAL FILTER TABS (DRIBBBLE CRM SIGNATURE TABS) */}
      <div className="border-b border-slate-200 dark:border-neutral-800 flex items-center gap-6 px-1 pt-2 overflow-x-auto">
        {[
          { id: 'ALL', label: t('tabAll') },
          { id: 'IN_PROGRESS', label: t('tabInProgress') },
          { id: 'COMPLETED', label: t('tabCompleted') },
        ].map(tab => {
          const isActive = filterStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`pb-3 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'text-slate-900 dark:text-white font-bold border-b-2 border-[#FF6422]'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border-b-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* PANEL UTAMA: BILAH KENDALI FILTER & TABEL DATA */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs relative">
        {/* BILAH FILTER & PENCARIAN TERSTRUKTUR */}
        <div className="bg-slate-50/60 dark:bg-neutral-900/60 p-4 border-b border-slate-200/80 dark:border-neutral-800 space-y-3 rounded-t-2xl">
          {/* Baris 1: Tombol Tindakan & Pencarian Utama */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Kotak Pencarian Fleksibel */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 shadow-xs transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="Bersihkan pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tombol Unduh Laporan Excel (Export) */}
            <button
              onClick={handleDownloadPackingReport}
              className="px-3.5 py-2.5 bg-white dark:bg-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-neutral-700 font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              title="Unduh Laporan Excel"
            >
              <Download className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="hidden sm:inline">{t('btnExport')}</span>
            </button>

            {/* Menu Tindakan Operasional (Primary Dribbble Orange) */}
            {!isPackingRole && (
              <div ref={actionsDropdownRef} className="relative shrink-0 z-40">
                <button
                  onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#FF6422] hover:bg-[#EA580C] text-white font-semibold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{t('btnActions')}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isActionsDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isActionsDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-neutral-900 rounded-[22px] border border-slate-200/90 dark:border-neutral-700 shadow-2xl p-2 z-50 space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-neutral-800">
                      {t('actionGroupTitle')}
                    </div>

                    <label className="w-full px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{isImporting ? t('importing') : t('actionImportExcel')}</span>
                      <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={(e) => { handleLocalExcelUpload(e); setIsActionsDropdownOpen(false); }} disabled={isImporting} />
                    </label>

                    <button
                      onClick={() => { setIsGSheetModalOpen(true); setIsActionsDropdownOpen(false); }}
                      className="w-full px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                    >
                      <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{t('actionImportGSheet')}</span>
                    </button>

                    <label className="w-full px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer">
                      <Upload className="w-4 h-4 text-purple-600 shrink-0" />
                      <span>{isUploadingImages ? t('attachingImages') : t('actionUploadDesign')}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleBulkUploadDesignImages(e); setIsActionsDropdownOpen(false); }} disabled={isUploadingImages} />
                    </label>

                    <button
                      onClick={() => { handleOpenDeskPrintModal(); setIsActionsDropdownOpen(false); }}
                      className="w-full px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                    >
                      <FolderKanban className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{t('actionMatchDeskPrint')}</span>
                    </button>

                    <div className="border-t border-slate-100 dark:border-neutral-800 my-1"></div>

                    <button
                      onClick={() => { handleClearAllPackingData(); setIsActionsDropdownOpen(false); }}
                      className="w-full px-3 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-medium rounded-xl text-xs transition-all flex items-center gap-2.5 cursor-pointer text-left"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{t('actionClearAll')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Baris 2: 5 Filter Dropdown (CustomDropdown sesuai gambar referensi user) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            <CustomDropdown
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full"
            >
              <option value="ALL">{t('filterStatusAll')}</option>
              <option value="IN_PROGRESS">{t('tabInProgress')}</option>
              <option value="COMPLETED">{t('tabCompleted')}</option>
            </CustomDropdown>

            <CustomDropdown
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="w-full"
            >
              <option value="ALL">{t('filterStageAll')}</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </CustomDropdown>

            <CustomDropdown
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="w-full"
            >
              <option value="ALL">{t('filterSourceAll')}</option>
              <option value="google_sheet">Google Spreadsheet</option>
              <option value="label_sj">Label & Surat Jalan</option>
            </CustomDropdown>

            <CustomDropdown
              value={filterDelivery}
              onChange={(e) => setFilterDelivery(e.target.value)}
              className="w-full"
            >
              <option value="ALL">{t('filterDeliveryAll')}</option>
              <option value="DALAM KOTA">{t('filterInCity')}</option>
              <option value="LUAR KOTA">{t('filterOutCity')}</option>
            </CustomDropdown>

            <CustomDropdown
              value={filterProject}
              onChange={(e) => {
                setFilterProject(e.target.value);
                if (onProjectFilterChange) onProjectFilterChange(e.target.value);
              }}
              className="w-full"
            >
              <option value="ALL">{t('filterProjectAll')} ({sourceList.length} {t('boxes')})</option>
              {uniqueMonthsAndProjects.map(m => (
                <optgroup key={m.key} label={`🗓️ ${t('periodUpper')} ${m.label.toUpperCase()} (${m.totalBoxes} ${t('boxes')})`}>
                  <option value={`MONTH:${m.key}`}>{t('filterMonthPrefix')} {m.label} ({m.totalBoxes} ${t('boxes')})</option>
                  {m.brands.map(b => (
                    <React.Fragment key={b.categoryName}>
                      <option value={`MONTH:${m.key}|GROUP:${b.categoryName}`}>
                        &nbsp;&nbsp;📁 {b.categoryName} ({b.totalBoxes} {t('boxes')})
                      </option>
                      {b.projects.map(p => (
                        <option key={p.name} value={p.name}>
                          &nbsp;&nbsp;&nbsp;&nbsp;• {p.name} ({p.count})
                        </option>
                      ))}
                    </React.Fragment>
                  ))}
                </optgroup>
              ))}
            </CustomDropdown>
          </div>
        </div>

        {/* TABEL DATA UTAMA */}
        <div className="max-h-[620px] overflow-y-auto overflow-x-auto bg-white dark:bg-neutral-900 custom-scrollbar relative rounded-b-2xl">
          <table className="w-full text-left border-collapse bg-white dark:bg-neutral-900 min-w-[820px]">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-neutral-800 text-slate-400 dark:text-neutral-500 text-[11px] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 pl-4 pr-2 text-center w-10">
                  <button
                    onClick={handleToggleSelectAll}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                      selectedRowIds.length === filteredList.length && filteredList.length > 0
                        ? 'bg-[#FF6422] border-[#FF6422] text-white shadow-xs'
                        : 'border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-[#FF6422]'
                    }`}
                    title={t('thSelectAll')}
                  >
                    {selectedRowIds.length === filteredList.length && filteredList.length > 0 && (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 pl-1 pr-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer select-none uppercase font-semibold"
                    title={t('sortAscDesc')}
                  >
                    <span>{t('thBox')}</span>
                    <span className="flex flex-col -space-y-1.5 text-slate-400">
                      <ChevronUp className={`w-3 h-3 ${sortOrder === 'asc' ? 'text-[#FF6422] stroke-[3]' : 'opacity-40'}`} />
                      <ChevronDown className={`w-3 h-3 ${sortOrder === 'desc' ? 'text-[#FF6422] stroke-[3]' : 'opacity-40'}`} />
                    </span>
                  </button>
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap">{t('thCustomerSpk')}</th>
                <th className="py-3.5 px-4 whitespace-nowrap">{t('thShippingType')}</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thImportDate')}</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thLabelDesign')}</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thPhotoProof')}</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thPackingStatus')}</th>
                {!isPackingRole && (
                  <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thCheckerStatus')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={isPackingRole ? "8" : "9"} className="p-8 text-center">
                    <div className="max-w-md mx-auto space-y-3 py-4">
                      {packingList.length === 0 ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold">
                            📦
                          </div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            Belum Ada Data Paking di Database
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            Jika data SPK sudah di-import hari ini, klik tombol di bawah untuk menyinkronkan data SPK ke Packing Station.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSyncFromSpkData(true)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Sinkronkan Data SPK Sekarang
                          </button>
                        </>
                      ) : sourceList.length === 0 ? (
                        <>
                          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                            ✅
                          </div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            Semua ({packingList.length}) Box Telah Diverifikasi Checker
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            Seluruh data paking telah selesai di-check dan berpindah ke Outbound.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto text-xl font-bold">
                            🔍
                          </div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                            Tidak Ada Data Sesuai Filter
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">
                            Terdapat {sourceList.length} box aktif, namun tidak cocok dengan filter / pencarian saat ini.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFilterSource('ALL');
                              setFilterDelivery('ALL');
                              setFilterStatus('ALL');
                              setFilterStage('ALL');
                              setFilterProject('ALL');
                              setSearchTerm('');
                            }}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            Reset Semua Filter
                          </button>
                        </>
                      )}
                    </div>
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

                  const isCollapsed = !!collapsedProjects[currentGroupKey];

                  return (
                    <React.Fragment key={item.id}>
                      {showProjectDivider && (
                        <tr
                          onClick={() => toggleProjectCollapse(currentGroupKey)}
                          className="bg-[#FFF7ED] border-y border-[#FED7AA] dark:bg-amber-950/40 dark:border-amber-800/60 cursor-pointer select-none hover:bg-amber-100/70 dark:hover:bg-amber-900/50 transition-colors"
                          title={isCollapsed ? "Klik untuk menampilkan proyek" : "Klik untuk menyembunyikan proyek"}
                        >
                          <td colSpan={isPackingRole ? "8" : "9"} className="py-2.5 px-4 font-bold text-[#C2410C] dark:text-amber-200 text-[11px] tracking-wider uppercase">
                            <div className="flex flex-row justify-between items-center gap-4 w-full">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="p-1 rounded-lg bg-white/80 border border-[#FED7AA] dark:bg-amber-900/60 dark:border-amber-700/60 text-[#C2410C] dark:text-amber-200 flex items-center justify-center shrink-0">
                                  {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                                </span>
                                <span className="font-bold text-[#9A3412] dark:text-amber-200 truncate">{currentGroupKey}</span>
                                {pinnedProjects.includes(currentGroupKey) && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 text-white uppercase tracking-wider ml-1.5 shrink-0 inline-flex items-center gap-1 shadow-2xs">
                                    <Pin className="w-2.5 h-2.5 fill-current" />
                                    {t('pinnedBadge')}
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold text-amber-700/80 dark:text-amber-300/80 ml-2">
                                  ({getItemMonthLabel(getItemMonthKey(item.created_at || item.updated_at), lang)})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 normal-case" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1.5 flex-wrap font-mono">
                                  {(() => {
                                    const projItems = sourceList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase());
                                    const totalProj = projItems.length;
                                    const labelDone = projItems.filter(p => p.status_qc_label === 'DONE' || String(p.status_qc_label).includes('DONE')).length;
                                    const packingDone = projItems.filter(p => p.status_qc_packing === 'DONE' || (p.bukti_paking_url && p.bukti_paking_url !== 'No Foto')).length;
                                    const checkerDone = projItems.filter(p => p.status_qc_checker === 'DONE').length;
                                    return (
                                      <>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] font-semibold text-[10px] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60">
                                          {t('badgeLabelCount')} {labelDone}/{totalProj}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50/90 text-emerald-700 font-semibold text-[10px] border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                                          {t('badgePackingCount')} {packingDone}/{totalProj}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-white/90 text-[#C2410C] font-semibold text-[10px] border border-[#FED7AA] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                                          {t('badgeCheckerCount')} {checkerDone}/{totalProj}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-50/90 text-purple-700 font-semibold text-[10px] border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60">
                                          {t('badgeTotalBoxesCount')} {totalProj}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>

                                {!isPackingRole && (
                                  <div className="flex items-center gap-1.5 border-l border-[#FED7AA] dark:border-amber-800/60 pl-2">
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
                                          className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-master-sm active:scale-95 border ${
                                            isAllProjSelected
                                              ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                                              : 'bg-white dark:bg-neutral-800 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-50/90'
                                          }`}
                                          title={isAllProjSelected ? t('deselectAllProjectBranches') : t('selectAllProjectBranches')}
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
                                            className="p-1.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 rounded-lg transition-all cursor-pointer shadow-master-sm flex items-center justify-center active:scale-95"
                                            title="Cetak Seluruh Label Proyek Ini"
                                          >
                                            <Printer className="w-3.5 h-3.5" />
                                          </button>
                                        );
                                      }
                                      return null;
                                    })()}

                                    {/* Tombol Pin / Sematkan Proyek ke Atas */}
                                    {(() => {
                                      const isPinned = pinnedProjects.includes(currentGroupKey);
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleTogglePinProject(currentGroupKey)}
                                          className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-master-sm active:scale-95 border ${
                                            isPinned
                                              ? 'bg-amber-500 text-white border-amber-600 dark:bg-amber-600 dark:border-amber-500 shadow-sm'
                                              : 'bg-white dark:bg-neutral-800 text-amber-700 dark:text-amber-300 border-amber-200/90 dark:border-amber-800/60 hover:bg-amber-50/90'
                                          }`}
                                          title={isPinned ? t('unpinProjectTooltip') : t('pinProjectTooltip')}
                                        >
                                          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-current' : ''}`} />
                                        </button>
                                      );
                                    })()}

                                    {/* Tombol Hapus Proyek dengan PIN Keamanan */}
                                    {(() => {
                                      const projItems = sourceList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase());
                                      const projRowIds = projItems.map(p => p.id);
                                      const totalProj = projItems.length;

                                      return (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenDeleteProjectModal(currentGroupKey, projRowIds, totalProj)}
                                          className="p-1.5 bg-white dark:bg-neutral-800 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer shadow-master-sm flex items-center justify-center active:scale-95"
                                          title={t('deleteProjectTooltip')}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {!isCollapsed && (
                        <tr
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-[#EFF6FF]/70 hover:bg-[#DBEAFE]/50 dark:bg-blue-950/30'
                              : isRowComplete
                              ? 'bg-emerald-50/35 hover:bg-emerald-100/35 dark:bg-emerald-950/15'
                              : 'hover:bg-[#F4F8FD] dark:hover:bg-neutral-800/40 bg-white dark:bg-neutral-900'
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-3.5 pl-4 pr-2 text-center w-10">
                            <button
                              onClick={() => handleToggleSelectRow(item.id)}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                                isSelected
                                  ? 'bg-emerald-50/90 border-emerald-400 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300 shadow-master-sm'
                                  : 'border-[#CBD5E1] dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-[#2563EB]'
                              }`}
                              title={isSelected ? (lang === 'en' ? 'Deselect Row' : 'Batalkan Pilihan') : (lang === 'en' ? 'Select Row' : 'Pilih Baris Ini')}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                          </td>

                          {/* 2. KODE KOLIAN */}
                          <td className="py-3.5 pl-1 pr-4 font-mono text-xs whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 border border-[#BFDBFE] dark:border-blue-800/60 font-bold text-[#1E3A8A] dark:text-blue-200">
                              {item.box_code || '-'}
                            </span>
                          </td>

                          {/* 3. NAMA CABANG / SPK */}
                          <td className="py-3.5 px-4 max-w-[280px]">
                            <div className="font-bold text-[#1E293B] dark:text-white text-xs sm:text-sm flex items-center gap-2 flex-wrap tracking-tight">
                              <span>{getCleanStoreName(item.store_name)}</span>
                            </div>
                            {item.no_spk && (
                              <div className="text-[11px] font-mono text-[#475569] dark:text-neutral-400 font-semibold mt-0.5">{item.no_spk}</div>
                            )}
                          </td>

                          {/* 4. JALUR PENGIRIMAN */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-lg font-mono font-semibold text-[11px] uppercase tracking-wider text-center border ${
                              item.delivery_type === 'DALAM KOTA'
                                ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                                : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
                            }`}>
                              {item.delivery_type === 'DALAM KOTA' ? t('deliveryInCity') : (item.delivery_type === 'LUAR KOTA' ? t('deliveryOutCity') : item.delivery_type || t('deliveryInCity'))}
                            </span>
                          </td>

                          {/* 5. TANGGAL MASUK */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="font-mono text-xs text-[#475569] dark:text-neutral-300 font-medium block">
                              {formatDateTime(item.created_at || item.updated_at) || '-'}
                            </span>
                          </td>

                          {/* 6. LABEL & DESAIN */}
                          <td className="py-3.5 px-4 text-center">
                            {item.source !== 'google_sheet' ? (
                              <span className="inline-block px-2.5 py-1 bg-purple-50/90 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60 rounded-lg text-[10px] font-semibold">
                                {t('badgeLabelSj')}
                              </span>
                            ) : (
                              <>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handlePrintLabel(item)}
                                    title={t('printLabelBtn')}
                                    className="w-8 h-8 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 flex items-center justify-center transition-all shadow-master-sm active:scale-95 cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingRowItem(item)}
                                    title={lang === 'en' ? 'Manage Design Photos' : 'Kelola Foto Desain'}
                                    className="w-8 h-8 rounded-xl bg-[#E9EFF8]/90 hover:bg-[#DBEAFE] text-[#334155] border border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 flex items-center justify-center transition-all shadow-master-sm active:scale-95 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="font-mono text-[10px] mt-1 text-[#475569] dark:text-neutral-400 font-medium">
                                  {parseItems(item.items_detail).filter(i => i.image_url).length} / {parseItems(item.items_detail).length} {t('designsLabel')}
                                </div>
                              </>
                            )}
                          </td>

                          {/* 7. BUKTI PAKING */}
                          <td className="py-3.5 px-4 text-center">
                            {item.bukti_paking_url ? (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <img
                                  src={item.bukti_paking_url}
                                  alt={lang === 'en' ? 'Packing Proof' : 'Bukti Paking'}
                                  onClick={() => onOpenImageModal(
                                    item.bukti_paking_url,
                                    `${lang === 'en' ? 'Packing Proof' : 'Bukti Paking'} - ${item.tracking_id || ''}`,
                                    item.destination || item.store_name || item.branch_name || '',
                                    item.project || item.project_name || '',
                                    item.no_spk || item.spk_no || item.tracking_id || ''
                                  )}
                                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl border border-[#BFDBFE] dark:border-neutral-700 cursor-pointer hover:scale-105 transition-transform shadow-master-sm"
                                />
                                <div className="text-[10px] font-semibold text-[#1E293B] dark:text-neutral-300 leading-tight">
                                  <span className="block truncate max-w-[110px]">{item.foto_by || item.scanned_by || (lang === 'en' ? 'QC Officer' : 'Petugas QC')}</span>
                                  <span className="text-[9px] font-mono text-[#475569] dark:text-neutral-400 font-normal block">{formatDateTime(item.foto_at || item.updated_at) || '-'}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-[#F4F8FD] dark:bg-neutral-800 border border-[#E2E8F0] dark:border-neutral-700 text-[#475569] dark:text-neutral-400 font-medium text-[11px]">
                                {t('badgeNoPhoto')}
                              </span>
                            )}
                          </td>

                          {/* 8. STATUS PAKING */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggleStatus(item.id, 'status_qc_packing', item.status_qc_packing)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                                  isPackingDone
                                    ? 'bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE] dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60'
                                    : 'bg-[#E9EFF8]/80 hover:bg-[#DBEAFE]/60 text-[#475569] border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isPackingDone ? 'bg-[#2563EB]' : 'bg-slate-400'}`} />
                                {isPackingDone ? t('statusDone') : t('statusWaiting')}
                              </button>
                              {isPackingDone && (
                                <div className="text-[10px] font-semibold text-[#1E293B] dark:text-neutral-300 leading-tight mt-0.5">
                                  <span className="block truncate max-w-[110px]">{item.packing_by || item.scanned_by || (lang === 'en' ? 'Packing Staff' : 'Petugas Paking')}</span>
                                  <span className="text-[9px] font-mono text-[#475569] dark:text-neutral-400 font-normal block">{formatDateTime(item.packing_at || item.updated_at) || '-'}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {!isPackingRole && (
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <button
                                  onClick={() => handleToggleStatus(item.id, 'status_qc_checker', item.status_qc_checker)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                                    isCheckerDone
                                      ? 'bg-[#FFF7ED] hover:bg-amber-100/80 text-[#C2410C] border-[#FED7AA] dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60'
                                      : 'bg-[#E9EFF8]/80 hover:bg-[#DBEAFE]/60 text-[#475569] border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isCheckerDone ? 'bg-[#C2410C]' : 'bg-slate-400'}`} />
                                  {isCheckerDone ? t('statusVerified') : t('statusWaiting')}
                                </button>
                                {isCheckerDone && (
                                  <div className="text-[10px] font-semibold text-[#1E293B] dark:text-neutral-300 leading-tight mt-0.5">
                                    <span className="block truncate max-w-[110px]">{item.checker_by || item.scanned_by || (lang === 'en' ? 'QC Checker' : 'Petugas Pemeriksa')}</span>
                                    <span className="text-[9px] font-mono text-[#475569] dark:text-neutral-400 font-normal block">{formatDateTime(item.checker_at || item.updated_at) || '-'}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BILAH NAVIGASI HALAMAN BAWAH */}
        <div className="px-5 py-3 bg-[#F4F8FD]/90 dark:bg-neutral-800/80 border-t border-[#DBEAFE] dark:border-neutral-700 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-medium text-[#475569] dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <span>{t('showingPagination')}</span>
            <span className="font-mono font-bold text-[#1E3A8A] dark:text-white px-2 py-0.5 rounded-md bg-[#EFF6FF] dark:bg-neutral-700 border border-[#BFDBFE] dark:border-neutral-600">
              {filteredList.length > 0 ? `1-${filteredList.length}` : '0'}
            </span>
            <span>{t('fromTotalPagination')} <strong className="font-mono text-[#1E293B] dark:text-white">{sourceList.length}</strong> {t('dataPagination')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] mr-1">{t('pagePagination')} 1 {t('fromTotalPagination')} 1</span>
            <button className="px-3 py-1.5 bg-[#E9EFF8] hover:bg-[#DBEAFE] text-[#1E3A8A] border border-[#BFDBFE] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-xl font-semibold transition-all cursor-pointer">
              {t('btnPrev')}
            </button>
            <button className="px-3 py-1.5 bg-[#E9EFF8] hover:bg-[#DBEAFE] text-[#1E3A8A] border border-[#BFDBFE] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-xl font-semibold transition-all cursor-pointer">
              {t('btnNext')}
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION DOCK (DRIBBLE CRM STYLE) */}
      {selectedRowIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 dark:bg-neutral-900/95 text-white shadow-2xl backdrop-blur-md border border-slate-700/80 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
            <span className="w-2 h-2 rounded-full bg-[#FF6422] animate-pulse" />
            <span className="text-xs font-bold tracking-wide">
              {selectedRowIds.length} {t('rowsSelected')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchPrintAll}
              className="px-3.5 py-1.5 rounded-xl bg-[#FF6422] hover:bg-[#E05316] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" /> {t('printLabelBtn')} ({selectedRowIds.length})
            </button>

            <button
              onClick={() => setSelectedRowIds([])}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer active:scale-95"
            >
              <X className="w-3.5 h-3.5" /> {t('btnCancel')}
            </button>
          </div>
        </div>
      )}

      {isSheetSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-master-xl border ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-[#DBEAFE] text-[#1E293B]'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#E9EFF8] dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase text-[#1E3A8A] dark:text-white">{t('selectWorksheets')}</h3>
                  <p className="text-xs text-[#475569] dark:text-slate-400 font-mono">
                    {lang === 'en' ? `Total ${availableSheets.length} worksheets found` : `Total ${availableSheets.length} lembar kerja ditemukan`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsSheetSelectorOpen(false); setPendingWorkbook(null); }}
                className="w-8 h-8 rounded-xl bg-[#E9EFF8] hover:bg-[#FFF1F2] text-[#475569] hover:text-[#BE123C] border border-[#CBD5E1] hover:border-rose-200 dark:bg-neutral-800 dark:text-slate-300 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-mono font-semibold text-[#475569] dark:text-slate-400">
                {selectedSheets.length} {lang === 'en' ? 'worksheets selected' : 'lembar kerja dipilih'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedSheets(availableSheets)}
                  className="text-xs text-[#2563EB] dark:text-blue-300 font-semibold hover:underline cursor-pointer"
                >
                  {lang === 'en' ? 'Select All' : 'Pilih Semua'}
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setSelectedSheets([])}
                  className="text-xs text-[#BE123C] dark:text-rose-300 font-semibold hover:underline cursor-pointer"
                >
                  {lang === 'en' ? 'Deselect All' : 'Hapus Pilihan'}
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 p-2.5 rounded-xl bg-[#F4F8FD] dark:bg-neutral-800/60 border border-[#DBEAFE] dark:border-neutral-700 mb-6 custom-scrollbar">
              {availableSheets.map((sheetName) => {
                const isChecked = selectedSheets.includes(sheetName);
                return (
                  <label
                    key={sheetName}
                    className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors border ${
                      isChecked
                        ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#C2410C] dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300 font-bold'
                        : 'hover:bg-[#E9EFF8]/70 dark:hover:bg-neutral-800 border-transparent text-[#475569] dark:text-slate-300'
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
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                    <span className="text-xs flex-1">{sheetName}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setIsSheetSelectorOpen(false); setPendingWorkbook(null); }}
                className="px-4 py-2 bg-[#E9EFF8] hover:bg-[#DBEAFE] text-[#334155] border border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={handleExecuteSelectedSheetsImport}
                disabled={isImporting || selectedSheets.length === 0}
                className="px-5 py-2 bg-[#FFF7ED] hover:bg-amber-100/80 text-[#C2410C] border border-[#FED7AA] dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 font-semibold rounded-xl text-xs shadow-master-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isImporting ? t('importing') : (lang === 'en' ? `Import ${selectedSheets.length} Worksheets` : `Impor ${selectedSheets.length} Lembar Kerja`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {isGSheetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-master-xl border ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-[#DBEAFE] text-[#1E293B]'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#E9EFF8] dark:border-neutral-800">
              <h3 className="font-bold text-sm uppercase flex items-center gap-2 text-[#1E3A8A] dark:text-white">
                <Globe className="w-4 h-4 text-[#2563EB] dark:text-blue-300" />
                <span>{t('googleSheetTitle')}</span>
              </h3>
              <button
                onClick={() => setIsGSheetModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#E9EFF8] hover:bg-[#FFF1F2] text-[#475569] hover:text-[#BE123C] border border-[#CBD5E1] hover:border-rose-200 dark:bg-neutral-800 dark:text-slate-300 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#475569] dark:text-slate-400 mb-4 leading-relaxed">
              {t('googleSheetDesc')}
            </p>

            <input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={gSheetUrlInput}
              onChange={(e) => setGSheetUrlInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border text-xs bg-[#F4F8FD] dark:bg-neutral-800 border-[#CBD5E1] dark:border-neutral-700 text-[#1E293B] dark:text-slate-200 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 mb-4 font-mono"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsGSheetModalOpen(false)}
                className="px-4 py-2 bg-[#E9EFF8] hover:bg-[#DBEAFE] text-[#334155] border border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={handleFetchGoogleSheet}
                disabled={isImporting}
                className="px-5 py-2 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl text-xs shadow-master-sm transition-all cursor-pointer active:scale-95"
              >
                {isImporting ? t('fetchingData') : t('continueSelectSheet')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PENCOCOKAN OTOMATIS DESK PRINT */}
      {isDeskPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-lg rounded-2xl p-6 shadow-master-xl border ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-[#DBEAFE] text-[#1E293B]'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#E9EFF8] dark:border-neutral-800">
              <h3 className="font-bold text-sm uppercase flex items-center gap-2 text-[#1E3A8A] dark:text-white">
                <FolderKanban className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                <span>{lang === 'en' ? 'Desk Print Image Auto-Matching' : 'Pencocokan Otomatis Gambar dari Desk Print'}</span>
              </h3>
              <button
                onClick={() => setIsDeskPrintModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-[#E9EFF8] hover:bg-[#FFF1F2] text-[#475569] hover:text-[#BE123C] border border-[#CBD5E1] hover:border-rose-200 dark:bg-neutral-800 dark:text-slate-300 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#475569] dark:text-slate-400 mb-4 leading-relaxed">
              {lang === 'en'
                ? 'Select a project folder from Desk Print. The system will automatically match branch item codes in Packing Station with available design images:'
                : 'Pilih folder proyek dari Desk Print. Sistem akan mencocokkan kode item cabang pada Panel Kendali Paking dengan gambar desain yang tersedia secara otomatis:'}
            </p>

            {deskPrintFolders.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-300 text-xs text-center mb-4">
                {lang === 'en'
                  ? 'No project folders found in Desk Print. Please open Desk Print in the sidebar to create folders and upload images first.'
                  : 'Belum ada folder proyek di Desk Print. Silakan buka menu Desk Print pada bilah samping untuk membuat folder dan mengunggah gambar terlebih dahulu.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-6 custom-scrollbar">
                {deskPrintFolders.map(folder => {
                  const isSelected = folder.id === selectedDeskFolderId;
                  const imgCount = (folder.images || []).length;
                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedDeskFolderId(folder.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-50/90 border-emerald-200/80 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-300 font-bold'
                          : 'bg-[#F4F8FD] dark:bg-neutral-800 border-[#DBEAFE] dark:border-neutral-700 text-[#1E293B] dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-bold">{folder.name}</h4>
                        <p className="text-[11px] text-[#475569] dark:text-slate-400 font-mono">
                          {imgCount} {lang === 'en' ? 'design images stored' : 'gambar desain tersimpan'}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <Check className="w-3.5 h-3.5" /> {lang === 'en' ? 'Selected' : 'Terpilih'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeskPrintModalOpen(false)}
                className="px-4 py-2 bg-[#E9EFF8] hover:bg-[#DBEAFE] text-[#334155] border border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                {t('btnCancel')}
              </button>
              <button
                onClick={handleExecuteAutoMatchDeskPrint}
                disabled={deskPrintFolders.length === 0}
                className="px-5 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold rounded-xl text-xs shadow-master-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {lang === 'en' ? 'Attach Design Images' : 'Pasang Gambar Desain'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PINDAI KODE QR OUTBOUND */}
      {showOutboundScanModal && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-master-xl ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-[#DBEAFE] text-[#1E293B]'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#E9EFF8] dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                <h3 className="font-bold text-sm uppercase text-[#1E3A8A] dark:text-white">
                  {lang === 'en' ? 'Scan Outbound QR Code' : 'Pindai Kode QR Pengiriman (Outbound)'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowOutboundScanModal(false);
                  setMatchedOutboundItem(null);
                  setOutboundScanMsg('');
                  setOutboundScannedCode('');
                }}
                className="w-8 h-8 rounded-xl bg-[#E9EFF8] hover:bg-[#FFF1F2] text-[#475569] hover:text-[#BE123C] border border-[#CBD5E1] hover:border-rose-200 dark:bg-neutral-800 dark:text-slate-300 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
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
                <div className="bg-emerald-50/90 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-300 shrink-0" />
                  <span>
                    {lang === 'en'
                      ? 'Point barcode scanner or camera at Package Label QR Code to capture delivery documentation.'
                      : 'Arahkan pemindai kode batang atau kamera ke Kode QR Label Kolian untuk mengambil dokumentasi pengiriman.'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-[#475569] dark:text-slate-300">
                    {lang === 'en' ? 'Enter / Scan Package Label QR Code:' : 'Masukkan / Pindai Kode QR Label Kolian:'}
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={outboundScannedCode}
                    onChange={(e) => setOutboundScannedCode(e.target.value)}
                    placeholder={lang === 'en' ? 'Scan Label QR Code / Enter Package Code...' : 'Pindai Kode QR Label / Masukkan Kode Kolian...'}
                    className={`w-full p-3 rounded-xl border font-mono text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
                      isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-[#F4F8FD] border-[#CBD5E1] text-[#1E293B]'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-bold rounded-xl transition-all cursor-pointer shadow-master-sm active:scale-95 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Process QR Code Scan' : 'Proses Pindai Kode QR'}</span>
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="bg-emerald-50/90 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 text-[#1E293B] dark:text-white space-y-1.5">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                    {lang === 'en' ? 'Package Data Detected' : 'Data Kolian Terdeteksi'}
                  </div>
                  <div className="text-base font-extrabold">{matchedOutboundItem.store_name}</div>
                  <div className="text-xs font-mono font-bold text-[#475569] dark:text-slate-300">
                    {lang === 'en' ? 'PACKAGE' : 'KOLIAN'}: {matchedOutboundItem.box_code || '-'} | SPK: {matchedOutboundItem.no_spk}
                  </div>
                </div>

                <label className="w-full py-3.5 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-bold rounded-xl transition-all cursor-pointer shadow-master-sm flex items-center justify-center gap-2 text-sm active:scale-95">
                  <Camera className="w-5 h-5" />
                  <span>{lang === 'en' ? 'Take / Upload Delivery Photo Now' : 'Ambil / Unggah Foto Pengiriman Sekarang'}</span>
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
                  className="w-full py-2 bg-[#E9EFF8] hover:bg-[#DBEAFE] text-[#334155] border border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 font-semibold rounded-xl text-xs cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Scan Another Package QR Code' : 'Pindai Kode QR Kolian Lain'}</span>
                </button>
              </div>
            )}

            {outboundScanMsg && (
              <div className={`mt-4 p-3 text-center text-xs font-bold rounded-xl border ${
                outboundScanMsg.startsWith('Kolian ditemukan') || outboundScanMsg.startsWith('Package found')
                  ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-[#FFF1F2] text-[#BE123C] border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
              }`}>
                {outboundScanMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL KELOLA FOTO DESAIN CABANG */}
      {editingRowItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-2xl p-6 overflow-y-auto shadow-master-xl border custom-scrollbar ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-[#DBEAFE] text-[#1E293B]'}`}>
            <div className="flex justify-between items-center mb-4 border-b border-[#E9EFF8] dark:border-neutral-800 pb-3">
              <div>
                <h3 className="font-bold text-base uppercase text-[#1E3A8A] dark:text-white">{t('manageDesignPhoto')}</h3>
                <p className="text-xs text-[#475569] dark:text-slate-400 font-mono font-semibold">{editingRowItem.store_name} ({editingRowItem.box_code})</p>
              </div>
              <button
                onClick={() => setEditingRowItem(null)}
                className="w-8 h-8 rounded-xl bg-[#E9EFF8] hover:bg-[#FFF1F2] text-[#475569] hover:text-[#BE123C] border border-[#CBD5E1] hover:border-rose-200 dark:bg-neutral-800 dark:text-slate-300 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {parseItems(editingRowItem.items_detail).map((itm, i) => (
                <div key={i} className={`p-4 rounded-xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700' : 'bg-[#F4F8FD] border-[#DBEAFE]'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm text-[#BE123C] dark:text-rose-300">{itm.code}</div>
                    <div className="text-xs font-semibold text-[#1E293B] dark:text-slate-200">{itm.desc}</div>
                    <div className="text-[11px] text-[#475569] dark:text-slate-400 font-mono mt-0.5">
                      {lang === 'en' ? 'Size' : 'Ukuran'}: {itm.size} | {lang === 'en' ? 'Qty' : 'Kuantitas'}: {itm.qty} Pcs
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {itm.image_url ? (
                      <img src={itm.image_url} alt={t('designsLabel')} className="w-16 h-10 object-contain rounded-lg border border-[#BFDBFE] bg-white" />
                    ) : (
                      <div className="w-16 h-10 rounded-lg bg-[#E9EFF8] dark:bg-neutral-700 flex items-center justify-center text-[9px] text-[#475569] dark:text-slate-400 italic">
                        {lang === 'en' ? 'None Yet' : 'Belum Ada'}
                      </div>
                    )}
                    <label className="px-3 py-1.5 bg-[#FFF7ED] hover:bg-amber-100/80 text-[#C2410C] border border-[#FED7AA] dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 font-semibold rounded-xl text-xs cursor-pointer active:scale-95">
                      {lang === 'en' ? 'Change Photo' : 'Ubah Foto'}
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
              margin: 0 auto 6mm auto !important;
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
                <h1 className="text-2xl font-black tracking-tight">SURAT JALAN & DAFTAR PAKING</h1>
                <p className="text-xs font-bold text-stone-600">PT. WELLEN PRINTING INDONESIA</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-bold">Tanggal: {new Date().toLocaleDateString('id-ID')}</p>
                <p className="font-mono font-bold">Total Kolian: {suratJalanGroup.length} Kolian</p>
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-xs mb-8">
              <thead>
                <tr className="bg-stone-100 font-black">
                  <th className="border border-black p-2 text-center w-12">No</th>
                  <th className="border border-black p-2">Kode Kolian</th>
                  <th className="border border-black p-2">Nama Cabang & Tujuan</th>
                  <th className="border border-black p-2">Nomor SPK / PO</th>
                  <th className="border border-black p-2 text-center">Jalur</th>
                  <th className="border border-black p-2 text-center">Status Pemeriksaan</th>
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
                    <td className="border border-black p-2 text-center font-black text-emerald-700">
                      {item.status_qc_checker === 'DONE' ? 'TERVERIFIKASI' : 'MENUNGGU'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-3 text-center text-xs font-bold pt-12">
              <div>
                <p>Bagian Paking</p>
                <div className="h-16"></div>
                <p>( ................................ )</p>
              </div>
              <div>
                <p>Ekspedisi / Pengemudi</p>
                <div className="h-16"></div>
                <p>( ................................ )</p>
              </div>
              <div>
                <p>Penerima Cabang</p>
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

      {/* MODAL PIN KEAMANAN UNTUK KOSONGKAN DATA */}
      {showClearPinModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${
            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{t('modalClearTitle')}</h3>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">{t('modalClearSubtitle')}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmClearAll} className="space-y-4 pt-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('modalClearDesc')}
              </p>

              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={clearPinInput}
                  onChange={(e) => {
                    setClearPinInput(e.target.value);
                    setClearPinError('');
                  }}
                  placeholder={t('modalClearPlaceholder')}
                  className="w-full text-center tracking-widest text-base font-mono font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-800/80 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-neutral-700 transition-all"
                />
                {clearPinError && (
                  <p className="text-xs font-semibold text-rose-500 mt-1.5 text-center">
                    {clearPinError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearPinModal(false);
                    setClearPinInput('');
                    setClearPinError('');
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('btnCancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white shadow-xs transition-colors cursor-pointer active:scale-95"
                >
                  {t('btnConfirmDelete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PIN KEAMANAN UNTUK HAPUS SATU PROYEK */}
      {showDeleteProjectModal && projectToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${
            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/50">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{t('deleteProjectTitle')}</h3>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">{t('deleteProjectSubtitle')}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmDeleteProject} className="space-y-4 pt-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('deleteProjectDesc')} <strong className="text-rose-600 dark:text-rose-400 font-bold">{projectToDelete.name}</strong> ({projectToDelete.totalBoxes} {t('boxes')}). {t('modalClearSubtitle')}:
              </p>

              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={deleteProjectPinInput}
                  onChange={(e) => {
                    setDeleteProjectPinInput(e.target.value);
                    setDeleteProjectPinError('');
                  }}
                  placeholder={t('modalClearPlaceholder')}
                  className="w-full text-center tracking-widest text-base font-mono font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-800/80 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-950 transition-all"
                />
                {deleteProjectPinError && (
                  <p className="text-xs font-semibold text-rose-500 mt-1.5 text-center">
                    {deleteProjectPinError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteProjectModal(false);
                    setProjectToDelete(null);
                    setDeleteProjectPinInput('');
                    setDeleteProjectPinError('');
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('btnCancel')}
                </button>
                <button
                  type="submit"
                  disabled={isDeletingProject}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isDeletingProject ? (lang === 'en' ? 'Deleting...' : 'Menghapus...') : t('btnConfirmDelete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}