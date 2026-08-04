'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('game package declares every required local artifact', () => {
  const manifest = JSON.parse(read('game.manifest.json'));
  assert.equal(manifest.slot, '018');
  assert.equal(manifest.game_id, '018-last-stop-nebula');
  assert.equal(manifest.launch.port, 8818);
  assert.equal(manifest.rules.runtime_internet_required, false);
  for (const required of manifest.package.required_paths) {
    assert.equal(fs.existsSync(path.join(root, required)), true, `missing required path: ${required}`);
  }
});

test('manifest, runtime, and health receipt declare the same beta version', () => {
  const manifest = JSON.parse(read('game.manifest.json'));
  const core = read('runtime/game-core.mjs');
  const server = read('runtime/server.cjs');
  const coreVersion = core.match(/GAME_VERSION = '([^']+)'/)?.[1];
  const serverVersion = server.match(/version: '([^']+)'/)?.[1];
  assert.equal(coreVersion, manifest.version);
  assert.equal(serverVersion, manifest.version);
});

test('launcher waits for its own hidden local server', () => {
  const launcher = read('START_LAST_STOP_NEBULA.ps1');
  assert.match(launcher, /gameId -eq '018-last-stop-nebula'/);
  assert.match(launcher, /-WindowStyle Hidden/);
  assert.match(launcher, /8818/);
});

