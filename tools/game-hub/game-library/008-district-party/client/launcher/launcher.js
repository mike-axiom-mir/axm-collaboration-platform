(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const seatGrid = $('seat-grid');
  const seatGridB = $('seat-grid-b');
  const runningView = $('running-view');
  const setupView = $('setup-view');
  const joinGrid = $('join-grid');
  let activeSession = null;
  let activeRosterSignature = null;
  let detectedLanOrigin = null;
  let detectedLanOrigins = [];

  const seatDefaults = [
    { name: 'Player 1', type: 'human', enabled: true },
    { name: 'Player 2', type: 'human', enabled: false },
    { name: 'Player 3', type: 'human', enabled: false },
    { name: 'Player 4', type: 'human', enabled: false },
    { name: 'Player 5', type: 'human', enabled: false },
    { name: 'Player 6', type: 'human', enabled: false },
    { name: 'Player 7', type: 'human', enabled: false },
    { name: 'Player 8', type: 'human', enabled: false }
  ];

  const partyIdForSlot = (slot) => slot <= 4 ? 'party_a' : 'party_b';
  const partyLabelForSlot = (slot) => partyIdForSlot(slot) === 'party_a' ? 'PARTY A' : 'PARTY B';

  function seatCard(slot, value) {
    const el = document.createElement('article');
    el.className = `seat-card ${partyIdForSlot(slot) === 'party_b' ? 'party-b-seat' : 'party-a-seat'}${value.enabled ? '' : ' disabled'}`;
    el.dataset.slot = String(slot);
    el.innerHTML = `
      <div class="seat-head"><div><div class="seat-number">Player ${slot}</div><div class="party-badge">${partyLabelForSlot(slot)} · seat_${slot}</div></div><input class="seat-enabled" aria-label="Enable seat ${slot}" type="checkbox" ${value.enabled ? 'checked' : ''}></div>
      <label>Display name<input class="seat-name" type="text" maxlength="24" value="${value.name}"></label>
      <label>Controller<select class="seat-type"><option value="human" ${value.type === 'human' ? 'selected' : ''}>Human phone / keyboard</option><option value="ai" ${value.type === 'ai' ? 'selected' : ''}>Host AI</option><option value="adapter">Foundation adapter AI</option></select></label>`;
    el.querySelector('.seat-enabled').addEventListener('change', (event) => el.classList.toggle('disabled', !event.target.checked));
    return el;
  }

  seatDefaults.forEach((value, i) => (i < 4 ? seatGrid : seatGridB).appendChild(seatCard(i + 1, value)));
  $('enable-four').addEventListener('click', () => {
    document.querySelectorAll('.seat-card').forEach((card) => {
      if (Number(card.dataset.slot) > 4) return;
      card.querySelector('.seat-enabled').checked = true;
      card.classList.remove('disabled');
    });
  });
  $('enable-eight').addEventListener('click', () => {
    document.querySelectorAll('.seat-card').forEach((card) => {
      card.querySelector('.seat-enabled').checked = true;
      card.classList.remove('disabled');
    });
  });

  function currentMode() {
    return $('game-mode').value === 'district_dominion' ? 'district_dominion' : 'coop_adventure';
  }

  function currentMapId() {
    return $('map-id').value || 'tilburg-streetscape-foundation';
  }

  async function loadMapCatalog() {
    const catalog = await fetch('/api/maps', { cache: 'no-store' }).then((response) => response.json()).catch(() => null);
    if (!catalog?.ok || !Array.isArray(catalog.maps)) return;
    const select = $('map-id');
    select.replaceChildren();
    for (const map of catalog.maps) {
      const option = document.createElement('option');
      option.value = map.id;
      option.textContent = `${map.name}${map.status === 'current' ? '' : ' · ART ALPHA'}`;
      option.selected = map.id === catalog.defaultMapId;
      select.appendChild(option);
    }
  }

  function applyMode(mode, resetDefaults = false) {
    const territory = mode === 'district_dominion';
    $('party-b-setup').classList.toggle('hidden', !territory);
    $('mode-copy').textContent = territory
      ? 'District Dominion accepts any ready roster from 1v1 through 4v4, including unequal teams, in one city. Empty seats stay empty unless Host AI fill is deliberately enabled.'
      : 'Co-op Adventure keeps one shared Party A screen, the Party House mission board, vehicles, city AI, combat, and Courier Chaos.';
    $('host-ai-fill-rule').classList.toggle('hidden', !territory);
    if (!territory) $('host-ai-fill').checked = false;
    document.querySelectorAll('.seat-card').forEach((card) => {
      const slot = Number(card.dataset.slot);
      const enabled = card.querySelector('.seat-enabled');
      if (territory) {
        if (resetDefaults) {
          enabled.checked = slot === 1 || slot === 5;
          card.querySelector('.seat-type').value = 'human';
        }
      } else {
        enabled.checked = resetDefaults ? slot === 1 : enabled.checked && slot <= 4;
        if (resetDefaults) card.querySelector('.seat-type').value = 'human';
      }
      card.classList.toggle('disabled', !enabled.checked);
    });
  }

  $('game-mode').addEventListener('change', (event) => applyMode(event.target.value, true));
  applyMode(currentMode());

  function selectedPlayers() {
    return [...document.querySelectorAll('.seat-card')].filter((card) => card.querySelector('.seat-enabled').checked).map((card) => {
      const slot = Number(card.dataset.slot);
      const controllerType = card.querySelector('.seat-type').value;
      return {
        seatId: `seat_${slot}`,
        slot,
        displayName: card.querySelector('.seat-name').value.trim() || `Player ${slot}`,
        controllerType,
        adapterId: controllerType === 'adapter' ? `local-adapter-seat-${slot}` : null,
        ready: true
      };
    });
  }

  function combatRules() {
    return {
      enabled: $('combat-enabled').checked,
      crossPartyDamage: $('cross-party').checked,
      selfDamage: $('self-damage').checked,
      partyFriendlyFire: { party_a: $('ff-a').checked, party_b: $('ff-b').checked },
      allyKnockback: { enabled: Number($('ally-knockback').value) > 0, multiplier: Number($('ally-knockback').value) },
      channels: {
        projectileDamage: { sameParty: $('ff-a').checked, crossParty: $('cross-party').checked },
        meleeDamage: { implemented: true, sameParty: false, crossParty: true },
        explosionDamage: { implemented: false, safeDefault: 'disabled' },
        vehicleImpactDamage: { implemented: false, safeDefault: 'disabled' },
        environmentDamage: true
      }
    };
  }

  function absoluteUrl(path) {
    return new URL(path, window.location.origin).toString();
  }

  function isPrivateAddress(hostname) {
    return /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  }

  function phoneUrl(path) {
    if (isPrivateAddress(location.hostname)) return absoluteUrl(path);
    return detectedLanOrigin ? new URL(path, detectedLanOrigin).toString() : null;
  }

  function configureLanChoices(addresses) {
    const picker = $('lan-picker');
    const select = $('lan-address');
    const port = location.port || '8795';
    detectedLanOrigins = (Array.isArray(addresses) ? addresses : [])
      .filter(isPrivateAddress)
      .map((address) => ({ address, origin: `${location.protocol}//${address}:${port}` }));
    select.replaceChildren();
    for (const entry of detectedLanOrigins) {
      const option = document.createElement('option');
      option.value = entry.origin;
      option.textContent = `${entry.address}:${port}`;
      select.appendChild(option);
    }
    detectedLanOrigin = detectedLanOrigins[0]?.origin || null;
    picker.classList.toggle('hidden', detectedLanOrigins.length === 0);
    select.disabled = detectedLanOrigins.length < 2;
  }

  function makeQr(container, text) {
    if (typeof window.qrcode !== 'function') {
      container.textContent = 'QR library unavailable — copy the URL below.';
      return;
    }
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    container.innerHTML = qr.createImgTag(5, 8, `Controller QR for ${text}`);
  }

  function button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.addEventListener('click', onClick); return b;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function renderJoinBoard(session) {
    activeSession = session;
    activeRosterSignature = rosterSignature(session);
    sessionStorage.setItem('axmDistrictSession', JSON.stringify(session));
    setupView.classList.add('hidden');
    runningView.classList.remove('hidden');
    $('room-code').textContent = session.roomCode || 'AXM1';
    $('session-status').textContent = `${session.mapName || 'City'} · Running`;
    $('contract-json').textContent = JSON.stringify(session, (key, value) => key === 'token' ? '[seat token retained locally]' : value, 2);
    joinGrid.replaceChildren();
    const linksBySeat = new Map((session.controllerLinks || []).map((link) => [link.seatId, link]));
    (session.players || []).forEach((player) => {
      const link = linksBySeat.get(player.seatId);
      const card = document.createElement('article');
      const isHuman = player.controllerType === 'human';
      const isAdapter = player.controllerType === 'adapter';
      card.className = `join-card ${isHuman ? 'human' : isAdapter ? 'adapter' : 'ai'}`;
      card.innerHTML = `<div class="eyebrow">Player ${player.slot} · ${player.partyId === 'party_a' ? 'Party A' : 'Party B'}</div><h3>${escapeHtml(player.displayName)}</h3><div class="muted mono">${escapeHtml(player.seatId)}</div>`;
      if (isHuman && link) {
        const localUrl = absoluteUrl(link.url), lanUrl = phoneUrl(link.url);
        const qr = document.createElement('div'); qr.className = 'qr';
        if (lanUrl) makeQr(qr, lanUrl); else qr.innerHTML = '<div><strong>LAN ADDRESS NOT DETECTED</strong><br><span class="muted">No phone-ready QR is claimed. Use local testing or restart on a host that can expose its private address.</span></div>';
        card.appendChild(qr);
        const urlLine = document.createElement('span'); urlLine.className = 'url'; urlLine.title = lanUrl || localUrl; urlLine.dataset.localUrl = localUrl; if (lanUrl) urlLine.dataset.phoneUrl = lanUrl; urlLine.textContent = lanUrl || `LOCAL TEST ONLY · ${localUrl}`; card.appendChild(urlLine);
        const actions = document.createElement('div'); actions.className = 'row';
        actions.append(button('Open controller locally', () => window.open(localUrl, `_axm_controller_${player.slot}`)));
        actions.append(button(lanUrl ? 'Copy phone URL' : 'Copy local-test URL', () => navigator.clipboard?.writeText(lanUrl || localUrl)));
        card.appendChild(actions);
      } else if (isAdapter) {
        const state = document.createElement('div'); state.className = 'ai-state adapter-state';
        state.innerHTML = `<div><strong>FOUNDATION AI SEAT</strong><br><span class="muted">External semantic controls · same host gate · party-screen-bounded observation · no phone QR</span></div>`;
        card.appendChild(state);
      } else {
        const state = document.createElement('div'); state.className = 'ai-state';
        state.innerHTML = `<div><strong>OPTIONAL HOST AI</strong><br><span class="muted">Built-in state machine · deliberately selected · no phone required</span></div>`;
        card.appendChild(state);
      }
      joinGrid.appendChild(card);
    });
    const partyPath = session.persistentScreenLinks?.party_a || '/party-screen.html?party=party_a';
    const localPartyUrl = absoluteUrl(partyPath), lanPartyUrl = phoneUrl(partyPath);
    $('open-party').onclick = () => window.open(localPartyUrl, 'axm_party_a_screen');
    $('copy-party').textContent = lanPartyUrl ? 'Copy LAN screen URL' : 'Copy local screen URL';
    $('copy-party').onclick = () => navigator.clipboard?.writeText(lanPartyUrl || localPartyUrl);
    const partyBActive = (session.players || []).some((player) => player.partyId === 'party_b');
    $('party-b-screen-card').classList.toggle('hidden', !partyBActive);
    if (partyBActive) {
      const partyBPath = session.persistentScreenLinks?.party_b || '/party-screen.html?party=party_b';
      const localPartyBUrl = absoluteUrl(partyBPath), lanPartyBUrl = phoneUrl(partyBPath);
      $('open-party-b').onclick = () => window.open(localPartyBUrl, 'axm_party_b_screen');
      $('copy-party-b').textContent = lanPartyBUrl ? 'Copy LAN screen URL' : 'Copy local screen URL';
      $('copy-party-b').onclick = () => navigator.clipboard?.writeText(lanPartyBUrl || localPartyBUrl);
    }
  }

  function rosterSignature(session) {
    return JSON.stringify({
      sessionId: session?.sessionId,
      players: (session?.players || []).map((player) => [player.seatId, player.controllerType, player.displayName, player.connected]),
      controllerSeats: (session?.controllerLinks || []).map((link) => link.seatId),
      adapterSeats: (session?.adapterBindings || []).map((binding) => binding.seatId),
      groupSaveLoadedAt: session?.groupSave?.loadedAt || null,
    });
  }

  async function refreshLoadedRoster() {
    if (!activeSession) return;
    const state = await fetch('/api/launcher-state', { cache: 'no-store' }).then((response) => response.json()).catch(() => null);
    if (!state?.ok || state.status !== 'running' || state.sessionId !== activeSession.sessionId) return;
    if (rosterSignature(state) === activeRosterSignature) return;
    renderJoinBoard({ ...activeSession, ...state, hostToken: state.hostToken || activeSession.hostToken });
    $('session-status').textContent = state.groupSave
      ? `Loaded save ${state.groupSave.slot} · ${state.groupSave.hostAiFilledSeats} AI fill`
      : 'Running';
  }

  async function request(path, options = {}) {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.reason || `Request failed (${response.status})`);
    return data;
  }

  async function startSession() {
    const players = selectedPlayers();
    const mode = currentMode();
    const fillWithHostAi = mode === 'district_dominion' && $('host-ai-fill').checked;
    const error = $('setup-error'); error.classList.add('hidden');
    if (!players.length && !fillWithHostAi) { error.textContent = 'Ready at least one player seat.'; error.classList.remove('hidden'); return; }
    const hasPartyA = players.some((player) => player.slot <= 4);
    const hasPartyB = players.some((player) => player.slot >= 5);
    if (mode === 'district_dominion' && !fillWithHostAi && (!hasPartyA || !hasPartyB)) {
      error.textContent = 'District Dominion needs at least one ready seat in Party A and one in Party B. Unequal teams are allowed.';
      error.classList.remove('hidden');
      return;
    }
    const start = $('start-session'); start.disabled = true; start.textContent = 'Starting authoritative host…';
    try {
      const session = await request('/api/session/start', { method: 'POST', body: JSON.stringify({
        roomCode: 'AXM1',
        players,
        settings: { combat: combatRules(), mode, mapId: currentMapId(), hostAiFillEmptySeats: fillWithHostAi },
      }) });
      renderJoinBoard(session);
    } catch (e) {
      error.textContent = e.message; error.classList.remove('hidden');
    } finally { start.disabled = false; start.textContent = 'Start local city session'; }
  }

  $('start-session').addEventListener('click', startSession);
  $('lan-address').addEventListener('change', (event) => {
    detectedLanOrigin = detectedLanOrigins.some((entry) => entry.origin === event.target.value)
      ? event.target.value
      : null;
    if (activeSession) renderJoinBoard(activeSession);
  });
  $('restart-session').addEventListener('click', async () => {
    if (!activeSession) return;
    await request('/api/session/restart', { method: 'POST', body: JSON.stringify({ sessionId: activeSession.sessionId, hostToken: activeSession.hostToken }) });
    $('session-status').textContent = 'Restarted'; setTimeout(() => $('session-status').textContent = 'Running', 1200);
  });
  $('end-session').addEventListener('click', async () => {
    if (!activeSession) return;
    await request('/api/session/end', { method: 'POST', body: JSON.stringify({ sessionId: activeSession.sessionId, hostToken: activeSession.hostToken }) });
    activeSession = null; sessionStorage.removeItem('axmDistrictSession'); runningView.classList.add('hidden'); setupView.classList.remove('hidden');
  });

  async function boot() {
    try {
      await loadMapCatalog();
      const health = await fetch('/health').then((r) => r.json());
      $('server-status').textContent = health.ok === false ? 'Local host reported an issue' : 'Local host ready';
      $('server-status').classList.add('live');
      configureLanChoices(health.lanAddresses);
      const state = await fetch('/api/launcher-state').then((r) => r.json()).catch(() => null);
      const stored = JSON.parse(sessionStorage.getItem('axmDistrictSession') || 'null');
      if (state?.status === 'running' && stored?.sessionId === state.sessionId) renderJoinBoard({ ...stored, ...state, hostToken: stored.hostToken });
    } catch (e) { $('server-status').textContent = 'Local host unavailable'; }
  }
  boot();
  setInterval(refreshLoadedRoster, 1000);
})();
