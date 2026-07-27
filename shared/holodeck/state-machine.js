(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('./core') : root.AXMHolodeckCore;
  var Compiler = typeof module !== 'undefined' && module.exports ? require('./world-compiler') : root.AXMHolodeckWorldCompiler;
  var api = factory(Core, Compiler);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckStateMachine = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core, Compiler) {
  'use strict';

  var STATE_SCHEMA = 'axm.holodeck-state/v1';

  function seal(state) {
    var next = Core.clone(state);
    delete next.stateDigest;
    next.stateDigestAlgorithm = Core.HASH_ALGORITHM;
    next.stateDigest = Core.digest(next);
    return next;
  }

  function verify(plan, state) {
    var errors = [];
    if (!state || state.schema !== STATE_SCHEMA) errors.push('unsupported Holodeck state schema');
    if (!plan || plan.schema !== Compiler.PLAN_SCHEMA) errors.push('valid deck plan required');
    if (state && plan && state.worldId !== plan.worldId) errors.push('state belongs to another world');
    if (state && plan && state.worldDigest !== plan.worldDigest) errors.push('state belongs to another world version');
    if (state && (!Number.isInteger(state.revision) || state.revision < 0)) errors.push('state revision must be a non-negative integer');
    if (state && (!Number.isInteger(state.tick) || state.tick < 0)) errors.push('state tick must be a non-negative integer');
    if (state && (!state.player || !Array.isArray(state.player.position) || state.player.position.length !== 3)) errors.push('state player position is invalid');
    if (state && (!state.entities || typeof state.entities !== 'object' || Array.isArray(state.entities))) errors.push('state entities map is invalid');
    if (state && state.stateDigest) {
      var copy = Core.clone(state), claimed = copy.stateDigest;
      delete copy.stateDigest;
      if (Core.digest(copy) !== claimed) errors.push('state digest mismatch');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function create(plan, spawnPointId) {
    Core.assert(plan && plan.schema === Compiler.PLAN_SCHEMA, 'valid deck plan required');
    var spawn = plan.spawnPoints.find(function (item) { return item.id === spawnPointId; }) || plan.spawnPoints[0];
    Core.assert(spawn, 'deck plan needs a spawn point');
    var entities = {};
    plan.nodes.forEach(function (node) { entities[node.id] = Core.clone(node.initialState || {}); });
    return seal({
      schema: STATE_SCHEMA,
      version: '0.1.0',
      worldId: plan.worldId,
      worldDigest: plan.worldDigest,
      revision: 0,
      tick: 0,
      player: {
        spawnPointId: spawn.id,
        position: Core.vec3(spawn.position),
        headingDegrees: Core.angle(spawn.headingDegrees),
        radiusMeters: 0.34
      },
      entities: Core.stableValue(entities),
      actorSequences: {},
      lastMessage: plan.narrative.premise || 'Deck initialized.',
      journal: []
    });
  }

  function commit(plan, previous, intent, candidate, outcome) {
    var valid = verify(plan, previous);
    Core.assert(valid.ok, 'cannot transition invalid state: ' + valid.errors.join('; '));
    var next = Core.clone(candidate || previous);
    var parentRevision = previous.revision;
    next.schema = STATE_SCHEMA;
    next.worldId = previous.worldId;
    next.worldDigest = previous.worldDigest;
    next.revision = parentRevision + 1;
    next.tick = previous.tick + 1;
    next.actorSequences = Core.clone(previous.actorSequences || {});
    next.actorSequences[intent.actor.id] = intent.sequence;
    next.journal = Array.isArray(previous.journal) ? previous.journal.slice() : [];
    var event = {
      id: 'event-' + Core.digest({ parentStateDigest: previous.stateDigest, intent: intent, outcome: outcome }).slice(0, 16),
      revision: next.revision,
      tick: next.tick,
      actorId: intent.actor.id,
      actorKind: intent.actor.kind,
      sequence: intent.sequence,
      kind: intent.kind,
      status: outcome.status,
      detail: Core.stableValue(outcome.detail || {})
    };
    next.journal.push(event);
    if (next.journal.length > 128) next.journal = next.journal.slice(-128);
    next = seal(next);
    var receipt = {
      schema: 'axm.holodeck-intent-receipt/v1',
      id: 'receipt-' + Core.digest({ event: event, stateDigest: next.stateDigest }).slice(0, 16),
      worldId: plan.worldId,
      intentId: intent.id,
      actor: Core.clone(intent.actor),
      sequence: intent.sequence,
      kind: intent.kind,
      status: outcome.status,
      detail: Core.stableValue(outcome.detail || {}),
      parentRevision: parentRevision,
      revision: next.revision,
      parentStateDigest: previous.stateDigest,
      stateDigest: next.stateDigest
    };
    receipt.receiptDigest = Core.digest(receipt);
    return { state: next, receipt: receipt };
  }

  function refused(previous, intent, status, detail) {
    var receipt = {
      schema: 'axm.holodeck-intent-receipt/v1',
      id: 'receipt-' + Core.digest({ stateDigest: previous.stateDigest, intent: intent, status: status, detail: detail }).slice(0, 16),
      worldId: previous.worldId,
      intentId: intent.id,
      actor: Core.clone(intent.actor),
      sequence: intent.sequence,
      kind: intent.kind,
      status: status,
      detail: Core.stableValue(detail || {}),
      parentRevision: previous.revision,
      revision: previous.revision,
      parentStateDigest: previous.stateDigest,
      stateDigest: previous.stateDigest
    };
    receipt.receiptDigest = Core.digest(receipt);
    return { state: Core.clone(previous), receipt: receipt };
  }

  function entityState(state, entityId) {
    return state.entities && state.entities[entityId] ? state.entities[entityId] : {};
  }

  function actionAvailable(state, interaction) {
    var rule = interaction && interaction.availableWhen;
    if (!rule) return true;
    return Core.same(entityState(state, rule.entityId || interaction.entityId)[rule.key], rule.equals);
  }

  function colliderActive(node, state) {
    if (!node.collider || node.collider.solid === false) return false;
    var rule = node.collider.disabledWhen;
    if (!rule) return true;
    return entityState(state, node.id)[rule.key] !== rule.equals;
  }

  function collides(plan, state, position) {
    var radius = state.player.radiusMeters || 0.34;
    for (var index = 0; index < plan.nodes.length; index += 1) {
      var node = plan.nodes[index];
      if (!colliderActive(node, state)) continue;
      var center = node.canonicalTransform.position;
      if (node.collider.shape === 'circle') {
        if (Core.distance2d(position, center) < radius + node.collider.radius) return node.id;
      } else if (node.collider.shape === 'box') {
        var halfX = node.collider.size[0] / 2 + radius;
        var halfZ = node.collider.size[1] / 2 + radius;
        if (Math.abs(position[0] - center[0]) < halfX && Math.abs(position[2] - center[2]) < halfZ) return node.id;
      }
    }
    return null;
  }

  return {
    STATE_SCHEMA: STATE_SCHEMA,
    create: create,
    seal: seal,
    verify: verify,
    commit: commit,
    refused: refused,
    entityState: entityState,
    actionAvailable: actionAvailable,
    colliderActive: colliderActive,
    collides: collides
  };
});
