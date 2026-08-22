#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const CuratedSession = require('../2026-08-22-v0.7.0-release-integration/curated-session-evidence');
const Pilot = require('../../../shared/code-capability-fabric/slow-creation-pilot-v1');

const root = __dirname;
const fabricRoot = path.resolve(root, '../../../shared/code-capability-fabric');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const implementationCommit = '09c6bce30e50d9a960848a3c953c35cedcac6742';
const priorTip = '8ad50f7573d3e58c16f77706c4474cd77745d8bd';

[
  'AUDIT_FINDINGS.json',
  'CAPABILITY_GAP_REPORT.json',
  'CREATION_TRIAL_RECEIPT.json',
  'CURATION_RECEIPT.json',
  'EVIDENCE_ROUTE.json',
  'INTEGRATION_HANDOFF.json',
  'SCOUT_INVENTORY_AFTER.json',
  'SCOUT_INVENTORY_BEFORE.json',
  'SCOUT_REQUIREMENTS.json',
  'SESSION_SEAL.json',
  'VERIFICATION_RECEIPT.json'
].forEach(json);

const session = CuratedSession.load(root, 18);
const events = session.events;
const seal = session.seal;
if (events) assert.deepEqual(events.map((item) => item.sequence),
  Array.from({ length: 18 }, (_, index) => index + 1));

const curation = json('CURATION_RECEIPT.json');
assert.equal(curation.seal_digest, seal.sha256);
assert.equal(curation.durable_events_preserved, seal.eventLines);
assert.equal(curation.external_trial_retention.candidateCodeExecuted, false);
assert.equal(curation.privacy.absoluteMachinePathsRetained, false);
assert.match(curation.authority_used,
  /no deletion of retained trials, merge, install, publish, promotion, hardware, machine-default, learning, or CANON authority/);

const requirements = json('SCOUT_REQUIREMENTS.json');
const before = json('SCOUT_INVENTORY_BEFORE.json');
const after = json('SCOUT_INVENTORY_AFTER.json');
assert.ok(requirements.requirements.some((item) =>
  item.id === 'creation.inert-candidate.emit' && item.required));
assert.equal(before.capabilities.find((item) =>
  item.id === 'creation.inert-candidate.emit').status, 'unavailable');
assert.equal(after.capabilities.find((item) =>
  item.id === 'creation.inert-candidate.emit').status, 'available');
assert.equal(after.capabilities.find((item) =>
  item.id === 'consent.declaration.replay-prevent').status, 'unavailable');
assert.equal(after.capabilities.find((item) =>
  item.id === 'creation.runtime-quality.verify').status, 'unavailable');

const gap = json('CAPABILITY_GAP_REPORT.json');
assert.equal(gap.before.comparatorOverall, 'BLOCKED');
assert.equal(gap.before.requiredSlowCreationRung, 'BLOCKED');
assert.equal(gap.after.comparatorOverall, 'READY');
assert.equal(gap.after.requiredSlowCreationRung, 'READY');
assert.equal(gap.after.missionOverall, 'DEGRADED');
assert.ok(gap.after.missingConsequentialCapabilities.includes(
  'consent.declaration.replay-prevent'));
assert.ok(gap.after.missingConsequentialCapabilities.includes(
  'machine-host.fabric-create.fixed-action'));
assert.ok(gap.after.missingConsequentialCapabilities.includes(
  'learning.admission.decide'));

const trial = json('CREATION_TRIAL_RECEIPT.json');
assert.equal(Pilot.normalizeReceipt(trial).receiptDigest, trial.receiptDigest);
const built = Pilot.buildCandidateFiles(Pilot.buildExampleInput().intent);
assert.deepEqual(trial.candidateFiles, built.files.map((file) => ({
  path: file.path,
  sha256: Pilot.sha256(file.bytes),
  byteLength: file.bytes.length
})));
assert.equal(trial.resourceObservation.candidateBytes, built.totalBytes);
assert.equal(trial.nurseryStatus, 'READY_FOR_LATER_INTAKE');
assert.equal(trial.truth.candidateCodeExecuted, false);
assert.equal(trial.truth.interactiveDeclarationReplayPrevented, false);
assert.equal(trial.truth.machineDefaultActivated, false);
assert.equal(trial.truth.persistentLearningAdmitted, false);

const verification = json('VERIFICATION_RECEIPT.json');
assert.equal(verification.testedCommit, implementationCommit);
assert.equal(verification.requiredChecks.length, 10);
assert.ok(verification.requiredChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.focusedChecks.length, 16);
assert.ok(verification.focusedChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.staticAndNativeChecks.length, 6);
assert.ok(verification.staticAndNativeChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.summary.warningBaseline, 41);
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.summary.pilotCandidateFiles, 6);
assert.equal(verification.summary.pilotCandidateBytes, 7372);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.candidateCodeExecuted, false);
assert.equal(verification.truth.humanAuthenticationVerified, false);
assert.equal(verification.truth.declarationReplayPrevented, false);
assert.equal(verification.truth.machineDefaultActivated, false);
assert.equal(verification.truth.persistentLearningAdmitted, false);

