import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LabelGeneratorTab from './components/LabelGeneratorTab';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('wellen_dark_mode') === 'true');
  const [activeTab, setActiveTab] = useState('labels');
  const [imageModalData, setImageModalData] = useState(null);

  useEffect(() => {
    localStorage.setItem('wellen_dark_mode', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleOpenImageModal = (url, title) => {
    setImageModalData({ url, title });
  };

  const handleCloseImageModal = () => {
    setImageModalData(null);
  };

  return (
    <div className={`min-h-screen p-4 sm:p-6 transition-colors duration-200 ${isDarkMode ? 'bg-[#0F172A] text-slate-100' : 'bg-[#F4F1EA] text-[#2C3531]'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header App & 3 Tab Navigasi Utama */}
        <div className={`p-4 rounded-2xl border flex flex-col lg:flex-row justify-between items-center gap-4 shadow-sm ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-black tracking-wider bg-gradient-to-r from-indigo-500 to-teal-500 bg-clip-text text-transparent">
              WELLEN PRINT TRACKING
            </h1>
          </div>

          {/* 3 Tab Navigasi */}
          <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-neutral-900 p-1.5 rounded-xl border border-stone-300 dark:border-neutral-700">
            <button 
              onClick={() => setActiveTab('labels')} 
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'labels' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              🏷️ Label & Surat Jalan
            </button>
            <button 
              onClick={() => setActiveTab('tracking')} 
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'tracking' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              📦 Tracking Paket
            </button>
            <button 
              onClick={() => setActiveTab('packing')} 
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'packing' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              📋 QC & Packing
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="px-3.5 py-2 rounded-xl text-xs font-bold border shadow-sm transition-all bg-stone-100 dark:bg-neutral-900 border-stone-300 dark:border-neutral-700 hover:opacity-80 cursor-pointer"
            >
              {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>

        {/* Konten Berdasarkan Tab yang Aktif */}
        <div>
          {activeTab === 'labels' && (
            <LabelGeneratorTab 
              isDarkMode={isDarkMode} 
              onOpenImageModal={handleOpenImageModal} 
            />
          )}

          {activeTab === 'tracking' && (
            <div className={`p-8 rounded-2xl border text-center shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
              <h3 className="font-bold text-base">📦 Halaman Tracking Paket</h3>
              <p className="text-xs opacity-70 mt-1">Fitur pemantauan status pengiriman paket.</p>
            </div>
          )}

          {activeTab === 'packing' && (
            <div className={`p-8 rounded-2xl border text-center shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
              <h3 className="font-bold text-base">📋 Halaman QC & Packing</h3>
              <p className="text-xs opacity-70 mt-1">Fitur validasi QC label, packing, dan checker.</p>
            </div>
          )}
        </div>

        {/* Modal Preview Gambar */}
        {imageModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className={`p-4 rounded-2xl max-w-2xl w-full relative shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-300 text-black'}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm">🖼️ {imageModalData.title}</h3>
                <button onClick={handleCloseImageModal} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-all">✕ Tutup</button>
              </div>
              <div className="flex justify-center items-center bg-stone-100 dark:bg-neutral-900 rounded-xl p-4 max-h-[75vh] overflow-hidden border border-stone-200 dark:border-neutral-800">
                <img src={imageModalData.url} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow" />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}