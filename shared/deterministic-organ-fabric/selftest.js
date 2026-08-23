'use strict';

const assert = require('assert');
const Fabric = require('./index.js');
const SelectedRouteOrgan = require('./selected-verification-route-organ.js');
const runtimeContract = require('./runtime-contract.json');
const metricProfile = require('./metric-profiles/balanced-v1.json');

let checks = 0;
function check(condition, message) { assert(condition, message); checks += 1; }
function objectSchemasClosed(value) { if (Array.isArray(value)) return value.every(objectSchemasClosed); if (!value || typeof value !== 'object') return true; if (value.type === 'object' && value.additionalProperties !== false) return false; return Object.keys(value).every(function (key) { return objectSchemasClosed(value[key]); }); }

for (const pack of Fabric.loadPacks()) {
  check(Fabric.validatePack(pack).ok, pack.id + ' field pack validates');
  const intent = Fabric.sealIntent(pack.exampleIntent, pack);
  check(Fabric.validateIntent(intent, pack).ok, pack.id + ' example intent validates');
  const run = Fabric.generateCandidates(intent, pack);
  check(run.status === 'COMPLETE' && run.candidates.length === 3 && run.failures.length === 0, pack.id + ' produces three candidates');
  for (const candidate of run.candidates) {
    check(candidate.evaluation.status === 'VALID', candidate.package.id + ' passes hard gates');
    const expectedFiles=pack.routeTokenRegistryRef?16:15;
    check(Object.keys(candidate.files).length === expectedFiles && Fabric.verifyPackage(candidate).ok, candidate.package.id + ' is a verified bounded package');
  }
}

check(Fabric.digest('abc') === 'sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 implementation matches known vector');
const runtimeCore=JSON.parse(JSON.stringify(runtimeContract));delete runtimeCore.digest;check(Fabric.digest(runtimeCore)===runtimeContract.digest&&runtimeContract.digest===Fabric.RUNTIME_DIGEST,'runtime contract digest binds declared semantics');
const metricCore=JSON.parse(JSON.stringify(metricProfile));delete metricCore.digest;check(Fabric.digest(metricCore)===metricProfile.digest&&metricProfile.digest===Fabric.METRIC_PROFILE.digest,'metric profile digest binds exact weights');
check(Object.values(Fabric.METRIC_PROFILE.weights).reduce(function(sum,value){return sum+value;},0) === 100, 'metric weights total 100');
check(Fabric.parseSentence('completely unknown orbit', Fabric.loadPacks()).draft === null, 'unknown controlled sentence stops before generation');
['organ-archive-connection-plan','organ-archive-receiver-acknowledgement','organ-archive-connection-receipt','organ-archive-connection-result','organ-supersession-receipt','verification-route-token-registry','verification-route-plan','verification-spine-prefill','trusted-verification-route-organ','trusted-verification-route-output','trusted-creative-production-route-input','trusted-creative-production-route-organ','trusted-creative-production-route-output'].forEach(function(name){const schema=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'schemas',name+'.schema.json'),'utf8'));check(schema.$id==='axm.'+name+'/v1'&&objectSchemasClosed(schema),name+' schema is identity-bound and closed at every object node');});
const registry=require('./verification-route-token-registry.json'),registryCore=JSON.parse(JSON.stringify(registry));delete registryCore.registryDigest;check(Fabric.digest(registryCore)===registry.registryDigest&&Fabric.canonicalJson(registry)===Fabric.canonicalJson(Fabric.VERIFICATION_ROUTE_TOKEN_REGISTRY),'verification route registry digest and runtime bytes agree');
const selectedInspection=SelectedRouteOrgan.inspect(),selectedOutput=SelectedRouteOrgan.plan({changeType:'code',risk:4,affectedSurfaces:['organ-runtime','fabric-archive','mirror-passive-receiver']});
check(selectedInspection.packageVerified&&selectedInspection.packageDigest==='sha256:874399d704bf7e68bb1fdbcf4b16609eb5adb262fab8e310c90710bb1106385c','selected balanced organ rebuilds the admitted package exactly');
check(SelectedRouteOrgan.verify(selectedOutput).ok&&selectedOutput.plan.output.route.includes('archive-reload')&&selectedOutput.plan.output.route.includes('sender-receiver-parity'),'selected organ output rebuilds and covers persistence plus transport surfaces');
check(selectedOutput.evidenceDeskPrefill.observations.every(function(row){return row.verdict==='UNKNOWN';})&&selectedOutput.verificationSpinePrefill.claims.every(function(row){return row.status==='UNKNOWN';}),'selected organ prefills preserve UNKNOWN until native evidence exists');
check(!selectedOutput.authority.generatedCodeExecuted&&!selectedOutput.authority.checksExecuted&&!selectedOutput.authority.wroteState&&!selectedOutput.authority.installed&&!selectedOutput.authority.promoted&&!selectedOutput.authority.canonChanged,'selected organ stays inside its authority ceiling');

console.log('Deterministic Organ Fabric shared selftest PASS · ' + checks + ' checks');
