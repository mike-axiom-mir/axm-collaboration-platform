import * as THREE from './vendor/three.module.js';
import { debtLiberation, decisionRevealFrame } from './game-core.mjs';

const COLORS = {
  ink: 0x070812,
  teal: 0x50f4dc,
  amber: 0xf4c45b,
  violet: 0xdf7bff,
  red: 0xff5d78,
  blue: 0x557dff,
  white: 0xeef8ff
};

const RENDER_QUALITY_PRESETS = Object.freeze({
  eco: { id: 'eco', label: 'ECO', pixelRatio: 1, stars: 850, dust: 90, rimStride: 3, shadows: false },
  balanced: { id: 'balanced', label: 'BALANCED', pixelRatio: 1.35, stars: 1250, dust: 180, rimStride: 2, shadows: true },
  cinematic: { id: 'cinematic', label: 'CINEMATIC', pixelRatio: 1.7, stars: 1700, dust: 280, rimStride: 1, shadows: true }
});
const DEFAULT_RENDER_QUALITY = 'cinematic';

const SERVICE_LANES = Object.freeze({
  fuel: Object.freeze({ position: [-5, .32, 5.3], source: [-1.25, 3.45, -.35], color: COLORS.teal, glow: 'teal', exit: -1 }),
  mart: Object.freeze({ position: [2.5, .32, 3.4], source: [2.5, 3.35, -3.15], color: COLORS.amber, glow: 'amber', exit: 1 }),
  garage: Object.freeze({ position: [9.2, .32, 3.7], source: [7.1, 3.5, -2.65], color: COLORS.violet, glow: 'violet', exit: 1 })
});

const QUEUE_SIGNALS = Object.freeze({
  fuel: Object.freeze({ label: 'PUMPS', position: [-5, .18, 5.3], color: COLORS.teal, css: '#50f4dc', glow: 'teal' }),
  mart: Object.freeze({ label: 'MART', position: [2.5, .18, 3.4], color: COLORS.amber, css: '#f4c45b', glow: 'amber' }),
  garage: Object.freeze({ label: 'BAY', position: [9.2, .18, 3.7], color: COLORS.violet, css: '#df7bff', glow: 'violet' })
});

const SERVICE_OUTCOMES = new Set(['manual', 'automated', 'lost', 'blocked']);
const DECISION_REVEAL_DURATION = 2400;

const DECISION_TONE_COLORS = Object.freeze({
  teal: COLORS.teal,
  amber: COLORS.amber,
  violet: COLORS.violet,
  red: COLORS.red,
  blue: COLORS.blue
});

const DECISION_TONE_GLOWS = Object.freeze({ teal: 'teal', amber: 'amber', violet: 'violet', red: 'red', blue: 'night' });

const DECISION_LEGACY_ANCHORS = Object.freeze({
  'opening-swarm': Object.freeze([-14.5, 0, 4.3]),
  'builder-drone': Object.freeze([-15, 0, -8.5]),
  'solar-bloom': Object.freeze([13.5, 0, -8.8]),
  'tour-bus': Object.freeze([15.8, 0, 3.4]),
  inspector: Object.freeze([-10.5, 0, -0.2]),
  'retirement-broker': Object.freeze([0, 0, -11]),
  'legend-offer': Object.freeze([18.5, 0, -12.5])
});

function seeded(seed) {
  let value = seed >>> 0 || 1;
  return () => {
    value = Math.imul(1664525, value) + 1013904223 | 0;
    return (value >>> 0) / 4294967296;
  };
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function textTexture(title, subtitle, color = '#50f4dc', width = 768, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  roundedRect(context, 14, 14, width - 28, height - 28, 34);
  context.fillStyle = 'rgba(3, 7, 18, .84)';
  context.fill();
  context.lineWidth = 7;
  context.strokeStyle = color;
  context.stroke();
  context.shadowColor = color;
  context.shadowBlur = 30;
  context.fillStyle = '#f5fbff';
  context.font = '800 64px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(title, width / 2, height * 0.43);
  context.shadowBlur = 0;
  context.fillStyle = color;
  context.font = '700 27px Arial, sans-serif';
  context.letterSpacing = '5px';
  context.fillText(subtitle, width / 2, height * 0.7);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function glowTexture(color = '#50f4dc') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.15, color);
  gradient.addColorStop(0.48, color + '80');
  gradient.addColorStop(1, color + '00');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function queueSignalTexture(label, laneColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const draw = (count = 0, phase = 'CLEAR', tone = 'clear', overflow = 0) => {
    const color = tone === 'danger' ? '#ff5d78' : tone === 'warning' ? '#f4c45b' : laneColor;
    context.clearRect(0, 0, canvas.width, canvas.height);
    roundedRect(context, 14, 14, 484, 164, 30);
    context.fillStyle = 'rgba(3, 7, 18, .88)';
    context.fill();
    context.lineWidth = 6;
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = tone === 'danger' ? 28 : 18;
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = '#f5fbff';
    context.font = '800 50px Arial, sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText(label, 42, 72);
    context.fillStyle = color;
    context.font = '900 58px Arial, sans-serif';
    context.textAlign = 'right';
    context.fillText(String(count).padStart(2, '0'), 466, 72);
    context.font = '800 24px Arial, sans-serif';
    context.textAlign = 'left';
    context.fillText(overflow ? `${phase} · +${overflow} HOLDING` : phase, 42, 133);
    texture.needsUpdate = true;
  };
  draw();
  return { texture, draw };
}

function debtSignalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 224;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const draw = (debt = 720, phase = 'LIEN LOCKED', tone = 'warning', progress = 0) => {
    const color = tone === 'clear' ? '#50f4dc' : tone === 'opportunity' ? '#91a8ff' : '#f4c45b';
    context.clearRect(0, 0, canvas.width, canvas.height);
    roundedRect(context, 14, 14, 740, 196, 34);
    context.fillStyle = 'rgba(3, 7, 18, .88)';
    context.fill();
    context.lineWidth = 7;
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 26;
    context.stroke();
    context.shadowBlur = 0;
    context.fillStyle = '#f5fbff';
    context.font = '900 57px Arial, sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText('AXM LIEN', 48, 82);
    context.fillStyle = color;
    context.font = '900 57px Arial, sans-serif';
    context.textAlign = 'right';
    context.fillText(`${Math.round(debt)} CR`, 720, 82);
    context.font = '800 25px Arial, sans-serif';
    context.textAlign = 'left';
    context.fillText(`${phase} / ${Math.round(progress * 100)}% RELEASED`, 48, 154);
    texture.needsUpdate = true;
  };
  draw();
  return { texture, draw };
}

function mesh(geometry, material, parent, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, size, position, material, rotation = [0, 0, 0]) {
  return mesh(new THREE.BoxGeometry(...size), material, parent, position, rotation);
}

function cylinder(parent, radii, position, material, rotation = [0, 0, 0]) {
  return mesh(new THREE.CylinderGeometry(radii[0], radii[1], radii[2], radii[3] || 24), material, parent, position, rotation);
}

