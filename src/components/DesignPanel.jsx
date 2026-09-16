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
          alert(`✅ Sukses! Status READY CETAK. 1 SPK Toko "${generatedSpkNo}" (${totalQty} pcs total) diterbitkan ke Tab Produksi.`);
        }
      } else {
        alert(`✅ Status READY CETAK aktif (SPK Toko ${generatedSpkNo} sudah terdaftar di Produksi).`);
      }
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, design_status: newStatus } : o));
  };

  // Hapus order dari tabel Supabase
  const handleDeleteOrder = async (orderId, branchName) => {
    if (confirm(`⚠️ Hapus order toko "${branchName}" beserta item pesanannya?`)) {
      await supabase.from('kl_order_items').delete().eq('order_id', orderId);
      const { error } = await supabase.from('kl_orders').delete().eq('id', orderId);

      if (!error) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        alert(`✅ Order "${branchName}" berhasil dihapus.`);
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
      <div className="p-4 rounded-2xl border border-slate-200 bg-white text-black shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white">
              Active Promo Campaign
            </span>
            <span className="text-xs font-mono font-medium text-slate-500">Total: {orders.length} Approved Stores</span>
          </div>
          <h2 className="text-sm font-extrabold mt-1 text-slate-900 flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-indigo-600" /> {activePromoName}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search store / promo / ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs whitespace-nowrap">
            {pendingCount > 0 ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> {pendingCount} Pending Design
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold border bg-slate-100 text-slate-600 border-slate-200 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> All Design Ready
              </span>
            )}

            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> {readyCount} Ready
            </span>
          </div>
        </div>
      </div>

      {/* ULTRA-CLEAN DATA GRID FOR DESIGN FILE PREPRESS */}
      <div className="max-h-[620px] overflow-y-auto relative rounded-2xl border border-slate-200/80 shadow-2xs bg-white custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse bg-white">
          <thead className="sticky top-0 z-20 bg-[#F8FAFC] border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="p-3.5">PROMO & STORE NAME</th>
              <th className="p-3.5">ORDER PACKAGE ITEMS</th>
              <th className="p-3.5 w-44 text-center">FILE STATUS</th>
              <th className="p-3.5">TECHNICAL DESIGN NOTES</th>
              <th className="p-3.5 text-center w-40">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400 font-medium">
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
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors bg-white">
                    <td className="p-3.5 align-top">
                      <span className="text-[10px] font-mono text-slate-400 font-medium uppercase block">
                        {promoTitle}
                      </span>
                      <strong className="font-bold text-slate-900 text-xs sm:text-sm block mt-0.5">
                        {branchName}
                      </strong>
                      <span className="text-[10px] font-mono text-slate-400 font-medium block mt-0.5">
                        ID: {order.id.slice(0, 8)} | Total: <strong className="text-black font-extrabold">{totalQty} pcs</strong>
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <div className="space-y-1">
                        {order.kl_order_items?.map((item, idx) => (
                          <div key={idx} className="text-[11px] font-medium text-slate-700">
                            • <strong className="text-slate-900 font-bold">{item.kl_master_items?.item_name}</strong> ({item.qty} pcs)
                            <span className="text-slate-400 ml-1 text-[10px] font-mono">[{item.kl_master_items?.size || '-'}]</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-center align-top">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${
                        isReady
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                        {isReady ? 'Ready for Print' : 'Pending Design'}
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <input
                        type="text"
                        defaultValue={order.design_notes || ''}
                        onBlur={e => handleSaveNotes(order.id, e.target.value)}
                        placeholder="Enter size / file notes..."
                        className="w-full p-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </td>

                    {/* Tombol Aksi */}
                    <td className="p-3.5 text-center align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpdateDesignStatus(order, isReady ? 'PROSES' : 'READY')}
                          className={`px-3 py-1.5 rounded-xl font-extrabold text-xs shadow-2xs transition-all active:scale-95 whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                            isReady
                              ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {isReady ? <><RotateCcw className="w-3.5 h-3.5" /> Undo</> : <><Check className="w-3.5 h-3.5" /> Ready</>}
                        </button>

                        <button
                          onClick={() => handleDeleteOrder(order.id, branchName)}
                          title="Delete Order"
                          className="w-8 h-8 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold flex items-center justify-center transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
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