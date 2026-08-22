#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Comparator = require('../../../shared/code-capability-fabric/git-object-inventory-comparator-v1');

const root = __dirname;
const read = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const before = read('CAPABILITY_GAP_BEFORE.json');
const after = read('CAPABILITY_GAP_AFTER.json');
const verification = read('VERIFICATION_RECEIPT.json');
const retained = read('RETAINED_COMPARISONS.json');
const handoff = read('INTEGRATION_HANDOFF.json');
const curation = read('CURATION_RECEIPT.json');

assert.equal(before.overall, 'BLOCKED');
assert.equal(after.overall, 'DEGRADED');
assert.equal(after.requirements.find((item) => item.id === 'compare-two-signed-host-git-object-inventories').status, 'READY');

for (const name of ['match', 'drift']) {
  const fixture = retained[name];
  assert.deepEqual(Comparator.normalizeReceipt(fixture.receipt), fixture.receipt);
  assert.deepEqual(Comparator.verifyReceipt(fixture.receipt, fixture.input), fixture.receipt);
}
assert.equal(retained.match.receipt.status, 'MATCH');
assert.equal(retained.drift.receipt.status, 'DRIFT');
assert.deepEqual(retained.drift.receipt.issues, [
  'OBJECTS_ADDED',
  'OBJECTS_REMOVED',
  'OBJECT_METADATA_CONTRADICTION'
]);
assert.equal(retained.privateSigningKeyRetained, false);
assert(!/PRIVATE KEY|privateKey|302e0201/.test(JSON.stringify(retained)));

assert.equal(verification.requiredChecks.length, 10);
assert(verification.requiredChecks.every((item) => item.status.startsWith('PASS')));
assert.equal(verification.warningBoundary.delta, 0);
assert.equal(verification.focusedChecks.find((item) => item.command.includes('selftest-git-object')).checksPassed, 174);
assert.equal(verification.browser.status, 'NOT_RUN');
assert.equal(verification.truth.actualRepositoryObjectSetEqualityProven, false);
assert.equal(verification.truth.mergePerformed, false);
assert.equal(verification.truth.canonChanged, false);

assert.equal(handoff.observedCanonicalCheckout.dirty, true);
assert.equal(handoff.observedCanonicalCheckout.implementationCommittedPathOverlap, 0);
assert.equal(handoff.observedCanonicalCheckout.implementationDirtyPathOverlap, 0);
assert.equal(handoff.authority.canonicalCheckoutModified, false);
assert.equal(handoff.authority.mergePerformed, false);
assert.equal(handoff.authority.humanGitGate, 'Mike Tobi');
assert.equal(curation.privacy.privateSigningKeyRetained, false);

const events = fs.readFileSync(path.join(root, 'SESSION_EVENTS.jsonl'), 'utf8').trim().split(/\r?\n/).map(JSON.parse);
assert.equal(events.length, 13);
assert.equal(events.at(-1).event, 'authority-closeout');
assert(events.some((item) => item.event === 'continuity-correction'));

const seal = read('SESSION_SEAL.json');
const eventBytes = fs.readFileSync(path.join(root, 'SESSION_EVENTS.jsonl'));
assert.equal(seal.sha256, crypto.createHash('sha256').update(eventBytes).digest('hex'));
assert.equal(seal.byteLength, eventBytes.length);
assert.equal(seal.eventLines, events.length);

process.stdout.write('Code Capability Fabric signed Git object-inventory steward receipt selftest: PASS\n');
