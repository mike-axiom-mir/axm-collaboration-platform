import * as THREE from '/vendor/three.module.js';

const BUILDING_LIMIT = 84;
const ROAD_LIMIT = 48;
const PARTY_A = 0x59e0b8;
const PARTY_B = 0xe98aff;

function hashId(value) {
  let hash = 2166136261;
  const text = String(value || 'district');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function sampledFeatures(chunks, layerName, limit, camera) {
  const features = [];
  for (const chunk of chunks || []) {
    for (const feature of chunk?.layers?.[layerName] || []) {
      if (feature?.type !== 'rect' || feature.w <= 0 || feature.h <= 0) continue;
      const localX = (feature.x + feature.w / 2 - camera.x) * camera.zoom / 55;
      const localZ = (feature.y + feature.h / 2 - camera.y) * camera.zoom / 55;
      if (Math.abs(localX) <= 21 && Math.abs(localZ) <= 16) features.push(feature);
    }
  }
  features.sort((a, b) => hashId(a.id) - hashId(b.id));
  if (features.length <= limit) return features;
  const stride = features.length / limit;
  return Array.from({ length: limit }, (_, index) => features[Math.floor(index * stride)]);
}

function entityPosition(entity) {
  return entity?.position || { x: entity?.x || 0, y: entity?.y || 0 };
}

function flatMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    flatShading: true,
    roughness: options.roughness ?? 0.78,
    metalness: options.metalness ?? 0.08,
    transparent: options.opacity != null,
    opacity: options.opacity ?? 1,
  });
}

