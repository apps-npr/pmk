/* Helper tool (not a clinic): one-day drip order -> ampoules to dispense, for Morphine and Fentanyl infusions.
 * Ported from apps-npr/morphine and apps-npr/fentanyl, with a 24 / 12 / 8 hr bag-duration selector.
 * Lives in clinic 14 (Pain management) as the sub-tab "คำนวณ amp/วัน".
 * Math (pure functions exposed on window.pmkAmpCalc so they can be unit-tested):
 *   Morphine : mg/hr = cc/hr / (ml per 1 mg);  mg per bag = mg/hr x hours;  amps = ceil(mg per bag / 10 mg per amp)
 *   Fentanyl : mcg per bag = mcg/hr x hours;   bottles(100 ml) = ceil(mcg per bag / (mcg/ml x 100));
 *              mcg prepared = bottles x mcg per bottle;  L amp 500 mcg/10 ml, S amp 100 mcg/2 ml
 *   One day  = 24 h split into bags of the chosen duration (the last bag is shorter if 24 is not a multiple); each bag rounds up on its own.
 * Sources for the notes are listed in the PR description.
 */
(function () {
  'use strict';
  const EPS = 1e-9;
  const MORPHINE_MG_PER_AMP = 10;      // morphine inj 10 mg/ml, 1 ml amp
  const FENT_BOTTLE_ML = 100;
  const FENT_L_MCG = 500, FENT_S_MCG = 100;
  const ceilE = (x) => Math.ceil(x - EPS);
  const round = (x, d) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);

  // Split one day into bags of `hours` each (last one may be shorter)
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
  // opts: { ccHr | mgHr, mlPerMg, hours }
  function morphine(opts) {
    const mlPerMg = Number(opts.mlPerMg);
    if (!(mlPerMg > 0)) return { error: 'ใส่ความเข้มข้น (ml ต่อ 1 mg) ให้ถูกต้อง' };
    let ccHr = Number(opts.ccHr), mgHr = Number(opts.mgHr);
    if (opts.source === 'mg') ccHr = mgHr * mlPerMg; else mgHr = ccHr / mlPerMg;
    if (!(ccHr > 0) || !(mgHr > 0)) return { error: 'ใส่ rate (cc/hr หรือ mg/hr) ให้ถูกต้อง' };
    const hours = Number(opts.hours);
    if (!(hours > 0 && hours <= 24)) return { error: 'ระยะเวลาต้องอยู่ระหว่าง 1–24 ชั่วโมง' };
    const bags = bagPlan(hours).map((h) => morphineBag(mgHr, h));
    const ampsDay = bags.reduce((s, b) => s + b.amps, 0);
    const usedDayMg = mgHr * 24;
    return {
      drug: 'morphine', ccHr, mgHr, mlPerMg, hours, bags,
      ampsPerBag: bags[0].amps, mgPerBag: bags[0].mg, volPerBag: ccHr * bags[0].hours,
      ampsDay, usedDayMg, preparedDayMg: ampsDay * MORPHINE_MG_PER_AMP,
      wasteDayMg: round(ampsDay * MORPHINE_MG_PER_AMP - usedDayMg, 6), volDay: ccHr * 24
    };
  }

  function fentAmps(prepared, mode) {
    let big = 0, small = 0;
    if (mode === 'L') big = ceilE(prepared / FENT_L_MCG);
    else if (mode === 'S') small = ceilE(prepared / FENT_S_MCG);
    else { big = Math.floor(prepared / FENT_L_MCG + EPS); small = ceilE((prepared - big * FENT_L_MCG) / FENT_S_MCG); }
    return { big, small };
  }
  function fentBag(rate, conc, h, mode) {
    const mcg = rate * h;
    const bottleMcg = conc * FENT_BOTTLE_ML;
    const bottles = ceilE(mcg / bottleMcg);
    const prepared = bottles * bottleMcg;
    const a = fentAmps(prepared, mode);
    return { hours: h, mcg, bottles, prepared, big: a.big, small: a.small };
  }
  // opts: { rate (mcg/hr), conc (mcg/ml: 5 or 10), hours, mode: 'SL'|'S'|'L' }
  function fentanyl(opts) {
    const rate = Number(opts.rate), conc = Number(opts.conc), hours = Number(opts.hours);
    const mode = opts.mode || 'SL';
    if (!(rate > 0)) return { error: 'ใส่อัตรา drip (mcg/hr) ให้ถูกต้อง' };
    if (!(conc > 0)) return { error: 'เลือกความเข้มข้น' };
    if (!(hours > 0 && hours <= 24)) return { error: 'ระยะเวลาต้องอยู่ระหว่าง 1–24 ชั่วโมง' };
    const bags = bagPlan(hours).map((h) => fentBag(rate, conc, h, mode));
    const sum = (k) => bags.reduce((s, b) => s + b[k], 0);
    const mlHr = rate / conc;
    return {
      drug: 'fentanyl', rate, conc, hours, mode, bags, mlHr,
      bottleRunHr: FENT_BOTTLE_ML / mlHr,
      bottlesDay: sum('bottles'), bigDay: sum('big'), smallDay: sum('small'),
      usedDayMcg: rate * 24, preparedDayMcg: sum('prepared'),
      wasteDayMcg: round(sum('prepared') - rate * 24, 6), volDay: mlHr * 24
    };
  }
  // 24 / 12 / 8 comparison for the same order
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

  function render(rootId) {
    const root = $(rootId || 'ampCalcRoot');
    if (!root || root.dataset.mounted) return;
    root.dataset.mounted = '1';
    root.innerHTML = `
    <div class="amp-wrap">
      <div class="amp-card">
        <h4 class="amp-h">เครื่องมือคำนวณ amp ยา drip ต่อวัน (Morphine / Fentanyl)</h4>
        <p class="amp-sub">ใส่ rate จากคำสั่งแพทย์ แล้วเลือกว่าเตรียมยาให้ใช้ถุง/ขวดละกี่ชั่วโมง ระบบรวม amp ที่ต้องจ่ายต่อ 1 วัน (24 ชม.)</p>
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
          <label class="amp-f"><span>ความเข้มข้น (ขวด 100 ml: 5 = 500 mcg, 10 = 1000 mcg)</span>
            <select id="ampFConc" onchange="window.pmkAmpCalc.calc()">
              <option value="5">5 mcg/ml</option>
              <option value="10">10 mcg/ml</option>
            </select>
          </label>
          <label class="amp-f"><span>วิธีเลือก amp (L = 500 mcg/10 ml, S = 100 mcg/2 ml)</span>
            <select id="ampFMode" onchange="window.pmkAmpCalc.calc()">
              <option value="SL">L + S</option>
              <option value="L">L only</option>
              <option value="S">S only</option>
            </select>
          </label>
        </div>

        <div class="amp-dur">
          <span class="amp-dur-label">ถุง/ขวดหนึ่งชุดใช้กี่ชั่วโมง</span>
          <div class="amp-seg" id="ampDur" role="group" aria-label="ระยะเวลาต่อชุด">
            <button type="button" class="amp-seg-btn active" data-amp-h="24" onclick="window.pmkAmpCalc.setHours(24)">24 ชม.</button>
            <button type="button" class="amp-seg-btn" data-amp-h="12" onclick="window.pmkAmpCalc.setHours(12)">12 ชม.</button>
            <button type="button" class="amp-seg-btn" data-amp-h="8" onclick="window.pmkAmpCalc.setHours(8)">8 ชม.</button>
            <button type="button" class="amp-seg-btn" data-amp-h="custom" onclick="window.pmkAmpCalc.setHours('custom')">อื่นๆ</button>
          </div>
          <label class="amp-f amp-custom hidden" id="ampHoursWrap"><span>ชั่วโมง (1–24)</span><input id="ampHours" type="number" min="1" max="24" step="any" inputmode="decimal" value="24" oninput="window.pmkAmpCalc.calc()"></label>
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
    if (st.drug === 'morphine') return { ccHr: num('ampCc'), mgHr: num('ampMg'), mlPerMg: mlPerMgNow(), source: st.source };
    return { rate: num('ampRate'), conc: num('ampFConc'), mode: $('ampFMode').value };
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
    const nBags = r.bags.length;
    const shortLast = nBags > 1 && r.bags[nBags - 1].hours !== r.bags[0].hours;
    let html = '', text = '';
    if (r.drug === 'morphine') {
      const b0 = r.bags[0];
      const perBagLine = `${fmt(r.mgHr, 3)} mg/hr × ${fmt(b0.hours)} hr = ${fmt(b0.mg, 2)} mg → ${fmt(b0.mg, 2)} ÷ ${MORPHINE_MG_PER_AMP} = ${fmt(b0.mg / MORPHINE_MG_PER_AMP, 2)} → ปัดขึ้น <b>${b0.amps} amp</b>`;
      const ampList = r.bags.map((b) => b.amps).join(' + ');
      html = `
        <div class="amp-big"><span class="amp-big-n">${r.ampsDay}</span><span class="amp-big-u">amp morphine / วัน</span></div>
        <div class="amp-math">
          <div>Order: ${fmt(r.ccHr, 3)} cc/hr (1 mg : ${fmt(r.mlPerMg, 3)} ml) = ${fmt(r.mgHr, 3)} mg/hr</div>
          <div>ชุดละ ${fmt(b0.hours)} ชม.: ${perBagLine}</div>
          <div>ปริมาตรที่ให้ต่อชุด = ${fmt(r.volPerBag, 1)} ml</div>
          <div>1 วัน = ${nBags} ชุด${shortLast ? ` (ชุดสุดท้าย ${fmt(r.bags[nBags - 1].hours)} ชม.)` : ''}: ${ampList} = <b>${r.ampsDay} amp</b> (amp ละ 10 mg/1 ml)</div>
          <div>ใช้จริง ${fmt(r.usedDayMg, 2)} mg/วัน · จ่าย ${fmt(r.preparedDayMg, 0)} mg · เศษที่ต้องทิ้ง/คืน ${fmt(r.wasteDayMg, 2)} mg (บันทึกพยาน 2 คน)</div>
        </div>`;
      const egfr = num('ampEgfr');
      if (Number.isFinite(egfr) && egfr < 30) html += `<div class="amp-warn">eGFR ${fmt(egfr, 0)} (&lt; 30): metabolite ของ morphine สะสม พิจารณาเลี่ยงหรือลดขนาด แล้วปรึกษาแพทย์ (fentanyl เป็นทางเลือก)</div>`;
      else if (Number.isFinite(egfr) && egfr < 60) html += `<div class="amp-warn">eGFR ${fmt(egfr, 0)}: ใช้ขนาดต่ำและติดตาม sedation</div>`;
      text = `Morphine drip ${fmt(r.ccHr, 3)} cc/hr (1 mg:${fmt(r.mlPerMg, 3)} ml) = ${fmt(r.mgHr, 3)} mg/hr · ชุดละ ${fmt(hours)} ชม. ${nBags} ชุด/วัน · จ่าย ${r.ampsDay} amp/วัน (10 mg/ml) · ใช้จริง ${fmt(r.usedDayMg, 1)} mg เศษ ${fmt(r.wasteDayMg, 1)} mg`;
    } else {
      const b0 = r.bags[0];
      const ampTxt = (b) => `L ${b.big} + S ${b.small}`;
      html = `
        <div class="amp-big"><span class="amp-big-n">${r.bigDay}</span><span class="amp-big-u">amp ใหญ่ (500 mcg) + <b>${r.smallDay}</b> amp เล็ก (100 mcg) / วัน</span></div>
        <div class="amp-math">
          <div>Order: ${fmt(r.rate, 2)} mcg/hr ที่ ${fmt(r.conc, 0)} mcg/ml = ${fmt(r.mlHr, 2)} ml/hr · ขวด 100 ml ใช้ได้ ~${fmt(r.bottleRunHr, 1)} ชม.</div>
          <div>ชุดละ ${fmt(b0.hours)} ชม.: ${fmt(r.rate, 2)} × ${fmt(b0.hours)} = ${fmt(b0.mcg, 1)} mcg → ขวดละ ${fmt(r.conc * FENT_BOTTLE_ML, 0)} mcg → ปัดขึ้น <b>${b0.bottles} ขวด</b> (${fmt(b0.prepared, 0)} mcg) = ${ampTxt(b0)}</div>
          <div>1 วัน = ${nBags} ชุด${shortLast ? ` (ชุดสุดท้าย ${fmt(r.bags[nBags - 1].hours)} ชม.)` : ''} = ${r.bottlesDay} ขวด = ${fmt(r.preparedDayMcg, 0)} mcg → <b>L ${r.bigDay} + S ${r.smallDay}</b></div>
          <div>ใช้จริง ${fmt(r.usedDayMcg, 0)} mcg/วัน · เศษที่ต้องทิ้ง/คืน ${fmt(r.wasteDayMcg, 0)} mcg (บันทึกพยาน 2 คน)</div>
        </div>`;
      if (r.bottleRunHr > 24 + EPS) html += `<div class="amp-warn">ขวดหนึ่งใช้เกิน 24 ชม. (~${fmt(r.bottleRunHr, 0)} ชม.) ควรทิ้งยาผสมที่เหลือเมื่อครบ 24 ชม. หรือพิจารณาความเข้มข้นที่เจือจางกว่าตามนโยบาย รพ.</div>`;
      if ($('ampFMode').value === 'SL') html += `<div class="amp-hint">หมายเหตุ: ขวด 5 และ 10 mcg/ml เป็นพหุคูณของ 500 mcg เสมอ โหมด L+S จึงได้ amp ใหญ่ล้วน (amp เล็กจะมีเมื่อเลือก S only)</div>`;
      text = `Fentanyl drip ${fmt(r.rate, 2)} mcg/hr (${fmt(r.conc, 0)} mcg/ml, ขวด 100 ml) · ชุดละ ${fmt(hours)} ชม. ${nBags} ชุด/วัน = ${r.bottlesDay} ขวด · จ่าย L(500 mcg) ${r.bigDay} + S(100 mcg) ${r.smallDay} amp/วัน · ใช้จริง ${fmt(r.usedDayMcg, 0)} mcg เศษ ${fmt(r.wasteDayMcg, 0)} mcg`;
    }
    html += `<button type="button" class="amp-copy" id="ampCopyBtn" onclick="window.pmkAmpCalc.copy()">คัดลอกผลคำนวณ</button>`;
    res.innerHTML = html;
    lastText = text;

    // comparison table 24 / 12 / 8
    const rows = compare(r.drug, opts).map(({ hours: h, r: x }) => {
      if (x.error) return '';
      const sel = !st.custom && h === st.hours ? ' class="sel"' : '';
      if (x.drug === 'morphine') return `<tr${sel}><td>${h} ชม.</td><td>${x.bags.length}</td><td>${x.bags[0].amps}</td><td><b>${x.ampsDay}</b></td><td>${fmt(x.wasteDayMg, 1)} mg</td></tr>`;
      return `<tr${sel}><td>${h} ชม.</td><td>${x.bags.length}</td><td>${x.bags[0].bottles} ขวด</td><td><b>L ${x.bigDay} + S ${x.smallDay}</b></td><td>${fmt(x.wasteDayMcg, 0)} mcg</td></tr>`;
    }).join('');
    cmp.innerHTML = `<h4 class="amp-h2">เปรียบเทียบ order เดียวกันที่ 24 / 12 / 8 ชม.</h4>
      <div class="amp-tbl-wrap"><table class="amp-tbl"><thead><tr><th>ต่อชุด</th><th>ชุด/วัน</th><th>${r.drug === 'morphine' ? 'amp ต่อชุด' : 'ขวดต่อชุด'}</th><th>จ่ายรวม/วัน</th><th>เศษยา/วัน</th></tr></thead><tbody>${rows}</tbody></table></div>`;
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
    ['ampCc', 'ampMg', 'ampEgfr', 'ampCustomConc'].forEach((id) => { if ($(id)) $(id).value = ''; });
    if ($('ampRate')) $('ampRate').value = '50';
    if ($('ampConc')) $('ampConc').value = '10';
    if ($('ampFConc')) $('ampFConc').value = '5';
    if ($('ampFMode')) $('ampFMode').value = 'SL';
    st.source = 'cc'; $('ampCustomWrap').classList.add('hidden');
    setHours(24); setDrug('morphine');
  }

  window.pmkAmpCalc = { morphine, fentanyl, compare, bagPlan, render, setDrug, setHours, edit, concChange, calc, copy, reset };
})();
