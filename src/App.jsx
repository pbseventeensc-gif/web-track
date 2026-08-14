import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

// URL Google Apps Script milik Anda
const GOOGLE_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzh4DKAVUWYfGzzD90yc7Oy6oE0h1RfWYro0abbgFpSBEjNNoen1O1bu6vYtbe-CXLpuQ/exec";

// Daftar 6 Petugas QC
const STAFF_QC_LIST = [
  "Budi (QC Paking)",
  "Siti (QC Paking)",
  "Agus (QC Checker)",
  "Dewi (QC Checker)",
  "Eko (QC Deliver)",
  "Rian (QC Deliver)"
];

// FUNGSI GENERATE LOGO WELLEN PRINT BASE64
const createWellenLogoDataUrl = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  ctx.moveTo(10, 90);
  ctx.quadraticCurveTo(10, 50, 25, 45);
  ctx.lineTo(25, 90);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FF6600';
  ctx.beginPath();
  ctx.moveTo(30, 90);
  ctx.quadraticCurveTo(30, 30, 50, 22);
  ctx.lineTo(50, 90);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FF0000';
  ctx.beginPath();
  ctx.moveTo(55, 90);
  ctx.quadraticCurveTo(55, 10, 80, 2);
  ctx.lineTo(80, 90);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.fillText('WELLEN', 95, 52);

  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillText('P R I N T', 100, 80);

  return canvas.toDataURL('image/png');
};

