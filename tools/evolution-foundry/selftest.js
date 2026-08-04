#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
let pass = 0;
function test(name, fn) { try { fn(); pass += 1; console.log('PASS ' + name); } catch (error) { console.error('FAIL ' + name + '\n  ' + error.stack); process.exitCode = 1; } }
function read(name) { return fs.readFileSync(path.join(__dirname, name), 'utf8'); }
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
test('manifest uses the current product schema', () => { assert.equal(manifest.schema, 'axm.tool-manifest/v1'); assert.equal(manifest.kind, 'product'); });
test('manifest and contract permissions agree', () => assert.deepEqual(manifest.permissions, contract.permissions));
test('contract declares stateless aggregator lifecycle', () => assert.deepEqual(contract.lifecycle, { state_owner: 'none', reload: 'reset', disconnect: 'graceful-degrade', cleanup: 'not-applicable' }));
test('parent has no permissions', () => assert.equal(contract.permissions.length, 0));
test('parent refuses a parent-owned heartbeat', () => assert(contract.boundaries.refuses.includes('parent-owned-heartbeat')));
test('parent reads but does not write child or body state', () => { const js = read('app.js'); assert(js.includes("read('axm.governed-evolution-lab.v1')")); assert(js.includes("read('axm.asset-fabric.v1')")); assert(js.includes("fetch('/api/body-pulse')")); assert(!js.includes('localStorage.setItem')); assert(!js.includes("method: 'POST'")); });
test('direction, body and both child routes are visible', () => { const html = read('index.html'); assert(html.includes('../workshop-direction/index.html')); assert(html.includes('../body-pulse/index.html')); assert(html.includes('../governed-evolution-lab/index.html')); assert(html.includes('../asset-fabric/index.html')); });
if (!process.exitCode) console.log('\n' + pass + ' PASS · 0 FAIL · evolution-foundry');
