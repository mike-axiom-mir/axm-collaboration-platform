'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('http');
const mod=require('../server/server');
function get(port,route,headers={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:route,headers},res=>{let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end();});}
test('health is public but Forge state requires the injected local token',async t=>{
  await new Promise((resolve,reject)=>mod.server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
  t.after(()=>new Promise(resolve=>mod.server.close(resolve)));
  const port=mod.server.address().port;
  assert.equal((await get(port,'/api/health')).status,200);
  assert.equal((await get(port,'/api/state')).status,401);
  const page=await get(port,'/');
  const match=page.body.match(/name="axm-forge-session" content="([a-f0-9]{64})"/);
  assert.ok(match,'local UI receives an ephemeral-readable same-origin token');
  assert.equal((await get(port,'/api/state',{authorization:'Bearer '+match[1]})).status,200);
  const metabolism=await get(port,'/api/metabolism',{authorization:'Bearer '+match[1]});
  assert.equal(metabolism.status,200);
  assert.equal(JSON.parse(metabolism.body).status.policy.maxConcurrentSessions,1);
});
