/* Clinic 12: Open Heart (MR + Pre-op Hold Plan)
 * Saves to Google Sheet tab "Open heart" (12 columns A-L):
 *   A Column 1 (HN) | B ชื่อ-นามสกุล | C U/D | D หัตถการ | E พบเภสัช (checkbox) |
 *   F วันที่พบเภสัช | G วันนัดนอนรพ. | H วันผ่าตัด | I รายละเอียด | J เภสัชแนะนำ | K DRP | L cancel case (empty)
 */
(function () {
  'use strict';

  const SURGERY_TYPES = [
    {
      id: 'cabg',
      label: 'CABG',
      short: 'CABG',
      desc: 'Aspirin ให้ยาต่อจนถึงวัน OR · Clopidogrel หยุด 5 วันก่อน OR · Warfarin หยุด 7 วันตามค่า INR'
    },
    {
      id: 'valve',
      label: 'Valve replacement',
      short: 'Valve replacement',
      desc: 'Aspirin, Clopidogrel, Warfarin หยุด 5–7 วันก่อน OR'
    },
    {
      id: 'cabg_valve',
      label: 'CABG + Valve replacement',
      short: 'CABG + Valve',
      desc: 'ใช้เกณฑ์เข้มงวดของ Valve replacement (หยุด Aspirin, Clopidogrel, Warfarin 5–7 วันก่อน OR) และยืนยันกับศัลยแพทย์หัวใจ'
    },
    {
      id: 'other',
      label: 'ผ่าตัดหัวใจ/ทรวงอกอื่น ๆ',
      short: 'Open heart อื่น ๆ',
      desc: 'ใช้เกณฑ์ Pre-OP ความเสี่ยงเลือดออกสูง (High Risk) และยืนยันกับศัลยแพทย์หัวใจ'
    }
  ];

  const PROC_PRESETS = [
    { label: 'CABGx3', type: 'cabg' },
    { label: 'CABG', type: 'cabg' },
    { label: 'AVR (Mechanical valve)', type: 'valve' },
    { label: 'AVR (Tissue valve)', type: 'valve' },
    { label: 'MVR', type: 'valve' },
    { label: 'DVR', type: 'valve' },
    { label: 'AVR + CABG', type: 'cabg_valve' },
    { label: 'MVR + CABG', type: 'cabg_valve' },
    { label: 'MV repair', type: 'other' },
    { label: 'TEVAR', type: 'other' }
  ];

  const QUICK_DRUG_IDS = [
    'aspirin', 'clopidogrel', 'warfarin',
    'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban',
    'empagliflozin', 'dapagliflozin',
    'arb', 'acei', 'betablocker', 'diuretic', 'statin', 'metformin'
  ];

  const DRP_PRESETS = [
    'No DRP',
    'SGLT2i เสี่ยง EDKA แนะนำหยุด 3–4 วันก่อน OR',
    'ACEI/ARB พิจารณาหยุด 24 ชม.ก่อน OR (ป้องกัน Intraop Hypotension)',
    'Diuretic หยุดเช้าวันผ่าตัด',
    'สมุนไพร/อาหารเสริม แนะนำงดอย่างน้อย 1–2 สัปดาห์ก่อน OR'
  ];

  // Match keywords from free-text MR lines to drugDatabase entries
  const MR_DRUG_MATCHERS = [
    { id: 'aspirin', re: /\b(aspirin|asa)\b/i },
    { id: 'clopidogrel', re: /\b(clopidogrel|plavix|apolets)\b/i },
    { id: 'ticagrelor', re: /\b(ticagrelor|brilinta)\b/i },
    { id: 'prasugrel', re: /\b(prasugrel|effient)\b/i },
    { id: 'cilostazol', re: /\b(cilostazol|pletaal)\b/i },
    { id: 'warfarin', re: /\b(warfarin|coumadin|orsarin)\b/i },
    { id: 'apixaban', re: /\b(apixaban|eliquis)\b/i },
    { id: 'rivaroxaban', re: /\b(rivaroxaban|xarelto)\b/i },
    { id: 'dabigatran', re: /\b(dabigatran|pradaxa)\b/i },
    { id: 'edoxaban', re: /\b(edoxaban|lixiana)\b/i },
    { id: 'empagliflozin', re: /\b(empagliflozin|jardiance|xigduo|glyxambi)\b/i },
    { id: 'dapagliflozin', re: /\b(dapagliflozin|forxiga|xigduo)\b/i },
    { id: 'canagliflozin', re: /\b(canagliflozin|invokana)\b/i },
    { id: 'ertugliflozin', re: /\b(ertugliflozin|steglatro)\b/i },
    { id: 'semaglutide_inj', re: /\b(semaglutide|ozempic|wegovy)\b/i },
    { id: 'dulaglutide', re: /\b(dulaglutide|trulicity)\b/i },
    { id: 'tirzepatide', re: /\b(tirzepatide|mounjaro)\b/i },
    { id: 'liraglutide', re: /\b(liraglutide|victoza|saxenda)\b/i },
    { id: 'metformin', re: /\b(metformin|glucophage|xigduo|galvus met|janumet)\b/i },
    { id: 'sulfonylurea', re: /\b(glipizide|glibenclamide|glimepiride|gliclazide|minidiab|diamicron)\b/i },
    { id: 'acei', re: /\b(enalapril|lisinopril|ramipril|perindopril|captopril)\b/i },
    { id: 'arb', re: /\b(losartan|valsartan|irbesartan|candesartan|telmisartan|olmesartan|entresto)\b/i },
    { id: 'betablocker', re: /\b(atenolol|bisoprolol|carvedilol|metoprolol|propranolol|nebivolol|concor|betaloc)\b/i },
    { id: 'diuretic', re: /\b(furosemide|lasix|hctz|hydrochlorothiazide|spironolactone|torsemide|moduretic)\b/i },
    { id: 'statin', re: /\b(atorvastatin|simvastatin|rosuvastatin|pravastatin|pitavastatin|fluvastatin|lipitor|crestor)\b/i },
    { id: 'nsaid_short', re: /\b(ibuprofen|diclofenac|brufen|voltaren)\b/i },
    { id: 'nsaid_med', re: /\b(naproxen|meloxicam|mobic)\b/i },
    { id: 'nsaid_long', re: /\b(piroxicam|feldene)\b/i },
    { id: 'cox2', re: /\b(celecoxib|etoricoxib|celebrex|arcoxia)\b/i },
    { id: 'parkinson', re: /\b(levodopa|madopar|sinemet|levopar|amantadine)\b/i },
    { id: 'thyroid', re: /\b(levothyroxine|eltroxin|euthyrox)\b/i }
  ];

  // State
  let mrSources = [{ place: '', date: '', drugs: [''] }];
  let selectedDrugs = [];
  let statusEditedManually = false;

  const $ = id => document.getElementById(id);
  function val(id) { const el = $(id); return el ? String(el.value || '').trim() : ''; }
  function isChecked(id) { return !!($(id) && $(id).checked); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function getDrugDb() {
    if (typeof window.drugDatabase !== 'undefined' && Array.isArray(window.drugDatabase)) return window.drugDatabase;
    try { if (typeof drugDatabase !== 'undefined' && Array.isArray(drugDatabase)) return drugDatabase; } catch (e) {}
    return [];
  }

  function todayShortBE() {
    const d = new Date();
    const yy = String(d.getFullYear() + 543).slice(-2);
    return `${d.getDate()}/${d.getMonth() + 1}/${yy}`;
  }

  function formatShortBEFromDate(dt) {
    if (!dt) return '';
    const yy = String(dt.getFullYear() + 543).slice(-2);
    return `${dt.getDate()}/${dt.getMonth() + 1}/${yy}`;
  }

  function formatFullBEFromDate(dt) {
    if (!dt) return '';
    return `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear() + 543}`;
  }

  function parseFlexDate(raw) {
    if (typeof window.parsePreopSurgeryDate === 'function') return window.parsePreopSurgeryDate(raw);
    const s = String(raw || '').trim();
    if (!s) return null;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      let y = +m[1], mo = +m[2], d = +m[3];
      if (y >= 2400) y -= 543;
      const dt = new Date(y, mo - 1, d);
      return (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) ? dt : null;
    }
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      let d = +m[1], mo = +m[2], y = +m[3];
      if (y < 100) y += 2500;
      if (y >= 2400) y -= 543;
      const dt = new Date(y, mo - 1, d);
      return (dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d) ? dt : null;
    }
    return null;
  }

  function addDays(dt, n) {
    const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  function getSurgeryType() {
    const el = document.querySelector('input[name="ohSurgeryType"]:checked');
    return el ? el.value : 'cabg';
  }

  function getSurgeryTypeMeta(id) {
    return SURGERY_TYPES.find(s => s.id === id) || SURGERY_TYPES[0];
  }

  function getSurgeryDate() {
    return parseFlexDate(val('ohSurgeryDate'));
  }

  function getCrclValue() {
    const raw = val('ohCrcl');
    if (!raw) return 90;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 90;
  }

  // Delegate non-overridden drugs to Pre-op's describePreopHold using High Bleeding Risk & Open Heart's CrCl/context
  function delegatePreopHold(drug) {
    const crcl = getCrclValue();
    const id = drug.id;
    const cat = drug.category;

    if (cat === 'doac' || cat === 'doac_dabi') {
      const d = (cat === 'doac_dabi') ? (crcl >= 50 ? 2 : 4) : 2;
      return {
        drug, id, name: drug.name,
        note: `${drug.name}: หยุดยา ${d} วันก่อน OR`,
        action: 'hold', holdDays: d, holdDaysMin: null, holdDaysMax: null,
        warnings: crcl < 50 ? [`CrCl ${crcl} mL/min (< 50) — ตรวจสอบการทำงานของไตก่อนหยุด DOAC`] : [],
        ruleSource: 'Pre-OP (High Risk)'
      };
    }

    if (cat === 'antiplatelet') {
      let d = 5;
      if (id === 'ticagrelor' || id === 'cilostazol') d = 3;
      if (id === 'prasugrel') d = 7;
      let note = `${drug.name}: หยุดยา ${d} วันก่อน OR`;
      const warnings = [];
      if (val('ohStentStatus') === 'yes') {
        note += ' [⚠️ เพิ่งใส่ Stent ปรึกษา Cardio ก่อนหยุด]';
        warnings.push('เพิ่งใส่ Stent — ปรึกษาอายุรแพทย์หัวใจก่อนหยุดยา');
      }
      return {
        drug, id, name: drug.name,
        note, action: 'hold', holdDays: d, holdDaysMin: null, holdDaysMax: null,
        warnings, ruleSource: 'Pre-OP (High Risk)'
      };
    }

    if (cat === 'raas_inhibitor') {
      if (val('ohRaasIndication') === 'hf') {
        return {
          drug, id, name: drug.name,
          note: `${drug.name}: ให้ยาต่อ (Continue)`,
          action: 'continue', holdDays: null, holdDaysMin: null, holdDaysMax: null,
          warnings: [], ruleSource: 'Pre-OP'
        };
      }
      return {
        drug, id, name: drug.name,
        note: `${drug.name}: หยุดยาล่วงหน้า 24 ชั่วโมงก่อน OR`,
        action: 'hold', holdDays: 1, holdDaysMin: null, holdDaysMax: null,
        warnings: [], ruleSource: 'Pre-OP'
      };
    }

    if (typeof window.describePreopHold === 'function') {
      // Temporarily read Pre-OP helper only for categories not dependent on Pre-OP DOM IDs
      const bleedEl = document.getElementById('bleedingRisk');
      const crclEl = document.getElementById('renalFunction');
      const prevBleed = bleedEl ? bleedEl.value : undefined;
      const prevCrcl = crclEl ? crclEl.value : undefined;
      if (bleedEl) bleedEl.value = 'high';
      if (crclEl) crclEl.value = String(crcl);
      try {
        const res = window.describePreopHold(drug);
        res.ruleSource = 'Pre-OP';
        return res;
      } finally {
        if (bleedEl && prevBleed !== undefined) bleedEl.value = prevBleed;
        if (crclEl && prevCrcl !== undefined) crclEl.value = prevCrcl;
      }
    }

    return {
      drug, id, name: drug.name,
      note: `${drug.name}: แพทย์ประเมินเป็นรายกรณี`,
      action: 'case_by_case', holdDays: null, holdDaysMin: null, holdDaysMax: null,
      warnings: [], ruleSource: 'Pre-OP'
    };
  }

  function hasHighThromboticCheck() {
    return [
      'ohWarMechMitral', 'ohWarMechAortic', 'ohWarMechStroke',
      'ohWarAfHigh', 'ohWarAfStroke', 'ohWarAfRheumatic',
      'ohWarVteRecent', 'ohWarVteSevere'
    ].some(isChecked);
  }

  // Open Heart specific hold rules (CABG vs Valve replacement)
  function describeHold(drug) {
    const sType = getSurgeryType();
    const inr = val('ohInr');
    const stentYes = val('ohStentStatus') === 'yes';

    if (sType === 'cabg') {
      if (drug.id === 'aspirin') {
        return {
          drug, id: drug.id, name: drug.name,
          note: `${drug.name}: ให้ยาต่อจนถึงวัน OR (Continue)`,
          action: 'continue', holdDays: null, holdDaysMin: null, holdDaysMax: null,
          warnings: [], ruleSource: 'เกณฑ์ Open Heart (CABG)'
        };
      }
      if (drug.id === 'clopidogrel') {
        const warnings = [];
        let note = `${drug.name}: หยุดยา 5 วันก่อน OR`;
        if (stentYes) {
          note += ' [⚠️ เพิ่งใส่ Stent ปรึกษา Cardio ก่อนหยุด]';
          warnings.push('เพิ่งใส่ Stent — ปรึกษาอายุรแพทย์หัวใจก่อนหยุดยา');
        }
        return {
          drug, id: drug.id, name: drug.name,
          note, action: 'hold', holdDays: 5, holdDaysMin: null, holdDaysMax: null,
          warnings, ruleSource: 'เกณฑ์ Open Heart (CABG)'
        };
      }
      if (drug.id === 'warfarin') {
        const warnings = [];
        let note = `${drug.name}: หยุดยา 7 วันก่อน OR ตามค่า INR` + (inr ? ` (INR ล่าสุด ${inr})` : '');
        if (hasHighThromboticCheck()) {
          note += ' [⚠️ พิจารณา Bridging (High Risk)]';
          warnings.push('ความเสี่ยงลิ่มเลือดสูง — พิจารณา Bridging และยืนยันกับแพทย์');
        }
        return {
          drug, id: drug.id, name: drug.name,
          note, action: 'hold', holdDays: 7, holdDaysMin: null, holdDaysMax: null,
          warnings, ruleSource: 'เกณฑ์ Open Heart (CABG)'
        };
      }
    }

    if (sType === 'valve' || sType === 'cabg_valve') {
      const ruleTag = sType === 'cabg_valve'
        ? 'เกณฑ์ Open Heart (ใช้เกณฑ์ Valve replacement — ยืนยันศัลยแพทย์)'
        : 'เกณฑ์ Open Heart (Valve replacement)';
      if (drug.id === 'aspirin' || drug.id === 'clopidogrel') {
        const warnings = [];
        let note = `${drug.name}: หยุดยา 5-7 วันก่อน OR`;
        if (stentYes) {
          note += ' [⚠️ เพิ่งใส่ Stent ปรึกษา Cardio ก่อนหยุด]';
          warnings.push('เพิ่งใส่ Stent — ปรึกษาอายุรแพทย์หัวใจก่อนหยุดยา');
        }
        return {
          drug, id: drug.id, name: drug.name,
          note, action: 'hold', holdDays: 7, holdDaysMin: 5, holdDaysMax: 7,
          warnings, ruleSource: ruleTag
        };
      }
      if (drug.id === 'warfarin') {
        const warnings = [];
        let note = `${drug.name}: หยุดยา 5-7 วันก่อน OR` + (inr ? ` (INR ล่าสุด ${inr})` : '');
        if (hasHighThromboticCheck()) {
          note += ' [⚠️ พิจารณา Bridging (High Risk)]';
          warnings.push('ความเสี่ยงลิ่มเลือดสูง — พิจารณา Bridging และยืนยันกับแพทย์');
        }
        return {
          drug, id: drug.id, name: drug.name,
          note, action: 'hold', holdDays: 7, holdDaysMin: 5, holdDaysMax: 7,
          warnings, ruleSource: ruleTag
        };
      }
    }

    return delegatePreopHold(drug);
  }

  function formatHoldLineWithDates(desc, surgeryDt) {
    if (!surgeryDt || desc.action === 'continue' || desc.action === 'case_by_case') return desc.note;
    if (desc.action === 'hold_morning') {
      return `${desc.note} (${formatShortBEFromDate(surgeryDt)})`;
    }
    if (desc.action === 'hold') {
      if (desc.holdDaysMin != null && desc.holdDaysMax != null && desc.holdDaysMin !== desc.holdDaysMax) {
        const startEarly = addDays(surgeryDt, -desc.holdDaysMax);
        const startLate = addDays(surgeryDt, -desc.holdDaysMin);
        return `${desc.note} (เริ่มงด ${formatShortBEFromDate(startEarly)} ถึง ${formatShortBEFromDate(startLate)})`;
      }
      if (desc.holdDays != null) {
        const stopDt = addDays(surgeryDt, -desc.holdDays);
        return `${desc.note} (เริ่มงด ${formatShortBEFromDate(stopDt)})`;
      }
    }
    return desc.note;
  }

  function computeAntiplateletSummary() {
    const hasAsa = selectedDrugs.some(d => d.id === 'aspirin');
    const hasClop = selectedDrugs.some(d => d.id === 'clopidogrel');
    const otherAp = selectedDrugs.filter(d => d.category === 'antiplatelet' && d.id !== 'aspirin' && d.id !== 'clopidogrel');
    const hasWarf = selectedDrugs.some(d => d.id === 'warfarin');
    const doacs = selectedDrugs.filter(d => d.category === 'doac' || d.category === 'doac_dabi');

    const parts = [];
    if (hasAsa && hasClop) parts.push('ASA + Clopidogrel');
    else if (hasAsa) parts.push('Aspirin');
    else if (hasClop) parts.push('Clopidogrel');
    otherAp.forEach(d => parts.push(d.name.split(' (')[0]));
    if (hasWarf) parts.push('Warfarin');
    doacs.forEach(d => parts.push(d.name.split(' (')[0]));

    if (parts.length > 0) return 'on ' + parts.join(' + ');
    return 'no antiplatelet no OAC';
  }

  function syncAntiplateletSummaryIfAuto() {
    const inp = $('ohAntiplateletStatus');
    if (!inp || statusEditedManually) return;
    inp.value = computeAntiplateletSummary();
  }

  // ---------------------------------------------------------------
  // Render UI
  // ---------------------------------------------------------------
  function render() {
    const root = $('form-OPENHEART');
    if (!root || root.dataset.ohMounted) return;
    root.dataset.ohMounted = '1';

    root.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-xl p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-red-900 mb-1">12. Open Heart (MR และวางแผนหยุดยาก่อนผ่าตัดหัวใจ)</h3>
            <p class="text-sm text-red-800">แยกเกณฑ์หยุดยาต้านเกล็ดเลือด/ยาละลายลิ่มเลือดระหว่าง <b>CABG</b> กับ <b>Valve replacement</b> พร้อมสร้าง Note PMK และปฏิทินหยุดยา</p>
          </div>
          <button type="button" onclick="openPreopHoldCalendar()" class="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5">
            <i class="fa-solid fa-calendar-days"></i> เปิดปฏิทินหยุดยา
          </button>
        </div>
      </div>

      <!-- 1. ข้อมูลผู้ป่วยและหัตถการ -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h4 class="font-semibold text-lg text-red-800 border-b pb-2">1. ข้อมูลการผ่าตัดและวันนัด (Open Heart Surgery)</h4>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-2">กลุ่มการผ่าตัด (สำหรับเกณฑ์หยุดยา)</label>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            ${SURGERY_TYPES.map((st, idx) => `
              <label class="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 hover:border-red-300 cursor-pointer bg-gray-50/70 has-[:checked]:bg-red-50 has-[:checked]:border-red-400">
                <input type="radio" name="ohSurgeryType" value="${st.id}" ${idx === 0 ? 'checked' : ''} class="mt-1 text-red-600" onchange="window.pmkOpenHeartOnRuleChange()">
                <div class="min-w-0">
                  <div class="font-bold text-sm text-gray-900">${esc(st.label)}</div>
                  <div class="text-xs text-gray-600 leading-snug mt-0.5">${esc(st.desc)}</div>
                </div>
              </label>
            `).join('')}
          </div>
          <div id="ohRuleBanner" class="mt-2.5 text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2"></div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">หัตถการที่ทำ</label>
            <input type="text" id="ohProcedure" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เช่น CABGx3, AVR (Mechanical valve), MVR" oninput="window.pmkOpenHeartRefresh()">
            <div class="flex flex-wrap gap-1 mt-1.5">
              ${PROC_PRESETS.map(p => `
                <button type="button" data-proc="${esc(p.label)}" data-type="${esc(p.type)}" onclick="window.pmkOpenHeartPickProc(this)" class="text-[11px] bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-full transition">${esc(p.label)}</button>
              `).join('')}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">U/D (โรคประจำตัว)</label>
            <input type="text" id="ohUd" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เช่น TVD, Severe AS, HT, DLP, DM" oninput="window.pmkOpenHeartRefresh()">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">วันที่พบเภสัช</label>
            <input type="text" id="ohVisitDate" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="วว/ดด/ปป (เช่น 25/11/69)" oninput="window.pmkOpenHeartRefresh()">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">วันนัดนอน รพ.</label>
            <input type="text" id="ohAdmitDate" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="วว/ดด/ปป หรือ Admit" oninput="window.pmkOpenHeartRefresh()">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">วันผ่าตัด (OR)</label>
            <input type="text" id="ohSurgeryDate" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="วว/ดด/พศ (เช่น 30/11/2569)" oninput="window.pmkOpenHeartOnRuleChange()">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="block text-sm font-medium text-gray-700">การทำงานของไต (CrCl)</label>
              <button type="button" onclick="openRenalCalcModal('OPENHEART')" class="text-[11px] bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-300 transition">
                <i class="fa-solid fa-calculator mr-1"></i>คำนวณ CrCl / eGFR
              </button>
            </div>
            <input type="number" id="ohCrcl" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="mL/min (Default 90)" oninput="window.pmkOpenHeartOnRuleChange()">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">INR ล่าสุด (สำหรับ Warfarin)</label>
            <input type="text" id="ohInr" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เช่น 2.35 (หรือเว้นว่าง)" oninput="window.pmkOpenHeartOnRuleChange()">
          </div>
        </div>
      </div>

      <!-- 2. MR ยา -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <h4 class="font-semibold text-lg text-indigo-800">2. MR ยา (Medication Reconciliation)</h4>
          <button type="button" onclick="window.pmkOpenHeartSyncFromMr()" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm transition flex items-center gap-1.5">
            <i class="fa-solid fa-wand-magic-sparkles"></i> ดึงยาจาก MR มาคำนวณวันหยุดยา
          </button>
        </div>

        <div id="ohMrSourcesContainer" class="space-y-3"></div>

        <button type="button" onclick="window.pmkOpenHeartAddMrSource()" class="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center w-full justify-center border border-indigo-200">
          <i class="fa-solid fa-plus mr-1.5"></i> เพิ่มสถานที่รับยา (กรณีรับยามาจากหลายที่)
        </button>

        <div class="bg-red-50 p-3.5 rounded-lg border border-red-100">
          <label class="inline-flex items-center mb-1.5 cursor-pointer">
            <input type="checkbox" id="ohAllergyCheck" class="form-checkbox text-red-600 rounded" onchange="window.pmkOpenHeartToggleAllergy(); window.pmkOpenHeartRefresh()">
            <span class="ml-2 font-medium text-sm text-red-700">มีประวัติแพ้ยา / แพ้อาหาร</span>
          </label>
          <input type="text" id="ohAllergyDetail" placeholder="ระบุ ชื่อยา/อาการที่แพ้ เช่น Amoxicillin / ผื่นคัน" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm hidden" oninput="window.pmkOpenHeartRefresh()">
        </div>
      </div>

      <!-- 3. ยาที่ใช้ประจำและแผนหยุดยาก่อน OR -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h4 class="font-semibold text-lg text-blue-800 border-b pb-2">3. ยาที่ต้องประเมินการหยุดยาก่อน OR (Plan)</h4>

        <div>
          <div class="text-xs font-medium text-gray-500 mb-1.5">เลือกด่วน (ยาที่พบบ่อยใน Open Heart):</div>
          <div id="ohQuickDrugs" class="flex flex-wrap gap-1.5"></div>
        </div>

        <div class="relative">
          <input type="text" id="ohDrugSearch" class="w-full rounded-lg border-gray-300 border px-3 py-2 pl-10 text-sm" placeholder="ค้นหายาเพิ่มเติม (เช่น Aspirin, Clopidogrel, Warfarin, Apixaban, Empagliflozin)" autocomplete="off">
          <i class="fa-solid fa-search absolute left-3 top-2.5 text-gray-400"></i>
          <div id="ohDrugListContainer" class="drug-list-container hidden"></div>
        </div>

        <div id="ohSelectedDrugsArea" class="hidden bg-gray-50 p-3 rounded-lg border border-gray-200">
          <div id="ohSelectedTags" class="flex flex-wrap"></div>
        </div>

        <div id="ohDynamicQuestions" class="hidden space-y-3"></div>

        <div id="ohHoldPlanPreview" class="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm space-y-1.5"></div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-sm font-medium text-gray-700">สถานะ Antiplatelet / Anticoagulant</label>
              <button type="button" onclick="window.pmkOpenHeartResetAutoStatus()" class="text-[11px] text-blue-600 hover:underline">คำนวณอัตโนมัติ</button>
            </div>
            <input type="text" id="ohAntiplateletStatus" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เช่น on ASA + Clopidogrel, on warfarin, no antiplatelet no OAC" oninput="window.pmkOpenHeartOnStatusManualInput()">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ข้อความเพิ่มเติมใน Plan</label>
            <input type="text" id="ohExtraPlan" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เช่น แนะนำทานยาหัวใจต่อเนื่อง, ยืนยัน Bridging กับแพทย์" oninput="window.pmkOpenHeartRefresh()">
          </div>
        </div>
      </div>

      <!-- 4. อาหารเสริมสมุนไพร, DRP และผู้บันทึก -->
      <div class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <h4 class="font-semibold text-lg text-emerald-800 border-b pb-2">4. อาหารเสริมสมุนไพร, DRP และผู้บันทึก</h4>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">อาหารเสริม / สมุนไพร</label>
            <input type="text" id="ohHerb" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เว้นว่างหากปฏิเสธ (หรือระบุ เช่น ขมิ้นชัน 1x1, น้ำมันปลา)" oninput="window.pmkOpenHeartRefresh()">
            <label class="inline-flex items-center mt-1.5 text-xs text-amber-800 cursor-pointer">
              <input type="checkbox" id="ohHerbHoldCheck" checked class="mr-1.5 rounded text-amber-600" onchange="window.pmkOpenHeartRefresh()">
              ระบุคำแนะนำให้งดสมุนไพร/อาหารเสริมอย่างน้อย 1–2 สัปดาห์ก่อน OR (เมื่อกรอกรายการ)
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">DRP / ปัญหาด้านยาที่พบ</label>
            <input type="text" id="ohDrp" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เช่น Empagliflozin hold 3 วันก่อน OR หรือ No DRP" oninput="window.pmkOpenHeartRefresh()">
            <div class="flex flex-wrap gap-1 mt-1.5">
              ${DRP_PRESETS.map(txt => `
                <button type="button" data-drp="${esc(txt)}" onclick="window.pmkOpenHeartPickDrp(this)" class="text-[11px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full transition">${esc(txt)}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ผู้บันทึก (Open Heart)</label>
            <input type="text" id="ohPharmName" list="pharmList" class="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm" placeholder="เลือกหรือพิมพ์ชื่อเภสัชกร" oninput="window.pmkOpenHeartRefresh()">
          </div>
          <div class="pt-4 md:pt-5">
            <label class="inline-flex items-center cursor-pointer bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2">
              <input type="checkbox" id="ohSeen" checked class="form-checkbox text-emerald-600 rounded" onchange="window.pmkOpenHeartRefresh()">
              <span class="ml-2 text-sm font-semibold text-emerald-900">พบเภสัชกรแล้ว</span>
            </label>
          </div>
        </div>
      </div>
    `;

    if ($('ohVisitDate') && !$('ohVisitDate').value) {
      $('ohVisitDate').value = todayShortBE();
    }

    bindDrugSearchEvents();
    renderQuickDrugs();
    renderMrSources();
    renderSelectedDrugs();
    renderDynamicQuestions();
    renderRuleBanner();
    renderHoldPreview();
    syncAntiplateletSummaryIfAuto();
  }

  function renderRuleBanner() {
    const el = $('ohRuleBanner');
    if (!el) return;
    const meta = getSurgeryTypeMeta(getSurgeryType());
    el.innerHTML = `<i class="fa-solid fa-heart-pulse mr-1"></i> <b>เกณฑ์ที่ใช้อยู่ (${esc(meta.label)}):</b> ${esc(meta.desc)}`;
  }

  function renderQuickDrugs() {
    const box = $('ohQuickDrugs');
    if (!box) return;
    const db = getDrugDb();
    const selectedSet = new Set(selectedDrugs.map(d => d.id));
    box.innerHTML = QUICK_DRUG_IDS.map(id => {
      const d = db.find(x => x.id === id);
      if (!d) return '';
      const active = selectedSet.has(id);
      const short = d.name.split(' (')[0];
      return `<button type="button" onclick="window.pmkOpenHeartToggleDrug('${esc(d.id)}')" class="text-xs px-2.5 py-1 rounded-full border transition ${active ? 'bg-blue-600 text-white border-blue-600 font-semibold' : 'bg-white hover:bg-blue-50 text-gray-700 border-gray-300'}">${active ? '✓ ' : '+ '}${esc(short)}</button>`;
    }).join('');
  }

  function bindDrugSearchEvents() {
    const inp = $('ohDrugSearch');
    const list = $('ohDrugListContainer');
    if (!inp || !list) return;

    const showFiltered = (showAll) => {
      const q = inp.value.toLowerCase().trim();
      const db = getDrugDb();
      const filtered = (showAll && !q) ? db : db.filter(d => d.name.toLowerCase().includes(q));
      list.innerHTML = '';
      list.classList.remove('hidden');
      if (!filtered.length) {
        list.innerHTML = '<div class="drug-item text-gray-400">ไม่พบชื่อยา</div>';
        return;
      }
      filtered.forEach(d => {
        const div = document.createElement('div');
        div.className = 'drug-item';
        div.textContent = d.name;
        div.onclick = () => {
          addDrugById(d.id);
          inp.value = '';
          list.classList.add('hidden');
        };
        list.appendChild(div);
      });
    };

    inp.addEventListener('input', () => showFiltered(false));
    inp.addEventListener('focus', () => showFiltered(true));
    document.addEventListener('click', (e) => {
      if (!inp.contains(e.target) && !list.contains(e.target)) list.classList.add('hidden');
    });
  }

  function addDrugById(id) {
    const db = getDrugDb();
    const d = db.find(x => x.id === id);
    if (!d) return false;
    if (!selectedDrugs.some(x => x.id === id)) {
      selectedDrugs.push(d);
      onDrugsChanged();
      return true;
    }
    return false;
  }

  function toggleDrug(id) {
    if (selectedDrugs.some(x => x.id === id)) {
      selectedDrugs = selectedDrugs.filter(x => x.id !== id);
      onDrugsChanged();
    } else {
      addDrugById(id);
    }
  }

  function removeDrug(id) {
    selectedDrugs = selectedDrugs.filter(x => x.id !== id);
    onDrugsChanged();
  }

  function onDrugsChanged() {
    renderQuickDrugs();
    renderSelectedDrugs();
    renderDynamicQuestions();
    syncAntiplateletSummaryIfAuto();
    refresh();
  }

  function renderSelectedDrugs() {
    const area = $('ohSelectedDrugsArea');
    const tags = $('ohSelectedTags');
    if (!area || !tags) return;
    if (!selectedDrugs.length) {
      area.classList.add('hidden');
      tags.innerHTML = '';
      return;
    }
    area.classList.remove('hidden');
    tags.innerHTML = selectedDrugs.map(d =>
      `<div class="tag">${esc(d.name)} <i class="fa-solid fa-times cursor-pointer" onclick="window.pmkOpenHeartRemoveDrug('${esc(d.id)}')"></i></div>`
    ).join('');
  }

  function renderDynamicQuestions() {
    const sec = $('ohDynamicQuestions');
    if (!sec) return;
    const prev = {
      warMechMitral: isChecked('ohWarMechMitral'),
      warMechAortic: isChecked('ohWarMechAortic'),
      warMechStroke: isChecked('ohWarMechStroke'),
      warAfHigh: isChecked('ohWarAfHigh'),
      warAfStroke: isChecked('ohWarAfStroke'),
      warAfRheumatic: isChecked('ohWarAfRheumatic'),
      warVteRecent: isChecked('ohWarVteRecent'),
      warVteSevere: isChecked('ohWarVteSevere'),
      raasInd: val('ohRaasIndication') || 'ht',
      stentStatus: val('ohStentStatus') || 'no',
      glp1LastDate: val('ohGlp1LastDate')
    };

    const blocks = [];
    if (selectedDrugs.some(d => d.id === 'warfarin')) {
      blocks.push(`
        <div class="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h5 class="font-bold text-red-800 mb-2 text-sm"><i class="fa-solid fa-heart-crack mr-1"></i> Warfarin: ประเมินความเสี่ยงลิ่มเลือดอุดตัน (Thrombotic Risk)</h5>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div class="space-y-1">
              <div class="font-bold text-red-700">Mechanical Heart Valve</div>
              <label class="block"><input type="checkbox" id="ohWarMechMitral" ${prev.warMechMitral ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> ลิ้นหัวใจเทียมตำแหน่ง Mitral</label>
              <label class="block"><input type="checkbox" id="ohWarMechAortic" ${prev.warMechAortic ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> ลิ้นหัวใจเทียมตำแหน่ง Aortic รุ่นเก่า</label>
              <label class="block"><input type="checkbox" id="ohWarMechStroke" ${prev.warMechStroke ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> เคยมี Stroke/TIA ภายใน 6 เดือน</label>
            </div>
            <div class="space-y-1">
              <div class="font-bold text-red-700">AF <button type="button" class="ml-1 bg-cyan-600 text-white px-2 py-0.5 rounded text-[11px]" onclick="openChadModal()"><i class="fa-solid fa-calculator"></i> คำนวณ</button></div>
              <label class="block"><input type="checkbox" id="ohWarAfHigh" ${prev.warAfHigh ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> CHA2DS2-VASc score ≥ 7</label>
              <label class="block"><input type="checkbox" id="ohWarAfStroke" ${prev.warAfStroke ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> เคยมี Stroke/TIA ภายใน 3 เดือน</label>
              <label class="block"><input type="checkbox" id="ohWarAfRheumatic" ${prev.warAfRheumatic ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> เป็น Rheumatic Heart Disease</label>
            </div>
            <div class="space-y-1">
              <div class="font-bold text-red-700">VTE (DVT/PE)</div>
              <label class="block"><input type="checkbox" id="ohWarVteRecent" ${prev.warVteRecent ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> เพิ่งเป็น VTE ภายใน 3 เดือน</label>
              <label class="block"><input type="checkbox" id="ohWarVteSevere" ${prev.warVteSevere ? 'checked' : ''} onchange="window.pmkOpenHeartOnRuleChange()"> มีภาวะ Severe Thrombophilia</label>
            </div>
          </div>
        </div>
      `);
    }

    if (selectedDrugs.some(d => d.category === 'raas_inhibitor')) {
      blocks.push(`
        <div class="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          <h5 class="font-bold text-sm mb-1">ACEI/ARB: ข้อบ่งใช้หลัก</h5>
          <select id="ohRaasIndication" class="w-full rounded border-gray-300 border p-1.5 text-sm" onchange="window.pmkOpenHeartOnRuleChange()">
            <option value="ht" ${prev.raasInd === 'ht' ? 'selected' : ''}>ความดันโลหิตสูง (หยุดล่วงหน้า 24 ชม.)</option>
            <option value="hf" ${prev.raasInd === 'hf' ? 'selected' : ''}>หัวใจล้มเหลว HFrEF (ให้ยาต่อ)</option>
          </select>
        </div>
      `);
    }

    if (selectedDrugs.some(d => d.category === 'antiplatelet')) {
      blocks.push(`
        <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <h5 class="font-bold text-sm mb-1">Antiplatelet: ประวัติใส่ขดลวดหัวใจ (Stent)</h5>
          <select id="ohStentStatus" class="w-full rounded border-gray-300 border p-1.5 text-sm" onchange="window.pmkOpenHeartOnRuleChange()">
            <option value="no" ${prev.stentStatus === 'no' ? 'selected' : ''}>ไม่เคย / นานแล้ว (&gt; 1 ปี)</option>
            <option value="yes" ${prev.stentStatus === 'yes' ? 'selected' : ''}>เคยใส่ (ภายใน 1 ปี)</option>
          </select>
        </div>
      `);
    }

    if (selectedDrugs.some(d => d.category === 'glp1_weekly')) {
      blocks.push(`
        <div class="bg-purple-50 border border-purple-200 p-3 rounded-lg">
          <h5 class="font-bold text-sm mb-1">GLP-1 Weekly: ฉีดมื้อล่าสุด</h5>
          <input type="date" id="ohGlp1LastDate" value="${esc(prev.glp1LastDate)}" class="w-full rounded border-gray-300 border p-1.5 text-sm" onchange="window.pmkOpenHeartOnRuleChange()">
        </div>
      `);
    }

    if (blocks.length) {
      sec.innerHTML = blocks.join('');
      sec.classList.remove('hidden');
    } else {
      sec.innerHTML = '';
      sec.classList.add('hidden');
    }
  }

  function renderHoldPreview() {
    const box = $('ohHoldPlanPreview');
    if (!box) return;
    if (!selectedDrugs.length) {
      box.innerHTML = '<div class="text-xs text-gray-500">เลือกยาด้านบนหรือกด "ดึงยาจาก MR มาคำนวณวันหยุดยา" เพื่อดูแผนการหยุดยาอัตโนมัติ</div>';
      return;
    }
    const surgDt = getSurgeryDate();
    const lines = selectedDrugs.map((d, i) => {
      const desc = describeHold(d);
      const line = formatHoldLineWithDates(desc, surgDt);
      const badgeColor = desc.action === 'continue'
        ? 'bg-emerald-100 text-emerald-800'
        : (desc.action === 'case_by_case' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-900');
      return `<div class="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-slate-200/70 last:border-b-0">
        <span class="text-slate-800"><b>${i + 1}.</b> ${esc(line)}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-full ${badgeColor}">${esc(desc.ruleSource || '')}</span>
      </div>`;
    });
    box.innerHTML = `<div class="text-xs font-bold text-slate-700 mb-1">สรุปแผนการจัดการยาก่อน OR (${surgDt ? 'วันผ่าตัด ' + esc(formatFullBEFromDate(surgDt)) : 'ยังไม่ระบุวันผ่าตัด'}):</div>` + lines.join('');
  }

  // ---------------------------------------------------------------
  // MR Sources UI
  // ---------------------------------------------------------------
  function renderMrSources() {
    const container = $('ohMrSourcesContainer');
    if (!container) return;
    container.innerHTML = mrSources.map((src, sIdx) => {
      const drugInputs = src.drugs.map((d, dIdx) => `
        <div class="flex gap-2 items-center mb-2 pl-3">
          <span class="font-medium text-gray-500 text-xs w-4">${dIdx + 1}.</span>
          <input type="text" value="${esc(d)}" oninput="window.pmkOpenHeartUpdateMrDrug(${sIdx}, ${dIdx}, this.value)" class="flex-1 rounded-lg border-gray-300 border px-3 py-1.5 text-sm" placeholder="ชื่อยา ขนาด วิธีใช้ (เช่น Aspirin 81 mg 1x1 pc)">
          <button type="button" onclick="window.pmkOpenHeartRemoveMrDrug(${sIdx}, ${dIdx})" class="text-red-400 hover:text-red-600 p-1" title="ลบรายการยา"><i class="fa-solid fa-trash"></i></button>
        </div>
      `).join('');

      return `
        <div class="bg-gray-50/70 p-4 rounded-lg border border-gray-200 relative">
          ${mrSources.length > 1 ? `<button type="button" onclick="window.pmkOpenHeartRemoveMrSource(${sIdx})" class="absolute top-2 right-2 text-red-500 hover:bg-red-50 px-2 py-1 rounded font-bold text-xs"><i class="fa-solid fa-xmark"></i> ลบสถานที่นี้</button>` : ''}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 pr-8">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">สถานที่รับยา</label>
              <input type="text" value="${esc(src.place)}" oninput="window.pmkOpenHeartUpdateMrSource(${sIdx}, 'place', this.value)" class="w-full rounded-lg border-gray-300 border px-3 py-1.5 text-sm bg-white" placeholder="เช่น รพ.นพรัตน์, รพ.ต้นทาง, ซองยาเดิม">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">วันที่รับยา</label>
              <input type="text" value="${esc(src.date)}" oninput="window.pmkOpenHeartUpdateMrSource(${sIdx}, 'date', this.value)" class="w-full rounded-lg border-gray-300 border px-3 py-1.5 text-sm bg-white" placeholder="เช่น 15/11/69">
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-2 bg-white px-2 py-0.5 rounded border border-gray-200 inline-block">รายการยา MR</label>
            ${drugInputs}
            <button type="button" onclick="window.pmkOpenHeartAddMrDrug(${sIdx})" class="text-xs text-indigo-600 hover:text-indigo-800 ml-3 font-medium flex items-center mt-1">+ เพิ่มรายการยาในสถานที่นี้</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function syncFromMr() {
    const texts = [];
    mrSources.forEach(s => s.drugs.forEach(d => { if (String(d || '').trim()) texts.push(d); }));
    const combined = texts.join('\n');
    if (!combined.trim()) {
      if (typeof window.pmkAlert === 'function') window.pmkAlert('กรุณากรอกรายการยาในส่วน MR ยาก่อนครับ');
      return;
    }
    const db = getDrugDb();
    let added = 0;
    MR_DRUG_MATCHERS.forEach(m => {
      if (m.re.test(combined)) {
        const drug = db.find(x => x.id === m.id);
        if (drug && !selectedDrugs.some(x => x.id === drug.id)) {
          selectedDrugs.push(drug);
          added++;
        }
      }
    });
    if (added > 0) {
      onDrugsChanged();
      if (typeof window.showToast === 'function') window.showToast(`ดึงยาจาก MR เข้าสู่แผนหยุดยาเพิ่ม ${added} รายการ`);
    } else {
      if (typeof window.showToast === 'function') window.showToast('ไม่มีรายการยาใหม่ที่ตรงกับเกณฑ์หยุดยา');
    }
  }

  // ---------------------------------------------------------------
  // Note Generator (Exact Order Required by User)
  // Pharmacist note
  // U/D
  // Plan
  // MR ยา
  // อาหารเสริมสมุนไพร
  // /ภก…….
  // ---------------------------------------------------------------
  function buildPlanLines() {
    const sType = getSurgeryType();
    const meta = getSurgeryTypeMeta(sType);
    const proc = val('ohProcedure') || meta.short;
    const surgDt = getSurgeryDate();
    const surgRaw = val('ohSurgeryDate');
    const admitRaw = val('ohAdmitDate');
    const inr = val('ohInr');
    const extra = val('ohExtraPlan');

    const headParts = [];
    if (val('ohProcedure')) headParts.push(`${val('ohProcedure')} (${meta.short})`);
    else headParts.push(meta.label);
    if (surgDt) headParts.push(`วันผ่าตัด ${formatFullBEFromDate(surgDt)}`);
    else if (surgRaw) headParts.push(`วันผ่าตัด ${surgRaw}`);
    if (admitRaw) headParts.push(`วันนัดนอน รพ. ${admitRaw}`);
    if (inr) headParts.push(`INR ล่าสุด ${inr}`);

    const holdLines = selectedDrugs.map(d => formatHoldLineWithDates(describeHold(d), surgDt));
    const drp = val('ohDrp');

    return { headText: headParts.join(' | '), holdLines, extra, drp };
  }

  function buildNote() {
    const ud = val('ohUd');
    const plan = buildPlanLines();
    const herb = val('ohHerb');
    const herbHold = isChecked('ohHerbHoldCheck');
    const hasAllergy = isChecked('ohAllergyCheck');
    const allergyDetail = val('ohAllergyDetail');
    const pharm = val('ohPharmName');
    const hasMr = mrSources.some(s => s.place.trim() || s.date.trim() || s.drugs.some(d => d.trim()));

    const hasAny = !!(
      ud || val('ohProcedure') || val('ohSurgeryDate') || val('ohAdmitDate') || val('ohInr') ||
      selectedDrugs.length || plan.extra || plan.drp || hasMr || hasAllergy || herb || pharm
    );
    if (!hasAny) return [];

    const out = ['Pharmacist note'];
    out.push(`U/D: ${ud || '-'}`);

    // Plan section
    out.push(`Plan: ${plan.headText}`);
    plan.holdLines.forEach((line, idx) => {
      out.push(`  ${idx + 1}. ${line}`);
    });
    if (plan.extra) out.push(`  - ${plan.extra}`);
    if (plan.drp) out.push(`  - DRP: ${plan.drp}`);

    // MR ยา section
    out.push('MR ยา:');
    let mrHasContent = false;
    mrSources.forEach(src => {
      const validDrugs = src.drugs.map(d => String(d || '').trim()).filter(Boolean);
      if (src.place.trim() || src.date.trim() || validDrugs.length) {
        mrHasContent = true;
        const head = [];
        if (src.place.trim()) head.push(`ผู้ป่วยรับยาจาก ${src.place.trim()}`);
        if (src.date.trim()) head.push(`วันที่ ${src.date.trim()}`);
        if (head.length) out.push(`- ${head.join(' ')}`);
        validDrugs.forEach((d, i) => out.push(`  ${i + 1}. ${d}`));
      }
    });
    if (!mrHasContent) out.push('- ปฏิเสธยาประจำ / ยังไม่ระบุรายการยา');
    if (hasAllergy) out.push(`- แพ้ยา/แพ้อาหาร: ${allergyDetail || 'ไม่ระบุ'}`);
    else out.push('- แพ้ยา/แพ้อาหาร: ปฏิเสธ');

    // อาหารเสริมสมุนไพร section
    if (herb) {
      const herbAdvice = herbHold ? ' (แนะนำงดอย่างน้อย 1-2 สัปดาห์ก่อน OR)' : '';
      out.push(`อาหารเสริมสมุนไพร: ${herb}${herbAdvice}`);
    } else {
      out.push('อาหารเสริมสมุนไพร: ปฏิเสธ');
    }

    // /ภก…….
    if (pharm) {
      const formattedPharm = /^(ภก\.|ภญ\.)/.test(pharm) ? pharm : `ภก.${pharm}`;
      out.push(`/${formattedPharm}`);
    }

    return out;
  }

  // ---------------------------------------------------------------
  // Google Sheet Row Builder for tab "Open heart" (12 cols A-L)
  // ---------------------------------------------------------------
  function formatDateCell(raw, emptyFallback) {
    const s = String(raw || '').trim();
    if (!s) return emptyFallback || '';
    const dt = parseFlexDate(s);
    if (dt) return formatShortBEFromDate(dt);
    return s;
  }

  function isAntithrombotic(drug) {
    return drug.category === 'antiplatelet' || drug.category === 'anticoagulant' || drug.category === 'doac' || drug.category === 'doac_dabi';
  }

  function buildRow(defaultDateStr) {
    const hn = val('hn');
    const ptName = val('ptName');
    const ud = val('ohUd');
    const meta = getSurgeryTypeMeta(getSurgeryType());
    const proc = val('ohProcedure') || meta.label;
    const seen = isChecked('ohSeen');
    const visitDate = formatDateCell(val('ohVisitDate'), defaultDateStr || todayShortBE());
    const admitDate = formatDateCell(val('ohAdmitDate'), '');
    const surgRaw = val('ohSurgeryDate');
    const surgDate = formatDateCell(surgRaw, 'ยังไม่ set');
    const surgDt = getSurgeryDate();

    const statusText = val('ohAntiplateletStatus') || computeAntiplateletSummary();

    const antithromAdvice = [];
    const otherMedAdvice = [];
    selectedDrugs.forEach(d => {
      const desc = describeHold(d);
      const line = formatHoldLineWithDates(desc, surgDt);
      if (isAntithrombotic(d)) antithromAdvice.push(line);
      else otherMedAdvice.push(line);
    });
    if (val('ohExtraPlan')) antithromAdvice.push(val('ohExtraPlan'));

    const drpParts = [];
    if (val('ohDrp')) drpParts.push(val('ohDrp'));
    if (otherMedAdvice.length) drpParts.push(otherMedAdvice.join(' | '));
    const herb = val('ohHerb');
    if (herb && isChecked('ohHerbHoldCheck')) {
      drpParts.push(`สมุนไพร (${herb}): งด 1-2 สัปดาห์ก่อน OR`);
    }

    return [
      hn,                         // A: Column 1 (HN)
      ptName,                     // B: ชื่อ-นามสกุล
      ud,                         // C: U/D
      proc,                       // D: หัตถการ
      seen,                       // E: พบเภสัช (checkbox TRUE/FALSE)
      visitDate,                  // F: วันที่พบเภสัช
      admitDate,                  // G: วันนัดนอนรพ.
      surgDate,                   // H: วันผ่าตัด
      statusText,                 // I: รายละเอียด
      antithromAdvice.join(' | '),// J: เภสัชแนะนำ
      drpParts.join(' | '),       // K: DRP
      ''                          // L: cancel case (leave empty)
    ];
  }

  // ---------------------------------------------------------------
  // Clinical Alerts (consumed by pmk-alerts-copy.js)
  // ---------------------------------------------------------------
  function evalAlerts() {
    const alerts = [];
    const sType = getSurgeryType();
    const crcl = getCrclValue();
    const inr = val('ohInr');
    const surgDt = getSurgeryDate();
    const hasAsa = selectedDrugs.some(d => d.id === 'aspirin');
    const hasClop = selectedDrugs.some(d => d.id === 'clopidogrel');
    const hasWarf = selectedDrugs.some(d => d.id === 'warfarin');
    const hasDoac = selectedDrugs.some(d => d.category === 'doac' || d.category === 'doac_dabi');
    const hasDabi = selectedDrugs.some(d => d.category === 'doac_dabi');
    const hasAp = selectedDrugs.some(d => d.category === 'antiplatelet');

    if (sType === 'cabg_valve' && (hasAsa || hasClop || hasWarf)) {
      alerts.push({
        level: 'warn',
        title: 'ผ่าตัดร่วม CABG + Valve replacement: ใช้เกณฑ์หยุดยาของ Valve (5–7 วันก่อน OR)',
        detail: 'Aspirin/Clopidogrel/Warfarin ใช้ระยะเวลาหยุด 5–7 วันก่อน OR และควรยืนยันคำสั่งกับศัลยแพทย์หัวใจเป็นรายกรณี',
        source: 'เกณฑ์ Open Heart ในแอป'
      });
    }

    if (sType === 'cabg' && hasAsa) {
      alerts.push({
        level: 'info',
        title: 'CABG + Aspirin: ให้ยาต่อจนถึงวัน OR (Continue)',
        detail: 'ตามเกณฑ์ CABG ให้รับประทาน Aspirin ต่อเนื่องจนถึงวันผ่าตัด ยกเว้นศัลยแพทย์มีคำสั่งเฉพาะ',
        source: 'เกณฑ์ Open Heart (CABG)'
      });
    }

    if ((sType === 'valve' || sType === 'cabg_valve') && hasAsa) {
      alerts.push({
        level: 'warn',
        title: 'Valve replacement + Aspirin: แนะนำหยุด 5–7 วันก่อน OR',
        detail: 'ต่างจาก CABG เดี่ยว — สำหรับการเปลี่ยนลิ้นหัวใจให้หยุด Aspirin ล่วงหน้า 5–7 วันก่อน OR',
        source: 'เกณฑ์ Open Heart (Valve replacement)'
      });
    }

    if (hasWarf) {
      const daysLabel = sType === 'cabg' ? '7 วันก่อน OR ตามค่า INR' : '5–7 วันก่อน OR';
      if (!inr) {
        alerts.push({
          level: 'warn',
          title: 'ผู้ป่วยใช้ Warfarin — ยังไม่ได้กรอกค่า INR ล่าสุด',
          detail: `แนะนำหยุด Warfarin ${daysLabel} และติดตามค่า INR ก่อนผ่าตัด`,
          source: 'เกณฑ์ Open Heart'
        });
      } else {
        const inrNum = parseFloat(inr);
        if (Number.isFinite(inrNum) && inrNum >= 1.5) {
          alerts.push({
            level: 'info',
            title: `Warfarin INR ล่าสุด ${inr} — หยุดยา ${daysLabel}`,
            detail: 'วางแผนหยุด Warfarin ตามกำหนดและติดตาม INR ซ้ำก่อนเข้าห้องผ่าตัด',
            source: 'เกณฑ์ Open Heart'
          });
        }
      }
      if (hasHighThromboticCheck()) {
        alerts.push({
          level: 'danger',
          title: 'ความเสี่ยงลิ่มเลือดอุดตันสูง (High Thrombotic Risk) บนยา Warfarin',
          detail: 'พิจารณาปรึกษาแพทย์เรื่อง Bridging Anticoagulation (LMWH/UFH) ช่วงหยุด Warfarin ก่อนผ่าตัดหัวใจ',
          source: 'CHEST 2022 Perioperative Guideline'
        });
      }
    }

    if (hasAp && val('ohStentStatus') === 'yes') {
      alerts.push({
        level: 'danger',
        title: 'มีประวัติใส่ Stent หัวใจภายใน 1 ปี',
        detail: 'ห้ามหยุดยาต้านเกล็ดเลือด (DAPT/P2Y12) โดยพลการ เสี่ยง Stent thrombosis สูงมาก — ต้องปรึกษาอายุรแพทย์หัวใจและศัลยแพทย์หัวใจ',
        source: 'ACC/AHA & ESC Perioperative DAPT Guideline'
      });
    }

    if (hasDoac && crcl < 50) {
      alerts.push({
        level: crcl < 30 ? 'danger' : 'warn',
        title: `DOAC ร่วมกับไตเสื่อม (CrCl ${crcl} mL/min < 50)`,
        detail: hasDabi
          ? 'Dabigatran ขับออกทางไตสูง — เมื่อ CrCl < 50 mL/min ขยายระยะเวลาหยุดยาเป็น 4 วันก่อน OR (หรือนานกว่าถ้า CrCl < 30)'
          : 'Factor Xa inhibitor ร่วมกับ CrCl ลดลง — ทบทวนระยะเวลาหยุดยาก่อนผ่าตัดหัวใจและปรึกษาแพทย์',
        source: 'EHRA 2021 / CHEST 2022'
      });
    }

    if (selectedDrugs.some(d => d.category === 'sglt2' || d.category === 'sglt2_4d')) {
      const days = selectedDrugs.some(d => d.category === 'sglt2_4d') ? '4 วัน' : '3 วัน';
      alerts.push({
        level: 'warn',
        title: 'ยากลุ่ม SGLT2i เสี่ยง Euglycemic DKA ช่วงผ่าตัด',
        detail: `แนะนำหยุดยาล่วงหน้า ${days} ก่อนวัน OR และติดตามภาวะคีโตน/กรดในเลือดหลังผ่าตัด`,
        source: 'US FDA / ADA Standards of Care'
      });
    }

    if (selectedDrugs.some(d => d.category === 'glp1_weekly')) {
      alerts.push({
        level: 'warn',
        title: 'GLP-1 RA รายสัปดาห์ — เสี่ยงอาหารค้างในกระเพาะ (Aspiration)',
        detail: 'พิจารณาหยุดยาล่วงหน้าอย่างน้อย 1 สัปดาห์ก่อนดมยาสลบผ่าตัดหัวใจ',
        source: 'ASA 2023 Consensus Guidance'
      });
    }

    const herb = val('ohHerb');
    if (herb) {
      const hasAntithromb = hasAp || hasWarf || hasDoac;
      alerts.push({
        level: 'warn',
        title: `พบการใช้อาหารเสริม/สมุนไพร (${herb})`,
        detail: hasAntithromb
          ? 'ใช้ร่วมกับยาต้านเกล็ดเลือด/ละลายลิ่มเลือด เพิ่มความเสี่ยงเลือดออกช่วงผ่าตัด — แนะนำหยุดอย่างน้อย 1–2 สัปดาห์ก่อน OR'
          : 'แนะนำงดอาหารเสริม/สมุนไพรก่อนผ่าตัดอย่างน้อย 1–2 สัปดาห์',
        source: 'คลังข้อมูลสมุนไพร Pre-OP ในแอป'
      });
    }

    if (selectedDrugs.some(d => describeHold(d).action === 'hold') && !surgDt) {
      alerts.push({
        level: 'info',
        title: 'ยังไม่ได้ระบุวันผ่าตัด (OR) ในรูปแบบวันที่',
        detail: 'กรอกวันผ่าตัด (เช่น 30/11/2569) เพื่อคำนวณวันที่เริ่มงดยาและสร้างปฏิทินหยุดยาอัตโนมัติ',
        source: 'เครื่องคำนวณวันหยุดยาในแอป'
      });
    }

    if (isChecked('ohAllergyCheck') && val('ohAllergyDetail')) {
      const allergyText = val('ohAllergyDetail').toLowerCase();
      const mrText = mrSources.flatMap(s => s.drugs).join(' ').toLowerCase();
      const tokens = allergyText.split(/[\s,/;+|]+/).filter(w => w.length >= 4);
      const hit = tokens.find(t => mrText.includes(t));
      if (hit) {
        alerts.push({
          level: 'danger',
          title: `พบชื่อยาใน MR ใกล้เคียงประวัติแพ้ยา ("${hit}")`,
          detail: `ตรวจสอบรายการยา MR เทียบกับประวัติแพ้ยา "${val('ohAllergyDetail')}" และแจ้งแพทย์`,
          source: 'MR Allergy Check'
        });
      }
    }

    return alerts;
  }

  // ---------------------------------------------------------------
  // Lifecycle / State sync / Reset / Helpers
  // ---------------------------------------------------------------
  function refresh() {
    renderRuleBanner();
    renderHoldPreview();
    if (typeof window.generateOutput === 'function') window.generateOutput();
    if (typeof window.triggerAutoSaveDraft === 'function') window.triggerAutoSaveDraft();
  }

  function reset() {
    mrSources = [{ place: '', date: '', drugs: [''] }];
    selectedDrugs = [];
    statusEditedManually = false;
    const defType = document.querySelector('input[name="ohSurgeryType"][value="cabg"]');
    if (defType) defType.checked = true;
    if ($('ohVisitDate')) $('ohVisitDate').value = todayShortBE();
    if ($('ohSeen')) $('ohSeen').checked = true;
    if ($('ohHerbHoldCheck')) $('ohHerbHoldCheck').checked = true;
    if ($('ohAllergyCheck')) $('ohAllergyCheck').checked = false;
    if ($('ohAllergyDetail')) $('ohAllergyDetail').classList.add('hidden');
    if ($('ohAntiplateletStatus')) $('ohAntiplateletStatus').value = 'no antiplatelet no OAC';
    renderMrSources();
    renderQuickDrugs();
    renderSelectedDrugs();
    renderDynamicQuestions();
    renderRuleBanner();
    renderHoldPreview();
  }

  function getState() {
    return {
      mrSources: mrSources.map(s => ({ place: s.place, date: s.date, drugs: s.drugs.slice() })),
      selectedDrugIds: selectedDrugs.map(d => d.id),
      statusEditedManually: !!statusEditedManually
    };
  }

  function setState(st) {
    if (!st || typeof st !== 'object') return;
    if (Array.isArray(st.mrSources) && st.mrSources.length) {
      mrSources = st.mrSources.map(s => ({
        place: String(s.place || ''),
        date: String(s.date || ''),
        drugs: Array.isArray(s.drugs) && s.drugs.length ? s.drugs.map(String) : ['']
      }));
    }
    const db = getDrugDb();
    if (Array.isArray(st.selectedDrugIds)) {
      selectedDrugs = st.selectedDrugIds.map(id => db.find(x => x.id === id)).filter(Boolean);
    }
    statusEditedManually = !!st.statusEditedManually;
    renderMrSources();
    renderQuickDrugs();
    renderSelectedDrugs();
    renderDynamicQuestions();
    renderRuleBanner();
    renderHoldPreview();
    if (!statusEditedManually) syncAntiplateletSummaryIfAuto();
  }

  // Public API
  window.pmkOpenHeartRender = render;
  window.pmkOpenHeartBuildNote = buildNote;
  window.pmkOpenHeartBuildRow = buildRow;
  window.pmkOpenHeartEvalAlerts = evalAlerts;
  window.pmkOpenHeartReset = reset;
  window.pmkOpenHeartRefresh = refresh;
  window.pmkOpenHeartGetState = getState;
  window.pmkOpenHeartSetState = setState;
  window.pmkOpenHeartPharmName = () => val('ohPharmName');
  window.pmkOpenHeartGetSelectedDrugs = () => selectedDrugs.slice();
  window.pmkOpenHeartDescribeHold = describeHold;
  window.pmkOpenHeartGetSurgeryDate = getSurgeryDate;
  window.pmkOpenHeartGetProcLabel = () => val('ohProcedure') || getSurgeryTypeMeta(getSurgeryType()).label;
  window.pmkOpenHeartGetRuleLabel = () => getSurgeryTypeMeta(getSurgeryType()).label;
  window.pmkOpenHeartGetCrclLabel = () => val('ohCrcl') || '90 (ค่าเริ่มต้น)';

  window.pmkOpenHeartOnRuleChange = () => {
    renderRuleBanner();
    renderHoldPreview();
    if (typeof window.generateOutput === 'function') window.generateOutput();
  };
  window.pmkOpenHeartPickProc = (btn) => {
    const proc = btn.dataset.proc || '';
    const type = btn.dataset.type || 'cabg';
    if ($('ohProcedure')) $('ohProcedure').value = proc;
    const rad = document.querySelector(`input[name="ohSurgeryType"][value="${CSS.escape(type)}"]`);
    if (rad) rad.checked = true;
    window.pmkOpenHeartOnRuleChange();
  };
  window.pmkOpenHeartPickDrp = (btn) => {
    const txt = btn.dataset.drp || '';
    const inp = $('ohDrp');
    if (!inp) return;
    if (txt === 'No DRP') {
      inp.value = 'No DRP';
    } else {
      const cur = inp.value.trim();
      if (!cur || cur === 'No DRP') inp.value = txt;
      else if (!cur.includes(txt)) inp.value = cur + ', ' + txt;
    }
    refresh();
  };
  window.pmkOpenHeartToggleDrug = toggleDrug;
  window.pmkOpenHeartRemoveDrug = removeDrug;
  window.pmkOpenHeartSyncFromMr = syncFromMr;
  window.pmkOpenHeartAddMrSource = () => { mrSources.push({ place: '', date: '', drugs: [''] }); renderMrSources(); refresh(); };
  window.pmkOpenHeartRemoveMrSource = (idx) => { mrSources.splice(idx, 1); if (!mrSources.length) mrSources.push({ place: '', date: '', drugs: [''] }); renderMrSources(); refresh(); };
  window.pmkOpenHeartUpdateMrSource = (idx, field, value) => { if (mrSources[idx]) mrSources[idx][field] = value; refresh(); };
  window.pmkOpenHeartAddMrDrug = (sIdx) => { if (mrSources[sIdx]) { mrSources[sIdx].drugs.push(''); renderMrSources(); refresh(); } };
  window.pmkOpenHeartUpdateMrDrug = (sIdx, dIdx, value) => { if (mrSources[sIdx]) mrSources[sIdx].drugs[dIdx] = value; refresh(); };
  window.pmkOpenHeartRemoveMrDrug = (sIdx, dIdx) => {
    if (!mrSources[sIdx]) return;
    mrSources[sIdx].drugs.splice(dIdx, 1);
    if (!mrSources[sIdx].drugs.length) mrSources[sIdx].drugs.push('');
    renderMrSources();
    refresh();
  };
  window.pmkOpenHeartToggleAllergy = () => {
    const chk = $('ohAllergyCheck');
    const det = $('ohAllergyDetail');
    if (chk && det) {
      if (chk.checked) det.classList.remove('hidden');
      else det.classList.add('hidden');
    }
  };
  window.pmkOpenHeartOnStatusManualInput = () => {
    statusEditedManually = true;
    refresh();
  };
  window.pmkOpenHeartResetAutoStatus = () => {
    statusEditedManually = false;
    syncAntiplateletSummaryIfAuto();
    refresh();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
