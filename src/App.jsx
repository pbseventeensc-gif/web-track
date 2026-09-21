import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,
  Palette,
  Printer,
  Scissors,
  Package,
  Truck,
  Tag,
  Building2,
  Users,
  Lock,
  Camera,
  FileSpreadsheet,
  Globe,
  Sun,
  Moon,
  LogOut,
  Layers,
  Box,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
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

// Daftar 4 User Staf Paking Resmi
const PACKING_USERS = [
  { id: 'paking_1', name: 'Staf Paking 1 (Budi)', pin: '1111' },
  { id: 'paking_2', name: 'Staf Paking 2 (Siti)', pin: '2222' },
  { id: 'paking_3', name: 'Staf Paking 3 (Joko)', pin: '3333' },
  { id: 'paking_4', name: 'Staf Paking 4 (Ani)', pin: '4444' }
];

function DonutStatCard({
  centerValue,
  centerLabel,
  percent = 0,
  items = [],
  description,
  isDarkMode
}) {
  const radius = 36;
  const strokeWidth = 9;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference - (safePercent / 100) * circumference;

  return (
    <div className={`p-6 rounded-2xl border shadow-sm transition-all flex flex-col sm:flex-row items-center gap-6 ${
      isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-slate-200'
    }`}>
      {/* Left Donut Ring Chart */}
      <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={isDarkMode ? '#374151' : '#E2E8F0'}
            strokeWidth={strokeWidth}
            className="fill-none"
          />
          {safePercent > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#EA580C"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="fill-none transition-all duration-700 ease-out"
            />
          )}
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center px-2">
          <span
            className="text-2xl font-black tracking-tight"
            style={{ color: isDarkMode ? '#FFFFFF' : '#0F172A' }}
          >
            {centerValue}
          </span>
          {centerLabel && (
            <span
              className="text-xs font-bold leading-tight mt-1"
              style={{ color: isDarkMode ? '#E2E8F0' : '#334155' }}
            >
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      {/* Right Breakdown List */}
      <div className="flex-1 w-full space-y-3">
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.active ? '#EA580C' : '#94A3B8' }}
                />
                <span
                  className="font-bold text-sm"
                  style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                >
                  {item.label}
                </span>
              </div>
              <span
                className="font-extrabold text-sm"
                style={{ color: isDarkMode ? '#FFFFFF' : '#000000' }}
              >
                {item.value} {item.percent !== undefined && `· ${item.percent}%`}
              </span>
            </div>
          ))}
        </div>

        {description && (
          <p
            className="text-xs font-semibold pt-3 border-t leading-relaxed"
            style={{
              color: isDarkMode ? '#CBD5E1' : '#475569',
              borderColor: isDarkMode ? '#374151' : '#E2E8F0'
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isBranchMode = searchParams.get('mode') === 'cabang';
  const scanParam = searchParams.get('scan'); 

  const [spkList, setSpkList] = useState([]);
  
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
  const [selectedPackingUser, setSelectedPackingUser] = useState(PACKING_USERS[0].id);
  const [packingPin, setPackingPin] = useState('');

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

  const handlePackingLoginSubmit = (e) => {
    e.preventDefault();
    const foundUser = PACKING_USERS.find(u => u.id === selectedPackingUser);
    if (foundUser && foundUser.pin === packingPin.trim()) {
      const sessionData = { username: foundUser.name, loginTime: new Date().toISOString() };
      localStorage.setItem('packing_staff_session', JSON.stringify(sessionData));
      setPackingStaffSession(sessionData);
      alert(`✅ Selamat datang, ${foundUser.name}!`);
    } else {
      alert('❌ PIN Staf Paking salah! (Gunakan PIN sesuai akun masing-masing: 1111, 2222, 3333, atau 4444)');
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
      alert('❌ Username atau Password Admin Kawan Lama salah!');
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
            <p className="text-xs opacity-60 mt-1">Pilih nama Anda dan masukkan PIN untuk verifikasi paking.</p>
          </div>
          
          <form onSubmit={handlePackingLoginSubmit} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold block mb-1">Pilih Staf Paking:</label>
              <select 
                value={selectedPackingUser} 
                onChange={(e) => setSelectedPackingUser(e.target.value)} 
                className="w-full px-4 py-3 rounded-xl border text-xs bg-stone-50 dark:bg-neutral-900 dark:border-neutral-700 cursor-pointer font-bold"
              >
                {PACKING_USERS.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">PIN Keamanan:</label>
              <input 
                type="password" 
                value={packingPin} 
                onChange={(e) => setPackingPin(e.target.value)} 
                placeholder="Masukkan 4 digit PIN" 
                maxLength={4}
                required 
                className="w-full px-4 py-3 rounded-xl border text-xs bg-stone-50 dark:bg-neutral-900 dark:border-neutral-700 tracking-widest text-center font-bold text-lg" 
              />
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
              <button onClick={() => setShowBranchLoginModal(true)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer">
                🏢 LOGIN CABANG KAWAN LAMA
              </button>
            ) : (
              <>
                <button onClick={() => setShowAdminLoginModal(true)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer">
                  🔑 LOGIN ADMIN PUSAT
                </button>
                <button onClick={() => setShowKawanLamaAdminModal(true)} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer">
                  🏢 LOGIN ADMIN KAWAN LAMA (3 Tab)
                </button>
              </>
            )}
          </div>
        </div>

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

        <AdminLoginModal isOpen={showAdminLoginModal} onClose={() => setShowAdminLoginModal(false)} onLoginSuccess={(admin) => { localStorage.setItem('kl_admin_session', JSON.stringify(admin)); setCurrentAdmin(admin); setShowAdminLoginModal(false); }} />
        <BranchLoginModal isOpen={showBranchLoginModal} onClose={() => setShowBranchLoginModal(false)} onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 sm:p-6 font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-[#F4F5F7] text-stone-800'}`}>
      <div className="max-w-[1700px] w-full mx-auto space-y-6">
        
        {/* HEADER BAR */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-3xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-stone-200/80'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`text-lg font-extrabold tracking-tight ${isDarkMode ? 'text-neutral-100' : 'text-stone-800'}`}>
                {scanParam ? 'PANEL STAF PAKING (QR SCAN MODE)' : (isBranchMode ? 'FORM CABANG KAWAN LAMA' : (currentKawanLamaAdmin ? 'PORTAL ADMIN KAWAN LAMA' : 'WEB-TRACK MONITORING'))}
              </h1>
              <p className={`text-xs font-medium ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                {scanParam ? `Staf Paking Login: ${packingStaffSession?.username || 'Aktif'}` : (isBranchMode ? `Login Cabang: ${currentBranch?.branch_name || 'Aktif'}` : (currentKawanLamaAdmin ? 'Login: Admin Kawan Lama (Akses 3 Tab)' : `Admin Login: ${currentAdmin?.username || 'Aktif'}`))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3 sm:mt-0">
            <button onClick={toggleTheme} className={`px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm cursor-pointer ${isDarkMode ? 'bg-neutral-700 hover:bg-neutral-600 text-amber-300 border-neutral-600' : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'}`}>
              {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-stone-600" />}
              <span>{isDarkMode ? 'Tema Terang' : 'Tema Gelap'}</span>
            </button>

            {scanParam && (
              <button onClick={() => { localStorage.removeItem('packing_staff_session'); setPackingStaffSession(null); window.location.href = window.location.pathname; }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer">
                <LogOut className="w-3.5 h-3.5" /> Logout Staf Paking
              </button>
            )}
            {isBranchMode && (
              <button onClick={() => { localStorage.removeItem('kl_branch_session'); setCurrentBranch(null); window.location.reload(); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer">
                <LogOut className="w-3.5 h-3.5" /> Logout Cabang
              </button>
            )}
            {currentKawanLamaAdmin && (
              <button onClick={() => { localStorage.removeItem('kl_special_admin_session'); setCurrentKawanLamaAdmin(null); window.location.reload(); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer">
                <LogOut className="w-3.5 h-3.5" /> Logout Admin KL
              </button>
            )}
            {currentAdmin && (
              <button onClick={() => { localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard'); }} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer">
                <LogOut className="w-3.5 h-3.5" /> Logout Admin
              </button>
            )}
          </div>
        </div>

        {/* MAIN BODY AREA */}
        {scanParam ? (
          <PackingPanel isDarkMode={isDarkMode} spkList={displayedList} handleUpdateField={handleUpdateField} onOpenImageModal={openImageModal} />
        ) : (
          <>
            {isBranchMode ? (
              <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentBranch} isBranchMode={true} />
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* MODERN SIDEBAR NAVIGATION (COMPACT LEFT) */}
                <div className={`w-full lg:w-60 flex-shrink-0 rounded-3xl p-4 border shadow-sm space-y-5 sticky top-6 transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-stone-200/80 text-stone-800'}`}>

                  {currentKawanLamaAdmin ? (
                    <div>
                      <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-400 px-3 mb-2">
                        Portal Admin Kawan Lama
                      </h3>
                      <div className="space-y-1">
                        {[
                          { id: 'label', label: 'Cetak Label & SJ', icon: Tag },
                          { id: 'kawan_lama', label: 'Project Kawan Lama', icon: Building2 },
                          { id: 'custom_modules', label: 'Customer & Label Custom', icon: Users }
                        ].map(item => {
                          const isActive = activeTab === item.id;
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActiveTab(item.id)}
                              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                                  : 'text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-neutral-700/60 font-semibold'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <ItemIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`} />
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                              </div>
                              {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* GROUP 1: PRODUKSI & MONITORING */}
                      <div>
                        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-400 px-3 mb-2">
                          Produksi & Monitoring
                        </h3>
                        <div className="space-y-1">
                          {[
                            { id: 'dashboard', label: 'Production Dashboard', icon: LayoutDashboard },
                            { id: 'design', label: 'Desain & Pra-Cetak', icon: Palette },
                            { id: 'produksi', label: 'Produksi Cetak', icon: Printer },
                            { id: 'finishing', label: 'Finishing Panel', icon: Scissors },
                            { id: 'paking', label: 'Paking Station', icon: Package },
                            { id: 'pengiriman', label: 'Pengiriman & SJ', icon: Truck }
                          ].map(item => {
                            const isActive = activeTab === item.id;
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                                    : 'text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-neutral-700/60 font-semibold'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <ItemIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`} />
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</span>
                                </div>
                                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* GROUP 2: PROJECT & CUSTOM MODUL */}
                      <div>
                        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-neutral-400 px-3 mb-2">
                          Project & Custom Modul
                        </h3>
                        <div className="space-y-1">
                          {[
                            { id: 'label', label: 'Cetak Label & SJ', icon: Tag },
                            { id: 'kawan_lama', label: 'Project Kawan Lama', icon: Building2 },
                            { id: 'custom_modules', label: 'Customer & Label Custom', icon: Users }
                          ].map(item => {
                            const isLocked = item.id === 'kawan_lama' && !currentAdmin;
                            const isActive = activeTab === item.id;
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => !isLocked && setActiveTab(item.id)}
                                disabled={isLocked}
                                title={isLocked ? "Silakan Login Admin terlebih dahulu" : ""}
                                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                                  isLocked
                                    ? 'text-slate-400 dark:text-neutral-500 cursor-not-allowed bg-stone-50/50 dark:bg-neutral-900/40'
                                    : isActive
                                      ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                                      : 'text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-neutral-700/60 font-semibold'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <ItemIcon className={`w-4 h-4 ${isActive ? 'text-white' : (isLocked ? 'text-stone-300 dark:text-neutral-600' : 'text-stone-400 dark:text-neutral-400')}`} />
                                  <span>{item.label}</span>
                                </div>
                                {isLocked ? (
                                  <Lock className="w-3.5 h-3.5 text-amber-500/80" />
                                ) : (
                                  isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* MAIN PANEL CONTENT (MAXIMIZED RIGHT AREA) */}
                <div className="flex-1 min-w-0 space-y-6">
                  {activeTab === 'dashboard' && (() => {
                    const printDone = spkList.filter(s => Number(s.qty_print) > 0 && Number(s.qty_print) >= Number(s.qty_order || 1)).length;
                    const finishDone = spkList.filter(s => Number(s.qty_finish) > 0 && Number(s.qty_finish) >= Number(s.qty_order || 1)).length;
                    const packDone = spkList.filter(s => Number(s.qty_pack) > 0 && Number(s.qty_pack) >= Number(s.qty_order || 1)).length;
                    const shipDone = spkList.filter(s => Number(s.qty_ship) > 0 && Number(s.qty_ship) >= Number(s.qty_order || 1)).length;

                    const shipPercent = totalSpk > 0 ? Math.round((shipDone / totalSpk) * 100) : 0;
                    const finishPercent = totalSpk > 0 ? Math.round((finishDone / totalSpk) * 100) : 0;
                    const packPercent = totalSpk > 0 ? Math.round((packDone / totalSpk) * 100) : 0;
                    const printPercent = totalSpk > 0 ? Math.round((printDone / totalSpk) * 100) : 0;

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <DonutStatCard
                          isDarkMode={isDarkMode}
                          centerValue={`${shipPercent}%`}
                          centerLabel={`${shipDone} dari ${totalSpk} SPK`}
                          percent={shipPercent}
                          items={[
                            { label: 'Selesai Terkirim (Shipped)', value: `${shipDone} SPK`, percent: shipPercent, active: true },
                            { label: 'Belum Terkirim / Dalam Proses', value: `${totalSpk - shipDone} SPK`, percent: 100 - shipPercent, active: false }
                          ]}
                          description={`Dari total ${totalSpk} SPK aktif, ${shipDone} SPK telah menyelesaikan seluruh tahapan pengiriman.`}
                        />

                        <DonutStatCard
                          isDarkMode={isDarkMode}
                          centerValue={`${finishPercent}%`}
                          centerLabel={`${finishDone} dari ${totalSpk} SPK`}
                          percent={finishPercent}
                          items={[
                            { label: 'Selesai Finishing', value: `${finishDone} SPK`, percent: finishPercent, active: true },
                            { label: 'Proses Cetak & Pra-Cetak', value: `${totalSpk - finishDone} SPK`, percent: 100 - finishPercent, active: false }
                          ]}
                          description={`Total ${finishDone} SPK telah menyelesaikan pengerjaan finishing dan siap paking.`}
                        />

                        <DonutStatCard
                          isDarkMode={isDarkMode}
                          centerValue={`${packPercent}%`}
                          centerLabel={`${packDone} dari ${totalSpk} SPK`}
                          percent={packPercent}
                          items={[
                            { label: 'Selesai Paking Station', value: `${packDone} SPK`, percent: packPercent, active: true },
                            { label: 'Proses Paking / Antrean', value: `${totalSpk - packDone} SPK`, percent: 100 - packPercent, active: false }
                          ]}
                          description={`Sebanyak ${packDone} SPK telah dibungkus dan ditempeli stiker pengiriman.`}
                        />

                        <DonutStatCard
                          isDarkMode={isDarkMode}
                          centerValue={`${printPercent}%`}
                          centerLabel={`${printDone} dari ${totalSpk} SPK`}
                          percent={printPercent}
                          items={[
                            { label: 'Selesai Cetak (Printed)', value: `${printDone} SPK`, percent: printPercent, active: true },
                            { label: 'Belum Dicetak', value: `${totalSpk - printDone} SPK`, percent: 100 - printPercent, active: false }
                          ]}
                          description={`Pencatatan kuantitas produksi cetak SPK aktif di sistem.`}
                        />
                      </div>
                    );
                  })()}

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
                    <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentKawanLamaAdmin || currentAdmin} isBranchMode={false} />
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
                </div>

              </div>
            )}
          </>
        )}

      </div>

      <ScanQCModal isOpen={showScanModal} onClose={() => setShowScanModal(false)} isDarkMode={isDarkMode} scanTargetColumn={scanTargetColumn} setScanTargetColumn={setScanTargetColumn} scannedInput={scannedInput} setScannedInput={setScannedInput} handleSubmitInput={handleSubmitInput} lastScanMessage={lastScanMessage} />
      <ImagePreviewModal isOpen={modalImageInfo.isOpen} onClose={closeImageModal} modalImageInfo={modalImageInfo} />
      <AdminLoginModal isOpen={showAdminLoginModal} onClose={() => setShowAdminLoginModal(false)} onLoginSuccess={(admin) => { localStorage.setItem('kl_admin_session', JSON.stringify(admin)); setCurrentAdmin(admin); setShowAdminLoginModal(false); }} />
      <BranchLoginModal isOpen={showBranchLoginModal} onClose={() => setShowBranchLoginModal(false)} onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} />
    </div>
  );
}