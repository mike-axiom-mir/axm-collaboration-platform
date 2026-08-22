(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  let Stage = null;
  let StageClass = null;
  let pendingCanvas = null;
  let pendingCore = null;
  let latestFrame = null;
  let loadError = null;

  function hash(x, y, salt) {
    let value = Math.imul(x + 37 + salt, 374761393) ^ Math.imul(y + 89, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return (value ^ (value >>> 16)) >>> 0;
  }

  function boot(THREE) {
    const shadowMaterial = new THREE.MeshStandardMaterial({ color: 0x183c2d, roughness: 1 });

    function material(color, options) {
      return new THREE.MeshStandardMaterial(Object.assign({
        color,
        roughness: 0.88,
        metalness: 0,
        flatShading: true
      }, options || {}));
    }

    function mesh(geometry, surface, position, scale) {
      const value = new THREE.Mesh(geometry, surface);
      value.position.set(position[0], position[1], position[2]);
      if (scale) value.scale.set(scale[0], scale[1], scale[2]);
      value.castShadow = true;
      value.receiveShadow = true;
      return value;
    }

    function box(group, size, color, position, options) {
      const value = mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(color, options), position);
      group.add(value);
      return value;
    }

    function gableGeometry(width, height, depth) {
      const w = width / 2, d = depth / 2;
      const vertices = new Float32Array([
        -w, 0, -d, w, 0, -d, 0, height, -d,
        -w, 0, d, 0, height, d, w, 0, d,
        -w, 0, -d, 0, height, -d, 0, height, d,
        -w, 0, -d, 0, height, d, -w, 0, d,
        w, 0, -d, w, 0, d, 0, height, d,
        w, 0, -d, 0, height, d, 0, height, -d,
        -w, 0, -d, -w, 0, d, w, 0, d,
        -w, 0, -d, w, 0, d, w, 0, -d
      ]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      return geometry;
    }

    class BuddyFarmStage {
      constructor(canvas, core) {
        this.canvas = canvas;
        this.core = core;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x91c7a1);
        this.scene.fog = new THREE.Fog(0x91c7a1, 26, 62);
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
        this.camera.position.set(31, 22, 35);
        this.look = new THREE.Vector3(19, 0, 12);
        this.farm = new THREE.Group();
        this.house = new THREE.Group();
        this.cellar = new THREE.Group();
        this.cropGroup = new THREE.Group();
        this.actorGroup = new THREE.Group();
        this.scene.add(this.farm, this.house, this.cellar, this.cropGroup, this.actorGroup);
        this.actorMeshes = new Map();
        this.cropSignature = '';
        this.currentScene = '';
        this.buildLights();
        this.buildFarm();
        this.buildHouseRoom();
        this.buildCellar();
        this.setScene('farm');
        canvas.closest('.player-view').classList.add('depth-ready');
        canvas.dataset.renderer = 'three-r160-low-poly';
      }

      buildLights() {
        this.hemi = new THREE.HemisphereLight(0xdfffcf, 0x254336, 2.2);
        this.sun = new THREE.DirectionalLight(0xffe4a6, 3.4);
        this.sun.position.set(-14, 28, 18);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(1024, 1024);
        this.sun.shadow.camera.left = -30;
        this.sun.shadow.camera.right = 30;
        this.sun.shadow.camera.top = 30;
        this.sun.shadow.camera.bottom = -30;
        this.sun.shadow.bias = -0.0006;
        this.rim = new THREE.DirectionalLight(0x8fe9cb, 1.05);
        this.rim.position.set(20, 8, -15);
        this.scene.add(this.hemi, this.sun, this.rim);
      }

      buildFarm() {
        const tileGeometry = new THREE.BoxGeometry(0.98, 0.16, 0.98);
        const grassMaterial = material(0x72a955);
        const width = 48, depth = 36;
        const ground = new THREE.InstancedMesh(tileGeometry, grassMaterial, width * depth);
        const matrix = new THREE.Matrix4();
        const color = new THREE.Color();
        let index = 0;
        for (let z = -4; z < depth - 4; z += 1) {
          for (let x = -4; x < width - 4; x += 1) {
            const noise = hash(x, z, 3);
            const y = ((noise % 5) - 2) * 0.018;
            matrix.makeTranslation(x + 0.5, y - 0.09, z + 0.5);
            ground.setMatrixAt(index, matrix);
            color.setHSL(0.265 + (noise % 9) * 0.002, 0.34 + (noise % 4) * 0.025, 0.43 + (noise % 7) * 0.008);
            ground.setColorAt(index, color);
            index += 1;
          }
        }
        ground.receiveShadow = true;
        this.farm.add(ground);

        const pathMaterial = material(0xd1b56e);
        for (let z = 9; z <= 14; z += 1) {
          const pathTile = mesh(tileGeometry, pathMaterial, [19.5, 0.06, z + 0.5]);
          pathTile.receiveShadow = true;
          this.farm.add(pathTile);
        }

        this.core.WORLD.plots.forEach((plot, plotIndex) => {
          const unlocked = plotIndex === 0;
          const soil = box(this.farm, [plot.width - 0.35, 0.18, plot.height - 0.35], unlocked ? 0x704633 : 0x315c42,
            [plot.x + plot.width / 2, unlocked ? 0.08 : 0.03, plot.y + plot.height / 2]);
          soil.receiveShadow = true;
          const railColor = unlocked ? 0xe5ce8c : 0x688469;
          box(this.farm, [plot.width + 0.12, 0.16, 0.12], railColor, [plot.x + plot.width / 2, 0.22, plot.y]);
          box(this.farm, [plot.width + 0.12, 0.16, 0.12], railColor, [plot.x + plot.width / 2, 0.22, plot.y + plot.height]);
          box(this.farm, [0.12, 0.16, plot.height], railColor, [plot.x, 0.22, plot.y + plot.height / 2]);
          box(this.farm, [0.12, 0.16, plot.height], railColor, [plot.x + plot.width, 0.22, plot.y + plot.height / 2]);
          if (unlocked) {
            for (let row = 1; row < plot.height; row += 1) {
              box(this.farm, [plot.width - 0.8, 0.025, 0.07], 0x9c6546, [plot.x + plot.width / 2, 0.19, plot.y + row]);
            }
          }
          if (plot.sign) this.buildSign(plot.sign.x, plot.sign.y, plot.cost, this.farm);
        });

        this.buildExteriorHouse();
        this.buildFarmDetails();
      }

      buildExteriorHouse() {
        const group = new THREE.Group();
        const house = this.core.WORLD.houseExterior;
        const cx = house.x + house.width / 2;
        const cz = house.y + house.height / 2;
        box(group, [10, 3.7, 6.8], 0xf0d89f, [cx, 1.85, cz]);
        const roof = mesh(gableGeometry(11.2, 3.05, 7.9), material(0xa84f45, { side: THREE.DoubleSide }), [cx, 3.7, cz]);
        group.add(roof);
        box(group, [1.22, 2.2, 0.28], 0x6f3b2f, [19.5, 1.12, 9.92]);
        box(group, [0.13, 0.13, 0.1], 0xffd45e, [19.88, 1.15, 10.08], { emissive: 0x805010, emissiveIntensity: 1.2 });
        [17.1, 22.9].forEach(x => {
          box(group, [1.35, 1.25, 0.24], 0xece2b4, [x, 2.15, 9.94]);
          box(group, [1.06, 0.96, 0.12], 0x75c9cf, [x, 2.15, 10.09], { emissive: 0x174d55, emissiveIntensity: 0.7 });
          box(group, [0.08, 1.02, 0.08], 0xf9edc6, [x, 2.15, 10.18]);
          box(group, [1.08, 0.08, 0.08], 0xf9edc6, [x, 2.15, 10.18]);
        });
        box(group, [0.9, 2.5, 0.9], 0x82503e, [23, 5.05, 5.6]);
        this.farm.add(group);
      }

      buildFarmDetails() {
        const treePositions = [[3,5],[7,8],[31,5],[37,9],[3,24],[37,25],[10,3],[29,28],[42,15],[1,14]];
        treePositions.forEach((entry, index) => this.buildTree(entry[0], entry[1], index));
        [[11,11],[28,11],[34,23],[7,23]].forEach((entry, index) => {
          const rock = mesh(new THREE.DodecahedronGeometry(0.46 + index * 0.04, 0), material(index % 2 ? 0x81927c : 0x9aa183), [entry[0], 0.38, entry[1]]);
          rock.rotation.set(0.25, index * 0.7, 0.1);
          this.farm.add(rock);
        });
        const pond = mesh(new THREE.CylinderGeometry(2.65, 2.9, 0.14, 12), material(0x55adb3, { emissive: 0x0c4750, emissiveIntensity: 0.35 }), [6, 0.02, 12]);
        pond.receiveShadow = true;
        this.farm.add(pond);
        for (let i = 0; i < 12; i += 1) {
          const angle = i / 12 * Math.PI * 2;
          const stone = mesh(new THREE.DodecahedronGeometry(0.28, 0), material(0x9f997b), [6 + Math.cos(angle) * 2.75, 0.18, 12 + Math.sin(angle) * 2.75]);
          this.farm.add(stone);
        }
      }

      buildTree(x, z, variant) {
        const tree = new THREE.Group();
        tree.position.set(x, 0, z);
        const trunk = mesh(new THREE.CylinderGeometry(0.25, 0.36, 2.25, 6), material(0x775039), [0, 1.05, 0]);
        const crown = mesh(new THREE.IcosahedronGeometry(1.25 + (variant % 3) * 0.12, 1), material(variant % 2 ? 0x3e7f4d : 0x4b8b50), [0, 2.65, 0]);
        const crown2 = mesh(new THREE.IcosahedronGeometry(0.82, 1), material(0x5e9d55), [0.75, 2.55, 0.12]);
        tree.add(trunk, crown, crown2);
        this.farm.add(tree);
      }

      buildSign(x, z, cost, parent) {
        box(parent, [0.12, 0.95, 0.12], 0x745038, [x + 0.5, 0.48, z + 0.5]);
        const board = box(parent, [1.15, 0.55, 0.14], 0xe2c77c, [x + 0.5, 0.88, z + 0.5]);
        board.rotation.y = -0.12;
        for (let i = 0; i < Math.min(cost, 4); i += 1) {
          const peg = mesh(new THREE.OctahedronGeometry(0.07, 0), material(0x6f4735), [x + 0.25 + i * 0.18, 0.9, z + 0.59]);
          parent.add(peg);
        }
      }

      buildHouseRoom() {
        box(this.house, [14, 0.28, 10], 0xa96f48, [7, -0.14, 5]);
        box(this.house, [14, 3.2, 0.28], 0xe3c18d, [7, 1.6, 0]);
        box(this.house, [0.28, 3.2, 10], 0xe3c18d, [0, 1.6, 5]);
        box(this.house, [3.2, 0.75, 2.2], 0x774e44, [3, 0.5, 2.2]);
        box(this.house, [2.8, 0.4, 1.8], 0xe8cda4, [3, 0.96, 2.2]);
        box(this.house, [1.8, 0.15, 1.0], 0x82b5a2, [3, 1.2, 2.1]);
        box(this.house, [3.1, 0.22, 1.8], 0x7f533d, [8.2, 1.15, 4.7]);
        [[7.1,3.8],[9.3,3.8],[7.1,5.6],[9.3,5.6]].forEach(point => box(this.house, [0.18, 1.1, 0.18], 0x684431, [point[0], 0.56, point[1]]));
        box(this.house, [2.6, 0.4, 1.7], 0xd5a762, [11.5, 0.2, 2]);
        for (let i = 0; i < 4; i += 1) box(this.house, [2.25 - i * 0.42, 0.22, 0.5], 0x69524a, [11.5, 0.25 + i * 0.22, 1.2 + i * 0.48]);
        const rug = mesh(new THREE.BoxGeometry(3.8, 0.04, 2.5), material(0x5d8f76), [7, 0.03, 7]);
        this.house.add(rug);
        const lamp = new THREE.PointLight(0xffcf72, 3, 20, 2);
        lamp.position.set(7, 4.4, 4.5);
        this.house.add(lamp);
      }

      buildCellar() {
        box(this.cellar, [12, 0.3, 8], 0x303b39, [6, -0.15, 4]);
        box(this.cellar, [12, 3.4, 0.3], 0x4a514e, [6, 1.7, 0]);
        box(this.cellar, [0.3, 3.4, 8], 0x4a514e, [0, 1.7, 4]);
        [[2,2],[4.5,2],[9.5,5.7],[7.2,6.3]].forEach((point, index) => {
          box(this.cellar, [1.5, 1.1 + (index % 2) * 0.45, 1.35], index % 2 ? 0x78533d : 0x8c6245, [point[0], 0.55, point[1]]);
        });
        for (let i = 0; i < 4; i += 1) box(this.cellar, [2.1 - i * 0.35, 0.2, 0.48], 0x6d716b, [6, 0.25 + i * 0.2, 0.85 + i * 0.44]);
        const cellarLight = new THREE.PointLight(0xffb45f, 2.6, 16, 2);
        cellarLight.position.set(6, 3.5, 4);
        this.cellar.add(cellarLight);
      }

      buildActor(actor) {
        const appearance = actor.appearance || {};
        const group = new THREE.Group();
        const shadow = mesh(new THREE.CylinderGeometry(0.46, 0.55, 0.035, 12), shadowMaterial, [0, 0.035, 0]);
        shadow.material.transparent = true;
        shadow.material.opacity = 0.28;
        shadow.castShadow = false;
        const boots = material(appearance.boots || '#253d55');
        const shirt = material(appearance.shirt || '#52e6ad');
        const skin = material(0xf2bd82);
        const hair = material(appearance.hair || '#493326');
        const leftBoot = mesh(new THREE.BoxGeometry(0.23, 0.22, 0.38), boots, [-0.2, 0.18, 0.03]);
        const rightBoot = mesh(new THREE.BoxGeometry(0.23, 0.22, 0.38), boots, [0.2, 0.18, 0.03]);
        const body = mesh(new THREE.CylinderGeometry(0.39, 0.46, 0.86, 6), shirt, [0, 0.78, 0]);
        const head = mesh(new THREE.IcosahedronGeometry(0.42, 1), skin, [0, 1.46, 0]);
        const hairCap = mesh(new THREE.SphereGeometry(0.43, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), hair, [0, 1.54, 0]);
        const nose = mesh(new THREE.ConeGeometry(0.075, 0.18, 5), skin, [0, 1.43, 0.43]);
        nose.rotation.x = Math.PI / 2;
        const tool = mesh(new THREE.BoxGeometry(0.08, 0.86, 0.08), material(0xb78a55), [0.55, 0.75, 0]);
        tool.rotation.z = -0.22;
        group.add(shadow, leftBoot, rightBoot, body, head, hairCap, nose, tool);
        group.userData = { leftBoot, rightBoot, body, tool };
        this.actorGroup.add(group);
        this.actorMeshes.set(actor.id, group);
        return group;
      }

      rebuildCrops(state) {
        const cells = Object.values((state.farm && state.farm.cells) || {});
        const signature = cells.map(cell => [cell.x, cell.y, cell.tilled, cell.crop, cell.growth, cell.watered].join(':')).sort().join('|');
        if (signature === this.cropSignature) return;
        this.cropSignature = signature;
        this.cropGroup.clear();
        cells.forEach(cell => {
          box(this.cropGroup, [0.82, 0.11, 0.82], cell.watered ? 0x4b4740 : 0x714532, [cell.x + 0.5, 0.19, cell.y + 0.5]);
          if (!cell.crop) return;
          const growth = Math.max(0.25, Math.min(1, Number(cell.growth || 0) / 3));
          const stem = mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.65 * growth, 5), material(0x3f8548), [cell.x + 0.5, 0.28 + 0.32 * growth, cell.y + 0.5]);
          this.cropGroup.add(stem);
          for (let i = 0; i < 4; i += 1) {
            const angle = i * Math.PI / 2;
            const leaf = mesh(new THREE.ConeGeometry(0.14, 0.45 * growth, 4), material(i % 2 ? 0x66a957 : 0x4f914b),
              [cell.x + 0.5 + Math.cos(angle) * 0.13, 0.48 + 0.22 * growth, cell.y + 0.5 + Math.sin(angle) * 0.13]);
            leaf.rotation.z = Math.cos(angle) * 0.55;
            leaf.rotation.x = Math.sin(angle) * 0.55;
            this.cropGroup.add(leaf);
          }
          if (growth > 0.8) this.cropGroup.add(mesh(new THREE.IcosahedronGeometry(0.2, 0), material(0xe69245), [cell.x + 0.5, 0.35, cell.y + 0.5]));
        });
      }

      setScene(sceneName) {
        this.currentScene = sceneName;
        this.farm.visible = sceneName === 'farm';
        this.cropGroup.visible = sceneName === 'farm';
        this.house.visible = sceneName === 'house';
        this.cellar.visible = sceneName === 'cellar';
        if (sceneName === 'farm') {
          this.scene.background.setHex(0x91c7a1);
          this.scene.fog.color.setHex(0x91c7a1);
          this.scene.fog.near = 26;
          this.scene.fog.far = 62;
        } else if (sceneName === 'house') {
          this.scene.background.setHex(0x3d2725);
          this.scene.fog.color.setHex(0x3d2725);
          this.scene.fog.near = 18;
          this.scene.fog.far = 34;
        } else {
          this.scene.background.setHex(0x171f21);
          this.scene.fog.color.setHex(0x171f21);
          this.scene.fog.near = 13;
          this.scene.fog.far = 28;
        }
      }

      updateActors(frame) {
        const live = new Set();
        frame.actors.forEach((actor, index) => {
          live.add(actor.id);
          const group = this.actorMeshes.get(actor.id) || this.buildActor(actor);
          group.visible = actor.scene === frame.focus.scene;
          group.position.set(actor.x + 0.5, 0, actor.y + 0.5);
          const directions = { down: 0, left: -Math.PI / 2, up: Math.PI, right: Math.PI / 2 };
          group.rotation.y = directions[actor.facing] || 0;
          const walk = Math.sin(frame.time * 11 + index * 1.7) * 0.08;
          group.userData.leftBoot.position.z = 0.03 + walk;
          group.userData.rightBoot.position.z = 0.03 - walk;
          group.userData.body.position.y = 0.78 + Math.abs(walk) * 0.35;
          if (actor.workState && actor.workState.kind !== 'idle') group.userData.tool.rotation.z = -0.22 + Math.sin(frame.time * 15) * 0.65;
        });
        Array.from(this.actorMeshes.keys()).forEach(id => {
          if (!live.has(id)) {
            this.actorGroup.remove(this.actorMeshes.get(id));
            this.actorMeshes.delete(id);
          }
        });
      }

      render(frame) {
        if (!frame || !frame.focus) return;
        if (this.currentScene !== frame.focus.scene) this.setScene(frame.focus.scene);
        this.canvas.closest('.player-view').dataset.threeStatus = 'ready';
        this.rebuildCrops(frame.state);
        this.updateActors(frame);
        const width = Math.max(320, this.canvas.clientWidth || 640);
        const height = Math.max(320, this.canvas.clientHeight || 520);
        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        const wantedWidth = Math.round(width * dpr), wantedHeight = Math.round(height * dpr);
        if (this.canvas.width !== wantedWidth || this.canvas.height !== wantedHeight) {
          this.renderer.setSize(width, height, false);
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
        }
        const targetX = frame.camera.x + 0.5;
        const targetZ = frame.camera.y + 0.5;
        this.look.lerp(new THREE.Vector3(targetX, 0.55, targetZ - (frame.focus.scene === 'farm' ? 1.5 : 0)), 0.18);
        const indoor = frame.focus.scene !== 'farm';
        const offsetX = indoor ? 8.5 : 12.5;
        const offsetY = indoor ? 12.5 : 17.5;
        const offsetZ = indoor ? 11.5 : 16.5;
        const desired = new THREE.Vector3(this.look.x + offsetX, offsetY, this.look.z + offsetZ);
        this.camera.position.lerp(desired, 0.18);
        this.camera.lookAt(this.look);
        const daylight = frame.focus.scene === 'farm' ? 1 : 0.64;
        this.sun.intensity = 3.4 * daylight;
        this.hemi.intensity = 2.2 * daylight;
        this.rim.intensity = frame.focus.scene === 'cellar' ? 0.35 : 1.05;
        this.sun.position.x = -14 + Math.sin(frame.time * 0.05) * 4;
        this.renderer.render(this.scene, this.camera);
      }
    }

    return BuddyFarmStage;
  }

  function attach(canvas, core) {
    pendingCanvas = canvas;
    pendingCore = core;
    if (Stage || loadError || !canvas || !core || !StageClass) return;
    Stage = new StageClass(canvas, core);
    if (latestFrame) Stage.render(latestFrame);
  }

  function render(frame) {
    latestFrame = frame;
    if (Stage) Stage.render(frame);
  }

  window.BuddyFarmThree = {
    attach,
    render,
    status: function () {
      return loadError ? 'failed' : Stage ? 'ready' : 'loading';
    }
  };

  import('/vendor/three.module.js').then(THREE => {
    StageClass = boot(THREE);
    attach(pendingCanvas, pendingCore);
  }).catch(error => {
    loadError = error;
    if (pendingCanvas) {
      pendingCanvas.dataset.renderer = 'three-unavailable';
      pendingCanvas.closest('.player-view').classList.remove('depth-ready');
    }
    console.warn('BuddyFarm low-poly depth layer unavailable:', error.message);
  });
})();
