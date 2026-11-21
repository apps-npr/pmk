// ******************************************************
// 1. ตั้งค่า LINE OA
var CHANNEL_ACCESS_TOKEN = 'C0RgLRu9DfA9mrTpxE8+vzl6wgg6TNxaIUXBroI3bcKhLJOwawbKTvoQozKAKsnWUrWfPXGJsHG1BYY00aXDjuZogAho1irFxrjLWDQaqod9ey0WkRCoowQIQe/beTVUGT6BXLwkpy2USbrv0+LosQdB04t89/1O/w1cDnyilFU=';
var GROUP_ID = 'C951aace2f9d3c67c5a3c614127f8ccef';

// 2. ตั้งค่า Google Sheet (ระบบหลัก - โปรเจกต์เก่า)
var MAIN_SHEET_ID = "1D0oDI3ZYCV2x3z0FA_PpcJzcwNfuFMku1x4q_-iKTfo";

// 3. ตั้งค่า Google Sheet (ระบบสติกเกอร์ ที่แยกไว้)
var STICKER_SHEET_ID = '1roClr1kSVqS3lVs983pzlzMg8krSscCiabsSdOefEls';
var STICKER_SHEET_NAME = 'Sheet1';

// 4. ตั้งค่า Google Sheet (ระบบ Pharmacist Note ใหม่)
// **ข้อสำคัญ: ให้ใส่ ID ของ Sheet ปลายทางที่ต้องการบันทึก OPD Note ตรงนี้**
// ถ้าเป็นไฟล์เดียวกับ MAIN_SHEET_ID ก็ใช้ตัวเดียวกันได้เลย
var OPD_SHEET_ID = "1D0oDI3ZYCV2x3z0FA_PpcJzcwNfuFMku1x4q_-iKTfo"; 
// ******************************************************

// ========================================================
// ส่วนที่ 1: รับส่งข้อมูลหลัก (doPost & doGet) + CACHE SYSTEM
// ========================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (!e || !e.postData) return ContentService.createTextOutput("OK");
    var data = JSON.parse(e.postData.contents);

    // กรณี 1: จาก LINE Webhook (โปรเจกต์เก่า)
    if (data.events && data.events.length > 0) {
      handleLineMessage(data.events[0]);
      return ContentService.createTextOutput("OK");
    }

    // กรณี 2: รับข้อมูลจากหน้า Web App ใหม่ (Pharmacist Note OPD Online)
    if (data.action === "saveOPDNote") {
      return saveOPDNoteToSheet(data);
    }

    // กรณี 3: รับข้อมูลจากหน้า Web App เก่า (อนุมัติ / ยกเลิก / กรอกเอง ของ Warfarin)
    var action = data.action;
    if (!action && data.hn) action = "manual";

    var result;
    if (action === "approve" || action === "manual") {
      result = processWarfarin(data);
    } else if (action === "reject") {
      result = rejectPending(data.id);
    }

    // สั่งล้าง Cache ทันทีที่มีการแก้ไขข้อมูลผ่านหน้าเว็บ
    CacheService.getScriptCache().remove("PENDING_LIST");

    return result || ContentService.createTextOutput("OK");
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({'result': 'error', 'error': err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var cache = CacheService.getScriptCache();
    if (e && e.parameter && e.parameter.action === "forceRefreshCache") {
      cache.remove("PENDING_LIST");
      var freshData = fetchPendingDataFromSheet();
      return ContentService.createTextOutput(JSON.stringify({result: 'success', data: freshData})).setMimeType(ContentService.MimeType.JSON);
    }
    if (e && e.parameter && e.parameter.warfarin) {
      const wf = String(e.parameter.warfarin).trim();
      const rec = getRecordByWarfarinNo(wf);
      return ContentService.createTextOutput(JSON.stringify(rec || {})).setMimeType(ContentService.MimeType.JSON);
    }
    if (e && e.parameter && e.parameter.action === "getPending") {
      var cachedPending = cache.get("PENDING_LIST");
      if (cachedPending) return ContentService.createTextOutput(cachedPending).setMimeType(ContentService.MimeType.JSON);
      var pendingList = fetchPendingDataFromSheet();
      return ContentService.createTextOutput(JSON.stringify(pendingList)).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput("System Ready");
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function fetchPendingDataFromSheet() {
  var sheet = SpreadsheetApp.openById(MAIN_SHEET_ID).getSheetByName("Pending");
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  var data = sheet.getRange(1, 1, lastRow, 7).getValues();
  var pendingList = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] !== "") {
      pendingList.push({ id: data[i][0], hn: data[i][1], sex: data[i][2], name: data[i][3], age: data[i][4], indication: data[i][5], goal: data[i][6] });
    }
  }
  CacheService.getScriptCache().put("PENDING_LIST", JSON.stringify(pendingList), 3600);
  return pendingList;
}