test('runtime is self-contained and imports only the vendored renderer', () => {
  const app = read('runtime/app.mjs');
  const scene = read('runtime/scene.mjs');
  const html = read('runtime/index.html');
  assert.doesNotMatch(app + scene + html, /https?:\/\//i);
  assert.match(scene, /\.\/vendor\/three\.module\.js/);
  assert.match(app, /\.\/run-telemetry\.mjs/);
  assert.match(html, /LOCAL BALANCE LEDGER/);
  assert.match(html, /data-ledger-mode="standard"/);
  assert.match(html, /id="ledger-curve"/);
  assert.match(html, /id="ledger-download"/);
  assert.match(app, /createBalanceReport/);
  assert.ok(fs.statSync(path.join(root, 'runtime/vendor/three.module.js')).size > 500000);
});

test('event decisions and reduced motion expose keyboard accessibility contracts', () => {
  const app = read('runtime/app.mjs');
  const css = read('runtime/styles.css');
  const html = read('runtime/index.html');
  assert.match(html, /id="event-modal"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /id="event-note"[^>]*>PRESS 1–3 OR SELECT/);
  assert.match(html, /id="motion-button"[^>]*aria-pressed="false"/);
  assert.match(app, /setAttribute\('aria-keyshortcuts'/);
  assert.match(app, /Digit1: 0, Numpad1: 0/);
  assert.match(app, /focusBeforeEvent/);
  assert.match(app, /classList\.toggle\('reduced-motion'/);
  assert.match(css, /#game-shell\.reduced-motion \*/);
  assert.match(css, /\.event-choices button:focus-visible/);
});

test('every blocking overlay exposes a contained and reversible keyboard dialog', () => {
  const app = read('runtime/app.mjs');
  const css = read('runtime/styles.css');
  const html = read('runtime/index.html');
  for (const id of ['pause-modal', 'help-modal', 'ledger-modal']) {
    assert.match(html, new RegExp(`id="${id}"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="[^"]+"[^>]*aria-describedby="[^"]+"`));
  }
  assert.match(html, /id="resume-button"[^>]*aria-keyshortcuts="Escape"/);
  assert.match(html, /id="help-close"[^>]*aria-keyshortcuts="Escape"/);
  assert.match(html, /id="ledger-close"[^>]*aria-keyshortcuts="Escape"/);
  assert.match(app, /dialogReturnFocus/);
  assert.match(app, /function focusDialog/);
  assert.match(app, /function restoreDialogFocus/);
  assert.match(app, /function trapDialogFocus/);
  assert.match(app, /const blockingDialog = \[UI\.ledgerModal, UI\.helpModal, UI\.eventModal, UI\.pauseModal\]/);
  assert.match(css, /\.modal-layer button:focus-visible, \.modal-layer a:focus-visible/);
});

test('every declared upgrade has a dedicated 3D visual route', () => {
  const core = read('runtime/game-core.mjs');
  const scene = read('runtime/scene.mjs');
  const app = read('runtime/app.mjs');
  const upgradeBlock = core.match(/export const UPGRADES = \[([\s\S]*?)\n\];\n\nexport const EVENTS/);
  assert.ok(upgradeBlock, 'UPGRADES declaration should remain statically inspectable');
  const ids = [...upgradeBlock[1].matchAll(/\bid: '([^']+)'/g)].map(match => match[1]);
  assert.equal(ids.length, 12);
  for (const id of ids) {
    assert.match(scene, new RegExp(`visuals\\['${id}'\\]`), `missing 3D visual route for ${id}`);
  }
  assert.match(scene, /buildStationAtmosphere\(\)/);
  assert.match(scene, /uPressure/);
  assert.match(app, /QUERY\.get\('upgrade'\)/);
});

test('graphics quality is player-selectable, persistent, and routed into WebGL cost controls', () => {
  const app = read('runtime/app.mjs');
  const scene = read('runtime/scene.mjs');
  const html = read('runtime/index.html');
  assert.match(html, /id="graphics-button"[^>]*aria-label="Graphics quality: Cinematic"/);
  assert.match(html, /id="graphics-value"[^>]*aria-live="polite"/);
  assert.match(app, /graphics: 'cinematic'/);
  assert.match(app, /function applyGraphicsPreference\(\)/);
  assert.match(app, /function cycleGraphics\(\)/);
  assert.match(app, /persistSettings\(\)/);
  assert.match(scene, /const RENDER_QUALITY_PRESETS = Object\.freeze/);
  assert.match(scene, /setQualityPreset\(value\)/);
  assert.match(scene, /geometry\.setDrawRange/);
  assert.match(scene, /renderer\.shadowMap\.enabled = profile\.shadows/);
  assert.match(scene, /renderer\.setPixelRatio\(pixelRatio\)/);
});

test('installed upgrade cards inspect their 3D result without mutating game balance', () => {
  const app = read('runtime/app.mjs');
  const scene = read('runtime/scene.mjs');
  const cameraBlock = app.match(/const UPGRADE_CAMERAS = Object\.freeze\(\{([\s\S]*?)\n\}\);/);
  assert.ok(cameraBlock, 'upgrade camera map should remain statically inspectable');
  assert.equal([...cameraBlock[1].matchAll(/'[^']+': '(?:forecourt|mart|engineering|vista)'/g)].length, 12);
  assert.match(app, /button\.dataset\.inspectUpgrade = upgrade\.id/);
  assert.match(app, /button\.disabled = locked/);
  assert.match(app, /owned \? inspectUpgrade\(upgrade\) : purchaseUpgrade\(upgrade\.id\)/);
  assert.match(app, /const focusWasInside = UI\.upgradePanel\.contains\(document\.activeElement\)/);
  assert.match(app, /toggleUpgradePanel\(false, cameraControl\)/);
  const inspectBlock = app.match(/function inspectUpgrade\(upgrade\) \{([\s\S]*?)\n\}/);
  assert.ok(inspectBlock, 'inspectUpgrade should remain statically inspectable');
  assert.doesNotMatch(inspectBlock[1], /buyUpgrade|state\.[A-Za-z]+\s*=/);
  assert.match(inspectBlock[1], /scene\.highlightUpgrade\(upgrade\.id\)/);
  assert.match(scene, /highlightUpgrade\(id\)/);
  assert.match(scene, /new THREE\.Box3Helper/);
  assert.match(scene, /type: 'inspect'/);
});

test('service outcomes drive distinct reduced-motion-aware 3D choreography', () => {
  const app = read('runtime/app.mjs');
  const scene = read('runtime/scene.mjs');
  const css = read('runtime/styles.css');
  assert.match(scene, /const SERVICE_LANES = Object\.freeze/);
  assert.match(scene, /const SERVICE_OUTCOMES = new Set\(\['manual', 'automated', 'lost', 'blocked'\]\)/);
  assert.match(scene, /flashService\(lane, outcome = 'manual'\)/);
  assert.match(scene, /type: 'service'/);
  assert.match(scene, /departureOutcome = success \? 'served' : 'lost'/);
  assert.match(scene, /effect\.outcome === 'lost'/);
  assert.match(scene, /if \(this\.reducedMotion\)/);
  assert.match(scene, /disposeEffect\(effect\)/);
  assert.match(app, /scene\.flashService\(lane, 'blocked'\)/);
  assert.match(app, /scene\.flashService\(lane, 'manual'\)/);
  assert.match(app, /scene\.flashService\(action\.lane, 'lost'\)/);
  assert.match(app, /scene\.flashService\(action\.lane, 'automated'\)/);
  assert.match(app, /function signalLaneFeedback\(lane, outcome\)/);
  assert.match(app, /manual: 'MANUAL CLEAR'/);
  assert.match(app, /automated: 'AUTO CLEAR'/);
  assert.match(app, /lost: 'CUSTOMER LOST'/);
  assert.match(css, /@keyframes laneFeedback/);
  assert.match(css, /#game-shell\.reduced-motion \.lane-card\.feedback::before/);
  assert.match(app, /QA_MODE === 'service'/);
});

test('operational guidance stays focus-only and remains visible on responsive play', () => {
  const app = read('runtime/app.mjs');
  const core = read('runtime/game-core.mjs');
  const css = read('runtime/styles.css');
  const html = read('runtime/index.html');
  assert.match(html, /id="mission-panel"[^>]*data-tone="steady"/);
  assert.match(html, /id="pressure-action"[^>]*aria-describedby="pressure-copy"/);
  assert.match(core, /export function operationalAdvice\(state\)/);
  assert.match(app, /currentAdvice = operationalAdvice\(state\)/);
  assert.match(app, /function activateAdvice\(\)/);
  assert.match(app, /classList\.add\('advice-target'\)/);
  assert.match(app, /toggleUpgradePanel\(true\)/);
  assert.match(app, /upgradeRenderSignature/);
  assert.match(app, /signature === upgradeRenderSignature && UI\.upgradeGrid\.childElementCount/);
  assert.match(app, /QUERY\.get\('guide'\) === 'urgent'/);
  const adviceBlock = app.match(/function activateAdvice\(\) \{([\s\S]*?)\n\}/);
  assert.ok(adviceBlock, 'activateAdvice should remain statically inspectable');
  assert.doesNotMatch(adviceBlock[1], /serveNext|buySupply|takeMicroNap|buyUpgrade/);
  assert.match(css, /\.mission-panel \{ top: 210px; left: 8px; width: 210px;/);
  assert.doesNotMatch(css, /\.mission-panel \{ display: none; \}/);
  assert.match(css, /@keyframes adviceTarget/);
  assert.match(css, /#game-shell\.reduced-motion \.advice-target/);
});

test('the deterministic arrival clock drives responsive HUD and 3D inbound signals', () => {
  const app = read('runtime/app.mjs');
  const core = read('runtime/game-core.mjs');
  const scene = read('runtime/scene.mjs');
  const css = read('runtime/styles.css');
  const html = read('runtime/index.html');
  assert.match(core, /export function arrivalForecast\(state\)/);
  assert.match(html, /id="arrival-line"[^>]*data-tone="steady"/);
  assert.match(html, /id="arrival-label">ON VECTOR/);
  assert.match(html, /id="arrival-meter"/);
  assert.match(html, /id="arrival-eta">2\.0 SEC/);
  assert.match(html, /aria-hidden="true">→<\/small>/);
  assert.doesNotMatch(html, /â†’/);
  assert.match(app, /const inbound = arrivalForecast\(state\)/);
  assert.match(app, /scene\.setArrivalForecast\(inbound\)/);
  assert.match(app, /qaArrival === 'imminent'/);
  assert.match(app, /qaArrival === 'surge'/);
  assert.match(scene, /buildArrivalVector\(\)/);
  assert.match(scene, /setArrivalForecast\(forecast\)/);
  assert.match(scene, /canvas\.dataset\.arrivalPhase/);
  assert.match(scene, /this\.reducedMotion \? 1 : \.78/);
  assert.match(css, /\.arrival-line\[data-tone="danger"\]/);
  assert.match(css, /\.mission-panel \.arrival-line/);
  assert.match(css, /#game-shell\.reduced-motion \.arrival-line/);
});

test('queue constellations route live lane load and urgency into the 3D station', () => {
  const app = read('runtime/app.mjs');
  const core = read('runtime/game-core.mjs');
  const scene = read('runtime/scene.mjs');
  assert.match(core, /export function queueConstellation\(state\)/);
  assert.match(core, /visiblePips: Math\.min\(5, summary\.count\)/);
  assert.match(core, /overflow: Math\.max\(0, summary\.count - 5\)/);
  assert.match(app, /queueConstellation,/);
  assert.match(app, /scene\.setQueueConstellation\(queueConstellation\(state\)\)/);
  assert.match(app, /QUERY\.get\('queues'\)/);
  assert.match(scene, /const QUEUE_SIGNALS = Object\.freeze/);
  assert.match(scene, /buildQueueConstellations\(\)/);
  assert.match(scene, /setQueueConstellation\(telemetry\)/);
  assert.match(scene, /canvas\.dataset\.queueLoads/);
  assert.match(scene, /canvas\.dataset\.queueLead/);
  assert.match(scene, /canvas\.dataset\.queueDanger/);
  assert.match(scene, /canvas\.dataset\.queueTones/);
  assert.match(scene, /canvas\.dataset\.queueMotion/);
  assert.match(scene, /this\.reducedMotion \? 1 : 1 \+ Math\.sin/);
});

test('shift horizon routes the deterministic day clock into HUD and 3D atmosphere', () => {
  const app = read('runtime/app.mjs');
  const core = read('runtime/game-core.mjs');
  const scene = read('runtime/scene.mjs');
  const css = read('runtime/styles.css');
  const html = read('runtime/index.html');
  assert.match(core, /export function shiftAtmosphere\(state\)/);
  assert.match(core, /phase = 'FIRST LIGHT'/);
  assert.match(core, /phase = 'HIGH ORBIT'/);
  assert.match(core, /phase = 'EMBER SHIFT'/);
  assert.match(core, /phase = 'DEEP WATCH'/);
  assert.match(html, /id="shift-phase" class="shift-phase"/);
  assert.match(app, /const shift = shiftAtmosphere\(state\)/);
  assert.match(app, /scene\.setShiftAtmosphere\(shift\)/);
  assert.match(app, /QUERY\.get\('shift'\)/);
  assert.match(scene, /buildShiftHorizon\(\)/);
  assert.match(scene, /setShiftAtmosphere\(atmosphere\)/);
  assert.match(scene, /canvas\.dataset\.shiftPhase/);
  assert.match(scene, /canvas\.dataset\.shiftTone/);
  assert.match(scene, /canvas\.dataset\.shiftProgress/);
  assert.match(scene, /canvas\.dataset\.shiftMotion/);
  assert.match(css, /\.day-block\[data-shift-tone="night"\]/);
});

test('decision archaeology routes saved choices into persistent reduced-motion-aware 3D traces', () => {
  const app = read('runtime/app.mjs');
  const core = read('runtime/game-core.mjs');
  const scene = read('runtime/scene.mjs');
  assert.match(core, /export const DECISION_LEGACY_CATALOG = Object\.freeze/);
  assert.equal([...core.matchAll(/^  '[^']+:[^']+': Object\.freeze\(/gm)].length, 17);
  assert.match(core, /export function decisionLegacy\(state\)/);
  assert.match(core, /byEvent\.has\(event\.id\)/);
  assert.match(core, /merged\.stats\.choices = decisionLegacy\(merged\)/);
  assert.match(app, /scene\.setDecisionLegacy\(decisionLegacy\(state\)\)/);
  assert.match(app, /QUERY\.get\('legacy'\)/);
  assert.match(app, /qaLegacy === 'all'/);
  assert.match(scene, /const DECISION_LEGACY_ANCHORS = Object\.freeze/);
  assert.match(scene, /buildDecisionLegacyRoot\(\)/);
  assert.match(scene, /createDecisionLegacyVisual\(entry\)/);
  assert.match(scene, /setDecisionLegacy\(legacy\)/);
  assert.match(scene, /canvas\.dataset\.decisionCount/);
  assert.match(scene, /canvas\.dataset\.decisionIds/);
  assert.match(scene, /canvas\.dataset\.decisionLatest/);
  assert.match(scene, /canvas\.dataset\.decisionMotion/);
  assert.match(scene, /this\.reducedMotion \? 0 : time/);
});

test('new event decisions reveal their permanent trace without replaying saved history', () => {
  const app = read('runtime/app.mjs');
  const core = read('runtime/game-core.mjs');
  const scene = read('runtime/scene.mjs');
  assert.match(scene, /import \{[^}]*decisionRevealFrame[^}]*\} from '\.\/game-core\.mjs'/);
  assert.match(core, /export function decisionRevealFrame\(progress = 0, reducedMotion = false\)/);
  assert.match(scene, /const DECISION_REVEAL_DURATION = 2400/);
  assert.match(scene, /revealDecisionLegacy\(entry\)/);
  assert.match(scene, /type: 'decision-reveal'/);
  assert.match(scene, /canvas\.dataset\.decisionRevealPhase/);
  assert.match(scene, /canvas\.dataset\.decisionRevealProgress/);
  assert.match(scene, /canvas\.dataset\.decisionRevealScale/);
  assert.match(scene, /canvas\.dataset\.decisionRevealEffectScale/);
  assert.match(scene, /canvas\.dataset\.decisionRevealMotion/);
  assert.match(scene, /canvas\.clientWidth \|\| window\.innerWidth\) < 520 \? \.74 : 1/);
  assert.match(scene, /this\.reducedMotion \? 'static-confirmation' : 'assembling'/);
  assert.match(scene, /decisionRevealFrame\(progress, this\.reducedMotion\)/);

  const resolveBlock = app.match(/function resolveEvent\(eventId, choiceId\) \{([\s\S]*?)\n\}/);
  assert.ok(resolveBlock, 'resolveEvent should remain statically inspectable');
  assert.match(resolveBlock[1], /scene\.revealDecisionLegacy\(legacy\.latest\)/);
  assert.ok(
    resolveBlock[1].indexOf('renderAll();') < resolveBlock[1].indexOf('scene.revealDecisionLegacy(legacy.latest)'),
    'the permanent trace must be rendered before its reveal is started'
  );
  const historyBlock = scene.match(/setDecisionLegacy\(legacy\) \{([\s\S]*?)\n  \}/);
  assert.ok(historyBlock, 'setDecisionLegacy should remain statically inspectable');
  assert.doesNotMatch(historyBlock[1], /revealDecisionLegacy/);
  assert.match(app, /decisionReveal: \{/);
  assert.match(app, /decisionRevealPhase/);
});

test('debt liberation turns real repayment into persistent HUD and 3D ownership progress', () => {
  const app = read('runtime/app.mjs');
  const core = read('runtime/game-core.mjs');
  const scene = read('runtime/scene.mjs');
  const css = read('runtime/styles.css');
  const html = read('runtime/index.html');
  assert.match(core, /export const STARTING_DEBT = 720/);
  assert.match(core, /export function debtLiberation\(state\)/);
  assert.match(core, /phase = 'LIEN LOCKED'/);
  assert.match(core, /phase = 'LIEN CRACKING'/);
  assert.match(core, /phase = 'FINAL CLAIM'/);
  assert.match(core, /phase = 'STATION YOURS'/);
  assert.match(core, /debtBefore/);
  assert.match(core, /debtAfter: state\.debt/);
  assert.match(html, /id="debt-stat"/);
  assert.match(html, /id="debt-line"[^>]*data-tone="warning"/);
  assert.match(html, /id="debt-phase">LIEN LOCKED/);
  assert.match(app, /const liberation = debtLiberation\(state\)/);
  assert.match(app, /scene\.setDebtLiberation\(liberation\)/);
  assert.match(app, /scene\.flashDebtPayment\(action\.debtBefore, action\.debtAfter\)/);
  assert.match(app, /AXM LIEN RELEASED/);
  assert.match(app, /const qaDebtValues = \{ locked: STARTING_DEBT, cracking: 420, final: 14, clear: 0 \}/);
  assert.match(scene, /buildDebtLien\(\)/);
  assert.match(scene, /setDebtLiberation\(relief\)/);
  assert.match(scene, /flashDebtPayment\(beforeDebt, afterDebt\)/);
  assert.match(scene, /type: 'debt-payment'/);
  assert.match(scene, /canvas\.dataset\.debtStage/);
  assert.match(scene, /canvas\.dataset\.debtProgress/);
  assert.match(scene, /canvas\.dataset\.debtLinks/);
  assert.match(scene, /this\.debtLienLabel\.visible = .* > 820/);
  assert.match(scene, /canvas\.dataset\.debtLabel = .*'hud-only'/);
  assert.match(scene, /canvas\.dataset\.debtPaymentPhase/);
  assert.match(scene, /this\.reducedMotion \? 1\.18/);
  assert.match(css, /\.debt-line \{/);
  assert.match(css, /\.debt-line\[data-tone="clear"\]/);
  assert.match(css, /\.debt-line\[data-tone="clear"\] > strong \{ color: var\(--teal\); text-shadow:/);
  assert.match(css, /\.mission-panel \.debt-line/);
});
