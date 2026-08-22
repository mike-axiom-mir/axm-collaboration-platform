#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const implementationCommit = '3579073aaa5854fba7bbf1e985b5a23d0f98ac1a';

const expectedJson = [
  'AUDIT_FINDINGS.json',
  'CAPABILITY_REQUIREMENTS.json',
  'CAPABILITY_INVENTORY.json',
  'CAPABILITY_GAP_REPORT.json',
  'CURATION_RECEIPT.json',
  'EVIDENCE_ROUTE.json',
  'INTEGRATION_HANDOFF.json',
  'SESSION_SEAL.json',
  'VERIFICATION_RECEIPT.json'
];
expectedJson.forEach(json);

const eventsBytes = fs.readFileSync(path.join(root, 'SESSION_EVENTS.jsonl'));
const eventLines = eventsBytes.toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
const seal = json('SESSION_SEAL.json');
assert.equal(eventLines.length, 6);
assert.equal(seal.parseStatus, 'valid');
assert.equal(seal.eventLines, eventLines.length);
assert.equal(seal.invalidJsonLines, 0);
assert.equal(seal.sha256, crypto.createHash('sha256').update(eventsBytes).digest('hex'));

const curation = json('CURATION_RECEIPT.json');
assert.equal(curation.seal_digest, seal.sha256);
assert.equal(curation.durable_events_preserved, eventLines.length);
assert.match(curation.authority_used, /no deletion, merge, install, promotion, or CANON authority/);

const gap = json('CAPABILITY_GAP_REPORT.json');
assert.equal(gap.overall, 'BLOCKED');
assert.equal(gap.requirements.find((item) => item.id === 'evidence-bound-readiness').status, 'READY');
assert.equal(gap.requirements.find((item) => item.id === 'authorized-provider-execution').status, 'BLOCKED');
assert.equal(gap.requirements.find((item) => item.id === 'generated-source-direct-reuse').status, 'OPTIONAL_UNKNOWN');

const verification = json('VERIFICATION_RECEIPT.json');
assert.equal(verification.testedCommit, implementationCommit);
assert.equal(verification.requiredChecks.length, 10);
assert.ok(verification.requiredChecks.every((item) => item.status === 'PASS'));
assert.equal(verification.summary.requiredCommandSuitesPassed, 10);
assert.equal(verification.summary.focusedCommandSuitesPassed, 8);
assert.equal(verification.summary.staticFocusedChecksPassed, 3);
assert.equal(verification.summary.commandSuitesFailed, 0);
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.liveProviderExecuted, false);
assert.equal(verification.truth.mergePerformed, false);
assert.equal(verification.truth.canonChanged, false);

const evidence = json('EVIDENCE_ROUTE.json');
assert.equal(evidence.implementationCommit, implementationCommit);
assert.equal(evidence.claims.find((item) => item.id === 'actual-sandboxed-execution').result, 'UNKNOWN_NOT_RUN');
assert.equal(evidence.claims.find((item) => item.id === 'browser-behavior').result, 'NOT_APPLICABLE_NOT_RUN');

const audit = json('AUDIT_FINDINGS.json');
assert.equal(audit.auditedImplementationCommit, implementationCommit);
assert.ok(audit.openSeams.some((item) => item.id === 'repaired-disposable-sandbox-executor' && item.status === 'BLOCKED'));
assert.ok(audit.openSeams.some((item) => item.id === 'generated-source-direct-reuse-rights' && item.status === 'UNKNOWN'));
assert.equal(audit.authority.providerExecuted, false);

const handoff = json('INTEGRATION_HANDOFF.json');
assert.equal(handoff.source.implementationCommit, implementationCommit);
assert.equal(handoff.changedPaths.length, 9);
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.implementationCommitIsAncestor, false);
assert.equal(handoff.authority.mergePerformed, false);
assert.equal(handoff.authority.canonicalCheckoutModified, false);
assert.ok(handoff.exactReadOnlyReviewActions.every((item) => item.includes(implementationCommit) || item.includes('72eae864')));

const receiptText = fs.readdirSync(root)
  .filter((name) => fs.statSync(path.join(root, name)).isFile())
  .map(read)
  .join('\n');
assert.ok(!/[A-Z]:\\/.test(receiptText), 'receipt must not retain absolute Windows machine paths');
assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY/.test(receiptText), 'receipt must not retain private key material');
assert.ok(!/sk-[A-Za-z0-9]{12,}/.test(receiptText), 'receipt must not retain API-key-like material');

console.log('Code Capability Fabric readiness receipt self-test: PASS');
