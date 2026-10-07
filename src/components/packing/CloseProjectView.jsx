import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  RefreshCw,
  FolderCheck,
  ChevronUp,
  ChevronDown,
  Calendar,
  Store,
  FileText,
  Truck
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function CloseProjectView({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('asc');

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
    if (!promoTitle) return '-';
    let str = String(promoTitle).trim();
    str = str.replace(/^NO\s*PO\s*[:\-]?\s*\d+\s*/i, '');
    str = str.replace(/^\d+\s+/, '');
    return str.trim();
  };

  const fetchClosedData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('*')
      .order('id', { ascending: false });

    if (!error && data) {
      // Filter hanya yang sudah memiliki bukti outbound atau status deliver DONE
      const closedData = data.filter(item => {
        const hasOutbound = (item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' && item.bukti_paking_url !== '-' && item.bukti_paking_url.length > 5) &&
                            ((item.bukti_outbound_url && item.bukti_outbound_url !== 'No Foto' && item.bukti_outbound_url !== '-' && item.bukti_outbound_url.length > 5) ||
                             item.outbound_url ||
                             item.status_deliver === 'DONE');
        return hasOutbound;
      });

      setPackingList(closedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClosedData();

    const channel = supabase
      .channel('close_project_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packing_tracking' },
        () => {
          fetchClosedData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const uniqueProjects = Array.from(
    new Set(
      packingList
        .filter(item => item.promo_title && item.promo_title.trim() !== '')
        .map(item => getProjectGroupKey(item.promo_title))
        .filter(str => str !== '-' && str !== '')
    )
  ).sort((a, b) => a.localeCompare(b));

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
      if (getProjectGroupKey(item.promo_title).toLowerCase() !== filterProject.trim().toLowerCase()) return false;
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

  return (
    <div className={`space-y-3.5 sm:space-y-6 w-full max-w-full overflow-hidden ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 p-3.5 sm:p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs max-w-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FolderCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
              Close Project (Arsip Selesai Outbound)
            </h2>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400 mt-0.5 leading-snug">
            Daftar project & box paking yang telah selesai proses packing hingga bukti outbound lengkap.
          </p>
        </div>

        <button
          onClick={fetchClosedData}
          disabled={loading}
          className="w-full sm:w-auto px-3.5 py-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh Arsip'}
        </button>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 max-w-full">
        <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block truncate">CLOSED PROJECTS</span>
          <span className="text-base sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5 block">{totalClosedProjects}</span>
        </div>

        <div className="p-3 sm:p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider block truncate">CLOSED BOXES</span>
          <span className="text-base sm:text-2xl font-black text-purple-700 dark:text-purple-400 mt-0.5 block">{totalClosedBoxes}</span>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 shadow-2xs flex flex-col sm:flex-row gap-2 justify-between max-w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Box Code, SPK, Store, or Project..."
            className="w-full pl-8 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-neutral-600 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {uniqueProjects.length > 0 && (
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer min-w-[180px] sm:min-w-[220px]"
          >
            <option value="ALL">All Closed Projects ({packingList.length})</option>
            {uniqueProjects.map((projName, idx) => (
              <option key={idx} value={projName}>{projName}</option>
            ))}
          </select>
        )}
      </div>

      {/* TABLE CONTENT */}
      {filteredList.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-neutral-800 rounded-2xl border border-slate-200 dark:border-neutral-700 text-slate-500 font-semibold text-xs max-w-full">
          Belum ada data project yang di-close (selesai outbound).
        </div>
      ) : (
        <div className="w-full max-w-full rounded-2xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 dark:bg-neutral-700/60 text-slate-700 dark:text-neutral-200 font-bold border-b border-slate-200 dark:border-neutral-700 uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 pl-4 pr-2 w-12 text-center">NO</th>
                  <th className="py-3.5 px-3">
                    <button
                      type="button"
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="inline-flex items-center gap-1.5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer select-none"
                    >
                      <span>BOX</span>
                      <span className="flex flex-col -space-y-1.5 text-slate-500 dark:text-neutral-400">
                        <ChevronUp className={`w-3 h-3 ${sortOrder === 'asc' ? 'text-purple-600 dark:text-purple-400 stroke-[3]' : 'opacity-40'}`} />
                        <ChevronDown className={`w-3 h-3 ${sortOrder === 'desc' ? 'text-purple-600 dark:text-purple-400 stroke-[3]' : 'opacity-40'}`} />
                      </span>
                    </button>
                  </th>
                  <th className="py-3.5 px-4">STORE NAME / SPK</th>
                  <th className="py-3.5 px-4">SHIPPING TYPE</th>
                  <th className="py-3.5 px-4 text-center">FOTO PAKING</th>
                  <th className="py-3.5 px-4 text-center">FOTO OUTBOUND</th>
                  <th className="py-3.5 px-4 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-neutral-700">
                {filteredList.map((item, idx) => {
                  const currentGroupKey = getProjectGroupKey(item.promo_title);
                  const prevGroupKey = idx > 0 ? getProjectGroupKey(filteredList[idx - 1]?.promo_title) : null;
                  const showProjectDivider = idx === 0 || currentGroupKey !== prevGroupKey;

                  const pakingImgUrl = item.bukti_paking_url && item.bukti_paking_url !== 'No Foto' ? item.bukti_paking_url : '';
                  const outboundImgUrl = item.outbound_url || item.bukti_outbound_url || '';

                  return (
                    <React.Fragment key={item.id}>
                      {showProjectDivider && (
                        <tr className="bg-purple-100/90 border-y-2 border-purple-300 dark:bg-purple-950/80 dark:border-purple-700">
                          <td colSpan="7" className="py-2 px-3 font-bold text-purple-950 dark:text-purple-200 text-[11px] tracking-wider uppercase shadow-2xs">
                            <div className="flex justify-between items-center gap-2">
                              <span className="font-black text-purple-950 dark:text-purple-200">{currentGroupKey}</span>
                              <span className="px-2 py-0.5 rounded bg-purple-200 text-purple-900 font-bold text-[10px] dark:bg-purple-900 dark:text-purple-200">
                                Selesai Closed
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50 dark:hover:bg-neutral-700/40 transition-colors">
                        <td className="py-3 pl-4 pr-2 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                          {item.box_code || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 dark:text-white">{item.store_name}</div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-neutral-400">{item.no_spk}</div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-neutral-300">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.delivery_type === 'DALAM KOTA'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {item.delivery_type || 'DALAM KOTA'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {pakingImgUrl ? (
                            <img
                              src={pakingImgUrl}
                              alt="Paking"
                              onClick={() => onOpenImageModal && onOpenImageModal(pakingImgUrl, `Bukti Paking - ${item.box_code}`, item.store_name, item.promo_title, item.no_spk)}
                              className="w-12 h-12 object-cover rounded-xl border border-emerald-500 cursor-pointer hover:scale-105 transition-transform shadow-2xs mx-auto"
                            />
                          ) : (
                            <span className="text-slate-400 text-[10px]">No Foto</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {outboundImgUrl ? (
                            <img
                              src={outboundImgUrl}
                              alt="Outbound"
                              onClick={() => onOpenImageModal && onOpenImageModal(outboundImgUrl, `Bukti Outbound - ${item.box_code}`, item.store_name, item.promo_title, item.no_spk)}
                              className="w-12 h-12 object-cover rounded-xl border border-purple-500 cursor-pointer hover:scale-105 transition-transform shadow-2xs mx-auto"
                            />
                          ) : (
                            <span className="text-slate-400 text-[10px]">No Foto</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> CLOSED
                          </span>
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
