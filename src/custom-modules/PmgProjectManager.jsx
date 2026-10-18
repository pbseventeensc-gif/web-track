import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { Printer, Trash2, Upload, ChevronDown, Plus, FileText, CheckSquare } from 'lucide-react';
import CustomDropdown from '../components/ui/CustomDropdown';

export default function PmgProjectManager({ isDarkMode }) {
  const [projects, setProjects] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [printData, setPrintData] = useState(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);

  // LOCK PMG LOGO IN LOCALSTORAGE
  const [pmgLogo, setPmgLogo] = useState(() => {
    return localStorage.getItem('pmg_header_logo_locked') || '';
  });
  const [selectedDest, setSelectedDest] = useState('');

  useEffect(() => {
    if (pmgLogo) {
      localStorage.setItem('pmg_header_logo_locked', pmgLogo);
    }
  }, [pmgLogo]);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const logoBase64 = reader.result;
        setPmgLogo(logoBase64);
        localStorage.setItem('pmg_header_logo_locked', logoBase64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetLogo = () => {
    if (window.confirm('Buka kunci dan atur ulang Logo Kop PMG?')) {
      setPmgLogo('');
      localStorage.removeItem('pmg_header_logo_locked');
    }
  };

  const [form, setForm] = useState({
    dr_number: '',
    transaction_code: '',
    project_name: '',
    delivery_date: new Date().toISOString().split('T')[0],
    
    deliver_to: '',
    address: '',
    pic_up: '',
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

  const handleDestChange = (e) => {
    const destId = e.target.value;
    setSelectedDest(destId);
    const found = destinations.find(d => String(d.id) === String(destId));
    if (found) {
      setForm(prev => ({
        ...prev,
        deliver_to: found.client_name || '',
        address: found.address || '',
        pic_up: found.pic_name || found.client_name || '',
        phone_no: found.phone || ''
      }));
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

  const handleRemoveSelectedItems = () => {
    if (selectedItemIndexes.length === 0) return alert('Pilih minimal satu baris barang untuk dihapus.');
    if (!window.confirm(`Hapus ${selectedItemIndexes.length} baris barang terpilih?`)) return;
    
    const remainingItems = items.filter((_, idx) => !selectedItemIndexes.includes(idx));
    setItems(remainingItems.length > 0 ? remainingItems : [{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
    setSelectedItemIndexes([]);
  };

  const handleClearAllItems = () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus seluruh baris barang?')) return;
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

          if (itemNameText && !itemNameText.toLowerCase().includes('name') && !itemNameText.toLowerCase().includes('nama')) {
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
          alert(`Berhasil mengimpor ${importedItems.length} baris barang.`);
        } else {
          alert('Format baris tidak dikenali atau berkas kosong.');
        }
      } catch (err) {
        alert('Gagal membaca berkas: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const saveDestinationToDatabase = async () => {
    if (!form.deliver_to.trim()) return null;

    const existing = destinations.find(d => d.client_name.toLowerCase() === form.deliver_to.trim().toLowerCase());
    if (existing) {
      return existing.id;
    } else {
      const newEntry = {
        client_name: form.deliver_to.trim(),
        address: form.address.trim(),
        pic_name: form.pic_up.trim(),
        phone: form.phone_no.trim(),
        hos_region: '-'
      };

      const { data, error } = await supabase.from('pmg_destinations').insert([newEntry]).select();
      if (!error && data) {
        setDestinations(prev => [...prev, data[0]]);
        return data[0].id;
      }
    }
    return null;
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    if (!form.transaction_code || !form.project_name) return alert('Kode Transaksi dan Nama Proyek wajib diisi.');

    const { data: existing, error: checkError } = await supabase
      .from('pmg_projects')
      .select('id')
      .eq('transaction_code', form.transaction_code);

    if (checkError) return alert('Gagal memeriksa duplikasi data: ' + checkError.message);
    if (existing && existing.length > 0) {
      return alert('DITOLAK: Surat Jalan dengan Kode Transaksi "' + form.transaction_code + '" sudah terdaftar.');
    }

    const savedDestId = await saveDestinationToDatabase();

    const { data: projData, error: projError } = await supabase
      .from('pmg_projects')
      .insert([form])
      .select();

    if (projError) return alert('Gagal menyimpan dokumen proyek: ' + projError.message);

    const projectId = projData[0].id;

    const itemsToInsert = items.map(item => ({
      project_id: projectId,
      destination_id: item.destination_id ? Number(item.destination_id) : (savedDestId || null),
      item_name: item.item_name,
      dimensions: item.dimensions,
      qty: Number(item.qty),
      unit: item.unit
    }));

    const { error: itemError } = await supabase.from('pmg_project_items').insert(itemsToInsert);
    if (itemError) {
      alert('Gagal menyimpan rincian barang: ' + itemError.message);
    } else {
      alert('Dokumen Surat Jalan & Alokasi PMG berhasil disimpan ke basis data.');
      setForm({ dr_number: '', transaction_code: '', project_name: '', delivery_date: new Date().toISOString().split('T')[0], deliver_to: '', address: '', pic_up: '', phone_no: '', vehicle_no: '', sender_name: 'NINING' });
      setSelectedDest('');
      setItems([{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
      setSelectedItemIndexes([]);
      fetchProjects();
    }
  };

  const handleDeleteSingle = async (id, name) => {
    if (!window.confirm(`Hapus dokumen Surat Jalan "${name}"?`)) return;
    await supabase.from('pmg_project_items').delete().eq('project_id', id);
    const { error } = await supabase.from('pmg_projects').delete().eq('id', id);
    if (!error) fetchProjects();
  };

  const handleBulkDelete = async () => {
    if (selectedProjectIds.length === 0) return alert('Pilih minimal satu dokumen untuk dihapus.');
    if (!window.confirm(`Hapus ${selectedProjectIds.length} dokumen Surat Jalan terpilih?`)) return;
    for (const id of selectedProjectIds) {
      await supabase.from('pmg_project_items').delete().eq('project_id', id);
      await supabase.from('pmg_projects').delete().eq('id', id);
    }
    setSelectedProjectIds([]);
    fetchProjects();
  };

  const renderEmptyRows = (currentCount) => {
    const targetRows = Math.max(0, 3 - currentCount); 
    const rows = [];
    for (let i = 0; i < targetRows; i++) {
      rows.push(
        <tr key={`empty-${i}`}>
          <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>&nbsp;</td>
          <td style={{ border: '1px solid #000', padding: '2px' }}></td>
          <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}></td>
          <td style={{ border: '1px solid #000', padding: '2px' }}></td>
        </tr>
      );
    }
    return rows;
  };

  const calculateGrandTotal = (itemsList) => {
    if (!itemsList || itemsList.length === 0) return 0;
    return itemsList.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  };

  const handlePrintDocument = () => {
    const printContent = document.getElementById('printable-pod-sj').innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak POD & Surat Jalan - PMG (1 Halaman A4)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 6mm;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0; 
              background: #fff; 
              color: #000; 
              -webkit-print-color-adjust: exact;
            }
            .print-page-a4 {
              width: 198mm;
              height: 285mm;
              max-height: 285mm;
              margin: 0 auto;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
            }
            .section-box {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              max-height: 138mm;
              overflow: hidden;
            }
            .section-box-do {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              max-height: 138mm;
              overflow: hidden;
            }
            .divider-cut {
              border-bottom: 2px dashed #000;
              margin: 4px 0;
              text-align: center;
              position: relative;
            }
            .divider-cut span {
              background: #fff;
              padding: 0 8px;
              font-size: 8px;
              font-weight: bold;
              position: relative;
              top: -6px;
            }
            table { width: 100%; border-collapse: collapse; font-size: 8px; }
            th, td { border: 1px solid #000; padding: 2px 3px; }
          </style>
        </head>
        <body>
          <div class="print-page-a4">
            ${printContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className={`p-4 rounded-2xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-800'}`}>
      <div>
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-0.5 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Penerbitan Surat Jalan & POD PMG
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Buat dokumen pengiriman dalam format resmi Proof of Delivery (POD) dan Surat Jalan PT. PMG Integrasi Komunikasi.
        </p>
      </div>

      {/* PMG LOGO UPLOAD CARD WITH LOCALSTORAGE LOCK */}
      <div className={`p-3 border rounded-xl text-xs shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5 ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/80 text-slate-800'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-16 h-10 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex items-center justify-center p-1 overflow-hidden">
            {pmgLogo ? <img src={pmgLogo} alt="Logo PMG" className="max-w-full max-h-full object-contain" /> : <span className="text-[9px] text-slate-400 font-semibold">Tanpa Logo</span>}
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
              Logo Kop Dokumen PMG
            </h4>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {pmgLogo ? 'Logo PMG terkunci dan tersimpan di memori perangkat' : 'Unggah logo PMG satu kali untuk digunakan pada seluruh dokumen'}
            </p>
          </div>
        </div>
        <div>
          {pmgLogo ? (
            <button
              type="button"
              onClick={handleResetLogo}
              className="px-3 py-1.5 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-xl text-xs transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              Atur Ulang Logo
            </button>
          ) : (
            <label className="px-3 py-1.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl text-xs transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Unggah Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveProject} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Pilih dari Basis Data Klien (Opsional)</label>
            <CustomDropdown
              value={selectedDest}
              onChange={handleDestChange}
              className="w-full"
            >
              <option value="">-- Pilih Klien Tersimpan atau Ketik Manual --</option>
              {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
            </CustomDropdown>
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Tanggal Pengiriman</label>
            <input 
              type="date" 
              value={form.delivery_date}
              onChange={e => setForm({ ...form, delivery_date: e.target.value })}
              className={`w-full h-10 px-3 border rounded-xl font-semibold text-xs transition-all ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
            />
          </div>
        </div>

        <div className={`p-3 rounded-xl border space-y-2.5 ${isDarkMode ? 'bg-neutral-800/40 border-neutral-800' : 'bg-slate-50/70 border-slate-200/80'}`}>
          <p className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">Rincian Penerima (Dapat Diisi Langsung)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Tujuan Pengiriman (Nama Perusahaan) *</label>
              <input 
                type="text" 
                placeholder="Contoh: HO Nestle Jakarta"
                value={form.deliver_to}
                onChange={e => setForm({ ...form, deliver_to: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'}`}
                required
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Alamat Lengkap</label>
              <input 
                type="text" 
                placeholder="Contoh: Arkadia Green Park Tower G..."
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nama PIC / Penerima</label>
              <input 
                type="text" 
                placeholder="Contoh: Bpk. Budi / Divisi Logistik"
                value={form.pic_up}
                onChange={e => setForm({ ...form, pic_up: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'}`}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nomor Telepon</label>
              <input 
                type="text" 
                placeholder="Contoh: 08123456789"
                value={form.phone_no}
                onChange={e => setForm({ ...form, phone_no: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-900'}`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nomor DR (Delivery Request)</label>
            <input 
              type="text" 
              placeholder="Contoh: DR-001/PMG/IX/2026"
              value={form.dr_number}
              onChange={e => setForm({ ...form, dr_number: e.target.value })}
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Kode Transaksi *</label>
            <input 
              type="text" 
              placeholder="Contoh: 00001768/WB/PMG/VIII/2026"
              value={form.transaction_code}
              onChange={e => setForm({ ...form, transaction_code: e.target.value })}
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">Nama Proyek *</label>
            <input 
              type="text" 
              placeholder="Contoh: COCA COLA-CUSTOM BANNER"
              value={form.project_name}
              onChange={e => setForm({ ...form, project_name: e.target.value })}
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700 text-slate-100' : 'bg-slate-50/80 border-slate-200/90 text-slate-800'}`}
              required
            />
          </div>
        </div>

        <div className="border border-slate-200/80 dark:border-neutral-800 rounded-xl p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Daftar Barang ({items.length} Baris)</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItemIndexes.length > 0 && (
                <button type="button" onClick={handleRemoveSelectedItems} className="px-2.5 py-1 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-lg text-[11px] shadow-2xs cursor-pointer">
                  Hapus Terpilih ({selectedItemIndexes.length})
                </button>
              )}
              {items.length > 1 && (
                <button type="button" onClick={handleClearAllItems} className="px-2.5 py-1 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-lg text-[11px] shadow-2xs cursor-pointer">
                  Kosongkan Semua
                </button>
              )}
              <label title="Impor Daftar Barang dari Excel" className="px-2.5 py-1 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold rounded-lg text-[11px] cursor-pointer shadow-2xs transition-all active:scale-95 flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" />
                Impor Excel
                <input type="file" accept=".xlsx, .xls" onChange={handleImportItemsExcel} className="hidden" />
              </label>
              <button type="button" onClick={handleAddItemRow} className="px-2.5 py-1 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-lg text-[11px] shadow-2xs cursor-pointer transition-all active:scale-95 inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                Tambah Barang
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/40">
                <div className="sm:col-span-1 flex items-center justify-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={selectedItemIndexes.includes(idx)} 
                    onChange={() => handleToggleSelectItem(idx)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                </div>
                <div className="sm:col-span-5">
                  <input 
                    type="text" placeholder="Nama Barang / Materi"
                    value={item.item_name} onChange={e => handleItemChange(idx, 'item_name', e.target.value)}
                    className={`w-full p-2 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'}`}
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <input 
                    type="text" placeholder="Ukuran / Spesifikasi"
                    value={item.dimensions} onChange={e => handleItemChange(idx, 'dimensions', e.target.value)}
                    className={`w-full p-2 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'}`}
                  />
                </div>
                <div className="sm:col-span-1">
                  <input 
                    type="text" inputMode="numeric" value={item.qty}
                    onChange={e => handleItemChange(idx, 'qty', e.target.value.replace(/\D/g, ''))}
                    className={`w-full p-2 border rounded-xl font-bold text-center text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </div>
                <div className="sm:col-span-1">
                  <input
                    type="text" placeholder="PCS"
                    value={item.unit || 'PCS'} onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                    className={`w-full p-2 border rounded-xl font-bold text-center text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                  />
                </div>
                <div className="sm:col-span-1 text-center">
                  {items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItemRow(idx)} className="px-2 py-1 rounded-lg bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold cursor-pointer text-[11px]">
                      Hapus
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="w-full py-2.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-bold rounded-xl text-xs shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2">
          <CheckSquare className="w-4 h-4" />
          Simpan & Terbitkan Dokumen PMG
        </button>
      </form>

      {/* HISTORY */}
      <div className="mt-6 space-y-3 pt-2 border-t border-slate-200/80 dark:border-neutral-800">
        <div className="flex justify-between items-center">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Riwayat Surat Jalan & POD PMG</span>
          {selectedProjectIds.length > 0 && (
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-xl text-xs cursor-pointer">
              Hapus Terpilih ({selectedProjectIds.length})
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
          {projects.map(p => (
            <div key={p.id} className="p-2.5 border rounded-xl flex items-center justify-between gap-3 border-slate-200/80 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/40">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <input type="checkbox" checked={selectedProjectIds.includes(p.id)} onChange={() => setSelectedProjectIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} className="w-4 h-4 accent-blue-600 flex-shrink-0 cursor-pointer" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{p.project_name}</p>
                  <p className="text-[10px] font-mono truncate text-slate-500 dark:text-slate-400">Kode Transaksi: {p.transaction_code} | Tanggal: {p.delivery_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setPrintData(p)} title="Cetak POD dan Surat Jalan" className="p-1.5 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 font-semibold rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteSingle(p.id, p.project_name)} title="Hapus Dokumen" className="p-1.5 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PRINT PREVIEW MODAL (1 FULL A4 PAGE) */}
      {printData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900">Pratinjau 1 Halaman A4 (POD & Surat Jalan)</h3>
              <div className="flex gap-2">
                <button onClick={handlePrintDocument} className="px-4 py-2 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border border-blue-200/80 font-semibold rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Halaman Penuh
                </button>
                <button onClick={() => setPrintData(null)} className="px-3.5 py-2 bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 font-semibold rounded-xl text-xs cursor-pointer">
                  Tutup
                </button>
              </div>
            </div>

            {/* PRINT CONTAINER */}
            <div id="printable-pod-sj" className="space-y-1 bg-white p-3 border border-slate-200 rounded-xl" style={{ height: '275mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              
              {/* ================= TOP SECTION: PROOF OF DELIVERY (POD) ================= */}
              <div className="section-box space-y-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', padding: '0 4px', width: '38%', verticalAlign: 'top', height: '120px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '16px' }}>
                          <h2 style={{ margin: '0 0 6px 0', fontSize: '11.5px', fontWeight: 'bold' }}>PT. PMG INTEGRASI KOMUNIKASI</h2>
                          <p style={{ margin: 0, fontSize: '8.5px', lineHeight: '1.25' }}>EightyEight@Kasablanka Tower A.30 B Floor<br/>Jl. Raya Casablanca Kav 88 Jakarta 12870<br/>Tlp. +62 21 29820243 Fax: +62 21 29820244<br/>Web : <span style={{ color: '#2563eb', textDecoration: 'underline' }}>www.pmgasia.com</span></p>
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '0 4px', textAlign: 'center', verticalAlign: 'middle', width: '34%', height: '120px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 'bold', fontFamily: 'serif' }}>Proof Of Delivery</h1>
                        </div>
                      </td>
                      <td style={{ border: 'none', padding: '0 4px', textAlign: 'right', verticalAlign: 'bottom', width: '28%', height: '120px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end', height: '100%' }}>
                          {pmgLogo ? <img src={pmgLogo} alt="Logo" style={{ maxHeight: '120px', width: 'auto', objectFit: 'contain' }} /> : <div style={{ fontWeight: 'bold', fontSize: '11px' }}>PMG GROUP</div>}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontWeight: 'bold', fontSize: '9px', marginTop: '10px', marginBottom: '4px' }}>
                  DR No. &nbsp;&nbsp;&nbsp;: {printData.dr_number || ''}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', border: '1px solid #000' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', width: '18%', fontWeight: 'bold' }}>Date</td>
                      <td style={{ border: 'none', padding: '2px 3px', width: '32%' }}>: <span style={{ borderBottom: '1px solid #000', paddingBottom: '1px', display: 'inline-block', width: '90%' }}>{printData.delivery_date}</span></td>
                      <td style={{ border: 'none', padding: '2px 3px', width: '18%', fontWeight: 'bold' }}>Deliver to</td>
                      <td style={{ border: 'none', padding: '2px 3px', width: '32%' }}>: {printData.deliver_to || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Time</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.time || ''}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.courier_info || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}><div style={{ borderBottom: '1px solid #000', height: '10px', width: '90%' }}></div></td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>:</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Project No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.project_no || ''}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Vehicle No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.vehicle_no || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Phone No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.phone_no || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Transaction Code</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.transaction_code}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Phone No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.phone_no || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Project Name</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.project_name}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Phone No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.phone_no || ''}</td>
                    </tr>
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', fontSize: '8px' }}>
                  <thead>
                    <tr style={{ background: '#d3d3d3' }}>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '8%', textAlign: 'center' }}>NO.</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '57%', textAlign: 'center' }}>ITEM</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '15%', textAlign: 'center' }}>QUANTITIES</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '20%', textAlign: 'center' }}>ADDITIONAL INFO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.pmg_project_items?.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '2px' }}>{item.item_name} {item.dimensions ? `_ ${item.dimensions}` : ''}</td>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.unit || 'PCS'}</td>
                      </tr>
                    ))}
                    {renderEmptyRows(printData.pmg_project_items?.length || 0)}
                  </tbody>
                </table>

                {/* GRAND TOTAL POD */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '-1px', fontSize: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'right', width: '65%', background: '#e6e6e6' }} colSpan="2">
                        Grand Total :
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'center', width: '15%', background: '#e6e6e6' }}>
                        {calculateGrandTotal(printData.pmg_project_items)}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', width: '20%', background: '#e6e6e6' }}>
                        &nbsp;
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginTop: '4px' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '48%', verticalAlign: 'top', border: 'none', padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '7px' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', background: '#f2f2f2' }} colSpan="2">Pengirim</td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '2px 3px', width: '50%' }}>Nama Lengkap Pengirim</td>
                              <td style={{ border: '1px solid #000', padding: '2px 3px', width: '50%' }}>{printData.sender_name || 'NINING'}</td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Tanda Tangan dan Stempel</td>
                              <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Tanggal</td>
                              <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                      <td style={{ width: '4%', border: 'none', padding: 0 }}></td>
                      <td style={{ width: '48%', verticalAlign: 'top', border: 'none', padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '7px' }}>
                          <tbody>
                            <tr>
                              <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', background: '#f2f2f2' }} colSpan="2">Penerima</td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '2px 3px', width: '50%' }}>Nama Lengkap Penerima</td>
                              <td style={{ border: '1px solid #000', padding: '2px 3px', width: '50%' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Tanda Tangan dan Stempel</td>
                              <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                            </tr>
                            <tr>
                              <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Tanggal</td>
                              <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '7px', fontStyle: 'italic', marginTop: '4px' }}>
                  - Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
                </div>
              </div>

              {/* CUT LINE */}
              <div className="divider-cut" style={{ borderBottom: '2px dashed #000', margin: '4px 0', textAlign: 'center' }}>
                <span style={{ background: '#fff', padding: '0 8px', fontSize: '7px', fontWeight: 'bold', position: 'relative', top: '-6px' }}>
                  --- POTONG DI SINI ---
                </span>
              </div>

              {/* ================= BOTTOM SECTION: DELIVERY ORDER ================= */}
              <div className="section-box-do" style={{ fontFamily: 'Arial, sans-serif', gap: '3px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '10px', textDecoration: 'underline', marginBottom: '0px' }}>DELIVERY ORDER</div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'serif', marginTop: '-1px' }}>SURAT JALAN</div>
                </div>

                <div style={{ fontWeight: 'bold', fontSize: '9px', marginTop: '4px', marginBottom: '4px' }}>
                  DR No. &nbsp;&nbsp;&nbsp;: {printData.dr_number || '0'}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', border: '1px solid #000' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', width: '18%', fontWeight: 'bold' }}>Date</td>
                      <td style={{ border: 'none', padding: '2px 3px', width: '32%' }}>: <span style={{ borderBottom: '1px solid #000', paddingBottom: '1px', display: 'inline-block', width: '90%' }}>{printData.delivery_date}</span></td>
                      <td style={{ border: 'none', padding: '2px 3px', width: '18%', fontWeight: 'bold' }}>Deliver to</td>
                      <td style={{ border: 'none', padding: '2px 3px', width: '32%' }}>: {printData.deliver_to || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Time</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.time || ''}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.courier_info || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}><div style={{ borderBottom: '1px solid #000', height: '10px', width: '90%' }}></div></td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>:</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Project No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.project_no || ''}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Vehicle No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.vehicle_no || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>&nbsp;</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Phone No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.phone_no || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Transaction Code</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.transaction_code}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Phone No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.phone_no || ''}</td>
                    </tr>
                    <tr>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>ITEM</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.project_name}</td>
                      <td style={{ border: 'none', padding: '2px 3px', fontWeight: 'bold' }}>Phone No.</td>
                      <td style={{ border: 'none', padding: '2px 3px' }}>: {printData.phone_no || ''}</td>
                    </tr>
                  </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '6px', fontSize: '8px' }}>
                  <thead>
                    <tr style={{ background: '#d3d3d3' }}>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '8%', textAlign: 'center' }}>NO.</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '57%', textAlign: 'center' }}>ITEM</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '15%', textAlign: 'center' }}>QUANTITIES</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '20%', textAlign: 'center' }}>ADDITIONAL INFO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.pmg_project_items?.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '2px' }}>{item.item_name} {item.dimensions ? `_ ${item.dimensions}` : ''}</td>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.unit || 'PCS'}</td>
                      </tr>
                    ))}
                    {renderEmptyRows(printData.pmg_project_items?.length || 0)}
                  </tbody>
                </table>

                {/* GRAND TOTAL DELIVERY ORDER */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '-1px', fontSize: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'right', width: '65%', background: '#e6e6e6' }} colSpan="2">
                        Grand Total :
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'center', width: '15%', background: '#e6e6e6' }}>
                        {calculateGrandTotal(printData.pmg_project_items)}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', width: '20%', background: '#e6e6e6' }}>
                        &nbsp;
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* SIGNATURE DELIVERY ORDER */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '4px', fontSize: '7px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Pengirim</td>
                      <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Penerima</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>Nama Lengkap Pengirim</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>{printData.sender_name || 'NINING'}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>Nama Lengkap Penerima</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}></td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Tanda Tangan dan Stempel</td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Tanda Tangan dan Stempel</td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Tanggal</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Tanggal</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '7px', fontStyle: 'italic', marginTop: '-1px' }}>
                  - Batas Complain Kekurangan atau Kerusakan Barang Hanya 7 Hari dari Barang diterima, Lebih dari itu Tidak Diterima
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}