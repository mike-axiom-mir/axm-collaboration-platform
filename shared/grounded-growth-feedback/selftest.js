#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');
const Feedback = require('./grounded-growth-feedback');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

const at = '2026-08-19T07:00:00.000Z';
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'grounded-growth-feedback-packet.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
check(schema.$id === Feedback.PACKET_SCHEMA, 'feedback packet schema identity matches the implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module contract stays TEST with no permissions or writes');
check(contract.boundaries.refuses.includes('evolution-direction-creation') && contract.boundaries.refuses.includes('automatic-canon'), 'module contract refuses direction creation and automatic CANON');

function ref(id, value, schemaName) {
  return Growth.reference(value, { id, schema: schemaName || 'axm.test-evidence/v1' });
}

function availableCycle(refreshDue) {
  const candidateRef = Loop.reference({ candidate: 'feedback selftest' }, { id: 'candidate-feedback', schema: 'text/javascript' });
  return Loop.build({
    cycleId: 'cycle-feedback',
    capabilityId: 'growth.feedback-fixture/v1',
    generatedAt: at,
    baseline: {
      kind: 'git-and-worktree',
      identity: 'bounded feedback selftest fixture',
      receiptRef: Loop.reference({ baseline: 'fixture' }, { id: 'baseline-feedback', schema: 'axm.baseline-observation/v1' })
    },
    need: {
      id: 'need-feedback',
      statement: 'Outcome needs must become bounded attention without autonomous action.',
      sourceRef: Loop.reference({ need: 'feedback' }, { id: 'need-feedback-source', schema: 'axm.workshop-need/v1' })
    },
    gap: {
      state: 'OPEN',
      reason: 'No grounded feedback adapter existed.',
      reportRef: Loop.reference({ missing: 'feedback' }, { id: 'gap-feedback', schema: 'axm.capability-gap-report/v1' })
    },
    provenance: [Loop.reference({ source: 'selftest' }, { id: 'provenance-feedback', schema: 'axm.source-provenance/v1' })],
    candidate: {
      strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
      sourceMutationPerformed: true, installed: false, promoted: false, canon: false
    },
    verification: {
      verdict: 'PASS', subjectDigest: candidateRef.sha256,
      receiptRef: Loop.reference({ checks: 'fixture', result: 'PASS' }, { id: 'verification-feedback', schema: 'axm.focused-test-receipt/v1' }),
      evidenceAuthority: 'MIXED', limitations: ['Synthetic fixture proves contract behavior only.']
    },
    decision: {
      verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'fixture-steward', candidateDigest: candidateRef.sha256,
      confirmation: 'CONTINUE VERIFIED CAPABILITY',
      decisionRef: Loop.reference({ verdict: 'CONTINUE', candidate: candidateRef.sha256 }, { id: 'decision-feedback', schema: 'axm.review-decision/v1' })
    },
    availability: {
      status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId: 'fixture-availability',
      receiptRef: Loop.reference({ available: candidateRef.sha256 }, { id: 'availability-feedback', schema: 'axm.module-availability-receipt/v1' })
    },
    refresh: {
      trigger: 'NEW_INFORMATION', checkedAt: at, due: refreshDue === true,
      reason: refreshDue ? 'Fixture evidence changed.' : 'Fixture evidence is current.'
    }
  });
}

function heldCycle() {
  const available = availableCycle(false);
  return Loop.build({
    cycleId: available.cycleId,
    capabilityId: available.capabilityId,
    generatedAt: available.generatedAt,
    baseline: available.baseline,
    need: available.need,
    gap: available.gap,
    provenance: available.provenance,
    candidate: available.candidate,
    verification: available.verification,
    decision: {
      verdict: 'HOLD', actorKind: 'HUMAN', actorId: 'fixture-steward', candidateDigest: available.candidate.artifactRef.sha256,
      confirmation: 'HOLD VERIFIED CAPABILITY',
      decisionRef: Loop.reference({ verdict: 'HOLD' }, { id: 'hold-feedback', schema: 'axm.review-decision/v1' })
    },
    availability: null,
    refresh: available.refresh
  });
}

function closure(state) {
  const covered = [
    ref('baseline-claim', { before: true }).sha256,
    ref('outcome-claim', { after: true }).sha256,
    ref('evidence-claim', { evidence: true }).sha256
  ];
  return {
    state: state || 'CURRENT', checkedAt: at,
    receiptRef: ref('closure-claim', { state: state || 'CURRENT', covered }, 'axm.evidence-closure-receipt/v1'),
    coveredDigests: covered
  };
}

