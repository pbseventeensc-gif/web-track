import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function KawanLamaTab({ isDarkMode, currentUser, isBranchMode }) {
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
      setBranchSearch(currentUser.branch_name);
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
      setActiveOrder(orderData);
      setOrderStatus(orderData.status);
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

  const handleSelectBranchItem = (branch) => {
    setSelectedBranch(branch.id);
    setBranchSearch(branch.branch_name);
    setIsDropdownOpen(false);
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
    if (!selectedBranch) return alert('⚠️ Silakan pilih kantor cabang!');
    if (!promoName.trim()) return alert('⚠️ Silakan isi Nama Promo!');
    if (remainingBudget < 0) return alert('❌ Qty melebihi total Budget');
    const itemsToInsert = masterItems.filter(item => (quantities[item.id] || 0) > 0).map(item => ({ item_id: item.id, qty: quantities[item.id], subtotal: quantities[item.id] * (item.price || 0) }));
    if (itemsToInsert.length === 0) return alert('⚠️ Silakan isi Qty minimal 1 item!');
    setLoading(true);
    const { data: order, error: orderErr } = await supabase.from('kl_orders').insert([{ project_name: promoName, branch_id: selectedBranch, total_budget: Number(customBudget) || 0, status: 'SUBMITTED' }]).select().single();
    if (orderErr) { setLoading(false); return alert('❌ Gagal: ' + orderErr.message); }
    const detailPayload = itemsToInsert.map(item => ({ ...item, order_id: order.id }));
    const { error: itemErr } = await supabase.from('kl_order_items').insert(detailPayload);
    setLoading(false);
    if (itemErr) alert('❌ Gagal detail: ' + itemErr.message);
    else { alert('✅ Order di-submit!'); setOrderStatus('SUBMITTED'); setActiveOrder(order); }
  };

  const handleRequestRevision = async () => {
    if (!activeOrder) return;
    setLoading(true);
    const { error } = await supabase.from('kl_orders').update({ status: 'REVISION_REQUESTED' }).eq('id', activeOrder.id);
    setLoading(false);
    if (error) alert('Gagal permohonan revisi: ' + error.message);
    else { alert('✅ Permohonan dikirim!'); setOrderStatus('REVISION_REQUESTED'); }
  };

  const isFormLocked = orderStatus === 'SUBMITTED' || orderStatus === 'REVISION_REQUESTED';
  const filteredBranches = branches.filter(b => b.branch_name.toLowerCase().includes(branchSearch.toLowerCase()));
  const sortedMasterItems = [...masterItems].sort((a, b) => sortAscending ? a.item_name.localeCompare(b.item_name) : b.item_name.localeCompare(a.item_name));

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