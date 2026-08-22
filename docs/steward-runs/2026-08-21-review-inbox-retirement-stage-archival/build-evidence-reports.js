#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const DIR = __dirname;
const product = 'a71cd29a3c0652279e5f2db1a42067e7b2c632e5';
const parent = 'aafff013093cf0a23a4f49ba6a5c73acdc068238';
const tree = 'db8b749c7597b9af7fa0b901c1f917f6ef149b88';
const now = new Date().toISOString();
function json(name) { return JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8')); }
function write(name,value) { fs.writeFileSync(path.join(DIR,name),typeof value === 'string' ? value : JSON.stringify(value,null,2) + '\n','utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digest(value) { return 'sha256:' + sha256(Core.canonicalJson(value)); }

const checks = json('CHECK_RESULTS.json');
const clean = json('CLEAN_PRODUCT_REPLAY.json');
const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
const baseline = json('BASELINE_STAGE_ACCUMULATION.json');
const before = json('FRONTIER_GAP_BEFORE.json');
const after = json('FRONTIER_GAP_AFTER.json');
const source = json('SOURCE_SNAPSHOT.json');
if (checks.status !== 'PASS' || clean.status !== 'PASS' || aggregate.status !== 'FOREIGN_FAILURE' || baseline.status !== 'REPRODUCED') throw new Error('primary evidence is not in the expected exact state');

const native = {
  schema:'axm.native-surface-receipt/v1', status:'PASS', productCommit:product, productTree:tree,
  browserFacingFilesChanged:source.browserFacingFilesChanged, liveBrowserRerun:false, browserRenderClickTest:'NOT_RUN_HOST_LOCAL_NO_BROWSER_ROUTE',
  hostLocalHardLinkFilesystemExercised:true, archivalRealChildProcessCrashCases:9, inheritedPublicationRealChildProcessCrashCases:6,
  realCooperatingArchivalProcesses:2, promotionReady:false, promotionBlocker:'selftest result is stale for the current selftest digest',
  truth:{
    exactIntentDecisionResultStageBindingObserved:true,
    authoritativeTargetClassificationObserved:true,
    losslessArchiveBytesObserved:true,
    activeStagePathRemovalObserved:true,
    authoritativeTargetMutatedByArchival:false,
    ownerLockMutatedByArchival:false,
    cooperatingSingleHostArchiveCheckpointConvergenceObserved:true,
    stageBytesDeletedByArchival:false,
    storageSpaceReclaimed:false,
    durableArchivalAuthorizationRecordProvided:false,
    publisherTerminatedOrAbandonedProven:false,
    livePublisherSafetyProven:false,
    hardLinkFreeArchiveFallbackProvided:false,
    powerLossDurabilityProven:false,
    crossFileAtomicityProven:false,
    multiHostOrNetworkFilesystemSafetyProven:false,
    externalWriterExclusionProven:false,
    actualHumanReviewProven:false,
    humanBenefitProven:false,
    mergeAuthorized:false,
    canonAuthorized:false
  },
  receiptDigest:null
};
{ const body = JSON.parse(Core.canonicalJson(native)); delete body.receiptDigest; native.receiptDigest = digest(body); }
write('NATIVE_SURFACE_RECEIPT.json',native);

const routes = [
  { id:'v50-stage-accumulation', kind:'behavioral', claim:'At 200 syntactically valid residual names v5.0 status reports STAGED; at 201 it holds and truncates, while invalid JSON with a valid name is still reported as staged.', evidence:['BASELINE_STAGE_ACCUMULATION.json'], verdict:'PASS', counterevidence:'The baseline is synthetic name/status evidence and does not claim every residual stage is safe to archive.' },
  { id:'exact-stage-artifact-plan', kind:'technical', claim:'The v5.1 single-stage plan validates exact intent, decision, or result JSON against the lowercase filename retirement id and artifact kind.', evidence:['SOURCE_SNAPSHOT.json','CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Malformed, oversized, missing, uppercase, symlink-shaped, or unreadable evidence stays held.' },
  { id:'target-and-archive-classification', kind:'behavioral', claim:'The plan classifies authoritative target and archive evidence and refuses conflicting or invalid targets and archives without changing them.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Classification is bounded local filesystem observation and does not exclude noncooperating writers.' },
  { id:'closed-archival-request', kind:'authorization', claim:'Archival requires a closed publisher-abandonment assertion, exact lowercase stage filename, stage digest, filename/digest confirmation, and trimmed 20-to-500-character reason.', evidence:['SOURCE_SNAPSHOT.json','CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'The assertion is not authenticated and its truth is not established.' },
  { id:'lossless-archive-order', kind:'behavioral', claim:'Exact staged bytes are exclusively hard-linked into the separate archive, verified, and only then removed from the active staging path.', evidence:['SOURCE_SNAPSHOT.json','CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'The bytes remain stored; this is not deletion or space reclamation.' },
  { id:'authoritative-target-preservation', kind:'behavioral', claim:'Archival leaves an absent authoritative target absent and preserves exact already-published target bytes.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'A concurrent publisher may independently create the target; archival itself never targets it.' },
  { id:'archive-crash-convergence', kind:'persistence', claim:'Nine real child-process exits cover pre-link, post-link, and post-unlink archival checkpoints for intent, decision, and result stages; exact retry converges.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'These are process exits, not power interruption or directory-entry durability evidence.' },
  { id:'archive-caller-convergence', kind:'behavioral', claim:'Reentrant and two real cooperating single-host callers converge through the exclusive digest-verified archive checkpoint.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'This does not prove multi-host, network-filesystem, or noncooperating-writer safety.' },
  { id:'bounded-status-restoration', kind:'behavioral', claim:'Direct exact archival of one stage from a 201-stage fixture restores bounded aggregate visibility to 200 active stages.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'The archive is unbounded and no storage-retention policy is provided.' },
  { id:'inherited-retirement-regression', kind:'regression', claim:'Inherited lease, retirement, publication, recovery, convergence, withdrawal, and decision-process checks remain passing.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Focused tests do not cover every filesystem or external writer.' },
  { id:'required-checks', kind:'technical', claim:'All ten exact AGENTS.md commands exit zero on the product worktree.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Script checks are separate from browser render/click evidence.' },
  { id:'clean-product-replay', kind:'persistence', claim:'The exact 108-file product dependency slice replays eleven focused commands with 930 assertions or controls and no tracked-byte changes.', evidence:['CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'The replay is a bounded dependency slice, not every repository file or host substrate.' },
  { id:'aggregate-operations-nonpass', kind:'technical', claim:'Aggregate operations reaches the archival and inherited product checks and then fails at the unchanged missing curated verification intake.', evidence:['AGGREGATE_OPERATIONS_PROBE.json'], verdict:'PASS', counterevidence:'The aggregate command is not claimed as passing and the intake lane remains outside this product diff.' },
  { id:'authority-and-browser-boundary', kind:'visual', claim:'No browser-facing product file or archival route changed; Review Inbox remains TEST and no browser pass, human review, merge, or CANON authority is claimed.', evidence:['SOURCE_SNAPSHOT.json','NATIVE_SURFACE_RECEIPT.json'], verdict:'PASS', counterevidence:'No Mike Tobi / AXM acceptance or authenticated human review occurred.' }
];
write('EVIDENCE_ROUTES.json',{ schema:'axm.evidence-routes/v1', status:'TEST', routes, routesDigest:digest(routes) });

const events = [
  ['objective','ACTIVE','Continue grounded Workshop growth without claiming the broad objective complete.',['SESSION_INDEX.json']],
  ['governance','BOUND','Preserve Mike Tobi / AXM as merge and CANON gate; keep Review Inbox TEST.',['NATIVE_SURFACE_RECEIPT.json']],
  ['frontier','BLOCKED','Capability comparison found nine required residual-stage archival gaps in v5.0.',['FRONTIER_GAP_BEFORE.json']],
  ['baseline','REPRODUCED','Two hundred valid names remain visible, the 201st holds status, and staged JSON is not validated in v5.0.',['BASELINE_STAGE_ACCUMULATION.json']],
  ['design','BOUNDED','Selected explicit digest-bound lossless same-filesystem archival with exact truth ceilings.',['FRONTIER_CAPABILITIES_AFTER.json']],
  ['implementation','TEST','Added closed stage plan, request, and result contracts plus host-local CLI commands.',['SOURCE_SNAPSHOT.json']],
  ['binding','PASS','Exact intent, decision, and result stage bytes bind to lowercase stage identity.',['CHECK_RESULTS.json']],
  ['classification','PASS','Authoritative target and archive conflicts remain held and unchanged.',['CHECK_RESULTS.json']],
  ['archive','PASS','Archive hard link is verified before the active stage path is removed.',['CHECK_RESULTS.json']],
  ['crash-matrix','PASS','Nine child-process exits cover three archival checkpoints for three artifact kinds.',['CHECK_RESULTS.json']],
  ['caller-race','PASS','Reentrant and two-process callers converge through exact archive evidence.',['CHECK_RESULTS.json']],
  ['contract','TEST','Review Inbox v1.3 declares host-local archival and refuses deletion, durability, live-publisher, API, browser, and authority inflation.',['SOURCE_SNAPSHOT.json']],
  ['verification','PASS','Eleven focused and ten required commands pass with 930 focused assertions or controls.',['CHECK_RESULTS.json']],
  ['promotion','BLOCKED','Tools index preserves Review Inbox as blocked because the persisted promotion result is stale for the current selftest digest.',['SOURCE_SNAPSHOT.json']],
  ['product','TEST','Product commit and tree are exact and contain fifteen changed files.',['SOURCE_SNAPSHOT.json']],
  ['replay','PASS','Clean 108-file product slice replay passes without tracked-byte mutation.',['CLEAN_PRODUCT_REPLAY.json']],
  ['aggregate','FOREIGN_FAILURE','Aggregate operations remains nonpassing at the unchanged missing curated verification intake.',['AGGREGATE_OPERATIONS_PROBE.json']],
  ['capability','DEGRADED','Nine bounded required capabilities are ready; six optional safety, durability, authorization, portability, and storage gaps remain.',['FRONTIER_GAP_AFTER.json']],
  ['continuity','ACTIVE','Broad objective remains active; no human benefit, learning, provider execution, promotion, merge, or CANON evidence is invented.',['SESSION_INDEX.json','NATIVE_SURFACE_RECEIPT.json']]
].map((item,index) => ({ schema:'axm.session-semantic-event/v1', sequence:index + 1, recordedAt:now, kind:item[0], status:item[1], statement:item[2], evidence:item[3] }));
const segment = events.map(event => JSON.stringify(event)).join('\n') + '\n';
write('SESSION_SEGMENT.jsonl',segment);
write('SESSION_SEGMENT.seal.json',{ schema:'axm.session-segment-seal/v1', status:'PASS', parseStatus:'valid', eventLines:events.length, validJsonLines:events.length, sha256:sha256(segment) });
write('SESSION_INDEX.json',{ schema:'axm.session-index/v1', status:'TEST', productCommit:product, productTree:tree, semanticEvents:events.length, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM', specialistPackageIntakeAttempted:false, rawLogsRetained:false });
write('CURATION_RECEIPT.json',{ schema:'axm.session-curation-receipt/v1', status:'PASS', curatedAt:now, durableEventsPreserved:events.length, retainedRawLogs:false, retainedRawStageBytes:false, retainedScreenshots:false, retainedSpecialistPackages:false, aggregateOperationsStatus:aggregate.status, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM' });

write('FRONTIER_AUDIT.md',[
  '# Grounded-growth frontier audit — Review Inbox retirement stage archival v5.1','', 'Status: `TEST`','',
  'v5.0 made retirement JSON publication process-crash-consistent but left residual stages indefinitely active. Its aggregate status validated filenames only: 200 syntactically valid names remained visible, the 201st held the status, and `{}` payloads with valid names still appeared staged. There was no exact plan or archival entry point.','',
  'v5.1 adds an exact read-only plan for one lowercase stage filename. It validates the intent, decision, or result JSON against its retirement id, computes the exact digest, and classifies the authoritative target and archive. Conflicting, invalid, oversized, unreadable, missing, uppercase, and path-shaped evidence stays held.','',
  'Archival requires the exact plan digest, a closed publisher-terminated-or-abandoned assertion, a filename/digest confirmation, and a reason. It creates an exclusive same-filesystem hard link in a separate archive, verifies those exact bytes, and only then removes the active stage pathname. It never writes the authoritative target or owner lock. Nine real process exits exercise all three archive checkpoints for all three artifact types; reentrant and two-process callers converge.','',
  'This is lossless archival. It does not delete the bytes, reclaim space, bound archive retention, record durable authorization, authenticate the actor, infer liveness, or make a false assertion safe. A false assertion can interrupt a live publisher. There is no hard-link-free fallback, power-loss durability, cross-file atomicity, multi-host/network-filesystem safety, or noncooperating-writer exclusion.','',
  'All 21 scoped commands pass: eleven focused commands with 930 assertions or controls and the ten required AGENTS.md checks. A clean 108-file product slice replays all focused commands without tracked-byte mutation. Aggregate `npm run test:operations` remains `FOREIGN_FAILURE` after reaching the product checks because `intakes/verification-proof-99-v0.1` is still absent and unchanged by this lane.','',
  'The regenerated tools index keeps Review Inbox promotion `BLOCKED` because its persisted promotion result is stale for the changed v1.3 self-test digest. Passing scoped checks does not silently refresh or promote that evidence.','',
  'No browser-facing file changed and no browser render/click test is claimed. No real human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` evidence is claimed. Mike Tobi / AXM remains the merge and `CANON` gate, and the broad grounded-growth objective remains active.',''
].join('\n'));

write('README.md',[
  '# Review Inbox retirement stage archival v5.1 — TEST evidence','',
  'This folder binds product commit `' + product + '` and tree `' + tree + '` to explicit digest-bound lossless archival of exact residual retirement publication stages.','',
  '## Exact outcome','',
  '- v5.0 accumulation and name-only classification are reproduced at 200 and 201 stages.','- v5.1 validates exact intent, decision, or result stage bytes and classifies target/archive evidence.','- Closed host-local archival preserves exact bytes under an exclusive archive hard link before removing the active stage path.','- Nine real archival process crashes and two real cooperating callers exercise checkpoint convergence.','- 21/21 scoped commands pass with 930 focused assertions or controls.','- Tools index promotion remains `BLOCKED` on the exact stale-selftest-result blocker.','- Clean replay passes for the exact 108-file dependency slice without tracked-byte changes.','- Aggregate operations remains `FOREIGN_FAILURE` at the unchanged missing curated verification intake.','',
  '## Read first','',
  '- `FRONTIER_AUDIT.md` — bounded result and truth ceiling.','- `EVIDENCE_ROUTES.json` — claim-specific proof and counterevidence.','- `BASELINE_STAGE_ACCUMULATION.json` — exact v5.0 accumulation reproduction.','- `CHECK_RESULTS.json` — focused plus required checks.','- `CLEAN_PRODUCT_REPLAY.json` — exact clean product-slice replay.','- `AGGREGATE_OPERATIONS_PROBE.json` — preserved foreign aggregate failure.','- `SOURCE_SNAPSHOT.json` — exact product files and digests.','',
  '## Gate and continuity','',
  'The product remains `TEST`. Mike Tobi / AXM remains the merge and `CANON` gate. No byte deletion, storage reclamation, publisher safety, browser pass, authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` is claimed. The broad grounded-growth objective remains active.',''
].join('\n'));

write('SESSION_SUMMARY.md',[
  '# Session summary','', '- Product: Review Inbox retirement stage archival v5.1 (`TEST`).','- Exact product: `' + product + '` / tree `' + tree + '`.','- Baseline: v5.0 status is name-only; 200 stages remain visible and the 201st holds.','- Current proof: nine archival process crashes; two real cooperating callers; 21/21 scoped commands; 930 focused assertions or controls; clean 108-file replay.','- Promotion: tools index remains `BLOCKED` because the current self-test digest has only stale persisted promotion evidence.','- Preserved nonpass: aggregate operations `FOREIGN_FAILURE` at unchanged absent curated intake.','- Open optional gaps: durable authorization record, storage reclamation, live-publisher safety, hard-link-free archival, power-loss durability, and cross-file atomicity.','- Authority: Mike Tobi / AXM remains merge and `CANON` gate; broad goal remains active.',''
].join('\n'));

process.stdout.write('BUILT evidence routes, native receipt, sealed session, curation, audit, README, and summary\n');
