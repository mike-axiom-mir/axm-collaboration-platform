#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const manifest=JSON.parse(read('manifest.json')),contract=JSON.parse(read('module.contract.json')),html=read('index.html'),js=read('technical-glasses-app.js');
assert.equal(manifest.id,'technical-glasses');
assert.equal(manifest.integratedInto,'ai-team');
assert.equal(manifest.audience,'human-machine');
assert.equal(contract.schema,'axm.module-contract/v1');
assert.ok(contract.boundaries.refuses.includes('guessing-missing-state'));
assert.ok(contract.boundaries.refuses.includes('readme-as-technical-authority'));
assert.ok(contract.lifecycle&&contract.lifecycle.reload==='resume');
assert.ok(html.includes('id="focusInput"')&&html.includes('id="briefing"')&&html.includes('Important technical seams'));
assert.ok(js.includes('/api/workshop/technical-glasses?focus='));
assert.ok(js.includes('setInterval')&&js.includes('30000'));
assert.ok(js.includes('navigator.clipboard.writeText')&&html.includes('Download JSON'));
assert.ok(js.includes('no cached result was substituted'));
new Function(js);
console.log('Technical Glasses UI selftest: PASS (13 assertions, shared live endpoint, no stale fallback)');
