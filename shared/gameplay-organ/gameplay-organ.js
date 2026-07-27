'use strict';

const Codec = require('../asset-hands/native-bridge-codec');

const ORGAN_SCHEMA = 'axm.gameplay-organ/v1';
const ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/;
const DIGEST = /^[a-f0-9]{64}$/;
const FAMILIES = Object.freeze(['zone', 'nature', 'machine']);
const REQUIRED_REFUSALS = Object.freeze([
  'non-authoritative-truth-request',
  'missing-prior-telegraph',
  'out-of-bounds',
  'conflict',
  'unseeded-variation'
]);
const REQUIRED_RECEIPTS = Object.freeze([
  'organ.telegraph',
  'organ.effect',
  'authority.refused'
]);
const REQUIRED_REPLAY_INPUTS = Object.freeze([
  'seed',
  'ordered-input-stream',
  'organ-version'
]);
const TOP_LEVEL_FIELDS = new Set([
  'schema', 'id', 'version', 'family', 'title', 'description', 'interface',
  'owned_state', 'authority', 'activation', 'determinism', 'bounds',
  'conflicts', 'refusals', 'receipts', 'failure', 'migration',
  'verification', 'implementation', 'digest'
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function withoutDigest(value) {
  const copy = clone(value || {});
  delete copy.digest;
  return copy;
}

function digest(value) {
  return Codec.sha256(withoutDigest(value));
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

function requireExactFields(value, allowed, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(label + ' object required');
    return;
  }
  Object.keys(value).forEach(field => {
    if (!allowed.has(field)) errors.push(label + ' has unknown field ' + field);
  });
}

function validateStringSet(values, label, errors, options) {
  options = options || {};
  if (!Array.isArray(values) || (options.nonEmpty && !values.length)) {
    errors.push(label + ' must be ' + (options.nonEmpty ? 'a non-empty ' : 'an ') + 'array');
    return;
  }
  const seen = new Set();
  values.forEach(value => {
    if (typeof value !== 'string' || !value.trim()) errors.push(label + ' contains a blank value');
    else if (seen.has(value)) errors.push(label + ' contains duplicate ' + value);
    else seen.add(value);
  });
  (options.required || []).forEach(value => {
    if (!seen.has(value)) errors.push(label + ' must include ' + value);
  });
}

function validatePorts(ports, label, errors, requireInitial) {
  if (!Array.isArray(ports) || (requireInitial && !ports.length)) {
    errors.push(label + ' must be ' + (requireInitial ? 'a non-empty ' : 'an ') + 'array');
    return;
  }
  const seen = new Set();
  ports.forEach(port => {
    const allowed = new Set(requireInitial ? ['id', 'type', 'initial'] : ['id', 'type']);
    requireExactFields(port, allowed, label + ' item', errors);
    if (!port || !ID.test(String(port.id || ''))) errors.push(label + ' id is invalid');
    else if (seen.has(port.id)) errors.push(label + ' id is duplicated: ' + port.id);
    else seen.add(port.id);
    if (!port || typeof port.type !== 'string' || !port.type.trim()) errors.push(label + ' type is required');
    if (requireInitial && (!port || !Object.prototype.hasOwnProperty.call(port, 'initial')))
      errors.push(label + ' initial value is required');
  });
}

function positiveInteger(value, label, errors, minimum) {
  if (!Number.isInteger(value) || value < minimum) errors.push(label + ' must be an integer >= ' + minimum);
}

function validateOrgan(organ) {
  const errors = [];
  const warnings = [];
  requireExactFields(organ, TOP_LEVEL_FIELDS, 'gameplay organ', errors);

  if (!organ || organ.schema !== ORGAN_SCHEMA) errors.push('gameplay organ schema mismatch');
  if (!organ || !ID.test(String(organ.id || ''))) errors.push('portable gameplay organ id required');
  if (!organ || !VERSION.test(String(organ.version || ''))) errors.push('semantic gameplay organ version required');
  if (!organ || FAMILIES.indexOf(organ.family) < 0) errors.push('unknown gameplay organ family');
  if (!organ || typeof organ.title !== 'string' || !organ.title.trim()) errors.push('gameplay organ title required');

  const interfaceContract = organ && organ.interface;
  requireExactFields(interfaceContract, new Set(['inputs', 'outputs']), 'interface', errors);
  validatePorts(interfaceContract && interfaceContract.inputs, 'input port', errors, false);
  validatePorts(interfaceContract && interfaceContract.outputs, 'output port', errors, false);
  validatePorts(organ && organ.owned_state, 'owned state', errors, true);

  const authority = organ && organ.authority;
  requireExactFields(authority, new Set(['truth_owner', 'client_scope', 'grants_from_planning']), 'authority', errors);
  if (!authority || authority.truth_owner !== 'authoritative-server')
    errors.push('authoritative server must own gameplay truth');
  if (!authority || authority.client_scope !== 'intent-and-presentation-only')
    errors.push('client scope must be intent-and-presentation-only');
  if (!authority || authority.grants_from_planning !== false)
    errors.push('planning organs must never grant runtime authority');

  const activation = organ && organ.activation;
  requireExactFields(activation, new Set(['causes', 'telegraph', 'effect']), 'activation', errors);
  validateStringSet(activation && activation.causes, 'activation causes', errors, { nonEmpty: true });
  const telegraph = activation && activation.telegraph;
  requireExactFields(telegraph, new Set(['receipt_type', 'minimum_lead_ticks', 'matching_key']), 'telegraph', errors);
  if (!telegraph || telegraph.receipt_type !== 'organ.telegraph') errors.push('telegraph receipt type must be organ.telegraph');
  positiveInteger(telegraph && telegraph.minimum_lead_ticks, 'telegraph minimum lead ticks', errors, 1);
  if (!telegraph || telegraph.matching_key !== 'activation_id') errors.push('telegraph matching key must be activation_id');
  const effect = activation && activation.effect;
  requireExactFields(effect, new Set(['receipt_type', 'matching_key']), 'effect', errors);
  if (!effect || effect.receipt_type !== 'organ.effect') errors.push('effect receipt type must be organ.effect');
  if (!effect || effect.matching_key !== 'activation_id') errors.push('effect matching key must be activation_id');

  const determinism = organ && organ.determinism;
  requireExactFields(determinism, new Set(['pure', 'seed_inputs', 'forbidden_sources']), 'determinism', errors);
  if (!determinism || determinism.pure !== true) errors.push('gameplay organ variation must be pure');
  validateStringSet(determinism && determinism.seed_inputs, 'deterministic seed inputs', errors, { nonEmpty: true });
  validateStringSet(determinism && determinism.forbidden_sources, 'forbidden nondeterminism sources', errors, {
    required: ['wall-clock', 'system-random', 'network']
  });

  const bounds = organ && organ.bounds;
  requireExactFields(bounds, new Set(['spatial', 'time', 'resources']), 'bounds', errors);
  const spatial = bounds && bounds.spatial;
  requireExactFields(spatial, new Set(['kind', 'ids']), 'spatial bounds', errors);
  if (!spatial || ['anchor-set', 'node-set', 'whole-arena'].indexOf(spatial.kind) < 0)
    errors.push('spatial bound kind is invalid');
  validateStringSet(spatial && spatial.ids, 'spatial bound ids', errors, { nonEmpty: true });
  const time = bounds && bounds.time;
  requireExactFields(time, new Set(['max_active_ticks', 'cooldown_ticks']), 'time bounds', errors);
  positiveInteger(time && time.max_active_ticks, 'max active ticks', errors, 1);
  positiveInteger(time && time.cooldown_ticks, 'cooldown ticks', errors, 0);
  const resources = bounds && bounds.resources;
  requireExactFields(resources, new Set(['max_activations', 'max_receipts_per_activation']), 'resource bounds', errors);
  positiveInteger(resources && resources.max_activations, 'max activations', errors, 1);
  positiveInteger(resources && resources.max_receipts_per_activation, 'max receipts per activation', errors, 2);

  const conflicts = organ && organ.conflicts;
  requireExactFields(conflicts, new Set(['precedence', 'exclusive_with', 'on_conflict']), 'conflicts', errors);
  positiveInteger(conflicts && conflicts.precedence, 'organ precedence', errors, 0);
  if (conflicts && conflicts.precedence > 1000) errors.push('organ precedence must be <= 1000');
  validateStringSet(conflicts && conflicts.exclusive_with, 'exclusive organ ids', errors);
  (conflicts && conflicts.exclusive_with || []).forEach(id => {
    if (!ID.test(id)) errors.push('exclusive organ id is invalid: ' + id);
  });
  if (!conflicts || conflicts.on_conflict !== 'refuse') errors.push('organ conflicts must fail closed');

  validateStringSet(organ && organ.refusals, 'refusal rules', errors, { required: REQUIRED_REFUSALS });

  const receipts = organ && organ.receipts;
  requireExactFields(receipts, new Set(['append_only', 'types', 'replay_inputs']), 'receipts', errors);
  if (!receipts || receipts.append_only !== true) errors.push('organ receipts must be append-only');
  validateStringSet(receipts && receipts.types, 'receipt types', errors, { required: REQUIRED_RECEIPTS });
  validateStringSet(receipts && receipts.replay_inputs, 'replay inputs', errors, { required: REQUIRED_REPLAY_INPUTS });

  const failure = organ && organ.failure;
  requireExactFields(failure, new Set(['mode', 'state_recovery']), 'failure', errors);
  if (!failure || failure.mode !== 'disable-and-receipt') errors.push('organ failures must disable and receipt');
  if (!failure || failure.state_recovery !== 'restore-last-authoritative-state')
    errors.push('organ failure recovery must restore the last authoritative state');

  const migration = organ && organ.migration;
  requireExactFields(migration, new Set(['automatic', 'requires_exact_version', 'human_review_required']), 'migration', errors);
  if (!migration || migration.automatic !== false) errors.push('automatic gameplay organ migration is forbidden');
  if (!migration || migration.requires_exact_version !== true) errors.push('exact gameplay organ version is required');
  if (!migration || migration.human_review_required !== true) errors.push('gameplay organ migration needs human review');

  const verification = organ && organ.verification;
  requireExactFields(verification, new Set(['automatic_checks', 'human_judgments', 'assurance_ceiling']), 'verification', errors);
  validateStringSet(verification && verification.automatic_checks, 'automatic checks', errors, { nonEmpty: true });
  validateStringSet(verification && verification.human_judgments, 'human judgments', errors);
  if (!verification || verification.assurance_ceiling !== 'headless-contract-only')
    errors.push('verification assurance ceiling must remain headless-contract-only');
  if (verification && verification.human_judgments && verification.human_judgments.length)
    warnings.push('human gameplay judgment remains unresolved');

  const implementation = organ && organ.implementation;
  requireExactFields(implementation, new Set(['kind', 'reference', 'status']), 'implementation', errors);
  if (!implementation || ['stub', 'runtime-module'].indexOf(implementation.kind) < 0)
    errors.push('gameplay organ implementation kind is invalid');
  if (!implementation || typeof implementation.reference !== 'string' || !implementation.reference.trim())
    errors.push('gameplay organ implementation reference required');
  if (!implementation || ['DECLARED', 'EXPERIMENTAL'].indexOf(implementation.status) < 0)
    errors.push('gameplay organ implementation status is invalid');

  if (!organ || !DIGEST.test(String(organ.digest || ''))) errors.push('gameplay organ digest required');
  else if (organ.digest !== digest(organ)) errors.push('gameplay organ digest mismatch');

  return {
    pass: errors.length === 0,
    errors: unique(errors),
    warnings: unique(warnings)
  };
}

function sealOrgan(input) {
  const organ = clone(input || {});
  organ.schema = ORGAN_SCHEMA;
  organ.digest = digest(organ);
  return organ;
}

module.exports = Object.freeze({
  VERSION: '0.1.0',
  ORGAN_SCHEMA,
  FAMILIES,
  REQUIRED_REFUSALS,
  REQUIRED_RECEIPTS,
  REQUIRED_REPLAY_INPUTS,
  digest,
  sealOrgan,
  validateOrgan
});
