/* Clinic 13: TB (Standing order TB — สูตรยามาตรฐาน 2IRZE/4IR)
 * Workload row -> tab "TB" (7 columns A-G):
 *   A Date | B HN | C Name/age | D DRPs | E ชนิด drp | F ไม่มาตามนัด | G APP
 * Patient history -> separate Apps Script (TB_Patients_Code.gs), set TB_PATIENTS_URL below.
 */
(function () {
  'use strict';

  // ใส่ URL ของ Web app ที่ deploy จาก TB_Patients_Code.gs (ลงท้ายด้วย /exec)
  const TB_PATIENTS_URL = '';

  function patientsUrl() {
    const override = (typeof window.PMK_TB_PATIENTS_URL === 'string') ? window.PMK_TB_PATIENTS_URL.trim() : '';
    return override || TB_PATIENTS_URL;
  }

  // ขนาดยาตามช่วงน้ำหนัก (mg/day, oral hs)
  const WEIGHT_BANDS = [
    { id: 'lt35', label: '< 35 kg', max: 35, H: 200, R: 300, Z: 750, E: 600 },
    { id: '35_49', label: '35–49 kg', max: 50, H: 300, R: 450, Z: 1000, E: 800 },
    { id: '50_69', label: '50–69 kg', max: 70, H: 300, R: 600, Z: 1500, E: 1000 },
    { id: 'ge70', label: '≥ 70 kg', max: Infinity, H: 300, R: 600, Z: 2000, E: 1200 }
  ];

  const DRUGS = [
    { key: 'H', name: 'Isoniazid (INH)', short: 'INH', lo: 4, hi: 6, inIR: true },
    { key: 'R', name: 'Rifampicin (R)', short: 'R', lo: 8, hi: 12, inIR: true },
    { key: 'Z', name: 'Pyrazinamide (Z)', short: 'Z', lo: 20, hi: 30, inIR: false, renal: true },
    { key: 'E', name: 'Ethambutol (E)', short: 'E', lo: 15, hi: 20, inIR: false, renal: true }
  ];

  const DRP_TYPES = ['Too high', 'Too low', 'ME', 'need', 'NC', 'New case', 'pre-dis', 'un', 'อื่นๆ'];

  const DRP_PRESETS = [
    'Start',
    'ครบ Intensive phase แล้ว ยังได้ IRZE อยู่ ปรึกษาแพทย์ปรับลดเป็น IR',
    'นัดไม่ตรงกับจำนวนยาที่สั่ง',
    'ลืมทานยา',
    'ขาดยา',
    'Inh จัด B6'
  ];

  const PATIENT_FIELDS = [
    // [payload key, element id, fill rule]
    ['age', 'tbAge', 'present'],
    ['sex', 'tbSex', 'present'],
    ['weight', 'tbWeight', 'empty'],
    ['height', 'tbHeight', 'present'],
    ['scr', 'tbScr', 'present'],
    ['dxOther', 'tbDxOther', 'present'],
    ['startDate', 'tbStartDate', 'present'],
    ['qty', 'tbQty', 'present'],
    ['ordH', 'tbOrdH', 'present'],
    ['ordR', 'tbOrdR', 'present'],
    ['ordZ', 'tbOrdZ', 'present'],
    ['ordE', 'tbOrdE', 'present'],
    ['otherRegimen', 'tbOtherRegimen', 'present'],
    ['allergyDetail', 'tbAllergyDetail', 'present']
  ];

  let lastLoadedPatient = null;
  let crclManual = false;

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function val(id) { const el = $(id); return el ? String(el.value || '').trim() : ''; }
  function num(id) {
    const v = parseFloat(val(id).replace(/,/g, ''));
    return Number.isFinite(v) ? v : NaN;
  }
  function isChecked(id) { return !!($(id) && $(id).checked); }
  function radio(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }
  function setRadio(name, value) {
    if (!value) return false;
    const el = document.querySelector(`input[name="${name}"][value="${CSS.escape(String(value))}"]`);
    if (el) { el.checked = true; return true; }
    return false;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }
  function plain(v) { return v == null ? '' : String(v).trim().replace(/^'/, ''); }
  function todayShortBE() {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear() + 543).slice(-2)}`;
  }
  function fmtShortBE(dt) {
    return dt ? `${dt.getDate()}/${dt.getMonth() + 1}/${String(dt.getFullYear() + 543).slice(-2)}` : '';
  }
  // รับ d/m/yy, d/m/yyyy (พ.ศ. หรือ ค.ศ.) หรือ yyyy-mm-dd
  function parseDate(raw) {
    const s = String(raw || '').trim().replace(/^'/, '');
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      let y = +m[1]; if (y > 2400) y -= 543;
      const dt = new Date(y, +m[2] - 1, +m[3]);
      return isNaN(dt) ? null : dt;
    }
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (!m) return null;
    let y = +m[3];
    if (m[3].length === 2) y = y + 2500 - 543; // 69 -> 2569 -> 2026
    else if (y > 2400) y -= 543;
    const dt = new Date(y, +m[2] - 1, +m[1]);
    return isNaN(dt) ? null : dt;
  }
  function daysBetween(a, b) {
    const one = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const two = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((two - one) / 86400000);
  }
  function inputCls() { return 'w-full rounded-lg border-gray-300 border px-3 py-2 text-sm'; }
  function onChangeAttr() { return 'oninput="window.pmkTbRefresh()" onchange="window.pmkTbRefresh()"'; }

  // ---------------------------------------------------------------
  // Clinical calculations
  // ---------------------------------------------------------------
  function getBand(weight) {
    if (!(weight > 0)) return null;
    return WEIGHT_BANDS.find(b => weight < b.max) || WEIGHT_BANDS[WEIGHT_BANDS.length - 1];
  }

  function calcCrcl() {
    const age = num('tbAge');
    const wt = num('tbWeight');
    const scr = num('tbScr');
    const sex = radio('tbSex');
    if (!(age > 0) || !(wt > 0) || !(scr > 0) || !sex) return NaN;
    let c = ((140 - age) * wt) / (72 * scr);
    if (sex === 'F') c *= 0.85;
    return Math.round(c * 10) / 10;
  }

  function getCrcl() {
    const manual = num('tbCrcl');
    if (crclManual && manual > 0) return manual;
    const c = calcCrcl();
    return Number.isFinite(c) ? c : (manual > 0 ? manual : NaN);
  }

  function getRegimen() { return radio('tbRegimen') || 'IRZE'; }

  function activeDrugs() {
    const reg = getRegimen();
    if (reg === 'IR') return DRUGS.filter(d => d.inIR);
    if (reg === 'OTHER') return [];
    return DRUGS.slice();
  }

  function isRenalAdjust() {
    const c = getCrcl();
    return Number.isFinite(c) && c < 30;
  }

  function freqText(drug) {
    return (drug.renal && isRenalAdjust()) ? '3 วัน/สัปดาห์ (จ, พ, ศ) hs' : 'hs';
  }

  // ผลตรวจขนาดยาที่แพทย์สั่งเทียบตารางมาตรฐาน
  function doseChecks() {
    const wt = num('tbWeight');
    const band = getBand(wt);
    return activeDrugs().map(d => {
      const rec = band ? band[d.key] : NaN;
      const ord = num('tbOrd' + d.key);
      const mgkg = (ord > 0 && wt > 0) ? Math.round((ord / wt) * 10) / 10 : NaN;
      let status = 'none';
      if (ord > 0 && rec > 0) status = ord > rec ? 'high' : (ord < rec ? 'low' : 'ok');
      const inRange = Number.isFinite(mgkg) ? (mgkg >= d.lo && mgkg <= d.hi) : null;
      return { drug: d, rec, ord, mgkg, status, inRange };
    });
  }

  function treatmentProgress() {
    const start = parseDate(val('tbStartDate'));
    const visit = parseDate(val('tbVisitDate')) || new Date();
    if (!start) return null;
    const days = daysBetween(start, visit);
    if (days < 0) return { days, weeks: 0, months: 0, label: 'ยังไม่ถึงวันเริ่มยา' };
    const weeks = Math.floor(days / 7);
    const months = Math.round((days / 30.44) * 10) / 10;
    return { days, weeks, months, label: `สัปดาห์ที่ ${weeks + 1} (ประมาณ ${months} เดือน)` };
  }

  function apptCheck() {
    const visit = parseDate(val('tbVisitDate')) || new Date();
    const next = parseDate(val('tbNextAppt'));
    const qty = num('tbQty');
    if (!next || !(qty > 0)) return null;
    const need = daysBetween(visit, next);
    if (need <= 0) return null;
    return { need, qty, short: qty < need, over: qty > need + 7 };
  }

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------
  function render() {
    const root = $('form-TB');
    if (!root || root.dataset.tbMounted) return;
    root.dataset.tbMounted = '1';

    root.innerHTML = `
      <div class="bg-yellow-50 border border-yellow-300 rounded-xl p-4">
        <h3 class="font-bold text-yellow-900 mb-1">13. TB</h3>
        <p class="text-sm text-yellow-800">คำนวณขนาดยาสูตร 2IRZE/4IR ตามน้ำหนัก ตรวจขนาดยาที่แพทย์สั่ง และออกใบ Standing order TB สำหรับแนะนำแพทย์</p>
      </div>

      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
        <h4 class="font-semibold text-gray-800">1) ข้อมูลการมาคลินิก</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">วันที่มาคลินิก</label>
            <input type="text" id="tbVisitDate" class="${inputCls()}" placeholder="เช่น 26/11/69" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">เภสัชกรผู้บันทึก</label>
            <input type="text" id="tbPharmName" list="pharmList" class="${inputCls()}" placeholder="เลือกหรือพิมพ์ชื่อเภสัชกร" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">ประเภทการมา</label>
            <select id="tbVisitType" class="${inputCls()}" ${onChangeAttr()}>
              <option value="Start">Start (เริ่มยาครั้งแรก)</option>
              <option value="Follow-up" selected>Follow-up</option>
              <option value="pre-dis">Pre-discharge</option>
            </select>
          </div>
        </div>
        <div class="rounded-lg border border-yellow-200 bg-yellow-50/60 p-3 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" id="tbBtnLoadPrev" onclick="window.pmkTbLoadPrevious()" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">ดึงข้อมูลเดิม</button>
            <button type="button" id="tbBtnSavePatient" onclick="window.pmkTbSavePatient()" class="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-semibold">บันทึกข้อมูลผู้ป่วย</button>
            <span class="text-xs text-yellow-900">ใส่ HN ด้านบนแล้วกดเพื่อดึงประวัติเดิม หรือบันทึกข้อมูลผู้ป่วยไว้ใช้ครั้งถัดไป (แยกจากการบันทึกงาน)</span>
          </div>
          <p id="tbPrevStatus" class="text-sm text-yellow-900 min-h-[1.25rem]"></p>
          <div id="tbPrevHistory" class="hidden rounded-lg border border-yellow-100 bg-white p-3 text-sm text-gray-800 space-y-1"></div>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
        <h4 class="font-semibold text-gray-800">2) ข้อมูลผู้ป่วยและสัญญาณชีพ</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">อายุ (ปี)</label>
            <input type="number" id="tbAge" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">เพศ</label>
            <div class="flex gap-3 pt-2 text-sm">
              <label class="flex items-center gap-1"><input type="radio" name="tbSex" value="M" ${onChangeAttr()}> ชาย</label>
              <label class="flex items-center gap-1"><input type="radio" name="tbSex" value="F" ${onChangeAttr()}> หญิง</label>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">น้ำหนัก (kg)</label>
            <input type="number" step="0.1" id="tbWeight" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">ส่วนสูง (cm)</label>
            <input type="number" step="0.1" id="tbHeight" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">BP</label>
            <input type="text" id="tbBp" class="${inputCls()}" placeholder="120/80" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">P (/min)</label>
            <input type="number" id="tbPulse" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">RR (/min)</label>
            <input type="number" id="tbRr" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Temp (°C)</label>
            <input type="number" step="0.1" id="tbTemp" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">O2sat (%)</label>
            <input type="number" id="tbO2" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Scr (mg/dL)</label>
            <input type="number" step="0.01" id="tbScr" class="${inputCls()}" ${onChangeAttr()}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">CrCl (mL/min)</label>
            <input type="number" step="0.1" id="tbCrcl" class="${inputCls()}" placeholder="คำนวณอัตโนมัติ" oninput="window.pmkTbOnCrclInput()">
            <p id="tbCrclHint" class="text-[11px] text-gray-400 mt-1">Cockcroft-Gault</p>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">แพ้ยา/อาหาร</label>
            <div class="flex flex-wrap items-center gap-3 text-sm">
              <label class="flex items-center gap-1"><input type="radio" name="tbAllergy" value="N" checked ${onChangeAttr()}> N</label>
              <label class="flex items-center gap-1"><input type="radio" name="tbAllergy" value="Y" ${onChangeAttr()}> Y</label>
              <input type="text" id="tbAllergyDetail" class="flex-1 min-w-[10rem] rounded-lg border-gray-300 border px-3 py-1.5 text-sm" placeholder="ระบุยา/อาหารที่แพ้" ${onChangeAttr()}>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">สูบบุหรี่/ดื่มสุรา</label>
            <div class="flex items-center gap-3 text-sm pt-1.5">
              <label class="flex items-center gap-1"><input type="radio" name="tbSmoke" value="N" checked ${onChangeAttr()}> N</label>
              <label class="flex items-center gap-1"><input type="radio" name="tbSmoke" value="Y" ${onChangeAttr()}> Y</label>
            </div>
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Dx</label>
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <label class="flex items-center gap-1"><input type="radio" name="tbDx" value="PTB" checked ${onChangeAttr()}> PTB</label>
            <label class="flex items-center gap-1"><input type="radio" name="tbDx" value="TBLN" ${onChangeAttr()}> TBLN</label>
            <label class="flex items-center gap-1"><input type="radio" name="tbDx" value="อื่นๆ" ${onChangeAttr()}> อื่นๆ</label>
            <input type="text" id="tbDxOther" class="flex-1 min-w-[10rem] rounded-lg border-gray-300 border px-3 py-1.5 text-sm" placeholder="ระบุ Dx อื่น" ${onChangeAttr()}>
          </div>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
        <h4 class="font-semibold text-gray-800">3) สูตรยาและขนาดยา</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Start ยา (วันที่เริ่มยา)</label>
            <input type="text" id="tbStartDate" class="${inputCls()}" placeholder="เช่น 1/10/69" ${onChangeAttr()}>
            <p id="tbProgress" class="text-[11px] text-gray-500 mt-1"></p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">สูตรยาที่ต้องการสั่ง</label>
            <div class="flex flex-wrap gap-3 pt-2 text-sm">
              <label class="flex items-center gap-1"><input type="radio" name="tbRegimen" value="IRZE" checked ${onChangeAttr()}> IRZE</label>
              <label class="flex items-center gap-1"><input type="radio" name="tbRegimen" value="IR" ${onChangeAttr()}> IR</label>
              <label class="flex items-center gap-1"><input type="radio" name="tbRegimen" value="OTHER" ${onChangeAttr()}> สูตรอื่น</label>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">จำนวนยา (วัน)</label>
            <input type="number" id="tbQty" class="${inputCls()}" placeholder="เช่น 14, 28, 56" ${onChangeAttr()}>
          </div>
        </div>
        <div id="tbBandBanner" class="text-xs bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg px-3 py-2"></div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-sm border border-gray-200 rounded-lg">
            <thead class="bg-gray-50 text-gray-700">
              <tr>
                <th class="text-left px-3 py-2">ยา</th>
                <th class="text-left px-3 py-2">ช่วงขนาด (mg/kg/day)</th>
                <th class="text-left px-3 py-2">ขนาดมาตรฐานตามน้ำหนัก</th>
                <th class="text-left px-3 py-2">แพทย์สั่ง (mg)</th>
                <th class="text-left px-3 py-2">ผลตรวจ</th>
              </tr>
            </thead>
            <tbody>
              ${DRUGS.map(d => `
                <tr id="tbRow${d.key}" class="border-t border-gray-100">
                  <td class="px-3 py-2 font-medium">${esc(d.name)}</td>
                  <td class="px-3 py-2 text-gray-600">${d.lo}–${d.hi}</td>
                  <td class="px-3 py-2" id="tbRec${d.key}">-</td>
                  <td class="px-3 py-2"><input type="number" id="tbOrd${d.key}" class="w-28 rounded-lg border-gray-300 border px-2 py-1 text-sm" ${onChangeAttr()}></td>
                  <td class="px-3 py-2 text-xs" id="tbChk${d.key}">-</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onclick="window.pmkTbUseStandardDoses()" class="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border border-yellow-300 px-3 py-1.5 rounded-lg font-semibold">ใช้ขนาดมาตรฐานตามน้ำหนัก</button>
          <label class="flex items-center gap-1.5"><input type="checkbox" id="tbB6" checked ${onChangeAttr()}> Vitamin B6 (50 mg) 1x1 hs</label>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">สูตรยาอื่นที่แพทย์ต้องการ</label>
          <input type="text" id="tbOtherRegimen" class="${inputCls()}" placeholder="เช่น Levofloxacin 750 mg hs" ${onChangeAttr()}>
        </div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-4">
        <h4 class="font-semibold text-gray-800">4) ปัญหาด้านยา (DRP) และนัดหมาย</h4>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div class="md:col-span-3">
            <label class="block text-xs font-medium text-gray-600 mb-1">DRPs</label>
            <textarea id="tbDrp" rows="2" class="${inputCls()}" placeholder="เช่น ผป หนัก 46 kg แพทย์สั่ง PZA 1500 mg ปรึกษาแพทย์ปรับเป็น 1000 mg" ${onChangeAttr()}></textarea>
            <div class="flex flex-wrap gap-1 mt-1.5">
              <button type="button" onclick="window.pmkTbDrpFromDose()" class="text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">สร้าง DRP จากผลตรวจขนาดยา</button>
              ${DRP_PRESETS.map(p => `<button type="button" data-drp="${esc(p)}" onclick="window.pmkTbPickDrp(this)" class="text-[11px] bg-yellow-50 hover:bg-yellow-100 text-yellow-900 border border-yellow-200 px-2 py-0.5 rounded-full">${esc(p)}</button>`).join('')}
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">ชนิด DRP</label>
            <select id="tbDrpType" class="${inputCls()}" ${onChangeAttr()}>
              <option value="">-</option>
              ${DRP_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">วันนัดครั้งถัดไป</label>
            <input type="text" id="tbNextAppt" class="${inputCls()}" placeholder="เช่น 24/12/69" ${onChangeAttr()}>
            <p id="tbApptHint" class="text-[11px] text-gray-500 mt-1"></p>
          </div>
          <div class="flex items-end pb-2">
            <label class="flex items-center gap-1.5 text-sm"><input type="checkbox" id="tbNoShow" ${onChangeAttr()}> ไม่มาตามนัด</label>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">APP</label>
            <input type="text" id="tbApp" class="${inputCls()}" placeholder="บันทึกเพิ่มเติมเรื่องนัด" ${onChangeAttr()}>
          </div>
        </div>
      </div>

      <div class="rounded-xl border-2 border-yellow-400 bg-yellow-100 p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h4 class="font-bold text-yellow-900">ใบ Standing order TB (แนะนำแพทย์)</h4>
          <div class="flex gap-2">
            <button type="button" id="tbBtnCopyOrder" onclick="window.pmkTbCopyOrder()" class="text-xs bg-white hover:bg-yellow-50 text-yellow-900 border border-yellow-400 font-semibold px-3 py-2 rounded-lg">คัดลอกข้อความ</button>
            <button type="button" id="tbBtnPrintOrder" onclick="window.pmkTbPrintOrder()" class="text-xs bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-3 py-2 rounded-lg">พิมพ์ใบสีเหลือง</button>
          </div>
        </div>
        <pre id="tbOrderPreview" class="whitespace-pre-wrap text-sm text-gray-900 bg-yellow-50 border border-yellow-300 rounded-lg p-3 font-sans"></pre>
      </div>
    `;

    if ($('tbVisitDate') && !$('tbVisitDate').value) $('tbVisitDate').value = todayShortBE();
    bindHnEnter();
    renderDerived();
  }

  function renderDerived() {
    const wt = num('tbWeight');
    const band = getBand(wt);
    const reg = getRegimen();
    const crcl = getCrcl();
    const calc = calcCrcl();

    const crclEl = $('tbCrcl');
    if (crclEl && !crclManual) crclEl.value = Number.isFinite(calc) ? String(calc) : '';
    const crclHint = $('tbCrclHint');
    if (crclHint) {
      if (Number.isFinite(crcl) && crcl < 30) {
        crclHint.textContent = 'CrCl < 30 — Z, E ขนาดเดิม ปรับเป็น 3 วัน/สัปดาห์';
        crclHint.className = 'text-[11px] text-red-600 mt-1 font-semibold';
      } else {
        crclHint.textContent = crclManual ? 'กรอกเอง' : 'Cockcroft-Gault';
        crclHint.className = 'text-[11px] text-gray-400 mt-1';
      }
    }

    const banner = $('tbBandBanner');
    if (banner) {
      if (reg === 'OTHER') banner.textContent = 'สูตรอื่น: ระบุรายการยาในช่องสูตรยาอื่นที่แพทย์ต้องการ';
      else if (band) banner.textContent = `น้ำหนัก ${wt} kg อยู่ในช่วง ${band.label} · สูตร ${reg}${isRenalAdjust() ? ' · CrCl < 30: Z, E ให้ 3 วัน/สัปดาห์ (จ, พ, ศ)' : ''}`;
      else banner.textContent = 'กรอกน้ำหนักเพื่อคำนวณขนาดยามาตรฐาน';
    }

    const checks = doseChecks();
    DRUGS.forEach(d => {
      const row = $('tbRow' + d.key);
      const active = checks.find(c => c.drug.key === d.key);
      if (row) row.classList.toggle('opacity-40', !active);
      const recEl = $('tbRec' + d.key);
      const chkEl = $('tbChk' + d.key);
      if (!active) {
        if (recEl) recEl.textContent = '-';
        if (chkEl) { chkEl.textContent = reg === 'IR' ? 'ไม่ใช้ในสูตร IR' : '-'; chkEl.className = 'px-3 py-2 text-xs text-gray-400'; }
        return;
      }
      if (recEl) recEl.textContent = active.rec > 0 ? `${active.rec} mg ${freqText(d)}` : '-';
      if (chkEl) {
        let txt = '-';
        let cls = 'text-gray-500';
        if (active.status === 'ok') { txt = 'ตรงตามมาตรฐาน'; cls = 'text-emerald-700'; }
        else if (active.status === 'high') { txt = `สูงกว่ามาตรฐาน (แนะนำ ${active.rec} mg)`; cls = 'text-red-600 font-semibold'; }
        else if (active.status === 'low') { txt = `ต่ำกว่ามาตรฐาน (แนะนำ ${active.rec} mg)`; cls = 'text-amber-700 font-semibold'; }
        if (Number.isFinite(active.mgkg)) txt += ` · ${active.mgkg} mg/kg${active.inRange ? '' : ' (นอกช่วง)'}`;
        chkEl.textContent = txt;
        chkEl.className = 'px-3 py-2 text-xs ' + cls;
      }
    });

    const prog = treatmentProgress();
    const progEl = $('tbProgress');
    if (progEl) progEl.textContent = prog ? prog.label : '';

    const appt = apptCheck();
    const apptEl = $('tbApptHint');
    if (apptEl) {
      if (!appt) { apptEl.textContent = ''; apptEl.className = 'text-[11px] text-gray-500 mt-1'; }
      else if (appt.short) { apptEl.textContent = `นัดอีก ${appt.need} วัน แต่สั่งยา ${appt.qty} วัน — ยาไม่ถึงนัด`; apptEl.className = 'text-[11px] text-red-600 mt-1 font-semibold'; }
      else if (appt.over) { apptEl.textContent = `นัดอีก ${appt.need} วัน แต่สั่งยา ${appt.qty} วัน — สั่งยาเกินนัด`; apptEl.className = 'text-[11px] text-amber-700 mt-1 font-semibold'; }
      else { apptEl.textContent = `นัดอีก ${appt.need} วัน ยาพอถึงนัด`; apptEl.className = 'text-[11px] text-emerald-700 mt-1'; }
    }

    const pre = $('tbOrderPreview');
    if (pre) pre.textContent = buildStandingOrderLines().join('\n');
  }

  function refresh() {
    renderDerived();
    if (typeof window.generateOutput === 'function') window.generateOutput();
    if (typeof window.triggerAutoSaveDraft === 'function') window.triggerAutoSaveDraft();
  }

  // ---------------------------------------------------------------
  // Standing order (yellow sheet)
  // ---------------------------------------------------------------
  function dxText() {
    const dx = radio('tbDx') || 'PTB';
    if (dx === 'อื่นๆ') return val('tbDxOther') ? `อื่นๆ: ${val('tbDxOther')}` : 'อื่นๆ';
    return dx;
  }

  function orderedOrStandard(c) {
    return c.rec > 0 ? c.rec : (c.ord > 0 ? c.ord : NaN);
  }

  function buildStandingOrderLines() {
    const lines = ['Standing order TB — สูตรยามาตรฐาน 2IRZE/4IR'];
    const name = val('ptName');
    const hn = val('hn');
    lines.push(`ชื่อ-สกุล: ${name || '-'}   HN: ${hn || '-'}`);
    const prog = treatmentProgress();
    lines.push(`Start ยา: ${val('tbStartDate') || '-'}${prog && prog.days >= 0 ? ` (${prog.label})` : ''}`);
    lines.push(`น้ำหนัก: ${val('tbWeight') || '-'} kg   ส่วนสูง: ${val('tbHeight') || '-'} cm`);
    lines.push(`V/S: BP ${val('tbBp') || '-'}  P ${val('tbPulse') || '-'}  RR ${val('tbRr') || '-'}  Temp ${val('tbTemp') || '-'}  O2sat ${val('tbO2') || '-'}%`);
    const allergy = radio('tbAllergy') === 'Y' ? `Y (${val('tbAllergyDetail') || 'ไม่ระบุ'})` : 'N';
    lines.push(`แพ้ยา/อาหาร: ${allergy}   สูบบุหรี่/ดื่มสุรา: ${radio('tbSmoke') || 'N'}`);
    lines.push(`Dx: ${dxText()}`);
    const crcl = getCrcl();
    if (Number.isFinite(crcl)) lines.push(`CrCl: ${crcl} mL/min${val('tbScr') ? ` (Scr ${val('tbScr')})` : ''}`);

    const reg = getRegimen();
    const qty = val('tbQty');
    if (reg === 'OTHER') {
      lines.push(`สูตรยาที่แนะนำ: สูตรอื่น${qty ? ` จำนวน ${qty} วัน` : ''}`);
    } else {
      lines.push(`สูตรยาที่แนะนำ: ${reg}${qty ? ` จำนวน ${qty} วัน` : ''}`);
      doseChecks().forEach(c => {
        const dose = orderedOrStandard(c);
        lines.push(`  - ${c.drug.name} ${Number.isFinite(dose) ? dose + ' mg' : '... mg'} ${freqText(c.drug)}`);
      });
      if (isRenalAdjust() && reg === 'IRZE') lines.push('  * CrCl < 30 mL/min: Z, E ขนาดเดิม ปรับเป็น 3 วัน/สัปดาห์ (จ, พ, ศ)');
    }
    if (isChecked('tbB6')) lines.push('  - Vitamin B6 (50 mg) 1x1 hs');
    if (val('tbOtherRegimen')) lines.push(`สูตรยาอื่นที่แพทย์ต้องการ: ${val('tbOtherRegimen')}`);
    const pharm = val('tbPharmName');
    if (pharm) lines.push(`เภสัชกร: ${pharm}`);
    return lines;
  }

  function buildOrderPrintHtml() {
    const lines = buildStandingOrderLines();
    const prog = treatmentProgress();
    const reg = getRegimen();
    const checks = doseChecks();
    const bandRows = WEIGHT_BANDS.map(b => {
      const hit = getBand(num('tbWeight')) === b;
      return `<tr${hit ? ' class="hit"' : ''}><td>${esc(b.label)}</td><td>${b.H}</td><td>${b.R}</td><td>${b.Z}</td><td>${b.E}</td></tr>`;
    }).join('');
    const drugRows = reg === 'OTHER' ? '' : checks.map(c => {
      const dose = orderedOrStandard(c);
      return `<li>${esc(c.drug.name)} <b>${Number.isFinite(dose) ? dose + ' mg' : '... mg'}</b> ${esc(freqText(c.drug))}</li>`;
    }).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Standing order TB</title>
<style>
  @page { size: A5; margin: 8mm; }
  body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; font-size: 13px; color: #111; margin: 0; }
  .sheet { background: #fff59d; border: 2px solid #c9a400; border-radius: 6px; padding: 10px 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1 { font-size: 16px; margin: 0 0 2px; text-align: center; }
  h2 { font-size: 13px; margin: 0 0 8px; text-align: center; font-weight: normal; }
  .row { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12px; }
  th, td { border: 1px solid #8a7300; padding: 2px 4px; text-align: center; }
  tr.hit td { background: #ffe082; font-weight: bold; }
  ul { margin: 4px 0 4px 18px; padding: 0; }
  .foot { font-size: 11px; margin-top: 4px; }
</style></head><body><div class="sheet">
  <h1>Standing order TB</h1>
  <h2>สูตรยามาตรฐาน 2IRZE/4IR</h2>
  <div class="row">ชื่อ-สกุล: <b>${esc(val('ptName') || '-')}</b> &nbsp; HN: <b>${esc(val('hn') || '-')}</b></div>
  <div class="row">Start ยา: ${esc(val('tbStartDate') || '-')}${prog && prog.days >= 0 ? ' (' + esc(prog.label) + ')' : ''}</div>
  <div class="row">น้ำหนักผู้ป่วย ${esc(val('tbWeight') || '-')} kg &nbsp; ส่วนสูง ${esc(val('tbHeight') || '-')} cm</div>
  <div class="row">V/S: BP ${esc(val('tbBp') || '-')} P ${esc(val('tbPulse') || '-')} RR ${esc(val('tbRr') || '-')} Temp ${esc(val('tbTemp') || '-')} O2sat ${esc(val('tbO2') || '-')}%</div>
  <div class="row">แพ้ยา/อาหาร: ${radio('tbAllergy') === 'Y' ? 'Y (' + esc(val('tbAllergyDetail') || 'ไม่ระบุ') + ')' : 'N'} &nbsp; สูบบุหรี่/ดื่มสุรา: ${esc(radio('tbSmoke') || 'N')}</div>
  <div class="row">Dx: <b>${esc(dxText())}</b>${Number.isFinite(getCrcl()) ? ' &nbsp; CrCl ' + esc(getCrcl()) + ' mL/min' : ''}</div>
  <table><thead><tr><th>น้ำหนัก</th><th>INH<br>4–6</th><th>R<br>8–12</th><th>Z*<br>20–30</th><th>E*<br>15–20</th></tr></thead><tbody>${bandRows}</tbody></table>
  <div class="foot">ขนาดยา mg/kg/day · ทุกตัว x hs · *กรณี CrCl &lt;30 ml/min ให้ Z, E ขนาดเดิม ปรับเป็น 3 วัน/สัปดาห์ (เช่น จ, พ, ศ)</div>
  <div class="row" style="margin-top:6px">สูตรยาที่แนะนำ: <b>${reg === 'OTHER' ? 'สูตรอื่น' : esc(reg)}</b>${val('tbQty') ? ' จำนวน ' + esc(val('tbQty')) + ' วัน' : ''}</div>
  <ul>${drugRows}${isChecked('tbB6') ? '<li>Vitamin B6 (50 mg) 1x1 hs</li>' : ''}</ul>
  ${val('tbOtherRegimen') ? `<div class="row">สูตรยาอื่นที่แพทย์ต้องการ: ${esc(val('tbOtherRegimen'))}</div>` : ''}
  ${val('tbPharmName') ? `<div class="row" style="text-align:right;margin-top:6px">เภสัชกร ${esc(val('tbPharmName'))}</div>` : ''}
</div><!-- ${esc(lines.length)} --></body></html>`;
  }

  function printOrder() {
    const html = buildOrderPrintHtml();
    let frame = $('tbPrintFrame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'tbPrintFrame';
      frame.setAttribute('aria-hidden', 'true');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
      document.body.appendChild(frame);
    }
    const doc = frame.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { console.error(e); }
    }, 250);
  }

  async function copyOrder() {
    const text = buildStandingOrderLines().join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      if (typeof window.pmkAlert === 'function') window.pmkAlert('คัดลอกใบ Standing order TB แล้ว', { title: 'คัดลอกเรียบร้อย' });
    } catch (e) {
      if (typeof window.pmkAlert === 'function') window.pmkAlert('คัดลอกไม่สำเร็จ กรุณาลองใหม่');
    }
  }

  // ---------------------------------------------------------------
  // PMK note / Workload row / Alerts
  // ---------------------------------------------------------------
  function buildNote() {
    const hasAny = val('tbWeight') || val('tbStartDate') || val('tbDrp') || val('tbPharmName') ||
      ['H', 'R', 'Z', 'E'].some(k => val('tbOrd' + k)) || val('tbScr');
    if (!hasAny) return [];
    const out = ['Pharmacist note (TB clinic)'];
    out.push(`Dx: ${dxText()}${val('tbStartDate') ? ` | Start ยา ${val('tbStartDate')}` : ''}`);
    const prog = treatmentProgress();
    if (prog && prog.days >= 0) out.push(`ระยะการรักษา: ${prog.label}`);
    const vs = [];
    if (val('tbWeight')) vs.push(`BW ${val('tbWeight')} kg`);
    if (val('tbBp')) vs.push(`BP ${val('tbBp')}`);
    if (val('tbPulse')) vs.push(`P ${val('tbPulse')}`);
    if (val('tbRr')) vs.push(`RR ${val('tbRr')}`);
    if (val('tbTemp')) vs.push(`T ${val('tbTemp')}`);
    if (val('tbO2')) vs.push(`O2sat ${val('tbO2')}%`);
    if (vs.length) out.push(vs.join(', '));
    const crcl = getCrcl();
    if (Number.isFinite(crcl)) out.push(`CrCl ${crcl} mL/min${crcl < 30 ? ' (Z, E 3 วัน/สัปดาห์ จ, พ, ศ)' : ''}`);
    const reg = getRegimen();
    if (reg !== 'OTHER') {
      const parts = doseChecks().map(c => `${c.drug.short} ${Number.isFinite(orderedOrStandard(c)) ? orderedOrStandard(c) : '-'}`);
      out.push(`Regimen: ${reg} (${parts.join(', ')}) hs${val('tbQty') ? ` x ${val('tbQty')} วัน` : ''}${isChecked('tbB6') ? ' + B6 50 mg hs' : ''}`);
    } else if (val('tbOtherRegimen')) {
      out.push(`Regimen: ${val('tbOtherRegimen')}`);
    }
    if (radio('tbAllergy') === 'Y') out.push(`แพ้ยา/อาหาร: ${val('tbAllergyDetail') || 'ไม่ระบุ'}`);
    if (val('tbDrp')) out.push(`DRP: ${val('tbDrp')}${val('tbDrpType') ? ` (${val('tbDrpType')})` : ''}`);
    if (val('tbNextAppt')) out.push(`F/U: ${val('tbNextAppt')}`);
    const pharm = val('tbPharmName');
    if (pharm) out.push(`/${/^(ภก\.|ภญ\.)/.test(pharm) ? pharm : 'ภก.' + pharm}`);
    return out;
  }

  function formatDateCell(raw, fallback) {
    const s = String(raw || '').trim();
    if (!s) return fallback || '';
    const dt = parseDate(s);
    return dt ? fmtShortBE(dt) : s;
  }

  function buildRow(defaultDateStr) {
    const date = formatDateCell(val('tbVisitDate'), defaultDateStr || todayShortBE());
    let drp = val('tbDrp');
    const visitType = val('tbVisitType');
    if (!drp && visitType === 'Start') drp = 'Start';
    let drpType = val('tbDrpType');
    if (!drpType && visitType === 'Start' && drp && drp !== 'Start') drpType = 'New case';
    return [
      date,
      val('hn'),
      val('ptName'),
      drp,
      drpType,
      isChecked('tbNoShow') ? '1' : '',
      val('tbApp')
    ];
  }

  function evalAlerts() {
    const alerts = [];
    const src = 'Standing order TB (2IRZE/4IR)';
    doseChecks().forEach(c => {
      if (c.status === 'high') alerts.push({ level: 'danger', title: `${c.drug.short} ${c.ord} mg สูงกว่าขนาดมาตรฐาน`, detail: `น้ำหนัก ${val('tbWeight')} kg แนะนำ ${c.rec} mg ${freqText(c.drug)}`, source: src });
      if (c.status === 'low') alerts.push({ level: 'warning', title: `${c.drug.short} ${c.ord} mg ต่ำกว่าขนาดมาตรฐาน`, detail: `น้ำหนัก ${val('tbWeight')} kg แนะนำ ${c.rec} mg ${freqText(c.drug)}`, source: src });
    });
    if (isRenalAdjust() && getRegimen() === 'IRZE') {
      alerts.push({ level: 'warning', title: `CrCl ${getCrcl()} mL/min (< 30)`, detail: 'Pyrazinamide และ Ethambutol ให้ขนาดเดิม แต่ปรับเป็น 3 วัน/สัปดาห์ (จ, พ, ศ)', source: src });
    }
    if (!isChecked('tbB6') && getRegimen() !== 'OTHER') {
      alerts.push({ level: 'info', title: 'ยังไม่ได้สั่ง Vitamin B6', detail: 'ผู้ป่วยที่ได้ INH ควรได้ Vitamin B6 (50 mg) 1x1 hs ป้องกัน peripheral neuropathy', source: src });
    }
    const prog = treatmentProgress();
    if (prog && prog.days >= 0) {
      if (getRegimen() === 'IRZE' && prog.days > 63) alerts.push({ level: 'warning', title: 'ครบ Intensive phase (2 เดือน) แล้วแต่ยังได้ IRZE', detail: `${prog.label} — พิจารณาปรับลดเป็น IR ตามผล sputum/อาการ`, source: src });
      if (getRegimen() === 'IR' && prog.days < 56) alerts.push({ level: 'info', title: 'ยังอยู่ในช่วง Intensive phase', detail: `${prog.label} — ตรวจสอบว่าควรได้ IRZE ครบ 2 เดือนก่อนลดเป็น IR`, source: src });
      if (prog.days >= 180) alerts.push({ level: 'info', title: 'รักษาครบ 6 เดือนแล้ว', detail: 'ตรวจสอบเกณฑ์หยุดยา/ผลการรักษากับแพทย์', source: src });
    }
    const appt = apptCheck();
    if (appt && appt.short) alerts.push({ level: 'warning', title: 'สั่งยาไม่ถึงวันนัด', detail: `นัดอีก ${appt.need} วัน แต่สั่งยา ${appt.qty} วัน`, source: src });
    if (appt && appt.over) alerts.push({ level: 'info', title: 'สั่งยาเกินวันนัด', detail: `นัดอีก ${appt.need} วัน แต่สั่งยา ${appt.qty} วัน`, source: src });
    if (radio('tbAllergy') === 'Y') alerts.push({ level: 'warning', title: 'ผู้ป่วยมีประวัติแพ้ยา/อาหาร', detail: val('tbAllergyDetail') || 'ไม่ระบุรายละเอียด', source: src });
    return alerts;
  }

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------
  function useStandardDoses() {
    const band = getBand(num('tbWeight'));
    if (!band) {
      if (typeof window.pmkAlert === 'function') window.pmkAlert('กรุณากรอกน้ำหนักผู้ป่วยก่อน');
      return;
    }
    activeDrugs().forEach(d => { const el = $('tbOrd' + d.key); if (el) el.value = band[d.key]; });
    refresh();
  }

  function drpFromDose() {
    const wt = val('tbWeight');
    const bad = doseChecks().filter(c => c.status === 'high' || c.status === 'low');
    if (!bad.length) {
      if (typeof window.pmkAlert === 'function') window.pmkAlert('ขนาดยาที่แพทย์สั่งตรงตามมาตรฐาน หรือยังไม่ได้กรอกขนาดยา');
      return;
    }
    const ordered = bad.map(c => `${c.drug.short} ${c.ord} mg`).join(' ');
    const rec = bad.map(c => `${c.drug.short} ${c.rec} mg`).join(' ');
    const high = bad.every(c => c.status === 'high');
    const low = bad.every(c => c.status === 'low');
    const word = high ? 'สูงกว่าขนาดการรักษา' : (low ? 'ต่ำกว่าขนาดการรักษา' : 'ไม่ตรงขนาดการรักษา');
    const text = `ผป หนัก ${wt} kg แพทย์สั่ง ${ordered} ${word} ปรึกษาแพทย์ปรับเป็น ${rec}`;
    const el = $('tbDrp');
    if (el) el.value = el.value.trim() ? el.value.trim() + ', ' + text : text;
    const type = $('tbDrpType');
    if (type && !type.value) type.value = high ? 'Too high' : (low ? 'Too low' : 'อื่นๆ');
    refresh();
  }

  function pickDrp(btn) {
    const txt = btn.dataset.drp || '';
    const el = $('tbDrp');
    if (!el) return;
    const cur = el.value.trim();
    if (!cur) el.value = txt;
    else if (!cur.includes(txt)) el.value = cur + ', ' + txt;
    if (txt === 'Start' && $('tbVisitType')) $('tbVisitType').value = 'Start';
    refresh();
  }

  // ---------------------------------------------------------------
  // Patient save / load (separate Apps Script)
  // ---------------------------------------------------------------
  function setStatus(msg, kind) {
    const el = $('tbPrevStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'text-sm min-h-[1.25rem] ' + (
      kind === 'error' ? 'text-red-700' : kind === 'ok' ? 'text-emerald-800' : kind === 'info' ? 'text-slate-700' : 'text-yellow-900'
    );
  }

  function alertModal(msg, opts) {
    if (typeof window.pmkAlert === 'function') window.pmkAlert(msg, opts);
  }

  function buildPatientPayload() {
    const crcl = getCrcl();
    return {
      hn: val('hn'),
      name: val('ptName'),
      age: val('tbAge'),
      sex: radio('tbSex'),
      weight: val('tbWeight'),
      height: val('tbHeight'),
      scr: val('tbScr'),
      crcl: Number.isFinite(crcl) ? String(crcl) : '',
      dx: radio('tbDx'),
      dxOther: val('tbDxOther'),
      startDate: val('tbStartDate'),
      regimen: getRegimen(),
      qty: val('tbQty'),
      ordH: val('tbOrdH'),
      ordR: val('tbOrdR'),
      ordZ: val('tbOrdZ'),
      ordE: val('tbOrdE'),
      b6: isChecked('tbB6') ? 'Y' : 'N',
      otherRegimen: val('tbOtherRegimen'),
      allergy: radio('tbAllergy'),
      allergyDetail: val('tbAllergyDetail'),
      smoke: radio('tbSmoke'),
      lastVisit: val('tbVisitDate') || todayShortBE(),
      lastDrp: val('tbDrp'),
      lastDrpType: val('tbDrpType'),
      nextAppt: val('tbNextAppt'),
      bp: val('tbBp'),
      pulse: val('tbPulse'),
      rr: val('tbRr'),
      temp: val('tbTemp'),
      o2: val('tbO2')
    };
  }

  function fillFromPrevious(p) {
    if (!p) return;
    lastLoadedPatient = Object.assign({}, p);
    const nameEl = $('ptName');
    if (nameEl && plain(p.name)) nameEl.value = plain(p.name);
    PATIENT_FIELDS.forEach(([key, id, rule]) => {
      const el = $(id);
      const v = plain(p[key]);
      if (!el || !v) return;
      if (rule === 'empty' && el.value.trim()) return;
      el.value = v;
    });
    setRadio('tbSex', plain(p.sex));
    setRadio('tbDx', plain(p.dx));
    setRadio('tbRegimen', plain(p.regimen));
    setRadio('tbAllergy', plain(p.allergy));
    setRadio('tbSmoke', plain(p.smoke));
    if (plain(p.b6) && $('tbB6')) $('tbB6').checked = plain(p.b6) !== 'N';
    if ($('tbVisitType') && $('tbVisitType').value === 'Start' && plain(p.startDate)) $('tbVisitType').value = 'Follow-up';
    crclManual = false;
    renderHistory(p);
    refresh();
  }

  function renderHistory(p) {
    const box = $('tbPrevHistory');
    if (!box) return;
    const rows = [];
    const updated = plain(p.updatedAt);
    rows.push(`<div class="font-semibold text-yellow-900">พบข้อมูล HN นี้${updated ? ' (อัปเดตล่าสุด: ' + esc(updated) + ')' : ''}</div>`);
    const bits = [];
    if (plain(p.lastVisit)) bits.push('มาครั้งก่อน ' + esc(plain(p.lastVisit)));
    if (plain(p.weight)) bits.push('น้ำหนักครั้งก่อน ' + esc(plain(p.weight)) + ' kg');
    if (plain(p.regimen)) bits.push('สูตร ' + esc(plain(p.regimen)));
    if (plain(p.startDate)) bits.push('Start ยา ' + esc(plain(p.startDate)));
    if (plain(p.crcl)) bits.push('CrCl ' + esc(plain(p.crcl)));
    if (plain(p.nextAppt)) bits.push('นัดครั้งก่อน ' + esc(plain(p.nextAppt)));
    if (bits.length) rows.push(`<div class="text-xs text-slate-600">${bits.join(' · ')}</div>`);
    if (plain(p.lastDrp)) rows.push(`<div class="text-xs"><span class="font-semibold">DRP ครั้งก่อน:</span> ${esc(plain(p.lastDrp))}${plain(p.lastDrpType) ? ' (' + esc(plain(p.lastDrpType)) + ')' : ''}</div>`);
    box.innerHTML = rows.join('');
    box.classList.remove('hidden');
  }

  function clearLookupUi() {
    lastLoadedPatient = null;
    const box = $('tbPrevHistory');
    if (box) { box.innerHTML = ''; box.classList.add('hidden'); }
    setStatus('');
  }

  async function loadPrevious() {
    const hn = val('hn');
    const btn = $('tbBtnLoadPrev');
    if (!hn) { clearLookupUi(); setStatus('กรุณากรอก HN ด้านบนก่อนดึงข้อมูลเดิม', 'error'); return; }
    const url = patientsUrl();
    if (!url) { setStatus('ยังไม่ได้เชื่อมต่อระบบข้อมูลผู้ป่วย TB กรุณาแจ้งผู้ดูแลระบบ', 'error'); return; }
    if (navigator.onLine === false) { setStatus('ตอนนี้ออฟไลน์ ดึงข้อมูลเดิมไม่ได้ กรุณาต่อเน็ตแล้วลองใหม่', 'error'); return; }
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังดึงข้อมูล...'; }
    setStatus('กำลังดึงข้อมูลเดิม...', 'info');
    try {
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'hn=' + encodeURIComponent(hn), { method: 'GET', credentials: 'omit', cache: 'no-store' });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      if (data && data.status === 'found' && data.patient) {
        fillFromPrevious(data.patient);
        setStatus('ดึงข้อมูลเดิมสำเร็จ', 'ok');
      } else if (data && data.status === 'not_found') {
        clearLookupUi();
        setStatus('ไม่พบประวัติของ HN นี้ (ผู้ป่วยใหม่)', 'info');
      } else {
        setStatus((data && data.message) || 'ดึงข้อมูลเดิมไม่สำเร็จ กรุณาลองใหม่', 'error');
      }
    } catch (e) {
      setStatus('ดึงข้อมูลเดิมไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label || 'ดึงข้อมูลเดิม'; }
    }
  }

  async function savePatient() {
    const hn = val('hn');
    const btn = $('tbBtnSavePatient');
    if (!hn) { alertModal('กรุณากรอก HN ก่อนบันทึกข้อมูลผู้ป่วย'); return; }
    const url = patientsUrl();
    if (!url) { alertModal('ยังไม่ได้เชื่อมต่อระบบบันทึกข้อมูลผู้ป่วย TB กรุณาแจ้งผู้ดูแลระบบ'); return; }
    if (navigator.onLine === false) { alertModal('ตอนนี้ออฟไลน์ บันทึกข้อมูลผู้ป่วยไม่ได้ กรุณาต่อเน็ตแล้วลองใหม่'); return; }
    const payload = buildPatientPayload();
    const label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
    setStatus('กำลังบันทึกข้อมูลผู้ป่วย...', 'info');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 20000) : null;
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      });
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      if (data && data.status === 'success') {
        setStatus(data.message || 'บันทึกข้อมูลผู้ป่วยเรียบร้อยแล้ว', 'ok');
        alertModal(data.message || 'บันทึกข้อมูลผู้ป่วยเรียบร้อยแล้ว', { title: 'บันทึกเรียบร้อย' });
      } else {
        const msg = (data && data.message) || 'บันทึกข้อมูลผู้ป่วยไม่สำเร็จ กรุณาลองใหม่';
        setStatus(msg, 'error');
        alertModal(msg);
      }
    } catch (err) {
      const aborted = err && (err.name === 'AbortError');
      const msg = aborted ? 'บันทึกข้อมูลผู้ป่วยใช้เวลานานเกินไป กรุณาลองใหม่' : 'บันทึกข้อมูลผู้ป่วยไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
      setStatus(msg, 'error');
      alertModal(msg);
    } finally {
      if (timer) clearTimeout(timer);
      if (btn) { btn.disabled = false; btn.textContent = label || 'บันทึกข้อมูลผู้ป่วย'; }
    }
  }

  function bindHnEnter() {
    const hnEl = $('hn');
    if (!hnEl || hnEl.dataset.tbLookupBound === '1') return;
    hnEl.dataset.tbLookupBound = '1';
    hnEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (typeof currentTab === 'undefined' || currentTab !== 'TB') return;
      e.preventDefault();
      loadPrevious();
    });
  }

  // ---------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------
  function reset() {
    crclManual = false;
    clearLookupUi();
    if ($('tbVisitDate')) $('tbVisitDate').value = todayShortBE();
    if ($('tbVisitType')) $('tbVisitType').value = 'Follow-up';
    setRadio('tbRegimen', 'IRZE');
    setRadio('tbDx', 'PTB');
    setRadio('tbAllergy', 'N');
    setRadio('tbSmoke', 'N');
    if ($('tbB6')) $('tbB6').checked = true;
    renderDerived();
  }

  function getState() { return { crclManual: !!crclManual }; }
  function setState(st) {
    if (!st || typeof st !== 'object') return;
    crclManual = !!st.crclManual;
    renderDerived();
  }

  window.pmkTbRender = render;
  window.pmkTbRefresh = refresh;
  window.pmkTbReset = reset;
  window.pmkTbBuildNote = buildNote;
  window.pmkTbBuildRow = buildRow;
  window.pmkTbEvalAlerts = evalAlerts;
  window.pmkTbGetState = getState;
  window.pmkTbSetState = setState;
  window.pmkTbPharmName = () => val('tbPharmName');
  window.pmkTbBuildStandingOrder = buildStandingOrderLines;
  window.pmkTbBuildOrderPrintHtml = buildOrderPrintHtml;
  window.pmkTbPrintOrder = printOrder;
  window.pmkTbCopyOrder = copyOrder;
  window.pmkTbUseStandardDoses = useStandardDoses;
  window.pmkTbDrpFromDose = drpFromDose;
  window.pmkTbPickDrp = pickDrp;
  window.pmkTbLoadPrevious = loadPrevious;
  window.pmkTbSavePatient = savePatient;
  window.pmkTbBuildPatientPayload = buildPatientPayload;
  window.pmkTbFillFromPrevious = fillFromPrevious;
  window.pmkTbGetBand = getBand;
  window.pmkTbCalcCrcl = calcCrcl;
  window.pmkTbPatientsUrl = patientsUrl;
  window.pmkTbOnCrclInput = () => { crclManual = !!val('tbCrcl'); refresh(); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
