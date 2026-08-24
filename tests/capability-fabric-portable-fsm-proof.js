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
const GameFsm = require('../shared/game-fsm');

const EXPECTED = Object.freeze({
  builder: 'sha256:d918384d364b2be00e6523aed02daeb5b418b5a603607c83423d83e3c1f35124',
  recipe: 'sha256:d2e860d8572c5960ee579c25389f02d3277632bbdda4e1c87af1f2a2fdd6398b',
  catalog: 'sha256:7557f514bfb85f987e91c1ad06c5ffb1f69de657f6ddf7372c543e958a232425',
  directPackage: 'sha256:b32dc3b086457996265b29a5f438d3d103b03511ea1af3fc6926c82bce18ef55',
  profile: 'sha256:b813cc4219ca1e337fce4c94f53934694bf3fa4cd425f6e26d63ea78dda0ab0f',
  profileCatalog: 'sha256:060deca3775d440c4b515a9706fbbad060908b24d20ceb38398a004174da4ffb',
  specialistPackage: 'sha256:ef9cb7b6f50ba743b370bdde98b4d3ec9a03ef93d56e0c4df0faba3ed521ba4f',
  capability: 'sha256:d8c2b00ef650f7b8903444d3b88e68947b7c4ff75d8d78dc7592986e5b1a811f',
  selftest: 'sha256:bbe6189e00f1119e2d1185e59a3fb158abce34b068c9277293f8c138c27a107e',
  gameFsmRuntime: 'sha256:ef7e30d9f516eff8a3772cb8b48b08a4d97c45dc938ef756a615934675a0bfc6'
});

let passed = 0;
function check(value, label) {
  assert(value, label);
  passed += 1;
  process.stdout.write('PASS ' + label + '\n');
}
function safeCleanup(root) {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('axm-portable-fsm-v1-proof-')) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}
function expectHeld(parameters, pattern) {
  assert.throws(() => Registry.compileActive('bounded-portable-fsm-definition-v1', EXPECTED.builder, parameters), pattern);
}

