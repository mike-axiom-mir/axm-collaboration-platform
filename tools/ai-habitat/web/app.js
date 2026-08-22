const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  modeBadge: $('#modeBadge'),
  healthBadge: $('#healthBadge'),
  resetButton: $('#resetButton'),
  soundButton: $('#soundButton'),
  fullscreenButton: $('#fullscreenButton'),
  ambientButton: $('#ambientButton'),
  centerSeatButton: $('#centerSeatButton'),
  map: $('#habitatMap'),
  avatarLayer: $('#avatarLayer'),
  routeLayer: $('#routeLayer'),
  fxLayer: $('#fxLayer'),
  seatSelect: $('#seatSelect'),
  actionSelect: $('#actionSelect'),
  roomSelect: $('#roomSelect'),
  targetInput: $('#targetInput'),
  reasonInput: $('#reasonInput'),
  confirmationInput: $('#confirmationInput'),
  dispatchButton: $('#dispatchButton'),
  consoleMessage: $('#consoleMessage'),
  seatList: $('#seatList'),
  scenarioList: $('#scenarioList'),
  permissionList: $('#permissionList'),
  actionList: $('#actionList'),
  artifactGallery: $('#artifactGallery'),
  proofLog: $('#proofLog'),
  expressionFace: $('#expressionFace'),
  expressionSeatName: $('#expressionSeatName'),
  expressionPhrase: $('#expressionPhrase'),
  expressionMeta: $('#expressionMeta'),
  expressionCategory: $('#expressionCategory'),
  expressionEnabledToggle: $('#expressionEnabledToggle'),
  expressionStateFacesToggle: $('#expressionStateFacesToggle'),
  expressionEmoticonsToggle: $('#expressionEmoticonsToggle'),
  expressionWordsToggle: $('#expressionWordsToggle'),
  expressionSilenceToggle: $('#expressionSilenceToggle'),
  expressionInviteButton: $('#expressionInviteButton'),
  expressionPolicyButton: $('#expressionPolicyButton'),
  expressionClearButton: $('#expressionClearButton'),
  expressionMessage: $('#expressionMessage'),
  expressionSuggestions: $('#expressionSuggestions'),
  expressionHistory: $('#expressionHistory'),
  gameSeatSelect: $('#gameSeatSelect'),
  newGameButton: $('#newGameButton'),
  resignGameButton: $('#resignGameButton'),
  gameStatus: $('#gameStatus'),
  gameDetail: $('#gameDetail'),
  columnLaunchers: $('#columnLaunchers'),
  connect4Board: $('#connect4Board'),
  toastStack: $('#toastStack'),
  artifactDialog: $('#artifactDialog'),
  dialogClose: $('#dialogClose'),
  dialogTitle: $('#dialogTitle'),
  dialogKind: $('#dialogKind'),
  dialogSummary: $('#dialogSummary'),
  dialogContent: $('#dialogContent'),
  dialogProvenance: $('#dialogProvenance'),
};

