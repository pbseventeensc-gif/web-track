import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Tag,
  Printer,
  FileText,
  PlusCircle,
  Unlock,
  Building2,
  Check,
  X
} from 'lucide-react';
import CustomDropdown from '../ui/CustomDropdown';

export default function KawanLamaMultiLabelGenerator({ isDarkMode }) {
  const [labels, setLabels] = useState({});
  const [selectedPt, setSelectedPt] = useState('PT HOME CENTER INDONESIA RETAIL');
  const [isManualCompany, setIsManualCompany] = useState(false);
  const [manualCompanyName, setManualCompanyName] = useState('');
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  
  const [companyList, setCompanyList] = useState(() => {
    const saved = localStorage.getItem('kawanlama_company_list');
    return saved ? JSON.parse(saved) : [
      'PT HOME CENTER INDONESIA RETAIL',
      'PT KRISBOW INDONESIA',
      'PT INFORMA RETAIL',
      'PT LIVING PLAZA',
      'PT GINDACO INDONESIA'
    ];
  });

  const getTodayFormattedDate = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  };

  // Helper ekstraksi nilai No WPP dari item Excel (pencarian fleksibel)
  const getWppFromItem = (item) => {
    if (!item || typeof item !== 'object') return '';
    for (const key of Object.keys(item)) {
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        cleanKey === 'nowpp' ||
        cleanKey === 'wpp' ||
        cleanKey.includes('wpp') ||
        cleanKey === 'spkwpp' ||
        cleanKey === 'inv' ||
        cleanKey === 'noinv'
      ) {
        const val = item[key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
    return '';
  };

  const formatWppText = (val) => {
    if (!val) return '';
    const trimmed = String(val).trim();
    if (trimmed.toUpperCase().includes('WPP')) return trimmed;
    return `WPP ${trimmed}`;
  };

  const [activePromoTitle, setActivePromoTitle] = useState('PROMO 17 AGUSTUS ( TES )');
  const [spkNumber, setSpkNumber] = useState('SJ-05031');
  const [defaultWppNumber, setDefaultWppNumber] = useState('');
  const [senderName, setSenderName] = useState('Arini Lidya');
  const [printMode, setPrintMode] = useState('labels'); // 'labels' atau 'do'
  
  // Logo Wellen terkunci di localStorage
  const [wellenPrintLogo, setWellenPrintLogo] = useState(() => {
    return localStorage.getItem('wellen_print_logo_kawanlama') || null;
  });

  useEffect(() => {
    localStorage.setItem('kawanlama_company_list', JSON.stringify(companyList));
    if (wellenPrintLogo) {
      localStorage.setItem('wellen_print_logo_kawanlama', wellenPrintLogo);
    }
  }, [companyList, wellenPrintLogo]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Otomatis ekstrak kode SPK/DO dari nama berkas jika ada
    const fileName = file.name || '';
    const matchedCode = fileName.match(/\d{4,5}/);
    if (matchedCode) {
      setSpkNumber(`SJ-${matchedCode[0]}`);
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);

      // Auto-detect No WPP dari data Excel jika ada
      const firstWpp = data.reduce((found, curr) => {
        if (found) return found;
        return getWppFromItem(curr);
      }, '');
      if (firstWpp) {
        setDefaultWppNumber(formatWppText(firstWpp));
      }

      const grouped = data.reduce((acc, curr) => {
        const store = curr.Store || curr.Region || 'Wilayah Tidak Diketahui';
        if (!acc[store]) acc[store] = [];
        acc[store].push(curr);
        return acc;
      }, {});
      setLabels(grouped);
    };
    reader.readAsBinaryString(file);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setWellenPrintLogo(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetLogo = () => {
    if (confirm('Buka kunci dan hapus logo Wellen yang tersimpan?')) {
      setWellenPrintLogo(null);
      localStorage.removeItem('wellen_print_logo_kawanlama');
    }
  };

  const handleAddCompany = (e) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    const formatted = newCompanyName.trim().toUpperCase();
    if (!companyList.includes(formatted)) {
      const updated = [...companyList, formatted];
      setCompanyList(updated);
      setSelectedPt(formatted);
      setNewCompanyName('');
      setShowAddCompanyModal(false);
      alert(`Perusahaan "${formatted}" berhasil ditambahkan ke dalam daftar.`);
    } else {
      alert('Nama perusahaan tersebut sudah terdaftar.');
    }
  };

  const storeKeys = Object.keys(labels);
  const totalRegions = storeKeys.length;

  const currentDateStr = new Date().toLocaleString('en-GB', { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  }).replace(',', '');

  const activeClientName = isManualCompany ? manualCompanyName : selectedPt;

  // Fungsi Cetak Berdedikasi (A4 Landscape Standalone Window)
  const handlePrint = () => {
    if (totalRegions === 0) return;

    if (printMode === 'labels') {
      let pagesHTML = '';
      storeKeys.forEach((storeName, storeIdx) => {
        const absoluteIndex = storeIdx + 1;
        const storeItems = labels[storeName] || [];

        let tableRowsHTML = '';
        storeItems.forEach((item, i) => {
          tableRowsHTML += `
            <tr style="border-bottom: 1px solid #000;">
              <td style="border-right: 2px solid #000; padding: 6px; text-align: center; font-weight: bold; font-size: 13px;">${i + 1}</td>
              <td style="border-right: 2px solid #000; padding: 6px 10px; text-align: left; font-weight: 800; font-size: 13px; text-transform: uppercase;">${item.Item || ''}</td>
              <td style="border-right: 2px solid #000; padding: 6px; text-align: center; font-weight: bold; font-size: 12px;">${item.Bahan || '-'}</td>
              <td style="border-right: 2px solid #000; padding: 6px; text-align: center; font-weight: bold; font-size: 12px; font-family: monospace;">${item.Ukuran || '-'}</td>
              <td style="padding: 6px; text-align: center; font-weight: 900; font-size: 13px; font-family: monospace;">${item.Qty || 0} PCS</td>
            </tr>
          `;
        });

        const logoImgHTML = wellenPrintLogo
          ? `<img src="${wellenPrintLogo}" style="height: 48px; width: auto; object-fit: contain;" />`
          : `<div style="font-size: 11px; border: 2px solid #000; padding: 4px; font-style: italic; font-weight: bold;">[Logo]</div>`;

        pagesHTML += `
          <div class="page-break" style="width: 275mm; max-width: 275mm; height: 185mm; max-height: 185mm; border: 2px solid #000; border-radius: 14px; padding: 16px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-start; overflow: hidden; background: #fff; margin: 0 auto; page-break-after: always; break-after: page; position: relative;">

            <div style="position: absolute; top: 16px; right: 16px; background: #f3f4f6; border: 2px solid #000; padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 800; color: #000;">
              ${absoluteIndex} OF ${totalRegions}
            </div>

            <div style="display: flex; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; padding-right: 100px;">
              <div style="height: 48px; min-width: 140px; display: flex; align-items: center;">${logoImgHTML}</div>
              <div style="flex: 1; text-align: center;">
                <h1 style="margin: 0; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #000;">${activeClientName}</h1>
                <p style="margin: 3px 0 0 0; font-size: 13px; font-weight: 800; text-transform: uppercase; color: #000;">
                  ${activePromoTitle} (${spkNumber})
                </p>
              </div>
            </div>

            <div style="margin-bottom: 12px; font-weight: 800; font-size: 15px; color: #000;">
              STORE / REGION : ${storeName}
            </div>

            <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; table-layout: fixed; font-size: 13px; color: #000;">
              <thead>
                <tr style="background: #f3f4f6; border-bottom: 2px solid #000; font-weight: 800;">
                  <th style="border-right: 2px solid #000; padding: 8px; width: 6%; text-align: center;">NO</th>
                  <th style="border-right: 2px solid #000; padding: 8px; width: 38%; text-align: left;">ITEM</th>
                  <th style="border-right: 2px solid #000; padding: 8px; width: 34%; text-align: center;">BAHAN</th>
                  <th style="border-right: 2px solid #000; padding: 8px; width: 14%; text-align: center;">UKURAN</th>
                  <th style="padding: 8px; width: 8%; text-align: center;">QTY</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHTML}
              </tbody>
            </table>
          </div>
        `;
      });

      const printWin = window.open('', '_blank', 'width=1100,height=850');
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cetak Label Cabang (${totalRegions} Cabang)</title>
            <style>
              @page {
                size: A4 landscape;
                margin: 5mm;
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
              .page-break {
                page-break-after: always;
                break-after: page;
                page-break-inside: avoid;
                break-inside: avoid;
              }
            </style>
          </head>
          <body>
            <div>${pagesHTML}</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 250);
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      // Print Surat Jalan (DO)
      let doPagesHTML = '';
      storeKeys.forEach((storeName, storeIdx) => {
        const storeItems = labels[storeName] || [];
        const totalQty = storeItems.reduce((sum, item) => sum + (Number(item.Qty) || 0), 0);
        const storeSeq = String(storeIdx + 1).padStart(3, '0');
        const customNoDo = storeItems.find(item => item['No DO'] || item.NoDO || item['no do'] || item.DO)?.['No DO'];
        const extractedWpp = storeItems.reduce((found, item) => found || getWppFromItem(item), '');
        const storeNoWpp = formatWppText(extractedWpp || defaultWppNumber);
        const finalDoNumber = (customNoDo && String(customNoDo).trim().toLowerCase() !== 'unik')
          ? String(customNoDo).trim()
          : `${spkNumber}-${storeSeq}`;

        let itemsRowsHTML = '';
        storeItems.forEach((item, i) => {
          itemsRowsHTML += `
            <tr style="border-bottom: 1px solid #000; height: 32px;">
              <td style="border-right: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${i + 1}</td>
              <td style="border-right: 1px solid #000; padding: 6px 10px; font-weight: bold; text-transform: uppercase;">${item.Item || ''} ${item.Bahan ? `_ ${item.Bahan}` : ''}</td>
              <td style="border-right: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; font-family: monospace;">${item.Ukuran || '-'}</td>
              <td style="padding: 6px; text-align: center; font-weight: 900; font-family: monospace;">${item.Qty || 0}</td>
            </tr>
          `;
        });

        const emptyRowsCount = Math.max(0, 6 - storeItems.length);
        for (let e = 0; e < emptyRowsCount; e++) {
          itemsRowsHTML += `
            <tr style="border-bottom: 1px solid #000; height: 32px;">
              <td style="border-right: 1px solid #000; padding: 6px;"></td>
              <td style="border-right: 1px solid #000; padding: 6px;"></td>
              <td style="border-right: 1px solid #000; padding: 6px;"></td>
              <td style="padding: 6px;"></td>
            </tr>
          `;
        }

        const logoHTML = wellenPrintLogo
          ? `<img src="${wellenPrintLogo}" style="height: 48px; width: auto; object-fit: contain;" />`
          : `<div style="font-size: 11px; border: 1px solid #000; padding: 4px; font-style: italic;">[Logo]</div>`;

        doPagesHTML += `
          <div class="page-break" style="width: 200mm; height: 124mm; max-width: 200mm; max-height: 124mm; border: 2px solid #000; border-radius: 12px; padding: 12px; box-sizing: border-box; margin: 0 auto; background: #fff; display: flex; flex-direction: column; justify-content: space-between; font-size: 11.5px; font-family: Arial, sans-serif; overflow: hidden; page-break-after: always; break-after: page;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
                <div>
                  <div style="height: 42px; width: 160px; display: flex; align-items: center;">${logoHTML}</div>
                  <p style="font-size: 10.5px; color: #333; margin: 3px 0 0 0; line-height: 1.1;">
                    Jl. Raya Pasar Minggu No. 49 RT.002 RW. 007 Duren Tiga, Jakarta<br />
                    Telp. 021 -5506999 &nbsp;&nbsp;|&nbsp;&nbsp; Fax -
                  </p>
                </div>
                <div style="text-align: right;">
                  <h2 style="margin: 0; font-size: 17px; font-weight: 900; text-transform: uppercase;">SURAT JALAN</h2>
                  <p style="margin: 2px 0 0 0; font-size: 13px; font-weight: 800; font-family: monospace;">${finalDoNumber}</p>
                  <div style="margin-top: 6px; text-align: left; font-size: 11.5px;">
                    <span style="font-weight: bold;">Kepada Yth, :</span><br />
                    <span style="font-weight: 800; text-transform: uppercase; font-size: 12.5px;">${activeClientName}</span><br />
                    <span style="font-weight: 800;">STORE : ${storeName}</span>
                  </div>
                </div>
              </div>

              <table style="width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 11.5px; color: #000;">
                <thead>
                  <tr style="background: #f3f4f6; border-bottom: 2px solid #000; font-weight: 800;">
                    <th style="border-right: 1px solid #000; padding: 4px 6px; width: 36px; text-align: center;">No.</th>
                    <th style="border-right: 1px solid #000; padding: 4px 6px; text-align: left;">Nama Barang</th>
                    <th style="border-right: 1px solid #000; padding: 4px 6px; width: 100px; text-align: center;">Ukuran</th>
                    <th style="padding: 4px 6px; width: 60px; text-align: center;">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRowsHTML}
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid #000; font-weight: 900; background: #f8fafc;">
                    <td colSpan="3" style="border-right: 1px solid #000; padding: 4px 10px; text-align: right; text-transform: uppercase;">TOTAL :</td>
                    <td style="padding: 4px; text-align: center; font-family: monospace; font-size: 13px;">${totalQty}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style="border: 1px solid #000; display: grid; grid-template-columns: repeat(4, 1fr); font-size: 10.5px;">
              <div style="padding: 5px; border-right: 1px solid #000;">
                <p style="margin: 0;"><span style="font-weight: bold;">Tgl</span> : ${currentDateStr}</p>
                <p style="margin: 2px 0 0 0;"><span style="font-weight: bold;">Nama File</span> : ${activePromoTitle}</p>
                <div style="margin-top: 8px;">
                  <p style="margin: 0;"><span style="font-weight: bold;">Inv</span> : ${storeNoWpp || '-'}</p>
                  <p style="margin: 2px 0 0 0;"><span style="font-weight: bold;">PO</span> : -</p>
                </div>
              </div>
              <div style="padding: 5px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
                <span style="font-weight: bold;">DIBUAT OLEH</span>
                <span style="border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: 600;">${senderName || '-'}</span>
              </div>
              <div style="padding: 5px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
                <span style="font-weight: bold;">DIKIRIM OLEH</span>
                <span style="border-bottom: 1px solid #000; padding-bottom: 2px;">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span>
              </div>
              <div style="padding: 5px; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
                <span style="font-weight: bold;">DITERIMA OLEH</span>
                <span style="border-bottom: 1px solid #000; padding-bottom: 2px;">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span>
              </div>
            </div>
          </div>
        `;
      });

      const printWin = window.open('', '_blank', 'width=1000,height=800');
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cetak Surat Jalan (${storeKeys.length} DO)</title>
            <style>
              @page {
                size: 210mm 140mm landscape;
                margin: 0mm;
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
              .page-break {
                page-break-after: always;
                break-after: page;
                page-break-inside: avoid;
                break-inside: avoid;
              }
            </style>
          </head>
          <body>
            <div style="padding: 5mm;">${doPagesHTML}</div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 250);
              };
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    }
  };

  return (
    <div className={`p-6 rounded-3xl shadow-2xs space-y-6 border ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>
      
      {/* Kontrol Atas / Panel Pengaturan */}
      <div className="flex flex-col border-b border-slate-200/80 dark:border-neutral-800 pb-5 gap-5 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 rounded-xl">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-slate-900 dark:text-white">
                Pencetakan Label Massal & Surat Jalan (Proyek Kawan Lama)
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-normal mt-0.5">
                Atur rincian perusahaan, judul program promosi, nomor SPK/Surat Jalan, dan unggah berkas Excel alokasi.
              </p>
            </div>
          </div>

          {/* Tombol Pemilih Mode Cetak */}
          <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-slate-100/80 border-slate-200/80'}`}>
            <button
              onClick={() => setPrintMode('labels')}
              className={`px-3.5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === 'labels' 
                  ? 'bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-neutral-300 font-medium hover:bg-white/60 dark:hover:bg-neutral-700/60'
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> Label Koli (1 HVS Penuh)
            </button>
            <button
              onClick={() => setPrintMode('do')}
              className={`px-3.5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === 'do' 
                  ? 'bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-neutral-300 font-medium hover:bg-white/60 dark:hover:bg-neutral-700/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Surat Jalan (DO)
            </button>
          </div>
        </div>

        {/* FORMULIR PENGATURAN DOKUMEN */}
        <div className={`p-6 rounded-2xl border shadow-2xs space-y-6 ${isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-slate-50/70 border-slate-200/80'}`}>

          {/* SEKSI 1: INFORMASI PERUSAHAAN & PROYEK */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 dark:text-neutral-400 tracking-wider uppercase block">
              INFORMASI PERUSAHAAN & PROYEK
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">

              {/* 1. Pilihan PT / Perusahaan */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                    Pilih Perusahaan / PT <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <button onClick={() => setShowAddCompanyModal(true)} className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
                    <PlusCircle className="w-3 h-3" /> Tambah Perusahaan
                  </button>
                </div>
                {isManualCompany ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={manualCompanyName}
                      onChange={e => setManualCompanyName(e.target.value)}
                      placeholder="Ketik nama perusahaan..."
                      className={`h-10 text-xs border px-3.5 rounded-xl font-medium w-full focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}
                    />
                    <button 
                      onClick={() => setIsManualCompany(false)} 
                      className="h-10 px-3 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:text-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center" 
                      title="Kembali ke daftar pilihan"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <CustomDropdown
                    value={selectedPt}
                    onChange={(e) => {
                      if (e.target.value === 'MANUAL_INPUT') {
                        setIsManualCompany(true);
                      } else {
                        setSelectedPt(e.target.value);
                      }
                    }}
                    className="w-full"
                  >
                    {companyList.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    <option value="MANUAL_INPUT" className="font-semibold">Ketik Manual...</option>
                  </CustomDropdown>
                )}
              </div>

              {/* 2. Input Nama Promo / Judul Proyek */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  Judul Program Promosi / Proyek <span className="text-slate-400 font-normal text-xs ml-0.5">(opsional)</span>
                </label>
                <input 
                  type="text" 
                  value={activePromoTitle}
                  onChange={(e) => setActivePromoTitle(e.target.value)}
                  placeholder="cth: PROMO KEMERDEKAAN"
                  className={`h-10 text-xs border px-3.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>

              {/* 3. Input No SPK / No Surat Jalan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  Nomor SPK / Surat Jalan <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={spkNumber}
                  onChange={(e) => setSpkNumber(e.target.value)}
                  placeholder="cth: SJ-05031"
                  className={`h-10 text-xs border px-3.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>

            </div>
          </div>

          <div className="border-t border-slate-200/70 dark:border-neutral-700" />

          {/* SEKSI 2: INFORMASI PENGIRIMAN & LAMPIRAN BERKAS */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 dark:text-neutral-400 tracking-wider uppercase block">
              INFORMASI PENGIRIMAN & LAMPIRAN BERKAS
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">

              {/* 4. Input No WPP / No Faktur */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  Nomor WPP / Faktur <span className="text-slate-400 font-normal text-xs ml-0.5">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={defaultWppNumber}
                  onChange={(e) => setDefaultWppNumber(e.target.value)}
                  placeholder="cth: WPP 0926-304087"
                  className={`h-10 text-xs border px-3.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>

              {/* 5. Input Nama Pembuat / Pengirim DO */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  Nama Pembuat (Surat Jalan) <span className="text-slate-400 font-normal text-xs ml-0.5">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="cth: Arini Lidya"
                  className={`h-10 text-xs border px-3.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>

              {/* 6. Unggah Berkas Excel */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  Unggah Excel Alokasi <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className={`h-10 text-xs border px-2 py-1.5 rounded-xl cursor-pointer file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:outline-none transition-all shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-white border-slate-200/90 text-slate-700'}`}
                />
              </div>

              {/* 7. Logo Wellen Terkunci */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-neutral-200">
                  Logo Wellen {wellenPrintLogo ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs ml-0.5">(Tersimpan)</span> : <span className="text-slate-400 font-normal text-xs ml-0.5">(opsional)</span>}
                </label>
                {wellenPrintLogo ? (
                  <button 
                    onClick={handleResetLogo} 
                    className="h-10 w-full px-3 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Atur Ulang / Ganti Logo
                  </button>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className={`h-10 text-xs border px-2 py-1.5 rounded-xl cursor-pointer file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 focus:outline-none transition-all shadow-2xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-neutral-300' : 'bg-white border-slate-200/90 text-slate-700'}`}
                  />
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Tombol Cetak Utama */}
        <div className="flex justify-end pt-1">
          <button 
            onClick={handlePrint}
            disabled={totalRegions === 0}
            className="py-2.5 px-6 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-bold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" /> Cetak Dokumen / Simpan PDF ({totalRegions} Cabang)
          </button>
        </div>
      </div>

      {/* MODAL TAMBAH PERUSAHAAN / PT BARU */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`p-6 rounded-3xl max-w-md w-full space-y-4 border shadow-xl ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-neutral-800 pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Tambah Perusahaan / PT Baru
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddCompanyModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form onSubmit={handleAddCompany} className="space-y-3">
              <input 
                type="text" 
                value={newCompanyName} 
                onChange={e => setNewCompanyName(e.target.value)} 
                placeholder="Contoh: PT KAWAN LAMA RETAIL" 
                className={`w-full p-3 border rounded-xl font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-slate-50 border-slate-200/90 text-slate-900'}`} 
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddCompanyModal(false)} 
                  className="px-4 py-2 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Simpan Perusahaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Area Pratinjau Layar */}
      <div className="preview-container">
        {totalRegions === 0 ? (
          <div className={`text-center py-16 border-2 border-dashed rounded-3xl text-xs ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-slate-200 text-slate-400'}`}>
            Silakan pilih perusahaan (PT) dan unggah berkas Excel alokasi untuk menampilkan pratinjau cetak.
          </div>
        ) : (
          printMode === 'labels' ? (
            // ================= RENDER LABEL 1 HVS FULL PER STORE =================
            storeKeys.map((storeName, storeIdx) => {
              const absoluteIndex = storeIdx + 1;
              const storeItems = labels[storeName] || [];

              return (
                <div key={storeIdx} className="a4-preview-card relative text-stone-900 bg-white p-6 sm:p-7 mb-8 border-2 border-stone-900 rounded-2xl shadow-sm mx-auto max-w-[275mm]">
                  {/* Indikator Koli */}
                  <div className="absolute top-3.5 right-3.5 bg-stone-100 border-2 border-stone-900 px-3 py-1 rounded-lg text-xs sm:text-sm font-extrabold text-stone-900">
                    {absoluteIndex} OF {totalRegions}
                  </div>

                  {/* Header Kop */}
                  <div className="flex items-center border-b-2 border-black pb-2.5 mb-3 pr-24">
                    <div className="h-12 w-36 flex items-center justify-start">
                      {wellenPrintLogo ? (
                        <img src={wellenPrintLogo} className="h-full object-contain" alt="Logo" />
                      ) : (
                        <div className="text-xs border-2 border-stone-900 p-1.5 font-bold italic text-stone-800">[Unggah Logo]</div>
                      )}
                    </div>
                    <div className="flex-grow text-center">
                      <h1 className="font-extrabold text-base sm:text-lg uppercase text-stone-900 tracking-wide">{activeClientName}</h1>
                      <p className="font-extrabold text-xs sm:text-sm mt-0.5 uppercase text-stone-900">
                        {activePromoTitle} ({spkNumber})
                      </p>
                    </div>
                  </div>

                  {/* Info Store / Region */}
                  <div className="mb-3 font-extrabold text-sm sm:text-base text-stone-900">
                    STORE / REGION : {storeName}
                  </div>

                  {/* Tabel Item */}
                  <table className="w-full table-fixed border-collapse border-2 border-black text-xs sm:text-sm text-stone-900">
                    <thead>
                      <tr className="bg-stone-100 text-stone-900 border-b-2 border-black">
                        <th className="border-r-2 border-black p-2 w-[6%] text-center font-extrabold">NO</th>
                        <th className="border-r-2 border-black p-2 w-[38%] text-left font-extrabold">ITEM</th>
                        <th className="border-r-2 border-black p-2 w-[34%] text-center font-extrabold">BAHAN</th>
                        <th className="border-r-2 border-black p-2 w-[14%] text-center font-extrabold">UKURAN</th>
                        <th className="p-2 w-[8%] text-center font-extrabold">QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeItems.map((item, i) => (
                        <tr key={i} className="border-b border-black text-stone-900">
                          <td className="border-r-2 border-black p-2 text-center font-bold">{i + 1}</td>
                          <td className="border-r-2 border-black p-2 font-extrabold uppercase">{item.Item}</td>
                          <td className="border-r-2 border-black p-2 text-center font-bold">{item.Bahan || '-'}</td>
                          <td className="border-r-2 border-black p-2 text-center font-bold font-mono">{item.Ukuran || '-'}</td>
                          <td className="p-2 text-center font-black font-mono text-xs sm:text-sm">{item.Qty} PCS</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          ) : (
            // ================= RENDER SURAT JALAN (DO) PER STORE =================
            storeKeys.map((storeName, storeIdx) => {
              const storeItems = labels[storeName] || [];
              const totalQty = storeItems.reduce((sum, item) => sum + (Number(item.Qty) || 0), 0);
              
              const storeSeq = String(storeIdx + 1).padStart(3, '0');
              const customNoDo = storeItems.find(item => item['No DO'] || item.NoDO || item['no do'] || item.DO)?.['No DO'];

              const extractedWpp = storeItems.reduce((found, item) => {
                if (found) return found;
                return getWppFromItem(item);
              }, '');

              const storeNoWpp = formatWppText(extractedWpp || defaultWppNumber);

              const finalDoNumber = (customNoDo && String(customNoDo).trim().toLowerCase() !== 'unik')
                ? String(customNoDo).trim()
                : `${spkNumber}-${storeSeq}`;

              return (
                <div key={storeIdx} className="surat-jalan-preview relative text-black bg-white p-8 mb-6 border border-stone-300 shadow-sm mx-auto max-w-[210mm]">
                  {/* Header Surat Jalan */}
                  <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                    <div className="space-y-1">
                      <div className="h-16 w-48 flex items-center justify-start">
                        {wellenPrintLogo ? <img src={wellenPrintLogo} className="h-full object-contain" alt="Logo" /> : <div className="text-xs border p-2 italic">[Unggah Logo]</div>}
                      </div>
                      <p className="text-[11px] text-stone-700 max-w-xs leading-tight">
                        Jl. Raya Pasar Minggu No. 49 RT.002 RW. 007 Duren Tiga, Jakarta<br />
                        Telp. 021 -5506999 &nbsp;&nbsp;|&nbsp;&nbsp; Fax -
                      </p>
                    </div>

                    <div className="text-right">
                      <h1 className="font-extrabold text-2xl tracking-wide uppercase">SURAT JALAN</h1>
                      <p className="font-extrabold text-lg text-black mt-0.5">{finalDoNumber}</p>
                      <div className="mt-2 text-left text-xs sm:text-sm">
                        <span className="font-bold">Kepada Yth, :</span><br />
                        <span className="font-extrabold uppercase text-sm sm:text-base">{activeClientName}</span><br />
                        <span className="font-extrabold text-black">STORE : {storeName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Item Surat Jalan */}
                  <table className="w-full border-collapse border border-black text-xs sm:text-[13px] mb-0">
                    <thead>
                      <tr className="bg-stone-100 text-black border-b border-black">
                        <th className="border-r border-black p-2 text-center w-12 font-bold">No.</th>
                        <th className="border-r border-black p-2 text-left font-bold">Nama Barang</th>
                        <th className="border-r border-black p-2 text-center w-28 font-bold">Ukuran</th>
                        <th className="p-2 text-center w-20 font-bold">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeItems.map((item, i) => (
                        <tr key={i} className="border-b border-black h-8">
                          <td className="border-r border-black p-2 text-center font-bold">{i + 1}</td>
                          <td className="border-r border-black p-2 font-bold uppercase">
                            {item.Item} {item.Bahan ? `_ ${item.Bahan}` : ''}
                          </td>
                          <td className="border-r border-black p-2 text-center font-bold font-mono">{item.Ukuran || '-'}</td>
                          <td className="p-2 text-center font-black font-mono">{item.Qty}</td>
                        </tr>
                      ))}
                      {[...Array(Math.max(0, 6 - storeItems.length))].map((_, idx) => (
                        <tr key={`empty-${idx}`} className="border-b border-black h-8">
                          <td className="border-r border-black p-2"></td>
                          <td className="border-r border-black p-2"></td>
                          <td className="border-r border-black p-2"></td>
                          <td className="p-2"></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-black font-extrabold bg-stone-50">
                        <td colSpan="3" className="border-r border-black p-2 text-right uppercase">TOTAL :</td>
                        <td className="p-2 text-center font-mono text-sm sm:text-base">{totalQty}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Footer / Tanda Tangan Surat Jalan */}
                  <div className="border border-t-0 border-black grid grid-cols-4 text-[12px]">
                    <div className="p-2 border-r border-black space-y-1">
                      <p><span className="font-bold">Tgl</span> : {currentDateStr}</p>
                      <p><span className="font-bold">Nama File</span> : {activePromoTitle}</p>
                      <div className="pt-5">
                        <p><span className="font-bold">Inv</span> : {storeNoWpp || '-'}</p>
                        <p><span className="font-bold">PO</span> : -</p>
                      </div>
                    </div>
                    <div className="p-2 border-r border-black flex flex-col justify-between text-center">
                      <span className="font-bold">DIBUAT OLEH</span>
                      <div className="pt-12 pb-2">
                        <span className="border-b border-black pb-0.5 px-4 font-semibold">{senderName || '-'}</span>
                      </div>
                    </div>
                    <div className="p-2 border-r border-black flex flex-col justify-between text-center">
                      <span className="font-bold">DIKIRIM OLEH</span>
                      <div className="pt-12 pb-2">
                        <span className="border-b border-black pb-0.5 px-8">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span>
                      </div>
                    </div>
                    <div className="p-2 flex flex-col justify-between text-center">
                      <span className="font-bold">DITERIMA OLEH</span>
                      <div className="pt-12 pb-2">
                        <span className="border-b border-black pb-0.5 px-8">(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}