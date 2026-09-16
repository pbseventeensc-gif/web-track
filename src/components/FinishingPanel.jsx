import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Wrench, Trash2, Save, RotateCcw, Check, AlertCircle } from 'lucide-react';

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
        alert(`❌ Failed: Outgoing quantity to vendor (${outQty} pcs) cannot exceed Print Qty (${maxFinishingAllowed} pcs)!`);
        return;
      }
      if (outQty === 0 && backQty > 0) {
        alert(`❌ Failed: Items have not been sent to vendor (Out = 0 pcs). Cannot enter Received Back quantity!`);
        return;
      }
      if (backQty > outQty) {
        alert(`❌ Failed: Received back quantity (${backQty} pcs) exceeds quantity sent to vendor (${outQty} pcs)!`);
        return;
      }
    } else {
      if (backQty > maxFinishingAllowed) {
        alert(`❌ Failed: Completed Finishing Quantity (${backQty} pcs) cannot exceed Print Qty (${maxFinishingAllowed} pcs)!`);
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
      alert('Failed to save finishing data: ' + error.message);
    } else {
      alert(`✅ Finishing data for SPK ${activeItem.no_spk} (${activeItem.client}) saved successfully! Total Completed: ${backQty} pcs.`);
      if (fetchSpkData) fetchSpkData();
    }
  };

  // TOMBOL HAPUS SPK YANG TERPILIH
  const handleDeleteSelectedSpk = async () => {
    if (!activeSpkItem) return;
    if (window.confirm(`⚠️ Are you sure you want to delete SPK "${activeSpkItem.no_spk}" (${activeSpkItem.client}) from the Finishing list?`)) {
      const { error } = await supabase.from('spk_data').delete().eq('id', activeSpkItem.id);
      if (!error) {
        alert(`✅ SPK "${activeSpkItem.no_spk}" deleted successfully!`);
        if (fetchSpkData) fetchSpkData();
        setSelectedSpkId('');
      } else {
        alert('Failed to delete SPK: ' + error.message);
      }
    }
  };

  // TOMBOL HAPUS SEMUA DATA SPK DI FINISHING
  const handleDeleteAllSpkData = async () => {
    if (window.confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY DELETE ALL ${spkList.length} SPK items from the Finishing panel list?`)) {
      const { error } = await supabase.from('spk_data').delete().gt('id', 0);
      if (!error) {
        alert('✅ All SPK data in Finishing list has been permanently deleted!');
        if (fetchSpkData) fetchSpkData();
        setSelectedSpkId('');
      } else {
        alert('Failed to delete all SPK data: ' + error.message);
      }
    }
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));

  const activeSpkItem = spkList.find((item) => String(item.id) === String(selectedSpkId)) || spkList[0];
  const hasSpkData = Boolean(spkList && spkList.length > 0 && activeSpkItem);

  return (
    <form
      onSubmit={handleSubmitFinishing}
      className="p-6 rounded-3xl border border-slate-200 bg-white text-black shadow-2xs transition-colors space-y-5 max-h-[80vh] overflow-y-auto relative custom-scrollbar"
    >
      {/* HEADER MENU ALWAYS VISIBLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <Wrench className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-indigo-600">Finishing Control Panel</h3>
            <p className="text-xs text-slate-500 font-medium">Manage Inhouse & Sub-Contract Finishing (Vendor Processing)</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <label className="text-xs font-extrabold text-black">Select SPK:</label>
          <select
            value={selectedSpkId}
            onChange={(e) => handleSelectSpk(e.target.value)}
            disabled={!hasSpkData}
            className="text-xs px-3 py-2 rounded-xl font-extrabold border border-slate-300 bg-white text-black focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer shadow-2xs max-w-[280px] truncate disabled:opacity-50"
          >
            {hasSpkData ? (
              spkList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.no_spk} - {item.client} ({item.project})
                </option>
              ))
            ) : (
              <option value="">No SPK Data Available</option>
            )}
          </select>

          {/* TOMBOL HAPUS SPK ACTIVE */}
          {hasSpkData && (
            <button
              type="button"
              onClick={handleDeleteSelectedSpk}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-extrabold rounded-xl text-xs transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Delete currently selected SPK from Finishing list"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Delete Active SPK
            </button>
          )}

          {/* TOMBOL HAPUS SEMUA SPK */}
          {hasSpkData && (
            <button
              type="button"
              onClick={handleDeleteAllSpkData}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-2xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
              title="Delete ALL SPK data from Finishing list"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete All SPKs
            </button>
          )}
        </div>
      </div>

      {!hasSpkData ? (
        <div className="p-12 text-center text-slate-400 border border-dashed border-slate-300 rounded-2xl space-y-2 bg-slate-50/50 my-4">
          <Wrench className="w-10 h-10 mx-auto opacity-40 text-slate-400" />
          <p className="font-extrabold text-sm text-slate-700">No SPK Data Available in Finishing Panel</p>
          <p className="text-xs text-slate-400 font-medium">Please import SPK data or create orders to display finishing controls.</p>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 ${finishingForm.finishing_type === 'sub' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 text-xs`}>
        <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
          <div className="text-slate-500 font-bold text-[10px] uppercase">Order Quantity</div>
          <div className="text-base font-extrabold text-slate-900 mt-0.5">{activeSpkItem.qty_order?.toLocaleString()} Pcs</div>
        </div>

        <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50">
          <div className="text-amber-800 font-bold text-[10px] uppercase">
            {finishingForm.finishing_type === 'sub' ? 'Remaining (Not Sent Out)' : 'Remaining (Incomplete)'}
          </div>
          <div className="text-base font-extrabold text-amber-900 mt-0.5">
            {finishingForm.finishing_type === 'sub'
              ? Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish_sub_out) || 0)).toLocaleString()
              : Math.max(0, (activeSpkItem.qty_order || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()}{' '}
            Pcs
          </div>
        </div>

        {finishingForm.finishing_type === 'sub' ? (
          <>
            <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50">
              <div className="text-blue-800 font-bold text-[10px] uppercase">Sent to Vendor (Out)</div>
              <div className="text-base font-extrabold text-blue-900 mt-0.5">
                {(Number(finishingForm.qty_finish_sub_out) || 0).toLocaleString()} Pcs
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="text-emerald-800 font-bold text-[10px] uppercase">Received Back (In)</div>
              <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                {(Number(finishingForm.qty_finish) || 0).toLocaleString()} Pcs
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50">
              <div className="text-amber-800 font-bold text-[10px] uppercase">Pending Vendor Return</div>
              <div className="text-base font-extrabold text-amber-900 mt-0.5">
                {Math.max(0, (Number(finishingForm.qty_finish_sub_out) || 0) - (Number(finishingForm.qty_finish) || 0)).toLocaleString()} Pcs
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50">
              <div className="text-emerald-800 font-bold text-[10px] uppercase">Inhouse Completed</div>
              <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                {(Number(finishingForm.qty_finish) || 0).toLocaleString()} Pcs
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
              <div className="text-slate-500 font-bold text-[10px] uppercase">Finishing Progress</div>
              <div className="text-base font-extrabold text-slate-900 mt-0.5">
                {getPercent(Number(finishingForm.qty_finish) || 0, activeSpkItem.qty_order || 1)}%
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs pt-2">
        <div>
          <label className="block font-extrabold mb-1.5 text-black">Finishing Work Type:</label>
          <select
            value={finishingForm.finishing_type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full p-2.5 rounded-xl font-extrabold border border-slate-300 bg-white text-black focus:outline-none cursor-pointer"
          >
            <option value="inhouse">Inhouse (Internal)</option>
            <option value="sub">Sub-Finishing (Vendor/External)</option>
          </select>
        </div>

        {finishingForm.finishing_type !== 'sub' ? (
          <div>
            <label className="block font-extrabold mb-1.5 text-black">Completed Quantity (pcs):</label>
            <input
              type="number"
              min="0"
              max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
              value={finishingForm.qty_finish}
              onChange={(e) => {
                let val = Number(e.target.value) || 0;
                const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                if (val > maxAllowed) {
                  alert(`❌ Failed: Finishing quantity (${val} pcs) cannot exceed Print Qty (${maxAllowed} pcs)!`);
                  val = maxAllowed;
                }
                setFinishingForm({ ...finishingForm, qty_finish: val });
              }}
              className="w-full p-2.5 rounded-xl font-extrabold border border-slate-300 bg-white text-black focus:outline-none"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block font-extrabold mb-1.5 text-black">Vendor / Sub-Contractor Name:</label>
              <input
                type="text"
                placeholder="Example: CV Poly Mas"
                value={finishingForm.sub_vendor_name}
                onChange={(e) => setFinishingForm({ ...finishingForm, sub_vendor_name: e.target.value })}
                className="w-full p-2.5 rounded-xl font-extrabold border border-slate-300 bg-white text-black focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-extrabold mb-1.5 text-black">1. Quantity Sent Out (pcs):</label>
              <input
                type="number"
                min="0"
                max={activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order}
                value={finishingForm.qty_finish_sub_out}
                onChange={(e) => {
                  let val = Number(e.target.value) || 0;
                  const maxAllowed = Number(activeSpkItem.qty_print > 0 ? activeSpkItem.qty_print : activeSpkItem.qty_order || 0);
                  if (val > maxAllowed) {
                    alert(`❌ Failed: Outgoing quantity to vendor (${val} pcs) cannot exceed Print Qty (${maxAllowed} pcs)!`);
                    val = maxAllowed;
                  }
                  const currentBack = Number(finishingForm.qty_finish) || 0;
                  const adjustedBack = currentBack > val ? val : currentBack;
                  setFinishingForm({ ...finishingForm, qty_finish_sub_out: val, qty_finish: adjustedBack });
                }}
                className="w-full p-2.5 rounded-xl font-extrabold border border-slate-300 bg-white text-black focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-extrabold mb-1.5 text-black">2. Quantity Received Back (pcs):</label>
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
                    alert(`❌ Received back quantity cannot exceed quantity sent to vendor (${maxBack} pcs)!`);
                    val = maxBack;
                  }
                  setFinishingForm({ ...finishingForm, qty_finish: val });
                }}
                className={`w-full p-2.5 rounded-xl font-extrabold border ${
                  Number(finishingForm.qty_finish_sub_out) <= 0
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-300'
                    : 'bg-white border-slate-300 text-black'
                }`}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-2xs active:scale-95 transition-all text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer flex items-center gap-1.5"
        >
          <Save className="w-4 h-4" /> Save Finishing Progress
        </button>
      </div>
        </>
      )}
    </form>
  );
}