let currentState = null;
let renderQueued = false;
let pollTimer = null;
let selectedSeat = '';
let selectedGameSeat = '';
let activeGameId = '';
let firstStateLoad = true;
let knownProofIds = new Set();
const storageGet = (key, fallback = null) => { try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const storageSet = (key, value) => { try { window.localStorage.setItem(key, value); } catch { /* storage may be unavailable in hardened contexts */ } };
let soundEnabled = storageGet('axm-habitat-sound') === 'on';
let ambientEnabled = storageGet('axm-habitat-ambient', 'on') !== 'off';
let audioContext = null;
let gameBusy = false;
let expressionBusy = false;
let expressionPolicyDirty = false;
let expressionPolicySeat = '';

const escapeHTML = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const roomNames = {
  commons: 'Commons',
  code_workshop: 'Code Workshop',
  art_studio: 'Art Studio',
  game_room: 'Game Room',
  library: 'Library',
  test_lab: 'Test Lab',
  permission_gate: 'Permission Gate',
  merge_gate: 'Merge Gate',
};

const actionRoomDefaults = {
  move: 'commons',
  create_code: 'code_workshop',
  create_art: 'art_studio',
  inspect_file: 'library',
  run_test: 'test_lab',
  play_game: 'game_room',
  create_note: 'commons',
  publish: 'merge_gate',
  delete_file: 'permission_gate',
};

const actionIcons = {
  move: '↗',
  create_code: '</>',
  create_art: '✦',
  inspect_file: '⌕',
  run_test: '✓',
  play_game: '♜',
  create_note: '≡',
  publish: '◇',
  delete_file: '×',
};

const artifactGlyphs = {
  code: '</>',
  art: '✦',
  note: '≡',
  test_report: '✓',
  game_record: '♜',
};

const sensitiveActions = new Set(['publish', 'delete_file', 'send_message', 'install_software', 'spend_money', 'change_roots']);
const terminalActionStates = new Set(['completed', 'failed', 'denied']);

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function setHealth(ok, message) {
  elements.healthBadge.textContent = message;
  elements.healthBadge.className = ok ? 'badge badge-live' : 'badge';
}

async function loadState() {
  try {
    const nextState = await api('/api/state');
    processNewEvents(nextState);
    currentState = nextState;
    setHealth(true, 'Local bridge online');
    queueRender();
  } catch (error) {
    setHealth(false, 'Bridge unavailable');
    elements.consoleMessage.textContent = error.message;
  }
}

function processNewEvents(nextState) {
  const logs = nextState.proof_log || [];
  if (firstStateLoad) {
    knownProofIds = new Set(logs.map((event) => event.id));
    firstStateLoad = false;
    return;
  }
  const fresh = logs.filter((event) => !knownProofIds.has(event.id));
  logs.forEach((event) => knownProofIds.add(event.id));
  fresh.slice(-4).forEach((event) => {
    const tone = event.type.includes('permission') ? 'warn'
      : event.type.includes('failed') || event.type.includes('denied') ? 'bad'
        : event.type.includes('completed') || event.type === 'artifact_created' ? 'good'
          : 'soft';
    showToast(eventTitle(event.type), event.message, tone);
    playTone(tone);
    if (event.type === 'artifact_created' || event.type === 'action_completed' || event.type === 'game_completed') {
      const room = roomForEvent(nextState, event);
      spawnParticles(room, tone === 'good' ? 13 : 8);
    }
  });
}

function eventTitle(type) {
  const titles = {
    action_started: 'Visible work started',
    action_completed: 'Work completed',
    action_failed: 'Work failed safely',
    artifact_created: 'Artifact landed',
    permission_requested: 'Human gate waiting',
    permission_approved: 'Permission approved once',
    permission_denied: 'Permission denied',
    scenario_started: 'Relay started',
    scenario_completed: 'Relay complete',
    scenario_stopped: 'Relay stopped',
    game_started: 'Game table opened',
    game_move: 'Game move verified',
    game_completed: 'Match recorded',
    expression_invited: 'Signal invitation opened',
    expression_shared: 'Voluntary line shared',
    expression_face_only: 'Face-only signal shared',
    expression_silence: 'Silence preserved',
    expression_cleared: 'Visible signal cleared',
    expression_policy_updated: 'Signal policy updated',
  };
  return titles[type] || 'Habitat event';
}

function roomForEvent(state, event) {
  if (event.artifact_id) {
    const artifact = state.artifacts.find((item) => item.id === event.artifact_id);
    if (artifact) return artifact.room;
  }
  if (event.action_id) {
    const action = state.actions.find((item) => item.id === event.action_id);
    if (action) return action.destination;
  }
  if (event.game_id) return 'game_room';
  const seat = state.seats.find((item) => item.id === event.seat);
  return seat?.location || 'commons';
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  if (!currentState) return;
  renderSummary();
  renderSelects();
  renderSeatList();
  renderScenarios();
  renderRooms();
  renderRoomArtifacts();
  renderAvatars();
  renderExpressionLounge();
  renderRoutes();
  renderPermissions();
  renderActions();
  renderArtifacts();
  renderProofLog();
  renderGame();
}

function renderSummary() {
  const connected = currentState.seats.filter((seat) => seat.connected).length;
  const activeActions = currentState.actions.filter((action) => ['active', 'waiting_permission'].includes(action.status)).length;
  const activeGames = (currentState.games || []).filter((game) => game.status === 'active').length;
  const pending = currentState.permissions.filter((permission) => permission.status === 'pending').length;
  $('#metricSeats').textContent = connected;
  $('#metricActions').textContent = activeActions + activeGames;
  $('#metricPermissions').textContent = pending;
  $('#metricArtifacts').textContent = currentState.artifacts.length;
  $('#seatCountLabel').textContent = `${connected} active`;
  elements.modeBadge.textContent = currentState.mode;
}

function renderSelects() {
  const connectedSeats = currentState.seats.filter((seat) => seat.connected);
  if (!selectedSeat || !connectedSeats.some((seat) => seat.id === selectedSeat)) {
    selectedSeat = connectedSeats[0]?.id || '';
  }
  if (!selectedGameSeat || !connectedSeats.some((seat) => seat.id === selectedGameSeat)) {
    selectedGameSeat = connectedSeats.find((seat) => seat.id === 'mirror-local')?.id || connectedSeats[0]?.id || '';
  }

  elements.seatSelect.innerHTML = connectedSeats.length
    ? connectedSeats.map((seat) => `<option value="${escapeHTML(seat.id)}" ${seat.id === selectedSeat ? 'selected' : ''}>${escapeHTML(seat.display_name)} · ${escapeHTML(seat.provider)}</option>`).join('')
    : '<option value="">No connected seats</option>';
  elements.gameSeatSelect.innerHTML = connectedSeats.length
    ? connectedSeats.map((seat) => `<option value="${escapeHTML(seat.id)}" ${seat.id === selectedGameSeat ? 'selected' : ''}>${escapeHTML(seat.display_name)} · ${escapeHTML(seat.provider)}</option>`).join('')
    : '<option value="">No connected seats</option>';
  elements.dispatchButton.disabled = !connectedSeats.length;
  elements.newGameButton.disabled = !connectedSeats.length || gameBusy;

  if (!elements.roomSelect.options.length) {
    elements.roomSelect.innerHTML = Object.entries(roomNames).map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  }
  $$('.room').forEach((room) => room.classList.toggle('selected-room', room.dataset.room === elements.roomSelect.value));
}

function renderSeatList() {
  elements.seatList.innerHTML = currentState.seats.map((seat) => {
    const expression = activeExpressionForSeat(seat);
    const face = displayFaceForSeat(seat);
    const signal = expression?.phrase || (expression ? 'Face-only signal · no words' : 'Quiet · state signal only');
    return `
      <div class="seat-row ${seat.id === selectedSeat ? 'selected' : ''}" data-seat-row="${escapeHTML(seat.id)}">
        <div class="seat-row-main" data-seat-focus="${escapeHTML(seat.id)}" role="button" tabindex="0" aria-label="Select and find ${escapeHTML(seat.display_name)}">
          <div class="seat-avatar" title="Symbolic state or voluntary face">${escapeHTML(face)}</div>
          <div class="seat-copy">
            <strong>${escapeHTML(seat.display_name)}</strong>
            <small>${escapeHTML(roomNames[seat.location] || seat.location)} · ${escapeHTML(seat.status)} · ${escapeHTML(seat.provider)}</small>
            <em class="seat-signal-line">${escapeHTML(signal)}</em>
          </div>
        </div>
        <button class="seat-toggle ${seat.connected ? 'on' : ''}" type="button" data-seat-toggle="${escapeHTML(seat.id)}" data-connected="${seat.connected}">${seat.connected ? 'Connected' : 'Connect'}</button>
      </div>
    `;
  }).join('');
}

function renderScenarios() {
  const scenarios = [...(currentState.scenarios || [])].slice(-5).reverse();
  if (!scenarios.length) {
    elements.scenarioList.className = 'scenario-list empty-state';
    elements.scenarioList.textContent = 'No relay is running.';
    return;
  }
  elements.scenarioList.className = 'scenario-list';
  elements.scenarioList.innerHTML = scenarios.map((scenario) => {
    const completeSteps = Math.min(scenario.step_index || 0, scenario.step_count || 1);
    const partial = scenario.status === 'completed' ? scenario.step_count : completeSteps;
    const progress = Math.max(4, Math.round((partial / Math.max(1, scenario.step_count)) * 100));
    return `
      <div class="scenario-card">
        <div class="scenario-card-head"><strong>${escapeHTML(scenario.name)}</strong><span class="status-pill ${safeClass(scenario.status)}">${escapeHTML(scenario.status.replaceAll('_', ' '))}</span></div>
        <p>${escapeHTML(scenario.message || scenario.summary)}</p>
        <div class="scenario-progress"><i style="--progress:${progress}%"></i></div>
      </div>
    `;
  }).join('');
}

function renderRooms() {
  for (const roomId of Object.keys(roomNames)) {
    const room = document.querySelector(`[data-room="${CSS.escape(roomId)}"]`);
    if (!room) continue;
    const seats = currentState.seats.filter((seat) => seat.connected && seat.location === roomId);
    const actions = currentState.actions.filter((action) => action.destination === roomId && ['active', 'waiting_permission'].includes(action.status));
    const games = roomId === 'game_room' ? (currentState.games || []).filter((game) => game.status === 'active').length : 0;
    const waiting = roomId === 'permission_gate' && currentState.permissions.some((permission) => permission.status === 'pending');
    const active = actions.length > 0 || games > 0 || seats.some((seat) => ['working', 'playing'].includes(seat.status));
    room.classList.toggle('active-room', active);
    room.classList.toggle('waiting-room', waiting);
    const label = room.querySelector(`[data-room-state="${CSS.escape(roomId)}"]`);
    if (label) {
      if (waiting) label.textContent = 'waiting';
      else if (games) label.textContent = `${games} match`;
      else if (actions.length) label.textContent = `${actions.length} active`;
      else if (seats.length) label.textContent = `${seats.length} present`;
      else label.textContent = roomId === 'permission_gate' ? 'guarded' : 'quiet';
    }
  }
}

function renderRoomArtifacts() {
  $$('[data-artifacts]').forEach((container) => {
    const room = container.dataset.artifacts;
    const artifacts = currentState.artifacts.filter((artifact) => artifact.room === room).slice(-3).reverse();
    if (!artifacts.length) {
      container.innerHTML = '<div class="room-object">Empty work surface</div>';
      return;
    }
    container.innerHTML = artifacts.slice(0, 2).map((artifact) => `<div class="room-object ${safeClass(artifact.kind)}"><strong>${escapeHTML(artifact.kind)}</strong> · ${escapeHTML(artifact.name)}</div>`).join('')
      + (artifacts.length > 2 ? `<div class="room-object more">+${artifacts.length - 2} more</div>` : '');
  });
}

function getRoomAnchor(roomId, index = 0) {
  const room = document.querySelector(`[data-room="${CSS.escape(roomId)}"]`);
  if (!room || !elements.map) return { left: 50, top: 50 };
  const mapRect = elements.map.getBoundingClientRect();
  const rect = room.getBoundingClientRect();
  const offsets = [
    { x: 0.70, y: 0.59 },
    { x: 0.47, y: 0.67 },
    { x: 0.78, y: 0.40 },
    { x: 0.48, y: 0.42 },
    { x: 0.28, y: 0.63 },
  ];
  const offset = offsets[index % offsets.length];
  return {
    left: ((rect.left - mapRect.left + rect.width * offset.x) / mapRect.width) * 100,
    top: ((rect.top - mapRect.top + rect.height * offset.y) / mapRect.height) * 100,
  };
}

function activeActionForSeat(seat) {
  const direct = seat.active_action_id && !String(seat.active_action_id).startsWith('game:')
    ? currentState.actions.find((action) => action.id === seat.active_action_id)
    : null;
  if (direct) return direct;
  return [...currentState.actions].reverse().find((action) => action.seat === seat.id && ['active', 'waiting_permission'].includes(action.status));
}

function activeExpressionForSeat(seat) {
  const expression = seat?.expression;
  if (!expression || typeof expression !== 'object') return null;
  if (expression.expires_at && new Date(expression.expires_at).getTime() <= Date.now()) return null;
  return expression;
}

function stateFaceForSeat(seat) {
  const policy = seat?.expression_policy || {};
  if (policy.enabled === false || policy.show_state_face === false) {
    return seat?.avatar || seat?.display_name?.slice(0, 2).toUpperCase() || 'AI';
  }
  const faces = currentState?.expression_catalog?.state_faces || {};
  return faces[seat?.status] || faces.idle || '•‿•';
}

function displayFaceForSeat(seat) {
  const policy = seat?.expression_policy || {};
  const expression = activeExpressionForSeat(seat);
  if (policy.enabled !== false && policy.allow_emoticons !== false && expression?.face) return expression.face;
  return stateFaceForSeat(seat);
}

function renderAvatars() {
  const roomCounts = {};
  for (const seat of currentState.seats) {
    roomCounts[seat.location] = roomCounts[seat.location] || 0;
    const index = roomCounts[seat.location]++;
    const anchor = getRoomAnchor(seat.location, index);
    const action = activeActionForSeat(seat);
    let avatar = elements.avatarLayer.querySelector(`[data-avatar-id="${CSS.escape(seat.id)}"]`);
    if (!avatar) {
      avatar = document.createElement('button');
      avatar.type = 'button';
      avatar.dataset.avatarId = seat.id;
      avatar.addEventListener('click', () => selectSeat(seat.id, true));
      elements.avatarLayer.appendChild(avatar);
    }
    const expression = activeExpressionForSeat(seat);
    const face = displayFaceForSeat(seat);
    avatar.className = `avatar status-${safeClass(seat.status)} ${seat.connected ? '' : 'disconnected'} ${seat.id === selectedSeat ? 'selected-avatar' : ''} ${expression ? 'expression-active' : ''}`;
    avatar.style.left = `${anchor.left}%`;
    avatar.style.top = `${anchor.top}%`;
    avatar.style.setProperty('--seat-accent', seatAccent(seat.id));
    avatar.setAttribute('aria-label', `${seat.display_name}, ${seat.status}, ${roomNames[seat.location] || seat.location}${expression?.phrase ? `, says ${expression.phrase}` : ''}`);
    const tool = seat.status === 'playing' ? '♜' : actionIcons[action?.action] || (seat.status === 'waiting_permission' ? '🔐' : '·');
    const operational = action?.reason || seat.last_reason || `${seat.status} in ${roomNames[seat.location] || seat.location}`;
    const bubble = expression
      ? `<strong class="bubble-signal-line">${escapeHTML(expression.face || face)} ${escapeHTML(expression.phrase || 'Face-only signal · no words')}</strong><small>voluntary ${escapeHTML(expression.category || 'signal')} · ${escapeHTML(expression.chosen_by || expression.source || 'seat')}</small><span class="bubble-operational">State: ${escapeHTML(seat.status)} · ${escapeHTML(operational)}</span>`
      : `<span>${escapeHTML(operational)}</span><small>operational state · no voluntary words active</small>`;
    avatar.innerHTML = `
      <div class="avatar-bubble">${bubble}</div>
      <div class="avatar-core">
        <span class="avatar-status-ring"></span>
        <span class="avatar-face">${escapeHTML(face)}</span>
        <span class="avatar-id-badge">${escapeHTML(seat.avatar || seat.display_name.slice(0, 2).toUpperCase())}</span>
        <span class="avatar-tool" aria-hidden="true">${escapeHTML(tool)}</span>
        ${seat.carrying ? `<span class="carrying" title="${escapeHTML(seat.carrying)}">${escapeHTML(seat.carrying)}</span>` : ''}
      </div>
      <span class="avatar-name">${escapeHTML(seat.display_name)}</span>
    `;
  }
  const ids = new Set(currentState.seats.map((seat) => seat.id));
  [...elements.avatarLayer.children].forEach((avatar) => {
    if (!ids.has(avatar.dataset.avatarId)) avatar.remove();
  });
}

function renderExpressionLounge() {
  if (!elements.expressionFace) return;
  const seat = currentState.seats.find((item) => item.id === selectedSeat) || currentState.seats[0];
  const catalog = currentState.expression_catalog || {};
  const categories = catalog.categories || {};
  const categoryKeys = Object.keys(categories);
  const previousCategory = elements.expressionCategory.value;
  if (elements.expressionCategory.options.length !== categoryKeys.length) {
    elements.expressionCategory.innerHTML = categoryKeys.map((key) => `<option value="${escapeHTML(key)}">${escapeHTML(categories[key]?.label || key.replaceAll('_', ' '))}</option>`).join('');
    elements.expressionCategory.value = categoryKeys.includes(previousCategory) ? previousCategory : (categoryKeys.includes('useful') ? 'useful' : categoryKeys[0] || '');
  }
  if (!seat) {
    elements.expressionFace.textContent = '·_·';
    elements.expressionSeatName.textContent = 'No seat selected';
    elements.expressionPhrase.textContent = 'There is nobody to invite.';
    elements.expressionMeta.textContent = 'Connect a seat first.';
    elements.expressionInviteButton.disabled = true;
    elements.expressionPolicyButton.disabled = true;
    elements.expressionClearButton.disabled = true;
    return;
  }

  const policy = seat.expression_policy || {};
  if (expressionPolicySeat !== seat.id) {
    expressionPolicySeat = seat.id;
    expressionPolicyDirty = false;
  }
  if (!expressionPolicyDirty) {
    elements.expressionEnabledToggle.checked = policy.enabled !== false;
    elements.expressionStateFacesToggle.checked = policy.show_state_face !== false;
    elements.expressionEmoticonsToggle.checked = policy.allow_emoticons !== false;
    elements.expressionWordsToggle.checked = policy.allow_words !== false;
    elements.expressionSilenceToggle.checked = policy.allow_silence !== false;
  }

  const expression = activeExpressionForSeat(seat);
  const face = displayFaceForSeat(seat);
  elements.expressionFace.textContent = face;
  elements.expressionFace.classList.toggle('speaking', Boolean(expression?.phrase));
  elements.expressionSeatName.textContent = `${seat.display_name} · ${seat.status}`;
  if (expression?.phrase) {
    elements.expressionPhrase.textContent = expression.phrase;
    elements.expressionMeta.textContent = `${expression.category || 'signal'} · ${expression.chosen_by || expression.source || 'seat'} · ${expression.invited ? 'accepted invitation' : 'seat-initiated'}${expression.expires_at ? ` · visible until ${formatTime(expression.expires_at)}` : ''}`;
  } else if (expression) {
    elements.expressionPhrase.textContent = 'Face-only signal. No words were added.';
    elements.expressionMeta.textContent = `${expression.category || 'signal'} · ${expression.chosen_by || expression.source || 'seat'} · silence preserved inside the line`;
  } else {
    elements.expressionPhrase.textContent = 'Quiet. No voluntary line is active.';
    elements.expressionMeta.textContent = `State-face: ${seat.status} · silence is valid · last operational reason: ${seat.last_reason || 'none supplied'}`;
  }

  const category = elements.expressionCategory.value || categoryKeys[0] || '';
  const categoryData = categories[category] || {};
  const previewFaces = (categoryData.faces || []).slice(0, 4).map((item) => `<span class="signal-face-chip">${escapeHTML(item)}</span>`).join('');
  const previewLines = (categoryData.phrases || []).slice(0, 3).map((item) => `<p>“${escapeHTML(item.text || '')}”</p>`).join('');
  elements.expressionSuggestions.innerHTML = `
    <div class="signal-suggestion-head"><strong>${escapeHTML(categoryData.label || category || 'Signal family')}</strong><span>examples only · not spoken automatically</span></div>
    <div class="signal-face-row">${previewFaces || '<span class="signal-face-chip">·_·</span>'}</div>
    <div class="signal-line-preview">${previewLines || '<p>No sample lines in this family.</p>'}</div>
  `;

  const history = [...(currentState.expression_history || [])].slice(-10).reverse();
  if (!history.length) {
    elements.expressionHistory.className = 'signal-history empty-state';
    elements.expressionHistory.textContent = 'No voluntary signal has been recorded.';
  } else {
    elements.expressionHistory.className = 'signal-history';
    elements.expressionHistory.innerHTML = history.map((item) => {
      const historyFace = item.mode === 'silent' ? '·_·' : (item.face || '•‿•');
      const line = item.mode === 'silent' ? 'Chose silence; no words invented.' : (item.phrase || 'Face only; no words.');
      return `<div class="signal-history-row"><span class="history-face">${escapeHTML(historyFace)}</span><div><strong>${escapeHTML(item.seat_name || item.seat)}</strong><p>${escapeHTML(line)}</p><small>${escapeHTML(item.category || item.mode)} · ${escapeHTML(item.chosen_by || item.source || 'seat')} · ${formatTime(item.created_at)}</small></div></div>`;
    }).join('');
  }

  elements.expressionInviteButton.disabled = expressionBusy || !seat.connected || policy.enabled === false;
  elements.expressionPolicyButton.disabled = expressionBusy;
  elements.expressionClearButton.disabled = expressionBusy || !expression;
}

function renderRoutes() {
  const roomCounts = {};
  const lines = [];
  for (const seat of currentState.seats) {
    roomCounts[seat.location] = roomCounts[seat.location] || 0;
    const index = roomCounts[seat.location]++;
    const isActive = ['working', 'waiting_permission', 'playing'].includes(seat.status);
    const origin = seat.previous_location;
    if (!isActive || !origin || origin === seat.location) continue;
    const from = getRoomAnchor(origin, 0);
    const to = getRoomAnchor(seat.location, index);
    const x1 = from.left * 10;
    const y1 = from.top * 6.5;
    const x2 = to.left * 10;
    const y2 = to.top * 6.5;
    const curve = Math.max(25, Math.abs(x2 - x1) * .18);
    const path = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + curve).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - curve).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    const kind = seat.status === 'waiting_permission' ? 'waiting' : seat.status === 'playing' ? 'playing' : '';
    lines.push(`<path class="route-line ${kind}" d="${path}"><title>${escapeHTML(seat.display_name)} route</title></path>`);
  }
  elements.routeLayer.innerHTML = lines.join('');
}

