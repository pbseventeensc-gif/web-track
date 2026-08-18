import React from 'react';
import CustomerManager from './CustomerManager';
import CustomLabelGenerator from './CustomLabelGenerator';

export default function CustomModulesIndex({ isDarkMode }) {
  return (
    <div className="space-y-8 p-4 md:p-6 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
          📦 Modul Eksternal / Custom
        </h1>
        <p className={`text-sm opacity-60 ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
          Pusat kendali untuk manajemen customer dan pencetakan label khusus di luar sistem Kawan Lama.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Kolom 1: Manajemen Customer */}
        <div className="w-full">
          <CustomerManager isDarkMode={isDarkMode} />
        </div>

        {/* Kolom 2: Generator Label */}
        <div className="w-full">
          <CustomLabelGenerator isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
}