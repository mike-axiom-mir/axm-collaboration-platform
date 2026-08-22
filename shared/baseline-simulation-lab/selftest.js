#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Lab = require('./baseline-simulation-lab');
const Capsule = require('../portable-baseline-capsule/portable-baseline-capsule');
const Evidence = require('../../tools/evidence-desk/evidence-core');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function ref(id, value, schema) { return Lab.reference(value, { id, schema: schema || 'axm.fixture/v1' }); }
function hasHold(receipt, code) { return receipt.holds.some(item => item.code === code); }
function expectThrow(fn, pattern, message) {
  assert.rejects(fn, pattern);
  checks += 1;
  console.log('PASS ' + message);
}

const at = '2026-08-19T15:00:00.000Z';
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline-simulation-lab-run.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));

function softwareCapsule(id, content) {
  return Capsule.build({
    capsuleId: 'capsule:' + id,
    capturedAt: at,
    subject: { kind: 'SOFTWARE_REPOSITORY', id: 'axm/workshop', version: 'fixture-version' },
    contentRef: ref('baseline:content', { content }),
    configRef: ref('baseline:config', { config: 'fixture' }),
    sourceRefs: [ref('baseline:source', { source: 'fixture' })],
    newInformationRefs: [],
    generatedViews: [{
      viewId: 'view:summary', viewRef: ref('baseline:view', { content }), state: 'CURRENT', checkedAt: at,
      reason: 'Synthetic view is current for the declared fixture content.'
    }],
    limitations: ['Synthetic fixture proves deterministic envelope behavior only.'],
    preservedSourceFields: [],
    extensions: [],
    adapter: {
      repositoryId: 'axm/workshop', versionOrCommit: 'fixture-version',
      workingTree: { state: 'CLEAN', statusRef: ref('baseline:status', { state: 'CLEAN' }, 'axm.git-status-observation/v1') }
    }
  });
}

function mirrorCapsule() {
  return Capsule.build({
    capsuleId: 'capsule:mirror-fixture', capturedAt: at,
    subject: { kind: 'MIRROR_STATE', id: 'mirror:fixture', version: 'fixture-version' },
    contentRef: ref('mirror:content', { content: 'fixture' }),
    configRef: ref('mirror:config', { config: 'fixture' }),
    sourceRefs: [ref('mirror:source', { source: 'fixture' })], newInformationRefs: [],
    generatedViews: [{ viewId: 'mirror:view', viewRef: ref('mirror:view-ref', { view: true }), state: 'CURRENT', checkedAt: at, reason: 'Synthetic Mirror fixture is current.' }],
    limitations: ['Synthetic Mirror identity fixture only.'], preservedSourceFields: [], extensions: [],
    adapter: {
      originalBaselineRef: ref('mirror:original', { realm: 'original' }, 'axm.mirror-original-state/v1'),
      privateLessons: { stateRef: ref('mirror:private-lessons', { digestOnly: true }, 'axm.mirror-private-lessons-state/v1'), visibility: 'PRIVATE' },
      challenger: { stateRef: ref('mirror:challenger', { disposable: true }, 'axm.mirror-challenger-state/v1'), disposable: true }
    }
  });
}

function specialistCapsule() {
  return Capsule.build({
    capsuleId: 'capsule:specialist-fixture', capturedAt: at,
    subject: { kind: 'SPECIALIST_MASK', id: 'specialist:fixture', version: 'fixture-version' },
    contentRef: ref('specialist:content', { content: 'fixture' }),
    configRef: ref('specialist:config', { config: 'fixture' }),
    sourceRefs: [ref('specialist:source', { source: 'fixture' })], newInformationRefs: [],
    generatedViews: [{ viewId: 'specialist:view', viewRef: ref('specialist:view-ref', { view: true }), state: 'CURRENT', checkedAt: at, reason: 'Synthetic specialist fixture is current.' }],
    limitations: ['Synthetic specialist identity fixture only.'], preservedSourceFields: [], extensions: [],
    adapter: {
      hostModel: {
        providerFamily: 'fixture-provider', modelId: 'fixture-model', version: 'fixture-version',
        receiptRef: ref('specialist:host-model', { host: true }, 'axm.host-model-declaration/v1')
      },
      mask: {
        id: 'mask:fixture', schema: 'axm.specialist-mask/v2', version: '0.2.0+fixture.1',
        packageRef: ref('specialist:mask-package', { mask: true }, 'axm.specialist-package/v1')
      },
      allowedCapabilities: ['context.read', 'tests.run'], evidenceCeiling: 'SYNTHETIC_ONLY',
      permissionGrant: 'NONE', identityEffect: 'OVERLAY_ONLY'
    }
  });
}