function renderPermissions() {
  const pending = currentState.permissions.filter((permission) => permission.status === 'pending').reverse();
  if (!pending.length) {
    elements.permissionList.className = 'stack-list empty-state';
    elements.permissionList.textContent = 'No requests are waiting.';
    return;
  }
  elements.permissionList.className = 'stack-list';
  elements.permissionList.innerHTML = pending.map((permission) => `
    <div class="list-card">
      <div class="list-card-head">
        <strong>${escapeHTML(permission.summary)}</strong>
        <span class="status-pill waiting_permission">waiting</span>
      </div>
      <p>${escapeHTML(permission.reason)}</p>
      <span class="card-meta">Boundary: ${escapeHTML(permission.boundary || 'explicit confirmation')} · requested ${formatTime(permission.created_at)} · ${escapeHTML(permission.seat)}</span>
      <div class="card-actions">
        <button class="button tiny approve" type="button" data-permission="${escapeHTML(permission.id)}" data-decision="approve">Approve once</button>
        <button class="button tiny deny" type="button" data-permission="${escapeHTML(permission.id)}" data-decision="deny">Deny</button>
      </div>
    </div>
  `).join('');
}

function renderActions() {
  const actions = [...currentState.actions].slice(-14).reverse();
  if (!actions.length) {
    elements.actionList.className = 'stack-list empty-state';
    elements.actionList.textContent = 'No action has been dispatched.';
    return;
  }
  elements.actionList.className = 'stack-list';
  elements.actionList.innerHTML = actions.map((action) => {
    const active = ['active', 'waiting_permission'].includes(action.status);
    const result = action.result?.message ? `<br><span class="card-meta">Result: ${escapeHTML(action.result.message)}</span>` : '';
    return `
      <div class="list-card">
        <div class="list-card-head">
          <strong>${escapeHTML(action.seat)} → ${escapeHTML(action.action)}</strong>
          <span class="status-pill ${safeClass(action.status)}">${escapeHTML(action.status.replaceAll('_', ' '))}</span>
        </div>
        <p><strong>${escapeHTML(action.target)}</strong><br>${escapeHTML(action.reason)}${result}</p>
        <span class="card-meta">${escapeHTML(roomNames[action.origin] || action.origin)} → ${escapeHTML(roomNames[action.destination] || action.destination)} · ${formatTime(action.requested_at)} · executor: ${escapeHTML(action.executor || action.source)}</span>
        ${active ? '<div class="progress-track"><i></i></div>' : ''}
      </div>
    `;
  }).join('');
}

