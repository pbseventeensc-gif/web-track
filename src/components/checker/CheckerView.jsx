import React, { useState, useEffect } from 'react';
import {
  Search,
  Check,
  Clock,
  RefreshCw,
  ShieldCheck,
  Camera
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import CustomDropdown from '../ui/CustomDropdown';

export default function CheckerView({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1600;
          if (width > height && width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else if (height >= width && height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
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
    return file; // Gunakan file asli bawaan HP tanpa kompresi / resize
  };

  const handleCheckerCameraCapture = async (e, rowId, trackingId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(rowId);
    try {
      const uploadBlob = await processImageForUpload(file);
      const cleanTrackingId = trackingId ? String(trackingId).replace(/[^a-zA-Z0-9-_]/g, '_') : 'item';
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `bukti_checker_${cleanTrackingId}_${Date.now()}.${fileExt}`;

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
          bukti_checker_url: publicUrl,
          status_qc_checker: 'DONE',
          checker_by: 'Petugas Pemeriksa',
          checker_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', rowId);

      if (updateError) {
        await supabase
          .from('packing_tracking')
          .update({
            status_qc_checker: 'DONE',
            checker_by: 'Petugas Pemeriksa',
            checker_at: nowIso,
            updated_at: nowIso
          })
          .eq('id', rowId);
      }

      setPackingList(prev =>
        prev.map(item =>
          item.id === rowId
            ? { ...item, bukti_checker_url: publicUrl, status_qc_checker: 'DONE', checker_by: 'Petugas Pemeriksa', checker_at: nowIso }
            : item
        )
      );

      alert('Dokumentasi pemeriksaan mutu berhasil diunggah dan diverifikasi.');
    } catch (err) {
      alert('Gagal mengunggah foto pemeriksaan: ' + err.message);
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

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

        const firstSub = details[0] || {};

        const rawStore = (item.store_name || '').trim();
        const cleanStore = (rawStore && rawStore !== '-')
          ? rawStore
          : (item.recipient_name && item.recipient_name.trim() !== '-' ? item.recipient_name.trim() : (item.client_pt && item.client_pt.trim() !== '-' ? item.client_pt.trim() : '-'));

        const rawPromo = (item.promo_title || '').trim();
        const cleanPromo = (rawPromo && rawPromo !== '-')
          ? rawPromo
          : (firstSub.desc && firstSub.desc.trim() !== '-' ? firstSub.desc.trim() : (item.client_pt && item.client_pt.trim() !== '-' ? item.client_pt.trim() : '-'));

        const rawBox = (item.box_code || '').trim();
        const cleanBox = (rawBox && rawBox !== '-')
          ? rawBox
          : (firstSub.no_sj && firstSub.no_sj.trim() !== '-' ? firstSub.no_sj.trim() : (item.no_spk && item.no_spk.trim() !== '-' ? item.no_spk.trim() : '-'));

        return {
          ...item,
          store_name: cleanStore,
          promo_title: cleanPromo,
          box_code: cleanBox,
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
        checker_by: 'Petugas Pemeriksa',
        checker_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      alert('Gagal memperbarui status pemeriksaan: ' + error.message);
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

  // SYARAT MUTLAK CHECKER: Hanya tampilkan jika PHOTO PROOF sudah ada & PACKING STATUS sudah DONE
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
    <div className={`space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>

      {/* HEADER RINGKAS & PERBARUI */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-900/90 border border-slate-200/80 dark:border-neutral-800 shadow-2xs max-w-full">
        <div className="min-w-0 flex-1 flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white truncate">
              Stasiun Pemeriksaan Mutu (Checker)
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-neutral-400 mt-0.5 leading-snug">
              Verifikasi kendali mutu akhir untuk kolian yang telah selesai dikemas dan didokumentasikan.
            </p>
          </div>
        </div>

        <button
          onClick={fetchCheckerData}
          disabled={loading}
          className="w-full sm:w-auto px-4 py-2 bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 active:scale-95 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Memuat Data...' : 'Perbarui Data'}
        </button>
      </div>

      {/* RINGKASAN STATUS KOLIAN CHECKER */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 max-w-full">
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-50/80 dark:bg-neutral-900/80 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider block truncate">
            Siap Diperiksa
          </span>
          <span className="text-base sm:text-2xl font-black text-slate-800 dark:text-white mt-0.5 block">
            {totalReady}
          </span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block truncate">
            Dalam Proses
          </span>
          <span className="text-base sm:text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5 block">
            {pendingChecker}
          </span>
        </div>

        <div className="p-3 sm:p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs text-center min-w-0">
          <span className="text-[9px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block truncate">
            Terverifikasi
          </span>
          <span className="text-base sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5 block">
            {checkedBoxes}
          </span>
        </div>
      </div>

      {/* FILTER BAR & PENCARIAN */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-neutral-900/90 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3 max-w-full">
        <div className="flex flex-col sm:flex-row gap-2.5 justify-between">

          {/* INPUT PENCARIAN */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor SPK, kode kolian, cabang, atau proyek..."
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl border border-slate-200/80 dark:border-neutral-700 bg-slate-50/60 dark:bg-neutral-800/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-800"
            />
          </div>

          {/* PEMILIH PROYEK */}
          {uniqueProjects.length > 0 && (
            <CustomDropdown
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full sm:w-auto min-w-[200px]"
            >
              <option value="ALL">Proyek ({readyForCheckerList.length})</option>
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
            </CustomDropdown>
          )}
        </div>

        {/* FILTER STATUS & JALUR PENGIRIMAN */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-neutral-800 overflow-x-auto pb-1 max-w-full">

          {/* FILTER STATUS */}
          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-neutral-800 p-1 rounded-xl shrink-0 border border-slate-200/60 dark:border-neutral-700">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap cursor-pointer ${
                filterStatus === 'ALL'
                  ? 'bg-slate-200/80 text-slate-800 border border-slate-300/80 dark:bg-neutral-700 dark:text-slate-100 dark:border-neutral-600 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold hover:bg-white/60 dark:hover:bg-neutral-700/60'
              }`}
            >
              Status
            </button>
            <button
              onClick={() => setFilterStatus('PENDING')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap inline-flex items-center gap-1 cursor-pointer ${
                filterStatus === 'PENDING'
                  ? 'bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold hover:bg-white/60 dark:hover:bg-neutral-700/60'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Dalam Proses</span>
            </button>
            <button
              onClick={() => setFilterStatus('CHECKED')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap inline-flex items-center gap-1 cursor-pointer ${
                filterStatus === 'CHECKED'
                  ? 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-neutral-300 font-semibold hover:bg-white/60 dark:hover:bg-neutral-700/60'
              }`}
            >
              <Check className="w-3 h-3" />
              <span>Terverifikasi</span>
            </button>
          </div>

          {/* FILTER JALUR PENGIRIMAN */}
          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-neutral-800 p-1 rounded-xl shrink-0 border border-slate-200/60 dark:border-neutral-700">
            {['ALL', 'DALAM KOTA', 'LUAR KOTA'].map((route) => (
              <button
                key={route}
                onClick={() => setFilterDelivery(route)}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all whitespace-nowrap cursor-pointer ${
                  filterDelivery === route
                    ? 'bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 font-bold shadow-2xs'
                    : 'text-slate-600 dark:text-neutral-300 font-semibold hover:bg-white/60 dark:hover:bg-neutral-700/60'
                }`}
              >
                {route === 'ALL' ? 'Wilayah' : route}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* AREA TABEL DATA */}
      {filteredList.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-neutral-900/90 rounded-2xl border border-slate-200/80 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 font-semibold text-xs max-w-full">
          Belum ada data yang sesuai dengan kriteria pencarian.
        </div>
      ) : (
        <div className="w-full max-w-full rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/90 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-neutral-800/80 text-slate-700 dark:text-neutral-200 font-bold border-b border-slate-200/80 dark:border-neutral-700 uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 pl-4 pr-1 text-center w-8">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                        selectedRowIds.length === filteredList.length && filteredList.length > 0
                          ? 'bg-amber-50/90 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-300 shadow-2xs'
                          : 'border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-amber-400'
                      }`}
                      title="Pilih Semua Baris"
                    >
                      {selectedRowIds.length === filteredList.length && filteredList.length > 0 && (
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 pl-1 pr-4 font-semibold">Kode Kolian</th>
                  <th className="py-3.5 px-4 font-semibold">Nama Cabang / Nomor SPK</th>
                  <th className="py-3.5 px-4 font-semibold">Jalur Pengiriman</th>
                  <th className="py-3.5 px-4 text-center font-semibold">Tanggal Masuk</th>
                  <th className="py-3.5 px-4 text-center font-semibold">Label & Desain</th>
                  <th className="py-3.5 px-4 text-center font-semibold">Bukti Paking</th>
                  <th className="py-3.5 px-4 text-center font-semibold">Status Paking</th>
                  <th className="py-3.5 px-4 text-center font-semibold">Status Pemeriksa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-neutral-800">
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
                          ? 'bg-amber-50/50 hover:bg-amber-100/50 dark:bg-amber-950/30'
                          : isCheckerDone
                          ? 'bg-emerald-50/40 hover:bg-emerald-100/40 dark:bg-emerald-950/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      {/* 1. PILIH BARIS */}
                      <td className="py-3.5 pl-4 pr-1 text-center w-8">
                        <button
                          onClick={() => handleToggleSelectRow(item.id)}
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all cursor-pointer mx-auto ${
                            isSelected
                              ? 'bg-amber-50/90 border-amber-300 text-amber-800 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-300 shadow-2xs'
                              : 'border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:border-amber-400'
                          }`}
                          title={isSelected ? 'Batalkan Pilihan' : 'Pilih Baris'}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                      </td>

                      {/* 2. KODE KOLIAN */}
                      <td className="py-3 pl-1 pr-4 font-mono text-slate-900 dark:text-white font-semibold text-sm whitespace-nowrap">
                        <span className="font-bold">{item.box_code || '-'}</span>
                      </td>

                      {/* 3. NAMA CABANG / SPK */}
                      <td className="py-3 px-4 max-w-[280px]">
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2 flex-wrap tracking-tight">
                          <span>{getCleanStoreName(item.store_name)}</span>
                        </div>
                        {item.no_spk && (
                          <div className="text-[11px] sm:text-xs font-mono text-slate-500 dark:text-neutral-400 font-bold mt-0.5">{item.no_spk}</div>
                        )}
                      </td>

                      {/* 4. JALUR PENGIRIMAN */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block whitespace-nowrap px-3 py-1 rounded-lg font-semibold text-[11px] uppercase tracking-wider text-center border ${
                          item.delivery_type === 'DALAM KOTA'
                            ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                            : 'bg-blue-50/90 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
                        }`}>
                          {item.delivery_type || 'DALAM KOTA'}
                        </span>
                      </td>

                      {/* 5. TANGGAL MASUK */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="font-mono text-[11px] text-slate-700 dark:text-neutral-300 font-semibold block">
                          {formatDateTime(item.created_at || item.updated_at)}
                        </span>
                      </td>

                      {/* 6. LABEL & DESAIN */}
                      <td className="py-3 px-4 text-center">
                        {item.source !== 'google_sheet' ? (
                          <span className="inline-block px-2.5 py-1 bg-purple-50/90 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 rounded-lg text-[10px] font-bold">
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
                                    className="w-7 h-7 object-cover rounded border border-slate-200/80 dark:border-neutral-700 cursor-pointer shadow-2xs hover:scale-105 transition-transform"
                                  />
                                ) : null
                              ))}
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium">
                              {details.filter(i => i.image_url).length} / {details.length} Desain
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 7. BUKTI PAKING */}
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
                              className="w-9 h-9 object-cover rounded-lg border border-slate-200/80 dark:border-neutral-700 cursor-pointer hover:scale-110 transition-transform shadow-2xs"
                            />
                            <div className="text-[10px] font-semibold text-slate-700 dark:text-neutral-300 leading-tight">
                              <span className="block truncate max-w-[110px]">{item.foto_by || item.scanned_by || 'Petugas QC'}</span>
                              <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.foto_at || item.updated_at) || '-'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-500 font-semibold text-[10px]">Belum Ada Foto</span>
                        )}
                      </td>

                      {/* 8. STATUS PAKING */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                              isPackingDone
                                ? 'bg-blue-50/90 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60'
                                : 'bg-slate-100/80 text-slate-700 border-slate-200/80 dark:bg-neutral-800 dark:text-slate-200 dark:border-neutral-700'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isPackingDone ? 'bg-blue-400' : 'bg-slate-400'}`} />
                            {isPackingDone ? 'Selesai' : 'Menunggu'}
                          </span>
                          {isPackingDone && (
                            <div className="text-[10px] font-semibold text-slate-700 dark:text-neutral-300 leading-tight mt-0.5">
                              <span className="block truncate max-w-[110px]">{item.packing_by || item.scanned_by || 'Petugas Paking'}</span>
                              <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.packing_at || item.updated_at) || '-'}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 9. STATUS PEMERIKSA */}
                      <td className="py-3 px-4 text-center">
                        {(() => {
                          const checkerImgUrl = item.bukti_checker_url && item.bukti_checker_url !== 'No Foto' && item.bukti_checker_url !== '-' ? item.bukti_checker_url : '';
                          const isUploadingThis = uploadingId === item.id;

                          return (
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {checkerImgUrl ? (
                                <img
                                  src={checkerImgUrl}
                                  alt="Bukti Pemeriksaan"
                                  onClick={() => onOpenImageModal && onOpenImageModal(
                                    checkerImgUrl,
                                    `Bukti Pemeriksaan - ${item.tracking_id || item.box_code || ''}`,
                                    item.destination || item.store_name || item.branch_name || '',
                                    item.promo_title || item.project || '',
                                    item.no_spk || item.tracking_id || ''
                                  )}
                                  className="w-9 h-9 object-cover rounded-lg border border-amber-200/80 dark:border-amber-800/60 cursor-pointer hover:scale-110 transition-transform shadow-2xs mx-auto"
                                />
                              ) : null}

                              <label className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border active:scale-95 ${
                                isCheckerDone
                                  ? 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60'
                                  : 'bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60'
                              }`}>
                                <Camera className="w-3.5 h-3.5" />
                                <span>{isUploadingThis ? 'Mengunggah...' : (isCheckerDone ? 'Terverifikasi' : 'Unggah Foto & Periksa')}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={(e) => handleCheckerCameraCapture(e, item.id, item.tracking_id || item.box_code)}
                                />
                              </label>

                              {isCheckerDone && (
                                <div className="text-[10px] font-semibold text-slate-700 dark:text-neutral-300 leading-tight mt-0.5">
                                  <span className="block truncate max-w-[110px]">{item.checker_by || 'Petugas Pemeriksa'}</span>
                                  <span className="text-[9px] font-mono text-slate-500 dark:text-neutral-400 font-normal block">{formatDateTime(item.checker_at || item.updated_at) || '-'}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
