'use strict';

const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const DeterministicJson = require('../../tools/deterministic-json-core');

const PACKET_SCHEMA = 'axm.grounded-growth-feedback-packet/v1';
const VERSION = '0.1.0';
const GEI_VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const GEI_ID = /^axm:(module|capability|interface|evidence|edge|need|research|direction|intervention|decision|event|packet):[a-z0-9][a-z0-9._-]{2,127}$/;
const ROUTE_STATES = [
  'UNADDRESSED',
  'READY_FOR_VOLUNTARY_INPUT',
  'READY_FOR_EVALUATION',
  'IN_PROGRESS',
  'BLOCKED',
  'SATISFIED',
  'NOT_APPLICABLE'
];
const NEED_CODES = [
  'HUMAN_BENEFIT_NATIVE_EVIDENCE',
  'AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE',
  'REPAIR_EVIDENCE_ROUTE',
  'REFRESH_CHANGED_BASELINE_OR_EVIDENCE',
  'REPAIR_BENEFICIARY_REGRESSION',
  'RESOLVE_CAPABILITY_CYCLE_HOLD'
];
const ACTIVE_NEED_STATUSES = ['OPEN', 'TRIAGED', 'DIRECTION_CREATED', 'IN_PROGRESS', 'PARTIALLY_RESOLVED'];
const NEED_KEYS = [
  'need_id', 'contract_version', 'affected_scope', 'observed_problem', 'evidence',
  'desired_outcome', 'improvement_dimensions', 'severity', 'ecosystem_reach',
  'blocked_work', 'possible_responses', 'required_knowledge', 'verification_method',
  'confidence', 'truth_state', 'status', 'assigned_direction_ids'
];
const DIMENSIONS = [
  'RELIABILITY', 'USEFULNESS', 'INTEROPERABILITY', 'HUMAN_ACCESSIBILITY',
  'AI_ACCESSIBILITY', 'PRIVACY', 'SAFETY', 'SPEED', 'COMPUTE_EFFICIENCY',
  'VISUAL_QUALITY', 'TESTABILITY', 'PORTABILITY', 'DOCUMENTATION',
  'PROOF_MATURITY', 'MAINTAINABILITY', 'MODULAR_REUSE'
];
const RESPONSES = [
  'BUILD', 'REPAIR', 'RESEARCH', 'TEST', 'INTEGRATE', 'DOCUMENT', 'SIMPLIFY',
  'DEPRECATE', 'REUSE', 'WAIT_FOR_EVIDENCE'
];
const TRUTH_STATES = ['OBSERVED', 'DECLARED', 'TESTED', 'REPRODUCED', 'INFERRED', 'HYPOTHESIS', 'CONFLICTED', 'OBSOLETE', 'UNKNOWN'];
const NEED_STATUSES = ['OPEN', 'TRIAGED', 'DIRECTION_CREATED', 'IN_PROGRESS', 'VERIFIED_RESOLVED', 'PARTIALLY_RESOLVED', 'REJECTED', 'OBSOLETE'];

function clone(value) {
  return JSON.parse(stableStringify(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  return Growth.sha256(value);
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function exactTimestamp(value, label) {
  if (value == null || value === '') throw new Error(label + ' is required');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(label + ' must be a valid timestamp');
  return date.toISOString();
}

function exactDigest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' must be a SHA-256 digest');
  return result;
}

function normalizeReference(input, label) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' reference is required');
  return {
    id: requiredText(input.id, label + ' id', 180),
    schema: requiredText(input.schema, label + ' schema', 180),
    sha256: exactDigest(input.sha256, label + ' sha256')
  };
}

function uniqueStrings(values, label, allowed, allowEmpty) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  const result = values.map((value, index) => requiredText(value, label + '[' + index + ']', 1200));
  if (!allowEmpty && !result.length) throw new Error(label + ' needs at least one entry');
  if (new Set(result).size !== result.length) throw new Error(label + ' must be unique');
  if (allowed && result.some((value) => !allowed.includes(value))) throw new Error(label + ' contains an unsupported value');
  return result;
}

function slug(value) {
  let result = String(value || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+/, '').replace(/-+/g, '-').replace(/[-._]+$/, '');
  if (result.length < 3) result = (result + '-id').slice(0, 3);
  return result;
}

