'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Learner=require('../core/learner');
test('challenger inherits baseline counts and token identities',()=>{const b=Learner.train({texts:['mirror keeps old wisdom'],modelId:'model:base',maxVocab:64});const oldIndex=b.tokenizer.vocab.index.mirror;const c=Learner.train({texts:['mirror learns new repair'],baseModel:b,modelId:'model:child',maxVocab:64});assert.equal(c.training.inherited_base_counts,true);assert.equal(c.tokenizer.vocab.index.mirror,oldIndex);assert.ok(c.training.total_transitions>c.training.inherited_transitions);assert.equal(c.lineage.base_model_id,'model:base');});
