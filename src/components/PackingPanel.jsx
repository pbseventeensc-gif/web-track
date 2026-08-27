import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

export default function PackingPanel({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

  const stages = [
    { id: 'status_qc_label', label: 'QC LABEL', staff: 'Bagian: Staff Label', color: 'bg-blue-500' },
    { id: 'status_qc_packing', label: 'QC PACKING', staff: 'Bagian: Staff Paking', color: 'bg-emerald-500' },
    { id: 'status_qc_checker', label: 'QC CHECKER', staff: 'Bagian: Staff Checker', color: 'bg-amber-500' },
    { id: 'status_deliver', label: 'DELIVER', staff: 'Bagian: Staff Deliver', color: 'bg-purple-500' }
  ];

  useEffect(() => {
    fetchPackingData();

    const channel = supabase
      .channel('packing_tracking_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packing_tracking' },
        () => {
          fetchPackingData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPackingData = async () => {
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('*')
      .order('id', { ascending: false });

    if (!error && data) {
      setPackingList(data);
    }
  };

  const totalSpk = packingList.length;

  const handleToggleStatus = async (id, fieldName, currentValue) => {
    const nextValue = currentValue === 'DONE' ? 'PENDING' : 'DONE';
    
    setPackingList(prev => prev.map(item => item.id === id ? { ...item, [fieldName]: nextValue } : item));

    const { error } = await supabase
      .from('packing_tracking')
      .update({ [fieldName]: nextValue, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      alert('❌ Gagal memperbarui status: ' + error.message);
      fetchPackingData();
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000;
          const MAX_HEIGHT = 1000;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.7);
        };
      };
    });
  };

  const handleCameraCapture = async (e, rowId, trackingId) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingId(rowId);
    try {
      const compressedBlob = await compressImage(file);
      const cleanTrackingId = trackingId ? String(trackingId).replace(/[^a-zA-Z0-9-_]/g, '_') : 'item';
      const fileName = `packing_${cleanTrackingId}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('surat-jalan')
        .upload(fileName, compressedBlob, { 
          contentType: 'image/jpeg',
          upsert: true 
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('surat-jalan')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('packing_tracking')
        .update({ 
          surat_jalan_url: publicUrl, 
          status_qc_packing: 'DONE',
          updated_at: new Date().toISOString() 
        })
        .eq('id', rowId);

      if (updateError) throw updateError;

      alert('✅ Foto bukti berhasil diunggah!');
      fetchPackingData();
    } catch (err) {
      alert('❌ Gagal upload foto: ' + err.message);
    }
    setUploadingId(null);
  };

  const handleDownloadPackingReport = async () => {
    try {
      if (packingList.length === 0) {
        return alert('⚠️ Belum ada data paking yang tercatat untuk di-export.');
      }

      const formattedData = packingList.map((item, index) => ({
        'No': index + 1,
        'Tracking ID': item.tracking_id || '-',
        'No. SPK': item.no_spk || '-',
        'Client / PT': item.client_pt || '-',
        'Promo / Project': item.promo_title || '-',
        'Nama Toko / Alamat': item.store_name || '-',
        'Penerima': item.recipient_name || '-',
        'Total Qty': item.total_qty || '-',
        'Status QC Label': item.status_qc_label || 'PENDING',
        'Status QC Packing': item.status_qc_packing || 'PENDING',
        'Status QC Checker': item.status_qc_checker || 'PENDING',
        'Status Deliver': item.status_deliver || 'PENDING',
        'Terakhir Diperbarui': item.updated_at ? new Date(item.updated_at).toLocaleString('id-ID') : '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Report_Paking");

      const todayStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Report_Paking_Wellen_${todayStr}.xlsx`);
      
      alert('✅ Report Excel Paking berhasil di-download!');
    } catch (err) {
      alert('Gagal mendownload report: ' + err.message);
    }
  };

  const handleClearAllPackingData = async () => {
    if (confirm('⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH data paking di database?')) {
      try {
        const { error } = await supabase
          .from('packing_tracking')
          .delete()
          .not('tracking_id', 'is', null);

        if (error) throw error;

        alert('✅ Seluruh data paking berhasil dikosongkan!');
        setPackingList([]);
      } catch (err) {
        alert('❌ Gagal menghapus data paking: ' + err.message);
      }
    }
  };

  return (
    <div className="space-y-8">
      
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
            const completedCount = packingList.filter(s => s[stage.id] === 'DONE' || (s[stage.id] && String(s[stage.id]).includes('DONE'))).length;
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

      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
            📦 Detail Toko, Ceklis Cepat & Kamera Bukti Foto
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleDownloadPackingReport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              📥 Download Report Excel
            </button>
            <button 
              onClick={handleClearAllPackingData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              🗑️ Hapus Semua Data Paking
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-200 text-stone-500'}`}>
              <tr>
                <th className="py-3 px-4">No. SPK</th>
                <th className="py-3 px-4">Nama Store / Project</th>
                <th className="py-3 px-4">Tracking ID</th>
                <th className="py-3 px-4 text-center">Status Packing (Klik Ceklis)</th>
                <th className="py-3 px-4 text-center">Status Checker (Klik Ceklis)</th>
                <th className="py-3 px-4 text-center">Bukti Foto (Pop-up)</th>
                <th className="py-3 px-4 text-center">Kamera / Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-700/50">
              {packingList.length === 0 ? (
                <tr><td colSpan="7" className="p-6 text-center opacity-60">Belum ada data paking. Silakan cetak label terlebih dahulu.</td></tr>
              ) : (
                packingList.map(item => {
                  const isPackingDone = item.status_qc_packing === 'DONE';
                  const isCheckerDone = item.status_qc_checker === 'DONE';

                  return (
                    <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50'}`}>
                      <td className="py-3 px-4 font-bold">{item.no_spk || '-'}</td>
                      <td className="py-3 px-4 font-semibold">{item.store_name || '-'}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-emerald-500 font-bold">{item.tracking_id || '-'}</td>
                      
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleToggleStatus(item.id, 'status_qc_packing', item.status_qc_packing)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 ${
                            isPackingDone 
                              ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                              : 'bg-stone-200 dark:bg-neutral-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                          }`}
                        >
                          {isPackingDone ? '✓ DONE (Selesai)' : '▢ PENDING (Klik Ceklis)'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleToggleStatus(item.id, 'status_qc_checker', item.status_qc_checker)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 ${
                            isCheckerDone 
                              ? 'bg-amber-500 text-white shadow-amber-500/20' 
                              : 'bg-stone-200 dark:bg-neutral-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                          }`}
                        >
                          {isCheckerDone ? '✓ CHECKED (Selesai)' : '▢ PENDING (Klik Ceklis)'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {item.surat_jalan_url ? (
                          <div className="flex justify-center">
                            <img 
                              src={item.surat_jalan_url} 
                              alt="Bukti Foto" 
                              onClick={() => onOpenImageModal(item.surat_jalan_url, `Bukti Foto - ${item.tracking_id}`)}
                              className="w-12 h-12 object-cover rounded-xl border border-stone-300 dark:border-neutral-600 cursor-pointer hover:scale-110 transition-transform shadow-md"
                              title="Klik untuk membuka pop-up foto"
                            />
                          </div>
                        ) : (
                          <span className="text-stone-400 italic text-[10px]">Belum ada foto</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <label className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold cursor-pointer transition-all shadow-md ${
                          uploadingId === item.id 
                            ? 'bg-stone-400 text-white cursor-wait' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                        }`}>
                          {uploadingId === item.id ? '⏳ Menyimpan...' : '📸 Ambil Foto'}
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={(e) => handleCameraCapture(e, item.id, item.tracking_id)}
                            disabled={uploadingId === item.id}
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}