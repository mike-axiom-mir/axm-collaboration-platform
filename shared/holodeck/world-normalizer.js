(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('./core') : root.AXMHolodeckCore;
  var Validator = typeof module !== 'undefined' && module.exports ? require('./world-validator') : root.AXMHolodeckWorldValidator;
  var api = factory(Core, Validator);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckWorldNormalizer = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core, Validator) {
  'use strict';

  function uniqueSorted(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).map(function (value) { return Core.text(value, 160); }).filter(Boolean))).sort();
  }

  function normalizeState(state) {
    return Core.stableValue(state && typeof state === 'object' && !Array.isArray(state) ? state : {});
  }

  function normalizeLight(light) {
    return {
      id: light.id,
      kind: light.kind,
      color: light.color.toLowerCase(),
      intensity: Core.round(Core.clamp(light.intensity, 0, 20, light.kind === 'ambient' ? 0.65 : 1.2), 4),
      position: Core.vec3(light.position || [0, 6, 0])
    };
  }

  function normalizeVariant(variant) {
    var set = variant.set || {};
    var normalizedSet = {};
    if (set.color != null) normalizedSet.color = set.color.toLowerCase();
    if (set.emissive != null) normalizedSet.emissive = set.emissive.toLowerCase();
    if (set.emissiveIntensity != null) normalizedSet.emissiveIntensity = Core.round(Core.clamp(set.emissiveIntensity, 0, 20, 0), 4);
    if (set.opacity != null) normalizedSet.opacity = Core.round(Core.clamp(set.opacity, 0, 1, 1), 4);
    if (set.visible != null) normalizedSet.visible = set.visible !== false;
    if (set.positionOffset != null) normalizedSet.positionOffset = Core.vec3(set.positionOffset);
    if (set.rotationOffset != null) normalizedSet.rotationOffset = Core.vec3(set.rotationOffset);
    return {
      when: { key: variant.when.key, equals: Core.clone(variant.when.equals) },
      set: normalizedSet
    };
  }

  function normalizeEffect(effect) {
    if (effect.type === 'message') return { type: 'message', text: Core.text(effect.text || effect.value, 500) };
    var normalized = {
      type: effect.type,
      targetEntityId: effect.targetEntityId,
      key: effect.key
    };
    if (effect.type === 'set-state') normalized.value = Core.clone(effect.value);
    if (effect.type === 'increment-state') normalized.delta = Core.round(Core.clamp(effect.delta, -1000000, 1000000, 1), 6);
    return normalized;
  }

  function normalizeAction(entityId, action) {
    var normalized = {
      id: action.id,
      qualifiedId: entityId + ':' + action.id,
      label: Core.text(action.label, 160),
      rangeMeters: Core.round(Core.clamp(action.rangeMeters, 0.1, 20, 2), 4),
      effects: action.effects.map(normalizeEffect)
    };
    if (action.availableWhen) normalized.availableWhen = {
      entityId: action.availableWhen.entityId || entityId,
      key: action.availableWhen.key,
      equals: Core.clone(action.availableWhen.equals)
    };
    return normalized;
  }

  function normalizeEntity(entity) {
    var appearance = entity.appearance;
    var variants = (Array.isArray(appearance.variants) ? appearance.variants : []).map(normalizeVariant);
    variants.sort(function (left, right) { return Core.stableStringify(left).localeCompare(Core.stableStringify(right)); });
    var normalized = {
      id: entity.id,
      kind: entity.kind,
      name: Core.text(entity.name, 160),
      description: Core.text(entity.description, 1000),
      parentId: Core.text(entity.parentId, 120) || null,
      transform: {
        position: Core.vec3(entity.transform.position),
        rotation: Core.vec3(entity.transform.rotation || [0, 0, 0]),
        scale: Core.vec3(entity.transform.scale || [1, 1, 1])
      },
      appearance: {
        primitive: appearance.primitive,
        color: appearance.color.toLowerCase(),
        emissive: (appearance.emissive || '#000000').toLowerCase(),
        emissiveIntensity: Core.round(Core.clamp(appearance.emissiveIntensity, 0, 20, 0), 4),
        opacity: Core.round(Core.clamp(appearance.opacity, 0, 1, 1), 4),
        roughness: Core.round(Core.clamp(appearance.roughness, 0, 1, 0.72), 4),
        metalness: Core.round(Core.clamp(appearance.metalness, 0, 1, 0.08), 4),
        variants: variants
      },
      initialState: normalizeState(entity.state),
      sensorTags: uniqueSorted(entity.sensorTags)
    };
    if (entity.collider) {
      normalized.collider = {
        shape: entity.collider.shape,
        solid: entity.collider.solid !== false
      };
      if (entity.collider.shape === 'box') normalized.collider.size = [Core.round(entity.collider.size[0]), Core.round(entity.collider.size[1])];
      if (entity.collider.shape === 'circle') normalized.collider.radius = Core.round(entity.collider.radius);
      if (entity.collider.disabledWhen) normalized.collider.disabledWhen = {
        key: entity.collider.disabledWhen.key,
        equals: Core.clone(entity.collider.disabledWhen.equals)
      };
    } else normalized.collider = null;
    var actions = entity.interaction && Array.isArray(entity.interaction.actions) ? entity.interaction.actions.map(function (action) { return normalizeAction(entity.id, action); }) : [];
    normalized.actions = actions.sort(function (left, right) { return left.id.localeCompare(right.id); });
    return normalized;
  }

  function normalize(input) {
    var validation = Validator.validate(input);
    Core.assert(validation.ok, 'invalid Holodeck world: ' + validation.errors.join('; '));
    var environment = input.environment || {};
    var normalized = {
      schema: Validator.SCHEMA,
      version: Core.text(input.version, 40) || '1.0.0',
      id: input.id,
      title: Core.text(input.title, 160),
      description: Core.text(input.description, 2000),
      coordinateSystem: {
        type: 'cartesian-local',
        units: 'meters',
        handedness: 'right',
        axes: { x: 'east', y: 'up', z: 'south', headingZero: 'north-negative-z' }
      },
      environment: {
        bounds: {
          minX: Core.round(environment.bounds.minX),
          maxX: Core.round(environment.bounds.maxX),
          minZ: Core.round(environment.bounds.minZ),
          maxZ: Core.round(environment.bounds.maxZ)
        },
        groundY: Core.round(Core.clamp(environment.groundY, -10000, 10000, 0)),
        skyColor: (environment.skyColor || '#07111f').toLowerCase(),
        groundColor: (environment.groundColor || '#111827').toLowerCase(),
        fogColor: (environment.fogColor || environment.skyColor || '#07111f').toLowerCase(),
        fogNear: Core.round(Core.clamp(environment.fogNear, 0, 10000, 16), 4),
        fogFar: Core.round(Core.clamp(environment.fogFar, 1, 20000, 70), 4),
        gravityMetersPerSecondSquared: Core.round(Core.clamp(environment.gravityMetersPerSecondSquared, 0, 100, 9.81), 4),
        lights: (Array.isArray(environment.lights) ? environment.lights : []).map(normalizeLight).sort(function (left, right) { return left.id.localeCompare(right.id); })
      },
      entities: input.entities.map(normalizeEntity).sort(function (left, right) { return left.id.localeCompare(right.id); }),
      spawnPoints: input.spawnPoints.map(function (spawn) {
        return {
          id: spawn.id,
          name: Core.text(spawn.name, 160) || spawn.id,
          position: Core.vec3(spawn.position),
          headingDegrees: Core.angle(spawn.headingDegrees)
        };
      }).sort(function (left, right) { return left.id.localeCompare(right.id); }),
      sensor: {
        radiusMeters: Core.round(Core.clamp(input.sensor && input.sensor.radiusMeters, 1, 1000, 14), 4),
        maxEntities: Math.round(Core.clamp(input.sensor && input.sensor.maxEntities, 1, 256, 24))
      },
      narrative: {
        premise: Core.text(input.narrative && input.narrative.premise, 2000),
        objective: Core.text(input.narrative && input.narrative.objective, 1000),
        completion: input.narrative && input.narrative.completion ? Core.clone(input.narrative.completion) : null
      },
      defaultActorKinds: uniqueSorted(input.defaultActorKinds || ['human', 'machine']),
      boundaries: uniqueSorted(input.boundaries)
    };
    normalized.worldDigestAlgorithm = Core.HASH_ALGORITHM;
    normalized.worldDigest = Core.digest(normalized);
    return normalized;
  }

  return { normalize: normalize };
});
