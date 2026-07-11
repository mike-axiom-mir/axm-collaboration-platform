#!/usr/bin/env node
'use strict';
const Core=require('./forge-core.js'), Machine=require('./machine.js'), Zip=require('./zip-store.js');
let pass=0,fail=0;function test(name,fn){try{const r=fn();if(r&&typeof r.then==='function')return r.then(()=>{pass++;console.log('PASS '+name);},e=>{fail++;console.log('FAIL '+name+' — '+e.message);});pass++;console.log('PASS '+name);}catch(e){fail++;console.log('FAIL '+name+' — '+e.message);}}
function assert(v,m){if(!v)throw new Error(m||'assertion failed');}
const seed={id:'mike.demo-tool',name:'Demo Tool',kind:'foundation-tool',purpose:'Test a bounded draft.',primary_output:'A local note.',capabilities:['storage','gate'],boundaries:['No network','No installation'],risk:'LOW'};
(async()=>{
test('SHA-256 known vector',()=>assert(Core.sha256('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'));
test('valid draft passes',()=>assert(Core.validateDraft(seed).ok));
test('missing boundary fails',()=>assert(!Core.validateDraft(Object.assign({},seed,{boundaries:[]})).ok));
test('invalid id fails',()=>assert(!Core.validateDraft(Object.assign({},seed,{id:'A'})).ok));
test('fingerprint is deterministic',()=>assert(Core.fingerprintDraft(seed)===Core.fingerprintDraft(seed)));
test('fingerprint changes with purpose',()=>assert(Core.fingerprintDraft(seed)!==Core.fingerprintDraft(Object.assign({},seed,{purpose:'changed'}))));
const built=Core.buildPackage(seed,{foundationSource:'/* foundation */'});
test('foundation package renders',()=>assert(built.ok&&built.files['manifest.json']&&built.files['axm-foundation.js']));
test('generated status is experimental',()=>assert(JSON.parse(built.files['manifest.json']).status==='EXPERIMENTAL'));
test('package says install not performed',()=>assert(built.install.performed===false));
const dual=Core.buildPackage(Object.assign({},seed,{id:'mike.dual',kind:'dual-door-tool'}),{foundationSource:'/* foundation */'});
test('dual door carries machine adapter',()=>assert(dual.files['machine.js']&&dual.files['index.html'].includes('axm-hub-module.js')));
const zip=Zip.build(built.files,built.draft.id);
test('zip has local header',()=>assert(zip[0]===0x50&&zip[1]===0x4b&&zip[2]===0x03&&zip[3]===0x04));
await test('machine refuses missing gate',async()=>{const r=await Machine.run({action:'templates.list'},{});assert(r.refused);});
await test('machine obeys denied gate',async()=>{const r=await Machine.run({action:'templates.list'},{authorize:async()=>({allow:false,reason:'test deny'})});assert(r.refused&&r.reason==='test deny');});
await test('machine creates same normalized draft',async()=>{const r=await Machine.run({action:'draft.create',input:seed},{authorize:async()=>({allow:true})});assert(r.ok&&Core.stable(r.draft)===Core.stable(Core.newDraft(seed)));});
await test('machine cannot install',async()=>{const r=await Machine.run({action:'install',input:{}},{authorize:async()=>({allow:true})});assert(r.refused);});
console.log('\n'+pass+' PASS · '+fail+' FAIL');process.exit(fail?1:0);
})();