function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, '').replace(/[_\-]+/g, ''); }
function headerKeyOf(h) {
  const n = norm(h);
  if (['fullname','ชือ-สกล','ชอ-สกล','ชื่อ-สกุล','name','patientname'].includes(n)) return 'fullName';
  if (['hn'].includes(n)) return 'hn';
  if (['warfarinno','warfarin','warfarinnumber','warfarinno.','wfno','warfarin_no','warfarin no'].includes(n)) return 'warfarinNo';
  if (['indication','ขอบงใช','ข้อบ่งใช้'].includes(n)) return 'indication';
  if (['inr', 'goalinr', 'goal'].includes(n)) return 'inr';
  return null;
}

function getRecordByWarfarinNo(wfNo) {
  if (!wfNo) return null;
  var searchNo = String(wfNo).trim();
  try {
    var ssMain = SpreadsheetApp.openById(MAIN_SHEET_ID);
    var shMain = ssMain.getSheetByName("Warfarin NO");
    if (shMain) {
      var mainValues = shMain.getDataRange().getValues();
      for (var i = mainValues.length - 1; i >= 1; i--) {
        var row = mainValues[i];
        if (String(row[1]).trim() === searchNo) { 
          return { fullName: String(row[4] || ''), hn: String(row[2] || '').replace("'", ""), warfarinNo: String(row[1] || ''), indication: String(row[7] || ''), inr: String(row[9] || '') };
        }
      }
    }
  } catch (e) { console.log("Main Sheet search error: " + e); }

  try {
    var ssStk = SpreadsheetApp.openById(STICKER_SHEET_ID);
    var shStk = ssStk.getSheetByName(STICKER_SHEET_NAME);
    if (shStk) {
      var stkValues = shStk.getDataRange().getValues();
      if (stkValues.length >= 2) {
        var head = stkValues[0];
        var idx = {};
        head.forEach((h, i) => { var key = headerKeyOf(h); if (key && idx[key] === undefined) idx[key] = i; });
        var colWf = idx['warfarinNo'];
        if (colWf !== undefined) {
          for (var r = stkValues.length - 1; r >= 1; r--) {
            var row = stkValues[r];
            if (String(row[colWf]).trim() === searchNo) {
              return {
                fullName: idx.fullName !== undefined ? String(row[idx.fullName] || '') : '',
                hn: idx.hn !== undefined ? String(row[idx.hn] || '').replace("'", "") : '',
                warfarinNo: String(row[colWf] || ''),
                indication: idx.indication !== undefined ? String(row[idx.indication] || '') : '',
                inr: idx.inr !== undefined ? String(row[idx.inr] || '') : ''
              };
            }
          }
        }
      }
    }
  } catch (e) { console.log("Sticker Sheet search error: " + e); }
  return null;
}

