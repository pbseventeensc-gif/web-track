import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

export default function KawanLamaLabelManager({ isDarkMode }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // Daftar pilihan PT default & state input PT baru
  const [ptList, setPtList] = useState([
    'PT KRISBOW INDONESIA',
    'PT KAWAN LAMA SEJAHTERA',
    'PT ACE HARDWARE INDONESIA'
  ]);
  const [selectedPt, setSelectedPt] = useState('PT KRISBOW INDONESIA');
  const [newPtInput, setNewPtInput] = useState('');
  const [showAddPtModal, setShowAddPtModal] = useState(false);

  const [projectName, setProjectName] = useState('FIESTA AZKO ( SPK-0726-02322 )');

  const [items, setItems] = useState([
    { no: 1, item: 'STANDING POP AWAN', bahan: 'IMPRABOARD 5MM STICKER VYNIL LAM DOFF 2 SISI', ukuran: '80 X 50 CM', qty: '1', satuan: 'PCS' }
  ]);

  const [printModal, setPrintModal] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    const { data } = await supabase.from('pmg_destinations').select('*').order('client_name');
    if (data) {
      const cleanData = data.filter(d => d.client_name && !d.client_name.includes('Kolom'));
      setBranches(cleanData);
    }
  };

  const handleAddNewPt = (e) => {
    e.preventDefault();
    if (!newPtInput.trim()) return alert('Nama PT baru wajib diisi!');
    if (ptList.includes(newPtInput.trim())) return alert('Nama PT tersebut sudah ada dalam daftar!');

    const updatedList = [...ptList, newPtInput.trim().toUpperCase()];
    setPtList(updatedList);
    setSelectedPt(newPtInput.trim().toUpperCase());
    setNewPtInput('');
    setShowAddPtModal(false);
  };

  const handleAddItem = () => {
    setItems([...items, { no: items.length + 1, item: '', bahan: '', ukuran: '', qty: '1', satuan: 'PCS' }]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index).map((it, idx) => ({ ...it, no: idx + 1 }));
    setItems(newItems);
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });

        const imported = [];
        rawData.forEach((row, idx) => {
          if (idx === 0) return;
          const itemVal = row[0] ? String(row[0]).trim() : '';
          const bahanVal = row[1] ? String(row[1]).trim() : '';
          const ukuranVal = row[2] ? String(row[2]).trim() : '';
          const qtyVal = row[3] ? String(row[3]).trim() : '1';
          const satuanVal = row[4] ? String(row[4]).trim() : 'PCS';

          if (itemVal) {
            imported.push({
              no: imported.length + 1,
              item: itemVal,
              bahan: bahanVal,
              ukuran: ukuranVal,
              qty: qtyVal,
              satuan: satuanVal
            });
          }
        });

        if (imported.length > 0) {
          setItems(imported);
          alert(`✅ Berhasil mengimpor ${imported.length} item dari Excel!`);
        } else {
          alert('⚠️ Format baris Excel tidak sesuai.');
        }
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const selectedStoreObj = branches.find(b => String(b.id) === String(selectedBranch));
  const storeName = selectedStoreObj ? selectedStoreObj.client_name : 'Azko Kota Wisata (Pilih Cabang)';

  return (
    <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="font-black text-lg text-indigo-600 dark:text-indigo-400">🏷️ Generator Label Kawan Lama Group</h2>
          <p className="text-xs opacity-60">Pilih atau tambah nama PT baru, pilih cabang tujuan, dan kelola rincian item label.</p>
        </div>
        <label className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm">
          📂 Import Item Label via Excel
          <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
        </label>
      </div>

      {/* PENGATURAN HEADER PT & PROJECT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-bold opacity-70">Pilih / Tambah Nama PT (Header)</label>
            <button 
              type="button" 
              onClick={() => setShowAddPtModal(true)}
              className="text-indigo-500 hover:underline font-bold text-[11px]"
            >
              ➕ Tambah PT Baru
            </button>
          </div>
          <select 
            value={selectedPt}
            onChange={e => setSelectedPt(e.target.value)}
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          >
            {ptList.map((pt, idx) => (
              <option key={idx} value={pt}>{pt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold mb-1 opacity-70">Nama Project / SPK</label>
          <input 
            type="text" 
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
          />
        </div>
      </div>

      {/* PILIH CABANG / STORE */}
      <div className="text-xs">
        <label className="block font-bold mb-1 opacity-70">Pilih Store / Cabang Tujuan (Master Cabang)</label>
        <select 
          value={selectedBranch}
          onChange={e => setSelectedBranch(e.target.value)}
          className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}
        >
          <option value="">-- Pilih Store Tujuan --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.client_name} - {b.address}</option>
          ))}
        </select>
      </div>

      {/* TABEL ITEM DINAMIS */}
      <div className="border rounded-2xl p-4 space-y-3 dark:border-neutral-700 text-xs">
        <div className="flex justify-between items-center">
          <h4 className="font-bold uppercase text-indigo-500">Daftar Item Barang Label</h4>
          <button type="button" onClick={handleAddItem} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px]">
            ➕ Tambah Baris Item
          </button>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 border rounded-xl dark:border-neutral-700">
              <div className="sm:col-span-1 text-center font-bold">{it.no}</div>
              <div className="sm:col-span-4">
                <input 
                  type="text" placeholder="Nama Item" value={it.item}
                  onChange={e => handleItemChange(idx, 'item', e.target.value)}
                  className={`w-full p-2 border rounded-lg ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50'}`}
                />
              </div>
              <div className="sm:col-span-3">
                <input 
                  type="text" placeholder="Bahan" value={it.bahan}
                  onChange={e => handleItemChange(idx, 'bahan', e.target.value)}
                  className={`w-full p-2 border rounded-lg ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50'}`}
                />
              </div>
              <div className="sm:col-span-2">
                <input 
                  type="text" placeholder="Ukuran" value={it.ukuran}
                  onChange={e => handleItemChange(idx, 'ukuran', e.target.value)}
                  className={`w-full p-2 border rounded-lg ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50'}`}
                />
              </div>
              <div className="sm:col-span-1">
                <input 
                  type="text" placeholder="Qty" value={it.qty}
                  onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                  className={`w-full p-2 border rounded-lg text-center font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50'}`}
                />
              </div>
              <div className="sm:col-span-1 flex items-center justify-between">
                <input 
                  type="text" placeholder="Satuan" value={it.satuan}
                  onChange={e => handleItemChange(idx, 'satuan', e.target.value)}
                  className={`w-12 p-2 border rounded-lg text-center ${isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-stone-50'}`}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => handleRemoveItem(idx)} className="text-rose-500 font-bold px-1">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={() => setPrintModal(true)}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl active:scale-95 transition-all text-xs shadow-md"
      >
        👁️ Pratinjau & Cetak Label Kawan Lama (Anti-Blank Lokal)
      </button>

      {/* MODAL TAMBAH PT BARU */}
      {showAddPtModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-sm uppercase text-indigo-600">Tambah Nama PT / Perusahaan Baru</h3>
            <form onSubmit={handleAddNewPt} className="space-y-3 text-xs">
              <input 
                type="text"
                placeholder="Cth: PT INDO KAWAN LAMA"
                value={newPtInput}
                onChange={e => setNewPtInput(e.target.value)}
                className="w-full p-3 border rounded-xl font-semibold bg-stone-50"
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddPtModal(false)} className="px-4 py-2 bg-stone-300 font-bold rounded-xl">Batal</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl">Simpan PT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW CETAK */}
      {printModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm uppercase text-blue-900">Pratinjau Label Pengiriman</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs">🖨️ Cetak Label</button>
                <button onClick={() => setPrintModal(false)} className="px-3 py-2 bg-stone-300 hover:bg-stone-400 font-bold rounded-xl text-xs">✕ Tutup</button>
              </div>
            </div>

            <div className="p-6 bg-white text-black font-sans text-xs border-2 border-black rounded-lg">
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th colSpan="5" style={{ border: '1px solid black', padding: '10px', fontSize: '15px', fontWeight: 'bold', background: '#f2f2f2' }}>
                      {selectedPt}
                    </th>
                  </tr>
                  <tr>
                    <th colSpan="5" style={{ border: '1px solid black', padding: '8px', fontSize: '13px', fontWeight: 'bold', background: '#e6e6e6' }}>
                      {projectName}
                    </th>
                  </tr>
                  <tr>
                    <th colSpan="5" style={{ border: '1px solid black', padding: '10px', textAlign: 'left', fontSize: '14px' }}>
                      <b>STORE</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp; <b>{storeName}</b>
                    </th>
                  </tr>
                  <tr style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                    <th style={{ border: '1px solid black', padding: '8px', width: '8%' }}>NO</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '37%' }}>ITEM</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '30%' }}>BAHAN</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '15%' }}>UKURAN</th>
                    <th colSpan="2" style={{ border: '1px solid black', padding: '8px', width: '10%' }}>QTY</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{it.no}</td>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>{it.item}</td>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>{it.bahan}</td>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{it.ukuran}</td>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{it.qty}</td>
                      <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{it.satuan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}