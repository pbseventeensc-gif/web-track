import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function CustomLabelGenerator({ isDarkMode }) {
  const [destinations, setDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState('');
  const [templateType, setTemplateType] = useState('product_identity');
  
  // State form label diperbesar dan ditambahkan gambar/qty
  const [form, setForm] = useState({
    po_project: '2300001762 SHOPBLIND FRISKIES',
    periode: '16-Agu-26',
    channel: 'GT/MT/LSM/LMM/SPM/HPM/OT',
    qty_pcs: '16',
    unit: 'PCS',
    pic_name: '',
    phone: '0852 3636 3673',
    kota_region: '',
    transporter_dr: 'WAHANA - N-17779-2608-12',
    brand_name: 'NESTLÉ / PURINA',
    item_title: 'SHOPBLIND FRISKIES FELIX - PURINA ( UK 200 X 100 CM )',
    imageUrl: ''
  });

  const [printDataModal, setPrintDataModal] = useState(false);

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

  const handleDestChange = (e) => {
    const destId = e.target.value;
    setSelectedDest(destId);
    const found = destinations.find(d => String(d.id) === String(destId));
    if (found) {
      setForm(prev => ({
        ...prev,
        pic_name: found.client_name,
        kota_region: found.address
      }));
    }
  };

  // Fitur Upload Gambar Preview
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, imageUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Fitur Import Label via Excel
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

        if (rawData.length > 1) {
          const row = rawData[1]; // Ambil baris pertama data setelah header
          setForm(prev => ({
            ...prev,
            po_project: row[0] ? String(row[0]) : prev.po_project,
            brand_name: row[1] ? String(row[1]) : prev.brand_name,
            qty_pcs: row[2] ? String(row[2]) : prev.qty_pcs,
            item_title: row[3] ? String(row[3]) : prev.item_title
          }));
          alert('✅ Berhasil mengimpor data detail label dari Excel!');
        }
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="font-black text-lg text-indigo-600 dark:text-indigo-400">🏷️ Generator Label & Surat Jalan PMG</h2>
          <p className="text-xs opacity-60">Pilih klien, atur Qty besar, upload gambar visual, dan cetak label tanpa blank.</p>
        </div>
        <label className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm">
          📂 Import Atribut Label via Excel
          <input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} className="hidden" />
        </label>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-bold mb-1 opacity-70">Pilih Tujuan Klien PMG</label>
          <select 
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            value={selectedDest}
            onChange={handleDestChange}
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

      {/* FORM INPUT DENGAN QTY DIPERBESAR DAN UPLOAD GAMBAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="sm:col-span-2">
          <label className="block font-bold mb-1 opacity-70">Nama Project / PO No</label>
          <input 
            type="text"
            value={form.po_project}
            onChange={e => setForm({ ...form, po_project: e.target.value })}
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          />
        </div>

        {/* QTY DIPERBESAR */}
        <div>
          <label className="block font-bold mb-1 text-indigo-500">JUMLAH QTY (PCS)</label>
          <div className="flex gap-2">
            <input 
              type="number"
              value={form.qty_pcs}
              onChange={e => setForm({ ...form, qty_pcs: e.target.value })}
              className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-base text-center ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-stone-900'}`}
              min="1"
            />
            <input 
              type="text"
              value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              className={`w-20 p-3 border rounded-xl font-bold text-center ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            />
          </div>
        </div>

        <div className="sm:col-span-3">
          <label className="block font-bold mb-1 opacity-70">Upload Gambar / Foto Visual Banner (Opsional)</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload}
            className={`w-full p-2.5 border rounded-xl text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          />
        </div>
      </div>

      <button 
        onClick={() => setPrintDataModal(true)}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs shadow-md"
      >
        👁️ Pratinjau & Cetak Label PMG (Anti-Blank Lokal)
      </button>

      {/* MODAL PREVIEW CETAK LABEL (MENGATASI LAYAR BLANK DI LOCALHOST) */}
      {printDataModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm uppercase text-blue-900">Pratinjau Label PMG</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
                >
                  🖨️ Cetak / Print Label
                </button>
                <button 
                  onClick={() => setPrintDataModal(false)} 
                  className="px-3 py-2 bg-stone-300 hover:bg-stone-400 font-bold rounded-xl text-xs"
                >
                  ✕ Tutup
                </button>
              </div>
            </div>

            {/* AREA LABEL YANG DICETAK */}
            <div className="p-6 bg-white text-black font-sans text-xs border rounded-xl space-y-4">
              {templateType === 'product_identity' ? (
                <div style={{ border: '2px solid #000', padding: '20px' }}>
                  <table style={{ width: '100%', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
                    <tr>
                      <td><h2 style={{ margin: 0, color: '#003366', fontSize: '13px' }}>PMG GROUP</h2></td>
                      <td style={{ textAlign: 'center' }}><h1 style={{ margin: 0, fontSize: '18px' }}>PRODUCT IDENTITY</h1></td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>{form.brand_name}</td>
                    </tr>
                  </table>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', width: '35%' }}>PO NO, NAMA PROJECT</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.po_project}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PERIODE PEMASANGAN</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.periode}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>CHANNEL</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.channel}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', background: '#eef2f7' }}>JUMLAH QTY</td><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'black', fontSize: '14px', background: '#eef2f7' }}>: {form.qty_pcs} {form.unit}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PENERIMA</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.pic_name || 'Belum dipilih'}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>ALAMAT / KOTA</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.kota_region}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>TRANSPORTER – DR No</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.transporter_dr}</td></tr>
                  </table>

                  {/* PREVIEW GAMBAR UPLOAD */}
                  <div style={{ textAlign: 'center', border: '1px solid #000', marginTop: '12px', padding: '10px', background: '#fafafa' }}>
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="Visual Banner" style={{ maxHeight: '150px', margin: 'auto', display: 'block' }} />
                    ) : (
                      <p style={{ fontStyle: 'italic', color: '#666', margin: '20px 0' }}>[ Belum ada gambar di-upload ]</p>
                    )}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', background: '#f2f2f2', padding: '8px', border: '1px solid #000', fontWeight: 'bold' }}>
                    {form.item_title}
                  </div>
                </div>
              ) : (
                <div style={{ border: '2px solid #000', padding: '20px' }}>
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
                    <h2 style={{ margin: 0, color: '#cc0000', fontSize: '20px', fontStyle: 'italic' }}>Coca-Cola</h2>
                    <h1 style={{ margin: '5px 0 0 0', fontSize: '16px', background: '#000', color: '#fff', padding: '4px' }}>HANGING POSTER</h1>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', width: '30%' }}>OPS</td><td style={{ border: '1px solid #000', padding: '5px' }}>: -</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>DELIVERY POINT NAME</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.pic_name || 'Belum dipilih'}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>ADDRESS</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.kota_region}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PIC / PHONE</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.phone}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Item</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.item_title}</td></tr>
                  </table>

                  {/* PREVIEW GAMBAR UPLOAD */}
                  <div style={{ textAlign: 'center', border: '1px solid #000', marginTop: '12px', padding: '10px', background: '#fafafa' }}>
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt="Visual Banner" style={{ maxHeight: '150px', margin: 'auto', display: 'block' }} />
                    ) : (
                      <p style={{ fontStyle: 'italic', color: '#666', margin: '20px 0' }}>[ Belum ada gambar di-upload ]</p>
                    )}
                  </div>

                  <div style={{ border: '1px solid #000', marginTop: '12px', padding: '12px', textAlign: 'center', background: '#ffffcc' }}>
                    <table style={{ width: '100%', fontWeight: 'bold', fontSize: '13px' }}>
                      <tr><td style={{ textAlign: 'left' }}>TOTAL QTY</td><td style={{ textAlign: 'right', fontSize: '15px', color: '#cc0000' }}>{form.qty_pcs} {form.unit}</td></tr>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}