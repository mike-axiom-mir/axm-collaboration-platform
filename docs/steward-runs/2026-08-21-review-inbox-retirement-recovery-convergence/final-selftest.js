#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
let assertions = 0;
function equal(actual, expected, label) { assert.deepStrictEqual(actual, expected, label); assertions += 1; }
function check(value, label) { assert(value, label); assertions += 1; }
function json(name) { return JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8')); }
function read(name) { return fs.readFileSync(path.join(__dirname,name),'utf8'); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

const primary = childProcess.spawnSync(process.execPath, [path.join(__dirname,'selftest.js')], { cwd:path.resolve(__dirname,'../../..'), encoding:'utf8', windowsHide:true, maxBuffer:32 * 1024 * 1024 });
equal(primary.status, 0, 'primary evidence selftest still passes');
check(String(primary.stdout || '').includes('133 checks'), 'primary evidence selftest retains 133 checks');
const replay = json('CLEAN_EVIDENCE_REPLAY.json');
equal(replay.status, 'PASS', 'clean evidence replay passes');
equal(replay.evidenceCommit, 'ef4a1673ca020267a0041da0b8db41266b7c29e4', 'replay binds primary evidence commit');
equal(replay.evidenceTree, '6bad4c04c83de8a4ba659595d19b040b6b323bfb', 'replay binds primary evidence tree');
equal(replay.trackedFiles, 30, 'replay archives 30 tracked evidence dependency files');
equal(replay.selftest.verdict, 'PASS', 'archived primary selftest passes');
equal(replay.selftest.stdout, 'PASS Review Inbox retirement recovery convergence evidence: 133 checks', 'archived selftest output is exact');
equal(replay.sealReplay, { verdict:'PASS', sha256Matches:true, eventLines:18, validJsonLines:18 }, 'archived session seal replay passes');
equal(replay.sourceCheckoutOrSharedMainMutated, false, 'evidence replay mutates no source checkout or shared main');
equal(replay.temporaryReplayPathRetained, false, 'evidence replay retains no temp path');
const replayBody = JSON.parse(JSON.stringify(replay)); delete replayBody.replayDigest;
equal(replay.replayDigest, 'sha256:' + sha256(JSON.stringify(replayBody)), 'evidence replay digest matches');
const addendum = read('SESSION_SEGMENT_ADDENDUM.jsonl'), seal = json('SESSION_SEGMENT_ADDENDUM.seal.json');
const events = addendum.trim().split(/\r?\n/).map(line => JSON.parse(line));
equal(events.map(item => item.sequence), [19,20], 'addendum continues the session sequence');
equal(seal.eventLines, 2, 'addendum seal records two events');
equal(seal.validJsonLines, 2, 'both addendum lines are valid');
equal(seal.sha256, sha256(addendum), 'addendum seal digest matches');
const index = json('FINAL_EVIDENCE_INDEX.json');
equal(index.status, 'TEST', 'final evidence remains TEST');
equal(index.primaryEvidenceCommit, replay.evidenceCommit, 'final index binds replayed evidence commit');
equal(index.cleanEvidenceReplayStatus, 'PASS', 'final index records clean evidence replay');
equal(index.totalSemanticEvents, 20, 'final index records 20 semantic events');
equal(index.mergeGate, 'Mike Tobi / AXM', 'final index preserves merge gate');
equal(index.canonGate, 'Mike Tobi / AXM', 'final index preserves CANON gate');
equal(index.broadGoalComplete, false, 'final index leaves broad objective active');
equal(index.installed, false, 'final index records no installation');
equal(index.promoted, false, 'final index records no promotion');
equal(index.specialistPackagesInspected, false, 'final index records untouched specialist package lane');
console.log('PASS final retirement recovery convergence evidence: ' + assertions + ' checks');
