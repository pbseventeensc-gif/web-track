import React, { useState } from 'react';

export default function PinModal({ isOpen, onClose, onSubmit, title, subtitle, isDarkMode, requireOldPin }) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (requireOldPin && !oldPin) {
      alert("Silakan masukkan PIN Lama Anda terlebih dahulu.");
      return;
    }

    if (!newPin || !confirmPin) {
      alert("Semua kolom PIN baru harus diisi.");
      return;
    }

    if (newPin.length !== 6 || isNaN(newPin)) {
      alert("PIN Baru harus terdiri dari tepat 6 digit angka.");
      return;
    }

    if (newPin !== confirmPin) {
      alert("Konfirmasi PIN Baru tidak cocok.");
      return;
    }

    setIsSubmitting(true);
    await onSubmit({ oldPin, newPin });
    setIsSubmitting(false);
    
    // Reset form
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-extrabold text-base tracking-wide text-indigo-600 dark:text-indigo-400">{title}</h3>
            {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-stone-100 dark:bg-neutral-800 hover:bg-stone-200 dark:hover:bg-neutral-700 font-bold text-xs"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {requireOldPin && (
            <div>
              <label className="block text-xs font-bold mb-1 opacity-80">PIN Lama (Saat Ini)</label>
              <input 
                type="password" 
                maxLength={6}
                placeholder="Masukkan 6 digit PIN lama"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                className={`w-full p-3 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300'}`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1 opacity-80">PIN Baru (6 Digit Angka)</label>
            <input 
              type="password" 
              maxLength={6}
              placeholder="Masukkan 6 digit PIN baru"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className={`w-full p-3 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300'}`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 opacity-80">Konfirmasi PIN Baru</label>
            <input 
              type="password" 
              maxLength={6}
              placeholder="Ulangi 6 digit PIN baru"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className={`w-full p-3 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300'}`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className={`flex-1 py-3 rounded-xl font-bold text-xs border transition-all ${isDarkMode ? 'border-neutral-700 hover:bg-neutral-800 text-neutral-300' : 'border-slate-300 hover:bg-slate-100 text-slate-600'}`}
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan PIN Baru'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}