import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Tag,
  Printer,
  FileText,
  PlusCircle,
  FileSpreadsheet,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Building2,
  Check,
  X
} from 'lucide-react';

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

    // Otomatis ekstrak kode SPK/DO dari nama file jika ada (format ringkas biar tidak terlalu panjang)
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
        const store = curr.Store || curr.Region || 'Unknown Region';
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
    if (confirm('Buka kunci dan hapus logo Wellen?')) {
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
      alert(`✅ PT "${formatted}" berhasil ditambahkan!`);
    } else {
      alert('⚠️ Nama PT tersebut sudah ada dalam daftar.');
    }
  };

  const storeKeys = Object.keys(labels);
  const totalRegions = storeKeys.length;

  const currentDateStr = new Date().toLocaleString('en-GB', { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  }).replace(',', '');

  const activeClientName = isManualCompany ? manualCompanyName : selectedPt;

  return (
    <div className="p-6 rounded-3xl shadow-xs space-y-6 border bg-white border-slate-200 text-black">
      
      {/* Kontrol Atas / Panel Kontrol */}
      <div className="flex flex-col border-b border-slate-200/80 pb-5 gap-5 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-700 border border-slate-200">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-slate-900">
                Label & Delivery Order (Kawan Lama Project)
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Set company details, promo title, SPK/DO number, and upload allocation Excel.
              </p>
            </div>
          </div>

          {/* Tombol Switch Mode Cetak */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPrintMode('labels')}
              className={`px-3.5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === 'labels' 
                  ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs font-semibold'
                  : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> Labels (1 HVS Full)
            </button>
            <button
              onClick={() => setPrintMode('do')}
              className={`px-3.5 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === 'do' 
                  ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs font-semibold'
                  : 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Delivery Order
            </button>
          </div>
        </div>

        {/* ENTERPRISE FORM GRID */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">

          {/* SECTION 1: COMPANY & PROJECT INFORMATION */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block">
              COMPANY & PROJECT INFORMATION
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">

              {/* 1. Pilihan PT / Perusahaan */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700">
                    Select Company / PT <span className="text-rose-500 font-bold ml-0.5">*</span>
                  </label>
                  <button onClick={() => setShowAddCompanyModal(true)} className="text-[11px] text-slate-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
                    <PlusCircle className="w-3 h-3" /> Add Company
                  </button>
                </div>
                {isManualCompany ? (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={manualCompanyName}
                      onChange={e => setManualCompanyName(e.target.value)}
                      placeholder="Type company name..."
                      className="h-10 text-xs border border-slate-200 px-3.5 rounded-xl font-medium w-full bg-white text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition-all shadow-2xs"
                    />
                    <button onClick={() => setIsManualCompany(false)} className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer" title="Back to dropdown">✕</button>
                  </div>
                ) : (
                  <select
                    value={selectedPt}
                    onChange={(e) => {
                      if (e.target.value === 'MANUAL_INPUT') {
                        setIsManualCompany(true);
                      } else {
                        setSelectedPt(e.target.value);
                      }
                    }}
                    className="h-10 text-xs border border-slate-200 px-3.5 rounded-xl font-medium bg-white text-slate-800 focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition-all cursor-pointer shadow-2xs"
                  >
                    {companyList.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    <option value="MANUAL_INPUT" className="font-semibold text-slate-800">✏️ Type Manually...</option>
                  </select>
                )}
              </div>

              {/* 2. Input Nama Promo / Judul Project */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Promo / Project Title <span className="text-slate-400 font-normal text-xs ml-0.5">(optional)</span>
                </label>
                <input 
                  type="text" 
                  value={activePromoTitle}
                  onChange={(e) => setActivePromoTitle(e.target.value)}
                  placeholder="e.g. PROMO 17 AGUSTUS"
                  className="h-10 text-xs border border-slate-200 px-3.5 rounded-xl font-medium bg-white text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all shadow-2xs"
                />
              </div>

              {/* 3. Input No SPK / No Surat Jalan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  SPK / Delivery Order No <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="text"
                  value={spkNumber}
                  onChange={(e) => setSpkNumber(e.target.value)}
                  placeholder="e.g. SJ-05031"
                  className="h-10 text-xs border border-slate-200 px-3.5 rounded-xl font-medium bg-white text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all shadow-2xs"
                />
              </div>

            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* SECTION 2: DELIVERY ORDER & FILE ATTACHMENTS */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block">
              DELIVERY ORDER & FILE ATTACHMENTS
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">

              {/* 4. Input No WPP / Inv No */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  No WPP / Inv No <span className="text-slate-400 font-normal text-xs ml-0.5">(optional)</span>
                </label>
                <input
                  type="text"
                  value={defaultWppNumber}
                  onChange={(e) => setDefaultWppNumber(e.target.value)}
                  placeholder="e.g. WPP 0926-304087"
                  className="h-10 text-xs border border-slate-200 px-3.5 rounded-xl font-medium bg-white text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all shadow-2xs"
                />
              </div>

              {/* 5. Input Nama Pembuat / Pengirim DO */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Creator Name (DO) <span className="text-slate-400 font-normal text-xs ml-0.5">(optional)</span>
                </label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Arini Lidya"
                  className="h-10 text-xs border border-slate-200 px-3.5 rounded-xl font-medium bg-white text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 transition-all shadow-2xs"
                />
              </div>

              {/* 6. Upload File Excel */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Upload Allocation Excel <span className="text-rose-500 font-bold ml-0.5">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileUpload}
                  className="h-10 text-xs border border-slate-200 px-2 py-1.5 rounded-xl cursor-pointer bg-white text-slate-700 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 focus:outline-none focus:border-indigo-500 transition-all shadow-2xs"
                />
              </div>

              {/* 7. Logo Wellen Terkunci */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Wellen Logo {wellenPrintLogo ? <span className="text-emerald-600 font-semibold text-xs ml-0.5">(Locked)</span> : <span className="text-slate-400 font-normal text-xs ml-0.5">(optional)</span>}
                </label>
                {wellenPrintLogo ? (
                  <button onClick={handleResetLogo} className="h-10 w-full px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs">
                    🔓 Reset / Replace Logo
                  </button>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="h-10 text-xs border border-slate-200 px-2 py-1.5 rounded-xl cursor-pointer bg-white text-slate-700 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 focus:outline-none focus:border-indigo-500 transition-all shadow-2xs"
                  />
                )}
              </div>

            </div>
          </div>

        </div>

        {/* Tombol Cetak Utama */}
        <div className="flex justify-end pt-1">
          <button 
            onClick={() => window.print()} 
            className="py-2.5 px-6 bg-transparent hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* MODAL TAMBAH PT BARU */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className={`p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white text-stone-900'}`}>
            <h3 className="font-bold text-sm">➕ Tambah Perusahaan / PT Baru</h3>
            <form onSubmit={handleAddCompany} className="space-y-3">
              <input 
                type="text" 
                value={newCompanyName} 
                onChange={e => setNewCompanyName(e.target.value)} 
                placeholder="Contoh: PT KAWAN LAMA RETAIL" 
                className={`w-full p-3 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} 
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddCompanyModal(false)} className="px-3 py-2 bg-stone-300 hover:bg-stone-400 text-stone-800 rounded-xl text-xs font-bold">Batal</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">Simpan PT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Area Konten / Cetak */}
      <div className="print-container">
        {totalRegions === 0 ? (
          <div className={`text-center py-16 border-2 border-dashed rounded-3xl text-xs ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-300 text-stone-400'}`}>
            Silakan pilih PT dan upload file Excel alokasi untuk mulai mencetak.
          </div>
        ) : (
          printMode === 'labels' ? (
            // ================= RENDER LABEL 1 HVS FULL PER STORE =================
            storeKeys.map((storeName, storeIdx) => {
              const absoluteIndex = storeIdx + 1;
              const storeItems = labels[storeName] || [];

              return (
                <div key={storeIdx} className="a4-single-page relative text-stone-900 bg-white p-6 sm:p-7 mb-8 border-2 border-stone-900 rounded-2xl shadow-sm mx-auto max-w-[265mm]">
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
                        <div className="text-xs border-2 border-stone-900 p-1.5 font-bold italic text-stone-800">[Upload Logo]</div>
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
              
              // Garansi unik per toko (Format ringkas: SJ-05031-001)
              const storeSeq = String(storeIdx + 1).padStart(3, '0');
              const customNoDo = storeItems.find(item => item['No DO'] || item.NoDO || item['no do'] || item.DO)?.['No DO'];

              // Ekstrak No WPP secara otomatis per toko dari data Excel (pencarian fleksibel)
              const extractedWpp = storeItems.reduce((found, item) => {
                if (found) return found;
                return getWppFromItem(item);
              }, '');

              const storeNoWpp = formatWppText(extractedWpp || defaultWppNumber);

              const finalDoNumber = (customNoDo && String(customNoDo).trim().toLowerCase() !== 'unik')
                ? String(customNoDo).trim()
                : `${spkNumber}-${storeSeq}`;

              return (
                <div key={storeIdx} className="surat-jalan-page relative text-black bg-white p-8 mb-6 border border-stone-300 shadow-sm mx-auto">
                  {/* Header Surat Jalan */}
                  <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                    <div className="space-y-1">
                      <div className="h-16 w-48 flex items-center justify-start">
                        {wellenPrintLogo ? <img src={wellenPrintLogo} className="h-full object-contain" alt="Logo" /> : <div className="text-xs border p-2 italic">[Upload Logo]</div>}
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

      <style>{`
        .a4-single-page {
          width: 280mm;
          min-height: 185mm;
          background: white;
          padding: 8mm 10mm;
          box-sizing: border-box;
          margin-bottom: 20mm;
          border: 1px solid #ddd;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .surat-jalan-page {
          width: 210mm;
          min-height: 140mm;
          background: white;
          box-sizing: border-box;
          margin-bottom: 20mm;
          padding: 5mm 7mm;
          border: 1px solid #ccc;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        @media print {
          @page {
            size: ${printMode === 'labels' ? 'A4 landscape' : '210mm 140mm landscape'} !important;
            margin: 0mm !important;
          }
          html, body {
            width: ${printMode === 'labels' ? '297mm' : '210mm'} !important;
            height: ${printMode === 'labels' ? '210mm' : '140mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden !important; }
          .print-container, .print-container * { visibility: visible !important; }
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printMode === 'labels' ? '297mm' : '210mm'} !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-single-page {
            width: 275mm !important;
            max-width: 275mm !important;
            height: 188mm !important;
            max-height: 188mm !important;
            padding: 8mm 10mm !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 2px solid #000 !important;
            border-radius: 12px !important;
            background: #ffffff !important;
            box-shadow: none !important;
            margin: 10mm auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            overflow: hidden !important;
          }
          .a4-single-page:first-child, .a4-single-page:first-of-type {
            page-break-before: auto !important;
            break-before: auto !important;
            margin-top: 8mm !important;
          }
          .surat-jalan-page {
            width: 210mm !important;
            height: 140mm !important;
            max-height: 140mm !important;
            border: none !important;
            box-shadow: none !important;
            padding: 5.1mm 6.5mm 5mm 6.5mm !important;
            margin-left: -0.5mm !important;
            margin-top: 0.1mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
          }
          .surat-jalan-page:first-child, .surat-jalan-page:first-of-type {
            margin-top: -6mm !important;
            padding-top: 2mm !important;
          }
        }
      `}</style>
    </div>
  );
}