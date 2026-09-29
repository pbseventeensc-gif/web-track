import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Check, Trash2, Search, Megaphone, RotateCcw, Clock } from 'lucide-react';

export default function DesignPanel({ isDarkMode, onOpenImageModal }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchApprovedOrders();

    const channel = supabase
      .channel('kl_design_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kl_orders' },
        () => {
          fetchApprovedOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchApprovedOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('kl_orders')
      .select('*, kl_branches(branch_name), kl_order_items(*, kl_master_items(*))')
      .in('status', ['APPROVED', 'approved'])
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const handleUpdateDesignStatus = async (order, newStatus) => {
    const orderId = order.id;
    const branchName = order.kl_branches?.branch_name || 'Cabang';
    const promoTitle = order.project_name || activePromoName;

    const { error } = await supabase
      .from('kl_orders')
      .update({ 
        design_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      alert('Gagal update status desain: ' + error.message);
      return;
    }

    if (newStatus === 'READY') {
      const generatedSpkNo = `SPK-KL-${orderId.slice(0, 6).toUpperCase()}`;
      const totalQty = order.kl_order_items?.reduce((sum, item) => sum + Number(item.qty || 0), 0) || 0;
      
      const itemSummaries = order.kl_order_items?.map(
        i => `${i.kl_master_items?.item_name || 'Item'} (${i.qty} pcs)`
      ).join(', ') || 'Paket Material Promo';

      const { data: existingSpk } = await supabase
        .from('spk_data')
        .select('id')
        .eq('no_spk', generatedSpkNo)
        .maybeSingle();

      if (!existingSpk) {
        const { error: spkError } = await supabase.from('spk_data').insert([{
          no_spk: generatedSpkNo,
          client: `KAWAN LAMA (${branchName})`,
          project: `${promoTitle} - [${branchName}]`,
          bahan: itemSummaries,
          ukuran: 'Paket Bundling Toko',
          qty_order: totalQty > 0 ? totalQty : 1,
          qty_print: 0,
          qty_finish: 0,
          qty_pack: 0,
          qty_ship: 0,
          store_code: branchName,
          delivery_route: 'DISTRIBUSI LOGISTIK TOKO'
        }]);

        if (!spkError) {
          alert(`Status READY CETAK. 1 SPK Toko "${generatedSpkNo}" (${totalQty} pcs total) diterbitkan ke Tab Produksi.`);
        }
      } else {
        alert(`Status READY CETAK aktif (SPK Toko ${generatedSpkNo} sudah terdaftar di Produksi).`);
      }
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, design_status: newStatus } : o));
  };

  // Hapus order dari tabel Supabase
  const handleDeleteOrder = async (orderId, branchName) => {
    if (confirm(`Hapus order toko "${branchName}" beserta item pesanannya?`)) {
      await supabase.from('kl_order_items').delete().eq('order_id', orderId);
      const { error } = await supabase.from('kl_orders').delete().eq('id', orderId);

      if (!error) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        alert(`Order "${branchName}" berhasil dihapus.`);
      } else {
        alert('Gagal menghapus order: ' + error.message);
      }
    }
  };

  const handleSaveNotes = async (orderId, notes) => {
    await supabase
      .from('kl_orders')
      .update({ design_notes: notes })
      .eq('id', orderId);
  };

  const filteredOrders = orders.filter(o => {
    const branchName = o.kl_branches?.branch_name || '';
    const projectName = o.project_name || '';
    const idStr = o.id || '';
    const q = searchTerm.toLowerCase();
    return branchName.toLowerCase().includes(q) || projectName.toLowerCase().includes(q) || idStr.includes(q);
  });

  const activePromoName = orders.length > 0 && orders[0].project_name 
    ? orders[0].project_name 
    : 'PROMO NASIONAL KAWAN LAMA GROUP';

  const pendingCount = orders.filter(o => o.design_status !== 'READY').length;
  const readyCount = orders.filter(o => o.design_status === 'READY').length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className={`p-4 rounded-2xl border shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-colors ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-orange-600 text-white shadow-2xs">
              Active Promo Campaign
            </span>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Total: {orders.length} Approved Stores</span>
          </div>
          <h2 className="text-sm font-black mt-1 text-black dark:text-white flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-orange-600 dark:text-orange-400" /> {activePromoName}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search store / promo / ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-2xs ${
                isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-black placeholder-slate-500'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 text-xs whitespace-nowrap">
            {pendingCount > 0 ? (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold border bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600" /> {pendingCount} Pending Design
              </span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-full text-xs font-bold border bg-slate-100 dark:bg-neutral-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-neutral-700 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" /> All Design Ready
              </span>
            )}

            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold border bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" /> {readyCount} Ready
            </span>
          </div>
        </div>
      </div>

      {/* ULTRA-CLEAN HIGH-CONTRAST DATA GRID */}
      <div className={`max-h-[620px] overflow-y-auto relative rounded-2xl border shadow-xs custom-scrollbar ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-20 border-b text-xs font-black uppercase tracking-wider ${
            isDarkMode
              ? 'bg-neutral-800 border-neutral-700 text-white'
              : 'bg-slate-100 border-slate-300 text-black'
          }`}>
            <tr>
              <th className="p-3.5">PROMO & STORE NAME</th>
              <th className="p-3.5">ORDER PACKAGE ITEMS</th>
              <th className="p-3.5 w-44 text-center">FILE STATUS</th>
              <th className="p-3.5">TECHNICAL DESIGN NOTES</th>
              <th className="p-3.5 text-center w-40">ACTIONS</th>
            </tr>
          </thead>

          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-slate-200'}`}>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400 font-bold">
                  No design queue available for approved store orders.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                const isReady = order.design_status === 'READY';
                const promoTitle = order.project_name || activePromoName;
                const totalQty = order.kl_order_items?.reduce((sum, item) => sum + Number(item.qty || 0), 0) || 0;
                const branchName = order.kl_branches?.branch_name || 'Store Branch';

                return (
                  <tr key={order.id} className={`transition-colors ${
                    isDarkMode ? 'hover:bg-neutral-800/60' : 'hover:bg-slate-50'
                  }`}>
                    <td className="p-3.5 align-top">
                      <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300 font-bold uppercase block">
                        {promoTitle}
                      </span>
                      <strong className="font-black text-black dark:text-white text-xs sm:text-sm block mt-0.5">
                        {branchName}
                      </strong>
                      <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-bold block mt-0.5">
                        ID: {order.id.slice(0, 8)} | Total: <strong className="text-black dark:text-white font-black">{totalQty} pcs</strong>
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <div className="space-y-1">
                        {order.kl_order_items?.map((item, idx) => (
                          <div key={idx} className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            • <strong className="text-black dark:text-white font-black">{item.kl_master_items?.item_name}</strong> ({item.qty} pcs)
                            <span className="text-slate-600 dark:text-slate-400 ml-1.5 text-[11px] font-mono">[{item.kl_master_items?.size || '-'}]</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-center align-top">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold border whitespace-nowrap ${
                        isReady
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                        {isReady ? 'Ready for Print' : 'Pending Design'}
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <input
                        type="text"
                        defaultValue={order.design_notes || ''}
                        onBlur={e => handleSaveNotes(order.id, e.target.value)}
                        placeholder="Enter size / file notes..."
                        className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/50 ${
                          isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-black placeholder-slate-500'
                        }`}
                      />
                    </td>

                    {/* Tombol Aksi */}
                    <td className="p-3.5 text-center align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpdateDesignStatus(order, isReady ? 'PROSES' : 'READY')}
                          className={`px-3.5 py-1.5 rounded-xl font-black text-xs shadow-2xs transition-all active:scale-95 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                            isReady
                              ? (isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700' : 'bg-white hover:bg-slate-100 text-black border border-slate-300')
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {isReady ? <><RotateCcw className="w-3.5 h-3.5" /> Undo</> : <><Check className="w-3.5 h-3.5" /> Ready</>}
                        </button>

                        <button
                          onClick={() => handleDeleteOrder(order.id, branchName)}
                          title="Delete Order"
                          className="w-8 h-8 rounded-full border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-400 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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