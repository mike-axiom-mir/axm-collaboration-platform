#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const fabricRoot = path.resolve(root, '../../../shared/code-capability-fabric');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const implementationCommit = '8c6f311eebe18eda5f6318dbd8aaad7f7d37631d';
const priorTip = '8086599979e3382a99009365e418e8d8077af1cf';

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

const eventsBytes = fs.readFileSync(path.join(root, 'SESSION_EVENTS.jsonl'));
const events = eventsBytes.toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
const seal = json('SESSION_SEAL.json');
assert.equal(events.length, 14);
assert.deepEqual(events.map((item) => item.sequence), Array.from({ length: 14 }, (_, index) => index + 1));
assert.equal(seal.parseStatus, 'valid');
assert.equal(seal.eventLines, events.length);
assert.equal(seal.invalidJsonLines, 0);
assert.equal(seal.sha256, crypto.createHash('sha256').update(eventsBytes).digest('hex'));

const curation = json('CURATION_RECEIPT.json');
assert.equal(curation.seal_digest, seal.sha256);
assert.equal(curation.durable_events_preserved, events.length);
assert.match(curation.authority_used, /no deletion, merge, install, promotion, or CANON authority/);

const requirements = json('SCOUT_REQUIREMENTS.json');
const before = json('SCOUT_INVENTORY_BEFORE.json');
const after = json('SCOUT_INVENTORY_AFTER.json');
assert.ok(requirements.requirements.some((item) => item.id === 'request-policy-structural-binding' && item.required));
assert.ok(!before.capabilities.some((item) => item.id === 'code.fabric.request-policy.bind'));
assert.equal(after.capabilities.find((item) => item.id === 'code.fabric.request-policy.bind').status, 'available');
assert.equal(after.capabilities.find((item) => item.id === 'code.fabric.human-policy-decision.authenticate').status, 'unavailable');

const gap = json('CAPABILITY_GAP_REPORT.json');
assert.equal(gap.before.overall, 'BLOCKED');
assert.equal(gap.before.requiredStructuralBinding, 'BLOCKED');
assert.equal(gap.after.overall, 'DEGRADED');
assert.equal(gap.after.requiredStructuralBinding, 'READY');
assert.ok(gap.after.optionalMissing.includes('code.fabric.human-policy-decision.authenticate'));
assert.ok(gap.after.optionalMissing.includes('code.fabric.sandbox-executor.repaired'));

const verification = json('VERIFICATION_RECEIPT.json');
assert.equal(verification.testedCommit, implementationCommit);
assert.equal(verification.requiredChecks.length, 10);
assert.ok(verification.requiredChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.focusedChecks.length, 11);
assert.ok(verification.focusedChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.staticChecks.length, 4);
assert.ok(verification.staticChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.requesterAuthorshipVerified, false);
assert.equal(verification.truth.humanPolicyAcceptanceVerified, false);
assert.equal(verification.truth.liveProviderExecuted, false);

const evidence = json('EVIDENCE_ROUTE.json');
assert.equal(evidence.implementationCommit, implementationCommit);
assert.equal(evidence.claims.find((item) => item.id === 'actual-authenticated-human-decision').verdict, 'UNKNOWN_NOT_IMPLEMENTED');
assert.equal(evidence.claims.find((item) => item.id === 'actual-sandboxed-execution').verdict, 'UNKNOWN_NOT_RUN');
assert.equal(evidence.claims.find((item) => item.id === 'browser-behavior').verdict, 'NOT_APPLICABLE_NOT_RUN');

const audit = json('AUDIT_FINDINGS.json');
assert.equal(audit.auditedImplementationCommit, implementationCommit);
assert.deepEqual(audit.rootPrecedence.map((item) => item.root), [
  'truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'
]);
assert.ok(audit.openSeams.some((item) => item.id === 'authenticated-human-policy-decision' && item.status === 'BLOCKED'));
assert.ok(audit.openSeams.some((item) => item.id === 'generated-source-direct-reuse-rights' && item.status === 'UNKNOWN'));
assert.equal(audit.authority.requesterAuthorshipVerified, false);
assert.equal(audit.authority.providerExecuted, false);

const handoff = json('INTEGRATION_HANDOFF.json');
assert.equal(handoff.source.implementationCommit, implementationCommit);
assert.equal(handoff.source.priorReceiptTip, priorTip);
assert.equal(handoff.changedPaths.length, 6);
assert.ok(handoff.changedPaths.every((item) => item.startsWith('shared/code-capability-fabric/')));
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.componentRelevantStatusEntries, 0);
assert.equal(handoff.authority.fourRootsTechnicalGateFirst, true);
assert.equal(handoff.authority.humanPolicyAcceptanceVerified, false);
assert.equal(handoff.authority.mergePerformed, false);
assert.ok(handoff.exactReadOnlyReviewActions.every((item) => item.includes(implementationCommit)));
assert.ok(handoff.exactImplementationIntegrationCommandAfterCleanTargetAndAncestryChecks.includes(implementationCommit));

const contract = JSON.parse(fs.readFileSync(path.join(fabricRoot, 'module-policy-bound-assurance-v1.contract.json'), 'utf8'));
assert.equal(contract.status, 'TEST');
assert.deepEqual(contract.rootsGate, ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed']);
assert.deepEqual(contract.permissions, []);
assert.deepEqual(contract.boundaries.writes, []);

const receiptText = fs.readdirSync(root)
  .filter((name) => fs.statSync(path.join(root, name)).isFile())
  .map(read)
  .join('\n');
assert.ok(!/[A-Z]:\\/.test(receiptText), 'receipt must not retain absolute Windows machine paths');
assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY/.test(receiptText), 'receipt must not retain private key material');
assert.ok(!/sk-[A-Za-z0-9]{12,}/.test(receiptText), 'receipt must not retain API-key-like material');

console.log('Code Capability Fabric policy-binding receipt self-test: PASS');
