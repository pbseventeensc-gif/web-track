import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function PmgProjectManager({ isDarkMode }) {
  const [projects, setProjects] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [printData, setPrintData] = useState(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [pmgLogo, setPmgLogo] = useState(''); 
  
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
  const [selectedItemIndexes, setSelectedItemIndexes] = useState([]);

  useEffect(() => {
    fetchProjects();
    fetchDestinations();
  }, []);

  const fetchProjects = async () => {
    const { data } = await supabase.from('pmg_projects').select('*, pmg_project_items(*, pmg_destinations(client_name, address))').order('id', { ascending: false });
    if (data) setProjects(data);
  };

  const fetchDestinations = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) {
      const cleanData = data.filter(d => d.client_name && !d.client_name.includes('Kolom'));
      setDestinations(cleanData);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPmgLogo(reader.result);
      reader.readAsDataURL(file);
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
    setSelectedItemIndexes(selectedItemIndexes.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  // 🔥 FITUR HAPUS MASSAL & HAPUS TERPILIH ITEM
  const handleRemoveSelectedItems = () => {
    if (selectedItemIndexes.length === 0) return alert('Pilih minimal satu baris item yang ingin dihapus!');
    if (!window.confirm(`Hapus ${selectedItemIndexes.length} item yang dipilih?`)) return;
    
    const remainingItems = items.filter((_, idx) => !selectedItemIndexes.includes(idx));
    setItems(remainingItems.length > 0 ? remainingItems : [{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
    setSelectedItemIndexes([]);
  };

  const handleClearAllItems = () => {
    if (!window.confirm('🚨 Yakin ingin menghapus SEMUA daftar item?')) return;
    setItems([{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
    setSelectedItemIndexes([]);
  };

  const handleToggleSelectItem = (index) => {
    setSelectedItemIndexes(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

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
          setSelectedItemIndexes([]);
          alert(`✅ Berhasil mengimpor ${importedItems.length} item dari Excel!`);
        } else {
          alert('⚠️ Format baris Excel tidak dikenali.');
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

    const { data: existing, error: checkError } = await supabase
      .from('pmg_projects')
      .select('id')
      .eq('transaction_code', form.transaction_code);

    if (checkError) return alert('Error checking duplication: ' + checkError.message);
    if (existing && existing.length > 0) {
      return alert('⚠️ DITOLAK: Surat Jalan dengan Transaction Code "' + form.transaction_code + '" sudah terdaftar!');
    }

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
      setSelectedItemIndexes([]);
      fetchProjects();
    }
  };

  const handleDeleteSingle = async (id, name) => {
    if (!window.confirm(`Hapus surat jalan "${name}"?`)) return;
    await supabase.from('pmg_project_items').delete().eq('project_id', id);
    const { error } = await supabase.from('pmg_projects').delete().eq('id', id);
    if (!error) fetchProjects();
  };

  const handleBulkDelete = async () => {
    if (selectedProjectIds.length === 0) return alert('Pilih minimal satu!');
    if (!window.confirm(`Hapus ${selectedProjectIds.length} surat jalan yang dipilih?`)) return;
    for (const id of selectedProjectIds) {
      await supabase.from('pmg_project_items').delete().eq('project_id', id);
      await supabase.from('pmg_projects').delete().eq('id', id);
    }
    setSelectedProjectIds([]);
    fetchProjects();
  };

  const renderEmptyRows = (currentCount) => {
    const targetRows = Math.max(0, 10 - currentCount);
    const rows = [];
    for (let i = 0; i < targetRows; i++) {
      rows.push(
        <tr key={`empty-${i}`}>
          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>&nbsp;</td>
          <td style={{ border: '1px solid #000', padding: '4px' }}></td>
          <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}></td>
          <td style={{ border: '1px solid #000', padding: '4px' }}></td>
        </tr>
      );
    }
    return rows;
  };

  return (
    <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <div>
        <h3 className="font-extrabold text-sm uppercase text-indigo-600 dark:text-indigo-400">
          📋 Input & Alokasi Surat Jalan / POD PMG
        </h3>
        <p className="text-xs opacity-60">Buat dokumen pengiriman dengan format resmi POD & Surat Jalan PMG.</p>
      </div>

      <div className="p-4 border rounded-2xl dark:border-neutral-700 text-xs">
        <label className="block font-bold mb-1 opacity-75">Upload Logo PMG (Header Dokumen):</label>
        <input type="file" accept="image/*" onChange={handleLogoUpload} />
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
            <label className="block font-bold mb-1 opacity-70">Tanggal Pengiriman</label>
            <input 
              type="date" 
              value={form.delivery_date}
              onChange={e => setForm({ ...form, delivery_date: e.target.value })}
              className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
            />
          </div>
        </div>

        <div className="border rounded-2xl p-4 space-y-3 dark:border-neutral-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h4 className="font-bold text-xs uppercase text-indigo-500">Daftar Item & Alokasi Tujuan Klien ({items.length} Item)</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItemIndexes.length > 0 && (
                <button type="button" onClick={handleRemoveSelectedItems} className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded-lg text-[11px] shadow-sm">
                  🗑️ Hapus Terpilih ({selectedItemIndexes.length})
                </button>
              )}
              {items.length > 1 && (
                <button type="button" onClick={handleClearAllItems} className="px-3 py-1.5 bg-rose-700 text-white font-bold rounded-lg text-[11px] shadow-sm">
                  🔥 Hapus Semua Item
                </button>
              )}
              <label className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-sm">
                📂 Import Excel
                <input type="file" accept=".xlsx, .xls" onChange={handleImportItemsExcel} className="hidden" />
              </label>
              <button type="button" onClick={handleAddItemRow} className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-[11px] shadow-sm">➕ Tambah Item</button>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-xl border dark:border-neutral-700 bg-stone-50/50 dark:bg-neutral-900/40">
                <div className="sm:col-span-1 flex items-center justify-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={selectedItemIndexes.includes(idx)} 
                    onChange={() => handleToggleSelectItem(idx)}
                    className="w-4 h-4 accent-indigo-600 cursor-pointer" 
                  />
                  <span className="text-[10px] opacity-60 font-mono">#{idx + 1}</span>
                </div>
                <div className="sm:col-span-3">
                  <select 
                    value={item.destination_id}
                    onChange={e => handleItemChange(idx, 'destination_id', e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-stone-300'}`}
                    required
                  >
                    <option value="">-- Pilih Klien Tujuan --</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-4">
                  <input 
                    type="text" placeholder="Nama Barang"
                    value={item.item_name} onChange={e => handleItemChange(idx, 'item_name', e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-stone-300'}`}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <input 
                    type="text" placeholder="Ukuran / Keterangan"
                    value={item.dimensions} onChange={e => handleItemChange(idx, 'dimensions', e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-stone-300'}`}
                  />
                </div>
                <div className="sm:col-span-1">
                  <input 
                    type="text" inputMode="numeric" value={item.qty}
                    onChange={e => handleItemChange(idx, 'qty', e.target.value.replace(/\D/g, ''))}
                    className={`w-full p-2.5 border-2 border-indigo-500 rounded-xl font-black text-center text-xs ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white'}`}
                  />
                </div>
                <div className="sm:col-span-1 text-center">
                  {items.length > 1 && <button type="button" onClick={() => handleRemoveItemRow(idx)} className="text-rose-500 font-bold hover:scale-110 transition-transform">❌</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-all">
          💾 Simpan & Terbitkan Dokumen PMG
        </button>
      </form>

      {/* RIWAYAT */}
      <div className="mt-8 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-xs uppercase text-stone-500">Riwayat Surat Jalan & POD PMG</span>
          {selectedProjectIds.length > 0 && (
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded-xl text-xs">🗑️ Hapus Terpilih ({selectedProjectIds.length})</button>
          )}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {projects.map(p => (
            <div key={p.id} className="p-4 border rounded-2xl flex justify-between items-center gap-4 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selectedProjectIds.includes(p.id)} onChange={() => setSelectedProjectIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} className="w-4 h-4 accent-indigo-600" />
                <div>
                  <p className="font-bold text-indigo-500">{p.project_name}</p>
                  <p className="opacity-70 text-[11px]">Trx Code: {p.transaction_code} | Tgl: {p.delivery_date}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPrintData(p)} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs shadow-sm">👁️ Cetak POD & SJ</button>
                <button onClick={() => handleDeleteSingle(p.id, p.project_name)} className="px-3 py-2 bg-rose-50 text-rose-600 font-bold rounded-xl text-xs">🗑️ Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL PRATINJAU CETAK */}
      {printData && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 print:hidden">
              <h3 className="font-bold text-sm uppercase text-blue-900">Pratinjau Dokumen POD & Surat Jalan PMG</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs">🖨️ Cetak Dokumen</button>
                <button onClick={() => setPrintData(null)} className="px-3 py-2 bg-stone-300 font-bold rounded-xl text-xs">✕ Tutup</button>
              </div>
            </div>

            {/* HALAMAN 1: PROOF OF DELIVERY (POD) */}
            <div className="p-6 bg-white text-black font-sans text-xs border rounded-xl space-y-2" style={{ fontFamily: 'Arial, sans-serif' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', width: '40%', verticalAlign: 'top' }}>
                    <h2 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: 'bold' }}>PT. PMG INTEGRASI KOMUNIKASI</h2>
                    <p style={{ margin: '2px 0', fontSize: '8px', lineHeight: '1.2' }}>EightyEight@Kasablanka Tower A.30 B Floor<br/>Jl. Raya Casablanca Kav 88 Jakarta 12870<br/>Tlp. +62 21 29820243 Fax: +62 21 29820244<br/>Web: www.pmgasia.com</p>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', verticalAlign: 'middle', width: '35%' }}>
                    <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', fontFamily: 'serif' }}>Proof Of Delivery</h1>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', verticalAlign: 'middle', width: '25%' }}>
                    {pmgLogo ? <img src={pmgLogo} alt="Logo" style={{ maxHeight: '45px', marginLeft: 'auto' }} /> : <div style={{ fontWeight: 'bold', fontSize: '14px' }}>PMG GROUP</div>}
                  </td>
                </tr>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '-1px' }}>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '15%', fontWeight: 'bold' }}>DR No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '35%' }}>: {printData.dr_number || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '15%', fontWeight: 'bold' }}>Deliver to</td>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '35%' }}>: {printData.pmg_project_items?.[0]?.pmg_destinations?.client_name || ''}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Date</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.delivery_date}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', verticalAlign: 'top' }} rowSpan={3}></td>
                  <td style={{ border: '1px solid #000', padding: '5px', verticalAlign: 'top' }} rowSpan={3}>: {printData.pmg_project_items?.[0]?.pmg_destinations?.address || ''}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Time</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Project No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Transaction Code</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.transaction_code}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Vehicle No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.vehicle_no || ''}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Project Name</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.project_name}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Phone No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.phone_no || ''}</td>
                </tr>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#d3d3d3' }}>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '8%', textAlign: 'center' }}>NO.</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '57%', textAlign: 'center' }}>ITEM</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '15%', textAlign: 'center' }}>QUANTITIES</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '20%', textAlign: 'center' }}>ADDITIONAL INFO</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.pmg_project_items?.map((item, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}>
                        {item.item_name} {item.dimensions ? `_ ${item.dimensions}` : ''}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}></td>
                    </tr>
                  ))}
                  {renderEmptyRows(printData.pmg_project_items?.length || 0)}
                  <tr style={{ background: '#d3d3d3', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }} colSpan={2}>Grand Total :</td>
                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                      {printData.pmg_project_items?.reduce((acc, curr) => acc + Number(curr.qty), 0)}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                  </tr>
                </tbody>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#d3d3d3' }}>
                    <th style={{ border: '1px solid #000', padding: '4px', width: '50%', textAlign: 'center' }}>Pengirim</th>
                    <th style={{ border: '1px solid #000', padding: '4px', width: '50%', textAlign: 'center' }}>Penerima</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '5px', verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tr><td style={{ padding: '2px 0' }}>Nama Lengkap Pengirim</td><td style={{ padding: '2px 0' }}>: {printData.sender_name || 'NINING'}</td></tr>
                        <tr><td style={{ padding: '2px 0', height: '35px', verticalAlign: 'top' }}>Tanda Tangan dan Stampel</td><td>: </td></tr>
                      </table>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '5px', verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tr><td style={{ padding: '2px 0' }}>Nama Lengkap Penerima</td><td style={{ padding: '2px 0' }}>: </td></tr>
                        <tr><td style={{ padding: '2px 0', height: '35px', verticalAlign: 'top' }}>Tanda Tangan dan Stampel</td><td>: </td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px' }}>Tanggal :</td>
                    <td style={{ border: '1px solid #000', padding: '3px' }}>Tanggal :</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontStyle: 'italic' }} colSpan={2}>
                      - Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ pageBreakBefore: 'always', margin: '30px 0' }} className="print:block" />

            {/* HALAMAN 2: DELIVERY ORDER / SURAT JALAN */}
            <div className="p-6 bg-white text-black font-sans text-xs border rounded-xl space-y-2" style={{ fontFamily: 'Arial, sans-serif' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', width: '40%', verticalAlign: 'top' }}>
                    <h2 style={{ margin: '0 0 5px 0', fontSize: '13px', fontWeight: 'bold' }}>PT. PMG INTEGRASI KOMUNIKASI</h2>
                    <p style={{ margin: '2px 0', fontSize: '8px', lineHeight: '1.2' }}>EightyEight@Kasablanka Tower A.30 B Floor<br/>Jl. Raya Casablanca Kav 88 Jakarta 12870<br/>Tlp. +62 21 29820243 Fax: +62 21 29820244<br/>Web: www.pmgasia.com</p>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', verticalAlign: 'middle', width: '35%' }}>
                    <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold' }}>DELIVERY ORDER</h3>
                    <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', fontFamily: 'serif' }}>SURAT JALAN</h1>
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', verticalAlign: 'middle', width: '25%' }}>
                    {pmgLogo ? <img src={pmgLogo} alt="Logo" style={{ maxHeight: '45px', marginLeft: 'auto' }} /> : <div style={{ fontWeight: 'bold', fontSize: '14px' }}>PMG GROUP</div>}
                  </td>
                </tr>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '-1px' }}>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '15%', fontWeight: 'bold' }}>DR No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '35%' }}>: {printData.dr_number || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '15%', fontWeight: 'bold' }}>Deliver to</td>
                  <td style={{ border: '1px solid #000', padding: '5px', width: '35%' }}>: {printData.pmg_project_items?.[0]?.pmg_destinations?.client_name || ''}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Date</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.delivery_date}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold', verticalAlign: 'top' }} rowSpan={3}></td>
                  <td style={{ border: '1px solid #000', padding: '5px', verticalAlign: 'top' }} rowSpan={3}>: {printData.pmg_project_items?.[0]?.pmg_destinations?.address || ''}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Time</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Project No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Transaction Code</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.transaction_code}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Vehicle No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.vehicle_no || ''}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>ITEM</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: </td>
                  <td style={{ border: '1px solid #000', padding: '5px', fontWeight: 'bold' }}>Phone No.</td>
                  <td style={{ border: '1px solid #000', padding: '5px' }}>: {printData.phone_no || ''}</td>
                </tr>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#d3d3d3' }}>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '8%', textAlign: 'center' }}>NO.</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '57%', textAlign: 'center' }}>ITEM</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '15%', textAlign: 'center' }}>QUANTITIES</th>
                    <th style={{ border: '1px solid #000', padding: '5px', width: '20%', textAlign: 'center' }}>ADDITIONAL INFO</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.pmg_project_items?.map((item, i) => (
                    <tr key={i}>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}>
                        {item.item_name} {item.dimensions ? `_ ${item.dimensions}` : ''}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ border: '1px solid #000', padding: '4px' }}></td>
                    </tr>
                  ))}
                  {renderEmptyRows(printData.pmg_project_items?.length || 0)}
                  <tr style={{ background: '#d3d3d3', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'right' }} colSpan={2}>Grand Total :</td>
                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>
                      {printData.pmg_project_items?.reduce((acc, curr) => acc + Number(curr.qty), 0)}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '5px' }}></td>
                  </tr>
                </tbody>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#d3d3d3' }}>
                    <th style={{ border: '1px solid #000', padding: '4px', width: '50%', textAlign: 'center' }}>Pengirim</th>
                    <th style={{ border: '1px solid #000', padding: '4px', width: '50%', textAlign: 'center' }}>Penerima</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '5px', verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tr><td style={{ padding: '2px 0' }}>Nama Lengkap Pengirim</td><td style={{ padding: '2px 0' }}>: {printData.sender_name || 'NINING'}</td></tr>
                        <tr><td style={{ padding: '2px 0', height: '35px', verticalAlign: 'top' }}>Tanda Tangan dan Stampel</td><td>: </td></tr>
                      </table>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '5px', verticalAlign: 'top' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tr><td style={{ padding: '2px 0' }}>Nama Lengkap Penerima</td><td style={{ padding: '2px 0' }}>: </td></tr>
                        <tr><td style={{ padding: '2px 0', height: '35px', verticalAlign: 'top' }}>Tanda Tangan dan Stampel</td><td>: </td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px' }}>Tanggal :</td>
                    <td style={{ border: '1px solid #000', padding: '3px' }}>Tanggal :</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px', fontSize: '8px', fontStyle: 'italic' }} colSpan={2}>
                      - Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}