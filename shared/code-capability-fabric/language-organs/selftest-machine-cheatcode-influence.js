'use strict';
const assert=require('assert');
const fabric=require('./machine-cheatcode-fabric.js');
const mesh=require('./machine-cheatcode-influence-mesh.js');

const snap=mesh.meshSnapshot();
assert.strictEqual(snap.meshCount,102,'102 grammar influence meshes');
assert.strictEqual(snap.totalNodeCount,5100,'50 nodes x 102 grammars');
assert(snap.totalEdgeCount>5100,'mesh must have more than ring-only connectivity');
assert(/^[a-f0-9]{64}$/.test(snap.snapshotSha256));

for(const bank of fabric.all()){
  const m=mesh.buildMesh(bank.languageId);
  assert.strictEqual(m.nodeCount,50,`${bank.languageId} node count`);
  assert(m.edgeCount>=50,`${bank.languageId} minimum connected edge count`);
  assert.strictEqual(m.truth.influenceIsActivation,false);
  assert.strictEqual(m.truth.influenceIsEvidence,false);
  assert.strictEqual(m.truth.moreInfluenceIsNotMoreTruth,true);
  assert.strictEqual(m.authority.toolExecution,false);
  assert.strictEqual(m.authority.workspaceMutation,false);
  for(const node of m.nodes){
    assert(node.outDegree>0,`${bank.languageId}:${node.ruleId} outDegree`);
    assert(node.inDegree>0,`${bank.languageId}:${node.ruleId} inDegree`);
  }
  for(const edge of m.edges){
    assert.notStrictEqual(edge.from,edge.to,'no self edge');
    assert(edge.weight>0,'positive influence weight');
    assert.strictEqual(edge.truthEffect,'NONE');
    assert.strictEqual(edge.activationEffect,'SOFT_CANDIDATE_ONLY');
  }
}

const rust=mesh.propagate({languageId:'rust',observation:{activeLanguages:['rust'],factCodes:['LIFETIME_CHANGED','VERIFIER_MISSING','HOT_PATH'],semanticSignals:['borrow semantics']}});
assert.strictEqual(rust.result,'INFLUENCE_REPORT_READY_NO_ACTION');
assert(rust.hardActivationCount>0,'Rust hard seeds');
assert(rust.influenceCandidateCount>0,'Rust soft influence candidates');
assert.strictEqual(rust.truth.softInfluenceRequiresEvidence,true);
assert.strictEqual(rust.truth.influenceDoesNotUpgradeConfidence,true);
assert.strictEqual(rust.authority.toolExecution,false);
const hardIds=new Set(rust.hardActivations.map(x=>x.ruleId));
for(const c of rust.influenceCandidates){
  assert(!hardIds.has(c.ruleId),'soft candidate cannot duplicate hard activation');
  assert(c.depth>=1&&c.depth<=mesh.MAX_DEPTH,'bounded propagation depth');
  assert.strictEqual(c.state,'INFLUENCE_CANDIDATE_REQUIRES_EVIDENCE');
  assert.strictEqual(c.truthEffect,'NONE');
  assert.strictEqual(c.authority,'NONE');
  assert.strictEqual(new Set(c.path).size,c.path.length,'no loop inside influence path');
}

const helm=mesh.propagate({languageId:'helm-templates',observation:{activeLanguages:['helm-templates'],factCodes:['PUBLIC_SURFACE_CHANGED','GENERATED_OUTPUT_CHANGED','VERIFICATION_REQUIRED'],semanticSignals:['template/YAML duality']}});
assert(helm.hardActivationCount>0);
assert(helm.influenceCandidates.some(x=>['verification','debugging','discovery','dependencies'].includes(x.phase)),'Helm should cross-pollinate review phases');

const dax=mesh.propagate({languageId:'dax',observation:{activeLanguages:['dax'],factCodes:['BLANK_SEMANTICS','QUERY_EFFECT_CHANGED','VERIFIER_MISSING'],semanticSignals:['row vs filter context']}});
assert(dax.hardActivationCount>0);
assert(dax.influenceCandidateCount>0);

const quiet=mesh.propagate({languageId:'vhdl',observation:{activeLanguages:['typescript'],goals:['responsive frontend'],notes:['layout accessibility browser UI']}});
assert.strictEqual(quiet.hardActivationCount,0,'inactive unrelated VHDL has no hard seed');
assert.strictEqual(quiet.influenceCandidateCount,0,'no seed means no speculative cascade');

console.log(JSON.stringify({ok:true,meshCount:snap.meshCount,totalNodeCount:snap.totalNodeCount,totalEdgeCount:snap.totalEdgeCount,snapshotSha256:snap.snapshotSha256,rustHard:rust.hardActivationCount,rustSoft:rust.influenceCandidateCount,helmHard:helm.hardActivationCount,helmSoft:helm.influenceCandidateCount,daxHard:dax.hardActivationCount,daxSoft:dax.influenceCandidateCount,authority:'NONE'},null,2));
