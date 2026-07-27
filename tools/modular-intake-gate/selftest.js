'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const dir=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),contract=JSON.parse(fs.readFileSync(path.join(dir,'module.contract.json'),'utf8')),html=fs.readFileSync(path.join(dir,'index.html'),'utf8'),app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
assert.equal(manifest.id,'modular-intake-gate');assert.equal(contract.id,manifest.id);assert.ok(manifest.permissions.includes('component.promote'));assert.ok(contract.boundaries.refuses.includes('unknown-family-coercion'));assert.ok(html.includes('Unknown categories stay visible'));assert.ok(app.includes('PROMOTE REVIEWED PIECE'));console.log('modular intake gate self-test passed');
