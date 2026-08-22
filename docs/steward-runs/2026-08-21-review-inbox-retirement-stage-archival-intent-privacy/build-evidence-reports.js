#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const DIR = __dirname;
const product = '04294776eefdbb8a31604bf2be2725708bc6d3e0';
const parent = 'f5c4029959a0ca4f82d52c04e00f033b223fbb43';
const tree = '2722e79a578711819bbd492aa329e591d53c2bcb';
const now = new Date().toISOString();
function json(name) { return JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8')); }
function write(name,value) { fs.writeFileSync(path.join(DIR,name),typeof value === 'string' ? value : JSON.stringify(value,null,2) + '\n','utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digest(value) { return 'sha256:' + sha256(Core.canonicalJson(value)); }

const checks = json('CHECK_RESULTS.json');
const clean = json('CLEAN_PRODUCT_REPLAY.json');
const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
const baseline = json('BASELINE_REASON_PRIVACY_GAP.json');
const before = json('FRONTIER_GAP_BEFORE.json');
const after = json('FRONTIER_GAP_AFTER.json');
const source = json('SOURCE_SNAPSHOT.json');
const promotion = json('PROMOTION_SELFTEST_RECEIPT.json');
if (checks.status !== 'PASS' || clean.status !== 'PASS' || aggregate.status !== 'FOREIGN_FAILURE' || baseline.status !== 'REPRODUCED' ||
  before.overall !== 'BLOCKED' || after.overall !== 'DEGRADED' || !promotion.truth.reviewInboxSelftestCurrentAndPassing) {
  throw new Error('primary evidence is not in the expected exact state');
}

const native = {
  schema:'axm.native-surface-receipt/v1', status:'PASS', productCommit:product, productTree:tree,
  browserFacingFilesChanged:source.browserFacingFilesChanged, liveBrowserRerun:false,
  browserRenderClickTest:'NOT_RUN_HOST_LOCAL_NO_BROWSER_ROUTE', hostLocalHardLinkFilesystemExercised:true,
  intentPublicationRealChildProcessCrashMatrixCases:6, archivalRealChildProcessCrashMatrixCases:9,
  realCooperatingArchivalProcesses:2, promotionSelftestCurrentAndPassing:true,
  toolsIndexReviewInboxState:'READY_FOR_HUMAN_REVIEW',
  truth:{
    exactV52RawReasonPersistenceReproduced:true,
    exactRawReasonAbsentFromNewV2IntentObserved:true,
    exactRawReasonAbsentFromV3RuntimeAndCliJsonObserved:true,
    exactRawReasonDigestCommitmentObserved:true,
    recognizedCredentialValueExcludedFromNewIntentResultAndCliJsonObserved:true,
    machinePathExcludedFromNewIntentResultAndCliJsonObserved:true,
    unchangedReasonWithheldMarkerObserved:true,
    legacyV1RawReasonIntentTypedAndRetryable:true,
    legacyV1IntentRewrittenOrDeleted:false,
    corruptedReasonDigestAndSummaryHeld:true,
    existingIntentAndArchiveConvergenceObserved:true,
    arbitraryOrEncodedSecretAbsenceProven:false,
    commandLineArgumentOrShellHistorySanitized:false,
    callerAssertionAuthenticated:false,
    publisherTerminatedOrAbandonedProven:false,
    livePublisherSafetyProven:false,
    protectedOrMonotonicStorageProven:false,
    storageSpaceReclaimed:false,
    hardLinkFreeArchiveFallbackProvided:false,
    powerLossDurabilityProven:false,
    crossFileAtomicityProven:false,
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
  { id:'v52-reason-privacy-gap', kind:'behavioral', claim:'The exact v5.2 product persists and returns the synthetic raw reason, recognized credential value, and machine path.', evidence:['BASELINE_REASON_PRIVACY_GAP.json'], verdict:'PASS', counterevidence:'The fixture is synthetic and proves only exact v5.2 local behavior.' },
  { id:'exact-reason-digest-commitment', kind:'persistence', claim:'v2 intent and v3 result carry a SHA-256 commitment to the exact raw reason bytes while omitting the exact raw value.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'The digest does not authenticate an actor and may permit guessing of low-entropy reasons.' },
  { id:'recognized-credential-and-path-minimization', kind:'privacy', claim:'Synthetic labeled credential and machine-path values are absent from new intent bytes, runtime result, and CLI JSON; explicit redaction markers remain.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json','NATIVE_SURFACE_RECEIPT.json'], verdict:'PASS', counterevidence:'Arbitrary, encoded, or novel secret absence is not proven.' },
  { id:'unchanged-reason-withholding', kind:'privacy', claim:'When the shared redactor would leave a reason unchanged, v2/v3 use a fixed withheld marker instead of persisting or returning the exact raw reason.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Recognized-pattern summaries may retain non-sensitive context and are not a general content-classification proof.' },
  { id:'cli-boundary', kind:'transport', claim:'Emitted CLI JSON omits the exact raw reason and synthetic credential/path values.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'CLI arguments, process inspection, terminal software, and shell history are outside this claim.' },
  { id:'legacy-v1-compatibility', kind:'persistence', claim:'An exact v1 raw-reason intent is typed LEGACY_AUTHORIZED_RAW_REASON, remains retryable, and is not rewritten or deleted.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'The legacy file continues to retain its raw reason; no migration or erasure is claimed.' },
  { id:'corruption-holds', kind:'behavioral', claim:'Self-inconsistent reason digest and non-idempotent reason summary evidence hold before archive mutation.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Local evidence is not protected against a writer that can coherently fabricate every field.' },
  { id:'schema-continuity', kind:'technical', claim:'Historical intent/v1, authorization-status/v1, and result/v2 files remain outside the product diff; new semantics use explicit intent/v2, status/v2, and result/v3 files.', evidence:['SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'Additive schemas do not prove every external consumer has migrated.' },
  { id:'crash-and-caller-convergence', kind:'persistence', claim:'Six intent-publication and nine archive crash-matrix cases plus reentrant and two-process callers preserve exact convergence.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json','NATIVE_SURFACE_RECEIPT.json'], verdict:'PASS', counterevidence:'Process exit is not a power-interruption test and the mechanism remains cooperating single-host only.' },
  { id:'host-local-boundary', kind:'authorization', claim:'Intent status and archival remain host-local runtime/CLI surfaces with no API or browser route.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'Host-locality is not actor authentication, consent, or live-publisher safety.' },
  { id:'required-checks', kind:'technical', claim:'All ten exact AGENTS.md commands and twelve focused commands exit zero.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Script checks are separate from browser render/click evidence.' },
  { id:'clean-product-replay', kind:'persistence', claim:'The exact product dependency slice replays twelve focused commands with 1,230 assertions or controls and no tracked-byte changes.', evidence:['CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'The replay is a bounded dependency slice, not every repository file or host substrate.' },
  { id:'promotion-selftest', kind:'technical', claim:'The current Review Inbox selftest digest passes and tools-index reports READY_FOR_HUMAN_REVIEW.', evidence:['PROMOTION_SELFTEST_RECEIPT.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'Twelve other promotion selftests remain nonpassing; readiness grants no promotion, merge, or CANON authority.' },
  { id:'aggregate-operations-nonpass', kind:'technical', claim:'Aggregate operations reaches the product checks and then fails in the unchanged missing curated verification intake lane.', evidence:['AGGREGATE_OPERATIONS_PROBE.json'], verdict:'PASS', counterevidence:'The aggregate command is not claimed as passing and the package-intake lane remains outside this diff.' },
  { id:'visual-and-human-gate', kind:'visual', claim:'No browser-facing product file or route changed; Review Inbox remains TEST and Mike Tobi / AXM remains merge and CANON gate.', evidence:['SOURCE_SNAPSHOT.json','NATIVE_SURFACE_RECEIPT.json'], verdict:'PASS', counterevidence:'No browser render/click, authenticated human review, human benefit, merge, or CANON decision occurred.' }
];
write('EVIDENCE_ROUTES.json',{ schema:'axm.evidence-routes/v1', status:'TEST', routes, routesDigest:digest(routes) });

const events = [
  ['objective','ACTIVE','Continue grounded Workshop growth without claiming the broad objective complete.',['SESSION_INDEX.json']],
  ['governance','BOUND','Preserve Mike Tobi / AXM as merge and CANON gate; keep Review Inbox TEST.',['NATIVE_SURFACE_RECEIPT.json']],
  ['frontier','BLOCKED','Capability comparison found eight required archival-reason privacy gaps in v5.2.',['FRONTIER_GAP_BEFORE.json']],
  ['baseline','REPRODUCED','Exact v5.2 state and JSON output retain a synthetic raw reason, credential value, and machine path.',['BASELINE_REASON_PRIVACY_GAP.json']],
  ['design','BOUNDED','Selected additive reason digest, redaction-or-withholding, typed v1 compatibility, and no migration.',['FRONTIER_CAPABILITIES_AFTER.json']],
  ['implementation','TEST','Added intent/v2, authorization-status/v2, result/v3, and Review Inbox v1.5 contracts.',['SOURCE_SNAPSHOT.json']],
  ['privacy','PASS','New intent bytes and emitted JSON exclude the exact raw reason and synthetic credential/path values.',['CHECK_RESULTS.json']],
  ['withholding','PASS','Unchanged free-form reasons become a fixed withheld marker.',['CHECK_RESULTS.json']],
  ['legacy','TEST','v1 raw-reason intent stays exact, retryable, visibly legacy, and unchanged.',['CHECK_RESULTS.json']],
  ['corruption','HELD','Reason-digest and non-idempotent-summary corruption cannot authorize archival.',['CHECK_RESULTS.json']],
  ['convergence','PASS','Existing intent/archive crash matrices and caller convergence remain passing.',['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json']],
  ['truth-ceiling','BOUND','No arbitrary-secret absence, CLI history sanitation, actor authentication, safety, durability, or storage claims.',['NATIVE_SURFACE_RECEIPT.json']],
  ['verification','PASS','Twelve focused and ten required commands pass with 1,230 focused assertions or controls.',['CHECK_RESULTS.json']],
  ['promotion-selftest','MIXED','Review Inbox current selftest passes while twelve other promotion selftests remain nonpassing.',['PROMOTION_SELFTEST_RECEIPT.json']],
  ['readiness','READY_FOR_HUMAN_REVIEW','Tools index reports Review Inbox ready for human review; this is not promotion or acceptance.',['PROMOTION_SELFTEST_RECEIPT.json']],
  ['product','TEST','Product commit and tree are exact and contain twelve changed files.',['SOURCE_SNAPSHOT.json']],
  ['replay','PASS','Clean product dependency-slice replay passes without tracked-byte mutation.',['CLEAN_PRODUCT_REPLAY.json']],
  ['aggregate','FOREIGN_FAILURE','Aggregate operations remains nonpassing at the unchanged missing curated verification intake.',['AGGREGATE_OPERATIONS_PROBE.json']],
  ['capability','DEGRADED','Ten bounded required capabilities are ready; seven optional privacy, safety, durability, authorization, portability, and storage gaps remain.',['FRONTIER_GAP_AFTER.json']],
  ['continuity','ACTIVE','Broad objective remains active; no human benefit, learning, provider execution, promotion, merge, or CANON evidence is invented.',['SESSION_INDEX.json','NATIVE_SURFACE_RECEIPT.json']]
].map((item,index) => ({ schema:'axm.session-semantic-event/v1', sequence:index + 1, recordedAt:now, kind:item[0], status:item[1], statement:item[2], evidence:item[3] }));
const segment = events.map(event => JSON.stringify(event)).join('\n') + '\n';
write('SESSION_SEGMENT.jsonl',segment);
write('SESSION_SEGMENT.seal.json',{ schema:'axm.session-segment-seal/v1', status:'PASS', parseStatus:'valid', eventLines:events.length, validJsonLines:events.length, sha256:sha256(segment) });
write('SESSION_INDEX.json',{ schema:'axm.session-index/v1', status:'TEST', productCommit:product, productTree:tree, semanticEvents:events.length, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM', specialistPackageIntakeAttempted:false, rawLogsRetained:false });
write('CURATION_RECEIPT.json',{ schema:'axm.session-curation-receipt/v1', status:'PASS', curatedAt:now, durableEventsPreserved:events.length, retainedRawLogs:false, retainedFailureTails:false, retainedRawFixtureReasons:false, retainedRawCliOutput:false, retainedRawStageBytes:false, retainedScreenshots:false, retainedSpecialistPackages:false, aggregateOperationsStatus:aggregate.status, promotionSelftestStatus:promotion.status, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM' });

write('FRONTIER_AUDIT.md',[
  '# Grounded-growth frontier audit — Review Inbox archival-intent reason privacy v5.3','', 'Status: `TEST`','',
  'The exact v5.2 replay shows that its v1 intent, v2 result, and host-local CLI JSON retain a synthetic raw reason, labeled credential value, and machine path. No raw fixture state or CLI output was retained in evidence; the receipt records only typed observations and digests.','',
  'v5.3 publishes a v2 intent with a SHA-256 commitment to the exact raw reason. New durable intent and v3 result objects omit the raw reason. Recognized credential/path patterns produce a bounded diagnostic-redaction summary; input unchanged by that policy produces a fixed withheld marker. Exact retry recomputes the reason digest and summary. Corrupt digest or non-idempotent summary evidence holds before archive mutation.','',
  'Existing v1 raw-reason intents remain exact-readable and retryable. Authorization status types them as `LEGACY_AUTHORIZED_RAW_REASON`, reports exact raw-reason persistence, and never rewrites or deletes the file. Historical intent/v1, status/v1, and result/v2 schema files remain unchanged; new semantics use explicit v2/v2/v3 files.','',
  'The redactor covers labeled credentials, recognizable token fingerprints, private-key blocks, configured roots, and residual absolute paths. It does not prove absence of arbitrary, encoded, or novel secrets. CLI arguments, process inspection, terminal software, and shell history are outside the emitted-JSON claim. A reason digest is neither actor authentication nor protected storage.','',
  'All 22 scoped commands pass: twelve focused commands with 1,230 assertions or controls and the ten required AGENTS.md checks. A clean dependency-slice replay passes all focused commands without tracked-byte mutation. The current Review Inbox promotion selftest digest passes and tools-index says READY_FOR_HUMAN_REVIEW; twelve other promotion selftests remain nonpassing. Aggregate test:operations remains FOREIGN_FAILURE at the unchanged absent curated verification intake.','',
  'No browser-facing file changed and no browser render/click test is claimed. No authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or CANON evidence is claimed. Mike Tobi / AXM remains the merge and CANON gate, and the broad grounded-growth objective remains active.',''
].join('\n'));

write('README.md',[
  '# Review Inbox archival-intent reason privacy v5.3 — TEST evidence','',
  'This folder binds product commit `' + product + '` and tree `' + tree + '` to privacy-minimized exact-request intent before lossless residual retirement-publication stage archival.','',
  '## Exact outcome','',
  '- Exact v5.2 baseline reproduces raw reason, recognized credential, and machine-path retention.','- v5.3 commits to exact raw reason bytes while omitting the exact raw value from new intent and emitted result/CLI JSON.','- Recognized credential/path patterns are redacted; otherwise a fixed withheld marker is used.','- Legacy v1 raw-reason intent remains typed, retryable, and unchanged.','- Digest and redaction-summary corruption holds.','- Existing six intent and nine archive crash-matrix cases plus caller convergence remain passing.','- 22/22 scoped commands pass with 1,230 focused assertions or controls.','- Review Inbox current promotion selftest passes and tools-index says `READY_FOR_HUMAN_REVIEW`; twelve other tool selftests remain nonpassing.','- Clean dependency-slice replay passes without tracked-byte changes.','- Aggregate operations remains `FOREIGN_FAILURE` at the unchanged missing curated verification intake.','',
  '## Read first','',
  '- `FRONTIER_AUDIT.md` — bounded result and truth ceiling.','- `EVIDENCE_ROUTES.json` — claim-specific proof and counterevidence.','- `BASELINE_REASON_PRIVACY_GAP.json` — exact v5.2 reproduction.','- `CHECK_RESULTS.json` — focused plus required checks.','- `PROMOTION_SELFTEST_RECEIPT.json` — current Review Inbox pass plus preserved global nonpasses.','- `CLEAN_PRODUCT_REPLAY.json` — exact clean product-slice replay.','- `AGGREGATE_OPERATIONS_PROBE.json` — preserved foreign aggregate failure.','- `SOURCE_SNAPSHOT.json` — exact product files and digests.','',
  '## Gate and continuity','',
  'The product remains `TEST`. READY_FOR_HUMAN_REVIEW is not promotion or acceptance. Mike Tobi / AXM remains the merge and `CANON` gate. No arbitrary-secret absence, shell-history sanitation, actor authentication, consent, publisher safety, byte deletion, storage reclamation, browser pass, authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` is claimed. The broad grounded-growth objective remains active.',''
].join('\n'));

write('SESSION_SUMMARY.md',[
  '# Session summary','', '- Product: Review Inbox archival-intent reason privacy v5.3 (`TEST`).','- Exact product: `' + product + '` / tree `' + tree + '`.','- Baseline: v5.2 persists and emits the synthetic raw reason, credential value, and machine path.','- Current proof: exact reason digest; new raw-value omission; credential/path redaction; safe-reason withholding; v1 compatibility without rewrite; corruption holds; 22/22 scoped commands; 1,230 focused assertions or controls; clean dependency-slice replay.','- Readiness: current Review Inbox promotion selftest passes and tools-index says READY_FOR_HUMAN_REVIEW; this grants no promotion, merge, or CANON authority.','- Preserved nonpasses: twelve other promotion selftests; aggregate operations FOREIGN_FAILURE at unchanged absent curated intake.','- Open optional gaps: arbitrary/encoded secret absence, authenticated actor authorization, storage reclamation, live-publisher safety, hard-link-free archival, power-loss durability, and cross-file atomicity.','- Authority: Mike Tobi / AXM remains merge and `CANON` gate; broad goal remains active.',''
].join('\n'));

process.stdout.write('BUILT evidence routes, native receipt, sealed session, curation, audit, README, and summary\n');
