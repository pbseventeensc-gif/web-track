import { useState, useEffect } from 'react';

export const TRANSLATIONS = {
  id: {
    // Header & Brand
    appTitle: 'Wellen Print',
    appSubtitle: 'Wellen Print — Monitoring Produksi, Kualitas & Distribusi',
    roleAdmin: 'Operations Administrator',
    rolePacking: 'Petugas Paking',
    roleChecker: 'Petugas Pemeriksa Mutu',
    roleOutbound: 'Petugas Pengiriman',
    roleBranch: 'Petugas Cabang',
    logout: 'Log Out',
    langSelectTitle: 'Pilihan Bahasa (Indonesia / English)',

    // Navigation & Tabs
    navDashboard: 'Dashboard',
    navDeskPrint: 'Lantai Produksi',
    navPacking: 'Packing Station',
    navArchive: 'Project Archive',
    navLogistics: 'Logistik & QC',
    navMaster: 'Programs & Master Data',
    navChecker: 'QC Checker',
    navOutbound: 'Pengiriman & Surat Jalan',
    navKawanLama: 'Kawan Lama Solution',
    navDesign: 'Design & Prepress',
    navFinishing: 'Finishing & Pasca Cetak',
    navLabel: 'Cetak Label & Surat Jalan',

    // DualSidebar
    sidebarOverview: 'Ringkasan',
    sidebarWorkspace: 'Ruang Kerja',
    sidebarMasterMonth: 'PROYEK INDUK BULAN',
    sidebarPeriod: 'Periode',
    sidebarMonth: 'Bulan',
    sidebarAllProjects: 'Proyek',
    sidebarAllBoxes: 'Proyek',
    sidebarAllArchive: 'Arsip Proyek',
    sidebarAllPacking: 'Proyek Packing',
    sidebarOtherProjects: 'PROJECT LAINNYA',
    sidebarExpandAll: 'Buka Semua',
    sidebarCollapseAll: 'Tutup Semua',
    sidebarHidePanel: 'Sembunyikan Panel',
    sidebarShowPanel: 'Tampilkan Panel Menu',

    // Packing Station - Hero & Stats
    packingTitle: 'Packing Station',
    packingLive: 'Live',
    packingSubtitle: 'Pemantauan alur verifikasi kolian, label pengiriman, QC packing, dan surat jalan',
    packingTotalBoxes: 'Total Kolian:',
    packingQcLabel: 'QC Label',
    packingQcPacking: 'QC Packing',
    packingQcChecker: 'QC Checker',
    packingReadyDeliver: 'Siap Kirim / Terkirim',
    packingDetail: 'Detail',

    // Packing Station - Filters
    tabAll: 'All',
    tabInProgress: 'Dalam Proses',
    tabCompleted: 'Selesai',
    searchPlaceholder: 'Cari nomor SPK, kode kolian, nama cabang, atau proyek...',
    filterStatusAll: 'Status',
    filterStageAll: 'Tahapan',
    filterSourceAll: 'Sumber Data',
    filterDeliveryAll: 'Wilayah',
    filterProjectAll: 'Proyek',
    filterInCity: 'Dalam Kota',
    filterOutCity: 'Luar Kota',
    filterMonthPrefix: 'Bulan',

    // Packing Station - Actions
    btnExport: 'Export',
    btnExportExcel: 'Export Excel',
    btnActions: 'Aksi',
    actionGroupTitle: 'Tindakan Pengelolaan',
    actionImportExcel: 'Impor Berkas Excel',
    actionImportGSheet: 'Impor Google Spreadsheet',
    actionUploadDesign: 'Unggah Gambar Desain',
    actionMatchDeskPrint: 'Pencocokan Desk Print',
    actionClearAll: 'Kosongkan Seluruh Data',

    // Table Headers
    thSelectAll: 'Pilih Semua Baris',
    thBox: 'BOX',
    thCustomerSpk: 'CUSTOMER / SPK',
    thShippingType: 'SHIPPING TYPE',
    thImportDate: 'IMPORT DATE',
    thLabelDesign: 'LABEL & DESIGN',
    thPhotoProof: 'PHOTO PROOF',
    thPackingStatus: 'PACKING STATUS',
    thCheckerStatus: 'CHECKER STATUS',

    // Table Badges & Statuses
    badgeLabelSj: 'Label Surat Jalan',
    badgeNoPhoto: 'Belum Ada Foto',
    badgeViewPhoto: 'Lihat Foto',
    badgeUploadPhoto: '+ Unggah Foto',
    badgeChangePhoto: 'Ganti Foto',
    badgeUploading: 'Mengunggah...',
    statusWaiting: 'Menunggu',
    statusDone: 'Selesai',
    statusVerified: 'Terverifikasi',
    deliveryInCity: 'DALAM KOTA',
    deliveryOutCity: 'LUAR KOTA',

    // Table Project Header & Pagination
    badgeLabelCount: 'Label:',
    badgePackingCount: 'Paking:',
    badgeCheckerCount: 'Pemeriksa:',
    badgeTotalBoxesCount: 'Total Kolian:',
    selectAllProjectBranches: 'Pilih semua cabang di proyek ini',
    deselectAllProjectBranches: 'Batalkan pilihan semua cabang di proyek ini',
    showingPagination: 'Menampilkan',
    fromTotalPagination: 'dari',
    dataPagination: 'data',
    pagePagination: 'Halaman',
    btnPrev: 'Sebelumnya',
    btnNext: 'Berikutnya',

    // Clear PIN Modal
    modalClearTitle: 'Kosongkan Seluruh Data',
    modalClearSubtitle: 'Masukkan PIN Keamanan untuk konfirmasi',
    modalClearDesc: 'Tindakan ini akan menghapus permanen seluruh data paking dari sistem. Masukkan PIN Keamanan untuk melanjutkan:',
    modalClearPlaceholder: 'Masukkan PIN Keamanan',
    modalClearError: 'PIN Keamanan salah! Silakan coba lagi.',
    modalClearSuccess: 'Seluruh data paking berhasil dikosongkan.',
    modalClearFail: 'Gagal menghapus data: ',
    btnCancel: 'Batal',
    btnConfirmDelete: 'Konfirmasi Hapus',

    // Delete Project Modal
    deleteProjectTitle: 'Hapus Proyek',
    deleteProjectSubtitle: 'Masukkan PIN Keamanan untuk konfirmasi',
    deleteProjectDesc: 'Tindakan ini akan menghapus permanen seluruh data untuk proyek',
    deleteProjectSuccess: 'Data proyek berhasil dihapus.',
    deleteProjectFail: 'Gagal menghapus data proyek: ',
    deleteProjectTooltip: 'Hapus Proyek Ini',
    pinProjectTooltip: 'Sematkan Proyek ke Paling Atas',
    unpinProjectTooltip: 'Lepas Sematan Proyek',
    pinnedBadge: 'PINNED',

    // Project Archive View
    archiveTitle: 'Arsip Proyek Selesai',
    archiveSubtitle: 'Daftar proyek dan kolian paking yang telah selesai diproses secara menyeluruh.',
    archiveRefreshBtn: 'Perbarui Arsip',
    archiveRefreshingBtn: 'Memuat Data...',
    archiveTotalProjects: 'Total Proyek Selesai',
    archiveTotalBoxes: 'Total Kolian Selesai',
    archiveViewTable: 'Tabel',
    archiveViewGallery: 'Galeri Foto',
    archiveAllCompleted: 'Proyek Selesai',
    archiveEmptyTitle: 'Tidak Ada Data Kolian',
    archiveEmptyDesc: 'Coba ubah kata kunci pencarian atau filter proyek.',
    archiveViewFull: 'Lihat Penuh',
    archiveTakeUpload: 'Ambil / Unggah Foto',
    archiveUpload: 'Unggah Foto',

    // Delete Month Archive
    deleteMonthTitle: 'Hapus Arsip Periode',
    deleteMonthSubtitle: 'Masukkan PIN Keamanan untuk konfirmasi',
    deleteMonthDesc: 'Tindakan ini akan menghapus permanen seluruh data arsip proyek pada periode',
    deleteMonthSuccess: 'Data arsip periode berhasil dihapus.',
    deleteMonthError: 'PIN Keamanan salah! Silakan coba lagi.',
    deleteMonthFail: 'Gagal menghapus data arsip: ',
    deleteMonthTooltip: 'Hapus arsip periode ini',

    // Extra Packing Station UI & Modals
    boxes: 'Kolian',
    periodUpper: 'PERIODE',
    btnExpandAll: 'Buka Semua',
    btnCollapseAll: 'Tutup Semua',
    breakdownLabel: 'QC LABEL BREAKDOWN',
    breakdownPacking: 'QC PACKING BREAKDOWN',
    breakdownChecker: 'QC CHECKER BREAKDOWN',
    breakdownDeliver: 'DELIVER BREAKDOWN',
    completedOfTotal: 'Selesai / Total',
    noMatchingData: 'Belum ada data yang sesuai dengan kriteria pencarian.',
    noMatchingDataDesc: 'Silakan sesuaikan filter di atas atau impor data kolian baru melalui menu Tindakan Operasional.',
    archiveNoMatchingData: 'Belum ada data arsip yang sesuai dengan kriteria pencarian.',
    archiveNoMatchingDataDesc: 'Silakan sesuaikan filter bulan, kategori proyek, atau kata kunci pencarian di atas.',
    rowsSelected: 'Baris Dipilih',
    printLabelBtn: 'Cetak Label',
    designsLabel: 'Desain',
    manageDesignPhoto: 'Kelola Foto Desain Cabang',
    googleSheetTitle: 'Tarik Data Google Spreadsheet',
    googleSheetDesc: 'Pastikan dokumen Google Spreadsheet Anda telah diatur dengan akses publik, kemudian tempel tautan URL di bawah ini:',
    continueSelectSheet: 'Lanjut Pilih Lembar Kerja',
    fetchingData: 'Mengambil Data...',
    importing: 'Mengimpor...',
    attachingImages: 'Memasang Gambar...',
    selectWorksheets: 'Pilih Lembar Kerja Excel',
    selectWorksheetsDesc: 'Pilih lembar kerja (sheets) yang ingin diimpor ke sistem paking:',
    importSheetsBtn: 'Impor Lembar Kerja',
    deskPrintMatch: 'Pencocokan Otomatis Desk Print',
    deskPrintDesc: 'Pilih folder Desk Print aktif untuk mencocokkan gambar pracetak ke kolian paking:',
    startMatching: 'Mulai Pencocokan',
    matching: 'Mencocokkan...'
  },

  en: {
    // Header & Brand
    appTitle: 'Wellen Print',
    appSubtitle: 'Wellen Print — Production, Quality & Distribution Monitoring',
    roleAdmin: 'Operations Administrator',
    rolePacking: 'Packing Operator',
    roleChecker: 'QC Checker Officer',
    roleOutbound: 'Outbound & Dispatch Officer',
    roleBranch: 'Branch Representative',
    logout: 'Log Out',
    langSelectTitle: 'Language Selection (Indonesia / English)',

    // Navigation & Tabs
    navDashboard: 'Dashboard',
    navDeskPrint: 'Production Floor',
    navPacking: 'Packing Station',
    navArchive: 'Project Archive',
    navLogistics: 'Logistics & QC',
    navMaster: 'Programs & Master Data',
    navChecker: 'QC Checker',
    navOutbound: 'Outbound & Dispatch',
    navKawanLama: 'Kawan Lama Solution',
    navDesign: 'Design & Prepress',
    navFinishing: 'Post-Print Finishing',
    navLabel: 'Print Labels & Delivery Notes',

    // DualSidebar
    sidebarOverview: 'Overview',
    sidebarWorkspace: 'Workspace',
    sidebarMasterMonth: 'MASTER MONTH PROJECT',
    sidebarPeriod: 'Period',
    sidebarMonth: 'Month',
    sidebarAllProjects: 'Projects',
    sidebarAllBoxes: 'Projects',
    sidebarAllArchive: 'Project Archives',
    sidebarAllPacking: 'Packing Projects',
    sidebarOtherProjects: 'OTHER PROJECTS',
    sidebarExpandAll: 'Expand All',
    sidebarCollapseAll: 'Collapse All',
    sidebarHidePanel: 'Hide Panel',
    sidebarShowPanel: 'Show Menu Panel',

    // Packing Station - Hero & Stats
    packingTitle: 'Packing Station',
    packingLive: 'Live',
    packingSubtitle: 'Monitoring package verification, shipping labels, packing QC, and delivery notes',
    packingTotalBoxes: 'Total Packages:',
    packingQcLabel: 'Label QC',
    packingQcPacking: 'Packing QC',
    packingQcChecker: 'Checker QC',
    packingReadyDeliver: 'Ready to Ship / Shipped',
    packingDetail: 'Detail',

    // Packing Station - Filters
    tabAll: 'All',
    tabInProgress: 'In Progress',
    tabCompleted: 'Completed',
    searchPlaceholder: 'Search SPK number, package code, branch name, or project...',
    filterStatusAll: 'Status',
    filterStageAll: 'Stage',
    filterSourceAll: 'Data Source',
    filterDeliveryAll: 'Region',
    filterProjectAll: 'Project',
    filterInCity: 'Inner City',
    filterOutCity: 'Outer City',
    filterMonthPrefix: 'Month',

    // Packing Station - Actions
    btnExport: 'Export',
    btnExportExcel: 'Export Excel',
    btnActions: 'Actions',
    actionGroupTitle: 'Management Actions',
    actionImportExcel: 'Import Excel File',
    actionImportGSheet: 'Import Google Spreadsheet',
    actionUploadDesign: 'Upload Design Image',
    actionMatchDeskPrint: 'Desk Print Matching',
    actionClearAll: 'Clear All Data',

    // Table Headers
    thSelectAll: 'Select All Rows',
    thBox: 'PACKAGE / BOX',
    thCustomerSpk: 'CUSTOMER / SPK',
    thShippingType: 'SHIPPING TYPE',
    thImportDate: 'IMPORT DATE',
    thLabelDesign: 'LABEL & DESIGN',
    thPhotoProof: 'PHOTO PROOF',
    thPackingStatus: 'PACKING STATUS',
    thCheckerStatus: 'CHECKER STATUS',

    // Table Badges & Statuses
    badgeLabelSj: 'Delivery Note Label',
    badgeNoPhoto: 'No Photo Yet',
    badgeViewPhoto: 'View Photo',
    badgeUploadPhoto: '+ Upload Photo',
    badgeChangePhoto: 'Change Photo',
    badgeUploading: 'Uploading...',
    statusWaiting: 'Pending',
    statusDone: 'Completed',
    statusVerified: 'Verified',
    deliveryInCity: 'INNER CITY',
    deliveryOutCity: 'OUTER CITY',

    // Table Project Header & Pagination
    badgeLabelCount: 'Labels:',
    badgePackingCount: 'Packing:',
    badgeCheckerCount: 'Checker:',
    badgeTotalBoxesCount: 'Total Packages:',
    selectAllProjectBranches: 'Select all branches in this project',
    deselectAllProjectBranches: 'Deselect all branches in this project',
    showingPagination: 'Showing',
    fromTotalPagination: 'of',
    dataPagination: 'items',
    pagePagination: 'Page',
    btnPrev: 'Previous',
    btnNext: 'Next',

    // Clear PIN Modal
    modalClearTitle: 'Clear All Data',
    modalClearSubtitle: 'Enter Security PIN to confirm',
    modalClearDesc: 'This action will permanently delete all packing data from the system. Enter Security PIN to proceed:',
    modalClearPlaceholder: 'Enter Security PIN',
    modalClearError: 'Invalid Security PIN! Please try again.',
    modalClearSuccess: 'All packing data successfully cleared.',
    modalClearFail: 'Failed to delete data: ',
    btnCancel: 'Cancel',
    btnConfirmDelete: 'Confirm Delete',

    // Delete Project Modal
    deleteProjectTitle: 'Delete Project',
    deleteProjectSubtitle: 'Enter Security PIN to confirm',
    deleteProjectDesc: 'This action will permanently delete all data for project',
    deleteProjectSuccess: 'Project data successfully deleted.',
    deleteProjectFail: 'Failed to delete project data: ',
    deleteProjectTooltip: 'Delete This Project',
    pinProjectTooltip: 'Pin Project to Top',
    unpinProjectTooltip: 'Unpin Project',
    pinnedBadge: 'PINNED',

    // Project Archive View
    archiveTitle: 'Completed Project Archive',
    archiveSubtitle: 'List of completed projects and packaging boxes fully processed.',
    archiveRefreshBtn: 'Refresh Archive',
    archiveRefreshingBtn: 'Loading Data...',
    archiveTotalProjects: 'Total Completed Projects',
    archiveTotalBoxes: 'Total Completed Packages',
    archiveViewTable: 'Table',
    archiveViewGallery: 'Photo Gallery',
    archiveAllCompleted: 'Completed Projects',
    archiveEmptyTitle: 'No Package Data Found',
    archiveEmptyDesc: 'Try adjusting your search query or project filter.',
    archiveViewFull: 'View Full',
    archiveTakeUpload: 'Take / Upload Photo',
    archiveUpload: 'Upload Photo',

    // Delete Month Archive
    deleteMonthTitle: 'Delete Period Archive',
    deleteMonthSubtitle: 'Enter Security PIN to confirm',
    deleteMonthDesc: 'This action will permanently delete all project archive data for period',
    deleteMonthSuccess: 'Period archive data successfully deleted.',
    deleteMonthError: 'Invalid Security PIN! Please try again.',
    deleteMonthFail: 'Failed to delete archive data: ',
    deleteMonthTooltip: 'Delete archive for this period',

    // Extra Packing Station UI & Modals
    boxes: 'Packages',
    periodUpper: 'PERIOD',
    btnExpandAll: 'Expand All',
    btnCollapseAll: 'Collapse All',
    breakdownLabel: 'QC LABEL BREAKDOWN',
    breakdownPacking: 'QC PACKING BREAKDOWN',
    breakdownChecker: 'QC CHECKER BREAKDOWN',
    breakdownDeliver: 'DELIVER BREAKDOWN',
    completedOfTotal: 'Completed / Total',
    noMatchingData: 'No data matches the search criteria.',
    noMatchingDataDesc: 'Please adjust the filters above or import new package data via the Actions menu.',
    archiveNoMatchingData: 'No archive data matches the search criteria.',
    archiveNoMatchingDataDesc: 'Please adjust the month filter, project category, or search keywords above.',
    rowsSelected: 'Rows Selected',
    printLabelBtn: 'Print Labels',
    designsLabel: 'Designs',
    manageDesignPhoto: 'Manage Branch Design Photos',
    googleSheetTitle: 'Fetch Google Spreadsheet Data',
    googleSheetDesc: 'Make sure your Google Spreadsheet document has public access, then paste the URL below:',
    continueSelectSheet: 'Proceed to Select Worksheets',
    fetchingData: 'Fetching Data...',
    importing: 'Importing...',
    attachingImages: 'Attaching Images...',
    selectWorksheets: 'Select Excel Worksheets',
    selectWorksheetsDesc: 'Select the worksheets you want to import into the packing system:',
    importSheetsBtn: 'Import Worksheets',
    deskPrintMatch: 'Desk Print Auto-Matching',
    deskPrintDesc: 'Select active Desk Print folder to match prepress images to packing packages:',
    startMatching: 'Start Matching',
    matching: 'Matching...'
  }
};

export function getAppLanguage() {
  if (typeof window === 'undefined') return 'id';
  return localStorage.getItem('app_language') || 'id';
}

export function setAppLanguage(newLang) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('app_language', newLang);
  window.dispatchEvent(new Event('app_language_changed'));
}

export function translate(key, customLang) {
  const lang = customLang || getAppLanguage();
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['id']?.[key] || key;
}

export function useLanguage() {
  const [lang, setLangState] = useState(getAppLanguage);

  useEffect(() => {
    const handleLangChange = () => {
      setLangState(getAppLanguage());
    };
    window.addEventListener('app_language_changed', handleLangChange);
    return () => window.removeEventListener('app_language_changed', handleLangChange);
  }, []);

  const t = (key) => translate(key, lang);

  const changeLanguage = (newLang) => {
    setAppLanguage(newLang);
    setLangState(newLang);
  };

  return {
    lang,
    t,
    changeLanguage
  };
}
