import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function PackingPanel({ isDarkMode, spkList, handleUpdateField, onOpenImageModal }) {
  const [uploadingId, setUploadingId] = useState(null);

  const stages = [
    { id: 'qc_label', label: 'QC LABEL', color: 'bg-blue-500' },
    { id: 'qc_paking', label: 'QC PACKING', color: 'bg-emerald-500' },
    { id: 'qc_checker', label: 'QC CHECKER', color: 'bg-amber-500' },
    { id: 'deliver', label: 'DELIVER', color: 'bg-purple-500' }
  ];

  // Handler untuk upload bukti foto per SPK
  const handleImageUpload = async (e, spkId, noSpk) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(spkId);
    const fileName = `packing_${noSpk}_${Date.now()}`;
    
    // Upload ke bucket 'surat-jalan' atau buat bucket khusus 'packing-proof'
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      // Simpan URL gambar ke field database (misal kita gunakan field surat_jalan_url atau buat kolom baru)
      await handleUpdateField(spkId, { surat_jalan_url: data.publicUrl });
      alert('✅ Bukti foto berhasil diunggah!');
    } else {
      alert('❌ Gagal upload: ' + error.message);
    }
    setUploadingId(null);
  };

  return (
    <div className="space-y-8">
      {/* BAGIAN ATAS: GRID KONTROL TAHAPAN PAKING */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-4">
          Panel Kontrol Paking & Tahapan
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stages.map((stage) => (
            <div key={stage.id} className={`p-5 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
              <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
                <div className={`w-3 h-3 rounded-full ${stage.color}`}></div> {stage.label}
              </h3>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {spkList.filter(s => !s[stage.id]).length === 0 ? (
                  <p className="text-[11px] text-stone-400 italic text-center py-4">Semua Selesai 🎉</p>
                ) : (
                  spkList.filter(s => !s[stage.id]).map(spk => (
                    <div key={spk.id} className={`p-3 rounded-xl border flex justify-between items-center text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-100'}`}>
                      <div className="truncate pr-2">
                        <span className="font-bold block truncate">{spk.project || spk.no_spk}</span>
                        <span className="text-[10px] text-stone-400">{spk.no_spk}</span>
                      </div>
                      <button 
                        onClick={() => handleUpdateField(spk.id, { [stage.id]: 'DONE' })}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shrink-0 transition-all active:scale-95"
                      >
                        Set Done
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BAGIAN BAWAH: PENAMPUNGAN / UPLOAD FOTO BUKTI TIAP TOKO SETELAH SCAN */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
        <h3 className="text-sm font-black uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-4">
          📷 Penampungan & Upload Bukti Foto Toko (Hasil Scan)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-200 text-stone-500'}`}>
              <tr>
                <th className="py-3 px-4">No. SPK</th>
                <th className="py-3 px-4">Nama Store / Project</th>
                <th className="py-3 px-4">QR / ID Store</th>
                <th className="py-3 px-4 text-center">Bukti Foto / Preview</th>
                <th className="py-3 px-4 text-center">Aksi Upload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-700/50">
              {spkList.map(item => (
                <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50'}`}>
                  <td className="py-3 px-4 font-bold">{item.no_spk}</td>
                  <td className="py-3 px-4 font-semibold">{item.project || '-'}</td>
                  <td className="py-3 px-4 font-mono text-[11px] opacity-70">{item.store_code || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    {item.surat_jalan_url ? (
                      <button 
                        onClick={() => onOpenImageModal(item.surat_jalan_url, `Bukti - ${item.project}`)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg font-bold hover:bg-emerald-500/20 transition-all"
                      >
                        👁️ Lihat Foto
                      </button>
                    ) : (
                      <span className="text-stone-400 italic">Belum ada foto</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all shadow-sm ${
                      uploadingId === item.id 
                        ? 'bg-stone-400 text-white cursor-wait' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                    }`}>
                      {uploadingId === item.id ? '⏳ Mengunggah...' : '📁 Upload Foto'}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}