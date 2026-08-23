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

const primary = childProcess.spawnSync(process.execPath,[path.join(__dirname,'selftest.js')],{ cwd:path.resolve(__dirname,'../../..'), encoding:'utf8', windowsHide:true, maxBuffer:32 * 1024 * 1024 });
equal(primary.status,0,'primary evidence selftest still passes');
check(String(primary.stdout || '').includes('140 checks'),'primary evidence selftest retains 140 checks');
const replay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(replay.status,'PASS','clean evidence replay passes');
equal(replay.evidenceCommit,'93cef72775400640b613db3ac047871c669f2d01','replay binds primary evidence commit');
equal(replay.evidenceTree,'c7f45b3a35b6578dd90a96881800ca10d315d07d','replay binds primary evidence tree');
equal(replay.trackedFiles,30,'replay archives thirty tracked evidence dependency files');
equal(replay.selftest.verdict,'PASS','archived primary selftest passes');
equal(replay.selftest.stdout,'PASS Review Inbox retirement artifact publication v5.0 evidence: 140 checks','archived selftest output is exact');
equal(replay.sealReplay,{ verdict:'PASS', sha256Matches:true, eventLines:16, validJsonLines:16 },'archived session seal replay passes');
equal(replay.sourceCheckoutOrSharedMainMutated,false,'evidence replay mutates no source checkout or shared main');
equal(replay.temporaryReplayPathRetained,false,'evidence replay retains no temp path');
equal(replay.excludedPackageLaneInspected,false,'evidence replay does not inspect the excluded package lane');
const replayBody = JSON.parse(JSON.stringify(replay));
delete replayBody.replayDigest;
equal(replay.replayDigest,'sha256:' + sha256(JSON.stringify(replayBody)),'evidence replay digest matches');

const addendum = read('SESSION_SEGMENT_ADDENDUM.jsonl'), seal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
const events = addendum.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence),[17,18],'addendum continues the session sequence');
equal(seal.eventLines,2,'addendum seal records two events');
equal(seal.validJsonLines,2,'both addendum lines are valid');
equal(seal.sha256,sha256(addendum),'addendum seal digest matches');
const index = json('FINAL_EVIDENCE_INDEX.json');
equal(index.status,'TEST','final evidence remains TEST');
equal(index.productCommit,'c64dd671c0c4bed1f798a546de879b48c8ac93cc','final index binds product commit');
equal(index.productTree,'18eca92357ec1aace6f9b0c0ee6e1a8c5df2c8a8','final index binds product tree');
equal(index.primaryEvidenceCommit,replay.evidenceCommit,'final index binds replayed evidence commit');
equal(index.cleanEvidenceReplayStatus,'PASS','final index records clean evidence replay');
equal(index.cleanEvidenceReplayTrackedFiles,replay.trackedFiles,'final index records exact replay file count');
equal(index.totalSemanticEvents,18,'final index records eighteen semantic events');
equal(index.branch,'codex/grounded-growth-retirement-artifact-publication-v5.0','final index binds review branch');
equal(index.mergeGate,'Mike Tobi / AXM','final index preserves merge gate');
equal(index.canonGate,'Mike Tobi / AXM','final index preserves CANON gate');
equal(index.broadGoalComplete,false,'final index leaves broad objective active');
equal(index.installed,false,'final index records no installation');
equal(index.promoted,false,'final index records no promotion');
equal(index.excludedPackageLaneInspected,false,'final index records untouched excluded package lane');
console.log('PASS final retirement artifact publication v5.0 evidence: ' + assertions + ' checks');
