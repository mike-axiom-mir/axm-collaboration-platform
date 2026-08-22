#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Gate = require('./resource-grounded-capability-gate');
const Loop = require('../verified-capability-loop/verified-capability-loop');

let checks = 0;

function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function throws(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  console.log('PASS ' + message);
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

const evaluatedAt = '2026-08-22T01:00:00.000Z';
const observedAt = '2026-08-22T00:55:00.000Z';
const baselineRef = Loop.reference(
  { publicCommit: 'd9066284', localState: 'clean-resource-gate-branch' },
  { id: 'baseline-observation', schema: 'axm.baseline-observation/v1' }
);
const candidateRef = Loop.reference(
  { change: 'bounded resource evidence companion before human capability decision' },
  { id: 'resource-gate-candidate', schema: 'text/javascript' }
);
const verificationRef = Loop.reference(
  { checks: ['functional'], failed: 0 },
  { id: 'focused-verification', schema: 'axm.focused-test-receipt/v1' }
);

function cycleInput(extra) {
  return Object.assign({
    cycleId: 'cycle-resource-grounding-20260822',
    capabilityId: 'capability.resource-grounding/v1',
    generatedAt: evaluatedAt,
    baseline: {
      kind: 'git-and-worktree',
      identity: 'Named repository commit plus explicitly observed local branch state.',
      receiptRef: baselineRef
    },
    need: {
      id: 'need-resource-grounding',
      statement: 'A functionally verified capability must not inherit an undeclared resource regression.',
      sourceRef: Loop.reference(
        { signal: 'verified behavior alone does not establish bounded resource use' },
        { id: 'need-source', schema: 'axm.research-signal/v1' }
      ),
      directionRef: Loop.reference(
        { direction: 'Truth and resource-grounded growth before promotion.' },
        { id: 'root-direction', schema: 'axm.direction-reference/v1' }
      )
    },
    gap: {
      state: 'OPEN',
      reason: 'The existing loop records functional proof but has no baseline-candidate resource comparison.',
      reportRef: Loop.reference(
        { gap: 'missing-resource-envelope' },
        { id: 'gap-report', schema: 'axm.capability-gap-report/v1' }
      )
    },
    provenance: [
      Loop.reference(
        { observation: 'resource policy absent from the pre-steward seam' },
        { id: 'source-observation', schema: 'axm.static-observation/v1' }
      )
    ],
    candidate: {
      strategy: 'COMPOSE',
      status: 'EXPERIMENTAL',
      artifactRef: candidateRef,
      sourceMutationPerformed: true,
      installed: false,
      promoted: false,
      canon: false
    },
    verification: {
      verdict: 'PASS',
      subjectDigest: candidateRef.sha256,
      receiptRef: verificationRef,
      evidenceAuthority: 'MIXED',
      limitations: ['Functional proof does not itself establish resource behavior.']
    },
    decision: null,
    availability: null,
    refresh: {
      trigger: 'NEW_INFORMATION',
      checkedAt: evaluatedAt,
      due: false,
      reason: 'Recheck when the candidate, workload, environment, policy, or observation changes.'
    }
  }, extra || {});
}

const awaiting = Loop.build(cycleInput());
const workloadRef = Gate.reference(
  { command: 'node focused-workload.js', fixture: 'fixed-v1', repetitions: 5 },
  { id: 'workload.focused-v1', schema: 'axm.workload-definition/v1' }
);
const environmentRef = Gate.reference(
  { os: 'windows', architecture: 'x64', runtime: 'node', powerProfile: 'balanced' },
  { id: 'environment.windows-node-v1', schema: 'axm.execution-environment/v1' }
);

const dimensions = [
  { id: 'WALL_MILLISECONDS', unit: 'ms', required: true, absoluteMax: 2000, maxRegressionBps: 1000 },
  { id: 'PEAK_MEMORY_BYTES', unit: 'byte', required: true, absoluteMax: 600000000, maxRegressionBps: 2000 },
  { id: 'NETWORK_EGRESS_BYTES', unit: 'byte', required: true, absoluteMax: 0, maxRegressionBps: 0 },
  { id: 'ENERGY_MILLIWATT_HOURS', unit: 'mWh', required: false, absoluteMax: null, maxRegressionBps: null }
];

function policyBody(overrides) {
  return Object.assign({
    schema: Gate.POLICY_SCHEMA,
    policyId: 'policy.resource-grounding-v1',
    capabilityId: awaiting.capabilityId,
    candidateDigest: awaiting.candidate.artifactRef.sha256,
    baselineDigest: awaiting.baseline.receiptRef.sha256,
    workloadRef,
    environmentRef,
    freshnessWindowMs: 600000,
    dimensions: copy(dimensions)
  }, overrides || {});
}

const policy = Gate.sealPolicy(policyBody());
const definitionRefs = Object.fromEntries(dimensions.map((dimension) => [
  dimension.id,
  Gate.reference(
    { dimension: dimension.id, aggregation: dimension.id === 'PEAK_MEMORY_BYTES' ? 'maximum' : 'total' },
    { id: 'measurement.' + dimension.id.toLowerCase().replaceAll('_', '-'), schema: 'axm.measurement-definition/v1' }
  )
]));

const baselineValues = {
  WALL_MILLISECONDS: 1000,
  PEAK_MEMORY_BYTES: 400000000,
  NETWORK_EGRESS_BYTES: 0,
  ENERGY_MILLIWATT_HOURS: null
};
const candidateValues = {
  WALL_MILLISECONDS: 900,
  PEAK_MEMORY_BYTES: 450000000,
  NETWORK_EGRESS_BYTES: 0,
  ENERGY_MILLIWATT_HOURS: null
};

function observation(kind, options) {
  options = options || {};
  const values = Object.assign({}, kind === 'BASELINE' ? baselineValues : candidateValues, options.values || {});
  const coverage = Object.assign({}, options.coverage || {});
  const definitions = Object.assign({}, definitionRefs, options.definitions || {});
  const measurements = copy(options.measurements || dimensions).map((dimension) => ({
    id: dimension.id,
    unit: dimension.unit,
    coverage: coverage[dimension.id] || (values[dimension.id] === null ? 'UNKNOWN' : 'COMPLETE'),
    value: values[dimension.id],
    measurementDefinitionRef: definitions[dimension.id]
  }));
  return Gate.sealObservation({
    schema: Gate.OBSERVATION_SCHEMA,
    observationId: options.observationId || 'observation.' + kind.toLowerCase() + '-v1',
    subjectKind: kind,
    subjectDigest: options.subjectDigest || (kind === 'BASELINE' ? awaiting.baseline.receiptRef.sha256 : awaiting.candidate.artifactRef.sha256),
    workloadRef: options.workloadRef || workloadRef,
    environmentRef: options.environmentRef || environmentRef,
    observedAt: options.observedAt || observedAt,
    evidenceAuthority: options.evidenceAuthority || 'DIRECT_MACHINE_METER',
    measurements,
    evidenceRef: options.evidenceRef || Gate.reference(
      { kind, observedAt: options.observedAt || observedAt, values, coverage },
      { id: 'evidence.' + kind.toLowerCase() + '-v1', schema: 'axm.resource-meter-receipt/v1' }
    )
  });
}

const baselineObservation = observation('BASELINE');
const candidateObservation = observation('CANDIDATE');

function gateInput(extra) {
  return Object.assign({
    gateId: 'gate.resource-grounding-v1',
    evaluatedAt,
    capabilityCycle: awaiting,
    policy,
    baselineObservation,
    candidateObservation
  }, extra || {});
}

const policySchema = readJson('resource-grounded-capability-policy.schema.json');
const observationSchema = readJson('resource-observation.schema.json');
const receiptSchema = readJson('resource-grounded-capability-gate-receipt.schema.json');
const contract = readJson('module.contract.json');
check(policySchema.$id === Gate.POLICY_SCHEMA, 'policy schema identity matches the implementation');
check(observationSchema.$id === Gate.OBSERVATION_SCHEMA, 'observation schema identity matches the implementation');
check(receiptSchema.$id === Gate.RECEIPT_SCHEMA, 'receipt schema identity matches the implementation');
check(contract.status === 'TEST', 'module contract remains TEST');
check(contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module contract grants no permissions or writes');
check(['hardware-metering', 'automatic-install', 'automatic-promotion', 'automatic-canon', 'broad-improvement-claim'].every(
  (boundary) => contract.boundaries.refuses.includes(boundary)
), 'module contract records the authority ceiling');
check(awaiting.state === 'AWAITING_STEWARD', 'fixture starts at the pre-decision functional verification seam');

const aligned = Gate.build(gateInput());
check(aligned.state === 'RESOURCE_EVIDENCE_ALIGNED', 'comparable in-envelope resource evidence aligns');
check(aligned.recommendation.verdict === 'READY_FOR_HUMAN_REVIEW', 'alignment only recommends human review');
check(aligned.summary.requiredPassed === 3 && aligned.summary.optionalUnknown === 1 && aligned.summary.optionalAdvisories === 0,
  'summary keeps required passes, optional unknowns, and advisories distinct');
check(Gate.verify(aligned, awaiting).pass, 'fresh resource gate receipt verifies deterministically');
check(!Gate.verify(aligned).pass, 'receipt verification requires the upstream capability cycle');
check(aligned.truth.improvementEstablished === false && aligned.truth.measurementPerformed === false &&
  aligned.truth.observationAuthorityAuthenticated === false && aligned.truth.humanStewardDecisionRequired === true,
  'receipt refuses measurement, observer authentication, improvement, and decision authority claims');

const reorderedPolicy = Gate.sealPolicy(policyBody({ dimensions: copy(dimensions).reverse() }));
const reorderedBaseline = observation('BASELINE', { measurements: copy(dimensions).reverse() });
const reorderedCandidate = observation('CANDIDATE', { measurements: copy(dimensions).reverse() });
check(reorderedPolicy.policyDigest === policy.policyDigest, 'policy digest is independent of input dimension order');
check(reorderedBaseline.observationDigest === baselineObservation.observationDigest && reorderedCandidate.observationDigest === candidateObservation.observationDigest,
  'observation digests are independent of input measurement order');
check(Gate.build(gateInput({ policy: reorderedPolicy, baselineObservation: reorderedBaseline, candidateObservation: reorderedCandidate })).receiptDigest === aligned.receiptDigest,
  'equivalent reordered inputs produce the same receipt');

check(Gate.build(gateInput({ baselineObservation: null })).state === 'BASELINE_OBSERVATION_REQUIRED', 'missing baseline evidence produces an explicit hold state');
check(Gate.build(gateInput({ candidateObservation: null })).state === 'CANDIDATE_OBSERVATION_REQUIRED', 'missing candidate evidence produces an explicit hold state');
check(Gate.build(gateInput({ baselineObservation: observation('BASELINE', { observedAt: '2026-08-22T00:00:00.000Z' }) })).state === 'OBSERVATION_STALE',
  'stale evidence cannot align');
check(Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', { evidenceAuthority: 'MANUAL_DECLARATION' }) })).state === 'RESOURCE_EVIDENCE_HOLD',
  'manual declaration cannot establish required resource evidence');
check(Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  coverage: { WALL_MILLISECONDS: 'PARTIAL' }
}) })).state === 'RESOURCE_EVIDENCE_HOLD', 'partial required evidence produces an evidence hold');
check(Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  values: { WALL_MILLISECONDS: null }, coverage: { WALL_MILLISECONDS: 'UNKNOWN' }
}) })).state === 'RESOURCE_EVIDENCE_HOLD', 'unknown required evidence is not treated as unlimited');

