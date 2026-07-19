import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { GLTFExporter } from './vendor/GLTFExporter.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';
import { buildHandoff, createRecipe } from './forge-core.mjs';
import { LocalPostProcess } from './post-process.mjs';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const dom = {
  canvas: $('#viewport'),
  loading: $('#loading-card'),
  loadingStatus: $('#loading-status'),
  runtimeStatus: $('#runtime-status'),
  targetGrid: $('#target-grid'),
  seed: $('#seed'),
  palette: $('#palette'),
  wear: $('#wear'),
  wearValue: $('#wear-value'),
  density: $('#density'),
  densityValue: $('#density-value'),
  forge: $('#forge'),
  shuffleSeed: $('#shuffle-seed'),
  usedList: $('#used-list'),
  usedCount: $('#used-count'),
  viewportTitle: $('#viewport-title'),
  statTriangles: $('#stat-triangles'),
  statMaterials: $('#stat-materials'),
  statAnimations: $('#stat-animations'),
  statDraws: $('#stat-draws'),
  catalogTotal: $('#catalog-total'),
  catalogTris: $('#catalog-tris'),
  catalogAnimated: $('#catalog-animated'),
  search: $('#asset-search'),
  kindFilter: $('#kind-filter'),
  library: $('#asset-library'),
  renderProfile: $('#render-profile'),
  resetCamera: $('#reset-camera'),
  exportRecipe: $('#export-recipe'),
  exportGlb: $('#export-glb'),
  receiptStatus: $('#receipt-status'),
  receiptDot: $('.receipt-dot'),
  recipeId: $('#recipe-id'),
  reject: $('#reject-candidate'),
  approve: $('#approve-candidate')
};

const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const postProcess = new LocalPostProcess(renderer, 'native');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#172331');
scene.fog = new THREE.Fog('#172331', 20, 52);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 180);
const controls = new OrbitControls(camera, dom.canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.2;
controls.maxDistance = 55;

const hemisphere = new THREE.HemisphereLight('#bcd7ef', '#283023', 2.0);
const sun = new THREE.DirectionalLight('#fff0d4', 4.2);
sun.position.set(9, 13, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 50;
sun.shadow.bias = -0.0004;
scene.add(hemisphere, sun);

let environmentRoot = new THREE.Group();
let exportRoot = new THREE.Group();
scene.add(environmentRoot, exportRoot);

const loader = new GLTFLoader();
const exporter = new GLTFExporter();
const sourceCache = new Map();
const mixers = [];
const usedSources = new Map();
let currentAnimations = [];
let catalog;
let catalogById;
let currentRecipe = createRecipe();
let buildSerial = 0;
let lightingMode = 'day';
let inspectedAsset = null;

const targetTitles = {
  street: 'Street quality benchmark',
  storefront: 'Storefront asset candidate',
  vehicle: 'Vehicle asset candidate',
  pedestrian: 'Animated pedestrian candidate'
};

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
}

function setStatus(message) {
  dom.runtimeStatus.textContent = message;
}

function setRenderProfile(id) {
  const profile = postProcess.setProfile(id);
  dom.renderProfile.value = profile.id;
  setStatus(`${profile.label} renderer active · asset target remains PS2 until human approval`);
}

function showLoading(message = 'Loading texture-aware GLB sources…') {
  dom.loadingStatus.textContent = message;
  dom.loading.classList.remove('hidden');
}

function hideLoading() {
  dom.loading.classList.add('hidden');
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function resetCandidateGate(message = 'Candidate has not been judged') {
  dom.receiptDot.className = 'receipt-dot pending';
  dom.receiptStatus.textContent = message;
  dom.exportGlb.disabled = true;
  dom.exportGlb.title = 'Approve the visible candidate before exporting it';
}

function setCandidateGate(verdict) {
  dom.receiptDot.className = `receipt-dot ${verdict}`;
  dom.receiptStatus.textContent = verdict === 'approved'
    ? 'Human visual gate: candidate approved'
    : 'Human visual gate: rejected — return to forge';
  dom.exportGlb.disabled = verdict !== 'approved';
  dom.exportGlb.title = verdict === 'approved'
    ? 'Export this reviewed candidate'
    : 'Rejected previews cannot be exported';
}

function resetRoots() {
  scene.remove(environmentRoot, exportRoot);
  environmentRoot = new THREE.Group();
  environmentRoot.name = 'AXM_VIEWPORT_ENVIRONMENT_NOT_EXPORTED';
  exportRoot = new THREE.Group();
  exportRoot.name = 'AXM_PS2_ASSET_CANDIDATE';
  scene.add(environmentRoot, exportRoot);
  mixers.splice(0, mixers.length);
  currentAnimations = [];
  usedSources.clear();
  inspectedAsset = null;
}

function resetCamera(target = currentRecipe.target) {
  const presets = {
    street: { position: [12.8, 5.6, 14.8], target: [0, 1.65, -1.1] },
    storefront: { position: [8.4, 4.4, 9.8], target: [0, 2.0, 0.1] },
    vehicle: { position: [6.8, 3.8, 7.7], target: [0, 1, 0] },
    pedestrian: { position: [4.1, 2.9, 5.1], target: [0, 1, 0] },
    inspect: { position: [5.5, 4.0, 7], target: [0, 1, 0] }
  };
  const preset = presets[target] || presets.inspect;
  camera.position.fromArray(preset.position);
  controls.target.fromArray(preset.target);
  controls.update();
}

function setLighting(mode) {
  lightingMode = mode;
  $$('.chip[data-lighting]').forEach((button) => button.classList.toggle('active', button.dataset.lighting === mode));
  const palette = currentRecipe.palette;
  if (mode === 'night') {
    scene.background.set('#07101f');
    scene.fog.color.set('#07101f');
    hemisphere.color.set('#5c7daf');
    hemisphere.groundColor.set('#090b13');
    hemisphere.intensity = 0.85;
    sun.color.set('#93adce');
    sun.intensity = 1.4;
    renderer.toneMappingExposure = 1.2;
  } else {
    scene.background.set(palette.sky);
    scene.fog.color.set(palette.sky);
    hemisphere.color.set('#c5dcf0');
    hemisphere.groundColor.set('#3a402f');
    hemisphere.intensity = 2.05;
    sun.color.set('#fff0d2');
    sun.intensity = 4.15;
    renderer.toneMappingExposure = 1.1;
  }
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material?.userData.axmSignMaterial) {
        material.emissiveIntensity = mode === 'night' ? 1.2 : 0.18;
      }
      if (material?.userData.axmWindowMaterial) {
        material.emissiveIntensity = mode === 'night' ? 0.85 : 0.12;
      }
    }
  });
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.04,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1
  });
}

