import React, { useState } from 'react';
import CustomerManager from './CustomerManager';
import CustomLabelGenerator from './CustomLabelGenerator';
import PmgDestinationManager from './PmgDestinationManager';
import PmgProjectManager from './PmgProjectManager';
import PmgExcelImporter from './PmgExcelImporter';

export default function CustomModulesIndex({ isDarkMode }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportSuccess = () => {
    // Trigger child component refresh upon successful import
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-5 p-4 md:p-5 max-w-7xl mx-auto">
      <header className={`p-4 rounded-2xl border shadow-2xs ${isDarkMode ? 'bg-neutral-900/90 border-neutral-800 text-slate-100' : 'bg-slate-50/90 border-slate-200/80 text-slate-800'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Modul Alokasi & Distribusi PMG
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Pusat pengelolaan alokasi massal, pencetakan label kolian kustom, serta penerbitan Surat Jalan dan POD PT. PMG Integrasi Komunikasi.
            </p>
          </div>
          <span className="inline-flex items-center self-start sm:self-center px-3 py-1 rounded-xl text-[11px] font-semibold bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60">
            Sistem Distribusi Terpadu
          </span>
        </div>
      </header>

      {/* CCOD Allocation Import Widget */}
      <div className="w-full">
        <PmgExcelImporter isDarkMode={isDarkMode} onImportSuccess={handleImportSuccess} />
      </div>

      {/* PMG Allocation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" key={refreshKey}>
        <div className="lg:col-span-1">
          <PmgDestinationManager isDarkMode={isDarkMode} />
        </div>
        <div className="lg:col-span-2">
          <PmgProjectManager isDarkMode={isDarkMode} />
        </div>
      </div>

      <hr className="border-slate-200/80 dark:border-neutral-800 my-4" />

      {/* Bulk Allocation & Custom Label Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CustomerManager isDarkMode={isDarkMode} />
        <CustomLabelGenerator isDarkMode={isDarkMode} />
      </div>
    </div>
  );
}