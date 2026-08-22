#!/usr/bin/env node
'use strict';
/* AXM SANDBOX Session-1 selftest: contracts, bounded writes and HTTP authority. */
const assert=require('assert');
const fs=require('fs');
const http=require('http');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');
const {once}=require('events');
const C=require('./project-contract');

const tests=[];
let pass=0,fail=0;
function test(name,fn){tests.push({name,fn});}
function request(port,options){
  const settings=Object.assign({method:'GET',path:'/'},options||{});
  const body=settings.body===undefined?null:Buffer.from(String(settings.body));
  delete settings.body;
  settings.hostname='127.0.0.1';
  settings.port=port;
  settings.headers=Object.assign({},settings.headers||{},body?{'content-length':body.length}:{});
  return new Promise((resolve,reject)=>{
    const req=http.request(settings,res=>{
      const chunks=[];
      res.on('data',chunk=>chunks.push(chunk));
      res.on('end',()=>{
        const text=Buffer.concat(chunks).toString('utf8');
        let json=null;
        try{json=JSON.parse(text);}catch(e){}
        resolve({status:res.statusCode,headers:res.headers,text,json});
      });
    });
    req.on('error',reject);
    if(body) req.write(body);
    req.end();
  });
}
function closeServer(server){
  return new Promise(resolve=>{
    if(!server||!server.listening) return resolve();
    server.close(()=>resolve());
  });
}

