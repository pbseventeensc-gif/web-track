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
    qty_total: '100',     
    pcs_per_koli: '20',   
    unit: 'PCS',
    pic_name: '',
    phone: '0852 3636 3673',
    kota_region: '',
    transporter_dr: 'WAHANA - N-17779-2608-12',
    brand_name: 'NESTLÉ / PURINA',
    item_title: 'SHOPBLIND FRISKIES FELIX - PURINA ( UK 200 X 100 CM )',
    
    ops: '-',
    brand_cc: 'COCA - COLA',
    item_cc: 'AC 260 2MUKA LAM 2MUKA GLOSSY ( UK A4 )',
    qty_powerade: '20',
    qty_sprite: '20',

    imageUrl: '',
    imageUrl2: '', 
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

  const totalQty = parseInt(form.qty_total) || 1;
  const koliCapacity = parseInt(form.pcs_per_koli) || 1;
  const totalKoli = Math.ceil(totalQty / koliCapacity);

  return (
    <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="font-black text-lg text-indigo-600 dark:text-indigo-400">🏷️ Generator Label & Surat Jalan PMG</h2>
          <p className="text-xs opacity-60">Atur total Qty & isi per koli, upload 4 field gambar & logo lengkap.</p>
        </div>
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
            <option value="product_identity">Product Identity (Gaya Nestlé / 2 Gambar)</option>
            <option value="hanging_poster">Hanging Poster (Gaya Coca-Cola)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="sm:col-span-1">
          <label className="block font-bold mb-1 text-indigo-500">Total Qty Keseluruhan</label>
          <input 
            type="text"
            inputMode="numeric"
            value={form.qty_total}
            onChange={e => setForm({ ...form, qty_total: e.target.value.replace(/\D/g, '') })}
            className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-center text-base ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-stone-900'}`}
            placeholder="100"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block font-bold mb-1 opacity-70">Isi Per Koli (Pcs)</label>
          <input 
            type="text"
            inputMode="numeric"
            value={form.pcs_per_koli}
            onChange={e => setForm({ ...form, pcs_per_koli: e.target.value.replace(/\D/g, '') })}
            className={`w-full p-3 border rounded-xl font-bold text-center text-base ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            placeholder="20"
          />
        </div>
        <div className="sm:col-span-1 flex items-end">
          <div className="w-full p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center font-bold text-indigo-600 dark:text-indigo-400">
            📦 Total Koli: {totalKoli} Label
          </div>
        </div>

        <div className="sm:col-span-3">
          <label className="block font-bold mb-1 opacity-70">Nama Project / PO No</label>
          <input 
            type="text"
            value={form.po_project}
            onChange={e => setForm({ ...form, po_project: e.target.value })}
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          />
        </div>
      </div>

      {/* 4 FIELD UPLOAD LENGKAP */}
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
          <label className="block font-bold mb-1 opacity-70">Foto Produk 1 (Kiri)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'imageUrl')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
        <div>
          <label className="block font-bold mb-1 opacity-70">Foto Produk 2 (Kanan)</label>
          <input type="file" accept="image/*" onChange={e => handleImageUpload(e, 'imageUrl2')} className={`w-full p-2 border rounded-xl text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`} />
        </div>
      </div>

      <button 
        onClick={() => setPrintDataModal(true)}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs shadow-md"
      >
        👁️ Pratinjau & Cetak Semua Label Koli ({totalKoli} Halaman)
      </button>

      {/* MODAL PRATINJAU CETAK SELURUH KOLI */}
      {printDataModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm uppercase text-blue-900">Pratinjau Koli Label (Total: {totalKoli} Halaman)</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs">🖨️ Cetak Semua Koli</button>
                <button onClick={() => setPrintDataModal(false)} className="px-3 py-2 bg-stone-300 hover:bg-stone-400 font-bold rounded-xl text-xs">✕ Tutup</button>
              </div>
            </div>

            <div className="space-y-8">
              {Array.from({ length: totalKoli }).map((_, koliIdx) => {
                const currentKoliNumber = koliIdx + 1;
                return (
                  <div key={koliIdx} className="p-6 bg-white text-black font-sans text-xs border-2 border-dashed border-stone-400 rounded-xl space-y-3 relative page-break">
                    <div className="absolute top-2 right-3 font-bold text-indigo-600 text-[11px] bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                      Label Koli: {currentKoliNumber} of {totalKoli}
                    </div>

                    {templateType === 'product_identity' ? (
                      <div style={{ border: '2px solid #000', padding: '18px' }}>
                        <table style={{ width: '100%', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                          <tr>
                            <td style={{ width: '25%' }}>
                              {form.logoLeftUrl ? <img src={form.logoLeftUrl} alt="PMG Logo" style={{ maxHeight: '45px', display: 'block' }} /> : <span style={{ fontWeight: 'bold', color: '#003366', fontSize: '13px' }}>PMG GROUP</span>}
                            </td>
                            <td style={{ textAlign: 'center', width: '50%' }}><h1 style={{ margin: 0, fontSize: '18px', letterSpacing: '1px' }}>PRODUCT IDENTITY</h1></td>
                            <td style={{ textAlign: 'right', width: '25%' }}>
                              {form.logoRightUrl ? <img src={form.logoRightUrl} alt="Brand Logo" style={{ maxHeight: '45px', marginLeft: 'auto', display: 'block' }} /> : <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{form.brand_name}</span>}
                            </td>
                          </tr>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', width: '35%' }}>PO NO, NAMA PROJECT</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.po_project}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PERIODE PEMASANGAN</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.periode}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>CHANNEL</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.channel}</td></tr>
                          <tr>
                            <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', background: '#eef2f7' }}>JUMLAH QTY & KOLI</td>
                            <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'black', fontSize: '14px', background: '#eef2f7' }}>
                              : {form.pcs_per_koli} {form.unit} (Koli {currentKoliNumber} of {totalKoli})
                            </td>
                          </tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PENERIMA</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.pic_name || 'Belum dipilih'}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>ALAMAT / KOTA</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.kota_region}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>TRANSPORTER – DR No</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.transporter_dr}</td></tr>
                        </table>

                        <table style={{ width: '100%', border: '1px solid #000', marginTop: '10px', background: '#fafafa' }}>
                          <tr>
                            <td style={{ textAlign: 'center', padding: '8px', width: '50%', borderRight: '1px solid #000' }}>
                              {form.imageUrl ? <img src={form.imageUrl} alt="Produk 1" style={{ maxHeight: '130px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 1 ]</span>}
                            </td>
                            <td style={{ textAlign: 'center', padding: '8px', width: '50%' }}>
                              {form.imageUrl2 ? <img src={form.imageUrl2} alt="Produk 2" style={{ maxHeight: '130px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto Produk 2 ]</span>}
                            </td>
                          </tr>
                        </table>

                        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '13px', background: '#f2f2f2', padding: '8px', border: '1px solid #000', fontWeight: 'bold' }}>
                          {form.item_title}
                        </div>
                      </div>
                    ) : (
                      <div style={{ border: '2px solid #000', padding: '18px' }}>
                        <table style={{ width: '100%', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '10px' }}>
                          <tr>
                            <td style={{ width: '25%' }}>
                              {form.logoLeftUrl ? <img src={form.logoLeftUrl} alt="PMG Logo" style={{ maxHeight: '45px', display: 'block' }} /> : <span style={{ fontWeight: 'bold', color: '#003366', fontSize: '13px' }}>PMG GROUP</span>}
                            </td>
                            <td style={{ textAlign: 'center', width: '50%' }}>
                              <h2 style={{ margin: 0, color: '#cc0000', fontSize: '18px', fontStyle: 'italic' }}>Coca-Cola</h2>
                              <h1 style={{ margin: '3px 0 0 0', fontSize: '14px', background: '#000', color: '#fff', padding: '3px' }}>HANGING POSTER</h1>
                            </td>
                            <td style={{ textAlign: 'right', width: '25%' }}>
                              {form.logoRightUrl ? <img src={form.logoRightUrl} alt="Brand Logo" style={{ maxHeight: '45px', marginLeft: 'auto', display: 'block' }} /> : <span style={{ fontWeight: 'bold', fontSize: '13px' }}>COCA-COLA</span>}
                            </td>
                          </tr>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', width: '30%' }}>OPS</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.ops}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>DELIVERY POINT NAME</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.pic_name || 'Belum dipilih'}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>ADDRESS</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.kota_region}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>NO HP PIC</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.phone}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Brand & Item</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.brand_cc} - {form.item_cc}</td></tr>
                        </table>

                        <table style={{ width: '100%', border: '1px solid #000', marginTop: '10px', background: '#fafafa' }}>
                          <tr>
                            <td style={{ textAlign: 'center', padding: '8px', width: '50%', borderRight: '1px solid #000' }}>
                              {form.imageUrl ? <img src={form.imageUrl} alt="Produk 1" style={{ maxHeight: '130px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto 1 ]</span>}
                            </td>
                            <td style={{ textAlign: 'center', padding: '8px', width: '50%' }}>
                              {form.imageUrl2 ? <img src={form.imageUrl2} alt="Produk 2" style={{ maxHeight: '130px', margin: 'auto', display: 'block' }} /> : <span style={{ color: '#666', fontStyle: 'italic' }}>[ Foto 2 ]</span>}
                            </td>
                          </tr>
                        </table>

                        <div style={{ border: '1px solid #000', marginTop: '10px', background: '#ffffcc' }}>
                          <div style={{ background: '#000', color: '#fff', padding: '4px 8px', fontWeight: 'bold', fontSize: '11px' }}>TOTAL QTY (Koli {currentKoliNumber} of {totalKoli})</div>
                          <table style={{ width: '100%', fontWeight: 'bold', fontSize: '12px', padding: '6px' }}>
                            <tr><td style={{ padding: '4px' }}>POWERADE</td><td style={{ textAlign: 'center' }}>=</td><td style={{ textAlign: 'right' }}>{form.qty_powerade} PCS</td></tr>
                            <tr><td style={{ padding: '4px', borderTop: '1px dashed #ccc' }}>SPRITE NIPIS MINT</td><td style={{ textAlign: 'center', borderTop: '1px dashed #ccc' }}>=</td><td style={{ textAlign: 'right' }}>{form.qty_sprite} PCS</td></tr>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}