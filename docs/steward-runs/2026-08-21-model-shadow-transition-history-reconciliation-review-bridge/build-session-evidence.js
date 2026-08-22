#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const seal = read('SESSION_SEGMENT.seal.json');
const addendumSeal = read('SESSION_SEGMENT_ADDENDUM.seal.json');
const results = read('CHECK_RESULTS.json');
const visual = read('VISUAL_RECEIPT.json');
if (seal.parseStatus !== 'valid' || seal.invalidJsonLines !== 0 || addendumSeal.parseStatus !== 'valid' || addendumSeal.invalidJsonLines !== 0) throw new Error('session seal is not valid');
if (results.status !== 'PASS' || visual.status !== 'PASS') throw new Error('verification or visual results are not PASS');
const openEvidence = [
  'live host submission independent receiver reload and external retention',
  'authenticated submitter reviewer steward controller policy or real-world identity',
  'actual human review or participation',
  'authenticated steward reconciliation and recorded reconciliation result',
  'divergence resolution or settlement authority',
  'atomic current capture later currentness independent custody protected monotonic storage or globally consistent history',
  'provider execution or evaluation',
  'human benefit or learning proof',
  'execution adoption promotion merge Foundation mutation or CANON decision',
  'independent Draft 2020-12 schema meta-validation',
  'assistive-technology compatibility or human usability study'
];
const receipt = {
  schema:'axm.session-curation-receipt/v1', status:'TEST',
  sessionId:'2026-08-21-model-shadow-transition-history-reconciliation-review-bridge-v4.0',
  sealedSegment:'SESSION_SEGMENT.jsonl', sealDigest:'sha256:' + seal.sha256,
  continuationSegments:[{ segment:'SESSION_SEGMENT_ADDENDUM.jsonl', seal:'SESSION_SEGMENT_ADDENDUM.seal.json', sealDigest:'sha256:' + addendumSeal.sha256, durableEventsPreserved:addendumSeal.eventLines }],
  durableEventsPreserved:seal.eventLines + addendumSeal.eventLines,
  telemetryAggregation:{ retainedRawLogs:false, commandOutcomes:results.summary.commands, passedCommands:results.summary.passed, failedCommands:results.summary.failed, focusedAssertions:results.summary.focusedAssertions, unchangedProgressPollsRetained:false, rawBrowserTelemetryRetained:false },
  temporaryMaterialDeleted:{ classification:'TEMPORARY_CAPTURE_AND_SYNTHETIC_TEST_STATE', inMemoryScreenshotBuffersCleared:7, selectedScreenshotDigestsRetained:5, visualHarnessRootsRemoved:1, browserTabsClosed:1, viewportOverridesReset:1, focusedSelftestRoots:'each focused harness self-verifies bounded cleanup; aggregate root count was not retained' },
  explicitRetentionExceptions:[],
  derivedViewsUpdated:['SESSION_SUMMARY.md','SESSION_INDEX.json','CAPABILITY_GAP_AFTER.json','CHECK_RESULTS.json','VISUAL_RECEIPT.json'],
  unclassifiedItems:[],
  authorityUsed:'Delegated stewardship on an isolated codex branch. No shared-main mutation specialist ZIP intake foreign-worktree edit global tools-index edit live host submission external custody authenticated identity actual human review reconciliation consequential decision execution adoption install promotion merge Foundation mutation or CANON authority used.'
};
const index = {
  schema:'axm.session-index/v1', status:'TEST', sessionId:receipt.sessionId,
  summary:'SESSION_SUMMARY.md', segment:receipt.sealedSegment, seal:'SESSION_SEGMENT.seal.json', continuationSegments:receipt.continuationSegments, curationReceipt:'CURATION_RECEIPT.json',
  sourceSnapshot:'SOURCE_SNAPSHOT.json', checkResults:'CHECK_RESULTS.json', visualReceipt:'VISUAL_RECEIPT.json', capabilityBefore:'CAPABILITY_GAP_BEFORE.json', capabilityAfter:'CAPABILITY_GAP_AFTER.json', openEvidence
};
fs.writeFileSync(path.join(dir, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(dir, 'SESSION_INDEX.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log('PASS wrote curation receipt and session index');
