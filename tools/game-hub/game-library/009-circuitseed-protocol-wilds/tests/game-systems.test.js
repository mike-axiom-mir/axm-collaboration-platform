'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { ProfileStore } = require('../server/profile-store');
const { WorldStore, createWorldSave } = require('../server/world-store');
const catalog = require('../data/circuitkin.json');
const missions = require('../data/missions.json');
const world = require('../data/world.json');
const { CircuitkinSystem } = require('../server/circuitkin-system');
const { processPulses } = require('../server/server');
const { remove, runtimeWithSession, tempRoot } = require('./helpers');

test('catalog contains 20 individuals and 10 two-parent Confluence specialists', () => {
  assert.equal(catalog.designs.length,30);
  const individuals=catalog.designs.filter(item=>item.tier==='individual');
  const specialists=catalog.designs.filter(item=>item.tier==='confluence');
  assert.equal(individuals.length,20);
  assert.equal(specialists.length,10);
  assert.equal(new Set(individuals.map(item=>item.family)).size,20);
  const starters=catalog.designs.filter(item=>item.starter);
  assert.deepEqual(starters.map(item=>item.name),['Trace','Mend','Relay']);
  assert.ok(starters.every(item=>item.branches.length>=2));
  assert.ok(specialists.every(item=>item.components.length===2&&item.signature&&item.baseActions.length>=3));
  const componentCounts=new Map();
  specialists.flatMap(item=>item.components).forEach(id=>componentCounts.set(id,(componentCounts.get(id)||0)+1));
  assert.deepEqual([...componentCounts.keys()].sort(),individuals.map(item=>item.id).sort());
  assert.ok([...componentCounts.values()].every(count=>count===1));
  assert.equal(world.points.filter(point=>point.circuitkinDesignId).length,19);
  for(const individual of individuals){
    const point=world.points.find(item=>item.id===individual.fieldSignal?.pointId);
    assert.ok(point,'missing field source for '+individual.id);
    if(individual.id!=='aegis')assert.equal(point.circuitkinDesignId,individual.id);
  }
  assert.equal(JSON.stringify(catalog).toLowerCase().includes('capture ball'),false);
});

test('one persistent profile can reach all 30 designs without consuming an individual parent', () => {
  const root=tempRoot();
  try{
    const store=new ProfileStore(path.join(root,'profiles'));const profile=store.create({profileId:'collector',displayName:'Collector'});
    const system=new CircuitkinSystem(catalog,store);system.recruitStarter(profile.profileId,'trace');
    for(const design of catalog.designs.filter(item=>item.tier==='individual'&&item.id!=='trace'))system.recruit(profile.profileId,design.id,{kind:'help',pointId:design.fieldSignal.pointId});
    for(const design of catalog.designs.filter(item=>item.tier==='individual'))for(let index=0;index<2;index+=1)system.recordUse(profile.profileId,design.id,design.baseActions[0]);
    for(const design of catalog.designs.filter(item=>item.tier==='confluence')){
      system.evolve(profile.profileId,design.id);
      assert.equal(system.actionBonus(design.id,design.signature.action).amount,7,design.id+' signature');
    }
    const complete=store.get(profile.profileId);
    assert.equal(complete.circuitkinRoster.length,30);
    assert.equal(new Set(complete.circuitkinRoster.map(kin=>kin.designId)).size,30);
    assert.equal(complete.circuitkinRoster.filter(kin=>kin.tier==='individual').length,20);
    assert.equal(complete.circuitkinRoster.filter(kin=>kin.tier==='confluence').length,10);
    assert.equal(complete.evolutionHistory.length,10);
    assert.ok(complete.evolutionHistory.every(entry=>entry.parentsPreserved===true));
  }finally{remove(root)}
});

