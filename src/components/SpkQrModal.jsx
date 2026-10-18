import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, QrCode, CheckCircle2, Tag, Scissors, Package, Truck } from 'lucide-react';

export default function SpkQrModal({ isOpen, onClose, spkItem, isDarkMode, setActiveTab, setSearchTerm }) {
  if (!isOpen || !spkItem) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://web-track-phi-gilt.vercel.app';
  const scanLink = `${currentUrl}?scan=${encodeURIComponent(spkItem.no_spk || '')}`;

  const handleJumpToDivision = (tabName) => {
    if (setActiveTab) setActiveTab(tabName);
    if (setSearchTerm) setSearchTerm(spkItem.no_spk || '');
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[150] p-4">
      <div className={`w-full max-w-md p-6 rounded-2xl border shadow-lg transition-all ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Kode QR & Pintasan Stasiun Kerja</h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{spkItem.no_spk}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Kontainer Kode QR */}
        <div className="flex flex-col items-center justify-center py-4 bg-slate-50/80 dark:bg-neutral-800/50 rounded-2xl border border-slate-200/80 dark:border-neutral-700 mb-4 p-4">
          <div className="p-3 bg-white rounded-2xl shadow-2xs border border-slate-200/80">
            <QRCodeSVG value={scanLink} size={180} level="H" includeMargin={true} />
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-3 text-center break-all px-2">
            {scanLink}
          </span>
        </div>

        {/* Ringkasan Informasi SPK */}
        <div className="text-xs space-y-1.5 mb-5 p-3.5 rounded-xl bg-slate-50/90 dark:bg-neutral-800/70 border border-slate-200/70 dark:border-neutral-700/70 text-slate-700 dark:text-slate-300">
          <div><strong className="text-slate-800 dark:text-slate-100">Pelanggan:</strong> {spkItem.client || '-'}</div>
          <div><strong className="text-slate-800 dark:text-slate-100">Proyek:</strong> {spkItem.project || '-'}</div>
          <div><strong className="text-slate-800 dark:text-slate-100">Material:</strong> {spkItem.bahan || '-'} ({spkItem.qty_order || 0} unit)</div>
        </div>

        {/* Pintasan Navigasi Antar Divisi */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Pintasan Langsung ke Divisi Terkait:
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleJumpToDivision('checker')}
              className="p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Stasiun Pemeriksaan</span>
            </button>

            <button
              onClick={() => handleJumpToDivision('label')}
              className="p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer bg-amber-50/70 hover:bg-amber-100/80 text-amber-800 border-amber-200/80 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800/60"
            >
              <Tag className="w-4 h-4" />
              <span>Generator Label</span>
            </button>

            <button
              onClick={() => handleJumpToDivision('finishing')}
              className="p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer bg-blue-50/70 hover:bg-blue-100/80 text-blue-700 border-blue-200/80 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800/60"
            >
              <Scissors className="w-4 h-4" />
              <span>Divisi Penyelesaian</span>
            </button>

            <button
              onClick={() => handleJumpToDivision('paking')}
              className="p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800/60"
            >
              <Package className="w-4 h-4" />
              <span>Packing Station</span>
            </button>
          </div>

          <button
            onClick={() => handleJumpToDivision('outbound')}
            className="w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 mt-1"
          >
            <Truck className="w-4 h-4" />
            <span>Stasiun Pengiriman (Outbound)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
