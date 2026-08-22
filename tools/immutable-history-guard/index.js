(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMImmutableHistoryGuard = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function own(object, key) { return Object.prototype.hasOwnProperty.call(object || {}, key); }

  function assess(proposal, policy) {
    const failures = [];
    const holds = [];
    if (!proposal || typeof proposal !== 'object') failures.push('proposal is not an object');
    if (!policy || typeof policy !== 'object') failures.push('policy is not an object');
    if (failures.length) return result(failures, holds);
    if (proposal.policy_id !== policy.id) failures.push('wrong migration policy');
    if (!Array.isArray(policy.allowed_migration_types) || policy.allowed_migration_types.indexOf(proposal.migration_type) < 0) {
      failures.push('migration type is not allowed');
    }
    const source = proposal.source_pin || {};
    const changes = proposal.requested_changes || {};
    (policy.pinned_fields || []).forEach(function (field) {
      if (own(changes, field) && changes[field] !== source[field]) failures.push('pinned field change attempted: ' + field);
    });
    (policy.forbidden_flags || []).forEach(function (flag) {
      if (Boolean(changes[flag])) failures.push('forbidden change requested: ' + flag);
    });
    if (!proposal.rollback_plan) holds.push('rollback plan missing');
    if (proposal.migration_type === 'explicit_fork' && !changes.new_branch_id) {
      holds.push('explicit fork requires a new branch id');
    }
    return result(failures, holds);
  }

  function result(failures, holds) {
    return {
      schema: 'axm.migration-assessment/v1',
      verdict: failures.length ? 'REJECT' : holds.length ? 'HOLD' : 'ACCEPT',
      failures: failures.slice(),
      holds: holds.slice(),
      source_pin_preserved: !failures.some(function (item) { return item.indexOf('pinned field') >= 0; }),
      rule: 'Compatibility may be added around history; historical identity may not be silently rewritten.'
    };
  }

  return { assess: assess };
});
