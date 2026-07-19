'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHttpServer, createRuntime } = require('../server/server');
const { players, remove, tempRoot } = require('./helpers');

async function request(base,path,options={}){
  const response=await fetch(base+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const type=response.headers.get('content-type')||'';
  const body=type.includes('json')?await response.json():await response.text();
  return{response,body};
}

test('standalone New Journey creates one explicit local human without AI fill', async t => {
  const root=tempRoot();const runtime=createRuntime({dataRoot:root,hubPlayers:[]});const app=createHttpServer(runtime);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));remove(root)});
  const base='http://127.0.0.1:'+app.server.address().port;
  const result=await request(base,'/api/session/start',{method:'POST',body:JSON.stringify({players:[],worldId:'standalone-world',seed:'standalone'})});
  assert.equal(result.response.status,201);
  assert.equal(result.body.players.length,1);
  assert.equal(result.body.players[0].controllerType,'human');
  assert.equal(result.body.players[0].displayName,'Local Pathfinder');
  assert.equal(result.body.bindings.length,1);
  assert.equal(result.body.defaultAiFill,false);
  assert.equal(runtime.sessionManager.getRunning().rules.emptySeatsRemainEmpty,true);
});

test('live HTTP serves title, health, session, same-gate input, seat view and clean result', async t => {
  const root=tempRoot();const roster=players(2,['human','adapter']);
  const runtime=createRuntime({dataRoot:root,hubPlayers:roster});const app=createHttpServer(runtime);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));remove(root)});
  const port=app.server.address().port,base='http://127.0.0.1:'+port;
  let result=await request(base,'/health');assert.equal(result.response.status,200);assert.equal(result.body.localOnly,true);
  result=await request(base,'/');assert.equal(result.response.status,200);assert.match(result.body,/CIRCUITSEED/);
  result=await request(base,'/api/bootstrap');assert.equal(result.body.hubPlayers.length,2);assert.equal(result.body.economy.businessPaths.length,3);assert.equal(result.body.economy.recipes.length,10);assert.equal(result.body.fieldRequests.total,16);assert.equal(result.body.memoryArchive.total,10);assert.equal(result.body.memoryArchive.entries.length,10);assert.equal(result.body.circuitkin.length,30);assert.deepEqual({individual:result.body.circuitkinRosterModel.individual,confluence:result.body.circuitkinRosterModel.confluence},{individual:20,confluence:10});
  result=await request(base,'/api/session/start',{method:'POST',body:JSON.stringify({players:roster,worldId:'http-world',seed:'http-seed'})});
  assert.equal(result.response.status,201);assert.equal(result.body.players.length,2);assert.equal(result.body.bindings.length,2);
  const human=result.body.bindings.find(item=>item.seatId==='seat_1');
  const hostToken=result.body.hostToken,sessionId=result.body.sessionId;
  result=await request(base,'/api/input',{method:'POST',body:JSON.stringify({roomCode:'AXM1',sessionId,seatId:'seat_1',token:human.token,seq:0,input:{moveX:1,moveY:0,scan:true}})});
  assert.equal(result.body.ok,true);
  await new Promise(resolve=>setTimeout(resolve,90));
  const params=new URLSearchParams({room:'AXM1',session:sessionId,seat:'seat_1'});
  result=await request(base,'/api/state?'+params,{headers:{'x-axm-seat-token':human.token}});
  assert.equal(result.body.observationType,'axm-seat-screen-semantics-v1');
  assert.equal(result.body.partyHud.length,2);
  assert.equal(result.body.hud.journal.total,10);assert.equal(result.body.hud.requests.total,16);assert.ok(result.body.hud.inventory);
  const profileId=runtime.sessionManager.getRunning().actors.seat_1.profileId;
  runtime.profileStore.mutate(profileId,profile=>{for(let index=0;index<5;index+=1)profile.discoveries.push({id:'http-proof-'+index,kind:'relay',regionId:'lumen-yard'})});
  result=await request(base,'/api/field-request/claim',{method:'POST',body:JSON.stringify({roomCode:'AXM1',sessionId,seatId:'seat_1',token:human.token,requestId:'honest-marks'})});
  assert.equal(result.response.status,200);assert.equal(result.body.request.claimed,true);assert.equal(result.body.profile.inventory.items['survey-ribbon'],1);
  result=await request(base,'/api/session/end',{method:'POST',body:JSON.stringify({hostToken,summary:{test:true}})});
  assert.equal(result.body.result.summary.test,true);
  assert.equal(result.body.result.ledger.ok,true);
});