const alternateWallDefinition = Gate.reference(
  { dimension: 'WALL_MILLISECONDS', aggregation: 'median' },
  { id: 'measurement.wall-median', schema: 'axm.measurement-definition/v1' }
);
check(Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  definitions: { WALL_MILLISECONDS: alternateWallDefinition }
}) })).state === 'RESOURCE_EVIDENCE_HOLD', 'incomparable measurement definitions produce an evidence hold');
check(Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  values: { WALL_MILLISECONDS: 2100 }
}) })).state === 'RESOURCE_BUDGET_EXCEEDED', 'absolute ceiling breach produces a budget hold');
check(Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  values: { WALL_MILLISECONDS: 1150 }
}) })).state === 'RESOURCE_REGRESSION_HOLD', 'relative resource regression produces a regression hold');

const advisoryDimensions = copy(dimensions).map((dimension) => dimension.id === 'ENERGY_MILLIWATT_HOURS'
  ? Object.assign({}, dimension, { absoluteMax: 10, maxRegressionBps: null })
  : dimension);
const advisoryPolicy = Gate.sealPolicy(policyBody({ dimensions: advisoryDimensions }));
const advisoryReceipt = Gate.build(gateInput({
  policy: advisoryPolicy,
  baselineObservation: observation('BASELINE', {
    values: { ENERGY_MILLIWATT_HOURS: 5 }, coverage: { ENERGY_MILLIWATT_HOURS: 'COMPLETE' }
  }),
  candidateObservation: observation('CANDIDATE', {
    values: { ENERGY_MILLIWATT_HOURS: 20 }, coverage: { ENERGY_MILLIWATT_HOURS: 'COMPLETE' }
  })
}));
check(advisoryReceipt.state === 'RESOURCE_EVIDENCE_ALIGNED' && advisoryReceipt.summary.optionalAdvisories === 1,
  'optional envelope breaches remain visible advisories without impersonating required holds');

