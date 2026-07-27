(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('../../shared/holodeck/core') : root.AXMHolodeckCore;
  var api = factory(Core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckObserverCamera = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core) {
  'use strict';

  var COMMANDS = Object.freeze(['orbit-left', 'orbit-right', 'rise', 'lower', 'zoom-in', 'zoom-out']);
  var PRESETS = Object.freeze(['orbit', 'overhead', 'beacon', 'gate']);

  function radians(degrees) { return degrees * Math.PI / 180; }

  function nodeById(plan, id) {
    return plan.nodes.find(function (node) { return node.id === id; }) || null;
  }

  function objectiveNode(plan) {
    var interaction = plan.interactions && plan.interactions[0];
    return interaction ? nodeById(plan, interaction.entityId) : null;
  }

  function targetFor(plan, name) {
    var node = null;
    if (name === 'gate') node = nodeById(plan, 'north-gate') || plan.nodes.find(function (item) { return item.kind === 'portal'; });
    if (name === 'beacon' || name === 'orbit' || name === 'overhead') node = objectiveNode(plan);
    node = node || plan.nodes[0];
    return node ? Core.clone(node.canonicalTransform.position) : [0, 1.5, 0];
  }

  function presetView(plan, name) {
    Core.assert(PRESETS.indexOf(name) >= 0, 'unsupported observer preset: ' + name);
    if (name === 'overhead') return { preset: name, target: targetFor(plan, name), yawDegrees: 0, pitchDegrees: 78, distanceMeters: 18 };
    if (name === 'gate') return { preset: name, target: targetFor(plan, name), yawDegrees: 0, pitchDegrees: 18, distanceMeters: 11 };
    if (name === 'beacon') return { preset: name, target: targetFor(plan, name), yawDegrees: 28, pitchDegrees: 12, distanceMeters: 7 };
    return { preset: name, target: targetFor(plan, name), yawDegrees: 36, pitchDegrees: 20, distanceMeters: 15 };
  }

  function ObserverCamera(renderer, plan) {
    Core.assert(renderer && renderer.camera && typeof renderer.render === 'function', 'observer camera requires a render adapter');
    Core.assert(plan && Array.isArray(plan.nodes), 'observer camera requires a compiled deck plan');
    this.renderer = renderer;
    this.plan = plan;
    this.mode = 'player';
    this.view = presetView(plan, 'orbit');
  }

  ObserverCamera.prototype._apply = function () {
    var yaw = radians(this.view.yawDegrees);
    var pitch = radians(this.view.pitchDegrees);
    var horizontal = Math.cos(pitch) * this.view.distanceMeters;
    var target = this.view.target;
    var position = [
      Core.round(target[0] + Math.sin(yaw) * horizontal, 6),
      Core.round(target[1] + Math.sin(pitch) * this.view.distanceMeters, 6),
      Core.round(target[2] + Math.cos(yaw) * horizontal, 6)
    ];
    this.renderer.camera.position.set(position[0], position[1], position[2]);
    this.renderer.camera.lookAt(target[0], target[1], target[2]);
    this.renderer.render();
    return position;
  };

  ObserverCamera.prototype._receipt = function (action, revision, position) {
    var receipt = {
      schema: 'axm.holodeck-camera-receipt/v1',
      mode: this.mode,
      action: action,
      stateRevisionBefore: revision,
      stateRevisionAfter: revision,
      worldMutation: false,
      position: Core.clone(position),
      view: this.getView()
    };
    receipt.receiptDigest = Core.digest(receipt);
    return receipt;
  };

  ObserverCamera.prototype.activate = function (preset, revision) {
    this.mode = 'observer';
    this.view = presetView(this.plan, preset || 'orbit');
    return this._receipt('activate:' + this.view.preset, revision, this._apply());
  };

  ObserverCamera.prototype.deactivate = function (state) {
    Core.assert(state && Number.isInteger(state.revision), 'player state required when leaving observer mode');
    this.mode = 'player';
    this.renderer.sync(state);
    return this._receipt('deactivate', state.revision, Core.clone(state.player.position));
  };

  ObserverCamera.prototype.setPreset = function (name, revision) {
    Core.assert(this.mode === 'observer', 'observer preset requires observer mode');
    this.view = presetView(this.plan, name);
    return this._receipt('preset:' + name, revision, this._apply());
  };

  ObserverCamera.prototype.command = function (command, revision) {
    Core.assert(this.mode === 'observer', 'camera command requires observer mode');
    Core.assert(COMMANDS.indexOf(command) >= 0, 'unsupported observer command: ' + command);
    if (command === 'orbit-left') this.view.yawDegrees = Core.angle(this.view.yawDegrees - 15);
    if (command === 'orbit-right') this.view.yawDegrees = Core.angle(this.view.yawDegrees + 15);
    if (command === 'rise') this.view.pitchDegrees = Core.round(Core.clamp(this.view.pitchDegrees + 10, 5, 82, 20), 4);
    if (command === 'lower') this.view.pitchDegrees = Core.round(Core.clamp(this.view.pitchDegrees - 10, 5, 82, 20), 4);
    if (command === 'zoom-in') this.view.distanceMeters = Core.round(Core.clamp(this.view.distanceMeters - 2, 4, 60, 15), 4);
    if (command === 'zoom-out') this.view.distanceMeters = Core.round(Core.clamp(this.view.distanceMeters + 2, 4, 60, 15), 4);
    this.view.preset = 'custom';
    return this._receipt('command:' + command, revision, this._apply());
  };

  ObserverCamera.prototype.getView = function () { return Core.clone(this.view); };
  ObserverCamera.prototype.getTruth = function () {
    return Object.freeze({ mode: this.mode, cameraOnly: this.mode === 'observer', worldMutation: false, intentDispatch: false });
  };

  return { ObserverCamera: ObserverCamera, COMMANDS: COMMANDS, PRESETS: PRESETS, presetView: presetView };
});
