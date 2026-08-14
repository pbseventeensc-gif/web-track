import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function FinishingPanel({ isDarkMode, spkList, fetchSpkData }) {
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({
    finishing_type: 'inhouse',
    sub_vendor_name: '',
    qty_finish_sub_out: 0,
    qty_finish: 0,
  });

  useEffect(() => {
    if (spkList && spkList.length > 0 && !selectedSpkId) {
      initFinishingForm(spkList[0]);
    }
  }, [spkList]);

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
        alert(`❌ Gagal: Jumlah barang keluar ke vendor (${outQty} pcs) tidak boleh melebihi Qty Print (${maxFinishingAllowed} pcs)!`);
        return;
      }
      if (outQty === 0 && backQty > 0) {
        alert(`❌ Gagal: Barang belum pernah dikirim ke vendor (Out = 0 pcs). Tidak bisa mengisi Terima Back!`);
        return;
      }
      if (backQty > outQty) {
        alert(`❌ Gagal: Jumlah barang balik (${backQty} pcs) melebihi jumlah yang dikirim ke vendor (${outQty} pcs)!`);
        return;
      }
    } else {
      if (backQty > maxFinishingAllowed) {
        alert(`❌ Gagal: Jumlah Selesai Finishing (${backQty} pcs) tidak boleh melebihi Qty Print (${maxFinishingAllowed} pcs)!`);
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
      alert('Gagal menyimpan data finishing: ' + error.message);
    } else {
      alert(`✅ Data Finishing SPK ${activeItem.no_spk} (${activeItem.client}) berhasil disimpan! Total Selesai: ${backQty} pcs.`);
      if (fetchSpkData) fetchSpkData();
    }
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));

  const activeSpkItem = spkList.find((item) => String(item.id) === String(selectedSpkId)) || spkList[0];
  if (!activeSpkItem) return null;

  return (
    <form
      onSubmit={handleSubmitFinishing}
      className={`p-5 rounded-2xl border shadow-sm transition-colors space-y-4 max-h-[80vh] overflow-y-auto relative ${
        isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-white' : 'bg-white/90 border-[#D8D2C2] text-[#2F3E3B]'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-3 gap-3 border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xl">🛠️</span>
          <div>
            <h3 className="font-bold text-sm">Panel Kontrol Finishing</h3>
            <p className="text-xs opacity-70">Kelola pengerjaan Inhouse & Sub-Finishing (Makloon)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold">Pilih SPK:</label>
          <select
            value={selectedSpkId}
            onChange={(e) => handleSelectSpk(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold border focus:outline-none ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
            }`}
          >
            {spkList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.no_spk} - {item.client} ({item.project})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={`grid grid-cols-2 ${finishingForm.finishing_type === 'sub' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 text-xs`}>
        <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-stone-50 border-[#E5E0D5]'}`}>
          <div className="opacity-70 text-[10px]">Qty Order</div>
          <div className="text-base font-bold">{activeSpkItem.qty_order?.toLocaleString()} pcs</div>
        </div>

        <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
          <div className="text-amber-600 dark:text-amber-400 font-medium text-[10px]">
            {finishingForm.finishing_type === 'sub' ? 'Sisa Order (Belum Out)' : 'Sisa Order (Belum Selesai)'}
          </div>
          <div className="text-base font-bold text-amber-700 dark:text-amber-300">
            {finishingForm.finishing_type === 'sub'
              ? Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish_sub_out) || 0)).toLocaleString()
              : Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()}{' '}
            pcs
          </div>
        </div>

        {finishingForm.finishing_type === 'sub' ? (
          <>
            <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-blue-950/30 border-blue-800/50' : 'bg-blue-50 border-blue-200'}`}>
              <div className="text-blue-600 dark:text-blue-400 font-medium text-[10px]">Dikirim ke Vendor (Out)</div>
              <div className="text-base font-bold text-blue-700 dark:text-blue-300">
                {(Number(finishingForm.qty_finish_sub_out) || 0).toLocaleString()} pcs
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-green-950/30 border-green-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">Sudah Balik Vendor (Back)</div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                {(Number(finishingForm.qty_finish) || 0).toLocaleString()} pcs
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
              <div className="text-amber-600 dark:text-amber-400 font-medium text-[10px]">Belum Balik Vendor</div>
              <div className="text-base font-bold text-amber-700 dark:text-amber-300">
                {Math.max(0, (Number(finishingForm.qty_finish_sub_out) || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()} pcs
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-green-950/30 border-green-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">Total Selesai Inhouse</div>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                {(Number(finishingForm.qty_finish) || 0).toLocaleString()} pcs
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${isDarkMode ? 'bg-neutral-900/60 border-neutral-700' : 'bg-stone-50 border-[#E5E0D5]'}`}>
              <div className="opacity-70 text-[10px]">Progres Finishing</div>
              <div className="text-base font-bold">
                {getPercent(Number(finishingForm.qty_finish) || 0, activeSpkItem.qty_order || 1)}%
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs pt-2">
        <div>
          <label className="block font-bold mb-1 opacity-80">Tipe Pengerjaan:</label>
          <select
            value={finishingForm.finishing_type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className={`w-full p-2 rounded-xl font-semibold border ${
              isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-[#F8F6F0] border-[#C5BEAD] text-[#2F3E3B]'
            }`}
          >
            <option value="inhouse">🏠 Inhouse (Internal)</option>
            <option value="sub">🏭 Sub-Finishing (Vendor/Luar)</option>
          </select>
        </div>

        {finishingForm.finishing_type !== 'sub' ? (
          <div>
            <label className="block font-bold mb-1 opacity-80">Jumlah Selesai (pcs):</label>
            <input
              type="number"
              min="0"
              max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
              value={finishingForm.qty_finish}
              onChange={(e) => {
                let val = Number(e.target.value) || 0;
                const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                if (val > maxAllowed) {
                  alert(`❌ Gagal: Jumlah Finishing (${val} pcs) tidak boleh melebihi Qty Print (${maxAllowed} pcs)!`);
                  val = maxAllowed;
                }
                setFinishingForm({ ...finishingForm, qty_finish: val });
              }}
              className={`w-full p-2 rounded-xl font-semibold border ${
                isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
              }`}
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block font-bold mb-1 opacity-80">Nama Vendor / Makloon:</label>
              <input
                type="text"
                placeholder="Misal: CV Poly Mas"
                value={finishingForm.sub_vendor_name}
                onChange={(e) => setFinishingForm({ ...finishingForm, sub_vendor_name: e.target.value })}
                className={`w-full p-2 rounded-xl font-semibold border ${
                  isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                }`}
              />
            </div>

            <div>
              <label className="block font-bold mb-1 opacity-80">1. Kirim Out Vendor (pcs):</label>
              <input
                type="number"
                min="0"
                max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
                value={finishingForm.qty_finish_sub_out}
                onChange={(e) => {
                  let val = Number(e.target.value) || 0;
                  const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                  if (val > maxAllowed) {
                    alert(`❌ Gagal: Jumlah Out ke Vendor (${val} pcs) tidak boleh melebihi Qty Print (${maxAllowed} pcs)!`);
                    val = maxAllowed;
                  }
                  const currentBack = Number(finishingForm.qty_finish) || 0;
                  const adjustedBack = currentBack > val ? val : currentBack;
                  setFinishingForm({ ...finishingForm, qty_finish_sub_out: val, qty_finish: adjustedBack });
                }}
                className={`w-full p-2 rounded-xl font-semibold border ${
                  isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                }`}
              />
            </div>

            <div>
              <label className="block font-bold mb-1 opacity-80">2. Terima Back Vendor (pcs):</label>
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
                    alert(`❌ Jumlah terima back tidak boleh melebihi jumlah yang dikirim ke vendor (${maxBack} pcs)!`);
                    val = maxBack;
                  }
                  setFinishingForm({ ...finishingForm, qty_finish: val });
                }}
                className={`w-full p-2 rounded-xl font-semibold border ${
                  Number(finishingForm.qty_finish_sub_out) <= 0
                    ? 'opacity-50 cursor-not-allowed bg-stone-200 dark:bg-neutral-800'
                    : isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-[#C5BEAD] text-[#2F3E3B]'
                }`}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-all text-white ${
            isDarkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#6B8E85] hover:bg-[#57756D]'
          }`}
        >
          💾 Submit / Simpan Progress Finishing
        </button>
      </div>
    </form>
  );
}