#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Audit = require('./scan-workshop-json-seams');
const PhoneGap = require('./probe-voluntary-phone-qa-gap');
const Closure = require('./build-current-upstream-closure');

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}

const before = Audit.verifyRecorded(Audit.BEFORE_OUTPUT);
const current = Audit.verifyRecorded(Audit.CURRENT_OUTPUT);
const phoneGap = PhoneGap.checkRecorded();
const closure = Closure.checkRecorded();
const gapBefore = JSON.parse(fs.readFileSync(path.join(__dirname, 'CAPABILITY_GAP_BEFORE.json'), 'utf8'));
const gapAfter = JSON.parse(fs.readFileSync(path.join(__dirname, 'CAPABILITY_GAP_AFTER.json'), 'utf8'));

check(before.baseCommit === Audit.BASE_COMMIT && current.baseCommit === Audit.BASE_COMMIT, 'before and current audits retain the exact base commit');
check(before.static.counts.findings === 381 && before.static.counts.strictCoreReferenced === 16 && before.static.counts.potentialRepresentationSeams === 297, 'before static inventory counts are exact');
check(before.runtime.counts.modules === 13 && before.runtime.counts.refusesAllUnsafeFixtures === 0 && before.runtime.counts.invalidCanonicalText === 12 && before.runtime.counts.silentOrTransformedUnsafeState === 1, 'before runtime inventory classifies all thirteen exported surfaces');
check(before.runtime.counts.unsafeFixturePairs === 169 && before.runtime.counts.refusedFixturePairs === 36 && before.runtime.counts.safeStrictCoreExact === 78, 'before runtime fixture counts are exact');

check(current.static.counts.strictCoreReferenced === 22 && current.static.counts.potentialRepresentationSeams === 291, 'current static inventory records the six-root migration');
check(current.static.counts.jsonRoundTripCloneOccurrences === 323, 'six direct JSON round-trip clone occurrences are removed');
check(current.runtime.counts.refusesAllUnsafeFixtures === 6 && current.runtime.counts.invalidCanonicalText === 6 && current.runtime.counts.silentOrTransformedUnsafeState === 1, 'current runtime inventory separates six strict roots from seven deferred surfaces');
check(current.runtime.counts.refusedFixturePairs === 102 && current.runtime.counts.safeStrictCoreExact === 78, 'current runtime inventory improves unsafe refusal without safe-fixture drift');

check(closure.state === 'SIX_DIRECT_UPSTREAM_ROOTS_STRICT_ON_REVIEW_BRANCH', 'closure state is bounded to six upstream roots on the review branch');
check(closure.scope.selectedModuleIds.join(',') === Audit.SELECTED_COHORT.join(','), 'closure cohort matches the current explicit selection');
check(closure.migration.length === 6 && closure.migration.every((item) => item.beforeClassification !== 'REFUSES_ALL_UNSAFE_FIXTURES' && item.currentClassification === 'REFUSES_ALL_UNSAFE_FIXTURES'), 'all six selected roots visibly move to strict runtime refusal');
check(closure.structuralClosure.length === 6 && closure.structuralClosure.every((item) => item.sourceChangedFromBefore && item.importsExistingCore && item.cloneUsesStrictCanonicalText && item.stableStringifyUsesExistingCore), 'all six sources share the existing strict clone and canonical path');
check(closure.structuralClosure.every((item) => item.contractVersion === 'v0.2' && item.contractConsumesExistingCore && item.contractRefusesUnsafeState), 'all six contracts declare the strict representation boundary');
check(closure.structuralClosure.every((item) => item.readmeDeclaresRepresentationBoundary && item.nativeSelftestCoversUnsafeRefusal), 'all six module notes and native tests expose the new boundary');
check(closure.unsafeFixtureResults.length === 78 && closure.unsafeFixtureResults.every((item) => item.state === 'REFUSED'), 'all 78 selected unsafe fixture pairs fail closed');
check(closure.safeCompatibility.length === 36 && closure.safeCompatibility.every((item) => item.canonicalDigestExact && item.objectDigestExact), 'all 36 selected safe canonical and object-digest comparisons remain exact');
check(closure.persistence.length === 6 && closure.persistence.every((item) => item.canonicalExactAfterRead && item.digestExactAfterRead && !item.temporaryFileRetained), 'all six persistence journeys survive exactly without retained probe files');
check(closure.directProductionSeams.length === 16 && closure.directProductionSeams.every((item) => item.exactModuleIdMentioned), 'six selected roots remain visible across sixteen direct production seams');

check(phoneGap.state === 'DEFERRED_CONTRACT_AND_EVIDENCE_GAP' && phoneGap.nativeBaseline.expectedFailureObserved, 'voluntary phone QA remains a typed observed gap');
check(phoneGap.nativeBaseline.error === 'QA Lab device evidence handoff missing', 'phone QA gap preserves the exact first native failure');
check(Object.values(phoneGap.currentQaLab.requirements).every((value) => value === false), 'current QA Lab lacks all five campaign-specific contract facts');
check(phoneGap.decision.fakeManifestOrContractDeclarationsAdded === false && phoneGap.authority.labMutated === false && phoneGap.authority.campaignMutated === false, 'gap handling adds no fake declaration or source mutation');

check(gapBefore.overall === 'DEGRADED' && gapAfter.overall === 'DEGRADED', 'capability reports keep optional unknown and missing work visible');
check(gapAfter.requirements.find((item) => item.id === 'bounded-upstream-root-representation-migration').status === 'READY', 'bounded migration capability is ready');
check(gapAfter.requirements.find((item) => item.id === 'voluntary-phone-qa-upstream-root').status === 'OPTIONAL_GAP', 'phone QA root remains an optional contract and evidence gap');
check(gapAfter.requirements.find((item) => item.id === 'future-shadow-clone-integration').status === 'OPTIONAL_GAP', 'unreceived shadow-clone architecture remains an optional gap');

check(closure.scope.workshopWideRepresentationClosureClaimed === false && closure.limits.humanBenefitEstablished === false && closure.limits.modelLearningImprovementEstablished === false, 'closure makes no Workshop-wide, human-benefit, or model-learning claim');
check(closure.authority.branchOnly && !closure.authority.promoted && !closure.authority.merged && !closure.authority.canonized, 'closure remains branch-only TEST material with no promotion or CANON authority');

console.log('PASS Grounded Growth upstream JSON closure selftest (' + checks + ' assertions)');