function renderArtifacts() {
  const artifacts = [...currentState.artifacts].slice(-24).reverse();
  elements.artifactGallery.innerHTML = artifacts.map((artifact) => {
    const preview = artifact.kind === 'art' && artifact.path
      ? `<img src="${escapeHTML(artifactURL(artifact.path))}" alt="Preview of ${escapeHTML(artifact.name)}">`
      : `<span class="artifact-glyph">${escapeHTML(artifactGlyphs[artifact.kind] || '◇')}</span>`;
    return `
      <button class="artifact-card" type="button" data-artifact-id="${escapeHTML(artifact.id)}">
        <div class="artifact-preview">${preview}</div>
        <div class="artifact-body">
          <span class="kind">${escapeHTML(artifact.kind)}</span>
          <strong>${escapeHTML(artifact.name)}</strong>
          <p>${escapeHTML(artifact.summary || 'No summary supplied.')}</p>
        </div>
        <footer><span>${escapeHTML(artifact.created_by)}</span><span>${escapeHTML(roomNames[artifact.room] || artifact.room)}</span></footer>
      </button>
    `;
  }).join('');
}

function renderProofLog() {
  const logs = [...currentState.proof_log].slice(-100).reverse();
  elements.proofLog.innerHTML = logs.map((event) => `
    <div class="proof-row type-${safeClass(event.type)}">
      <span class="proof-time">${formatTime(event.time)}</span>
      <i class="proof-marker"></i>
      <div class="proof-copy"><strong>${escapeHTML(event.message)}</strong><small>${escapeHTML(event.type)} · ${escapeHTML(event.seat)} · ${escapeHTML(event.evidence || 'no evidence reference')}</small></div>
    </div>
  `).join('');
}