const baseline = softwareCapsule('current', 'one');
const needSource = ref('need:source', { need: 'bounded baseline simulation' }, 'axm.research-need/v1');
const direction = ref('direction:roots', { roots: ['truth', 'agency', 'continuity', 'wisdom-over-speed'] }, 'axm.direction-reference/v1');
const newInfo = ref('new-information:one', { observed: 'a missing deterministic run envelope' }, 'axm.new-information/v1');
const proofEvidence = ref('proof:focused-fixture', { check: 'deterministic fixture', result: 'PASS' }, 'axm.focused-test-receipt/v1');

async function evidenceReceipt(proof, options) {
  options = options || {};
  return Evidence.seal({
    title: 'Baseline Simulation Lab fixture evidence',
    goal: 'Route one falsifiable claim to its native evidence surface.',
    actor: { id: 'test:baseline-simulation-lab', type: 'TOOL' },
    source_checkpoint: proof.id,
    observations: [{
      id: 'claim-envelope',
      claim: options.claim || 'The bounded fixture produces the declared deterministic state.',
      kind: options.kind || 'deterministic-behavior',
      risk: 'MEDIUM',
      verdict: options.verdict || 'PASS',
      pass_condition: 'The exact fixture produces the expected state and digest-bound receipt.',
      primary_surface: options.surface || 'focused-execution',
      observed_evidence: 'The focused self-test observed the exact derived state.',
      counterevidence: 'A different state, invalid receipt, or missing dependency would disprove the claim.',
      source_kind: 'test-receipt',
      source: proof.id
    }],
    checks: [], actions: [], changes: [],
    limitations: ['Synthetic checks do not establish every future integration behavior.']
  }, { now: at });
}

function seats() {
  return [
    {
      id: 'mike', kind: 'HUMAN', role: 'direction and merge gate', providerFamily: null, modelId: null,
      identityDisclosure: 'EXACT', priorOutputExposure: 'NONE',
      provenanceRef: ref('seat:mike', { role: 'human direction and merge gate' }, 'axm.seat-provenance/v1'), proofAuthority: 'NONE'
    },
    {
      id: 'model-a', kind: 'MODEL', role: 'simulated research contributor', providerFamily: 'fixture-provider', modelId: 'fixture-model',
      identityDisclosure: 'EXACT', priorOutputExposure: 'PARTIAL',
      provenanceRef: ref('seat:model-a', { role: 'fixture model seat' }, 'axm.seat-provenance/v1'), proofAuthority: 'NONE'
    }
  ];
}

function cycle(provenance) {
  return {
    cycleId: 'cycle:baseline-simulation-lab-fixture',
    capabilityId: 'simulation.run-envelope.verify',
    generatedAt: at,
    gap: { state: 'OPEN', reason: 'A bounded deterministic run-envelope seam was absent.', reportRef: newInfo },
    provenance,
    candidate: null, verification: null, decision: null, availability: null,
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Recheck when the baseline or declared evidence changes.' }
  };
}

