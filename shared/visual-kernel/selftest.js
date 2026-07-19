'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Kernel=require('./visual-kernel');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'visual-kernel.tokens.json'),'utf8'));
assert.equal(Kernel.VERSION,registry.version);
assert.deepEqual(Kernel.PROFILES,registry.profiles);
Kernel.PROFILE_NAMES.forEach(name=>{
  const tokens=Kernel.normalize({profile:name});
  assert.equal(tokens.schema,Kernel.SCHEMA);
  assert.equal(Kernel.validate(tokens).status,'PASS',name+' must pass kernel validation');
  assert.ok(Kernel.cssText(tokens).includes('--axm-focus:'));
});
const weak=Kernel.normalize({profile:'dark',colours:{text:'#050810'}});
assert.equal(Kernel.validate(weak).status,'HOLD');
assert.equal(Kernel.cssText({profile:'light'}),Kernel.cssText({profile:'light'}),'CSS export must be deterministic');
console.log('AXM Visual Kernel selftest: PASS (registry parity, three profiles, contrast hold, deterministic CSS)');
