import * as THREE from '/vendor/three.module.js';

const MINT = 0x6ef4cf;
const CYAN = 0x4de8ff;
const GOLD = 0xffd66e;
const VIOLET = 0xec91ff;
const ROSE = 0xff7a99;

function hash(value) {
  let output = 2166136261;
  for (const character of String(value || 'seed')) {
    output ^= character.charCodeAt(0);
    output = Math.imul(output, 16777619);
  }
  return output >>> 0;
}

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    flatShading: true,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.08,
    transparent: options.opacity != null,
    opacity: options.opacity ?? 1,
  });
}

function setMaterialColor(mesh, color, emissiveScale = 0.2) {
  mesh.material.color.set(color);
  mesh.material.emissive.set(color).multiplyScalar(emissiveScale);
}

function vectorFor(point, origin, scale = 28) {
  return new THREE.Vector3(
    ((point?.x || 0) - (origin?.x || 0)) / scale,
    0,
    ((point?.y || 0) - (origin?.y || 0)) / scale,
  );
}

class ProtocolWildsStage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    this.renderer.setClearColor(0x03090d, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03090d);
    this.scene.fog = new THREE.Fog(0x03090d, 30, 67);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 130);
    this.camera.position.set(0, 23, 27);
    this.camera.lookAt(0, 0, -2);

    this.scene.add(new THREE.HemisphereLight(0xcaffee, 0x09171b, 1.65));
    const key = new THREE.DirectionalLight(0xffdda0, 2.35);
    key.position.set(-14, 25, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.left = -28;
    key.shadow.camera.right = 28;
    key.shadow.camera.top = 25;
    key.shadow.camera.bottom = -25;
    this.scene.add(key);
    this.mintLight = new THREE.PointLight(MINT, 26, 48, 2);
    this.mintLight.position.set(13, 7, 5);
    this.scene.add(this.mintLight);
    this.violetLight = new THREE.PointLight(VIOLET, 18, 43, 2);
    this.violetLight.position.set(-17, 5, -8);
    this.scene.add(this.violetLight);

    this.titleRoot = new THREE.Group();
    this.worldRoot = new THREE.Group();
    this.scene.add(this.titleRoot, this.worldRoot);
    this.createTitleSculpture();
    this.createWorldRelief();
    this.createWeather();
    this.lastMode = '';
    this.resize();
    addEventListener('resize', () => this.resize());
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      canvas.dataset.depthError = 'webgl-context-lost';
      document.body.classList.remove('three-depth-ready');
    });
    canvas.dataset.depthReady = 'true';
    canvas.dataset.authority = 'presentation-only';
    document.body.classList.add('three-depth-ready');
  }

  createTitleSculpture() {
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 14.5, 1.25, 9), material(0x0b2d31));
    platform.position.set(8.5, -0.75, 0);
    platform.scale.z = 0.8;
    platform.receiveShadow = true;
    this.titleRoot.add(platform);

    const seed = new THREE.Group();
    seed.position.set(8.5, 4.7, 0);
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.15, 0), material(MINT, { emissive: 0x1b765f, emissiveIntensity: 1.2, metalness: 0.28 }));
    shell.scale.set(0.72, 1.22, 0.82);
    shell.rotation.z = -0.35;
    shell.castShadow = true;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.66, 0), material(0xeafff8, { emissive: MINT, emissiveIntensity: 1.8 }));
    core.position.set(0.15, 0.05, 0.2);
    shell.add(core);
    seed.add(shell);
    const orbitColors = [MINT, GOLD, VIOLET];
    for (let index = 0; index < 3; index += 1) {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(4.2 + index * 1.55, 0.055 + index * 0.018, 4, 32),
        material(orbitColors[index], { emissive: orbitColors[index], emissiveIntensity: 0.9 }),
      );
      orbit.rotation.set(Math.PI / 2.25 + index * 0.28, index * 0.34, index * 0.62);
      seed.add(orbit);
      const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + index * 0.06, 0), material(orbitColors[index], { emissive: orbitColors[index], emissiveIntensity: 1.4 }));
      node.position.set(4.2 + index * 1.55, 0, 0);
      orbit.add(node);
    }
    this.titleSeed = seed;
    this.titleRoot.add(seed);

    const rootMaterial = material(0x153f41, { emissive: 0x0d5e50, emissiveIntensity: 0.38 });
    for (let index = 0; index < 20; index += 1) {
      const angle = index / 20 * Math.PI * 2;
      const radius = 3.2 + (index % 5) * 1.55;
      const height = 0.7 + (hash('root-' + index) % 7) * 0.24;
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.28 + (index % 3) * 0.08, height, 4), rootMaterial);
      root.position.set(8.5 + Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius * 0.76);
      root.rotation.y = angle;
      root.castShadow = true;
      this.titleRoot.add(root);
    }
  }

  createWorldRelief() {
    const undercroft = new THREE.Mesh(new THREE.CylinderGeometry(28, 31, 1.8, 12), material(0x08191d));
    undercroft.position.y = -1.45;
    undercroft.scale.z = 0.78;
    undercroft.receiveShadow = true;
    this.worldRoot.add(undercroft);

    this.tileMaterials = [
      material(0x143c3d, { emissive: 0x082a25, emissiveIntensity: 0.42 }),
      material(0x173947, { emissive: 0x092932, emissiveIntensity: 0.42 }),
      material(0x20384a, { emissive: 0x101c32, emissiveIntensity: 0.36 }),
      material(0x26373c, { emissive: 0x19221e, emissiveIntensity: 0.32 }),
    ];
    this.tiles = [];
    const tileGeometry = new THREE.CylinderGeometry(1.24, 1.32, 1, 6);
    for (let row = -7; row <= 6; row += 1) {
      for (let column = -9; column <= 9; column += 1) {
        const seed = hash(`tile:${column}:${row}`);
        if ((seed % 17 === 0 && Math.abs(column) > 2) || (Math.abs(column) + Math.abs(row) > 14)) continue;
        const height = 0.25 + (seed % 8) * 0.075;
        const tile = new THREE.Mesh(tileGeometry, this.tileMaterials[seed % this.tileMaterials.length]);
        tile.position.set(column * 2.32 + (row & 1 ? 1.16 : 0), height / 2 - 0.58, row * 2.02);
        tile.scale.y = height;
        tile.receiveShadow = true;
        if (seed % 6 === 0) tile.castShadow = true;
        this.worldRoot.add(tile);
        this.tiles.push({ mesh: tile, seed, baseY: tile.position.y });
      }
    }

    this.flora = [];
    const stemMaterial = material(0x2b746b, { emissive: 0x123f37, emissiveIntensity: 0.52 });
    const bloomMaterials = [material(MINT, { emissive: MINT, emissiveIntensity: 0.75 }), material(CYAN, { emissive: CYAN, emissiveIntensity: 0.7 }), material(GOLD, { emissive: GOLD, emissiveIntensity: 0.58 })];
    for (let index = 0; index < 74; index += 1) {
      const seed = hash('flora-' + index);
      const x = ((seed % 1000) / 1000 - 0.5) * 46;
      const z = ((((seed >>> 10) % 1000) / 1000) - 0.5) * 31;
      const height = 0.55 + ((seed >>> 20) % 7) * 0.16;
      const stalk = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, 0.08), stemMaterial);
      stem.position.y = height / 2;
      const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.22 + (seed % 3) * 0.08, 0.45, 4), bloomMaterials[seed % bloomMaterials.length]);
      bloom.position.y = height + 0.18;
      bloom.rotation.z = Math.PI;
      stalk.add(stem, bloom);
      stalk.position.set(x, -0.42, z);
      stalk.rotation.y = seed * 0.001;
      this.worldRoot.add(stalk);
      this.flora.push({ group: stalk, seed });
    }

    this.paths = Array.from({ length: 18 }, () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1), material(0x14343b, { emissive: MINT, emissiveIntensity: 0.28 }));
      mesh.position.y = -0.05;
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.worldRoot.add(mesh);
      return mesh;
    });
    this.points = Array.from({ length: 34 }, (_, index) => this.createLandmark(index));
    this.resources = Array.from({ length: 36 }, (_, index) => this.createResource(index));
    this.actors = Array.from({ length: 8 }, (_, index) => this.createActor(index));
    this.canvas.dataset.reliefTiles = String(this.tiles.length);
    this.canvas.dataset.machineFlora = String(this.flora.length);
  }

  createLandmark(index) {
    const group = new THREE.Group();
    const color = [MINT, CYAN, GOLD, VIOLET, ROSE][index % 5];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.68, 0.32, 6), material(0x123038));
    base.position.y = 0.16;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), material(color, { emissive: color, emissiveIntensity: 1.05 }));
    core.position.y = 1.0;
    core.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.055, 4, 12), material(color, { emissive: color, emissiveIntensity: 0.78 }));
    ring.position.y = 0.98;
    ring.rotation.x = Math.PI / 2;
    group.add(base, core, ring);
    group.userData = { core, ring };
    group.visible = false;
    this.worldRoot.add(group);
    return group;
  }

  createResource(index) {
    const color = [GOLD, MINT, CYAN, VIOLET, ROSE][index % 5];
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 + (index % 3) * 0.07, 0), material(color, { emissive: color, emissiveIntensity: 1.2 }));
    mesh.castShadow = true;
    mesh.visible = false;
    this.worldRoot.add(mesh);
    return mesh;
  }

  createActor(index) {
    const color = [MINT, CYAN, GOLD, VIOLET, ROSE, 0xd3ff7a, 0x90a8ff, 0x7fffe8][index];
    const group = new THREE.Group();
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.18, 8), material(color, { emissive: color, emissiveIntensity: 0.55 }));
    foot.position.y = 0.1;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.16, 5), material(color));
    body.position.y = 0.75;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.31, 0), material(0xeafff8, { emissive: color, emissiveIntensity: 0.35 }));
    head.position.y = 1.52;
    head.castShadow = true;
    const facing = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 3), material(GOLD, { emissive: GOLD, emissiveIntensity: 0.8 }));
    facing.position.set(0, 0.8, -0.58);
    facing.rotation.x = -Math.PI / 2;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.73, 0.06, 4, 12), material(color, { emissive: color, emissiveIntensity: 0.75 }));
    ring.position.y = 0.12;
    ring.rotation.x = Math.PI / 2;
    const companion = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), material(color, { emissive: color, emissiveIntensity: 1.3 }));
    companion.position.set(0.86, 1.3, 0);
    group.add(foot, body, head, facing, ring, companion);
    group.userData = { ring, companion, facing };
    group.visible = false;
    this.worldRoot.add(group);
    return group;
  }

  createWeather() {
    const positions = [];
    for (let index = 0; index < 96; index += 1) {
      const seed = hash('weather-' + index);
      positions.push(((seed % 1000) / 1000 - 0.5) * 58, 1 + ((seed >>> 9) % 900) / 100, (((seed >>> 18) % 1000) / 1000 - 0.5) * 42);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.weather = new THREE.Points(geometry, new THREE.PointsMaterial({ color: CYAN, size: 0.13, transparent: true, opacity: 0.55, sizeAttenuation: true }));
    this.scene.add(this.weather);
  }

  resize() {
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  updateMode(titleMode) {
    const mode = titleMode ? 'title' : 'world';
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    this.titleRoot.visible = titleMode;
    this.worldRoot.visible = !titleMode;
    this.canvas.dataset.mode = mode;
    if (titleMode) {
      this.camera.position.set(0, 15, 29);
      this.camera.lookAt(0.5, 3.2, 0);
      this.scene.fog.near = 33;
    } else {
      this.camera.position.set(0, 23, 27);
      this.camera.lookAt(0, 0, -2);
      this.scene.fog.near = 30;
    }
  }

  updateWorld(view, time, reducedMotion) {
    const origin = view?.self?.position || { x: 0, y: 0 };
    const region = view?.visible?.regions?.find(item => item.id === view?.hud?.region) || view?.visible?.regions?.[0];
    const colors = (region?.palette || ['#143c3d', '#173947', '#6ef4cf']).map(value => new THREE.Color(value));
    this.tileMaterials.forEach((entry, index) => {
      entry.color.copy(colors[index % 2]).multiplyScalar(0.72 + index * 0.08);
      entry.emissive.copy(colors[2]).multiplyScalar(0.08 + index * 0.025);
    });
    this.scene.fog.color.copy(colors[0]).multiplyScalar(0.22);
    this.scene.background.copy(this.scene.fog.color);
    this.mintLight.color.copy(colors[2]);

    this.paths.forEach((mesh, index) => {
      const path = view?.visible?.paths?.[index];
      if (!path) { mesh.visible = false; return; }
      const from = vectorFor(path.from, origin);
      const to = vectorFor(path.to, origin);
      const midpoint = from.clone().add(to).multiplyScalar(0.5);
      const delta = to.clone().sub(from);
      mesh.visible = Math.abs(midpoint.x) < 31 && Math.abs(midpoint.z) < 27;
      mesh.position.set(midpoint.x, -0.02, midpoint.z);
      mesh.scale.set(Math.max(0.7, Number(path.width || 20) / 28), 1, Math.max(0.7, delta.length()));
      mesh.rotation.y = Math.atan2(delta.x, delta.z);
    });

    const landmarkColors = { relay: GOLD, workbench: MINT, stall: CYAN, beacon: MINT, ruin: GOLD, 'thread-knot': VIOLET, 'hidden-route': VIOLET, breach: ROSE, 'circuitseed-site': MINT, 'memory-echo': GOLD, 'root-gate': 0xd3ff7a };
    this.points.forEach((group, index) => {
      const point = view?.visible?.points?.[index];
      if (!point) { group.visible = false; return; }
      const position = vectorFor(point, origin);
      group.visible = Math.abs(position.x) < 30 && Math.abs(position.z) < 25;
      group.position.set(position.x, 0, position.z);
      const color = landmarkColors[point.kind] || MINT;
      setMaterialColor(group.userData.core, color, 0.52);
      setMaterialColor(group.userData.ring, color, 0.4);
      group.userData.core.rotation.y = time * 0.0007 + index;
      group.userData.ring.rotation.z = reducedMotion ? 0 : time * 0.00035 + index;
    });

    this.resources.forEach((mesh, index) => {
      const resource = view?.visible?.resources?.[index];
      if (!resource) { mesh.visible = false; return; }
      const position = vectorFor(resource, origin);
      mesh.visible = Math.abs(position.x) < 30 && Math.abs(position.z) < 25;
      mesh.position.set(position.x, 0.58 + (reducedMotion ? 0 : Math.sin(time * 0.002 + index) * 0.12), position.z);
      mesh.rotation.y = reducedMotion ? 0.4 : time * 0.00065 + index;
    });

    this.actors.forEach((group, index) => {
      const actor = view?.visible?.actors?.[index];
      if (!actor) { group.visible = false; return; }
      const position = vectorFor(actor.position, origin);
      group.visible = true;
      group.position.set(position.x, 0.08, position.z);
      const facing = actor.facing || { x: 0, y: 1 };
      group.rotation.y = Math.atan2(-facing.x, -facing.y);
      const self = actor.seatId === view?.self?.seatId;
      group.scale.setScalar(self ? 1.2 : 1);
      group.userData.ring.rotation.z = reducedMotion ? 0 : time * 0.001 + index;
      group.userData.companion.visible = Boolean(actor.circuitkinId);
      group.userData.companion.position.y = 1.3 + (reducedMotion ? 0 : Math.sin(time * 0.003 + index) * 0.16);
    });

    for (const entry of this.flora) {
      entry.group.rotation.z = reducedMotion ? 0 : Math.sin(time * 0.0008 + entry.seed) * 0.035;
    }
    this.weather.material.color.set(view?.hud?.conditions?.weather === 'thread-mist' ? VIOLET : CYAN);
    this.weather.material.opacity = view?.hud?.conditions?.weather === 'clear' ? 0.28 : 0.62;
  }

  render(view, time, options = {}) {
    const titleMode = options.titleMode !== false;
    this.updateMode(titleMode);
    const reducedMotion = options.reducedMotion === true;
    const motion = reducedMotion ? 0 : time;
    if (titleMode) {
      this.titleSeed.rotation.y = motion * 0.00022;
      this.titleSeed.position.y = 4.7 + (reducedMotion ? 0 : Math.sin(motion * 0.001) * 0.18);
      this.weather.rotation.y = motion * 0.000025;
    } else if (view) {
      this.updateWorld(view, motion, reducedMotion);
      this.weather.rotation.y = motion * 0.00002;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

const canvas = document.querySelector('#world-depth');
try {
  const stage = new ProtocolWildsStage(canvas);
  window.CircuitseedThree = {
    render(view, time, options) { stage.render(view, time, options); },
    diagnostics() {
      return {
        renderer: 'three-r160',
        authority: canvas.dataset.authority,
        mode: canvas.dataset.mode,
        reliefTiles: Number(canvas.dataset.reliefTiles),
        machineFlora: Number(canvas.dataset.machineFlora),
      };
    },
  };
} catch (error) {
  canvas.dataset.depthError = error?.message || 'three-stage-failed';
  document.body.classList.remove('three-depth-ready');
  console.warn('Circuitseed 3D presentation layer unavailable:', error);
}
