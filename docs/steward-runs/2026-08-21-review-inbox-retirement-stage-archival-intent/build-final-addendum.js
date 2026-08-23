#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function write(name,value) { fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2) + '\n','utf8'); }
const replay = JSON.parse(fs.readFileSync(path.join(__dirname,'CLEAN_EVIDENCE_REPLAY.json'),'utf8'));
if (replay.status !== 'PASS') throw new Error('clean evidence replay did not pass');
const productCommit = 'b707aa08f0adf958f6344babf0839c37ab1b9dca';
const events = [
  { schema:'axm.steward-session-event/v1', sequence:21, type:'CLEAN_EVIDENCE_REPLAY', status:'PASS', summary:'Primary 166-check evidence selftest and twenty-event seal passed from the exact archived evidence slice.', productCommit },
  { schema:'axm.steward-session-event/v1', sequence:22, type:'HANDOFF', status:'TEST', summary:'Reviewable branch is ready for Mike Tobi / AXM inspection; Review Inbox is ready for human review but not promoted, and the broad grounded-growth objective remains active.', productCommit }
];
const segment = events.map(item => JSON.stringify(item)).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname,'SESSION_SEGMENT_ADDENDUM.jsonl'),segment,'utf8');
write('SESSION_SEGMENT_ADDENDUM.seal.json',{ schema:'axm.session-segment-seal/v1', status:'PASS', source:'SESSION_SEGMENT_ADDENDUM.jsonl', eventLines:2, validJsonLines:2, parseStatus:'valid', sha256:sha256(segment) });
write('FINAL_EVIDENCE_INDEX.json',{
  schema:'axm.final-evidence-index/v1', status:'TEST',
  productCommit, productTree:'0f2aa8e9e2fad6e19416c93667cf426899955eed',
  primaryEvidenceCommit:replay.evidenceCommit, primaryEvidenceTree:replay.evidenceTree,
  primarySelftestChecks:166, cleanEvidenceReplayStatus:replay.status, cleanEvidenceReplayTrackedFiles:replay.trackedFiles,
  sessionSegments:['SESSION_SEGMENT.jsonl','SESSION_SEGMENT_ADDENDUM.jsonl'], totalSemanticEvents:22,
  branch:'codex/grounded-growth-retirement-stage-archival-intent-v5.2', mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM', broadGoalComplete:false,
  installed:false, promoted:false, readyForHumanReview:true, reviewInboxPromotionSelftest:'PASS', otherPromotionSelftestsNotPass:12,
  aggregateOperationsStatus:'FOREIGN_FAILURE', excludedPackageLaneInspected:false
});
process.stdout.write('FINAL ADDENDUM 2 events · 22 total semantic events\n');
