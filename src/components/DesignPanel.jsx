import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Check, Trash2, Search, Megaphone, RotateCcw } from 'lucide-react';

export default function DesignPanel({ isDarkMode }) {
  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchApprovedOrders = async () => {
    const { data, error } = await supabase
      .from('kl_orders')
      .select('*, kl_branches(branch_name), kl_order_items(*, kl_master_items(*))')
      .in('status', ['APPROVED', 'approved'])
      .order('updated_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setOrders(data);
    }
  };

  useEffect(() => {
    fetchApprovedOrders();

    let debounceTimer = null;
    const channel = supabase
      .channel('kl_design_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kl_orders' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            fetchApprovedOrders();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const activePromoName = orders.length > 0 && orders[0].project_name
    ? orders[0].project_name
    : 'Program Promosi Nasional Kawan Lama Group';

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
      alert('Gagal memperbarui status desain: ' + error.message);
      return;
    }

    if (newStatus === 'READY') {
      const generatedSpkNo = `SPK-KL-${orderId.slice(0, 6).toUpperCase()}`;
      const totalQty = order.kl_order_items?.reduce((sum, item) => sum + Number(item.qty || 0), 0) || 0;

      const itemSummaries = order.kl_order_items?.map(
        i => `${i.kl_master_items?.item_name || 'Item'} (${i.qty} pcs)`
      ).join(', ') || 'Paket Material Promosi';

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
          ukuran: 'Paket Bundling Cabang',
          qty_order: totalQty > 0 ? totalQty : 1,
          qty_print: 0,
          qty_finish: 0,
          qty_pack: 0,
          qty_ship: 0,
          store_code: branchName,
          delivery_route: 'DISTRIBUSI LOGISTIK CABANG'
        }]);

        if (!spkError) {
          alert(`Status Siap Cetak telah diaktifkan. Nomor SPK "${generatedSpkNo}" (${totalQty} unit) berhasil diterbitkan ke antrean Produksi.`);
        }
      } else {
        alert(`Status Siap Cetak aktif. Nomor SPK ${generatedSpkNo} sudah terdaftar pada antrean Produksi.`);
      }
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, design_status: newStatus } : o));
  };

  const handleDeleteOrder = async (orderId, branchName) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pesanan cabang "${branchName}" beserta rincian itemnya?`)) {
      await supabase.from('kl_order_items').delete().eq('order_id', orderId);
      const { error } = await supabase.from('kl_orders').delete().eq('id', orderId);

      if (!error) {
        setOrders(prev => prev.filter(o => o.id !== orderId));
        alert(`Pesanan cabang "${branchName}" berhasil dihapus.`);
      } else {
        alert('Gagal menghapus pesanan: ' + error.message);
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

  const pendingCount = orders.filter(o => o.design_status !== 'READY').length;
  const readyCount = orders.filter(o => o.design_status === 'READY').length;

  return (
    <div className="space-y-5">
      {/* Header Panel */}
      <div className={`p-5 rounded-2xl border shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'
      }`}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60">
              Antrean Verifikasi Desain Pracetak
            </span>
            <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              Total Cabang Disetujui: <strong className="text-slate-800 dark:text-slate-200">{orders.length}</strong>
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{activePromoName}</span>
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari cabang, program, atau ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all ${
                isDarkMode
                  ? 'bg-neutral-800/90 border-neutral-700 text-slate-100 placeholder-slate-400'
                  : 'bg-slate-50/80 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white'
              }`}
            />
          </div>

          <div className="flex items-center gap-2 text-xs whitespace-nowrap">
            {pendingCount > 0 ? (
              <span className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-amber-50/90 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                {pendingCount} Menunggu Desain
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-slate-100/80 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-neutral-700 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Seluruh Desain Selesai
              </span>
            )}

            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {readyCount} Siap Cetak
            </span>
          </div>
        </div>
      </div>

      {/* Tabel Data Desain */}
      <div className={`max-h-[620px] overflow-y-auto relative rounded-2xl border shadow-2xs custom-scrollbar ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200/90'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-20 border-b text-[11px] font-semibold uppercase tracking-wider ${
            isDarkMode
              ? 'bg-neutral-800/95 border-neutral-700 text-slate-300'
              : 'bg-slate-50/95 border-slate-200 text-slate-600'
          }`}>
            <tr>
              <th className="p-3.5">Program & Nama Cabang</th>
              <th className="p-3.5">Rincian Paket Material</th>
              <th className="p-3.5 w-44 text-center">Status Berkas</th>
              <th className="p-3.5">Catatan Teknis Desain</th>
              <th className="p-3.5 text-center w-44">Tindakan</th>
            </tr>
          </thead>

          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-slate-100'}`}>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
                  Belum ada antrean desain untuk pesanan cabang yang telah disetujui.
                </td>
              </tr>
            ) : (
              filteredOrders.map(order => {
                const isReady = order.design_status === 'READY';
                const promoTitle = order.project_name || activePromoName;
                const totalQty = order.kl_order_items?.reduce((sum, item) => sum + Number(item.qty || 0), 0) || 0;
                const branchName = order.kl_branches?.branch_name || 'Cabang Toko';

                return (
                  <tr key={order.id} className={`transition-colors ${
                    isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-slate-50/80'
                  }`}>
                    <td className="p-3.5 align-top">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-medium uppercase block">
                        {promoTitle}
                      </span>
                      <strong className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm block mt-0.5">
                        {branchName}
                      </strong>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block mt-0.5">
                        ID: {order.id.slice(0, 8)} | Total: <strong className="text-slate-800 dark:text-slate-200 font-semibold">{totalQty} unit</strong>
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <div className="space-y-1">
                        {order.kl_order_items?.map((item, idx) => (
                          <div key={idx} className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            • <strong className="text-slate-800 dark:text-slate-100 font-semibold">{item.kl_master_items?.item_name}</strong> ({item.qty} unit)
                            <span className="text-slate-500 dark:text-slate-400 ml-1.5 text-[11px] font-mono">[{item.kl_master_items?.size || '-'}]</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="p-3.5 text-center align-top">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border whitespace-nowrap ${
                        isReady
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                          : 'bg-amber-50/90 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {isReady ? 'Siap Cetak' : 'Menunggu Desain'}
                      </span>
                    </td>

                    <td className="p-3.5 align-top">
                      <input
                        type="text"
                        defaultValue={order.design_notes || ''}
                        onBlur={e => handleSaveNotes(order.id, e.target.value)}
                        placeholder="Tambahkan catatan ukuran atau berkas..."
                        className={`w-full p-2 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                          isDarkMode
                            ? 'bg-neutral-800 border-neutral-700 text-slate-100 placeholder-slate-400'
                            : 'bg-slate-50/70 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white'
                        }`}
                      />
                    </td>

                    <td className="p-3.5 text-center align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleUpdateDesignStatus(order, isReady ? 'PROSES' : 'READY')}
                          className={`px-3 py-1.5 rounded-xl font-semibold text-xs border transition-all active:scale-95 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                            isReady
                              ? 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-700 border-slate-200/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-slate-200 dark:border-neutral-700'
                              : 'bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60'
                          }`}
                        >
                          {isReady ? (
                            <><RotateCcw className="w-3.5 h-3.5" /> Batalkan</>
                          ) : (
                            <><Check className="w-3.5 h-3.5" /> Tandai Siap</>
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteOrder(order.id, branchName)}
                          title="Hapus Pesanan"
                          className="w-8 h-8 rounded-xl border border-rose-200/80 dark:border-rose-800/60 bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100/90 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 flex items-center justify-center transition-all cursor-pointer active:scale-95"
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