import React, { useState } from 'react';
import * as XLSX from 'xlsx';

export default function KawanLamaMultiLabelGenerator() {
  const [labels, setLabels] = useState({});
  const [selectedPt, setSelectedPt] = useState('PT HOME CENTER INDONESIA RETAIL');

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

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm space-y-6">
      {/* Kontrol Atas: Pilihan PT & Upload */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden border-b pb-4">
        <div>
          <h2 className="font-bold text-lg text-stone-800">🏷️ Kawan Lama Group - Multi Label Generator</h2>
          <p className="text-xs text-stone-500">Generator khusus alokasi anak perusahaan (AZKO, Krisbow, Informa, dll).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={selectedPt} 
            onChange={(e) => setSelectedPt(e.target.value)}
            className="text-xs border p-2 rounded-lg font-bold bg-stone-50"
          >
            <option value="PT HOME CENTER INDONESIA RETAIL">AZKO (Home Center)</option>
            <option value="PT KRISBOW INDONESIA">KRISBOW</option>
            <option value="PT INFORMA RETAIL">INFORMA</option>
            <option value="PT LIVING PLAZA">LIVING PLAZA</option>
            <option value="PT GINDACO INDONESIA">GINDACO</option>
          </select>

          <input type="file" accept=".xlsx" onChange={handleFileUpload} className="text-xs border p-1.5 rounded-lg" />
          
          <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs shadow">
            🖨️ Cetak Semua
          </button>
        </div>
      </div>

      {/* Render Label per Store/Region */}
      <div className="space-y-10">
        {Object.keys(labels).length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl text-stone-400 text-xs">
            Silakan pilih PT, lalu upload file Excel alokasi untuk mulai mencetak label.
          </div>
        ) : (
          Object.keys(labels).map((storeName, index) => (
            <div key={index} className="bg-white p-6 w-[210mm] mx-auto border border-black print:break-after-always shadow-sm">
              <div className="text-center mb-4">
                <h1 className="font-bold text-xl border-b border-black pb-1 uppercase">{selectedPt}</h1>
                <p className="font-bold text-sm mt-1">DENSITY SIGNAGE ( SPK-0726-02320 )</p>
              </div>
              
              <div className="mb-4 font-bold text-lg flex gap-2">
                <span>STORE / REGION</span><span>:</span><span>{storeName}</span>
              </div>

              <table className="w-full border-collapse border border-black text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-2 w-10 text-center">NO</th>
                    <th className="border border-black p-2 w-4 text-center"> : </th>
                    <th className="border border-black p-2 text-left">ITEM</th>
                    <th className="border border-black p-2 w-40 text-center">BAHAN</th>
                    <th className="border border-black p-2 w-28 text-center">UKURAN</th>
                    <th className="border border-black p-2 w-20 text-center" colSpan={2}>QTY</th>
                  </tr>
                </thead>
                <tbody>
                  {labels[storeName].map((item, i) => (
                    <tr key={i}>
                      <td className="border border-black p-2 text-center">{i + 1}</td>
                      <td className="border border-black p-2 text-center"></td>
                      <td className="border border-black p-2 font-medium">{item.Item}</td>
                      <td className="border border-black p-2 text-center text-xs">{item.Bahan}</td>
                      <td className="border border-black p-2 text-center">{item.Ukuran}</td>
                      <td className="border border-black p-2 text-center font-bold">{item.Qty}</td>
                      <td className="border border-black p-2 text-center">PCS</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}