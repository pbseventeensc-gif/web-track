import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { Upload, Plus, Trash2, Printer, Building2 } from 'lucide-react';
import CustomDropdown from '../components/ui/CustomDropdown';

export default function KawanLamaLabelManager({ isDarkMode }) {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // Default company options & new company state
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
    if (!newPtInput.trim()) return alert('Nama perusahaan wajib diisi.');
    if (ptList.includes(newPtInput.trim().toUpperCase())) return alert('Nama perusahaan tersebut sudah terdaftar dalam daftar.');

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
          alert(`Berhasil mengimpor ${imported.length} baris item label.`);
        } else {
          alert('Format baris tidak sesuai atau kosong.');
        }
      } catch (err) {
        alert('Gagal membaca berkas Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const selectedStoreObj = branches.find(b => String(b.id) === String(selectedBranch));
  const storeName = selectedStoreObj ? selectedStoreObj.client_name : 'Azko Kota Wisata (Pilih Cabang)';

  return (
    <div className={`p-6 rounded-3xl border shadow-2xs space-y-6 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100">
            Generator Label Pengiriman Kawan Lama Group
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pilih atau tambahkan entitas perusahaan, tentukan cabang tujuan, serta kelola rincian barang pada label.
          </p>
        </div>
        <label className="px-3.5 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold rounded-xl text-xs cursor-pointer shadow-2xs transition-all active:scale-95 inline-flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          Impor Daftar Item (Excel)
          <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" />
        </label>
      </div>

      {/* HEADER COMPANY & PROJECT SETTINGS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Pilih Entitas Perusahaan (Header)</label>
            <button 
              type="button" 
              onClick={() => setShowAddPtModal(true)}
              className="px-2 py-0.5 rounded-lg bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold text-[11px] transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <Building2 className="w-3 h-3" />
              Tambah Perusahaan
            </button>
          </div>
          <CustomDropdown 
            value={selectedPt}
            onChange={e => setSelectedPt(e.target.value)}
            className="w-full"
          >
            {ptList.map((pt, idx) => (
              <option key={idx} value={pt}>{pt}</option>
            ))}
          </CustomDropdown>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nama Proyek / Nomor SPK</label>
          <input 
            type="text" 
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            className={`w-full p-2.5 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
          />
        </div>
      </div>

      {/* SELECT BRANCH / STORE */}
      <div className="text-xs">
        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Pilih Toko / Cabang Tujuan (Data Master)</label>
        <CustomDropdown 
          value={selectedBranch}
          onChange={e => setSelectedBranch(e.target.value)}
          className="w-full"
        >
          <option value="">-- Pilih Toko / Cabang Tujuan --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.client_name} - {b.address}</option>
          ))}
        </CustomDropdown>
      </div>

      {/* DYNAMIC ITEM TABLE */}
      <div className="border border-slate-200/80 dark:border-neutral-800 rounded-2xl p-4 space-y-3 text-xs">
        <div className="flex justify-between items-center">
          <h4 className="font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">Daftar Barang pada Label</h4>
          <button type="button" onClick={handleAddItem} className="px-3 py-1.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl text-[11px] transition-all cursor-pointer inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" />
            Tambah Baris Barang
          </button>
        </div>

        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 border border-slate-200/80 dark:border-neutral-800 rounded-xl bg-slate-50/50 dark:bg-neutral-800/40">
              <div className="sm:col-span-1 text-center font-bold text-slate-600 dark:text-slate-400">{it.no}</div>
              <div className="sm:col-span-4">
                <input 
                  type="text" placeholder="Nama Barang" value={it.item}
                  onChange={e => handleItemChange(idx, 'item', e.target.value)}
                  className={`w-full p-2 border rounded-lg ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>
              <div className="sm:col-span-3">
                <input 
                  type="text" placeholder="Spesifikasi Bahan" value={it.bahan}
                  onChange={e => handleItemChange(idx, 'bahan', e.target.value)}
                  className={`w-full p-2 border rounded-lg ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>
              <div className="sm:col-span-2">
                <input 
                  type="text" placeholder="Ukuran" value={it.ukuran}
                  onChange={e => handleItemChange(idx, 'ukuran', e.target.value)}
                  className={`w-full p-2 border rounded-lg ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>
              <div className="sm:col-span-1">
                <input 
                  type="text" placeholder="Jml" value={it.qty}
                  onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                  className={`w-full p-2 border rounded-lg text-center font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
              </div>
              <div className="sm:col-span-1 flex items-center justify-between gap-1">
                <input 
                  type="text" placeholder="Satuan" value={it.satuan}
                  onChange={e => handleItemChange(idx, 'satuan', e.target.value)}
                  className={`w-12 p-2 border rounded-lg text-center ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'}`}
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => handleRemoveItem(idx)} className="p-1.5 rounded-lg bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 cursor-pointer" title="Hapus Baris">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button 
        onClick={() => setPrintModal(true)}
        className="w-full py-3 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-bold rounded-xl active:scale-95 transition-all text-xs shadow-2xs cursor-pointer flex items-center justify-center gap-2"
      >
        <Printer className="w-4 h-4" />
        Pratinjau & Cetak Label Kawan Lama
      </button>

      {/* MODAL ADD NEW PT */}
      {showAddPtModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-slate-100">Tambah Entitas Perusahaan Baru</h3>
            <form onSubmit={handleAddNewPt} className="space-y-3 text-xs">
              <input 
                type="text"
                placeholder="Contoh: PT INDO KAWAN LAMA"
                value={newPtInput}
                onChange={e => setNewPtInput(e.target.value)}
                className={`w-full p-3 border rounded-xl font-semibold ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                required
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddPtModal(false)} className="px-4 py-2 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 font-semibold rounded-xl cursor-pointer">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl cursor-pointer">Simpan Perusahaan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRINT PREVIEW */}
      {printModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900">Pratinjau Label Pengiriman</h3>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 font-semibold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Label
                </button>
                <button onClick={() => setPrintModal(false)} className="px-3.5 py-2 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 font-semibold rounded-xl text-xs cursor-pointer">
                  Tutup
                </button>
              </div>
            </div>

            <div className="p-6 bg-white text-black font-sans text-xs border-2 border-black rounded-lg">
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', textAlign: 'center' }}>
                <thead>
                  <tr>
                    <th colSpan="6" style={{ border: '1px solid black', padding: '10px', fontSize: '15px', fontWeight: 'bold', background: '#f2f2f2' }}>
                      {selectedPt}
                    </th>
                  </tr>
                  <tr>
                    <th colSpan="6" style={{ border: '1px solid black', padding: '8px', fontSize: '13px', fontWeight: 'bold', background: '#e6e6e6' }}>
                      {projectName}
                    </th>
                  </tr>
                  <tr>
                    <th colSpan="6" style={{ border: '1px solid black', padding: '10px', textAlign: 'left', fontSize: '14px' }}>
                      <b>STORE</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp; <b>{storeName}</b>
                    </th>
                  </tr>
                  <tr style={{ background: '#f9f9f9', fontWeight: 'bold' }}>
                    <th style={{ border: '1px solid black', padding: '8px', width: '8%' }}>NO</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '37%' }}>ITEM</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '30%' }}>MATERIAL</th>
                    <th style={{ border: '1px solid black', padding: '8px', width: '15%' }}>SIZE</th>
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