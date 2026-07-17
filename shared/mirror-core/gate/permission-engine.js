'use strict';

const { clone } = require('../core/utils');
const { PERMISSIONS } = require('../core/constants');

function scopeMatches(scope, context) {
  scope = scope || { type: 'global' };
  context = context || {};
  if (scope.type === 'global') return true;
  if (scope.type === 'system') return scope.system_id === context.system_id;
  if (scope.type === 'project') return scope.project_id === context.project_id;
  if (scope.type === 'entity_type') return scope.entity_type === context.entity_type;
  if (scope.type === 'entity') return scope.mirror_id === context.mirror_id;
  if (scope.type === 'relation') return scope.relation_id === context.relation_id;
  if (scope.type === 'operation') return scope.operation === context.operation;
  if (scope.type === 'session') {
    if (scope.session_id !== context.session_id) return false;
    if (scope.expires_at && Date.parse(scope.expires_at) <= Date.now()) return false;
    return true;
  }
  return false;
}

class PermissionEngine {
  constructor(store) {
    this.store = store;
  }

  evaluate(actorId, permission, context) {
    if (!PERMISSIONS.includes(permission)) return { allow: false, reason: 'unknown permission: ' + permission, grant: null };
    const actor = this.store.read().actors[actorId];
    if (!actor) return { allow: false, reason: 'actor not registered', grant: null };
    if (actor.status !== 'active') return { allow: false, reason: 'actor is not active', grant: null };
    const grant = (actor.permissions || []).find(function (candidate) {
      return candidate.permission === permission && candidate.effect !== 'deny' && scopeMatches(candidate.scope, context);
    });
    const deny = (actor.permissions || []).find(function (candidate) {
      return candidate.permission === permission && candidate.effect === 'deny' && scopeMatches(candidate.scope, context);
    });
    if (deny) return { allow: false, reason: 'explicit deny grant matched', grant: clone(deny) };
    if (!grant) return { allow: false, reason: 'default deny: no matching ' + permission + ' grant', grant: null };
    return { allow: true, reason: 'matching scoped grant', grant: clone(grant) };
  }
}

module.exports = { PermissionEngine, scopeMatches };
