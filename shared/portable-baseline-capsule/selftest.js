#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Capsule = require('./portable-baseline-capsule');
const Loop = require('../verified-capability-loop/verified-capability-loop');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

function rejects(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  console.log('PASS ' + message);
}

const at = '2026-08-19T12:00:00.000Z';
const capsuleSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'portable-baseline-capsule.schema.json'), 'utf8'));
const comparisonSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'portable-baseline-comparison.schema.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));

check(capsuleSchema.$id === Capsule.CAPSULE_SCHEMA, 'capsule schema identity matches the implementation');
check(comparisonSchema.$id === Capsule.COMPARISON_SCHEMA, 'comparison schema identity matches the implementation');
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0, 'module remains TEST with no permissions or writes');
check(contract.boundaries.refuses.includes('source-execution') && contract.boundaries.refuses.includes('automatic-canon'), 'module refuses execution and automatic CANON');
check(contract.version === 'v0.2' && contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'v0.2 contract declares strict representation closure');
check(Capsule.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
rejects(() => Capsule.stableStringify({ lost: undefined }), /unsupported undefined/i, 'unsafe canonical state is refused');

function ref(id, value, schema) {
  return Capsule.reference(value, { id, schema: schema || 'axm.fixture/v1' });
}

function common(kind, id, version) {
  return {
    capsuleId: 'capsule:' + id,
    capturedAt: at,
    subject: { kind, id, version },
    contentRef: ref(id + ':content', { content: id }),
    configRef: ref(id + ':config', { config: version }),
    sourceRefs: [ref(id + ':source', { source: id })],
    newInformationRefs: [],
    generatedViews: [{
      viewId: 'view:summary',
      viewRef: ref(id + ':view', { view: id }),
      state: 'CURRENT',
      checkedAt: at,
      reason: 'Synthetic fixture view was rebuilt from the declared content and configuration references.'
    }],
    limitations: ['Synthetic fixture proves contract behavior only.'],
    preservedSourceFields: [{
      field: 'vendor.optional-field',
      sourceRef: ref(id + ':preserved', { optional: true }),
      reason: 'The portable core does not interpret this source-specific field.'
    }],
    extensions: [{
      namespace: 'fixture.adapter-note',
      extensionRef: ref(id + ':extension', { extension: id }),
      note: 'Digest-bound fixture extension.'
    }]
  };
}

function softwareInput(overrides) {
  const input = common('SOFTWARE_REPOSITORY', 'workshop', 'c6e79092');
  input.adapter = {
    repositoryId: 'axm/workshop',
    versionOrCommit: 'c6e7909267f51a6fa14395e46d6917678ef87d06',
    workingTree: {
      state: 'DIRTY',
      statusRef: ref('workshop:git-status', { status: 'synthetic dirty fixture' }, 'axm.git-status-observation/v1')
    }
  };
  return Object.assign(input, overrides || {});
}

const software = Capsule.build(softwareInput());
check(Capsule.verify(software).pass, 'software capsule rebuilds and verifies exactly');
check(software.adapter.versionOrCommit.startsWith('c6e79092') && software.adapter.workingTree.state === 'DIRTY', 'software commit and dirty worktree remain separate');
check(software.freshness.state === 'CURRENT' && !software.freshness.refreshRequired, 'all-current generated views derive CURRENT freshness');
check(software.truth.authority === 'IDENTITY_AND_EVIDENCE_LINKING_ONLY' && software.truth.automaticWrite === false, 'capsule grants identity linking only and no write authority');
check(software.preservedSourceFields[0].sourceRef.sha256.startsWith('sha256:'), 'unsupported source field survives by digest-bound reference');

const loopBaseline = Capsule.toVerifiedCapabilityBaseline(software);
const loopReceipt = Loop.build({
  cycleId: 'cycle:portable-baseline-fixture',
  capabilityId: 'simulation.baseline.capsule.verify',
  generatedAt: at,
  baseline: loopBaseline,
  need: {
    id: 'need:portable-baseline',
    statement: 'A baseline needs portable exact identity before simulation claims can be compared.',
    sourceRef: Loop.reference({ need: true }, { id: 'need-source', schema: 'axm.need/v1' })
  },
  gap: {
    state: 'NO_GAP',
    reason: 'The synthetic fixture demonstrates the compatible reference handoff.',
    reportRef: Loop.reference({ gap: false }, { id: 'gap-report', schema: 'axm.gap-report/v1' }),
    existingCapabilityRef: loopBaseline.receiptRef
  },
  provenance: [],
  candidate: null,
  verification: null,
  decision: null,
  availability: null,
  refresh: { trigger: 'NEW_INFORMATION', checkedAt: at, due: false, reason: 'Fixture capsule is unchanged.' }
});
check(Loop.verify(loopReceipt).pass && loopReceipt.baseline.receiptRef.sha256 === software.capsuleDigest, 'capsule reference is accepted by the Verified Capability Loop without authority transfer');

const tampered = JSON.parse(JSON.stringify(software));
tampered.subject.version = 'silently changed';
check(!Capsule.verify(tampered).pass, 'tampered capsule fails exact rebuild verification');
rejects(() => Capsule.build(Object.assign(softwareInput(), { unknownTopLevel: true })), /unsupported fields/, 'unknown capsule fields are refused instead of silently discarded');
const machinePath = softwareInput();
machinePath.subject.id = 'C:\\private\\workshop';
rejects(() => Capsule.build(machinePath), /portable logical identifier/, 'machine paths are refused in persistent identifiers');
const unknownSoftware = softwareInput();
unknownSoftware.adapter.silent = true;
rejects(() => Capsule.build(unknownSoftware), /unsupported fields/, 'unknown software adapter fields are refused');

function mirrorInput() {
  const input = common('MIRROR_STATE', 'mirror:original', 'mirror-state-v1');
  input.adapter = {
    originalBaselineRef: ref('mirror:original-baseline', { original: true }, 'axm.mirror-original-state/v1'),
    privateLessons: {
      stateRef: ref('mirror:private-lessons', { privateDigestOnly: true }, 'axm.mirror-private-lessons-state/v1'),
      visibility: 'PRIVATE'
    },
    challenger: {
      stateRef: ref('mirror:challenger', { disposable: true }, 'axm.mirror-challenger-state/v1'),
      disposable: true
    }
  };
  return input;
}

const mirror = Capsule.build(mirrorInput());
check(Capsule.verify(mirror).pass, 'Mirror capsule rebuilds and verifies exactly');
check(mirror.adapter.privateLessons.visibility === 'PRIVATE' && mirror.adapter.challenger.disposable === true, 'Mirror private lessons and disposable challenger remain explicit');
check(Object.keys(mirror.adapter.privateLessons).sort().join(',') === 'stateRef,visibility', 'Mirror capsule retains only a private-state reference and visibility, not private bytes');
const fusedMirror = mirrorInput();
fusedMirror.adapter.challenger.stateRef = fusedMirror.adapter.originalBaselineRef;
rejects(() => Capsule.build(fusedMirror), /must remain distinct/, 'Mirror original and challenger identities cannot be fused');
const durableChallenger = mirrorInput();
durableChallenger.adapter.challenger.disposable = false;
rejects(() => Capsule.build(durableChallenger), /explicitly disposable/, 'Mirror challenger cannot lose its disposable boundary');

function specialistInput() {
  const input = common('SPECIALIST_MASK', 'specialist:code-mirror', 'mask-v2');
  input.adapter = {
    hostModel: {
      providerFamily: 'fixture-provider',
      modelId: 'fixture-model',
      version: 'fixture-version',
      receiptRef: ref('specialist:host-model', { host: 'fixture-model' }, 'axm.host-model-declaration/v1')
    },
    mask: {
      id: 'workshop-body:mirror-code-clone',
      schema: 'axm.specialist-mask/v2',
      version: '0.2.0+specialist.1.0.0',
      packageRef: ref('specialist:mask-package', { mask: 'fixture' }, 'axm.specialist-package/v1')
    },
    allowedCapabilities: ['context.read', 'tests.run'],
    evidenceCeiling: 'SYNTHETIC_ONLY',
    permissionGrant: 'NONE',
    identityEffect: 'OVERLAY_ONLY'
  };
  return input;
}

const specialist = Capsule.build(specialistInput());
check(Capsule.verify(specialist).pass, 'specialist-mask capsule rebuilds and verifies exactly');
check(specialist.adapter.hostModel.modelId === 'fixture-model' && specialist.adapter.mask.schema === 'axm.specialist-mask/v2', 'specialist capsule names host model and mask schema');
check(specialist.adapter.permissionGrant === 'NONE' && specialist.adapter.identityEffect === 'OVERLAY_ONLY', 'specialist capsule preserves no-permission identity overlay');
check(specialist.adapter.evidenceCeiling === 'SYNTHETIC_ONLY', 'specialist evidence ceiling is explicit and does not claim runtime proof');
const permissionSpecialist = specialistInput();
permissionSpecialist.adapter.permissionGrant = 'workspace.write';
rejects(() => Capsule.build(permissionSpecialist), /permissionGrant must be NONE/, 'specialist capsule refuses permission grants');
const identitySpecialist = specialistInput();
identitySpecialist.adapter.identityEffect = 'MERGED';
rejects(() => Capsule.build(identitySpecialist), /identityEffect must be OVERLAY_ONLY/, 'specialist capsule refuses identity fusion');
const duplicateCapabilities = specialistInput();
duplicateCapabilities.adapter.allowedCapabilities.push('tests.run');
rejects(() => Capsule.build(duplicateCapabilities), /duplicate items/, 'specialist allowed capabilities must be unique');

const staleInput = softwareInput();
staleInput.generatedViews[0].state = 'STALE';
staleInput.generatedViews[0].reason = 'The declared content reference changed after this view was produced.';
const stale = Capsule.build(staleInput);
check(stale.freshness.state === 'REFRESH_REQUIRED' && stale.freshness.reasonCodes[0].includes('STALE'), 'stale generated view derives a visible refresh requirement');

const sameAgain = Capsule.build(Object.assign(softwareInput(), { capsuleId: 'capsule:workshop:later', capturedAt: '2026-08-19T13:00:00.000Z' }));
const noNew = Capsule.compare(software, sameAgain, { comparisonId: 'comparison:no-new', comparedAt: '2026-08-19T13:01:00.000Z' });
check(noNew.state === 'NO_NEW_INFORMATION' && noNew.refreshRequired === false, 'unchanged substantive baseline returns NO_NEW_INFORMATION');
check(Capsule.verifyComparison(noNew, software, sameAgain).pass, 'no-new-information receipt verifies by deterministic rebuild');

const newInfoInput = Object.assign(softwareInput(), { capsuleId: 'capsule:workshop:new-information' });
newInfoInput.newInformationRefs = [ref('workshop:new-observation', { observed: 'new' }, 'axm.new-information/v1')];
const newInfo = Capsule.build(newInfoInput);
const newInfoComparison = Capsule.compare(software, newInfo, { comparisonId: 'comparison:new-information', comparedAt: '2026-08-19T13:02:00.000Z' });
check(newInfoComparison.state === 'NEW_INFORMATION' && newInfoComparison.reasonCodes.includes('NEW_INFORMATION_REFS_CHANGED'), 'new evidence without baseline mutation returns NEW_INFORMATION');

const changedContentInput = Object.assign(softwareInput(), { capsuleId: 'capsule:workshop:changed-content' });
changedContentInput.contentRef = ref('workshop:content', { content: 'changed' });
const changedContent = Capsule.build(changedContentInput);
const baselineChanged = Capsule.compare(software, changedContent, { comparisonId: 'comparison:baseline-changed', comparedAt: '2026-08-19T13:03:00.000Z' });
check(baselineChanged.state === 'BASELINE_CHANGED' && baselineChanged.reasonCodes.includes('CONTENTREF_CHANGED'), 'content digest change returns BASELINE_CHANGED');

const incomparable = Capsule.compare(software, mirror, { comparisonId: 'comparison:incomparable', comparedAt: '2026-08-19T13:04:00.000Z' });
check(incomparable.state === 'INCOMPARABLE' && incomparable.sameSubject === false, 'different subject identities are incomparable');
check(incomparable.automaticAction === false, 'comparison receipts never authorize automatic action');

const alteredComparison = JSON.parse(JSON.stringify(noNew));
alteredComparison.state = 'BASELINE_CHANGED';
check(!Capsule.verifyComparison(alteredComparison, software, sameAgain).pass, 'tampered comparison state fails deterministic verification');

console.log('Portable Baseline Capsule selftest: ' + checks + ' checks passed.');
