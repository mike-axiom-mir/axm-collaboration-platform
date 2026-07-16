'use strict';

const crypto = require('crypto');

const MAX = Object.freeze({ text: 4000, items: 256, id: 120 });
const EPISTEMIC = new Set(['observed', 'asserted', 'derived', 'predicted', 'tested', 'contradicted', 'unknown']);
const EVIDENCE_KINDS = new Set(['observation', 'human-assertion', 'tool-result', 'test', 'rule', 'prediction']);
const RISK = Object.freeze({ low: 0, medium: 1, high: 2, severe: 3 });

function text(value, limit = MAX.text) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, limit);
}

function id(value, fallback) {
  const clean = text(value, MAX.id).replace(/[^a-zA-Z0-9._:/-]/g, '-').replace(/-+/g, '-');
  return clean || fallback;
}

function list(value, limit = MAX.items) {
  return Array.isArray(value) ? value.slice(0, limit) : [];
}

function uniqueStrings(value, limit = MAX.items) {
  return Array.from(new Set(list(value, limit).map(item => text(item, MAX.id)).filter(Boolean)));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function canonical(value) {
  return JSON.stringify(stable(value));
}

function digest(value, length = 24) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex').slice(0, length);
}

function normalizeSource(source, fallbackKind) {
  source = source && typeof source === 'object' ? source : {};
  return {
    kind: id(source.kind, fallbackKind || 'unresolved'),
    id: id(source.id, 'source-unresolved'),
    who: text(source.who, 120) || null,
    at: text(source.at, 80) || null,
    uri: text(source.uri, 500) || null
  };
}

function normalizeEvidence(item, index) {
  item = item && typeof item === 'object' ? item : { statement: item };
  const kind = EVIDENCE_KINDS.has(item.kind) ? item.kind : 'human-assertion';
  const status = EPISTEMIC.has(item.status) ? item.status : (kind === 'observation' || kind === 'tool-result' ? 'observed' : 'asserted');
  const statement = text(item.statement || item.value);
  if (!statement) throw new Error(`evidence[${index}] requires a statement`);
  return {
    id: id(item.id, `evidence-${index + 1}`),
    kind,
    status,
    statement,
    source: normalizeSource(item.source, kind),
    contradicts: uniqueStrings(item.contradicts, 32),
    confidence: item.confidence && typeof item.confidence === 'object' ? {
      low: Math.max(0, Math.min(1, Number(item.confidence.low) || 0)),
      high: Math.max(0, Math.min(1, Number(item.confidence.high) || 1)),
      basis: text(item.confidence.basis, 500) || 'not calibrated'
    } : null
  };
}

function normalizeConstraint(item, index) {
  item = item && typeof item === 'object' ? item : { statement: item };
  return {
    id: id(item.id, `constraint-${index + 1}`),
    type: id(item.type, 'rule'),
    statement: text(item.statement || item.rule) || 'Unspecified constraint',
    actionIds: uniqueStrings(item.actionIds, 128),
    evidenceIds: uniqueStrings(item.evidenceIds, 128),
    permission: id(item.permission, '') || null,
    maxRisk: Object.prototype.hasOwnProperty.call(RISK, item.maxRisk) ? item.maxRisk : null,
    hard: item.hard !== false
  };
}

function normalizeAction(item, index) {
  item = item && typeof item === 'object' ? item : { label: item };
  const label = text(item.label || item.statement || item.id, 500);
  if (!label) throw new Error(`actions[${index}] requires a label`);
  const risk = Object.prototype.hasOwnProperty.call(RISK, item.risk) ? item.risk : 'medium';
  return {
    id: id(item.id, `action-${index + 1}`),
    kind: id(item.kind, 'proposal'),
    label,
    requiredPermissions: uniqueStrings(item.requiredPermissions, 128),
    supportingEvidence: uniqueStrings(item.supportingEvidence, 256),
    preconditionEvidence: uniqueStrings(item.preconditionEvidence, 256),
    expectedEffects: list(item.expectedEffects, 128).map(effect => text(effect, 1000)).filter(Boolean),
    possibleSideEffects: list(item.possibleSideEffects, 128).map(effect => text(effect, 1000)).filter(Boolean),
    reversible: item.reversible === true,
    recovery: text(item.recovery, 1000) || null,
    risk
  };
}

function normalizeRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('reason request must be an object');
  const allowed = new Set(['schema', 'requestId', 'sessionId', 'actor', 'goal', 'evidence', 'unknowns', 'constraints', 'permissions', 'actions', 'budget']);
  const unexpected = Object.keys(input).filter(key => !allowed.has(key));
  if (unexpected.length) throw new Error(`unknown critical request fields: ${unexpected.join(', ')}`);
  const goalInput = typeof input.goal === 'string' ? { statement: input.goal } : (input.goal || {});
  const goalStatement = text(goalInput.statement);
  if (!goalStatement) throw new Error('goal statement is required');
  const normalized = {
    schema: 'axm.mirror.reason/v1',
    sessionId: id(input.sessionId, '') || null,
    actor: {
      id: id(input.actor && input.actor.id, 'anonymous'),
      kind: id(input.actor && input.actor.kind, 'unknown'),
      displayName: text(input.actor && input.actor.displayName, 120) || null
    },
    goal: { id: id(goalInput.id, 'goal-1'), statement: goalStatement },
    evidence: list(input.evidence).map(normalizeEvidence),
    unknowns: list(input.unknowns, 128).map((item, index) => ({
      id: id(item && item.id, `unknown-${index + 1}`),
      question: text(item && (item.question || item.statement) || item, 1000),
      blocking: !!(item && item.blocking)
    })).filter(item => item.question),
    constraints: list(input.constraints, 128).map(normalizeConstraint),
    permissions: uniqueStrings(input.permissions, 128),
    actions: list(input.actions, 128).map(normalizeAction),
    budget: {
      maxCandidates: Math.max(1, Math.min(128, Number(input.budget && input.budget.maxCandidates) || 32)),
      deadlineMs: Math.max(10, Math.min(30000, Number(input.budget && input.budget.deadlineMs) || 1000))
    }
  };
  normalized.actions = normalized.actions.slice(0, normalized.budget.maxCandidates);
  normalized.requestId = id(input.requestId, `request-${digest(normalized)}`);
  return normalized;
}

module.exports = { RISK, canonical, digest, normalizeRequest };
