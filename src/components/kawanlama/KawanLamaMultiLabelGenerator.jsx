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
  const pagePairs = [];
  for (let i = 0; i < totalRegions; i += 2) {
    pagePairs.push(storeKeys.slice(i, i + 2));
  }

  const currentDateStr = new Date().toLocaleString('en-GB', { 
    day: '2-digit', month: 'short', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  }).replace(',', '');

  const activeClientName = isManualCompany ? manualCompanyName : selectedPt;

  return (
    <div className="p-6 rounded-3xl shadow-xs space-y-6 border bg-white border-slate-200 text-black">
      
      {/* Kontrol Atas / Panel Kontrol */}
      <div className="flex flex-col border-b border-slate-200 pb-5 gap-5 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="font-extrabold text-base tracking-wide text-black flex items-center gap-2">
              <Tag className="w-5 h-5 text-indigo-600" /> Kawan Lama Group - Multi Label & Delivery Order Generator
            </h2>
            <p className="text-xs mt-0.5 text-slate-500 font-medium">
              Set company, promo name, SPK number, creator, locked Wellen logo, and upload allocation Excel.
            </p>
          </div>

          {/* Tombol Switch Mode Cetak */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setPrintMode('labels')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === 'labels' 
                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:text-black hover:bg-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5" /> Print 2-in-1 Labels
            </button>
            <button
              onClick={() => setPrintMode('do')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                printMode === 'do' 
                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                  : 'text-slate-700 hover:text-black hover:bg-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Print Delivery Order (DO)
            </button>
          </div>
        </div>

        {/* 3-COLUMN ENTERPRISE FORM GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start bg-slate-50 p-5 rounded-2xl border border-slate-200">

          {/* 1. Pilihan PT / Perusahaan */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-extrabold text-black">
                Select Company / PT:
              </label>
              <button onClick={() => setShowAddCompanyModal(true)} className="text-[11px] text-indigo-600 font-black hover:underline flex items-center gap-1 cursor-pointer">
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
                  className="text-xs border border-slate-300 p-2.5 rounded-xl font-bold w-full bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button onClick={() => setIsManualCompany(false)} className="px-3 bg-slate-200 hover:bg-slate-300 text-black rounded-xl text-xs font-bold cursor-pointer" title="Back to dropdown">✕</button>
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
                className="text-xs border border-slate-300 p-2.5 rounded-xl font-black bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
              >
                {companyList.map((c, i) => <option key={i} value={c}>{c}</option>)}
                <option value="MANUAL_INPUT" className="font-bold text-indigo-600">✏️ Type Manually...</option>
              </select>
            )}
          </div>

          {/* 2. Input Nama Promo / Judul Project */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-black">
              Promo / Project Title:
            </label>
            <input 
              type="text" 
              value={activePromoTitle} 
              onChange={(e) => setActivePromoTitle(e.target.value)} 
              placeholder="Example: PROMO 17 AGUSTUS"
              className="text-xs border border-slate-300 p-2.5 rounded-xl font-extrabold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* 3. Input No SPK / No Surat Jalan */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-black">
              SPK / Delivery Order No:
            </label>
            <input 
              type="text" 
              value={spkNumber} 
              onChange={(e) => setSpkNumber(e.target.value)} 
              className="text-xs border border-slate-300 p-2.5 rounded-xl font-mono font-black bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* 4. Input No WPP / Inv No */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-black">
              No WPP / Inv No:
            </label>
            <input
              type="text"
              value={defaultWppNumber}
              onChange={(e) => setDefaultWppNumber(e.target.value)}
              placeholder="Contoh: WPP 0926-304087"
              className="text-xs border border-slate-300 p-2.5 rounded-xl font-mono font-extrabold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* 5. Input Nama Pembuat / Pengirim DO */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-black">
              Creator Name (DO):
            </label>
            <input 
              type="text" 
              value={senderName} 
              onChange={(e) => setSenderName(e.target.value)} 
              placeholder="Example: Arini Lidya"
              className="text-xs border border-slate-300 p-2.5 rounded-xl font-extrabold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* 5. Upload File Excel */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-black flex items-center gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" /> Upload Allocation Excel:
            </label>
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={handleFileUpload} 
              className="text-xs border border-slate-300 p-2 rounded-xl cursor-pointer bg-white text-black file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {/* 6. Logo Wellen Terkunci */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-extrabold text-black flex items-center gap-1">
              <Upload className="w-3.5 h-3.5 text-indigo-600" /> Wellen Logo {wellenPrintLogo ? '(Locked)' : '(Optional)'}:
            </label>
            {wellenPrintLogo ? (
              <button onClick={handleResetLogo} className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-extrabold rounded-xl text-xs transition-all cursor-pointer">
                🔓 Reset / Replace Logo
              </button>
            ) : (
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleLogoUpload} 
                className="text-xs border border-slate-300 p-2 rounded-xl cursor-pointer bg-white text-black file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-slate-100 file:text-black hover:file:bg-slate-200"
              />
            )}
          </div>
        </div>

        {/* Tombol Cetak Utama */}
        <div className="flex justify-end pt-2">
          <button 
            onClick={() => window.print()} 
            className="py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> {printMode === 'labels' ? 'Print 2-in-1 Labels' : 'Print Delivery Order (DO)'}
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
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold">Simpan PT</button>
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
            // ================= RENDER LABEL 2-IN-1 (LANDSCAPE PAGE DENGAN 2 LABEL VERTIKAL) =================
            pagePairs.map((pair, pageIdx) => (
              <div key={pageIdx} className="a4-landscape-page relative">
                <div className="vertical-cut-line"></div>

                {pair.map((storeName, cardIdx) => {
                  const absoluteIndex = pageIdx * 2 + cardIdx + 1;
                  return (
                    <div key={cardIdx} className="label-card relative text-stone-900">
                      <div className="absolute top-2.5 right-2.5 bg-stone-100 border border-stone-300 px-2 py-0.5 rounded text-[10px] font-bold text-stone-800">
                        {absoluteIndex} OF {totalRegions}
                      </div>

                      <div className="flex items-center border-b-2 border-black pb-2 mb-2.5 pr-14">
                        <div className="h-12 w-32 flex items-center justify-start">
                          {wellenPrintLogo ? <img src={wellenPrintLogo} className="h-full object-contain" alt="Logo" /> : <div className="text-[9px] border p-1 italic text-stone-800">[Upload Logo]</div>}
                        </div>
                        <div className="flex-grow text-center">
                          <h1 className="font-bold text-xs uppercase text-stone-900">{activeClientName}</h1>
                          <p className="font-bold text-[9px] mt-0.5 uppercase text-stone-900">
                            {activePromoTitle} ( {spkNumber} )
                          </p>
                        </div>
                      </div>
                      <div className="mb-2 font-bold text-xs text-stone-900">STORE / REGION : {storeName}</div>
                      <table className="w-full border-collapse border border-black text-[11px] text-stone-900">
                        <thead>
                          <tr className="bg-gray-100 text-stone-900">
                            <th className="border border-black p-1 w-8 text-center font-bold">NO</th>
                            <th className="border border-black p-1 text-left font-bold">ITEM</th>
                            <th className="border border-black p-1 w-28 text-center font-bold">BAHAN</th>
                            <th className="border border-black p-1 w-20 text-center font-bold">UKURAN</th>
                            <th className="border border-black p-1 w-16 text-center font-bold">QTY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labels[storeName].map((item, i) => (
                            <tr key={i} className="text-stone-900">
                              <td className="border border-black p-1 text-center font-medium">{i + 1}</td>
                              <td className="border border-black p-1 font-medium">{item.Item}</td>
                              <td className="border border-black p-1 text-center">{item.Bahan}</td>
                              <td className="border border-black p-1 text-center">{item.Ukuran}</td>
                              <td className="border border-black p-1 text-center font-bold">{item.Qty} PCS</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            ))
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

                  {/* Footer / Tanda Tangan Surat Jalan dengan Nama Pengirim Dinamis */}
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
        .a4-landscape-page {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10mm;
          background: white;
          padding: 10mm;
          margin-bottom: 20mm;
          border: 1px solid #ddd;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vertical-cut-line { display: none; }
        .label-card {
          border: 1px solid #000;
          padding: 10px;
          background: #fff;
          box-sizing: border-box;
          width: 100%;
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
            size: ${printMode === 'labels' ? 'A4 landscape' : '210mm 140mm landscape'};
            margin: 0mm;
          }
          body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
          .a4-landscape-page {
            width: 297mm;
            height: 210mm;
            padding: 8mm 10mm;
            box-sizing: border-box;
            page-break-after: always;
            break-after: page;
            border: none;
            box-shadow: none;
            position: relative;
            display: grid;
            grid-template-columns: 134mm 134mm;
            gap: 9mm;
            justify-content: center;
            align-content: center;
            margin: 0;
          }
          .vertical-cut-line {
            display: block;
            position: absolute;
            left: 50%;
            top: 8mm;
            bottom: 8mm;
            border-left: 2px dashed #333;
            transform: translateX(-50%);
            z-index: 10;
          }
          .label-card {
            width: 134mm;
            height: 194mm;
            border: 1px solid #000;
            padding: 8mm;
            box-sizing: border-box;
            background: #fff;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
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