const zeroRegressionDimensions = copy(dimensions).map((dimension) => dimension.id === 'NETWORK_EGRESS_BYTES'
  ? Object.assign({}, dimension, { absoluteMax: null, maxRegressionBps: 0 })
  : dimension);
const zeroRegressionPolicy = Gate.sealPolicy(policyBody({ dimensions: zeroRegressionDimensions }));
check(Gate.build(gateInput({
  policy: zeroRegressionPolicy,
  candidateObservation: observation('CANDIDATE', { values: { NETWORK_EGRESS_BYTES: 1 } })
})).state === 'RESOURCE_REGRESSION_HOLD', 'a zero baseline only permits a zero candidate under regression comparison');

const largeValueDimensions = [
  { id: 'WALL_MILLISECONDS', unit: 'ms', required: true, absoluteMax: null, maxRegressionBps: 0 }
];
const largeValuePolicy = Gate.sealPolicy(policyBody({ dimensions: largeValueDimensions }));
check(Gate.build(gateInput({
  policy: largeValuePolicy,
  baselineObservation: observation('BASELINE', {
    measurements: largeValueDimensions, values: { WALL_MILLISECONDS: Number.MAX_SAFE_INTEGER - 1 }
  }),
  candidateObservation: observation('CANDIDATE', {
    measurements: largeValueDimensions, values: { WALL_MILLISECONDS: Number.MAX_SAFE_INTEGER }
  })
})).state === 'RESOURCE_REGRESSION_HOLD', 'large safe integers retain exact regression comparison without floating-point collapse');

