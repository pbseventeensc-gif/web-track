import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

// URL Google Apps Script milik Anda
const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzh4DKAVUWYfGzzD90yc7Oy6oE0h1RfWYro0abbgFpSBEjNNoen1O1bu6vYtbe-CXLpuQ/exec";

const STAFF_QC_LIST = [
  "Budi (QC Paking)", "Siti (QC Paking)", "Agus (QC Checker)",
  "Dewi (QC Checker)", "Eko (QC Deliver)", "Rian (QC Deliver)"
];

function CircularGaugeCard({ title, percent, color, detailText }) {
  const strokeDasharray = 2 * Math.PI * 36;
  const strokeDashoffset = strokeDasharray - (percent / 100) * strokeDasharray;
  return (
    <div className="bg-white/80 dark:bg-neutral-800/80 p-5 rounded-3xl border border-[#D8D2C2] dark:border-neutral-700 flex flex-col items-center shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-3">{title}</h4>
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="7" className="text-stone-200 dark:text-neutral-700 fill-none" />
          <circle cx="40" cy="40" r="36" stroke={color} strokeWidth="7" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="fill-none transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black">{percent}%</span>
          <span className="text-[9px] font-bold opacity-60 uppercase">Progress</span>
        </div>
      </div>
      <p className="text-xs font-bold mt-3 opacity-80">{detailText}</p>
    </div>
  );
}

/* ==========================================
   MODAL LOGIN CABANG & ADMIN
========================================== */
function BranchLoginModal({ isOpen, onLoginSuccess }) {
  const [accessCode, setAccessCode] = useState('');
  const [pinCode, setPinCode] = useState('');
  if (!isOpen) return null;
  const handleLogin = async (e) => {
    e.preventDefault();
    const { data } = await supabase.from('kl_branch_access').select('*, kl_branches(branch_name)').eq('access_code', accessCode.toUpperCase()).eq('pin_code', pinCode).maybeSingle();
    if (data) onLoginSuccess({ role: 'branch', branch_id: data.branch_id, branch_name: data.kl_branches.branch_name });
    else alert('❌ Kode Cabang atau PIN Salah!');
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <div className="w-full max-w-sm p-6 bg-white rounded-3xl text-center text-black">
        <h3 className="font-bold text-lg mb-4">🔑 Login Cabang</h3>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Kode Cabang (AZKO-001)" value={accessCode} onChange={e=>setAccessCode(e.target.value)} className="w-full p-3 border rounded" />
          <input type="password" placeholder="PIN" value={pinCode} onChange={e=>setPinCode(e.target.value)} className="w-full p-3 border rounded" />
          <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded">Masuk</button>
        </form>
      </div>
    </div>
  );
}

function AdminLoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  if (!isOpen) return null;
  const handleLogin = (e) => {
    e.preventDefault();
    if (username.toUpperCase() === 'ADMIN' && password === '123456') onLoginSuccess({ role: 'admin', name: 'Administrator' });
    else alert('❌ Admin Username/Password salah!');
  };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
      <div className="w-full max-w-sm p-6 bg-white rounded-3xl text-center text-black">
        <h3 className="font-bold text-lg mb-4">🔐 Login Admin</h3>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="text" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} className="w-full p-3 border rounded" />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 border rounded" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border py-3 rounded font-bold">Batal</button>
            <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold rounded">Masuk</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   KOMPONEN TAB: PROJECT KAWAN LAMA
   ========================================================= */
