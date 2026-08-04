(function () {
  'use strict';

  const core = window.MirrorShiftCore;
  const mirrorEchoCore = window.MirrorShiftEcho;
  const mirrorEchoVault = mirrorEchoCore.createMirrorEchoVault();
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const lobby = document.getElementById('lobby');
  const countdown = document.getElementById('countdown');
  const countdownNumber = document.getElementById('countdownNumber');
  const startGridHeading = document.getElementById('startGridHeading');
  const startGridRoster = document.getElementById('startGridRoster');
  const results = document.getElementById('results');
  const raceHud = document.getElementById('raceHud');
  const gameFrame = document.querySelector('.game-frame');
  const connectionStatus = document.getElementById('connectionStatus');
  const statusLive = document.getElementById('screenReaderStatus');
  const stateView = {
    packet: null,
    state: null,
    previousState: null,
    stateReceivedAt: performance.now(),
    packetIntervalMs: 90,
    interpolationFrames: 0,
    poseSnapFrames: 0,
    connected: false,
    lastEventId: 0,
    lastPhase: null,
    startGridSignature: null,
    startGridStartedAt: performance.now(),
    resultSignature: null,
    resultStageStartedAt: performance.now()
  };
  const keys = new Set();
  const KEYBOARD_LAYOUTS = Object.freeze({
    hybrid: { label: 'WASD / ARROWS', left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], gas: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], item: ['Space'] },
    ijkl: { label: 'IJKL', left: ['KeyJ'], right: ['KeyL'], gas: ['KeyI'], brake: ['KeyK'], item: ['KeyU'] },
    esdf: { label: 'ESDF', left: ['KeyS'], right: ['KeyF'], gas: ['KeyE'], brake: ['KeyD'], item: ['KeyA'] }
  });
  let keyboardLayout = 'hybrid';
  try {
    const savedLayout = window.localStorage.getItem('mirrorshift-keyboard-layout');
    if (KEYBOARD_LAYOUTS[savedLayout]) keyboardLayout = savedLayout;
  } catch (_) {}
  const touch = { left: false, right: false, gas: false, brake: false };
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actionSequence = 1;
  let actionSessionId = null;
  try { actionSessionId = window.sessionStorage.getItem('mirrorshift-screen-session'); } catch (_) {}
  if (!/^[a-zA-Z0-9._:-]{8,96}$/.test(actionSessionId || '')) {
    const token = window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    actionSessionId = 'screen-p1-' + token;
    try { window.sessionStorage.setItem('mirrorshift-screen-session', actionSessionId); } catch (_) {}
  }
  let actionSessionReady = false;
  let actionSessionSync = null;
  let actionChain = Promise.resolve();
  let actionRequestCount = 0;
  let lastActionRtt = null;
  let pollBusy = false;
  let lastIntent = '';
  let muted = false;
  let audioContext = null;
  let engineNodes = null;
  let musicDirector = null;
  let lastFrameAt = performance.now();
  const frameSamples = [];
  const renderSamples = [];
  const renderStageSamples = [];
  const uiUpdateSamples = [];
  let frameCount = 0;

  window.__MIRRORSHIFT_DIAGNOSTICS__ = {
    renderer: 'canvas-2d',
    reducedMotion: reducedMotion,
    targetFrameMs: 16.7,
    sampleCount: 0,
    averageFrameMs: null,
    p95FrameMs: null,
    longFrameRate: null
  };
  window.__MIRRORSHIFT_RENDER__ = {
    schema: 'axm.render-performance-diagnostics/v1',
    targetFrameMs: 16.7,
    sampleCount: 0,
    averageRenderMs: null,
    p95RenderMs: null,
    stageAverageMs: { track: null, actors: null, effects: null, audio: null },
    authorityPacketMs: null,
    interpolationFrames: 0,
    poseSnapFrames: 0,
    uiUpdateAverageMs: null,
    uiUpdateP95Ms: null,
    schedulingWaitMs: null,
    schedulerLimited: false,
    workload: 'waiting-for-state'
  };
  window.__MIRRORSHIFT_AUDIO__ = {
    schema: 'axm.adaptive-music-diagnostics/v1',
    schedulerActive: false,
    stateId: 'forge-lobby',
    intensity: 0,
    tempo: 108,
    layers: ['pulse'],
    transitions: 0,
    scheduledNotes: 0,
    muted: false
  };
  window.__MIRRORSHIFT_EXPRESSION__ = {
    schema: 'axm.character-expression-diagnostics/v1',
    changesPerformance: false,
    characterId: 'p1',
    expressionId: core.CHARACTER_EXPRESSIONS.p1.id,
    lastCue: null,
    lastCueReason: null,
    cuesPlayed: 0,
    scheduledNotes: 0,
    activeVisual: null,
    visualFrames: 0,
    audioStatus: 'waiting-for-gesture'
  };
  window.__MIRRORSHIFT_KINETIC__ = {
    schema: 'axm.vehicle-animation-diagnostics/v1',
    poseSchema: 'axm.vehicle-animation-pose/v1',
    changesPerformance: false,
    characterId: 'p1',
    rigId: core.KINETIC_RIGS.p1.id,
    motion: core.KINETIC_RIGS.p1.motion,
    state: 'idle',
    reducedMotion: false,
    poseFrames: 0,
    maxBodyLift: 0,
    maxBodyRoll: 0,
    statesObserved: { idle: 0, drive: 0, brake: 0, drift: 0, boost: 0, impact: 0 }
  };
  window.__MIRRORSHIFT_RESULT_STAGE__ = {
    schema: 'axm.result-stage-diagnostics/v1',
    poseSchema: 'axm.result-stage-pose/v1',
    visible: false,
    entrantCount: 0,
    winnerId: null,
    reducedMotion: reducedMotion,
    changesPerformance: false,
    changesAuthority: false,
    poseFrames: 0,
    maxObservedLift: 0,
    moments: []
  };
  window.__MIRRORSHIFT_START_GRID__ = {
    schema: 'axm.start-grid-diagnostics/v1',
    poseSchema: 'axm.start-grid-pose/v1',
    visible: false,
    entrantCount: 0,
    reducedMotion: reducedMotion,
    changesPerformance: false,
    changesAuthority: false,
    poseFrames: 0,
    maxObservedLift: 0,
    moments: []
  };
  const initialEnvironmentPose = core.environmentChoreographyPose(core.TRACK_IDS.FORGE, 0, reducedMotion);
  window.__MIRRORSHIFT_ENVIRONMENT__ = {
    schema: 'axm.environment-choreography-diagnostics/v1',
    poseSchema: initialEnvironmentPose.schema,
    environmentId: initialEnvironmentPose.environmentId,
    choreographyId: initialEnvironmentPose.choreographyId,
    choreographyLabel: initialEnvironmentPose.choreographyLabel,
    motion: initialEnvironmentPose.motion,
    reducedMotion: reducedMotion,
    changesPerformance: false,
    changesAuthority: false,
    visualFrames: 0,
    phase: initialEnvironmentPose.phase,
    glow: initialEnvironmentPose.glow
  };
  window.__MIRRORSHIFT_ECHO__ = mirrorEchoVault.snapshot();
  window.__MIRRORSHIFT_ROUTE__ = {
    schema: 'axm.route-direction/v1',
    routeDirectionId: core.ROUTE_DIRECTION_IDS.FORWARD,
    label: core.ROUTE_DIRECTIONS[core.ROUTE_DIRECTION_IDS.FORWARD].label,
    changesVehicleStats: false,
    changesCatchup: false,
    lobbyLocked: true
  };
  window.__MIRRORSHIFT_VARIANT__ = {
    schema: 'axm.race-variant-diagnostics/v1',
    variantId: core.RACE_VARIANT_IDS.CLEAR,
    label: core.RACE_VARIANTS[core.RACE_VARIANT_IDS.CLEAR].label,
    raceLaps: 3,
    changesVehicleStats: false,
    changesCatchup: false,
    lobbyLocked: true,
    visual: core.RACE_VARIANTS[core.RACE_VARIANT_IDS.CLEAR].visual,
    visualFrames: 0
  };
  function syncVariantDiagnostics(state) {
    const variant = core.raceVariantFor(state && state.variantId);
    const diagnostics = window.__MIRRORSHIFT_VARIANT__;
    diagnostics.variantId = variant.id;
    diagnostics.label = variant.label;
    diagnostics.raceLaps = state && state.raceLaps || variant.laps;
    diagnostics.changesVehicleStats = variant.changesVehicleStats;
    diagnostics.changesCatchup = variant.changesCatchup;
    diagnostics.lobbyLocked = variant.lobbyLocked;
    diagnostics.visual = variant.visual;
    gameFrame.dataset.variantSchema = diagnostics.schema;
    gameFrame.dataset.variantId = diagnostics.variantId;
    gameFrame.dataset.variantLabel = diagnostics.label;
    gameFrame.dataset.variantRaceLaps = String(diagnostics.raceLaps);
    gameFrame.dataset.variantChangesVehicleStats = String(diagnostics.changesVehicleStats);
    gameFrame.dataset.variantChangesCatchup = String(diagnostics.changesCatchup);
    gameFrame.dataset.variantLobbyLocked = String(diagnostics.lobbyLocked);
    gameFrame.dataset.variantVisual = diagnostics.visual;
    gameFrame.dataset.variantVisualFrames = String(diagnostics.visualFrames);
  }
  function syncRouteDiagnostics(state) {
    const direction = core.routeDirectionFor(state && state.routeDirectionId);
    const diagnostics = window.__MIRRORSHIFT_ROUTE__;
    diagnostics.routeDirectionId = direction.id;
    diagnostics.label = direction.label;
    diagnostics.changesVehicleStats = direction.changesVehicleStats;
    diagnostics.changesCatchup = direction.changesCatchup;
    diagnostics.lobbyLocked = direction.lobbyLocked;
    gameFrame.dataset.routeSchema = diagnostics.schema;
    gameFrame.dataset.routeDirection = diagnostics.routeDirectionId;
    gameFrame.dataset.routeLabel = diagnostics.label;
    gameFrame.dataset.routeChangesVehicleStats = String(diagnostics.changesVehicleStats);
    gameFrame.dataset.routeChangesCatchup = String(diagnostics.changesCatchup);
    gameFrame.dataset.routeLobbyLocked = String(diagnostics.lobbyLocked);
  }
  function syncEnvironmentDiagnostics(pose) {
    const diagnostics = window.__MIRRORSHIFT_ENVIRONMENT__;
    diagnostics.poseSchema = pose.schema;
    diagnostics.environmentId = pose.environmentId;
    diagnostics.choreographyId = pose.choreographyId;
    diagnostics.choreographyLabel = pose.choreographyLabel;
    diagnostics.motion = pose.motion;
    diagnostics.reducedMotion = pose.reducedMotion;
    diagnostics.changesPerformance = pose.changesPerformance;
    diagnostics.changesAuthority = pose.changesAuthority;
    diagnostics.visualFrames += 1;
    diagnostics.phase = pose.phase;
    diagnostics.glow = pose.glow;
    gameFrame.dataset.environmentSchema = diagnostics.schema;
    gameFrame.dataset.environmentPoseSchema = diagnostics.poseSchema;
    gameFrame.dataset.environmentId = diagnostics.environmentId;
    gameFrame.dataset.environmentChoreography = diagnostics.choreographyId;
    gameFrame.dataset.environmentMotion = diagnostics.motion;
    gameFrame.dataset.environmentReducedMotion = String(diagnostics.reducedMotion);
    gameFrame.dataset.environmentChangesPerformance = String(diagnostics.changesPerformance);
    gameFrame.dataset.environmentChangesAuthority = String(diagnostics.changesAuthority);
    gameFrame.dataset.environmentVisualFrames = String(diagnostics.visualFrames);
  }
  syncVariantDiagnostics(null);
  syncRouteDiagnostics(null);
  function syncExpressionDiagnostics() {
    const diagnostics = window.__MIRRORSHIFT_EXPRESSION__;
    gameFrame.dataset.expressionSchema = diagnostics.schema;
    gameFrame.dataset.expressionChangesPerformance = String(diagnostics.changesPerformance);
    gameFrame.dataset.expressionCharacter = diagnostics.characterId || '';
    gameFrame.dataset.expressionId = diagnostics.expressionId || '';
    gameFrame.dataset.expressionCue = diagnostics.lastCue || '';
    gameFrame.dataset.expressionReason = diagnostics.lastCueReason || '';
    gameFrame.dataset.expressionCuesPlayed = String(diagnostics.cuesPlayed);
    gameFrame.dataset.expressionScheduledNotes = String(diagnostics.scheduledNotes);
    gameFrame.dataset.expressionVisual = diagnostics.activeVisual || '';
    gameFrame.dataset.expressionVisualFrames = String(diagnostics.visualFrames);
    gameFrame.dataset.expressionAudioStatus = diagnostics.audioStatus;
  }
  syncExpressionDiagnostics();
  function syncKineticDiagnostics() {
    const diagnostics = window.__MIRRORSHIFT_KINETIC__;
    gameFrame.dataset.kineticSchema = diagnostics.schema;
    gameFrame.dataset.kineticPoseSchema = diagnostics.poseSchema;
    gameFrame.dataset.kineticChangesPerformance = String(diagnostics.changesPerformance);
    gameFrame.dataset.kineticCharacter = diagnostics.characterId || '';
    gameFrame.dataset.kineticRig = diagnostics.rigId || '';
    gameFrame.dataset.kineticMotion = diagnostics.motion || '';
    gameFrame.dataset.kineticState = diagnostics.state || '';
    gameFrame.dataset.kineticReducedMotion = String(diagnostics.reducedMotion);
    gameFrame.dataset.kineticPoseFrames = String(diagnostics.poseFrames);
    gameFrame.dataset.kineticMaxBodyLift = String(diagnostics.maxBodyLift);
    gameFrame.dataset.kineticMaxBodyRoll = String(diagnostics.maxBodyRoll);
  }
  syncKineticDiagnostics();
  window.__MIRRORSHIFT_TRANSPORT__ = {
    schema: 'axm.mirrorshift-client-transport/v1',
    player: 'p1',
    sessionId: actionSessionId,
    ready: false,
    resumed: false,
    resumeCount: 0,
    nextSeq: actionSequence,
    acknowledgedActions: 0,
    lastRequestId: null,
    lastRttMs: null,
    lastServerProcessMs: null,
    lastError: null
  };

  function updateFrameDiagnostics(frameNow) {
    const delta = frameNow - lastFrameAt;
    lastFrameAt = frameNow;
    if (delta > 0 && delta < 250) {
      frameSamples.push(delta);
      if (frameSamples.length > 240) frameSamples.shift();
    }
    frameCount += 1;
    if (frameCount % 30 !== 0 || frameSamples.length < 20) return;
    const sorted = frameSamples.slice().sort(function (a, b) { return a - b; });
    const total = frameSamples.reduce(function (sum, value) { return sum + value; }, 0);
    const longFrames = frameSamples.filter(function (value) { return value > 25; }).length;
    const diagnostics = {
      renderer: 'canvas-2d',
      reducedMotion: reducedMotion,
      targetFrameMs: 16.7,
      sampleCount: frameSamples.length,
      averageFrameMs: Math.round(total / frameSamples.length * 100) / 100,
      p95FrameMs: Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] * 100) / 100,
      longFrameRate: Math.round(longFrames / frameSamples.length * 10000) / 100
    };
    window.__MIRRORSHIFT_DIAGNOSTICS__ = diagnostics;
    gameFrame.dataset.frameSamples = String(diagnostics.sampleCount);
    gameFrame.dataset.frameAverageMs = String(diagnostics.averageFrameMs);
    gameFrame.dataset.frameP95Ms = String(diagnostics.p95FrameMs);
    gameFrame.dataset.frameLongRate = String(diagnostics.longFrameRate);
  }

  function updateRenderDiagnostics(duration, stages, state) {
    if (!(duration >= 0 && duration < 250)) return;
    renderSamples.push(duration);
    renderStageSamples.push(stages);
    if (renderSamples.length > 240) renderSamples.shift();
    if (renderStageSamples.length > 240) renderStageSamples.shift();
    if (frameCount % 30 !== 0 || renderSamples.length < 20) return;
    const sorted = renderSamples.slice().sort(function (a, b) { return a - b; });
    const total = renderSamples.reduce(function (sum, value) { return sum + value; }, 0);
    const stageTotals = renderStageSamples.reduce(function (totals, sample) {
      totals.track += sample.track;
      totals.actors += sample.actors;
      totals.effects += sample.effects;
      totals.audio += sample.audio;
      return totals;
    }, { track: 0, actors: 0, effects: 0, audio: 0 });
    const count = renderStageSamples.length;
    const sortedUi = uiUpdateSamples.slice().sort(function (a, b) { return a - b; });
    const uiTotal = uiUpdateSamples.reduce(function (sum, value) { return sum + value; }, 0);
    const round = function (value) { return Math.round(value * 100) / 100; };
    const diagnostics = {
      schema: 'axm.render-performance-diagnostics/v1',
      targetFrameMs: 16.7,
      sampleCount: renderSamples.length,
      averageRenderMs: round(total / renderSamples.length),
      p95RenderMs: round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))]),
      stageAverageMs: {
        track: round(stageTotals.track / count),
        actors: round(stageTotals.actors / count),
        effects: round(stageTotals.effects / count),
        audio: round(stageTotals.audio / count)
      },
      authorityPacketMs: round(stateView.packetIntervalMs),
      interpolationFrames: stateView.interpolationFrames,
      poseSnapFrames: stateView.poseSnapFrames,
      uiUpdateAverageMs: uiUpdateSamples.length ? round(uiTotal / uiUpdateSamples.length) : null,
      uiUpdateP95Ms: uiUpdateSamples.length ? round(sortedUi[Math.min(sortedUi.length - 1, Math.floor(sortedUi.length * .95))]) : null,
      schedulingWaitMs: null,
      schedulerLimited: false,
      workload: state.mode + ':' + state.track.id + ':' + (state.mode === core.MODES.BATTLE ? 'mirror-core' : (state.variantId || 'none')) + ':' + (state.mode === core.MODES.BATTLE ? 'none' : (state.routeDirectionId || 'forward')) + ':' + state.phase
    };
    const frameDiagnostics = window.__MIRRORSHIFT_DIAGNOSTICS__ || {};
    if (Number.isFinite(frameDiagnostics.averageFrameMs)) diagnostics.schedulingWaitMs = round(Math.max(0, frameDiagnostics.averageFrameMs - diagnostics.averageRenderMs));
    diagnostics.schedulerLimited = Number.isFinite(frameDiagnostics.p95FrameMs) && frameDiagnostics.p95FrameMs > 25 && diagnostics.p95RenderMs <= diagnostics.targetFrameMs;
    window.__MIRRORSHIFT_RENDER__ = diagnostics;
    gameFrame.dataset.renderSchema = diagnostics.schema;
    gameFrame.dataset.renderSamples = String(diagnostics.sampleCount);
    gameFrame.dataset.renderAverageMs = String(diagnostics.averageRenderMs);
    gameFrame.dataset.renderP95Ms = String(diagnostics.p95RenderMs);
    gameFrame.dataset.renderTrackAverageMs = String(diagnostics.stageAverageMs.track);
    gameFrame.dataset.renderActorsAverageMs = String(diagnostics.stageAverageMs.actors);
    gameFrame.dataset.renderEffectsAverageMs = String(diagnostics.stageAverageMs.effects);
    gameFrame.dataset.renderAudioAverageMs = String(diagnostics.stageAverageMs.audio);
    gameFrame.dataset.renderAuthorityPacketMs = String(diagnostics.authorityPacketMs);
    gameFrame.dataset.renderInterpolationFrames = String(diagnostics.interpolationFrames);
    gameFrame.dataset.renderPoseSnapFrames = String(diagnostics.poseSnapFrames);
    gameFrame.dataset.renderUiUpdateAverageMs = String(diagnostics.uiUpdateAverageMs);
    gameFrame.dataset.renderUiUpdateP95Ms = String(diagnostics.uiUpdateP95Ms);
    gameFrame.dataset.renderSchedulingWaitMs = String(diagnostics.schedulingWaitMs);
    gameFrame.dataset.renderSchedulerLimited = String(diagnostics.schedulerLimited);
    gameFrame.dataset.renderWorkload = diagnostics.workload;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(1.25, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function createEngine(audio) {
    if (!audio || engineNodes) return engineNodes;
    const low = audio.createOscillator();
    const high = audio.createOscillator();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    low.type = 'sawtooth';
    high.type = 'triangle';
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    filter.Q.value = 2.4;
    gain.gain.value = 0.0001;
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain).connect(audio.destination);
    low.start();
    high.start();
    engineNodes = { low, high, filter, gain };
    return engineNodes;
  }

  function midiFrequency(note) { return 440 * Math.pow(2, (note - 69) / 12); }

  function createMusicDirector(audio) {
    if (!audio || musicDirector) return musicDirector;
    const filter = audio.createBiquadFilter();
    const bus = audio.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 1450;
    filter.Q.value = .7;
    bus.gain.value = .0001;
    filter.connect(bus).connect(audio.destination);
    musicDirector = { filter, bus, nextAt: audio.currentTime, step: 0, stateId: '', transitions: 0, scheduledNotes: 0 };
    return musicDirector;
  }

  function musicVoice(note, at, duration, type, gain) {
    if (!audioContext || !musicDirector) return;
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(midiFrequency(note), at);
    volume.gain.setValueAtTime(.0001, at);
    volume.gain.exponentialRampToValueAtTime(gain, at + .012);
    volume.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(volume).connect(musicDirector.filter);
    oscillator.start(at);
    oscillator.stop(at + duration + .025);
    musicDirector.scheduledNotes += 1;
  }

  function updateMusic(state) {
    if (!state) return;
    const cue = core.musicStateFor(state, 'p1');
    const diagnostics = window.__MIRRORSHIFT_AUDIO__;
    if (diagnostics.stateId !== cue.id) {
      diagnostics.transitions += 1;
      diagnostics.stateId = cue.id;
    }
    diagnostics.intensity = cue.intensity;
    diagnostics.tempo = cue.tempo;
    diagnostics.layers = cue.layers.slice();
    diagnostics.reason = cue.reason;
    diagnostics.profile = cue.profile;
    diagnostics.muted = muted;
    const musicStatus = document.getElementById('musicStatus');
    const variant = cue.variantId ? core.raceVariantFor(cue.variantId) : null;
    musicStatus.textContent = 'MUSIC // ' + cue.profile.toUpperCase() + (variant ? ' · ' + variant.shortLabel : '') + ' · ' + cue.cue.replace(/-/g, ' ').toUpperCase() + ' · L' + cue.intensity;
    musicStatus.className = 'music-level-' + cue.intensity;
    if (!audioContext || !musicDirector) {
      diagnostics.schedulerActive = false;
      musicStatus.setAttribute('aria-label', 'Adaptive music ' + cue.profile + ' ' + cue.cue + ', intensity ' + cue.intensity + '. Scheduler waiting for audio start.');
      return;
    }
    const at = audioContext.currentTime;
    const audible = !muted && audioContext.state === 'running';
    musicDirector.bus.gain.setTargetAtTime(audible ? .021 + cue.intensity * .006 : .0001, at, .08);
    musicDirector.filter.frequency.setTargetAtTime(900 + cue.intensity * 520, at, .12);
    diagnostics.schedulerActive = audible;
    if (musicDirector.stateId !== cue.id) {
      musicDirector.stateId = cue.id;
      musicDirector.transitions += 1;
      musicDirector.step = 0;
      musicDirector.nextAt = Math.max(at + .035, musicDirector.nextAt);
    }
    if (musicDirector.nextAt < at - .4) musicDirector.nextAt = at + .035;
    const stepDuration = 60 / cue.tempo / 2;
    const pattern = [0, 2, 1, 3, 2, 4, 1, 3, 0, 3, 2, 4, 1, 2, 3, 4];
    let scheduled = 0;
    while (musicDirector.nextAt < at + .12 && scheduled < 3) {
      const step = musicDirector.step % pattern.length;
      const degree = cue.scale[pattern[step] % cue.scale.length];
      if (step % 4 === 0) musicVoice(cue.rootMidi - 12 + cue.scale[(step / 4) % cue.scale.length], musicDirector.nextAt, stepDuration * 1.8, 'triangle', .055);
      if (cue.layers.includes('arp') && step % 2 === 0) musicVoice(cue.rootMidi + 12 + degree, musicDirector.nextAt, stepDuration * .72, 'sine', .025);
      if (cue.layers.includes('spark') && step % 4 === 3) musicVoice(cue.rootMidi + 24 + degree, musicDirector.nextAt, stepDuration * .38, 'square', .012);
      if (step % 2 === 1) musicVoice(cue.rootMidi + degree, musicDirector.nextAt, stepDuration * .3, 'sawtooth', .011 + cue.intensity * .003);
      musicDirector.step += 1;
      musicDirector.nextAt += stepDuration;
      scheduled += 1;
    }
    diagnostics.scheduledNotes = musicDirector.scheduledNotes;
    diagnostics.directorTransitions = musicDirector.transitions;
    musicStatus.setAttribute('aria-label', 'Adaptive music ' + cue.profile + ' ' + cue.cue + ', intensity ' + cue.intensity + ', tempo ' + cue.tempo + '. Scheduler ' + (audible ? 'active' : 'muted') + ', ' + musicDirector.scheduledNotes + ' notes scheduled.');
  }

  function updateEngine(state) {
    if (!engineNodes || !audioContext || !state || !state.racers.p1) return;
    const player = state.racers.p1;
    const racing = state.phase === core.PHASES.RACING;
    const ratio = Math.max(0, Math.min(1.2, player.speed / (core.BASE_STATS.maxSpeed * player.catchup)));
    const at = audioContext.currentTime;
    engineNodes.low.frequency.setTargetAtTime(48 + ratio * 92, at, .04);
    engineNodes.high.frequency.setTargetAtTime(96 + ratio * 188, at, .035);
    engineNodes.filter.frequency.setTargetAtTime(340 + ratio * 920 + (player.drifting ? 260 : 0), at, .05);
    const targetGain = !muted && racing ? .012 + ratio * .014 : .0001;
    engineNodes.gain.gain.setTargetAtTime(targetGain, at, .06);
  }

  function ensureAudio() {
    if (muted) return null;
    if (!audioContext) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) audioContext = new AudioCtor();
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume().then(function () {
      window.__MIRRORSHIFT_EXPRESSION__.audioStatus = 'running';
      syncExpressionDiagnostics();
    }).catch(function () {});
    if (audioContext) {
      createEngine(audioContext);
      createMusicDirector(audioContext);
    }
    return audioContext;
  }

  function tone(frequency, duration, type, gain, delay) {
    const audio = ensureAudio();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    const at = audio.currentTime + Number(delay || 0);
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * .72), at + duration);
    volume.gain.setValueAtTime(0.0001, at);
    volume.gain.exponentialRampToValueAtTime(gain || .06, at + .015);
    volume.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
  }

  function playCharacterMotif(characterId, reason, strength, delay) {
    const expression = core.characterExpressionFor(characterId);
    const diagnostics = window.__MIRRORSHIFT_EXPRESSION__;
    diagnostics.characterId = characterId;
    diagnostics.expressionId = expression.id;
    diagnostics.lastCue = expression.label;
    diagnostics.lastCueReason = reason || 'expression';
    const audio = ensureAudio();
    if (!audio || muted) {
      diagnostics.audioStatus = muted ? 'muted' : 'audio-unavailable';
      syncExpressionDiagnostics();
      return false;
    }
    const level = Math.max(.2, Math.min(1, Number(strength || .65)));
    expression.motif.forEach(function (note, index) {
      tone(midiFrequency(note), .12 + index * .018, expression.waveform, .018 + level * .018, Number(delay || 0) + index * .065);
    });
    diagnostics.cuesPlayed += 1;
    diagnostics.scheduledNotes += expression.motif.length;
    diagnostics.audioStatus = audio.state === 'running' ? 'scheduled' : audio.state;
    syncExpressionDiagnostics();
    return true;
  }

  function soundForEvent(event) {
    if (!event || muted) return;
    if (event.type === 'character') playCharacterMotif(event.characterId, 'draft-lock', .7);
    else if (event.type === 'pickup') { tone(520, .11, 'triangle', .045); tone(780, .13, 'triangle', .035, .06); }
    else if (event.type === 'hit') tone(155, .22, 'sawtooth', .055);
    else if (event.type === 'wipeout') { tone(110, .38, 'square', .06); tone(72, .42, 'sawtooth', .045, .08); }
    else if (event.type === 'attack') tone(360, .13, 'square', .035);
    else if (event.type === 'drift') {
      const overdrive = event.text.indexOf('OVERDRIVE') >= 0;
      tone(overdrive ? 430 : 330, .14, 'sawtooth', .04);
      tone(overdrive ? 860 : 620, .28, 'triangle', .045, .08);
      if (overdrive && event.characterId) playCharacterMotif(event.characterId, 'mirror-overdrive', .45, .12);
    }
    else if (event.type === 'boost') { tone(280, .12, 'sawtooth', .035); tone(560, .2, 'triangle', .035, .05); }
    else if (event.type === 'score') { tone(520, .1, 'square', .04); tone(780, .18, 'triangle', .04, .07); }
    else if (event.type === 'respawn') { tone(220, .12, 'sawtooth', .035); tone(440, .16, 'triangle', .04, .09); tone(880, .22, 'triangle', .03, .18); }
    else if (event.type === 'go') { tone(420, .12, 'square', .05); tone(660, .22, 'square', .055, .11); if (event.characterId) playCharacterMotif(event.characterId, 'grid-launch', .55, .2); }
    else if (event.type === 'finish') { tone(523, .18, 'triangle', .05); tone(659, .18, 'triangle', .05, .13); tone(784, .32, 'triangle', .05, .26); if (event.finishPlace === 1 && event.characterId) playCharacterMotif(event.characterId, 'crown-finish', .8, .34); }
  }

  async function api(path, options) {
    const response = await fetch(path, Object.assign({ cache: 'no-store' }, options || {}));
    const body = await response.json();
    if (!response.ok && response.status !== 409) throw new Error(body.error || 'request failed');
    return body;
  }

  function reportClientRtt(receipt, rttMs) {
    if (!receipt) return;
    lastActionRtt = Math.round(rttMs * 100) / 100;
    Object.assign(window.__MIRRORSHIFT_TRANSPORT__, {
      acknowledgedActions: window.__MIRRORSHIFT_TRANSPORT__.acknowledgedActions + (receipt.accepted ? 1 : 0),
      lastRequestId: receipt.requestId,
      lastRttMs: lastActionRtt,
      lastServerProcessMs: receipt.serverProcessMs,
      nextSeq: receipt.nextSeq,
      lastError: receipt.reason || null
    });
    fetch('/api/client-telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', sessionId: actionSessionId, requestId: receipt.requestId, rttMs: lastActionRtt })
    }).catch(function () {});
  }

  function syncActionSession(reason) {
    if (actionSessionSync) return actionSessionSync;
    actionSessionSync = api('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', sessionId: actionSessionId, clientKind: 'screen', reason: reason || 'sync' })
    }).then(function (body) {
      if (!body.ok || !body.session) throw new Error('session handshake failed');
      actionSequence = Math.max(actionSequence, Number(body.session.nextSeq || 1));
      actionSessionReady = true;
      Object.assign(window.__MIRRORSHIFT_TRANSPORT__, {
        ready: true,
        resumed: body.session.resumed,
        resumeCount: body.session.resumeCount,
        nextSeq: actionSequence,
        lastError: null
      });
      setConnected(true);
      return body.session;
    }).catch(function (error) {
      actionSessionReady = false;
      window.__MIRRORSHIFT_TRANSPORT__.ready = false;
      window.__MIRRORSHIFT_TRANSPORT__.lastError = error.message;
      setConnected(false);
      throw error;
    }).finally(function () { actionSessionSync = null; });
    return actionSessionSync;
  }

  function heartbeatActionSession() {
    if (!actionSessionReady) return syncActionSession('heartbeat').catch(function () {});
    return api('/api/heartbeat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', sessionId: actionSessionId })
    }).then(function (body) {
      if (!body.ok) {
        actionSessionReady = false;
        return syncActionSession('heartbeat-recovery');
      }
      window.__MIRRORSHIFT_TRANSPORT__.nextSeq = body.nextSeq;
      return body;
    }).catch(function () { actionSessionReady = false; setConnected(false); });
  }

  async function sendAction(action, retryCount) {
    if (!actionSessionReady) await syncActionSession(retryCount ? 'resync' : 'action');
    const sequence = actionSequence++;
    const requestId = actionSessionId + ':' + (++actionRequestCount) + ':' + sequence;
    const startedAt = performance.now();
    const body = await api('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', sessionId: actionSessionId, requestId: requestId, clientSentAt: Date.now(), action: Object.assign({ seq: sequence }, action) })
    });
    const rttMs = performance.now() - startedAt;
    if (body.receipt) reportClientRtt(body.receipt, rttMs);
    if (!body.ok && retryCount < 1 && (body.error === 'session-required' || body.result && body.result.reason === 'stale-sequence')) {
      actionSessionReady = false;
      await syncActionSession('recovery');
      return sendAction(action, retryCount + 1);
    }
    if (!body.ok) throw new Error(body.error || body.result && body.result.reason || 'action rejected');
    return body;
  }

  function postAction(action) {
    const queued = actionChain.then(function () { return sendAction(action, 0); }, function () { return sendAction(action, 0); });
    actionChain = queued.catch(function () {});
    return queued.catch(function () { actionSessionReady = false; setConnected(false); return null; });
  }

  function setConnected(value) {
    stateView.connected = value;
    const latency = value && Number.isFinite(lastActionRtt) ? ' · ' + Math.round(lastActionRtt) + 'MS' : '';
    connectionStatus.textContent = value ? 'WORKSHOP LINK // LIVE' + latency : 'WORKSHOP LINK // RETRYING';
    connectionStatus.className = value ? 'connected' : 'disconnected';
    connectionStatus.setAttribute('aria-label', value ? 'Workshop link live' + (latency ? ' with ' + Math.round(lastActionRtt) + ' millisecond latest action acknowledgement' : '') : 'Workshop link reconnecting');
  }

  function buildCharacterGrid(characters) {
    const grid = document.getElementById('characterGrid');
    if (grid.children.length) return;
    characters.forEach(function (character, index) {
      const expression = core.characterExpressionFor(character.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'character-card';
      card.dataset.characterId = character.id;
      card.dataset.expressionId = expression.id;
      card.title = expression.quote;
      card.setAttribute('aria-pressed', 'false');
      card.setAttribute('aria-label', 'Choose ' + character.name + ' with the ' + character.vehicle);
      card.style.setProperty('--card-color', character.color);
      const positions = ['0%', '33.333%', '66.666%', '100%'];
      card.style.setProperty('--portrait-position', positions[index]);
      const portrait = document.createElement('div');
      portrait.className = 'character-portrait';
      portrait.setAttribute('role', 'img');
      portrait.setAttribute('aria-label', character.name + ' with the ' + character.vehicle);
      const body = document.createElement('div');
      body.className = 'character-body';
      const heading = document.createElement('h3');
      heading.textContent = character.name;
      const title = document.createElement('span');
      title.textContent = character.title;
      const signature = document.createElement('strong');
      signature.className = 'character-signature';
      signature.textContent = (character.signature || character.title) + ' // ' + expression.label;
      const bio = document.createElement('p');
      bio.textContent = character.bio;
      const vehicle = document.createElement('div');
      vehicle.className = 'vehicle-name';
      const vehicleText = document.createElement('b');
      vehicleText.textContent = character.vehicle;
      const spec = document.createElement('i');
      spec.textContent = 'EQUAL SPEC';
      const owner = document.createElement('em');
      owner.className = 'character-owner';
      owner.textContent = 'P' + (index + 1) + ' PICK';
      vehicle.append(vehicleText, spec);
      body.append(heading, title, signature, bio, vehicle);
      portrait.appendChild(owner);
      card.append(portrait, body);
      card.addEventListener('click', function () { selectCharacter(character.id); });
      grid.appendChild(card);
    });
  }

  function updateCharacterGrid(state) {
    document.querySelectorAll('[data-character-id]').forEach(function (card) {
      const characterId = card.getAttribute('data-character-id');
      const occupant = Object.values(state.racers).find(function (racer) { return racer.characterId === characterId; });
      const selected = state.racers.p1.characterId === characterId;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
      card.disabled = state.phase !== core.PHASES.LOBBY;
      const owner = card.querySelector('.character-owner');
      if (owner) owner.textContent = occupant ? 'P' + occupant.id.slice(1) + (selected ? ' · YOUR PICK' : ' PICK') : 'AVAILABLE';
    });
  }

  function updateStandings(state) {
    const list = document.getElementById('standings');
    list.replaceChildren();
    state.ranking.forEach(function (id, index) {
      const racer = state.racers[id];
      const row = document.createElement('li');
      row.className = 'standing' + (id === 'p1' ? ' is-player' : '');
      row.style.color = racer.color;
      const position = document.createElement('span');
      position.className = 'position';
      position.textContent = String(index + 1).padStart(2, '0');
      const dot = document.createElement('i');
      dot.className = 'dot';
      dot.style.background = racer.color;
      const name = document.createElement('span');
      name.textContent = racer.character.toUpperCase();
      const status = document.createElement('span');
      if (state.mode === core.MODES.BATTLE) {
        status.className = 'score-mini';
        status.textContent = racer.score + ' CORE';
        status.setAttribute('aria-label', racer.score + ' Mirror Core points');
      } else {
        status.className = 'guard-mini';
        status.setAttribute('aria-label', racer.shield + ' guard segments');
        for (let segment = 0; segment < core.METRICS.shieldMax; segment += 1) {
          const mark = document.createElement('i');
          if (segment < racer.shield) mark.className = 'on';
          status.appendChild(mark);
        }
      }
      row.append(position, dot, name, status);
      list.appendChild(row);
    });
  }

  function updatePlayerHud(state) {
    const player = state.racers.p1;
    const variant = core.raceVariantFor(state.variantId);
    const direction = core.routeDirectionFor(state.routeDirectionId);
    syncVariantDiagnostics(state);
    syncRouteDiagnostics(state);
    document.getElementById('playerRank').textContent = 'P' + player.rank;
    document.getElementById('playerName').textContent = player.character.toUpperCase();
    if (state.mode === core.MODES.BATTLE) {
      const remaining = state.battleEndsAt ? Math.max(0, state.battleEndsAt - state.now) : core.METRICS.battleDurationMs;
      const seconds = Math.ceil(remaining / 1000);
      document.getElementById('lapReadout').textContent = player.respawnAt && state.now < player.respawnAt
        ? 'REBOOT ' + Math.max(1, Math.ceil((player.respawnAt - state.now) / 1000))
        : 'CORE ' + player.score + ' · ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    } else {
      const lapText = player.finishedAt != null ? 'FINISHED' : 'LAP ' + Math.min(state.raceLaps, player.lap + 1) + ' / ' + state.raceLaps;
      document.getElementById('lapReadout').textContent = state.mode === core.MODES.TOUR && state.tour
        ? 'R' + (state.tour.roundIndex + 1) + '/' + state.tour.roundCount + ' · ' + lapText + ' · ' + Number(state.tour.points.p1 || 0) + ' PTS'
        : lapText;
    }
    const variantBadge = document.getElementById('variantBadge');
    variantBadge.textContent = state.mode === core.MODES.BATTLE
      ? 'MIRROR CORE // 60 SECONDS'
      : state.mode === core.MODES.TOUR && state.tour
        ? 'SIGNAL TOUR ' + (state.tour.roundIndex + 1) + '/' + state.tour.roundCount + ' // ' + variant.label + ' // ' + state.raceLaps + ' LAPS'
        : direction.shortLabel + ' // ' + variant.label + ' // ' + state.raceLaps + ' LAPS';
    variantBadge.dataset.variant = state.mode === core.MODES.BATTLE ? 'mirror-core' : variant.id;
    const segments = document.getElementById('shieldSegments');
    segments.replaceChildren();
    for (let index = 0; index < core.METRICS.shieldMax; index += 1) {
      const segment = document.createElement('i');
      if (index < player.shield) segment.className = 'on';
      segments.appendChild(segment);
    }
    segments.setAttribute('aria-label', player.shield + ' of ' + core.METRICS.shieldMax + ' shield segments');
    const max = core.BASE_STATS.maxSpeed * player.catchup * (state.now < player.boostUntil ? Math.max(1, player.boostPower || 1) : 1);
    document.getElementById('speedFill').style.width = Math.min(100, player.speed / max * 100) + '%';
    const assistLabels = [];
    if (player.assists && player.assists.steering) assistLabels.push('STEER HELP');
    if (player.assists && player.assists.autoAccelerate) assistLabels.push('AUTO GAS');
    document.getElementById('catchupReadout').textContent = assistLabels.length
      ? assistLabels.join(' · ')
      : (player.catchup > 1 ? 'CATCH-UP +' + Math.round((player.catchup - 1) * 1000) / 10 + '%' : 'BASE SPEED');
    const driftRow = document.querySelector('.drift-row');
    const driftTier = Number(player.driftTier || 0);
    const boosting = state.now < player.boostUntil;
    document.getElementById('driftFill').style.width = Math.round((player.driftCharge || 0) * 100) + '%';
    driftRow.className = 'drift-row tier-' + driftTier + (boosting ? ' boosting' : '');
    const driftLabels = ['READY', 'BLUE', 'VIOLET', 'OVERDRIVE'];
    document.getElementById('driftReadout').textContent = boosting ? 'SHIFT BOOST' : (player.drifting ? driftLabels[driftTier] : 'READY');
    const incomingBolt = state.projectiles.some(function (projectile) { return projectile.targetId === 'p1'; });
    const nearbyMine = state.mines.some(function (mine) {
      const dx = mine.x - player.x;
      const dy = mine.y - player.y;
      return dx * dx + dy * dy < 125 * 125;
    });
    const threat = document.getElementById('threatAlert');
    const threatText = incomingBolt ? 'ARC LOCK' : (nearbyMine ? 'MINE NEARBY' : '');
    threat.classList.toggle('is-active', Boolean(threatText));
    if (threatText && threat.querySelector('span').textContent !== threatText) threat.querySelector('span').textContent = threatText;
    gameFrame.classList.toggle('player-hit', state.now < player.spinUntil);
    gameFrame.classList.toggle('mode-battle', state.mode === core.MODES.BATTLE);
    gameFrame.classList.toggle('mode-tour', state.mode === core.MODES.TOUR);
    const item = player.item && core.ITEM_TYPES[player.item];
    document.getElementById('itemIcon').textContent = item ? item.icon : '·';
    document.getElementById('itemLabel').textContent = item ? item.label : 'EMPTY';
    document.getElementById('itemButton').disabled = !item;
  }

  function updateEventFeed(state) {
    const feed = document.getElementById('eventFeed');
    feed.replaceChildren();
    state.events.slice(-4).reverse().forEach(function (event) {
      const line = document.createElement('div');
      line.className = 'event-line';
      line.textContent = event.text;
      feed.appendChild(line);
    });
    const fresh = state.events.filter(function (event) { return event.id > stateView.lastEventId; });
    fresh.forEach(soundForEvent);
    if (fresh.length) {
      stateView.lastEventId = fresh[fresh.length - 1].id;
      statusLive.textContent = fresh[fresh.length - 1].text;
    }
  }

  function updateStartGrid(state) {
    if (!state || state.phase !== core.PHASES.COUNTDOWN) return;
    const direction = core.routeDirectionFor(state.routeDirectionId);
    const variant = core.raceVariantFor(state.variantId);
    const heading = state.mode === core.MODES.BATTLE
      ? 'MIRROR CORE // FOUR SIGNALS ARMED'
      : state.mode === core.MODES.TOUR && state.tour
        ? 'SIGNAL TOUR R' + (state.tour.roundIndex + 1) + '/' + state.tour.roundCount + ' // FOUR SIGNALS ARMED'
        : state.track.name.toUpperCase() + ' // ' + direction.shortLabel + ' // ' + variant.shortLabel;
    const seats = core.RACERS.map(function (seat) { return state.racers[seat.id]; }).filter(Boolean);
    const signature = [state.mode, state.trackId, state.routeDirectionId, state.variantId].concat(seats.map(function (racer) { return racer.id + ':' + racer.characterId; })).join(':');
    startGridHeading.textContent = heading;
    if (stateView.startGridSignature === signature && startGridRoster.children.length === seats.length) return;
    stateView.startGridSignature = signature;
    startGridRoster.replaceChildren();
    seats.forEach(function (racer, index) {
      const identity = core.RACERS.find(function (candidate) { return candidate.id === racer.characterId; }) || core.RACERS[0];
      const pose = core.startGridPose(racer.characterId, index + 1, 0, reducedMotion);
      const row = document.createElement('li');
      row.dataset.gridCharacter = racer.characterId;
      row.dataset.gridMoment = pose.momentId;
      row.dataset.gridSeat = String(index + 1);
      row.style.setProperty('--grid-color', racer.color);
      row.style.setProperty('--grid-accent', racer.accent);
      row.style.setProperty('--portrait-position', ['0%', '33.333%', '66.666%', '100%'][identity.portrait] || '0%');
      const portrait = document.createElement('div');
      portrait.className = 'start-grid-portrait';
      portrait.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('div');
      copy.className = 'start-grid-copy';
      const seat = document.createElement('span');
      seat.className = 'start-grid-seat';
      seat.textContent = 'P' + (index + 1) + ' // ' + pose.momentLabel;
      const name = document.createElement('strong');
      name.textContent = racer.character.toUpperCase();
      const vehicle = document.createElement('small');
      vehicle.textContent = racer.vehicle.toUpperCase();
      copy.append(seat, name, vehicle);
      row.setAttribute('aria-label', 'Player ' + (index + 1) + ', ' + racer.character + ', ' + racer.vehicle + ', ' + pose.momentLabel.toLowerCase());
      row.append(portrait, copy);
      startGridRoster.appendChild(row);
    });
  }

  function updateResults(state) {
    if (!state.result) return;
    const tour = state.result.tour || null;
    const winner = state.racers[state.result.winnerId];
    const title = tour
      ? tour.complete ? winner.character.toUpperCase() + ' CHAMPION' : state.racers[state.result.roundWinnerId].character.toUpperCase() + ' TAKES ROUND ' + tour.roundNumber
      : winner.character.toUpperCase() + ' WINS';
    document.getElementById('resultsTitle').textContent = title;
    document.getElementById('resultsTitle').style.color = winner.color;
    document.getElementById('resultsSignature').textContent = winner.expressionLabel.toUpperCase() + ' // “' + winner.signatureQuote.toUpperCase() + '”';
    document.getElementById('resultsSignature').style.color = winner.accent;
    const battle = state.result.mode === core.MODES.BATTLE;
    document.getElementById('resultsEyebrow').textContent = battle
      ? 'MIRROR CORE DOMINATED'
      : tour ? tour.complete ? 'SIGNAL TOUR CHAMPION' : 'SIGNAL TOUR · ROUND ' + tour.roundNumber + '/' + tour.roundCount
        : 'MIRROR CROWN CLAIMED';
    document.getElementById('resultsVehicle').textContent = battle
      ? winner.vehicle + ' · ' + winner.score + ' CORE · ' + winner.knockouts + ' clean wipes'
      : tour && tour.complete
        ? winner.vehicle + ' · ' + tour.points[winner.id] + ' POINTS · THREE CIRCUITS SEALED'
        : winner.vehicle + ' · ' + state.result.trackName.toUpperCase() + ' · ' + state.result.routeDirectionLabel + ' · ' + state.result.variantLabel + ' · ' + state.result.raceLaps + ' LAPS';
    const list = document.getElementById('resultsRanking');
    const ranking = tour ? tour.standings : state.result.ranking;
    const resultSignature = [state.result.mode, state.result.trackId, state.result.variantId, state.result.routeDirectionId, state.result.winnerId, state.result.elapsedMs].concat(ranking).join(':');
    if (stateView.resultSignature !== resultSignature || list.children.length !== ranking.length) {
      stateView.resultSignature = resultSignature;
      list.replaceChildren();
      ranking.forEach(function (id, index) {
        const racer = state.racers[id];
        const identity = core.RACERS.find(function (candidate) { return candidate.id === racer.characterId; }) || core.RACERS[0];
        const stage = core.resultStagePose(racer.characterId, index + 1, 0, reducedMotion);
        const row = document.createElement('li');
        row.dataset.resultCharacter = racer.characterId;
        row.dataset.resultMoment = stage.momentId;
        row.dataset.resultPlace = String(index + 1);
        row.dataset.resultWinner = String(id === state.result.winnerId);
        row.classList.toggle('is-result-winner', id === state.result.winnerId);
        row.style.setProperty('--result-color', racer.color);
        row.style.setProperty('--result-accent', racer.accent);
        row.style.setProperty('--portrait-position', ['0%', '33.333%', '66.666%', '100%'][identity.portrait] || '0%');
        const portrait = document.createElement('div');
        portrait.className = 'result-portrait';
        portrait.setAttribute('aria-hidden', 'true');
        const place = document.createElement('span');
        place.className = 'result-place';
        place.textContent = String(index + 1).padStart(2, '0');
        const copy = document.createElement('div');
        copy.className = 'result-copy';
        const moment = document.createElement('span');
        moment.className = 'result-moment';
        moment.textContent = stage.momentLabel;
        const name = document.createElement('strong');
        name.className = 'result-name';
        name.textContent = racer.character.toUpperCase();
        const vehicle = document.createElement('span');
        vehicle.className = 'result-vehicle';
        vehicle.textContent = racer.vehicle.toUpperCase();
        const metric = document.createElement('small');
        metric.className = 'result-metric';
        metric.textContent = tour
          ? tour.points[id] + ' PTS // +' + tour.pointsAwarded[id] + ' ROUND'
          : battle
            ? racer.score + ' CORE // ' + racer.guardBreaks + ' BREAKS // ' + racer.knockouts + ' WIPES'
            : racer.stats.drifts + ' SHIFTS // ' + state.result.routeDirectionLabel;
        copy.append(moment, name, vehicle, metric);
        row.setAttribute('aria-label', 'Place ' + (index + 1) + ', ' + racer.character + ', ' + metric.textContent.toLowerCase());
        row.append(portrait, place, copy);
        list.appendChild(row);
      });
    }
    document.getElementById('resultRuleOne').textContent = tour ? tour.pointsTable.join('·') : battle ? core.METRICS.battleScoreToWin : '100%';
    document.getElementById('resultRuleOneLabel').textContent = tour ? 'place points' : battle ? 'CORE target' : 'equal base stats';
    document.getElementById('resultRuleTwo').textContent = tour ? tour.roundNumber + '/' + tour.roundCount : battle ? '90%' : '85%';
    document.getElementById('resultRuleTwoLabel').textContent = tour ? 'rounds complete' : 'attack drops';
    document.getElementById('resultRuleThree').textContent = '3';
    document.getElementById('resultRuleThreeLabel').textContent = 'starting guards';
    document.querySelector('#againButton span').textContent = tour ? tour.complete ? 'NEW SIGNAL TOUR' : 'NEXT TOUR ROUND' : 'RUN IT BACK';
  }

  function animateStartGrid(frameNow, state) {
    const diagnostics = window.__MIRRORSHIFT_START_GRID__;
    const visible = Boolean(state && state.phase === core.PHASES.COUNTDOWN);
    diagnostics.visible = visible;
    gameFrame.dataset.startGridVisible = String(visible);
    if (!visible) {
      diagnostics.entrantCount = 0;
      diagnostics.moments = [];
      return;
    }
    const elapsed = Math.max(0, frameNow - stateView.startGridStartedAt);
    const rows = Array.from(document.querySelectorAll('#startGridRoster [data-grid-character]'));
    let maxLift = diagnostics.maxObservedLift;
    rows.forEach(function (row) {
      const pose = core.startGridPose(row.dataset.gridCharacter, Number(row.dataset.gridSeat), elapsed, reducedMotion);
      row.style.setProperty('--grid-lift', pose.lift.toFixed(3) + 'px');
      row.style.setProperty('--grid-roll', pose.rollDeg.toFixed(3) + 'deg');
      row.style.setProperty('--grid-scale', pose.scale.toFixed(4));
      row.style.setProperty('--grid-opacity', pose.opacity.toFixed(4));
      row.style.setProperty('--grid-glow', pose.glow.toFixed(4));
      row.dataset.gridPoseSchema = pose.schema;
      row.dataset.gridEntrance = pose.entranceProgress.toFixed(4);
      maxLift = Math.max(maxLift, Math.abs(pose.lift));
    });
    diagnostics.entrantCount = rows.length;
    diagnostics.poseFrames += 1;
    diagnostics.maxObservedLift = Math.round(maxLift * 10000) / 10000;
    diagnostics.moments = rows.map(function (row) { return row.dataset.gridMoment; });
    gameFrame.dataset.startGridSchema = diagnostics.schema;
    gameFrame.dataset.startGridPoseSchema = diagnostics.poseSchema;
    gameFrame.dataset.startGridEntrants = String(rows.length);
    gameFrame.dataset.startGridReducedMotion = String(reducedMotion);
    gameFrame.dataset.startGridChangesAuthority = 'false';
  }

  function animateResultStage(frameNow, state) {
    const diagnostics = window.__MIRRORSHIFT_RESULT_STAGE__;
    const visible = Boolean(state && state.phase === core.PHASES.RESULTS && state.result);
    diagnostics.visible = visible;
    gameFrame.dataset.resultStageVisible = String(visible);
    if (!visible) {
      diagnostics.entrantCount = 0;
      diagnostics.winnerId = null;
      diagnostics.moments = [];
      return;
    }
    const elapsed = Math.max(0, frameNow - stateView.resultStageStartedAt);
    const rows = Array.from(document.querySelectorAll('#resultsRanking [data-result-character]'));
    let maxLift = diagnostics.maxObservedLift;
    rows.forEach(function (row) {
      const pose = core.resultStagePose(row.dataset.resultCharacter, Number(row.dataset.resultPlace), elapsed, reducedMotion);
      row.style.setProperty('--result-lift', pose.lift.toFixed(3) + 'px');
      row.style.setProperty('--result-roll', pose.rollDeg.toFixed(3) + 'deg');
      row.style.setProperty('--result-scale', pose.scale.toFixed(4));
      row.style.setProperty('--result-opacity', pose.opacity.toFixed(4));
      row.style.setProperty('--result-glow', pose.glow.toFixed(4));
      row.dataset.resultPoseSchema = pose.schema;
      row.dataset.resultEntrance = pose.entranceProgress.toFixed(4);
      maxLift = Math.max(maxLift, Math.abs(pose.lift));
    });
    diagnostics.entrantCount = rows.length;
    diagnostics.winnerId = state.result.winnerId;
    diagnostics.poseFrames += 1;
    diagnostics.maxObservedLift = Math.round(maxLift * 10000) / 10000;
    diagnostics.moments = rows.map(function (row) { return row.dataset.resultMoment; });
    gameFrame.dataset.resultStageSchema = diagnostics.schema;
    gameFrame.dataset.resultStagePoseSchema = diagnostics.poseSchema;
    gameFrame.dataset.resultStageEntrants = String(rows.length);
    gameFrame.dataset.resultStageReducedMotion = String(reducedMotion);
    gameFrame.dataset.resultStageChangesAuthority = 'false';
  }

  function formatEchoTime(durationMs) {
    const total = Math.max(0, Number(durationMs || 0));
    const minutes = Math.floor(total / 60000);
    const seconds = Math.floor(total % 60000 / 1000);
    const milliseconds = Math.floor(total % 1000);
    return minutes + ':' + String(seconds).padStart(2, '0') + '.' + String(milliseconds).padStart(3, '0');
  }

  function updateMirrorEchoUi(state) {
    const summary = mirrorEchoVault.summary(state);
    const best = summary.best;
    const battle = state && state.mode === core.MODES.BATTLE;
    const enabled = summary.enabled;
    const button = document.getElementById('echoButton');
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? (best ? 'ECHO ON' : 'ECHO EMPTY') : 'ECHO OFF';
    const readout = document.getElementById('echoReadout');
    const primary = readout.querySelector('span');
    const detail = readout.querySelector('small');
    if (battle) {
      primary.textContent = 'MIRROR ECHO // CIRCUIT MODES ONLY';
      detail.textContent = 'MIRROR CORE REMAINS SERVER-AUTHORITATIVE';
    } else if (best) {
      primary.textContent = 'MIRROR ECHO // ' + best.source.character.toUpperCase() + ' // ' + formatEchoTime(best.durationMs);
      detail.textContent = enabled ? 'FASTEST LAP REPLAY // NON-COLLIDING // NOT A FIFTH RACER' : 'SEALED IN SESSION // PLAYBACK PAUSED';
    } else {
      primary.textContent = 'MIRROR ECHO // NO LAP SEALED';
      detail.textContent = 'FINISH A CIRCUIT LAP TO ARM THE NON-COLLIDING REPLAY';
    }
    const echoHud = document.getElementById('echoHud');
    const showHud = Boolean(enabled && best && state && (state.phase === core.PHASES.RACING || state.phase === core.PHASES.COUNTDOWN));
    echoHud.setAttribute('aria-hidden', String(!showHud));
    echoHud.textContent = best ? 'MIRROR ECHO // ' + best.source.character.toUpperCase() + ' // ' + formatEchoTime(best.durationMs) : 'MIRROR ECHO // NO LAP SEALED';
    const resultsEcho = document.getElementById('resultsEcho');
    resultsEcho.textContent = battle
      ? 'MIRROR ECHO // CIRCUIT MODES ONLY'
      : best
        ? 'MIRROR ECHO SEALED // ' + best.source.character.toUpperCase() + ' // ' + formatEchoTime(best.durationMs)
        : 'MIRROR ECHO // A FASTEST LAP WILL SEAL AFTER THIS RUN';
    window.__MIRRORSHIFT_ECHO__ = mirrorEchoVault.snapshot(state);
    gameFrame.dataset.echoSchema = mirrorEchoCore.SCHEMA;
    gameFrame.dataset.echoStatus = summary.status;
    gameFrame.dataset.echoEnabled = String(enabled);
    gameFrame.dataset.echoCount = String(summary.echoCount);
  }

  function updateLobbyMode(state) {
    const battle = state.mode === core.MODES.BATTLE;
    const tour = state.mode === core.MODES.TOUR && state.tour;
    document.querySelectorAll('[data-mode]').forEach(function (button) {
      const selected = button.getAttribute('data-mode') === state.mode;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = state.phase !== core.PHASES.LOBBY;
    });
    const trackSelector = document.getElementById('trackSelector');
    trackSelector.classList.toggle('is-hidden', battle);
    trackSelector.classList.toggle('is-tour', Boolean(tour));
    document.querySelectorAll('[data-track]').forEach(function (button) {
      const selected = button.getAttribute('data-track') === state.trackId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = state.phase !== core.PHASES.LOBBY || battle || tour;
    });
    const variant = core.raceVariantFor(state.variantId);
    const direction = core.routeDirectionFor(state.routeDirectionId);
    document.querySelectorAll('button[data-route-direction]').forEach(function (button) {
      const selected = button.getAttribute('data-route-direction') === direction.id;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = state.phase !== core.PHASES.LOBBY || battle || tour;
    });
    document.querySelectorAll('button[data-variant]').forEach(function (button) {
      const selected = button.getAttribute('data-variant') === state.variantId;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = state.phase !== core.PHASES.LOBBY || battle || tour;
    });
    const raceModeCopy = document.querySelector('[data-mode="race"] span');
    raceModeCopy.textContent = state.raceLaps + ' laps · ' + direction.shortLabel + ' · ' + variant.shortLabel + ' · 85% attacks';
    const tourModeCopy = document.querySelector('[data-mode="tour"] span');
    if (tourModeCopy) tourModeCopy.textContent = tour
      ? 'Round ' + (tour.roundIndex + 1) + '/' + tour.roundCount + ' · ' + Number(tour.points.p1 || 0) + ' P1 points'
      : '3 rounds · fixed route · 9–6–4–2 points';
    document.getElementById('trackSelectorLabel').textContent = tour ? 'TOUR ROUND ' + (tour.roundIndex + 1) + '/' + tour.roundCount + ' · LOCKED CIRCUIT' : 'SELECT CIRCUIT';
    document.getElementById('trackRisk').textContent = tour ? 'SERVER-OWNED ITINERARY' : 'AUTHORED ROUTES // LIVE HAZARDS';
    document.getElementById('routeDirectionLabel').textContent = tour ? 'TOUR ROUTE · FLOW LOCKED' : 'ROUTE DIRECTION';
    document.getElementById('routeDirectionRisk').textContent = tour ? 'SEALED FORWARD ITINERARY' : 'FIXED FINISH // REMAPPED HAZARDS';
    document.getElementById('variantSelectorLabel').textContent = tour ? 'LOCKED SIGNAL CONDITION' : 'SELECT SIGNAL CONDITION';
    document.getElementById('variantRisk').textContent = tour ? 'NEXT ROUND UNLOCKS AFTER RESULTS' : 'GLOBAL RULES // IDENTICAL CARS';
    document.getElementById('modePill').textContent = battle
      ? '60 SECONDS · 90% ATTACKS'
      : tour
        ? 'SIGNAL TOUR R' + (tour.roundIndex + 1) + '/' + tour.roundCount + ' · ' + Number(tour.points.p1 || 0) + ' PTS'
        : state.track.name.toUpperCase() + ' · ' + direction.shortLabel + ' · ' + variant.shortLabel + ' · ' + state.raceLaps + ' LAPS';
    const playerAssists = state.racers.p1.assists || { steering: 0, autoAccelerate: false };
    const steeringButton = document.getElementById('steeringAssist');
    const autoButton = document.getElementById('autoAccelerate');
    steeringButton.setAttribute('aria-pressed', String(Boolean(playerAssists.steering)));
    steeringButton.querySelector('span').textContent = playerAssists.steering ? 'LIGHT' : 'OFF';
    autoButton.setAttribute('aria-pressed', String(Boolean(playerAssists.autoAccelerate)));
    autoButton.querySelector('span').textContent = playerAssists.autoAccelerate ? 'ON' : 'OFF';
    steeringButton.disabled = autoButton.disabled = state.phase !== core.PHASES.LOBBY;
    const layoutSelect = document.getElementById('keyboardLayout');
    layoutSelect.value = keyboardLayout;
    layoutSelect.disabled = state.phase !== core.PHASES.LOBBY;
    document.getElementById('controlsCopy').innerHTML = '<b>DRIVE</b> ' + KEYBOARD_LAYOUTS[keyboardLayout].label + ' &nbsp; <b>DRIFT</b> GAS + BRAKE + TURN &nbsp; <b>FIRE</b> ' + KEYBOARD_LAYOUTS[keyboardLayout].item[0].replace('Key', '').toUpperCase();
    document.getElementById('startLabel').textContent = battle ? 'IGNITE MIRROR CORE' : tour ? 'START SIGNAL TOUR' : 'ARM THE CIRCUIT';
    countdown.querySelector('small').textContent = battle ? 'CORE CHARGED' : tour ? 'TOUR R' + (tour.roundIndex + 1) + '/' + tour.roundCount + ' // ' + variant.label : direction.label + ' // ' + variant.label + ' // GUARDS ARMED';
    updateCharacterGrid(state);
  }

  function updatePhase(state) {
    const phase = state.phase;
    if (stateView.lastPhase !== phase && phase === core.PHASES.COUNTDOWN) {
      stateView.startGridSignature = null;
      stateView.startGridStartedAt = performance.now();
      window.__MIRRORSHIFT_START_GRID__.poseFrames = 0;
      window.__MIRRORSHIFT_START_GRID__.maxObservedLift = 0;
    }
    if (stateView.lastPhase !== phase && phase === core.PHASES.RESULTS) {
      stateView.resultSignature = null;
      stateView.resultStageStartedAt = performance.now();
      window.__MIRRORSHIFT_RESULT_STAGE__.poseFrames = 0;
      window.__MIRRORSHIFT_RESULT_STAGE__.maxObservedLift = 0;
    }
    if (phase !== core.PHASES.COUNTDOWN) stateView.startGridSignature = null;
    if (phase !== core.PHASES.RESULTS) stateView.resultSignature = null;
    lobby.classList.toggle('hidden', phase !== core.PHASES.LOBBY);
    countdown.classList.toggle('hidden', phase !== core.PHASES.COUNTDOWN);
    results.classList.toggle('hidden', phase !== core.PHASES.RESULTS);
    raceHud.setAttribute('aria-hidden', String(!(phase === core.PHASES.RACING || phase === core.PHASES.COUNTDOWN)));
    if (phase === core.PHASES.COUNTDOWN) {
      const remaining = Math.max(0, state.countdownEndsAt - state.now);
      countdownNumber.textContent = Math.min(3, Math.max(1, Math.ceil(remaining / 1000)));
    }
    if (phase === core.PHASES.RESULTS) updateResults(state);
    updateLobbyMode(state);
    if (phase === core.PHASES.COUNTDOWN) {
      updateStartGrid(state);
      const playerExpression = state.racers.p1;
      countdown.querySelector('small').textContent = state.mode === core.MODES.TOUR && state.tour
        ? 'TOUR R' + (state.tour.roundIndex + 1) + '/' + state.tour.roundCount + ' // ' + playerExpression.expressionLabel
        : playerExpression.signature + ' // ' + playerExpression.expressionLabel;
    }
    if (stateView.lastPhase !== phase) {
      stateView.lastPhase = phase;
      if (phase === core.PHASES.RACING) statusLive.textContent = 'Race started.';
      if (phase === core.PHASES.RESULTS && state.result) {
        statusLive.textContent = state.result.tour
          ? state.result.tour.complete ? state.result.winner + ' won the Signal Tour.' : state.racers[state.result.roundWinnerId].character + ' won Tour Round ' + state.result.tour.roundNumber + '.'
          : state.result.winner + ' won the race.';
        const winner = state.racers[state.result.winnerId];
        playCharacterMotif(winner.characterId, 'victory-refrain', 1);
      }
    }
  }

  async function pollState() {
    if (pollBusy) return;
    pollBusy = true;
    try {
      const packet = await api('/api/state');
      const receivedAt = performance.now();
      const previous = stateView.state;
      const sameVisualWorld = previous && previous.phase === packet.state.phase && previous.mode === packet.state.mode && previous.trackId === packet.state.trackId && previous.routeDirectionId === packet.state.routeDirectionId;
      if (sameVisualWorld) {
        const measuredInterval = receivedAt - stateView.stateReceivedAt;
        if (measuredInterval >= 30 && measuredInterval <= 250) stateView.packetIntervalMs = stateView.packetIntervalMs * .72 + measuredInterval * .28;
        stateView.previousState = previous;
      } else {
        stateView.previousState = null;
        stateView.interpolationFrames = 0;
        stateView.poseSnapFrames = 0;
        frameSamples.length = 0;
        renderSamples.length = 0;
        renderStageSamples.length = 0;
        uiUpdateSamples.length = 0;
        lastFrameAt = performance.now();
      }
      stateView.packet = packet;
      stateView.state = packet.state;
      stateView.stateReceivedAt = receivedAt;
      mirrorEchoVault.observe(packet.state);
      const uiUpdateStart = performance.now();
      buildCharacterGrid(packet.characters || core.RACERS);
      updateStandings(packet.state);
      updatePlayerHud(packet.state);
      updateEventFeed(packet.state);
      updatePhase(packet.state);
      updateMirrorEchoUi(packet.state);
      setConnected(true);
      const uiUpdateDuration = performance.now() - uiUpdateStart;
      if (uiUpdateDuration >= 0 && uiUpdateDuration < 250) {
        uiUpdateSamples.push(uiUpdateDuration);
        if (uiUpdateSamples.length > 120) uiUpdateSamples.shift();
      }
    } catch (_) {
      setConnected(false);
    } finally {
      pollBusy = false;
    }
  }

  function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function traceTrack(context, points) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
    context.closePath();
  }

  function drawEnvironmentChoreography(state, pose) {
    const environmentId = pose.environmentId;
    ctx.save();
    if (environmentId === core.TRACK_IDS.FORGE) {
      ctx.translate(640, 400);
      ctx.rotate(pose.rotationRad);
      for (let node = 0; node < pose.density; node += 1) {
        const angle = node / pose.density * Math.PI * 2;
        const radius = 102 + (node % 2) * 28 + pose.drift * (node % 2 ? .22 : -.22);
        ctx.save(); ctx.rotate(angle);
        ctx.globalAlpha = pose.glow * (node % 2 ? .75 : 1);
        ctx.strokeStyle = node % 2 ? '#ff4fbd' : '#35f2ff';
        ctx.lineWidth = node % 2 ? 2 : 3;
        ctx.beginPath(); ctx.moveTo(74, 0); ctx.lineTo(radius - 8, 0); ctx.stroke();
        ctx.translate(radius, 0); ctx.rotate(Math.PI / 4);
        ctx.strokeRect(-5, -5, 10, 10);
        ctx.restore();
      }
      ctx.globalAlpha = .18 + pose.phase * .12;
      ctx.strokeStyle = '#d7fbff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 118 + pose.secondaryPhase * 16, .18, 2.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 118 + pose.secondaryPhase * 16, Math.PI + .18, Math.PI + 2.5); ctx.stroke();
    } else if (environmentId === core.TRACK_IDS.GARDENS) {
      ctx.translate(640, 400);
      ctx.rotate(pose.rotationRad * .12);
      for (let petal = 0; petal < pose.density; petal += 1) {
        const angle = petal / pose.density * Math.PI * 2 + (petal % 3) * .18;
        const radiusX = 112 + (petal % 6) * 19;
        const radiusY = 72 + (petal % 5) * 14;
        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY + pose.drift * Math.sin(petal * 1.71);
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle + pose.rotationRad * .18);
        ctx.globalAlpha = (.22 + (petal % 4) * .055) * (.72 + pose.glow);
        ctx.fillStyle = petal % 2 ? '#b982ff' : '#59ffd0';
        ctx.beginPath(); ctx.ellipse(0, 0, 3 + petal % 3, 9 + petal % 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (environmentId === core.TRACK_IDS.FOUNDRY) {
      [{ x: 402, y: 309 }, { x: 876, y: 492 }].forEach(function (stack, stackIndex) {
        const emberCount = pose.density / 2;
        for (let ember = 0; ember < emberCount; ember += 1) {
          const progress = pose.reducedMotion ? (ember + 1) / (emberCount + 1) : (pose.secondaryPhase + ember / emberCount + stackIndex * .31) % 1;
          const x = stack.x + Math.sin(ember * 2.14 + pose.rotationRad) * 21 + pose.drift * (stackIndex ? -.2 : .2);
          const y = stack.y + 34 - progress * 126;
          ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4 + pose.rotationRad * .16);
          ctx.globalAlpha = (.18 + progress * .48) * (.7 + pose.glow);
          ctx.fillStyle = ember % 3 ? '#ff9f43' : '#ff3d6e';
          ctx.fillRect(-3, -3, 6, 6); ctx.restore();
        }
      });
    } else {
      ctx.translate(state.track.centerX, state.track.centerY);
      ctx.rotate(pose.rotationRad);
      for (let shard = 0; shard < pose.density; shard += 1) {
        const angle = shard / pose.density * Math.PI * 2;
        const radius = 122 + pose.secondaryPhase * 24 + (shard % 2) * 16;
        ctx.save(); ctx.rotate(angle); ctx.translate(radius, 0); ctx.rotate(Math.PI / 2);
        ctx.globalAlpha = (.24 + (shard % 3) * .09) * (.72 + pose.glow);
        ctx.fillStyle = shard % 2 ? '#ff4fbd' : '#35f2ff';
        ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = .24 + pose.phase * .18;
      ctx.strokeStyle = '#f0f5ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 178, -.42, 1.32); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 178, Math.PI - .42, Math.PI + 1.32); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBattleArena(state, frameNow) {
    const arena = state.track;
    const environmentPose = core.environmentChoreographyPose(arena.id, frameNow, reducedMotion);
    syncEnvironmentDiagnostics(environmentPose);
    const pulse = environmentPose.phase;
    const background = ctx.createRadialGradient(arena.centerX, arena.centerY, 30, arena.centerX, arena.centerY, 690);
    background.addColorStop(0, '#21113c');
    background.addColorStop(.42, '#101538');
    background.addColorStop(1, '#050817');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, arena.width, arena.height);
    ctx.save();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = '#6675ff';
    ctx.lineWidth = 1;
    for (let x = 0; x < arena.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, arena.height); ctx.stroke(); }
    for (let y = 0; y < arena.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(arena.width, y); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    ctx.translate(arena.centerX, arena.centerY);
    ctx.shadowColor = '#ff4fbd';
    ctx.shadowBlur = 34;
    ctx.fillStyle = 'rgba(26,28,67,.92)';
    ctx.strokeStyle = 'rgba(255,79,189,.68)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(0, 0, arena.radiusX, arena.radiusY, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.setLineDash([12, 16]);
    ctx.lineDashOffset = reducedMotion ? 0 : -frameNow * .025;
    ctx.strokeStyle = 'rgba(53,242,255,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, arena.radiusX - 34, arena.radiusY - 34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    for (let spoke = 0; spoke < 12; spoke += 1) {
      const angle = spoke / 12 * Math.PI * 2;
      ctx.strokeStyle = spoke % 2 ? 'rgba(122,108,255,.16)' : 'rgba(53,242,255,.13)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 110, Math.sin(angle) * 72);
      ctx.lineTo(Math.cos(angle) * (arena.radiusX - 48), Math.sin(angle) * (arena.radiusY - 34));
      ctx.stroke();
    }
    const coreGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 140);
    coreGlow.addColorStop(0, 'rgba(255,255,255,.28)');
    coreGlow.addColorStop(.18, 'rgba(255,79,189,.38)');
    coreGlow.addColorStop(.55, 'rgba(122,108,255,.14)');
    coreGlow.addColorStop(1, 'rgba(122,108,255,0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath(); ctx.arc(0, 0, 140 + pulse * 8, 0, Math.PI * 2); ctx.fill();
    [38, 62, 92].forEach(function (radius, index) {
      ctx.strokeStyle = index === 1 ? 'rgba(255,79,189,.74)' : 'rgba(53,242,255,.5)';
      ctx.lineWidth = index === 1 ? 3 : 2;
      ctx.beginPath(); ctx.arc(0, 0, radius + pulse * (index + 1) * 2, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '950 24px Bahnschrift, sans-serif';
    ctx.fillText('MIRROR CORE', 0, 6);
    ctx.fillStyle = '#ff9bd8';
    ctx.font = '850 9px Bahnschrift, sans-serif';
    ctx.fillText('BREAK GUARDS // FORCE WIPES', 0, 26);
    ctx.restore();
    drawEnvironmentChoreography(state, environmentPose);
    const remaining = state.battleEndsAt ? Math.max(0, state.battleEndsAt - state.now) : core.METRICS.battleDurationMs;
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    ctx.font = '900 10px Bahnschrift, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FIRST TO ' + core.METRICS.battleScoreToWin + ' CORE · ' + Math.ceil(remaining / 1000) + 's', arena.centerX, 58);
  }

  function drawShortcutRoads(state, frameNow) {
    const track = state.track;
    const variant = core.raceVariantFor(state.variantId);
    (track.shortcuts || []).forEach(function (shortcut) {
      const width = shortcut.width * variant.shortcutWidthScale;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = track.theme.accent;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = track.theme.glow;
      ctx.globalAlpha = .17;
      ctx.lineWidth = width * 2 + 20;
      ctx.beginPath(); ctx.moveTo(shortcut.from.x, shortcut.from.y); ctx.lineTo(shortcut.to.x, shortcut.to.y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = track.theme.shoulder;
      ctx.lineWidth = width * 2 + 10;
      ctx.stroke();
      ctx.strokeStyle = track.theme.road;
      ctx.lineWidth = width * 2;
      ctx.stroke();
      ctx.setLineDash([7, 11]);
      ctx.lineDashOffset = frameNow * .025;
      ctx.strokeStyle = track.theme.accent;
      ctx.globalAlpha = .72;
      ctx.lineWidth = 3;
      ctx.stroke();
      const midX = (shortcut.from.x + shortcut.to.x) * .5;
      const midY = (shortcut.from.y + shortcut.to.y) * .5;
      const angle = Math.atan2(shortcut.to.y - shortcut.from.y, shortcut.to.x - shortcut.from.x);
      ctx.translate(midX, midY); ctx.rotate(angle);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) ctx.rotate(Math.PI);
      ctx.globalAlpha = .92; ctx.fillStyle = track.theme.accent; ctx.textAlign = 'center'; ctx.font = '950 8px Bahnschrift, sans-serif';
      ctx.fillText((variant.id === core.RACE_VARIANT_IDS.SPRINT ? 'RISK LINE // ' : 'SHORTCUT // ') + shortcut.name.toUpperCase(), 0, -9);
      ctx.restore();
    });
  }

  function drawTrackLandmarks(track, frameNow, environmentPose) {
    const pulse = environmentPose.phase;
    (track.landmarks || []).forEach(function (landmark) {
      ctx.save();
      ctx.translate(landmark.x, landmark.y);
      ctx.rotate(landmark.rotation || 0);
      if (landmark.type === 'core') {
        [32, 54, 78].forEach(function (radius, index) {
          ctx.beginPath(); ctx.arc(0, 0, radius + pulse * (index + 1) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = index === 1 ? track.theme.accent : track.theme.glow;
          ctx.globalAlpha = index === 1 ? .5 : .3; ctx.lineWidth = 2; ctx.stroke();
        });
      } else if (landmark.type === 'garden') {
        for (let petal = 0; petal < 6; petal += 1) {
          ctx.rotate(Math.PI / 3);
          ctx.fillStyle = petal % 2 ? 'rgba(185,130,255,.24)' : 'rgba(89,255,208,.23)';
          ctx.beginPath(); ctx.ellipse(0, -46 - pulse * 3, 20, 52, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = track.theme.glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 38 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
      } else if (landmark.type === 'foundry') {
        ctx.shadowColor = track.theme.glow; ctx.shadowBlur = 25;
        ctx.fillStyle = 'rgba(255,159,67,.22)';
        for (let side = 0; side < 8; side += 1) { ctx.rotate(Math.PI / 4); ctx.fillRect(-9, -84, 18, 30); }
        ctx.shadowBlur = 0; ctx.strokeStyle = track.theme.glow; ctx.lineWidth = 4;
        ctx.beginPath(); for (let side = 0; side < 6; side += 1) { const a = side / 6 * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * 54; const y = Math.sin(a) * 54; if (!side) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke();
      } else if (landmark.type === 'crystal') {
        ctx.shadowColor = track.theme.accent; ctx.shadowBlur = 18; ctx.fillStyle = 'rgba(185,130,255,.55)';
        [-22, 0, 22].forEach(function (x, index) { ctx.beginPath(); ctx.moveTo(x, -36 - index * 8); ctx.lineTo(x + 11, 0); ctx.lineTo(x, 25); ctx.lineTo(x - 11, 0); ctx.closePath(); ctx.fill(); });
      } else if (landmark.type === 'stack') {
        ctx.fillStyle = '#2d1711'; ctx.fillRect(-38, -34, 76, 68);
        ctx.strokeStyle = track.theme.glow; ctx.lineWidth = 4; ctx.strokeRect(-38, -34, 76, 68);
        ctx.fillStyle = 'rgba(255,159,67,' + (.28 + pulse * .3) + ')'; ctx.fillRect(-25, -20, 50, 14);
      } else if (landmark.type === 'gate') {
        ctx.strokeStyle = track.theme.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 45, Math.PI, 0); ctx.stroke();
      }
      if (landmark.label) {
        ctx.rotate(-(landmark.rotation || 0));
        ctx.fillStyle = '#ecfbff'; ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = '950 21px Bahnschrift, sans-serif'; ctx.fillText('AXM', 0, 7);
        ctx.fillStyle = track.theme.label; ctx.font = '800 9px Bahnschrift, sans-serif'; ctx.fillText(landmark.label, 0, 27);
      }
      ctx.restore();
    });
  }

  function drawTrackHazards(state, frameNow) {
    (state.track.hazards || []).forEach(function (hazard, index) {
      const active = core.hazardActive(hazard, state.now, state.variantId);
      const pulse = .5 + .5 * Math.sin(frameNow / 160 + index);
      ctx.save(); ctx.translate(hazard.x, hazard.y);
      ctx.globalAlpha = active ? .88 : .24;
      ctx.shadowColor = state.track.theme.accent; ctx.shadowBlur = active ? 24 : 6;
      ctx.strokeStyle = active ? state.track.theme.accent : state.track.theme.lane;
      ctx.lineWidth = active ? 6 : 2;
      ctx.beginPath(); ctx.arc(0, 0, hazard.radius * (.78 + pulse * .12), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([5, 8]); ctx.lineDashOffset = -frameNow * .04; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, hazard.radius + 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '950 8px Bahnschrift, sans-serif';
      ctx.fillText(active ? 'LIVE' : 'SAFE', 0, 3); ctx.restore();
    });
  }

  function drawRaceVariantAtmosphere(state, frameNow) {
    const variant = core.raceVariantFor(state.variantId);
    const phase = reducedMotion ? 0 : frameNow;
    window.__MIRRORSHIFT_VARIANT__.visualFrames += 1;
    ctx.save();
    if (variant.id === core.RACE_VARIANT_IDS.SPRINT) {
      ctx.globalAlpha = .115;
      ctx.strokeStyle = '#79f8ff';
      ctx.lineWidth = 2;
      for (let shard = 0; shard < 13; shard += 1) {
        const x = (shard * 113 + phase * .055) % (state.track.width + 220) - 110;
        const y = 90 + (shard % 6) * 118;
        ctx.beginPath();
        ctx.moveTo(x - 24, y + 42);
        ctx.lineTo(x + 34, y - 42);
        ctx.stroke();
      }
    } else if (variant.id === core.RACE_VARIANT_IDS.GAUNTLET) {
      const pulse = reducedMotion ? .5 : .5 + .5 * Math.sin(frameNow / 250);
      const edge = ctx.createRadialGradient(state.track.width / 2, state.track.height / 2, 260, state.track.width / 2, state.track.height / 2, 720);
      edge.addColorStop(0, 'rgba(255,70,94,0)');
      edge.addColorStop(1, 'rgba(255,70,94,' + (.12 + pulse * .06) + ')');
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, state.track.width, state.track.height);
      ctx.globalAlpha = .09 + pulse * .035;
      ctx.strokeStyle = '#ff526c';
      ctx.lineWidth = 2;
      for (let line = 0; line < 9; line += 1) {
        const y = (line * 96 + phase * .08) % state.track.height;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(state.track.width, y); ctx.stroke();
      }
    } else {
      ctx.globalAlpha = .07;
      ctx.strokeStyle = state.track.theme.glow;
      ctx.lineWidth = 2;
      ctx.strokeRect(28, 28, state.track.width - 56, state.track.height - 56);
    }
    ctx.globalAlpha = .84;
    ctx.fillStyle = variant.id === core.RACE_VARIANT_IDS.GAUNTLET ? '#ff8394' : state.track.theme.glow;
    ctx.font = '900 9px Bahnschrift, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(core.routeDirectionFor(state.routeDirectionId).label + ' // ' + variant.label + ' // ' + variant.format, state.track.width / 2, 53);
    ctx.restore();
  }

  function drawTrack(state, frameNow) {
    if (state.mode === core.MODES.BATTLE) return drawBattleArena(state, frameNow);
    const track = state.track;
    const environmentPose = core.environmentChoreographyPose(track.id, frameNow, reducedMotion);
    syncEnvironmentDiagnostics(environmentPose);
    const points = track.points;
    const theme = track.theme;
    const gradient = ctx.createRadialGradient(track.width / 2, track.height / 2, 40, track.width / 2, track.height / 2, 680);
    gradient.addColorStop(0, theme.center);
    gradient.addColorStop(.5, theme.road);
    gradient.addColorStop(1, theme.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, track.width, track.height);

    ctx.save(); ctx.globalAlpha = .12; ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
    for (let x = 0; x < track.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, track.height); ctx.stroke(); }
    for (let y = 0; y < track.height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(track.width, y); ctx.stroke(); }
    ctx.restore();

    drawShortcutRoads(state, frameNow);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    traceTrack(ctx, points); ctx.strokeStyle = theme.glow; ctx.globalAlpha = .15; ctx.shadowColor = theme.glow; ctx.shadowBlur = 28; ctx.lineWidth = track.roadWidth + 26; ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    traceTrack(ctx, points); ctx.strokeStyle = theme.shoulder; ctx.lineWidth = track.roadWidth + 14; ctx.stroke();
    traceTrack(ctx, points); ctx.strokeStyle = theme.road; ctx.lineWidth = track.roadWidth; ctx.stroke();
    traceTrack(ctx, points); ctx.setLineDash([8, 16]); ctx.lineDashOffset = -frameNow * .018; ctx.strokeStyle = theme.lane; ctx.globalAlpha = .34; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();

    drawEnvironmentChoreography(state, environmentPose);
    drawTrackLandmarks(track, frameNow, environmentPose);
    drawTrackHazards(state, frameNow);
    drawRaceVariantAtmosphere(state, frameNow);

    const start = points[0];
    const ahead = points[2];
    const heading = Math.atan2(ahead.y - start.y, ahead.x - start.x);
    ctx.save(); ctx.translate(start.x, start.y); ctx.rotate(heading + Math.PI / 2);
    for (let row = -4; row < 4; row += 1) for (let col = -1; col < 1; col += 1) {
      ctx.fillStyle = (row + col) % 2 ? '#eef7ff' : theme.road; ctx.fillRect(row * 13, col * 12, 13, 12);
    }
    ctx.restore();
  }

  function drawPads(state, frameNow) {
    state.pads.forEach(function (pad, index) {
      if (!pad.active) return;
      const pulse = 1 + Math.sin(frameNow / 280 + index) * .12;
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(frameNow / 950 + index);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = '#35f2ff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = index % 3 === 0 ? '#ff4fbd' : '#35f2ff';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(12, 0); ctx.lineTo(0, 12); ctx.lineTo(-12, 0); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#11142f';
      ctx.fillRect(-3, -7, 6, 14);
      ctx.restore();
    });
  }

  function drawWeapons(state, frameNow) {
    state.mines.forEach(function (mine) {
      ctx.save();
      ctx.translate(mine.x, mine.y);
      ctx.rotate(frameNow / 330);
      ctx.shadowColor = '#ff4fbd'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff4fbd';
      for (let spike = 0; spike < 8; spike += 1) {
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-2, -14, 4, 10);
      }
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    state.projectiles.forEach(function (bolt) {
      ctx.save();
      ctx.translate(bolt.x, bolt.y);
      ctx.rotate(bolt.heading);
      ctx.shadowColor = '#35f2ff'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#e8ffff';
      ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-8, 6); ctx.lineTo(-4, 0); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(53,242,255,.52)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-30, 0); ctx.stroke();
      ctx.restore();
    });
  }

  function drawCharacterFlourish(racer, frameNow, stateNow) {
    const expression = core.characterExpressionFor(racer.characterId);
    const liveState = stateView.state;
    const introAge = liveState && liveState.raceStartedAt ? stateNow - liveState.raceStartedAt : Infinity;
    const intro = introAge >= 0 && introAge < 1650;
    const boosting = stateNow < racer.boostUntil;
    const released = racer.driftReleasedAt && stateNow - racer.driftReleasedAt < 720;
    if (!intro && !boosting && !released) return false;
    const phase = reducedMotion ? 0 : frameNow / 180;
    const strength = Math.min(1, (intro ? 1 - introAge / 1650 : 0) + (boosting ? .7 : 0) + (released ? .5 : 0));
    ctx.save();
    ctx.globalAlpha = .28 + strength * .46;
    ctx.strokeStyle = racer.accent;
    ctx.fillStyle = racer.accent;
    ctx.lineWidth = 2;
    ctx.shadowColor = racer.color;
    ctx.shadowBlur = 12;
    if (racer.characterId === 'p1') {
      for (let index = 0; index < 3; index += 1) {
        const back = -24 - index * 8 - Math.sin(phase + index) * 3;
        const spread = 8 + index * 3;
        ctx.beginPath();
        ctx.moveTo(back + 7, -spread); ctx.lineTo(back, 0); ctx.lineTo(back + 7, spread); ctx.stroke();
      }
    } else if (racer.characterId === 'p2') {
      ctx.save();
      ctx.rotate(phase * .32);
      ctx.beginPath(); ctx.ellipse(0, 0, 31 + strength * 5, 19 + strength * 3, 0, -.2, Math.PI + .35); ctx.stroke();
      ctx.rotate(-phase * .64);
      ctx.beginPath(); ctx.ellipse(0, 0, 26 + strength * 4, 16 + strength * 2, 0, Math.PI - .2, Math.PI * 2 + .35); ctx.stroke();
      ctx.restore();
    } else if (racer.characterId === 'p3') {
      for (let index = 0; index < 6; index += 1) {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const offset = reducedMotion ? 0 : Math.sin(phase * 1.7 + index) * 3;
        ctx.globalAlpha = .22 + strength * (.25 + index * .035);
        ctx.fillRect(-31 - row * 7 + offset, -11 + column * 10, 4 + column, 4 + row);
      }
    } else {
      for (let echo = 1; echo <= 2; echo += 1) {
        const offset = 15 + echo * 10 + (reducedMotion ? 0 : Math.sin(phase + echo) * 3);
        ctx.globalAlpha = (.22 + strength * .2) / echo;
        ctx.beginPath();
        ctx.moveTo(-offset + 13, 0); ctx.lineTo(-offset, 10); ctx.lineTo(-offset - 13, 0); ctx.lineTo(-offset, -10); ctx.closePath(); ctx.stroke();
      }
    }
    ctx.restore();
    if (racer.id === 'p1') {
      Object.assign(window.__MIRRORSHIFT_EXPRESSION__, {
        characterId: racer.characterId,
        expressionId: expression.id,
        activeVisual: expression.visual,
        visualFrames: window.__MIRRORSHIFT_EXPRESSION__.visualFrames + 1
      });
      syncExpressionDiagnostics();
    }
    return true;
  }

  function drawKineticWheels(racer, pose) {
    const axles = [
      { x: -14 + pose.rearTravel, front: false },
      { x: 14 + pose.frontTravel, front: true }
    ];
    axles.forEach(function (axle) {
      [-1, 1].forEach(function (side) {
        ctx.save();
        ctx.translate(axle.x, side * 14);
        if (axle.front) ctx.rotate(pose.wheelSteer);
        ctx.fillStyle = racer.dark;
        roundedRect(ctx, -5, -4, 11, 8, 3);
        ctx.fill();
        ctx.rotate(pose.wheelSpin);
        ctx.strokeStyle = racer.accent;
        ctx.globalAlpha = .72;
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.stroke();
        ctx.restore();
      });
    });
  }

  function drawKineticIdentityRig(racer, pose) {
    const pulse = pose.signaturePhase;
    const energy = pose.energy;
    ctx.save();
    ctx.strokeStyle = racer.accent;
    ctx.fillStyle = racer.accent;
    ctx.shadowColor = racer.color;
    ctx.shadowBlur = 5 + energy * 8;
    ctx.lineWidth = 1.5;
    if (racer.characterId === 'p1') {
      const extension = 2 + pulse * 5;
      [-1, 1].forEach(function (side) {
        ctx.globalAlpha = .64 + energy * .26;
        ctx.fillRect(-20 - extension, side * 8 - 3, 7 + extension, 6);
        ctx.fillStyle = racer.dark;
        ctx.fillRect(-17 - extension, side * 8 - 1, 6 + extension, 2);
        ctx.fillStyle = racer.accent;
      });
      ctx.translate(5, 0);
      ctx.rotate((pulse - .5) * .42);
      for (let tooth = 0; tooth < 6; tooth += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.fillRect(7, -1.5, 4, 3);
      }
    } else if (racer.characterId === 'p2') {
      ctx.globalAlpha = .56 + energy * .28;
      ctx.save();
      ctx.rotate((pulse - .5) * .52);
      ctx.beginPath(); ctx.ellipse(0, 0, 19 + pulse * 3, 9, 0, -.65, .65); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 19 + (1 - pulse) * 3, 9, Math.PI, -.65, .65); ctx.stroke();
      ctx.restore();
      ctx.fillRect(-2, -12 - pulse * 2, 4, 5);
      ctx.fillRect(-2, 7 + pulse * 2, 4, 5);
    } else if (racer.characterId === 'p3') {
      for (let index = 0; index < 4; index += 1) {
        const active = pulse * 4 >= index;
        ctx.globalAlpha = active ? .82 : .28;
        const x = -18 + index * 7;
        const height = 4 + index * 1.3;
        ctx.fillRect(x, -14 - height, 5, height);
        ctx.fillRect(x, 14, 5, height);
      }
      ctx.globalAlpha = .55 + energy * .4;
      ctx.strokeRect(8, -7, 10, 14);
    } else {
      const spread = 2 + pulse * 5;
      ctx.globalAlpha = .48 + energy * .36;
      [-1, 1].forEach(function (side) {
        ctx.save();
        ctx.translate(-2, side * (13 + spread));
        ctx.rotate(side * (.12 + pulse * .18));
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(0, 5); ctx.lineTo(-10, 0); ctx.lineTo(0, -5); ctx.closePath();
        ctx.stroke();
        ctx.restore();
      });
      ctx.globalAlpha = .72;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, 6); ctx.lineTo(-8, 0); ctx.lineTo(0, -6); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }

  function recordKineticPose(racer, pose) {
    if (racer.id !== 'p1') return;
    const diagnostics = window.__MIRRORSHIFT_KINETIC__;
    diagnostics.characterId = racer.characterId;
    diagnostics.rigId = pose.rigId;
    diagnostics.motion = pose.motion;
    diagnostics.state = pose.state;
    diagnostics.reducedMotion = pose.reducedMotion;
    diagnostics.poseFrames += 1;
    diagnostics.maxBodyLift = Math.max(diagnostics.maxBodyLift, Math.abs(pose.bodyLift));
    diagnostics.maxBodyRoll = Math.max(diagnostics.maxBodyRoll, Math.abs(pose.bodyRoll));
    diagnostics.statesObserved[pose.state] = (diagnostics.statesObserved[pose.state] || 0) + 1;
    syncKineticDiagnostics();
  }

  function drawKart(racer, frameNow, stateNow) {
    if (racer.respawnAt && stateNow < racer.respawnAt) {
      const remaining = Math.max(0, racer.respawnAt - stateNow);
      ctx.save();
      ctx.translate(racer.x, racer.y);
      ctx.globalAlpha = .35 + .3 * Math.sin(frameNow / 90);
      ctx.strokeStyle = racer.accent;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(0, 0, 24 + remaining / 120, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = racer.color;
      ctx.textAlign = 'center';
      ctx.font = '900 9px Bahnschrift, sans-serif';
      ctx.fillText('REBOOT', 0, 3);
      ctx.restore();
      return;
    }
    const drifting = Boolean(racer.drifting);
    const boosting = stateNow < racer.boostUntil;
    const kineticPose = core.vehicleAnimationPose(racer, frameNow, stateNow, reducedMotion);
    const driftColors = ['#aab5d3', '#35f2ff', '#8c79ff', '#ffad52'];
    const driftColor = driftColors[racer.driftTier || 0];
    ctx.save();
    ctx.translate(racer.x, racer.y);
    ctx.rotate(racer.heading - (drifting ? racer.driftDirection * (.07 + racer.driftCharge * .16) : 0));
    ctx.translate(0, kineticPose.bodyLift);
    ctx.rotate(kineticPose.bodyRoll);
    ctx.globalAlpha = racer.finishedAt != null ? .66 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath(); ctx.ellipse(-3, 5, 28, 17, 0, 0, Math.PI * 2); ctx.fill();
    if (racer.shield > 0) {
      ctx.save();
      ctx.rotate(-racer.heading - frameNow / 1800);
      ctx.strokeStyle = racer.accent;
      ctx.globalAlpha = .18 + racer.shield * .08;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 7]);
      ctx.beginPath(); ctx.ellipse(0, 0, 34, 24, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (stateNow < racer.spawnProtectionUntil) {
      ctx.save();
      ctx.rotate(-racer.heading - frameNow / 420);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = .72;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.ellipse(0, 0, 39, 28, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const characterFlourishActive = drawCharacterFlourish(racer, frameNow, stateNow);
    ctx.shadowColor = racer.color;
    ctx.shadowBlur = 14;
    drawKineticWheels(racer, kineticPose);
    ctx.fillStyle = racer.color;
    if (racer.characterId === 'p1') {
      roundedRect(ctx, -23, -13, 46, 26, 6); ctx.fill();
      ctx.fillStyle = racer.accent; ctx.fillRect(-14, -10, 6, 20); ctx.fillRect(7, -10, 4, 20);
    } else if (racer.characterId === 'p2') {
      ctx.beginPath(); ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = racer.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(-2, 0, 15, 10, 0, 0, Math.PI * 2); ctx.stroke();
    } else if (racer.characterId === 'p3') {
      ctx.lineWidth = 5; ctx.strokeStyle = racer.color; roundedRect(ctx, -22, -13, 44, 26, 8); ctx.stroke();
      ctx.fillStyle = '#141735'; roundedRect(ctx, -12, -9, 25, 18, 5); ctx.fill();
      ctx.fillStyle = racer.accent; ctx.fillRect(-18, -2, 8, 4); ctx.fillRect(13, -2, 7, 4);
    } else {
      ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(-16, 14); ctx.lineTo(-23, 0); ctx.lineTo(-16, -14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = racer.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-15, 0); ctx.stroke();
    }
    drawKineticIdentityRig(racer, kineticPose);
    ctx.shadowBlur = 0;
    ctx.fillStyle = racer.accent;
    ctx.beginPath(); ctx.arc(-1, 0, 6, 0, Math.PI * 2); ctx.fill();
    if (drifting) {
      ctx.save();
      ctx.strokeStyle = driftColor;
      ctx.fillStyle = driftColor;
      ctx.shadowColor = driftColor;
      ctx.shadowBlur = 12;
      for (let spark = 0; spark < 5; spark += 1) {
        const phase = frameNow * .018 + spark * 1.7 + racer.id.charCodeAt(1);
        const rearX = -18 - (spark % 2) * 3;
        const rearY = (spark % 2 ? 10 : -10) + Math.sin(phase) * 3;
        const length = 7 + (racer.driftTier || 0) * 3 + (spark % 3) * 2;
        ctx.lineWidth = 1.5 + (spark % 2);
        ctx.beginPath();
        ctx.moveTo(rearX, rearY);
        ctx.lineTo(rearX - length, rearY + Math.sin(phase * 1.3) * 7);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (racer.speed > 60) {
      const trail = 7 + racer.speed / 35 + (boosting ? 20 : 0);
      const exhaust = ctx.createLinearGradient(-18, 0, -18 - trail, 0);
      exhaust.addColorStop(0, boosting ? '#ffffff' : racer.accent); exhaust.addColorStop(.25, racer.accent); exhaust.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = exhaust; ctx.lineWidth = boosting ? 5 : 3;
      ctx.beginPath(); ctx.moveTo(-18, -7); ctx.lineTo(-18 - trail, -7); ctx.moveTo(-18, 7); ctx.lineTo(-18 - trail, 7); ctx.stroke();
    }
    ctx.restore();
    recordKineticPose(racer, kineticPose);

    ctx.save();
    ctx.translate(racer.x, racer.y - 27);
    ctx.textAlign = 'center';
    ctx.font = '900 9px Bahnschrift, sans-serif';
    ctx.fillStyle = racer.color;
    ctx.shadowColor = '#050615'; ctx.shadowBlur = 4;
    ctx.fillText(racer.character.toUpperCase(), 0, 0);
    if (characterFlourishActive) {
      const expression = core.characterExpressionFor(racer.characterId);
      ctx.font = '900 6px Bahnschrift, sans-serif';
      ctx.fillStyle = racer.accent;
      ctx.fillText(expression.label, 0, 10);
    }
    if (racer.item) {
      ctx.font = '900 12px Bahnschrift, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(core.ITEM_TYPES[racer.item].icon, 0, -12);
    }
    ctx.restore();
  }

  function drawMirrorEcho(state, frameNow) {
    const echo = mirrorEchoVault.playback(state);
    if (!echo) return false;
    const pose = echo.pose;
    const pulse = reducedMotion ? .5 : .5 + Math.sin(frameNow / 145) * .5;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.heading);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = .32 + pulse * .16;
    ctx.strokeStyle = echo.source.accent;
    ctx.fillStyle = echo.source.color;
    ctx.shadowColor = '#8d7aff';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([7, 5]);
    roundedRect(ctx, -23, -13, 46, 26, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha *= .42;
    ctx.fill();
    ctx.globalAlpha = .58;
    ctx.beginPath();
    ctx.moveTo(25, 0); ctx.lineTo(12, 7); ctx.lineTo(12, -7); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .24;
    for (let trail = 1; trail <= 3; trail += 1) {
      ctx.strokeStyle = trail % 2 ? echo.source.accent : '#8d7aff';
      ctx.beginPath();
      ctx.moveTo(-18 - trail * 7, -8); ctx.lineTo(-31 - trail * 13, -8);
      ctx.moveTo(-18 - trail * 7, 8); ctx.lineTo(-31 - trail * 13, 8);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(pose.x, pose.y - 29);
    ctx.textAlign = 'center';
    ctx.font = '900 7px Bahnschrift, sans-serif';
    ctx.fillStyle = '#c8bdff';
    ctx.shadowColor = '#070719'; ctx.shadowBlur = 5;
    ctx.fillText('ECHO // ' + echo.source.character.toUpperCase(), 0, 0);
    ctx.restore();
    return true;
  }

  function drawEffects(state, frameNow) {
    state.effects.forEach(function (effect) {
      const life = Math.max(0, Math.min(1, (state.now - effect.bornAt) / Math.max(1, effect.expiresAt - effect.bornAt)));
      ctx.save();
      ctx.globalAlpha = 1 - life;
      ctx.strokeStyle = effect.type === 'emp' ? '#ff4fbd' : (effect.color || '#35f2ff');
      ctx.lineWidth = effect.type === 'wipeout' ? 7 : 4;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 18 + life * (effect.type === 'emp' ? 185 : 78), 0, Math.PI * 2);
      ctx.stroke();
      if (effect.type === 'drift-boost') {
        ctx.globalAlpha = (1 - life) * .8;
        for (let ray = 0; ray < 8; ray += 1) {
          const angle = ray / 8 * Math.PI * 2;
          const inner = 24 + life * 18;
          const outer = 40 + life * 52;
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
          ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
          ctx.stroke();
        }
      }
      ctx.restore();
    });
  }

  function drawScreenFx(state, frameNow) {
    if (reducedMotion) return;
    const player = state.racers.p1;
    if (!player) return;
    const ratio = Math.max(0, Math.min(1.2, player.speed / (core.BASE_STATS.maxSpeed * player.catchup)));
    const boosting = state.now < player.boostUntil;
    if (ratio < .78 && !boosting) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const centerX = canvas.width * .5;
    const centerY = canvas.height * .52;
    const intensity = Math.min(.24, Math.max(0, ratio - .72) * .34 + (boosting ? .09 : 0));
    ctx.globalAlpha = intensity;
    ctx.strokeStyle = boosting ? '#aefcff' : '#7485c9';
    ctx.lineWidth = Math.max(1, canvas.width / 900);
    for (let line = 0; line < 24; line += 1) {
      const angle = line / 24 * Math.PI * 2 + Math.sin(frameNow / 900) * .02;
      const inner = Math.min(canvas.width, canvas.height) * (.31 + (line % 4) * .012);
      const outer = inner + 26 + ratio * 38 + (line % 3) * 8;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
      ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
      ctx.stroke();
    }
    if (boosting) {
      const edge = ctx.createRadialGradient(centerX, centerY, Math.min(canvas.width, canvas.height) * .28, centerX, centerY, Math.max(canvas.width, canvas.height) * .65);
      edge.addColorStop(0, 'rgba(53,242,255,0)');
      edge.addColorStop(1, 'rgba(53,242,255,.22)');
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
  }

  function draw(frameNow) {
    const renderStart = performance.now();
    updateFrameDiagnostics(frameNow);
    resizeCanvas();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const state = stateView.state;
    if (!state) {
      ctx.fillStyle = '#090b22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      requestAnimationFrame(draw);
      return;
    }
    animateStartGrid(frameNow, state);
    animateResultStage(frameNow, state);
    const player = state.racers.p1;
    const boosting = player && state.now < player.boostUntil;
    const zoom = !reducedMotion && boosting ? 1.018 : 1;
    const scale = Math.min(canvas.width / state.track.width, canvas.height / state.track.height) * zoom;
    const shakeStrength = !reducedMotion && player && state.now < player.spinUntil ? 5 * Math.min(1, (player.spinUntil - state.now) / 260) : 0;
    const offsetX = (canvas.width - state.track.width * scale) / 2 + Math.sin(frameNow * .09) * shakeStrength;
    const offsetY = (canvas.height - state.track.height * scale) / 2 + Math.cos(frameNow * .11) * shakeStrength;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    const trackStart = performance.now();
    drawTrack(state, frameNow);
    drawPads(state, frameNow);
    drawWeapons(state, frameNow);
    const actorStart = performance.now();
    const previousRacers = stateView.previousState && stateView.previousState.racers;
    const interpolationActive = state.phase === core.PHASES.RACING && previousRacers;
    const interpolationAlpha = interpolationActive ? Math.min(1, Math.max(0, (performance.now() - stateView.stateReceivedAt) / Math.max(45, stateView.packetIntervalMs))) : 1;
    let frameInterpolated = false;
    let frameSnapped = false;
    const visualRacers = Object.values(state.racers).map(function (racer) {
      if (!interpolationActive || !previousRacers[racer.id]) return racer;
      const pose = core.interpolatePresentationPose(previousRacers[racer.id], racer, interpolationAlpha, 180);
      frameInterpolated = frameInterpolated || pose.interpolated;
      frameSnapped = frameSnapped || pose.snapped;
      return Object.assign({}, racer, { x: pose.x, y: pose.y, heading: pose.heading });
    });
    if (frameInterpolated) stateView.interpolationFrames += 1;
    if (frameSnapped) stateView.poseSnapFrames += 1;
    drawMirrorEcho(state, frameNow);
    visualRacers.sort(function (a, b) { return a.y - b.y; }).forEach(function (racer) { drawKart(racer, frameNow, state.now); });
    const effectsStart = performance.now();
    drawEffects(state, frameNow);
    drawScreenFx(state, frameNow);
    const audioStart = performance.now();
    updateEngine(state);
    updateMusic(state);
    const renderEnd = performance.now();
    updateRenderDiagnostics(renderEnd - renderStart, {
      track: actorStart - trackStart,
      actors: effectsStart - actorStart,
      effects: audioStart - effectsStart,
      audio: renderEnd - audioStart
    }, state);
    requestAnimationFrame(draw);
  }

  function currentDriveIntent() {
    const layout = KEYBOARD_LAYOUTS[keyboardLayout];
    const left = layout.left.some(function (code) { return keys.has(code); }) || touch.left;
    const right = layout.right.some(function (code) { return keys.has(code); }) || touch.right;
    const gas = layout.gas.some(function (code) { return keys.has(code); }) || touch.gas;
    const brake = layout.brake.some(function (code) { return keys.has(code); }) || touch.brake;
    return { type: 'drive', throttle: gas ? 1 : 0, brake: brake ? 1 : 0, steer: (left ? -1 : 0) + (right ? 1 : 0) };
  }

  function sendDriveIntent() {
    if (!stateView.state || stateView.state.phase !== core.PHASES.RACING) return;
    const intent = currentDriveIntent();
    const signature = [intent.throttle, intent.brake, intent.steer].join(':');
    if (signature !== lastIntent || signature !== '0:0:0') {
      lastIntent = signature;
      postAction(intent);
    }
  }

  function startRace() {
    ensureAudio();
    window.scrollTo(0, 0);
    api('/api/start', { method: 'POST' }).then(pollState).catch(function () {});
  }

  function selectMode(mode) {
    statusLive.textContent = 'Requesting server-owned mode change.';
    api('/api/mode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: mode })
    }).then(function (packet) {
      statusLive.textContent = packet && packet.ok
        ? 'Mode changed to ' + packet.state.mode + '. Server authority confirmed.'
        : 'Mode change refused by authority: ' + String(packet && packet.reason || 'unknown') + '.';
      return pollState();
    }).catch(function () {
      statusLive.textContent = 'Mode change request failed. Current server mode retained.';
    });
  }

  function selectTrack(trackId) {
    if (!stateView.state || stateView.state.phase !== core.PHASES.LOBBY || stateView.state.mode !== core.MODES.RACE) return;
    api('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ trackId: trackId })
    }).then(pollState).catch(function () {});
  }

  function selectRaceVariant(variantId) {
    if (!stateView.state || stateView.state.phase !== core.PHASES.LOBBY || stateView.state.mode !== core.MODES.RACE) return;
    ensureAudio();
    api('/api/variant', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ variantId: variantId })
    }).then(pollState).catch(function () {});
  }

  function selectRouteDirection(routeDirectionId) {
    if (!stateView.state || stateView.state.phase !== core.PHASES.LOBBY || stateView.state.mode !== core.MODES.RACE) return;
    api('/api/route-direction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ routeDirectionId: routeDirectionId })
    }).then(pollState).catch(function () {});
  }

  function setPlayerAssists(next) {
    if (!stateView.state || stateView.state.phase !== core.PHASES.LOBBY) return;
    const current = stateView.state.racers.p1.assists || {};
    const assists = Object.assign({ steering: Boolean(current.steering), autoAccelerate: Boolean(current.autoAccelerate) }, next || {});
    api('/api/assist', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', assists: assists })
    }).then(pollState).catch(function () {});
  }

  function selectCharacter(characterId) {
    if (!stateView.state || stateView.state.phase !== core.PHASES.LOBBY) return;
    ensureAudio();
    api('/api/character', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: 'p1', characterId: characterId })
    }).then(function (packet) {
      if (packet && packet.ok) statusLive.textContent = 'P1 chose ' + packet.state.racers.p1.character + '. Equal performance unchanged.';
      return pollState();
    }).catch(function () {});
  }

  function useItem() {
    ensureAudio();
    postAction({ type: 'item' });
  }

  async function resetGame(startAfter) {
    await api('/api/reset', { method: 'POST' });
    stateView.lastEventId = 0;
    stateView.lastPhase = null;
    await pollState();
    if (startAfter) startRace();
  }

  async function advanceTourRound() {
    ensureAudio();
    await api('/api/tour/advance', { method: 'POST' });
    stateView.lastPhase = null;
    await pollState();
  }

  document.getElementById('startButton').addEventListener('click', startRace);
  document.querySelectorAll('[data-mode]').forEach(function (button) {
    button.addEventListener('click', function () { selectMode(button.getAttribute('data-mode')); });
  });
  document.querySelectorAll('[data-track]').forEach(function (button) {
    button.addEventListener('click', function () { selectTrack(button.getAttribute('data-track')); });
  });
  document.querySelectorAll('button[data-variant]').forEach(function (button) {
    button.addEventListener('click', function () { selectRaceVariant(button.getAttribute('data-variant')); });
  });
  document.querySelectorAll('button[data-route-direction]').forEach(function (button) {
    button.addEventListener('click', function () { selectRouteDirection(button.getAttribute('data-route-direction')); });
  });
  document.getElementById('keyboardLayout').addEventListener('change', function () {
    if (!KEYBOARD_LAYOUTS[this.value]) return;
    keyboardLayout = this.value;
    keys.clear();
    try { window.localStorage.setItem('mirrorshift-keyboard-layout', keyboardLayout); } catch (_) {}
    statusLive.textContent = 'Keyboard layout changed to ' + KEYBOARD_LAYOUTS[keyboardLayout].label + '.';
    if (stateView.state) updateLobbyMode(stateView.state);
  });
  document.getElementById('steeringAssist').addEventListener('click', function () {
    const active = stateView.state && stateView.state.racers.p1.assists && stateView.state.racers.p1.assists.steering;
    setPlayerAssists({ steering: !active });
  });
  document.getElementById('autoAccelerate').addEventListener('click', function () {
    const active = stateView.state && stateView.state.racers.p1.assists && stateView.state.racers.p1.assists.autoAccelerate;
    setPlayerAssists({ autoAccelerate: !active });
  });
  document.getElementById('itemButton').addEventListener('click', useItem);
  document.getElementById('againButton').addEventListener('click', function () {
    const state = stateView.state;
    if (state && state.result && state.result.tour && !state.result.tour.complete) return advanceTourRound().catch(function () {});
    resetGame(true).catch(function () {});
  });
  document.getElementById('resetButton').addEventListener('click', function () { resetGame(false).catch(function () {}); });
  document.getElementById('muteButton').addEventListener('click', function () {
    muted = !muted;
    this.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    this.setAttribute('aria-pressed', String(muted));
    if (!muted) ensureAudio();
  });
  document.getElementById('echoButton').addEventListener('click', function () {
    const enabled = mirrorEchoVault.setEnabled(this.getAttribute('aria-pressed') !== 'true');
    statusLive.textContent = enabled ? 'Mirror Echo playback enabled.' : 'Mirror Echo playback paused. Sealed session laps are retained.';
    if (stateView.state) updateMirrorEchoUi(stateView.state);
  });

  window.addEventListener('keydown', function (event) {
    const layout = KEYBOARD_LAYOUTS[keyboardLayout];
    const mapped = layout.left.concat(layout.right, layout.gas, layout.brake, layout.item);
    if (mapped.includes(event.code)) event.preventDefault();
    if (!keys.has(event.code) && layout.item.includes(event.code)) useItem();
    if (!keys.has(event.code) && event.code === 'Enter' && stateView.state && stateView.state.phase === core.PHASES.LOBBY) startRace();
    keys.add(event.code);
  });
  window.addEventListener('keyup', function (event) { keys.delete(event.code); });
  window.addEventListener('blur', function () { keys.clear(); touch.left = touch.right = touch.gas = touch.brake = false; });
  window.addEventListener('online', function () { actionSessionReady = false; syncActionSession('online').catch(function () {}); });

  document.querySelectorAll('[data-control]').forEach(function (button) {
    const control = button.getAttribute('data-control');
    function down(event) {
      event.preventDefault();
      ensureAudio();
      button.classList.add('is-down');
      if (control === 'item') useItem();
      else touch[control] = true;
      if (button.setPointerCapture && event.pointerId != null) button.setPointerCapture(event.pointerId);
    }
    function up(event) {
      event.preventDefault();
      button.classList.remove('is-down');
      if (control !== 'item') touch[control] = false;
    }
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
  });

  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
  window.addEventListener('resize', resizeCanvas);
  setInterval(pollState, 90);
  setInterval(sendDriveIntent, 75);
  setInterval(heartbeatActionSession, 1000);
  syncActionSession('load').catch(function () {});
  pollState();
  requestAnimationFrame(draw);
})();