throws(() => Gate.build(gateInput({ baselineObservation: observation('BASELINE', {
  workloadRef: Gate.reference({ workload: 'different' }, { id: 'workload.other', schema: 'axm.workload-definition/v1' })
}) })), /workload mismatch/i, 'workload mismatch is refused');
throws(() => Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  environmentRef: Gate.reference({ environment: 'different' }, { id: 'environment.other', schema: 'axm.execution-environment/v1' })
}) })), /environment mismatch/i, 'environment mismatch is refused');
throws(() => Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  subjectDigest: 'sha256:' + '0'.repeat(64)
}) })), /subject digest mismatch/i, 'candidate subject mismatch is refused');
throws(() => Gate.build(gateInput({ policy: Gate.sealPolicy(policyBody({
  candidateDigest: 'sha256:' + '1'.repeat(64)
})) })), /candidate digest mismatch/i, 'policy-candidate mismatch is refused');

const tamperedPolicy = copy(policy);
tamperedPolicy.freshnessWindowMs += 1;
throws(() => Gate.build(gateInput({ policy: tamperedPolicy })), /policy digest mismatch/i, 'tampered sealed policy is refused');
const tamperedObservation = copy(candidateObservation);
tamperedObservation.measurements.find((item) => item.id === 'WALL_MILLISECONDS').value += 1;
throws(() => Gate.build(gateInput({ candidateObservation: tamperedObservation })), /observation digest mismatch/i, 'tampered sealed observation is refused');
const tamperedReceipt = copy(aligned);
tamperedReceipt.state = 'RESOURCE_BUDGET_EXCEEDED';
check(!Gate.verify(tamperedReceipt, awaiting).pass, 'tampered derived receipt state fails verification');

