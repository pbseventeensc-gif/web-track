import React, { useState } from 'react';
import BranchOrderForm from './kawanlama/BranchOrderForm';
import BranchOrderHistory from './kawanlama/BranchOrderHistory';

export default function KawanLamaTab({ isDarkMode, currentUser, isBranchMode }) {
  const [activeSubTab, setActiveSubTab] = useState('order_baru');

  return (
    <div className="space-y-6">
      {/* Tab Navigasi Khusus Kawan Lama */}
      <div className="flex gap-2 border-b pb-2">
        <button 
          onClick={() => setActiveSubTab('order_baru')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'order_baru' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
        >
          ➕ Order Baru
        </button>
        <button 
          onClick={() => setActiveSubTab('riwayat')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeSubTab === 'riwayat' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-stone-200 dark:bg-neutral-800'}`}
        >
          🚚 Tracking Order
        </button>
      </div>

      {/* Konten Berdasarkan Tab */}
      {activeSubTab === 'order_baru' ? (
        <BranchOrderForm isDarkMode={isDarkMode} currentUser={currentUser} isBranchMode={isBranchMode} />
      ) : (
        <BranchOrderHistory isDarkMode={isDarkMode} currentUser={currentUser} />
      )}
    </div>
  );
}