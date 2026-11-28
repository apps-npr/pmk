/**
 * PMK tool #3: IV drug reference (dilution, diluent, rate, stability).
 * Ported from sony50369-yellow/Drug (drugs.json, 124 entries) with a clinical
 * review pass. Data lives in ivdrug/drugs.json; every change from the original
 * is shown on the card (fx = fixed, ad = added, ck = please verify).
 * Unlike the original app, the "อื่นๆ" route (SC, nebulization...) and the
 * warnings list are shown too (the original card dropped them).
 */
(function (global) {
  'use strict';

  const DATA_URL = 'ivdrug/drugs.json';
  const DOC_BASE = 'ivdrug/docs/';
  const MAX_HITS = 30;
  const ROUTES = [['im', 'IM'], ['iv', 'IV direct'], ['inf', 'IV infusion'], ['oth', 'อื่นๆ']];

  let DRUGS = null;
  let loading = null;
  let rootEl = null;
  const state = { q: '', openIdx: -1 };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function titleOf(d) { return String(d.n || '').split('\n')[0].trim(); }
  function subtitleOf(d) { return String(d.n || '').split('\n').slice(1).join(' ').trim(); }

  /** Case-insensitive match on drug name (all lines) and code. Empty query = all. */
  function searchDrugs(list, q) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return list.map((d, i) => i);
    const out = [];
    list.forEach((d, i) => {
      const hay = (String(d.n || '') + ' ' + String(d.c || '')).toLowerCase();
      if (hay.includes(s)) out.push(i);
    });
    return out;
  }

  /** mg / mL concentration. Returns null when inputs are not positive numbers. */
  function concentration(mg, ml) {
    const a = Number(mg), b = Number(ml);
    if (!(a > 0) || !(b > 0)) return null;
    const mgPerMl = a / b;
    return { mgPerMl, mcgPerMl: mgPerMl * 1000 };
  }
  function fmtNum(n) {
    if (!isFinite(n)) return '-';
    const r = Math.round(n * 1000) / 1000;
    return String(r);
  }

  function reviewCount(d) {
    return (d.fx || []).length + (d.ad || []).length + (d.ck || []).length;
  }

  function load() {
    if (DRUGS) return Promise.resolve(DRUGS);
    if (loading) return loading;
    loading = fetch(DATA_URL)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((j) => { if (!Array.isArray(j)) throw new Error('bad data'); DRUGS = j; return j; })
      .finally(() => { loading = null; });
    return loading;
  }

  function badge(flag, label) {
    const f = flag || '—';
    const cls = f === '✓' ? 'ok' : (f === '✕' ? 'no' : 'na');
    const aria = f === '✓' ? 'ให้ได้' : (f === '✕' ? 'ห้ามให้' : 'ไม่มีข้อมูล');
    return `<span class="ivd-badge ivd-${cls}" aria-label="${esc(label)}: ${aria}">${esc(label)}: ${esc(f)}</span>`;
  }

  function highlight(text, q) {
    const t = esc(text);
    const s = String(q || '').trim();
    if (!s) return t;
    try { return t.replace(new RegExp(escRe(esc(s)), 'ig'), (m) => `<mark>${m}</mark>`); } catch (e) { return t; }
  }

  function listHtml(hits, q) {
    if (!hits.length) return '<p class="ivd-empty">ไม่พบชื่อยา</p>';
    const shown = q ? hits.slice(0, MAX_HITS) : hits;
    const more = q && hits.length > MAX_HITS ? `<p class="ivd-more">แสดง ${MAX_HITS} จาก ${hits.length} รายการ พิมพ์เพิ่มเพื่อกรอง</p>` : '';
    return shown.map((i) => {
      const d = DRUGS[i];
      const sub = subtitleOf(d);
      const flag = (d.fx || []).length ? '<span class="ivd-chip-fx" title="มีการแก้ไขจากต้นฉบับ">แก้ไข</span>' : ((d.ck || []).length ? '<span class="ivd-chip-ck" title="มีข้อควรตรวจสอบ">ตรวจสอบ</span>' : '');
      return `<button type="button" class="ivd-item" data-idx="${i}">
        <span class="ivd-item-main"><span class="ivd-item-name">${highlight(titleOf(d), q)}</span>${sub ? `<span class="ivd-item-sub">${esc(sub)}</span>` : ''}</span>${flag}
      </button>`;
    }).join('') + more;
  }

  function reviewHtml(d) {
    const fx = d.fx || [], ad = d.ad || [], ck = d.ck || [];
    if (!fx.length && !ad.length && !ck.length) return '';
    const block = (cls, title, arr) => arr.length ? `<div class="ivd-rv ${cls}"><div class="ivd-rv-t">${title}</div><ul>${arr.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '';
    return `<div class="ivd-review">
      ${block('ivd-rv-fx', 'แก้ไขจากต้นฉบับ (ผ่านการรีวิวแล้ว)', fx)}
      ${block('ivd-rv-ad', 'ข้อมูลที่เพิ่มจากการรีวิว', ad)}
      ${block('ivd-rv-ck', 'ควรตรวจสอบ (ยังคงข้อความเดิมไว้)', ck)}
    </div>`;
  }

  function cardHtml(d) {
    const r = d.r || {};
    const badges = ROUTES.map(([k, label]) => badge(r[k] && r[k][0], label)).join('');
    const blocks = ROUTES.map(([k, label]) => {
      const t = r[k] && r[k][1];
      return t && String(t).trim() ? `<div class="ivd-route"><div class="ivd-sec-t">${esc(label)}</div><div>${nl2br(t)}</div></div>` : '';
    }).join('');
    const pdfs = (d.p || []).map((p) => `<a class="ivd-pdf" href="${esc(DOC_BASE + p.f)}" target="_blank" rel="noopener">📄 ${esc(p.l)}</a>`).join('');
    const warn = (d.w || []).length ? `<div class="ivd-warn"><ul>${d.w.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
    const sub = subtitleOf(d);
    return `
      <button type="button" class="ivd-back" data-act="back">← ค้นหายา</button>
      <h3 class="ivd-name">${esc(titleOf(d))}</h3>
      ${sub ? `<p class="ivd-subname">${nl2br(sub)}</p>` : ''}
      <div class="ivd-meta">รหัส: ${nl2br(d.c || '-')} ${pdfs}</div>
      <div class="ivd-badges">${badges}</div>
      ${warn}
      ${reviewHtml(d)}
      <div class="ivd-sec"><div class="ivd-sec-t">ข้อบ่งใช้</div><div>${nl2br(d.i) || '-'}</div></div>
      <div class="ivd-sec"><div class="ivd-sec-t">สารทำละลาย</div><div>${nl2br(d.d) || '-'}</div></div>
      <div class="ivd-sec"><div class="ivd-sec-t">วิธีใช้ตามทางให้ยา</div>${blocks || '<div>-</div>'}</div>
      <div class="ivd-sec"><div class="ivd-sec-t">บันทึก/หมายเหตุ</div><div>${nl2br(d.nt) || '-'}</div></div>`;
  }

  function shell() {
    return `
      <div class="ivd-wrap">
        <p class="ivd-lead">ข้อมูลการเจือจางและวิธีให้ยาฉีด ${DRUGS ? DRUGS.length : ''} รายการ ผ่านการรีวิวแล้ว ใช้ประกอบการตัดสินใจ ควรเทียบกับฉลากผลิตภัณฑ์จริง</p>
        <div id="ivdSearchView">
          <input id="ivdSearch" class="ivd-search" type="search" inputmode="search" autocomplete="off" placeholder="ค้นหาชื่อยา หรือรหัสยา" aria-label="ค้นหาชื่อยา">
          <div id="ivdList" class="ivd-list" role="list"></div>
        </div>
        <div id="ivdCard" class="ivd-card hidden"></div>
        <details class="ivd-calc">
          <summary>เครื่องคิดความเข้มข้น (mg ÷ mL)</summary>
          <div class="ivd-calc-row">
            <label>ปริมาณยา (mg)<input id="ivdMg" type="number" inputmode="decimal" min="0" step="any"></label>
            <label>ปริมาตรรวม (mL)<input id="ivdMl" type="number" inputmode="decimal" min="0" step="any"></label>
          </div>
          <p id="ivdConc" class="ivd-conc" aria-live="polite">กรอกตัวเลขให้ครบ</p>
        </details>
      </div>`;
  }

  function showList() {
    state.openIdx = -1;
    const sv = rootEl.querySelector('#ivdSearchView');
    const card = rootEl.querySelector('#ivdCard');
    if (sv) sv.classList.remove('hidden');
    if (card) { card.classList.add('hidden'); card.innerHTML = ''; }
  }

  function openDrug(i) {
    const d = DRUGS && DRUGS[i];
    if (!d) return;
    state.openIdx = i;
    const sv = rootEl.querySelector('#ivdSearchView');
    const card = rootEl.querySelector('#ivdCard');
    sv.classList.add('hidden');
    card.innerHTML = cardHtml(d);
    card.classList.remove('hidden');
    const body = document.getElementById('pmkToolsBody');
    if (body) body.scrollTop = 0;
  }

  function refreshList() {
    const el = rootEl.querySelector('#ivdList');
    if (!el || !DRUGS) return;
    el.innerHTML = listHtml(searchDrugs(DRUGS, state.q), state.q.trim());
  }

  function updateConc() {
    const out = rootEl.querySelector('#ivdConc');
    const c = concentration(rootEl.querySelector('#ivdMg').value, rootEl.querySelector('#ivdMl').value);
    out.textContent = c ? `ความเข้มข้น = ${fmtNum(c.mgPerMl)} mg/mL (${fmtNum(c.mcgPerMl)} mcg/mL)` : 'กรอกตัวเลขให้ครบ';
  }

  function bind() {
    rootEl.addEventListener('input', (e) => {
      if (e.target.id === 'ivdSearch') { state.q = e.target.value; refreshList(); }
      else if (e.target.id === 'ivdMg' || e.target.id === 'ivdMl') updateConc();
    });
    rootEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'ivdSearch') {
        const first = rootEl.querySelector('.ivd-item');
        if (first) { e.preventDefault(); openDrug(Number(first.dataset.idx)); }
      }
    });
    rootEl.addEventListener('click', (e) => {
      const it = e.target.closest('.ivd-item');
      if (it) { openDrug(Number(it.dataset.idx)); return; }
      const bk = e.target.closest('[data-act="back"]');
      if (bk) { showList(); const s = rootEl.querySelector('#ivdSearch'); if (s) s.focus({ preventScroll: true }); return; }
      const rt = e.target.closest('[data-act="retry"]');
      if (rt) mount();
    });
  }

  function mount() {
    rootEl.innerHTML = '<p class="ivd-empty">กำลังโหลดข้อมูลยา…</p>';
    load().then(() => {
      rootEl.innerHTML = shell();
      state.q = ''; state.openIdx = -1;
      refreshList();
      rootEl.dataset.mounted = '1';
    }).catch(() => {
      rootEl.innerHTML = '<div class="ivd-empty"><p>โหลดข้อมูลยาไม่สำเร็จ</p><button type="button" class="ivd-back" data-act="retry">ลองใหม่</button></div>';
      delete rootEl.dataset.mounted;
    });
  }

  function render(rootId) {
    rootEl = document.getElementById(rootId || 'ivDrugToolRoot');
    if (!rootEl) return;
    if (!rootEl.dataset.bound) { bind(); rootEl.dataset.bound = '1'; }
    mount();
  }

  global.pmkIvDrug = { render, load, searchDrugs, concentration, titleOf, subtitleOf, reviewCount, esc, DATA_URL, DOC_BASE };
})(typeof window !== 'undefined' ? window : globalThis);
