import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Printer, FileSpreadsheet, Layers } from 'lucide-react';

export default function FoodLabelTab({ isDarkMode }) {
  const [excelData, setExcelData] = useState([]);
  const [projectName, setProjectName] = useState('POP AGUSTUS CHATIME (SPK-0726-04858) - JABODETABEK');
  const [companyTitle, setCompanyTitle] = useState('PT FOODS BEVERAGES INDONESIA');
  const [paperBahan, setPaperBahan] = useState('ART CARTON 210 1MUKA NON LAM');
  const [wellenLogo, setWellenLogo] = useState(null); // State untuk Logo Wellen

  // Handle Upload File Excel Alokasi
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

        for (let i = 6; i < headerRow1.length; i++) {
          const colNameRaw = headerRow1[i];
          if (colNameRaw !== undefined && colNameRaw !== null && String(colNameRaw).trim() !== '') {
            currentItemName = String(colNameRaw).trim();
          }
          
          const sizeRaw = headerRow2[i] ? String(headerRow2[i]).trim().toUpperCase() : '';
          
          // Deteksi ukuran: cek teks 'A4' atau gunakan pola posisi kolom berpasangan (indeks ganjil = A4)
          let itemSize = 'A5';
          if (sizeRaw.includes('A4') || (sizeRaw === '' && i % 2 === 1)) {
            itemSize = 'A4';
          }

          if (currentItemName) {
            itemColumns.push({
              index: i,
              name: currentItemName,
              size: itemSize
            });
          }
        }

        let lastPool = '';
        const rows = data.slice(3).map((row) => {
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

          return {
            no: row[0],
            pool: poolName,
            areaManager: row[2],
            site: row[3],
            storeName: storeName,
            city: row[5],
            itemsData: itemsData
          };
        }).filter(Boolean);

        setExcelData(rows);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle Upload Logo Wellen
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* CSS Khusus Print (Menyembunyikan menu web & hanya mencetak area label) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-label-area, #printable-label-area * {
            visibility: visible;
          }
          #printable-label-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header & Controls Panel (Disembunyikan saat print) */}
      <div className={`no-print p-6 rounded-3xl border shadow-sm flex flex-wrap items-center justify-between gap-4 ${
        isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'
      }`}>
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-orange-600 text-white">
            Custom Food Module
          </span>
          <h2 className="text-lg font-black tracking-wide uppercase mt-2 flex items-center gap-2">
            <Layers className="text-orange-500" /> Food Label Generator (2-in-1 A4)
          </h2>
          <p className="text-xs opacity-70 mt-0.5">Import Excel alokasi store makanan, atur logo Wellen, dan cetak label bersih tanpa menu web.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* Tombol Upload Logo Wellen */}
          <label className="cursor-pointer bg-stone-700 hover:bg-stone-800 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow transition">
            <FileSpreadsheet size={16} />
            {wellenLogo ? 'Ganti Logo Wellen' : 'Upload Logo Wellen'}
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </label>

          <label className="cursor-pointer bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow transition">
            <FileSpreadsheet size={16} />
            Upload Excel Alokasi
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
          
          <button 
            onClick={handlePrint}
            disabled={excelData.length === 0}
            className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow disabled:opacity-50 transition"
          >
            <Printer size={16} /> Cetak / Export PDF
          </button>
        </div>
      </div>

      {/* Pengaturan Teks Label (Disembunyikan saat print) */}
      <div className={`no-print p-4 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 ${
        isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'
      }`}>
        <div>
          <label className="block text-xs font-bold opacity-70 mb-1">Judul PT / Perusahaan</label>
          <input 
            type="text" 
            value={companyTitle} 
            onChange={(e) => setCompanyTitle(e.target.value)} 
            className={`w-full border rounded-xl px-3 py-2 text-xs font-medium ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-bold opacity-70 mb-1">Nama Project / SPK</label>
          <input 
            type="text" 
            value={projectName} 
            onChange={(e) => setProjectName(e.target.value)} 
            className={`w-full border rounded-xl px-3 py-2 text-xs font-medium ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs font-bold opacity-70 mb-1">Keterangan Bahan Baku</label>
          <input 
            type="text" 
            value={paperBahan} 
            onChange={(e) => setPaperBahan(e.target.value)} 
            className={`w-full border rounded-xl px-3 py-2 text-xs font-medium ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200'
            }`}
          />
        </div>
      </div>

      {/* Preview & Printable Area */}
      <div id="printable-label-area" className="space-y-6">
        {excelData.length === 0 ? (
          <div className={`no-print text-center py-16 rounded-3xl border border-dashed ${
            isDarkMode ? 'bg-neutral-800/50 border-neutral-700 text-neutral-400' : 'bg-white border-stone-300 text-stone-500'
          }`}>
            <FileSpreadsheet className="mx-auto h-12 w-12 opacity-40 mb-3" />
            <p className="font-bold text-sm">Belum ada file Excel yang diunggah.</p>
            <p className="text-xs opacity-70 mt-1">Silakan upload file Excel berformat Food Label untuk menampilkan pratinjau cetak.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {excelData.map((store, idx) => {
              const activeItems = store.itemsData;

              return (
                <div 
                  key={idx} 
                  className="bg-white text-black border-2 border-neutral-900 p-4 rounded-xl shadow-sm print:break-inside-avoid print:mb-6 mx-auto" 
                  style={{ width: '100%', maxWidth: '210mm' }}
                >
                  {/* Header Label dengan Logo Wellen di Kiri Atas */}
                  <div className="relative border-b-2 border-neutral-900 pb-2 mb-2 flex items-center justify-center">
                    {wellenLogo && (
                      <div className="absolute left-2 top-1">
                        <img src={wellenLogo} alt="Logo Wellen" className="h-8 w-auto object-contain" />
                      </div>
                    )}
                    <div className="text-center w-full px-10">
                      <h3 className="font-extrabold text-sm tracking-wide">{companyTitle}</h3>
                      <p className="text-[11px] font-bold">{projectName}</p>
                    </div>
                  </div>

                  {/* Sub Header Store Info */}
                  <div className="text-[11px] font-bold mb-2 space-y-0.5 text-neutral-800">
                    <div className="flex">
                      <span className="w-16">POOL</span>
                      <span>: {store.pool}</span>
                    </div>
                    <div className="flex">
                      <span className="w-16">STORE</span>
                      <span>: {store.storeName}</span>
                    </div>
                  </div>

                  {/* Tabel Item */}
                  <table className="w-full border-collapse border border-neutral-900 text-[11px]">
                    <thead>
                      <tr className="bg-neutral-100 text-center font-bold">
                        <th className="border border-neutral-900 p-1 w-8">NO</th>
                        <th className="border border-neutral-900 p-1">ITEM</th>
                        <th className="border border-neutral-900 p-1 w-24">BAHAN</th>
                        <th className="border border-neutral-900 p-1 w-12">UKURAN</th>
                        <th className="border border-neutral-900 p-1 w-12">QTY</th>
                        <th className="border border-neutral-900 p-1 w-12">SAT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeItems.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center p-4 text-neutral-400 italic">Tidak ada item yang di-order (Qty 0 semua)</td>
                        </tr>
                      ) : (
                        activeItems.map((item, itemIdx) => (
                          <tr key={itemIdx}>
                            <td className="border border-neutral-900 p-1 text-center font-medium">{itemIdx + 1}</td>
                            <td className="border border-neutral-900 p-1 font-semibold">{item.name}</td>
                            {itemIdx === 0 && (
                              <td className="border border-neutral-900 p-1 text-center align-middle font-medium" rowSpan={activeItems.length}>
                                <span className="text-[10px] leading-tight block">{paperBahan}</span>
                              </td>
                            )}
                            <td className="border border-neutral-900 p-1 text-center font-bold">{item.size}</td>
                            <td className="border border-neutral-900 p-1 text-center font-bold">{item.qty}</td>
                            <td className="border border-neutral-900 p-1 text-center">PCS</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}