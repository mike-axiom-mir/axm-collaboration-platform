'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../core/coding-foundations');
test('bounded JavaScript function passes static contract with tests described',()=>{const r=C.grade({language:'javascript',code:'function holdClaim(record){ if(!record){ return {status:"HOLD"}; } return {status:"CANDIDATE"}; }',contract:{expected_functions:['holdClaim'],require_tests:true,require_error_handling:true,require_explicit_return:true},test_descriptions:['null returns HOLD','record returns CANDIDATE']});assert.equal(r.verdict,'PASS');assert.equal(r.tests.executed,false);});
test('syntax errors are rejected without execution',()=>{const r=C.grade({language:'javascript',code:'function broken( { return 1; }',contract:{expected_functions:['broken']}});assert.equal(r.verdict,'REJECT');assert.equal(r.syntax.pass,false);});
test('forbidden authority access is rejected',()=>{const r=C.grade({language:'javascript',code:"const fs=require('fs'); function x(){return fs.readFileSync('a')} ",contract:{expected_functions:['x']}});assert.equal(r.verdict,'REJECT');assert.ok(r.safety.hits.length);});
test('coding curriculum preserves repair and migration stages',()=>{const rows=C.curriculum();assert.ok(rows.some(x=>x.skill==='repair_bug'));assert.ok(rows.some(x=>x.skill==='version_migration'));});
