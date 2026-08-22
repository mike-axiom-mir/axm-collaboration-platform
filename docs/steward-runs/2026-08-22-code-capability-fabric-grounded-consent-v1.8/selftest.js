#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const CuratedSession = require('../2026-08-22-v0.7.0-release-integration/curated-session-evidence');

const root = __dirname;
const fabricRoot = path.resolve(root, '../../../shared/code-capability-fabric');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const implementationCommit = 'e43deced6ebff26a36febd77aff9cc591846e33a';
const priorTip = 'cdf17eb7b01fc8216e23569bbcc2b5e127664334';

[
  'AUDIT_FINDINGS.json',
  'CAPABILITY_GAP_REPORT.json',
  'CURATION_RECEIPT.json',
  'EVIDENCE_ROUTE.json',
  'INTEGRATION_HANDOFF.json',
  'SCOUT_INVENTORY_AFTER.json',
  'SCOUT_INVENTORY_BEFORE.json',
  'SCOUT_REQUIREMENTS.json',
  'SESSION_SEAL.json',
  'VERIFICATION_RECEIPT.json'
].forEach(json);

const session = CuratedSession.load(root, 14);
const events = session.events;
const seal = session.seal;
if (events) assert.deepEqual(events.map((item) => item.sequence), Array.from({ length: 14 }, (_, index) => index + 1));

const curation = json('CURATION_RECEIPT.json');
assert.equal(curation.seal_digest, seal.sha256);
assert.equal(curation.durable_events_preserved, seal.eventLines);
assert.match(curation.authority_used, /no deletion, merge, install, publish, promotion, hardware, or CANON authority/);

const requirements = json('SCOUT_REQUIREMENTS.json');
const before = json('SCOUT_INVENTORY_BEFORE.json');
const after = json('SCOUT_INVENTORY_AFTER.json');
assert.ok(requirements.requirements.some((item) =>
  item.id === 'grounded-consent-scope-evaluation' && item.required));
assert.ok(!before.capabilities.some((item) => item.id === 'consent.scope.evaluate'));
assert.equal(after.capabilities.find((item) => item.id === 'consent.scope.evaluate').status, 'available');
assert.equal(after.capabilities.find((item) => item.id === 'consent.human-decision.authenticate').status, 'unavailable');
assert.equal(after.capabilities.find((item) => item.id === 'hardware.safety-interlock.verify').status, 'unavailable');

const gap = json('CAPABILITY_GAP_REPORT.json');
assert.equal(gap.before.comparatorOverall, 'BLOCKED');
assert.equal(gap.before.requiredScopePlanning, 'BLOCKED');
assert.equal(gap.after.comparatorOverall, 'READY');
assert.equal(gap.after.missionOverall, 'DEGRADED');
assert.equal(gap.after.requiredScopePlanning, 'READY');
assert.ok(gap.after.missingConsequentialCapabilities.includes('consent.human-decision.authenticate'));
assert.ok(gap.after.missingConsequentialCapabilities.includes('consent.revocation.observe-live'));
assert.ok(gap.after.missingConsequentialCapabilities.includes('consent.domain-safety.verify'));
assert.ok(gap.after.missingConsequentialCapabilities.includes('code.fabric.sandbox-executor.repaired'));

const verification = json('VERIFICATION_RECEIPT.json');
assert.equal(verification.testedCommit, implementationCommit);
assert.equal(verification.requiredChecks.length, 10);
assert.ok(verification.requiredChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.focusedChecks.length, 13);
assert.ok(verification.focusedChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.staticChecks.length, 4);
assert.ok(verification.staticChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.policyAuthorshipVerified, false);
assert.equal(verification.truth.humanConsentVerified, false);
assert.equal(verification.truth.domainSafetyVerified, false);
assert.equal(verification.truth.hardwareActuated, false);
assert.equal(verification.truth.liveProviderExecuted, false);