function geiId(kind, value) {
  let suffix = slug(value);
  if (suffix.length > 128) suffix = suffix.slice(0, 111).replace(/[-._]+$/, '') + '-' + sha256(value).slice(7, 23);
  const result = 'axm:' + kind + ':' + suffix;
  if (!GEI_ID.test(result)) throw new Error('could not construct a valid GEI id for ' + kind);
  return result;
}

function scopeId(capabilityId) {
  return geiId('capability', capabilityId);
}

function baseNeedId(capabilityId, needCode) {
  return geiId('need', 'grounded-' + capabilityId + '-' + needCode);
}

function reopenNeedId(capabilityId, needCode, receiptDigest) {
  return geiId('need', 'grounded-' + capabilityId + '-' + needCode + '-reopened-' + receiptDigest.slice(7, 19));
}

function normalizeNeed(input, index) {
  const label = 'existingNeeds[' + index + ']';
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' must be an object');
  const extra = Object.keys(input).filter((key) => !NEED_KEYS.includes(key));
  const missing = NEED_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(input, key));
  if (extra.length) throw new Error(label + ' has unsupported fields: ' + extra.join(', '));
  if (missing.length) throw new Error(label + ' is missing fields: ' + missing.join(', '));
  if (!GEI_ID.test(String(input.need_id || '')) || !String(input.need_id).startsWith('axm:need:')) throw new Error(label + ' need_id is invalid');
  if (input.contract_version !== GEI_VERSION) throw new Error(label + ' contract_version mismatch');
  const idArray = (value, name) => {
    const items = uniqueStrings(value, label + ' ' + name, null, true);
    if (items.some((item) => !GEI_ID.test(item))) throw new Error(label + ' ' + name + ' contains an invalid GEI id');
    return items;
  };
  const bounded = (value, name) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(label + ' ' + name + ' must be between 0 and 1');
    return value;
  };
  if (!TRUTH_STATES.includes(input.truth_state)) throw new Error(label + ' truth_state is unsupported');
  if (!NEED_STATUSES.includes(input.status)) throw new Error(label + ' status is unsupported');
  return {
    need_id: input.need_id,
    contract_version: GEI_VERSION,
    affected_scope: idArray(input.affected_scope, 'affected_scope'),
    observed_problem: requiredText(input.observed_problem, label + ' observed_problem', 4000),
    evidence: idArray(input.evidence, 'evidence'),
    desired_outcome: requiredText(input.desired_outcome, label + ' desired_outcome', 4000),
    improvement_dimensions: uniqueStrings(input.improvement_dimensions, label + ' improvement_dimensions', DIMENSIONS, false),
    severity: bounded(input.severity, 'severity'),
    ecosystem_reach: bounded(input.ecosystem_reach, 'ecosystem_reach'),
    blocked_work: idArray(input.blocked_work, 'blocked_work'),
    possible_responses: uniqueStrings(input.possible_responses, label + ' possible_responses', RESPONSES, false),
    required_knowledge: uniqueStrings(input.required_knowledge, label + ' required_knowledge', null, true),
    verification_method: requiredText(input.verification_method, label + ' verification_method', 4000),
    confidence: bounded(input.confidence, 'confidence'),
    truth_state: input.truth_state,
    status: input.status,
    assigned_direction_ids: idArray(input.assigned_direction_ids, 'assigned_direction_ids')
  };
}

function normalizeExistingNeeds(values) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error('existingNeeds must be an array');
  if (values.length > 512) throw new Error('existingNeeds exceeds 512 entries');
  const result = values.map(normalizeNeed).sort((a, b) => a.need_id.localeCompare(b.need_id));
  if (new Set(result.map((need) => need.need_id)).size !== result.length) throw new Error('existing need ids must be unique');
  return result;
}