test('field connection requires a scan and then persists a trust-based roster bond', t => {
  const fixture=runtimeWithSession(1,['human']);t.after(()=>remove(fixture.root));
  const actor=fixture.session.actors.seat_1;
  fixture.runtime.circuitkinSystem.recruitStarter(actor.profileId,'trace');actor.circuitkinId='trace';
  actor.position={x:130,y:620};actor.currentRegionId='lumen-yard';
  actor.pendingPulses={connect:true};processPulses(fixture.runtime,fixture.session,actor);
  assert.equal(fixture.runtime.profileStore.get(actor.profileId).circuitkinRoster.some(kin=>kin.designId==='silt'),false);
  actor.pendingPulses={scan:true};processPulses(fixture.runtime,fixture.session,actor);
  assert.ok(fixture.runtime.profileStore.get(actor.profileId).discoveries.some(item=>item.id==='silt-filter'));
  actor.pendingPulses={connect:true};processPulses(fixture.runtime,fixture.session,actor);
  const profile=fixture.runtime.profileStore.get(actor.profileId);
  assert.ok(profile.circuitkinRoster.some(kin=>kin.designId==='silt'));
  assert.ok(fixture.session.events.some(event=>event.type==='circuitkin-connected'&&event.designId==='silt'));
  assert.equal(fixture.session.ledger.validate().ok,true);
});

test('Confluence evolution preserves both parents and unlocks a stronger signature action', t => {
  const fixture=runtimeWithSession(1,['human']);t.after(()=>remove(fixture.root));
  const actor=fixture.session.actors.seat_1;
  fixture.runtime.circuitkinSystem.recruitStarter(actor.profileId,'trace');
  fixture.runtime.circuitkinSystem.recruit(actor.profileId,'relay',{kind:'trust',pointId:'relay-echo'});
  for(const id of ['trace','relay'])for(let index=0;index<2;index+=1)fixture.runtime.circuitkinSystem.recordUse(actor.profileId,id,id==='trace'?'Scan':'Synchronize');
  const before=fixture.runtime.profileStore.get(actor.profileId);
  assert.equal(fixture.runtime.circuitkinSystem.confluenceEligibility(before,'wayfinder').eligible,true);
  const evolved=fixture.runtime.circuitkinSystem.evolve(actor.profileId,'wayfinder');
  assert.ok(['trace','relay','wayfinder'].every(id=>evolved.circuitkinRoster.some(kin=>kin.designId===id)));
  assert.equal(evolved.evolutionHistory.at(-1).parentsPreserved,true);
  assert.equal(fixture.runtime.circuitkinSystem.actionBonus('trace','Reroute').amount,2);
  assert.equal(fixture.runtime.circuitkinSystem.actionBonus('wayfinder','Reroute').amount,7);
  fixture.runtime.circuitkinSystem.selectActive(actor.profileId,'wayfinder');actor.circuitkinId='wayfinder';
  fixture.runtime.encounterSystem.start(fixture.session,'corewild-breach');
  const encounter=fixture.runtime.encounterSystem.apply(fixture.session,actor.seatId,'Reroute');
  assert.equal(encounter.log.at(-1).effect.circuitkinBonus,7);
  assert.equal(encounter.log.at(-1).effect.signature,true);
});

test('Circuitkin growth records use, failure/recovery and explicit eligible specialization', () => {
  const root=tempRoot();
  try{
    const store=new ProfileStore(path.join(root,'profiles'));const profile=store.create({profileId:'grower',displayName:'Grower'});
    const system=new CircuitkinSystem(catalog,store);system.recruitStarter(profile.profileId,'trace');
    for(let index=0;index<8;index+=1)system.recordUse(profile.profileId,'trace','Scan',{trustDelta:2,uncertaintyAccepted:index<3});
    const current=store.get(profile.profileId);const choices=system.branchEligibility(current,'trace');
    assert.equal(choices.find(item=>item.id==='trace-pathfinder').eligible,true);
    const specialized=system.specialize(profile.profileId,'trace','trace-pathfinder');
    assert.equal(specialized.circuitkinRoster[0].branch,'trace-pathfinder');
    assert.ok(specialized.trainingHistory.length>=8);
  }finally{remove(root)}
});

