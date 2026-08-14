import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient'; // Pastikan path ini benar (titik dua '../' karena file ini ada di dalam folder components)

export default function KawanLamaTab({ isDarkMode, currentUser, isBranchMode })  {
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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // PROTEKSI: Cek apakah currentUser benar-benar ada sebelum membaca role
    if (isBranchMode && currentUser && currentUser?.role === 'branch') {
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

  const handleProjectTypeChange = (type) => {
    setProjectType(type);
    if (type === 'Project A') setCustomBudget(5000000);
    else if (type === 'Project B') setCustomBudget(3500000);
    else if (type === 'Project C') setCustomBudget(2500000);
  };

  const handleSelectBranchItem = async (branch) => {
    setSelectedBranch(branch.id);
    setBranchSearch(branch.branch_name || '');
    setIsDropdownOpen(false);

    setLoading(true);
    const { data: orderData } = await supabase
      .from('kl_orders')
      .select('*, kl_order_items(*)')
      .eq('branch_id', branch.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderData) {
      setActiveOrder(orderData);
      setOrderStatus(orderData.status);
      if (orderData.project_name) setPromoName(orderData.project_name);
      if (orderData.total_budget) setCustomBudget(Number(orderData.total_budget));

      let initialQty = {};
      if (orderData.kl_order_items) {
        orderData.kl_order_items.forEach(item => {
          initialQty[item.item_id] = item.qty;
        });
      }
      setQuantities(initialQty);
    } else {
      setActiveOrder(null);
      setOrderStatus('DRAFT');
      setQuantities({});
    }
    setLoading(false);
  };

  const totalUsedBudget = masterItems.reduce((acc, item) => {
    const qty = quantities[item.id] || 0;
    return acc + (qty * (item.price || 0));
  }, 0);

  const remainingBudget = (Number(customBudget) || 0) - totalUsedBudget;

  const handleQtyChange = (itemId, val, itemPrice) => {
    const newQty = Number(val) || 0;
    const oldQty = quantities[itemId] || 0;
    const price = Number(itemPrice) || 0;

    const estimatedUsedBudget = totalUsedBudget - (oldQty * price) + (newQty * price);
    const maxBudget = Number(customBudget) || 0;

    if (estimatedUsedBudget > maxBudget) {
      alert(`❌ Qty tidak bisa ditambahkan, melebihi total Budget`);
      return;
    }

    setQuantities(prev => ({
      ...prev,
      [itemId]: newQty
    }));
  };

  const handleBroadcastPromo = async () => {
    if (!promoName.trim()) return alert('⚠️ Silakan isi Nama Promo!');
    
    if (!confirm(`📢 Apakah Anda yakin ingin membagikan Promo "${promoName}" dengan Budget Rp${Number(customBudget).toLocaleString()} ke SELURUH KANTOR CABANG?`)) {
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ 
        project_name: promoName,
        total_budget: Number(customBudget) || 0 
      })
      .eq('status', 'DRAFT');
    setLoading(false);

    if (error) {
      alert('Gagal membagikan promo: ' + error.message);
    } else {
      alert(`✅ SUKSES! Promo "${promoName}" telah dibagikan dan akan otomatis aktif di seluruh cabang.`);
    }
  };

  const handleSubmitOrder = async () => {
    if (!selectedBranch) return alert('⚠️ Silakan pilih kantor cabang terlebih dahulu!');
    if (!promoName.trim()) return alert('⚠️ Silakan isi Nama Promo!');
    if (remainingBudget < 0) return alert('❌ Qty tidak bisa ditambahkan, melebihi total Budget');

    const itemsToInsert = masterItems
      .filter(item => (quantities[item.id] || 0) > 0)
      .map(item => ({
        item_id: item.id,
        qty: quantities[item.id],
        subtotal: quantities[item.id] * (item.price || 0)
      }));

    if (itemsToInsert.length === 0) return alert('⚠️ Silakan isi Qty minimal pada 1 item!');

    setLoading(true);
    const { data: order, error: orderErr } = await supabase
      .from('kl_orders')
      .insert([{
        project_name: promoName,
        branch_id: selectedBranch,
        total_budget: Number(customBudget) || 0,
        status: 'SUBMITTED'
      }])
      .select()
      .single();

    if (orderErr) {
      setLoading(false);
      return alert('❌ Gagal Submit Order: ' + orderErr.message);
    }

    const detailPayload = itemsToInsert.map(item => ({
      order_id: order.id,
      item_id: item.item_id,
      qty: item.qty,
      subtotal: item.subtotal
    }));

    const { error: itemErr } = await supabase.from('kl_order_items').insert(detailPayload);
    setLoading(false);

    if (itemErr) {
      alert('❌ Gagal menyimpan detail item: ' + itemErr.message);
    } else {
      alert('✅ Order berhasil di-submit dan dikunci!');
      setOrderStatus('SUBMITTED');
      setActiveOrder(order);
    }
  };

  const handleRequestRevision = async () => {
    if (!activeOrder) return;
    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ status: 'REVISION_REQUESTED' })
      .eq('id', activeOrder.id);
    setLoading(false);

    if (error) {
      alert('Gagal mengirimkan permohonan revisi: ' + error.message);
    } else {
      alert('✅ Permohonan revisi telah dikirim ke Admin!');
      setOrderStatus('REVISION_REQUESTED');
    }
  };

  const isFormLocked = orderStatus === 'SUBMITTED' || orderStatus === 'REVISION_REQUESTED';

  // ANTI-CRASH: Tambahkan perlindungan || '' agar tidak crash jika nama cabang kosong di database
  const filteredBranches = branches.filter(b => 
    (b.branch_name || '').toLowerCase().includes((branchSearch || '').toLowerCase())
  );

  // ANTI-CRASH: Tambahkan perlindungan || '' agar tidak crash jika nama item kosong di database
  const sortedMasterItems = [...masterItems].sort((a, b) => {
    const nameA = a.item_name || '';
    const nameB = b.item_name || '';
    if (sortAscending) return nameA.localeCompare(nameB);
    return nameB.localeCompare(nameA);
  });

  return (
    <div className={`p-5 rounded-2xl border space-y-4 shadow-sm ${
      isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-[#D8D2C2]'
    }`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-3 gap-3 border-stone-200 dark:border-neutral-700">
        <div>
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>🏢</span> Input Form Cabang - Project Kawan Lama
          </h3>
          <p className="text-xs opacity-70">Pengisian master item dinamis (Hanya item terisi yang disimpan)</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            orderStatus === 'SUBMITTED' ? 'bg-rose-100 text-rose-800' :
            orderStatus === 'REVISION_REQUESTED' ? 'bg-amber-100 text-amber-800' :
            orderStatus === 'REVISION_ALLOWED' ? 'bg-emerald-100 text-emerald-800' :
            'bg-stone-200 text-stone-800'
          }`}>
            {orderStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold opacity-80">🏷️ Nama Promo / Project:</label>
            {!isBranchMode && (
              <button
                onClick={handleBroadcastPromo}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                📢 Broadcast ke Cabang
              </button>
            )}
          </div>
          <input
            type="text"
            value={promoName}
            disabled={isFormLocked}
            onChange={(e) => setPromoName(e.target.value)}
            className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
              isFormLocked ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' : 
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
            }`}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold opacity-80">💰 Tipe Budget / Project:</label>
          <div className="flex gap-2">
            <select
              value={projectType}
              disabled={isFormLocked}
              onChange={(e) => handleProjectTypeChange(e.target.value)}
              className={`p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isFormLocked ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' : 
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
              }`}
            >
              <option value="Project A">Project A (Rp5.000.000)</option>
              <option value="Project B">Project B (Rp3.500.000)</option>
              <option value="Project C">Project C (Rp2.500.000)</option>
              <option value="Custom">Custom Budget</option>
            </select>
            <input
              type="number"
              value={customBudget}
              disabled={isFormLocked || projectType !== 'Custom'}
              onChange={(e) => setCustomBudget(Number(e.target.value) || 0)}
              className={`flex-1 p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isFormLocked || projectType !== 'Custom' ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' : 
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD]'
              }`}
            />
          </div>
        </div>

        <div className="space-y-1 relative" ref={dropdownRef}>
          <label className="block text-xs font-bold opacity-80">{isBranchMode ? '🔒 Cabang Anda:' : '🔍 Cari Cabang:'}</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ketik cabang..."
              value={branchSearch}
              disabled={isFormLocked || (isBranchMode && currentUser)}
              onChange={(e) => {
                setBranchSearch(e.target.value);
                setSelectedBranch('');
                setIsDropdownOpen(true);
              }}
              onFocus={() => !isBranchMode && setIsDropdownOpen(true)}
              className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isFormLocked || isBranchMode ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-80 text-indigo-600' : 
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
              }`}
            />

            {isDropdownOpen && !isFormLocked && !isBranchMode && (
              <div className={`absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border shadow-xl z-50 ${
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
              }`}>
                {filteredBranches.length === 0 ? (
                  <div className="p-3 text-xs opacity-60 text-center">Cabang tidak ditemukan</div>
                ) : (
                  filteredBranches.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBranchItem(b)}
                      className={`p-2.5 text-xs font-semibold cursor-pointer border-b last:border-none transition-colors ${
                        selectedBranch === b.id ? (isDarkMode ? 'bg-indigo-900/60 font-bold' : 'bg-indigo-50 font-bold text-indigo-700') : 
                        isDarkMode ? 'hover:bg-neutral-800' : 'hover:bg-[#F8F6F0]'
                      }`}
                    >
                      🏢 {b.branch_name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-3 gap-3 p-3 rounded-xl border text-xs font-bold ${
        isDarkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-stone-50 border-stone-200'
      }`}>
        <div>
          <span className="opacity-60 block text-[10px]">TOTAL BUDGET:</span>
          <span className="text-blue-600 text-sm">Rp{Number(customBudget).toLocaleString()}</span>
        </div>
        <div>
          <span className="opacity-60 block text-[10px]">TOTAL TERPAKAI:</span>
          <span className="text-amber-600 text-sm">Rp{totalUsedBudget.toLocaleString()}</span>
        </div>
        <div>
          <span className="opacity-60 block text-[10px]">SISA BUDGET:</span>
          <span className={`text-sm ${remainingBudget < 0 ? 'text-rose-600 font-black animate-pulse' : 'text-emerald-600'}`}>
            Rp{remainingBudget.toLocaleString()}
          </span>
        </div>
      </div>

      <div className={`max-h-[60vh] overflow-y-auto rounded-xl border shadow-sm ${
        isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white border-[#D8D2C2]'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-20 font-bold shadow-sm ${
            isDarkMode ? 'bg-neutral-900 text-neutral-300 border-b border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-b border-[#D8D2C2]'
          }`}>
            <tr>
              <th className="p-3 w-12 text-center">No</th>
              <th className="p-3 cursor-pointer" onClick={() => setSortAscending(!sortAscending)}>
                Nama Item {sortAscending ? '🔤 A-Z 🠅' : '🔤 Z-A 🠇'}
              </th>
              <th className="p-3">Material / Bahan</th>
              <th className="p-3">Ukuran</th>
              <th className="p-3">Harga Per PC</th>
              <th className="p-3 w-28 text-center">Qty Input</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
            {sortedMasterItems.map((item, index) => (
              <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'}>
                <td className="p-3 text-center opacity-60">{index + 1}</td>
                <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{item.item_name}</td>
                <td className="p-3">{item.material}</td>
                <td className="p-3">{item.size}</td>
                <td className="p-3 font-semibold">Rp{Number(item.price || 0).toLocaleString()}</td>
                <td className="p-3">
                  <input
                    type="number"
                    min="0"
                    disabled={isFormLocked || !selectedBranch}
                    value={quantities[item.id] || ''}
                    onChange={(e) => handleQtyChange(item.id, e.target.value, item.price)}
                    placeholder="0"
                    className={`w-full p-1.5 border rounded-lg text-xs text-center font-bold focus:outline-none ${
                      isFormLocked || !selectedBranch ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' : 
                      isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD]'
                    }`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end items-center gap-3 pt-2">
        {orderStatus === 'SUBMITTED' && (
          <button onClick={handleRequestRevision} disabled={loading} className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all active:scale-95">
            🔒 Form Dikunci - Klik Minta ACC Revisi
          </button>
        )}
        {orderStatus === 'REVISION_REQUESTED' && (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">⏳ Menunggu persetujuan Admin...</span>
        )}
        {(orderStatus === 'DRAFT' || orderStatus === 'REVISION_ALLOWED') && (
          <button onClick={handleSubmitOrder} disabled={loading || !selectedBranch || remainingBudget < 0} className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition-all active:scale-95 ${!selectedBranch || loading || remainingBudget < 0 ? 'bg-stone-400 cursor-not-allowed opacity-60' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
            {loading ? 'Submitting...' : '🚀 Submit Order & Kunci Data'}
          </button>
        )}
      </div>
    </div>
  );
}