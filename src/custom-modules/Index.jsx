import React, { useState } from 'react';
import CustomerManager from './CustomerManager';
import CustomLabelGenerator from './CustomLabelGenerator';
import PmgDestinationManager from './PmgDestinationManager';
import PmgProjectManager from './PmgProjectManager';
import PmgExcelImporter from './PmgExcelImporter';

export default function CustomModulesIndex({ isDarkMode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportSuccess = () => {
    // Memicu refresh komponen turunan jika data berhasil diimpor
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
          📦 Modul Eksternal & Alokasi PMG
        </h1>
        <p className={`text-sm opacity-60 ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
          Pusat kendali manajemen customer, label kustom, serta alokasi surat jalan PT. PMG Integrasi Komunikasi.
        </p>
      </header>

      {/* 🚀 Widget Import Excel Alokasi CCOD ke Supabase */}
      <div className="w-full">
        <PmgExcelImporter isDarkMode={isDarkMode} onImportSuccess={handleImportSuccess} />
      </div>

      {/* Bagian Khusus PMG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" key={refreshKey}>
        <div className="lg:col-span-1">
          <PmgDestinationManager isDarkMode={isDarkMode} />
        </div>
        <div className="lg:col-span-2">
          <PmgProjectManager isDarkMode={isDarkMode} />
        </div>
      </div>

      <hr className="border-stone-300 dark:border-neutral-700 my-6" />

      {/* Bagian Label & Customer Umum Sebelumnya */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CustomerManager isDarkMode={isDarkMode} />
        <CustomLabelGenerator isDarkMode={isDarkMode} />
      </div>
    </div>
  );
}