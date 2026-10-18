import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Wrench, Trash2, Save } from 'lucide-react';
import CustomDropdown from './ui/CustomDropdown';

export default function FinishingPanel({ isDarkMode, spkList, fetchSpkData }) {
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({
    finishing_type: 'inhouse',
    sub_vendor_name: '',
    qty_finish_sub_out: 0,
    qty_finish: 0,
  });

  const initFinishingForm = (item) => {
    if (!item) return;
    setSelectedSpkId(item.id);
    setFinishingForm({
      finishing_type: item.finishing_type || 'inhouse',
      sub_vendor_name: item.sub_vendor_name || '',
      qty_finish_sub_out: item.qty_finish_sub_out || 0,
      qty_finish: item.qty_finish || 0,
    });
  };

  useEffect(() => {
    if (spkList && spkList.length > 0 && !selectedSpkId) {
      initFinishingForm(spkList[0]);
    }
  }, [spkList, selectedSpkId]);

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId);
    const item = spkList.find((s) => String(s.id) === String(spkId));
    if (item) {
      setFinishingForm({
        finishing_type: item.finishing_type || 'inhouse',
        sub_vendor_name: item.sub_vendor_name || '',
        qty_finish_sub_out: item.qty_finish_sub_out || 0,
        qty_finish: item.qty_finish || 0,
      });
    }
  };

  const handleTypeChange = (newType) => {
    const activeItem = spkList.find((s) => String(s.id) === String(selectedSpkId));
    const currentDbTypes = activeItem?.finishing_type || 'inhouse';

    if (newType === currentDbTypes) {
      setFinishingForm({
        finishing_type: newType,
        sub_vendor_name: activeItem?.sub_vendor_name || '',
        qty_finish_sub_out: activeItem?.qty_finish_sub_out || 0,
        qty_finish: activeItem?.qty_finish || 0,
      });
    } else {
      setFinishingForm({
        finishing_type: newType,
        sub_vendor_name: '',
        qty_finish_sub_out: 0,
        qty_finish: 0,
      });
    }
  };

  const handleSubmitFinishing = async (e) => {
    e.preventDefault();
    const activeItem = spkList.find((s) => String(s.id) === String(selectedSpkId));
    if (!activeItem) return;

    const { finishing_type, sub_vendor_name, qty_finish_sub_out, qty_finish } = finishingForm;

    const outQty = Number(qty_finish_sub_out) || 0;
    let backQty = Number(qty_finish) || 0;
    const maxFinishingAllowed = Number(activeItem.qty_print > 0 ? activeItem.qty_print : activeItem.qty_order || 0);

    if (finishing_type === 'sub') {
      if (outQty > maxFinishingAllowed) {
        alert(`Jumlah pengiriman ke mitra (${outQty} unit) tidak boleh melebihi jumlah cetak (${maxFinishingAllowed} unit).`);
        return;
      }
      if (outQty === 0 && backQty > 0) {
        alert('Barang belum dikirim ke mitra subkontrak (Keluar = 0 unit). Tidak dapat mengisi jumlah diterima kembali.');
        return;
      }
      if (backQty > outQty) {
        alert(`Jumlah diterima kembali (${backQty} unit) melebihi jumlah yang dikirim ke mitra (${outQty} unit).`);
        return;
      }
    } else {
      if (backQty > maxFinishingAllowed) {
        alert(`Jumlah penyelesaian tahap akhir (${backQty} unit) tidak boleh melebihi jumlah cetak (${maxFinishingAllowed} unit).`);
        backQty = maxFinishingAllowed;
      }
    }

    const payload = {
      finishing_type,
      sub_vendor_name: finishing_type === 'sub' ? sub_vendor_name : '',
      qty_finish_sub_out: finishing_type === 'sub' ? outQty : 0,
      qty_finish: backQty,
    };

    const { error } = await supabase.from('spk_data').update(payload).eq('id', activeItem.id);
    if (error) {
      alert('Gagal menyimpan data penyelesaian: ' + error.message);
    } else {
      alert(`Data tahap penyelesaian untuk SPK ${activeItem.no_spk} (${activeItem.client}) berhasil disimpan. Total selesai: ${backQty} unit.`);
      if (fetchSpkData) fetchSpkData();
    }
  };

  const activeSpkItem = spkList.find((item) => String(item.id) === String(selectedSpkId)) || spkList[0];
  const hasSpkData = Boolean(spkList && spkList.length > 0 && activeSpkItem);

  const handleDeleteSelectedSpk = async () => {
    if (!activeSpkItem) return;
    if (window.confirm(`Apakah Anda yakin ingin menghapus SPK "${activeSpkItem.no_spk}" (${activeSpkItem.client}) dari daftar?`)) {
      const { error } = await supabase.from('spk_data').delete().eq('id', activeSpkItem.id);
      if (!error) {
        alert(`SPK "${activeSpkItem.no_spk}" berhasil dihapus.`);
        if (fetchSpkData) fetchSpkData();
        setSelectedSpkId('');
      } else {
        alert('Gagal menghapus SPK: ' + error.message);
      }
    }
  };

  const handleDeleteAllSpkData = async () => {
    if (window.confirm(`Konfirmasi: Apakah Anda yakin ingin menghapus seluruh ${spkList.length} data SPK secara permanen?`)) {
      const { error } = await supabase.from('spk_data').delete().gt('id', 0);
      if (!error) {
        alert('Seluruh data SPK telah dihapus.');
        if (fetchSpkData) fetchSpkData();
        setSelectedSpkId('');
      } else {
        alert('Gagal menghapus seluruh data SPK: ' + error.message);
      }
    }
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));

  return (
    <form
      onSubmit={handleSubmitFinishing}
      className={`p-6 rounded-2xl border shadow-2xs transition-colors space-y-5 max-h-[82vh] overflow-y-auto relative custom-scrollbar ${
        isDarkMode ? 'bg-neutral-900 border-neutral-800 text-slate-100' : 'bg-white border-slate-200/90 text-slate-800'
      }`}
    >
      {/* Header Panel */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-3 ${
        isDarkMode ? 'border-neutral-800' : 'border-slate-200/80'
      }`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50/90 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Panel Kendali Finishing</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Kelola pengerjaan internal maupun subkontrak mitra eksternal</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pilih Nomor SPK:</label>
          <CustomDropdown
            value={selectedSpkId}
            onChange={(e) => handleSelectSpk(e.target.value)}
            disabled={!hasSpkData}
            className="w-72"
          >
            {hasSpkData ? (
              spkList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.no_spk} - {item.client} ({item.project})
                </option>
              ))
            ) : (
              <option value="">Belum Ada Data SPK</option>
            )}
          </CustomDropdown>

          {hasSpkData && (
            <button
              type="button"
              onClick={handleDeleteSelectedSpk}
              className="px-3 py-2 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-xl text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Hapus SPK yang sedang dipilih"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus SPK Aktif
            </button>
          )}

          {hasSpkData && (
            <button
              type="button"
              onClick={handleDeleteAllSpkData}
              className="px-3 py-2 bg-rose-50/90 hover:bg-rose-100/90 text-rose-700 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60 font-semibold rounded-xl text-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Hapus seluruh data SPK"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus Seluruh SPK
            </button>
          )}
        </div>
      </div>

      {!hasSpkData ? (
        <div className={`p-12 text-center text-slate-500 border border-dashed rounded-2xl space-y-2 my-4 ${
          isDarkMode ? 'border-neutral-800 bg-neutral-900/50' : 'border-slate-200 bg-slate-50/60'
        }`}>
          <Wrench className="w-9 h-9 mx-auto opacity-40 text-slate-400" />
          <p className="font-semibold text-sm text-slate-700 dark:text-slate-300">Belum Ada Data SPK pada Panel Penyelesaian</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Silakan impor berkas SPK atau buat pesanan terlebih dahulu untuk menampilkan kendali penyelesaian.</p>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 ${finishingForm.finishing_type === 'sub' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 text-xs`}>
            <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-800/60' : 'border-slate-200/80 bg-slate-50/80'}`}>
              <div className="text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase">Jumlah Pesanan</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{activeSpkItem.qty_order?.toLocaleString()} Unit</div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30">
              <div className="text-amber-800 dark:text-amber-300 font-semibold text-[11px] uppercase">
                {finishingForm.finishing_type === 'sub' ? 'Sisa Belum Dikirim' : 'Sisa Belum Selesai'}
              </div>
              <div className="text-sm font-bold text-amber-900 dark:text-amber-200 mt-1">
                {finishingForm.finishing_type === 'sub'
                  ? Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish_sub_out) || 0)).toLocaleString()
                  : Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()}{' '}
                Unit
              </div>
            </div>

            {finishingForm.finishing_type === 'sub' ? (
              <>
                <div className="p-3.5 rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/80 dark:bg-blue-950/30">
                  <div className="text-blue-700 dark:text-blue-300 font-semibold text-[11px] uppercase">Dikirim ke Mitra (Keluar)</div>
                  <div className="text-sm font-bold text-blue-800 dark:text-blue-200 mt-1">
                    {(Number(finishingForm.qty_finish_sub_out) || 0).toLocaleString()} Unit
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30">
                  <div className="text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] uppercase">Diterima Kembali (Masuk)</div>
                  <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                    {(Number(finishingForm.qty_finish) || 0).toLocaleString()} Unit
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30">
                  <div className="text-amber-800 dark:text-amber-300 font-semibold text-[11px] uppercase">Menunggu Pengembalian Mitra</div>
                  <div className="text-sm font-bold text-amber-900 dark:text-amber-200 mt-1">
                    {Math.max(0, (Number(finishingForm.qty_finish_sub_out) || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()} Unit
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30">
                  <div className="text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] uppercase">Selesai Internal</div>
                  <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mt-1">
                    {(Number(finishingForm.qty_finish) || 0).toLocaleString()} Unit
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'border-neutral-800 bg-neutral-800/60' : 'border-slate-200/80 bg-slate-50/80'}`}>
                  <div className="text-slate-500 dark:text-slate-400 font-semibold text-[11px] uppercase">Capaian Penyelesaian</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {getPercent(Number(finishingForm.qty_finish) || 0, activeSpkItem.qty_order || 1)}%
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end text-xs pt-2">
            <div>
              <label className="block font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Metode Pengerjaan:</label>
              <CustomDropdown
                value={finishingForm.finishing_type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full"
              >
                <option value="inhouse">Internal (Inhouse)</option>
                <option value="sub">Subkontrak (Mitra Eksternal)</option>
              </CustomDropdown>
            </div>

            {finishingForm.finishing_type !== 'sub' ? (
              <div>
                <label className="block font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Jumlah Selesai (Unit):</label>
                <input
                  type="number"
                  min="0"
                  max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
                  value={finishingForm.qty_finish}
                  onChange={(e) => {
                    let val = Number(e.target.value) || 0;
                    const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                    if (val > maxAllowed) {
                      alert(`Jumlah penyelesaian (${val} unit) tidak boleh melebihi jumlah cetak (${maxAllowed} unit).`);
                      val = maxAllowed;
                    }
                    setFinishingForm({ ...finishingForm, qty_finish: val });
                  }}
                  className={`w-full p-2.5 rounded-xl font-semibold text-xs border focus:outline-none ${
                    isDarkMode ? 'bg-neutral-800 border-neutral-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Nama Mitra Subkontrak:</label>
                  <input
                    type="text"
                    placeholder="Contoh: CV Poly Mas"
                    value={finishingForm.sub_vendor_name}
                    onChange={(e) => setFinishingForm({ ...finishingForm, sub_vendor_name: e.target.value })}
                    className={`w-full p-2.5 rounded-xl font-medium text-xs border focus:outline-none ${
                      isDarkMode ? 'bg-neutral-800 border-neutral-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1.5 text-slate-700 dark:text-slate-300">1. Jumlah Dikirim Keluar (Unit):</label>
                  <input
                    type="number"
                    min="0"
                    max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
                    value={finishingForm.qty_finish_sub_out}
                    onChange={(e) => {
                      let val = Number(e.target.value) || 0;
                      const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                      if (val > maxAllowed) {
                        alert(`Jumlah keluar ke mitra (${val} unit) tidak boleh melebihi jumlah cetak (${maxAllowed} unit).`);
                        val = maxAllowed;
                      }
                      const currentBack = Number(finishingForm.qty_finish) || 0;
                      const adjustedBack = currentBack > val ? val : currentBack;
                      setFinishingForm({ ...finishingForm, qty_finish_sub_out: val, qty_finish: adjustedBack });
                    }}
                    className={`w-full p-2.5 rounded-xl font-semibold text-xs border focus:outline-none ${
                      isDarkMode ? 'bg-neutral-800 border-neutral-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1.5 text-slate-700 dark:text-slate-300">2. Jumlah Diterima Kembali (Unit):</label>
                  <input
                    type="number"
                    min="0"
                    disabled={Number(finishingForm.qty_finish_sub_out) <= 0}
                    max={finishingForm.qty_finish_sub_out}
                    value={finishingForm.qty_finish}
                    onChange={(e) => {
                      let val = Number(e.target.value) || 0;
                      const maxBack = Number(finishingForm.qty_finish_sub_out) || 0;
                      if (val > maxBack) {
                        alert(`Jumlah diterima kembali tidak boleh melebihi jumlah pengiriman ke mitra (${maxBack} unit).`);
                        val = maxBack;
                      }
                      setFinishingForm({ ...finishingForm, qty_finish: val });
                    }}
                    className={`w-full p-2.5 rounded-xl font-semibold text-xs border ${
                      Number(finishingForm.qty_finish_sub_out) <= 0
                        ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 dark:bg-neutral-800 dark:border-neutral-700'
                        : (isDarkMode ? 'bg-neutral-800 border-neutral-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800')
                    }`}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl font-semibold text-xs border transition-all active:scale-95 bg-blue-50/90 hover:bg-blue-100/90 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800/60 cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> Simpan Capaian Penyelesaian
            </button>
          </div>
        </>
      )}
    </form>
  );
}