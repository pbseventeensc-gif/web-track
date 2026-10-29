import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Printer,
  Package,
  Truck,
  Building2,
  Users,
  FileSpreadsheet,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Tag,
  Palette,
  FolderKanban,
  FolderCheck,
  Pause,
  Play,
  Box,
  ChevronRight,
  Globe,
  Check,
  ChevronDown
} from 'lucide-react';

const DASHBOARD_I18N = {
  id: {
    liveActive: 'Pembaruan Otomatis Aktif',
    livePaused: 'Pembaruan Otomatis Dijeda',
    lastUpdated: 'Pembaruan terakhir:',
    summaryTitle: 'Ringkasan Operasional Produksi & Distribusi',
    summaryDesc: 'Pemantauan terpadu progres Surat Perintah Kerja (SPK), pemeriksaan paking kolian, persetujuan pesanan cabang, serta dokumen pengiriman logistik.',
    pauseBtn: 'Jeda Pembaruan',
    resumeBtn: 'Aktifkan Pembaruan',
    refreshBtn: 'Muat Ulang Data',
    loadingBtn: 'Memuat Data...',
    importBtn: 'Impor SPK Excel',
    kpi1Title: '1. Antrean SPK & Cetak',
    kpi1Badge: 'SPK Aktif',
    kpi1Qty: 'Total Kuantitas Pesanan',
    kpi1Done: 'Penyelesaian Cetak',
    kpi2Title: '2. Paking & Kolian',
    kpi2Badge: 'Total Kolian',
    kpi2Packed: 'Terverifikasi Paking',
    kpi2Qc: 'Pemeriksaan Mutu (QC)',
    kpi3Title: '3. Cabang Kawan Lama',
    kpi3Badge: 'Cabang Terdaftar',
    kpi3Approved: 'Pesanan Disetujui',
    kpi3Pending: 'Menunggu Persetujuan',
    kpi3Orders: 'Pesanan',
    kpi3Queue: 'Antrean',
    kpi4Title: '4. Distribusi & Dokumen PMG',
    kpi4Badge: 'Pengiriman',
    kpi4Docs: 'Dokumen POD / Surat Jalan',
    kpi4Routes: 'Rute Dalam / Luar Kota',
    kpi4Projects: 'Proyek',
    kpi4Clients: 'Klien',
    stageSection: 'Tahapan Operasional',
    stageTitle: 'Capaian Aktual terhadap Target Penyelesaian (100%)',
    stageActual: 'Capaian Aktual',
    stageTarget: 'Batas Target 100%',
    stage1Name: 'Produksi Cetak & Pelabelan',
    stage2Name: 'Paking & Dokumentasi Foto',
    stage3Name: 'Pemeriksaan Mutu (QC Checker)',
    stage4Name: 'Pengiriman & Surat Jalan (Outbound)',
    targetAchieved: 'Target Tercapai',
    onSchedule: 'Sesuai Jadwal',
    waitingData: 'Menunggu Data',
    inProgress: 'Dalam Pengerjaan',
    stageHint: 'Pilih salah satu baris tahapan di atas untuk membuka halaman kerja divisi terkait.',
    totalTracked: 'Total Data Terpantau:',
    itemsUnit: 'Item',
    workstationSection: 'Rasio Penyelesaian Divisi',
    workstationTitle: 'Persentase Progres Stasiun Kerja',
    wsPrint: 'Cetak & Label',
    wsPack: 'Paking',
    wsQc: 'Pemeriksaan Mutu',
    wsDeliver: 'Distribusi / Kirim',
    routeAllocation: 'Alokasi Rute Pengiriman:',
    inTown: 'Dalam Kota',
    outOfTown: 'Luar Kota',
    activitySection: 'Daftar Aktivitas Lintas Divisi',
    activityTitle: 'Pemantauan SPK, Paking & Dokumen Pengiriman',
    statusAll: 'Status',
    statusProcess: 'Dalam Proses',
    statusDone: 'Selesai',
    statusPending: 'Menunggu',
    tabAll: 'Semua',
    tabSpk: 'SPK Cetak',
    tabPack: 'Kolian',
    tabKl: 'Pesanan KL',
    tabPmg: 'Dokumen PMG',
    searchPlaceholder: 'Cari kode, nama cabang, atau nomor SPK...',
    stageFilterLabel: 'Status Tahapan',
    quickAccess: 'Pintasan & Status Stasiun',
    openWorkspace: 'Buka Workspace',
    emptyFeed: 'Tidak ada aktivitas alur kerja yang sesuai kriteria pencarian.',
    emptyReset: 'Tampilkan Semua Aktivitas',
    thRefCode: 'Kode Referensi',
    thProjectSpecs: 'Proyek / Tujuan & Spesifikasi',
    thProgress: 'Capaian',
    thStatus: 'Status',
    thAction: 'Aksi',
    btnOpen: 'Buka',
    emptyFeedMsg: 'Belum ada data yang sesuai dengan kriteria pencarian.',
    emptyFeedHint: 'Gunakan tombol Impor SPK Excel di atas atau buka Packing Station untuk menambahkan data baru.',
    navSection: 'Navigasi Cepat Antar Divisi',
    navTitle: 'Pintasan Modul Operasional',
    qmDeskPrint: 'Penyimpanan Pracetak',
    qmDeskPrintDesc: 'Folder proyek & gambar desain master',
    qmDesign: 'Panel Desain',
    qmDesignDesc: 'Antrean desain & persetujuan cabang',
    qmProd: 'Produksi Cetak',
    qmProdDesc: 'Tabel pemantauan SPK & kuantitas cetak',
    qmPacking: 'Packing Station',
    qmPackingDesc: 'Kendali kolian, kode QR & bukti foto',
    qmArchive: 'Arsip Proyek Selesai',
    qmArchiveDesc: 'Rekapitulasi proyek & kolian tuntas',
    qmLabel: 'Cetak Label & Surat Jalan',
    qmLabelDesc: 'Pembuatan label pengiriman & dokumen SJ',
    qmKl: 'Manajemen Kawan Lama',
    qmKlDesc: 'cabang terdaftar & pesanan promosi',
    qmPmg: 'Modul Alokasi PMG',
    qmPmgDesc: 'dokumen POD & surat jalan'
  },
  en: {
    liveActive: 'Auto Update Active',
    livePaused: 'Auto Update Paused',
    lastUpdated: 'Last updated:',
    summaryTitle: 'Production & Distribution Operations Summary',
    summaryDesc: 'Unified monitoring of Work Orders (SPK), packing box inspection, branch order approvals, and shipping logistics documents.',
    pauseBtn: 'Pause Updates',
    resumeBtn: 'Resume Updates',
    refreshBtn: 'Refresh Data',
    loadingBtn: 'Loading Data...',
    importBtn: 'Import SPK Excel',
    kpi1Title: '1. SPK & Print Queue',
    kpi1Badge: 'Active SPK',
    kpi1Qty: 'Total Order Quantity',
    kpi1Done: 'Print Completion',
    kpi2Title: '2. Packing & Boxes',
    kpi2Badge: 'Total Boxes',
    kpi2Packed: 'Verified Packed',
    kpi2Qc: 'Quality Control (QC)',
    kpi3Title: '3. Kawan Lama Branches',
    kpi3Badge: 'Registered Branches',
    kpi3Approved: 'Approved Orders',
    kpi3Pending: 'Pending Approval',
    kpi3Orders: 'Orders',
    kpi3Queue: 'In Queue',
    kpi4Title: '4. PMG Logistics & Docs',
    kpi4Badge: 'Shipments',
    kpi4Docs: 'POD / Waybill Documents',
    kpi4Routes: 'In-Town / Out-of-Town Routes',
    kpi4Projects: 'Projects',
    kpi4Clients: 'Clients',
    stageSection: 'Operational Stages',
    stageTitle: 'Actual Progress vs Completion Target (100%)',
    stageActual: 'Actual Progress',
    stageTarget: '100% Target Limit',
    stage1Name: 'Print Production & Labeling',
    stage2Name: 'Packing & Photo Documentation',
    stage3Name: 'Quality Control (QC Checker)',
    stage4Name: 'Shipping & Outbound Waybill',
    targetAchieved: 'Target Reached',
    onSchedule: 'On Schedule',
    waitingData: 'Waiting Data',
    inProgress: 'In Progress',
    stageHint: 'Select any operational stage above to open its respective workspace.',
    totalTracked: 'Total Tracked Items:',
    itemsUnit: 'Items',
    workstationSection: 'Division Completion Ratio',
    workstationTitle: 'Workstation Progress Percentage',
    wsPrint: 'Print & Label',
    wsPack: 'Packing',
    wsQc: 'Quality Control',
    wsDeliver: 'Distribution / Ship',
    routeAllocation: 'Shipping Route Allocation:',
    inTown: 'In Town',
    outOfTown: 'Out of Town',
    activitySection: 'Cross-Division Activity List',
    activityTitle: 'Tracking SPK, Packing & Waybill Documents',
    statusAll: 'Status',
    statusProcess: 'In Progress',
    statusDone: 'Completed',
    statusPending: 'Pending',
    tabAll: 'All',
    tabSpk: 'Print SPK',
    tabPack: 'Boxes',
    tabKl: 'KL Orders',
    tabPmg: 'PMG Documents',
    searchPlaceholder: 'Search code, branch name, or SPK number...',
    stageFilterLabel: 'Stage Status',
    quickAccess: 'Shortcuts & Station Status',
    openWorkspace: 'Open Workspace',
    emptyFeed: 'No workflow activities match your search criteria.',
    emptyReset: 'Show All Activities',
    thRefCode: 'Reference Code',
    thProjectSpecs: 'Project / Destination & Specs',
    thProgress: 'Progress',
    thStatus: 'Status',
    thAction: 'Action',
    btnOpen: 'Open',
    emptyFeedMsg: 'No data matches your search criteria.',
    emptyFeedHint: 'Use the Import SPK Excel button above or open Packing Station to add new data.',
    navSection: 'Cross-Division Quick Navigation',
    navTitle: 'Operational Module Shortcuts',
    qmDeskPrint: 'Pre-Print Storage',
    qmDeskPrintDesc: 'Project folders & master design artwork',
    qmDesign: 'Design Panel',
    qmDesignDesc: 'Design queue & branch approvals',
    qmProd: 'Print Production',
    qmProdDesc: 'SPK monitoring table & print quantities',
    qmPacking: 'Packing Station',
    qmPackingDesc: 'Box control, QR codes & photo verification',
    qmArchive: 'Project Archive',
    qmArchiveDesc: 'Recap of completed projects & boxes',
    qmLabel: 'Print Labels & Waybills',
    qmLabelDesc: 'Delivery label generation & waybill docs',
    qmKl: 'Kawan Lama Management',
    qmKlDesc: 'registered branches & promo orders',
    qmPmg: 'PMG Allocation Module',
    qmPmgDesc: 'POD documents & waybills'
  }
};

