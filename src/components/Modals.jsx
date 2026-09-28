import React from 'react';
import { supabase } from '../supabaseClient';

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
      alert('❌ Kode Cabang atau PIN Salah!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="w-full max-w-sm p-6 bg-white rounded-3xl text-center shadow-2xl">
        <div className="text-4xl mb-3">🔑</div>
        <h3 className="font-bold text-lg text-black mb-4">Login Cabang</h3>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" 
            placeholder="Kode Cabang (Misal: AZKO-001)" 
            value={accessCode} 
            onChange={e => setAccessCode(e.target.value)} 
            className="w-full p-3 border rounded-xl font-bold text-black focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
          <input 
            type="password" 
            placeholder="PIN 6 Digit" 
            value={pinCode} 
            onChange={e => setPinCode(e.target.value)} 
            className="w-full p-3 border rounded-xl text-center tracking-widest text-black focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
          <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">
            Masuk / Login 🚀
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
      alert('❌ Admin Username/Password salah!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="w-full max-w-sm p-6 bg-white rounded-3xl text-center shadow-2xl">
        <div className="text-4xl mb-3">🔐</div>
        <h3 className="font-bold text-lg text-black mb-4">Login Admin Operasional</h3>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="text" 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            className="w-full p-3 border rounded-xl text-black font-bold uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500" 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            className="w-full p-3 border rounded-xl text-center tracking-widest text-black focus:outline-none focus:ring-2 focus:ring-indigo-500" 
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border py-3 rounded-xl font-bold text-black hover:bg-stone-100 transition-all">Batal</button>
            <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">Masuk</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* 3. MODAL SCAN QC STATION */
export function ScanQCModal({ isOpen, onClose, isDarkMode, scanTargetColumn, setScanTargetColumn, scannedInput, setScannedInput, handleSubmitInput, lastScanMessage }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className={`w-full max-w-sm p-6 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-black'}`}>
        <div className="flex justify-between items-center mb-4 border-b pb-2 dark:border-neutral-700 border-stone-200">
          <h3 className="font-bold">📷 Scan QC Station</h3>
          <button onClick={onClose} className="hover:text-red-500">✕</button>
        </div>
        <form onSubmit={handleSubmitInput} className="space-y-4 text-sm">
          <select 
            value={scanTargetColumn} 
            onChange={e => setScanTargetColumn(e.target.value)} 
            className={`w-full p-2.5 rounded-xl border focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-[#C5BEAD] text-black'}`}
          >
            <option value="qc_checker">QC Checker</option>
            <option value="qc_paking">QC Paking</option>
            <option value="qty_finish">Auto Set Finish (Max Qty)</option>
          </select>
          <input 
            type="text" 
            autoFocus 
            placeholder="Arahkan Scanner Barcode Ke Sini..." 
            value={scannedInput} 
            onChange={e => setScannedInput(e.target.value)} 
            className={`w-full p-3 rounded-xl border font-mono text-center focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-[#C5BEAD] text-black'}`} 
          />
          <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl active:scale-95 transition-all">
            ⚡ Proses Scan Input
          </button>
        </form>
        {lastScanMessage && (
          <div className={`mt-3 p-3 text-center text-xs font-bold rounded-xl border ${lastScanMessage.includes('✅') ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
            {lastScanMessage}
          </div>
        )}
      </div>
    </div>
  );
}

/* 4. MODAL IMAGE PREVIEW (CLEAN FULL-SCREEN HD DISPLAY + NEAT TEXT BELOW PHOTO) */
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
      className="fixed inset-0 bg-black/92 backdrop-blur-md flex items-center justify-center z-[100] p-3 sm:p-6 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      {/* High-Contrast Floating Close Button Top Right */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black flex items-center justify-center text-xl transition-all cursor-pointer z-[110] shadow-2xl border-2 border-white active:scale-95"
        title="Tutup Modal"
      >
        ✕
      </button>

      <div
        className="relative flex flex-col items-center justify-center space-y-3 my-auto max-w-[96vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo Display - Clean Full Image Without Black Box Frame */}
        <div className="flex items-center justify-center">
          <img
            src={modalImageInfo.url}
            alt="Preview High Res"
            style={{ imageRendering: 'high-quality', WebkitBackfaceVisibility: 'hidden' }}
            className="h-[74vh] max-h-[78vh] min-h-[450px] w-auto max-w-[92vw] object-contain rounded-2xl shadow-2xl block mx-auto border border-white/10"
          />
        </div>

        {/* High-Contrast Card Description Box Below Photo */}
        <div className="flex flex-col items-center justify-center text-center space-y-2 bg-neutral-900/95 border border-white/20 rounded-2xl px-6 py-3.5 max-w-[92vw] shadow-2xl backdrop-blur-xl my-1">
          {modalImageInfo.storeName && (
            <div className="text-white font-black text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 flex-wrap">
              <span className="text-amber-400 font-extrabold flex items-center gap-1">🏪 Store:</span>
              <span className="text-amber-300 bg-amber-950/90 px-3 py-1 rounded-xl border border-amber-500/50 font-black shadow-inner">
                {modalImageInfo.storeName}
              </span>
            </div>
          )}

          {(modalImageInfo.projectName || modalImageInfo.spkNo || modalImageInfo.title) && (
            <div className="flex items-center justify-center gap-2.5 flex-wrap text-xs sm:text-sm font-semibold text-slate-200 pt-0.5">
              {modalImageInfo.projectName && (
                <span className="flex items-center gap-1.5 bg-neutral-800/90 px-3 py-1.5 rounded-xl border border-neutral-700/80 shadow-xs">
                  <span>📦</span>
                  <strong className="text-emerald-400">Project:</strong>
                  <span className="text-white font-extrabold">{modalImageInfo.projectName}</span>
                </span>
              )}
              {modalImageInfo.spkNo && (
                <span className="flex items-center gap-1.5 bg-neutral-800/90 px-3 py-1.5 rounded-xl border border-neutral-700/80 font-mono shadow-xs">
                  <span>📄</span>
                  <strong className="text-indigo-400">SPK:</strong>
                  <span className="text-white font-extrabold">{modalImageInfo.spkNo}</span>
                </span>
              )}
              {!modalImageInfo.storeName && !modalImageInfo.projectName && !modalImageInfo.spkNo && modalImageInfo.title && (
                <span className="text-white font-extrabold text-xs sm:text-sm px-3 py-1.5 bg-neutral-800/90 rounded-xl border border-neutral-700/80 shadow-xs">
                  {modalImageInfo.title}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Download Button */}
        <div className="pt-0.5">
          <button
            onClick={handleDownloadHD}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-2xl transition-all cursor-pointer active:scale-95 border border-emerald-400/40"
            title="Download Foto File Asli Kamera (Ultra HD)"
          >
            📥 Download Foto HD
          </button>
        </div>
      </div>
    </div>
  );
}