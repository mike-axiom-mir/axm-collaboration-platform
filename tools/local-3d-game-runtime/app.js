import { NativeWebGL2Renderer } from './native-renderer.mjs';
import { composeTRS } from './native-math.mjs';
import { FIXED_DELTA, createGameState, startGame, stepGame, togglePause } from './runtime-core.mjs';

const canvas = document.querySelector('#game-canvas');
const loadingPanel = document.querySelector('#loading-panel');
const loadingTitle = document.querySelector('#loading-title');
const loadingDetail = document.querySelector('#loading-detail');
const startButton = document.querySelector('#start-button');
const pauseButton = document.querySelector('#pause-button');
const resetButton = document.querySelector('#reset-button');
const replayButton = document.querySelector('#replay-button');
const lightButton = document.querySelector('#light-button');
const qualitySelect = document.querySelector('#quality-select');
const outcome = document.querySelector('#outcome');
const outcomeCopy = document.querySelector('#outcome-copy');
const beaconList = document.querySelector('#beacon-list');
const beaconCount = document.querySelector('#beacon-count');
const missionProgress = document.querySelector('#mission-progress');
const runtimeState = document.querySelector('#runtime-state');
const runtimeLight = document.querySelector('#runtime-light');
const positionValue = document.querySelector('#position-value');
const fpsValue = document.querySelector('#fps-value');
const drawValue = document.querySelector('#draw-value');
const triangleValue = document.querySelector('#triangle-value');
const tickValue = document.querySelector('#tick-value');
const assetList = document.querySelector('#asset-list');
const assetTotal = document.querySelector('#asset-total');
const cellTotal = document.querySelector('#cell-total');
const cellList = document.querySelector('#cell-list');
const cellSha = document.querySelector('#cell-sha');

let renderer;
let game = createGameState();
let ready = false;
let night = false;
let cameraYaw = Math.PI;
let cameraPitch = 0.28;
let cameraDistance = 9.6;
let dragging = false;
let lastPointer = [0, 0];
let lastTime = performance.now();
let accumulator = 0;
let fpsClock = performance.now();
let frameCount = 0;
let lastStats = { draws: 0, triangles: 0 };
const keys = new Set();
const bufferedUntil = new Map();

const assetSpecs = [
  {
    id: 'district-storefront',
    url: '../ps2-asset-forge/proof/exports/storefront-technical-proof.glb',
    transform: composeTRS([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]),
    digest: 'AFCB7802418930DEE6F8B7A410F1C78CE401D4C6F8B728336E99F62458237222'
  },
  {
    id: 'animated-pedestrian',
    url: '../ps2-asset-forge/proof/exports/animated-pedestrian.glb',
    transform: composeTRS([2.5, 0, 3.7], [0, 0, 0, 1], [1, 1, 1]),
    animationPattern: /Man_Idle$/,
    digest: 'B448863767B1A770D70EFD45F04DDDF1BBA93B7855D1DBA7A9A6456115685D63'
  },
  {
    id: 'modular-commercial-building',
    url: '../ps2-asset-forge/assets/kenney/city-commercial/models/building-g.glb',
    transform: composeTRS([-4.5, 0, 2.2], [0, Math.sin(-0.16), 0, Math.cos(-0.16)], [2.2, 2.2, 2.2]),
    digest: '9A28FA2FDFAC07492EE95589882213CFD6EB32D6752CB3B2F5404604C676D27A',
    externalTextureDigests: { 'Textures/colormap.png': '191BEC3889AAACA5018380038FECC129EBB5C2182879A099B7B538B3FA050B5D' }
  },
  {
    id: 'street-hatchback',
    url: '../ps2-asset-forge/assets/kenney/car-kit/models/hatchback-sports.glb',
    transform: composeTRS([3.8, 0, 3.1], [0, Math.sin(0.45), 0, Math.cos(0.45)], [0.9, 0.9, 0.9]),
    digest: 'BD5C9D4C3B4BDD254A66B8426563A68B1487AE7A5076DF3A2488E6FFED7BE64F',
    externalTextureDigests: { 'Textures/colormap.png': 'F3622A03A20C6696065CAE9CBE391351BE873508AF190C2EBD1D420C055787A5' }
  },
  {
    id: 'distance-tree',
    url: '../ps2-asset-forge/assets/kenney/retro-urban/models/tree-large.glb',
    transform: composeTRS([-3.4, 0, 5.3], [0, 0, 0, 1], [1.45, 1.45, 1.45]),
    digest: '2B17134078E452CFD4A074FD628E86DE0789F71E5215D6111FCFC98B15F3FD0C',
    externalTextureDigests: { 'Textures/treeA.png': '8445833D6AEF70E984BC8BEAE80389F407FE7CAF556D4909DA965E8919E36B0A' }
  }
];