export class DistrictDepthStage {
  constructor(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Depth canvas is missing');
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25));
    this.renderer.setClearColor(0x07110e, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07110e);
    this.scene.fog = new THREE.Fog(0x07110e, 26, 58);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(0, 20, 23);
    this.camera.lookAt(0, 0, 1.5);

    this.scene.add(new THREE.HemisphereLight(0xc8fff1, 0x142b2e, 1.55));
    const sun = new THREE.DirectionalLight(0xffe0ab, 2.15);
    sun.position.set(-11, 24, -9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.left = -24;
    sun.shadow.camera.right = 24;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);
    const rim = new THREE.PointLight(PARTY_A, 18, 36, 2);
    rim.position.set(13, 7, 8);
    this.scene.add(rim);
    const rivalRim = new THREE.PointLight(PARTY_B, 13, 32, 2);
    rivalRim.position.set(-14, 5, -4);
    this.scene.add(rivalRim);

    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(25, 27, 0.8, 12),
      flatMaterial(0x122d2c, { roughness: 0.94 }),
    );
    ground.scale.z = 0.68;
    ground.position.y = -0.48;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const grid = new THREE.GridHelper(44, 22, PARTY_A, 0x27434a);
    grid.position.y = -0.04;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    this.scene.add(grid);

    this.buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.roadGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.buildingMaterials = [
      flatMaterial(0x397f91, { emissive: 0x123b46, emissiveIntensity: 0.55 }),
      flatMaterial(0x6d599d, { emissive: 0x241b44, emissiveIntensity: 0.5 }),
      flatMaterial(0x3b826d, { emissive: 0x123d31, emissiveIntensity: 0.55 }),
      flatMaterial(0x9a5f7f, { emissive: 0x471b33, emissiveIntensity: 0.48 }),
      flatMaterial(0x607f96, { emissive: 0x1a3446, emissiveIntensity: 0.5 }),
    ];
    this.roadMaterial = flatMaterial(0x182229, { roughness: 1 });
    this.reliefBlocks = this.createReliefBlocks();
    this.buildings = [];
    this.roads = [];
    this.chunkKey = '';

    this.actorMarkers = Array.from({ length: 8 }, (_, index) => this.createActorMarker(index));
    this.vehicleMarkers = Array.from({ length: 16 }, (_, index) => this.createVehicleMarker(index));
    this.particles = this.createParticles();
    this.canvas.dataset.depthReady = 'true';
    this.canvas.dataset.authority = 'presentation-only';
  }

  createReliefBlocks() {
    const group = new THREE.Group();
    const blocks = [];
    const columns = 9;
    const rows = 6;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if ((column === 4 && row > 0) || (row === 3 && column % 3 !== 0)) continue;
        const seed = hashId(`relief-${column}-${row}`);
        const width = 2.05 + (seed % 5) * 0.28;
        const depth = 1.7 + ((seed >>> 3) % 5) * 0.3;
        const height = 1.2 + ((seed >>> 6) % 11) * 0.31;
        const material = this.buildingMaterials[seed % this.buildingMaterials.length];
        const mesh = new THREE.Mesh(this.buildingGeometry, material);
        mesh.position.set((column - 4) * 4.45, height / 2, (row - 2.7) * 4.1);
        mesh.scale.set(width, height, depth);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (seed % 4 === 0) {
          const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.42, 4), material);
          roof.position.y = 0.68;
          roof.rotation.y = Math.PI / 4;
          mesh.add(roof);
        }
        group.add(mesh);
        blocks.push(mesh);
      }
    }
    this.scene.add(group);
    this.canvas.dataset.reliefBlocks = String(blocks.length);
    return { group, blocks };
  }

  createActorMarker(index) {
    const color = index < 4 ? PARTY_A : PARTY_B;
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.9, 5), flatMaterial(color));
    body.position.y = 0.48;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.27, 0), flatMaterial(0xf1fff9));
    head.position.y = 1.15;
    head.castShadow = true;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.055, 4, 12),
      flatMaterial(color, { metalness: 0.24 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    group.add(body, head, ring);
    group.visible = false;
    this.scene.add(group);
    return group;
  }

  createVehicleMarker(index) {
    const color = index % 2 === 0 ? 0xffcf6d : 0x76d9ff;
    const group = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.34, 0.65), flatMaterial(color));
    shell.position.y = 0.35;
    shell.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.52), flatMaterial(0x243a47, { metalness: 0.3 }));
    cabin.position.set(-0.05, 0.66, 0);
    group.add(shell, cabin);
    group.visible = false;
    this.scene.add(group);
    return group;
  }

  createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    for (let index = 0; index < 44; index += 1) {
      const angle = index * 2.399963;
      const radius = 7 + (index % 9) * 1.55;
      positions.push(Math.cos(angle) * radius, 1.4 + (index % 7) * 0.65, Math.sin(angle) * radius * 0.62);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0x9fffe8, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.68 }),
    );
    this.scene.add(points);
    return points;
  }

  resize(viewport) {
    if (!viewport?.width || !viewport?.height) return;
    this.camera.aspect = viewport.width / viewport.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(viewport.width, viewport.height, false);
  }

  clearFeatureMeshes(list) {
    for (const entry of list) this.scene.remove(entry.mesh);
    list.length = 0;
  }

  rebuildFeatures(chunks, camera) {
    const cameraCell = `${Math.round(camera.x / 160)}:${Math.round(camera.y / 160)}:${Math.round(camera.zoom * 4)}`;
    const key = `${cameraCell}|${(chunks || []).map((chunk) => chunk.id).sort().join('|')}`;
    if (key === this.chunkKey) return;
    this.chunkKey = key;
    this.clearFeatureMeshes(this.buildings);
    this.clearFeatureMeshes(this.roads);

    for (const feature of sampledFeatures(chunks, 'buildings', BUILDING_LIMIT, camera)) {
      const material = this.buildingMaterials[hashId(feature.id) % this.buildingMaterials.length];
      const mesh = new THREE.Mesh(this.buildingGeometry, material);
      if (hashId(feature.id) % 5 === 0) {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.54, 0.38, 4), material);
        roof.position.y = 0.68;
        roof.rotation.y = Math.PI / 4;
        mesh.add(roof);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.buildings.push({ mesh, feature, seed: hashId(feature.id) });
    }
    for (const feature of sampledFeatures(chunks, 'roads', ROAD_LIMIT, camera)) {
      const mesh = new THREE.Mesh(this.roadGeometry, this.roadMaterial);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.roads.push({ mesh, feature });
    }
    this.canvas.dataset.buildingRelief = String(this.buildings.length);
    this.canvas.dataset.roadRelief = String(this.roads.length);
  }

  updateFeature(entry, camera, kind) {
    const feature = entry.feature;
    const scale = camera.zoom / 55;
    const x = (feature.x + feature.w / 2 - camera.x) * scale;
    const z = (feature.y + feature.h / 2 - camera.y) * scale;
    const rawWidth = Math.max(0.16, feature.w * scale);
    const rawDepth = Math.max(0.16, feature.h * scale);
    if (kind === 'road') {
      const width = Math.min(7.5, rawWidth);
      const depth = Math.min(7.5, rawDepth);
      entry.mesh.position.set(x, 0.01, z);
      entry.mesh.scale.set(width, 0.04, depth);
    } else {
      const width = Math.min(3.35, rawWidth);
      const depth = Math.min(3.35, rawDepth);
      const height = 0.8 + (entry.seed % 11) * 0.2 + Math.min(1.25, Math.sqrt(width * depth) * 0.2);
      entry.mesh.position.set(x, height / 2, z);
      entry.mesh.scale.set(width * 0.92, height, depth * 0.92);
    }
    entry.mesh.visible = Math.abs(x) < 25 && Math.abs(z) < 20;
  }

  updateEntities(world, camera, now) {
    const actors = (world?.actors || []).filter((actor) => actor.alive !== false);
    this.actorMarkers.forEach((marker, index) => {
      const actor = actors[index];
      marker.visible = Boolean(actor);
      if (!actor) return;
      const position = entityPosition(actor);
      const scale = camera.zoom / 55;
      marker.position.set(
        (position.x - camera.x) * scale,
        0.12 + Math.sin(now * 0.004 + index) * 0.08,
        (position.y - camera.y) * scale,
      );
      marker.rotation.y = now * 0.0005 + index;
      marker.scale.setScalar(1.28);
    });

    const vehicles = (world?.vehicles || []).filter((vehicle) => vehicle.destroyed !== true);
    this.vehicleMarkers.forEach((marker, index) => {
      const vehicle = vehicles[index];
      marker.visible = Boolean(vehicle);
      if (!vehicle) return;
      const position = entityPosition(vehicle);
      const scale = camera.zoom / 55;
      marker.position.set((position.x - camera.x) * scale, 0.04, (position.y - camera.y) * scale);
      marker.rotation.y = Number(vehicle.angle || vehicle.rotation || 0);
    });
    this.canvas.dataset.actorMarkers = String(Math.min(actors.length, this.actorMarkers.length));
    this.canvas.dataset.vehicleMarkers = String(Math.min(vehicles.length, this.vehicleMarkers.length));
  }

  render({ world, camera, viewport, chunks, partyId, now }) {
    if (!world || !camera || !viewport) return;
    this.rebuildFeatures(chunks, camera);
    for (const entry of this.roads) this.updateFeature(entry, camera, 'road');
    for (const entry of this.buildings) this.updateFeature(entry, camera, 'building');
    this.updateEntities(world, camera, now);
    this.particles.rotation.y = now * 0.000045;
    this.particles.position.y = Math.sin(now * 0.0007) * 0.18;
    this.reliefBlocks.group.position.x = -((camera.x * camera.zoom / 220) % 4.45);
    this.reliefBlocks.group.position.z = -((camera.y * camera.zoom / 220) % 4.1);
    this.scene.fog.color.setHex(partyId === 'party_b' ? 0x100b18 : 0x07110e);
    this.renderer.render(this.scene, this.camera);
  }
}