function addBox(parent, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.fromArray(position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function surfaceTexture(kind, recipe, repeat = [1, 1]) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const random = seededRandom(`${recipe.seed}:${kind}:${recipe.wear}`);
  const image = context.createImageData(size, size);
  const base = kind === 'asphalt' ? [43, 46, 45] : [117, 113, 104];
  const spread = kind === 'asphalt' ? 19 : 24;
  for (let pixel = 0; pixel < image.data.length; pixel += 4) {
    const grain = (random() - 0.5) * spread;
    image.data[pixel] = base[0] + grain;
    image.data[pixel + 1] = base[1] + grain;
    image.data[pixel + 2] = base[2] + grain * 0.85;
    image.data[pixel + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  context.globalAlpha = 0.08 + recipe.wear / 700;
  for (let mark = 0; mark < 28 + recipe.wear; mark += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 2 + random() * (kind === 'asphalt' ? 32 : 18);
    context.fillStyle = random() > 0.5 ? '#111817' : '#b4aa90';
    context.beginPath();
    context.ellipse(x, y, radius, radius * (0.18 + random() * 0.5), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 0.35 + recipe.wear / 210;
  context.strokeStyle = kind === 'asphalt' ? '#111716' : '#4b4943';
  context.lineWidth = 1.2;
  for (let crack = 0; crack < Math.floor(2 + recipe.wear / 12); crack += 1) {
    let x = random() * size;
    let y = random() * size;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 5; segment += 1) {
      x += (random() - 0.5) * 44;
      y += 12 + random() * 28;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  if (kind === 'concrete') {
    context.globalAlpha = 0.3;
    context.strokeStyle = '#d1c9b7';
    context.lineWidth = 2;
    for (let line = 0; line <= size; line += 128) {
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line, size);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.userData = { axmGenerated: true, kind, seed: recipe.seed, wear: recipe.wear };
  return texture;
}

function surfaceMaterial(kind, recipe, repeat) {
  return new THREE.MeshStandardMaterial({
    map: surfaceTexture(kind, recipe, repeat),
    color: '#ffffff',
    roughness: kind === 'asphalt' ? 0.97 : 0.91,
    metalness: 0
  });
}

function brickTexture(recipe, repeat = [3, 1]) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const random = seededRandom(`${recipe.seed}:brick:${recipe.wear}`);
  context.fillStyle = '#b4a38d';
  context.fillRect(0, 0, 512, 512);
  const brickWidth = 64;
  const brickHeight = 32;
  for (let row = -1; row < 17; row += 1) {
    const offset = row % 2 ? -brickWidth / 2 : 0;
    for (let column = -1; column < 10; column += 1) {
      const red = Math.round(105 + random() * 55);
      const green = Math.round(45 + random() * 28);
      const blue = Math.round(32 + random() * 22);
      context.fillStyle = `rgb(${red},${green},${blue})`;
      context.fillRect(column * brickWidth + offset + 2, row * brickHeight + 2, brickWidth - 4, brickHeight - 4);
      if (random() < recipe.wear / 125) {
        context.fillStyle = 'rgba(34,31,28,.28)';
        context.fillRect(column * brickWidth + offset + 5, row * brickHeight + 5, brickWidth - 10, brickHeight - 10);
      }
    }
  }
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, 'rgba(255,240,205,.10)');
  gradient.addColorStop(0.65, 'rgba(25,28,27,.03)');
  gradient.addColorStop(1, `rgba(19,26,24,${0.18 + recipe.wear / 280})`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  for (let stain = 0; stain < 8 + recipe.wear / 8; stain += 1) {
    context.fillStyle = `rgba(20,28,25,${0.025 + random() * 0.08})`;
    context.beginPath();
    context.ellipse(random() * 512, random() * 512, 12 + random() * 50, 5 + random() * 20, random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.userData = { axmGenerated: true, kind: 'weathered-brick', seed: recipe.seed, wear: recipe.wear };
  return texture;
}

function addFacadeShell(parent, recipe, { width, height, position, doorX = 0, windowXs = [] }) {
  const brick = new THREE.MeshStandardMaterial({ map: brickTexture(recipe, [Math.max(1, width / 2), 1]), roughness: 0.93 });
  addBox(parent, [width, height, 0.18], position, brick);
  const z = position[2] + 0.105;
  const glass = new THREE.MeshStandardMaterial({ color: '#173744', roughness: 0.2, metalness: 0.22, emissive: '#b56831', emissiveIntensity: lightingMode === 'night' ? 0.85 : 0.12, transparent: true, opacity: 0.78 });
  glass.userData.axmWindowMaterial = true;
  const interior = new THREE.MeshStandardMaterial({ color: '#5e321e', roughness: 0.8, emissive: '#c07238', emissiveIntensity: lightingMode === 'night' ? 0.7 : 0.08 });
  interior.userData.axmWindowMaterial = true;
  const frame = makeMaterial('#3c4548', { roughness: 0.58, metalness: 0.28 });
  const darkFrame = makeMaterial('#2b3133', { roughness: 0.58, metalness: 0.32 });
  for (const x of windowXs) {
    addBox(parent, [1.3, 1.07, 0.045], [x, position[1] + 0.03, z - 0.02], interior);
    addBox(parent, [1.42, 1.18, 0.08], [x, position[1] + 0.03, z], glass);
    addBox(parent, [1.62, 0.09, 0.13], [x, position[1] + 0.64, z + 0.015], frame);
    addBox(parent, [1.62, 0.09, 0.13], [x, position[1] - 0.58, z + 0.015], frame);
    addBox(parent, [0.09, 1.3, 0.13], [x - 0.76, position[1] + 0.03, z + 0.015], frame);
    addBox(parent, [0.09, 1.3, 0.13], [x + 0.76, position[1] + 0.03, z + 0.015], frame);
    addBox(parent, [0.055, 1.18, 0.14], [x, position[1] + 0.03, z + 0.025], darkFrame);
  }
  addBox(parent, [0.92, 1.72, 0.12], [doorX, position[1] - 0.08, z + 0.015], darkFrame);
  addBox(parent, [0.7, 1.15, 0.08], [doorX, position[1] + 0.11, z + 0.085], glass);
  addBox(parent, [0.055, 0.055, 0.15], [doorX + 0.3, position[1] - 0.35, z + 0.13], makeMaterial('#d3a24d', { metalness: 0.7, roughness: 0.25 }));
}

function addPoster(parent, { text, subtitle, position, rotationY = 0, color = '#c46b32', width = 0.8 }) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.fillStyle = '#d9c99e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.fillRect(18, 18, canvas.width - 36, canvas.height - 36);
  context.fillStyle = '#151a1a';
  context.fillRect(34, 36, canvas.width - 68, 270);
  context.fillStyle = '#f5e4b8';
  context.font = '900 56px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, 138);
  context.font = '800 22px monospace';
  context.fillStyle = '#151a1a';
  context.fillText(subtitle, canvas.width / 2, 385);
  context.strokeStyle = '#151a1a';
  context.lineWidth = 8;
  context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2 });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 1.34), material);
  poster.position.fromArray(position);
  poster.rotation.y = rotationY;
  poster.castShadow = true;
  poster.userData.axmGeneratedPart = 'editable-poster-decal';
  parent.add(poster);
  return poster;
}

function buildStage(kind) {
  const asphalt = surfaceMaterial('asphalt', currentRecipe, [6, 2]);
  const concrete = surfaceMaterial('concrete', currentRecipe, [7, 2]);
  const curb = makeMaterial('#a4a092', { roughness: 0.9 });
  if (kind === 'street') {
    addBox(exportRoot, [24, 0.18, 7.6], [0, -0.16, 0.4], asphalt);
    addBox(exportRoot, [24, 0.34, 3.1], [0, -0.04, -4.9], concrete);
    addBox(exportRoot, [24, 0.34, 2.2], [0, -0.04, 5.35], concrete);
    addBox(exportRoot, [24, 0.22, 0.16], [0, 0.13, -3.36], curb);
    addBox(exportRoot, [24, 0.22, 0.16], [0, 0.13, 4.22], curb);
    const line = makeMaterial('#d5c796', { roughness: 0.86 });
    for (let x = -10; x <= 10; x += 2.6) addBox(exportRoot, [1.35, 0.015, 0.1], [x, -0.055, 0.35], line);
    const crossing = makeMaterial('#c6c3b2', { roughness: 0.9 });
    for (let z = -2.7; z <= 3.4; z += 0.65) addBox(exportRoot, [1.55, 0.018, 0.34], [-8.8, -0.05, z], crossing);
  } else {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(kind === 'vehicle' ? 5.8 : 7.8, 64), concrete);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035;
    floor.receiveShadow = true;
    environmentRoot.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(kind === 'vehicle' ? 4.6 : 6.4, kind === 'vehicle' ? 4.64 : 6.44, 64), makeMaterial('#b38b4e', { metalness: 0.35 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.025;
    environmentRoot.add(ring);
  }
}

function getAsset(packId, name) {
  const asset = catalogById.get(`${packId}:${name}`);
  if (!asset) throw new Error(`Missing source asset ${packId}:${name}`);
  return asset;
}

async function sourceGltf(asset) {
  if (!sourceCache.has(asset.id)) {
    sourceCache.set(asset.id, loader.loadAsync(asset.model));
  }
  return sourceCache.get(asset.id);
}

function markRenderable(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    if (Array.isArray(node.material)) {
      node.material = node.material.map((material) => material.clone());
    } else if (node.material) {
      node.material = node.material.clone();
    }
  });
}

async function addSource(asset, options = {}) {
  dom.loadingStatus.textContent = `Loading ${asset.title}…`;
  const gltf = await sourceGltf(asset);
  const source = cloneSkeleton(gltf.scene);
  markRenderable(source);
  source.updateMatrixWorld(true);
  const firstBox = new THREE.Box3().setFromObject(source);
  const size = firstBox.getSize(new THREE.Vector3());
  let scale = 1;
  if (options.height) scale = options.height / Math.max(size.y, 0.0001);
  else if (options.length) scale = options.length / Math.max(size.x, size.z, 0.0001);
  else if (options.width) scale = options.width / Math.max(size.x, 0.0001);
  else if (options.maxSize) scale = options.maxSize / Math.max(size.x, size.y, size.z, 0.0001);
  source.scale.multiplyScalar(scale);
  source.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(source);
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  wrapper.name = `source__${asset.name}`;
  source.position.set(-center.x, -box.min.y, -center.z);
  wrapper.position.set(options.x || 0, options.y || 0, options.z || 0);
  wrapper.rotation.y = options.rotationY || 0;
  wrapper.add(source);
  exportRoot.add(wrapper);
  usedSources.set(asset.id, asset);

  if ((gltf.animations || []).length && options.animate !== false) {
    const mixer = new THREE.AnimationMixer(source);
    const preferred = gltf.animations.find((clip) => /idle/i.test(clip.name)) || gltf.animations[0];
    mixer.clipAction(preferred).play();
    mixers.push(mixer);
    currentAnimations.push(...gltf.animations);
  }
  return wrapper;
}

function makeSign(text, palette, width = 2.8) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  context.fillStyle = '#12171a';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = palette.accent;
  context.fillRect(12, 12, canvas.width - 24, canvas.height - 24);
  context.fillStyle = '#15120d';
  context.fillRect(24, 24, canvas.width - 48, canvas.height - 48);
  context.fillStyle = palette.sign;
  context.font = '800 70px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 - 3);
  context.font = '700 18px monospace';
  context.fillStyle = palette.accent;
  context.fillText('OPEN LATE  ·  LOCAL SOUND', canvas.width / 2, 157);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshStandardMaterial({ map: texture, emissive: new THREE.Color(palette.accent), emissiveMap: texture, emissiveIntensity: 0.18, roughness: 0.62 });
  material.userData.axmSignMaterial = true;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(width, width * 0.25, 0.11), material);
  sign.castShadow = true;
  sign.userData.axmGeneratedPart = 'editable-canvas-sign';
  return sign;
}

