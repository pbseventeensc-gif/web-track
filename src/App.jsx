import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  LayoutDashboard,
  Palette,
  Printer,
  Scissors,
  Package,
  Truck,
  Tag,
  Building2,
  Users,
  Lock,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Building,
  Key,
  FolderKanban,
  FolderCheck,
  Activity,
  Search,
  Bell,
  Settings,
  Info,
  Share2,
  MoreHorizontal,
  ChevronsUpDown,
  HelpCircle,
  MessageSquare,
  Plus,
  Globe,
  Check,
  ChevronDown
} from 'lucide-react';
import KawanLamaTab from './components/KawanLamaTab';
import LabelGeneratorTab from './components/LabelGeneratorTab';
import MainTrackingTable from './components/MainTrackingTable';
import FinishingPanel from './components/FinishingPanel';
import DesignPanel from './components/DesignPanel';
import PackingPanel from './components/PackingPanel';
import CheckerView from './components/checker/CheckerView';
import OutboundView from './components/outbound/OutboundView';
import DeskPrintView from './components/deskprint/DeskPrintView';
import CloseProjectView from './components/packing/CloseProjectView';
import { getItemMonthLabel } from './utils/projectGrouping';
import { BranchLoginModal, AdminLoginModal, ScanQCModal, ImagePreviewModal } from './components/Modals';
import CustomModulesIndex from './custom-modules/Index';
import SpkExcelImporter from './components/SpkExcelImporter';
import SpkQrModal from './components/SpkQrModal';
import ProductionDashboard from './components/ProductionDashboard';
import DualSidebar from './components/navigation/DualSidebar';



