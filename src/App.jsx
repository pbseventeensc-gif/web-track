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
  const scanParam = searchParams.get('scan'); // Tangkap parameter scan dari QR Code

  const [spkList, setSpkList] = useState([]);
  const [activeTab, setActiveTab] = useState(isBranchMode ? 'kawan_lama' : (scanParam ? 'paking' : 'dashboard'));
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
  const [isImporting, setIsImporting] = useState(false);

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

  // Jika ada parameter scan di URL, otomatis arahkan ke tab paking
  useEffect(() => {
    if (scanParam) {
      setActiveTab('paking');
    }
  }, [scanParam]);

  useEffect(() => { 
    if (isBranchMode && !currentBranch) {
      setShowBranchLoginModal(true); 
    }
  }, [isBranchMode, currentBranch]);

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

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId); 
    const item = spkList.find(s => String(s.id) === String(spkId));
    if (item) {
      setFinishingForm({ 
        finishing_type: item.finishing_type || 'inhouse', 
        sub_vendor_name: item.sub_vendor_name || '', 
        qty_finish_sub_out: item.qty_finish_sub_out || 0, 
        qty_finish: item.qty_finish || 0 
      });
    }
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds(prev => { 
      const exist = prev.includes(id); 
      if (!exist) handleSelectSpk(id); 
      return exist ? prev.filter(item => item !== id) : [...prev, id]; 
    });
  };

  const handleToggleSelectAll = (filteredItems) => {
    if (selectedSpkIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedSpkIds([]);
    } else { 
      setSelectedSpkIds(filteredItems.map(item => item.id)); 
      if (filteredItems.length > 0) handleSelectSpk(filteredItems[0].id); 
    }
  };

  const handleUpdateField = async (id, payload) => {
    const { error } = await supabase.from('spk_data').update(payload).eq('id', id);
    if (!error) {
      setSpkList(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
    } else {
      alert('Gagal memperbarui data: ' + error.message);
    }
  };

  const handleUpdateQty = async (id, field, value, maxAllowed, customErrorMessage) => {
    const val = Number(value) || 0;
    if (maxAllowed && val > maxAllowed) return alert(customErrorMessage || `❌ Gagal: Jumlah tidak boleh melebihi ${maxAllowed.toLocaleString()} pcs!`);
    handleUpdateField(id, { [field]: val });
  };

  const handleDeleteSpk = async (id, noSpk) => {
    if (confirm(`⚠️ Hapus data SPK "${noSpk || id}" dari sistem?`)) {
      const { error } = await supabase.from('spk_data').delete().eq('id', id);
      if (!error) {
        setSpkList(prev => prev.filter(item => item.id !== id));
        setSelectedSpkIds(prev => prev.filter(selectedId => selectedId !== id));
        alert(`✅ SPK "${noSpk}" berhasil dihapus.`);
      } else {
        alert('Gagal menghapus SPK: ' + error.message);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedSpkIds.length === 0) return alert('⚠️ Silakan centang minimal 1 SPK yang ingin dihapus!');
    if (confirm(`🚨 YAKIN HAPUS ${selectedSpkIds.length} DATA SPK TERPILIH? Tindakan ini tidak dapat dibatalkan.`)) {
      const { error } = await supabase.from('spk_data').delete().in('id', selectedSpkIds);
      if (!error) {
        setSpkList(prev => prev.filter(item => !selectedSpkIds.includes(item.id)));
        setSelectedSpkIds([]);
        alert('✅ Semua SPK terpilih berhasil dibersihkan.');
      } else {
        alert('Gagal hapus massal: ' + error.message);
      }
    }
  };

  const handleProcessScan = async (codeValue) => {
    if (!codeValue) return;
    const cleanCode = codeValue.toString().replace(/[\r\n]+/g, '').trim().toLowerCase();
    const targetItem = spkList.find(item => 
      (item.qr_address || '').toLowerCase().includes(cleanCode) || 
      (item.store_code || '').toLowerCase() === cleanCode || 
      (item.no_spk || '').toLowerCase().includes(cleanCode) || 
      (item.project || '').toLowerCase().includes(cleanCode)
    );
    if (!targetItem) { 
      setLastScanMessage(`❌ SPK "${cleanCode}" tidak ditemukan!`); 
      setScannedInput(''); 
      return; 
    }
    
    const updaterValue = qcStaffName ? `${qcStaffName} (OK)` : 'VERIFIED (OK)';
    let updatePayload = { tes_scan: updaterValue };
    if (scanTargetColumn === 'qc_paking') updatePayload.qc_paking = updaterValue;
    if (scanTargetColumn === 'qc_checker') updatePayload.qc_checker = updaterValue;
    if (scanTargetColumn === 'qc_deliver') updatePayload.qc_deliver = updaterValue;
    if (scanTargetColumn === 'qty_finish') updatePayload.qty_finish = targetItem.qty_order;

    await handleUpdateField(targetItem.id, updatePayload);
    setLastScanMessage(`✅ SUKSES UPDATE SPK ${targetItem.no_spk}!`); 
    setScannedInput('');
  };

  const handleSubmitInput = (e) => { e.preventDefault(); handleProcessScan(scannedInput); };

  const handleBatchPrint = async () => {
    const items = spkList.filter(item => selectedSpkIds.includes(item.id));
    if (items.length === 0) return alert('⚠️ Centang minimal 1 SPK!');
    const html = items.map(item => `<div style="page-break-after:always; padding:20px; font-family:Arial; border:2px solid #000;"><h2>STORE: ${item.project}</h2><p>SPK: ${item.no_spk}</p></div>`).join('');
    const pw = window.open('', '_blank', 'width=800,height=800'); 
    pw.document.write(`<html><body>${html}</body></html>`); 
    pw.document.close(); 
    setTimeout(() => pw.print(), 500);
  };

  const handleUploadSuratJalan = async (e, item) => {
    const file = e.target.files[0]; 
    if (!file) return;
    const fileName = `sj_${item.no_spk}_${Date.now()}`;
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      handleUpdateField(item.id, { surat_jalan_url: data.publicUrl });
      alert('Surat Jalan Diunggah!');
    }
  };

  const processImportData = async (rawRows) => {
    const formattedData = rawRows
      .filter(row => row && row.length > 7) 
      .map((row, index) => {
        const colF = row[5] ? String(row[5]).trim() : ''; 
        const colG = row[6] ? String(row[6]).trim() : ''; 
        const colH = row[7] ? String(row[7]).trim() : ''; 

        if (!colF && !colG && !colH) return null;

        return {
          no_spk: colH.split('_')[0] || `SPK-${index + 1}`,
          client: colF || '-',
          project: colG || '-',
          bahan: null,       
          ukuran: null,      
          qty_order: null,   
          qty_print: 0, 
          qty_finish: 0, 
          qty_pack: 0, 
          qty_ship: 0,
          store_code: colH || '-',
          delivery_route: '-'
        };
      })
      .filter(item => item !== null);

    if (formattedData.length > 0) {
      const { error } = await supabase.from('spk_data').insert(formattedData);
      if (error) {
        alert("❌ Error saat menyimpan ke database: " + error.message);
      } else {
        alert(`✅ Sukses! ${formattedData.length} data berhasil diimpor.`);
        await fetchSpkData();
      }
    } else {
      alert("⚠️ Tidak ada data ditemukan pada Kolom F, G, H mulai baris ke-5.");
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 4, header: 1 });
      await processImportData(rawData);
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const handleGoogleSheetImport = async () => {
    const sheetUrl = prompt("🌐 Masukkan URL Link Google Sheets (Pastikan akses disetel 'Anyone with the link can view' / Publik):");
    if (!sheetUrl) return;

    setIsImporting(true);
    try {
      let csvUrl = sheetUrl.trim();
      if (csvUrl.includes('/edit')) {
        csvUrl = csvUrl.replace(/\/edit.*$/, '/export?format=csv');
      }
      if (!csvUrl.includes('format=csv')) {
        csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'format=csv';
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Gagal mengambil data (Status: ${response.status}). Pastikan link Google Sheets sudah publik.`);
      }
      
      const csvText = await response.text();
      const workbook = XLSX.read(csvText, { type: 'string' });
      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 4, header: 1 });
      
      await processImportData(rawData);
    } catch (err) {
      alert("❌ Terjadi kesalahan saat import Google Sheets: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));
  const getStatusBadge = (p) => p >= 100 ? { text: 'text-green-800 bg-green-100', icon: '🟢' } : p > 0 ? { text: 'text-yellow-800 bg-yellow-100', icon: '🟡' } : { text: 'text-red-800 bg-red-100', icon: '🔴' };

  const totalSpk = spkList.length;
  const displayedList = spkList.filter(item => 
    (item.no_spk || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.project || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.client || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAuthenticated = currentAdmin || (isBranchMode ? currentBranch : false);

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
            <button 
              onClick={() => setShowAdminLoginModal(true)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95"
            >
              🔑 LOGIN ADMIN PUSAT
            </button>
            <button 
              onClick={() => setShowBranchLoginModal(true)}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95"
            >
              🏢 LOGIN CABANG KAWAN LAMA
            </button>
          </div>
        </div>

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
              {isBranchMode ? 'FORM CABANG KAWAN LAMA' : 'WEB-TRACK MONITORING'}
            </h1>
            <p className={`text-xs mt-0.5 font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
              {isBranchMode ? `Login Cabang: ${currentBranch?.branch_name || 'Aktif'}` : `Admin Login: ${currentAdmin?.username || 'Aktif'}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={toggleTheme} className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-yellow-300 border-neutral-600' : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'}`}>
              {isDarkMode ? '☀️ Tema Terang' : '🌙 Tema Gelap'}
            </button>
            {currentAdmin && <button onClick={() => {localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard');}} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Admin</button>}
            {currentBranch && <button onClick={() => {localStorage.removeItem('kl_branch_session'); setCurrentBranch(null); window.location.reload();}} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm active:scale-95">🔒 Logout Cabang</button>}
            
            {!isBranchMode && (
              <>
                <button onClick={() => setShowScanModal(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95">
                  📷 Scan QC Station
                </button>
                <label className="px-4 py-2 rounded-2xl cursor-pointer text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white">
                  📁 Upload SPK Excel
                  <input type="file" accept=".xlsx" onChange={handleExcelUpload} className="hidden" />
                </label>
                <button 
                  onClick={handleGoogleSheetImport} 
                  disabled={isImporting}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 ${
                    isImporting ? 'bg-stone-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
                  } text-white`}
                >
                  {isImporting ? '⏳ Memproses...' : '🌐 Import Google Sheet'}
                </button>
              </>
            )}
          </div>
        </div>

        {!isBranchMode && (
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
        )}

        {!isBranchMode && activeTab === 'dashboard' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CircularGaugeCard title="Total SPK" percent={100} color="#4F46E5" detailText={`${totalSpk} Data Aktif`} />
            <CircularGaugeCard title="Produksi" percent={80} color="#D97706" detailText="Print & Finish" />
            <CircularGaugeCard title="Paking" percent={60} color="#9333EA" detailText="Siap Kirim" />
            <CircularGaugeCard title="Terkirim" percent={40} color="#0D9488" detailText="Delivery Done" />
          </div>
        )}

        {!isBranchMode && activeTab === 'design' && (
          <DesignPanel isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
        )}

        {!isBranchMode && activeTab === 'finishing' && (
          <FinishingPanel isDarkMode={isDarkMode} spkList={spkList} fetchSpkData={fetchSpkData} />
        )}

        {!isBranchMode && activeTab === 'paking' && (
          <PackingPanel isDarkMode={isDarkMode} spkList={spkList} handleUpdateField={handleUpdateField} onOpenImageModal={openImageModal} />
        )}

        {(isBranchMode || activeTab === 'kawan_lama') && (
          <KawanLamaTab isDarkMode={isDarkMode} currentUser={isBranchMode ? currentBranch : currentAdmin} isBranchMode={isBranchMode} />
        )}
        
        {!isBranchMode && activeTab === 'label' && (
          <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
        )}

        {!isBranchMode && activeTab === 'custom_modules' && (
          <CustomModulesIndex isDarkMode={isDarkMode} />
        )}

        {!isBranchMode && activeTab !== 'label' && activeTab !== 'kawan_lama' && activeTab !== 'design' && activeTab !== 'custom_modules' && activeTab !== 'paking' && (
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