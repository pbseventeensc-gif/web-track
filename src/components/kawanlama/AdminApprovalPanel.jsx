import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import * as XLSX from 'xlsx';
import {
  Bell,
  History,
  Search,
  Activity,
  Building2,
  Unlock,
  Check,
  Trash2,
  Download,
  ChevronUp,
  ChevronDown,
  X,
  AlertCircle
} from 'lucide-react';

export default function AdminApprovalPanel({ isDarkMode }) {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [approvedOrders, setApprovedOrders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedApprovedId, setExpandedApprovedId] = useState(null);
  const [searchApproved, setSearchApproved] = useState('');
  const [selectedApprovedIds, setSelectedApprovedIds] = useState([]);
  
  // State untuk Modal Log Audit & Pencarian
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [searchAudit, setSearchAudit] = useState('');
  
  // State untuk Notifikasi & Dropdown Lonceng
  const [notifications, setNotifications] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchOrders();
    fetchAuditLogs();

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotificationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // Setup Realtime Supabase Listener
    const channel = supabase
      .channel('kl_orders_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kl_orders' },
        (payload) => {
          fetchOrders(); 
          fetchAuditLogs();

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newStatus = payload.new.status;
            const newLock = payload.new.lock_status;
            if (newStatus === 'SUBMITTED' || newStatus === 'submitted' || newLock === 'REQUEST_UNLOCK' || newStatus === 'REQUEST_UNLOCK') {
              const msg = 'Terdapat pesanan masuk atau permohonan buka kunci baru dari cabang.';
              addNotification(msg);
              playBeepSound();
            }
          }
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      supabase.removeChannel(channel);
    };
  }, []);

  const addNotification = (message) => {
    const newNotif = {
      id: Date.now(),
      message,
      time: new Date().toLocaleTimeString('id-ID'),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const playBeepSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  };

  const fetchOrders = async () => {
    const { data: pendingData, error: pendingError } = await supabase
      .from('kl_orders')
      .select('*, kl_branches(branch_name), kl_order_items(*, kl_master_items(*))')
      .or('status.in.(SUBMITTED,submitted,REQUEST_UNLOCK,request_unlock),lock_status.eq.REQUEST_UNLOCK')
      .order('created_at', { ascending: false });

    if (!pendingError && pendingData) {
      setPendingOrders(pendingData);
    }

    const { data: approvedData, error: approvedError } = await supabase
      .from('kl_orders')
      .select('*, kl_branches(branch_name), kl_order_items(*, kl_master_items(*))')
      .in('status', ['APPROVED', 'approved'])
      .order('updated_at', { ascending: false });

    if (!approvedError && approvedData) {
      setApprovedOrders(approvedData);
    }
  };

  const fetchAuditLogs = async () => {
    const { data, error } = await supabase
      .from('kl_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15); 

    if (!error && data) {
      setAuditLogs(data);
    }
  };

  const recordAudit = async (actionText) => {
    await supabase.from('kl_audit_logs').insert([{ action: actionText }]);
    fetchAuditLogs();
  };

  const handleUpdateItemQty = async (itemId, newQty, itemName) => {
    const qty = Number(newQty) || 0;
    await supabase.from('kl_order_items').update({ qty }).eq('id', itemId);
    await recordAudit(`Mengubah jumlah barang "${itemName || 'Item'}" menjadi ${qty}`);
    fetchOrders();
  };

  const handleApproveOrder = async (orderId, branchName) => {
    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ status: 'approved', lock_status: 'LOCKED' })
      .eq('id', orderId);

    if (!error) {
      await recordAudit(`Menyetujui pesanan dari cabang: ${branchName || 'Cabang'}`);
      alert('Pesanan berhasil disetujui. Data cabang telah masuk ke daftar rekapitulasi.');
      fetchOrders();
    } else {
      alert('Gagal menyetujui pesanan: ' + error.message);
    }
    setLoading(false);
  };

  const handleUnlockOrder = async (orderId, branchName) => {
    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ status: 'SUBMITTED', lock_status: 'UNLOCKED' })
      .eq('id', orderId);

    if (!error) {
      await recordAudit(`Membuka kunci pesanan untuk cabang: ${branchName || 'Cabang'}`);
      alert('Kunci pesanan berhasil dibuka. Pihak cabang kini dapat memperbarui pesanan.');
      fetchOrders();
    } else {
      alert('Gagal membuka kunci pesanan: ' + error.message);
    }
    setLoading(false);
  };

  const handleDeleteOrder = async (orderId, branchName) => {
    if (window.confirm(`Hapus permanen pesanan untuk cabang "${branchName}"? Data rincian pesanan cabang ini akan dibersihkan.`)) {
      await supabase.from('kl_order_items').delete().eq('order_id', orderId);
      const { error } = await supabase.from('kl_orders').delete().eq('id', orderId);

      if (!error) {
        await recordAudit(`Menghapus data pesanan cabang: ${branchName || 'Cabang'}`);
        setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        setApprovedOrders(prev => prev.filter(o => o.id !== orderId));
        setSelectedApprovedIds(prev => prev.filter(id => id !== orderId));
        alert(`Pesanan cabang ${branchName} berhasil dihapus.`);
      } else {
        alert('Gagal menghapus pesanan: ' + error.message);
      }
    }
  };

  const handleBatchDeleteApproved = async () => {
    if (selectedApprovedIds.length === 0) return alert('Silakan pilih minimal 1 cabang yang ingin dihapus.');
    if (window.confirm(`Apakah Anda yakin ingin menghapus ${selectedApprovedIds.length} data pesanan cabang terpilih? Tindakan ini bersifat permanen.`)) {
      setLoading(true);
      await supabase.from('kl_order_items').delete().in('order_id', selectedApprovedIds);
      const { error } = await supabase.from('kl_orders').delete().in('id', selectedApprovedIds);

      if (!error) {
        await recordAudit(`Menghapus massal ${selectedApprovedIds.length} pesanan cabang yang telah disetujui`);
        setApprovedOrders(prev => prev.filter(o => !selectedApprovedIds.includes(o.id)));
        setSelectedApprovedIds([]);
        alert('Seluruh pesanan cabang terpilih berhasil dihapus.');
      } else {
        alert('Gagal menghapus massal: ' + error.message);
      }
      setLoading(false);
    }
  };

  const handleDeleteAllApproved = async () => {
    if (approvedOrders.length === 0) return alert('Tidak ada data cabang disetujui yang dapat dihapus.');
    if (window.confirm(`Konfirmasi Penghapusan: Apakah Anda yakin ingin menghapus seluruh ${approvedOrders.length} data cabang yang telah disetujui dari sistem?`)) {
      setLoading(true);
      const allIds = approvedOrders.map(o => o.id);
      await supabase.from('kl_order_items').delete().in('order_id', allIds);
      const { error } = await supabase.from('kl_orders').delete().in('id', allIds);

      if (!error) {
        await recordAudit(`Mengatur ulang dan menghapus seluruh (${allIds.length}) data cabang disetujui`);
        setApprovedOrders([]);
        setSelectedApprovedIds([]);
        alert('Seluruh data rekapitulasi cabang berhasil dibersihkan.');
      } else {
        alert('Gagal membersihkan data: ' + error.message);
      }
      setLoading(false);
    }
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  const filteredApprovedOrders = approvedOrders.filter(order => {
    const branchName = order.kl_branches?.branch_name || order.project_name || '';
    return branchName.toLowerCase().includes(searchApproved.toLowerCase());
  });

  const isAllApprovedSelected = filteredApprovedOrders.length > 0 && selectedApprovedIds.length === filteredApprovedOrders.length;

  const handleToggleSelectAllApproved = () => {
    if (isAllApprovedSelected) {
      setSelectedApprovedIds([]);
    } else {
      setSelectedApprovedIds(filteredApprovedOrders.map(o => o.id));
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpenNotifications = () => {
    setShowNotificationDropdown(!showNotificationDropdown);
    if (!showNotificationDropdown) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  // Logika Filter untuk Modal Log Audit
  const filteredAuditLogs = auditLogs.filter(log => 
    log.action.toLowerCase().includes(searchAudit.toLowerCase())
  );

  return (
    <div className="space-y-8 relative">
      
      {/* MODAL LOG AUDIT */}
      {showAuditModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-2xl rounded-3xl shadow-2xl border flex flex-col max-h-[85vh] animate-in zoom-in-95 ${
            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            
            {/* Header Modal */}
            <div className="p-5 border-b border-indigo-200/80 dark:border-indigo-800/60 flex justify-between items-center bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-t-3xl">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4" /> Riwayat Aktivitas Administrasi (15 Terakhir)
              </h3>
              <button 
                onClick={() => setShowAuditModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/80 hover:bg-white text-slate-700 border border-indigo-200/60 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bilah Pencarian Modal */}
            <div className={`p-4 border-b ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700' : 'bg-slate-50/80 border-slate-200/80'}`}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Cari catatan aktivitas (cth: Setujui, Hapus, Buka Kunci)..."
                  value={searchAudit}
                  onChange={(e) => setSearchAudit(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs transition-all ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500' : 'bg-white border-slate-200/90 text-slate-800'
                  }`}
                />
              </div>
            </div>
            
            {/* Isi Daftar Log */}
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              {filteredAuditLogs.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs font-medium">
                  {searchAudit ? 'Tidak ada riwayat aktivitas yang sesuai dengan pencarian Anda.' : 'Belum ada riwayat aktivitas yang tercatat dalam sistem.'}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredAuditLogs.map((log) => (
                    <div key={log.id} className={`p-3.5 rounded-2xl border text-xs flex justify-between items-center gap-3 shadow-2xs ${
                      isDarkMode ? 'bg-neutral-800/70 border-neutral-700' : 'bg-white border-slate-200/80'
                    }`}>
                      <div className="flex items-center gap-2 font-semibold">
                        <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{log.action}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-neutral-400 bg-slate-100/80 dark:bg-neutral-900 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-neutral-700 shrink-0">
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Header Utama Panel */}
      <div className={`p-5 rounded-3xl border shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}>
        <div>
          <h2 className="font-bold text-base mb-1 tracking-wide">Persetujuan & Pengelompokan Pesanan Cabang</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Tinjau, sesuaikan jumlah, dan setujui pesanan logistik yang masuk dari cabang.</p>
        </div>

        {/* Grup Tombol Header: Log Audit & Notifikasi */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={() => {
              setSearchAudit('');
              setShowAuditModal(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-indigo-50/90 hover:bg-indigo-100/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800/60 transition-all flex justify-center items-center gap-2 font-semibold text-xs shadow-2xs w-full sm:w-auto cursor-pointer"
          >
            <History className="w-3.5 h-3.5" /> Riwayat Audit
          </button>

          {/* Lonceng Notifikasi */}
          <div className="relative w-full sm:w-auto" ref={dropdownRef}>
            <button 
              onClick={handleOpenNotifications}
              className="relative px-3.5 py-2.5 w-full sm:w-auto justify-center rounded-2xl bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700 transition-all flex items-center gap-2 font-semibold text-xs shadow-2xs cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              <span className="sm:hidden">Notifikasi</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-50/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 text-[10px] font-bold rounded-full flex items-center justify-center shadow-2xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotificationDropdown && (
              <div className={`absolute right-0 mt-3 w-full sm:w-96 rounded-3xl border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 ${
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-800'
              }`}>
                <div className="p-4 border-b border-indigo-200/80 dark:border-indigo-800/60 flex justify-between items-center bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  <h4 className="font-bold text-xs uppercase tracking-wider">Pusat Notifikasi Waktu Nyata</h4>
                  <button 
                    onClick={() => setNotifications([])} 
                    className="text-[10px] bg-white/80 hover:bg-white text-indigo-700 border border-indigo-200/80 dark:bg-neutral-800 dark:text-indigo-300 dark:border-neutral-700 px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer"
                  >
                    Bersihkan Semua
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Belum ada notifikasi baru saat ini.
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`p-3 rounded-2xl border text-xs flex flex-col gap-1 transition-all ${
                          isDarkMode ? 'bg-neutral-800/70 border-neutral-700' : 'bg-slate-50/80 border-slate-200/80'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Pesanan / Permohonan Cabang</span>
                          <span className="text-[10px] font-mono text-slate-400">{notif.time}</span>
                        </div>
                        <p className="font-medium text-slate-600 dark:text-neutral-300">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEKSI 1: PESANAN MASUK YANG MEMERLUKAN PERSETUJUAN */}
      <div className="space-y-4">
        <h3 className={`font-bold text-sm uppercase tracking-wider px-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Menunggu Persetujuan / Permohonan Buka Kunci ({pendingOrders.length})
        </h3>

        {pendingOrders.length === 0 ? (
          <div className={`p-8 text-center rounded-3xl border text-xs text-slate-400 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200/90'}`}>
            Tidak ada pengajuan pesanan baru atau permohonan buka kunci dari cabang.
          </div>
        ) : (
          pendingOrders.map(order => {
            const grandTotal = order.kl_order_items?.reduce((acc, item) => {
              const price = Number(item.kl_master_items?.price || 0);
              const qty = Number(item.qty || 0);
              return acc + (price * qty);
            }, 0) || 0;

            const isRequestingUnlock = order.status === 'REQUEST_UNLOCK' || order.status === 'request_unlock' || order.lock_status === 'REQUEST_UNLOCK';
            const branchNameStr = order.kl_branches?.branch_name || 'Kantor Cabang';

            return (
              <div key={order.id} className={`p-6 rounded-3xl border shadow-2xs space-y-4 transition-all ${
                isRequestingUnlock 
                  ? 'bg-amber-50/40 border-amber-200/90 dark:bg-amber-950/20 dark:border-amber-800/60'
                  : (isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-800')
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200/80 dark:border-neutral-800 pb-3 gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-50/90 text-blue-700 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> {branchNameStr}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">ID: {order.id.slice(0, 8)}</span>
                      {isRequestingUnlock && (
                        <span className="px-3 py-1 rounded-xl text-[10px] font-bold bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> PERMOHONAN BUKA KUNCI
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1.5">
                      Waktu Pengajuan: {new Date(order.created_at).toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {isRequestingUnlock ? (
                      <button 
                        onClick={() => handleUnlockOrder(order.id, branchNameStr)}
                        disabled={loading}
                        className="px-4 py-2 bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 font-semibold rounded-xl text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>{loading ? 'Memproses...' : 'Setujui Buka Kunci'}</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleApproveOrder(order.id, branchNameStr)}
                        disabled={loading}
                        className="px-4 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold rounded-xl text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{loading ? 'Memproses...' : 'Setujui & Masukkan ke Rekapitulasi'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order.id, branchNameStr)}
                      className="px-3 py-2 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-xl text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                </div>

                <div className="max-h-[350px] overflow-y-auto relative rounded-2xl border border-slate-200/80 dark:border-neutral-800">
                  <table className="w-full text-xs border-collapse">
                    <thead className={`sticky top-0 z-10 font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-neutral-900 text-neutral-300 border-b border-neutral-800' : 'bg-slate-50/95 text-slate-600 border-b border-slate-200/80'}`}>
                      <tr>
                        <th className="p-3.5 text-left">Nama Barang</th>
                        <th className="p-3.5 text-left">Material / Bahan</th>
                        <th className="p-3.5 text-left">Ukuran</th>
                        <th className="p-3.5 text-right">Harga Satuan</th>
                        <th className="p-3.5 text-center w-28">Jumlah Pesanan</th>
                        <th className="p-3.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-slate-100'}`}>
                      {order.kl_order_items?.map((item) => {
                        const unitPrice = Number(item.kl_master_items?.price || 0);
                        const subtotal = unitPrice * Number(item.qty || 0);
                        const itemName = item.kl_master_items?.item_name || 'Barang Logistik';
                        return (
                          <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50/70'}>
                            <td className="p-3.5 font-semibold">{itemName}</td>
                            <td className="p-3.5 text-slate-600 dark:text-neutral-300 uppercase font-medium">{item.kl_master_items?.material || '-'}</td>
                            <td className="p-3.5 text-slate-500 dark:text-neutral-400 uppercase font-mono">{item.kl_master_items?.size || '-'}</td>
                            <td className="p-3.5 text-right font-mono">{formatRupiah(unitPrice)}</td>
                            <td className="p-3.5 text-center">
                              <input 
                                type="number"
                                min="0"
                                value={item.qty}
                                onChange={(e) => handleUpdateItemQty(item.id, e.target.value, itemName)}
                                className={`w-20 p-1.5 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${isDarkMode ? 'bg-neutral-950 border-neutral-700 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                              />
                            </td>
                            <td className={`p-3.5 text-right font-bold font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {formatRupiah(subtotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={`p-4 rounded-2xl flex justify-between items-center border ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700' : 'bg-slate-50/90 border-slate-200/80'}`}>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300">Estimasi Total Nilai Pesanan:</span>
                  <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-400">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SEKSI 2: REKAPITULASI CABANG YANG TELAH DISETUJUI */}
      <div className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-neutral-800 relative">
        
        {/* Bilah Tindakan Rekapitulasi */}
        <div className={`sticky top-0 z-20 py-3 -my-3 mb-2 px-1 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 backdrop-blur-md border-b transition-colors ${
          isDarkMode ? 'bg-neutral-900/95 border-neutral-800' : 'bg-white/95 border-slate-200/80'
        }`}>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className={`font-bold text-sm uppercase tracking-wider flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Rekapitulasi Cabang Disetujui ({approvedOrders.length} Cabang)
            </h3>

            {/* Kotak Centang PILIH SEMUA */}
            {filteredApprovedOrders.length > 0 && (
              <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                isAllApprovedSelected 
                  ? 'bg-indigo-50/90 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60' 
                  : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
              }`}>
                <input
                  type="checkbox"
                  checked={isAllApprovedSelected}
                  onChange={handleToggleSelectAllApproved}
                  className="cursor-pointer accent-indigo-600 w-4 h-4 rounded"
                />
                <span>Pilih Semua ({filteredApprovedOrders.length})</span>
              </label>
            )}

            {/* Tombol HAPUS TERPILIH */}
            {selectedApprovedIds.length > 0 && (
              <button
                type="button"
                onClick={handleBatchDeleteApproved}
                className="px-3.5 py-1.5 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Terpilih ({selectedApprovedIds.length})
              </button>
            )}

            {/* Tombol BERSIHKAN SEMUA REKAP */}
            {approvedOrders.length > 0 && selectedApprovedIds.length === 0 && (
              <button
                type="button"
                onClick={handleDeleteAllApproved}
                className="px-3 py-1.5 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 rounded-xl text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Bersihkan Semua Rekap
              </button>
            )}
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Cari nama cabang..."
                value={searchApproved}
                onChange={(e) => setSearchApproved(e.target.value)}
                className={`pl-8 pr-4 py-2 rounded-xl text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-full shadow-2xs transition-all ${
                  isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200/90 text-slate-800'
                }`}
              />
            </div>
            
            <button 
              onClick={() => {
                const exportData = filteredApprovedOrders.flatMap(order => 
                  order.kl_order_items.map(item => ({
                    "Nama Cabang": order.kl_branches?.branch_name || "N/A",
                    "Nama Barang": item.kl_master_items?.item_name || "N/A",
                    "Bahan": item.kl_master_items?.material || "-",
                    "Ukuran": item.kl_master_items?.size || "-",
                    "Harga Satuan": Number(item.kl_master_items?.price || 0),
                    "Jumlah": item.qty,
                    "Subtotal": Number(item.kl_master_items?.price || 0) * item.qty,
                    "Tanggal Disetujui": order.updated_at
                  }))
                );
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Rekap Pesanan");
                XLSX.writeFile(wb, `Rekap_Pesanan_Disetujui_${new Date().toLocaleDateString('id-ID')}.xlsx`);
              }}
              title="Unduh Rekapitulasi Excel"
              className="px-3.5 py-2 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 rounded-xl text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" /> Unduh Excel
            </button>
          </div>
        </div>

        {filteredApprovedOrders.length === 0 ? (
          <div className={`p-8 text-center rounded-3xl border text-xs text-slate-400 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200/90'}`}>
            Belum ada cabang yang disetujui atau nama cabang tidak ditemukan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredApprovedOrders.map(order => {
              const isExpanded = expandedApprovedId === order.id;
              const isSelected = selectedApprovedIds.includes(order.id);
              const grandTotal = order.kl_order_items?.reduce((acc, item) => {
                const price = Number(item.kl_master_items?.price || 0);
                const qty = Number(item.qty || 0);
                return acc + (price * qty);
              }, 0) || 0;

              const storeName = order.kl_branches?.branch_name || 'Cabang';

              return (
                <div key={order.id} className={`rounded-2xl border transition-all overflow-hidden shadow-2xs ${
                  isSelected 
                    ? 'bg-indigo-50/60 border-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-700' 
                    : (isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-800')
                } ${isExpanded ? 'col-span-1 sm:col-span-2 md:col-span-3 p-5 space-y-4' : 'p-4'}`}>
                  
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedApprovedIds(prev => 
                            prev.includes(order.id) ? prev.filter(id => id !== order.id) : [...prev, order.id]
                          );
                        }}
                        className="cursor-pointer accent-indigo-600 w-4 h-4 rounded"
                      />
                      <div onClick={() => setExpandedApprovedId(isExpanded ? null : order.id)} className="cursor-pointer">
                        <h4 className={`font-bold text-xs uppercase flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>{storeName}</span>
                        </h4>
                        <span className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">Total Item: {order.kl_order_items?.length || 0} Jenis</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => setExpandedApprovedId(isExpanded ? null : order.id)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                          isExpanded 
                            ? 'bg-amber-50/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60' 
                            : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                        }`}
                      >
                        {isExpanded ? <>Tutup <ChevronUp className="w-3 h-3" /></> : <>Rincian <ChevronDown className="w-3 h-3" /></>}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrder(order.id, storeName);
                        }}
                        className="p-1.5 rounded-xl bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 transition-colors cursor-pointer"
                        title="Hapus pesanan cabang ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-4 pt-3 border-t border-slate-200/80 dark:border-neutral-800 animate-in fade-in">
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-neutral-400">
                        <span>Waktu Persetujuan: {new Date(order.updated_at || order.created_at).toLocaleString('id-ID')}</span>
                        <span className="font-mono">ID Pesanan: {order.id}</span>
                      </div>

                      <div className="max-h-[300px] overflow-y-auto relative rounded-xl border border-slate-200/80 dark:border-neutral-800">
                        <table className="w-full text-xs border-collapse">
                          <thead className={`sticky top-0 z-10 font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-neutral-900 text-neutral-300 border-b border-neutral-800' : 'bg-slate-50/95 text-slate-600 border-b border-slate-200/80'}`}>
                            <tr>
                              <th className="p-3 text-left">Nama Barang</th>
                              <th className="p-3 text-left">Material / Bahan</th>
                              <th className="p-3 text-left">Ukuran</th>
                              <th className="p-3 text-right">Harga Satuan</th>
                              <th className="p-3 text-center w-24">Jumlah</th>
                              <th className="p-3 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-slate-100'}`}>
                            {order.kl_order_items?.map((item) => {
                              const unitPrice = Number(item.kl_master_items?.price || 0);
                              const subtotal = unitPrice * Number(item.qty || 0);
                              return (
                                <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50/70'}>
                                  <td className="p-3 font-semibold">{item.kl_master_items?.item_name || 'Barang'}</td>
                                  <td className="p-3 text-slate-600 dark:text-neutral-300 uppercase">{item.kl_master_items?.material || '-'}</td>
                                  <td className="p-3 text-slate-500 dark:text-neutral-400 uppercase font-mono">{item.kl_master_items?.size || '-'}</td>
                                  <td className="p-3 text-right font-mono">{formatRupiah(unitPrice)}</td>
                                  <td className="p-3 text-center font-bold font-mono">{item.qty}</td>
                                  <td className={`p-3 text-right font-bold font-mono ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatRupiah(subtotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className={`p-3.5 rounded-xl flex justify-between items-center border ${isDarkMode ? 'bg-neutral-800/60 border-neutral-700' : 'bg-slate-50/90 border-slate-200/80'}`}>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-300">Total Nilai Pesanan Cabang Ini:</span>
                        <span className="text-sm font-extrabold font-mono text-emerald-700 dark:text-emerald-400">{formatRupiah(grandTotal)}</span>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
      
    </div>
  );
}