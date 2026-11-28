/**
 * PMK tool #2: inhaler / nasal spray box-count calculator.
 * Ported from sony50369-yellow/Inhaler with review fixes (DuoResp 160/4.5
 * in-use 90 days per hospital practice; 320/9 stays 180 days per label;
 * puffs/day cap raised to 16; Metzodin oxymetazoline warning).
 */
(function (global) {
  'use strict';

  const IMG_BASE = 'images/inhaler/';
  const FILTERS = ['ทั้งหมด', 'SABA', 'LAMA', 'SAMA+SABA', 'ICS', 'ICS+LABA', 'Nasal'];
  const DAY_CHIPS = [28, 56, 84, 112, 140, 168];
  const PPD_PILLS = [1, 2, 3, 4, 6, 8];
  const PPD_MAX = 16;

  const DRUGS = [
    { id: 'aerotamol_mdi', name: 'Aerotamol MDI', tags: ['SABA'], puffsPerBox: 200, color: '#D9EAF7', image: 'aerotamol.webp' },
    { id: 'aerobidal_mdi', name: 'Aerobidal MDI', tags: ['SAMA+SABA'], puffsPerBox: 200, color: '#BFEFE9', image: 'aerobidal.webp' },
    { id: 'aerotide_mdi_125', name: 'Aerotide MDI 125', tags: ['ICS+LABA'], puffsPerBox: 120, color: '#E9DDF6', image: 'aerotide-125.webp' },
    { id: 'aerotide_mdi_250', name: 'Aerotide MDI 250', tags: ['ICS+LABA'], puffsPerBox: 120, color: '#E9DDF6', image: 'aerotide-250.webp' },
    { id: 'aeronide_mdi_200', name: 'Aeronide MDI 200', tags: ['ICS'], puffsPerBox: 200, color: '#FCE6B1', image: 'aeronide-200.webp' },
    { id: 'flixotide_evo_125', name: 'Flixotide Evohaler 125', tags: ['ICS'], puffsPerBox: 120, color: '#FAD0C9', image: 'flixotide-125.webp' },
    { id: 'seretide_accu_50_250', name: 'Seretide Accuhaler 50/250', tags: ['ICS+LABA'], puffsPerBox: 60, color: '#E0D9FF', image: 'seretide-50-250.webp' },
    { id: 'duorespiromax160', name: 'DuoResp Spiromax 160/4.5', tags: ['ICS+LABA'], puffsPerBox: 120, color: '#F0F6FF', image: 'duoresp-160-4_5.webp', shelfLifeDays: 90, note: 'นับอายุหลังเปิดใช้ 90 วัน ตามแนวทางโรงพยาบาล เพราะยาชื้นและอาจหมดอายุก่อน (ฉลากระบุ 6 เดือน)' },
    { id: 'duoresp_320_9', name: 'DuoResp Spiromax 320/9', tags: ['ICS+LABA'], puffsPerBox: 60, color: '#DDE4EC', image: 'duoresp-320-9.webp', shelfLifeDays: 180 },
    { id: 'spiriva_handihaler_18', name: 'Spiriva Handihaler 18', tags: ['LAMA'], puffsPerBox: 30, color: '#E6F0E6', image: 'spiriva-18.webp', unit: 'แคปซูล/กล่อง' },
    { id: 'avamys_27_5', name: 'AVAMYS 27.5', tags: ['Nasal'], puffsPerBox: 120, color: '#CFF7F8', image: 'avamys.webp', unit: 'ครั้งพ่น/ขวด' },
    { id: 'mometasone_50', name: 'Mometasone 50', tags: ['Nasal'], puffsPerBox: 140, color: '#FFF4B3', image: 'mometasone.webp', unit: 'ครั้งพ่น/ขวด' },
    { id: 'busonase_64', name: 'Busonase 64', tags: ['Nasal'], puffsPerBox: 120, color: '#EAEAEA', image: 'busonase.webp', unit: 'ครั้งพ่น/ขวด' },
    { id: 'metzodin', name: 'Metzodin', tags: ['Nasal'], puffsPerBox: 65, color: '#D9EAF7', image: 'metzodin.webp', unit: 'ครั้งพ่น/ขวด', calcMode: 'durationOnly', boxDurationDays: 56, note: 'พ่นจมูกตามอาการ', warn: 'ยาหดหลอดเลือด (oxymetazoline 0.05%) ไม่ควรใช้ติดต่อกันเกิน 5 วัน เพราะเสี่ยง rebound congestion' },
    { id: 'seretide_25_50', name: 'Seretide Evohaler 25/50', tags: ['ICS+LABA'], puffsPerBox: 120, color: '#E9DDF6', image: 'seretide2550.webp' }
  ];

  function unitOf(d) { return d.unit || 'puff/กล่อง'; }

  function calcBoxes(drug, days, ppd) {
    const D = Number(days || 0);
    const P = Number(ppd || 0);
    let boxes = 0;
    const notes = [];
    let puffsNeeded = 0;
    let byPuffs = 0;
    let byShelf = 0;

    if (drug && drug.calcMode === 'durationOnly') {
      const perBoxDays = Number(drug.boxDurationDays || 56);
      boxes = D > 0 ? Math.ceil(D / perBoxDays) : 1;
      if (drug.note) notes.push(drug.note);
      if (drug.warn) notes.push(drug.warn);
    } else {
      const perBox = Number((drug && drug.puffsPerBox) || 1);
      puffsNeeded = (D > 0 && P > 0) ? (D * P) : 0;
      byPuffs = puffsNeeded > 0 ? Math.ceil(puffsNeeded / perBox) : 0;
      boxes = byPuffs;
      if (drug && drug.note) notes.push(drug.note);
    }

    if (drug && drug.shelfLifeDays) {
      byShelf = D > 0 ? Math.ceil(D / Number(drug.shelfLifeDays)) : 0;
      if (byShelf > boxes) {
        boxes = byShelf;
        notes.push('จ่ายเพิ่มเนื่องจากยาหมดอายุหลังเปิดใช้ (' + drug.shelfLifeDays + ' วัน)');
      }
    }
    return { boxes: boxes, notes: notes, puffsNeeded: puffsNeeded, byPuffs: byPuffs, byShelf: byShelf };
  }

  function drugById(id) { return DRUGS.find(function (d) { return d.id === id; }); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const STATE = { days: '', filter: 'ทั้งหมด', selected: {} };

  let rootEl = null;

  function $(id, el) { return (el || rootEl || document).querySelector('#' + id); }

  function filtered() {
    if (STATE.filter === 'ทั้งหมด') return DRUGS;
    return DRUGS.filter(function (d) { return d.tags.indexOf(STATE.filter) !== -1; });
  }

  function render(rootId) {
    rootEl = document.getElementById(rootId);
    if (!rootEl) return;
    rootEl.innerHTML = [
      '<div class="inh-wrap">',
      '  <p class="inh-lead">คำนวณจำนวนกล่องยาพ่นจากขนาดใช้ต่อวัน × จำนวนวันนัด แล้วปัดขึ้นทั้งกล่อง</p>',
      '  <div class="inh-days">',
      '    <label class="inh-days-lab" for="inhalerDays">จำนวนวันนัด</label>',
      '    <div class="inh-days-row">',
      '      <input id="inhalerDays" type="number" min="0" max="365" inputmode="numeric" placeholder="วัน" value="' + esc(STATE.days) + '">',
      '      <button type="button" id="inhalerClear" class="inh-clear">ล้าง</button>',
      '    </div>',
      '    <div class="inh-chips" id="inhalerChips">',
      DAY_CHIPS.map(function (n) {
        return '<button type="button" class="inh-chip' + (String(STATE.days) === String(n) ? ' active' : '') + '" data-days="' + n + '">' + n + ' วัน</button>';
      }).join(''),
      '    </div>',
      '  </div>',
      '  <p class="inh-hint">พ่น/วัน = จำนวนครั้งพ่นรวมทั้งวัน สำหรับยาพ่นจมูกให้นับรวมทั้งสองข้าง เช่น ข้างละ 2 ครั้ง เช้า-เย็น = 8</p>',
      '  <div class="inh-tabs" id="inhalerTabs"></div>',
      '  <div class="inh-grid" id="inhalerGrid"></div>',
      '  <div class="inh-sum-card">',
      '    <h4 class="inh-h">สรุปการจ่าย</h4>',
      '    <div class="inh-tbl-wrap">',
      '      <table class="inh-tbl">',
      '        <thead><tr><th>ยา</th><th>พ่น/วัน</th><th>วัน</th><th>ต่อกล่อง</th><th>จ่าย</th></tr></thead>',
      '        <tbody id="inhalerSumBody"></tbody>',
      '      </table>',
      '    </div>',
      '    <p class="inh-total">รวม <span id="inhalerSumTotal">0</span> กล่อง</p>',
      '    <button type="button" id="inhalerCopy" class="inh-copy">คัดลอกสรุป</button>',
      '    <span id="inhalerCopyStatus" class="inh-copy-status" hidden></span>',
      '  </div>',
      '  <details class="inh-notes">',
      '    <summary>หมายเหตุและวิธีคิด</summary>',
      '    <ul>',
      '      <li>สูตรทั่วไป: จำนวนกล่อง = ปัดขึ้น (วันนัด × พ่นต่อวัน ÷ puff ต่อกล่อง)</li>',
      '      <li>DuoResp Spiromax 160/4.5 นับอายุหลังเปิดซอง 90 วัน ตามแนวทางโรงพยาบาล เพราะยาชื้นและอาจหมดอายุก่อนกำหนดในฉลาก (ฉลากระบุ 6 เดือน) — ถ้าจำนวนวันที่ใช้เกิน 90 วัน ระบบจะจ่ายเพิ่ม</li>',
      '      <li>DuoResp Spiromax 320/9 นับอายุหลังเปิดซอง 6 เดือน (180 วัน) ตามเอกสารผลิตภัณฑ์ EMA</li>',
      '      <li>Spiriva Handihaler นับเป็น 30 แคปซูล/กล่อง</li>',
      '      <li>Metzodin (oxymetazoline 0.05%) คิดแบบ 1 กล่องต่อ 56 วัน ตามแอปเดิม และไม่ควรใช้ติดต่อกันเกิน 5 วัน</li>',
      '    </ul>',
      '  </details>',
      '</div>'
    ].join('\n');
    bind();
    buildTabs();
    renderCards();
    renderSummary();
    rootEl.dataset.mounted = '1';
  }

  function bind() {
    const days = rootEl.querySelector('#inhalerDays');
    if (days) {
      days.addEventListener('input', function () {
        STATE.days = days.value;
        syncChips();
        computeAll();
      });
    }
    rootEl.querySelector('#inhalerChips').addEventListener('click', function (e) {
      const b = e.target.closest('[data-days]');
      if (!b) return;
      STATE.days = b.getAttribute('data-days');
      if (days) days.value = STATE.days;
      syncChips();
      computeAll();
    });
    rootEl.querySelector('#inhalerClear').addEventListener('click', function () {
      STATE.days = '';
      STATE.selected = {};
      STATE.filter = 'ทั้งหมด';
      if (days) days.value = '';
      syncChips();
      buildTabs();
      renderCards();
      renderSummary();
    });
    rootEl.querySelector('#inhalerTabs').addEventListener('click', function (e) {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      STATE.filter = b.getAttribute('data-filter');
      buildTabs();
      renderCards();
    });
    rootEl.querySelector('#inhalerCopy').addEventListener('click', copySummary);
  }

  function syncChips() {
    rootEl.querySelectorAll('#inhalerChips .inh-chip').forEach(function (b) {
      b.classList.toggle('active', String(STATE.days) === b.getAttribute('data-days'));
    });
  }

  function buildTabs() {
    const tabs = rootEl.querySelector('#inhalerTabs');
    tabs.innerHTML = FILTERS.map(function (g) {
      return '<button type="button" class="inh-tab' + (g === STATE.filter ? ' active' : '') + '" data-filter="' + esc(g) + '">' + esc(g) + '</button>';
    }).join('');
  }

  function renderCards() {
    const host = rootEl.querySelector('#inhalerGrid');
    host.innerHTML = filtered().map(function (d) {
      const sel = !!STATE.selected[d.id];
      const ppd = sel && STATE.selected[d.id].ppd ? STATE.selected[d.id].ppd : '';
      const duration = d.calcMode === 'durationOnly';
      const pack = d.puffsPerBox + ' ' + unitOf(d);
      const img = IMG_BASE + d.image;
      const pills = duration ? '' : (
        '<div class="inh-pills">' +
        PPD_PILLS.map(function (n) {
          return '<button type="button" class="inh-pill' + (String(ppd) === String(n) ? ' active' : '') + '" data-id="' + d.id + '" data-n="' + n + '">' + n + '</button>';
        }).join('') +
        '</div>'
      );
      const controls = duration
        ? '<p class="inh-dur">คิดจากจำนวนวัน (1 กล่อง / ' + (d.boxDurationDays || 56) + ' วัน)</p>'
        : (
          '<div class="inh-ppd">' +
          '<label for="inh-ppd-' + d.id + '">พ่น/วัน</label>' +
          '<input id="inh-ppd-' + d.id + '" type="number" min="0" max="' + PPD_MAX + '" step="1" inputmode="numeric" placeholder="1–' + PPD_MAX + '" value="' + esc(ppd) + '" data-id="' + d.id + '">' +
          '</div>' + pills
        );
      const warn = (sel && d.warn) ? '<p class="inh-card-warn">' + esc(d.warn) + '</p>' : '';
      return [
        '<article class="inh-card' + (sel ? ' selected' : '') + '" data-id="' + d.id + '" style="--inh-tint:' + esc(d.color || '#eef2ff') + '">',
        '  <div class="inh-bar" aria-hidden="true"></div>',
        '  <div class="inh-body">',
        '    <span class="inh-badge" ' + (sel ? '' : 'hidden') + '>จ่าย <b class="inh-badge-n">0</b> กล่อง</span>',
        '    <label class="inh-pick">',
        '      <input type="checkbox" data-id="' + d.id + '"' + (sel ? ' checked' : '') + '>',
        '      <span class="inh-name">' + esc(d.name) + '</span>',
        '    </label>',
        '    <p class="inh-meta">' + esc(d.tags.join(' · ')) + ' · ' + esc(pack) + '</p>',
        controls,
        warn,
        '    <div class="inh-imgwrap">',
        '      <img src="' + esc(img) + '" alt="' + esc(d.name) + '" loading="lazy" width="180" height="180">',
        '    </div>',
        '  </div>',
        '</article>'
      ].join('\n');
    }).join('');

    host.querySelectorAll('input[type="checkbox"][data-id]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        const id = cb.getAttribute('data-id');
        if (cb.checked) {
          const input = host.querySelector('#inh-ppd-' + CSS.escape(id));
          const cur = input ? Number(input.value || 0) : 0;
          if (!STATE.selected[id]) STATE.selected[id] = { ppd: cur };
        } else {
          delete STATE.selected[id];
        }
        updateCard(id, true);
      });
    });
    host.querySelectorAll('input[type="number"][data-id]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const id = inp.getAttribute('data-id');
        let n = Number(inp.value || 0);
        if (n > PPD_MAX) { n = PPD_MAX; inp.value = String(PPD_MAX); }
        if (n < 0) { n = 0; inp.value = '0'; }
        if (n > 0) {
          if (!STATE.selected[id]) STATE.selected[id] = { ppd: n };
          else STATE.selected[id].ppd = n;
        } else if (STATE.selected[id]) {
          STATE.selected[id].ppd = 0;
        }
        if (n > 0) {
          const cb = host.querySelector('input[type="checkbox"][data-id="' + CSS.escape(id) + '"]');
          if (cb) cb.checked = true;
        }
        updateCard(id, true);
      });
    });
    host.querySelectorAll('.inh-pill[data-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const n = Number(btn.getAttribute('data-n'));
        STATE.selected[id] = { ppd: n };
        const input = host.querySelector('#inh-ppd-' + CSS.escape(id));
        if (input) input.value = String(n);
        const cb = host.querySelector('input[type="checkbox"][data-id="' + CSS.escape(id) + '"]');
        if (cb) cb.checked = true;
        updateCard(id, true);
      });
    });
    filtered().forEach(function (d) { updateCard(d.id, false); });
  }

  function updateCard(id, rerenderSum) {
    const card = rootEl.querySelector('.inh-card[data-id="' + CSS.escape(id) + '"]');
    if (!card) {
      if (rerenderSum) renderSummary();
      return;
    }
    const d = drugById(id);
    const picked = !!STATE.selected[id];
    const ppd = (STATE.selected[id] && STATE.selected[id].ppd) || 0;
    const days = Number(STATE.days || 0);
    const r = picked ? calcBoxes(d, days, ppd) : { boxes: 0, notes: [] };
    card.classList.toggle('selected', picked);
    const badge = card.querySelector('.inh-badge');
    const nEl = card.querySelector('.inh-badge-n');
    if (nEl) nEl.textContent = String(r.boxes);
    if (badge) {
      if (picked) badge.removeAttribute('hidden');
      else badge.setAttribute('hidden', '');
    }
    card.querySelectorAll('.inh-pill').forEach(function (p) {
      p.classList.toggle('active', picked && String(ppd) === p.getAttribute('data-n'));
    });
    let warn = card.querySelector('.inh-card-warn');
    if (picked && d.warn) {
      if (!warn) {
        warn = document.createElement('p');
        warn.className = 'inh-card-warn';
        const img = card.querySelector('.inh-imgwrap');
        card.querySelector('.inh-body').insertBefore(warn, img);
      }
      warn.textContent = d.warn;
    } else if (warn) {
      warn.remove();
    }
    if (rerenderSum) renderSummary();
  }

  function computeAll() {
    rootEl.querySelectorAll('.inh-card[data-id]').forEach(function (c) {
      updateCard(c.getAttribute('data-id'), false);
    });
    renderSummary();
  }

  function selectedRows() {
    return Object.keys(STATE.selected).map(function (id) {
      const d = drugById(id);
      const ppd = STATE.selected[id].ppd || 0;
      const days = Number(STATE.days || 0);
      const r = calcBoxes(d, days, ppd);
      return { d: d, ppd: ppd, days: days, r: r };
    });
  }

  function renderSummary() {
    const tb = rootEl.querySelector('#inhalerSumBody');
    const rows = selectedRows();
    let total = 0;
    tb.innerHTML = rows.map(function (row) {
      total += row.r.boxes;
      const note = row.r.notes.length ? '<div class="inh-note">' + row.r.notes.map(esc).join(' · ') + '</div>' : '';
      const ppdTxt = row.d.calcMode === 'durationOnly' ? 'ตามอาการ' : (row.ppd || '–');
      return '<tr><td>' + esc(row.d.name) + note + '</td><td>' + esc(String(ppdTxt)) + '</td><td>' + (row.days || '–') + '</td><td>' + row.d.puffsPerBox + '</td><td><b>' + row.r.boxes + '</b></td></tr>';
    }).join('') || '<tr class="inh-empty-row"><td colspan="5" class="inh-empty">ยังไม่ได้เลือกยา</td></tr>';
    rootEl.querySelector('#inhalerSumTotal').textContent = String(total);
  }

  function summaryText() {
    const rows = selectedRows();
    const days = Number(STATE.days || 0);
    const lines = ['คำนวณกล่องยาพ่น' + (days ? ' · นัด ' + days + ' วัน' : '')];
    let total = 0;
    rows.forEach(function (row) {
      total += row.r.boxes;
      let how;
      if (row.d.calcMode === 'durationOnly') {
        how = '1 กล่อง / ' + (row.d.boxDurationDays || 56) + ' วัน';
      } else if (row.days && row.ppd) {
        how = row.days + ' × ' + row.ppd + ' = ' + row.r.puffsNeeded + ' พ่น ÷ ' + row.d.puffsPerBox + ' → ' + row.r.boxes + ' กล่อง';
      } else {
        how = 'กรอกพ่น/วันและจำนวนวัน';
      }
      const extra = row.r.notes.length ? ' (' + row.r.notes.join('; ') + ')' : '';
      lines.push('- ' + row.d.name + ': จ่าย ' + row.r.boxes + ' กล่อง · ' + how + extra);
    });
    lines.push('รวม ' + total + ' กล่อง');
    return lines.join('\n');
  }

  function copySummary() {
    const text = summaryText();
    const status = rootEl.querySelector('#inhalerCopyStatus');
    function ok() {
      if (!status) return;
      status.hidden = false;
      status.textContent = 'คัดลอกแล้ว';
      setTimeout(function () { status.hidden = true; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(function () { fallbackCopy(text, ok); });
    } else {
      fallbackCopy(text, ok);
    }
  }

  function fallbackCopy(text, ok) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); ok(); } catch (e) { /* styled status only */ }
    document.body.removeChild(ta);
  }

  global.pmkInhalerTool = {
    DRUGS: DRUGS,
    FILTERS: FILTERS,
    PPD_MAX: PPD_MAX,
    calcBoxes: calcBoxes,
    render: render,
    getState: function () { return STATE; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
