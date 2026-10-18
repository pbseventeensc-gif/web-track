import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { Upload, Printer, RotateCcw, Tag } from 'lucide-react';
import CustomDropdown from '../components/ui/CustomDropdown';

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

    transporter_dr: '',
    brand_name: '',
    item_title: '',
    
    ops: '-',
    brand_cc: '',
    item_cc: '',
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
        if (!headerDrNo && rawData[0] && rawData[0][1]) {
          headerDrNo = String(rawData[0][1]).trim();
        }

        let headerTransporter = '';
        for (let r = 0; r < Math.min(5, rawData.length); r++) {
          for (let c = 0; c < rawData[r].length; c++) {
            const cellVal = String(rawData[r][c] || '').trim();
            if (cellVal.toLowerCase() === 'transporter' && rawData[r][c+1]) {
              headerTransporter = String(rawData[r][c+1]).trim();
              break;
            }
          }
        }

        const combinedTransporterDr = (headerTransporter && headerDrNo)
          ? `${headerTransporter} - ${headerDrNo}`
          : (headerTransporter || headerDrNo || '');

        let headerDateRequired = '';
        for (let r = 0; r < Math.min(5, rawData.length); r++) {
          for (let c = 0; c < rawData[r].length; c++) {
            const cellVal = String(rawData[r][c] || '').trim();
            if (cellVal.toLowerCase().includes('date required')) {
              for (let offset = 1; offset <= 3; offset++) {
                if (rawData[r][c+offset] !== undefined && rawData[r][c+offset] !== '') {
                  headerDateRequired = String(rawData[r][c+offset]).trim();
                  break;
                }
              }
            }
          }
          if (headerDateRequired) break;
        }

        let formattedDate = headerDateRequired;
        if (formattedDate) {
          if (!isNaN(formattedDate) && (typeof formattedDate === 'number' || String(formattedDate).match(/^\d{5}$/))) {
            const serial = Number(formattedDate);
            const excelEpoch = new Date(Date.UTC(1899, 11, 30));
            const jsDate = new Date(excelEpoch.getTime() + serial * 86400000);
            const day = String(jsDate.getUTCDate()).padStart(2, '0');
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = monthNames[jsDate.getUTCMonth()];
            const year = String(jsDate.getUTCFullYear()).slice(-2);
            formattedDate = `${day}-${month}-${year}`;
          } else if (formattedDate.includes('-') && formattedDate.length >= 10) {
            const parts = formattedDate.split('-');
            if (parts.length === 3) {
              const y = parts[0];
              const mIndex = parseInt(parts[1], 10) - 1;
              const d = parts[2];
              const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
              if (monthNames[mIndex]) {
                formattedDate = `${d}-${monthNames[mIndex]}-${y.slice(-2)}`;
              }
            }
          }
        }

        if (formattedDate || combinedTransporterDr) {
          setForm(prev => ({
            ...prev,
            periode: formattedDate || prev.periode,
            channel: '',
            transporter_dr: combinedTransporterDr || prev.transporter_dr
          }));
        }

        const imported = [];
        rawData.forEach((row) => {
          const clientName = row[5] ? String(row[5]).trim() : '';

          if (clientName && clientName.length > 2 && !clientName.toLowerCase().includes('customer company name') && !clientName.toLowerCase().includes('customer') && !clientName.toLowerCase().includes('nama ccod')) {
            const city = row[1] ? String(row[1]).trim() : '';
            const address = row[7] ? String(row[7]).trim() : '';
            const phoneNum = row[8] ? String(row[8]).trim() : '-';
            const consigneeName = row[9] ? String(row[9]).trim() : '-';
            const region = row[10] ? String(row[10]).trim() : '';
            const rawQtyStr = row[11] !== undefined ? String(row[11]) : '1';
            const qtyParsed = parseInt(String(rawQtyStr).replace(/\D/g, '')) || 1;

            const regionCityCombined = [region, city].filter(Boolean).join(' - ') || city || '-';

            imported.push({
              deliver_to: clientName,
              kota_region: address || 'Alamat belum tersedia',
              pic_name: consigneeName,
              phone: phoneNum,
              hos_region: city,
              region_city: regionCityCombined,
              item_name: form.item_title,
              custom_koli: qtyParsed,
              transporter_dr: combinedTransporterDr
            });
          }
        });

        if (imported.length > 0) {
          setBatchLabels(imported);
          alert(`Berhasil memuat ${imported.length} tujuan pengiriman dan Nomor DR (${headerDrNo || '-'}).`);
        } else {
          alert('Format baris tidak dikenali atau data kosong.');
        }
      } catch (err) {
        alert('Gagal membaca berkas: ' + err.message);
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
          <title>Cetak Label Kolian PMG</title>
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
    <div className={`p-4 rounded-2xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Generator Label Kolian PMG
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Atur rincian secara manual atau impor berkas alokasi untuk mencetak label kolian.
          </p>
        </div>
        <label className="px-3 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold rounded-xl text-xs cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          Impor Alokasi & Label Massal
          <input type="file" accept=".xlsx, .xls" onChange={handleBatchExcelImport} className="hidden" />
        </label>
      </div>

      {batchLabels.length > 0 && (
        <div className="p-2.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
          <span>Mode Massal Aktif: {batchLabels.length} label tujuan siap dicetak.</span>
          <button onClick={() => setBatchLabels([])} className="px-2.5 py-1 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 rounded-lg text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            Kembalikan ke Manual
          </button>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Pilih Tujuan Klien (Basis Data)</label>
          <CustomDropdown 
            className="w-full"
            value={selectedDest}
            onChange={handleDestChange}
            disabled={batchLabels.length > 0}
          >
            <option value="">-- Pilih Tujuan Klien --</option>
            {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
          </CustomDropdown>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Pilih Templat Label</label>
          <CustomDropdown 
            className="w-full"
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
          >
            <option value="product_identity">Identitas Produk (Gaya Nestle / 1-2 Foto)</option>
            <option value="hanging_poster">Poster Gantung (Gaya Coca-Cola)</option>
          </CustomDropdown>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="sm:col-span-1">
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 truncate">Total Kuantitas (Manual)</label>
          <input 
            type="text"
            inputMode="numeric"
            value={form.qty_total}
            onChange={e => setForm({ ...form, qty_total: e.target.value.replace(/\D/g, '') })}
            className={`w-full p-2.5 border rounded-xl font-bold text-center text-xs h-[38px] ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-300 text-slate-900'}`}
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 truncate">Isi per Kolian (Pcs)</label>
          <input 
            type="text"
            inputMode="numeric"
            value={form.pcs_per_koli}
            onChange={e => setForm({ ...form, pcs_per_koli: e.target.value.replace(/\D/g, '') })}
            className={`w-full p-2.5 border rounded-xl font-bold text-center text-xs h-[38px] ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300 truncate">Total Halaman Cetak</label>
          <div className="w-full p-2.5 border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl text-center font-bold text-xs text-blue-700 dark:text-blue-300 h-[38px] flex items-center justify-center">
            Total: {totalKoli} Label
          </div>
        </div>

        <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Teks Judul / Proyek (contoh: BANNER)</label>
            <input
              type="text"
              value={form.po_project}
              onChange={e => setForm({ ...form, po_project: e.target.value })}
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Ekspedisi – Nomor DR (Manual)</label>
            <input
              type="text"
              value={form.transporter_dr}
              onChange={e => setForm({ ...form, transporter_dr: e.target.value })}
              placeholder="Contoh: WAHANA - N-17779-2608-12"
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nama Barang / Materi (Manual)</label>
            <input
              type="text"
              value={form.item_title}
              onChange={e => setForm({ ...form, item_title: e.target.value })}
              placeholder="Contoh: PROMO BANNER A4"
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1">
        <div className="flex flex-col gap-1">
          <label className="block font-semibold text-xs text-slate-700 dark:text-slate-300 truncate" title="Logo Kiri (Opsional)">
            Logo Kiri (Opsional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={e => handleImageUpload(e, 'logoLeftUrl')}
            className={`w-full p-2 border rounded-xl text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="block font-semibold text-xs text-slate-700 dark:text-slate-300 truncate" title="Logo Kanan (Merek)">
            Logo Kanan (Merek)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={e => handleImageUpload(e, 'logoRightUrl')}
            className={`w-full p-2 border rounded-xl text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="block font-semibold text-xs text-slate-700 dark:text-slate-300 truncate" title="Foto Produk 1 (Kiri)">
            Foto Produk 1 (Kiri)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={e => handleImageUpload(e, 'imageUrl')}
            className={`w-full p-2 border rounded-xl text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="block font-semibold text-xs text-slate-700 dark:text-slate-300 truncate" title="Foto Produk 2 (Kanan)">
            Foto Produk 2 (Kanan)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={e => handleImageUpload(e, 'imageUrl2')}
            className={`w-full p-2 border rounded-xl text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
          />
        </div>
      </div>

      <button 
        onClick={() => setPrintDataModal(true)}
        className="w-full py-2.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-bold rounded-xl active:scale-95 transition-all text-xs shadow-2xs cursor-pointer flex items-center justify-center gap-2"
      >
        <Printer className="w-4 h-4" />
        Pratinjau & Cetak Semua Label Kolian ({totalKoli} Halaman)
      </button>

      {printDataModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-5xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 relative max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 no-print">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900">Pratinjau Label Kolian (Total: {totalKoli} Halaman A4)</h3>
              <div className="flex gap-2">
                <button onClick={handleDirectPrint} className="px-4 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 font-semibold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  Cetak / Pengaturan Printer
                </button>
                <button onClick={() => setPrintDataModal(false)} className="px-3.5 py-2 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 font-semibold rounded-xl text-xs cursor-pointer">
                  Tutup
                </button>
              </div>
            </div>

            <div id="printable-area" className="space-y-8">
              {Array.from({ length: totalKoli }).map((_, koliIdx) => {
                const currentKoliNumber = koliIdx + 1;
                
                const targetDeliverTo = batchLabels.length > 0 ? batchLabels[koliIdx]?.deliver_to : (form.deliver_to || 'Belum ditentukan');
                const targetAddress = batchLabels.length > 0 ? batchLabels[koliIdx]?.kota_region : (form.kota_region || 'Alamat belum ditentukan');
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
                  <div key={koliIdx} className="print-page-full p-8 bg-white text-black font-sans text-sm border-2 border-dashed border-slate-300 rounded-2xl space-y-4 relative">
                    <div className="absolute top-3 right-4 font-semibold text-slate-700 text-xs bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/80 no-print">
                      Label Kolian: {currentKoliNumber} dari {totalKoli}
                    </div>

                    {templateType === 'product_identity' ? (
                      <div style={{ border: '3px solid #000', padding: '24px', width: '100%', maxWidth: '190mm', margin: '0 auto' }}>
                        {/* Header Logo & Title */}
                        <table style={{ width: '100%', borderBottom: '3px solid #000', paddingBottom: '12px', marginBottom: '14px' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '25%' }}>
                                {form.logoLeftUrl ? <img src={form.logoLeftUrl} alt="Logo" style={{ maxHeight: '65px', display: 'block' }} /> : null}
                              </td>
                              <td style={{ textAlign: 'center', width: '50%' }}><h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '1.5px', fontWeight: '900' }}>PRODUCT IDENTITY</h1></td>
                              <td style={{ textAlign: 'right', width: '25%' }}>
                                {form.logoRightUrl ? <img src={form.logoRightUrl} alt="Brand Logo" style={{ maxHeight: '65px', marginLeft: 'auto', display: 'block' }} /> : <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{form.brand_name}</span>}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Info Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <tbody>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', width: '32%' }}>Deliver to</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '14px' }}>: {targetDeliverTo}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>Address</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetAddress}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>PIC / Phone No.</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetPic} / {targetPhone}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>Region & City</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetRegionCity}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>PO NO, PROJECT NAME</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {form.po_project}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>INSTALLATION PERIOD</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {form.periode}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>CHANNEL</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {form.channel}</td></tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', background: '#eef2f7' }}>TOTAL QTY & BOX</td>
                              <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '16px', background: '#eef2f7' }}>
                                : {displayPcs} {form.unit} (Box {currentKoliNumber} of {totalKoli})
                              </td>
                            </tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>TRANSPORTER – DR No</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>: {targetTransporterDr}</td></tr>
                          </tbody>
                        </table>

                        {/* Product Photo */}
                        <table style={{ width: '100%', border: '1px solid #000', marginTop: '14px', background: '#fafafa' }}>
                          <tbody>
                            <tr>
                              {isSingleImage ? (
                                <td style={{ textAlign: 'center', padding: '16px', width: '100%' }}>
                                  <img src={activeImg} alt="Product" style={{ maxHeight: '220px', margin: 'auto', display: 'block' }} />
                                </td>
                              ) : (
                                <>
                                  <td style={{ textAlign: 'center', padding: '12px', width: '50%', borderRight: '1px solid #000' }}>
                                    {form.imageUrl ? <img src={form.imageUrl} alt="Product 1" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 1 ]</span>}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '12px', width: '50%' }}>
                                    {form.imageUrl2 ? <img src={form.imageUrl2} alt="Product 2" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 2 ]</span>}
                                  </td>
                                </>
                              )}
                            </tr>
                          </tbody>
                        </table>

                        {/* Box info banner */}
                        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '14px', background: '#f2f2f2', padding: '10px', border: '1px solid #000', fontWeight: 'bold' }}>
                          <div>Box {currentKoliNumber} of {totalKoli}</div>
                          <div style={{ fontSize: '13px', color: '#333', marginTop: '3px', fontWeight: 'normal' }}>
                            QTY : {displayPcs} {form.unit}
                          </div>
                        </div>

                        {/* Grand Total & Signatures */}
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
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Sender</td>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Recipient</td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Sender Full Name</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>NINING</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Recipient Full Name</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Signature and Stamp</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Signature and Stamp</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Date</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Date</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                            </tr>
                          </tbody>
                        </table>

                        <div style={{ fontSize: '9px', fontStyle: 'italic', marginTop: '4px' }}>
                          - Claim period for missing or damaged items is strictly 7 days from receipt.
                        </div>

                      </div>
                    ) : (
                      <div style={{ border: '3px solid #000', padding: '24px', width: '100%', maxWidth: '190mm', margin: '0 auto' }}>
                        <table style={{ width: '100%', borderBottom: '3px solid #000', paddingBottom: '12px', marginBottom: '14px' }}>
                          <tbody>
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
                          </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <tbody>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', width: '32%' }}>OPS</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetOps}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>Deliver to</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '14px' }}>: {targetDeliverTo}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>Address</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetAddress}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>PIC / Phone</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetPic} / {targetPhone}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>Region & City</td><td style={{ border: '1px solid #000', padding: '9px' }}>: {targetRegionCity}</td></tr>
                            <tr><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>TRANSPORTER – DR No</td><td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold' }}>: {targetTransporterDr || '-'}</td></tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>Brand & Item</td>
                              <td style={{ border: '1px solid #000', padding: '9px' }}>
                                : {displayItemTitle || '-'}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', verticalAlign: 'top' }}>QTY</td>
                              <td style={{ border: '1px solid #000', padding: '9px', fontWeight: 'bold', fontSize: '16px' }}>
                                : {displayPcs} {form.unit}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table style={{ width: '100%', border: '1px solid #000', marginTop: '14px', background: '#fafafa' }}>
                          <tbody>
                            <tr>
                              {isSingleImage ? (
                                <td style={{ textAlign: 'center', padding: '16px', width: '100%' }}>
                                  <img src={activeImg} alt="Product" style={{ maxHeight: '220px', margin: 'auto', display: 'block' }} />
                                </td>
                              ) : (
                                <>
                                  <td style={{ textAlign: 'center', padding: '12px', width: '50%', borderRight: '1px solid #000' }}>
                                    {form.imageUrl ? <img src={form.imageUrl} alt="Product 1" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 1 ]</span>}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '12px', width: '50%' }}>
                                    {form.imageUrl2 ? <img src={form.imageUrl2} alt="Product 2" style={{ maxHeight: '200px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 2 ]</span>}
                                  </td>
                                </>
                              )}
                            </tr>
                          </tbody>
                        </table>

                        {!isSingleImage && (
                          <div style={{ border: '1px solid #000', marginTop: '14px', background: '#ffffcc' }}>
                            <div style={{ background: '#000', color: '#fff', padding: '6px 12px', fontWeight: 'bold', fontSize: '13px' }}>TOTAL QTY (Box {currentKoliNumber} of {totalKoli})</div>
                            <table style={{ width: '100%', fontWeight: 'bold', fontSize: '14px', padding: '10px' }}>
                              <tbody>
                                <tr><td style={{ padding: '6px' }}>POWERADE</td><td style={{ textAlign: 'center' }}>=</td><td style={{ textAlign: 'right' }}>{form.qty_powerade} PCS</td></tr>
                                <tr><td style={{ padding: '6px', borderTop: '1px dashed #ccc' }}>SPRITE NIPIS MINT</td><td style={{ textAlign: 'center', borderTop: '1px dashed #ccc' }}>=</td><td style={{ textAlign: 'right' }}>{form.qty_sprite} PCS</td></tr>
                              </tbody>
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
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Sender</td>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Recipient</td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Sender Full Name</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>NINING</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}>Recipient Full Name</td>
                              <td style={{ border: '1px solid #000', padding: '5px', width: '25%' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Signature and Stamp</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}>Signature and Stamp</td>
                              <td style={{ border: '1px solid #000', padding: '18px 5px' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Date</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}>Date</td>
                              <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                            </tr>
                          </tbody>
                        </table>

                        <div style={{ fontSize: '9px', fontStyle: 'italic', marginTop: '4px' }}>
                          - Claim period for missing or damaged items is strictly 7 days from receipt.
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