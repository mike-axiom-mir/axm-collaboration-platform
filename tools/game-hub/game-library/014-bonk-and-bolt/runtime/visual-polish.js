import * as THREE from './vendor/three.module.js';

export const VISUAL_PASS_ID = 'patchwork-vale-dressing-01';

function seededRandom(seed) {
  let value = (Number(seed) || 14014) >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ next >>> 15, next | 1);
    next ^= next + Math.imul(next ^ next >>> 7, next | 61);
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function toon(color, options = {}) {
  return new THREE.MeshToonMaterial(Object.assign({ color }, options));
}

function detailMesh(geometry, material, shadows = false) {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = shadows;
  result.receiveShadow = shadows;
  return result;
}

function addInstancedLayer(root, geometry, entries, colors, options = {}) {
  const material = toon(0xffffff);
  const layer = new THREE.InstancedMesh(geometry, material, entries.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  entries.forEach((entry, index) => {
    dummy.position.set(entry.x, entry.y, entry.z);
    dummy.rotation.set(entry.rx || 0, entry.ry || 0, entry.rz || 0);
    dummy.scale.set(entry.sx || 1, entry.sy || 1, entry.sz || 1);
    dummy.updateMatrix();
    layer.setMatrixAt(index, dummy.matrix);
    color.set(colors[entry.colorIndex % colors.length]);
    layer.setColorAt(index, color);
  });
  layer.instanceMatrix.needsUpdate = true;
  if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
  layer.castShadow = Boolean(options.castShadow);
  layer.receiveShadow = Boolean(options.receiveShadow);
  layer.frustumCulled = true;
  layer.name = options.name || 'visual-detail-layer';
  root.add(layer);
  return layer;
}

function nearRiver(x, z) {
  return Math.abs(x + 18 - z * .08) < 12;
}

function insideRegionCore(x, z, regions, scale) {
  return regions.some(region => Math.hypot(x - region.x, z - region.z) < region.radius * scale);
}

export function buildWorldDressing(scene, data, seed) {
  const random = seededRandom((Number(seed) || 14014) ^ 0x24b017);
  const root = new THREE.Group();
  root.name = VISUAL_PASS_ID;
  root.userData.visualPass = VISUAL_PASS_ID;
  const regions = Array.isArray(data && data.regions) ? data.regions : [];
  const villageIds = new Set(['kettlewick', 'doodledean', 'boltborough', 'sizzlebank']);
  const villageRegions = regions.filter(region => villageIds.has(region.id));

  const pavers = [];
  const paverColors = [0xd8c28c, 0xcab47c, 0xe4cf9d, 0xb8aa83, 0x91b6b0, 0xc69aaa];
  villageRegions.forEach((region, regionIndex) => {
    for (let gridX = -5; gridX <= 5; gridX += 1) {
      for (let gridZ = -5; gridZ <= 5; gridZ += 1) {
        const radial = Math.hypot(gridX, gridZ);
        if (radial > 5.45 || random() < .29) continue;
        pavers.push({
          x: region.x + gridX * 2.35 + (random() - .5) * .38,
          y: .075 + (gridX + gridZ & 1) * .006,
          z: region.z + gridZ * 2.15 + (random() - .5) * .38,
          ry: random() * Math.PI,
          sx: .72 + random() * .22,
          sy: 1,
          sz: .72 + random() * .22,
          colorIndex: regionIndex + gridX + gridZ + 24
        });
      }
    }
  });

  const grass = [];
  for (let index = 0; index < 440; index += 1) {
    const x = random() * 304 - 152;
    const z = random() * 304 - 152;
    if (nearRiver(x, z) || insideRegionCore(x, z, regions, .52)) continue;
    grass.push({
      x, y: .32, z,
      ry: random() * Math.PI * 2,
      rz: (random() - .5) * .24,
      sx: .7 + random() * .65,
      sy: .65 + random() * 1.15,
      sz: .7 + random() * .65,
      colorIndex: index
    });
  }

  const shrubs = [];
  for (let index = 0; index < 135; index += 1) {
    const x = random() * 300 - 150;
    const z = random() * 300 - 150;
    if (nearRiver(x, z) || insideRegionCore(x, z, regions, .62)) continue;
    const size = .55 + random() * .72;
    shrubs.push({ x, y: size * .42, z, ry: random() * Math.PI * 2, sx: size * 1.25, sy: size, sz: size, colorIndex: index });
  }

  const flowers = [];
  const addFlower = (x, z, colorIndex) => flowers.push({
    x, y: .26 + random() * .12, z,
    ry: random() * Math.PI * 2,
    sx: .7 + random() * .6,
    sy: .9 + random() * .8,
    sz: .7 + random() * .6,
    colorIndex
  });
  for (let index = 0; index < 150; index += 1) {
    const x = random() * 292 - 146;
    const z = random() * 292 - 146;
    if (!nearRiver(x, z) && !insideRegionCore(x, z, regions, .3)) addFlower(x, z, index);
  }
  villageRegions.forEach((region, regionIndex) => {
    for (let index = 0; index < 26; index += 1) {
      const angle = index / 26 * Math.PI * 2 + random() * .22;
      const radius = region.radius * (.46 + random() * .24);
      addFlower(region.x + Math.cos(angle) * radius, region.z + Math.sin(angle) * radius, regionIndex + index);
    }
  });

  const ridges = [];
  for (let index = 0; index < 34; index += 1) {
    const angle = index / 34 * Math.PI * 2;
    const radius = 178 + (index % 3) * 6;
    const height = 7 + random() * 8;
    ridges.push({
      x: Math.cos(angle) * radius,
      y: height / 2 - .2,
      z: Math.sin(angle) * radius,
      ry: random() * Math.PI,
      rz: (random() - .5) * .1,
      sx: 2.5 + random() * 2.2,
      sy: height / 9,
      sz: 2.2 + random() * 2.5,
      colorIndex: index
    });
  }

  addInstancedLayer(root, new THREE.CylinderGeometry(.76, .84, .11, 6), pavers, paverColors, { name: 'village-cobbles', receiveShadow: true });
  addInstancedLayer(root, new THREE.ConeGeometry(.17, .72, 3), grass, [0x548f48, 0x68a950, 0x7bb75a, 0x477e46], { name: 'field-grass' });
  addInstancedLayer(root, new THREE.DodecahedronGeometry(.55, 0), shrubs, [0x3f7c52, 0x4c8f55, 0x5e9d52, 0x6fab5a], { name: 'low-shrubs', castShadow: true, receiveShadow: true });
  addInstancedLayer(root, new THREE.OctahedronGeometry(.15, 0), flowers, [0xffc95f, 0xff89a6, 0x7ce4dc, 0xc49aff, 0xffec93], { name: 'gem-flowers' });
  addInstancedLayer(root, new THREE.ConeGeometry(1, 9, 5), ridges, [0x587e58, 0x648c62, 0x4d7057, 0x6e8964], { name: 'horizon-ridges', castShadow: true, receiveShadow: true });
  scene.add(root);

  const counts = {
    pavers: pavers.length,
    grass: grass.length,
    shrubs: shrubs.length,
    flowers: flowers.length,
    ridges: ridges.length
  };
  return {
    id: VISUAL_PASS_ID,
    root,
    counts,
    instances: Object.values(counts).reduce((sum, count) => sum + count, 0),
    drawCalls: 5
  };
}

function frontWindow(root, x, color, shutterColor) {
  const pane = detailMesh(new THREE.BoxGeometry(.68, .72, .09), toon(color, { emissive: color, emissiveIntensity: .16 }), false);
  pane.position.set(x, 1.82, 1.9);
  root.add(pane);
  const vertical = detailMesh(new THREE.BoxGeometry(.055, .76, .12), toon(0xf7e4b2), false);
  const horizontal = detailMesh(new THREE.BoxGeometry(.72, .055, .12), toon(0xf7e4b2), false);
  vertical.position.set(x, 1.82, 1.96);
  horizontal.position.set(x, 1.82, 1.96);
  root.add(vertical, horizontal);
  for (const side of [-1, 1]) {
    const shutter = detailMesh(new THREE.BoxGeometry(.13, .82, .13), toon(shutterColor), false);
    shutter.position.set(x + side * .45, 1.82, 1.93);
    shutter.rotation.z = side * .07;
    root.add(shutter);
  }
}

export function decorateHouse(root, kind, baseColor) {
  if (!root || root.userData.visualPolish === VISUAL_PASS_ID) return 0;
  const details = new THREE.Group();
  details.name = 'low-poly-house-details';
  let count = 0;
  if (kind === 'robot') {
    for (const x of [-1.12, 1.12]) {
      const glass = detailMesh(new THREE.CircleGeometry(.42, 10), toon(0x79d7e5, { emissive: 0x2b788e, emissiveIntensity: .38 }), false);
      glass.position.set(x, 2.02, 2.79);
      const rim = detailMesh(new THREE.TorusGeometry(.47, .095, 6, 12), toon(0x405362), false);
      rim.position.copy(glass.position);
      details.add(glass, rim);
      count += 2;
    }
    for (let index = 0; index < 7; index += 1) {
      const angle = index / 7 * Math.PI * 2;
      const rivet = detailMesh(new THREE.SphereGeometry(.09, 6, 4), toon(0xd9c47c), false);
      rivet.position.set(Math.cos(angle) * 2.18, 3.25 + Math.sin(angle) * .35, 2.15);
      details.add(rivet);
      count += 1;
    }
    const antenna = detailMesh(new THREE.CylinderGeometry(.055, .08, 1.4, 6), toon(0x536b79));
    antenna.position.set(-.8, 5.05, 0);
    const beacon = detailMesh(new THREE.OctahedronGeometry(.22, 0), toon(0xffd066, { emissive: 0xff9a37, emissiveIntensity: .65 }), false);
    beacon.position.set(-.8, 5.82, 0);
    details.add(antenna, beacon);
    count += 2;
  } else {
    const accent = new THREE.Color(baseColor).offsetHSL(kind === 'toon' ? .08 : -.03, .08, -.18);
    frontWindow(details, -1.15, kind === 'toon' ? 0x8df0e8 : 0x7dc9dd, accent);
    frontWindow(details, 1.15, kind === 'toon' ? 0xffe18a : 0x8bd5e2, accent);
    count += 10;
    const roofTrim = detailMesh(new THREE.BoxGeometry(4.9, .15, .19), toon(kind === 'toon' ? 0xffd06b : 0xf4d39b), false);
    roofTrim.position.set(0, 3.23, 1.92);
    const step = detailMesh(new THREE.CylinderGeometry(.62, .76, .15, 6), toon(0x8d765e), false);
    step.position.set(0, .075, 2.3);
    details.add(roofTrim, step);
    count += 2;
    const chimney = detailMesh(new THREE.BoxGeometry(.58, 1.25, .62), toon(kind === 'toon' ? 0x775d9f : 0x8e6554));
    chimney.position.set(-1.15, 4.75, -.48);
    chimney.rotation.z = kind === 'toon' ? -.08 : 0;
    const cap = detailMesh(new THREE.CylinderGeometry(.43, .48, .18, 6), toon(0x4a4551));
    cap.position.set(-1.15, 5.42, -.48);
    details.add(chimney, cap);
    count += 2;
  }
  root.add(details);
  root.userData.visualPolish = VISUAL_PASS_ID;
  root.userData.visualDetailMeshes = count;
  return count;
}