function handleLineMessage(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  var msg = event.message.text;
  if (msg.toLowerCase().indexOf("ขอ warfarin no") === -1 && msg.indexOf("ขอ Warfarin no") === -1) return;
  var sheet = SpreadsheetApp.openById(MAIN_SHEET_ID).getSheetByName("Pending");
  if (!sheet) return;
  var blocks = msg.split(/HN/i);
  var addedCount = 0;
  for (var i = 1; i < blocks.length; i++) {
    var text = blocks[i];
    var hnMatch = text.match(/\d{4,6}\/\d{2,4}/);
    if (!hnMatch) continue; 
    var hn = hnMatch[0];
    var ageMatch = text.match(/อายุ\s*(\d+)/);
    var age = ageMatch ? ageMatch[1] : "";
    var sex = "1";
    var name = "";
    var titleMatch = text.match(/(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*([ก-๙a-zA-Z\s]+)/);
    if (titleMatch) {
      var title = titleMatch[1];
      if (title.indexOf("นาง") !== -1 || title.indexOf("ญ") !== -1 || title.indexOf("น.ส.") !== -1) sex = "2";
      name = (title + titleMatch[2]).split(/อายุ|\n|Indication/i)[0].trim();
    }
    var indication = "";
    var goal = "2.0-3.0";
    var indTextMatch = text.match(/Indication\s*[:=]?\s*([a-zA-Z0-9\/\-\s]+)/i);
    if (indTextMatch && indTextMatch[1]) {
       indication = indTextMatch[1].split(/\r?\n/)[0].trim().toUpperCase();
       if (indication.indexOf("ขอบ") !== -1) { indication = indication.split(/ขอบ/)[0].trim(); }
    } else {
       var fallbackMatch = text.match(/(AF|DVT|PE|MVR|AVR|S\/P\s*MVR|S\/P\s*AVR|APS)/i);
       if (fallbackMatch) indication = fallbackMatch[0].toUpperCase();
    }
    if (indication.indexOf("MVR") !== -1) goal = "2.5-3.5";
    var id = new Date().getTime().toString() + i;
    sheet.appendRow([id, hn, sex, name, age, indication, goal]);
    addedCount++;
  }
  if(addedCount > 0) CacheService.getScriptCache().remove("PENDING_LIST");
}

function processWarfarin(data) {
  var ss = SpreadsheetApp.openById(MAIN_SHEET_ID);
  var mainSheet = ss.getSheetByName("Warfarin NO");
  var pendingSheet = ss.getSheetByName("Pending");
  if (data.action === "approve" && data.id && pendingSheet) {
    var pData = pendingSheet.getDataRange().getValues();
    for (var i = pData.length - 1; i >= 0; i--) {
      if (pData[i][0].toString() === data.id.toString()) { pendingSheet.deleteRow(i + 1); break; }
    }
  }
  var lastRowInSheet = mainSheet.getLastRow();
  if (lastRowInSheet < 1) lastRowInSheet = 1;
  var columnB = mainSheet.getRange(1, 2, lastRowInSheet, 1).getValues();
  var realLastRowIndex = -1;
  var lastWarfarinId = null;
  for (var i = columnB.length - 1; i >= 0; i--) {
    if (columnB[i][0] !== "" && columnB[i][0] != null) { realLastRowIndex = i; lastWarfarinId = columnB[i][0]; break; }
  }
  var nextId = (typeof lastWarfarinId === 'number') ? lastWarfarinId + 1 : 4290;
  var targetRow = realLastRowIndex + 2;
  var inputIndication = data.indication ? data.indication.toString().trim() : "";
  var upperInd = inputIndication.toUpperCase();
  var dxCode = 4;
  if (upperInd === 'AF') dxCode = 2;
  else if (upperInd === 'DVT' || upperInd === 'PE') dxCode = 1;
  else if (upperInd === 'MVR' || upperInd === 'S/P MVR') dxCode = 3;
  else if (upperInd === 'AVR' || upperInd === 'S/P AVR') dxCode = 4;
  var inputGoal = data.goal ? data.goal.toString().trim() : "";
  var goalCode = (inputGoal === '2.0-3.0') ? 1 : (inputGoal === '2.5-3.5' ? 2 : 3);
  var timestamp = new Date();
  var rowData = [[ timestamp, nextId, "'" + data.hn, data.sex, data.name, data.age, dxCode, inputIndication, goalCode, inputGoal ]];
  mainSheet.getRange(targetRow, 1, 1, 10).setValues(rowData);
  var message = "💊Warfarin\nNo " + nextId + "\nHN " + data.hn;
  sendLinePushMessage(message);
  return ContentService.createTextOutput(JSON.stringify({'result': 'success', 'warfarinId': nextId})).setMimeType(ContentService.MimeType.JSON);
}

function rejectPending(id) {
  var sheet = SpreadsheetApp.openById(MAIN_SHEET_ID).getSheetByName("Pending");
  if (!sheet) return ContentService.createTextOutput(JSON.stringify({'result': 'error'})).setMimeType(ContentService.MimeType.JSON);
  var pData = sheet.getDataRange().getValues();
  for (var i = pData.length - 1; i >= 0; i--) {
    if (pData[i][0].toString() === id.toString()) { sheet.deleteRow(i + 1); return ContentService.createTextOutput(JSON.stringify({'result': 'success'})).setMimeType(ContentService.MimeType.JSON); }
  }
  return ContentService.createTextOutput(JSON.stringify({'result': 'error'})).setMimeType(ContentService.MimeType.JSON);
}

function sendLinePushMessage(msg) {
  if (CHANNEL_ACCESS_TOKEN.includes('ใส่_Channel') || GROUP_ID.includes('ใส่_Group')) return;
  try {
    UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", { "method": "post", "headers": { "Content-Type": "application/json", "Authorization": "Bearer " + CHANNEL_ACCESS_TOKEN }, "payload": JSON.stringify({ "to": GROUP_ID, "messages": [{ "type": "text", "text": msg }] }) });
  } catch (e) { console.log("LINE Error: " + e.toString()); }
}


// ========================================================
// ส่วนที่ 4: ฟังก์ชันสำหรับโปรเจกต์ใหม่ (Pharmacist Note OPD)
// ========================================================
function saveOPDNoteToSheet(data) {
  try {
    var ss = SpreadsheetApp.openById(OPD_SHEET_ID);
    var clinic = data.clinic;
    var targetSheetName = "NCD"; // Default

    // กำหนดชื่อชีทปลายทางตามชื่อคลินิก
    if (clinic === "HIV") {
        targetSheetName = "HIV";
    } else if (clinic === "HF clinic") {
        targetSheetName = "HF clinic";
    } else if (clinic === "CKD") {
        targetSheetName = "CKD";
    } else if (clinic === "Asthma COPD") {
        targetSheetName = "Asthma COPD";
    } else if (clinic === "MR" || clinic === "ADR" || clinic === "PREOP") {
        targetSheetName = "NCD"; 
    } else if (clinic === "WARFARIN") {
        targetSheetName = "Warfarin";
    } else if (clinic === "Parkinson New" || clinic === "PARKINSON") {
        targetSheetName = "Parkinson New";
    } else if (clinic === "CAPD") {
        targetSheetName = "CAPD";
    }

    var sheet = ss.getSheetByName(targetSheetName);

    // ป้องกันการบันทึกไม่ได้ถ้าหาชีทไม่เจอ
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        "result": "error", 
        "error": "ไม่พบ Sheet ชื่อ " + targetSheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var rowData = data.payload;

    // สำหรับคลินิก MR, ADR, PREOP, HIV ต้องเพิ่ม Timestamp เข้าไปคอลัมน์แรกก่อนเซฟ
    if (clinic === "MR" || clinic === "ADR" || clinic === "PREOP" || clinic === "HIV") {
      var row = [new Date()];
      row = row.concat(rowData);
      sheet.appendRow(row);
    } else if (clinic === "CAPD") {
      // แท็บ CAPD เป็นบล็อกรายเดือนซ้อนกัน ต้องเขียนลงแถวว่างแถวแรกของบล็อกล่าสุด ไม่ใช้ appendRow
      writeCapdRowToLatestBlock_(sheet, rowData);
    } else {
      // สำหรับ CKD, Asthma COPD, HF clinic และ Parkinson New ฝั่งเว็บไซต์ได้จัดเตรียมข้อมูลมาครบถ้วนแล้ว (รวมถึงวันที่)
      sheet.appendRow(rowData);
    }

    return ContentService.createTextOutput(JSON.stringify({"result": "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "result": "error", 
      "error": error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// หาแถวที่ควรเขียนในแท็บ CAPD ซึ่งเป็นบล็อกรายเดือนซ้อนกัน ไม่ใช้ appendRow ตรง ๆ
// เพราะ appendRow จะไปตกหลังเลข Program ที่เว้นไว้ (หรือหลังแถวสรุป mean/sd)
function findCapdInsertPosition_(values) {
  function cell(r, i) {
    if (!r || r[i] === undefined || r[i] === null || r[i] === '') return '';
    if (Object.prototype.toString.call(r[i]) === '[object Date]') return 'DATE';
    return String(r[i]).trim();
  }
  function isHeaderRow(r) {
    var a = cell(r, 0).toLowerCase();
    var b = cell(r, 1).toLowerCase();
    var c = cell(r, 2).toLowerCase();
    if (b === 'date' && c === 'hn') return true;
    if (a === 'program' && b === 'date') return true;
    if (a.indexOf('capd-ruby.vercel.app') !== -1 && b === 'date') return true;
    return false;
  }
  function isSummaryRow(r) {
    var a = cell(r, 0).toLowerCase();
    return a === 'mean' || a === 'sd' || a.indexOf('เกินเกณฑ์') !== -1 ||
      a === 'สรุป' || a === 'จำนวน' || a === 'ร้อยละ' ||
      a.indexOf('ค่าเฉลี่ย') !== -1 || a.indexOf('mean') === 0;
  }
  function isEmptyDataRow(r) {
    if (!r) return true;
    if (Object.prototype.toString.call(r[1]) === '[object Date]') return false;
    return !cell(r, 1) && !cell(r, 2) && !cell(r, 3);
  }
  function programNum(r) {
    var n = parseInt(cell(r, 0), 10);
    return isNaN(n) ? 0 : n;
  }

  if (!values || !values.length) return { mode: 'append', program: 1 };

  var lastHeader = -1;
  var i;
  for (i = 0; i < values.length; i++) {
    if (isHeaderRow(values[i])) lastHeader = i;
  }
  if (lastHeader === -1) return { mode: 'append', program: 1 };

  var start = lastHeader + 1;
  var end = values.length;
  for (i = start; i < values.length; i++) {
    if (isHeaderRow(values[i]) || isSummaryRow(values[i])) {
      end = i;
      break;
    }
  }

  var lastProgram = 0;
  var firstEmpty = -1;
  for (i = start; i < end; i++) {
    var n = programNum(values[i]);
    if (n > lastProgram) lastProgram = n;
    if (isEmptyDataRow(values[i]) && firstEmpty === -1) firstEmpty = i;
  }

  if (firstEmpty !== -1) {
    var existing = cell(values[firstEmpty], 0);
    var keep = !!(existing && !isNaN(parseInt(existing, 10)));
    return {
      mode: 'write',
      rowIndex0: firstEmpty,
      program: keep ? existing : String(lastProgram + 1),
      keepProgram: keep
    };
  }

  return {
    mode: 'insert',
    rowIndex0: end,
    program: String(lastProgram + 1)
  };
}

function writeCapdRowToLatestBlock_(sheet, rowData) {
  var COLS = 32;
  var out = [];
  var c;
  for (c = 0; c < COLS; c++) {
    out.push((rowData && rowData[c] !== undefined && rowData[c] !== null) ? rowData[c] : '');
  }

  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastCol = Math.max(sheet.getLastColumn(), COLS);
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var pos = findCapdInsertPosition_(values);

  if (pos.mode === 'write') {
    if (pos.keepProgram || !String(out[0]).trim()) {
      out[0] = pos.program;
    }
    sheet.getRange(pos.rowIndex0 + 1, 1, 1, COLS).setValues([out]);
    return pos;
  }

  if (!String(out[0]).trim()) out[0] = pos.program;

  if (pos.mode === 'insert') {
    var insertAt = pos.rowIndex0 + 1; // 1-based row number to occupy
    if (insertAt <= sheet.getMaxRows() && insertAt <= lastRow + 1) {
      // แทรกก่อนแถวสรุป (หรือต่อท้ายบล็อก) แล้วเขียนข้อมูลลงแถวใหม่
      if (insertAt <= lastRow) {
        sheet.insertRowBefore(insertAt);
      }
      sheet.getRange(insertAt, 1, 1, COLS).setValues([out]);
    } else {
      sheet.appendRow(out);
    }
    return pos;
  }

  sheet.appendRow(out);
  return pos;
}

