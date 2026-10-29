import { supabase } from '../supabaseClient';
import { getItemMonthKey } from './projectGrouping';

/**
 * Menghapus seluruh data arsip proyek untuk bulan tertentu (monthKey: 'YYYY-MM').
 * Menghapus dari tabel `pmg_projects` dan `packing_tracking` yang tanggalnya berada di bulan tersebut,
 * serta membersihkan cache foto kustom di localStorage.
 */
export async function deleteMonthArchive(monthKey) {
  if (!monthKey || monthKey === 'ALL') {
    return { success: false, error: 'Bulan tidak valid' };
  }

  try {
    // 1. Ambil & Hapus data dari pmg_projects yang berada pada bulan ini
    const { data: pmgData, error: pmgFetchErr } = await supabase
      .from('pmg_projects')
      .select('id, delivery_date, created_at');

    if (pmgFetchErr) console.warn('Fetch pmg err:', pmgFetchErr);

    const pmgIdsToDelete = (pmgData || [])
      .filter(p => getItemMonthKey(p.delivery_date || p.created_at) === monthKey)
      .map(p => p.id);

    if (pmgIdsToDelete.length > 0) {
      const { error: pmgDelErr } = await supabase
        .from('pmg_projects')
        .delete()
        .in('id', pmgIdsToDelete);
      if (pmgDelErr) console.warn('PMG delete err:', pmgDelErr);
    }

    // 2. Ambil & Hapus data dari packing_tracking yang berada pada bulan ini
    const { data: packData, error: packFetchErr } = await supabase
      .from('packing_tracking')
      .select('id, updated_at, delivery_date');

    if (packFetchErr) console.warn('Fetch pack err:', packFetchErr);

    const packIdsToDelete = (packData || [])
      .filter(p => getItemMonthKey(p.delivery_date || p.updated_at) === monthKey)
      .map(p => p.id);

    if (packIdsToDelete.length > 0) {
      const { error: packDelErr } = await supabase
        .from('packing_tracking')
        .delete()
        .in('id', packIdsToDelete);
      if (packDelErr) console.warn('Pack delete err:', packDelErr);
    }

    // 3. Bersihkan foto kustom di localStorage
    try {
      const raw = localStorage.getItem('packing_custom_photos');
      if (raw) {
        const parsed = JSON.parse(raw);
        pmgIdsToDelete.forEach(id => delete parsed[`pmg-${id}`]);
        packIdsToDelete.forEach(id => delete parsed[id]);
        localStorage.setItem('packing_custom_photos', JSON.stringify(parsed));
      }
    } catch (e) {
      console.warn('LocalStorage cleanup warning:', e);
    }

    // 4. Kirim event agar seluruh tampilan (DualSidebar, CloseProjectView) memperbarui data realtime
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('app_archive_data_changed'));
    }

    return {
      success: true,
      deletedCount: pmgIdsToDelete.length + packIdsToDelete.length
    };
  } catch (err) {
    console.error('Delete month archive err:', err);
    return { success: false, error: err.message };
  }
}
