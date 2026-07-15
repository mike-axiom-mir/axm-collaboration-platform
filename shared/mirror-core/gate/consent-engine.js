'use strict';

const Validation = require('../core/validation');
const { clone, now } = require('../core/utils');

const MODE_RANK = { read_only: 1, proposal_only: 2, approved_apply: 3 };

function scopeMatches(scope, context) {
  scope = scope || {};
  context = context || {};
  if (scope.type === 'global') return true;
  if (scope.type === 'system') return scope.system_id === context.system_id;
  if (scope.type === 'project') return scope.project_id === context.project_id;
  if (scope.type === 'entity') return scope.mirror_id === context.mirror_id;
  if (scope.type === 'adapter') return scope.adapter_id === context.adapter_id;
  return false;
}

class ConsentEngine {
  constructor(store, journal) {
    this.store = store;
    this.journal = journal;
  }

  grant(receipt, actor) {
    const checked = Validation.validateConsent(receipt);
    if (!checked.ok) throw new Error(checked.errors.join('; '));
    const saved = this.store.mutate(function (state) {
      if (state.consents[receipt.consent_id]) throw new Error('consent receipt already exists');
      state.consents[receipt.consent_id] = clone(receipt);
      return receipt;
    }, { authority: true });
    this.journal.append('consent_granted', { actor, system: receipt.system, payload: { consent_id: receipt.consent_id, adapter: receipt.adapter, mode: receipt.connection_mode, purpose: receipt.purpose } });
    return saved;
  }

  revoke(consentId, actor) {
    const receipt = this.store.mutate(function (state) {
      const found = state.consents[consentId];
      if (!found) throw new Error('consent receipt not found');
      found.status = 'revoked';
      found.revoked_at = now();
      found.revoked_by = actor.actor_id;
      return found;
    }, { authority: true });
    this.journal.append('consent_revoked', { actor, system: receipt.system, payload: { consent_id: consentId } });
    return receipt;
  }

  evaluate(input) {
    input = input || {};
    const nowMs = Date.now();
    const receipts = Object.values(this.store.read().consents);
    const receipt = receipts.find(function (candidate) {
      if (candidate.status !== 'active') return false;
      if (Date.parse(candidate.starts_at) > nowMs) return false;
      if (candidate.expires_at && Date.parse(candidate.expires_at) <= nowMs) return false;
      if (candidate.adapter !== input.adapter_id || candidate.system !== input.system_id) return false;
      if (candidate.granted_to !== input.granted_to) return false;
      if ((MODE_RANK[candidate.connection_mode] || 0) < (MODE_RANK[input.connection_mode] || 99)) return false;
      if ((candidate.denied_operations || []).includes(input.operation)) return false;
      if (!(candidate.allowed_operations || []).includes(input.operation) && !(candidate.allowed_operations || []).includes('*')) return false;
      return scopeMatches(candidate.scope, input);
    });
    if (!receipt) return { allow: false, reason: 'no active consent receipt covers this adapter, mode, scope, and operation', receipt: null };
    return { allow: true, reason: 'active specific consent receipt', receipt: clone(receipt) };
  }
}

module.exports = { ConsentEngine, MODE_RANK };
