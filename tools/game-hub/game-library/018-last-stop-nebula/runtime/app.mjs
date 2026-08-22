import {
  GAME_VERSION,
  REVIEW_LIMIT,
  STARTING_DEBT,
  RUN_MODES,
  LANE_DEFS,
  DISPATCHES,
  UPGRADES,
  EVENTS,
  createNewGame,
  derivedStats,
  spawnCustomer,
  serveNext,
  buySupply,
  takeMicroNap,
  buyUpgrade,
  canBuyUpgrade,
  presentEvent,
  chooseEvent,
  decisionLegacy,
  debtLiberation,
  dispatchStatus,
  tickGame,
  queueSummary,
  queueConstellation,
  shiftAtmosphere,
  arrivalForecast,
  operationalAdvice,
  calculateScore,
  sanitizeLoadedState,
  seededRandom
} from './game-core.mjs';
import { NebulaScene } from './scene.mjs';
import {
  createRunSummary,
  normalizeLedger,
  addRunToLedger,
  aggregateRunHistory,
  aggregateReviewCurve,
  createBalanceReport
} from './run-telemetry.mjs';

const SAVE_KEY = 'last-stop-nebula-save-v1';
const RECORD_KEY = 'last-stop-nebula-record-v1';
const SETTINGS_KEY = 'last-stop-nebula-settings-v1';
const LEDGER_KEY = 'last-stop-nebula-run-ledger-v1';
const QUERY = new URLSearchParams(window.location.search);
const QA_MODE = QUERY.get('qa');
const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const UI = {};
[
  'game-shell','world','boot-screen','title-screen','new-run-button','continue-button','continue-day','continue-meta','how-button',
  'title-highscore','title-highscore-mode','setup-screen','setup-close','mode-grid','sign-contract-button','intro-screen',
  'story-kicker','story-title','story-copy','story-quote','story-progress','story-next','skip-intro','hud','day-value','total-days',
  'day-block','clock-value','shift-phase','retirement-progress','credits-value','debt-stat','debt-stage','debt-value','debt-line','debt-phase','debt-meter','debt-line-value','reviews-value','review-progress','review-stat','camera-button',
  'upgrade-button','upgrade-ready','sound-button','pause-button','mission-panel','pressure-title','pressure-copy','pressure-action','dispatch-line','dispatch-phase','dispatch-title','dispatch-copy','dispatch-meter','dispatch-progress','dispatch-timer','dispatch-marks','arrival-line','arrival-label','arrival-meter','arrival-eta','demand-label','demand-meter',
  'queue-total','served-total','fuel-value','fuel-capacity','fuel-progress','leak-indicator','buy-fuel-button','stock-value',
  'stock-capacity','stock-progress','buy-stock-button','energy-value','energy-capacity','energy-progress','rest-button','rest-status',
  'morale-progress','morale-value','camera-dock','lane-dock','upgrade-panel','upgrade-close','upgrade-cash','upgrade-count',
  'upgrade-grid','event-modal','event-kicker','event-route','event-title','event-copy','event-choices','pause-modal','resume-button','motion-button',
  'motion-value','pause-sound-button','pause-sound-value','graphics-button','graphics-value','pause-help-button','save-title-button','abandon-button','help-modal',
  'help-close','help-done','results-screen','result-kicker','result-title','result-copy','result-score','new-record','result-served',
  'result-lost','result-reviews','result-upgrades','result-grade','result-velocity','result-capture','result-automation',
  'result-ledger-button','payout-breakdown','retry-button','result-title-button','ledger-button','ledger-field-summary',
  'ledger-modal','ledger-close','ledger-runs','ledger-retire-rate','ledger-review-velocity','ledger-collapse-day','ledger-guidance',
  'ledger-scope','ledger-curve','ledger-list','ledger-download','ledger-export','ledger-done','toast-stack',
  'announcement','announcement-kicker','announcement-title','live-region'
].forEach(id => { UI[id.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = $(id); });

const SPECIES = ['MOSS PILOT', 'VIOLET MERCHANT', 'TIDAL FAMILY', 'EMBER COURIER', 'GLASS TOURIST', 'ORBITAL ELDER'];
const STORY = [
  {
    kicker: 'FIVE MONTHS WITHOUT PROFIT',
    title: 'The nebula stopped being enough.',
    copy: 'Nobody visits. The plasma tank leaks. Most days, you choose between food and keeping the sign on.',
    quote: 'Three weeks until the bank takes the station.',
    camera: 'vista'
  },
  {
    kicker: '06:43 · AN UNFAMILIAR ENGINE',
    title: 'A builder drone crosses the dark.',
    copy: 'It repairs the abandoned tourist attraction on the far side of the asteroid. Probably scavengers. Hopefully not your problem.',
    quote: 'Everything here belongs to the same corporation. Including, technically, the debt.',
    camera: 'engineering'
  },
  {
    kicker: '07:02 · ONE LETTER THAT ISN’T A BILL',
    title: 'AXM bought the old attraction.',
    copy: '“We are rebuilding this as a new frontier place for entertainment. We hope you prepare soon because it will get very busy.”',
    quote: 'Sent two weeks ago. Opening date: today.',
    camera: 'mart'
  },
  {
    kicker: '07:03 · FORECOURT SENSOR OVERLOAD',
    title: 'The first convoy arrives.',
    copy: 'Cars need plasma. Tourists want food. A tour bus needs repairs. You have no staff, no automation, and no plan.',
    quote: 'But the money is finally coming in.',
    camera: 'forecourt'
  },
  {
    kicker: 'YOUR LAST CONTRACT',
    title: 'Growth is guaranteed. Capture it.',
    copy: 'Serve what you can. Rebuild while open. Keep the bad reviews below 1,000 until the retirement shuttle arrives.',
    quote: 'Keep up. You’re almost retired.',
    camera: 'vista'
  }
];

let scene;
let state = null;
let random = Math.random;
let selectedMode = 'standard';
let screen = 'boot';
let paused = false;
let storyIndex = 0;
let helpReturn = 'title';
let lastFrame = performance.now();
let lastUiRender = 0;
let lastSceneSync = 0;
let lastSavedAt = 0;
let lastSavedDay = 0;
let lastHandledAction = null;
let lastDispatchRevision = 0;
let cameraIndex = 0;
const cameraOrder = ['forecourt', 'mart', 'engineering', 'vista'];
const graphicsOrder = ['cinematic', 'balanced', 'eco'];
const UPGRADE_CAMERAS = Object.freeze({
  'patch-kit': 'engineering',
  'pump-bot': 'forecourt',
  'stock-drone': 'mart',
  'solar-wings': 'engineering',
  'twin-pumps': 'forecourt',
  'queue-beacon': 'forecourt',
  'nano-seal': 'engineering',
  'garage-arm': 'engineering',
  'service-clone': 'forecourt',
  'quantum-forecourt': 'vista',
  'holo-canopy': 'forecourt',
  'synth-kitchen': 'mart'
});
let announcementTimer = 0;
let qaLedger = null;
let lastRunSummary = null;
let ledgerMode = 'standard';
let focusBeforeEvent = null;
const dialogReturnFocus = new WeakMap();
const laneFeedbackTimers = new Map();
let currentAdvice = null;
let adviceTargetTimer = 0;
let upgradeRenderSignature = '';

function loadSettings() {
  const defaults = {
    sound: true,
    reducedMotion: Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
    graphics: 'cinematic'
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch (_) {
    return defaults;
  }
}

const settings = loadSettings();

class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.started = false;
    this.enabled = settings.sound;
    this.nodes = [];
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.enabled ? .14 : 0;
    this.master.connect(this.context.destination);
    this.startAmbience();
  }

  startAmbience() {
    if (!this.context || this.started) return;
    this.started = true;
    const pad = this.context.createGain();
    pad.gain.value = .055;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 780;
    pad.connect(filter).connect(this.master);
    [55, 82.41, 110].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 4 - 3;
      gain.gain.value = index === 1 ? .3 : .18;
      oscillator.connect(gain).connect(pad);
      oscillator.start();
      this.nodes.push(oscillator);
    });
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = .07;
    lfoGain.gain.value = 210;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.nodes.push(lfo);
  }

  tone(frequency = 440, duration = .12, type = 'sine', volume = .12, endFrequency = null) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + .03);
  }

  serve(lane) {
    const notes = { fuel: 660, mart: 520, garage: 390 };
    this.tone(notes[lane], .12, 'triangle', .11, notes[lane] * 1.45);
    setTimeout(() => this.tone(notes[lane] * 1.5, .09, 'sine', .06), 55);
  }

  bad() { this.tone(155, .28, 'sawtooth', .1, 92); }
  purchase() { this.tone(350, .11, 'triangle', .09, 620); setTimeout(() => this.tone(700, .16, 'sine', .07), 90); }
  event() { this.tone(210, .5, 'sine', .08, 420); }
  day() { this.tone(440, .18, 'triangle', .07, 660); setTimeout(() => this.tone(880, .22, 'sine', .055), 110); }
  retire() { [330, 440, 554, 660].forEach((note, index) => setTimeout(() => this.tone(note, .4, 'sine', .08), index * 130)); }

  toggle(force) {
    this.enabled = typeof force === 'boolean' ? force : !this.enabled;
    settings.sound = this.enabled;
    persistSettings();
    this.ensure();
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.linearRampToValueAtTime(this.enabled ? .14 : 0, this.context.currentTime + .12);
    }
    updateSoundButtons();
    return this.enabled;
  }
}

