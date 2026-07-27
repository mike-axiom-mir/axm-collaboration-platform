(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('./core') : root.AXMHolodeckCore;
  var Normalizer = typeof module !== 'undefined' && module.exports ? require('./world-normalizer') : root.AXMHolodeckWorldNormalizer;
  var api = factory(Core, Normalizer);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckWorldCompiler = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core, Normalizer) {
  'use strict';

  var PLAN_SCHEMA = 'axm.holodeck-deck-plan/v1';

  function compile(world) {
    var normalized = Normalizer.normalize(world);
    var nodes = normalized.entities.map(function (entity) {
      return {
        id: entity.id,
        parentId: entity.parentId,
        kind: entity.kind,
        name: entity.name,
        description: entity.description,
        canonicalTransform: Core.clone(entity.transform),
        render: Core.clone(entity.appearance),
        collider: Core.clone(entity.collider),
        initialState: Core.clone(entity.initialState),
        sensorTags: entity.sensorTags.slice()
      };
    });
    var interactions = [];
    normalized.entities.forEach(function (entity) {
      entity.actions.forEach(function (action) {
        interactions.push({
          id: action.qualifiedId,
          entityId: entity.id,
          actionId: action.id,
          label: action.label,
          rangeMeters: action.rangeMeters,
          availableWhen: Core.clone(action.availableWhen || null),
          effects: Core.clone(action.effects)
        });
      });
    });
    interactions.sort(function (left, right) { return left.id.localeCompare(right.id); });
    var plan = {
      schema: PLAN_SCHEMA,
      version: '0.1.0',
      worldId: normalized.id,
      worldTitle: normalized.title,
      worldDescription: normalized.description,
      worldDigest: normalized.worldDigest,
      worldDigestAlgorithm: normalized.worldDigestAlgorithm,
      coordinateProjection: {
        schema: 'axm.holodeck-local-projection/v1',
        canonical: Core.clone(normalized.coordinateSystem),
        renderUnitsPerMeter: 1,
        note: 'Renderer coordinates are a disposable projection and never become canonical state.'
      },
      environment: Core.clone(normalized.environment),
      nodes: nodes,
      interactions: interactions,
      spawnPoints: Core.clone(normalized.spawnPoints),
      sensor: Core.clone(normalized.sensor),
      narrative: Core.clone(normalized.narrative),
      actorKinds: normalized.defaultActorKinds.slice(),
      boundaries: normalized.boundaries.slice(),
      adapterContract: 'axm.holodeck-render-adapter/v1',
      truth: {
        substrateIndependentPlan: true,
        screenAdapterImplemented: false,
        vrAdapterImplemented: false,
        hologramHardwareImplemented: false,
        physicalWorldManipulatorImplemented: false
      }
    };
    plan.planDigestAlgorithm = Core.HASH_ALGORITHM;
    plan.planDigest = Core.digest(plan);
    return plan;
  }

  return { PLAN_SCHEMA: PLAN_SCHEMA, compile: compile };
});
