import React from 'react';

export default function PackingPanel({ isDarkMode, spkList, handleUpdateField }) {
  const stages = [
    { id: 'qc_label', label: 'QC LABEL', color: 'bg-blue-500' },
    { id: 'qc_paking', label: 'QC PACKING', color: 'bg-emerald-500' },
    { id: 'qc_checker', label: 'QC CHECKER', color: 'bg-amber-500' },
    { id: 'deliver', label: 'DELIVER', color: 'bg-purple-500' }
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
        Panel Kontrol Paking
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage) => (
          <div key={stage.id} className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
            <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
              <div className={`w-3 h-3 rounded-full ${stage.color}`}></div> {stage.label}
            </h3>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {spkList.filter(s => !s[stage.id]).map(spk => (
                <div key={spk.id} className={`p-3 rounded-xl border flex justify-between items-center text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-100'}`}>
                  <span className="font-bold truncate">{spk.no_spk}</span>
                  <button 
                    onClick={() => handleUpdateField(spk.id, { [stage.id]: 'DONE' })}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold"
                  >
                    Set Done
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}