/* Clinic 11: HIV/TB เด็ก (PID / ID clinic เด็ก)
 * Source documents (Drive folder "Clinic HIV,TB Children"):
 *  - One page HIV เด็ก (PMTCT table 1, infant treatment table 2)
 *  - One page TB เด็ก (TB treatment mg/kg, LTBI regimens, infant prophylaxis)
 *  - One page OIs เด็ก (OI prophylaxis)
 *  - แบบฟอร์ม HIV clinic เด็ก แก้ไขครั้งที่ 2 (Pharmacist Note layout), older form (pill-count adherence, counseling)
 * Saves to Google Sheet tab "PID" (A date, B HN, C name, D TB, E HIV, F โรค/ปัญหา, G รายละเอียด, H DRPs, I ME, J พบเภสัช, K หมายเหตุ)
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Reference data (from the one-page PDFs)
  // ---------------------------------------------------------------
  const SRC_HIV = 'One page HIV เด็ก (ตารางที่ 1/2)';
  const SRC_TB = 'One page TB เด็ก';
  const SRC_OI = 'One page OIs เด็ก';
  const SRC_FORM = 'แบบฟอร์ม HIV clinic เด็ก (แก้ไขครั้งที่ 2)';

  // Table 1: PMTCT infant prophylaxis by birth weight (g). Syrup 10 mg/mL.
  const PMTCT_T1 = [
    { min: 4000, max: 4499, azt: 18, tc: 9, nvp: 18 },
    { min: 3500, max: 3999, azt: 16, tc: 8, nvp: 16 },
    { min: 3000, max: 3499, azt: 14, tc: 7, nvp: 14 },
    { min: 2500, max: 2999, azt: 12, tc: 6, nvp: 12 },
    { min: 2000, max: 2499, azt: 10, tc: 5, nvp: 10 },
    { min: 1500, max: 1999, azt: 8, tc: 4, nvp: 8 }
  ];

  // Table 2: treatment of infected infants < 1 yr by weight (kg). Volumes in mL, เช้า-เย็น.
  // AZT 10 mg/mL, 3TC 10 mg/mL, LPV/r 80 mg/mL, NVP 10 mg/mL (NVP = ทางเลือกรอง)
  const INF_T2 = [
    { label: '> 3-4 กก.', gt: 3, le: 4, azt: 4, tc: 1.5, lpv: 1, nvp: 5 },
    { label: '> 4-5 กก.', gt: 4, le: 5, azt: 5, tc: 2, lpv: 1, nvp: 5 },
    { label: '> 5-6 กก.', gt: 5, le: 6, azt: 6, tc: 2.5, lpv: 1.2, nvp: 6 },
    { label: '> 6-7 กก.', gt: 6, le: 7, azt: 7, tc: 3, lpv: 1.4, nvp: 7 },
    { label: '> 7-9 กก.', gt: 7, le: 9, azt: 8, tc: 3.5, lpv: 1.6, nvp: 9 },
    { label: '> 9-11 กก.', gt: 9, le: 11, azt: 9, tc: 5, lpv: 1.6, nvp: 10 },
    { label: '12-15 กก.', gt: 11, le: 15, azt: 12, tc: 5, lpv: 1.8, nvp: 12 }
  ];

  // TB treatment mg/kg/day (One page TB เด็ก). E uses one-pager 15-20 (form says 15-25).
  const TB_RANGE = {
    H: { name: 'Isoniazid (H)', min: 10, max: 15, hiMax: 20, cap: 300 },
    R: { name: 'Rifampicin (R)', min: 10, max: 20, cap: 600 },
    Z: { name: 'Pyrazinamide (Z)', min: 30, max: 40, cap: 2000 },
    E: { name: 'Ethambutol (E)', min: 15, max: 20, formMax: 25, cap: 1200 }
  };

  // Drug catalogue for the regimen rows. key -> mg/kg checks.
  const DRUG_OPTIONS = [
    'TLD (TDF 300 + 3TC 300 + DTG 50 mg)',
    'AZT syrup 10 mg/mL', 'AZT cap 100 mg', 'AZT 300 mg',
    '3TC syrup 10 mg/mL', '3TC tab 150 mg', '3TC tab 300 mg',
    'NVP syrup 10 mg/mL', 'NVP tab 200 mg',
    'LPV/r syrup 80/20 mg/mL', 'LPV/r tab 200/50 mg', 'LPV/r tab 100/25 mg',
    'Zilavir (AZT 300 + 3TC 150 mg)', 'ABC 300 mg', 'Kivexa/Alacovir (ABC 600 + 3TC 300 mg)',
    'DTG 10 mg dispersible', 'DTG 50 mg', 'EFV 200 mg', 'EFV 600 mg', 'TDF 300 mg', 'TENO-EM (TDF 300 + FTC 200 mg)',
    'RAL 400 mg', 'ATV 300 mg', 'DRV 600 mg', 'RTV 100 mg',
    'Isoniazid (INH) tab 100 mg', 'Isoniazid (INH) syrup 10 mg/mL',
    'Rifampicin cap 300 mg', 'Rifampicin cap 450 mg', 'Rifampicin syrup 20 mg/mL',
    'Pyrazinamide tab 500 mg', 'Ethambutol tab 400 mg', 'Ethambutol tab 500 mg',
    'Rifapentine tab 150 mg', 'Vitamin B6 tab 50 mg',
    'Co-trimoxazole susp (TMP 40/SMX 200 per 5 mL)', 'Co-trimoxazole tab (TMP 80/SMX 400)',
    'Dapsone 100 mg', 'Fluconazole cap 100 mg', 'Fluconazole susp 10 mg/mL', 'Itraconazole',
    'Azithromycin syrup 200 mg/5 mL', 'Azithromycin cap 250 mg', 'Clarithromycin',
    'Benzathine penicillin G', 'Penicillin G sodium (PGS)', 'Entecavir 0.5 mg', 'Ferrous fumarate'
  ];

  function drugKey(name) {
    const s = String(name || '').toUpperCase();
    if (/RIFAPENTINE/.test(s)) return 'P';
    if (/ISONIAZID|\bINH\b/.test(s)) return 'H';
    if (/RIFAMPI/.test(s)) return 'R';
    if (/PYRAZINAMIDE|PIRAZINAMIDE/.test(s)) return 'Z';
    if (/ETHAMBUTOL/.test(s)) return 'E';
    if (/B6|PYRIDOXINE/.test(s)) return 'B6';
    if (/\bTLD\b/.test(s)) return 'TLD';
    if (/ZILAVIR|ZILARVIR/.test(s)) return 'AZT3TC';
    if (/LPV/.test(s)) return 'LPV';
    if (/DTG|DOLUTEGRAVIR/.test(s)) return 'DTG';
    if (/\bAZT\b|ZIDOVUDINE/.test(s)) return 'AZT';
    if (/\b3TC\b|LAMIVUDINE/.test(s)) return '3TC';
    if (/\bNVP\b|NEVIRAPINE/.test(s)) return 'NVP';
    if (/TDF|TENOFOVIR|TENO-EM/.test(s)) return 'TDF';
    if (/EFV/.test(s)) return 'EFV';
    if (/CO-?TRIMOX|BACTRIM|TMP/.test(s)) return 'SMX';
    if (/FLUCONAZOLE/.test(s)) return 'FLU';
    return '';
  }

  const DRP_LIST = ['NO DRPs', 'Untreated indication', 'Improper drug selection', 'Too LOW dosage', 'Too HIGH dosage', 'Non-compliance', 'Adverse drug reactions', 'Drug interactions', 'Drug use without indication'];
  const ME_LIST = ['NO ME', 'Prescribing error', 'Transcribing error', 'Dispensing error', 'Administration error'];

  const CASE_TYPES = [
    { id: 'pmtct', label: 'Case Maternal HIV / PMTCT ทารก', hiv: true },
    { id: 'hivtx', label: 'HIV รักษา (Known case HIV)', hiv: true },
    { id: 'pep', label: 'PEP', hiv: true },
    { id: 'tbtx', label: 'TB รักษา', tb: true },
    { id: 'ltbi', label: 'Contact TB / TB ป้องกัน (LTBI)', tb: true },
    { id: 'ntm', label: 'NTM / BCG lymphadenitis', tb: true },
    { id: 'syph', label: 'Maternal / Congenital syphilis' },
    { id: 'hbv', label: 'HBV (HBsAg +)' },
    { id: 'other', label: 'อื่นๆ (ระบุในช่องโรค/ปัญหา)' }
  ];

  const COUNSEL = ['เปลี่ยนขนาดยา / เม็ดยา', 'แบ่งยา / ดูดยา / ผสมยา', 'จัดแบ่ง / ปรับเวลากินยา', 'เทคนิคการรับประทาน', 'แนะนำเรื่อง ADR ที่อาจเกิด', 'แนะนำเรื่องอาหาร (เช่น ยาห่างจากนม/แคลเซียม)', 'เทคนิคการผสมยา', 'แนะนำเรื่องการเก็บยา'];
  const ADH_FIX = ['ย้ำความสำคัญของการกินยา', 'แสดงผลการรักษา CD4 / VL / OI', 'ฝึกปฏิบัติการจัดเตรียมยา', 'หาเครื่องช่วยเตือนการกินยา', 'หา / เปลี่ยนผู้ดูแล', 'เปิดเผยผลการติดเชื้อแก่เด็ก'];

  const FREQ = [
    { v: 'OD', l: 'วันละ 1 ครั้ง (OD)', perDay: 1 },
    { v: 'BID', l: 'วันละ 2 ครั้ง (q12h)', perDay: 2 },
    { v: 'TID', l: 'วันละ 3 ครั้ง (q8h)', perDay: 3 },
    { v: 'QW', l: 'สัปดาห์ละครั้ง', perDay: 1 / 7 },
    { v: '3W', l: '3 วัน/สัปดาห์', perDay: 3 / 7 }
  ];
  const FREQ_MAP = Object.fromEntries(FREQ.map(f => [f.v, f]));

  // ---------------------------------------------------------------
  // State
  // ---------------------------------------------------------------
  let rows = [];
  function blankRow() { return { name: '', mg: '', freq: 'OD', ml: '', time: '' }; }

  // ---------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------
  const $ = id => document.getElementById(id);
  function val(id) { const el = $(id); return el ? String(el.value || '').trim() : ''; }
  function num(id) { const v = parseFloat(val(id).replace(/,/g, '')); return Number.isFinite(v) ? v : NaN; }
  function isChecked(id) { return !!($(id) && $(id).checked); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function fmt(x) { return Number.isFinite(x) ? String(r1(x)) : '-'; }
  function ageMonths() {
    const y = num('pidAgeY'), m = num('pidAgeM'), d = num('pidAgeD');
    let t = 0, any = false;
    if (Number.isFinite(y)) { t += y * 12; any = true; }
    if (Number.isFinite(m)) { t += m; any = true; }
    if (Number.isFinite(d)) { t += d / 30.4; any = true; }
    return any ? t : NaN;
  }
  function ageYears() { const m = ageMonths(); return Number.isFinite(m) ? m / 12 : NaN; }
  function bw() { return num('pidBw'); }
  function bsa() { const w = bw(), h = num('pidHt'); return (w > 0 && h > 0) ? Math.sqrt(w * h / 3600) : NaN; }
  function caseOn(id) { return isChecked('pidCase_' + id); }
  function ageText() {
    const p = [];
    if (val('pidAgeY')) p.push(val('pidAgeY') + ' ปี');
    if (val('pidAgeM')) p.push(val('pidAgeM') + ' เดือน');
    if (val('pidAgeD')) p.push(val('pidAgeD') + ' วัน');
    return p.join(' ');
  }
  function toBE(dateIso) {
    const m = String(dateIso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return String(dateIso || '');
    return Number(m[3]) + '/' + Number(m[2]) + '/' + ((Number(m[1]) + 543) % 100).toString().padStart(2, '0');
  }
  function sheetDate(d) {
    d = d || new Date();
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + String((d.getFullYear() + 543) % 100).padStart(2, '0');
  }

  // ---------------------------------------------------------------
  // CSS (own classes, the app's tailwind build is static)
  // ---------------------------------------------------------------
  function injectCss() {
    if ($('pidStyles')) return;
    const st = document.createElement('style');
    st.id = 'pidStyles';
    st.textContent = `
      #form-PID .pid-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04);margin-bottom:16px}
      #form-PID .pid-h{font-weight:700;color:#9f1239;font-size:1rem;margin:0 0 10px;border-bottom:1px solid #fde2e8;padding-bottom:6px}
      #form-PID .pid-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
      #form-PID label.pid-l{display:block;font-size:.78rem;color:#4b5563;margin-bottom:3px;font-weight:600}
      #form-PID input[type=text],#form-PID input[type=number],#form-PID input[type=date],#form-PID select,#form-PID textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:7px 9px;font-size:.9rem;background:#fff}
      #form-PID textarea{min-height:62px}
      #form-PID .pid-chips{display:flex;flex-wrap:wrap;gap:6px}
      #form-PID .pid-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #e5e7eb;background:#f9fafb;border-radius:999px;padding:5px 10px;font-size:.82rem;cursor:pointer}
      #form-PID .pid-chip input{margin:0}
      #form-PID .pid-btn{border:1px solid #be123c;background:#be123c;color:#fff;border-radius:8px;padding:6px 12px;font-size:.85rem;font-weight:600;cursor:pointer}
      #form-PID .pid-btn.alt{background:#fff;color:#be123c}
      #form-PID .pid-btn.sm{padding:3px 8px;font-size:.78rem}
      #form-PID .pid-row{display:grid;grid-template-columns:2.2fr .8fr 1.2fr .8fr 1.2fr auto;gap:6px;align-items:center;margin-bottom:6px}
      @media (max-width:720px){#form-PID .pid-row{grid-template-columns:1fr 1fr}}
      #form-PID .pid-mgkg{font-size:.75rem;border-radius:6px;padding:2px 6px;display:inline-block;margin-top:2px}
      #form-PID .ok{background:#dcfce7;color:#166534}#form-PID .lo{background:#fef3c7;color:#92400e}#form-PID .hi{background:#fee2e2;color:#991b1b}#form-PID .na{background:#f3f4f6;color:#6b7280}
      #form-PID table.pid-t{width:100%;border-collapse:collapse;font-size:.84rem;margin-top:6px}
      #form-PID table.pid-t th,#form-PID table.pid-t td{border:1px solid #e5e7eb;padding:5px 6px;text-align:left;vertical-align:top}
      #form-PID table.pid-t th{background:#fff1f2}
      #form-PID .pid-note{font-size:.78rem;color:#6b7280;margin-top:6px;line-height:1.45}
      #form-PID .pid-warnbox{font-size:.8rem;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:6px 8px;margin-top:6px;color:#78350f}
      #form-PID .pid-kb{display:flex;flex-wrap:wrap;gap:8px}
      #form-PID .pid-adh{font-size:1.3rem;font-weight:800;color:#9f1239}
      #pidKbModal{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:90;display:none;align-items:flex-start;justify-content:center;padding:16px;overflow:auto}
      #pidKbModal.open{display:flex}
      #pidKbModal .pid-kb-card{background:#fff;border-radius:14px;max-width:900px;width:100%;padding:12px}
      #pidKbModal img{width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px}
      #pidKbModal .pid-kb-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:700}
      #pidKbModal button{border:none;background:#f1f5f9;border-radius:999px;width:34px;height:34px;font-size:20px;cursor:pointer}
    `;
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------
  function chip(id, label, extra) {
    return `<label class="pid-chip"><input type="checkbox" id="${id}" ${extra || ''}> ${esc(label)}</label>`;
  }

  function render() {
    const host = $('form-PID');
    if (!host || host.dataset.pidReady) return;
    host.dataset.pidReady = '1';
    injectCss();

    if (!$('pidDrugOptions')) {
      const dl = document.createElement('datalist');
      dl.id = 'pidDrugOptions';
      dl.innerHTML = DRUG_OPTIONS.map(o => `<option value="${esc(o)}"></option>`).join('');
      document.body.appendChild(dl);
    }

    host.innerHTML = `
      <div class="pid-card">
        <div class="pid-h">ความรู้ / One page (ID clinic เด็ก)</div>
        <div class="pid-kb">
          <button type="button" class="pid-btn alt" data-pid-kb="hiv">HIV เด็ก (PMTCT / ตารางยา)</button>
          <button type="button" class="pid-btn alt" data-pid-kb="tb">TB เด็ก (รักษา / LTBI)</button>
          <button type="button" class="pid-btn alt" data-pid-kb="oi">OIs เด็ก</button>
        </div>
        <p class="pid-note">ชื่อ-HN ใช้ช่องด้านบน แนะนำพิมพ์คำนำหน้า ด.ช./ด.ญ./ทารก ในชื่อ เหมือนในชีท PID</p>
      </div>

      <div class="pid-card">
        <div class="pid-h">1. ข้อมูลผู้ป่วย (ตามแบบฟอร์ม ID clinic เด็ก)</div>
        <div class="pid-grid">
          <div><label class="pid-l">อายุ (ปี)</label><input type="number" min="0" id="pidAgeY"></div>
          <div><label class="pid-l">อายุ (เดือน)</label><input type="number" min="0" id="pidAgeM"></div>
          <div><label class="pid-l">อายุ (วัน) - ทารก</label><input type="number" min="0" id="pidAgeD"></div>
          <div><label class="pid-l">BW วันนี้ (kg)</label><input type="number" step="0.01" min="0" id="pidBw"></div>
          <div><label class="pid-l">BW ครั้งก่อน (kg)</label><input type="number" step="0.01" min="0" id="pidBwPrev"></div>
          <div><label class="pid-l">ส่วนสูง (cm) - สำหรับ BSA</label><input type="number" step="0.1" min="0" id="pidHt"></div>
        </div>
        <div style="margin-top:10px"><label class="pid-l">กลุ่มโรค / ประเภทเคส (ติ๊กได้หลายข้อ — TB / HIV จะลงคอลัมน์ D / E ในชีท)</label>
          <div class="pid-chips">${CASE_TYPES.map(c => chip('pidCase_' + c.id, c.label)).join('')}</div>
        </div>
        <div class="pid-grid" style="margin-top:10px">
          <div>${chip('pidTb', 'TB (คอลัมน์ D)')}</div>
          <div>${chip('pidHiv', 'HIV (คอลัมน์ E)')}</div>
        </div>
        <div style="margin-top:10px"><label class="pid-l">โรค / ปัญหา (คอลัมน์ F) เช่น Case Maternal HIV (high risk), Congenital syphilis, NTM Lymphadenitis</label>
          <input type="text" id="pidDx" placeholder="โรค / ปัญหา">
        </div>
        <div style="margin-top:8px"><label class="pid-l">CC</label><input type="text" id="pidCc"></div>
        <div class="pid-grid" style="margin-top:8px">
          <div><label class="pid-l">เวลากินยา (น.)</label><input type="text" id="pidTime" placeholder="เช่น 18.00"></div>
          <div><label class="pid-l">ผู้ดูแลเด็กในการกินยา</label><input type="text" id="pidCaregiver"></div>
          <div><label class="pid-l">ผู้พาเด็กมาตรวจวันนี้</label><input type="text" id="pidBringer"></div>
          <div><label class="pid-l">แพ้ยา</label><input type="text" id="pidAllergy" placeholder="ไม่มี / ระบุ"></div>
        </div>
      </div>

      <div class="pid-card">
        <div class="pid-h">2. Lab / ผลตรวจ (ไม่บังคับ)</div>
        <div class="pid-grid">
          <div><label class="pid-l">CD4 (cells/mm³)</label><input type="text" id="pidCd4"></div>
          <div><label class="pid-l">%CD4</label><input type="text" id="pidCd4p"></div>
          <div><label class="pid-l">VL</label><input type="text" id="pidVl" placeholder="<20 / ค่า"></div>
          <div><label class="pid-l">วันที่ Lab</label><input type="text" id="pidLabDate" placeholder="วว/ดด/ปป"></div>
          <div><label class="pid-l">HIV DNA PCR (ผลล่าสุด)</label>
            <select id="pidPcr"><option value="">-- ไม่ระบุ --</option><option>รอผล</option><option>Negative</option><option>Positive</option></select></div>
          <div><label class="pid-l">PCR ครั้งที่ / อายุ</label><input type="text" id="pidPcrNo" placeholder="เช่น ครั้งที่ 2 (1 เดือน)"></div>
          <div><label class="pid-l">Scr</label><input type="text" id="pidScr"></div>
          <div><label class="pid-l">Hb</label><input type="text" id="pidHb"></div>
          <div><label class="pid-l">AST / ALT</label><input type="text" id="pidLft"></div>
          <div><label class="pid-l">RPR / VDRL</label><input type="text" id="pidRpr" placeholder="NR / 1:8"></div>
          <div><label class="pid-l">TST (mm) / IGRA</label><input type="text" id="pidTst"></div>
          <div><label class="pid-l">Lab อื่นๆ</label><input type="text" id="pidLabOther"></div>
        </div>
      </div>

      <div class="pid-card">
        <div class="pid-h">3. คำนวณขนาดยาตามน้ำหนัก (อ้างอิง One page)</div>
        <div class="pid-grid">
          <div><label class="pid-l">เลือกการคำนวณ</label>
            <select id="pidCalcMode">
              <option value="pmtct">PMTCT ทารกแรกเกิด (ตารางที่ 1)</option>
              <option value="inftx">รักษา HIV ทารก &lt;1 ปี (ตารางที่ 2)</option>
              <option value="tbtx">รักษา TB (2HRZE/4HR, 2HRZE/10HR)</option>
              <option value="ltbi">TB ป้องกัน / LTBI (3HP, 1HP, 4R, 3HR, 6-9H)</option>
              <option value="infanttb">ทารกที่แม่เป็น TB (ป้องกันแม่สู่ลูก)</option>
              <option value="oi">ยาป้องกัน OI</option>
            </select></div>
          <div id="pidCalcOpt1"></div>
          <div id="pidCalcOpt2"></div>
        </div>
        <div id="pidCalcOut"></div>
      </div>

      <div class="pid-card">
        <div class="pid-h">4. รายการยา (ARV / TB / OI / อื่นๆ) — แสดง mg/kg อัตโนมัติจาก BW</div>
        <div class="pid-row" style="font-size:.75rem;color:#6b7280;font-weight:600"><div>ชื่อยา</div><div>mg/ครั้ง</div><div>ความถี่</div><div>mL/ครั้ง</div><div>เวลา / วิธีใช้</div><div></div></div>
        <div id="pidRows"></div>
        <button type="button" class="pid-btn alt sm" id="pidAddRow">+ เพิ่มยา</button>
        <div style="margin-top:8px"><label class="pid-l">วันเริ่มยา TB (Start)</label><input type="text" id="pidTbStart" placeholder="วว/ดด/ปป" style="max-width:220px"></div>
      </div>

      <div class="pid-card">
        <div class="pid-h">5. % Adherence (นับเม็ดยา)</div>
        <div class="pid-grid">
          <div><label class="pid-l">a = จำนวนยาที่ได้ครั้งที่แล้ว</label><input type="number" id="pidAdhA"></div>
          <div><label class="pid-l">c = จำนวนยาที่เหลือจริง (นับ)</label><input type="number" id="pidAdhC"></div>
          <div><label class="pid-l">b = จำนวนยาที่ควรกิน</label><input type="number" id="pidAdhB"></div>
          <div><label class="pid-l">หรือ: จำนวนวันตั้งแต่นัดก่อน</label><input type="number" id="pidAdhDays"></div>
          <div><label class="pid-l">มื้อ/วัน</label><input type="number" id="pidAdhDoses" placeholder="1"></div>
          <div><label class="pid-l">จำนวนมื้อที่ลืม</label><input type="number" id="pidAdhMissed"></div>
          <div><label class="pid-l">จำนวนครั้งกินยาไม่ตรงเวลา</label><input type="number" id="pidAdhLate"></div>
          <div><label class="pid-l">% Adherence (แก้เองได้)</label><input type="text" id="pidAdhManual" placeholder="อัตโนมัติ"></div>
        </div>
        <div style="margin-top:8px">% Adherence = (a − c) × 100 / b หรือ (มื้อที่ควรกิน − มื้อที่ลืม) × 100 / มื้อที่ควรกิน : <span class="pid-adh" id="pidAdhOut">-</span></div>
      </div>

      <div class="pid-card">
        <div class="pid-h">6. DRP / ME / Counseling</div>
        <div class="pid-grid">
          <div><label class="pid-l">DRPs (คอลัมน์ H)</label><select id="pidDrp"><option value="">-- ไม่ระบุ --</option>${DRP_LIST.map(d => `<option>${esc(d)}</option>`).join('')}</select></div>
          <div><label class="pid-l">ME (คอลัมน์ I)</label><select id="pidMe"><option value="">-- ไม่ระบุ --</option>${ME_LIST.map(d => `<option>${esc(d)}</option>`).join('')}</select></div>
          <div style="display:flex;align-items:flex-end">${chip('pidSeen', 'พบเภสัช (คอลัมน์ J)', 'checked')}</div>
        </div>
        <div style="margin-top:8px"><label class="pid-l">รายละเอียด DRP / การแก้ไข</label><textarea id="pidDrpDetail"></textarea></div>
        <div style="margin-top:8px"><label class="pid-l">การแก้ไขเพื่อเพิ่ม Adherence (แก่เด็ก / ผู้ดูแล)</label>
          <div class="pid-chips">${ADH_FIX.map((c, i) => chip('pidFix' + i, c)).join('')}</div></div>
        <div style="margin-top:8px"><label class="pid-l">Counseling</label>
          <div class="pid-chips">${COUNSEL.map((c, i) => chip('pidCoun' + i, c)).join('')}</div></div>
      </div>

      <div class="pid-card">
        <div class="pid-h">7. Plan / นัด / เภสัชกร</div>
        <div><label class="pid-l">Plan</label><textarea id="pidPlan"></textarea></div>
        <div class="pid-grid" style="margin-top:8px">
          <div><label class="pid-l">นัดครั้งถัดไป</label><input type="date" id="pidNext"></div>
          <div><label class="pid-l">นัดเพื่อ (เช่น HIV PCR 4 เดือน, CXR)</label><input type="text" id="pidNextFor"></div>
          <div><label class="pid-l">หมายเหตุ (คอลัมน์ K)</label><input type="text" id="pidRemark"></div>
          <div><label class="pid-l">ชื่อเภสัชกร</label><input type="text" id="pidPharmName" data-pmk-list="pharmList" autocomplete="off" placeholder="เลือกหรือพิมพ์ชื่อเภสัชกร"></div>
        </div>
      </div>
    `;

    // modal
    if (!$('pidKbModal')) {
      const m = document.createElement('div');
      m.id = 'pidKbModal';
      m.className = 'print:hidden';
      m.innerHTML = `<div class="pid-kb-card"><div class="pid-kb-top"><span id="pidKbTitle"></span><button type="button" aria-label="ปิด" id="pidKbClose">×</button></div><div id="pidKbBody"></div></div>`;
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m || e.target.id === 'pidKbClose') m.classList.remove('open'); });
    }

    host.addEventListener('input', onAnyChange);
    host.addEventListener('change', onAnyChange);
    host.addEventListener('click', onClick);
    rows = [blankRow()];
    renderRows();
    renderCalcOptions();
    updateAll();
  }

  const KB = {
    hiv: { t: 'HIV ในเด็ก (One page)', imgs: ['images/pid/onepage-hiv-peds.jpg'] },
    tb: { t: 'TB ในเด็ก (One page)', imgs: ['images/pid/onepage-tb-peds.jpg'] },
    oi: { t: 'Opportunistic infections เด็ก (One page)', imgs: ['images/pid/onepage-oi-peds-1.jpg', 'images/pid/onepage-oi-peds-2.jpg'] }
  };
  function openKb(k) {
    const d = KB[k]; if (!d) return;
    $('pidKbTitle').textContent = d.t;
    $('pidKbBody').innerHTML = d.imgs.map(s => `<img src="${s}" alt="${esc(d.t)}" loading="lazy">`).join('');
    $('pidKbModal').classList.add('open');
  }

  // ---------------------------------------------------------------
  // Drug rows
  // ---------------------------------------------------------------
  function renderRows() {
    const box = $('pidRows'); if (!box) return;
    box.innerHTML = rows.map((r, i) => `
      <div class="pid-row" data-i="${i}">
        <div><input type="text" data-f="name" data-pmk-list="pidDrugOptions" autocomplete="off" value="${esc(r.name)}" placeholder="ชื่อยา"></div>
        <div><input type="number" step="0.1" data-f="mg" value="${esc(r.mg)}" placeholder="mg"></div>
        <div><select data-f="freq">${FREQ.map(f => `<option value="${f.v}"${f.v === r.freq ? ' selected' : ''}>${f.l}</option>`).join('')}</select></div>
        <div><input type="number" step="0.1" data-f="ml" value="${esc(r.ml)}" placeholder="mL"></div>
        <div><input type="text" data-f="time" value="${esc(r.time)}" placeholder="เช่น 1x1 18.00"><span class="pid-mgkg na" id="pidMgkg${i}"></span></div>
        <div><button type="button" class="pid-btn alt sm" data-del="${i}">ลบ</button></div>
      </div>`).join('');
    updateMgkg();
  }

  function rowCheck(r) {
    const w = bw();
    const mg = parseFloat(r.mg);
    const f = FREQ_MAP[r.freq] || FREQ_MAP.OD;
    const key = drugKey(r.name);
    if (!(w > 0) || !(mg > 0)) return { key, text: '', cls: 'na' };
    const perDose = mg / w;
    const perDay = mg * f.perDay / w;
    let range = null, basis = 'day', src = '';
    const yrs = ageYears();
    if (['H', 'R', 'Z', 'E'].includes(key) && f.v !== 'QW') {
      if (caseOn('tbtx') || caseOn('ntm') || !caseOn('ltbi')) {
        const t = TB_RANGE[key];
        range = { min: t.min, max: key === 'H' ? t.hiMax : (key === 'E' ? t.formMax : t.max), soft: t.max };
        src = SRC_TB;
      } else {
        const lt10 = !(yrs >= 10);
        if (key === 'H') range = lt10 ? { min: 7.5, max: 15 } : { min: 4, max: 6 };
        if (key === 'R') range = lt10 ? { min: 10, max: 20 } : { min: 8, max: 12 };
        src = SRC_TB + ' (LTBI)';
      }
    } else if (caseOn('pmtct') && ['AZT', '3TC', 'NVP'].includes(key)) {
      basis = 'dose';
      if (key === 'AZT') range = { min: 3.5, max: 5 };
      if (key === '3TC') range = { min: 1.6, max: 2.6 };
      if (key === 'NVP') range = { min: 3.5, max: 5 };
      src = SRC_HIV;
    }
    const shown = basis === 'dose' ? perDose : perDay;
    const unit = basis === 'dose' ? 'mg/kg/ครั้ง' : (f.v === 'QW' ? 'mg/kg/ครั้ง (สัปดาห์ละครั้ง)' : 'mg/kg/วัน');
    const v = f.v === 'QW' ? perDose : shown;
    let cls = 'na', status = '';
    if (range) {
      if (v < range.min * 0.98) { cls = 'lo'; status = 'ต่ำกว่า'; }
      else if (v > range.max * 1.02) { cls = 'hi'; status = 'สูงกว่า'; }
      else if (range.soft && v > range.soft * 1.02) { cls = 'lo'; status = 'เกินช่วงปกติ'; }
      else { cls = 'ok'; status = 'อยู่ในช่วง'; }
    }
    return { key, value: v, unit, range, cls, status, src, text: `${fmt(v)} ${unit}${range ? ` (${range.min}-${range.max}) ${status}` : ''}` };
  }

  function updateMgkg() {
    rows.forEach((r, i) => {
      const el = $('pidMgkg' + i); if (!el) return;
      const c = rowCheck(r);
      el.className = 'pid-mgkg ' + c.cls;
      el.textContent = c.text;
    });
  }

  // ---------------------------------------------------------------
  // Calculators
  // ---------------------------------------------------------------
  function renderCalcOptions() {
    const mode = val('pidCalcMode') || 'pmtct';
    const o1 = $('pidCalcOpt1'), o2 = $('pidCalcOpt2');
    if (!o1) return;
    if (mode === 'pmtct') {
      o1.innerHTML = `<label class="pid-l">ความเสี่ยง</label><select id="pidRisk"><option value="standard">Standard risk</option><option value="high">High risk</option></select>`;
      o2.innerHTML = `<label class="pid-l">น้ำหนักแรกคลอด (g) / GA (สัปดาห์)</label><div style="display:flex;gap:6px"><input type="number" id="pidBirthWt" placeholder="g"><input type="number" id="pidGa" placeholder="GA"></div>`;
    } else if (mode === 'tbtx') {
      o1.innerHTML = `<label class="pid-l">สูตร</label><select id="pidTbReg"><option value="2HRZE/4HR">2HRZE/4HR (ปอด / ต่อมน้ำเหลือง)</option><option value="2HRZE/10HR">2HRZE/10HR (แพร่กระจาย / CNS / กระดูกและข้อ)</option></select>`;
      o2.innerHTML = '';
    } else if (mode === 'ltbi') {
      o1.innerHTML = `<label class="pid-l">สูตร</label><select id="pidLtbiReg"><option value="3HP">3HP (weekly 12 doses)</option><option value="1HP">1HP (daily 28 doses)</option><option value="4R">4R</option><option value="3HR">3HR</option><option value="6-9H">6-9H</option></select>`;
      o2.innerHTML = '';
    } else if (mode === 'infanttb') {
      o1.innerHTML = `<label class="pid-l">สถานะแม่</label><select id="pidMomTb"><option value="lt3">แม่รักษา &lt;3 เดือน / ไม่ตอบสนอง</option><option value="gt3">แม่รักษา &gt;3 เดือน และตอบสนองดี</option><option value="hres">แม่ดื้อ H</option><option value="hrres">แม่ดื้อ H และ R</option></select>`;
      o2.innerHTML = '';
    } else if (mode === 'oi') {
      o1.innerHTML = `<label class="pid-l">โรค</label><select id="pidOiType"><option value="pcp">PCP primary prophylaxis</option><option value="crypto">Cryptococcosis primary</option><option value="cryptosec">Cryptococcosis secondary</option><option value="talaro">Talaromycosis / Histo primary</option><option value="mac">MAC primary</option><option value="toxo">Toxoplasma primary</option></select>`;
      o2.innerHTML = '';
    } else {
      o1.innerHTML = ''; o2.innerHTML = '';
    }
    renderCalc();
  }

  function calcLine(name, mg, freq, ml, time, note) {
    return { name, mg: mg == null ? '' : r2(mg), freq, ml: ml == null ? '' : r2(ml), time: time || '', note: note || '' };
  }

  function calcResult() {
    const mode = val('pidCalcMode') || 'pmtct';
    const w = bw();
    const yrs = ageYears();
    const out = { lines: [], table: '', notes: [], warns: [] };
    if (mode === 'pmtct') {
      const risk = val('pidRisk') || 'standard';
      const g = num('pidBirthWt');
      const ga = num('pidGa');
      const band = PMTCT_T1.find(b => g >= b.min && g <= b.max);
      let azt, tc, nvp;
      if (band) { azt = band.azt; tc = band.tc; nvp = band.nvp; }
      else if (w > 0) { azt = 4 * w; tc = 2 * w; nvp = 4 * w; out.warns.push('น้ำหนักแรกคลอดอยู่นอกตารางที่ 1 (1,500-4,499 g) จึงคำนวณจาก BW วันนี้ x mg/kg'); }
      if (Number.isFinite(ga) && ga < 35 && w > 0) {
        azt = 2 * w;
        out.warns.push(`ทารกคลอดก่อนกำหนด GA ${ga} สัปดาห์: AZT 2 mg/kg ทุก 12 ชม. แล้วเพิ่มเป็นทุก 8 ชม. หลังอายุ ${ga < 30 ? 4 : 2} สัปดาห์`);
      }
      if (azt) out.lines.push(calcLine('AZT syrup 10 mg/mL', azt, 'BID', azt / 10, 'เช้า-เย็น x 4 สัปดาห์'));
      if (risk === 'high') {
        if (tc) out.lines.push(calcLine('3TC syrup 10 mg/mL', tc, 'BID', tc / 10, 'เช้า-เย็น x 4 สัปดาห์'));
        if (nvp) out.lines.push(calcLine('NVP syrup 10 mg/mL', nvp, 'OD', nvp / 10, 'วันละครั้ง x 4 สัปดาห์'));
        out.notes.push('High risk: ให้ยา 3 ตัวแก่ทารกเร็วที่สุด | ตรวจ PCR แรกเกิด, อายุ 1, 2 และ 4 เดือน');
      } else {
        out.notes.push('Standard risk: AZT 4 มก./กก. ทุก 12 ชม. นาน 4 สัปดาห์ เริ่มเร็วที่สุดหลังคลอด | ตรวจ PCR แรกเกิด, อายุ 1 และ 2-4 เดือน');
      }
      out.notes.push('ถ้า HIV DNA PCR แรกเกิดหรืออายุ 1 เดือนเป็นบวก: เปลี่ยน NVP ขนาดป้องกันเป็น LPV/r + AZT/3TC ขนาดรักษา (ตารางที่ 2) และเจาะ PCR ซ้ำทันทีก่อนเริ่มรักษา');
      out.table = `<table class="pid-t"><tr><th>น้ำหนักแรกคลอด (g)</th><th>AZT (10 mg/mL)</th><th>3TC (10 mg/mL)</th><th>NVP (10 mg/mL)</th></tr>${PMTCT_T1.map(b => `<tr${band === b ? ' style="background:#fef9c3"' : ''}><td>${b.min}-${b.max}</td><td>${b.azt} mg (${r1(b.azt / 10)} mL)</td><td>${b.tc} mg (${r1(b.tc / 10)} mL)</td><td>${b.nvp} mg (${r1(b.nvp / 10)} mL)</td></tr>`).join('')}</table>`;
      out.src = SRC_HIV + ' ตารางที่ 1';
    } else if (mode === 'inftx') {
      const band = w > 0 ? INF_T2.find(b => w > b.gt && w <= b.le) : null;
      if (w > 15 || (w > 0 && w <= 3)) out.warns.push('น้ำหนักอยู่นอกตารางที่ 2 (>3 ถึง 15 กก.)');
      if (w > 11 && w < 12) out.warns.push('ตารางที่ 2 ไม่มีช่วง 11-12 กก. แอปใช้แถว 12-15 กก. ให้ตรวจสอบ');
      if (band) {
        out.lines.push(calcLine('AZT syrup 10 mg/mL', band.azt * 10, 'BID', band.azt, 'เช้า-เย็น'));
        out.lines.push(calcLine('3TC syrup 10 mg/mL', band.tc * 10, 'BID', band.tc, 'เช้า-เย็น'));
        out.lines.push(calcLine('LPV/r syrup 80/20 mg/mL', band.lpv * 80, 'BID', band.lpv, 'เช้า-เย็น (mg = LPV)'));
        out.notes.push(`NVP เป็นทางเลือกรองเมื่อไม่มี LPV/r: ${band.nvp} mL เช้า-เย็น`);
      }
      const s = bsa();
      if (Number.isFinite(s)) out.notes.push(`BSA ${r2(s)} m² → AZT 180-240 mg/m² = ${Math.round(180 * s)}-${Math.round(240 * s)} mg/ครั้ง | LPV/r 300 mg/m² = ${Math.round(300 * s)} mg/ครั้ง | NVP 200 mg/m² = ${Math.round(200 * s)} mg/ครั้ง`);
      out.table = `<table class="pid-t"><tr><th>น้ำหนัก</th><th>AZT</th><th>3TC</th><th>LPV/r</th><th>NVP*</th></tr>${INF_T2.map(b => `<tr${band === b ? ' style="background:#fef9c3"' : ''}><td>${b.label}</td><td>${b.azt} mL</td><td>${b.tc} mL</td><td>${b.lpv} mL</td><td>${b.nvp} mL</td></tr>`).join('')}</table>`;
      out.src = SRC_HIV + ' ตารางที่ 2';
    } else if (mode === 'tbtx') {
      const reg = val('pidTbReg') || '2HRZE/4HR';
      if (w > 0) {
        const mk = (k, strength, unitNote) => {
          const t = TB_RANGE[k];
          const lo = Math.min(t.min * w, t.cap), hi = Math.min(t.max * w, t.cap);
          const mid = (lo + hi) / 2;
          const step = strength / 2;
          let pick = Math.round(mid / step) * step;
          if (pick < lo) pick += step;
          if (pick > hi) pick -= step;
          let halfTab = true;
          if (pick < lo || pick > hi || pick <= 0) { pick = Math.round(mid / 25) * 25; halfTab = false; }
          return { lo, hi, pick, strength, unitNote, halfTab };
        };
        const H = mk('H', 100), R = mk('R', 300), Z = mk('Z', 500), E = mk('E', 400);
        const tabs = (x, label) => x.halfTab ? `${r1(x.pick / x.strength)} เม็ด${label || ''}` : `ไม่มีขนาดครึ่งเม็ดที่ลงช่วง ให้บดแบ่ง/เตรียมยาน้ำ${label || ''}`;
        out.lines.push(calcLine('Isoniazid (INH) tab 100 mg', H.pick, 'OD', null, tabs(H)));
        {
          // capsules cannot be split: use 300 / 450 / 600 mg caps when one fits the range, else syrup 20 mg/mL
          const caps = [{ mg: 300, n: 'Rifampicin cap 300 mg', t: '1 แคปซูล' }, { mg: 450, n: 'Rifampicin cap 450 mg', t: '1 แคปซูล' }, { mg: 600, n: 'Rifampicin cap 300 mg', t: '2 แคปซูล' }]
            .filter(c => c.mg >= R.lo - 0.01 && c.mg <= R.hi + 0.01)
            .sort((a, b) => Math.abs(a.mg - (R.lo + R.hi) / 2) - Math.abs(b.mg - (R.lo + R.hi) / 2));
          if (caps.length) out.lines.push(calcLine(caps[0].n, caps[0].mg, 'OD', null, caps[0].t + ' ก่อนอาหาร'));
          else { const mg = Math.round((R.lo + R.hi) / 2 / 10) * 10; out.lines.push(calcLine('Rifampicin syrup 20 mg/mL', mg, 'OD', mg / 20, 'ก่อนอาหาร')); }
        }
        out.lines.push(calcLine('Pyrazinamide tab 500 mg', Z.pick, 'OD', null, tabs(Z, ' x 2 เดือนแรก')));
        out.lines.push(calcLine('Ethambutol tab 400 mg', E.pick, 'OD', null, tabs(E, ' x 2 เดือนแรก')));
        out.lines.push(calcLine('Vitamin B6 tab 50 mg', 50, 'OD', null, 'กินคู่ INH'));
        out.notes.push(`ช่วงขนาดที่ BW ${w} kg: INH ${Math.round(H.lo)}-${Math.round(H.hi)} mg/วัน (ยาน้ำ 10 mg/mL ${r1(H.pick / 10)} mL) | RIF ${Math.round(R.lo)}-${Math.round(R.hi)} mg/วัน (ยาน้ำ 20 mg/mL ${r1(R.pick / 20)} mL) | PZA ${Math.round(Z.lo)}-${Math.round(Z.hi)} mg/วัน | EMB ${Math.round(E.lo)}-${Math.round(E.hi)} mg/วัน`);
        out.notes.push(`High-dose INH 15-20 mg/kg = ${Math.round(Math.min(15 * w, 300))}-${Math.round(Math.min(20 * w, 300))} mg/วัน`);
        out.notes.push('ขนาดเม็ดที่เลือกเป็นค่ากลางช่วง ปัดเป็นครึ่งเม็ด แก้ mg ในรายการยาได้');
      }
      if (yrs >= 15) out.warns.push('อายุ ≥15 ปี: พิจารณาขนาดยาแบบผู้ใหญ่ (พบในชีท PID ว่าเคยเกิด DRP กรณีนี้)');
      out.notes.push(`${reg}: ${reg === '2HRZE/10HR' ? 'วัณโรคปอดชนิดแพร่กระจาย / ระบบประสาท / กระดูกและข้อ' : 'วัณโรคปอด / ต่อมน้ำเหลือง'}`);
      out.table = `<table class="pid-t"><tr><th>ยา</th><th>mg/kg/day</th><th>ยา (ดื้อยา)</th><th>mg/kg/day</th></tr>
        <tr><td>Isoniazid (high dose)</td><td>10-15 (15-20)</td><td>Clofazimine</td><td>2-5</td></tr>
        <tr><td>Rifampicin</td><td>10-20</td><td>Cycloserine*</td><td>15-20</td></tr>
        <tr><td>Pyrazinamide</td><td>30-40</td><td>Imipenem-cilastatin*</td><td>60-100</td></tr>
        <tr><td>Ethambutol</td><td>15-20</td><td>Meropenem*</td><td>60-120</td></tr>
        <tr><td>Levofloxacin</td><td>15-20</td><td>Ethionamide</td><td>15-20</td></tr>
        <tr><td>Moxifloxacin</td><td>10-15</td><td>PAS</td><td>200-300</td></tr>
        <tr><td>Bedaquiline</td><td>15-29 kg: 200 mg OD x2 wk → 100 mg OD x22 wk; ≥30 kg: 400 → 200 mg</td><td>Delamanid</td><td>3-5 ปี 25 mg BID; 6-11 ปี 50 mg BID; 12-17 ปี 100 mg BID</td></tr>
        <tr><td>Linezolid</td><td>10-12 (น้ำหนัก &gt;15 kg)</td><td>Amoxicillin/Clavulanate</td><td>*ให้ร่วมกับ carbapenem</td></tr></table>`;
      out.src = SRC_TB;
    } else if (mode === 'ltbi') {
      const reg = val('pidLtbiReg') || '3HP';
      const lt10 = !(yrs >= 10);
      if (reg === '3HP') {
        if (yrs < 2 || (w > 0 && w < 10)) out.warns.push('3HP ใช้อายุ 2-14 ปี และน้ำหนัก ≥10 kg');
        let H = null, P = null;
        if (yrs > 14 && w >= 30) { H = 900; P = 900; }
        else if (w >= 10 && w < 16) { H = 300; P = 300; }
        else if (w >= 16 && w < 24) { H = 500; P = 450; }
        else if (w >= 24 && w <= 30) { H = 600; P = 600; }
        else if (w > 30) { H = 700; P = 750; }
        if (H) {
          out.lines.push(calcLine('Isoniazid (INH) tab 100 mg', H, 'QW', null, 'สัปดาห์ละครั้ง x 12 ครั้ง'));
          out.lines.push(calcLine('Rifapentine tab 150 mg', P, 'QW', null, `สัปดาห์ละครั้ง x 12 ครั้ง (${r1(P / 150)} เม็ด)`));
        }
        out.table = `<table class="pid-t"><tr><th>3HP อายุ 2-14 ปี</th><th>H</th><th>P</th></tr><tr><td>10-15 kg</td><td>300</td><td>300</td></tr><tr><td>16-23 kg</td><td>500</td><td>450</td></tr><tr><td>24-30 kg</td><td>600</td><td>600</td></tr><tr><td>&gt;30 kg</td><td>700</td><td>750</td></tr><tr><td>อายุ &gt;14 ปี, ≥30 kg</td><td>900</td><td>900</td></tr></table>`;
      } else if (reg === '1HP') {
        if (!(yrs >= 13)) out.warns.push('1HP ใช้ในอายุ ≥13 ปี');
        out.lines.push(calcLine('Isoniazid (INH) tab 100 mg', 300, 'OD', null, 'วันละครั้ง x 28 วัน'));
        out.lines.push(calcLine('Rifapentine tab 150 mg', 600, 'OD', null, 'วันละครั้ง x 28 วัน (4 เม็ด)'));
      } else if (w > 0) {
        if (reg === '4R' || reg === '3HR') {
          const lo = lt10 ? 10 : 10, hi = lt10 ? 20 : 10;
          const R = Math.min(600, lt10 ? 15 * w : 10 * w);
          out.lines.push(calcLine('Rifampicin syrup 20 mg/mL', R, 'OD', R / 20, `${reg === '4R' ? '4' : '3'} เดือน (R ${lo}${hi !== lo ? '-' + hi : ''} mg/kg/day)`));
        }
        if (reg === '3HR' || reg === '6-9H') {
          const H = Math.min(300, lt10 ? 10 * w : 5 * w);
          out.lines.push(calcLine('Isoniazid (INH) syrup 10 mg/mL', H, 'OD', H / 10, `${reg === '3HR' ? '3' : '6-9'} เดือน (H ${lt10 ? '7.5-15' : '5'} mg/kg/day)`));
          out.lines.push(calcLine('Vitamin B6 tab 50 mg', 25, 'OD', null, 'ครึ่งเม็ด กินคู่ INH'));
        }
        out.notes.push(lt10 ? 'อายุ <10 ปี: H 7.5-15, R 10-20 mg/kg/day' : 'อายุ ≥10 ปี: H 5, R 10 mg/kg/day');
      }
      out.notes.push('LTBI: พิจารณารักษาเด็กอายุ <5 ปี หรือภูมิคุ้มกันบกพร่อง (เช่น HIV ทุกราย); อายุ >5 ปี เมื่อ IGRA / TST (+)');
      out.src = SRC_TB + ' (LTBI)';
    } else if (mode === 'infanttb') {
      const s = val('pidMomTb') || 'lt3';
      out.notes.push('ทารกทุกคนควรได้ BCG ตั้งแต่แรกเกิด (ครั้งเดียว)');
      if (s === 'gt3') out.notes.push('แม่รักษา >3 เดือนและตอบสนองดี: ไม่เสี่ยง ไม่ต้องให้ยาป้องกัน');
      else if (s === 'hrres') out.notes.push('แม่ดื้อ H และ R: ไม่แนะนำยาป้องกัน');
      else if (w > 0) {
        out.notes.push('ให้ยาป้องกันหลังเริ่ม BCG 3-7 วัน');
        if (s === 'hres') out.lines.push(calcLine('Rifampicin syrup 20 mg/mL', 15 * w, 'OD', 15 * w / 20, 'R 10-20 mg/kg/day x 4 เดือน'));
        else {
          out.lines.push(calcLine('Isoniazid (INH) syrup 10 mg/mL', 10 * w, 'OD', w, 'INH 10 mg/kg/day x 9 เดือน'));
          out.lines.push(calcLine('Vitamin B6', null, 'OD', null, 'Vit B6 1-2 mg/day'));
        }
      }
      out.src = SRC_TB + ' (การป้องกันแม่สู่ลูก)';
    } else if (mode === 'oi') {
      const t = val('pidOiType') || 'pcp';
      const s = bsa();
      if (t === 'pcp' && w > 0) {
        let tmp = 5 * w; if (Number.isFinite(s)) out.notes.push(`หรือ TMP 150 mg/m²/day = ${Math.round(150 * s)} mg/day`);
        tmp = Math.min(tmp, 320);
        out.lines.push(calcLine('Co-trimoxazole susp (TMP 40/SMX 200 per 5 mL)', tmp, 'OD', tmp / 8, 'TMP 5 mg/kg/day (ไม่เกิน 320) แบ่ง 1-2 ครั้ง กิน 3 วัน/สัปดาห์'));
        out.notes.push(`ทางเลือก: Dapsone 2 mg/kg OD = ${Math.min(r1(2 * w), 100)} mg (ไม่เกิน 100) หรือ 4 mg/kg สัปดาห์ละครั้ง = ${Math.min(r1(4 * w), 200)} mg`);
      } else if (t === 'crypto') {
        if (yrs < 12) out.notes.push('อายุ <12 ปี: ไม่แนะนำ Primary prophylaxis');
        else out.lines.push(calcLine('Fluconazole cap 100 mg', 400, 'QW', null, 'สัปดาห์ละครั้ง'));
      } else if (t === 'cryptosec' && w > 0) {
        out.lines.push(calcLine('Fluconazole susp 10 mg/mL', Math.min(6 * w, 200), 'OD', Math.min(6 * w, 200) / 10, '6 mg/kg (ไม่เกิน 200) OD'));
        out.notes.push(`ทางเลือก Itraconazole 5 mg/kg = ${Math.min(r1(5 * w), 200)} mg OD`);
      } else if (t === 'talaro' && w > 0) {
        out.lines.push(calcLine('Itraconazole', Math.min(5 * w, 200), 'OD', null, '5 mg/kg (ไม่เกิน 200) OD; ได้ Itraconazole แล้วไม่ต้องให้ Fluconazole ป้องกัน Crypto'));
      } else if (t === 'mac' && w > 0) {
        out.lines.push(calcLine('Azithromycin syrup 200 mg/5 mL', Math.min(20 * w, 1250), 'QW', Math.min(20 * w, 1250) / 40, '20 mg/kg (ไม่เกิน 1,250) สัปดาห์ละครั้ง'));
        out.notes.push(`หรือ Azithromycin 5 mg/kg OD = ${Math.min(r1(5 * w), 250)} mg (ไม่เกิน 250) | Clarithromycin 7.5 mg/kg BID = ${Math.min(r1(7.5 * w), 500)} mg`);
      } else if (t === 'toxo' && w > 0) {
        if (Number.isFinite(s)) out.lines.push(calcLine('Co-trimoxazole susp (TMP 40/SMX 200 per 5 mL)', 150 * s, 'OD', 150 * s / 8, 'TMP 150 mg/m²/day แบ่ง 1-2 ครั้ง หรือ 3 วัน/สัปดาห์'));
        else out.lines.push(calcLine('Co-trimoxazole susp (TMP 40/SMX 200 per 5 mL)', 6 * w, 'OD', 6 * w / 8, 'TMP 6 mg/kg/day (ใส่ส่วนสูงเพื่อคิด 150 mg/m²)'));
      }
      out.src = SRC_OI;
    }
    if (!(w > 0) && mode !== 'pmtct') out.warns.push('กรอก BW วันนี้เพื่อคำนวณ');
    return out;
  }

  let lastCalc = null;
  function renderCalc() {
    const box = $('pidCalcOut'); if (!box) return;
    const r = calcResult();
    lastCalc = r;
    const html = `
      ${r.lines.length ? `<table class="pid-t"><tr><th>ยา</th><th>ขนาด</th><th>ความถี่</th><th>วิธีใช้</th></tr>${r.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${l.mg !== '' ? esc(l.mg) + ' mg' : ''}${l.ml !== '' ? ' (' + esc(l.ml) + ' mL)' : ''}</td><td>${esc((FREQ_MAP[l.freq] || {}).l || l.freq)}</td><td>${esc(l.time)}</td></tr>`).join('')}</table>
      <div style="margin-top:6px"><button type="button" class="pid-btn sm" id="pidCalcAdd">ใส่ในรายการยา</button></div>` : ''}
      ${r.notes.map(n => `<p class="pid-note">• ${esc(n)}</p>`).join('')}
      ${r.warns.map(n => `<div class="pid-warnbox">⚠ ${esc(n)}</div>`).join('')}
      ${r.table || ''}
      ${r.src ? `<p class="pid-note">อ้างอิง: ${esc(r.src)}</p>` : ''}`;
    // only touch the DOM when the result changed, so a blur/change during a click does not swap the button away
    if (box.dataset.pidHtml !== html) { box.innerHTML = html; box.dataset.pidHtml = html; }
  }

  // ---------------------------------------------------------------
  // Adherence
  // ---------------------------------------------------------------
  function adherence() {
    const manual = val('pidAdhManual');
    if (manual) return { text: /%$/.test(manual) ? manual : manual + '%', pct: parseFloat(manual) };
    const a = num('pidAdhA'), c = num('pidAdhC'), b = num('pidAdhB');
    if (a >= 0 && c >= 0 && b > 0) {
      const p = (a - c) * 100 / b;
      return { text: r2(p) + '%', pct: p, how: 'นับเม็ด' };
    }
    const d = num('pidAdhDays'), n = num('pidAdhDoses') || 1, miss = num('pidAdhMissed');
    if (d > 0) {
      const due = d * n;
      const p = (due - (miss > 0 ? miss : 0)) * 100 / due;
      return { text: r2(p) + '%', pct: p, how: 'มื้อที่ลืม' };
    }
    return { text: '', pct: NaN };
  }

  // ---------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------
  function syncCaseFlags(e) {
    if (!e || !e.target || !/^pidCase_/.test(e.target.id || '')) return;
    const id = e.target.id.replace('pidCase_', '');
    const ct = CASE_TYPES.find(c => c.id === id);
    if (!ct) return;
    if (e.target.checked) {
      if (ct.tb && $('pidTb')) $('pidTb').checked = true;
      if (ct.hiv && $('pidHiv')) $('pidHiv').checked = true;
      const dx = $('pidDx');
      if (dx && id !== 'other') {
        const label = { pmtct: 'Case Maternal HIV', hivtx: 'Known Case HIV', pep: 'on PEP', tbtx: 'TB', ltbi: 'contact TB', ntm: 'NTM lymphadenitis', syph: 'Maternal syphilis', hbv: 'HBV infection (HBsAg positive)' }[id];
        if (label && !dx.value.toLowerCase().includes(label.toLowerCase())) dx.value = dx.value ? dx.value + ', ' + label : label;
      }
      const mode = { pmtct: 'pmtct', tbtx: 'tbtx', ltbi: 'ltbi' }[id];
      if (mode && $('pidCalcMode')) { $('pidCalcMode').value = mode; renderCalcOptions(); }
    }
  }

  function onAnyChange(e) {
    const t = e.target;
    // the alerts panel (pmk-alerts-copy.js) lives inside #form-PID and handles its own ticks
    if (t && t.closest && t.closest('.pmk-clinic-panel, .pmk-top-alert')) return;
    const rowEl = t && t.closest && t.closest('.pid-row[data-i]');
    if (rowEl && t.dataset.f) {
      const i = Number(rowEl.dataset.i);
      if (rows[i]) rows[i][t.dataset.f] = t.value;
      updateMgkg();
    }
    if (t && t.id === 'pidCalcMode' && e.type === 'change') { renderCalcOptions(); }
    else if (t && /^pid(Risk|BirthWt|Ga|TbReg|LtbiReg|MomTb|OiType|Bw|Ht|AgeY|AgeM|AgeD)$/.test(t.id || '')) { renderCalc(); updateMgkg(); }
    if (e.type === 'change') syncCaseFlags(e);
    // text/number fields already refreshed on 'input'; refreshing again on blur ('change') would
    // re-render the alerts panel mid-click and swallow a tick on the alert checkboxes
    if (e.type === 'change' && t && t.tagName === 'INPUT' && /^(text|number|search|)$/.test(t.type || '')) return;
    updateAll();
  }

  function onClick(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.pmk-clinic-panel, .pmk-top-alert')) return;
    const kb = t.closest('[data-pid-kb]');
    if (kb) { openKb(kb.dataset.pidKb); return; }
    if (t.id === 'pidAddRow') { rows.push(blankRow()); renderRows(); updateAll(); return; }
    const del = t.closest('[data-del]');
    if (del) { rows.splice(Number(del.dataset.del), 1); if (!rows.length) rows.push(blankRow()); renderRows(); updateAll(); return; }
    if (t.id === 'pidCalcAdd' && lastCalc) {
      rows = rows.filter(r => r.name || r.mg);
      lastCalc.lines.forEach(l => rows.push({ name: l.name, mg: l.mg === '' ? '' : String(l.mg), freq: l.freq, ml: l.ml === '' ? '' : String(l.ml), time: l.time }));
      if (!rows.length) rows.push(blankRow());
      renderRows(); updateAll();
      if (typeof window.showToast === 'function') window.showToast('ใส่ยาจากตัวคำนวณในรายการยาแล้ว');
    }
  }

  function currentTabValue() {
    try { return (typeof currentTab !== 'undefined') ? currentTab : window.currentTab; } catch (e) { return window.currentTab; }
  }
  function updateAll() {
    const a = adherence();
    if ($('pidAdhOut')) $('pidAdhOut').textContent = a.text || '-';
    if (currentTabValue() === 'PID' && typeof window.generateOutput === 'function') {
      try { window.generateOutput(); } catch (e) { console.warn('PID generateOutput', e); }
    }
  }

  // ---------------------------------------------------------------
  // Output builders
  // ---------------------------------------------------------------
  function drugLines() {
    return rows.filter(r => String(r.name || '').trim()).map(r => {
      const f = FREQ_MAP[r.freq] || FREQ_MAP.OD;
      const parts = [r.name.trim()];
      if (r.mg !== '' && r.mg != null) parts.push(r.mg + ' mg');
      if (r.ml !== '' && r.ml != null) parts.push('(' + r.ml + ' mL)');
      parts.push(f.v === 'OD' ? 'OD' : f.v === 'BID' ? 'q12h' : f.v === 'TID' ? 'q8h' : f.v === 'QW' ? 'สัปดาห์ละครั้ง' : '3 วัน/สัปดาห์');
      if (r.time) parts.push(r.time);
      const c = rowCheck(r);
      if (c.value != null && Number.isFinite(c.value)) parts.push('[' + fmt(c.value) + ' ' + c.unit + ']');
      return parts.join(' ');
    });
  }
  function labLine() {
    const p = [];
    if (val('pidCd4') || val('pidCd4p')) p.push('CD4 ' + (val('pidCd4') || '') + (val('pidCd4p') ? '(' + val('pidCd4p') + '%)' : ''));
    if (val('pidVl')) p.push('VL ' + val('pidVl'));
    if (val('pidPcr')) p.push('HIV DNA PCR ' + (val('pidPcrNo') ? val('pidPcrNo') + ' ' : '') + val('pidPcr'));
    if (val('pidScr')) p.push('Scr ' + val('pidScr'));
    if (val('pidHb')) p.push('Hb ' + val('pidHb'));
    if (val('pidLft')) p.push('AST/ALT ' + val('pidLft'));
    if (val('pidRpr')) p.push('RPR/VDRL ' + val('pidRpr'));
    if (val('pidTst')) p.push('TST/IGRA ' + val('pidTst'));
    if (val('pidLabOther')) p.push(val('pidLabOther'));
    if (!p.length) return '';
    return (val('pidLabDate') ? val('pidLabDate') + ' ' : '') + p.join(', ');
  }
  function pickedList(prefix, list) { return list.filter((_, i) => isChecked(prefix + i)); }
  function nextAppt() {
    const d = val('pidNext');
    const s = d ? toBE(d) : '';
    return [s, val('pidNextFor')].filter(Boolean).join(' ');
  }

  function buildNote() {
    const notes = ['pharmacist note ID clinic เด็ก (PID)'];
    const hdr = [];
    if (ageText()) hdr.push('อายุ ' + ageText());
    if (val('pidBw')) hdr.push('BW ' + val('pidBw') + ' kg' + (val('pidBwPrev') ? ' (เดิม ' + val('pidBwPrev') + ')' : ''));
    if (val('pidHt')) hdr.push('Ht ' + val('pidHt') + ' cm');
    if (hdr.length) notes.push(hdr.join(' '));
    if (val('pidDx')) notes.push('Dx/ปัญหา: ' + val('pidDx'));
    if (val('pidCc')) notes.push('CC: ' + val('pidCc'));
    const who = [];
    if (val('pidTime')) who.push('เวลากินยา ' + val('pidTime') + ' น.');
    if (val('pidCaregiver')) who.push('ผู้ดูแลให้ยา: ' + val('pidCaregiver'));
    if (val('pidBringer')) who.push('ผู้พามา: ' + val('pidBringer'));
    if (who.length) notes.push(who.join(' | '));
    if (val('pidAllergy')) notes.push('แพ้ยา: ' + val('pidAllergy'));
    const lab = labLine(); if (lab) notes.push('Lab: ' + lab);
    const dl = drugLines();
    if (dl.length) { notes.push('Medication:'); dl.forEach(l => notes.push('- ' + l)); }
    if (val('pidTbStart')) notes.push('TB drug start ' + val('pidTbStart'));
    const a = adherence();
    const adh = [];
    if (a.text) adh.push('%Adherence ' + a.text);
    if (val('pidAdhMissed')) adh.push('ลืม ' + val('pidAdhMissed') + ' มื้อ');
    if (val('pidAdhLate')) adh.push('ไม่ตรงเวลา ' + val('pidAdhLate') + ' ครั้ง');
    if (adh.length) notes.push(adh.join(', '));
    const drp = val('pidDrp');
    if (drp || val('pidDrpDetail')) notes.push('DRP: ' + [drp, val('pidDrpDetail')].filter(Boolean).join(' - '));
    if (val('pidMe') && val('pidMe') !== 'NO ME') notes.push('ME: ' + val('pidMe'));
    const fix = pickedList('pidFix', ADH_FIX);
    if (fix.length) notes.push('แก้ไข Adherence: ' + fix.join(', '));
    const coun = pickedList('pidCoun', COUNSEL);
    if (coun.length) notes.push('Counseling: ' + coun.join(', '));
    if (val('pidPlan')) notes.push('Plan: ' + val('pidPlan'));
    const nx = nextAppt(); if (nx) notes.push('นัดครั้งถัดไป: ' + nx);
    if (val('pidPharmName')) notes.push('/' + val('pidPharmName'));
    return notes;
  }

  const SHORT = { H: 'INH', R: 'RIF', Z: 'PZA', E: 'EMB', B6: 'B6', P: 'RPT', TLD: 'TLD', AZT3TC: 'AZT/3TC', LPV: 'LPV/r', DTG: 'DTG', AZT: 'AZT', '3TC': '3TC', NVP: 'NVP', TDF: 'TDF', EFV: 'EFV', SMX: 'Bactrim', FLU: 'Fluconazole' };
  function shortName(name) {
    const k = drugKey(name);
    if (SHORT[k]) return SHORT[k];
    return String(name || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\b(syrup|susp|tab|cap|dispersible)\b.*$/i, '').trim() || String(name || '').trim();
  }

  // Sheet row for tab PID: A..K (A date d/m/yy BE; cose.gs blanks it when the date equals the row above)
  function buildRow(dateStr) {
    const hn = val('hn');
    const name = val('ptName');
    const g = [];
    const dl = rows.filter(r => String(r.name || '').trim()).map(r => {
      const f = FREQ_MAP[r.freq] || FREQ_MAP.OD;
      return shortName(r.name) + (r.mg !== '' ? ' ' + r.mg + 'mg' : '') + (r.ml !== '' ? ' (' + r.ml + 'mL)' : '') + ' ' + f.v;
    });
    if (dl.length) g.push('on ' + dl.join(' + '));
    if (val('pidTbStart')) g.push('start ' + val('pidTbStart'));
    if (val('pidBw')) g.push('BW ' + val('pidBw') + ' kg' + (val('pidBwPrev') ? ' (เดิม ' + val('pidBwPrev') + ')' : ''));
    const a = adherence(); if (a.text) g.push('adherence ' + a.text);
    const lab = labLine(); if (lab) g.push(lab);
    if (val('pidPlan')) g.push('Plan ' + val('pidPlan'));
    const nx = nextAppt(); if (nx) g.push('นัด ' + nx);
    const k = [];
    if (val('pidDrpDetail')) k.push(val('pidDrpDetail'));
    const fix = pickedList('pidFix', ADH_FIX); if (fix.length) k.push('แก้ไข adherence: ' + fix.join(', '));
    const coun = pickedList('pidCoun', COUNSEL); if (coun.length) k.push('Advice: ' + coun.join(', '));
    if (val('pidRemark')) k.push(val('pidRemark'));
    return [
      sheetDate(),                       // A วันที่ (d/m/yy พ.ศ.)
      hn,                                // B HN
      name,                              // C ชื่อ
      isChecked('pidTb'),                // D TB
      isChecked('pidHiv'),               // E HIV
      val('pidDx'),                      // F โรค อื่นๆ (โปรดระบุ) / ปัญหา
      g.join(' | '),                     // G รายละเอียด
      val('pidDrp'),                     // H DRPs (dropdown)
      val('pidMe'),                      // I ME (dropdown)
      isChecked('pidSeen'),              // J พบเภสัช
      k.join(' | ')                      // K หมายเหตุ
    ];
  }

  // ---------------------------------------------------------------
  // Alerts (pmk-alerts-copy.js renders them with tick-to-note)
  // ---------------------------------------------------------------
  function evalAlerts() {
    const out = [];
    const w = bw(), yrs = ageYears(), months = ageMonths();
    const names = rows.filter(r => r.name).map(r => ({ r, key: drugKey(r.name) }));
    const has = k => names.some(n => n.key === k);
    names.forEach(({ r }) => {
      const c = rowCheck(r);
      if (!c.range || !Number.isFinite(c.value)) return;
      if (c.cls === 'hi') out.push({ level: (c.value > c.range.max * 1.25 ? 'danger' : 'warn'), title: `${r.name}: ขนาดยาสูงกว่าช่วง (${fmt(c.value)} ${c.unit})`, detail: `ช่วงแนะนำ ${c.range.soft ? c.range.min + '-' + c.range.soft + ' (ยอมได้ถึง ' + c.range.max + ')' : c.range.min + '-' + c.range.max} ${c.unit} ที่ BW ${w} kg — พิจารณา DRP "Too HIGH dosage"`, source: c.src });
      else if (c.cls === 'lo' && c.status === 'ต่ำกว่า') out.push({ level: 'warn', title: `${r.name}: ขนาดยาต่ำกว่าช่วง (${fmt(c.value)} ${c.unit})`, detail: `ช่วงแนะนำ ${c.range.min}-${c.range.max} ${c.unit} ที่ BW ${w} kg — พิจารณา DRP "Too LOW dosage"`, source: c.src });
      else if (c.cls === 'lo') out.push({ level: 'info', title: `${r.name}: เกิน ${c.range.soft} mg/kg/วัน`, detail: drugKey(r.name) === 'E' ? 'Ethambutol เกิน 15-20 mg/kg/day — ติดตามการมองเห็น' : 'อยู่ในช่วง high dose — ตรวจสอบข้อบ่งใช้', source: c.src });
    });
    if (has('H') && !has('B6')) out.push({ level: 'warn', title: 'ได้ INH แต่ยังไม่มี Vitamin B6', detail: 'ให้ Vitamin B6 ร่วมกับ INH เพื่อป้องกันปลายประสาทอักเสบ (แบบฟอร์มคลินิกใช้ B6 50 mg)', source: SRC_FORM });
    if (has('R') && (has('DTG') || has('TLD'))) {
      const dtgBid = names.some(n => (n.key === 'DTG' || n.key === 'TLD') && n.r.freq === 'BID') || names.filter(n => n.key === 'DTG' || n.key === 'TLD').length >= 2;
      if (!dtgBid) out.push({ level: 'warn', title: 'Rifampicin ร่วมกับ DTG', detail: 'Rifampicin ลดระดับ DTG ต้องให้ DTG วันละ 2 ครั้ง (เพิ่ม DTG อีก 1 มื้อห่าง 12 ชม.) ตลอดช่วงที่ได้ Rifampicin และ 2 สัปดาห์หลังหยุด', source: 'แนวทาง HIV ประเทศไทย / hivtb app' });
    }
    if (has('R') && has('LPV')) out.push({ level: 'warn', title: 'Rifampicin ร่วมกับ LPV/r', detail: 'Rifampicin ลดระดับ LPV/r มาก ต้องปรับ (super-boost ritonavir) หรือเปลี่ยนสูตร ปรึกษาแพทย์', source: 'แนวทาง HIV ประเทศไทย' });
    if (has('R') && has('NVP')) out.push({ level: 'warn', title: 'Rifampicin ร่วมกับ NVP', detail: 'Rifampicin ลดระดับ NVP ควรหลีกเลี่ยงการใช้ร่วมกัน ปรึกษาแพทย์', source: 'แนวทาง HIV ประเทศไทย' });
    if ((has('P')) && (has('LPV') || has('NVP'))) out.push({ level: 'warn', title: 'Rifapentine ร่วมกับ PI/NNRTI', detail: 'Rifapentine มีอันตรกิริยากับ LPV/r และ NVP — 3HP ใช้ร่วมกับ DTG ได้โดยไม่ต้องปรับ', source: SRC_TB });
    if (has('TDF') && w > 0 && w < 35 && !has('TLD')) out.push({ level: 'info', title: 'TDF ในเด็กน้ำหนัก <35 kg', detail: 'ตรวจสอบขนาด TDF ตามน้ำหนักและติดตาม Scr / UA protein', source: 'hivtb app' });
    if (has('TLD') && w > 0 && w < 30) out.push({ level: 'warn', title: 'TLD ในเด็กน้ำหนัก <30 kg', detail: 'TLD เม็ดผู้ใหญ่ (TDF 300/3TC 300/DTG 50) — ตรวจสอบเกณฑ์น้ำหนักก่อนใช้', source: 'hivtb app (TLD สำหรับ ≥30 kg)' });
    if (['H', 'R', 'Z', 'E'].some(has) && yrs >= 15) out.push({ level: 'warn', title: 'อายุ ≥15 ปี ได้ยา TB', detail: 'พิจารณาปรับเป็นขนาดยาผู้ใหญ่ (เคยพบ DRP กรณีนี้ในชีท PID)', source: 'ชีท PID / แนวทาง TB' });
    if (val('pidPcr') === 'Positive') out.push({ level: 'danger', title: 'HIV DNA PCR เป็นบวก', detail: 'เปลี่ยนจากขนาดป้องกันเป็นขนาดรักษา (LPV/r + AZT + 3TC ตามตารางที่ 2) และเจาะ PCR ซ้ำทันทีเพื่อยืนยันก่อนเริ่มรักษา', source: SRC_HIV });
    if (caseOn('pmtct') && Number.isFinite(months) && months < 2) {
      const high = val('pidRisk') === 'high';
      out.push({ level: 'info', title: 'นัดตรวจ HIV DNA PCR', detail: high ? 'High risk: ตรวจ PCR แรกเกิด, อายุ 1, 2 และ 4 เดือน' : 'Standard risk: ตรวจ PCR แรกเกิด, อายุ 1 และ 2-4 เดือน', source: SRC_HIV });
    }
    const a = adherence();
    if (Number.isFinite(a.pct) && a.pct < 95) out.push({ level: 'warn', title: `Adherence ${a.text} (< 95%)`, detail: 'ค้นหาสาเหตุ ให้คำปรึกษาผู้ดูแล และพิจารณา DRP "Non-compliance"', source: SRC_FORM });
    if (Number.isFinite(a.pct) && a.pct > 105) out.push({ level: 'info', title: `Adherence ${a.text} (> 100%)`, detail: 'ตรวจสอบการนับยา (ยาเหลือน้อยกว่าที่ควร อาจกินเกินหรือยาหาย)', source: SRC_FORM });
    const prev = num('pidBwPrev');
    if (w > 0 && prev > 0 && Math.abs(w - prev) / prev >= 0.1 && names.length) out.push({ level: 'info', title: `น้ำหนักเปลี่ยน ${fmt(prev)} → ${fmt(w)} kg`, detail: 'ทบทวนขนาดยาตามน้ำหนักใหม่ (ชีท PID มีหลายเคสที่ BW เพิ่มแล้วต้องปรับยา)', source: 'ชีท PID' });
    if (val('pidLtbiReg') === '3HP' && val('pidCalcMode') === 'ltbi' && (yrs < 2 || (w > 0 && w < 10))) out.push({ level: 'warn', title: '3HP ไม่เหมาะกับอายุ/น้ำหนักนี้', detail: '3HP ใช้อายุ ≥2 ปี และน้ำหนัก ≥10 kg', source: SRC_TB });
    if (caseOn('tbtx') && has('H') && has('R') && !has('Z') && !val('pidTbStart')) out.push({ level: 'info', title: 'ระบุวันเริ่มยา TB', detail: 'ใส่วันเริ่ม (Start) เพื่อคำนวณระยะ intensive / continuation', source: SRC_FORM });
    return out;
  }

  // ---------------------------------------------------------------
  // A5 caregiver handout (pmk-patient-print.js asks for this)
  // ---------------------------------------------------------------
  function collectPrint() {
    const medRows = rows.filter(r => String(r.name || '').trim()).map(r => {
      const f = FREQ_MAP[r.freq] || FREQ_MAP.OD;
      const dose = [r.mg !== '' ? r.mg + ' mg' : '', r.ml !== '' ? r.ml + ' mL' : ''].filter(Boolean).join(' / ') || '-';
      return [r.name, dose, f.l + (r.time ? ' ' + r.time : '')];
    });
    const advice = [
      'ให้ยาเด็กตรงเวลาทุกวัน' + (val('pidTime') ? ' (เวลา ' + val('pidTime') + ' น.)' : '') + ' ห้ามหยุดยาเอง',
      'ยาน้ำ: ตวงด้วยไซริงค์ตามปริมาตรที่เภสัชกรแนะนำ เขย่าขวดก่อนใช้ หากเด็กอาเจียนภายใน 30 นาทีหลังกินยา ให้ปรึกษาเภสัชกร',
      'นำยาที่เหลือทั้งหมดมาด้วยทุกครั้งที่มาตามนัด เพื่อนับยา'
    ];
    const keys = rows.map(r => drugKey(r.name));
    if (keys.includes('R') || keys.includes('P')) advice.push('Rifampicin / Rifapentine ทำให้ปัสสาวะ น้ำตา เหงื่อ เป็นสีส้มได้ ไม่เป็นอันตราย');
    if (keys.includes('H')) advice.push('INH: หากมีตัวเหลือง ตาเหลือง คลื่นไส้อาเจียนมาก หรือชาปลายมือปลายเท้า ให้กลับมาพบแพทย์');
    if (keys.includes('E')) advice.push('Ethambutol: หากเด็กมองเห็นผิดปกติหรือแยกสีไม่ได้ ให้กลับมาพบแพทย์');
    if (keys.includes('DTG') || keys.includes('TLD')) advice.push('DTG / TLD: กินห่างจากนม แคลเซียม ธาตุเหล็ก ยาลดกรด อย่างน้อย 2 ชั่วโมงก่อน หรือ 6 ชั่วโมงหลัง');
    if (keys.includes('AZT')) advice.push('AZT อาจทำให้ซีด หากเด็กซีด อ่อนเพลียผิดปกติ ให้มาพบแพทย์');
    pickedList('pidCoun', COUNSEL).forEach(c => advice.push('ได้รับคำแนะนำเรื่อง: ' + c));
    const follow = [];
    const nx = nextAppt(); if (nx) follow.push('นัดครั้งถัดไป: ' + nx);
    if (val('pidPlan')) follow.push('แผนการรักษา: ' + val('pidPlan'));
    if (caseOn('pmtct')) follow.push(val('pidRisk') === 'high' ? 'ตรวจเลือด HIV PCR: แรกเกิด, อายุ 1, 2 และ 4 เดือน' : 'ตรวจเลือด HIV PCR: แรกเกิด, อายุ 1 และ 2-4 เดือน');
    return { date: '', headers: ['ชื่อยา', 'ขนาด', 'วิธีใช้ / เวลา'], rows: medRows, advice, follow };
  }

  function reset() {
    rows = [blankRow()];
    renderRows();
    if ($('pidSeen')) $('pidSeen').checked = true;
    if ($('pidCalcMode')) { $('pidCalcMode').value = 'pmtct'; renderCalcOptions(); }
    const a = $('pidAdhOut'); if (a) a.textContent = '-';
  }

  // public API used by index.html / alerts / print
  window.pmkPidRender = render;
  window.pmkPidBuildNote = buildNote;
  window.pmkPidBuildRow = buildRow;
  window.pmkPidEvalAlerts = evalAlerts;
  window.pmkPidCollectPrint = collectPrint;
  window.pmkPidReset = reset;
  window.pmkPidPharmName = () => val('pidPharmName');
  window.pmkPidDebug = { rowCheck, calcResult, adherence, get rows() { return rows; }, PMTCT_T1, INF_T2, TB_RANGE };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