function SoftLoginView({
  isBranchMode,
  onAdminLogin,
  onKawanLamaLogin,
  onBranchLogin
}) {
  const [activeTab, setActiveTab] = useState(isBranchMode ? 'branch' : 'admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setErrorMsg('');
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const cleanUser = username.trim().toLowerCase();
      const cleanPass = password.trim();
      const cleanPassLower = cleanPass.toLowerCase();

      if (activeTab === 'admin') {
        if (cleanUser === 'packing' && (cleanPass === 'Paking1' || cleanPassLower === 'paking1')) {
          onAdminLogin({ role: 'packing_role', name: 'Petugas Paking' });
        } else if (cleanUser === 'checker' && (cleanPass === 'Check3' || cleanPassLower === 'check3')) {
          onAdminLogin({ role: 'checker_role', name: 'Petugas Pemeriksa Mutu' });
        } else if (cleanUser === 'outbound' && (cleanPass === 'Out123' || cleanPassLower === 'out123')) {
          onAdminLogin({ role: 'outbound_role', name: 'Petugas Pengiriman' });
        } else if (cleanUser === 'admin' && cleanPass === '123456') {
          onAdminLogin({ role: 'admin', name: 'Administrator' });
        } else {
          setErrorMsg('Nama pengguna atau kata sandi tidak sesuai.');
        }
      } else if (activeTab === 'kawan_lama') {
        if (cleanUser === 'admin_kl' && cleanPassLower === 'kawanlama2026') {
          onKawanLamaLogin({ role: 'admin_kl', name: 'Administrator Kawan Lama' });
        } else {
          setErrorMsg('Kredensial Administrator Kawan Lama tidak sesuai.');
        }
      } else if (activeTab === 'branch') {
        const { data } = await supabase
          .from('kl_branch_access')
          .select('*, kl_branches(branch_name)')
          .eq('access_code', accessCode.trim().toUpperCase())
          .eq('pin_code', pinCode.trim())
          .maybeSingle();

        if (data) {
          onBranchLogin({ role: 'branch', branch_id: data.branch_id, branch_name: data.kl_branches.branch_name });
        } else {
          setErrorMsg('Kode Cabang atau PIN tidak sesuai.');
        }
      }
    } catch {
      setErrorMsg('Terjadi kendala saat menghubungi layanan otentikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-slate-100/70 dark:bg-neutral-950 flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans antialiased text-slate-800 dark:text-slate-100">
      {/* Subtle top brand accent bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 z-20" />

      {/* Subtle background grid pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] opacity-60 pointer-events-none" />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/90 dark:border-neutral-800 shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] p-7 sm:p-8 space-y-6">
        
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold">
              <Printer className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  Wellen Print
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" title="Sistem Aktif" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Tracking & Logistik
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-neutral-700">
            v2.4
          </span>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Masuk ke Sistem
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pilih hak akses dan lengkapi kredensial untuk melanjutkan.
          </p>
        </div>

        {/* Segmented Control Role Selector */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-neutral-800 rounded-xl text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span className="truncate">Internal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kawan_lama')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'kawan_lama'
                ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="truncate">Kawan Lama</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branch')}
            className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'branch'
                ? 'bg-white dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span className="truncate">Cabang</span>
          </button>
        </div>

        {/* Form Otentikasi */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {activeTab !== 'branch' ? (
            <>
              <div>
                <label htmlFor="login-username" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Nama Pengguna
                </label>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={activeTab === 'admin' ? 'Contoh: admin / packing / checker' : 'admin_kl'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all text-xs font-medium"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative flex items-center">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all text-xs font-medium pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1 cursor-pointer"
                    title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="login-branch-code" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Kode Identitas Cabang
                </label>
                <input
                  id="login-branch-code"
                  name="accessCode"
                  type="text"
                  autoComplete="organization"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Contoh: AZKO-001"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all text-xs font-semibold uppercase"
                />
              </div>

              <div>
                <label htmlFor="login-branch-pin" className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  PIN Otorisasi (6 Digit)
                </label>
                <div className="relative flex items-center">
                  <input
                    id="login-branch-pin"
                    name="pinCode"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="one-time-code"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="••••••"
                    maxLength={6}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 focus:border-blue-600 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all text-xs font-semibold tracking-widest text-center pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all p-1 cursor-pointer"
                    aria-label={showPassword ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-0.5">
            <label htmlFor="login-remember-me" className="flex items-center gap-2 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200">
              <input
                id="login-remember-me"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span>Ingat sesi masuk</span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/90 dark:border-red-800/60 text-red-600 dark:text-red-300 text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all duration-150 active:scale-[0.99] text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk ke Sistem'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center pt-1 border-t border-slate-100 dark:border-neutral-800/80">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Sistem Kendali Mutu, Produksi & Distribusi Terpadu
          </p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isBranchMode = searchParams.get('mode') === 'cabang';
  const scanParam = searchParams.get('scan');

  const [currentAdmin, setCurrentAdmin] = useState(() => {
    const s = localStorage.getItem('kl_admin_session');
    return s ? JSON.parse(s) : null;
  });

  const [currentBranch, setCurrentBranch] = useState(() => {
    const s = localStorage.getItem('kl_branch_session');
    return s ? JSON.parse(s) : null;
  });

  const [spkList, setSpkList] = useState([]);

  const [currentKawanLamaAdmin, setCurrentKawanLamaAdmin] = useState(() => {
    const s = localStorage.getItem('kl_special_admin_session');
    return s ? JSON.parse(s) : null;
  });

  const [activeTab, setActiveTab] = useState(
    currentAdmin?.role === 'outbound_role'
      ? 'outbound'
      : currentAdmin?.role === 'checker_role'
        ? 'checker'
        : currentAdmin?.role === 'packing_role'
          ? 'paking'
          : currentKawanLamaAdmin
            ? 'label'
            : isBranchMode
              ? 'kawan_lama'
              : 'dashboard'
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (currentAdmin?.role === 'packing_role') {
      setActiveTab('paking');
    } else if (currentAdmin?.role === 'checker_role') {
      setActiveTab('checker');
    } else if (currentAdmin?.role === 'outbound_role') {
      setActiveTab('outbound');
    }
  }, [currentAdmin]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [modalImageInfo, setModalImageModalInfo] = useState({ isOpen: false, url: '', title: '' });

  const [showScanModal, setShowScanModal] = useState(false);
  const [scanTargetColumn, setScanTargetColumn] = useState('qc_checker');
  const [qcStaffName] = useState('Petugas QC');
  const [scannedInput, setScannedInput] = useState('');
  const [lastScanMessage, setLastScanMessage] = useState('');
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [showSpkImportModal, setShowSpkImportModal] = useState(false);
  const [selectedQrSpk, setSelectedQrSpk] = useState(null);
  const [selectedPackingProject, setSelectedPackingProject] = useState('ALL');
  const [selectedArchiveProject, setSelectedArchiveProject] = useState('ALL');

  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showBranchLoginModal, setShowBranchLoginModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [language, setLanguage] = useState(() => localStorage.getItem('app_language') || 'id');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  useEffect(() => {
    const handleLangChange = () => {
      setLanguage(localStorage.getItem('app_language') || 'id');
    };
    window.addEventListener('app_language_changed', handleLangChange);
    return () => window.removeEventListener('app_language_changed', handleLangChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (scanParam) {
      setActiveTab('paking');
      setSearchTerm(scanParam);
    }
  }, [scanParam]);

  const openImageModal = (url, title, storeName = '', projectName = '', spkNo = '') => {
    if (url) setModalImageModalInfo({ isOpen: true, url, title: title || 'Pratinjau Dokumentasi', storeName, projectName, spkNo });
  };
  const closeImageModal = () => setModalImageModalInfo({ isOpen: false, url: '', title: '', storeName: '', projectName: '', spkNo: '' });
  const toggleTheme = () => setIsDarkMode(prev => { localStorage.setItem('theme', !prev ? 'dark' : 'light'); return !prev; });

  useEffect(() => {
    const viewImgParam = searchParams.get('viewImg');
    if (viewImgParam) {
      const title = searchParams.get('title') || 'Dokumentasi Paking';
      const storeName = searchParams.get('store') || '';
      const projectName = searchParams.get('project') || '';
      const spkNo = searchParams.get('spk') || '';
      openImageModal(viewImgParam, title, storeName, projectName, spkNo);
    }
  }, []);

  useEffect(() => {
    if (isBranchMode && !currentBranch) {
      setShowBranchLoginModal(true);
    }
  }, [isBranchMode, currentBranch]);

  const fetchSpkData = async () => {
    try {
      const { data: dbSpk } = await supabase
        .from('spk_data')
        .select('*')
        .order('id', { ascending: false })
        .limit(100);

      let list = Array.isArray(dbSpk) ? [...dbSpk] : [];

      // Ambil juga data nyata dari pmg_projects dan packing_tracking dengan seleksi kolom terarah & limit
      const { data: pmgData } = await supabase
        .from('pmg_projects')
        .select('id, dr_number, transaction_code, deliver_to, project_name, pic_up, address, delivery_date, created_at')
        .order('id', { ascending: false })
        .limit(100);

      const { data: packData } = await supabase
        .from('packing_tracking')
        .select('id, no_spk, store_name, promo_title, status_deliver, box_code, delivery_type, updated_at')
        .order('id', { ascending: false })
        .limit(100);

      if (pmgData && pmgData.length > 0) {
        pmgData.forEach(p => {
          const spkNo = (p.dr_number && p.dr_number.trim() && p.dr_number !== '-' && !/^tes/i.test(p.dr_number))
            ? p.dr_number.trim()
            : (p.transaction_code && p.transaction_code.trim() && p.transaction_code !== '-' ? p.transaction_code.trim() : `SPK-PMG-${p.id}`);

          list.push({
            id: `pmg-spk-${p.id}`,
            no_spk: spkNo,
            client: p.deliver_to || 'PMG Client',
            project: p.project_name || 'Proyek PMG',
            bahan: p.project_name || 'Standar Cetak',
            ukuran: '-',
            qty_order: 1,
            qty_print: 1,
            qty_finish: 1,
            qty_pack: 1,
            qty_ship: 1,
            store_code: p.pic_up || p.pic_name || '-',
            recipient_name: p.pic_up || p.pic_name || '-',
            phone_number: p.phone_no || p.phone || '-',
            address: p.address || '-',
            delivery_route: (p.address || '').toLowerCase().includes('jakarta') ? 'DALAM KOTA' : 'LUAR KOTA',
            tes_scan: 'Terverifikasi',
            created_at: p.delivery_date || p.created_at || new Date().toISOString()
          });
        });
      }

      if (packData && packData.length > 0) {
        packData.forEach(p => {
          const spkNo = (p.no_spk && p.no_spk.trim() && p.no_spk !== '-' && !/^tes/i.test(p.no_spk))
            ? p.no_spk.trim()
            : `SPK-PACK-${p.id}`;

          list.push({
            id: `pack-spk-${p.id}`,
            no_spk: spkNo,
            client: p.store_name || 'Packing Client',
            project: p.promo_title || 'Proyek Packing',
            bahan: p.promo_title || 'Standar Paking',
            ukuran: '-',
            qty_order: 1,
            qty_print: 1,
            qty_finish: 1,
            qty_pack: 1,
            qty_ship: p.status_deliver === 'DONE' ? 1 : 0,
            store_code: p.box_code || '-',
            delivery_route: p.delivery_type || 'DALAM KOTA',
            tes_scan: 'Terverifikasi',
            created_at: p.created_at || new Date().toISOString()
          });
        });
      }

      setSpkList(list);
      if (list.length > 0 && !selectedSpkId) setSelectedSpkId(list[0].id);
    } catch (e) {
      console.error('Error fetching SPK data:', e);
    }
  };

  useEffect(() => {
    fetchSpkData();

    let debounceTimer = null;
    const channel = supabase
      .channel('spk_data_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spk_data' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchSpkData();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId);
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds(prev => {
      const exist = prev.includes(id);
      if (!exist) handleSelectSpk(id);
      return exist ? prev.filter(item => item !== id) : [...prev, id];
    });
  };

  const handleToggleSelectAll = (filteredItems) => {
    if (selectedSpkIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedSpkIds([]);
    } else {
      setSelectedSpkIds(filteredItems.map(item => item.id));
      if (filteredItems.length > 0) handleSelectSpk(filteredItems[0].id);
    }
  };

  const handleUpdateField = async (id, payload) => {
    const { error } = await supabase.from('spk_data').update(payload).eq('id', id);
    if (!error) {
      setSpkList(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
    } else {
      alert('Gagal memperbarui data: ' + error.message);
    }
  };

  const handleUpdateQty = async (id, field, value, maxAllowed, customErrorMessage) => {
    const val = Number(value) || 0;
    if (maxAllowed && val > maxAllowed) return alert(customErrorMessage || `Jumlah tidak boleh melebihi batas pesanan (${maxAllowed.toLocaleString()} unit).`);
    handleUpdateField(id, { [field]: val });
  };

  const handleDeleteSpk = async (id, noSpk) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data SPK "${noSpk || id}" dari sistem?`)) {
      const { error } = await supabase.from('spk_data').delete().eq('id', id);
      if (!error) {
        setSpkList(prev => prev.filter(item => item.id !== id));
        setSelectedSpkIds(prev => prev.filter(selectedId => selectedId !== id));
        alert(`Data SPK "${noSpk}" berhasil dihapus.`);
      } else {
        alert('Gagal menghapus SPK: ' + error.message);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedSpkIds.length === 0) return alert('Silakan pilih minimal satu data SPK yang akan dihapus.');
    if (confirm(`Konfirmasi: Apakah Anda yakin ingin menghapus ${selectedSpkIds.length} data SPK terpilih? Tindakan ini tidak dapat dibatalkan.`)) {
      const { error } = await supabase.from('spk_data').delete().in('id', selectedSpkIds);
      if (!error) {
        setSpkList(prev => prev.filter(item => !selectedSpkIds.includes(item.id)));
        setSelectedSpkIds([]);
        alert('Seluruh data SPK terpilih berhasil dihapus.');
      } else {
        alert('Gagal melakukan penghapusan massal: ' + error.message);
      }
    }
  };

  const handleProcessScan = async (codeValue) => {
    if (!codeValue) return;
    const cleanCode = codeValue.toString().replace(/[\r\n]+/g, '').trim().toLowerCase();
    const targetItem = spkList.find(item =>
      (item.qr_address || '').toLowerCase().includes(cleanCode) ||
      (item.store_code || '').toLowerCase() === cleanCode ||
      (item.no_spk || '').toLowerCase().includes(cleanCode) ||
      (item.project || '').toLowerCase().includes(cleanCode)
    );
    if (!targetItem) {
      setLastScanMessage(`Data SPK "${cleanCode}" tidak ditemukan.`);
      setScannedInput('');
      return;
    }

    const updaterValue = qcStaffName ? `${qcStaffName} (Terverifikasi)` : 'Terverifikasi';
    const updatePayload = { tes_scan: updaterValue };
    if (scanTargetColumn === 'qc_paking') updatePayload.qc_paking = updaterValue;
    if (scanTargetColumn === 'qc_checker') updatePayload.qc_checker = updaterValue;
    if (scanTargetColumn === 'qc_deliver') updatePayload.qc_deliver = updaterValue;
    if (scanTargetColumn === 'qty_finish') updatePayload.qty_finish = targetItem.qty_order;

    await handleUpdateField(targetItem.id, updatePayload);
    setLastScanMessage(`Berhasil memperbarui status SPK ${targetItem.no_spk}.`);
    setScannedInput('');
  };

  const handleSubmitInput = (e) => { e.preventDefault(); handleProcessScan(scannedInput); };

  const handleBatchPrint = async () => {
    const items = spkList.filter(item => selectedSpkIds.includes(item.id));
    if (items.length === 0) return alert('Silakan pilih minimal satu data SPK untuk dicetak.');
    const html = items.map(item => `<div style="page-break-after:always; padding:20px; font-family:Arial; border:2px solid #000;"><h2>TUJUAN: ${item.project}</h2><p>NOMOR SPK: ${item.no_spk}</p></div>`).join('');
    const pw = window.open('', '_blank', 'width=800,height=800');
    pw.document.write(`<html><body>${html}</body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 500);
  };

  const handleUploadSuratJalan = async (e, item) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileName = `sj_${item.no_spk}_${Date.now()}`;
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      handleUpdateField(item.id, { surat_jalan_url: data.publicUrl });
      alert('Dokumen Surat Jalan berhasil diunggah.');
    }
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));
  const getStatusBadge = (p) => p >= 100
    ? { text: 'text-emerald-700 bg-emerald-50 border border-emerald-200', icon: '' }
    : p > 0
      ? { text: 'text-amber-800 bg-amber-50 border border-amber-200', icon: '' }
      : { text: 'text-rose-700 bg-rose-50 border border-rose-200', icon: '' };

  const displayedList = spkList.filter(item =>
    (item.no_spk || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.project || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.store_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAuthenticated = isBranchMode ? currentBranch : (currentAdmin || currentKawanLamaAdmin);

  if (!isAuthenticated) {
    return (
      <SoftLoginView
        isBranchMode={isBranchMode}
        onAdminLogin={(admin) => {
          localStorage.setItem('kl_admin_session', JSON.stringify(admin));
          setCurrentAdmin(admin);
        }}
        onKawanLamaLogin={(klAdmin) => {
          localStorage.setItem('kl_special_admin_session', JSON.stringify(klAdmin));
          setCurrentKawanLamaAdmin(klAdmin);
        }}
        onBranchLogin={(branch) => {
          localStorage.setItem('kl_branch_session', JSON.stringify(branch));
          setCurrentBranch(branch);
        }}
      />
    );
  }

  const activeModuleTitleMap = {
    dashboard: 'Sales & Production Dashboard',
    desk_print: 'Desk Print',
    design: 'Desain Pracetak',
    produksi: 'Print Queue',
    finishing: 'Finishing',
    paking: (() => {
      if (selectedPackingProject === 'ALL') return 'Packing Station';
      if (selectedPackingProject.startsWith('MONTH:')) {
        const clean = selectedPackingProject.replace('MONTH:', '');
        const [mPart, grpPart] = clean.split('|GROUP:');
        const mLabel = getItemMonthLabel(mPart, language);
        if (grpPart) return `Packing Station — ${grpPart} (${mLabel})`;
        return `Packing Station — ${language === 'en' ? 'Period' : 'Periode'} ${mLabel}`;
      }
      if (selectedPackingProject.startsWith('GROUP:')) {
        return `Packing Station — ${selectedPackingProject.replace('GROUP:', '')}`;
      }
      return `Packing Station — ${selectedPackingProject}`;
    })(),
    close_project: (() => {
      if (selectedArchiveProject === 'ALL') return 'Project Archive';
      if (selectedArchiveProject.startsWith('MONTH:')) {
        const clean = selectedArchiveProject.replace('MONTH:', '');
        const [mPart, grpPart] = clean.split('|GROUP:');
        const mLabel = getItemMonthLabel(mPart, language);
        if (grpPart) return `Project Archive — ${grpPart} (${mLabel})`;
        return `Project Archive — ${language === 'en' ? 'Period' : 'Periode'} ${mLabel}`;
      }
      if (selectedArchiveProject.startsWith('GROUP:')) {
        return `Project Archive — ${selectedArchiveProject.replace('GROUP:', '')}`;
      }
      return `Project Archive — ${selectedArchiveProject}`;
    })(),
    pengiriman: language === 'en' ? 'Shipping & Waybill' : 'Pengiriman & Surat Jalan',
    label: language === 'en' ? 'Print Label & Waybill' : 'Cetak Label & Surat Jalan',
    kawan_lama: 'Kawan Lama Solution',
    custom_modules: language === 'en' ? 'Customer & PMG Module' : 'Modul Pelanggan & PMG',
    checker: 'QC Station',
    outbound: language === 'en' ? 'Shipping Station' : 'Stasiun Pengiriman'
  };

  const activeModuleLabel = isBranchMode
    ? `Akses Cabang — ${currentBranch?.branch_name || 'Kawan Lama'}`
    : (activeModuleTitleMap[activeTab] || 'Dashboard');

  const activeSessionRoleLabel = currentAdmin?.role === 'outbound_role'
    ? (language === 'en' ? 'Outbound & Dispatch Officer' : 'Petugas Pengiriman')
    : currentAdmin?.role === 'checker_role'
      ? (language === 'en' ? 'QC Checker Officer' : 'Petugas Pemeriksa Mutu')
      : currentAdmin?.role === 'packing_role'
        ? (language === 'en' ? 'Packing Operator' : 'Petugas Paking')
        : isBranchMode
          ? `Branch: ${currentBranch?.branch_name || 'Active'}`
          : currentKawanLamaAdmin
            ? 'Kawan Lama Administrator'
            : (language === 'en' ? 'Operations Administrator' : 'Administrator Operasional');

  const renderSidebarItem = (item, isLocked = false) => {
    const isActive = activeTab === item.id;
    const ItemIcon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => !isLocked && setActiveTab(item.id)}
        disabled={isLocked}
        title={isLocked ? 'Requires Administrator Access' : (isSidebarCollapsed ? item.label : '')}
        className={`group w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'} rounded-xl text-[13px] transition-all duration-150 cursor-pointer ${
          isLocked
            ? 'opacity-40 cursor-not-allowed text-slate-400'
            : isActive
            ? 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 font-bold border border-amber-500/30 dark:border-amber-500/40 shadow-2xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-800/50 font-medium'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {item.color ? (
            <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
          ) : ItemIcon ? (
            <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`} />
          ) : null}
          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
        </div>
        {!isSidebarCollapsed && (
          isLocked ? (
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : isActive ? (
            <ChevronRight className="w-3.5 h-3.5 ml-auto text-amber-600 dark:text-amber-400 shrink-0" />
          ) : null
        )}
      </button>
    );
  };

  return (
    <div className={`h-screen w-screen flex overflow-hidden font-sans antialiased transition-colors duration-200 select-none ${
      isDarkMode ? 'bg-[#090D16] text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* 1. DUAL SIDEBAR FLUSH MENEMPEL DI SISI PALING KIRI (0 MARGIN, 0 PADDING, 100% TINGGI) */}
      {!isBranchMode && (
        <DualSidebar
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentAdmin={currentAdmin}
          currentBranch={currentBranch}
          currentKawanLamaAdmin={currentKawanLamaAdmin}
          isBranchMode={isBranchMode}
          spkCount={spkList.length}
          spkList={spkList}
          selectedPackingProject={selectedPackingProject}
          onSelectPackingProject={setSelectedPackingProject}
          selectedArchiveProject={selectedArchiveProject}
          onSelectArchiveProject={setSelectedArchiveProject}
        />
      )}

      {/* 2. AREA UTAMA KANAN (FLUSH KE ATAS & SAMPING, HEADER DI ATAS, KONTEN SCROLLABLE DI BAWAH) */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        {/* HEADER UTAMA FLUSH DI ATAS */}
        <header className={`flex-none min-h-16 px-6 border-b flex items-center justify-between gap-4 transition-colors z-20 ${
          isDarkMode
            ? 'bg-neutral-900 border-neutral-800 text-slate-100'
            : 'bg-white border-slate-200/90 text-slate-800'
        }`}>
          {/* Kiri: Judul Halaman Aktif & Status Sesi */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
                  {activeModuleLabel}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-neutral-700">
                  {spkList.length} SPK
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{activeSessionRoleLabel}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {language === 'en'
                  ? 'Wellen Print — Production, Quality & Distribution Monitoring'
                  : 'Wellen Print — Monitoring Produksi, Kualitas & Distribusi'}
              </p>
            </div>
          </div>

          {/* Kanan: Language Selector & Logout Action */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* Pilihan Bahasa (IND / ENG) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLangDropdownOpen(prev => !prev)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-2xs select-none active:scale-95 ${
                  isDarkMode
                    ? 'bg-neutral-800/90 hover:bg-neutral-700/90 text-slate-200 border-neutral-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300/80'
                }`}
                title={language === 'id' ? 'Pilihan Bahasa (Indonesia / English)' : 'Language Selection (Indonesia / English)'}
              >
                <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="font-bold tracking-tight">{language === 'id' ? 'ID-ID' : 'EN-GB'}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isLangDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isLangDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200/90 dark:border-neutral-700 shadow-xl p-1.5 z-50 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('id');
                      localStorage.setItem('app_language', 'id');
                      setIsLangDropdownOpen(false);
                      window.dispatchEvent(new Event('app_language_changed'));
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      language === 'id'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🇮🇩</span>
                      <span>ID-ID</span>
                    </span>
                    {language === 'id' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      localStorage.setItem('app_language', 'en');
                      setIsLangDropdownOpen(false);
                      window.dispatchEvent(new Event('app_language_changed'));
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                      language === 'en'
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🇬🇧</span>
                      <span>EN-GB</span>
                    </span>
                    {language === 'en' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                </div>
              )}
            </div>

            {isBranchMode && (
              <button
                type="button"
                onClick={() => { localStorage.removeItem('kl_branch_session'); setCurrentBranch(null); window.location.reload(); }}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Log Out
              </button>
            )}

            {currentKawanLamaAdmin && (
              <button
                type="button"
                onClick={() => { localStorage.removeItem('kl_special_admin_session'); setCurrentKawanLamaAdmin(null); window.location.reload(); }}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Log Out
              </button>
            )}

            {currentAdmin && (
              <button
                type="button"
                onClick={() => { localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard'); }}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </header>

        {/* AREA KONTEN SCROLLABLE FLUSH */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
          {isBranchMode ? (
            <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentBranch} isBranchMode={true} />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <ProductionDashboard
                  isDarkMode={isDarkMode}
                  spkList={spkList}
                  setActiveTab={setActiveTab}
                  onOpenSpkImport={() => setShowSpkImportModal(true)}
                  onRefreshSpk={fetchSpkData}
                  language={language}
                  onLanguageChange={setLanguage}
                />
              )}

              {activeTab === 'desk_print' && (
                <DeskPrintView isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
              )}

              {activeTab === 'design' && (
                <DesignPanel isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
              )}

              {activeTab === 'finishing' && (
                <FinishingPanel isDarkMode={isDarkMode} spkList={spkList} fetchSpkData={fetchSpkData} />
              )}

              {activeTab === 'paking' && (
                <PackingPanel
                  isDarkMode={isDarkMode}
                  spkList={displayedList}
                  handleUpdateField={handleUpdateField}
                  onOpenImageModal={openImageModal}
                  isPackingRole={currentAdmin?.role === 'packing_role'}
                  externalProjectFilter={selectedPackingProject}
                  onProjectFilterChange={setSelectedPackingProject}
                  language={language}
                />
              )}

              {activeTab === 'close_project' && (
                <CloseProjectView
                  isDarkMode={isDarkMode}
                  onOpenImageModal={openImageModal}
                  externalProjectFilter={selectedArchiveProject}
                  onProjectFilterChange={setSelectedArchiveProject}
                  language={language}
                />
              )}

              {activeTab === 'pengiriman' && (
                <OutboundView isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
              )}

              {activeTab === 'kawan_lama' && (
                <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentKawanLamaAdmin || currentAdmin} isBranchMode={false} />
              )}

              {activeTab === 'label' && (
                <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
              )}

              {activeTab === 'custom_modules' && (
                <CustomModulesIndex isDarkMode={isDarkMode} />
              )}

              {activeTab === 'checker' && (
                <CheckerView isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
              )}

              {activeTab === 'outbound' && (
                <OutboundView isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
              )}

              {activeTab === 'produksi' && (
                <MainTrackingTable
                  isDarkMode={isDarkMode}
                  activeTab={activeTab}
                  spkList={spkList}
                  displayedList={displayedList}
                  selectedSpkIds={selectedSpkIds}
                  handleToggleCheck={handleToggleCheck}
                  handleToggleSelectAll={handleToggleSelectAll}
                  handleUpdateQty={handleUpdateQty}
                  handleUpdateField={handleUpdateField}
                  handleDeleteSpk={handleDeleteSpk}
                  handleBatchDelete={handleBatchDelete}
                  handleBatchPrint={handleBatchPrint}
                  openImageModal={openImageModal}
                  handleUploadSuratJalan={handleUploadSuratJalan}
                  getPercent={getPercent}
                  getStatusBadge={getStatusBadge}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onOpenSpkImport={() => setShowSpkImportModal(true)}
                  onOpenQrModal={(item) => setSelectedQrSpk(item)}
                  setActiveTab={setActiveTab}
                />
              )}
            </>
          )}
        </main>
      </div>

      <ScanQCModal isOpen={showScanModal} onClose={() => setShowScanModal(false)} isDarkMode={isDarkMode} scanTargetColumn={scanTargetColumn} setScanTargetColumn={setScanTargetColumn} scannedInput={scannedInput} setScannedInput={setScannedInput} handleSubmitInput={handleSubmitInput} lastScanMessage={lastScanMessage} />
      <SpkExcelImporter isOpen={showSpkImportModal} onClose={() => setShowSpkImportModal(false)} isDarkMode={isDarkMode} onImportSuccess={fetchSpkData} />
      <SpkQrModal isOpen={!!selectedQrSpk} onClose={() => setSelectedQrSpk(null)} spkItem={selectedQrSpk} isDarkMode={isDarkMode} setActiveTab={setActiveTab} setSearchTerm={setSearchTerm} />
      <ImagePreviewModal isOpen={modalImageInfo.isOpen} onClose={closeImageModal} modalImageInfo={modalImageInfo} />
      <AdminLoginModal isOpen={showAdminLoginModal} onClose={() => setShowAdminLoginModal(false)} onLoginSuccess={(admin) => { localStorage.setItem('kl_admin_session', JSON.stringify(admin)); setCurrentAdmin(admin); setShowAdminLoginModal(false); }} />
      <BranchLoginModal isOpen={showBranchLoginModal} onClose={() => setShowBranchLoginModal(false)} onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} />
    </div>
  );
}