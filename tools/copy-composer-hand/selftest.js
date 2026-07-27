#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Core = require('./copy-composer-core');
let pass = 0;
function test(name, fn) { try { fn(); pass += 1; console.log('PASS ' + name); } catch (error) { console.error('FAIL ' + name + '\n  ' + error.stack); process.exitCode = 1; } }
const prompt = 'make an inspiring quote for axm';
test('exact Mike request produces an AXM quote', () => { const result = Core.compose({ prompt }); assert.equal(result.schema, 'axm.copy.candidate/v1'); assert(result.text.includes('AXM')); assert(result.text.length <= 220); });
test('same request replays byte-identically', () => { assert.deepEqual(Core.compose({ prompt }), Core.compose({ prompt })); });
test('receipt proves zero network model and write authority', () => { const receipt = Core.compose({ prompt }).receipt; assert.equal(receipt.outcome, 'PASS'); assert.equal(receipt.networkCalls, 0); assert.equal(receipt.modelCalls, 0); assert.deepEqual(receipt.writes, []); assert.equal(receipt.promotionAuthority, 'NONE'); });
test('slogan request uses the shorter grammar', () => { const result = Core.compose({ prompt:'write an AXM slogan' }); assert.equal(result.request.kind, 'slogan'); assert(result.text.length < 80); });
test('empty prompt fails honestly', () => { assert.throws(() => Core.compose({ prompt:' ' }), /prompt required/); });
if (!process.exitCode) console.log('\n' + pass + ' PASS · 0 FAIL · copy-composer ' + Core.VERSION);