const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
const contract=JSON.parse(fs.readFileSync(path.join(__dirname,'module.contract.json'),'utf8'));
test('modern manifest and contract identity align',()=>{
  assert.equal(manifest.schema,'axm.tool-manifest/v1');
  assert.equal(manifest.kind,'product');
  assert.equal(contract.schema,'axm.module-contract/v1');
  assert.equal(contract.id,manifest.id);
  assert.equal(contract.version,manifest.version);
  assert.deepStrictEqual(contract.permissions,manifest.permissions);
});
test('filesystem authority is declared without inventing a Hub permission token',()=>{
  assert.deepStrictEqual(manifest.permissions,[]);
  assert.equal(manifest.risk,'MEDIUM');
  assert(contract.boundaries.writes.every(item=>
    item.startsWith('tools/sandbox/projects/') ||
    item.startsWith('state/disposable-candidate-sandboxes/')
  ));
  assert(contract.boundaries.writes.some(item=>item.startsWith('tools/sandbox/projects/')));
  assert(contract.boundaries.writes.some(item=>item.startsWith('state/disposable-candidate-sandboxes/')));
  assert(contract.boundaries.refuses.includes('arbitrary-filesystem-write'));
  assert(contract.boundaries.refuses.includes('external-browser-origin'));
});
test('Sandbox uses its non-game port and UI sends explicit action intent',()=>{
  const host=fs.readFileSync(path.join(__dirname,'sandbox-server.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert(host.includes("AXM_SANDBOX_PORT || 8815"));
  assert(html.includes("const SANDBOX_PORT = '8815'"));
  assert(html.includes("'x-axm-sandbox-action':'create-project'"));
  assert(!html.includes('/sandbox-api'));
});
test('project id is stable-format axm-prj-*',()=>assert(C.makeProjectId().startsWith('axm-prj-')));
test('two ids never collide (1000 draws)',()=>{const s=new Set();for(let i=0;i<1000;i++)s.add(C.makeProjectId());assert.equal(s.size,1000);});
test('new manifest validates clean',()=>{const v=C.validateManifest(C.newManifest('Test'));assert(v.ok&&v.errors.length===0);});
test('manifest declares bodies, never assumes',()=>{const m=C.newManifest('T');assert(m.bodies&&m.bodies.render==='canvas-2d'&&m.bodies.input==='touch-pointer');});
test('cores are empty adapter seats at alpha',()=>assert.equal(C.newManifest('T').cores.length,0));
test('missing bodies is an ERROR not a fallback',()=>{const m=C.newManifest('T');delete m.bodies;const v=C.validateManifest(m);assert(!v.ok&&v.errors.some(e=>e.includes('never assumed')));});
test('unknown render body stays blocked-honest',()=>{const m=C.newManifest('T');m.bodies.render='holodeck-9';const v=C.validateManifest(m);assert(v.ok&&v.warnings.some(w=>w.includes('BLOCKED-honest')));});
test('unknown keys are preserved and reported',()=>{const m=C.newManifest('T');m.future_thing={x:1};const v=C.validateManifest(m);assert(v.warnings.some(w=>w.includes('future_thing'))&&m.future_thing.x===1);});
test('wrong schema_version is a migration error',()=>{const m=C.newManifest('T');m.schema_version=99;assert.equal(C.validateManifest(m).ok,false);});
test('directory contract requires project.manifest.json',()=>{assert.equal(C.validateProjectDir(['world']).ok,false);assert.equal(C.validateProjectDir(['project.manifest.json']).ok,true);});
test('project form has a visible label and announced result',()=>{
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  assert(/<label\s+for=["']pname["']>Project name<\/label>/i.test(html));
  assert(/id=["']createOut["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i.test(html));
});

let tmp=null,childDir=null,host=null,port=null;
test('host starts against an isolated project root',async()=>{
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-sbx-'));
  childDir=path.join(tmp,'tools','sandbox');
  fs.mkdirSync(childDir,{recursive:true});
  for(const name of ['sandbox-server.js','project-contract.js','index.html']) fs.copyFileSync(path.join(__dirname,name),path.join(childDir,name));
  process.env.AXM_SANDBOX_PORT='0';
  process.env.AXM_WORKSHOP_PORT='8788';
  host=require(path.join(childDir,'sandbox-server.js'));
  if(!host.server.listening) await once(host.server,'listening');
  port=host.server.address().port;
  assert(Number.isInteger(port)&&port>0);
});
test('direct host function writes and discovers one valid portable folder',()=>{
  const result=host.createProject('Forest Test');
  assert(result.ok,result.error);
  const list=host.listProjects();
  assert.equal(list.length,1);
  assert.equal(list[0].valid,true,JSON.stringify(list));
});
test('explicit removal seam removes the project',()=>{
  fs.rmSync(path.join(childDir,'projects','forest-test'),{recursive:true,force:true});
  assert.equal(host.listProjects().length,0);
});
test('external-origin preflight is denied without CORS reflection',async()=>{
  const result=await request(port,{method:'OPTIONS',path:'/api/projects/create',headers:{origin:'https://example.com','access-control-request-method':'POST','access-control-request-headers':'content-type,x-axm-sandbox-action'}});
  assert.equal(result.status,403);
  assert.equal(result.headers['access-control-allow-origin'],undefined);
});
test('declared Workshop-origin preflight is reflected exactly',async()=>{
  const origin='http://127.0.0.1:8788';
  const result=await request(port,{method:'OPTIONS',path:'/api/projects/create',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type,x-axm-sandbox-action'}});
  assert.equal(result.status,204);
  assert.equal(result.headers['access-control-allow-origin'],origin);
  assert(String(result.headers['access-control-allow-headers']).includes('x-axm-sandbox-action'));
});
test('origin-less mutation is denied even with action intent',async()=>{
  const result=await request(port,{method:'POST',path:'/api/projects/create',headers:{'content-type':'application/json','x-axm-sandbox-action':'create-project'},body:JSON.stringify({name:'Denied No Origin'})});
  assert.equal(result.status,403);
  assert.equal(host.listProjects().length,0);
});
test('declared origin without action intent is denied',async()=>{
  const result=await request(port,{method:'POST',path:'/api/projects/create',headers:{origin:'http://127.0.0.1:8788','content-type':'application/json'},body:JSON.stringify({name:'Denied No Action'})});
  assert.equal(result.status,403);
  assert.equal(host.listProjects().length,0);
});
test('external origin is denied even with action intent',async()=>{
  const result=await request(port,{method:'POST',path:'/api/projects/create',headers:{origin:'https://example.com','content-type':'application/json','x-axm-sandbox-action':'create-project'},body:JSON.stringify({name:'Denied External'})});
  assert.equal(result.status,403);
  assert.equal(result.headers['access-control-allow-origin'],undefined);
  assert.equal(host.listProjects().length,0);
});
test('non-JSON and oversized mutations are denied',async()=>{
  const base={origin:'http://127.0.0.1:8788','x-axm-sandbox-action':'create-project'};
  const wrong=await request(port,{method:'POST',path:'/api/projects/create',headers:Object.assign({},base,{'content-type':'text/plain'}),body:'name=wrong'});
  assert.equal(wrong.status,415);
  const large=await request(port,{method:'POST',path:'/api/projects/create',headers:Object.assign({},base,{'content-type':'application/json'}),body:JSON.stringify({name:'x'.repeat(17000)})});
  assert.equal(large.status,413);
  assert.equal(host.listProjects().length,0);
});
test('encoded traversal is refused by the physical path resolver',()=>{
  assert.equal(host.resolveProjectFile('/projects/%2e%2e/projects-evil/secret.txt'),null);
});
test('declared origin plus explicit intent creates exactly one project',async()=>{
  const origin='http://127.0.0.1:8788';
  const result=await request(port,{method:'POST',path:'/api/projects/create',headers:{origin,'content-type':'application/json','x-axm-sandbox-action':'create-project'},body:JSON.stringify({name:'Persisted Test'})});
  assert.equal(result.status,200,result.text);
  assert.equal(result.headers['access-control-allow-origin'],origin);
  assert.equal(result.json&&result.json.folder,'persisted-test');
  assert.equal(host.listProjects().length,1);
});
test('saved project survives a fresh Node process',async()=>{
  await closeServer(host.server);
  const serverPath=path.join(childDir,'sandbox-server.js');
  const script=`const S=require(${JSON.stringify(serverPath)});const rows=S.listProjects();const ok=rows.length===1&&rows[0].folder==='persisted-test'&&rows[0].valid===true;process.stdout.write(JSON.stringify(rows));process.exit(ok?0:1);`;
  const result=spawnSync(process.execPath,['-e',script],{encoding:'utf8',env:Object.assign({},process.env,{AXM_SANDBOX_PORT:'0',AXM_WORKSHOP_PORT:'8788'})});
  assert.equal(result.status,0,(result.stderr||'')+(result.stdout||''));
  assert(result.stdout.includes('persisted-test'));
});
test('explicit removal after restart leaves honest empty state',()=>{
  fs.rmSync(path.join(childDir,'projects','persisted-test'),{recursive:true,force:true});
  assert.equal(host.listProjects().length,0);
});

async function main(){
  try{
    for(const item of tests){
      try{await item.fn();console.log('PASS  '+item.name);pass++;}
      catch(error){console.log('FAIL  '+item.name+' - '+error.message);fail++;}
    }
  }finally{
    await closeServer(host&&host.server);
    if(tmp) fs.rmSync(tmp,{recursive:true,force:true});
  }
  console.log(`\nSandbox Session-1 selftest: ${pass} PASS, ${fail} FAIL`);
  process.exitCode=fail?1:0;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