function addStreetMood() {
  const pole = makeMaterial('#343b3f', { metalness: 0.55, roughness: 0.55 });
  const glow = new THREE.MeshStandardMaterial({ color: '#fff0c2', emissive: '#ffb746', emissiveIntensity: lightingMode === 'night' ? 3 : 0.2, roughness: 0.35 });
  for (const x of [-8, 8]) {
    addBox(environmentRoot, [0.1, 4.6, 0.1], [x, 2.3, 3.7], pole);
    addBox(environmentRoot, [0.75, 0.1, 0.1], [x + (x < 0 ? .32 : -.32), 4.55, 3.7], pole);
    addBox(environmentRoot, [0.32, 0.12, 0.24], [x + (x < 0 ? .62 : -.62), 4.44, 3.7], glow);
  }
}

async function buildStreet(recipe) {
  buildStage('street');
  addStreetMood();
  const buildings = ['building-e', 'building-k', 'building-h'];
  await Promise.all([
    addSource(getAsset('kenney-city-commercial', buildings[0]), { height: 4.4, x: -6.2, z: -5.05 }),
    addSource(getAsset('kenney-city-commercial', buildings[1]), { height: 5.35, x: 0, z: -5.3 }),
    addSource(getAsset('kenney-city-commercial', buildings[2]), { height: 4.65, x: 6.35, z: -5.05 }),
    addSource(getAsset('kenney-car-kit', recipe.selections.vehicle), { length: 3.8, x: 1.15, z: 0.85, rotationY: -0.34 }),
    addSource(getAsset('kenney-retro-urban', 'truck-grey'), { length: 3.7, x: 8.35, z: 2.15, rotationY: Math.PI + 0.08 }),
    addSource(getAsset('quaternius-animated-men', recipe.selections.pedestrian), { height: 1.78, x: -2.0, z: 3.58, rotationY: 2.7 }),
    addSource(getAsset('quaternius-animated-men', recipe.selections.pedestrian === 'man-in-suit' ? 'man-casual-a' : 'man-in-suit'), { height: 1.76, x: 4.15, z: -3.05, rotationY: 0.45 }),
    addSource(getAsset('kenney-retro-urban', 'detail-bench'), { width: 1.7, x: -5.35, z: -3.15, rotationY: Math.PI }),
    addSource(getAsset('kenney-retro-urban', recipe.wear > 45 ? 'detail-dumpster-open' : 'detail-dumpster-closed'), { maxSize: 1.35, x: 6.7, z: -3.35, rotationY: Math.PI })
  ]);
  addFacadeShell(exportRoot, recipe, { width: 5.5, height: 1.78, position: [0, 0.89, -2.88], doorX: 0, windowXs: [-1.75, 1.75] });
  if (recipe.density >= 3) {
    await Promise.all([
      addSource(getAsset('kenney-retro-urban', 'detail-barrier-strong-damaged'), { width: 1.7, x: -7.1, z: 2.9, rotationY: 0.2 }),
      addSource(getAsset('kenney-city-roads', 'construction-cone'), { height: 0.55, x: -0.9, z: 2.5 }),
      addSource(getAsset('kenney-city-roads', 'construction-cone'), { height: 0.55, x: -0.25, z: 2.65 })
    ]);
  }
  const sign = makeSign('AXM RECORDS', recipe.palette, 2.35);
  sign.position.set(-5.6, 2.55, -2.92);
  sign.rotation.y = 0;
  sign.material.userData.axmSignMaterial = true;
  exportRoot.add(sign);
  addPoster(exportRoot, { text: 'LIVE', subtitle: 'FRI 22:00', position: [-1.75, 1.1, -2.63], color: '#9a3c32', width: 0.66 });
}

