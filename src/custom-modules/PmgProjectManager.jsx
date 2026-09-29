import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';
import { Printer, Trash2, Upload, ChevronDown } from 'lucide-react';

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
    if (window.confirm('Unlock & reset PMG Header Logo?')) {
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

    vehicle_no: '',
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
    if (selectedItemIndexes.length === 0) return alert('Please select at least one item row to delete!');
    if (!window.confirm(`Delete ${selectedItemIndexes.length} selected items?`)) return;
    
    const remainingItems = items.filter((_, idx) => !selectedItemIndexes.includes(idx));
    setItems(remainingItems.length > 0 ? remainingItems : [{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
    setSelectedItemIndexes([]);
  };

  const handleClearAllItems = () => {
    if (!window.confirm('Are you sure you want to delete ALL items?')) return;
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
          alert(`Successfully imported ${importedItems.length} items!`);
        } else {
          alert('Row format not recognized.');
        }
      } catch (err) {
        alert('Failed to read file: ' + err.message);
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
    if (!form.transaction_code || !form.project_name) return alert('Transaction Code and Project Name are required!');

    const { data: existing, error: checkError } = await supabase
      .from('pmg_projects')
      .select('id')
      .eq('transaction_code', form.transaction_code);

    if (checkError) return alert('Error checking duplication: ' + checkError.message);
    if (existing && existing.length > 0) {
      return alert('REJECTED: Delivery Order with Transaction Code "' + form.transaction_code + '" is already registered!');
    }

    const savedDestId = await saveDestinationToDatabase();

    const { data: projData, error: projError } = await supabase
      .from('pmg_projects')
      .insert([form])
      .select();

    if (projError) return alert('Failed to save project: ' + projError.message);

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
      alert('Item error: ' + itemError.message);
    } else {
      alert('PMG Delivery Order & Allocation successfully saved to database!');
      setForm({ dr_number: '', transaction_code: '', project_name: '', delivery_date: new Date().toISOString().split('T')[0], deliver_to: '', address: '', pic_up: '', phone_no: '', vehicle_no: '', sender_name: 'NINING' });
      setSelectedDest('');
      setItems([{ destination_id: '', item_name: '', dimensions: '', qty: 1, unit: 'PCS' }]);
      setSelectedItemIndexes([]);
      fetchProjects();
    }
  };

  const handleDeleteSingle = async (id, name) => {
    if (!window.confirm(`Delete delivery order "${name}"?`)) return;
    await supabase.from('pmg_project_items').delete().eq('project_id', id);
    const { error } = await supabase.from('pmg_projects').delete().eq('id', id);
    if (!error) fetchProjects();
  };

  const handleBulkDelete = async () => {
    if (selectedProjectIds.length === 0) return alert('Please select at least one!');
    if (!window.confirm(`Delete ${selectedProjectIds.length} selected delivery orders?`)) return;
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
          <title>POD & Delivery Order - PMG (1 Full A4 Page)</title>
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
    <div className={`p-4 rounded-2xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
      <div>
        <h3 className="font-bold text-xs uppercase text-black dark:text-white mb-0.5">
          Input & PMG Delivery Order / POD Allocation
        </h3>
        <p className="text-[11px] opacity-60">Create delivery documents in official PMG POD & Delivery Order format.</p>
      </div>

      {/* PMG LOGO UPLOAD CARD WITH LOCALSTORAGE LOCK */}
      <div className="p-3 border border-slate-200 bg-white text-black rounded-xl text-xs shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-16 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center p-1 overflow-hidden">
            {pmgLogo ? <img src={pmgLogo} alt="Logo PMG" className="max-w-full max-h-full object-contain" /> : <span className="text-[9px] text-slate-400 font-bold">No Logo</span>}
          </div>
          <div>
            <h4 className="font-bold text-xs text-black">
              PMG Header Logo
            </h4>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              {pmgLogo ? 'Logo PMG locked in memory' : 'Upload PMG logo once to lock for all docs'}
            </p>
          </div>
        </div>
        <div>
          {pmgLogo ? (
            <button
              type="button"
              onClick={handleResetLogo}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              Unlock Logo
            </button>
          ) : (
            <label className="px-3 py-1.5 bg-white hover:bg-slate-50 text-black border border-slate-300 font-bold rounded-xl text-xs transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Logo
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveProject} className="space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
          <div>
            <label className="block font-bold mb-1 opacity-75">Select from Client Database (Optional)</label>
            <div className="relative flex items-center">
              <select
                value={selectedDest}
                onChange={handleDestChange}
                className={`w-full h-10 pl-3 pr-9 border rounded-xl font-semibold text-xs appearance-none cursor-pointer transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
              >
                <option value="">-- Select Saved Client or Type Manually --</option>
                {destinations.map(d => <option key={d.id} value={d.id}>{d.client_name}</option>)}
              </select>
              <div className="absolute right-2 pointer-events-none w-6 h-6 rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 flex items-center justify-center shadow-2xs">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
          <div>
            <label className="block font-bold mb-1 opacity-75">Delivery Date</label>
            <input 
              type="date" 
              value={form.delivery_date}
              onChange={e => setForm({ ...form, delivery_date: e.target.value })}
              className={`w-full h-10 px-3 border rounded-xl font-semibold text-xs transition-all ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
            />
          </div>
        </div>

        <div className={`p-3 rounded-xl border space-y-2.5 ${isDarkMode ? 'bg-neutral-900/50 border-neutral-700' : 'bg-stone-50 border-stone-300'}`}>
          <p className="font-bold text-black dark:text-white uppercase tracking-wide text-[11px]">RECEIVER DETAILS (CAN TYPE DIRECTLY)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-bold mb-1 opacity-75">Deliver to (Company Name) *</label>
              <input 
                type="text" 
                placeholder="e.g. HO Nestlé Jakarta"
                value={form.deliver_to}
                onChange={e => setForm({ ...form, deliver_to: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-stone-900'}`}
                required
              />
            </div>
            <div>
              <label className="block font-bold mb-1 opacity-75">Full Address</label>
              <input 
                type="text" 
                placeholder="e.g. Arkadia Green Park Tower G..."
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-stone-900'}`}
              />
            </div>
            <div>
              <label className="block font-bold mb-1 opacity-75">PIC / Attention</label>
              <input 
                type="text" 
                placeholder="e.g. Mr. Budi / Logistics Dept"
                value={form.pic_up}
                onChange={e => setForm({ ...form, pic_up: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-stone-900'}`}
              />
            </div>
            <div>
              <label className="block font-bold mb-1 opacity-75">Phone No.</label>
              <input 
                type="text" 
                placeholder="e.g. 08123456789"
                value={form.phone_no}
                onChange={e => setForm({ ...form, phone_no: e.target.value })}
                className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-stone-900'}`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block font-bold mb-1 opacity-75">DR No. (Delivery Order No.)</label>
            <input 
              type="text" 
              placeholder="e.g. DR-001/PMG/IX/2026"
              value={form.dr_number}
              onChange={e => setForm({ ...form, dr_number: e.target.value })}
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
            />
          </div>
          <div>
            <label className="block font-bold mb-1 opacity-75">Transaction Code *</label>
            <input 
              type="text" 
              placeholder="e.g. 00001768/WB/PMG/VIII/2026"
              value={form.transaction_code}
              onChange={e => setForm({ ...form, transaction_code: e.target.value })}
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1 opacity-75">Project Name *</label>
            <input 
              type="text" 
              placeholder="e.g. COCA COLA-CUSTOM BANNER"
              value={form.project_name}
              onChange={e => setForm({ ...form, project_name: e.target.value })}
              className={`w-full p-2.5 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-stone-50 border-stone-300 text-black'}`}
              required
            />
          </div>
        </div>

        <div className="border rounded-xl p-3 space-y-2.5 dark:border-neutral-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h4 className="font-bold text-xs uppercase text-black dark:text-white">Item List ({items.length} Items)</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedItemIndexes.length > 0 && (
                <button type="button" onClick={handleRemoveSelectedItems} className="px-2.5 py-1 bg-rose-600 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer">
                  Delete Selected ({selectedItemIndexes.length})
                </button>
              )}
              {items.length > 1 && (
                <button type="button" onClick={handleClearAllItems} className="px-2.5 py-1 bg-rose-700 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer">
                  Clear All Items
                </button>
              )}
              <label title="Import File" className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg cursor-pointer shadow-xs transition-all active:scale-95 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept=".xlsx, .xls" onChange={handleImportItemsExcel} className="hidden" />
              </label>
              <button type="button" onClick={handleAddItemRow} className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg text-[11px] shadow-xs cursor-pointer transition-all active:scale-95">Add Item</button>
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
                    className="w-4 h-4 accent-black dark:accent-white cursor-pointer"
                  />
                  <span className="text-[10px] opacity-60 font-mono">#{idx + 1}</span>
                </div>
                <div className="sm:col-span-6">
                  <input 
                    type="text" placeholder="Item Name / Title"
                    value={item.item_name} onChange={e => handleItemChange(idx, 'item_name', e.target.value)}
                    className={`w-full p-2 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-black'}`}
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <input 
                    type="text" placeholder="Dimensions / Specs"
                    value={item.dimensions} onChange={e => handleItemChange(idx, 'dimensions', e.target.value)}
                    className={`w-full p-2 border rounded-xl font-semibold text-xs ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-300 text-black'}`}
                  />
                </div>
                <div className="sm:col-span-1">
                  <input 
                    type="text" inputMode="numeric" value={item.qty}
                    onChange={e => handleItemChange(idx, 'qty', e.target.value.replace(/\D/g, ''))}
                    className={`w-full p-2 border-2 border-slate-400 dark:border-stone-600 rounded-xl font-bold text-center text-xs ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-white text-black'}`}
                  />
                </div>
                <div className="sm:col-span-1 text-center">
                  {items.length > 1 && <button type="button" onClick={() => handleRemoveItemRow(idx)} className="text-rose-500 font-bold hover:scale-105 transition-transform cursor-pointer text-xs">Delete</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer">
          Save & Issue PMG Documents
        </button>
      </form>

      {/* HISTORY */}
      <div className="mt-8 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-xs uppercase text-black dark:text-white">PMG Delivery Order & POD History</span>
          {selectedProjectIds.length > 0 && (
            <button onClick={handleBulkDelete} className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded-xl text-xs">Delete Selected ({selectedProjectIds.length})</button>
          )}
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {projects.map(p => (
            <div key={p.id} className="p-2.5 border rounded-xl flex items-center justify-between gap-3 dark:border-neutral-700">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <input type="checkbox" checked={selectedProjectIds.includes(p.id)} onChange={() => setSelectedProjectIds(prev => prev.includes(p.id) ? prev.filter(i => i !== p.id) : [...prev, p.id])} className="w-4 h-4 accent-black dark:accent-white flex-shrink-0 cursor-pointer" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs text-black dark:text-white truncate">{p.project_name}</p>
                  <p className="opacity-70 text-[10px] font-mono truncate text-black dark:text-white">Trx Code: {p.transaction_code} | Date: {p.delivery_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setPrintData(p)} title="Print POD and DO" className="p-1.5 border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 font-bold rounded-full transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center">
                  <Printer className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteSingle(p.id, p.project_name)} title="Delete" className="p-1.5 border border-stone-300 bg-white hover:bg-rose-50 text-rose-600 font-bold rounded-full transition-all active:scale-95 cursor-pointer shadow-2xs flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PRINT PREVIEW MODAL (1 FULL A4 PAGE) */}
      {printData && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm uppercase text-black">Preview 1 Full A4 Page (POD & Delivery Order)</h3>
              <div className="flex gap-2">
                <button onClick={handlePrintDocument} className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs">Print Full Page</button>
                <button onClick={() => setPrintData(null)} className="px-3 py-2 bg-stone-300 hover:bg-stone-400 font-bold rounded-xl text-xs">Close</button>
              </div>
            </div>

            {/* PRINT CONTAINER */}
            <div id="printable-pod-sj" className="space-y-1 bg-white p-3 border rounded-xl" style={{ height: '275mm', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              
              {/* ================= TOP SECTION: PROOF OF DELIVERY (POD) ================= */}
              <div className="section-box space-y-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', width: '40%', verticalAlign: 'top' }}>
                      <h2 style={{ margin: '0 0 1px 0', fontSize: '10px', fontWeight: 'bold' }}>PT. PMG INTEGRASI KOMUNIKASI</h2>
                      <p style={{ margin: '1px 0', fontSize: '6px', lineHeight: '1.1' }}>EightyEight@Kasablanka Tower A.30 B Floor<br/>Jl. Raya Casablanca Kav 88 Jakarta 12870<br/>Tlp. +62 21 29820243 Fax: +62 21 29820244</p>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'middle', width: '35%' }}>
                      <h1 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', fontFamily: 'serif' }}>Proof Of Delivery</h1>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'middle', width: '25%' }}>
                      {pmgLogo ? <img src={pmgLogo} alt="Logo" style={{ maxHeight: '24px', marginLeft: 'auto' }} /> : <div style={{ fontWeight: 'bold', fontSize: '11px' }}>PMG GROUP</div>}
                    </td>
                  </tr>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginTop: '-1px' }}>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '15%', fontWeight: 'bold' }}>DR No.</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '35%' }}>: {printData.dr_number || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '15%', fontWeight: 'bold' }}>Deliver to</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '35%', fontWeight: 'bold' }}>: {printData.deliver_to || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>Date</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.delivery_date}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold', verticalAlign: 'top' }} rowSpan={2}>Address</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', verticalAlign: 'top' }} rowSpan={2}>: {printData.address || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>Trx Code</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.transaction_code}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>Project Name</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.project_name}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>PIC / Phone</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.pic_up || ''} / {printData.phone_no || ''}</td>
                  </tr>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px', fontSize: '8px' }}>
                  <thead>
                    <tr style={{ background: '#d3d3d3' }}>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '8%', textAlign: 'center' }}>NO.</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '57%', textAlign: 'center' }}>ITEM</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '15%', textAlign: 'center' }}>QTY</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '20%', textAlign: 'center' }}>ADDITIONAL INFO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.pmg_project_items?.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '2px' }}>{item.item_name} {item.dimensions ? `_ ${item.dimensions}` : ''}</td>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ border: '1px solid #000', padding: '2px' }}></td>
                      </tr>
                    ))}
                    {renderEmptyRows(printData.pmg_project_items?.length || 0)}
                  </tbody>
                </table>

                {/* GRAND TOTAL POD */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '-1px', fontSize: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'right', width: '80%', background: '#e6e6e6' }}>
                        Grand Total :
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'center', width: '20%', background: '#e6e6e6' }}>
                        {calculateGrandTotal(printData.pmg_project_items)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* SIGNATURE POD */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '-1px', fontSize: '7px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Sender</td>
                      <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Recipient</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>Sender Full Name</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>{printData.sender_name || 'NINING'}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>Recipient Full Name</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}></td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Signature and Stamp</td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Signature and Stamp</td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Date</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Date</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '7px', fontStyle: 'italic', marginTop: '1px' }}>
                  - Claim period for missing or damaged items is strictly 7 days from receipt.
                </div>
              </div>

              {/* CUT LINE */}
              <div className="divider-cut" style={{ borderBottom: '2px dashed #000', margin: '4px 0', textAlign: 'center' }}>
                <span style={{ background: '#fff', padding: '0 8px', fontSize: '7px', fontWeight: 'bold', position: 'relative', top: '-6px' }}>
                  --- CUT HERE ---
                </span>
              </div>

              {/* ================= BOTTOM SECTION: DELIVERY ORDER ================= */}
              <div className="section-box space-y-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', width: '40%', verticalAlign: 'top' }}>
                      <h2 style={{ margin: '0 0 1px 0', fontSize: '10px', fontWeight: 'bold' }}>PT. PMG INTEGRASI KOMUNIKASI</h2>
                      <p style={{ margin: '1px 0', fontSize: '6px', lineHeight: '1.1' }}>EightyEight@Kasablanka Tower A.30 B Floor<br/>Jl. Raya Casablanca Kav 88 Jakarta 12870<br/>Tlp. +62 21 29820243 Fax: +62 21 29820244</p>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'middle', width: '35%' }}>
                      <h3 style={{ margin: 0, fontSize: '8px', fontWeight: 'bold' }}>DELIVERY ORDER</h3>
                      <h1 style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', fontFamily: 'serif' }}>DELIVERY ORDER</h1>
                    </td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'middle', width: '25%' }}>
                      {pmgLogo ? <img src={pmgLogo} alt="Logo" style={{ maxHeight: '24px', marginLeft: 'auto' }} /> : <div style={{ fontWeight: 'bold', fontSize: '11px' }}>PMG GROUP</div>}
                    </td>
                  </tr>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px', marginTop: '-1px' }}>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '15%', fontWeight: 'bold' }}>DR No.</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '35%' }}>: {printData.dr_number || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '15%', fontWeight: 'bold' }}>Deliver to</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', width: '35%', fontWeight: 'bold' }}>: {printData.deliver_to || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>Date</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.delivery_date}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold', verticalAlign: 'top' }} rowSpan={2}>Address</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', verticalAlign: 'top' }} rowSpan={2}>: {printData.address || ''}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>Trx Code</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.transaction_code}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>Project Name</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.project_name}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', fontWeight: 'bold' }}>PIC / Phone</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}>: {printData.pic_up || ''} / {printData.phone_no || ''}</td>
                  </tr>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '-1px', fontSize: '8px' }}>
                  <thead>
                    <tr style={{ background: '#d3d3d3' }}>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '8%', textAlign: 'center' }}>NO.</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '57%', textAlign: 'center' }}>ITEM</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '15%', textAlign: 'center' }}>QTY</th>
                      <th style={{ border: '1px solid #000', padding: '2px', width: '20%', textAlign: 'center' }}>ADDITIONAL INFO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.pmg_project_items?.map((item, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{i + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '2px' }}>{item.item_name} {item.dimensions ? `_ ${item.dimensions}` : ''}</td>
                        <td style={{ border: '1px solid #000', padding: '2px', textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ border: '1px solid #000', padding: '2px' }}></td>
                      </tr>
                    ))}
                    {renderEmptyRows(printData.pmg_project_items?.length || 0)}
                  </tbody>
                </table>

                {/* GRAND TOTAL DELIVERY ORDER */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '-1px', fontSize: '8px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'right', width: '80%', background: '#e6e6e6' }}>
                        Grand Total :
                      </td>
                      <td style={{ border: '1px solid #000', padding: '2px 4px', fontWeight: 'bold', textAlign: 'center', width: '20%', background: '#e6e6e6' }}>
                        {calculateGrandTotal(printData.pmg_project_items)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* SIGNATURE DELIVERY ORDER */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginTop: '-1px', fontSize: '7px' }}>
                  <tbody>
                    <tr>
                      <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Sender</td>
                      <td style={{ border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', width: '50%', background: '#f2f2f2' }} colSpan="2">Recipient</td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>Sender Full Name</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>{printData.sender_name || 'NINING'}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}>Recipient Full Name</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', width: '25%' }}></td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Signature and Stamp</td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}>Signature and Stamp</td>
                      <td style={{ border: '1px solid #000', padding: '8px 3px' }}></td>
                    </tr>
                    <tr>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Date</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}>Date</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ fontSize: '7px', fontStyle: 'italic', marginTop: '1px' }}>
                  - Claim period for missing or damaged items is strictly 7 days from receipt.
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}