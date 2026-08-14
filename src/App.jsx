import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import KawanLamaTab from './components/KawanLamaTab';
import LabelGeneratorTab from './components/LabelGeneratorTab';
import { BranchLoginModal, AdminLoginModal, ScanQCModal, ImagePreviewModal } from './components/Modals';

const STAFF_QC_LIST = [
  "Budi (QC Paking)", "Siti (QC Paking)", "Agus (QC Checker)",
  "Dewi (QC Checker)", "Eko (QC Deliver)", "Rian (QC Deliver)"
];

function CircularGaugeCard({ title, percent, color, detailText }) {
  const strokeDasharray = 2 * Math.PI * 36;
  const strokeDashoffset = strokeDasharray - (percent / 100) * strokeDasharray;
  return (
    <div className="bg-white/80 dark:bg-neutral-800/80 p-5 rounded-3xl border border-[#D8D2C2] dark:border-neutral-700 flex flex-col items-center shadow-sm transition-all hover:scale-105">
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

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isBranchMode = searchParams.get('mode') === 'cabang';

  const [spkList, setSpkList] = useState([]);
  const [activeTab, setActiveTab] = useState(isBranchMode ? 'kawan_lama' : 'dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [modalImageInfo, setModalImageModalInfo] = useState({ isOpen: false, url: '', title: '' });
  
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanTargetColumn, setScanTargetColumn] = useState('qc_checker');
  const [qcStaffName, setQcStaffName] = useState(STAFF_QC_LIST[2]);
  const [scannedInput, setScannedInput] = useState('');
  const [lastScanMessage, setLastScanMessage] = useState('');
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({ finishing_type: 'inhouse', sub_vendor_name: '', qty_finish_sub_out: 0, qty_finish: 0 });

  const [currentAdmin, setCurrentAdmin] = useState(() => { const s = localStorage.getItem('kl_admin_session'); return s ? JSON.parse(s) : null; });
  const [currentBranch, setCurrentBranch] = useState(() => { const s = localStorage.getItem('kl_branch_session'); return s ? JSON.parse(s) : null; });
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showBranchLoginModal, setShowBranchLoginModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => { if (isBranchMode && !currentBranch) setShowBranchLoginModal(true); }, [isBranchMode, currentBranch]);
  useEffect(() => { fetchSpkData(); }, []);

  const openImageModal = (url, title) => { if (url) setModalImageModalInfo({ isOpen: true, url, title: title || 'Preview' }); };
  const closeImageModal = () => setModalImageModalInfo({ isOpen: false, url: '', title: '' });
  const toggleTheme = () => setIsDarkMode(prev => { localStorage.setItem('theme', !prev ? 'dark' : 'light'); return !prev; });

  const fetchSpkData = async () => {
    const { data } = await supabase.from('spk_data').select('*').order('id', { ascending: false });
    if (data) { setSpkList(data); if (data.length > 0 && !selectedSpkId) initFinishingForm(data[0]); }
  };

  const initFinishingForm = (item) => {
    if (!item) return; setSelectedSpkId(item.id);
    setFinishingForm({ finishing_type: item.finishing_type || 'inhouse', sub_vendor_name: item.sub_vendor_name || '', qty_finish_sub_out: item.qty_finish_sub_out || 0, qty_finish: item.qty_finish || 0 });
  };

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId); const item = spkList.find(s => String(s.id) === String(spkId));
    if (item) setFinishingForm({ finishing_type: item.finishing_type || 'inhouse', sub_vendor_name: item.sub_vendor_name || '', qty_finish_sub_out: item.qty_finish_sub_out || 0, qty_finish: item.qty_finish || 0 });
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds(prev => { const exist = prev.includes(id); if (!exist) handleSelectSpk(id); return exist ? prev.filter(item => item !== id) : [...prev, id]; });
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
  const displayedList = spkList.filter(item => (item.no_spk||'').toLowerCase().includes(searchTerm.toLowerCase()) || (item.project||'').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className={`min-h-screen p-6 font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-gradient-to-br from-[#FBF9F5] via-[#F3EFE6] to-[#E5E0D5] text-[#2F3E3B]'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER UTAMA */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white/80 border-[#D8D2C2] backdrop-blur-md'} gap-4`}>
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>
              {isBranchMode ? 'FORM CABANG KAWAN LAMA' : 'WEB-TRACK MONITORING'}
            </h1>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>
              {isBranchMode ? 'Sistem Terpadu Portal Cabang' : 'Sistem Pelacak Progress Produksi & Pengiriman SPK'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleTheme} className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-yellow-300 border-neutral-600' : 'bg-white hover:bg-stone-100 text-slate-700 border-[#D8D2C2]'}`}>
              {isDarkMode ? '☀️ Tema Terang' : '🌙 Tema Gelap'}
            </button>
            {!isBranchMode && (currentAdmin ? <button onClick={() => {localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard');}} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Admin</button> : <button onClick={() => setShowAdminLoginModal(true)} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95">🔑 Login Admin</button>)}
            {isBranchMode && currentBranch && <button onClick={() => {localStorage.removeItem('kl_branch_session'); setCurrentBranch(null);}} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Cabang</button>}
            {!isBranchMode && <button onClick={() => setShowScanModal(true)} className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95">📷 Scan QC Station</button>}
            {!isBranchMode && <label className={`px-3.5 py-2 rounded-xl cursor-pointer text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 ${isDarkMode ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-[#6B8E85] hover:bg-[#57756D] text-white'}`}>📁 Upload SPK Excel<input type="file" accept=".xlsx" onChange={handleExcelUpload} className="hidden" /></label>}
          </div>
        </div>

        {/* TABS MENU */}
        {!isBranchMode && (
          <div className={`flex gap-2 overflow-x-auto border-b pb-2 ${isDarkMode ? 'border-neutral-800' : 'border-[#D8D2C2]'}`}>
            {['dashboard', 'produksi', 'finishing', 'paking', 'pengiriman', 'label', 'kawan_lama'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all whitespace-nowrap ${activeTab === t ? (isDarkMode ? 'bg-blue-600 text-white shadow-sm' : 'bg-[#6B8E85] text-white shadow-sm') : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700' : 'bg-white/70 text-[#4A5D58] hover:bg-white border border-[#D8D2C2]/70')}`}>
                {t === 'label' ? '🏷️ Cetak Label & SJ' : t === 'kawan_lama' ? '🏢 Project Kawan Lama' : t}
              </button>
            ))}
          </div>
        )}

        {/* DASHBOARD WIDGET */}
        {!isBranchMode && activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CircularGaugeCard title="Total SPK" percent={100} color="#4F46E5" detailText={`${totalSpk} Data Aktif`} />
            <CircularGaugeCard title="Produksi" percent={80} color="#D97706" detailText="Print & Finish" />
            <CircularGaugeCard title="Paking" percent={60} color="#9333EA" detailText="Siap Kirim" />
            <CircularGaugeCard title="Terkirim" percent={40} color="#0D9488" detailText="Delivery Done" />
          </div>
        )}

        {/* TAB KAWAN LAMA */}
        {(isBranchMode || activeTab === 'kawan_lama') && (
          <KawanLamaTab isDarkMode={isDarkMode} currentUser={isBranchMode ? currentBranch : currentAdmin} isBranchMode={isBranchMode} />
        )}
        
        {/* TAB CETAK LABEL & SURAT JALAN */}
        {!isBranchMode && activeTab === 'label' && (
          <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
        )}

        {/* TRACKING TABLE FULL */}
        {!isBranchMode && activeTab !== 'label' && activeTab !== 'kawan_lama' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white/90 border-[#D8D2C2]'}`}>
              <div className="flex items-center gap-2 flex-1 w-full">
                <span className="text-sm">🔍</span>
                <input type="text" placeholder="Cari SPK, Client, atau Store Name..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className={`w-full text-xs bg-transparent focus:outline-none ${isDarkMode ? 'text-white' : 'text-[#2F3E3B]'}`} />
              </div>
              <button onClick={handleBatchPrint} disabled={selectedSpkIds.length === 0} className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${selectedSpkIds.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95' : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 cursor-not-allowed'}`}>
                🖨️ Cetak {selectedSpkIds.length} Surat Form Sekaligus
              </button>
            </div>

            <div className={`overflow-x-auto rounded-2xl border shadow-sm transition-colors ${isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2] backdrop-blur-md'}`}>
              <table className="w-full text-xs text-left">
                <thead className={`font-bold border-b transition-colors ${isDarkMode ? 'bg-neutral-800/80 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'}`}>
                  <tr>
                    <th className="p-4 w-10 text-center"><input type="checkbox" checked={spkList.length>0 && selectedSpkIds.length === spkList.length} onChange={() => handleToggleSelectAll(spkList)} className="w-4 h-4 cursor-pointer accent-indigo-600" /></th>
                    <th className="p-4">SPK & Info</th>
                    <th className="p-4">Print</th>
                    <th className="p-4">Finish</th>
                    <th className="p-4">Paking & Foto</th>
                    <th className="p-4">QC Check</th>
                    <th className="p-4">Ship & Surat Jalan</th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
                  {displayedList.map(i => {
                    const pPrint = getPercent(i.qty_print, i.qty_order); const pFinish = getPercent(i.qty_finish, i.qty_order); const pPack = getPercent(i.qty_pack, i.qty_order); const pShip = getPercent(i.qty_ship, i.qty_order);
                    const isChecked = selectedSpkIds.includes(i.id);
                    return (
                      <tr key={i.id} className={`transition-colors ${isChecked ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70' : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]'}`}>
                        <td className="p-4 text-center"><input type="checkbox" checked={isChecked} onChange={() => handleToggleCheck(i.id)} className="w-4 h-4 cursor-pointer accent-indigo-600" /></td>
                        <td className="p-4">
                          <strong className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>{i.no_spk}</strong><br/>
                          <span className={`font-semibold ${isDarkMode ? 'text-neutral-200' : 'text-[#2F3E3B]'}`}>{i.client} - {i.project}</span><br/>
                          <span className={`text-[10px] ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>Order: {i.qty_order} Pcs</span>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pPrint).text}`}>{pPrint}%</span><br/>
                          {activeTab==='produksi' && <input type="number" value={i.qty_print||0} onChange={e=>handleUpdateQty(i.id, 'qty_print', e.target.value, i.qty_order)} className={`mt-1.5 w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pFinish).text}`}>{pFinish}%</span><br/>
                          {activeTab==='finishing' && <input type="number" value={i.qty_finish||0} onChange={e=>handleUpdateQty(i.id, 'qty_finish', e.target.value, i.qty_order)} className={`mt-1.5 w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pPack).text}`}>{pPack}%</span><br/>
                          {activeTab==='paking' && (
                            <div className="mt-1.5 space-y-1.5">
                              <input type="number" value={i.qty_pack||0} onChange={e=>handleUpdateQty(i.id, 'qty_pack', e.target.value, i.qty_finish)} className={`w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />
                              <label className={`block text-center rounded-lg px-2 py-1 text-[10px] cursor-pointer font-bold transition-all border ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-600' : 'bg-[#EFECE6] hover:bg-[#E5E0D5] text-[#3D4F4B] border-[#D8D2C2]'}`}>
                                📷 Upload Foto Paking
                                <input type="file" accept="image/*" onChange={e => {const f=e.target.files[0]; if(f){const r=new FileReader(); r.onload=ev=>handleUpdateField(i.id, {packing_visual_url: ev.target.result}); r.readAsDataURL(f);}}} className="hidden" />
                              </label>
                              {i.packing_visual_url && <img src={i.packing_visual_url} alt="Paking" onClick={() => openImageModal(i.packing_visual_url, `Foto Paking: ${i.no_spk}`)} className="w-12 h-8 object-cover rounded border cursor-pointer hover:scale-110" />}
                            </div>
                          )}
                        </td>
                        <td className="p-4 space-y-1.5">
                          <select value={i.qc_checker||''} onChange={e=>handleUpdateField(i.id, {qc_checker: e.target.value})} className={`block w-full rounded-lg border p-1 text-[10px] focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`}><option value="">-- QC Checker --</option>{STAFF_QC_LIST.map(s=><option key={s}>{s}</option>)}</select>
                          <select value={i.qc_paking||''} onChange={e=>handleUpdateField(i.id, {qc_paking: e.target.value})} className={`block w-full rounded-lg border p-1 text-[10px] focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`}><option value="">-- QC Paking --</option>{STAFF_QC_LIST.map(s=><option key={s}>{s}</option>)}</select>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pShip).text}`}>{pShip}%</span><br/>
                          {activeTab==='pengiriman' && (
                            <div className="mt-1.5 space-y-1.5">
                              <input type="number" value={i.qty_ship||0} onChange={e=>handleUpdateQty(i.id, 'qty_ship', e.target.value, i.qty_pack)} className={`w-20 border rounded-lg px-2 py-1 focus:outline-none ${isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'}`} />
                              <label className={`block text-center rounded-lg px-2 py-1 text-[10px] cursor-pointer font-bold transition-all border ${isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-600' : 'bg-[#EFECE6] hover:bg-[#E5E0D5] text-[#3D4F4B] border-[#D8D2C2]'}`}>
                                📤 Upload Surat Jalan
                                <input type="file" onChange={e=>handleUploadSuratJalan(e, i)} accept="image/*,application/pdf" className="hidden"/>
                              </label>
                            </div>
                          )}
                          {i.surat_jalan_url && <a href={i.surat_jalan_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-[10px] block mt-1">📄 Lihat SJ</a>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* PANGGIL MODAL DARI KOMPONEN TERPISAH */}
      <ScanQCModal 
        isOpen={showScanModal} 
        onClose={() => setShowScanModal(false)} 
        isDarkMode={isDarkMode} 
        scanTargetColumn={scanTargetColumn} 
        setScanTargetColumn={setScanTargetColumn} 
        scannedInput={scannedInput} 
        setScannedInput={setScannedInput} 
        handleSubmitInput={handleSubmitInput} 
        lastScanMessage={lastScanMessage} 
      />

      <ImagePreviewModal 
        isOpen={modalImageInfo.isOpen} 
        onClose={closeImageModal} 
        modalImageInfo={modalImageInfo} 
      />

      <AdminLoginModal 
        isOpen={showAdminLoginModal} 
        onClose={() => setShowAdminLoginModal(false)} 
        onLoginSuccess={(admin) => { setCurrentAdmin(admin); setShowAdminLoginModal(false); }} 
      />

      <BranchLoginModal 
        isOpen={showBranchLoginModal} 
        onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} 
      />
    </div>
  );
}