/* PMK clinical advisory alerts (non-blocking banners and panel only) */
(function () {
  'use strict';

  const CLINICS = [
    { id: 'MR', label: 'MR (Medication Reconciliation)' },
    { id: 'PREOP', label: 'Pre-OP' },
    { id: 'ADR', label: 'ADR / Side Effect' },
    { id: 'HIV', label: 'HIV' },
    { id: 'WARFARIN', label: 'Warfarin' },
    { id: 'HF', label: 'Heart Failure' },
    { id: 'CKD', label: 'CKD' },
    { id: 'ASTHMA', label: 'Asthma / COPD' },
    { id: 'PARKINSON', label: 'Parkinson' },
    { id: 'CAPD', label: 'CAPD' },
    { id: 'PID', label: 'HIV/TB เด็ก (PID)' },
    { id: 'OPENHEART', label: 'Open Heart' }
  ];

  const CLINIC_MAP = Object.fromEntries(CLINICS.map(c => [c.id, c]));

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? String(el.value ?? '').trim() : '';
  }

  function numVal(id) {
    const raw = val(id);
    if (!raw) return NaN;
    const n = parseFloat(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }

  function checked(id) {
    return !!document.getElementById(id)?.checked;
  }

  function radioVal(name) {
    return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
  }

  function parseBp(bpText, sbpId, dbpId) {
    let sbp = sbpId ? numVal(sbpId) : NaN;
    let dbp = dbpId ? numVal(dbpId) : NaN;
    const raw = String(bpText || '').trim();
    if ((isNaN(sbp) || isNaN(dbp)) && raw) {
      const m = raw.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
      if (m) {
        if (isNaN(sbp)) sbp = parseFloat(m[1]);
        if (isNaN(dbp)) dbp = parseFloat(m[2]);
      }
    }
    return { sbp, dbp, text: (!isNaN(sbp) && !isNaN(dbp)) ? `${sbp}/${dbp}` : raw };
  }

  function extractNumberNear(text, regex) {
    const m = String(text || '').match(regex);
    return m ? parseFloat(m[1]) : NaN;
  }

  function hasAnyKeyword(text, keywords) {
    const low = String(text || '').toLowerCase();
    return keywords.some(kw => low.includes(kw.toLowerCase()));
  }

  function matchedKeywords(text, keywords) {
    const low = String(text || '').toLowerCase();
    return keywords.filter(kw => low.includes(kw.toLowerCase()));
  }

  // ==========================================================
  //  CLINICAL ALERT RULES (advisory only, conservative, Thai)
  // ==========================================================

  function evalMrAlerts() {
    const alerts = [];
    const sources = Array.isArray((typeof mrSources !== 'undefined' ? mrSources : undefined)) ? (typeof mrSources !== 'undefined' ? mrSources : undefined) : [];
    const allDrugs = [];
    sources.forEach(s => {
      (s.drugs || []).forEach(d => {
        const t = String(d || '').trim();
        if (t) allDrugs.push(t);
      });
    });
    const combinedDrugs = allDrugs.join(' | ');
    const allergyOn = checked('mrAllergyCheck');
    const allergyText = val('mrAllergyDetail');
    const herbText = val('mrHerb');

    if (allergyOn && !allergyText) {
      alerts.push({
        level: 'info',
        title: 'ระบุรายละเอียดประวัติแพ้ยา',
        detail: 'ติ๊กมีประวัติแพ้ยาแล้ว แต่ยังไม่ได้ระบุชื่อยาและลักษณะอาการแพ้',
        source: 'แนวทาง Medication Reconciliation'
      });
    }

    if (allergyOn && allergyText && allDrugs.length > 0) {
      const allergyGroups = [
        { label: 'กลุ่ม Penicillin / Beta-lactam', keys: ['penicillin', 'amoxicillin', 'amoxy', 'ampicillin', 'augmentin', 'amoxyclav', 'cloxacillin', 'dicloxacillin', 'piperacillin'] },
        { label: 'กลุ่ม Cephalosporin', keys: ['cephalosporin', 'cefazolin', 'cefuroxime', 'ceftriaxone', 'cefixime', 'cephalexin', 'ceftazidime'] },
        { label: 'กลุ่ม Sulfonamide', keys: ['sulfa', 'bactrim', 'cotrimoxazole', 'tmp-smx', 'sulfamethoxazole'] },
        { label: 'กลุ่ม NSAIDs', keys: ['nsaid', 'ibuprofen', 'naproxen', 'diclofenac', 'mefenamic', 'ponstan', 'celecoxib', 'etoricoxib', 'arcoxia', 'meloxicam', 'piroxicam', 'aspirin'] },
        { label: 'กลุ่ม Statin', keys: ['statin', 'simvastatin', 'atorvastatin', 'rosuvastatin', 'pravastatin', 'pitavastatin'] },
        { label: 'กลุ่ม ACEI', keys: ['acei', 'enalapril', 'lisinopril', 'ramipril', 'perindopril', 'captopril'] }
      ];
      let allergyHit = false;
      allergyGroups.forEach(g => {
        if (hasAnyKeyword(allergyText, g.keys) && hasAnyKeyword(combinedDrugs, g.keys)) {
          allergyHit = true;
          alerts.push({
            level: 'danger',
            title: `เฝ้าระวังยาซ้ำ/แพ้ข้ามกลุ่ม (${g.label})`,
            detail: `ประวัติแพ้ยา "${allergyText}" อาจตรงกับรายการยาที่ได้รับจากที่อื่น — โปรดยืนยันกับผู้ป่วยและแจ้งแพทย์ก่อนสั่งใช้`,
            source: 'Medication Reconciliation Allergy Check'
          });
        }
      });
      if (!allergyHit) {
        const tokens = allergyText.toLowerCase().split(/[\s,/;+|]+/).filter(w => w.length >= 4);
        const directMatch = tokens.find(tok => combinedDrugs.toLowerCase().includes(tok));
        if (directMatch) {
          alerts.push({
            level: 'danger',
            title: `พบชื่อยา "${directMatch}" ใกล้เคียงประวัติแพ้ยา`,
            detail: `ตรวจสอบรายการยา MR เทียบกับประวัติแพ้ยา "${allergyText}"`,
            source: 'Medication Reconciliation Allergy Check'
          });
        }
      }
    }

    // Duplicate therapeutic class check
    const dupClasses = [
      { label: 'NSAIDs ซ้ำซ้อน', level: 'warn', keys: ['ibuprofen', 'naproxen', 'diclofenac', 'mefenamic', 'ponstan', 'celecoxib', 'etoricoxib', 'arcoxia', 'meloxicam', 'piroxicam', 'indomethacin', 'ketorolac'] },
      { label: 'ACEI / ARB ซ้ำซ้อน', level: 'warn', keys: ['enalapril', 'lisinopril', 'ramipril', 'perindopril', 'losartan', 'valsartan', 'irbesartan', 'candesartan', 'telmisartan', 'entresto'] },
      { label: 'PPI ซ้ำซ้อน', level: 'info', keys: ['omeprazole', 'esomeprazole', 'lansoprazole', 'pantoprazole', 'rabeprazole', 'dexlansoprazole'] },
      { label: 'Statin ซ้ำซ้อน', level: 'warn', keys: ['simvastatin', 'atorvastatin', 'rosuvastatin', 'pravastatin', 'pitavastatin', 'fluvastatin'] }
    ];
    dupClasses.forEach(cls => {
      const hits = [];
      allDrugs.forEach(d => {
        const m = matchedKeywords(d, cls.keys);
        if (m.length > 0) hits.push(m[0]);
      });
      const uniqueHits = [...new Set(hits)];
      if (uniqueHits.length >= 2) {
        alerts.push({
          level: cls.level,
          title: `พบยาในกลุ่ม ${cls.label} มากกว่า 1 ชนิด (${uniqueHits.join(', ')})`,
          detail: 'ควรทบทวนความซ้ำซ้อนระหว่างยาเดิมและยาจากแหล่งอื่นเพื่อลดอาการไม่พึงประสงค์',
          source: 'Therapeutic Duplication Screening'
        });
      }
    });

    // High-alert meds
    const highAlert = matchedKeywords(combinedDrugs, ['warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'insulin', 'digoxin', 'lithium', 'methotrexate', 'phenytoin', 'carbamazepine']);
    if (highAlert.length > 0) {
      alerts.push({
        level: 'info',
        title: `มียากลุ่มเสี่ยงสูง (High-Alert): ${[...new Set(highAlert)].join(', ')}`,
        detail: 'ยืนยันขนาดยา วิธีรับประทาน และวันที่รับยาล่าสุดจากซองยา/รพ.ต้นทางให้ชัดเจน',
        source: 'ISMP High-Alert Medications'
      });
    }

    if (allDrugs.length >= 5) {
      alerts.push({
        level: 'info',
        title: `ผู้ป่วยได้รับยาหลายรายการ (${allDrugs.length} รายการ — Polypharmacy)`,
        detail: 'ทบทวนความซ้ำซ้อน ความร่วมมือในการใช้ยา และอันตรกิริยาระหว่างยา',
        source: 'WHO Medication Safety in Polypharmacy'
      });
    }

    if (herbText) {
      const riskyHerbs = ['เซนต์จอห์น', 'st. john', 'แปะก๊วย', 'ginkgo', 'ตังกุย', 'แดนเซิน', 'ถั่งเช่า', 'กระเทียม', 'โสม', 'ขิง', 'ขมิ้น', 'ยาลูกกลอน', 'ยาชุด', 'สเตียรอยด์'];
      const hasAntithrombotic = hasAnyKeyword(combinedDrugs, ['warfarin', 'aspirin', 'clopidogrel', 'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban']);
      if (hasAntithrombotic || hasAnyKeyword(herbText, riskyHerbs)) {
        alerts.push({
          level: 'warn',
          title: `เฝ้าระวังสมุนไพร/อาหารเสริมร่วมกับยาประจำ (${herbText})`,
          detail: hasAntithrombotic
            ? 'ผู้ป่วยใช้ยาต้านการแข็งตัวของเลือด/ต้านเกล็ดเลือด — สมุนไพรบางชนิดอาจเพิ่มความเสี่ยงเลือดออกหรือลดฤทธิ์ยา ควรซักรายละเอียดและแจ้งแพทย์'
            : 'สมุนไพร/ยาชุดบางชนิดอาจมีอันตรกิริยาหรือปนเปื้อนสเตียรอยด์/NSAIDs ควรซักประวัติเพิ่มเติม',
          source: 'คลังข้อมูลสมุนไพรในแอป (Tan & Lee 2021 / Holbrook 2005)'
        });
      }
    }

    return alerts;
  }

  function evalPreopAlerts() {
    const alerts = [];
    const drugs = Array.isArray((typeof selectedPreopDrugs !== 'undefined' ? selectedPreopDrugs : undefined)) ? (typeof selectedPreopDrugs !== 'undefined' ? selectedPreopDrugs : undefined) : [];
    const bleedRisk = val('bleedingRisk');
    const crcl = numVal('renalFunction');
    const hasAnticoag = drugs.some(d => ['anticoagulant', 'doac', 'doac_dabi'].includes(d.category));
    const hasAntiplatelet = drugs.some(d => d.category === 'antiplatelet');

    if ((hasAnticoag || hasAntiplatelet) && !bleedRisk) {
      alerts.push({
        level: 'warn',
        title: 'ยังไม่ได้เลือกความเสี่ยงเลือดออก (Bleeding Risk)',
        detail: 'ผู้ป่วยมียาต้านการแข็งตัวของเลือด/ต้านเกล็ดเลือด กรุณาเลือก Bleeding Risk ของหัตถการเพื่อคำนวณวันหยุดยาที่ถูกต้อง',
        source: 'CHEST 2022 / EHRA 2021'
      });
    }

    if (drugs.some(d => d.category === 'doac' || d.category === 'doac_dabi') && !isNaN(crcl) && crcl < 50) {
      alerts.push({
        level: crcl < 30 ? 'danger' : 'warn',
        title: `DOAC ร่วมกับไตเสื่อม (CrCl ${crcl} mL/min < 50)`,
        detail: drugs.some(d => d.category === 'doac_dabi')
          ? 'Dabigatran ขับออกทางไตสูง — เมื่อ CrCl < 50 mL/min ต้องขยายระยะเวลาหยุดยาเป็น 3–4+ วัน (หรือนานกว่าใน CrCl < 30 / high bleeding risk)'
          : 'ยาในกลุ่ม Factor Xa inhibitor ต้องทบทวนระยะเวลาหยุดยาก่อนผ่าตัดเมื่อ CrCl ลดลง (โดยเฉพาะ CrCl < 30 mL/min)',
        source: 'EHRA 2021 / CHEST 2022 (กฎ Pre-OP ในแอป)'
      });
    } else if (!isNaN(crcl) && crcl < 30 && drugs.length > 0) {
      alerts.push({
        level: 'warn',
        title: `ค่าการทำงานของไตต่ำมาก (CrCl ${crcl} mL/min < 30)`,
        detail: 'ระวังการสะสมของยาที่ขับออกทางไต (เช่น Metformin, LMWH, DOAC) และปรึกษาแพทย์ก่อนผ่าตัด',
        source: 'เกณฑ์ปรับขนาดยาตามไต'
      });
    }

    const highThrombChecks = [
      'war_mech_mitral', 'war_mech_aortic', 'war_mech_stroke',
      'war_af_high', 'war_af_stroke', 'war_af_rheumatic',
      'war_vte_recent', 'war_vte_severe'
    ];
    if (drugs.some(d => d.id === 'warfarin') && highThrombChecks.some(id => checked(id))) {
      alerts.push({
        level: 'danger',
        title: 'ความเสี่ยงลิ่มเลือดอุดตันสูง (High Thrombotic Risk) บนยา Warfarin',
        detail: 'พิจารณาปรึกษาแพทย์เรื่อง Bridging Anticoagulation ช่วงหยุด Warfarin ก่อนผ่าตัด',
        source: 'CHEST 2022 Perioperative Guideline'
      });
    }

    if (hasAntiplatelet && val('stent_status') === 'yes') {
      alerts.push({
        level: 'danger',
        title: 'มีประวัติใส่ Stent หัวใจภายใน 1 ปี',
        detail: 'ห้ามหยุดยาต้านเกล็ดเลือด (DAPT/P2Y12) โดยพลการ เสี่ยง Stent thrombosis สูงมาก — ต้องปรึกษาอายุรแพทย์หัวใจและศัลยแพทย์',
        source: 'ACC/AHA & ESC Perioperative DAPT Guideline'
      });
    }

    if (drugs.some(d => d.category === 'sglt2' || d.category === 'sglt2_4d')) {
      const days = drugs.some(d => d.category === 'sglt2_4d') ? '4 วัน (Ertugliflozin)' : '3 วัน';
      alerts.push({
        level: 'warn',
        title: `ยากลุ่ม SGLT2i เสี่ยง Euglycemic DKA ช่วงผ่าตัด`,
        detail: `แนะนำหยุดยาล่วงหน้า ${days} ก่อนวันผ่าตัด และติดตามภาวะคีโตน/กรดในเลือดหลังผ่าตัด`,
        source: 'US FDA / ADA Standards of Care'
      });
    }

    if (drugs.some(d => d.category === 'glp1_weekly')) {
      alerts.push({
        level: 'warn',
        title: 'GLP-1 RA รายสัปดาห์ — เสี่ยงอาหารค้างในกระเพาะ (Aspiration)',
        detail: 'พิจารณาหยุดยาล่วงหน้าอย่างน้อย 1 สัปดาห์ก่อนทำหัตถการ/ดมยาสลบ และซักอาการคลื่นไส้อาเจียนในวันผ่าตัด',
        source: 'ASA 2023 Consensus Guidance'
      });
    }

    if (bleedRisk === 'neuro-spine' && (hasAnticoag || hasAntiplatelet)) {
      alerts.push({
        level: 'danger',
        title: 'หัตถการ Neuroaxial / Critical Site + ยาละลายลิ่มเลือด/ต้านเกล็ดเลือด',
        detail: 'ห้ามเลือดออกเด็ดขาด — ตรวจสอบระยะเวลาหยุดยาตามเกณฑ์ ASRA และยืนยันคำสั่งแพทย์ผู้ทำหัตถการ/วิสัญญี',
        source: 'ASRA 2018 / CHEST 2022'
      });
    }

    return alerts;
  }

  function evalAdrAlerts() {
    const alerts = [];
    const redFlags = Array.from(document.querySelectorAll('#form-ADR .adr-redflag:checked')).map(cb => cb.value);
    const drugText = [
      val('adrDrug'),
      ...(Array.isArray((typeof adrTimelineDrugs !== 'undefined' ? adrTimelineDrugs : undefined)) ? (typeof adrTimelineDrugs !== 'undefined' ? adrTimelineDrugs : undefined).map(d => d.name || '') : [])
    ].join(' ');
    const sympText = val('adrSymptomText');
    const mechType = radioVal('adrMechType');
    const actions = Array.from(document.querySelectorAll('#form-ADR .adr-action-cb:checked')).map(cb => cb.value);

    if (redFlags.length > 0) {
      alerts.push({
        level: 'danger',
        title: 'พบสัญญาณเตือนปฏิกิริยารุนแรง (Severe ADR / Anaphylaxis / SCARs)',
        detail: `อาการเตือน: ${redFlags.join(', ')} — แนะนำหยุดยาที่สงสัยทันที ส่งพบแพทย์ประเมินเร่งด่วน และพิจารณาลงประวัติแพ้ยา`,
        source: 'เกณฑ์คัดกรอง Severe ADR / SCARs ในแอป'
      });
    }

    const scarDrugs = ['allopurinol', 'carbamazepine', 'phenytoin', 'lamotrigine', 'bactrim', 'cotrimoxazole', 'nevirapine', 'abacavir', 'sulfasalazine'];
    if (hasAnyKeyword(drugText, scarDrugs) && hasAnyKeyword(sympText, ['ผื่น', 'rash', 'ตุ่ม', 'ปาก', 'ตา', 'ไข้', 'blister', 'sjs', 'dress'])) {
      alerts.push({
        level: 'danger',
        title: 'ยาเสี่ยงสูงต่อผื่นแพ้ยารุนแรง (SCARs)',
        detail: 'ซักอาการไข้ ตาแดง แผลในปาก ต่อมน้ำเหลืองโต และพิจารณาตรวจ CBC / LFT / RFT ร่วมกับแพทย์',
        source: 'แนวทางการเฝ้าระวัง SCARs ประเทศไทย'
      });
    }

    if (hasAnyKeyword(drugText, ['statin', 'simvastatin', 'atorvastatin', 'rosuvastatin']) && hasAnyKeyword(sympText, ['ปวดกล้ามเนื้อ', 'myalgia', 'อ่อนแรง', 'ปัสสาวะเข้ม'])) {
      alerts.push({
        level: 'warn',
        title: 'สงสัย Statin-associated Muscle Symptoms',
        detail: 'พิจารณาส่งตรวจระดับ CPK, การทำงานของไต/ตับ และตรวจสอบยาที่ใช้ร่วมกันที่ยับยั้ง CYP3A4',
        source: 'ACC/AHA Cholesterol Guideline'
      });
    }

    let isHighProb = false;
    try {
      const nar = typeof window.calculateNaranjoScore === 'function' ? window.calculateNaranjoScore() : null;
      if (nar && nar.anyAnswered && nar.total >= 5) isHighProb = true;
    } catch (e) {}
    const who = radioVal('adrWhoLevel');
    if (who === 'Certain' || who === 'Probable') isHighProb = true;
    try {
      const thai = typeof window.evalThaiAlgo === 'function' ? window.evalThaiAlgo() : '';
      if (/Definite|Probable|ใช่แน่นอน|น่าจะใช่/i.test(String(thai))) isHighProb = true;
    } catch (e) {}

    if ((isHighProb || redFlags.length > 0) && mechType.includes('Type B') && !actions.some(a => a.includes('PMK'))) {
      alerts.push({
        level: 'info',
        title: 'ผลประเมิน ADR ระดับ Probable/Definite (Type B)',
        detail: 'พิจารณาติ๊ก "บันทึกประวัติใน PMK" และประเมินการออกบัตรแพ้ยาให้ผู้ป่วย',
        source: 'แนวทางระบบยาโรงพยาบาล'
      });
    }

    return alerts;
  }

  function evalHivAlerts() {
    const alerts = [];
    const arvList = (Array.isArray((typeof hivDrugs !== 'undefined' ? hivDrugs : undefined)) ? (typeof hivDrugs !== 'undefined' ? hivDrugs : undefined) : [])
      .map(d => String(d.name || '').trim())
      .filter(Boolean);
    const arvText = arvList.join(' | ');
    const arvUp = arvText.toUpperCase();

    // Also inspect co-meds entered in HIV rows, HIV text fields, or MR tab (if any)
    const hivExtraTexts = [
      val('hivLabsText'),
      val('hivPtStatusCustom'),
      val('txtHt'),
      val('txtDm'),
      val('txtDlp'),
      val('txtLiver'),
      val('txtCkd'),
      val('txtAnemia'),
      val('txtOtherRefer')
    ].filter(Boolean);
    const mrDrugs = [];
    if (Array.isArray((typeof mrSources !== 'undefined' ? mrSources : undefined))) {
      (typeof mrSources !== 'undefined' ? mrSources : undefined).forEach(s => {
        (s.drugs || []).forEach(d => { if (String(d || '').trim()) mrDrugs.push(String(d).trim()); });
      });
    }
    const coMedText = [...arvList, ...hivExtraTexts, ...mrDrugs].join(' | ');
    const fromMrOnly = mrDrugs.join(' | ');

    // 1) Renal checks reusing HIV_KB (ตาราง 2.17 / EACS 10.0)
    const egfr = numVal('hivEgfr');
    const hasTdf = /\b(TLD|TDF|TENOFOVIR DISOPROXIL)\b/i.test(arvUp);
    const has3tc = /\b(TLD|ALACOVIR|ZILAVIR|3TC|LAMIVUDINE)\b/i.test(arvUp);
    const hasTaf = /\b(TEDAVIR|TAF)\b/i.test(arvUp);

    if (!isNaN(egfr)) {
      if (hasTdf && egfr < 30) {
        alerts.push({
          level: 'danger',
          title: `eGFR = ${egfr} mL/min (< 30): ห้ามใช้สูตรที่มี TDF`,
          detail: 'หลีกเลี่ยง TDF/TLD เมื่อ eGFR < 30 mL/min — พิจารณาปรึกษาแพทย์เปลี่ยนเป็นสูตรที่มี ABC (เช่น ALACOVIR + DTG) และปรับขนาด 3TC ตามค่าไต',
          source: 'ตาราง 2.17 แนวทาง HIV ประเทศไทย (EACS 10.0)'
        });
      } else if (hasTdf && egfr < 50) {
        alerts.push({
          level: 'warn',
          title: `eGFR = ${egfr} mL/min (30–49): เฝ้าระวังการใช้สูตรที่มี TDF`,
          detail: 'หากไม่เปลี่ยนเป็น TAF (เช่น TEDAVIR) หรือ ABC (ALACOVIR + DTG) แนวทางกำหนดให้แยกเม็ดและปรับ TDF เป็น 300 mg ทุก 48 ชม.',
          source: 'ตาราง 2.17 แนวทาง HIV ประเทศไทย (EACS 10.0)'
        });
      }

      if (has3tc && egfr < 50) {
        const dose3tc = egfr < 10 ? '50–25 mg q24h (มี loading)' : (egfr < 30 ? '100 mg q24h' : '150 mg q24h');
        alerts.push({
          level: 'warn',
          title: `eGFR = ${egfr} mL/min (< 50): ยา 3TC ต้องปรับลดขนาดตามไต`,
          detail: `ไม่แนะนำใช้สูตรเม็ดรวมที่ปรับขนาดไม่ได้ — ขนาด 3TC แนะนำสำหรับช่วงนี้คือ ${dose3tc}`,
          source: 'ตาราง 2.17 แนวทาง HIV ประเทศไทย (EACS 10.0)'
        });
      }

      if (hasTaf && egfr < 30) {
        alerts.push({
          level: 'warn',
          title: `eGFR = ${egfr} mL/min (< 30): ข้อจำกัดข้อมูล TAF`,
          detail: 'ตาราง 2.17 ระบุว่ายังไม่มีข้อมูล PK สำหรับ TAF/TAF+FTC เมื่อ eGFR < 30 (นอกเหนือจากผู้ป่วย Hemodialysis)',
          source: 'ตาราง 2.17 แนวทาง HIV ประเทศไทย (EACS 10.0)'
        });
      }
    }

    // 2) ARV Drug-Drug Interactions with entered co-meds
    const hasDtg = /\b(TLD|TEDAVIR|DTG|DOLUTEGRAVIR)\b/i.test(arvUp);
    const hasPi = /\b(ATV\/R|LPV\/R|DRV\/R|RITONAVIR|ATV|DRV|ATAZANAVIR|LOPINAVIR|DARUNAVIR)\b/i.test(arvUp);
    const hasAtv = /\b(ATV|ATV\/R|ATAZANAVIR)\b/i.test(arvUp);
    const hasRpv = /\b(RPV|RILPIVIRINE)\b/i.test(arvUp);
    const hasAzt = /\b(ZILAVIR|AZT|ZIDOVUDINE)\b/i.test(arvUp);

    function sourceNote(keys) {
      const inHiv = hasAnyKeyword([...arvList, ...hivExtraTexts].join(' | '), keys);
      return (!inHiv && hasAnyKeyword(fromMrOnly, keys)) ? ' (ตรวจพบจากรายการยาแท็บ 1. MR)' : '';
    }

    if (hasDtg) {
      const cationKeys = ['calcium', 'caltrate', 'ca ', 'ca(', 'ferrous', 'iron', 'antacid', 'alum', 'magnesium', 'zinc', 'sucralfate', 'multivitamin', 'mtv', 'แคลเซียม', 'ธาตุเหล็ก', 'ยาลดกรด'];
      if (hasAnyKeyword(coMedText, cationKeys)) {
        alerts.push({
          level: 'warn',
          title: `D/I: DTG + แคลเซียม / ธาตุเหล็ก / ยาลดกรด${sourceNote(cationKeys)}`,
          detail: 'ประจุบวก (Ca/Fe/Mg/Al) ลดการดูดซึม DTG — แนะนำกิน DTG ก่อน 2 ชม. หรือหลัง 6 ชม. (สำหรับ Ca/Fe สามารถกินพร้อมอาหารร่วมกับ DTG ได้)',
          source: 'DHHS / แนวทาง HIV ประเทศไทย'
        });
      }
      const mfmKeys = ['metformin', 'glucophage', 'mfm'];
      if (hasAnyKeyword(coMedText, mfmKeys)) {
        alerts.push({
          level: 'warn',
          title: `D/I: DTG + Metformin${sourceNote(mfmKeys)}`,
          detail: 'DTG ยับยั้ง OCT2/MATE1 ทำให้ระดับ Metformin สูงขึ้น — แนะนำจำกัด Metformin ≤ 1,000 mg/วัน และติดตามอาการทางเดินอาหาร/ระดับน้ำตาล',
          source: 'DHHS Adult & Adolescent ARV Guidelines'
        });
      }
      const indKeys = ['rifampin', 'rifampicin', 'carbamazepine', 'phenytoin', 'phenobarbital'];
      if (hasAnyKeyword(coMedText, indKeys)) {
        const isRif = hasAnyKeyword(coMedText, ['rifampin', 'rifampicin']);
        alerts.push({
          level: 'danger',
          title: `D/I สำคัญ: DTG + Enzyme Inducer${sourceNote(indKeys)}`,
          detail: isRif
            ? 'Rifampin ลดระดับ DTG ลงมาก — ต้องเพิ่มขนาด DTG เป็น 50 mg วันละ 2 ครั้ง (BID) ตลอดช่วงที่ได้รับ Rifampin (ยกเว้น 3HP/1HP ไม่ต้องปรับ DTG ตาม HIV_KB)'
            : 'Carbamazepine/Phenytoin/Phenobarbital ลดระดับ DTG อย่างมีนัยสำคัญ — ปรึกษาแพทย์ปรับเป็น DTG BID หรือเลือกยากันชักอื่น',
          source: 'แนวทาง HIV ประเทศไทย / DHHS'
        });
      }
    }

    if (hasPi) {
      const badStatinKeys = ['simvastatin', 'lovastatin'];
      if (hasAnyKeyword(coMedText, badStatinKeys)) {
        alerts.push({
          level: 'danger',
          title: `D/I ห้ามใช้ร่วมกัน: Boosted PI + Simvastatin${sourceNote(badStatinKeys)}`,
          detail: 'Ritonavir ยับยั้ง CYP3A4 รุนแรง เพิ่มระดับ Simvastatin เสี่ยง Rhabdomyolysis สูง — แนะนำเปลี่ยนเป็น Pravastatin, Pitavastatin หรือ Rosuvastatin/Atorvastatin ขนาดต่ำ',
          source: 'DHHS / Liverpool HIV Drug Interactions'
        });
      }
      const modStatinKeys = ['atorvastatin', 'rosuvastatin'];
      if (hasAnyKeyword(coMedText, modStatinKeys)) {
        alerts.push({
          level: 'warn',
          title: `D/I: Boosted PI + Atorvastatin/Rosuvastatin${sourceNote(modStatinKeys)}`,
          detail: 'ระดับ Statin เพิ่มขึ้นจาก Ritonavir — เริ่มขนาดต่ำสุดที่คุมไขมันได้ (เช่น Atorvastatin ≤ 20 mg/วัน, Rosuvastatin ≤ 10 mg/วัน) และเฝ้าระวังปวดกล้ามเนื้อ',
          source: 'DHHS / Liverpool HIV Drug Interactions'
        });
      }
      const rifKeys = ['rifampin', 'rifampicin'];
      if (hasAnyKeyword(coMedText, rifKeys)) {
        alerts.push({
          level: 'danger',
          title: `D/I ห้ามใช้ร่วมกัน: PI (ATV/LPV/DRV) + Rifampin${sourceNote(rifKeys)}`,
          detail: 'Rifampin ลดระดับยากลุ่ม PI ลง > 75% เสี่ยงการรักษาล้มเหลว — ปรึกษาแพทย์เปลี่ยนเป็น Rifabutin หรือเปลี่ยนสูตร ARV',
          source: 'แนวทาง HIV ประเทศไทย / DHHS'
        });
      }
      const cypKeys = ['warfarin', 'clopidogrel', 'rivaroxaban', 'apixaban', 'dabigatran', 'amlodipine', 'budesonide', 'fluticasone'];
      if (hasAnyKeyword(coMedText, cypKeys)) {
        const hit = matchedKeywords(coMedText, cypKeys);
        alerts.push({
          level: 'warn',
          title: `D/I: Ritonavir/Boosted PI + ${hit.join(', ')}${sourceNote(cypKeys)}`,
          detail: 'Ritonavir ยับยั้ง CYP3A4/P-gp สูงมาก — อาจเพิ่มระดับ CCB/DOAC/Inhaled steroid (เสี่ยง Cushing) หรือลดฤทธิ์ Clopidogrel / เปลี่ยนแปลง INR ของ Warfarin',
          source: 'DHHS / Liverpool HIV Drug Interactions'
        });
      }
    }

    if (hasAtv) {
      const ppiKeys = ['omeprazole', 'esomeprazole', 'lansoprazole', 'pantoprazole', 'rabeprazole', 'famotidine', 'ranitidine'];
      if (hasAnyKeyword(coMedText, ppiKeys)) {
        alerts.push({
          level: 'warn',
          title: `D/I: Atazanavir (ATV) + ยาลดกรด PPI/H2RA${sourceNote(ppiKeys)}`,
          detail: 'การลดกรดในกระเพาะลดการดูดซึม ATV อย่างมาก — ห้ามใช้กับ unboosted ATV; หากเป็น ATV/r ให้ Omeprazole ≤ 20 mg/วัน และแยกเวลากินตามเกณฑ์',
          source: 'DHHS / Liverpool HIV Drug Interactions'
        });
      }
    }

    if (hasRpv) {
      const rpvBad = ['omeprazole', 'esomeprazole', 'lansoprazole', 'pantoprazole', 'rabeprazole', 'rifampin', 'rifampicin', 'carbamazepine', 'phenytoin'];
      if (hasAnyKeyword(coMedText, rpvBad)) {
        alerts.push({
          level: 'danger',
          title: `D/I ห้ามใช้ร่วมกัน: Rilpivirine (RPV) + PPI / Enzyme Inducer${sourceNote(rpvBad)}`,
          detail: 'ห้ามใช้ RPV ร่วมกับ PPI หรือ Rifampin/Carbamazepine/Phenytoin เนื่องจากทำให้ระดับ RPV ต่ำกว่าเกณฑ์รักษา',
          source: 'DHHS / Liverpool HIV Drug Interactions'
        });
      }
    }

    if (hasTdf) {
      const nsaidKeys = ['ibuprofen', 'naproxen', 'diclofenac', 'mefenamic', 'ponstan', 'celecoxib', 'etoricoxib', 'arcoxia', 'meloxicam', 'piroxicam'];
      if (hasAnyKeyword(coMedText, nsaidKeys)) {
        alerts.push({
          level: 'warn',
          title: `D/I: TDF + ยาแก้ปวด NSAIDs${sourceNote(nsaidKeys)}`,
          detail: 'เพิ่มความเสี่ยงพิษต่อไตเฉียบพลัน (AKI) — แนะนำหลีกเลี่ยง NSAIDs และติดตาม Scr/UA protein',
          source: 'Liverpool HIV Drug Interactions / แนวทาง HIV'
        });
      }
    }

    if (hasAzt && hasAnyKeyword(coMedText, ['bactrim', 'cotrimoxazole', 'tmp-smx', 'ribavirin', 'ganciclovir', 'stavudine'])) {
      alerts.push({
        level: 'warn',
        title: 'D/I: AZT ร่วมกับยาที่มีผลกดไขกระดูก/ซ้ำซ้อน',
        detail: 'ติดตามค่า Hb/Hct และ CBC ใกล้ชิดเพื่อเฝ้าระวังภาวะโลหิตจางและเม็ดเลือดขาวต่ำ',
        source: 'แนวทาง HIV ประเทศไทย'
      });
    }

    // 3) CD4 / VL / Adherence / BP
    const cd4 = numVal('hivCd4Val');
    if (!isNaN(cd4) && cd4 < 200) {
      alerts.push({
        level: cd4 < 100 ? 'danger' : 'warn',
        title: `CD4 ต่ำ (${cd4} cells/mm³ < 200)`,
        detail: cd4 < 100
          ? 'ตรวจสอบการให้ยาป้องกันโรคฉวยโอกาส PCP (TMP-SMX) และประเมินคัดกรอง Cryptococcus (CrAg) ตามแนวทาง HIV ไทย'
          : 'ตรวจสอบยาป้องกันโรคฉวยโอกาส PCP (TMP-SMX) ตามตารางที่ 5.21 ในคลังความรู้',
        source: 'แนวทางปฏิบัติ HIV/AIDS ประเทศไทย (ตาราง 5.21 ในแอป)'
      });
    }

    const vlSel = val('hivVlSelect');
    if (vlSel === 'other') {
      const vlNum = numVal('hivVlVal');
      if (!isNaN(vlNum) && vlNum >= 1000) {
        alerts.push({
          level: 'danger',
          title: `Viral Load สูง (${vlNum} copies/mL ≥ 1,000)`,
          detail: 'ประเมิน Adherence, Drug Interaction และส่งปรึกษาแพทย์เพื่อพิจารณาตรวจซ้ำ/ประเมินภาวะ Virologic Failure',
          source: 'แนวทางปฏิบัติ HIV/AIDS ประเทศไทย'
        });
      } else if (!isNaN(vlNum) && vlNum > 50) {
        alerts.push({
          level: 'warn',
          title: `Viral Load ตรวจพบได้ (${vlNum} copies/mL > 50)`,
          detail: 'ทบทวน Adherence, การกินยาตรงเวลา และอันตรกิริยากับยา/อาหารเสริม',
          source: 'แนวทางปฏิบัติ HIV/AIDS ประเทศไทย'
        });
      }
    }

    // Adherence check
    let adhPct = NaN;
    if (checked('hivCalcAdherence')) {
      const days = numVal('hivDays');
      const doses = numVal('hivDoses');
      const missed = numVal('hivMissed') || 0;
      if (days > 0 && doses > 0) {
        const total = days * doses;
        adhPct = ((total - missed) / total) * 100;
      }
    } else {
      const mAdh = val('hivManualAdherence').replace('%', '');
      if (mAdh) adhPct = parseFloat(mAdh);
    }
    if (!isNaN(adhPct) && adhPct < 95) {
      alerts.push({
        level: adhPct < 80 ? 'danger' : 'warn',
        title: `Adherence ต่ำกว่าเกณฑ์ (${adhPct.toFixed(1)}% < 95%)`,
        detail: 'เสี่ยงเชื้อดื้อยา — ค้นหาสาเหตุการลืม/เลท และวางแผนช่วยเหลือผู้ป่วย (เช่น ตั้งนาฬิกา/กล่องยา)',
        source: 'แนวทางปฏิบัติ HIV/AIDS ประเทศไทย'
      });
    }

    const bp = parseBp(val('hivBp'));
    if (!isNaN(bp.sbp) && !isNaN(bp.dbp) && (bp.sbp >= 140 || bp.dbp >= 90)) {
      alerts.push({
        level: (bp.sbp >= 180 || bp.dbp >= 110) ? 'danger' : 'warn',
        title: `ความดันโลหิตสูง (${bp.text} mmHg)`,
        detail: (bp.sbp >= 180 || bp.dbp >= 110)
          ? 'BP สูงมากระดับวิกฤต — วัดซ้ำและส่งพบแพทย์ทันที'
          : 'วัดซ้ำเพื่อยืนยัน และพิจารณาติ๊กส่งปรึกษาแพทย์เรื่อง Ht หากจำเป็น',
        source: 'เกณฑ์ความดันโลหิต (Thai HT Guideline)'
      });
    }

    return alerts;
  }

  function parseTargetInrRange(rawTarget) {
    const s = String(rawTarget || '').trim();
    const m = s.match(/(\d+(?:\.\d+)?)\s*[-–ถึงto]+\s*(\d+(?:\.\d+)?)/i);
    if (m) {
      const min = parseFloat(m[1]);
      const max = parseFloat(m[2]);
      if (min > 0 && max >= min) return { min, max, label: `${min}–${max}` };
    }
    return { min: 2.0, max: 3.0, label: '2.0–3.0' };
  }

  function getActiveWfSubTab() {
    const active = document.querySelector('.wf-nav-link.active')?.id || 'wf-note-tab';
    return active.replace(/^wf-/, '').replace(/-tab$/, '');
  }

  function evalWarfarinAlerts() {
    const alerts = [];
    const sub = getActiveWfSubTab();
    const inrNote = numVal('wfNoteInrToday');
    const inrRif = numVal('rifCurrentInr');
    const inr = (sub === 'rifampin' && !isNaN(inrRif)) ? inrRif : inrNote;

    let targetRaw = radioVal('wfNoteTarget');
    if (targetRaw === 'อื่นๆ') targetRaw = val('wfNoteTargetOther');
    if (sub === 'manual') {
      const manualGoal = document.querySelector('#warfarinForm input[name="goal"]')?.value;
      if (manualGoal) targetRaw = manualGoal;
    }
    const target = parseTargetInrRange(targetRaw || '2-3');
    const indication = val('wfNoteIndication') || (document.querySelector('#warfarinForm input[name="indication"]')?.value || '');

    if (indication && /mvr/i.test(indication) && target.min === 2.0 && target.max === 3.0) {
      alerts.push({
        level: 'info',
        title: 'ข้อบ่งใช้ MVR กับ Target INR 2.0–3.0',
        detail: 'ตรวจสอบ Target INR ที่แพทย์กำหนด (ผู้ป่วย S/P MVR ลิ้นหัวใจเทียมมักใช้เป้าหมาย 2.5–3.5)',
        source: 'CHEST / Thai Warfarin Guideline'
      });
    }

    if (!isNaN(inr)) {
      if (inr >= 9.0) {
        alerts.push({
          level: 'danger',
          title: `INR สูงวิกฤต (${inr} ≥ 9.0)`,
          detail: 'เสี่ยงเลือดออกรุนแรงมาก — หากไม่มีเลือดออก พิจารณาหยุดยา 5–7 วัน และให้ Vitamin K1 5–10 mg กิน (หากมีอาการเลือดออกส่งพบแพทย์ฉุกเฉินทันที)',
          source: 'ตารางจัดการ INR ในแอป / CHEST'
        });
      } else if (inr >= 5.0) {
        alerts.push({
          level: 'danger',
          title: `INR สูงมาก (${inr}, ช่วง 5.0–8.9)`,
          detail: 'หากไม่มีเลือดออก พิจารณาหยุดยา 2–3 วัน ± Vitamin K1 1 mg กิน และลดขนาดยารวม ~20%/สัปดาห์ (หากมี bleeding ส่งพบแพทย์ทันที)',
          source: 'ตารางจัดการ INR ในแอป / CHEST'
        });
      } else if (inr >= 4.0) {
        alerts.push({
          level: 'warn',
          title: `INR สูงกว่าเป้า (${inr}, ช่วง 4.0–4.9)`,
          detail: 'พิจารณาหยุดยา 1 วัน และลดขนาดยารวม 10–20%/สัปดาห์ พร้อมซักประวัติอาการเลือดออก ยาใหม่ และอาหาร/สมุนไพร',
          source: 'ตารางจัดการ INR ในแอป / CHEST'
        });
      } else if (inr > target.max) {
        alerts.push({
          level: 'warn',
          title: `INR สูงกว่าเป้าหมาย (${inr} > ${target.max})`,
          detail: `เป้าหมายคือ ${target.label} — พิจารณาลดขนาดยา 5–10%/สัปดาห์ และติดตาม INR`,
          source: 'ตารางจัดการ INR ในแอป / CHEST'
        });
      } else if (inr < 1.5) {
        alerts.push({
          level: 'warn',
          title: `INR ต่ำมาก (${inr} < 1.5, เป้า ${target.label})`,
          detail: 'เสี่ยงลิ่มเลือดอุดตัน — พิจารณาเพิ่มขนาดยา 10–20%/สัปดาห์ และซักประวัติการลืมกินยา ยา/อาหารที่มีผลลด INR',
          source: 'ตารางจัดการ INR ในแอป / CHEST'
        });
      } else if (inr < target.min) {
        alerts.push({
          level: 'info',
          title: `INR ต่ำกว่าเป้าหมาย (${inr} < ${target.min}, เป้า ${target.label})`,
          detail: 'พิจารณาเพิ่มขนาดยา 5–10%/สัปดาห์ หรือทบทวนความสม่ำเสมอ/อาหารวิตามินเค ก่อนปรับขนาดยา',
          source: 'ตารางจัดการ INR ในแอป / CHEST'
        });
      }
    }

    const adrChoice = radioVal('wfNoteAdr');
    const adrText = val('wfNoteAdrText');
    const bleedKeys = ['เลือดออก', 'จ้ำเลือด', 'ถ่ายดำ', 'อาเจียน', 'ปัสสาวะเป็นเลือด', 'เลือดกำเดา', 'เหงือก', 'bleed', 'hematuria', 'melena', 'ecchymosis'];
    if (adrChoice === 'Yes' || hasAnyKeyword(adrText, bleedKeys)) {
      alerts.push({
        level: 'danger',
        title: `พบรายงาน ADR / สงสัยอาการเลือดออก${adrText ? ': ' + adrText : ''}`,
        detail: 'ประเมินระดับความรุนแรงของเลือดออก สัญญาณชีพ และส่งปรึกษาแพทย์ทันที',
        source: 'Warfarin Bleeding Safety Protocol'
      });
    }

    const diChoice = radioVal('wfNoteDi');
    const diText = val('wfNoteDiText');
    if (diChoice === 'Yes' || diText) {
      const upInr = matchedKeywords(diText, ['amiodarone', 'fluconazole', 'voriconazole', 'itraconazole', 'metronidazole', 'cotrimoxazole', 'bactrim', 'tmp-smx', 'ciprofloxacin', 'levofloxacin', 'clarithromycin', 'erythromycin', 'nsaid', 'ibuprofen', 'naproxen', 'diclofenac', 'celecoxib', 'etoricoxib', 'aspirin', 'clopidogrel', 'ตังกุย', 'แดนเซิน', 'แปะก๊วย', 'มะม่วง', 'แอลกอฮอล์']);
      const downInr = matchedKeywords(diText, ['rifampin', 'rifampicin', 'carbamazepine', 'phenytoin', 'phenobarbital', 'เซนต์จอห์น', 'ผัก', 'คะน้า', 'ผักบุ้ง', 'วิตามินเค', 'vitamin k', 'นมถั่วเหลือง', 'ชาเขียว']);
      let detail = 'ตรวจสอบทิศทางผลต่อ INR และติดตาม INR ถี่ขึ้นหลังเริ่มหรือหยุดรายการดังกล่าว';
      if (upInr.length > 0) detail = `รายการ (${upInr.join(', ')}) มักเพิ่มค่า INR หรือเพิ่มความเสี่ยงเลือดออก — ติดตาม INR ใกล้ชิด`;
      if (downInr.length > 0) detail = `รายการ (${downInr.join(', ')}) มักลดค่า INR — ติดตาม INR และคำนึงถึงจังหวะ Onset/Offset`;
      alerts.push({
        level: (upInr.length > 0 || hasAnyKeyword(diText, ['rifampin', 'rifampicin'])) ? 'warn' : 'info',
        title: `พบอันตรกิริยา Warfarin (D/I)${diText ? ': ' + diText : ''}`,
        detail,
        source: 'คลังข้อมูล Warfarin ในแอป (Holbrook 2005 / Tan & Lee 2021)'
      });
    }

    if (radioVal('wfNoteAdherence') === 'Poor') {
      alerts.push({
        level: 'warn',
        title: 'Adherence ไม่ดี (Poor)',
        detail: 'หลีกเลี่ยงการเร่งเพิ่มขนาดยาหากยังกินไม่สม่ำเสมอ — ทบทวนวิธีจัดยา/ใบตารางทานยาภาพสีร่วมกับผู้ป่วย',
        source: 'Thai Warfarin Clinic Standard'
      });
    }

    return alerts;
  }

  function evalHfAlerts() {
    const alerts = [];
    if (typeof window.evaluateHfGdmt !== 'function') return alerts;
    const ev = window.evaluateHfGdmt();
    const c = ev.clinical || {};

    ['raasi', 'bb', 'mra', 'sglt2i'].forEach(k => {
      const p = ev.pillars[k];
      (p.alerts || []).forEach(a => {
        const idx = a.text.indexOf(':');
        const shortTitle = idx > 0 && idx < 70
          ? `${p.title}: ${a.text.slice(0, idx)}`
          : `${p.title.replace(/^\d+\.\s*/, '')} — ข้อควรระวังทางคลินิก`;
        alerts.push({
          level: a.level === 'danger' ? 'danger' : (a.level === 'warn' ? 'warn' : 'info'),
          title: shortTitle,
          detail: a.text,
          source: 'AHA/ACC 2022 & ESC 2021/2023 (HF GDMT ในแอป)'
        });
      });
    });

    const missing = ['raasi', 'bb', 'mra', 'sglt2i'].filter(k => !ev.pillars[k].on);
    const hasAnyHfData = !isNaN(c.lvef) || !isNaN(c.sbp) || !isNaN(c.hr) || !isNaN(c.egfr) || !isNaN(c.k) || ev.onCount > 0;
    if (hasAnyHfData && missing.length > 0) {
      const missingNames = missing.map(k => ev.pillars[k].title.replace(/^\d+\.\s*/, '')).join(', ');
      if (ev.phenotype === 'HFrEF' || ev.phenotype === 'unknown') {
        alerts.push({
          level: ev.phenotype === 'HFrEF' ? 'warn' : 'info',
          title: `ได้ยา GDMT ${ev.onCount}/4 เสาหลัก (ยังขาด: ${missingNames})`,
          detail: ev.phenotype === 'HFrEF'
            ? 'ใน HFrEF (LVEF ≤ 40%) แนะนำเริ่มยาครบ 4 เสาหลัก (Quadruple Therapy) หากไม่มีข้อห้ามเพื่อลดการเสียชีวิตและนอน รพ.'
            : 'ระบุ LVEF (%) เพื่อยืนยันแนวทาง GDMT — หากเป็น HFrEF ควรพิจารณาเริ่มยาให้ครบ 4 เสาหลัก',
          source: '2022 AHA/ACC/HFSA & 2021 ESC HF Guidelines'
        });
      }
    }

    const subTarget = ['raasi', 'bb', 'mra'].map(k => ev.pillars[k]).filter(p => p.on && p.status === 'low');
    if (subTarget.length > 0) {
      const parts = subTarget.map(p => `${p.title.replace(/^\d+\.\s*/, '')} (${p.pct != null ? p.pct + '% ของเป้า' : 'ยังไม่ถึงเป้า'} → ${p.nextStep})`);
      alerts.push({
        level: 'info',
        title: `ยา GDMT ยังไม่ถึง Target Dose (${subTarget.length} เสา)`,
        detail: parts.join(' | '),
        source: '2024 ACC ECDP for HFrEF'
      });
    }

    (ev.addons || []).forEach(ad => {
      if (ad.tone === 'danger' || /ไม่ควรใช้|คั่งน้ำ|ขาดธาตุเหล็ก/.test(ad.title)) {
        alerts.push({
          level: ad.tone === 'danger' ? 'danger' : 'info',
          title: ad.title,
          detail: ad.body,
          source: 'AHA/ACC & ESC HF Guidelines'
        });
      }
    });

    return alerts;
  }

  function evalCkdAlerts() {
    const alerts = [];
    const egfr = numVal('c7Egfr');
    const lastEgfr = numVal('c7LastEgfr');
    const stage = val('c7CkdStage');
    const combinedText = [
      val('c7DrugWatchInput'),
      val('c7NephroText'),
      val('c7DiText'),
      val('c7Drp')
    ].join(' ').toLowerCase();

    if (Array.isArray((typeof ckdRenalRules !== 'undefined' ? ckdRenalRules : undefined))) {
      (typeof ckdRenalRules !== 'undefined' ? ckdRenalRules : undefined).forEach(rule => {
        if (rule.keywords.some(kw => combinedText.includes(kw))) {
          const res = rule.check(egfr, stage);
          if (res) {
            alerts.push({
              level: res.level === 'danger' ? 'danger' : 'warn',
              title: res.title,
              detail: res.advice,
              source: 'เกณฑ์ปรับขนาดยาตามไต (CKD Rules ในแอป)'
            });
          }
        }
      });
    }

    if (!isNaN(lastEgfr) && !isNaN(egfr) && lastEgfr > 0) {
      const drop = lastEgfr - egfr;
      const pctDrop = (drop / lastEgfr) * 100;
      if (drop >= 5 || pctDrop >= 25) {
        alerts.push({
          level: pctDrop >= 25 ? 'danger' : 'warn',
          title: `eGFR ลดลงจากครั้งก่อน (${lastEgfr} → ${egfr} mL/min, -${drop.toFixed(1)})`,
          detail: 'ประเมินสาเหตุไตเสื่อมเร็ว เช่น ภาวะขาดน้ำ, NSAIDs, สมุนไพร, Contrast หรือการติดเชื้อ และปรึกษาแพทย์',
          source: 'KDIGO CKD Evaluation Guideline'
        });
      }
    }

    const kText = val('c7K');
    const kVal = /^\d+(?:\.\d+)?$/.test(kText) ? parseFloat(kText) : extractNumberNear(kText, /\bK\+?\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
    if (!isNaN(kVal)) {
      if (kVal >= 5.5) {
        alerts.push({
          level: 'danger',
          title: `โพแทสเซียมสูง (K+ = ${kVal} mEq/L ≥ 5.5)`,
          detail: 'เสี่ยงหัวใจเต้นผิดจังหวะ — ทบทวน ACEI/ARB/MRA/NSAIDs และอาหาร K+ สูง ส่งปรึกษาแพทย์',
          source: 'KDIGO CKD Guideline'
        });
      } else if (kVal >= 5.1) {
        alerts.push({
          level: 'warn',
          title: `โพแทสเซียมค่อนข้างสูง (K+ = ${kVal} mEq/L)`,
          detail: 'ติดตามค่า K+ ซ้ำและเน้นย้ำควบคุมอาหาร/ผลไม้โพแทสเซียมสูง',
          source: 'KDIGO CKD Guideline'
        });
      }
    }

    const bp = parseBp(val('c7Bp'));
    if (!isNaN(bp.sbp) && !isNaN(bp.dbp) && (bp.sbp >= 160 || bp.dbp >= 100)) {
      alerts.push({
        level: 'warn',
        title: `ความดันโลหิตสูงในผู้ป่วย CKD (${bp.text} mmHg)`,
        detail: 'ความดันสูงเร่งการเสื่อมของไต — ทบทวนความสม่ำเสมอของยาลดความดันและการคุมเค็ม',
        source: 'KDIGO BP in CKD Guideline'
      });
    }

    const herb = val('c7HerbText');
    if (herb) {
      alerts.push({
        level: 'warn',
        title: `พบการใช้สมุนไพร/อาหารเสริม (${herb})`,
        detail: 'ผู้ป่วย CKD มีความเสี่ยงพิษต่อไตสะสมและ K+/PO4 สูงจากสมุนไพร/ผงผัก — แนะนำให้งดและแจ้งแพทย์',
        source: 'คู่มือ Pre-dialysis Education ในแอป'
      });
    }

    return alerts;
  }

  function evalAsthmaAlerts() {
    const alerts = [];
    const dx = radioVal('c8Indication');
    const er = numVal('c8Er');
    const admit = numVal('c8Admit');
    const scoreRaw = val('c8Score');
    const compRaw = val('c8Compliance').replace('%', '');
    const comp = compRaw ? parseFloat(compRaw) : NaN;

    if ((!isNaN(er) && er >= 1) || (!isNaN(admit) && admit >= 1)) {
      alerts.push({
        level: 'danger',
        title: `มีประวัติหอบกำเริบ (ER ${!isNaN(er) ? er : 0} ครั้ง, Admit ${!isNaN(admit) ? admit : 0} ครั้ง)`,
        detail: 'ความเสี่ยงกำเริบซ้ำสูง — ทบทวนการใช้ Controller สม่ำเสมอ เทคนิคพ่นยา และพิจารณาปรึกษาแพทย์ปรับแผนรักษา',
        source: 'GINA 2024 / GOLD 2024'
      });
    }

    const scoreNum = /^\d+(?:\.\d+)?$/.test(scoreRaw) ? parseFloat(scoreRaw) : extractNumberNear(scoreRaw, /(\d+(?:\.\d+)?)/);
    if (!isNaN(scoreNum)) {
      const isCat = /cat/i.test(scoreRaw) || (dx === 'COPD' && !/act/i.test(scoreRaw));
      if (isCat && scoreNum >= 10) {
        alerts.push({
          level: 'warn',
          title: `CAT Score = ${scoreNum} (≥ 10: อาการมาก)`,
          detail: 'ประเมินเทคนิคพ่นยา ความสม่ำเสมอ และพิจารณายาขยายหลอดลมร่วมกับแพทย์',
          source: 'GOLD 2024'
        });
      } else if (!isCat && scoreNum <= 19) {
        alerts.push({
          level: scoreNum <= 15 ? 'danger' : 'warn',
          title: `ACT Score = ${scoreNum} (${scoreNum <= 15 ? '≤ 15: คุมอาการไม่ได้มาก' : '≤ 19: ยังคุมอาการไม่ได้'})`,
          detail: 'ตรวจสอบ Technique, Compliance และปัจจัยกระตุ้นก่อนพิจารณา Step-up กับแพทย์',
          source: 'GINA 2024'
        });
      }
    }

    const symps = Array.from(document.querySelectorAll('#form-ASTHMA .c8-symp:checked')).map(cb => cb.value);
    if (symps.length > 0) {
      alerts.push({
        level: 'info',
        title: `พบอาการทางเดินหายใจที่ยังไม่คุมดี (${symps.length} ข้อ)`,
        detail: `อาการ: ${symps.join(', ')} — ทบทวนการใช้ยาควบคุมอาการและการพ่นยา`,
        source: 'GINA 2024'
      });
    }

    if (Array.isArray((typeof asthmaDevicesDef !== 'undefined' ? asthmaDevicesDef : undefined))) {
      let hasController = false;
      let hasReliever = false;
      let frequentReliever = false;

      (typeof asthmaDevicesDef !== 'undefined' ? asthmaDevicesDef : undefined).forEach(dev => {
        const devChecked = checked(`c8_dev_${dev.id}`);
        const checkedMeds = (dev.drugs || []).filter(m => checked(`c8_med_${m.id}`));
        checkedMeds.forEach(m => {
          if (m.isReliever) {
            hasReliever = true;
            const relFreq = val(`c8_med_${m.id}_reliever_freq`);
            if (relFreq && (/ทุกวัน|วันละ|สัปดาห์ละ\s*[3-9]|สัปดาห์ละ\s*\d{2,}|บ่อย|4-5|3-4|ทุก\s*ชม/i.test(relFreq))) {
              frequentReliever = true;
            }
          } else {
            hasController = true;
          }
        });
        if ((devChecked || checkedMeds.length > 0) && typeof window.getC8DeviceEvalSummary === 'function') {
          const ev = window.getC8DeviceEvalSummary(dev.id);
          if (ev && ev.pct < 80) {
            alerts.push({
              level: 'warn',
              title: `เทคนิคพ่นยา ${dev.title} ได้ ${ev.pct}% (< 80%)`,
              detail: ev.missingSteps.length ? `ขั้นตอนที่ขาด: ${ev.missingSteps.join(', ')} — สอนซ้ำและพิมพ์ใบสรุปเทคนิค` : 'สอนทบทวนเทคนิคพ่นยาซ้ำ',
              source: 'แบบประเมินเทคนิคพ่นยาในแอป'
            });
          }
        }
      });

      if (dx === 'Asthma' && hasReliever && !hasController) {
        alerts.push({
          level: 'warn',
          title: 'Asthma ใช้เฉพาะยาบรรเทาอาการ (ไม่พบ Controller ที่มี ICS)',
          detail: 'แนวทาง GINA ไม่แนะนำ SABA-only ในผู้ใหญ่ — ตรวจสอบว่าผู้ป่วยมียา ICS หรือ ICS-formoterol หรือไม่',
          source: 'GINA 2024'
        });
      }
      if (frequentReliever) {
        alerts.push({
          level: 'warn',
          title: 'ใช้ยาพ่นบรรเทาอาการ (Reliever) บ่อย',
          detail: 'การใช้ SABA > 2 ครั้ง/สัปดาห์ บ่งชี้การควบคุมอาการยังไม่ดีและเพิ่มความเสี่ยงกำเริบ',
          source: 'GINA 2024'
        });
      }
    }

    if (!isNaN(comp) && comp < 80) {
      alerts.push({
        level: 'warn',
        title: `ความร่วมมือในการใช้ยาพ่นต่ำ (${comp}% < 80%)`,
        detail: 'ค้นหาสาเหตุ (เช่น ลืม/กลัวผลข้างเคียง/พ่นไม่ถนัด) และให้คำแนะนำปรับพฤติกรรม',
        source: 'GINA / GOLD Adherence Target'
      });
    }

    return alerts;
  }

  function parseHhmmMinutes(raw) {
    if (typeof formatC9Time === 'function') {
      const fmt = formatC9Time(raw);
      if (!fmt) return NaN;
      const p = fmt.split('.');
      return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
    }
    const s = String(raw || '').trim();
    if (!s) return NaN;
    const sep = s.match(/^(\d{1,2})[:.](\d{1,2})$/);
    let h, min;
    if (sep) {
      h = parseInt(sep[1], 10);
      min = parseInt(sep[2], 10);
    } else if (/^\d{1,2}$/.test(s)) {
      h = parseInt(s, 10); min = 0;
    } else {
      const d = s.replace(/\D/g, '');
      if (d.length === 3) { h = parseInt(d.slice(0, 1), 10); min = parseInt(d.slice(1), 10); }
      else if (d.length >= 4) { h = parseInt(d.slice(0, 2), 10); min = parseInt(d.slice(2, 4), 10); }
      else return NaN;
    }
    if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return NaN;
    return h * 60 + min;
  }

  function evalParkinsonAlerts() {
    const alerts = [];
    const meds = Array.isArray((typeof c9Meds !== 'undefined' ? c9Meds : undefined)) ? (typeof c9Meds !== 'undefined' ? c9Meds : undefined) : [];
    const drps = typeof window.collectC9Drps === 'function' ? window.collectC9Drps() : { items: [], advices: [] };
    const nms = Array.from(document.querySelectorAll('#form-PARKINSON .c9-nms:checked')).map(cb => cb.value);

    const hasNgOrDysphagia = drps.items.some(s => s.includes('สายยาง') || s.includes('กลืนลำบาก')) || nms.some(s => s.includes('กลืนลำบาก'));
    const hasCr = meds.some(m => /(HBS|PD 24h|CR)/i.test(m.name || ''));
    if (hasNgOrDysphagia && hasCr) {
      alerts.push({
        level: 'danger',
        title: 'ห้ามบด/หักยาออกฤทธิ์เนิ่น (HBS / CR / PD 24h)',
        detail: 'พบการใช้ยาชนิด CR/HBS ในผู้ป่วยใส่สายยางหรือกลืนลำบาก — ปรึกษาแพทย์เปลี่ยนเป็น Immediate-release หรือ Dispersible (เช่น Madopar Dispersible)',
        source: 'ISMP Do Not Crush List / กฎ Parkinson ในแอป'
      });
    }

    const mealTimes = [
      { label: 'เช้า', min: parseHhmmMinutes(val('c9MealBreak')) },
      { label: 'เที่ยง', min: parseHhmmMinutes(val('c9MealLunch')) },
      { label: 'เย็น', min: parseHhmmMinutes(val('c9MealDinner')) }
    ].filter(x => !isNaN(x.min));

    if (mealTimes.length > 0 && meds.length > 0) {
      const levodopaMeds = meds.filter(m => /(madopar|levopar|sinemet|stalevo|levodopa)/i.test(m.name || ''));
      const overlaps = [];
      levodopaMeds.forEach(m => {
        const mMin = parseHhmmMinutes(m.time);
        if (isNaN(mMin)) return;
        mealTimes.forEach(meal => {
          const diff = mMin - meal.min;
          if (diff >= -15 && diff <= 60) {
            overlaps.push(`${m.name} (${m.time}) ใกล้มื้อ${meal.label}`);
          }
        });
      });
      if (overlaps.length > 0) {
        alerts.push({
          level: 'warn',
          title: 'เวลาทานยา Levodopa ใกล้/หลังมื้ออาหาร (Food Interaction)',
          detail: `${[...new Set(overlaps)].join(', ')} — โปรตีนลดการดูดซึม Levodopa ควรแยกกินก่อนอาหารอย่างน้อย 30–60 นาที หรือหลังอาหาร 1–2 ชม.`,
          source: 'NICE Parkinson Disease / MDS Clinical Guidance'
        });
      }
    }

    const fallOn = checked('c9Fall');
    const fallCount = numVal('c9FallCount');
    if (fallOn || (!isNaN(fallCount) && fallCount > 0)) {
      alerts.push({
        level: 'danger',
        title: `มีประวัติหกล้ม (${!isNaN(fallCount) ? fallCount : 1} ครั้ง ใน 6 เดือน)`,
        detail: 'ประเมิน Orthostatic hypotension, ยาที่ทำให้ง่วง/ความดันตก และการปรับสภาพแวดล้อมที่บ้าน',
        source: 'MDS / NICE Fall Risk Screening'
      });
    }

    const hasHallucination = drps.items.some(s => s.includes('ภาพหลอน')) || nms.some(s => s.includes('ภาพหลอน'));
    if (hasHallucination) {
      const hasAnticholOrDa = meds.some(m => /(trihexyphenidyl|artane|bromocriptine|ropinirole|requip|pramipexole)/i.test(m.name || ''));
      alerts.push({
        level: 'warn',
        title: 'พบอาการภาพหลอน / สับสน (Hallucinations)',
        detail: hasAnticholOrDa
          ? 'ผู้ป่วยได้รับ Anticholinergic หรือ Dopamine agonist — พิจารณาปรึกษาแพทย์ลด/หยุดยาที่กระตุ้นอาการทางจิต'
          : 'ประเมินสาเหตุและปรึกษาแพทย์พิจารณาทบทวนขนาดยากลุ่ม Dopaminergic',
        source: 'NICE NG71 Parkinson Disease'
      });
    }

    const offH = numVal('c9OffHours');
    const dysH = numVal('c9DysHours');
    if ((!isNaN(offH) && offH > 4) || (!isNaN(dysH) && dysH > 4)) {
      alerts.push({
        level: 'warn',
        title: 'Motor Fluctuations > 25% ของชั่วโมงตื่น (> 4 ชม./วัน)',
        detail: 'พิจารณาปรึกษาแพทย์ปรับตารางความถี่/ขนาดยา Levodopa หรือเพิ่ม COMT/MAO-B inhibitor ตามความเหมาะสม',
        source: 'เกณฑ์ประเมินความรุนแรง OFF/Dyskinesia ในแอป'
      });
    }

    return alerts;
  }

  function evalCapdAlerts() {
    const alerts = [];
    const bp = parseBp(val('c10Bp'), 'c10Sbp', 'c10Dbp');
    const hb = !isNaN(numVal('c10Hb')) ? numVal('c10Hb') : numVal('c10_m12_hb');
    const k = numVal('c10K');
    const po4 = numVal('c10Po4');
    const ca = numVal('c10Ca');
    const fe = numVal('c10Fe');
    const tsat = numVal('c10Tsat');

    if (!isNaN(bp.sbp) && (bp.sbp > 180 || (!isNaN(bp.dbp) && bp.dbp >= 110))) {
      alerts.push({
        level: 'danger',
        title: `ความดันโลหิตสูงวิกฤต (BP ${bp.text || bp.sbp} mmHg)`,
        detail: 'เฝ้าระวัง Hypertensive urgency และชะลอ/ระมัดระวังการปรับเพิ่ม EPO จนกว่าจะคุม BP ได้',
        source: 'KDIGO Anemia in CKD / เกณฑ์ CAPD ในแอป'
      });
    }

    if (!isNaN(hb)) {
      if (hb >= 13) {
        alerts.push({
          level: 'danger',
          title: `Hb สูง (Hb = ${hb} g/dL ≥ 13) — ควร Hold ยา EPO`,
          detail: 'ตามเกณฑ์ควร Hold EPO 2 สัปดาห์–1 เดือน (ลดความเสี่ยงหัวใจและหลอดเลือด/ลิ่มเลือด) และเกินเพดานสิทธิ์เบิกยา (Hb ≥ 12)',
          source: 'KDIGO Anemia / เกณฑ์ CAPD ในแอป'
        });
      } else if (hb >= 12) {
        alerts.push({
          level: 'warn',
          title: `Hb ≥ 12 g/dL (${hb} g/dL) — เกินเพดานสิทธิ์เบิกยา EPO`,
          detail: 'ตามสิทธิ์เบิกยา EPO ไม่ได้ และควรพิจารณาลดขนาดยา EPO ตามช่วง Hb 11.6–12.9',
          source: 'เกณฑ์เบิกยา EPO / CAPD ในแอป'
        });
      } else if (hb < 10) {
        alerts.push({
          level: 'warn',
          title: `Hb ต่ำ (Hb = ${hb} g/dL < 10)`,
          detail: 'พิจารณาปรับเพิ่มขนาด EPO และตรวจประเมินภาวะขาดธาตุเหล็ก (Ferritin/TSAT)',
          source: 'KDIGO Anemia / เกณฑ์ CAPD ในแอป'
        });
      }
    }

    if ((!isNaN(tsat) && tsat < 20) || (!isNaN(fe) && fe < 100)) {
      const parts = [];
      if (!isNaN(fe) && fe < 100) parts.push(`Ferritin ${fe} < 100`);
      if (!isNaN(tsat) && tsat < 20) parts.push(`TSAT ${tsat}% < 20%`);
      alerts.push({
        level: 'warn',
        title: `ภาวะพร่องธาตุเหล็ก (${parts.join(', ')})`,
        detail: 'EPO อาจตอบสนองไม่เต็มที่หากขาดธาตุเหล็ก — พิจารณาเสริมธาตุเหล็กและติดตามซ้ำ',
        source: 'KDIGO Anemia in CKD (TSAT ≥ 20%, Ferritin ≥ 100)'
      });
    }
    if (!isNaN(fe) && fe > 1000) {
      alerts.push({
        level: 'warn',
        title: `Ferritin สูง (${fe} > 1,000 ng/mL)`,
        detail: 'เฝ้าระวังภาวะเหล็กเกิน — พิจารณาทบทวน/หยุดยาเสริมธาตุเหล็ก',
        source: 'เกณฑ์ CAPD ในแอป'
      });
    }

    if (!isNaN(k) && (k < 3.5 || k > 5.5)) {
      const crit = k >= 6.0 || k < 3.0;
      alerts.push({
        level: crit ? 'danger' : 'warn',
        title: `โพแทสเซียมนอกเกณฑ์ (K+ = ${k} mEq/L, เกณฑ์ 3.5–5.5)`,
        detail: k < 3.5
          ? 'CAPD พบ K+ ต่ำได้บ่อย — ประเมินอาการอ่อนแรง ยาขับปัสสาวะ และการเสริมโพแทสเซียม'
          : 'K+ สูงเสี่ยงหัวใจเต้นผิดจังหวะ — ทบทวนอาหาร/ผลไม้ K+ สูง และยา ACEI/ARB/MRA',
        source: 'เกณฑ์ CAPD ในแอป'
      });
    }

    if (!isNaN(po4) && po4 > 5.5) {
      alerts.push({
        level: 'warn',
        title: `ฟอสฟอรัสสูง (PO4 = ${po4} > 5.5 mg/dL)`,
        detail: 'ทบทวน Phosphate binder (ย้ำทานพร้อมอาหารคำแรก) และคุมอาหารฟอสฟอรัสสูง',
        source: 'KDIGO CKD-MBD / เกณฑ์ CAPD ในแอป'
      });
    }

    if (!isNaN(ca) && (ca < 8.4 || ca > 10.2)) {
      alerts.push({
        level: 'warn',
        title: `แคลเซียมนอกเกณฑ์ (Ca = ${ca} mg/dL, อ้างอิง 8.4–10.2)`,
        detail: 'ทบทวนขนาด Calcium-based phosphate binder / Vitamin D ร่วมกับแพทย์',
        source: 'KDIGO CKD-MBD'
      });
    }

    return alerts;
  }

  function dedupeAlerts(alerts) {
    const seen = new Set();
    return (alerts || []).filter(a => {
      const k = [a.level || '', String(a.title || '').replace(/\s+/g, ' ').trim(), String(a.detail || '').replace(/\s+/g, ' ').trim()].join('|');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function evaluateClinicAlerts(clinic) {
    let list;
    switch (clinic) {
      case 'MR': list = evalMrAlerts(); break;
      case 'PREOP': list = evalPreopAlerts(); break;
      case 'ADR': list = evalAdrAlerts(); break;
      case 'HIV': list = evalHivAlerts(); break;
      case 'WARFARIN': list = evalWarfarinAlerts(); break;
      case 'HF': list = evalHfAlerts(); break;
      case 'CKD': list = evalCkdAlerts(); break;
      case 'ASTHMA': list = evalAsthmaAlerts(); break;
      case 'PARKINSON': list = evalParkinsonAlerts(); break;
      case 'CAPD': list = evalCapdAlerts(); break;
      case 'PID': list = (typeof window.pmkPidEvalAlerts === 'function') ? window.pmkPidEvalAlerts() : []; break;
      case 'OPENHEART': list = (typeof window.pmkOpenHeartEvalAlerts === 'function') ? window.pmkOpenHeartEvalAlerts() : []; break;
      default: list = [];
    }
    return dedupeAlerts(list);
  }


  // ==========================================================
  //  TICKED ALERTS -> delimited block at bottom of #outputPmk
  // ==========================================================

  const ALERT_BLOCK_START = '[Clinical alert]';
  const ALERT_BLOCK_END = '[/Clinical alert]';
  const ALERT_BLOCK_RE = /\n?[ \t]*\[Clinical alert\]\n[\s\S]*?\n?\[\/Clinical alert\][ \t]*/;

  const tickedByClinic = Object.fromEntries(CLINICS.map(c => [c.id, new Set()]));

  function alertKey(a) {
    const norm = s => String(s || '').replace(/[\d.,]+/g, '#').replace(/\s+/g, ' ').trim();
    return [a.level || '', norm(a.title), norm(a.detail).slice(0, 80)].join('|');
  }

  function formatAlertLine(a) {
    const title = String(a.title || '').trim();
    let rec = String(a.detail || '').trim();
    if (title && rec.startsWith(title)) {
      rec = rec.slice(title.length).replace(/^[:\s—\-–]+/, '').trim();
    }
    if (rec && rec.length > 240) rec = rec.slice(0, 237).trimEnd() + '...';
    return rec ? `- ${title}: ${rec}` : `- ${title}`;
  }

  function buildAlertBlock(clinic) {
    const ticked = tickedByClinic[clinic];
    if (!ticked || ticked.size === 0) return '';
    const lines = evaluateClinicAlerts(clinic)
      .filter(a => ticked.has(alertKey(a)))
      .map(formatAlertLine);
    if (!lines.length) return '';
    return [ALERT_BLOCK_START, ...lines, ALERT_BLOCK_END].join('\n');
  }

  function pruneMissingTicks(clinic, alerts) {
    const ticked = tickedByClinic[clinic];
    if (!ticked || ticked.size === 0) return false;
    const present = new Set(alerts.map(alertKey));
    let changed = false;
    [...ticked].forEach(k => {
      if (!present.has(k)) {
        ticked.delete(k);
        changed = true;
      }
    });
    return changed;
  }

  function applyAlertBlockToNote(clinic) {
    clinic = clinic || activeClinic();
    if (clinic !== activeClinic()) return;
    const out = document.getElementById('outputPmk');
    if (!out) return;

    const text = String(out.value || '');
    const m = text.match(ALERT_BLOCK_RE);
    let base = text;
    let after = '';
    if (m) {
      base = text.slice(0, m.index);
      after = text.slice(m.index + m[0].length);
    }
    base = base.replace(/[ \t]+$/g, '').replace(/\n+$/g, '');
    after = after.replace(/^[ \t]+/g, '').replace(/^\n+/, '');

    const block = buildAlertBlock(clinic);
    let next = base;
    if (block) next = (next ? next + '\n\n' : '') + block;
    if (after) next = (next ? next + '\n' : '') + after;

    if (out.value !== next) {
      out.value = next;
      if (typeof window.updateOpdStickerPreview === 'function') {
        window.updateOpdStickerPreview();
      }
    }
  }

  function onAlertTickChange(e) {
    const cb = e.target && e.target.closest && e.target.closest('.pmk-alert-tick-cb');
    if (!cb) return;
    e.stopPropagation();
    const clinic = cb.getAttribute('data-pmk-clinic');
    let key = cb.getAttribute('data-pmk-alert-key') || '';
    try { key = decodeURIComponent(key); } catch (err) {}
    if (!clinic || !key) return;
    if (!tickedByClinic[clinic]) tickedByClinic[clinic] = new Set();
    if (cb.checked) tickedByClinic[clinic].add(key);
    else tickedByClinic[clinic].delete(key);
    applyAlertBlockToNote(clinic);
  }

  function clearAllTicks() {
    CLINICS.forEach(c => tickedByClinic[c.id] = new Set());
  }

  // ==========================================================
  //  UI RENDERING & STYLES
  // ==========================================================

  function injectStyles() {
    if (document.getElementById('pmkAlertsStyles')) return;
    const style = document.createElement('style');
    style.id = 'pmkAlertsStyles';
    style.textContent = `
      .pmk-top-alert {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid;
        font-size: 13px;
        line-height: 1.4;
        margin-bottom: 12px;
        cursor: pointer;
        transition: box-shadow 0.2s, transform 0.15s;
      }
      .pmk-top-alert:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
      .pmk-top-alert--danger { background: #fef2f2; border-color: #ef4444; color: #7f1d1d; }
      .pmk-top-alert--warn { background: #fffbeb; border-color: #f59e0b; color: #78350f; }
      .pmk-top-alert--info { background: #f0f9ff; border-color: #38bdf8; color: #0c4a6e; }
      .pmk-top-alert-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0; }
      .pmk-top-alert-cta { font-size: 12px; font-weight: 600; white-space: nowrap; text-decoration: underline; }

      .pmk-clinic-panel {
        margin-top: 18px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
      }
      .pmk-clinic-panel.pmk-alert-pulse {
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.35);
      }
      .pmk-panel-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 16px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .pmk-panel-title {
        font-weight: 700;
        font-size: 14px;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pmk-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid transparent;
      }
      .pmk-badge--danger { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
      .pmk-badge--warn { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
      .pmk-badge--info { background: #e0f2fe; color: #075985; border-color: #7dd3fc; }
      .pmk-badge--ok { background: #dcfce7; color: #166534; border-color: #86efac; }

      .pmk-alert-body { padding: 12px 16px; }
      .pmk-alert-ok {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #166534;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 8px 12px;
      }
      .pmk-alert-list { display: flex; flex-direction: column; gap: 8px; }
      .pmk-alert-item {
        border-left: 4px solid;
        border-radius: 8px;
        padding: 9px 12px;
        font-size: 13px;
        line-height: 1.45;
      }
      .pmk-alert-item--danger { background: #fef2f2; border-color: #dc2626; color: #7f1d1d; }
      .pmk-alert-item--warn { background: #fffbeb; border-color: #d97706; color: #78350f; }
      .pmk-alert-item--info { background: #f0f9ff; border-color: #0284c7; color: #0c4a6e; }
      .pmk-alert-item-head { display: flex; align-items: center; gap: 6px; font-weight: 700; flex-wrap: wrap; }
      .pmk-alert-item-detail { margin-top: 3px; font-size: 12.5px; }
      .pmk-alert-item-src { margin-top: 4px; font-size: 11px; opacity: 0.8; }
      .pmk-alert-tick-hint {
        font-size: 12px;
        color: #475569;
        margin: 0 0 8px;
      }
      .pmk-alert-tick {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        padding-top: 7px;
        border-top: 1px dashed rgba(15, 23, 42, 0.12);
        font-size: 12.5px;
        font-weight: 600;
        color: #1e293b;
        cursor: pointer;
        user-select: none;
      }
      .pmk-alert-tick-cb {
        width: 16px;
        height: 16px;
        accent-color: #4f46e5;
        cursor: pointer;
        flex-shrink: 0;
      }

      @media print {
        .pmk-top-alert, .pmk-clinic-panel { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function levelLabel(level) {
    if (level === 'danger') return 'วิกฤต';
    if (level === 'warn') return 'ระวัง';
    return 'แนะนำ';
  }

  function levelIcon(level) {
    if (level === 'danger') return 'fa-circle-exclamation';
    if (level === 'warn') return 'fa-triangle-exclamation';
    return 'fa-circle-info';
  }

  function ensureClinicPanels() {
    CLINICS.forEach(c => {
      const form = document.getElementById('form-' + c.id);
      if (!form) return;

      if (!document.getElementById('pmk-top-alert-' + c.id)) {
        const top = document.createElement('div');
        top.id = 'pmk-top-alert-' + c.id;
        top.className = 'pmk-top-alert hidden print:hidden';
        top.setAttribute('role', 'status');
        top.addEventListener('click', () => {
          const panel = document.getElementById('pmk-panel-' + c.id);
          if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        form.insertBefore(top, form.firstChild);
      }

      if (!document.getElementById('pmk-panel-' + c.id)) {
        const panel = document.createElement('div');
        panel.id = 'pmk-panel-' + c.id;
        panel.className = 'pmk-clinic-panel print:hidden';
        panel.dataset.pmkClinic = c.id;
        panel.innerHTML = `
          <div class="pmk-panel-head">
            <div class="pmk-panel-title">
              <i class="fa-solid fa-shield-heart text-indigo-600"></i>
              <span>แจ้งเตือนทางคลินิก (คำแนะนำ) — ${esc(c.label)}</span>
            </div>
            <div class="pmk-panel-counts" id="pmk-counts-${c.id}"></div>
          </div>
          <div class="pmk-alert-body" id="pmk-alerts-${c.id}" aria-live="polite"></div>
        `;
        form.appendChild(panel);
        panel.addEventListener('change', onAlertTickChange, true);
      }
    });
  }

  // Re-render only when the panel content changed. A blur ('change') on the field the user just
  // left re-renders the panel; rewriting identical HTML mid-click swapped the tick checkbox away
  // and the click on "ใส่ใน Pharmacist Note" was lost.
  function setBodyHtml(el, html) {
    if (el._pmkHtml === html && el.innerHTML) return;
    el.innerHTML = html;
    el._pmkHtml = html;
  }

  function renderClinic(clinic, opts) {
    if (!CLINIC_MAP[clinic]) return;
    ensureClinicPanels();
    const alerts = evaluateClinicAlerts(clinic);
    const countsEl = document.getElementById('pmk-counts-' + clinic);
    const bodyEl = document.getElementById('pmk-alerts-' + clinic);
    const topEl = document.getElementById('pmk-top-alert-' + clinic);
    const panelEl = document.getElementById('pmk-panel-' + clinic);

    const nDanger = alerts.filter(a => a.level === 'danger').length;
    const nWarn = alerts.filter(a => a.level === 'warn').length;
    const nInfo = alerts.filter(a => a.level === 'info').length;

    if (countsEl) {
      if (alerts.length === 0) {
        countsEl.innerHTML = `<span class="pmk-badge pmk-badge--ok"><i class="fa-solid fa-check"></i> ปกติ</span>`;
      } else {
        const badges = [];
        if (nDanger) badges.push(`<span class="pmk-badge pmk-badge--danger">วิกฤต ${nDanger}</span>`);
        if (nWarn) badges.push(`<span class="pmk-badge pmk-badge--warn">ระวัง ${nWarn}</span>`);
        if (nInfo) badges.push(`<span class="pmk-badge pmk-badge--info">แนะนำ ${nInfo}</span>`);
        countsEl.innerHTML = badges.join(' ');
      }
    }

    pruneMissingTicks(clinic, alerts);

    if (bodyEl) {
      if (alerts.length === 0) {
        setBodyHtml(bodyEl, `<div class="pmk-alert-ok"><i class="fa-solid fa-circle-check"></i><span>ยังไม่พบสัญญาณเตือนทางคลินิกจากข้อมูลที่กรอก (คำแนะนำประกอบการตัดสินใจเท่านั้น)</span></div>`);
      } else {
        const ticked = tickedByClinic[clinic] || new Set();
        setBodyHtml(bodyEl, `<p class="pmk-alert-tick-hint">ติ๊กข้อที่ต้องการให้ไปปรากฏท้าย Pharmacist Note (สำหรับลง PMK)</p>
        <div class="pmk-alert-list">${alerts.map(a => {
          const key = alertKey(a);
          const checked = ticked.has(key) ? ' checked' : '';
          return `
          <div class="pmk-alert-item pmk-alert-item--${esc(a.level)}">
            <div class="pmk-alert-item-head">
              <i class="fa-solid ${levelIcon(a.level)}"></i>
              <span class="pmk-badge pmk-badge--${esc(a.level)}">${levelLabel(a.level)}</span>
              <span>${esc(a.title)}</span>
            </div>
            <div class="pmk-alert-item-detail">${esc(a.detail)}</div>
            <div class="pmk-alert-item-src">แหล่งอ้างอิง: ${esc(a.source)}</div>
            <label class="pmk-alert-tick">
              <input type="checkbox" class="pmk-alert-tick-cb" data-pmk-clinic="${esc(clinic)}" data-pmk-alert-key="${encodeURIComponent(key)}"${checked}>
              ใส่ใน Pharmacist Note
            </label>
          </div>`;
        }).join('')}</div>`);
      }
    }

    if (topEl) {
      const important = alerts.filter(a => a.level === 'danger' || a.level === 'warn');
      if (important.length > 0) {
        const topItem = important.find(a => a.level === 'danger') || important[0];
        topEl.className = `pmk-top-alert pmk-top-alert--${topItem.level} print:hidden`;
        topEl.innerHTML = `
          <div class="pmk-top-alert-main">
            <i class="fa-solid ${levelIcon(topItem.level)}"></i>
            <strong>แจ้งเตือนทางคลินิก (${important.length} ข้อ):</strong>
            <span>${esc(topItem.title)}</span>
          </div>
          <span class="pmk-top-alert-cta">ดูรายละเอียด ↓</span>
        `;
      } else {
        topEl.className = 'pmk-top-alert hidden print:hidden';
        topEl.innerHTML = '';
      }
    }

    if (clinic === activeClinic()) applyAlertBlockToNote(clinic);

    if (opts && opts.fromSave && panelEl && (nDanger > 0 || nWarn > 0)) {
      panelEl.classList.remove('pmk-alert-pulse');
      void panelEl.offsetWidth;
      panelEl.classList.add('pmk-alert-pulse');
      setTimeout(() => panelEl.classList.remove('pmk-alert-pulse'), 2200);
    }
  }

  function activeClinic() {
    return typeof (typeof currentTab !== 'undefined' ? currentTab : 'MR') === 'string' ? (typeof currentTab !== 'undefined' ? currentTab : 'MR') : 'MR';
  }

  let debounceTimer = null;
  function scheduleRenderActive(immediate, opts) {
    if (immediate) {
      clearTimeout(debounceTimer);
      renderClinic(activeClinic(), opts);
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => renderClinic(activeClinic(), opts), 110);
  }

  function wrapFunction(name, afterFn) {
    const orig = window[name];
    if (typeof orig === 'function' && !orig._pmkAlertsWrapped) {
      const wrapped = function () {
        const res = orig.apply(this, arguments);
        try { afterFn(arguments); } catch (e) {}
        return res;
      };
      wrapped._pmkAlertsWrapped = true;
      window[name] = wrapped;
    }
  }

  function bindEvents() {
    ensureClinicPanels();
    CLINICS.forEach(c => renderClinic(c.id));

    const container = document.getElementById('mainAppContainer') || document;
    container.addEventListener('input', () => scheduleRenderActive(false), true);
    container.addEventListener('change', () => scheduleRenderActive(true), true);

    wrapFunction('switchTab', args => renderClinic(args[0] || activeClinic()));
    wrapFunction('switchWfTab', () => renderClinic('WARFARIN'));
    wrapFunction('generateOutput', () => {
      applyAlertBlockToNote(activeClinic());
      scheduleRenderActive(false);
    });
    wrapFunction('copyHfToPmkNote', () => {
      applyAlertBlockToNote('HF');
      renderClinic('HF');
    });
    wrapFunction('renderHfGdmtHelper', () => renderClinic('HF'));
    wrapFunction('capdEvaluateAll', () => renderClinic('CAPD'));
    wrapFunction('evaluateHivRenalAlert', () => renderClinic('HIV'));
    wrapFunction('evaluateCkdRenalAlerts', () => renderClinic('CKD'));
    wrapFunction('processResults', () => renderClinic('PREOP'));
    wrapFunction('resetForm', () => {
      clearAllTicks();
      setTimeout(() => {
        CLINICS.forEach(c => renderClinic(c.id));
        applyAlertBlockToNote(activeClinic());
      }, 20);
    });

    const btnSendDb = document.getElementById('btnSendDb');
    if (btnSendDb) {
      btnSendDb.addEventListener('click', () => renderClinic(activeClinic(), { fromSave: true }), true);
    }
    const btnCopySheet = document.getElementById('btnCopySheet');
    if (btnCopySheet) {
      btnCopySheet.addEventListener('click', () => renderClinic(activeClinic(), { fromSave: true }), true);
    }
    const wfForm = document.getElementById('warfarinForm');
    if (wfForm) {
      wfForm.addEventListener('submit', () => renderClinic('WARFARIN', { fromSave: true }), true);
    }
  }

  window.pmkEvaluateClinicAlerts = evaluateClinicAlerts;
  window.pmkRefreshAlerts = function (clinic) {
    renderClinic(clinic || activeClinic());
  };

  function init() {
    injectStyles();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
