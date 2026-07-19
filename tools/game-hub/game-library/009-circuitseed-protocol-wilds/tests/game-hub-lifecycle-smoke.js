'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { tempRoot } = require('./helpers');

function freePort(){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})})}
async function wait(url,tries=80){for(let i=0;i<tries;i+=1){try{const response=await fetch(url);if(response.ok)return response}catch(error){}await new Promise(resolve=>setTimeout(resolve,90))}throw new Error('timeout '+url)}
async function waitClosed(url,tries=80){for(let i=0;i<tries;i+=1){try{await fetch(url)}catch(error){return true}await new Promise(resolve=>setTimeout(resolve,90))}throw new Error('runtime did not close '+url)}
async function call(base,route,body){const response=await fetch(base+route,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await response.json();if(!response.ok)throw new Error(route+' '+response.status+' '+JSON.stringify(value));return value}

(async()=>{
  const hubRoot=path.resolve(__dirname,'../../..'),hubPort=await freePort(),dataRoot=tempRoot('circuitseed-hub-data-');
  process.env.AXM_CIRCUITSEED_DATA_ROOT=dataRoot;
  const hub=require('../../../game-hub-server');
  await hub.listenHub(hubPort,'127.0.0.1');
  const base='http://127.0.0.1:'+hubPort;
  try{
    await wait(base+'/health');
    const games=await call(base,'/games');assert.ok(games.games.some(game=>game.game_id==='009-circuitseed-protocol-wilds'));
    await call(base,'/seat/assign',{seat_id:'seat_1',patch:{type:'human',display_name:'Hub Tester'}});
    await call(base,'/seat/ready',{seat_id:'seat_1',ready:true});
    const launch=await call(base,'/game/start',{game_id:'009-circuitseed-protocol-wilds'});
    assert.equal(launch.runtime_port,8799);
    assert.equal(launch.session.selected_players.length,1);
    assert.equal(launch.controller_urls.length,1);
    const runtime=await (await wait('http://127.0.0.1:8799/health')).json();
    assert.equal(runtime.gameId,'009-circuitseed-protocol-wilds');
    assert.equal(runtime.localOnly,true);
    const gameBase='http://127.0.0.1:8799';
    const gameSession=await call(gameBase,'/api/session/start',{players:launch.session.selected_players,worldId:'hub-return-proof',seed:'hub-return-proof'});
    const gameEnd=await call(gameBase,'/api/session/end',{hostToken:gameSession.hostToken,summary:{hubLifecycle:true,returnToLobby:true}});
    assert.equal(gameEnd.returningToGameHub,true);
    const closed=await waitClosed(gameBase+'/health');
    const hubState=await call(base,'/state');
    assert.equal(hubState.state.status,'lobby');
    assert.equal(hubState.state.session.phase,'LOBBY');
    assert.equal(hubState.state.result_summary.source,'009-circuitseed-protocol-wilds');
    assert.equal(hubState.state.result_summary.result.summary.hubLifecycle,true);
    console.log('CIRCUITSEED_GAME_HUB_LIFECYCLE: PASS');
    console.log('hubSelected='+launch.session.selected_players.length);
    console.log('runtimePort='+launch.runtime_port);
    console.log('clientRoute='+launch.client_url);
    console.log('childStopped='+closed);
    console.log('resultReturnedToLobby=true');
  }finally{
    hub.stopGameRuntime();
    if(hub.server.listening)await new Promise(resolve=>hub.server.close(resolve));
    fs.rmSync(dataRoot,{recursive:true,force:true});
  }
})().catch(error=>{console.error('CIRCUITSEED_GAME_HUB_LIFECYCLE: FAIL');console.error(error.stack||error);process.exit(1)});
