/* Patient A5 handout for clinic tabs that do not already have a print sheet. Offline-safe, no server calls. */
(function () {
  const SUPPORTED = ['MR', 'ADR', 'HIV', 'HF', 'CKD', 'PARKINSON', 'PID'];
  const CLINIC_TITLE = {
    MR: 'คลินิกทบทวนรายการยา',
    ADR: 'คลินิกอาการไม่พึงประสงค์จากยา',
    HIV: 'คลินิกเอชไอวี',
    HF: 'คลินิกหัวใจล้มเหลว',
    CKD: 'คลินิกโรคไตเรื้อรัง',
    PARKINSON: 'คลินิกพาร์กินสัน',
    PID: 'คลินิก HIV/TB เด็ก (PID)'
  };

  function val(id) {
    const el = document.getElementById(id);
    return el && 'value' in el ? String(el.value || '').trim() : '';
  }
  function checked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }
  function radio(name) {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? String(el.value || '').trim() : '';
  }
  function selText(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    const opt = el.options && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
    const t = opt ? String(opt.text || '').trim() : String(el.value || '').trim();
    if (!t || t === '-- เลือก --' || t.indexOf('--') === 0) return '';
    return t;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function todayThai() {
    try {
      return new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }
  function formatThaiDate(raw) {
    const s = String(raw || '').trim();
    if (!s) return todayThai();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      if (!isNaN(d.getTime())) {
        try {
          return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) { return s; }
      }
    }
    return s;
  }
  function currentClinic() {
    if (typeof window.currentTab === 'string' && window.currentTab) return window.currentTab;
    const active = document.querySelector('.tab-btn.active');
    if (active && active.id && active.id.indexOf('tab-') === 0) return active.id.slice(4);
    return 'MR';
  }
  function pharmacistFor(tab) {
    if (tab === 'MR') return val('mrPharmName');
    if (tab === 'PREOP') return val('preopPharmName');
    if (tab === 'ADR') return val('adrPharmName');
    if (tab === 'HIV') return val('hivPharmName') || val('hivPharmNameRefer');
    if (tab === 'WARFARIN') return val('wfNotePharm');
    if (tab === 'CKD') return val('c7PharmName');
    if (tab === 'ASTHMA') return val('c8PharmName');
    if (tab === 'PARKINSON') return val('c9PharmName');
    if (tab === 'CAPD') return val('c10PharmName');
    if (tab === 'PID') return val('pidPharmName');
    return '';
  }

  function medTable(headers, rows) {
    if (!rows || !rows.length) return '';
    const head = headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    const body = rows.map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td>' + esc(c || '-') + '</td>'; }).join('') + '</tr>';
    }).join('');
    return (
      '<div class="pmk-pt-sec">' +
        '<div class="pmk-pt-h">ตารางยา / รายการที่เกี่ยวข้อง</div>' +
        '<table class="pmk-pt-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' +
      '</div>'
    );
  }
  function listSection(title, items) {
    const clean = (items || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    if (!clean.length) return '';
    return (
      '<div class="pmk-pt-sec">' +
        '<div class="pmk-pt-h">' + esc(title) + '</div>' +
        '<ul class="pmk-pt-ul">' + clean.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '</div>'
    );
  }

  function collectMr() {
    const rows = [];
    const sources = (typeof window.mrSources !== 'undefined' && Array.isArray(window.mrSources)) ? window.mrSources : [];
    sources.forEach(function (src) {
      const place = (src && src.place) ? String(src.place).trim() : '';
      (src && Array.isArray(src.drugs) ? src.drugs : []).forEach(function (d) {
        const name = String(d || '').trim();
        if (name) rows.push([name, place || (src && src.date) || '-', (src && src.date) || '-']);
      });
    });
    const advice = [
      'ทานยาตามที่ระบุในตาราง อย่าหยุด เพิ่ม หรือลดยาเองโดยไม่ปรึกษาแพทย์หรือเภสัชกร',
      'นำยาหรือซองยามาด้วยทุกครั้งที่มาโรงพยาบาลหรือคลินิก'
    ];
    if (checked('mrAllergyCheck') && val('mrAllergyDetail')) {
      advice.unshift('ประวัติแพ้ยา: ' + val('mrAllergyDetail') + ' — กรุณาแจ้งทุกครั้งที่รับบริการ');
    } else {
      advice.push('หากแพ้ยาหรือมีอาการผิดปกติหลังทานยา ให้หยุดยาชนิดนั้นและแจ้งแพทย์หรือเภสัชกร');
    }
    if (val('mrHerb')) advice.push('สมุนไพร / อาหารเสริมที่ใช้: ' + val('mrHerb') + ' — ควรแจ้งแพทย์หรือเภสัชกรทุกครั้ง');
    if (val('mrExtraNote')) advice.push(val('mrExtraNote'));
    return {
      date: todayThai(),
      meds: medTable(['รายการยา (ชื่อ ขนาด วิธีใช้)', 'แหล่งที่มา', 'วันที่'], rows),
      advice: advice,
      follow: []
    };
  }

  function collectAdr() {
    const rows = [];
    const drugs = (typeof window.adrTimelineDrugs !== 'undefined' && Array.isArray(window.adrTimelineDrugs)) ? window.adrTimelineDrugs : [];
    drugs.forEach(function (d) {
      const name = d && String(d.name || '').trim();
      if (!name) return;
      const flag = d.suspected ? 'ยาที่ควรหลีกเลี่ยง' : 'ยาที่เกี่ยวข้อง';
      rows.push([name, flag, d.ongoing ? 'ยังใช้อยู่' : ((d.stopDate || '') + (d.startDate ? ' (เริ่ม ' + d.startDate + ')' : '')).trim() || '-']);
    });
    if (!rows.length && val('adrDrug')) {
      val('adrDrug').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (n) {
        rows.push([n, 'ยาที่ควรหลีกเลี่ยง', '-']);
      });
    }
    const advice = [
      'หลีกเลี่ยงยาที่เป็นสาเหตุและยาในกลุ่มเดียวกัน เว้นแต่แพทย์ผู้รักษาแนะนำเป็นอย่างอื่น',
      'แจ้งประวัติอาการไม่พึงประสงค์จากยานี้ทุกครั้งที่ไปโรงพยาบาล คลินิก ร้านยา หรือทำฟัน',
      'หากมีอาการซ้ำ หรืออาการรุนแรง เช่น แน่นหน้าอก หายใจลำบาก บวมที่หน้าหรือปาก ให้มาโรงพยาบาลทันที'
    ];
    if (val('adrSymptomText')) advice.unshift('อาการที่เกิดขึ้น: ' + val('adrSymptomText'));
    if (val('adrEventDetail')) advice.push(val('adrEventDetail'));
    const follow = [];
    if (val('adrDate')) follow.push('วันที่รับยา / ข้อมูลอ้างอิง: ' + val('adrDate'));
    if (val('adrSympOnsetDate')) follow.push('วันที่เริ่มมีอาการ: ' + val('adrSympOnsetDate'));
    return {
      date: val('adrDate') || todayThai(),
      meds: medTable(['รายการยา', 'สถานะ', 'หมายเหตุ'], rows),
      advice: advice,
      follow: follow
    };
  }

  function collectHiv() {
    const rows = [];
    const list = (typeof window.hivDrugs !== 'undefined' && Array.isArray(window.hivDrugs)) ? window.hivDrugs : [];
    list.forEach(function (d) {
      const name = d && String(d.name || '').trim();
      if (!name) return;
      rows.push([name, d.usage || '-', d.time || '-']);
    });
    const advice = [
      'ทานยาต้านไวรัสให้ตรงเวลาทุกวัน ไม่ควรหยุดยาเอง เพราะอาจทำให้เชื้อดื้อยาได้',
      'หากลืมทานยา ให้ทานทันทีที่นึกได้ เว้นแต่ใกล้มื้อถัดไป — หากไม่แน่ใจให้สอบถามเภสัชกร',
      'มาตามนัดและเจาะเลือดตามที่แพทย์หรือเภสัชกรนัดหมาย'
    ];
    const adh = val('hivManualAdherence');
    if (adh) advice.push('ความร่วมมือในการใช้ยา (Adherence) ครั้งนี้: ' + adh);
    if (checked('chkHivRenalAdvice') && val('hivRenalCustomAdvice')) advice.push(val('hivRenalCustomAdvice'));
    const follow = [];
    if (val('hivRmDate') || val('hivRmMonths')) {
      follow.push('นัดเติมยา / RM: ' + (val('hivRmDate') || '-') + (val('hivRmMonths') ? '  จำนวน ' + val('hivRmMonths') + ' เดือน' : ''));
    }
    const labSel = val('hivNextLabSelect');
    if (labSel === 'M1') follow.push('การเจาะ Lab ครั้งหน้า: M1');
    else if (labSel === 'other' && val('hivNextLabCustom')) follow.push('การเจาะ Lab ครั้งหน้า: ' + val('hivNextLabCustom'));
    else if (labSel && labSel !== 'other') follow.push('การเจาะ Lab ครั้งหน้า: ' + labSel);
    else if (val('hivNextLabCustom')) follow.push('การเจาะ Lab ครั้งหน้า: ' + val('hivNextLabCustom'));
    return {
      date: todayThai(),
      meds: medTable(['ชื่อยา', 'วิธีใช้', 'เวลา'], rows),
      advice: advice,
      follow: follow
    };
  }

  function collectHf() {
    const rows = [];
    const groups = [
      { chk: 'chk_hf_raasi', drug: 'sel_hf_raasi_drug', dose: 'sel_hf_raasi_dose', fallback: 'ยา ACEi / ARB / ARNI' },
      { chk: 'chk_hf_bb', drug: 'sel_hf_bb_drug', dose: 'sel_hf_bb_dose', fallback: 'Beta-blocker' },
      { chk: 'chk_hf_mra', drug: 'sel_hf_mra_drug', dose: 'sel_hf_mra_dose', fallback: 'MRA' },
      { chk: 'chk_hf_sglt2i', drug: 'sel_hf_sglt2i_drug', dose: 'sel_hf_sglt2i_dose', fallback: 'SGLT2i' },
      { chk: 'chk_hf_iva', drug: null, dose: 'sel_hf_iva_dose', fallback: 'Ivabradine' },
      { chk: 'chk_hf_loop', drug: null, dose: null, fallback: 'ยาขับปัสสาวะ', extra: 'hf_loop_detail' },
      { chk: 'chk_hf_hnisdn', drug: null, dose: null, fallback: 'Hydralazine / ISDN' },
      { chk: 'chk_hf_vericiguat', drug: null, dose: null, fallback: 'Vericiguat' }
    ];
    groups.forEach(function (g) {
      if (!checked(g.chk)) return;
      const name = (g.drug ? selText(g.drug) : '') || g.fallback || '-';
      let dose = g.dose ? selText(g.dose) : '';
      if (g.extra && val(g.extra)) dose = (dose ? dose + ' — ' : '') + val(g.extra);
      rows.push([name, dose || '-']);
    });
    const advice = [
      'ทานยาโรคหัวใจให้สม่ำเสมอ อย่าหยุดยาเองแม้จะรู้สึกดีขึ้น',
      'หากมีอาการเหนื่อยผิดปกติ บวมที่ขา หรือน้ำหนักขึ้นเร็ว ให้รีบติดต่อแพทย์หรือเภสัชกร'
    ];
    if (checked('hf_ed_weight')) advice.push('ชั่งน้ำหนักทุกเช้า หลังถ่ายปัสสาวะ และสังเกตอาการบวม');
    else advice.push('ควรชั่งน้ำหนักสม่ำเสมอ และสังเกตอาการบวม');
    if (checked('hf_ed_sodium')) advice.push('จำกัดโซเดียมไม่เกิน 2–3 กรัมต่อวัน ลดอาหารเค็ม ของหมักดอง และน้ำซุป');
    if (checked('hf_ed_sickday')) advice.push('เมื่อท้องเสีย อาเจียน ไข้สูง หรือกินได้น้อยมาก อาจต้องหยุดยาบางชนิดชั่วคราวตามที่เภสัชกรแนะนำ (Sick Day Rules) และพบแพทย์หากอาการไม่ดีขึ้น');
    const vax = [];
    if (checked('hf_flu_vaccine')) vax.push('ไข้หวัดใหญ่');
    if (checked('hf_pneumo_vaccine')) vax.push('ปอดอักเสบ');
    if (checked('hf_covid_vaccine')) vax.push('โควิด-19 / RSV');
    if (vax.length) advice.push('วัคซีนที่บันทึกไว้: ' + vax.join(', '));
    return {
      date: todayThai(),
      meds: medTable(['ชื่อยา', 'ขนาด / วิธีใช้'], rows),
      advice: advice,
      follow: []
    };
  }

  function collectCkd() {
    const advice = [];
    document.querySelectorAll('.c7-adv-cb:checked').forEach(function (cb) {
      const label = cb.parentElement ? String(cb.parentElement.textContent || '').trim() : '';
      const short = label.replace(/^\s*/, '') || cb.value;
      if (short) advice.push(short.replace(/^Adv\.\s*/, ''));
    });
    if (!advice.length) {
      advice.push('งดยาแก้ปวดกลุ่ม NSAIDs และยาชุด รวมถึงสมุนไพรหรือยาต้มที่ไม่ทราบแหล่งที่มา');
      advice.push('แจ้งทุกครั้งว่าเป็นโรคไต เมื่อไปโรงพยาบาลอื่น คลินิก ร้านยา หรือทำฟัน');
      advice.push('ทานยาตามแพทย์สั่งอย่างสม่ำเสมอ และมาตามนัดเจาะเลือด');
    }
    if (val('c7HerbText')) advice.push('สมุนไพร / อาหารเสริม: ' + val('c7HerbText'));
    if (val('c7CompText')) advice.push('ความร่วมมือในการใช้ยา: ' + val('c7CompText'));
    if (val('c7DiText')) advice.push(val('c7DiText'));
    const follow = [];
    if (val('c7Egfr') || val('c7CkdStage')) {
      const bits = [];
      if (val('c7CkdStage')) bits.push('ระยะของไต: ' + val('c7CkdStage'));
      if (val('c7Egfr')) bits.push('eGFR วันนี้: ' + val('c7Egfr'));
      follow.push(bits.join('   '));
    }
    if (val('c7LastLabDate')) follow.push('วันที่เจาะ Lab รอบที่แล้ว: ' + val('c7LastLabDate'));
    if (val('c7DrugWatchInput')) follow.push('ยาที่ต้องระวังตามค่าไต: ' + val('c7DrugWatchInput'));
    return {
      date: todayThai(),
      meds: '',
      showEmptyMeds: false,
      advice: advice,
      follow: follow
    };
  }

  function collectParkinson() {
    const rows = [];
    const list = (typeof window.c9Meds !== 'undefined' && Array.isArray(window.c9Meds)) ? window.c9Meds : [];
    list.forEach(function (m) {
      const name = m && String(m.name || '').trim();
      if (!name) return;
      rows.push([name, m.dose || '-', m.time || '-']);
    });
    const advice = [
      'ทานยาพาร์กินสันให้ตรงเวลา โดยเฉพาะยากลุ่ม levodopa',
      'ยากลุ่ม levodopa ควรห่างจากมื้ออาหารที่โปรตีนสูง หากเภสัชกรหรือแพทย์แนะนำไว้',
      'ระวังอาการมึนงงหรือการล้ม ลุกนั่งอย่างช้าๆ'
    ];
    if (val('c9Note')) advice.push(val('c9Note'));
    if (val('c9Compliance')) advice.push('ความร่วมมือในการใช้ยา: ' + val('c9Compliance'));
    const follow = [];
    if (val('c9ClinicDate')) follow.push('วันที่มาคลินิก: ' + formatThaiDate(val('c9ClinicDate')));
    const meals = [];
    if (val('c9MealBreak')) meals.push('เช้า ' + val('c9MealBreak'));
    if (val('c9MealLunch')) meals.push('กลางวัน ' + val('c9MealLunch'));
    if (val('c9MealDinner')) meals.push('เย็น ' + val('c9MealDinner'));
    if (meals.length) follow.push('เวลามื้ออาหาร: ' + meals.join('  |  '));
    if (val('c9DoctorPlan')) follow.push('แผนการรักษาของแพทย์: ' + val('c9DoctorPlan'));
    if (val('c9DoctorAdj')) follow.push('การปรับยาโดยแพทย์: ' + val('c9DoctorAdj'));
    return {
      date: formatThaiDate(val('c9ClinicDate') || val('c9SurveyDate')),
      meds: medTable(['ชื่อยา', 'ขนาด', 'เวลา'], rows),
      advice: advice,
      follow: follow
    };
  }

  function collectPid() {
    const d = (typeof window.pmkPidCollectPrint === 'function') ? window.pmkPidCollectPrint() : { headers: [], rows: [], advice: [], follow: [] };
    return {
      date: todayThai(),
      meds: medTable(d.headers, d.rows),
      advice: d.advice,
      follow: d.follow
    };
  }

  const COLLECT = {
    MR: collectMr,
    ADR: collectAdr,
    HIV: collectHiv,
    HF: collectHf,
    CKD: collectCkd,
    PARKINSON: collectParkinson,
    PID: collectPid
  };

  function fillPatientAdviceA5() {
    const tab = currentClinic();
    if (SUPPORTED.indexOf(tab) < 0) {
      pmkAlert('คลินิกนี้มีใบพิมพ์อยู่แล้วครับ หรือยังไม่รองรับใบแนะนำผู้ป่วย');
      return false;
    }
    const data = COLLECT[tab]();
    const name = val('ptName') || (tab === 'PARKINSON' ? [val('c9FirstName'), val('c9LastName')].filter(Boolean).join(' ') : '') || '-';
    const hn = val('hn') || '-';
    const pharm = pharmacistFor(tab);
    const clinic = CLINIC_TITLE[tab] || tab;
    document.getElementById('pmkPtPrintClinic').textContent = clinic;
    document.getElementById('pmkPtPrintName').textContent = name;
    document.getElementById('pmkPtPrintHn').textContent = hn;
    document.getElementById('pmkPtPrintDate').textContent = data.date || todayThai();
    const medsHtml = data.meds || (data.showEmptyMeds === false ? '' :
      '<div class="pmk-pt-sec"><div class="pmk-pt-h">ตารางยา / รายการที่เกี่ยวข้อง</div><p class="pmk-pt-empty">ยังไม่มีรายการยาในฟอร์มครั้งนี้</p></div>');
    document.getElementById('pmkPtPrintBody').innerHTML =
      medsHtml +
      listSection('คำแนะนำสำหรับผู้ป่วย', data.advice) +
      listSection('นัดหมาย / การติดตาม', data.follow);
    document.getElementById('pmkPtPrintPharm').textContent = pharm || '................................................';
    return true;
  }

  function printPatientAdviceA5() {
    if (!fillPatientAdviceA5()) return;
    const area = document.getElementById('printPatientAdviceA5');
    if (!area) return;
    area.classList.remove('hidden');
    document.body.classList.add('print-mode-patient-a5');
    const done = function () {
      document.body.classList.remove('print-mode-patient-a5');
      area.classList.add('hidden');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(function () {
      window.print();
      setTimeout(done, 1500);
    }, 50);
  }

  function syncPatientPrintButton() {
    const btn = document.getElementById('btnPatientAdviceA5');
    if (!btn) return;
    const tab = currentClinic();
    if (SUPPORTED.indexOf(tab) >= 0) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }

  function bind() {
    const orig = window.switchTab;
    if (typeof orig === 'function' && !orig.__pmkPatientPrintWrapped) {
      const wrapped = function () {
        const result = orig.apply(this, arguments);
        syncPatientPrintButton();
        return result;
      };
      wrapped.__pmkPatientPrintWrapped = true;
      window.switchTab = wrapped;
    }
    syncPatientPrintButton();
  }

  window.printPatientAdviceA5 = printPatientAdviceA5;
  window.fillPatientAdviceA5 = fillPatientAdviceA5;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
