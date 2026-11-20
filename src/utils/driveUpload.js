/**
 * Utilitas unggah dan normalisasi URL foto bukti ke Google Drive (Pbseventeen@gmail.com)
 * melalui Google Apps Script Web App yang sudah terhubung, dengan fallback aman ke Supabase Storage.
 * Resolusi foto asli bawaan kamera HP dipertahankan 100% (tanpa kompresi/resize).
 */
export const DEFAULT_GDRIVE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwvx6J8im78IZ9hpMHSgDCrNp6UblxDs49uFyu-AokUSdfwT3tVWiJfGHh0nafTupw_/exec';

export function getGdriveScriptUrl() {
  try {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('gdrive_script_url')) || DEFAULT_GDRIVE_SCRIPT_URL;
  } catch {
    return DEFAULT_GDRIVE_SCRIPT_URL;
  }
}

export function extractGoogleDriveFileId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.includes('drive.google.com') && !trimmed.includes('googleusercontent.com')) {
    return null;
  }

  // Cocokkan pola /file/d/<ID> atau /d/<ID>
  const pathMatch = trimmed.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  // Cocokkan pola ?id=<ID> atau &id=<ID>
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  return null;
}

export function getPhotoFullUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const id = extractGoogleDriveFileId(url);
  if (id) {
    return `https://lh3.googleusercontent.com/d/${id}=s0`;
  }
  return url;
}

export function getPhotoThumbUrl(url, width = 240) {
  if (!url || typeof url !== 'string') return url;
  const id = extractGoogleDriveFileId(url);
  if (id) {
    return `https://lh3.googleusercontent.com/d/${id}=w${width}`;
  }
  return url;
}

function readFileAsRawBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = String(e.target?.result || '');
      const commaIdx = res.indexOf(',');
      resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar dari perangkat.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadPhotoToDrive(file, filenamePrefix = 'bukti_paking', timeoutMs = 45000) {
  if (!file) throw new Error('Berkas foto tidak ditemukan.');

  const scriptUrl = getGdriveScriptUrl();
  if (!scriptUrl) throw new Error('URL Google Apps Script belum dikonfigurasi.');

  const cleanPrefix = String(filenamePrefix || 'bukti_paking').replace(/[^a-zA-Z0-9-_]/g, '_');
  const ext = (file.name && file.name.includes('.') ? file.name.split('.').pop() : 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const filename = `${cleanPrefix}_${Date.now()}.${ext}`;

  // Baca berkas asli tanpa kompresi / resize agar resolusi asli HP tetap terjaga
  const base64Data = await readFileAsRawBase64(file);

  const AbortCtrl = typeof window !== 'undefined' && window.AbortController ? window.AbortController : null;
  const controller = AbortCtrl ? new AbortCtrl() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        filename,
        contentType: file.type || 'image/jpeg',
        base64Data,
        folderName: 'Wellen_QC_Packing',
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} saat mengunggah ke Google Drive.`);
    }

    const result = await response.json();
    if (result && result.status === 'success' && result.url) {
      return {
        url: getPhotoFullUrl(result.url),
        rawUrl: result.url,
        storage: 'google_drive',
      };
    }

    throw new Error(result?.message || 'Unggahan Google Drive gagal.');
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    throw err;
  }
}

export async function uploadPhotoWithFallback(file, filenamePrefix, supabase) {
  try {
    return await uploadPhotoToDrive(file, filenamePrefix, 45000);
  } catch (driveErr) {
    console.warn('Google Drive upload gagal/timeout, beralih ke Supabase Storage fallback:', driveErr);
    if (!supabase) throw driveErr;

    const cleanPrefix = String(filenamePrefix || 'bukti_paking').replace(/[^a-zA-Z0-9-_]/g, '_');
    const ext = (file.name && file.name.includes('.') ? file.name.split('.').pop() : 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
    const fileName = `${cleanPrefix}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('surat-jalan')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'image/jpeg',
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
    return {
      url: urlData.publicUrl,
      rawUrl: urlData.publicUrl,
      storage: 'supabase_fallback',
    };
  }
}
