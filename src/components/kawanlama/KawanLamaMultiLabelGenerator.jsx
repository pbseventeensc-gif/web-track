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

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden border-b pb-4">
        <div>
          <h2 className="font-bold text-lg text-stone-800">🏷️ Kawan Lama Group - Multi Label Generator</h2>
          <p className="text-xs text-stone-500">Layout 2-in-1 dengan garis potong & satuan PCS (Pilih Landscape saat cetak).</p>
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
        {Object.keys(labels).length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl text-stone-400 text-xs">Silakan upload file Excel untuk mulai mencetak.</div>
        ) : (
          Object.keys(labels).map((storeName, index) => (
            <div key={index} className="label-card relative">
              <div className="flex items-center border-b-2 border-black pb-2 mb-3">
                <div className="h-16 w-48 flex items-center justify-start">
                  {wellenPrintLogo ? <img src={wellenPrintLogo} className="h-full object-contain" /> : <div className="text-[10px] border p-2 italic">[Upload Logo]</div>}
                </div>
                <div className="flex-grow text-center pr-12">
                  <h1 className="font-bold text-lg uppercase">{selectedPt}</h1>
                  <p className="font-bold text-xs mt-1">DENSITY SIGNAGE ( SPK-0726-02320 )</p>
                </div>
              </div>
              <div className="mb-2 font-bold text-sm">STORE / REGION : {storeName}</div>
              <table className="w-full border-collapse border border-black text-[11px]">
                <thead><tr className="bg-gray-100"><th className="border border-black p-1">NO</th><th className="border border-black p-1 text-left">ITEM</th><th className="border border-black p-1">BAHAN</th><th className="border border-black p-1">UKURAN</th><th className="border border-black p-1">QTY</th></tr></thead>
                <tbody>
                  {labels[storeName].map((item, i) => (
                    <tr key={i}>
                      <td className="border border-black p-1 text-center">{i + 1}</td>
                      <td className="border border-black p-1">{item.Item}</td>
                      <td className="border border-black p-1 text-center">{item.Bahan}</td>
                      <td className="border border-black p-1 text-center">{item.Ukuran}</td>
                      <td className="border border-black p-1 text-center font-bold">{item.Qty} PCS</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="cut-line">✂️ CUT HERE ✂️</div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .cut-line { display: none; text-align: center; font-size: 8px; color: #999; margin-top: 10px; }
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
          .label-card { width: 100%; border: 1px solid #000; padding: 10px; page-break-inside: avoid; position: relative; }
          .cut-line { display: block; border-top: 1px dashed #000; padding-top: 5px; }
        }
      `}</style>
    </div>
  );
}