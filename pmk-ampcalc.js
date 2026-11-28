/* Helper tool (not a clinic): one-day drip order -> ampoules to dispense, for Morphine and Fentanyl infusions.
 * Ported from apps-npr/morphine and apps-npr/fentanyl, with a 24 / 12 / 8 hr bag-duration selector.
 * Lives in clinic 14 (Pain management) as the sub-tab "คำนวณ amp/วัน".
 * Math (pure functions on window.pmkAmpCalc, unit-tested):
 *   Morphine : mg/hr = cc/hr / (ml per 1 mg); mg per bag = mg/hr x hours; drip amps = ceil(mg per bag / 10 mg per amp)
 *   Fentanyl : mcg per bag = mcg/hr x hours; amps from mcg needed (not whole 100 ml bottles);
 *              L amp 500 mcg/10 ml, S amp 100 mcg/2 ml; mixed volume = mcg / conc (ml)
 *   Bolus/PRN: dose x max times/day, then round up to amps (same strength / L+S mode), added to the daily total
 *   One day  = 24 h split into bags of the chosen duration (last bag may be shorter); each bag rounds up on its own.
 */
(function () {
  'use strict';
  const EPS = 1e-9;
  const MORPHINE_MG_PER_AMP = 10;      // morphine inj 10 mg/ml, 1 ml amp (AMBU confirmed)
  const FENT_BOTTLE_ML = 100;
  const FENT_L_MCG = 500, FENT_S_MCG = 100;
  const ceilE = (x) => Math.ceil(x - EPS);
  const round = (x, d) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
  const pos = (v) => { const n = Number(v); return n > 0 ? n : 0; };

  function bagPlan(hours, dayHours) {
    dayHours = dayHours || 24;
    const bags = [];
    let left = dayHours;
    while (left > EPS) { const h = Math.min(hours, left); bags.push(round(h, 4)); left = round(left - h, 6); }
    return bags;
  }

  function morphineBag(mgHr, h) {
    const mg = mgHr * h;
    const amps = ceilE(mg / MORPHINE_MG_PER_AMP);
    return { hours: h, mg, amps, preparedMg: amps * MORPHINE_MG_PER_AMP };
  }
  function morphineBolus(dose, times) {
    const d = pos(dose), t = pos(times);
    if (!d || !t) return { used: false, dose: 0, times: 0, mg: 0, amps: 0, preparedMg: 0, wasteMg: 0 };
    const mg = d * t;
    const amps = ceilE(mg / MORPHINE_MG_PER_AMP);
    return { used: true, dose: d, times: t, mg, amps, preparedMg: amps * MORPHINE_MG_PER_AMP, wasteMg: round(amps * MORPHINE_MG_PER_AMP - mg, 6) };
  }
  // opts: { ccHr | mgHr, mlPerMg, hours, source, bolusDose, bolusTimes }
  function morphine(opts) {
    const bolus = morphineBolus(opts.bolusDose, opts.bolusTimes);
    const mlPerMg = Number(opts.mlPerMg);
    let ccHr = Number(opts.ccHr), mgHr = Number(opts.mgHr);
    if (opts.source === 'mg') ccHr = mgHr * (mlPerMg > 0 ? mlPerMg : NaN);
    else if (mlPerMg > 0) mgHr = ccHr / mlPerMg;
    const hasDrip = (opts.source === 'mg' ? pos(opts.mgHr) : pos(opts.ccHr)) > 0;
    if (!hasDrip && !bolus.used) return { error: 'ใส่ rate (cc/hr หรือ mg/hr) หรือ bolus/PRN ให้ถูกต้อง' };
    if (hasDrip && !(mlPerMg > 0)) return { error: 'ใส่ความเข้มข้น (ml ต่อ 1 mg) ให้ถูกต้อง' };
    const hours = Number(opts.hours);
    if (hasDrip && !(hours > 0 && hours <= 24)) return { error: 'ระยะเวลาต้องอยู่ระหว่าง 1–24 ชั่วโมง' };

    const bags = hasDrip ? bagPlan(hours).map((h) => morphineBag(mgHr, h)) : [];
    const ampsDay = bags.reduce((s, b) => s + b.amps, 0);
    const usedDripMg = hasDrip ? mgHr * 24 : 0;
    const preparedDripMg = ampsDay * MORPHINE_MG_PER_AMP;
    const usedDayMg = usedDripMg + bolus.mg;
    const preparedDayMg = preparedDripMg + bolus.preparedMg;
    const totalAmps = ampsDay + bolus.amps;
    return {
      drug: 'morphine', hasDrip, ccHr: hasDrip ? ccHr : 0, mgHr: hasDrip ? mgHr : 0, mlPerMg, hours: hasDrip ? hours : 0, bags,
      ampsPerBag: bags[0] ? bags[0].amps : 0, mgPerBag: bags[0] ? bags[0].mg : 0, volPerBag: hasDrip ? ccHr * bags[0].hours : 0,
      ampsDay, usedDripMg, usedDayMg, preparedDayMg, totalAmps, bolus,
      wasteDayMg: round(preparedDayMg - usedDayMg, 6), volDay: hasDrip ? ccHr * 24 : 0
    };
  }

  function fentAmps(mcg, mode) {
    let big = 0, small = 0;
    if (mode === 'L') big = ceilE(mcg / FENT_L_MCG);
    else if (mode === 'S') small = ceilE(mcg / FENT_S_MCG);
    else { big = Math.floor(mcg / FENT_L_MCG + EPS); small = ceilE((mcg - big * FENT_L_MCG) / FENT_S_MCG); }
    const prepared = big * FENT_L_MCG + small * FENT_S_MCG;
    return { big, small, prepared };
  }
  function fentBag(rate, h, mode) {
    const mcg = rate * h;
    const a = fentAmps(mcg, mode);
    return { hours: h, mcg, prepared: a.prepared, big: a.big, small: a.small };
  }
  function fentanylBolus(dose, times, mode) {
    const d = pos(dose), t = pos(times);
    if (!d || !t) return { used: false, dose: 0, times: 0, mcg: 0, big: 0, small: 0, prepared: 0, wasteMcg: 0 };
    const mcg = d * t;
    const a = fentAmps(mcg, mode);
    return { used: true, dose: d, times: t, mcg, big: a.big, small: a.small, prepared: a.prepared, wasteMcg: round(a.prepared - mcg, 6) };
  }
  // opts: { rate (mcg/hr), conc (mcg/ml), hours, mode: 'SL'|'S'|'L', bolusDose, bolusTimes }
  function fentanyl(opts) {
    const rate = Number(opts.rate), conc = Number(opts.conc), hours = Number(opts.hours);
    const mode = opts.mode || 'SL';
    const bolus = fentanylBolus(opts.bolusDose, opts.bolusTimes, mode);
    const hasDrip = pos(opts.rate) > 0;
    if (!hasDrip && !bolus.used) return { error: 'ใส่อัตรา drip (mcg/hr) หรือ bolus/PRN ให้ถูกต้อง' };
    if (hasDrip && !(conc > 0)) return { error: 'เลือกความเข้มข้น' };
    if (hasDrip && !(hours > 0 && hours <= 24)) return { error: 'ระยะเวลาต้องอยู่ระหว่าง 1–24 ชั่วโมง' };
    const bags = hasDrip ? bagPlan(hours).map((h) => fentBag(rate, h, mode)) : [];
    const sum = (k) => bags.reduce((s, b) => s + b[k], 0);
    const mlHr = hasDrip && conc > 0 ? rate / conc : 0;
    const usedDripMcg = hasDrip ? rate * 24 : 0;
    const preparedDripMcg = sum('prepared');
    return {
      drug: 'fentanyl', hasDrip, rate: hasDrip ? rate : 0, conc: hasDrip ? conc : 0, hours: hasDrip ? hours : 0, mode, bags, mlHr, bolus,
      bottleRunHr: mlHr > 0 ? FENT_BOTTLE_ML / mlHr : 0,
      volPerBag: bags[0] ? mlHr * bags[0].hours : 0,
      bigDay: sum('big'), smallDay: sum('small'),
      totalBig: sum('big') + bolus.big, totalSmall: sum('small') + bolus.small,
      usedDripMcg, usedDayMcg: usedDripMcg + bolus.mcg,
      preparedDayMcg: preparedDripMcg + bolus.prepared,
      wasteDayMcg: round(preparedDripMcg + bolus.prepared - usedDripMcg - bolus.mcg, 6),
      volDay: mlHr * 24
    };
  }
  function compare(drug, opts) {
    return [24, 12, 8].map((h) => {
      const r = drug === 'morphine' ? morphine(Object.assign({}, opts, { hours: h })) : fentanyl(Object.assign({}, opts, { hours: h }));
      return { hours: h, r };
    });
  }

  // ------------------------------------------------------------------ UI
  const $ = (id) => document.getElementById(id);
  const num = (id) => { const v = parseFloat(($(id) || {}).value); return Number.isFinite(v) ? v : NaN; };
  const fmt = (x, d) => (Number.isFinite(x) ? String(round(x, d == null ? 2 : d)) : '-');
  const st = { drug: 'morphine', hours: 24, source: 'cc', custom: false };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function ampTxt(b, s) { return `L ${b} + S ${s}`; }

  function render(rootId) {
    const root = $(rootId || 'ampCalcRoot');
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = '1';
    root.innerHTML = `
    <div class="amp-wrap">
      <div class="amp-card">
        <h4 class="amp-h">เครื่องมือคำนวณ amp ยา drip ต่อวัน (Morphine / Fentanyl)</h4>
        <p class="amp-sub">ใส่ rate จากคำสั่งแพทย์ แล้วเลือกว่าเตรียมยาให้ใช้ถุงละกี่ชั่วโมง ระบบรวม amp ที่ต้องจ่ายต่อ 1 วัน (24 ชม.) รวม bolus/PRN ถ้ามี Fentanyl นับจาก mcg ที่ใช้จริง ไม่นับเป็นขวด 100 ml เต็ม</p>
        <div class="amp-seg" role="tablist" aria-label="ชนิดยา">
          <button type="button" class="amp-seg-btn active" data-amp-drug="morphine" onclick="window.pmkAmpCalc.setDrug('morphine')">Morphine</button>
          <button type="button" class="amp-seg-btn" data-amp-drug="fentanyl" onclick="window.pmkAmpCalc.setDrug('fentanyl')">Fentanyl</button>
        </div>

        <div id="ampMorph" class="amp-grid">
          <label class="amp-f"><span>ความเข้มข้นที่ผสม</span>
            <select id="ampConc" onchange="window.pmkAmpCalc.concChange()">
              <option value="10">1 mg : 10 ml</option>
              <option value="5">1 mg : 5 ml</option>
              <option value="custom">กำหนดเอง</option>
            </select>
          </label>
          <label class="amp-f hidden" id="ampCustomWrap"><span>ml ต่อ 1 mg</span><input id="ampCustomConc" type="number" min="0" step="any" inputmode="decimal" oninput="window.pmkAmpCalc.concChange()"></label>
          <label class="amp-f"><span>Rate (cc/hr)</span><input id="ampCc" type="number" min="0" step="any" inputmode="decimal" oninput="window.pmkAmpCalc.edit('cc')"></label>
          <label class="amp-f"><span>หรือ mg/hr</span><input id="ampMg" type="number" min="0" step="any" inputmode="decimal" oninput="window.pmkAmpCalc.edit('mg')"></label>
          <label class="amp-f"><span>eGFR (ถ้ามี)</span><input id="ampEgfr" type="number" min="0" step="any" inputmode="decimal" oninput="window.pmkAmpCalc.calc()"></label>
        </div>

        <div id="ampFent" class="amp-grid hidden">
          <label class="amp-f"><span>อัตรา drip (mcg/hr)</span><input id="ampRate" type="number" min="0" step="any" inputmode="decimal" value="50" oninput="window.pmkAmpCalc.calc()"></label>
          <label class="amp-f"><span>ความเข้มข้นที่ผสม</span>
            <select id="ampFConc" onchange="window.pmkAmpCalc.calc()">
              <option value="5">5 mcg/ml</option>
              <option value="10">10 mcg/ml</option>
            </select>
          </label>
          <label class="amp-f"><span>วิธีเลือก amp (L = 500 mcg, S = 100 mcg)</span>
            <select id="ampFMode" onchange="window.pmkAmpCalc.calc()">
              <option value="SL">L + S</option>
              <option value="L">L only</option>
              <option value="S">S only</option>
            </select>
          </label>
        </div>

        <div class="amp-dur">
          <span class="amp-dur-label">ถุงหนึ่งชุดใช้กี่ชั่วโมง</span>
          <div class="amp-seg" id="ampDur" role="group" aria-label="ระยะเวลาต่อชุด">
            <button type="button" class="amp-seg-btn active" data-amp-h="24" onclick="window.pmkAmpCalc.setHours(24)">24 ชม.</button>
            <button type="button" class="amp-seg-btn" data-amp-h="12" onclick="window.pmkAmpCalc.setHours(12)">12 ชม.</button>
            <button type="button" class="amp-seg-btn" data-amp-h="8" onclick="window.pmkAmpCalc.setHours(8)">8 ชม.</button>
            <button type="button" class="amp-seg-btn" data-amp-h="custom" onclick="window.pmkAmpCalc.setHours('custom')">อื่นๆ</button>
          </div>
          <label class="amp-f amp-custom hidden" id="ampHoursWrap"><span>ชั่วโมง (1–24)</span><input id="ampHours" type="number" min="1" max="24" step="any" inputmode="decimal" value="24" oninput="window.pmkAmpCalc.calc()"></label>
        </div>

        <div class="amp-bolus">
          <span class="amp-dur-label">Bolus / PRN (ถ้ามี) — นับรวมในยอด amp ต่อวัน ตามขนาด × ครั้งสูงสุดต่อวัน แล้วปัดขึ้น</span>
          <div class="amp-grid">
            <label class="amp-f"><span id="ampBolusUnit">ขนาดต่อครั้ง (mg)</span><input id="ampBolusDose" type="number" min="0" step="any" inputmode="decimal" oninput="window.pmkAmpCalc.calc()"></label>
            <label class="amp-f"><span>ครั้งสูงสุด / วัน</span><input id="ampBolusTimes" type="number" min="0" step="1" inputmode="numeric" oninput="window.pmkAmpCalc.calc()"></label>
          </div>
        </div>
      </div>

      <div id="ampResult" class="amp-card amp-result" aria-live="polite"></div>
      <div id="ampCompare" class="amp-card"></div>

      <details class="amp-card amp-notes">
        <summary>แนวทางเบิก-จ่าย และอายุยาผสม (สรุปจากแนวปฏิบัติ รพ./ต่างประเทศ)</summary>
        <ul>
          <li><b>อายุยาผสม (hang time):</b> เอกสาร รพ./ประเทศที่เผยแพร่ให้ใช้ morphine และ fentanyl ที่ผสมแล้วภายใน <b>24 ชม.</b> จึงตั้งค่าเริ่มต้นเป็น 24 ชม. ส่วน 12 หรือ 8 ชม. ใช้เมื่อ รพ. กำหนดเปลี่ยนถุงทุก 12 ชม./ทุกเวร</li>
          <li><b>ผสมนอกห้อง ISO 5 (ผสมที่ตึก):</b> มาตรฐาน USP &lt;797&gt; ถือเป็น immediate-use ต้องเริ่มให้ภายใน 4 ชม. ถ้าจะแขวน 24 ชม. ต้องผสมโดยเภสัชกรในห้องปลอดเชื้อหรือเป็นไปตามนโยบาย รพ.</li>
          <li><b>ความเข้มข้น:</b> ISMP แนะนำให้ใช้ความเข้มข้นมาตรฐานน้อยที่สุด (ไม่เกิน 2 ต่อยา) และไม่ต่างกัน 10 เท่า ถ้าเป็นไปได้ใช้เพียงค่าเดียวต่อหน่วยงาน</li>
          <li><b>Fentanyl นับ amp จาก mcg ที่ใช้จริง</b> (ปัดขึ้นต่อชุด) ไม่นับเป็นขวด 100 ml เต็ม ปริมาตรที่ผสม = mcg ÷ ความเข้มข้น ควรผสมเท่าที่ใช้ ไม่ต้องเติมอีกให้ครบขวด</li>
          <li><b>Bolus / PRN:</b> รวมในยอดต่อวัน จากขนาดต่อครั้ง × จำนวนครั้งสูงสุดต่อวัน แล้วปัดขึ้นเป็น amp (ไม่ปัดทีละเข็ม)</li>
          <li><b>การเบิก-จ่าย (ยาเสพติดประเภท 2):</b> สั่งในใบ ย.ส.5 ระบุชื่อ ความแรง วิธีให้ และจำนวน amp · พยาบาลคืนซาก amp ทุกครั้ง · เภสัชกรตรวจ ย.ส.5/ใบสั่ง/ซากยา แล้วลงนามผู้จ่าย–ผู้รับ</li>
          <li><b>ยาเหลือ/ทิ้งยา:</b> บันทึกจำนวนที่ใช้และจำนวนที่ทิ้ง ลงนามพยาน 2 คน ทุกครั้ง ยอดคงเหลือส่งต่อทุกเวร</li>
          <li>ผลการปัดเศษ: ปัดขึ้นเป็น amp เต็มต่อ 1 ชุด ชุดสั้นลง (8 ชม.) จึงมีเศษยาสะสมมากกว่าชุดยาว (24 ชม.) ดูตารางเปรียบเทียบด้านบน</li>
        </ul>
      </details>
    </div>`;
    calc();
  }

  function mlPerMgNow() {
    const v = $('ampConc').value;
    return v === 'custom' ? parseFloat($('ampCustomConc').value) : parseFloat(v);
  }
  function hoursNow() { return st.custom ? num('ampHours') : st.hours; }

  function setDrug(d) {
    st.drug = d;
    document.querySelectorAll('[data-amp-drug]').forEach((b) => b.classList.toggle('active', b.dataset.ampDrug === d));
    $('ampMorph').classList.toggle('hidden', d !== 'morphine');
    $('ampFent').classList.toggle('hidden', d !== 'fentanyl');
    if ($('ampBolusUnit')) $('ampBolusUnit').textContent = d === 'fentanyl' ? 'ขนาดต่อครั้ง (mcg)' : 'ขนาดต่อครั้ง (mg)';
    calc();
  }
  function setHours(h) {
    st.custom = h === 'custom';
    if (!st.custom) st.hours = h;
    document.querySelectorAll('[data-amp-h]').forEach((b) => b.classList.toggle('active', String(b.dataset.ampH) === String(h)));
    $('ampHoursWrap').classList.toggle('hidden', !st.custom);
    calc();
  }
  function syncMorph() {
    const k = mlPerMgNow();
    if (st.source === 'cc') {
      const cc = num('ampCc');
      $('ampMg').value = Number.isFinite(cc) && k > 0 ? String(round(cc / k, 4)) : '';
    } else {
      const mg = num('ampMg');
      $('ampCc').value = Number.isFinite(mg) && k > 0 ? String(round(mg * k, 4)) : '';
    }
  }
  function edit(src) { st.source = src; syncMorph(); calc(); }
  function concChange() {
    $('ampCustomWrap').classList.toggle('hidden', $('ampConc').value !== 'custom');
    syncMorph(); calc();
  }

  function readOpts() {
    const bolus = { bolusDose: num('ampBolusDose'), bolusTimes: num('ampBolusTimes') };
    if (st.drug === 'morphine') return Object.assign({ ccHr: num('ampCc'), mgHr: num('ampMg'), mlPerMg: mlPerMgNow(), source: st.source }, bolus);
    return Object.assign({ rate: num('ampRate'), conc: num('ampFConc'), mode: $('ampFMode').value }, bolus);
  }
  function run(opts, hours) {
    return st.drug === 'morphine' ? morphine(Object.assign({}, opts, { hours })) : fentanyl(Object.assign({}, opts, { hours }));
  }

  let lastText = '';
  function calc() {
    const res = $('ampResult'), cmp = $('ampCompare');
    if (!res) return;
    const opts = readOpts();
    const hours = hoursNow();
    const r = run(opts, hours);
    if (r.error) {
      res.innerHTML = `<div class="amp-empty">${esc(r.error)}</div>`; cmp.innerHTML = ''; lastText = ''; return;
    }
    let html = '', text = '';
    if (r.drug === 'morphine') {
      const lines = [];
      if (r.hasDrip) {
        const b0 = r.bags[0], nBags = r.bags.length;
        const shortLast = nBags > 1 && r.bags[nBags - 1].hours !== r.bags[0].hours;
        const ampList = r.bags.map((b) => b.amps).join(' + ');
        lines.push(`<div>Drip: ${fmt(r.ccHr, 3)} cc/hr (1 mg : ${fmt(r.mlPerMg, 3)} ml) = ${fmt(r.mgHr, 3)} mg/hr</div>`);
        lines.push(`<div>ชุดละ ${fmt(b0.hours)} ชม.: ${fmt(r.mgHr, 3)} mg/hr × ${fmt(b0.hours)} hr = ${fmt(b0.mg, 2)} mg → ${fmt(b0.mg, 2)} ÷ ${MORPHINE_MG_PER_AMP} = ${fmt(b0.mg / MORPHINE_MG_PER_AMP, 2)} → ปัดขึ้น <b>${b0.amps} amp</b></div>`);
        lines.push(`<div>ปริมาตรที่ให้ต่อชุด = ${fmt(r.volPerBag, 1)} ml</div>`);
        lines.push(`<div>Drip 1 วัน = ${nBags} ชุด${shortLast ? ` (ชุดสุดท้าย ${fmt(r.bags[nBags - 1].hours)} ชม.)` : ''}: ${ampList} = <b>${r.ampsDay} amp</b> (amp ละ 10 mg/1 ml)</div>`);
      }
      if (r.bolus.used) {
        lines.push(`<div>Bolus/PRN: ${fmt(r.bolus.dose, 3)} mg × ${fmt(r.bolus.times, 0)} ครั้ง/วัน = ${fmt(r.bolus.mg, 2)} mg → ปัดขึ้น <b>${r.bolus.amps} amp</b></div>`);
      }
      lines.push(`<div>ใช้จริง ${fmt(r.usedDayMg, 2)} mg/วัน · จ่าย ${fmt(r.preparedDayMg, 0)} mg · เศษที่ต้องทิ้ง/คืน ${fmt(r.wasteDayMg, 2)} mg (บันทึกพยาน 2 คน)</div>`);
      html = `
        <div class="amp-big"><span class="amp-big-n">${r.totalAmps}</span><span class="amp-big-u">amp morphine / วัน${r.bolus.used && r.hasDrip ? ` (drip ${r.ampsDay} + PRN ${r.bolus.amps})` : r.bolus.used && !r.hasDrip ? ' (PRN อย่างเดียว)' : ''}</span></div>
        <div class="amp-math">${lines.join('')}</div>`;
      const egfr = num('ampEgfr');
      if (Number.isFinite(egfr) && egfr < 30) html += `<div class="amp-warn">eGFR ${fmt(egfr, 0)} (&lt; 30): metabolite ของ morphine สะสม พิจารณาเลี่ยงหรือลดขนาด แล้วปรึกษาแพทย์ (fentanyl เป็นทางเลือก)</div>`;
      else if (Number.isFinite(egfr) && egfr < 60) html += `<div class="amp-warn">eGFR ${fmt(egfr, 0)}: ใช้ขนาดต่ำและติดตาม sedation</div>`;
      text = r.hasDrip
        ? `Morphine drip ${fmt(r.ccHr, 3)} cc/hr (1 mg:${fmt(r.mlPerMg, 3)} ml) = ${fmt(r.mgHr, 3)} mg/hr · ชุดละ ${fmt(hours)} ชม. · drip ${r.ampsDay} amp`
        : 'Morphine';
      if (r.bolus.used) text += ` · PRN ${fmt(r.bolus.dose, 3)} mg × ${fmt(r.bolus.times, 0)} = ${r.bolus.amps} amp`;
      text += ` · จ่ายรวม ${r.totalAmps} amp/วัน (10 mg/ml) · ใช้จริง ${fmt(r.usedDayMg, 1)} mg เศษ ${fmt(r.wasteDayMg, 1)} mg`;
    } else {
      const lines = [];
      if (r.hasDrip) {
        const b0 = r.bags[0], nBags = r.bags.length;
        const shortLast = nBags > 1 && r.bags[nBags - 1].hours !== r.bags[0].hours;
        lines.push(`<div>Drip: ${fmt(r.rate, 2)} mcg/hr ที่ ${fmt(r.conc, 0)} mcg/ml = ${fmt(r.mlHr, 2)} ml/hr</div>`);
        lines.push(`<div>ชุดละ ${fmt(b0.hours)} ชม.: ${fmt(r.rate, 2)} × ${fmt(b0.hours)} = ${fmt(b0.mcg, 1)} mcg → นับจาก mcg ที่ใช้ ปัดขึ้น = <b>${ampTxt(b0.big, b0.small)}</b> (${fmt(b0.prepared, 0)} mcg) · ผสม ${fmt(r.volPerBag, 1)} ml</div>`);
        lines.push(`<div>Drip 1 วัน = ${nBags} ชุด${shortLast ? ` (ชุดสุดท้าย ${fmt(r.bags[nBags - 1].hours)} ชม.)` : ''}: ใช้จริง ${fmt(r.usedDripMcg, 0)} mcg → <b>${ampTxt(r.bigDay, r.smallDay)}</b></div>`);
      }
      if (r.bolus.used) {
        lines.push(`<div>Bolus/PRN: ${fmt(r.bolus.dose, 2)} mcg × ${fmt(r.bolus.times, 0)} ครั้ง/วัน = ${fmt(r.bolus.mcg, 0)} mcg → ปัดขึ้น <b>${ampTxt(r.bolus.big, r.bolus.small)}</b></div>`);
      }
      lines.push(`<div>ใช้จริง ${fmt(r.usedDayMcg, 0)} mcg/วัน · จ่าย ${fmt(r.preparedDayMcg, 0)} mcg · เศษที่ต้องทิ้ง/คืน ${fmt(r.wasteDayMcg, 0)} mcg (บันทึกพยาน 2 คน)</div>`);
      const sub = r.bolus.used && r.hasDrip ? ` (drip ${ampTxt(r.bigDay, r.smallDay)} + PRN ${ampTxt(r.bolus.big, r.bolus.small)})` : r.bolus.used && !r.hasDrip ? ' (PRN อย่างเดียว)' : '';
      html = `
        <div class="amp-big"><span class="amp-big-n">${r.totalBig}</span><span class="amp-big-u">amp ใหญ่ (500 mcg) + <b>${r.totalSmall}</b> amp เล็ก (100 mcg) / วัน${sub}</span></div>
        <div class="amp-math">${lines.join('')}</div>`;
      if (r.hasDrip && r.bottleRunHr > 24 + EPS) html += `<div class="amp-warn">ถ้าผสมขวด 100 ml จะใช้ได้ ~${fmt(r.bottleRunHr, 0)} ชม. ซึ่งเกิน 24 ชม. ควรผสมปริมาตรที่ใช้จริง (${fmt(r.volDay, 1)} ml/วัน) หรือทิ้งยาผสมเมื่อครบ 24 ชม. ตามนโยบาย รพ.</div>`;
      text = r.hasDrip
        ? `Fentanyl drip ${fmt(r.rate, 2)} mcg/hr (${fmt(r.conc, 0)} mcg/ml) · ชุดละ ${fmt(hours)} ชม. · drip ${ampTxt(r.bigDay, r.smallDay)}`
        : 'Fentanyl';
      if (r.bolus.used) text += ` · PRN ${fmt(r.bolus.dose, 2)} mcg × ${fmt(r.bolus.times, 0)} = ${ampTxt(r.bolus.big, r.bolus.small)}`;
      text += ` · จ่ายรวม ${ampTxt(r.totalBig, r.totalSmall)} /วัน · ใช้จริง ${fmt(r.usedDayMcg, 0)} mcg เศษ ${fmt(r.wasteDayMcg, 0)} mcg`;
    }
    html += `<button type="button" class="amp-copy" id="ampCopyBtn" onclick="window.pmkAmpCalc.copy()">คัดลอกผลคำนวณ</button>`;
    res.innerHTML = html;
    lastText = text;

    if (r.hasDrip) {
      const rows = compare(r.drug, opts).map(({ hours: h, r: x }) => {
        if (x.error) return '';
        const sel = !st.custom && h === st.hours ? ' class="sel"' : '';
        if (x.drug === 'morphine') {
          const prn = x.bolus.used ? ` (drip ${x.ampsDay}+PRN ${x.bolus.amps})` : '';
          return `<tr${sel}><td>${h} ชม.</td><td>${x.bags.length}</td><td>${x.bags[0] ? x.bags[0].amps : 0}</td><td><b>${x.totalAmps}</b>${prn}</td><td>${fmt(x.wasteDayMg, 1)} mg</td></tr>`;
        }
        const prn = x.bolus.used ? ` (drip ${ampTxt(x.bigDay, x.smallDay)}+PRN ${ampTxt(x.bolus.big, x.bolus.small)})` : '';
        return `<tr${sel}><td>${h} ชม.</td><td>${x.bags.length}</td><td>${x.bags[0] ? ampTxt(x.bags[0].big, x.bags[0].small) : '-'}</td><td><b>${ampTxt(x.totalBig, x.totalSmall)}</b>${prn}</td><td>${fmt(x.wasteDayMcg, 0)} mcg</td></tr>`;
      }).join('');
      cmp.innerHTML = `<h4 class="amp-h2">เปรียบเทียบ order เดียวกันที่ 24 / 12 / 8 ชม.${r.bolus.used ? ' (รวม PRN ในยอดรวม/วัน)' : ''}</h4>
        <div class="amp-tbl-wrap"><table class="amp-tbl"><thead><tr><th>ต่อชุด</th><th>ชุด/วัน</th><th>amp ต่อชุด (drip)</th><th>จ่ายรวม/วัน</th><th>เศษยา/วัน</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } else {
      cmp.innerHTML = '';
    }
  }

  function copy() {
    if (!lastText) return;
    const done = () => {
      const b = $('ampCopyBtn'); if (b) { const o = b.textContent; b.textContent = 'คัดลอกแล้ว ✓'; setTimeout(() => { b.textContent = o; }, 1500); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lastText).then(done, done);
    else { const t = document.createElement('textarea'); t.value = lastText; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } t.remove(); done(); }
  }
  function reset() {
    const root = $('ampCalcRoot'); if (!root) return;
    ['ampCc', 'ampMg', 'ampEgfr', 'ampCustomConc', 'ampBolusDose', 'ampBolusTimes'].forEach((id) => { if ($(id)) $(id).value = ''; });
    if ($('ampRate')) $('ampRate').value = '50';
    if ($('ampConc')) $('ampConc').value = '10';
    if ($('ampFConc')) $('ampFConc').value = '5';
    if ($('ampFMode')) $('ampFMode').value = 'SL';
    st.source = 'cc'; if ($('ampCustomWrap')) $('ampCustomWrap').classList.add('hidden');
    setHours(24); setDrug('morphine');
  }

  window.pmkAmpCalc = { morphine, fentanyl, compare, bagPlan, fentAmps, render, setDrug, setHours, edit, concChange, calc, copy, reset };
})();
