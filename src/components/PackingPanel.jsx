import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function PackingPanel({ isDarkMode, spkList, handleUpdateField, onOpenImageModal }) {
  const [uploadingId, setUploadingId] = useState(null);

  const stages = [
    { id: 'qc_label', label: 'QC LABEL', staff: 'Bagian: Staff Label', color: 'bg-blue-500' },
    { id: 'qc_paking', label: 'QC PACKING', staff: 'Bagian: Staff Paking', color: 'bg-emerald-500' },
    { id: 'qc_checker', label: 'QC CHECKER', staff: 'Bagian: Staff Checker', color: 'bg-amber-500' },
    { id: 'deliver', label: 'DELIVER', staff: 'Bagian: Staff Deliver', color: 'bg-purple-500' }
  ];

  const totalSpk = spkList.length;

  const handleImageUpload = async (e, spkId, noSpk) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(spkId);
    const fileName = `packing_${noSpk}_${Date.now()}`;
    
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      await handleUpdateField(spkId, { surat_jalan_url: data.publicUrl });
      alert('✅ Bukti foto berhasil diunggah!');
    } else {
      alert('❌ Gagal upload: ' + error.message);
    }
    setUploadingId(null);
  };

  return (
    <div className="space-y-8">
      
      {/* BAGIAN ATAS: GRID KONTROL PERSENTASE & STAFF */}
      <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <h2 className="text-lg font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
            Panel Kontrol Paking & Penanggung Jawab Scan
          </h2>
          <span className="text-xs font-bold px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            Total SPK Aktif: {totalSpk}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stages.map((stage) => {
            const completedCount = spkList.filter(s => s[stage.id] === 'DONE' || (s[stage.id] && s[stage.id].includes('DONE'))).length;
            const percent = totalSpk > 0 ? Math.round((completedCount / totalSpk) * 100) : 0;

            return (
              <div key={stage.id} className={`p-6 rounded-3xl border flex flex-col justify-between ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`}></div> {stage.label}
                    </h3>
                    <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-500">
                      {percent}%
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-stone-400 mb-6">{stage.staff}</p>
                  
                  <div className="text-center py-6 space-y-1">
                    <span className="text-3xl font-black tracking-tight block text-stone-800 dark:text-neutral-100">
                      {completedCount} <span className="text-sm font-medium text-stone-400">/ {totalSpk}</span>
                    </span>
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">SPK Selesai</span>
                  </div>
                </div>

                <div className={`mt-6 pt-3 border-t text-[11px] font-bold flex justify-between items-center ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-100 text-stone-500'}`}>
                  <span>Status:</span>
                  <span className={percent === 100 ? 'text-emerald-500 font-black' : 'text-amber-500 font-bold'}>
                    {percent === 100 ? '🟢 100% Selesai' : '🟡 In Progress'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BAGIAN BAWAH: TABEL DENGAN KOLOM PACKING, CHECKER & THUMBNAIL FOTO POP-UP */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
        <h3 className="text-sm font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-4">
          📦 Detail Toko, Status Packing, Checker & Bukti Foto
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-200 text-stone-500'}`}>
              <tr>
                <th className="py-3 px-4">No. SPK</th>
                <th className="py-3 px-4">Nama Store / Project</th>
                <th className="py-3 px-4">QR / ID Store</th>
                <th className="py-3 px-4 text-center">Status Packing</th>
                <th className="py-3 px-4 text-center">Status Checker</th>
                <th className="py-3 px-4 text-center">Bukti Foto (Thumbnail)</th>
                <th className="py-3 px-4 text-center">Aksi Upload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-700/50">
              {spkList.map(item => {
                const isPackingDone = item.qc_paking === 'DONE' || (item.qc_paking && item.qc_paking.includes('DONE'));
                const isCheckerDone = item.qc_checker === 'DONE' || (item.qc_checker && item.qc_checker.includes('DONE'));

                return (
                  <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50'}`}>
                    <td className="py-3 px-4 font-bold">{item.no_spk}</td>
                    <td className="py-3 px-4 font-semibold">{item.project || '-'}</td>
                    <td className="py-3 px-4 font-mono text-[11px] opacity-70">{item.store_code || '-'}</td>
                    
                    {/* Kolom Status Packing */}
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-xl font-bold text-[10px] ${isPackingDone ? 'bg-emerald-500/10 text-emerald-500' : 'bg-stone-500/10 text-stone-400'}`}>
                        {isPackingDone ? '✓ DONE' : 'PENDING'}
                      </span>
                    </td>

                    {/* Kolom Status Checker */}
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-xl font-bold text-[10px] ${isCheckerDone ? 'bg-amber-500/10 text-amber-500' : 'bg-stone-500/10 text-stone-400'}`}>
                        {isCheckerDone ? '✓ DONE' : 'PENDING'}
                      </span>
                    </td>

                    {/* Kolom Thumbnail Foto (Bisa di-klik pop-up) */}
                    <td className="py-3 px-4 text-center">
                      {item.surat_jalan_url ? (
                        <div className="flex justify-center">
                          <img 
                            src={item.surat_jalan_url} 
                            alt="Bukti" 
                            onClick={() => onOpenImageModal(item.surat_jalan_url, `Bukti Foto - ${item.project}`)}
                            className="w-10 h-10 object-cover rounded-xl border border-stone-300 dark:border-neutral-600 cursor-pointer hover:scale-110 transition-transform shadow-sm"
                            title="Klik untuk memperbesar foto"
                          />
                        </div>
                      ) : (
                        <span className="text-stone-400 italic text-[10px]">Belum ada foto</span>
                      )}
                    </td>

                    {/* Kolom Aksi Upload */}
                    <td className="py-3 px-4 text-center">
                      <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all shadow-sm ${
                        uploadingId === item.id 
                          ? 'bg-stone-400 text-white cursor-wait' 
                          : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                      }`}>
                        {uploadingId === item.id ? '⏳...' : '📁 Upload'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, item.id, item.no_spk)}
                          disabled={uploadingId === item.id}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}