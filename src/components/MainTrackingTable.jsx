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
      {/* Table Header Controls */}
      <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-white/90 border-[#D8D2C2]'
      }`}>
        <div className="flex items-center gap-2 flex-1 w-full">
          <span className="text-sm">🔍</span>
          <input 
            type="text" 
            placeholder="Cari SPK, Client, atau Store Name..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className={`w-full text-xs bg-transparent focus:outline-none ${isDarkMode ? 'text-white' : 'text-[#2F3E3B]'}`} 
          />
        </div>
        <button 
          onClick={handleBatchPrint} 
          disabled={selectedSpkIds.length === 0} 
          className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center gap-2 transition-all ${
            selectedSpkIds.length > 0 
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer active:scale-95' 
              : 'bg-stone-300 dark:bg-neutral-700 text-stone-500 cursor-not-allowed'
          }`}
        >
          🖨️ Cetak {selectedSpkIds.length} Surat Form Sekaligus
        </button>
      </div>

      {/* Main Table dengan Sticky Header & Scrollable Body */}
      <div className={`max-h-[650px] overflow-y-auto relative rounded-2xl border shadow-sm transition-colors ${
        isDarkMode ? 'bg-[#121829] border-neutral-800' : 'bg-white/90 border-[#D8D2C2] backdrop-blur-md'
      }`}>
        <table className="w-full text-xs text-left border-collapse">
          <thead className={`sticky top-0 z-10 font-bold border-b transition-colors shadow-sm ${
            isDarkMode ? 'bg-neutral-900 text-neutral-300 border-neutral-800' : 'bg-[#EFECE6] text-[#3D4F4B] border-[#D8D2C2]'
          }`}>
            <tr>
              <th className="p-4 w-10 text-center">
                <input 
                  type="checkbox" 
                  checked={spkList.length > 0 && selectedSpkIds.length === spkList.length} 
                  onChange={() => handleToggleSelectAll(spkList)} 
                  className="w-4 h-4 cursor-pointer accent-indigo-600" 
                />
              </th>
              <th className="p-4">SPK & Info</th>
              <th className="p-4">Print</th>
              <th className="p-4">Finish</th>
              <th className="p-4">Paking & Foto</th>
              <th className="p-4">QC Check</th>
              <th className="p-4">Ship & Surat Jalan</th>
            </tr>
          </thead>
          <tbody className={`divide-y transition-colors ${isDarkMode ? 'divide-neutral-800' : 'divide-[#EAE5D9]'}`}>
            {displayedList.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-6 text-center opacity-60">Tidak ada data SPK yang ditemukan.</td>
              </tr>
            ) : (
              displayedList.map(i => {
                const pPrint = getPercent(i.qty_print, i.qty_order); 
                const pFinish = getPercent(i.qty_finish, i.qty_order); 
                const pPack = getPercent(i.qty_pack, i.qty_order); 
                const pShip = getPercent(i.qty_ship, i.qty_order);
                const isChecked = selectedSpkIds.includes(i.id);
                
                return (
                  <tr key={i.id} className={`transition-colors ${
                    isChecked ? (isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50/70') : 
                    (isDarkMode ? 'hover:bg-neutral-800/40' : 'hover:bg-[#F8F6F0]')
                  }`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => handleToggleCheck(i.id)} 
                        className="w-4 h-4 cursor-pointer accent-indigo-600" 
                      />
                    </td>
                    <td className="p-4">
                      <strong className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-[#5B7B70]'}`}>{i.no_spk}</strong><br/>
                      <span className={`font-semibold ${isDarkMode ? 'text-neutral-200' : 'text-[#2F3E3B]'}`}>{i.client} - {i.project}</span><br/>
                      <span className={`text-[10px] ${isDarkMode ? 'text-neutral-400' : 'text-[#6B7C77]'}`}>Order: {i.qty_order} Pcs</span>
                    </td>
                    
                    {/* Kolom Print */}
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pPrint).text}`}>{pPrint}%</span><br/>
                      {activeTab === 'produksi' && (
                        <input 
                          type="number" 
                          value={i.qty_print || 0} 
                          onChange={e => handleUpdateQty(i.id, 'qty_print', e.target.value, i.qty_order)} 
                          className={`mt-1.5 w-20 border rounded-lg px-2 py-1 focus:outline-none ${
                            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'
                          }`} 
                        />
                      )}
                    </td>
                    
                    {/* Kolom Finish */}
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pFinish).text}`}>{pFinish}%</span><br/>
                      {activeTab === 'finishing' && (
                        <input 
                          type="number" 
                          value={i.qty_finish || 0} 
                          onChange={e => handleUpdateQty(i.id, 'qty_finish', e.target.value, i.qty_order)} 
                          className={`mt-1.5 w-20 border rounded-lg px-2 py-1 focus:outline-none ${
                            isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'
                          }`} 
                        />
                      )}
                    </td>
                    
                    {/* Kolom Paking */}
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pPack).text}`}>{pPack}%</span><br/>
                      {activeTab === 'paking' && (
                        <div className="mt-1.5 space-y-1.5">
                          <input 
                            type="number" 
                            value={i.qty_pack || 0} 
                            onChange={e => handleUpdateQty(i.id, 'qty_pack', e.target.value, i.qty_finish)} 
                            className={`w-20 border rounded-lg px-2 py-1 focus:outline-none ${
                              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'
                            }`} 
                          />
                          <label className={`block text-center rounded-lg px-2 py-1 text-[10px] cursor-pointer font-bold transition-all border ${
                            isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-600' : 'bg-[#EFECE6] hover:bg-[#E5E0D5] text-[#3D4F4B] border-[#D8D2C2]'
                          }`}>
                            📷 Upload Foto Paking
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={e => {
                                const f = e.target.files[0]; 
                                if (f) {
                                  const r = new FileReader(); 
                                  r.onload = ev => handleUpdateField(i.id, { packing_visual_url: ev.target.result }); 
                                  r.readAsDataURL(f);
                                }
                              }} 
                              className="hidden" 
                            />
                          </label>
                          {i.packing_visual_url && (
                            <img 
                              src={i.packing_visual_url} 
                              alt="Paking" 
                              onClick={() => openImageModal(i.packing_visual_url, `Foto Paking: ${i.no_spk}`)} 
                              className="w-12 h-8 object-cover rounded border cursor-pointer hover:scale-110" 
                            />
                          )}
                        </div>
                      )}
                    </td>

                    {/* Kolom QC */}
                    <td className="p-4 space-y-1.5">
                      <select 
                        value={i.qc_checker || ''} 
                        onChange={e => handleUpdateField(i.id, { qc_checker: e.target.value })} 
                        className={`block w-full rounded-lg border p-1 text-[10px] focus:outline-none ${
                          isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'
                        }`}
                      >
                        <option value="">-- QC Checker --</option>
                        {STAFF_QC_LIST.map(s => <option key={s}>{s}</option>)}
                      </select>
                      <select 
                        value={i.qc_paking || ''} 
                        onChange={e => handleUpdateField(i.id, { qc_paking: e.target.value })} 
                        className={`block w-full rounded-lg border p-1 text-[10px] focus:outline-none ${
                          isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'
                        }`}
                      >
                        <option value="">-- QC Paking --</option>
                        {STAFF_QC_LIST.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>

                    {/* Kolom Pengiriman */}
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md border font-bold ${getStatusBadge(pShip).text}`}>{pShip}%</span><br/>
                      {activeTab === 'pengiriman' && (
                        <div className="mt-1.5 space-y-1.5">
                          <input 
                            type="number" 
                            value={i.qty_ship || 0} 
                            onChange={e => handleUpdateQty(i.id, 'qty_ship', e.target.value, i.qty_pack)} 
                            className={`w-20 border rounded-lg px-2 py-1 focus:outline-none ${
                              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-black'
                            }`} 
                          />
                          <label className={`block text-center rounded-lg px-2 py-1 text-[10px] cursor-pointer font-bold transition-all border ${
                            isDarkMode ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-600' : 'bg-[#EFECE6] hover:bg-[#E5E0D5] text-[#3D4F4B] border-[#D8D2C2]'
                          }`}>
                            📤 Upload Surat Jalan
                            <input type="file" onChange={e => handleUploadSuratJalan(e, i)} accept="image/*,application/pdf" className="hidden"/>
                          </label>
                        </div>
                      )}
                      {i.surat_jalan_url && (
                        <a href={i.surat_jalan_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-[10px] block mt-1">
                          📄 Lihat SJ
                        </a>
                      )}
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