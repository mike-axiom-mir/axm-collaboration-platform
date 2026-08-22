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
const implementationCommit = 'ba5af784b5322284d0f6da8a5f272648745053f9';
const priorReceiptTip = '89bc241caa8fa03fb9fd41fb9adceeb2b1eaf5b6';

[
  'AUDIT_FINDINGS.json',
  'CAPABILITY_REQUIREMENTS.json',
  'CAPABILITY_INVENTORY.json',
  'CAPABILITY_GAP_REPORT.json',
  'CURATION_RECEIPT.json',
  'EVIDENCE_ROUTE.json',
  'INTEGRATION_HANDOFF.json',
  'SESSION_SEAL.json',
  'VERIFICATION_RECEIPT.json'
].forEach(json);

const session = CuratedSession.load(root, 12);
const eventLines = session.events;
const seal = session.seal;
if (eventLines) assert.deepEqual(eventLines.map((item) => item.sequence), Array.from({ length: 12 }, (_, index) => index + 1));

const curation = json('CURATION_RECEIPT.json');
assert.equal(curation.seal_digest, seal.sha256);
assert.equal(curation.durable_events_preserved, seal.eventLines);
assert.match(curation.authority_used, /no deletion, merge, install, promotion, or CANON authority/);

const requirements = json('CAPABILITY_REQUIREMENTS.json');
assert.deepEqual(requirements.rootPrecedence, [
  'truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'
]);

const gap = json('CAPABILITY_GAP_REPORT.json');
assert.equal(gap.overall, 'BLOCKED');
assert.equal(gap.requirements.find((item) => item.id === 'independent-assurance-review').status, 'READY');
assert.equal(gap.requirements.find((item) => item.id === 'historical-continuity').status, 'READY');
assert.equal(gap.requirements.find((item) => item.id === 'authorized-provider-execution').status, 'BLOCKED');
assert.equal(gap.requirements.find((item) => item.id === 'generated-source-direct-reuse').status, 'OPTIONAL_UNKNOWN');

const verification = json('VERIFICATION_RECEIPT.json');
assert.equal(verification.testedCommit, implementationCommit);
assert.equal(verification.requiredChecks.length, 10);
assert.ok(verification.requiredChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.focusedChecks.length, 9);
assert.ok(verification.focusedChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.staticChecks.length, 4);
assert.ok(verification.staticChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.organizationalIndependenceProven, false);
assert.equal(verification.truth.liveProviderExecuted, false);
assert.equal(verification.truth.canonChanged, false);

const evidence = json('EVIDENCE_ROUTE.json');
assert.equal(evidence.implementationCommit, implementationCommit);
assert.equal(evidence.claims.find((item) => item.id === 'actual-sandboxed-execution').result, 'UNKNOWN_NOT_RUN');
assert.equal(evidence.claims.find((item) => item.id === 'browser-behavior').result, 'NOT_APPLICABLE_NOT_RUN');
assert.equal(evidence.claims.find((item) => item.id === 'requester-accepted-trust-policy').result, 'UNKNOWN_NOT_BOUND');

const audit = json('AUDIT_FINDINGS.json');
assert.equal(audit.auditedImplementationCommit, implementationCommit);
assert.deepEqual(audit.rootPrecedence.map((item) => item.root), requirements.rootPrecedence);
assert.ok(audit.openSeams.some((item) => item.id === 'repaired-disposable-sandbox-executor' && item.status === 'BLOCKED'));
assert.ok(audit.openSeams.some((item) => item.id === 'generated-source-direct-reuse-rights' && item.status === 'UNKNOWN'));
assert.equal(audit.authority.providerExecuted, false);
assert.equal(audit.authority.mergePerformed, false);

const handoff = json('INTEGRATION_HANDOFF.json');
assert.equal(handoff.source.implementationCommit, implementationCommit);
assert.equal(handoff.source.priorReceiptTip, priorReceiptTip);
assert.equal(handoff.changedPaths.length, 7);
assert.ok(!handoff.changedPaths.includes('shared/code-capability-fabric/README.md'));
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.taskRelevantStatusEntries, 0);
assert.equal(handoff.observedCanonicalCheckout.implementationCommitIsAncestor, false);
assert.equal(handoff.authority.fourRootsTechnicalGateFirst, true);
assert.equal(handoff.authority.mergePerformed, false);
assert.ok(handoff.exactReadOnlyReviewActions.every((item) => item.includes(implementationCommit)));
assert.ok(handoff.exactImplementationIntegrationCommandAfterCleanTargetAndAncestryChecks.includes(implementationCommit));

const contract = JSON.parse(fs.readFileSync(path.join(fabricRoot, 'module-independent-assurance-v1.contract.json'), 'utf8'));
assert.equal(contract.status, 'TEST');
assert.deepEqual(contract.rootsGate, requirements.rootPrecedence);
assert.deepEqual(contract.permissions, []);
assert.deepEqual(contract.boundaries.writes, []);

const receiptText = fs.readdirSync(root)
  .filter((name) => fs.statSync(path.join(root, name)).isFile())
  .map(read)
  .join('\n');
assert.ok(!/[A-Z]:\\/.test(receiptText), 'receipt must not retain absolute Windows machine paths');
assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY/.test(receiptText), 'receipt must not retain private key material');
assert.ok(!/sk-[A-Za-z0-9]{12,}/.test(receiptText), 'receipt must not retain API-key-like material');

console.log('Code Capability Fabric independent assurance receipt self-test: PASS');
