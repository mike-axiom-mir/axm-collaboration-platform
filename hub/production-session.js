(function () {
  'use strict';

  const state = { current: null, workspace: '', sessions: [], heartbeat: null, busy: false };
  const $ = id => document.getElementById(id);

  async function request(url, options) {
    const response = await fetch(url, Object.assign({ cache: 'no-store' }, options || {}));
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw Error(body.error || ('Request failed: ' + response.status));
    return body;
  }

  function show(open) {
    const screen = $('productionSessionScreen');
    if (!screen) return;
    screen.hidden = !open;
    screen.classList.toggle('show', open);
  }

  function setMessage(text, error) {
    const target = $('productionSessionMessage');
    if (!target) return;
    target.textContent = text;
    target.style.color = error ? '#ff9aaa' : '';
  }

  function render() {
    const temporary = !!state.current;
    document.body.classList.toggle('production-session-active', temporary);
    $('productionSessionMain').hidden = temporary;
    $('productionSessionCurrent').hidden = !temporary;
    $('productionSessionToggle').classList.toggle('is-temporary', temporary);
    $('productionSessionToggleText').textContent = temporary ? state.current.participant + ' session' : 'Ivan mode';
    $('productionSessionState').textContent = temporary ? 'ISOLATED · ACTIVE' : (state.sessions.length ? state.sessions.length + ' ACTIVE' : 'MIKE · PRIMARY');
    if (temporary) {
      $('productionSessionParticipantName').textContent = state.current.participant;
      $('productionSessionId').textContent = state.current.id;
      $('productionSessionWorkspace').textContent = state.workspace || 'temporary workspace';
    }
    const list = $('productionSessionList');
    list.innerHTML = '';
    state.sessions.forEach(session => {
      const row = document.createElement('div');
      row.className = 'production-session-row';
      const info = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = session.participant + ' · temporary session';
      const detail = document.createElement('small');
      detail.textContent = session.id + ' · no automatic archive';
      info.append(title, detail);
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = 'Open session';
      open.addEventListener('click', () => window.open(session.url, '_blank', 'noopener'));
      row.append(info, open);
      list.append(row);
    });
  }

  async function refresh() {
    try {
      const result = await request('/api/production-sessions/status');
      state.current = result.current || null;
      state.sessions = Array.isArray(result.sessions) ? result.sessions : [];
      if (state.current) {
        const detail = await request('/api/production-session');
        state.workspace = detail.workspace || '';
        startHeartbeat();
      }
      render();
    } catch (error) {
      $('productionSessionState').textContent = 'UNAVAILABLE';
    }
  }

  function startHeartbeat() {
    if (state.heartbeat || !state.current) return;
    const beat = () => request('/api/production-session/heartbeat', { method: 'POST' }).catch(() => {});
    beat();
    state.heartbeat = setInterval(beat, 20000);
  }

  async function start() {
    if (state.busy) return;
    const participant = String($('productionSessionParticipant').value || 'Ivan').trim() || 'Ivan';
    const placeholder = window.open('', '_blank');
    state.busy = true;
    $('productionSessionStart').disabled = true;
    $('productionSessionStart').textContent = 'Preparing isolated room…';
    try {
      const result = await request('/api/production-sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-axm-production-session': 'explicit-start' },
        body: JSON.stringify({ participant, preset: participant.toLowerCase() === 'ivan' ? 'ivan' : 'temporary-production' })
      });
      if (placeholder) placeholder.location.replace(result.session.url);
      else window.open(result.session.url, '_blank', 'noopener');
      state.sessions.push(result.session);
      render();
      show(false);
    } catch (error) {
      if (placeholder) placeholder.close();
      alert('Temporary session could not start: ' + error.message);
    } finally {
      state.busy = false;
      $('productionSessionStart').disabled = false;
      $('productionSessionStart').textContent = 'Open isolated session';
    }
  }

  function localStorageSnapshot() {
    const result = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      result[key] = localStorage.getItem(key);
    }
    return result;
  }

  function jsonSafe(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return { unavailable: true, type: Object.prototype.toString.call(value) }; }
  }

  async function databaseNames() {
    if (indexedDB.databases) {
      const rows = await indexedDB.databases();
      return rows.map(row => row.name).filter(Boolean);
    }
    return ['axm_store'];
  }

  function readDatabase(name) {
    return new Promise(resolve => {
      const output = {};
      const open = indexedDB.open(name);
      open.onerror = () => resolve({ error: 'could not read database' });
      open.onupgradeneeded = () => { try { open.transaction.abort(); } catch (e) {} };
      open.onsuccess = () => {
        const db = open.result;
        const stores = Array.from(db.objectStoreNames);
        if (!stores.length) { db.close(); return resolve(output); }
        let left = stores.length;
        stores.forEach(storeName => {
          try {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const keys = store.getAllKeys();
            const values = store.getAll();
            tx.oncomplete = () => {
              output[storeName] = (keys.result || []).map((key, index) => ({ key: jsonSafe(key), value: jsonSafe((values.result || [])[index]) }));
              left -= 1;
              if (!left) { db.close(); resolve(output); }
            };
            tx.onerror = () => { output[storeName] = { error: 'read failed' }; left -= 1; if (!left) { db.close(); resolve(output); } };
          } catch (error) { output[storeName] = { error: error.message }; left -= 1; if (!left) { db.close(); resolve(output); } }
        });
      };
    });
  }

  async function browserSnapshot() {
    const indexedDb = {};
    for (const name of await databaseNames()) indexedDb[name] = await readDatabase(name);
    return { origin: location.origin, localStorage: localStorageSnapshot(), indexedDb };
  }

  async function saveAndClose() {
    if (state.busy) return;
    state.busy = true;
    $('productionSessionSaveClose').disabled = true;
    $('productionSessionDiscardClose').disabled = true;
    setMessage('Collecting this session’s browser state and produced files…');
    try {
      const snapshot = await browserSnapshot();
      const result = await request('/api/production-session/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-axm-production-session': 'explicit-download-and-close' },
        body: JSON.stringify(snapshot)
      });
      setMessage('Download prepared. This temporary room will erase itself after the file is handed over.');
      location.href = result.download;
      setTimeout(() => { try { window.close(); } catch (e) {} }, 1800);
    } catch (error) {
      state.busy = false;
      $('productionSessionSaveClose').disabled = false;
      $('productionSessionDiscardClose').disabled = false;
      setMessage('Could not package the session: ' + error.message, true);
    }
  }

  async function discardAndClose() {
    if (state.busy) return;
    if (!confirm('Discard this temporary session? Its browser state, logs and temporary files will be erased. Produced work is not archived automatically.')) return;
    state.busy = true;
    try {
      await request('/api/production-session/close', { method: 'POST', headers: { 'x-axm-production-session': 'explicit-discard-and-close' } });
      document.body.innerHTML = '<main style="padding:48px;color:#dce8f4;font-family:system-ui;background:#07101b;min-height:100vh"><h1>Temporary session discarded</h1><p>Mike’s Workshop state was not changed. This tab may be closed.</p></main>';
      setTimeout(() => { try { window.close(); } catch (e) {} }, 600);
    } catch (error) { state.busy = false; setMessage('Could not close the session: ' + error.message, true); }
  }

  async function copyPrompt() {
    const prompt = `AXM Temporary Production Session ${state.current.id} for ${state.current.participant}. Work only inside ${state.workspace}. Treat C:\\axm workshop as read-only. Do not modify Mike's Workshop state, accounts, logs, running services, or shared AI bodies. Put all new or edited files in the temporary workspace and leave receipts with meaningful outputs.`;
    try { await navigator.clipboard.writeText(prompt); setMessage('Safe Codex handoff copied. Open Codex from the temporary workspace for the strongest file boundary.'); }
    catch (error) { setMessage('Could not copy the handoff: ' + error.message, true); }
  }

  function boot() {
    if (!$('productionSessionToggle')) return;
    $('productionSessionToggle').addEventListener('click', () => show(true));
    $('productionSessionClose').addEventListener('click', () => show(false));
    $('productionSessionCancel').addEventListener('click', () => show(false));
    $('productionSessionStart').addEventListener('click', start);
    $('productionSessionSaveClose').addEventListener('click', saveAndClose);
    $('productionSessionDiscardClose').addEventListener('click', discardAndClose);
    $('productionSessionCopyPrompt').addEventListener('click', copyPrompt);
    $('productionSessionScreen').addEventListener('click', event => { if (event.target === $('productionSessionScreen')) show(false); });
    refresh();
  }

  boot();
})();
