import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  extractBaseProjectName, 
  getProjectCategory, 
  CATEGORY_COLORS, 
  getItemMonthKey, 
  getItemMonthLabel 
} from '../../utils/projectGrouping';
import { 
  Home, ShoppingCart, Box, Send, Database, Truck, BarChart3, 
  Users, Settings, Monitor, Layers, Clock, Scissors, Package, 
  FolderCheck, Palette, FolderKanban, FileText, ChevronLeft, 
  ChevronRight, ChevronDown, Sun, Moon, LogOut, CheckCircle2, ShieldCheck, Tag,
  Printer, Calendar, Trash2
} from 'lucide-react';
import { useLanguage } from '../../utils/i18n';
import { deleteMonthArchive } from '../../utils/archiveActions';

export default function DualSidebar({
  isDarkMode,
  toggleTheme,
  activeTab,
  setActiveTab,
  currentAdmin,
  currentBranch,
  currentKawanLamaAdmin,
  isBranchMode,
  spkCount = 0,
  spkList = [],
  selectedPackingProject = 'ALL',
  onSelectPackingProject,
  selectedArchiveProject = 'ALL',
  onSelectArchiveProject
}) {
  const { lang, t } = useLanguage();
  const [packingRawItems, setPackingRawItems] = useState([]);
  const [archivedDbProjects, setArchivedDbProjects] = useState([]);
  const [archivedCounts, setArchivedCounts] = useState({});
  const [archivedRawItems, setArchivedRawItems] = useState([]);
  const [expandedPackingMonths, setExpandedPackingMonths] = useState({});
  const [expandedPackingGroups, setExpandedPackingGroups] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedArchiveGroups, setExpandedArchiveGroups] = useState({});

  // State untuk Modal PIN Hapus Arsip Per Bulan
  const [showDeleteMonthModal, setShowDeleteMonthModal] = useState(false);
  const [monthToDelete, setMonthToDelete] = useState(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deletePinError, setDeletePinError] = useState('');
  const [isDeletingMonth, setIsDeletingMonth] = useState(false);

  useEffect(() => {
    const isClosedPackingItem = (item) => {
      const hasPhoto = Boolean(item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' && item.bukti_paking_url.length > 5);
      const hasCheckerOrDeliver = Boolean(
        item.status_qc_checker === 'DONE' ||
        (item.bukti_outbound_url && item.bukti_outbound_url !== 'No Foto' && item.bukti_outbound_url !== '-' && item.bukti_outbound_url.length > 5) ||
        item.outbound_url ||
        item.status_deliver === 'DONE'
      );
      return hasPhoto && hasCheckerOrDeliver;
    };

    const fetchPackingProjects = async () => {
      try {
        const { data: packData } = await supabase
          .from('packing_tracking')
          .select('*')
          .order('id', { ascending: false });

        const rawItems = [];
        if (packData && packData.length > 0) {
          packData.forEach(item => {
            if (!isClosedPackingItem(item)) {
              const str = extractBaseProjectName(item.promo_title);
              if (str && str !== '-' && !/^tes(\d+)?$/i.test(str) && !/^test(\d+)?$/i.test(str)) {
                const rawDate = item.created_at || new Date().toISOString();
                const mKey = getItemMonthKey(rawDate);
                rawItems.push({
                  id: item.id,
                  projectName: str,
                  rawName: item.promo_title,
                  date: rawDate,
                  monthKey: mKey,
                  monthLabel: getItemMonthLabel(mKey),
                  category: getProjectCategory(item.promo_title)
                });
              }
            }
          });
        }
        setPackingRawItems(rawItems);
      } catch (e) {
        console.error('Error loading packing projects:', e);
      }
    };

    const fetchArchivedProjects = async () => {
      try {
        const counts = {};
        const projectsSet = new Set();
        const rawItems = [];

        // 1. Ambil proyek nyata dari pmg_projects (surat jalan PMG terselesaikan)
        const { data: pmgData, error: pmgErr } = await supabase
          .from('pmg_projects')
          .select('project_name, transaction_code, delivery_date, created_at')
          .order('id', { ascending: false });

        if (!pmgErr && pmgData) {
          pmgData.forEach(item => {
            const str = extractBaseProjectName(item.project_name);
            if (str && str !== '-' && !/^tes(\d+)?$/i.test(str) && !/^test(\d+)?$/i.test(str)) {
              projectsSet.add(str);
              counts[str] = (counts[str] || 0) + 1;
              const rawDate = item.delivery_date || item.created_at;
              const mKey = getItemMonthKey(rawDate);
              rawItems.push({
                projectName: str,
                rawName: item.project_name,
                date: rawDate,
                monthKey: mKey,
                monthLabel: getItemMonthLabel(mKey),
                category: getProjectCategory(item.project_name)
              });
            }
          });
        }

        // 2. Ambil proyek dari packing_tracking
        const { data: packData, error: packErr } = await supabase
          .from('packing_tracking')
          .select('*')
          .order('id', { ascending: false });

        if (!packErr && packData) {
          packData.forEach(item => {
            const str = extractBaseProjectName(item.promo_title);
            if (str && str !== '-' && !/^tes(\d+)?$/i.test(str) && !/^test(\d+)?$/i.test(str)) {
              projectsSet.add(str);
              counts[str] = (counts[str] || 0) + 1;
              const rawDate = item.created_at;
              const mKey = getItemMonthKey(rawDate);
              rawItems.push({
                projectName: str,
                rawName: item.promo_title,
                date: rawDate,
                monthKey: mKey,
                monthLabel: getItemMonthLabel(mKey),
                category: getProjectCategory(item.promo_title)
              });
            }
          });
        }

        const projs = Array.from(projectsSet).sort((a, b) => a.localeCompare(b));
        setArchivedDbProjects(projs);
        setArchivedCounts(counts);
        setArchivedRawItems(rawItems);
      } catch (e) {
        console.error('Error loading archive data:', e);
      }
    };

    fetchPackingProjects();
    fetchArchivedProjects();

    const channel1 = supabase
      .channel('dual_sidebar_packing_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packing_tracking' }, () => {
        fetchPackingProjects();
        fetchArchivedProjects();
      })
      .subscribe();

    const channel2 = supabase
      .channel('dual_sidebar_pmg_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pmg_projects' }, () => {
        fetchPackingProjects();
        fetchArchivedProjects();
      })
      .subscribe();

    const handleArchiveSync = () => {
      fetchPackingProjects();
      fetchArchivedProjects();
    };
    window.addEventListener('app_archive_data_changed', handleArchiveSync);

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
      window.removeEventListener('app_archive_data_changed', handleArchiveSync);
    };
  }, []);

  const handleConfirmDeleteMonth = async (e) => {
    if (e) e.preventDefault();
    if (deletePinInput.trim() !== '123') {
      setDeletePinError(t('deleteMonthError'));
      return;
    }
    if (!monthToDelete) return;

    setIsDeletingMonth(true);
    try {
      const res = await deleteMonthArchive(monthToDelete.monthKey);
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete');
      }
      setShowDeleteMonthModal(false);
      setMonthToDelete(null);
      setDeletePinInput('');
      setDeletePinError('');
      if (selectedArchiveProject && selectedArchiveProject.includes(monthToDelete.monthKey)) {
        if (onSelectArchiveProject) onSelectArchiveProject('ALL');
      }
      alert(t('deleteMonthSuccess'));
    } catch (err) {
      alert(t('deleteMonthFail') + err.message);
    } finally {
      setIsDeletingMonth(false);
    }
  };

  // Determine active rail category based on activeTab
  const getInitialCategory = (tab) => {
    if (tab === 'dashboard') return 'dashboard';
    if (tab === 'paking') return 'packing';
    if (tab === 'close_project') return 'archive';
    if (['produksi', 'desk_print', 'design', 'finishing'].includes(tab)) return 'production';
    if (['checker', 'outbound'].includes(tab)) return 'logistics';
    if (['label', 'kawan_lama', 'custom_modules'].includes(tab)) return 'workspaces';
    return 'production';
  };

  const [activeCategory, setActiveCategory] = useState(() => getInitialCategory(activeTab));
  const [isSubPanelCollapsed, setIsSubPanelCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return true;
    }
    return false;
  });

  useEffect(() => {
    setActiveCategory(getInitialCategory(activeTab));
  }, [activeTab]);

  // Rail Categories for the user's authentic modules (Dedicated Packing & Archive on small sidebar)
  const railItems = [
    { id: 'dashboard', category: 'dashboard', icon: Home, title: t('navDashboard'), tab: 'dashboard' },
    { id: 'production', category: 'production', icon: Printer, title: t('navDeskPrint'), tab: 'produksi' },
    { id: 'packing', category: 'packing', icon: Package, title: t('navPacking'), tab: 'paking' },
    { id: 'archive', category: 'archive', icon: FolderCheck, title: t('navArchive'), tab: 'close_project' },
    { id: 'logistics', category: 'logistics', icon: Truck, title: t('navLogistics'), tab: 'outbound' },
    { id: 'workspaces', category: 'workspaces', icon: Users, title: t('navMaster'), tab: 'kawan_lama' }
  ];

  // Kelompokkan proyek paking aktif ke dalam Induk Grup BULAN, baru brand/projek sesuai bulannya
  const packingMonthGroups = useMemo(() => {
    const monthMap = {};

    packingRawItems.forEach(item => {
      const { monthKey, projectName, category } = item;
      const mLabel = getItemMonthLabel(monthKey, lang);
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          monthKey,
          monthLabel: mLabel,
          totalBoxes: 0,
          brandMap: {}
        };
      }

      monthMap[monthKey].totalBoxes++;

      if (!monthMap[monthKey].brandMap[category]) {
        monthMap[monthKey].brandMap[category] = {
          categoryName: category,
          color: CATEGORY_COLORS[category] || 'bg-emerald-500',
          totalBoxes: 0,
          projectMap: {}
        };
      }

      monthMap[monthKey].brandMap[category].totalBoxes++;
      monthMap[monthKey].brandMap[category].projectMap[projectName] =
        (monthMap[monthKey].brandMap[category].projectMap[projectName] || 0) + 1;
    });

    return Object.keys(monthMap)
      .sort((a, b) => b.localeCompare(a))
      .map(mKey => {
        const m = monthMap[mKey];
        const brandGroups = Object.values(m.brandMap)
          .sort((a, b) => b.totalBoxes - a.totalBoxes)
          .map(b => ({
            categoryName: b.categoryName,
            color: b.color,
            totalBoxes: b.totalBoxes,
            projects: Object.entries(b.projectMap)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count)
          }));

        return {
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          totalBoxes: m.totalBoxes,
          projectCount: brandGroups.reduce((acc, curr) => acc + curr.projects.length, 0),
          brandGroups
        };
      });
  }, [packingRawItems, lang]);

  useEffect(() => {
    if (packingMonthGroups.length > 0 && Object.keys(expandedPackingMonths).length === 0) {
      setExpandedPackingMonths({ [packingMonthGroups[0].monthKey]: true });
    }
  }, [packingMonthGroups]);

  // Ambil daftar project yang SUDAH SELESAI (Archived) dari Supabase
  const completedSpkProjects = Array.from(
    new Set(
      spkList
        .filter(s => s.tes_scan === 'Terverifikasi' || (s.qty_finish && s.qty_finish >= s.qty_order))
        .map(s => s.project?.trim())
        .filter(Boolean)
    )
  );

  const detectedArchivedProjects = Array.from(
    new Set([...archivedDbProjects, ...completedSpkProjects])
  ).sort((a, b) => a.localeCompare(b));

  const displayArchivedProjects = detectedArchivedProjects;

  // Kelompokkan proyek arsip ke dalam Induk Grup BULAN, baru brand/projek sesuai bulannya
  const archiveMonthGroups = useMemo(() => {
    const monthMap = {};

    archivedRawItems.forEach(item => {
      const { monthKey, projectName, category } = item;
      const mLabel = getItemMonthLabel(monthKey, lang);
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          monthKey,
          monthLabel: mLabel,
          totalBoxes: 0,
          brandMap: {}
        };
      }

      monthMap[monthKey].totalBoxes++;

      if (!monthMap[monthKey].brandMap[category]) {
        monthMap[monthKey].brandMap[category] = {
          categoryName: category,
          color: CATEGORY_COLORS[category] || 'bg-slate-400',
          totalBoxes: 0,
          projectMap: {}
        };
      }

      monthMap[monthKey].brandMap[category].totalBoxes++;
      monthMap[monthKey].brandMap[category].projectMap[projectName] =
        (monthMap[monthKey].brandMap[category].projectMap[projectName] || 0) + 1;
    });

    const sortedMonths = Object.keys(monthMap)
      .sort((a, b) => b.localeCompare(a))
      .map(mKey => {
        const m = monthMap[mKey];
        const brandGroups = Object.values(m.brandMap)
          .sort((a, b) => b.totalBoxes - a.totalBoxes)
          .map(b => ({
            categoryName: b.categoryName,
            color: b.color,
            totalBoxes: b.totalBoxes,
            projects: Object.entries(b.projectMap)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count)
          }));

        return {
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          totalBoxes: m.totalBoxes,
          projectCount: brandGroups.reduce((acc, curr) => acc + curr.projects.length, 0),
          brandGroups
        };
      });

    return sortedMonths;
  }, [archivedRawItems, lang]);

  // Buka otomatis bulan pertama jika belum ada yang terbuka
  useEffect(() => {
    if (archiveMonthGroups.length > 0 && Object.keys(expandedMonths).length === 0) {
      setExpandedMonths({ [archiveMonthGroups[0].monthKey]: true });
    }
  }, [archiveMonthGroups]);

  // Buka otomatis accordion bulan / kategori yang sedang aktif
  useEffect(() => {
    if (selectedArchiveProject && selectedArchiveProject !== 'ALL') {
      if (selectedArchiveProject.startsWith('MONTH:')) {
        const clean = selectedArchiveProject.replace('MONTH:', '');
        const [mKey, grpName] = clean.split('|GROUP:');
        setExpandedMonths(prev => ({ ...prev, [mKey]: true }));
        if (grpName) {
          setExpandedArchiveGroups(prev => ({ ...prev, [`${mKey}_${grpName}`]: true }));
        }
      } else {
        const foundItem = archivedRawItems.find(it => it.projectName === selectedArchiveProject);
        if (foundItem) {
          setExpandedMonths(prev => ({ ...prev, [foundItem.monthKey]: true }));
          setExpandedArchiveGroups(prev => ({ ...prev, [`${foundItem.monthKey}_${foundItem.category}`]: true }));
        }
      }
    }
  }, [selectedArchiveProject, archivedRawItems]);

  useEffect(() => {
    if (selectedPackingProject && selectedPackingProject !== 'ALL') {
      if (selectedPackingProject.startsWith('MONTH:')) {
        const clean = selectedPackingProject.replace('MONTH:', '');
        const [mKey, grpName] = clean.split('|GROUP:');
        setExpandedPackingMonths(prev => ({ ...prev, [mKey]: true }));
        if (grpName) {
          setExpandedPackingGroups(prev => ({ ...prev, [`${mKey}_${grpName}`]: true }));
        }
      } else {
        const foundItem = packingRawItems.find(it => it.projectName === selectedPackingProject);
        if (foundItem) {
          setExpandedPackingMonths(prev => ({ ...prev, [foundItem.monthKey]: true }));
          setExpandedPackingGroups(prev => ({ ...prev, [`${foundItem.monthKey}_${foundItem.category}`]: true }));
        }
      }
    }
  }, [selectedPackingProject, packingRawItems]);

  // Sections and menu items for each category (aligned with authentic modules)
  const navSections = {
    archive: {
      title: t('navArchive'),
      sections: [
        {
          heading: lang === 'en' ? 'COMPLETED PROJECTS (CLOSED)' : 'PROJECT SELESAI (CLOSED)',
          items: [
            {
              id: 'archive_all',
              label: t('sidebarAllArchive'),
              projectKey: 'ALL',
              icon: Layers,
              badge: detectedArchivedProjects.length > 0 ? `${detectedArchivedProjects.length} ${lang === 'en' ? 'Projects' : 'Proyek'}` : undefined
            },
            ...displayArchivedProjects.map((pName) => {
              const count = archivedCounts[pName] || 0;
              return {
                id: `archive_${pName}`,
                label: pName,
                projectKey: pName,
                icon: CheckCircle2,
                badge: count > 0 ? `${count} ${lang === 'en' ? 'Boxes' : 'Box'}` : undefined,
                color: 'bg-emerald-500'
              };
            })
          ]
        }
      ]
    },
    packing: {
      title: t('navPacking'),
      sections: []
    },
    production: {
      title: lang === 'en' ? 'Production' : 'Produksi',
      sections: [
        {
          heading: lang === 'en' ? 'PRODUCTION FLOOR' : 'LANTAI PRODUKSI',
          items: [
            { id: 'produksi', label: 'Print Queue', icon: Printer },
            { id: 'desk_print', label: 'Desk Print', icon: FolderKanban },
            { id: 'finishing', label: lang === 'en' ? 'Finishing Station' : 'Stasiun Finishing', icon: Scissors }
          ]
        }
      ]
    },
    logistics: {
      title: lang === 'en' ? 'Logistics & QC' : 'Logistik & QC',
      sections: [
        {
          heading: lang === 'en' ? 'QUALITY CONTROL & SHIPPING' : 'QUALITY CONTROL & PENGIRIMAN',
          items: [
            { id: 'checker', label: 'QC Station', icon: ShieldCheck },
            { id: 'outbound', label: lang === 'en' ? 'Shipping Station' : 'Stasiun Pengiriman', icon: Truck }
          ]
        }
      ]
    },
    workspaces: {
      title: lang === 'en' ? 'Workspaces' : 'Ruang Kerja',
      sections: [
        {
          heading: lang === 'en' ? 'PROGRAMS & MASTER DATA' : 'PROGRAM & MASTER DATA',
          items: [
            { id: 'label', label: lang === 'en' ? 'Print Label & Waybill' : 'Cetak Label & Surat Jalan', icon: Tag, color: 'bg-[#FF6422]' },
            { id: 'kawan_lama', label: 'Kawan Lama Solution', icon: Users, color: 'bg-[#EAB308]' },
            { id: 'custom_modules', label: lang === 'en' ? 'Customer & PMG Module' : 'Modul Pelanggan & PMG', icon: Settings, color: 'bg-[#06B6D4]' }
          ]
        }
      ]
    },
    dashboard: {
      title: t('sidebarOverview'),
      sections: [
        {
          heading: lang === 'en' ? 'FACTORY MONITORING' : 'MONITORING PABRIK',
          items: [
            { id: 'dashboard', label: 'Production Dashboard', icon: Home }
          ]
        }
      ]
    }
  };

  const currentNav = navSections[activeCategory] || navSections.production;

  return (
    <div className="flex h-full flex-shrink-0 z-30 select-none">
      {/* ============ 1. ICON RAIL (FLUSH TO VERY LEFT EDGE, NO MARGIN, NO PADDING) ============ */}
      <div className={`w-[60px] flex-shrink-0 flex flex-col items-center justify-between py-3.5 border-r transition-colors ${
        isDarkMode 
          ? 'bg-[#090D16] border-neutral-800 text-slate-400' 
          : 'bg-[#0C111D] border-slate-800 text-slate-400'
      }`}>
        {/* Top: Rail Items */}
        <div className="flex flex-col items-center gap-2 w-full pt-1">
          {/* Rail Items */}
          <nav className="flex flex-col items-center gap-1.5 w-full px-1.5">
            {railItems.map((item, idx) => {
              const Icon = item.icon;
              const isItemActive = activeCategory === item.category;

              return (
                <button
                  key={idx}
                  type="button"
                  title={item.title}
                  onClick={() => {
                    setActiveCategory(item.category);
                    setActiveTab(item.tab);
                    if (isSubPanelCollapsed) setIsSubPanelCollapsed(false);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer relative ${
                    isItemActive
                      ? 'bg-neutral-800/90 text-amber-500 shadow-sm border border-neutral-700/60'
                      : 'hover:bg-neutral-800/50 hover:text-slate-200 text-slate-400'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isItemActive ? 'text-amber-500' : 'text-slate-400'}`} />
                  {isItemActive && (
                    <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 bg-amber-500 rounded-r-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Rail: Theme toggle & User Profile */}
        <div className="flex flex-col items-center gap-3 w-full px-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            title={isDarkMode ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
            className="w-9 h-9 rounded-xl hover:bg-neutral-800 text-slate-400 hover:text-amber-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          <div
            title={currentAdmin?.name || 'Aiden Hudson'}
            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-amber-400 font-bold text-xs flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
          >
            {currentAdmin?.name ? currentAdmin.name.slice(0, 2).toUpperCase() : 'AH'}
          </div>
        </div>
      </div>

      {/* Mobile backdrop when sub-panel is open on small screens */}
      {!isSubPanelCollapsed && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-30 md:hidden"
          onClick={() => setIsSubPanelCollapsed(true)}
        />
      )}

      {/* ============ 2. SUB-NAV PANEL (FLUSH AGAINST RAIL, 100% HEIGHT) ============ */}
      <div className={`transition-all duration-200 ease-in-out border-r flex flex-col justify-between ${
        isSubPanelCollapsed ? 'w-0 overflow-hidden border-none' : 'w-[235px] lg:w-[245px]'
      } fixed md:relative left-[60px] md:left-0 top-0 bottom-0 z-40 md:z-auto shadow-2xl md:shadow-none ${
        isDarkMode 
          ? 'bg-neutral-900 border-neutral-800 text-slate-100' 
          : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* Header Sub-Nav: Title + Tabs (Sesuai Gambar) */}
          <div className="border-b border-slate-200/80 dark:border-neutral-800 pb-2 flex items-start justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                {currentNav.title}
              </h2>
              {/* Workspace Tab with Orange Underline */}
              <div className="mt-2 -mb-2.5 flex items-center gap-4">
                <button
                  type="button"
                  className="text-xs font-bold pb-2 text-slate-900 dark:text-white border-b-2 border-amber-600 transition-colors cursor-pointer"
                >
                  {t('sidebarWorkspace')}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSubPanelCollapsed(true)}
              title={t('sidebarHidePanel')}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Sections & Menu Items */}
          <div className="space-y-4 pt-1">
            {activeCategory === 'packing' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    {t('sidebarMasterMonth')}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700">
                    {packingMonthGroups.length} {t('sidebarPeriod')}
                  </span>
                </div>

                {/* Tombol Semua Proyek Packing */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('paking');
                    if (onSelectPackingProject) onSelectPackingProject('ALL');
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      setIsSubPanelCollapsed(true);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                    (selectedPackingProject || 'ALL') === 'ALL'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Layers className={`w-4 h-4 shrink-0 ${(selectedPackingProject || 'ALL') === 'ALL' ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="truncate">{t('sidebarAllPacking')}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    (selectedPackingProject || 'ALL') === 'ALL'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700'
                  }`}>
                    {packingRawItems.length} {lang === 'en' ? 'Packages' : 'Kolian'}
                  </span>
                </button>

                {/* Daftar Induk Grup BULAN Packing */}
                {packingMonthGroups.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-slate-400">
                    Tidak ada proyek paking aktif
                  </div>
                ) : (
                  <div className="space-y-2 pt-0.5">
                    {packingMonthGroups.map(month => {
                      const isMonthOpen = !!expandedPackingMonths[month.monthKey];
                      const isMonthActive = selectedPackingProject === `MONTH:${month.monthKey}`;

                      return (
                        <div key={month.monthKey} className="rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 overflow-hidden shadow-2xs">
                          {/* Header Induk Grup BULAN */}
                          <div
                            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-all duration-150 cursor-pointer ${
                              isMonthActive
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 font-bold'
                                : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800 font-semibold'
                            }`}
                          >
                            <div
                              className="flex items-center gap-2 min-w-0 flex-1"
                              onClick={() => {
                                setActiveTab('paking');
                                if (onSelectPackingProject) onSelectPackingProject(`MONTH:${month.monthKey}`);
                                setExpandedPackingMonths(prev => ({
                                  ...prev,
                                  [month.monthKey]: !prev[month.monthKey]
                                }));
                              }}
                            >
                              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate font-bold uppercase tracking-tight">{month.monthLabel}</span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                {month.totalBoxes} Box
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedPackingMonths(prev => ({
                                    ...prev,
                                    [month.monthKey]: !prev[month.monthKey]
                                  }));
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                title={isMonthOpen ? 'Tutup bulan' : 'Buka bulan'}
                              >
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMonthOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''}`} />
                              </button>
                            </div>
                          </div>

                          {/* Konten Proyek Sesuai Bulannya (Jika Bulan Terbuka) */}
                          {isMonthOpen && (
                            <div className="p-2 pt-1 border-t border-slate-100 dark:border-neutral-800/80 bg-slate-50/50 dark:bg-neutral-900/40 space-y-1.5">
                              {/* Tombol Semua Proyek Bulan Ini */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('paking');
                                  if (onSelectPackingProject) onSelectPackingProject(`MONTH:${month.monthKey}`);
                                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                    setIsSubPanelCollapsed(true);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                                  isMonthActive
                                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-700'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                                }`}
                              >
                                <span className="truncate">{lang === 'en' ? `${month.monthLabel} Projects` : `Proyek ${month.monthLabel}`}</span>
                                <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400">{month.totalBoxes} Box</span>
                              </button>

                              {/* Daftar Grup Brand Dalam Bulan Tersebut */}
                              {month.brandGroups.map(grp => {
                                const groupKey = `MONTH:${month.monthKey}|GROUP:${grp.categoryName}`;
                                const isGroupActive = selectedPackingProject === groupKey;
                                const hasSubActive = grp.projects.some(p => p.name === selectedPackingProject);
                                const groupAccordionKey = `${month.monthKey}_${grp.categoryName}`;
                                const isGroupOpen = !!expandedPackingGroups[groupAccordionKey];

                                return (
                                  <div key={grp.categoryName} className="rounded-lg overflow-hidden">
                                    {/* Baris Brand Kategori */}
                                    <div
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                                        isGroupActive || hasSubActive
                                          ? 'bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold border border-emerald-300/80 dark:border-emerald-700/60'
                                          : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-neutral-800/60 font-medium'
                                      }`}
                                    >
                                      <div
                                        className="flex items-center gap-2 min-w-0 flex-1 py-0.5"
                                        onClick={() => {
                                          setActiveTab('paking');
                                          if (onSelectPackingProject) onSelectPackingProject(groupKey);
                                          setExpandedPackingGroups(prev => ({
                                            ...prev,
                                            [groupAccordionKey]: !prev[groupAccordionKey]
                                          }));
                                        }}
                                      >
                                        <span className={`w-2 h-2 rounded-full ${grp.color} shrink-0`} />
                                        <span className="truncate font-semibold">{grp.categoryName === 'PROJECT LAINNYA' ? (lang === 'en' ? 'OTHER PROJECTS' : 'PROJECT LAINNYA') : grp.categoryName}</span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                                          {grp.totalBoxes}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedPackingGroups(prev => ({
                                              ...prev,
                                              [groupAccordionKey]: !prev[groupAccordionKey]
                                            }));
                                          }}
                                          className="p-0.5 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded text-slate-400"
                                        >
                                          <ChevronDown className={`w-3 h-3 transition-transform ${isGroupOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Sub-projects list */}
                                    {isGroupOpen && (
                                      <div className="ml-3 pl-2 border-l border-slate-200 dark:border-neutral-700 my-1 space-y-0.5">
                                        {grp.projects.map(sub => {
                                          const isSubActive = selectedPackingProject === sub.name;
                                          return (
                                            <button
                                              key={sub.name}
                                              type="button"
                                              onClick={() => {
                                                setActiveTab('paking');
                                                if (onSelectPackingProject) onSelectPackingProject(sub.name);
                                                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                                  setIsSubPanelCollapsed(true);
                                                }
                                              }}
                                              className={`w-full flex items-center justify-between px-2 py-1 rounded text-[10px] transition-all cursor-pointer ${
                                                isSubActive
                                                  ? 'bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 font-bold'
                                                  : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-slate-200'
                                              }`}
                                            >
                                              <span className="truncate text-left">{sub.name}</span>
                                              <span className="text-[9px] text-slate-400 ml-1 shrink-0">{sub.count}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeCategory === 'archive' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    ARSIP INDUK BULAN
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700">
                    {archiveMonthGroups.length} Periode
                  </span>
                </div>

                {/* Tombol Semua Arsip Project */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('close_project');
                    if (onSelectArchiveProject) onSelectArchiveProject('ALL');
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      setIsSubPanelCollapsed(true);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                    (selectedArchiveProject || 'ALL') === 'ALL'
                      ? 'bg-[#FFF7ED] dark:bg-amber-950/40 text-[#9A3412] dark:text-amber-200 font-bold border border-amber-200/80 dark:border-amber-800/60 shadow-2xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Layers className={`w-4 h-4 shrink-0 ${(selectedArchiveProject || 'ALL') === 'ALL' ? 'text-[#EA580C]' : 'text-slate-400'}`} />
                    <span className="truncate">{t('sidebarAllArchive')}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    (selectedArchiveProject || 'ALL') === 'ALL'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700'
                  }`}>
                    {archivedRawItems.length} {lang === 'en' ? 'Boxes' : 'Box'}
                  </span>
                </button>

                {/* Daftar Induk Grup BULAN */}
                <div className="space-y-2 pt-0.5">
                  {archiveMonthGroups.map(month => {
                    const isMonthOpen = !!expandedMonths[month.monthKey];
                    const isMonthActive = selectedArchiveProject === `MONTH:${month.monthKey}`;
                    const hasChildActive = selectedArchiveProject.startsWith(`MONTH:${month.monthKey}|`) ||
                      month.brandGroups.some(bg => bg.projects.some(p => p.name === selectedArchiveProject));

                    return (
                      <div key={month.monthKey} className="rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 overflow-hidden shadow-2xs">
                        {/* Header Induk Grup BULAN */}
                        <div
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-all duration-150 cursor-pointer ${
                            isMonthActive
                              ? 'bg-amber-100/70 dark:bg-amber-950/50 text-[#9A3412] dark:text-amber-200 font-bold'
                              : hasChildActive
                              ? 'bg-slate-100 dark:bg-neutral-800/80 text-slate-900 dark:text-white font-bold'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-800/40 font-semibold'
                          }`}
                        >
                          <div
                            className="flex items-center gap-2 min-w-0 flex-1"
                            onClick={() => {
                              setActiveTab('close_project');
                              if (onSelectArchiveProject) onSelectArchiveProject(`MONTH:${month.monthKey}`);
                              setExpandedMonths(prev => ({
                                ...prev,
                                [month.monthKey]: !prev[month.monthKey]
                              }));
                            }}
                          >
                            <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                            <span className="truncate font-bold uppercase tracking-tight">{month.monthLabel}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">
                              {month.totalBoxes} Box
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMonthToDelete({
                                  monthKey: month.monthKey,
                                  monthLabel: month.monthLabel,
                                  totalBoxes: month.totalBoxes
                                });
                                setShowDeleteMonthModal(true);
                                setDeletePinInput('');
                                setDeletePinError('');
                              }}
                              className="p-1 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-slate-400 dark:text-neutral-500 rounded-md transition-colors cursor-pointer"
                              title={t('deleteMonthTooltip')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMonths(prev => ({
                                  ...prev,
                                  [month.monthKey]: !prev[month.monthKey]
                                }));
                              }}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                              title={isMonthOpen ? 'Tutup bulan' : 'Buka bulan'}
                            >
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMonthOpen ? 'rotate-180 text-purple-600 dark:text-purple-400' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Konten Proyek Sesuai Bulannya (Jika Bulan Terbuka) */}
                        {isMonthOpen && (
                          <div className="p-2 pt-1 border-t border-slate-100 dark:border-neutral-800/80 bg-slate-50/50 dark:bg-neutral-900/40 space-y-1.5">
                            {/* Tombol Semua Proyek Bulan Ini */}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('close_project');
                                if (onSelectArchiveProject) onSelectArchiveProject(`MONTH:${month.monthKey}`);
                                if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                  setIsSubPanelCollapsed(true);
                                }
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                                isMonthActive
                                  ? 'bg-[#FFF7ED] text-[#9A3412] dark:bg-amber-950/60 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-700'
                                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                              }`}
                            >
                              <span className="truncate">{lang === 'en' ? `${month.monthLabel} Projects` : `Proyek ${month.monthLabel}`}</span>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-neutral-400">{month.totalBoxes} Box</span>
                            </button>

                            {/* Daftar Grup Brand Dalam Bulan Tersebut */}
                            {month.brandGroups.map(grp => {
                              const groupKey = `MONTH:${month.monthKey}|GROUP:${grp.categoryName}`;
                              const isGroupActive = selectedArchiveProject === groupKey;
                              const hasSubActive = grp.projects.some(p => p.name === selectedArchiveProject);
                              const groupAccordionKey = `${month.monthKey}_${grp.categoryName}`;
                              const isGroupOpen = !!expandedArchiveGroups[groupAccordionKey];

                              return (
                                <div key={grp.categoryName} className="rounded-lg overflow-hidden">
                                  {/* Baris Brand Kategori */}
                                  <div
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer ${
                                      isGroupActive || hasSubActive
                                        ? 'bg-amber-100/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold border border-amber-300/80 dark:border-amber-700/60'
                                        : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-neutral-800/60 font-medium'
                                    }`}
                                  >
                                    <div
                                      className="flex items-center gap-2 min-w-0 flex-1 py-0.5"
                                      onClick={() => {
                                        setActiveTab('close_project');
                                        if (onSelectArchiveProject) onSelectArchiveProject(groupKey);
                                        setExpandedArchiveGroups(prev => ({
                                          ...prev,
                                          [groupAccordionKey]: !prev[groupAccordionKey]
                                        }));
                                      }}
                                    >
                                      <span className={`w-2 h-2 rounded-full ${grp.color} shrink-0`} />
                                      <span className="truncate font-semibold">{grp.categoryName === 'PROJECT LAINNYA' ? (lang === 'en' ? 'OTHER PROJECTS' : 'PROJECT LAINNYA') : grp.categoryName}</span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400">
                                        {grp.totalBoxes}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedArchiveGroups(prev => ({
                                            ...prev,
                                            [groupAccordionKey]: !prev[groupAccordionKey]
                                          }));
                                        }}
                                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded text-slate-400"
                                      >
                                        <ChevronDown className={`w-3 h-3 transition-transform ${isGroupOpen ? 'rotate-180 text-amber-500' : ''}`} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Sub-projects list */}
                                  {isGroupOpen && (
                                    <div className="ml-3 pl-2 border-l border-slate-200 dark:border-neutral-700 my-1 space-y-0.5">
                                      {grp.projects.map(sub => {
                                        const isSubActive = selectedArchiveProject === sub.name;
                                        return (
                                          <button
                                            key={sub.name}
                                            type="button"
                                            onClick={() => {
                                              setActiveTab('close_project');
                                              if (onSelectArchiveProject) onSelectArchiveProject(sub.name);
                                              if (typeof window !== 'undefined' && window.innerWidth < 768) {
                                                setIsSubPanelCollapsed(true);
                                              }
                                            }}
                                            className={`w-full flex items-center justify-between px-2 py-1 rounded text-[10px] transition-all cursor-pointer ${
                                              isSubActive
                                                ? 'bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 font-bold'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-slate-200'
                                            }`}
                                          >
                                            <span className="truncate text-left">{sub.name}</span>
                                            <span className="text-[9px] text-slate-400 ml-1 shrink-0">{sub.count}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              currentNav.sections.map((sec, sIdx) => (
                <div key={sIdx} className="space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 px-3 py-1">
                    {sec.heading}
                  </div>

                  <div className="space-y-0.5">
                    {sec.items.map(item => {
                      const isPackingProject = activeCategory === 'packing' && item.projectKey !== undefined;
                      const isArchiveProject = activeCategory === 'archive' && item.projectKey !== undefined;

                      let isActive = false;
                      if (isPackingProject) {
                        isActive = activeTab === 'paking' && (selectedPackingProject || 'ALL') === item.projectKey;
                      } else if (isArchiveProject) {
                        isActive = activeTab === 'close_project' && (selectedArchiveProject || 'ALL') === item.projectKey;
                      } else {
                        isActive = activeTab === item.id;
                      }
                      const ItemIcon = item.icon;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isPackingProject) {
                              setActiveTab('paking');
                              if (onSelectPackingProject) {
                                onSelectPackingProject(item.projectKey);
                              }
                            } else if (isArchiveProject) {
                              setActiveTab('close_project');
                              if (onSelectArchiveProject) {
                                onSelectArchiveProject(item.projectKey);
                              }
                            } else if (item.id === 'paking') {
                              setActiveCategory('packing');
                              setActiveTab('paking');
                            } else if (item.id === 'close_project') {
                              setActiveCategory('archive');
                              setActiveTab('close_project');
                            } else {
                              setActiveTab(item.id);
                            }
                            if (typeof window !== 'undefined' && window.innerWidth < 768) {
                              setIsSubPanelCollapsed(true);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-[#FFF7ED] dark:bg-amber-950/40 text-[#9A3412] dark:text-amber-200 font-bold border border-amber-200/80 dark:border-amber-800/60 shadow-2xs'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800/60 font-medium'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.color ? (
                              <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                            ) : ItemIcon ? (
                              <ItemIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#EA580C]' : 'text-slate-400'}`} />
                            ) : null}
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.badge && (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-200 dark:border-neutral-700'
                            }`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Sub-Nav */}
        <div className="p-3 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/30 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="truncate font-medium">Wellen Print</span>
          <span className="font-mono font-bold text-slate-500">{spkCount} SPK</span>
        </div>
      </div>

      {/* Button to expand sub-panel if collapsed */}
      {isSubPanelCollapsed && (
        <div className="absolute left-[60px] top-4 z-40">
          <button
            type="button"
            onClick={() => setIsSubPanelCollapsed(false)}
            title="Tampilkan Panel Menu"
            className="p-1.5 rounded-r-xl bg-slate-900 dark:bg-neutral-800 text-white shadow-md hover:bg-slate-800 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL PIN KEAMANAN UNTUK HAPUS ARSIP PER BULAN */}
      {showDeleteMonthModal && monthToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 z-[999] flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${
            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-neutral-800">
              <div className="p-2.5 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{t('deleteMonthTitle')}</h3>
                <p className="text-[11px] text-slate-500 dark:text-neutral-400">{t('deleteMonthSubtitle')}</p>
              </div>
            </div>

            <form onSubmit={handleConfirmDeleteMonth} className="space-y-4 pt-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === 'en' ? (
                  <>This action will permanently delete all project archive data for <strong>{monthToDelete.monthLabel}</strong> ({monthToDelete.totalBoxes} packages). Enter Security PIN to proceed:</>
                ) : (
                  <>Tindakan ini akan <strong>menghapus permanen seluruh data arsip</strong> periode <strong>{monthToDelete.monthLabel}</strong> ({monthToDelete.totalBoxes} Box) dari sistem. Masukkan PIN Keamanan untuk melanjutkan:</>
                )}
              </p>

              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={deletePinInput}
                  onChange={(e) => {
                    setDeletePinInput(e.target.value);
                    setDeletePinError('');
                  }}
                  placeholder={t('modalClearPlaceholder')}
                  className="w-full text-center tracking-widest text-base font-mono font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-800/80 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:focus:ring-neutral-700 transition-all"
                />
                {deletePinError && (
                  <p className="text-xs font-semibold text-rose-500 mt-1.5 text-center">
                    {deletePinError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteMonthModal(false);
                    setMonthToDelete(null);
                    setDeletePinInput('');
                    setDeletePinError('');
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {t('btnCancel')}
                </button>
                <button
                  type="submit"
                  disabled={isDeletingMonth}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white shadow-xs transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isDeletingMonth ? (lang === 'en' ? 'Deleting...' : 'Menghapus...') : t('btnConfirmDelete')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
