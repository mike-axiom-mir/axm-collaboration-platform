'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { players, tempRoot } = require('./helpers');

function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})})}
async function wait(url,tries=60){let last;for(let i=0;i<tries;i+=1){try{const response=await fetch(url);if(response.ok)return response}catch(error){last=error}await new Promise(resolve=>setTimeout(resolve,80))}throw last||new Error('timeout '+url)}
async function call(base,route,options={}){const response=await fetch(base+route,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const body=await response.json();if(!response.ok)throw new Error(route+' '+response.status+' '+JSON.stringify(body));return body}

(async()=>{
  const root=tempRoot('circuitseed-cli-'),port=await freePort(),project=path.join(__dirname,'..');
  const roster=players(3,['human','adapter','human']);
  const child=childProcess.spawn(process.execPath,['server/server.js'],{cwd:project,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),AXM_CIRCUITSEED_DATA_ROOT:root,AXM_PLAYERS_JSON:JSON.stringify(roster)},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);
  try{
    const base='http://127.0.0.1:'+port;await wait(base+'/health');
    const started=await call(base,'/api/session/start',{method:'POST',body:JSON.stringify({players:roster,worldId:'cli-world',seed:'cli-seed'})});
    assert.equal(started.players.length,3);
    const human=started.bindings.find(item=>item.seatId==='seat_1'),adapter=started.bindings.find(item=>item.seatId==='seat_2');
    const input=await call(base,'/api/input',{method:'POST',body:JSON.stringify({roomCode:'AXM1',sessionId:started.sessionId,seatId:human.seatId,token:human.token,seq:0,input:{moveX:.7,moveY:.2,scan:true}})});
    assert.equal(input.ok,true);
    const q=new URLSearchParams({room:'AXM1',session:started.sessionId,seat:adapter.seatId,width:'640',height:'480'});
    const observation=await call(base,'/api/adapter-observation?'+q,{headers:{'x-axm-seat-token':adapter.token}});
    assert.equal(observation.scope,'same-party-shared-screen-only');
    const joined=await call(base,'/api/session/join',{method:'POST',body:JSON.stringify({hostToken:started.hostToken,displayName:'Drop In',type:'human',slot:7})});
    assert.equal(joined.actor.slot,7);
    const left=await call(base,'/api/session/leave',{method:'POST',body:JSON.stringify({roomCode:'AXM1',sessionId:started.sessionId,seatId:'seat_7',token:joined.binding.token,reason:'cli-test'})});
    assert.equal(left.replacementCreated,false);
    const back=await call(base,'/api/session/reconnect',{method:'POST',body:JSON.stringify({sessionId:started.sessionId,seatId:'seat_7',token:joined.binding.token,profileId:joined.actor.profileId})});
    assert.equal(back.actor.active,true);
    const ended=await call(base,'/api/session/end',{method:'POST',body:JSON.stringify({hostToken:started.hostToken,summary:{cli:true}})});
    assert.equal(ended.result.ledger.ok,true);
    console.log('CIRCUITSEED_CLI_LIFECYCLE: PASS');
    console.log('players='+started.players.length);
    console.log('adapterScope='+observation.scope);
    console.log('dropInSlot='+joined.actor.slot);
    console.log('reconnect='+back.actor.active);
    console.log('ledgerEntries='+ended.result.ledger.count);
  }finally{
    child.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(resolve,1500);child.once('exit',()=>{clearTimeout(timer);resolve()})});
    fs.rmSync(root,{recursive:true,force:true});
  }
})().catch(error=>{console.error('CIRCUITSEED_CLI_LIFECYCLE: FAIL');console.error(error.stack||error);process.exit(1)});