function normalizeRouteStates(values) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error('routeStates must be an array');
  if (values.length > 128) throw new Error('routeStates exceeds 128 entries');
  const result = values.map((input, index) => {
    const label = 'routeStates[' + index + ']';
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' must be an object');
    const state = String(input.state || '').toUpperCase();
    const needCode = String(input.needCode || '').toUpperCase();
    if (!ROUTE_STATES.includes(state)) throw new Error(label + ' state is unsupported');
    if (!NEED_CODES.includes(needCode)) throw new Error(label + ' needCode is unsupported');
    const evidenceRef = input.evidenceRef ? normalizeReference(input.evidenceRef, label + ' evidence') : null;
    if (!evidenceRef && !['UNADDRESSED', 'NOT_APPLICABLE'].includes(state)) throw new Error(label + ' requires an evidenceRef for ' + state);
    return {
      capabilityId: requiredText(input.capabilityId, label + ' capabilityId', 180),
      needCode,
      state,
      evidenceRef,
      detail: input.detail == null ? null : requiredText(input.detail, label + ' detail', 1200)
    };
  }).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId) || a.needCode.localeCompare(b.needCode));
  const keys = result.map((item) => item.capabilityId + '\0' + item.needCode);
  if (new Set(keys).size !== keys.length) throw new Error('routeStates capabilityId and needCode pairs must be unique');
  return result;
}

function normalizeCoverageLinks(values, existingById) {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error('coverageLinks must be an array');
  if (values.length > 128) throw new Error('coverageLinks exceeds 128 entries');
  const result = values.map((input, index) => {
    const label = 'coverageLinks[' + index + ']';
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(label + ' must be an object');
    const needId = requiredText(input.needId, label + ' needId', 180);
    if (!existingById.has(needId)) throw new Error(label + ' needId is not present in existingNeeds');
    const needCode = String(input.needCode || '').toUpperCase();
    if (!NEED_CODES.includes(needCode)) throw new Error(label + ' needCode is unsupported');
    return {
      needId,
      capabilityId: requiredText(input.capabilityId, label + ' capabilityId', 180),
      needCode,
      linkRef: normalizeReference(input.linkRef, label + ' link')
    };
  }).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId) || a.needCode.localeCompare(b.needCode) || a.needId.localeCompare(b.needId));
  const keys = result.map((item) => item.capabilityId + '\0' + item.needCode);
  if (new Set(keys).size !== keys.length) throw new Error('coverageLinks capabilityId and needCode pairs must be unique');
  return result;
}

function normalizeSource(receipt) {
  const copied = clone(receipt);
  if (!copied || typeof copied !== 'object') throw new Error('sourceReceipt is required');
  if (copied.schema === Growth.OUTCOME_SCHEMA) {
    const checked = Growth.verifyOutcome(copied);
    if (!checked.pass) throw new Error('source outcome is invalid: ' + checked.errors.join('; '));
    return { kind: 'OUTCOME', receipt: copied };
  }
  if (copied.schema === Growth.PORTFOLIO_SCHEMA) {
    const checked = Growth.verifyPortfolio(copied);
    if (!checked.pass) throw new Error('source portfolio is invalid: ' + checked.errors.join('; '));
    return { kind: 'PORTFOLIO', receipt: copied };
  }
  throw new Error('sourceReceipt schema is unsupported');
}

function effectiveOutcomes(source) {
  if (source.kind === 'OUTCOME') return source.receipt.noNewInformation ? [] : [source.receipt];
  const byId = new Map(source.receipt.outcomes.map((outcome) => [outcome.outcomeId, outcome]));
  return source.receipt.latest.map((entry) => {
    const outcome = byId.get(entry.effectiveOutcomeId);
    if (!outcome || outcome.receiptDigest !== entry.effectiveReceiptDigest) throw new Error('portfolio effective outcome lookup mismatch');
    return outcome;
  }).sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
}

function outcomeEvidence(outcome) {
  const id = geiId('evidence', 'grounded-outcome-' + outcome.receiptDigest.slice(7, 31));
  return {
    evidence_id: id,
    contract_version: GEI_VERSION,
    source_type: 'OTHER',
    source_location: 'receipt:' + outcome.schema + '/' + outcome.outcomeId,
    source_hash: outcome.receiptDigest,
    captured_at: outcome.generatedAt,
    extraction_method: 'NATIVE_GROUNDED_GROWTH_VERIFY',
    relevant_scope: [scopeId(outcome.capabilityId)],
    supports_claims: [
      'Grounded Growth outcome state ' + outcome.state + ' was deterministically verified.',
      'Next evidence needs were derived by the native outcome contract.'
    ],
    truth_state: 'OBSERVED',
    confidence: 1,
    limitations: [
      'Receipt integrity proves the bounded outcome state, not beneficiary success beyond admitted evidence.',
      'This record grants no execution, install, promotion, merge, CANON, Foundation, or model-training authority.'
    ],
    immutable_source_excerpt: null,
    metadata: {
      outcome_id: outcome.outcomeId,
      capability_id: outcome.capabilityId,
      outcome_state: outcome.state,
      next_evidence_needs: outcome.nextEvidenceNeeds.slice()
    }
  };
}