function KawanLamaTab({ isDarkMode, currentUser, isBranchMode }) {
  const [branches, setBranches] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const dropdownRef = useRef(null);
  const [branchSearch, setBranchSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [promoName, setPromoName] = useState('PROMO TEMATIK AGUSTUS');
  const [projectType, setProjectType] = useState('Project C');
  const [customBudget, setCustomBudget] = useState(2500000);
  const [sortAscending, setSortAscending] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [orderStatus, setOrderStatus] = useState('DRAFT');
  const [loading, setLoading] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);

  useEffect(() => {
    fetchMasterData();
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isBranchMode && currentUser && currentUser.role === 'branch') {
      setSelectedBranch(currentUser.branch_id);
      setBranchSearch(currentUser.branch_name || '');
      loadBranchOrder(currentUser.branch_id);
    }
  }, [currentUser, isBranchMode]);

  const fetchMasterData = async () => {
    setLoading(true);
    const { data: bData } = await supabase.from('kl_branches').select('*').order('branch_name', { ascending: true });
    if (bData) setBranches(bData);
    const { data: iData } = await supabase.from('kl_master_items').select('*').order('item_name', { ascending: true });
    if (iData) setMasterItems(iData);
    setLoading(false);
  };

  const loadBranchOrder = async (branchId) => {
    setLoading(true);
    const { data: orderData } = await supabase.from('kl_orders').select('*, kl_order_items(*)').eq('branch_id', branchId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (orderData) {
      setActiveOrder(orderData); setOrderStatus(orderData.status);
      if (orderData.project_name) setPromoName(orderData.project_name);
      if (orderData.total_budget) setCustomBudget(Number(orderData.total_budget));
      let initialQty = {};
      if (orderData.kl_order_items) orderData.kl_order_items.forEach(item => initialQty[item.item_id] = item.qty);
      setQuantities(initialQty);
    } else {
      setActiveOrder(null); setOrderStatus('DRAFT'); setQuantities({});
    }
    setLoading(false);
  };

  const handleProjectTypeChange = (type) => {
    setProjectType(type);
    if (type === 'Project A') setCustomBudget(5000000);
    else if (type === 'Project B') setCustomBudget(3500000);
    else if (type === 'Project C') setCustomBudget(2500000);
  };

  const handleSelectBranchItem = async (branch) => {
    setSelectedBranch(branch.id); setBranchSearch(branch.branch_name || ''); setIsDropdownOpen(false);
    loadBranchOrder(branch.id);
  };

  const totalUsedBudget = masterItems.reduce((acc, item) => acc + ((quantities[item.id] || 0) * (item.price || 0)), 0);
  const remainingBudget = (Number(customBudget) || 0) - totalUsedBudget;

  const handleQtyChange = (itemId, val, itemPrice) => {
    const newQty = Number(val) || 0;
    const estimatedUsedBudget = totalUsedBudget - ((quantities[itemId] || 0) * (itemPrice || 0)) + (newQty * (itemPrice || 0));
    if (estimatedUsedBudget > (Number(customBudget) || 0)) return alert(`❌ Qty tidak bisa ditambahkan, melebihi total Budget`);
    setQuantities(prev => ({ ...prev, [itemId]: newQty }));
  };

  const handleBroadcastPromo = async () => {
    if (!promoName.trim()) return alert('⚠️ Silakan isi Nama Promo!');
    if (!confirm(`📢 Bagikan Promo "${promoName}" (Budget Rp${Number(customBudget).toLocaleString()}) ke SELURUH CABANG?`)) return;
    setLoading(true);
    const { error } = await supabase.from('kl_orders').update({ project_name: promoName, total_budget: Number(customBudget) || 0 }).eq('status', 'DRAFT');
    setLoading(false);
    if (error) alert('Gagal membagikan promo: ' + error.message);
    else alert(`✅ Promo "${promoName}" berhasil dibagikan!`);
  };

  const handleSubmitOrder = async () => {
    if (!selectedBranch) return alert('⚠️ Silakan pilih kantor cabang terlebih dahulu!');
    if (!promoName.trim()) return alert('⚠️ Silakan isi Nama Promo!');
    if (remainingBudget < 0) return alert('❌ Qty tidak bisa ditambahkan, melebihi total Budget');
    const itemsToInsert = masterItems.filter(item => (quantities[item.id] || 0) > 0).map(item => ({ item_id: item.id, qty: quantities[item.id], subtotal: quantities[item.id] * (item.price || 0) }));
    if (itemsToInsert.length === 0) return alert('⚠️ Silakan isi Qty minimal pada 1 item!');
    setLoading(true);
    const { data: order, error: orderErr } = await supabase.from('kl_orders').insert([{ project_name: promoName, branch_id: selectedBranch, total_budget: Number(customBudget) || 0, status: 'SUBMITTED' }]).select().single();
    if (orderErr) { setLoading(false); return alert('❌ Gagal Submit Order: ' + orderErr.message); }
    const detailPayload = itemsToInsert.map(item => ({ order_id: order.id, item_id: item.item_id, qty: item.qty, subtotal: item.subtotal }));
    const { error: itemErr } = await supabase.from('kl_order_items').insert(detailPayload);
    setLoading(false);
    if (itemErr) alert('❌ Gagal menyimpan detail item: ' + itemErr.message);
    else { alert('✅ Order berhasil di-submit dan dikunci!'); setOrderStatus('SUBMITTED'); setActiveOrder(order); }
  };

  const handleRequestRevision = async () => {
    if (!activeOrder) return;
    setLoading(true);
    const { error } = await supabase.from('kl_orders').update({ status: 'REVISION_REQUESTED' }).eq('id', activeOrder.id);
    setLoading(false);
    if (error) alert('Gagal mengirimkan permohonan revisi: ' + error.message);
    else { alert('✅ Permohonan revisi telah dikirim ke Admin!'); setOrderStatus('REVISION_REQUESTED'); }
  };

  const isFormLocked = orderStatus === 'SUBMITTED' || orderStatus === 'REVISION_REQUESTED';
  const filteredBranches = branches.filter(b => (b.branch_name || '').toLowerCase().includes((branchSearch || '').toLowerCase()));
  const sortedMasterItems = [...masterItems].sort((a, b) => sortAscending ? (a.item_name||'').localeCompare(b.item_name||'') : (b.item_name||'').localeCompare(a.item_name||''));

  return (
    <div className={`p-5 rounded-2xl border space-y-4 shadow-sm ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between border-b pb-3 gap-3">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">🏢 Input Form Cabang - Project Kawan Lama</h3>
          <p className="text-xs opacity-70">{isBranchMode ? 'Halaman Pengisian Cabang' : 'Akses Admin Operasional'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${orderStatus === 'SUBMITTED' ? 'bg-rose-100 text-rose-800' : 'bg-stone-200 text-stone-800'}`}>{orderStatus}</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="flex justify-between"><label className="text-xs font-bold">🏷️ Nama Promo:</label>{!isBranchMode && <button onClick={handleBroadcastPromo} className="text-[10px] font-bold text-indigo-500">📢 Broadcast</button>}</div>
          <input type="text" value={promoName} disabled={isFormLocked || isBranchMode} onChange={(e) => setPromoName(e.target.value)} className={`w-full p-2.5 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white text-black'}`} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold">💰 Tipe Budget:</label>
          <div className="flex gap-2">
            <select value={projectType} disabled={isFormLocked || isBranchMode} onChange={(e) => handleProjectTypeChange(e.target.value)} className={`p-2.5 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white text-black'}`}><option value="Project A">Project A</option><option value="Project B">Project B</option><option value="Project C">Project C</option><option value="Custom">Custom</option></select>
            <input type="number" value={customBudget} disabled={isFormLocked || isBranchMode || projectType !== 'Custom'} onChange={(e) => setCustomBudget(Number(e.target.value) || 0)} className={`flex-1 p-2.5 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white text-black'}`} />
          </div>
        </div>
        <div className="space-y-1 relative" ref={dropdownRef}>
          <label className="text-xs font-bold">{isBranchMode ? '🔒 Cabang Anda:' : '🔍 Cari Cabang:'}</label>
          <input type="text" value={branchSearch} disabled={isFormLocked || isBranchMode} onChange={(e) => { setBranchSearch(e.target.value); setSelectedBranch(''); setIsDropdownOpen(true); }} onFocus={() => !isBranchMode && setIsDropdownOpen(true)} className={`w-full p-2.5 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white text-black'}`} />
          {isDropdownOpen && !isFormLocked && !isBranchMode && (
            <div className={`absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border shadow-xl z-50 ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white text-black'}`}>
              {filteredBranches.map((b) => (<div key={b.id} onClick={() => handleSelectBranchItem(b)} className="p-2.5 text-xs font-semibold cursor-pointer border-b hover:bg-stone-100 dark:hover:bg-neutral-800">🏢 {b.branch_name}</div>))}
            </div>
          )}
        </div>
      </div>
      <div className={`grid grid-cols-3 gap-3 p-3 rounded-xl border text-xs font-bold ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-stone-50 text-black'}`}>
        <div><span className="opacity-60 block text-[10px]">TOTAL BUDGET:</span><span className="text-blue-500 text-sm">Rp{Number(customBudget).toLocaleString()}</span></div>
        <div><span className="opacity-60 block text-[10px]">TOTAL TERPAKAI:</span><span className="text-amber-500 text-sm">Rp{totalUsedBudget.toLocaleString()}</span></div>
        <div><span className="opacity-60 block text-[10px]">SISA BUDGET:</span><span className={`text-sm ${remainingBudget < 0 ? 'text-rose-500 font-black' : 'text-emerald-500'}`}>Rp{remainingBudget.toLocaleString()}</span></div>
      </div>
      <div className={`max-h-[60vh] overflow-y-auto rounded-xl border shadow-sm ${isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white border-[#D8D2C2]'}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-20 font-bold shadow-sm ${isDarkMode ? 'bg-neutral-900 text-neutral-300 border-b border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-b border-[#D8D2C2]'}`}>
            <tr>
              <th className="p-3 w-12 text-center">No</th>
              <th className="p-3 cursor-pointer" onClick={() => setSortAscending(!sortAscending)}>Nama Item {sortAscending ? '🠅' : '🠇'}</th>
              <th className="p-3">Material</th>
              <th className="p-3">Ukuran</th>
              <th className="p-3">Harga</th>
              <th className="p-3 w-28 text-center">Qty</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800 text-white' : 'divide-stone-200 text-black'}`}>
            {sortedMasterItems.map((item, index) => (
              <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-[#F8F6F0]'}>
                <td className="p-3 text-center">{index + 1}</td>
                <td className="p-3 font-bold text-indigo-500">{item.item_name}</td>
                <td className="p-3">{item.material}</td>
                <td className="p-3">{item.size}</td>
                <td className="p-3 font-semibold">Rp{Number(item.price || 0).toLocaleString()}</td>
                <td className="p-3"><input type="number" min="0" disabled={isFormLocked || !selectedBranch} value={quantities[item.id] || ''} onChange={(e) => handleQtyChange(item.id, e.target.value, item.price)} className={`w-full p-1.5 border rounded-lg text-xs text-center font-bold ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white text-black'}`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end items-center gap-3 pt-2">
        {orderStatus === 'SUBMITTED' && <button onClick={handleRequestRevision} disabled={loading} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-600 text-white">🔒 Minta Revisi</button>}
        {orderStatus === 'REVISION_REQUESTED' && <span className="text-xs font-bold text-amber-500">⏳ Menunggu ACC Admin...</span>}
        {(orderStatus === 'DRAFT' || orderStatus === 'REVISION_ALLOWED') && <button onClick={handleSubmitOrder} disabled={loading || !selectedBranch || remainingBudget < 0} className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white ${!selectedBranch || remainingBudget < 0 ? 'bg-stone-400' : 'bg-emerald-600'}`}>🚀 Submit Order</button>}
      </div>
    </div>
  );
}

/* ==========================================
   TAB LABEL & SURAT JALAN
========================================== */
function LabelGeneratorTab({ isDarkMode, onOpenImageModal }) {
  const [labelData, setLabelData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [headerLogoUrl, setHeaderLogoUrl] = useState(() => localStorage.getItem('wellen_header_logo') || '');

  const handleUploadHeaderLogo = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (evt) => { setHeaderLogoUrl(evt.target.result); localStorage.setItem('wellen_header_logo', evt.target.result); alert('✅ Logo KOP diunggah!'); }; reader.readAsDataURL(file);
  };
  const handleExcelImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' }); const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rawData.length) return alert('❌ Excel kosong!');
        const cleanedData = rawData.map(row => ({
          NO_SPK: String(row.NO_SPK || row['No SPK'] || '').trim(), PO_NUMBER: String(row.PO_NUMBER || '').trim(), NO_SJ: String(row.NO_SJ || `WL-${Math.floor(10+Math.random()*90)}`).trim(),
          CLIENT: String(row.CLIENT || row.COMPANY || '').trim(), BRAND: String(row.BRAND || '').trim(), RECIPIENT_NAME: String(row.RECIPIENT_NAME || '').trim(), DELIVERY_ADDRESS: String(row.DELIVERY_ADDRESS || '').trim(),
          ITEM_DESCRIPTION: String(row.ITEM_DESCRIPTION || '').trim(), QTY_TOTAL: Number(String(row.QTY_TOTAL || row['Qty Total'] || 0).replace(/[^0-9]/g, '')) || 0, QTY_PER_KOLI: Number(String(row.QTY_PER_KOLI || 20).replace(/[^0-9]/g, '')) || 20, SENDER: "WELLEN PRINT", VISUAL_IMAGE: row.VISUAL_IMAGE || ''
        }));
        setLabelData(cleanedData); setSelectedRows([]); alert(`✅ Sukses Import ${cleanedData.length} baris!`);
      } catch (err) { alert('Error: ' + err.message); }
    }; reader.readAsBinaryString(file); e.target.value = '';
  };
  const handlePrintLabels = async () => {
    if (!selectedRows.length) return alert('⚠️ Pilih data!');
    const items = labelData.filter((_, i) => selectedRows.includes(i));
    const pagesHtml = await Promise.all(items.map(async (item) => {
      const totalKoli = Math.ceil(item.QTY_TOTAL / item.QTY_PER_KOLI) || 1;
      let htmls = [];
      for (let k = 1; k <= totalKoli; k++) {
        let qr = ''; try { qr = await QRCode.toDataURL(`SPK:${item.NO_SPK}|KOLI:${k}/${totalKoli}`, { width: 120, margin: 1 }); } catch (e) {}
        htmls.push(`<div class="label-page"><div class="label-box"><table class="header-table"><tr><td style="width:25%;">${headerLogoUrl ? `<img src="${headerLogoUrl}" style="height:65px;">` : 'WELLEN PRINT'}</td><td style="text-align:center;"><strong style="font-size:13px;">PT. WELLEN PRINT</strong></td><td style="width:20%; text-align:right;">${qr ? `<img src="${qr}" style="width:65px;">` : ''}</td></tr></table><div class="content-grid"><div class="grid-box"><strong>SENDER:</strong> ${item.SENDER}</div><div class="grid-box"><strong>CLIENT:</strong> ${item.CLIENT}</div><div class="grid-box"><strong>NO. SPK:</strong> ${item.NO_SPK}<br><strong>QTY:</strong> ${item.QTY_PER_KOLI} PCS</div><div class="grid-box visual-box"><div class="koli-title">${k} OF ${totalKoli}</div></div></div></div></div>`);
      } return htmls.join('');
    }));
    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`<html><head><style>body{font-family:Arial;margin:0;}.label-page{width:210mm;height:148mm;padding:5mm;box-sizing:border-box;page-break-after:always;}.label-box{border:2px solid #000;height:100%;display:flex;flex-direction:column;}.header-table{width:100%;border-bottom:2px solid #000;}.header-table td{padding:6px;}.content-grid{display:grid;grid-template-columns:1fr 1fr;flex-grow:1;}.grid-box{border-right:1px solid #000;border-bottom:1px solid #000;padding:6px;font-size:11px;}.visual-box{text-align:center;}.koli-title{font-size:20px;font-weight:bold;}</style></head><body>${pagesHtml.join('')}</body></html>`);
    printWin.document.close(); setTimeout(() => printWin.print(), 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4"><label className="px-4 py-2 bg-blue-600 text-white rounded cursor-pointer">📂 Import Excel Label & SJ <input type="file" accept=".xlsx" onChange={handleExcelImport} className="hidden" /></label> <label className="px-4 py-2 bg-purple-600 text-white rounded cursor-pointer">🖼️ Upload Logo KOP <input type="file" accept="image/*" onChange={handleUploadHeaderLogo} className="hidden" /></label> <button onClick={handlePrintLabels} disabled={!selectedRows.length} className="px-4 py-2 bg-indigo-600 text-white rounded">🏷️ Cetak Label ({selectedRows.length})</button></div>
      <div className="overflow-x-auto rounded border bg-white dark:bg-neutral-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-100 dark:bg-neutral-900"><tr><th className="p-3"><input type="checkbox" onChange={() => setSelectedRows(selectedRows.length === labelData.length ? [] : labelData.map((_, i) => i))} /></th><th className="p-3">SPK</th><th className="p-3">Client</th><th className="p-3">Item</th><th className="p-3">Qty</th></tr></thead>
          <tbody>{labelData.map((r, i) => (<tr key={i}><td className="p-3"><input type="checkbox" checked={selectedRows.includes(i)} onChange={() => setSelectedRows(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])} /></td><td className="p-3 text-blue-500 font-bold">{r.NO_SPK}</td><td className="p-3">{r.CLIENT}</td><td className="p-3">{r.ITEM_DESCRIPTION}</td><td className="p-3">{r.QTY_TOTAL}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   KOMPONEN UTAMA APP
   ========================================================= */
export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isBranchMode = searchParams.get('mode') === 'cabang';

  const [spkList, setSpkList] = useState([]);
  const [activeTab, setActiveTab] = useState(isBranchMode ? 'kawan_lama' : 'dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);

  // State Modal Preview Gambar
  const [modalImageInfo, setModalImageModalInfo] = useState({ isOpen: false, url: '', title: '' });

  // State Modal Link Google Sheet
  const [showGSheetModal, setShowGSheetModal] = useState(false);
  const [gSheetUrl, setGSheetUrl] = useState('');
  const [importingGSheet, setImportingGSheet] = useState(false);

  // State Modal Scanner & Input Manual
  const [showScanModal, setShowScanModal] = useState(false);
  const [inputMode, setInputMode] = useState('scan');
  const [scanTargetColumn, setScanTargetColumn] = useState('qc_checker');
  const [qcStaffName, setQcStaffName] = useState(STAFF_QC_LIST[2]);
  const [scannedInput, setScannedInput] = useState('');
  const [lastScanMessage, setLastScanMessage] = useState('');

  // State Form Panel Finishing
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({ finishing_type: 'inhouse', sub_vendor_name: '', qty_finish_sub_out: 0, qty_finish: 0 });

  // Login States
  const [currentAdmin, setCurrentAdmin] = useState(() => { const s = localStorage.getItem('kl_admin_session'); return s ? JSON.parse(s) : null; });
  const [currentBranch, setCurrentBranch] = useState(() => { const s = localStorage.getItem('kl_branch_session'); return s ? JSON.parse(s) : null; });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showBranchLoginModal, setShowBranchLoginModal] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // Trigger login jika masuk via link cabang tapi belum login
  useEffect(() => {
    if (isBranchMode && !currentBranch) setShowBranchLoginModal(true);
  }, [isBranchMode, currentBranch]);

  useEffect(() => { fetchSpkData(); }, []);

  const openImageModal = (url, title) => { if (url) setModalImageModalInfo({ isOpen: true, url, title: title || 'Preview' }); };
  const closeImageModal = () => setModalImageModalInfo({ isOpen: false, url: '', title: '' });
  const toggleTheme = () => setIsDarkMode(prev => { localStorage.setItem('theme', !prev ? 'dark' : 'light'); return !prev; });

  const fetchSpkData = async () => {
    const { data } = await supabase.from('spk_data').select('*').order('id', { ascending: false });
    if (data) {
      setSpkList(data);
      if (data.length > 0 && !selectedSpkId) initFinishingForm(data[0]);
    }
  };

  const initFinishingForm = (item) => {
    if (!item) return;
    setSelectedSpkId(item.id);
    setFinishingForm({ finishing_type: item.finishing_type || 'inhouse', sub_vendor_name: item.sub_vendor_name || '', qty_finish_sub_out: item.qty_finish_sub_out || 0, qty_finish: item.qty_finish || 0 });
  };

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId);
    const item = spkList.find(s => String(s.id) === String(spkId));
    if (item) setFinishingForm({ finishing_type: item.finishing_type || 'inhouse', sub_vendor_name: item.sub_vendor_name || '', qty_finish_sub_out: item.qty_finish_sub_out || 0, qty_finish: item.qty_finish || 0 });
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds(prev => {
      const exist = prev.includes(id);
      if (!exist) handleSelectSpk(id);
      return exist ? prev.filter(item => item !== id) : [...prev, id];
    });
  };

  const handleToggleSelectAll = (filteredItems) => {
    if (selectedSpkIds.length === filteredItems.length && filteredItems.length > 0) setSelectedSpkIds([]);
    else { setSelectedSpkIds(filteredItems.map(item => item.id)); if (filteredItems.length > 0) handleSelectSpk(filteredItems[0].id); }
  };

  const handleUpdateField = async (id, payload) => {
    const { error } = await supabase.from('spk_data').update(payload).eq('id', id);
    if (!error) setSpkList(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
    else alert('Gagal memperbarui data: ' + error.message);
  };

  const handleUpdateQty = async (id, field, value, maxAllowed, customErrorMessage) => {
    const val = Number(value) || 0;
    if (val > maxAllowed) return alert(customErrorMessage || `❌ Gagal: Jumlah tidak boleh melebihi ${maxAllowed.toLocaleString()} pcs!`);
    handleUpdateField(id, { [field]: val });
  };

  const handleProcessScan = async (codeValue) => {
    if (!codeValue) return;
    const cleanCode = codeValue.toString().replace(/[\r\n]+/g, '').trim().toLowerCase();
    const targetItem = spkList.find(item => (item.qr_address||'').toLowerCase().includes(cleanCode) || (item.store_code||'').toLowerCase() === cleanCode || (item.no_spk||'').toLowerCase().includes(cleanCode) || (item.project||'').toLowerCase().includes(cleanCode));
    if (!targetItem) { setLastScanMessage(`❌ SPK "${cleanCode}" tidak ditemukan!`); setScannedInput(''); return; }
    
    const updaterValue = qcStaffName ? `${qcStaffName} (OK)` : 'VERIFIED (OK)';
    let updatePayload = { tes_scan: updaterValue };
    if (scanTargetColumn === 'qc_paking') updatePayload.qc_paking = updaterValue;
    if (scanTargetColumn === 'qc_checker') updatePayload.qc_checker = updaterValue;
    if (scanTargetColumn === 'qc_deliver') updatePayload.qc_deliver = updaterValue;
    if (scanTargetColumn === 'qty_finish') updatePayload.qty_finish = targetItem.qty_order;

    await handleUpdateField(targetItem.id, updatePayload);
    setLastScanMessage(`✅ SUKSES UPDATE SPK ${targetItem.no_spk}!`); setScannedInput('');
  };

  const handleSubmitInput = (e) => { e.preventDefault(); handleProcessScan(scannedInput); };

  const handleBatchPrint = async () => {
    const items = spkList.filter(item => selectedSpkIds.includes(item.id));
    if (items.length === 0) return alert('⚠️ Centang minimal 1 SPK!');
    const html = items.map(item => `<div style="page-break-after:always; padding:20px; font-family:Arial; border:2px solid #000;"><h2>STORE: ${item.project}</h2><p>SPK: ${item.no_spk}</p></div>`).join('');
    const pw = window.open('', '_blank', 'width=800,height=800'); pw.document.write(`<html><body>${html}</body></html>`); pw.document.close(); setTimeout(() => pw.print(), 500);
  };

  const handleUploadSuratJalan = async (e, item) => {
    const file = e.target.files[0]; if (!file) return;
    const fileName = `sj_${item.no_spk}_${Date.now()}`;
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      handleUpdateField(item.id, { surat_jalan_url: data.publicUrl });
      alert('Surat Jalan Diunggah!');
    }
  };

  const processImportData = async (rawData) => {
    const formattedData = rawData.filter(row => row['Store Name'] || row['Nama Project'] || row['COMPANY']).map(row => ({
      no_spk: String(row['SPK/WPP'] || row['No SPK'] || '-').split('/')[0].trim(),
      client: String(row['COMPANY'] || row['Nama Klient'] || '-'),
      project: String(row['Store Name'] || row['Nama Project'] || '-'),
      bahan: String(row['Nama Bahan'] || 'Art Paper'),
      ukuran: String(row['Ukuran'] || 'A5'),
      qty_order: Number(row['TOTAL QTY ORDER'] || 40),
      qty_print: 0, qty_finish: 0, qty_pack: 0, qty_ship: 0,
      store_code: String(row['NO. STORE'] || '-'), delivery_route: String(row['DELIVERY'] || 'DALAM KOTA')
    }));
    if (formattedData.length > 0) {
      await supabase.from('spk_data').insert(formattedData);
      alert(`✅ Sukses Import ${formattedData.length} SPK`); fetchSpkData();
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 2 });
      await processImportData(rawData);
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));
  const getStatusBadge = (p) => p >= 100 ? { text: 'text-green-800 bg-green-100', icon: '🟢' } : p > 0 ? { text: 'text-yellow-800 bg-yellow-100', icon: '🟡' } : { text: 'text-red-800 bg-red-100', icon: '🔴' };

  const totalSpk = spkList.length;
  const totalOrderPcs = spkList.reduce((acc, curr) => acc + (Number(curr.qty_order) || 0), 0);
  const displayedList = spkList.filter(item => (item.no_spk||'').toLowerCase().includes(searchTerm.toLowerCase()) || (item.project||'').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`min-h-screen p-4 font-sans ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-gray-50 text-black'}`}>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* HEADER */}
        <div className={`flex justify-between items-center p-4 rounded-xl border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white'}`}>
          <div><h1 className="text-xl font-bold text-blue-500">{isBranchMode ? 'FORM CABANG KAWAN LAMA' : 'WEB-TRACK ADMIN'}</h1></div>
          <div className="flex gap-2">
            <button onClick={toggleTheme} className="px-3 py-1.5 border rounded text-xs font-bold">Tema</button>
            {!isBranchMode && (currentAdmin ? <button onClick={() => {localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard');}} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold">Logout Admin</button> : <button onClick={() => setShowAdminLoginModal(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold">Login Admin</button>)}
            {isBranchMode && currentBranch && <button onClick={() => {localStorage.removeItem('kl_branch_session'); setCurrentBranch(null);}} className="px-3 py-1.5 bg-rose-600 text-white rounded text-xs font-bold">Logout Cabang</button>}
            {!isBranchMode && <button onClick={() => setShowScanModal(true)} className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-bold">📷 Scan QC</button>}
            {!isBranchMode && <label className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer">📁 Upload SPK<input type="file" accept=".xlsx" onChange={handleExcelUpload} className="hidden" /></label>}
          </div>
        </div>

        {/* TABS (Admin Only) */}
        {!isBranchMode && (
          <div className="flex gap-2 border-b pb-2 overflow-x-auto">
            {['dashboard', 'produksi', 'finishing', 'paking', 'pengiriman', 'label', 'kawan_lama'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded text-xs font-bold capitalize ${activeTab === t ? 'bg-blue-600 text-white' : 'border'}`}>{t.replace('_', ' ')}</button>
            ))}
          </div>
        )}

        {/* ADMIN DASHBOARD PANELS */}
        {!isBranchMode && activeTab === 'dashboard' && (
          <div className="grid grid-cols-4 gap-4">
            <CircularGaugeCard title="Total SPK" percent={100} color="blue" detailText={`${totalSpk} Data Aktif`} />
            <CircularGaugeCard title="Produksi" percent={80} color="orange" detailText="Print & Finish" />
            <CircularGaugeCard title="Paking" percent={60} color="purple" detailText="Siap Kirim" />
            <CircularGaugeCard title="Terkirim" percent={40} color="green" detailText="Delivery Done" />
          </div>
        )}

        {/* TAB KAWAN LAMA */}
        {(isBranchMode || activeTab === 'kawan_lama') && (
          <KawanLamaTab 
            isDarkMode={isDarkMode} 
            currentUser={isBranchMode ? currentBranch : currentAdmin} 
            isBranchMode={isBranchMode} 
          />
        )}
        
        {/* TAB CETAK LABEL */}
        {!isBranchMode && activeTab === 'label' && <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />}

        {/* TRACKING TABLE FULL (Admin Tab) */}
        {!isBranchMode && activeTab !== 'label' && activeTab !== 'kawan_lama' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 rounded-xl border bg-white dark:bg-neutral-800">
              <input type="text" placeholder="Cari SPK / Cabang..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="p-2 border rounded text-xs w-64 text-black" />
              <button onClick={handleBatchPrint} className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold">🖨️ Cetak {selectedSpkIds.length} Form</button>
            </div>

            <div className="overflow-x-auto rounded-xl border bg-white dark:bg-neutral-900 shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-neutral-800">
                  <tr>
                    <th className="p-3"><input type="checkbox" checked={spkList.length>0 && selectedSpkIds.length === spkList.length} onChange={() => handleToggleSelectAll(spkList)} /></th>
                    <th className="p-3">SPK & Info</th>
                    <th className="p-3">Print</th>
                    <th className="p-3">Finish</th>
                    <th className="p-3">Paking & Foto</th>
                    <th className="p-3">QC Check</th>
                    <th className="p-3">Ship & Surat Jalan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-700">
                  {displayedList.map(i => {
                    const pPrint = getPercent(i.qty_print, i.qty_order); const pFinish = getPercent(i.qty_finish, i.qty_order); const pPack = getPercent(i.qty_pack, i.qty_order); const pShip = getPercent(i.qty_ship, i.qty_order);
                    return (
                      <tr key={i.id} className={selectedSpkIds.includes(i.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''}>
                        <td className="p-3"><input type="checkbox" checked={selectedSpkIds.includes(i.id)} onChange={() => handleToggleCheck(i.id)} /></td>
                        <td className="p-3"><strong>{i.no_spk}</strong><br/>{i.client} - {i.project}<br/><span className="opacity-70">Order: {i.qty_order}</span></td>
                        <td className="p-3"><span className={`px-2 py-1 rounded font-bold ${getStatusBadge(pPrint).text}`}>{pPrint}%</span><br/>{activeTab==='produksi' && <input type="number" value={i.qty_print||0} onChange={e=>handleUpdateQty(i.id, 'qty_print', e.target.value, i.qty_order)} className="mt-1 w-16 border text-black p-1" />}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded font-bold ${getStatusBadge(pFinish).text}`}>{pFinish}%</span><br/>{activeTab==='finishing' && <input type="number" value={i.qty_finish||0} onChange={e=>handleUpdateQty(i.id, 'qty_finish', e.target.value, i.qty_order)} className="mt-1 w-16 border text-black p-1" />}</td>
                        <td className="p-3"><span className={`px-2 py-1 rounded font-bold ${getStatusBadge(pPack).text}`}>{pPack}%</span><br/>{activeTab==='paking' && <div><input type="number" value={i.qty_pack||0} onChange={e=>handleUpdateQty(i.id, 'qty_pack', e.target.value, i.qty_finish)} className="my-1 w-16 border text-black p-1 block" /><label className="px-2 bg-stone-200 text-black rounded text-[10px] cursor-pointer">Foto<input type="file" accept="image/*" onChange={e => {const f=e.target.files[0]; if(f){const r=new FileReader(); r.onload=ev=>handleUpdateField(i.id, {packing_visual_url: ev.target.result}); r.readAsDataURL(f);}}} className="hidden" /></label></div>}</td>
                        <td className="p-3 space-y-1"><select value={i.qc_checker||''} onChange={e=>handleUpdateField(i.id, {qc_checker: e.target.value})} className="block w-full border text-black p-1 text-[10px]"><option value="">-QC Check-</option>{STAFF_QC_LIST.map(s=><option key={s}>{s}</option>)}</select></td>
                        <td className="p-3"><span className={`px-2 py-1 rounded font-bold ${getStatusBadge(pShip).text}`}>{pShip}%</span><br/>{activeTab==='pengiriman' && <div><input type="number" value={i.qty_ship||0} onChange={e=>handleUpdateQty(i.id, 'qty_ship', e.target.value, i.qty_pack)} className="my-1 w-16 border text-black p-1 block" /><label className="px-2 bg-stone-200 text-black rounded text-[10px] cursor-pointer">SJ+<input type="file" onChange={e=>handleUploadSuratJalan(e, i)} className="hidden"/></label></div>}{i.surat_jalan_url && <a href={i.surat_jalan_url} target="_blank" className="text-blue-500 text-[10px] block mt-1">Cek SJ</a>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SCAN MODAL */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
          <div className="w-full max-w-sm p-6 bg-white dark:bg-neutral-800 rounded-3xl">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold">📷 Scan QC</h3><button onClick={()=>setShowScanModal(false)}>✕</button></div>
            <form onSubmit={handleSubmitInput} className="space-y-4">
              <select value={scanTargetColumn} onChange={e=>setScanTargetColumn(e.target.value)} className="w-full p-2 border text-black rounded"><option value="qc_checker">QC Checker</option><option value="qc_paking">QC Paking</option><option value="qty_finish">Auto Finish</option></select>
              <input type="text" autoFocus placeholder="Scan Barcode SPK..." value={scannedInput} onChange={e=>setScannedInput(e.target.value)} className="w-full p-3 border rounded font-mono text-black text-center" />
              <button type="submit" className="w-full py-3 bg-purple-600 text-white font-bold rounded">Proses Scan</button>
            </form>
            {lastScanMessage && <div className="mt-3 p-2 bg-stone-100 text-black text-center text-xs font-bold rounded">{lastScanMessage}</div>}
          </div>
        </div>
      )}

      {/* PREVIEW GAMBAR MODAL */}
      {modalImageInfo.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]" onClick={closeImageModal}>
          <img src={modalImageInfo.url} alt="Preview" className="max-w-[90%] max-h-[90%] object-contain" />
        </div>
      )}

      <AdminLoginModal isOpen={showAdminLoginModal} onClose={() => setShowAdminLoginModal(false)} onLoginSuccess={(admin) => { setCurrentAdmin(admin); setShowAdminLoginModal(false); }} />
      <BranchLoginModal isOpen={showBranchLoginModal} onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} />
    </div>
  );
}