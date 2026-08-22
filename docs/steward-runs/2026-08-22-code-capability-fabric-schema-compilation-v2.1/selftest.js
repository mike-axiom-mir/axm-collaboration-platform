'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Compiler = require('../../../shared/code-capability-fabric/blueprint-schema-compiler-v1');
const CuratedSession = require('../2026-08-22-v0.7.0-release-integration/curated-session-evidence');

const runRoot = __dirname;
const sourceRoot = path.resolve(
  runRoot,
  '../2026-08-22-code-capability-fabric-blueprint-composition-v2.0/axm-fabric-creation-pilot-blueprint-trial-001'
);
const trialRoot = path.join(runRoot, 'axm-fabric-creation-pilot-schema-trial-001');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(runRoot, file), 'utf8'));
}

const input = Compiler.buildExampleInput(
  fs.readFileSync(path.join(sourceRoot, 'capability-blueprint.json')),
  fs.readFileSync(path.join(sourceRoot, 'composition-receipt.json'))
);
const receipt = readJson('axm-fabric-creation-pilot-schema-trial-001/schema-compilation-receipt.json');
const artifactBytes = {
  [Compiler.INPUT_SCHEMA_FILE]: fs.readFileSync(path.join(trialRoot, Compiler.INPUT_SCHEMA_FILE)),
  [Compiler.OUTPUT_SCHEMA_FILE]: fs.readFileSync(path.join(trialRoot, Compiler.OUTPUT_SCHEMA_FILE)),
  [Compiler.MATRIX_FILE]: fs.readFileSync(path.join(trialRoot, Compiler.MATRIX_FILE))
};
const verified = Compiler.verifyCompilationArtifacts(receipt, artifactBytes, input);

assert.equal(verified.receipt.receiptDigest, 'sha256:01d348528a752eb7c45ffee6375bbaa9738d34a82fe17af1c79f7d733c2ef9f4');
assert.equal(verified.matrix.matrixDigest, 'sha256:aad58ba7963b6e280487c4917272323e99acc10ae54d0ebc330d61b03233d5ce');
assert.ok(verified.matrix.cases.every((item) => item.verdict === 'UNRUN'));
assert.ok(verified.matrix.desiredOutcomeReviews.every((item) => item.reviewStatus === 'HUMAN_REVIEW_REQUIRED'));
assert.equal(verified.receipt.resourceObservation.totalFilesWritten, 4);
assert.equal(verified.receipt.resourceObservation.totalBytesWritten, 13931);
assert.equal(verified.receipt.truth.generatedExecutableCodePresent, false);
assert.equal(verified.receipt.truth.candidateCodeExecuted, false);
assert.equal(verified.receipt.truth.machineDefaultActivated, false);
assert.equal(verified.receipt.truth.persistentLearningAdmitted, false);
assert.equal(verified.receipt.truth.canonChanged, false);

const trialFiles = fs.readdirSync(trialRoot).sort();
assert.deepEqual(trialFiles, [
  'acceptance-matrix.json',
  'input.schema.json',
  'output.schema.json',
  'schema-compilation-receipt.json'
]);
assert.ok(trialFiles.every((file) => file.endsWith('.json')));

const before = readJson('CAPABILITY_GAP_BEFORE.json');
const after = readJson('CAPABILITY_GAP_AFTER.json');
assert.equal(before.overall, 'BLOCKED');
assert.equal(before.requirements.find((item) => item.id === 'compile-one-grounded-blueprint-schema-packet').status, 'BLOCKED');
assert.equal(after.overall, 'DEGRADED');
assert.equal(after.requirements.find((item) => item.id === 'compile-one-grounded-blueprint-schema-packet').status, 'READY');
assert.equal(after.requirements.find((item) => item.id === 'preserve-no-execution-authority-ceiling').status, 'READY');
assert.deepEqual(after.missingCapabilities, [
  'provider.blueprint-to-code.generate',
  'runtime.semantic-quality.verify',
  'sandbox.candidate.execute'
]);

