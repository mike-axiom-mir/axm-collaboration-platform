#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Fabric = require('../shared/capability-fabric');
const Registry = require('../shared/capability-fabric/builder-registry');
const Specialist = require('../shared/code-capability-fabric/code-specialist-capability-builder-v1');

const EXPECTED = Object.freeze({
  builder: 'sha256:501e7ac2c984beec72a99dddfb576cd0d6b2899787d4a19881a59613e0f2b973',
  recipe: 'sha256:6e947f83cdd83775d1182165fc67f8797c56497875de94d31054febff318f69a',
  catalog: 'sha256:7557f514bfb85f987e91c1ad06c5ffb1f69de657f6ddf7372c543e958a232425',
  directPackage: 'sha256:96c5eb573b9a86eef486cf5189bdabe7fa3eebc2140a5737d377211d4337c4b4',
  profile: 'sha256:2eaf846070b5673852a8af204c38c61adcce7804de41f4f6acefaddb678d1cc3',
  profileCatalog: 'sha256:060deca3775d440c4b515a9706fbbad060908b24d20ceb38398a004174da4ffb',
  specialistPackage: 'sha256:de9fd061bf6bada9292da5c2fa6a4743962b666ac7502deda08d0450370cb3a2'
});

let passed = 0;
function check(value, label) {
  assert(value, label);
  passed += 1;
  process.stdout.write('PASS ' + label + '\n');
}
function safeCleanup(root) {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('axm-record-query-v1-proof-')) {
    throw new Error('temporary cleanup boundary refused');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function main() {
  const catalog = Fabric.loadCatalog();
  const recipe = catalog.recipes.find((row) => row.id === 'bounded-record-query');
  const builder = Registry.describe('bounded-record-query-v1');
  check(catalog.catalogDigest === EXPECTED.catalog && recipe.recipeDigest === EXPECTED.recipe && recipe.builderDigest === EXPECTED.builder, 'catalog, recipe, and builder lineage are exact');
  check(builder.status === Registry.ACTIVE && builder.implementationDigest === EXPECTED.builder, 'record-query builder is source-reviewed and active');

  const request = Fabric.sealRequest(recipe.exampleRequest, true);
  const first = Fabric.build(request, catalog);
  const second = Fabric.build(request, catalog);
  const candidate = first.candidates[0];
  check(first.status === 'COMPLETE' && first.candidates.length === 1 && first.generatedCodeExecuted === false, 'one detached candidate is generated without execution');
  check(Fabric.canonicalJson(first) === Fabric.canonicalJson(second), 'identical input rebuild is byte-identical');
  check(Fabric.verifyCandidate(candidate).ok && candidate.package.packageDigest === EXPECTED.directPackage, 'exact direct candidate bytes and package lineage verify');
  check(Object.values(candidate.package.authority).every((value) => value === false), 'direct candidate receives no permission or lifecycle authority');

  const specialistRequest = Specialist.buildRecordQueryExampleRequest();
  const specialistResult = Specialist.generate(specialistRequest);
  check(specialistResult.status === 'COMPLETE_DETACHED_CANDIDATE' && Specialist.verify(specialistResult, specialistRequest).pass, 'exact Code Specialist lane emits and independently rebuilds one candidate');
  check(specialistResult.specialistContext.buildProfileRef.sha256 === EXPECTED.profile && specialistResult.buildProfileCatalogRef.sha256 === EXPECTED.profileCatalog, 'specialist profile and profile-catalog lineage are exact');
  check(specialistResult.detachedCandidate.package.packageDigest === EXPECTED.specialistPackage && specialistResult.recipeRef.digest === EXPECTED.recipe, 'specialist candidate binds exact recipe and candidate bytes');
  check(specialistResult.resourceObservation.candidateExecuted === false && specialistResult.resourceObservation.generatedSelftestExecuted === false && specialistResult.resourceObservation.processesSpawned === 0, 'specialist Fabric executes no candidate, selftest, or process');
  check(specialistResult.truth.candidateDetached === true && specialistResult.truth.installed === false && specialistResult.truth.integrated === false && specialistResult.truth.published === false && specialistResult.truth.promoted === false && specialistResult.truth.canonChanged === false, 'specialist candidate remains detached with no lifecycle authority');

  const source = candidate.files['capability.js'];
  const selftest = candidate.files['selftest.js'];
  check(['inspectRuntime', 'PREDICATE_OPERATOR_UNSUPPORTED', 'ORDER_FIELD_DUPLICATE', 'SELECT_FIELD_DUPLICATE', 'INPUT_BYTES_EXCEEDED', 'OUTPUT_BYTES_EXCEEDED', 'ORIGINAL_INPUT_INDEX', 'UTF16_CODE_UNIT'].every((needle) => source.includes(needle)), 'runtime declares typed query, deterministic ordering, and byte refusals');
  check(!source.includes('JSON.stringify(input)') && !/\bBuffer\b/.test(source), 'runtime measures only validated safe copies without host Buffer');
  check(!/require\(['"](?:fs|node:fs|child_process|node:child_process|http|https|net|tls|dgram)['"]\)|\bfetch\s*\(|provider\.call|process\.(?:env|cwd)|Date\.now|Math\.random|new Function|\beval\s*\(/.test(source), 'runtime contains no filesystem, process, network, provider, environment, clock, randomness, or dynamic-code surface');
  check(['getterRead', 'PREDICATE_OPERATOR_UNSUPPORTED', 'ORDER_FIELD_DUPLICATE', 'RECORDS_LIMIT_EXCEEDED', 'INPUT_BYTES_EXCEEDED'].every((needle) => selftest.includes(needle)), 'emitted adversaries cover accessors, query ambiguity, record limits, and input bytes');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-record-query-v1-proof-'));
  try {
    const sourceRoot = path.join(root, 'detached-source');
    const executionRoot = path.join(root, 'trusted-execution-copy');
    fs.mkdirSync(sourceRoot);
    fs.mkdirSync(executionRoot);
    fs.writeFileSync(path.join(sourceRoot, 'capability.js'), source, { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(path.join(sourceRoot, 'selftest.js'), selftest, { encoding: 'utf8', flag: 'wx' });
    fs.copyFileSync(path.join(sourceRoot, 'capability.js'), path.join(executionRoot, 'capability.js'), fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(sourceRoot, 'selftest.js'), path.join(executionRoot, 'selftest.js'), fs.constants.COPYFILE_EXCL);
    check(path.relative(sourceRoot, executionRoot).startsWith('..' + path.sep), 'trusted execution copy is disjoint from detached source');
    check(Fabric.digest(fs.readFileSync(path.join(executionRoot, 'capability.js'), 'utf8')) === Fabric.digest(source) && Fabric.digest(fs.readFileSync(path.join(executionRoot, 'selftest.js'), 'utf8')) === Fabric.digest(selftest), 'execution-copy bytes match the exact candidate');
    const run = childProcess.spawnSync(process.execPath, [path.join(executionRoot, 'selftest.js')], {
      cwd: executionRoot,
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      env: { AXM_TRUSTED_TEST_HOST: 'bounded-record-query-v1' }
    });
    check(run.status === 0 && run.signal === null && /PASS bounded deterministic record collection query capability/.test(run.stdout) && run.stderr === '', 'exact emitted adversarial selftest passes in the bounded trusted host');
    const countertest = [
      "'use strict';",
      "const assert=require('node:assert/strict');const capability=require('./capability.js');",
      "function base(){return {records:[{active:true,id:'a',kind:'quest',label:'A',score:1},{active:true,id:'b',kind:'quest',label:'B',score:1}],predicates:[],orderBy:[],select:['id'],limit:2};}",
      "const stable=base();assert.deepStrictEqual(capability.query(stable).records,[{id:'a'},{id:'b'}]);",
      "const duplicate=base();duplicate.select=['id','id'];assert.equal(capability.query(duplicate).code,'SELECT_FIELD_DUPLICATE');",
      "const sparse=base();sparse.predicates=new Array(1);assert.equal(capability.query(sparse).code,'PREDICATES_DENSE_ARRAY_REQUIRED');",
      "const decorated=base();decorated.records.extra='hidden';assert.equal(capability.query(decorated).code,'RECORDS_DENSE_ARRAY_REQUIRED');",
      "const direction=base();direction.orderBy=[{field:'score',direction:'SIDEWAYS'}];assert.equal(capability.query(direction).code,'ORDER_DIRECTION_UNSUPPORTED');",
      "const unsafe=base();unsafe.records[0].score=Number.MAX_SAFE_INTEGER+1;assert.equal(capability.query(unsafe).code,'RECORD_VALUE_INVALID');",
      "const tooMany=base();tooMany.predicates=Array.from({length:capability.CONFIG.maxPredicates+1},()=>({field:'active',op:'EQ',value:true}));assert.equal(capability.query(tooMany).code,'PREDICATES_LIMIT_EXCEEDED');",
      "const outputHeavy=base();outputHeavy.records=Array.from({length:4},(_,index)=>({active:true,id:'item'+index,kind:'quest',label:'x'.repeat(80),score:index}));outputHeavy.select=['active','id','kind','label','score'];outputHeavy.limit=4;assert.equal(capability.query(outputHeavy).code,'OUTPUT_BYTES_EXCEEDED');",
      "let getterRead=false;const accessor=base();Object.defineProperty(accessor,'limit',{enumerable:true,get(){getterRead=true;throw new Error('must not execute');}});assert.equal(capability.query(accessor).code,'INPUT_FIELD_UNSUPPORTED');assert.equal(getterRead,false);",
      "process.stdout.write('PASS trusted bounded record-query host countertests\\n');",
      ''
    ].join('\n');
    fs.writeFileSync(path.join(executionRoot, 'host-countertest.js'), countertest, { encoding: 'utf8', flag: 'wx' });
    const counterRun = childProcess.spawnSync(process.execPath, [path.join(executionRoot, 'host-countertest.js')], {
      cwd: executionRoot,
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true,
      env: { AXM_TRUSTED_TEST_HOST: 'bounded-record-query-v1-countertest' }
    });
    check(counterRun.status === 0 && counterRun.signal === null && /PASS trusted bounded record-query host countertests/.test(counterRun.stdout) && counterRun.stderr === '', 'trusted host countertests cover ambiguity, sparse data, type drift, and both resource budgets');
  } finally {
    safeCleanup(root);
  }

  process.stdout.write('Bounded record-query focused proof PASS · ' + passed + ' checks\n');
}

try { main(); }
catch (error) { process.stderr.write('Bounded record-query focused proof FAIL\n' + (error.stack || error) + '\n'); process.exitCode = 1; }