test('friendly 1v1 and 2v2 simulations use original tactical actions and resolve host-side', t => {
  const fixture=runtimeWithSession(4,['human','human','human','human']);t.after(()=>remove(fixture.root));
  for(const id of ['friendly-1v1','friendly-2v2']){
    const started=fixture.runtime.encounterSystem.start(fixture.session,id);
    assert.equal(started.status,'running');
    let loops=0;
    const actions=['Scan','Shield','Synchronize','Reroute','Anchor'];
    while(fixture.session.encounter.status==='running'&&loops<100){
      const seat='seat_'+((loops%4)+1);
      fixture.runtime.encounterSystem.apply(fixture.session,seat,actions[loops%actions.length]);
      loops+=1;
    }
    assert.equal(fixture.session.encounter.status,'resolved');
    assert.ok(Object.values(fixture.session.encounter.participation).some(value=>value.actions>0));
  }
});

test('additional-seat support role can contribute but cannot use operator-only action', t => {
  const fixture=runtimeWithSession(5,['human','human','human','human','adapter']);t.after(()=>remove(fixture.root));
  fixture.runtime.encounterSystem.start(fixture.session,'corewild-breach');
  assert.equal(fixture.session.actors.seat_5.role,'support-console');
  assert.doesNotThrow(()=>fixture.runtime.encounterSystem.apply(fixture.session,'seat_5','Scan'));
  assert.throws(()=>fixture.runtime.encounterSystem.apply(fixture.session,'seat_5','Anchor'),/action-not-available-to-role/);
});

test('crafting, optional business path, open/closed stall, demand and reputation form a connected loop', t => {
  const fixture=runtimeWithSession(1,['human']);t.after(()=>remove(fixture.root));
  const actor=fixture.session.actors.seat_1;
  fixture.runtime.profileStore.mutate(actor.profileId,p=>{p.inventory.materials['conductive-filament']=2;p.inventory.materials['machine-moss']=1});
  const crafted=fixture.runtime.economySystem.craft(actor.profileId,'service-kit');
  assert.equal(crafted.inventory.items['service-kit'],1);
  fixture.runtime.economySystem.chooseBusiness(actor.profileId,'repair');
  fixture.runtime.economySystem.setOpen(actor.profileId,true);
  const result=fixture.runtime.economySystem.fulfill(actor.profileId,fixture.session.worldId,'order-service');
  assert.equal(result.profile.inventory.items['service-kit'],0);
  assert.ok(result.profile.business.reputation>=3);
  assert.ok(result.world.economy.transactions.length>=1);
  assert.equal(result.world.localRules.businessDecayWhileAway,false);
});

test('local order trade validation rejects unknown, closed, unfunded and duplicate transactions', t => {
  const fixture=runtimeWithSession(1,['human']);t.after(()=>remove(fixture.root));
  const actor=fixture.session.actors.seat_1;
  assert.throws(()=>fixture.runtime.economySystem.fulfill(actor.profileId,fixture.session.worldId,'not-an-order'),/unknown-order/);
  assert.throws(()=>fixture.runtime.economySystem.fulfill(actor.profileId,fixture.session.worldId,'order-service'),/shop-is-closed/);
  fixture.runtime.economySystem.chooseBusiness(actor.profileId,'repair');
  fixture.runtime.economySystem.setOpen(actor.profileId,true);
  assert.throws(()=>fixture.runtime.economySystem.fulfill(actor.profileId,fixture.session.worldId,'order-service'),/ordered-item-missing/);
  fixture.runtime.profileStore.mutate(actor.profileId,p=>{p.inventory.items['service-kit']=1});
  const completed=fixture.runtime.economySystem.fulfill(actor.profileId,fixture.session.worldId,'order-service');
  assert.equal(completed.transaction.orderId,'order-service');
  assert.throws(()=>fixture.runtime.economySystem.fulfill(actor.profileId,fixture.session.worldId,'order-service'),/order-already-completed/);
  fixture.runtime.worldStore.getOrCreate('replay-world','replay-seed');
  fixture.runtime.profileStore.mutate(actor.profileId,p=>{p.inventory.items['service-kit']=1});
  assert.equal(fixture.runtime.economySystem.fulfill(actor.profileId,'replay-world','order-service').transaction.worldId,'replay-world');
});

