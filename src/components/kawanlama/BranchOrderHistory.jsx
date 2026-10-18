import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import * as XLSX from 'xlsx';
import { Package, Download, Lock, Clock } from 'lucide-react';

export default function BranchOrderHistory({ isDarkMode, currentUser }) {
  const [orders, setOrders] = useState([]);
  const [loadingOrderId, setLoadingOrderId] = useState(null);

  useEffect(() => {
    if (currentUser) fetchOrders();
  }, [currentUser]);

  const fetchOrders = async () => {
    // Ambil ID Cabang yang sedang masuk secara aman
    const currentBranchId = currentUser?.branch_id || currentUser?.id;

    if (!currentBranchId) return;

    const { data } = await supabase
      .from('kl_orders')
      .select('*, kl_promos(title), kl_order_items(*, kl_master_items(*))')
      .eq('branch_id', currentBranchId)
      .order('created_at', { ascending: false });
      
    if (data) setOrders(data);
  };

  // Fungsi untuk mengirim permohonan buka kunci ke admin
  const handleRequestUnlock = async (orderId) => {
    if (!window.confirm('Ajukan permohonan buka kunci pesanan ini kepada Administrasi Pusat agar dapat diperbarui?')) return;

    setLoadingOrderId(orderId);
    const { error } = await supabase
      .from('kl_orders')
      .update({ status: 'REQUEST_UNLOCK', lock_status: 'REQUEST_UNLOCK' })
      .eq('id', orderId);

    if (!error) {
      alert('Permohonan buka kunci berhasil dikirim kepada Administrasi Pusat.');
      fetchOrders();
    } else {
      alert('Gagal mengirim permohonan: ' + error.message);
    }
    setLoadingOrderId(null);
  };

  // Fungsi untuk Unduh Laporan ke Excel per Pesanan
  const handleExportExcel = (order) => {
    const promoTitle = order.kl_promos?.title || order.project_name || 'Pesanan_Cabang';
    const orderDate = new Date(order.created_at).toISOString().split('T')[0];

    const excelData = order.kl_order_items?.map((item, idx) => {
      const master = item.kl_master_items || {};
      return {
        'No': idx + 1,
        'Nama Barang': master.item_name || 'Barang Logistik',
        'Material / Bahan': master.material || '-',
        'Ukuran': master.size || '-',
        'Jumlah Pesanan': `${item.qty} Pcs`
      };
    }) || [];

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Pesanan');

    XLSX.writeFile(wb, `Laporan_Pesanan_${promoTitle}_${orderDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className={`p-5 rounded-3xl border shadow-2xs flex items-center gap-3 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}>
        <div className="p-2.5 rounded-xl bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-base tracking-wide">Riwayat & Pelacakan Pesanan Cabang</h2>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Daftar pengajuan pesanan logistik yang telah dikirimkan ke kantor pusat.</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className={`p-10 text-center rounded-3xl border text-xs text-slate-400 ${isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200/90'}`}>
          Belum terdapat riwayat pesanan yang diajukan oleh cabang ini.
        </div>
      ) : (
        orders.map(order => {
          const isApproved = order.status === 'APPROVED' || order.status === 'approved';
          const isRequesting = order.status === 'REQUEST_UNLOCK' || order.lock_status === 'REQUEST_UNLOCK';

          return (
            <div key={order.id} className={`p-6 rounded-3xl border shadow-2xs space-y-4 ${isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200/90 text-slate-800'}`}>
              
              {/* Header Kartu Pesanan */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200/80 dark:border-neutral-800 pb-3 gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
                      {order.kl_promos?.title || order.project_name || 'Pesanan Logistik Cabang'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-neutral-400 px-2 py-0.5 rounded-lg bg-slate-100/80 dark:bg-neutral-800 border border-slate-200/70 dark:border-neutral-700">
                      ID: {order.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-1">
                    Waktu Pengajuan: {new Date(order.created_at).toLocaleString('id-ID')}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Tombol Unduh Excel */}
                  <button
                    onClick={() => handleExportExcel(order)}
                    className="px-3.5 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60 font-semibold rounded-xl text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh Laporan Excel
                  </button>

                  {/* Lencana Status */}
                  <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                    order.status === 'SUBMITTED' 
                      ? 'bg-amber-50/90 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60' 
                      : isRequesting
                      ? 'bg-rose-50/90 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60'
                      : 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  }`}>
                    Status: {order.status === 'SUBMITTED' ? 'DIAJUKAN' : isRequesting ? 'PERMOHONAN BUKA KUNCI' : 'DISETUJUI'}
                  </span>

                  {/* Tombol Ajukan Buka Kunci */}
                  {isApproved && !isRequesting && (
                    <button
                      onClick={() => handleRequestUnlock(order.id)}
                      disabled={loadingOrderId === order.id}
                      className="px-3.5 py-1.5 bg-amber-50/90 hover:bg-amber-100/90 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800/60 font-semibold rounded-xl text-xs shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{loadingOrderId === order.id ? 'Mengirim...' : 'Ajukan Buka Kunci'}</span>
                    </button>
                  )}

                  {isRequesting && (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Menunggu persetujuan admin...
                    </span>
                  )}
                </div>
              </div>

              {/* Tabel Rincian Item */}
              <div className="max-h-[400px] overflow-y-auto relative rounded-2xl border border-slate-200/80 dark:border-neutral-800">
                <table className="w-full text-xs border-collapse">
                  <thead className={`sticky top-0 z-10 font-bold uppercase tracking-wider text-[11px] ${isDarkMode ? 'bg-neutral-900 text-neutral-300 border-b border-neutral-800' : 'bg-slate-50/95 text-slate-600 border-b border-slate-200/80'}`}>
                    <tr>
                      <th className="p-3.5 text-left">Nama Barang</th>
                      <th className="p-3.5 text-left">Material / Bahan</th>
                      <th className="p-3.5 text-left">Ukuran</th>
                      <th className="p-3.5 text-center w-28">Jumlah Pesanan</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800/70' : 'divide-slate-100'}`}>
                    {order.kl_order_items?.map((item, idx) => {
                      const master = item.kl_master_items || {};
                      return (
                        <tr key={idx} className={isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50/70'}>
                          <td className="p-3.5 font-semibold">{master.item_name || 'Barang Logistik'}</td>
                          <td className="p-3.5 text-slate-600 dark:text-neutral-300 uppercase font-medium">{master.material || '-'}</td>
                          <td className="p-3.5 text-slate-500 dark:text-neutral-400 uppercase font-mono">{master.size || '-'}</td>
                          <td className="p-3.5 text-center font-bold font-mono text-indigo-700 dark:text-indigo-300">
                            {item.qty} Pcs
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          );
        })
      )}
    </div>
  );
}