function renderGame() {
  const games = currentState.games || [];
  let game = activeGameId ? games.find((item) => item.id === activeGameId) : null;
  if (!game) {
    game = [...games].reverse().find((item) => item.status === 'active' && item.seat === selectedGameSeat)
      || [...games].reverse().find((item) => item.status === 'active')
      || [...games].reverse()[0];
    activeGameId = game?.id || '';
  }

  const board = game?.board || Array.from({ length: 6 }, () => Array(7).fill('.'));
  const lastMove = game?.moves?.[game.moves.length - 1];
  elements.connect4Board.innerHTML = board.flatMap((row, rowIndex) => row.map((value, colIndex) => {
    const tokenClass = value === 'H' ? 'human' : value === 'A' ? 'ai' : '';
    const last = lastMove?.row === rowIndex && lastMove?.column === colIndex ? 'last' : '';
    const label = value === 'H' ? 'Human disc' : value === 'A' ? 'AI rule-hand disc' : 'Empty cell';
    return `<div class="connect4-cell" role="gridcell" aria-label="Row ${rowIndex + 1}, column ${colIndex + 1}: ${label}"><i class="connect4-piece ${tokenClass} ${last}"></i></div>`;
  })).join('');

  const humanTurn = game?.status === 'active' && game.turn === 'human' && !gameBusy;
  elements.columnLaunchers.innerHTML = Array.from({ length: 7 }, (_, column) => {
    const full = board[0][column] !== '.';
    return `<button class="column-launcher" type="button" data-game-column="${column}" ${!humanTurn || full ? 'disabled' : ''} aria-label="Drop a disc in column ${column + 1}">▼ ${column + 1}</button>`;
  }).join('');

  elements.resignGameButton.disabled = !game || game.status !== 'active' || gameBusy;
  elements.newGameButton.disabled = !selectedGameSeat || gameBusy || Boolean(game && game.status === 'active');
  if (!game) {
    elements.gameStatus.textContent = 'No active match.';
    elements.gameDetail.textContent = 'Start a match. Your discs are gold; the deterministic rule hand uses violet.';
    return;
  }
  if (game.status === 'active') {
    elements.gameStatus.textContent = game.turn === 'human' ? `Your move against ${game.seat_name}.` : `${game.seat_name} is calculating a verified move.`;
    elements.gameDetail.textContent = `${game.moves.length} moves recorded · ${game.mode.replaceAll('_', ' ')} · no hidden board state.`;
  } else {
    const resultLabels = { human: 'You won.', ai: `${game.seat_name}'s rule hand won.`, draw: 'The match ended in a draw.', human_resigned: 'The match was ended by the human.' };
    elements.gameStatus.textContent = resultLabels[game.result] || `Match complete: ${game.result}.`;
    elements.gameDetail.textContent = `${game.moves.length} moves · replay artifact ${game.artifact_id ? 'created' : 'pending'} · result preserved, including losses.`;
  }
}

