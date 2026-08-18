import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function CustomLabelGenerator({ isDarkMode }) {
  const [destinations, setDestinations] = useState([]);
  const [selectedDest, setSelectedDest] = useState('');
  const [templateType, setTemplateType] = useState('product_identity');
  
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
    
    // Field spesifik Hanging Poster (Gaya Coca-Cola)
    ops: '-',
    brand_cc: 'COCA - COLA',
    item_cc: 'AC 260 2MUKA LAM 2MUKA GLOSSY ( UK A4 )',
    qty_powerade: '20',
    qty_sprite: '20',

    imageUrl: '',
    imageUrl2: '', // Gambar kedua untuk Hanging Poster (Sprite)
    logoLeftUrl: '', 
    logoRightUrl: '' 
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

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

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
          const row = rawData[1];
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
          <p className="text-xs opacity-60">Pilih klien, atur Qty, upload logo/gambar ganda untuk Product Identity & Hanging Poster.</p>
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

      {templateType === 'product_identity' ? (
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
          <div>
            <label className="block font-bold mb-1 text-indigo-500">JUMLAH QTY (PCS)</label>
            <div className="flex gap-2">
              <input 
                type="text"
                inputMode="numeric"
                value={form.qty_pcs}
                onChange={e => setForm({ ...form, qty_pcs: e.target.value.replace(/\D/g, '') })}
                className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-base text-center ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-stone-900'}`}
              />
              <input 
                type="text"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                className={`w-20 p-3 border rounded-xl font-bold text-center ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-bold mb-1 opacity-70">OPS</label>
            <input 
              type="text"
              value={form.ops}
              onChange={e => setForm({ ...form, ops: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            />
          </div>
          <div>
            <label className="block font-bold mb-1 opacity-70">No HP PIC</label>
            <input 
              type="text"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            />
          </div>
          <div>
            <label className="block font-bold mb-1 opacity-70">Brand</label>
            <input 
              type="text"
              value={form.brand_cc}
              onChange={e => setForm({ ...form, brand_cc: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block font-bold mb-1 opacity-70">Item Description</label>
            <input 
              type="text"
              value={form.item_cc}
              onChange={e => setForm({ ...form, item_cc: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            />
          </div>
          <div>
            <label className="block font-bold mb-1 text-indigo-500">QTY Powerade</label>
            <input 
              type="text"
              value={form.qty_powerade}
              onChange={e => setForm({ ...form, qty_powerade: e.target.value.replace(/\D/g, '') })}
              className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-center ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-stone-900'}`}
            />
          </div>
          <div>
            <label className="block font-bold mb-1 text-indigo-500">QTY Sprite Nipis Mint</label>
            <input 
              type="text"
              value={form.qty_sprite}
              onChange={e => setForm({ ...form, qty_sprite: e.target.value.replace(/\D/g, '') })}
              className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-center ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-stone-900'}`}
            />
          </div>
        </div>
      )}

      {/* UPLOAD GAMBAR & LOGO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
        <div>
          <label className="block font-bold mb-1 opacity-70">Logo Kiri (PMG)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'logoLeftUrl')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
        <div>
          <label className="block font-bold mb-1 opacity-70">Logo Kanan (Brand)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'logoRightUrl')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
        <div>
          <label className="block font-bold mb-1 opacity-70">Foto Produk 1 (Powerade)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'imageUrl')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
        <div>
          <label className="block font-bold mb-1 opacity-70">Foto Produk 2 (Sprite)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'imageUrl2')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
      </div>

      <button 
        onClick={() => setPrintDataModal(true)}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs shadow-md"
      >
        👁️ Pratinjau & Cetak Label PMG (Anti-Blank Lokal)
      </button>

      {printDataModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm uppercase text-blue-900">Pratinjau Label PMG</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs">🖨️ Cetak / Print Label</button>
                <button onClick={() => setPrintDataModal(false)} className="px-3 py-2 bg-stone-300 hover:bg-stone-400 font-bold rounded-xl text-xs">✕ Tutup</button>
              </div>
            </div>

            <div className="p-6 bg-white text-black font-sans text-xs border rounded-xl space-y-4">
              {templateType === 'product_identity' ? (
                <div style={{ border: '2px solid #000', padding: '20px' }}>
                  <table style={{ width: '100%', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
                    <tr>
                      <td style={{ width: '25%' }}>
                        {form.logoLeftUrl ? <img src={form.logoLeftUrl} alt="Logo" style={{ maxHeight: '45px', display: 'block' }} /> : <h2 style={{ margin: 0, color: '#003366', fontSize: '13px' }}>PMG GROUP</h2>}
                      </td>
                      <td style={{ textAlign: 'center', width: '50%' }}><h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '1px' }}>PRODUCT IDENTITY</h1></td>
                      <td style={{ textAlign: 'right', width: '25%' }}>
                        {form.logoRightUrl ? <img src={form.logoRightUrl} alt="Logo" style={{ maxHeight: '45px', marginLeft: 'auto', display: 'block' }} /> : <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{form.brand_name}</span>}
                      </td>
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

                  <div style={{ textAlign: 'center', border: '1px solid #000', marginTop: '12px', padding: '10px', background: '#fafafa' }}>
                    {form.imageUrl ? <img src={form.imageUrl} alt="Banner" style={{ maxHeight: '150px', margin: 'auto', display: 'block' }} /> : <p style={{ fontStyle: 'italic', color: '#666', margin: '20px 0' }}>[ Belum ada gambar banner ]</p>}
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', background: '#f2f2f2', padding: '8px', border: '1px solid #000', fontWeight: 'bold' }}>
                    {form.item_title}
                  </div>
                </div>
              ) : (
                /* TEMPLATE HANGING POSTER (GAYA COCA-COLA) DENGAN 2 GAMBAR PRODUK BERDAMPINGAN */
                <div style={{ border: '2px solid #000', padding: '20px' }}>
                  {/* HEADER DUA LOGO KIRI & KANAN */}
                  <table style={{ width: '100%', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
                    <tr>
                      <td style={{ width: '25%' }}>
                        {form.logoLeftUrl ? <img src={form.logoLeftUrl} alt="Logo" style={{ maxHeight: '45px', display: 'block' }} /> : <h2 style={{ margin: 0, color: '#003366', fontSize: '13px' }}>PMG GROUP</h2>}
                      </td>
                      <td style={{ textAlign: 'center', width: '50%' }}>
                        <h2 style={{ margin: 0, color: '#cc0000', fontSize: '18px', fontStyle: 'italic' }}>Coca-Cola</h2>
                        <h1 style={{ margin: '3px 0 0 0', fontSize: '14px', background: '#000', color: '#fff', padding: '3px' }}>HANGING POSTER</h1>
                      </td>
                      <td style={{ textAlign: 'right', width: '25%' }}>
                        {form.logoRightUrl ? <img src={form.logoRightUrl} alt="Logo" style={{ maxHeight: '45px', marginLeft: 'auto', display: 'block' }} /> : <span style={{ fontWeight: 'bold', fontSize: '13px' }}>COCA-COLA</span>}
                      </td>
                    </tr>
                  </table>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', width: '30%' }}>OPS</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.ops}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>DELIVERY POINT NAME</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.pic_name || 'Belum dipilih'}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>ADDRESS</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.kota_region}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PIC</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.pic_name || '-'}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>NO HP PIC</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.phone}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Brand</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.brand_cc}</td></tr>
                    <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Item</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.item_cc}</td></tr>
                  </table>

                  {/* 2 GAMBAR PRODUK BERDAMPINGAN */}
                  <table style={{ width: '100%', border: '1px solid #000', marginTop: '12px', background: '#fafafa' }}>
                    <tr>
                      <td style={{ textAlign: 'center', padding: '10px', width: '50%', borderRight: '1px solid #000' }}>
                        {form.imageUrl ? <img src={form.imageUrl} alt="Produk 1" style={{ maxHeight: '140px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Powerade ]</span>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px', width: '50%' }}>
                        {form.imageUrl2 ? <img src={form.imageUrl2} alt="Produk 2" style={{ maxHeight: '140px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Sprite ]</span>}
                      </td>
                    </tr>
                  </table>

                  {/* TABEL TOTAL QTY PER PRODUK PERSIS SEPERTI GAMBAR 2 */}
                  <div style={{ border: '1px solid #000', marginTop: '12px', background: '#ffffcc' }}>
                    <div style={{ background: '#000', color: '#fff', padding: '4px 8px', fontWeight: 'bold', fontSize: '11px' }}>TOTAL QTY</div>
                    <table style={{ width: '100%', fontWeight: 'bold', fontSize: '12px', padding: '6px' }}>
                      <tr><td style={{ padding: '4px' }}>POWERADE</td><td style={{ textAlign: 'center', width: '30px' }}>=</td><td style={{ textAlign: 'right', padding: '4px' }}>{form.qty_powerade} PCS</td></tr>
                      <tr><td style={{ padding: '4px', borderTop: '1px dashed #ccc' }}>SPRITE NIPIS MINT</td><td style={{ textAlign: 'center', borderTop: '1px dashed #ccc' }}>=</td><td style={{ textAlign: 'right', padding: '4px', borderTop: '1px dashed #ccc' }}>{form.qty_sprite} PCS</td></tr>
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