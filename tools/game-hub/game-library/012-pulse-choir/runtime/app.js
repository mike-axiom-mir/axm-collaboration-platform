(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const core = window.PulseChoirCore;
  const canvas = document.getElementById('arena');
  const ctx = canvas.getContext('2d');
  const query = new URLSearchParams(location.search);
  const requestedPlayer = query.get('player') || 'screen';
  const els = Object.fromEntries([
    'network','score','rank','charge','chargeFill','timer','phase','surges','bestSync','combo','streak','revision','frameCost','eventToast','syncBanner','syncDots','comboCallout','setlistPanel','setlistAct','setlistClock','setlistGlyph','setlistTitle','setlistCopy','setlistFill','setlistProgress','phaseOverlay','overlayCard','showBadge','showArc','conductorPlan','conductorMode','conductorReason','overlayEyebrow','overlayTitle','overlayCopy','ruleLegend','resultDebrief','resultStats','resultShowMemory','resultSetlist','resultPlayers','startButton','returnButton','startNote','helpOverlay','closeHelp','seatRail','soundToggle','motionToggle','contrastToggle','resetButton','announcer'
  ].map(id => [id, document.getElementById(id)]));
  const displayPlayers = new Map();
  const particles = [];
  const shockwaves = [];
  const floaters = [];
  const trails = new Map();
  const arenaArt = new Image();
  arenaArt.src = 'assets/pulse-choir-arena-v2.png';
  const heldKeys = new Set();
  const sequences = { p1: 0, p2: 0, p3: 0, p4: 0 };
  const lastSentVectors = new Map();
  const gamepadPulse = new Map();
  let packet = null;
  let connected = false;
  let polling = false;
  let lastEventId = null;
  let lastFrameAt = performance.now();
  let renderSamples = [];
  let audioContext = null;
  let soundEnabled = false;
  let helpOpen = false;
  let dismissedResultRevision = -1;
  let resetArmedUntil = 0;
  let returnArmedUntil = 0;
  let cameraKick = 0;
  let flashStrength = 0;
  let calloutTimer = null;

  const keyProfiles = {
    p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', pulse: 'Space' },
    p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', pulse: 'Enter' },
    p3: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', pulse: 'KeyO' },
    p4: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', pulse: 'Numpad0' }
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  }
  function rankFor(score) {
    return score >= core.METRICS.rankHeadliner ? 'HEADLINER' : score >= core.METRICS.rankEncore ? 'ENCORE' : score >= core.METRICS.rankInRhythm ? 'IN RHYTHM' : 'WARM-UP';
  }
  function formatTime(ms) {
    const seconds = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  function showContext(state) {
    const show = state.show || { roundNumber: 0, completedRounds: 0, totalScore: 0, bestScore: 0, bestRank: 'WARM-UP', totalActsCleared: 0, next: null };
    const roundNumber = Math.max(1, Number(state.phase === core.PHASES.LOBBY && show.next ? show.next.roundNumber : show.roundNumber || 1));
    const position = core.showPosition(roundNumber);
    const next = show.next || {};
    const nextTitles = Array.isArray(next.acts) ? next.acts.map(act => act.title).join(' · ') : 'new directives';
    const opening = { mode: 'opening', title: 'OPENING SET', cue: 'ESTABLISH THE ROOM', reason: 'First round establishes the room’s rhythm before the show adapts.', sourceRound: null };
    const upcoming = next.conductor || opening;
    const current = state.setlist && state.setlist.conductor || upcoming;
    const conductor = [core.PHASES.LOBBY, core.PHASES.RESULTS].includes(state.phase) ? upcoming : current;
    const roomSignal = conductor.roomSignal || null;
    return { show, roundNumber, position, next, nextTitles, conductor, roomSignal };
  }
  function roomSignalLabel(signal) {
    if (!signal) return '';
    return signal.choice
      ? 'ROOM SIGNAL ' + signal.title + ' ' + signal.count + '/' + signal.totalVotes
      : 'ROOM SIGNAL OPEN · VOTE ON PHONES';
  }
  function updateShowArc(state) {
    const context = showContext(state);
    const recovered = packet && packet.recovery && packet.recovery.status === 'restored';
    const label = 'SHOW ' + context.position.showNumber + ' · ROUND ' + context.position.roundInShow + '/' + core.METRICS.showArcRounds;
    let detail = 'Tonight remembers every result and changes the next Setlist.';
    if (context.show.completedRounds > 0) {
      const acts = Number(context.show.totalActsCleared || 0);
      detail = context.show.totalScore + ' NIGHT POINTS · ' + acts + ' ACT' + (acts === 1 ? '' : 'S') + ' · ' + roomSignalLabel(context.roomSignal) + ' · NEXT: ' + context.nextTitles;
    }
    if (recovered) detail = 'RESTORED AFTER HOST RESTART · ' + detail;
    els.showArc.innerHTML = '<b>' + escapeHtml(label) + '</b><span>' + escapeHtml(detail) + '</span>';
    els.conductorPlan.hidden = state.phase === core.PHASES.RESULTS;
    els.conductorMode.textContent = 'LIVE CONDUCTOR · ' + context.conductor.title + (context.roomSignal ? ' · ' + roomSignalLabel(context.roomSignal) : '');
    els.conductorReason.textContent = context.conductor.reason;
  }
  function resetMode(state) {
    return state && state.phase === core.PHASES.LOBBY && state.show && state.show.completedRounds > 0 ? 'new-show' : 'reset';
  }
  function resetLabel(state) {
    return resetMode(state) === 'new-show' ? 'New show' : 'Reset to lobby';
  }
  async function api(path, options) {
    const response = await fetch(path, Object.assign({ cache: 'no-store' }, options || {}));
    let value;
    try { value = await response.json(); } catch (_) { value = { ok: false, error: 'Invalid host response' }; }
    if (!response.ok && !value.reason) throw new Error(value.error || ('Host returned ' + response.status));
    return value;
  }
  function ensureAudio() {
    if (!soundEnabled) return null;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }
  function tone(frequency, duration, type, gain, delay) {
    const audio = ensureAudio();
    if (!audio) return;
    const start = audio.currentTime + Number(delay || 0);
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    volume.gain.setValueAtTime(0.0001, start);
    volume.gain.exponentialRampToValueAtTime(gain || 0.045, start + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
  function cue(type) {
    if (type === 'collect') tone(480, .09, 'triangle', .035);
    else if (type === 'bank') { tone(320, .13, 'sine', .045); tone(520, .13, 'triangle', .035, .06); }
    else if (type === 'sync-open') { tone(260, .18, 'sawtooth', .05); tone(520, .24, 'triangle', .04, .1); }
    else if (type === 'sync-result') { [330,440,660].forEach((note,index) => tone(note,.2,'triangle',.04,index*.07)); }
    else if (type === 'glitch-warning') tone(145, .22, 'square', .025);
    else if (type === 'glitch-hit') tone(90, .18, 'sawtooth', .04);
    else if (type === 'triad-bank') { [392,523,659].forEach((note,index) => tone(note,.22,'triangle',.05,index*.055)); }
    else if (type === 'glitch-block') { tone(710,.12,'sine',.04); tone(920,.16,'triangle',.035,.05); }
    else if (type === 'setlist-open') { tone(294,.14,'triangle',.03); tone(587,.18,'sine',.035,.08); }
    else if (type === 'setlist-complete') { [440,554,659,880].forEach((note,index) => tone(note,.24,'triangle',.045,index*.055)); }
  }
  function showCallout(text) {
    clearTimeout(calloutTimer);
    els.comboCallout.textContent = text;
    els.comboCallout.hidden = false;
    els.comboCallout.style.animation = 'none';
    void els.comboCallout.offsetWidth;
    els.comboCallout.style.animation = '';
    calloutTimer = setTimeout(() => { els.comboCallout.hidden = true; }, 850);
  }
  function burstFor(event, state) {
    if (!event) return;
    const actor = event.data && state.players[event.data.player];
    const origin = actor || state.core;
    const count = event.type === 'sync-result' ? 74 : event.type === 'setlist-complete' ? 64 : event.type === 'triad-bank' ? 46 : event.type === 'bank' ? 22 : event.type === 'glitch-block' ? 28 : event.type === 'collect' ? 10 : 0;
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 28 + Math.random() * (event.type === 'sync-result' ? 145 : 90);
      particles.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: 1.5 + Math.random() * 3.5,
        color: [ '#66f7ff', '#ffdd69', '#ff6bc7', '#a9ff6b' ][index % 4]
      });
    }
    if (['bank','triad-bank','sync-result','glitch-block','setlist-complete'].includes(event.type)) {
      shockwaves.push({ x: origin.x, y: origin.y, life: 1, color: event.type === 'glitch-block' ? '#a9ff6b' : event.type === 'triad-bank' ? '#ffdd69' : '#66f7ff' });
    }
    if (event.type === 'triad-bank') {
      showCallout('TRIAD! x' + Number(event.data.multiplier || 1).toFixed(2));
      floaters.push({ x: origin.x, y: origin.y - 3, life: 1, text: '+' + event.data.score, color: '#ffe76d' });
      cameraKick = 7;
      flashStrength = .34;
    } else if (event.type === 'sync-result') {
      showCallout(event.data && event.data.perfect ? 'PERFECT CHOIR!' : 'CHOIR SURGE!');
      floaters.push({ x: state.core.x, y: state.core.y - 4, life: 1, text: '+' + (event.data && event.data.award || 0), color: '#ffffff' });
      cameraKick = event.data && event.data.perfect ? 11 : 6;
      flashStrength = event.data && event.data.perfect ? .5 : .25;
    } else if (event.type === 'glitch-block') {
      showCallout('SHIELD SAVE!');
    } else if (event.type === 'setlist-complete') {
      showCallout((event.data && event.data.act && event.data.act.title || 'SETLIST ACT') + ' CLEARED!');
      cameraKick = 9;
      flashStrength = .38;
    } else if (event.type === 'glitch-hit') cameraKick = 8;
  }
  function announceEvent(state) {
    if (state.phase === core.PHASES.LOBBY) {
      lastEventId = null;
      els.eventToast.textContent = 'Start when the room is ready.';
      els.announcer.textContent = 'Start when the room is ready.';
      return;
    }
    const event = state.events && state.events[state.events.length - 1];
    if (!event || event.id === lastEventId) return;
    lastEventId = event.id;
    els.eventToast.textContent = event.message;
    els.announcer.textContent = event.message;
    cue(event.type);
    burstFor(event, state);
  }
  function updateSeats(state) {
    const players = Object.values(state.players).sort((a,b) => a.id.localeCompare(b.id));
    els.seatRail.innerHTML = players.map(player => {
      const pulsed = state.sync && player.pulsedSyncId === state.sync.id;
      return '<article class="seat'+(pulsed?' pulsed':'')+'" style="--seat:'+escapeHtml(player.recipe.color)+'">'+
        '<span class="glyph">'+escapeHtml(player.recipe.glyph)+'</span><div><strong>'+escapeHtml(player.name)+(player.shieldCharges?' <span class="shield">◆ SHIELD</span>':'')+'</strong><small>'+escapeHtml(player.id.toUpperCase())+' · '+escapeHtml(player.type.toUpperCase())+(player.stunnedUntil>state.clockMs?' · SCRAMBLED':'')+'</small></div>'+
        '<span class="cargo">'+player.carrying.length+'/'+core.METRICS.maxCarry+'</span></article>';
    }).join('');
  }
  function replayChallenge(state) {
    const result = state.result || {};
    const setlist = result.setlist;
    if (setlist && setlist.completed < setlist.acts.length) {
      const next = setlist.acts.find(act => act.status !== 'completed');
      return 'Next show: clear ' + (next && next.title || 'more LIVE SETLIST acts') + ' and finish the room’s three-act run.';
    }
    if (!result.perfectSurges) return 'Next show: land one PERFECT CHOIR to arm the whole room with shields.';
    if (Number(result.bestStreak || 0) < 4) return 'Next show: keep four banks inside the 6.5-second chain window.';
    if (result.rank !== 'HEADLINER') return 'Next show: protect the chain and turn every full core into a room-wide pulse.';
    return 'HEADLINER secured. Replay now and beat this room score while keeping everyone in sync.';
  }
  function renderResultDebrief(state) {
    const result = state.result || {};
    const players = Array.isArray(result.players) ? result.players : [];
    const setlist = result.setlist || { completed: 0, acts: [] };
    const show = result.show || state.show || { completedRounds: 0, totalScore: 0, bestScore: 0, bestRank: 'WARM-UP', totalActsCleared: 0, next: null };
    els.resultStats.innerHTML = [
      ['SURGES', Number(result.surges || 0)],
      ['PERFECT', Number(result.perfectSurges || 0)],
      ['BEST CHAIN', Number(result.bestStreak || 0)],
      ['SETLIST', Number(setlist.completed || 0) + ' / ' + setlist.acts.length]
    ].map(item => '<article><small>'+item[0]+'</small><strong>'+item[1]+'</strong></article>').join('');
    const nextTitles = show.next && Array.isArray(show.next.acts) ? show.next.acts.map(act => act.title).join(' · ') : 'new directives';
    const conductor = show.next && show.next.conductor || { title: 'OPENING SET', cue: 'ESTABLISH THE ROOM' };
    const signal = conductor.roomSignal || null;
    els.resultShowMemory.innerHTML = '<b>'+escapeHtml(conductor.title)+' · '+Number(show.completedRounds || 0)+' ROUND'+(Number(show.completedRounds || 0)===1?'':'S')+'</b><span>'+Number(show.totalScore || 0)+' TOTAL · BEST '+Number(show.bestScore || 0)+' / '+escapeHtml(show.bestRank || 'WARM-UP')+' · WHY '+escapeHtml(conductor.cue || conductor.title)+(signal?' · '+escapeHtml(roomSignalLabel(signal)):'')+' · NEXT '+escapeHtml(nextTitles)+'</span>';
    els.resultSetlist.innerHTML = setlist.acts.map(act => '<span class="'+escapeHtml(act.status)+'"><b>'+(act.status === 'completed' ? '✓' : '·')+'</b> '+escapeHtml(act.title)+'</span>').join('');
    els.resultPlayers.innerHTML = players.map(player => {
      const live = state.players[player.id] || {};
      const color = live.recipe && live.recipe.color || '#6df7ff';
      const type = live.type === 'ai' ? 'SUPPORT AI' : 'HUMAN';
      return '<article style="--seat:'+escapeHtml(color)+'"><div><strong>'+escapeHtml(player.name)+'</strong><small>'+type+'</small></div><p><b>'+Number(player.banked || 0)+'</b> banked <b>'+Number(player.pulses || 0)+'</b> pulses <b>'+Number(player.glitchHits || 0)+'</b> hits</p></article>';
    }).join('');
  }
  function updateSetlist(state) {
    const setlist = state.setlist;
    const act = setlist && setlist.activeIndex !== null ? setlist.acts[setlist.activeIndex] : null;
    const visible = state.phase === core.PHASES.PLAYING && act && act.status === 'active';
    els.setlistPanel.hidden = !visible;
    if (!visible) return;
    els.setlistPanel.classList.toggle('human-act', Boolean(act.humanRequired));
    const roundNumber = Math.max(1, Number(state.show && state.show.roundNumber || 1));
    els.setlistAct.textContent = 'ROUND ' + roundNumber + ' · ACT ' + (act.index + 1) + ' / ' + setlist.acts.length + ' · ' + String(setlist.conductor && setlist.conductor.title || 'OPENING SET');
    els.setlistClock.textContent = formatTime(Math.max(0, act.endsAt - state.clockMs));
    els.setlistGlyph.textContent = act.glyph;
    els.setlistTitle.textContent = act.title;
    els.setlistCopy.textContent = act.instruction;
    els.setlistProgress.textContent = act.progress + ' / ' + act.target + (act.humanRequired ? ' · HUMAN LINK' : ' · ROOM FLOW');
    els.setlistFill.style.width = Math.min(100, act.progress / Math.max(1, act.target) * 100) + '%';
  }
  function updateOverlay(state) {
    if (helpOpen) return;
    const showingResults = state.phase === core.PHASES.RESULTS && dismissedResultRevision !== state.revision;
    els.overlayCard.classList.toggle('results', showingResults);
    els.ruleLegend.hidden = showingResults;
    els.resultDebrief.hidden = !showingResults;
    const context = showContext(state);
    updateShowArc(state);
    const canReturn = Boolean(packet && packet.handback && packet.handback.available && context.show.completedRounds > 0 && [core.PHASES.LOBBY, core.PHASES.RESULTS].includes(state.phase));
    els.returnButton.hidden = !canReturn;
    if (returnArmedUntil < Date.now()) {
      els.returnButton.classList.remove('armed');
      els.returnButton.textContent = 'RETURN TO GAME HUB';
    }
    if (state.phase === core.PHASES.LOBBY) {
      els.phaseOverlay.hidden = false;
      els.showBadge.textContent = context.show.completedRounds ? 'LIVE CONDUCTOR · ' + context.conductor.title : "TONIGHT'S MAIN EVENT";
      els.overlayEyebrow.textContent = 'LOCAL CO-OP · ' + Object.keys(state.players).length + ' ACTIVE SEATS' + (context.roomSignal ? ' · ' + roomSignalLabel(context.roomSignal) : '');
      els.overlayTitle.innerHTML = 'Steal the beat.<br><em>Own the spotlight.</em>';
      els.overlayCopy.textContent = context.show.completedRounds
        ? 'The server read the last show receipt. Human seats can now steer its transparent next-round plan from their phones.'
        : 'Build risky TRIADs, pulse together, and clear a changing three-act LIVE SETLIST that gives the room a new plan every round.';
      els.startButton.textContent = 'START 75-SECOND ROUND';
      const clearedActs = Number(context.show.totalActsCleared || 0);
      els.startNote.textContent = context.show.completedRounds
        ? 'WHY: ' + (context.conductor.cue || context.conductor.title) + ' · ' + roomSignalLabel(context.roomSignal) + ' · NEXT: ' + context.nextTitles + ' · ' + context.show.totalScore + ' NIGHT POINTS · ' + clearedActs + ' ACT' + (clearedActs === 1 ? '' : 'S')
        : 'The server chooses one human, one whole-room, and one risk/flow directive; later rounds adapt from the authoritative receipt.';
    } else if (state.phase === core.PHASES.COUNTDOWN) {
      els.phaseOverlay.hidden = false;
      els.showBadge.textContent = 'SHOW ' + context.position.showNumber + ' · ROUND ' + context.position.roundInShow + '/' + core.METRICS.showArcRounds;
      els.overlayEyebrow.textContent = context.conductor.title + ' · READ THE ARENA · SEED ' + state.seed;
      els.overlayTitle.innerHTML = '<em>' + Math.max(1, Math.ceil((state.phaseEndsAt-state.clockMs)/1000)) + '</em>';
      els.overlayCopy.textContent = 'Striped lane means warning. Solid lane means active. Bank at the center.';
      els.startButton.textContent = 'GET READY';
      els.startButton.disabled = true;
      els.startNote.textContent = 'Find your performer, then chase a TRIAD or bank early to stay fast.';
    } else if (showingResults) {
      els.phaseOverlay.hidden = false;
      els.showBadge.textContent = 'SHOW RECEIPT · ROUND ' + context.roundNumber;
      els.overlayEyebrow.textContent = 'SHOW ' + context.position.showNumber + ' · ROUND ' + context.position.roundInShow + '/' + core.METRICS.showArcRounds + ' COMPLETE · ' + (state.result && state.result.rank || rankFor(state.score));
      els.overlayTitle.innerHTML = '<em>' + String(state.score).padStart(4,'0') + '</em> POINTS';
      els.overlayCopy.textContent = replayChallenge(state);
      renderResultDebrief(state);
      els.startButton.textContent = 'PLAY ANOTHER ROUND';
      els.startButton.disabled = false;
      els.startNote.textContent = context.conductor.title + ' · WHY: ' + (context.conductor.cue || context.conductor.title) + (context.roomSignal ? ' · ' + roomSignalLabel(context.roomSignal) : '') + ' · NEXT: ' + context.nextTitles + ' · NIGHT TOTALS SAVED';
    } else {
      els.phaseOverlay.hidden = true;
      els.startButton.disabled = false;
    }
  }
  function updateHud(state) {
    els.score.textContent = String(state.score).padStart(4,'0');
    const context = showContext(state);
    els.rank.textContent = rankFor(state.score) + ' · R' + context.roundNumber;
    els.charge.textContent = Math.round(state.core.charge);
    els.chargeFill.style.width = Math.min(100,state.core.charge) + '%';
    els.timer.textContent = formatTime(state.timeLeftMs);
    els.phase.textContent = state.phase.toUpperCase();
    els.surges.textContent = state.surgeCount;
    els.bestSync.textContent = 'BEST SYNC ' + state.bestSync;
    els.combo.textContent = 'x' + Number(state.harmony && state.harmony.multiplier || 1).toFixed(2);
    els.streak.textContent = 'CHAIN ' + Number(state.harmony && state.harmony.streak || 0);
    els.combo.closest('.harmony').classList.toggle('hot', Boolean(state.harmony && state.harmony.streak >= 3));
    els.revision.textContent = 'R' + state.revision;
    els.syncBanner.hidden = !state.sync;
    if (state.sync) {
      const pulsed = new Set(state.sync.pulses.map(item => item.player));
      els.syncDots.innerHTML = Object.values(state.players).sort((a,b)=>a.id.localeCompare(b.id)).map(player => '<i class="'+(pulsed.has(player.id)?'on':'')+'" title="'+escapeHtml(player.name)+'"></i>').join('');
    }
    updateSetlist(state);
    announceEvent(state);
    updateSeats(state);
    updateOverlay(state);
    if (resetArmedUntil < Date.now()) els.resetButton.textContent = resetLabel(state);
  }
  async function poll() {
    if (polling) return;
    polling = true;
    try {
      const next = await api('/api/state');
      packet = next;
      Object.values(next.state.players || {}).forEach(player => {
        sequences[player.id] = Math.max(Number(sequences[player.id] || 0), Number(player.lastSequence || 0));
      });
      connected = true;
      els.network.classList.add('ok');
      const recovered = next.recovery && next.recovery.status === 'restored';
      els.network.classList.toggle('restored', Boolean(recovered));
      els.network.querySelector('span').textContent = recovered ? 'HOST RESTORED' : 'HOST LIVE';
      updateHud(next.state);
    } catch (error) {
      connected = false;
      els.network.classList.remove('ok');
      els.network.classList.remove('restored');
      els.network.querySelector('span').textContent = 'RECONNECTING';
      els.eventToast.textContent = error.message;
    } finally { polling = false; }
  }
  function scaleInfo() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(320, rect.width);
    const height = Math.max(300, rect.height);
    if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) {
      canvas.width = Math.round(width*dpr);
      canvas.height = Math.round(height*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const pad = Math.max(24,Math.min(width,height)*.055);
    const scale = Math.min((width-pad*2)/core.METRICS.arenaWidth,(height-pad*2)/core.METRICS.arenaHeight);
    return { width,height,pad,scale,ox:(width-core.METRICS.arenaWidth*scale)/2,oy:(height-core.METRICS.arenaHeight*scale)/2 };
  }
  function point(view,x,y){return{x:view.ox+x*view.scale,y:view.oy+y*view.scale}}
  function drawShape(kind,x,y,r,color,filled,rotation) {
    ctx.save();ctx.translate(x,y);ctx.rotate(rotation||0);ctx.beginPath();
    if(kind==='triangle'){ctx.moveTo(0,-r);ctx.lineTo(r*.88,r*.65);ctx.lineTo(-r*.88,r*.65);ctx.closePath()}
    else if(kind==='square'){ctx.rect(-r*.72,-r*.72,r*1.44,r*1.44)}
    else if(kind==='diamond'){ctx.moveTo(0,-r);ctx.lineTo(r,0);ctx.lineTo(0,r);ctx.lineTo(-r,0);ctx.closePath()}
    else{ctx.arc(0,0,r,0,Math.PI*2)}
    ctx.shadowColor=color;ctx.shadowBlur=filled?18:10;ctx.lineWidth=Math.max(2,r*.18);ctx.strokeStyle=color;ctx.fillStyle=color;filled?ctx.fill():ctx.stroke();ctx.restore();
  }
  function drawCover(image,width,height) {
    const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.drawImage(image,(width-w)/2,(height-h)/2,w,h);
  }
  function drawArena(view,state,time) {
    ctx.fillStyle='#050510';ctx.fillRect(0,0,view.width,view.height);
    if(arenaArt.complete&&arenaArt.naturalWidth){ctx.save();ctx.globalAlpha=document.body.classList.contains('high-contrast')?.2:.76;drawCover(arenaArt,view.width,view.height);ctx.restore()}
    const wash=ctx.createLinearGradient(0,0,0,view.height);wash.addColorStop(0,'#09041b22');wash.addColorStop(.5,'#070a1890');wash.addColorStop(1,'#02030bd0');ctx.fillStyle=wash;ctx.fillRect(0,0,view.width,view.height);
    const motion=document.body.classList.contains('reduced-motion')?0:1;
    ctx.save();ctx.globalCompositeOperation='screen';
    ['#41dfff','#ff4fb9','#ffc94f','#a9ff6b'].forEach((color,index)=>{const anchor=(index+.5)*view.width/4;const sway=Math.sin(time*.00035+index*1.9)*view.width*.035*motion;const beam=ctx.createLinearGradient(anchor,0,view.width*.5,view.height*.7);beam.addColorStop(0,color+'32');beam.addColorStop(1,color+'00');ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(anchor-18+sway,-10);ctx.lineTo(anchor+18+sway,-10);ctx.lineTo(view.width*.5+(index-1.5)*55,view.height*.74);ctx.closePath();ctx.fill()});ctx.restore();
    const center=point(view,core.METRICS.coreX,core.METRICS.coreY);
    ctx.save();for(let ring=12;ring<=42;ring+=10){ctx.strokeStyle=ring%20?'#4cf5ff20':'#ff5fc525';ctx.lineWidth=ring===42?3:1;ctx.setLineDash(ring===32?[8,9]:[]);ctx.lineDashOffset=-time*.012*motion;ctx.beginPath();ctx.arc(center.x,center.y,ring*view.scale,0,Math.PI*2);ctx.stroke()}ctx.setLineDash([]);
    for(let x=0;x<=core.METRICS.arenaWidth;x+=10){const a=point(view,x,0),b=point(view,x,core.METRICS.arenaHeight);ctx.strokeStyle='#a9b5ff0b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    for(let y=0;y<=core.METRICS.arenaHeight;y+=10){const a=point(view,0,y),b=point(view,core.METRICS.arenaWidth,y);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
    const tl=point(view,0,0),br=point(view,core.METRICS.arenaWidth,core.METRICS.arenaHeight);ctx.strokeStyle='#bca9ff78';ctx.lineWidth=3;ctx.shadowColor='#8f68ff';ctx.shadowBlur=18;ctx.strokeRect(tl.x,tl.y,br.x-tl.x,br.y-tl.y);ctx.restore();
    if(state.glitch){const g=state.glitch,active=g.phase==='active',thickness=core.METRICS.glitchThickness*view.scale;ctx.save();ctx.globalAlpha=active?.82:.58;const start=g.axis==='horizontal'?point(view,0,g.line):point(view,g.line,0);const x=g.axis==='horizontal'?view.ox:start.x-thickness/2,y=g.axis==='horizontal'?start.y-thickness/2:view.oy,w=g.axis==='horizontal'?core.METRICS.arenaWidth*view.scale:thickness,h=g.axis==='horizontal'?thickness:core.METRICS.arenaHeight*view.scale;const lane=ctx.createLinearGradient(x,y,x+w,y+h);lane.addColorStop(0,active?'#ff185f':'#ffca46');lane.addColorStop(.5,active?'#a900ff':'#ffea92');lane.addColorStop(1,active?'#ff185f':'#ffca46');ctx.fillStyle=lane;ctx.shadowColor=active?'#ff2f87':'#ffe16a';ctx.shadowBlur=28;ctx.fillRect(x,y,w,h);ctx.shadowBlur=0;if(!active){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalAlpha=.7;ctx.strokeStyle='#18091f';ctx.lineWidth=7;for(let offset=-view.height;offset<view.width+view.height;offset+=20){ctx.beginPath();ctx.moveTo(offset+(time*.05*motion)%20,0);ctx.lineTo(offset-view.height+(time*.05*motion)%20,view.height);ctx.stroke()}ctx.restore()}ctx.globalAlpha=1;ctx.fillStyle=active?'#fff':'#241126';ctx.font='1000 '+Math.max(10,thickness*.3)+'px ui-monospace,monospace';ctx.textAlign='center';const label=active?'GLITCH ACTIVE':'WARNING - MOVE';if(g.axis==='horizontal')ctx.fillText(label,x+w/2,y+h*.66);else{ctx.translate(x+w*.62,y+h/2);ctx.rotate(-Math.PI/2);ctx.fillText(label,0,0)}ctx.restore()}
  }
  function drawCore(view,state,time) {
    const p=point(view,state.core.x,state.core.y),r=state.core.radius*view.scale,charged=state.core.charge/100,motion=document.body.classList.contains('reduced-motion')?0:1;ctx.save();ctx.translate(p.x,p.y);const pulse=1+Math.sin(time*.005)*.045*motion;ctx.scale(pulse,pulse);ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(0,r*.82,r*1.18,r*.43,0,0,Math.PI*2);ctx.fill();
    for(let ring=1;ring<=3;ring+=1){ctx.strokeStyle=ring===2?'#ff5cc355':'#6df7ff4a';ctx.lineWidth=Math.max(2,r*.045);ctx.setLineDash(ring===3?[6,7]:[]);ctx.lineDashOffset=time*.02*(ring%2?1:-1)*motion;ctx.beginPath();ctx.arc(0,0,r*(1+.19*ring),0,Math.PI*2);ctx.stroke()}ctx.setLineDash([]);
    const orb=ctx.createRadialGradient(-r*.24,-r*.3,r*.08,0,0,r*.9);orb.addColorStop(0,'#ffffff');orb.addColorStop(.18,state.sync?'#ffd1f1':'#9fffff');orb.addColorStop(.55,state.sync?'#ff4fb9':'#1f82ad');orb.addColorStop(1,'#090a20');ctx.fillStyle=orb;ctx.shadowColor=state.sync?'#ff54c6':'#58edff';ctx.shadowBlur=state.sync?50:22+charged*22;ctx.beginPath();ctx.arc(0,0,r*.82,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=state.sync?'#fff':'#70f7ff';ctx.lineWidth=Math.max(5,r*.13);ctx.lineCap='round';ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,-Math.PI/2+Math.PI*2*charged);ctx.stroke();ctx.lineCap='butt';
    for(let i=0;i<18;i+=1){const a=i/18*Math.PI*2+time*.00025*motion,len=r*(.16+.12*Math.sin(time*.009+i));ctx.save();ctx.rotate(a);ctx.fillStyle=i/18<charged?'#ffe26a':'#7882b844';ctx.fillRect(r*1.43,-2,len,4);ctx.restore()}
    ctx.shadowBlur=0;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='1000 '+Math.max(15,r*.4)+'px "Arial Black",Impact,sans-serif';ctx.fillText(Math.round(state.core.charge)+'%',0,5);ctx.font='900 '+Math.max(8,r*.14)+'px ui-monospace,monospace';ctx.fillStyle=state.sync?'#fff':'#b9d9ee';ctx.fillText(state.sync?'PULSE NOW':'BANK THE BEAT',0,r*.43);ctx.restore();
  }
  function drawBeats(view,state,time) {
    const motion=document.body.classList.contains('reduced-motion')?0:1;
    state.beats.forEach((beat,index)=>{const recipe=core.BEAT_TYPES[beat.kind],p=point(view,beat.x,beat.y),r=core.METRICS.beatRadius*view.scale*(1+Math.sin(time*.006+index)*.09*motion);ctx.save();const aura=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*2.4);aura.addColorStop(0,recipe.color+'55');aura.addColorStop(1,recipe.color+'00');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(p.x,p.y,r*2.4,0,Math.PI*2);ctx.fill();ctx.strokeStyle=recipe.color+'66';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,r*1.42+Math.sin(time*.008+index)*2*motion,0,Math.PI*2);ctx.stroke();ctx.restore();drawShape(recipe.shape,p.x,p.y,r,recipe.color,true,time*.00065*(index%2?1:-1)*motion);ctx.fillStyle=recipe.ink||'#071019';ctx.font='1000 '+Math.max(9,r*.62)+'px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(recipe.glyph,p.x,p.y+r*.23);ctx.fillStyle='#fff';ctx.font='900 '+Math.max(7,r*.34)+'px ui-monospace,monospace';ctx.fillText('+'+recipe.value+'%',p.x,p.y+r*1.75)});
  }
  function drawPlayers(view,state,time) {
    const motion=document.body.classList.contains('reduced-motion')?0:1;
    Object.values(state.players).forEach((player,index)=>{let display=displayPlayers.get(player.id);if(!display){display={x:player.x,y:player.y};displayPlayers.set(player.id,display)}display.x+=(player.x-display.x)*(motion?.3:1);display.y+=(player.y-display.y)*(motion?.3:1);let trail=trails.get(player.id)||[];if(!trail.length||Math.hypot(display.x-trail[trail.length-1].x,display.y-trail[trail.length-1].y)>.45)trail.push({x:display.x,y:display.y});if(trail.length>10)trail.shift();trails.set(player.id,trail);ctx.save();ctx.lineCap='round';trail.forEach((node,nodeIndex)=>{if(nodeIndex===0)return;const a=point(view,trail[nodeIndex-1].x,trail[nodeIndex-1].y),b=point(view,node.x,node.y);ctx.globalAlpha=nodeIndex/trail.length*.28;ctx.strokeStyle=player.recipe.color;ctx.lineWidth=Math.max(2,nodeIndex/trail.length*8);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()});ctx.restore();
      const p=point(view,display.x,display.y),r=core.METRICS.playerRadius*view.scale,stunned=player.stunnedUntil>state.clockMs;ctx.save();ctx.translate(p.x,p.y);if(stunned){ctx.rotate(Math.sin(time*.03)*.14*motion);ctx.globalAlpha=.68}ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(0,r*.82,r*1.05,r*.43,0,0,Math.PI*2);ctx.fill();ctx.shadowColor=player.recipe.color;ctx.shadowBlur=24;const body=ctx.createLinearGradient(-r,-r,r,r);body.addColorStop(0,'#ffffff');body.addColorStop(.16,player.recipe.color);body.addColorStop(1,'#17132e');ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-r*.72,-r*.22);ctx.quadraticCurveTo(-r*.82,r*.86,0,r*1.02);ctx.quadraticCurveTo(r*.82,r*.86,r*.72,-r*.22);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#100c24';ctx.strokeStyle=player.recipe.color;ctx.lineWidth=Math.max(2,r*.1);ctx.beginPath();ctx.arc(0,-r*.56,r*.7,0,Math.PI*2);ctx.fill();ctx.stroke();const visor=ctx.createLinearGradient(-r*.4,0,r*.5,0);visor.addColorStop(0,'#14244b');visor.addColorStop(.5,'#baffff');visor.addColorStop(1,player.recipe.color);ctx.fillStyle=visor;ctx.beginPath();ctx.ellipse(0,-r*.58,r*.48,r*.27,0,0,Math.PI*2);ctx.fill();drawShape(player.recipe.shape,0,r*.34,r*.3,player.recipe.color,true,time*.0004*(index%2?1:-1)*motion);
      ctx.fillStyle='#070812e8';ctx.strokeStyle=player.recipe.color+'99';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(-r*1.15,-r*1.72,r*2.3,r*.52,r*.24);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 '+Math.max(8,r*.3)+'px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText(player.name,0,-r*1.36);
      player.carrying.forEach((kind,cargoIndex)=>{const recipe=core.BEAT_TYPES[kind];drawShape(recipe.shape,(cargoIndex-1)*r*.74,r*1.48,r*.27,recipe.color,true,time*.001*motion)});
      if(player.shieldCharges){ctx.strokeStyle='#cfffff';ctx.shadowColor='#6df7ff';ctx.shadowBlur=17;ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.lineDashOffset=-time*.02*motion;ctx.beginPath();ctx.arc(0,0,r*1.34,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])}
      if(state.sync&&player.pulsedSyncId===state.sync.id){ctx.strokeStyle='#fff';ctx.shadowColor=player.recipe.color;ctx.shadowBlur=20;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r*1.5+Math.sin(time*.015)*4*motion,0,Math.PI*2);ctx.stroke()}ctx.restore()});
  }
  function drawEffects(view,dt) {
    const motion=document.body.classList.contains('reduced-motion')?0:1;ctx.save();ctx.globalCompositeOperation='lighter';for(let index=particles.length-1;index>=0;index-=1){const p=particles[index];p.x+=p.vx*dt/1000*motion;p.y+=p.vy*dt/1000*motion;p.vx*=.955;p.vy*=.955;p.life-=dt/850;if(p.life<=0){particles.splice(index,1);continue}const q=point(view,p.x,p.y);ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(q.x,q.y,p.size*Math.max(.35,p.life),0,Math.PI*2);ctx.fill()}ctx.restore();
    for(let index=shockwaves.length-1;index>=0;index-=1){const wave=shockwaves[index];wave.life-=dt/700;if(wave.life<=0){shockwaves.splice(index,1);continue}const q=point(view,wave.x,wave.y),radius=(1-wave.life)*20*view.scale;ctx.save();ctx.globalAlpha=wave.life*.8;ctx.strokeStyle=wave.color;ctx.lineWidth=Math.max(2,wave.life*8);ctx.shadowColor=wave.color;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(q.x,q.y,radius,0,Math.PI*2);ctx.stroke();ctx.restore()}
    for(let index=floaters.length-1;index>=0;index-=1){const f=floaters[index];f.life-=dt/1050;f.y-=dt*.009*motion;if(f.life<=0){floaters.splice(index,1);continue}const q=point(view,f.x,f.y);ctx.save();ctx.globalAlpha=Math.min(1,f.life*1.7);ctx.fillStyle=f.color;ctx.shadowColor=f.color;ctx.shadowBlur=18;ctx.textAlign='center';ctx.font='1000 '+Math.max(20,view.scale*4.4)+'px "Arial Black",Impact,sans-serif';ctx.fillText(f.text,q.x,q.y);ctx.restore()}
    if(flashStrength>0){ctx.save();ctx.globalAlpha=flashStrength;const flash=ctx.createRadialGradient(view.width*.5,view.height*.5,0,view.width*.5,view.height*.5,view.width*.65);flash.addColorStop(0,'#ffffff');flash.addColorStop(.3,'#62f4ff');flash.addColorStop(1,'#ff4fb900');ctx.fillStyle=flash;ctx.fillRect(0,0,view.width,view.height);ctx.restore();flashStrength=Math.max(0,flashStrength-dt/420)}
  }
  function render(now) {
    const started=performance.now(),dt=Math.min(50,now-lastFrameAt);lastFrameAt=now;const baseView=scaleInfo(),motion=document.body.classList.contains('reduced-motion')?0:1;if(packet){const strength=cameraKick*motion,view=Object.assign({},baseView,{ox:baseView.ox+(Math.random()-.5)*strength,oy:baseView.oy+(Math.random()-.5)*strength});cameraKick=Math.max(0,cameraKick-dt*.025);drawArena(view,packet.state,now);drawBeats(view,packet.state,now);drawCore(view,packet.state,now);drawPlayers(view,packet.state,now);drawEffects(view,dt)}else{ctx.fillStyle='#070816';ctx.fillRect(0,0,baseView.width,baseView.height)}
    const cost=performance.now()-started;renderSamples.push(cost);if(renderSamples.length>90)renderSamples.shift();if(Math.floor(now/500)!==Math.floor((now-dt)/500)){const avg=renderSamples.reduce((sum,value)=>sum+value,0)/Math.max(1,renderSamples.length);els.frameCost.textContent=avg.toFixed(1)+' MS';els.frameCost.style.color=avg>core.METRICS.frameBudgetMs?'#ff637d':'#dff'}
    pollGamepads();requestAnimationFrame(render);
  }
  function vectorFor(profile) {
    return {x:(heldKeys.has(profile.right)?1:0)-(heldKeys.has(profile.left)?1:0),y:(heldKeys.has(profile.down)?1:0)-(heldKeys.has(profile.up)?1:0)};
  }
  async function sendAction(player,action) {
    if(!connected)return;sequences[player]=(sequences[player]||0)+1;try{await api('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({player,action:Object.assign({},action,{seq:sequences[player]})})})}catch(error){if(!/stale-sequence/.test(error.message))els.eventToast.textContent=error.message}
  }
  function sendKeyboardVectors() {
    if(!packet)return;Object.entries(keyProfiles).forEach(([player,profile])=>{if(!packet.state.players[player]||packet.state.players[player].type==='ai')return;const vector=vectorFor(profile);const key=vector.x+','+vector.y;if(lastSentVectors.get(player)===key)return;lastSentVectors.set(player,key);sendAction(player,{type:'move',x:vector.x,y:vector.y})})
  }
  function pollGamepads() {
    if(!packet||!navigator.getGamepads)return;Array.from(navigator.getGamepads()).filter(Boolean).slice(0,4).forEach((pad,index)=>{const player='p'+(index+1);if(!packet.state.players[player]||packet.state.players[player].type==='ai')return;const dead=.18;const x=Math.abs(pad.axes[0]||0)>dead?(pad.axes[0]||0):0;const y=Math.abs(pad.axes[1]||0)>dead?(pad.axes[1]||0):0;const key=x.toFixed(2)+','+y.toFixed(2);if(lastSentVectors.get('pad-'+player)!==key){lastSentVectors.set('pad-'+player,key);sendAction(player,{type:'move',x,y})}const pressed=Boolean(pad.buttons[0]&&pad.buttons[0].pressed);if(pressed&&!gamepadPulse.get(index))sendAction(player,{type:'pulse'});gamepadPulse.set(index,pressed)})
  }
  document.addEventListener('keydown',event=>{if(event.repeat)return;const code=event.code;if(['Space','Enter','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))event.preventDefault();if(code==='KeyH'){helpOpen=!helpOpen;els.helpOverlay.hidden=!helpOpen;return}if(code==='KeyM'){els.motionToggle.click();return}if(code==='KeyC'){els.contrastToggle.click();return}if(code==='Escape'){helpOpen=false;els.helpOverlay.hidden=true;if(packet&&packet.state.phase===core.PHASES.RESULTS){dismissedResultRevision=packet.state.revision;els.phaseOverlay.hidden=true}return}heldKeys.add(code);Object.entries(keyProfiles).forEach(([player,profile])=>{if(code===profile.pulse)sendAction(player,{type:'pulse'})});sendKeyboardVectors()});
  document.addEventListener('keyup',event=>{heldKeys.delete(event.code);sendKeyboardVectors()});
  setInterval(sendKeyboardVectors,90);
  els.startButton.addEventListener('click',async()=>{ensureAudio();els.startButton.disabled=true;try{await api('/api/start',{method:'POST'});dismissedResultRevision=-1;await poll()}catch(error){els.eventToast.textContent=error.message}finally{els.startButton.disabled=false}});
  els.returnButton.addEventListener('click',async()=>{const now=Date.now();if(returnArmedUntil<now){returnArmedUntil=now+3500;els.returnButton.classList.add('armed');els.returnButton.textContent='CONFIRM RETURN · SAVE SHOW';setTimeout(()=>{if(returnArmedUntil<=Date.now()){els.returnButton.classList.remove('armed');els.returnButton.textContent='RETURN TO GAME HUB'}},3600);return}returnArmedUntil=0;els.returnButton.classList.remove('armed');els.returnButton.disabled=true;els.returnButton.textContent='SAVING SHOW…';try{const result=await api('/api/finish-show',{method:'POST'});if(!result.ok)throw new Error(result.reason||'show handback refused');els.startButton.disabled=true;els.returnButton.textContent='SHOW SAVED · RETURNING';els.overlayCopy.textContent='The authoritative show receipt is saved. Returning the room to Game Hub.';if(result.handback&&result.handback.hubUrl)setTimeout(()=>{location.href=result.handback.hubUrl},420)}catch(error){els.returnButton.disabled=false;els.returnButton.textContent='RETURN TO GAME HUB';els.eventToast.textContent=error.message}});
  els.closeHelp.addEventListener('click',()=>{helpOpen=false;els.helpOverlay.hidden=true});
  els.soundToggle.addEventListener('click',()=>{soundEnabled=!soundEnabled;els.soundToggle.setAttribute('aria-pressed',String(soundEnabled));els.soundToggle.textContent=soundEnabled?'Sound on':'Sound off';if(soundEnabled){ensureAudio();tone(440,.12,'triangle',.04)}});
  els.motionToggle.addEventListener('click',()=>{const on=document.body.classList.toggle('reduced-motion');els.motionToggle.setAttribute('aria-pressed',String(on));els.motionToggle.textContent=on?'Reduced motion on':'Reduced motion'});
  els.contrastToggle.addEventListener('click',()=>{const on=document.body.classList.toggle('high-contrast');els.contrastToggle.setAttribute('aria-pressed',String(on));els.contrastToggle.textContent=on?'High contrast on':'High contrast'});
  els.resetButton.addEventListener('click',async()=>{const now=Date.now(),state=packet&&packet.state,mode=resetMode(state);if(resetArmedUntil<now){resetArmedUntil=now+3500;els.resetButton.classList.add('armed');els.resetButton.textContent=mode==='new-show'?'Confirm new show · clear night memory':'Confirm reset · lose current score';setTimeout(()=>{if(resetArmedUntil<=Date.now()){els.resetButton.classList.remove('armed');els.resetButton.textContent=resetLabel(packet&&packet.state)}},3600);return}resetArmedUntil=0;els.resetButton.classList.remove('armed');await api(mode==='new-show'?'/api/new-show':'/api/reset',{method:'POST'});await poll()});

  poll();setInterval(poll,120);requestAnimationFrame(render);
})();