throws(() => Gate.build(Object.assign(gateInput(), { surprise: true })), /unsupported fields/i, 'extra gate input fields are refused');
throws(() => Gate.sealPolicy(policyBody({ freshnessWindowMs: '600000' })), /safe integer/i, 'numeric strings are not coerced into resource policy values');
throws(() => Gate.sealPolicy(policyBody({ dimensions: [
  { id: 'WALL_MILLISECONDS', unit: 'byte', required: true, absoluteMax: 10, maxRegressionBps: null }
] })), /unit must be ms/i, 'dimension-unit mismatch is refused');
throws(() => Gate.sealPolicy(policyBody({ dimensions: [copy(dimensions[0]), copy(dimensions[0])] })), /unique/i, 'duplicate policy dimensions are refused');
throws(() => Gate.sealPolicy(policyBody({ dimensions: [
  { id: 'WALL_MILLISECONDS', unit: 'ms', required: true, absoluteMax: null, maxRegressionBps: null }
] })), /needs an absolute or regression ceiling/i, 'required dimensions need a declared ceiling');
throws(() => Gate.sealPolicy(policyBody({ dimensions: [
  { id: 'ENERGY_MILLIWATT_HOURS', unit: 'mWh', required: false, absoluteMax: null, maxRegressionBps: null }
] })), /at least one required dimension/i, 'policy cannot contain only optional dimensions');
throws(() => Gate.build(gateInput({ candidateObservation: observation('CANDIDATE', {
  observedAt: '2026-08-22T01:00:00.001Z'
}) })), /future/i, 'future-dated observations are refused');

const decision = {
  verdict: 'CONTINUE',
  actorKind: 'HUMAN',
  actorId: 'mike',
  candidateDigest: candidateRef.sha256,
  confirmation: 'CONTINUE VERIFIED CAPABILITY',
  decisionRef: Loop.reference(
    { actor: 'mike', verdict: 'CONTINUE', candidate: candidateRef.sha256 },
    { id: 'steward-decision', schema: 'axm.review-decision/v1' }
  )
};
const afterDecision = Loop.build(cycleInput({ decision }));
throws(() => Gate.build(gateInput({ capabilityCycle: afterDecision })), /must be AWAITING_STEWARD/i,
  'resource review cannot retroactively approve a post-decision cycle');

console.log('\nResource-Grounded Capability Gate selftest: PASS (' + checks + ' checks)');
