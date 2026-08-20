import React from 'react';

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
  setSearchTerm,
  handleExcelUpload,        // <-- Ditambahkan untuk Upload Excel
  handleGoogleSheetImport   // <-- Ditambahkan untuk Import Google Sheets
}) {
  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row justify-between items-center gap-3 ${
        isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200/80'
      }`}>
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          {/* Tombol Upload SPK Excel */}
          {handleExcelUpload && (
            <label className="px-3.5 py-2 rounded-xl cursor-pointer text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap">
              📁 Upload SPK Excel
              <input type="file" accept=".xlsx" onChange={handleExcelUpload} className="hidden" />
            </label>
          )}

          {/* Tombol Import Google Sheet */}
          {handleGoogleSheetImport && (
            <button
              onClick={handleGoogleSheetImport}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
            >
              🌐 Import Google Sheet
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border w-full sm:w-64 bg-stone-50 dark:bg-neutral-900 dark:border-neutral-700">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Cari No SPK / Project / Store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-transparent focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedSpkIds.length > 0 && (
            <>
              <button
                onClick={handleBatchPrint}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                🖨️ Cetak Batch ({selectedSpkIds.length})
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
              >
                🗑️ Hapus Massal ({selectedSpkIds.length})
              </button>
            </>
          )}
          <span className="text-xs opacity-70 ml-1">
            Total: <strong>{displayedList.length}</strong> SPK
          </span>
        </div>
      </div>

      {/* Table Container */}
      <div className={`max-h-[680px] overflow-y-auto overflow-x-auto relative rounded-2xl border shadow-sm custom-scrollbar ${
        isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white border-stone-200/80'
      }`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead className={`sticky top-0 z-20 font-bold border-b shadow-sm ${
            isDarkMode ? 'bg-neutral-900 text-neutral-200 border-neutral-700' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'
          }`}>
            <tr>
              <th className="p-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={displayedList.length > 0 && selectedSpkIds.length === displayedList.length}
                  onChange={() => handleToggleSelectAll(displayedList)}
                  className="cursor-pointer accent-indigo-600"
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
          <tbody className={`divide-y ${isDarkMode ? 'divide-neutral-800' : 'divide-stone-100'}`}>
            {displayedList.length === 0 ? (
              <tr>
                <td colSpan="12" className="p-8 text-center opacity-60">
                  Tidak ada data SPK yang ditemukan.
                </td>
              </tr>
            ) : (
              displayedList.map((item) => {
                const isChecked = selectedSpkIds.includes(item.id);
                const percent = getPercent(item.qty_print || 0, item.qty_order || 1);
                const badge = getStatusBadge(percent);

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isChecked
                        ? isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70'
                        : isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-stone-50'
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCheck(item.id)}
                        className="cursor-pointer accent-indigo-600"
                      />
                    </td>

                    <td className="p-3 font-medium">
                      <div className="font-bold text-indigo-500">{item.no_spk}</div>
                      <div className="text-[11px] font-bold text-stone-800 dark:text-neutral-200">{item.project || '-'}</div>
                      <div className="text-[10px] opacity-60">{item.client || '-'} ({item.store_code || '-'})</div>
                    </td>

                    <td className="p-3">
                      <div>{item.bahan || 'Bahan Standar'}</div>
                      <div className="text-[10px] opacity-60">{item.ukuran || '-'}</div>
                    </td>

                    <td className="p-3 text-center font-bold">
                      {Number(item.qty_order || 0).toLocaleString()}
                    </td>

                    {activeTab === 'produksi' && (
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          defaultValue={item.qty_print || 0}
                          onBlur={(e) => handleUpdateQty(item.id, 'qty_print', e.target.value, item.qty_order)}
                          className={`w-16 p-1 text-center rounded border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
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
                          className={`w-16 p-1 text-center rounded border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
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
                          className={`w-16 p-1 text-center rounded border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
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
                          className={`w-16 p-1 text-center rounded border text-xs ${
                            isDarkMode ? 'bg-neutral-800 border-neutral-700' : 'bg-white border-stone-200'
                          }`}
                        />
                      </td>
                    )}

                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-xl text-[10px] font-bold ${badge.text}`}>
                        {badge.icon} {percent}%
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <select
                        value={item.qc_checker || ''}
                        onChange={(e) => handleUpdateField(item.id, { qc_checker: e.target.value })}
                        className={`p-1 rounded text-[11px] border focus:outline-none ${
                          isDarkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-stone-200'
                        }`}
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
                          className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-bold inline-block hover:bg-emerald-500"
                        >
                          📄 Lihat SJ
                        </a>
                      ) : (
                        <label className="cursor-pointer px-2 py-1 bg-stone-200 dark:bg-neutral-700 hover:bg-stone-300 rounded text-[10px] font-bold inline-block">
                          Upload SJ <input type="file" onChange={(e) => handleUploadSuratJalan(e, item)} className="hidden" />
                        </label>
                      )}
                    </td>

                    {/* Tombol Hapus Satuan */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteSpk(item.id, item.no_spk)}
                        className="px-2.5 py-1 rounded-xl font-bold text-[11px] bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all active:scale-95"
                      >
                        🗑️ Hapus
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