export class NebulaScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.qualityPreset = DEFAULT_RENDER_QUALITY;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.ink);
    this.scene.fog = new THREE.FogExp2(COLORS.ink, 0.0082);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 400);
    this.camera.position.set(20, 14, 27);
    this.cameraTarget = new THREE.Vector3(0, 2.5, 0);
    this.desiredPosition = this.camera.position.clone();
    this.desiredTarget = this.cameraTarget.clone();
    this.clock = new THREE.Clock();
    this.mode = 'title';
    this.focus = 'forecourt';
    this.reducedMotion = false;
    this.reviewPressure = 0;
    this.debtState = debtLiberation({ debt: 720 });
    this.arrivalState = { phase: 'ON VECTOR', tone: 'steady', progress: 0, seconds: 0, burst: 0 };
    this.queueState = { total: 0, dominantLane: null, lanes: [] };
    this.shiftState = { phase: 'FIRST LIGHT', tone: 'dawn', progress: 0, time: '07:00' };
    this.stationBaseIntensity = 34;
    this.upgradeLevel = 0;
    this.customerVisuals = new Map();
    this.decisionLegacyVisuals = new Map();
    this.activeDecisionReveal = null;
    this.decisionTextures = [];
    this.decisionMaterials = [];
    this.debtMaterials = [];
    this.effects = [];
    this.lastUpgradeSignature = '';
    this.lastDebtSignature = '';
    this.materials = this.createMaterials();
    this.glows = {
      teal: glowTexture('#50f4dc'),
      amber: glowTexture('#f4c45b'),
      violet: glowTexture('#df7bff'),
      red: glowTexture('#ff5d78'),
      dawn: glowTexture('#ff806c'),
      night: glowTexture('#737aff')
    };

    this.buildWorld();
    this.setShiftAtmosphere(this.shiftState);
    this.setFocus('forecourt', true);
    this.setQualityPreset(this.qualityPreset);
  }

  createMaterials() {
    const standard = (color, roughness = 0.6, metalness = 0.25, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    return {
      ground: standard(0x181524, 0.95, 0.05),
      groundEdge: standard(0x2d2440, 0.78, 0.2),
      road: standard(0x090b13, 0.7, 0.5),
      dark: standard(0x10151f, 0.5, 0.65),
      panel: standard(0x28303b, 0.48, 0.62),
      worn: standard(0x55463c, 0.9, 0.18),
      rust: standard(0x9b573c, 0.86, 0.12),
      glass: standard(0x16394a, 0.18, 0.7, { transparent: true, opacity: 0.72, emissive: 0x092b38, emissiveIntensity: 0.9 }),
      teal: standard(COLORS.teal, 0.32, 0.45, { emissive: COLORS.teal, emissiveIntensity: 1.8 }),
      amber: standard(COLORS.amber, 0.38, 0.35, { emissive: COLORS.amber, emissiveIntensity: 1.45 }),
      violet: standard(COLORS.violet, 0.3, 0.45, { emissive: COLORS.violet, emissiveIntensity: 1.55 }),
      red: standard(COLORS.red, 0.38, 0.3, { emissive: COLORS.red, emissiveIntensity: 1.5 }),
      white: standard(0xe4f6ff, 0.25, 0.4, { emissive: 0x9cd4ff, emissiveIntensity: 0.38 }),
      gold: standard(0xe6ab48, 0.32, 0.78),
      black: standard(0x05070a, 0.35, 0.8)
    };
  }

  buildWorld() {
    this.buildSky();
    this.buildLights();
    this.buildAsteroid();
    this.buildStation();
    this.buildQueueConstellations();
    this.buildStationAtmosphere();
    this.buildDebtLien();
    this.buildDecisionLegacyRoot();
    this.buildShiftHorizon();
    this.buildAttraction();
    this.buildArrivalVector();
    this.buildAmbientTraffic();
  }

  buildSky() {
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uPressure: { value: 0 },
        uDawn: { value: 1 },
        uDusk: { value: 0 },
        uNight: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        void main(){
          vUv = uv;
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPressure;
        uniform float uDawn;
        uniform float uDusk;
        uniform float uNight;
        float bands(vec2 p){
          float a = sin(p.x * 9.0 + sin(p.y * 5.0) + uTime * .025);
          float b = sin(p.y * 12.0 - p.x * 3.0 + uTime * .018);
          float c = sin((p.x + p.y) * 18.0 - uTime * .012);
          return (a + b * .55 + c * .25) * .5 + .5;
        }
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float ribbon = smoothstep(.2, .95, bands(p * vec2(1.4, .72)));
          float core = exp(-abs(p.y + sin(p.x * 3.0) * .18) * 4.2);
          vec3 deep = vec3(.012, .006, .055);
          vec3 violet = vec3(.28, .025, .42);
          vec3 cyan = vec3(.02, .38, .46);
          vec3 color = deep + violet * ribbon * .52 + cyan * core * (.28 + ribbon * .38);
          color += vec3(.72, .18, .44) * pow(core * ribbon, 3.0) * .38;
          color += vec3(.48, .11, .025) * uDawn * (core * .34 + ribbon * .12);
          color += vec3(.58, .075, .018) * uDusk * (core * .28 + ribbon * .24);
          color = mix(color, color * vec3(.42, .56, 1.05) + vec3(.008, .012, .075), uNight * .58);
          float hazard = smoothstep(.18, 1.35, length(p));
          color += vec3(.42, .012, .028) * hazard * uPressure * (.34 + bands(p * 1.8) * .36);
          gl_FragColor = vec4(color * uIntensity, 1.0);
        }
      `
    });
    mesh(new THREE.SphereGeometry(175, 48, 32), this.skyMaterial, this.scene);

    const random = seeded(18018);
    const positions = [];
    const colors = [];
    for (let index = 0; index < 1700; index += 1) {
      const radius = 105 + random() * 60;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
      const tint = random();
      colors.push(tint > .82 ? .55 : .9, tint > .82 ? .8 : .68, 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 0.38, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);

    const planetMaterial = new THREE.MeshStandardMaterial({ color: 0x3f3268, roughness: 0.9, emissive: 0x1b1138, emissiveIntensity: 0.5 });
    const planet = mesh(new THREE.SphereGeometry(12, 32, 24), planetMaterial, this.scene, [-66, 34, -105]);
    planet.castShadow = false;
    const ring = mesh(new THREE.RingGeometry(15, 21, 64), new THREE.MeshBasicMaterial({ color: 0x8f79b5, side: THREE.DoubleSide, transparent: true, opacity: 0.42 }), this.scene, [-66, 34, -105], [1.16, 0.15, 0]);
    ring.castShadow = false;
  }

  buildLights() {
    this.hemisphereLight = new THREE.HemisphereLight(0x8eb9ff, 0x24152f, 1.3);
    this.scene.add(this.hemisphereLight);
    const key = new THREE.DirectionalLight(0xe8f6ff, 2.4);
    key.position.set(-18, 28, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(1536, 1536);
    key.shadow.camera.left = -32;
    key.shadow.camera.right = 32;
    key.shadow.camera.top = 32;
    key.shadow.camera.bottom = -32;
    key.shadow.bias = -0.0008;
    this.scene.add(key);
    this.keyLight = key;
    const magenta = new THREE.PointLight(0xb63dff, 55, 55, 2);
    magenta.position.set(20, 14, -18);
    this.scene.add(magenta);
    this.nebulaLight = magenta;
    const cyan = new THREE.PointLight(COLORS.teal, 34, 35, 2);
    cyan.position.set(-8, 8, 2);
    this.scene.add(cyan);
    this.stationLight = cyan;
  }

  buildAsteroid() {
    const asteroid = new THREE.Group();
    asteroid.name = 'asteroid';
    this.scene.add(asteroid);
    cylinder(asteroid, [27, 31, 4.2, 9], [0, -2.15, 0], this.materials.ground);
    cylinder(asteroid, [30.8, 26.5, 3.8, 9], [0, -4.7, 0], this.materials.groundEdge);
    const random = seeded(444);
    for (let index = 0; index < 38; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 20 + random() * 13;
      const scale = 0.25 + random() * 1.25;
      const rock = mesh(new THREE.DodecahedronGeometry(scale, 0), index % 5 === 0 ? this.materials.rust : this.materials.groundEdge, asteroid, [Math.cos(angle) * radius, -1 + random() * 2, Math.sin(angle) * radius]);
      rock.rotation.set(random() * 3, random() * 3, random() * 3);
    }
    const road = mesh(new THREE.RingGeometry(10.5, 18.8, 64, 1, -.45, Math.PI * 1.48), this.materials.road, asteroid, [0, 0.035, 0], [-Math.PI / 2, 0, 0]);
    road.receiveShadow = true;
    const roadLineMaterial = new THREE.MeshBasicMaterial({ color: COLORS.amber, transparent: true, opacity: .33, side: THREE.DoubleSide });
    mesh(new THREE.RingGeometry(14.45, 14.58, 64, 1, -.45, Math.PI * 1.48), roadLineMaterial, asteroid, [0, .055, 0], [-Math.PI / 2, 0, 0]);
  }

  buildStation() {
    this.station = new THREE.Group();
    this.station.name = 'last-stop-nebula';
    this.scene.add(this.station);
    const m = this.materials;

    this.shop = new THREE.Group();
    this.shop.position.set(2.5, 0, -5.2);
    this.station.add(this.shop);
    box(this.shop, [9.5, 4.8, 5.6], [0, 2.4, 0], m.worn);
    box(this.shop, [10.1, .45, 6.2], [0, 5, 0], m.panel);
    box(this.shop, [6.8, 2.6, .15], [-.5, 2.25, 2.86], m.glass);
    box(this.shop, [1.35, 2.9, .25], [3.65, 1.55, 2.92], m.dark);
    for (let x = -3.5; x < 3; x += 1.45) {
      box(this.shop, [.07, 2.5, .2], [x, 2.25, 2.95], m.panel);
    }
    const awning = box(this.shop, [9.7, .32, 1.25], [0, 3.95, 3.3], m.rust, [-.13, 0, 0]);
    awning.castShadow = true;
    this.shopSign = mesh(new THREE.PlaneGeometry(6.3, 1.9), new THREE.MeshBasicMaterial({ map: textTexture('NEBULA MART', 'OPEN · MOSTLY', '#f4c45b'), transparent: true, side: THREE.DoubleSide }), this.shop, [0, 5.65, 1.3], [0, 0, 0]);
    const shopGlow = new THREE.PointLight(COLORS.amber, 15, 12, 2);
    shopGlow.position.set(0, 3, 4);
    this.shop.add(shopGlow);

    this.canopy = new THREE.Group();
    this.canopy.position.set(-5, 0, 1.1);
    this.station.add(this.canopy);
    for (const x of [-4, 4]) {
      for (const z of [-2.3, 2.3]) cylinder(this.canopy, [.16, .24, 4.8, 12], [x, 2.4, z], m.panel);
    }
    box(this.canopy, [10, .55, 6], [0, 5.05, 0], m.worn);
    box(this.canopy, [9.7, .1, 5.7], [0, 4.72, 0], m.teal);
    for (const x of [-2.25, 0, 2.25]) this.createPump(x, 0, this.canopy);

    this.garage = new THREE.Group();
    this.garage.position.set(9.2, 0, -2.4);
    this.station.add(this.garage);
    box(this.garage, [6, 4.8, 6.5], [0, 2.4, 0], m.panel);
    box(this.garage, [4.7, 3.8, .22], [0, 1.9, 3.36], m.black);
    for (let y = .45; y < 4; y += .55) box(this.garage, [4.6, .12, .18], [0, y, 3.5], m.violet);
    box(this.garage, [6.4, .35, 7], [0, 5, 0], m.rust);
    const bayLabel = mesh(new THREE.PlaneGeometry(4.5, 1.25), new THREE.MeshBasicMaterial({ map: textTexture('REPAIR BAY', 'HONEST PRICES?', '#df7bff'), transparent: true, side: THREE.DoubleSide }), this.garage, [0, 5.75, 1.2]);
    bayLabel.scale.set(.82, .82, .82);

    this.tank = new THREE.Group();
    this.tank.position.set(-12, 0, -4.7);
    this.station.add(this.tank);
    cylinder(this.tank, [2.1, 2.1, 6.5, 28], [0, 3.3, 0], m.rust, [0, 0, Math.PI / 2]);
    cylinder(this.tank, [2.25, 2.25, .38, 28], [-3.15, 3.3, 0], m.panel, [0, 0, Math.PI / 2]);
    cylinder(this.tank, [2.25, 2.25, .38, 28], [3.15, 3.3, 0], m.panel, [0, 0, Math.PI / 2]);
    for (const x of [-2, 2]) box(this.tank, [.4, 3, 2.6], [x, .55, 0], m.panel);
    this.leakGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glows.teal, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.leakGlow.position.set(1.1, 1.65, 1.65);
    this.leakGlow.scale.set(2.7, 2.7, 1);
    this.tank.add(this.leakGlow);
    this.leakDrops = [];
    for (let index = 0; index < 12; index += 1) {
      const drop = mesh(new THREE.SphereGeometry(.06 + index % 3 * .025, 8, 6), m.teal, this.tank, [1.1 + (index % 2) * .16, 1.2 - index * .19, 1.65]);
      drop.userData.phase = index / 12;
      this.leakDrops.push(drop);
    }

    this.billboard = new THREE.Group();
    this.billboard.position.set(13.8, 0, 7.4);
    this.station.add(this.billboard);
    cylinder(this.billboard, [.16, .22, 7.5, 10], [0, 3.75, 0], m.panel);
    const board = mesh(new THREE.PlaneGeometry(7, 3), new THREE.MeshBasicMaterial({ map: textTexture('AXM PARK', 'GRAND REOPENING · TODAY', '#df7bff'), transparent: true, side: THREE.DoubleSide }), this.billboard, [0, 7.7, 0], [0, -.62, 0]);
    board.castShadow = false;

    this.alien = this.createAlien();
    this.alien.position.set(2.9, 0, -.9);
    this.station.add(this.alien);

    this.upgradeVisuals = this.buildUpgradeVisuals();
    this.buildLaneMarkers();
  }

  createPump(x, z, parent) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    parent.add(group);
    box(group, [1.15, 2.2, 1.1], [0, 1.1, 0], this.materials.panel);
    box(group, [.78, .63, .08], [0, 1.48, .57], this.materials.glass);
    box(group, [.82, .12, .09], [0, .92, .58], this.materials.teal);
    cylinder(group, [.15, .15, 1.2, 12], [.75, .9, 0], this.materials.black, [Math.PI / 2, 0, 0]);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glows.teal, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(0, 1.5, .65);
    halo.scale.set(1.2, 1.2, 1);
    group.add(halo);
    return group;
  }

  createAlien() {
    const group = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({ color: 0x305d68, roughness: .82 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x8bcf82, roughness: .65, emissive: 0x183820, emissiveIntensity: .25 });
    cylinder(group, [.46, .65, 1.45, 18], [0, 1.1, 0], coat);
    const head = mesh(new THREE.SphereGeometry(.65, 20, 14), skin, group, [0, 2.15, 0]);
    head.scale.set(1.08, .86, .88);
    for (const x of [-.24, .24]) {
      const eye = mesh(new THREE.SphereGeometry(.105, 12, 8), this.materials.black, group, [x, 2.25, .53]);
      eye.scale.set(1, 1.45, .4);
    }
    for (const x of [-.42, .42]) {
      cylinder(group, [.055, .07, .7, 8], [x, 2.74, 0], skin, [0, 0, x > 0 ? -.3 : .3]);
      mesh(new THREE.SphereGeometry(.09, 8, 6), this.materials.teal, group, [x + (x > 0 ? .1 : -.1), 3.08, 0]);
    }
    return group;
  }

  buildLaneMarkers() {
    this.laneMarkers = {};
    const definitions = [
      ['fuel', -5, .16, 5.3, '#50f4dc'],
      ['mart', 2.5, .16, 3.4, '#f4c45b'],
      ['garage', 9.2, .16, 3.7, '#df7bff']
    ];
    for (const [id, x, y, z, color] of definitions) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false });
      const ring = mesh(new THREE.RingGeometry(1.65, 1.86, 32), material, this.station, [x, y, z], [-Math.PI / 2, 0, 0]);
      ring.userData.baseY = y;
      this.laneMarkers[id] = ring;
    }
  }

  buildQueueConstellations() {
    this.queueConstellation = new THREE.Group();
    this.queueConstellation.name = 'queue-constellations';
    this.queueSignals = {};
    for (const [lane, definition] of Object.entries(QUEUE_SIGNALS)) {
      const signal = new THREE.Group();
      signal.position.set(...definition.position);
      signal.userData.lane = lane;
      signal.userData.urgency = 0;
      signal.userData.tone = 'clear';

      const beamMaterial = new THREE.MeshBasicMaterial({
        color: definition.color,
        transparent: true,
        opacity: .08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      });
      const beam = cylinder(signal, [.025, .065, 4.25, 10], [0, 2.25, 0], beamMaterial);
      beam.castShadow = false;
      beam.renderOrder = 21;

      const ringMaterial = new THREE.MeshBasicMaterial({
        color: definition.color,
        transparent: true,
        opacity: .34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      });
      const ring = mesh(new THREE.TorusGeometry(.72, .055, 8, 36), ringMaterial, signal, [0, .08, 0], [Math.PI / 2, 0, 0]);
      ring.castShadow = false;
      ring.renderOrder = 22;

      const pips = [];
      for (let index = 0; index < 5; index += 1) {
        const pipMaterial = new THREE.MeshStandardMaterial({
          color: definition.color,
          emissive: definition.color,
          emissiveIntensity: 1.35,
          roughness: .2,
          metalness: .25,
          transparent: true,
          opacity: .94,
          depthWrite: false,
          depthTest: false
        });
        const pip = mesh(new THREE.OctahedronGeometry(.19 + index * .015, 0), pipMaterial, signal, [0, 1.05 + index * .68, 0]);
        pip.castShadow = false;
        pip.renderOrder = 23;
        pip.userData.baseY = pip.position.y;
        pip.userData.phase = index * .72;
        pip.visible = false;
        pips.push(pip);
      }

      const crown = mesh(
        new THREE.TorusGeometry(.4, .045, 8, 28),
        ringMaterial.clone(),
        signal,
        [0, 4.08, 0],
        [Math.PI / 2, 0, 0]
      );
      crown.castShadow = false;
      crown.renderOrder = 23;
      crown.visible = false;

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glows[definition.glow],
        color: COLORS.white,
        transparent: true,
        opacity: .24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      }));
      glow.position.set(0, 4.7, 0);
      glow.scale.set(1.8, 1.8, 1);
      glow.renderOrder = 22;
      signal.add(glow);

      const labelRenderer = queueSignalTexture(definition.label, definition.css);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: labelRenderer.texture,
        transparent: true,
        opacity: .96,
        depthWrite: false,
        depthTest: false
      }));
      label.position.set(0, 5.35, 0);
      label.scale.set(3.35, 1.26, 1);
      label.renderOrder = 24;
      signal.add(label);

      signal.userData.beam = beam;
      signal.userData.ring = ring;
      signal.userData.pips = pips;
      signal.userData.crown = crown;
      signal.userData.glow = glow;
      signal.userData.label = label;
      signal.userData.labelRenderer = labelRenderer;
      signal.userData.signature = '';
      signal.visible = false;
      this.queueConstellation.add(signal);
      this.queueSignals[lane] = signal;
    }
    this.queueConstellation.visible = false;
    this.station.add(this.queueConstellation);
  }

  buildStationAtmosphere() {
    const random = seeded(18180);
    const positions = [];
    const colors = [];
    const dustColors = [new THREE.Color(COLORS.teal), new THREE.Color(COLORS.violet), new THREE.Color(COLORS.amber)];
    for (let index = 0; index < 280; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 12 + random() * 58;
      positions.push(Math.cos(angle) * radius, .8 + random() * 24, Math.sin(angle) * radius);
      const color = dustColors[index % dustColors.length];
      const strength = .28 + random() * .42;
      colors.push(color.r * strength, color.g * strength, color.b * strength);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const dustMaterial = new THREE.PointsMaterial({
      size: .2,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: .5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.stationDust = new THREE.Points(dustGeometry, dustMaterial);
    this.scene.add(this.stationDust);

    this.rimLights = [];
    const rimColors = [COLORS.teal, COLORS.amber, COLORS.violet];
    for (let index = 0; index < 30; index += 1) {
      const angle = index / 30 * Math.PI * 2;
      const material = new THREE.MeshStandardMaterial({
        color: rimColors[index % rimColors.length],
        roughness: .22,
        metalness: .5,
        emissive: rimColors[index % rimColors.length],
        emissiveIntensity: .85
      });
      const light = cylinder(this.scene, [.08, .12, .42, 8], [Math.cos(angle) * 25.4, -.08, Math.sin(angle) * 25.4], material);
      light.userData.phase = index / 30;
      this.rimLights.push(light);
    }

    this.reviewBeacon = new THREE.Group();
    this.reviewBeacon.position.set(9.2, 5.25, -2.4);
    cylinder(this.reviewBeacon, [.1, .15, 1.35, 10], [0, .68, 0], this.materials.panel);
    const hazardMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.red,
      roughness: .22,
      metalness: .35,
      emissive: COLORS.red,
      emissiveIntensity: .4,
      transparent: true,
      opacity: .72
    });
    this.reviewBeaconOrb = mesh(new THREE.IcosahedronGeometry(.28, 1), hazardMaterial, this.reviewBeacon, [0, 1.46, 0]);
    this.reviewBeaconRing = mesh(new THREE.TorusGeometry(.6, .045, 8, 32), hazardMaterial.clone(), this.reviewBeacon, [0, 1.46, 0], [Math.PI / 2, 0, 0]);
    this.reviewBeaconLight = new THREE.PointLight(COLORS.red, 0, 15, 2);
    this.reviewBeaconLight.position.set(0, 1.5, 0);
    this.reviewBeacon.add(this.reviewBeaconLight);
    this.station.add(this.reviewBeacon);
  }

  buildDebtLien() {
    this.debtLienRoot = new THREE.Group();
    this.debtLienRoot.name = 'axm-debt-lien';
    this.debtLienRoot.position.set(0, 0, -2.4);
    this.debtLienRoot.visible = false;

    const boundaryMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.amber,
      transparent: true,
      opacity: .24,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.debtMaterials.push(boundaryMaterial);
    this.debtLienBoundary = mesh(new THREE.TorusGeometry(9.4, .075, 8, 96), boundaryMaterial, this.debtLienRoot, [0, .18, 0], [Math.PI / 2, 0, 0]);
    this.debtLienBoundary.castShadow = false;

    const beamMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.amber,
      transparent: true,
      opacity: .08,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.debtMaterials.push(beamMaterial);
    this.debtLienBeam = mesh(new THREE.CylinderGeometry(.36, 1.15, 7.1, 28, 1, true), beamMaterial, this.debtLienRoot, [0, 3.55, 0]);
    this.debtLienBeam.castShadow = false;

    this.debtLock = new THREE.Group();
    this.debtLock.position.set(0, 7.15, 0);
    this.debtLienRoot.add(this.debtLock);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.amber,
      roughness: .24,
      metalness: .58,
      emissive: COLORS.amber,
      emissiveIntensity: 1.8
    });
    this.debtMaterials.push(coreMaterial);
    this.debtLockCore = mesh(new THREE.IcosahedronGeometry(.58, 1), coreMaterial, this.debtLock);
    this.debtLockHalo = mesh(new THREE.TorusGeometry(1.18, .07, 8, 44), coreMaterial.clone(), this.debtLock);
    this.debtMaterials.push(this.debtLockHalo.material);
    const jawMaterial = coreMaterial.clone();
    this.debtMaterials.push(jawMaterial);
    this.debtLockLeft = box(this.debtLock, [.52, 1.35, .34], [-.54, -.06, 0], jawMaterial, [0, 0, -.08]);
    this.debtLockRight = box(this.debtLock, [.52, 1.35, .34], [.54, -.06, 0], jawMaterial, [0, 0, .08]);
    this.debtLockLight = new THREE.PointLight(COLORS.amber, 12, 18, 2);
    this.debtLock.add(this.debtLockLight);

    const labelRenderer = debtSignalTexture();
    this.debtTexture = labelRenderer.texture;
    this.debtLabelRenderer = labelRenderer;
    const labelMaterial = new THREE.SpriteMaterial({ map: labelRenderer.texture, transparent: true, opacity: .9, depthTest: false, depthWrite: false });
    this.debtMaterials.push(labelMaterial);
    this.debtLienLabel = new THREE.Sprite(labelMaterial);
    this.debtLienLabel.position.set(0, 10.25, 0);
    this.debtLienLabel.scale.set(8.5, 2.48, 1);
    this.debtLienLabel.renderOrder = 45;
    this.debtLienLabel.visible = (this.canvas.clientWidth || window.innerWidth) > 820;
    this.debtLienRoot.add(this.debtLienLabel);

    this.debtLienLinks = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(angle) * 8.7;
      const z = Math.sin(angle) * 8.7;
      const y = 3.45 + index % 2 * .42;
      const node = new THREE.Group();
      node.position.set(x, y, z);
      node.rotation.y = -angle + Math.PI / 2;
      node.rotation.z = index % 2 ? -.28 : .28;
      this.debtLienRoot.add(node);
      const linkMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.amber,
        roughness: .2,
        metalness: .5,
        emissive: COLORS.amber,
        emissiveIntensity: 1.55,
        transparent: true,
        opacity: .78
      });
      this.debtMaterials.push(linkMaterial);
      const ring = mesh(new THREE.TorusGeometry(.78, .13, 10, 30), linkMaterial, node);
      ring.castShadow = false;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glows.amber, transparent: true, opacity: .42, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
      glow.scale.set(2.6, 2.6, 1);
      glow.renderOrder = 40;
      node.add(glow);
      const tetherMaterial = new THREE.LineBasicMaterial({ color: COLORS.amber, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false });
      this.debtMaterials.push(tetherMaterial);
      const tetherGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(0, 7.15, 0)
      ]);
      const tether = new THREE.Line(tetherGeometry, tetherMaterial);
      this.debtLienRoot.add(tether);
      this.debtLienLinks.push({ node, ring, glow, tether, baseY: y, phase: angle });
    }

    this.scene.add(this.debtLienRoot);
    this.canvas.dataset.debtStage = 'LIEN LOCKED';
    this.canvas.dataset.debtTone = 'warning';
    this.canvas.dataset.debtProgress = '0.000';
    this.canvas.dataset.debtLinks = '6';
    this.canvas.dataset.debtMotion = this.reducedMotion ? 'reduced' : 'full';
    this.canvas.dataset.debtLabel = this.debtLienLabel.visible ? 'visible' : 'hud-only';
    this.canvas.dataset.debtPayment = 'none';
    this.canvas.dataset.debtPaymentPhase = 'idle';
  }

  buildShiftHorizon() {
    this.shiftHorizon = new THREE.Group();
    this.shiftHorizon.name = 'shift-horizon';
    this.shiftHorizon.position.set(0, -1.2, -14);
    this.shiftHorizon.visible = false;
    this.shiftHorizonRings = [];
    for (const [radius, opacity] of [[23.7, .18], [24.45, .34]]) {
      const material = new THREE.MeshBasicMaterial({
        color: COLORS.teal,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = mesh(new THREE.TorusGeometry(radius, .055, 8, 112, Math.PI), material, this.shiftHorizon);
      ring.castShadow = false;
      ring.renderOrder = 2;
      ring.userData.baseOpacity = opacity;
      this.shiftHorizonRings.push(ring);
    }

    this.shiftHorizonMarkers = [];
    for (let index = 0; index <= 10; index += 1) {
      const markerProgress = index / 10;
      const angle = Math.PI * (1 - markerProgress);
      const material = new THREE.MeshStandardMaterial({
        color: COLORS.teal,
        emissive: COLORS.teal,
        emissiveIntensity: .7,
        roughness: .24,
        metalness: .45,
        transparent: true,
        opacity: .7
      });
      const marker = mesh(
        new THREE.OctahedronGeometry(index % 5 === 0 ? .2 : .12, 0),
        material,
        this.shiftHorizon,
        [Math.cos(angle) * 24.1, Math.sin(angle) * 24.1, 0]
      );
      marker.castShadow = false;
      marker.userData.progress = markerProgress;
      this.shiftHorizonMarkers.push(marker);
    }

    this.shiftOrb = new THREE.Group();
    this.shiftOrbCore = mesh(
      new THREE.IcosahedronGeometry(.54, 2),
      new THREE.MeshStandardMaterial({ color: COLORS.teal, emissive: COLORS.teal, emissiveIntensity: 2.8, roughness: .2, metalness: .28 }),
      this.shiftOrb
    );
    this.shiftOrbCore.castShadow = false;
    this.shiftOrbGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glows.teal,
      color: COLORS.white,
      transparent: true,
      opacity: .78,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    this.shiftOrbGlow.scale.set(4.8, 4.8, 1);
    this.shiftOrb.add(this.shiftOrbGlow);
    this.shiftOrbLight = new THREE.PointLight(COLORS.teal, 16, 24, 2);
    this.shiftOrb.add(this.shiftOrbLight);
    this.shiftHorizon.add(this.shiftOrb);
    this.scene.add(this.shiftHorizon);
  }

  buildDecisionLegacyRoot() {
    this.decisionLegacyRoot = new THREE.Group();
    this.decisionLegacyRoot.name = 'decision-legacy-root';
    this.decisionLegacyRoot.visible = false;
    this.scene.add(this.decisionLegacyRoot);
    this.canvas.dataset.decisionCount = '0';
    this.canvas.dataset.decisionIds = '';
    this.canvas.dataset.decisionLatest = 'none';
    this.canvas.dataset.decisionMotion = this.reducedMotion ? 'reduced' : 'full';
    this.canvas.dataset.decisionReveal = 'none';
    this.canvas.dataset.decisionRevealPhase = 'idle';
    this.canvas.dataset.decisionRevealProgress = '0.000';
    this.canvas.dataset.decisionRevealEffectScale = '1.000';
    this.canvas.dataset.decisionRevealMotion = this.reducedMotion ? 'reduced' : 'full';
  }

  createDecisionLegacyVisual(entry) {
    const anchor = DECISION_LEGACY_ANCHORS[entry.eventId] || [0, 0, -12];
    const cssByTone = {
      teal: '#50f4dc',
      amber: '#f4c45b',
      violet: '#df7bff',
      red: '#ff5d78',
      blue: '#557dff'
    };
    const color = DECISION_TONE_COLORS[entry.tone] || COLORS.teal;
    const root = new THREE.Group();
    root.name = `decision-${entry.id}`;
    root.position.set(...anchor);
    root.userData.baseY = anchor[1];
    root.userData.phase = entry.order * 1.37 + .4;
    root.userData.spinNodes = [];
    root.userData.bobNodes = [];
    root.userData.pulseMaterials = [];
    root.userData.decisionId = `${entry.eventId}:${entry.choiceId}`;

    const makeMaterial = (hex = color, options = {}) => {
      const parameters = {
        color: hex,
        emissive: hex,
        emissiveIntensity: options.emissiveIntensity ?? 1.55,
        roughness: options.roughness ?? .34,
        metalness: options.metalness ?? .48,
        transparent: Boolean(options.transparent),
        opacity: options.opacity ?? 1
      };
      if (options.side !== undefined) parameters.side = options.side;
      const material = new THREE.MeshStandardMaterial(parameters);
      this.decisionMaterials.push(material);
      return material;
    };
    const accent = makeMaterial();
    const pale = makeMaterial(COLORS.white, { emissiveIntensity: .42, roughness: .26, metalness: .56 });
    const shadow = makeMaterial(0x111827, { emissiveIntensity: .08, roughness: .7, metalness: .65 });
    root.userData.pulseMaterials.push(accent);

    cylinder(root, [1.45, 1.7, .28, 32], [0, .14, 0], shadow).castShadow = false;
    const plinthRing = mesh(new THREE.TorusGeometry(1.34, .075, 8, 48), accent, root, [0, .34, 0], [-Math.PI / 2, 0, 0]);
    plinthRing.castShadow = false;
    const glowMaterial = new THREE.SpriteMaterial({
      map: this.glows[DECISION_TONE_GLOWS[entry.tone] || 'teal'],
      transparent: true,
      opacity: .38,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.decisionMaterials.push(glowMaterial);
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.set(0, 1.35, 0);
    glow.scale.set(4.4, 4.4, 1);
    glow.renderOrder = 12;
    root.add(glow);
    root.userData.glow = glow;

    const artifact = new THREE.Group();
    artifact.position.y = .42;
    artifact.userData.baseY = .42;
    root.add(artifact);
    root.userData.bobNodes.push(artifact);

    const spin = new THREE.Group();
    artifact.add(spin);
    root.userData.spinNodes.push(spin);

    switch (entry.shape) {
      case 'broadcast': {
        cylinder(spin, [.11, .18, 3.1, 12], [0, 1.55, 0], shadow);
        mesh(new THREE.IcosahedronGeometry(.34, 1), accent, spin, [0, 3.05, 0]);
        for (const [height, radius] of [[1.25, .55], [1.9, .82], [2.55, 1.08]]) {
          const ring = mesh(new THREE.TorusGeometry(radius, .055, 7, 32), accent, spin, [0, height, 0], [Math.PI / 2, 0, 0]);
          ring.castShadow = false;
        }
        break;
      }
      case 'shade': {
        cylinder(spin, [.1, .16, 2.45, 12], [0, 1.4, 0], shadow);
        mesh(new THREE.ConeGeometry(1.42, .58, 18, 1, true), accent, spin, [0, 2.55, 0], [0, 0, Math.PI]);
        for (let index = 0; index < 4; index += 1) {
          const angle = index / 4 * Math.PI * 2;
          mesh(new THREE.SphereGeometry(.13, 10, 8), pale, spin, [Math.cos(angle) * .9, 2.15, Math.sin(angle) * .9]);
        }
        break;
      }
      case 'drone': {
        mesh(new THREE.IcosahedronGeometry(.68, 1), accent, spin, [0, 1.72, 0]);
        for (let index = 0; index < 4; index += 1) {
          const angle = index / 4 * Math.PI * 2;
          const x = Math.cos(angle) * 1.05;
          const z = Math.sin(angle) * 1.05;
          box(spin, [1.05, .1, .1], [x * .52, 1.72, z * .52], shadow, [0, -angle, 0]);
          const rotor = mesh(new THREE.TorusGeometry(.38, .045, 7, 24), pale, spin, [x, 1.72, z], [-Math.PI / 2, 0, 0]);
          rotor.castShadow = false;
        }
        break;
      }
      case 'scrap': {
        box(spin, [1.45, .62, .9], [-.22, .82, .08], shadow, [.08, .32, -.16]);
        box(spin, [.72, .86, .6], [.62, 1.23, -.18], accent, [-.12, -.48, .22]);
        mesh(new THREE.TorusGeometry(.72, .1, 8, 24), pale, spin, [-.42, 1.62, .04], [.25, .5, 0]);
        break;
      }
      case 'relay': {
        cylinder(spin, [.12, .2, 2.7, 12], [0, 1.48, 0], shadow);
        mesh(new THREE.ConeGeometry(.82, .36, 24, 1, true), accent, spin, [0, 2.36, 0], [0, 0, -Math.PI / 2]);
        cylinder(spin, [.08, .08, .88, 8], [.42, 2.36, 0], pale, [0, 0, Math.PI / 2]);
        mesh(new THREE.OctahedronGeometry(.24, 0), pale, spin, [.88, 2.36, 0]);
        break;
      }
      case 'deck': {
        cylinder(spin, [1.45, 1.45, .26, 8], [0, .62, 0], shadow);
        for (let index = 0; index < 8; index += 1) {
          const angle = index / 8 * Math.PI * 2;
          cylinder(spin, [.055, .055, .9, 7], [Math.cos(angle) * 1.15, 1.1, Math.sin(angle) * 1.15], accent);
        }
        mesh(new THREE.IcosahedronGeometry(.52, 1), pale, spin, [0, 1.58, 0]);
        mesh(new THREE.TorusGeometry(.82, .06, 8, 36), accent, spin, [0, 1.58, 0], [Math.PI / 2, 0, 0]);
        break;
      }
      case 'shelter': {
        const arch = mesh(new THREE.TorusGeometry(1.3, .14, 10, 42, Math.PI), accent, spin, [0, .7, 0]);
        arch.castShadow = false;
        for (const x of [-1.3, 1.3]) cylinder(spin, [.12, .12, 1.3, 10], [x, .68, 0], accent);
        box(spin, [2.55, .14, 1.5], [0, .08, 0], shadow);
        for (const x of [-.72, 0, .72]) mesh(new THREE.SphereGeometry(.13, 10, 8), pale, spin, [x, 1.55, .05]);
        break;
      }
      case 'contract': {
        for (const x of [-.92, .92]) cylinder(spin, [.1, .13, 2.2, 10], [x, 1.16, 0], shadow);
        box(spin, [2.3, 1.35, .18], [0, 1.68, 0], accent, [0, -.08, 0]);
        for (const y of [1.42, 1.72, 2.02]) box(spin, [1.45, .07, .06], [-.18, y, .13], pale);
        break;
      }
      case 'rations': {
        box(spin, [1.42, .86, 1.05], [-.55, .72, 0], shadow, [0, .12, 0]);
        box(spin, [1.2, 1.02, .92], [.62, .9, -.12], accent, [0, -.18, 0]);
        box(spin, [.62, .14, .08], [.62, 1.02, .39], pale);
        box(spin, [.14, .62, .08], [.62, 1.02, .39], pale);
        break;
      }
      case 'redirect': {
        cylinder(spin, [.11, .17, 2.65, 10], [0, 1.38, 0], shadow);
        box(spin, [1.65, .28, .22], [0, 2.18, 0], accent);
        mesh(new THREE.ConeGeometry(.56, .86, 4), accent, spin, [1.18, 2.18, 0], [0, 0, -Math.PI / 2]);
        for (const y of [1.35, 1.72]) {
          box(spin, [1.15, .18, .18], [-.18, y, 0], pale);
          mesh(new THREE.ConeGeometry(.36, .58, 4), pale, spin, [.74, y, 0], [0, 0, -Math.PI / 2]);
        }
        break;
      }
      case 'seal': {
        for (const radius of [.72, 1.02, 1.32]) {
          const ring = mesh(new THREE.TorusGeometry(radius, .07, 8, 40), accent, spin, [0, 1.55, 0]);
          ring.castShadow = false;
        }
        box(spin, [.18, .88, .16], [-.25, 1.48, .08], pale, [0, 0, -.62]);
        box(spin, [.18, 1.55, .16], [.38, 1.54, .08], pale, [0, 0, .72]);
        break;
      }
      case 'hospitality': {
        cylinder(spin, [1.12, 1.12, .18, 24], [0, 1.18, 0], accent);
        cylinder(spin, [.12, .25, 1.2, 12], [0, .6, 0], shadow);
        for (let index = 0; index < 7; index += 1) {
          const angle = index / 7 * Math.PI * 2;
          const x = Math.cos(angle) * 1.45;
          const z = Math.sin(angle) * 1.45;
          cylinder(spin, [.2, .24, .48, 10], [x, .42, z], pale);
          mesh(new THREE.SphereGeometry(.11, 8, 6), pale, spin, [Math.cos(angle) * .75, 1.3, Math.sin(angle) * .75]);
        }
        break;
      }
      case 'blackout': {
        for (const x of [-.78, 0, .78]) box(spin, [.62, 2.55, .32], [x, 1.4, 0], shadow, [0, x * .18, 0]);
        for (const y of [.72, 1.4, 2.08]) box(spin, [2.22, .08, .08], [0, y, .2], accent);
        break;
      }
      case 'spire': {
        cylinder(spin, [.22, .48, 3.2, 14], [0, 1.64, 0], shadow);
        mesh(new THREE.OctahedronGeometry(.34, 0), pale, spin, [0, 3.32, 0]);
        for (let index = 0; index < 4; index += 1) {
          const ring = mesh(new THREE.TorusGeometry(.56 + index * .16, .055, 7, 32), accent, spin, [0, .9 + index * .62, 0], [Math.PI / 2, index * .28, 0]);
          ring.castShadow = false;
        }
        break;
      }
      case 'shroud': {
        const shroudMaterial = makeMaterial(color, { transparent: true, opacity: .24, side: THREE.DoubleSide, emissiveIntensity: .6, roughness: .12, metalness: .18 });
        mesh(new THREE.SphereGeometry(1.55, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2), shroudMaterial, spin, [0, .22, 0]);
        cylinder(spin, [.18, .32, 1.5, 12], [0, .82, 0], shadow);
        mesh(new THREE.OctahedronGeometry(.32, 0), pale, spin, [0, 1.7, 0]);
        break;
      }
      case 'crown': {
        const crownRing = mesh(new THREE.TorusGeometry(1.22, .13, 10, 42), accent, spin, [0, 1.65, 0], [-Math.PI / 2, 0, 0]);
        crownRing.castShadow = false;
        for (let index = 0; index < 9; index += 1) {
          const angle = index / 9 * Math.PI * 2;
          mesh(new THREE.ConeGeometry(.16, .92, 5), pale, spin, [Math.cos(angle) * 1.22, 2.08, Math.sin(angle) * 1.22]);
        }
        mesh(new THREE.IcosahedronGeometry(.44, 1), accent, spin, [0, 1.7, 0]);
        break;
      }
      case 'vault':
      default: {
        box(spin, [2.2, 1.75, 1.42], [0, 1.18, 0], shadow);
        const door = mesh(new THREE.TorusGeometry(.7, .11, 10, 32), accent, spin, [0, 1.18, .76]);
        door.castShadow = false;
        cylinder(spin, [.12, .12, 1.05, 10], [0, 1.18, .82], pale, [Math.PI / 2, 0, 0]);
        for (let index = 0; index < 4; index += 1) {
          const angle = index / 4 * Math.PI * 2;
          box(spin, [.12, .58, .12], [Math.cos(angle) * .48, 1.18 + Math.sin(angle) * .48, .84], pale, [0, 0, -angle]);
        }
        break;
      }
    }

    const labelTexture = textTexture(entry.label, `DAY ${String(entry.day).padStart(2, '0')} / PERMANENT TRACE`, cssByTone[entry.tone] || '#50f4dc', 768, 224);
    this.decisionTextures.push(labelTexture);
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, opacity: .94, depthTest: false, depthWrite: false });
    this.decisionMaterials.push(labelMaterial);
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(0, 4.65, 0);
    label.scale.set(4.3, 1.25, 1);
    label.renderOrder = 56;
    root.add(label);
    root.userData.label = label;

    const light = new THREE.PointLight(color, 8, 8, 2);
    light.position.set(0, 1.8, 0);
    root.add(light);
    root.userData.light = light;
    root.visible = false;
    this.decisionLegacyRoot.add(root);
    return root;
  }

  setDecisionLegacy(legacy) {
    if (!this.decisionLegacyRoot) return;
    const entries = Array.isArray(legacy?.entries) ? legacy.entries : [];
    const visible = new Set();
    for (const entry of entries) {
      const key = `${entry.eventId}:${entry.choiceId}`;
      visible.add(key);
      let visual = this.decisionLegacyVisuals.get(key);
      if (!visual) {
        visual = this.createDecisionLegacyVisual(entry);
        this.decisionLegacyVisuals.set(key, visual);
      }
      visual.visible = true;
    }
    for (const [key, visual] of this.decisionLegacyVisuals) visual.visible = visible.has(key);
    this.decisionLegacyRoot.visible = this.mode === 'play';
    this.canvas.dataset.decisionCount = String(entries.length);
    this.canvas.dataset.decisionIds = entries.map(entry => `${entry.eventId}:${entry.choiceId}`).join('|');
    this.canvas.dataset.decisionLatest = legacy?.latest ? `${legacy.latest.eventId}:${legacy.latest.choiceId}` : 'none';
  }

  revealDecisionLegacy(entry) {
    if (!entry || !this.decisionLegacyRoot) return false;
    const key = `${entry.eventId}:${entry.choiceId}`;
    const visual = this.decisionLegacyVisuals.get(key);
    if (!visual?.visible) return false;

    if (this.activeDecisionReveal) {
      const previous = this.activeDecisionReveal;
      previous.artifact.scale.setScalar(1);
      previous.artifact.userData.label.material.opacity = .94;
      this.scene.remove(previous.object);
      this.disposeEffect(previous);
      this.effects = this.effects.filter(effect => effect !== previous);
    }

    const color = DECISION_TONE_COLORS[entry.tone] || COLORS.teal;
    const glow = this.glows[DECISION_TONE_GLOWS[entry.tone] || 'teal'];
    const root = new THREE.Group();
    root.name = `decision-reveal-${entry.id}`;
    root.position.copy(visual.position);
    const effectScale = (this.canvas.clientWidth || window.innerWidth) < 520 ? .74 : 1;
    root.scale.setScalar(effectScale);

    const beamMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: .42,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const beam = mesh(new THREE.CylinderGeometry(1.65, 1.65, 5.8, 32, 1, true), beamMaterial, root, [0, 2.9, 0]);
    beam.castShadow = false;
    beam.receiveShadow = false;

    const rings = [];
    for (let index = 0; index < 3; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: index === 1 ? COLORS.white : color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const ring = mesh(new THREE.TorusGeometry(1.18 + index * .24, .065, 8, 44), material, root, [0, .48 + index * .58, 0], [-Math.PI / 2, 0, 0]);
      ring.castShadow = false;
      ring.receiveShadow = false;
      ring.userData.baseY = ring.position.y;
      rings.push(ring);
    }

    const shardMaterial = new THREE.MeshBasicMaterial({ color: COLORS.white, transparent: true, opacity: .58, depthWrite: false, blending: THREE.AdditiveBlending });
    const shards = [];
    for (let index = 0; index < 14; index += 1) {
      const angle = index / 14 * Math.PI * 2;
      const radius = 1.05 + index % 3 * .34;
      const shard = mesh(new THREE.OctahedronGeometry(.09 + index % 2 * .045, 0), shardMaterial, root, [Math.cos(angle) * radius, .42 + index % 4 * .44, Math.sin(angle) * radius]);
      shard.castShadow = false;
      shard.receiveShadow = false;
      shard.userData.angle = angle;
      shard.userData.radius = radius;
      shard.userData.baseY = shard.position.y;
      shards.push(shard);
    }

    const flareMaterial = new THREE.SpriteMaterial({ map: glow, color: COLORS.white, transparent: true, opacity: .56, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    const flare = new THREE.Sprite(flareMaterial);
    flare.position.set(0, 2.2, 0);
    flare.scale.set(3, 3, 1);
    flare.renderOrder = 58;
    root.add(flare);

    const light = new THREE.PointLight(color, 24, 14, 2);
    light.position.set(0, 2.1, 0);
    root.add(light);
    root.visible = this.mode === 'play';
    this.scene.add(root);

    const initial = decisionRevealFrame(0, this.reducedMotion);
    visual.scale.setScalar(initial.artifactScale);
    visual.userData.label.material.opacity = this.reducedMotion ? .94 : 0;
    const effect = {
      type: 'decision-reveal',
      id: key,
      object: root,
      artifact: visual,
      beam,
      rings,
      shards,
      flare,
      light,
      born: performance.now(),
      duration: this.reducedMotion ? 900 : DECISION_REVEAL_DURATION
    };
    this.activeDecisionReveal = effect;
    this.effects.push(effect);
    this.canvas.dataset.decisionReveal = key;
    this.canvas.dataset.decisionRevealPhase = this.reducedMotion ? 'static-confirmation' : 'assembling';
    this.canvas.dataset.decisionRevealProgress = '0.000';
    this.canvas.dataset.decisionRevealScale = initial.artifactScale.toFixed(3);
    this.canvas.dataset.decisionRevealEffectScale = effectScale.toFixed(3);
    this.canvas.dataset.decisionRevealMotion = this.reducedMotion ? 'reduced' : 'full';
    return true;
  }

  buildUpgradeVisuals() {
    const visuals = {};
    const m = this.materials;

    const patch = new THREE.Group();
    patch.position.copy(this.tank.position);
    for (const x of [-1.05, 1.05]) {
      const clamp = mesh(new THREE.TorusGeometry(2.16, .115, 8, 36), m.amber, patch, [x, 3.3, 0], [0, Math.PI / 2, 0]);
      clamp.castShadow = false;
    }
    box(patch, [1.35, .82, .16], [1.08, 1.65, 1.77], m.amber, [0, 0, -.08]);
    const patchGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glows.amber, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    patchGlow.position.set(1.08, 1.65, 1.88);
    patchGlow.scale.set(1.25, 1.25, 1);
    patch.add(patchGlow);
    this.station.add(patch);
    visuals['patch-kit'] = patch;

    const drone = new THREE.Group();
    const droneCore = new THREE.MeshStandardMaterial({ color: 0x207d78, roughness: .38, metalness: .62, emissive: COLORS.teal, emissiveIntensity: .48 });
    const stockCore = new THREE.MeshStandardMaterial({ color: 0x8a6725, roughness: .4, metalness: .58, emissive: COLORS.amber, emissiveIntensity: .42 });
    mesh(new THREE.SphereGeometry(.45, 16, 10), droneCore, drone);
    box(drone, [1.45, .12, .35], [0, 0, 0], m.panel);
    for (const x of [-.68, .68]) {
      const rotor = mesh(new THREE.TorusGeometry(.26, .055, 8, 16), m.teal, drone, [x, .05, 0], [Math.PI / 2, 0, 0]);
      rotor.castShadow = false;
    }
    drone.position.set(-5, 6.3, 1);
    this.station.add(drone);
    visuals['pump-bot'] = drone;

    const stockUpgrade = new THREE.Group();
    const stockDrone = drone.clone();
    stockDrone.traverse(child => {
      if (!child.isMesh) return;
      if (child.material === droneCore) child.material = stockCore;
      else if (child.material === m.teal) child.material = m.amber;
    });
    stockDrone.position.set(2.2, 5.7, -1.7);
    stockUpgrade.add(stockDrone);
    const shelfLights = new THREE.Group();
    shelfLights.position.copy(this.shop.position);
    for (const x of [-2.8, -1.45, -.1, 1.25, 2.6]) {
      box(shelfLights, [.82, .08, .1], [x, 1.25, 2.75], m.amber);
      box(shelfLights, [.82, .08, .1], [x, 2.25, 2.75], m.amber);
      const shelfGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glows.amber, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
      shelfGlow.position.set(x, 1.75, 2.82);
      shelfGlow.scale.set(1.1, 1.6, 1);
      shelfLights.add(shelfGlow);
    }
    const martLight = new THREE.PointLight(COLORS.amber, 24, 12, 2);
    martLight.position.set(2.5, 2.7, -1.2);
    stockUpgrade.add(martLight);
    stockUpgrade.add(shelfLights);
    stockUpgrade.userData.drone = stockDrone;
    this.station.add(stockUpgrade);
    visuals['stock-drone'] = stockUpgrade;

    const solar = new THREE.Group();
    solar.position.set(2.5, 6.1, -5.2);
    for (const side of [-1, 1]) {
      const wing = box(solar, [5.4, .12, 2.5], [side * 3.35, .2, 0], new THREE.MeshStandardMaterial({ color: 0x3f68a8, roughness: .26, metalness: .72, emissive: 0x152856, emissiveIntensity: .55 }), [0, 0, side * -.08]);
      for (let x = -2; x <= 2; x += 1) box(wing, [.035, .04, 2.5], [x, .08, 0], m.gold);
    }
    this.station.add(solar);
    visuals['solar-wings'] = solar;

    const manifold = new THREE.Group();
    manifold.position.copy(this.canopy.position);
    for (const z of [-1.55, 1.55]) {
      const line = box(manifold, [8.4, .13, .13], [0, 5.48, z], m.teal);
      line.castShadow = false;
      for (const x of [-3.6, 0, 3.6]) {
        cylinder(manifold, [.12, .12, .62, 10], [x, 5.78, z], m.panel);
        const node = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glows.teal, transparent: true, opacity: .72, blending: THREE.AdditiveBlending, depthWrite: false }));
        node.position.set(x, 6.08, z);
        node.scale.set(.72, .72, 1);
        manifold.add(node);
      }
    }
    this.station.add(manifold);
    visuals['twin-pumps'] = manifold;

    const beacon = new THREE.Group();
    beacon.position.set(0, 0, 7);
    cylinder(beacon, [.18, .26, 5.8, 12], [0, 2.9, 0], m.panel);
    const ring = mesh(new THREE.TorusGeometry(2.2, .08, 10, 50), m.teal, beacon, [0, 5.1, 0], [Math.PI / 2, 0, 0]);
    ring.userData.spin = true;
    const beaconBeam = cylinder(beacon, [.2, .8, 4.2, 24], [0, 3, 0], new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: .08, side: THREE.DoubleSide, depthWrite: false }));
    beaconBeam.castShadow = false;
    beacon.userData.satellites = [];
    for (let index = 0; index < 3; index += 1) {
      const satellite = mesh(new THREE.SphereGeometry(.14, 10, 8), index === 1 ? m.amber : m.teal, beacon, [0, 5.1, 0]);
      satellite.castShadow = false;
      satellite.userData.phase = index / 3 * Math.PI * 2;
      beacon.userData.satellites.push(satellite);
    }
    this.station.add(beacon);
    visuals['queue-beacon'] = beacon;

    const tankShell = new THREE.Group();
    cylinder(tankShell, [2.42, 2.42, 6.8, 32], [0, 3.3, 0], new THREE.MeshStandardMaterial({ color: 0x224d64, roughness: .28, metalness: .75, transparent: true, opacity: .72, emissive: 0x0a3144, emissiveIntensity: .7 }), [0, 0, Math.PI / 2]);
    tankShell.position.copy(this.tank.position);
    this.station.add(tankShell);
    visuals['nano-seal'] = tankShell;

    const arm = new THREE.Group();
    arm.position.set(9.2, 0, .25);
    cylinder(arm, [.48, .72, 1.1, 18], [0, .55, 0], m.violet);
    arm.userData.arms = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = index / 4 * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.y = angle;
      pivot.position.y = 1.05;
      cylinder(pivot, [.1, .15, 2.6, 10], [0, 1.1, 0], m.panel, [0, 0, -.75]);
      arm.add(pivot);
      pivot.userData.baseAngle = angle;
      arm.userData.arms.push(pivot);
    }
    this.station.add(arm);
    visuals['garage-arm'] = arm;

    const clone = this.createAlien();
    clone.position.set(-.2, .1, -.35);
    clone.scale.set(.9, .9, .9);
    clone.traverse(child => { if (child.isMesh) child.castShadow = true; });
    this.station.add(clone);
    visuals['service-clone'] = clone;

    const quantum = new THREE.Group();
    for (let index = 0; index < 3; index += 1) {
      const ring = mesh(new THREE.TorusGeometry(12.4 + index * .5, .045, 8, 96), index === 0 ? m.teal : index === 1 ? m.amber : m.violet, quantum, [0, .22 + index * .035, 0], [-Math.PI / 2, 0, index * .18]);
      ring.castShadow = false;
    }
    this.station.add(quantum);
    visuals['quantum-forecourt'] = quantum;

    const canopyUpgrade = new THREE.Group();
    canopyUpgrade.position.copy(this.canopy.position);
    canopyUpgrade.userData.strips = [];
    for (let index = 0; index < 7; index += 1) {
      const color = index % 2 ? COLORS.violet : COLORS.teal;
      const stripMaterial = new THREE.MeshStandardMaterial({ color, roughness: .28, metalness: .42, emissive: color, emissiveIntensity: 1.45, transparent: true, opacity: .9 });
      const strip = box(canopyUpgrade, [9.8, .07, .07], [0, 5.4 + index * .08, -2.7 + index * .9], stripMaterial);
      strip.castShadow = false;
      strip.userData.phase = index / 7 * Math.PI * 2;
      canopyUpgrade.userData.strips.push(strip);
    }
    this.station.add(canopyUpgrade);
    visuals['holo-canopy'] = canopyUpgrade;

    const kitchen = new THREE.Group();
    kitchen.position.set(2.5, 4.2, -2.3);
    const dish = mesh(new THREE.CylinderGeometry(1.2, .2, .5, 32, 1, false, 0, Math.PI), m.amber, kitchen, [0, 1.1, 0], [0, 0, Math.PI / 2]);
    dish.scale.z = .35;
    const kitchenWindow = mesh(new THREE.CircleGeometry(.78, 32), new THREE.MeshBasicMaterial({ color: COLORS.amber, transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false }), kitchen, [0, .35, .04]);
    kitchenWindow.castShadow = false;
    const chef = new THREE.Group();
    cylinder(chef, [.14, .28, .72, 12], [0, .36, 0], m.amber);
    mesh(new THREE.SphereGeometry(.25, 12, 8), m.white, chef, [0, .88, 0]);
    const chefHalo = mesh(new THREE.TorusGeometry(.42, .035, 8, 28), m.amber, chef, [0, .92, 0], [Math.PI / 2, 0, 0]);
    chefHalo.castShadow = false;
    chef.position.set(0, .15, .14);
    chef.scale.set(.72, .72, .72);
    kitchen.add(chef);
    kitchen.userData.chef = chef;
    this.station.add(kitchen);
    visuals['synth-kitchen'] = kitchen;

    Object.values(visuals).forEach(visual => { visual.visible = false; });
    return visuals;
  }

  buildAttraction() {
    const attraction = new THREE.Group();
    attraction.position.set(22, 3, -19);
    attraction.rotation.set(.2, -.5, -.15);
    this.scene.add(attraction);
    for (let index = 0; index < 3; index += 1) {
      const ring = mesh(new THREE.TorusGeometry(5.4 - index * .85, .18, 10, 64), index === 1 ? this.materials.violet : this.materials.teal, attraction, [0, 0, 0], [index * .65, index * .45, index * .35]);
      ring.castShadow = false;
    }
    const core = mesh(new THREE.IcosahedronGeometry(1.3, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7c43ff, emissiveIntensity: 3, roughness: .2 }), attraction);
    core.castShadow = false;
    const light = new THREE.PointLight(0xc45cff, 35, 45, 2);
    attraction.add(light);
    this.attraction = attraction;
  }

  buildArrivalVector() {
    this.arrivalVector = new THREE.Group();
    this.arrivalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(20.8, 1.25, -15.8),
      new THREE.Vector3(19.2, .9, -8.4),
      new THREE.Vector3(17.2, .62, -.4),
      new THREE.Vector3(15.1, .48, 6.4),
      new THREE.Vector3(12.9, .4, 10.7)
    ]);
    const routeMaterial = new THREE.LineDashedMaterial({
      color: COLORS.teal,
      transparent: true,
      opacity: .18,
      depthWrite: false,
      depthTest: false,
      dashSize: .72,
      gapSize: .46
    });
    const routeGeometry = new THREE.BufferGeometry().setFromPoints(this.arrivalCurve.getPoints(72));
    this.arrivalRoute = new THREE.Line(routeGeometry, routeMaterial);
    this.arrivalRoute.computeLineDistances();
    this.arrivalRoute.renderOrder = 18;
    this.arrivalVector.add(this.arrivalRoute);

    this.arrivalPips = [];
    for (let index = 0; index < 5; index += 1) {
      const material = new THREE.SpriteMaterial({
        map: this.glows.teal,
        color: COLORS.white,
        transparent: true,
        opacity: .55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      });
      const pip = new THREE.Sprite(material);
      pip.scale.set(.82, .82, 1);
      pip.renderOrder = 19;
      pip.userData.trailIndex = index;
      this.arrivalVector.add(pip);
      this.arrivalPips.push(pip);
    }

    this.arrivalGateRings = [];
    const gatePoint = this.arrivalCurve.getPointAt(.98);
    for (let index = 0; index < 3; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: COLORS.teal,
        transparent: true,
        opacity: .16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      });
      const ring = mesh(
        new THREE.TorusGeometry(.68 + index * .38, .035, 8, 38),
        material,
        this.arrivalVector,
        [gatePoint.x, .24 + index * .035, gatePoint.z],
        [Math.PI / 2, 0, 0]
      );
      ring.castShadow = false;
      ring.renderOrder = 18;
      ring.userData.baseScale = 1 + index * .05;
      this.arrivalGateRings.push(ring);
    }
    this.arrivalVector.visible = false;
    this.scene.add(this.arrivalVector);
  }

  buildAmbientTraffic() {
    this.ambientVehicles = [];
    for (let index = 0; index < 7; index += 1) {
      const vehicle = this.createVehicle(index % 5, index % 6, true);
      vehicle.userData.angle = index / 7 * Math.PI * 2;
      vehicle.userData.speed = .035 + (index % 3) * .008;
      vehicle.scale.setScalar(.7 + (index % 2) * .12);
      this.scene.add(vehicle);
      this.ambientVehicles.push(vehicle);
    }
  }

  createVehicle(type = 0, species = 0, ambient = false) {
    const colors = [0x32d6c4, 0xf2ad43, 0xbd5af0, 0xe65d74, 0x5b7ee8];
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: colors[type % colors.length], roughness: .34, metalness: .68, emissive: colors[type % colors.length], emissiveIntensity: .14 });
    const group = new THREE.Group();
    const length = 2.45 + (type % 3) * .26;
    box(group, [1.65, .48, length], [0, .52, 0], bodyMaterial);
    const nose = mesh(new THREE.SphereGeometry(.84, 16, 10), bodyMaterial, group, [0, .55, -length * .43]);
    nose.scale.set(1, .45, .9);
    const cabin = mesh(new THREE.SphereGeometry(.68, 16, 10), this.materials.glass, group, [0, .92, .14]);
    cabin.scale.set(1, .58, 1.25);
    for (const x of [-.88, .88]) {
      const pod = cylinder(group, [.18, .28, 1.5, 12], [x, .35, .16], this.materials.dark, [Math.PI / 2, 0, 0]);
      pod.castShadow = false;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: type % 2 ? this.glows.amber : this.glows.teal, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(x, .28, .98);
      glow.scale.set(.75, .75, 1);
      group.add(glow);
      const trail = mesh(
        new THREE.ConeGeometry(.2, 1.15, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: type % 2 ? COLORS.amber : COLORS.teal, transparent: true, opacity: .24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
        group,
        [x, .28, 1.58],
        [Math.PI / 2, 0, 0]
      );
      trail.castShadow = false;
    }
    if (!ambient) {
      const head = mesh(new THREE.SphereGeometry(.22 + species % 2 * .03, 10, 8), new THREE.MeshStandardMaterial({ color: [0x92d77e, 0xb48cf0, 0x6ecbc4, 0xe39c74, 0xa8d9ed, 0xdf79b7][species % 6], roughness: .7 }), group, [0, 1.05, .05]);
      head.scale.set(1.15, .9, .9);
    }
    group.userData.target = new THREE.Vector3();
    group.userData.displayPosition = new THREE.Vector3(28, 2, 24);
    group.userData.phase = Math.random() * Math.PI * 2;
    group.position.copy(group.userData.displayPosition);
    return group;
  }

  setMode(mode) {
    this.mode = mode;
    if (this.arrivalVector) this.arrivalVector.visible = mode === 'play';
    if (this.queueConstellation) this.queueConstellation.visible = mode === 'play';
    if (this.shiftHorizon) this.shiftHorizon.visible = mode === 'play';
    if (this.debtLienRoot) this.debtLienRoot.visible = mode === 'play';
    if (this.decisionLegacyRoot) this.decisionLegacyRoot.visible = mode === 'play';
    if (this.activeDecisionReveal) this.activeDecisionReveal.object.visible = mode === 'play';
    if (mode === 'title') {
      this.desiredPosition.set(25, 16, 31);
      this.desiredTarget.set(0, 2.3, -1);
    }
  }

  setFocus(focus, immediate = false) {
    this.focus = focus;
    const views = {
      forecourt: { position: [18, 13, 23], target: [-.6, 2.2, .2] },
      mart: { position: [10.5, 7.5, 10.8], target: [2.6, 2.6, -3.6] },
      engineering: { position: [-20, 8.6, 8.8], target: [-8.6, 2.6, -2.1] },
      vista: { position: [27, 18, 31], target: [4, 3.1, -4] }
    };
    const view = views[focus] || views.forecourt;
    this.desiredPosition.set(...view.position);
    this.desiredTarget.set(...view.target);
    if (immediate) {
      this.camera.position.copy(this.desiredPosition);
      this.cameraTarget.copy(this.desiredTarget);
    }
  }

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
    this.canvas.dataset.queueMotion = this.reducedMotion ? 'reduced' : 'full';
    this.canvas.dataset.shiftMotion = this.reducedMotion ? 'reduced' : 'full';
    this.canvas.dataset.debtMotion = this.reducedMotion ? 'reduced' : 'full';
    this.canvas.dataset.decisionMotion = this.reducedMotion ? 'reduced' : 'full';
    this.canvas.dataset.decisionRevealMotion = this.reducedMotion ? 'reduced' : 'full';
  }

  setDebtLiberation(relief) {
    if (!this.debtLienRoot) return;
    const normalized = debtLiberation({ debt: relief?.debt });
    this.debtState = normalized;
    this.debtLienRoot.visible = this.mode === 'play';
    const signature = `${Math.round(normalized.debt)}|${normalized.phase}|${normalized.links}`;
    if (signature === this.lastDebtSignature) return;
    this.lastDebtSignature = signature;

    const color = normalized.tone === 'clear'
      ? COLORS.teal
      : normalized.tone === 'opportunity'
        ? COLORS.blue
        : COLORS.amber;
    this.debtMaterials.forEach(material => {
      if (material === this.debtLienLabel.material) return;
      material.color?.setHex(color);
      material.emissive?.setHex(color);
    });
    this.debtLockLight.color.setHex(color);
    this.debtLockLight.intensity = normalized.cleared ? 18 : 10 + normalized.progress * 5;
    this.debtLienBoundary.material.opacity = normalized.cleared ? .38 : .18 + normalized.progress * .1;
    this.debtLienBeam.material.opacity = normalized.cleared ? .12 : .055 + normalized.remaining * .045;
    this.debtLienLinks.forEach((link, index) => {
      const active = index < normalized.links;
      link.node.visible = active;
      link.tether.visible = active;
      link.glow.material.color.setHex(color);
    });
    const jawOpening = normalized.cleared ? 1 : normalized.progress * .18;
    this.debtLockLeft.position.x = -.54 - jawOpening * .78;
    this.debtLockRight.position.x = .54 + jawOpening * .78;
    this.debtLockLeft.rotation.z = -.08 - jawOpening * .38;
    this.debtLockRight.rotation.z = .08 + jawOpening * .38;
    this.debtLockCore.scale.setScalar(.92 + normalized.progress * .18);
    this.debtLockHalo.scale.setScalar(1 + normalized.progress * .22);
    this.debtLabelRenderer.draw(normalized.debt, normalized.phase, normalized.tone, normalized.progress);
    this.canvas.dataset.debtStage = normalized.phase;
    this.canvas.dataset.debtTone = normalized.tone;
    this.canvas.dataset.debtProgress = normalized.progress.toFixed(3);
    this.canvas.dataset.debtLinks = String(normalized.links);
    this.canvas.dataset.debtMotion = this.reducedMotion ? 'reduced' : 'full';
  }

  setShiftAtmosphere(atmosphere) {
    if (!atmosphere || !this.shiftHorizon) return;
    const tone = ['dawn', 'day', 'dusk', 'night'].includes(atmosphere.tone) ? atmosphere.tone : 'day';
    const progress = Math.min(1, Math.max(0, Number(atmosphere.progress) || 0));
    this.shiftState = {
      phase: String(atmosphere.phase || 'HIGH ORBIT'),
      tone,
      progress,
      time: String(atmosphere.time || '07:00')
    };
    const palette = {
      dawn: { signal: 0xff806c, sky: 0xb8c9ff, ground: 0x34172c, key: 0xffd6b7, nebula: 0xff477c, exposure: 1.08, glow: 'dawn' },
      day: { signal: COLORS.teal, sky: 0x9ad8ff, ground: 0x182b3c, key: 0xe8f6ff, nebula: 0xb63dff, exposure: 1.05, glow: 'teal' },
      dusk: { signal: 0xff8b52, sky: 0xc08dff, ground: 0x3d172e, key: 0xffbd83, nebula: 0xff3f8e, exposure: 1.08, glow: 'amber' },
      night: { signal: 0x737aff, sky: 0x7585d6, ground: 0x11152e, key: 0xa8c7ff, nebula: 0x7b39ff, exposure: .96, glow: 'night' }
    }[tone];
    const triangular = (center, width) => Math.max(0, 1 - Math.abs(progress - center) / width);
    this.skyMaterial.uniforms.uDawn.value = triangular(.08, .25);
    this.skyMaterial.uniforms.uDusk.value = triangular(.67, .27);
    this.skyMaterial.uniforms.uNight.value = Math.min(1, Math.max(0, (progress - .7) / .25));
    this.hemisphereLight.color.setHex(palette.sky);
    this.hemisphereLight.groundColor.setHex(palette.ground);
    this.hemisphereLight.intensity = tone === 'night' ? .82 : tone === 'day' ? 1.42 : 1.18;
    this.keyLight.color.setHex(palette.key);
    this.keyLight.intensity = tone === 'night' ? 1.72 : tone === 'day' ? 2.55 : 2.28;
    this.nebulaLight.color.setHex(palette.nebula);
    this.nebulaLight.intensity = tone === 'night' ? 42 : tone === 'day' ? 50 : 61;
    this.stationLight.intensity = this.stationBaseIntensity * (tone === 'night' ? .78 : tone === 'day' ? 1.08 : .94);
    this.renderer.toneMappingExposure = palette.exposure;
    this.stars.material.opacity = tone === 'night' ? 1 : tone === 'day' ? .68 : .86;
    this.shiftHorizonRings.forEach(ring => ring.material.color.setHex(palette.signal));
    this.shiftHorizonMarkers.forEach(marker => {
      const reached = marker.userData.progress <= progress + .001;
      marker.material.color.setHex(palette.signal);
      marker.material.emissive.setHex(palette.signal);
      marker.material.emissiveIntensity = reached ? 1.7 : .35;
      marker.material.opacity = reached ? .88 : .2;
      marker.scale.setScalar(reached ? 1.15 : .82);
    });
    const angle = Math.PI * (1 - progress);
    this.shiftOrb.position.set(Math.cos(angle) * 24.1, Math.sin(angle) * 24.1, 0);
    this.shiftOrbCore.material.color.setHex(palette.signal);
    this.shiftOrbCore.material.emissive.setHex(palette.signal);
    this.shiftOrbGlow.material.map = this.glows[palette.glow];
    this.shiftOrbGlow.material.needsUpdate = true;
    this.shiftOrbLight.color.setHex(palette.signal);
    this.shiftHorizon.visible = this.mode === 'play';
    this.canvas.dataset.shiftPhase = this.shiftState.phase;
    this.canvas.dataset.shiftTone = this.shiftState.tone;
    this.canvas.dataset.shiftProgress = this.shiftState.progress.toFixed(3);
  }

  setArrivalForecast(forecast) {
    if (!forecast || !this.arrivalVector) return;
    this.arrivalState = {
      phase: String(forecast.phase || 'ON VECTOR'),
      tone: ['steady', 'warning', 'danger'].includes(forecast.tone) ? forecast.tone : 'steady',
      progress: Math.min(1, Math.max(0, Number(forecast.progress) || 0)),
      seconds: Math.max(0, Number(forecast.seconds) || 0),
      burst: Math.max(0, Math.round(Number(forecast.burst) || 0))
    };
    const color = this.arrivalState.tone === 'danger' ? COLORS.red : this.arrivalState.tone === 'warning' ? COLORS.amber : COLORS.teal;
    const glow = this.arrivalState.tone === 'danger' ? this.glows.red : this.arrivalState.tone === 'warning' ? this.glows.amber : this.glows.teal;
    this.arrivalRoute.material.color.setHex(color);
    this.arrivalPips.forEach(pip => {
      pip.material.map = glow;
      pip.material.needsUpdate = true;
    });
    this.arrivalGateRings.forEach(ring => ring.material.color.setHex(color));
    this.canvas.dataset.arrivalPhase = this.arrivalState.phase;
    this.canvas.dataset.arrivalTone = this.arrivalState.tone;
    this.canvas.dataset.arrivalProgress = this.arrivalState.progress.toFixed(3);
  }

  setQueueConstellation(telemetry) {
    if (!telemetry || !this.queueConstellation) return;
    const lanes = Array.isArray(telemetry.lanes) ? telemetry.lanes : [];
    this.queueState = {
      total: Math.max(0, Math.round(Number(telemetry.total) || 0)),
      dominantLane: QUEUE_SIGNALS[telemetry.dominantLane] ? telemetry.dominantLane : null,
      lanes
    };
    for (const [lane, definition] of Object.entries(QUEUE_SIGNALS)) {
      const laneState = lanes.find(item => item.lane === lane) || { count: 0, visiblePips: 0, overflow: 0, urgency: 0, tone: 'clear', phase: 'CLEAR' };
      const signal = this.queueSignals[lane];
      const count = Math.max(0, Math.round(Number(laneState.count) || 0));
      const visiblePips = Math.min(5, Math.max(0, Math.round(Number(laneState.visiblePips) || 0)));
      const overflow = Math.max(0, Math.round(Number(laneState.overflow) || 0));
      const urgency = Math.min(1, Math.max(0, Number(laneState.urgency) || 0));
      const tone = ['steady', 'warning', 'danger'].includes(laneState.tone) ? laneState.tone : 'clear';
      const color = tone === 'danger' ? COLORS.red : tone === 'warning' ? COLORS.amber : definition.color;
      const glowMap = tone === 'danger' ? this.glows.red : tone === 'warning' ? this.glows.amber : this.glows[definition.glow];
      signal.visible = count > 0;
      signal.userData.urgency = urgency;
      signal.userData.tone = tone;
      signal.userData.beam.material.color.setHex(color);
      signal.userData.beam.material.opacity = .055 + urgency * .18;
      signal.userData.ring.material.color.setHex(color);
      signal.userData.ring.material.opacity = .22 + urgency * .42;
      signal.userData.pips.forEach((pip, index) => {
        pip.visible = index < visiblePips;
        pip.material.color.setHex(color);
        pip.material.emissive.setHex(color);
        pip.material.emissiveIntensity = 1.15 + urgency * 2.1;
      });
      signal.userData.crown.visible = overflow > 0;
      signal.userData.crown.material.color.setHex(color);
      signal.userData.crown.material.opacity = .35 + urgency * .4;
      signal.userData.glow.material.map = glowMap;
      signal.userData.glow.material.needsUpdate = true;
      signal.userData.glow.material.opacity = .16 + urgency * .38;
      const phase = String(laneState.phase || 'CLEAR').toUpperCase();
      const signature = `${count}|${phase}|${tone}|${overflow}`;
      if (signature !== signal.userData.signature) {
        signal.userData.labelRenderer.draw(count, phase, tone, overflow);
        signal.userData.signature = signature;
      }
    }
    this.queueConstellation.visible = this.mode === 'play';
    this.canvas.dataset.queueLoads = Object.keys(QUEUE_SIGNALS).map(lane => `${lane}:${lanes.find(item => item.lane === lane)?.count || 0}`).join('|');
    this.canvas.dataset.queueLead = this.queueState.dominantLane || 'none';
    this.canvas.dataset.queueDanger = lanes.find(item => item.tone === 'danger')?.lane || 'none';
    this.canvas.dataset.queueTones = Object.keys(QUEUE_SIGNALS).map(lane => `${lane}:${lanes.find(item => item.lane === lane)?.tone || 'clear'}`).join('|');
  }

  setQualityPreset(value) {
    const profile = RENDER_QUALITY_PRESETS[value] || RENDER_QUALITY_PRESETS[DEFAULT_RENDER_QUALITY];
    this.qualityPreset = profile.id;
    this.renderer.shadowMap.enabled = profile.shadows;
    this.stars.geometry.setDrawRange(0, profile.stars);
    this.stationDust.geometry.setDrawRange(0, profile.dust);
    this.rimLights.forEach((light, index) => { light.visible = index % profile.rimStride === 0; });
    this.scene.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      materials.forEach(material => { material.needsUpdate = true; });
    });
    this.resize();
    return this.getRenderProfile();
  }

  getRenderProfile() {
    const profile = RENDER_QUALITY_PRESETS[this.qualityPreset];
    return {
      id: profile.id,
      label: profile.label,
      pixelRatio: this.renderer.getPixelRatio(),
      maxPixelRatio: this.canvas.clientWidth < 700 ? Math.min(profile.pixelRatio, 1.2) : profile.pixelRatio,
      shadows: this.renderer.shadowMap.enabled,
      stars: this.stars.geometry.drawRange.count,
      dust: this.stationDust.geometry.drawRange.count,
      rimLights: this.rimLights.filter(light => light.visible).length
    };
  }

  syncState(state) {
    if (!state) return;
    const liveIds = new Set(state.customers.map(customer => customer.id));
    for (const [id, visual] of this.customerVisuals) {
      if (!liveIds.has(id)) {
        const born = performance.now();
        const outcome = visual.userData.departureOutcome || 'neutral';
        visual.userData.departing = true;
        visual.userData.departAt = born;
        this.customerVisuals.delete(id);
        this.effects.push({
          type: 'depart',
          object: visual,
          outcome,
          lane: visual.userData.lane,
          born,
          duration: this.reducedMotion ? 540 : outcome === 'lost' ? 1380 : 1160,
          startPosition: visual.position.clone(),
          startScale: visual.scale.clone(),
          startRotation: visual.rotation.clone()
        });
      }
    }
    const lanePositions = {
      fuel: { x: -5.0, z: 6.1, dx: -2.5 },
      mart: { x: 2.5, z: 4.25, dx: 2.4 },
      garage: { x: 9.15, z: 4.55, dx: 2.5 }
    };
    for (const lane of Object.keys(lanePositions)) {
      const queue = state.customers.filter(customer => customer.lane === lane);
      queue.forEach((customer, index) => {
        let visual = this.customerVisuals.get(customer.id);
        if (!visual) {
          visual = this.createVehicle(customer.vehicle, customer.species);
          visual.userData.customerId = customer.id;
          visual.userData.lane = lane;
          visual.userData.displayPosition.set(25 + Math.random() * 3, 1.6, 20 + Math.random() * 4);
          visual.position.copy(visual.userData.displayPosition);
          this.scene.add(visual);
          this.customerVisuals.set(customer.id, visual);
        }
        const base = lanePositions[lane];
        const row = Math.floor(index / 2);
        const column = index % 2;
        visual.userData.target.set(base.x + (column ? base.dx : 0), .38, base.z + row * 3.15);
        visual.userData.mood = customer.mood;
        visual.userData.patience = customer.patience / customer.maxPatience;
        visual.userData.queueIndex = index;
      });
    }

    const signature = state.upgrades.slice().sort().join('|');
    if (signature !== this.lastUpgradeSignature) {
      for (const [id, visual] of Object.entries(this.upgradeVisuals)) visual.visible = state.upgrades.includes(id);
      this.lastUpgradeSignature = signature;
    }
    const sealed = state.upgrades.includes('nano-seal');
    const patched = state.upgrades.includes('patch-kit');
    this.leakGlow.visible = !sealed;
    this.leakGlow.scale.setScalar(patched ? 1.45 : 2.7);
    this.leakDrops.forEach(drop => { drop.visible = !sealed; drop.scale.setScalar(patched ? .65 : 1); });
    this.reviewPressure = Math.min(1, Math.max(0, state.badReviews / 1000));
    this.skyMaterial.uniforms.uPressure.value = this.reviewPressure;
    const level = state.upgrades.length;
    this.upgradeLevel = level;
    this.stationBaseIntensity = 34 + level * 3;
    this.skyMaterial.uniforms.uIntensity.value = 1 + Math.min(.16, level * .012);
    this.setShiftAtmosphere(this.shiftState);
    this.shop.children.forEach(child => {
      if (child.material === this.materials.worn && state.upgrades.includes('holo-canopy')) child.material = this.materials.panel;
    });
  }

  flashDebtPayment(beforeDebt, afterDebt) {
    const before = Number(beforeDebt);
    const after = Number(afterDebt);
    if (!Number.isFinite(before) || !Number.isFinite(after) || before <= after) return false;
    const cleared = before > 0 && after <= 0;
    const color = cleared ? COLORS.teal : COLORS.amber;
    const glow = this.glows[cleared ? 'teal' : 'amber'];
    const root = new THREE.Group();
    root.name = cleared ? 'debt-lien-release' : 'debt-payment-pulse';
    root.position.set(0, 7.15, -2.4);
    root.visible = this.mode === 'play';
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: .76,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = mesh(new THREE.TorusGeometry(1.35, .09, 8, 52), material, root);
    ring.castShadow = false;
    const crossRing = mesh(new THREE.TorusGeometry(1.02, .055, 8, 44), material.clone(), root, [0, 0, 0], [Math.PI / 2, 0, 0]);
    crossRing.castShadow = false;
    const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: .68, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
    flare.scale.set(cleared ? 5.4 : 3.8, cleared ? 5.4 : 3.8, 1);
    flare.renderOrder = 72;
    root.add(flare);
    const light = new THREE.PointLight(color, cleared ? 28 : 17, 22, 2);
    root.add(light);
    this.scene.add(root);
    const effect = {
      type: 'debt-payment',
      object: root,
      ring,
      crossRing,
      flare,
      light,
      cleared,
      born: performance.now(),
      duration: this.reducedMotion ? 760 : cleared ? 1900 : 1320
    };
    this.effects.push(effect);
    this.canvas.dataset.debtPayment = cleared ? 'cleared' : 'payment';
    this.canvas.dataset.debtPaymentPhase = this.reducedMotion ? 'static-confirmation' : 'active';
    return true;
  }

  flashService(lane, outcome = 'manual') {
    const normalized = typeof outcome === 'boolean' ? outcome ? 'manual' : 'blocked' : outcome;
    const resolvedOutcome = SERVICE_OUTCOMES.has(normalized) ? normalized : 'manual';
    const laneSpec = SERVICE_LANES[lane] || SERVICE_LANES.fuel;
    const success = resolvedOutcome === 'manual' || resolvedOutcome === 'automated';
    const alert = resolvedOutcome === 'lost' || resolvedOutcome === 'blocked';
    const color = alert ? COLORS.red : laneSpec.color;
    const glow = alert ? this.glows.red : this.glows[laneSpec.glow];
    const front = [...this.customerVisuals.values()]
      .filter(visual => visual.userData.lane === lane)
      .sort((a, b) => (a.userData.queueIndex ?? 999) - (b.userData.queueIndex ?? 999))[0];

    if (front && (success || resolvedOutcome === 'lost')) {
      front.userData.departureOutcome = success ? 'served' : 'lost';
      if (!front.userData.departureFlare) {
        const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
        flare.position.set(0, .62, 1.45);
        flare.scale.set(2.6, 2.6, 1);
        flare.renderOrder = 40;
        front.add(flare);
        front.userData.departureFlare = flare;
      }
    }

    const root = new THREE.Group();
    root.userData.serviceOutcome = resolvedOutcome;
    const origin = new THREE.Vector3(...laneSpec.position);
    const source = new THREE.Vector3(...laneSpec.source);
    const target = resolvedOutcome === 'blocked'
      ? origin.clone()
      : front
        ? front.position.clone().add(new THREE.Vector3(0, .72, 0))
        : origin.clone().add(new THREE.Vector3(laneSpec.exit * 2.4, 1.65, 1.2));
    const materials = [];

    const ringMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .78, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    ringMaterial.userData.effectOpacity = .78;
    materials.push(ringMaterial);
    const ring = mesh(new THREE.RingGeometry(.74, 1.06, 40), ringMaterial, root, origin.toArray(), [-Math.PI / 2, 0, 0]);
    ring.castShadow = false;
    ring.receiveShadow = false;

    let curve = null;
    let beam = null;
    const packets = [];
    if (resolvedOutcome !== 'blocked') {
      const control = source.clone().lerp(target, .5);
      control.y = Math.max(source.y, target.y) + (success ? 2.8 : 1.85);
      curve = new THREE.QuadraticBezierCurve3(source, control, target);
      const beamMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: success ? .42 : .3, depthWrite: false, blending: THREE.AdditiveBlending });
      beamMaterial.userData.effectOpacity = success ? .42 : .3;
      materials.push(beamMaterial);
      beam = mesh(new THREE.TubeGeometry(curve, 28, success ? .07 : .045, 7, false), beamMaterial, root);
      beam.castShadow = false;
      beam.receiveShadow = false;

      const packetMaterial = new THREE.MeshBasicMaterial({ color: resolvedOutcome === 'automated' ? COLORS.white : color, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
      packetMaterial.userData.effectOpacity = .9;
      materials.push(packetMaterial);
      const packetCount = resolvedOutcome === 'automated' ? 6 : success ? 4 : 3;
      for (let index = 0; index < packetCount; index += 1) {
        const packet = mesh(new THREE.OctahedronGeometry(resolvedOutcome === 'automated' ? .16 : .13, 0), packetMaterial, root);
        packet.castShadow = false;
        packet.receiveShadow = false;
        packet.userData.offset = index / packetCount;
        packet.position.copy(curve.getPoint((index + 1) / (packetCount + 1)));
        packets.push(packet);
      }
    }

    const glyph = new THREE.Group();
    glyph.position.copy(target).add(new THREE.Vector3(0, .92, 0));
    root.add(glyph);
    const glyphMaterial = new THREE.MeshBasicMaterial({ color: resolvedOutcome === 'automated' ? COLORS.white : color, transparent: true, opacity: .92, depthWrite: false, blending: THREE.AdditiveBlending });
    glyphMaterial.userData.effectOpacity = .92;
    materials.push(glyphMaterial);
    if (alert) {
      box(glyph, [1.2, .12, .12], [0, 0, 0], glyphMaterial, [0, 0, .72]).castShadow = false;
      box(glyph, [1.2, .12, .12], [0, 0, 0], glyphMaterial, [0, 0, -.72]).castShadow = false;
    } else if (resolvedOutcome === 'automated') {
      for (let index = 0; index < 2; index += 1) {
        const orbit = mesh(new THREE.TorusGeometry(.42 + index * .22, .055, 7, 32), glyphMaterial, glyph, [0, 0, 0], [index * .72, index * .38, 0]);
        orbit.castShadow = false;
      }
    } else {
      for (let index = 0; index < 3; index += 1) {
        const chevron = mesh(new THREE.ConeGeometry(.2, .5, 4), glyphMaterial, glyph, [0, index * .34 - .34, 0], [0, 0, Math.PI]);
        chevron.castShadow = false;
      }
    }

    const beaconMaterial = new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: .46, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false });
    beaconMaterial.userData.effectOpacity = .46;
    materials.push(beaconMaterial);
    const beacon = new THREE.Sprite(beaconMaterial);
    beacon.position.copy(target);
    beacon.scale.set(success ? 3.4 : 2.5, success ? 3.4 : 2.5, 1);
    beacon.renderOrder = 39;
    root.add(beacon);
    const sourceBeacon = new THREE.Sprite(beaconMaterial);
    sourceBeacon.position.copy(source);
    sourceBeacon.scale.set(1.8, 1.8, 1);
    sourceBeacon.renderOrder = 39;
    root.add(sourceBeacon);

    root.userData.ring = ring;
    root.userData.curve = curve;
    root.userData.beam = beam;
    root.userData.packets = packets;
    root.userData.glyph = glyph;
    root.userData.beacon = beacon;
    root.userData.sourceBeacon = sourceBeacon;
    root.userData.materials = materials;
    root.userData.originY = glyph.position.y;
    this.scene.add(root);
    this.effects.push({ type: 'service', object: root, outcome: resolvedOutcome, born: performance.now(), duration: this.reducedMotion ? 680 : 1180 });
    return { lane, outcome: resolvedOutcome, hasVehicle: Boolean(front) };
  }

  highlightUpgrade(id) {
    const visual = this.upgradeVisuals[id];
    if (!visual?.visible) return false;
    visual.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(visual);
    if (bounds.isEmpty()) return false;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.min(6.5, Math.max(.9, Math.max(size.x, size.z) * .56));
    const marker = new THREE.Group();
    marker.userData.inspectId = id;

    const outline = new THREE.Box3Helper(bounds, COLORS.teal);
    outline.material.transparent = true;
    outline.material.opacity = .9;
    outline.material.depthTest = false;
    outline.renderOrder = 70;
    marker.add(outline);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: .72, side: THREE.DoubleSide, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = mesh(new THREE.RingGeometry(radius * .82, radius, 64), ringMaterial, marker, [center.x, bounds.min.y + .08, center.z], [-Math.PI / 2, 0, 0]);
    ring.castShadow = false;
    ring.receiveShadow = false;
    ring.renderOrder = 70;

    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glows.teal, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
    beacon.position.copy(center);
    beacon.scale.set(radius * 1.5, radius * 1.5, 1);
    beacon.renderOrder = 69;
    marker.add(beacon);

    marker.userData.outline = outline;
    marker.userData.ring = ring;
    marker.userData.beacon = beacon;
    marker.userData.beaconScale = radius * 1.5;
    this.scene.add(marker);
    this.effects.push({ type: 'inspect', object: marker, born: performance.now(), duration: 2100 });
    return true;
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    if (this.debtLienLabel) {
      this.debtLienLabel.visible = width > 820;
      this.canvas.dataset.debtLabel = this.debtLienLabel.visible ? 'visible' : 'hud-only';
    }
    const profile = RENDER_QUALITY_PRESETS[this.qualityPreset] || RENDER_QUALITY_PRESETS[DEFAULT_RENDER_QUALITY];
    const qualityLimit = width < 700 ? Math.min(profile.pixelRatio, 1.2) : profile.pixelRatio;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, qualityLimit);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  disposeEffect(effect) {
    const sharedMaterials = new Set(Object.values(this.materials));
    effect.object.traverse?.(child => {
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
      materials.forEach(material => {
        if (!sharedMaterials.has(material)) material.dispose?.();
      });
    });
  }

  updateEffects(now) {
    this.effects = this.effects.filter(effect => {
      const progress = (now - effect.born) / effect.duration;
      if (progress >= 1) {
        if (effect.type === 'decision-reveal') {
          effect.artifact.scale.setScalar(1);
          effect.artifact.userData.label.material.opacity = .94;
          this.canvas.dataset.decisionRevealPhase = 'settled';
          this.canvas.dataset.decisionRevealProgress = '1.000';
          this.canvas.dataset.decisionRevealScale = '1.000';
          if (this.activeDecisionReveal === effect) this.activeDecisionReveal = null;
        }
        if (effect.type === 'debt-payment') {
          this.canvas.dataset.debtPaymentPhase = 'settled';
        }
        this.scene.remove(effect.object);
        this.disposeEffect(effect);
        return false;
      }
      if (effect.type === 'debt-payment') {
        const eased = 1 - Math.pow(1 - progress, 3);
        const ringScale = this.reducedMotion ? 1.18 : 1 + eased * (effect.cleared ? 4.2 : 2.8);
        effect.ring.scale.setScalar(ringScale);
        effect.crossRing.scale.setScalar(this.reducedMotion ? 1 : 1 + eased * (effect.cleared ? 2.6 : 1.8));
        effect.ring.rotation.z = this.reducedMotion ? 0 : progress * Math.PI * 1.7;
        effect.crossRing.rotation.z = this.reducedMotion ? 0 : -progress * Math.PI * 1.25;
        effect.ring.material.opacity = (1 - progress) * .76;
        effect.crossRing.material.opacity = (1 - progress) * .58;
        const flareScale = (effect.cleared ? 5.4 : 3.8) * (this.reducedMotion ? 1 : 1 + eased * .72);
        effect.flare.scale.set(flareScale, flareScale, 1);
        effect.flare.material.opacity = (1 - progress) * (this.reducedMotion ? .52 : .68);
        effect.light.intensity = (1 - progress) * (effect.cleared ? 28 : 17);
      } else if (effect.type === 'ring') {
        const scale = 1 + progress * 4.5;
        effect.object.scale.setScalar(scale);
        effect.object.material.opacity = 1 - progress;
        effect.object.position.y += .006;
      } else if (effect.type === 'depart') {
        const eased = 1 - Math.pow(1 - progress, 3);
        const laneSpec = SERVICE_LANES[effect.lane] || SERVICE_LANES.fuel;
        effect.object.position.copy(effect.startPosition);
        effect.object.rotation.copy(effect.startRotation);
        effect.object.scale.copy(effect.startScale);
        if (this.reducedMotion) {
          effect.object.position.y += eased * .32;
          effect.object.scale.multiplyScalar(1 - progress * .22);
        } else if (effect.outcome === 'lost') {
          effect.object.position.x += laneSpec.exit * eased * 5.8 + Math.sin(progress * Math.PI * 12) * (1 - progress) * .2;
          effect.object.position.z += eased * 7.2;
          effect.object.position.y += Math.sin(progress * Math.PI) * 1.05;
          effect.object.rotation.y -= laneSpec.exit * eased * .46;
          effect.object.rotation.z += Math.sin(progress * Math.PI * 9) * (1 - progress) * .1 - laneSpec.exit * eased * .3;
          effect.object.scale.multiplyScalar(1 - progress * .52);
        } else {
          effect.object.position.x += laneSpec.exit * eased * 7.8;
          effect.object.position.z += eased * 9.4;
          effect.object.position.y += Math.sin(progress * Math.PI) * 1.3;
          effect.object.rotation.y -= laneSpec.exit * eased * .62;
          effect.object.rotation.z -= laneSpec.exit * Math.sin(progress * Math.PI) * .22;
          effect.object.scale.multiplyScalar(1 - progress * .38);
        }
        const flare = effect.object.userData.departureFlare;
        if (flare) {
          flare.material.opacity = (1 - progress) * .82;
          flare.scale.setScalar(2.6 + progress * (effect.outcome === 'lost' ? 2.4 : 4.8));
        }
      } else if (effect.type === 'service') {
        const fade = Math.min(1, (1 - progress) * 2.8);
        const { ring, curve, packets, glyph, beacon, materials, originY } = effect.object.userData;
        materials.forEach(material => { material.opacity = material.userData.effectOpacity * fade; });
        ring.scale.setScalar(1 + (this.reducedMotion ? .08 : progress * 3.4));
        beacon.material.opacity = beacon.material.userData.effectOpacity * fade;
        beacon.scale.setScalar((effect.outcome === 'manual' || effect.outcome === 'automated' ? 3.4 : 2.5) * (1 + (this.reducedMotion ? 0 : Math.sin(progress * Math.PI) * .38)));
        if (curve) packets.forEach((packet, index) => {
          const travel = this.reducedMotion
            ? (index + 1) / (packets.length + 1)
            : Math.min(1, Math.max(0, progress * 1.45 - packet.userData.offset * .48));
          packet.position.copy(curve.getPoint(travel));
          packet.visible = this.reducedMotion || travel > .015;
          packet.rotation.y += this.reducedMotion ? 0 : .12;
        });
        glyph.position.y = originY + (this.reducedMotion ? 0 : Math.sin(progress * Math.PI * 3) * .18);
        if (!this.reducedMotion) {
          if (effect.outcome === 'automated') glyph.rotation.y += .16;
          else if (effect.outcome === 'lost') glyph.rotation.z = Math.sin(progress * Math.PI * 12) * .12;
        }
      } else if (effect.type === 'decision-reveal') {
        const frame = decisionRevealFrame(progress, this.reducedMotion);
        effect.artifact.scale.setScalar(frame.artifactScale);
        effect.artifact.userData.label.material.opacity = this.reducedMotion
          ? .94
          : .94 * Math.min(1, Math.max(0, (progress - .08) / .34));
        effect.beam.material.opacity = frame.beamOpacity;
        effect.rings.forEach((ring, index) => {
          ring.position.y = ring.userData.baseY + (this.reducedMotion ? 0 : frame.ringLift * (.5 + index * .14));
          ring.scale.setScalar(frame.ringScale * (1 - index * .08));
          ring.rotation.z = this.reducedMotion ? index * .34 : frame.shardOrbit * (index % 2 ? -1 : 1);
          ring.material.opacity = frame.ringOpacity * (1 - index * .12);
        });
        effect.shards.forEach((shard, index) => {
          const direction = index % 2 ? -1 : 1;
          const angle = shard.userData.angle + frame.shardOrbit * direction;
          shard.position.x = Math.cos(angle) * shard.userData.radius;
          shard.position.z = Math.sin(angle) * shard.userData.radius;
          shard.position.y = shard.userData.baseY + (this.reducedMotion ? 0 : frame.shardLift * (.45 + index % 4 * .08));
          shard.rotation.y = this.reducedMotion ? shard.userData.angle : angle * 1.8;
          shard.material.opacity = this.reducedMotion ? .48 : Math.max(0, .58 * (1 - progress));
        });
        effect.flare.scale.set(frame.flareScale, frame.flareScale, 1);
        effect.flare.material.opacity = this.reducedMotion ? .42 : Math.max(0, .56 * (1 - progress));
        effect.light.intensity = frame.lightIntensity;
        this.canvas.dataset.decisionRevealPhase = this.reducedMotion ? 'static-confirmation' : progress < .68 ? 'assembling' : 'imprinting';
        this.canvas.dataset.decisionRevealProgress = frame.progress.toFixed(3);
        this.canvas.dataset.decisionRevealScale = frame.artifactScale.toFixed(3);
        this.canvas.dataset.decisionRevealMotion = this.reducedMotion ? 'reduced' : 'full';
      } else if (effect.type === 'inspect') {
        const pulse = this.reducedMotion ? .78 : .58 + Math.sin(progress * Math.PI * 8) * .2;
        const fade = Math.min(1, (1 - progress) * 2.6);
        const { outline, ring, beacon, beaconScale } = effect.object.userData;
        outline.material.opacity = fade * (.55 + pulse * .4);
        ring.material.opacity = fade * (.3 + pulse * .5);
        ring.scale.setScalar(1 + progress * .22);
        beacon.material.opacity = fade * (.22 + pulse * .34);
        beacon.scale.setScalar(beaconScale * (1 + pulse * .12));
      }
      return true;
    });
  }

  render(state, delta = this.clock.getDelta()) {
    const now = performance.now();
    const time = now * .001;
    this.skyMaterial.uniforms.uTime.value = time;
    this.stars.rotation.y = time * .003;
    this.attraction.rotation.y += (this.reducedMotion ? .00025 : .0018) * delta * 60;
    this.attraction.children.forEach((child, index) => {
      if (child.isMesh && child.geometry.type === 'TorusGeometry') child.rotation.z += (.001 + index * .0008) * delta * 60;
    });

    if (!this.reducedMotion) {
      this.stationDust.rotation.y = time * .004;
      this.stationDust.position.y = Math.sin(time * .16) * .16;
    }
    this.rimLights.forEach((light, index) => {
      if (!light.visible) return;
      const chase = this.reducedMotion ? .55 : .38 + Math.max(0, Math.sin(time * 1.8 - index * .55)) * .9;
      light.material.emissiveIntensity = .65 + chase;
      light.scale.y = 1 + chase * .45;
    });
    const hazardPulse = this.reducedMotion
      ? this.reviewPressure
      : this.reviewPressure * (.55 + .45 * Math.sin(time * 4.6) ** 2);
    this.reviewBeaconOrb.material.emissiveIntensity = .35 + hazardPulse * 3.2;
    this.reviewBeaconRing.material.emissiveIntensity = .3 + hazardPulse * 2.5;
    this.reviewBeaconRing.material.opacity = .2 + hazardPulse * .65;
    this.reviewBeaconRing.scale.setScalar(1 + hazardPulse * .35);
    this.reviewBeaconLight.intensity = hazardPulse * 35;
    if (!this.reducedMotion) this.reviewBeaconRing.rotation.z += delta * .7;

    if (this.debtLienRoot.visible) {
      const liberation = this.debtState;
      const debtPulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 2.25) * .075;
      const boundaryOpacity = liberation.cleared ? .38 : .18 + liberation.progress * .1;
      const beamOpacity = liberation.cleared ? .12 : .055 + liberation.remaining * .045;
      this.debtLienBoundary.material.opacity = boundaryOpacity * (this.reducedMotion ? 1 : .88 + Math.sin(time * .9) * .12);
      this.debtLienBeam.material.opacity = beamOpacity * debtPulse;
      this.debtLockCore.rotation.y = this.reducedMotion ? 0 : time * (.22 + liberation.progress * .28);
      this.debtLockHalo.rotation.z = this.reducedMotion ? 0 : -time * (.18 + liberation.progress * .22);
      this.debtLockHalo.material.emissiveIntensity = liberation.cleared ? 2.35 : 1.5 + debtPulse * .42;
      this.debtLienLabel.material.opacity = liberation.cleared ? .96 : .84 + debtPulse * .06;
      this.debtLienLinks.forEach((link, index) => {
        if (!link.node.visible) return;
        link.node.position.y = link.baseY + (this.reducedMotion ? 0 : Math.sin(time * 1.55 + link.phase) * .12);
        link.ring.rotation.z = this.reducedMotion ? 0 : time * (index % 2 ? -.24 : .24) + link.phase;
        link.glow.scale.setScalar(2.6 * debtPulse);
        link.glow.material.opacity = this.reducedMotion ? .34 : .3 + debtPulse * .12;
        link.tether.material.opacity = (this.reducedMotion ? .18 : .14 + debtPulse * .07) * liberation.remaining;
      });
    }

    if (this.arrivalVector.visible) {
      const approach = this.arrivalState.progress;
      const signalPulse = this.reducedMotion ? 1 : .78 + Math.sin(time * 5.2) * .22;
      this.arrivalRoute.material.opacity = .1 + approach * .3;
      this.arrivalRoute.material.dashOffset = this.reducedMotion ? 0 : -time * .42;
      this.arrivalPips.forEach((pip, index) => {
        const t = Math.min(.965, Math.max(.025, .045 + approach * .9 - index * .052));
        const point = this.arrivalCurve.getPointAt(t);
        pip.position.copy(point);
        pip.position.y += .28 + index * .035;
        const emphasis = Math.max(.2, 1 - index * .15);
        const scale = (.6 + approach * .78) * emphasis * signalPulse;
        pip.scale.set(scale, scale, 1);
        pip.material.opacity = (.28 + approach * .6) * emphasis;
      });
      this.arrivalGateRings.forEach((ring, index) => {
        const ringPulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 4.2 - index * .7) * .08;
        ring.material.opacity = .08 + approach * (.2 + index * .035);
        ring.scale.setScalar(ring.userData.baseScale * ringPulse * (1 + approach * .12));
      });
    }

    if (this.queueConstellation.visible) {
      Object.values(this.queueSignals).forEach((signal, laneIndex) => {
        if (!signal.visible) return;
        const urgency = signal.userData.urgency;
        const pulse = this.reducedMotion ? 1 : 1 + Math.sin(time * (3.2 + urgency * 3.8) + laneIndex * 1.7) * (.035 + urgency * .11);
        signal.userData.ring.scale.setScalar(pulse);
        signal.userData.ring.rotation.z = this.reducedMotion ? 0 : time * (.18 + urgency * .34) * (laneIndex % 2 ? -1 : 1);
        signal.userData.pips.forEach((pip, index) => {
          if (!pip.visible) return;
          pip.position.y = pip.userData.baseY + (this.reducedMotion ? 0 : Math.sin(time * 2.3 + pip.userData.phase) * (.035 + urgency * .055));
          pip.rotation.y = this.reducedMotion ? index * .22 : time * (.32 + urgency * .7) + index;
          pip.scale.setScalar(1 + urgency * .18 * pulse);
        });
        if (signal.userData.crown.visible) {
          signal.userData.crown.rotation.z = this.reducedMotion ? 0 : -time * (.45 + urgency * .55);
          signal.userData.crown.scale.setScalar(pulse);
        }
        const glowScale = (1.55 + urgency * 1.5) * pulse;
        signal.userData.glow.scale.set(glowScale, glowScale, 1);
        signal.userData.label.material.opacity = .8 + urgency * .18;
      });
    }

    if (this.shiftHorizon.visible) {
      const shiftPulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 1.8) * .08;
      this.shiftOrbCore.rotation.y = this.reducedMotion ? 0 : time * .32;
      this.shiftOrbCore.rotation.x = this.reducedMotion ? 0 : time * .18;
      this.shiftOrbGlow.scale.set(4.8 * shiftPulse, 4.8 * shiftPulse, 1);
      this.shiftOrbGlow.material.opacity = this.reducedMotion ? .72 : .64 + Math.sin(time * 2.1) * .12;
      this.shiftOrbLight.intensity = this.reducedMotion ? 13 : 13 + Math.sin(time * 1.8) * 3;
      this.shiftHorizonRings.forEach((ring, index) => {
        ring.material.opacity = ring.userData.baseOpacity * (this.reducedMotion ? 1 : .88 + Math.sin(time * .7 + index) * .12);
      });
    }

    if (this.decisionLegacyRoot.visible) {
      for (const visual of this.decisionLegacyVisuals.values()) {
        if (!visual.visible) continue;
        const phase = visual.userData.phase;
        const pulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 1.75 + phase) * .1;
        visual.userData.spinNodes.forEach((node, index) => {
          node.rotation.y = this.reducedMotion ? 0 : time * (.16 + index * .03) + phase;
        });
        visual.userData.bobNodes.forEach((node, index) => {
          node.position.y = node.userData.baseY + (this.reducedMotion ? 0 : Math.sin(time * 1.45 + phase + index) * .09);
        });
        visual.userData.pulseMaterials.forEach(material => {
          material.emissiveIntensity = this.reducedMotion ? 1.55 : 1.35 + pulse * .42;
        });
        visual.userData.glow.scale.set(4.4 * pulse, 4.4 * pulse, 1);
        visual.userData.glow.material.opacity = this.reducedMotion ? .38 : .3 + pulse * .09;
        visual.userData.light.intensity = this.reducedMotion ? 7 : 6 + pulse * 2.2;
      }
    }

    if (this.mode === 'title' && !this.reducedMotion) {
      const orbit = time * .045;
      this.desiredPosition.set(Math.cos(orbit) * 29, 14 + Math.sin(time * .18) * 2, Math.sin(orbit) * 29);
      this.desiredTarget.set(0, 2.4, -1.3);
    }
    const cameraEase = this.reducedMotion ? 1 : 1 - Math.pow(.002, Math.min(delta, .1));
    this.camera.position.lerp(this.desiredPosition, cameraEase);
    this.cameraTarget.lerp(this.desiredTarget, cameraEase);
    this.camera.lookAt(this.cameraTarget);

    for (const visual of this.customerVisuals.values()) {
      visual.userData.displayPosition.lerp(visual.userData.target, this.reducedMotion ? .45 : 1 - Math.pow(.0007, Math.min(delta, .1)));
      visual.position.copy(visual.userData.displayPosition);
      visual.position.y += .18 + Math.sin(time * 2.8 + visual.userData.phase) * (this.reducedMotion ? .015 : .09);
      visual.rotation.y = Math.PI;
      if (visual.userData.mood === 'furious') visual.rotation.z = Math.sin(time * 15 + visual.userData.phase) * .035;
    }
    for (const vehicle of this.ambientVehicles) {
      vehicle.userData.angle += vehicle.userData.speed * delta;
      const radius = 21.5;
      vehicle.position.set(Math.cos(vehicle.userData.angle) * radius, 2.5 + Math.sin(time + vehicle.userData.phase) * .6, Math.sin(vehicle.userData.angle) * radius);
      vehicle.rotation.y = -vehicle.userData.angle + Math.PI / 2;
    }
    const leakSpeed = state?.upgrades?.includes('patch-kit') ? .7 : 1.5;
    this.leakDrops.forEach((drop, index) => {
      drop.userData.phase = (drop.userData.phase + delta * leakSpeed * .42) % 1;
      drop.position.y = 1.6 - drop.userData.phase * 2.3;
      drop.position.x = 1.1 + Math.sin(index * 2.2) * .14;
    });
    const beacon = this.upgradeVisuals['queue-beacon'];
    if (beacon.visible) {
      beacon.rotation.y += (this.reducedMotion ? 0 : delta * .45);
      beacon.userData.satellites.forEach(satellite => {
        const angle = this.reducedMotion ? satellite.userData.phase : time * .55 + satellite.userData.phase;
        satellite.position.set(Math.cos(angle) * 2.2, 5.1 + (this.reducedMotion ? 0 : Math.sin(angle * 2) * .12), Math.sin(angle) * 2.2);
      });
    }
    const drone = this.upgradeVisuals['pump-bot'];
    if (drone.visible) {
      drone.position.x = -5 + Math.sin(time * .7) * 2.8;
      drone.position.y = 6.25 + Math.sin(time * 2.1) * .22;
      drone.rotation.y = -Math.sin(time * .7) * .6;
    }
    const stockUpgrade = this.upgradeVisuals['stock-drone'];
    if (stockUpgrade.visible) {
      const stockDrone = stockUpgrade.userData.drone;
      stockDrone.position.x = 2.5 + (this.reducedMotion ? 0 : Math.sin(time * .95) * 2);
      stockDrone.position.y = 5.8 + (this.reducedMotion ? 0 : Math.sin(time * 2.3) * .18);
      stockDrone.rotation.y = this.reducedMotion ? 0 : time * .35;
    }
    const garageArm = this.upgradeVisuals['garage-arm'];
    if (garageArm.visible) garageArm.userData.arms.forEach((pivot, index) => {
      pivot.rotation.z = this.reducedMotion ? 0 : Math.sin(time * .8 + index * 1.4) * .16;
    });
    const canopy = this.upgradeVisuals['holo-canopy'];
    if (canopy.visible) canopy.userData.strips.forEach(strip => {
      const shimmer = this.reducedMotion ? .75 : .55 + Math.sin(time * 2.2 + strip.userData.phase) * .25;
      strip.material.opacity = shimmer;
      strip.material.emissiveIntensity = 1.15 + shimmer;
    });
    const kitchen = this.upgradeVisuals['synth-kitchen'];
    if (kitchen.visible) {
      const chef = kitchen.userData.chef;
      chef.rotation.y = this.reducedMotion ? 0 : time * .8;
      chef.position.y = .15 + (this.reducedMotion ? 0 : Math.sin(time * 2.4) * .08);
    }
    const clone = this.upgradeVisuals['service-clone'];
    if (clone.visible) clone.rotation.y = Math.sin(time * .8) * .5;
    const quantum = this.upgradeVisuals['quantum-forecourt'];
    if (quantum.visible) quantum.rotation.y += delta * .12;
    this.alien.rotation.y = Math.sin(time * .6) * .16;
    this.alien.position.y = Math.sin(time * 1.4) * .035;
    Object.values(this.laneMarkers).forEach((ring, index) => {
      const urgency = state ? state.customers.filter(customer => customer.lane === Object.keys(this.laneMarkers)[index]).reduce((max, customer) => Math.max(max, 1 - customer.patience / customer.maxPatience), 0) : 0;
      ring.material.opacity = .18 + urgency * .62 + Math.sin(time * 2 + index) * .05;
      const pulse = 1 + urgency * .08 * Math.sin(time * 7);
      ring.scale.setScalar(pulse);
    });
    this.updateEffects(now);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    for (const texture of Object.values(this.glows)) texture.dispose();
    for (const signal of Object.values(this.queueSignals || {})) signal.userData.labelRenderer?.texture.dispose();
    this.debtTexture?.dispose();
    for (const material of this.debtMaterials) material.dispose();
    this.debtLienRoot?.traverse(child => child.geometry?.dispose?.());
    for (const texture of this.decisionTextures) texture.dispose();
    for (const material of this.decisionMaterials) material.dispose();
    this.decisionLegacyRoot?.traverse(child => child.geometry?.dispose?.());
  }
}
