'use strict';

const crypto = require('crypto');
const Core = require('./semantic-candidate-generator-v1');

const VERSION = '0.1.0';
const BRIEF_SCHEMA = 'axm.game-generation-brief/v1';
const REQUEST_SCHEMA = 'axm.game-candidate-generation-request/v1';
const PACKET_SCHEMA = 'axm.game-candidate-packet/v1';
const MODULE_BUNDLE_SCHEMA = 'axm.module-bundle/v1';
const RECIPE_ID = 'four-roots-grid-game';
const GENERATOR_ID = 'axm-native-game-recipe-engine';
const ROOTS = ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'];
const REQUIRED_COMPONENT_IDS = [
  'automated-playtester-scenario-agent', 'detached-candidate-nursery', 'deterministic-json-core',
  'evidence-desk', 'game-capability-atlas', 'game-forge', 'review-inbox', 'sandbox'
];
const REQUIRED_FILES = [
  'README.md', 'candidate.receipt.json', 'game-forge-project.json',
  'game.config.json', 'game.js', 'index.html', 'installation-gap.json',
  'module.contract.json', 'sandbox.game.json', 'styles.css', 'test-plan.json'
];
const LIMITATIONS = [
  'AUTHENTICATED_HUMAN_IDENTITY_NOT_PROVEN',
  'FOUR_ROOT_EVIDENCE_CONTENT_NOT_VERIFIED',
  'GAME_CODE_NOT_EXECUTED_BY_GENERATOR',
  'RUNTIME_BEHAVIOR_NOT_PROVEN_AT_GENERATION',
  'VISUAL_BEHAVIOR_NOT_PROVEN_AT_GENERATION',
  'PLAY_JOURNEY_NOT_PROVEN_AT_GENERATION',
  'PERSISTENCE_NOT_IMPLEMENTED',
  'GENERATED_SOURCE_DIRECT_REUSE_RIGHTS_HELD',
  'INSTALLATION_NOT_AUTHORIZED',
  'INTEGRATION_NOT_AUTHORIZED',
  'ACTIVE_LIBRARY_CHANGE_NOT_AUTHORIZED',
  'PUBLICATION_PROMOTION_AND_CANON_NOT_AUTHORIZED'
];
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const COLOR = /^#[0-9a-fA-F]{6}$/;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Core.canonicalJson(value); }
function same(a, b) { return canonical(a) === canonical(b); }
function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function hashBytes(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function hashValue(value) { return 'sha256:' + hashBytes(Buffer.from(canonical(value), 'utf8')); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function object(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object'); return value; }
function exact(value, keys, label) { object(value, label); const a = Object.keys(value).sort(); const b = keys.slice().sort(); if (!same(a, b)) throw new Error(label + ' fields must be exactly: ' + b.join(', ')); }
function text(value, label, max) { if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(label + ' must be bounded text'); return value; }
function id(value, label) { value = text(value, label, 128); if (!ID.test(value)) throw new Error(label + ' must be a portable id'); return value; }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a SHA-256 digest'); return value; }
function integer(value, label, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(label + ' must be an integer from ' + min + ' to ' + max); return value; }
function ref(value, label) { exact(value, ['id', 'schema', 'sha256'], label); return { id: id(value.id, label + '.id'), schema: text(value.schema, label + '.schema', 220), sha256: digest(value.sha256, label + '.sha256') }; }

function sealBrief(value) {
  exact(value, ['schema', 'id', 'title', 'seed', 'recipeId', 'difficulty', 'world', 'theme', 'accessibility', 'session', 'authority'], 'game brief');
  if (value.schema !== BRIEF_SCHEMA || value.recipeId !== RECIPE_ID || value.authority !== 'NONE') throw new Error('game brief identity mismatch');
  exact(value.world, ['width', 'height'], 'game brief.world');
  if (value.world.width !== 16 || value.world.height !== 10) throw new Error('first game recipe requires a 16 by 10 Game Forge world');
  exact(value.theme, ['background', 'panel', 'wall', 'path', 'player', 'accent', 'text'], 'game brief.theme');
  Object.entries(value.theme).forEach(([key, color]) => { if (!COLOR.test(color)) throw new Error('game brief.theme.' + key + ' must be a six-digit color'); });
  exact(value.accessibility, ['touchTargetPx', 'reducedMotionDefault', 'highContrast'], 'game brief.accessibility');
  if (typeof value.accessibility.reducedMotionDefault !== 'boolean' || value.accessibility.highContrast !== true) throw new Error('game brief accessibility settings are invalid');
  exact(value.session, ['persistence', 'network', 'players'], 'game brief.session');
  if (!['CALM', 'STANDARD', 'BRISK'].includes(value.difficulty) || value.session.persistence !== 'SESSION_ONLY' || value.session.network !== 'DISABLED' || value.session.players !== 1) throw new Error('game brief scope is unsupported');
  const core = {
    schema: BRIEF_SCHEMA, id: id(value.id, 'game brief.id'), title: text(value.title, 'game brief.title', 80),
    seed: integer(value.seed, 'game brief.seed', 0, 4294967295), recipeId: RECIPE_ID, difficulty: value.difficulty,
    world: { width: 16, height: 10 }, theme: clone(value.theme),
    accessibility: { touchTargetPx: integer(value.accessibility.touchTargetPx, 'game brief.accessibility.touchTargetPx', 44, 72), reducedMotionDefault: value.accessibility.reducedMotionDefault, highContrast: true },
    session: { persistence: 'SESSION_ONLY', network: 'DISABLED', players: 1 }, authority: 'NONE'
  };
  return { ...core, briefDigest: hashValue(core) };
}

function normalizeBrief(value) {
  exact(value, ['schema', 'id', 'title', 'seed', 'recipeId', 'difficulty', 'world', 'theme', 'accessibility', 'session', 'authority', 'briefDigest'], 'game brief');
  const { briefDigest, ...core } = value;
  const sealed = sealBrief(core);
  if (sealed.briefDigest !== digest(briefDigest, 'game brief.briefDigest') || !same(sealed, value)) throw new Error('game brief digest or canonical form mismatch');
  return sealed;
}

function normalizeComponent(value, label) {
  exact(value, ['ref', 'contract'], label);
  const reference = ref(value.ref, label + '.ref');
  object(value.contract, label + '.contract');
  if (value.contract.schema !== 'axm.module-contract/v1' || value.contract.id !== reference.id || reference.schema !== 'axm.module-contract/v1' || hashValue(value.contract) !== reference.sha256) throw new Error(label + ' contract bytes do not match the reference');
  return { ref: reference, contract: clone(value.contract) };
}

function normalizeRoots(values) {
  if (!Array.isArray(values) || values.length !== 4) throw new Error('rootsGate must contain exactly four decisions');
  return values.map((item, index) => {
    exact(item, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (item.root !== ROOTS[index] || !['PASS', 'HOLD', 'FAIL'].includes(item.verdict)) throw new Error('rootsGate order or verdict is invalid');
    if (!Array.isArray(item.evidenceRefs) || !item.evidenceRefs.length || item.evidenceRefs.length > 8) throw new Error('root evidence references are required');
    return { root: item.root, verdict: item.verdict, evidenceRefs: item.evidenceRefs.map((item, n) => ref(item, 'rootsGate[' + index + '].evidenceRefs[' + n + ']')).sort((a, b) => compareText(canonical(a), canonical(b))) };
  });
}

function normalizeAuthorization(value) {
  exact(value, ['schema', 'decisionRef', 'scope', 'generate', 'sandboxBuild', 'sandboxPreview', 'sandboxRepair', 'lessonCandidate', 'maxIterations', 'install', 'integrate', 'publish', 'promote', 'canon', 'authenticatedIdentityProven', 'authority'], 'authorization');
  const requiredTrue = ['generate', 'sandboxBuild', 'sandboxPreview', 'sandboxRepair', 'lessonCandidate'];
  const requiredFalse = ['install', 'integrate', 'publish', 'promote', 'canon', 'authenticatedIdentityProven'];
  if (value.schema !== 'axm.bounded-sandbox-growth-authorization/v1' || value.scope !== 'GENERATE_BUILD_PREVIEW_REPAIR_AND_LESSON_CANDIDATES' || value.authority !== 'NONE' || requiredTrue.some((key) => value[key] !== true) || requiredFalse.some((key) => value[key] !== false)) throw new Error('authorization exceeds or removes the bounded sandbox growth scope');
  return { ...clone(value), decisionRef: ref(value.decisionRef, 'authorization.decisionRef'), maxIterations: integer(value.maxIterations, 'authorization.maxIterations', 1, 5) };
}

function normalizeResources(value) {
  exact(value, ['maxInputBytes', 'maxOutputBytes', 'maxFileBytes', 'maxFiles', 'maxIterations', 'maxCandidateProcesses', 'maxCostMinorUnits'], 'resources');
  const out = {
    maxInputBytes: integer(value.maxInputBytes, 'resources.maxInputBytes', 1, 1048576),
    maxOutputBytes: integer(value.maxOutputBytes, 'resources.maxOutputBytes', 1, 2097152),
    maxFileBytes: integer(value.maxFileBytes, 'resources.maxFileBytes', 1, 262144),
    maxFiles: integer(value.maxFiles, 'resources.maxFiles', 1, 32),
    maxIterations: integer(value.maxIterations, 'resources.maxIterations', 1, 5),
    maxCandidateProcesses: value.maxCandidateProcesses,
    maxCostMinorUnits: value.maxCostMinorUnits
  };
  if (out.maxCandidateProcesses !== 0 || out.maxCostMinorUnits !== 0) throw new Error('game generation grants no candidate process or cost authority');
  return out;
}

function loadRequiredComponentContracts() {
  return {
    'automated-playtester-scenario-agent': require('../../tools/automated-playtester-scenario-agent/module.contract.json'),
    'detached-candidate-nursery': require('../../tools/detached-candidate-nursery/module.contract.json'),
    'deterministic-json-core': require('../../tools/deterministic-json-core/module.contract.json'),
    'evidence-desk': require('../../tools/evidence-desk/module.contract.json'),
    'game-capability-atlas': require('../game-capability-atlas/module.contract.json'),
    'game-forge': require('../../tools/game-forge/module.contract.json'),
    'review-inbox': require('../../tools/review-inbox/module.contract.json'),
    'sandbox': require('../../tools/sandbox/module.contract.json')
  };
}

function sealRequest(value) {
  exact(value, ['schema', 'id', 'goal', 'brief', 'components', 'rootsGate', 'authorization', 'resources', 'reuseRights', 'authority'], 'game generation request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE') throw new Error('game generation request identity mismatch');
  const components = value.components.map((item, index) => normalizeComponent(item, 'components[' + index + ']')).sort((a, b) => compareText(a.ref.id, b.ref.id));
  if (!same(components.map((item) => item.ref.id), REQUIRED_COMPONENT_IDS)) throw new Error('game generation request needs the exact existing Workshop component set');
  const trustedContracts = loadRequiredComponentContracts();
  for (const item of components) if (!same(item.contract, trustedContracts[item.ref.id])) throw new Error('component contract does not match the approved Workshop bytes: ' + item.ref.id);
  const rootsGate = normalizeRoots(value.rootsGate);
  const blocked = rootsGate.filter((item) => item.verdict !== 'PASS');
  if (blocked.length) throw new Error('ROOTS_GATE_HOLD:' + blocked.map((item) => item.root + '=' + item.verdict).join(','));
  const authorization = normalizeAuthorization(value.authorization);
  const resources = normalizeResources(value.resources);
  if (authorization.maxIterations !== resources.maxIterations) throw new Error('authorization and resource iteration ceilings drifted');
  exact(value.reuseRights, ['state', 'directReuseAllowed', 'authorityRef'], 'reuseRights');
  if (value.reuseRights.state !== 'RESEARCH_ONLY_HOLD' || value.reuseRights.directReuseAllowed !== false || value.reuseRights.authorityRef !== null) throw new Error('generated game source direct reuse rights must remain held');
  const core = { schema: REQUEST_SCHEMA, id: id(value.id, 'request.id'), goal: text(value.goal, 'request.goal', 600), brief: normalizeBrief(value.brief), components, rootsGate, authorization, resources, reuseRights: clone(value.reuseRights), authority: 'NONE' };
  if (jsonBytes(core).length > resources.maxInputBytes) throw new Error('game generation request exceeds the input byte ceiling');
  const sealed = { ...core, requestDigest: hashValue(core) };
  if (jsonBytes(sealed).length > resources.maxInputBytes) throw new Error('sealed game generation request exceeds the input byte ceiling');
  return sealed;
}

function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'goal', 'brief', 'components', 'rootsGate', 'authorization', 'resources', 'reuseRights', 'authority', 'requestDigest'], 'game generation request');
  const { requestDigest, ...core } = value;
  const sealed = sealRequest(core);
  if (sealed.requestDigest !== digest(requestDigest, 'request.requestDigest') || !same(sealed, value)) throw new Error('game generation request digest or canonical form mismatch');
  return sealed;
}

function rng(seed) { let state = seed >>> 0; return function () { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }

function buildMap(brief) {
  const width = 16, height = 10, cells = Array.from({ length: width * height }, () => 'wall');
  const set = (x, y, terrain) => { cells[y * width + x] = terrain; };
  for (let x = 1; x <= 14; x++) set(x, 1, 'path');
  for (let y = 1; y <= 8; y++) set(14, y, 'path');
  const random = rng(brief.seed);
  const extra = brief.difficulty === 'CALM' ? 34 : brief.difficulty === 'BRISK' ? 18 : 26;
  for (let count = 0, tries = 0; count < extra && tries < 1000; tries++) {
    const x = 1 + Math.floor(random() * 14), y = 2 + Math.floor(random() * 7), index = y * width + x;
    if (cells[index] === 'wall' && (x === 14 || random() > 0.3)) { cells[index] = 'ground'; count++; }
  }
  const checkpoints = [
    { id: 'truth', label: 'Truth', x: 4, y: 1 },
    { id: 'agency-non-domination', label: 'Agency / non-domination', x: 8, y: 1 },
    { id: 'continuity', label: 'Continuity', x: 14, y: 3 },
    { id: 'wisdom-over-speed', label: 'Wisdom over speed', x: 14, y: 6 }
  ];
  set(1, 1, 'spawn'); checkpoints.forEach((item) => set(item.x, item.y, 'root')); set(14, 8, 'goal');
  return { width, height, cells, spawn: { x: 1, y: 1 }, checkpoints, goal: { x: 14, y: 8 } };
}

function htmlEscape(value) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

function gameSource(config) {
  return `'use strict';\n\nconst CONFIG = Object.freeze(${JSON.stringify(config)});\nconst state = { x: CONFIG.map.spawn.x, y: CONFIG.map.spawn.y, nextRoot: 0, moves: 0, won: false };\nconst byId = (id) => document.getElementById(id);\nfunction publicState(){return {x:state.x,y:state.y,nextRoot:state.nextRoot,moves:state.moves,won:state.won,target:CONFIG.map.checkpoints[state.nextRoot]?.label||'Workshop exit'};}\nfunction terrainAt(x,y){return CONFIG.map.cells[y*CONFIG.map.width+x];}\nfunction updateObjective(){document.querySelectorAll('[data-root]').forEach((node,index)=>{node.dataset.state=index<state.nextRoot?'complete':index===state.nextRoot?'current':'waiting';});}\nfunction render(){const board=byId('board');board.replaceChildren();CONFIG.map.cells.forEach((terrain,index)=>{const cell=document.createElement('div');cell.className='cell '+terrain;cell.setAttribute('aria-hidden','true');if(index===state.y*CONFIG.map.width+state.x){const player=document.createElement('span');player.className='player';cell.appendChild(player);}board.appendChild(cell);});updateObjective();byId('moves').textContent=String(state.moves);window.AXM_GAME_VISIBLE_STATE=publicState();}\nfunction announce(message){byId('status').textContent=message;}\nfunction reset(){state.x=CONFIG.map.spawn.x;state.y=CONFIG.map.spawn.y;state.nextRoot=0;state.moves=0;state.won=false;announce('Find Truth first.');render();}\nfunction move(dx,dy){if(state.won)return false;const x=state.x+dx,y=state.y+dy;if(x<0||y<0||x>=CONFIG.map.width||y>=CONFIG.map.height||terrainAt(x,y)==='wall')return false;state.x=x;state.y=y;state.moves++;const target=CONFIG.map.checkpoints[state.nextRoot];if(target&&x===target.x&&y===target.y){state.nextRoot++;announce(target.label+' carried forward.');}else if(x===CONFIG.map.goal.x&&y===CONFIG.map.goal.y){if(state.nextRoot===CONFIG.map.checkpoints.length){state.won=true;announce('Game complete: all four roots reached the Workshop.');byId('victory').hidden=false;}else announce('The exit waits for all four roots.');}else announce('Position '+x+', '+y+'.');render();return true;}\nfunction action(name){const moves={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};if(name==='reset'){byId('victory').hidden=true;reset();return true;}if(!moves[name])return false;return move(moves[name][0],moves[name][1]);}\ndocument.querySelectorAll('[data-action]').forEach((button)=>button.addEventListener('click',()=>action(button.dataset.action)));\ndocument.addEventListener('keydown',(event)=>{const key={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',r:'reset',R:'reset'}[event.key];if(key){event.preventDefault();action(key);}});\nwindow.AXM_GAME_INPUT=action;window.AXM_GAME_PUBLIC_STATE=publicState;reset();\n`;
}

function styleSource(brief) {
  const t = brief.theme, px = brief.accessibility.touchTargetPx;
  return `:root{color-scheme:dark;--bg:${t.background};--panel:${t.panel};--wall:${t.wall};--path:${t.path};--player:${t.player};--accent:${t.accent};--text:${t.text};--target:${px}px}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,var(--panel),var(--bg) 64%);color:var(--text);font-family:system-ui,sans-serif}.shell{width:min(1080px,96vw);margin:auto;padding:24px;display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px}h1{margin:.1em 0}.lede{color:#b9c9dd}.board{display:grid;grid-template-columns:repeat(16,1fr);gap:3px;padding:10px;background:#05080d;border:2px solid var(--accent);border-radius:18px;box-shadow:0 18px 60px #0008}.cell{aspect-ratio:1;border-radius:5px;background:var(--wall);min-width:0}.cell.path,.cell.spawn{background:var(--path)}.cell.ground{background:#183140}.cell.root{background:var(--accent);box-shadow:inset 0 0 0 3px #fff8}.cell.goal{background:#ffd166;box-shadow:inset 0 0 0 3px #271b00}.player{display:block;width:70%;height:70%;margin:15%;border-radius:45%;background:var(--player);border:3px solid white;box-shadow:0 0 16px var(--player)}.side{background:color-mix(in srgb,var(--panel) 90%,black);border:1px solid #48627e;border-radius:18px;padding:18px}.roots{padding-left:22px}.roots li{margin:12px 0}.roots li[data-state=complete]{color:#8ff0b2;text-decoration:line-through}.roots li[data-state=current]{color:#ffe082;font-weight:800}.status{min-height:3em;padding:12px;border-radius:10px;background:#07111d;border:1px solid #47617d}.controls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.controls button{min-width:var(--target);min-height:var(--target);font:700 18px system-ui;border:2px solid var(--accent);border-radius:12px;background:#112338;color:var(--text);cursor:pointer}.controls button:focus-visible{outline:4px solid white;outline-offset:3px}.controls .up{grid-column:2}.controls .left{grid-column:1}.controls .down{grid-column:2}.controls .right{grid-column:3}.reset{grid-column:1/4}.victory{margin-top:12px;padding:12px;background:#173a26;border:2px solid #8ff0b2;border-radius:12px;font-weight:800}@media(max-width:760px){.shell{grid-template-columns:1fr;padding:12px}.board{gap:2px}.side{order:-1}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}\n`;
}

function indexSource(brief) {
  const title = htmlEscape(brief.title);
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="styles.css"></head><body><main class="shell"><section aria-labelledby="game-title"><h1 id="game-title">${title}</h1><p class="lede">Carry AXM’s four roots to the Workshop exit. Arrow keys, WASD, or the visible controls all use the same input gate.</p><div id="board" class="board" role="img" aria-label="A sixteen by ten grid path with four root checkpoints and one Workshop exit"></div></section><aside class="side"><h2>Root route</h2><ol class="roots"><li data-root>Truth</li><li data-root>Agency / non-domination</li><li data-root>Continuity</li><li data-root>Wisdom over speed</li></ol><p>Moves: <strong id="moves">0</strong></p><p id="status" class="status" role="status" aria-live="polite">Preparing game.</p><div class="controls" aria-label="Game controls"><button class="up" data-action="up" aria-label="Move up">↑</button><button class="left" data-action="left" aria-label="Move left">←</button><button class="down" data-action="down" aria-label="Move down">↓</button><button class="right" data-action="right" aria-label="Move right">→</button><button class="reset" data-action="reset">Reset run</button></div><p id="victory" class="victory" hidden>All four roots reached the Workshop.</p></aside></main><script src="game.js"></script></body></html>\n`;
}

function buildProject(request, map) {
  return {
    schema: 'axm.game-forge-project/v1', id: request.brief.id, name: request.brief.title, version: '0.1.0', runtimeMode: '2D', status: 'DRAFT',
    createdAt: null, updatedAt: null, capabilityPlan: null,
    world: { width: 16, height: 10, cells: map.cells.map((terrain) => ({ terrain: terrain === 'root' ? 'path' : terrain, height: 0 })) },
    physics: { schema: 'axm.game-physics-config/v1', engine: 'axm-physics-2d', engineVersion: '0.3.1', enabled: false, world: null, updatedAt: null },
    events: { nodes: [], edges: [] },
    systems: [{ id: 'four-root-checkpoint-order', type: 'Quest', state: 'DECLARED' }], behaviors: [], tests: [], mods: []
  };
}

function sourceFile(path, bytes) {
  path = Core.normalizePortablePath(path);
  return { path, encoding: 'base64', content: bytes.toString('base64'), sha256: hashBytes(bytes) };
}

function buildBundle(request) {
  const candidate = { id: 'four-roots-run-native', version: 'v0.1', status: 'EXPERIMENTAL' };
  const map = buildMap(request.brief);
  const config = { schema: 'axm.sandbox-grid-game-config/v1', title: request.brief.title, seed: request.brief.seed, difficulty: request.brief.difficulty, map, session: request.brief.session, authority: 'NONE' };
  const project = buildProject(request, map);
  const contract = {
    schema: 'axm.module-contract/v1', id: candidate.id, version: candidate.version, status: candidate.status,
    provides: ['axm.sandbox-playable-game/v1'], consumes: ['axm.game-forge-project/v1'], permissions: [],
    handoffs: { emits: ['axm.game-visible-state/v1'], accepts: ['human-keyboard-or-visible-control'] }, rootsGate: ROOTS,
    lifecycle: { state_owner: 'browser-memory', reload: 'reset', disconnect: 'not-applicable', cleanup: 'automatic' },
    boundaries: { writes: [], refuses: ['network-use', 'host-environment-access', 'filesystem-access', 'hidden-input-gate', 'automatic-install', 'automatic-integration', 'automatic-learning-admission', 'automatic-promotion', 'automatic-canon'] }
  };
  const receipt = { schema: 'axm.game-candidate-receipt/v1', candidate, generator: { id: GENERATOR_ID, version: VERSION, recipeId: RECIPE_ID }, authority: { installed: false, integrated: false, published: false, lessonActive: false, promoted: false, canonChanged: false }, truth: { gameCodeExecuted: false, runtimeBehaviorProven: false, visualBehaviorProven: false, playJourneyProven: false }, authorityCeiling: 'NONE' };
  const testPlan = { schema: 'axm.game-candidate-test-plan/v1', candidate, cases: [
    ['byte-lineage', 'All source and game-project bytes match their digests.', 'static-structure'],
    ['script-syntax', 'The external game script parses without execution.', 'parse-only'],
    ['network-denial', 'The preview cannot make network connections.', 'sandbox-boundary'],
    ['keyboard-journey', 'Keyboard input can carry all four roots to the exit.', 'browser-play'],
    ['visible-controls', 'Visible buttons use the same game action gate.', 'browser-click'],
    ['truth-order', 'The exit cannot complete before all four roots are collected in order.', 'runtime-countertest'],
    ['responsive-layout', 'The game remains usable at desktop and narrow viewports.', 'browser-render'],
    ['accessible-status', 'Controls have labels, focus visibility, and live status.', 'browser-accessibility'],
    ['resource-budget', 'Build and preview remain inside declared byte and process ceilings.', 'measured-resource'],
    ['restart-truth', 'Reload resets because persistence is explicitly unsupported.', 'browser-reload']
  ].map(([id, claim, evidenceKind]) => ({ id, claim, evidenceKind, verdict: 'UNRUN' })), truth: { gameCodeExecuted: false, humanApproved: false }, authority: 'NONE' };
  const sandboxManifest = { schema: 'axm.sandbox-game-candidate/v1', id: candidate.id, title: request.brief.title, status: 'EXPERIMENTAL', entry: 'index.html', script: 'game.js', style: 'styles.css', project: 'game-forge-project.json', controls: ['keyboard', 'visible-buttons'], network: 'DISABLED', persistence: 'SESSION_ONLY', installed: false, authority: 'NONE' };
  const installGap = { schema: 'axm.game-installation-gap/v1', status: 'INSTALLATION_REVIEW_REQUIRED', candidateId: candidate.id, missingCapability: 'trusted-static-game-runtime-install-adapter', sandboxPreviewIsInstallationProof: false, installAllowed: false, nextGate: 'MIKE_INSTALLATION_DECISION', authority: 'NONE' };
  const files = [
    sourceFile('README.md', Buffer.from('# ' + request.brief.title + '\n\nEXPERIMENTAL deterministic native game candidate. Sandbox preview only. Direct reuse remains held; installation requires Mike.\n', 'utf8')),
    sourceFile('candidate.receipt.json', jsonBytes(receipt)), sourceFile('game.config.json', jsonBytes(config)),
    sourceFile('game.js', Buffer.from(gameSource(config), 'utf8')), sourceFile('game-forge-project.json', jsonBytes(project)),
    sourceFile('index.html', Buffer.from(indexSource(request.brief), 'utf8')), sourceFile('installation-gap.json', jsonBytes(installGap)),
    sourceFile('module.contract.json', jsonBytes(contract)), sourceFile('sandbox.game.json', jsonBytes(sandboxManifest)),
    sourceFile('styles.css', Buffer.from(styleSource(request.brief), 'utf8')), sourceFile('test-plan.json', jsonBytes(testPlan))
  ].sort((a, b) => compareText(a.path, b.path));
  if (!same(files.map((file) => file.path), REQUIRED_FILES)) throw new Error('native game recipe file set drifted');
  const seen = new Set(), maxFile = request.resources.maxFileBytes;
  let total = 0;
  files.forEach((file) => { const key = Core.pathKey(file.path); if (seen.has(key)) throw new Error('candidate file path collision'); seen.add(key); const bytes = Buffer.from(file.content, 'base64'); if (bytes.length > maxFile) throw new Error('candidate file exceeds byte ceiling: ' + file.path); if (hashBytes(bytes) !== file.sha256) throw new Error('candidate file digest mismatch'); total += bytes.length; });
  if (files.length > request.resources.maxFiles || total > request.resources.maxOutputBytes) throw new Error('candidate bundle exceeds file or output byte ceiling');
  return { candidate, config, project, bundle: { schema: MODULE_BUNDLE_SCHEMA, requiredSeats: 1, files }, totalBytes: total };
}

function generate(input) {
  const request = normalizeRequest(input);
  const built = buildBundle(request);
  const bundleBytes = jsonBytes(built.bundle);
  const sourceFiles = built.bundle.files.map((file) => { const bytes = Buffer.from(file.content, 'base64'); return { path: file.path, sha256: 'sha256:' + file.sha256, byteLength: bytes.length }; });
  const projectFile = sourceFiles.find((file) => file.path === 'game-forge-project.json');
  const testFile = sourceFiles.find((file) => file.path === 'test-plan.json');
  const core = {
    schema: PACKET_SCHEMA, version: VERSION, status: 'EXPERIMENTAL', candidate: built.candidate,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest },
    briefRef: { id: request.brief.id, schema: request.brief.schema, sha256: request.brief.briefDigest },
    generator: { id: GENERATOR_ID, version: VERSION, recipeId: RECIPE_ID, aiUsed: false },
    gameForgeProjectRef: { id: request.brief.id + '-game-forge-project', schema: 'axm.game-forge-project/v1', sha256: projectFile.sha256 },
    moduleBundle: built.bundle,
    moduleBundleRef: { id: built.candidate.id + '-module-bundle', schema: MODULE_BUNDLE_SCHEMA, sha256: 'sha256:' + hashBytes(bundleBytes), byteLength: bundleBytes.length },
    sourceFiles, testPlanRef: { id: built.candidate.id + '-test-plan', schema: 'axm.game-candidate-test-plan/v1', sha256: testFile.sha256 },
    rootsGate: clone(request.rootsGate), declaredAuthority: { permissions: [], networkDomains: [], lifecycleEffects: [] },
    resources: { fileCount: sourceFiles.length, sourceBytes: built.totalBytes, fileCountEnforced: true, fileBytesEnforced: true, totalBytesEnforced: true, candidateProcesses: 0 },
    reuseRights: clone(request.reuseRights), limitations: LIMITATIONS.slice(),
    truth: { deterministicBytes: true, gameCodeExecuted: false, runtimeBehaviorProven: false, visualBehaviorProven: false, playJourneyProven: false, persistenceProven: false, installed: false, integrated: false, lessonActive: false, promoted: false, canonChanged: false }, authority: 'NONE'
  };
  const packet = { ...core, packetDigest: hashValue(core) };
  const result = { request, packet, truth: { providerCalled: false, candidateCodeExecuted: false, workspaceWritten: false, networkUsed: false, installed: false, integrated: false, lessonActive: false, canonChanged: false } };
  if (jsonBytes(result).length > request.resources.maxOutputBytes) throw new Error('complete game generation result exceeds output byte ceiling');
  return result;
}

function verifyGeneration(result, input) {
  try { const rebuilt = generate(input); return { pass: same(result, rebuilt), errors: same(result, rebuilt) ? [] : ['result differs from deterministic rebuild'] }; }
  catch (error) { return { pass: false, errors: [error.message] }; }
}

function component(contract) { return { ref: { id: contract.id, schema: contract.schema, sha256: hashValue(contract) }, contract: clone(contract) }; }

function buildExampleRequest() {
  const brief = sealBrief({ schema: BRIEF_SCHEMA, id: 'four-roots-run', title: 'Four Roots Run', seed: 4024, recipeId: RECIPE_ID, difficulty: 'STANDARD', world: { width: 16, height: 10 }, theme: { background: '#050914', panel: '#0d1b2a', wall: '#26384a', path: '#174a5b', player: '#39dff2', accent: '#ffcf5a', text: '#f4f8ff' }, accessibility: { touchTargetPx: 48, reducedMotionDefault: true, highContrast: true }, session: { persistence: 'SESSION_ONLY', network: 'DISABLED', players: 1 }, authority: 'NONE' });
  const contracts = loadRequiredComponentContracts();
  const decisionRef = { id: 'mike-bounded-game-sandbox-authorization', schema: 'axm.explicit-human-direction/v1', sha256: hashValue('Mike authorized bounded sandbox build, preview, repair, and candidate learning; installation remains gated.') };
  const rootsGate = ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'four-roots-run-' + root, schema: 'axm.four-root-technical-review/v1', sha256: hashValue('four-roots-run-' + root) }] }));
  return sealRequest({ schema: REQUEST_SCHEMA, id: 'generate-four-roots-run', goal: 'Generate one deterministic, detached, single-player web game candidate that carries AXM’s four roots to a visible Workshop exit.', brief, components: REQUIRED_COMPONENT_IDS.map((key) => component(contracts[key])), rootsGate, authorization: { schema: 'axm.bounded-sandbox-growth-authorization/v1', decisionRef, scope: 'GENERATE_BUILD_PREVIEW_REPAIR_AND_LESSON_CANDIDATES', generate: true, sandboxBuild: true, sandboxPreview: true, sandboxRepair: true, lessonCandidate: true, maxIterations: 3, install: false, integrate: false, publish: false, promote: false, canon: false, authenticatedIdentityProven: false, authority: 'NONE' }, resources: { maxInputBytes: 1048576, maxOutputBytes: 2097152, maxFileBytes: 262144, maxFiles: 16, maxIterations: 3, maxCandidateProcesses: 0, maxCostMinorUnits: 0 }, reuseRights: { state: 'RESEARCH_ONLY_HOLD', directReuseAllowed: false, authorityRef: null }, authority: 'NONE' });
}

module.exports = { VERSION, BRIEF_SCHEMA, REQUEST_SCHEMA, PACKET_SCHEMA, RECIPE_ID, GENERATOR_ID, ROOTS, REQUIRED_COMPONENT_IDS, REQUIRED_FILES, LIMITATIONS, clone, hashValue, jsonBytes, sealBrief, normalizeBrief, sealRequest, normalizeRequest, loadRequiredComponentContracts, buildMap, buildBundle, generate, verifyGeneration, buildExampleRequest };
