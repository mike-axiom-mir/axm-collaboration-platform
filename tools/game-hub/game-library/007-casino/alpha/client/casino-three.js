(function () {
  "use strict";

  var THREE = null;
  var ready = false;
  var failed = false;
  var district = null;
  var cabinet = null;
  var app = document.getElementById("app");
  var colors = {
    "lux-5": "#ff5daa", "graftgarden": "#66e6a6", "mirror-mice": "#b993ff",
    "night-courier": "#4de7f4", "pocket-vault": "#ffd56a", "weatherheart": "#79c9ff",
    "spare-parts-choir": "#ff8da8", "nullbloom": "#f06bff", "orbit-oven": "#ff9c5a",
    "twinlight-relay": "#6e91ff"
  };

  window.CasinoThree = {
    attach: scan,
    status: function () {
      return {
        ready: ready,
        failed: failed,
        renderer: ready ? "three-r160" : null,
        district: !!(district && district.canvas.isConnected),
        cabinet: !!(cabinet && cabinet.canvas.isConnected)
      };
    }
  };

  function seeded(seed) {
    var value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function () { return (value = value * 16807 % 2147483647) / 2147483647; };
  }

  function material(value, emissive, roughness, metalness) {
    return new THREE.MeshStandardMaterial({
      color: value, emissive: value,
      emissiveIntensity: emissive == null ? 0.12 : emissive,
      roughness: roughness == null ? 0.72 : roughness,
      metalness: metalness == null ? 0.16 : metalness,
      flatShading: true
    });
  }

  function shadow(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

  function box(parent, size, position, mat, rotation) {
    var mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat));
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    parent.add(mesh);
    return mesh;
  }

  function rendererFor(canvas) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    return renderer;
  }

  function fit(instance, scale) {
    var rect = instance.canvas.getBoundingClientRect();
    var width = Math.max(2, Math.round(rect.width * scale));
    var height = Math.max(2, Math.round(rect.height * scale));
    if (width === instance.width && height === instance.height) return;
    instance.width = width;
    instance.height = height;
    instance.renderer.setSize(width, height, false);
    instance.camera.aspect = width / height;
    instance.camera.updateProjectionMatrix();
  }

  function lights(scene, accent) {
    scene.add(new THREE.HemisphereLight(0xbfefff, 0x120822, 1.4));
    var key = new THREE.DirectionalLight(0xe8fbff, 2.1);
    key.position.set(-8, 13, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    key.shadow.camera.left = -14; key.shadow.camera.right = 14;
    key.shadow.camera.top = 14; key.shadow.camera.bottom = -14;
    scene.add(key);
    var rim = new THREE.PointLight(accent, 24, 30);
    rim.position.set(8, 5, 4);
    scene.add(rim);
  }

  function tower(accent, party) {
    var group = new THREE.Group();
    var shell = material(party === "A" ? "#3a1938" : "#113547", 0.12, 0.75, 0.26);
    var glow = material(accent, 1.45, 0.32, 0.24);
    box(group, [3.6, 1.05, 3.25], [0, 0.52, 0], shell);
    box(group, [2.75, 3.65, 2.55], [0, 2.82, 0], shell);
    box(group, [2.15, 0.48, 0.18], [0, 3.4, 1.36], glow);
    var crown = shadow(new THREE.Mesh(new THREE.ConeGeometry(2.08, 2.05, 5), glow));
    crown.position.y = 5.67;
    crown.rotation.y = party === "A" ? -0.25 : 0.25;
    group.add(crown);
    for (var i = -1; i <= 1; i++) box(group, [0.38, 0.5, 0.1], [i * 0.7, 2.36, 1.33], glow);
    return group;
  }

  function createDistrict() {
    var canvas = document.createElement("canvas");
    canvas.className = "district-3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    var renderer = rendererFor(canvas);
    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x050713, 15, 35);
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.position.set(0, 11.8, 16.8);
    camera.lookAt(0, 1.05, 0);
    lights(scene, 0xff5daa);

    var root = new THREE.Group();
    scene.add(root);
    var ground = shadow(new THREE.Mesh(new THREE.CylinderGeometry(11.2, 12, 1.1, 12), material("#10142c", 0.06, 0.95, 0.12)));
    ground.scale.z = 0.63;
    ground.position.y = -0.55;
    root.add(ground);
    var grid = new THREE.GridHelper(22, 18, 0x4de7f4, 0x292944);
    grid.position.y = 0.03;
    grid.scale.z = 0.62;
    root.add(grid);
    var road = new THREE.Mesh(new THREE.RingGeometry(4.9, 5.18, 32), new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, opacity: 0.38, side: THREE.DoubleSide }));
    road.rotation.x = -Math.PI / 2;
    road.scale.y = 0.62;
    road.position.y = 0.08;
    root.add(road);

    var towerA = tower("#ff5daa", "A");
    towerA.position.set(-8.1, 0, 0.35);
    root.add(towerA);
    var towerB = tower("#4de7f4", "B");
    towerB.position.set(8.1, 0, 0.35);
    root.add(towerB);

    var spotPositions = [[-4.3,-3.15],[0,-3.65],[4.3,-3.15],[-4.3,3.15],[0,3.65],[4.3,3.15]];
    var spots = spotPositions.map(function (position, index) {
      var group = new THREE.Group();
      var base = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.3, 0.62, 6), material(index % 2 ? "#172c45" : "#2b1b3e", 0.1, 0.84, 0.14)));
      base.position.y = 0.31;
      var beacon = shadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), material(index % 2 ? "#4de7f4" : "#ff5daa", 0.9, 0.38, 0.16)));
      beacon.position.y = 1.18;
      group.add(base, beacon);
      group.position.set(position[0], 0, position[1]);
      group.userData.beacon = beacon;
      root.add(group);
      return group;
    });

    var center = new THREE.Group();
    var centerBase = shadow(new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.35, 0.86, 8), material("#37264f", 0.18, 0.66, 0.2)));
    centerBase.position.y = 0.43;
    var centerBody = box(center, [2.7, 2.15, 1.65], [0, 1.82, 0], material("#251735", 0.13, 0.58, 0.34));
    var centerScreen = box(center, [2.12, 1.15, 0.14], [0, 1.95, 0.87], material("#ffd56a", 1.15, 0.32, 0.22));
    var centerCrown = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.72, 1.5, 5), material("#ffd56a", 1.05, 0.4, 0.25)));
    centerCrown.position.y = 3.62;
    center.add(centerBase, centerCrown);
    root.add(center);

    var random = seeded(7007);
    var debris = [];
    for (var d = 0; d < 34; d++) {
      var shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.12 + random() * 0.26, 0), material(d % 3 === 0 ? "#ffd56a" : (d % 2 ? "#4de7f4" : "#ff5daa"), 0.7, 0.48, 0.08));
      var angle = random() * Math.PI * 2;
      var radius = 6 + random() * 6;
      shard.position.set(Math.cos(angle) * radius, 0.5 + random() * 5.2, Math.sin(angle) * radius * 0.62);
      shard.rotation.set(random() * 2, random() * 2, random() * 2);
      root.add(shard);
      debris.push(shard);
    }

    var markers = [];
    for (var m = 0; m < 8; m++) {
      var marker = new THREE.Group();
      var markerBody = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.28, 0.7, 5), material(m < 4 ? "#ff5daa" : "#4de7f4", 0.55, 0.6, 0.08)));
      markerBody.position.y = 0.42;
      var markerHead = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), material("#fff1fb", 0.18, 0.72, 0.04)));
      markerHead.position.y = 0.96;
      marker.add(markerBody, markerHead);
      marker.visible = false;
      root.add(marker);
      markers.push(marker);
    }

    return { canvas: canvas, renderer: renderer, scene: scene, camera: camera, root: root, towerB: towerB, spots: spots, center: center, road: road, debris: debris, markers: markers, width: 0, height: 0 };
  }

  function styleId(stage) {
    var list = Array.prototype.slice.call(stage.classList);
    for (var i = 0; i < list.length; i++) if (list[i].indexOf("style-") === 0) return list[i].slice(6);
    return "lux-5";
  }

  function buildBot(instance, id, accentValue) {
    while (instance.bot.children.length) instance.bot.remove(instance.bot.children[instance.bot.children.length - 1]);
    instance.id = id;
    instance.accent = accentValue;
    var bot = instance.bot;
    var shell = material("#51436d", 0.2, 0.48, 0.42);
    var dark = material("#171426", 0.08, 0.74, 0.22);
    var accent = material(accentValue, 1.08, 0.32, 0.28);
    var pale = material("#dffbff", 0.3, 0.52, 0.12);
    var body = box(bot, [5.1, 5.25, 1.5], [0, 0.45, 0], shell);
    var chest = box(bot, [4.18, 2.75, 0.16], [0, 0.72, 0.84], dark);
    var chestGlow = box(bot, [3.72, 0.2, 0.12], [0, 2.18, 0.94], accent);
    var head = new THREE.Group();
    head.position.y = 5.18;
    head.scale.setScalar(0.82);
    bot.add(head);
    if (id === "lux-5") {
      var luxRim = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(1.78, 0), accent));
      luxRim.scale.set(1.1, 0.56, 0.62);
      luxRim.position.z = -0.2;
      head.add(luxRim);
    } else {
      box(head, [3.72, 1.7, 1.08], [0, 0, -0.24], accent);
    }

    var headMesh;
    if (id === "lux-5") {
      headMesh = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(1.63, 0), shell));
      headMesh.scale.set(1.08, 0.49, 0.58);
      head.add(headMesh);
    } else if (id === "mirror-mice" || id === "orbit-oven" || id === "pocket-vault") {
      headMesh = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 1.22, id === "mirror-mice" ? 8 : 12), shell));
      headMesh.rotation.z = Math.PI / 2;
      head.add(headMesh);
    } else if (id === "nullbloom") {
      headMesh = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(1.42, 1), dark));
      head.add(headMesh);
    } else if (id === "weatherheart") {
      headMesh = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(1.52, 1), shell));
      headMesh.scale.y = 0.65;
      head.add(headMesh);
    } else {
      headMesh = box(head, [3.35, 1.38, 1.4], [0, 0, 0], shell);
    }
    var eyeLeft = box(head, [0.64, 0.22, 0.15], [-0.78, 0.08, 0.76], accent);
    var eyeRight = box(head, [0.64, 0.22, 0.15], [0.78, 0.08, 0.76], accent);
    var mouth = box(head, [0.88, 0.12, 0.14], [0, -0.43, 0.76], pale);

    if (id === "lux-5") {
      [-1, 1].forEach(function (side) {
        var ear = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 6), accent));
        ear.position.set(side * 1.88, 0.02, 0);
        ear.rotation.z = Math.PI / 2;
        head.add(ear);
      });
    } else if (id === "graftgarden") {
      [-1, 1].forEach(function (side) {
        var leaf = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.45, 4), accent));
        leaf.position.set(side * 1.55, 0.62, 0);
        leaf.rotation.z = side * -0.56;
        head.add(leaf);
      });
    } else if (id === "mirror-mice") {
      [-1, 1].forEach(function (side) {
        var ear = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), accent));
        ear.position.set(side * 1.45, 0.65, 0);
        head.add(ear);
      });
    } else if (id === "spare-parts-choir") {
      for (var note = -2; note <= 2; note++) box(head, [0.18, 0.65 + (note + 2) * 0.2, 0.18], [note * 0.47, 1.02, 0], accent);
    } else if (id === "nullbloom") {
      var bloom = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.16, 4, 12), new THREE.MeshBasicMaterial({ color: accentValue, transparent: true, opacity: 0.76 }));
      bloom.position.z = 0.1;
      head.add(bloom);
    } else if (id === "twinlight-relay") {
      [-1, 1].forEach(function (side) {
        box(head, [0.18, 1.35, 0.18], [side * 1.22, 1.05, 0], accent);
        var relayTip = shadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), accent));
        relayTip.position.set(side * 1.22, 1.78, 0);
        head.add(relayTip);
      });
    } else {
      var stem = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.92, 6), dark));
      stem.position.y = 1.1;
      head.add(stem);
      var tip = shadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), accent));
      tip.position.y = 1.68;
      head.add(tip);
    }

    var arms = [];
    [-1, 1].forEach(function (side) {
      var arm = new THREE.Group();
      arm.position.set(side * 3.0, 1.35, 0.05);
      box(arm, [0.72, 2.05, 0.78], [side * 0.28, -0.45, 0], shell, [0, 0, side * -0.35]);
      var joint = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 0), accent));
      joint.position.set(side * 0.66, -1.38, 0);
      arm.add(joint);
      var hand = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(0.68, 0), dark));
      hand.position.set(side * 0.78, -2.18, 0);
      arm.add(hand);
      bot.add(arm);
      arms.push(arm);
    });
    [-1, 1].forEach(function (side) { box(bot, [1.75, 0.72, 1.55], [side * 1.55, -2.55, 0.12], dark, [0, side * 0.08, 0]); });
    instance.parts = { body: body, chest: chest, glow: chestGlow, head: head, eyes: [eyeLeft, eyeRight], mouth: mouth, arms: arms };
  }

  function createCabinet() {
    var canvas = document.createElement("canvas");
    canvas.className = "cabinet-3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    var renderer = rendererFor(canvas);
    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070813, 0.045);
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 70);
    camera.position.set(1.15, 2.1, 15.6);
    camera.lookAt(0, 1.25, 0);
    lights(scene, 0xff5daa);
    var bot = new THREE.Group();
    bot.position.y = 0.25;
    scene.add(bot);
    var floor = shadow(new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.8, 0.65, 12), material("#111329", 0.05, 0.86, 0.14)));
    floor.scale.z = 0.58;
    floor.position.y = -3.2;
    scene.add(floor);
    var grid = new THREE.GridHelper(15, 16, 0xff5daa, 0x252044);
    grid.position.y = -2.85;
    grid.scale.z = 0.7;
    scene.add(grid);
    var particles = [];
    var random = seeded(7707);
    for (var i = 0; i < 26; i++) {
      var particle = new THREE.Mesh(new THREE.OctahedronGeometry(0.08 + random() * 0.18, 0), material(i % 2 ? "#4de7f4" : "#ff5daa", 0.55, 0.45, 0.08));
      particle.position.set((random() - 0.5) * 13, -2 + random() * 11, -2 + random() * 3);
      scene.add(particle);
      particles.push(particle);
    }
    var instance = { canvas: canvas, renderer: renderer, scene: scene, camera: camera, bot: bot, grid: grid, particles: particles, id: "", accent: "", parts: null, stage: null, width: 0, height: 0 };
    buildBot(instance, "lux-5", colors["lux-5"]);
    return instance;
  }

  function attachDistrict(target) {
    if (!district) district = createDistrict();
    if (district.canvas.parentElement !== target) target.insertBefore(district.canvas, target.firstChild);
    target.classList.add("three-district");
    target.dataset.renderer = "three-r160";
    target.dataset.scene3d = "casino-district";
  }

  function attachCabinet(target) {
    if (!cabinet) cabinet = createCabinet();
    if (cabinet.canvas.parentElement !== target) target.insertBefore(cabinet.canvas, target.firstChild);
    cabinet.stage = target;
    target.classList.add("three-cabinet");
    target.dataset.renderer = "three-r160";
    target.dataset.scene3d = "low-poly-cabinet";
    var id = styleId(target);
    var accent = colors[id] || String(getComputedStyle(target).getPropertyValue("--machine-accent") || "#4de7f4").trim();
    if (id !== cabinet.id || accent !== cabinet.accent) buildBot(cabinet, id, accent);
  }

  function scan() {
    if (!ready) return;
    var map = document.querySelector(".district-map");
    if (map) attachDistrict(map);
    var stage = document.querySelector(".robot-stage");
    if (stage) attachCabinet(stage);
  }

  function drawDistrict(time) {
    if (!district || !district.canvas.isConnected) return;
    var target = district.canvas.parentElement;
    fit(district, 0.76);
    district.towerB.visible = !!target.querySelector(".casino-b");
    var peopleA = target.querySelectorAll(".casino-a .person-chip").length;
    var peopleB = target.querySelectorAll(".casino-b .person-chip").length;
    var contestPeople = target.querySelectorAll(".contest-node .person-chip").length;
    district.markers.forEach(function (marker, index) {
      marker.visible = index < peopleA + peopleB + contestPeople;
      if (!marker.visible) return;
      var inA = index < peopleA;
      var inB = !inA && index < peopleA + peopleB;
      var local = inA ? index : (inB ? index - peopleA : index - peopleA - peopleB);
      marker.position.set((inA ? -7.2 : (inB ? 7.2 : 0)) + (local % 2) * 0.65 - 0.3, 0.05, (inA || inB ? 2.35 : 0.8) + Math.floor(local / 2) * 0.62);
      marker.rotation.y = time * 0.0006 + index;
    });
    district.spots.forEach(function (spot, index) {
      spot.userData.beacon.rotation.y = time * 0.0012 + index;
      spot.userData.beacon.position.y = 1.18 + Math.sin(time * 0.0024 + index) * 0.12;
      var node = target.querySelector(".spot-" + (index + 1));
      spot.scale.y = node && (node.classList.contains("claimed-a") || node.classList.contains("claimed-b")) ? 1.35 : 1;
    });
    district.center.rotation.y = Math.sin(time * 0.00055) * 0.16;
    district.road.rotation.z = time * 0.00004;
    district.debris.forEach(function (shard, index) { shard.rotation.y += 0.002; shard.position.y += Math.sin(time * 0.001 + index) * 0.0008; });
    district.root.rotation.y = -0.04 + Math.sin(time * 0.00012) * 0.018;
    district.renderer.render(district.scene, district.camera);
  }

  function drawCabinet(time) {
    if (!cabinet || !cabinet.canvas.isConnected || !cabinet.stage) return;
    fit(cabinet, 0.72);
    var stage = cabinet.stage;
    var nextId = styleId(stage);
    var nextAccent = colors[nextId] || String(getComputedStyle(stage).getPropertyValue("--machine-accent") || "#4de7f4").trim();
    if (nextId !== cabinet.id || nextAccent !== cabinet.accent) buildBot(cabinet, nextId, nextAccent);
    var spinning = stage.classList.contains("is-spinning");
    var celebrating = stage.classList.contains("fresh-settlement") && !stage.classList.contains("mood-quiet");
    cabinet.bot.position.y = 0.25 + Math.sin(time * 0.0018) * 0.08 + (celebrating ? Math.abs(Math.sin(time * 0.008)) * 0.24 : 0);
    cabinet.bot.rotation.y = Math.sin(time * 0.00055) * 0.045;
    cabinet.parts.head.rotation.y = 0.08 + Math.sin(time * 0.0012) * 0.08;
    cabinet.parts.head.rotation.z = celebrating ? Math.sin(time * 0.012) * 0.04 : 0;
    cabinet.parts.arms.forEach(function (arm, index) {
      arm.rotation.z = spinning ? Math.sin(time * 0.018 + index * Math.PI) * 0.34 : (celebrating ? (index ? -0.42 : 0.42) : 0);
      arm.rotation.x = spinning ? Math.sin(time * 0.013 + index) * 0.15 : 0;
    });
    cabinet.parts.eyes.forEach(function (eye, index) { eye.scale.x = spinning ? 0.55 + Math.abs(Math.sin(time * 0.017 + index)) * 0.85 : 1; });
    cabinet.parts.glow.scale.x = 0.94 + Math.sin(time * 0.004) * 0.06;
    cabinet.particles.forEach(function (particle, index) { particle.rotation.y += 0.003; particle.position.y += Math.sin(time * 0.0012 + index) * 0.0007; });
    cabinet.renderer.render(cabinet.scene, cabinet.camera);
  }

  function frame(time) {
    drawDistrict(time || 0);
    drawCabinet(time || 0);
    requestAnimationFrame(frame);
  }

  function init(module) {
    THREE = module;
    ready = true;
    if (app) new MutationObserver(function () { queueMicrotask(scan); }).observe(app, { childList: true, subtree: true });
    scan();
    requestAnimationFrame(frame);
  }

  import("/vendor/three.module.js").then(init).catch(function (error) {
    failed = true;
    document.documentElement.dataset.casinoRenderer = "css-fallback";
    console.warn("Casino low-poly renderer unavailable; retaining the complete CSS/DOM presentation.", error && error.message || error);
  });
}());
