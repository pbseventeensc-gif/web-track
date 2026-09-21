import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Printer, FileSpreadsheet, Layers, Truck } from 'lucide-react';

export default function FoodLabelTab({ isDarkMode }) {
  const [excelData, setExcelData] = useState([]);
  const [poolSummaryData, setPoolSummaryData] = useState([]);
  const [activeTab, setActiveTab] = useState('labels');
  
  const [projectName, setProjectName] = useState('POP AGUSTUS CHATIME (SPK-0726-04858) - JABODETABEK');
  const [companyTitle, setCompanyTitle] = useState('PT FOODS BEVERAGES INDONESIA');
  const [paperBahan, setPaperBahan] = useState('ART CARTON 210 1MUKA NON LAM');
  const [wellenLogo, setWellenLogo] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length > 1) {
        const headerRow1 = data[0]; 
        const headerRow2 = data[1]; 
        
        const itemColumns = [];
        let currentItemName = '';
        const maxCols = Math.max(headerRow1.length, headerRow2.length);

        for (let i = 6; i < maxCols; i++) {
          const colNameRaw = headerRow1[i];
          if (colNameRaw !== undefined && colNameRaw !== null && String(colNameRaw).trim() !== '') {
            currentItemName = String(colNameRaw).trim();
          }
          
          const sizeRaw = headerRow2[i] !== undefined && headerRow2[i] !== null ? String(headerRow2[i]).trim() : '';
          const itemSize = sizeRaw || (i % 2 === 1 ? 'A4' : 'A5');

          if (currentItemName) {
            itemColumns.push({
              index: i,
              name: currentItemName,
              size: itemSize
            });
          }
        }

        let lastPool = '';
        const rows = data.slice(3).map((row, index) => {
          if (!row[4]) return null; 

          if (row[1] && String(row[1]).trim() !== '') {
            lastPool = String(row[1]).trim();
          }

          const storeName = row[4];
          const poolName = lastPool || row[1] || '-';

          const itemsData = itemColumns.map((col) => {
            const qtyVal = row[col.index];
            return {
              name: col.name,
              size: col.size,
              qty: (qtyVal !== undefined && qtyVal !== null && qtyVal !== '') ? Number(qtyVal) : 0
            };
          }).filter(item => item.qty > 0);

          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const randomCode = String(1001 + index).slice(-4);
          const noSJ = `SJ-${yyyy}${mm}${dd}-${randomCode}`;

          return {
            no: row[0],
            pool: poolName,
            areaManager: row[2],
            site: row[3],
            storeName: storeName,
            city: row[5],
            noSJ: noSJ,
            itemsData: itemsData
          };
        }).filter(Boolean);

        setExcelData(rows);

        const poolMap = {};
        rows.forEach((store, idx) => {
          if (!poolMap[store.pool]) {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const uniqueCode = String(8801 + idx);
            const poolNoSJ = `SJ-${yyyy}${mm}${dd}-${uniqueCode}`;

            poolMap[store.pool] = {
              poolName: store.pool,
              stores: [],
              noSJ: poolNoSJ,
              itemTotals: {} 
            };
          }
          poolMap[store.pool].stores.push(store.storeName);

          store.itemsData.forEach((item) => {
            const compositeKey = `${item.name}___${item.size}`;
            if (!poolMap[store.pool].itemTotals[compositeKey]) {
              poolMap[store.pool].itemTotals[compositeKey] = {
                name: item.name,
                size: item.size,
                qty: 0
              };
            }
            poolMap[store.pool].itemTotals[compositeKey].qty += item.qty;
          });
        });

        const poolSummaryArray = Object.values(poolMap).map((p) => {
          const materialMap = {};
          Object.values(p.itemTotals).forEach((it) => {
            if (!materialMap[it.name]) {
              materialMap[it.name] = { name: it.name, sizes: [] };
            }
            materialMap[it.name].sizes.push({ size: it.size, qty: it.qty });
          });

          return {
            poolName: p.poolName,
            stores: p.stores,
            noSJ: p.noSJ,
            materials: Object.values(materialMap)
          };
        });

        setPoolSummaryData(poolSummaryArray);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        setWellenLogo(uploadEvt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [showAllScreenPreview, setShowAllScreenPreview] = useState(false);

  const handlePrint = () => {
    setShowAllScreenPreview(true);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Kelompokkan data label toko menjadi berpasangan (2 label per halaman HVS A4 Landscape)
  const labelPairs = [];
  for (let i = 0; i < excelData.length; i += 2) {
    labelPairs.push(excelData.slice(i, i + 2));
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media screen {
          .screen-hidden-item {
            display: none !important;
          }
        }

        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area, #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          .print-page-break {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .screen-hidden-item {
            display: flex !important;
          }

          ${activeTab === 'labels' ? `
            @page {
              size: A4 landscape;
              margin: 5mm;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
            }
            #printable-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 auto !important;
              padding: 0 !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
            }
            .label-pair-page {
              width: 280mm !important;
              max-width: 280mm !important;
              height: 185mm !important;
              max-height: 185mm !important;
              display: flex !important;
              flex-direction: row !important;
              justify-content: space-between !important;
              align-items: stretch !important;
              gap: 8mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              margin: 0 auto !important;
              padding: 0 !important;
            }
            .label-card-item {
              width: 48.5% !important;
              max-width: 48.5% !important;
              height: 185mm !important;
              max-height: 185mm !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: flex-start !important;
              padding: 4mm !important;
              border-width: 2px !important;
              border-radius: 16px !important;
              overflow: hidden !important;
            }
          ` : `
            @page {
              size: 20cm 13cm landscape;
              margin: 0mm;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            .delivery-order-doc {
              width: 20cm !important;
              height: 12.8cm !important;
              max-width: 20cm !important;
              max-height: 12.8cm !important;
              overflow: hidden !important;
              padding: 2mm !important;
              font-size: 7.5px !important;
              box-sizing: border-box !important;
              page-break-inside: avoid;
              break-inside: avoid;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
          `}
        }
      `}</style>

      {/* Header & Controls Panel */}
      <div className={`no-print p-6 rounded-3xl border shadow-sm flex flex-wrap items-center justify-between gap-4 ${
        isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'
      }`}>
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-orange-600 text-white">
            Custom Food Module
          </span>
          <h2 className="text-lg font-black tracking-wide uppercase mt-2 flex items-center gap-2">
            <Layers className="text-orange-500" /> Food Label & Pool Delivery Order Generator
          </h2>
          <p className="text-xs opacity-70 mt-0.5">Cetak Label Toko (2 Label per Lembar HVS A4 Landscape) & Surat Jalan Pool (20x13 cm).</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <label className="cursor-pointer bg-stone-700 hover:bg-stone-800 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow transition">
            <FileSpreadsheet size={16} />
            {wellenLogo ? 'Change Wellen Logo' : 'Upload Wellen Logo'}
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </label>

          <label className="cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow transition">
            <FileSpreadsheet size={16} />
            Upload Allocation Excel
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
          
          <button 
            onClick={handlePrint}
            disabled={excelData.length === 0}
            className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow disabled:opacity-50 transition cursor-pointer"
          >
            <Printer size={16} /> Print / Export PDF
          </button>
        </div>
      </div>

      {/* Navigasi Tab Tampilan */}
      {excelData.length > 0 && (
        <div className="no-print flex gap-2 border-b pb-3 dark:border-neutral-700">
          <button
            onClick={() => setActiveTab('labels')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'labels'
                ? 'bg-orange-600 text-white shadow'
                : 'bg-stone-200 dark:bg-neutral-700 text-stone-700 dark:text-stone-200'
            }`}
          >
            <Layers size={14} /> Store Label Preview ({excelData.length})
          </button>
          <button
            onClick={() => setActiveTab('delivery_orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'delivery_orders'
                ? 'bg-orange-600 text-white shadow'
                : 'bg-stone-200 dark:bg-neutral-700 text-stone-700 dark:text-stone-200'
            }`}
          >
            <Truck size={14} /> Delivery Order Preview 20x13 cm Landscape ({poolSummaryData.length})
          </button>
        </div>
      )}

      {/* Pengaturan Teks */}
      <div className={`no-print p-4 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 ${
        isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'
      }`}>
        <div>
          <label className="block text-xs font-bold opacity-70 mb-1">Company / PT Title</label>
          <input 
            type="text" 
            value={companyTitle} 
            onChange={(e) => setCompanyTitle(e.target.value)} 
            className={`w-full border rounded-xl px-3 py-2 text-xs font-medium ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-800'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-bold opacity-70 mb-1">Project / SPK Name</label>
          <input 
            type="text" 
            value={projectName} 
            onChange={(e) => setProjectName(e.target.value)} 
            className={`w-full border rounded-xl px-3 py-2 text-xs font-medium ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-800'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-bold opacity-70 mb-1">Material Description</label>
          <input 
            type="text" 
            value={paperBahan} 
            onChange={(e) => setPaperBahan(e.target.value)} 
            className={`w-full border rounded-xl px-3 py-2 text-xs font-medium ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-800'
            }`}
          />
        </div>
      </div>

      {/* Banner Notifikasi Mode Preview Cepat */}
      {excelData.length > 0 && labelPairs.length > 6 && (
        <div className="no-print p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚡</span>
            <div>
              <span className="font-bold">Mode Preview Cepat:</span> Menampilkan {showAllScreenPreview ? labelPairs.length : 6} dari {labelPairs.length} halaman ({excelData.length} label toko) di layar agar loading super instan.
              <span className="block text-[11px] opacity-80 mt-0.5">
                💡 Saat Anda klik <strong>"Print / Export PDF"</strong>, <strong>SELURUH {labelPairs.length} halaman ({excelData.length} label) akan tercetak lengkap!</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAllScreenPreview(!showAllScreenPreview)}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs flex-shrink-0"
          >
            {showAllScreenPreview ? '⚡ Aktifkan Mode Cepat (6 Halaman)' : `👁️ Tampilkan Semua ${labelPairs.length} Halaman di Layar`}
          </button>
        </div>
      )}

      {/* Printable Area */}
      <div id="printable-area" className="space-y-6">
        {excelData.length === 0 ? (
          <div className={`no-print text-center py-16 rounded-3xl border border-dashed ${
            isDarkMode ? 'bg-neutral-800/50 border-neutral-700 text-neutral-400' : 'bg-white border-stone-300 text-stone-500'
          }`}>
            <FileSpreadsheet className="mx-auto h-12 w-12 opacity-40 mb-3" />
            <p className="font-bold text-sm">No Excel file uploaded yet.</p>
            <p className="text-xs opacity-70 mt-1">Please upload a Food Label Excel file to display the print preview.</p>
          </div>
        ) : activeTab === 'labels' ? (
          <div className="space-y-8">
            {labelPairs.map((pair, pageIdx) => (
              <div
                key={pageIdx}
                className={`label-pair-page bg-white text-black print-page-break mx-auto flex flex-col md:flex-row gap-6 justify-between items-stretch w-full max-w-[280mm] min-h-[185mm] mb-8 ${!showAllScreenPreview && pageIdx >= 6 ? 'screen-hidden-item' : ''}`}
              >
                {pair.map((store, idx) => {
                  const activeItems = store.itemsData;
                  const globalIndex = pageIdx * 2 + idx + 1;
                  const totalKoli = excelData.length;

                  return (
                    <div
                      key={idx}
                      className="label-card-item bg-white text-black border-2 border-neutral-900 p-4 sm:p-5 rounded-2xl shadow-sm flex-1 w-full md:w-[48.5%] min-h-[182mm] max-h-[184mm] overflow-hidden flex flex-col justify-start"
                    >
                      {/* Header dengan Koli Indicator */}
                      <div className="relative border-b-2 border-neutral-900 pb-2 mb-2.5 flex items-center justify-between">
                        {wellenLogo ? (
                          <div className="flex-shrink-0">
                            <img src={wellenLogo} alt="Logo Wellen" className="h-8 sm:h-9 w-auto object-contain" />
                          </div>
                        ) : (
                          <div className="w-8" />
                        )}
                        <div className="text-center flex-1 px-2">
                          <h3 className="font-extrabold text-xs sm:text-base tracking-wide uppercase">{companyTitle}</h3>
                          <p className="text-[11px] sm:text-xs font-bold text-neutral-800">{projectName}</p>
                        </div>
                        <div className="text-right flex-shrink-0 font-extrabold text-[11px] sm:text-xs bg-neutral-100 border-2 border-neutral-900 px-2 py-0.5 rounded-lg whitespace-nowrap">
                          KOLI {globalIndex} OF {totalKoli}
                        </div>
                      </div>

                      {/* POOL & STORE Info */}
                      <div className="text-xs sm:text-sm font-bold mb-2.5 space-y-0.5 text-neutral-900">
                        <div className="flex"><span className="w-16 sm:w-18">POOL</span><span>: {store.pool}</span></div>
                        <div className="flex"><span className="w-16 sm:w-18">STORE</span><span>: {store.storeName}</span></div>
                      </div>

                      {/* Table Fixed Width 100% */}
                      <table className="w-full table-fixed border-collapse border-2 border-neutral-900 text-xs">
                        <thead>
                          <tr className="bg-neutral-100 text-center font-bold text-[10.5px] sm:text-xs">
                            <th className="border-2 border-neutral-900 p-1 sm:p-1.5 w-[5%]">NO</th>
                            <th className="border-2 border-neutral-900 p-1 sm:p-1.5 text-left w-[49%]">ITEM</th>
                            <th className="border-2 border-neutral-900 p-1 sm:p-1.5 w-[19%]">BAHAN</th>
                            <th className="border-2 border-neutral-900 p-1 sm:p-1.5 w-[13%]">UKURAN</th>
                            <th className="border-2 border-neutral-900 p-1 sm:p-1.5 w-[7%]">QTY</th>
                            <th className="border-2 border-neutral-900 p-1 sm:p-1.5 w-[7%]">SAT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeItems.map((item, itemIdx) => (
                            <tr key={itemIdx}>
                              <td className="border-2 border-neutral-900 p-1 sm:p-1.5 text-center font-semibold text-[10px] sm:text-[11px]">{itemIdx + 1}</td>
                              <td className="border-2 border-neutral-900 p-1 sm:p-1.5 font-bold text-[9.5px] sm:text-[10px] leading-tight whitespace-nowrap overflow-hidden">{item.name}</td>
                              {itemIdx === 0 && (
                                <td className="border-2 border-neutral-900 p-1 sm:p-1.5 text-center align-middle font-bold" rowSpan={activeItems.length}>
                                  <span className="text-[10px] sm:text-[11px] leading-snug block">{paperBahan}</span>
                                </td>
                              )}
                              <td className="border-2 border-neutral-900 p-1 sm:p-1.5 text-center font-extrabold text-[10px] sm:text-[11px]">{item.size}</td>
                              <td className="border-2 border-neutral-900 p-1 sm:p-1.5 text-center font-extrabold text-[10px] sm:text-[11px]">{item.qty}</td>
                              <td className="border-2 border-neutral-900 p-1 sm:p-1.5 text-center font-semibold text-[10px] sm:text-[11px]">PCS</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                {pair.length === 1 && (
                  <div className="hidden md:block flex-1 w-[48.5%] invisible" />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* PRATINJAU SURAT JALAN 20x13 CM LANDSCAPE (STRICT 1 HALAMAN) */
          <div className="space-y-6">
            {poolSummaryData.map((pool, idx) => (
              <div
                key={idx}
                className={`bg-white text-black border-2 border-neutral-900 rounded-xl shadow-sm print-page-break mx-auto delivery-order-doc ${!showAllScreenPreview && idx >= 6 ? 'screen-hidden-item' : ''}`}
                style={{ width: '20cm', height: '12.8cm', boxSizing: 'border-box' }}
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-0.5 mb-1">
                    <div className="flex items-center gap-1.5">
                      {wellenLogo ? (
                        <img src={wellenLogo} alt="Logo Wellen" className="h-5 w-auto object-contain" />
                      ) : (
                        <div className="font-black text-[9px] border px-1 py-0.2">WELLEN</div>
                      )}
                      <div className="text-[7.5px] leading-tight text-neutral-800">
                        <p className="font-black uppercase">{companyTitle}</p>
                        <p>Jl. Ps Minggu Raya Kav. 2 No. 49, Duren Tiga, Jakarta Selatan</p>
                      </div>
                    </div>
                    <div className="text-right space-y-0.2">
                      <span className="font-black text-[8px] border border-neutral-900 px-1.5 py-0.2 bg-neutral-100 block">TANDA TERIMA / SURAT JALAN</span>
                      <span className="font-mono font-bold text-[8.5px] text-neutral-900 block">{pool.noSJ}</span>
                    </div>
                  </div>

                  {/* Info Kepada & Pool */}
                  <div className="border border-neutral-900 p-1 text-[8.5px] space-y-0.2 bg-neutral-50 mb-1">
                    <div className="flex font-bold">
                      <span className="w-24">KEPADA</span>
                      <span>: {companyTitle}</span>
                    </div>
                    <div className="flex font-bold text-orange-700">
                      <span className="w-24">KIRIM KE (POOL)</span>
                      <span>: {pool.poolName}</span>
                    </div>
                  </div>

                  {/* Tabel Super Padat */}
                  <table className="w-full border-collapse border border-neutral-900 text-[8px]">
                    <thead>
                      <tr className="bg-neutral-100 text-center font-bold">
                        <th className="border border-neutral-900 p-0.2 w-6">NO</th>
                        <th className="border border-neutral-900 p-0.2 text-left">KETERANGAN / MATERI & BAHAN</th>
                        <th className="border border-neutral-900 p-0.2 w-12">JUMLAH</th>
                        <th className="border border-neutral-900 p-0.2 w-8">SAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pool.materials.map((mat, mIdx) => (
                        <React.Fragment key={mIdx}>
                          <tr>
                            <td className="border border-neutral-900 p-0.2 text-center font-bold align-top" rowSpan={mat.sizes.length + 1}>
                              {mIdx + 1}
                            </td>
                            <td colSpan="3" className="border border-neutral-900 p-0.2 font-bold bg-neutral-50/50">
                              MATERI : {mat.name}
                            </td>
                          </tr>
                          {mat.sizes.map((sz, sIdx) => (
                            <tr key={sIdx}>
                              <td className="border border-neutral-900 p-0.2 pl-2 text-neutral-800">
                                {paperBahan} ( UK {sz.size} )
                              </td>
                              <td className="border border-neutral-900 p-0.2 text-center font-bold">
                                {sz.qty}
                              </td>
                              <td className="border border-neutral-900 p-0.2 text-center">
                                PCS
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Tanda Tangan */}
                <div className="pt-0.5 mt-[1mm] flex justify-between text-[8px] font-semibold border-t border-neutral-300">
                  <div>
                    <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</p>
                    <p className="mt-0.2">Hormat Kami,</p>
                    <div className="h-3"></div>
                    <p className="font-bold underline">NINING</p>
                  </div>
                  <div className="text-right">
                    <p className="invisible">Spacer</p>
                    <p className="mt-0.2">Diterima Oleh,</p>
                    <div className="h-3"></div>
                    <p className="font-bold underline">( _________________________ )</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}