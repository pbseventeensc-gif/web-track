import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabaseClient';

export default function KawanLamaMultiLabelGenerator({ isDarkMode }) {
  const [labels, setLabels] = useState({});
  const [selectedPt, setSelectedPt] = useState('PT HOME CENTER INDONESIA RETAIL');
  const [activePromoTitle, setActivePromoTitle] = useState('PROMO AKTIF');
  const [spkNumber, setSpkNumber] = useState('SJ-0826-01920');
  const [printMode, setPrintMode] = useState('labels'); // 'labels' atau 'do'
  
  const [wellenPrintLogo, setWellenPrintLogo] = useState(() => {
    return localStorage.getItem('wellen_print_logo_kawanlama') || null;
  });

  useEffect(() => {
    if (wellenPrintLogo) {
      localStorage.setItem('wellen_print_logo_kawanlama', wellenPrintLogo);
    }
    fetchActivePromoTitle();
  }, []);

  const fetchActivePromoTitle = async () => {
    const { data } = await supabase
      .from('kl_promos')
      .select('title')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.title) {
      setActivePromoTitle(data.title);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
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

  return (
    <div className={`p-6 rounded-3xl shadow-sm space-y-6 border ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
      
      {/* Kontrol Atas / Panel Kontrol */}
      <div className={`flex flex-col border-b pb-5 gap-4 print:hidden ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className={`font-extrabold text-base tracking-wide ${isDarkMode ? 'text-white' : 'text-stone-800'}`}>
              🏷️ Kawan Lama Group - Multi Label & Surat Jalan Generator
            </h2>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              Nomor DO hanya digenerate jika kolom No DO bernilai "unik", jika kosong akan dikosongkan.
            </p>
          </div>

          {/* Tombol Switch Mode Cetak */}
          <div className="flex items-center gap-2 bg-stone-200 dark:bg-neutral-900 p-1.5 rounded-2xl border border-stone-300 dark:border-neutral-700">
            <button
              onClick={() => setPrintMode('labels')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                printMode === 'labels' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-stone-700 dark:text-neutral-300 hover:bg-stone-300 dark:hover:bg-neutral-800'
              }`}
            >
              🏷️ Cetak Label 2-in-1
            </button>
            <button
              onClick={() => setPrintMode('do')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                printMode === 'do' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-stone-700 dark:text-neutral-300 hover:bg-stone-300 dark:hover:bg-neutral-800'
              }`}
            >
              📄 Cetak Surat Jalan (DO)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Pilihan PT */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-[11px] font-bold ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
              Pilih PT / Perusahaan:
            </label>
            <select 
              value={selectedPt} 
              onChange={(e) => setSelectedPt(e.target.value)} 
              className={`text-xs border p-2.5 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-neutral-900 border-neutral-700 text-white' 
                  : 'bg-stone-50 border-stone-300 text-stone-800'
              }`}
            >
              <option value="PT HOME CENTER INDONESIA RETAIL">AZKO (Home Center)</option>
              <option value="PT KRISBOW INDONESIA">KRISBOW</option>
              <option value="PT INFORMA RETAIL">INFORMA</option>
              <option value="PT LIVING PLAZA">LIVING PLAZA</option>
              <option value="PT GINDACO INDONESIA">GINDACO</option>
            </select>
          </div>

          {/* Input No SPK / No Surat Jalan */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-[11px] font-bold ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
              No. SPK / Surat Jalan:
            </label>
            <input 
              type="text" 
              value={spkNumber} 
              onChange={(e) => setSpkNumber(e.target.value)} 
              className={`text-xs border p-2.5 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-neutral-900 border-neutral-700 text-white' 
                  : 'bg-stone-50 border-stone-300 text-stone-800'
              }`}
            />
          </div>

          {/* Upload File Excel */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-[11px] font-bold ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
              Upload Excel Alokasi:
            </label>
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={handleFileUpload} 
              className={`text-xs border p-2 rounded-xl cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold ${
                isDarkMode 
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-300 file:bg-neutral-800 file:text-indigo-300 hover:file:bg-neutral-700' 
                  : 'bg-stone-50 border-stone-300 text-stone-600 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100'
              }`} 
            />
          </div>

          {/* Upload Logo Wellen */}
          <div className="flex flex-col gap-1.5">
            <label className={`text-[11px] font-bold ${isDarkMode ? 'text-neutral-300' : 'text-stone-600'}`}>
              Logo Wellen (Terkunci):
            </label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleLogoUpload} 
              className={`text-xs border p-2 rounded-xl cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-bold ${
                isDarkMode 
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-300 file:bg-neutral-800 file:text-stone-300 hover:file:bg-neutral-700' 
                  : 'bg-stone-50 border-stone-300 text-stone-600 file:bg-stone-200 file:text-stone-700 hover:file:bg-stone-300'
              }`} 
            />
          </div>

          {/* Tombol Cetak */}
          <div>
            <button 
              onClick={() => window.print()} 
              className={`w-full py-2.5 px-4 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                printMode === 'labels' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              🖨️ {printMode === 'labels' ? 'Cetak Semua Label' : 'Cetak Surat Jalan'}
            </button>
          </div>
        </div>
      </div>

      {/* Area Konten / Cetak */}
      <div className="print-container">
        {totalRegions === 0 ? (
          <div className={`text-center py-16 border-2 border-dashed rounded-3xl text-xs ${isDarkMode ? 'border-neutral-700 text-neutral-400' : 'border-stone-300 text-stone-400'}`}>
            Silakan pilih PT dan upload file Excel alokasi untuk mulai mencetak.
          </div>
        ) : (
          printMode === 'labels' ? (
            // ================= RENDER LABEL 2-IN-1 =================
            pagePairs.map((pair, pageIdx) => (
              <div key={pageIdx} className="a4-landscape-page relative">
                <div className="vertical-cut-line"></div>

                {pair.map((storeName, cardIdx) => {
                  const absoluteIndex = pageIdx * 2 + cardIdx + 1;
                  return (
                    <div key={cardIdx} className="label-card relative text-stone-900">
                      <div className="absolute top-2.5 right-2.5 bg-stone-100 border border-stone-300 px-2.5 py-0.5 rounded text-[11px] font-bold text-stone-800">
                        {absoluteIndex} OF {totalRegions}
                      </div>

                      <div className="flex items-center border-b-2 border-black pb-2.5 mb-3 pr-16">
                        <div className="h-16 w-44 flex items-center justify-start">
                          {wellenPrintLogo ? <img src={wellenPrintLogo} className="h-full object-contain" alt="Logo" /> : <div className="text-[10px] border p-2 italic text-stone-800">[Upload Logo]</div>}
                        </div>
                        <div className="flex-grow text-center">
                          <h1 className="font-bold text-base uppercase text-stone-900">{selectedPt}</h1>
                          <p className="font-bold text-[10px] mt-0.5 uppercase text-stone-900">
                            {activePromoTitle} ( {spkNumber} )
                          </p>
                        </div>
                      </div>
                      <div className="mb-2.5 font-bold text-sm text-stone-900">STORE / REGION : {storeName}</div>
                      <table className="w-full border-collapse border border-black text-xs text-stone-900">
                        <thead>
                          <tr className="bg-gray-100 text-stone-900">
                            <th className="border border-black p-1.5 w-10 text-center font-bold">NO</th>
                            <th className="border border-black p-1.5 text-left font-bold">ITEM</th>
                            <th className="border border-black p-1.5 w-36 text-center font-bold">BAHAN</th>
                            <th className="border border-black p-1.5 w-28 text-center font-bold">UKURAN</th>
                            <th className="border border-black p-1.5 w-20 text-center font-bold">QTY</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labels[storeName].map((item, i) => (
                            <tr key={i} className="text-stone-900">
                              <td className="border border-black p-1.5 text-center font-medium">{i + 1}</td>
                              <td className="border border-black p-1.5 font-medium">{item.Item}</td>
                              <td className="border border-black p-1.5 text-center">{item.Bahan}</td>
                              <td className="border border-black p-1.5 text-center">{item.Ukuran}</td>
                              <td className="border border-black p-1.5 text-center font-bold">{item.Qty} PCS</td>
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
              
              // Cek apakah ada item di store ini yang kolom "No DO" nya bernilai "unik"
              const hasUniqueTag = storeItems.some(item => {
                const val = String(item['No DO'] || item.NoDO || item['no do'] || '').trim().toLowerCase();
                return val === 'unik';
              });

              // Jika ada "unik", generate nomor DO unik sistem (misal: SPK + U + Nomor Urut Toko), jika tidak kosongkan ("")
              const generatedUniqueDo = `${spkNumber}-U${storeIdx + 1}`;
              const finalDoNumber = hasUniqueTag ? generatedUniqueDo : '';

              return (
                <div key={storeIdx} className="surat-jalan-page relative text-black bg-white p-8 mb-6 border border-stone-300 shadow-sm mx-auto">
                  {/* Header Surat Jalan */}
                  <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                    <div className="space-y-1">
                      <div className="h-16 w-48 flex items-center justify-start">
                        {wellenPrintLogo ? <img src={wellenPrintLogo} className="h-full object-contain" alt="Logo" /> : <div className="text-xs border p-2 italic">[Upload Logo]</div>}
                      </div>
                      <p className="text-[10px] text-stone-700 max-w-xs leading-tight">
                        Jl. Raya Pasar Minggu No. 49 RT.002 RW. 007 Duren Tiga, Jakarta<br />
                        Telp. 021 -5506999 &nbsp;&nbsp;|&nbsp;&nbsp; Fax -
                      </p>
                    </div>

                    <div className="text-right">
                      <h1 className="font-extrabold text-xl tracking-wide uppercase">SURAT JALAN</h1>
                      {/* Tampilkan nomor DO unik jika ada, jika kosong maka tidak ditampilkan */}
                      {finalDoNumber ? (
                        <p className="font-extrabold text-base text-black mt-0.5">{finalDoNumber}</p>
                      ) : null}
                      <div className="mt-2 text-left text-xs">
                        <span className="font-bold">Kepada Yth, :</span><br />
                        <span className="font-extrabold uppercase">{selectedPt}</span><br />
                        <span className="font-semibold text-stone-800">STORE : {storeName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Item Surat Jalan */}
                  <table className="w-full border-collapse border border-black text-xs mb-0">
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
                          <td className="border-r border-black p-2 text-center font-medium">{i + 1}</td>
                          <td className="border-r border-black p-2 font-medium uppercase">
                            {item.Item} {item.Bahan ? `_ ${item.Bahan}` : ''}
                          </td>
                          <td className="border-r border-black p-2 text-center font-mono">{item.Ukuran || '-'}</td>
                          <td className="p-2 text-center font-bold font-mono">{item.Qty}</td>
                        </tr>
                      ))}
                      {/* Baris kosong penyeimbang tampilan agar rapi */}
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
                        <td className="p-2 text-center font-mono text-sm">{totalQty}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Footer / Tanda Tangan Surat Jalan */}
                  <div className="border border-t-0 border-black grid grid-cols-4 text-[11px]">
                    <div className="p-2 border-r border-black space-y-1">
                      <p><span className="font-bold">Tgl</span> : {currentDateStr}</p>
                      <p><span className="font-bold">Nama File</span> : {activePromoTitle}</p>
                      <div className="pt-6">
                        <p><span className="font-bold">Inv</span> : WPP 0826-301349</p>
                        <p><span className="font-bold">PO</span> : -</p>
                      </div>
                    </div>
                    <div className="p-2 border-r border-black flex flex-col justify-between text-center">
                      <span className="font-bold">DIBUAT OLEH</span>
                      <div className="pt-12 pb-2">
                        <span className="border-b border-black pb-0.5 px-4 font-semibold">Arini Lidya</span>
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
          gap: 15mm;
          background: white;
          padding: 10mm;
          margin-bottom: 20mm;
          border: 1px solid #ddd;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vertical-cut-line { display: none; }
        .label-card {
          border: 1px solid #000;
          padding: 12px;
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
          border: 1px solid #ccc;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
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
            grid-template-columns: 136mm 136mm;
            gap: 5mm;
            justify-content: center;
            align-content: center;
          }
          .vertical-cut-line {
            display: block;
            position: absolute;
            left: 50%;
            top: 5mm;
            bottom: 5mm;
            border-left: 2px dashed #444;
            transform: translateX(-50%);
            z-index: 10;
          }
          .label-card {
            width: 136mm;
            height: 194mm;
            border: 1px solid #000;
            padding: 10mm;
            box-sizing: border-box;
            background: #fff;
            page-break-inside: avoid;
            break-inside: avoid;
            display: flex;
            flex-direction: column;
          }
          .surat-jalan-page {
            width: 100%;
            height: auto;
            border: none;
            box-shadow: none;
            padding: 0;
            margin: 0;
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
}