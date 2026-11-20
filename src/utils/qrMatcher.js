import { fetchAllPackingRows } from './packingMeta';

/**
 * Pencocokan kode QR kolian terhadap tabel `packing_tracking`.
 * TIDAK PERNAH melakukan insert/upsert baris baru, sehingga baris Google Sheet
 * tidak pernah terduplikasi atau tertimpa menjadi '-'.
 */
export function extractCleanQrCode(rawInput) {
  if (!rawInput) return { raw: '', clean: '' };
  const raw = String(rawInput).replace(/[\r\n]+/g, '').trim();
  let clean = raw;

  if (raw.includes('scan=')) {
    const paramPart = raw.split('scan=')[1]?.split('&')[0] || '';
    try {
      clean = decodeURIComponent(paramPart).trim();
    } catch {
      clean = paramPart.trim();
    }
  }

  return { raw, clean };
}

function normalizeMatchToken(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function findPackingItemByQr(supabase, rawQrText) {
  const { raw, clean } = extractCleanQrCode(rawQrText);
  if (!clean && !raw) return { item: null, cleanCode: '', matchType: null };

  // Step 1: Pencocokan eksak menggunakan .eq() terpisah (aman dari koma/spasi/kurung pada nama cabang)
  const exactQueries = [];
  if (clean) {
    exactQueries.push({ field: 'tracking_id', value: clean, matchType: 'tracking_id_exact' });
    exactQueries.push({ field: 'qr_address', value: clean, matchType: 'qr_address_clean_exact' });
  }
  if (raw && raw !== clean) {
    exactQueries.push({ field: 'qr_address', value: raw, matchType: 'qr_address_raw_exact' });
  }

  for (const q of exactQueries) {
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('*')
      .eq(q.field, q.value)
      .order('id', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      return { item: data[0], cleanCode: clean || raw, matchType: q.matchType };
    }
  }

  // Step 2: Pencocokan case-insensitive menggunakan .ilike() terpisah
  const ilikeQueries = [];
  if (clean) {
    ilikeQueries.push({ field: 'tracking_id', value: clean, matchType: 'tracking_id_ilike' });
    ilikeQueries.push({ field: 'qr_address', value: clean, matchType: 'qr_address_ilike' });
  }
  if (raw && raw !== clean) {
    ilikeQueries.push({ field: 'qr_address', value: raw, matchType: 'qr_address_raw_ilike' });
  }

  for (const q of ilikeQueries) {
    const { data, error } = await supabase
      .from('packing_tracking')
      .select('*')
      .ilike(q.field, q.value)
      .order('id', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      return { item: data[0], cleanCode: clean || raw, matchType: q.matchType };
    }
  }

  // Step 3: Pencocokan normalisasi di seluruh baris aktif (mendukung QR lama Google Sheet / box / SPK unik)
  const { data: activeRows, error: fetchErr } = await fetchAllPackingRows(supabase, { archived: false });
  if (!fetchErr && Array.isArray(activeRows) && activeRows.length > 0) {
    const targetNorm = normalizeMatchToken(clean || raw);
    const targetLower = (clean || raw).toLowerCase();

    if (targetNorm) {
      const byTrackOrQr = activeRows.find((row) => {
        const tNorm = normalizeMatchToken(row.tracking_id);
        const qNorm = normalizeMatchToken(row.qr_address);
        return (tNorm && tNorm === targetNorm) || (qNorm && qNorm === targetNorm);
      });
      if (byTrackOrQr) {
        return { item: byTrackOrQr, cleanCode: clean || raw, matchType: 'normalized_tracking_or_qr' };
      }

      // Cek kecocokan unik berdasarkan box_code + store_name atau no_spk (hanya jika hanya 1 baris cocok)
      const compositeMatches = activeRows.filter((row) => {
        const compNorm = normalizeMatchToken(`${row.box_code || ''}_${row.store_name || ''}`);
        const boxSpkNorm = normalizeMatchToken(`${row.no_spk || ''}_${row.box_code || ''}`);
        return (compNorm && compNorm === targetNorm) || (boxSpkNorm && boxSpkNorm === targetNorm);
      });
      if (compositeMatches.length === 1) {
        return { item: compositeMatches[0], cleanCode: clean || raw, matchType: 'composite_unique' };
      }

      const spkOrBoxMatches = activeRows.filter((row) => {
        const spkLower = String(row.no_spk || '').trim().toLowerCase();
        const boxLower = String(row.box_code || '').trim().toLowerCase();
        return (spkLower && spkLower === targetLower) || (boxLower && boxLower === targetLower);
      });
      if (spkOrBoxMatches.length === 1) {
        return { item: spkOrBoxMatches[0], cleanCode: clean || raw, matchType: 'spk_or_box_unique' };
      }
    }
  }

  return { item: null, cleanCode: clean || raw, matchType: null };
}
