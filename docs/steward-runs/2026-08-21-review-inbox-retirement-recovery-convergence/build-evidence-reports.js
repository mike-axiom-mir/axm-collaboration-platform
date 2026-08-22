#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const dir = __dirname;
const productCommit = 'ff0b8e3a2040de6f25082e83af83c13b6cff9237';
const productTree = '9a9beb9f5f6cc13d6ad73f1ea55cc3d683e65c9c';
const parentCommit = '8f41d9e039179245d9e7923202d7c82b82158932';
function read(name) { return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')); }
function write(name, value) { fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function digest(value) { return 'sha256:' + crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : Core.canonicalJson(value)).digest('hex'); }

const checks = read('CHECK_RESULTS.json'), reproduction = read('CONVERGENCE_REPRODUCTION.json');
const aggregate = read('AGGREGATE_OPERATIONS_PROBE.json'), clean = read('CLEAN_PRODUCT_REPLAY.json'), source = read('SOURCE_SNAPSHOT.json');
if (checks.status !== 'PASS' || reproduction.status !== 'REPRODUCED' || aggregate.status !== 'FOREIGN_FAILURE' || clean.status !== 'PASS') throw new Error('primary evidence is not ready');

const requirements = [
  { id:'resume-race-reproduction', required:true, description:'Reproduce the exact parent lease-move race without inference.' },
  { id:'finalize-race-reproduction', required:true, description:'Reproduce the exact parent exclusive-result race without inference.' },
  { id:'digest-verified-checkpoint-observation', required:true, description:'Accept only exact intent-bound quarantine or result evidence.' },
  { id:'typed-invalid-collision-hold', required:true, description:'Keep corrupt or conflicting checkpoint evidence held with a typed refusal.' },
  { id:'real-process-convergence', required:true, description:'Exercise both checkpoints with two real cooperating processes.' },
  { id:'bounded-observation', required:true, description:'Bound checkpoint observation and retry timing.' },
  { id:'truth-ceiling', required:true, description:'Deny general serialization, cancellation safety, cross-file atomicity, and authority.' },
  { id:'review-inbox-contract', required:true, description:'Expose the qualified seam in the TEST manifest and module contract.' },
  { id:'required-checks', required:true, description:'Pass all ten AGENTS.md commands.' },
  { id:'clean-product-replay', required:true, description:'Replay focused behavior from an exact archived product slice without tracked mutation.' },
  { id:'general-recovery-serialization', required:false, description:'Serialize arbitrary recovery callers and external writers.' },
  { id:'retirement-cancellation-safety', required:false, description:'Prove safe cancellation or withdrawal during retirement.' },
  { id:'cross-file-atomicity', required:false, description:'Make intent, quarantine, and result one atomic transaction.' },
  { id:'multi-host-network-filesystem-safety', required:false, description:'Prove behavior across hosts and network filesystems.' },
  { id:'holder-termination-proof', required:false, description:'Authenticate holder termination or abandonment.' },
  { id:'human-benefit-learning-or-canon', required:false, description:'Prove human benefit, learning, promotion, merge, or CANON.' }
];
write('CAPABILITY_REQUIREMENTS.json', { schema:'axm.capability-requirements/v1', status:'TEST', objective:'bounded concurrent interrupted-retirement recovery checkpoint convergence', requirements });
write('CAPABILITY_INVENTORY_BEFORE.json', {
  schema:'axm.capability-inventory/v1', status:'TEST', sourceCommit:parentCommit,
  available:['exact retirement intent','owner-evidence quarantine','explicit interrupted-retirement recovery','typed recovery status'],
  missing:['concurrent lease-move convergence','concurrent result-publication convergence','real-process concurrent checkpoint evidence','typed corrupt-collision convergence boundary'],
  authority:{ install:false, promote:false, merge:false, canon:false }
});
write('CAPABILITY_INVENTORY_AFTER.json', {
  schema:'axm.capability-inventory/v1', status:'TEST', sourceCommit:productCommit,
  available:['digest-verified bounded checkpoint observation','typed concurrent checkpoint collision holds','reentrant deterministic race tests','two-process checkpoint tests','Review Inbox v1.0 TEST contract'],
  missing:['general recovery serialization','cancellation safety','cross-file atomicity','multi-host safety','holder termination proof','human benefit or learning proof'],
  authority:{ install:false, promote:false, merge:false, canon:false }
});
function gap(after) {
  const ready = new Set(after ? requirements.filter(item => item.required).map(item => item.id) : []);
  const items = requirements.map(item => ({ ...item, status:ready.has(item.id) ? 'READY' : 'OPEN' }));
  return { schema:'axm.capability-gap-report/v1', status:'TEST', sourceCommit:after ? productCommit : parentCommit, overall:items.some(item => item.required && item.status !== 'READY') ? 'BLOCKED' : items.some(item => !item.required && item.status !== 'READY') ? 'DEGRADED' : 'READY', requirements:items, proposedHands:items.filter(item => !item.required && item.status !== 'READY').map(item => ({ id:item.id, contractStatus:'SPEC_REQUIRED', installed:false })) };
}
write('CAPABILITY_GAP_BEFORE.json', gap(false));
write('CAPABILITY_GAP_AFTER.json', gap(true));

const routes = [
  { id:'parent-resume-race', kind:'behavioral', claim:'The exact parent surfaces raw ENOENT in the lease-move race.', evidence:['CONVERGENCE_REPRODUCTION.json#/baseline/resume'], verdict:'PASS', counterevidence:'Synthetic deterministic interleaving does not prove production frequency.' },
  { id:'parent-finalize-race', kind:'behavioral', claim:'The exact parent surfaces raw EEXIST in the result race.', evidence:['CONVERGENCE_REPRODUCTION.json#/baseline/finalize'], verdict:'PASS', counterevidence:'Synthetic deterministic interleaving does not prove production frequency.' },
  { id:'product-reentrant-convergence', kind:'behavioral', claim:'Both product checkpoints converge without raw race errors.', evidence:['CONVERGENCE_REPRODUCTION.json#/product','CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'This covers cooperating single-host exact callers only.' },
  { id:'product-real-process-convergence', kind:'behavioral', claim:'Two real processes converge at both product checkpoints.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'No multi-host or network-filesystem behavior is tested.' },
  { id:'corrupt-collision-holds', kind:'technical', claim:'Invalid result and corrupt quarantine collisions remain typed holds.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Unknown I/O failures outside recognized checkpoint races may still surface.' },
  { id:'contract-truth-ceiling', kind:'authorization', claim:'The runtime and public contract deny broader authority and safety claims.', evidence:['SOURCE_SNAPSHOT.json','CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'No authenticated human review or CANON decision occurred.' },
  { id:'required-repository-checks', kind:'technical', claim:'All ten required checks exit zero.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Script checks are not a browser render/click test.' },
  { id:'clean-product-replay', kind:'persistence', claim:'The exact archived product slice replays seven checks without tracked mutation.', evidence:['CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'The replay is a bounded dependency slice, not the entire repository.' },
  { id:'aggregate-operations-nonpass', kind:'technical', claim:'Aggregate operations remains nonpassing at an unchanged missing curated intake.', evidence:['AGGREGATE_OPERATIONS_PROBE.json'], verdict:'PASS', counterevidence:'The aggregate command is not claimed as passing.' }
];
write('EVIDENCE_ROUTES.json', { schema:'axm.evidence-routes/v1', status:'TEST', routes, routesDigest:digest(routes) });
write('NATIVE_SURFACE_RECEIPT.json', {
  schema:'axm.native-surface-receipt/v1', status:'PASS', productCommit,
  browserFacingFilesChanged:false, liveBrowserRerun:false,
  runtimeEvidence:{ reentrantAssertions:30, realProcessAssertions:20, recoveryAssertions:108, reviewInboxAssertions:137, discoveryControls:25 },
  truth:{ cooperatingSingleHostExactCheckpointConvergence:true, generalSerializationProven:false, cancellationSafetyProven:false, crossFileAtomicityProven:false, multiHostSafetyProven:false, holderTerminationProven:false, actualHumanParticipationProven:false, humanBenefitProven:false, learningProven:false, mergeAuthorized:false, canonAuthorized:false },
  retention:{ rawOwnerBytesRetained:false, screenshotsRetained:false, recordingsRetained:false, specialistPackagesInspected:false }
});

const eventValues = [
  ['SOURCE_SNAPSHOT','PASS','Bound product commit and exact parent identities.'],
  ['FRONTIER_AUDIT','PASS','Selected concurrent interrupted-retirement checkpoint races as the bounded frontier.'],
  ['BASELINE_RESUME_RACE','BROKEN','Exact parent outer caller surfaced ENOENT after a cooperating caller moved the lease.'],
  ['BASELINE_FINALIZE_RACE','BROKEN','Exact parent outer caller surfaced EEXIST after a cooperating caller published the result.'],
  ['IMPLEMENTATION','TEST','Added bounded digest-verified checkpoint observation and typed collision holds.'],
  ['REENTRANT_TEST','PASS','Both deterministic reentrant checkpoint races converged.'],
  ['PROCESS_TEST','PASS','Two real processes converged at both checkpoints.'],
  ['CORRUPTION_TEST','PASS','Corrupt and conflicting checkpoint evidence remained held.'],
  ['CONTRACT_UPDATE','TEST','Review Inbox v1.0 declares the qualified capability and refusal boundary.'],
  ['FOCUSED_CHECKS','PASS','Eight focused commands passed 539 assertions and controls.'],
  ['REQUIRED_CHECKS','PASS','All ten required repository commands exited zero.'],
  ['AGGREGATE_CHECK','FOREIGN_FAILURE','Aggregate operations stopped at unchanged missing curated verification intake.'],
  ['CLEAN_PRODUCT_REPLAY','PASS','Seven archived product-slice commands passed without tracked mutation.'],
  ['BROWSER_BOUNDARY','TEST','No browser-facing file changed and no browser run is claimed.'],
  ['AUTHORITY_BOUNDARY','TEST','No execution, adoption, promotion, merge, Foundation, or CANON authority was granted.'],
  ['PACKAGE_BOUNDARY','PASS','Specialist ZIP packages were not inspected or modified.'],
  ['CURATION','PASS','Raw logs, temp roots, owner bytes, screenshots, and recordings were not retained.'],
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
  installed:false, promoted:false, specialistPackagesInspected:false
});
write('CURATION_RECEIPT.json', {
  schema:'axm.session-curation-receipt/v1', status:'PASS', productCommit,
  durableEventsPreserved:events.length, sealDigest:'sha256:' + seal.sha256,
  boundedCommandOutcomes:checks.summary.commands + clean.summary.commands + 1,
  retainedRawLogs:false, retainedRawOwnerBytes:false, retainedScreenshots:false, retainedRecordings:false,
  temporaryReplayRootsRemaining:0, aggregateOperationsStatus:aggregate.status,
  capabilityComparison:{ before:gap(false).overall, after:gap(true).overall },
  sourceFiles:source.files.length, cleanProductReplay:{ commandsPassed:clean.summary.passed, trackedFiles:clean.trackedFiles, trackedFilesUnchanged:clean.trackedFilesUnchangedAfterReplay },
  broadGoalComplete:false, specialistPackagesInspected:false
});
console.log('EVIDENCE REPORTS ' + events.length + ' sealed events · ' + routes.length + ' claim routes');
