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

/* 1. MODAL LOGIN CABANG */
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
      alert('Kode Cabang atau PIN Salah!');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-neutral-900 rounded-2xl text-center shadow-xl border border-slate-200 dark:border-neutral-800 transition-all">
        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Login Cabang</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Masukkan kode cabang & PIN 6 digit</p>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <input 
            type="text" 
            placeholder="Kode Cabang (Misal: AZKO-001)" 
            value={accessCode} 
            onChange={e => setAccessCode(e.target.value)} 
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
          />
          <input 
            type="password" 
            placeholder="PIN 6 Digit" 
            value={pinCode} 
            onChange={e => setPinCode(e.target.value)} 
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center tracking-widest text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98] text-sm flex items-center justify-center gap-2"
          >
            Masuk / Login
          </button>
        </form>
      </div>
    </div>
  );
}

/* 2. MODAL LOGIN ADMIN */
export function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  if (!isOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.toUpperCase() === 'ADMIN' && password === '123456') {
      onLoginSuccess({ role: 'admin', name: 'Administrator' });
    } else {
      alert('Admin Username/Password salah!');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-neutral-900 rounded-2xl text-center shadow-xl border border-slate-200 dark:border-neutral-800 transition-all">
        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">Login Admin Operasional</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Masuk sebagai administrator sistem</p>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <input 
            type="text" 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl font-bold uppercase text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl text-center tracking-widest text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
          />
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 dark:border-neutral-700 rounded-xl font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-all text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98] text-sm"
            >
              Masuk
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* 3. MODAL SCAN QC STATION */
export function ScanQCModal({ isOpen, onClose, isDarkMode, scanTargetColumn, setScanTargetColumn, scannedInput, setScannedInput, handleSubmitInput, lastScanMessage }) {
  if (!isOpen) return null;

  const isSuccessMessage = lastScanMessage && (lastScanMessage.includes('✅') || lastScanMessage.toLowerCase().includes('berhasil') || lastScanMessage.toLowerCase().includes('sukses'));

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className={`w-full max-w-sm p-6 rounded-2xl border shadow-xl transition-all ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h3 className="font-bold text-base">Scan QC Station</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmitInput} className="space-y-3.5 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Target Station</label>
            <select
              value={scanTargetColumn}
              onChange={e => setScanTargetColumn(e.target.value)}
              className={`w-full px-3 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <option value="qc_checker">QC Checker</option>
              <option value="qc_paking">QC Paking</option>
              <option value="qty_finish">Auto Set Finish (Max Qty)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Input Scanner</label>
            <div className="relative flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="Arahkan Scanner Barcode Ke Sini..."
                value={scannedInput}
                onChange={e => setScannedInput(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border font-mono text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98] text-sm flex items-center justify-center gap-2"
          >
            <ScanLine className="w-4 h-4" />
            Proses Scan Input
          </button>
        </form>

        {lastScanMessage && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
            isSuccessMessage
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
          }`}>
            {isSuccessMessage ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{lastScanMessage.replace(/[✅❌]/g, '').trim()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* 4. MODAL IMAGE PREVIEW (CLEAN FULL-SCREEN HD DISPLAY) */
export function ImagePreviewModal({ isOpen, onClose, modalImageInfo }) {
  if (!isOpen) return null;

  const handleDownloadHD = (e) => {
    e.stopPropagation();
    if (!modalImageInfo?.url) return;
    const link = document.createElement('a');
    link.href = modalImageInfo.url;
    link.download = `HD_${modalImageInfo.title || 'Foto_Bukti'}_${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 transition-opacity overflow-y-auto"
      onClick={onClose}
    >
      {/* Floating Close Button Top Right */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white font-medium flex items-center justify-center transition-all cursor-pointer z-[110] shadow-md border border-slate-700 active:scale-95"
        title="Tutup Modal"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="relative flex flex-col items-center justify-center space-y-4 my-auto max-w-[96vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo Display - Clean Image */}
        <div className="flex items-center justify-center">
          <img
            src={modalImageInfo.url}
            alt="Preview High Res"
            style={{ width: '420px', height: '595px', maxWidth: '92vw', maxHeight: '80vh', objectFit: 'contain', imageRendering: 'high-quality', WebkitBackfaceVisibility: 'hidden' }}
            className="rounded-2xl shadow-2xl block mx-auto border border-slate-800 bg-black object-contain"
          />
        </div>

        {/* Clean Subtitle & Info Below Photo */}
        <div className="flex flex-col items-center justify-center text-center space-y-1.5 text-slate-200 max-w-[92vw]">
          {modalImageInfo.storeName && (
            <div className="text-slate-300 font-medium text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 flex-wrap">
              <Store className="w-4 h-4 text-orange-400" />
              <span className="font-semibold text-slate-400">Store:</span>
              <span className="font-medium text-white">{modalImageInfo.storeName}</span>
            </div>
          )}

          {(modalImageInfo.projectName || modalImageInfo.spkNo || modalImageInfo.title) && (
            <div className="flex items-center justify-center gap-2.5 flex-wrap text-xs sm:text-sm text-slate-300">
              {modalImageInfo.projectName && (
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-orange-400" />
                  <span className="font-medium text-slate-400">Project:</span>
                  <span className="font-normal text-white">{modalImageInfo.projectName}</span>
                </span>
              )}
              {modalImageInfo.projectName && modalImageInfo.spkNo && (
                <span className="text-slate-600">•</span>
              )}
              {modalImageInfo.spkNo && (
                <span className="flex items-center gap-1.5 font-mono">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <span className="font-medium text-slate-400">SPK:</span>
                  <span className="font-normal text-white">{modalImageInfo.spkNo}</span>
                </span>
              )}
              {!modalImageInfo.storeName && !modalImageInfo.projectName && !modalImageInfo.spkNo && modalImageInfo.title && (
                <span className="font-normal text-white">{modalImageInfo.title}</span>
              )}
            </div>
          )}
        </div>

        {/* Download Button */}
        <div className="pt-1">
          <button
            onClick={handleDownloadHD}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 border border-orange-400/30"
            title="Download Foto File Asli Kamera (Ultra HD)"
          >
            <Download className="w-4 h-4" />
            Download Foto HD
          </button>
        </div>
      </div>
    </div>
  );
}