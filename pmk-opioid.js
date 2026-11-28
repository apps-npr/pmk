/* Clinic 14: Opioid (ported from apps-npr/appopioid "Opioid Care")
 * Sub-sections: ยา (product catalog + crushability) | ประเมิน (pain scales) | เทียบยา (converter)
 *               | รักษา/จ่ายยา (naive vs on-opioid regimen, rescue, dispense) | ข้อมูล (naloxone, adjuvants, counselling)
 * Conversion factors: oral morphine equivalent (OME, mg/day) per unit of the source drug.
 * Sources (see PR description): CDC 2022 MME table, Durogesic DTrans SmPC (Tables 1-3),
 * McPherson ASHP 2010 (EOD image), NCCN Adult Cancer Pain, MST Continus SmPC, Kapanol PI (TGA).
 */
(function () {
  'use strict';

  const IMG = './images/opioid/';

  // ---------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------
  const PRODUCTS = [
    { id: 'mo_ir', name: 'Morphine IR', strength: '10 mg', form: 'tab', crush: 'yes', note: 'บดได้ (ยาออกฤทธิ์ทันที)', onset: '15-30 min', duration: '4 hr', image: 'mir.webp' },
    { id: 'mo_syr', name: 'Morphine Syrup', strength: '2 mg/ml (10 mg/5 ml)', form: 'liquid', crush: 'yes', note: 'ยาน้ำ ให้ทาง NG ได้', onset: '15-30 min', duration: '4 hr', image: 'msyr.webp' },
    { id: 'mo_inj', name: 'Morphine Injection', strength: '10 mg/ml', form: 'amp', crush: 'inj', note: 'ยาฉีด', onset: '5-20 min', duration: '3-4 hr', image: 'minj.webp' },
    { id: 'mst_10', name: 'MST (Morphine SR)', strength: '10 mg', form: 'tab_sr', crush: 'no', note: 'ห้ามหัก/บด/เคี้ยว', onset: '3-4 hr', duration: '12 hr', image: 'mst10.webp' },
    { id: 'mst_30', name: 'MST (Morphine SR)', strength: '30 mg', form: 'tab_sr', crush: 'no', note: 'ห้ามหัก/บด/เคี้ยว', onset: '3-4 hr', duration: '12 hr', image: 'mst30.webp' },
    { id: 'mst_60', name: 'MST (Morphine SR)', strength: '60 mg', form: 'tab_sr', crush: 'no', note: 'ห้ามหัก/บด/เคี้ยว', onset: '3-4 hr', duration: '12 hr', image: 'mst60.webp' },
    { id: 'mst_100', name: 'MST (Morphine SR)', strength: '100 mg', form: 'tab_sr', crush: 'no', note: 'ห้ามหัก/บด/เคี้ยว', onset: '3-4 hr', duration: '12 hr', image: 'mst100.webp' },
    { id: 'mst_200', name: 'MST (Morphine SR)', strength: '200 mg', form: 'tab_sr', crush: 'no', note: 'ห้ามหัก/บด/เคี้ยว', onset: '3-4 hr', duration: '12 hr', image: 'mst200.webp' },
    { id: 'kap_10', name: 'Kapanol', strength: '10 mg', form: 'cap_sr', crush: 'open', note: 'แกะแคปซูลโรยอาหารอ่อน/ผสมน้ำได้ ห้ามบดเม็ดข้างใน · gastrostomy ≥16 Fr ได้ ไม่ให้ทาง NG', onset: 'ช้า', duration: '12-24 hr', image: 'k10.webp' },
    { id: 'kap_20', name: 'Kapanol', strength: '20 mg', form: 'cap_sr', crush: 'open', note: 'แกะแคปซูลโรยอาหารอ่อน/ผสมน้ำได้ ห้ามบดเม็ดข้างใน · gastrostomy ≥16 Fr ได้ ไม่ให้ทาง NG', onset: 'ช้า', duration: '12-24 hr', image: 'k20.webp' },
    { id: 'kap_50', name: 'Kapanol', strength: '50 mg', form: 'cap_sr', crush: 'open', note: 'แกะแคปซูลโรยอาหารอ่อน/ผสมน้ำได้ ห้ามบดเม็ดข้างใน · gastrostomy ≥16 Fr ได้ ไม่ให้ทาง NG', onset: 'ช้า', duration: '12-24 hr', image: 'k50.webp' },
    { id: 'kap_100', name: 'Kapanol', strength: '100 mg', form: 'cap_sr', crush: 'open', note: 'แกะแคปซูลโรยอาหารอ่อน/ผสมน้ำได้ ห้ามบดเม็ดข้างใน · gastrostomy ≥16 Fr ได้ ไม่ให้ทาง NG', onset: 'ช้า', duration: '12-24 hr', image: 'k100.webp' },
    { id: 'fp_12', name: 'Fentanyl Patch', strength: '12 mcg/hr', form: 'patch', crush: 'patch', note: 'แผ่นแปะ ห้ามตัด เปลี่ยนทุก 72 ชม.', onset: '12-24 hr', duration: '72 hr', image: 'fp12.webp' },
    { id: 'fp_25', name: 'Fentanyl Patch', strength: '25 mcg/hr', form: 'patch', crush: 'patch', note: 'แผ่นแปะ ห้ามตัด เปลี่ยนทุก 72 ชม.', onset: '12-24 hr', duration: '72 hr', image: 'fp25.webp' },
    { id: 'fp_50', name: 'Fentanyl Patch', strength: '50 mcg/hr', form: 'patch', crush: 'patch', note: 'แผ่นแปะ ห้ามตัด เปลี่ยนทุก 72 ชม.', onset: '12-24 hr', duration: '72 hr', image: 'fp50.webp' },
    { id: 'fp_75', name: 'Fentanyl Patch', strength: '75 mcg/hr', form: 'patch', crush: 'patch', note: 'แผ่นแปะ ห้ามตัด เปลี่ยนทุก 72 ชม.', onset: '12-24 hr', duration: '72 hr', image: 'fp75.webp' },
    { id: 'fp_100', name: 'Fentanyl Patch', strength: '100 mcg/hr', form: 'patch', crush: 'patch', note: 'แผ่นแปะ ห้ามตัด เปลี่ยนทุก 72 ชม.', onset: '12-24 hr', duration: '72 hr', image: 'fp100.webp' },
    { id: 'fen_inj_100', name: 'Fentanyl Injection', strength: '100 mcg/2 ml', form: 'amp', crush: 'inj', note: 'ยาฉีด', onset: 'ทันที', duration: '0.5-1 hr', image: 'f100.webp' },
    { id: 'fen_inj_500', name: 'Fentanyl Injection', strength: '500 mcg/10 ml', form: 'amp', crush: 'inj', note: 'ยาฉีด', onset: 'ทันที', duration: '0.5-1 hr', image: 'f500.webp' },
    { id: 'peth_inj', name: 'Pethidine Injection', strength: '50 mg/ml', form: 'amp', crush: 'inj', note: 'ยาฉีด · เลี่ยงในไตเสื่อม/ใช้ระยะยาว', onset: '10-15 min', duration: '2-4 hr', image: 'pinj.webp' },
    { id: 'tramadol', name: 'Tramadol', strength: '50 mg', form: 'cap', crush: 'yes', note: 'แกะแคปซูลได้', onset: '30-60 min', duration: '6-8 hr', image: 'tramadol.webp' },
    { id: 'codeine_15', name: 'Codeine', strength: '15 mg', form: 'tab', crush: 'yes', note: 'บดได้', onset: '30 min', duration: '4-6 hr', image: 'c15.webp' },
    { id: 'codeine_30', name: 'Codeine', strength: '30 mg', form: 'tab', crush: 'yes', note: 'บดได้', onset: '30 min', duration: '4-6 hr', image: 'c30.webp' }
  ];

  // OME factor per unit/day. unit = what the user types.
  const DRUGS = {
    morphine_po: { label: 'Morphine (Oral)', unit: 'mg/day', factor: 1, morphine: true },
    morphine_inj: { label: 'Morphine (Inj)', unit: 'mg/day', factor: 3, morphine: true },
    tramadol_po: { label: 'Tramadol (Oral)', unit: 'mg/day', factor: 0.2 },
    codeine_po: { label: 'Codeine (Oral)', unit: 'mg/day', factor: 0.15 },
    hydromorphone_po: { label: 'Hydromorphone (Oral)', unit: 'mg/day', factor: 5 },
    oxycodone_po: { label: 'Oxycodone (Oral)', unit: 'mg/day', factor: 1.5 },
    fentanyl_patch: { label: 'Fentanyl Patch', unit: 'mcg/hr', factor: 2.4, patch: true },
    buprenorphine_inj: { label: 'Buprenorphine (Inj)', unit: 'mg/day', factor: 100 },
    tramadol_inj: { label: 'Tramadol (Inj)', unit: 'mg/day', factor: 0.3 },
    codeine_inj: { label: 'Codeine (Inj)', unit: 'mg/day', factor: 0.25 },
    fentanyl_inj: { label: 'Fentanyl (Inj)', unit: 'mcg/day', factor: 0.3 },
    methadone_po: { label: 'Methadone (Oral)', unit: 'mg/day', factor: 4.7, methadone: true },
    pethidine_inj: { label: 'Pethidine (Inj)', unit: 'mg/day', factor: 0.3 },
    levorphanol_po: { label: 'Levorphanol (Oral)', unit: 'mg/day', factor: 11 },
    tapentadol_po: { label: 'Tapentadol (Oral)', unit: 'mg/day', factor: 0.4 }
  };
  const COMMON = ['morphine_po', 'morphine_inj', 'tramadol_po', 'codeine_po', 'hydromorphone_po', 'oxycodone_po', 'fentanyl_patch'];

  // Durogesic DTrans SmPC Table 2 (rotation / less stable, ~150:1) and Table 3 (stable, ~100:1)
  const PATCH_T2 = [[90, 12], [135, 25], [225, 50], [315, 75], [405, 100], [495, 125], [585, 150], [675, 175], [765, 200], [855, 225], [945, 250], [1035, 275], [1125, 300]];
  const PATCH_T3 = [[45, 12], [90, 25], [150, 50], [210, 75], [270, 100], [330, 125], [390, 150], [450, 175], [510, 200], [570, 225], [630, 250], [690, 275], [750, 300]];

  // ---------------------------------------------------------------
  // Pure calculations (exported for tests)
  // ---------------------------------------------------------------
  function methadoneFactor() {
    // CDC 2022 single MME factor (pharmacist decision; replaces the CDC 2016 tiers of the old app)
    return 4.7;
  }
  function toOme(drugKey, dose) {
    const d = DRUGS[drugKey];
    const x = Number(dose);
    if (!d || !Number.isFinite(x) || x <= 0) return 0;
    const f = d.methadone ? methadoneFactor(x) : d.factor;
    return round1(x * f);
  }
  function round1(x) { return Math.round(x * 10) / 10; }
  function patchFromOme(ome, table) {
    const t = table === 3 ? PATCH_T3 : PATCH_T2;
    if (!(ome > 0)) return null;
    for (const [lt, mcg] of t) if (ome < lt) return mcg;
    return null; // above table: specialist
  }
  function convert(drugKey, dose, reducePct) {
    const ome = toOme(drugKey, dose);
    const r = Math.min(Math.max(Number(reducePct) || 0, 0), 75) / 100;
    const target = round1(ome * (1 - r));
    const src = DRUGS[drugKey] || {};
    // Same drug, different route (morphine PO <-> IV): no cross-tolerance reduction needed
    const moBase = src.morphine ? ome : target;
    return {
      ome,
      target,
      reducePct: Math.round(r * 100),
      morphinePo: round1(moBase),
      morphineInj: round1(moBase / 3),
      oxycodonePo: round1(target / 1.5),
      hydromorphonePo: round1(target / 5),
      patchT2: src.patch ? null : patchFromOme(ome, 2),
      patchT3: src.patch ? null : patchFromOme(ome, 3),
      opioidTolerant: ome >= 60
    };
  }
  function titratePct(painScore, status) {
    const p = Number(painScore) || 0;
    if (status !== 'user') return 0;
    if (p >= 7) return 50;   // NCCN 50-100%
    if (p >= 4) return 30;   // NCCN 25-50%
    return 0;                // mild pain: continue current dose
  }
  function renalFactor(egfr) {
    const e = Number(egfr);
    if (!Number.isFinite(e) || e <= 0) return 1;
    if (e < 10) return 0.5;
    if (e <= 50) return 0.75;
    return 1;
  }
  function combos(target, strengths, maxItems) {
    maxItems = maxItems || 3;
    const out = [];
    const s = strengths.slice().sort((a, b) => b - a);
    (function rec(cur, sum) {
      if (sum >= target * 0.85 && sum <= target * 1.15 && cur.length) { out.push(cur.slice()); return; }
      if (sum > target * 1.15 || cur.length >= maxItems) return;
      for (const x of s) {
        if (cur.length && x > cur[cur.length - 1]) continue;
        rec(cur.concat(x), sum + x);
      }
    })([], 0);
    out.sort((a, b) => Math.abs(target - sum(a)) - Math.abs(target - sum(b)) || a.length - b.length);
    const seen = new Set();
    return out.filter(c => { const k = c.join('+'); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
  }
  function sum(a) { return a.reduce((x, y) => x + y, 0); }
  function groupText(combo, unit) {
    const counts = {};
    combo.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    return Object.keys(counts).map(Number).sort((a, b) => b - a).map(k => `${k} ${unit} x ${counts[k]}`).join(' + ');
  }
  function rescueDose(dailyOme) {
    // 1/6 of daily OME (~17%, within NCCN 10-20%) as morphine syrup 2 mg/ml, rounded to 0.5 ml, min 1 ml
    if (!(dailyOme > 0)) return null;
    let ml = Math.round((dailyOme / 6 / 2) * 2) / 2;
    if (ml < 1) ml = 1;
    return { ml, mg: ml * 2 };
  }
  function buildOptions(opts) {
    const target = opts.target;
    const route = opts.route || 'oral';
    const isRenal = opts.renalFactor < 1;
    const list = [];
    if (!(target > 0)) return list;
    if (route !== 'ng') {
      combos(target, [100, 50, 20, 10]).forEach(c => list.push({ kind: 'kapanol', name: 'Kapanol', regimen: groupText(c, 'mg') + ' (OD)', dailyMg: sum(c), perDose: c, freq: 1, renal: isRenal }));
    }
    if (route === 'oral') {
      combos(target / 2, [200, 100, 60, 30, 10]).forEach(c => list.push({ kind: 'mst', name: 'MST', regimen: groupText(c, 'mg') + ' (BID)', dailyMg: sum(c) * 2, perDose: c, freq: 2, renal: isRenal }));
    }
    // Morphine syrup q4h (crushable route / NG tube)
    const perDoseMl = Math.max(1, Math.round((target / 6 / 2) * 2) / 2);
    if (route === 'ng' || target <= 30) {
      list.push({ kind: 'syrup', name: 'Morphine Syrup 2 mg/ml', regimen: `${perDoseMl} ml (${perDoseMl * 2} mg) q 4 hr`, dailyMg: perDoseMl * 2 * 6, perDoseMl, freq: 6, renal: isRenal });
    }
    // Fentanyl patch: opioid-tolerant only (FDA: >= 60 mg OME/day for >= 1 week; SmPC: not for naive)
    if (opts.status === 'user' && opts.baseOme >= 60) {
      combos(target / 2.4, [100, 75, 50, 25, 12]).forEach(c => list.push({ kind: 'patch', name: 'Fentanyl Patch', regimen: groupText(c, 'mcg/hr') + ' q72h', dailyMg: round1(sum(c) * 2.4), perDose: c, freq: 1 / 3, renal: false }));
    }
    return list;
  }
  function dispense(option, days) {
    days = Math.max(1, Math.round(Number(days) || 14));
    const items = [];
    if (!option) return { items, rescue: null, bottles: 0 };
    if (option.kind === 'syrup') {
      const ml = option.perDoseMl * 6 * days;
      items.push({ label: 'Morphine Syrup 2 mg/ml (60 ml)', qty: Math.ceil(ml / 60), unit: 'ขวด' });
    } else {
      const counts = {};
      option.perDose.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
      Object.keys(counts).map(Number).sort((a, b) => b - a).forEach(k => {
        if (option.kind === 'patch') items.push({ label: `Fentanyl Patch ${k} mcg/hr`, qty: counts[k] * Math.ceil(days / 3), unit: 'แผ่น' });
        else items.push({ label: `${option.name} ${k} mg`, qty: counts[k] * option.freq * days, unit: option.kind === 'kapanol' ? 'cap' : 'tab' });
      });
    }
    const r = rescueDose(option.dailyMg);
    const bottles = r ? Math.ceil((r.ml * 4 * days) / 60) : 0;
    return { items, rescue: r, bottles, days };
  }

  const calc = { DRUGS, PATCH_T2, PATCH_T3, toOme, methadoneFactor, patchFromOme, convert, titratePct, renalFactor, combos, rescueDose, buildOptions, dispense };
  if (typeof window !== 'undefined') window.PMKOpioidCalc = calc;
  if (typeof module !== 'undefined' && module.exports) module.exports = calc;
  if (typeof document === 'undefined') return;

  // ---------------------------------------------------------------
  // Pain assessment tools
  // ---------------------------------------------------------------
  const ASSESS = {
    nips: { title: 'NIPS (แรกเกิด - 1 ปี)', threshold: 4, img: 'NIPS.webp', msgPain: 'ปวดปานกลาง-มาก (≥ 4) พิจารณาให้ยาแก้ปวด', msgSafe: 'ปวดน้อย/ไม่ปวด',
      items: [
        ['สีหน้า', [['ผ่อนคลาย', 0], ['แสยะ/ขมวดคิ้ว', 1]]],
        ['การร้องไห้', [['ไม่ร้อง', 0], ['ร้องคราง', 1], ['ร้องเสียงดัง', 2]]],
        ['การหายใจ', [['สม่ำเสมอ', 0], ['ไม่สม่ำเสมอ/กลั้น', 1]]],
        ['แขน', [['วางสบาย', 0], ['งอ/เกร็ง', 1]]],
        ['ขา', [['วางสบาย', 0], ['งอ/เกร็ง', 1]]],
        ['ระดับการตื่น', [['หลับ/สงบ', 0], ['กระสับกระส่าย', 1]]]
      ] },
    cheops: { title: 'CHEOPS (1-6 ปี)', threshold: 8, img: 'CHEOPS.webp', msgPain: 'ปวดปานกลาง-มาก (≥ 8) ควรให้ยาแก้ปวด', msgSafe: 'ปวดน้อย',
      items: [
        ['การร้องไห้', [['ไม่ร้อง', 1], ['ร้องคราง', 2], ['ร้องไห้', 2], ['กรีดร้อง', 3]]],
        ['สีหน้า', [['ยิ้ม', 0], ['เฉยๆ', 1], ['เบ้หน้า', 2]]],
        ['การส่งเสียง', [['พูดเรื่องดี', 0], ['ไม่พูด/บ่นเรื่องอื่น', 1], ['บ่นปวด', 2]]],
        ['ลำตัว', [['เฉยๆ', 1], ['เกร็ง/บิดตัว', 2], ['ถูกมัด', 2]]],
        ['การสัมผัสแผล', [['ไม่แตะแผล', 1], ['เอื้อมแตะแผล', 2], ['ถูกมัด', 2]]],
        ['ขา', [['วางท่าสบาย', 1], ['ดิ้น/เตะ', 2], ['ถูกมัด', 2]]]
      ] },
    bps: { title: 'BPS (ผู้ป่วยวิกฤต/ใส่ท่อ)', threshold: 6, img: 'CPOT_BPS.webp', msgPain: 'มีความปวด (> 5) พิจารณาให้ยาแก้ปวด', msgSafe: 'ควบคุมความปวดได้',
      items: [
        ['สีหน้า', [['ผ่อนคลาย', 1], ['ขมวดคิ้วเล็กน้อย', 2], ['ขมวดคิ้วมาก', 3], ['หน้าแสยะ', 4]]],
        ['แขน', [['ไม่ขยับ', 1], ['งอเล็กน้อย', 2], ['งอมาก/กำมือ', 3], ['เกร็งตลอด', 4]]],
        ['การต้านเครื่องช่วยหายใจ', [['ไม่ต้าน', 1], ['ไอแต่ทนได้', 2], ['ต้านเครื่อง', 3], ['ควบคุมการหายใจไม่ได้', 4]]]
      ] },
    cpot: { title: 'CPOT (ผู้ป่วยวิกฤต)', threshold: 3, img: null, msgPain: 'มีความปวด (> 2) พิจารณาให้ยาแก้ปวด', msgSafe: 'ปวดน้อย/ไม่ปวด',
      items: [
        ['สีหน้า', [['ผ่อนคลาย', 0], ['ตึงเครียด', 1], ['หน้าแสยะ', 2]]],
        ['การเคลื่อนไหว', [['ปกติ', 0], ['ปกป้องตนเอง', 1], ['กระสับกระส่าย', 2]]],
        ['ต้านเครื่อง/ส่งเสียง', [['ไม่ต้าน/ปกติ', 0], ['ไอ/คราง', 1], ['ต้านเครื่อง/ร้องไห้', 2]]],
        ['ความตึงกล้ามเนื้อ', [['หย่อน', 0], ['ตึงเกร็ง', 1], ['เกร็งมาก', 2]]]
      ] }
  };

  // ---------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function val(id) { const el = $(id); return el ? String(el.value || '').trim() : ''; }
  function num(id) { const v = parseFloat(val(id).replace(/,/g, '')); return Number.isFinite(v) ? v : NaN; }
  function isChecked(id) { return !!($(id) && $(id).checked); }
  function radio(name) { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : ''; }
  function setRadio(name, value) { document.querySelectorAll(`input[name="${name}"]`).forEach(el => { el.checked = el.value === value; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function todayShortBE() { const d = new Date(); return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear() + 543).slice(-2)}`; }
  // Only touch the DOM when content changes, so a tap that blurs another field doesn't lose its target
  function setHtml(el, html) { if (el && el._opHtml !== html) { el.innerHTML = html; el._opHtml = html; } }
  function fmt(n) { return Number.isFinite(n) ? (Math.round(n * 10) / 10).toString() : '-'; }
  const IN = 'w-full rounded-lg border-gray-300 border px-3 py-2 text-sm';
  const ON = 'oninput="window.pmkOpioidRefresh()" onchange="window.pmkOpioidRefresh()"';
  function drugOptions(selected) {
    const opt = k => `<option value="${k}"${k === selected ? ' selected' : ''}>${esc(DRUGS[k].label)}</option>`;
    const others = Object.keys(DRUGS).filter(k => !COMMON.includes(k));
    return `<optgroup label="ยาที่ใช้บ่อย">${COMMON.map(opt).join('')}</optgroup><optgroup label="ยาอื่นๆ">${others.map(opt).join('')}</optgroup>`;
  }
  function img(file, alt, cls) {
    return `<img src="${IMG}${file}" loading="lazy" decoding="async" alt="${esc(alt)}" class="${cls || 'op-ref-img'} cursor-zoom-in" onclick="openModal(this.src)">`;
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  const SECTIONS = [['manage', 'รักษา/จ่ายยา'], ['convert', 'เทียบยา'], ['profile', 'ยา/บดได้ไหม'], ['assess', 'ประเมินปวด'], ['counsel', 'ข้อมูล/แนะนำ']];

  function render() {
    const root = $('form-OPIOID');
    if (!root || root.dataset.opMounted) return;
    root.dataset.opMounted = '1';
    root.innerHTML = `
      <div class="pmk-clinic-head op-head rounded-xl p-4">
        <h3 class="font-bold mb-1">14. Pain management</h3>
        <p class="text-sm">ปรับยา opioid: ผู้ป่วยเริ่มยาใหม่ (naive) หรือใช้อยู่แล้ว เทียบขนาดยากิน/ฉีด/แผ่นแปะ ตรวจว่าบดได้ไหม และคำนวณยาแก้ปวดฉุกเฉิน</p>
      </div>

      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label class="block text-xs font-medium text-gray-600 mb-1">วันที่มาคลินิก</label>
            <input type="text" id="opVisitDate" class="${IN}" placeholder="เช่น 27/11/69" ${ON}></div>
          <div><label class="block text-xs font-medium text-gray-600 mb-1">เภสัชกรผู้บันทึก</label>
            <input type="text" id="opPharmName" list="pharmList" class="${IN}" placeholder="เลือกหรือพิมพ์ชื่อเภสัชกร" ${ON}></div>
          <div><label class="block text-xs font-medium text-gray-600 mb-1">วินิจฉัย/ชนิดความปวด</label>
            <input type="text" id="opDx" class="${IN}" placeholder="เช่น CA lung with bone mets" ${ON}></div>
        </div>
      </div>

      <div class="op-subtabs flex flex-wrap gap-2" role="tablist">
        ${SECTIONS.map(([id, label], i) => `<button type="button" role="tab" id="opSubBtn-${id}" class="op-subtab${i === 0 ? ' active' : ''}" onclick="window.pmkOpioidSection('${id}')">${label}</button>`).join('')}
      </div>

      ${renderManage()}
      ${renderConvert()}
      ${renderProfile()}
      ${renderAssess()}
      ${renderCounsel()}
    `;
    if ($('opVisitDate') && !val('opVisitDate')) $('opVisitDate').value = todayShortBE();
    renderDerived();
  }

  function renderManage() {
    return `
    <div id="opSec-manage" class="op-sec space-y-4">
      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h4 class="font-semibold text-gray-800">1) ข้อมูลผู้ป่วย</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Pain score (NRS 0-10)</label>
            <div class="flex items-center gap-3"><input type="range" id="opPain" min="0" max="10" value="0" class="flex-1" ${ON}><span id="opPainBadge" class="op-badge">0</span></div>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">สถานะการใช้ opioid</label>
            <div class="flex flex-wrap gap-3 text-sm">
              <label class="flex items-center gap-1.5"><input type="radio" name="opStatus" value="naive" checked ${ON}> ผู้ป่วยใหม่ (Opioid-naive)</label>
              <label class="flex items-center gap-1.5"><input type="radio" name="opStatus" value="user" ${ON}> ใช้ opioid อยู่แล้ว</label>
            </div>
          </div>
        </div>
        <div id="opPrevBox" class="hidden rounded-lg border op-tint p-3 space-y-2">
          <label class="block text-xs font-medium text-gray-600">ยา opioid เดิม (รวมทั้งวัน รวม rescue ที่ใช้จริง)</label>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select id="opPrevDrug" class="${IN}" ${ON}>${drugOptions('morphine_po')}</select>
            <input type="number" min="0" step="any" id="opPrevDose" class="${IN}" placeholder="ขนาดรวมต่อวัน" ${ON}>
            <div id="opPrevOme" class="text-sm text-gray-700 self-center"></div>
          </div>
          <input type="text" id="opPrevText" class="${IN}" placeholder="รายละเอียดยาเดิม เช่น MST 30 mg 1x2 + MO syr 5 ml prn วันละ 2 ครั้ง" ${ON}>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">ทางให้ยา</label>
            <select id="opRoute" class="${IN}" ${ON}>
              <option value="oral">กลืนได้ (Oral)</option>
              <option value="ng">ให้ทาง NG tube</option>
              <option value="peg">Gastrostomy (PEG ≥ 16 Fr)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">eGFR (mL/min) ถ้ามีไตเสื่อม</label>
            <input type="number" min="0" step="any" id="opEgfr" class="${IN}" placeholder="เว้นว่างถ้าไตปกติ" ${ON}>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">ระบุ Target OME เอง (mg/day)</label>
            <input type="number" min="0" step="any" id="opManualOme" class="${IN}" placeholder="เว้นว่างให้คำนวณอัตโนมัติ" ${ON}>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="opHepatic" ${ON}> มีภาวะตับบกพร่อง</label>
      </div>

      <div id="opStepCard"></div>

      <div id="opRegimenCard" class="hidden bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h4 class="font-semibold text-gray-800">2) เลือกสูตรยา (Step 3: Strong opioid)</h4>
        <div id="opTarget" class="text-sm"></div>
        <div id="opOptions" class="grid grid-cols-1 md:grid-cols-2 gap-2"></div>
        <input type="hidden" id="opSelected" value="">
      </div>

      <div id="opDispenseCard" class="hidden bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h4 class="font-semibold text-gray-800">3) จ่ายยา</h4>
        <div class="flex flex-wrap items-end gap-2">
          <div class="w-32"><label class="block text-xs font-medium text-gray-600 mb-1">จำนวนวันนัด</label>
            <input type="number" min="1" id="opDays" value="14" class="${IN}" ${ON}></div>
          ${[14, 28, 56, 84].map(d => `<button type="button" class="op-chip" onclick="window.pmkOpioidSetDays(${d})">${d} วัน</button>`).join('')}
        </div>
        <div id="opDispenseList" class="text-sm space-y-1"></div>
      </div>

      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h4 class="font-semibold text-gray-800">4) DRP / หมายเหตุ</h4>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="opLaxative" ${ON}> ได้ยาระบายป้องกันท้องผูกแล้ว</label>
        <textarea id="opDrp" rows="2" class="${IN}" placeholder="DRP / คำแนะนำ / ประสานแพทย์" ${ON}></textarea>
      </div>
    </div>`;
  }

  function renderConvert() {
    return `
    <div id="opSec-convert" class="op-sec hidden space-y-4">
      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h4 class="font-semibold text-gray-800">Opioid Converter</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label class="block text-xs font-medium text-gray-600 mb-1">ยาเดิม</label>
            <select id="opConvDrug" class="${IN}" ${ON}>${drugOptions('morphine_po')}</select></div>
          <div><label class="block text-xs font-medium text-gray-600 mb-1">ขนาดรวมต่อวัน <span id="opConvUnit">(mg/day)</span></label>
            <input type="number" min="0" step="any" id="opConvDose" class="${IN}" placeholder="0" ${ON}></div>
          <div><label class="block text-xs font-medium text-gray-600 mb-1">ลดขนาดเมื่อเปลี่ยนชนิดยา</label>
            <select id="opConvReduce" class="${IN}" ${ON}>
              <option value="30" selected>ลด 30%</option><option value="25">ลด 25%</option><option value="50">ลด 50%</option><option value="0">ไม่ลด (ยังปวดไม่คุม)</option>
            </select></div>
        </div>
        <div id="opConvResult" class="hidden op-result rounded-lg p-3 text-sm"></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h4 class="font-semibold text-gray-800">ตาราง Fentanyl patch (Durogesic SmPC)</h4>
        <div class="overflow-x-auto"><table class="op-table text-sm">
          <thead><tr><th>Oral morphine (mg/day)<br>เปลี่ยนยา/ไม่คงที่ (150:1)</th><th>Patch (mcg/hr)</th><th>Oral morphine (mg/day)<br>คงที่ ทนยาดี (100:1)</th></tr></thead>
          <tbody>${PATCH_T2.map(([lt, mcg], i) => {
            const lo2 = i === 0 ? '< 90' : `${PATCH_T2[i - 1][0]}–${lt - 1}`;
            const lo3 = i === 0 ? '≤ 44' : `${PATCH_T3[i - 1][0]}–${PATCH_T3[i][0] - 1}`;
            return `<tr><td>${lo2}</td><td class="font-semibold">${mcg}</td><td>${lo3}</td></tr>`;
          }).join('')}</tbody></table></div>
      </div>
      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <h4 class="font-semibold text-gray-800">ตารางอ้างอิง</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <figure>${img('EOD.webp', 'Equianalgesic opioid dosing')}<figcaption class="text-xs text-gray-500 mt-1">Equianalgesic (McPherson, ASHP 2010)</figcaption></figure>
          <figure>${img('FMC.webp', 'Fentanyl matrix conversion')}<figcaption class="text-xs text-gray-500 mt-1">ตาราง fentanyl matrix จากแอปเดิม (สำหรับผู้ป่วย opioid-tolerant ≥ 60 mg/day)</figcaption></figure>
        </div>
      </div>
    </div>`;
  }

  function crushTag(p) {
    const map = { yes: ['op-tag-ok', 'บดได้'], open: ['op-tag-warn', 'แกะแคปซูลได้'], no: ['op-tag-no', 'ห้ามบด'], patch: ['op-tag-patch', 'แผ่นแปะ'], inj: ['op-tag-inj', 'ยาฉีด'] };
    const [cls, t] = map[p.crush] || ['', ''];
    return `<span class="op-tag ${cls}">${t}</span>`;
  }
  function renderProfile() {
    return `
    <div id="opSec-profile" class="op-sec hidden space-y-3">
      <input type="search" id="opDrugSearch" class="${IN}" placeholder="ค้นชื่อยา เช่น Morphine, Kapanol" oninput="window.pmkOpioidFilter()">
      <div id="opDrugGrid" class="op-drug-grid">
        ${PRODUCTS.map(p => `
          <div class="op-drug-card" data-name="${esc((p.name + ' ' + p.strength).toLowerCase())}">
            ${img(p.image, p.name + ' ' + p.strength, 'op-drug-img')}
            <div class="font-semibold text-sm">${esc(p.name)}</div>
            <div class="text-xs text-gray-600">${esc(p.strength)}</div>
            ${crushTag(p)}
            <div class="text-[11px] text-gray-600 leading-snug">${esc(p.note)}</div>
            <div class="text-[11px] text-gray-500">Onset ${esc(p.onset)} · ออกฤทธิ์ ${esc(p.duration)}</div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  function renderAssess() {
    const tool = (key) => {
      const t = ASSESS[key];
      return `<details class="op-details bg-white rounded-xl border border-gray-200 p-3">
        <summary class="font-semibold text-gray-800 cursor-pointer">${esc(t.title)} <span id="opScore-${key}" class="op-badge ml-1"></span></summary>
        <div class="mt-3 space-y-2">
          ${t.items.map(([q, opts], i) => `<div><div class="text-xs font-medium text-gray-600 mb-1">${esc(q)}</div><div class="flex flex-wrap gap-2 text-sm">
            ${opts.map(([lbl, v]) => `<label class="op-opt"><input type="radio" name="opA_${key}_${i}" value="${v}" ${ON}> ${esc(lbl)} (${v})</label>`).join('')}
          </div></div>`).join('')}
          <div id="opResult-${key}" class="text-sm"></div>
          ${t.img ? img(t.img, t.title) : ''}
        </div></details>`;
    };
    return `
    <div id="opSec-assess" class="op-sec hidden space-y-3">
      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
        <h4 class="font-semibold text-gray-800">WHO Analgesic Ladder</h4>
        <div class="op-ladder text-sm"><div>0 ไม่ปวด</div><div>1-3 Mild: Step 1 Paracetamol/NSAIDs</div><div>4-6 Moderate: Step 2 Weak opioid</div><div>7-10 Severe: Step 3 Strong opioid</div></div>
        ${img('WHOAL.webp', 'WHO analgesic ladder')}
      </div>
      <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
        <h4 class="font-semibold text-gray-800">A. บอกความปวดเองได้</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${img('NRS.webp', 'NRS')}${img('VAS.webp', 'Verbal and VAS')}${img('WBFACES.webp', 'Wong-Baker FACES')}</div>
      </div>
      <h4 class="font-semibold text-gray-800">B. บอกความปวดเองไม่ได้</h4>
      ${tool('nips')}${tool('cheops')}${tool('bps')}${tool('cpot')}
      <div class="bg-white p-4 rounded-xl border border-gray-200">
        <h4 class="font-semibold text-gray-800 mb-2">Sedation score</h4>
        <table class="op-table text-sm"><tbody>
          <tr><td>0</td><td>ตื่นดี</td></tr><tr><td>1</td><td>ง่วงบางครั้ง ปลุกตื่นง่าย</td></tr>
          <tr><td>2</td><td>ง่วงบ่อย ปลุกตื่นง่าย (ลดขนาดยา 25-50%)</td></tr>
          <tr><td class="text-red-700 font-semibold">3</td><td>หลับ ปลุกตื่นยาก (หยุดยา + Naloxone)</td></tr>
        </tbody></table>
      </div>
    </div>`;
  }

  function renderCounsel() {
    return `
    <div id="opSec-counsel" class="op-sec hidden space-y-3">
      <div class="bg-white p-4 rounded-xl border border-red-200 space-y-1 text-sm">
        <h4 class="font-semibold text-red-800">Naloxone (แก้พิษ opioid)</h4>
        <p><b>ข้อบ่งชี้:</b> Sedation score 3, RR &lt; 8/min, pinpoint pupils</p>
        <p><b>ผสม:</b> Naloxone 0.4 mg (1 amp) + NSS 9 ml = 10 ml (0.04 mg/ml)</p>
        <p><b>ให้:</b> IV 1-2 ml (0.04-0.08 mg) ทุก 2-3 นาที จนหายใจได้เอง (RR > 10) สังเกตต่อเนื่อง (naloxone ออกฤทธิ์สั้นกว่า opioid ออกฤทธิ์ยาว/แผ่นแปะ อาจต้องให้ซ้ำ)</p>
      </div>
      <div class="bg-white p-4 rounded-xl border border-gray-200 text-sm">
        <h4 class="font-semibold text-gray-800 mb-2">Adjuvant analgesics</h4>
        <table class="op-table"><thead><tr><th>กลุ่ม</th><th>ยา</th><th>ขนาดเริ่มต้น</th></tr></thead><tbody>
          <tr><td>Anticonvulsant (neuropathic)</td><td>Gabapentin<br>Pregabalin</td><td>100-300 mg hs<br>75 mg hs</td></tr>
          <tr><td>TCA (neuropathic)</td><td>Amitriptyline<br>Nortriptyline</td><td>10-25 mg hs<br>10-25 mg hs</td></tr>
          <tr><td>Steroid (bone/liver capsule/ICP)</td><td>Dexamethasone</td><td>4-8 mg OD-BID</td></tr>
          <tr><td>Antispasmodic (colic)</td><td>Hyoscine butylbromide</td><td>10 mg q 6-8 hr</td></tr>
        </tbody></table>
      </div>
      <div class="bg-white p-4 rounded-xl border border-gray-200 text-sm space-y-1">
        <h4 class="font-semibold text-gray-800">ยาระบายป้องกันท้องผูก (ให้คู่ opioid เสมอ)</h4>
        <p>Stimulant: Senokot 2 tab hs หรือ Bisacodyl 5-10 mg hs</p>
        <p>Osmotic: MOM 30 ml hs หรือ Lactulose 15-30 ml hs</p>
      </div>
      <div class="bg-white p-4 rounded-xl border border-gray-200 text-sm space-y-1">
        <h4 class="font-semibold text-gray-800">ไต/ตับบกพร่อง</h4>
        <p>Morphine: eGFR 10-50 ใช้ ~75% ของขนาดปกติ, eGFR &lt; 10 ใช้ ~50% · eGFR &lt; 30 พิจารณาเลี่ยง morphine/codeine (metabolite สะสม) เลือก fentanyl และปรึกษา palliative</p>
        <p>Pethidine: เลี่ยงในไตเสื่อมและการใช้ระยะยาว (normeperidine สะสม ชัก)</p>
        <p>Tramadol: CrCl &lt; 30 ให้ทุก 12 ชม. สูงสุด 200 mg/วัน · ตับแข็ง 50 mg ทุก 12 ชม.</p>
        <p>ตับบกพร่อง: เริ่มขนาดต่ำ เว้นระยะห่างขึ้น และติดตามอาการง่วงซึม</p>
      </div>
      <div class="bg-white p-4 rounded-xl border border-gray-200 text-sm">
        <h4 class="font-semibold text-gray-800 mb-1">คำแนะนำผู้ป่วย</h4>
        <ul class="list-disc pl-5 space-y-1">
          <li>คลื่นไส้/อาเจียน มักเป็น 3-5 วันแรก ถ้ามากให้ Metoclopramide หรือ Domperidone ก่อนอาหาร</li>
          <li>ง่วงซึมช่วงปรับยา ระวังการลุกเดิน ห้ามขับรถหรือทำงานกับเครื่องจักร</li>
          <li>แผ่นแปะ Fentanyl: ห้ามตัดแผ่น ห้ามโดนความร้อน (กระเป๋าน้ำร้อน ซาวน่า แช่น้ำร้อน) แจ้งแพทย์ถ้ามีไข้สูง แปะผิวแห้งไม่มีขน เปลี่ยนทุก 72 ชม. แผ่นหลุดให้แปะแผ่นใหม่</li>
          <li>MST: กลืนทั้งเม็ด ห้ามหัก บด หรือเคี้ยว · Kapanol: แกะแคปซูลโรยอาหารอ่อนหรือผสมน้ำได้ แต่ห้ามบด/เคี้ยวเม็ดข้างใน</li>
          <li>ยาแก้ปวดฉุกเฉิน (rescue): ใช้เมื่อปวดแทรก ซ้ำได้ทุก 2-4 ชม. ถ้าต้องใช้วันละ ≥ 3-4 ครั้ง ให้แจ้งแพทย์/เภสัชเพื่อปรับยาหลัก</li>
        </ul>
        <h4 class="font-semibold text-red-800 mt-3 mb-1">สัญญาณอันตราย รีบมาโรงพยาบาล</h4>
        <ul class="list-disc pl-5 space-y-1"><li>ปลุกตื่นยาก หลับลึกผิดปกติ</li><li>หายใจช้า (&lt; 8 ครั้ง/นาที)</li><li>สับสน กระวนกระวาย เห็นภาพหลอน</li></ul>
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------
  function getStatus() { return radio('opStatus') || 'naive'; }
  function painScore() { const p = parseInt(val('opPain'), 10); return Number.isFinite(p) ? p : 0; }
  function baseOme() { return getStatus() === 'user' ? toOme(val('opPrevDrug'), num('opPrevDose')) : 0; }

  function plan() {
    const pain = painScore();
    const status = getStatus();
    const manual = num('opManualOme');
    const egfr = num('opEgfr');
    const rf = renalFactor(egfr);
    const base = baseOme();
    let step = 3; let target = 0; let info = '';
    if (Number.isFinite(manual) && manual > 0) {
      target = manual; info = 'กำหนด Target OME เอง';
    } else if (status === 'naive') {
      if (pain <= 3) step = 1;
      else if (pain <= 6) step = 2;
      else { target = 20; info = 'เริ่มยาในผู้ป่วยใหม่ (20 mg OME/day)'; }
    } else {
      const pct = titratePct(pain, status);
      target = round1(base * (1 + pct / 100));
      info = pct ? `เพิ่มจากยาเดิม ${pct}%` : 'คงขนาดเดิม (ปวดน้อย)';
    }
    const safe = round1(target * rf);
    return { pain, status, step, target, safe, info, rf, egfr, base, route: val('opRoute') || 'oral' };
  }

  function currentOptions(p) {
    p = p || plan();
    if (p.step !== 3) return [];
    return buildOptions({ target: p.safe, route: p.route, status: p.status, baseOme: p.base, renalFactor: p.rf });
  }
  function selectedOption(p) {
    const opts = currentOptions(p);
    if (!opts.length) return null;
    const idx = parseInt(val('opSelected'), 10);
    return opts[Number.isFinite(idx) && idx >= 0 && idx < opts.length ? idx : 0];
  }

  function painBadge(p) {
    const el = $('opPainBadge'); if (!el) return;
    const t = p >= 7 ? 'Severe' : p >= 4 ? 'Moderate' : p >= 1 ? 'Mild' : 'No pain';
    el.textContent = `${p} (${t})`;
    el.className = 'op-badge ' + (p >= 7 ? 'op-badge-red' : p >= 4 ? 'op-badge-amber' : 'op-badge-green');
  }

  function assessScore(key) {
    const t = ASSESS[key]; let total = 0; let done = 0;
    t.items.forEach((_, i) => { const v = radio(`opA_${key}_${i}`); if (v !== '') { total += Number(v); done++; } });
    return { total, complete: done === t.items.length, any: done > 0, pain: total >= t.threshold, t };
  }

  function renderDerived() {
    if (!$('form-OPIOID')) return;
    const p = plan();
    painBadge(p.pain);
    const prevBox = $('opPrevBox');
    if (prevBox) prevBox.classList.toggle('hidden', p.status !== 'user');
    if ($('opPrevOme')) $('opPrevOme').textContent = p.base ? `= ${fmt(p.base)} mg OME/day` : '';

    // Step card
    const stepCard = $('opStepCard');
    if (stepCard) {
      if (p.step === 1) setHtml(stepCard, `<div class="bg-white p-4 rounded-xl border border-gray-200 text-sm space-y-1"><h4 class="font-semibold text-gray-800">Step 1: Mild pain (Non-opioid)</h4>
        <p>Paracetamol 500-1000 mg q 4-6 hr (max 4 g/day)</p><p>Ibuprofen 400 mg q 8 hr pc · Naproxen 250 mg q 12 hr pc · Diclofenac 25 mg q 8 hr pc</p></div>`);
      else if (p.step === 2) setHtml(stepCard, `<div class="bg-white p-4 rounded-xl border border-gray-200 text-sm space-y-1"><h4 class="font-semibold text-gray-800">Step 2: Moderate pain (Weak opioid + Non-opioid)</h4>
        <p>Tramadol 50-100 mg q 4-6 hr (max 400 mg/day; CrCl &lt; 30 max 200 mg/day)</p><p>Codeine 30-60 mg q 4-6 hr (max 240 mg/day)</p><p class="text-gray-600">ระวัง serotonin syndrome (tramadol) และท้องผูก</p></div>`);
      else setHtml(stepCard, '');
    }

    // Regimen options
    const regCard = $('opRegimenCard'); const dispCard = $('opDispenseCard');
    const opts = currentOptions(p);
    const show = p.step === 3 && p.safe > 0;
    if (regCard) regCard.classList.toggle('hidden', !show);
    if (dispCard) dispCard.classList.toggle('hidden', !show || !opts.length);
    if (show && $('opTarget')) {
      const warn = [];
      if (p.rf < 1) warn.push(`ไตเสื่อม eGFR ${fmt(p.egfr)}: ลดขนาด ${Math.round((1 - p.rf) * 100)}%`);
      if (Number.isFinite(p.egfr) && p.egfr < 30) warn.push('eGFR < 30: พิจารณาเลี่ยง morphine ใช้ fentanyl และปรึกษาแพทย์');
      if (p.route === 'ng') warn.push('NG tube: ห้ามบด MST, Kapanol ไม่ให้ทาง NG');
      if (p.status === 'naive') warn.push('ผู้ป่วยใหม่: ไม่ใช้แผ่นแปะ fentanyl');
      else if (p.base < 60) warn.push('ยาเดิม < 60 mg OME/day: ยังไม่ถือว่า opioid-tolerant จึงไม่แนะนำแผ่นแปะ');
      setHtml($('opTarget'), `<div><b>Target OME:</b> ~${fmt(p.safe)} mg/day <span class="text-gray-600">(${esc(p.info)})</span></div>` +
        warn.map(w => `<div class="op-warn">${esc(w)}</div>`).join(''));
    }
    const selIdx = (() => { const i = parseInt(val('opSelected'), 10); return Number.isFinite(i) && i >= 0 && i < opts.length ? i : 0; })();
    if ($('opOptions')) {
      setHtml($('opOptions'), opts.length ? opts.map((o, i) => `
        <button type="button" class="op-option${i === selIdx ? ' selected' : ''}" onclick="window.pmkOpioidSelect(${i})">
          <div class="flex justify-between gap-2"><b>${esc(o.name)}</b><span class="op-tag ${o.renal ? 'op-tag-no' : 'op-tag-ok'}">${o.renal ? 'ปรับตามไต' : 'มาตรฐาน'}</span></div>
          <div>${esc(o.regimen)}</div><div class="text-xs text-gray-600">รวม ${fmt(o.dailyMg)} ${o.kind === 'patch' ? 'mg OME' : 'mg'}/day</div>
        </button>`).join('') : '<p class="text-sm text-gray-600">ไม่มีสูตรที่เหมาะ ปรึกษาแพทย์/palliative</p>');
    }
    const sel = opts[selIdx];
    if ($('opDispenseList')) {
      const d = dispense(sel, num('opDays'));
      setHtml($('opDispenseList'), sel ? `
        <div><b>ATC:</b> ${esc(sel.name)} ${esc(sel.regimen)}</div>
        ${d.items.map(it => `<div class="op-disp">จ่าย ${esc(it.label)}: ${it.qty} ${it.unit}</div>`).join('')}
        ${d.rescue ? `<div class="mt-2"><b>Rescue:</b> Morphine syrup 2 mg/ml ${d.rescue.ml} ml (${d.rescue.mg} mg) q 2-4 hr prn</div>
        <div class="op-disp">จ่าย Morphine syrup 60 ml: ${d.bottles} ขวด (คิดวันละ 4 ครั้ง)</div>` : ''}` : '');
    }

    // Converter
    const cd = val('opConvDrug');
    if ($('opConvUnit')) $('opConvUnit').textContent = `(${(DRUGS[cd] || {}).unit || 'mg/day'})`;
    const res = $('opConvResult');
    if (res) {
      const dose = num('opConvDose');
      if (Number.isFinite(dose) && dose > 0) {
        const c = convert(cd, dose, val('opConvReduce'));
        const patch = (v) => v ? `${v} mcg/hr` : (c.ome >= 1125 ? 'เกินตาราง ปรึกษาผู้เชี่ยวชาญ' : '-');
        res.classList.remove('hidden');
        setHtml(res, `
          <div class="text-base"><b>OME:</b> ${fmt(c.ome)} mg/day${c.reducePct ? ` → หลังลด ${c.reducePct}%: <b>${fmt(c.target)}</b> mg/day` : ''}</div>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div><b>Morphine PO:</b><br>${fmt(c.morphinePo)} mg/day</div>
            <div><b>Morphine Inj:</b><br>${fmt(c.morphineInj)} mg/day</div>
            <div><b>Oxycodone PO:</b><br>${fmt(c.oxycodonePo)} mg/day</div>
            <div><b>Hydromorphone PO:</b><br>${fmt(c.hydromorphonePo)} mg/day</div>
            <div class="col-span-2"><b>Fentanyl patch:</b> ${DRUGS[cd] && DRUGS[cd].patch ? 'ยาเดิมเป็นแผ่นแปะ' : `${patch(c.patchT2)} (เปลี่ยนยา/ไม่คงที่) · ${patch(c.patchT3)} (คงที่ ทนยาดี)`}</div>
          </div>
          ${DRUGS[cd] && DRUGS[cd].morphine ? '<div class="text-xs text-gray-600 mt-1">Morphine เปลี่ยนแค่ทางให้ยา ไม่ต้องลดขนาด</div>' : ''}
          ${!c.opioidTolerant && !(DRUGS[cd] || {}).patch ? '<div class="op-warn mt-1">OME &lt; 60 mg/day: ยังไม่ถือว่า opioid-tolerant ไม่แนะนำแผ่นแปะ</div>' : ''}
          ${cd === 'methadone_po' ? '<div class="op-warn mt-1">Methadone ×4.7 (CDC 2022) ใช้ประเมิน OME เท่านั้น ห้ามใช้คำนวณขนาดเมื่อเปลี่ยนไป/มาจาก methadone (ครึ่งชีวิตยาวและไม่แน่นอน) ปรึกษาผู้เชี่ยวชาญ</div>' : ''}
          ${cd === 'fentanyl_patch' ? '<div class="text-xs text-gray-600 mt-1">หลังลอกแผ่น ระดับยายังอยู่ ≥ 20 ชม. เริ่มยาใหม่ขนาดต่ำแล้วค่อยเพิ่ม</div>' : ''}`);
      } else { res.classList.add('hidden'); setHtml(res, ''); }
    }

    // Assessment tools
    Object.keys(ASSESS).forEach(k => {
      const s = assessScore(k);
      const b = $('opScore-' + k); const r = $('opResult-' + k);
      if (b) { b.textContent = s.any ? `${s.total}` : ''; b.className = 'op-badge ml-1' + (s.complete ? (s.pain ? ' op-badge-red' : ' op-badge-green') : ''); }
      if (r) setHtml(r, s.complete ? `<b>คะแนนรวม ${s.total}:</b> ${esc(s.pain ? s.t.msgPain : s.t.msgSafe)}` : '');
    });
  }

  function refresh() {
    renderDerived();
    if (typeof window.generateOutput === 'function') window.generateOutput();
    if (typeof window.triggerAutoSaveDraft === 'function') window.triggerAutoSaveDraft();
  }

  // ---------------------------------------------------------------
  // PMK note / row / alerts
  // ---------------------------------------------------------------
  function statusText(p) {
    if (p.status !== 'user') return 'Opioid-naive';
    const d = DRUGS[val('opPrevDrug')];
    const dose = val('opPrevDose');
    let s = 'ใช้ opioid อยู่';
    if (d && dose) s += `: ${d.label} ${dose} ${d.unit} (OME ${fmt(p.base)} mg/day)`;
    if (val('opPrevText')) s += ` [${val('opPrevText')}]`;
    return s;
  }
  function regimenText(sel) { return sel ? `${sel.name} ${sel.regimen}` : ''; }
  function rescueText(sel) {
    const r = sel ? rescueDose(sel.dailyMg) : null;
    return r ? `Morphine syrup 2 mg/ml ${r.ml} ml (${r.mg} mg) q 2-4 hr prn` : '';
  }
  function assessLines() {
    return Object.keys(ASSESS).map(k => { const s = assessScore(k); return s.complete ? `${s.t.title.split(' ')[0]} ${s.total}` : ''; }).filter(Boolean);
  }

  function buildNote() {
    const p = plan();
    const hasAny = p.pain > 0 || p.status === 'user' || val('opDrp') || val('opPharmName') || val('opDx') || val('opManualOme') || val('opConvDose');
    if (!hasAny) return [];
    const out = ['Pharmacist note (Pain management clinic)'];
    if (val('opDx')) out.push(`Dx: ${val('opDx')}`);
    const a = assessLines();
    out.push(`Pain score: ${p.pain}/10${a.length ? ` (${a.join(', ')})` : ''}`);
    out.push(`สถานะ: ${statusText(p)}`);
    if (p.rf < 1) out.push(`eGFR ${fmt(p.egfr)} → ลดขนาด ${Math.round((1 - p.rf) * 100)}%`);
    if (isChecked('opHepatic')) out.push('ตับบกพร่อง: เริ่มขนาดต่ำ ติดตามอาการง่วงซึม');
    if (p.route !== 'oral') out.push(`ทางให้ยา: ${p.route === 'ng' ? 'NG tube' : 'Gastrostomy'}`);
    if (p.step === 1) out.push('แนะนำ: Step 1 Non-opioid (Paracetamol/NSAIDs)');
    else if (p.step === 2) out.push('แนะนำ: Step 2 Weak opioid (Tramadol/Codeine) + Non-opioid');
    else if (p.safe > 0) {
      out.push(`Target OME: ${fmt(p.safe)} mg/day (${p.info})`);
      const sel = selectedOption(p);
      if (sel) {
        out.push(`Regimen: ${regimenText(sel)}`);
        out.push(`Rescue: ${rescueText(sel)}`);
        const d = dispense(sel, num('opDays'));
        out.push(`Dispense ${d.days} วัน: ${d.items.map(i => `${i.label} ${i.qty} ${i.unit}`).join(', ')}${d.rescue ? `, Morphine syrup 60 ml ${d.bottles} ขวด` : ''}`);
      }
    }
    const cdose = num('opConvDose');
    if (Number.isFinite(cdose) && cdose > 0) {
      const cd = val('opConvDrug'); const c = convert(cd, cdose, val('opConvReduce'));
      out.push(`Conversion: ${DRUGS[cd].label} ${cdose} ${DRUGS[cd].unit} = OME ${fmt(c.ome)} mg/day${c.reducePct ? ` (ลด ${c.reducePct}% → ${fmt(c.target)})` : ''}`);
    }
    out.push(`ยาระบาย: ${isChecked('opLaxative') ? 'ได้รับแล้ว' : 'ยังไม่ได้รับ'}`);
    if (val('opDrp')) out.push(`DRP: ${val('opDrp')}`);
    const pharm = val('opPharmName');
    if (pharm) out.push(`/${/^(ภก\.|ภญ\.)/.test(pharm) ? pharm : 'ภก.' + pharm}`);
    return out;
  }

  // Button 2 (manual copy) row. Proposed sheet tab "Opioid" columns A-K:
  // Date | HN | Name | Status | Pain | ยาเดิม | OME/day | Regimen | Rescue | DRP | Pharmacist
  function buildRow(defaultDateStr) {
    const p = plan(); const sel = selectedOption(p);
    return [
      val('opVisitDate') || defaultDateStr || todayShortBE(),
      val('hn'), val('ptName'),
      p.status === 'user' ? 'On opioid' : 'Naive',
      String(p.pain),
      p.status === 'user' ? statusText(p).replace(/^ใช้ opioid อยู่:?\s*/, '') : '',
      p.safe > 0 ? fmt(p.safe) : '',
      regimenText(sel), rescueText(sel), val('opDrp'), val('opPharmName')
    ];
  }

  function evalAlerts() {
    const alerts = []; const p = plan(); const src = 'Pain management clinic';
    if (p.step === 3 && p.safe > 0 && !isChecked('opLaxative')) alerts.push({ level: 'warn', title: 'ยังไม่ได้ยาระบาย', detail: 'ผู้ป่วยที่ได้ opioid ควรได้ยาระบายป้องกันท้องผูก (stimulant ± osmotic)', source: src });
    if (Number.isFinite(p.egfr) && p.egfr < 30) alerts.push({ level: 'danger', title: `eGFR ${fmt(p.egfr)} (< 30)`, detail: 'Morphine/codeine metabolite สะสม พิจารณาเลี่ยง ใช้ fentanyl และปรึกษาแพทย์', source: src });
    if (p.status === 'user' && val('opPrevDrug') === 'pethidine_inj') alerts.push({ level: 'warn', title: 'Pethidine', detail: 'ไม่แนะนำใช้ระยะยาว/ในไตเสื่อม (normeperidine สะสม ชัก)', source: src });
    if (p.safe >= 90) alerts.push({ level: 'info', title: `Target OME ${fmt(p.safe)} mg/day`, detail: 'ขนาดสูง ทบทวนประโยชน์/ความเสี่ยง และเตรียม naloxone', source: src });
    if (p.route === 'ng') alerts.push({ level: 'info', title: 'ให้ยาทาง NG tube', detail: 'ห้ามบด MST · Kapanol ไม่ให้ทาง NG (ให้ทาง gastrostomy ≥ 16 Fr ได้) · ใช้ morphine syrup หรือแผ่นแปะ', source: src });
    return alerts;
  }

  // ---------------------------------------------------------------
  // UI actions
  // ---------------------------------------------------------------
  function section(id) {
    SECTIONS.forEach(([s]) => {
      const el = $('opSec-' + s); const b = $('opSubBtn-' + s);
      if (el) el.classList.toggle('hidden', s !== id);
      if (b) { b.classList.toggle('active', s === id); b.setAttribute('aria-selected', s === id ? 'true' : 'false'); }
    });
  }
  function selectOpt(i) { if ($('opSelected')) $('opSelected').value = String(i); refresh(); }
  function setDays(d) { if ($('opDays')) $('opDays').value = String(d); refresh(); }
  function filter() {
    const q = val('opDrugSearch').toLowerCase();
    document.querySelectorAll('#opDrugGrid .op-drug-card').forEach(c => { c.classList.toggle('hidden', !!q && !c.dataset.name.includes(q)); });
  }
  function reset() {
    if ($('opVisitDate')) $('opVisitDate').value = todayShortBE();
    setRadio('opStatus', 'naive');
    if ($('opPain')) $('opPain').value = '0';
    if ($('opDays')) $('opDays').value = '14';
    if ($('opConvReduce')) $('opConvReduce').value = '30';
    if ($('opRoute')) $('opRoute').value = 'oral';
    if ($('opPrevDrug')) $('opPrevDrug').value = 'morphine_po';
    if ($('opConvDrug')) $('opConvDrug').value = 'morphine_po';
    if ($('opSelected')) $('opSelected').value = '';
    section('manage');
    renderDerived();
  }
  function getState() { return {}; }
  function setState() { setTimeout(renderDerived, 0); }

  window.pmkOpioidRender = render;
  window.pmkOpioidRefresh = refresh;
  window.pmkOpioidReset = reset;
  window.pmkOpioidBuildNote = buildNote;
  window.pmkOpioidBuildRow = buildRow;
  window.pmkOpioidEvalAlerts = evalAlerts;
  window.pmkOpioidGetState = getState;
  window.pmkOpioidSetState = setState;
  window.pmkOpioidPharmName = () => val('opPharmName');
  window.pmkOpioidSection = section;
  window.pmkOpioidSelect = selectOpt;
  window.pmkOpioidSetDays = setDays;
  window.pmkOpioidFilter = filter;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