function routeEvidence(route, capturedAt) {
  if (!route.evidenceRef) return null;
  return {
    evidence_id: geiId('evidence', 'growth-route-' + route.evidenceRef.sha256.slice(7, 31)),
    contract_version: GEI_VERSION,
    source_type: 'OTHER',
    source_location: 'ref:' + route.evidenceRef.schema + '/' + route.evidenceRef.id,
    source_hash: route.evidenceRef.sha256,
    captured_at: capturedAt,
    extraction_method: 'EXACT_REFERENCE_DECLARED_BY_CALLER',
    relevant_scope: [scopeId(route.capabilityId)],
    supports_claims: ['Caller declared route state ' + route.state + ' for ' + route.needCode + '.'],
    truth_state: 'DECLARED',
    confidence: 0.6,
    limitations: [
      'The adapter binds this exact reference but does not fetch, authenticate, or independently verify its bytes.',
      'A declared route state cannot override a contradictory verified Grounded Growth outcome.'
    ],
    immutable_source_excerpt: null,
    metadata: {
      capability_id: route.capabilityId,
      need_code: route.needCode,
      route_state: route.state,
      detail: route.detail
    }
  };
}

function requestsForOutcome(outcome) {
  if (outcome.state === 'NO_NEW_INFORMATION') return [];
  if (outcome.state === 'EVIDENCE_HOLD') return [{ code: 'REPAIR_EVIDENCE_ROUTE' }];
  if (outcome.state === 'REGRESSION_HOLD') {
    return [{
      code: 'REPAIR_BENEFICIARY_REGRESSION',
      beneficiaries: outcome.claims.filter((claim) => claim.admittedVerdict === 'FAIL').map((claim) => claim.beneficiary).sort()
    }];
  }
  if (outcome.state === 'REFRESH_REQUIRED') return [{ code: 'REFRESH_CHANGED_BASELINE_OR_EVIDENCE' }];
  if (outcome.state === 'CYCLE_HOLD') return [{ code: 'RESOLVE_CAPABILITY_CYCLE_HOLD' }];
  return outcome.nextEvidenceNeeds.filter((code) => NEED_CODES.includes(code)).map((code) => ({ code }));
}

