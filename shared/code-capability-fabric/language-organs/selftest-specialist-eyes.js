'use strict';
const assert=require('assert');
const fs=require('fs'),path=require('path');
const eyes=require('./specialist-eye-registry.js');
const seam=require('./code-native-discovery-seam.js');
const grammar=require('./grammar-profile-registry.js');
const human=JSON.parse(fs.readFileSync(path.join(__dirname,'human-developer-perspective.json'),'utf8'));

assert.strictEqual(human.schema,'axm.code.human-developer-perspective.v1');
assert.strictEqual(human.status,'TEST');
assert(human.reviewDimensions.length>=8);
assert.strictEqual(human.boundaries.authority,'NONE');
assert.strictEqual(human.boundaries.automaticLanguageSwitch,false);

const all=eyes.all();
assert.strictEqual(all.length,102);
assert.strictEqual(new Set(all.map(x=>x.eyeId)).size,102);
assert.strictEqual(new Set(all.map(x=>x.eyeSha256)).size,102);
for(const eye of all){
  const gp=grammar.getByLanguageId(eye.languageId);
  assert(gp,`grammar ${eye.languageId}`);
  assert.strictEqual(eye.grammarProfileDigest,gp.profileSha256);
  assert.strictEqual(eye.humanPerspectiveDigest,eyes.humanDigest());
  assert(eye.perspective.seesFirst.length>0);
  assert(eye.perspective.opportunitySignals.length>0);
  assert(eye.humanDeveloperLens.nativeQuestions.length>=7);
  assert.strictEqual(eye.discoverySeam.candidateIsDecision,false);
  assert.strictEqual(eye.discoverySeam.reasonInferenceWithoutCallerEvidence,'FORBIDDEN');
  assert.strictEqual(eye.policy.workspaceRead,false);
  assert.strictEqual(eye.policy.workspaceMutation,false);
  assert.strictEqual(eye.policy.toolExecution,false);
  assert.strictEqual(eye.policy.install,false);
  assert.strictEqual(eye.policy.automaticLanguageSwitch,false);
  assert.strictEqual(eye.policy.authority,'NONE');
}

const rustReport=seam.review({
  activeLanguages:['c'],
  goals:['memory safety','safe concurrency','FFI boundary'],
  constraints:['native performance'],
  pressures:['speed','knowledge-gap']
});
assert.strictEqual(rustReport.summary.eyeCount,102);
const rust=rustReport.eyes.find(x=>x.languageId==='rust');
assert.strictEqual(rust.state,'DISCOVERY_CANDIDATE');
assert(rust.matched.opportunities.includes('memory safety'));
assert(rust.declaredPressureReasons.includes('SPEED_PRESSURE_DECLARED'));
assert(rust.declaredPressureReasons.includes('KNOWLEDGE_GAP_DECLARED'));
assert.strictEqual(rust.discovery.candidateIsDecision,false);
assert.strictEqual(rust.authority.languageSwitch,false);

const activeRust=seam.review({activeLanguages:['rust'],risks:['unsafe boundaries','drop order'],gaps:['verification evidence']}).eyes.find(x=>x.languageId==='rust');
assert.strictEqual(activeRust.state,'NATIVE_REVIEW');
assert(activeRust.matched.hazards.length>=1);
assert(activeRust.gapCandidates.includes('SEMANTIC_HAZARD_EXPOSURE'));

const helm=seam.review({activeLanguages:['yaml'],goals:['templated Kubernetes chart packaging'],requirements:['environment overlays']}).eyes.find(x=>x.languageId==='helm-templates');
assert.strictEqual(helm.state,'DISCOVERY_CANDIDATE');
assert(helm.matched.opportunities.length>=2);

const dax=seam.review({activeLanguages:['python'],goals:['Power BI business analytics'],requirements:['tabular model measure with filter context']}).eyes.find(x=>x.languageId==='dax');
assert.strictEqual(dax.state,'DISCOVERY_CANDIDATE');
assert(dax.matched.opportunities.length>=2);

const vhdl=seam.review({activeLanguages:['typescript'],goals:['responsive browser UI'],requirements:['typed frontend architecture']}).eyes.find(x=>x.languageId==='vhdl');
assert.strictEqual(vhdl.state,'NOT_RELEVANT');

const noPressure=seam.review({goals:['memory safety','safe concurrency']}).eyes.find(x=>x.languageId==='rust');
assert.deepStrictEqual(noPressure.declaredPressureReasons,[]);

const snap=eyes.snapshot();
assert.strictEqual(snap.eyeCount,102);
assert(/^[a-f0-9]{64}$/.test(snap.snapshotSha256));
assert(/^[a-f0-9]{64}$/.test(rustReport.reportSha256));
assert.strictEqual(rustReport.summary.automaticAction,false);
assert.strictEqual(rustReport.summary.reasonInferenceWithoutCallerEvidence,'FORBIDDEN');
assert.strictEqual(rustReport.summary.authority,'NONE');

console.log(JSON.stringify({
  ok:true,
  humanReviewDimensions:human.reviewDimensions.length,
  specialistEyeCount:all.length,
  uniqueEyeDigests:new Set(all.map(x=>x.eyeSha256)).size,
  rustDiscoveryState:rust.state,
  helmDiscoveryState:helm.state,
  daxDiscoveryState:dax.state,
  eyeSnapshotSha256:snap.snapshotSha256,
  authority:'NONE'
},null,2));
