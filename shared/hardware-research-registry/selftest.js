'use strict';

const assert = require('assert');
const Hardware = require('./index');
const Research = require('../deterministic-research');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }
function rejects(fn, pattern, message) { assert.throws(fn, pattern); checks += 1; if (message) ok(true, message); }
function fixture(suffix) {
  return {
    schema:Hardware.INTAKE_SCHEMA, id:'village-hardware-'+suffix, title:'Village hardware '+suffix,
    objective:'Preserve physical research and inert build designs.',
    sources:[{id:'source-a',title:'Bench note',kind:'LOCAL_NOTE',locator:'notes/bench-a.md',evidenceStatus:'DIGEST_BOUND',contentDigest:'a'.repeat(64)}],
    candidates:[
      {id:'motor-a',class:'ACTUATOR',title:'Recovered motor',description:'Candidate motor from reclaimed equipment.',sourceIds:['source-a'],safety:{risk:'HIGH',hazards:['unexpected motion'],requiredAuthorities:['qualified bench steward']}},
      {id:'frame-a',class:'ROBOT_BODY',title:'Test frame',description:'Unpowered candidate frame.',sourceIds:['source-a'],safety:{risk:'MEDIUM',hazards:['sharp edge']}}
    ],
    builds:[{id:'build-a',title:'Unpowered fit fixture',purpose:'Check component fit without energizing hardware.',candidateIds:['frame-a','motor-a'],state:'DESIGN_ONLY',openQuestions:['mount tolerance']}],
    claims:[{id:'claim-a',statement:'The recovered motor fits the test frame.',kind:'STATIC_STRUCTURE',risk:'HIGH',subjectRefs:['build-a'],passCondition:'Measured mounting points fit the declared tolerance.',counterevidence:'Any measured point exceeds tolerance.',primarySurface:'dimensioned bench inspection',secondarySurface:'independent fit-check fixture'}]
  };
}

const first = Hardware.compile(fixture('a'));
const second = Hardware.compile(fixture('a'));
ok(first.packageDigest === second.packageDigest, 'same semantic hardware intake compiles deterministically');
ok(Hardware.verify(first).pass, 'compiled hardware package verifies');
ok(first.defaultField === 'HARDWARE' && first.family === 'HARDWARE_COMPUTE_RESEARCH' && first.domain === 'ROBOTICA_AND_PHYSICAL_SYSTEMS', 'shared family and hardware default field are explicit');
ok(first.authority === 'RECOMMENDATION_ONLY', 'hardware package is recommendation-only');
ok(first.builds[0].state === 'DESIGN_ONLY' && !first.builds[0].executionAuthority && !first.builds[0].safetyApproval, 'build remains inert and unapproved');
ok(!first.boundaries.physicalExecution && !first.boundaries.automaticBuild && first.boundaries.inputIsData, 'physical authority boundaries are explicit');
ok(first.candidates.every(item => item.readiness === 'RESEARCH_CANDIDATE'), 'hardware candidates remain research candidates');
ok(first.claims[0].verdict === 'UNTESTED', 'new hardware claim is untested');

const tampered = JSON.parse(JSON.stringify(first)); tampered.builds[0].state = 'BENCH_TESTED';
ok(!Hardware.verify(tampered).pass, 'tampered build state fails package verification');
const digestTamper = JSON.parse(JSON.stringify(first)); digestTamper.objective = 'changed';
ok(!Hardware.verify(digestTamper).pass, 'tampered package content fails digest verification');

const unknownCandidate = fixture('unknown'); unknownCandidate.builds[0].candidateIds.push('missing');
rejects(() => Hardware.compile(unknownCandidate), /unknown candidate/, 'unknown build references are refused');
const unsafeState = fixture('state'); unsafeState.builds[0].state = 'SAFE_TO_RUN';
rejects(() => Hardware.compile(unsafeState), /DESIGN_ONLY/, 'intake cannot self-approve a build');
const missingSecondary = fixture('secondary'); delete missingSecondary.claims[0].secondarySurface;
rejects(() => Hardware.compile(missingSecondary), /independent secondary/, 'high-risk claim needs two evidence surfaces');
const weakDigest = fixture('digest'); weakDigest.sources[0].contentDigest = 'abc';
rejects(() => Hardware.compile(weakDigest), /sha256/, 'digest-bound source needs an exact digest');

const other = fixture('b'); other.id='village-hardware-b'; other.sources[0].id='source-b'; other.candidates.forEach(item => item.sourceIds=['source-b']);
other.candidates.forEach(item => item.id += '-b'); other.builds[0].id='build-b'; other.builds[0].candidateIds=['frame-a-b','motor-a-b']; other.claims[0].id='claim-b'; other.claims[0].subjectRefs=['build-b'];
const packageB = Hardware.compile(other), merged = Hardware.merge([packageB, first]);
ok(Hardware.verify(merged).pass, 'merged hardware package verifies');
ok(merged.sources.length === 2 && merged.builds.length === 2 && merged.mergedFrom.length === 2, 'merge preserves both research packages');
ok(merged.mergedFrom.slice().sort().join('|') === merged.mergedFrom.join('|'), 'merge provenance is stable-sorted');
const conflict = JSON.parse(JSON.stringify(first)); conflict.candidates[0].description='conflicting same-id hardware record'; delete conflict.packageDigest; conflict.packageDigest=Research.Core.digest(conflict);
rejects(() => Hardware.merge([first, conflict]), /conflicting/, 'same record id with different content is not averaged');

let ledger = Hardware.createEvidenceLedger(first);
ok(ledger.claims[0].verdict === 'UNTESTED', 'hardware evidence ledger begins untested');
ledger = Hardware.ingestEvidence(ledger,{claimId:'claim-a',surface:'dimensioned bench inspection',verdict:'PASS',observedAt:'2026-08-10T00:00:00Z',observer:{id:'bench-a',kind:'MACHINE'},evidenceRefs:[{path:'bench/pass.json',digest:'b'.repeat(64)}]});
ledger = Hardware.ingestEvidence(ledger,{claimId:'claim-a',surface:'independent fit-check fixture',verdict:'FAIL',observedAt:'2026-08-10T00:01:00Z',observer:{id:'bench-b',kind:'HUMAN'},evidenceRefs:[{path:'bench/fail.json',digest:'c'.repeat(64)}]});
ok(ledger.claims[0].verdict === 'CONFLICT', 'contradictory hardware observations remain conflict');
ok(Research.Ledger.verify(ledger).pass, 'hardware evidence ledger hash chain verifies');
const snapshot = Hardware.snapshot(first, ledger);
ok(snapshot.claimVerdicts.CONFLICT === 1, 'snapshot reports the conflict');
ok(!snapshot.physicalExecutionAuthority && !snapshot.safetyApprovalAuthority, 'snapshot grants no hardware authority');
ok(/^[a-f0-9]{64}$/.test(snapshot.snapshotDigest), 'snapshot is digest-bound');

console.log('Hardware Research Registry core self-test passed '+checks+' checks. Physical hardware was not operated.');
