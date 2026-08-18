import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import * as XLSX from 'xlsx';
import PinModal from './PinModal';
import { updateBranchPin, generateRandomPin } from './PinManager';

export default function AdminMasterData({ isDarkMode }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ item_name: '', material: '', size: '', price: '' });
  const [loadingImport, setLoadingImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // State untuk Inline Edit Barang
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    item_name: '',
    material: '',
    size: '',
    price: 0
  });

  // State untuk Fitur Reset PIN Cabang Darurat & Pencarian Cabang
  const [branches, setBranches] = useState([]);
  const [branchSearchTerm, setBranchSearchTerm] = useState(''); 
  const [selectedBranchForPin, setSelectedBranchForPin] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // State untuk Tambah Cabang Baru
  const [newBranchForm, setNewBranchForm] = useState({
    branch_name: '',
    access_code: '',
    region: '',
    pin_code: '123456' // Default PIN awal
  });

  useEffect(() => {
    fetchItems();
    fetchBranches();
  }, []);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('kl_master_items')
      .select('*')
      .order('item_name', { ascending: true });
    if (data) setItems(data);
  };

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('kl_branches')
      .select('*')
      .order('id', { ascending: true });
    if (data) setBranches(data);
  };

  const showNotification = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  // 1. Tambah Barang Manual
  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) return alert('Nama barang wajib diisi!');
    
    const { error } = await supabase.from('kl_master_items').insert([{
      item_name: form.item_name.trim(),
      material: form.material.trim() || '-',
      size: form.size.trim() || '-',
      price: Number(form.price) || 0
    }]);

    if (!error) {
      showNotification(`✅ Barang "${form.item_name}" berhasil ditambahkan!`);
      setForm({ item_name: '', material: '', size: '', price: '' });
      fetchItems();
    } else {
      alert('Gagal menambah barang: ' + error.message);
    }
  };

  // 2. Import Master Data via File Excel
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingImport(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const wsname = workbook.SheetNames[0];
        const ws = workbook.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert('File Excel kosong atau format tidak sesuai!');
          setLoadingImport(false);
          return;
        }

        const formattedItems = data.map(row => ({
          item_name: String(row.item_name || row.nama_barang || row['Nama Barang'] || 'Barang Baru').trim(),
          material: String(row.material || row['Material'] || '-').trim(),
          size: String(row.size || row.ukuran || row['Ukuran'] || '-').trim(),
          price: Number(row.price || row.harga || row['Harga'] || 0)
        }));

        const { error } = await supabase.from('kl_master_items').insert(formattedItems);

        if (error) {
          alert('Gagal mengimpor data ke database: ' + error.message);
        } else {
          showNotification(`✅ Berhasil mengimpor ${formattedItems.length} data barang baru!`);
          fetchItems();
        }
      } catch (err) {
        alert('Terjadi kesalahan saat membaca file Excel: ' + err.message);
      } finally {
        setLoadingImport(false);
        e.target.value = null;
      }
    };

    reader.readAsBinaryString(file);
  };

  // 3. Mulai Edit Baris
  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      item_name: item.item_name || '',
      material: item.material || '',
      size: item.size || '',
      price: Number(item.price) || 0
    });
  };

  // 4. Batal Edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ item_name: '', material: '', size: '', price: 0 });
  };

  // 5. Simpan Hasil Edit ke Supabase
  const handleSaveEdit = async (id) => {
    if (!editForm.item_name.trim()) return alert('Nama barang tidak boleh kosong!');

    const { error } = await supabase
      .from('kl_master_items')
      .update({
        item_name: editForm.item_name.trim(),
        material: editForm.material.trim(),
        size: editForm.size.trim(),
        price: Number(editForm.price) || 0
      })
      .eq('id', id);

    if (!error) {
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...editForm } : item));
      setEditingId(null);
      showNotification(`💾 Data barang "${editForm.item_name}" berhasil diperbarui!`);
    } else {
      alert('Gagal memperbarui barang: ' + error.message);
    }
  };

  // 6. Hapus Barang Master
  const handleDeleteItem = async (id, itemName) => {
    if (window.confirm(`⚠️ Yakin ingin menghapus barang "${itemName}" dari Master Data?`)) {
      const { error } = await supabase
        .from('kl_master_items')
        .delete()
        .eq('id', id);

      if (!error) {
        setItems(prev => prev.filter(item => item.id !== id));
        showNotification(`🗑️ Barang "${itemName}" berhasil dihapus.`);
      } else {
        alert('Gagal menghapus barang: ' + error.message);
      }
    }
  };

  // 7. Handler Tambah Cabang Baru
  const handleAddBranchSubmit = async (e) => {
    e.preventDefault();
    if (!newBranchForm.branch_name.trim() || !newBranchForm.access_code.trim()) {
      return alert('Nama Cabang dan Kode Akses wajib diisi!');
    }

    const { error } = await supabase.from('kl_branches').insert([{
      branch_name: newBranchForm.branch_name.trim(),
      access_code: newBranchForm.access_code.trim().toUpperCase(),
      region: newBranchForm.region.trim() || 'PUSAT',
      pin_code: newBranchForm.pin_code.trim() || '123456'
    }]);

    if (!error) {
      showNotification(`✅ Cabang "${newBranchForm.branch_name}" berhasil ditambahkan!`);
      setNewBranchForm({ branch_name: '', access_code: '', region: '', pin_code: '123456' });
      fetchBranches();
    } else {
      alert('Gagal menambah cabang (Pastikan Kode Akses belum pernah digunakan): ' + error.message);
    }
  };

  // 8. Handler Reset PIN Cabang Darurat oleh Admin
  const handleOpenResetPinModal = (branch) => {
    setSelectedBranchForPin(branch);
    setIsPinModalOpen(true);
  };

  const handleAdminResetPinSubmit = async ({ newPin }) => {
    if (!selectedBranchForPin) return;

    const res = await updateBranchPin(selectedBranchForPin.id, newPin);
    if (res.success) {
      showNotification(`🔑 PIN untuk toko "${selectedBranchForPin.branch_name}" berhasil direset.`);
      setIsPinModalOpen(false);
      setSelectedBranchForPin(null);
      fetchBranches();
    } else {
      alert(`Gagal mereset PIN: ${res.error}`);
    }
  };

  const handleAutoGenerateAndReset = async (branch) => {
    const randomPin = generateRandomPin();
    const confirmAction = window.confirm(`Generate PIN otomatis baru (${randomPin}) untuk toko "${branch.branch_name}"?`);
    if (!confirmAction) return;

    const res = await updateBranchPin(branch.id, randomPin);
    if (res.success) {
      alert(`PIN Berhasil direset!\n\nToko: ${branch.branch_name}\nPIN Sementara Baru: ${randomPin}\n\nSilakan berikan PIN ini kepada PIC toko.`);
      fetchBranches();
    } else {
      alert(`Gagal mereset PIN: ${res.error}`);
    }
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  const filteredItems = items.filter(item => {
    const q = searchTerm.toLowerCase();
    return (
      (item.item_name || '').toLowerCase().includes(q) ||
      (item.material || '').toLowerCase().includes(q) ||
      (item.size || '').toLowerCase().includes(q)
    );
  });

  const filteredBranches = branches.filter(b => {
    const q = branchSearchTerm.toLowerCase();
    return (
      String(b.id).toLowerCase().includes(q) ||
      (b.branch_name || '').toLowerCase().includes(q) ||
      (b.access_code || '').toLowerCase().includes(q) ||
      (b.region || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Notifikasi Pop-up */}
      {successMessage && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg animate-bounce ${
          isDarkMode ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200' : 'bg-emerald-50 border-emerald-300 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-xs font-bold opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Panel Atas: Import Excel & Form Tambah Manual */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        
        {/* Bagian Import Excel */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-stone-200 dark:border-neutral-700">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">📊 Import Master Barang via Excel</h3>
            <p className="text-xs opacity-70 mt-0.5">Unggah file `.xlsx` atau `.xls` dengan kolom: <code className="font-mono text-indigo-500">item_name, material, size, price</code></p>
          </div>

          <label className={`cursor-pointer px-5 py-3 rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-2 ${loadingImport ? 'bg-stone-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
            <span>{loadingImport ? '⏳ Mengimpor...' : '📁 Pilih & Import File Excel'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              disabled={loadingImport} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Form Tambah Master Manual */}
        <div>
          <h3 className="font-extrabold text-sm mb-3 tracking-wide uppercase text-indigo-600 dark:text-indigo-400">➕ Tambah Master Barang Baru (Manual)</h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <input 
              type="text" 
              placeholder="Nama Barang *" 
              value={form.item_name} 
              onChange={e => setForm({...form, item_name: e.target.value})} 
              className={`p-3 border rounded-xl font-semibold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
              required
            />
            <input 
              type="text" 
              placeholder="Material / Bahan" 
              value={form.material} 
              onChange={e => setForm({...form, material: e.target.value})} 
              className={`p-3 border rounded-xl focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
            />
            <input 
              type="text" 
              placeholder="Ukuran (Cth: 59x84 cm)" 
              value={form.size} 
              onChange={e => setForm({...form, size: e.target.value})} 
              className={`p-3 border rounded-xl focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
            />
            <input 
              type="number" 
              min="0"
              placeholder="Harga Satuan (Rp)" 
              value={form.price} 
              onChange={e => setForm({...form, price: e.target.value})} 
              className={`p-3 border rounded-xl focus:outline-none font-mono ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`} 
            />
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl py-3 transition-all active:scale-95 shadow-sm">
              Simpan Barang
            </button>
          </form>
        </div>

      </div>

      {/* Tabel Master Data dengan Fitur Pencarian & Inline Edit */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
              Daftar Master Data Barang (Urut A-Z)
            </h3>
            <p className="text-xs opacity-60">Klik tombol <strong>Edit</strong> untuk langsung mengubah data barang di tabel.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-72">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Cari Barang / Bahan / Ukuran..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full p-2 border rounded-xl text-xs font-semibold focus:outline-none ${
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-800'
              }`}
            />
          </div>
        </div>

        <div className="max-h-[520px] overflow-y-auto relative rounded-2xl border border-stone-200 dark:border-neutral-700">
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
              <tr>
                <th className="p-3.5 text-left min-w-[200px]">Nama Barang</th>
                <th className="p-3.5 text-left min-w-[160px]">Material / Bahan</th>
                <th className="p-3.5 text-left min-w-[130px]">Ukuran (Size)</th>
                <th className="p-3.5 text-right min-w-[140px]">Harga Satuan</th>
                <th className="p-3.5 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center opacity-60">Tidak ada barang yang cocok dengan pencarian.</td>
                </tr>
              ) : (
                filteredItems.map(i => {
                  const isEditing = editingId === i.id;

                  return (
                    <tr key={i.id} className={`transition-colors ${
                      isEditing 
                        ? (isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70') 
                        : (isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50')
                    }`}>
                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.item_name}
                            onChange={e => setEditForm({ ...editForm, item_name: e.target.value })}
                            className={`w-full p-2 rounded-xl border text-xs font-bold focus:outline-none ${
                              isDarkMode ? 'bg-neutral-900 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'
                            }`}
                            placeholder="Nama Barang"
                          />
                        ) : (
                          <div className="font-bold">{i.item_name}</div>
                        )}
                      </td>

                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.material}
                            onChange={e => setEditForm({ ...editForm, material: e.target.value })}
                            className={`w-full p-2 rounded-xl border text-xs font-semibold focus:outline-none ${
                              isDarkMode ? 'bg-neutral-900 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'
                            }`}
                            placeholder="Material"
                          />
                        ) : (
                          <span className="opacity-80 uppercase font-medium">{i.material || '-'}</span>
                        )}
                      </td>

                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.size}
                            onChange={e => setEditForm({ ...editForm, size: e.target.value })}
                            className={`w-full p-2 rounded-xl border text-xs font-mono font-semibold focus:outline-none ${
                              isDarkMode ? 'bg-neutral-900 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'
                            }`}
                            placeholder="Ukuran"
                          />
                        ) : (
                          <span className="opacity-80 uppercase font-mono">{i.size || '-'}</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right align-middle font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editForm.price}
                            onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) || 0 })}
                            className={`w-28 p-2 rounded-xl border text-xs text-right font-mono font-bold focus:outline-none ${
                              isDarkMode ? 'bg-neutral-900 border-neutral-600 text-emerald-400' : 'bg-white border-stone-300 text-emerald-600'
                            }`}
                          />
                        ) : (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRupiah(i.price)}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center align-middle">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(i.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] shadow-sm transition-all active:scale-95"
                            >
                              💾 Simpan
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2.5 py-1.5 bg-stone-300 hover:bg-stone-400 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-stone-800 dark:text-white rounded-xl font-bold text-[11px] transition-all"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(i)}
                              className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-[11px] transition-all active:scale-95 flex items-center gap-1"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(i.id, i.item_name)}
                              className="p-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 rounded-xl transition-all"
                              title="Hapus barang ini"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bagian Baru: Form Tambah Cabang / Toko Baru */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div>
          <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
            🏢 Tambah Cabang / Toko Baru
          </h3>
          <p className="text-xs opacity-60">Daftarkan cabang baru ke sistem agar bisa langsung melakukan login dan pemesanan logistik.</p>
        </div>

        <form onSubmit={handleAddBranchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <input 
            type="text"
            placeholder="Nama Cabang / Toko *"
            value={newBranchForm.branch_name}
            onChange={e => setNewBranchForm({...newBranchForm, branch_name: e.target.value})}
            className={`p-3 border rounded-xl font-semibold focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
            required
          />
          <input 
            type="text"
            placeholder="Kode Akses (Cth: KL0104) *"
            value={newBranchForm.access_code}
            onChange={e => setNewBranchForm({...newBranchForm, access_code: e.target.value})}
            className={`p-3 border rounded-xl font-mono uppercase focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
            required
          />
          <input 
            type="text"
            placeholder="Region (Cth: JABODETABEK)"
            value={newBranchForm.region}
            onChange={e => setNewBranchForm({...newBranchForm, region: e.target.value})}
            className={`p-3 border rounded-xl uppercase focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
          />
          <button 
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-3 transition-all active:scale-95 shadow-sm"
          >
            ➕ Tambahkan Cabang
          </button>
        </form>
      </div>

      {/* Manajemen Reset PIN Cabang Darurat + Search Bar */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
              🔐 Manajemen Reset PIN Cabang (Darurat)
            </h3>
            <p className="text-xs opacity-60">Gunakan fitur ini jika ada cabang yang lupa PIN akses login mereka.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-72">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Cari nama cabang / kode akses..."
              value={branchSearchTerm}
              onChange={e => setBranchSearchTerm(e.target.value)}
              className={`w-full p-2 border rounded-xl text-xs font-semibold focus:outline-none ${
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-200 text-stone-800'
              }`}
            />
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto relative rounded-2xl border border-stone-200 dark:border-neutral-700">
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
              <tr>
                <th className="p-3 text-left">ID & Nama Cabang</th>
                <th className="p-3 text-left">Kode Akses</th>
                <th className="p-3 text-left">Region</th>
                <th className="p-3 text-center">Aksi Reset PIN</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-6 text-center opacity-60">Tidak ada cabang yang cocok dengan pencarian.</td>
                </tr>
              ) : (
                filteredBranches.map(b => (
                  <tr key={b.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                    <td className="p-3 font-bold">{b.id} - {b.branch_name}</td>
                    <td className="p-3 font-mono opacity-80">{b.access_code}</td>
                    <td className="p-3 uppercase font-semibold">{b.region}</td>
                    <td className="p-3 text-center space-x-2">
                      <button
                        onClick={() => handleAutoGenerateAndReset(b)}
                        className="px-3 py-1.5 bg-stone-700 hover:bg-stone-800 text-white rounded-xl font-bold text-[11px] shadow-sm"
                      >
                        🎲 Auto-Generate PIN
                      </button>
                      <button
                        onClick={() => handleOpenResetPinModal(b)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[11px] shadow-sm"
                      >
                        ✏️ Set PIN Manual
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input PIN Baru */}
      <PinModal 
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setSelectedBranchForPin(null);
        }}
        onSubmit={handleAdminResetPinSubmit}
        title={`Reset PIN untuk: ${selectedBranchForPin?.branch_name || ''}`}
        subtitle="Masukkan PIN baru 6 digit untuk cabang ini."
        isDarkMode={isDarkMode}
        requireOldPin={false}
      />

    </div>
  );
}