import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function PmgProjectManager({ isDarkMode }) {
  const [projects, setProjects] = useState([]);
  const [destinations, setDestinations] = useState([]);
  
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
      // Filter otomatis untuk membuang baris header jika masih ada
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
    </div>
  );
}