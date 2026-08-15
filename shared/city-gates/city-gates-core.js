'use strict';

const crypto = require('crypto');
const Grid = require('../authority-grid/authority-grid-core');

class GateError extends Error {
  constructor(code, message, details) { super(message); this.name = 'GateError'; this.code = code; this.details = details || null; }
}
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}
function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex'); }

function registry(value) {
  if (!value || value.schema !== 'axm.gate-registry/v1' || !Array.isArray(value.adapters)) throw new GateError('INVALID_GATE_REGISTRY', 'Expected axm.gate-registry/v1');
  const ids = new Set();
  for (const adapter of value.adapters) {
    if (!adapter.id || ids.has(adapter.id)) throw new GateError('DUPLICATE_GATE_ID', `Duplicate or missing adapter id ${adapter.id}`);
    ids.add(adapter.id);
    if (adapter.internalAuthority !== false || adapter.transportBundled !== false) throw new GateError('GATE_BOUNDARY_DRIFT', `Adapter ${adapter.id} claims internal authority or bundled transport`);
  }
  return value;
}

function committedDefaults(value) {
  registry(value);
  if (value.adapters.some(adapter => adapter.enabled !== false)) throw new GateError('COMMITTED_GATE_ENABLED', 'Every committed external gate must be disabled');
  if (value.privateLocalOperationRequiresGate !== false || value.externalProtocolIsInternalCanon !== false) throw new GateError('GATE_BOUNDARY_DRIFT', 'Private local operation must not depend on external gates or protocols as canon');
  return true;
}

function outboundPlan(adapter, input) {
  if (!adapter || adapter.enabled !== true) throw new GateError('GATE_DISABLED', `Gate ${adapter && adapter.id || 'unknown'} is disabled`);
  if (adapter.transportBundled !== false || adapter.internalAuthority !== false) throw new GateError('GATE_BOUNDARY_DRIFT', 'Gate adapter cannot bundle transport or become authority');
  const request = Grid.effectRequest(input.request);
  if (!(adapter.effects || []).includes(request.effectClass)) throw new GateError('GATE_EFFECT_MISMATCH', `Adapter ${adapter.id} does not declare ${request.effectClass}`);
  const verified = Grid.verifyDecision(input.decision, request, input.policy, { now: input.now, consumedDecisionDigests: input.consumedDecisionDigests, verifyDecisionMaker: input.verifyDecisionMaker });
  const consumption = Grid.consume(verified, input.consumedDecisionDigests, input.now);
  if (!input.internalPacketDigest || !/^[a-f0-9]{64}$/.test(input.internalPacketDigest)) throw new GateError('INVALID_INTERNAL_PACKET_DIGEST', 'Outbound plan requires exact internal packet digest');
  const payloadDigest = sha256(canonical(input.payload == null ? null : input.payload));
  const receiverConstraints = Array.from(new Set(adapter.receiverAssertions || [])).sort();
  if (adapter.id === 'github-draft' && !receiverConstraints.includes('draft-true')) throw new GateError('GITHUB_DRAFT_ASSERTION_MISSING', 'GitHub gate must require final draft=true readback');
  const base = { schema: 'axm.gate-plan/v1', adapterId: adapter.id, protocol: adapter.protocol, internalPacketDigest: input.internalPacketDigest, requestDigest: request.requestDigest, decisionDigest: input.decision.decisionDigest, consumptionReceiptDigest: consumption.receiptDigest, payloadDigest, receiverConstraints, payload: input.payload == null ? null : input.payload, executesTransport: false, grantsAuthority: false };
  return { ...base, planDigest: sha256(canonical(base)) };
}

function inbound(adapterId, bytes, mediaType) {
  const base = { schema: 'axm.gate-import/v1', adapterId: String(adapterId), payloadDigest: sha256(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)), mediaType: String(mediaType || 'application/octet-stream'), quarantineRequired: true, trusted: false, installed: false, grantsAuthority: false };
  return { ...base, importDigest: sha256(canonical(base)) };
}

function verifyPlan(plan) {
  if (!plan || plan.schema !== 'axm.gate-plan/v1') throw new GateError('INVALID_GATE_PLAN', 'Expected axm.gate-plan/v1');
  const { planDigest, ...base } = plan;
  if (sha256(canonical(base)) !== planDigest) throw new GateError('GATE_PLAN_DRIFT', 'Gate plan fields do not match planDigest');
  return true;
}

function githubReceiver(plan, readback) {
  verifyPlan(plan);
  if (plan.adapterId !== 'github-draft') throw new GateError('INVALID_GITHUB_PLAN', 'Expected a GitHub draft gate plan');
  const exact = ['head', 'base', 'title', 'body'];
  const checks = exact.map(field => ({ id: `exact-${field}`, pass: readback[field] === plan.payload[field] }));
  checks.push({ id: 'open', pass: readback.open === true }, { id: 'unmerged', pass: readback.merged === false }, { id: 'draft-true', pass: readback.draft === true }, { id: 'plan-digest', pass: readback.planDigest === plan.planDigest });
  const base = { schema: 'axm.gate-receiver-receipt/v1', state: checks.every(row => row.pass) ? 'PASS' : 'FAIL', planDigest: plan.planDigest, checks, draft: readback.draft === true, open: readback.open === true, merged: readback.merged === true };
  return { ...base, receiptDigest: sha256(canonical(base)) };
}

function verifyArtifactExport(manifest, bytesByDigest) {
  if (!manifest || manifest.schema !== 'axm.artifact-export/v1') throw new GateError('INVALID_ARTIFACT_EXPORT', 'Expected axm.artifact-export/v1');
  const { manifestDigest, ...base } = manifest;
  if (sha256(canonical(base)) !== manifestDigest) throw new GateError('ARTIFACT_EXPORT_DRIFT', 'Artifact export fields do not match manifestDigest');
  const checks = manifest.artifacts.map(ref => ({ digest: ref.digest, pass: bytesByDigest.has(ref.digest) && sha256(bytesByDigest.get(ref.digest)) === ref.digest }));
  return { state: checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks, networkUsed: false, publicServiceRequired: false };
}

module.exports = { GateError, canonical, sha256, registry, committedDefaults, outboundPlan, inbound, verifyPlan, githubReceiver, verifyArtifactExport };