const verification = readJson('VERIFICATION_RECEIPT.json');
assert.equal(verification.testedImplementationCommit, 'fd1edf87b01d10fdbdafcff6a13249e1724cb3a3');
assert.equal(verification.summary.requiredCommandSuitesPassed, 10);
assert.equal(verification.summary.focusedCommandSuitesPassed, 21);
assert.equal(verification.summary.schemaCompilerChecksPassed, 83);
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.suppliedPackageCodeExecuted, false);
assert.equal(verification.truth.mergePerformed, false);

const audit = readJson('AUDIT_FINDINGS.json');
assert.ok(audit.findings.some((item) => item.id === 'windows-drive-letter-alias' && item.disposition === 'ADDRESSED'));
assert.ok(audit.findings.some((item) => item.id === 'future-executor' && item.disposition === 'MIKE_DECISION_REQUIRED'));
assert.ok(audit.findings.some((item) => item.id === 'future-code-rights' && item.disposition === 'MIKE_DECISION_REQUIRED'));

const route = readJson('EVIDENCE_ROUTE.json');
assert.ok(route.claims.some((item) => item.verdict === 'UNRUN'));
assert.ok(route.claims.some((item) => item.verdict === 'NOT_AUTHORIZED'));
assert.ok(route.claims.some((item) => item.verdict === 'NOT_APPLICABLE'));

const handoff = readJson('INTEGRATION_HANDOFF.json');
assert.equal(handoff.source.branch, 'codex/code-capability-fabric-schema-compilation-v2.1');
assert.equal(handoff.source.baseCommit, '203fc98a84b2d50907b8303a8c2c8b4579aac78a');
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.containsBaseCommit, false);
assert.equal(handoff.observedCanonicalCheckout.taskRelevantStatusEntries, 0);
assert.equal(handoff.driftRecheck.headChanged, false);
assert.equal(handoff.driftRecheck.busyStatusChanged, false);
assert.equal(handoff.driftRecheck.taskRelevantOverlapObserved, false);
assert.equal(handoff.authority.mergePerformed, false);
assert.equal(handoff.authority.canonChanged, false);
assert.ok(handoff.exactImplementationIntegrationCommandAfterCleanTargetAndAncestryChecks.includes('--no-commit'));
assert.ok(handoff.safeIntegrationConditions.some((item) => item.includes('Mike decide')));

const afterInventory = readJson('SCOUT_INVENTORY_AFTER.json');
assert.equal(afterInventory.workspaceStatus, 'ONLY_BOUNDED_STEWARD_EVIDENCE_UNCOMMITTED');
assert.equal(afterInventory.activeRelevantSharedSeams, 0);
assert.equal(afterInventory.canonicalCheckout.taskRelevantStatusEntries, 0);
assert.equal(afterInventory.canonicalCheckoutTouched, false);

const session = CuratedSession.load(runRoot, 16);
const events = session.events;
if (events) {
  events.forEach((event, index) => assert.equal(event.seq, index + 1));
  assert.ok(events.some((event) => event.event === 'verification-contention'));
}

const seal = session.seal;
assert.equal(seal.source, 'code-capability-fabric-schema-compilation-v2.1');
assert.equal(seal.eventLines, 16);
assert.equal(seal.invalidJsonLines, 0);
assert.equal(seal.sha256, '62d1186d8670a840267a50b736c432f350069f2bc9e001c94af51d1703b53478');
const curation = readJson('CURATION_RECEIPT.json');
assert.equal(curation.sessionSeal.sha256, seal.sha256);
assert.equal(curation.truth.privateContentCommitted, false);
assert.equal(curation.truth.machinePathsCommitted, false);
assert.equal(curation.truth.candidateCodeExecuted, false);

const allEvidenceText = fs.readdirSync(runRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name !== 'selftest.js')
  .map((entry) => fs.readFileSync(path.join(runRoot, entry.name), 'utf8'))
  .join('\n');
assert.ok(!/[A-Z]:\\|C:\/Users\/|D:\/AXM_ACTIVE|D:\/CODEX_WORKTREES/i.test(allEvidenceText));
assert.ok(!/sk-[a-z0-9]{16,}|authorization:\s*bearer/i.test(allEvidenceText));

console.log('Code Capability Fabric schema-compilation receipt selftest: PASS');
