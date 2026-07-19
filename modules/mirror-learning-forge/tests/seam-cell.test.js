'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../core/seam-cell');
const candidate={status:'APPROVED',permission:{training_allowed:true},disconfirming_test:'test'};
const evaluation={summary:{semantic_overlap:.5,next_token_accuracy:.5,unknown_rate:.1}};
test('held-out leakage is critical and rejected',()=>{const v=S.inspect({candidate,episodes:[{}],baselineEvaluation:evaluation,challengerEvaluation:{summary:{semantic_overlap:.7,next_token_accuracy:.6,unknown_rate:.1}},trainingTexts:['same'],heldOutTexts:['same','other'],protectedResults:[]});assert.equal(v.verdict,'REJECT');assert.ok(v.seams.some(x=>x.type==='lineage'&&x.severity==='critical'));});
test('protected boundary regression is critical',()=>{const v=S.inspect({candidate,episodes:[{}],baselineEvaluation:evaluation,challengerEvaluation:{summary:{semantic_overlap:.7,next_token_accuracy:.6,unknown_rate:.1}},trainingTexts:['a'],heldOutTexts:['b','c'],protectedResults:[{probe_id:'p',pass:false}]});assert.equal(v.verdict,'REJECT');});
