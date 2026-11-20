import ExcelJS from 'exceljs';
import { getPhotoFullUrl } from './driveUpload';
import {
  hasValidPhoto,
  isPackingDone,
  isCheckerDone,
  isArchivedItem,
  getPackingMeta,
  getCheckerMeta,
} from './packingMeta';

function formatIdTimestamp(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return '-';
  }
}

export async function buildStyledPackingWorkbook({
  items = [],
  reportTitle = 'LAPORAN MONITORING PACKING STATION',
  filterLabel = 'Semua Proyek',
  sheetName = 'Laporan_QC',
  isArchive = false,
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Wellen Print Web-Track';
  workbook.created = new Date();

  const safeSheetName = String(sheetName || 'Laporan_QC').replace(/[*?:\\/\[\]]/g, '_').slice(0, 31);
  const ws = workbook.addWorksheet(safeSheetName, {
    views: [{ state: 'frozen', ySplit: 6 }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.35, right: 0.35, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  const colCount = 13;
  const colWidths = [6, 15, 18, 28, 32, 14, 9, 13, 24, 14, 24, 20, 14];
  ws.columns = colWidths.map((width) => ({ width }));

  const photoCount = items.filter((item) => hasValidPhoto(item)).length;
  const packingCount = items.filter((item) => isPackingDone(item)).length;
  const checkerCount = items.filter((item) => isCheckerDone(item)).length;
  const printedAt = formatIdTimestamp(new Date().toISOString());

  // KOP PERUSAHAAN (Rows 1 - 4)
  ws.mergeCells(1, 1, 1, colCount);
  const row1 = ws.getRow(1);
  row1.height = 30;
  const c1 = ws.getCell(1, 1);
  c1.value = 'WELLEN PRINT — QUALITY CONTROL & PACKING REPORT';
  c1.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  c1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  c1.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells(2, 1, 2, colCount);
  const row2 = ws.getRow(2);
  row2.height = 18;
  const c2 = ws.getCell(2, 1);
  c2.value =
    'Jl. Raya Pasar Minggu No. 49 RT.002 RW.007 Duren Tiga, Jakarta Selatan  |  Telp: 021-5506999  |  Email: order@wellenprint.com';
  c2.font = { name: 'Calibri', size: 9, color: { argb: 'FFDBEAFE' } };
  c2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  c2.alignment = { vertical: 'middle', horizontal: 'center' };

  ws.mergeCells(3, 1, 3, colCount);
  const row3 = ws.getRow(3);
  row3.height = 24;
  const c3 = ws.getCell(3, 1);
  c3.value = String(reportTitle || 'LAPORAN MONITORING PACKING STATION').toUpperCase();
  c3.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E3A8A' } };
  c3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  c3.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let col = 1; col <= colCount; col++) {
    ws.getCell(3, col).border = {
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
    };
  }

  ws.mergeCells(4, 1, 4, colCount);
  const row4 = ws.getRow(4);
  row4.height = 20;
  const c4 = ws.getCell(4, 1);
  c4.value = `Filter / Periode: ${filterLabel || 'Semua Data'}   |   Total Kolian: ${items.length}   |   Foto Bukti: ${photoCount}/${items.length}   |   Checker OK: ${checkerCount}/${items.length}   |   Tanggal Cetak: ${printedAt}`;
  c4.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF334155' } };
  c4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
  c4.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  ws.getRow(5).height = 8;

  // HEADER TABEL BERWARNA (Row 6)
  const headers = [
    'No',
    'Kode Kolian',
    'Nomor SPK',
    'Proyek / Promo',
    'Customer / Cabang',
    'Wilayah',
    'Qty',
    'QC Paking',
    'Petugas & Waktu Paking',
    'QC Checker',
    'Petugas & Waktu Checker',
    'Bukti Foto Paking',
    'Status',
  ];

  const headerRow = ws.getRow(6);
  headerRow.height = 26;
  headers.forEach((hText, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = hText;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF93C5FD' } },
      left: { style: 'thin', color: { argb: 'FF93C5FD' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FF93C5FD' } },
    };
  });

  ws.autoFilter = {
    from: { row: 6, column: 1 },
    to: { row: 6, column: colCount },
  };

  let totalQtySum = 0;

  // DATA ROWS (Row 7+)
  items.forEach((item, index) => {
    const rowIdx = 7 + index;
    const row = ws.getRow(rowIdx);
    const isEven = index % 2 === 1;
    const zebraFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' } };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };

    const packingDone = isPackingDone(item);
    const checkerDone = isCheckerDone(item);
    const photoValid = hasValidPhoto(item);
    const archived = isArchive || isArchivedItem(item);
    const pMeta = getPackingMeta(item);
    const cMeta = getCheckerMeta(item);
    const qtyNum = Number(item.total_qty) || 0;
    totalQtySum += qtyNum;

    const pMetaText = packingDone
      ? `${pMeta.name || 'Petugas Paking'} (${formatIdTimestamp(pMeta.timestamp)})`
      : '-';
    const cMetaText = checkerDone
      ? `${cMeta.name || 'Staff Checker'} (${formatIdTimestamp(cMeta.timestamp)})`
      : '-';

    const rowValues = [
      index + 1,
      item.box_code || '-',
      item.no_spk || '-',
      item.promo_title || '-',
      item.store_name || '-',
      item.delivery_type || 'DALAM KOTA',
      qtyNum,
      packingDone ? 'SELESAI' : 'MENUNGGU',
      pMetaText,
      checkerDone ? 'TERVERIFIKASI' : 'MENUNGGU',
      cMetaText,
      photoValid ? 'Lihat Foto Asli' : '-',
      archived ? 'ARSIP' : 'AKTIF',
    ];

    rowValues.forEach((val, cIdx) => {
      const colNum = cIdx + 1;
      const cell = row.getCell(colNum);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      cell.fill = zebraFill;
      cell.border = thinBorder;

      if (colNum === 1 || colNum === 2 || colNum === 6 || colNum === 7 || colNum === 8 || colNum === 10 || colNum === 12 || colNum === 13) {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      if (colNum === 7) {
        cell.numFmt = '#,##0';
      }

      // Badge QC Paking
      if (colNum === 8) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: packingDone ? 'FFDCFCE7' : 'FFFEF3C7' } };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: packingDone ? 'FF166534' : 'FF92400E' } };
      }

      // Badge QC Checker
      if (colNum === 10) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: checkerDone ? 'FFDCFCE7' : 'FFFEF3C7' } };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: checkerDone ? 'FF166534' : 'FF92400E' } };
      }

      // Hyperlink Foto Bukti
      if (colNum === 12 && photoValid) {
        const fullPhotoUrl = getPhotoFullUrl(item.bukti_paking_url);
        cell.value = {
          text: 'Lihat Foto Asli',
          hyperlink: fullPhotoUrl,
          tooltip: 'Klik untuk membuka foto resolusi asli',
        };
        cell.font = { name: 'Calibri', size: 10, bold: true, underline: true, color: { argb: 'FF1D4ED8' } };
      }

      // Badge Status Arsip/Aktif
      if (colNum === 13) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: archived ? 'FFDCFCE7' : 'FFDBEAFE' } };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: archived ? 'FF166534' : 'FF1E40AF' } };
      }
    });

    row.height = 22;
  });

  // SUMMARY FOOTER ROW
  const footerRowIdx = 7 + items.length;
  const footerRow = ws.getRow(footerRowIdx);
  footerRow.height = 24;
  const footerValues = [
    '',
    'TOTAL',
    `${items.length} Kolian`,
    '',
    '',
    '',
    totalQtySum,
    `${packingCount}/${items.length}`,
    '',
    `${checkerCount}/${items.length}`,
    '',
    `${photoCount}/${items.length} Foto`,
    isArchive ? 'ARSIP' : 'AKTIF',
  ];

  footerValues.forEach((val, cIdx) => {
    const colNum = cIdx + 1;
    const cell = footerRow.getCell(colNum);
    cell.value = val;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNum === 2 || colNum === 3 || colNum >= 7 ? 'center' : 'left',
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
    if (colNum === 7) cell.numFmt = '#,##0';
  });

  return workbook;
}

export async function exportStyledPackingExcel({
  items = [],
  reportTitle = 'LAPORAN MONITORING PACKING STATION',
  filterLabel = 'Semua Proyek',
  fileName = 'Laporan_Paking.xlsx',
  sheetName = 'Laporan_QC',
  isArchive = false,
}) {
  const workbook = await buildStyledPackingWorkbook({
    items,
    reportTitle,
    filterLabel,
    sheetName,
    isArchive,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return fileName;
}
