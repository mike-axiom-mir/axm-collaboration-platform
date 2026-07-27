#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),manifest=JSON.parse(read('manifest.json')),contract=JSON.parse(read('module.contract.json')),html=read('index.html'),css=read('styles.css'),js=read('app.js');
assert.equal(manifest.schema,'axm.tool-manifest/v1');assert.equal(manifest.kind,'product');assert.equal(manifest.id,'sensorium-lab');assert.equal(manifest.integratedInto,'technical-glasses');assert.deepEqual(manifest.permissions,[]);assert.equal(contract.schema,'axm.module-contract/v1');assert.deepEqual(contract.lifecycle,{state_owner:'filesystem',reload:'reset',disconnect:'graceful-degrade',cleanup:'automatic'});
['canonical-state-write','authority-storage','expired-authority-restore','automatic-action','synthetic-state-as-proof'].forEach(item=>assert.ok(contract.boundaries.refuses.includes(item)));
assert.ok(html.includes('id="senseGrid"')&&html.includes('id="rawBytes"')&&html.includes('id="routeCounts"')&&html.includes('id="holdSummary"')&&html.includes('Simulate missing adapter')&&html.includes('Simulate failed observation'));
assert.ok(js.includes('/shared/sensorium/lab-state.json')&&js.includes('No cached state was substituted')&&js.includes("row.executorStatus==='EXECUTABLE'")&&js.includes("filter==='holds'")&&js.includes('state.knownHolds')&&js.includes('safety checks')&&!js.includes('negative proofs'));assert.ok(js.includes("STORE='axm.sensorium-lab.config.v1'")&&!js.includes('leaseId:localStorage'));assert.ok(css.includes('@media(max-width:520px)')&&css.includes('@media(max-width:850px)'));new Function(js);
console.log('Sensorium Lab selftest: PASS - observe-only, responsive, synthetic states distinct');