function dependencies(input) {
  const values = [];
  const add = value => { if (value) values.push(value); };
  add(input.need.sourceRef); add(input.need.directionRef);
  input.newInformationRefs.forEach(add);
  input.seats.forEach(value => add(value.provenanceRef));
  input.adapters.forEach(value => {
    add(value.inputSchemaRef); add(value.outputSchemaRef); add(value.translationReceiptRef);
    (value.unsupportedFieldRefs || []).forEach(add);
  });
  add(input.budget.usage.usageRef);
  input.artifactAncestry.nodes.forEach(value => { add(value.artifactRef); (value.assumptionRefs || []).forEach(add); });
  input.ideaEvidenceAncestry.items.forEach(add);
  input.proofRefs.forEach(value => add(value.evidenceRef));
  input.transportChecks.forEach(value => { add(value.payloadRef); add(value.senderReceiptRef); add(value.receiverReceiptRef); });
  input.permissionChecks.forEach(value => { add(value.allowedAttempt.receiptRef); add(value.deniedAttempt.receiptRef); });
  input.handoffs.forEach(value => { add(value.payloadRef); add(value.senderReceiptRef); add(value.receiverReceiptRef); });
  add(input.humanReview.receiptRef);
  add(input.previousCycleRef);
  input.authorityAttempts.forEach(value => add(value.receiptRef));
  if (input.cycle) {
    add(input.cycle.gap && input.cycle.gap.reportRef);
    add(input.cycle.gap && input.cycle.gap.existingCapabilityRef);
    (input.cycle.provenance || []).forEach(add);
    add(input.cycle.candidate && input.cycle.candidate.artifactRef);
    add(input.cycle.verification && input.cycle.verification.receiptRef);
    add(input.cycle.decision && input.cycle.decision.decisionRef);
    add(input.cycle.availability && input.cycle.availability.receiptRef);
  }
  return Array.from(new Map(values.map(value => [value.id + '|' + value.schema + '|' + value.sha256, value])).values());
}

function closeOutputs(input) {
  input.outputClosures = dependencies(input).map(dependencyRef => ({
    dependencyRef,
    state: 'CURRENT',
    receiptRef: ref('closure:' + dependencyRef.id, { dependencyRef }, 'axm.output-closure-receipt/v1'),
    observedRef: dependencyRef,
    summarySubstituted: false,
    authority: 'LOCAL_IDENTITY_ONLY'
  }));
  return input;
}

async function activeInput() {
  const receipt = await evidenceReceipt(proofEvidence);
  return closeOutputs({
    runId: 'run:baseline-simulation-lab-fixture',
    generatedAt: at,
    baselineCapsule: baseline,
    priorBaselineCapsule: null,
    previousCycleRef: null,
    need: {
      id: 'need:bounded-envelope',
      statement: 'A baseline research run needs exact inputs, bounded work, native evidence, and an explicit stop.',
      sourceRef: needSource,
      directionRef: direction
    },
    newInformationRefs: [newInfo],
    seats: seats(),
    adapters: [{
      id: 'adapter:software', subjectKind: 'SOFTWARE_REPOSITORY',
      inputSchemaRef: ref('adapter:input-schema', { input: true }, 'application/schema+json'),
      outputSchemaRef: ref('adapter:output-schema', { output: true }, 'application/schema+json'),
      translationReceiptRef: ref('adapter:translation', { exact: true }, 'axm.translation-receipt/v1'),
      unsupportedFieldRefs: [], nativeSchemaIdentityClaimed: false
    }],
    budget: {
      limits: { timeMs: 1000, storageBytes: 100000, maxConcurrency: 2, maxRetries: 1 },
      usage: {
        timeMs: 20, storageBytes: 1000, peakConcurrency: 1, retries: 0, executionPerformed: true,
        usageRef: ref('budget:usage', { timeMs: 20 }, 'axm.budget-usage-receipt/v1')
      }
    },
    outputClosures: [],
    artifactAncestry: {
      maxDepth: 0,
      nodes: [{ artifactRef: Capsule.capsuleReference(baseline), parentRef: null, depth: 0, assumptionRefs: [] }]
    },
    ideaEvidenceAncestry: {
      items: [needSource, newInfo],
      links: [{ fromRef: newInfo, toRef: needSource, relation: 'MOTIVATED_BY' }]
    },
    evidenceReceipt: receipt,
    proofRefs: [{ claimId: 'claim-envelope', evidenceRef: proofEvidence, method: 'FOCUSED_EXECUTION', observedAt: at }],
    signals: [{
      id: 'signal:missing-envelope',
      statement: 'The current composition has reusable organs but lacks the bounded run envelope between them.',
      evidenceStage: 'INFERENCE', sourceRefs: [newInfo], seatIds: ['model-a'],
      cheapestTest: 'Build a pure validator and exercise adversarial fixtures.',
      uncertainty: 'The envelope may expose additional missing integration contracts.',
      solutionAlternatives: ['Reuse the existing organs directly without a shared run receipt.'],
      contradictions: [], wildcard: false
    }],
    transportChecks: [], permissionChecks: [], handoffs: [],
    humanReview: { required: false, verdict: 'NOT_RUN', comprehension: 'UNKNOWN', receiptRef: null, actorKind: 'HUMAN' },
    authorityAttempts: [],
    cycle: cycle([newInfo])
  });
}

