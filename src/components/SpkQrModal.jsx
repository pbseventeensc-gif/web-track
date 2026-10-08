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
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl transition-all ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base">QR Code & Link Divisi</h3>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{spkItem.no_spk}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* QR Code Display Container */}
        <div className="flex flex-col items-center justify-center py-4 bg-slate-50 dark:bg-neutral-800/60 rounded-2xl border border-slate-200/80 dark:border-neutral-700 mb-4 p-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
            <QRCodeSVG value={scanLink} size={180} level="H" includeMargin={true} />
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-3 text-center break-all px-2">
            {scanLink}
          </span>
        </div>

        {/* SPK Info Summary */}
        <div className="text-xs space-y-1.5 mb-5 p-3 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300">
          <div><strong className="text-slate-900 dark:text-white">Client:</strong> {spkItem.client || '-'}</div>
          <div><strong className="text-slate-900 dark:text-white">Project:</strong> {spkItem.project || '-'}</div>
          <div><strong className="text-slate-900 dark:text-white">Material:</strong> {spkItem.bahan || '-'} ({spkItem.qty_order || 0} pcs)</div>
        </div>

        {/* Quick Jump Buttons to All Divisions */}
        <div className="space-y-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Akses Cepat ke Semua Divisi:
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleJumpToDivision('checker')}
              className="p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Divisi Checker</span>
            </button>

            <button
              onClick={() => handleJumpToDivision('label')}
              className="p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700"
            >
              <Tag className="w-4 h-4 text-orange-600" />
              <span>Divisi Label</span>
            </button>

            <button
              onClick={() => handleJumpToDivision('produksi')}
              className="p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700"
            >
              <Scissors className="w-4 h-4 text-blue-600" />
              <span>Finishing / Produksi</span>
            </button>

            <button
              onClick={() => handleJumpToDivision('paking')}
              className="p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700"
            >
              <Package className="w-4 h-4 text-purple-600" />
              <span>Divisi Packing</span>
            </button>
          </div>

          <button
            onClick={() => handleJumpToDivision('outbound')}
            className="w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800 bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 mt-1"
          >
            <Truck className="w-4 h-4 text-rose-600" />
            <span>Divisi Pengiriman / Outbound</span>
          </button>
        </div>
      </div>
    </div>
  );
}
