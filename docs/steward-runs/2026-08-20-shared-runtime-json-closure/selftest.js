#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const HERE = __dirname;
let assertions = 0;
function check(value, message) { assertions += 1; assert.ok(value, message); }
function equal(actual, expected, message) { assertions += 1; assert.strictEqual(actual, expected, message); }
function json(name) { return JSON.parse(fs.readFileSync(path.join(HERE, name), 'utf8')); }
function sha(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function verifyDigest(value, label) {
  const payload = JSON.parse(Core.canonicalJson(value));
  const digest = payload.digest;
  delete payload.digest;
  equal(digest, sha(Core.canonicalJson(payload)), label + ' digest');
}

const previous = json('../2026-08-20-grounded-growth-upstream-json-roots/CURRENT_WORKSHOP_JSON_AUDIT.json');
const current = json('CURRENT_WORKSHOP_JSON_AUDIT.json');
const closure = json('CURRENT_SHARED_RUNTIME_CLOSURE.json');
const requirements = json('CAPABILITY_REQUIREMENTS.json');
const beforeInventory = json('CAPABILITY_INVENTORY_BEFORE.json');
const afterInventory = json('CAPABILITY_INVENTORY_AFTER.json');
const beforeGap = json('CAPABILITY_GAP_BEFORE.json');
const afterGap = json('CAPABILITY_GAP_AFTER.json');
const visual = json('HOLODECK_VISUAL_RECEIPT.json');
const sensorium = json('SENSORIUM_TEST_DEPENDENCY.json');
const segmentSeal = json('SESSION_SEGMENT.seal.json');
const sessionIndex = json('SESSION_INDEX.json');
const curation = json('CURATION_RECEIPT.json');

verifyDigest(previous, 'previous audit');
verifyDigest(current, 'current audit');
verifyDigest(closure, 'closure');

equal(previous.runtime.counts.refusesAllUnsafeFixtures, 6, 'parent strict runtime count');
equal(previous.runtime.counts.invalidCanonicalText, 6, 'parent invalid canonical count');
equal(previous.runtime.counts.silentOrTransformedUnsafeState, 1, 'parent silent/transformed count');
equal(current.runtime.counts.modules, 13, 'current runtime module count');
equal(current.runtime.counts.refusesAllUnsafeFixtures, 12, 'current strict runtime count');
equal(current.runtime.counts.invalidCanonicalText, 1, 'current invalid canonical count');
equal(current.runtime.counts.silentOrTransformedUnsafeState, 0, 'current silent/transformed count');
equal(current.runtime.counts.refusedFixturePairs, 158, 'current unsafe refusal count');
equal(current.runtime.counts.safeStrictCoreExact, 78, 'current safe exact count');
equal(current.static.counts.strictCoreReferenced, 28, 'current strict source reference count');
equal(current.static.counts.potentialRepresentationSeams, 285, 'current potential seam count');
equal(current.static.counts.jsonRoundTripCloneOccurrences, 318, 'current JSON roundtrip occurrence count');
equal(current.runtime.modules.filter(item => item.classification !== 'REFUSES_ALL_UNSAFE_FIXTURES').map(item => item.moduleId).join(','), 'voluntary-phone-qa-campaign', 'only deferred runtime surface');
check(current.runtime.modules.some(item => item.moduleId === 'mirror-core'), 'Mirror runtime module has an unambiguous ID');

equal(closure.migration.length, 6, 'selected migration count');
check(closure.migration.every(item => item.beforeClassification !== 'REFUSES_ALL_UNSAFE_FIXTURES'), 'all selected roots were non-strict before');
check(closure.migration.every(item => item.currentClassification === 'REFUSES_ALL_UNSAFE_FIXTURES' && item.currentUnsafeRefused === 13 && item.currentSafeExact === 6), 'all selected roots are strict now');
check(closure.migration.every(item => item.safeFixtureBytesUnchanged && item.sourceChangedFromBefore && item.importsExistingCore && item.canonicalBoundaryPresent), 'all selected roots retain safe bytes and share the core');
equal(closure.delta.strictRuntimeModules, 6, 'strict runtime delta');
equal(closure.delta.invalidCanonicalTextModules, -5, 'invalid canonical delta');
equal(closure.delta.silentOrTransformedModules, -1, 'silent/transformed delta');
equal(closure.delta.unsafeFixtureRefusals, 56, 'unsafe refusal delta');
equal(closure.delta.strictCoreReferences, 6, 'strict source reference delta');
equal(closure.delta.potentialRepresentationSeams, -6, 'potential seam delta');
check(closure.persistence.rows.length === 6 && closure.persistence.rows.every(item => item.bytesExactAfterRead), 'six persistence journeys are exact');
check(closure.persistence.cleanupComplete && closure.persistence.temporaryPathRetained === false, 'persistence probes were cleaned');
check(closure.persistence.mirrorUnsafe.refused && !closure.persistence.mirrorUnsafe.targetExists && closure.persistence.mirrorUnsafe.partialFileCount === 0, 'Mirror refuses lossy persistence without partial files');
equal(closure.sensoriumGeneratedParity.verdict, 'PASS', 'Sensorium generated parity');
equal(closure.sensoriumGeneratedParity.checkedArtifacts, 33, 'Sensorium parity artifact count');
check(closure.holodeckBrowser.verdict === 'PASS' && closure.holodeckBrowser.claimCount === 2 && closure.holodeckBrowser.cleanupComplete, 'Holodeck browser proof and cleanup');
check(closure.holodeckBrowser.composerDependencyBeforeCore && closure.holodeckBrowser.screenDeckDependencyBeforeCore, 'browser dependency order');
check(closure.contractEvolution.every(item => item.version === 'v0.2' && item.strictCoreConsumed), 'verification contracts declare strict core consumption');
check(closure.typedGaps.length === 4 && closure.typedGaps.every(item => item.state), 'remaining gaps stay typed');
check(Object.values(closure.authority).every(value => value === false), 'closure grants no authority');
check(Object.values(closure.limits).every(value => value === false), 'closure limits stay false');

check(requirements.requirements.some(item => item.required && item.id === 'bounded-shared-runtime-representation-closure'), 'bounded closure is required');
check(requirements.requirements.filter(item => item.required === false).length === 5, 'broader claims remain optional');
check(beforeInventory.capabilities.some(item => item.id === 'sensorium.generated-artifact-byte-parity' && item.status === 'degraded'), 'before inventory exposes Sensorium byte policy gap');
check(afterInventory.capabilities.some(item => item.id === 'sensorium.generated-artifact-byte-parity' && item.status === 'available'), 'after inventory closes Sensorium byte policy gap');
check(afterInventory.capabilities.some(item => item.id === 'sensorium.visual-proof.receipt-tracked-or-reproducible' && item.status === 'degraded'), 'after inventory preserves Sensorium clean-checkout evidence gap');
check(beforeGap.requirementsSatisfiable === false && beforeGap.gaps.length === 3, 'before gap report is blocked by three bounded gaps');
check(afterGap.requirementsSatisfiable === true && afterGap.requiredGaps.length === 0 && afterGap.optionalGaps.length === 5, 'after gap report closes only required scope');
check(afterGap.completionClaim === 'BOUNDED_EXPORTED_SHARED_RUNTIME_CLOSURE_ONLY' && afterGap.canon === false, 'gap report claim ceiling');

check(visual.claims.length === 2 && visual.claims.every(claim => claim.verdict === 'PASS'), 'two live Holodeck claims pass');
check(visual.retention.cleanupComplete && !visual.retention.rawFramesRetained && visual.retention.temporaryPaths.length === 0, 'visual raw evidence cleanup');
check(sensorium.dependency.allClaimsPass && sensorium.dependency.copiedIntoCommit === false, 'Sensorium local evidence is valid but not committed');
check(sensorium.observation.withDependency === 'PASS_9_OF_9_PHASES' && sensorium.cleanCheckoutFullSuiteReproducible === false, 'Sensorium dependency outcome is honest');
check(sensorium.truth.visualReceiptFabricated === false && sensorium.truth.missingEvidenceTreatedAsPass === false && sensorium.truth.canon === false, 'Sensorium truth boundary');

const segmentBytes = fs.readFileSync(path.join(HERE, 'SESSION_SEGMENT.jsonl'));
equal(segmentSeal.sha256, crypto.createHash('sha256').update(segmentBytes).digest('hex'), 'session segment seal hash');
check(segmentSeal.parseStatus === 'valid' && segmentSeal.eventLines === 10 && segmentSeal.invalidJsonLines === 0, 'session segment structure');
equal(segmentSeal.eventTypes.failure, 2, 'individual failures preserved');
equal(sessionIndex.segment.sha256, 'sha256:' + segmentSeal.sha256, 'session index binds seal');
check(sessionIndex.temporaryMaterial.cleanupComplete && sessionIndex.temporaryMaterial.rawTestLogsRetained === 0 && sessionIndex.temporaryMaterial.browserScreenshotsRetained === 0, 'session index retention boundary');
check(curation.durableEventsPreserved === 10 && curation.temporaryMaterialDeleted.cleanupComplete, 'curation receipt counts and cleanup');
check(curation.canonicalStateDeleted === false && curation.privateOrUserSourceDeleted === false && curation.canon === false, 'curation deletion and authority boundary');

const checksPath = path.join(HERE, 'CHECK_RESULTS.json');
if (fs.existsSync(checksPath)) {
  const checks = json('CHECK_RESULTS.json');
  verifyDigest(checks, 'check results');
  check(checks.summary.failed === 0 && checks.summary.total === checks.summary.passed, 'recorded verification matrix passes');
  equal(checks.summary.requiredTotal, 10, 'required check count');
  equal(checks.summary.requiredPassed, 10, 'required pass count');
}

console.log('PASS shared runtime JSON closure selftest (' + assertions + ' assertions)');
