'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../core/growth-governor');
function ep(id,typeText='same'){return{episode_id:id,candidate_id:'candidate:a',input:typeText,expected:'hold until evidence',held_out_variants:[{expected:'hold'}],evidence_refs:['e'],uncertainty_expectation:'u',repair_example:'r'}}
test('growth governor deduplicates and caps curriculum',()=>{const candidates={'candidate:a':{lesson_type:'repair',counterevidence:['c'],disconfirming_test:'t'}};const r=G.select({episodes:[ep('e1'),ep('e2'),ep('e3','different')],candidates,maxEpisodes:2});assert.equal(r.selection_receipt.input_count,3);assert.equal(r.selection_receipt.deduplicated_count,2);assert.equal(r.selection_receipt.selected_count,2);});
