#!/usr/bin/env node
'use strict';

const assert = require('assert');
const test = require('node:test');
const serverModule = require('../runtime/server.js');

let now = 1000, runtime, base;
test.before(async () => {
  runtime = serverModule.createRuntime({ clock:()=>now });
  await new Promise(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+runtime.server.address().port;
});
test.after(async()=>{await new Promise(resolve=>runtime.server.close(resolve));});

async function post(route,body){return fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});}

test('quartermaster relay validates, queues, acknowledges, publishes, targets, and reconnects', async () => {
  let response=await post('/api/coop/join',{player:'Moss Quartermaster'}); assert.equal(response.status,200);
  const joined=await response.json(); assert.equal(joined.schema,'hexbound.coop-command/v2'); assert.equal(joined.seat.seatId,'quartermaster'); assert.ok(joined.token.length>=32);

  response=await post('/api/coop/join',{player:'Seat thief'}); assert.equal(response.status,409);
  response=await post('/api/coop/command',{token:'definitely-not-valid',type:'train',value:'mobs'}); assert.equal(response.status,403);
  response=await post('/api/coop/command',{token:joined.token,type:'delete-world',value:'yes'}); assert.equal(response.status,400);

  response=await post('/api/coop/host-state',{phase:'battle',matchId:'match-test-1',mode:'coop'}); assert.equal(response.status,200);

  response=await post('/api/coop/command',{token:joined.token,type:'train',value:'brooms'}); assert.equal(response.status,202);
  const queued=await response.json(); assert.equal(queued.command.seq,1); assert.equal(queued.command.status,'queued');
  const drained=await (await fetch(base+'/api/coop/commands?after=0')).json(); assert.equal(drained.commands.length,1); assert.equal(drained.commands[0].value,'brooms'); assert.equal(drained.seat.connected,true);

  response=await post('/api/coop/host-state',{
    phase:'battle',matchId:'match-test-1',mode:'coop',faction:'Moonwake Corsairs',map:'Rooftops',stance:'PROBE',autoScout:true,elapsed:12.5,population:27,cap:480,
    resources:{glow:200,scrap:180,essence:60},
    recruits:[{id:'mobs',name:'Moonwake Boarding Party',icon:'⚔',role:'Fast assault deckhands',glow:70,scrap:18,members:12,color:'#b27cff'},{id:'brooms',name:'Crow’s-Nest Cutters',icon:'⌁',role:'Long-sight corsair scouts',glow:54,scrap:38,members:7,color:'#f0d8ff'},{id:'intruder',name:'Delete World',icon:'!',role:'Not a unit',glow:-5,scrap:99999,members:999}],
    powers:[{id:'pirates',name:'Ghost Pirate Raid',essence:34},{id:'reinforce',name:'Second Wind',essence:34},{id:'intruder',name:'Delete World',essence:-1}],
    signature:{id:'deckfall-raiders',name:'Deckfall Raiders',icon:'☠',role:'Musters nearest the rival Clock',glow:112,scrap:64,color:'#b27cff'},
    doctrine:{active:'',options:[{id:'letters-of-marque',name:'Letters of Marque',icon:'☠',detail:'Boarding Parties and cheaper pirates.',color:'#b27cff'},{id:'black-sail-logistics',name:'Black-Sail Logistics',icon:'⚑',detail:'Scout routes and cheaper Moon Moots.',color:'#f0d8ff'},{id:'deadline-extension',name:'Wrong faction',icon:'?',detail:'Must be truncated from this two-choice contract.',color:'#ffffff'}]},
    charter:{id:'junk-jamboree',name:'Junk Jamboree',icon:'⚙',detail:'+0.70 Scrap/s from every chartered district',color:'#60d7ff'},
    mechanic:{title:'Midnight Escalator Rush',phase:'active',nextIn:4.2,direction:1,color:'#ff5f9e',effect:'Bridge escalators run eastbound.'},
    rival:{id:'web-cutter',name:'Cut the Wonderweb',icon:'WEB',kicker:'BREAK SYNERGY',phase:'staging',nextIn:3.5,target:'Roof 08 · Moon Moot',targetAnchor:'a0',counterplay:'Reinforce the marked hub.',color:'#60d7ff'},
    tactical:{
      topology:'Escalator Atrium',
      anchors:[{id:'a0',name:'Food Court West',x:.2,y:.3,explored:true,visible:true,owner:'player',kind:'borough',charterColor:'#ff963c'},{id:'a1',name:'Moonwear',x:.7,y:.4,explored:false,visible:false,owner:'enemy',kind:'watch'},{id:'a2',name:'Dead Fountain',x:.5,y:.6,explored:true,owner:'neutral'}],
      links:[['a0','a1'],['a1','a2']],
      forces:[{team:'player',x:.22,y:.31,members:12},{team:'enemy',x:.8,y:.4,members:8,visible:false},{team:'enemy',x:.62,y:.5,members:9,visible:true}],
      signal:{target:'a0',kind:'rally',player:'Moss Quartermaster'},
      routes:[{from:'a0',to:'a1',count:4},{from:'a2',to:'a1',count:2}]
    }
  }); assert.equal(response.status,200);
  response=await post('/api/coop/ack',{seq:1,ok:true,message:'Broom Patrol assembling'}); assert.equal(response.status,200);
  const state=await (await fetch(base+'/api/coop/state?token='+joined.token)).json();
  assert.equal(state.host.population,27); assert.equal(state.host.resources.essence,60); assert.equal(state.host.mechanic.title,'Midnight Escalator Rush'); assert.equal(state.host.mechanic.phase,'active'); assert.equal(state.host.mechanic.color,'#ff5f9e');
  assert.equal(state.commands[0].status,'applied'); assert.equal(state.commands[0].message,'Broom Patrol assembling');
  assert.equal(state.host.signature.id,'deckfall-raiders'); assert.equal(state.host.signature.name,'Deckfall Raiders'); assert.equal(state.host.signature.glow,112); assert.equal(state.host.signature.color,'#b27cff');
  assert.deepEqual(state.host.recruits.map(item=>item.id),['mobs','brooms']); assert.equal(state.host.recruits[0].name,'Moonwake Boarding Party'); assert.equal(state.host.recruits[1].members,7);
  assert.deepEqual(state.host.powers,[{id:'pirates',name:'Ghost Pirate Raid',essence:34},{id:'reinforce',name:'Second Wind',essence:34}]);
  assert.equal(state.host.doctrine.active,''); assert.deepEqual(state.host.doctrine.options.map(item=>item.id),['letters-of-marque','black-sail-logistics']);
  assert.equal(state.host.charter.id,'junk-jamboree'); assert.equal(state.host.charter.name,'Junk Jamboree'); assert.equal(state.host.charter.color,'#60d7ff');
  assert.equal(state.host.rival.id,'web-cutter'); assert.equal(state.host.rival.phase,'staging'); assert.equal(state.host.rival.targetAnchor,'a0'); assert.equal(state.host.rival.color,'#60d7ff');
  assert.equal(state.host.tactical.topology,'Escalator Atrium'); assert.equal(state.host.tactical.anchors.length,3); assert.equal(state.host.tactical.anchors[0].name,'Food Court West'); assert.equal(state.host.tactical.anchors[1].owner,'unknown'); assert.equal(state.host.tactical.forces.length,2); assert.equal(state.host.tactical.signal.target,'a0'); assert.deepEqual(state.host.tactical.routes,[{from:'a0',to:'a1',count:4},{from:'a2',to:'a1',count:2}]);

  response=await post('/api/coop/command',{token:joined.token,type:'train',value:'signature'}); assert.equal(response.status,202);
  const signatureQueued=await response.json(); assert.equal(signatureQueued.command.seq,2); assert.equal(signatureQueued.command.value,'signature');
  const signatureDrain=await (await fetch(base+'/api/coop/commands?after=1')).json(); assert.equal(signatureDrain.commands.length,1); assert.equal(signatureDrain.commands[0].value,'signature');

  response=await post('/api/coop/command',{token:joined.token,type:'charter',value:'volunteer-seance'}); assert.equal(response.status,202);
  const charterQueued=await response.json(); assert.equal(charterQueued.command.seq,3); assert.equal(charterQueued.command.value,'volunteer-seance');
  const charterDrain=await (await fetch(base+'/api/coop/commands?after=2')).json(); assert.equal(charterDrain.commands.length,1); assert.equal(charterDrain.commands[0].type,'charter');

  response=await post('/api/coop/command',{token:joined.token,type:'doctrine',value:'deadline-extension'}); assert.equal(response.status,400);
  response=await post('/api/coop/command',{token:joined.token,type:'doctrine',value:'letters-of-marque'}); assert.equal(response.status,202);
  const doctrineQueued=await response.json(); assert.equal(doctrineQueued.command.seq,4); assert.equal(doctrineQueued.command.value,'letters-of-marque');
  const doctrineDrain=await (await fetch(base+'/api/coop/commands?after=3')).json(); assert.equal(doctrineDrain.commands.length,1); assert.equal(doctrineDrain.commands[0].type,'doctrine');

  response=await post('/api/coop/command',{token:joined.token,type:'target',value:'rally',target:'a88'}); assert.equal(response.status,400);
  response=await post('/api/coop/command',{token:joined.token,type:'target',value:'rally',target:'a0'}); assert.equal(response.status,202);
  const targetQueued=await response.json(); assert.equal(targetQueued.command.seq,5); assert.equal(targetQueued.command.target,'a0');
  const targetDrain=await (await fetch(base+'/api/coop/commands?after=4')).json(); assert.equal(targetDrain.commands.length,1); assert.equal(targetDrain.commands[0].type,'target'); assert.equal(targetDrain.commands[0].target,'a0');
  response=await post('/api/coop/command',{token:joined.token,type:'target',value:'wonderwork',target:'a2'}); assert.equal(response.status,202);
  const wonderQueued=await response.json(); assert.equal(wonderQueued.command.seq,6); assert.equal(wonderQueued.command.value,'wonderwork'); assert.equal(wonderQueued.command.target,'a2');
  const wonderDrain=await (await fetch(base+'/api/coop/commands?after=5')).json(); assert.equal(wonderDrain.commands.length,1); assert.equal(wonderDrain.commands[0].value,'wonderwork');

  response=await post('/api/coop/host-state',{phase:'outcome',matchId:'match-test-1',mode:'coop'}); assert.equal(response.status,200);
  const ended=await (await fetch(base+'/api/coop/state?token='+joined.token)).json(); assert.equal(ended.commands.find(command=>command.seq===5).status,'rejected'); assert.equal(ended.commands.find(command=>command.seq===5).message,'Match ended before application');
  response=await post('/api/coop/command',{token:joined.token,type:'target',value:'rally',target:'a0'}); assert.equal(response.status,409);

  now+=7000; assert.equal(runtime.coop.seatView().connected,false);
  response=await post('/api/coop/join',{player:'Moss Quartermaster',token:joined.token}); assert.equal(response.status,200); const rejoined=await response.json(); assert.equal(rejoined.token,joined.token); assert.equal(rejoined.seat.connected,true);
});
