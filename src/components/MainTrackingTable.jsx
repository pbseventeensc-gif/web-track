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
  searchTerm,
  setSearchTerm
}) {
  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-3 transition-colors shadow-xs ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className={`flex items-center gap-2.5 w-full sm:w-80 relative border rounded-xl px-3 py-2 transition-all ${
          isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari No SPK / Project / Store..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent focus:outline-none font-medium placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedSpkIds.length > 0 && (
            <>
              <button
                onClick={handleBatchPrint}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-orange-400 dark:text-orange-600" /> Cetak Batch ({selectedSpkIds.length})
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus Massal ({selectedSpkIds.length})
              </button>
            </>
          )}
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
            Total: <strong className="font-bold text-slate-900 dark:text-white">{displayedList.length}</strong> SPK
          </span>
        </div>
      </div>

      {/* Table Container */}
      <div className={`max-h-[680px] overflow-y-auto overflow-x-auto relative rounded-2xl border shadow-xs transition-colors custom-scrollbar ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-20 border-b text-xs font-bold uppercase tracking-wider ${
            isDarkMode
              ? 'bg-neutral-800/90 border-neutral-700/80 text-neutral-300'
              : 'bg-slate-50/90 border-slate-200 text-slate-500'
          }`}>
            <tr>
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={displayedList.length > 0 && selectedSpkIds.length === displayedList.length}
                  onChange={() => handleToggleSelectAll(displayedList)}
                  className="cursor-pointer accent-orange-600 w-4 h-4 rounded"
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

          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-slate-100'}`}>
            {displayedList.length === 0 ? (
              <tr>
                <td colSpan="12" className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">
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
                    className={`transition-colors ${
                      isChecked
                        ? (isDarkMode ? 'bg-orange-950/20' : 'bg-orange-50/60')
                        : (isDarkMode ? 'hover:bg-neutral-800/50' : 'hover:bg-slate-50/80')
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCheck(item.id)}
                        className="cursor-pointer accent-orange-600 w-4 h-4 rounded"
                      />
                    </td>

                    <td className="p-3">
                      <div className="font-mono text-slate-500 dark:text-slate-400 font-bold text-xs">{item.no_spk}</div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm mt-0.5">{item.project || '-'}</div>
                      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-medium mt-0.5">{item.client || '-'} ({item.store_code || '-'})</div>
                    </td>

                    <td className="p-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200 text-xs">{item.bahan || 'Bahan Standar'}</div>
                      <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{item.ukuran || '-'}</div>
                    </td>

                    <td className="p-3 text-center font-bold text-slate-900 dark:text-white text-sm">
                      {Number(item.qty_order || 0).toLocaleString()}
                    </td>

                    {activeTab === 'produksi' && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_print || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_print', e.target.value, item.qty_order)}
                          className={`w-16 p-1.5 text-center font-bold rounded-lg border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                        />
                      </td>
                    )}

                    {activeTab === 'produksi' && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_finish || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_finish', e.target.value, item.qty_order)}
                          className={`w-16 p-1.5 text-center font-bold rounded-lg border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                        />
                      </td>
                    )}

                    {(activeTab === 'paking' || activeTab === 'produksi') && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_pack || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_pack', e.target.value, item.qty_order)}
                          className={`w-16 p-1.5 text-center font-bold rounded-lg border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                        />
                      </td>
                    )}

                    {(activeTab === 'pengiriman' || activeTab === 'produksi') && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_ship || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_ship', e.target.value, item.qty_order)}
                          className={`w-16 p-1.5 text-center font-bold rounded-lg border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                        />
                      </td>
                    )}

                    <td className="p-3 text-center">
                      {percent === 100 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 100%
                        </span>
                      ) : percent > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {percent}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-neutral-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> 0%
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <select
                        value={item.qc_checker || ''}
                        onChange={(e) => handleUpdateField(item.id, { qc_checker: e.target.value })}
                        className={`p-1.5 rounded-lg text-xs font-medium border focus:outline-none ${
                          isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="">-- Pilih QC --</option>
                        {['Staff QC 1', 'Staff QC 2', 'Staff QC 3', 'Staff QC 4'].map((staff, idx) => (
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" /> Lihat SJ
                        </a>
                      ) : (
                        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700' : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
                        }`}>
                          <Upload className="w-3.5 h-3.5 text-slate-400" /> Upload SJ
                          <input type="file" onChange={(e) => handleUploadSuratJalan(e, item)} className="hidden" />
                        </label>
                      )}
                    </td>

                    {/* Delete button */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteSpk(item.id, item.no_spk)}
                        title="Hapus SPK"
                        className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 inline-flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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