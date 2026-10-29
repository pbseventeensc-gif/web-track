import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  CheckCircle2,
  RefreshCw,
  FolderCheck,
  ChevronUp,
  ChevronDown,
  Download,
  Check,
  Box,
  Camera,
  Eye,
  LayoutGrid,
  List,
  Upload,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { extractBaseProjectName, getProjectCategory, getItemMonthKey, getItemMonthLabel } from '../../utils/projectGrouping';
import CustomDropdown from '../ui/CustomDropdown';
import { useLanguage } from '../../utils/i18n';
import { deleteMonthArchive } from '../../utils/archiveActions';

export default function CloseProjectView({ isDarkMode, onOpenImageModal, externalProjectFilter, onProjectFilterChange }) {
  const { lang, t } = useLanguage();
  const [packingList, setPackingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState(() => externalProjectFilter || 'ALL');
  const [sortOrder, setSortOrder] = useState('asc');
  const [collapsedProjects, setCollapsedProjects] = useState({});
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'gallery'
  const [uploadingId, setUploadingId] = useState(null);

  // State untuk Hapus Arsip Per Bulan dengan PIN
  const [showDeleteMonthModal, setShowDeleteMonthModal] = useState(false);
  const [monthToDelete, setMonthToDelete] = useState(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deletePinError, setDeletePinError] = useState('');
  const [isDeletingMonth, setIsDeletingMonth] = useState(false);

  const toggleProjectCollapse = (projectName) => {
    setCollapsedProjects(prev => ({
      ...prev,
      [projectName]: !prev[projectName]
    }));
  };

  const handleToggleSelectRow = (id) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.length === filteredList.length && filteredList.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filteredList.map(item => item.id));
    }
  };

  useEffect(() => {
    if (externalProjectFilter !== undefined && externalProjectFilter !== filterProject) {
      setFilterProject(externalProjectFilter);
    }
  }, [externalProjectFilter]);

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

  const getProjectGroupKey = (promoTitle) => {
    return extractBaseProjectName(promoTitle) || '-';
  };

  const fetchClosedData = async () => {
    setLoading(true);
    try {
      const combined = [];
      const savedCustomPhotos = JSON.parse(localStorage.getItem('archive_custom_photos') || '{}');

      // 1. Ambil data arsip dari pmg_projects
      const { data: pmgData, error: pmgErr } = await supabase
        .from('pmg_projects')
        .select('id, project_name, transaction_code, deliver_to, pic_up, dr_number, address, delivery_date, created_at')
        .order('id', { ascending: false })
        .limit(300);

      if (!pmgErr && pmgData) {
        pmgData.forEach(p => {
          let projName = String(p.project_name || '').trim();
          if (projName && projName !== '-' && !/^tes(\d+)?$/i.test(projName) && !/^test(\d+)?$/i.test(projName)) {
            combined.push({
              id: `pmg-${p.id}`,
              box_code: p.transaction_code || `SJ-${p.id}`,
              store_name: p.deliver_to || p.pic_up || 'Tujuan Proyek',
              recipient_name: p.pic_up || p.pic_name || '-',
              phone_number: p.phone_no || p.phone || '-',
              address: p.address || '-',
              no_spk: p.dr_number || '-',
              promo_title: p.project_name,
              delivery_type: (p.address || '').toLowerCase().includes('jakarta') ? 'DALAM KOTA' : 'LUAR KOTA',
              bukti_paking_url: savedCustomPhotos[`pmg-${p.id}`] || null,
              status_qc_label: 'DONE',
              status_qc_packing: 'DONE',
              status_qc_checker: 'DONE',
              status_deliver: 'DONE',
              delivery_date: p.delivery_date,
              created_at: p.delivery_date || p.created_at || new Date().toISOString()
            });
          }
        });
      }

      // 2. Ambil data dari packing_tracking
      const { data: packData, error: packErr } = await supabase
        .from('packing_tracking')
        .select('id, bukti_paking_url, status_qc_checker, outbound_url, status_deliver, bukti_checker_url, status_qc_label, status_qc_packing, tracking_id, box_code, store_name, no_spk, promo_title, delivery_type, delivery_date, updated_at, items_detail')
        .order('id', { ascending: false })
        .limit(300);

      if (!packErr && packData) {
        packData.forEach(item => {
          const hasPhoto = Boolean(item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' && item.bukti_paking_url.length > 5);
          const hasCheckerOrDeliver = Boolean(
            item.status_qc_checker === 'DONE' ||
            (item.bukti_outbound_url && item.bukti_outbound_url !== 'No Foto' && item.bukti_outbound_url !== '-' && item.bukti_outbound_url.length > 5) ||
            item.outbound_url ||
            item.status_deliver === 'DONE'
          );
          if (hasPhoto || hasCheckerOrDeliver) {
            const photoUrl = (hasPhoto ? item.bukti_paking_url : null) || item.outbound_url || item.bukti_outbound_url || item.bukti_checker_url || savedCustomPhotos[item.id] || null;
            combined.push({
              ...item,
              bukti_paking_url: photoUrl,
              status_qc_label: item.status_qc_label || 'DONE',
              status_qc_packing: item.status_qc_packing || 'DONE',
              status_qc_checker: item.status_qc_checker || 'DONE'
            });
          }
        });
      }

      // 3. Muat file dari bucket storage surat-jalan untuk auto-match foto yang belum terhubung
      try {
        const { data: storageFiles } = await supabase.storage.from('surat-jalan').list('', { limit: 1000 });
        if (storageFiles && storageFiles.length > 0) {
          const fileMap = {};
          storageFiles.forEach(f => {
            if (f.name && f.metadata?.size > 0) {
              const { data: u } = supabase.storage.from('surat-jalan').getPublicUrl(f.name);
              fileMap[f.name.toLowerCase()] = u.publicUrl;
            }
          });

          // Lengkapi foto jika ada yang cocok dengan kode kolian / cabang
          combined.forEach(item => {
            if (!item.bukti_paking_url) {
              const cleanBox = (item.box_code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const cleanStore = (item.store_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const matchedKey = Object.keys(fileMap).find(k => {
                if (cleanBox && cleanBox.length >= 3 && k.includes(cleanBox)) return true;
                if (cleanStore && cleanStore.length >= 6 && k.includes(cleanStore)) return true;
                return false;
              });
              if (matchedKey) {
                item.bukti_paking_url = fileMap[matchedKey];
              }
            }
          });
        }
      } catch (stErr) {
        console.warn('Storage file list warning:', stErr);
      }

      setPackingList(combined);
    } catch (e) {
      console.error('Error fetching closed project data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async (e, item) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingId(item.id);
      const cleanBox = String(item.box_code || item.id).replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `archive_bukti_${cleanBox}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('surat-jalan')
        .upload(fileName, file, { contentType: file.type || 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Update di packing_tracking jika id numerik
      if (typeof item.id === 'number' || (!String(item.id).startsWith('pmg-') && !isNaN(Number(item.id)))) {
        await supabase
          .from('packing_tracking')
          .update({
            bukti_paking_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }

      // Simpan ke localStorage agar foto tetap tersimpan
      const savedPhotos = JSON.parse(localStorage.getItem('archive_custom_photos') || '{}');
      savedPhotos[item.id] = publicUrl;
      localStorage.setItem('archive_custom_photos', JSON.stringify(savedPhotos));

      // Update state lokal
      setPackingList(prev => prev.map(p => p.id === item.id ? { ...p, bukti_paking_url: publicUrl } : p));

      alert(`Foto dokumentasi untuk ${item.box_code || 'kolian'} berhasil disimpan.`);
    } catch (err) {
      alert('Gagal mengunggah foto: ' + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  useEffect(() => {
    fetchClosedData();

    let debounceTimer = null;
    const triggerDebouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchClosedData();
      }, 500);
    };

    const handleArchiveSync = () => {
      triggerDebouncedFetch();
    };
    window.addEventListener('app_archive_data_changed', handleArchiveSync);

    const channel1 = supabase
      .channel('close_project_pack_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packing_tracking' }, triggerDebouncedFetch)
      .subscribe();

    const channel2 = supabase
      .channel('close_project_pmg_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pmg_projects' }, triggerDebouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
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
      if (filterProject && filterProject.includes(monthToDelete.monthKey)) {
        setFilterProject('ALL');
        if (onProjectFilterChange) onProjectFilterChange('ALL');
      }
      fetchClosedData();
      alert(t('deleteMonthSuccess'));
    } catch (err) {
      alert(t('deleteMonthFail') + err.message);
    } finally {
      setIsDeletingMonth(false);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${hours}:${mins} • ${day}/${month}`;
    } catch (e) {
      return dateStr;
    }
  };

  const uniqueProjects = Array.from(
    new Set(
      packingList
        .filter(item => item.promo_title && item.promo_title.trim() !== '')
        .map(item => getProjectGroupKey(item.promo_title))
        .filter(str => str !== '-' && str !== '')
    )
  ).sort((a, b) => a.localeCompare(b));

  // Pengelompokan proyek berdasarkan bulan dan kategori brand untuk dropdown
  const uniqueMonthsAndProjects = useMemo(() => {
    const monthMap = {};
    packingList.forEach(item => {
      if (!item.promo_title || item.promo_title.trim() === '') return;
      const mKey = getItemMonthKey(item.delivery_date || item.created_at);
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
  }, [packingList, lang]);

  const sortedList = [...packingList].sort((a, b) => {
    const projA = getProjectGroupKey(a.promo_title).toLowerCase();
    const projB = getProjectGroupKey(b.promo_title).toLowerCase();
    if (projA !== projB) {
      return sortOrder === 'asc' ? projA.localeCompare(projB) : projB.localeCompare(projA);
    }
    const storeA = (a.store_name || '').toLowerCase();
    const storeB = (b.store_name || '').toLowerCase();
    return sortOrder === 'asc' ? storeA.localeCompare(storeB) : storeB.localeCompare(storeA);
  });

  const filteredList = sortedList.filter(item => {
    if (filterProject !== 'ALL') {
      const itemMonth = getItemMonthKey(item.delivery_date || item.created_at);
      const itemCat = getProjectCategory(item.promo_title).toUpperCase();
      const itemKey = getProjectGroupKey(item.promo_title).toLowerCase();

      if (filterProject.startsWith('MONTH:')) {
        const clean = filterProject.replace('MONTH:', '');
        const [targetMonth, targetGroup] = clean.split('|GROUP:');
        if (itemMonth !== targetMonth) return false;
        if (targetGroup && itemCat !== targetGroup.trim().toUpperCase()) return false;
      } else if (filterProject.startsWith('GROUP:')) {
        const cat = filterProject.replace('GROUP:', '').trim().toUpperCase();
        if (itemCat !== cat) return false;
      } else {
        const target = filterProject.trim().toLowerCase();
        if (itemKey !== target && itemCat !== target) return false;
      }
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchBox = (item.box_code || '').toLowerCase().includes(term);
      const matchTrack = (item.tracking_id || '').toLowerCase().includes(term);
      const matchSpk = (item.no_spk || '').toLowerCase().includes(term);
      const matchStore = (item.store_name || '').toLowerCase().includes(term);
      const matchPromo = (item.promo_title || '').toLowerCase().includes(term);
      const matchGroup = getProjectGroupKey(item.promo_title).toLowerCase().includes(term);

      return matchBox || matchTrack || matchSpk || matchStore || matchPromo || matchGroup;
    }

    return true;
  });

  const totalClosedBoxes = packingList.length;
  const totalClosedProjects = uniqueProjects.length;
  const activeMonthKey = filterProject.startsWith('MONTH:')
    ? filterProject.replace('MONTH:', '').split('|')[0]
    : null;
  const activeMonthObj = activeMonthKey
    ? uniqueMonthsAndProjects.find(m => m.key === activeMonthKey)
    : null;
  const totalPhotosCount = useMemo(() => {
    return filteredList.filter(item => !!(item.bukti_paking_url || item.bukti_checker_url || item.outbound_url)).length;
  }, [filteredList]);

  // EXPORT EXCEL KHUSUS PROYEK ARSIP SELESAI
  const handleExportExcel = () => {
    try {
      const dataToExport = selectedRowIds.length > 0
        ? filteredList.filter(item => selectedRowIds.includes(item.id))
        : filteredList;

      if (dataToExport.length === 0) {
        alert('Tidak ada data arsip proyek yang dapat diekspor.');
        return;
      }

      const formattedData = dataToExport.map((item, index) => {
        const rawPakingUrl = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' ? item.bukti_paking_url : '';
        const rawOutboundUrl = item.bukti_outbound_url || item.outbound_url || '';

        return {
          No: index + 1,
          'Kode Kolian': item.box_code || '-',
          'Nomor SPK': item.no_spk || '-',
          'Nama Cabang / Alamat': item.store_name || '-',
          'Proyek / Promo': item.promo_title || '-',
          'Jalur Pengiriman': item.delivery_type || 'DALAM KOTA',
          'Tanggal Selesai': item.delivery_date ? new Date(item.delivery_date).toLocaleDateString('id-ID') : (item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'),
          'Status QC Label': item.status_qc_label || 'DONE',
          'Status QC Paking': item.status_qc_packing || 'DONE',
          'Status QC Pemeriksa': item.status_qc_checker || 'DONE',
          'Status Pengiriman': item.status_deliver || 'DONE',
          'Tautan Bukti Foto Paking': rawPakingUrl || '-',
          'Tautan Bukti Pengiriman': rawOutboundUrl || '-'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);

      // Otomatis jadikan link sebagai hyperlink interaktif
      if (worksheet['!ref']) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];
            if (cell && typeof cell.v === 'string' && cell.v.startsWith('http')) {
              cell.l = { Target: cell.v, Tooltip: 'Klik untuk melihat foto dokumentasi' };
            }
          }
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Arsip_Proyek_Selesai');

      const todayStr = new Date().toISOString().slice(0, 10);
      let fileNameStr = `Arsip_Proyek_Selesai_Semua_${todayStr}.xlsx`;

      if (filterProject !== 'ALL') {
        const cleanProj = String(filterProject).replace(/[/\\?%*:|"<>]/g, '_').trim();
        fileNameStr = `Arsip_Proyek_${cleanProj}_${todayStr}.xlsx`;
      }

      XLSX.writeFile(workbook, fileNameStr);
      alert(`Berhasil mengunduh berkas Excel: ${fileNameStr} (${dataToExport.length} data).`);
    } catch (err) {
      alert('Gagal mengekspor laporan arsip: ' + err.message);
    }
  };

  return (
    <div className={`space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900/90 border border-slate-200/80 dark:border-neutral-800 shadow-2xs max-w-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50/90 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60">
              <FolderCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
                {t('archiveTitle')}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400 mt-0.5 leading-snug">
                {t('archiveSubtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              const currentKeys = Array.from(new Set(filteredList.map(item => getProjectGroupKey(item.promo_title))));
              const isAllCollapsed = currentKeys.length > 0 && currentKeys.every(k => !!collapsedProjects[k]);
              if (isAllCollapsed) {
                setCollapsedProjects({});
              } else {
                const nextState = {};
                currentKeys.forEach(k => { nextState[k] = true; });
                setCollapsedProjects(nextState);
              }
            }}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
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

          <button
            onClick={fetchClosedData}
            disabled={loading}
            className="flex-1 sm:flex-initial px-4 py-2 bg-purple-50/90 hover:bg-purple-100/90 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800/60 active:scale-95 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? t('archiveRefreshingBtn') : t('archiveRefreshBtn')}
          </button>
        </div>
      </div>

      {/* RINGKASAN STATISTIK */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-full">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-neutral-900/80 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-center min-w-0">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block truncate">
            {t('archiveTotalProjects')}
          </span>
          <span className="text-lg sm:text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5 block">
            {totalClosedProjects}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 shadow-2xs text-center min-w-0">
          <span className="text-[10px] sm:text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider block truncate">
            {t('archiveTotalBoxes')}
          </span>
          <span className="text-lg sm:text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5 block">
            {totalClosedBoxes}
          </span>
        </div>
      </div>

      {/* FILTER, PENCARIAN & EXPORT EXCEL */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900/90 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between max-w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-200/80 dark:border-neutral-700 bg-slate-50/60 dark:bg-neutral-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-800"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {packingList.length > 0 && (
            <CustomDropdown
              value={filterProject}
              onChange={(e) => {
                setFilterProject(e.target.value);
                if (onProjectFilterChange) onProjectFilterChange(e.target.value);
              }}
              className="w-full sm:w-auto min-w-[200px] sm:min-w-[240px]"
            >
              <option value="ALL">{t('archiveAllCompleted')} ({packingList.length} {t('boxes')})</option>
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
          )}

          {/* Toggle View: Tabel vs Galeri Foto */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-neutral-800 rounded-xl border border-slate-200/80 dark:border-neutral-700 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-neutral-900 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('archiveViewTable')}
            >
              <List className="w-3.5 h-3.5" />
              <span>{t('archiveViewTable')}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'gallery'
                  ? 'bg-white dark:bg-neutral-900 text-purple-700 dark:text-purple-300 shadow-xs'
                  : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('archiveViewGallery')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t('archiveViewGallery')}</span>
              {totalPhotosCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-mono leading-tight">
                  {totalPhotosCount}
                </span>
              )}
            </button>
          </div>

          {/* Tombol Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-50/90 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
            title="Unduh Laporan Arsip Proyek Selesai (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('btnExportExcel')}</span>
            {selectedRowIds.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-mono leading-none">
                {selectedRowIds.length}
              </span>
            )}
          </button>

          {/* Tombol Hapus Arsip Per Bulan */}
          {uniqueMonthsAndProjects.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const targetM = activeMonthObj || uniqueMonthsAndProjects[0];
                setMonthToDelete({
                  monthKey: targetM.key,
                  monthLabel: targetM.label,
                  totalBoxes: targetM.totalBoxes
                });
                setDeletePinInput('');
                setDeletePinError('');
                setShowDeleteMonthModal(true);
              }}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 dark:bg-neutral-800 dark:hover:bg-rose-950/30 dark:text-neutral-300 dark:hover:text-rose-300 dark:border-neutral-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
              title={activeMonthObj ? (t('deleteMonthTooltip') || `Hapus arsip periode ${activeMonthObj.label}`) : (t('deleteMonthTitle') || 'Hapus Arsip Bulan')}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{activeMonthObj ? (lang === 'en' ? `Delete ${activeMonthObj.label}` : `Hapus ${activeMonthObj.label}`) : (lang === 'en' ? 'Delete Month' : 'Hapus Bulan')}</span>
            </button>
          )}
        </div>
      </div>

      {/* KONTEN ARSIP: TABEL ATAU GALERI FOTO */}
      {viewMode === 'table' ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-2xs">
        <div className="max-h-[620px] overflow-y-auto overflow-x-auto bg-white dark:bg-neutral-900 custom-scrollbar relative">
          <table className="w-full text-left border-collapse bg-white dark:bg-neutral-900 min-w-[840px]">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-xs border-b border-slate-200/80 dark:border-neutral-800 text-slate-400 dark:text-neutral-500 text-[11px] font-semibold uppercase tracking-wider">
              <tr>
                {/* 1. Checkbox Select All */}
                <th className="py-3.5 pl-4 pr-2 text-center w-10">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                      selectedRowIds.length === filteredList.length && filteredList.length > 0
                        ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                        : 'border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-purple-600'
                    }`}
                    title={t('thSelectAll')}
                  >
                    {selectedRowIds.length === filteredList.length && filteredList.length > 0 && (
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    )}
                  </button>
                </th>

                {/* 2. BOX */}
                <th className="py-3.5 pl-1 pr-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer select-none uppercase font-semibold"
                    title={t('sortAscDesc')}
                  >
                    <span>{t('thBox')}</span>
                    <span className="flex flex-col -space-y-1.5 text-slate-400">
                      <ChevronUp className={`w-3 h-3 ${sortOrder === 'asc' ? 'text-purple-600 stroke-[3]' : 'opacity-40'}`} />
                      <ChevronDown className={`w-3 h-3 ${sortOrder === 'desc' ? 'text-purple-600 stroke-[3]' : 'opacity-40'}`} />
                    </span>
                  </button>
                </th>

                {/* 3. CUSTOMER / SPK */}
                <th className="py-3.5 px-4 whitespace-nowrap">{t('thCustomerSpk')}</th>

                {/* 4. SHIPPING TYPE */}
                <th className="py-3.5 px-4 whitespace-nowrap">{t('thShippingType')}</th>

                {/* 5. IMPORT DATE */}
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thImportDate')}</th>

                {/* 6. LABEL & DESIGN */}
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thLabelDesign')}</th>

                {/* 7. PHOTO PROOF */}
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thPhotoProof')}</th>

                {/* 8. PACKING STATUS */}
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thPackingStatus')}</th>

                {/* 9. CHECKER STATUS */}
                <th className="py-3.5 px-4 text-center whitespace-nowrap">{t('thCheckerStatus')}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 px-6 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center justify-center">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 text-purple-600 dark:text-purple-300 flex items-center justify-center mb-2.5 shadow-2xs">
                        <Box className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t('archiveNoMatchingData')}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                        {t('archiveNoMatchingDataDesc')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  const currentGroupKey = getProjectGroupKey(item.promo_title);
                  const prevGroupKey = idx > 0 ? getProjectGroupKey(filteredList[idx - 1]?.promo_title) : null;
                  const showProjectDivider = idx === 0 || currentGroupKey !== prevGroupKey;
                  const isCollapsed = !!collapsedProjects[currentGroupKey];
                  const isSelected = selectedRowIds.includes(item.id);
                  const pakingImgUrl = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' ? item.bukti_paking_url : '';

                  return (
                    <React.Fragment key={item.id}>
                      {/* BARIS PEMBATAS ANTAR PROYEK (PERSIS PAKING STATION) */}
                      {showProjectDivider && (
                        <tr
                          onClick={() => toggleProjectCollapse(currentGroupKey)}
                          className="bg-purple-50/90 border-y border-purple-200/80 dark:bg-purple-950/40 dark:border-purple-800/60 cursor-pointer select-none hover:bg-purple-100/80 dark:hover:bg-purple-900/50 transition-colors"
                          title={isCollapsed ? "Klik untuk menampilkan rincian proyek" : "Klik untuk menyembunyikan rincian proyek"}
                        >
                          <td colSpan="9" className="py-2.5 px-4 font-bold text-purple-800 dark:text-purple-300 text-[11px] tracking-wider uppercase">
                            <div className="flex flex-row justify-between items-center gap-4 w-full">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="p-1 rounded-lg bg-white/90 border border-purple-200/80 dark:bg-purple-900/60 dark:border-purple-700/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
                                  {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                                </span>
                                <span className="font-extrabold text-purple-800 dark:text-purple-200 truncate">{currentGroupKey}</span>
                                <span className="text-[10px] font-semibold text-purple-600/80 dark:text-purple-300/80 ml-2">
                                  ({getItemMonthLabel(getItemMonthKey(item.delivery_date || item.created_at), lang)})
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 normal-case" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1.5 flex-wrap font-mono">
                                  {(() => {
                                    const projItems = packingList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase());
                                    const totalProj = projItems.length;
                                    return (
                                      <>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] font-semibold text-[10px] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60">
                                          {t('badgeLabelCount')} {totalProj}/{totalProj}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50/90 text-emerald-700 font-semibold text-[10px] border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                                          {t('badgePackingCount')} {totalProj}/{totalProj}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-white/90 text-purple-700 font-semibold text-[10px] border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60">
                                          {t('badgeCheckerCount')} {totalProj}/{totalProj}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-100/90 text-purple-800 font-semibold text-[10px] border border-purple-300/80 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-700/60">
                                          {t('badgeTotalBoxesCount')} {totalProj}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>

                                <div className="flex items-center gap-1.5 border-l border-purple-200/80 dark:border-purple-800/60 pl-2">
                                  {(() => {
                                    const projRowIds = packingList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase()).map(p => p.id);
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
                                        className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shadow-2xs active:scale-95 border ${
                                          isAllProjSelected
                                            ? 'bg-purple-600 text-white border-purple-600'
                                            : 'bg-white dark:bg-neutral-800 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-50'
                                        }`}
                                        title={isAllProjSelected ? t('deselectAllProjectBranches') : t('selectAllProjectBranches')}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* RINCIAN BARIS ITEM */}
                      {!isCollapsed && (
                        <tr
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-purple-50/60 hover:bg-purple-100/50 dark:bg-purple-950/30'
                              : 'hover:bg-slate-50/80 dark:hover:bg-neutral-800/40 bg-white dark:bg-neutral-900'
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-3.5 pl-4 pr-2 text-center w-10">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectRow(item.id)}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                                isSelected
                                  ? 'bg-purple-600 border-purple-600 text-white shadow-2xs'
                                  : 'border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-purple-500'
                              }`}
                              title={isSelected ? t('deselectRow') : t('selectRow')}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                          </td>

                          {/* 2. BOX (Kode Kolian) */}
                          <td className="py-3.5 pl-1 pr-4 font-mono text-xs whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60 font-bold text-purple-700 dark:text-purple-300">
                              {item.box_code || '-'}
                            </span>
                          </td>

                          {/* 3. CUSTOMER / SPK */}
                          <td className="py-3.5 px-4 max-w-[280px]">
                            <div className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm truncate">
                              {item.store_name || '-'}
                            </div>
                            {item.no_spk && (
                              <div className="text-[11px] font-mono text-slate-500 dark:text-neutral-400 font-semibold mt-0.5">
                                {item.no_spk}
                              </div>
                            )}
                          </td>

                          {/* 4. SHIPPING TYPE */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-lg font-mono font-semibold text-[11px] uppercase tracking-wider text-center border ${
                              item.delivery_type === 'DALAM KOTA'
                                ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                                : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
                            }`}>
                              {item.delivery_type === 'DALAM KOTA' ? t('deliveryInCity') : t('deliveryOutCity')}
                            </span>
                          </td>

                          {/* 5. IMPORT DATE */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="font-mono text-xs text-slate-600 dark:text-neutral-300 font-medium block">
                              {formatDateTime(item.delivery_date || item.created_at)}
                            </span>
                          </td>

                          {/* 6. LABEL & DESIGN */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 bg-purple-50/90 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60 rounded-lg text-[10px] font-semibold">
                              {t('badgeLabelSj')}
                            </span>
                          </td>

                          {/* 7. PHOTO PROOF */}
                          <td className="py-3.5 px-4 text-center">
                            {pakingImgUrl ? (
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <div className="relative group mx-auto">
                                  <img
                                    src={pakingImgUrl}
                                    alt="Bukti Paking"
                                    onClick={() => onOpenImageModal && onOpenImageModal(
                                      pakingImgUrl,
                                      `Dokumentasi Paking - ${item.box_code || ''}`,
                                      item.store_name || '',
                                      item.promo_title || '',
                                      item.no_spk || ''
                                    )}
                                    className="w-12 h-12 object-cover rounded-xl border border-purple-200/80 dark:border-neutral-700 cursor-pointer group-hover:scale-105 transition-transform shadow-2xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => onOpenImageModal && onOpenImageModal(
                                      pakingImgUrl,
                                      `Dokumentasi Paking - ${item.box_code || ''}`,
                                      item.store_name || '',
                                      item.promo_title || '',
                                      item.no_spk || ''
                                    )}
                                    className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-xl flex items-center justify-center transition-opacity cursor-pointer"
                                    title={t('archiveViewFull')}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </div>
                                <label className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-1">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    disabled={uploadingId === item.id}
                                    onChange={(e) => handleUploadPhoto(e, item)}
                                  />
                                  <Camera className="w-3 h-3" />
                                  <span>{uploadingId === item.id ? t('badgeUploading') : t('badgeChangePhoto')}</span>
                                </label>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border border-purple-200/80 dark:border-purple-800/60 text-purple-700 dark:text-purple-300 font-bold text-xs cursor-pointer transition-all active:scale-95 shadow-2xs">
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  disabled={uploadingId === item.id}
                                  onChange={(e) => handleUploadPhoto(e, item)}
                                />
                                <Camera className="w-3.5 h-3.5" />
                                <span>{uploadingId === item.id ? t('badgeUploading') : t('badgeUploadPhoto')}</span>
                              </label>
                            )}
                          </td>

                          {/* 8. PACKING STATUS */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {t('statusDone')}
                            </span>
                          </td>

                          {/* 9. CHECKER STATUS */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50/90 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t('statusVerified')}
                            </span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        /* TAMPILAN GALERI FOTO PROYEK SELESAI */
        <div className="space-y-4">
          {filteredList.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200/80 dark:border-neutral-800 p-8 shadow-2xs">
              <ImageIcon className="w-12 h-12 text-slate-300 dark:text-neutral-600 mx-auto mb-3" />
              <p className="font-bold text-slate-700 dark:text-neutral-200 text-sm">{t('archiveEmptyTitle')}</p>
              <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">{t('archiveEmptyDesc')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredList.map((item) => {
                const photoUrl = item.bukti_paking_url || item.bukti_checker_url || item.outbound_url;
                const isSelected = selectedRowIds.includes(item.id);

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border bg-white dark:bg-neutral-900 overflow-hidden shadow-2xs transition-all hover:shadow-md flex flex-col ${
                      isSelected
                        ? 'border-purple-500 ring-2 ring-purple-400/30'
                        : 'border-slate-200/80 dark:border-neutral-800 hover:border-purple-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    {/* Wadah Gambar / Foto */}
                    <div className="relative aspect-4/3 bg-slate-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden group">
                      {photoUrl ? (
                        <>
                          <img
                            src={photoUrl}
                            alt={`Foto ${item.box_code || item.store_name}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div
                            onClick={() => onOpenImageModal && onOpenImageModal(
                              photoUrl,
                              `Dokumentasi Paking - ${item.box_code || ''}`,
                              item.store_name || '',
                              item.promo_title || '',
                              item.no_spk || ''
                            )}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer gap-2"
                          >
                            <span className="px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 font-bold text-xs flex items-center gap-1.5 shadow-lg backdrop-blur-xs">
                              <Eye className="w-3.5 h-3.5 text-purple-600" />
                              <span>{t('archiveViewFull')}</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-10 h-10 text-slate-300 dark:text-neutral-600 mx-auto mb-2" />
                          <span className="text-[11px] font-semibold text-slate-400 dark:text-neutral-500 block">{t('badgeNoPhoto')}</span>
                          <label className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold text-xs cursor-pointer border border-purple-200/80 dark:border-purple-800/60 shadow-2xs transition-all active:scale-95">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              disabled={uploadingId === item.id}
                              onChange={(e) => handleUploadPhoto(e, item)}
                            />
                            <Camera className="w-3.5 h-3.5" />
                            <span>{uploadingId === item.id ? t('badgeUploading') : t('archiveTakeUpload')}</span>
                          </label>
                        </div>
                      )}

                      {/* Box Code Overlay Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-xs font-mono font-bold text-xs text-white shadow-xs">
                          {item.box_code || '-'}
                        </span>
                      </div>

                      {/* Select Checkbox Overlay */}
                      <button
                        type="button"
                        onClick={() => handleToggleSelectRow(item.id)}
                        className={`absolute top-2.5 right-2.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs shadow-xs ${
                          isSelected
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-white/80 dark:bg-neutral-900/80 border-slate-300 dark:border-neutral-600 text-slate-600'
                        }`}
                        title={isSelected ? t('deselectRow') : t('selectRow')}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>
                    </div>

                    {/* Content Details */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-2.5">
                      <div>
                        <div className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-semibold truncate" title={item.promo_title}>
                          {item.promo_title || '-'}
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm mt-0.5 line-clamp-2" title={item.store_name}>
                          {item.store_name || '-'}
                        </h4>
                        {item.no_spk && (
                          <div className="text-[11px] font-mono text-slate-500 dark:text-neutral-400 font-medium mt-1">
                            SPK: {item.no_spk}
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2.5 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3" />
                          {t('statusDone')}
                        </span>

                        <label className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={uploadingId === item.id}
                            onChange={(e) => handleUploadPhoto(e, item)}
                          />
                          <Camera className="w-3 h-3" />
                          <span>{uploadingId === item.id ? t('badgeUploading') : photoUrl ? t('badgeChangePhoto') : t('archiveUpload')}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL HAPUS ARSIP BULAN DENGAN PIN */}
      {showDeleteMonthModal && monthToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200/80 dark:border-neutral-800 shadow-xl max-w-sm w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('deleteMonthTitle')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                    {t('deleteMonthSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteMonthModal(false);
                  setMonthToDelete(null);
                  setDeletePinInput('');
                  setDeletePinError('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteMonth} className="space-y-4 pt-1">
              {uniqueMonthsAndProjects.length > 1 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-neutral-400 mb-1.5">
                    {lang === 'en' ? 'Select Month Period:' : 'Pilih Periode Bulan:'}
                  </label>
                  <select
                    value={monthToDelete.monthKey}
                    onChange={(e) => {
                      const selected = uniqueMonthsAndProjects.find(m => m.key === e.target.value);
                      if (selected) {
                        setMonthToDelete({
                          monthKey: selected.key,
                          monthLabel: selected.label,
                          totalBoxes: selected.totalBoxes
                        });
                      }
                    }}
                    className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-neutral-700"
                  >
                    {uniqueMonthsAndProjects.map(m => (
                      <option key={m.key} value={m.key}>
                        {m.label} ({m.totalBoxes} {t('boxes')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
