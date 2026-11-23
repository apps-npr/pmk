/* PMK PWA client: connection status, offline save queue, install + SW updates */
(function () {
  const QUEUE_KEY = 'pmk_offline_save_queue_v1';
  const SW_VERSION_KEY = 'pmk_sw_version';
  const PING_MS = 30000;
  const PING_TIMEOUT = 7000;

  const state = {
    browserOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    sheetReachable: null, // null unknown, true/false
    queue: [],
    flushing: false,
    deferredPrompt: null
  };

  function scriptUrl() {
    return (typeof window.SCRIPT_URL === 'string' && window.SCRIPT_URL) || '';
  }
  function trackingUrl() {
    return (typeof window.PMK_TRACKING_URL === 'string' && window.PMK_TRACKING_URL) || '';
  }

  function loadQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      state.queue = Array.isArray(arr) ? arr : [];
    } catch (e) {
      state.queue = [];
    }
  }
  function persistQueue() {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(state.queue));
    renderStatus();
  }

  function canSaveToSheet() {
    return !!state.browserOnline && state.sheetReachable === true;
  }
  window.pmkCanSaveToSheet = canSaveToSheet;
  window.pmkGetConnState = function () {
    return { browserOnline: state.browserOnline, sheetReachable: state.sheetReachable, pending: state.queue.length };
  };

  function queueFingerprint(item) {
    return [item.kind || '', item.url || '', item.body || ''].join('\n');
  }

  function enqueueSave(item) {
    loadQueue();
    const fp = queueFingerprint(item);
    if (state.queue.some((q) => queueFingerprint(q) === fp)) return state.queue.length;
    state.queue.push({
      id: (crypto.randomUUID && crypto.randomUUID()) || ('q-' + Date.now() + '-' + Math.random().toString(16).slice(2)),
      createdAt: new Date().toISOString(),
      kind: item.kind || 'sheet',
      url: item.url,
      body: item.body,
      confirmable: !!item.confirmable,
      label: item.label || 'บันทึกข้อมูล'
    });
    persistQueue();
    return state.queue.length;
  }

  async function pingSheet() {
    const url = scriptUrl();
    if (!url) {
      state.sheetReachable = false;
      renderStatus();
      return false;
    }
    if (!navigator.onLine) {
      state.browserOnline = false;
      state.sheetReachable = false;
      renderStatus();
      return false;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT);
    try {
      // no-cors GET: if the request reaches Google the promise resolves (opaque).
      // If the network/path is down it rejects. Existing harmless query; no cose.gs change.
      await fetch(url + (url.includes('?') ? '&' : '?') + 'ping=1&t=' + Date.now(), {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: ctrl.signal
      });
      clearTimeout(timer);
      state.browserOnline = true;
      state.sheetReachable = true;
      renderStatus();
      return true;
    } catch (err) {
      clearTimeout(timer);
      state.browserOnline = navigator.onLine;
      state.sheetReachable = navigator.onLine ? false : false;
      renderStatus();
      return false;
    }
  }

  function connMode() {
    if (!state.browserOnline) return 'offline';
    if (state.sheetReachable === false) return 'amber';
    if (state.sheetReachable === true) return 'online';
    return state.browserOnline ? 'checking' : 'offline';
  }

  function renderStatus() {
    const bar = document.getElementById('pmkStatusBar');
    if (!bar) return;
    const mode = connMode();
    const pill = document.getElementById('pmkConnPill');
    const queueEl = document.getElementById('pmkQueueInfo');
    const flushBtn = document.getElementById('pmkFlushQueueBtn');

    bar.classList.remove('pmk-status-online', 'pmk-status-offline', 'pmk-status-amber', 'pmk-status-checking');
    bar.classList.add('pmk-status-' + mode);

    if (pill) {
      if (mode === 'online') {
        pill.innerHTML = '<i class="fa-solid fa-circle pmk-dot"></i> เชื่อมต่อแล้ว — บันทึกได้';
      } else if (mode === 'offline') {
        pill.innerHTML = '<i class="fa-solid fa-circle pmk-dot"></i> ออฟไลน์ — ยังบันทึกไม่ได้';
      } else if (mode === 'amber') {
        pill.innerHTML = '<i class="fa-solid fa-circle pmk-dot"></i> เน็ตมี แต่ยังเชื่อมต่อระบบไม่ได้';
      } else {
        pill.innerHTML = '<i class="fa-solid fa-circle pmk-dot"></i> กำลังตรวจการเชื่อมต่อ...';
      }
    }
    const n = state.queue.length;
    if (queueEl) {
      queueEl.textContent = n ? ('คิวรอส่ง ' + n + ' รายการ') : '';
      queueEl.classList.toggle('hidden', !n);
    }
    if (flushBtn) {
      flushBtn.classList.toggle('hidden', !n);
      flushBtn.disabled = state.flushing || mode === 'offline';
    }
  }

  async function flushQueue(manual) {
    if (state.flushing) return { sent: 0, failed: 0, skipped: true };
    loadQueue();
    if (!state.queue.length) return { sent: 0, failed: 0 };
    if (!navigator.onLine) {
      if (manual) alert('ยังออฟไลน์อยู่ครับ ส่งไม่ได้ในตอนนี้');
      return { sent: 0, failed: state.queue.length };
    }
    // Lock immediately so a second online event cannot send the same row twice.
    state.flushing = true;
    renderStatus();
    const reachable = await pingSheet();
    if (!reachable) {
      state.flushing = false;
      renderStatus();
      if (manual) alert('ยังเชื่อมต่อระบบไม่ได้ครับ รายการยังอยู่ในคิว');
      return { sent: 0, failed: state.queue.length };
    }
    let sent = 0, failed = 0, unconfirmed = 0;
    const remain = [];
    for (const item of state.queue) {
      try {
        const init = {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: item.body
        };
        if (!item.confirmable) init.mode = 'no-cors';
        const res = await fetch(item.url, init);
        if (item.confirmable) {
          const data = await res.json();
          if (data && (data.result === 'success' || data.status === 'success')) {
            sent += 1;
          } else {
            failed += 1;
            remain.push(item);
          }
        } else {
          // no-cors: request left the device, but the sheet write cannot be confirmed
          sent += 1;
          unconfirmed += 1;
        }
      } catch (err) {
        failed += 1;
        remain.push(item);
      }
    }
    state.queue = remain;
    persistQueue();
    state.flushing = false;
    renderStatus();
    if (manual || sent) {
      if (unconfirmed && !remain.length) {
        showLiteToast('ส่งรายการที่ค้างไว้แล้วครับ');
      } else if (sent && !remain.length) {
        showLiteToast('ส่งรายการที่ค้างไว้ครบแล้วครับ');
      } else if (remain.length) {
        showLiteToast('ส่งได้บางรายการ ยังเหลือในคิว ' + remain.length + ' รายการ');
      }
    }
    return { sent, failed, unconfirmed };
  }
  window.pmkFlushSaveQueue = flushQueue;

  function showLiteToast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else {
      const el = document.getElementById('pmkToast');
      if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 4000);
      } else {
        console.log(msg);
      }
    }
  }

  /**
   * Main clinic save. Uses no-cors, so success cannot be confirmed.
   * When offline/unreachable, queue instead of firing a request that would be lost.
   */
  window.pmkHandleSheetSave = async function (payloadObj, opts) {
    opts = opts || {};
    const body = JSON.stringify(payloadObj);
    const url = scriptUrl();
    if (!url) {
      alert('ยังไม่ได้ตั้งค่าที่อยู่สำหรับบันทึกข้อมูล');
      return { status: 'error' };
    }
    const ready = canSaveToSheet();
    if (!ready) {
      enqueueSave({
        kind: 'saveOPDNote',
        url,
        body,
        confirmable: false,
        label: opts.label || ('บันทึก ' + (payloadObj.clinic || ''))
      });
      alert('ตอนนี้ยังบันทึกไม่ได้ครับ ระบบเก็บรายการนี้ไว้ในเครื่องแล้ว จะส่งให้อัตโนมัติเมื่อเชื่อมต่อได้');
      return { status: 'queued', pending: state.queue.length };
    }
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body
      });
      showLiteToast('ส่งข้อมูลแล้วครับ');
      return { status: 'sent-unconfirmed' };
    } catch (err) {
      enqueueSave({ kind: 'saveOPDNote', url, body, confirmable: false, label: opts.label || 'บันทึกข้อมูล' });
      alert('ส่งข้อมูลไม่สำเร็จ ระบบเก็บรายการนี้ไว้ในเครื่องแล้ว จะส่งใหม่เมื่อเชื่อมต่อได้');
      return { status: 'queued', pending: state.queue.length };
    }
  };

  window.pmkHandleTrackingSave = function (payloadObj) {
    const url = trackingUrl();
    if (!url) return;
    const body = JSON.stringify(payloadObj);
    if (!canSaveToSheet() || !navigator.onLine) {
      enqueueSave({ kind: 'tracking', url, body, confirmable: false, label: 'ซิงก์ข้อมูล' });
      return;
    }
    fetch(url, { method: 'POST', body }).catch(() => {
      enqueueSave({ kind: 'tracking', url, body, confirmable: false, label: 'ซิงก์ข้อมูล' });
    });
  };

  window.pmkGuardOnlineAction = function (message) {
    if (canSaveToSheet()) return true;
    alert(message || 'ตอนนี้ออฟไลน์หรือเชื่อมต่อระบบไม่ได้ครับ กรุณาลองใหม่เมื่อแถบสถานะเป็นสีเขียว');
    return false;
  };

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIos() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function setupInstall() {
    const btn = document.getElementById('pmkInstallBtn');
    const hint = document.getElementById('pmkIosHint');
    if (isStandalone()) {
      if (btn) btn.classList.add('hidden');
      if (hint) hint.classList.add('hidden');
      return;
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      if (btn) btn.classList.remove('hidden');
    });
    window.addEventListener('appinstalled', () => {
      state.deferredPrompt = null;
      if (btn) btn.classList.add('hidden');
    });
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!state.deferredPrompt) return;
        state.deferredPrompt.prompt();
        try { await state.deferredPrompt.userChoice; } catch (e) {}
        state.deferredPrompt = null;
        btn.classList.add('hidden');
      });
    }
    if (hint && isIos()) hint.classList.remove('hidden');
  }

  function setupUpdatePrompt() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.type === 'PMK_SW_ACTIVATED' && data.version) {
        const prev = localStorage.getItem(SW_VERSION_KEY);
        if (prev && prev !== data.version) {
          showUpdateBar();
        }
        localStorage.setItem(SW_VERSION_KEY, data.version);
      }
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // after skipWaiting of a new worker; first control should not force reload
    });
  }

  function showUpdateBar() {
    const bar = document.getElementById('pmkUpdateBar');
    if (bar) bar.classList.remove('hidden');
  }

  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      if (reg.waiting) showUpdateBar();
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBar();
          }
        });
      });
    } catch (err) {
      console.warn('SW register failed', err);
    }
  }

  function bindUi() {
    const flushBtn = document.getElementById('pmkFlushQueueBtn');
    if (flushBtn) flushBtn.addEventListener('click', () => flushQueue(true));
    const reloadBtn = document.getElementById('pmkReloadBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', async () => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.waiting && r.waiting.postMessage({ type: 'SKIP_WAITING' })));
        location.reload();
      });
    }
  }

  function startWatch() {
    window.addEventListener('online', () => {
      state.browserOnline = true;
      renderStatus();
      pingSheet().then((ok) => { if (ok) flushQueue(false); });
    });
    window.addEventListener('offline', () => {
      state.browserOnline = false;
      state.sheetReachable = false;
      renderStatus();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pingSheet().then((ok) => { if (ok) flushQueue(false); });
    });
    setInterval(() => {
      pingSheet().then((ok) => { if (ok) flushQueue(false); });
    }, PING_MS);
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    loadQueue();
    bindUi();
    setupInstall();
    setupUpdatePrompt();
    renderStatus();
    registerSW();
    state.browserOnline = navigator.onLine;
    if (!state.browserOnline) {
      state.sheetReachable = false;
      renderStatus();
    } else {
      pingSheet().then((ok) => { if (ok) flushQueue(false); });
    }
    startWatch();
  });
})();