function needProfile(request, outcome, route) {
  const code = request.code;
  const profiles = {
    HUMAN_BENEFIT_NATIVE_EVIDENCE: {
      problem: 'Verified Grounded Growth evidence has not established a human beneficiary outcome for this capability.',
      desired: 'A voluntary, scope-matched human-native outcome is either evidenced or honestly remains not run.',
      dimensions: ['HUMAN_ACCESSIBILITY', 'USEFULNESS', 'PROOF_MATURITY'],
      responses: ['WAIT_FOR_EVIDENCE'],
      knowledge: ['Consent-aware human outcome protocol', 'Capability-scoped human evidence'],
      verification: 'Use a native human-benefit route with explicit consent, completion or withdrawal, exact scope, current closure, and a final human judgment.',
      severity: 0.55
    },
    AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE: {
      problem: 'Verified Grounded Growth evidence has not established an AI-workflow beneficiary outcome for this capability.',
      desired: 'A representative AI workflow demonstrates a bounded outcome against an explicit baseline.',
      dimensions: ['AI_ACCESSIBILITY', 'TESTABILITY', 'PROOF_MATURITY'],
      responses: ['TEST'],
      knowledge: ['Representative AI workflow', 'Held-out or workflow-specific evaluation'],
      verification: 'Run a representative AI workflow or held-out evaluation with baseline, outcome, exact evidence references, and current closure.',
      severity: 0.55
    },
    REPAIR_EVIDENCE_ROUTE: {
      problem: 'A claimed beneficiary outcome failed the native evidence-route admission checks.',
      desired: 'The evidence route is repaired or the unsupported claim remains held without substitution.',
      dimensions: ['RELIABILITY', 'TESTABILITY', 'PROOF_MATURITY'],
      responses: ['REPAIR', 'TEST'],
      knowledge: ['Claim-to-proof routing', 'Evidence closure ancestry'],
      verification: 'Repair the exact route reasons, rebuild the native outcome receipt, and verify that the claim is admitted without changing its meaning.',
      severity: 0.8
    },
    REFRESH_CHANGED_BASELINE_OR_EVIDENCE: {
      problem: 'The verified capability baseline or relevant evidence changed after the beneficiary outcome was assessed.',
      desired: 'Beneficiary outcomes are re-evaluated against the current capability and evidence state.',
      dimensions: ['RELIABILITY', 'TESTABILITY', 'PROOF_MATURITY'],
      responses: ['TEST'],
      knowledge: ['Current capability baseline', 'Changed evidence inventory'],
      verification: 'Rebuild and verify the capability cycle and beneficiary outcome with current baseline and evidence references.',
      severity: 0.65
    },
    REPAIR_BENEFICIARY_REGRESSION: {
      problem: 'Native beneficiary evidence admitted a FAIL for ' + ((request.beneficiaries || []).join(', ') || 'a beneficiary') + '.',
      desired: 'The regression is repaired and re-tested, or the capability remains held with the failure preserved.',
      dimensions: ['SAFETY', 'RELIABILITY', 'USEFULNESS', 'PROOF_MATURITY'],
      responses: ['REPAIR', 'TEST'],
      knowledge: ['Admitted failing beneficiary evidence', 'Regression reproduction path'],
      verification: 'Reproduce the admitted failure, repair without erasing it, and rerun the same beneficiary-native evaluation against the same declared scope.',
      severity: 0.9
    },
    RESOLVE_CAPABILITY_CYCLE_HOLD: {
      problem: 'The verified capability cycle is held, so downstream beneficiary testing would be premature.',
      desired: 'The capability cycle is explicitly repaired, rejected, or returned to a verifiable state before beneficiary testing.',
      dimensions: ['RELIABILITY', 'TESTABILITY', 'PROOF_MATURITY'],
      responses: ['REPAIR', 'WAIT_FOR_EVIDENCE'],
      knowledge: ['Verified capability cycle hold reason'],
      verification: 'Resolve the native cycle hold through its explicit steward and verification gates before creating a new beneficiary outcome.',
      severity: 0.75
    }
  };
  const profile = clone(profiles[code]);
  if (!profile) throw new Error('no need profile exists for ' + code);
  if (route && route.state === 'READY_FOR_VOLUNTARY_INPUT') {
    if (code !== 'HUMAN_BENEFIT_NATIVE_EVIDENCE') throw new Error('READY_FOR_VOLUNTARY_INPUT is only valid for human-native evidence');
    profile.problem += ' A referenced voluntary route is ready, but participation has not occurred.';
    profile.desired = 'If a person independently opts in, preserve completion or withdrawal without urgency, penalty, or a manufactured benefit claim.';
    profile.responses = ['WAIT_FOR_EVIDENCE'];
    profile.verification = 'Wait without prompting pressure. If a person independently opts in, preserve consent, completion or withdrawal, exact scope, current closure, and the final human judgment.';
  }
  if (route && route.state === 'READY_FOR_EVALUATION') profile.responses = ['TEST'];
  if (route && route.state === 'BLOCKED') {
    profile.problem += ' The referenced route is declared blocked.';
    profile.responses = Array.from(new Set([...profile.responses, 'RESEARCH']));
    profile.severity = Math.min(0.95, profile.severity + 0.1);
  }
  return profile;
}

function makeNeed(request, outcome, route, evidenceIds, conflicted) {
  const profile = needProfile(request, outcome, route);
  return {
    need_id: conflicted ? reopenNeedId(outcome.capabilityId, request.code, outcome.receiptDigest) : baseNeedId(outcome.capabilityId, request.code),
    contract_version: GEI_VERSION,
    affected_scope: [scopeId(outcome.capabilityId)],
    observed_problem: profile.problem,
    evidence: evidenceIds,
    desired_outcome: profile.desired,
    improvement_dimensions: profile.dimensions,
    severity: profile.severity,
    ecosystem_reach: 0.4,
    blocked_work: [],
    possible_responses: profile.responses,
    required_knowledge: profile.knowledge,
    verification_method: profile.verification,
    confidence: conflicted ? 0.72 : (route && route.state !== 'UNADDRESSED' ? 0.82 : 0.95),
    truth_state: conflicted ? 'CONFLICTED' : 'OBSERVED',
    status: 'OPEN',
    assigned_direction_ids: []
  };
}