async function buildStorefront(recipe) {
  buildStage('storefront');
  await addSource(getAsset('kenney-city-commercial', 'building-k'), { height: 4.85, z: -0.62 });
  addFacadeShell(exportRoot, recipe, { width: 6.05, height: 2.05, position: [0, 1.02, 0.94], doorX: 0, windowXs: [-1.8, 1.8] });
  const awning = await addSource(getAsset('kenney-retro-urban', 'detail-awning-wide'), { width: 2.75, y: 1.6, z: 1.02 });
  awning.userData.role = 'swappable-awning';
  const sign = makeSign('NIGHT MARKET', recipe.palette, 2.65);
  sign.position.set(0, 2.75, 1.08);
  sign.material.userData.axmSignMaterial = true;
  exportRoot.add(sign);
  await Promise.all([
    addSource(getAsset('kenney-retro-urban', 'detail-bench'), { width: 1.45, x: -3.15, z: 1.45, rotationY: Math.PI }),
    addSource(getAsset('kenney-retro-urban', recipe.wear > 50 ? 'detail-barrier-strong-damaged' : 'pallet-small'), { maxSize: 0.8, x: 3.1, z: 1.32, rotationY: Math.PI / 2 }),
    addSource(getAsset('kenney-retro-urban', 'detail-light-single'), { height: 0.65, x: -1.85, y: 2.55, z: 1.07 }),
    addSource(getAsset('kenney-retro-urban', 'detail-light-single'), { height: 0.65, x: 1.85, y: 2.55, z: 1.07 })
  ]);
  addPoster(exportRoot, { text: 'NOISE', subtitle: 'LOCAL / 04.05', position: [-2.62, 1.05, 1.08], color: '#315b63', width: 0.54 });
  addPoster(exportRoot, { text: 'SALE', subtitle: 'OPEN LATE', position: [2.62, 1.05, 1.08], color: '#9f4d31', width: 0.54 });
  if (recipe.density >= 3) {
    await addSource(getAsset('quaternius-animated-men', 'man-casual-b'), { height: 1.76, x: 1.55, z: 3.2, rotationY: Math.PI });
  }
}

