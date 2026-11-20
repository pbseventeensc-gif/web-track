/**
 * Utilitas status QC Packing, Checker, metadata petugas + timestamp,
 * status arsip (status_deliver === 'DONE'), dan pagination query ke tabel `packing_tracking`.
 */

export function hasValidPhoto(item) {
  return Boolean(
    item?.bukti_paking_url &&
    item.bukti_paking_url !== 'No Foto' &&
    item.bukti_paking_url !== '-' &&
    String(item.bukti_paking_url).trim().length > 5
  );
}

export function isPackingDone(item) {
  return item?.status_qc_packing === 'DONE' || hasValidPhoto(item);
}

export function isCheckerDone(item) {
  return item?.status_qc_checker === 'DONE';
}

export function isReadyToArchive(item) {
  return hasValidPhoto(item) && isPackingDone(item) && isCheckerDone(item);
}

export function isArchivedItem(item) {
  return item?.status_deliver === 'DONE';
}

export function getPackingMeta(item) {
  let parsed = null;
  const rawOutboundStaff = item?.staff_outbound;

  if (typeof rawOutboundStaff === 'string' && rawOutboundStaff.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(rawOutboundStaff);
    } catch {
      parsed = null;
    }
  }

  let name = item?.packing_by || item?.foto_by || item?.scanned_by || parsed?.packing_by || null;
  if (!name && typeof rawOutboundStaff === 'string') {
    const trimmed = rawOutboundStaff.trim();
    if (trimmed && trimmed !== 'Petugas Pengiriman' && !trimmed.startsWith('{')) {
      name = trimmed;
    }
  }

  const timestamp =
    item?.packing_at ||
    item?.foto_at ||
    parsed?.packing_at ||
    item?.updated_at ||
    null;

  return {
    name: name || null,
    timestamp,
  };
}

export function getCheckerMeta(item) {
  return {
    name: item?.checker_by || null,
    timestamp: item?.checker_at || item?.updated_at || null,
  };
}

export async function updatePackingWithMeta(
  supabase,
  rowId,
  { buktiPakingUrl, staffName, status = 'DONE', nowIso = new Date().toISOString() }
) {
  const cleanName = String(staffName || '').trim() || 'Petugas Paking';
  const payload = {
    status_qc_packing: status,
    staff_outbound: JSON.stringify({ packing_by: cleanName, packing_at: nowIso }),
    updated_at: nowIso,
  };

  if (buktiPakingUrl !== undefined) {
    payload.bukti_paking_url = buktiPakingUrl;
  }

  const { error } = await supabase
    .from('packing_tracking')
    .update(payload)
    .eq('id', rowId);

  return { error, payload };
}

export async function fetchAllPackingRows(supabase, { archived = null, select = '*', maxRows = 5000 } = {}) {
  const PAGE_SIZE = 1000;
  let allRows = [];

  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    let query = supabase
      .from('packing_tracking')
      .select(select)
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (archived === false) {
      query = query.or('status_deliver.is.null,status_deliver.neq.DONE');
    } else if (archived === true) {
      query = query.eq('status_deliver', 'DONE');
    }

    const { data, error } = await query;
    if (error) {
      return { data: allRows.length > 0 ? allRows : null, error };
    }

    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
  }

  return { data: allRows, error: null };
}
