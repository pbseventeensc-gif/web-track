import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import LabelGeneratorTab from './components/LabelGeneratorTab';
import KawanLamaTab from './components/KawanLamaTab';
import PackingPanel from './components/PackingPanel';
import MainTrackingTable from './components/MainTrackingTable';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('wellen_dark_mode') === 'true');
  const [activeTab, setActiveTab] = useState('admin_pusat'); // 'admin_pusat', 'kawan_lama', 'labels', 'packing', 'tracking'
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
        
        {/* Header App & Menu Navigasi Tab */}
        <div className={`p-4 rounded-2xl border flex flex-col lg:flex-row justify-between items-center gap-4 shadow-sm ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-wider bg-gradient-to-r from-indigo-500 to-teal-500 bg-clip-text text-transparent">
                WELLEN PRINT TRACKING
              </h1>
              <p className="text-[11px] opacity-70 mt-0.5">Sistem Manajemen Label, Surat Jalan & Tracking Terpadu</p>
            </div>
          </div>

          {/* Tombol Tab Navigasi Lengkap */}
          <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-neutral-900 p-1.5 rounded-xl border border-stone-300 dark:border-neutral-700 flex-wrap justify-center">
            <button 
              onClick={() => setActiveTab('admin_pusat')} 
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'admin_pusat' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              👑 Admin Pusat
            </button>
            <button 
              onClick={() => setActiveTab('kawan_lama')} 
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'kawan_lama' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              🏢 Kawan Lama
            </button>
            <button 
              onClick={() => setActiveTab('labels')} 
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'labels' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              🏷️ Label & SJ
            </button>
            <button 
              onClick={() => setActiveTab('packing')} 
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'packing' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              📋 QC & Packing
            </button>
            <button 
              onClick={() => setActiveTab('tracking')} 
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'tracking' ? 'bg-indigo-600 text-white shadow-md' : 'opacity-70 hover:opacity-100'}`}
            >
              📦 Tracking Utama
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="px-3.5 py-2 rounded-xl text-xs font-bold border shadow-sm transition-all bg-stone-100 dark:bg-neutral-900 border-stone-300 dark:border-neutral-700 hover:opacity-80 cursor-pointer"
            >
              {isDarkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
        </div>

        {/* Konten Berdasarkan Tab yang Dipilih */}
        <div>
          {activeTab === 'admin_pusat' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
                <h3 className="font-bold text-sm mb-1">👑 Dashboard Admin Pusat</h3>
                <p className="text-xs opacity-70">Akses penuh pengelolaan data, label koli, dan surat jalan.</p>
              </div>
              <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={handleOpenImageModal} />
            </div>
          )}

          {activeTab === 'kawan_lama' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
                <h3 className="font-bold text-sm mb-1 text-amber-500">🏢 Portal Kawan Lama (kawanlama_kl)</h3>
                <p className="text-xs opacity-70">Panel khusus untuk pemantauan dan manajemen order Kawan Lama Group.</p>
              </div>
              <KawanLamaTab isDarkMode={isDarkMode} onOpenImageModal={handleOpenImageModal} />
            </div>
          )}

          {activeTab === 'labels' && (
            <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={handleOpenImageModal} />
          )}

          {activeTab === 'packing' && (
            <PackingPanel isDarkMode={isDarkMode} />
          )}

          {activeTab === 'tracking' && (
            <MainTrackingTable isDarkMode={isDarkMode} />
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