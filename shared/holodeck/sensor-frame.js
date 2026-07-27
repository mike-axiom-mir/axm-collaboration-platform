(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('./core') : root.AXMHolodeckCore;
  var State = typeof module !== 'undefined' && module.exports ? require('./state-machine') : root.AXMHolodeckStateMachine;
  var api = factory(Core, State);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckSensorFrame = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core, State) {
  'use strict';

  var SENSOR_SCHEMA = 'axm.holodeck-sensor-frame/v1';

  function relativeBearing(player, target) {
    var dx = target[0] - player.position[0];
    var dz = target[2] - player.position[2];
    var absolute = Core.angle(Math.atan2(dx, -dz) * 180 / Math.PI);
    var relative = absolute - player.headingDegrees;
    while (relative > 180) relative -= 360;
    while (relative <= -180) relative += 360;
    return Core.round(relative, 4);
  }

  function completion(plan, state) {
    var rule = plan.narrative && plan.narrative.completion;
    if (!rule || !rule.entityId || !rule.key) return { complete: false, rule: null };
    var entity = State.entityState(state, rule.entityId);
    return {
      complete: entity[rule.key] === rule.equals,
      rule: { entityId: rule.entityId, key: rule.key, equals: Core.clone(rule.equals) },
      message: Core.text(rule.message, 500)
    };
  }

  function observe(plan, state, actor) {
    var valid = State.verify(plan, state);
    Core.assert(valid.ok, 'cannot observe invalid Holodeck state: ' + valid.errors.join('; '));
    actor = actor || { id: 'observer', kind: 'machine', name: 'Observer' };
    Core.assert(Core.validId(actor.id), 'sensor actor needs a stable id');
    Core.assert(['human', 'machine', 'service'].indexOf(actor.kind) >= 0, 'sensor actor kind is unsupported');
    var nearby = plan.nodes.map(function (node) {
      var distance = Core.distance2d(state.player.position, node.canonicalTransform.position);
      var actions = plan.interactions.filter(function (interaction) {
        return interaction.entityId === node.id && distance <= interaction.rangeMeters && State.actionAvailable(state, interaction);
      }).map(function (interaction) {
        return { id: interaction.id, actionId: interaction.actionId, label: interaction.label, rangeMeters: interaction.rangeMeters };
      });
      return {
        entityId: node.id,
        name: node.name,
        kind: node.kind,
        description: node.description,
        distanceMeters: distance,
        relativeBearingDegrees: relativeBearing(state.player, node.canonicalTransform.position),
        state: Core.stableValue(State.entityState(state, node.id)),
        sensorTags: node.sensorTags.slice(),
        availableActions: actions
      };
    }).filter(function (item) {
      return item.distanceMeters <= plan.sensor.radiusMeters;
    }).sort(function (left, right) {
      return left.distanceMeters - right.distanceMeters || left.entityId.localeCompare(right.entityId);
    }).slice(0, plan.sensor.maxEntities);
    var frame = {
      schema: SENSOR_SCHEMA,
      version: '0.1.0',
      worldId: plan.worldId,
      worldDigest: plan.worldDigest,
      stateDigest: state.stateDigest,
      revision: state.revision,
      tick: state.tick,
      observer: { id: actor.id, kind: actor.kind, name: Core.text(actor.name, 120) || actor.id },
      embodiment: {
        position: Core.clone(state.player.position),
        headingDegrees: state.player.headingDegrees,
        spawnPointId: state.player.spawnPointId
      },
      nearby: nearby,
      objective: {
        text: plan.narrative.objective,
        status: completion(plan, state)
      },
      message: state.lastMessage,
      truth: {
        source: 'structured-world-state',
        cameraPixelsObserved: false,
        visualOcclusionResolved: false,
        proximityIsNotVision: true,
        actorKindsShareObservationShape: true
      }
    };
    frame.frameDigestAlgorithm = Core.HASH_ALGORITHM;
    frame.frameDigest = Core.digest(frame);
    return frame;
  }

  return { SENSOR_SCHEMA: SENSOR_SCHEMA, observe: observe };
});