test('live server enforces profile conflict and input outcome rejection', async t => {
  const root=tempRoot();const runtime=createRuntime({dataRoot:root,hubPlayers:players(1)});const app=createHttpServer(runtime);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));remove(root)});
  const base='http://127.0.0.1:'+app.server.address().port;
  let result=await request(base,'/api/profile/create',{method:'POST',body:JSON.stringify({profileId:'conflict-http',displayName:'A'})});
  const packet={profile:result.body.profile};packet.profile.displayName='B';
  result=await request(base,'/api/profile/import',{method:'POST',body:JSON.stringify(packet)});
  assert.equal(result.response.status,409);assert.equal(result.body.status,'conflict');
  result=await request(base,'/api/session/start',{method:'POST',body:JSON.stringify({players:players(1),worldId:'x'})});
  const binding=result.body.bindings[0];
  result=await request(base,'/api/input',{method:'POST',body:JSON.stringify({roomCode:'AXM1',sessionId:result.body.sessionId,seatId:binding.seatId,token:binding.token,seq:0,input:{reward:999}})});
  assert.equal(result.response.status,400);assert.equal(result.body.reason,'machine-or-outcome-action-rejected');
});

test('live routes expose continuation, returning starters, explicit specialization and friendly simulation', async t => {
  const root=tempRoot();const roster=players(2,['human','human']);const runtime=createRuntime({dataRoot:root,hubPlayers:roster});const app=createHttpServer(runtime);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));remove(root)});
  const base='http://127.0.0.1:'+app.server.address().port;
  let started=await request(base,'/api/session/start',{method:'POST',body:JSON.stringify({players:roster,worldId:'first-polish-world',seed:'first'})});
  const firstBinding=started.body.bindings.find(binding=>binding.seatId==='seat_1');
  let session=runtime.sessionManager.getRunning();
  const staged=runtime.worldStore.mutate(session.worldId,world=>{world.story.stageIndex=1});session.worldRuntime=JSON.parse(JSON.stringify(staged));session.missionProgress=null;runtime.missionSystem.ensureProgress(session);
  const auth={roomCode:'AXM1',sessionId:session.id,seatId:'seat_1',token:firstBinding.token};
  let result=await request(base,'/api/starter',{method:'POST',body:JSON.stringify({...auth,choice:'trace'})});
  assert.equal(result.response.status,200);assert.equal(result.body.returning,false);
  const first=session.actors.seat_1,second=session.actors.seat_2;
  runtime.circuitkinSystem.recruitStarter(second.profileId,'relay');second.circuitkinId='relay';
  for(let index=0;index<8;index+=1)runtime.circuitkinSystem.recordUse(first.profileId,'trace','Scan',{trustDelta:2});
  result=await request(base,'/api/circuitkin/specialize',{method:'POST',body:JSON.stringify({...auth,designId:'trace',branchId:'trace-pathfinder'})});
  assert.equal(result.response.status,200);assert.equal(result.body.profile.circuitkinRoster[0].branch,'trace-pathfinder');
  runtime.circuitkinSystem.recruit(first.profileId,'relay',{kind:'trust',pointId:'relay-echo'});
  for(let index=0;index<2;index+=1)runtime.circuitkinSystem.recordUse(first.profileId,'relay','Synchronize');
  result=await request(base,'/api/circuitkin/evolve',{method:'POST',body:JSON.stringify({...auth,designId:'wayfinder'})});
  assert.equal(result.response.status,200);assert.ok(['trace','relay','wayfinder'].every(id=>result.body.profile.circuitkinRoster.some(kin=>kin.designId===id)));
  result=await request(base,'/api/circuitkin/active',{method:'POST',body:JSON.stringify({...auth,designId:'wayfinder'})});
  assert.equal(result.response.status,200);assert.equal(session.actors.seat_1.circuitkinId,'wayfinder');
  result=await request(base,'/api/encounter/start',{method:'POST',body:JSON.stringify({...auth,encounterId:'rootsignal-fracture'})});
  assert.equal(result.response.status,400);assert.equal(result.body.error,'manual-encounter-only-friendly-simulation');
  result=await request(base,'/api/encounter/start',{method:'POST',body:JSON.stringify({...auth,encounterId:'friendly-1v1'})});
  assert.equal(result.response.status,201);assert.equal(result.body.encounter.teamCompatibility,0.85);
  await request(base,'/api/session/end',{method:'POST',body:JSON.stringify({hostToken:started.body.hostToken,summary:{returnToLobby:false}})});

  started=await request(base,'/api/session/start',{method:'POST',body:JSON.stringify({players:roster,worldId:'returning-polish-world',seed:'returning'})});
  session=runtime.sessionManager.getRunning();
  const stagedAgain=runtime.worldStore.mutate(session.worldId,world=>{world.story.stageIndex=1});session.worldRuntime=JSON.parse(JSON.stringify(stagedAgain));session.missionProgress=null;runtime.missionSystem.ensureProgress(session);
  const returningBinding=started.body.bindings.find(binding=>binding.seatId==='seat_1');
  result=await request(base,'/api/starter',{method:'POST',body:JSON.stringify({roomCode:'AXM1',sessionId:session.id,seatId:'seat_1',token:returningBinding.token,choice:'trace'})});
  assert.equal(result.response.status,200);assert.equal(result.body.returning,true);
  result=await request(base,'/api/bootstrap');
  assert.equal(result.body.worlds.length,2);assert.ok(result.body.worlds.some(world=>world.worldId==='returning-polish-world'));
  await request(base,'/api/session/end',{method:'POST',body:JSON.stringify({hostToken:started.body.hostToken,summary:{returnToLobby:false}})});
});