function inputState() {
  const now = performance.now();
  const active = (code) => keys.has(code) || (bufferedUntil.get(code) || 0) > now;
  const forward = (active('KeyW') || active('ArrowUp') ? 1 : 0) - (active('KeyS') || active('ArrowDown') ? 1 : 0);
  const right = (active('KeyD') || active('ArrowRight') ? 1 : 0) - (active('KeyA') || active('ArrowLeft') ? 1 : 0);
  return { forward, right, sprint: active('ShiftLeft') || active('ShiftRight'), yaw: cameraYaw };
}

function cameraState() {
  const horizontal = Math.cos(cameraPitch) * cameraDistance;
  const target = [game.player.x, 1.05, game.player.z];
  return {
    target,
    eye: [
      target[0] - Math.sin(cameraYaw) * horizontal,
      target[1] + Math.sin(cameraPitch) * cameraDistance + 1.15,
      target[2] - Math.cos(cameraYaw) * horizontal
    ],
    fov: 47
  };
}

function renderBeaconList() {
  beaconList.replaceChildren(...game.beacons.map((beacon) => {
    const item = document.createElement('li');
    item.textContent = beacon.id.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
    item.className = beacon.collected ? 'done' : '';
    return item;
  }));
}

function updateHud() {
  const collected = game.beacons.filter((beacon) => beacon.collected).length;
  beaconCount.textContent = `${collected} / ${game.beacons.length}`;
  missionProgress.style.width = `${collected / game.beacons.length * 100}%`;
  tickValue.textContent = game.tick.toLocaleString('en-US');
  drawValue.textContent = String(lastStats.draws || 0);
  triangleValue.textContent = (lastStats.triangles || 0).toLocaleString('en-US');
  runtimeState.textContent = game.phase.toUpperCase();
  positionValue.textContent = `POS ${game.player.x >= 0 ? '+' : ''}${game.player.x.toFixed(1)} / ${game.player.z >= 0 ? '+' : ''}${game.player.z.toFixed(1)}`;
  canvas.dataset.phase = game.phase;
  canvas.dataset.tick = String(game.tick);
  canvas.dataset.playerX = game.player.x.toFixed(6);
  canvas.dataset.playerZ = game.player.z.toFixed(6);
  canvas.dataset.beacons = String(collected);
  runtimeLight.className = game.phase === 'playing' ? 'live' : game.phase === 'paused' ? 'paused' : '';
  startButton.textContent = game.phase === 'ready' ? 'Start patrol' : game.phase === 'paused' ? 'Resume patrol' : 'Patrol active';
  startButton.disabled = !ready || game.phase === 'playing' || game.phase === 'complete';
  pauseButton.disabled = !ready || !['playing', 'paused'].includes(game.phase);
  pauseButton.textContent = game.phase === 'paused' ? 'Resume' : 'Pause';
  renderBeaconList();
  if (game.phase === 'complete' && outcome.hidden) {
    outcome.hidden = false;
    outcomeCopy.textContent = `All three markers verified in ${(game.outcome.elapsed).toFixed(1)} seconds and ${game.outcome.ticks.toLocaleString('en-US')} deterministic ticks.`;
  }
}

function reset() {
  game = createGameState();
  cameraYaw = Math.PI;
  cameraPitch = 0.28;
  cameraDistance = 9.6;
  accumulator = 0;
  outcome.hidden = true;
  updateHud();
  canvas.focus();
}

function startOrResume() {
  if (!ready) return;
  game = game.phase === 'paused' ? togglePause(game) : startGame(game);
  updateHud();
  canvas.focus();
}

function pauseOrResume() {
  game = togglePause(game);
  updateHud();
  canvas.focus();
}

function showAssets() {
  const summaries = renderer.summaries();
  assetTotal.textContent = `${summaries.length} local`;
  assetList.replaceChildren(...summaries.map((summary, index) => {
    const spec = assetSpecs[index];
    const card = document.createElement('article');
    card.className = 'asset-card';
    const externalTextures = summary.externalTextures?.length || 0;
    const embeddedImages = Math.max(0, summary.images - externalTextures);
    const textureEvidence = externalTextures ? `${embeddedImages} embedded · ${externalTextures} digest-bound local texture${externalTextures === 1 ? '' : 's'}` : `${embeddedImages} embedded image${embeddedImages === 1 ? '' : 's'}`;
    card.innerHTML = `<strong>${summary.id}</strong><span>${summary.meshes} meshes · ${summary.materials} materials · ${textureEvidence}</span><span>${summary.animations} clips · ${summary.skins} skins${summary.animation ? ` · ${summary.animation}` : ''}</span><code>SHA256 ${spec.digest}</code>`;
    return card;
  }));
}