function claim(input) {
  return Object.assign({
    id: 'claim-' + String(input.beneficiary || 'system').toLowerCase(),
    statement: 'The declared beneficiary completed the representative fixture workflow.',
    kind: 'WORKFLOW_OUTCOME', verdict: 'PASS',
    baselineRef: ref('baseline-claim', { before: true }),
    outcomeRef: ref('outcome-claim', { after: true }),
    evidenceRefs: [ref('evidence-claim', { evidence: true })],
    evidenceClosure: closure('CURRENT'),
    limitations: ['Synthetic fixture proves feedback routing only.']
  }, input);
}

function outcome(extra) {
  return Growth.buildOutcome(Object.assign({
    outcomeId: 'feedback-outcome-1', generatedAt: at,
    cycleReceipt: availableCycle(false),
    informationRefs: [ref('information-feedback', { signal: 'new' })],
    claims: [],
    refresh: { checkedAt: at, due: false, reason: 'Fixture evidence is current.' }
  }, extra || {}));
}

function packet(sourceReceipt, extra) {
  return Feedback.buildPacket(Object.assign({
    packetId: 'feedback-packet-1', generatedAt: '2026-08-19T07:01:00.000Z',
    sourceReceipt, routeStates: [], existingNeeds: [], coverageLinks: []
  }, extra || {}));
}

const unknown = outcome();
const basic = packet(unknown);
check(basic.candidateNeeds.length === 2, 'unknown beneficiary effects produce one human and one AI feedback need');
check(basic.summary.directionCount === 0 && basic.candidateNeeds.every((need) => need.assigned_direction_ids.length === 0), 'feedback emits no evolution direction');
check(basic.evidenceRecords.some((record) => record.source_hash === unknown.receiptDigest && record.truth_state === 'OBSERVED'), 'native outcome becomes a GEI-compatible observed evidence record');
check(Feedback.verifyPacket(basic).pass, 'fresh feedback packet verifies deterministically');

const humanRouteRef = ref('voluntary-human-route', { state: 'WAITING_FOR_LIVE_HUMAN_EVIDENCE' }, 'axm.human-route-readiness/v1');
const voluntary = packet(unknown, {
  routeStates: [{
    capabilityId: unknown.capabilityId,
    needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE',
    state: 'READY_FOR_VOLUNTARY_INPUT', evidenceRef: humanRouteRef,
    detail: 'A person may independently opt in, complete, or withdraw.'
  }]
});
const humanNeed = voluntary.candidateNeeds.find((need) => need.improvement_dimensions.includes('HUMAN_ACCESSIBILITY'));
check(humanNeed.possible_responses.length === 1 && humanNeed.possible_responses[0] === 'WAIT_FOR_EVIDENCE', 'voluntary human route can only wait for evidence');
check(/withdrawal/.test(humanNeed.desired_outcome) && /without prompting pressure/.test(humanNeed.verification_method), 'voluntary route preserves withdrawal and refuses prompting pressure');
check(voluntary.evidenceRecords.some((record) => record.source_hash === humanRouteRef.sha256 && record.truth_state === 'DECLARED'), 'route readiness is digest-bound and remains DECLARED');

const aiReady = packet(unknown, {
  routeStates: [{ capabilityId: unknown.capabilityId, needCode: 'AI_WORKFLOW_BENEFIT_NATIVE_EVIDENCE', state: 'READY_FOR_EVALUATION', evidenceRef: ref('ai-ready', { ready: true }) }]
});
const aiNeed = aiReady.candidateNeeds.find((need) => need.improvement_dimensions.includes('AI_ACCESSIBILITY'));
check(aiNeed.possible_responses.length === 1 && aiNeed.possible_responses[0] === 'TEST', 'ready AI route becomes a bounded TEST candidate');

const evidenceHold = outcome({ claims: [claim({ beneficiary: 'HUMAN', proofSurface: 'FOCUSED_RUNTIME' })] });
const evidenceHoldPacket = packet(evidenceHold);
check(evidenceHold.state === 'EVIDENCE_HOLD' && evidenceHoldPacket.candidateNeeds.length === 1, 'evidence hold produces exactly one first-order need');
check(evidenceHoldPacket.candidateNeeds[0].possible_responses.includes('REPAIR') && evidenceHoldPacket.candidateNeeds[0].need_id.includes('repair_evidence_route'), 'evidence repair precedes beneficiary testing');

const regression = outcome({ claims: [claim({ beneficiary: 'AI_WORKFLOW', proofSurface: 'AI_WORKFLOW_EVALUATION', verdict: 'FAIL' })] });
const regressionPacket = packet(regression);
check(regression.state === 'REGRESSION_HOLD' && regressionPacket.candidateNeeds.length === 1, 'admitted beneficiary FAIL produces one regression need');
check(/admitted a FAIL/.test(regressionPacket.candidateNeeds[0].observed_problem) && !/has not established/.test(regressionPacket.candidateNeeds[0].observed_problem), 'regression remains a failure and is not rewritten as missing evidence');

