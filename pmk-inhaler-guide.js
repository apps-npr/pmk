/* PMK Asthma/COPD — illustrated inhaler technique guides (same pattern for every device) */
(function () {
  const TEAL = '#0f766e';
  const TEAL2 = '#14b8a6';
  const SLATE = '#334155';
  const AMBER = '#d97706';
  const ROSE = '#e11d48';
  const SKY = '#0284c7';
  const PAPER = '#f0fdfa';

  function svg(vb, inner, cls) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" fill="none" class="' + (cls || '') + '" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  /* ---- shared step icons (48x48, one style) ---- */
  const ICONS = {
    cap: svg('0 0 48 48',
      '<rect x="18" y="6" width="12" height="10" rx="2" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<rect x="14" y="16" width="20" height="26" rx="4" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M18 10h12" stroke="' + TEAL2 + '" stroke-width="2" stroke-linecap="round"/>'),
    shake: svg('0 0 48 48',
      '<rect x="17" y="8" width="14" height="28" rx="4" transform="rotate(-18 24 22)" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M10 16c2-4 5-6 8-6M38 32c-2 4-5 6-8 6" stroke="' + AMBER + '" stroke-width="2" stroke-linecap="round"/>'),
    exhale: svg('0 0 48 48',
      '<circle cx="16" cy="22" r="8" fill="#fff" stroke="' + SLATE + '" stroke-width="2"/>' +
      '<path d="M24 22h4M30 18c4 2 6 4 10 4M30 26c4-2 6-4 10-4" stroke="' + SKY + '" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="14" cy="20" r="1.2" fill="' + SLATE + '"/><circle cx="18" cy="20" r="1.2" fill="' + SLATE + '"/>'),
    lips: svg('0 0 48 48',
      '<rect x="8" y="16" width="20" height="16" rx="8" fill="#fff" stroke="' + SLATE + '" stroke-width="2"/>' +
      '<rect x="24" y="18" width="16" height="12" rx="3" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>'),
    press: svg('0 0 48 48',
      '<rect x="18" y="14" width="12" height="24" rx="3" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M24 8v8" stroke="' + ROSE + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M20 12l4-4 4 4" stroke="' + ROSE + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    inhaleSlow: svg('0 0 48 48',
      '<path d="M8 30c6-12 12-16 16-16s10 4 16 16" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M24 16v-4M20 28h8" stroke="' + SKY + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M16 22h16" stroke="' + SKY + '" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>'),
    inhaleFast: svg('0 0 48 48',
      '<path d="M8 32c6-16 12-20 16-20s10 4 16 20" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M18 22l6-8 6 8" stroke="' + ROSE + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    hold: svg('0 0 48 48',
      '<circle cx="24" cy="24" r="14" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M24 14v10l6 4" stroke="' + AMBER + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="24" y="42" text-anchor="middle" font-size="7" fill="' + SLATE + '" font-family="Sarabun,sans-serif">10 วิ</text>'),
    relax: svg('0 0 48 48',
      '<circle cx="16" cy="22" r="8" fill="#fff" stroke="' + SLATE + '" stroke-width="2"/>' +
      '<path d="M24 24c4 2 8 2 14 0" stroke="' + SKY + '" stroke-width="2" stroke-linecap="round"/>'),
    rinse: svg('0 0 48 48',
      '<path d="M16 8h16v8c0 8-4 14-8 18-4-4-8-10-8-18V8z" fill="' + PAPER + '" stroke="' + SKY + '" stroke-width="2"/>' +
      '<path d="M20 36h8v6h-8z" fill="#fff" stroke="' + SKY + '" stroke-width="2"/>'),
    wait: svg('0 0 48 48',
      '<circle cx="24" cy="24" r="14" fill="#fff" stroke="' + AMBER + '" stroke-width="2"/>' +
      '<path d="M24 14v10h8" stroke="' + AMBER + '" stroke-width="2.2" stroke-linecap="round"/>'),
    click: svg('0 0 48 48',
      '<rect x="8" y="18" width="32" height="14" rx="4" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M16 25h16" stroke="' + TEAL2 + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M30 12l6 6-6 2" stroke="' + AMBER + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    lever: svg('0 0 48 48',
      '<rect x="8" y="16" width="28" height="16" rx="8" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M28 24h14M36 18l8 6-8 6" stroke="' + AMBER + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
    closeDev: svg('0 0 48 48',
      '<rect x="10" y="14" width="28" height="20" rx="6" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M16 24h16" stroke="' + SLATE + '" stroke-width="2" stroke-linecap="round"/>'),
    wipe: svg('0 0 48 48',
      '<rect x="12" y="18" width="24" height="16" rx="2" fill="#fff" stroke="' + SLATE + '" stroke-width="2"/>' +
      '<path d="M16 14c6-4 10-4 16 0" stroke="' + TEAL2 + '" stroke-width="2" stroke-linecap="round"/>'),
    capsule: svg('0 0 48 48',
      '<rect x="10" y="16" width="20" height="16" rx="3" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<ellipse cx="34" cy="24" rx="7" ry="5" fill="#fecaca" stroke="' + ROSE + '" stroke-width="2"/>' +
      '<path d="M26 24h2" stroke="' + AMBER + '" stroke-width="2" stroke-linecap="round"/>'),
    pierce: svg('0 0 48 48',
      '<rect x="14" y="18" width="20" height="16" rx="4" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M24 10v16" stroke="' + ROSE + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="24" cy="30" r="2" fill="' + ROSE + '"/>'),
    twice: svg('0 0 48 48',
      '<circle cx="16" cy="24" r="9" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<circle cx="32" cy="24" r="9" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<text x="16" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="' + TEAL + '" font-family="Sarabun,sans-serif">1</text>' +
      '<text x="32" y="28" text-anchor="middle" font-size="10" font-weight="700" fill="' + TEAL + '" font-family="Sarabun,sans-serif">2</text>'),
    turn: svg('0 0 48 48',
      '<circle cx="24" cy="24" r="12" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M24 12a12 12 0 0 1 10 18" stroke="' + AMBER + '" stroke-width="2.4" stroke-linecap="round" fill="none"/>' +
      '<path d="M30 32l6-1-1 6" stroke="' + AMBER + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    vent: svg('0 0 48 48',
      '<rect x="10" y="16" width="28" height="16" rx="5" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M10 20h-4M10 28h-4M38 20h4M38 28h4" stroke="' + SKY + '" stroke-width="2" stroke-linecap="round"/>'),
    noBlow: svg('0 0 48 48',
      '<rect x="8" y="16" width="22" height="16" rx="4" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M32 18c6 3 8 6 12 6M32 30c6-3 8-6 12-6" stroke="' + ROSE + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M34 14l12 20" stroke="' + ROSE + '" stroke-width="2.2" stroke-linecap="round"/>'),
    counter: svg('0 0 48 48',
      '<rect x="10" y="14" width="28" height="20" rx="3" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<text x="24" y="28" text-anchor="middle" font-size="11" font-weight="700" fill="' + TEAL + '" font-family="Sarabun,sans-serif">30</text>'),
    upright: svg('0 0 48 48',
      '<rect x="18" y="8" width="12" height="28" rx="4" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<path d="M24 40v-4M20 40h8" stroke="' + SLATE + '" stroke-width="2" stroke-linecap="round"/>'),
    discard: svg('0 0 48 48',
      '<path d="M16 16h16l-1.5 20h-13L16 16z" fill="#fff" stroke="' + SLATE + '" stroke-width="2"/>' +
      '<path d="M14 16h20M20 16v-4h8v4" stroke="' + SLATE + '" stroke-width="2" stroke-linecap="round"/>'),
    wash: svg('0 0 48 48',
      '<rect x="12" y="20" width="24" height="16" rx="3" fill="#fff" stroke="' + SKY + '" stroke-width="2"/>' +
      '<path d="M18 20V14h12v6M20 10c2 4 6 4 8 0" stroke="' + SKY + '" stroke-width="2" stroke-linecap="round"/>'),
    spacer: svg('0 0 48 48',
      '<rect x="6" y="18" width="12" height="12" rx="2" fill="#fff" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<rect x="18" y="14" width="22" height="20" rx="8" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>')
  };

  /* ---- hero device illustrations (120x90), distinct silhouettes, same line style ---- */
  const HERO = {
    mdi: svg('0 0 160 120',
      '<rect x="70" y="8" width="28" height="54" rx="6" fill="#e2e8f0" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="62" y="56" width="44" height="28" rx="6" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="74" y="80" width="20" height="22" rx="4" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2.2"/>' +
      '<path d="M76 20h16M76 30h16" stroke="' + TEAL2 + '" stroke-width="1.8" stroke-linecap="round"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">MDI</text>'),
    accuhaler: svg('0 0 160 120',
      '<path d="M28 40h86c8 0 16 10 16 22s-8 22-16 22H40c-10 0-18-8-18-20s8-24 22-24z" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="96" y="46" width="22" height="32" rx="8" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<circle cx="48" cy="62" r="8" fill="#fff" stroke="' + TEAL2 + '" stroke-width="2"/>' +
      '<text x="48" y="66" text-anchor="middle" font-size="8" fill="' + TEAL + '" font-family="Sarabun,sans-serif">30</text>' +
      '<path d="M28 86c16 10 70 12 102-4" stroke="' + TEAL2 + '" stroke-width="2" stroke-linecap="round"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">Accuhaler</text>'),
    handihaler: svg('0 0 160 120',
      '<path d="M58 22h44v16H58z" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2.2"/>' +
      '<rect x="50" y="36" width="60" height="50" rx="14" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<circle cx="80" cy="58" r="12" fill="#fecaca" stroke="' + ROSE + '" stroke-width="2"/>' +
      '<rect x="112" y="50" width="14" height="22" rx="4" fill="#16a34a" stroke="' + TEAL + '" stroke-width="1.8"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">HandiHaler</text>'),
    spiromax: svg('0 0 160 120',
      '<path d="M58 10h44c6 0 10 6 10 12v26H48V22c0-6 4-12 10-12z" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2.2"/>' +
      '<rect x="48" y="46" width="64" height="52" rx="8" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="66" y="78" width="28" height="16" rx="4" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">Spiromax</text>'),
    rapihaler: svg('0 0 160 120',
      '<rect x="70" y="8" width="28" height="54" rx="6" fill="#e0f2fe" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="62" y="56" width="44" height="28" rx="6" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="74" y="80" width="20" height="22" rx="4" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2.2"/>' +
      '<circle cx="84" cy="28" r="4" fill="' + TEAL2 + '"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">Rapihaler</text>'),
    respimat: svg('0 0 160 120',
      '<rect x="68" y="6" width="24" height="18" rx="4" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2.2"/>' +
      '<rect x="64" y="22" width="32" height="50" rx="6" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="70" y="34" width="20" height="24" rx="2" fill="#e0f2fe" stroke="' + SKY + '" stroke-width="1.6"/>' +
      '<rect x="60" y="70" width="40" height="22" rx="10" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2.2"/>' +
      '<path d="M80 80a12 8 0 1 1 10 0" stroke="' + AMBER + '" stroke-width="1.8" fill="none"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">Respimat</text>'),
    ellipta: svg('0 0 160 120',
      '<path d="M24 44c0-14 14-24 36-24h40c22 0 36 10 36 24v20c0 14-14 22-36 22H60c-22 0-36-8-36-22V44z" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<path d="M80 22v64" stroke="' + TEAL2 + '" stroke-width="1.8" stroke-dasharray="3 3"/>' +
      '<rect x="88" y="48" width="36" height="16" rx="4" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="1.8"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">Ellipta</text>'),
    aerosphere: svg('0 0 160 120',
      '<rect x="70" y="6" width="28" height="56" rx="10" fill="#e2e8f0" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="62" y="56" width="44" height="28" rx="8" fill="#fff" stroke="' + TEAL + '" stroke-width="2.4"/>' +
      '<rect x="74" y="80" width="20" height="22" rx="5" fill="' + PAPER + '" stroke="' + TEAL + '" stroke-width="2.2"/>' +
      '<circle cx="84" cy="30" r="6" fill="none" stroke="' + TEAL2 + '" stroke-width="1.8"/>' +
      '<text x="80" y="116" text-anchor="middle" font-size="11" fill="' + SLATE + '" font-family="Sarabun,sans-serif">Aerosphere</text>')
  };

  const GUIDES = {
    mdi: {
      id: 'mdi',
      title: 'MDI (Metered Dose Inhaler)',
      kind: 'ยาพ่นชนิดละอองฝอย (pMDI)',
      breath: 'สูดช้าๆ ลึกๆ พร้อมกดยา',
      examples: 'เช่น Ventolin, Berodual, Seretide EVO, Budesonide, Fluticasone',
      warnings: [
        { icon: 'shake', text: 'เขย่าขวดยาก่อนพ่นทุกครั้ง' },
        { icon: 'inhaleSlow', text: 'สูดช้าๆ ลึกๆ ไม่ใช่สูดแรงๆ' },
        { icon: 'hold', text: 'กลั้นหายใจประมาณ 10 วินาที' },
        { icon: 'rinse', text: 'ถ้ามียาสเตียรอยด์ ต้องกลั้วปากและบ้วนทิ้ง' }
      ],
      steps: [
        { icon: 'shake', title: 'เปิดฝาและเขย่า', text: 'ถือกระบอกในแนวตั้ง เปิดฝาครอบออก แล้วเขย่าขวดยา 3–4 ครั้ง' },
        { icon: 'exhale', title: 'หายใจออกให้เต็มที่', text: 'พ่นลมหายใจออกให้สุด ห่างจากปากกระบอก' },
        { icon: 'lips', title: 'อมปากกระบอกให้สนิท', text: 'ริมฝีปากอมรอบปากกระบอกให้แนบ ไม่ให้ยาเล็ดลอด' },
        { icon: 'press', title: 'กดพ่นพร้อมสูดช้าๆ', text: 'เริ่มสูดช้าๆ ลึกๆ ทางปาก พร้อมกดพ่นยา 1 ครั้ง' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'เอาเครื่องออก หุบปาก กลั้นหายใจให้นานที่สุดอย่างน้อย 10 วินาที' },
        { icon: 'relax', title: 'ผ่อนลมหายใจออกช้าๆ', text: 'ผ่อนลมหายใจออกทางจมูกหรือปากช้าๆ' },
        { icon: 'wait', title: 'ถ้าพ่น 2 ครั้ง ให้เว้นไว้', text: 'เว้น 1–2 นาที แล้วเขย่าและพ่นซ้ำตามขนาดที่แพทย์สั่ง' },
        { icon: 'rinse', title: 'กลั้วปากถ้าเป็นยาสเตียรอยด์', text: 'กลั้วในปากและคอด้วยน้ำสะอาด แล้วบ้วนทิ้ง เพื่อลดเชื้อราในปากและเสียงแหบ' },
        { icon: 'wash', title: 'ล้างกระบอกพลาสติก', text: 'ถอดขวดยาออก ล้างกระบอกด้วยน้ำสะอาด ผึ่งให้แห้งในที่ร่ม แล้วประกอบกลับ' }
      ],
      extras: [
        { title: 'ถ้าใช้ร่วมกับกระบอกช่วยพ่น (Spacer)', icon: 'spacer', text: 'เขย่าแล้วพ่นยา 1 ครั้งเข้ากระบอกช่วยพ่น จากนั้นสูดช้าๆ ลึกๆ จากกระบอก หรือหายใจเข้า-ออกช้าๆ ผ่านกระบอก 4–6 ครั้ง เหมาะในเด็กหรือผู้ที่กดกับสูดไม่สัมพันธ์กัน' }
      ]
    },
    accuhaler: {
      id: 'accuhaler',
      title: 'Accuhaler',
      kind: 'ยาพ่นชนิดผง (DPI)',
      breath: 'สูดเร็ว แรง และลึก',
      examples: 'เช่น Seretide Accuhaler',
      warnings: [
        { icon: 'noBlow', text: 'ห้ามเป่าลมหายใจเข้าไปในเครื่อง' },
        { icon: 'inhaleFast', text: 'สูดเร็ว แรง และลึก' },
        { icon: 'hold', text: 'กลั้นหายใจประมาณ 10 วินาที' },
        { icon: 'rinse', text: 'ยาที่มีสเตียรอยด์ ต้องกลั้วปากและบ้วนทิ้ง' }
      ],
      steps: [
        { icon: 'upright', title: 'วางเครื่องแนวราบ', text: 'ไม่เขย่า ไม่พลิกไปมา ใช้นิ้วหัวแม่มือดันฝาเปิดจนสุด' },
        { icon: 'lever', title: 'ดันแกนเลื่อนจนคลิก', text: 'ดันแกนเลื่อนด้านในไปจนสุดจนได้ยินเสียงคลิก เพื่อบรรจุยา 1 โดส' },
        { icon: 'noBlow', title: 'หายใจออก ห่างจากเครื่อง', text: 'หายใจออกให้เต็มที่ ห้ามเป่าลมเข้าไปในเครื่อง' },
        { icon: 'inhaleFast', title: 'อมปากแล้วสูดเร็ว แรง ลึก', text: 'อมปากกระบอกให้สนิท สูดลมหายใจเข้าทางปากให้เร็ว แรง และลึก' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'กลั้นหายใจประมาณ 10 วินาที แล้วผ่อนลมหายใจออกช้าๆ ทางจมูกหรือปาก' },
        { icon: 'closeDev', title: 'ปิดเครื่องจนคลิก', text: 'ใช้นิ้วหัวแม่มือดันฝากลับจนได้ยินเสียงคลิก ไม่ต้องดันแกนเลื่อนกลับ' },
        { icon: 'wait', title: 'ถ้าพ่น 2 ครั้ง', text: 'ต้องเปิดและเลื่อนแกนใหม่ทุกครั้ง และเว้น 1–2 นาที' },
        { icon: 'rinse', title: 'กลั้วปากหลังยาสเตียรอยด์', text: 'กลั้วในปากและคอด้วยน้ำสะอาด แล้วบ้วนทิ้ง' },
        { icon: 'wipe', title: 'เช็ดปากกระบอกและดูโดส', text: 'เช็ดปากกระบอกด้วยกระดาษหรือผ้าแห้ง และดูหน้าต่างนับโดสที่เหลือ' }
      ]
    },
    handihaler: {
      id: 'handihaler',
      title: 'HandiHaler',
      kind: 'ยาพ่นชนิดผงใช้กับแคปซูล (DPI)',
      breath: 'สูดเร็ว แรง และลึก จนได้ยินแคปซูลหมุน',
      examples: 'เช่น Spiriva 18 mcg',
      warnings: [
        { icon: 'pierce', text: 'กดเจาะแคปซูลเพียงครั้งเดียว' },
        { icon: 'twice', text: 'ต้องสูดจากแคปซูลเดิม 2 ครั้ง เพื่อให้ยาหมด' },
        { icon: 'noBlow', text: 'ห้ามเป่าลมหายใจเข้าไปในเครื่อง' },
        { icon: 'capsule', text: 'แกะแคปซูลจากแผงเมื่อจะใช้ทันที' }
      ],
      steps: [
        { icon: 'cap', title: 'เปิดฝาและปากกระบอก', text: 'ดึงฝาครอบขึ้น แล้วเปิดปากกระบอก' },
        { icon: 'capsule', title: 'ใส่แคปซูลยา', text: 'แกะแคปซูลจากแผงเมื่อจะใช้ทันที ใส่ลงในช่องใส่ยา อย่าแกะทิ้งไว้ล่วงหน้า' },
        { icon: 'click', title: 'ปิดปากกระบอกจนคลิก', text: 'ปิดปากกระบอกให้ได้ยินเสียงคลิก (เปิดฝาครอบค้างไว้)' },
        { icon: 'pierce', title: 'เจาะแคปซูลครั้งเดียว', text: 'ตั้งเครื่องขึ้น กดปุ่มด้านข้างเพื่อเจาะยาเพียงครั้งเดียว' },
        { icon: 'noBlow', title: 'หายใจออก ห่างจากเครื่อง', text: 'หายใจออกให้เต็มที่ ห้ามเป่าลมเข้าไปในปากกระบอก' },
        { icon: 'inhaleFast', title: 'สูดครั้งที่ 1 ให้เร็ว แรง ลึก', text: 'อมปากกระบอก สูดเร็ว แรง และลึกจนได้ยินแคปซูลหมุน' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'กลั้นหายใจประมาณ 10 วินาที แล้วผ่อนลมหายใจออกช้าๆ' },
        { icon: 'twice', title: 'สูดครั้งที่ 2 จากแคปซูลเดิม', text: 'หายใจออกห่างเครื่อง แล้วสูดซ้ำอีกครั้งจากแคปซูลเดิม เพื่อให้ผงยาหมด' },
        { icon: 'discard', title: 'เทแคปซูลทิ้ง แล้วปิดฝา', text: 'เปิดปากกระบอก เทแคปซูลใช้แล้วทิ้ง ปิดปากกระบอกและฝาให้สนิท' },
        { icon: 'wipe', title: 'เช็ดให้แห้ง', text: 'เช็ดปากกระบอกด้วยกระดาษแห้ง อย่าล้างน้ำในช่องใส่ยา' }
      ]
    },
    spiromax: {
      id: 'spiromax',
      title: 'Spiromax',
      kind: 'ยาพ่นชนิดผง (DPI)',
      breath: 'สูดเร็ว แรง และลึก',
      examples: 'เช่น Duoresp Spiromax',
      warnings: [
        { icon: 'upright', text: 'ถือเครื่องในแนวตั้ง และไม่ต้องเขย่า' },
        { icon: 'noBlow', text: 'ห้ามเป่าลมหายใจเข้าไปในเครื่อง' },
        { icon: 'hold', text: 'กลั้นหายใจประมาณ 10 วินาที' },
        { icon: 'rinse', text: 'ยาที่มีสเตียรอยด์ ต้องกลั้วปากและบ้วนทิ้ง' }
      ],
      steps: [
        { icon: 'upright', title: 'ถือในแนวตั้ง ไม่เขย่า', text: 'ถือเครื่องในแนวตั้ง โดยให้ปากกระบอกอยู่ด้านล่าง ไม่ต้องเขย่า' },
        { icon: 'click', title: 'เปิดฝาจนคลิก', text: 'เปิดฝาจนสุดจนได้ยินเสียงคลิก เครื่องจะบรรจุยาให้อัตโนมัติ' },
        { icon: 'noBlow', title: 'หายใจออก ห่างจากเครื่อง', text: 'หายใจออกให้เต็มที่ ห้ามเป่าลมเข้าไปในปากกระบอก' },
        { icon: 'inhaleFast', title: 'อมปากแล้วสูดเร็ว แรง ลึก', text: 'อมปากกระบอก สูดลมหายใจเข้าทางปากให้เร็ว แรง และลึก' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'เอาเครื่องออก หุบปาก กลั้นหายใจประมาณ 10 วินาที แล้วผ่อนลมหายใจออกช้าๆ' },
        { icon: 'wipe', title: 'เช็ดแล้วปิดฝา', text: 'เช็ดปากกระบอกด้วยกระดาษแห้ง แล้วปิดฝาให้สนิท' },
        { icon: 'rinse', title: 'กลั้วปากหลังยาสเตียรอยด์', text: 'กลั้วในปากและคอด้วยน้ำสะอาด แล้วบ้วนทิ้ง' },
        { icon: 'wait', title: 'ถ้าพ่น 2 ครั้ง', text: 'ปิดฝาแล้วเปิดใหม่ทุกครั้ง และเว้น 1–2 นาที' }
      ]
    },
    rapihaler: {
      id: 'rapihaler',
      title: 'Rapihaler',
      kind: 'ยาพ่นชนิดละอองฝอย (pMDI)',
      breath: 'สูดช้าๆ ลึกๆ พร้อมกดยา',
      examples: 'เช่น Symbicort Rapihaler',
      warnings: [
        { icon: 'shake', text: 'เขย่าขวดยาก่อนพ่นทุกครั้ง' },
        { icon: 'inhaleSlow', text: 'สูดช้าๆ ลึกๆ ไม่ใช่สูดแรงๆ' },
        { icon: 'wipe', text: 'เช็ดปากกระบอกด้วยผ้าแห้ง ห้ามล้างน้ำ' },
        { icon: 'rinse', text: 'มียาสเตียรอยด์ ต้องกลั้วปากและบ้วนทิ้ง' }
      ],
      steps: [
        { icon: 'shake', title: 'เปิดฝาและเขย่า', text: 'ถือกระบอกในแนวตั้ง เปิดฝาครอบออก แล้วเขย่าขวดยา 3–4 ครั้ง' },
        { icon: 'exhale', title: 'หายใจออกให้เต็มที่', text: 'พ่นลมหายใจออกให้สุด ห่างจากปากกระบอก' },
        { icon: 'lips', title: 'อมปากกระบอกให้สนิท', text: 'ริมฝีปากอมรอบปากกระบอกให้แนบสนิท' },
        { icon: 'press', title: 'กดพ่นพร้อมสูดช้าๆ', text: 'เริ่มสูดช้าๆ ลึกๆ ทางปาก พร้อมกดพ่นยา 1 ครั้ง' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'เอาเครื่องออก หุบปาก กลั้นหายใจให้นานที่สุดอย่างน้อย 10 วินาที' },
        { icon: 'relax', title: 'ผ่อนลมหายใจออกช้าๆ', text: 'ผ่อนลมหายใจออกทางจมูกหรือปากช้าๆ' },
        { icon: 'rinse', title: 'กลั้วปากหลังพ่น', text: 'กลั้วในปากและคอด้วยน้ำสะอาด แล้วบ้วนทิ้ง เพราะมียาสเตียรอยด์' },
        { icon: 'wipe', title: 'เช็ดด้วยผ้าแห้ง ห้ามล้างน้ำ', text: 'เช็ดปากกระบอกด้วยผ้าหรือกระดาษทิชชู่แห้ง ห้ามล้างน้ำ' },
        { icon: 'wait', title: 'ถ้าพ่น 2 ครั้ง ให้เว้นไว้', text: 'เว้น 1–2 นาที แล้วเขย่าและพ่นซ้ำตามขนาดที่แพทย์สั่ง' }
      ]
    },
    respimat: {
      id: 'respimat',
      title: 'Respimat',
      kind: 'ยาพ่นชนิดละอองฝอยช้า (Soft Mist)',
      breath: 'สูดช้าๆ ลึกๆ ตามละอองยา',
      examples: 'เช่น Spiolto Respimat',
      warnings: [
        { icon: 'turn', text: 'ใช้หลัก หมุน–เปิด–กด (Turn-Open-Press)' },
        { icon: 'vent', text: 'อย่าให้ริมฝีปากปิดช่องระบายอากาศ' },
        { icon: 'inhaleSlow', text: 'สูดช้าๆ ลึกๆ ตามละอองยา' },
        { icon: 'hold', text: 'กลั้นหายใจประมาณ 10 วินาที' }
      ],
      steps: [
        { icon: 'turn', title: 'หมุนฐานจนคลิก (Turn)', text: 'หมุนฐานใสตามลูกศรจนสุดจนได้ยินเสียงคลิก เพื่อบรรจุยา 1 โดส' },
        { icon: 'cap', title: 'เปิดฝาครอบ (Open)', text: 'เปิดฝาครอบปากกระบอกขึ้น' },
        { icon: 'exhale', title: 'หายใจออกให้เต็มที่', text: 'หายใจออกให้สุด ห่างจากเครื่อง' },
        { icon: 'vent', title: 'อมปากโดยไม่ปิดช่องลม', text: 'อมปากกระบอกให้สนิท แต่ไม่ให้ริมฝีปากปิดช่องระบายอากาศด้านข้าง' },
        { icon: 'press', title: 'กดพ่นพร้อมสูดช้าๆ (Press)', text: 'กดปุ่มพ่นยา พร้อมสูดช้าๆ ลึกๆ ตามละอองยา' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'เอาเครื่องออก หุบปาก กลั้นหายใจประมาณ 10 วินาที แล้วผ่อนลมหายใจออกช้าๆ' },
        { icon: 'wait', title: 'ถ้าพ่น 2 ครั้ง แล้วปิดฝา', text: 'หมุนฐานใหม่ทุกครั้ง และเว้น 1–2 นาที จากนั้นปิดฝาให้สนิท เช็ดปากกระบอกด้วยกระดาษแห้ง' }
      ],
      extras: [
        { title: 'ครั้งแรกที่ใส่ตัวยาใหม่', icon: 'press', text: 'ต้องพ่นไล่อากาศ (prime) ตามฉลากยาจนเห็นละอองยาออกมาสม่ำเสมอ ก่อนใช้จริงกับคนไข้' }
      ]
    },
    ellipta: {
      id: 'ellipta',
      title: 'Ellipta',
      kind: 'ยาพ่นชนิดผง (DPI)',
      breath: 'สูดเร็ว แรง และลึกจนสุด',
      examples: 'เช่น Anoro Ellipta',
      warnings: [
        { icon: 'click', text: 'เปิดฝาจนคลิกเพียงครั้งเดียวต่อโดส อย่าเปิด-ปิดเล่น' },
        { icon: 'noBlow', text: 'ห้ามเป่าลมหายใจเข้าไปในเครื่อง' },
        { icon: 'vent', text: 'อย่าให้ริมฝีปากปิดช่องระบายอากาศ' },
        { icon: 'counter', text: 'ดูหน้าต่างนับโดสหลังปิดฝา' }
      ],
      steps: [
        { icon: 'click', title: 'เปิดฝาจนคลิก', text: 'เปิดฝาครอบลงจนสุดจนได้ยินเสียงคลิก เครื่องจะบรรจุยา 1 โดส (อย่าเปิด-ปิดโดยไม่พ่น เพราะยาจะเสียโดส)' },
        { icon: 'noBlow', title: 'หายใจออก ห่างจากเครื่อง', text: 'หายใจออกให้เต็มที่ ห้ามเป่าลมเข้าไปในเครื่อง' },
        { icon: 'vent', title: 'อมปากโดยไม่ปิดช่องลม', text: 'อมปากกระบอกให้สนิท โดยไม่ปิดช่องระบายอากาศ' },
        { icon: 'inhaleFast', title: 'สูดเร็ว แรง และลึกจนสุด', text: 'สูดยาเข้าปอดโดยหายใจเข้าเร็ว แรง ลึกจนสุด' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'เอาเครื่องออก หุบปาก กลั้นหายใจประมาณ 10 วินาที แล้วผ่อนลมหายใจออกช้าๆ' },
        { icon: 'closeDev', title: 'ปิดฝา เช็ด และดูโดส', text: 'ปิดฝาให้สนิท เช็ดปากกระบอกด้วยผ้าแห้ง และดูหน้าต่างนับโดส' }
      ],
      extras: [
        { title: 'เรื่องการกลั้วปาก', icon: 'rinse', text: 'Anoro ไม่มีสเตียรอยด์ จึงไม่บังคับกลั้วปาก แต่ถ้าใช้ Ellipta ที่มีสเตียรอยด์ (เช่น Relvar, Trelegy) ให้กลั้วปากและบ้วนทิ้งทุกครั้ง' }
      ]
    },
    aerosphere: {
      id: 'aerosphere',
      title: 'Aerosphere',
      kind: 'ยาพ่นชนิดละอองฝอย (pMDI)',
      breath: 'สูดช้าๆ ลึกๆ พร้อมกดยา',
      examples: 'เช่น Breztri Aerosphere',
      warnings: [
        { icon: 'shake', text: 'เขย่าขวดยาก่อนพ่นทุกครั้ง' },
        { icon: 'inhaleSlow', text: 'สูดช้าๆ ลึกๆ ไม่ใช่สูดแรงๆ' },
        { icon: 'rinse', text: 'มียาสเตียรอยด์ ต้องกลั้วปากและบ้วนทิ้ง' },
        { icon: 'wash', text: 'ล้างกระบอกพลาสติกสัปดาห์ละ 1 ครั้ง ผึ่งให้แห้งสนิท' }
      ],
      steps: [
        { icon: 'shake', title: 'เปิดฝาและเขย่า', text: 'ถือกระบอกในแนวตั้ง เปิดฝาครอบออก แล้วเขย่าขวดยา 3–4 ครั้ง' },
        { icon: 'exhale', title: 'หายใจออกให้เต็มที่', text: 'พ่นลมหายใจออกให้สุด ห่างจากปากกระบอก' },
        { icon: 'lips', title: 'อมปากกระบอกให้สนิท', text: 'ริมฝีปากอมรอบปากกระบอกให้แนบสนิท' },
        { icon: 'press', title: 'กดพ่นพร้อมสูดช้าๆ', text: 'เริ่มสูดช้าๆ ลึกๆ ทางปาก พร้อมกดพ่นยา 1 ครั้ง' },
        { icon: 'hold', title: 'กลั้นหายใจ ~10 วินาที', text: 'เอาเครื่องออก หุบปาก กลั้นหายใจให้นานที่สุดอย่างน้อย 10 วินาที' },
        { icon: 'relax', title: 'ผ่อนลมหายใจออกช้าๆ', text: 'ผ่อนลมหายใจออกทางจมูกหรือปากช้าๆ' },
        { icon: 'rinse', title: 'กลั้วปากหลังพ่น', text: 'กลั้วในปากและคอด้วยน้ำสะอาด แล้วบ้วนทิ้ง เพราะมียาสเตียรอยด์' },
        { icon: 'wait', title: 'ถ้าพ่น 2 ครั้ง ให้เว้นไว้', text: 'เว้น 1–2 นาที แล้วเขย่าและพ่นซ้ำตามขนาดที่แพทย์สั่ง' },
        { icon: 'wash', title: 'ล้างกระบอกสัปดาห์ละครั้ง', text: 'ถอดขวดยาออก ล้างกระบอกพลาสติกสัปดาห์ละ 1 ครั้ง ผึ่งให้แห้งสนิทก่อนประกอบกลับ' }
      ]
    }
  };

  const DEVICE_ORDER = ['mdi', 'accuhaler', 'handihaler', 'spiromax', 'rapihaler', 'respimat', 'ellipta', 'aerosphere'];

  function ensureDom() {
    if (document.getElementById('inhalerGuideModal')) return;
    const modal = document.createElement('div');
    modal.id = 'inhalerGuideModal';
    modal.className = 'fixed inset-0 z-[9999] hidden items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'inhalerGuideTitle');
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden border border-slate-100 flex flex-col">
        <div class="bg-teal-700 text-white px-4 sm:px-5 py-3 flex items-start justify-between gap-3 shrink-0">
          <div class="flex items-center gap-3 min-w-0">
            <div id="inhalerGuideHero" class="ig-header-hero shrink-0 bg-white/95 rounded-xl p-1"></div>
            <div class="min-w-0">
              <h3 id="inhalerGuideTitle" class="text-lg font-bold leading-tight"></h3>
              <p id="inhalerGuideKind" class="text-xs text-teal-100 mt-0.5"></p>
              <p id="inhalerGuideExamples" class="text-[11px] text-teal-50/90 mt-0.5 truncate"></p>
            </div>
          </div>
          <button type="button" id="inhalerGuideCloseX" class="w-9 h-9 rounded-full hover:bg-white/15 text-xl leading-none shrink-0" aria-label="ปิด">×</button>
        </div>
        <div id="inhalerGuideBody" class="overflow-y-auto px-4 sm:px-5 py-4 space-y-4 bg-slate-50"></div>
        <div class="bg-white border-t border-slate-100 px-4 sm:px-5 py-3 flex flex-wrap gap-2 justify-end shrink-0">
          <button type="button" id="inhalerGuidePrintBtn" class="bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-sm">
            <i class="fa-solid fa-print mr-1.5"></i>พิมพ์ใบ A5
          </button>
          <button type="button" id="inhalerGuideCloseBtn" class="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-sm px-4 py-2 rounded-xl">ปิด</button>
        </div>
      </div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeInhalerTechniqueGuide(); });
    document.body.appendChild(modal);

    const printArea = document.createElement('div');
    printArea.id = 'printInhalerGuideA5';
    printArea.className = 'hidden w-full max-w-[148mm] mx-auto bg-white text-gray-900';
    document.body.appendChild(printArea);

    const style = document.createElement('style');
    style.id = 'pmkInhalerGuideStyles';
    style.textContent = `
      @page inhalerGuidePageA5 { size: A5 portrait; margin: 5mm; }
      .ig-icon svg { width: 40px; height: 40px; display: block; }
      .ig-hero svg, .ig-header-hero svg, .ig-intro-hero svg { width: 100%; height: auto; display: block; }
      #inhalerGuideHero.ig-header-hero { display: block; width: 7.5rem; flex-shrink: 0; }
      .ig-intro-hero { width: 8.5rem; flex-shrink: 0; }
      @media (max-width: 639px) {
        #inhalerGuideHero.ig-header-hero { display: none; }
        .ig-intro-hero { width: 7rem; margin: 0 auto; }
      }
      #inhalerGuideModal .ig-step { break-inside: avoid; }
      @media print {
        body.print-mode-inhaler-guide { background: white !important; }
        body.print-mode-inhaler-guide #mainAppContainer,
        body.print-mode-inhaler-guide #pmkAppLogin,
        body.print-mode-inhaler-guide #pmkChrome,
        body.print-mode-inhaler-guide #inhalerGuideModal { display: none !important; }
        body.print-mode-inhaler-guide #printInhalerGuideA5,
        body.print-mode-inhaler-guide #printInhalerGuideA5 * { visibility: visible !important; }
        body.print-mode-inhaler-guide #printInhalerGuideA5 {
          position: absolute; left: 0; top: 0; width: 148mm;
          display: block !important; background: white !important;
          padding: 5mm; box-sizing: border-box;
          -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          font-family: 'Sarabun', 'Prompt', sans-serif;
        }
      }
    `;
    document.head.appendChild(style);

    document.getElementById('inhalerGuideCloseX').onclick = closeInhalerTechniqueGuide;
    document.getElementById('inhalerGuideCloseBtn').onclick = closeInhalerTechniqueGuide;
    document.getElementById('inhalerGuidePrintBtn').onclick = function () {
      const id = document.getElementById('inhalerGuideModal').dataset.deviceId;
      if (id) printInhalerTechniqueA5(id);
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !document.getElementById('inhalerGuideModal').classList.contains('hidden')) {
        closeInhalerTechniqueGuide();
      }
    });
  }

  function warningChips(list) {
    return '<div class="flex flex-wrap gap-2" data-ig-warnings="1">' + list.map(function (w) {
      return '<div class="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl px-2.5 py-1.5 text-xs font-medium">' +
        '<span class="ig-icon shrink-0 w-8 h-8">' + (ICONS[w.icon] || '') + '</span>' +
        '<span>' + w.text + '</span></div>';
    }).join('') + '</div>';
  }

  function stepCards(steps) {
    return '<ol class="grid grid-cols-1 sm:grid-cols-2 gap-2.5" data-ig-steps="1">' + steps.map(function (st, i) {
      return '<li class="ig-step bg-white border border-slate-200 rounded-xl p-3 flex gap-3 shadow-sm">' +
        '<div class="shrink-0 flex flex-col items-center gap-1">' +
          '<span class="w-7 h-7 rounded-full bg-teal-700 text-white text-sm font-bold flex items-center justify-center">' + (i + 1) + '</span>' +
          '<span class="ig-icon w-10 h-10">' + (ICONS[st.icon] || '') + '</span>' +
        '</div>' +
        '<div class="min-w-0">' +
          '<div class="font-bold text-slate-800 text-sm leading-snug">' + st.title + '</div>' +
          '<div class="text-xs text-slate-600 mt-0.5 leading-relaxed">' + st.text + '</div>' +
        '</div></li>';
    }).join('') + '</ol>';
  }

  function extrasBlock(extras) {
    if (!extras || !extras.length) return '';
    return extras.map(function (ex) {
      return '<div class="bg-sky-50 border border-sky-200 rounded-xl p-3 flex gap-3" data-ig-extra="1">' +
        '<span class="ig-icon w-10 h-10 shrink-0">' + (ICONS[ex.icon] || '') + '</span>' +
        '<div><div class="font-bold text-sky-900 text-sm">' + ex.title + '</div>' +
        '<div class="text-xs text-sky-950/80 mt-0.5 leading-relaxed">' + ex.text + '</div></div></div>';
    }).join('');
  }

  function renderGuideBody(g) {
    return '<div class="ig-intro flex flex-wrap items-center gap-3 bg-white border border-teal-100 rounded-xl px-3 py-2">' +
        '<div class="ig-hero ig-intro-hero">' + (HERO[g.id] || '') + '</div>' +
        '<div class="min-w-0 flex-1 text-sm text-teal-900 font-semibold">วิธีสูด: ' + g.breath + '</div>' +
      '</div>' +
      warningChips(g.warnings) +
      stepCards(g.steps) +
      extrasBlock(g.extras);
  }

  function openInhalerTechniqueGuide(deviceId) {
    ensureDom();
    const g = GUIDES[deviceId];
    const modal = document.getElementById('inhalerGuideModal');
    if (!g || !modal) {
      if (typeof pmkAlert === 'function') pmkAlert('ยังไม่มีคู่มือเทคนิคพ่นยาสำหรับอุปกรณ์นี้ครับ');
      return;
    }
    modal.dataset.deviceId = deviceId;
    document.getElementById('inhalerGuideTitle').textContent = g.title;
    document.getElementById('inhalerGuideKind').textContent = g.kind;
    document.getElementById('inhalerGuideExamples').textContent = g.examples || '';
    const hero = document.getElementById('inhalerGuideHero');
    hero.innerHTML = '<div class="ig-hero">' + (HERO[g.id] || '') + '</div>';
    document.getElementById('inhalerGuideBody').innerHTML = renderGuideBody(g);
    document.getElementById('inhalerGuideBody').scrollTop = 0;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('inhalerGuideCloseBtn').focus();
  }

  function closeInhalerTechniqueGuide() {
    const modal = document.getElementById('inhalerGuideModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  function todayThai() {
    const d = new Date();
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() + 543);
  }

  function printInhalerTechniqueA5(deviceId) {
    ensureDom();
    const g = GUIDES[deviceId];
    const area = document.getElementById('printInhalerGuideA5');
    if (!g || !area) return;
    const name = (document.getElementById('ptName') || {}).value || '-';
    const hn = (document.getElementById('hn') || {}).value || '-';
    const pharm = (document.getElementById('c8PharmName') || {}).value || '';
    const stepsHtml = g.steps.map(function (st, i) {
      return '<div style="display:flex;gap:8px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;break-inside:avoid;">' +
        '<div style="width:28px;height:28px;border-radius:999px;background:#0f766e;color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</div>' +
        '<div style="width:32px;height:32px;flex-shrink:0;">' + (ICONS[st.icon] || '') + '</div>' +
        '<div><div style="font-weight:700;font-size:11px;">' + st.title + '</div>' +
        '<div style="font-size:10px;color:#334155;line-height:1.4;">' + st.text + '</div></div></div>';
    }).join('');
    const warnHtml = g.warnings.map(function (w) {
      return '<li>' + w.text + '</li>';
    }).join('');
    const extraHtml = (g.extras || []).map(function (ex) {
      return '<div style="margin-top:6px;background:#e0f2fe;border:1px solid #7dd3fc;border-radius:8px;padding:6px 8px;font-size:10px;"><strong>' + ex.title + '</strong> — ' + ex.text + '</div>';
    }).join('');
    area.innerHTML =
      '<div style="border:2px solid #0f766e;border-radius:12px;padding:10px 12px;font-family:Sarabun,Prompt,sans-serif;color:#0f172a;">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:2px solid #0f766e;padding-bottom:8px;margin-bottom:8px;">' +
          '<div><div style="font-weight:700;font-size:15px;color:#134e4a;">ใบสอนเทคนิคการพ่นยา</div>' +
          '<div style="font-size:11px;color:#475569;">คลินิกโรคระบบทางเดินหายใจ โรงพยาบาลนพรัตนราชธานี</div></div>' +
          '<div style="text-align:right;font-size:11px;color:#475569;">วันที่: ' + todayThai() + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">' +
          '<div style="width:90px;flex-shrink:0;">' + (HERO[g.id] || '') + '</div>' +
          '<div>' +
            '<div style="font-weight:700;font-size:14px;">' + g.title + '</div>' +
            '<div style="font-size:11px;color:#0f766e;font-weight:600;">' + g.kind + ' · ' + g.breath + '</div>' +
            '<div style="font-size:10px;color:#475569;">' + (g.examples || '') + '</div>' +
            '<div style="font-size:11px;margin-top:4px;"><strong>ชื่อ-สกุล:</strong> ' + (name || '-') + ' &nbsp; <strong>HN:</strong> ' + (hn || '-') + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:6px 10px;margin-bottom:8px;font-size:10px;">' +
          '<div style="font-weight:700;">ข้อควรระวัง</div><ul style="margin:2px 0 0 16px;padding:0;">' + warnHtml + '</ul></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' + stepsHtml + '</div>' +
        extraHtml +
        '<div style="margin-top:8px;text-align:right;font-size:11px;">เภสัชกรผู้สอน: <strong>' + (pharm || '................................') + '</strong></div>' +
      '</div>';
    area.classList.remove('hidden');
    document.body.classList.add('print-mode-inhaler-guide');
    const done = function () {
      document.body.classList.remove('print-mode-inhaler-guide');
      area.classList.add('hidden');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(function () {
      window.print();
      setTimeout(done, 400);
    }, 80);
  }

  window.openInhalerTechniqueGuide = openInhalerTechniqueGuide;
  window.closeInhalerTechniqueGuide = closeInhalerTechniqueGuide;
  window.printInhalerTechniqueA5 = printInhalerTechniqueA5;
  window.pmkInhalerGuides = GUIDES;
  window.pmkInhalerGuideOrder = DEVICE_ORDER;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureDom);
  } else {
    ensureDom();
  }
})();
