import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function CustomLabelGenerator({ isDarkMode }) {
  const [destinations, setDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState('');
  const [templateType, setTemplateType] = useState('product_identity');
  
  const [batchLabels, setBatchLabels] = useState([]);
  
  const [form, setForm] = useState({
    po_project: 'BANNER', 
    periode: '16-Agu-26',
    channel: 'GT/MT/LSM/LMM/SPM/HPM/OT',
    qty_total: '100',     
    pcs_per_koli: '20',   
    unit: 'PCS',
    
    deliver_to: '',
    kota_region: '',
    pic_name: '',
    phone: '',
    region_city: '',

    transporter_dr: 'WAHANA - N-17779-2608-12',
    brand_name: 'NESTLÉ / PURINA',
    item_title: 'SHOPBLIND FRISKIES FELIX - PURINA ( UK 200 X 100 CM )',
    
    ops: '-',
    brand_cc: 'COCA - COLA',
    item_cc: 'AC 260 2MUKA LAM 2MUKA GLOSSY ( UK A4 )',
    qty_powerade: '20',
    qty_sprite: '20',

    imageUrl: '',
    imageUrl2: '', 
    logoLeftUrl: '', 
    logoRightUrl: '' 
  });

  const [printDataModal, setPrintDataModal] = useState(false);

  useEffect(() => {
    fetchDestinations();
    const savedLogoLeft = localStorage.getItem('custom_label_logo_left');
    const savedLogoRight = localStorage.getItem('custom_label_logo_right');
    if (savedLogoLeft || savedLogoRight) {
      setForm(prev => ({
        ...prev,
        logoLeftUrl: savedLogoLeft || prev.logoLeftUrl,
        logoRightUrl: savedLogoRight || prev.logoRightUrl
      }));
    }
  }, []);

  const fetchDestinations = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) {
      const cleanData = data.filter(d => d.client_name && !d.client_name.includes('Kolom'));
      setDestinations(cleanData);
    }
  };

  const handleDestChange = (e) => {
    const destId = e.target.value;
    setSelectedDest(destId);
    const found = destinations.find(d => String(d.id) === String(destId));
    if (found) {
      setForm(prev => ({
        ...prev,
        deliver_to: found.client_name || '',
        kota_region: found.address || '',
        pic_name: found.pic_name || found.client_name || '',
        phone: found.phone || '',
        region_city: found.hos_region ? `${found.hos_region} - ${found.address || ''}` : '-',
        ops: found.hos_region || '-'
      }));
    }
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        setForm(prev => ({ ...prev, [field]: result }));
        if (field === 'logoLeftUrl') localStorage.setItem('custom_label_logo_left', result);
        if (field === 'logoRightUrl') localStorage.setItem('custom_label_logo_right', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBatchExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

        // Ambil DR Number dari sel header atas (misal baris 0 kolom 1 -> rawData[0][1])
        let headerDrNo = '';
        for (let r = 0; r < Math.min(5, rawData.length); r++) {
          for (let c = 0; c < rawData[r].length; c++) {
            const cellVal = String(rawData[r][c] || '').trim();
            if (cellVal.toLowerCase() === 'dr' && rawData[r][c+1]) {
              headerDrNo = String(rawData[r][c+1]).trim();
              break;
            }
          }
          if (headerDrNo) break;
        }
        // Fallback jika tidak ketemu label 'dr', coba ambil baris 0 kolom 1
        if (!headerDrNo && rawData[0] && rawData[0][1]) {
          headerDrNo = String(rawData[0][1]).trim();
        }

        // Ambil Transporter dari file Excel
        let headerTransporter = 'PT Wahana Prestasi Logistik';
        for (let r = 0; r < Math.min(5, rawData.length); r++) {
          for (let c = 0; c < rawData[r].length; c++) {
            const cellVal = String(rawData[r][c] || '').trim();
            if (cellVal.toLowerCase() === 'transporter' && rawData[r][c+1]) {
              headerTransporter = String(rawData[r][c+1]).trim();
              break;
            }
          }
        }

        const combinedTransporterDr = `${headerTransporter} - ${headerDrNo}`.trim();

        const imported = [];
        rawData.slice(1).forEach((row) => {
          const city = row[1] ? String(row[1]).trim() : '';
          const clientName = row[5] ? String(row[5]).trim() : (row[2] ? String(row[2]).trim() : '');
          const address = row[7] ? String(row[7]).trim() : (row[4] ? String(row[4]).trim() : '');
          const phone = row[8] ? String(row[8]).trim() : (row[6] ? String(row[6]).trim() : '-');
          const picName = row[9] ? String(row[9]).trim() : clientName;
          const region = row[10] ? String(row[10]).trim() : '';
          
          const rawQtyStr = row[11] !== undefined ? String(row[11]) : (row[8] ? String(row[8]) : '1');
          const qtyParsed = parseInt(rawQtyStr.replace(/\D/g, '')) || 1;

          if (clientName && clientName.length > 2 && !clientName.toLowerCase().includes('unnamed') && !clientName.toLowerCase().includes('customer')) {
            imported.push({
              deliver_to: clientName,
              kota_region: address || 'Alamat menyusul',
              pic_name: picName,
              phone: phone,
              region_city: `${region} - ${city}`.trim() !== '-' ? `${region} - ${city}` : '-',
              item_name: form.item_title,
              custom_koli: qtyParsed,
              transporter_dr: combinedTransporterDr
            });
          }
        });

        if (imported.length > 0) {
          setBatchLabels(imported);
          alert(`✅ Berhasil memuat ${imported.length} tujuan & DR No (${headerDrNo}) dari Excel!`);
        } else {
          alert('⚠️ Format baris Excel tidak dikenali.');
        }
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const manualQty = parseInt(form.qty_total) || 1;
  const manualKoliCapacity = parseInt(form.pcs_per_koli) || 1;
  const manualTotalKoli = Math.ceil(manualQty / manualKoliCapacity);

  const totalKoli = batchLabels.length > 0 ? batchLabels.length : manualTotalKoli;

  const handleDirectPrint = () => {
    const printableHTML = document.getElementById('printable-area').innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Label Koli PMG</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print-page-full {
              width: 100%;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              page-break-after: always;
              break-after: page;
              margin: 0;
              padding: 5mm;
              box-sizing: border-box;
              background: white;
            }
            .no-print {
              display: none !important;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
          </style>
        </head>
        <body>
          <div>${printableHTML}</div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="font-black text-lg text-indigo-600 dark:text-indigo-400">🏷️ Generator Label Koli PMG</h2>
          <p className="text-xs opacity-60">Atur manual atau import file Excel untuk cetak label koli.</p>
        </div>
        <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm">
          📂 Import Excel Alokasi Label Massal
          <input type="file" accept=".xlsx, .xls" onChange={handleBatchExcelImport} className="hidden" />
        </label>
      </div>

      {batchLabels.length > 0 && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-300 font-bold">
          <span>✨ Mode Massal Aktif: {batchLabels.length} Label termuat dari file Excel.</span>
          <button onClick={() => setBatchLabels([])} className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px]">Reset ke Manual</button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-bold mb-1 opacity-70">Pilih Tujuan Klien (Database)</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={selectedDest}
            onChange={handleDestChange}
            disabled={batchLabels.length > 0}
          >
            <option value="">-- Pilih Tujuan Klien --</option>
            {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-bold mb-1 opacity-70">Pilih Template Label</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
          >
            <option value="product_identity">Product Identity (Gaya Nestlé / 1-2 Gambar)</option>
            <option value="hanging_poster">Hanging Poster (Gaya Coca-Cola)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="sm:col-span-1">
          <label className="block font-bold mb-1 text-indigo-500">Total Qty Keseluruhan (Manual)</label>
          <input 
            type="text"
            inputMode="numeric"
            value={form.qty_total}
            onChange={e => setForm({ ...form, qty_total: e.target.value.replace(/\D/g, '') })}
            className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-center text-base ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-stone-900'}`}
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block font-bold mb-1 opacity-70">Isi Per Koli (Pcs) (Manual)</label>
          <input 
            type="text"
            inputMode="numeric"
            value={form.pcs_per_koli}
            onChange={e => setForm({ ...form, pcs_per_koli: e.target.value.replace(/\D/g, '') })}
            className={`w-full p-3 border rounded-xl font-bold text-center text-base ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          />
        </div>
        <div className="sm:col-span-1 flex items-end">
          <div className="w-full p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center font-bold text-indigo-600 dark:text-indigo-400">
            📦 Total Halaman: {totalKoli} Label
          </div>
        </div>

        <div className="sm:col-span-3">
          <label className="block font-bold mb-1 opacity-70">Teks Header Kotak Hitam Bawah (Cth: BANNER / HANGING POSTER)</label>
          <input 
            type="text"
            value={form.po_project}
            onChange={e => setForm({ ...form, po_project: e.target.value })}
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
        <div>
          <label className="block font-bold mb-1 opacity-70">Logo Kiri (Opsional)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'logoLeftUrl')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
        <div>
          <label className="block font-bold mb-1 opacity-70">Logo Kanan (Brand)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'logoRightUrl')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
        <div>
          <label className="block font-bold mb-1 opacity-70">Foto Produk 1 (Kiri)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'imageUrl')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
        <div>
          <label className="block font-bold mb-1 opacity-70">Foto Produk 2 (Kanan)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'imageUrl2')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
      </div>

      <button 
        onClick={() => setPrintDataModal(true)}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs shadow-md"
      >
        👁️ Pratinjau & Cetak Semua Label Koli ({totalKoli} Halaman)
      </button>

      {printDataModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-5xl w-full p-6 space-y-6 shadow-2xl relative max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 no-print">
              <h3 className="font-bold text-sm uppercase text-blue-900">Pratinjau Koli Label (Total: {totalKoli} Halaman A4 Full)</h3>
              <div className="flex gap-2">
                <button onClick={handleDirectPrint} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs">🖨️ Cetak / Buka Pengaturan Printer</button>
                <button onClick={() => setPrintDataModal(false)} className="px-3 py-2 bg-stone-300 hover:bg-stone-400 font-bold rounded-xl text-xs">✕ Tutup</button>
              </div>
            </div>

            <div id="printable-area" className="space-y-8">
              {Array.from({ length: totalKoli }).map((_, koliIdx) => {
                const currentKoliNumber = koliIdx + 1;
                
                const targetDeliverTo = batchLabels.length > 0 ? batchLabels[koliIdx]?.deliver_to : (form.deliver_to || 'Belum diisi');
                const targetAddress = batchLabels.length > 0 ? batchLabels[koliIdx]?.kota_region : (form.kota_region || 'Alamat belum diisi');
                const targetPic = batchLabels.length > 0 ? batchLabels[koliIdx]?.pic_name : (form.pic_name || '-');
                const targetPhone = batchLabels.length > 0 ? batchLabels[koliIdx]?.phone : (form.phone || '-');
                const targetRegionCity = batchLabels.length > 0 ? batchLabels[koliIdx]?.region_city : (form.region_city || '-');
                const targetTransporterDr = batchLabels.length > 0 ? batchLabels[koliIdx]?.transporter_dr : form.transporter_dr;
                const targetOps = batchLabels.length > 0 ? batchLabels[koliIdx]?.hos_region : form.ops;

                const displayItemTitle = (batchLabels.length > 0 && batchLabels[koliIdx]?.item_name)
                  ? batchLabels[koliIdx].item_name
                  : form.item_title;

                const displayPcs = (batchLabels.length > 0 && batchLabels[koliIdx]?.custom_koli !== undefined) 
                  ? batchLabels[koliIdx].custom_koli 
                  : form.pcs_per_koli;

                const hasImg1 = !!form.imageUrl;
                const hasImg2 = !!form.imageUrl2;
                const isSingleImage = (hasImg1 && !hasImg2) || (!hasImg1 && hasImg2);
                const activeImg = hasImg1 ? form.imageUrl : form.imageUrl2;

                return (
                  <div key={koliIdx} className="print-page-full p-8 bg-white text-black font-sans text-sm border-2 border-dashed border-stone-400 rounded-2xl space-y-4 relative">
                    <div className="absolute top-3 right-4 font-bold text-indigo-600 text-xs bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 no-print">
                      Label Koli: {currentKoliNumber} of {totalKoli}
                    </div>

                    {templateType === 'product_identity' ? (
                      <div style={{ border: '3px solid #000', padding: '24px', width: '100%', maxWidth: '190mm', margin: '0 auto' }}>
                        {/* Header Logo & Title */}
                        <table style={{ width: '100%', borderBottom: '3px solid #000', paddingBottom: '12px', marginBottom: '14px' }}>
                          <tr>
                            <td style={{ width: '25%' }}>
                              {form.logoLeftUrl ? <img src={form.logoLeftUrl} alt="Logo" style={{ maxHeight: '65px', display: 'block' }} /> : null}
                            </td>
                            <td style={{ textAlign: 'center', width: '50%' }}><h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1.5px', fontWeight: '900' }}>PRODUCT IDENTITY</h1></td>
                            <td style={{ textAlign: 'right', width: '25%' }}>
                              {form.logoRightUrl ? <img src={form.logoRightUrl} alt="Brand Logo" style={{ maxHeight: '65px', marginLeft: 'auto', display: 'block' }} /> : <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{form.brand_name}</span>}
                            </td>
                          </tr>
                        </table>

                        {/* Tabel Informasi Utama (Diperbesar font dan paddingnya) */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', width: '32%' }}>Deliver to</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '14px' }}>: {targetDeliverTo}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>Alamat</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetAddress}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>PIC / Phone No.</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetPic} / {targetPhone}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>Region & City</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetRegionCity}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>PO NO, NAMA PROJECT</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {form.po_project}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>PERIODE PEMASANGAN</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {form.periode}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>CHANNEL</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {form.channel}</td></tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', background: '#eef2f7' }}>JUMLAH QTY & KOLI</td>
                            <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '16px', background: '#eef2f7' }}>
                              : {displayPcs} {form.unit} (Koli {currentKoliNumber} of {totalKoli})
                            </td>
                          </tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>TRANSPORTER – DR No</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>: {targetTransporterDr}</td></tr>
                        </table>

                        {/* Foto Produk */}
                        <table style={{ width: '100%', border: '1px solid #000', marginTop: '14px', background: '#fafafa' }}>
                          <tr>
                            {isSingleImage ? (
                              <td style={{ textAlign: 'center', padding: '16px', width: '100%' }}>
                                <img src={activeImg} alt="Produk" style={{ maxHeight: '220px', margin: 'auto', display: 'block' }} />
                              </td>
                            ) : (
                              <>
                                <td style={{ textAlign: 'center', padding: '12px', width: '50%', borderRight: '1px solid #000' }}>
                                  {form.imageUrl ? <img src={form.imageUrl} alt="Produk 1" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 1 ]</span>}
                                </td>
                                <td style={{ textAlign: 'center', padding: '12px', width: '50%' }}>
                                  {form.imageUrl2 ? <img src={form.imageUrl2} alt="Produk 2" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 2 ]</span>}
                                </td>
                              </>
                            )}
                          </tr>
                        </table>

                        {/* Kotak Bawah Pemecah Koli */}
                        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '14px', background: '#f2f2f2', padding: '10px', border: '1px solid #000', fontWeight: 'bold' }}>
                          <div>Koli {currentKoliNumber} of {totalKoli}</div>
                          <div style={{ fontSize: '13px', color: '#333', marginTop: '3px', fontWeight: 'normal' }}>
                            QTY : {displayPcs} {form.unit}
                          </div>
                        </div>

                        {/* Grand Total & Tanda Tangan */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '10px', fontSize: '11px' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'right', width: '80%', background: '#e6e6e6' }}>
                                Grand Total :
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '20%', background: '#e6e6e6', fontSize: '13px' }}>
                                {displayPcs}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '5px', fontSize: '10px' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Pengirim</td>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Penerima</td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Nama Lengkap Pengirim</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>NINING</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Nama Lengkap Penerima</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Tanda Tangan dan Stempel</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Tanda Tangan dan Stempel</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Tanggal</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Tanggal</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                            </tr>
                          </tbody>
                        </table>

                        <div style={{ fontSize: '9px', fontStyle: 'italic', marginTop: '4px' }}>
                          - Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
                        </div>

                      </div>
                    ) : (
                      <div style={{ border: '3px solid #000', padding: '24px', width: '100%', maxWidth: '190mm', margin: '0 auto' }}>
                        <table style={{ width: '100%', borderBottom: '3px solid #000', paddingBottom: '12px', marginBottom: '14px' }}>
                          <tr>
                            <td style={{ width: '25%' }}>
                              {form.logoLeftUrl ? <img src={form.logoLeftUrl} alt="Logo" style={{ maxHeight: '65px', display: 'block' }} /> : null}
                            </td>
                            <td style={{ textAlign: 'center', width: '50%' }}>
                              <h2 style={{ margin: 0, color: '#cc0000', fontSize: '22px', fontStyle: 'italic', fontWeight: 'bold' }}>Coca-Cola</h2>
                              <h1 style={{ margin: '6px 0 0 0', fontSize: '18px', background: '#000', color: '#fff', padding: '6px', fontWeight: 'bold' }}>{form.po_project}</h1>
                            </td>
                            <td style={{ textAlign: 'right', width: '25%' }}>
                              {form.logoRightUrl ? <img src={form.logoRightUrl} alt="Brand Logo" style={{ maxHeight: '65px', marginLeft: 'auto', display: 'block' }} /> : <span style={{ fontWeight: 'bold', fontSize: '15px' }}>COCA-COLA</span>}
                            </td>
                          </tr>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', width: '32%' }}>OPS</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetOps}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>Deliver to</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '14px' }}>: {targetDeliverTo}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>Address</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetAddress}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>PIC / Phone</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetPic} / {targetPhone}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>Region & City</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetRegionCity}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>TRANSPORTER – DR No</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>: {targetTransporterDr}</td></tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>Brand & Item</td>
                            <td style={{ border: '1px solid #000', padding: '9px' }}>
                              <div>COCA - COLA - {displayItemTitle}</div>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>QTY</td>
                            <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '16px' }}>
                              : {displayPcs} {form.unit}
                            </td>
                          </tr>
                        </table>

                        <table style={{ width: '100%', border: '1px solid #000', marginTop: '14px', background: '#fafafa' }}>
                          <tr>
                            {isSingleImage ? (
                              <td style={{ textAlign: 'center', padding: '16px', width: '100%' }}>
                                <img src={activeImg} alt="Produk" style={{ maxHeight: '220px', margin: 'auto', display: 'block' }} />
                              </td>
                            ) : (
                              <>
                                <td style={{ textAlign: 'center', padding: '12px', width: '50%', borderRight: '1px solid #000' }}>
                                  {form.imageUrl ? <img src={form.imageUrl} alt="Produk 1" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto 1 ]</span>}
                                </td>
                                <td style={{ textAlign: 'center', padding: '12px', width: '50%' }}>
                                  {form.imageUrl2 ? <img src={form.imageUrl2} alt="Produk 2" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto 2 ]</span>}
                                </td>
                              </>
                            )}
                          </tr>
                        </table>

                        {!isSingleImage && (
                          <div style={{ border: '1px solid #000', marginTop: '14px', background: '#ffffcc' }}>
                            <div style={{ background: '#000', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: '13px' }}>TOTAL QTY (Koli {currentKoliNumber} of {totalKoli})</div>
                            <table style={{ width: '100%', fontWeight: 'bold', fontSize: '14px', padding: '10px' }}>
                              <tr><td style={{ padding: '6px' }}>POWERADE</td><td style={{ textAlign: 'center' }}>=</td><td style={{ textAlign: 'right' }}>{form.qty_powerade} PCS</td></tr>
                              <tr><td style={{ padding: '6px', borderTop: '1px dashed #ccc' }}>SPRITE NIPIS MINT</td><td style={{ textAlign: 'center', borderTop: '1px dashed #ccc' }}>=</td><td style={{ textAlign: 'right' }}>{form.qty_sprite} PCS</td></tr>
                            </table>
                          </div>
                        )}

                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '10px', fontSize: '11px' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'right', width: '80%', background: '#e6e6e6' }}>
                                Grand Total :
                              </td>
                              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', textAlign: 'center', width: '20%', background: '#e6e6e6', fontSize: '13px' }}>
                                {displayPcs}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '5px', fontSize: '10px' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Pengirim</td>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Penerima</td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Nama Lengkap Pengirim</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>NINING</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Nama Lengkap Penerima</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Tanda Tangan dan Stempel</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Tanda Tangan dan Stempel</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Tanggal</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Tanggal</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                            </tr>
                          </tbody>
                        </table>

                        <div style={{ fontSize: '9px', fontStyle: 'italic', marginTop: '4px' }}>
                          - Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}