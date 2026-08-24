'use strict';
const assert=require('assert');
const fabric=require('./machine-cheatcode-fabric.js');

const banks=fabric.all();
assert.strictEqual(banks.length,102,'exactly 102 cheatcode banks');
assert.strictEqual(fabric.RULE_COUNT,50,'exactly 50 rules per grammar');
assert.strictEqual(new Set(banks.map(x=>x.bankSha256)).size,102,'unique bank digests');
let total=0;
for(const bank of banks){
  assert.strictEqual(bank.ruleCount,50,`${bank.languageId} rule count`);
  assert.strictEqual(bank.phaseCount,10,`${bank.languageId} phase count`);
  assert.strictEqual(new Set(bank.rules.map(x=>x.id)).size,50,`${bank.languageId} unique rule ids`);
  for(const phase of fabric.PHASES)assert.strictEqual(bank.rules.filter(x=>x.phase===phase).length,5,`${bank.languageId}:${phase}`);
  for(const rule of bank.rules){
    assert(rule.nativeBindings.length>0,`${rule.id} must bind native knowledge`);
    assert.strictEqual(rule.mutationAuthority,false,`${rule.id} mutation authority`);
    assert.strictEqual(rule.authority,'NONE',`${rule.id} authority`);
    assert(Array.isArray(rule.verifierCandidates),`${rule.id} verifier candidates`);
    assert(!/AUTO.*(INSTALL|MUTATE|PROMOTE|CANON)/i.test(rule.next),`${rule.id} unsafe next step`);
  }
  assert.strictEqual(bank.truth.semanticCorrectnessClaimed,false);
  assert.strictEqual(bank.truth.runtimeCorrectnessClaimed,false);
  assert.strictEqual(bank.truth.automaticAction,false);
  assert.strictEqual(bank.truth.authority,'NONE');
  assert.strictEqual(bank.authority.toolExecution,false);
  assert.strictEqual(bank.authority.workspaceMutation,false);
  total+=bank.ruleCount;
}
assert.strictEqual(total,5100,'102 x 50 machine cheatcodes');

const snap=fabric.snapshot();
assert.strictEqual(snap.bankCount,102);
assert.strictEqual(snap.totalRuleCount,5100);
assert(/^[a-f0-9]{64}$/.test(snap.snapshotSha256));

function bindings(lid){return fabric.build(lid).rules.flatMap(x=>x.nativeBindings);}
assert(bindings('rust').includes('borrow semantics'),'Rust bank knows borrow semantics');
assert(bindings('rust').includes('unsafe boundaries'),'Rust bank knows unsafe boundaries');
assert(bindings('helm-templates').includes('template/YAML duality'),'Helm bank knows dual grammar');
assert(bindings('dax').includes('row vs filter context'),'DAX bank knows context semantics');
assert(bindings('vhdl').includes('delta cycles'),'VHDL bank knows delta cycles');

const rust=fabric.evaluate({languageId:'rust',observation:{activeLanguages:['rust'],factCodes:['LIFETIME_CHANGED','VERIFIER_MISSING','HOT_PATH'],semanticSignals:['borrow semantics']}});
assert.strictEqual(rust.result,'CHEATCODE_EVALUATION_READY_NO_ACTION');
assert(rust.matches.some(x=>x.opcode==='SEMANTIC_HAZARD_GUARD'));
assert(rust.matches.some(x=>x.opcode==='REQUIRE_NATIVE_VERIFIER'));
assert(rust.matches.some(x=>x.opcode==='HOT_PATH_SPECIALIZATION'));
assert.strictEqual(rust.authority.toolExecution,false);

const helm=fabric.challenge({activeLanguages:['typescript'],goals:['templated Kubernetes','reusable deployment']});
const helmReport=helm.reports.find(x=>x.languageId==='helm-templates');
assert(helmReport,'Helm should surface for templated Kubernetes');
assert.strictEqual(helmReport.active,false);
assert(helmReport.matches.some(x=>x.opcode==='CROSS_LANGUAGE_OPPORTUNITY'||x.opcode==='ALTERNATIVE_BEFORE_LOCK_IN'));

const dax=fabric.challenge({activeLanguages:['typescript'],goals:['Power BI','business analytics']});
const daxReport=dax.reports.find(x=>x.languageId==='dax');
assert(daxReport,'DAX should surface for Power BI analytics');
assert.strictEqual(daxReport.active,false);

const noise=fabric.challenge({activeLanguages:['typescript'],goals:['responsive frontend'],capabilities:['browser UI'],notes:['layout and accessibility']});
assert(!noise.reports.some(x=>x.languageId==='vhdl'&&!x.active),'VHDL must not volunteer for ordinary frontend architecture text');
assert(!noise.reports.some(x=>x.languageId==='dax'&&!x.active),'DAX must not volunteer without analytics evidence');

console.log(JSON.stringify({ok:true,bankCount:102,rulesPerBank:50,totalRuleCount:5100,phaseCount:10,uniqueBankDigests:new Set(banks.map(x=>x.bankSha256)).size,snapshotSha256:snap.snapshotSha256,rustMatchCount:rust.matchCount,helmDiscoveryMatches:helmReport.matchCount,daxDiscoveryMatches:daxReport.matchCount,authority:'NONE'},null,2));
