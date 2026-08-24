'use strict';
const assert=require('assert');
const registry=require('./grammar-profile-registry.js');
const organs=require('./registry.js');
const profiles=registry.all();
assert.strictEqual(profiles.length,102);
assert.strictEqual(organs.all().length,102);
assert.strictEqual(new Set(profiles.map(x=>x.profileSha256)).size,102);
for(const organ of organs.all()){
  const p=registry.getByLanguageId(organ.languageId);
  assert(p,`missing profile ${organ.languageId}`);
  assert.strictEqual(p.organId,organ.organId);
  assert.strictEqual(p.organDigest,organ.sha256);
  assert(p.grammar.constructs.length>0,`constructs ${organ.languageId}`);
  assert(p.analysis.semanticHazards.length>0,`hazards ${organ.languageId}`);
  assert(p.verification.focus.length>0,`verification ${organ.languageId}`);
  assert.strictEqual(p.rewritePolicy.blindTextRewrite,'FORBIDDEN');
  assert.strictEqual(p.rewritePolicy.unknownGrammarNode,'HOLD');
  assert.strictEqual(p.verification.runtimeCorrectnessClaimed,false);
  assert.strictEqual(p.verification.authority,'NONE');
  const mainPlan=organs.plan({organId:organ.organId,requestedStages:['parse','understand','impact','refactor','verificationAdapters']});
  assert(mainPlan.result.startsWith('PLAN_READY_'),`main plan ${organ.languageId}`);
  assert.strictEqual(mainPlan.grammarProfileDigest,p.profileSha256,`main grammar digest ${organ.languageId}`);
  assert.strictEqual(mainPlan.grammarKnowledgeVersion,p.knowledgeVersion,`main grammar version ${organ.languageId}`);
  assert.deepStrictEqual(mainPlan.grammarSpecific.constructs,p.grammar.constructs,`main constructs ${organ.languageId}`);
  assert.deepStrictEqual(mainPlan.grammarSpecific.semanticHazards,p.analysis.semanticHazards,`main hazards ${organ.languageId}`);
  assert.deepStrictEqual(mainPlan.grammarSpecific.verificationFocus,p.verification.focus,`main verification ${organ.languageId}`);
  assert(mainPlan.evidenceRequired.includes('grammarProfileDigest'));
  assert.strictEqual(mainPlan.authority.toolExecution,false);
}
const expected={
  python:['decorator','comprehension','context manager','async','match'],
  rust:['borrow','lifetime','trait','unsafe'],
  sql:['CTE','join','window','transaction'],
  'helm-templates':['template action','pipeline','YAML node'],
  dax:['CALCULATE','row/filter context'],
  vhdl:['entity','architecture','process','signal'],
  systemverilog:['always_ff','assertion','constraint','covergroup'],
  'plc-structured-text':['FUNCTION_BLOCK','timer','counter'],
  abap:['internal table','field-symbol','Open SQL'],
  'tree-sitter-query':['capture','predicate','field'],
};
for(const [lid,needles] of Object.entries(expected)){
  const p=registry.getByLanguageId(lid);const hay=p.grammar.constructs.join('|');
  for(const n of needles)assert(hay.includes(n),`${lid} missing ${n}`);
}
const rustPlan=registry.plan({languageId:'rust',operation:'refactor'});
assert.strictEqual(rustPlan.result,'GRAMMAR_SPECIFIC_PLAN_READY_EXECUTION_HELD');
assert(rustPlan.analysis.semanticHazards.includes('unsafe boundaries'));
assert.strictEqual(rustPlan.authority.toolExecution,false);
const publicRust=organs.grammarPlan({languageId:'rust',operation:'impact'});
assert.strictEqual(publicRust.profileDigest,registry.getByLanguageId('rust').profileSha256);
assert(publicRust.grammar.constructs.includes('borrow'));
assert.strictEqual(organs.grammarProfile('dax').languageId,'dax');
const snap=registry.snapshot(),publicSnap=organs.grammarSnapshot();
assert.strictEqual(snap.profileCount,102);
assert.strictEqual(publicSnap.snapshotSha256,snap.snapshotSha256);
assert(/^[a-f0-9]{64}$/.test(snap.snapshotSha256));
console.log(JSON.stringify({ok:true,profileCount:profiles.length,mainPlannerGrammarCoverage:102,uniqueProfileDigests:new Set(profiles.map(x=>x.profileSha256)).size,snapshotSha256:snap.snapshotSha256,authority:'NONE'},null,2));
