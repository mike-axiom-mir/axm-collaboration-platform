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
if (seal.parseStatus !== 'valid' || seal.invalidJsonLines !== 0 || addendumSeal.parseStatus !== 'valid' || addendumSeal.invalidJsonLines !== 0) throw new Error('session seal is invalid');
if (results.status !== 'PASS' || visual.status !== 'PASS') throw new Error('verification or visual evidence is not PASS');
const openEvidence = [
  'actual host policy installation and live signed submission or vote',
  'named real-world identity or authenticated Mike Tobi or AXM steward',
  'actual human participation or informed human review',
  'independent controller proof across declared principal digests',
  'externally trusted time',
  'atomic review and authentication persistence',
  'protected monotonic storage rollback prevention or external custody',
  'authenticated reconciliation and divergence resolution',
  'provider execution or evaluation',
  'human benefit or learning proof',
  'execution adoption permission installation promotion merge Foundation mutation or CANON decision',
  'independent Draft 2020-12 schema meta-validation',
  'assistive-technology compatibility or human usability study'
];
const receipt = {
  schema:'axm.session-curation-receipt/v1', status:'TEST', sessionId:'2026-08-21-review-inbox-host-key-authority-path-v4.1',
  sealedSegment:'SESSION_SEGMENT.jsonl', sealDigest:'sha256:' + seal.sha256,
  continuationSegments:[{ segment:'SESSION_SEGMENT_ADDENDUM.jsonl', seal:'SESSION_SEGMENT_ADDENDUM.seal.json', sealDigest:'sha256:' + addendumSeal.sha256, durableEventsPreserved:addendumSeal.eventLines }],
  durableEventsPreserved:seal.eventLines + addendumSeal.eventLines,
  telemetryAggregation:{ retainedRawLogs:false, commandOutcomes:results.summary.commands, passedCommands:results.summary.passed, failedCommands:results.summary.failed, focusedAssertions:results.summary.focusedAssertions, exploratoryFailuresPreservedAsSemanticEvents:2, postSealDiagnosticsPreservedAsSemanticEvents:5, unchangedProgressPollsRetained:false, rawBrowserTelemetryRetained:false },
  temporaryMaterialDeleted:{ classification:'TEMPORARY_CAPTURE_SYNTHETIC_TEST_STATE_EPHEMERAL_KEYS_AND_FAILED_REPLAY_WORKTREE', inMemoryScreenshotBuffersCleared:7, selectedScreenshotDigestsRetained:7, screenshotsRetained:false, temporaryV40VisualHarnessRootsRemoved:1, failedDetachedWorktreeRootsRemoved:1, failedDetachedWorktreeRootAlreadyAbsent:1, browserTabsClosed:1, viewportOverridesReset:1, harnessServersStopped:2, focusedSelftestRoots:'each focused harness self-verifies bounded cleanup; aggregate count was not retained', generatedPrivateTestKeysRetained:false },
  detachedReplay:{ commit:'8ce0e4fd8b59dd58572fc453466cee4ceaf40ba2', tree:'790e8727430dc9a82d38143c66110fc89897966e', recordedCommandsPassed:61, evidenceChecksPassed:45, cleanAfterReplay:true, branchReattachedClean:true },
  explicitRetentionExceptions:[], derivedViewsUpdated:['SESSION_SUMMARY.md','SESSION_INDEX.json','CAPABILITY_GAP_AFTER.json','CHECK_RESULTS.json','VISUAL_RECEIPT.json'], unclassifiedItems:[],
  authorityUsed:'Delegated stewardship on an isolated codex branch. No shared-main mutation specialist ZIP intake foreign-worktree edit global tools-index edit real trust-policy install live signed review authenticated real-world identity actual human review reconciliation provider action consequential decision execution adoption install promotion merge Foundation mutation or CANON authority used.'
};
const index = {
  schema:'axm.session-index/v1', status:'TEST', sessionId:receipt.sessionId, summary:'SESSION_SUMMARY.md', segment:receipt.sealedSegment, seal:'SESSION_SEGMENT.seal.json', continuationSegments:receipt.continuationSegments, curationReceipt:'CURATION_RECEIPT.json', sourceSnapshot:'SOURCE_SNAPSHOT.json', checkResults:'CHECK_RESULTS.json', visualReceipt:'VISUAL_RECEIPT.json', capabilityBefore:'CAPABILITY_GAP_BEFORE.json', capabilityAfter:'CAPABILITY_GAP_AFTER.json', evidenceRoutes:'EVIDENCE_ROUTES.json', openEvidence
};
const summary = `# Review Inbox host-key authority path v4.1 session summary\n\nStatus: \`TEST\` · merge and \`CANON\` gate: Mike Tobi / AXM\n\nThe bounded advance adds a separate host-configured Ed25519 key-possession authority view to Review Inbox. Signed submissions bind exact normalized candidates; signed votes bind exact current item routes, artifact digests, verdicts, notes, and explanation flags. Current signed submission evidence is required before a signed vote can mutate the ordinary review record. Replay, policy mismatch, policy expiry, principal duplication, submitter/reviewer collision, storage corruption, item drift, and signature tamper hold authority closed.\n\nLegacy attributed votes remain compatible but count as zero authenticated seats. The UI separately displays legacy \`APPROVED · AUTHORITY HELD\` and \`APPROVED · HOST KEY\`. No consumer applies the new authority result.\n\nVerification recorded ${results.summary.commands}/${results.summary.commands} passing commands and ${results.summary.focusedAssertions} focused assertions, including all ten AGENTS checks. The source snapshot binds ${read('SOURCE_SNAPSHOT.json').sources.length} normalized inputs. Live read-only browser checks retain seven frame commitments and no screenshot bytes. Commit \`8ce0e4fd\` then passed all recorded commands and the evidence selftest from detached HEAD with a clean tree; the append-only continuation preserves two failed separate-worktree checkout attempts and their exact cleanup.\n\nOpen seams remain: real policy installation and signed review, named identity, actual human participation, independent controllers, trusted time, atomic and protected persistence, external custody, reconciliation, consequential authority, benefit, learning, independent schema meta-validation, assistive technology, and usability. Passing tests do not make this branch \`CANON\`.\n`;
fs.writeFileSync(path.join(dir, 'CURATION_RECEIPT.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(dir, 'SESSION_INDEX.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');
fs.writeFileSync(path.join(dir, 'SESSION_SUMMARY.md'), summary, 'utf8');
console.log('PASS wrote curation receipt, session index, and semantic summary');