const evidence = json('EVIDENCE_ROUTE.json');
assert.equal(evidence.implementationCommit, implementationCommit);
assert.equal(evidence.claims.find((item) => item.id === 'deterministic-grounded-scope-evaluation').verdict, 'PASS');
assert.equal(evidence.claims.find((item) => item.id === 'actual-authenticated-human-consent').verdict, 'UNKNOWN_NOT_IMPLEMENTED');
assert.equal(evidence.claims.find((item) => item.id === 'live-revocation-and-trusted-time').verdict, 'UNKNOWN_NOT_IMPLEMENTED');
assert.equal(evidence.claims.find((item) => item.id === 'actual-sandboxed-execution').verdict, 'UNKNOWN_NOT_RUN');
assert.equal(evidence.claims.find((item) => item.id === 'browser-behavior').verdict, 'NOT_APPLICABLE_NOT_RUN');

const audit = json('AUDIT_FINDINGS.json');
assert.equal(audit.auditedImplementationCommit, implementationCommit);
assert.deepEqual(audit.rootPrecedence.map((item) => item.root), [
  'truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'
]);
assert.ok(audit.openSeams.some((item) => item.id === 'authenticated-human-decision' && item.status === 'BLOCKED'));
assert.ok(audit.openSeams.some((item) => item.id === 'hardware-safety-interlocks' && item.status === 'BLOCKED'));
assert.ok(audit.openSeams.some((item) => item.id === 'generated-source-direct-reuse-rights' && item.status === 'UNKNOWN'));
assert.equal(audit.authority.humanConsentVerified, false);
assert.equal(audit.authority.providerExecuted, false);
assert.equal(audit.authority.hardwareActuated, false);

const handoff = json('INTEGRATION_HANDOFF.json');
assert.equal(handoff.source.implementationCommit, implementationCommit);
assert.equal(handoff.source.priorReceiptTip, priorTip);
assert.equal(handoff.changedPaths.length, 7);
assert.ok(handoff.changedPaths.every((item) => item.startsWith('shared/code-capability-fabric/')));
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.taskRelevantStatusEntries, 0);
assert.equal(handoff.source.registeredInCanonicalCommonGitDirectory, true);
assert.equal(handoff.authority.fourRootsTechnicalGateFirst, true);
assert.equal(handoff.authority.humanConsentVerified, false);
assert.equal(handoff.authority.mergePerformed, false);
assert.ok(handoff.exactReadOnlyReviewActionsFromCanonicalRepository.every((item) => item.includes(implementationCommit)));
assert.ok(handoff.exactSafeReviewWorktreeCommandsFromCanonicalRepository.some((item) => item.includes(handoff.source.branch)));
assert.ok(handoff.exactImplementationIntegrationCommandAfterCleanTargetAndAncestryChecks.includes(handoff.source.branch));

const contract = JSON.parse(fs.readFileSync(
  path.join(fabricRoot, 'module-grounded-consent-scope-v1.contract.json'),
  'utf8'
));
assert.equal(contract.status, 'TEST');
assert.deepEqual(contract.rootsGate, ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
assert.deepEqual(contract.permissions, []);
assert.deepEqual(contract.boundaries.writes, []);
assert.ok(contract.boundaries.refuses.includes('scope-fit-as-human-consent-proof'));
assert.ok(contract.boundaries.refuses.includes('consent-as-domain-safety-proof'));
assert.ok(contract.boundaries.refuses.includes('automatic-hardware-actuation'));

const receiptText = fs.readdirSync(root)
  .filter((name) => fs.statSync(path.join(root, name)).isFile())
  .map(read)
  .join('\n');
assert.ok(!/[A-Z]:\\/.test(receiptText), 'receipt must not retain absolute Windows machine paths');
assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY/.test(receiptText), 'receipt must not retain private key material');
assert.ok(!/sk-[A-Za-z0-9]{12,}/.test(receiptText), 'receipt must not retain API-key-like material');

console.log('Code Capability Fabric grounded consent receipt self-test: PASS');
