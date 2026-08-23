'use strict';

const crypto = require('crypto');
const EFFECTS = new Set(['NONE', 'OBSERVE_LOCAL', 'READ_PRIVATE', 'WRITE_CANDIDATE', 'EXECUTE_CONFINED', 'EXECUTE_TRUSTED', 'NETWORK_READ', 'NETWORK_WRITE', 'PUBLIC_RELEASE', 'PHYSICAL_ACTUATION', 'PROMOTION', 'CANON_CHANGE', 'ROOT_CHANGE']);
const HIGH_RISK = new Set(['EXECUTE_TRUSTED', 'NETWORK_WRITE', 'PUBLIC_RELEASE', 'PHYSICAL_ACTUATION', 'PROMOTION', 'CANON_CHANGE', 'ROOT_CHANGE']);

class AuthorityError extends Error {
  constructor(code, message, details) { super(message); this.name = 'AuthorityError'; this.code = code; this.details = details || null; }
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function finiteTime(value, field) { const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new AuthorityError('INVALID_TIME', `${field} must be an ISO-compatible date-time`); return parsed; }

function effectRequest(input) {
  const required = ['id', 'principal', 'action', 'resource', 'effectClass', 'targetDigest', 'requestedAt', 'correlationId'];
  for (const field of required) if (!input || input[field] == null || input[field] === '') throw new AuthorityError('INVALID_EFFECT_REQUEST', `Effect request requires ${field}`);
  if (!EFFECTS.has(input.effectClass)) throw new AuthorityError('UNKNOWN_EFFECT_CLASS', `Unknown effect class ${input.effectClass}`);
  if (!/^[a-f0-9]{64}$/.test(input.targetDigest)) throw new AuthorityError('INVALID_TARGET_DIGEST', 'Effect target must be bound to an exact SHA-256 digest');
  finiteTime(input.requestedAt, 'requestedAt');
  const base = {
    schema: 'axm.effect-request/v1', id: String(input.id), principal: String(input.principal), action: String(input.action), resource: String(input.resource),
    effectClass: input.effectClass, targetDigest: input.targetDigest, scope: input.scope && typeof input.scope === 'object' && !Array.isArray(input.scope) ? input.scope : {},
    requestedAt: String(input.requestedAt), correlationId: String(input.correlationId)
  };
  return { ...base, requestDigest: sha256(canonical(base)) };
}

function policy(input) {
  if (!input || !input.id || !input.version) throw new AuthorityError('INVALID_POLICY', 'Policy requires id and version');
  const decisionMakers = Array.from(new Set((input.decisionMakers || []).map(String))).sort();
  if (!decisionMakers.length) throw new AuthorityError('NO_DECISION_MAKER', 'Policy must name at least one external decision-maker');
  const rules = (input.rules || []).map((rule, index) => {
    if (!['PERMIT', 'DENY', 'HOLD'].includes(rule.decision)) throw new AuthorityError('INVALID_POLICY_RULE', `Rule ${index} has invalid decision`);
    return { id: String(rule.id || `rule-${index}`), principal: rule.principal || '*', action: rule.action || '*', resource: rule.resource || '*', effectClass: rule.effectClass || '*', decision: rule.decision, reason: String(rule.reason || '') };
  });
  const base = { schema: 'axm.authority-policy/v1', id: String(input.id), version: String(input.version), decisionMakers, rules, defaultDecision: input.defaultDecision === 'HOLD' ? 'HOLD' : 'DENY' };
  return { ...base, policyDigest: sha256(canonical(base)) };
}

function matches(expected, actual) { return expected === '*' || expected === actual; }

function decide(requestValue, policyValue, input) {
  input = input || {};
  const request = effectRequest(requestValue);
  const currentPolicy = policy(policyValue);
  const decidedBy = String(input.decidedBy || '');
  if (!currentPolicy.decisionMakers.includes(decidedBy)) throw new AuthorityError('UNRECOGNIZED_DECISION_MAKER', `${decidedBy || 'empty decision-maker'} is not named by policy`);
  const decidedAt = String(input.decidedAt || '');
  const expiresAt = String(input.expiresAt || '');
  const decidedTime = finiteTime(decidedAt, 'decidedAt');
  const expiryTime = finiteTime(expiresAt, 'expiresAt');
  if (expiryTime <= decidedTime) throw new AuthorityError('INVALID_DECISION_EXPIRY', 'Decision must expire after it is made');
  let rule = currentPolicy.rules.find(row => matches(row.principal, request.principal) && matches(row.action, request.action) && matches(row.resource, request.resource) && matches(row.effectClass, request.effectClass));
  let decision = rule ? rule.decision : currentPolicy.defaultDecision;
  let reason = rule ? rule.reason : 'policy-default';
  if (decidedBy.startsWith('ai:') && decidedBy === request.principal) { decision = 'HOLD'; reason = 'ai-self-authorization-refused'; }
  if (HIGH_RISK.has(request.effectClass) && !decidedBy.startsWith('human:')) { decision = 'HOLD'; reason = 'high-risk-requires-human-decision-maker'; }
  const oneUse = HIGH_RISK.has(request.effectClass) || input.oneUse === true;
  const base = {
    schema: 'axm.decision/v1', id: String(input.id || `${request.id}:decision`), requestDigest: request.requestDigest,
    policyId: currentPolicy.id, policyVersion: currentPolicy.version, policyDigest: currentPolicy.policyDigest,
    decision, decidedBy, decidedAt, expiresAt, oneUse, reason
  };
  return { ...base, decisionDigest: sha256(canonical(base)) };
}

function verifyDecision(decision, requestValue, policyValue, input) {
  input = input || {};
  const request = effectRequest(requestValue);
  const currentPolicy = policy(policyValue);
  if (!decision || decision.schema !== 'axm.decision/v1') throw new AuthorityError('INVALID_DECISION', 'Expected axm.decision/v1');
  const { decisionDigest, ...base } = decision;
  if (sha256(canonical(base)) !== decisionDigest) throw new AuthorityError('DECISION_DIGEST_DRIFT', 'Decision fields do not match decisionDigest');
  if (!currentPolicy.decisionMakers.includes(decision.decidedBy)) throw new AuthorityError('UNRECOGNIZED_DECISION_MAKER', 'Decision-maker is not named by the current policy');
  const rule = currentPolicy.rules.find(row => matches(row.principal, request.principal) && matches(row.action, request.action) && matches(row.resource, request.resource) && matches(row.effectClass, request.effectClass));
  let expectedDecision = rule ? rule.decision : currentPolicy.defaultDecision;
  if (decision.decidedBy.startsWith('ai:') && decision.decidedBy === request.principal) expectedDecision = 'HOLD';
  if (HIGH_RISK.has(request.effectClass) && !decision.decidedBy.startsWith('human:')) expectedDecision = 'HOLD';
  if (decision.decision !== expectedDecision) throw new AuthorityError('DECISION_POLICY_DRIFT', 'Decision outcome does not match the current policy evaluation');
  if (decision.requestDigest !== request.requestDigest) throw new AuthorityError('DECISION_SCOPE_DRIFT', 'Decision is not bound to this exact principal/action/resource/effect/target/scope request');
  if (decision.policyDigest !== currentPolicy.policyDigest || decision.policyVersion !== currentPolicy.version || decision.policyId !== currentPolicy.id) throw new AuthorityError('STALE_DECISION', 'Decision policy identity no longer matches current policy');
  if (decision.decision !== 'PERMIT') throw new AuthorityError(decision.decision === 'HOLD' ? 'AUTHORITY_HELD' : 'AUTHORITY_DENIED', decision.reason);
  if (typeof input.verifyDecisionMaker !== 'function' || input.verifyDecisionMaker(decision, currentPolicy) !== true) throw new AuthorityError('DECISION_MAKER_UNVERIFIED', 'An external verifier must authenticate the decision-maker');
  const now = finiteTime(input.now, 'now');
  if (now < finiteTime(decision.decidedAt, 'decidedAt')) throw new AuthorityError('DECISION_NOT_YET_VALID', 'Clock precedes decision time');
  if (now >= finiteTime(decision.expiresAt, 'expiresAt')) throw new AuthorityError('DECISION_EXPIRED', 'Decision is expired');
  const consumed = input.consumedDecisionDigests || new Set();
  if (decision.oneUse && consumed.has(decisionDigest)) throw new AuthorityError('DECISION_ALREADY_USED', 'One-use decision has already been consumed');
  if (HIGH_RISK.has(request.effectClass) && decision.oneUse !== true) throw new AuthorityError('HIGH_RISK_DECISION_REUSABLE', 'High-risk effects require one-use authority');
  return { state: 'AUTHORIZED_EXACT', request, decision, policy: currentPolicy, decisionMakerExternallyVerified: true };
}

function consume(verified, consumedDecisionDigests, consumedAt) {
  if (!verified || verified.state !== 'AUTHORIZED_EXACT') throw new AuthorityError('UNVERIFIED_DECISION_CONSUMPTION', 'Only an exact verified decision can be consumed');
  finiteTime(consumedAt, 'consumedAt');
  const consumed = consumedDecisionDigests || new Set();
  if (verified.decision.oneUse && consumed.has(verified.decision.decisionDigest)) throw new AuthorityError('DECISION_ALREADY_USED', 'One-use decision has already been consumed');
  if (verified.decision.oneUse) consumed.add(verified.decision.decisionDigest);
  const base = { schema: 'axm.decision-consumption/v1', decisionDigest: verified.decision.decisionDigest, requestDigest: verified.request.requestDigest, consumedAt, oneUse: verified.decision.oneUse };
  return { ...base, receiptDigest: sha256(canonical(base)) };
}

module.exports = { EFFECTS, HIGH_RISK, AuthorityError, canonical, sha256, effectRequest, policy, decide, verifyDecision, consume };