const sound = new Soundscape();

function persistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
}

function readSave() {
  try { return sanitizeLoadedState(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')); }
  catch (_) { return null; }
}

function saveGame() {
  if (QA_MODE || !state || state.ended || screen !== 'game') return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    lastSavedAt = performance.now();
    lastSavedDay = state.day;
  } catch (_) {}
}

function clearSave() {
  if (QA_MODE) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
}

function readRecord() {
  try {
    const record = JSON.parse(localStorage.getItem(RECORD_KEY) || 'null');
    return record && Number.isFinite(record.score) ? record : null;
  } catch (_) { return null; }
}

function writeRecord(score) {
  if (QA_MODE) return false;
  const previous = readRecord();
  if (previous && previous.score >= score) return false;
  const record = { score, mode: state.mode, day: state.totalDays, reviews: Math.round(state.badReviews), at: new Date().toISOString() };
  try { localStorage.setItem(RECORD_KEY, JSON.stringify(record)); } catch (_) {}
  return true;
}

function readRunLedger() {
  if (qaLedger) return normalizeLedger(qaLedger);
  try { return normalizeLedger(JSON.parse(localStorage.getItem(LEDGER_KEY) || 'null')); }
  catch (_) { return normalizeLedger(null); }
}

function recordRun(summary) {
  const previous = readRunLedger();
  if (QA_MODE || !summary) return previous;
  const next = addRunToLedger(previous, summary);
  try { localStorage.setItem(LEDGER_KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}

function renderLedger() {
  const ledger = readRunLedger();
  const history = aggregateRunHistory(ledger, ledgerMode);
  const curve = aggregateReviewCurve(ledger, ledgerMode);
  const modeName = ledgerMode === 'all' ? 'ALL CONTRACTS' : RUN_MODES[ledgerMode].name.toUpperCase();
  document.querySelectorAll('[data-ledger-mode]').forEach(button => {
    const active = button.dataset.ledgerMode === ledgerMode;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  UI.ledgerScope.textContent = `${modeName} · ${history.totalLedgerRuns} TOTAL RUN${history.totalLedgerRuns === 1 ? '' : 'S'}`;
  UI.ledgerRuns.textContent = history.totalRuns.toLocaleString();
  UI.ledgerRetireRate.textContent = `${history.retireRate}%`;
  UI.ledgerReviewVelocity.textContent = history.totalRuns ? `${history.averageReviewVelocity} / day` : '—';
  UI.ledgerCollapseDay.textContent = history.projectedCollapseDay ? `DAY ${history.projectedCollapseDay}` : '—';
  if (ledgerMode === 'all') {
    UI.ledgerGuidance.textContent = 'CONTRACTS ARE KEPT SEPARATE · Choose a contract above for a timer estimate. Quick, standard, and legend runs are never mixed into one recommendation.';
  } else if (history.calibrationReady) {
    UI.ledgerGuidance.textContent = `FIELD ESTIMATE · ${RUN_MODES[ledgerMode].name}: ${history.suggestedContractDays} days at ${history.confidence} confidence, based on ${history.totalRuns} matching runs. Current contract: ${RUN_MODES[ledgerMode].days} days. Guidance only—the game never auto-rebalances.`;
  } else {
    UI.ledgerGuidance.textContent = `${history.runsNeeded} more ${RUN_MODES[ledgerMode].name} run${history.runsNeeded === 1 ? '' : 's'} needed before this contract receives a timer estimate.`;
  }
  renderReviewCurve(curve, modeName);
  UI.ledgerList.innerHTML = history.recent.length
    ? history.recent.map(run => `<div class="ledger-row"><span class="grade grade-${run.grade.id}">${run.grade.id.toUpperCase()}</span><div><strong>${RUN_MODES[run.mode]?.name || run.mode}</strong><small>${run.outcome === 'retired' ? 'RETIRED' : `REVOKED · DAY ${run.survivedDays}`}</small></div><b>${run.finalReviews} REV</b><em>${run.captureRate}% CAPTURE</em></div>`).join('')
    : `<div class="ledger-empty"><strong>NO ${modeName} DATA YET</strong><span>Finish or fail a matching run. Its compact summary will appear here—locally, on this device.</span></div>`;
  const report = createBalanceReport(ledger);
  UI.ledgerDownload.href = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`;
  UI.ledgerDownload.download = `last-stop-nebula-balance-${new Date().toISOString().slice(0, 10)}.json`;
}

function renderReviewCurve(series, modeName) {
  if (!series.curve.length) {
    UI.ledgerCurve.innerHTML = `<div class="ledger-curve-empty"><strong>AVERAGE REVIEW CURVE</strong><span>${modeName} needs its first completed or failed run.</span></div>`;
    return;
  }
  const width = 620;
  const height = 118;
  const insetX = 12;
  const insetY = 10;
  const plotWidth = width - insetX * 2;
  const plotHeight = height - insetY * 2;
  const points = series.curve.map(point => {
    const x = insetX + (point.day - 1) / Math.max(1, series.maxDay - 1) * plotWidth;
    const y = insetY + (1 - point.averageReviews / 1000) * plotHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = series.curve.at(-1);
  UI.ledgerCurve.innerHTML = `
    <header><div><small>AVERAGE REVIEW CURVE</small><strong>${modeName}</strong></div><span>${series.runCount} RUN${series.runCount === 1 ? '' : 'S'} · DAY ${last.day}: ${last.averageReviews} REV</span></header>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Average bad reviews by day for ${modeName.toLowerCase()}">
      <line x1="${insetX}" y1="${insetY}" x2="${width - insetX}" y2="${insetY}" class="curve-limit"></line>
      <line x1="${insetX}" y1="${insetY + plotHeight / 2}" x2="${width - insetX}" y2="${insetY + plotHeight / 2}" class="curve-grid"></line>
      <line x1="${insetX}" y1="${height - insetY}" x2="${width - insetX}" y2="${height - insetY}" class="curve-grid"></line>
      <polyline points="${points}" class="curve-glow"></polyline>
      <polyline points="${points}" class="curve-line"></polyline>
    </svg>
    <footer><span>DAY 1</span><span>500 REVIEWS</span><span>DAY ${series.maxDay}</span></footer>`;
}

async function exportBalanceReport() {
  const report = createBalanceReport(readRunLedger());
  const json = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    toast('ANONYMOUS REPORT COPIED', `${report.totalRuns} local run${report.totalRuns === 1 ? '' : 's'} · no identity or device data`);
    return;
  } catch (_) {
    toast('CLIPBOARD BLOCKED', 'Use Download report instead. The JSON file contains the same anonymous data.', 'bad');
  }
}

function visibleDialogControls(layer) {
  return [...layer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.closest('[hidden]') && element.getClientRects().length);
}

function rememberDialogReturn(layer, fallback) {
  const activeElement = document.activeElement;
  const returnTarget = activeElement instanceof HTMLElement && activeElement !== document.body
    ? activeElement
    : fallback;
  if (returnTarget) dialogReturnFocus.set(layer, returnTarget);
}

function focusDialog(layer, initialFocus, fallbackReturn) {
  rememberDialogReturn(layer, fallbackReturn);
  layer.hidden = false;
  requestAnimationFrame(() => initialFocus?.focus({ preventScroll: true }));
}

function restoreDialogFocus(layer, fallback) {
  const remembered = dialogReturnFocus.get(layer);
  dialogReturnFocus.delete(layer);
  const restoreTarget = remembered instanceof HTMLElement && remembered.isConnected && !remembered.closest('[hidden]')
    ? remembered
    : fallback;
  requestAnimationFrame(() => restoreTarget?.focus({ preventScroll: true }));
}

function closeDialog(layer, fallback) {
  layer.hidden = true;
  restoreDialogFocus(layer, fallback);
}

function trapDialogFocus(layer, event) {
  const controls = visibleDialogControls(layer);
  if (!controls.length) return;
  const activeIndex = controls.indexOf(document.activeElement);
  if (activeIndex === -1 || (event.shiftKey && activeIndex === 0)) {
    event.preventDefault();
    (event.shiftKey ? controls.at(-1) : controls[0]).focus();
  } else if (!event.shiftKey && activeIndex === controls.length - 1) {
    event.preventDefault();
    controls[0].focus();
  }
}

function openLedger() {
  renderLedger();
  focusDialog(UI.ledgerModal, UI.ledgerClose, screen === 'results' ? UI.resultLedgerButton : UI.ledgerButton);
}

function closeLedger() {
  closeDialog(UI.ledgerModal, screen === 'results' ? UI.resultLedgerButton : UI.ledgerButton);
}

function setScreen(next) {
  screen = next;
  UI.titleScreen.hidden = next !== 'title';
  UI.setupScreen.hidden = next !== 'setup';
  UI.introScreen.hidden = next !== 'intro';
  UI.hud.hidden = next !== 'game';
  UI.resultsScreen.hidden = next !== 'results';
  UI.gameShell.dataset.screen = next;
  scene?.setMode(next === 'title' ? 'title' : next === 'results' ? 'results' : 'play');
}

function showTitle() {
  paused = false;
  UI.pauseModal.hidden = true;
  UI.upgradePanel.hidden = true;
  UI.eventModal.hidden = true;
  UI.helpModal.hidden = true;
  UI.ledgerModal.hidden = true;
  setScreen('title');
  scene.setMode('title');
  refreshTitle();
}

function refreshTitle() {
  const saved = readSave();
  UI.continueButton.hidden = !saved;
  if (saved) {
    UI.continueDay.textContent = saved.day;
    UI.continueMeta.textContent = `${Math.round(saved.credits)} CR · ${Math.round(saved.badReviews)} bad reviews`;
  }
  const record = readRecord();
  UI.titleHighscore.textContent = record ? `${record.score.toLocaleString()} CR` : '0 CR';
  UI.titleHighscoreMode.textContent = record ? `${RUN_MODES[record.mode]?.name || record.mode} · ${record.reviews} reviews` : 'NO RETIREMENTS YET';
  const history = aggregateRunHistory(readRunLedger());
  UI.ledgerFieldSummary.textContent = history.totalRuns
    ? `${history.totalRuns} RUN${history.totalRuns === 1 ? '' : 'S'} · ${history.retireRate}% RETIRED`
    : 'NO RUNS LOGGED';
}

function openSetup() {
  selectedMode = 'standard';
  document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('selected', card.dataset.mode === selectedMode));
  setScreen('setup');
  scene.setMode('play');
  scene.setFocus('vista');
}

function beginContract() {
  sound.ensure();
  clearSave();
  state = createNewGame(selectedMode);
  random = seededRandom(state.seed);
  lastHandledAction = null;
  storyIndex = 0;
  setScreen('intro');
  renderStory();
}

function renderStory() {
  const story = STORY[storyIndex];
  UI.storyKicker.textContent = story.kicker;
  UI.storyTitle.textContent = story.title;
  UI.storyCopy.textContent = story.copy;
  UI.storyQuote.textContent = story.quote;
  UI.storyNext.querySelector('span').textContent = storyIndex === STORY.length - 1 ? 'OPEN THE STATION' : 'NEXT';
  UI.storyProgress.innerHTML = STORY.map((_, index) => `<i class="${index <= storyIndex ? 'active' : ''}"></i>`).join('');
  scene.setFocus(story.camera);
  const card = document.querySelector('.story-card');
  card.style.animation = 'none';
  requestAnimationFrame(() => { card.style.animation = ''; });
}

function nextStory() {
  sound.tone(430 + storyIndex * 40, .1, 'triangle', .06, 590 + storyIndex * 50);
  if (storyIndex >= STORY.length - 1) return startGameplay(false);
  storyIndex += 1;
  renderStory();
}

function startGameplay(continuing = false) {
  if (!state) return;
  random = seededRandom((state.seed + state.customerCounter * 97 + Math.floor(state.elapsed * 11)) >>> 0);
  paused = false;
  UI.pauseModal.hidden = true;
  UI.helpModal.hidden = true;
  UI.upgradePanel.hidden = true;
  UI.eventModal.hidden = true;
  setScreen('game');
  scene.setMode('play');
  scene.setFocus('forecourt', !continuing);
  cameraIndex = 0;
  updateCameraButtons();
  scene.syncState(state);
  lastFrame = performance.now();
  lastSavedDay = state.day;
  lastDispatchRevision = state.dispatch?.revision || 0;
  renderAll();
  if (continuing) toast('SHIFT RESTORED', `Day ${state.day}. The queues kept your place.`, 'upgrade');
  else {
    announce('DAY 1', 'THE FRONTIER PARK IS OPEN');
    toast('STATION OPEN', 'Use 1, 2, and 3 to serve the front customer in each lane.');
  }
}

function continueGame() {
  const saved = readSave();
  if (!saved) return refreshTitle();
  sound.ensure();
  state = saved;
  startGameplay(true);
}

function updateCameraButtons() {
  document.querySelectorAll('[data-camera]').forEach(button => button.classList.toggle('active', button.dataset.camera === cameraOrder[cameraIndex]));
}

function chooseCamera(name) {
  cameraIndex = Math.max(0, cameraOrder.indexOf(name));
  scene.setFocus(cameraOrder[cameraIndex]);
  updateCameraButtons();
  sound.tone(310 + cameraIndex * 55, .08, 'sine', .035);
}

function cycleCamera() {
  cameraIndex = (cameraIndex + 1) % cameraOrder.length;
  chooseCamera(cameraOrder[cameraIndex]);
}

function clearAdviceTarget() {
  clearTimeout(adviceTargetTimer);
  document.querySelectorAll('.advice-target').forEach(element => element.classList.remove('advice-target'));
  adviceTargetTimer = 0;
}

function markAdviceTarget(element) {
  clearAdviceTarget();
  if (!element) return;
  element.classList.add('advice-target');
  adviceTargetTimer = setTimeout(() => {
    element.classList.remove('advice-target');
    adviceTargetTimer = 0;
  }, 2400);
}

function activateAdvice() {
  if (!currentAdvice || !state || screen !== 'game' || paused) return;
  const action = currentAdvice.action;
  let target = null;
  let control = null;
  if (action.type === 'serve' && action.lane) {
    const camera = action.lane === 'mart' ? 'mart' : action.lane === 'garage' ? 'engineering' : 'forecourt';
    chooseCamera(camera);
    target = document.querySelector(`[data-lane="${action.lane}"]`);
    control = document.querySelector(`[data-serve="${action.lane}"]`);
  } else if (action.type === 'supply' && action.kind) {
    chooseCamera(action.kind === 'fuel' ? 'engineering' : 'mart');
    target = document.querySelector(`.${action.kind}-resource`);
    control = action.kind === 'fuel' ? UI.buyFuelButton : UI.buyStockButton;
  } else if (action.type === 'rest') {
    target = document.querySelector('.energy-resource');
    control = UI.restButton;
  } else if (action.type === 'upgrade' && action.id) {
    toggleUpgradePanel(true);
    requestAnimationFrame(() => {
      const upgrade = document.querySelector(`[data-upgrade-id="${action.id}"]`);
      markAdviceTarget(upgrade);
      if (upgrade && !upgrade.disabled) upgrade.focus({ preventScroll: false });
    });
  } else {
    chooseCamera('vista');
    target = UI.missionPanel;
  }
  if (action.type !== 'upgrade') {
    markAdviceTarget(target);
    if (control && !control.disabled) control.focus({ preventScroll: true });
  }
  UI.liveRegion.textContent = `Guidance: ${currentAdvice.title}. ${currentAdvice.copy}`;
}

function formatReason(reason) {
  return {
    empty: 'Nobody is waiting in that lane.',
    cooldown: 'Your hands are still busy.',
    energy: 'You need energy. Take a micro nap or wait.',
    fuel: 'The plasma tank is empty. Buy a delivery.',
    stock: 'The shelves are empty. Buy station stock.',
    credits: 'Not enough credits.',
    full: 'That supply is already full.',
    locked: 'Build the prerequisite upgrades first.'
  }[reason] || 'That action is not available.';
}

function signalLaneFeedback(lane, outcome) {
  const card = document.querySelector(`[data-lane="${lane}"]`);
  if (!card) return;
  const resolved = ['manual', 'automated', 'lost', 'blocked'].includes(outcome) ? outcome : 'manual';
  const labels = {
    manual: 'MANUAL CLEAR',
    automated: 'AUTO CLEAR',
    lost: 'CUSTOMER LOST',
    blocked: 'BLOCKED'
  };
  clearTimeout(laneFeedbackTimers.get(lane));
  card.classList.remove('feedback', 'feedback-manual', 'feedback-automated', 'feedback-lost', 'feedback-blocked');
  void card.offsetWidth;
  card.dataset.feedbackLabel = labels[resolved];
  card.classList.add('feedback', `feedback-${resolved}`);
  laneFeedbackTimers.set(lane, setTimeout(() => {
    card.classList.remove('feedback', `feedback-${resolved}`);
    delete card.dataset.feedbackLabel;
    laneFeedbackTimers.delete(lane);
  }, 1120));
}

function serveLane(lane) {
  if (!state || screen !== 'game' || paused || !UI.eventModal.hidden || !UI.helpModal.hidden) return;
  const result = serveNext(state, lane, false);
  if (!result.ok) {
    toast('SERVICE BLOCKED', formatReason(result.reason), 'bad');
    sound.bad();
    signalLaneFeedback(lane, 'blocked');
    scene.flashService(lane, 'blocked');
    return;
  }
  signalLaneFeedback(lane, 'manual');
  scene.flashService(lane, 'manual');
  sound.serve(lane);
  const debtText = result.debtShare ? ` · ${result.debtShare} CR paid toward debt` : '';
  toast(`${LANE_DEFS[lane].short} SERVED`, `+${result.earned - result.debtShare} CR cash${debtText}`);
  renderAll();
}

function purchaseSupply(kind) {
  if (!state || paused) return;
  const result = buySupply(state, kind);
  if (!result.ok) return toast('DELIVERY REFUSED', formatReason(result.reason), 'bad');
  sound.purchase();
  toast(`${kind === 'fuel' ? 'PLASMA' : 'STOCK'} DELIVERED`, `+${Math.round(result.added)} units · -${result.price} CR`, 'upgrade');
  renderAll();
}

function rest() {
  if (!state || paused) return;
  const result = takeMicroNap(state);
  if (!result.ok) return toast('NO TIME TO SLEEP', 'You can micro-nap again when the cooldown ends.', 'bad');
  sound.tone(260, .4, 'sine', .045, 180);
  toast('MICRO NAP COMPLETE', '+24 energy · the queue left 8 bad reviews', 'upgrade');
  renderAll();
}

function toggleUpgradePanel(force, returnFocus = UI.upgradeButton) {
  if (!state || screen !== 'game') return;
  const opening = typeof force === 'boolean' ? force : UI.upgradePanel.hidden;
  const focusWasInside = UI.upgradePanel.contains(document.activeElement);
  UI.upgradePanel.hidden = !opening;
  UI.upgradeButton.classList.toggle('active', opening);
  if (opening) {
    renderUpgradeGrid();
    sound.tone(270, .12, 'triangle', .05, 400);
  } else if (focusWasInside) {
    requestAnimationFrame(() => returnFocus?.focus({ preventScroll: true }));
  }
}

function renderUpgradeGrid() {
  if (!state) return;
  const signature = `${Math.round(state.credits)}|${state.upgrades.join(',')}`;
  if (signature === upgradeRenderSignature && UI.upgradeGrid.childElementCount) return;
  upgradeRenderSignature = signature;
  UI.upgradeCash.textContent = `${Math.round(state.credits)} CR`;
  UI.upgradeCount.textContent = `${state.upgrades.length} / ${UPGRADES.length}`;
  UI.upgradeGrid.innerHTML = '';
  for (const upgrade of UPGRADES) {
    const owned = state.upgrades.includes(upgrade.id);
    const check = canBuyUpgrade(state, upgrade.id);
    const locked = !owned && check.reason === 'locked';
    const poor = !owned && check.reason === 'credits';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `upgrade-card${owned ? ' owned' : ''}${locked ? ' locked' : ''}`;
    button.disabled = locked;
    button.dataset.upgradeId = upgrade.id;
    if (owned) button.dataset.inspectUpgrade = upgrade.id;
    const prerequisites = upgrade.unlock.length ? `Needs ${upgrade.unlock.map(id => UPGRADES.find(item => item.id === id)?.name).join(' + ')}` : 'Available now';
    const detail = owned ? upgrade.visual : locked ? prerequisites : upgrade.description;
    const camera = UPGRADE_CAMERAS[upgrade.id] || 'forecourt';
    button.innerHTML = `
      <span class="upgrade-icon">${upgrade.icon}</span>
      <span class="upgrade-copy"><small>${upgrade.category}</small><strong>${upgrade.name}</strong><p>${detail}</p></span>
      <span class="upgrade-price"><strong>${owned ? 'BUILT' : `${upgrade.price} CR`}</strong><small>${owned ? `VIEW ${camera.toUpperCase()}` : poor ? 'NEED CASH' : 'BUILD NOW'}</small></span>`;
    if (owned) button.setAttribute('aria-label', `View installed ${upgrade.name} in the ${camera === 'vista' ? 'nebula' : camera} camera`);
    button.addEventListener('click', () => owned ? inspectUpgrade(upgrade) : purchaseUpgrade(upgrade.id));
    UI.upgradeGrid.appendChild(button);
  }
}

function inspectUpgrade(upgrade) {
  if (!state || !upgrade || !state.upgrades.includes(upgrade.id)) return false;
  const camera = UPGRADE_CAMERAS[upgrade.id] || 'forecourt';
  const cameraControl = document.querySelector(`[data-camera="${camera}"]`);
  toggleUpgradePanel(false, cameraControl);
  chooseCamera(camera);
  const highlighted = scene.highlightUpgrade(upgrade.id);
  sound.tone(520, .16, 'sine', .045, 760);
  const cameraLabel = camera === 'vista' ? 'nebula' : camera;
  toast('STATION SCAN', `${upgrade.name} · ${upgrade.visual}`, 'upgrade');
  UI.liveRegion.textContent = `Viewing installed ${upgrade.name} in the ${cameraLabel} camera. ${upgrade.visual}`;
  return highlighted;
}

function purchaseUpgrade(id) {
  if (!state) return;
  const result = buyUpgrade(state, id);
  if (!result.ok) return toast('BUILD BLOCKED', formatReason(result.reason), 'bad');
  sound.purchase();
  scene.syncState(state);
  const focus = UPGRADE_CAMERAS[id] || 'forecourt';
  chooseCamera(focus);
  toast(result.upgrade.name.toUpperCase(), result.upgrade.visual, 'upgrade');
  renderUpgradeGrid();
  renderAll();
  saveGame();
}

function showEvent(eventId) {
  const event = presentEvent(eventId, state?.seed);
  if (!event || !UI.eventModal.hidden) return;
  const activeElement = document.activeElement;
  focusBeforeEvent = activeElement instanceof HTMLElement && activeElement !== document.body
    ? activeElement
    : UI.pauseButton;
  renderAll();
  if (event.camera) chooseCamera(event.camera);
  UI.eventKicker.textContent = event.kicker;
  UI.eventRoute.textContent = `DAY ${String(event.day).padStart(2, '0')} · ${event.camera.toUpperCase()} FEED · DISPATCH ${event.presentationIndex + 1}/${event.presentationCount}`;
  UI.eventTitle.textContent = event.title;
  UI.eventCopy.textContent = event.copy;
  UI.eventChoices.innerHTML = '';
  event.choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.eventChoice = String(index + 1);
    button.setAttribute('aria-keyshortcuts', String(index + 1));
    button.innerHTML = `<strong>${choice.label}</strong><span>${choice.detail}</span><em>0${index + 1}</em>`;
    button.addEventListener('click', () => resolveEvent(event.id, choice.id));
    UI.eventChoices.appendChild(button);
  });
  UI.eventModal.hidden = false;
  UI.eventChoices.querySelector('button')?.focus({ preventScroll: true });
  UI.liveRegion.textContent = `${event.title} ${event.copy}`;
  sound.event();
}

function resolveEvent(eventId, choiceId) {
  if (!state) return;
  const result = chooseEvent(state, eventId, choiceId, random);
  if (!result.ok) return;
  UI.eventModal.hidden = true;
  scene.syncState(state);
  sound.purchase();
  const consequence = result.event.results?.[choiceId] || result.choice.detail;
  toast(result.choice.label.toUpperCase(), consequence, 'upgrade');
  UI.liveRegion.textContent = consequence;
  renderAll();
  const legacy = decisionLegacy(state);
  const revealStarted = scene.revealDecisionLegacy(legacy.latest);
  if (revealStarted) {
    UI.liveRegion.textContent = `${consequence} Permanent station trace revealed: ${legacy.latest.label}.`;
  }
  saveGame();
  const restoreTarget = focusBeforeEvent?.isConnected && !focusBeforeEvent.closest('[hidden]')
    ? focusBeforeEvent
    : UI.pauseButton;
  focusBeforeEvent = null;
  requestAnimationFrame(() => restoreTarget.focus({ preventScroll: true }));
}

function setPaused(value) {
  if (screen !== 'game' || !UI.eventModal.hidden || !UI.helpModal.hidden) return;
  paused = Boolean(value);
  if (paused) {
    focusDialog(UI.pauseModal, UI.resumeButton, UI.pauseButton);
    saveGame();
  } else {
    closeDialog(UI.pauseModal, UI.pauseButton);
  }
  UI.liveRegion.textContent = paused ? 'Game paused.' : 'Game resumed.';
}

function openHelp(from) {
  helpReturn = from;
  if (from === 'pause') UI.pauseModal.hidden = true;
  focusDialog(UI.helpModal, UI.helpClose, from === 'pause' ? UI.pauseHelpButton : UI.howButton);
}

function closeHelp() {
  UI.helpModal.hidden = true;
  if (helpReturn === 'pause') UI.pauseModal.hidden = false;
  restoreDialogFocus(UI.helpModal, helpReturn === 'pause' ? UI.pauseHelpButton : UI.howButton);
}

function applyMotionPreference() {
  scene.setReducedMotion(settings.reducedMotion);
  UI.gameShell.classList.toggle('reduced-motion', settings.reducedMotion);
  UI.gameShell.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  UI.motionButton.setAttribute('aria-pressed', String(settings.reducedMotion));
  UI.motionValue.textContent = settings.reducedMotion ? 'ON' : 'OFF';
}

function toggleMotion() {
  settings.reducedMotion = !settings.reducedMotion;
  applyMotionPreference();
  persistSettings();
}

function applyGraphicsPreference() {
  const profile = scene.setQualityPreset(settings.graphics);
  settings.graphics = profile.id;
  UI.gameShell.dataset.graphics = profile.id;
  UI.graphicsValue.textContent = profile.label;
  const next = graphicsOrder[(graphicsOrder.indexOf(profile.id) + 1) % graphicsOrder.length];
  UI.graphicsButton.setAttribute('aria-label', `Graphics quality: ${profile.label}. Activate to switch to ${next.toUpperCase()}.`);
  UI.graphicsButton.dataset.pixelRatio = String(profile.pixelRatio);
  UI.graphicsButton.dataset.maxPixelRatio = String(profile.maxPixelRatio);
  UI.graphicsButton.dataset.shadows = String(profile.shadows);
  UI.graphicsButton.dataset.stars = String(profile.stars);
  UI.graphicsButton.dataset.dust = String(profile.dust);
  UI.graphicsButton.dataset.rimLights = String(profile.rimLights);
  UI.graphicsButton.title = `Pixel ratio cap ${profile.maxPixelRatio} · ${profile.stars} stars · ${profile.dust} dust motes · ${profile.rimLights} perimeter lights`;
  return profile;
}

function cycleGraphics() {
  const currentIndex = Math.max(0, graphicsOrder.indexOf(settings.graphics));
  settings.graphics = graphicsOrder[(currentIndex + 1) % graphicsOrder.length];
  const profile = applyGraphicsPreference();
  persistSettings();
  toast('GRAPHICS PROFILE', `${profile.label} · pixel ratio cap ${profile.maxPixelRatio} · ${profile.shadows ? 'soft shadows' : 'shadows off'}`, 'upgrade');
}

function updateSoundButtons() {
  UI.soundButton.textContent = sound.enabled ? '♪' : '∅';
  const small = document.createElement('small');
  small.textContent = 'SOUND';
  UI.soundButton.appendChild(small);
  UI.pauseSoundValue.textContent = sound.enabled ? 'ON' : 'OFF';
}

function abandonRun() {
  const armed = UI.abandonButton.dataset.armed === 'true';
  if (!armed) {
    UI.abandonButton.dataset.armed = 'true';
    UI.abandonButton.textContent = 'Click again to erase this run';
    setTimeout(() => {
      UI.abandonButton.dataset.armed = 'false';
      UI.abandonButton.textContent = 'Abandon this run';
    }, 3000);
    return;
  }
  clearSave();
  state = null;
  showTitle();
}

function handleCoreAction(action) {
  if (!action || action === lastHandledAction) return;
  lastHandledAction = action;
  if (action.type === 'served' && action.debtShare > 0) {
    scene.flashDebtPayment(action.debtBefore, action.debtAfter);
    if (action.debtBefore > 0 && action.debtAfter <= 0) {
      sound.tone(330, .42, 'triangle', .065, 880);
      announce('AXM LIEN RELEASED', 'THE STATION IS YOURS');
      UI.liveRegion.textContent = 'Debt cleared. AXM lien released. The station is yours.';
    }
  }
  if (action.type === 'lost') {
    sound.bad();
    signalLaneFeedback(action.lane, 'lost');
    scene.flashService(action.lane, 'lost');
    toast('CUSTOMER LEFT ANGRY', `+${action.penalty} bad reviews in ${LANE_DEFS[action.lane].name}`, 'bad');
  } else if (action.type === 'served' && action.automated) {
    sound.serve(action.lane);
    signalLaneFeedback(action.lane, 'automated');
    scene.flashService(action.lane, 'automated');
  } else if (action.type === 'day') {
    sound.day();
    announce(`DAY ${action.day}`, dayAnnouncement(action.day));
  }
}

function handleDispatchOutcome() {
  if (!state?.dispatch || state.dispatch.revision === lastDispatchRevision) return;
  lastDispatchRevision = state.dispatch.revision;
  const dispatch = dispatchStatus(state);
  const result = state.dispatch.lastResult;
  if (result?.status === 'completed') {
    sound.tone(520, .32, 'triangle', .055, 920);
    scene.flashDispatch('completed');
    announce('SIGNAL DISPATCH CAPTURED', `+${result.marks} MARKS · ${dispatch.streak} STREAK`);
    toast('DISPATCH CAPTURED', `${dispatch.title} · +${result.marks} signal marks`, 'upgrade');
  } else if (result?.status === 'failed') {
    sound.tone(180, .28, 'sawtooth', .035, 120);
    scene.flashDispatch('failed');
    toast('DISPATCH SIGNAL LOST', 'The station survives. A new objective arrives in a few seconds.', 'bad');
  } else if (result?.status === 'rotated') {
    sound.tone(360, .16, 'sine', .035, 610);
    toast('NEW SIGNAL DISPATCH', `${dispatch.title} · ${dispatch.goal} target · +${dispatch.marksReward} marks`);
  }
}

function dayAnnouncement(day) {
  const progress = day / state.totalDays;
  if (day === state.totalDays) return 'RETIREMENT SHUTTLE INBOUND';
  if (progress > .8) return 'FINAL RUSH · PROTECT THE EXIT';
  if (progress > .55) return 'THE FRONTIER FOUND YOU';
  if (progress > .3) return 'DEMAND IS OUTGROWING THE RUIN';
  return 'MORE TOURISTS ARE ARRIVING';
}

function announce(kicker, title) {
  clearTimeout(announcementTimer);
  UI.announcementKicker.textContent = kicker;
  UI.announcementTitle.textContent = title;
  UI.announcement.hidden = false;
  UI.announcement.style.animation = 'none';
  requestAnimationFrame(() => { UI.announcement.style.animation = ''; });
  announcementTimer = setTimeout(() => { UI.announcement.hidden = true; }, 2700);
}

function toast(title, copy, kind = 'good') {
  const item = document.createElement('div');
  item.className = `toast ${kind === 'bad' ? 'bad' : kind === 'upgrade' ? 'upgrade' : ''}`;
  item.innerHTML = `<strong>${title}</strong><span>${copy}</span>`;
  UI.toastStack.prepend(item);
  while (UI.toastStack.children.length > 4) UI.toastStack.lastElementChild.remove();
  UI.liveRegion.textContent = `${title}. ${copy}`;
  setTimeout(() => item.classList.add('out'), 3100);
  setTimeout(() => item.remove(), 3450);
}

function finishRun() {
  if (!state || screen === 'results') return;
  clearSave();
  const retired = state.outcome === 'retired';
  const rawScore = calculateScore(state);
  const score = retired ? rawScore : 0;
  lastRunSummary = createRunSummary(state, score);
  recordRun(lastRunSummary);
  const newRecord = retired && writeRecord(score);
  UI.resultKicker.textContent = retired ? 'RETIREMENT SHUTTLE DOCKED' : '1,000 BAD REVIEWS · LICENSE REVOKED';
  UI.resultTitle.textContent = retired ? 'You got away with it.' : 'AXM changed the locks.';
  UI.resultCopy.textContent = retired ? 'The station is someone else’s emergency now. Your escape case feels wonderfully heavy.' : 'The crowd owns the story now. There is no money left to take with you.';
  UI.resultScore.textContent = score.toLocaleString();
  UI.newRecord.hidden = !newRecord;
  UI.resultServed.textContent = state.stats.served.toLocaleString();
  UI.resultLost.textContent = state.stats.lost.toLocaleString();
  UI.resultReviews.textContent = Math.round(state.badReviews).toLocaleString();
  UI.resultUpgrades.textContent = `${state.upgrades.length} / ${UPGRADES.length}`;
  UI.resultGrade.textContent = `${lastRunSummary.grade.id.toUpperCase()} · ${lastRunSummary.grade.label}`;
  UI.resultGrade.dataset.grade = lastRunSummary.grade.id;
  UI.resultVelocity.textContent = `${lastRunSummary.reviewVelocity} / DAY`;
  UI.resultCapture.textContent = `${lastRunSummary.captureRate}%`;
  UI.resultAutomation.textContent = `${lastRunSummary.automatedShare}%`;
  const mode = RUN_MODES[state.mode];
  const dispatch = dispatchStatus(state);
  const dispatchBonus = dispatch.marks * 30;
  UI.payoutBreakdown.innerHTML = retired
    ? `Cash ${Math.round(state.credits).toLocaleString()} · asset sale ${Math.round(state.fuel * 1.4 + state.stock * 1.8 + state.upgrades.length * 42).toLocaleString()} · signal marks ${dispatch.marks} (+${dispatchBonus.toLocaleString()}) · debt −${Math.round(state.debt).toLocaleString()} · ${mode.name} ×${mode.scoreMultiplier}`
    : 'REVOCATION CLAUSE · ALL RETIREMENT FUNDS FORFEITED';
  setScreen('results');
  scene.setFocus(retired ? 'vista' : 'engineering');
  if (retired) sound.retire(); else sound.bad();
}

function renderLane(lane) {
  const summary = queueSummary(state, lane);
  const front = summary.front;
  const card = document.querySelector(`[data-lane="${lane}"]`);
  const button = document.querySelector(`[data-serve="${lane}"]`);
  const queueEl = $(`${lane}-queue`);
  const customerEl = $(`${lane}-customer`);
  const moodEl = $(`${lane}-mood`);
  const patienceEl = $(`${lane}-patience`);
  const autoEl = $(`${lane}-auto`);
  const metaEl = $(`${lane}-action-meta`);
  queueEl.textContent = summary.count;
  customerEl.textContent = front ? SPECIES[front.species % SPECIES.length] : lane === 'mart' ? 'NO CUSTOMER' : 'NO VEHICLE';
  moodEl.textContent = front ? front.mood.toUpperCase() : 'CLEAR';
  const patience = front ? clamp(front.patience / front.maxPatience, 0, 1) : 0;
  patienceEl.style.width = `${patience * 100}%`;
  const autoProgress = front ? clamp(summary.autoProgress / front.serviceNeed, 0, 1) : 0;
  autoEl.style.width = `${autoProgress * 100}%`;
  card.classList.toggle('urgent', Boolean(front && patience < .28));
  button.disabled = !front || state.manualCooldowns[lane] > 0 || state.energy < derivedStats(state).manualEnergy;
  button.classList.toggle('cooldown', state.manualCooldowns[lane] > 0);
  button.style.setProperty('--cooldown', `${(1 - state.manualCooldowns[lane] / Math.max(.1, derivedStats(state).manualCooldown)) * 100}%`);
  metaEl.textContent = summary.autoRate > 0 ? `AUTO ${summary.autoRate.toFixed(1)} · manual ${Math.ceil(derivedStats(state).manualEnergy)} energy` : `${Math.ceil(derivedStats(state).manualEnergy)} energy · manual only`;
}

function renderAll() {
  if (!state || screen !== 'game') return;
  const mode = RUN_MODES[state.mode];
  const progress = clamp(state.elapsed / (state.totalDays * state.dayLength), 0, 1);
  const shift = shiftAtmosphere(state);
  scene.setDecisionLegacy(decisionLegacy(state));
  UI.dayValue.textContent = state.day;
  UI.totalDays.textContent = state.totalDays;
  UI.clockValue.textContent = shift.time;
  UI.shiftPhase.textContent = shift.phase;
  UI.dayBlock.dataset.shiftTone = shift.tone;
  UI.dayBlock.setAttribute('aria-label', `Day ${state.day} of ${state.totalDays}. ${shift.phase.toLowerCase()}, ${shift.time}.`);
  scene.setShiftAtmosphere(shift);
  UI.retirementProgress.style.width = `${progress * 100}%`;
  UI.creditsValue.textContent = Math.round(state.credits).toLocaleString();
  UI.debtValue.textContent = Math.round(state.debt).toLocaleString();
  const liberation = debtLiberation(state);
  UI.debtStage.textContent = liberation.phase;
  UI.debtPhase.textContent = liberation.phase;
  UI.debtLineValue.textContent = liberation.cleared ? '0 CR' : `${Math.round(liberation.debt)} CR`;
  UI.debtMeter.style.width = `${liberation.progress * 100}%`;
  UI.debtLine.dataset.tone = liberation.tone;
  UI.debtStat.dataset.tone = liberation.tone;
  const debtLabel = liberation.cleared
    ? 'AXM lien cleared. The station is yours.'
    : `AXM lien ${liberation.phase.toLowerCase()}. ${Math.round(liberation.debt)} credits remain. ${Math.round(liberation.progress * 100)} percent released.`;
  UI.debtLine.setAttribute('aria-label', debtLabel);
  UI.debtStat.setAttribute('aria-label', debtLabel);
  scene.setDebtLiberation(liberation);
  UI.reviewsValue.textContent = Math.round(state.badReviews).toLocaleString();
  UI.reviewProgress.style.width = `${clamp(state.badReviews / REVIEW_LIMIT, 0, 1) * 100}%`;
  UI.reviewStat.classList.toggle('danger', state.badReviews > 690);
  currentAdvice = operationalAdvice(state);
  UI.missionPanel.dataset.tone = currentAdvice.tone;
  UI.pressureTitle.textContent = currentAdvice.title;
  UI.pressureCopy.textContent = currentAdvice.copy;
  UI.pressureAction.querySelector('span').textContent = currentAdvice.action.label;
  UI.pressureAction.setAttribute('aria-label', `${currentAdvice.action.label}. ${currentAdvice.title}. ${currentAdvice.copy}`);
  const dispatch = dispatchStatus(state);
  UI.dispatchLine.dataset.status = dispatch.status;
  UI.dispatchPhase.textContent = dispatch.phase;
  UI.dispatchTitle.textContent = dispatch.title;
  UI.dispatchCopy.textContent = dispatch.copy;
  UI.dispatchMeter.style.width = `${clamp(dispatch.progress / dispatch.goal, 0, 1) * 100}%`;
  UI.dispatchProgress.textContent = `${dispatch.progress} / ${dispatch.goal}`;
  UI.dispatchTimer.textContent = dispatch.status === 'active'
    ? `${Math.floor(dispatch.remaining / 60)}:${String(Math.ceil(dispatch.remaining % 60)).padStart(2, '0')}`
    : `NEXT ${Math.ceil(dispatch.remaining)}S`;
  UI.dispatchMarks.textContent = `${dispatch.marks} MARK${dispatch.marks === 1 ? '' : 'S'}`;
  UI.dispatchLine.setAttribute('aria-label', `${dispatch.phase}. ${dispatch.title}. ${dispatch.copy} ${dispatch.progress} of ${dispatch.goal}. ${Math.ceil(dispatch.remaining)} seconds remaining. ${dispatch.marks} signal marks.`);
  scene.setDispatchStatus(dispatch);
  const inbound = arrivalForecast(state);
  UI.arrivalLine.dataset.tone = inbound.tone;
  UI.arrivalLabel.textContent = inbound.phase;
  UI.arrivalEta.textContent = inbound.burst ? `${inbound.eta} · +${inbound.burst}` : inbound.eta;
  UI.arrivalMeter.style.width = `${inbound.progress * 100}%`;
  UI.arrivalLine.setAttribute('aria-label', `Next arrival: ${inbound.phase.toLowerCase()}, ${inbound.eta.toLowerCase()}${inbound.burst ? `, ${inbound.burst} more in surge` : ''}`);
  scene.setArrivalForecast(inbound);
  scene.setQueueConstellation(queueConstellation(state));
  const demand = clamp(.1 + state.day / state.totalDays * .8 + derivedStats(state).demandMultiplier * .12, 0, 1);
  UI.demandMeter.style.width = `${demand * 100}%`;
  UI.demandLabel.textContent = demand > .88 ? 'CRITICAL' : demand > .68 ? 'HEAVY' : demand > .43 ? 'CLIMBING' : 'WAKING UP';
  UI.queueTotal.textContent = state.customers.length;
  UI.servedTotal.textContent = `${state.stats.served} served`;
  UI.fuelValue.textContent = Math.round(state.fuel);
  UI.fuelCapacity.textContent = state.fuelCapacity;
  UI.fuelProgress.style.width = `${clamp(state.fuel / state.fuelCapacity, 0, 1) * 100}%`;
  UI.leakIndicator.hidden = state.upgrades.includes('nano-seal');
  UI.leakIndicator.textContent = state.upgrades.includes('patch-kit') ? 'SLOW LEAK' : 'LEAK';
  UI.stockValue.textContent = Math.round(state.stock);
  UI.stockCapacity.textContent = state.stockCapacity;
  UI.stockProgress.style.width = `${clamp(state.stock / state.stockCapacity, 0, 1) * 100}%`;
  UI.energyValue.textContent = Math.round(state.energy);
  UI.energyCapacity.textContent = state.maxEnergy;
  UI.energyProgress.style.width = `${clamp(state.energy / state.maxEnergy, 0, 1) * 100}%`;
  UI.moraleValue.textContent = `${Math.round(state.morale)}%`;
  UI.moraleProgress.style.width = `${state.morale}%`;
  UI.buyFuelButton.disabled = state.credits < 118 || state.fuel >= state.fuelCapacity - .5;
  UI.buyStockButton.disabled = state.credits < 84 || state.stock >= state.stockCapacity - .5;
  UI.restButton.disabled = state.restCooldown > 0;
  UI.restStatus.textContent = state.restCooldown > 0 ? `ready in ${Math.ceil(state.restCooldown)}s` : '+24 energy · +8 reviews';
  ['fuel','mart','garage'].forEach(renderLane);
  const readyUpgrade = UPGRADES.some(upgrade => canBuyUpgrade(state, upgrade.id).ok);
  UI.upgradeReady.hidden = !readyUpgrade;
  if (!UI.upgradePanel.hidden) renderUpgradeGrid();
}

function bindUI() {
  UI.newRunButton.addEventListener('click', openSetup);
  UI.continueButton.addEventListener('click', continueGame);
  UI.howButton.addEventListener('click', () => openHelp('title'));
  UI.setupClose.addEventListener('click', showTitle);
  document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => {
    selectedMode = card.dataset.mode;
    document.querySelectorAll('.mode-card').forEach(item => item.classList.toggle('selected', item === card));
    sound.tone(320 + Object.keys(RUN_MODES).indexOf(selectedMode) * 70, .08, 'triangle', .04);
  }));
  UI.signContractButton.addEventListener('click', beginContract);
  UI.storyNext.addEventListener('click', nextStory);
  UI.skipIntro.addEventListener('click', () => startGameplay(false));
  document.querySelectorAll('[data-serve]').forEach(button => button.addEventListener('click', () => serveLane(button.dataset.serve)));
  UI.buyFuelButton.addEventListener('click', () => purchaseSupply('fuel'));
  UI.buyStockButton.addEventListener('click', () => purchaseSupply('stock'));
  UI.restButton.addEventListener('click', rest);
  UI.pressureAction.addEventListener('click', activateAdvice);
  UI.cameraButton.addEventListener('click', cycleCamera);
  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => chooseCamera(button.dataset.camera)));
  UI.upgradeButton.addEventListener('click', () => toggleUpgradePanel());
  UI.upgradeClose.addEventListener('click', () => toggleUpgradePanel(false));
  UI.soundButton.addEventListener('click', () => sound.toggle());
  UI.pauseButton.addEventListener('click', () => setPaused(true));
  UI.resumeButton.addEventListener('click', () => setPaused(false));
  UI.motionButton.addEventListener('click', toggleMotion);
  UI.pauseSoundButton.addEventListener('click', () => sound.toggle());
  UI.graphicsButton.addEventListener('click', cycleGraphics);
  UI.pauseHelpButton.addEventListener('click', () => openHelp('pause'));
  UI.saveTitleButton.addEventListener('click', () => { saveGame(); showTitle(); });
  UI.abandonButton.addEventListener('click', abandonRun);
  UI.helpClose.addEventListener('click', closeHelp);
  UI.helpDone.addEventListener('click', closeHelp);
  UI.retryButton.addEventListener('click', openSetup);
  UI.resultTitleButton.addEventListener('click', showTitle);
  UI.ledgerButton.addEventListener('click', openLedger);
  UI.resultLedgerButton.addEventListener('click', openLedger);
  UI.ledgerClose.addEventListener('click', closeLedger);
  document.querySelectorAll('[data-ledger-mode]').forEach(button => button.addEventListener('click', () => {
    ledgerMode = button.dataset.ledgerMode;
    renderLedger();
  }));
  UI.ledgerExport.addEventListener('click', exportBalanceReport);
  UI.ledgerDone.addEventListener('click', closeLedger);

  window.addEventListener('keydown', event => {
    if (event.repeat) return;
    const blockingDialog = [UI.ledgerModal, UI.helpModal, UI.eventModal, UI.pauseModal].find(layer => !layer.hidden);
    if (event.code === 'Escape') {
      if (!UI.ledgerModal.hidden) return closeLedger();
      if (!UI.helpModal.hidden) return closeHelp();
      if (!UI.upgradePanel.hidden) return toggleUpgradePanel(false);
      if (screen === 'setup') return showTitle();
      if (screen === 'game' && UI.eventModal.hidden) return setPaused(!paused);
    }
    if (blockingDialog === UI.eventModal) {
      const choices = [...UI.eventChoices.querySelectorAll('button')];
      const choiceIndex = {
        Digit1: 0, Numpad1: 0,
        Digit2: 1, Numpad2: 1,
        Digit3: 2, Numpad3: 2
      }[event.code];
      if (Number.isInteger(choiceIndex) && choices[choiceIndex]) {
        event.preventDefault();
        choices[choiceIndex].click();
        return;
      }
    }
    if (event.code === 'Tab' && blockingDialog) {
      trapDialogFocus(blockingDialog, event);
      return;
    }
    if (blockingDialog) return;
    if (event.code === 'Enter' && screen === 'title') return openSetup();
    if (event.code === 'Space' && screen === 'intro') { event.preventDefault(); return nextStory(); }
    if (screen !== 'game' || paused || !UI.eventModal.hidden || !UI.helpModal.hidden) return;
    if (event.code === 'Digit1' || event.code === 'Numpad1') serveLane('fuel');
    if (event.code === 'Digit2' || event.code === 'Numpad2') serveLane('mart');
    if (event.code === 'Digit3' || event.code === 'Numpad3') serveLane('garage');
    if (event.code === 'KeyU') toggleUpgradePanel();
    if (event.code === 'KeyC') cycleCamera();
    if (event.code === 'KeyM') sound.toggle();
  });
  window.addEventListener('resize', () => scene.resize());
  window.addEventListener('beforeunload', saveGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
}

function loop(now) {
  const delta = Math.min(.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (state && screen === 'game' && !paused && UI.eventModal.hidden && UI.helpModal.hidden) {
    tickGame(state, delta, random);
    handleCoreAction(state.lastAction);
    handleDispatchOutcome();
    if (state.pendingEvent) showEvent(state.pendingEvent);
    if (state.ended) finishRun();
    if (state.day !== lastSavedDay || now - lastSavedAt > 12000) saveGame();
    if (now - lastUiRender > 90) {
      renderAll();
      lastUiRender = now;
    }
    if (now - lastSceneSync > 125) {
      scene.syncState(state);
      lastSceneSync = now;
    }
  }
  scene.render(state, delta);
  requestAnimationFrame(loop);
}

function exposeTestBridge() {
  window.__LAST_STOP_NEBULA__ = {
    version: GAME_VERSION,
    ready: true,
    get screen() { return screen; },
    get state() { return state; },
    snapshot() {
      return state ? {
        screen,
        paused,
        day: state.day,
        credits: state.credits,
        debt: state.debt,
        debtLiberation: debtLiberation(state),
        dispatch: dispatchStatus(state),
        badReviews: state.badReviews,
        customers: state.customers.length,
        upgrades: [...state.upgrades],
        decisionLegacy: decisionLegacy(state),
        decisionReveal: {
          id: UI.world.dataset.decisionReveal || 'none',
          phase: UI.world.dataset.decisionRevealPhase || 'idle',
          progress: Number(UI.world.dataset.decisionRevealProgress || 0),
          scale: Number(UI.world.dataset.decisionRevealScale || 1),
          effectScale: Number(UI.world.dataset.decisionRevealEffectScale || 1),
          motion: UI.world.dataset.decisionRevealMotion || (settings.reducedMotion ? 'reduced' : 'full')
        },
        graphics: scene.getRenderProfile(),
        outcome: state.outcome
      } : { screen, paused, graphics: scene.getRenderProfile() };
    },
    start(mode = 'standard') {
      state = createNewGame(mode, 18018);
      startGameplay(false);
      return this.snapshot();
    },
    serve: serveLane,
    buyUpgrade: purchaseUpgrade,
    inspectUpgrade(id) {
      return inspectUpgrade(UPGRADES.find(upgrade => upgrade.id === id));
    },
    setGraphics(preset) {
      settings.graphics = preset;
      const profile = applyGraphicsPreference();
      persistSettings();
      return profile;
    },
    advance(seconds = 1) {
      if (!state) return null;
      const steps = Math.ceil(seconds / .1);
      for (let index = 0; index < steps; index += 1) tickGame(state, seconds / steps, random);
      renderAll();
      scene.syncState(state);
      return this.snapshot();
    },
    setState(patch) {
      if (!state || !patch || typeof patch !== 'object') return null;
      Object.assign(state, patch);
      renderAll();
      scene.syncState(state);
      return this.snapshot();
    }
  };
}

function makeQaLedger() {
  const records = [
    { mode: 'standard', outcome: 'retired', day: 21, reviews: 418, served: 302, lost: 19, score: 8840, automated: 207 },
    { mode: 'legend', outcome: 'reviews', day: 24, reviews: 1000, served: 381, lost: 63, score: 0, automated: 248 },
    { mode: 'quick', outcome: 'retired', day: 14, reviews: 275, served: 186, lost: 9, score: 6180, automated: 122 },
    { mode: 'standard', outcome: 'retired', day: 21, reviews: 536, served: 289, lost: 31, score: 7410, automated: 173 },
    { mode: 'standard', outcome: 'reviews', day: 18, reviews: 1000, served: 251, lost: 58, score: 0, automated: 141 }
  ];
  return records.reduce((ledger, record, index) => {
    const sample = createNewGame(record.mode, 18100 + index);
    sample.runId = `qa-ledger-${index}`;
    sample.elapsed = record.day * sample.dayLength;
    sample.day = record.day;
    sample.ended = true;
    sample.outcome = record.outcome;
    sample.badReviews = record.reviews;
    sample.credits = record.outcome === 'retired' ? 5100 + index * 470 : 2200;
    sample.debt = index === 1 ? 180 : 0;
    sample.upgrades = UPGRADES.slice(0, 6 + index).map(upgrade => upgrade.id);
    sample.stats.served = record.served;
    sample.stats.lost = record.lost;
    sample.stats.manual = record.served - record.automated;
    sample.stats.automated = record.automated;
    sample.telemetry = [
      { day: 1, badReviews: 64, served: 0, lost: 0 },
      { day: record.day, badReviews: record.reviews, served: record.served, lost: record.lost }
    ];
    return addRunToLedger(ledger, createRunSummary(sample, record.score, Date.UTC(2026, 6, 28 - index)));
  }, null);
}

function openQaMode(mode) {
  if (mode === 'ledger') {
    qaLedger = makeQaLedger();
    showTitle();
    openLedger();
    return;
  }
  if (mode === 'event') {
    const event = EVENTS.find(item => item.id === QUERY.get('event')) || EVENTS.find(item => item.id === 'inspector');
    const requestedSeed = Number.parseInt(QUERY.get('seed') || '18018', 10);
    state = createNewGame(event.modes?.[0] || 'standard', Number.isFinite(requestedSeed) ? requestedSeed : 18018);
    random = seededRandom(state.seed);
    state.elapsed = Math.max(0, (event.day - 1) * state.dayLength);
    state.day = event.day;
    state.seenEvents = EVENTS
      .filter(item => item.day < event.day && (!item.modes || item.modes.includes(state.mode)))
      .map(item => item.id);
    state.pendingEvent = event.id;
    startGameplay(true);
    showEvent(event.id);
    return;
  }
  const qaLegacy = QUERY.get('legacy');
  state = createNewGame(qaLegacy === 'all' ? 'legend' : 'standard', 18018);
  random = seededRandom(state.seed);
  state.seenEvents = EVENTS.map(event => event.id);
  state.pendingEvent = null;
  state.elapsed = 16.45 * state.dayLength;
  state.day = 17;
  state.credits = 4260;
  state.debt = 0;
  state.badReviews = 386;
  state.goodwill = 162;
  state.fuelCapacity = 130;
  state.fuel = 118;
  state.stockCapacity = 110;
  state.stock = 94;
  state.maxEnergy = 120;
  state.energy = 114;
  state.morale = 78;
  const requestedUpgrade = QUERY.get('upgrade');
  state.upgrades = requestedUpgrade && UPGRADES.some(upgrade => upgrade.id === requestedUpgrade)
    ? [requestedUpgrade]
    : UPGRADES.map(upgrade => upgrade.id);
  state.stats = {
    ...state.stats,
    served: 247,
    lost: 18,
    perfect: 129,
    manual: 82,
    automated: 165,
    earned: 12840,
    debtPaid: 720,
    peakQueue: 13
  };
  if (qaLegacy) {
    const curated = [
      ['opening-swarm', 'partner'],
      ['builder-drone', 'sell'],
      ['solar-bloom', 'shelter'],
      ['tour-bus', 'ration'],
      ['inspector', 'repair'],
      ['retirement-broker', 'blast'],
      ['legend-offer', 'spectacle']
    ];
    const requested = qaLegacy === 'all' ? curated : [qaLegacy.split('.', 2)];
    state.stats.choices = requested.flatMap(([eventId, choiceId]) => {
      const event = EVENTS.find(item => item.id === eventId);
      return event?.choices.some(choice => choice.id === choiceId)
        ? [{ eventId, choiceId, day: event.day }]
        : [];
    });
    if (qaLegacy === 'all') {
      state.elapsed = 26.45 * state.dayLength;
      state.day = 27;
    }
  }
  for (let index = 0; index < 10; index += 1) spawnCustomer(state, random, ['fuel','mart','garage'][index % 3]);
  if (mode === 'service') {
    const lane = ['fuel', 'mart', 'garage'].includes(QUERY.get('lane')) ? QUERY.get('lane') : 'fuel';
    const outcome = ['manual', 'automated', 'lost'].includes(QUERY.get('outcome')) ? QUERY.get('outcome') : 'manual';
    state.upgrades = ['patch-kit', 'nano-seal'];
    state.customers = [];
    state.customerCounter = 0;
    state.stats.peakQueue = 0;
    for (const lane of ['fuel', 'mart', 'garage']) {
      const customer = spawnCustomer(state, random, lane);
      customer.maxPatience = 999;
      customer.patience = 999;
      customer.mood = 'calm';
    }
    state.spawnClock = 999;
    state.dayLength = 3600;
    state.elapsed = 16.45 * state.dayLength;
    state.day = 17;
    state.energy = state.maxEnergy;
    if (outcome === 'automated') {
      const automation = { fuel: 'pump-bot', mart: 'stock-drone', garage: 'garage-arm' }[lane];
      state.upgrades.push(automation);
      const customer = state.customers.find(item => item.lane === lane);
      state.autoProgress[lane] = Math.max(0, customer.serviceNeed - .48);
    } else if (outcome === 'lost') {
      const customer = state.customers.find(item => item.lane === lane);
      customer.maxPatience = 10;
      customer.patience = .85;
      customer.mood = 'furious';
    }
    if (QUERY.get('guide') === 'urgent') {
      const customer = state.customers.find(item => item.lane === lane);
      customer.maxPatience = 100;
      customer.patience = 14;
      customer.mood = 'furious';
    }
  }

  const qaDebt = QUERY.get('debt');
  const qaDebtValues = { locked: STARTING_DEBT, cracking: 420, final: 14, clear: 0 };
  if (Object.hasOwn(qaDebtValues, qaDebt)) {
    state.debt = qaDebtValues[qaDebt];
    state.stats.debtPaid = STARTING_DEBT - state.debt;
  }

  const qaArrival = QUERY.get('arrival');
  if (qaArrival === 'inbound') state.spawnClock = 2.4;
  if (qaArrival === 'imminent') state.spawnClock = .35;
  if (qaArrival === 'surge') {
    state.spawnClock = .18;
    state.burstRemaining = 3;
  }

  const qaQueues = QUERY.get('queues');
  if (qaQueues === 'critical' || qaQueues === 'steady') {
    const patienceByLane = qaQueues === 'critical'
      ? { fuel: .12, mart: .44, garage: .86 }
      : { fuel: .82, mart: .76, garage: .9 };
    for (const [lane, ratio] of Object.entries(patienceByLane)) {
      const customer = state.customers.find(item => item.lane === lane);
      if (!customer) continue;
      customer.maxPatience = 100;
      customer.patience = ratio * customer.maxPatience;
      customer.mood = ratio < .28 ? 'furious' : ratio < .52 ? 'worried' : 'calm';
    }
  }

  const qaShift = QUERY.get('shift');
  const shiftFractions = { dawn: .08, day: .38, dusk: .66, night: .88 };
  if (Object.hasOwn(shiftFractions, qaShift)) {
    state.elapsed = (state.day - 1 + shiftFractions[qaShift]) * state.dayLength;
  }

  const qaDispatch = DISPATCHES.find(item => item.id === QUERY.get('dispatch'));
  if (qaDispatch) {
    const requestedStatus = ['active', 'completed', 'failed'].includes(QUERY.get('dispatchStatus')) ? QUERY.get('dispatchStatus') : 'active';
    const requestedProgress = Number.parseInt(QUERY.get('dispatchProgress') || '', 10);
    const progress = Number.isFinite(requestedProgress)
      ? clamp(requestedProgress, 0, qaDispatch.goal)
      : requestedStatus === 'completed' ? qaDispatch.goal : Math.max(1, Math.floor(qaDispatch.goal / 2));
    state.dispatch = {
      ...state.dispatch,
      id: qaDispatch.id,
      status: requestedStatus,
      progress,
      manualLanes: qaDispatch.kind === 'manual-lanes' ? ['fuel', 'mart'].slice(0, progress) : [],
      startedAt: state.elapsed - 22,
      deadline: state.elapsed + 38,
      resolvedAt: requestedStatus === 'active' ? null : state.elapsed,
      nextAt: requestedStatus === 'active' ? null : state.elapsed + 4.5,
      completed: requestedStatus === 'completed' ? 3 : 2,
      failed: requestedStatus === 'failed' ? 2 : 1,
      streak: requestedStatus === 'completed' ? 2 : 0,
      marks: requestedStatus === 'completed' ? 11 : 7,
      revision: 4,
      lastResult: requestedStatus === 'active' ? null : { id: qaDispatch.id, status: requestedStatus, marks: requestedStatus === 'completed' ? qaDispatch.marks : 0, at: state.elapsed }
    };
  }

  if (mode === 'retired' || mode === 'failed') {
    state.customers = [];
    state.elapsed = mode === 'retired' ? state.totalDays * state.dayLength : 12.2 * state.dayLength;
    state.day = mode === 'retired' ? state.totalDays : 13;
    state.credits = mode === 'retired' ? 7340 : 2860;
    state.badReviews = mode === 'retired' ? 612 : REVIEW_LIMIT;
    state.ended = true;
    state.outcome = mode === 'retired' ? 'retired' : 'reviews';
    scene.syncState(state);
    finishRun();
    return;
  }
  startGameplay(true);
  if (mode === 'service') {
    const lane = ['fuel', 'mart', 'garage'].includes(QUERY.get('lane')) ? QUERY.get('lane') : 'fuel';
    const focus = lane === 'mart' ? 'mart' : lane === 'garage' ? 'engineering' : 'forecourt';
    UI.toastStack.innerHTML = '';
    cameraIndex = cameraOrder.indexOf(focus);
    scene.setFocus(focus, true);
    updateCameraButtons();
    scene.syncState(state);
    renderAll();
    return;
  }
  paused = true;
  const legacyFocus = decisionLegacy(state).latest?.camera;
  scene.setFocus(qaLegacy && qaLegacy !== 'all' && legacyFocus ? legacyFocus : 'vista', true);
  scene.syncState(state);
  renderAll();
  announce('QA SHOWCASE', 'FULLY REBUILT STATION · SIMULATION HELD');
}

function init() {
  scene = new NebulaScene(UI.world);
  applyMotionPreference();
  applyGraphicsPreference();
  updateSoundButtons();
  bindUI();
  refreshTitle();
  exposeTestBridge();
  requestAnimationFrame(loop);
  setTimeout(() => {
    UI.bootScreen.classList.add('done');
    setTimeout(() => {
      UI.bootScreen.hidden = true;
      if (QA_MODE === 'showcase' || QA_MODE === 'service' || QA_MODE === 'retired' || QA_MODE === 'failed' || QA_MODE === 'ledger' || QA_MODE === 'event') openQaMode(QA_MODE);
      else showTitle();
    }, 520);
  }, 650);
}

try {
  init();
} catch (error) {
  console.error(error);
  UI.bootScreen.innerHTML = `<p>STATION RUNTIME ERROR</p><strong>${error.message}</strong><div class="boot-line"><span></span></div>`;
}
