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
    qty_total: '20',
    pcs_per_koli: '5',
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

  useEffect(() => { fetchDestinations(); }, []);

  const fetchDestinations = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) setDestinations(data.filter(d => d.client_name && !d.client_name.includes('Kolom')));
  };

  const handleDestChange = (e) => {
    const dest = destinations.find(d => String(d.id) === e.target.value);
    setSelectedDest(e.target.value);
    if (dest) setForm(prev => ({ ...prev, pic_name: dest.client_name, kota_region: dest.address }));
  };

  const handleImageUpload = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm(prev => ({ ...prev, [field]: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const totalKoli = Math.ceil((parseInt(form.qty_total) || 1) / (parseInt(form.pcs_per_koli) || 1));

  return (
    <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <h2 className="font-black text-lg text-indigo-600">🏷️ Generator Label PMG</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <select className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`} value={selectedDest} onChange={handleDestChange}>
          <option value="">-- Pilih Tujuan Klien --</option>
          {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
        </select>
        <select className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`} value={templateType} onChange={e => setTemplateType(e.target.value)}>
          <option value="product_identity">Product Identity (Desain Detail)</option>
          <option value="hanging_poster">Hanging Poster (Coca-Cola)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {['logoLeftUrl', 'logoRightUrl', 'imageUrl', 'imageUrl2'].map((field) => (
          <div key={field}>
            <label className="block font-bold mb-1 opacity-70">{field.replace('Url', '').replace('Image', 'Foto ')}</label>
            <input type="file" accept="image/*" onChange={e => handleImageUpload(e, field)} className={`w-full p-2 border rounded-xl ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <input type="text" value={form.qty_total} onChange={e => setForm({...form, qty_total: e.target.value.replace(/\D/g, '')})} className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-center ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`} placeholder="Total Qty" />
        <input type="text" value={form.pcs_per_koli} onChange={e => setForm({...form, pcs_per_koli: e.target.value.replace(/\D/g, '')})} className={`w-full p-3 border rounded-xl font-bold text-center ${isDarkMode ? 'bg-neutral-900' : 'bg-stone-50'}`} placeholder="Isi per Koli" />
        <div className="w-full p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center font-bold text-indigo-600">📦 Label: {totalKoli} (Koli 1 of {totalKoli})</div>
      </div>

      <button onClick={() => setPrintDataModal(true)} className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-md">👁️ Pratinjau & Cetak Semua Label</button>

      {printDataModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="space-y-8">
              {Array.from({ length: totalKoli }).map((_, koliIdx) => {
                const koliText = `Koli ${koliIdx + 1} of ${totalKoli} (${form.pcs_per_koli} Pcs)`;
                return (
                  <div key={koliIdx} className="p-6 border-2 border-dashed border-stone-400 rounded-xl relative page-break">
                    <div className="absolute top-2 right-3 font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-[11px]">{koliText}</div>
                    {templateType === 'product_identity' ? (
                      <div style={{ border: '2px solid #000', padding: '18px', fontSize: '12px' }}>
                        <table style={{ width: '100%', borderBottom: '2px solid #000', marginBottom: '10px' }}>
                          <tr>
                            <td>{form.logoLeftUrl ? <img src={form.logoLeftUrl} style={{maxHeight:'40px'}}/> : 'PMG GROUP'}</td>
                            <td style={{textAlign:'center', fontWeight:'bold', fontSize:'14px'}}>PRODUCT IDENTITY</td>
                            <td style={{textAlign:'right'}}>{form.logoRightUrl ? <img src={form.logoRightUrl} style={{maxHeight:'40px'}}/> : form.brand_name}</td>
                          </tr>
                        </table>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', width: '30%' }}>PO NO, NAMA PROJECT</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.po_project}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PERIODE</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.periode}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>CHANNEL</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.channel}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', background: '#f0f0f0' }}>KOLI</td><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>: {koliText}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>PENERIMA</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.pic_name || '...'}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>ALAMAT</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.kota_region || '...'}</td></tr>
                          <tr><td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>TRANSPORTER</td><td style={{ border: '1px solid #000', padding: '5px' }}>: {form.transporter_dr}</td></tr>
                        </table>
                        <table style={{ width: '100%', border: '1px solid #000', marginTop: '10px' }}>
                          <tr>
                            <td style={{ textAlign: 'center', padding: '10px', width: '50%', borderRight: '1px solid #000' }}>{form.imageUrl ? <img src={form.imageUrl} style={{maxHeight:'100px', margin:'auto'}}/> : '[Foto 1]'}</td>
                            <td style={{ textAlign: 'center', padding: '10px', width: '50%' }}>{form.imageUrl2 ? <img src={form.imageUrl2} style={{maxHeight:'100px', margin:'auto'}}/> : '[Foto 2]'}</td>
                          </tr>
                        </table>
                        <div style={{ textAlign: 'center', marginTop: '10px', padding: '8px', border: '1px solid #000', background: '#f9f9f9', fontWeight: 'bold' }}>{form.item_title}</div>
                      </div>
                    ) : (
                      <div style={{ border: '2px solid #000', padding: '18px', fontSize: '12px' }}>
                        <h2 style={{textAlign:'center', color:'red', fontWeight:'bold'}}>COCA-COLA HANGING POSTER</h2>
                        <table style={{width:'100%', borderCollapse:'collapse', marginTop:'10px'}}>
                          <tr><td style={{border:'1px solid black', padding:'5px', fontWeight:'bold', width:'25%'}}>KOLI</td><td style={{border:'1px solid black', padding:'5px'}}>: {koliText}</td></tr>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setPrintDataModal(false)} className="w-full mt-4 p-2 bg-stone-300 rounded-lg font-bold">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}