function formatTime(value) {
  if (!value) return 'unknown time';
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

function safeClass(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function artifactURL(path) {
  const value = String(path || '');
  if (value.startsWith('data:')) return value;
  return `/${value.replace(/^\/+/, '')}`;
}

function seatAccent(id) {
  let hash = 0;
  for (const char of String(id)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 82% 68%)`;
}

function syncActionDefaults() {
  const action = elements.actionSelect.value;
  elements.roomSelect.value = actionRoomDefaults[action] || 'commons';
  if (sensitiveActions.has(action)) elements.confirmationInput.checked = true;
  const examples = {
    create_code: 'Avatar work-hand module',
    create_art: 'Living neon glass habitat study',
    inspect_file: 'Selected project manifest',
    run_test: 'Seat bridge state synchronization',
    play_game: 'Connect Four integrity record',
    create_note: 'Lesson from current experiment',
    publish: 'Public-safe habitat build',
    delete_file: 'Obsolete temporary artifact',
    move: 'Visit and inspect the room',
  };
  elements.targetInput.value = examples[action] || 'Visible work item';
  $$('.room').forEach((room) => room.classList.toggle('selected-room', room.dataset.room === elements.roomSelect.value));
}

async function dispatchIntent() {
  elements.consoleMessage.textContent = '';
  const seat = elements.seatSelect.value;
  if (!seat) return;
  const packet = {
    seat,
    action: elements.actionSelect.value,
    destination: elements.roomSelect.value,
    target: elements.targetInput.value.trim() || 'Untitled work item',
    reason: elements.reasonInput.value.trim() || 'No reason supplied',
    requires_confirmation: elements.confirmationInput.checked,
    sensitivity: sensitiveActions.has(elements.actionSelect.value) ? 'high' : 'low',
    requested_tools: [elements.actionSelect.value],
    source: 'habitat_ui_demo',
    executor: 'deterministic_demo_hand',
    demo_autocomplete: true,
  };
  try {
    elements.dispatchButton.disabled = true;
    const action = await api('/api/intent', { method: 'POST', body: JSON.stringify(packet) });
    elements.consoleMessage.textContent = action.status === 'waiting_permission'
      ? 'The request is visible at the Permission Gate.'
      : 'Intent dispatched. Watch the avatar carry the work.';
    playTone(action.status === 'waiting_permission' ? 'warn' : 'soft');
    await loadState();
  } catch (error) {
    elements.consoleMessage.textContent = error.message;
    playTone('bad');
  } finally {
    elements.dispatchButton.disabled = false;
  }
}

async function startScenario(key) {
  try {
    elements.consoleMessage.textContent = 'Starting visible relay…';
    await api('/api/scenario', { method: 'POST', body: JSON.stringify({ scenario: key }) });
    elements.consoleMessage.textContent = 'Relay started. Follow the routes and carried objects.';
    playTone('soft');
    await loadState();
  } catch (error) {
    elements.consoleMessage.textContent = error.message;
    playTone('bad');
  }
}

async function toggleSeat(seatId, currentlyConnected) {
  try {
    await api(`/api/seat/${encodeURIComponent(seatId)}/status`, {
      method: 'POST',
      body: JSON.stringify({
        connected: !currentlyConnected,
        status: !currentlyConnected ? 'idle' : 'offline',
        location: 'commons',
        carrying: null,
        active_action_id: null,
        last_reason: !currentlyConnected ? 'Connected and available for visible local work.' : 'Disconnected by the human.',
        last_evidence: !currentlyConnected ? 'Connected through local UI demo' : 'Disconnected through local UI demo',
      }),
    });
    await loadState();
  } catch (error) {
    elements.consoleMessage.textContent = error.message;
  }
}

async function decidePermission(id, decision) {
  try {
    await api(`/api/permission/${encodeURIComponent(id)}/${decision}`, { method: 'POST', body: '{}' });
    playTone(decision === 'approve' ? 'good' : 'warn');
    await loadState();
  } catch (error) {
    elements.consoleMessage.textContent = error.message;
  }
}

function selectSeat(seatId, center = false) {
  if (selectedSeat !== seatId) expressionPolicyDirty = false;
  selectedSeat = seatId;
  selectedGameSeat = seatId;
  elements.seatSelect.value = seatId;
  elements.gameSeatSelect.value = seatId;
  queueRender();
  if (center) centerSelectedSeat();
}

function centerSelectedSeat() {
  const avatar = elements.avatarLayer.querySelector(`[data-avatar-id="${CSS.escape(selectedSeat)}"]`);
  elements.map.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (avatar) {
    avatar.classList.add('selected-avatar');
    avatar.focus({ preventScroll: true });
  }
}

function chooseRoom(roomId) {
  if (!roomNames[roomId]) return;
  elements.roomSelect.value = roomId;
  $$('.room').forEach((room) => room.classList.toggle('selected-room', room.dataset.room === roomId));
  elements.consoleMessage.textContent = `${roomNames[roomId]} selected. Dispatch when ready; selecting a room alone performs no action.`;
}

async function inviteExpression() {
  if (!selectedSeat || expressionBusy) return;
  expressionBusy = true;
  elements.expressionMessage.textContent = 'Opening an optional invitation…';
  queueRender();
  try {
    const result = await api('/api/expression/invite', {
      method: 'POST',
      body: JSON.stringify({
        seat: selectedSeat,
        category: elements.expressionCategory.value,
        allow_words: elements.expressionWordsToggle.checked,
        demo_autorespond: true,
        source: 'habitat_ui',
        reason: 'Optional invitation from the human-facing Signal Lounge. Silence remains valid.',
      }),
    });
    if (!result.response) {
      elements.expressionMessage.textContent = 'Invitation is open. This bridge seat may answer later—or remain silent.';
    } else if (result.response.mode === 'silent') {
      elements.expressionMessage.textContent = 'The demo choice hand selected silence. No line was invented.';
    } else if (result.response.phrase) {
      elements.expressionMessage.textContent = 'A voluntary demo line was shared and source-labelled.';
      playTone('soft');
    } else {
      elements.expressionMessage.textContent = 'A face-only signal was shared without words.';
    }
    await loadState();
  } catch (error) {
    elements.expressionMessage.textContent = error.message;
    playTone('bad');
  } finally {
    expressionBusy = false;
    queueRender();
  }
}

async function saveExpressionPolicy() {
  if (!selectedSeat || expressionBusy) return;
  expressionBusy = true;
  queueRender();
  try {
    await api(`/api/expression/${encodeURIComponent(selectedSeat)}/policy`, {
      method: 'POST',
      body: JSON.stringify({
        enabled: elements.expressionEnabledToggle.checked,
        show_state_face: elements.expressionStateFacesToggle.checked,
        allow_emoticons: elements.expressionEmoticonsToggle.checked,
        allow_words: elements.expressionWordsToggle.checked,
        allow_silence: elements.expressionSilenceToggle.checked,
      }),
    });
    expressionPolicyDirty = false;
    elements.expressionMessage.textContent = 'Signal policy saved. Permission does not create an obligation to speak.';
    await loadState();
  } catch (error) {
    elements.expressionMessage.textContent = error.message;
  } finally {
    expressionBusy = false;
    queueRender();
  }
}

async function clearExpression() {
  if (!selectedSeat || expressionBusy) return;
  expressionBusy = true;
  queueRender();
  try {
    await api(`/api/expression/${encodeURIComponent(selectedSeat)}/clear`, {
      method: 'POST',
      body: JSON.stringify({ cleared_by: 'human' }),
    });
    elements.expressionMessage.textContent = 'Visible signal cleared. This does not claim the seat chose silence.';
    await loadState();
  } catch (error) {
    elements.expressionMessage.textContent = error.message;
  } finally {
    expressionBusy = false;
    queueRender();
  }
}

function showArtifact(id) {
  const artifact = currentState.artifacts.find((item) => item.id === id);
  if (!artifact) return;
  elements.dialogKind.textContent = `${artifact.kind} · ${roomNames[artifact.room] || artifact.room}`;
  elements.dialogTitle.textContent = artifact.name;
  elements.dialogSummary.textContent = artifact.summary || 'No summary supplied.';
  elements.dialogContent.innerHTML = '';
  if (artifact.kind === 'art' && artifact.path) {
    const img = document.createElement('img');
    img.alt = artifact.name;
    img.src = artifactURL(artifact.path);
    elements.dialogContent.appendChild(img);
  } else {
    const pre = document.createElement('pre');
    pre.textContent = artifact.content || artifact.path || 'No inline content supplied.';
    elements.dialogContent.appendChild(pre);
  }
  elements.dialogProvenance.textContent = JSON.stringify(artifact.provenance || {}, null, 2);
  elements.artifactDialog.showModal();
}

async function startGame() {
  if (!selectedGameSeat || gameBusy) return;
  gameBusy = true;
  queueRender();
  try {
    const game = await api('/api/game/connect4/new', {
      method: 'POST',
      body: JSON.stringify({ seat: selectedGameSeat, first: 'human' }),
    });
    activeGameId = game.id;
    showToast('Game table opened', `${game.seat_name} is visibly seated. You move first.`, 'good');
    playTone('good');
    await loadState();
  } catch (error) {
    showToast('Could not start match', error.message, 'warn');
    playTone('bad');
  } finally {
    gameBusy = false;
    queueRender();
  }
}

async function playColumn(column) {
  if (!activeGameId || gameBusy) return;
  gameBusy = true;
  queueRender();
  try {
    await api(`/api/game/connect4/${encodeURIComponent(activeGameId)}/move`, {
      method: 'POST',
      body: JSON.stringify({ column }),
    });
    playTone('soft');
    await loadState();
  } catch (error) {
    showToast('Move not accepted', error.message, 'warn');
    playTone('bad');
  } finally {
    gameBusy = false;
    queueRender();
  }
}

async function resignGame() {
  if (!activeGameId || gameBusy) return;
  gameBusy = true;
  queueRender();
  try {
    await api(`/api/game/connect4/${encodeURIComponent(activeGameId)}/resign`, { method: 'POST', body: '{}' });
    playTone('warn');
    await loadState();
  } catch (error) {
    showToast('Could not end match', error.message, 'warn');
  } finally {
    gameBusy = false;
    queueRender();
  }
}

function showToast(title, message, tone = 'soft') {
  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`;
  elements.toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

function spawnParticles(roomId, count = 10) {
  if (!ambientEnabled || !elements.map || !elements.fxLayer) return;
  const room = document.querySelector(`[data-room="${CSS.escape(roomId || 'commons')}"]`);
  if (!room) return;
  const mapRect = elements.map.getBoundingClientRect();
  const roomRect = room.getBoundingClientRect();
  const x = roomRect.left - mapRect.left + roomRect.width * .5;
  const y = roomRect.top - mapRect.top + roomRect.height * .55;
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('i');
    particle.className = 'fx-particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    const angle = (Math.PI * 2 * index) / count + Math.random() * .35;
    const distance = 28 + Math.random() * 75;
    particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    elements.fxLayer.appendChild(particle);
    setTimeout(() => particle.remove(), 1300);
  }
}

function updateSoundButton() {
  elements.soundButton.textContent = soundEnabled ? 'Sound on' : 'Sound off';
  elements.soundButton.setAttribute('aria-pressed', String(soundEnabled));
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  storageSet('axm-habitat-sound', soundEnabled ? 'on' : 'off');
  updateSoundButton();
  if (soundEnabled) playTone('good');
}

function playTone(kind = 'soft') {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequencies = { soft: 440, good: 660, warn: 330, bad: 190 };
    oscillator.type = kind === 'bad' ? 'sawtooth' : 'sine';
    oscillator.frequency.value = frequencies[kind] || frequencies.soft;
    gain.gain.setValueAtTime(.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.06, audioContext.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + .18);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + .2);
  } catch {
    soundEnabled = false;
    storageSet('axm-habitat-sound', 'off');
    updateSoundButton();
  }
}

