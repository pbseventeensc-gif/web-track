import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function KawanLamaMultiLabelGenerator() {
  const [labels, setLabels] = useState({});
  const [selectedPt, setSelectedPt] = useState('PT HOME CENTER INDONESIA RETAIL');
  
  const [wellenPrintLogo, setWellenPrintLogo] = useState(() => {
    return localStorage.getItem('wellen_print_logo_kawanlama') || null;
  });

  useEffect(() => {
    if (wellenPrintLogo) {
      localStorage.setItem('wellen_print_logo_kawanlama', wellenPrintLogo);
    }
  }, [wellenPrintLogo]);

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

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden border-b pb-4">
        <div>
          <h2 className="font-bold text-lg text-stone-800">🏷️ Kawan Lama Group - Multi Label Generator</h2>
          <p className="text-xs text-stone-500">Layout Landscape Simetris & Tabel Maksimal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedPt} onChange={(e) => setSelectedPt(e.target.value)} className="text-xs border p-2 rounded-lg font-bold bg-stone-50">
            <option value="PT HOME CENTER INDONESIA RETAIL">AZKO (Home Center)</option>
            <option value="PT KRISBOW INDONESIA">KRISBOW</option>
            <option value="PT INFORMA RETAIL">INFORMA</option>
            <option value="PT LIVING PLAZA">LIVING PLAZA</option>
            <option value="PT GINDACO INDONESIA">GINDACO</option>
          </select>
          <input type="file" accept=".xlsx" onChange={handleFileUpload} className="text-xs border p-1 rounded-lg" />
          <div className="flex flex-col text-[9px]">
            <span className="mb-1">Logo Wellen (Terkunci):</span>
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-xs border p-1 rounded-lg" />
          </div>
          <button onClick={() => window.print()} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-xs shadow-md">🖨️ Cetak Semua</button>
        </div>
      </div>

      <div className="print-container">
        {totalRegions === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl text-stone-400 text-xs">Silakan upload file Excel untuk mulai mencetak.</div>
        ) : (
          pagePairs.map((pair, pageIdx) => (
            <div key={pageIdx} className="a4-landscape-page relative">
              <div className="vertical-cut-line"></div>

              {pair.map((storeName, cardIdx) => {
                const absoluteIndex = pageIdx * 2 + cardIdx + 1;
                return (
                  <div key={cardIdx} className="label-card relative">
                    <div className="absolute top-2.5 right-2.5 bg-stone-100 border border-stone-300 px-2.5 py-0.5 rounded text-[11px] font-bold">
                      {absoluteIndex} OF {totalRegions}
                    </div>

                    <div className="flex items-center border-b-2 border-black pb-2.5 mb-3 pr-16">
                      <div className="h-16 w-44 flex items-center justify-start">
                        {wellenPrintLogo ? <img src={wellenPrintLogo} className="h-full object-contain" /> : <div className="text-[10px] border p-2 italic">[Upload Logo]</div>}
                      </div>
                      <div className="flex-grow text-center">
                        <h1 className="font-bold text-base uppercase">{selectedPt}</h1>
                        <p className="font-bold text-[10px] mt-0.5">DENSITY SIGNAGE ( SPK-0726-02320 )</p>
                      </div>
                    </div>
                    <div className="mb-2.5 font-bold text-sm">STORE / REGION : {storeName}</div>
                    <table className="w-full border-collapse border border-black text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-black p-1.5 w-10 text-center">NO</th>
                          <th className="border border-black p-1.5 text-left">ITEM</th>
                          <th className="border border-black p-1.5 w-36 text-center">BAHAN</th>
                          <th className="border border-black p-1.5 w-28 text-center">UKURAN</th>
                          <th className="border border-black p-1.5 w-20 text-center">QTY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labels[storeName].map((item, i) => (
                          <tr key={i}>
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
        )}
      </div>

      <style>{`
        .a4-landscape-page {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15mm;
          background: white;
          padding: 10mm;
          margin-bottom: 20px;
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
        @media print {
          @page { size: A4 landscape; margin: 0; }
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
        }
      `}</style>
    </div>
  );
}