async function buildVehicle(recipe) {
  buildStage('vehicle');
  const vehicle = await addSource(getAsset('kenney-car-kit', recipe.selections.vehicle), { length: 4.5, rotationY: -0.55 });
  vehicle.userData.role = 'primary-vehicle-body';
  if (recipe.wear >= 45) {
    await addSource(getAsset('kenney-car-kit', 'debris-bumper'), { width: 1.5, x: -2.3, z: 1.0, rotationY: 0.35 });
  }
  if (recipe.wear >= 72) {
    await addSource(getAsset('kenney-car-kit', 'debris-tire'), { height: 0.65, x: 2.2, z: -0.7, rotationY: 0.8 });
  }
  for (let i = 0; i < recipe.density; i += 1) {
    await addSource(getAsset('kenney-city-roads', 'construction-cone'), { height: 0.48, x: -2.1 + i * 1.35, z: -2.0 - (i % 2) * 0.3 });
  }
}

async function buildPedestrian(recipe) {
  buildStage('pedestrian');
  await addSource(getAsset('quaternius-animated-men', recipe.selections.pedestrian), { height: 1.82, x: 0, z: 0 });
  const support = ['man-casual-a', 'man-casual-b', 'man-long-sleeves', 'man-in-suit'].filter((name) => name !== recipe.selections.pedestrian);
  if (recipe.density >= 2) await addSource(getAsset('quaternius-animated-men', support[0]), { height: 1.76, x: -1.55, z: 1.05, rotationY: 0.18 });
  if (recipe.density >= 3) await addSource(getAsset('quaternius-animated-men', support[1]), { height: 1.73, x: 1.55, z: 1.15, rotationY: -0.24 });
  if (recipe.density >= 4) await addSource(getAsset('quaternius-animated-men', support[2]), { height: 1.86, x: 0.25, z: 2.15, rotationY: Math.PI });
}