function main() {
  const catalog = Fabric.loadCatalog();
  const recipe = catalog.recipes.find((row) => row.id === 'bounded-portable-fsm-definition');
  const builder = Registry.describe('bounded-portable-fsm-definition-v1');
  check(catalog.catalogDigest === EXPECTED.catalog && recipe.recipeDigest === EXPECTED.recipe && recipe.builderDigest === EXPECTED.builder, 'catalog, recipe, and builder lineage are exact');
  check(builder.status === Registry.ACTIVE && builder.implementationDigest === EXPECTED.builder, 'portable-FSM-definition builder is source-reviewed and active');

  const request = Fabric.sealRequest(recipe.exampleRequest, true);
  const first = Fabric.build(request, catalog);
  const second = Fabric.build(request, catalog);
  const candidate = first.candidates[0];
  check(first.status === 'COMPLETE' && first.candidates.length === 1 && first.generatedCodeExecuted === false, 'one detached candidate is generated without execution');
  check(Fabric.canonicalJson(first) === Fabric.canonicalJson(second), 'identical input rebuild is byte-identical');
  check(Fabric.verifyCandidate(candidate).ok && candidate.package.packageDigest === EXPECTED.directPackage, 'exact direct candidate bytes and package lineage verify');
  check(Object.values(candidate.package.authority).every((value) => value === false), 'direct candidate receives no permission or lifecycle authority');

  const specialistRequest = Specialist.buildFsmDefinitionExampleRequest();
  const specialistResult = Specialist.generate(specialistRequest);
  check(specialistResult.status === 'COMPLETE_DETACHED_CANDIDATE' && Specialist.verify(specialistResult, specialistRequest).pass, 'exact Code Specialist lane emits and independently rebuilds one candidate');
  check(specialistResult.specialistContext.buildProfileRef.sha256 === EXPECTED.profile && specialistResult.buildProfileCatalogRef.sha256 === EXPECTED.profileCatalog, 'specialist profile and profile-catalog lineage are exact');
  check(specialistResult.detachedCandidate.package.packageDigest === EXPECTED.specialistPackage && specialistResult.recipeRef.digest === EXPECTED.recipe, 'specialist candidate binds exact recipe and candidate bytes');
  check(specialistResult.resourceObservation.candidateExecuted === false && specialistResult.resourceObservation.generatedSelftestExecuted === false && specialistResult.resourceObservation.processesSpawned === 0, 'specialist Fabric executes no candidate, selftest, or process');
  check(specialistResult.truth.candidateDetached === true && specialistResult.truth.installed === false && specialistResult.truth.integrated === false && specialistResult.truth.published === false && specialistResult.truth.promoted === false && specialistResult.truth.canonChanged === false, 'specialist candidate remains detached with no lifecycle authority');

  const source = candidate.files['capability.js'];
  const selftest = candidate.files['selftest.js'];
  check(Fabric.digest(source) === EXPECTED.capability && Fabric.digest(selftest) === EXPECTED.selftest, 'emitted capability and selftest bytes are exact');
  check(['axm.game-fsm/v1', 'DEFINITION', 'LIMITS', 'COMPOSITION', 'embeddedHandlers', 'runtimeCopied', 'deepFreeze'].every((needle) => source.includes(needle)), 'source declares the portable definition, finite limits, composition boundary, and immutability');
  check(!/createMachine|runTrace|toDiagram|handlers\s*:|\bguard\s*:|\baction\s*:|\benter\s*:|\bexit\s*:/.test(source), 'candidate contains no copied runtime or handler-bearing surface');
  check(!/require\(['"](?:fs|node:fs|child_process|node:child_process|http|https|net|tls|dgram)['"]\)|\bfetch\s*\(|provider\.call|process\.(?:env|cwd)|Date\.now|Math\.random|new Function|\beval\s*\(/.test(source), 'candidate contains no filesystem, process, network, provider, environment, clock, randomness, or dynamic-code surface');
  check(['noFunctions', 'reachable', 'actualTransitions', 'runtimeCopied:false'].every((needle) => selftest.includes(needle)), 'emitted selftest covers handler absence, reachability, transition count, and runtime-copy refusal');

  const base = Fabric.clone(recipe.exampleRequest.parameters);
  const duplicateState = Fabric.clone(base); duplicateState.states[1].id = duplicateState.states[0].id; expectHeld(duplicateState, /state ids must be unique/);
  const duplicateEvent = Fabric.clone(base); duplicateEvent.states[1].transitions[1].event = duplicateEvent.states[1].transitions[0].event; expectHeld(duplicateEvent, /transition events must be unique/);
  const missingTarget = Fabric.clone(base); missingTarget.states[2].transitions[0].target = 'missing'; expectHeld(missingTarget, /target missing is not declared/);
  const unreachable = Fabric.clone(base); unreachable.states[0].transitions = []; expectHeld(unreachable, /every state must be reachable/);
  const handler = Fabric.clone(base); handler.states[0].handler = 'unlock'; expectHeld(handler, /fields mismatch/);
  const reserved = Fabric.clone(base); reserved.states[0].id = '__proto__'; expectHeld(reserved, /is invalid/);
  const sparse = Fabric.clone(base); sparse.states = new Array(3); expectHeld(sparse, /plain dense array/);
  const decorated = Fabric.clone(base); decorated.states.extra = {}; expectHeld(decorated, /plain dense array/);
  const tooManyStates = Fabric.clone(base); tooManyStates.maxStates = 2; expectHeld(tooManyStates, /bounded length/);
  const tooManyTransitions = Fabric.clone(base); tooManyTransitions.maxTransitions = 3; expectHeld(tooManyTransitions, /transitions exceed/);
  const tooManyBytes = Fabric.clone(base); tooManyBytes.maxDefinitionBytes = 256; expectHeld(tooManyBytes, /definition exceeds/);
  const unknownParameter = Fabric.clone(base); unknownParameter.surprise = true; expectHeld(unknownParameter, /fields mismatch/);
  const accessor = Fabric.clone(base); let getterRead = false; Object.defineProperty(accessor.states[0], 'motionBlock', {enumerable: true, get() { getterRead = true; throw new Error('must not execute'); }}); expectHeld(accessor, /enumerable data property/); check(getterRead === false, 'accessor-bearing state field is refused without invoking its getter');
  passed += 13;
  process.stdout.write('PASS malformed, ambiguous, authority-bearing, sparse, and bounded-definition inputs fail before emission (13 countertests)\n');

  const runtimePath = path.join(__dirname, '..', 'shared', 'game-fsm', 'index.js');
  check(Fabric.digest(fs.readFileSync(runtimePath, 'utf8')) === EXPECTED.gameFsmRuntime, 'existing shared Game FSM runtime bytes remain exact and unchanged');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-portable-fsm-v1-proof-'));
  try {
    const sourceRoot = path.join(root, 'detached-source');
    const executionRoot = path.join(root, 'trusted-execution-copy');
    fs.mkdirSync(sourceRoot);
    fs.mkdirSync(executionRoot);
    fs.writeFileSync(path.join(sourceRoot, 'capability.js'), source, {encoding: 'utf8', flag: 'wx'});
    fs.writeFileSync(path.join(sourceRoot, 'selftest.js'), selftest, {encoding: 'utf8', flag: 'wx'});
    fs.copyFileSync(path.join(sourceRoot, 'capability.js'), path.join(executionRoot, 'capability.js'), fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(sourceRoot, 'selftest.js'), path.join(executionRoot, 'selftest.js'), fs.constants.COPYFILE_EXCL);
    check(path.relative(sourceRoot, executionRoot).startsWith('..' + path.sep), 'trusted execution copy is disjoint from detached source');
    check(Fabric.digest(fs.readFileSync(path.join(executionRoot, 'capability.js'), 'utf8')) === EXPECTED.capability && Fabric.digest(fs.readFileSync(path.join(executionRoot, 'selftest.js'), 'utf8')) === EXPECTED.selftest, 'execution-copy bytes match the exact candidate');
    const run = childProcess.spawnSync(process.execPath, [path.join(executionRoot, 'selftest.js')], {cwd: executionRoot, encoding: 'utf8', timeout: 10000, windowsHide: true, env: {AXM_TRUSTED_TEST_HOST: 'bounded-portable-fsm-definition-v1'}});
    check(run.status === 0 && run.signal === null && /PASS bounded portable FSM definition capability/.test(run.stdout) && run.stderr === '', 'exact emitted structural selftest passes in the bounded trusted host');

    const generated = require(path.join(executionRoot, 'capability.js'));
    const definition = generated.definition();
    check(GameFsm.validateDefinition(definition).ok && generated.COMPOSITION.consumer === 'shared/game-fsm' && generated.COMPOSITION.runtimeCopied === false, 'generated definition composes with the existing shared Game FSM contract without copying it');
    const events = ['UNLOCK', 'OPEN', 'CLOSE', 'LOCK'];
    const trace = GameFsm.runTrace(definition, events);
    const repeat = GameFsm.runTrace(definition, events);
    check(Fabric.canonicalJson(trace) === Fabric.canonicalJson(repeat) && trace.current_state === 'locked' && trace.events.map((row) => row.to).join(',') === 'closed,open,closed,locked', 'existing runtime produces a deterministic complete adventure-door behavior trace');
    const ignored = GameFsm.runTrace(definition, ['KNOCK']);
    check(ignored.current_state === 'locked' && ignored.events.length === 1 && ignored.events[0].status === 'IGNORED', 'undeclared gameplay event is deterministically ignored without state expansion');
    check(trace.definition_digest === ignored.definition_digest && /^sha256:[a-f0-9]{64}$/.test(trace.digest), 'runtime evidence is byte-bound to one generated definition');
  } finally {
    safeCleanup(root);
  }

  process.stdout.write('Portable FSM definition focused proof PASS · ' + passed + ' checks\n');
}

try { main(); }
catch (error) { process.stderr.write('Portable FSM definition focused proof FAIL\n' + (error.stack || error) + '\n'); process.exitCode = 1; }
