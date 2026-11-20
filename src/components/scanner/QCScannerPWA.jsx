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
      isDarkMode ? 'bg-[#151311] text-[#F5F2EE]' : 'bg-[#F8F6F3] text-[#1F1D1B]'
    }`}>
      {/* TOP APP BAR — CLEAN WHITE WITH WELLEN PRINT LOGO */}
      <header className={`sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-md ${
        isDarkMode
          ? 'bg-[#1C1917]/95 border-[#2E2925] text-[#F5F2EE]'
          : 'bg-white/95 border-[#E8E2DC] text-[#1F1D1B]'
      }`}>
        <div className="max-w-xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack ? (
              <button
                type="button"
                onClick={async () => {
                  await stopCamera();
                  onBack();
                }}
                className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  isDarkMode
                    ? 'border-[#332E29] bg-[#24201D] hover:bg-[#2E2925] text-[#E7E2DC]'
                    : 'border-[#E8E2DC] bg-[#FAF8F6] hover:bg-[#F1ECE6] text-[#44403C]'
                }`}
                title="Kembali ke Tabel"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : isStandalone ? (
              <a
                href="/"
                className={`p-2 rounded-xl border transition-colors shrink-0 ${
                  isDarkMode
                    ? 'border-[#332E29] bg-[#24201D] hover:bg-[#2E2925] text-[#E7E2DC]'
                    : 'border-[#E8E2DC] bg-[#FAF8F6] hover:bg-[#F1ECE6] text-[#44403C]'
                }`}
                title="Buka Web Dashboard"
              >
                <ArrowLeft className="w-4 h-4" />
              </a>
            ) : null}

            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`shrink-0 ${isDarkMode ? 'bg-white px-2 py-1 rounded-lg' : ''}`}>
                <img
                  src="/wellen-logo.png"
                  alt="Wellen Print"
                  className="h-7 sm:h-8 w-auto object-contain block"
                />
              </div>
              <div className={`h-6 w-px shrink-0 ${isDarkMode ? 'bg-[#332E29]' : 'bg-[#E5DFD8]'}`} />
              <div className="min-w-0">
                <h1 className="font-bold text-xs sm:text-sm tracking-tight truncate leading-tight">
                  QC Scanner
                </h1>
                <p className={`text-[11px] truncate leading-tight mt-0.5 ${
                  isDarkMode ? 'text-[#A8A29E]' : 'text-[#78716C]'
                }`}>
                  {scanMode === 'packing'
                    ? 'Scan QR → Foto Asli HP'
                    : 'Scan QR → Verifikasi Checker'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {installPromptEvent && !isInstalledPwa && (
              <button
                type="button"
                onClick={handleInstallPwa}
                className="px-3 py-1.5 rounded-xl bg-[#FFF3EC] hover:bg-[#FFE6D7] text-[#C84B24] border border-[#F3CFC0] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto p-3.5 sm:p-5 space-y-3.5 pb-16">
        {/* 1. IDENTITAS PETUGAS */}
        <section className={`rounded-2xl border p-3.5 ${
          isDarkMode ? 'bg-[#1D1A18] border-[#2E2925]' : 'bg-white border-[#E8E2DC]'
        }`}>
          {isEditingName ? (
            <form onSubmit={handleSaveStaffName} className="space-y-2.5">
              <label className={`text-xs font-semibold flex items-center gap-1.5 ${
                isDarkMode ? 'text-[#F5B096]' : 'text-[#9A3F20]'
              }`}>
                <User className="w-3.5 h-3.5" />
                Nama Petugas QC (untuk catatan waktu & riwayat)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Contoh: Budi / Agus / Siti..."
                  autoFocus
                  required
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#DF5A2B]/25 focus:border-[#DF5A2B] ${
                    isDarkMode
                      ? 'bg-[#26221F] border-[#38322D] text-[#F5F2EE] placeholder:text-[#78716C]'
                      : 'bg-[#FAF8F6] border-[#DFD8D0] text-[#1F1D1B] placeholder:text-[#A8A29E]'
                  }`}
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#DF5A2B] hover:bg-[#C94D22] text-white text-xs font-semibold cursor-pointer transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 font-bold text-xs ${
                  isDarkMode
                    ? 'bg-[#2B201B] text-[#F3A183] border-[#453128]'
                    : 'bg-[#FFF4EE] text-[#C84B24] border-[#F4D5C6]'
                }`}>
                  {staffName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider block ${
                    isDarkMode ? 'text-[#8C857E]' : 'text-[#8C857E]'
                  }`}>
                    Petugas Aktif
                  </span>
                  <span className="text-sm font-bold truncate block">{staffName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNameDraft(staffName);
                  setIsEditingName(true);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'border-[#332E29] text-[#D6D0C9] hover:bg-[#282420]'
                    : 'border-[#E6E0D9] text-[#57534E] hover:bg-[#F7F4F0]'
                }`}
              >
                Ganti Nama
              </button>
            </div>
          )}
        </section>

        {/* 2. PEMILIH MODE: QC PAKING vs QC CHECKER */}
        <section className={`grid grid-cols-2 gap-1.5 p-1 rounded-2xl border ${
          isDarkMode ? 'bg-[#1D1A18] border-[#2E2925]' : 'bg-[#EFECE8] border-[#E5DFD8]'
        }`}>
          <button
            type="button"
            disabled={isModeLocked && scanMode !== 'packing'}
            onClick={() => handleModeSwitch('packing')}
            className={`py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'packing'
                ? isDarkMode
                  ? 'bg-[#2C2622] text-[#F5F2EE] shadow-2xs ring-1 ring-white/10'
                  : 'bg-white text-[#1F1D1B] shadow-2xs ring-1 ring-black/5'
                : isDarkMode
                ? 'text-[#A8A29E] hover:text-[#E7E2DC]'
                : 'text-[#6B6560] hover:text-[#1F1D1B]'
            }`}
          >
            <Package className={`w-4 h-4 ${scanMode === 'packing' ? 'text-[#DF5A2B]' : ''}`} />
            <span>QC Paking</span>
          </button>

          <button
            type="button"
            disabled={isModeLocked && scanMode !== 'checker'}
            onClick={() => handleModeSwitch('checker')}
            className={`py-2.5 px-3 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'checker'
                ? isDarkMode
                  ? 'bg-[#2C2622] text-[#F5F2EE] shadow-2xs ring-1 ring-white/10'
                  : 'bg-white text-[#1F1D1B] shadow-2xs ring-1 ring-black/5'
                : isDarkMode
                ? 'text-[#A8A29E] hover:text-[#E7E2DC]'
                : 'text-[#6B6560] hover:text-[#1F1D1B]'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${scanMode === 'checker' ? 'text-[#D4881C]' : ''}`} />
            <span>QC Checker</span>
          </button>
        </section>

        {scanMode === 'checker' && (
          <label className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border text-xs cursor-pointer select-none ${
            isDarkMode
              ? 'bg-[#231E18] border-[#3B3022] text-[#EAD3AE]'
              : 'bg-[#FFF9EE] border-[#F2E0BD] text-[#6E4911]'
          }`}>
            <span className="font-medium">
              Auto-verifikasi langsung saat QR terbaca (jika foto bukti sudah ada)
            </span>
            <input
              type="checkbox"
              checked={autoVerifyChecker}
              onChange={(e) => setAutoVerifyChecker(e.target.checked)}
              className="w-4 h-4 accent-[#D4881C] cursor-pointer shrink-0"
            />
          </label>
        )}

        {/* 3. VIEWFINDER KAMERA QR SCANNER */}
        {scanState === 'idle' && (
          <section className={`rounded-2xl border overflow-hidden ${
            isDarkMode ? 'bg-[#1D1A18] border-[#2E2925]' : 'bg-white border-[#E8E2DC]'
          }`}>
            <div className={`relative w-full min-h-[250px] flex flex-col items-center justify-center transition-colors ${
              isCameraActive
                ? 'bg-[#1C1917]'
                : isDarkMode
                ? 'bg-[#211D1A]'
                : 'bg-[#FAF7F4]'
            }`}>
              <div id="wellen-qr-reader" className="w-full" />

              {!isCameraActive && (
                <div className="p-6 text-center space-y-3.5">
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto ${
                    scanMode === 'packing'
                      ? isDarkMode
                        ? 'bg-[#2B201B] text-[#F08C69] border-[#453128]'
                        : 'bg-[#FFF4EE] text-[#DF5A2B] border-[#F4D5C6]'
                      : isDarkMode
                      ? 'bg-[#292218] text-[#EBB75D] border-[#423522]'
                      : 'bg-[#FFF8EB] text-[#C97A16] border-[#F2DFB8]'
                  }`}>
                    <QrCode className="w-7 h-7" />
                  </div>
                  <p className={`text-xs max-w-xs mx-auto leading-relaxed ${
                    isDarkMode ? 'text-[#A8A29E]' : 'text-[#6B6560]'
                  }`}>
                    {scanMode === 'packing'
                      ? 'Pindai QR Code pada label kolian terlebih dahulu, lalu ambil foto bukti paking resolusi asli HP.'
                      : 'Pindai QR Code pada label kolian untuk mencatat verifikasi Checker beserta nama dan waktu.'}
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className={`px-5 py-3 rounded-xl font-semibold text-sm text-white flex items-center gap-2 mx-auto cursor-pointer active:scale-[0.98] transition-all ${
                      scanMode === 'packing'
                        ? 'bg-[#DF5A2B] hover:bg-[#C94D22]'
                        : 'bg-[#C97A16] hover:bg-[#B26A11]'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Aktifkan Kamera QR</span>
                  </button>
                </div>
              )}

              {isCameraActive && (
                <div className="p-2.5 bg-[#24211E]/95 w-full flex items-center justify-between px-4 border-t border-white/10">
                  <span className="text-[11px] font-medium text-[#E7E2DC] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E87A4F] animate-pulse" />
                    Kamera aktif — arahkan ke QR label
                  </span>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold cursor-pointer transition-colors"
                  >
                    Hentikan
                  </button>
                </div>
              )}
            </div>

            {cameraError && (
              <div className={`p-3 border-t text-xs font-medium ${
                isDarkMode
                  ? 'bg-[#2C1B1B] border-[#4A2828] text-[#F4B4B4]'
                  : 'bg-[#FDF2F2] border-[#F2CECE] text-[#9E2A2A]'
              }`}>
                {cameraError}
              </div>
            )}

            {/* Input Manual / Scanner USB Fallback */}
            <form
              onSubmit={handleManualSubmit}
              className={`p-3 border-t flex gap-2 ${
                isDarkMode ? 'border-[#2E2925] bg-[#1D1A18]' : 'border-[#ECE7E1] bg-white'
              }`}
            >
              <div className="relative flex-1">
                <Keyboard className="w-3.5 h-3.5 text-[#A8A29E] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Atau ketik / tempel kode QR..."
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#DF5A2B]/25 focus:border-[#DF5A2B] ${
                    isDarkMode
                      ? 'bg-[#26221F] border-[#38322D] text-[#F5F2EE] placeholder:text-[#78716C]'
                      : 'bg-[#FAF8F6] border-[#E5DFD8] text-[#1F1D1B] placeholder:text-[#A8A29E]'
                  }`}
                />
              </div>
              <button
                type="submit"
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'bg-[#332E29] hover:bg-[#3F3933] text-[#F5F2EE]'
                    : 'bg-[#292524] hover:bg-[#1C1917] text-white'
                }`}
              >
                Cari QR
              </button>
            </form>
          </section>
        )}

        {/* 4. HASIL PENCARIAN & AKSI SESUAI STEP */}
        {scanState === 'searching' && (
          <div className={`rounded-2xl border p-8 text-center space-y-3 ${
            isDarkMode ? 'bg-[#1D1A18] border-[#2E2925]' : 'bg-white border-[#E8E2DC]'
          }`}>
            <RefreshCw className="w-7 h-7 text-[#DF5A2B] animate-spin mx-auto" />
            <p className="text-sm font-semibold">{statusMessage}</p>
            <p className="text-xs font-mono text-[#8C857E] break-all">{lastScannedRaw}</p>
          </div>
        )}

        {scanState === 'not_found' && (
          <div className={`rounded-2xl border p-5 space-y-4 ${
            isDarkMode
              ? 'border-[#4A2828] bg-[#281A1A]'
              : 'border-[#F2CACA] bg-[#FDF4F4]'
          }`}>
            <div className="flex items-start gap-3">
              <XCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isDarkMode ? 'text-[#F09A9A]' : 'text-[#B83232]'}`} />
              <div className="space-y-1 min-w-0">
                <h2 className={`font-bold text-sm ${isDarkMode ? 'text-[#F7CECE]' : 'text-[#8C2222]'}`}>
                  Data Kolian Tidak Ditemukan
                </h2>
                <p className={`text-xs ${isDarkMode ? 'text-[#E5B4B4]' : 'text-[#A03030]'}`}>{statusMessage}</p>
                <p className={`text-[11px] font-mono break-all ${isDarkMode ? 'text-[#C99292]' : 'text-[#B45353]'}`}>
                  QR: {lastScannedRaw}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetAndScanNext}
              className="w-full py-2.5 rounded-xl bg-[#B83232] hover:bg-[#9E2828] text-white font-semibold text-sm cursor-pointer transition-colors"
            >
              Scan Ulang QR
            </button>
          </div>
        )}

        {matchedItem && scanState !== 'not_found' && scanState !== 'searching' && (
          <section className={`rounded-2xl border overflow-hidden ${
            isDarkMode ? 'bg-[#1D1A18] border-[#2E2925]' : 'bg-white border-[#E8E2DC]'
          }`}>
            {/* Banner Status Soft */}
            <div className={`px-4 py-3 flex items-center justify-between gap-2 border-b ${
              scanState === 'success'
                ? isDarkMode
                  ? 'bg-[#1B2B22] text-[#A8E0BE] border-[#294334]'
                  : 'bg-[#EEF7F1] text-[#215E3B] border-[#CCE6D5]'
                : scanState === 'warning_no_photo'
                ? isDarkMode
                  ? 'bg-[#2B2316] text-[#F2D091] border-[#453720]'
                  : 'bg-[#FEF7E8] text-[#8A510E] border-[#F3DCAD]'
                : scanState === 'uploading'
                ? isDarkMode
                  ? 'bg-[#2B1F1A] text-[#F4B49A] border-[#453128]'
                  : 'bg-[#FFF3EC] text-[#B84720] border-[#F3D2C1]'
                : isDarkMode
                ? 'bg-[#24201D] text-[#E7E2DC] border-[#332E29]'
                : 'bg-[#FAF7F4] text-[#292524] border-[#E8E2DC]'
            }`}>
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                {scanState === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : scanState === 'warning_no_photo' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : scanState === 'uploading' ? (
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Package className="w-4 h-4 shrink-0 text-[#DF5A2B]" />
                )}
                <span>
                  {scanState === 'success'
                    ? 'Berhasil Tersimpan'
                    : scanState === 'warning_no_photo'
                    ? 'Belum Ada Foto Bukti Paking'
                    : scanState === 'uploading'
                    ? 'Menyimpan...'
                    : 'Kolian Teridentifikasi'}
                </span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg border ${
                isDarkMode
                  ? 'bg-black/25 border-white/10'
                  : 'bg-white/80 border-black/10 text-[#292524]'
              }`}>
                {matchedItem.box_code || '-'}
              </span>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Info Kolian */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C857E]">
                      Customer / Cabang
                    </span>
                    <h3 className="font-bold text-base leading-snug">
                      {matchedItem.store_name || '-'}
                    </h3>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border shrink-0 ${
                    isDarkMode
                      ? 'bg-[#26221F] border-[#36302B] text-[#D6D0C9]'
                      : 'bg-[#FAF8F6] border-[#E6E0D9] text-[#57534E]'
                  }`}>
                    {matchedItem.delivery_type || 'DALAM KOTA'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-[#24201D] border-[#332E29]' : 'bg-[#FAF8F6] border-[#ECE7E1]'
                  }`}>
                    <span className="text-[10px] text-[#8C857E] font-semibold block">Proyek</span>
                    <span className="font-semibold line-clamp-2">{matchedItem.promo_title || '-'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    isDarkMode ? 'bg-[#24201D] border-[#332E29]' : 'bg-[#FAF8F6] border-[#ECE7E1]'
                  }`}>
                    <span className="text-[10px] text-[#8C857E] font-semibold block">No. SPK / Tracking</span>
                    <span className="font-mono font-semibold block truncate">{matchedItem.no_spk || '-'}</span>
                    <span className="font-mono text-[10px] text-[#8C857E] block truncate">{matchedItem.tracking_id}</span>
                  </div>
                </div>
              </div>

              {/* Status Paking & Checker Saat Ini */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`p-2.5 rounded-xl border ${
                  isPackingDone(matchedItem)
                    ? isDarkMode
                      ? 'bg-[#1B2B22] border-[#2B4636]'
                      : 'bg-[#EEF7F1] border-[#CEE6D6]'
                    : isDarkMode
                    ? 'bg-[#24201D] border-[#332E29]'
                    : 'bg-[#FAF8F6] border-[#ECE7E1]'
                }`}>
                  <span className="text-[10px] font-semibold uppercase text-[#78716C] block">Status Paking</span>
                  <span className={`font-bold block mt-0.5 ${
                    isPackingDone(matchedItem)
                      ? isDarkMode ? 'text-[#9CDCB5]' : 'text-[#215E3B]'
                      : ''
                  }`}>
                    {isPackingDone(matchedItem) ? 'Selesai' : 'Menunggu'}
                  </span>
                  {packerMeta.name && (
                    <span className="text-[10px] text-[#78716C] block truncate mt-0.5">
                      {packerMeta.name} • {formatClockTime(packerMeta.timestamp)}
                    </span>
                  )}
                </div>

                <div className={`p-2.5 rounded-xl border ${
                  isCheckerDone(matchedItem)
                    ? isDarkMode
                      ? 'bg-[#2B2316] border-[#453720]'
                      : 'bg-[#FEF7E8] border-[#F2DCAD]'
                    : isDarkMode
                    ? 'bg-[#24201D] border-[#332E29]'
                    : 'bg-[#FAF8F6] border-[#ECE7E1]'
                }`}>
                  <span className="text-[10px] font-semibold uppercase text-[#78716C] block">Status Checker</span>
                  <span className={`font-bold block mt-0.5 ${
                    isCheckerDone(matchedItem)
                      ? isDarkMode ? 'text-[#F0CB85]' : 'text-[#8A510E]'
                      : ''
                  }`}>
                    {isCheckerDone(matchedItem) ? 'Terverifikasi' : 'Menunggu'}
                  </span>
                  {checkerMeta.name && (
                    <span className="text-[10px] text-[#78716C] block truncate mt-0.5">
                      {checkerMeta.name} • {formatClockTime(checkerMeta.timestamp)}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview Foto Bukti */}
              {(localPreviewUrl || hasValidPhoto(matchedItem)) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C857E] flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    Foto Bukti Paking (Resolusi Asli HP)
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
                    className={`w-full max-h-56 object-contain rounded-xl border cursor-pointer ${
                      isDarkMode ? 'border-[#332E29] bg-[#141210]' : 'border-[#E8E2DC] bg-[#F5F2EE]'
                    }`}
                  />
                </div>
              )}

              {statusMessage && (
                <p className={`text-xs font-medium p-3 rounded-xl border ${
                  scanState === 'success'
                    ? isDarkMode
                      ? 'bg-[#1B2B22] text-[#A8E0BE] border-[#2B4636]'
                      : 'bg-[#EEF7F1] text-[#215E3B] border-[#CEE6D6]'
                    : scanState === 'warning_no_photo'
                    ? isDarkMode
                      ? 'bg-[#2B2316] text-[#F2D091] border-[#453720]'
                      : 'bg-[#FEF7E8] text-[#8A510E] border-[#F2DCAD]'
                    : isDarkMode
                    ? 'bg-[#26201D] text-[#E7D8CE] border-[#3B302A]'
                    : 'bg-[#FFF5F0] text-[#9A3F20] border-[#F4D5C6]'
                }`}>
                  {statusMessage}
                </p>
              )}

              {/* TOMBOL AKSI: QC PAKING */}
              {scanMode === 'packing' && scanState !== 'uploading' && (
                <div className="space-y-2 pt-1">
                  <label className="w-full py-3.5 px-4 rounded-xl bg-[#DF5A2B] hover:bg-[#C94D22] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] transition-all">
                    <Camera className="w-4 h-4" />
                    <span>
                      {scanState === 'success' || hasValidPhoto(matchedItem)
                        ? 'Ambil Ulang Foto Bukti'
                        : 'Ambil Foto Bukti (Kamera HP)'}
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
                    <label className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      isDarkMode
                        ? 'border-[#36302B] text-[#E7E2DC] hover:bg-[#282420]'
                        : 'border-[#E4DDD5] text-[#44403C] hover:bg-[#F7F4F0]'
                    }`}>
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
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isDarkMode
                          ? 'bg-[#332E29] hover:bg-[#3F3933] text-[#F5F2EE]'
                          : 'bg-[#292524] hover:bg-[#1C1917] text-white'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{scanState === 'success' ? 'Scan Berikutnya' : 'Scan Ulang'}</span>
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
                      className="w-full py-3.5 px-4 rounded-xl bg-[#C97A16] hover:bg-[#B26A11] text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {scanState === 'warning_no_photo'
                          ? 'Tetap Verifikasi Checker'
                          : 'Verifikasi QC Checker'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleResetAndScanNext}
                    className={`w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      isDarkMode
                        ? 'bg-[#332E29] hover:bg-[#3F3933] text-[#F5F2EE]'
                        : 'bg-[#292524] hover:bg-[#1C1917] text-white'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{scanState === 'warning_no_photo' ? 'Batal / Scan Kolian Lain' : 'Scan Kolian Berikutnya'}</span>
                  </button>
                </div>
              )}

              {matchType && (
                <div className="text-[10px] font-mono text-[#A8A29E] text-right">
                  Match: {matchType}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 5. RIWAYAT SCAN SESI INI */}
        {scanHistory.length > 0 && (
          <section className={`rounded-2xl border p-4 space-y-2.5 ${
            isDarkMode ? 'bg-[#1D1A18] border-[#2E2925]' : 'bg-white border-[#E8E2DC]'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#78716C] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Riwayat Sesi Ini ({scanHistory.length})
              </h3>
              <button
                type="button"
                onClick={() => setScanHistory([])}
                className="text-[11px] font-medium text-[#8C857E] hover:text-[#44403C] cursor-pointer"
              >
                Bersihkan
              </button>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-[#2B2622]' : 'divide-[#F0ECE7]'}`}>
              {scanHistory.map((h) => (
                <div key={h.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                        h.mode === 'packing'
                          ? isDarkMode
                            ? 'bg-[#2E201A] text-[#F09A7A]'
                            : 'bg-[#FFF2EB] text-[#B84720]'
                          : isDarkMode
                          ? 'bg-[#2B2316] text-[#EBBF75]'
                          : 'bg-[#FEF6E6] text-[#9A5B13]'
                      }`}>
                        {h.mode === 'packing' ? 'Paking' : 'Checker'}
                      </span>
                      <span className="font-mono font-semibold">{h.boxCode}</span>
                      <span className="text-[#8C857E] truncate">• {h.storeName}</span>
                    </div>
                    <div className="text-[10px] text-[#8C857E] mt-0.5">
                      {h.staff} • {h.time} {h.storage === 'google_drive' ? '• Drive' : ''}
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D52] shrink-0" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