function key(capabilityId, needCode) {
  return capabilityId + '\0' + needCode;
}

function buildPacket(input) {
  input = input || {};
  const source = normalizeSource(input.sourceReceipt);
  const outcomes = effectiveOutcomes(source);
  const sourceCapabilities = new Set(outcomes.map((outcome) => outcome.capabilityId));
  const existingNeeds = normalizeExistingNeeds(input.existingNeeds || []);
  const existingById = new Map(existingNeeds.map((need) => [need.need_id, need]));
  const routeStates = normalizeRouteStates(input.routeStates || []);
  const coverageLinks = normalizeCoverageLinks(input.coverageLinks || [], existingById);
  routeStates.forEach((route) => {
    if (!sourceCapabilities.has(route.capabilityId)) throw new Error('route state scope is not present in the effective source outcomes: ' + route.capabilityId);
  });
  coverageLinks.forEach((link) => {
    if (!sourceCapabilities.has(link.capabilityId)) throw new Error('coverage link scope is not present in the effective source outcomes: ' + link.capabilityId);
  });
  const routeByKey = new Map(routeStates.map((route) => [key(route.capabilityId, route.needCode), route]));
  const coverageByKey = new Map(coverageLinks.map((link) => [key(link.capabilityId, link.needCode), link]));
  const generatedAt = exactTimestamp(input.generatedAt, 'generatedAt');
  const evidenceRecords = [];
  const evidenceById = new Map();
  const addEvidence = (record) => {
    if (!record) return;
    const prior = evidenceById.get(record.evidence_id);
    if (prior && stableStringify(prior) !== stableStringify(record)) throw new Error('evidence id collision: ' + record.evidence_id);
    if (!prior) {
      evidenceById.set(record.evidence_id, record);
      evidenceRecords.push(record);
    }
  };
  routeStates.forEach((route) => addEvidence(routeEvidence(route, generatedAt)));
  const candidateNeeds = [];
  const suppressed = [];
  const conflicts = [];

  for (const outcome of outcomes) {
    const outcomeRecord = outcomeEvidence(outcome);
    addEvidence(outcomeRecord);
    const requests = requestsForOutcome(outcome);
    for (const originalRequest of requests) {
      let request = originalRequest;
      let route = routeByKey.get(key(outcome.capabilityId, request.code)) || null;
      if (route && route.state === 'SATISFIED' && request.code !== 'REFRESH_CHANGED_BASELINE_OR_EVIDENCE') {
        conflicts.push({
          capabilityId: outcome.capabilityId,
          needCode: request.code,
          kind: 'ROUTE_SATISFIED_OUTCOME_STILL_OPEN',
          existingNeedId: null,
          detail: 'The declared route is satisfied, but the verified source outcome still requests it; refresh is required before claiming closure.'
        });
        request = { code: 'REFRESH_CHANGED_BASELINE_OR_EVIDENCE' };
        route = routeByKey.get(key(outcome.capabilityId, request.code)) || null;
      }
      if (route && route.state === 'IN_PROGRESS') {
        suppressed.push({
          capabilityId: outcome.capabilityId,
          needCode: request.code,
          reason: 'DIGEST_BOUND_ROUTE_DECLARED_IN_PROGRESS',
          existingNeedId: null
        });
        continue;
      }
      if (route && route.state === 'NOT_APPLICABLE') {
        suppressed.push({
          capabilityId: outcome.capabilityId,
          needCode: request.code,
          reason: 'DIGEST_BOUND_ROUTE_DECLARED_NOT_APPLICABLE',
          existingNeedId: null
        });
        continue;
      }
      const baseId = baseNeedId(outcome.capabilityId, request.code);
      const exactExisting = existingById.get(baseId) || null;
      const coverage = coverageByKey.get(key(outcome.capabilityId, request.code)) || null;
      const coveredExisting = coverage ? existingById.get(coverage.needId) : null;
      const prior = exactExisting || coveredExisting;
      if (prior && ACTIVE_NEED_STATUSES.includes(prior.status)) {
        suppressed.push({
          capabilityId: outcome.capabilityId,
          needCode: request.code,
          reason: exactExisting ? 'EXACT_ACTIVE_NEED_EXISTS' : 'EXPLICIT_ACTIVE_NEED_COVERAGE_LINK',
          existingNeedId: prior.need_id
        });
        continue;
      }
      const conflicted = Boolean(prior);
      if (prior) {
        conflicts.push({
          capabilityId: outcome.capabilityId,
          needCode: request.code,
          kind: 'CLOSED_OR_INACTIVE_NEED_CONFLICTS_WITH_VERIFIED_OUTCOME',
          existingNeedId: prior.need_id,
          detail: 'The existing need is ' + prior.status + ', while the verified outcome still requires this route; the conflict is preserved as a re-open candidate.'
        });
      }
      const routeRecord = route ? routeEvidence(route, generatedAt) : null;
      addEvidence(routeRecord);
      const evidenceIds = [outcomeRecord.evidence_id, ...(routeRecord ? [routeRecord.evidence_id] : [])];
      candidateNeeds.push(makeNeed(request, outcome, route, evidenceIds, conflicted));
    }
  }

  candidateNeeds.sort((a, b) => a.need_id.localeCompare(b.need_id));
  suppressed.sort((a, b) => a.capabilityId.localeCompare(b.capabilityId) || a.needCode.localeCompare(b.needCode));
  conflicts.sort((a, b) => a.capabilityId.localeCompare(b.capabilityId) || a.needCode.localeCompare(b.needCode));
  evidenceRecords.sort((a, b) => a.evidence_id.localeCompare(b.evidence_id));
  if (new Set(candidateNeeds.map((need) => need.need_id)).size !== candidateNeeds.length) throw new Error('candidate need ids must be unique');

  const packet = {
    schema: PACKET_SCHEMA,
    version: VERSION,
    packetId: requiredText(input.packetId, 'packetId', 180),
    generatedAt,
    status: 'TEST',
    source,
    routeStates,
    existingNeeds,
    coverageLinks,
    evidenceRecords,
    candidateNeeds,
    suppressed,
    conflicts,
    summary: {
      effectiveOutcomeCount: outcomes.length,
      evidenceRecordCount: evidenceRecords.length,
      candidateNeedCount: candidateNeeds.length,
      suppressedCount: suppressed.length,
      conflictCount: conflicts.length,
      directionCount: 0
    },
    truth: {
      sourceVerifiedNatively: true,
      routeStateIsCallerDeclaration: true,
      routeReferenceFetchedOrAuthenticated: false,
      holdOrderingEnforced: true,
      noNewInformationCreatesNeed: false,
      humanParticipationMayBeRequired: false,
      voluntaryCompletionOrWithdrawalPreserved: true,
      evolutionDirectionCreated: false,
      registryWritten: false,
      automaticExecution: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false
    },
    packetDigest: null
  };
  const digestPayload = clone(packet);
  delete digestPayload.packetDigest;
  packet.packetDigest = sha256(digestPayload);
  return packet;
}

function verifyPacket(packet) {
  const errors = [];
  if (!packet || packet.schema !== PACKET_SCHEMA) return { pass: false, errors: ['feedback packet schema mismatch'] };
  if (packet.version !== VERSION) errors.push('feedback packet version mismatch');
  let rebuilt = null;
  try {
    rebuilt = buildPacket({
      packetId: packet.packetId,
      generatedAt: packet.generatedAt,
      sourceReceipt: packet.source && packet.source.receipt,
      routeStates: packet.routeStates,
      existingNeeds: packet.existingNeeds,
      coverageLinks: packet.coverageLinks
    });
  } catch (error) {
    errors.push('feedback packet content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(packet)) errors.push('feedback packet content or derived feedback mismatch');
    if (rebuilt.packetDigest !== packet.packetDigest) errors.push('feedback packet digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  PACKET_SCHEMA,
  VERSION,
  GEI_VERSION,
  ROUTE_STATES,
  NEED_CODES,
  stableStringify,
  sha256,
  geiId,
  baseNeedId,
  buildPacket,
  verifyPacket
};
