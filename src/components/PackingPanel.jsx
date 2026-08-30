import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

export default function PackingPanel({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState(null);
  const printRef = useRef();

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

  // Parser Excel Matriks (Sheet: 206 - A, 206 - B, etc.)
  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const matrixSheets = wb.SheetNames.filter(
          (s) => !s.toUpperCase().includes('LABEL') && !s.toUpperCase().includes('DATA STORE')
        );

        let parsedRecords = [];

        matrixSheets.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (!data || data.length < 7) return;

          // Baris Header Item Matriks (Row index 1 s/d 4)
          const rowCodes = data[1] || [];
          const rowDescs = data[2] || [];
          const rowMaterials = data[3] || [];
          const rowSizes = data[4] || [];

          // Parse Daftar Item Katalog (Mulai kolom L / index 12)
          let catalogItems = [];
          for (let colIdx = 12; colIdx < rowCodes.length; colIdx++) {
            if (rowCodes[colIdx]) {
              catalogItems.push({
                colIndex: colIdx,
                code: String(rowCodes[colIdx]).trim(),
                desc: rowDescs[colIdx] ? String(rowDescs[colIdx]).trim() : 'LAMINATE',
                material: rowMaterials[colIdx] ? String(rowMaterials[colIdx]).trim() : 'PVC',
                size: rowSizes[colIdx] ? String(rowSizes[colIdx]).trim() : '-'
              });
            }
          }

          // Parse Baris Tiap Toko (Mulai row 6 / index 6 ke bawah)
          for (let r = 6; r < data.length; r++) {
            const row = data[r];
            if (!row || !row[1]) continue; // jika nomor toko kosong

            const storeNo = row[1];
            const prCode = row[2] || '';
            const boxCode = row[3] || `B${r - 5}`;
            const storeId = row[4] || '';
            const clientPt = row[5] || 'PT. Miniso Lifestyle Trading Indonesia';
            const storeName = row[6] || '';
            const noPo = row[7] || '';
            const spkWpp = row[8] || '';
            const deliveryType = row[9] || 'DALAM KOTA';
            const qrAddress = row[10] || `${prCode}_${storeId}_${storeName}`;

            // Ambil Qty Item Toko Ini
            let storeItems = [];
            let totalQty = 0;

            catalogItems.forEach((cat) => {
              const qtyVal = Number(row[cat.colIndex]) || 0;
              if (qtyVal > 0) {
                storeItems.push({
                  code: cat.code,
                  desc: cat.desc,
                  material: cat.material,
                  size: cat.size,
                  qty: qtyVal,
                  unit: 'Pcs'
                });
                totalQty += qtyVal;
              }
            });

            const trackingId = `${prCode || 'PR'}-${boxCode}-${storeId || storeNo}`;

            parsedRecords.push({
              tracking_id: trackingId,
              no_spk: spkWpp.split('/')[0]?.trim() || spkWpp,
              client_pt: clientPt,
              promo_title: noPo,
              store_name: storeName,
              recipient_name: `Store #${storeNo} (${storeId})`,
              total_qty: totalQty,
              box_code: boxCode,
              area_code: 'Q1',
              delivery_type: deliveryType,
              qr_address: qrAddress,
              items_detail: storeItems,
              status_qc_label: 'DONE',
              status_qc_packing: 'PENDING',
              status_qc_checker: 'PENDING',
              status_deliver: 'PENDING',
              updated_at: new Date().toISOString()
            });
          }
        });

        if (parsedRecords.length === 0) {
          throw new Error('Tidak ada format data matriks toko yang terbaca.');
        }

        // Upsert batch ke Supabase
        const { error } = await supabase
          .from('packing_tracking')
          .upsert(parsedRecords, { onConflict: 'tracking_id' });

        if (error) throw error;

        alert(`✅ Berhasil import ${parsedRecords.length} data label box toko!`);
        fetchPackingData();
      } catch (err) {
        alert('❌ Gagal Import Excel: ' + err.message);
      } finally {
        setIsImporting(false);
        e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const handlePrintLabel = (item) => {
    setSelectedLabelItem(item);
    setTimeout(() => {
      window.print();
    }, 300);
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
      const fileName = `bukti_paking_${cleanTrackingId}_${Date.now()}.jpg`;

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
          bukti_paking_url: publicUrl, 
          status_qc_packing: 'DONE',
          updated_at: new Date().toISOString() 
        })
        .eq('id', rowId);

      if (updateError) throw updateError;

      alert('✅ Bukti paking berhasil diunggah!');
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
      
      {/* HEADER RINGKASAN PROGRESS */}
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

      {/* TABEL DATA PAKING */}
      <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h3 className="text-sm font-black uppercase tracking-wider text-stone-700 dark:text-stone-300">
            📦 Detail Toko, Ceklis Cepat & Cetak Label Koli
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
              {isImporting ? '⏳ Mengimport...' : '📤 Import Excel Matriks'}
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleImportExcel}
                disabled={isImporting}
              />
            </label>
            <button 
              onClick={handleDownloadPackingReport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              📥 Download Report
            </button>
            <button 
              onClick={handleClearAllPackingData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              🗑️ Hapus Data
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`border-b ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-200 text-stone-500'}`}>
              <tr>
                <th className="py-3 px-4">Box</th>
                <th className="py-3 px-4">Nama Store / Project</th>
                <th className="py-3 px-4">Tracking ID</th>
                <th className="py-3 px-4 text-center">Aksi Label</th>
                <th className="py-3 px-4 text-center">Status Packing</th>
                <th className="py-3 px-4 text-center">Status Checker</th>
                <th className="py-3 px-4 text-center">Bukti Paking</th>
                <th className="py-3 px-4 text-center">Kamera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-neutral-700/50">
              {packingList.length === 0 ? (
                <tr><td colSpan="8" className="p-6 text-center opacity-60">Belum ada data paking. Silakan import file Excel terlebih dahulu.</td></tr>
              ) : (
                packingList.map(item => {
                  const isPackingDone = item.status_qc_packing === 'DONE';
                  const isCheckerDone = item.status_qc_checker === 'DONE';

                  return (
                    <tr key={item.id} className={`transition-colors ${isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50'}`}>
                      <td className="py-3 px-4 font-black text-indigo-500">{item.box_code || '-'}</td>
                      <td className="py-3 px-4 font-semibold">
                        <div>{item.store_name || '-'}</div>
                        <div className="text-[10px] text-stone-400 font-normal">{item.promo_title}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-emerald-500 font-bold">{item.tracking_id || '-'}</td>
                      
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handlePrintLabel(item)}
                          className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold rounded-xl text-[11px] transition-all shadow-sm active:scale-95"
                        >
                          🖨️ Cetak A4
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleToggleStatus(item.id, 'status_qc_packing', item.status_qc_packing)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 ${
                            isPackingDone 
                              ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                              : 'bg-stone-200 dark:bg-neutral-700 text-stone-600 dark:text-stone-300 hover:bg-stone-300'
                          }`}
                        >
                          {isPackingDone ? '✓ DONE' : '▢ PENDING'}
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
                          {isCheckerDone ? '✓ CHECKED' : '▢ PENDING'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {item.bukti_paking_url ? (
                          <div className="flex justify-center">
                            <img 
                              src={item.bukti_paking_url} 
                              alt="Bukti Paking" 
                              onClick={() => onOpenImageModal(item.bukti_paking_url, `Bukti Paking - ${item.tracking_id}`)}
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
                          {uploadingId === item.id ? '⏳' : '📸 Foto'}
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

      {/* TEMPLATE PRINT A4 KHUSUS LABEL MINISO */}
      {selectedLabelItem && (
        <div className="print-area hidden print:block">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
              body * {
                visibility: hidden;
              }
              .print-area, .print-area * {
                visibility: visible;
              }
              .print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
          `}</style>
          
          <div className="w-full font-sans text-black border-2 border-black bg-white">
            {/* Header Box Label */}
            <div className="grid grid-cols-12 border-b-2 border-black">
              <div className="col-span-2 border-r-2 border-black flex items-center justify-center font-black text-4xl text-red-600 p-2">
                {selectedLabelItem.box_code || 'B1'}
              </div>
              <div className="col-span-8 flex flex-col justify-between">
                <div className="text-center font-black text-lg py-1 border-b border-black tracking-tight">
                  {selectedLabelItem.client_pt}
                </div>
                <div className="grid grid-cols-12 text-xs border-b border-black">
                  <div className="col-span-3 px-2 py-1 font-bold">NOMOR TOKO</div>
                  <div className="col-span-1 text-center py-1">:</div>
                  <div className="col-span-3 px-2 py-1 font-black">{selectedLabelItem.recipient_name?.match(/\d+/)?.[0] || '-'}</div>
                  <div className={`col-span-3 text-center py-1 font-black text-white ${selectedLabelItem.delivery_type === 'DALAM KOTA' ? 'bg-red-600' : 'bg-blue-600'}`}>
                    {selectedLabelItem.delivery_type || 'DALAM KOTA'}
                  </div>
                  <div className="col-span-2 border-l border-black text-center py-1 font-black">
                    {selectedLabelItem.recipient_name?.match(/\((.*?)\)/)?.[1] || '-'}
                  </div>
                </div>
                <div className="grid grid-cols-12 text-xs border-b border-black">
                  <div className="col-span-3 px-2 py-1 font-bold">MINISO</div>
                  <div className="col-span-1 text-center py-1">:</div>
                  <div className="col-span-8 px-2 py-1 font-black truncate">{selectedLabelItem.store_name}</div>
                </div>
                <div className="text-center text-[10px] font-bold py-0.5 border-b border-black tracking-tight">
                  {selectedLabelItem.promo_title}
                </div>
                <div className="text-center text-[10px] font-black py-0.5">
                  {selectedLabelItem.no_spk}
                </div>
              </div>
              <div className="col-span-2 border-l-2 border-black flex flex-col items-center justify-center p-2 text-center">
                <QRCodeSVG value={selectedLabelItem.qr_address || selectedLabelItem.tracking_id} size={65} />
                <span className="font-black text-lg mt-1">{selectedLabelItem.area_code || 'Q1'}</span>
              </div>
            </div>

            {/* List Item Rows */}
            <div className="divide-y-2 divide-black">
              {(selectedLabelItem.items_detail && selectedLabelItem.items_detail.length > 0 ? selectedLabelItem.items_detail : [1, 2, 3, 4, 5, 6]).slice(0, 6).map((item, idx) => (
                <div key={idx} className="border-b border-black last:border-b-0">
                  <div className="flex justify-between border-b border-black text-[10px] font-bold px-2 py-0.5 bg-stone-100">
                    <span>{item.material || 'PVC'}</span>
                    <span>Ukuran : {item.size || '-'}</span>
                  </div>
                  <div className="grid grid-cols-12 min-h-[38mm] items-stretch">
                    <div className="col-span-5 border-r border-black p-2 flex flex-col justify-between">
                      <div className="text-xl font-black text-red-600 tracking-tight">
                        {item.code || '-'}
                      </div>
                      <div className="text-xs font-bold text-stone-800">
                        {item.desc || '-'}
                      </div>
                    </div>
                    <div className="col-span-2 border-r border-black flex flex-col items-center justify-center p-1 text-center">
                      <span className="text-3xl font-black">{item.qty || 0}</span>
                      <span className="text-xs font-bold text-stone-600">{item.unit || 'Pcs'}</span>
                    </div>
                    <div className="col-span-5 flex items-center justify-center p-1 overflow-hidden bg-stone-50">
                      {item.image_url ? (
                        <img src={item.image_url} alt="Preview" className="max-h-[34mm] object-contain" />
                      ) : (
                        <span className="text-[10px] text-stone-400 italic">Preview Desain</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}