async function loadProductionCell() {
  const response = await fetch('./p0-production-cell.json');
  if (!response.ok) throw new Error(`P0 production cell: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  const cell = JSON.parse(new TextDecoder().decode(bytes));
  if (cell.schema !== 'axm.p0-production-cell/v1' || cell.modules.length !== 10 || new Set(cell.modules.map(module => module.id)).size !== 10) throw new Error('P0 production cell contract is incomplete.');
  cellTotal.textContent = `${cell.modules.length} / 10 connected`;
  cellList.replaceChildren(...cell.modules.map(module => {
    const item = document.createElement('div');
    item.className = 'cell-item';
    item.innerHTML = `<strong>${String(module.rank).padStart(2,'0')} · ${module.id}</strong><span>${module.state.replaceAll('-', ' ')}</span>`;
    return item;
  }));
  cellSha.textContent = `CELL SHA256 ${sha256}`;
  document.body.dataset.productionCellStatus = cell.status;
  document.body.dataset.productionCellModules = String(cell.modules.length);
  document.body.dataset.productionCellSha256 = sha256;
}

function fail(error) {
  ready = false;
  loadingPanel.hidden = false;
  loadingPanel.classList.add('error');
  loadingTitle.textContent = 'Runtime stopped honestly';
  loadingDetail.textContent = error instanceof Error ? error.message : String(error);
  startButton.disabled = true;
  console.error(error);
}

async function initialise() {
  try {
    renderer = new NativeWebGL2Renderer(canvas);
    if (!renderer.available) throw new Error(renderer.reason);
    renderer.setQualityPreset(qualitySelect.value);
    canvas.dataset.renderPreset = qualitySelect.value;
    loadingTitle.textContent = 'Loading local district';
    for (let index = 0; index < assetSpecs.length; index += 1) {
      loadingDetail.textContent = `${index + 1} / ${assetSpecs.length} · ${assetSpecs[index].id}`;
      await renderer.loadAsset(assetSpecs[index]);
    }
    await loadProductionCell();
    showAssets();
    ready = true;
    loadingPanel.hidden = true;
    updateHud();
    canvas.focus();
  } catch (error) {
    fail(error);
  }
}

function frame(now) {
  const frameDelta = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  if (ready) {
    accumulator += frameDelta;
    while (accumulator >= FIXED_DELTA) {
      game = stepGame(game, inputState(), FIXED_DELTA);
      accumulator -= FIXED_DELTA;
    }
    try {
      lastStats = renderer.render({ gameState: game, camera: cameraState(), time: game.elapsed, night });
    } catch (error) {
      fail(error);
    }
    frameCount += 1;
    if (now - fpsClock >= 500) {
      fpsValue.textContent = Math.round(frameCount * 1000 / (now - fpsClock)).toLocaleString('en-US');
      frameCount = 0;
      fpsClock = now;
      updateHud();
    }
  }
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (/^(Key[WASD]|Arrow(?:Up|Down|Left|Right)|Shift(?:Left|Right))$/.test(event.code)) bufferedUntil.set(event.code, performance.now() + 120);
  if (event.code === 'KeyP' && !event.repeat) pauseOrResume();
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', (event) => { dragging = true; lastPointer = [event.clientX, event.clientY]; canvas.setPointerCapture(event.pointerId); });
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  cameraYaw -= (event.clientX - lastPointer[0]) * 0.006;
  cameraPitch = Math.max(0.08, Math.min(0.72, cameraPitch + (event.clientY - lastPointer[1]) * 0.004));
  lastPointer = [event.clientX, event.clientY];
});
canvas.addEventListener('pointerup', (event) => { dragging = false; canvas.releasePointerCapture(event.pointerId); });
canvas.addEventListener('wheel', (event) => { event.preventDefault(); cameraDistance = Math.max(4.5, Math.min(15, cameraDistance + event.deltaY * 0.008)); }, { passive: false });
startButton.addEventListener('click', startOrResume);
pauseButton.addEventListener('click', pauseOrResume);
resetButton.addEventListener('click', reset);
replayButton.addEventListener('click', reset);
lightButton.addEventListener('click', () => {
  night = !night;
  lightButton.textContent = night ? '☀ Day' : '☾ Night';
  lightButton.setAttribute('aria-pressed', String(night));
});
qualitySelect.addEventListener('change', () => {
  renderer?.setQualityPreset(qualitySelect.value);
  canvas.dataset.renderPreset = qualitySelect.value;
  canvas.focus();
});

window.__AXM_LOCAL_3D_RUNTIME__ = {
  getState: () => structuredClone(game),
  getEvidence: () => ({ assets: renderer?.summaries() || [], stats: { ...lastStats }, quality: renderer?.qualityEvidence() || null, ready, night }),
  start: startOrResume,
  pause: pauseOrResume,
  reset
};

reset();
requestAnimationFrame(frame);
initialise();
