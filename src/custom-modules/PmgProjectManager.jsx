import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function PmgProjectManager({ isDarkMode }) {
  const [projects, setProjects] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [printData, setPrintData] = useState(null); // State untuk preview cetak di dalam halaman
  
  const [form, setForm] = useState({
    dr_number: '',
    transaction_code: '',
    project_name: '',
    delivery_date: new Date().toISOString().split('T')[0],
    vehicle_no: '',
    phone_no: '',
    sender_name: 'NINING'
  });

  const [items, setItems] = useState([
    { destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }
  ]);

  useEffect(() => {
    fetchProjects();
    fetchDestinations();
  }, []);

  const fetchProjects = async () => {
    const { data } = await supabase.from('pmg_projects').select('*, pmg_project_items(*, pmg_destinations(client_name))').order('id', { ascending: false });
    if (data) setProjects(data);
  };

  const fetchDestinations = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) {
      const cleanData = data.filter(d => d.client_name && !d.client_name.includes('Kolom'));
      setDestinations(cleanData);
    }
  };

  const handleAddItemRow = () => {
    setItems([...items, { destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleRemoveItemRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Fitur Import Alokasi Item via Excel
  const handleImportItemsExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

        const importedItems = [];
        rawData.forEach((row) => {
          const clientNameText = row[0] ? String(row[0]).trim() : '';
          const itemNameText = row[1] ? String(row[1]).trim() : '';
          const dimsText = row[2] ? String(row[2]).trim() : '';
          const qtyVal = row[3] ? Number(row[3]) : 1;

          if (itemNameText && !itemNameText.toLowerCase().includes('nama')) {
            // Cocokkan nama klien dengan master destinations
            const matchedDest = destinations.find(d => d.client_name.toLowerCase().includes(clientNameText.toLowerCase()));
            
            importedItems.push({
              destination_id: matchedDest ? matchedDest.id : (destinations[0]?.id || ''),
              item_name: itemNameText,
              dimensions: dimsText,
              qty: isNaN(qtyVal) ? 1 : qtyVal,
              unit: 'PCS'
            });
          }
        });

        if (importedItems.length > 0) {
          setItems(importedItems);
          alert(`✅ Berhasil mengimpor ${importedItems.length} item alokasi dari Excel!`);
        } else {
          alert('⚠️ Format baris Excel item tidak dikenali.');
        }
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!form.transaction_code || !form.project_name) return alert('Transaction Code dan Project Name wajib diisi!');

    const { data: projData, error: projError } = await supabase
      .from('pmg_projects')
      .insert([form])
      .select();

    if (projError) return alert('Gagal menyimpan project: ' + projError.message);

    const projectId = projData[0].id;

    const itemsToInsert = items.map(item => ({
      project_id: projectId,
      destination_id: item.destination_id ? Number(item.destination_id) : null,
      item_name: item.item_name,
      dimensions: item.dimensions,
      qty: Number(item.qty),
      unit: item.unit
    }));

    const { error: itemError } = await supabase.from('pmg_project_items').insert(itemsToInsert);
    if (itemError) {
      alert('Kendala pada item barang: ' + itemError.message);
    } else {
      alert('✅ Surat Jalan & Alokasi PMG Berhasil Disimpan!');
      setForm({ dr_number: '', transaction_code: '', project_name: '', delivery_date: new Date().toISOString().split('T')[0], vehicle_no: '', phone_no: '', sender_name: 'NINING' });
      setItems([{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
      fetchProjects();
    }
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <div>
        <h3 className="font-extrabold text-sm uppercase text-indigo-600 dark:text-indigo-400">
          📋 Input & Alokasi Surat Jalan PMG
        </h3>
        <p className="text-xs opacity-60">Buat surat jalan dengan kop resmi PMG dan alokasikan barang ke berbagai klien tujuan.</p>
      </div>

      <form onSubmit={handleSaveProject} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-bold mb-1 opacity-75">Transaction Code *</label>
            <input 
              type="text" 
              placeholder="Cth: 00001768/WB/PMG/VIII/2026"
              value={form.transaction_code}
              onChange={e => setForm({ ...form, transaction_code: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1 opacity-75">Project Name *</label>
            <input 
              type="text" 
              placeholder="Cth: COCA COLA-CUSTOM BANNER"
              value={form.project_name}
              onChange={e => setForm({ ...form, project_name: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1 opacity-75">Tanggal Pengiriman</label>
            <input 
              type="date" 
              value={form.delivery_date}
              onChange={e => setForm({ ...form, delivery_date: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            />
          </div>
        </div>

        {/* Dynamic Items & Destination Allocations + Import Excel */}
        <div className="border rounded-2xl p-4 space-y-3 dark:border-neutral-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h4 className="font-bold text-xs uppercase text-indigo-500">Daftar Item & Alokasi Tujuan Klien</h4>
            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-sm">
                📂 Import Item via Excel
                <input type="file" accept=".xlsx, .xls" onChange={handleImportItemsExcel} className="hidden" />
              </label>
              <button 
                type="button" 
                onClick={handleAddItemRow}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px]"
              >
                ➕ Tambah Item Barang
              </button>
            </div>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2 border-t dark:border-neutral-700">
              <div className="sm:col-span-3">
                <select 
                  value={item.destination_id}
                  onChange={e => handleItemChange(idx, 'destination_id', e.target.value)}
                  className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
                  required
                >
                  <option value="">-- Pilih Tujuan Klien --</option>
                  {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-4">
                <input 
                  type="text"
                  placeholder="Nama Barang (Cth: FF KOREA 11 OZ)"
                  value={item.item_name}
                  onChange={e => handleItemChange(idx, 'item_name', e.target.value)}
                  className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <input 
                  type="text"
                  placeholder="Ukuran (Cth: 530 x 50 cm)"
                  value={item.dimensions}
                  onChange={e => handleItemChange(idx, 'dimensions', e.target.value)}
                  className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
                />
              </div>
              {/* QTY DIPERBESAR */}
              <div className="sm:col-span-1">
                <input 
                  type="number"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                  className={`w-full p-3 border-2 border-indigo-500 rounded-xl font-black text-center text-sm ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-stone-900'}`}
                  min="1"
                />
              </div>
              <div className="sm:col-span-1 text-center">
                {items.length > 1 && (
                  <button type="button" onClick={() => handleRemoveItemRow(idx)} className="text-rose-500 font-bold p-2">❌</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
          💾 Simpan & Terbitkan Surat Jalan PMG
        </button>
      </form>

      {/* Daftar Project & Tombol Preview Lokal */}
      <div className="mt-8 space-y-3">
        <h4 className="font-bold text-xs uppercase text-stone-500">Riwayat Surat Jalan PMG Tersimpan</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {projects.map(p => (
            <div key={p.id} className="p-4 border rounded-2xl flex justify-between items-center gap-4 dark:border-neutral-700">
              <div>
                <p className="font-bold text-indigo-500">{p.project_name}</p>
                <p className="opacity-70 text-[11px]">Trx Code: {p.transaction_code} | Tgl: {p.delivery_date}</p>
              </div>
              <button 
                onClick={() => setPrintData(p)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs whitespace-nowrap"
              >
                👁️ Lihat & Cetak Surat Jalan
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL PRATINJAU CETAK LANGSUNG DI HALAMAN (SOLUSI BLANK LOKAL) */}
      {printData && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm uppercase text-blue-900">Pratinjau Dokumen Surat Jalan</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
                >
                  🖨️ Cetak / Print Dokumen
                </button>
                <button 
                  onClick={() => setPrintData(null)} 
                  className="px-3 py-2 bg-stone-300 hover:bg-stone-400 font-bold rounded-xl text-xs"
                >
                  ✕ Tutup
                </button>
              </div>
            </div>

            {/* AREA DOKUMEN CETAK RESMI PMG */}
            <div id="printable-area" className="p-6 bg-white text-black font-sans text-xs border rounded-xl">
              <div style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '15px', color: '#003366' }}>PT. PMG INTEGRASI KOMUNIKASI</h2>
                <p style={{ margin: '3px 0', fontSize: '10px' }}>EightyEight@Kasablanka Tower A.30B Floor, Jl. Raya Casablanca Kav 88 Jakarta 12870</p>
                <p style={{ margin: '3px 0', fontSize: '10px' }}>Tlp. +62 21 29820243 | Fax: +62 21 29820244 | Web: www.pmgasia.com</p>
              </div>

              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', margin: '15px 0', textDecoration: 'underline' }}>
                DELIVERY ORDER / SURAT JALAN
              </div>

              <table style={{ width: '100%', border: 'none', marginBottom: '15px', fontSize: '12px' }}>
                <tr>
                  <td><b>DR No.</b> : {printData.dr_number || '-'}</td>
                  <td><b>Project Name</b> : {printData.project_name}</td>
                </tr>
                <tr>
                  <td><b>Date</b> : {printData.delivery_date}</td>
                  <td><b>Transaction Code</b> : {printData.transaction_code}</td>
                </tr>
                <tr>
                  <td><b>Vehicle No.</b> : {printData.vehicle_no || '-'}</td>
                  <td><b>Phone No.</b> : {printData.phone_no || '-'}</td>
                </tr>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f2f2f2' }}>
                    <th style={{ border: '1px solid #000', padding: '8px' }}>NO.</th>
                    <th style={{ border: '1px solid #000', padding: '8px' }}>ITEM & TUJUAN CLIENT</th>
                    <th style={{ border: '1px solid #000', padding: '8px' }}>QUANTITIES</th>
                    <th style={{ border: '1px solid #000', padding: '8px' }}>UNIT</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.pmg_project_items?.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '6px' }}>
                        <b>{item.item_name}</b><br/>
                        <span style={{ fontSize: '11px', color: '#555' }}>{item.dimensions || ''}</span><br/>
                        <small style={{ color: '#0066cc' }}>Deliver to: {item.pmg_destinations?.client_name || 'Umum'}</small>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{item.qty}</td>
                      <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ fontSize: '10px', marginTop: '15px', fontStyle: 'italic' }}>
                * Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px' }}>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <p>Pengirim,</p>
                  <br/><br/><br/>
                  <p><b>({printData.sender_name || 'NINING'})</b></p>
                </div>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <p>Penerima,</p>
                  <br/><br/><br/>
                  <p><b>( Tanda Tangan & Stampel )</b></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}