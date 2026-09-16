import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import * as XLSX from 'xlsx';
import PinModal from './PinModal';
import { updateBranchPin, generateRandomPin } from './PinManager';
import {
  FileSpreadsheet,
  Upload,
  PlusCircle,
  Search,
  Pencil,
  Save,
  Trash2,
  Check,
  Building2,
  Key,
  Dices,
  RefreshCw,
  X
} from 'lucide-react';

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

  // 3. Import Budget Cabang (2 Kolom: branch_name & budget)
  const handleBudgetImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingImport(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

        if (data.length === 0) {
          alert('File Excel kosong!');
          setLoadingImport(false);
          return;
        }

        let successCount = 0;

        for (const row of data) {
          const branchName = String(row.branch_name || row['Branch Name'] || row['Nama Cabang'] || '').trim();
          const budgetVal = Number(row.budget || row['Budget'] || row['Alokasi Budget'] || 0);

          if (branchName) {
            const { data: branch } = await supabase
              .from('kl_branches')
              .select('id')
              .ilike('branch_name', branchName)
              .maybeSingle();

            if (branch) {
              await supabase
                .from('kl_branches')
                .update({
                  custom_budget: budgetVal,
                  budget_type: 'CUSTOM BUDGET'
                })
                .eq('id', branch.id);

              successCount++;
            }
          }
        }

        showNotification(`✅ Berhasil memperbarui budget untuk ${successCount} cabang!`);
        fetchBranches();
      } catch (err) {
        alert("Terjadi kesalahan saat import budget: " + err.message);
      } finally {
        setLoadingImport(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  // 4. Mulai Edit Baris
  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      item_name: item.item_name || '',
      material: item.material || '',
      size: item.size || '',
      price: Number(item.price) || 0
    });
  };

  // 5. Batal Edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ item_name: '', material: '', size: '', price: 0 });
  };

  // 6. Simpan Hasil Edit ke Supabase
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

  // 7. Hapus Barang Master
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

  // 8. Handler Tambah Cabang Baru
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

  // 9. Handler Reset PIN Cabang Darurat oleh Admin
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
      
      {/* Pop-up Notification */}
      {successMessage && (
        <div className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-emerald-800 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-xs font-bold opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

      {/* Panel Atas: Import Excel & Form Tambah Manual */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white text-black shadow-2xs space-y-6">
        
        {/* Bagian Import Excel Master Barang */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Import Master Items via Excel
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Upload <code className="font-mono text-indigo-600 font-bold">.xlsx</code> or <code className="font-mono text-indigo-600 font-bold">.xls</code> file with columns: <code className="font-mono text-slate-700 font-bold">item_name, material, size, price</code></p>
          </div>

          <label className={`cursor-pointer px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all active:scale-95 flex items-center gap-2 shadow-2xs ${loadingImport ? 'bg-slate-300 cursor-not-allowed text-slate-600' : 'bg-white hover:bg-slate-50 text-black border border-slate-300'}`}>
            <Upload className="w-3.5 h-3.5 text-slate-700" />
            <span>{loadingImport ? 'Importing...' : 'Import Master Items'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              disabled={loadingImport} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Bagian Import Budget Cabang (2 Kolom) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-amber-600 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-600" /> Import Store Budgets (2 Columns)
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Excel format must contain columns: <code className="font-mono text-amber-700 font-bold">branch_name</code> and <code className="font-mono text-amber-700 font-bold">budget</code></p>
          </div>

          <label className={`cursor-pointer px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all active:scale-95 flex items-center gap-2 shadow-2xs ${loadingImport ? 'bg-slate-300 cursor-not-allowed text-slate-600' : 'bg-white hover:bg-slate-50 text-black border border-slate-300'}`}>
            <Upload className="w-3.5 h-3.5 text-slate-700" />
            <span>{loadingImport ? 'Processing...' : 'Import Budget File'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleBudgetImport} 
              disabled={loadingImport} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Form Tambah Master Manual */}
        <div className="pt-2">
          <h3 className="font-extrabold text-sm mb-3 tracking-wide uppercase text-indigo-600 flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-indigo-600" /> Add New Master Item (Manual)
          </h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <input 
              type="text" 
              placeholder="Item Name *"
              value={form.item_name} 
              onChange={e => setForm({...form, item_name: e.target.value})} 
              className="p-3 border border-slate-300 rounded-xl font-extrabold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              required
            />
            <input 
              type="text" 
              placeholder="Material"
              value={form.material} 
              onChange={e => setForm({...form, material: e.target.value})} 
              className="p-3 border border-slate-300 rounded-xl font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <input 
              type="text" 
              placeholder="Size (e.g. 59x84 cm)"
              value={form.size} 
              onChange={e => setForm({...form, size: e.target.value})} 
              className="p-3 border border-slate-300 rounded-xl font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <input 
              type="number" 
              min="0"
              placeholder="Unit Price (Rp)"
              value={form.price} 
              onChange={e => setForm({...form, price: e.target.value})} 
              className="p-3 border border-slate-300 rounded-xl font-mono font-extrabold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl py-3 transition-all active:scale-95 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5">
              <PlusCircle className="w-4 h-4" /> Save Item
            </button>
          </form>
        </div>

      </div>

      {/* Tabel Master Data dengan Fitur Pencarian & Inline Edit */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white text-black shadow-2xs space-y-4">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" /> Master Items List (A-Z)
            </h3>
            <p className="text-xs text-slate-500 font-medium">Click <strong>"Edit"</strong> to modify item details directly in the table.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Item / Material / Size..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-2xs"
            />
          </div>
        </div>

        {/* ENTERPRISE DATA GRID TABLE FOR MASTER ITEMS */}
        <div className="max-h-[520px] overflow-y-auto relative rounded-2xl border border-slate-200/80 shadow-2xs bg-white custom-scrollbar">
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="sticky top-0 z-20 bg-[#F8FAFC] border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 text-left min-w-[200px]">ITEM NAME</th>
                <th className="p-3.5 text-left min-w-[160px]">MATERIAL</th>
                <th className="p-3.5 text-left min-w-[130px]">SIZE</th>
                <th className="p-3.5 text-right min-w-[140px]">UNIT PRICE</th>
                <th className="p-3.5 text-center w-36">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">No items match your search query.</td>
                </tr>
              ) : (
                filteredItems.map(i => {
                  const isEditing = editingId === i.id;

                  return (
                    <tr key={i.id} className={`transition-colors ${
                      isEditing ? 'bg-indigo-50/70' : 'hover:bg-slate-50/80 bg-white'
                    }`}>
                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.item_name}
                            onChange={e => setEditForm({ ...editForm, item_name: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="Item Name"
                          />
                        ) : (
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">{i.item_name}</div>
                        )}
                      </td>

                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.material}
                            onChange={e => setEditForm({ ...editForm, material: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="Material"
                          />
                        ) : (
                          <span className="text-slate-700 font-medium text-xs uppercase">{i.material || '-'}</span>
                        )}
                      </td>

                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.size}
                            onChange={e => setEditForm({ ...editForm, size: e.target.value })}
                            className="w-full p-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            placeholder="Size"
                          />
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400 font-medium uppercase">{i.size || '-'}</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right align-middle font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editForm.price}
                            onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) || 0 })}
                            className="w-28 p-2 rounded-xl border border-slate-300 text-xs text-right font-mono font-bold bg-white text-emerald-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                          />
                        ) : (
                          <span className="font-extrabold text-emerald-700 text-xs sm:text-sm">
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
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-[11px] transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(i)}
                              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-xl font-extrabold text-[11px] transition-all active:scale-95 flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-indigo-600" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(i.id, i.item_name)}
                              className="w-8 h-8 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold flex items-center justify-center transition-all cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
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
      <div className="p-6 rounded-3xl border border-slate-200 bg-white text-black shadow-2xs space-y-4">
        <div>
          <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600" /> Add New Store / Branch
          </h3>
          <p className="text-xs text-slate-500 font-medium">Register a new store to the system for immediate login and logistics ordering.</p>
        </div>

        <form onSubmit={handleAddBranchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <input 
            type="text"
            placeholder="Store / Branch Name *"
            value={newBranchForm.branch_name}
            onChange={e => setNewBranchForm({...newBranchForm, branch_name: e.target.value})}
            className="p-3 border border-slate-300 rounded-xl font-extrabold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            required
          />
          <input 
            type="text"
            placeholder="Access Code (e.g. KL0104) *"
            value={newBranchForm.access_code}
            onChange={e => setNewBranchForm({...newBranchForm, access_code: e.target.value})}
            className="p-3 border border-slate-300 rounded-xl font-mono uppercase font-bold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            required
          />
          <input 
            type="text"
            placeholder="Region (e.g. JABODETABEK)"
            value={newBranchForm.region}
            onChange={e => setNewBranchForm({...newBranchForm, region: e.target.value})}
            className="p-3 border border-slate-300 rounded-xl uppercase font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <button 
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl py-3 transition-all active:scale-95 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Add Store
          </button>
        </form>
      </div>

      {/* Manajemen Reset PIN Cabang Darurat + Search Bar */}
      <div className="p-6 rounded-3xl border border-slate-200 bg-white text-black shadow-2xs space-y-4">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase text-indigo-600 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-600" /> Emergency Store PIN Reset
            </h3>
            <p className="text-xs text-slate-500 font-medium">Use this feature if a store forgets their PIN access.</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search store / access code..."
              value={branchSearchTerm}
              onChange={e => setBranchSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-2xs"
            />
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto relative rounded-2xl border border-slate-200/80 shadow-2xs bg-white custom-scrollbar">
          <table className="w-full text-xs border-collapse bg-white">
            <thead className="sticky top-0 z-20 bg-[#F8FAFC] border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 text-left">STORE ID & NAME</th>
                <th className="p-3.5 text-left">ACCESS CODE</th>
                <th className="p-3.5 text-left">REGION</th>
                <th className="p-3.5 text-center">PIN ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-400 font-medium">No stores match your search query.</td>
                </tr>
              ) : (
                filteredBranches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors bg-white">
                    <td className="p-3.5 font-bold text-slate-900 text-xs sm:text-sm">{b.id} - {b.branch_name}</td>
                    <td className="p-3.5 font-mono text-slate-600 font-bold text-xs">{b.access_code}</td>
                    <td className="p-3.5 text-[10px] font-mono text-slate-400 font-medium uppercase">{b.region}</td>

                    {/* GAMBAR 2 FIX: SLEEK CONCISE PIN BUTTONS */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAutoGenerateAndReset(b)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 rounded-lg font-extrabold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 inline-flex"
                        >
                          <Dices className="w-3.5 h-3.5 text-slate-700" /> Auto PIN
                        </button>
                        <button
                          onClick={() => handleOpenResetPinModal(b)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-extrabold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 inline-flex"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Manual PIN
                        </button>
                      </div>
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