#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const CuratedSession = require('../2026-08-22-v0.7.0-release-integration/curated-session-evidence');

const ROOT = __dirname;
function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

const audit = readJson('AUDIT_FINDINGS.json');
const route = readJson('EVIDENCE_ROUTE.json');
const verification = readJson('VERIFICATION_RECEIPT.json');
const handoff = readJson('INTEGRATION_HANDOFF.json');
const curation = readJson('CURATION_RECEIPT.json');
const session = CuratedSession.load(ROOT, 8);
const seal = session.seal;
const eventBytes = session.bytes;
const events = session.events;

assert.equal(audit.status, 'TEST');
assert.equal(audit.truth.suppliedRuntimeExecuted, false);
assert.equal(audit.truth.executorImplemented, false);
assert.equal(audit.truth.canonChanged, false);
assert.ok(audit.findings.some((item) => item.code === 'HOST_OBSERVATION_DRIFT_AND_FORGERY'));
assert.ok(audit.findings.some((item) => item.code === 'DIRECT_REUSE_RIGHTS_ABSENT'));

assert.equal(route.overall, 'PASS_FOR_BOUNDED_TEST_PLANNER_WITH_NAMED_RUNTIME_AND_AUTHORITY_UNKNOWNS');
assert.ok(route.claims.some((claim) => claim.verdict === 'UNKNOWN'));
assert.ok(route.claims.filter((claim) => claim.verdict === 'UNKNOWN').every((claim) => claim.namedSeam));

assert.equal(verification.testedCommit, '356a37dacac4d8522fc81fcd4c89292df4f6dd2a');
assert.equal(verification.summary.requiredCommandSuitesPassed, 10);
assert.equal(verification.summary.focusedCommandSuitesPassed, 5);
assert.equal(verification.summary.commandSuitesFailed, 0);
assert.equal(verification.summary.warningObserved, 41);
assert.equal(verification.summary.warningDelta, 0);
assert.equal(verification.browser.status, 'NOT_RUN');

assert.equal(handoff.source.baseCommit, 'd9066284e45eaedb07d8e7998b7c6a972e67c0c1');
assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.intakeCommitIsAncestor, false);
assert.equal(handoff.authority.mergePerformed, false);
assert.equal(handoff.authority.canonicalCheckoutModified, false);
assert.equal(handoff.authority.finalGate, 'Mike Tobi');

if (events) {
  assert.deepEqual(events.map((event) => event.sequence), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(events.every((event) => event.schema === 'axm.steward-session-event/v1'));
}
assert.equal(seal.parseStatus, 'valid');
assert.equal(seal.invalidJsonLines, 0);
assert.equal(curation.sealDigest, 'sha256:' + seal.sha256);
assert.equal(curation.durableEventsPreserved, seal.eventLines);
assert.deepEqual(curation.temporaryMaterialDeleted, []);
assert.deepEqual(curation.unclassifiedItems, []);

const serialized = eventBytes.toString('utf8') + JSON.stringify(audit) + JSON.stringify(route) +
  JSON.stringify(verification) + JSON.stringify(handoff) + JSON.stringify(curation);
assert.ok(!/[A-Z]:\\\\/.test(serialized), 'durable receipts must not retain machine paths');
assert.ok(!/bridge-token|authorization:|api[_-]?key|sk-[A-Za-z0-9]/i.test(serialized), 'durable receipts must not retain secret patterns');

console.log('Code Capability Fabric hardening receipt self-test: PASS');
