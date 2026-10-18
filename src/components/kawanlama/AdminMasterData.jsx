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

  // State untuk Fitur Atur Ulang PIN Cabang & Pencarian Cabang
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
    if (!form.item_name.trim()) return alert('Nama barang wajib diisi.');
    
    const { error } = await supabase.from('kl_master_items').insert([{
      item_name: form.item_name.trim(),
      material: form.material.trim() || '-',
      size: form.size.trim() || '-',
      price: Number(form.price) || 0
    }]);

    if (!error) {
      showNotification(`Item "${form.item_name}" berhasil ditambahkan ke dalam Data Master.`);
      setForm({ item_name: '', material: '', size: '', price: '' });
      fetchItems();
    } else {
      alert('Gagal menambahkan barang: ' + error.message);
    }
  };

  // 2. Impor Data Master melalui Berkas Excel
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
          alert('Berkas Excel kosong atau format kolom tidak sesuai.');
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
          alert('Gagal mengimpor data ke basis data: ' + error.message);
        } else {
          showNotification(`Berhasil mengimpor ${formattedItems.length} item barang baru ke Data Master.`);
          fetchItems();
        }
      } catch (err) {
        alert('Terjadi kesalahan saat membaca berkas Excel: ' + err.message);
      } finally {
        setLoadingImport(false);
        e.target.value = null;
      }
    };

    reader.readAsBinaryString(file);
  };

  // 3. Impor Anggaran Cabang (2 Kolom: branch_name & budget)
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
          alert('Berkas Excel kosong.');
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

        showNotification(`Berhasil memperbarui alokasi anggaran untuk ${successCount} cabang.`);
        fetchBranches();
      } catch (err) {
        alert("Terjadi kesalahan saat mengimpor anggaran: " + err.message);
      } finally {
        setLoadingImport(false);
        e.target.value = null;
      }
    };
    reader.readAsBinaryString(file);
  };

  // 4. Mulai Ubah Baris
  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      item_name: item.item_name || '',
      material: item.material || '',
      size: item.size || '',
      price: Number(item.price) || 0
    });
  };

  // 5. Batal Ubah
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ item_name: '', material: '', size: '', price: 0 });
  };

  // 6. Simpan Hasil Perubahan ke Supabase
  const handleSaveEdit = async (id) => {
    if (!editForm.item_name.trim()) return alert('Nama barang tidak boleh kosong.');

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
      showNotification(`Data barang "${editForm.item_name}" berhasil diperbarui.`);
    } else {
      alert('Gagal memperbarui data barang: ' + error.message);
    }
  };

  // 7. Hapus Barang Master
  const handleDeleteItem = async (id, itemName) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus item "${itemName}" dari Data Master?`)) {
      const { error } = await supabase
        .from('kl_master_items')
        .delete()
        .eq('id', id);

      if (!error) {
        setItems(prev => prev.filter(item => item.id !== id));
        showNotification(`Item "${itemName}" berhasil dihapus dari Data Master.`);
      } else {
        alert('Gagal menghapus barang: ' + error.message);
      }
    }
  };

  // 8. Handler Tambah Cabang Baru
  const handleAddBranchSubmit = async (e) => {
    e.preventDefault();
    if (!newBranchForm.branch_name.trim() || !newBranchForm.access_code.trim()) {
      return alert('Nama Cabang dan Kode Akses wajib diisi.');
    }

    const { error } = await supabase.from('kl_branches').insert([{
      branch_name: newBranchForm.branch_name.trim(),
      access_code: newBranchForm.access_code.trim().toUpperCase(),
      region: newBranchForm.region.trim() || 'PUSAT',
      pin_code: newBranchForm.pin_code.trim() || '123456'
    }]);

    if (!error) {
      showNotification(`Cabang "${newBranchForm.branch_name}" berhasil didaftarkan ke sistem.`);
      setNewBranchForm({ branch_name: '', access_code: '', region: '', pin_code: '123456' });
      fetchBranches();
    } else {
      alert('Gagal menambahkan cabang (Pastikan Kode Akses belum pernah digunakan): ' + error.message);
    }
  };

  // 9. Handler Atur Ulang PIN Cabang oleh Admin
  const handleOpenResetPinModal = (branch) => {
    setSelectedBranchForPin(branch);
    setIsPinModalOpen(true);
  };

  const handleAdminResetPinSubmit = async ({ newPin }) => {
    if (!selectedBranchForPin) return;

    const res = await updateBranchPin(selectedBranchForPin.id, newPin);
    if (res.success) {
      showNotification(`PIN untuk cabang "${selectedBranchForPin.branch_name}" berhasil diatur ulang.`);
      setIsPinModalOpen(false);
      setSelectedBranchForPin(null);
      fetchBranches();
    } else {
      alert(`Gagal mengatur ulang PIN: ${res.error}`);
    }
  };

  const handleAutoGenerateAndReset = async (branch) => {
    const randomPin = generateRandomPin();
    const confirmAction = window.confirm(`Buat PIN otomatis baru (${randomPin}) untuk cabang "${branch.branch_name}"?`);
    if (!confirmAction) return;

    const res = await updateBranchPin(branch.id, randomPin);
    if (res.success) {
      alert(`PIN berhasil diatur ulang.\n\nCabang: ${branch.branch_name}\nPIN Sementara Baru: ${randomPin}\n\nSilakan informasikan PIN ini kepada penanggung jawab cabang.`);
      fetchBranches();
    } else {
      alert(`Gagal mengatur ulang PIN: ${res.error}`);
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
      
      {/* Notifikasi Status */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="p-1 rounded-lg hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Panel Atas: Impor Excel & Formulir Tambah Manual */}
      <div className={`p-6 rounded-3xl border shadow-2xs space-y-6 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>
        
        {/* Bagian Impor Excel Master Barang */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200/80 dark:border-neutral-800">
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Impor Data Master Barang
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium mt-0.5">
              Unggah berkas <code className="font-mono font-bold text-slate-800 dark:text-neutral-200">.xlsx</code> atau <code className="font-mono font-bold text-slate-800 dark:text-neutral-200">.xls</code> dengan kolom: <code className="font-mono font-bold text-slate-700 dark:text-neutral-300">item_name, material, size, price</code>
            </p>
          </div>

          <label className={`cursor-pointer px-4 py-2.5 rounded-xl font-semibold text-xs transition-all active:scale-95 flex items-center gap-2 shadow-2xs ${
            loadingImport 
              ? 'bg-slate-100/80 text-slate-400 border border-slate-200/80 cursor-not-allowed' 
              : 'bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60'
          }`}>
            <Upload className="w-3.5 h-3.5" />
            <span>{loadingImport ? 'Mengimpor Data...' : 'Unggah Berkas Barang'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              disabled={loadingImport} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Bagian Impor Anggaran Cabang */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-200/80 dark:border-neutral-800">
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Impor Alokasi Anggaran Cabang
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium mt-0.5">
              Format berkas Excel wajib memuat kolom: <code className="font-mono font-bold text-slate-800 dark:text-neutral-200">branch_name</code> dan <code className="font-mono font-bold text-slate-800 dark:text-neutral-200">budget</code>
            </p>
          </div>

          <label className={`cursor-pointer px-4 py-2.5 rounded-xl font-semibold text-xs transition-all active:scale-95 flex items-center gap-2 shadow-2xs ${
            loadingImport 
              ? 'bg-slate-100/80 text-slate-400 border border-slate-200/80 cursor-not-allowed' 
              : 'bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60'
          }`}>
            <Upload className="w-3.5 h-3.5" />
            <span>{loadingImport ? 'Memproses...' : 'Unggah Berkas Anggaran'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleBudgetImport} 
              disabled={loadingImport} 
              className="hidden" 
            />
          </label>
        </div>

        {/* Formulir Tambah Barang Manual */}
        <div className="pt-1">
          <h3 className="font-bold text-sm mb-3 tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Tambah Item Master Baru
          </h3>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <input 
              type="text" 
              placeholder="Nama Barang *"
              value={form.item_name} 
              onChange={e => setForm({...form, item_name: e.target.value})} 
              className={`p-3 border rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
              required
            />
            <input 
              type="text" 
              placeholder="Material / Bahan"
              value={form.material} 
              onChange={e => setForm({...form, material: e.target.value})} 
              className={`p-3 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
            />
            <input 
              type="text" 
              placeholder="Ukuran (cth: 59x84 cm)"
              value={form.size} 
              onChange={e => setForm({...form, size: e.target.value})} 
              className={`p-3 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
            />
            <input 
              type="number" 
              min="0"
              placeholder="Harga Satuan (Rp)"
              value={form.price} 
              onChange={e => setForm({...form, price: e.target.value})} 
              className={`p-3 border rounded-xl font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
            />
            <button 
              type="submit" 
              className="bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold rounded-xl py-3 transition-all active:scale-95 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> Simpan Item
            </button>
          </form>
        </div>

      </div>

      {/* Tabel Data Master dengan Fitur Pencarian & Ubah Langsung */}
      <div className={`p-6 rounded-3xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Daftar Item Master ({filteredItems.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              Klik ikon <strong>Ubah</strong> untuk memperbarui rincian barang secara langsung pada tabel.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama barang, bahan, atau ukuran..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-2xs ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
            />
          </div>
        </div>

        {/* TABEL DATA MASTER BARANG */}
        <div className={`max-h-[520px] overflow-y-auto relative rounded-2xl border shadow-2xs custom-scrollbar ${isDarkMode ? 'border-neutral-800 bg-neutral-950' : 'border-slate-200/80 bg-white'}`}>
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-20 border-b font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-400' : 'bg-slate-50/95 border-slate-200/80 text-slate-500'}`}>
              <tr>
                <th className="p-3.5 text-left min-w-[200px]">NAMA BARANG</th>
                <th className="p-3.5 text-left min-w-[160px]">MATERIAL / BAHAN</th>
                <th className="p-3.5 text-left min-w-[130px]">UKURAN</th>
                <th className="p-3.5 text-right min-w-[140px]">HARGA SATUAN</th>
                <th className="p-3.5 text-center w-36">TINDAKAN</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-slate-100'}`}>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">Tidak ada item barang yang sesuai dengan pencarian Anda.</td>
                </tr>
              ) : (
                filteredItems.map(i => {
                  const isEditing = editingId === i.id;

                  return (
                    <tr key={i.id} className={`transition-colors ${
                      isEditing 
                        ? (isDarkMode ? 'bg-blue-950/20' : 'bg-blue-50/50') 
                        : (isDarkMode ? 'hover:bg-neutral-900/60' : 'hover:bg-slate-50/80')
                    }`}>
                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.item_name}
                            onChange={e => setEditForm({ ...editForm, item_name: e.target.value })}
                            className={`w-full p-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                            placeholder="Nama Barang"
                          />
                        ) : (
                          <div className="font-semibold text-slate-900 dark:text-white text-xs">{i.item_name}</div>
                        )}
                      </td>

                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.material}
                            onChange={e => setEditForm({ ...editForm, material: e.target.value })}
                            className={`w-full p-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                            placeholder="Material / Bahan"
                          />
                        ) : (
                          <span className="text-slate-600 dark:text-neutral-300 font-medium text-xs uppercase">{i.material || '-'}</span>
                        )}
                      </td>

                      <td className="p-3.5 align-middle">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.size}
                            onChange={e => setEditForm({ ...editForm, size: e.target.value })}
                            className={`w-full p-2 rounded-xl border text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                            placeholder="Ukuran"
                          />
                        ) : (
                          <span className="text-[11px] font-mono text-slate-500 dark:text-neutral-400 font-medium uppercase">{i.size || '-'}</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right align-middle font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editForm.price}
                            onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) || 0 })}
                            className={`w-28 p-2 rounded-xl border text-xs text-right font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                          />
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-white text-xs">
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
                              className="px-3 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 rounded-xl font-semibold text-[11px] shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" /> Simpan
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="px-2.5 py-1.5 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-xl font-semibold text-[11px] transition-all cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(i)}
                              className="w-8 h-8 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 flex items-center justify-center transition-all cursor-pointer"
                              title="Ubah Item"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(i.id, i.item_name)}
                              className="w-8 h-8 rounded-xl bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 flex items-center justify-center transition-all cursor-pointer"
                              title="Hapus Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* Formulir Tambah Cabang / Toko Baru */}
      <div className={`p-6 rounded-3xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>
        <div>
          <h3 className="font-bold text-sm tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Tambah Cabang / Toko Baru
          </h3>
          <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
            Daftarkan cabang baru ke dalam sistem untuk akses masuk dan pengajuan pesanan logistik.
          </p>
        </div>

        <form onSubmit={handleAddBranchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <input 
            type="text"
            placeholder="Nama Cabang / Toko *"
            value={newBranchForm.branch_name}
            onChange={e => setNewBranchForm({...newBranchForm, branch_name: e.target.value})}
            className={`p-3 border rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
            required
          />
          <input 
            type="text"
            placeholder="Kode Akses (cth: KL0104) *"
            value={newBranchForm.access_code}
            onChange={e => setNewBranchForm({...newBranchForm, access_code: e.target.value})}
            className={`p-3 border rounded-xl font-mono uppercase font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
            required
          />
          <input 
            type="text"
            placeholder="Wilayah (cth: JABODETABEK)"
            value={newBranchForm.region}
            onChange={e => setNewBranchForm({...newBranchForm, region: e.target.value})}
            className={`p-3 border rounded-xl uppercase font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
          />
          <button 
            type="submit"
            className="bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 font-semibold rounded-xl py-3 transition-all active:scale-95 shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Tambah Cabang
          </button>
        </form>
      </div>

      {/* Manajemen Atur Ulang PIN Cabang */}
      <div className={`p-6 rounded-3xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="font-bold text-sm tracking-wide uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Pengaturan Ulang PIN Cabang
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              Gunakan fitur ini apabila pihak cabang memerlukan pengaturan ulang kode PIN akses.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-72 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama cabang atau kode akses..."
              value={branchSearchTerm}
              onChange={e => setBranchSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-2xs ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-900'}`}
            />
          </div>
        </div>

        <div className={`max-h-[300px] overflow-y-auto relative rounded-2xl border shadow-2xs custom-scrollbar ${isDarkMode ? 'border-neutral-800 bg-neutral-950' : 'border-slate-200/80 bg-white'}`}>
          <table className="w-full text-xs border-collapse">
            <thead className={`sticky top-0 z-20 border-b font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-400' : 'bg-slate-50/95 border-slate-200/80 text-slate-500'}`}>
              <tr>
                <th className="p-3.5 text-left">ID & NAMA CABANG</th>
                <th className="p-3.5 text-left">KODE AKSES</th>
                <th className="p-3.5 text-left">WILAYAH</th>
                <th className="p-3.5 text-center">TINDAKAN PIN</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-slate-100'}`}>
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-400 font-medium">Tidak ada cabang yang sesuai dengan pencarian Anda.</td>
                </tr>
              ) : (
                filteredBranches.map(b => (
                  <tr key={b.id} className={`transition-colors ${isDarkMode ? 'hover:bg-neutral-900/60' : 'hover:bg-slate-50/80'}`}>
                    <td className="p-3.5 font-semibold text-slate-900 dark:text-white text-xs">{b.id} - {b.branch_name}</td>
                    <td className="p-3.5 font-mono text-slate-700 dark:text-neutral-300 font-medium text-xs">{b.access_code}</td>
                    <td className="p-3.5 text-[11px] font-mono text-slate-500 dark:text-neutral-400 font-medium uppercase">{b.region}</td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAutoGenerateAndReset(b)}
                          className="px-3 py-1.5 bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 rounded-xl font-semibold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Dices className="w-3.5 h-3.5" /> PIN Otomatis
                        </button>
                        <button
                          onClick={() => handleOpenResetPinModal(b)}
                          className="px-3 py-1.5 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 rounded-xl font-semibold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Atur Ulang PIN
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
        title={`Atur Ulang PIN: ${selectedBranchForPin?.branch_name || ''}`}
        subtitle="Masukkan 6 digit PIN baru untuk cabang ini."
        isDarkMode={isDarkMode}
        requireOldPin={false}
      />

    </div>
  );
}