import React from 'react';
import { Search, Printer, Trash2, Upload, FileText, Check, Clock } from 'lucide-react';

export default function MainTrackingTable({
  isDarkMode,
  activeTab,
  spkList,
  displayedList,
  selectedSpkIds,
  handleToggleCheck,
  handleToggleSelectAll,
  handleUpdateQty,
  handleUpdateField,
  handleDeleteSpk,
  handleBatchDelete,
  handleBatchPrint,
  openImageModal,
  handleUploadSuratJalan,
  getPercent,
  getStatusBadge,
  STAFF_QC_LIST,
  searchTerm,
  setSearchTerm
}) {
  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 bg-white shadow-2xs">
        <div className="flex items-center gap-2.5 w-full sm:w-80 relative bg-white border border-slate-300 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Cari No SPK / Project / Store..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none font-semibold text-black placeholder-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedSpkIds.length > 0 && (
            <>
              <button
                onClick={handleBatchPrint}
                className="px-3.5 py-2 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" /> Cetak Batch ({selectedSpkIds.length})
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-700" /> Hapus Massal ({selectedSpkIds.length})
              </button>
            </>
          )}
          <span className="text-xs font-semibold text-slate-600 ml-1">
            Total: <strong className="text-black font-black">{displayedList.length}</strong> SPK
          </span>
        </div>
      </div>

      {/* Table Container */}
      <div className="max-h-[680px] overflow-y-auto overflow-x-auto relative rounded-2xl border border-slate-200/80 shadow-2xs bg-white custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse bg-white">
          <thead className="sticky top-0 z-20 bg-[#F8FAFC] border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={displayedList.length > 0 && selectedSpkIds.length === displayedList.length}
                  onChange={() => handleToggleSelectAll(displayedList)}
                  className="cursor-pointer accent-indigo-600 w-4 h-4"
                />
              </th>
              <th className="p-3">No. SPK & Info Store</th>
              <th className="p-3">Spesifikasi Material</th>
              <th className="p-3 text-center">Order Qty</th>
              {activeTab === 'produksi' && <th className="p-3 text-center">Qty Print</th>}
              {activeTab === 'produksi' && <th className="p-3 text-center">Qty Finish</th>}
              {(activeTab === 'paking' || activeTab === 'produksi') && <th className="p-3 text-center">Qty Pack</th>}
              {(activeTab === 'pengiriman' || activeTab === 'produksi') && <th className="p-3 text-center">Qty Kirim</th>}
              <th className="p-3 text-center">Progress</th>
              <th className="p-3 text-center">QC Checker</th>
              <th className="p-3 text-center">Surat Jalan</th>
              <th className="p-3 text-center w-20">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {displayedList.length === 0 ? (
              <tr>
                <td colSpan="12" className="p-8 text-center text-slate-400 font-medium">
                  Tidak ada data SPK yang ditemukan.
                </td>
              </tr>
            ) : (
              displayedList.map((item) => {
                const isChecked = selectedSpkIds.includes(item.id);
                const percent = getPercent(item.qty_print || 0, item.qty_order || 1);

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-slate-50/80 ${isChecked ? 'bg-indigo-50/60' : 'bg-white'}`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCheck(item.id)}
                        className="cursor-pointer accent-indigo-600 w-4 h-4"
                      />
                    </td>

                    <td className="p-3">
                      <div className="font-mono text-slate-600 font-bold text-xs">{item.no_spk}</div>
                      <div className="font-bold text-slate-900 text-xs sm:text-sm mt-0.5">{item.project || '-'}</div>
                      <div className="text-[10px] font-mono text-slate-400 font-medium mt-0.5">{item.client || '-'} ({item.store_code || '-'})</div>
                    </td>

                    <td className="p-3">
                      <div className="font-medium text-slate-700 text-xs">{item.bahan || 'Bahan Standar'}</div>
                      <div className="text-[10px] font-medium text-slate-400 mt-0.5">{item.ukuran || '-'}</div>
                    </td>

                    <td className="p-3 text-center font-black text-black text-sm">
                      {Number(item.qty_order || 0).toLocaleString()}
                    </td>

                    {activeTab === 'produksi' && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_print || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_print', e.target.value, item.qty_order)}
                          className="w-16 p-1.5 text-center font-extrabold rounded-lg border border-slate-300 text-xs bg-white text-black"
                        />
                      </td>
                    )}

                    {activeTab === 'produksi' && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_finish || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_finish', e.target.value, item.qty_order)}
                          className="w-16 p-1.5 text-center font-extrabold rounded-lg border border-slate-300 text-xs bg-white text-black"
                        />
                      </td>
                    )}

                    {(activeTab === 'paking' || activeTab === 'produksi') && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_pack || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_pack', e.target.value, item.qty_order)}
                          className="w-16 p-1.5 text-center font-extrabold rounded-lg border border-slate-300 text-xs bg-white text-black"
                        />
                      </td>
                    )}

                    {(activeTab === 'pengiriman' || activeTab === 'produksi') && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_ship || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_ship', e.target.value, item.qty_order)}
                          className="w-16 p-1.5 text-center font-extrabold rounded-lg border border-slate-300 text-xs bg-white text-black"
                        />
                      </td>
                    )}

                    <td className="p-3 text-center">
                      {percent === 100 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> 100%
                        </span>
                      ) : percent > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" /> {percent}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> 0%
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <select
                        value={item.qc_checker || ''}
                        onChange={(e) => handleUpdateField(item.id, { qc_checker: e.target.value })}
                        className="p-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-black focus:outline-none"
                      >
                        <option value="">-- Pilih QC --</option>
                        {STAFF_QC_LIST.map((staff, idx) => (
                          <option key={idx} value={staff}>{staff}</option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3 text-center">
                      {item.surat_jalan_url ? (
                        <a
                          href={item.surat_jalan_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-700" /> Lihat SJ
                        </a>
                      ) : (
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-black border border-slate-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-slate-700" /> Upload SJ <input type="file" onChange={(e) => handleUploadSuratJalan(e, item)} className="hidden" />
                        </label>
                      )}
                    </td>

                    {/* Tombol Hapus Satuan */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteSpk(item.id, item.no_spk)}
                        title="Hapus SPK"
                        className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center justify-center transition-all shadow-2xs active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                      </button>
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