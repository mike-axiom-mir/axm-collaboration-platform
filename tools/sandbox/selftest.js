#!/usr/bin/env node
'use strict';
/* AXM SANDBOX Session-1 selftest — contract + host discovery. Real checks, no fake done. */
const fs=require('fs'),path=require('path'),os=require('os');
const C=require('./project-contract');
let pass=0,fail=0;
function t(name,fn){try{const r=fn();if(r===false)throw new Error('returned false');console.log('PASS  '+name);pass++;}catch(e){console.log('FAIL  '+name+' — '+e.message);fail++;}}

t('project id is stable-format axm-prj-*',()=>C.makeProjectId().startsWith('axm-prj-'));
t('two ids never collide (1000 draws)',()=>{const s=new Set();for(let i=0;i<1000;i++)s.add(C.makeProjectId());return s.size===1000;});
t('new manifest validates clean',()=>{const v=C.validateManifest(C.newManifest('Test'));return v.ok&&v.errors.length===0;});
t('manifest declares bodies, never assumes',()=>{const m=C.newManifest('T');return m.bodies&&m.bodies.render==='canvas-2d'&&m.bodies.input==='touch-pointer';});
t('cores are empty adapter seats at alpha',()=>C.newManifest('T').cores.length===0);
t('missing bodies is an ERROR not a fallback',()=>{const m=C.newManifest('T');delete m.bodies;const v=C.validateManifest(m);return !v.ok&&v.errors.some(e=>e.includes('never assumed'));});
t('unknown render body -> warning, blocked-honest wording',()=>{const m=C.newManifest('T');m.bodies.render='holodeck-9';const v=C.validateManifest(m);return v.ok===true&&v.warnings.some(w=>w.includes('BLOCKED-honest'));});
t('unknown keys preserved and reported, not deleted',()=>{const m=C.newManifest('T');m.future_thing={x:1};const v=C.validateManifest(m);return v.warnings.some(w=>w.includes('future_thing'))&&m.future_thing.x===1;});
t('wrong schema_version is a migration error (W07.05 seat)',()=>{const m=C.newManifest('T');m.schema_version=99;return C.validateManifest(m).ok===false;});
t('directory contract requires project.manifest.json',()=>C.validateProjectDir(['world']).ok===false&&C.validateProjectDir(['project.manifest.json']).ok===true);

// host round-trip in a temp projects dir (real filesystem, cleaned after)
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-sbx-'));
process.env.AXM_SANDBOX_PORT='0';
const srvPath=path.join(__dirname,'sandbox-server.js');
t('host createProject writes a valid portable folder',()=>{
  const src=fs.readFileSync(srvPath,'utf8');
  // reuse module functions against a temp dir by shadowing PROJECTS_DIR via a child copy
  const childDir=path.join(tmp,'tools','sandbox');fs.mkdirSync(childDir,{recursive:true});
  fs.copyFileSync(srvPath,path.join(childDir,'sandbox-server.js'));
  fs.copyFileSync(path.join(__dirname,'project-contract.js'),path.join(childDir,'project-contract.js'));
  fs.writeFileSync(path.join(childDir,'index.html'),'<html></html>');
  const S=require(path.join(childDir,'sandbox-server.js'));
  const r=S.createProject('Forest Test');
  if(!r.ok)throw new Error(r.error);
  const list=S.listProjects();
  if(list.length!==1||!list[0].valid)throw new Error('created project not valid on discovery: '+JSON.stringify(list));
  return true;
});
t('removing the folder removes the project (removal seam)',()=>{
  const childDir=path.join(tmp,'tools','sandbox');
  const S=require(path.join(childDir,'sandbox-server.js'));
  fs.rmSync(path.join(childDir,'projects','forest-test'),{recursive:true,force:true});
  return S.listProjects().length===0;
});
fs.rmSync(tmp,{recursive:true,force:true});

console.log(`\nSandbox Session-1 selftest: ${pass} PASS, ${fail} FAIL`);
process.exit(fail?1:0);
