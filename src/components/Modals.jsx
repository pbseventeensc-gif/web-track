import React from 'react';
import { supabase } from '../supabaseClient';
import {
  KeyRound,
  ShieldCheck,
  Camera,
  Download,
  X,
  Store,
  Package,
  FileText,
  ScanLine,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import CustomDropdown from './ui/CustomDropdown';

/* 1. MODAL OTENTIKASI CABANG */
export function BranchLoginModal({ isOpen, onLoginSuccess }) {
  const [accessCode, setAccessCode] = React.useState('');
  const [pinCode, setPinCode] = React.useState('');
  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    const { data } = await supabase
      .from('kl_branch_access')
      .select('*, kl_branches(branch_name)')
      .eq('access_code', accessCode.toUpperCase())
      .eq('pin_code', pinCode)
      .maybeSingle();

    if (data) {
      onLoginSuccess({ role: 'branch', branch_id: data.branch_id, branch_name: data.kl_branches.branch_name });
    } else {
      alert('Kode Cabang atau PIN tidak sesuai.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-neutral-900 rounded-2xl text-center shadow-lg border border-slate-200/90 dark:border-neutral-800 transition-all">
        <div className="w-12 h-12 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">Akses Portal Cabang</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Masukkan kode identitas cabang beserta PIN 6 digit</p>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <input
            type="text"
            placeholder="Kode Cabang (Contoh: AZKO-001)"
            value={accessCode}
            onChange={e => setAccessCode(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm"
          />
          <input
            type="password"
            placeholder="PIN 6 Digit"
            value={pinCode}
            onChange={e => setPinCode(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center tracking-widest text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all text-sm"
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            Masuk ke Portal
          </button>
        </form>
      </div>
    </div>
  );
}

/* 2. MODAL OTENTIKASI ADMINISTRATOR */
export function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  if (!isOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.toUpperCase() === 'ADMIN' && password === '123456') {
      onLoginSuccess({ role: 'admin', name: 'Administrator' });
    } else {
      alert('Nama pengguna atau kata sandi administrator tidak sesuai.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-neutral-900 rounded-2xl text-center shadow-lg border border-slate-200/90 dark:border-neutral-800 transition-all">
        <div className="w-12 h-12 rounded-xl bg-indigo-50/90 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">Otentikasi Administrator Operasional</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Masuk menggunakan kredensial administrator sistem</p>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <input
            type="text"
            placeholder="Nama Pengguna"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl font-semibold uppercase text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm"
          />
          <input
            type="password"
            placeholder="Kata Sandi"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center tracking-widest text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-sm"
          />
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200/80 dark:border-neutral-700 bg-slate-100/80 hover:bg-slate-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl font-semibold text-slate-700 dark:text-slate-300 transition-all text-sm cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] text-sm cursor-pointer"
            >
              Masuk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* 3. MODAL PEMINDAIAN STASIUN KENDALI MUTU */
export function ScanQCModal({ isOpen, onClose, isDarkMode, scanTargetColumn, setScanTargetColumn, scannedInput, setScannedInput, handleSubmitInput, lastScanMessage }) {
  if (!isOpen) return null;

  const isSuccessMessage = lastScanMessage && (lastScanMessage.toLowerCase().includes('berhasil') || lastScanMessage.toLowerCase().includes('sukses'));

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
      <div className={`w-full max-w-sm p-6 rounded-2xl border shadow-lg transition-all ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-sm">Pemindaian Kendali Mutu (QC)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmitInput} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Stasiun Tujuan</label>
            <CustomDropdown
              value={scanTargetColumn}
              onChange={e => setScanTargetColumn(e.target.value)}
              className="w-full"
            >
              <option value="qc_checker">Pemeriksaan Mutu (Checker)</option>
              <option value="qc_paking">Verifikasi Paking</option>
              <option value="qty_finish">Tetapkan Selesai Otomatis (Jumlah Maksimal)</option>
            </CustomDropdown>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Masukan Pemindai Kode Batang</label>
            <div className="relative flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="Arahkan pemindai kode batang ke kolom ini..."
                value={scannedInput}
                onChange={e => setScannedInput(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border font-mono text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                  isDarkMode ? 'bg-neutral-800 border-neutral-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl transition-all duration-150 active:scale-[0.98] text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <ScanLine className="w-4 h-4" />
            Proses Data Pemindaian
          </button>
        </form>

        {lastScanMessage && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            isSuccessMessage
              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
              : 'bg-rose-50/90 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60'
          }`}>
            {isSuccessMessage ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{lastScanMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* 4. MODAL PRATINJAU DOKUMENTASI FOTO */
export function ImagePreviewModal({ isOpen, onClose, modalImageInfo }) {
  if (!isOpen) return null;

  const handleDownloadHD = (e) => {
    e.stopPropagation();
    if (!modalImageInfo?.url) return;
    const link = document.createElement('a');
    link.href = modalImageInfo.url;
    link.download = `Dokumentasi_${modalImageInfo.title || 'Bukti'}_${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/75 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 transition-opacity overflow-y-auto"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-700 border border-slate-200/80 font-medium flex items-center justify-center transition-all cursor-pointer z-[110] shadow-sm active:scale-95"
        title="Tutup Pratinjau"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="relative flex flex-col items-center justify-center space-y-4 my-auto max-w-[96vw] bg-white/95 dark:bg-neutral-900/95 p-5 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center">
          <img
            src={modalImageInfo.url}
            alt="Pratinjau Dokumentasi"
            style={{ width: '420px', height: '560px', maxWidth: '88vw', maxHeight: '72vh', objectFit: 'contain' }}
            className="rounded-2xl border border-slate-200/80 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950 object-contain"
          />
        </div>

        <div className="flex flex-col items-center justify-center text-center space-y-1.5 text-slate-700 dark:text-slate-200 max-w-[88vw]">
          {modalImageInfo.storeName && (
            <div className="font-medium text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 flex-wrap">
              <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-slate-500 dark:text-slate-400">Tujuan:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{modalImageInfo.storeName}</span>
            </div>
          )}

          {(modalImageInfo.projectName || modalImageInfo.spkNo || modalImageInfo.title) && (
            <div className="flex items-center justify-center gap-2.5 flex-wrap text-xs sm:text-sm">
              {modalImageInfo.projectName && (
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium text-slate-500 dark:text-slate-400">Proyek:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{modalImageInfo.projectName}</span>
                </span>
              )}
              {modalImageInfo.projectName && modalImageInfo.spkNo && (
                <span className="text-slate-300 dark:text-neutral-700">•</span>
              )}
              {modalImageInfo.spkNo && (
                <span className="flex items-center gap-1.5 font-mono">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-slate-500 dark:text-slate-400">SPK:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{modalImageInfo.spkNo}</span>
                </span>
              )}
              {!modalImageInfo.storeName && !modalImageInfo.projectName && !modalImageInfo.spkNo && modalImageInfo.title && (
                <span className="font-semibold text-slate-800 dark:text-slate-100">{modalImageInfo.title}</span>
              )}
            </div>
          )}
        </div>

        <div className="pt-1">
          <button
            onClick={handleDownloadHD}
            className="px-5 py-2.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            title="Unduh Dokumentasi Resolusi Penuh"
          >
            <Download className="w-4 h-4" />
            Unduh Dokumentasi Asli
          </button>
        </div>
      </div>
    </div>
  );
}