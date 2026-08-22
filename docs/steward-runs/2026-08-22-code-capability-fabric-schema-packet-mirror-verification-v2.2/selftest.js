'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Verifier = require('../../../shared/code-capability-fabric/schema-packet-mirror-verifier-v1');

const runRoot = __dirname;
const sourceRoot = path.resolve(
  runRoot,
  '../2026-08-22-code-capability-fabric-schema-compilation-v2.1/axm-fabric-creation-pilot-schema-trial-001'
);
const compositionRoot = path.resolve(
  runRoot,
  '../2026-08-22-code-capability-fabric-blueprint-composition-v2.0/axm-fabric-creation-pilot-blueprint-trial-001'
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(runRoot, file), 'utf8'));
}

function packet(role) {
  return {
    role,
    files: Verifier.EXPECTED_FILES.map((file) => ({
      path: file,
      bytes: fs.readFileSync(path.join(sourceRoot, file))
    }))
  };
}

const source = packet('SOURCE');
const exactMirror = packet('MIRROR');
const exactInput = Verifier.buildExampleInput(
  fs.readFileSync(path.join(compositionRoot, 'capability-blueprint.json')),
  fs.readFileSync(path.join(compositionRoot, 'composition-receipt.json')),
  source,
  exactMirror
);
const matchReceipt = readJson('MATCH_RECEIPT.json');
Verifier.verifyReceipt(matchReceipt, exactInput);
assert.equal(matchReceipt.status, 'MATCH');
assert.equal(matchReceipt.receiptDigest, 'sha256:f2aa77af4daa98bf7728691af5fbc26d874bef1cc4bea9df361577fec2125ecc');
assert.equal(matchReceipt.source.totalBytes, 13931);
assert.equal(matchReceipt.fileDelta.unchanged.length, 4);
assert.equal(matchReceipt.truth.exactPacketByteEqualityProven, true);
assert.equal(matchReceipt.truth.fullCloneCompletenessProven, false);
assert.equal(matchReceipt.truth.mirrorCodeCloneExecuted, false);
assert.equal(matchReceipt.truth.fileContentRetainedInReceipt, false);

const driftMirror = packet('MIRROR');
const changed = driftMirror.files.find((item) => item.path === 'acceptance-matrix.json');
changed.bytes[changed.bytes.length - 2] ^= 1;
const driftInput = Verifier.buildExampleInput(
  fs.readFileSync(path.join(compositionRoot, 'capability-blueprint.json')),
  fs.readFileSync(path.join(compositionRoot, 'composition-receipt.json')),
  packet('SOURCE'),
  driftMirror
);
const driftReceipt = readJson('DRIFT_RECEIPT.json');
Verifier.verifyReceipt(driftReceipt, driftInput);
assert.equal(driftReceipt.status, 'DRIFT');
assert.equal(driftReceipt.receiptDigest, 'sha256:ab97f8627d1ad1f03b2a2af04e40e06fadffe2901a7feb1c28ea3f384c9cf2d4');
assert.equal(driftReceipt.fileDelta.changed.length, 1);
assert.equal(driftReceipt.fileDelta.changed[0].path, 'acceptance-matrix.json');
assert.ok(driftReceipt.mirror.issues.includes('COMPILATION_ARTIFACT_VERIFICATION_FAILED'));
assert.equal(driftReceipt.truth.mirrorDriftObserved, true);
assert.equal(driftReceipt.truth.exactPacketByteEqualityProven, false);

const before = readJson('CAPABILITY_GAP_BEFORE.json');
const after = readJson('CAPABILITY_GAP_AFTER.json');
assert.equal(before.overall, 'BLOCKED');
assert.equal(before.requirements.find((item) => item.id === 'compare-one-grounded-schema-packet-copy').status, 'BLOCKED');
assert.equal(after.overall, 'DEGRADED');
assert.equal(after.requirements.find((item) => item.id === 'compare-one-grounded-schema-packet-copy').status, 'READY');
assert.equal(after.requirements.find((item) => item.id === 'preserve-detached-no-authority-ceiling').status, 'READY');
assert.ok(after.missingCapabilities.includes('mirror.git-object-set.compare'));
assert.ok(after.missingCapabilities.includes('mirror.clone-completeness.verify'));
assert.ok(after.missingCapabilities.includes('consent.human-decision.authenticate'));

const verification = readJson('VERIFICATION_RECEIPT.json');
assert.equal(verification.testedImplementationCommit, 'aabc7f9d8fcd22e2e2b37ead41c8bb6d441a3efd');
assert.equal(verification.summary.requiredCommandSuitesPassed, 10);
assert.equal(verification.summary.focusedCommandSuitesPassed, 24);
assert.equal(verification.summary.mirrorVerifierChecksPassed, 130);
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.unfinishedMirrorCloneExecuted, false);
assert.equal(verification.truth.gitObjectDatabaseInspected, false);
assert.equal(verification.truth.pushPerformed, false);
assert.equal(verification.truth.mergePerformed, false);

