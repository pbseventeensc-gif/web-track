import React, { useState, useEffect } from 'react';
import {
  Camera,
  Search,
  Check,
  Clock,
  RefreshCw,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function PackingView({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  // Filter & Search States
  const [filterSource, setFilterSource] = useState('ALL'); // 'ALL', 'google_sheet', 'label_sj'
  const [filterDelivery, setFilterDelivery] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'IN_PROGRESS', 'COMPLETED'
  const [filterProject, setFilterProject] = useState('ALL');
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

  const fetchPackingData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('*')
      .order('id', { ascending: false });

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

        const hasPhoto = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-';
        const statusPacking = item.status_qc_packing === 'DONE' || hasPhoto ? 'DONE' : 'PENDING';

        return {
          ...item,
          items_detail: details,
          status_qc_packing: statusPacking
        };
      });

      setPackingList(normalizedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPackingData();

    const channel = supabase
      .channel('packing_view_realtime')
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
      alert('⚠️ Failed to update status: ' + error.message);
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
          const MAX_DIM = 2048;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            0.8
          );
        };
      };
    });
  };

  const handleCameraCapture = async (e, rowId, trackingId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(rowId);
    try {
      const uploadBlob = await compressImage(file);
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

      alert('✅ Photo proof uploaded successfully!');
    } catch (err) {
      alert('❌ Failed to upload photo: ' + err.message);
    } finally {
      setUploadingId(null);
    }
  };

  // Filter Data Logic
  const uniqueProjects = Array.from(
    new Set(
      packingList
        .filter(item => item.promo_title && item.promo_title.trim() !== '')
        .map(item => (item.promo_title || '-').trim())
        .filter(str => str !== '-' && str !== '')
    )
  ).sort((a, b) => a.localeCompare(b));

  const sortedPackingList = [...packingList].sort((a, b) => {
    const projA = (a.promo_title || '').toLowerCase();
    const projB = (b.promo_title || '').toLowerCase();
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
      if ((item.promo_title || '').trim().toLowerCase() !== filterProject.trim().toLowerCase()) return false;
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchBox = (item.box_code || '').toLowerCase().includes(term);
      const matchTrack = (item.tracking_id || '').toLowerCase().includes(term);
      const matchSpk = (item.no_spk || '').toLowerCase().includes(term);
      const matchStore = (item.store_name || '').toLowerCase().includes(term);
      const matchPromo = (item.promo_title || '').toLowerCase().includes(term);

      return matchBox || matchTrack || matchSpk || matchStore || matchPromo;
    }

    return true;
  });

  const totalBoxes = packingList.length;
  const completedBoxes = packingList.filter(
    item => item.status_qc_packing === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-')
  ).length;
  const pendingBoxes = totalBoxes - completedBoxes;

  return (
    <div className={`space-y-3.5 sm:space-y-6 w-full max-w-full overflow-hidden ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>

      {/* HEADER RINGKAS & REFRESH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs max-w-full">
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
            Packing Station Staff
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400 mt-0.5 leading-snug">
            Verify packing & upload photo proof for each box.
          </p>
        </div>

        <button
          onClick={fetchPackingData}
          disabled={loading}
          className="w-full sm:w-auto px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh Data'}
        </button>
      </div>

      {/* RINGKASAN STATUS BOX */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-full">
        <div className="p-2.5 sm:p-4 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block truncate">TOTAL BOXES</span>
          <span className="text-base sm:text-2xl font-black text-slate-800 dark:text-white mt-0.5 block">{totalBoxes}</span>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block truncate">ON PROGRESS</span>
          <span className="text-base sm:text-2xl font-black text-amber-700 dark:text-amber-400 mt-0.5 block">{pendingBoxes}</span>
        </div>

        <div className="p-2.5 sm:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block truncate">COMPLETED</span>
          <span className="text-base sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block">{completedBoxes}</span>
        </div>
      </div>

      {/* FILTER BAR & SEARCH */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs space-y-2.5 max-w-full">
        <div className="flex flex-col sm:flex-row gap-2 justify-between">

          {/* SEARCH INPUT */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Box Code, SPK, Store, or Project..."
              className="w-full pl-8 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-neutral-600 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* PROJECT SELECTOR */}
          {uniqueProjects.length > 0 && (
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full sm:w-auto px-4.5 py-2.5 sm:py-3 text-sm font-bold rounded-xl border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-w-[180px] sm:min-w-[220px]"
            >
              <option value="ALL">All Projects ({packingList.length})</option>
              {uniqueProjects.map((projName, idx) => (
                <option key={idx} value={projName}>{projName}</option>
              ))}
            </select>
          )}
        </div>

        {/* SEGMENTED STATUS & ROUTE TABS - SCROLLABLE ON HP WITHOUT OVERFLOWING PAGE */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-neutral-700 overflow-x-auto pb-1 max-w-full">

          {/* SOURCE FILTER (TEXT ONLY) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-700 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterSource('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                filterSource === 'ALL'
                  ? 'bg-white dark:bg-neutral-800 shadow-2xs font-bold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              Semua Data
            </button>
            <button
              onClick={() => setFilterSource('google_sheet')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                filterSource === 'google_sheet'
                  ? 'bg-white dark:bg-neutral-800 shadow-2xs font-bold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              Google Sheets
            </button>
            <button
              onClick={() => setFilterSource('label_sj')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                filterSource === 'label_sj'
                  ? 'bg-white dark:bg-neutral-800 shadow-2xs font-bold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              Label & SJ
            </button>
          </div>

          {/* STATUS FILTER */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-700 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                filterStatus === 'ALL'
                  ? 'bg-white dark:bg-neutral-800 shadow-2xs font-bold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('IN_PROGRESS')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                filterStatus === 'IN_PROGRESS'
                  ? 'bg-amber-500 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              ⏳ On Progress
            </button>
            <button
              onClick={() => setFilterStatus('COMPLETED')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                filterStatus === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              ✅ Done
            </button>
          </div>

          {/* ROUTE FILTER */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-700 p-1 rounded-xl shrink-0">
            {['ALL', 'DALAM KOTA', 'LUAR KOTA'].map((route) => (
              <button
                key={route}
                onClick={() => setFilterDelivery(route)}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap ${
                  filterDelivery === route
                    ? 'bg-white dark:bg-neutral-800 shadow-2xs font-bold text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-neutral-300 font-semibold'
                }`}
              >
                {route === 'ALL' ? 'All Routes' : route}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* DATA CONTENT AREA (TABLE TAMPIL RAPI DENGAN HORIZONTAL SCROLL KHUSUS TABEL) */}
      {filteredList.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-neutral-800 rounded-2xl border border-slate-200 dark:border-neutral-700 text-slate-500 font-semibold text-xs max-w-full">
          No matching packing box data found.
        </div>
      ) : (
        <div className="w-full max-w-full rounded-2xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 dark:bg-neutral-700/60 text-slate-700 dark:text-neutral-200 font-bold border-b border-slate-200 dark:border-neutral-700 uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 pl-4 pr-1 text-center w-8">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
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
                  <th className="py-3.5 pl-1 pr-4 font-semibold">
                    <button
                      type="button"
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="inline-flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer select-none"
                      title="Urutkan Ascending / Descending"
                    >
                      <span>BOX</span>
                      <span className="flex flex-col -space-y-1.5 text-slate-500 dark:text-neutral-400">
                        <ChevronUp className={`w-3 h-3 ${sortOrder === 'asc' ? 'text-emerald-600 dark:text-emerald-400 stroke-[3]' : 'opacity-40'}`} />
                        <ChevronDown className={`w-3 h-3 ${sortOrder === 'desc' ? 'text-emerald-600 dark:text-emerald-400 stroke-[3]' : 'opacity-40'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="py-3.5 px-4 font-semibold">STORE NAME / SPK</th>
                  <th className="py-3.5 px-4 font-semibold">SHIPPING TYPE</th>
                  <th className="py-3.5 px-4 text-center font-semibold">IMPORT DATE</th>
                  <th className="py-3.5 px-4 text-center font-semibold">LABEL & DESIGN</th>
                  <th className="py-3.5 px-4 text-center font-semibold">PHOTO PROOF</th>
                  <th className="py-3.5 px-4 text-center font-semibold">PACKING STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-neutral-700">
                {filteredList.map((item, idx) => {
                  const details = parseItems(item.items_detail);
                  const isPackingDone = item.status_qc_packing === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-');
                  const isUploadingThis = uploadingId === item.id;
                  const isSelected = selectedRowIds.includes(item.id);
                  const showProjectDivider = idx === 0 || (item.promo_title && item.promo_title !== filteredList[idx - 1]?.promo_title);

                  return (
                    <React.Fragment key={item.id}>
                      {showProjectDivider && (
                        <tr className="bg-amber-100/90 border-y-2 border-amber-300 dark:bg-amber-950/80 dark:border-amber-700">
                          <td colSpan="8" className="py-2 px-3 font-bold text-amber-950 dark:text-amber-200 text-[11px] tracking-wider uppercase shadow-2xs">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-black text-amber-950 dark:text-amber-200">{item.promo_title}</span>
                                <span className="text-amber-800/40 dark:text-amber-400/40">|</span>
                                <div className="flex items-center gap-1.5 flex-wrap normal-case">
                                  {(() => {
                                    const projItems = packingList.filter(p => p.promo_title === item.promo_title);
                                    const totalProj = projItems.length;
                                    const labelDone = projItems.filter(p => p.status_qc_label === 'DONE' || String(p.status_qc_label).includes('DONE')).length;
                                    const packingDone = projItems.filter(p => p.status_qc_packing === 'DONE' || (p.bukti_paking_url && p.bukti_paking_url !== 'No Foto')).length;
                                    const checkerDone = projItems.filter(p => p.status_qc_checker === 'DONE').length;
                                    return (
                                      <>
                                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px] border border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800">
                                          Label: {labelDone}/{totalProj}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px] border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800">
                                          Packing: {packingDone}/{totalProj}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
                                          Checker: {checkerDone}/{totalProj}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px] border border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800">
                                          Total Box: {totalProj}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/40'
                            : isPackingDone
                            ? 'bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-neutral-700/30'
                        }`}
                      >
                      {/* 1. SELECT CIRCLE */}
                      <td className="py-3.5 pl-4 pr-1 text-center w-8">
                        <button
                          onClick={() => handleToggleSelectRow(item.id)}
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer mx-auto ${
                            isSelected
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                              : 'border-slate-300 bg-white hover:border-emerald-500'
                          }`}
                          title={isSelected ? 'Deselect' : 'Select Row'}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                      </td>

                      {/* 2. BOX */}
                      <td className="py-3 pl-1 pr-4 font-mono text-slate-900 dark:text-white font-semibold text-sm whitespace-nowrap">
                        <span className="font-bold">{item.box_code || '-'}</span>
                      </td>

                      {/* 3. STORE NAME / SPK */}
                      <td className="py-3 px-4 max-w-[280px]">
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2 flex-wrap tracking-tight">
                          <span>{getCleanStoreName(item.store_name)}</span>
                        </div>
                        {item.no_spk && (
                          <div className="text-[11px] sm:text-xs font-mono text-slate-500 dark:text-neutral-400 font-bold mt-0.5">{item.no_spk}</div>
                        )}
                      </td>

                      {/* 4. SHIPPING TYPE */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-lg font-semibold text-[11px] uppercase tracking-wider text-center border ${
                          item.delivery_type === 'DALAM KOTA'
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-500 shadow-2xs dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700'
                            : 'bg-blue-500/15 text-blue-900 border-blue-400 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700'
                        }`}>
                          {item.delivery_type || 'DALAM KOTA'}
                        </span>
                      </td>

                      {/* 5. IMPORT DATE */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-mono text-[11px] text-slate-700 dark:text-neutral-300 font-semibold block">
                          {formatDateTime(item.created_at || item.updated_at)}
                        </span>
                      </td>

                      {/* 6. LABEL & DESIGN */}
                      <td className="py-3 px-4 text-center">
                        {item.source !== 'google_sheet' ? (
                          <span className="inline-block px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10px] font-bold">
                            Label SJ (Tab Label)
                          </span>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1 max-h-12 overflow-y-auto">
                              {details.map((sub, sIdx) => (
                                sub.image_url ? (
                                  <img
                                    key={sIdx}
                                    src={sub.image_url}
                                    alt="Design"
                                    onClick={() => onOpenImageModal && onOpenImageModal(sub.image_url, sub.code)}
                                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain bg-slate-50 dark:bg-neutral-900 rounded-xl border border-slate-300 dark:border-neutral-600 cursor-pointer shadow-sm hover:scale-105 transition-transform p-0.5"
                                  />
                                ) : null
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                              {details.filter(i => i.image_url).length} / {details.length} Designs
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 7. PHOTO PROOF */}
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
                              className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl border-2 border-slate-300 dark:border-neutral-600 cursor-pointer hover:scale-105 transition-transform shadow-sm"
                            />
                            <div className="text-[10px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight">
                              <span className="block truncate max-w-[110px]">{item.foto_by || item.scanned_by || 'Staff QC'}</span>
                              <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.foto_at || item.updated_at) || '-'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <label className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-2xs transition-all active:scale-95 inline-flex items-center gap-1 text-[10px] font-bold" title="Upload Photo">
                              <Camera className="w-3.5 h-3.5" />
                              <span>{isUploadingThis ? '...' : 'Photo'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                disabled={isUploadingThis}
                                onChange={(e) => handleCameraCapture(e, item.id, item.tracking_id || item.box_code)}
                                className="hidden"
                              />
                            </label>
                            <span className="text-slate-400 font-semibold text-[10px]">No Photo</span>
                          </div>
                        )}
                      </td>

                      {/* 8. PACKING STATUS */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <button
                            onClick={() => handleToggleStatus(item.id, 'status_qc_packing', item.status_qc_packing)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                              isPackingDone
                                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isPackingDone ? 'bg-blue-600' : 'bg-slate-400'}`} />
                            {isPackingDone ? 'Done' : 'Pending'}
                          </button>
                          {isPackingDone && (
                            <div className="text-[10px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight mt-0.5">
                              <span className="block truncate max-w-[110px]">{item.packing_by || item.scanned_by || 'Staff Packing'}</span>
                              <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.packing_at || item.updated_at) || '-'}</span>
                            </div>
                          )}
                        </div>
                      </td>

                    </tr>
                  </React.Fragment>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
