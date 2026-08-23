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
check(String(primary.stdout || '').includes('152 checks'),'primary evidence selftest retains 152 checks');
const replay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(replay.status,'PASS','clean evidence replay passes');
equal(replay.evidenceCommit,'c2c6958f64fbecbd27c7266768acc52e31331144','replay binds primary evidence commit');
equal(replay.evidenceTree,'f9bba099eee52fb6956b7d00f5977d5c8b1fda3c','replay binds primary evidence tree');
equal(replay.trackedFiles,30,'replay archives thirty tracked evidence dependency files');
equal(replay.selftest.verdict,'PASS','archived primary selftest passes');
equal(replay.selftest.stdout,'PASS Review Inbox retirement stage archival v5.1 evidence: 152 checks','archived selftest output is exact');
equal(replay.sealReplay,{ verdict:'PASS',sha256Matches:true,eventLines:19,validJsonLines:19 },'archived session seal replay passes');
equal(replay.sourceCheckoutOrSharedMainMutated,false,'evidence replay mutates no source checkout or shared main');
equal(replay.temporaryReplayPathRetained,false,'evidence replay retains no temp path');
equal(replay.excludedPackageLaneInspected,false,'evidence replay avoids excluded package lane');
const replayBody = JSON.parse(JSON.stringify(replay));
delete replayBody.replayDigest;
equal(replay.replayDigest,'sha256:' + sha256(JSON.stringify(replayBody)),'evidence replay digest matches');

const addendum = read('SESSION_SEGMENT_ADDENDUM.jsonl'), seal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
const events = addendum.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence),[20,21],'addendum continues the session sequence');
equal(seal.eventLines,2,'addendum seal records two events');
equal(seal.validJsonLines,2,'both addendum lines are valid');
equal(seal.sha256,sha256(addendum),'addendum seal digest matches');
const index = json('FINAL_EVIDENCE_INDEX.json');
equal(index.status,'TEST','final evidence remains TEST');
equal(index.productCommit,'a71cd29a3c0652279e5f2db1a42067e7b2c632e5','final index binds product commit');
equal(index.productTree,'db8b749c7597b9af7fa0b901c1f917f6ef149b88','final index binds product tree');
equal(index.primaryEvidenceCommit,replay.evidenceCommit,'final index binds replayed evidence commit');
equal(index.cleanEvidenceReplayStatus,'PASS','final index records clean evidence replay');
equal(index.cleanEvidenceReplayTrackedFiles,replay.trackedFiles,'final index records exact replay file count');
equal(index.totalSemanticEvents,21,'final index records twenty-one semantic events');
equal(index.branch,'codex/grounded-growth-retirement-stage-archival-v5.1','final index binds review branch');
equal(index.mergeGate,'Mike Tobi / AXM','final index preserves merge gate');
equal(index.canonGate,'Mike Tobi / AXM','final index preserves CANON gate');
equal(index.broadGoalComplete,false,'final index leaves broad objective active');
equal(index.installed,false,'final index records no installation');
equal(index.promoted,false,'final index records no promotion');
equal(index.promotionReady,false,'final index records no promotion readiness');
equal(index.promotionBlocker,'selftest result is stale for the current selftest digest','final index preserves exact promotion blocker');
equal(index.excludedPackageLaneInspected,false,'final index records untouched excluded package lane');
console.log('PASS final retirement stage archival v5.1 evidence: ' + assertions + ' checks');
