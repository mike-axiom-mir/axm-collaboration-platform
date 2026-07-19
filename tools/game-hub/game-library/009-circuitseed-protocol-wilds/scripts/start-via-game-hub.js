#!/usr/bin/env node
'use strict';

const childProcess=require('node:child_process');
const path=require('node:path');
const HUB_ROOT=path.resolve(__dirname,'../../..');
const HUB_PORT=Number(process.env.AXM_GAME_HUB_PORT||8788);
const HUB_BASE='http://127.0.0.1:'+HUB_PORT;
let hubChild=null;

async function health(){try{const response=await fetch(HUB_BASE+'/health');return response.ok}catch(error){return false}}
async function wait(){for(let index=0;index<50;index+=1){if(await health())return;await new Promise(resolve=>setTimeout(resolve,100))}throw new Error('Game Hub did not become ready on port '+HUB_PORT)}
async function post(route,body){const response=await fetch(HUB_BASE+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw new Error(route+': '+(value.error||response.status));return value}
async function stop(){try{await post('/game/end',{summary:{requestedBy:'Circuitseed launch helper'}})}catch(error){}if(hubChild&&!hubChild.killed)hubChild.kill('SIGTERM')}

(async()=>{
  if(!await health()){
    hubChild=childProcess.spawn(process.execPath,['game-hub-server.js'],{cwd:HUB_ROOT,env:{...process.env,AXM_GAME_HUB_HOST:'127.0.0.1',AXM_GAME_HUB_PORT:String(HUB_PORT)},stdio:'inherit'});
    await wait();
  }
  await post('/seat/assign',{seat_id:'seat_1',patch:{type:'human',display_name:process.env.AXM_PLAYER_NAME||'Local Pathfinder'}});
  await post('/seat/ready',{seat_id:'seat_1',ready:true});
  const launch=await post('/game/start',{game_id:'009-circuitseed-protocol-wilds'});
  console.log('');
  console.log('  CIRCUITSEED is ready through the AXM Game Hub');
  console.log('  Open:  http://127.0.0.1:'+launch.runtime_port+'/games/009/');
  console.log('  Party: http://127.0.0.1:'+launch.runtime_port+'/party/');
  console.log('  Local only. Keep this window open. Press Ctrl+C to stop.');
  console.log('');
  if(hubChild){
    process.on('SIGINT',async()=>{await stop();process.exit(0)});
    process.on('SIGTERM',async()=>{await stop();process.exit(0)});
    process.stdin.resume();
  }
})().catch(async error=>{console.error('Circuitseed launch failed: '+error.message);await stop();process.exit(1)});
