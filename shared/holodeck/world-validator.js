(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('./core') : root.AXMHolodeckCore;
  var api = factory(Core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckWorldValidator = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core) {
  'use strict';

  var SCHEMA = 'axm.holodeck-world/v1';
  var ENTITY_KINDS = ['structure', 'prop', 'actor', 'light', 'portal', 'landmark'];
  var PRIMITIVES = ['box', 'sphere', 'cylinder', 'cone', 'plane', 'ring'];
  var EFFECTS = ['set-state', 'toggle-state', 'increment-state', 'message'];
  var ACTOR_KINDS = ['human', 'machine', 'service'];

  function push(errors, condition, message) {
    if (!condition) errors.push(message);
  }

  function validVec3(value, positive) {
    return Array.isArray(value) && value.length === 3 && value.every(function (number) {
      return Core.finite(number) && (!positive || number > 0);
    });
  }

  function validColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  }

  function validate(world) {
    var errors = [], warnings = [];
    push(errors, !!world && typeof world === 'object' && !Array.isArray(world), 'world must be an object');
    if (!world || typeof world !== 'object' || Array.isArray(world)) return { ok: false, errors: errors, warnings: warnings };
    push(errors, world.schema === SCHEMA, 'unsupported world schema');
    push(errors, Core.validId(world.id), 'world id must be a stable lowercase identifier');
    push(errors, Core.text(world.title, 161).length > 0, 'world title is required');
    push(errors, world.coordinateSystem && world.coordinateSystem.type === 'cartesian-local', 'coordinate system must be cartesian-local');
    push(errors, world.coordinateSystem && world.coordinateSystem.units === 'meters', 'coordinate units must be meters');
    push(errors, world.coordinateSystem && world.coordinateSystem.handedness === 'right', 'coordinate system must be right handed');

    var environment = world.environment || {};
    var bounds = environment.bounds;
    push(errors, bounds && ['minX', 'maxX', 'minZ', 'maxZ'].every(function (key) { return Core.finite(bounds[key]); }), 'environment bounds require finite minX, maxX, minZ, maxZ');
    if (bounds && ['minX', 'maxX', 'minZ', 'maxZ'].every(function (key) { return Core.finite(bounds[key]); })) {
      push(errors, bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ, 'environment bounds must have positive area');
      push(errors, bounds.maxX - bounds.minX <= 10000 && bounds.maxZ - bounds.minZ <= 10000, 'v0 environment bounds cannot exceed 10 km per axis');
    }
    if (environment.skyColor != null) push(errors, validColor(environment.skyColor), 'environment skyColor must be a six-digit hex color');
    if (environment.groundColor != null) push(errors, validColor(environment.groundColor), 'environment groundColor must be a six-digit hex color');
    if (environment.lights != null) {
      push(errors, Array.isArray(environment.lights), 'environment lights must be an array');
      (Array.isArray(environment.lights) ? environment.lights : []).forEach(function (light, index) {
        push(errors, Core.validId(light.id), 'light ' + index + ' needs a stable id');
        push(errors, ['ambient', 'directional', 'point'].indexOf(light.kind) >= 0, 'light ' + (light.id || index) + ' has unsupported kind');
        push(errors, validColor(light.color), 'light ' + (light.id || index) + ' needs a hex color');
        if (light.position != null) push(errors, validVec3(light.position, false), 'light ' + (light.id || index) + ' position must be vec3');
      });
    }

    push(errors, Array.isArray(world.entities), 'entities must be an array');
    var entities = Array.isArray(world.entities) ? world.entities : [];
    push(errors, entities.length > 0, 'world needs at least one entity');
    push(errors, entities.length <= 256, 'v0 world cannot exceed 256 entities');
    var entityIds = new Set(), actionIds = new Set(), effectTargets = [], conditionTargets = [];
    entities.forEach(function (entity, index) {
      var label = entity && entity.id || String(index);
      push(errors, !!entity && typeof entity === 'object', 'entity ' + index + ' must be an object');
      if (!entity || typeof entity !== 'object') return;
      push(errors, Core.validId(entity.id), 'entity ' + index + ' needs a stable id');
      if (entityIds.has(entity.id)) errors.push('duplicate entity id: ' + entity.id);
      entityIds.add(entity.id);
      push(errors, ENTITY_KINDS.indexOf(entity.kind) >= 0, 'entity ' + label + ' has unsupported kind');
      push(errors, Core.text(entity.name, 161).length > 0, 'entity ' + label + ' needs a name');
      var transform = entity.transform || {};
      push(errors, validVec3(transform.position, false), 'entity ' + label + ' position must be vec3');
      if (transform.rotation != null) push(errors, validVec3(transform.rotation, false), 'entity ' + label + ' rotation must be vec3');
      if (transform.scale != null) push(errors, validVec3(transform.scale, true), 'entity ' + label + ' scale must be positive vec3');
      var appearance = entity.appearance || {};
      push(errors, PRIMITIVES.indexOf(appearance.primitive) >= 0, 'entity ' + label + ' needs a supported primitive');
      push(errors, validColor(appearance.color), 'entity ' + label + ' needs a six-digit hex color');
      if (appearance.emissive != null) push(errors, validColor(appearance.emissive), 'entity ' + label + ' emissive must be a hex color');
      if (appearance.opacity != null) push(errors, Core.finite(appearance.opacity) && appearance.opacity >= 0 && appearance.opacity <= 1, 'entity ' + label + ' opacity must be 0..1');
      (Array.isArray(appearance.variants) ? appearance.variants : []).forEach(function (variant, variantIndex) {
        push(errors, variant && variant.when && Core.validId(variant.when.key), 'entity ' + label + ' variant ' + variantIndex + ' needs a state key');
        if (variant && variant.set && variant.set.color != null) push(errors, validColor(variant.set.color), 'entity ' + label + ' variant color must be hex');
        if (variant && variant.set && variant.set.emissive != null) push(errors, validColor(variant.set.emissive), 'entity ' + label + ' variant emissive must be hex');
        if (variant && variant.set && variant.set.positionOffset != null) push(errors, validVec3(variant.set.positionOffset, false), 'entity ' + label + ' variant positionOffset must be vec3');
      });
      if (entity.collider != null) {
        push(errors, ['box', 'circle'].indexOf(entity.collider.shape) >= 0, 'entity ' + label + ' collider shape is unsupported');
        if (entity.collider.shape === 'box') push(errors, Array.isArray(entity.collider.size) && entity.collider.size.length === 2 && entity.collider.size.every(function (number) { return Core.finite(number) && number > 0; }), 'entity ' + label + ' box collider needs positive [width, depth]');
        if (entity.collider.shape === 'circle') push(errors, Core.finite(entity.collider.radius) && entity.collider.radius > 0, 'entity ' + label + ' circle collider needs a positive radius');
        if (entity.collider.disabledWhen != null) push(errors, Core.validId(entity.collider.disabledWhen.key), 'entity ' + label + ' collider disabledWhen needs a state key');
      }
      var actions = entity.interaction && entity.interaction.actions;
      if (actions != null) push(errors, Array.isArray(actions), 'entity ' + label + ' interaction actions must be an array');
      (Array.isArray(actions) ? actions : []).forEach(function (action, actionIndex) {
        var qualified = entity.id + ':' + (action && action.id);
        push(errors, action && Core.validId(action.id), 'entity ' + label + ' action ' + actionIndex + ' needs a stable id');
        if (actionIds.has(qualified)) errors.push('duplicate action id: ' + qualified);
        actionIds.add(qualified);
        push(errors, Core.text(action && action.label, 161).length > 0, 'action ' + qualified + ' needs a label');
        push(errors, Core.finite(action && action.rangeMeters) && action.rangeMeters > 0 && action.rangeMeters <= 20, 'action ' + qualified + ' range must be within 0..20 meters');
        if (action && action.availableWhen != null) {
          push(errors, !!action.availableWhen && typeof action.availableWhen === 'object' && !Array.isArray(action.availableWhen), 'action ' + qualified + ' availableWhen must be an object');
          push(errors, Core.validId(action.availableWhen && action.availableWhen.key), 'action ' + qualified + ' availableWhen needs a state key');
          if (action.availableWhen && action.availableWhen.entityId != null) push(errors, Core.validId(action.availableWhen.entityId), 'action ' + qualified + ' availableWhen entityId is invalid');
          conditionTargets.push({ action: qualified, target: action.availableWhen && action.availableWhen.entityId || entity.id });
        }
        push(errors, Array.isArray(action && action.effects) && action.effects.length > 0, 'action ' + qualified + ' needs at least one effect');
        (Array.isArray(action && action.effects) ? action.effects : []).forEach(function (effect, effectIndex) {
          push(errors, effect && EFFECTS.indexOf(effect.type) >= 0, 'action ' + qualified + ' effect ' + effectIndex + ' is unsupported');
          if (!effect || effect.type === 'message') return;
          push(errors, Core.validId(effect.targetEntityId), 'action ' + qualified + ' effect ' + effectIndex + ' needs targetEntityId');
          push(errors, Core.validId(effect.key), 'action ' + qualified + ' effect ' + effectIndex + ' needs a state key');
          effectTargets.push({ action: qualified, target: effect.targetEntityId });
        });
      });
    });
    effectTargets.forEach(function (item) {
      if (!entityIds.has(item.target)) errors.push('action ' + item.action + ' targets missing entity: ' + item.target);
    });
    conditionTargets.forEach(function (item) {
      if (!entityIds.has(item.target)) errors.push('action ' + item.action + ' condition targets missing entity: ' + item.target);
    });

    push(errors, Array.isArray(world.spawnPoints) && world.spawnPoints.length > 0, 'world needs at least one spawn point');
    var spawnIds = new Set();
    (Array.isArray(world.spawnPoints) ? world.spawnPoints : []).forEach(function (spawn, index) {
      push(errors, Core.validId(spawn && spawn.id), 'spawn point ' + index + ' needs a stable id');
      if (spawnIds.has(spawn && spawn.id)) errors.push('duplicate spawn point id: ' + spawn.id);
      spawnIds.add(spawn && spawn.id);
      push(errors, validVec3(spawn && spawn.position, false), 'spawn point ' + (spawn && spawn.id || index) + ' position must be vec3');
      push(errors, Core.finite(spawn && spawn.headingDegrees), 'spawn point ' + (spawn && spawn.id || index) + ' heading must be finite');
    });

    if (!world.narrative || !Core.text(world.narrative.objective, 1001)) warnings.push('world has no player-facing objective');
    if (!world.boundaries || !Array.isArray(world.boundaries)) warnings.push('world declares no explicit truth boundaries');
    if (world.defaultActorKinds != null) {
      push(errors, Array.isArray(world.defaultActorKinds) && world.defaultActorKinds.every(function (kind) { return ACTOR_KINDS.indexOf(kind) >= 0; }), 'defaultActorKinds contains an unsupported actor kind');
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      summary: {
        entities: entities.length,
        actions: actionIds.size,
        spawnPoints: spawnIds.size
      }
    };
  }

  return {
    SCHEMA: SCHEMA,
    ENTITY_KINDS: ENTITY_KINDS,
    PRIMITIVES: PRIMITIVES,
    EFFECTS: EFFECTS,
    validate: validate
  };
});