const evidence = json('EVIDENCE_ROUTE.json');
assert.equal(evidence.implementationCommit, implementationCommit);
assert.equal(evidence.claims.find((item) =>
  item.id === 'actual-candidate-emission').verdict, 'PASS');
assert.equal(evidence.claims.find((item) =>
  item.id === 'independent-structural-readiness').verdict, 'PASS');
assert.equal(evidence.claims.find((item) =>
  item.id === 'candidate-runtime-behavior').verdict, 'UNKNOWN_NOT_RUN');
assert.equal(evidence.claims.find((item) =>
  item.id === 'authenticated-human-consent').verdict, 'UNKNOWN_NOT_IMPLEMENTED');
assert.equal(evidence.claims.find((item) =>
  item.id === 'machine-wide-fabric-default').verdict, 'FALSE_NOT_ACTIVATED');
assert.equal(evidence.claims.find((item) =>
  item.id === 'persistent-learning').verdict, 'FALSE_NOT_ADMITTED');

const audit = json('AUDIT_FINDINGS.json');
assert.equal(audit.auditedImplementationCommit, implementationCommit);
assert.deepEqual(audit.rootPrecedence.map((item) => item.root), [
  'truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'
]);
assert.ok(audit.findings.some((item) =>
  item.id === 'windows-dot-segment-alias' && item.status === 'FIXED'));
assert.ok(audit.findings.some((item) =>
  item.id === 'declaration-replay' && item.status === 'BLOCKED'));
assert.ok(audit.findings.some((item) =>
  item.id === 'runtime-quality' && item.status === 'UNKNOWN_NOT_RUN'));
assert.equal(audit.trialObservations.find((item) => item.id === '001').finalProof, false);
assert.equal(audit.trialObservations.find((item) => item.id === '002').finalProof, true);
assert.equal(audit.authority.humanAuthenticationVerified, false);
assert.equal(audit.authority.machineDefaultActivated, false);
assert.equal(audit.authority.persistentLearningAdmitted, false);

const handoff = json('INTEGRATION_HANDOFF.json');
assert.equal(handoff.source.implementationCommit, implementationCommit);
assert.equal(handoff.source.priorReceiptTip, priorTip);
assert.equal(handoff.changedPaths.length, 8);
assert.ok(handoff.changedPaths.every((item) =>
  item.startsWith('shared/code-capability-fabric/')));
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.taskRelevantStatusEntries, 0);
assert.equal(handoff.observedCanonicalCheckout.sourceBranchRefRegistered, true);
assert.equal(handoff.observedCanonicalCheckout.containsPriorReceiptTip, false);
assert.equal(handoff.driftRecheck.headChanged, false);
assert.equal(handoff.driftRecheck.busyStatusChanged, true);
assert.equal(handoff.authority.fourRootsTechnicalGateFirst, true);
assert.equal(handoff.authority.mergePerformed, false);
assert.ok(handoff.exactReadOnlyReviewActionsFromCanonicalRepository.every((item) =>
  item.includes(implementationCommit)));
assert.ok(handoff.exactSafeReviewWorktreeCommandsFromCanonicalRepository.some((item) =>
  item.includes(handoff.source.branch)));
assert.ok(handoff.exactImplementationIntegrationCommandAfterCleanTargetAndAncestryChecks
  .includes(handoff.source.branch));

const contract = JSON.parse(fs.readFileSync(
  path.join(fabricRoot, 'module-slow-creation-pilot-v1.contract.json'), 'utf8'));
assert.equal(contract.status, 'TEST');
assert.deepEqual(contract.rootsGate,
  ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
assert.deepEqual(contract.permissions, ['candidate.output-write']);
assert.ok(contract.boundaries.refuses.includes('generated-code-execution'));
assert.ok(contract.boundaries.refuses.includes('machine-wide-default-activation'));
assert.ok(contract.boundaries.refuses.includes('persistent-learning-admission'));

const receiptText = fs.readdirSync(root)
  .filter((name) => fs.statSync(path.join(root, name)).isFile())
  .map(read)
  .join('\n');
assert.ok(!/[A-Z]:\\/.test(receiptText),
  'receipt must not retain absolute Windows machine paths');
assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY/.test(receiptText),
  'receipt must not retain private key material');
assert.ok(!/sk-[A-Za-z0-9]{12,}/.test(receiptText),
  'receipt must not retain API-key-like material');
assert.ok(!/authorization:\s*bearer/i.test(receiptText),
  'receipt must not retain authorization headers');

console.log('Code Capability Fabric slow-creation pilot receipt self-test: PASS');
