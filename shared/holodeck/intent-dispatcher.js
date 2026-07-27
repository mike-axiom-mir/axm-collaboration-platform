(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('./core') : root.AXMHolodeckCore;
  var State = typeof module !== 'undefined' && module.exports ? require('./state-machine') : root.AXMHolodeckStateMachine;
  var api = factory(Core, State);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckIntentDispatcher = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core, State) {
  'use strict';

  var INTENT_SCHEMA = 'axm.holodeck-intent/v1';
  var KINDS = ['MOVE', 'TURN', 'INTERACT'];
  var ACTORS = ['human', 'machine', 'service'];

  function normalizeIntent(input) {
    input = input || {};
    Core.assert(input.schema === INTENT_SCHEMA, 'unsupported Holodeck intent schema');
    Core.assert(input.actor && Core.validId(input.actor.id), 'intent actor needs a stable id');
    Core.assert(ACTORS.indexOf(input.actor.kind) >= 0, 'intent actor kind is unsupported');
    Core.assert(Number.isInteger(input.sequence) && input.sequence > 0, 'intent sequence must be a positive integer');
    Core.assert(KINDS.indexOf(input.kind) >= 0, 'intent kind is unsupported');
    var intent = {
      schema: INTENT_SCHEMA,
      actor: {
        id: input.actor.id,
        kind: input.actor.kind,
        name: Core.text(input.actor.name, 120) || input.actor.id
      },
      sequence: input.sequence,
      kind: input.kind,
      payload: Core.stableValue(input.payload || {})
    };
    intent.id = 'intent-' + Core.digest(intent).slice(0, 16);
    return intent;
  }

  function move(plan, state, intent) {
    var payload = intent.payload || {};
    var forward = Core.clamp(payload.forward, -1, 1, 0);
    var strafe = Core.clamp(payload.strafe, -1, 1, 0);
    var magnitude = Math.sqrt(forward * forward + strafe * strafe);
    if (magnitude > 1) { forward /= magnitude; strafe /= magnitude; }
    var meters = Core.clamp(payload.meters, 0.05, 1.5, 0.8);
    var heading = state.player.headingDegrees * Math.PI / 180;
    var dx = Math.sin(heading) * forward + Math.cos(heading) * strafe;
    var dz = -Math.cos(heading) * forward + Math.sin(heading) * strafe;
    var next = Core.clone(state);
    var bounds = plan.environment.bounds, radius = state.player.radiusMeters || 0.34;
    var candidate = [
      Core.round(Core.clamp(state.player.position[0] + dx * meters, bounds.minX + radius, bounds.maxX - radius, state.player.position[0]), 6),
      state.player.position[1],
      Core.round(Core.clamp(state.player.position[2] + dz * meters, bounds.minZ + radius, bounds.maxZ - radius, state.player.position[2]), 6)
    ];
    var collision = State.collides(plan, state, candidate);
    if (collision) return State.commit(plan, state, intent, state, { status: 'REFUSED_COLLISION', detail: { entityId: collision, position: candidate } });
    next.player.position = candidate;
    return State.commit(plan, state, intent, next, { status: 'APPLIED', detail: { position: candidate, meters: Core.round(Core.distance2d(state.player.position, candidate), 6) } });
  }

  function turn(plan, state, intent) {
    var degrees = Core.clamp(intent.payload && intent.payload.degrees, -45, 45, 0);
    var next = Core.clone(state);
    next.player.headingDegrees = Core.angle(state.player.headingDegrees + degrees);
    return State.commit(plan, state, intent, next, { status: 'APPLIED', detail: { headingDegrees: next.player.headingDegrees } });
  }

  function applyEffect(next, effect) {
    if (effect.type === 'message') {
      next.lastMessage = effect.text;
      return;
    }
    var target = next.entities[effect.targetEntityId];
    Core.assert(target && typeof target === 'object', 'interaction target state is missing: ' + effect.targetEntityId);
    if (effect.type === 'set-state') target[effect.key] = Core.clone(effect.value);
    if (effect.type === 'toggle-state') target[effect.key] = !target[effect.key];
    if (effect.type === 'increment-state') target[effect.key] = Core.round((Number(target[effect.key]) || 0) + effect.delta, 6);
  }

  function interact(plan, state, intent) {
    var payload = intent.payload || {};
    var inRange = plan.interactions.map(function (interaction) {
      var node = plan.nodes.find(function (item) { return item.id === interaction.entityId; });
      return { interaction: interaction, node: node, distance: node ? Core.distance2d(state.player.position, node.canonicalTransform.position) : Infinity };
    }).filter(function (candidate) {
      if (!candidate.node || candidate.distance > candidate.interaction.rangeMeters) return false;
      if (payload.entityId && candidate.interaction.entityId !== payload.entityId) return false;
      if (payload.actionId && candidate.interaction.actionId !== payload.actionId && candidate.interaction.id !== payload.actionId) return false;
      return true;
    }).sort(function (left, right) { return left.distance - right.distance || left.interaction.id.localeCompare(right.interaction.id); });
    if (!inRange.length) return State.commit(plan, state, intent, state, { status: 'REFUSED_RANGE', detail: { reason: 'no requested interaction is within range' } });
    var candidates = inRange.filter(function (candidate) { return State.actionAvailable(state, candidate.interaction); });
    if (!candidates.length) return State.commit(plan, state, intent, state, { status: 'REFUSED_STATE', detail: { reason: 'requested interaction is not available in current state' } });
    var selected = candidates[0], next = Core.clone(state);
    selected.interaction.effects.forEach(function (effect) { applyEffect(next, effect); });
    return State.commit(plan, state, intent, next, {
      status: 'APPLIED',
      detail: {
        interactionId: selected.interaction.id,
        entityId: selected.interaction.entityId,
        distanceMeters: selected.distance,
        label: selected.interaction.label
      }
    });
  }

  function dispatch(plan, state, rawIntent) {
    var intent = normalizeIntent(rawIntent);
    var valid = State.verify(plan, state);
    Core.assert(valid.ok, 'invalid Holodeck state: ' + valid.errors.join('; '));
    var prior = Number(state.actorSequences && state.actorSequences[intent.actor.id]) || 0;
    if (intent.sequence <= prior) return State.refused(state, intent, 'REFUSED_REPLAY', { previousSequence: prior });
    if (intent.kind === 'MOVE') return move(plan, state, intent);
    if (intent.kind === 'TURN') return turn(plan, state, intent);
    return interact(plan, state, intent);
  }

  return { INTENT_SCHEMA: INTENT_SCHEMA, KINDS: KINDS, normalizeIntent: normalizeIntent, dispatch: dispatch };
});
