import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';

export default function PackingPanel({ isDarkMode, onOpenImageModal }) {
  const [packingList, setPackingList] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [selectedLabelItem, setSelectedLabelItem] = useState(null);
  const [isBatchPrinting, setIsBatchPrinting] = useState(false);

  // Modal Custom Image Override per Toko
  const [editingRowItem, setEditingRowItem] = useState(null);

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
      .order('id', { ascending: true });

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

  // Helper pembersih kode string
  const cleanKey = (str) => {
    if (!str) return '';
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Convert File ke Base64 Data URL
  const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Parser Excel Matriks
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

          const rowCodes = data[1] || [];
          const rowDescs = data[2] || [];
          const rowMaterials = data[3] || [];
          const rowSizes = data[4] || [];

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

          for (let r = 6; r < data.length; r++) {
            const row = data[r];
            if (!row || !row[1]) continue;

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
                  unit: 'Pcs',
                  image_url: ''
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
          throw new Error('Tidak ada data matriks toko yang terbaca.');
        }

        const { error } = await supabase
          .from('packing_tracking')
          .upsert(parsedRecords, { onConflict: 'tracking_id' });

        if (error) throw error;

        alert(`✅ Berhasil import ${parsedRecords.length} data box toko!`);
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

  // Upload Foto Desain (Smart Matching: Kode + Ukuran)
  const handleBulkUploadDesignImages = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      let imageList = [];

      for (const file of files) {
        const rawFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const normalizedKey = cleanKey(rawFileName);
        const base64Data = await readFileAsBase64(file);
        imageList.push({ rawKey: normalizedKey, data: base64Data });
      }

      const { data: currentRows, error: fetchErr } = await supabase
        .from('packing_tracking')
        .select('id, items_detail');

      if (fetchErr) throw fetchErr;

      for (const row of currentRows || []) {
        if (row.items_detail && Array.isArray(row.items_detail)) {
          let hasChange = false;
          const newDetails = row.items_detail.map((item) => {
            const itemCodeClean = cleanKey(item.code);
            const itemCombinedClean = cleanKey(`${item.code}${item.size}`);

            // Prioritas 1: Kecocokan Kode + Ukuran spesifik
            let matched = imageList.find(img => img.rawKey === itemCombinedClean || itemCombinedClean.includes(img.rawKey));
            
            // Prioritas 2: Kecocokan Kode Item saja
            if (!matched) {
              matched = imageList.find(img => img.rawKey === itemCodeClean || itemCodeClean.includes(img.rawKey) || img.rawKey.includes(itemCodeClean));
            }

            if (matched) {
              hasChange = true;
              return { ...item, image_url: matched.data };
            }
            return item;
          });

          if (hasChange) {
            await supabase
              .from('packing_tracking')
              .update({ items_detail: newDetails, updated_at: new Date().toISOString() })
              .eq('id', row.id);
          }
        }
      }

      alert(`✅ Berhasil menyematkan ${files.length} foto desain dengan pencocokan Kode + Ukuran!`);
      fetchPackingData();
    } catch (err) {
      alert('❌ Gagal upload foto desain: ' + err.message);
    } finally {
      setIsUploadingImages(false);
      e.target.value = '';
    }
  };

  // Override / Ganti Foto Satuan untuk 1 Item di Toko Tertentu
  const handleSingleImageOverride = async (rowId, itemIndex, file) => {
    if (!file) return;
    try {
      const base64Data = await readFileAsBase64(file);
      const targetRow = packingList.find(p => p.id === rowId);
      if (!targetRow || !targetRow.items_detail) return;

      const updatedItems = [...targetRow.items_detail];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], image_url: base64Data };

      const { error } = await supabase
        .from('packing_tracking')
        .update({ items_detail: updatedItems, updated_at: new Date().toISOString() })
        .eq('id', rowId);

      if (error) throw error;

      alert('✅ Foto item toko berhasil diperbarui!');
      fetchPackingData();
      if (editingRowItem) {
        setEditingRowItem(prev => ({ ...prev, items_detail: updatedItems }));
      }
    } catch (err) {
      alert('❌ Gagal mengubah gambar: ' + err.message);
    }
  };

  // Trigger Cetak 1 Label Saja
  const handlePrintLabel = (item) => {
    setIsBatchPrinting(false);
    setSelectedLabelItem(item);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Trigger Cetak SEMUA Label Sekaligus (Batch Print)
  const handleBatchPrintAll = () => {
    if (packingList.length === 0) {
      return alert('⚠️ Tidak ada data label yang dapat dicetak.');
    }
    setIsBatchPrinting(true);
    setSelectedLabelItem(null);
    setTimeout(() => {
      window.print();
    }, 400);
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

  // Komponen Label Satuan A4
  const renderSingleLabelSheet = (item) => (
    <div className="label-page" style={{ width: '195mm', height: '270mm', border: '2px solid #000', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff', overflow: 'hidden', pageBreakAfter: 'always', margin: '0 auto 10mm auto' }}>
      
      {/* Header Box Label */}
      <div style={{ height: '36mm', display: 'grid', gridTemplateColumns: '30mm 1fr 28mm', borderBottom: '2px solid #000', boxSizing: 'border-box' }}>
        <div style={{ borderRight: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '900', color: '#dc2626' }}>
          {item.box_code || 'B1'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '2px solid #000' }}>
          <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '13px', borderBottom: '1px solid #000', padding: '2px 0', textTransform: 'uppercase', letterSpacing: '-0.3px' }}>
            {item.client_pt}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '26mm 4mm 16mm 26mm 1fr', fontSize: '10px', borderBottom: '1px solid #000', height: '6mm', alignItems: 'center' }}>
            <div style={{ paddingLeft: '4px', fontWeight: 'bold' }}>NOMOR TOKO</div>
            <div style={{ textAlign: 'center' }}>:</div>
            <div style={{ fontWeight: '900', textAlign: 'center' }}>{item.recipient_name?.match(/\d+/)?.[0] || '-'}</div>
            <div style={{ textAlign: 'center', fontWeight: '900', color: '#fff', background: item.delivery_type === 'DALAM KOTA' ? '#dc2626' : '#2563eb', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>
              {item.delivery_type || 'DALAM KOTA'}
            </div>
            <div style={{ borderLeft: '1px solid #000', textAlign: 'center', fontWeight: '900', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.recipient_name?.match(/\((.*?)\)/)?.[1] || '-'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '26mm 4mm 1fr', fontSize: '10px', borderBottom: '1px solid #000', height: '6mm', alignItems: 'center' }}>
            <div style={{ paddingLeft: '4px', fontWeight: 'bold' }}>MINISO</div>
            <div style={{ textAlign: 'center' }}>:</div>
            <div style={{ fontWeight: '900', paddingLeft: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.store_name}
            </div>
          </div>

          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '9px', borderBottom: '1px solid #000', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '1px 0' }}>
            {item.promo_title}
          </div>

          <div style={{ textAlign: 'center', fontWeight: '900', fontSize: '9px', padding: '1px 0' }}>
            {item.no_spk}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
          <QRCodeSVG value={item.qr_address || item.tracking_id} size={42} />
          <span style={{ fontWeight: '900', fontSize: '13px', marginTop: '1px' }}>{item.area_code || 'Q1'}</span>
        </div>
      </div>

      {/* List 6 Item Rows */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {(item.items_detail && item.items_detail.length > 0 
          ? [...item.items_detail, ...Array(Math.max(0, 6 - item.items_detail.length)).fill({})]
          : Array(6).fill({})
        ).slice(0, 6).map((sub, idx) => (
          <div key={idx} style={{ height: '38.5mm', borderBottom: idx === 5 ? 'none' : '2px solid #000', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            
            <div style={{ height: '5mm', borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px', background: '#f5f5f5', fontSize: '9px', fontWeight: 'bold' }}>
              <span>{sub.material || (sub.code ? 'PVC' : '')}</span>
              <span>{sub.size ? `Ukuran : ${sub.size}` : ''}</span>
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '70mm 25mm 1fr', alignItems: 'stretch' }}>
              
              <div style={{ borderRight: '1px solid #000', padding: '4px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#dc2626', letterSpacing: '-0.3px', lineHeight: 1.1 }}>
                  {sub.code || ''}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#262626', lineHeight: 1.1 }}>
                  {sub.desc || ''}
                </div>
              </div>

              <div style={{ borderRight: '1px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}>
                <span style={{ fontSize: '24px', fontWeight: '900', lineHeight: 1 }}>
                  {sub.qty || (sub.code ? 0 : '')}
                </span>
                {sub.code && <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#525252' }}>{sub.unit || 'Pcs'}</span>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px', background: '#fafafa', overflow: 'hidden' }}>
                {sub.image_url ? (
                  <img src={sub.image_url} alt="Preview" style={{ maxHeight: '30mm', maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                  sub.code && (
                    <div style={{ width: '100%', height: '100%', background: '#bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#6b7280', fontStyle: 'italic' }}>
                      Preview Desain
                    </div>
                  )
                )}
              </div>

            </div>
          </div>
        ))}
      </div>

    </div>
  );

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

      {/* TABEL DATA PAKING & ACTION TOOLBAR */}
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

            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95">
              {isUploadingImages ? '⏳ Menyimpan Foto...' : '🖼️ Upload Foto Desain (Smart Match)'}
              <input 
                type="file" 
                accept="image/*" 
                multiple
                className="hidden" 
                onChange={handleBulkUploadDesignImages}
                disabled={isUploadingImages}
              />
            </label>

            {/* TOMBOL CETAK SEMUA LABEL SEKALIGUS */}
            <button 
              onClick={handleBatchPrintAll}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              🖨️ Cetak Semua Label (Batch)
            </button>

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
                <th className="py-3 px-4 text-center">Label & Desain</th>
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
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handlePrintLabel(item)}
                            className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 font-bold rounded-xl text-[11px] transition-all shadow-sm active:scale-95"
                            title="Cetak label A4 khusus toko ini"
                          >
                            🖨️ Cetak
                          </button>
                          <button
                            onClick={() => setEditingRowItem(item)}
                            className="px-2 py-1.5 bg-stone-200 hover:bg-stone-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-stone-700 dark:text-stone-200 font-bold rounded-xl text-[11px] transition-all active:scale-95"
                            title="Edit / Ganti Foto Satuan untuk toko ini"
                          >
                            ✏️ Foto
                          </button>
                        </div>
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

      {/* MODAL MANUAL EDIT / OVERRIDE FOTO PER TOKO */}
      {editingRowItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 overflow-y-auto shadow-2xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-900'}`}>
            <div className="flex justify-between items-center mb-4 border-b pb-3 dark:border-neutral-700">
              <div>
                <h3 className="font-black text-base uppercase">Kelola Foto Desain Toko</h3>
                <p className="text-xs text-stone-400 font-bold">{editingRowItem.store_name} ({editingRowItem.box_code})</p>
              </div>
              <button 
                onClick={() => setEditingRowItem(null)}
                className="w-8 h-8 rounded-full bg-stone-100 dark:bg-neutral-700 flex items-center justify-center font-bold text-stone-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {editingRowItem.items_detail && editingRowItem.items_detail.map((itm, i) => (
                <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${isDarkMode ? 'bg-neutral-700/40 border-neutral-600' : 'bg-stone-50 border-stone-200'}`}>
                  <div className="flex-1">
                    <div className="font-black text-sm text-red-500">{itm.code}</div>
                    <div className="text-xs font-semibold">{itm.desc}</div>
                    <div className="text-[11px] text-stone-400 font-mono">Ukuran: {itm.size} | Qty: {itm.qty} Pcs</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {itm.image_url ? (
                      <img src={itm.image_url} alt="Item" className="w-16 h-10 object-contain rounded-lg border bg-white" />
                    ) : (
                      <div className="w-16 h-10 rounded-lg bg-stone-200 dark:bg-neutral-600 flex items-center justify-center text-[9px] text-stone-400 italic">No Foto</div>
                    )}
                    <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs cursor-pointer active:scale-95">
                      Ganti Foto
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleSingleImageOverride(editingRowItem.id, i, e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE PRINT A4 (DUKUNG SINGLE CETAK & BATCH CETAK SEMUA TOKO) */}
      <div className="print-area hidden print:block">
        <style>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 5mm !important;
            }
            html, body {
              width: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * {
              visibility: hidden !important;
            }
            .print-area, .print-area * {
              visibility: visible !important;
            }
            .print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 auto !important;
            }
            .label-page {
              page-break-after: always !important;
              page-break-inside: avoid !important;
              break-after: page !important;
            }
          }
        `}</style>

        {isBatchPrinting ? (
          packingList.map((item) => <React.Fragment key={item.id}>{renderSingleLabelSheet(item)}</React.Fragment>)
        ) : (
          selectedLabelItem && renderSingleLabelSheet(selectedLabelItem)
        )}
      </div>

    </div>
  );
}