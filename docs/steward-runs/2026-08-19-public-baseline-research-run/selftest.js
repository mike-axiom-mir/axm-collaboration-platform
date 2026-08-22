#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildResearchRun } = require('./build-research-run');
const Lab = require('../../../shared/baseline-simulation-lab/baseline-simulation-lab');
const Capsule = require('../../../shared/portable-baseline-capsule/portable-baseline-capsule');
const Evidence = require('../../../tools/evidence-desk/evidence-core');

const root = path.resolve(__dirname, '../../..');
const externalInputs = path.resolve(root, '..', 'intake-quarantine', '2026-08-19-5yff-01', 'inputs');
const commit = '7147b97f4852401b118a50422d4d58cdb92c9923';
let checks = 0;

function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  console.log('PASS ' + message);
}
function readJson(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function sha256(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function git(args) { return cp.execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 }); }

const inputFiles = {
  'research:5yff-steward-1': 'AXM_5YFF_RESEARCH_BUILD_2026-08-18.zip',
  'research:5yff-steward-2': 'AXM_5YFF_RESEARCH_BUILD_STEWARD_2_2026-08-19.zip',
  'research:5yff-steward-3': 'AXM_5YFF_RESEARCH_BUILD_STEWARD_3_2026-08-19.zip',
  'research:5yff-experimental-run-01': 'AXM_5YFF_EXPERIMENTAL_RUN_01_2026-08-19.zip',
  'research:5yff-steward-4': 'AXM_5YFF_RESEARCH_BUILD_STEWARD_4_2026-08-19.zip',
  'research:long-term-stewardship-blueprint': 'AXM_LONG_TERM_STEWARDSHIP_OPERATING_BLUEPRINT_2026-08-19.txt',
  'research:semantic-first-visual-escalation-note': 'AXM_AI_SEMANTIC_FIRST_VISUAL_ESCALATION_NOTE_2026-08-19.txt'
};