function noNewInput(active) {
  const input = copy(active);
  input.runId = 'run:baseline-simulation-lab-no-new';
  input.priorBaselineCapsule = copy(baseline);
  input.previousCycleRef = ref('cycle:existing-capability', { state: 'GAP_OPEN' }, 'axm.verified-capability-cycle-receipt/v1');
  input.newInformationRefs = [];
  input.signals = [];
  input.ideaEvidenceAncestry = { items: [needSource], links: [] };
  input.budget.usage = {
    timeMs: 0, storageBytes: 0, peakConcurrency: 0, retries: 0, executionPerformed: false,
    usageRef: ref('budget:no-new-usage', { executionPerformed: false }, 'axm.budget-usage-receipt/v1')
  };
  input.cycle = null;
  return closeOutputs(input);
}

(async function main() {
  check(schema.$id === Lab.RUN_SCHEMA, 'run schema identity matches the implementation');
  check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'contract remains TEST with no permissions or writes');
  check(['model-invocation', 'recursive-generation', 'majority-vote-as-truth', 'automatic-canon'].every(value => contract.boundaries.refuses.includes(value)), 'contract refuses model recursion, voting as truth, and automatic CANON');
  check(contract.version === 'v0.2' && contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'v0.2 contract declares strict representation closure');
  check(Lab.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
  assert.throws(() => Lab.stableStringify({ lost: undefined }), /unsupported undefined/i);
  checks += 1;
  console.log('PASS unsafe canonical state is refused');

  const active = await activeInput();
  const run = await Lab.build(active);
  check(run.state === 'GAP_RECORDED' && run.holds.length === 0, 'new information produces one bounded open Verified Capability Cycle');
  const runVerification = await Lab.verify(run);
  if (!runVerification.pass) console.error('Run verification errors:', runVerification.errors);
  check(runVerification.pass, 'fresh run receipt verifies by exact rebuild');
  check(run.signals[0].evidenceStage === 'INFERENCE' && run.signals[0].truthWeight === 'NONE', 'staged inference remains staged and has no truth weight');
  check(run.analysis.crossModelAgreementIsProof === false && run.analysis.majorityDecisionPerformed === false, 'model agreement and majority are never proof or decision authority');
  check(run.truth.modelInvokedByLab === false && run.truth.automaticNextGeneration === false && run.truth.automaticCanon === false, 'lab invokes no model and grants no continuation or CANON authority');
  check(run.analysis.commonModeCautions.includes('PRIOR_OUTPUT_EXPOSURE') && !run.analysis.independenceEstablished, 'prior-output exposure prevents an independence claim');
  check(run.baseline.current.adapter.versionOrCommit === 'fixture-version' && run.baseline.current.adapter.workingTree.state === 'CLEAN', 'software adapter keeps Git/version identity and worktree state separate');

  const mirrorInput = copy(active);
  mirrorInput.baselineCapsule = mirrorCapsule();
  mirrorInput.artifactAncestry = { maxDepth: 0, nodes: [{ artifactRef: Capsule.capsuleReference(mirrorInput.baselineCapsule), parentRef: null, depth: 0, assumptionRefs: [] }] };
  mirrorInput.adapters[0].subjectKind = 'MIRROR_STATE';
  closeOutputs(mirrorInput);
  const mirrorRun = await Lab.build(mirrorInput);
  check(mirrorRun.state === 'GAP_RECORDED' && mirrorRun.baseline.current.adapter.challenger.disposable === true && mirrorRun.baseline.current.adapter.privateLessons.visibility === 'PRIVATE', 'Mirror adapter preserves distinct private lessons and disposable challenger state');

  const specialistInput = copy(active);
  specialistInput.baselineCapsule = specialistCapsule();
  specialistInput.artifactAncestry = { maxDepth: 0, nodes: [{ artifactRef: Capsule.capsuleReference(specialistInput.baselineCapsule), parentRef: null, depth: 0, assumptionRefs: [] }] };
  specialistInput.adapters[0].subjectKind = 'SPECIALIST_MASK';
  closeOutputs(specialistInput);
  const specialistRun = await Lab.build(specialistInput);
  check(specialistRun.state === 'GAP_RECORDED' && specialistRun.baseline.current.adapter.permissionGrant === 'NONE' && specialistRun.baseline.current.adapter.evidenceCeiling === 'SYNTHETIC_ONLY', 'specialist adapter preserves host/mask boundary, no permission, and evidence ceiling');

  const noNew = await Lab.build(noNewInput(active));
  check(noNew.state === 'NO_NEW_INFORMATION' && noNew.holds.length === 0, 'unchanged baseline plus no new information stops successfully');
  check(noNew.cycleReceipt.state === 'REUSE_EXISTING' && noNew.budget.usage.executionPerformed === false, 'no-new-information run reuses one existing capability without generation work');
  check((await Lab.verify(noNew)).pass, 'no-new-information receipt verifies exactly');

  const changedBaseline = softwareCapsule('changed', 'two');
  const changed = copy(active);
  changed.baselineCapsule = changedBaseline;
  changed.priorBaselineCapsule = baseline;
  changed.newInformationRefs = [];
  changed.signals = [];
  changed.ideaEvidenceAncestry = { items: [needSource], links: [] };
  changed.artifactAncestry = {
    maxDepth: 1,
    nodes: [
      { artifactRef: Capsule.capsuleReference(changedBaseline), parentRef: Capsule.capsuleReference(baseline), depth: 1, assumptionRefs: [] },
      { artifactRef: Capsule.capsuleReference(baseline), parentRef: null, depth: 0, assumptionRefs: [] }
    ]
  };
  changed.cycle = cycle([]);
  closeOutputs(changed);
  const changedRun = await Lab.build(changed);
  check(changedRun.state === 'BASELINE_HOLD' && hasHold(changedRun, 'BASELINE_CHANGED_WITHOUT_NEW_INFORMATION'), 'changed baseline without declared new information is held');

  const missingParent = copy(active);
  missingParent.artifactAncestry = {
    maxDepth: 1,
    nodes: [{ artifactRef: Capsule.capsuleReference(baseline), parentRef: ref('artifact:missing-parent', { missing: true }), depth: 1, assumptionRefs: [] }]
  };
  closeOutputs(missingParent);
  const missingParentRun = await Lab.build(missingParent);
  check(missingParentRun.state === 'ANCESTRY_HOLD' && hasHold(missingParentRun, 'ANCESTRY_PARENT_MISSING'), 'missing artifact parent is held');

  const missingOutput = copy(active);
  missingOutput.outputClosures.pop();
  const missingOutputRun = await Lab.build(missingOutput);
  check(missingOutputRun.state === 'OUTPUT_HOLD' && hasHold(missingOutputRun, 'OUTPUT_CLOSURE_MISSING'), 'missing later output dependency is held');

  const summaryOutput = copy(active);
  summaryOutput.outputClosures[0].state = 'SUMMARY_SUBSTITUTED';
  summaryOutput.outputClosures[0].summarySubstituted = true;
  const summaryRun = await Lab.build(summaryOutput);
  check(summaryRun.state === 'OUTPUT_HOLD' && hasHold(summaryRun, 'OUTPUT_SUMMARY_SUBSTITUTED'), 'summary cannot substitute for a bound output');

  const transport = copy(active);
  const payload = ref('transport:payload', { value: 1 }, 'axm.transport-payload/v1');
  transport.transportChecks = [{
    id: 'transport:mismatch', payloadRef: payload,
    senderReceiptRef: ref('transport:sender', { sent: payload.sha256 }),
    receiverReceiptRef: ref('transport:receiver', { received: 'different' }),
    senderDigest: payload.sha256, receiverDigest: ref('transport:different', { value: 2 }).sha256
  }];
  closeOutputs(transport);
  const transportRun = await Lab.build(transport);
  check(transportRun.state === 'TRANSPORT_HOLD' && hasHold(transportRun, 'TRANSPORT_DIGEST_MISMATCH'), 'sender and receiver digest mismatch is held');

  const visualProof = ref('proof:visual-fixture', { screenshot: true }, 'image/png');
  const visual = copy(active);
  visual.evidenceReceipt = await evidenceReceipt(visualProof, { kind: 'visual-appearance', surface: 'live-visual-observation' });
  visual.proofRefs = [{ claimId: 'claim-envelope', evidenceRef: visualProof, method: 'SCHEMA_VALIDATION', observedAt: at }];
  closeOutputs(visual);
  const visualRun = await Lab.build(visual);
  check(visualRun.state === 'EVIDENCE_HOLD' && hasHold(visualRun, 'PROOF_SURFACE_MISMATCH'), 'semantic/schema inspection cannot stand in for required live visual proof');

  const unsupportedEvidence = copy(active);
  unsupportedEvidence.evidenceReceipt.observations[0].observed_evidence = '';
  const unsupportedRun = await Lab.build(unsupportedEvidence);
  check(unsupportedRun.state === 'EVIDENCE_HOLD' && hasHold(unsupportedRun, 'EVIDENCE_RECEIPT_INTEGRITY'), 'tampered Evidence Desk receipt is held');

  const permission = copy(active);
  permission.permissionChecks = [{
    permission: 'workspace.write', declared: 'ALLOW',
    allowedAttempt: { result: 'DENIED', receiptRef: ref('permission:allowed-attempt', { result: 'DENIED' }) },
    deniedAttempt: { result: 'DENIED', receiptRef: ref('permission:denied-attempt', { result: 'DENIED' }) }
  }];
  closeOutputs(permission);
  const permissionRun = await Lab.build(permission);
  check(permissionRun.state === 'PERMISSION_HOLD' && hasHold(permissionRun, 'PERMISSION_RUNTIME_MISMATCH'), 'declared permission and runtime behavior mismatch is held');

  const handoff = copy(active);
  const handoffPayloadA = ref('handoff:payload-a', { payload: 'a' });
  const handoffPayloadB = ref('handoff:payload-b', { payload: 'b' });
  handoff.handoffs = [
    { id: 'handoff:a', fromSeatId: 'mike', toSeatId: 'model-a', payloadRef: handoffPayloadA, senderReceiptRef: ref('handoff:a:sender', {}), receiverReceiptRef: ref('handoff:a:receiver', {}) },
    { id: 'handoff:b', fromSeatId: 'model-a', toSeatId: 'mike', payloadRef: handoffPayloadB, senderReceiptRef: ref('handoff:b:sender', {}), receiverReceiptRef: ref('handoff:b:receiver', {}) }
  ];
  closeOutputs(handoff);
  const handoffRun = await Lab.build(handoff);
  check(handoffRun.state === 'HANDOFF_HOLD' && hasHold(handoffRun, 'HANDOFF_CYCLE'), 'circular handoff graph is held');

  const budget = copy(active);
  budget.budget.usage.timeMs = 1001;
  budget.budget.usage.usageRef = ref('budget:overrun', { timeMs: 1001 });
  closeOutputs(budget);
  const budgetRun = await Lab.build(budget);
  check(budgetRun.state === 'BUDGET_HOLD' && hasHold(budgetRun, 'BUDGET_TIME_EXCEEDED'), 'budget overrun is held');

  const worse = copy(active);
  worse.humanReview = { required: true, verdict: 'PASS', comprehension: 'WORSE', receiptRef: ref('review:worse', { comprehension: 'WORSE' }), actorKind: 'HUMAN' };
  closeOutputs(worse);
  const worseRun = await Lab.build(worse);
  check(worseRun.state === 'HUMAN_REVIEW_HOLD' && hasHold(worseRun, 'HUMAN_COMPREHENSION_WORSE'), 'worse human comprehension is a visible hold');

  const spentNoNew = noNewInput(active);
  spentNoNew.budget.usage.timeMs = 1;
  spentNoNew.budget.usage.executionPerformed = true;
  spentNoNew.budget.usage.usageRef = ref('budget:no-new-spent', { timeMs: 1 });
  closeOutputs(spentNoNew);
  const spentRun = await Lab.build(spentNoNew);
  check(spentRun.state === 'CONTRACT_HOLD' && hasHold(spentRun, 'NO_NEW_GENERATION_WORK_PERFORMED'), 'generation work after NO_NEW_INFORMATION is held');

  const omittedProvenance = copy(active);
  omittedProvenance.cycle = cycle([ref('cycle:unrelated-provenance', { unrelated: true }, 'axm.provenance/v1')]);
  closeOutputs(omittedProvenance);
  const omittedRun = await Lab.build(omittedProvenance);
  if (!(omittedRun.state === 'CYCLE_HOLD' && hasHold(omittedRun, 'CYCLE_NEW_INFORMATION_PROVENANCE_MISSING'))) {
    console.error('Omitted provenance state/holds:', omittedRun.state, omittedRun.holds);
  }
  check(omittedRun.state === 'CYCLE_HOLD' && hasHold(omittedRun, 'CYCLE_NEW_INFORMATION_PROVENANCE_MISSING'), 'cycle cannot omit the declared new information');

  const forbiddenAttempt = copy(active);
  forbiddenAttempt.authorityAttempts = [{
    id: 'authority:foundation-attempt', actorId: 'candidate:fixture', actorKind: 'CANDIDATE',
    action: 'FOUNDATION_MUTATION', attempted: true,
    receiptRef: ref('authority:foundation-attempt-receipt', { attempted: 'FOUNDATION_MUTATION' }, 'axm.authority-attempt-receipt/v1')
  }];
  closeOutputs(forbiddenAttempt);
  const forbiddenAttemptRun = await Lab.build(forbiddenAttempt);
  check(forbiddenAttemptRun.state === 'AUTHORITY_HOLD' && hasHold(forbiddenAttemptRun, 'AUTHORITY_FORBIDDEN_ATTEMPT'), 'candidate Foundation-mutation attempt is recorded as an authority hold');

  function governedCycle(authorityId) {
    const candidateRef = ref('candidate:fixture', { candidate: 'fixture' }, 'axm.experimental-candidate/v1');
    return {
      cycleId: 'cycle:governed-fixture', capabilityId: 'simulation.run-envelope.verify', generatedAt: at,
      gap: { state: 'OPEN', reason: 'Fixture gap remains open until governed intake.', reportRef: newInfo },
      provenance: [newInfo],
      candidate: {
        strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: candidateRef,
        sourceMutationPerformed: false, installed: false, promoted: false, canon: false
      },
      verification: {
        verdict: 'PASS', subjectDigest: candidateRef.sha256,
        receiptRef: ref('candidate:verification', { candidate: candidateRef.sha256, result: 'PASS' }, 'axm.focused-test-receipt/v1'),
        evidenceAuthority: 'MIXED', limitations: ['Synthetic fixture only.']
      },
      decision: {
        verdict: 'CONTINUE', actorKind: 'HUMAN', actorId: 'mike', candidateDigest: candidateRef.sha256,
        confirmation: 'CONTINUE VERIFIED CAPABILITY',
        decisionRef: ref('candidate:decision', { actor: 'mike', candidate: candidateRef.sha256 }, 'axm.review-decision/v1')
      },
      availability: {
        status: 'AVAILABLE', candidateDigest: candidateRef.sha256, authorityId,
        receiptRef: ref('candidate:availability', { authorityId, candidate: candidateRef.sha256 }, 'axm.module-availability-receipt/v1')
      },
      refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Synthetic fixture is current.' }
    };
  }

  const modelAvailability = copy(active);
  modelAvailability.cycle = governedCycle('model-a');
  closeOutputs(modelAvailability);
  const modelAvailabilityRun = await Lab.build(modelAvailability);
  check(modelAvailabilityRun.state === 'AUTHORITY_HOLD' && hasHold(modelAvailabilityRun, 'AUTHORITY_MODEL_SELF_AVAILABILITY'), 'model seat cannot certify candidate availability');

  const candidateAvailability = copy(active);
  candidateAvailability.cycle = governedCycle('candidate:fixture');
  closeOutputs(candidateAvailability);
  const candidateAvailabilityRun = await Lab.build(candidateAvailability);
  check(candidateAvailabilityRun.state === 'AUTHORITY_HOLD' && hasHold(candidateAvailabilityRun, 'AUTHORITY_CANDIDATE_SELF_AVAILABILITY'), 'candidate cannot certify its own availability');

  const tamperedRun = copy(run);
  tamperedRun.state = 'AVAILABLE_FOR_REUSE';
  check(!(await Lab.verify(tamperedRun)).pass, 'tampered derived run state fails verification');

  const unknown = copy(active);
  unknown.silent = true;
  await expectThrow(() => Lab.build(unknown), /unsupported fields/, 'unknown top-level fields are refused');
  const machinePath = copy(active);
  machinePath.runId = 'C:\\private\\run';
  await expectThrow(() => Lab.build(machinePath), /portable logical identifier/, 'machine paths are refused in persistent identifiers');
  const hiddenCandidateAction = copy(active);
  hiddenCandidateAction.cycle.candidate = {
    strategy: 'ADAPT', status: 'EXPERIMENTAL', artifactRef: ref('candidate:hidden-action', { hidden: true }),
    sourceMutationPerformed: false, installed: false, promoted: false, canon: false, execute: true
  };
  await expectThrow(() => Lab.build(hiddenCandidateAction), /unsupported fields/, 'undeclared candidate action fields are refused instead of silently discarded');
  const duplicateHandoff = copy(active);
  const duplicatePayload = ref('handoff:duplicate-payload', { duplicate: true });
  duplicateHandoff.handoffs = [
    { id: 'handoff:one', fromSeatId: 'mike', toSeatId: 'model-a', payloadRef: duplicatePayload, senderReceiptRef: ref('handoff:one:sender', {}), receiverReceiptRef: ref('handoff:one:receiver', {}) },
    { id: 'handoff:two', fromSeatId: 'mike', toSeatId: 'model-a', payloadRef: duplicatePayload, senderReceiptRef: ref('handoff:two:sender', {}), receiverReceiptRef: ref('handoff:two:receiver', {}) }
  ];
  await expectThrow(() => Lab.build(duplicateHandoff), /duplicate edges/, 'duplicate handoff edges are refused');

  console.log('\nBaseline Simulation Lab selftest: PASS (' + checks + ' checks)');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
