/* PMK app gate: local login, works offline, does not contact the server */
(function () {
  const USER = 'ambu';
  const PASS_SHA256 = '9aef5ea10c093afb3139cfac9e9791ecc347d50c9bfe53a6d41d92822ec32fbe';
  const STORAGE_KEY = 'pmk_app_auth';

  function hexEqual(a, b) {
    const x = String(a || '');
    const y = String(b || '');
    if (x.length !== y.length) return false;
    let d = 0;
    for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return d === 0;
  }

  function bytesToHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }

  function sha256Fallback(text) {
    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    const bytes = new TextEncoder().encode(text);
    const l = bytes.length;
    const withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
    withPad.set(bytes);
    withPad[l] = 0x80;
    const bitLen = l * 8;
    const dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 4, bitLen >>> 0);
    dv.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000));
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const w = new Uint32Array(64);
    for (let i = 0; i < withPad.length; i += 64) {
      for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t-15],7) ^ rotr(w[t-15],18) ^ (w[t-15]>>>3);
        const s1 = rotr(w[t-2],17) ^ rotr(w[t-2],19) ^ (w[t-2]>>>10);
        w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        h=g; g=f; f=e; e=(d + temp1) >>> 0; d=c; c=b; b=a; a=(temp1 + temp2) >>> 0;
      }
      h0=(h0+a)>>>0; h1=(h1+b)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
      h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
    }
    const out = new Uint8Array(32);
    const o = new DataView(out.buffer);
    o.setUint32(0,h0); o.setUint32(4,h1); o.setUint32(8,h2); o.setUint32(12,h3);
    o.setUint32(16,h4); o.setUint32(20,h5); o.setUint32(24,h6); o.setUint32(28,h7);
    return bytesToHex(out);
  }

  async function sha256Hex(text) {
    try {
      if (globalThis.crypto && crypto.subtle && (window.isSecureContext !== false)) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return bytesToHex(new Uint8Array(buf));
      }
    } catch (e) {}
    return sha256Fallback(text);
  }

  function isAuthed() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1' || sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setAuthed(remember) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      if (remember) localStorage.setItem(STORAGE_KEY, '1');
      else sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (e) {}
    document.documentElement.classList.add('pmk-authed');
    syncAppGate();
  }

  function clearAuth() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    document.documentElement.classList.remove('pmk-authed');
    hideDatalistMenu();
    syncAppGate();
  }

  function showError(msg) {
    const el = document.getElementById('pmkLoginError');
    if (!el) return;
    if (!msg) {
      el.textContent = '';
      el.classList.add('hidden');
      return;
    }
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function focusUser() {
    const u = document.getElementById('pmkLoginUser');
    if (u && !document.documentElement.classList.contains('pmk-authed')) {
      setTimeout(() => u.focus(), 50);
    }
  }

  async function submitLogin(ev) {
    if (ev) ev.preventDefault();
    const userEl = document.getElementById('pmkLoginUser');
    const passEl = document.getElementById('pmkLoginPass');
    const remEl = document.getElementById('pmkLoginRemember');
    const btn = document.getElementById('pmkLoginSubmit');
    const user = (userEl && userEl.value || '').trim();
    const pass = (passEl && passEl.value) || '';
    showError('');
    if (!user || !pass) {
      showError('กรุณากรอกชื่อผู้ใช้และรหัสผ่านครับ');
      return false;
    }
    if (btn) btn.disabled = true;
    try {
      const hex = await sha256Hex(pass);
      const ok = user === USER && hexEqual(hex, PASS_SHA256);
      if (!ok) {
        showError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้องครับ');
        if (passEl) { passEl.focus(); passEl.select(); }
        return false;
      }
      setAuthed(!!(remEl && remEl.checked));
      if (passEl) passEl.value = '';
    } finally {
      if (btn) btn.disabled = false;
    }
    return false;
  }

  function togglePass() {
    const passEl = document.getElementById('pmkLoginPass');
    const btn = document.getElementById('pmkLoginTogglePass');
    if (!passEl) return;
    const show = passEl.type === 'password';
    passEl.type = show ? 'text' : 'password';
    if (btn) {
      btn.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
      btn.innerHTML = show
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';
    }
  }

  function logout() {
    clearAuth();
    const passEl = document.getElementById('pmkLoginPass');
    const userEl = document.getElementById('pmkLoginUser');
    if (passEl) passEl.value = '';
    if (userEl && !userEl.value) userEl.value = USER;
    showError('');
    focusUser();
  }


  function syncAppGate() {
    const app = document.getElementById('mainAppContainer');
    const authed = document.documentElement.classList.contains('pmk-authed');
    if (!app) return;
    if (authed) {
      app.removeAttribute('inert');
      app.removeAttribute('aria-hidden');
    } else {
      app.setAttribute('inert', '');
      app.setAttribute('aria-hidden', 'true');
    }
  }

  let dlMenu = null;
  let dlInput = null;
  let dlItems = [];
  let dlIndex = -1;
  let dlSetup = false;

  function hideDatalistMenu() {
    if (dlMenu) dlMenu.classList.add('hidden');
    if (dlMenu) dlMenu.innerHTML = '';
    dlInput = null;
    dlItems = [];
    dlIndex = -1;
  }

  function getDatalistOptions(el) {
    const id = el.getAttribute('list') || el.getAttribute('data-pmk-list');
    if (!id) return [];
    const list = document.getElementById(id);
    if (!list) return [];
    return [...list.querySelectorAll('option')].map((o) => o.value).filter(Boolean);
  }

  function armDatalistInput(el) {
    if (!el) return;
    const id = el.getAttribute('list') || el.getAttribute('data-pmk-list');
    if (!id || !document.getElementById(id)) return;
    if (el.getAttribute('list')) {
      el.setAttribute('data-pmk-list', id);
      el.removeAttribute('list');
    }
    el.setAttribute('autocomplete', el.getAttribute('autocomplete') || 'off');
    el.setAttribute('role', 'combobox');
    el.setAttribute('aria-autocomplete', 'list');
    el.setAttribute('aria-expanded', 'false');
  }

  function armAllDatalistInputs() {
    document.querySelectorAll('input[list], input[data-pmk-list]').forEach(armDatalistInput);
  }

  function ensureDatalistMenu() {
    if (dlMenu) return dlMenu;
    dlMenu = document.getElementById('pmkDatalistMenu');
    if (!dlMenu) {
      dlMenu = document.createElement('div');
      dlMenu.id = 'pmkDatalistMenu';
      dlMenu.className = 'hidden print:hidden';
      dlMenu.setAttribute('role', 'listbox');
      document.body.appendChild(dlMenu);
    }
    return dlMenu;
  }

  function positionDatalistMenu(input) {
    const menu = ensureDatalistMenu();
    const r = input.getBoundingClientRect();
    const width = Math.max(r.width, 320);
    let left = r.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    if (left < 8) left = 8;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const maxH = Math.min(280, Math.floor(window.innerHeight * 0.5));
    menu.style.width = width + 'px';
    menu.style.left = left + 'px';
    menu.style.maxHeight = maxH + 'px';
    if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
      menu.style.top = (r.bottom + 4) + 'px';
      menu.style.bottom = 'auto';
    } else {
      menu.style.top = 'auto';
      menu.style.bottom = (window.innerHeight - r.top + 4) + 'px';
    }
  }

  function renderDatalistMenu(input) {
    const all = getDatalistOptions(input);
    const q = (input.value || '').trim().toLowerCase();
    const exact = q && all.some((v) => v.toLowerCase() === q);
    const matches = (!q || exact) ? all : all.filter((v) => v.toLowerCase().includes(q));
    const menu = ensureDatalistMenu();
    menu.innerHTML = '';
    dlItems = [];
    dlIndex = -1;
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'pmk-dl-empty';
      empty.textContent = q ? 'ไม่พบรายการที่ตรงกัน' : 'ไม่มีรายการให้เลือก';
      menu.appendChild(empty);
    } else {
      matches.forEach((value, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', 'false');
        btn.textContent = value;
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => chooseDatalistValue(value));
        menu.appendChild(btn);
        dlItems.push(btn);
        if (q && value.toLowerCase() === q) dlIndex = i;
      });
    }
    menu.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    positionDatalistMenu(input);
    dlInput = input;
    highlightDatalistItem(dlIndex);
  }

  function highlightDatalistItem(idx) {
    dlItems.forEach((btn, i) => btn.setAttribute('aria-selected', i === idx ? 'true' : 'false'));
    dlIndex = idx;
    if (idx >= 0 && dlItems[idx]) dlItems[idx].scrollIntoView({ block: 'nearest' });
  }

  function chooseDatalistValue(value) {
    const input = dlInput;
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    hideDatalistMenu();
    input.setAttribute('aria-expanded', 'false');
    input.focus();
  }

  function openDatalistMenu(input) {
    armDatalistInput(input);
    renderDatalistMenu(input);
  }

  function setupDatalistPickers() {
    armAllDatalistInputs();
    if (dlSetup) return;
    dlSetup = true;
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement)) return;
      if (!el.getAttribute('list') && !el.getAttribute('data-pmk-list')) return;
      openDatalistMenu(el);
    });
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement)) return;
      if (el !== dlInput && !el.getAttribute('list') && !el.getAttribute('data-pmk-list')) return;
      if (el.getAttribute('list') || el.getAttribute('data-pmk-list')) openDatalistMenu(el);
    });
    document.addEventListener('keydown', (e) => {
      if (!dlInput || !dlMenu || dlMenu.classList.contains('hidden')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = dlIndex < dlItems.length - 1 ? dlIndex + 1 : 0;
        highlightDatalistItem(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = dlIndex > 0 ? dlIndex - 1 : dlItems.length - 1;
        highlightDatalistItem(next);
      } else if (e.key === 'Enter') {
        if (dlIndex >= 0 && dlItems[dlIndex]) {
          e.preventDefault();
          chooseDatalistValue(dlItems[dlIndex].textContent);
        }
      } else if (e.key === 'Escape') {
        hideDatalistMenu();
        if (dlInput) dlInput.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', (e) => {
      if (!dlMenu || dlMenu.classList.contains('hidden')) return;
      if (dlMenu.contains(e.target) || e.target === dlInput) return;
      hideDatalistMenu();
      const prev = document.querySelector('input[data-pmk-list][aria-expanded="true"]');
      if (prev) prev.setAttribute('aria-expanded', 'false');
    });
    window.addEventListener('resize', () => { if (dlInput) positionDatalistMenu(dlInput); });
    window.addEventListener('scroll', () => { if (dlInput) positionDatalistMenu(dlInput); }, true);

    const origSwitch = window.switchTab;
    if (typeof origSwitch === 'function') {
      window.switchTab = function () {
        hideDatalistMenu();
        const result = origSwitch.apply(this, arguments);
        setTimeout(armAllDatalistInputs, 0);
        return result;
      };
    }
    const origRenderHiv = window.renderHivDrugs;
    if (typeof origRenderHiv === 'function') {
      window.renderHivDrugs = function () {
        const result = origRenderHiv.apply(this, arguments);
        setTimeout(armAllDatalistInputs, 0);
        return result;
      };
    }
  }

  window.pmkAppLogout = logout;
  window.pmkAppIsAuthed = isAuthed;

  function bind() {
    const form = document.getElementById('pmkLoginForm');
    if (form) form.addEventListener('submit', submitLogin);
    const toggle = document.getElementById('pmkLoginTogglePass');
    if (toggle) toggle.addEventListener('click', togglePass);
    const logoutBtn = document.getElementById('pmkAppLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (isAuthed()) document.documentElement.classList.add('pmk-authed');
    syncAppGate();
    setupDatalistPickers();
    if (!isAuthed()) focusUser();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
