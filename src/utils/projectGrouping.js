/**
 * Utilitas normalisasi dan pengelompokan nama proyek terpadu.
 * Menggabungkan berbagai variasi penamaan batch, cabang, PO, nomor, dan format case
 * ke dalam nama proyek induk / brand level yang konsisten dan rapi.
 */
export const extractBaseProjectName = (raw) => {
  if (!raw) return '';
  let str = String(raw).trim();
  if (/^tes(\s*\d+)?$/i.test(str) || /^test(\s*\d+)?$/i.test(str)) return '';

  // 1. Bersihkan prefix nomor PO, tanggal, atau deretan angka panjang di awal
  str = str.replace(/^(NO\.?\s*)?PO\b\s*[:\-]?\s*[\d\w&]+\s+/i, '');
  str = str.replace(/^\d{7,}\s+/, '');
  str = str.replace(/^NO\s*PO\b\s*[:\-]?\s*\d+\s*/i, '');
  str = str.replace(/^\d+\s+/, '');

  // 2. Koreksi kesalahan pengetikan umum
  str = str.replace(/^CCCEP\b/i, 'CCEP');
  str = str.replace(/^OCA COLA\b/i, 'COCA COLA');

  // 3. Hapus isi tanda kurung (seperti ( BATCH 44 ), ( MIC ), ( GT ), dll)
  str = str.replace(/\s*\([^)]*\)\s*/g, ' ');
  str = str.replace(/\s+/g, ' ').trim();

  // 4. Hapus suffix Batch, Part, atau tahun di akhir nama
  str = str.replace(/\s*[\-\–]\s*PART\s*\d+/i, '');
  str = str.replace(/\s*[\-\–]\s*BATCH\s*\d+/i, '');
  str = str.replace(/\s*BATCH\s*\d+/i, '');
  str = str.replace(/\s*[\-\–]\s*\d{4}(\s*[\-\–]\s*\d{4})?/g, '');
  str = str.replace(/\b202[4-9](\s*[\-\–]\s*202[4-9])?\b/g, '');

  // 5. Normalisasi dash & spasi
  str = str.replace(/\s*[\–—]\s*/g, ' - ');
  str = str.replace(/\s*-\s*/g, ' - ');
  str = str.replace(/\s+/g, ' ').trim();
  str = str.replace(/\s*-\s*$/, '');

  const upper = str.toUpperCase();

  // 6. Aturan Pengelompokan Khusus untuk Proyek Berulang / Multivariasi:
  // CCEP
  if (/^CCEP\s*-\s*KARTU\s*NAMA/i.test(upper)) return 'CCEP - KARTU NAMA';
  if (/^CCEP\s*-\s*CERTIFIKAT/i.test(upper)) return 'CCEP - CERTIFIKAT SCHOLARSHIP';
  if (/^CCEP\s*-\s*GMP/i.test(upper)) return 'CCEP - GMP CERTIFICATE';
  if (/^CCEP\s*-\s*NAME\s*DESK/i.test(upper)) return 'CCEP - NAME DESK';
  if (/^CCEP\s*-\s*POSTCARD/i.test(upper)) return 'CCEP - POSTCARDS WFA';

  // COCA COLA
  if (/^COCA\s*COLA\s*-\s*MARVIS/i.test(upper) || /^MARVIS\s*COCA\s*COLA/i.test(upper)) return 'COCA COLA - MARVIS';
  if (/^COCA\s*COLA\s*-\s*BANNER/i.test(upper)) return 'COCA COLA - BANNER';
  if (/^COCA\s*COLA\s*-\s*HYPERCARE/i.test(upper)) return 'COCA COLA - HYPERCARE POSM';
  if (/^COCA\s*COLA\s*-\s*CUSTOM MENU/i.test(upper)) return 'COCA COLA - CUSTOM MENU';
  if (/^COCA\s*COLA(\s*LAUNCHING)?$/i.test(upper)) return 'COCA COLA';

  // DANCOW
  if (/COLORING.*DANCOW/i.test(upper) || /DANCOW.*COLORING/i.test(upper)) return 'COLORING DANCOW';
  if (/^POSM\s*DANCOW/i.test(upper) || /^PROOF\s*SHOPBLIND\s*POSM\s*DANCOW/i.test(upper)) return 'POSM DANCOW';

  // BRAND LAIN
  if (/BEAR\s*BRAND/i.test(upper)) return 'BEAR BRAND';
  if (/MILO/i.test(upper)) return 'MILO';
  if (/WYETH/i.test(upper)) return 'WYETH GOLD S-26';
  if (/POWERADE/i.test(upper)) return 'POWERADE';

  // 7. Jika terdapat tanda hubung bertingkat (misal: "BRAND - PROJEK - CABANG"), ambil 2 segmen utama
  const parts = str.split(/\s*-\s*/);
  if (parts.length >= 3) {
    return `${parts[0]} - ${parts[1]}`;
  }

  return str;
};

/**
 * Mengelompokkan proyek ke dalam Kategori Induk / Brand / Klien utama.
 * Memastikan sidebar tetap ringkas (~10 kategori) dan tidak memanjang ke bawah.
 */
export const getProjectCategory = (rawName) => {
  if (!rawName) return 'PROJECT LAINNYA';
  const upper = String(rawName).toUpperCase();
  if (/COCA|MARVIS|FANTA/i.test(upper)) return 'COCA COLA';
  if (/CCEP|CCCEP/i.test(upper)) return 'CCEP';
  if (/DANCOW/i.test(upper)) return 'DANCOW';
  if (/BEAR\s*BRAND/i.test(upper)) return 'BEAR BRAND';
  if (/MILO/i.test(upper)) return 'MILO';
  if (/WYETH|S-26/i.test(upper)) return 'WYETH NUTRITION';
  if (/POWERADE/i.test(upper)) return 'POWERADE';
  if (/PROOF/i.test(upper)) return 'PROOF & SAMPLE';
  if (/BANNER|ADES/i.test(upper)) return 'BANNER & DISPLAY';
  if (/STICKER|GANTUNGAN|MERCHANDISE|SPINWHEEL/i.test(upper)) return 'STICKER & MERCHANDISE';
  return 'PROJECT LAINNYA';
};

export const CATEGORY_COLORS = {
  'COCA COLA': 'bg-rose-500',
  'CCEP': 'bg-blue-500',
  'DANCOW': 'bg-amber-500',
  'BEAR BRAND': 'bg-sky-500',
  'MILO': 'bg-emerald-600',
  'WYETH NUTRITION': 'bg-yellow-600',
  'POWERADE': 'bg-cyan-500',
  'BANNER & DISPLAY': 'bg-indigo-500',
  'PROOF & SAMPLE': 'bg-purple-500',
  'STICKER & MERCHANDISE': 'bg-teal-500',
  'PROJECT LAINNYA': 'bg-slate-400'
};

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const getItemMonthKey = (dateStr) => {
  if (!dateStr) return '0000-00';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '0000-00';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const getItemMonthLabel = (monthKey, lang) => {
  const currentLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('app_language') : 'id') || 'id';
  if (!monthKey || monthKey === '0000-00') return currentLang === 'en' ? 'Other Period' : 'Periode Lainnya';
  const parts = String(monthKey).split('-');
  if (parts.length < 2) return monthKey;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthList = currentLang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_ID;
  const monthName = monthList[monthIdx] || parts[1];
  return `${monthName} ${year}`;
};

