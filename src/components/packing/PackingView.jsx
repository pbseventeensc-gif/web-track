import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  Search,
  Check,
  Clock,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Package
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import CustomDropdown from '../ui/CustomDropdown';
import { extractBaseProjectName, getProjectCategory, getItemMonthKey, getItemMonthLabel } from '../../utils/projectGrouping';
import { useLanguage } from '../../utils/i18n';

export default function PackingView({ isDarkMode, onOpenImageModal, externalProjectFilter, onProjectFilterChange }) {
  const { lang, t } = useLanguage();
  const [packingList, setPackingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [collapsedProjects, setCollapsedProjects] = useState({});

  const toggleProjectCollapse = (projKey) => {
    setCollapsedProjects(prev => ({ ...prev, [projKey]: !prev[projKey] }));
  };

  // Filter & Search States
  const [filterSource, setFilterSource] = useState('ALL'); // 'ALL', 'google_sheet', 'label_sj'
  const [filterDelivery, setFilterDelivery] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'IN_PROGRESS', 'COMPLETED'
  const [filterProject, setFilterProject] = useState(() => externalProjectFilter || 'ALL');

  useEffect(() => {
    if (externalProjectFilter !== undefined && externalProjectFilter !== filterProject) {
      setFilterProject(externalProjectFilter);
    }
  }, [externalProjectFilter]);
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');

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

  const extractCoreCode = (str) => {
    if (!str) return '';
    const parts = String(str).split(/[-.]/);
    const lastPart = parts[parts.length - 1].trim();
    const match = lastPart.match(/(\d+)$/);
    return match ? match[1] : lastPart;
  };

  const cleanKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const getCleanStoreName = (rawStore) => {
    if (!rawStore) return '-';
    const str = String(rawStore).trim();
    const commaParts = str.split(',');
    if (commaParts.length > 0 && commaParts[0].trim().length > 0) {
      return commaParts[0].trim();
    }
    return str;
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
      return `${hours}:${mins} / ${day}.${month}`;
    } catch (e) {
      return dateStr;
    }
  };

  const [showCheckedItems, setShowCheckedItems] = useState(false);

  const fetchPackingData = async () => {
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('packing_tracking')
        .select('id, items_detail, promo_title, box_code, store_name, no_spk, delivery_type, source, status_qc_packing, status_qc_checker, status_deliver, bukti_paking_url, bukti_outbound_url, outbound_url, packing_by, scanned_by, packing_at, updated_at, tracking_id, destination, branch_name, project, foto_by, foto_at')
        .order('id', { ascending: false })
        .limit(300);

      if (error) console.error('Fetch packing_tracking error:', error);

      // Coba perbaikan / sinkronkan dari spk_data hanya jika packing_tracking kosong
      if (!error && (!data || data.length === 0)) {
        try {
          const { data: spkRows } = await supabase
            .from('spk_data')
            .select('*')
            .order('id', { ascending: true });

          if (spkRows && spkRows.length > 0) {
            const payloads = spkRows.map((spk, idx) => {
              const trackingCode = spk.tracking_id || `${spk.no_spk || 'SPK'}-${spk.id || Date.now() + idx}`;
              const promoVal = spk.project || spk.promo_title || spk.project_name || spk.item_name || spk.bahan || 'Project Utama';
              const clientVal = spk.client || spk.client_pt || spk.client_name || 'Wellen Customer';
              const storeVal = spk.store_code || spk.store_name || spk.branch_name || spk.destination || spk.client || 'Store Utama';
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
        const normalizedData = data.map(item => {
          const details = parseItems(item.items_detail).map((sub, idx) => {
            const itemCode = sub.code || '';
            const itemCore = extractCoreCode(itemCode);
            const activeUrl = sub.image_url ||
              (window.__ACTIVE_DESIGN_URLS__ && (
                window.__ACTIVE_DESIGN_URLS__[cleanKey(itemCode)] ||
                window.__ACTIVE_DESIGN_URLS__[itemCore] ||
                window.__ACTIVE_DESIGN_URLS__[idx]
              )) || null;

            return {
              ...sub,
              image_url: activeUrl
            };
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
          if (!cleanPromo) cleanPromo = isValid(item.client_pt) ? String(item.client_pt).trim() : 'Project Utama';

          const hasPhoto = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-';
          const statusPacking = item.status_qc_packing === 'DONE' || hasPhoto ? 'DONE' : 'PENDING';

          return {
            ...item,
            store_name: cleanStore,
            promo_title: cleanPromo,
            items_detail: details,
            status_qc_packing: statusPacking
          };
        });

        setPackingList(normalizedData);
      }
    } catch (err) {
      console.error('fetchPackingData error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromSpkData = async () => {
    setLoading(true);
    try {
      const { data: spkRows, error } = await supabase.from('spk_data').select('*').order('id', { ascending: true });
      if (error || !spkRows || spkRows.length === 0) {
        alert('⚠️ Tidak ada data SPK di database yang dapat disinkronkan.');
        setLoading(false);
        return;
      }

      const payloads = spkRows.map((spk, idx) => {
        const trackingCode = spk.tracking_id || `${spk.no_spk || 'SPK'}-${spk.id || Date.now() + idx}`;
        const promoVal = spk.project || spk.promo_title || spk.project_name || spk.item_name || spk.bahan || 'Project Utama';
        const clientVal = spk.client || spk.client_pt || spk.client_name || 'Wellen Customer';
        const storeVal = spk.store_code || spk.store_name || spk.branch_name || spk.destination || spk.client || 'Store Utama';
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
      alert(`✅ Berhasil menyinkronkan ${payloads.length} data SPK ke Packing Station!`);
    } catch (err) {
      alert('❌ Gagal sinkronisasi data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackingData();

    let debounceTimer = null;
    const channel = supabase
      .channel('packing_view_realtime')
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

  const handleToggleStatus = async (id, fieldName, currentValue) => {
    const nextValue = currentValue === 'DONE' ? 'PENDING' : 'DONE';
    setPackingList(prev =>
      prev.map(item => item.id === id ? { ...item, [fieldName]: nextValue } : item)
    );

    const { error } = await supabase
      .from('packing_tracking')
      .update({
        [fieldName]: nextValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      alert('Gagal memperbarui status paking: ' + error.message);
      fetchPackingData();
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedRowIds.length === filteredList.length && filteredList.length > 0) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(filteredList.map(item => item.id));
    }
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
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            0.98
          );
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
        .upload(fileName, uploadBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('packing_tracking')
        .update({
          bukti_paking_url: publicUrl,
          status_qc_packing: 'DONE',
          updated_at: nowIso
        })
        .eq('id', rowId);

      if (updateError) throw updateError;

      setPackingList(prev =>
        prev.map(item =>
          item.id === rowId
            ? { ...item, bukti_paking_url: publicUrl, status_qc_packing: 'DONE' }
            : item
        )
      );

      alert('Dokumentasi foto paking berhasil diunggah.');
    } catch (err) {
      alert('Gagal mengunggah dokumentasi foto: ' + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const getProjectGroupKey = (promoTitle) => {
    return extractBaseProjectName(promoTitle) || '-';
  };

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

  const activePackingList = showCheckedItems ? packingList : packingList.filter(item => !isClosedItem(item));

  // Filter Data Logic
  const uniqueProjects = Array.from(
    new Set(
      activePackingList
        .filter(item => item.promo_title && item.promo_title.trim() !== '')
        .map(item => getProjectGroupKey(item.promo_title))
        .filter(str => str !== '-' && str !== '')
    )
  ).sort((a, b) => a.localeCompare(b));

  const sortedPackingList = [...activePackingList].sort((a, b) => {
    const projA = getProjectGroupKey(a.promo_title).toLowerCase();
    const projB = getProjectGroupKey(b.promo_title).toLowerCase();
    if (projA !== projB) {
      return sortOrder === 'asc' ? projA.localeCompare(projB) : projB.localeCompare(projA);
    }
    const storeA = (a.store_name || '').toLowerCase();
    const storeB = (b.store_name || '').toLowerCase();
    return sortOrder === 'asc' ? storeA.localeCompare(storeB) : storeB.localeCompare(storeA);
  });

  const filteredList = sortedPackingList.filter(item => {
    if (filterSource !== 'ALL' && (filterSource === 'google_sheet' ? item.source !== 'google_sheet' : item.source === 'google_sheet')) return false;
    if (filterDelivery !== 'ALL' && item.delivery_type !== filterDelivery) return false;

    const isDone = item.status_qc_packing === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-');
    if (filterStatus === 'IN_PROGRESS' && isDone) return false;
    if (filterStatus === 'COMPLETED' && !isDone) return false;

    if (filterProject !== 'ALL') {
      const itemMonth = getItemMonthKey(item.created_at || item.updated_at);
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

  const totalBoxes = activePackingList.length;
  const completedBoxes = activePackingList.filter(
    item => item.status_qc_packing === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-')
  ).length;
  const pendingBoxes = totalBoxes - completedBoxes;

  return (
    <div className={`space-y-4 w-full max-w-full overflow-hidden font-sans ${isDarkMode ? 'text-slate-100' : 'text-[#1E293B]'}`}>

      {/* HEADER RINGKAS & PERBARUI DATA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-[#DBEAFE] dark:border-neutral-800 shadow-master-sm max-w-full">
        <div className="min-w-0 flex-1 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 flex items-center justify-center shrink-0 shadow-master-sm">
            <Package className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                PACKING STATION
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#1E3A8A] dark:text-white truncate mt-0.5">
              Packing Station
            </h2>
            <p className="text-[11px] sm:text-xs text-[#475569] dark:text-neutral-400 mt-0.5 leading-snug">
              Verifikasi kelengkapan barang dan unggah dokumentasi foto untuk setiap kolian.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => {
              const currentKeys = Array.from(new Set(filteredList.map(item => getProjectGroupKey(item.promo_title))));
              const isAllCollapsed = currentKeys.length > 0 && currentKeys.every(k => !!collapsedProjects[k]);
              const nextState = {};
              currentKeys.forEach(k => { nextState[k] = !isAllCollapsed; });
              setCollapsedProjects(nextState);
            }}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 select-none"
            title="Buka atau tutup seluruh rincian proyek"
          >
            {(() => {
              const currentKeys = Array.from(new Set(filteredList.map(item => getProjectGroupKey(item.promo_title))));
              const isAllCollapsed = currentKeys.length > 0 && currentKeys.every(k => !!collapsedProjects[k]);
              return isAllCollapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Buka Semua</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Tutup Semua</span>
                </>
              );
            })()}
          </button>

          <button
            onClick={handleSyncFromSpkData}
            disabled={loading}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Sinkronkan data SPK terbaru dari Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync SPK Data
          </button>

          <button
            onClick={fetchPackingData}
            disabled={loading}
            className="flex-1 sm:flex-initial px-4 py-2 bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 active:scale-95 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-master-sm shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Memuat Data...' : 'Perbarui Data'}</span>
          </button>
        </div>
      </div>

      {/* RINGKASAN STATUS KOLIAN */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-full">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-[#DBEAFE] dark:border-neutral-800 shadow-master-sm text-center min-w-0">
          <span className="font-mono text-[10px] sm:text-xs font-semibold text-[#475569] dark:text-neutral-400 uppercase tracking-wider block truncate">
            Total Kolian
          </span>
          <span className="font-mono text-lg sm:text-2xl font-bold text-[#1E3A8A] dark:text-white mt-0.5 block">
            {totalBoxes}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFF7ED] dark:bg-amber-950/40 border border-[#FED7AA] dark:border-amber-800/60 shadow-master-sm text-center min-w-0">
          <span className="font-mono text-[10px] sm:text-xs font-semibold text-[#C2410C] dark:text-amber-300 uppercase tracking-wider block truncate">
            Dalam Proses
          </span>
          <span className="font-mono text-lg sm:text-2xl font-bold text-[#C2410C] dark:text-amber-300 mt-0.5 block">
            {pendingBoxes}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 shadow-master-sm text-center min-w-0">
          <span className="font-mono text-[10px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block truncate">
            Selesai
          </span>
          <span className="font-mono text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 block">
            {completedBoxes}
          </span>
        </div>
      </div>

      {/* PANEL UTAMA: FILTER BAR & TABEL DATA */}
      <div className="rounded-2xl border border-[#DBEAFE] dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-master-sm overflow-hidden max-w-full">
        <div className="p-4 bg-[#F4F8FD]/90 dark:bg-neutral-800/40 border-b border-[#DBEAFE] dark:border-neutral-800 space-y-3 max-w-full">
          <div className="flex flex-col sm:flex-row gap-2.5 justify-between">
            {/* INPUT PENCARIAN */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#475569] dark:text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nomor SPK, kode kolian, cabang, atau proyek..."
                className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-[#CBD5E1] dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[#1E293B] dark:text-slate-100 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 shadow-master-sm"
              />
            </div>

            {/* PEMILIH PROYEK */}
            {activePackingList.length > 0 && (
              <CustomDropdown
                value={filterProject}
                onChange={(e) => {
                  setFilterProject(e.target.value);
                  if (onProjectFilterChange) onProjectFilterChange(e.target.value);
                }}
                className="w-full sm:w-auto min-w-[200px] sm:min-w-[260px]"
              >
                <option value="ALL">{t('filterProjectAll')} ({activePackingList.length} {t('boxes')})</option>
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
          </div>

          {/* FILTER TAB STATUS & JALUR PENGIRIMAN */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#DBEAFE]/70 dark:border-neutral-800 flex-wrap max-w-full">
            {/* FILTER SUMBER DATA */}
            <div className="flex items-center gap-1 bg-[#E9EFF8]/80 dark:bg-neutral-800 p-1 rounded-xl shrink-0 border border-[#CBD5E1]/70 dark:border-neutral-700">
              <button
                onClick={() => setFilterSource('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap cursor-pointer ${
                  filterSource === 'ALL'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 font-semibold shadow-master-sm'
                    : 'text-[#475569] dark:text-neutral-300 font-medium hover:bg-white/70 dark:hover:bg-neutral-700/60'
                }`}
              >
                {t('filterSourceAll')}
              </button>
              <button
                onClick={() => setFilterSource('google_sheet')}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap cursor-pointer ${
                  filterSource === 'google_sheet'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 font-semibold shadow-master-sm'
                    : 'text-[#475569] dark:text-neutral-300 font-medium hover:bg-white/70 dark:hover:bg-neutral-700/60'
                }`}
              >
                Google Spreadsheet
              </button>
              <button
                onClick={() => setFilterSource('label_sj')}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap cursor-pointer ${
                  filterSource === 'label_sj'
                    ? 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 font-semibold shadow-master-sm'
                    : 'text-[#475569] dark:text-neutral-300 font-medium hover:bg-white/70 dark:hover:bg-neutral-700/60'
                }`}
              >
                Label & Surat Jalan
              </button>
            </div>

            {/* FILTER STATUS */}
            <div className="flex items-center gap-1 bg-[#E9EFF8]/80 dark:bg-neutral-800 p-1 rounded-xl shrink-0 border border-[#CBD5E1]/70 dark:border-neutral-700">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap cursor-pointer ${
                  filterStatus === 'ALL'
                    ? 'bg-white text-[#1E3A8A] border border-[#BFDBFE] dark:bg-neutral-700 dark:text-slate-100 dark:border-neutral-600 font-semibold shadow-master-sm'
                    : 'text-[#475569] dark:text-neutral-300 font-medium hover:bg-white/70 dark:hover:bg-neutral-700/60'
                }`}
              >
                {t('filterStatusAll')}
              </button>
              <button
                onClick={() => setFilterStatus('IN_PROGRESS')}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap inline-flex items-center gap-1 cursor-pointer ${
                  filterStatus === 'IN_PROGRESS'
                    ? 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 font-semibold shadow-master-sm'
                    : 'text-[#475569] dark:text-neutral-300 font-medium hover:bg-white/70 dark:hover:bg-neutral-700/60'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{t('tabInProgress')}</span>
              </button>
              <button
                onClick={() => setFilterStatus('COMPLETED')}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap inline-flex items-center gap-1 cursor-pointer ${
                  filterStatus === 'COMPLETED'
                    ? 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold shadow-master-sm'
                    : 'text-[#475569] dark:text-neutral-300 font-medium hover:bg-white/70 dark:hover:bg-neutral-700/60'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>{t('tabCompleted')}</span>
              </button>
            </div>

            {/* FILTER JALUR PENGIRIMAN */}
            <div className="flex items-center gap-1 bg-[#E9EFF8]/80 dark:bg-neutral-800 p-1 rounded-xl shrink-0 border border-[#CBD5E1]/70 dark:border-neutral-700">
              {['ALL', 'DALAM KOTA', 'LUAR KOTA'].map((route) => (
                <button
                  key={route}
                  onClick={() => setFilterDelivery(route)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap cursor-pointer ${
                    filterDelivery === route
                      ? 'bg-purple-50/90 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60 font-semibold shadow-master-sm'
                      : 'text-[#475569] dark:text-neutral-300 font-medium hover:bg-white/70 dark:hover:bg-neutral-700/60'
                  }`}
                >
                  {route === 'ALL' ? t('filterDeliveryAll') : (route === 'DALAM KOTA' ? t('filterInCity') : t('filterOutCity'))}
                </button>
              ))}
            </div>
          </div>
        </div>

      {/* DATA CONTENT AREA */}
      {filteredList.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white dark:bg-neutral-800 rounded-2xl border border-slate-200 dark:border-neutral-700 shadow-2xs max-w-full space-y-4">
          {packingList.length === 0 ? (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-xl font-bold">
                📦
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                Belum Ada Data Paking di Database
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                Jika data SPK sudah di-import hari ini, klik tombol di bawah untuk menyinkronkan data SPK ke Packing Station.
              </p>
              <button
                type="button"
                onClick={handleSyncFromSpkData}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Sinkronkan Data SPK Sekarang
              </button>
            </div>
          ) : activePackingList.length === 0 ? (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-xl font-bold">
                ✅
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                Semua ({packingList.length}) Box Telah Diverifikasi Checker
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                Seluruh data paking telah di-check oleh Staff Checker dan berpindah ke Outbound.
              </p>
              <button
                type="button"
                onClick={() => setShowCheckedItems(!showCheckedItems)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {showCheckedItems ? 'Sembunyikan Box Finished' : 'Tampilkan Box Finished'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-neutral-700 text-slate-500 dark:text-neutral-400 flex items-center justify-center mx-auto text-xl font-bold">
                🔍
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                Tidak Ada Data Sesuai Filter
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                Ada {activePackingList.length} box paking aktif, namun tidak cocok dengan filter / kata kunci pencarian saat ini.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilterSource('ALL');
                  setFilterDelivery('ALL');
                  setFilterStatus('ALL');
                  setFilterProject('ALL');
                  setSearchTerm('');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Reset Semua Filter
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-[#E9EFF8]/85 dark:bg-neutral-800/90 text-[#1E3A8A] dark:text-neutral-200 font-mono font-bold border-b border-[#BFDBFE]/80 dark:border-neutral-700 uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-4 text-center">STATUS PAKING</th>
                  <th className="py-3.5 pl-4 pr-2 text-center w-10">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                        selectedRowIds.length === filteredList.length && filteredList.length > 0
                          ? 'bg-emerald-50/90 border-emerald-400 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300 shadow-master-sm'
                          : 'border-[#93C5FD] dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-[#2563EB]'
                      }`}
                      title="Pilih Semua Baris"
                    >
                      {selectedRowIds.length === filteredList.length && filteredList.length > 0 && (
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 pl-1 pr-4">
                    <button
                      type="button"
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="inline-flex items-center gap-1.5 hover:text-[#2563EB] dark:hover:text-emerald-300 transition-colors cursor-pointer select-none uppercase"
                      title="Urutkan Menaik / Menurun"
                    >
                      <span>KODE KOLIAN</span>
                      <span className="flex flex-col -space-y-1.5 text-[#475569] dark:text-neutral-500">
                        <ChevronUp className={`w-3 h-3 ${sortOrder === 'asc' ? 'text-[#2563EB] dark:text-emerald-400 stroke-[3]' : 'opacity-40'}`} />
                        <ChevronDown className={`w-3 h-3 ${sortOrder === 'desc' ? 'text-[#2563EB] dark:text-emerald-400 stroke-[3]' : 'opacity-40'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="py-3.5 px-4">NAMA CABANG / NOMOR SPK</th>
                  <th className="py-3.5 px-4">JALUR PENGIRIMAN</th>
                  <th className="py-3.5 px-4 text-center">TANGGAL MASUK</th>
                  <th className="py-3.5 px-4 text-center">LABEL & DESAIN</th>
                  <th className="py-3.5 px-4 text-center">BUKTI FOTO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9EFF8] dark:divide-neutral-800">
                {filteredList.map((item, idx) => {
                  const details = parseItems(item.items_detail);
                  const isPackingDone = item.status_qc_packing === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-');
                  const isUploadingThis = uploadingId === item.id;
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
                          title={isCollapsed ? "Klik untuk menampilkan rincian proyek" : "Klik untuk menyembunyikan rincian proyek"}
                        >
                          <td colSpan="8" className="py-2.5 px-4 font-bold text-[#C2410C] dark:text-amber-200 text-[11px] tracking-wider uppercase">
                            <div className="flex flex-row justify-between items-center gap-4 w-full">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="p-1 rounded-lg bg-white/80 border border-[#FED7AA] dark:bg-amber-900/60 dark:border-amber-700/60 text-[#C2410C] dark:text-amber-200 flex items-center justify-center shrink-0">
                                  {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                                </span>
                                <span className="font-bold text-[#9A3412] dark:text-amber-200 truncate">{currentGroupKey}</span>
                                <span className="text-[10px] font-semibold text-amber-700/80 dark:text-amber-300/80 ml-2">
                                  ({getItemMonthLabel(getItemMonthKey(item.created_at || item.updated_at))})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 normal-case font-mono">
                                {(() => {
                                  const projItems = activePackingList.filter(p => getProjectGroupKey(p.promo_title).toLowerCase() === currentGroupKey.toLowerCase());
                                  const totalProj = projItems.length;
                                  const labelDone = projItems.filter(p => p.status_qc_label === 'DONE' || String(p.status_qc_label).includes('DONE')).length;
                                  const packingDone = projItems.filter(p => p.status_qc_packing === 'DONE' || (p.bukti_paking_url && p.bukti_paking_url !== 'No Foto')).length;
                                  const checkerDone = projItems.filter(p => p.status_qc_checker === 'DONE').length;
                                  return (
                                    <>
                                      <span className="px-2.5 py-0.5 rounded-lg bg-[#EFF6FF] text-[#1D4ED8] font-semibold text-[10px] border border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60">
                                        Label: {labelDone}/{totalProj}
                                      </span>
                                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50/90 text-emerald-700 font-semibold text-[10px] border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60">
                                        Paking: {packingDone}/{totalProj}
                                      </span>
                                      <span className="px-2.5 py-0.5 rounded-lg bg-white/90 text-[#C2410C] font-semibold text-[10px] border border-[#FED7AA] dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
                                        Pemeriksa: {checkerDone}/{totalProj}
                                      </span>
                                      <span className="px-2.5 py-0.5 rounded-lg bg-purple-50/90 text-purple-700 font-semibold text-[10px] border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60">
                                        Total Kolian: {totalProj}
                                      </span>
                                    </>
                                  );
                                })()}
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
                              : isPackingDone
                              ? 'bg-emerald-50/35 hover:bg-emerald-100/35 dark:bg-emerald-950/20'
                              : 'hover:bg-[#F4F8FD] dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          {/* 1. STATUS PAKING */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <button
                                onClick={() => handleToggleStatus(item.id, 'status_qc_packing', item.status_qc_packing)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                                  isPackingDone
                                    ? 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60'
                                    : 'bg-[#E9EFF8]/80 hover:bg-[#DBEAFE]/60 text-[#475569] border-[#CBD5E1] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isPackingDone ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                {isPackingDone ? 'Selesai' : 'Menunggu'}
                              </button>
                              {isPackingDone && (
                                <div className="text-[10px] font-semibold text-[#1E293B] dark:text-neutral-300 leading-tight mt-0.5">
                                  <span className="block truncate max-w-[110px]">{item.packing_by || item.scanned_by || 'Petugas Paking'}</span>
                                  <span className="text-[9px] font-mono text-[#475569] dark:text-neutral-400 font-normal block">{formatDateTime(item.packing_at || item.updated_at) || '-'}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 2. PILIH BARIS */}
                          <td className="py-3.5 pl-4 pr-2 text-center w-10">
                            <button
                              onClick={() => handleToggleSelectRow(item.id)}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                                isSelected
                                  ? 'bg-emerald-50/90 border-emerald-400 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-300 shadow-master-sm'
                                  : 'border-[#CBD5E1] dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-[#2563EB]'
                              }`}
                              title={isSelected ? 'Batalkan Pilihan' : 'Pilih Baris'}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </button>
                          </td>

                          {/* 3. KODE KOLIAN */}
                          <td className="py-3 pl-1 pr-4 font-mono text-xs whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/40 border border-[#BFDBFE] dark:border-blue-800/60 font-bold text-[#1E3A8A] dark:text-blue-200">
                              {item.box_code || '-'}
                            </span>
                          </td>

                          {/* 4. NAMA CABANG / SPK */}
                          <td className="py-3 px-4 max-w-[280px]">
                            <div className="font-bold text-[#1E293B] dark:text-white text-xs sm:text-sm flex items-center gap-2 flex-wrap tracking-tight">
                              <span>{getCleanStoreName(item.store_name)}</span>
                            </div>
                            {item.no_spk && (
                              <div className="text-[11px] font-mono text-[#475569] dark:text-neutral-400 font-semibold mt-0.5">{item.no_spk}</div>
                            )}
                          </td>

                          {/* 5. JALUR PENGIRIMAN */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-lg font-mono font-semibold text-[11px] uppercase tracking-wider text-center border ${
                              item.delivery_type === 'DALAM KOTA'
                                ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                                : 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE] dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
                            }`}>
                              {item.delivery_type || 'DALAM KOTA'}
                            </span>
                          </td>

                          {/* 6. TANGGAL MASUK */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-mono text-[11px] text-[#475569] dark:text-neutral-300 font-medium block">
                              {formatDateTime(item.created_at || item.updated_at)}
                            </span>
                          </td>

                          {/* 7. LABEL & DESAIN */}
                          <td className="py-3 px-4 text-center">
                            {item.source !== 'google_sheet' ? (
                              <span className="inline-block px-2.5 py-1 bg-purple-50/90 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 rounded-lg text-[10px] font-semibold">
                                Label Surat Jalan
                              </span>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center justify-center gap-1 max-h-12 overflow-y-auto">
                                  {details.map((sub, sIdx) => (
                                    sub.image_url ? (
                                      <img
                                        key={sIdx}
                                        src={sub.image_url}
                                        alt="Desain"
                                        onClick={() => onOpenImageModal && onOpenImageModal(sub.image_url, sub.code)}
                                        className="w-16 h-16 sm:w-20 sm:h-20 object-contain bg-[#F4F8FD] dark:bg-neutral-900 rounded-xl border border-[#BFDBFE] dark:border-neutral-700 cursor-pointer shadow-master-sm hover:scale-105 transition-transform p-0.5"
                                      />
                                    ) : null
                                  ))}
                                </div>
                                <span className="font-mono text-[10px] text-[#475569] dark:text-neutral-400 font-medium">
                                  {details.filter(i => i.image_url).length} / {details.length} Desain
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 8. BUKTI FOTO */}
                          <td className="py-3 px-4 text-center">
                            {item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' ? (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <img
                                  src={item.bukti_paking_url}
                                  alt="Bukti Paking"
                                  onClick={() => onOpenImageModal && onOpenImageModal(
                                    item.bukti_paking_url,
                                    `Bukti Paking - ${item.tracking_id || item.box_code || ''}`,
                                    item.destination || item.store_name || item.branch_name || '',
                                    item.promo_title || item.project || '',
                                    item.no_spk || item.tracking_id || ''
                                  )}
                                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl border border-[#BFDBFE] dark:border-neutral-700 cursor-pointer hover:scale-105 transition-transform shadow-master-sm"
                                />
                                <div className="text-[10px] font-semibold text-[#1E293B] dark:text-neutral-300 leading-tight">
                                  <span className="block truncate max-w-[110px]">{item.foto_by || item.scanned_by || 'Petugas QC'}</span>
                                  <span className="text-[9px] font-mono text-[#475569] dark:text-neutral-400 font-normal block">{formatDateTime(item.foto_at || item.updated_at) || '-'}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <label className="px-3 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 rounded-xl cursor-pointer shadow-master-sm transition-all active:scale-95 inline-flex items-center gap-1.5 text-[10px] font-semibold" title="Unggah Foto Paking">
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>{isUploadingThis ? 'Mengunggah...' : 'Ambil Foto'}</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    disabled={isUploadingThis}
                                    onChange={(e) => handleCameraCapture(e, item.id, item.tracking_id || item.box_code)}
                                    className="hidden"
                                  />
                                </label>
                                <span className="text-[#475569] dark:text-neutral-500 font-medium text-[10px]">Belum Ada Foto</span>
                              </div>
                            )}
                          </td>

                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
