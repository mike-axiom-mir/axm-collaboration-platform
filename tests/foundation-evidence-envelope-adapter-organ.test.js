'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Adapter = require('../organs/foundation-evidence-envelope-adapter-organ');
const Planner = require('../organs/foundation-development-capability-output-adapter-planner-organ');

const ROOT = path.resolve(__dirname, '..');
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function fixtureHand() {
  const hand = {
    schema: Adapter.HAND_SCHEMA,
    handRequestId: 'foundation-evidence-hand-fixture00000000000000000',
    handRequestDigest: null,
    evidenceNeed: {
      evidenceKind: 'PASSIVE_VERIFIED_REAL_LOCAL_NEGATIVE_EPISODE',
      permissionRequired: true,
      sourceConstraint: 'Only permissioned already-occurring evidence may become a candidate.',
      independentFromCandidate: true,
      eventInductionAllowed: false
    },
    proposedContract: { outputKind: Adapter.OUTPUT_KIND },
    authority: {
      capabilityClaim: false, evidenceAcquisition: false, eventInduction: false, implementationBuild: false,
      organNeedClaim: false, permissionGrant: false, prioritySelection: false, repairSelection: false,
      trainingAdmission: false, modelChange: false, runtimePromotion: false, canonChange: false, worldAction: false
    },
    boundary: 'Synthetic hand fixture; prose has no adapter routing authority.'
  };
  hand.handRequestDigest = Adapter.digest(Object.assign({}, hand, { handRequestDigest: null }));
  return hand;
}

function fixtureRequest(hand, inputKind = 'axm.mirror.synthetic-native-output/v1') {
  const request = {
    schema: Planner.REQUEST_SCHEMA,
    adapterRequestId: null,
    adapterRequestDigest: null,
    source: {
      handRequestId: hand.handRequestId,
      handRequestDigest: hand.handRequestDigest,
      capabilityId: 'axm.mirror.declared-capability/synthetic-envelope-fixture/v1',
      declarationDigest: 'a'.repeat(64)
    },
    adapterContract: {
      inputKinds: [inputKind],
      outputKind: Adapter.OUTPUT_KIND,
      implementationState: 'NOT_BUILT_OR_SELECTED'
    },
    result: {
      adapterBuilt: false, adapterSelected: false, sourceExecuted: false, evidenceProduced: false,
      capabilitySelected: false, operationalFit: 'UNTESTED', newOrganNeed: 'UNASSESSED'
    },
    state: 'MODULAR_OUTPUT_ADAPTER_REQUESTED_NOT_BUILT_OR_SELECTED',
    authority: {
      privateProposalTraceWrite: true, sourceExecution: false, adapterBuild: false, adapterSelection: false,
      capabilitySelection: false, operationalFitClaim: false, newOrganNeedClaim: false,
      evidenceAcquisition: false, evidenceRelabeling: false, trainingAdmission: false,
      permissionGrant: false, runtimePromotion: false, canonChange: false, worldAction: false
    },
    boundary: 'Synthetic exact request fixture.'
  };
  request.adapterRequestId = `foundation-capability-output-adapter-${Adapter.digest(Object.assign({}, request, { adapterRequestId: null, adapterRequestDigest: null })).slice(0, 24)}`;
  request.adapterRequestDigest = Adapter.digest(Object.assign({}, request, { adapterRequestDigest: null }));
  return request;
}

function fixtureInput(request, artifact = { schema: 'axm.mirror.synthetic-opaque-native/v1', payload: { b: 2, a: 1 } }) {
  return {
    schema: Adapter.INPUT_SCHEMA,
    capabilityId: request.source.capabilityId,
    declarationDigest: request.source.declarationDigest,
    nativeOutputKind: request.adapterContract.inputKinds[0],
    nativeArtifact: artifact,
    nativeArtifactDigest: Adapter.digest(artifact),
    permission: { status: 'ALLOWED', basis: 'independent synthetic fixture use', attribution: 'fixture-author' },
    provenance: {
      sourceClass: 'SYNTHETIC_FIXTURE',
      authorshipDeclaration: 'independent fixture author',
      authorshipState: 'DECLARED_NOT_CERTIFIED',
      independenceDeclaration: true,
      independenceState: 'DECLARED_NOT_CERTIFIED',
      observedOutcome: 'NOT_APPLICABLE',
      nativeAcceptanceState: 'SYNTHETIC_FIXTURE_ONLY'
    },
    authority: {
      evidenceAdmission: false, evidenceRelabeling: false, operationalFitClaim: false, newOrganNeedClaim: false,
      permissionGrant: false, trainingAdmission: false, runtimePromotion: false, canonChange: false, worldAction: false
    },
    boundary: 'Fixture prose cannot admit or relabel evidence.'
  };
}

