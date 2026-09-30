import React, { useState, useEffect } from 'react';
import {
  Search,
  Check,
  Clock,
  RefreshCw,
  Image as ImageIcon,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function CheckerView({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowIds, setSelectedRowIds] = useState([]);

  // Filter & Search States
  const [filterDelivery, setFilterDelivery] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL', 'PENDING', 'CHECKED'
  const [filterProject, setFilterProject] = useState('ALL');
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

  const fetchCheckerData = async () => {
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

        return {
          ...item,
          items_detail: details
        };
      });

      setPackingList(normalizedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCheckerData();

    const channel = supabase
      .channel('checker_view_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packing_tracking' },
        () => {
          fetchCheckerData();
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
        checker_by: 'Staff Checker',
        checker_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      alert('⚠️ Failed to update status: ' + error.message);
      fetchCheckerData();
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

  // SYARAT MUTLAK CHECKER: Hanya tampilkan jika PHOTO PROOF sudah ada & PACKING STATUS sudah DONE!
  const readyForCheckerList = packingList.filter(item => {
    const hasPhoto = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-';
    const isPackingDone = item.status_qc_packing === 'DONE' || hasPhoto;

    return hasPhoto && isPackingDone;
  });

  // Unique projects untuk filter dropdown
  const uniqueProjects = Array.from(
    new Set(
      readyForCheckerList
        .filter(item => item.promo_title && item.promo_title.trim() !== '')
        .map(item => `${item.promo_title || '-'}_${item.no_spk || '-'}`)
    )
  );

  const filteredList = readyForCheckerList.filter(item => {
    if (filterDelivery !== 'ALL' && item.delivery_type !== filterDelivery) return false;

    const isCheckerDone = item.status_qc_checker === 'DONE';
    if (filterStatus === 'PENDING' && isCheckerDone) return false;
    if (filterStatus === 'CHECKED' && !isCheckerDone) return false;

    if (filterProject !== 'ALL') {
      const projKey = `${item.promo_title || '-'}_${item.no_spk || '-'}`;
      if (projKey !== filterProject) return false;
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

  const totalReady = readyForCheckerList.length;
  const checkedBoxes = readyForCheckerList.filter(item => item.status_qc_checker === 'DONE').length;
  const pendingChecker = totalReady - checkedBoxes;

  return (
    <div className={`space-y-4 md:space-y-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>

      {/* HEADER RINGKAS & REFRESH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" /> Station Checker Staff
          </h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
            Verifikasi QC Checker untuk box yang telah selesai dipaking & difoto.
          </p>
        </div>

        <button
          onClick={fetchCheckerData}
          disabled={loading}
          className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading Data...' : 'Refresh Data'}
        </button>
      </div>

      {/* RINGKASAN STATUS BOX CHECKER */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs text-center">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block">READY FOR CHECKER</span>
          <span className="text-lg sm:text-2xl font-black text-slate-800 dark:text-white">{totalReady}</span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-2xs text-center">
          <span className="text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">ON PROGRESS</span>
          <span className="text-lg sm:text-2xl font-black text-amber-700 dark:text-amber-400">{pendingChecker}</span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs text-center">
          <span className="text-[10px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">CHECKED</span>
          <span className="text-lg sm:text-2xl font-black text-emerald-700 dark:text-emerald-400">{checkedBoxes}</span>
        </div>
      </div>

      {/* FILTER BAR & SEARCH */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 justify-between">

          {/* SEARCH INPUT */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Box Code, SPK, Store, or Project..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-neutral-600 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* PROJECT SELECTOR */}
          {uniqueProjects.length > 0 && (
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none"
            >
              <option value="ALL">All Projects ({readyForCheckerList.length})</option>
              {uniqueProjects.map((projKey, idx) => {
                const parts = projKey.split('_');
                const projName = parts[0] || '-';
                const spkNo = parts.slice(1).join('_') || '-';
                return (
                  <option key={idx} value={projKey}>
                    {projName} {spkNo !== '-' ? `(${spkNo})` : ''}
                  </option>
                );
              })}
            </select>
          )}
        </div>

        {/* SEGMENTED STATUS & ROUTE TABS */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-neutral-700">

          {/* STATUS FILTER */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-700 p-1 rounded-xl">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-white dark:bg-neutral-800 shadow-2xs font-bold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                filterStatus === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              ⏳ On Progress
            </button>
            <button
              onClick={() => setFilterStatus('CHECKED')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                filterStatus === 'CHECKED'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold'
              }`}
            >
              ✅ Checked
            </button>
          </div>

          {/* ROUTE FILTER */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-neutral-700 p-1 rounded-xl">
            {['ALL', 'DALAM KOTA', 'LUAR KOTA'].map((route) => (
              <button
                key={route}
                onClick={() => setFilterDelivery(route)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
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

      {/* DATA CONTENT AREA (SAMA PERSIS DENGAN TABEL DUA LAYAR HP & WEB) */}
      {filteredList.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-neutral-800 rounded-2xl border border-slate-200 dark:border-neutral-700 text-slate-500 font-semibold text-xs">
          Belum ada box paking yang siap diperiksa (menunggu foto & status paking selesai).
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-100 dark:bg-neutral-700/60 text-slate-700 dark:text-neutral-200 font-bold border-b border-slate-200 dark:border-neutral-700 uppercase text-[11px] tracking-wider">
                  <th className="py-4 pl-4 pr-1 text-center w-8">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                        selectedRowIds.length === filteredList.length && filteredList.length > 0
                          ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                          : 'border-slate-400 bg-white hover:border-amber-500'
                      }`}
                      title="Select All Rows"
                    >
                      {selectedRowIds.length === filteredList.length && filteredList.length > 0 && (
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      )}
                    </button>
                  </th>
                  <th className="py-4 pl-1 pr-4 font-semibold">BOX</th>
                  <th className="py-4 px-4 font-semibold">STORE NAME / SPK</th>
                  <th className="py-4 px-4 font-semibold">SHIPPING TYPE</th>
                  <th className="py-4 px-4 text-center font-semibold">IMPORT DATE</th>
                  <th className="py-4 px-4 text-center font-semibold">LABEL & DESIGN</th>
                  <th className="py-4 px-4 text-center font-semibold">PHOTO PROOF</th>
                  <th className="py-4 px-4 text-center font-semibold">PACKING STATUS</th>
                  <th className="py-4 px-4 text-center font-semibold">CHECKER STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-neutral-700">
                {filteredList.map((item) => {
                  const details = parseItems(item.items_detail);
                  const isPackingDone = item.status_qc_packing === 'DONE' || (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-');
                  const isCheckerDone = item.status_qc_checker === 'DONE';
                  const isSelected = selectedRowIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/40'
                          : isCheckerDone
                          ? 'bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/20'
                          : 'hover:bg-slate-50 dark:hover:bg-neutral-700/30'
                      }`}
                    >
                      {/* 1. SELECT CIRCLE */}
                      <td className="py-4 pl-4 pr-1 text-center w-8">
                        <button
                          onClick={() => handleToggleSelectRow(item.id)}
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer mx-auto ${
                            isSelected
                              ? 'bg-amber-500 border-amber-500 text-white shadow-2xs'
                              : 'border-slate-300 bg-white hover:border-amber-500'
                          }`}
                          title={isSelected ? 'Deselect' : 'Select Row'}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                      </td>

                      {/* 2. BOX */}
                      <td className="py-3.5 pl-1 pr-4 font-mono text-slate-900 dark:text-white font-semibold text-sm whitespace-nowrap">
                        <span className="font-bold">{item.box_code || '-'}</span>
                      </td>

                      {/* 3. STORE NAME / SPK */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2 flex-wrap tracking-tight">
                          <span>{getCleanStoreName(item.store_name)}</span>
                        </div>
                        {item.no_spk && (
                          <div className="text-xs font-mono text-slate-500 dark:text-neutral-400 font-bold mt-0.5">{item.no_spk}</div>
                        )}
                      </td>

                      {/* 4. SHIPPING TYPE */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-block whitespace-nowrap px-3.5 py-1.5 rounded-lg font-semibold text-xs uppercase tracking-wider text-center border ${
                          item.delivery_type === 'DALAM KOTA'
                            ? 'bg-emerald-100 text-emerald-950 border-emerald-500 shadow-2xs dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700'
                            : 'bg-blue-500/15 text-blue-900 border-blue-400 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700'
                        }`}>
                          {item.delivery_type || 'DALAM KOTA'}
                        </span>
                      </td>

                      {/* 5. IMPORT DATE */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="font-mono text-xs text-slate-700 dark:text-neutral-300 font-semibold block">
                          {formatDateTime(item.created_at || item.updated_at)}
                        </span>
                      </td>

                      {/* 6. LABEL & DESIGN */}
                      <td className="py-3.5 px-4 text-center">
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
                                    className="w-7 h-7 object-cover rounded border border-slate-300 dark:border-neutral-600 cursor-pointer shadow-2xs hover:scale-105 transition-transform"
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
                      <td className="py-3.5 px-4 text-center">
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
                              className="w-10 h-10 object-cover rounded-lg border-2 border-slate-300 dark:border-neutral-600 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                            />
                            <div className="text-[10px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight">
                              <span className="block truncate max-w-[110px]">{item.foto_by || item.scanned_by || 'Staff QC'}</span>
                              <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.foto_at || item.updated_at) || '-'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-semibold text-[10px]">No Photo</span>
                        )}
                      </td>

                      {/* 8. PACKING STATUS (DIPASANGKAN UNTUK USER CHECKER) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                              isPackingDone
                                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isPackingDone ? 'bg-blue-600' : 'bg-slate-400'}`} />
                            {isPackingDone ? 'Done' : 'Pending'}
                          </span>
                          {isPackingDone && (
                            <div className="text-[10px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight mt-0.5">
                              <span className="block truncate max-w-[110px]">{item.packing_by || item.scanned_by || 'Staff Packing'}</span>
                              <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.packing_at || item.updated_at) || '-'}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 9. CHECKER STATUS */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <button
                            onClick={() => handleToggleStatus(item.id, 'status_qc_checker', item.status_qc_checker)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                              isCheckerDone
                                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isCheckerDone ? 'bg-amber-600' : 'bg-slate-400'}`} />
                            {isCheckerDone ? 'Checked' : 'Pending'}
                          </button>
                          {isCheckerDone && (
                            <div className="text-[10px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight mt-0.5">
                              <span className="block truncate max-w-[110px]">{item.checker_by || item.scanned_by || 'Staff Checker'}</span>
                              <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.checker_at || item.updated_at) || '-'}</span>
                            </div>
                          )}
                        </div>
                      </td>

                    </tr>
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