function CircularGaugeCard({ title, percent, color, detailText }) {
  const strokeDasharray = 2 * Math.PI * 36;
  const strokeDashoffset = strokeDasharray - (percent / 100) * strokeDasharray;

  return (
    <div className="bg-white/80 dark:bg-neutral-800/80 p-5 rounded-3xl border border-[#D8D2C2] dark:border-neutral-700 flex flex-col items-center shadow-sm">
      <h4 className="text-[11px] font-bold uppercase tracking-wider opacity-70 mb-3">{title}</h4>
      
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke="currentColor"
            strokeWidth="7"
            className="text-stone-200 dark:text-neutral-700 fill-none"
          />
          <circle
            cx="40"
            cy="40"
            r="36"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="fill-none transition-all duration-700 ease-out"
          />
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
    if (currentUser && currentUser.role === 'branch') {
      setSelectedBranch(currentUser.branch_id);
      setBranchSearch(currentUser.branch_name);
      loadBranchOrder(currentUser.branch_id);
    }
  }, [currentUser]);

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
    const { data: orderData } = await supabase
      .from('kl_orders')
      .select('*, kl_order_items(*)')
      .eq('branch_id', branchId)
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
    
    if (!confirm(`📢 Bagikan Promo "${promoName}" (Budget Rp${Number(customBudget).toLocaleString()}) ke SELURUH CABANG?`)) {
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

    if (error) alert('Gagal membagikan promo: ' + error.message);
    else alert(`✅ Promo "${promoName}" berhasil dibagikan!`);
  };

  const handleSubmitOrder = async () => {
    if (!selectedBranch) return alert('⚠️ Silakan pilih kantor cabang terlebih dahulu!');
    if (!promoName.trim()) return alert('⚠️ Silakan isi Nama Promo!');

    if (remainingBudget < 0) {
      return alert('❌ Qty tidak bisa ditambahkan, melebihi total Budget');
    }

    const itemsToInsert = masterItems
      .filter(item => (quantities[item.id] || 0) > 0)
      .map(item => ({
        item_id: item.id,
        qty: quantities[item.id],
        subtotal: quantities[item.id] * (item.price || 0)
      }));

    if (itemsToInsert.length === 0) {
      return alert('⚠️ Silakan isi Qty minimal pada 1 item!');
    }

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

    if (error) alert('Gagal permohonan revisi: ' + error.message);
    else {
      alert('✅ Permohonan revisi telah dikirim ke Admin!');
      setOrderStatus('REVISION_REQUESTED');
    }
  };

  const isFormLocked = orderStatus === 'SUBMITTED' || orderStatus === 'REVISION_REQUESTED';
  const isBranchUser = isBranchMode || (currentUser && currentUser.role === 'branch');

  const filteredBranches = branches.filter(b => 
    b.branch_name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const sortedMasterItems = [...masterItems].sort((a, b) => {
    return sortAscending ? a.item_name.localeCompare(b.item_name) : b.item_name.localeCompare(a.item_name);
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
          <p className="text-xs opacity-70">
            {isBranchUser ? `Halaman Pengisian Cabang` : 'Akses Admin Operasional'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            orderStatus === 'SUBMITTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
            orderStatus === 'REVISION_REQUESTED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
            orderStatus === 'REVISION_ALLOWED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
            'bg-stone-200 text-stone-800 dark:bg-neutral-700 dark:text-neutral-300'
          }`}>
            {orderStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-bold opacity-80">🏷️ Nama Promo / Project:</label>
            {!isBranchUser && (
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
            placeholder="Contoh: PROMO TEMATIK AGUSTUS..."
            value={promoName}
            disabled={isFormLocked || isBranchUser}
            onChange={(e) => setPromoName(e.target.value)}
            className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
              isFormLocked || isBranchUser
                ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' 
                : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
            }`}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-bold opacity-80">💰 Tipe Budget / Project:</label>
          <div className="flex gap-2">
            <select
              value={projectType}
              disabled={isFormLocked || isBranchUser}
              onChange={(e) => handleProjectTypeChange(e.target.value)}
              className={`p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isFormLocked || isBranchUser
                  ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' 
                  : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
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
              disabled={isFormLocked || isBranchUser || projectType !== 'Custom'}
              onChange={(e) => setCustomBudget(Number(e.target.value) || 0)}
              className={`flex-1 p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isFormLocked || isBranchUser || projectType !== 'Custom'
                  ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60' 
                  : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD]'
              }`}
            />
          </div>
        </div>

        <div className="space-y-1 relative" ref={dropdownRef}>
          <label className="block text-xs font-bold opacity-80">🔍 Cari & Pilih Kantor Cabang:</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ketik cabang (Cibinong, Depok)..."
              value={branchSearch}
              disabled={isFormLocked}
              onChange={(e) => {
                setBranchSearch(e.target.value);
                setSelectedBranch('');
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none ${
                isFormLocked 
                  ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-80 text-indigo-600 dark:text-indigo-400' 
                  : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
              }`}
            />

            {isDropdownOpen && !isFormLocked && (
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
                        selectedBranch === b.id
                          ? isDarkMode ? 'bg-indigo-900/60 font-bold' : 'bg-indigo-50 font-bold text-indigo-700'
                          : isDarkMode ? 'hover:bg-neutral-800 border-neutral-800' : 'hover:bg-[#F8F6F0] border-stone-100'
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
          <span className="text-blue-600 dark:text-blue-400 text-sm">Rp{Number(customBudget).toLocaleString()}</span>
        </div>
        <div>
          <span className="opacity-60 block text-[10px]">TOTAL TERPAKAI:</span>
          <span className="text-amber-600 dark:text-amber-400 text-sm">Rp{totalUsedBudget.toLocaleString()}</span>
        </div>
        <div>
          <span className="opacity-60 block text-[10px]">SISA BUDGET:</span>
          <span className={`text-sm ${remainingBudget < 0 ? 'text-rose-600 font-black animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
              <th 
                className="p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                onClick={() => setSortAscending(!sortAscending)}
              >
                <div className="flex items-center gap-1.5">
                  <span>Nama Item</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                    {sortAscending ? '🔤 A-Z 🠅' : '🔤 Z-A 🠇'}
                  </span>
                </div>
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
                      isFormLocked || !selectedBranch
                        ? 'bg-stone-100 dark:bg-neutral-800 cursor-not-allowed opacity-60'
                        : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD]'
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
          <button
            onClick={handleRequestRevision}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all active:scale-95"
          >
            🔒 Form Dikunci - Klik Minta ACC Revisi Admin
          </button>
        )}

        {orderStatus === 'REVISION_REQUESTED' && (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
            ⏳ Permohonan revisi telah dikirim. Menunggu persetujuan Admin...
          </span>
        )}

        {(orderStatus === 'DRAFT' || orderStatus === 'REVISION_ALLOWED') && (
          <button
            onClick={handleSubmitOrder}
            disabled={loading || !selectedBranch || remainingBudget < 0}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm transition-all active:scale-95 ${
              !selectedBranch || loading || remainingBudget < 0
                ? 'bg-stone-400 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {loading ? 'Submitting...' : '🚀 Submit Order & Kunci Data'}
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   KOMPONEN TAB: CETAK LABEL & SURAT JALAN (LENGKAP 100%)
   ========================================================= */
function LabelGeneratorTab({ isDarkMode, onOpenImageModal }) {
  const [labelData, setLabelData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [headerLogoUrl, setHeaderLogoUrl] = useState(() => {
    return localStorage.getItem('wellen_header_logo') || '';
  });

  const handleUploadHeaderLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Logo = evt.target.result;
      setHeaderLogoUrl(base64Logo);
      localStorage.setItem('wellen_header_logo', base64Logo);
      alert('✅ Logo Header KOP berhasil diunggah!');
    };
    reader.readAsDataURL(file);
  };

  const handleResetHeaderLogo = () => {
    if (confirm('Hapus logo header custom?')) {
      setHeaderLogoUrl('');
      localStorage.removeItem('wellen_header_logo');
    }
  };

  const handleDownloadTemplate = () => {
    const templateSampleData = [
      {
        NO_SPK: "SPK-0826-00101",
        PO_NUMBER: "4500122101",
        NO_SJ: "WL-26-88-01",
        CLIENT: "PT TRI SAKTI PURWOSARI MAKMUR",
        BRAND: "Production Sunscreen Juara Intens",
        RECIPIENT_NAME: "Pak Pajri Hidayah",
        RECIPIENT_PHONE: "0838-3041-0548",
        DELIVERY_ADDRESS: "Management Support (DC Marunda) JL. Kebantenan IV No. 15, Semper Timur, Cilincing, JAKARTA UTARA 14130",
        ITEM_DESCRIPTION: "SUNSCREEN BANNER",
        MEDIA: "FLEXY CINA 280 GR",
        UKURAN: "2 X 0.75 M",
        QTY_TOTAL: 300,
        QTY_PER_KOLI: 20,
        DATE_PRODUCTION: "12-Aug-26",
        SENDER: "WELLEN PRINT",
        WELLEN_PIC: "BPK. JHONNY",
        SENDER_TELP: "021-5506999",
        SENDER_EMAIL: "info@wellenprint.com"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateSampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_WellenPrint");
    XLSX.writeFile(wb, "Template_Import_WellenPrint.xlsx");
  };

  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (!rawData || rawData.length === 0) {
          alert('❌ File Excel kosong atau tidak terbaca!');
          return;
        }

        const cleanedData = rawData
          .map((row) => {
            const noSpk = String(row.NO_SPK || row['No SPK'] || row.no_spk || '').trim();
            const client = String(row.CLIENT || row.Client || row.client || row.COMPANY || row['Nama Klient'] || '').trim();
            const itemDesc = String(row.ITEM_DESCRIPTION || row['Item Description'] || row.item_description || '').trim();
            
            const rawQty = 
              row.QTY_TOTAL || row['Qty Total'] || row.qty_total || 
              row.QTY || row.Qty || row.qty || 
              row.QUANTITY || row.Quantity || row.quantity || 
              row['TOTAL QTY ORDER'] || row['qty Order'] || row['QTY ORDER'] || row['Total Qty'] ||
              row['QTY PACKING'] || row['QTY ORDER (PCS)'] || 0;

            const rawKoli = 
              row.QTY_PER_KOLI || row['Qty Per Koli'] || row.qty_per_koli || 
              row['ISI PER KOLI'] || row['ISI/KOLI'] || row['QTY/KOLI'] || 20;

            const deliveryAddress = String(
              row.DELIVERY_ADDRESS || row['Delivery Address'] || row.delivery_address || 
              row['ALAMAT_PENERIMA'] || row['Alamat Penerima'] || row['alamat_penerima'] || 
              row['ALAMAT'] || row['Alamat'] || row['alamat'] || row['Alamat Kirim'] || ''
            ).trim();

            return {
              NO_SPK: noSpk,
              PO_NUMBER: String(row.PO_NUMBER || row['PO Number'] || row.po_number || row['NO PO'] || '').trim(),
              NO_SJ: String(row.NO_SJ || row['NO SJ'] || row.no_sj || `WL-${Math.floor(10 + Math.random() * 90)}-${Math.floor(10 + Math.random() * 90)}`).trim(),
              CLIENT: client,
              BRAND: String(row.BRAND || row.Brand || row.brand || itemDesc).trim(),
              RECIPIENT_NAME: String(row.RECIPIENT_NAME || row['Recipient Name'] || row.recipient_name || row['UP'] || row['Nama Penerima'] || '').trim(),
              RECIPIENT_PHONE: String(row.RECIPIENT_PHONE || row['Recipient Phone'] || row.recipient_phone || row['No Telp Penerima'] || '').trim(),
              DELIVERY_ADDRESS: deliveryAddress,
              ITEM_DESCRIPTION: itemDesc,
              MEDIA: String(row.MEDIA || row.Media || row.media || '').trim(),
              UKURAN: String(row.UKURAN || row.Ukuran || row.ukuran || '').trim(),
              QTY_TOTAL: Number(String(rawQty).replace(/[^0-9]/g, '')) || 0,
              QTY_PER_KOLI: Number(String(rawKoli).replace(/[^0-9]/g, '')) || 20,
              DATE_PRODUCTION: String(row.DATE_PRODUCTION || row['Date Production'] || row.date_production || row['TANGGAL'] || '12-Aug-26').trim(),
              SENDER: String(row.SENDER || row.Sender || 'WELLEN PRINT').trim(),
              WELLEN_PIC: String(row.WELLEN_PIC || row['Wellen PIC'] || 'BPK. JHONNY').trim(),
              SENDER_TELP: String(row.SENDER_TELP || row['Sender Telp'] || '021-5506999').trim(),
              SENDER_EMAIL: String(row.SENDER_EMAIL || row['Sender Email'] || 'info@wellenprint.com').trim(),
              VISUAL_IMAGE: String(row.VISUAL_IMAGE || row['Visual Image'] || '').trim()
            };
          })
          .filter((item) => item.NO_SPK !== '' || item.CLIENT !== '' || item.ITEM_DESCRIPTION !== '' || item.QTY_TOTAL > 0);

        if (cleanedData.length === 0) {
          alert('❌ Validasi Gagal: Format kolom Excel tidak cocok!');
          setLabelData([]);
          return;
        }

        setLabelData(cleanedData);
        setSelectedRows([]);
        alert(`✅ Sukses Validasi! ${cleanedData.length} baris data berhasil di-import.`);
      } catch (err) {
        alert('Gagal membaca file Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImageUploadRow = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Url = evt.target.result;
      setLabelData((prev) =>
        prev.map((item, i) => (i === index ? { ...item, VISUAL_IMAGE: base64Url } : item))
      );
    };
    reader.readAsDataURL(file);
  };

  const handleClearData = () => {
    if (confirm('Apakah Anda yakin ingin membersihkan seluruh data import pada tabel?')) {
      setLabelData([]);
      setSelectedRows([]);
    }
  };

  const handleToggleCheck = (index) => {
    setSelectedRows((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleSelectAll = () => {
    if (selectedRows.length === labelData.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(labelData.map((_, idx) => idx));
    }
  };

  const renderHeaderLogoHtml = () => {
    if (headerLogoUrl) {
      return `<img src="${headerLogoUrl}" style="height:65px; max-width:200px; object-fit:contain; display:block;">`;
    }
    return `
      <div style="font-weight:900; font-size:22px; line-height:1; color:#000;">
        WELLEN<br><span style="font-size:13px; letter-spacing:6px;">PRINT</span>
      </div>
    `;
  };

  const handlePrintLabels = async () => {
    if (selectedRows.length === 0) {
      alert('⚠️ Silakan centang minimal 1 baris data untuk dicetak!');
      return;
    }

    const itemsToPrint = labelData.filter((_, idx) => selectedRows.includes(idx));

    const pagesHtml = await Promise.all(
      itemsToPrint.map(async (item) => {
        const totalQty = Number(item.QTY_TOTAL || 0);
        const qtyPerKoli = Number(item.QTY_PER_KOLI || 20);
        const totalKoli = Math.ceil(totalQty / qtyPerKoli) || 1;

        let koliHtmls = [];
        for (let k = 1; k <= totalKoli; k++) {
          const currentQty = (k === totalKoli && totalQty % qtyPerKoli !== 0) ? (totalQty % qtyPerKoli) : qtyPerKoli;
          const qrAddress = item.NO_SPK ? `SPK:${item.NO_SPK}|KOLI:${k}/${totalKoli}` : 'WELLEN-PRINT';
          
          let qrDataUrl = '';
          try {
            qrDataUrl = await QRCode.toDataURL(qrAddress, { width: 120, margin: 1 });
          } catch (e) {
            console.error(e);
          }

          koliHtmls.push(`
            <div class="label-page">
              <div class="label-box">
                <table class="header-table">
                  <tr>
                    <td style="width: 25%; vertical-align: middle;">${renderHeaderLogoHtml()}</td>
                    <td style="width: 55%; text-align:center; font-size:9px; line-height: 1.2; vertical-align: middle;">
                      <strong style="font-size:13px;">PT. WELLEN PRINT</strong><br>
                      Green Sedayu Bizpark. Jl. Daan Mogot KM.18 blok DM3 No.18, Kalideres,<br>
                      RT.11/RW.6, Kalideres, Kec. Kalideres, Kota Jakarta Barat, 11840
                    </td>
                    <td style="width: 20%; text-align:right; vertical-align: middle;">
                      ${qrDataUrl ? `<img src="${qrDataUrl}" style="width:65px; height:65px; display:inline-block;">` : ''}
                    </td>
                  </tr>
                </table>

                <div class="content-grid">
                  <div class="grid-box">
                    <strong>SENDER:</strong> ${item.SENDER || 'WELLEN PRINT'}<br>
                    <strong>WELLEN PIC:</strong> ${item.WELLEN_PIC || 'BPK. JHONNY'}<br>
                    <strong>NO. TELP:</strong> ${item.SENDER_TELP || '021-5506999'}<br>
                    <strong>EMAIL:</strong> ${item.SENDER_EMAIL || 'info@wellenprint.com'}
                  </div>
                  <div class="grid-box">
                    <strong>CLIENT:</strong> ${item.CLIENT || '-'}<br>
                    <strong>Delivery Address:</strong> ${item.DELIVERY_ADDRESS || '-'}<br>
                    <strong>Recipient Name:</strong> ${item.RECIPIENT_NAME || '-'}<br>
                    <strong>Recipient Phone:</strong> ${item.RECIPIENT_PHONE || '-'}
                  </div>
                  <div class="grid-box">
                    <strong>PO NUMBER:</strong> ${item.PO_NUMBER || '-'}<br>
                    <strong>NO. SPK:</strong> ${item.NO_SPK || '-'}<br>
                    <strong>ITEM DESCRIPTION:</strong> ${item.ITEM_DESCRIPTION || '-'}<br>
                    <strong>MEDIA:</strong> ${item.MEDIA || '-'}<br>
                    <strong>UKURAN:</strong> ${item.UKURAN || '-'}<br>
                    <strong>QUANTITY:</strong> ${currentQty} PCS<br>
                    <strong>DATE PRODUCTION:</strong> ${item.DATE_PRODUCTION || '-'}
                  </div>
                  <div class="grid-box visual-box">
                    <div><strong>VISUAL IMAGE :</strong></div>
                    <div class="koli-title">${k} OF ${totalKoli}</div>
                    ${item.VISUAL_IMAGE ? `<img src="${item.VISUAL_IMAGE}" class="preview-img">` : `<div style="font-size:10px; opacity:0.5;">[ No Image ]</div>`}
                  </div>
                </div>
              </div>
            </div>
          `);
        }
        return koliHtmls.join('');
      })
    );

    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Label Wellen Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; }
          .label-page { width: 210mm; height: 148mm; padding: 5mm; box-sizing: border-box; page-break-after: always; break-after: page; }
          .label-box { border: 2px solid #000; height: 100%; display: flex; flex-direction: column; box-sizing: border-box; }
          .header-table { width: 100%; border-bottom: 2px solid #000; border-collapse: collapse; }
          .header-table td { border: none; padding: 6px; vertical-align: middle; }
          .content-grid { display: grid; grid-template-columns: 1fr 1fr; flex-grow: 1; }
          .grid-box { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 6px; font-size: 11px; line-height: 1.4; box-sizing: border-box; }
          .grid-box:nth-child(2n) { border-right: none; }
          .grid-box:nth-child(3), .grid-box:nth-child(4) { border-bottom: none; }
          .visual-box { text-align: center; display: flex; flex-direction: column; justify-content: space-between; align-items: center; }
          .koli-title { font-size: 20px; font-weight: bold; margin: 2px 0; }
          .preview-img { max-width: 95%; max-height: 90px; object-fit: contain; }
          @media print {
            body { padding: 0; }
            .label-page { page-break-after: always; break-after: page; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml.join('')}
      </body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
  };

  const handlePrintSuratJalan = () => {
    if (selectedRows.length === 0) {
      alert('⚠️ Silakan centang minimal 1 baris data untuk dicetak Surat Jalan!');
      return;
    }

    const itemsToPrint = labelData.filter((_, idx) => selectedRows.includes(idx));

    const pagesHtml = itemsToPrint.map((item) => {
      return `
        <div class="sj-page">
          <div class="sj-top-header">
            <div class="logo-sec">
              ${renderHeaderLogoHtml()}
            </div>
            <div class="sj-title">Tanda Terima</div>
          </div>

          <div class="info-row">
            <div class="info-box left-box">
              <div class="info-line">Kepada Yth :</div>
              <div class="info-line font-bold">${item.CLIENT || '-'}</div>
              <div class="info-line">${item.DELIVERY_ADDRESS || '-'}</div>
              <div class="info-line">UP : ${item.RECIPIENT_NAME || '-'} ${item.RECIPIENT_PHONE || ''}</div>
            </div>

            <div class="right-box-container">
              <table class="meta-table">
                <tr>
                  <td class="font-bold">NO PO</td>
                  <td>: ${item.PO_NUMBER || '-'}</td>
                </tr>
                <tr>
                  <td class="font-bold">BRAND</td>
                  <td>: ${item.BRAND || item.ITEM_DESCRIPTION || '-'}</td>
                </tr>
                <tr>
                  <td class="font-bold">NO SJ</td>
                  <td>: ${item.NO_SJ || '-'}</td>
                </tr>
              </table>

              <div class="date-box">
                <div class="date-header">TANGGAL</div>
                <div class="date-value">${item.DATE_PRODUCTION || '12-Aug-26'}</div>
              </div>
            </div>
          </div>

          <table class="item-grid-table">
            <thead>
              <tr>
                <th style="width: 8%;">NO</th>
                <th style="width: 25%;">AMO/DEPO</th>
                <th style="width: 27%;">AMO</th>
                <th>
                  <div>${item.ITEM_DESCRIPTION || 'SUNSCREEN'}</div>
                  <div class="font-normal" style="font-size: 11px;">${item.BRAND || 'JUARA INTENS'}</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center;">1</td>
                <td>AMO/DEPO</td>
                <td></td>
                <td style="text-align: right; padding-right: 15px;">${Number(item.QTY_TOTAL || 0).toLocaleString()}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-center font-bold">TOTAL</td>
                <td style="text-align: right; padding-right: 15px;" class="font-bold">${Number(item.QTY_TOTAL || 0).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>

          <div class="signature-row">
            <div class="sig-box">PENGIRIM</div>
            <div class="sig-box">PENERIMA</div>
          </div>
        </div>
      `;
    }).join('');

    const printWin = window.open('', '_blank', 'width=900,height=800');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Surat Jalan - Wellen Print</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          .sj-page { width: 210mm; height: 148mm; padding: 8mm; box-sizing: border-box; page-break-after: always; break-after: page; display: flex; flex-direction: column; justify-content: space-between; }
          .font-bold { font-weight: bold; }
          .font-normal { font-weight: normal; }
          .text-center { text-align: center; }
          
          .sj-top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .sj-title { font-size: 26px; font-weight: bold; text-align: right; }

          .info-row { display: flex; gap: 15px; margin-bottom: 10px; }
          .info-box { border: 1.5px solid #000; padding: 6px 10px; font-size: 11px; line-height: 1.4; }
          .left-box { flex: 1; height: 75px; }
          .right-box-container { width: 42%; display: flex; flex-direction: column; gap: 6px; }

          .meta-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; }
          .meta-table td { padding: 2px 6px; border: none; }
          
          .date-box { border: 1.5px solid #000; height: 38px; display: flex; flex-direction: column; text-align: center; font-size: 10px; }
          .date-header { border-bottom: 1px solid #000; font-weight: bold; padding: 1px 0; background: #f8f8f8; }
          .date-value { padding-top: 3px; font-weight: bold; font-size: 11px; }

          .item-grid-table { width: 100%; border-collapse: collapse; border: 1.5px solid #000; font-size: 11px; margin-bottom: 15px; }
          .item-grid-table th, .item-grid-table td { border: 1.5px solid #000; padding: 5px; }
          .item-grid-table th { text-align: center; background: #f8f8f8; }
          .item-grid-table tfoot td { background: #f8f8f8; }

          .signature-row { display: flex; justify-space-around; text-align: center; font-size: 11px; font-weight: bold; margin-top: 15px; }
          .sig-box { width: 200px; border-top: 1px solid transparent; padding-top: 40px; }

          @media print {
            body { padding: 0; }
            .sj-page { page-break-after: always; break-after: page; }
          }
        </style>
      </head>
      <body>
        ${pagesHtml}
      </body>
      </html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
  };

  return (
    <div className="space-y-4">
      {/* Panel Upload Logo KOP Header */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white border-[#D8D2C2]'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-16 h-12 rounded-xl border bg-stone-50 dark:bg-neutral-900 flex items-center justify-center overflow-hidden p-1">
            {headerLogoUrl ? (
              <img src={headerLogoUrl} alt="Logo Header" className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-[10px] font-bold opacity-50 text-center">No Logo</span>
            )}
          </div>
          <div>
            <h4 className="font-bold text-xs">🖼️ Logo Header KOP (Label & Surat Jalan)</h4>
            <p className="text-[11px] opacity-70">
              {headerLogoUrl ? '✅ Logo KOP aktif (Tersimpan)' : '⚠️ Menggunakan teks default "WELLEN PRINT"'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm bg-purple-600 hover:bg-purple-500 transition-all active:scale-95">
            🖼️ Upload Logo KOP Wellen
            <input type="file" accept="image/*" onChange={handleUploadHeaderLogo} className="hidden" />
          </label>

          {headerLogoUrl && (
            <button
              onClick={handleResetHeaderLogo}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Top Action Controls */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${
        isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'
      }`}>
        <div className="flex items-center gap-2 flex-wrap">
          <label className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer text-white shadow-sm transition-all ${
            isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#6B8E85] hover:bg-[#57756D]'
          }`}>
            📁 Import Excel Format Label & SJ
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} className="hidden" />
          </label>

          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all"
          >
            📥 Download Template Excel
          </button>

          {labelData.length > 0 && (
            <button
              onClick={handleClearData}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
            >
              🧹 Bersihkan Import
            </button>
          )}

          <span className="text-xs opacity-70 ml-2">
            Terisi: <strong>{labelData.length}</strong> Baris Data Valid
          </span>
        </div>

        {/* Buttons Action Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintSuratJalan}
            disabled={selectedRows.length === 0}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${
              selectedRows.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            📄 Cetak Surat Jalan ({selectedRows.length})
          </button>

          <button
            onClick={handlePrintLabels}
            disabled={selectedRows.length === 0}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${
              selectedRows.length > 0
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95'
                : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            🏷️ Cetak Label ({selectedRows.length})
          </button>
        </div>
      </div>

      {/* Grid Table Data Preview */}
      <div className={`overflow-x-auto rounded-2xl border shadow-sm ${
        isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2]'
      }`}>
        <table className="w-full text-left text-xs">
          <thead className={`font-bold border-b ${
            isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'
          }`}>
            <tr>
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={labelData.length > 0 && selectedRows.length === labelData.length}
                  onChange={handleSelectAll}
                  className="cursor-pointer accent-indigo-600"
                />
              </th>
              <th className="p-3">No SPK / PO / SJ</th>
              <th className="p-3">Client & Brand</th>
              <th className="p-3">Penerima & Alamat</th>
              <th className="p-3">Deskripsi / Media / Ukuran</th>
              <th className="p-3">Total Qty</th>
              <th className="p-3">Isi/Koli</th>
              <th className="p-3">Visual Image</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
            {labelData.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-6 text-center opacity-60">
                  Tabel kosong. Silakan klik tombol <strong>"Download Template Excel"</strong> di atas.
                </td>
              </tr>
            ) : (
              labelData.map((row, idx) => {
                const total = Number(row.QTY_TOTAL || 0);
                const koli = Number(row.QTY_PER_KOLI || 20);
                const isChecked = selectedRows.includes(idx);

                return (
                  <tr key={idx} className={`transition-colors ${
                    isChecked
                      ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70'
                      : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'
                  }`}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCheck(idx)}
                        className="cursor-pointer accent-indigo-600"
                      />
                    </td>
                    <td className="p-3 font-bold text-blue-500">
                      {row.NO_SPK || '-'}<br />
                      <span className="font-normal text-[10px] opacity-70">PO: {row.PO_NUMBER || '-'}</span><br />
                      <span className="font-normal text-[10px] text-emerald-500">SJ: {row.NO_SJ || '-'}</span>
                    </td>
                    <td className="p-3">
                      <strong className="text-xs">{row.CLIENT || '-'}</strong><br />
                      <span className="text-[10px] opacity-70">{row.BRAND || '-'}</span>
                    </td>
                    <td className="p-3">
                      <strong>{row.RECIPIENT_NAME || '-'}</strong> ({row.RECIPIENT_PHONE || '-'})<br />
                      <span className="text-[10px] opacity-70">{row.DELIVERY_ADDRESS || '-'}</span>
                    </td>
                    <td className="p-3">
                      {row.ITEM_DESCRIPTION || '-'}<br />
                      <span className="text-[10px] opacity-70">{row.MEDIA || '-'} ({row.UKURAN || '-'})</span>
                    </td>
                    <td className="p-3 font-bold">{total.toLocaleString()} Pcs</td>
                    <td className="p-3">{koli} Pcs</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {row.VISUAL_IMAGE ? (
                          <img 
                            src={row.VISUAL_IMAGE} 
                            alt="Preview" 
                            onClick={() => onOpenImageModal && onOpenImageModal(row.VISUAL_IMAGE, `Visual Item SPK: ${row.NO_SPK}`)}
                            className="w-12 h-8 object-contain border rounded bg-white cursor-pointer hover:scale-105 transition-transform" 
                          />
                        ) : (
                          <span className="text-[10px] opacity-50">Belum ada</span>
                        )}
                        <label className="cursor-pointer px-2 py-1 bg-stone-200 dark:bg-neutral-700 hover:bg-stone-300 rounded text-[10px] font-bold">
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUploadRow(e, idx)}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   KOMPONEN MODAL LOGIN KHUSUS ADMIN
   ========================================================= */
function AdminLoginModal({ isOpen, onClose, onLoginSuccess, isDarkMode }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (username.toUpperCase() === 'ADMIN' && password === '123456') {
      const adminUser = { role: 'admin', name: 'Administrator System' };
      localStorage.setItem('kl_admin_session', JSON.stringify(adminUser));
      onLoginSuccess(adminUser);
    } else {
      setErrorMsg('❌ Username atau Password Admin salah!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2]'}`}>
        <div className="text-center mb-6">
          <span className="text-4xl">🔐</span>
          <h3 className="font-bold text-lg mt-2">Login Khusus Admin Operasional</h3>
          <p className="text-xs opacity-70">Masukkan Akun Administrator System</p>
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Username Admin:</label>
            <input
              type="text"
              placeholder="ADMIN"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full p-3 rounded-xl border font-mono font-bold focus:outline-none uppercase ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0]'}`}
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Password Admin:</label>
            <input
              type="password"
              placeholder="123456"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full p-3 rounded-xl border font-mono font-bold text-center tracking-widest focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0]'}`}
            />
          </div>

          {errorMsg && <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800 text-center font-bold">{errorMsg}</div>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-bold border">Batal</button>
            <button type="submit" className="flex-1 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
              Masuk Dashboard Admin 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   KOMPONEN UTAMA (APP)
   ========================================================= */
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [spkList, setSpkList] = useState([]);
  
  // DILENGKAPI DETEKSI LINK PARAMETER MODE CABANG VS ADMIN
  const searchParams = new URLSearchParams(window.location.search);
  const isBranchMode = searchParams.get('mode') === 'cabang';

  const [currentAdmin, setCurrentAdmin] = useState(() => {
    const saved = localStorage.getItem('kl_admin_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);

  // State Modal Preview Gambar
  const [modalImageInfo, setModalImageModalInfo] = useState({ isOpen: false, url: '', title: '' });

  useEffect(() => {
    fetchSpkData();
  }, []);

  const openImageModal = (url, title) => {
    if (!url) return;
    setModalImageModalInfo({ isOpen: true, url, title: title || 'Preview Foto' });
  };

  const closeImageModal = () => {
    setModalImageModalInfo({ isOpen: false, url: '', title: '' });
  };

  const fetchSpkData = async () => {
    const { data } = await supabase.from('spk_data').select('*').order('id', { ascending: false });
    if (data) setSpkList(data);
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const nextMode = !prev;
      localStorage.setItem('theme', nextMode ? 'dark' : 'light');
      return nextMode;
    });
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('kl_admin_session');
    setCurrentAdmin(null);
    setActiveTab('dashboard');
  };

  const availableTabs = isBranchMode 
    ? ['kawan_lama'] 
    : ['dashboard', 'produksi', 'finishing', 'paking', 'pengiriman', 'label', 'kawan_lama'];

  return (
    <div className={`min-h-screen p-6 font-sans antialiased transition-colors ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-gradient-to-br from-[#FBF9F5] to-[#E5E0D5] text-[#2F3E3B]'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className={`flex flex-col sm:flex-row justify-between items-center p-5 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-[#D8D2C2]'}`}>
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>
              {isBranchMode ? 'FORM INPUT CABANG - KAWAN LAMA' : 'WEB-TRACK MONITORING ADMIN'}
            </h1>
            <p className="text-xs opacity-70">
              {isBranchMode 
                ? 'Portal Resmi Pengisian Barang Cabang' 
                : currentAdmin ? `Akses: ${currentAdmin.name}` : 'Akses Admin Operasional Internal'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="px-3 py-2 rounded-xl text-xs font-semibold border">
              {isDarkMode ? '☀️ Terang' : '🌙 Gelap'}
            </button>

            {!isBranchMode && (
              currentAdmin ? (
                <button onClick={handleAdminLogout} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white">
                  🔒 Logout Admin
                </button>
              ) : (
                <button onClick={() => setShowAdminLoginModal(true)} className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white">
                  🔑 Login Admin
                </button>
              )
            )}
          </div>
        </div>

        {/* Tab Navigasi (Hanya Tampil Jika Bukan Link Cabang) */}
        {!isBranchMode && (
          <div className="flex gap-2 overflow-x-auto border-b pb-2">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap ${
                  activeTab === tab 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : isDarkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-white/70 text-[#4A5D58]'
                }`}
              >
                {tab === 'label' ? '🏷️ Cetak Label & SJ' : tab === 'kawan_lama' ? '🏢 Project Kawan Lama' : tab}
              </button>
            ))}
          </div>
        )}

        {/* Dashboard Circular Gauge (Admin) */}
        {!isBranchMode && activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CircularGaugeCard title="Completion Rate" percent={75} color="#2D5A27" detailText="Overall Progress" />
            <CircularGaugeCard title="Total Target Order" percent={100} color="#4F46E5" detailText="Data SPK" />
            <CircularGaugeCard title="Finishing Progress" percent={60} color="#D97706" detailText="Internal & Sub" />
            <CircularGaugeCard title="Stage Pengiriman" percent={45} color="#0D9488" detailText="Status Delivery" />
          </div>
        )}

        {/* Tab Kawan Lama (Tampil untuk Link Cabang & Link Admin) */}
        {(isBranchMode || activeTab === 'kawan_lama') && (
          <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentAdmin} isBranchMode={isBranchMode} />
        )}

        {/* Tab Label Generator (Admin) */}
        {!isBranchMode && activeTab === 'label' && (
          <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
        )}

        {/* Tabel Data SPK Operasional (Admin) */}
        {!isBranchMode && activeTab !== 'label' && activeTab !== 'kawan_lama' && (
          <div className={`overflow-x-auto rounded-2xl border shadow-sm ${isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white border-[#D8D2C2]'}`}>
            <table className="w-full text-left text-xs">
              <thead className={isDarkMode ? 'bg-neutral-800 text-neutral-300' : 'bg-[#EFECE6] text-[#3D4F4B]'}>
                <tr>
                  <th className="p-4">No SPK</th>
                  <th className="p-4">Klient / Store Name</th>
                  <th className="p-4">Bahan / Ukuran</th>
                  <th className="p-4">Order</th>
                  <th className="p-4">QC Paking</th>
                  <th className="p-4">QC Checker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 dark:divide-neutral-800">
                {spkList.map((item) => (
                  <tr key={item.id}>
                    <td className="p-4 font-bold text-blue-500">{item.no_spk}</td>
                    <td className="p-4"><strong>{item.client}</strong><br/><span className="text-[10px] opacity-70">{item.project}</span></td>
                    <td className="p-4">{item.bahan} ({item.ukuran})</td>
                    <td className="p-4 font-bold">{item.qty_order} Pcs</td>
                    <td className="p-4">{item.qc_paking || '-'}</td>
                    <td className="p-4">{item.qc_checker || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Pop-up Modal Preview Foto Visual */}
      {modalImageInfo.isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4"
          onClick={closeImageModal}
        >
          <div 
            className={`relative max-w-4xl max-h-[90vh] p-4 rounded-3xl border shadow-2xl flex flex-col items-center gap-3 overflow-hidden ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-[#D8D2C2]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center border-b pb-2 dark:border-neutral-700 border-stone-200">
              <h3 className="font-bold text-sm tracking-wide">{modalImageInfo.title}</h3>
              <button
                onClick={closeImageModal}
                className="w-8 h-8 rounded-full bg-stone-200 dark:bg-neutral-800 hover:bg-rose-500 hover:text-white font-bold text-sm flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              <img
                src={modalImageInfo.url}
                alt="Preview Detail"
                className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-md border dark:border-neutral-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Login Admin */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        isDarkMode={isDarkMode}
        onClose={() => setShowAdminLoginModal(false)}
        onLoginSuccess={(admin) => {
          setCurrentAdmin(admin);
          setShowAdminLoginModal(false);
        }}
      />
    </div>
  );
}