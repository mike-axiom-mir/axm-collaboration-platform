(function (root, factory) {
  'use strict';
  var Core = typeof module !== 'undefined' && module.exports ? require('./core') : root.AXMHolodeckCore;
  var State = typeof module !== 'undefined' && module.exports ? require('./state-machine') : root.AXMHolodeckStateMachine;
  var api = factory(Core, State);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHolodeckPersistence = api;
})(typeof self !== 'undefined' ? self : globalThis, function (Core, State) {
  'use strict';

  var SNAPSHOT_SCHEMA = 'axm.holodeck-state-snapshot/v1';

  function create(plan, state, label) {
    var valid = State.verify(plan, state);
    Core.assert(valid.ok, 'cannot snapshot invalid Holodeck state: ' + valid.errors.join('; '));
    var snapshot = {
      schema: SNAPSHOT_SCHEMA,
      version: '0.1.0',
      worldId: plan.worldId,
      worldDigest: plan.worldDigest,
      revision: state.revision,
      label: Core.text(label, 160) || 'Explicit local snapshot',
      payload: Core.clone(state),
      truth: {
        browserLocalOnly: true,
        authoritativeSharedWorld: false,
        automaticSave: false,
        automaticRestore: false
      }
    };
    snapshot.snapshotDigestAlgorithm = Core.HASH_ALGORITHM;
    snapshot.snapshotDigest = Core.digest(snapshot);
    return snapshot;
  }

  function verify(plan, snapshot) {
    var errors = [];
    if (!snapshot || snapshot.schema !== SNAPSHOT_SCHEMA) errors.push('unsupported Holodeck snapshot schema');
    if (snapshot && snapshot.worldId !== plan.worldId) errors.push('snapshot belongs to another world');
    if (snapshot && snapshot.worldDigest !== plan.worldDigest) errors.push('snapshot belongs to another world version');
    if (snapshot && snapshot.snapshotDigest) {
      var copy = Core.clone(snapshot), claimed = copy.snapshotDigest;
      delete copy.snapshotDigest;
      if (Core.digest(copy) !== claimed) errors.push('snapshot digest mismatch');
    }
    if (snapshot && snapshot.payload) {
      var stateResult = State.verify(plan, snapshot.payload);
      if (!stateResult.ok) errors = errors.concat(stateResult.errors.map(function (error) { return 'snapshot payload: ' + error; }));
      if (snapshot.revision !== snapshot.payload.revision) errors.push('snapshot revision does not match payload');
    } else errors.push('snapshot payload is missing');
    return { ok: errors.length === 0, errors: errors };
  }

  function restore(plan, snapshot) {
    var valid = verify(plan, snapshot);
    Core.assert(valid.ok, 'cannot restore Holodeck snapshot: ' + valid.errors.join('; '));
    return Core.clone(snapshot.payload);
  }

  return { SNAPSHOT_SCHEMA: SNAPSHOT_SCHEMA, create: create, verify: verify, restore: restore };
});
