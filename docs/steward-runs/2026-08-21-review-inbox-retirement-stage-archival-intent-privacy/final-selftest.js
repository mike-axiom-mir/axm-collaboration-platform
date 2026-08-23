#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
let assertions = 0;
function equal(actual,expected,label) { assert.deepStrictEqual(actual,expected,label); assertions += 1; }
function check(value,label) { assert(value,label); assertions += 1; }
function json(name) { return JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8')); }
function read(name) { return fs.readFileSync(path.join(__dirname,name),'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

const primary = childProcess.spawnSync(process.execPath,[path.join(__dirname,'selftest.js')],{ cwd:path.resolve(__dirname,'../../..'),encoding:'utf8',windowsHide:true,maxBuffer:32 * 1024 * 1024 });
equal(primary.status,0,'primary evidence selftest still passes');
check(String(primary.stdout || '').includes('125 assertions'),'primary evidence selftest retains 125 assertions');
const replay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(replay.status,'PASS','clean evidence replay passes');
equal(replay.evidenceCommit,'d7deff9d5ae3eb7d5cd34f76390d0c9b6312c4a2','replay binds primary evidence commit');
equal(replay.evidenceTree,'7bb0623199fc51947ae9bbecb10b648c1805bbb2','replay binds primary evidence tree');
equal(replay.trackedFiles,36,'replay archives thirty-six tracked evidence dependency files');
equal(replay.selftest.verdict,'PASS','archived primary selftest passes');
check(replay.selftest.stdout.includes('125 assertions'),'archived selftest output is exact enough to bind assertion count');
equal(replay.sealReplay,{ verdict:'PASS',sha256Matches:true,eventLines:20,validJsonLines:20 },'archived session seal replay passes');
equal(replay.sourceCheckoutOrSharedMainMutated,false,'evidence replay mutates no source checkout or shared main');
equal(replay.temporaryReplayPathRetained,false,'evidence replay retains no temp path');
equal(replay.excludedPackageLaneInspected,false,'evidence replay avoids excluded package lane');
const replayBody = JSON.parse(JSON.stringify(replay));
delete replayBody.replayDigest;
equal(replay.replayDigest,'sha256:' + sha256(JSON.stringify(replayBody)),'evidence replay digest matches');

const addendum = read('SESSION_SEGMENT_ADDENDUM.jsonl'), seal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
const events = addendum.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence),[21,22],'addendum continues session sequence');
equal(seal.eventLines,2,'addendum seal records two events');
equal(seal.validJsonLines,2,'both addendum lines are valid');
equal(seal.sha256,sha256(addendum),'addendum seal digest matches');
const index = json('FINAL_EVIDENCE_INDEX.json');
equal(index.status,'TEST','final evidence remains TEST');
equal(index.productCommit,'04294776eefdbb8a31604bf2be2725708bc6d3e0','final index binds product commit');
equal(index.productTree,'2722e79a578711819bbd492aa329e591d53c2bcb','final index binds product tree');
equal(index.primaryEvidenceCommit,replay.evidenceCommit,'final index binds replayed evidence commit');
equal(index.cleanEvidenceReplayStatus,'PASS','final index records clean evidence replay');
equal(index.cleanEvidenceReplayTrackedFiles,replay.trackedFiles,'final index records exact replay file count');
equal(index.totalSemanticEvents,22,'final index records twenty-two semantic events');
equal(index.branch,'codex/grounded-growth-retirement-stage-archival-intent-privacy-v5.3','final index binds review branch');
equal(index.mergeGate,'Mike Tobi / AXM','final index preserves merge gate');
equal(index.canonGate,'Mike Tobi / AXM','final index preserves CANON gate');
equal(index.broadGoalComplete,false,'final index leaves broad objective active');
equal(index.installed,false,'final index records no installation');
equal(index.promoted,false,'final index records no promotion');
equal(index.readyForHumanReview,true,'final index records bounded human-review readiness');
equal(index.reviewInboxPromotionSelftest,'PASS','final index records current Review Inbox promotion selftest');
equal(index.otherPromotionSelftestsNotPass,12,'final index preserves twelve other promotion nonpasses');
equal(index.aggregateOperationsStatus,'FOREIGN_FAILURE','final index preserves aggregate nonpass');
equal(index.excludedPackageLaneInspected,false,'final index records untouched excluded package lane');
console.log('PASS final archival-intent reason privacy v5.3 evidence: ' + assertions + ' checks');
