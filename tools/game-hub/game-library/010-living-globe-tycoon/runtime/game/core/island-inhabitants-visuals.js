/* Procedural, asset-free inhabitants for the local living globe. */
export function createIslandInhabitantVisuals(options) {
  const THREE = options.THREE;
  const scene = options.scene;
  const root = new THREE.Group();
  root.name = 'AXM v0.3 tropical food-web inhabitants';
  scene.add(root);

  function seeded(seed) {
    let state = (Number(seed) >>> 0) || 0x6d2b79f5;
    return function () { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 4294967296; };
  }
  const random = seeded((options.seed || 1) ^ 0x1ab17a7);
  const up = new THREE.Vector3(0, 1, 0);
  const temp = new THREE.Vector3();

  function basis(direction) {
    const helper = Math.abs(direction.y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const e1 = temp.copy(helper).cross(direction).normalize().clone();
    return [e1, direction.clone().cross(e1).normalize()];
  }
  function offset(direction, azimuth, angularDistance) {
    const pair = basis(direction);
    return direction.clone().multiplyScalar(Math.cos(angularDistance))
      .add(pair[0].multiplyScalar(Math.sin(angularDistance) * Math.cos(azimuth)))
      .add(pair[1].multiplyScalar(Math.sin(angularDistance) * Math.sin(azimuth))).normalize();
  }
  function place(group, direction, altitude, heading) {
    group.position.copy(direction).multiplyScalar(options.groundRadius(direction) + altitude);
    group.quaternion.setFromUnitVectors(up, direction);
    group.rotateY(heading || 0);
  }
  function landDirection() {
    let direction = new THREE.Vector3(0, 1, 0), guard = 0;
    do { direction.set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize(); guard += 1; }
    while (guard < 40 && options.isLand && !options.isLand(direction));
    return direction;
  }
  function woodlandAnchor(index) {
    const trees = options.treeProvider ? options.treeProvider() : [];
    return trees.length ? trees[index % trees.length].dir.clone() : landDirection();
  }
  function wetlandDirection(azimuth, shoreOffset) {
    const lake = options.lakeProvider && options.lakeProvider();
    if (!lake) return landDirection();
    const angularDistance = lake.shoreAng(azimuth) + shoreOffset;
    return lake.C.clone().multiplyScalar(Math.cos(angularDistance))
      .add(lake.e1.clone().multiplyScalar(Math.sin(angularDistance) * Math.cos(azimuth)))
      .add(lake.e2.clone().multiplyScalar(Math.sin(angularDistance) * Math.sin(azimuth))).normalize();
  }
  function flatMaterial(color, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }, extra || {}));
  }

  const creatures = { pollinators: [], frogs: [], geckos: [], bats: [], canopyBirds: [], wadingBirds: [], landCrabs: [], iguanas: [] };

  function makePollinator(index) {
    const group = new THREE.Group();
    const bee = index % 3 === 0;
    const body = new THREE.Mesh(new THREE.SphereGeometry(bee ? 0.055 : 0.045, 5, 4), flatMaterial(bee ? '#d4a633' : '#33231b'));
    body.scale.set(0.65, 0.65, 1.6); group.add(body);
    const wingColor = bee ? '#dce9dd' : ['#f0a0ce', '#f0ca66', '#9bc8f1'][index % 3];
    const wingMaterial = flatMaterial(wingColor, { transparent: true, opacity: bee ? 0.65 : 0.82, emissive: wingColor, emissiveIntensity: 0.08 });
    const left = new THREE.Mesh(new THREE.CircleGeometry(bee ? 0.07 : 0.11, 5, 0, Math.PI), wingMaterial);
    const right = left.clone(); left.position.x = -0.055; right.position.x = 0.055; left.rotation.y = 0.25; right.rotation.y = -0.25; group.add(left, right);
    root.add(group);
    return { group: group, left: left, right: right, anchor: index % 2 ? woodlandAnchor(index + 5) : landDirection(), phase: random() * Math.PI * 2, radius: 0.008 + random() * 0.018, speed: 0.6 + random() * 0.7 };
  }

  function makeFrog(index) {
    const group = new THREE.Group();
    const color = index % 2 ? '#568a47' : '#72a85a';
    const material = flatMaterial(color);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), material); body.scale.set(1, 0.55, 1.25); body.position.y = 0.06; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), material); head.position.set(0, 0.1, 0.12); group.add(head);
    [-1, 1].forEach(function (side) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 5, 4), flatMaterial('#d9d38a')); eye.position.set(side * 0.045, 0.17, 0.16); group.add(eye);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.035), material); leg.position.set(side * 0.11, 0.02, -0.04); leg.rotation.y = side * 0.45; group.add(leg);
    });
    root.add(group);
    return { group: group, azimuth: random() * Math.PI * 2, phase: random() * Math.PI * 2, hopRate: 0.55 + random() * 0.45, shoreOffset: 0.006 + random() * 0.016 };
  }

  function makeBat(index) {
    const group = new THREE.Group();
    const material = flatMaterial(index % 2 ? '#4b4656' : '#373844', { emissive: '#17151e', emissiveIntensity: 0.12 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), material); body.scale.set(0.65, 1, 1.35); group.add(body);
    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.38, 0.02, -0.06, -0.14, 0, 0.16], 3)); wingGeometry.computeVertexNormals();
    const left = new THREE.Mesh(wingGeometry, material), right = left.clone(); right.scale.x = -1; group.add(left, right);
    const ears = [-1, 1].map(function (side) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), material); ear.position.set(side * 0.03, 0.1, 0.06); group.add(ear); return ear; });
    root.add(group);
    return { group: group, left: left, right: right, ears: ears, anchor: woodlandAnchor(index), phase: random() * Math.PI * 2, radius: 0.025 + random() * 0.025, speed: 0.55 + random() * 0.5 };
  }

  function makeWadingBird(index) {
    const group = new THREE.Group();
    const plumage = flatMaterial(index % 2 ? '#a8b2b3' : '#d4d8d1');
    const dark = flatMaterial('#263033');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), plumage); body.scale.set(0.75, 1, 1.3); body.position.y = 0.45; group.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.42, 5), plumage); neck.position.set(0, 0.72, 0.1); neck.rotation.x = -0.2; group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), plumage); head.position.set(0, 0.94, 0.2); group.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.28, 4), flatMaterial('#d2a34c')); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.94, 0.36); group.add(beak);
    [-1, 1].forEach(function (side) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 4), dark); leg.position.set(side * 0.06, 0.2, 0); group.add(leg); });
    root.add(group);
    return { group: group, azimuth: random() * Math.PI * 2, phase: random() * Math.PI * 2, speed: 0.035 + random() * 0.03, shoreOffset: -0.003 + random() * 0.014 };
  }

  function makeCanopyBird(index) {
    const group = new THREE.Group();
    const colors = [
      ['#1f8f71', '#f0c84d', '#124f4f'],
      ['#d95f4d', '#f2b84b', '#315b8a'],
      ['#5b9f45', '#dbe565', '#2d765f']
    ][index % 3];
    const bodyMaterial = flatMaterial(colors[0]);
    const wingMaterial = flatMaterial(colors[2]);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), bodyMaterial); body.scale.set(0.72, 0.82, 1.35); body.position.y = 0.1; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 6, 5), bodyMaterial); head.position.set(0, 0.18, 0.17); group.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 5), flatMaterial(colors[1])); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.16, 0.31); group.add(beak);
    const eye = flatMaterial('#13201d');
    [-1, 1].forEach(function (side) { const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.017, 5, 4), eye); pupil.position.set(side * 0.075, 0.22, 0.22); group.add(pupil); });
    const wingGeometry = new THREE.BufferGeometry();
    wingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.34, 0.01, -0.07, -0.12, 0.01, 0.2], 3)); wingGeometry.computeVertexNormals();
    const left = new THREE.Mesh(wingGeometry, wingMaterial), right = left.clone(); right.scale.x = -1; group.add(left, right);
    [-1, 1].forEach(function (side) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 0.28), wingMaterial); tail.position.set(side * 0.035, 0.05, -0.25); tail.rotation.y = side * 0.12; group.add(tail); });
    root.add(group);
    return { group: group, left: left, right: right, anchor: woodlandAnchor(index), phase: random() * Math.PI * 2, radius: 0.012 + random() * 0.02, speed: 0.22 + random() * 0.28 };
  }

  function makeGecko(index) {
    const group = new THREE.Group();
    const colors = ['#75a958', '#4f9877', '#b2a458'];
    const material = flatMaterial(colors[index % colors.length]);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.105, 6, 4), material); body.scale.set(0.72, 0.45, 1.35); body.position.y = 0.055; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 4), material); head.scale.set(1.05, 0.72, 0.9); head.position.set(0, 0.065, 0.14); group.add(head);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.34, 6), material); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.055, -0.24); group.add(tail);
    const eyeMaterial = flatMaterial('#16211d');
    [-1, 1].forEach(function (side) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 5, 4), eyeMaterial); eye.position.set(side * 0.055, 0.1, 0.18); group.add(eye);
      [-0.045, 0.075].forEach(function (z) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.024), material); leg.position.set(side * 0.09, 0.025, z); leg.rotation.y = side * (z > 0 ? -0.38 : 0.38); group.add(leg); });
    });
    root.add(group);
    return { group: group, head: head, anchor: index % 2 ? woodlandAnchor(index + 7) : landDirection(), angle: random() * Math.PI * 2, phase: random() * Math.PI * 2, radius: 0.004 + random() * 0.008, speed: 0.055 + random() * 0.055 };
  }

  function makeLandCrab(index) {
    const group = new THREE.Group();
    const colors = ['#b6563f', '#d47645', '#875143'];
    const material = flatMaterial(colors[index % colors.length]);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), material); body.scale.set(1.28, 0.52, 0.9); body.position.y = 0.1; group.add(body);
    const dark = flatMaterial('#2b2622');
    [-1, 1].forEach(function (side) {
      for (let legIndex = 0; legIndex < 3; legIndex += 1) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.024), material); leg.position.set(side * (0.13 + legIndex * 0.015), 0.055, -0.07 + legIndex * 0.07); leg.rotation.y = side * (0.55 - legIndex * 0.2); group.add(leg);
      }
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.1, 4), material); stalk.position.set(side * 0.065, 0.2, 0.075); group.add(stalk);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), dark); eye.position.set(side * 0.065, 0.255, 0.075); group.add(eye);
      const claw = new THREE.Mesh(new THREE.SphereGeometry(side > 0 ? 0.06 : 0.045, 5, 4), material); claw.scale.set(1.25, 0.65, 0.85); claw.position.set(side * 0.22, 0.13, 0.11); group.add(claw);
    });
    root.add(group);
    return { group: group, azimuth: random() * Math.PI * 2, phase: random() * Math.PI * 2, speed: 0.025 + random() * 0.025, shoreOffset: 0.014 + random() * 0.018 };
  }

  function makeIguana(index) {
    const group = new THREE.Group();
    const colors = ['#678c45', '#7a9650', '#4f8060'];
    const material = flatMaterial(colors[index % colors.length]);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5), material); body.scale.set(0.75, 0.62, 1.45); body.position.y = 0.15; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 6, 5), material); head.scale.set(0.9, 0.8, 1.05); head.position.set(0, 0.2, 0.24); group.add(head);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.58, 7), material); tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.13, -0.43); group.add(tail);
    const eyeMaterial = flatMaterial('#172116');
    [-1, 1].forEach(function (side) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), eyeMaterial); eye.position.set(side * 0.085, 0.24, 0.31); group.add(eye);
      [-0.08, 0.11].forEach(function (z) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.045), material); leg.position.set(side * 0.14, 0.075, z); leg.rotation.y = side * (z > 0 ? -0.4 : 0.4); group.add(leg); });
    });
    for (let spikeIndex = 0; spikeIndex < 5; spikeIndex += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.11 - spikeIndex * 0.009, 4), flatMaterial('#94a65a')); spike.position.set(0, 0.34, 0.13 - spikeIndex * 0.105); group.add(spike);
    }
    root.add(group);
    return { group: group, head: head, anchor: woodlandAnchor(index + 3), angle: random() * Math.PI * 2, phase: random() * Math.PI * 2, radius: 0.005 + random() * 0.009, speed: 0.018 + random() * 0.018 };
  }

  for (let i = 0; i < 12; i += 1) creatures.pollinators.push(makePollinator(i));
  for (let i = 0; i < 6; i += 1) creatures.frogs.push(makeFrog(i));
  for (let i = 0; i < 6; i += 1) creatures.geckos.push(makeGecko(i));
  for (let i = 0; i < 5; i += 1) creatures.bats.push(makeBat(i));
  for (let i = 0; i < 6; i += 1) creatures.canopyBirds.push(makeCanopyBird(i));
  for (let i = 0; i < 4; i += 1) creatures.wadingBirds.push(makeWadingBird(i));
  for (let i = 0; i < 6; i += 1) creatures.landCrabs.push(makeLandCrab(i));
  for (let i = 0; i < 4; i += 1) creatures.iguanas.push(makeIguana(i));

  let lastRevision = null;
  const activeCounts = { pollinators: 0, frogs: 0, geckos: 0, bats: 0, canopyBirds: 0, wadingBirds: 0, landCrabs: 0, iguanas: 0 };
  function visibleCount(state, id, maximum) {
    const entry = state && state.inhabitants && state.inhabitants[id];
    if (!entry || entry.population <= 0.05) return 0;
    return Math.max(1, Math.min(maximum, Math.round(maximum * Math.min(1, entry.population / Math.max(1, entry.capacity)))));
  }
  function sync(force) {
    const state = options.stateProvider && options.stateProvider();
    if (!state || (!force && state.revision === lastRevision)) return;
    lastRevision = state.revision;
    Object.keys(creatures).forEach(function (id) {
      activeCounts[id] = visibleCount(state, id, creatures[id].length);
      creatures[id].forEach(function (creature, index) { creature.group.userData.populationVisible = index < activeCounts[id]; });
    });
  }

  function tick(deltaSeconds, worldAge) {
    sync(false);
    const state = options.stateProvider && options.stateProvider();
    if (!state) return;
    const phase = options.dayPhaseProvider ? options.dayPhaseProvider() : 0.5;
    const night = phase < 0.23 || phase > 0.77;
    const twilight = phase < 0.31 || phase > 0.69;
    creatures.pollinators.forEach(function (item, index) {
      item.group.visible = item.group.userData.populationVisible && !night;
      if (!item.group.visible) return;
      const angle = item.phase + worldAge * item.speed;
      const direction = offset(item.anchor, angle, item.radius * (1 + Math.sin(worldAge * 0.23 + item.phase) * 0.25));
      place(item.group, direction, 0.35 + Math.sin(worldAge * 2.1 + item.phase) * 0.14, angle + Math.PI / 2);
      const flap = 0.18 + Math.abs(Math.sin(worldAge * 15 + item.phase)) * 0.9; item.left.rotation.y = flap; item.right.rotation.y = -flap;
      item.group.scale.setScalar(0.9 + Math.sin(worldAge * 3 + index) * 0.05);
    });
    creatures.frogs.forEach(function (item, index) {
      item.group.visible = item.group.userData.populationVisible && (twilight || index === 0 || state.climate.rainfallMm > 80);
      if (!item.group.visible) return;
      item.azimuth += deltaSeconds * 0.025 * (index % 2 ? 1 : -1);
      const direction = wetlandDirection(item.azimuth, item.shoreOffset);
      const hopCycle = Math.max(0, Math.sin(worldAge * item.hopRate + item.phase));
      place(item.group, direction, 0.015 + Math.pow(hopCycle, 8) * 0.18, item.azimuth + Math.PI);
    });
    creatures.geckos.forEach(function (item) {
      item.group.visible = item.group.userData.populationVisible && !night;
      if (!item.group.visible) return;
      const scuttle = Math.max(0.08, Math.sin(worldAge * 0.75 + item.phase));
      item.angle += deltaSeconds * item.speed * scuttle;
      const direction = offset(item.anchor, item.angle, item.radius);
      place(item.group, direction, 0.018, item.angle + Math.PI / 2);
      item.head.rotation.y = Math.sin(worldAge * 2.4 + item.phase) * 0.18;
    });
    creatures.bats.forEach(function (item) {
      item.group.visible = item.group.userData.populationVisible && night;
      if (!item.group.visible) return;
      const angle = item.phase + worldAge * item.speed;
      const direction = offset(item.anchor, angle, item.radius);
      place(item.group, direction, 1.4 + Math.sin(worldAge * 1.9 + item.phase) * 0.5, angle);
      const flap = Math.sin(worldAge * 9 + item.phase) * 0.55; item.left.rotation.z = flap; item.right.rotation.z = -flap;
    });
    creatures.canopyBirds.forEach(function (item) {
      item.group.visible = item.group.userData.populationVisible && !night;
      if (!item.group.visible) return;
      const angle = item.phase + worldAge * item.speed;
      const direction = offset(item.anchor, angle, item.radius * (0.8 + Math.sin(worldAge * 0.3 + item.phase) * 0.18));
      const flightPulse = 0.5 + Math.sin(worldAge * 0.42 + item.phase) * 0.5;
      place(item.group, direction, 0.72 + flightPulse * 0.72, angle + Math.PI / 2);
      const flap = Math.sin(worldAge * (5.5 + flightPulse * 5) + item.phase) * (0.18 + flightPulse * 0.55); item.left.rotation.z = flap; item.right.rotation.z = -flap;
    });
    creatures.wadingBirds.forEach(function (item) {
      item.group.visible = item.group.userData.populationVisible && !night;
      if (!item.group.visible) return;
      item.azimuth += deltaSeconds * item.speed;
      const direction = wetlandDirection(item.azimuth, item.shoreOffset);
      place(item.group, direction, 0.01 + Math.abs(Math.sin(worldAge * 1.4 + item.phase)) * 0.025, item.azimuth + Math.PI / 2);
    });
    creatures.landCrabs.forEach(function (item, index) {
      item.group.visible = item.group.userData.populationVisible && (twilight || night || state.climate.rainfallMm > 95 || index === 0);
      if (!item.group.visible) return;
      item.azimuth += deltaSeconds * item.speed * (index % 2 ? 1 : -1) * (0.35 + Math.abs(Math.sin(worldAge * 0.9 + item.phase)));
      const direction = wetlandDirection(item.azimuth, item.shoreOffset);
      place(item.group, direction, 0.015 + Math.abs(Math.sin(worldAge * 2.1 + item.phase)) * 0.012, item.azimuth);
    });
    creatures.iguanas.forEach(function (item) {
      item.group.visible = item.group.userData.populationVisible && !night;
      if (!item.group.visible) return;
      const walking = Math.max(0.06, Math.sin(worldAge * 0.28 + item.phase));
      item.angle += deltaSeconds * item.speed * walking;
      const direction = offset(item.anchor, item.angle, item.radius);
      place(item.group, direction, 0.025, item.angle + Math.PI / 2);
      item.head.rotation.y = Math.sin(worldAge * 0.65 + item.phase) * 0.12;
    });
  }

  sync(true);
  return { root: root, sync: function () { sync(true); }, tick: tick, counts: function () { return Object.assign({}, activeCounts); } };
}
