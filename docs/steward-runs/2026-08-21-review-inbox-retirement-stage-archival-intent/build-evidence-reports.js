#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const DIR = __dirname;
const product = 'b707aa08f0adf958f6344babf0839c37ab1b9dca';
const parent = '9e648f447538928825b4fbca306c6072af461933';
const tree = '0f2aa8e9e2fad6e19416c93667cf426899955eed';
const now = new Date().toISOString();
function json(name) { return JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8')); }
function write(name,value) { fs.writeFileSync(path.join(DIR,name),typeof value === 'string' ? value : JSON.stringify(value,null,2) + '\n','utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digest(value) { return 'sha256:' + sha256(Core.canonicalJson(value)); }

const checks = json('CHECK_RESULTS.json');
const clean = json('CLEAN_PRODUCT_REPLAY.json');
const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
const baseline = json('BASELINE_AUTHORIZATION_GAP.json');
const before = json('FRONTIER_GAP_BEFORE.json');
const after = json('FRONTIER_GAP_AFTER.json');
const source = json('SOURCE_SNAPSHOT.json');
const promotion = json('PROMOTION_SELFTEST_RECEIPT.json');
if (checks.status !== 'PASS' || clean.status !== 'PASS' || aggregate.status !== 'FOREIGN_FAILURE' || baseline.status !== 'REPRODUCED' ||
  before.overall !== 'BLOCKED' || after.overall !== 'DEGRADED' || promotion.reviewInbox.verdict !== 'PASS') {
  throw new Error('primary evidence is not in the expected exact state');
}

const native = {
  schema:'axm.native-surface-receipt/v1', status:'PASS', productCommit:product, productTree:tree,
  browserFacingFilesChanged:source.browserFacingFilesChanged, liveBrowserRerun:false,
  browserRenderClickTest:'NOT_RUN_HOST_LOCAL_NO_BROWSER_ROUTE', hostLocalHardLinkFilesystemExercised:true,
  intentPublicationRealChildProcessCrashCases:6, archivalRealChildProcessCrashCases:9,
  inheritedRetirementPublicationRealChildProcessCrashCases:6, realCooperatingArchivalProcesses:2,
  promotionSelftestCurrentAndPassing:true, toolsIndexReviewInboxState:'READY_FOR_HUMAN_REVIEW',
  truth:{
    durableExactArchivalIntentObserved:true,
    intentPublishedBeforeNewArchiveMutationObserved:true,
    exactClosedRequestDigestBindingObserved:true,
    exactIntentDecisionResultStageCoverageObserved:true,
    residualIntentPublicationStagesBoundedAndNonAuthoritative:true,
    completedLegacyArchiveAuthorizationUnknownObserved:true,
    legacyArchiveCheckpointStageUnlinkRefused:true,
    losslessArchiveBytesObserved:true,
    activeStagePathRemovalObservedForAuthorizedIntent:true,
    authoritativeTargetMutatedByArchival:false,
    ownerLockMutatedByArchival:false,
    stageBytesDeletedByArchival:false,
    storageSpaceReclaimed:false,
    callerAssertionAuthenticated:false,
    publisherTerminatedOrAbandonedProven:false,
    livePublisherSafetyProven:false,
    protectedOrMonotonicStorageProven:false,
    hardLinkFreeArchiveFallbackProvided:false,
    powerLossDurabilityProven:false,
    crossFileAtomicityProven:false,
    multiHostOrNetworkFilesystemSafetyProven:false,
    externalWriterExclusionProven:false,
    actualHumanReviewProven:false,
    humanBenefitProven:false,
    learningProven:false,
    promotionAuthorized:false,
    mergeAuthorized:false,
    canonAuthorized:false
  },
  receiptDigest:null
};
{ const body = JSON.parse(Core.canonicalJson(native)); delete body.receiptDigest; native.receiptDigest = digest(body); }
write('NATIVE_SURFACE_RECEIPT.json',native);

const routes = [
  { id:'v51-authorization-gap', kind:'behavioral', claim:'The exact v5.1 product archives a residual stage but persists neither its reason nor a durable archival authorization artifact.', evidence:['BASELINE_AUTHORIZATION_GAP.json'], verdict:'PASS', counterevidence:'The baseline proves the missing record only for the exact v5.1 commit and synthetic local fixture.' },
  { id:'intent-before-mutation', kind:'persistence', claim:'For new v1.4 archival, an exact append-only intent is authoritative before archive linking or active-stage unlink.', evidence:['SOURCE_SNAPSHOT.json','CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Intent, archive, and unlink remain separate filesystem checkpoints rather than one transaction.' },
  { id:'closed-request-binding', kind:'authorization', claim:'The durable intent binds the closed request schema, exact stage filename and digest, assertion, confirmation, and reason through a reproducible request digest.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'The assertion is persisted but not authenticated; consent, permission, and real-world identity are unproven.' },
  { id:'append-only-publication', kind:'persistence', claim:'Complete fsynced private intent bytes publish through an exclusive same-filesystem hard link without overwriting an existing intent.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'No hard-link-free fallback, protected storage, rollback prevention, or directory-entry power-loss proof exists.' },
  { id:'intent-crash-convergence', kind:'persistence', claim:'Six real process exits cover pre-intent-link and post-intent-link checkpoints for intent, decision, and result stages; exact retry converges.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json','NATIVE_SURFACE_RECEIPT.json'], verdict:'PASS', counterevidence:'Process exit is not a power interruption test.' },
  { id:'archive-crash-convergence', kind:'persistence', claim:'Nine real process exits still cover pre-archive-link, post-archive-link, and post-active-stage-unlink checkpoints for all three artifact kinds.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'The claim is limited to exact local evidence and same-filesystem hard links.' },
  { id:'caller-convergence', kind:'behavioral', claim:'Reentrant and two real cooperating single-host callers converge through exact intent and archive checkpoints.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Multi-host, network-filesystem, and noncooperating-writer safety are unproven.' },
  { id:'legacy-honesty', kind:'authorization', claim:'A completed v1.3 archive or archive-link checkpoint without intent remains authorization-unknown; no retrospective intent is created and the checkpoint stage is not unlinked.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'External writers are not excluded from fabricating local files.' },
  { id:'bounded-intent-status', kind:'behavioral', claim:'Host-local authorization status exposes residual intent stages as non-authoritative, reads only one entry beyond the 200-stage bound, and performs no automatic reclamation.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'The status is per requested stage plus a bounded directory observation, not a global storage-retention policy.' },
  { id:'schema-continuity', kind:'technical', claim:'The v1 stage-plan and v1 archival-result schemas remain unchanged; new result semantics use an explicit closed archival-result/v2 schema.', evidence:['SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'A new schema version does not prove consumer migration.' },
  { id:'host-local-boundary', kind:'authorization', claim:'Authorization status and archival are host-local CLI/runtime surfaces with no automatic, API, or browser route.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'Host-locality does not authenticate the caller or establish safety.' },
  { id:'required-checks', kind:'technical', claim:'All ten exact AGENTS.md commands exit zero on the product worktree.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Script checks are separate from browser render/click evidence.' },
  { id:'clean-product-replay', kind:'persistence', claim:'The exact product dependency slice replays eleven focused commands with 1,110 assertions or controls and no tracked-byte changes.', evidence:['CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'The replay is a bounded dependency slice, not every repository file or host substrate.' },
  { id:'promotion-selftest', kind:'technical', claim:'The current Review Inbox selftest digest passes and tools-index reports READY_FOR_HUMAN_REVIEW.', evidence:['PROMOTION_SELFTEST_RECEIPT.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'Twelve other tool promotion selftests remain nonpassing; readiness grants no promotion, merge, or CANON authority.' },
  { id:'aggregate-operations-nonpass', kind:'technical', claim:'Aggregate operations reaches the product checks and then fails at the unchanged missing curated verification intake.', evidence:['AGGREGATE_OPERATIONS_PROBE.json'], verdict:'PASS', counterevidence:'The aggregate command is not claimed as passing and the intake lane remains outside this diff.' },
  { id:'visual-and-human-gate', kind:'visual', claim:'No browser-facing product file or browser route changed; Review Inbox remains TEST and Mike Tobi / AXM remains merge and CANON gate.', evidence:['SOURCE_SNAPSHOT.json','NATIVE_SURFACE_RECEIPT.json'], verdict:'PASS', counterevidence:'No browser render/click, authenticated human review, human benefit, merge, or CANON decision occurred.' }
];
write('EVIDENCE_ROUTES.json',{ schema:'axm.evidence-routes/v1', status:'TEST', routes, routesDigest:digest(routes) });

const events = [
  ['objective','ACTIVE','Continue grounded Workshop growth without claiming the broad objective complete.',['SESSION_INDEX.json']],
  ['governance','BOUND','Preserve Mike Tobi / AXM as merge and CANON gate; keep Review Inbox TEST.',['NATIVE_SURFACE_RECEIPT.json']],
  ['frontier','BLOCKED','Capability comparison found ten required archival-intent gaps in v5.1.',['FRONTIER_GAP_BEFORE.json']],
  ['baseline','REPRODUCED','Exact v5.1 archival persists neither its reason nor a durable authorization artifact.',['BASELINE_AUTHORIZATION_GAP.json']],
  ['design','BOUNDED','Selected append-only exact-request archival intent before active-stage unlink.',['FRONTIER_CAPABILITIES_AFTER.json']],
  ['implementation','TEST','Added archival intent, authorization status, host-local CLI, and result/v2 contracts.',['SOURCE_SNAPSHOT.json']],
  ['ordering','PASS','New archival publishes exact intent before archive link and active-stage unlink.',['CHECK_RESULTS.json']],
  ['crash-matrix','PASS','Six intent-publication and nine archive child-process exits cover all three artifact kinds.',['CHECK_RESULTS.json']],
  ['caller-race','PASS','Reentrant and two-process callers converge through exact intent and archive evidence.',['CHECK_RESULTS.json']],
  ['legacy','HELD','Legacy archive and checkpoint evidence stays authorization-unknown without retrospective intent.',['CHECK_RESULTS.json']],
  ['bounded-status','PASS','Residual intent stages are bounded, visible, non-authoritative, and never automatically reclaimed.',['CHECK_RESULTS.json']],
  ['contract','TEST','Review Inbox v1.4 refuses actor authentication, safety, deletion, durability, portability, API, browser, and authority inflation.',['SOURCE_SNAPSHOT.json']],
  ['verification','PASS','Eleven focused and ten required commands pass with 1,110 focused assertions or controls.',['CHECK_RESULTS.json']],
  ['promotion-selftest','MIXED','Review Inbox current selftest passes while twelve other promotion selftests remain nonpassing.',['PROMOTION_SELFTEST_RECEIPT.json']],
  ['readiness','READY_FOR_HUMAN_REVIEW','Tools index reports Review Inbox ready for human review; this is not promotion or acceptance.',['PROMOTION_SELFTEST_RECEIPT.json']],
  ['product','TEST','Product commit and tree are exact and contain fourteen changed files.',['SOURCE_SNAPSHOT.json']],
  ['replay','PASS','Clean product dependency-slice replay passes without tracked-byte mutation.',['CLEAN_PRODUCT_REPLAY.json']],
  ['aggregate','FOREIGN_FAILURE','Aggregate operations remains nonpassing at the unchanged missing curated verification intake.',['AGGREGATE_OPERATIONS_PROBE.json']],
  ['capability','DEGRADED','Ten bounded required capabilities are ready; six optional safety, durability, authorization, portability, and storage gaps remain.',['FRONTIER_GAP_AFTER.json']],
  ['continuity','ACTIVE','Broad objective remains active; no human benefit, learning, provider execution, promotion, merge, or CANON evidence is invented.',['SESSION_INDEX.json','NATIVE_SURFACE_RECEIPT.json']]
].map((item,index) => ({ schema:'axm.session-semantic-event/v1', sequence:index + 1, recordedAt:now, kind:item[0], status:item[1], statement:item[2], evidence:item[3] }));
const segment = events.map(event => JSON.stringify(event)).join('\n') + '\n';
write('SESSION_SEGMENT.jsonl',segment);
write('SESSION_SEGMENT.seal.json',{ schema:'axm.session-segment-seal/v1', status:'PASS', parseStatus:'valid', eventLines:events.length, validJsonLines:events.length, sha256:sha256(segment) });
write('SESSION_INDEX.json',{ schema:'axm.session-index/v1', status:'TEST', productCommit:product, productTree:tree, semanticEvents:events.length, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM', specialistPackageIntakeAttempted:false, rawLogsRetained:false });
write('CURATION_RECEIPT.json',{ schema:'axm.session-curation-receipt/v1', status:'PASS', curatedAt:now, durableEventsPreserved:events.length, retainedRawLogs:false, retainedFailureTails:false, retainedRawStageBytes:false, retainedScreenshots:false, retainedSpecialistPackages:false, aggregateOperationsStatus:aggregate.status, promotionSelftestStatus:promotion.status, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM' });

write('FRONTIER_AUDIT.md',[
  '# Grounded-growth frontier audit — Review Inbox archival intent v5.2','', 'Status: `TEST`','',
  'v5.1 made residual retirement-publication archival exact and lossless, but its operator assertion and reason existed only in the immediate return value. The exact baseline reproduces that missing durable record: archival succeeds, the active stage disappears into the archive, and no intent or persisted reason exists.','',
  'v5.2 publishes a closed append-only archival intent before new archive linking or active-stage unlink. Its request digest binds the schema, stage filename and digest, assertion, confirmation, and reason; the record also carries artifact target and observed target classification. Complete intent bytes are fsynced in a private same-filesystem stage before exclusive hard-link publication. Conflicting, corrupt, unreadable, self-inconsistent, or over-bound evidence holds.','',
  'Six real process exits cover pre-intent-link and post-intent-link for intent, decision, and result stages. Nine inherited archive exits cover the three archive checkpoints. Reentrant and two real cooperating processes converge. Legacy v1.3 archives and archive-link checkpoints without intent remain authorization-unknown: no retrospective intent is fabricated, and an active legacy checkpoint stage is not unlinked.','',
  'The intent records a request; it does not authenticate its actor, establish consent or permission, prove publisher termination or liveness, or make a false assertion safe. Reasons should contain no secrets. The mechanism does not delete bytes, reclaim space, bound archive retention, provide protected or monotonic storage, offer a hard-link-free fallback, prove power-loss durability or cross-file atomicity, or exclude multi-host, network-filesystem, or external writers.','',
  'All 21 scoped commands pass: eleven focused commands with 1,110 assertions or controls and the ten required AGENTS.md checks. A clean dependency-slice replay passes all focused commands without tracked-byte mutation. The current Review Inbox promotion selftest digest passes and the tools index says READY_FOR_HUMAN_REVIEW; twelve other promotion selftests remain nonpassing. Aggregate test:operations remains FOREIGN_FAILURE at the unchanged absent curated verification intake.','',
  'No browser-facing file changed and no browser render/click test is claimed. No authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or CANON evidence is claimed. Mike Tobi / AXM remains the merge and CANON gate, and the broad grounded-growth objective remains active.',''
].join('\n'));

write('README.md',[
  '# Review Inbox archival intent v5.2 — TEST evidence','',
  'This folder binds product commit `' + product + '` and tree `' + tree + '` to durable exact-request intent before lossless residual retirement-publication stage archival.','',
  '## Exact outcome','',
  '- Exact v5.1 baseline reproduces the missing durable archival authorization record.','- v5.2 publishes an append-only request- and stage-bound intent before new archive mutation.','- Six intent-publication and nine archive process crashes cover all three retirement artifact kinds.','- Reentrant and two real cooperating callers converge on exact intent and archive evidence.','- Legacy archives/checkpoints remain authorization-unknown; no posthoc intent or unsafe checkpoint unlink occurs.','- 21/21 scoped commands pass with 1,110 focused assertions or controls.','- Review Inbox current promotion selftest passes and tools-index says `READY_FOR_HUMAN_REVIEW`; twelve other tool selftests remain nonpassing.','- Clean dependency-slice replay passes without tracked-byte changes.','- Aggregate operations remains `FOREIGN_FAILURE` at the unchanged missing curated verification intake.','',
  '## Read first','',
  '- `FRONTIER_AUDIT.md` — bounded result and truth ceiling.','- `EVIDENCE_ROUTES.json` — claim-specific proof and counterevidence.','- `BASELINE_AUTHORIZATION_GAP.json` — exact v5.1 missing-record reproduction.','- `CHECK_RESULTS.json` — focused plus required checks.','- `PROMOTION_SELFTEST_RECEIPT.json` — current Review Inbox pass plus preserved global nonpasses.','- `CLEAN_PRODUCT_REPLAY.json` — exact clean product-slice replay.','- `AGGREGATE_OPERATIONS_PROBE.json` — preserved foreign aggregate failure.','- `SOURCE_SNAPSHOT.json` — exact product files and digests.','',
  '## Gate and continuity','',
  'The product remains `TEST`. READY_FOR_HUMAN_REVIEW is not promotion or acceptance. Mike Tobi / AXM remains the merge and `CANON` gate. No actor authentication, consent, publisher safety, byte deletion, storage reclamation, browser pass, authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` is claimed. The broad grounded-growth objective remains active.',''
].join('\n'));

write('SESSION_SUMMARY.md',[
  '# Session summary','', '- Product: Review Inbox archival intent v5.2 (`TEST`).','- Exact product: `' + product + '` / tree `' + tree + '`.','- Baseline: v5.1 archival persists neither reason nor durable authorization artifact.','- Current proof: six intent and nine archive process crashes; two real cooperating callers; 21/21 scoped commands; 1,110 focused assertions or controls; clean dependency-slice replay.','- Readiness: current Review Inbox promotion selftest passes and tools-index says READY_FOR_HUMAN_REVIEW; this grants no promotion, merge, or CANON authority.','- Preserved nonpasses: twelve other promotion selftests; aggregate operations FOREIGN_FAILURE at unchanged absent curated intake.','- Open optional gaps: authenticated actor authorization, storage reclamation, live-publisher safety, hard-link-free archival, power-loss durability, and cross-file atomicity.','- Authority: Mike Tobi / AXM remains merge and `CANON` gate; broad goal remains active.',''
].join('\n'));

process.stdout.write('BUILT evidence routes, native receipt, sealed session, curation, audit, README, and summary\n');
