import React from 'react';

export default function PackingPanel({ isDarkMode, spkList, handleUpdateField }) {
  // Daftar tahapan paking dengan penanggung jawab/staff terkait
  const stages = [
    { id: 'qc_label', label: 'QC LABEL', staff: 'Bagian: Staff Label', color: 'bg-blue-500' },
    { id: 'qc_paking', label: 'QC PACKING', staff: 'Bagian: Staff Paking', color: 'bg-emerald-500' },
    { id: 'qc_checker', label: 'QC CHECKER', staff: 'Bagian: Staff Checker', color: 'bg-amber-500' },
    { id: 'deliver', label: 'DELIVER', staff: 'Bagian: Staff Deliver', color: 'bg-purple-500' }
  ];

  const totalSpk = spkList.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-lg font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
          Panel Kontrol Paking & Penanggung Jawab Scan (Google Sheet Import)
        </h2>
        <span className="text-xs font-bold px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
          Total SPK Aktif: {totalSpk}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage) => {
          const completedCount = spkList.filter(s => s[stage.id] === 'DONE').length;
          const percent = totalSpk > 0 ? Math.round((completedCount / totalSpk) * 100) : 0;
          const pendingItems = spkList.filter(s => !s[stage.id]);

          return (
            <div key={stage.id} className={`p-5 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
              <div>
                {/* Header Tahapan & Staff */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`}></div> {stage.label}
                  </h3>
                  <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-neutral-700 text-stone-600 dark:text-stone-300">
                    {percent}%
                  </span>
                </div>
                <p className="text-[10px] font-bold text-stone-400 mb-4">{stage.staff}</p>
                
                {/* List Item SPK dari Google Sheet */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                  {pendingItems.length === 0 ? (
                    <div className="text-center py-6 text-xs text-stone-400 italic">
                      ✨ Semua Selesai
                    </div>
                  ) : (
                    pendingItems.map(spk => (
                      <div key={spk.id} className={`p-3 rounded-2xl border flex justify-between items-center text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700/80' : 'bg-stone-50 border-stone-100'}`}>
                        <div className="truncate pr-2">
                          <span className="font-bold block truncate">{spk.project || spk.no_spk}</span>
                          <span className="text-[10px] font-mono opacity-65">{spk.no_spk}</span>
                        </div>
                        <button 
                          onClick={() => handleUpdateField(spk.id, { [stage.id]: 'DONE' })}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[11px] shrink-0 transition-all active:scale-95 shadow-sm"
                        >
                          Set Done
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer Ringkasan */}
              <div className={`mt-4 pt-3 border-t text-[11px] font-bold flex justify-between ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-100 text-stone-500'}`}>
                <span>Selesai: {completedCount}/{totalSpk}</span>
                <span className={percent === 100 ? 'text-emerald-500' : ''}>{percent === 100 ? '🟢 100% Done' : '🟡 In Progress'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}