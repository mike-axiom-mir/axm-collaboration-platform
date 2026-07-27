import * as THREE from '../../shared/vendor/three-r160/three.module.js';

function radians(degrees) { return degrees * Math.PI / 180; }

function geometryFor(primitive) {
  if (primitive === 'box') return new THREE.BoxGeometry(1, 1, 1);
  if (primitive === 'sphere') return new THREE.SphereGeometry(1, 28, 18);
  if (primitive === 'cylinder') return new THREE.CylinderGeometry(1, 1, 1, 28);
  if (primitive === 'cone') return new THREE.ConeGeometry(1, 1, 28);
  if (primitive === 'plane') return new THREE.PlaneGeometry(1, 1);
  if (primitive === 'ring') return new THREE.TorusGeometry(1, 0.025, 8, 64);
  throw new Error('Screen Deck cannot render primitive: ' + primitive);
}

function stateMatches(state, when) {
  return !!when && state[when.key] === when.equals;
}

function resolvedPresentation(node, entityState) {
  var presentation = {
    color: node.render.color,
    emissive: node.render.emissive,
    emissiveIntensity: node.render.emissiveIntensity,
    opacity: node.render.opacity,
    visible: true,
    positionOffset: [0, 0, 0],
    rotationOffset: [0, 0, 0]
  };
  (node.render.variants || []).forEach(function (variant) {
    if (!stateMatches(entityState, variant.when)) return;
    Object.keys(variant.set || {}).forEach(function (key) { presentation[key] = variant.set[key]; });
  });
  return presentation;
}

export class ScreenDeckRenderer {
  constructor(canvas, plan) {
    this.canvas = canvas;
    this.plan = plan;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(plan.environment.skyColor);
    this.scene.fog = new THREE.Fog(plan.environment.fogColor, plan.environment.fogNear, plan.environment.fogFar);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 400);
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.nodes = new Map();
    this._buildEnvironment();
    this._buildNodes();
    this._boundRender = this.render.bind(this);
    window.addEventListener('resize', this._boundRender);
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(this._boundRender);
      this._resizeObserver.observe(this.canvas);
    }
  }

  _buildEnvironment() {
    var environment = this.plan.environment;
    var width = environment.bounds.maxX - environment.bounds.minX;
    var depth = environment.bounds.maxZ - environment.bounds.minZ;
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: environment.groundColor, roughness: 0.92, metalness: 0.04 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((environment.bounds.minX + environment.bounds.maxX) / 2, environment.groundY, (environment.bounds.minZ + environment.bounds.maxZ) / 2);
    ground.name = 'adapter-ground-projection';
    this.scene.add(ground);

    var gridSize = Math.max(width, depth);
    var grid = new THREE.GridHelper(gridSize, Math.min(60, Math.round(gridSize * 2)), 0x2d766f, 0x173342);
    grid.position.y = environment.groundY + 0.012;
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    this.scene.add(grid);

    environment.lights.forEach(light => {
      var instance;
      if (light.kind === 'ambient') instance = new THREE.AmbientLight(light.color, light.intensity);
      if (light.kind === 'directional') instance = new THREE.DirectionalLight(light.color, light.intensity);
      if (light.kind === 'point') instance = new THREE.PointLight(light.color, light.intensity, 28, 1.6);
      if (!instance) return;
      if (light.position) instance.position.fromArray(light.position);
      instance.name = light.id;
      this.scene.add(instance);
    });
  }

  _buildNodes() {
    this.plan.nodes.forEach(node => {
      var material = new THREE.MeshStandardMaterial({
        color: node.render.color,
        emissive: node.render.emissive,
        emissiveIntensity: node.render.emissiveIntensity,
        opacity: node.render.opacity,
        transparent: node.render.opacity < 1,
        depthWrite: node.render.opacity >= 0.5,
        roughness: node.render.roughness,
        metalness: node.render.metalness,
        side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geometryFor(node.render.primitive), material);
      mesh.name = node.id;
      mesh.position.fromArray(node.canonicalTransform.position);
      mesh.rotation.set(radians(node.canonicalTransform.rotation[0]), radians(node.canonicalTransform.rotation[1]), radians(node.canonicalTransform.rotation[2]));
      mesh.scale.fromArray(node.canonicalTransform.scale);
      mesh.userData.holodeckNodeId = node.id;
      this.scene.add(mesh);
      this.nodes.set(node.id, { node: node, mesh: mesh });
    });
  }

  sync(state) {
    this.state = state;
    this.nodes.forEach(record => {
      var nodeState = state.entities[record.node.id] || {};
      var view = resolvedPresentation(record.node, nodeState);
      var base = record.node.canonicalTransform;
      var positionOffset = view.positionOffset || [0, 0, 0];
      var rotationOffset = view.rotationOffset || [0, 0, 0];
      record.mesh.position.set(base.position[0] + positionOffset[0], base.position[1] + positionOffset[1], base.position[2] + positionOffset[2]);
      record.mesh.rotation.set(radians(base.rotation[0] + rotationOffset[0]), radians(base.rotation[1] + rotationOffset[1]), radians(base.rotation[2] + rotationOffset[2]));
      record.mesh.visible = view.visible !== false;
      record.mesh.material.color.set(view.color);
      record.mesh.material.emissive.set(view.emissive);
      record.mesh.material.emissiveIntensity = view.emissiveIntensity;
      record.mesh.material.opacity = view.opacity;
      record.mesh.material.transparent = view.opacity < 1;
      record.mesh.material.depthWrite = view.opacity >= 0.5;
      record.mesh.material.needsUpdate = true;
    });
    var heading = radians(state.player.headingDegrees);
    var position = state.player.position;
    this.camera.position.set(position[0], position[1] + 1.68, position[2]);
    this.camera.lookAt(position[0] + Math.sin(heading) * 10, position[1] + 1.62, position[2] - Math.cos(heading) * 10);
    this.render();
  }

  _resize() {
    var width = Math.max(1, this.canvas.clientWidth);
    var height = Math.max(1, this.canvas.clientHeight);
    var pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    var targetWidth = Math.floor(width * pixelRatio);
    var targetHeight = Math.floor(height * pixelRatio);
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  render() {
    this._resize();
    this.renderer.render(this.scene, this.camera);
  }

  metrics() {
    return {
      renderer: 'three-r160-webgl',
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      nodes: this.nodes.size,
      viewport: { width: this.canvas.clientWidth, height: this.canvas.clientHeight }
    };
  }

  destroy() {
    window.removeEventListener('resize', this._boundRender);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.nodes.forEach(record => { record.mesh.geometry.dispose(); record.mesh.material.dispose(); });
    this.renderer.dispose();
  }
}