const refresh = outcome({ cycleReceipt: availableCycle(true) });
const refreshPacket = packet(refresh);
check(refresh.state === 'REFRESH_REQUIRED' && refreshPacket.candidateNeeds.length === 1 && refreshPacket.candidateNeeds[0].possible_responses[0] === 'TEST', 'refresh need precedes downstream beneficiary tests');

const cycleHold = outcome({ cycleReceipt: heldCycle() });
const cycleHoldPacket = packet(cycleHold);
check(cycleHold.state === 'CYCLE_HOLD' && cycleHoldPacket.candidateNeeds.length === 1, 'cycle hold produces one lifecycle-resolution need');
check(/before creating a new beneficiary outcome/.test(cycleHoldPacket.candidateNeeds[0].verification_method), 'cycle hold explicitly blocks premature beneficiary testing');

const noNew = outcome({
  outcomeId: 'feedback-outcome-2', generatedAt: '2026-08-19T07:02:00.000Z',
  previousOutcomeRef: { id: unknown.outcomeId, schema: Growth.OUTCOME_SCHEMA, sha256: unknown.receiptDigest },
  noNewInformation: true, informationRefs: [], claims: []
});
const noNewPacket = packet(noNew);
check(noNewPacket.candidateNeeds.length === 0 && noNewPacket.evidenceRecords.length === 0, 'standalone no-new-information creates no new evidence or need');

const portfolio = Growth.buildPortfolio({
  portfolioId: 'feedback-portfolio', generatedAt: '2026-08-19T07:03:00.000Z', outcomes: [unknown, noNew]
});
const portfolioPacket = packet(portfolio);
check(portfolioPacket.summary.effectiveOutcomeCount === 1 && portfolioPacket.candidateNeeds.length === 2, 'portfolio follows the effective substantive outcome without double-counting no-new generations');

const exactExisting = clone(basic.candidateNeeds[0]);
exactExisting.status = 'OPEN';
const exactDedup = packet(unknown, { existingNeeds: [exactExisting] });
check(exactDedup.candidateNeeds.length === 1 && exactDedup.suppressed.some((item) => item.reason === 'EXACT_ACTIVE_NEED_EXISTS'), 'exact active GEI need suppresses duplicate feedback');

const coveredExisting = clone(basic.candidateNeeds[0]);
coveredExisting.need_id = 'axm:need:explicit-human-coverage-fixture';
coveredExisting.status = 'TRIAGED';
const coverageDedup = packet(unknown, {
  existingNeeds: [coveredExisting],
  coverageLinks: [{
    needId: coveredExisting.need_id, capabilityId: unknown.capabilityId,
    needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE',
    linkRef: ref('coverage-review', { exactCoverage: true }, 'axm.need-coverage-review/v1')
  }]
});
check(coverageDedup.suppressed.some((item) => item.reason === 'EXPLICIT_ACTIVE_NEED_COVERAGE_LINK'), 'explicit digest-bound coverage link suppresses a semantic duplicate');

const resolvedExisting = clone(basic.candidateNeeds.find((need) => need.improvement_dimensions.includes('HUMAN_ACCESSIBILITY')));
resolvedExisting.status = 'VERIFIED_RESOLVED';
const reopen = packet(unknown, { existingNeeds: [resolvedExisting] });
const reopenedNeed = reopen.candidateNeeds.find((need) => need.truth_state === 'CONFLICTED');
check(reopen.conflicts.length === 1 && reopenedNeed && reopenedNeed.need_id !== resolvedExisting.need_id, 'resolved need that conflicts with verified open outcome is preserved and re-opened');

