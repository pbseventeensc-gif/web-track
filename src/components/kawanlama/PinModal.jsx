import React, { useState } from 'react';
import { X, Lock, Check } from 'lucide-react';

export default function PinModal({ isOpen, onClose, onSubmit, title, subtitle, isDarkMode, requireOldPin }) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (requireOldPin && !oldPin) {
      alert("Silakan masukkan PIN lama Anda terlebih dahulu.");
      return;
    }

    if (!newPin || !confirmPin) {
      alert("Seluruh kolom PIN baru wajib diisi.");
      return;
    }

    if (newPin.length !== 6 || isNaN(newPin)) {
      alert("PIN baru harus terdiri dari tepat 6 digit angka.");
      return;
    }

    if (newPin !== confirmPin) {
      alert("Konfirmasi PIN baru tidak sesuai.");
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
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
      <div className={`w-full max-w-md p-6 rounded-3xl border shadow-xl ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}>
        
        <div className="flex justify-between items-start mb-5 pb-3 border-b border-slate-200/80 dark:border-neutral-800">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide text-indigo-700 dark:text-indigo-300">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {requireOldPin && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-neutral-300">PIN Lama (Saat Ini)</label>
              <input 
                type="password" 
                maxLength={6}
                placeholder="Masukkan 6 digit PIN lama"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                className={`w-full p-3 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-slate-50/80 border-slate-200/90 text-slate-900'}`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-neutral-300">PIN Baru (6 Digit Angka)</label>
            <input 
              type="password" 
              maxLength={6}
              placeholder="Masukkan 6 digit PIN baru"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              className={`w-full p-3 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-slate-50/80 border-slate-200/90 text-slate-900'}`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-neutral-300">Konfirmasi PIN Baru</label>
            <input 
              type="password" 
              maxLength={6}
              placeholder="Ulangi 6 digit PIN baru"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className={`w-full p-3 rounded-xl border text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-slate-50/80 border-slate-200/90 text-slate-900'}`}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-xs bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl font-semibold text-xs bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 shadow-2xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Menyimpan...' : 'Simpan PIN Baru'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}