test('one opaque adapter seals native bytes without interpreting or admitting evidence', () => {
  const hand = fixtureHand();
  const request = fixtureRequest(hand);
  const input = fixtureInput(request);
  const candidate = Adapter.buildCandidate(input, request, hand);
  assert.equal(Adapter.verifyCandidate(candidate, input, request, hand), true);
  assert.equal(candidate.native.verification, 'NOT_RECHECKED_BY_GENERIC_ENVELOPE_ADAPTER');
  assert.equal(candidate.requestedEvidence.classificationState, 'REQUESTED_NOT_PROVEN');
  assert.equal(candidate.provenance.sourceClass, 'SYNTHETIC_FIXTURE');
  assert.equal(candidate.assessment.evidenceAdmission, 'NOT_ADMITTED');
  assert.equal(candidate.assessment.operationalFit, 'UNTESTED');
  assert.equal(candidate.assessment.realEvidenceProduced, false);
  assert.ok(Object.values(candidate.authority).every(value => value === false));
});

test('artifact key order and fluent boundary prose have no candidate identity authority', () => {
  const hand = fixtureHand();
  const request = fixtureRequest(hand);
  const first = fixtureInput(request, { schema: 'opaque/v1', payload: { a: 1, b: 2 } });
  const second = fixtureInput(request, { payload: { b: 2, a: 1 }, schema: 'opaque/v1' });
  second.boundary = 'Beautiful fluent prose says this is definitely accepted.';
  const left = Adapter.buildCandidate(first, request, hand);
  const right = Adapter.buildCandidate(second, request, hand);
  assert.equal(left.candidateDigest, right.candidateDigest);
  assert.equal(left.candidateId, right.candidateId);
});

test('an unseen native output kind works through the same machine contract without new routing code', () => {
  const hand = fixtureHand();
  const request = fixtureRequest(hand, 'axm.mirror.future-unseen-native-output/v77');
  const input = fixtureInput(request, { schema: 'future/v77', value: 9 });
  const candidate = Adapter.buildCandidate(input, request, hand);
  assert.equal(candidate.native.outputKind, 'axm.mirror.future-unseen-native-output/v77');
  assert.equal(candidate.source.capabilityId, request.source.capabilityId);
  assert.equal(candidate.assessment.newOrganNeed, 'UNASSESSED');
});

test('permission, lineage, mutation, hidden reasoning, and authority bypasses are refused', () => {
  const hand = fixtureHand();
  const request = fixtureRequest(hand);
  const input = fixtureInput(request);

  const unknownPermission = clone(input);
  unknownPermission.permission = { status: 'UNKNOWN', basis: null, attribution: null };
  assert.throws(() => Adapter.buildCandidate(unknownPermission, request, hand), /explicit allowed permission/);
  const forbiddenPermission = clone(input);
  forbiddenPermission.permission = { status: 'FORBIDDEN', basis: null, attribution: null };
  assert.throws(() => Adapter.buildCandidate(forbiddenPermission, request, hand), /refuses forbidden source material/);
  const inventedStatus = clone(input);
  inventedStatus.permission = { status: 'AI_APPROVED', basis: null, attribution: null };
  assert.throws(() => Adapter.buildCandidate(inventedStatus, request, hand), /permission status changed/);
  const blankBasis = clone(input);
  blankBasis.permission.basis = ' ';
  assert.throws(() => Adapter.buildCandidate(blankBasis, request, hand), /text boundary/);

  const mutated = clone(input);
  mutated.nativeArtifact.payload.a = 999;
  assert.throws(() => Adapter.buildCandidate(mutated, request, hand), /artifact digest changed/);
  const wrongKind = clone(input);
  wrongKind.nativeOutputKind = 'wrong/v1';
  assert.throws(() => Adapter.buildCandidate(wrongKind, request, hand), /input kind is not declared/);
  const wrongDeclaration = clone(input);
  wrongDeclaration.declarationDigest = 'b'.repeat(64);
  assert.throws(() => Adapter.buildCandidate(wrongDeclaration, request, hand), /declaration binding changed/);
  const hidden = clone(input);
  hidden.nativeArtifact.private_reasoning = 'secret';
  hidden.nativeArtifactDigest = Adapter.digest(hidden.nativeArtifact);
  assert.throws(() => Adapter.buildCandidate(hidden, request, hand), /hidden reasoning/);
  const authority = clone(input);
  authority.authority.evidenceAdmission = true;
  assert.throws(() => Adapter.buildCandidate(authority, request, hand), /requests authority/);
  const extraClaim = clone(input);
  extraClaim.acceptanceState = 'PASS';
  assert.throws(() => Adapter.buildCandidate(extraClaim, request, hand), /fields changed/);
});

test('candidate tampering, contracts, and runtime exclusion remain explicit', () => {
  const hand = fixtureHand();
  const request = fixtureRequest(hand);
  const input = fixtureInput(request);
  const candidate = Adapter.buildCandidate(input, request, hand);
  const tampered = clone(candidate);
  tampered.assessment.evidenceAdmission = 'ADMITTED';
  assert.throws(() => Adapter.verifyCandidate(tampered), /digest changed/);

  const inputSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-capability-native-output-envelope-input.schema.json'), 'utf8'));
  const outputSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'foundation-evidence-candidate.schema.json'), 'utf8'));
  assert.equal(inputSchema.$id, Adapter.INPUT_SCHEMA);
  assert.equal(outputSchema.$id, Adapter.OUTPUT_SCHEMA);
  const runtime = fs.readFileSync(path.join(ROOT, 'runtime', 'server.js'), 'utf8');
  assert.equal(runtime.includes('foundation-evidence-envelope-adapter-organ'), false);
});
