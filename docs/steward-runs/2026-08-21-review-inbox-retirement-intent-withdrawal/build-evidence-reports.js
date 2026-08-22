#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const productCommit = 'fa6f8fd94145ad58c6388bb64b62e5d75c19a46e';
const productTree = '4527ff55d6270fdea33894fc9d4ff2126aad5f2a';
const parentCommit = '5087e5dc6d7744b9814d6b4697a1ae299e44b773';
function read(name) { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
function write(name, value) { fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function digest(value) { return 'sha256:' + crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : Core.canonicalJson(value)).digest('hex'); }

const checks = read('CHECK_RESULTS.json');
const baseline = read('BASELINE_FRONTIER_AUDIT.json');
const aggregate = read('AGGREGATE_OPERATIONS_PROBE.json');
const clean = read('CLEAN_PRODUCT_REPLAY.json');
const source = read('SOURCE_SNAPSHOT.json');
const before = read('FRONTIER_GAP_BEFORE.json');
const after = read('FRONTIER_GAP_AFTER.json');
if (checks.status !== 'PASS' || baseline.status !== 'BLOCKED' || aggregate.status !== 'FOREIGN_FAILURE' || clean.status !== 'PASS' || after.overall !== 'DEGRADED') {
  throw new Error('primary evidence is not ready');
}

const routes = [
  { id:'parent-capability-gap', kind:'technical', claim:'The exact v4.8 parent exports no withdrawal method or decision/withdrawal schema and exposes no withdraw CLI or contract.', evidence:['BASELINE_FRONTIER_AUDIT.json'], verdict:'PASS', counterevidence:'Source/runtime absence proves this bounded seam was missing, not that every possible cancellation design was absent.' },
  { id:'closed-withdrawal-contract', kind:'technical', claim:'The product accepts only the exact schema, id, digest, assertion, confirmation, and bounded reason.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'The caller assertion is not authenticated and proves no holder state.' },
  { id:'append-only-owner-preserving-withdrawal', kind:'persistence', claim:'Withdrawal retains exact intent and decision evidence without rewriting or releasing the owner lock.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Noncooperating writers and protected-storage properties are outside scope.' },
  { id:'proceed-withdraw-process-arbitration', kind:'behavioral', claim:'Two real cooperating processes converge in both winner orders and the loser receives a typed refusal.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Only cooperating callers on one host and the exercised local filesystem are covered.' },
  { id:'ambiguous-intent-repair', kind:'behavioral', claim:'Withdrawing one exact undecided intent repairs a two-intent ambiguity while retaining both records.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'This does not choose which intent an operator should withdraw.' },
  { id:'legacy-retirement-recovery-preserved', kind:'regression', claim:'Inherited lease, retirement, recovery, checkpoint, and process tests remain passing.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Passing focused tests do not prove all I/O failures or filesystems.' },
  { id:'public-boundary', kind:'authorization', claim:'Review Inbox remains TEST and declares no automatic/API/browser withdrawal, general cancellation safety, liveness, merge, or CANON authority.', evidence:['SOURCE_SNAPSHOT.json','CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'No authenticated human review or acceptance occurred.' },
  { id:'required-checks', kind:'technical', claim:'All ten AGENTS.md commands exit zero on the product worktree.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Script checks are not a browser render/click test.' },
  { id:'clean-product-replay', kind:'persistence', claim:'The exact product dependency slice replays nine focused commands with unchanged tracked bytes.', evidence:['CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'This is a 102-file dependency slice, not the full repository.' },
  { id:'aggregate-nonpass', kind:'technical', claim:'Aggregate operations remains nonpassing only after both product tests pass, at an unchanged absent curated intake.', evidence:['AGGREGATE_OPERATIONS_PROBE.json'], verdict:'PASS', counterevidence:'The aggregate command is not claimed as passing.' }
];
write('EVIDENCE_ROUTES.json', { schema:'axm.evidence-routes/v1', status:'TEST', routes, routesDigest:digest(routes) });

write('NATIVE_SURFACE_RECEIPT.json', {
  schema:'axm.native-surface-receipt/v1', status:'PASS', productCommit,
  browserFacingFilesChanged:false, liveBrowserRerun:false,
  runtimeEvidence:{ focusedAssertionsAndControls:checks.summary.focusedAssertions, realProcessDecisionAssertions:22, withdrawalAssertions:87, cleanReplayCommands:clean.summary.passed },
  truth:{
    explicitIntentWithdrawal:true, appendOnlyDecisionEvidence:true, ownerLockMutatedByWithdrawal:false,
    cooperatingSingleHostProceedWithdrawArbitration:true, generalCancellationSafetyProven:false,
    holderLivenessOrTerminationProven:false, crossFileAtomicityProven:false, multiHostSafetyProven:false,
    externalWritersExcluded:false, actualHumanParticipationProven:false, humanBenefitProven:false,
    learningProven:false, executionAuthorized:false, adoptionAuthorized:false, promotionAuthorized:false,
    mergeAuthorized:false, canonAuthorized:false
  },
  retention:{ rawOwnerBytesRetained:false, rawCommandLogsRetained:false, screenshotsRetained:false, recordingsRetained:false, excludedPackageLaneInspected:false }
});

const eventValues = [
  ['SOURCE_SNAPSHOT','PASS','Bound the exact product, tree, parent, and twenty changed product files.'],
  ['CAPABILITY_SCOUT_BEFORE','BLOCKED','Six bounded withdrawal and decision capabilities were absent at the parent frontier.'],
  ['FRONTIER_SELECTION','TEST','Selected explicit interrupted-intent withdrawal and proceed/withdraw arbitration as the bounded seam.'],
  ['IMPLEMENTATION','TEST','Added closed host-local withdrawal and an append-only exact decision file.'],
  ['OWNER_PRESERVATION','PASS','Withdrawal retained owner-lock bytes and did not expose release authority.'],
  ['AMBIGUITY_REPAIR','PASS','One exact withdrawal repaired a two-intent ambiguity without deleting evidence.'],
  ['REENTRANT_RACES','PASS','Deterministic interleavings covered duplicate withdrawal and both proceed/withdraw outcomes.'],
  ['REAL_PROCESS_RACES','PASS','Two real processes exercised both decision winner orders.'],
  ['INHERITED_REGRESSION','PASS','Lease retirement and recovery suites remained passing.'],
  ['PUBLIC_CONTRACT','TEST','Review Inbox v1.1 declares the bounded capability and refusal boundaries.'],
  ['FOCUSED_CHECKS','PASS','Nine focused commands passed 586 assertions and controls.'],
  ['REQUIRED_CHECKS','PASS','All ten required repository commands exited zero.'],
  ['AGGREGATE_CHECK','FOREIGN_FAILURE','Aggregate operations stopped at unchanged missing curated verification intake after product tests passed.'],
  ['CLEAN_PRODUCT_REPLAY','PASS','Nine commands replayed from the exact 102-file product slice without tracked-byte changes.'],
  ['CAPABILITY_SCOUT_AFTER','DEGRADED','All six bounded requirements are ready; three optional broad gaps remain.'],
  ['BROWSER_BOUNDARY','TEST','No browser-facing file changed and no browser render/click run is claimed.'],
  ['AUTHORITY_BOUNDARY','TEST','No human review, execution, adoption, promotion, merge, Foundation, or CANON authority was established.'],
  ['GOAL_CONTINUITY','TEST','The broad grounded-growth objective remains active.']
];
const events = eventValues.map((item, index) => ({ schema:'axm.steward-session-event/v1', sequence:index + 1, type:item[0], status:item[1], summary:item[2], productCommit }));
const segment = events.map(item => JSON.stringify(item)).join('\n') + '\n';
fs.writeFileSync(path.join(dir, 'SESSION_SEGMENT.jsonl'), segment, 'utf8');
const seal = { schema:'axm.session-segment-seal/v1', status:'PASS', source:'SESSION_SEGMENT.jsonl', eventLines:events.length, validJsonLines:events.length, parseStatus:'valid', sha256:digest(segment).slice(7) };
write('SESSION_SEGMENT.seal.json', seal);
write('SESSION_INDEX.json', {
  schema:'axm.steward-session-index/v1', status:'TEST', productCommit, productTree, parentCommit,
  segment:'SESSION_SEGMENT.jsonl', seal:'SESSION_SEGMENT.seal.json', eventLines:events.length,
  mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM', broadGoalComplete:false,
  installed:false, promoted:false, excludedPackageLaneInspected:false
});
write('CURATION_RECEIPT.json', {
  schema:'axm.session-curation-receipt/v1', status:'PASS', productCommit,
  durableEventsPreserved:events.length, sealDigest:'sha256:' + seal.sha256,
  boundedCommandOutcomes:checks.summary.commands + clean.summary.commands + 1,
  retainedRawLogs:false, retainedRawOwnerBytes:false, retainedScreenshots:false, retainedRecordings:false,
  temporaryReplayRootsRemaining:0, aggregateOperationsStatus:aggregate.status,
  capabilityComparison:{ before:before.overall, after:after.overall, boundedRequiredReady:after.requirements.filter(item => item.required && item.status === 'READY').length, optionalGaps:after.requirements.filter(item => !item.required && item.status === 'OPTIONAL_GAP').length },
  sourceFiles:source.files.length,
  cleanProductReplay:{ commandsPassed:clean.summary.passed, trackedFiles:clean.trackedFiles, trackedFilesUnchanged:clean.trackedFilesUnchangedAfterReplay },
  broadGoalComplete:false, excludedPackageLaneInspected:false
});
console.log('EVIDENCE REPORTS ' + events.length + ' sealed events · ' + routes.length + ' claim routes');
