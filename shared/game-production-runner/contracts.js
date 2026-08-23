'use strict';

const Codec = require('./canonical');

const SCHEMAS = Object.freeze({
  intent: 'axm.game-intent-lock/v1',
  package: 'axm.game-production-package/v1',
  graph: 'axm.game-production-graph/v1',
  plan: 'axm.game-production-plan/v1',
  step: 'axm.game-step-receipt/v1',
  run: 'axm.game-production-run/v1'
});
const ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const DIGEST = /^[a-f0-9]{64}$/;
const CLAIM_KINDS = ['existence', 'structure', 'behavior', 'visual', 'persistence', 'transport', 'authorization', 'performance', 'quality', 'human'];

class ContractError extends Error {
  constructor(kind, errors) {
    super(kind + ' contract held: ' + errors.join('; '));
    this.name = 'ContractError';
    this.kind = kind;
    this.errors = errors.slice();
  }
}

function record(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function portableId(value) { return ID.test(String(value || '')); }
function exactVersion(value) { return VERSION.test(String(value || '')); }
function exactRef(value) { return record(value) && portableId(value.id) && exactVersion(value.version) && DIGEST.test(String(value.digest || '')); }
function exactIdentity(value) { return record(value) && portableId(value.id) && exactVersion(value.version); }
function unique(values) { return new Set(values).size === values.length; }
function digestError(value, errors) { if (!Codec.validDigest(value)) errors.push('exact canonical digest mismatch'); }

function validateClaims(claims, errors) {
  if (!Array.isArray(claims) || !claims.length) { errors.push('at least one atomic claim is required'); return; }
  const ids = [];
  claims.forEach((claim, index) => {
    if (!record(claim)) { errors.push('claim ' + index + ' must be a record'); return; }
    if (!portableId(claim.id)) errors.push('claim ' + index + ' needs a portable id'); else ids.push(claim.id);
    if (!CLAIM_KINDS.includes(claim.kind)) errors.push('claim ' + index + ' has unsupported kind');
    if (typeof claim.required !== 'boolean') errors.push('claim ' + index + ' required must be boolean');
    if (!text(claim.pass_condition)) errors.push('claim ' + index + ' needs an observable pass condition');
  });
  if (!unique(ids)) errors.push('claim ids must be unique');
}

function validateIntent(intent) {
  const errors = [];
  if (!record(intent)) return ['intent must be a record'];
  if (intent.schema !== SCHEMAS.intent) errors.push('intent schema mismatch');
  if (!portableId(intent.id)) errors.push('intent id must be portable');
  if (!exactVersion(intent.version)) errors.push('intent version must be exact semver');
  if (intent.status !== 'LOCKED') errors.push('runner accepts LOCKED intent only');
  if (!text(intent.human_goal)) errors.push('human_goal is required');
  if (!record(intent.target) || !text(intent.target.domain) || !text(intent.target.profile)) errors.push('target domain and profile are required');
  validateClaims(intent.required_features, errors);
  if (!Array.isArray(intent.forbidden_substitutions)) errors.push('forbidden_substitutions must be an array');
  if (!record(intent.constraints) || intent.constraints.network !== false || intent.constraints.candidate_only !== true) errors.push('intent must be candidate-only with network denied');
  if (!record(intent.change_policy) || intent.change_policy.revision_creates_new_digest !== true || intent.change_policy.silent_rewrite !== false) errors.push('immutable revision policy is required');
  digestError(intent, errors);
  return errors;
}

function validatePackage(pkg) {
  const errors = [];
  if (!record(pkg)) return ['package must be a record'];
  if (pkg.schema !== SCHEMAS.package) errors.push('package schema mismatch');
  if (!portableId(pkg.id)) errors.push('package id must be portable');
  if (!exactVersion(pkg.version)) errors.push('package version must be exact semver');
  if (!text(pkg.title)) errors.push('package title is required');
  if (!Array.isArray(pkg.dependencies) || !unique(pkg.dependencies || []) || (pkg.dependencies || []).some((id) => !portableId(id))) errors.push('dependencies must be unique portable ids');
  if (!Array.isArray(pkg.inputs) || !Array.isArray(pkg.outputs) || !pkg.outputs.length) errors.push('declared inputs and at least one output are required');
  const outputPaths = (pkg.outputs || []).map((item) => item && item.path);
  if (outputPaths.some((item) => !safeRelative(item)) || !unique(outputPaths)) errors.push('output paths must be unique safe relative paths');
  if (!exactIdentity(pkg.executor)) errors.push('exact executor identity is required');
  if (!exactIdentity(pkg.verifier)) errors.push('exact verifier identity is required');
  if (exactIdentity(pkg.executor) && exactIdentity(pkg.verifier) && pkg.executor.id === pkg.verifier.id) errors.push('package may not appoint its executor as verifier');
  validateClaims(pkg.claims, errors);
  if (!record(pkg.sandbox) || pkg.sandbox.network !== false || pkg.sandbox.write_scope !== 'candidate-package-only') errors.push('sandbox must deny network and limit writes to candidate package');
  if (!record(pkg.resource_budget) || !Number.isInteger(pkg.resource_budget.timeout_ms) || pkg.resource_budget.timeout_ms < 1 || !Number.isInteger(pkg.resource_budget.max_output_bytes) || pkg.resource_budget.max_output_bytes < 1) errors.push('positive timeout and output byte budgets are required');
  if (!record(pkg.repair_policy) || !Number.isInteger(pkg.repair_policy.max_attempts) || pkg.repair_policy.max_attempts < 1 || pkg.repair_policy.max_attempts > 3 || pkg.repair_policy.may_change_intent !== false) errors.push('bounded repair policy is required');
  if (!record(pkg.authority) || pkg.authority.source_write !== false || pkg.authority.install !== false || pkg.authority.promote !== false || pkg.authority.canon !== false) errors.push('candidate-only authority boundary is required');
  digestError(pkg, errors);
  return errors;
}

function validateGraph(graph, packages, intent) {
  const errors = [];
  if (!record(graph)) return ['graph must be a record'];
  if (graph.schema !== SCHEMAS.graph) errors.push('graph schema mismatch');
  if (!portableId(graph.id)) errors.push('graph id must be portable');
  if (!exactVersion(graph.version)) errors.push('graph version must be exact semver');
  if (graph.status !== 'READY') errors.push('graph must be READY');
  if (!exactRef(graph.intent_ref)) errors.push('graph intent_ref must be exact');
  if (intent && graph.intent_ref && graph.intent_ref.digest !== intent.digest) errors.push('graph intent digest does not match locked intent');
  if (!Array.isArray(graph.nodes) || !graph.nodes.length) errors.push('graph needs nodes');
  if (!Array.isArray(graph.edges)) errors.push('graph edges must be an array');
  const packageMap = new Map((packages || []).map((pkg) => [pkg.id, pkg]));
  const nodeIds = [];
  (graph.nodes || []).forEach((node, index) => {
    if (!record(node) || !portableId(node.package_id) || !DIGEST.test(String(node.package_digest || ''))) { errors.push('node ' + index + ' needs exact package identity'); return; }
    nodeIds.push(node.package_id);
    const pkg = packageMap.get(node.package_id);
    if (!pkg) errors.push('node references unknown package ' + node.package_id);
    else if (pkg.digest !== node.package_digest) errors.push('node package digest mismatch for ' + node.package_id);
  });
  if (!unique(nodeIds)) errors.push('graph nodes must be unique');
  if (packageMap.size !== nodeIds.length || Array.from(packageMap.keys()).some((id) => !nodeIds.includes(id))) errors.push('graph must contain every package exactly once');
  const edgeKeys = [];
  (graph.edges || []).forEach((edge, index) => {
    if (!record(edge) || !nodeIds.includes(edge.from) || !nodeIds.includes(edge.to) || edge.from === edge.to) errors.push('edge ' + index + ' is invalid');
    else edgeKeys.push(edge.from + '>' + edge.to);
  });
  if (!unique(edgeKeys)) errors.push('graph edges must be unique');
  for (const pkg of packages || []) {
    for (const dependency of pkg.dependencies || []) if (!edgeKeys.includes(dependency + '>' + pkg.id)) errors.push('missing dependency edge ' + dependency + '>' + pkg.id);
    for (const edge of graph.edges || []) if (edge.to === pkg.id && !(pkg.dependencies || []).includes(edge.from)) errors.push('undeclared dependency edge ' + edge.from + '>' + pkg.id);
  }
  const order = topologicalOrder(nodeIds, graph.edges || []);
  if (order.length !== nodeIds.length) errors.push('production graph contains a cycle');
  if (!record(graph.policy) || graph.policy.execution !== 'serial' || graph.policy.explicit_start !== true || graph.policy.verified_only_assembly !== true) errors.push('serial explicit verified-only graph policy is required');
  digestError(graph, errors);
  return errors;
}

function topologicalOrder(ids, edges) {
  const incoming = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) if (incoming.has(edge.from) && incoming.has(edge.to)) { incoming.set(edge.to, incoming.get(edge.to) + 1); outgoing.get(edge.from).push(edge.to); }
  const queue = ids.filter((id) => incoming.get(id) === 0).sort();
  const order = [];
  while (queue.length) {
    const current = queue.shift(); order.push(current);
    for (const next of outgoing.get(current).slice().sort()) { incoming.set(next, incoming.get(next) - 1); if (incoming.get(next) === 0) { queue.push(next); queue.sort(); } }
  }
  return order;
}

function safeRelative(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  return !!normalized && !normalized.startsWith('/') && !/^[A-Za-z]:/.test(normalized) && normalized.split('/').every((part) => part && part !== '.' && part !== '..');
}

function assertValid(kind, value, context) {
  let errors;
  if (kind === 'intent') errors = validateIntent(value);
  else if (kind === 'package') errors = validatePackage(value);
  else if (kind === 'graph') errors = validateGraph(value, context && context.packages, context && context.intent);
  else throw new Error('unknown contract kind: ' + kind);
  if (errors.length) throw new ContractError(kind, errors);
  return value;
}

module.exports = { SCHEMAS, CLAIM_KINDS, ContractError, validateIntent, validatePackage, validateGraph, topologicalOrder, safeRelative, assertValid, portableId, exactVersion, exactIdentity, exactRef };
