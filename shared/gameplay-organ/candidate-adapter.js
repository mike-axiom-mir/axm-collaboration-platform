'use strict';

const Codec = require('../asset-hands/native-bridge-codec');
const CandidateOrgans = require('../game-organism/game-organism');

const DRAFT_SCHEMA = 'axm.gameplay-organ-adapter-draft/v1';
const FAMILIES = new Set(['zone', 'nature', 'machine']);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.keys(value).forEach(key => deepFreeze(value[key]));
  return value;
}

function digest(value) {
  const copy = clone(value || {});
  delete copy.digest;
  return Codec.sha256(copy);
}

function adaptCandidateToDraft(candidate, mapping) {
  const validation = CandidateOrgans.validateOrgan(candidate);
  if (!validation.pass) {
    return Object.freeze({
      schema: 'axm.gameplay-organ-adapter-refusal/v1',
      verdict: 'REFUSED',
      code: 'INVALID_CANDIDATE_ORGAN',
      errors: validation.errors.slice()
    });
  }

  mapping = mapping || {};
  if (!FAMILIES.has(mapping.family)) {
    return Object.freeze({
      schema: 'axm.gameplay-organ-adapter-refusal/v1',
      verdict: 'REFUSED',
      code: 'RUNTIME_FAMILY_REQUIRED',
      errors: ['an explicit zone, nature, or machine family mapping is required']
    });
  }

  const draft = {
    schema: DRAFT_SCHEMA,
    verdict: 'DRAFT_ONLY',
    candidate: {
      schema: candidate.schema,
      id: candidate.id,
      version: candidate.version,
      digest: candidate.digest
    },
    proposed_runtime_identity: {
      id: String(mapping.runtime_id || candidate.id + '.runtime-draft'),
      version: String(mapping.runtime_version || candidate.version),
      family: mapping.family,
      title: candidate.title
    },
    carried_fields: ['identity', 'title', 'candidate-provenance'],
    omitted_fields: [
      'candidate-capabilities',
      'candidate-implementation',
      'candidate-ports',
      'candidate-resource-budget'
    ],
    authority: {
      state: 'UNGRANTED',
      gameplay_truth: false,
      activation_enabled: false,
      reason: 'a planning organ is evidence of a candidate plan, never a runtime authority grant'
    },
    next_gate: {
      required_schema: 'axm.gameplay-organ/v1',
      independent_validation_required: true,
      adapter_can_promote: false
    }
  };
  draft.digest = digest(draft);
  return deepFreeze(clone(draft));
}

function validateDraft(draft) {
  const errors = [];
  if (!draft || draft.schema !== DRAFT_SCHEMA) errors.push('adapter draft schema mismatch');
  if (!draft || draft.verdict !== 'DRAFT_ONLY') errors.push('adapter output must remain draft-only');
  if (!draft || !draft.authority || draft.authority.state !== 'UNGRANTED')
    errors.push('adapter authority must remain ungranted');
  if (!draft || !draft.authority || draft.authority.gameplay_truth !== false)
    errors.push('adapter must not grant gameplay truth');
  if (!draft || !draft.authority || draft.authority.activation_enabled !== false)
    errors.push('adapter must not enable activation');
  if (!draft || !draft.next_gate || draft.next_gate.adapter_can_promote !== false)
    errors.push('adapter must not expose promotion authority');
  if (!draft || !draft.next_gate || draft.next_gate.independent_validation_required !== true)
    errors.push('independent runtime validation must remain required');
  if (!draft || draft.digest !== digest(draft)) errors.push('adapter draft digest mismatch');
  return { pass: errors.length === 0, errors: Array.from(new Set(errors)).sort() };
}

module.exports = Object.freeze({
  VERSION: '0.1.0',
  DRAFT_SCHEMA,
  adaptCandidateToDraft,
  validateDraft
});
