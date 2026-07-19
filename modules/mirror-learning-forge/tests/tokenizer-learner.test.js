'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../core/tokenizer'),L=require('../core/learner');
test('vocabulary is bounded and owns special tokens',()=>{const vocab=T.buildVocabulary([Array.from({length:800},(_,i)=>'w'+i).join(' ')],512);assert.equal(vocab.tokens.length,512);assert.deepEqual(vocab.tokens.slice(0,4),['<PAD>','<UNK>','<BOS>','<EOS>']);});
test('tiny model trains, hashes and generates locally',()=>{const model=L.train({texts:['mirror holds the claim until evidence','mirror names the seam and waits'],modelId:'model:test'});assert.equal(model.schema,'axm.mirror.token-model/v1');assert.ok(model.hash.length===64);assert.match(L.generate(model,'mirror',{maxTokens:8}),/mirror|holds|names/);});
test('evaluation returns held-out metrics',()=>{const model=L.train({texts:['hold the claim and name the seam'],modelId:'model:test'});const ev=L.evaluate(model,[{input:'hold the claim',expected:'and name the seam'}]);assert.equal(ev.summary.case_count,1);assert.ok(Number.isFinite(ev.summary.perplexity));});
