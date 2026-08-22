#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function write(name,value) { fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2) + '\n','utf8'); }
const replay = JSON.parse(fs.readFileSync(path.join(__dirname,'CLEAN_EVIDENCE_REPLAY.json'),'utf8'));
if (replay.status !== 'PASS') throw new Error('clean evidence replay did not pass');
const productCommit = 'fa6f8fd94145ad58c6388bb64b62e5d75c19a46e';
const events = [
  { schema:'axm.steward-session-event/v1', sequence:19, type:'CLEAN_EVIDENCE_REPLAY', status:'PASS', summary:'Primary evidence selftest and 18-event seal passed from an exact archived evidence slice.', productCommit },
  { schema:'axm.steward-session-event/v1', sequence:20, type:'HANDOFF', status:'TEST', summary:'Reviewable branch is ready for Mike Tobi / AXM; broad grounded-growth objective remains active.', productCommit }
];
const segment = events.map(item => JSON.stringify(item)).join('\n') + '\n';
fs.writeFileSync(path.join(__dirname,'SESSION_SEGMENT_ADDENDUM.jsonl'),segment,'utf8');
write('SESSION_SEGMENT_ADDENDUM.seal.json',{ schema:'axm.session-segment-seal/v1', status:'PASS', source:'SESSION_SEGMENT_ADDENDUM.jsonl', eventLines:2, validJsonLines:2, parseStatus:'valid', sha256:sha256(segment) });
write('FINAL_EVIDENCE_INDEX.json',{
  schema:'axm.final-evidence-index/v1', status:'TEST',
  productCommit, productTree:'4527ff55d6270fdea33894fc9d4ff2126aad5f2a',
  primaryEvidenceCommit:replay.evidenceCommit, primaryEvidenceTree:replay.evidenceTree,
  primarySelftestChecks:137, cleanEvidenceReplayStatus:replay.status, cleanEvidenceReplayTrackedFiles:replay.trackedFiles,
  sessionSegments:['SESSION_SEGMENT.jsonl','SESSION_SEGMENT_ADDENDUM.jsonl'], totalSemanticEvents:20,
  mergeGate:'Mike Tobi / AXM', canonGate:'Mike Tobi / AXM', broadGoalComplete:false,
  installed:false, promoted:false, excludedPackageLaneInspected:false
});
console.log('FINAL ADDENDUM 2 events · 20 total semantic events');