const audit = readJson('AUDIT_FINDINGS.json');
assert.ok(audit.findings.some((item) => item.id === 'direct-byte-equality' && item.disposition === 'ADDRESSED'));
assert.ok(audit.findings.some((item) => item.id === 'windows-path-aliases' && item.disposition === 'PARTIAL'));
assert.ok(audit.findings.some((item) => item.id === 'resource-enforcement' && item.disposition === 'PARTIAL'));
assert.ok(audit.findings.some((item) => item.id === 'unfinished-mirror-clone' && item.disposition === 'HELD_EXPERIMENTAL'));
assert.ok(audit.findings.some((item) => item.id === 'future-executor' && item.disposition === 'MIKE_DECISION_REQUIRED'));
assert.ok(audit.findings.some((item) => item.id === 'future-code-rights' && item.disposition === 'MIKE_DECISION_REQUIRED'));

const route = readJson('EVIDENCE_ROUTE.json');
assert.ok(route.claims.some((item) => item.verdict === 'UNRUN'));
assert.ok(route.claims.some((item) => item.verdict === 'NOT_AUTHORIZED'));
assert.ok(route.claims.some((item) => item.verdict === 'NOT_APPLICABLE'));

const handoff = readJson('INTEGRATION_HANDOFF.json');
assert.equal(handoff.source.branch, 'codex/code-capability-fabric-mirror-verification-v2.2');
assert.equal(handoff.source.baseCommit, '0c60dd8ec209d5a43852c9a1f968476a4cf311d5');
assert.equal(handoff.source.implementationCommit, 'aabc7f9d8fcd22e2e2b37ead41c8bb6d441a3efd');
assert.equal(handoff.source.networkPushRequiredForLocalReview, false);
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.containsBaseCommit, false);
assert.equal(handoff.observedCanonicalCheckout.taskRelevantStatusEntries, 0);
assert.equal(handoff.driftRecheck.headChanged, false);
assert.equal(handoff.driftRecheck.busyStatusChanged, false);
assert.equal(handoff.driftRecheck.taskRelevantOverlapObserved, false);
assert.equal(handoff.authority.pushPerformed, false);
assert.equal(handoff.authority.mergePerformed, false);
assert.equal(handoff.authority.canonChanged, false);
assert.ok(handoff.exactImplementationIntegrationCommandAfterCleanTargetAndAncestryChecks.includes('--no-commit'));
assert.ok(handoff.safeIntegrationConditions.some((item) => item.includes('Mike decide')));
assert.ok(handoff.safeIntegrationConditions.some((item) => item.includes('Do not push')));

const afterInventory = readJson('SCOUT_INVENTORY_AFTER.json');
assert.equal(afterInventory.workspaceStatus, 'ONLY_BOUNDED_STEWARD_EVIDENCE_UNCOMMITTED');
assert.equal(afterInventory.activeRelevantSharedSeams, 0);
assert.equal(afterInventory.unfinishedMirrorCloneExecuted, false);
assert.equal(afterInventory.canonicalCheckout.taskRelevantStatusEntries, 0);
assert.equal(afterInventory.canonicalCheckoutTouched, false);

const eventLines = fs.readFileSync(path.join(runRoot, 'SESSION_EVENTS.jsonl'), 'utf8').trim().split(/\r?\n/);
const events = eventLines.map((line) => JSON.parse(line));
assert.equal(events.length, 17);
events.forEach((event, index) => assert.equal(event.seq, index + 1));
assert.equal(events.filter((event) => event.event === 'audit-correction').length, 4);
assert.ok(events.some((event) => event.event === 'scope-boundary'));

const seal = readJson('SESSION_SEAL.json');
assert.equal(seal.source, 'code-capability-fabric-schema-packet-mirror-verification-v2.2');
assert.equal(seal.eventLines, 17);
assert.equal(seal.invalidJsonLines, 0);
assert.equal(seal.sha256, 'b4122314087a41b23fbdad392baa32813e61e29b3e6dd0a31637bbb7b4324817');
const curation = readJson('CURATION_RECEIPT.json');
assert.equal(curation.sessionSeal.sha256, seal.sha256);
assert.equal(curation.truth.packetContentsDuplicated, false);
assert.equal(curation.truth.privateContentCommitted, false);
assert.equal(curation.truth.machinePathsCommitted, false);
assert.equal(curation.truth.unfinishedMirrorCloneExecuted, false);
assert.equal(curation.truth.pushPerformed, false);

const allEvidenceText = fs.readdirSync(runRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name !== 'selftest.js')
  .map((entry) => fs.readFileSync(path.join(runRoot, entry.name), 'utf8'))
  .join('\n');
assert.ok(!/[A-Z]:\\|C:\/Users\/|D:\/AXM_ACTIVE|D:\/CODEX_WORKTREES/i.test(allEvidenceText));
assert.ok(!/sk-[a-z0-9]{16,}|authorization:\s*bearer/i.test(allEvidenceText));
assert.ok(!allEvidenceText.includes('"bytes":'));

console.log('Code Capability Fabric schema-packet mirror-verification receipt selftest: PASS');
