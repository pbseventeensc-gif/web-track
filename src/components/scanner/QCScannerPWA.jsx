import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User,
  Clock,
  ShieldCheck,
  Package,
  RefreshCw,
  ArrowLeft,
  Download,
  Image as ImageIcon,
  Keyboard,
  Sparkles,
  Upload
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { findPackingItemByQr } from '../../utils/qrMatcher';
import { uploadPhotoWithFallback, getPhotoThumbUrl, getPhotoFullUrl } from '../../utils/driveUpload';
import {
  hasValidPhoto,
  isPackingDone,
  isCheckerDone,
  getPackingMeta,
  getCheckerMeta,
  updatePackingWithMeta
} from '../../utils/packingMeta';

const STAFF_NAME_KEY = 'wellen_qc_staff_name';
const SCAN_MODE_KEY = 'wellen_qc_scan_mode';

function playScanBeep(isSuccess = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isSuccess ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isSuccess ? 880 : 320, ctx.currentTime);
    if (isSuccess) {
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    }
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
  } catch {
    // Ignore audio failures on restricted browsers
  }

  try {
    if (navigator.vibrate) {
      navigator.vibrate(isSuccess ? 80 : [60, 40, 60]);
    }
  } catch {
    // Ignore vibrate errors
  }
}

function formatClockTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${hh}:${mm} • ${dd}/${mo}`;
  } catch {
    return '-';
  }
}

export default function QCScannerPWA({
  isStandalone = false,
  isDarkMode = false,
  currentAdmin = null,
  onBack = null,
  onOpenImageModal = null
}) {
  const isLockedPacking = currentAdmin?.role === 'packing_role';
  const isLockedChecker = currentAdmin?.role === 'checker_role';
  const isModeLocked = isLockedPacking || isLockedChecker;

  const [scanMode, setScanMode] = useState(() => {
    if (isLockedPacking) return 'packing';
    if (isLockedChecker) return 'checker';
    try {
      const saved = localStorage.getItem(SCAN_MODE_KEY);
      if (saved === 'packing' || saved === 'checker') return saved;
    } catch {}
    return 'packing';
  });

  useEffect(() => {
    if (isLockedPacking) setScanMode('packing');
    else if (isLockedChecker) setScanMode('checker');
  }, [isLockedPacking, isLockedChecker]);

  const [staffName, setStaffName] = useState(() => {
    try {
      return localStorage.getItem(STAFF_NAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [isEditingName, setIsEditingName] = useState(() => {
    try {
      return !(localStorage.getItem(STAFF_NAME_KEY) || '').trim();
    } catch {
      return true;
    }
  });
  const [nameDraft, setNameDraft] = useState(staffName);

  const [autoVerifyChecker, setAutoVerifyChecker] = useState(true);
  const [manualInput, setManualInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Status alur scan saat ini: 'idle' | 'searching' | 'matched' | 'uploading' | 'success' | 'not_found' | 'warning_no_photo'
  const [scanState, setScanState] = useState('idle');
  const [matchedItem, setMatchedItem] = useState(null);
  const [matchType, setMatchType] = useState('');
  const [lastScannedRaw, setLastScannedRaw] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [scanHistory, setScanHistory] = useState([]);

  // PWA Install Prompt
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isInstalledPwa, setIsInstalledPwa] = useState(false);

  const html5QrRef = useRef(null);
  const isCameraStartingRef = useRef(false);
  const isHandlingCodeRef = useRef(false);
  const autoNextTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const scanModeRef = useRef(scanMode);
  const staffNameRef = useRef(staffName);
  const autoVerifyRef = useRef(autoVerifyChecker);

  useEffect(() => {
    scanModeRef.current = scanMode;
    try {
      if (!isModeLocked) localStorage.setItem(SCAN_MODE_KEY, scanMode);
    } catch {}
  }, [scanMode, isModeLocked]);

  useEffect(() => {
    staffNameRef.current = staffName;
  }, [staffName]);

  useEffect(() => {
    autoVerifyRef.current = autoVerifyChecker;
  }, [autoVerifyChecker]);

  useEffect(() => {
    isMountedRef.current = true;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalledPwa(true);
    }
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    const handleAppInstalled = () => {
      setIsInstalledPwa(true);
      setInstallPromptEvent(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    };
  }, []);

  const stopCamera = useCallback(async () => {
    const qr = html5QrRef.current;
    html5QrRef.current = null;
    if (qr) {
      try {
        if (qr.isScanning) {
          await qr.stop();
        }
      } catch {}
      try {
        qr.clear();
      } catch {}
    }
    if (isMountedRef.current) {
      setIsCameraActive(false);
    }
  }, []);

  const handleSaveStaffName = (e) => {
    if (e) e.preventDefault();
    const cleaned = nameDraft.trim();
    if (!cleaned) return;
    setStaffName(cleaned);
    try {
      localStorage.setItem(STAFF_NAME_KEY, cleaned);
    } catch {}
    setIsEditingName(false);
  };

  const addHistoryEntry = useCallback((entry) => {
    setScanHistory((prev) => [entry, ...prev].slice(0, 20));
  }, []);

  const executeCheckerVerify = useCallback(async (item, activeStaffName) => {
    const cleanOp = String(activeStaffName || '').trim();
    if (!cleanOp) {
      setIsEditingName(true);
      setStatusMessage('Isi nama petugas terlebih dahulu sebelum verifikasi.');
      return;
    }

    const nowIso = new Date().toISOString();
    setScanState('uploading');
    setStatusMessage('Menyimpan verifikasi QC Checker...');

    const { error } = await supabase
      .from('packing_tracking')
      .update({
        status_qc_checker: 'DONE',
        checker_by: cleanOp,
        checker_at: nowIso,
        updated_at: nowIso
      })
      .eq('id', item.id);

    if (!isMountedRef.current) return;

    if (error) {
      playScanBeep(false);
      setScanState('not_found');
      setStatusMessage(`Gagal menyimpan verifikasi Checker: ${error.message}`);
      return;
    }

    const updated = {
      ...item,
      status_qc_checker: 'DONE',
      checker_by: cleanOp,
      checker_at: nowIso,
      updated_at: nowIso
    };
    setMatchedItem(updated);
    setScanState('success');
    setStatusMessage(`Terverifikasi QC Checker oleh ${cleanOp} pada ${formatClockTime(nowIso)}.`);
    playScanBeep(true);

    addHistoryEntry({
      id: `${item.id}-${Date.now()}`,
      mode: 'checker',
      boxCode: item.box_code || '-',
      storeName: item.store_name || '-',
      noSpk: item.no_spk || '-',
      staff: cleanOp,
      time: formatClockTime(nowIso),
      storage: 'db'
    });

    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    autoNextTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      isHandlingCodeRef.current = false;
    }, 1500);
  }, [addHistoryEntry]);

  const processQrText = useCallback(async (rawText) => {
    if (!rawText || isHandlingCodeRef.current) return;

    const activeName = staffNameRef.current.trim();
    if (!activeName) {
      setIsEditingName(true);
      setStatusMessage('Masukkan Nama Petugas dulu sebelum melakukan scan.');
      return;
    }

    isHandlingCodeRef.current = true;
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);

    // Pause/hentikan kamera agar tidak scan berulang saat memproses
    await stopCamera();

    setScanState('searching');
    setLastScannedRaw(rawText);
    setLocalPreviewUrl('');
    setStatusMessage('Mencari data kolian di database...');

    try {
      const { item, cleanCode, matchType: foundType } = await findPackingItemByQr(supabase, rawText);
      if (!isMountedRef.current) return;

      if (!item) {
        playScanBeep(false);
        setMatchedItem(null);
        setMatchType('');
        setScanState('not_found');
        setStatusMessage(`QR "${cleanCode || rawText}" tidak ditemukan di data Packing Station.`);
        isHandlingCodeRef.current = false;
        return;
      }

      setMatchedItem(item);
      setMatchType(foundType || '');
      playScanBeep(true);

      if (scanModeRef.current === 'packing') {
        setScanState('matched');
        setStatusMessage('Kolian ditemukan! Silakan ambil foto bukti paking (resolusi asli HP).');
        isHandlingCodeRef.current = false;
      } else {
        // Mode QC CHECKER: cukup scan QR
        const photoExists = hasValidPhoto(item);
        if (!photoExists) {
          setScanState('warning_no_photo');
          setStatusMessage('Perhatian: Kolian ini belum memiliki foto bukti QC Paking!');
          isHandlingCodeRef.current = false;
        } else if (autoVerifyRef.current) {
          await executeCheckerVerify(item, activeName);
        } else {
          setScanState('matched');
          setStatusMessage('Kolian & foto bukti ditemukan. Tekan tombol untuk verifikasi Checker.');
          isHandlingCodeRef.current = false;
        }
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      playScanBeep(false);
      setScanState('not_found');
      setStatusMessage(`Gagal memeriksa QR: ${err.message}`);
      isHandlingCodeRef.current = false;
    }
  }, [executeCheckerVerify, stopCamera]);

  const startCamera = useCallback(async () => {
    if (isCameraStartingRef.current || html5QrRef.current) return;
    if (!staffNameRef.current.trim()) {
      setIsEditingName(true);
      setCameraError('Silakan isi Nama Petugas terlebih dahulu di bagian atas.');
      return;
    }

    isCameraStartingRef.current = true;
    setCameraError('');
    isHandlingCodeRef.current = false;

    try {
      const qr = new Html5Qrcode('wellen-qr-reader');
      html5QrRef.current = qr;
      await qr.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        (decodedText) => {
          processQrText(decodedText);
        },
        () => {}
      );
      if (isMountedRef.current) {
        setIsCameraActive(true);
      } else {
        await qr.stop().catch(() => {});
      }
    } catch (err) {
      html5QrRef.current = null;
      if (isMountedRef.current) {
        setIsCameraActive(false);
        setCameraError(
          err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Izinkan akses kamera di browser HP atau gunakan kolom input QR manual di bawah.'
            : 'Kamera tidak dapat dibuka di perangkat ini. Gunakan tombol Aktifkan Kamera atau input manual di bawah.'
        );
      }
    } finally {
      isCameraStartingRef.current = false;
    }
  }, [processQrText]);

  useEffect(() => {
    return () => {
      const qr = html5QrRef.current;
      html5QrRef.current = null;
      if (qr) {
        qr.stop().catch(() => {}).finally(() => {
          try { qr.clear(); } catch {}
        });
      }
    };
  }, []);

  const handleResetAndScanNext = async () => {
    if (autoNextTimerRef.current) clearTimeout(autoNextTimerRef.current);
    isHandlingCodeRef.current = false;
    setScanState('idle');
    setMatchedItem(null);
    setLocalPreviewUrl('');
    setStatusMessage('');
    await startCamera();
  };

  const handlePackingPhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !matchedItem) return;
    e.target.value = '';

    const activeName = staffName.trim();
    if (!activeName) {
      setIsEditingName(true);
      return;
    }

    const previewObjectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(previewObjectUrl);
    setScanState('uploading');
    setStatusMessage('Mengunggah foto resolusi asli HP ke Google Drive (Pbseventeen@gmail.com)...');

    try {
      const cleanPrefix = `bukti_paking_${matchedItem.tracking_id || matchedItem.box_code || matchedItem.id}`;
      const uploadRes = await uploadPhotoWithFallback(file, cleanPrefix, supabase);
      if (!isMountedRef.current) return;

      const nowIso = new Date().toISOString();
      const { error: dbErr } = await updatePackingWithMeta(supabase, matchedItem.id, {
        buktiPakingUrl: uploadRes.url,
        staffName: activeName,
        status: 'DONE',
        nowIso
      });

      if (dbErr) throw dbErr;
      if (!isMountedRef.current) return;

      const updated = {
        ...matchedItem,
        bukti_paking_url: uploadRes.url,
        status_qc_packing: 'DONE',
        staff_outbound: JSON.stringify({ packing_by: activeName, packing_at: nowIso }),
        updated_at: nowIso
      };
      setMatchedItem(updated);
      setScanState('success');
      setStatusMessage(
        uploadRes.storage === 'google_drive'
          ? `Foto tersimpan ke Google Drive & Status Paking SELESAI (${activeName} • ${formatClockTime(nowIso)}).`
          : `Foto tersimpan (Storage Fallback) & Status Paking SELESAI (${activeName} • ${formatClockTime(nowIso)}).`
      );
      playScanBeep(true);

      addHistoryEntry({
        id: `${matchedItem.id}-${Date.now()}`,
        mode: 'packing',
        boxCode: matchedItem.box_code || '-',
        storeName: matchedItem.store_name || '-',
        noSpk: matchedItem.no_spk || '-',
        staff: activeName,
        time: formatClockTime(nowIso),
        storage: uploadRes.storage,
        photoUrl: uploadRes.url
      });
    } catch (err) {
      if (!isMountedRef.current) return;
      playScanBeep(false);
      setScanState('matched');
      setStatusMessage(`Gagal mengunggah foto bukti: ${err.message}`);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const val = manualInput.trim();
    if (!val) return;
    setManualInput('');
    processQrText(val);
  };

  const handleInstallPwa = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    try {
      const choice = await installPromptEvent.userChoice;
      if (choice?.outcome === 'accepted') {
        setIsInstalledPwa(true);
      }
    } catch {}
    setInstallPromptEvent(null);
  };

  const handleModeSwitch = async (nextMode) => {
    if (isModeLocked || nextMode === scanMode) return;
    await stopCamera();
    isHandlingCodeRef.current = false;
    setScanState('idle');
    setMatchedItem(null);
    setLocalPreviewUrl('');
    setStatusMessage('');
    setScanMode(nextMode);
  };

  const packerMeta = matchedItem ? getPackingMeta(matchedItem) : { name: null, timestamp: null };
  const checkerMeta = matchedItem ? getCheckerMeta(matchedItem) : { name: null, timestamp: null };

  return (
    <div className={`min-h-screen w-full flex flex-col ${
      isDarkMode ? 'bg-[#090D16] text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* TOP APP BAR */}
      <header className="sticky top-0 z-30 bg-[#1E3A8A] text-white shadow-md px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack ? (
              <button
                type="button"
                onClick={async () => {
                  await stopCamera();
                  onBack();
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer shrink-0"
                title="Kembali ke Tabel"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : isStandalone ? (
              <a
                href="/"
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                title="Buka Web Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </a>
            ) : null}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-300 shrink-0" />
                <h1 className="font-extrabold text-sm sm:text-base tracking-tight truncate">
                  Wellen QC Scanner
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-blue-100/90 truncate">
                {scanMode === 'packing'
                  ? 'Alur: 1. Scan QR → 2. Foto Asli HP (Google Drive)'
                  : 'Alur: Scan QR Saja → Rekam Nama & Waktu Checker'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {installPromptEvent && !isInstalledPwa && (
              <button
                type="button"
                onClick={handleInstallPwa}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto p-3.5 sm:p-5 space-y-4 pb-16">
        {/* 1. IDENTITAS PETUGAS */}
        <section className={`rounded-2xl border p-3.5 shadow-2xs ${
          isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
        }`}>
          {isEditingName ? (
            <form onSubmit={handleSaveStaffName} className="space-y-2">
              <label className="text-xs font-bold flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                <User className="w-3.5 h-3.5" />
                Nama Petugas QC (Wajib untuk catatan waktu & riwayat)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Contoh: Budi / Agus / Siti..."
                  autoFocus
                  required
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 font-extrabold text-sm">
                  {staffName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Petugas Aktif
                  </span>
                  <span className="text-sm font-extrabold truncate block">{staffName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(staffName);
                  setIsEditingName(true);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"
              >
                Ganti Nama
              </button>
            </div>
          )}
        </section>

        {/* 2. PEMILIH MODE: QC PAKING vs QC CHECKER */}
        <section className={`grid grid-cols-2 gap-2 p-1.5 rounded-2xl border ${
          isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-200/70 border-slate-200'
        }`}>
          <button
            type="button"
            disabled={isModeLocked && scanMode !== 'packing'}
            onClick={() => handleModeSwitch('packing')}
            className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'packing'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-neutral-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>QC PAKING</span>
          </button>

          <button
            type="button"
            disabled={isModeLocked && scanMode !== 'checker'}
            onClick={() => handleModeSwitch('checker')}
            className={`py-3 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'checker'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-neutral-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>QC CHECKER</span>
          </button>
        </section>

        {scanMode === 'checker' && (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs ${
            isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
          }`}>
            <div className="flex items-center gap-2 font-semibold">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Auto-Verifikasi saat QR terbaca (jika sudah ada foto)</span>
            </div>
            <input
              type="checkbox"
              checked={autoVerifyChecker}
              onChange={(e) => setAutoVerifyChecker(e.target.checked)}
              className="w-4 h-4 accent-amber-600 cursor-pointer"
            />
          </div>
        )}

        {/* 3. VIEWFINDER KAMERA QR SCANNER */}
        {scanState === 'idle' && (
          <section className={`rounded-3xl border overflow-hidden shadow-sm ${
            isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
          }`}>
            <div className="relative bg-slate-950 w-full min-h-[270px] flex flex-col items-center justify-center">
              <div id="wellen-qr-reader" className="w-full" />

              {!isCameraActive && (
                <div className="p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center justify-center mx-auto">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                    {scanMode === 'packing'
                      ? 'Tekan tombol di bawah untuk memindai QR Code pada label kolian sebelum mengambil foto bukti paking.'
                      : 'Tekan tombol di bawah untuk memindai QR Code kolian dan mencatat verifikasi Checker secara otomatis.'}
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className={`px-6 py-3 rounded-2xl font-extrabold text-sm text-white shadow-md flex items-center gap-2 mx-auto cursor-pointer active:scale-95 transition-all ${
                      scanMode === 'packing' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Aktifkan Kamera QR</span>
                  </button>
                </div>
              )}

              {isCameraActive && (
                <div className="p-2.5 bg-slate-900/90 w-full flex items-center justify-between px-4">
                  <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Kamera Aktif — Arahkan ke QR Label
                  </span>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Hentikan
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                {cameraError}
              </div>
            )}

            {/* Input Manual / Scanner USB Fallback */}
            <form onSubmit={handleManualSubmit} className="p-3 border-t border-slate-200 dark:border-neutral-800 flex gap-2">
              <div className="relative flex-1">
                <Keyboard className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Atau ketik / tempel kode QR / tracking ID..."
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-neutral-700 text-white text-xs font-bold cursor-pointer"
              >
                Cari QR
              </button>
            </form>
          </section>
        )}

        {/* 4. HASIL PENCARIAN & AKSI SESUAI STEP */}
        {scanState === 'searching' && (
          <div className={`rounded-3xl border p-8 text-center space-y-3 ${
            isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
          }`}>
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <p className="text-sm font-bold">{statusMessage}</p>
            <p className="text-xs font-mono text-slate-400 break-all">{lastScannedRaw}</p>
          </div>
        )}

        {scanState === 'not_found' && (
          <div className="rounded-3xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <h2 className="font-extrabold text-sm text-rose-800 dark:text-rose-200">
                  Data Kolian Tidak Ditemukan
                </h2>
                <p className="text-xs text-rose-700 dark:text-rose-300">{statusMessage}</p>
                <p className="text-[11px] font-mono text-rose-600/80 break-all">QR: {lastScannedRaw}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetAndScanNext}
              className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer"
            >
              Scan Ulang QR
            </button>
          </div>
        )}

        {matchedItem && scanState !== 'not_found' && scanState !== 'searching' && (
          <section className={`rounded-3xl border shadow-sm overflow-hidden ${
            isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
          }`}>
            {/* Banner Status */}
            <div className={`px-4 py-3 flex items-center justify-between gap-2 border-b ${
              scanState === 'success'
                ? 'bg-emerald-600 text-white border-emerald-700'
                : scanState === 'warning_no_photo'
                ? 'bg-amber-500 text-white border-amber-600'
                : scanState === 'uploading'
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE] dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-center gap-2 font-extrabold text-xs sm:text-sm">
                {scanState === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : scanState === 'warning_no_photo' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : scanState === 'uploading' ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Package className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {scanState === 'success'
                    ? 'BERHASIL TERSIMPAN'
                    : scanState === 'warning_no_photo'
                    ? 'BELUM ADA FOTO BUKTI PAKING'
                    : scanState === 'uploading'
                    ? 'MEMPROSES...'
                    : 'KOLIAN TERIDENTIFIKASI'}
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-black/15">
                {matchedItem.box_code || '-'}
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Info Kolian */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Customer / Cabang
                    </span>
                    <h3 className="font-extrabold text-base leading-snug">
                      {matchedItem.store_name || '-'}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300 shrink-0">
                    {matchedItem.delivery_type || 'DALAM KOTA'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-neutral-800/70 border-neutral-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[10px] text-slate-400 font-bold block">Proyek</span>
                    <span className="font-bold line-clamp-2">{matchedItem.promo_title || '-'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-neutral-800/70 border-neutral-700' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[10px] text-slate-400 font-bold block">No. SPK / Tracking</span>
                    <span className="font-mono font-bold block truncate">{matchedItem.no_spk || '-'}</span>
                    <span className="font-mono text-[10px] text-slate-400 block truncate">{matchedItem.tracking_id}</span>
                  </div>
                </div>
              </div>

              {/* Status Paking & Checker Saat Ini */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2.5 rounded-xl border ${
                  isPackingDone(matchedItem)
                    ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                    : 'bg-slate-50 border-slate-200 dark:bg-neutral-800/50 dark:border-neutral-700'
                }`}>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Status Paking</span>
                  <span className="font-extrabold block mt-0.5">
                    {isPackingDone(matchedItem) ? 'SELESAI' : 'MENUNGGU'}
                  </span>
                  {packerMeta.name && (
                    <span className="text-[10px] text-slate-500 block truncate">
                      {packerMeta.name} • {formatClockTime(packerMeta.timestamp)}
                    </span>
                  )}
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  isCheckerDone(matchedItem)
                    ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                    : 'bg-slate-50 border-slate-200 dark:bg-neutral-800/50 dark:border-neutral-700'
                }`}>
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">Status Checker</span>
                  <span className="font-extrabold block mt-0.5">
                    {isCheckerDone(matchedItem) ? 'TERVERIFIKASI' : 'MENUNGGU'}
                  </span>
                  {checkerMeta.name && (
                    <span className="text-[10px] text-slate-500 block truncate">
                      {checkerMeta.name} • {formatClockTime(checkerMeta.timestamp)}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Foto Bukti */}
              {(localPreviewUrl || hasValidPhoto(matchedItem)) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    Thumbnail Foto Bukti (Resolusi Asli HP)
                  </span>
                  <img
                    src={localPreviewUrl || getPhotoThumbUrl(matchedItem.bukti_paking_url, 480)}
                    referrerPolicy="no-referrer"
                    alt="Foto Bukti Paking"
                    onClick={() => {
                      const fullUrl = localPreviewUrl || getPhotoFullUrl(matchedItem.bukti_paking_url);
                      if (onOpenImageModal) {
                        onOpenImageModal(
                          fullUrl,
                          `Bukti Paking - ${matchedItem.box_code || ''}`,
                          matchedItem.store_name || '',
                          matchedItem.promo_title || '',
                          matchedItem.no_spk || ''
                        );
                      } else {
                        window.open(fullUrl, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="w-full max-h-56 object-contain rounded-2xl border border-slate-200 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-950 cursor-pointer"
                  />
                </div>
              )}

              {statusMessage && (
                <p className={`text-xs font-semibold p-3 rounded-xl border ${
                  scanState === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800'
                    : scanState === 'warning_no_photo'
                    ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800'
                    : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-800'
                }`}>
                  {statusMessage}
                </p>
              )}

              {/* TOMBOL AKSI: QC PAKING */}
              {scanMode === 'packing' && scanState !== 'uploading' && (
                <div className="space-y-2.5 pt-1">
                  <label className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.99] transition-all">
                    <Camera className="w-5 h-5" />
                    <span>
                      {scanState === 'success' || hasValidPhoto(matchedItem)
                        ? 'Ambil Ulang Foto Bukti Paking'
                        : 'Ambil Foto Bukti Paking (Kamera HP)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePackingPhotoCapture}
                      className="hidden"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-neutral-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Pilih Galeri</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePackingPhotoCapture}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleResetAndScanNext}
                      className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{scanState === 'success' ? 'Scan Kolian Berikutnya' : 'Scan Ulang'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TOMBOL AKSI: QC CHECKER */}
              {scanMode === 'checker' && scanState !== 'uploading' && (
                <div className="space-y-2 pt-1">
                  {(scanState === 'warning_no_photo' || scanState === 'matched') && (
                    <button
                      type="button"
                      onClick={() => executeCheckerVerify(matchedItem, staffName)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      <span>
                        {scanState === 'warning_no_photo'
                          ? 'Tetap Verifikasi Checker'
                          : 'Verifikasi QC Checker Sekarang'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleResetAndScanNext}
                    className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{scanState === 'warning_no_photo' ? 'Batal / Scan Kolian Lain' : 'Scan Kolian Berikutnya'}</span>
                  </button>
                </div>
              )}

              {matchType && (
                <div className="text-[10px] font-mono text-slate-400 text-right">
                  Match: {matchType}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 5. RIWAYAT SCAN SESI INI */}
        {scanHistory.length > 0 && (
          <section className={`rounded-2xl border p-4 space-y-2.5 ${
            isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Riwayat Scan Sesi Ini ({scanHistory.length})
              </h3>
              <button
                type="button"
                onClick={() => setScanHistory([])}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Bersihkan
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-neutral-800">
              {scanHistory.map((h) => (
                <div key={h.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        h.mode === 'packing'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                      }`}>
                        {h.mode === 'packing' ? 'Paking' : 'Checker'}
                      </span>
                      <span className="font-mono font-bold">{h.boxCode}</span>
                      <span className="text-slate-400 truncate">• {h.storeName}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {h.staff} • {h.time} {h.storage === 'google_drive' ? '• Drive' : ''}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