function renderUsedSources() {
  dom.usedCount.textContent = String(usedSources.size);
  if (!usedSources.size) {
    dom.usedList.innerHTML = '<p class="muted">No source attached.</p>';
    return;
  }
  dom.usedList.innerHTML = Array.from(usedSources.values()).slice(0, 10).map((asset) => (
    `<div class="used-source" title="${asset.id}"><span>${asset.title}</span><span>${asset.license}</span></div>`
  )).join('');
}

function updateStats() {
  let triangles = 0;
  let draws = 0;
  const materials = new Set();
  exportRoot.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    draws += Array.isArray(node.material) ? node.material.length : 1;
    const indexCount = node.geometry.index ? node.geometry.index.count : node.geometry.attributes.position?.count || 0;
    triangles += Math.floor(indexCount / 3);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material) materials.add(material.uuid);
  });
  dom.statTriangles.textContent = formatNumber(triangles);
  dom.statMaterials.textContent = formatNumber(materials.size);
  dom.statAnimations.textContent = formatNumber(currentAnimations.length);
  dom.statDraws.textContent = formatNumber(draws);
}

async function forge(input = {}) {
  const serial = ++buildSerial;
  currentRecipe = createRecipe({
    target: input.target || currentRecipe.target,
    seed: dom.seed.value,
    palette: dom.palette.value,
    wear: dom.wear.value,
    density: dom.density.value
  });
  showLoading('Preparing editable source recipe…');
  resetRoots();
  resetCandidateGate();
  dom.recipeId.textContent = currentRecipe.id;
  dom.viewportTitle.textContent = targetTitles[currentRecipe.target];
  setStatus(`Forging ${currentRecipe.target} candidate locally…`);
  try {
    if (currentRecipe.target === 'street') await buildStreet(currentRecipe);
    if (currentRecipe.target === 'storefront') await buildStorefront(currentRecipe);
    if (currentRecipe.target === 'vehicle') await buildVehicle(currentRecipe);
    if (currentRecipe.target === 'pedestrian') await buildPedestrian(currentRecipe);
    if (serial !== buildSerial) return;
    setLighting(lightingMode);
    resetCamera(currentRecipe.target);
    renderUsedSources();
    updateStats();
    hideLoading();
    setStatus(`${usedSources.size} source parts composed · preview only exists in memory`);
  } catch (error) {
    console.error(error);
    dom.loadingStatus.textContent = `Build failed honestly: ${error.message}`;
    setStatus(`Forge failure: ${error.message}`);
  }
}