function SemiCircleGauge({ percent = 0, color = '#60A5FA', isDarkMode, label, sublabel }) {
  const radius = 40;
  const strokeWidth = 8;
  const circumference = Math.PI * radius;
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  const strokeOffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-20 flex items-end justify-center">
        <svg viewBox="0 0 100 56" className="w-full h-full overflow-visible" aria-hidden="true">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke={isDarkMode ? '#334155' : '#E2E8F0'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="fill-none"
          />
          {safePercent > 0 && (
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="fill-none transition-all duration-500 ease-out motion-reduce:transition-none"
            />
          )}
        </svg>
        <div className="absolute bottom-0 text-center">
          <span className="text-2xl font-bold tracking-tight tabular-nums leading-none block text-slate-800 dark:text-slate-100">
            {safePercent}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-semibold mt-1.5 text-slate-700 dark:text-slate-200">{label}</span>
      )}
      {sublabel && (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">{sublabel}</span>
      )}
    </div>
  );
}

export default function ProductionDashboard({
  isDarkMode,
  spkList = [],
  setActiveTab,
  onOpenSpkImport,
  onRefreshSpk,
  language: propLang,
  onLanguageChange
}) {
  const [localLang, setLocalLang] = useState(() => localStorage.getItem('app_language') || 'id');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  useEffect(() => {
    const handleLangChange = () => {
      setLocalLang(localStorage.getItem('app_language') || 'id');
    };
    window.addEventListener('app_language_changed', handleLangChange);
    return () => window.removeEventListener('app_language_changed', handleLangChange);
  }, []);

  const currentLang = propLang || localLang || 'id';
  const t = DASHBOARD_I18N[currentLang] || DASHBOARD_I18N.id;

  const handleSelectLanguage = (newLang) => {
    localStorage.setItem('app_language', newLang);
    setLocalLang(newLang);
    if (onLanguageChange) onLanguageChange(newLang);
    setIsLangDropdownOpen(false);
    window.dispatchEvent(new Event('app_language_changed'));
  };

  const [packingData, setPackingData] = useState([]);
  const [klOrders, setKlOrders] = useState([]);
  const [klBranchesCount, setKlBranchesCount] = useState(0);
  const [pmgProjects, setPmgProjects] = useState([]);
  const [customersCount, setCustomersCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveEnabled, setIsLiveEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [activeFeedTab, setActiveFeedTab] = useState('ALL');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');

  const fetchDashboardTelemetry = useCallback(async () => {
    setIsLoading(true);
    try {
      const [packingRes, klOrdersRes, klBranchesRes, pmgRes, custRes] = await Promise.all([
        supabase
          .from('packing_tracking')
          .select('id, status_qc_label, status_qc_packing, bukti_paking_url, status_qc_checker, status_deliver, delivery_type, box_code, no_spk, store_name, promo_title, updated_at')
          .order('id', { ascending: false })
          .limit(200),
        supabase
          .from('kl_orders')
          .select('*, kl_branches(branch_name)')
          .order('updated_at', { ascending: false })
          .limit(50),
        supabase.from('kl_branches').select('id', { count: 'exact', head: true }),
        supabase
          .from('pmg_projects')
          .select('id, project_name, deliver_to, delivery_date, created_at')
          .order('id', { ascending: false })
          .limit(50),
        supabase.from('customers').select('id', { count: 'exact', head: true })
      ]);

      if (!packingRes.error && packingRes.data) {
        setPackingData(packingRes.data);
      }
      if (!klOrdersRes.error && klOrdersRes.data) {
        setKlOrders(klOrdersRes.data);
      }
      if (!klBranchesRes.error && typeof klBranchesRes.count === 'number') {
        setKlBranchesCount(klBranchesRes.count);
      }
      if (!pmgRes.error && pmgRes.data) {
        setPmgProjects(pmgRes.data);
      }
      if (!custRes.error && typeof custRes.count === 'number') {
        setCustomersCount(custRes.count);
      }
      setLastUpdated(new Date());
    } catch {
      // Fallback gracefully if network is temporarily unavailable
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardTelemetry();
  }, [fetchDashboardTelemetry]);

  useEffect(() => {
    if (!isLiveEnabled) return undefined;

    let debounceTimer = null;
    const triggerDebouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchDashboardTelemetry();
      }, 500);
    };

    const channel = supabase
      .channel('dashboard_telemetry_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packing_tracking' }, triggerDebouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kl_orders' }, triggerDebouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pmg_projects' }, triggerDebouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [isLiveEnabled, fetchDashboardTelemetry]);

  const handleManualRefresh = () => {
    fetchDashboardTelemetry();
    if (onRefreshSpk) onRefreshSpk();
  };

  const metrics = useMemo(() => {
    const totalSpk = spkList.length;
    const totalOrderQty = spkList.reduce((acc, s) => acc + (Number(s.qty_order) || 0), 0);
    const totalPrintQty = spkList.reduce((acc, s) => acc + (Number(s.qty_print) || 0), 0);
    const totalFinishQty = spkList.reduce((acc, s) => acc + (Number(s.qty_finish) || 0), 0);
    const totalPackQty = spkList.reduce((acc, s) => acc + (Number(s.qty_pack) || 0), 0);
    const totalShipQty = spkList.reduce((acc, s) => acc + (Number(s.qty_ship) || 0), 0);

    const spkPrintDone = spkList.filter(s => Number(s.qty_print) > 0 && Number(s.qty_print) >= Number(s.qty_order || 1)).length;
    const spkFinishDone = spkList.filter(s => Number(s.qty_finish) > 0 && Number(s.qty_finish) >= Number(s.qty_order || 1)).length;
    const spkPackDone = spkList.filter(s => Number(s.qty_pack) > 0 && Number(s.qty_pack) >= Number(s.qty_order || 1)).length;
    const spkShipDone = spkList.filter(s => Number(s.qty_ship) > 0 && Number(s.qty_ship) >= Number(s.qty_order || 1)).length;

    const totalBoxes = packingData.length;
    const qcLabelDone = packingData.filter(b => String(b.status_qc_label || '').toUpperCase() === 'DONE').length;
    const qcPackingDone = packingData.filter(b => {
      const hasPhoto = b.bukti_paking_url && b.bukti_paking_url !== 'No Foto' && b.bukti_paking_url.length > 5;
      return String(b.status_qc_packing || '').toUpperCase() === 'DONE' || hasPhoto;
    }).length;
    const qcCheckerDone = packingData.filter(b => String(b.status_qc_checker || '').toUpperCase() === 'DONE').length;
    const deliverDone = packingData.filter(b => String(b.status_deliver || '').toUpperCase() === 'DONE').length;

    const dalamKotaBoxes = packingData.filter(b => String(b.delivery_type || 'DALAM KOTA').toUpperCase().includes('DALAM')).length;
    const luarKotaBoxes = Math.max(0, totalBoxes - dalamKotaBoxes);

    const printPercent = totalSpk > 0
      ? Math.round((spkPrintDone / totalSpk) * 100)
      : (totalBoxes > 0 ? Math.round((qcLabelDone / totalBoxes) * 100) : 0);

    const finishPercent = totalSpk > 0
      ? Math.round((spkFinishDone / totalSpk) * 100)
      : (totalBoxes > 0 ? Math.round((qcPackingDone / totalBoxes) * 100) : 0);

    const packPercent = totalBoxes > 0
      ? Math.round((qcPackingDone / totalBoxes) * 100)
      : (totalSpk > 0 ? Math.round((spkPackDone / totalSpk) * 100) : 0);

    const checkerPercent = totalBoxes > 0
      ? Math.round((qcCheckerDone / totalBoxes) * 100)
      : 0;

    const deliverPercent = totalBoxes > 0
      ? Math.round((deliverDone / totalBoxes) * 100)
      : (totalSpk > 0 ? Math.round((spkShipDone / totalSpk) * 100) : 0);

    const approvedKlOrders = klOrders.filter(o => String(o.status || '').toUpperCase() === 'APPROVED').length;
    const pendingKlOrders = klOrders.filter(o => String(o.status || '').toUpperCase() === 'PENDING').length;

    return {
      totalSpk,
      totalOrderQty,
      totalPrintQty,
      totalFinishQty,
      totalPackQty,
      totalShipQty,
      spkPrintDone,
      spkFinishDone,
      spkPackDone,
      spkShipDone,
      totalBoxes,
      qcLabelDone,
      qcPackingDone,
      qcCheckerDone,
      deliverDone,
      dalamKotaBoxes,
      luarKotaBoxes,
      printPercent,
      finishPercent,
      packPercent,
      checkerPercent,
      deliverPercent,
      approvedKlOrders,
      pendingKlOrders
    };
  }, [spkList, packingData, klOrders]);

  const unifiedFeed = useMemo(() => {
    const items = [];

    spkList.forEach(spk => {
      const orderQty = Number(spk.qty_order) || 0;
      const printQty = Number(spk.qty_print) || 0;
      const packQty = Number(spk.qty_pack) || 0;
      const shipQty = Number(spk.qty_ship) || 0;
      const progress = orderQty > 0 ? Math.min(100, Math.round((printQty / orderQty) * 100)) : 0;
      const status = shipQty >= orderQty && orderQty > 0
        ? 'COMPLETED'
        : (printQty > 0 || packQty > 0 ? 'IN_PROGRESS' : 'PENDING');

      items.push({
        uid: `spk-${spk.id}`,
        category: 'SPK',
        code: spk.no_spk || `SPK-${spk.id}`,
        title: spk.project || 'SPK Produksi Cetak',
        subtitle: `${spk.client || 'Internal'} • ${spk.bahan || 'Bahan Standar'} (${Number(orderQty).toLocaleString('id-ID')} pcs)`,
        progress,
        status,
        badgeText: status === 'COMPLETED' ? 'Terkirim' : (status === 'IN_PROGRESS' ? `Cetak ${progress}%` : 'Antrean Cetak'),
        targetTab: 'produksi'
      });
    });

    packingData.forEach(box => {
      const hasPhoto = box.bukti_paking_url && box.bukti_paking_url !== 'No Foto' && box.bukti_paking_url.length > 5;
      const isPacked = String(box.status_qc_packing || '').toUpperCase() === 'DONE' || hasPhoto;
      const isChecked = String(box.status_qc_checker || '').toUpperCase() === 'DONE';
      const isDelivered = String(box.status_deliver || '').toUpperCase() === 'DONE';
      const stepsDone = [
        String(box.status_qc_label || '').toUpperCase() === 'DONE',
        isPacked,
        isChecked,
        isDelivered
      ].filter(Boolean).length;
      const progress = Math.round((stepsDone / 4) * 100);
      const status = isDelivered ? 'COMPLETED' : (stepsDone > 0 ? 'IN_PROGRESS' : 'PENDING');

      items.push({
        uid: `box-${box.id}`,
        category: 'PACKING',
        code: box.box_code || box.no_spk || `BOX-${box.id}`,
        title: box.store_name || 'Cabang Tujuan',
        subtitle: `${box.promo_title || 'Proyek Paking'} • ${box.delivery_type || 'DALAM KOTA'}`,
        progress,
        status,
        badgeText: isDelivered ? 'Terkirim' : (isChecked ? 'Terverifikasi QC' : (isPacked ? 'Selesai Kemas' : 'Menunggu Paking')),
        targetTab: 'paking'
      });
    });

    klOrders.forEach(order => {
      const st = String(order.status || 'PENDING').toUpperCase();
      const isApproved = st === 'APPROVED';
      items.push({
        uid: `kl-${order.id}`,
        category: 'KAWAN_LAMA',
        code: `KL-${order.id}`,
        title: order.kl_branches?.branch_name || `Cabang #${order.branch_id || '-'}`,
        subtitle: `Pesanan Program Promosi • Status: ${isApproved ? 'Disetujui' : 'Menunggu Persetujuan'}`,
        progress: isApproved ? 100 : 50,
        status: isApproved ? 'COMPLETED' : 'IN_PROGRESS',
        badgeText: isApproved ? 'Disetujui' : 'Menunggu',
        targetTab: 'kawan_lama'
      });
    });

    pmgProjects.forEach(pmg => {
      items.push({
        uid: `pmg-${pmg.id}`,
        category: 'PMG',
        code: pmg.dr_no || pmg.transaction_code || `PMG-${pmg.id}`,
        title: pmg.project_name || 'Proyek Alokasi PMG',
        subtitle: `${pmg.company_name || 'PT. PMG'} • Tanggal: ${pmg.delivery_date || '-'}`,
        progress: 100,
        status: 'COMPLETED',
        badgeText: 'Dokumen POD / SJ',
        targetTab: 'custom_modules'
      });
    });

    return items;
  }, [spkList, packingData, klOrders, pmgProjects]);

  const filteredFeed = useMemo(() => {
    return unifiedFeed.filter(item => {
      if (activeFeedTab !== 'ALL' && item.category !== activeFeedTab) return false;
      if (stageFilter !== 'ALL' && item.status !== stageFilter) return false;
      if (dashboardSearch.trim() !== '') {
        const q = dashboardSearch.toLowerCase();
        const matchCode = (item.code || '').toLowerCase().includes(q);
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchSub = (item.subtitle || '').toLowerCase().includes(q);
        return matchCode || matchTitle || matchSub;
      }
      return true;
    });
  }, [unifiedFeed, activeFeedTab, stageFilter, dashboardSearch]);

  const bulletStages = [
    {
      id: 'print',
      label: t.stage1Name,
      dept: 'Divisi Cetak & Label',
      doneCount: metrics.totalSpk > 0 ? metrics.spkPrintDone : metrics.qcLabelDone,
      totalCount: metrics.totalSpk > 0 ? metrics.totalSpk : metrics.totalBoxes,
      unit: metrics.totalSpk > 0 ? 'SPK' : t.tabPack,
      percent: metrics.printPercent,
      barColor: 'bg-blue-400/80 dark:bg-blue-500/70',
      badgeBg: 'bg-blue-50/90 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
      targetTab: 'produksi'
    },
    {
      id: 'pack',
      label: t.stage2Name,
      dept: 'Divisi Paking',
      doneCount: metrics.qcPackingDone,
      totalCount: metrics.totalBoxes,
      unit: t.tabPack,
      percent: metrics.packPercent,
      barColor: 'bg-emerald-400/80 dark:bg-emerald-500/70',
      badgeBg: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
      targetTab: 'paking'
    },
    {
      id: 'checker',
      label: t.stage3Name,
      dept: 'Divisi Pemeriksaan Mutu',
      doneCount: metrics.qcCheckerDone,
      totalCount: metrics.totalBoxes,
      unit: t.tabPack,
      percent: metrics.checkerPercent,
      barColor: 'bg-amber-400/80 dark:bg-amber-500/70',
      badgeBg: 'bg-amber-50/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
      targetTab: 'paking'
    },
    {
      id: 'deliver',
      label: t.stage4Name,
      dept: 'Divisi Distribusi',
      doneCount: metrics.totalBoxes > 0 ? metrics.deliverDone : metrics.spkShipDone,
      totalCount: metrics.totalBoxes > 0 ? metrics.totalBoxes : metrics.totalSpk,
      unit: metrics.totalBoxes > 0 ? t.tabPack : 'SPK',
      percent: metrics.deliverPercent,
      barColor: 'bg-orange-400/80 dark:bg-orange-500/70',
      badgeBg: 'bg-orange-50/90 text-orange-800 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',
      targetTab: 'close_project'
    }
  ];

  const quickModules = [
    { id: 'desk_print', label: t.qmDeskPrint, desc: t.qmDeskPrintDesc, icon: FolderKanban, accent: 'text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/80 dark:border-blue-800/60' },
    { id: 'design', label: t.qmDesign, desc: t.qmDesignDesc, icon: Palette, accent: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/60' },
    { id: 'produksi', label: t.qmProd, desc: t.qmProdDesc, icon: Printer, accent: 'text-sky-700 dark:text-sky-300 bg-sky-50/80 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800/60' },
    { id: 'paking', label: t.qmPacking, desc: t.qmPackingDesc, icon: Package, accent: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/60' },
    { id: 'close_project', label: t.qmArchive, desc: t.qmArchiveDesc, icon: FolderCheck, accent: 'text-purple-700 dark:text-purple-300 bg-purple-50/80 dark:bg-purple-950/40 border-purple-200/80 dark:border-purple-800/60' },
    { id: 'label', label: t.qmLabel, desc: t.qmLabelDesc, icon: Tag, accent: 'text-orange-700 dark:text-orange-300 bg-orange-50/80 dark:bg-orange-950/40 border-orange-200/80 dark:border-orange-800/60' },
    { id: 'kawan_lama', label: t.qmKl, desc: `${klBranchesCount} ${t.qmKlDesc}`, icon: Building2, accent: 'text-amber-800 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/60' },
    { id: 'custom_modules', label: t.qmPmg, desc: `${pmgProjects.length} ${t.qmPmgDesc}`, icon: Users, accent: 'text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/60' }
  ];

  const formattedTime = lastUpdated.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* 1. RINGKASAN OPERASIONAL HEADER */}
      <section
        aria-label="Ringkasan Operasional Produksi"
        className={`rounded-3xl p-5 sm:p-7 border shadow-xs transition-colors duration-200 relative overflow-hidden ${
          isDarkMode
            ? 'bg-neutral-800/90 border-neutral-700/80 text-white'
            : 'bg-white border-slate-200/80 text-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isLiveEnabled
                  ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-slate-100/80 text-slate-600 border-slate-200/80 dark:bg-neutral-700/60 dark:text-slate-300 dark:border-neutral-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isLiveEnabled ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                {isLiveEnabled ? t.liveActive : t.livePaused}
              </span>

              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                {t.lastUpdated} <strong className="font-semibold text-slate-700 dark:text-slate-200">{formattedTime}</strong>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-white leading-tight">
              {t.summaryTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.summaryDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Pilihan Bahasa (ID / EN) Pill Button - Matching Image 2 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangDropdownOpen(prev => !prev)}
                className={`px-3.5 py-2.5 rounded-full text-xs font-semibold border inline-flex items-center gap-2 transition-all duration-200 cursor-pointer shadow-2xs select-none active:scale-95 ${
                  isDarkMode
                    ? 'bg-neutral-900/80 hover:bg-neutral-700/80 text-slate-200 border-neutral-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300/80'
                }`}
                title={currentLang === 'id' ? 'Pilihan Bahasa (Indonesia / English)' : 'Language Selection (Indonesia / English)'}
              >
                <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <span className="font-bold tracking-tight">{currentLang === 'id' ? 'ID-ID' : 'EN-GB'}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isLangDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200/90 dark:border-neutral-700 shadow-xl p-1.5 z-40 space-y-1">
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('id')}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      currentLang === 'id'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🇮🇩</span>
                      <span>ID-ID</span>
                    </span>
                    {currentLang === 'id' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('en')}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      currentLang === 'en'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🇬🇧</span>
                      <span>EN-GB</span>
                    </span>
                    {currentLang === 'en' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsLiveEnabled(prev => !prev)}
              aria-pressed={isLiveEnabled}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isDarkMode
                  ? 'bg-neutral-900/70 hover:bg-neutral-700/70 text-slate-200 border-neutral-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
              }`}
              title={isLiveEnabled ? t.pauseBtn : t.resumeBtn}
            >
              {isLiveEnabled ? <Pause className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              <span>{isLiveEnabled ? t.pauseBtn : t.resumeBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isLoading}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isDarkMode
                  ? 'bg-neutral-900/70 hover:bg-neutral-700/70 text-slate-200 border-neutral-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? t.loadingBtn : t.refreshBtn}</span>
            </button>

            {onOpenSpkImport && (
              <button
                type="button"
                onClick={onOpenSpkImport}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t.importBtn}</span>
              </button>
            )}

          </div>
        </div>
      </section>

      {/* 2. KARTU INDIKATOR UTAMA (4 KOLOM) */}
      <section aria-label="Indikator Kinerja Utama" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <div
          onClick={() => setActiveTab && setActiveTab('produksi')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab && setActiveTab('produksi')}
          className={`p-5 rounded-2xl border shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                {t.kpi1Title}
              </span>
              <div className="text-3xl font-bold tracking-tight tabular-nums mt-1">
                {metrics.totalSpk.toLocaleString('id-ID')}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1.5">{t.kpi1Badge}</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 text-blue-600 dark:text-blue-300">
              <Printer className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi1Qty}</span>
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {metrics.totalOrderQty.toLocaleString('id-ID')} pcs
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi1Done}</span>
              <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-300 inline-flex items-center gap-1">
                {metrics.spkPrintDone} SPK ({metrics.printPercent}%) <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab && setActiveTab('paking')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab && setActiveTab('paking')}
          className={`p-5 rounded-2xl border shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                {t.kpi2Title}
              </span>
              <div className="text-3xl font-bold tracking-tight tabular-nums mt-1">
                {metrics.totalBoxes.toLocaleString('id-ID')}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1.5">{t.kpi2Badge}</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-300">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi2Packed}</span>
              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {metrics.qcPackingDone} / {metrics.totalBoxes} {t.tabPack}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi2Qc}</span>
              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                {metrics.qcCheckerDone} {t.tabPack} ({metrics.checkerPercent}%) <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab && setActiveTab('kawan_lama')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab && setActiveTab('kawan_lama')}
          className={`p-5 rounded-2xl border shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                {t.kpi3Title}
              </span>
              <div className="text-3xl font-bold tracking-tight tabular-nums mt-1">
                {klBranchesCount.toLocaleString('id-ID')}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1.5">{t.kpi3Badge}</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 text-amber-700 dark:text-amber-300">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi3Approved}</span>
              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {metrics.approvedKlOrders} {t.kpi3Orders}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi3Pending}</span>
              <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                {metrics.pendingKlOrders} {t.kpi3Queue} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>

        <div
          onClick={() => setActiveTab && setActiveTab('custom_modules')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab && setActiveTab('custom_modules')}
          className={`p-5 rounded-2xl border shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300 block">
                {t.kpi4Title}
              </span>
              <div className="text-3xl font-bold tracking-tight tabular-nums mt-1">
                {(pmgProjects.length + metrics.deliverDone).toLocaleString('id-ID')}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1.5">{t.kpi4Badge}</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-800/60 text-orange-600 dark:text-orange-300">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-neutral-700/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi4Docs}</span>
              <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                {pmgProjects.length} {t.kpi4Projects} ({customersCount} {t.kpi4Clients})
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">{t.kpi4Routes}</span>
              <span className="font-semibold tabular-nums text-orange-700 dark:text-orange-300 inline-flex items-center gap-1">
                {metrics.dalamKotaBoxes} DK • {metrics.luarKotaBoxes} LK <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CAPAIAN TAHAPAN OPERASIONAL */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={`lg:col-span-7 p-5 sm:p-6 rounded-3xl border shadow-xs flex flex-col justify-between ${
          isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-neutral-700/70">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                {t.stageSection}
              </span>
              <h3 className="text-base sm:text-lg font-bold tracking-tight mt-0.5">
                {t.stageTitle}
              </h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-300 inline-block" /> {t.stageActual}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-0.5 h-3.5 bg-slate-400 dark:bg-slate-400 inline-block" /> {t.stageTarget}
              </span>
            </div>
          </div>

          <div className="space-y-4 my-4">
            {bulletStages.map((stage) => {
              const statusLabel = stage.percent >= 100
                ? t.targetAchieved
                : stage.percent >= 50
                  ? t.onSchedule
                  : stage.totalCount === 0
                    ? t.waitingData
                    : t.inProgress;

              return (
                <div
                  key={stage.id}
                  onClick={() => setActiveTab && setActiveTab(stage.targetTab)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveTab && setActiveTab(stage.targetTab)}
                  className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isDarkMode
                      ? 'bg-neutral-900/50 border-neutral-700/70 hover:bg-neutral-900/80'
                      : 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white">
                        {stage.label}
                      </span>
                      <span className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full border ${stage.badgeBg}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {stage.doneCount.toLocaleString(currentLang === 'en' ? 'en-US' : 'id-ID')} / {stage.totalCount.toLocaleString(currentLang === 'en' ? 'en-US' : 'id-ID')} {stage.unit}{' '}
                      <span className="text-slate-400 dark:text-slate-500">({stage.percent}%)</span>
                    </div>
                  </div>

                  <div className="relative h-3 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700 flex">
                    <div className="w-[40%] h-full bg-rose-100/40 dark:bg-rose-950/20 border-r border-slate-200/60 dark:border-neutral-700/50" />
                    <div className="w-[40%] h-full bg-amber-100/40 dark:bg-amber-950/20 border-r border-slate-200/60 dark:border-neutral-700/50" />
                    <div className="w-[20%] h-full bg-emerald-100/40 dark:bg-emerald-950/20" />

                    <div
                      className={`absolute top-0.5 bottom-0.5 left-0 rounded-full transition-all duration-500 ease-out motion-reduce:transition-none ${stage.barColor}`}
                      style={{ width: `${Math.max(stage.percent > 0 ? 3 : 0, stage.percent)}%` }}
                    />

                    <div
                      className="absolute top-0 bottom-0 right-1 w-0.5 bg-slate-400 dark:bg-slate-400"
                      title="Target: 100%"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-neutral-700/70 text-xs text-slate-500 dark:text-slate-400">
            <span>{t.stageHint}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {t.totalTracked} {unifiedFeed.length} {t.itemsUnit}
            </span>
          </div>
        </div>

        <div className={`lg:col-span-5 p-5 sm:p-6 rounded-3xl border shadow-xs flex flex-col justify-between ${
          isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
        }`}>
          <div className="pb-4 border-b border-slate-100 dark:border-neutral-700/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
              {t.workstationSection}
            </span>
            <h3 className="text-base sm:text-lg font-bold tracking-tight mt-0.5">
              {t.workstationTitle}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 my-auto py-4">
            <div className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? 'bg-neutral-900/50 border-neutral-700/70' : 'bg-slate-50/70 border-slate-200/70'
            }`}>
              <SemiCircleGauge
                percent={metrics.printPercent}
                color="#60A5FA"
                isDarkMode={isDarkMode}
                label={t.wsPrint}
                sublabel={metrics.totalSpk > 0 ? `${metrics.spkPrintDone}/${metrics.totalSpk} SPK` : `${metrics.qcLabelDone}/${metrics.totalBoxes} ${t.tabPack}`}
              />
            </div>

            <div className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? 'bg-neutral-900/50 border-neutral-700/70' : 'bg-slate-50/70 border-slate-200/70'
            }`}>
              <SemiCircleGauge
                percent={metrics.packPercent}
                color="#34D399"
                isDarkMode={isDarkMode}
                label={t.wsPack}
                sublabel={`${metrics.qcPackingDone}/${metrics.totalBoxes} ${t.tabPack}`}
              />
            </div>

            <div className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? 'bg-neutral-900/50 border-neutral-700/70' : 'bg-slate-50/70 border-slate-200/70'
            }`}>
              <SemiCircleGauge
                percent={metrics.checkerPercent}
                color="#FBBF24"
                isDarkMode={isDarkMode}
                label={t.wsQc}
                sublabel={`${metrics.qcCheckerDone}/${metrics.totalBoxes} ${t.tabPack}`}
              />
            </div>

            <div className={`p-3.5 rounded-2xl border text-center ${
              isDarkMode ? 'bg-neutral-900/50 border-neutral-700/70' : 'bg-slate-50/70 border-slate-200/70'
            }`}>
              <SemiCircleGauge
                percent={metrics.deliverPercent}
                color="#FB923C"
                isDarkMode={isDarkMode}
                label={t.wsDeliver}
                sublabel={metrics.totalBoxes > 0 ? `${metrics.deliverDone}/${metrics.totalBoxes} ${t.tabPack}` : `${metrics.spkShipDone}/${metrics.totalSpk} SPK`}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-neutral-700/70 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{t.routeAllocation}</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 font-semibold tabular-nums">
                {t.inTown}: {metrics.dalamKotaBoxes}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50/90 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 font-semibold tabular-nums">
                {t.outOfTown}: {metrics.luarKotaBoxes}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TABEL PEMANTAUAN TERPADU & PINTASAN DIVISI */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className={`lg:col-span-8 p-5 sm:p-6 rounded-3xl border shadow-xs space-y-4 ${
          isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                {t.activitySection}
              </span>
              <h3 className="text-base sm:text-lg font-bold tracking-tight mt-0.5">
                {t.activityTitle}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter Status Item">
              {[
                { id: 'ALL', label: t.statusAll },
                { id: 'IN_PROGRESS', label: t.statusProcess },
                { id: 'COMPLETED', label: t.statusDone },
                { id: 'PENDING', label: t.statusPending }
              ].map(st => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStageFilter(st.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    stageFilter === st.id
                      ? 'bg-blue-50/90 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/70 shadow-2xs'
                      : (isDarkMode ? 'bg-neutral-900/60 text-slate-300 border-neutral-700 hover:bg-neutral-700/60' : 'bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100')
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: `${t.tabAll} (${unifiedFeed.length})` },
                { id: 'SPK', label: `${t.tabSpk} (${spkList.length})` },
                { id: 'PACKING', label: `${t.tabPack} (${packingData.length})` },
                { id: 'KAWAN_LAMA', label: `${t.tabKl} (${klOrders.length})` },
                { id: 'PMG', label: `${t.tabPmg} (${pmgProjects.length})` }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeedTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer tabular-nums ${
                    activeFeedTab === tab.id
                      ? (isDarkMode ? 'bg-blue-950/60 text-blue-300 border-blue-800/70' : 'bg-blue-50/90 text-blue-700 border-blue-200/80')
                      : (isDarkMode ? 'bg-neutral-900/40 text-slate-400 border-neutral-700 hover:text-white' : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50')
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[220px] sm:min-w-[260px]">
              <label htmlFor="dashboard-feed-search" className="sr-only">
                {t.searchPlaceholder}
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="dashboard-feed-search"
                name="dashboardFeedSearch"
                type="search"
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
                placeholder={t.searchPlaceholder}
                className={`w-full pl-9 pr-3.5 py-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-900 border-neutral-700 text-white placeholder-slate-400'
                    : 'bg-slate-50 border-slate-200/80 text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>
          </div>

          <div className={`overflow-x-auto max-h-[420px] overflow-y-auto rounded-2xl border ${
            isDarkMode ? 'border-neutral-700/80 bg-neutral-900/40' : 'border-slate-200/80 bg-white'
          }`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead className={`sticky top-0 z-10 border-b uppercase text-[11px] font-bold tracking-wider ${
                isDarkMode ? 'bg-neutral-800 text-slate-300 border-neutral-700' : 'bg-slate-50/90 text-slate-600 border-slate-200/80'
              }`}>
                <tr>
                  <th className="py-3 px-4">{t.thRefCode}</th>
                  <th className="py-3 px-4">{t.thProjectSpecs}</th>
                  <th className="py-3 px-4 text-center">{t.thProgress}</th>
                  <th className="py-3 px-4 text-center">{t.thStatus}</th>
                  <th className="py-3 px-4 text-right">{t.thAction}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-slate-100'}`}>
                {filteredFeed.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 px-4 text-center">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Box className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {t.emptyFeedMsg}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t.emptyFeedHint}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredFeed.slice(0, 25).map((item) => {
                    const isDone = item.status === 'COMPLETED';
                    const isProgress = item.status === 'IN_PROGRESS';

                    return (
                      <tr
                        key={item.uid}
                        className={`transition-colors ${
                          isDarkMode ? 'hover:bg-neutral-800/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono font-semibold text-xs text-blue-700 dark:text-blue-300 block">
                            {item.code}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            {item.category.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-white text-xs sm:text-[13px]">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.subtitle}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 w-24">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-neutral-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isDone ? 'bg-emerald-400/80' : isProgress ? 'bg-blue-400/80' : 'bg-slate-300'
                                }`}
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <span className="font-mono font-semibold text-[11px] tabular-nums w-8 text-right text-slate-700 dark:text-slate-300">
                              {item.progress}%
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                              <CheckCircle2 className="w-3 h-3" /> {item.badgeText}
                            </span>
                          ) : isProgress ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                              <Clock className="w-3 h-3" /> {item.badgeText}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100/80 text-slate-600 border border-slate-200/80 dark:bg-neutral-800 dark:text-slate-300 dark:border-neutral-700">
                              <AlertCircle className="w-3 h-3" /> {item.badgeText}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setActiveTab && setActiveTab(item.targetTab)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1 transition-all cursor-pointer ${
                              isDarkMode
                                ? 'bg-neutral-800 hover:bg-neutral-700 text-blue-300 border-neutral-700'
                                : 'bg-slate-50/80 hover:bg-blue-50/80 text-blue-700 border-slate-200/80'
                            }`}
                          >
                            <span>{t.btnOpen}</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`lg:col-span-4 p-5 sm:p-6 rounded-3xl border shadow-xs space-y-4 ${
          isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-800'
        }`}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
              {t.navSection}
            </span>
            <h3 className="text-base sm:text-lg font-bold tracking-tight mt-0.5">
              {t.navTitle}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {quickModules.map((mod) => {
              const IconComponent = mod.icon;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setActiveTab && setActiveTab(mod.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    isDarkMode
                      ? 'bg-neutral-900/50 border-neutral-700/80 hover:bg-neutral-900/80 hover:border-blue-800/60'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-blue-50/50 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${mod.accent}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-[13px] font-semibold text-slate-800 dark:text-white truncate">
                        {mod.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {mod.desc}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
