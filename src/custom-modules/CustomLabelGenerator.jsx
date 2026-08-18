import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function CustomLabelGenerator({ isDarkMode }) {
  const [destinations, setDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState('');
  const [templateType, setTemplateType] = useState('product_identity');

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) {
      const cleanData = data.filter(d => d.client_name && !d.client_name.includes('Kolom'));
      setDestinations(cleanData);
    }
  };

  const handlePrint = () => {
    if (!selectedDest) return alert('Pilih tujuan klien terlebih dahulu!');
    const found = destinations.find(d => String(d.id) === String(selectedDest));
    if (!found) return;

    const printWindow = window.open('', '_blank', 'width=900,height=950');
    let labelHtml = '';

    if (templateType === 'product_identity') {
      labelHtml = `
        <div style="border: 2px solid #000; padding: 25px; font-family: Arial, sans-serif; max-width: 750px; margin: auto;">
          <table style="width: 100%; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
            <tr>
              <td><h2 style="margin: 0; color: #003366; font-size: 14px;">PMG GROUP</h2></td>
              <td style="text-align: center;"><h1 style="margin: 0; font-size: 20px; letter-spacing: 1px;">PRODUCT IDENTITY</h1></td>
              <td style="text-align: right; font-weight: bold; font-size: 14px;">NESTLÉ / PURINA</td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr><td style="border: 1px solid #000; padding: 6px; width: 35%; font-weight: bold;">PO NO, NAMA PROJECT</td><td style="border: 1px solid #000; padding: 6px;">: 2300001762 SHOPBLIND FRISKIES</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">PERIODE PEMASANGAN</td><td style="border: 1px solid #000; padding: 6px;">: 16-Agu-26</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">CHANNEL</td><td style="border: 1px solid #000; padding: 6px;">: GT/MT/LSM/LMM/SPM/HPM/OT</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">JUMLAH PCS / PACK</td><td style="border: 1px solid #000; padding: 6px;">: 16 Pcs</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">PENERIMA</td><td style="border: 1px solid #000; padding: 6px;">: ${found.client_name}</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">ALAMAT</td><td style="border: 1px solid #000; padding: 6px;">: ${found.address}</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">TRANSPORTER – DR No</td><td style="border: 1px solid #000; padding: 6px;">: WAHANA - N-17779-2608-12</td></tr>
          </table>

          <div style="text-align: center; border: 1px solid #000; margin-top: 15px; padding: 15px; background: #eef2f7;">
            <b>SHOPBLIND FRISKIES FELIX - PURINA ( UK 200 X 100 CM )</b>
          </div>
        </div>
      `;
    } else {
      labelHtml = `
        <div style="border: 2px solid #000; padding: 25px; font-family: Arial, sans-serif; max-width: 750px; margin: auto;">
          <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px;">
            <h2 style="margin: 0; color: #cc0000; font-size: 22px; font-style: italic;">Coca-Cola</h2>
            <h1 style="margin: 5px 0 0 0; font-size: 18px; background: #000; color: #fff; padding: 4px;">HANGING POSTER</h1>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr><td style="border: 1px solid #000; padding: 6px; width: 30%; font-weight: bold;">OPS</td><td style="border: 1px solid #000; padding: 6px;">: -</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">DELIVERY POINT NAME</td><td style="border: 1px solid #000; padding: 6px;">: ${found.client_name}</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">ADDRESS</td><td style="border: 1px solid #000; padding: 6px;">: ${found.address}</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">PIC / PENERIMA</td><td style="border: 1px solid #000; padding: 6px;">: ${found.client_name}</td></tr>
            <tr><td style="border: 1px solid #000; padding: 6px; font-weight: bold;">Brand & Item</td><td style="border: 1px solid #000; padding: 6px;">: COCA-COLA - AC 260 2MUKA GLOSSY ( UK A4 )</td></tr>
          </table>

          <div style="border: 1px solid #000; margin-top: 15px; padding: 15px; text-align: center; background: #ffffcc;">
            <table style="width: 100%; font-weight: bold; font-size: 13px;">
              <tr><td style="text-align: left;">TOTAL QTY</td><td></td></tr>
              <tr><td style="text-align: left;">POWERADE</td><td style="text-align: right;">= 20 PCS</td></tr>
              <tr><td style="text-align: left;">SPRITE NIPIS MINT</td><td style="text-align: right;">= 20 PCS</td></tr>
            </table>
          </div>
        </div>
      `;
    }

    printWindow.document.write(`<html><head><title>Cetak Label PMG</title></head><body>${labelHtml}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <h2 className="font-black text-lg mb-4 text-indigo-600 dark:text-indigo-400">🏷️ Generator Label & Surat Jalan PMG</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-xs">
        <div>
          <label className="block font-bold mb-1 opacity-70">Pilih Tujuan Klien PMG</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={selectedDest}
            onChange={(e) => setSelectedDest(e.target.value)}
          >
            <option value="">-- Pilih Tujuan Klien --</option>
            {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
          </select>
        </div>

        <div>
          <label className="block font-bold mb-1 opacity-70">Pilih Template Label</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
          >
            <option value="product_identity">Product Identity (Gaya Nestlé)</option>
            <option value="hanging_poster">Hanging Poster (Gaya Coca-Cola)</option>
          </select>
        </div>
      </div>

      <button 
        onClick={handlePrint}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs"
      >
        🖨️ Generate & Cetak Label
      </button>
    </div>
  );
}