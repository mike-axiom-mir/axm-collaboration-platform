(function () {
  'use strict';

  const Core = window.ToonfallCore;
  const $ = id => document.getElementById(id);
  const canvas = $('world');
  const ctx = canvas.getContext('2d');
  const stage3d = window.BloomvaleStage3D || { available: false, render: function () {} };
  const stage = $('stage');
  const query = new URLSearchParams(location.search);
  const actorId = query.get('player') === 'screen' ? 'screen' : 'p1';
  const keys = new Set();
  const pointer = { x: 1120, y: 450, active: false, firing: false };
  const view = { dpr: 1, scale: 1, x: 0, y: 0, cover: false };
  const seenEvents = new Set();
  const particles = [];
  let packet = null;
  let state = null;
  let story = Core.STORY;
  let connected = false;
  let connectionKnown = false;
  let inputSeq = 0;
  let partnerInputSeq = 0;
  let inputSending = false;
  let partnerInputSending = false;
  let fireRequested = false;
  let dashRequested = false;
  let pulseRequested = false;
  let helpPausedGame = false;
  let mapPausedGame = false;
  let interactPadHeld = false;
  let mapPadHeld = false;
  let dashPadHeld = false;
  let pulsePadHeld = false;
  let firePadHeld = false;
  let pausePadHeld = false;
  let aimPadHeld = false;
  let partnerAimPadHeld = false;
  let partnerDashPadHeld = false;
  let partnerPulsePadHeld = false;
  let helpReturnFocus = null;
  let mapReturnFocus = null;
  let autoPausedAway = false;
  let soundEnabled = false;
  const systemMotionPreference = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reducedMotion = !!(systemMotionPreference && systemMotionPreference.matches);
  let motionPreferenceOverridden = false;
  let audio = null;
  let lastShotToneAt = 0;
  let previousPhase = null;
  let previousPaused = null;
  let lastEventId = null;
  let lastServerEventSeq = 0;
  let toastTimer = 0;
  let previousThreatCue = '';
  let lastThreatCueAt = -Infinity;
  let previousBeaconBand = null;
  let beaconHitTimer = 0;

  const scenery = {
    trees: [
      [110,110,1.1],[250,170,.8],[380,120,1],[610,170,.75],[830,110,.9],[1100,160,.8],[1450,130,.9],[1710,120,1],[2070,150,1.05],[2280,110,.85],
      [120,500,.9],[270,650,1.05],[510,560,.8],[750,720,.82],[930,480,.72],[1490,470,.76],[1670,650,.9],[2050,570,1.1],[2280,470,.84],
      [120,960,1],[310,1180,.86],[610,1210,1.08],[850,1040,.78],[1050,1240,.9],[1400,1180,.8],[1580,1010,.76],[1790,1220,.95],[2140,1180,1.08],[2300,990,.84],
      [470,820,.72],[720,320,.68],[1640,300,.72],[1990,760,.78],[1260,1040,.7]
    ],
    flowers: Array.from({ length: 132 }, (_, index) => ({
      x: 90 + ((index * 173) % 2220),
      y: 80 + ((index * 107) % 1190),
      color: ['#fff17a','#ff82ae','#8cf1ff','#c5ff76'][index % 4],
      size: 3 + index % 3
    }))
  };

  function api(path, options) {
    return fetch(path, Object.assign({ headers: { 'content-type': 'application/json' }, cache: 'no-store' }, options || {})).then(async response => {
      const value = await response.json().catch(() => ({ ok: false, error: 'invalid response' }));
      if (!response.ok && response.status !== 409) throw new Error(value.error || 'HTTP ' + response.status);
      return value;
    });
  }

  function announce(message) {
    $('announcer').textContent = message;
  }

  function setConnection(ok) {
    const wasKnown = connectionKnown;
    const wasConnected = connected;
    connectionKnown = true;
    connected = ok;
    const connection = $('connection');
    connection.classList.toggle('ok', ok);
    connection.classList.toggle('warn', !ok);
    connection.setAttribute('aria-label', ok ? 'Local server connected' : 'Local server reconnecting');
    connection.querySelector('span').textContent = ok ? 'LOCAL SERVER' : 'RECONNECTING';
    if (!ok && (!wasKnown || wasConnected)) showToast('LINK PAUSED · Reconnecting to the local server.', 4300);
    if (ok && wasKnown && !wasConnected) showToast('LINK RESTORED · Your run is synchronized.', 3200);
  }

  function spawnParticles(x, y, color, count, speed) {
    if (reducedMotion) count = Math.min(count, 5);
    for (let i = 0; i < count; i += 1) {
      const angle = Math.PI * 2 * i / count + Math.random() * .5;
      const velocity = (speed || 95) * (.5 + Math.random() * .75);
      particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, color, born: performance.now(), life: 420 + Math.random() * 430, size: 3 + Math.random() * 5 });
    }
    if (particles.length > 260) particles.splice(0, particles.length - 260);
  }

  function ensureAudio() {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  function tone(frequency, duration, type, volume, endFrequency) {
    if (!soundEnabled) return;
    const context = ensureAudio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume || .025, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  function showToast(message, holdMs) {
    $('eventToast').textContent = message;
    $('eventToast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('eventToast').classList.remove('show'), holdMs || 2600);
  }

  function signalBeaconHit() {
    document.body.classList.add('heartlight-hit');
    clearTimeout(beaconHitTimer);
    beaconHitTimer = setTimeout(() => document.body.classList.remove('heartlight-hit'), 520);
  }

  function processEvents(events) {
    (events || []).forEach(event => {
      if (seenEvents.has(event.id)) return;
      seenEvents.add(event.id);
      if (seenEvents.size > 180) {
        const keep = Array.from(seenEvents).slice(-100);
        seenEvents.clear(); keep.forEach(id => seenEvents.add(id));
      }
      if (event.id !== lastEventId && !['story-opened','story-step'].includes(event.type)) {
        showToast(event.message, ['npc-met','unlock','district-discovered','activity-complete'].includes(event.type) ? 4300 : 2600);
        lastEventId = event.id;
      }
      if (event.type === 'wave-start') { tone(260, .18, 'square', .035, 520); announce(event.message); }
      if (event.type === 'intermission') { tone(420, .22, 'sine', .035, 680); announce(event.message); }
      if (event.type === 'heartburst') { tone(180, .38, 'sawtooth', .035, 880); announce(event.message); }
      if (event.type === 'beacon-hit') { tone(120, .12, 'square', .025, 70); signalBeaconHit(); }
      if (event.type === 'defender-down') announce(event.message + ' Rebooting in ' + Math.ceil(Core.CONFIG.respawnMs / 1000) + ' seconds.');
      if (event.type === 'defender-return') announce(event.message);
      if (event.type === 'perfect-dodge') { tone(520, .18, 'triangle', .034, 940); announce('Perfect dodge. Prism Counter ready for ' + (Core.CONFIG.prismCounterMs / 1000).toFixed(1) + ' seconds.'); }
      if (event.type === 'prism-counter') { tone(220, .28, 'sawtooth', .038, 1180); announce(event.message); }
      if (event.type === 'counter-hit') { tone(740, .16, 'square', .032, 1220); announce(event.message); }
      if (event.type === 'enemy-popped') tone(380, .07, 'triangle', .018, 630);
      if (event.type === 'wisp-collected') tone(560, .18, 'triangle', .028, 920);
      if (event.type === 'district-discovered') tone(300, .28, 'sine', .03, 720);
      if (event.type === 'npc-met') tone(440, .22, 'triangle', .03, 660);
      if (event.type === 'target-painted') tone(620, .09, 'square', .02, 880);
      if (event.type === 'unlock' || event.type === 'activity-complete') { tone(330, .42, 'triangle', .04, 990); announce(event.message); }
      if (event.type === 'victory') { tone(330, .5, 'triangle', .04, 990); announce(event.message); }
      if (event.type === 'defeat') { tone(220, .55, 'sawtooth', .035, 70); announce(event.message); }
    });
  }

  function acceptPacket(next) {
    if (!next || !next.state) return;
    const firstPacket = packet === null;
    const nextEventSeq = Number(next.state.eventSeq || 0);
    const sessionRestarted = !firstPacket && nextEventSeq < lastServerEventSeq;
    if (sessionRestarted) {
      seenEvents.clear();
      lastEventId = null;
      $('eventToast').textContent = 'A little world made of color.';
      $('eventToast').classList.remove('show');
    }
    packet = next;
    story = next.story || story;
    state = next.state;
    const acceptedInputSeq = Number(state.lastInputSeq) || 0;
    inputSeq = sessionRestarted ? acceptedInputSeq : Math.max(inputSeq, acceptedInputSeq);
    const acceptedPartnerSeq = Number(state.lastInputSeqByActor && state.lastInputSeqByActor.p2) || 0;
    partnerInputSeq = sessionRestarted ? acceptedPartnerSeq : Math.max(partnerInputSeq, acceptedPartnerSeq);
    lastServerEventSeq = nextEventSeq;
    setConnection(true);
    if (firstPacket) (state.events || []).forEach(event => seenEvents.add(event.id));
    else processEvents(state.events);
    renderUi();
  }

  async function poll() {
    try { acceptPacket(await api('/api/state')); }
    catch (_) { setConnection(false); }
  }

  async function action(actionValue) {
    try {
      const next = await api('/api/action', { method: 'POST', body: JSON.stringify({ player: actorId, action: actionValue }) });
      acceptPacket(next);
      return next.actionResult || { ok: true };
    } catch (error) {
      setConnection(false);
      return { ok: false, reason: error.message };
    }
  }

  function storyTitle(text) {
    const words = String(text || '').split(' ');
    const last = words.pop() || '';
    return words.join(' ') + '<br><em>' + last + '</em>';
  }

  function updateStory() {
    if (!state) return;
    const item = story[state.storyStep] || story[0];
    $('storyEyebrow').textContent = item.eyebrow;
    $('storyTitle').innerHTML = storyTitle(item.title);
    $('storyCopy').textContent = item.copy;
    $('storyDots').innerHTML = story.map((_, index) => '<i class="' + (index === state.storyStep ? 'on' : '') + '"></i>').join('');
    $('storyNext').innerHTML = state.storyStep === story.length - 1 ? 'SEE THE MISSION <span>→</span>' : 'CONTINUE STORY <span>→</span>';
  }

  function worldDistance(left, right) {
    return Math.hypot(left.x - right.x, left.y - right.y);
  }

  function unlocked(id) {
    return !!(state && state.exploration && state.exploration.unlockIds.includes(id));
  }

  function nearestToPlayer(items) {
    return (items || []).slice().sort((left, right) => worldDistance(state.player, left) - worldDistance(state.player, right))[0] || null;
  }

  function unlockProgress(item) {
    const exploration = state.exploration;
    const progress = item.progress || { kind: 'unknown', goal: 1, label: 'PROGRESS' };
    let current = 0;
    if (progress.kind === 'npc') current = exploration.metNpcIds.includes(progress.targetId) ? 1 : 0;
    if (progress.kind === 'wisps') current = exploration.collectedWispIds.length;
    if (progress.kind === 'neighbors') current = exploration.metNpcIds.length;
    if (progress.kind === 'districts') current = exploration.visitedDistrictIds.length;
    if (progress.kind === 'targets') current = exploration.paintedTargetIds.length;
    return { current: Math.min(progress.goal, current), goal: progress.goal, label: progress.label };
  }

  function nextRouteTarget() {
    if (!state || !state.exploration) return null;
    const exploration = state.exploration;
    const unmetNpc = () => nearestToPlayer(state.npcs.filter(npc => !exploration.metNpcIds.includes(npc.id)));
    const looseWisp = () => nearestToPlayer(state.colorWisps.filter(wisp => !wisp.collected));
    const openTarget = () => nearestToPlayer(state.practiceTargets.filter(target => !target.painted));
    const newDistrict = () => nearestToPlayer(Core.DISTRICTS.filter(district => !exploration.visitedDistrictIds.includes(district.id)));
    const lockedId = Object.keys(Core.UNLOCKS).find(id => !exploration.unlockIds.includes(id));
    let entity = null;
    let kind = '';
    let label = '';
    if (lockedId === 'field-map') {
      entity = state.npcs.find(npc => npc.id === 'maribel'); kind = 'npc'; label = 'Mayor Maribel';
    } else if (lockedId === 'chroma-reserve') {
      entity = looseWisp(); kind = 'wisp'; label = 'Color wisp';
    } else if (lockedId === 'moxie-overclock' || lockedId === 'heart-pocket') {
      entity = unmetNpc(); kind = 'npc'; label = entity ? entity.name : 'Bloomvale neighbor';
    } else if (lockedId === 'trailblazer-boots') {
      entity = newDistrict(); kind = 'district'; label = entity ? entity.name : 'New district';
    } else if (lockedId === 'prism-paint') {
      entity = openTarget(); kind = 'target'; label = 'Patch’s range bloom';
    }
    if (!entity) { entity = looseWisp(); kind = entity ? 'wisp' : kind; label = entity ? 'Remaining color wisp' : label; }
    if (!entity) { entity = newDistrict(); kind = entity ? 'district' : kind; label = entity ? entity.name : label; }
    if (!entity) { entity = openTarget(); kind = entity ? 'target' : kind; label = entity ? 'Last range bloom' : label; }
    if (!entity && state.wave < Core.CONFIG.waveCounts.length) { entity = state.beacon; kind = 'beacon'; label = 'Heartlight · wave ' + (state.wave + 1); }
    return entity ? { entity, kind, label, markerId: entity.id || kind } : null;
  }

  function routeDirection(route) {
    const dx = route.entity.x - state.player.x;
    const dy = route.entity.y - state.player.y;
    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const directions = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
    const index = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
    const distance = Math.round(Math.hypot(dx, dy) / 10) * 10;
    return { arrow: arrows[index], direction: directions[index], distance: distance < 150 ? 'NEARBY' : distance + ' PACES' };
  }

  function renderExploration() {
    const active = state.phase === Core.PHASES.EXPLORE;
    $('explorePanel').hidden = !active;
    const exploration = state.exploration;
    const district = Core.DISTRICTS.find(item => item.id === exploration.currentDistrictId) || Core.DISTRICTS[0];
    $('districtName').textContent = district.name;
    $('districtProgress').textContent = exploration.visitedDistrictIds.length + '/' + Core.DISTRICTS.length;
    $('neighborProgress').textContent = exploration.metNpcIds.length + '/' + Core.NPCS.length;
    $('wispProgress').textContent = exploration.collectedWispIds.length + '/' + Core.COLOR_WISPS.length;
    $('unlockProgress').textContent = exploration.unlockIds.length + '/' + Object.keys(Core.UNLOCKS).length;
    const prompt = $('interactionPrompt');
    const nearestNpc = state.npcs.slice().sort((a, b) => worldDistance(state.player, a) - worldDistance(state.player, b))[0];
    const nearestTarget = state.practiceTargets.filter(item => !item.painted).sort((a, b) => worldDistance(state.player, a) - worldDistance(state.player, b))[0];
    let key = 'M';
    let copy = unlocked('field-map') ? 'Open Maribel’s field map' : 'Meet Mayor Maribel east of the Heartlight';
    if (nearestNpc && worldDistance(state.player, nearestNpc) <= 145) {
      key = 'F'; copy = (exploration.metNpcIds.includes(nearestNpc.id) ? 'Talk with ' : 'Meet ') + nearestNpc.name;
    } else if (worldDistance(state.player, state.beacon) <= 195 && state.wave < Core.CONFIG.waveCounts.length) {
      key = 'F'; copy = 'Begin defense wave ' + (state.wave + 1) + ' of ' + Core.CONFIG.waveCounts.length;
    } else if (nearestTarget && worldDistance(state.player, nearestTarget) <= 260) {
      key = 'FIRE'; copy = 'Paint Patch’s range blooms · ' + exploration.paintedTargetIds.length + '/' + Core.PRACTICE_TARGETS.length;
    }
    prompt.querySelector('kbd').textContent = key;
    prompt.querySelector('span').textContent = copy;
    const route = nextRouteTarget();
    $('wayfinder').hidden = !route;
    if (route) {
      const heading = routeDirection(route);
      $('wayfinderArrow').textContent = heading.arrow;
      $('wayfinderLabel').textContent = route.label;
      $('wayfinderDistance').textContent = heading.distance;
      $('wayfinder').dataset.kind = route.kind;
      $('wayfinder').setAttribute('aria-label', 'Next lead: ' + route.label + ', ' + heading.distance.toLowerCase() + ' ' + heading.direction);
    }
    $('mapButton').textContent = unlocked('field-map') ? 'FIELD MAP' : 'MAP LOCKED';
    $('mapButton').setAttribute('aria-disabled', unlocked('field-map') ? 'false' : 'true');
  }

  function mapMarker(type, x, y, label, extra) {
    const safeX = Math.max(35, Math.min(Core.CONFIG.worldWidth - 35, Number(x) || 0));
    const safeY = Math.max(35, Math.min(Core.CONFIG.worldHeight - 35, Number(y) || 0));
    const haloRadius = type === 'district' ? 54 : type === 'player' ? 48 : type === 'wisp' || type === 'npc' ? 0 : 34;
    const coreRadius = type === 'district' ? 30 : type === 'player' ? 24 : type === 'wisp' ? 10 : 18;
    const labelY = type === 'npc' ? -28 : type === 'player' ? -38 : type === 'district' ? 68 : 52;
    return '<g class="map-marker ' + type + (extra ? ' ' + extra : '') + '" transform="translate(' + safeX.toFixed(1) + ' ' + safeY.toFixed(1) + ')"><circle class="marker-halo" r="' + haloRadius + '"></circle><circle class="marker-core" r="' + coreRadius + '"></circle>' + (label ? '<text y="' + labelY + '" text-anchor="middle">' + label + '</text>' : '') + '</g>';
  }

  function renderMap() {
    if (!state || !state.exploration) return;
    const exploration = state.exploration;
    const route = nextRouteTarget();
    const routeClass = (kind, id) => route && route.kind === kind && route.markerId === id ? ' route' : '';
    let markers = Core.DISTRICTS.map(district => mapMarker('district', district.x, district.y, district.name, (exploration.visitedDistrictIds.includes(district.id) ? 'visited' : 'unknown') + routeClass('district', district.id))).join('');
    markers += state.npcs.map(npc => mapMarker('npc', npc.x, npc.y, npc.name, (exploration.metNpcIds.includes(npc.id) ? 'met' : '') + routeClass('npc', npc.id))).join('');
    markers += state.colorWisps.filter(wisp => !wisp.collected).map(wisp => mapMarker('wisp', wisp.x, wisp.y, '', routeClass('wisp', wisp.id))).join('');
    markers += mapMarker('range', 1880, 1050, 'Patch’s Range', (exploration.paintedTargetIds.length >= 5 ? 'complete' : '') + (route && route.kind === 'target' ? ' route' : ''));
    markers += mapMarker('player', state.player.x, state.player.y, 'YOU', '');
    $('mapSurface').innerHTML = '<svg class="map-svg" viewBox="0 0 ' + Core.CONFIG.worldWidth + ' ' + Core.CONFIG.worldHeight + '" role="img" aria-label="Bloomvale map markers">' + markers + '</svg>';
    const routeCopy = route ? ' · NEXT: ' + route.label + ' · ' + routeDirection(route).distance : '';
    $('mapSummary').textContent = exploration.visitedDistrictIds.length + ' places · ' + exploration.metNpcIds.length + ' people · ' + exploration.collectedWispIds.length + ' wisps · ' + exploration.paintedTargetIds.length + ' targets' + routeCopy;
    $('unlockList').innerHTML = Object.entries(Core.UNLOCKS).map(([id, item]) => {
      const progress = unlockProgress(item);
      const complete = exploration.unlockIds.includes(id);
      return '<div class="' + (complete ? 'unlocked' : 'locked') + '"><span>' + (complete ? 'UNLOCKED' : 'LOCKED') + '</span><b>' + item.name + '</b><small>' + item.description + '</small><em>' + (complete ? 'COMPLETE' : progress.current + ' / ' + progress.goal + ' · ' + progress.label) + '</em></div>';
    }).join('');
  }

  function playerIsDown(current) {
    return !!(current && current.player && Number(current.player.health) <= 0 && Number(current.player.downUntil || 0) > Number(current.now || 0));
  }

  function playerControlsOnline(current) {
    return !!(current && !current.paused && !playerIsDown(current) && [Core.PHASES.EXPLORE, Core.PHASES.WAVE, Core.PHASES.INTERMISSION].includes(current.phase));
  }

  function objectiveFor(current) {
    if (!current) return 'Connecting to Bloomvale';
    if (current.phase === Core.PHASES.STORY) return story[current.storyStep].title;
    if (current.phase === Core.PHASES.BRIEFING) return 'Ready the Gatewatch team';
    if (current.phase === Core.PHASES.EXPLORE) {
      const route = nextRouteTarget();
      if (!route) return 'Bloomvale explored · return to the Heartlight';
      const heading = routeDirection(route);
      const verb = route.kind === 'beacon' ? 'Return to' : route.kind === 'npc' ? 'Find' : route.kind === 'wisp' ? 'Gather' : route.kind === 'target' ? 'Paint' : 'Explore';
      return verb + ' ' + route.label + ' · ' + heading.distance.toLowerCase();
    }
    if (current.phase === Core.PHASES.WAVE) {
      const percent = Math.round(current.beacon.health / current.beacon.maxHealth * 100);
      const playerReboot = Math.max(0, Number(current.player.downUntil || 0) - Number(current.now || 0));
      const allyReboot = Math.max(0, Number(current.ally.downUntil || 0) - Number(current.now || 0));
      if (playerReboot > 0 && allyReboot > 0) return 'Gatewatch rebooting · ' + Math.ceil(Math.max(playerReboot, allyReboot) / 1000) + 's · Heartlight ' + percent + '%';
      if (playerReboot > 0) return 'Pippa rebooting · ' + Math.ceil(playerReboot / 1000) + 's · Heartlight ' + percent + '%';
      if (allyReboot > 0) return 'Moxie rebooting · ' + Math.ceil(allyReboot / 1000) + 's · Heartlight ' + percent + '%';
      if (percent <= 40) return 'Heartlight critical · ' + percent + '% · ' + current.enemies.length + ' threats';
      if (percent <= 65) return 'Heartlight under attack · ' + percent + '% · ' + current.enemies.length + ' threats';
      const watch = Core.WAVE_CHRONICLE[current.wave - 1];
      return 'Clear ' + watch.title + ' · ' + current.enemies.length + ' in the arena';
    }
    if (current.phase === Core.PHASES.INTERMISSION) return 'Regroup · next watch incoming';
    return current.result ? current.result.title : 'Mission complete';
  }

  function focusSoon(element) {
    if (!element) return;
    requestAnimationFrame(() => {
      if (!element.isConnected || element.hidden) return;
      try { element.focus({ preventScroll: true }); } catch (_) { element.focus(); }
    });
  }

  function activeDialog() {
    return ['mapOverlay', 'helpPanel', 'pauseOverlay', 'resultOverlay', 'briefingOverlay', 'storyOverlay']
      .map($)
      .find(element => element && !element.hidden) || null;
  }

  function syncModalIsolation() {
    const dialog = activeDialog();
    Array.from(stage.children).forEach(element => {
      element.inert = !!dialog && element !== dialog;
    });
    document.querySelector('.team-rail').inert = !!dialog;
  }

  function trapModalFocus(event) {
    if (event.key !== 'Tab') return false;
    const dialog = activeDialog();
    if (!dialog) return false;
    const controls = Array.from(dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
    if (!controls.length) return false;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return true;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function latestDefenderHit(targetId) {
    if (!state) return null;
    return (state.effects || []).slice().reverse().find(effect => {
      const age = state.now - Number(effect.at || 0);
      return effect.type === 'defender-hit' && effect.targetId === targetId && age >= 0 && age < 900;
    }) || null;
  }

  function latestDefenderReturn(targetId) {
    if (!state) return null;
    return (state.events || []).slice().reverse().find(event => {
      const age = state.now - Number(event.at || 0);
      return event.type === 'defender-return' && event.detail && event.detail.id === targetId && age >= 0 && age < 1400;
    }) || null;
  }

  function bearingLabel(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 1) return 'nearby';
    const labels = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
    const sector = Math.round((Math.atan2(dy, dx) + Math.PI * 2) / (Math.PI / 4)) % 8;
    return labels[sector];
  }

  function renderHealth(entity, barId, meterId, textId, cardId, stateId, label) {
    const maximum = Math.max(1, Number(entity.maxHealth) || 100);
    const current = Math.max(0, Math.min(maximum, Number(entity.health) || 0));
    const percent = Math.max(0, Math.min(100, current / maximum * 100));
    const rebootMs = Math.max(0, Number(entity.downUntil || 0) - Number(state.now || 0));
    const rebooting = current <= 0 && rebootMs > 0;
    const recentHit = rebooting ? null : latestDefenderHit(entity.id);
    const recentReturn = rebooting ? null : latestDefenderReturn(entity.id);
    const meter = $(meterId);
    const card = $(cardId);
    const stateLabel = $(stateId);
    card.classList.toggle('is-downed', rebooting);
    card.classList.toggle('is-hit', !!recentHit);
    card.classList.toggle('is-returned', !!recentReturn);
    stateLabel.hidden = !rebooting && !recentReturn;
    if (rebooting) {
      const seconds = Math.max(1, Math.ceil(rebootMs / 1000));
      const rebootProgress = Math.max(0, Math.min(100, (Core.CONFIG.respawnMs - rebootMs) / Core.CONFIG.respawnMs * 100));
      $(barId).style.width = rebootProgress + '%';
      $(textId).textContent = seconds + 's';
      stateLabel.textContent = 'REBOOT ' + seconds + 's';
      meter.setAttribute('aria-label', label + ' reboot progress');
      meter.setAttribute('aria-valuemax', String(Core.CONFIG.respawnMs));
      meter.setAttribute('aria-valuenow', String(Math.round(Core.CONFIG.respawnMs - rebootMs)));
      meter.setAttribute('aria-valuetext', 'Rebooting, ' + seconds + (seconds === 1 ? ' second' : ' seconds') + ' remaining');
      return;
    }
    if (recentReturn) stateLabel.textContent = 'BACK ONLINE';
    $(barId).style.width = percent + '%';
    $(textId).textContent = Math.round(current);
    meter.setAttribute('aria-label', label + ' health');
    meter.setAttribute('aria-valuemax', String(Math.round(maximum)));
    meter.setAttribute('aria-valuenow', String(Math.round(current)));
    const direction = recentHit ? bearingLabel(recentHit.sourceX - entity.x, recentHit.sourceY - entity.y) : '';
    meter.setAttribute('aria-valuetext', Math.round(current) + ' of ' + Math.round(maximum) + (recentHit ? ', hit from ' + direction : recentReturn ? ', back online' : ''));
  }

  function renderUi() {
    if (!state) return;
    document.body.dataset.phase = state.phase;
    stage.dataset.phase = state.phase;
    $('objective').textContent = objectiveFor(state);
    const activeWatch = Core.WAVE_CHRONICLE[Math.max(0, Math.min(Core.WAVE_CHRONICLE.length - 1, state.phase === Core.PHASES.EXPLORE ? state.wave : state.wave - 1))];
    $('waveValue').textContent = state.phase === Core.PHASES.WAVE || state.phase === Core.PHASES.INTERMISSION ? state.wave + ' / ' + Core.WAVE_CHRONICLE.length : state.phase === Core.PHASES.EXPLORE ? 'OPEN' : state.phase.toUpperCase();
    $('enemyValue').textContent = state.phase === Core.PHASES.EXPLORE ? 'Next · ' + activeWatch.title : state.phase === Core.PHASES.WAVE ? activeWatch.title + ' · ' + state.enemies.length + (state.enemies.length === 1 ? ' threat' : ' threats') : state.enemies.length + (state.enemies.length === 1 ? ' threat' : ' threats');
    const beaconPercent = Math.round(state.beacon.health / state.beacon.maxHealth * 100);
    const beaconBand = beaconPercent <= 40 ? 'critical' : beaconPercent <= 65 ? 'danger' : 'stable';
    const beaconCard = $('beaconCard');
    $('beaconValue').textContent = beaconPercent + '%';
    $('beaconBar').style.width = beaconPercent + '%';
    $('beaconState').textContent = beaconBand === 'critical' ? 'CRITICAL' : beaconBand === 'danger' ? 'UNDER ATTACK' : 'STABLE';
    beaconCard.classList.toggle('is-danger', beaconBand === 'danger');
    beaconCard.classList.toggle('is-critical', beaconBand === 'critical');
    beaconCard.setAttribute('aria-valuenow', String(beaconPercent));
    beaconCard.setAttribute('aria-valuetext', beaconPercent + ' percent, ' + (beaconBand === 'danger' ? 'under attack' : beaconBand));
    const activeDanger = state.phase === Core.PHASES.WAVE && beaconBand !== 'stable';
    document.body.classList.toggle('heartlight-danger', activeDanger && beaconBand === 'danger');
    document.body.classList.toggle('heartlight-critical', activeDanger && beaconBand === 'critical');
    if (beaconBand !== previousBeaconBand) {
      const recovered = previousBeaconBand && previousBeaconBand !== 'stable' && beaconBand === 'stable';
      $('beaconAnnouncer').textContent = state.phase === Core.PHASES.WAVE && beaconBand === 'critical'
        ? 'Heartlight critical at ' + beaconPercent + ' percent.'
        : state.phase === Core.PHASES.WAVE && beaconBand === 'danger'
          ? 'Heartlight under attack at ' + beaconPercent + ' percent.'
          : recovered ? 'Heartlight stabilized at ' + beaconPercent + ' percent.' : '';
      previousBeaconBand = beaconBand;
    }
    $('scoreValue').textContent = String(state.score).padStart(6, '0');
    $('comboValue').textContent = state.combo > 1 ? '×' + state.combo + ' color combo' : 'combo ready';
    $('playerName').textContent = state.player.name;
    $('allyName').textContent = state.ally.name;
    $('allyKind').textContent = (state.ally.kind === 'human' ? 'HUMAN' : state.ally.kind === 'adapter' ? 'CONNECTED AI' : 'IN-GAME AI') + ' · DEFENSE PARTNER';
    $('teamTruth').textContent = 'Seat 1 Human // Seat 2 ' + (state.truth.partnerMode === 'connected-ai' ? 'Connected AI' : state.truth.partnerMode === 'human' ? 'Human' : 'In-game AI') + ' // shared local screen';
    renderHealth(state.player, 'playerHealth', 'playerHealthMeter', 'playerHealthText', 'playerCard', 'playerState', state.player.name);
    renderHealth(state.ally, 'allyHealth', 'allyHealthMeter', 'allyHealthText', 'allyCard', 'allyState', state.ally.name);
    const dashSeconds = Math.max(0, (state.dashReadyAt - state.now) / 1000);
    const pulseSeconds = Math.max(0, (state.pulseReadyAt - state.now) / 1000);
    const counterSeconds = Math.max(0, (Number(state.counterReadyUntil) - state.now) / 1000);
    const counterActive = counterSeconds > 0;
    const recentCounterHit = (state.effects || []).slice().reverse().find(effect => effect.type === 'counter-hit' && state.now - effect.at >= 0 && state.now - effect.at < 1800) || null;
    const scoutKitOffline = playerIsDown(state);
    $('abilityCard').classList.toggle('is-offline', scoutKitOffline);
    $('abilityCard').classList.toggle('is-counter', counterActive && !scoutKitOffline);
    $('abilityCard').classList.toggle('is-counter-hit', !!recentCounterHit && !counterActive && !scoutKitOffline);
    $('abilityCard').style.setProperty('--counter-progress', String(Math.max(0, Math.min(1, counterSeconds * 1000 / Core.CONFIG.prismCounterMs))));
    $('abilityCard').setAttribute('aria-label', scoutKitOffline
      ? 'Scout kit offline while Pippa reboots'
      : counterActive ? 'Prism Counter ready for ' + counterSeconds.toFixed(1) + ' seconds. Next shot deals double damage.'
        : recentCounterHit ? 'Prism Counter hit for ' + recentCounterHit.damage + ' damage.' : 'Scout kit status');
    $('abilityLabel').textContent = scoutKitOffline
      ? 'SCOUT KIT · REBOOTING'
      : counterActive ? 'PRISM COUNTER · ' + counterSeconds.toFixed(1) + 's'
        : recentCounterHit ? 'COUNTER HIT · ' + recentCounterHit.damage : 'SCOUT KIT';
    $('dashReady').className = scoutKitOffline ? 'offline' : dashSeconds <= 0 ? 'ready' : 'cooling';
    $('pulseReady').className = scoutKitOffline ? 'offline' : pulseSeconds <= 0 ? 'ready' : 'cooling';
    $('dashReady').innerHTML = '<kbd>SHIFT</kbd> ' + (scoutKitOffline ? 'DASH OFFLINE' : dashSeconds <= 0 ? 'DASH READY' : dashSeconds.toFixed(1) + 's');
    $('pulseReady').innerHTML = '<kbd>E</kbd> ' + (scoutKitOffline ? 'BURST OFFLINE' : pulseSeconds <= 0 ? 'BURST READY' : pulseSeconds.toFixed(1) + 's');
    $('storyOverlay').hidden = state.phase !== Core.PHASES.STORY;
    $('briefingOverlay').hidden = state.phase !== Core.PHASES.BRIEFING;
    $('resultOverlay').hidden = ![Core.PHASES.VICTORY, Core.PHASES.DEFEAT].includes(state.phase);
    $('pauseOverlay').hidden = !state.paused || !$('helpPanel').hidden || !$('mapOverlay').hidden;
    $('aimNote').hidden = ![Core.PHASES.WAVE, Core.PHASES.INTERMISSION].includes(state.phase);
    syncModalIsolation();
    renderExploration();
    if (!$('mapOverlay').hidden) renderMap();
    if (state.phase === Core.PHASES.STORY) updateStory();
    if ([Core.PHASES.VICTORY, Core.PHASES.DEFEAT].includes(state.phase) && state.result) {
      const victory = state.phase === Core.PHASES.VICTORY;
      $('resultEyebrow').textContent = victory ? 'GATEWATCH COMPLETE' : 'THE HEARTLIGHT FLICKERED';
      $('resultTitle').innerHTML = victory ? 'Bloomvale stays <em>bright!</em>' : 'The page went <em>quiet.</em>';
      $('resultCopy').textContent = victory ? 'Pippa and Moxie kept the page alive—and brought home everything they discovered.' : 'The Game Night run is recoverable. Explore, unlock upgrades, and return stronger.';
      $('resultOverlay').querySelector('.result-card').classList.toggle('defeat', !victory);
      $('resultStats').innerHTML = [
        [state.result.score, 'SCORE'],[state.result.kills, 'SMUDGES'],[(state.result.chronicle && state.result.chronicle.clearedWatchIds.length || 0) + '/' + Core.WAVE_CHRONICLE.length, 'WATCHES'],[(state.result.unlocks || 0) + '/' + Object.keys(Core.UNLOCKS).length, 'UNLOCKS']
      ].map(value => '<div><b>' + value[0] + '</b><small>' + value[1] + '</small></div>').join('');
    }
    if (previousPhase !== state.phase) {
      previousPhase = state.phase;
      announce(objectiveFor(state));
      if ($('helpPanel').hidden && $('mapOverlay').hidden && !state.paused) {
        if (state.phase === Core.PHASES.STORY) focusSoon($('storyNext'));
        if (state.phase === Core.PHASES.BRIEFING) focusSoon($('startButton'));
        if (state.phase === Core.PHASES.EXPLORE || state.phase === Core.PHASES.WAVE || state.phase === Core.PHASES.INTERMISSION) focusSoon(canvas);
        if (state.phase === Core.PHASES.VICTORY || state.phase === Core.PHASES.DEFEAT) focusSoon($('restartButton'));
      }
    }
    if (previousPaused !== state.paused) {
      previousPaused = state.paused;
      if (state.paused && $('helpPanel').hidden && $('mapOverlay').hidden) focusSoon($('resumeButton'));
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * view.dpr));
    const height = Math.max(1, Math.round(rect.height * view.dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const fitScale = Math.min(width / Core.CONFIG.worldWidth, height / Core.CONFIG.worldHeight);
    const coverScale = Math.max(width / Core.CONFIG.worldWidth, height / Core.CONFIG.worldHeight);
    const explorationScale = .8 * view.dpr;
    view.cover = width / height < 1.2 || fitScale < explorationScale;
    view.scale = view.cover ? Math.max(coverScale, explorationScale) : fitScale;
    if (view.cover && state && state.player) {
      view.x = Math.max(width - Core.CONFIG.worldWidth * view.scale, Math.min(0, width / 2 - state.player.x * view.scale));
      view.y = Math.max(height - Core.CONFIG.worldHeight * view.scale, Math.min(0, height / 2 - state.player.y * view.scale));
    } else {
      view.x = (width - Core.CONFIG.worldWidth * view.scale) / 2;
      view.y = (height - Core.CONFIG.worldHeight * view.scale) / 2;
    }
  }

  function worldPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const px = (event.clientX - rect.left) * view.dpr;
    const py = (event.clientY - rect.top) * view.dpr;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y); context.lineTo(x + width - r, y); context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r); context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height); context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r); context.quadraticCurveTo(x, y, x + r, y); context.closePath();
  }

  function ellipse(x, y, rx, ry, fill, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawTree(x, y, scale) {
    ellipse(x + 7 * scale, y + 19 * scale, 25 * scale, 10 * scale, '#132849', .2);
    ctx.lineWidth = 5 * scale; ctx.strokeStyle = '#342b56'; ctx.fillStyle = '#9d633e';
    roundedRect(ctx, x - 7 * scale, y - 5 * scale, 14 * scale, 35 * scale, 6 * scale); ctx.fill(); ctx.stroke();
    [['#2c9f67',-15,-8,22],['#54c872',12,-7,25],['#86dc75',0,-27,25]].forEach(part => {
      ctx.fillStyle = part[0]; ctx.strokeStyle = '#2f2855'; ctx.lineWidth = 5 * scale; ctx.beginPath(); ctx.arc(x + part[1] * scale, y + part[2] * scale, part[3] * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ellipse(x - 7 * scale, y - 38 * scale, 7 * scale, 4 * scale, '#d8ff94', .7);
  }

  function drawCottage(x, y, color) {
    ellipse(x + 8, y + 34, 62, 18, '#183258', .18);
    ctx.fillStyle = '#f8e2a9'; ctx.strokeStyle = '#3b2c58'; ctx.lineWidth = 6; roundedRect(ctx, x - 48, y - 28, 96, 70, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 62, y - 22); ctx.lineTo(x, y - 72); ctx.lineTo(x + 62, y - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#75d7e8'; ctx.fillRect(x - 33, y - 5, 22, 23); ctx.strokeRect(x - 33, y - 5, 22, 23);
    ctx.fillStyle = '#7c4b45'; roundedRect(ctx, x + 9, y - 3, 25, 45, 8); ctx.fill(); ctx.stroke();
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, Core.CONFIG.worldHeight);
    if (stage3d.available) {
      gradient.addColorStop(0, 'rgba(145,229,194,.48)'); gradient.addColorStop(.5, 'rgba(102,203,145,.42)'); gradient.addColorStop(1, 'rgba(62,166,123,.48)');
    } else {
      gradient.addColorStop(0, '#91e5c2'); gradient.addColorStop(.5, '#66cb91'); gradient.addColorStop(1, '#3ea67b');
    }
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, Core.CONFIG.worldWidth, Core.CONFIG.worldHeight);
    Core.DISTRICTS.forEach(district => {
      ctx.save(); ctx.globalAlpha = .24; ctx.fillStyle = district.color; ctx.beginPath(); ctx.ellipse(district.x, district.y, district.radius * 1.12, district.radius * .78, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    function road(points) {
      ctx.strokeStyle = '#efd78d'; ctx.lineWidth = 82; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
      for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index][0], points[index][1]);
      ctx.stroke(); ctx.strokeStyle = '#fff0b4'; ctx.lineWidth = 6; ctx.setLineDash([13,17]); ctx.stroke(); ctx.setLineDash([]);
    }
    road([[180,265],[470,335],[820,470],[1200,675],[1580,480],[1940,350],[2260,270]]);
    road([[300,1210],[475,1050],[820,900],[1200,675],[1550,900],[1880,1050],[2190,1210]]);
    road([[1200,120],[1200,675],[1210,1220]]);
    ctx.strokeStyle = '#65d5df'; ctx.lineWidth = 62; ctx.beginPath(); ctx.moveTo(-40, 880); ctx.bezierCurveTo(420, 760, 610, 1120, 1080, 980); ctx.bezierCurveTo(1510, 850, 1770, 1100, 2440, 845); ctx.stroke();
    ctx.strokeStyle = '#b9f5ed'; ctx.lineWidth = 5; ctx.globalAlpha = .7; ctx.stroke(); ctx.globalAlpha = 1;
    scenery.flowers.forEach(flower => {
      if (Math.hypot(flower.x - 1200, flower.y - 675) < 130) return;
      ctx.fillStyle = flower.color; ctx.beginPath();
      for (let leaf = 0; leaf < 4; leaf++) {
        const angle = leaf * Math.PI / 2 + time * .0002;
        ctx.moveTo(flower.x, flower.y); ctx.arc(flower.x + Math.cos(angle) * flower.size, flower.y + Math.sin(angle) * flower.size, flower.size, 0, Math.PI * 2);
      }
      ctx.fill();
    });
    drawCottage(300, 355, '#ff7898'); drawCottage(610, 250, '#ffd35f');
    drawCottage(1810, 285, '#66d9e8'); drawCottage(2120, 465, '#73b8ff');
    drawCottage(330, 1035, '#ff8fbd'); drawCottage(650, 1135, '#f79bd4');
    drawCottage(1700, 1105, '#a98aff'); drawCottage(2110, 1010, '#8069e8');
    scenery.trees.forEach(tree => drawTree(tree[0], tree[1], tree[2]));
    ctx.save(); ctx.textAlign = 'center'; ctx.font = '800 20px Bahnschrift, sans-serif'; ctx.letterSpacing = '2px';
    Core.DISTRICTS.forEach(district => {
      ctx.globalAlpha = .34; ctx.fillStyle = '#102c3b'; ctx.fillText(district.name.toUpperCase(), district.x, district.y - district.radius * .55);
    });
    ctx.restore();
    const cloudOffset = reducedMotion ? 0 : (time * .018) % 2700;
    for (let c = 0; c < 6; c++) {
      const x = ((c * 510 + cloudOffset) % 2700) - 150;
      ellipse(x, 65 + c % 2 * 80, 68, 25, '#ffffff', .13);
      ellipse(x + 45, 58 + c % 2 * 80, 44, 31, '#ffffff', .12);
    }
    ctx.strokeStyle = 'rgba(30,71,84,.22)'; ctx.lineWidth = 16; roundedRect(ctx, 16, 16, Core.CONFIG.worldWidth - 32, Core.CONFIG.worldHeight - 32, 55); ctx.stroke();
  }

  function drawBeacon(beacon, time) {
    const pulse = reducedMotion ? 0 : Math.sin(time / 350) * 5;
    ellipse(beacon.x + 8, beacon.y + 42, 74, 27, '#132b56', .25);
    ctx.fillStyle = '#493679'; ctx.strokeStyle = '#2d2253'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(beacon.x - 62, beacon.y + 35); ctx.lineTo(beacon.x - 38, beacon.y - 22); ctx.lineTo(beacon.x + 38, beacon.y - 22); ctx.lineTo(beacon.x + 62, beacon.y + 35); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.shadowColor = '#74f4ff'; ctx.shadowBlur = 35 + pulse;
    const gradient = ctx.createRadialGradient(beacon.x - 10, beacon.y - 35, 8, beacon.x, beacon.y - 18, 55 + pulse);
    gradient.addColorStop(0, '#fffbd2'); gradient.addColorStop(.42, '#d9ff78'); gradient.addColorStop(1, '#5cecff');
    ctx.fillStyle = gradient; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath();
    ctx.moveTo(beacon.x, beacon.y - 74 - pulse); ctx.bezierCurveTo(beacon.x + 54, beacon.y - 62, beacon.x + 60, beacon.y - 10, beacon.x, beacon.y + 8); ctx.bezierCurveTo(beacon.x - 60, beacon.y - 10, beacon.x - 54, beacon.y - 62, beacon.x, beacon.y - 74 - pulse); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(beacon.x - 14, beacon.y - 40, 7, 0, Math.PI * 2); ctx.fill();
  }

  function drawHealthBar(entity, width) {
    if (entity.health >= entity.maxHealth) return;
    const x = entity.x - width / 2, y = entity.y - entity.radius - 21;
    ctx.fillStyle = '#221b42cc'; roundedRect(ctx, x, y, width, 7, 4); ctx.fill();
    ctx.fillStyle = entity.health / entity.maxHealth < .35 ? '#ff5d72' : '#b9f76d'; roundedRect(ctx, x + 1, y + 1, Math.max(0, (width - 2) * entity.health / entity.maxHealth), 5, 3); ctx.fill();
  }

  function drawPippa(entity, time) {
    const moving = Math.hypot(entity.vx, entity.vy) > 5;
    const bob = reducedMotion ? 0 : Math.sin(time / 100 + entity.x) * (moving ? 4 : 2);
    const angle = Math.atan2(entity.facingY, entity.facingX);
    const counterRemaining = state ? Math.max(0, Number(state.counterReadyUntil) - state.now) : 0;
    if (counterRemaining > 0) {
      const life = Math.max(0, Math.min(1, counterRemaining / Core.CONFIG.prismCounterMs));
      const orbit = reducedMotion ? 0 : time / 260;
      const radius = reducedMotion ? 39 : 39 + Math.sin(time / 95) * 2;
      ctx.save();
      ctx.translate(entity.x, entity.y + bob);
      ctx.rotate(orbit);
      ctx.strokeStyle = '#d7ff72'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.shadowColor = '#56f3ff'; ctx.shadowBlur = 18;
      ctx.globalAlpha = .5 + life * .45;
      ctx.beginPath(); ctx.arc(0, 0, radius, -.18, Math.PI * .74); ctx.stroke();
      ctx.strokeStyle = '#79eaff';
      ctx.beginPath(); ctx.arc(0, 0, radius, Math.PI - .18, Math.PI * 1.74); ctx.stroke();
      ctx.restore();
    }
    ellipse(entity.x + 8, entity.y + 24, 30, 12, '#172447', .28);
    ctx.save(); ctx.translate(entity.x, entity.y + bob); ctx.rotate(angle);
    ctx.strokeStyle = '#302253'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const stride = reducedMotion ? 0 : Math.sin(time / 75) * (moving ? 8 : 2);
    ctx.beginPath(); ctx.moveTo(-7,16); ctx.lineTo(-13,30 + stride); ctx.moveTo(7,16); ctx.lineTo(13,30 - stride); ctx.stroke();
    ctx.fillStyle = entity.color; ctx.beginPath(); ctx.ellipse(0, 4, 22, 25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff2c8'; ctx.beginPath(); ctx.arc(2, -22, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#37265f'; ctx.beginPath(); ctx.arc(-6, -24, 3.5, 0, Math.PI * 2); ctx.arc(8, -24, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff719d'; ctx.beginPath(); ctx.moveTo(-19,-31); ctx.quadraticCurveTo(1,-51,21,-31); ctx.lineTo(14,-40); ctx.quadraticCurveTo(-1,-54,-18,-39); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f4fbff'; roundedRect(ctx, 16, -3, 34, 13, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#63efff'; ctx.fillRect(42, 0, 17, 6); ctx.restore();
    if (entity.downUntil > (state && state.now || 0)) { ctx.fillStyle = '#302253'; ctx.font = '900 18px ui-monospace'; ctx.textAlign = 'center'; ctx.fillText('REBOOT ' + Math.ceil((entity.downUntil - state.now) / 1000), entity.x, entity.y - 52); }
    drawHealthBar(entity, 56);
  }

  function drawMoxie(entity, time) {
    const bob = reducedMotion ? 0 : Math.sin(time / 180) * 6;
    const angle = Math.atan2(entity.facingY, entity.facingX);
    ellipse(entity.x + 6, entity.y + 25, 27, 11, '#172447', .24);
    ctx.save(); ctx.translate(entity.x, entity.y + bob); ctx.rotate(angle);
    ctx.fillStyle = '#ffd45c'; ctx.strokeStyle = '#302253'; ctx.lineWidth = 6; roundedRect(ctx, -24, -22, 48, 44, 17); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#322456'; roundedRect(ctx, -14, -12, 29, 18, 8); ctx.fill();
    ctx.fillStyle = '#adff72'; ctx.beginPath(); ctx.arc(-6,-4,4,0,Math.PI*2); ctx.arc(7,-4,4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#302253'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0,-23); ctx.lineTo(0,-38); ctx.stroke(); ctx.fillStyle = '#ff719d'; ctx.beginPath(); ctx.arc(0,-41,6,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff1aa'; roundedRect(ctx, 19, -5, 31, 12, 6); ctx.fill(); ctx.stroke(); ctx.restore();
    if (entity.downUntil > (state && state.now || 0)) { ctx.fillStyle = '#302253'; ctx.font = '900 18px ui-monospace'; ctx.textAlign = 'center'; ctx.fillText('REBOOT ' + Math.ceil((entity.downUntil - state.now) / 1000), entity.x, entity.y - 52); }
    drawHealthBar(entity, 52);
  }

  function enemyWindupActive(enemy) {
    return !!(state && Number(enemy.windupUntil) > state.now && enemy.windupTargetId);
  }

  function enemyWindupTarget(enemy) {
    if (!state) return null;
    if (enemy.windupTargetId === 'p1') return state.player;
    if (enemy.windupTargetId === 'moxie' || enemy.windupTargetId === 'p2') return state.ally;
    if (enemy.windupTargetId === 'heartlight') return state.beacon;
    return null;
  }

  function drawEnemyTelegraph(enemy, time) {
    if (!enemyWindupActive(enemy)) return;
    const spec = Core.ENEMY_TYPES[enemy.kind];
    const target = enemyWindupTarget(enemy);
    const startedAt = Number(enemy.windupStartedAt) || enemy.windupUntil - spec.windupMs;
    const progress = Math.max(0, Math.min(1, (state.now - startedAt) / Math.max(1, spec.windupMs)));
    const aim = (enemy.attackAimX || enemy.attackAimY)
      ? { x: enemy.attackAimX, y: enemy.attackAimY }
      : target ? { x: target.x - enemy.x, y: target.y - enemy.y } : { x: enemy.facingX, y: enemy.facingY };
    const aimSize = Math.hypot(aim.x, aim.y) || 1;
    const direction = { x: aim.x / aimSize, y: aim.y / aimSize };
    const angle = Math.atan2(direction.y, direction.x);
    const targetRadius = target && target.radius || 24;
    const reach = enemy.radius + targetRadius + 14;
    const color = enemy.kind === 'crown' ? '#fff073' : enemy.kind === 'siphon' ? '#68f0dd' : enemy.kind === 'sprinter' ? '#ffd078' : enemy.kind === 'bruiser' ? '#ff667f' : '#ff8fc0';
    const pulse = reducedMotion ? 1 : .96 + Math.sin(time / 70) * .04;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = .28 + progress * .42;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff5dc';
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = (10 + progress * 16) * pulse;
    if (enemy.kind === 'bruiser' || enemy.kind === 'crown') {
      const radius = (reach + progress * 12) * pulse;
      ctx.globalAlpha *= .6;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .55 + progress * .35;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = reducedMotion ? 0 : -time / 28;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.rotate(angle);
      if (enemy.kind === 'sprinter' || enemy.kind === 'siphon') {
        ctx.beginPath();
        ctx.moveTo(enemy.radius * .25, -7); ctx.lineTo(reach + 22, -16);
        ctx.lineTo(reach + 22, 16); ctx.lineTo(enemy.radius * .25, 7); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, reach * pulse, -.62, .62); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.translate(enemy.x, enemy.y - enemy.radius - 24);
    ctx.fillStyle = 'rgba(38, 11, 39, .92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    roundedRect(ctx, -28, -12, 56, 23, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '900 11px ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(enemy.windupTargetId === 'p1' ? 'DODGE' : '!', 0, 0);
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    const spec = Core.ENEMY_TYPES[enemy.kind];
    const winding = enemyWindupActive(enemy);
    const startedAt = winding ? Number(enemy.windupStartedAt) || enemy.windupUntil - spec.windupMs : 0;
    const windupProgress = winding ? Math.max(0, Math.min(1, (state.now - startedAt) / Math.max(1, spec.windupMs))) : 0;
    const wobble = reducedMotion ? 0 : Math.sin(time / 90 + enemy.wobble) * (enemy.kind === 'crown' ? 2 : enemy.kind === 'bruiser' ? 3 : 6);
    drawEnemyTelegraph(enemy, time);
    ellipse(enemy.x + 8, enemy.y + enemy.radius * .75, enemy.radius * 1.05, enemy.radius * .45, '#171739', .27);
    ctx.save(); ctx.translate(enemy.x, enemy.y + wobble); ctx.rotate(Math.atan2(enemy.facingY, enemy.facingX) + Math.PI / 2);
    if (winding && !reducedMotion) ctx.scale(1 + windupProgress * .14, 1 - windupProgress * .09);
    const gradient = ctx.createLinearGradient(-enemy.radius, -enemy.radius, enemy.radius, enemy.radius);
    gradient.addColorStop(0, enemy.kind === 'crown' ? '#a92d62' : enemy.kind === 'siphon' ? '#267f83' : enemy.kind === 'bruiser' ? '#772d78' : '#7644b8'); gradient.addColorStop(1, '#251747');
    ctx.fillStyle = gradient; ctx.strokeStyle = '#271844'; ctx.lineWidth = enemy.kind === 'crown' ? 10 : enemy.kind === 'bruiser' ? 8 : 6;
    ctx.beginPath();
    for (let point = 0; point < 10; point++) {
      const angle = Math.PI * 2 * point / 10;
      const radius = enemy.radius * (point % 2 ? .82 : 1.08);
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      if (!point) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(-enemy.radius*.33,-enemy.radius*.12,enemy.radius*.22,enemy.radius*.3,0,0,Math.PI*2); ctx.ellipse(enemy.radius*.33,-enemy.radius*.12,enemy.radius*.22,enemy.radius*.3,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#161028'; ctx.beginPath(); ctx.arc(-enemy.radius*.3,-enemy.radius*.08,enemy.radius*.09,0,Math.PI*2); ctx.arc(enemy.radius*.3,-enemy.radius*.08,enemy.radius*.09,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ff8fc0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0,enemy.radius*.28,enemy.radius*.35,.1,Math.PI-.1); ctx.stroke(); ctx.restore();
    drawHealthBar(enemy, Math.max(42, spec.radius * 2));
  }

  function drawProjectile(projectile) {
    ctx.save(); ctx.strokeStyle = projectile.color; ctx.lineWidth = projectile.radius * (projectile.counter ? 1.6 : 1.25); ctx.lineCap = 'round'; ctx.shadowColor = projectile.color; ctx.shadowBlur = projectile.counter ? 26 : 16;
    ctx.beginPath(); ctx.moveTo(projectile.x - projectile.vx * (projectile.counter ? .04 : .025), projectile.y - projectile.vy * (projectile.counter ? .04 : .025)); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
    if (projectile.counter) {
      ctx.strokeStyle = '#61edff'; ctx.lineWidth = Math.max(3, projectile.radius * .55);
      ctx.beginPath(); ctx.moveTo(projectile.x - projectile.vx * .026, projectile.y - projectile.vy * .026); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
      ctx.translate(projectile.x, projectile.y);
      ctx.save(); ctx.rotate(Math.PI / 4 + (state ? state.now / 120 : 0)); ctx.fillStyle = '#fff'; ctx.fillRect(-7, -7, 14, 14); ctx.restore();
      ctx.globalAlpha = .78; ctx.strokeStyle = '#d7ff72'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1; ctx.font = '900 11px ui-monospace, monospace'; ctx.textAlign = 'center';
      const badge = '×2'; const badgeWidth = 28;
      ctx.fillStyle = 'rgba(5, 18, 27, .9)'; ctx.strokeStyle = '#61edff'; ctx.lineWidth = 1.5;
      roundedRect(ctx, -badgeWidth / 2, -36, badgeWidth, 18, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f9ffe0'; ctx.fillText(badge, 0, -23);
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.radius * .55, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPickup(pickup, time) {
    const bob = reducedMotion ? 0 : Math.sin(time / 160 + pickup.x) * 5;
    ctx.save(); ctx.translate(pickup.x, pickup.y + bob); ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#ff668f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-6, 0, 8, 0, Math.PI * 2); ctx.arc(6, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawWisp(wisp, time) {
    if (wisp.collected) return;
    const bob = reducedMotion ? 0 : Math.sin(time / 180 + wisp.x) * 8;
    ctx.save(); ctx.translate(wisp.x, wisp.y + bob); ctx.rotate(time * .0005);
    ctx.shadowColor = '#fff07e'; ctx.shadowBlur = 24; ctx.fillStyle = '#fff7a3'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(12,0); ctx.lineTo(0,16); ctx.lineTo(-12,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = .45; ctx.beginPath(); ctx.arc(0,0,27,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }

  function drawPracticeTarget(target, time) {
    const pulse = target.painted ? 0 : (reducedMotion ? 0 : Math.sin(time / 220 + target.x) * 3);
    ellipse(target.x + 5, target.y + 21, 31, 11, '#182644', .24);
    ctx.save(); ctx.translate(target.x, target.y); ctx.strokeStyle = '#302253'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0,15); ctx.lineTo(0,37); ctx.moveTo(-15,37); ctx.lineTo(15,37); ctx.stroke();
    ctx.fillStyle = target.painted ? '#7dffca' : '#f5e9ff'; ctx.beginPath();
    for (let petal = 0; petal < 8; petal += 1) {
      const angle = petal * Math.PI / 4; const radius = 27 + pulse;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.lineTo(Math.cos(angle + Math.PI / 8) * 15, Math.sin(angle + Math.PI / 8) * 15);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = target.painted ? '#fff7a3' : '#b38cff'; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  function drawNpc(npc, time) {
    const met = state.exploration.metNpcIds.includes(npc.id);
    const nearby = worldDistance(state.player, npc) < 230;
    const bob = reducedMotion ? 0 : Math.sin(time / 210 + npc.x) * 3;
    ellipse(npc.x + 7, npc.y + 26, 28, 11, '#172447', .24);
    ctx.save(); ctx.translate(npc.x, npc.y + bob); ctx.strokeStyle = '#302253'; ctx.lineWidth = 5;
    ctx.fillStyle = npc.color; ctx.beginPath(); ctx.ellipse(0,8,21,27,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0cc'; ctx.beginPath(); ctx.arc(0,-22,18,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#302253'; ctx.beginPath(); ctx.arc(-6,-24,3,0,Math.PI*2); ctx.arc(6,-24,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = met ? '#7dffca' : '#fff7a3'; ctx.beginPath(); ctx.moveTo(0,-55); ctx.lineTo(8,-43); ctx.lineTo(0,-31); ctx.lineTo(-8,-43); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    if (nearby) {
      ctx.save(); ctx.textAlign = 'center'; ctx.font = '800 14px Bahnschrift, sans-serif';
      const width = Math.max(112, ctx.measureText(npc.name).width + 28); ctx.fillStyle = 'rgba(5,17,29,.88)'; ctx.strokeStyle = npc.color; ctx.lineWidth = 2;
      roundedRect(ctx, npc.x - width / 2, npc.y - 94, width, 31, 9); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(npc.name.toUpperCase(), npc.x, npc.y - 73); ctx.restore();
    }
  }

  function drawExplorationObjects(time) {
    if (!state || !state.exploration) return;
    state.practiceTargets.forEach(target => drawPracticeTarget(target, time));
    state.colorWisps.forEach(wisp => drawWisp(wisp, time));
    state.npcs.slice().sort((a,b) => a.y - b.y).forEach(npc => drawNpc(npc, time));
  }

  function drawEffects(time) {
    if (!state) return;
    (state.effects || []).forEach(effect => {
      const age = Math.max(0, state.now - effect.at);
      if (effect.type === 'enemy-miss') {
        const progress = Math.min(1, age / 700);
        const radius = reducedMotion ? 42 : 24 + progress * 45;
        const focusX = effect.targetId === 'p1' && Number.isFinite(effect.targetX) ? effect.targetX : effect.x;
        const focusY = effect.targetId === 'p1' && Number.isFinite(effect.targetY) ? effect.targetY : effect.y;
        ctx.save();
        ctx.globalAlpha = 1 - progress;
        ctx.strokeStyle = '#7dffca';
        ctx.fillStyle = '#f3fff9';
        ctx.lineWidth = Math.max(3, 8 - progress * 4);
        ctx.shadowColor = '#4ce3ff'; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(focusX, focusY, radius, 0, Math.PI * 2); ctx.stroke();
        if (effect.targetId === 'p1') {
          ctx.font = '900 13px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('PERFECT DODGE', focusX, focusY - radius - 9);
        }
        ctx.restore();
        return;
      }
      if (effect.type === 'counter-ready') {
        const progress = Math.min(1, age / 850);
        const radius = reducedMotion ? 48 : 30 + progress * 52;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.strokeStyle = '#d7ff72'; ctx.fillStyle = '#f7ffd8'; ctx.lineWidth = Math.max(3, 8 - progress * 4);
        ctx.shadowColor = '#56f3ff'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '900 13px ui-monospace, monospace'; ctx.textAlign = 'center';
        ctx.fillText('PRISM COUNTER ARMED', effect.x, effect.y + radius + 19);
        ctx.restore();
        return;
      }
      if (effect.type === 'counter-hit') {
        const progress = Math.min(1, age / 850);
        const radius = reducedMotion ? 43 : 22 + progress * 62;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.strokeStyle = '#d7ff72'; ctx.fillStyle = '#fff'; ctx.lineWidth = Math.max(4, 11 - progress * 6);
        ctx.shadowColor = '#56f3ff'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#61edff'; ctx.lineWidth = Math.max(2, 6 - progress * 3);
        ctx.beginPath(); ctx.arc(effect.x, effect.y, radius * .72, 0, Math.PI * 2); ctx.stroke();
        for (let ray = 0; ray < 4; ray += 1) {
          const angle = Math.PI / 4 + ray * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * (radius + 3), effect.y + Math.sin(angle) * (radius + 3));
          ctx.lineTo(effect.x + Math.cos(angle) * (radius + 18), effect.y + Math.sin(angle) * (radius + 18));
          ctx.stroke();
        }
        const label = '×2  PRISM COUNTER  ' + effect.damage;
        ctx.font = '900 16px ui-monospace, monospace'; ctx.textAlign = 'center';
        const labelWidth = ctx.measureText(label).width + 24;
        ctx.fillStyle = 'rgba(5, 18, 27, .9)'; ctx.strokeStyle = '#d7ff72'; ctx.lineWidth = 2;
        roundedRect(ctx, effect.x - labelWidth / 2, effect.y - radius - 36, labelWidth, 27, 9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f9ffe0'; ctx.fillText(label, effect.x, effect.y - radius - 17);
        ctx.restore();
        return;
      }
      if (effect.type === 'defender-hit') {
        const progress = Math.min(1, age / 850);
        const direction = Math.atan2(effect.sourceY - effect.y, effect.sourceX - effect.x);
        const radius = (reducedMotion ? 46 : 34 + progress * 24);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.strokeStyle = '#ff5278';
        ctx.fillStyle = '#fff4f7';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(3, 10 - progress * 6);
        ctx.shadowColor = '#ff2e67';
        ctx.shadowBlur = 18 * (1 - progress);
        ctx.save();
        ctx.globalAlpha *= .34;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, direction - .58, direction + .58);
        ctx.stroke();
        const markerX = effect.x + Math.cos(direction) * radius;
        const markerY = effect.y + Math.sin(direction) * radius;
        ctx.translate(markerX, markerY);
        ctx.rotate(direction + Math.PI / 4);
        ctx.fillRect(-5, -5, 10, 10);
        ctx.restore();
        return;
      }
      const progress = Math.min(1, age / (effect.type === 'pulse' ? 850 : 500));
      ctx.save(); ctx.globalAlpha = 1 - progress; ctx.strokeStyle = effect.color || '#fff'; ctx.lineWidth = Math.max(2, 9 * (1 - progress));
      if (effect.type === 'pulse') { ctx.beginPath(); ctx.arc(effect.x, effect.y, 30 + progress * 235, 0, Math.PI * 2); ctx.stroke(); }
      else if (effect.type === 'dash') { ctx.beginPath(); ctx.arc(effect.x, effect.y, 22 + progress * 60, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(effect.x, effect.y, 8 + progress * 40, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    });
    (state.events || []).forEach(event => {
      if (event.type !== 'defender-return' || !event.detail) return;
      const age = Math.max(0, state.now - event.at);
      if (age >= 1400) return;
      const entity = event.detail.id === state.player.id ? state.player : event.detail.id === state.ally.id ? state.ally : null;
      if (!entity) return;
      const progress = Math.min(1, age / 1400);
      const radius = reducedMotion ? 48 : 30 + progress * 52;
      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = '#7dffca';
      ctx.fillStyle = '#f3fff9';
      ctx.lineWidth = Math.max(3, 8 - progress * 4);
      ctx.shadowColor = '#4ce3ff';
      ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(entity.x, entity.y, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.font = '900 13px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ONLINE', entity.x, entity.y - radius - 10);
      ctx.restore();
    });
    const now = performance.now();
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i], age = now - p.born;
      if (age >= p.life) { particles.splice(i, 1); continue; }
      const dt = 1 / 60; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy = p.vy * .96 + 18 * dt;
      ctx.globalAlpha = 1 - age / p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - age / p.life * .5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayerDamageCompass() {
    if (!state) return;
    const hit = latestDefenderHit(state.player.id);
    if (!hit) return;
    const age = Math.max(0, state.now - hit.at);
    const progress = Math.min(1, age / 900);
    const strength = 1 - progress;
    const direction = Math.atan2(hit.sourceY - state.player.y, hit.sourceX - state.player.x);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const dirX = Math.cos(direction);
    const dirY = Math.sin(direction);
    const inset = Math.max(88 * view.dpr, Math.min(canvas.width, canvas.height) * .105);
    const horizontalTravel = (centerX - inset) / Math.max(.001, Math.abs(dirX));
    const verticalTravel = (centerY - inset) / Math.max(.001, Math.abs(dirY));
    const edgeTravel = Math.min(horizontalTravel, verticalTravel);
    const markerX = centerX + dirX * edgeTravel;
    const markerY = centerY + dirY * edgeTravel;
    ctx.save();
    const vignette = ctx.createRadialGradient(centerX, centerY, Math.min(canvas.width, canvas.height) * .18, centerX, centerY, Math.max(canvas.width, canvas.height) * .72);
    vignette.addColorStop(0, 'rgba(255, 46, 103, 0)');
    vignette.addColorStop(1, 'rgba(255, 46, 103, ' + (.2 * strength).toFixed(3) + ')');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(markerX, markerY);
    ctx.rotate(direction);
    ctx.strokeStyle = 'rgba(255, 232, 239, ' + Math.max(.18, strength).toFixed(3) + ')';
    ctx.lineWidth = Math.max(5, 8 * view.dpr);
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ff2e67';
    ctx.shadowBlur = 22 * strength;
    ctx.beginPath();
    ctx.moveTo(14 * view.dpr, -16 * view.dpr);
    ctx.lineTo(-8 * view.dpr, 0);
    ctx.lineTo(14 * view.dpr, 16 * view.dpr);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = '900 ' + Math.max(12, 13 * view.dpr) + 'px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, 4 * view.dpr);
    ctx.strokeStyle = '#4e1027';
    ctx.fillStyle = '#fff4f7';
    const amountY = markerY - 27 * view.dpr;
    ctx.strokeText('−' + Math.round(hit.amount || 0), markerX, amountY);
    ctx.fillText('−' + Math.round(hit.amount || 0), markerX, amountY);
    ctx.restore();
  }

  function drawAim() {
    if (!state || ![Core.PHASES.EXPLORE, Core.PHASES.WAVE, Core.PHASES.INTERMISSION].includes(state.phase)) return;
    ctx.save(); ctx.translate(pointer.x, pointer.y); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.shadowColor = '#5cecff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.moveTo(-22,0); ctx.lineTo(-8,0); ctx.moveTo(22,0); ctx.lineTo(8,0); ctx.moveTo(0,-22); ctx.lineTo(0,-8); ctx.moveTo(0,22); ctx.lineTo(0,8); ctx.stroke(); ctx.restore();
  }

  function threatCompassState() {
    if (!state || state.phase !== Core.PHASES.WAVE || !state.enemies.length) return null;
    const pixel = view.dpr;
    const compact = canvas.clientWidth <= 820;
    const bounds = {
      left: 22 * pixel,
      right: canvas.width - 22 * pixel,
      top: (compact ? 134 : 166) * pixel,
      bottom: canvas.height - (compact ? 92 : 88) * pixel
    };
    const player = { x: state.player.x * view.scale + view.x, y: state.player.y * view.scale + view.y };
    const buckets = new Map();
    state.enemies.forEach(enemy => {
      const point = { x: enemy.x * view.scale + view.x, y: enemy.y * view.scale + view.y };
      const padding = Math.max(12 * pixel, (enemy.radius + 9) * view.scale);
      const visible = point.x - padding >= bounds.left && point.x + padding <= bounds.right && point.y - padding >= bounds.top && point.y + padding <= bounds.bottom;
      if (visible) return;
      const angle = Math.atan2(point.y - player.y, point.x - player.x);
      const sector = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
      const distance = worldDistance(state.player, enemy);
      const group = buckets.get(sector) || { sector, count: 0, distance, angle };
      group.count += 1;
      group.incoming = !!group.incoming || (enemy.windupTargetId === 'p1' && enemy.windupUntil > state.now);
      if (distance < group.distance) { group.distance = distance; group.angle = angle; }
      buckets.set(sector, group);
    });
    const origin = {
      x: Math.max(bounds.left, Math.min(bounds.right, player.x)),
      y: Math.max(bounds.top, Math.min(bounds.bottom, player.y))
    };
    return { bounds, origin, groups: Array.from(buckets.values()).sort((left, right) => left.distance - right.distance) };
  }

  function threatDirection(sector) {
    return ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'][sector] || 'nearby';
  }

  function threatEdgePoint(group, compass) {
    const dx = Math.cos(group.angle), dy = Math.sin(group.angle);
    const times = [];
    if (dx > .001) times.push((compass.bounds.right - compass.origin.x) / dx);
    if (dx < -.001) times.push((compass.bounds.left - compass.origin.x) / dx);
    if (dy > .001) times.push((compass.bounds.bottom - compass.origin.y) / dy);
    if (dy < -.001) times.push((compass.bounds.top - compass.origin.y) / dy);
    const distance = Math.min.apply(null, times.filter(value => Number.isFinite(value) && value >= 0));
    return { x: compass.origin.x + dx * distance, y: compass.origin.y + dy * distance };
  }

  function drawThreatCompass(time) {
    const compass = threatCompassState();
    const groups = compass ? compass.groups : [];
    const incoming = state && state.phase === Core.PHASES.WAVE
      ? state.enemies.filter(enemy => enemy.windupTargetId === 'p1' && enemy.windupUntil > state.now).sort((left, right) => left.windupUntil - right.windupUntil)
      : [];
    const incomingCue = incoming.length === 1
      ? 'Dodge now: ' + incoming[0].kind + ' attack from ' + bearingLabel(incoming[0].x - state.player.x, incoming[0].y - state.player.y) + '.'
      : incoming.length > 1 ? 'Dodge now: ' + incoming.length + ' incoming attacks.' : '';
    const playerDodge = state && (state.effects || []).slice().reverse().find(effect => effect.type === 'enemy-miss' && effect.targetId === 'p1' && state.now - effect.at >= 0 && state.now - effect.at < 700);
    const dodgeCue = playerDodge
      ? state.counterReadyUntil > state.now ? 'Perfect dodge. Prism Counter ready.' : 'Dodge confirmed.'
      : incomingCue;
    const offscreenCue = groups.length ? 'Off-screen threats: ' + groups.map(group => group.count + ' ' + threatDirection(group.sector)).join(', ') + '.' : '';
    const cue = [dodgeCue, offscreenCue].filter(Boolean).join(' ');
    const cueNow = performance.now();
    if (cue !== previousThreatCue && (!previousThreatCue || !cue || cueNow - lastThreatCueAt >= 900)) {
      previousThreatCue = cue;
      lastThreatCueAt = cueNow;
      $('threatAnnouncer').textContent = cue;
    }
    if (!compass || !groups.length) return;
    const pixel = view.dpr;
    groups.slice(0, 4).forEach(group => {
      const marker = threatEdgePoint(group, compass);
      const dx = Math.cos(group.angle), dy = Math.sin(group.angle);
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time / 155 + group.sector) * .08;
      const cueColor = group.incoming ? '#ffd078' : '#ff83aa';
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.shadowColor = group.incoming ? '#ffb44f' : '#ff7396'; ctx.shadowBlur = 18 * pixel;
      ctx.fillStyle = 'rgba(7, 17, 30, .92)'; ctx.strokeStyle = cueColor; ctx.lineWidth = 2 * pixel;
      ctx.beginPath(); ctx.arc(0, 0, 16 * pixel * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.rotate(group.angle);
      ctx.fillStyle = cueColor; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * pixel;
      ctx.beginPath(); ctx.moveTo(11 * pixel, 0); ctx.lineTo(-5 * pixel, -8 * pixel); ctx.lineTo(-1 * pixel, 0); ctx.lineTo(-5 * pixel, 8 * pixel); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      const badgeX = marker.x - dx * 24 * pixel, badgeY = marker.y - dy * 24 * pixel;
      ctx.save(); ctx.fillStyle = 'rgba(7, 17, 30, .9)'; ctx.strokeStyle = group.incoming ? 'rgba(255, 208, 120, .86)' : 'rgba(255, 131, 170, .74)'; ctx.lineWidth = pixel;
      roundedRect(ctx, badgeX - 10 * pixel, badgeY - 9 * pixel, 20 * pixel, 18 * pixel, 7 * pixel); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + (10 * pixel) + 'px Bahnschrift, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(group.incoming ? '!' : String(group.count), badgeX, badgeY + pixel); ctx.restore();
    });
  }

  function render(time) {
    resizeCanvas();
    stage3d.render(time, state, reducedMotion);
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height);
    if (!stage3d.available) {
      const backdrop = ctx.createLinearGradient(0, 0, 0, canvas.height);
      backdrop.addColorStop(0, '#102d35'); backdrop.addColorStop(.58, '#0d2730'); backdrop.addColorStop(1, '#071721');
      ctx.fillStyle = backdrop; ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    ctx.setTransform(view.scale,0,0,view.scale,view.x,view.y);
    let shakeX = 0, shakeY = 0;
    if (state && !reducedMotion && state.now - state.beacon.lastHitAt < 220) { shakeX = Math.sin(time) * 5; shakeY = Math.cos(time * .7) * 4; ctx.translate(shakeX, shakeY); }
    drawBackground(time);
    if (state) {
      drawExplorationObjects(time);
      if (!stage3d.available) {
        drawBeacon(state.beacon, time);
        state.pickups.forEach(pickup => drawPickup(pickup, time));
        state.projectiles.forEach(drawProjectile);
        state.enemies.slice().sort((a,b) => a.y - b.y).forEach(enemy => drawEnemy(enemy, time));
        [state.player, state.ally].sort((a,b) => a.y - b.y).forEach(entity => entity.id === 'p1' ? drawPippa(entity, time) : drawMoxie(entity, time));
      }
      drawEffects(time);
      drawAim();
    }
    ctx.setTransform(1,0,0,1,0,0);
    drawPlayerDamageCompass();
    drawThreatCompass(time);
    requestAnimationFrame(render);
  }

  function activeGamepad(index) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (Number.isInteger(index)) return gamepads && gamepads[index] || null;
    return Array.from(gamepads || []).find(Boolean) || null;
  }

  function pollGamepadControls() {
    const pad = activeGamepad(0);
    if (!pad) {
      firePadHeld = false; dashPadHeld = false; pulsePadHeld = false; interactPadHeld = false; mapPadHeld = false; pausePadHeld = false; aimPadHeld = false;
      return;
    }
    const firePressed = !!(pad.buttons[7] && pad.buttons[7].pressed) || !!(pad.buttons[0] && pad.buttons[0].pressed);
    const dashPressed = !!(pad.buttons[1] && pad.buttons[1].pressed);
    const pulsePressed = !!(pad.buttons[2] && pad.buttons[2].pressed);
    const interactPressed = !!(pad.buttons[3] && pad.buttons[3].pressed);
    const mapPressed = !!(pad.buttons[8] && pad.buttons[8].pressed);
    const pausePressed = !!(pad.buttons[9] && pad.buttons[9].pressed);
    const aimPressed = Math.abs(pad.axes[2] || 0) > .24 || Math.abs(pad.axes[3] || 0) > .24;
    const gameplayActive = playerControlsOnline(state);
    if (firePressed && !firePadHeld && gameplayActive) fireRequested = true;
    if (aimPadHeld && !aimPressed && gameplayActive) fireRequested = true;
    if (dashPressed && !dashPadHeld && gameplayActive) dashRequested = true;
    if (pulsePressed && !pulsePadHeld && gameplayActive) pulseRequested = true;
    if (interactPressed && !interactPadHeld && gameplayActive && state.phase === Core.PHASES.EXPLORE) void action({ type: 'interact' });
    if (mapPressed && !mapPadHeld) void toggleMapOverlay();
    if (pausePressed && !pausePadHeld) void handleEscape();
    firePadHeld = firePressed;
    dashPadHeld = dashPressed;
    pulsePadHeld = pulsePressed;
    interactPadHeld = interactPressed;
    mapPadHeld = mapPressed;
    pausePadHeld = pausePressed;
    aimPadHeld = aimPressed;
  }

  function currentInput() {
    if (!playerControlsOnline(state)) return { moveX: 0, moveY: 0, aimX: state && state.player ? state.player.facingX : 1, aimY: state && state.player ? state.player.facingY : 0, firing: false };
    let moveX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let moveY = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
    let aimX = state ? pointer.x - state.player.x : 1;
    let aimY = state ? pointer.y - state.player.y : 0;
    let firing = pointer.firing || keys.has('Space') || fireRequested;
    const pad = activeGamepad(0);
    if (pad) {
      const dpadX = (pad.buttons[15] && pad.buttons[15].pressed ? 1 : 0) - (pad.buttons[14] && pad.buttons[14].pressed ? 1 : 0);
      const dpadY = (pad.buttons[13] && pad.buttons[13].pressed ? 1 : 0) - (pad.buttons[12] && pad.buttons[12].pressed ? 1 : 0);
      if (Math.abs(pad.axes[0] || 0) > .18 || Math.abs(pad.axes[1] || 0) > .18 || dpadX || dpadY) { moveX = Math.abs(pad.axes[0] || 0) > .18 ? pad.axes[0] : dpadX; moveY = Math.abs(pad.axes[1] || 0) > .18 ? pad.axes[1] : dpadY; }
      if (Math.abs(pad.axes[2] || 0) > .2 || Math.abs(pad.axes[3] || 0) > .2) { aimX = pad.axes[2] || 0; aimY = pad.axes[3] || 0; }
      firing = firing || !!(pad.buttons[7] && pad.buttons[7].pressed) || !!(pad.buttons[0] && pad.buttons[0].pressed);
    }
    const size = Math.hypot(aimX, aimY) || 1;
    return { moveX, moveY, aimX: aimX / size, aimY: aimY / size, firing };
  }

  async function sendInput() {
    if (inputSending || !connected || !state) return;
    if (!playerControlsOnline(state)) {
      dashRequested = false;
      pulseRequested = false;
      fireRequested = false;
      pointer.firing = false;
      keys.clear();
      return;
    }
    const input = currentInput();
    inputSending = true;
    inputSeq += 1;
    const shot = input.firing;
    const queuedShot = fireRequested;
    try {
      const result = await action(Object.assign({ type: 'input', seq: inputSeq, dash: dashRequested, pulse: pulseRequested }, input));
      if (result && ['stale-sequence', 'invalid-sequence', 'sequence-gap-too-large'].includes(result.reason)) {
        inputSeq = Number(state && state.lastInputSeq) || 0;
        return;
      }
      if (result && result.ok !== false) {
        if (shot && performance.now() - lastShotToneAt > 150) { tone(710, .035, 'square', .012, 470); lastShotToneAt = performance.now(); }
        if (queuedShot) fireRequested = false;
        dashRequested = false; pulseRequested = false;
      }
    } finally { inputSending = false; }
  }

  async function sendPartnerGamepadInput() {
    if (partnerInputSending || !connected || !state || actorId !== 'screen' || state.ally.kind !== 'human') return;
    const pad = activeGamepad(1);
    if (!pad) { partnerAimPadHeld = false; partnerDashPadHeld = false; partnerPulsePadHeld = false; return; }
    const dead = (value, threshold) => Math.abs(value || 0) > threshold ? Number(value) : 0;
    const dpadX = (pad.buttons[15] && pad.buttons[15].pressed ? 1 : 0) - (pad.buttons[14] && pad.buttons[14].pressed ? 1 : 0);
    const dpadY = (pad.buttons[13] && pad.buttons[13].pressed ? 1 : 0) - (pad.buttons[12] && pad.buttons[12].pressed ? 1 : 0);
    const moveX = dead(pad.axes[0], .18) || dpadX, moveY = dead(pad.axes[1], .18) || dpadY;
    const rawAimX = dead(pad.axes[2], .24), rawAimY = dead(pad.axes[3], .24), aiming = !!(rawAimX || rawAimY);
    const aimX = aiming ? rawAimX : state.ally.facingX, aimY = aiming ? rawAimY : state.ally.facingY;
    const aimSize = Math.hypot(aimX, aimY) || 1;
    const dashPressed = !!(pad.buttons[1] && pad.buttons[1].pressed), pulsePressed = !!(pad.buttons[2] && pad.buttons[2].pressed);
    const firing = !!(pad.buttons[7] && pad.buttons[7].pressed) || !!(pad.buttons[0] && pad.buttons[0].pressed) || (partnerAimPadHeld && !aiming);
    partnerAimPadHeld = aiming;
    partnerInputSending = true;
    partnerInputSeq += 1;
    try {
      const response = await api('/api/action', { method: 'POST', body: JSON.stringify({ player: 'p2', action: { type: 'input', seq: partnerInputSeq, moveX, moveY, aimX: aimX / aimSize, aimY: aimY / aimSize, firing, dash: dashPressed && !partnerDashPadHeld, pulse: pulsePressed && !partnerPulsePadHeld } }) });
      const result = response.actionResult || {};
      if (['stale-sequence', 'invalid-sequence', 'sequence-gap-too-large'].includes(result.reason)) partnerInputSeq = Number(state.lastInputSeqByActor && state.lastInputSeqByActor.p2) || 0;
    } catch (_) { setConnection(false); }
    finally { partnerDashPadHeld = dashPressed; partnerPulsePadHeld = pulsePressed; partnerInputSending = false; }
  }

  async function togglePause(manageFocus) {
    if (!state || ![Core.PHASES.EXPLORE, Core.PHASES.WAVE, Core.PHASES.INTERMISSION].includes(state.phase)) return;
    const wasPaused = state.paused;
    if (!wasPaused) { keys.clear(); pointer.firing = false; fireRequested = false; dashRequested = false; pulseRequested = false; }
    await action({ type: 'pause' });
    if (manageFocus !== false && state) focusSoon(state.paused ? $('resumeButton') : canvas);
  }

  async function closeHelpPanel(options) {
    const settings = options || {};
    if ($('helpPanel').hidden) return;
    const shouldResume = helpPausedGame && state && state.paused && settings.resume !== false;
    const returnFocus = helpReturnFocus;
    helpPausedGame = false;
    if (shouldResume) await togglePause(false);
    $('helpPanel').hidden = true;
    syncModalIsolation();
    if (settings.restore !== false) focusSoon(returnFocus || $('helpButton'));
  }

  async function openHelpPanel() {
    if (!$('mapOverlay').hidden) await closeMapOverlay({ restore: false });
    helpReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : canvas;
    $('helpPanel').hidden = false;
    syncModalIsolation();
    if (state && !state.paused && [Core.PHASES.EXPLORE, Core.PHASES.WAVE, Core.PHASES.INTERMISSION].includes(state.phase)) {
      helpPausedGame = true;
      await togglePause(false);
      if (!state.paused) helpPausedGame = false;
    }
    focusSoon($('closeHelp'));
  }

  async function toggleHelpPanel() {
    if ($('helpPanel').hidden) await openHelpPanel();
    else await closeHelpPanel();
  }

  async function closeMapOverlay(options) {
    const settings = options || {};
    if ($('mapOverlay').hidden) return;
    const shouldResume = mapPausedGame && state && state.paused && settings.resume !== false;
    const returnFocus = mapReturnFocus;
    mapPausedGame = false;
    if (shouldResume) await togglePause(false);
    $('mapOverlay').hidden = true;
    $('mapButton').setAttribute('aria-pressed', 'false');
    syncModalIsolation();
    if (settings.restore !== false) focusSoon(returnFocus || $('mapButton'));
  }

  async function openMapOverlay() {
    if (!state || !unlocked('field-map')) {
      showToast('MAP LOCKED · Meet Mayor Maribel east of the Heartlight.', 3200);
      return;
    }
    if (!$('helpPanel').hidden) await closeHelpPanel({ restore: false });
    mapReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : canvas;
    renderMap();
    $('mapOverlay').hidden = false;
    $('mapButton').setAttribute('aria-pressed', 'true');
    syncModalIsolation();
    if (!state.paused && [Core.PHASES.EXPLORE, Core.PHASES.WAVE, Core.PHASES.INTERMISSION].includes(state.phase)) {
      mapPausedGame = true;
      await togglePause(false);
      if (!state.paused) mapPausedGame = false;
    }
    focusSoon($('closeMap'));
  }

  async function toggleMapOverlay() {
    if ($('mapOverlay').hidden) await openMapOverlay();
    else await closeMapOverlay();
  }

  async function handleEscape() {
    if (!$('mapOverlay').hidden) { await closeMapOverlay(); return; }
    if (!$('helpPanel').hidden) { await closeHelpPanel(); return; }
    await togglePause();
  }

  canvas.addEventListener('pointermove', event => { const point = worldPointer(event); pointer.x = point.x; pointer.y = point.y; pointer.active = true; });
  canvas.addEventListener('pointerdown', event => {
    canvas.focus();
    const point = worldPointer(event);
    pointer.x = point.x; pointer.y = point.y; pointer.firing = event.button === 0;
    if (pointer.firing) fireRequested = true;
    canvas.setPointerCapture(event.pointerId);
    if (pointer.firing) void sendInput();
  });
  canvas.addEventListener('pointerup', event => { pointer.firing = false; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); });
  canvas.addEventListener('pointercancel', () => { pointer.firing = false; });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  window.addEventListener('blur', () => { keys.clear(); pointer.firing = false; fireRequested = false; });
  window.addEventListener('keydown', event => {
    if (trapModalFocus(event)) return;
    if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','KeyE','KeyF','KeyM','KeyH','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    const controlsOnline = playerControlsOnline(state);
    if (event.code === 'Space' && !event.repeat && controlsOnline) fireRequested = true;
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat && controlsOnline) dashRequested = true;
    if (event.code === 'KeyE' && !event.repeat && controlsOnline) pulseRequested = true;
    if (event.code === 'KeyF' && !event.repeat && state && state.phase === Core.PHASES.EXPLORE) void action({ type: 'interact' });
    if (event.code === 'KeyM' && !event.repeat) void toggleMapOverlay();
    if (event.code === 'ArrowLeft') { pointer.x -= 35; }
    if (event.code === 'ArrowRight') { pointer.x += 35; }
    if (event.code === 'ArrowUp') { pointer.y -= 35; }
    if (event.code === 'ArrowDown') { pointer.y += 35; }
    if (event.code === 'Escape' && !event.repeat) void handleEscape();
    if (event.code === 'KeyH' && !event.repeat) void toggleHelpPanel();
    if (!event.repeat && ['Space','ShiftLeft','ShiftRight','KeyE'].includes(event.code)) void sendInput();
  });
  window.addEventListener('keyup', event => keys.delete(event.code));

  $('storyNext').onclick = () => action({ type: 'story-next' });
  $('skipStory').onclick = async () => {
    if (!state || state.phase !== Core.PHASES.STORY) return;
    for (let index = state.storyStep; index < story.length; index += 1) await action({ type: 'story-next' });
  };
  $('startButton').onclick = async () => { ensureAudio(); await action({ type: 'start' }); canvas.focus(); };
  $('resumeButton').onclick = () => togglePause();
  $('restartButton').onclick = async () => {
    keys.clear(); pointer.firing = false; fireRequested = false; dashRequested = false; pulseRequested = false;
    $('mapOverlay').hidden = true; mapPausedGame = false; helpPausedGame = false;
    $('helpPanel').hidden = true;
    $('mapButton').setAttribute('aria-pressed', 'false');
    acceptPacket(await api('/api/reset', { method: 'POST', body: '{}' }));
  };
  $('helpButton').onclick = () => toggleHelpPanel();
  $('closeHelp').onclick = () => closeHelpPanel();
  $('mapButton').onclick = () => toggleMapOverlay();
  $('closeMap').onclick = () => closeMapOverlay();
  $('soundButton').onclick = () => {
    soundEnabled = !soundEnabled;
    $('soundButton').setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    $('soundButton').textContent = soundEnabled ? 'AUDIO ON' : 'AUDIO OFF';
    if (soundEnabled) { ensureAudio(); tone(440, .12, 'triangle', .035, 660); }
  };

  function syncMotionUi() {
    document.body.classList.toggle('reduced-motion', reducedMotion);
    $('motionButton').setAttribute('aria-pressed', reducedMotion ? 'true' : 'false');
    $('motionButton').textContent = reducedMotion ? 'MOTION LOW' : 'MOTION FULL';
  }

  $('motionButton').onclick = () => {
    reducedMotion = !reducedMotion;
    motionPreferenceOverridden = true;
    syncMotionUi();
  };

  if (systemMotionPreference && systemMotionPreference.addEventListener) {
    systemMotionPreference.addEventListener('change', event => {
      if (motionPreferenceOverridden) return;
      reducedMotion = !!event.matches;
      syncMotionUi();
    });
  }

  document.addEventListener('visibilitychange', () => {
    keys.clear(); pointer.firing = false; fireRequested = false; dashRequested = false; pulseRequested = false;
    if (document.hidden && state && !state.paused && [Core.PHASES.EXPLORE, Core.PHASES.WAVE, Core.PHASES.INTERMISSION].includes(state.phase)) {
      autoPausedAway = true;
      void togglePause(false);
    } else if (!document.hidden && autoPausedAway) {
      autoPausedAway = false;
      showToast('PAUSED WHILE AWAY · Resume when you are ready.', 3200);
      if (state && state.paused) focusSoon($('resumeButton'));
    }
  });

  syncMotionUi();
  new ResizeObserver(resizeCanvas).observe(stage);
  setInterval(poll, 100);
  setInterval(pollGamepadControls, Core.CONFIG.tickMs);
  setInterval(sendInput, Core.CONFIG.tickMs);
  setInterval(sendPartnerGamepadInput, Core.CONFIG.tickMs);
  requestAnimationFrame(render);
  poll();

  window.__TOONFALL_DEBUG__ = {
    getState: () => state ? Core.clone(state) : null,
    getView: () => Object.assign({}, view),
    action,
    poll,
    claims: {
      renderer: stage3d.available ? 'hybrid-webgl-low-poly-plus-canvas-2d-authority' : 'canvas-2d-fallback',
      palette: '16-step-channel-quantized',
      stateAuthority: 'managed-local-server',
      partnerChoice: ['human', 'connected-ai', 'in-game-ai'],
      gamepadProfile: 'axm-universal-xbox-brawl-v0.2.1',
      splitScreen: false
    }
  };
})();
