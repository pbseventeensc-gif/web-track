import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import KawanLamaTab from './components/KawanLamaTab';
import LabelGeneratorTab from './components/LabelGeneratorTab';
import MainTrackingTable from './components/MainTrackingTable';
import FinishingPanel from './components/FinishingPanel';
import { BranchLoginModal, AdminLoginModal, ScanQCModal, ImagePreviewModal } from './components/Modals';

const STAFF_QC_LIST = [
  "Budi (QC Paking)", "Siti (QC Paking)", "Agus (QC Checker)",
  "Dewi (QC Checker)", "Eko (QC Deliver)", "Rian (QC Deliver)"
];

function CircularGaugeCard({ title, percent, color, detailText }) {
  const strokeDasharray = 2 * Math.PI * 36;
  const strokeDashoffset = strokeDasharray - (percent / 100) * strokeDasharray;
  return (
    <div className="bg-white p-5 rounded-3xl border border-stone-200/80 flex flex-col items-center shadow-sm hover:shadow-md transition-all hover:scale-[1.02] dark:bg-neutral-800/80 dark:border-neutral-700">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:opacity-70 mb-3">{title}</h4>
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="7" className="text-stone-100 dark:text-neutral-700 fill-none" />
          <circle cx="40" cy="40" r="36" stroke={color} strokeWidth="7" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round" className="fill-none transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-black text-stone-800 dark:text-neutral-100">{percent}%</span>
          <span className="text-[9px] font-bold text-stone-400 uppercase">Progress</span>
        </div>
      </div>
      <p className="text-xs font-bold mt-3 text-stone-600 dark:opacity-80">{detailText}</p>
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

  // Sesi Admin & Cabang menggunakan localStorage agar aman saat refresh
  const [currentAdmin, setCurrentAdmin] = useState(() => { 
    const s = localStorage.getItem('kl_admin_session'); 
    return s ? JSON.parse(s) : null; 
  });
  
  const [currentBranch, setCurrentBranch] = useState(() => { 
    const s = localStorage.getItem('kl_branch_session'); 
    return s ? JSON.parse(s) : null; 
  });

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
    <div className={`min-h-screen p-6 font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-[#F4F5F7] text-stone-800'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER UTAMA */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-3xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-stone-200/80'}`}>
          <div>
            <h1 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-blue-400' : 'text-indigo-600'}`}>
              {isBranchMode ? 'FORM CABANG KAWAN LAMA' : 'WEB-TRACK MONITORING'}
            </h1>
            <p className={`text-xs mt-0.5 font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              {isBranchMode ? 'Sistem Terpadu Portal Cabang' : 'Sistem Pelacak Progress Produksi & Pengiriman SPK'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleTheme} className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-yellow-300 border-neutral-600' : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'}`}>
              {isDarkMode ? '☀️ Tema Terang' : '🌙 Tema Gelap'}
            </button>
            {!isBranchMode && (currentAdmin ? <button onClick={() => {localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard');}} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Admin</button> : <button onClick={() => setShowAdminLoginModal(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95">🔑 Login Admin</button>)}
            {isBranchMode && currentBranch && <button onClick={() => {localStorage.removeItem('kl_branch_session'); setCurrentBranch(null);}} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Cabang</button>}
            {!isBranchMode && <button onClick={() => setShowScanModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95">📷 Scan QC Station</button>}
            {!isBranchMode && <label className="px-4 py-2 rounded-2xl cursor-pointer text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white">📁 Upload SPK Excel<input type="file" accept=".xlsx" onChange={handleExcelUpload} className="hidden" /></label>}
          </div>
        </div>

        {/* TABS MENU */}
        {!isBranchMode && (
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {['dashboard', 'produksi', 'finishing', 'paking', 'pengiriman', 'label', 'kawan_lama'].map(t => {
              // LOGIKA KUNCI: Tab Kawan Lama terkunci jika belum login Admin
              const isLocked = t === 'kawan_lama' && !currentAdmin;

              return (
                <button 
                  key={t} 
                  onClick={() => !isLocked && setActiveTab(t)} 
                  disabled={isLocked}
                  title={isLocked ? "Silakan Login Admin terlebih dahulu" : ""}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold capitalize transition-all whitespace-nowrap shadow-sm 
                    ${isLocked 
                      // Style jika Terkunci (Kusam & Disabled)
                      ? (isDarkMode ? 'bg-neutral-900/50 text-neutral-600 border border-neutral-800 cursor-not-allowed' : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-70')
                      // Style jika Aktif
                      : activeTab === t 
                        ? 'bg-indigo-600 text-white shadow-md' 
                        : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200/80')
                    }`}
                >
                  {t === 'label' 
                    ? '🏷️ Cetak Label & SJ' 
                    : t === 'kawan_lama' 
                      ? (isLocked ? '🔒 Project Kawan Lama' : '🏢 Project Kawan Lama') 
                      : t}
                </button>
              );
            })}
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

        {/* PANEL KONTROL FINISHING */}
        {!isBranchMode && activeTab === 'finishing' && (
          <FinishingPanel isDarkMode={isDarkMode} spkList={spkList} fetchSpkData={fetchSpkData} />
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
          <MainTrackingTable 
            isDarkMode={isDarkMode}
            activeTab={activeTab}
            spkList={spkList}
            displayedList={displayedList}
            selectedSpkIds={selectedSpkIds}
            handleToggleCheck={handleToggleCheck}
            handleToggleSelectAll={handleToggleSelectAll}
            handleUpdateQty={handleUpdateQty}
            handleUpdateField={handleUpdateField}
            handleBatchPrint={handleBatchPrint}
            openImageModal={openImageModal}
            handleUploadSuratJalan={handleUploadSuratJalan}
            getPercent={getPercent}
            getStatusBadge={getStatusBadge}
            STAFF_QC_LIST={STAFF_QC_LIST}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        )}
      </div>

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
        onLoginSuccess={(admin) => { 
          localStorage.setItem('kl_admin_session', JSON.stringify(admin));
          setCurrentAdmin(admin); 
          setShowAdminLoginModal(false); 
        }} 
      />

      <BranchLoginModal 
        isOpen={showBranchLoginModal} 
        onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} 
      />
    </div>
  );
}