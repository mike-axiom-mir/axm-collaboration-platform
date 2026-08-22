#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const DIR = __dirname;
const product = 'c64dd671c0c4bed1f798a546de879b48c8ac93cc';
const parent = '0ac8c4d6b3aa30636a17955ea67c79dfcff45efa';
const tree = '18eca92357ec1aace6f9b0c0ee6e1a8c5df2c8a8';
const now = new Date().toISOString();
function json(name) { return JSON.parse(fs.readFileSync(path.join(DIR,name),'utf8')); }
function write(name, value) { fs.writeFileSync(path.join(DIR,name), typeof value === 'string' ? value : JSON.stringify(value,null,2) + '\n', 'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function digest(value) { return 'sha256:' + sha256(Core.canonicalJson(value)); }

const checks = json('CHECK_RESULTS.json');
const clean = json('CLEAN_PRODUCT_REPLAY.json');
const aggregate = json('AGGREGATE_OPERATIONS_PROBE.json');
const baseline = json('BASELINE_PUBLICATION_REPRODUCTION.json');
const before = json('FRONTIER_GAP_BEFORE.json');
const after = json('FRONTIER_GAP_AFTER.json');
const source = json('SOURCE_SNAPSHOT.json');
if (checks.status !== 'PASS' || clean.status !== 'PASS' || baseline.status !== 'REPRODUCED' || aggregate.status !== 'FOREIGN_FAILURE') throw new Error('primary evidence is not in the expected exact state');

const native = {
  schema:'axm.native-surface-receipt/v1', status:'PASS', productCommit:product, productTree:tree,
  browserFacingFilesChanged:source.browserFacingFilesChanged,
  liveBrowserRerun:false,
  browserRenderClickTest:'NOT_RUN_NO_BROWSER_FILES_CHANGED',
  hostLocalHardLinkFilesystemExercised:true,
  realChildProcessCrashCases:6,
  truth:{
    perArtifactProcessCrashConsistencyObserved:true,
    intentDecisionResultCoverage:true,
    completeBytesFsyncedBeforePublication:true,
    authoritativePathAllOrAbsentAcrossExercisedProcessCrashes:true,
    hardLinkPublicationNoOverwrite:true,
    sameFilesystemHardLinkRequired:true,
    staleStageReclamationProvided:false,
    hardLinkFreeAtomicFallbackProvided:false,
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
write('NATIVE_SURFACE_RECEIPT.json', native);

const routes = [
  { id:'v49-authoritative-open-crash', kind:'behavioral', claim:'The exact v4.9 product can leave a zero-byte authoritative intent, decision, or result after process exit immediately following exclusive open.', evidence:['BASELINE_PUBLICATION_REPRODUCTION.json'], verdict:'PASS', counterevidence:'This reproduces process termination at one checkpoint, not every write failure or power interruption.' },
  { id:'staged-publication-order', kind:'technical', claim:'The v5.0 publisher writes complete private-stage bytes, fsyncs and closes them, then creates the authoritative name through an exclusive hard link.', evidence:['SOURCE_SNAPSHOT.json','CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'This requires same-filesystem hard-link support and does not prove directory-entry durability after power loss.' },
  { id:'prelink-crash-visibility', kind:'behavioral', claim:'Real child-process exits before publication leave the corresponding authoritative intent, decision, or result absent.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Residual stage files remain and are deliberately not reclaimed automatically.' },
  { id:'postlink-crash-visibility', kind:'behavioral', claim:'Real child-process exits after publication leave complete schema-valid authoritative intent, decision, or result bytes.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'This is one-file process-crash consistency, not a transaction across the retirement sequence.' },
  { id:'exclusive-no-overwrite', kind:'behavioral', claim:'An existing authoritative target wins with EEXIST and its exact bytes are not replaced.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'Noncooperating writers may still mutate files by other means and are not excluded.' },
  { id:'bounded-staging-status', kind:'technical', claim:'A closed bounded host-local status reports residual stages as non-authoritative, holds invalid or over-bound entries, and performs no cleanup.', evidence:['CHECK_RESULTS.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'The status is observational and provides no age inference or stale-stage reclamation.' },
  { id:'inherited-retirement-regression', kind:'regression', claim:'Inherited lease, retirement, recovery, convergence, withdrawal, and decision-process checks remain passing at the new publication boundary.', evidence:['CHECK_RESULTS.json','CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'Focused passing checks do not cover every filesystem or external writer.' },
  { id:'public-authority-boundary', kind:'authorization', claim:'Review Inbox remains TEST and grants no execution, adoption, merge, or CANON authority through publication or status evidence.', evidence:['NATIVE_SURFACE_RECEIPT.json','SOURCE_SNAPSHOT.json'], verdict:'PASS', counterevidence:'No Mike Tobi / AXM acceptance or authenticated human review occurred.' },
  { id:'required-checks', kind:'technical', claim:'All ten exact AGENTS.md commands exit zero on the product worktree.', evidence:['CHECK_RESULTS.json'], verdict:'PASS', counterevidence:'Script checks are not a browser render/click test.' },
  { id:'clean-product-replay', kind:'persistence', claim:'The exact product dependency slice replays ten focused commands with 725 assertions or controls and no tracked-byte changes.', evidence:['CLEAN_PRODUCT_REPLAY.json'], verdict:'PASS', counterevidence:'The replay is a bounded 104-file dependency slice, not every repository file or host substrate.' },
  { id:'aggregate-operations-nonpass', kind:'technical', claim:'Aggregate operations reaches all product checks and then fails at the unchanged missing curated verification intake.', evidence:['AGGREGATE_OPERATIONS_PROBE.json'], verdict:'PASS', counterevidence:'The aggregate command is not claimed as passing and the missing-intake lane remains outside this product diff.' },
  { id:'browser-scope', kind:'visual', claim:'No browser-facing product file changed, so no live browser render/click result is claimed for this host-local seam.', evidence:['SOURCE_SNAPSHOT.json','NATIVE_SURFACE_RECEIPT.json'], verdict:'PASS', counterevidence:'No visual runtime claim is made.' }
];
const routeReceipt = { schema:'axm.evidence-routes/v1', status:'TEST', routes, routesDigest:digest(routes) };
write('EVIDENCE_ROUTES.json', routeReceipt);

const events = [
  ['objective','ACTIVE','Continue grounded Workshop growth without claiming the broad objective complete.',['SESSION_INDEX.json']],
  ['governance','BOUND','Preserve Mike Tobi / AXM as merge and CANON gate; keep Review Inbox TEST.',['NATIVE_SURFACE_RECEIPT.json']],
  ['frontier','BLOCKED','Capability comparison found seven required publication gaps in v4.9.',['FRONTIER_GAP_BEFORE.json']],
  ['baseline','REPRODUCED','Three real v4.9 process exits left zero-byte authoritative artifacts held.',['BASELINE_PUBLICATION_REPRODUCTION.json']],
  ['design','BOUNDED','Selected same-filesystem staged fsync plus exclusive hard-link publication with explicit limits.',['FRONTIER_CAPABILITIES_AFTER.json']],
  ['implementation','TEST','Applied the publication boundary to retirement intent, decision, direct result, and recovered result.',['SOURCE_SNAPSHOT.json']],
  ['status','TEST','Added bounded host-local non-authoritative staging status with no reclamation.',['SOURCE_SNAPSHOT.json']],
  ['compatibility','PASS','Adapted inherited race checkpoints to hard-link publication.',['CHECK_RESULTS.json']],
  ['crash-matrix','PASS','Six child-process exits covered both sides of publication for three artifact kinds.',['CHECK_RESULTS.json']],
  ['contract','TEST','Review Inbox v1.2 declares hard-link, process-crash, API, browser, storage, and authority boundaries.',['SOURCE_SNAPSHOT.json']],
  ['verification','PASS','Ten focused and ten required commands pass with 725 focused assertions or controls.',['CHECK_RESULTS.json']],
  ['product','TEST','Product commit and tree are exact and contain eighteen changed files.',['SOURCE_SNAPSHOT.json']],
  ['replay','PASS','Clean 104-file product slice replay passes without tracked-byte mutation.',['CLEAN_PRODUCT_REPLAY.json']],
  ['aggregate','FOREIGN_FAILURE','Aggregate operations remains nonpassing at the unchanged missing curated verification intake.',['AGGREGATE_OPERATIONS_PROBE.json']],
  ['capability','DEGRADED','Seven bounded required capabilities are ready; four optional broad storage/reclamation gaps remain.',['FRONTIER_GAP_AFTER.json']],
  ['continuity','ACTIVE','Broad grounded-growth objective remains active; no human benefit, learning, promotion, merge, or CANON evidence is invented.',['SESSION_INDEX.json','NATIVE_SURFACE_RECEIPT.json']]
].map((item,index) => ({ schema:'axm.session-semantic-event/v1', sequence:index + 1, recordedAt:now, kind:item[0], status:item[1], statement:item[2], evidence:item[3] }));
const segment = events.map(event => JSON.stringify(event)).join('\n') + '\n';
write('SESSION_SEGMENT.jsonl', segment);
write('SESSION_SEGMENT.seal.json', { schema:'axm.session-segment-seal/v1', status:'PASS', parseStatus:'valid', eventLines:events.length, validJsonLines:events.length, sha256:sha256(segment) });
write('SESSION_INDEX.json', {
  schema:'axm.session-index/v1', status:'TEST', productCommit:product, productTree:tree,
  semanticEvents:events.length, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM',
  specialistPackageIntakeAttempted:false, rawLogsRetained:false
});
write('CURATION_RECEIPT.json', {
  schema:'axm.session-curation-receipt/v1', status:'PASS', curatedAt:now, durableEventsPreserved:events.length,
  retainedRawLogs:false, retainedRawOwnerBytes:false, retainedScreenshots:false, retainedSpecialistPackages:false,
  aggregateOperationsStatus:aggregate.status, broadGoalComplete:false, mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM'
});

const audit = [
  '# Grounded-growth frontier audit — Review Inbox retirement publication v5.0',
  '',
  'Status: `TEST`',
  '',
  'The v4.9 publication helper exclusively opened each authoritative JSON path before writing its first byte. Three child-process reproductions—intent, decision, and result—each left a zero-byte final file and a `HELD` recovery view when the process exited immediately after that open.',
  '',
  'v5.0 moves the publication point. It writes complete JSON to a private sibling stage, fsyncs and closes the stage, then creates the authoritative name with a same-filesystem hard link. The six-case process-crash matrix observes an absent final path before the link and complete schema-valid bytes after it for all three artifact types. Existing final bytes are not overwritten.',
  '',
  'Residual stages are explicitly non-authoritative and visible through a bounded host-local status. They are not deleted or reclaimed automatically. The seam requires hard-link support. It does not establish power-loss durability, directory-entry durability, cross-file atomicity, multi-host or network-filesystem safety, noncooperating-writer exclusion, or a hard-link-free fallback.',
  '',
  'All 20 scoped commands pass: ten focused commands with 725 assertions or controls and the ten required AGENTS.md checks. A clean 104-file product slice replays the ten focused commands with unchanged tracked bytes. Aggregate `npm run test:operations` remains `FOREIGN_FAILURE` after reaching all product checks because `intakes/verification-proof-99-v0.1` is still absent and unchanged by this lane.',
  '',
  'No browser-facing file changed and no browser render/click test is claimed. No real human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` evidence is claimed. Mike Tobi / AXM remains the merge and `CANON` gate, and the broad grounded-growth objective remains active.',
  ''
].join('\n');
write('FRONTIER_AUDIT.md', audit);

const readme = [
  '# Review Inbox retirement artifact publication v5.0 — TEST evidence',
  '',
  'This folder binds the Review Inbox v1.2 product commit `' + product + '` and tree `' + tree + '` to a bounded process-crash-consistent publication seam for retirement intent, decision, and result JSON.',
  '',
  '## Exact outcome',
  '',
  '- v4.9 zero-byte final artifacts are reproduced for all three JSON types.',
  '- v5.0 stages complete fsynced bytes and publishes through an exclusive same-filesystem hard link.',
  '- Six real child-process crashes cover pre-link and post-link visibility for all three types.',
  '- Residual stages are visible, bounded, non-authoritative, and never reclaimed automatically.',
  '- 20/20 scoped commands pass with 725 focused assertions or controls.',
  '- Clean replay passes for the exact 104-file dependency slice without tracked-byte changes.',
  '- Aggregate operations is honestly retained as `FOREIGN_FAILURE` at the unchanged missing curated verification intake.',
  '',
  '## Read first',
  '',
  '- `FRONTIER_AUDIT.md` — bounded result and truth ceiling.',
  '- `EVIDENCE_ROUTES.json` — claim-specific proof and counterevidence.',
  '- `BASELINE_PUBLICATION_REPRODUCTION.json` — exact v4.9 failure reproduction.',
  '- `CHECK_RESULTS.json` — focused plus required checks.',
  '- `CLEAN_PRODUCT_REPLAY.json` — exact clean product-slice replay.',
  '- `AGGREGATE_OPERATIONS_PROBE.json` — preserved foreign aggregate failure.',
  '- `SOURCE_SNAPSHOT.json` — exact product files and digests.',
  '',
  '## Gate and continuity',
  '',
  'The product remains `TEST`. Mike Tobi / AXM remains the merge and `CANON` gate. No browser render/click pass, authenticated human review, human benefit, provider execution, learning, adoption, promotion, merge, Foundation mutation, or `CANON` is claimed. The broad grounded-growth objective remains active.',
  ''
].join('\n');
write('README.md', readme);

const summary = [
  '# Session summary',
  '',
  '- Product: Review Inbox retirement artifact publication v5.0 (`TEST`).',
  '- Exact product: `' + product + '` / tree `' + tree + '`.',
  '- Baseline: three v4.9 zero-byte authoritative artifacts reproduced.',
  '- Current proof: six real child-process crashes; 20/20 scoped commands; 725 focused assertions or controls; clean 104-file replay.',
  '- Preserved nonpass: aggregate operations `FOREIGN_FAILURE` at unchanged absent curated intake.',
  '- Open optional gaps: power-loss durability, cross-file atomicity, stale-stage reclamation, hard-link-free fallback.',
  '- Authority: Mike Tobi / AXM remains merge and `CANON` gate; broad goal remains active.',
  ''
].join('\n');
write('SESSION_SUMMARY.md', summary);
process.stdout.write('BUILT evidence routes, native receipt, sealed session, curation, audit, and README\n');