const satisfied = packet(unknown, {
  routeStates: [{ capabilityId: unknown.capabilityId, needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE', state: 'SATISFIED', evidenceRef: ref('human-satisfied', { complete: true }) }]
});
check(satisfied.conflicts.some((item) => item.kind === 'ROUTE_SATISFIED_OUTCOME_STILL_OPEN'), 'declared satisfied route cannot silently override the verified outcome');
check(satisfied.candidateNeeds.some((need) => /changed after the beneficiary outcome/.test(need.observed_problem)), 'satisfied-but-stale route becomes a refresh candidate');

const inProgress = packet(unknown, {
  routeStates: [{ capabilityId: unknown.capabilityId, needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE', state: 'IN_PROGRESS', evidenceRef: ref('human-progress', { active: true }) }]
});
check(inProgress.suppressed.some((item) => item.reason === 'DIGEST_BOUND_ROUTE_DECLARED_IN_PROGRESS'), 'digest-bound in-progress route suppresses duplicate attention');

const tamperedOutcome = clone(unknown);
tamperedOutcome.state = 'GROUNDED_SHARED_GROWTH';
assert.throws(() => packet(tamperedOutcome), /source outcome is invalid/);
checks += 1; console.log('PASS tampered outcome is refused before feedback mapping');

const tamperedPacket = clone(voluntary);
tamperedPacket.candidateNeeds[0].possible_responses = ['BUILD'];
check(!Feedback.verifyPacket(tamperedPacket).pass, 'tampered derived feedback packet fails verification');

const repeated = packet(unknown);
check(Feedback.stableStringify(repeated) === Feedback.stableStringify(basic), 'same bounded inputs produce the same feedback packet');

assert.throws(() => packet(unknown, {
  routeStates: [{ capabilityId: 'foreign-capability/v1', needCode: 'HUMAN_BENEFIT_NATIVE_EVIDENCE', state: 'UNADDRESSED' }]
}), /scope is not present/);
checks += 1; console.log('PASS route state cannot expand beyond effective source capability scope');

const schemaSnapshotRoot = path.join(__dirname, 'schema-snapshots', 'gei-v0.1.0');
const needSchema = JSON.parse(fs.readFileSync(path.join(schemaSnapshotRoot, 'improvement_need.schema.json'), 'utf8'));
const evidenceSchema = JSON.parse(fs.readFileSync(path.join(schemaSnapshotRoot, 'evidence_record.schema.json'), 'utf8'));
const schemaSnapshotSource = JSON.parse(fs.readFileSync(path.join(schemaSnapshotRoot, 'SOURCE.json'), 'utf8'));
for (const snapshot of schemaSnapshotSource.snapshots) {
  const canonicalText = fs.readFileSync(path.join(schemaSnapshotRoot, snapshot.file), 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  assert.equal(Feedback.sha256(canonicalText), snapshot.canonicalSha256, snapshot.file + ' snapshot digest drifted');
}
const schemaErrors = [];
voluntary.candidateNeeds.forEach((value, index) => validateJson(value, needSchema, 'candidateNeeds[' + index + ']', schemaErrors));
voluntary.evidenceRecords.forEach((value, index) => validateJson(value, evidenceSchema, 'evidenceRecords[' + index + ']', schemaErrors));
check(schemaErrors.length === 0, 'candidate needs and evidence records validate against native GEI schemas: ' + schemaErrors.join('; '));

check(basic.truth.evolutionDirectionCreated === false && basic.truth.registryWritten === false && basic.truth.automaticExecution === false, 'packet truth grants no direction, registry, or execution authority');
check(basic.truth.automaticPromotion === false && basic.truth.automaticCanon === false && basic.truth.foundationMutation === false, 'packet truth grants no promotion, CANON, or Foundation authority');

console.log('\nGrounded Growth Feedback selftest: PASS (' + checks + ' checks)');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateJson(value, rule, location, errors) {
  if (!rule || typeof rule !== 'object') return;
  const kinds = Array.isArray(rule.type) ? rule.type : (rule.type ? [rule.type] : []);
  if (kinds.length && !kinds.some((kind) => matchesType(value, kind))) {
    errors.push(location + ' must be ' + kinds.join('|'));
    return;
  }
  if (Object.prototype.hasOwnProperty.call(rule, 'const') && value !== rule.const) errors.push(location + ' must equal ' + JSON.stringify(rule.const));
  if (rule.enum && !rule.enum.includes(value)) errors.push(location + ' is outside enum');
  if (typeof value === 'string') {
    if (rule.minLength != null && value.length < rule.minLength) errors.push(location + ' is too short');
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) errors.push(location + ' does not match pattern');
  }
  if (typeof value === 'number') {
    if (rule.minimum != null && value < rule.minimum) errors.push(location + ' is below minimum');
    if (rule.maximum != null && value > rule.maximum) errors.push(location + ' is above maximum');
  }
  if (Array.isArray(value)) {
    if (rule.minItems != null && value.length < rule.minItems) errors.push(location + ' has too few items');
    if (rule.uniqueItems && new Set(value.map((item) => Feedback.stableStringify(item))).size !== value.length) errors.push(location + ' has duplicate items');
    if (rule.items) value.forEach((item, index) => validateJson(item, rule.items, location + '[' + index + ']', errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    (rule.required || []).forEach((name) => {
      if (!Object.prototype.hasOwnProperty.call(value, name)) errors.push(location + ' is missing ' + name);
    });
    if (rule.additionalProperties === false) {
      Object.keys(value).filter((name) => !(rule.properties && Object.prototype.hasOwnProperty.call(rule.properties, name))).forEach((name) => errors.push(location + ' has unexpected ' + name));
    }
    Object.keys(rule.properties || {}).forEach((name) => {
      if (Object.prototype.hasOwnProperty.call(value, name)) validateJson(value[name], rule.properties[name], location + '.' + name, errors);
    });
  }
}

function matchesType(value, kind) {
  if (kind === 'null') return value === null;
  if (kind === 'array') return Array.isArray(value);
  if (kind === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (kind === 'integer') return Number.isInteger(value);
  return typeof value === kind;
}
