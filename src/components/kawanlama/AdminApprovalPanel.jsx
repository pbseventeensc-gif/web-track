import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import * as XLSX from 'xlsx';

export default function AdminApprovalPanel({ isDarkMode }) {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [approvedOrders, setApprovedOrders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedApprovedId, setExpandedApprovedId] = useState(null);
  const [searchApproved, setSearchApproved] = useState('');
  
  // State untuk Notifikasi & Dropdown Lonceng
  const [notifications, setNotifications] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchOrders();
    fetchAuditLogs();

    // Tutup dropdown jika klik di luar area lonceng
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotificationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    // --- SETUP REAL-TIME LISTENER SUPABASE ---
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
              const msg = '🔔 Ada order masuk atau permintaan BUKA KUNCI baru dari cabang!';
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
      time: new Date().toLocaleTimeString(),
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
      .limit(10);

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
    await recordAudit(`Mengubah qty barang "${itemName || 'Item'}" menjadi ${qty}`);
    fetchOrders();
  };

  const handleApproveOrder = async (orderId, branchName) => {
    setLoading(true);
    const { error } = await supabase
      .from('kl_orders')
      .update({ status: 'approved', lock_status: 'LOCKED' })
      .eq('id', orderId);

    if (!error) {
      await recordAudit(`Menyetujui (Approve) order dari cabang: ${branchName || 'Cabang'}`);
      alert('✅ Order berhasil disetujui (Approved)! Toko masuk ke daftar rekap.');
      fetchOrders();
    } else {
      alert('Gagal approve: ' + error.message);
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
      await recordAudit(`Membuka kunci (Unlock) order untuk cabang: ${branchName || 'Cabang'}`);
      alert('🔓 Berhasil membuka kunci! Cabang kini dapat mengedit pesanan.');
      fetchOrders();
    } else {
      alert('Gagal membuka kunci: ' + error.message);
    }
    setLoading(false);
  };

  const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0);
  };

  const filteredApprovedOrders = approvedOrders.filter(order => {
    const branchName = order.kl_branches?.branch_name || order.project_name || '';
    return branchName.toLowerCase().includes(searchApproved.toLowerCase());
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpenNotifications = () => {
    setShowNotificationDropdown(!showNotificationDropdown);
    if (!showNotificationDropdown) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  return (
    <div className="space-y-8 relative">
      
      {/* Header Utama dengan Logo Lonceng di Pojok Kanan Atas */}
      <div className={`p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <div>
          <h2 className="font-extrabold text-base mb-1 tracking-wide">🔒 Panel Approval & Rekapitulasi Order Cabang</h2>
          <p className="text-xs opacity-70">Review kuantiti pesanan masuk, setujui order, atau pantau rekapitulasi toko yang sudah di-approve.</p>
        </div>

        {/* --- IKON LONCENG NOTIFIKASI --- */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={handleOpenNotifications}
            className={`relative p-3 rounded-2xl border transition-all flex items-center gap-2 font-bold text-xs shadow-sm ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 hover:bg-neutral-700 text-white' : 'bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-700'
            }`}
          >
            <span className="text-lg">🔔</span>
            <span>Notifikasi</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-md">
                {unreadCount}
              </span>
            )}
          </button>

          {/* --- DROPDOWN ISI NOTIFIKASI --- */}
          {showNotificationDropdown && (
            <div className={`absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-stone-200 text-stone-800'
            }`}>
              <div className="p-4 border-b flex justify-between items-center bg-indigo-600 text-white">
                <h4 className="font-black text-xs uppercase tracking-wider">Pusat Notifikasi Real-Time</h4>
                <button 
                  onClick={() => setNotifications([])} 
                  className="text-[10px] bg-indigo-700 hover:bg-indigo-800 px-2.5 py-1 rounded-xl font-bold transition-all"
                >
                  Hapus Semua
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs opacity-50">
                    📭 Belum ada notifikasi baru saat ini.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={`p-3 rounded-2xl border text-xs flex flex-col gap-1 transition-all ${
                        isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">Order / Request Cabang</span>
                        <span className="text-[10px] font-mono opacity-60">{notif.time}</span>
                      </div>
                      <p className="font-medium opacity-90">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SEKSI 1: ORDER MASUK YANG PERLU APPROVAL */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-sm uppercase tracking-wider px-1 text-indigo-600 dark:text-indigo-400">
          ⏳ Menunggu Approval / Request Unlock ({pendingOrders.length})
        </h3>

        {pendingOrders.length === 0 ? (
          <div className={`p-6 text-center rounded-3xl border text-xs opacity-60 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
            📭 Tidak ada order baru atau permintaan buka kunci dari cabang saat ini.
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
              <div key={order.id} className={`p-6 rounded-3xl border shadow-sm space-y-4 transition-all ${
                isRequestingUnlock 
                  ? (isDarkMode ? 'bg-red-950/40 border-red-700/80 text-white' : 'bg-red-50/80 border-red-300 text-stone-800')
                  : (isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800')
              }`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-blue-600 text-white">
                        🏢 {branchNameStr}
                      </span>
                      <span className="text-[10px] font-mono opacity-60">ID: {order.id.slice(0, 8)}</span>
                      {isRequestingUnlock && (
                        <span className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-rose-600 text-white animate-pulse">
                          ⚠️ MINTA BUKA KUNCI (REQUEST UNLOCK)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] opacity-70 mt-1.5">Waktu Submit: {new Date(order.created_at).toLocaleString()}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isRequestingUnlock ? (
                      <button 
                        onClick={() => handleUnlockOrder(order.id, branchNameStr)}
                        disabled={loading}
                        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 animate-bounce"
                      >
                        {loading ? 'Memproses...' : '🔓 Setujui Buka Kunci'}
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleApproveOrder(order.id, branchNameStr)}
                        disabled={loading}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
                      >
                        {loading ? 'Memproses...' : '✅ Approve & Masukkan ke Rekap'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[350px] overflow-y-auto relative rounded-2xl border border-stone-200 dark:border-neutral-700">
                  <table className="w-full text-xs border-collapse">
                    <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
                      <tr>
                        <th className="p-3.5 text-left">Nama Barang</th>
                        <th className="p-3.5 text-left">Material / Bahan</th>
                        <th className="p-3.5 text-left">Ukuran (Size)</th>
                        <th className="p-3.5 text-right">Harga Satuan</th>
                        <th className="p-3.5 text-center w-28">Qty Order</th>
                        <th className="p-3.5 text-right">Subtotal Harga</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
                      {order.kl_order_items?.map((item) => {
                        const unitPrice = Number(item.kl_master_items?.price || 0);
                        const subtotal = unitPrice * Number(item.qty || 0);
                        const itemName = item.kl_master_items?.item_name || 'Barang Logistik';
                        return (
                          <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                            <td className="p-3.5 font-bold">{itemName}</td>
                            <td className="p-3.5 opacity-80 uppercase font-medium">{item.kl_master_items?.material || '-'}</td>
                            <td className="p-3.5 opacity-80 uppercase font-mono">{item.kl_master_items?.size || '-'}</td>
                            <td className="p-3.5 text-right font-mono opacity-90">{formatRupiah(unitPrice)}</td>
                            <td className="p-3.5 text-center">
                              <input 
                                type="number"
                                min="0"
                                value={item.qty}
                                onChange={(e) => handleUpdateItemQty(item.id, e.target.value, itemName)}
                                className={`w-20 p-1.5 border rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-neutral-900 border-neutral-600 text-white' : 'bg-white border-stone-300 text-black'}`}
                              />
                            </td>
                            <td className="p-3.5 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">
                              {formatRupiah(subtotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={`p-4 rounded-2xl flex justify-between items-center ${isDarkMode ? 'bg-neutral-900/80 border border-neutral-700' : 'bg-[#F8F6F0] border border-[#E5E0D5]'}`}>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-80">Estimasi Grand Total Biaya Order:</span>
                  <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">{formatRupiah(grandTotal)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SEKSI 2: REKAPITULASI TOKO YANG SUDAH APPROVED */}
      <div className="space-y-4 pt-4 border-t border-stone-300 dark:border-neutral-700 relative">
        
        <div className={`sticky top-0 z-20 py-3 -my-3 mb-2 px-1 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 backdrop-blur-md border-b transition-colors ${isDarkMode ? 'bg-neutral-900/90 border-neutral-800' : 'bg-white/90 border-stone-200'}`}>
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            ✅ Rekapitulasi Toko Sudah Approved ({approvedOrders.length} Toko)
          </h3>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <input 
              type="text"
              placeholder="🔍 Cari Nama Toko..."
              value={searchApproved}
              onChange={(e) => setSearchApproved(e.target.value)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 w-full sm:w-64 shadow-sm transition-all ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-300 text-stone-800'}`}
            />
            
            <button 
              onClick={() => {
                const exportData = filteredApprovedOrders.flatMap(order => 
                  order.kl_order_items.map(item => ({
                    "Nama Cabang": order.kl_branches?.branch_name || "N/A",
                    "Nama Barang": item.kl_master_items?.item_name || "N/A",
                    "Bahan": item.kl_master_items?.material || "-",
                    "Ukuran": item.kl_master_items?.size || "-",
                    "Harga Satuan": Number(item.kl_master_items?.price || 0),
                    "Qty": item.qty,
                    "Subtotal": Number(item.kl_master_items?.price || 0) * item.qty,
                    "Tgl Approved": order.updated_at
                  }))
                );
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Rekap Order");
                XLSX.writeFile(wb, `Rekap_Order_Approved_${new Date().toLocaleDateString()}.xlsx`);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
            >
              📥 Excel
            </button>
          </div>
        </div>

        {filteredApprovedOrders.length === 0 ? (
          <div className={`p-6 text-center rounded-3xl border text-xs opacity-60 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
            Belum ada toko yang disetujui atau nama toko tidak ditemukan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredApprovedOrders.map(order => {
              const isExpanded = expandedApprovedId === order.id;
              const grandTotal = order.kl_order_items?.reduce((acc, item) => {
                const price = Number(item.kl_master_items?.price || 0);
                const qty = Number(item.qty || 0);
                return acc + (price * qty);
              }, 0) || 0;

              const storeName = order.kl_branches?.branch_name || 'Cabang';

              return (
                <div key={order.id} className={`rounded-2xl border transition-all overflow-hidden shadow-sm ${
                  isExpanded ? 'col-span-1 sm:col-span-2 md:col-span-3 p-5 space-y-4' : 'p-4'
                } ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
                  
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedApprovedId(isExpanded ? null : order.id)}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏢</span>
                      <div>
                        <h4 className="font-extrabold text-xs uppercase text-indigo-600 dark:text-indigo-400">
                          {storeName}
                        </h4>
                        <span className="text-[10px] opacity-60 font-mono">Total Item: {order.kl_order_items?.length || 0} Jenis</span>
                      </div>
                    </div>
                    
                    <button className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      isExpanded 
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' 
                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                    }`}>
                      {isExpanded ? 'Tutup Detail ▲' : 'Lihat Detail Order ▼'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="space-y-4 pt-3 border-t border-stone-200 dark:border-neutral-700 animate-in fade-in">
                      <div className="flex justify-between items-center text-xs opacity-70">
                        <span>Waktu Approve: {new Date(order.updated_at || order.created_at).toLocaleString()}</span>
                        <span className="font-mono">ID Order: {order.id}</span>
                      </div>

                      <div className="max-h-[300px] overflow-y-auto relative rounded-xl border border-stone-200 dark:border-neutral-700">
                        <table className="w-full text-xs border-collapse">
                          <thead className={`sticky top-0 z-10 font-black uppercase tracking-wider ${isDarkMode ? 'bg-neutral-900 text-neutral-200 border-b border-neutral-700' : 'bg-stone-100 text-stone-700 border-b border-stone-300'}`}>
                            <tr>
                              <th className="p-3 text-left">Nama Barang</th>
                              <th className="p-3 text-left">Material</th>
                              <th className="p-3 text-left">Ukuran</th>
                              <th className="p-3 text-right">Harga Satuan</th>
                              <th className="p-3 text-center w-24">Qty</th>
                              <th className="p-3 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-700/50' : 'divide-stone-100'}`}>
                            {order.kl_order_items?.map((item) => {
                              const unitPrice = Number(item.kl_master_items?.price || 0);
                              const subtotal = unitPrice * Number(item.qty || 0);
                              return (
                                <tr key={item.id} className={isDarkMode ? 'hover:bg-neutral-700/30' : 'hover:bg-stone-50/50'}>
                                  <td className="p-3 font-bold">{item.kl_master_items?.item_name || 'Barang'}</td>
                                  <td className="p-3 opacity-80 uppercase">{item.kl_master_items?.material || '-'}</td>
                                  <td className="p-3 opacity-80 uppercase font-mono">{item.kl_master_items?.size || '-'}</td>
                                  <td className="p-3 text-right font-mono">{formatRupiah(unitPrice)}</td>
                                  <td className="p-3 text-center font-bold font-mono">{item.qty}</td>
                                  <td className="p-3 text-right font-bold font-mono text-indigo-600 dark:text-indigo-400">{formatRupiah(subtotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className={`p-3.5 rounded-xl flex justify-between items-center ${isDarkMode ? 'bg-neutral-900 border border-neutral-700' : 'bg-[#F8F6F0] border border-[#E5E0D5]'}`}>
                        <span className="text-xs font-bold uppercase tracking-wider opacity-80">Grand Total Order Toko Ini:</span>
                        <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{formatRupiah(grandTotal)}</span>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEKSI 3: AUDIT TRAIL / LOG AKTIVITAS TERBARU */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-4 ${isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-[#D8D2C2] text-stone-800'}`}>
        <h3 className="font-extrabold text-sm uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
          <span>📜</span> Audit Trail & Riwayat Aktivitas Admin (10 Terakhir)
        </h3>
        
        {auditLogs.length === 0 ? (
          <p className="text-xs opacity-60">Belum ada riwayat aktivitas tercatat.</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {auditLogs.map((log) => (
              <div key={log.id} className={`p-3 rounded-xl border text-xs flex justify-between items-center ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-stone-50 border-stone-200'}`}>
                <span className="font-medium">⚡ {log.action}</span>
                <span className="font-mono text-[10px] opacity-60">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}