test('Circuitkin family compatibility changes Synchronize contribution and remains visible', t => {
  const fixture=runtimeWithSession(2,['human','human']);t.after(()=>remove(fixture.root));
  const first=fixture.session.actors.seat_1,second=fixture.session.actors.seat_2;
  fixture.runtime.circuitkinSystem.recruitStarter(first.profileId,'trace');first.circuitkinId='trace';
  fixture.runtime.circuitkinSystem.recruitStarter(second.profileId,'relay');second.circuitkinId='relay';
  const encounter=fixture.runtime.encounterSystem.start(fixture.session,'friendly-1v1');
  assert.equal(encounter.teamCompatibility,0.85);
  const after=fixture.runtime.encounterSystem.apply(fixture.session,'seat_1','Synchronize');
  assert.ok(after.stability>=13);
});

test('dynamic request derives from actual highest instability instead of noun swapping', t => {
  const fixture=runtimeWithSession(1,['human']);t.after(()=>remove(fixture.root));
  const dynamic=fixture.runtime.missionSystem.dynamicMission(fixture.session);
  assert.equal(dynamic.derivedFrom.region,'core');
  assert.equal(dynamic.derivedFrom.instability,48);
  assert.equal(dynamic.templateBound,true);
  assert.ok(dynamic.actions.length>=3);
});

test('dynamic resolution persists its world-state change through the mission envelope', t => {
  const fixture=runtimeWithSession(1,['human']);t.after(()=>remove(fixture.root));
  const staged=fixture.runtime.worldStore.mutate(fixture.session.worldId,world=>{world.story.stageIndex=7});
  fixture.session.worldRuntime=JSON.parse(JSON.stringify(staged));
  fixture.runtime.missionSystem.ensureProgress(fixture.session);
  const progress=fixture.runtime.missionSystem.resolveDynamic(fixture.session,'isolate');
  assert.equal(progress.complete,true);
  assert.equal(fixture.runtime.worldStore.get(fixture.session.worldId).instability.core,30);
  const committed=fixture.runtime.missionSystem.commitEnvelope(fixture.session,fixture.runtime.missionSystem.createEnvelope(fixture.session));
  assert.equal(committed.commits.world.status,'committed');
  const saved=fixture.runtime.worldStore.get(fixture.session.worldId);
  assert.equal(saved.instability.core,30);
  assert.equal(saved.story.stageIndex,8);
  assert.ok(saved.worldEvents.some(event=>event.type==='dynamic-world-resolution'));
});

test('stored seed reproduces promised conditions and modifier', () => {
  const first=createWorldSave('one','same-seed');const second=createWorldSave('two','same-seed');
  assert.equal(first.worldSeed,second.worldSeed);
  assert.deepEqual(first.conditions,second.conditions);
  assert.equal(typeof first.conditions.expeditionModifier,'string');
});

test('chapter contains ten integrated stages including business, dynamic, cooperative and finale', () => {
  assert.equal(missions.stages.length,10);
  assert.ok(missions.stages.some(item=>item.kind==='business'));
  assert.ok(missions.stages.some(item=>item.kind==='dynamic-world'));
  assert.ok(missions.stages.some(item=>item.kind==='cooperative'));
  assert.equal(missions.stages.at(-1).kind,'chapter-finale');
});