async function inspectSource(asset) {
  const serial = ++buildSerial;
  showLoading(`Opening ${asset.title}…`);
  resetRoots();
  inspectedAsset = asset;
  buildStage(asset.kind === 'vehicle' ? 'vehicle' : 'inspect');
  try {
    await addSource(asset, asset.kind === 'pedestrian' ? { height: 1.82 } : { maxSize: 4.2 });
    if (serial !== buildSerial) return;
    dom.viewportTitle.textContent = `Source inspection · ${asset.title}`;
    dom.recipeId.textContent = asset.id;
    resetCamera('inspect');
    renderUsedSources();
    updateStats();
    hideLoading();
    resetCandidateGate('Source inspection — not a forged candidate');
    setStatus(`${asset.title} loaded from local ${asset.license} source`);
  } catch (error) {
    dom.loadingStatus.textContent = `Source failed to load: ${error.message}`;
  }
}

function renderLibrary() {
  const query = dom.search.value.trim().toLowerCase();
  const kind = dom.kindFilter.value;
  const kindPriority = ['building', 'vehicle', 'pedestrian', 'road', 'urban-prop', 'foliage', 'storefront-part', 'street-light', 'road-prop', 'damage-part', 'building-part', 'vehicle-part', 'building-lod'];
  const results = catalog.assets.filter((asset) => (
    (kind === 'all' || asset.kind === kind) &&
    (!query || `${asset.title} ${asset.name} ${asset.kind} ${asset.provider}`.toLowerCase().includes(query))
  )).sort((a, b) => {
    const kindOrder = kindPriority.indexOf(a.kind) - kindPriority.indexOf(b.kind);
    if (kindOrder) return kindOrder;
    return (b.glb.triangles || 0) - (a.glb.triangles || 0) || a.title.localeCompare(b.title);
  }).slice(0, 80);
  dom.library.innerHTML = results.map((asset) => `
    <article class="asset-card" data-asset-id="${asset.id}" title="Inspect ${asset.title}">
      ${asset.preview ? `<img loading="lazy" src="${asset.preview}" alt="${asset.title} preview">` : '<div class="no-preview">3D</div>'}
      <div class="asset-meta"><b>${asset.title}</b><span><i>${asset.kind}</i><i>${formatNumber(asset.glb.triangles)} tris</i></span></div>
    </article>
  `).join('') || '<p class="muted">No matching source assets.</p>';
  dom.library.querySelectorAll('[data-asset-id]').forEach((card) => card.addEventListener('click', () => inspectSource(catalogById.get(card.dataset.assetId))));
}