(async function main() {
  const observation = readJson('PUBLIC_BASELINE_OBSERVATION.json');
  const manifest = readJson('RESEARCH_INPUT_MANIFEST.json');
  const provenance = readJson('USER_REPORTED_SEAT_PROVENANCE.json');
  const disposition = readJson('RESEARCH_DISPOSITION.json');
  const evidence = readJson('EVIDENCE_RECEIPT.json');
  const baseline = readJson('PUBLIC_BASELINE_CAPSULE.json');
  const budget = readJson('BUDGET_USAGE_OBSERVATION.json');
  const summary = readJson('RUN_SUMMARY.json');

  check(git(['cat-file', '-t', commit]).toString().trim() === 'commit', 'historical public baseline commit object exists');
  check(git(['rev-parse', commit + '^{tree}']).toString().trim() === observation.tree, 'fresh Git read reproduces the stored tree identity');
  check(git(['show', '-s', '--format=%P', commit]).toString().trim().split(/\s+/).join('|') === observation.parents.join('|'), 'fresh Git read reproduces both stored parents');
  const listing = git(['ls-tree', '-r', '--full-tree', commit]);
  check(sha256(listing) === observation.treeListingSha256, 'fresh full tree listing reproduces the stored SHA-256');
  check(listing.toString('utf8').trim().split(/\r?\n/).filter(Boolean).length === observation.entryCount, 'fresh full tree listing reproduces 13,502 entries');
  check(sha256(git(['show', commit + ':AGENTS.md'])) === observation.agentsContentSha256, 'historical AGENTS content digest reproduces exactly');
  check(observation.truth.currentLocalBehaviorProven === false && observation.truth.remoteFreshnessProven === false, 'Git observation does not overclaim current local or remote state');

  check(manifest.artifacts.length === 7 && manifest.sourceHandling === 'DATA_ONLY_NO_PACKAGE_CODE_EXECUTION', 'manifest binds seven inputs as inert data');
  manifest.artifacts.forEach(artifact => {
    const bytes = fs.readFileSync(path.join(externalInputs, inputFiles[artifact.id]));
    check(bytes.length === artifact.bytes && sha256(bytes) === artifact.sha256, 'input identity matches ' + artifact.id);
  });
  check(manifest.truth.packageCodeExecuted === false && manifest.truth.agreementIsProof === false, 'input manifest grants neither execution nor truth authority');

  check(provenance.seats.length === 4 && provenance.seats.every(seat => seat.kind === 'MODEL'), 'user-reported provenance names exactly four model-family seats');
  check(provenance.seats.every(seat => seat.modelId === null && seat.identityDisclosure === 'PARTIAL'), 'exact model IDs remain undisclosed instead of guessed');
  check(provenance.seats.every(seat => seat.priorOutputExposure === 'UNKNOWN'), 'cross-seat exposure remains UNKNOWN');

  check(disposition.acceptedSignals.length === 6 && disposition.rejectedOrDeferred.length === 6, 'disposition preserves six signals and six refusals or deferrals');
  check(disposition.acceptedSignals.some(signal => signal.stage === 'UNKNOWN' && signal.id === 'signal:human-comprehension-comparison'), 'human comprehension remains an explicit UNKNOWN');
  check(disposition.rejectedOrDeferred.some(item => item.id === 'proposal:cross-model-majority-truth' && item.disposition === 'REJECTED'), 'cross-model majority truth is explicitly rejected');
  check(disposition.truth.humanBenefitClaimed === false && disposition.truth.automaticAction === false, 'disposition claims neither human benefit nor automatic action');

  check((await Evidence.verify(evidence)).ok && evidence.counts.claims_passed === 3, 'three claim-native evidence routes are sealed and complete');
  check(Capsule.verify(baseline).pass && baseline.adapter.versionOrCommit === commit, 'public software baseline capsule rebuilds and binds the exact commit');
  check(baseline.adapter.workingTree.state === 'UNKNOWN', 'historical commit identity is not mislabeled as a live clean worktree');

  const run = await buildResearchRun();
  check(run.state === 'EXISTING_CAPABILITY_RECORDED' && run.holds.length === 0, 'bounded research replay reuses the run envelope without holds');
  check((await Lab.verify(run)).pass, 'research run receipt verifies by exact rebuild');
  check(run.receiptDigest === summary.receiptDigest && run.cycleReceipt.receiptDigest === summary.cycle.receiptDigest, 'compact stored summary matches current run and cycle digests');
  check(run.newInformationRefs.length === 7 && run.signals.length === 6, 'run carries seven exact inputs and six typed signals');
  check(run.analysis.seatCount === 6 && run.analysis.modelSeatCount === 4, 'run distinguishes four historical model seats, one human gate, and one current tool seat');
  check(run.seats.every(seat => seat.proofAuthority === 'NONE'), 'every participating seat has zero proof authority');
  check(run.analysis.independenceEstablished === false && run.analysis.commonModeCautions.includes('INDEPENDENCE_NOT_ESTABLISHED'), 'model-seat independence is not claimed');
  check(run.analysis.crossModelAgreementIsProof === false && !run.analysis.majorityDecisionPerformed && !run.analysis.rankingPerformed, 'run performs no consensus truth, majority decision, or ranking');
  check(run.signals.every(signal => signal.truthWeight === 'NONE'), 'signals retain stages but receive no truth weight');
  check(run.signals.some(signal => signal.id === 'signal:human-comprehension-comparison' && signal.evidenceStage === 'UNKNOWN'), 'run preserves the open human-comprehension signal');
  check(run.cycleReceipt.state === 'REUSE_EXISTING' && run.cycleReceipt.improvementClaim === 'NOT_ESTABLISHED', 'capability cycle reuses the envelope without claiming improvement');
  check(run.budget.assessment.state === 'WITHIN_LIMITS' && run.budget.usage.executionPerformed === true, 'measured validation work remains within its declared budget');
  check(Math.max(...budget.samplesMs) < budget.accountedUsage.timeMs && budget.accountedUsage.peakConcurrency === 1, 'accounted time exceeds the measured maximum and concurrency remains one');
  check(run.closureAssessment.state === 'CURRENT' && run.outputClosures.every(item => item.state === 'CURRENT' && !item.summarySubstituted), 'every later dependency is current with no summary substitution');
  check(run.truth.modelInvokedByLab === false && run.truth.sourceExecutedByLab === false, 'the lab invokes no model and executes no research package source');
  check(!run.truth.automaticNextGeneration && !run.truth.automaticCanon && !run.truth.foundationMutation, 'the run grants no recursive, CANON, or Foundation authority');
  check(!/[A-Za-z]:\\\\/.test(JSON.stringify(run)), 'persistent run data contains no machine path');

  const tampered = JSON.parse(JSON.stringify(run));
  tampered.analysis.crossModelAgreementIsProof = true;
  check(!(await Lab.verify(tampered)).pass, 'tampering consensus into proof breaks receipt verification');
  const alteredCapsule = JSON.parse(JSON.stringify(baseline));
  alteredCapsule.subject.version = 'silently-changed';
  check(!Capsule.verify(alteredCapsule).pass, 'tampered public baseline identity fails capsule verification');

  console.log('\nPublic baseline research run audit: PASS (' + checks + ' checks)');
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
