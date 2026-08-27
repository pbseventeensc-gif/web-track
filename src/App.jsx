import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import KawanLamaTab from './components/KawanLamaTab';
import LabelGeneratorTab from './components/LabelGeneratorTab';
import MainTrackingTable from './components/MainTrackingTable';
import FinishingPanel from './components/FinishingPanel';
import DesignPanel from './components/DesignPanel';
import PackingPanel from './components/PackingPanel';
import { BranchLoginModal, AdminLoginModal, ScanQCModal, ImagePreviewModal } from './components/Modals';
import CustomModulesIndex from './custom-modules/Index';

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
  const scanParam = searchParams.get('scan'); 

  const [spkList, setSpkList] = useState([]);
  
  // Sesi Admin Kawan Lama Khusus
  const [currentKawanLamaAdmin, setCurrentKawanLamaAdmin] = useState(() => {
    const s = localStorage.getItem('kl_special_admin_session');
    return s ? JSON.parse(s) : null;
  });

  const [activeTab, setActiveTab] = useState(
    scanParam ? 'paking' : (currentKawanLamaAdmin ? 'label' : (isBranchMode ? 'kawan_lama' : 'dashboard'))
  );
  
  const [searchTerm, setSearchTerm] = useState(scanParam || ''); 
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [modalImageInfo, setModalImageModalInfo] = useState({ isOpen: false, url: '', title: '' });
  
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanTargetColumn, setScanTargetColumn] = useState('qc_checker');
  const [qcStaffName, setQcStaffName] = useState(STAFF_QC_LIST[2]);
  const [scannedInput, setScannedInput] = useState('');
  const [lastScanMessage, setLastScanMessage] = useState('');
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({ finishing_type: 'inhouse', sub_vendor_name: '', qty_finish_sub_out: 0, qty_finish: 0 });
  const [isImporting, setIsImporting] = useState(false);

  const [currentAdmin, setCurrentAdmin] = useState(() => { 
    const s = localStorage.getItem('kl_admin_session'); 
    return s ? JSON.parse(s) : null; 
  });
  
  const [currentBranch, setCurrentBranch] = useState(() => { 
    const s = localStorage.getItem('kl_branch_session'); 
    return s ? JSON.parse(s) : null; 
  });

  const [packingStaffSession, setPackingStaffSession] = useState(() => {
    const s = localStorage.getItem('packing_staff_session');
    return s ? JSON.parse(s) : null;
  });
  const [showPackingLoginModal, setShowPackingLoginModal] = useState(false);
  const [packingUsername, setPackingUsername] = useState('');
  const [packingPassword, setPackingPassword] = useState('');

  // Modal Login Khusus Admin Kawan Lama (Pusat Kawan Lama)
  const [showKawanLamaAdminModal, setShowKawanLamaAdminModal] = useState(false);
  const [klAdminUser, setKlAdminUser] = useState('');
  const [klAdminPass, setKlAdminPass] = useState('');

  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showBranchLoginModal, setShowBranchLoginModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (scanParam) {
      setActiveTab('paking');
      setSearchTerm(scanParam); 
    }
  }, [scanParam]);

  useEffect(() => { 
    if (isBranchMode && !currentBranch) {
      setShowBranchLoginModal(true); 
    }
  }, [isBranchMode, currentBranch]);

  useEffect(() => {
    if (scanParam && !packingStaffSession && !currentAdmin && !currentKawanLamaAdmin) {
      setShowPackingLoginModal(true);
    }
  }, [scanParam, packingStaffSession, currentAdmin, currentKawanLamaAdmin]);

  useEffect(() => { 
    fetchSpkData(); 

    const channel = supabase
      .channel('spk_data_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spk_data' },
        () => {
          fetchSpkData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openImageModal = (url, title) => { if (url) setModalImageModalInfo({ isOpen: true, url, title: title || 'Preview' }); };
  const closeImageModal = () => setModalImageModalInfo({ isOpen: false, url: '', title: '' });
  const toggleTheme = () => setIsDarkMode(prev => { localStorage.setItem('theme', !prev ? 'dark' : 'light'); return !prev; });

  const fetchSpkData = async () => {
    const { data } = await supabase
      .from('spk_data')
      .select('*')
      .order('id', { ascending: false });

    if (data) { 
      setSpkList(data); 
      if (data.length > 0 && !selectedSpkId) initFinishingForm(data[0]); 
    }
  };

  const initFinishingForm = (item) => {
    if (!item) return; 
    setSelectedSpkId(item.id);
    setFinishingForm({ 
      finishing_type: item.finishing_type || 'inhouse', 
      sub_vendor_name: item.sub_vendor_name || '', 
      qty_finish_sub_out: item.qty_finish_sub_out || 0, 
      qty_finish: item.qty_finish || 0 
    });
  };

  const handlePackingLoginSubmit = (e) => {
    e.preventDefault();
    if (packingUsername.trim() && packingPassword.trim()) {
      const sessionData = { username: packingUsername.trim(), loginTime: new Date().toISOString() };
      localStorage.setItem('packing_staff_session', JSON.stringify(sessionData));
      setPackingStaffSession(sessionData);
      setShowPackingLoginModal(false);
      alert('✅ Berhasil Login Staf Paking!');
    } else {
      alert('⚠️ Masukkan nama staf dan password dengan benar!');
    }
  };

  const handleKawanLamaAdminLogin = (e) => {
    e.preventDefault();
    if (klAdminUser.trim() === 'admin_kl' && klAdminPass.trim() === 'kawanlama2026') {
      const sessionData = { username: 'Admin Kawan Lama', loginTime: new Date().toISOString() };
      localStorage.setItem('kl_special_admin_session', JSON.stringify(sessionData));
      setCurrentKawanLamaAdmin(sessionData);
      setShowKawanLamaAdminModal(false);
      setActiveTab('label');
      alert('✅ Berhasil Login sebagai Admin Kawan Lama!');
    } else {
      alert('❌ Username atau Password Admin Kawan Lama salah! (Gunakan: admin_kl / kawanlama2026)');
    }
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));
  const getStatusBadge = (p) => p >= 100 ? { text: 'text-green-800 bg-green-100', icon: '🟢' } : p > 0 ? { text: 'text-yellow-800 bg-yellow-100', icon: '🟡' } : { text: 'text-red-800 bg-red-100', icon: '🔴' };

  const totalSpk = spkList.length;
  const displayedList = spkList.filter(item => 
    (item.no_spk || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.project || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.store_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // LOGIKA AUTENTIKASI AMAN & TERPISAH
  const isAuthenticated = scanParam 
    ? (packingStaffSession || currentAdmin || currentKawanLamaAdmin) 
    : isBranchMode 
      ? currentBranch 
      : (currentAdmin || currentKawanLamaAdmin);

  if (!isAuthenticated && scanParam) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-slate-100 text-stone-800'}`}>
        <div className={`max-w-md w-full p-8 rounded-3xl border shadow-2xl text-center space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
          <div className="text-5xl">📦</div>
          <div>
            <h1 className="text-xl font-black uppercase text-indigo-600 dark:text-indigo-400">Login Staf Paking</h1>
            <p className="text-xs opacity-60 mt-1">Scan QR Code Terdeteksi. Harap login untuk verifikasi paking.</p>
          </div>
          
          <form onSubmit={handlePackingLoginSubmit} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold block mb-1">Nama Staf / ID:</label>
              <input type="text" value={packingUsername} onChange={(e) => setPackingUsername(e.target.value)} placeholder="Contoh: Budi Paking" required className="w-full px-4 py-3 rounded-xl border text-xs bg-stone-50 dark:bg-neutral-900 dark:border-neutral-700" />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">PIN / Password:</label>
              <input type="password" value={packingPassword} onChange={(e) => setPackingPassword(e.target.value)} placeholder="Masukkan PIN" required className="w-full px-4 py-3 rounded-xl border text-xs bg-stone-50 dark:bg-neutral-900 dark:border-neutral-700" />
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer">
              🚀 MASUK KE PANEL PAKING
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-white' : 'bg-slate-100 text-stone-800'}`}>
        <div className={`max-w-md w-full p-8 rounded-3xl border shadow-2xl text-center space-y-6 ${isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'}`}>
          <div className="text-5xl">🔐</div>
          <div>
            <h1 className="text-xl font-black uppercase text-indigo-600 dark:text-indigo-400">Web-Track Monitoring</h1>
            <p className="text-xs opacity-60 mt-1">Sistem Terpadu Manajemen SPK & Kawan Lama</p>
          </div>
          
          <div className="space-y-3 pt-2">
            {isBranchMode ? (
              <button 
                onClick={() => setShowBranchLoginModal(true)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                🏢 LOGIN CABANG KAWAN LAMA
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setShowAdminLoginModal(true)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  🔑 LOGIN ADMIN PUSAT
                </button>
                <button 
                  onClick={() => setShowKawanLamaAdminModal(true)}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  🏢 LOGIN ADMIN KAWAN LAMA (3 Tab)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Modal Login Admin Kawan Lama */}
        {showKawanLamaAdminModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className={`max-w-sm w-full p-6 rounded-3xl border shadow-2xl space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'}`}>
              <h3 className="text-sm font-black uppercase text-emerald-600">Login Admin Kawan Lama</h3>
              <p className="text-[11px] opacity-70">Akses khusus: Cetak Label & SJ, Project Kawan Lama, dan Customer & Label Custom.</p>
              
              <form onSubmit={handleKawanLamaAdminLogin} className="space-y-3">
                <div>
                  <label className="text-xs font-bold block mb-1">Username:</label>
                  <input type="text" value={klAdminUser} onChange={(e) => setKlAdminUser(e.target.value)} placeholder="admin_kl" required className="w-full px-3 py-2.5 rounded-xl border text-xs bg-stone-50 dark:bg-neutral-900 dark:border-neutral-700" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Password:</label>
                  <input type="password" value={klAdminPass} onChange={(e) => setKlAdminPass(e.target.value)} placeholder="kawanlama2026" required className="w-full px-3 py-2.5 rounded-xl border text-xs bg-stone-50 dark:bg-neutral-900 dark:border-neutral-700" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowKawanLamaAdminModal(false)} className="w-1/2 py-2.5 rounded-xl font-bold text-xs bg-stone-300 dark:bg-neutral-700">Batal</button>
                  <button type="submit" className="w-1/2 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white">Masuk</button>
                </div>
              </form>
            </div>
          </div>
        )}

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
          onClose={() => setShowBranchLoginModal(false)}
          onLoginSuccess={(branch) => { 
            setCurrentBranch(branch); 
            localStorage.setItem('kl_branch_session', JSON.stringify(branch)); 
            setShowBranchLoginModal(false); 
          }} 
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-[#F4F5F7] text-stone-800'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-3xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-stone-200/80'}`}>
          <div>
            <h1 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-blue-400' : 'text-indigo-600'}`}>
              {scanParam ? '📦 PANEL STAF PAKING (QR SCAN MODE)' : (isBranchMode ? 'FORM CABANG KAWAN LAMA' : (currentKawanLamaAdmin ? '🏢 PORTAL ADMIN KAWAN LAMA' : 'WEB-TRACK MONITORING'))}
            </h1>
            <p className={`text-xs mt-0.5 font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              {scanParam ? `Staf Login: ${packingStaffSession?.username || 'Staf Paking'}` : (isBranchMode ? `Login Cabang: ${currentBranch?.branch_name || 'Aktif'}` : (currentKawanLamaAdmin ? 'Login: Admin Kawan Lama (Akses 3 Tab)' : `Admin Login: ${currentAdmin?.username || 'Aktif'}`))}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleTheme} className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-yellow-300 border-neutral-600' : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'}`}>
              {isDarkMode ? '☀️ Tema Terang' : '🌙 Tema Gelap'}
            </button>
            {scanParam && (
              <button onClick={() => { localStorage.removeItem('packing_staff_session'); setPackingStaffSession(null); window.location.href = window.location.pathname; }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95">
                🔒 Logout Paking
              </button>
            )}
            {isBranchMode && (
              <button onClick={() => { localStorage.removeItem('kl_branch_session'); setCurrentBranch(null); window.location.reload(); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95">
                🔒 Logout Cabang
              </button>
            )}
            {currentKawanLamaAdmin && (
              <button onClick={() => { localStorage.removeItem('kl_special_admin_session'); setCurrentKawanLamaAdmin(null); window.location.reload(); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95 cursor-pointer">
                🔒 Logout Admin Kawan Lama
              </button>
            )}
          </div>
        </div>

        {/* JIKA DIAKSES VIA SCAN QR */}
        {scanParam ? (
          <PackingPanel isDarkMode={isDarkMode} spkList={displayedList} handleUpdateField={handleUpdateField} onOpenImageModal={openImageModal} />
        ) : (
          <>
            {/* JIKA MODE CABANG */}
            {isBranchMode ? (
              <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentBranch} isBranchMode={true} />
            ) : (
              /* JIKA LOGIN SEBAGAI ADMIN KAWAN LAMA (Eksklusif 3 Tab) */
              currentKawanLamaAdmin ? (
                <div className="space-y-4">
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {[
                      { id: 'label', label: '🏷️ Cetak Label & SJ' },
                      { id: 'kawan_lama', label: '🏢 Project Kawan Lama' },
                      { id: 'custom_modules', label: '👥 Customer & Label Custom' }
                    ].map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id)} 
                        className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                          activeTab === t.id 
                            ? 'bg-emerald-600 text-white shadow-md' 
                            : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200/80')
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'label' && <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />}
                  {activeTab === 'kawan_lama' && <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentKawanLamaAdmin} isBranchMode={false} />}
                  {activeTab === 'custom_modules' && <CustomModulesIndex isDarkMode={isDarkMode} />}
                </div>
              ) : (
                /* TAMPILAN NORMAL UNTUK ADMIN PUSAT */
                <>
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {['dashboard', 'design', 'produksi', 'finishing', 'paking', 'pengiriman', 'label', 'kawan_lama', 'custom_modules'].map(t => {
                      const isLocked = t === 'kawan_lama' && !currentAdmin;

                      return (
                        <button 
                          key={t} 
                          onClick={() => !isLocked && setActiveTab(t)} 
                          disabled={isLocked}
                          title={isLocked ? "Silakan Login Admin terlebih dahulu" : ""}
                          className={`px-4 py-2.5 rounded-2xl text-xs font-bold capitalize transition-all whitespace-nowrap shadow-sm 
                            ${isLocked 
                              ? (isDarkMode ? 'bg-neutral-900/50 text-neutral-600 border border-neutral-800 cursor-not-allowed' : 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed opacity-70')
                              : activeTab === t 
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : (isDarkMode ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 border border-neutral-700' : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200/80')
                            }`}
                        >
                          {t === 'label' 
                            ? '🏷️ Cetak Label & SJ' 
                            : t === 'kawan_lama' 
                              ? (isLocked ? '🔒 Project Kawan Lama' : '🏢 Project Kawan Lama') 
                              : t === 'design'
                                ? '🎨 Desain & Pra-Cetak'
                                : t === 'custom_modules'
                                  ? '👥 Customer & Label Custom'
                                  : t}
                        </button>
                      );
                    })}
                  </div>

                  {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <CircularGaugeCard title="Total SPK" percent={100} color="#4F46E5" detailText={`${totalSpk} Data Aktif`} />
                      <CircularGaugeCard title="Produksi" percent={80} color="#D97706" detailText="Print & Finish" />
                      <CircularGaugeCard title="Paking" percent={60} color="#9333EA" detailText="Siap Kirim" />
                      <CircularGaugeCard title="Terkirim" percent={40} color="#0D9488" detailText="Delivery Done" />
                    </div>
                  )}

                  {activeTab === 'design' && (
                    <DesignPanel isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
                  )}

                  {activeTab === 'finishing' && (
                    <FinishingPanel isDarkMode={isDarkMode} spkList={spkList} fetchSpkData={fetchSpkData} />
                  )}

                  {activeTab === 'paking' && (
                    <PackingPanel isDarkMode={isDarkMode} spkList={displayedList} handleUpdateField={handleUpdateField} onOpenImageModal={openImageModal} />
                  )}

                  {activeTab === 'kawan_lama' && (
                    <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentAdmin} isBranchMode={false} />
                  )}
                  
                  {activeTab === 'label' && (
                    <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
                  )}

                  {activeTab === 'custom_modules' && (
                    <CustomModulesIndex isDarkMode={isDarkMode} />
                  )}

                  {activeTab !== 'label' && activeTab !== 'kawan_lama' && activeTab !== 'design' && activeTab !== 'custom_modules' && activeTab !== 'paking' && activeTab !== 'dashboard' && activeTab !== 'finishing' && (
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
                      handleDeleteSpk={handleDeleteSpk}
                      handleBatchDelete={handleBatchDelete}
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
                </>
              )
            )}
          </>
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
        onClose={() => setShowBranchLoginModal(false)}
        onLoginSuccess={(branch) => { 
          setCurrentBranch(branch); 
          localStorage.setItem('kl_branch_session', JSON.stringify(branch)); 
          setShowBranchLoginModal(false); 
        }} 
      />
    </div>
  );
}