function updateAmbientButton() {
  elements.map.classList.toggle('ambient-on', ambientEnabled);
  elements.ambientButton.classList.toggle('on', ambientEnabled);
  elements.ambientButton.textContent = ambientEnabled ? 'Ambient on' : 'Ambient off';
  elements.ambientButton.setAttribute('aria-pressed', String(ambientEnabled));
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    showToast('Full screen unavailable', error.message, 'warn');
  }
}

elements.seatSelect.addEventListener('change', () => selectSeat(elements.seatSelect.value));
elements.gameSeatSelect.addEventListener('change', () => {
  selectedGameSeat = elements.gameSeatSelect.value;
  selectedSeat = selectedGameSeat;
  activeGameId = '';
  queueRender();
});
elements.actionSelect.addEventListener('change', syncActionDefaults);
elements.roomSelect.addEventListener('change', () => chooseRoom(elements.roomSelect.value));
elements.dispatchButton.addEventListener('click', dispatchIntent);
elements.expressionInviteButton.addEventListener('click', inviteExpression);
elements.expressionPolicyButton.addEventListener('click', saveExpressionPolicy);
elements.expressionClearButton.addEventListener('click', clearExpression);
elements.expressionCategory.addEventListener('change', queueRender);
[
  elements.expressionEnabledToggle,
  elements.expressionStateFacesToggle,
  elements.expressionEmoticonsToggle,
  elements.expressionWordsToggle,
  elements.expressionSilenceToggle,
].forEach((control) => control.addEventListener('change', () => { expressionPolicyDirty = true; queueRender(); }));
elements.newGameButton.addEventListener('click', startGame);
elements.resignGameButton.addEventListener('click', resignGame);
elements.soundButton.addEventListener('click', toggleSound);
elements.fullscreenButton.addEventListener('click', toggleFullscreen);
elements.ambientButton.addEventListener('click', () => {
  ambientEnabled = !ambientEnabled;
  storageSet('axm-habitat-ambient', ambientEnabled ? 'on' : 'off');
  updateAmbientButton();
});
elements.centerSeatButton.addEventListener('click', centerSelectedSeat);
elements.resetButton.addEventListener('click', async () => {
  if (!confirm('Reset the local demo state, games, generated demo artifacts, and proof log?')) return;
  await api('/api/reset', { method: 'POST', body: '{}' });
  activeGameId = '';
  knownProofIds.clear();
  firstStateLoad = true;
  await loadState();
});
elements.dialogClose.addEventListener('click', () => elements.artifactDialog.close());
window.addEventListener('resize', queueRender);
document.addEventListener('fullscreenchange', () => {
  elements.fullscreenButton.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
});

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-seat-toggle]');
  if (toggle) {
    event.stopPropagation();
    toggleSeat(toggle.dataset.seatToggle, toggle.dataset.connected === 'true');
    return;
  }
  const seatFocus = event.target.closest('[data-seat-focus]');
  if (seatFocus) {
    selectSeat(seatFocus.dataset.seatFocus, true);
    return;
  }
  const decision = event.target.closest('[data-permission]');
  if (decision) {
    decidePermission(decision.dataset.permission, decision.dataset.decision);
    return;
  }
  const artifact = event.target.closest('[data-artifact-id]');
  if (artifact) {
    showArtifact(artifact.dataset.artifactId);
    return;
  }
  const scenario = event.target.closest('[data-scenario]');
  if (scenario) {
    startScenario(scenario.dataset.scenario);
    return;
  }
  const column = event.target.closest('[data-game-column]');
  if (column) {
    playColumn(Number(column.dataset.gameColumn));
    return;
  }
  const room = event.target.closest('[data-room]');
  if (room && !event.target.closest('.avatar')) chooseRoom(room.dataset.room);
});

document.addEventListener('keydown', (event) => {
  const seatFocus = event.target.closest?.('[data-seat-focus]');
  if (seatFocus && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    selectSeat(seatFocus.dataset.seatFocus, true);
  }
  const room = event.target.closest?.('[data-room]');
  if (room && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    chooseRoom(room.dataset.room);
  }
});

async function boot() {
  updateSoundButton();
  updateAmbientButton();
  syncActionDefaults();
  await loadState();
  pollTimer = setInterval(loadState, 850);
}

boot();
