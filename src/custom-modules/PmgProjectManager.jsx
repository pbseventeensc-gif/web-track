import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function PmgProjectManager({ isDarkMode }) {
  const [projects, setProjects] = useState([]);
  const [destinations, setDestinations] = useState([]);
  
  // Form state untuk Proyek / Surat Jalan PMG
  const [form, setForm] = useState({
    dr_number: '',
    transaction_code: '',
    project_name: '',
    delivery_date: new Date().toISOString().split('T')[0],
    vehicle_no: '',
    phone_no: '',
    sender_name: 'NINING'
  });

  // State untuk item barang di dalam surat jalan
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
    if (data) setDestinations(data);
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

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!form.transaction_code || !form.project_name) return alert('Transaction Code dan Project Name wajib diisi!');

    // 1. Insert ke tabel pmg_projects
    const { data: projData, error: projError } = await supabase
      .from('pmg_projects')
      .insert([form])
      .select();

    if (projError) return alert('Gagal menyimpan project: ' + projError.message);

    const projectId = projData[0].id;

    // 2. Insert items ke tabel pmg_project_items
    const itemsToInsert = items.map(item => ({
      project_id: projectId,
      destination_id: item.destination_id || null,
      item_name: item.item_name,
      dimensions: item.dimensions,
      qty: Number(item.qty),
      unit: item.unit
    }));

    const { error: itemError } = await supabase.from('pmg_project_items').insert(itemsToInsert);
    if (itemError) {
      alert('Project tersimpan, namun ada kendala pada item barang: ' + itemError.message);
    } else {
      alert('✅ Surat Jalan & Alokasi PMG Berhasil Disimpan!');
      setForm({ dr_number: '', transaction_code: '', project_name: '', delivery_date: new Date().toISOString().split('T')[0], vehicle_no: '', phone_no: '', sender_name: 'NINING' });
      setItems([{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
      fetchProjects();
    }
  };

  // Fungsi Cetak Surat Jalan Ala PMG
  const handlePrintPmgSJ = (proj) => {
    const printWindow = window.open('', '_blank', 'width=900,height=900');
    const itemsHtml = proj.pmg_project_items.map((item, idx) => `
      <tr>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000; padding: 6px;">
          <b>${item.item_name}</b><br/>
          <span style="font-size: 11px; color: #555;">${item.dimensions || ''}</span><br/>
          <small style="color: #0066cc;">Deliver to: ${item.pmg_destinations?.client_name || 'Umum'}</small>
        </td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.qty}</td>
        <td style="border: 1px solid #000; padding: 6px; text-align: center;">${item.unit}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Surat Jalan - ${proj.transaction_code}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 20px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .title { text-align: center; font-weight: bold; font-size: 16px; margin: 15px 0; text-decoration: underline; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #f2f2f2; border: 1px solid #000; padding: 8px; font-size: 11px; }
            .footer-sign { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
            .sign-box { width: 200px; height: 70px; border-bottom: 1px solid #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0; font-size: 15px; color: #003366;">PT. PMG INTEGRASI KOMUNIKASI</h2>
            <p style="margin: 3px 0; font-size: 10px;">EightyEight@Kasablanka Tower A.30B Floor, Jl. Raya Casablanca Kav 88 Jakarta 12870</p>
            <p style="margin: 3px 0; font-size: 10px;">Tlp. +62 21 29820243 | Fax: +62 21 29820244 | Web: www.pmgasia.com</p>
          </div>

          <div class="title">DELIVERY ORDER / SURAT JALAN</div>

          <table style="border: none; margin-bottom: 15px;">
            <tr>
              <td><b>DR No.</b> : ${proj.dr_number || '-'}</td>
              <td><b>Project Name</b> : ${proj.project_name}</td>
            </tr>
            <tr>
              <td><b>Date</b> : ${proj.delivery_date}</td>
              <td><b>Transaction Code</b> : ${proj.transaction_code}</td>
            </tr>
            <tr>
              <td><b>Vehicle No.</b> : ${proj.vehicle_no || '-'}</td>
              <td><b>Phone No.</b> : ${proj.phone_no || '-'}</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr>
                <th>NO.</th>
                <th>ITEM & TUJUAN CLIENT</th>
                <th>QUANTITIES</th>
                <th>UNIT</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <p style="font-size: 10px; margin-top: 15px; font-style: italic;">
            * Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
          </p>

          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div style="text-align: center; width: 200px;">
              <p>Pengirim,</p>
              <br/><br/><br/>
              <p><b>(${proj.sender_name || 'NINING'})</b></p>
            </div>
            <div style="text-align: center; width: 200px;">
              <p>Penerima,</p>
              <br/><br/><br/>
              <p><b>( Tanda Tangan & Stampel )</b></p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
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

        {/* Dynamic Items & Destination Allocations */}
        <div className="border rounded-2xl p-4 space-y-3 dark:border-neutral-700">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-xs uppercase text-indigo-500">Daftar Item & Alokasi Tujuan Klien</h4>
            <button 
              type="button" 
              onClick={handleAddItemRow}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px]"
            >
              ➕ Tambah Item Barang
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center pt-2 border-t dark:border-neutral-700">
              <div className="sm:col-span-3">
                <select 
                  value={item.destination_id}
                  onChange={e => handleItemChange(idx, 'destination_id', e.target.value)}
                  className={`w-full p-2.5 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
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
                  className={`w-full p-2.5 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
                  required
                />
              </div>
              <div className="sm:col-span-3">
                <input 
                  type="text"
                  placeholder="Ukuran / Keterangan (Cth: 530 x 50 cm)"
                  value={item.dimensions}
                  onChange={e => handleItemChange(idx, 'dimensions', e.target.value)}
                  className={`w-full p-2.5 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
                />
              </div>
              <div className="sm:col-span-1">
                <input 
                  type="number"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                  className={`w-full p-2.5 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
                  min="1"
                />
              </div>
              <div className="sm:col-span-1 text-center">
                {items.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveItemRow(idx)}
                    className="text-rose-500 font-bold p-2"
                  >
                    ❌
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button 
          type="submit" 
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-md active:scale-95"
        >
          💾 Simpan & Terbitkan Surat Jalan PMG
        </button>
      </form>

      {/* Daftar Project Tersimpan */}
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
                onClick={() => handlePrintPmgSJ(p)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs whitespace-nowrap"
              >
                🖨️ Cetak Surat Jalan PMG
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}