function configureCatalogUi() {
  dom.catalogTotal.textContent = formatNumber(catalog.totals.assets);
  dom.catalogTris.textContent = formatNumber(catalog.totals.triangles);
  dom.catalogAnimated.textContent = formatNumber(catalog.totals.animatedAssets);
  for (const kind of Object.keys(catalog.kinds).sort()) {
    const option = document.createElement('option');
    option.value = kind;
    option.textContent = `${kind} (${catalog.kinds[kind]})`;
    dom.kindFilter.appendChild(option);
  }
  renderLibrary();
}

function exactSourceReceipts() {
  return Array.from(usedSources.values()).map((asset) => ({
    id: asset.id,
    provider: asset.provider,
    license: asset.license,
    sha256: asset.sha256,
    model: asset.model
  }));
}

async function exportGlb() {
  if (!exportRoot.children.length || dom.exportGlb.disabled) return;
  showLoading('Compiling the visible candidate to binary GLTF…');
  try {
    const data = await exporter.parseAsync(exportRoot, {
      binary: true,
      trs: true,
      onlyVisible: true,
      animations: currentAnimations,
      maxTextureSize: 1024
    });
    downloadBlob(new Blob([data], { type: 'model/gltf-binary' }), `${inspectedAsset ? inspectedAsset.name : currentRecipe.id}.glb`);
    hideLoading();
    setStatus(`Real GLB compiled in browser · ${formatNumber(data.byteLength)} bytes`);
  } catch (error) {
    console.error(error);
    dom.loadingStatus.textContent = `GLB export failed honestly: ${error.message}`;
    setStatus(`GLB export failure: ${error.message}`);
  }
}

function exportRecipe() {
  const sources = exactSourceReceipts();
  const payload = inspectedAsset
    ? { schema: 'axm.ps2-asset-forge.source-inspection/v1', source: sources[0], candidate: false }
    : { recipe: currentRecipe, handoff: buildHandoff(currentRecipe, sources) };
  downloadBlob(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }), `${inspectedAsset ? inspectedAsset.name : currentRecipe.id}.recipe.json`);
  setStatus('Editable recipe and exact source digests exported');
}

function bindUi() {
  dom.targetGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-target]');
    if (!button) return;
    $$('.target-card').forEach((card) => card.classList.toggle('active', card === button));
    forge({ target: button.dataset.target });
  });
  dom.wear.addEventListener('input', () => { dom.wearValue.textContent = `${dom.wear.value}%`; });
  dom.density.addEventListener('input', () => { dom.densityValue.textContent = `${dom.density.value} / 4`; });
  dom.forge.addEventListener('click', () => forge());
  dom.shuffleSeed.addEventListener('click', () => {
    dom.seed.value = `district-${Math.random().toString(36).slice(2, 8)}`;
    forge();
  });
  dom.search.addEventListener('input', renderLibrary);
  dom.kindFilter.addEventListener('change', renderLibrary);
  dom.resetCamera.addEventListener('click', () => resetCamera(inspectedAsset ? 'inspect' : currentRecipe.target));
  dom.exportRecipe.addEventListener('click', exportRecipe);
  dom.exportGlb.addEventListener('click', exportGlb);
  dom.reject.addEventListener('click', () => setCandidateGate('rejected'));
  dom.approve.addEventListener('click', () => setCandidateGate('approved'));
  dom.renderProfile.addEventListener('change', () => setRenderProfile(dom.renderProfile.value));
  $$('.chip[data-lighting]').forEach((button) => button.addEventListener('click', () => setLighting(button.dataset.lighting)));
}

function resize() {
  const rect = dom.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const scale = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(scale);
  renderer.setSize(width, height, false);
  postProcess.resize();
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  for (const mixer of mixers) mixer.update(delta);
  controls.update();
  postProcess.render(scene, camera, delta);
}

async function start() {
  try {
    catalog = await fetch('./generated/source-catalog.json').then((response) => {
      if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
      return response.json();
    });
    catalogById = new Map(catalog.assets.map((asset) => [asset.id, asset]));
    configureCatalogUi();
    bindUi();
    new ResizeObserver(resize).observe(dom.canvas.parentElement);
    resize();
    animate();
    await forge({ target: 'street' });
  } catch (error) {
    console.error(error);
    dom.loadingStatus.textContent = `Forge could not start: ${error.message}`;
    setStatus(`Startup failure: ${error.message}`);
  }
}

start();
