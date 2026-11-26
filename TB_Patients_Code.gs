// ข้อมูลผู้ป่วยคลินิก 13 TB (บันทึก/ดึงข้อมูลเดิมตาม HN หรือ TB No) — แยกจาก workload
const SHEET_NAME = 'Patients';

// [หัวคอลัมน์, คีย์ใน payload, เก็บเป็นข้อความ]
// TBNo อยู่คอลัมน์ B ถัดจาก HN (ชีทใหม่ ยังไม่ได้วางสคริปต์เดิม)
const TB_COLUMNS = [
  ['HN', 'hn', true],
  ['TBNo', 'tbno', true],
  ['PatientName', 'name', false],
  ['UpdatedAt', null, false],
  ['Age', 'age', false],
  ['Sex', 'sex', false],
  ['WeightKg', 'weight', false],
  ['HeightCm', 'height', false],
  ['Scr', 'scr', false],
  ['CrCl', 'crcl', false],
  ['Dx', 'dx', false],
  ['DxOther', 'dxOther', false],
  ['StartDate', 'startDate', true],
  ['Regimen', 'regimen', false],
  ['QtyDays', 'qty', false],
  ['INH_mg', 'ordH', false],
  ['RIF_mg', 'ordR', false],
  ['PZA_mg', 'ordZ', false],
  ['EMB_mg', 'ordE', false],
  ['B6', 'b6', false],
  ['OtherRegimen', 'otherRegimen', false],
  ['Allergy', 'allergy', false],
  ['AllergyDetail', 'allergyDetail', false],
  ['SmokeAlcohol', 'smoke', false],
  ['LastVisit', 'lastVisit', true],
  ['LastDRP', 'lastDrp', false],
  ['LastDRPType', 'lastDrpType', false],
  ['NextAppt', 'nextAppt', true],
  ['BP', 'bp', true],
  ['Pulse', 'pulse', false],
  ['RR', 'rr', false],
  ['Temp', 'temp', false],
  ['O2sat', 'o2', false]
];

function colIndex(key) {
  for (let i = 0; i < TB_COLUMNS.length; i++) {
    if (TB_COLUMNS[i][1] === key) return i;
  }
  return -1;
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  const headers = TB_COLUMNS.map(function (c) { return c[0]; });
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(headers);
    return sheet;
  }

  let lastCol = Math.max(sheet.getLastColumn(), 1);
  let existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const hasTbno = existing.some(function (h) { return cleanText(h).toLowerCase() === 'tbno'; });
  // ชีทเก่าที่คอลัมน์ B เป็น PatientName: แทรกคอลัมน์ TBNo โดยไม่สลับข้อมูลเดิม
  if (!hasTbno && cleanText(existing[1]) === 'PatientName') {
    sheet.insertColumns(2, 1);
    lastCol = Math.max(sheet.getLastColumn(), 1);
    existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  }

  const next = [];
  let changed = false;
  for (let i = 0; i < headers.length; i++) {
    const cur = existing[i] != null ? String(existing[i]).trim() : '';
    if (cur) next.push(existing[i]);
    else { next.push(headers[i]); changed = true; }
  }
  if (changed) sheet.getRange(1, 1, 1, next.length).setValues([next]);
  return sheet;
}

function cleanText(v) {
  return v == null ? '' : String(v).replace(/^'/, '').trim();
}

function asText(v) {
  const s = cleanText(v);
  return s ? "'" + s : '';
}

function normKey(v) {
  return cleanText(v).toLowerCase();
}

function findRowByCol(data, col, value) {
  const needle = normKey(value);
  if (!needle) return -1;
  for (let i = 1; i < data.length; i++) {
    if (normKey(data[i][col]) === needle) return i;
  }
  return -1;
}

function doGet(e) {
  const sheet = setupSheet();
  const param = (e && e.parameter) ? e.parameter : {};
  const hn = param.hn ? String(param.hn).trim() : '';
  const tbno = param.tbno ? String(param.tbno).trim() : '';
  const data = sheet.getDataRange().getValues();
  const tbnoCol = colIndex('tbno');

  if (hn) {
    const idx = findRowByCol(data, 0, hn);
    if (idx > 0) return jsonResponse({ status: 'found', patient: rowToObj(data[idx]) });
    return jsonResponse({ status: 'not_found' });
  }
  if (tbno) {
    const idx = findRowByCol(data, tbnoCol, tbno);
    if (idx > 0) return jsonResponse({ status: 'found', patient: rowToObj(data[idx]) });
    return jsonResponse({ status: 'not_found' });
  }

  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] || data[i][tbnoCol]) {
      list.push({
        hn: cleanText(data[i][0]),
        tbno: cleanText(data[i][tbnoCol]),
        name: String(data[i][colIndex('name')] || ''),
        updatedAt: formatCell(data[i][colIndex(null)])
      });
    }
  }
  return jsonResponse({ status: 'ok', list: list });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = setupSheet();
    const payload = JSON.parse(e.postData.contents);
    const hn = cleanText(payload.hn);
    const tbno = cleanText(payload.tbno);
    if (!hn && !tbno) return jsonResponse({ status: 'error', message: 'กรุณากรอก HN หรือ TB No' });

    const data = sheet.getDataRange().getValues();
    const tbnoCol = colIndex('tbno');
    let idx = -1;
    if (hn) idx = findRowByCol(data, 0, hn);
    else idx = findRowByCol(data, tbnoCol, tbno);
    const existing = idx > 0 ? data[idx] : [];

    const row = TB_COLUMNS.map(function (col, i) {
      const key = col[1];
      if (col[0] === 'UpdatedAt') return new Date().toLocaleString('th-TH');
      if (key === 'hn') return asText(hn || (existing[i] != null ? existing[i] : ''));
      if (key === 'tbno') return asText(tbno || (existing[i] != null ? existing[i] : ''));
      const has = Object.prototype.hasOwnProperty.call(payload, key);
      if (!has) return existing[i] != null ? existing[i] : '';
      return col[2] ? asText(payload[key]) : (payload[key] == null ? '' : String(payload[key]));
    });

    if (idx > 0) sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return jsonResponse({ status: 'success', message: 'บันทึกข้อมูลสำเร็จ' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function formatCell(val) {
  if (val === null || val === undefined || val === '') return '';
  if (val instanceof Date) {
    const t = new Date(val.getTime() + 7 * 60 * 60 * 1000);
    return t.getUTCDate() + '/' + (t.getUTCMonth() + 1) + '/' + String(t.getUTCFullYear() + 543).slice(-2);
  }
  return cleanText(val);
}

function rowToObj(row) {
  const obj = {};
  TB_COLUMNS.forEach(function (col, i) {
    const key = col[1] || 'updatedAt';
    obj[key] = formatCell(row[i]);
  });
  return obj;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
