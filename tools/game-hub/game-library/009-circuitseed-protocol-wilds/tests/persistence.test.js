'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { SessionLedger } = require('../server/ledger');
const { ProfileStore } = require('../server/profile-store');
const { WorldStore } = require('../server/world-store');
const { remove, runtimeWithSession, tempRoot } = require('./helpers');

test('participant profile and host world use distinct schemas and files', () => {
  const root = tempRoot();
  try {
    const profiles = new ProfileStore(path.join(root,'profiles'));
    const worlds = new WorldStore(path.join(root,'worlds'));
    const profile = profiles.create({displayName:'Visitor',identityType:'human'});
    const world = worlds.getOrCreate('host-world','seed');
    assert.equal(profile.schema,'axm.circuitseed-router-profile/v1');
    assert.equal(world.schema,'axm.circuitseed-world-save/v1');
    assert.equal(fs.existsSync(path.join(root,'profiles',profile.profileId+'.json')),true);
    assert.equal(fs.existsSync(path.join(root,'worlds','host-world.json')),true);
    assert.equal('story' in profile,false);
    assert.equal('circuitkinRoster' in world,false);
  } finally { remove(root); }
});

test('profile export/import is portable and divergent versions create visible recovery copy', () => {
  const root = tempRoot();
  try {
    const store = new ProfileStore(path.join(root,'profiles'));
    const original = store.create({profileId:'portable-one',displayName:'Portable'});
    const packet = store.export(original.profileId);
    assert.equal(store.import(packet).status,'already-current');
    packet.profile.displayName='Divergent Copy';
    const conflict = store.import(packet);
    assert.equal(conflict.status,'conflict');
    assert.match(conflict.report,/not overwritten/);
    assert.equal(fs.existsSync(path.join(root,'profiles','recovery',conflict.recoveryCopy)),true);
    assert.equal(store.get(original.profileId).displayName,'Portable');
  } finally { remove(root); }
});

test('incompatible portable profile schemas are refused before any file is written', () => {
  const root=tempRoot();
  try{
    const store=new ProfileStore(path.join(root,'profiles'));
    const valid=store.create({profileId:'schema-source',displayName:'Schema Source'});
    const incompatible={...valid,profileId:'schema-future',schemaVersion:99};
    assert.throws(()=>store.import(incompatible),/profile-schema-incompatible/);
    assert.equal(fs.existsSync(path.join(root,'profiles','schema-future.json')),false);
  }finally{remove(root)}
});

test('incompatible host world schemas fail visibly instead of being silently coerced', () => {
  const root=tempRoot();
  try{
    const worlds=new WorldStore(path.join(root,'worlds'));
    fs.writeFileSync(path.join(root,'worlds','future-world.json'),JSON.stringify({schema:'axm.circuitseed-world-save/v2',schemaVersion:2,worldId:'future-world',version:1}));
    assert.throws(()=>worlds.get('future-world'),/world-schema-incompatible/);
  }finally{remove(root)}
});

test('session ledger hash chain validates and duplicate reward receipts are refused', () => {
  const root = tempRoot();
  try {
    const ledger = new SessionLedger(root,'session-one');
    assert.equal(ledger.append('start',{a:1}).ok,true);
    assert.equal(ledger.append('reward',{currency:10},{dedupeKey:'reward:one'}).ok,true);
    assert.equal(ledger.append('reward',{currency:10},{dedupeKey:'reward:one'}).duplicate,true);
    assert.deepEqual(ledger.validate().errors,[]);
    const lines=fs.readFileSync(path.join(root,'session-one.jsonl'),'utf8').trim().split('\n');
    assert.equal(lines.length,2);
  } finally { remove(root); }
});

test('mission envelope commits participant reward and host consequence separately and dedupes replay', t => {
  const fixture=runtimeWithSession(1,['human']);t.after(()=>remove(fixture.root));
  const actor=fixture.session.actors.seat_1;
  fixture.session.missionProgress={missionId:'m01-first-light',counts:{move:1,'scan:welcome-relay':1},completed:true,startedAt:Date.now()};
  const beforeProfile=fixture.runtime.profileStore.get(actor.profileId);
  const beforeWorld=fixture.runtime.worldStore.get(fixture.session.worldId);
  const envelope=fixture.runtime.missionSystem.createEnvelope(fixture.session);
  const first=fixture.runtime.missionSystem.commitEnvelope(fixture.session,envelope);
  assert.equal(first.commits.participants[actor.profileId].status,'committed');
  assert.equal(first.commits.world.status,'committed');
  const paid=fixture.runtime.profileStore.get(actor.profileId);
  const changed=fixture.runtime.worldStore.get(fixture.session.worldId);
  assert.equal(paid.currency,beforeProfile.currency+20);
  assert.equal(changed.story.stageIndex,beforeWorld.story.stageIndex+1);
  const replay={...envelope,commits:{participants:{},world:null}};
  fixture.session.worldRuntime=JSON.parse(JSON.stringify(changed));
  fixture.runtime.missionSystem.commitEnvelope(fixture.session,replay);
  assert.equal(fixture.runtime.profileStore.get(actor.profileId).currency,paid.currency);
  assert.equal(fixture.runtime.worldStore.get(fixture.session.worldId).story.completedStages.filter(id=>id==='m01-first-light').length,1);
});

test('machine profile records operating-engine changes without model-memory claims', () => {
  const root=tempRoot();
  try{
    const store=new ProfileStore(path.join(root,'profiles'));
    const profile=store.create({profileId:'ai-buddy',displayName:'Nova',identityType:'adapter',operatingEngine:'Local Engine A'});
    const changed=store.recordEngineChange(profile.profileId,'Local Engine B');
    assert.equal(changed.engineHistory.length,2);
    assert.ok(changed.engineHistory.every(item=>item.claim.includes('no model-memory claim')));
  }finally{remove(root)}
});
