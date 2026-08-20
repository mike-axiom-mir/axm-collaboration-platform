#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Build = require('./build-current-portability');

let checks = 0;
function ok(value, message) {
  assert.ok(value, message);
  checks += 1;
}

const result = Build.current();
const evaluation = result.evaluation;
ok(evaluation.verdict === 'PORTABLE_GUARD_BETTER_WITH_EXPLICIT_SOURCE_TRUTH_LIMIT', 'evaluation admits improvement without erasing its source-truth limit');
ok(evaluation.summary.caseCount === 11 && evaluation.summary.expectationPass === 11 && evaluation.summary.expectationFail === 0, 'all eleven declared cases match their bounded expectations');
ok(evaluation.summary.digestOnlyPass === 10, 'digest-only checking admits every recomputed receipt');
ok(evaluation.summary.detachedPortablePass === 3, 'detached guard admits only coherent portable receipts');
ok(evaluation.summary.recomputedTamperCaughtBeyondDigest === 7, 'seven recomputed manipulations are caught beyond digest checking');
ok(evaluation.summary.sourceTruthUnknownHolds === 3, 'every portable pass holds source truth as unknown');
ok(evaluation.summary.semanticSubstitutionLimitsPreserved === 2, 'both coherent source substitutions preserve the stated verifier limit');
ok(evaluation.summary.humanPass === 0 && evaluation.summary.humanNotRun === 1, 'technical evaluation is not relabeled as human evidence');
ok(evaluation.results.find((item) => item.id === 'recomputed-autonomous-action').issueCodes.includes('AUTONOMOUS_ACTION_REFUSED'), 'autonomous authority probe is refused');
ok(evaluation.results.find((item) => item.id === 'recomputed-automatic-canon').issueCodes.includes('BOUNDARY_MUST_REMAIN_FALSE'), 'automatic CANON probe is refused');
ok(evaluation.results.find((item) => item.id === 'recomputed-forged-source-references').safeDecision === 'HOLD_SOURCE_TRUTH_UNKNOWN', 'forged reference digests cannot become source truth');
ok(evaluation.results.find((item) => item.id === 'recomputed-coherent-human-benefit-substitution').safeDecision === 'HOLD_SOURCE_TRUTH_UNKNOWN', 'coherent human-benefit substitution cannot become human evidence');
ok(Object.values(evaluation.authority).every((value) => value === false), 'evaluation grants no operational authority');

ok(result.gapBefore.overall === 'BLOCKED', 'before comparison is blocked by exact missing portable capabilities');
ok(result.gapBefore.missingCapabilities.length === 4, 'before comparison names four required missing capabilities');
ok(result.gapAfter.overall === 'DEGRADED', 'after comparison remains degraded by optional unknown evidence');
ok(result.gapAfter.missingCapabilities.length === 0, 'after comparison has no required missing capability');
ok(result.gapAfter.requirements.filter((item) => item.required).every((item) => item.status === 'READY'), 'every required capability group is ready after the increment');
ok(result.gapAfter.requirements.filter((item) => !item.required).every((item) => item.status === 'OPTIONAL_UNKNOWN'), 'source truth and human evidence remain optional unknowns');
ok(result.gapAfter.automaticInstall === false && result.gapAfter.automaticPermission === false && result.gapAfter.automaticQualityReduction === false, 'gap comparison installs, grants, and downgrades nothing automatically');

ok(result.priorEvolution.historicalExactVerificationAgainstCurrentSources === 'EXPECTED_FAIL_SOURCE_EVOLUTION', 'prior exact verification fails honestly after later source evolution');
ok(result.priorEvolution.currentBehaviorReceipt.matchesHistoricalBehaviorReceipt, 'current behavior receipt remains byte-identical across portability hardening');
ok(result.priorEvolution.currentBehaviorReceipt.exactRebuild === 'PASS', 'unchanged current behavior receipt still rebuilds exactly');
ok(result.priorEvolution.changedTrackedSources.length === 5, 'five prior tracked module sources record later evolution');
ok(result.priorEvolution.decision.classification === 'LATER_PORTABILITY_HARDENING_SOURCE_EVOLUTION', 'prior drift is classified as later portability hardening');
ok(result.priorEvolution.decision.historicalReceiptRewritten === false, 'historical verification receipt remains immutable');
ok(Object.values(result.priorEvolution.truth).every((value) => value === false), 'prior evolution report makes no inflated truth or authority claim');

const recorded = [
  ['PORTABLE_AI_WORKFLOW_EVALUATION.json', evaluation],
  ['CAPABILITY_GAP_BEFORE.json', result.gapBefore],
  ['CAPABILITY_GAP_AFTER.json', result.gapAfter],
  ['PRIOR_RECEIPT_EVOLUTION.json', result.priorEvolution]
];
recorded.forEach(([name, expected]) => {
  const actual = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
  ok(JSON.stringify(actual) === JSON.stringify(expected), name + ' is the exact recorded deterministic output');
});

console.log('PASS grounded growth current-state portability selftest (' + checks + ' assertions)');
