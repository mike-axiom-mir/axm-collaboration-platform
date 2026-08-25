'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Generator = require('./deterministic-game-candidate-generator-v1');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function throwsLike(fn, pattern) { assert.throws(fn, pattern); }
function fileBytes(result, name) {
  const file = result.packet.moduleBundle.files.find((item) => item.path === name);
  assert(file, 'missing file ' + name);
  return Buffer.from(file.content, 'base64');
}

test('schemas and module contract are closed and honestly bounded', () => {
  const expected = new Map([
    ['game-generation-brief.schema.json', Generator.BRIEF_SCHEMA],
    ['game-candidate-generation-request.schema.json', Generator.REQUEST_SCHEMA],
    ['game-candidate-packet.schema.json', Generator.PACKET_SCHEMA]
  ]);
  for (const [name, id] of expected) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    assert.strictEqual(schema.$id, id);
    assert.strictEqual(schema.additionalProperties, false);
  }
  const contract = require('./module-deterministic-game-candidate-generator-v1.contract.json');
  assert.strictEqual(contract.status, 'TEST');
  assert.deepStrictEqual(contract.permissions, []);
  for (const refusal of ['game-code-execution', 'network-use', 'automatic-installation', 'automatic-active-library-change', 'automatic-canon']) assert(contract.boundaries.refuses.includes(refusal));
});

test('identical requests produce byte-identical packets', () => {
  const request = Generator.buildExampleRequest();
  const left = Generator.generate(request);
  const right = Generator.generate(clone(request));
  assert.deepStrictEqual(left, right);
  assert.strictEqual(Generator.verifyGeneration(left, request).pass, true);
  assert.strictEqual(left.truth.candidateCodeExecuted, false);
  assert.strictEqual(left.truth.workspaceWritten, false);
  assert.strictEqual(left.truth.networkUsed, false);
});

test('candidate is complete, byte-bound, parse-only valid, and Game Forge compatible', () => {
  const result = Generator.generate(Generator.buildExampleRequest());
  assert.deepStrictEqual(result.packet.sourceFiles.map((item) => item.path), Generator.LEGACY_REQUIRED_FILES);
  let total = 0;
  for (const ref of result.packet.sourceFiles) {
    const bytes = fileBytes(result, ref.path);
    total += bytes.length;
    assert.strictEqual(ref.byteLength, bytes.length);
    assert.strictEqual(ref.sha256, 'sha256:' + result.packet.moduleBundle.files.find((item) => item.path === ref.path).sha256);
  }
  assert.strictEqual(total, result.packet.resources.sourceBytes);
  new vm.Script(fileBytes(result, 'game.js').toString('utf8'), { filename: 'game.js' });
  const project = JSON.parse(fileBytes(result, 'game-forge-project.json'));
  assert.strictEqual(project.world.cells.length, 160);
  const allowed = new Set(['empty', 'ground', 'wall', 'water', 'spawn', 'goal', 'hazard', 'path']);
  assert(project.world.cells.every((cell) => allowed.has(cell.terrain)));
  const config = JSON.parse(fileBytes(result, 'game.config.json'));
  assert.deepStrictEqual(config.map.checkpoints.map((item) => item.id), Generator.ROOTS);
  assert.strictEqual(config.session.network, 'DISABLED');
});

test('candidate declares no authority and retains installation and reuse holds', () => {
  const result = Generator.generate(Generator.buildExampleRequest());
  assert.deepStrictEqual(result.packet.declaredAuthority, { permissions: [], networkDomains: [], lifecycleEffects: [] });
  assert.strictEqual(result.packet.reuseRights.state, 'RESEARCH_ONLY_HOLD');
  assert.strictEqual(result.packet.truth.installed, false);
  assert.strictEqual(result.packet.truth.integrated, false);
  assert.strictEqual(result.packet.truth.lessonActive, false);
  assert.strictEqual(result.packet.truth.canonChanged, false);
  const gap = JSON.parse(fileBytes(result, 'installation-gap.json'));
  assert.strictEqual(gap.installAllowed, false);
  assert.strictEqual(gap.nextGate, 'MIKE_INSTALLATION_DECISION');
});

test('root HOLD and FAIL cannot be clicked into PASS', () => {
  for (const verdict of ['HOLD', 'FAIL']) {
    const request = clone(Generator.buildExampleRequest());
    delete request.requestDigest;
    request.rootsGate[2].verdict = verdict;
    throwsLike(() => Generator.sealRequest(request), /ROOTS_GATE_HOLD:continuity=/);
  }
});

test('forged component observations and version ambiguity fail closed', () => {
  const forged = clone(Generator.buildExampleRequest());
  forged.components[0].contract.version = 'v-forged';
  delete forged.requestDigest;
  throwsLike(() => Generator.sealRequest(forged), /contract bytes do not match/);
  const duplicate = clone(Generator.buildExampleRequest());
  duplicate.components[1] = clone(duplicate.components[0]);
  delete duplicate.requestDigest;
  throwsLike(() => Generator.sealRequest(duplicate), /exact existing Workshop component set/);
  const selfConsistent = clone(Generator.buildExampleRequest());
  delete selfConsistent.requestDigest;
  selfConsistent.components[0].contract.permissions = ['machine.execute'];
  selfConsistent.components[0].ref.sha256 = Generator.hashValue(selfConsistent.components[0].contract);
  throwsLike(() => Generator.sealRequest(selfConsistent), /approved Workshop bytes/);
});

test('permission and lifecycle escalation fail closed', () => {
  for (const field of ['install', 'integrate', 'publish', 'promote', 'canon', 'authenticatedIdentityProven']) {
    const request = clone(Generator.buildExampleRequest());
    delete request.requestDigest;
    request.authorization[field] = true;
    throwsLike(() => Generator.sealRequest(request), /authorization exceeds/);
  }
  const authority = clone(Generator.buildExampleRequest());
  delete authority.requestDigest;
  authority.authority = 'HOST';
  throwsLike(() => Generator.sealRequest(authority), /identity mismatch/);
});

test('iteration and resource drift fail closed', () => {
  const iterations = clone(Generator.buildExampleRequest());
  delete iterations.requestDigest;
  iterations.resources.maxIterations = 2;
  throwsLike(() => Generator.sealRequest(iterations), /iteration ceilings drifted/);
  const process = clone(Generator.buildExampleRequest());
  delete process.requestDigest;
  process.resources.maxCandidateProcesses = 1;
  throwsLike(() => Generator.sealRequest(process), /no candidate process/);
  const cost = clone(Generator.buildExampleRequest());
  delete cost.requestDigest;
  cost.resources.maxCostMinorUnits = 1;
  throwsLike(() => Generator.sealRequest(cost), /no candidate process or cost/);
});

test('brief and request digest drift fail closed', () => {
  const brief = clone(Generator.buildExampleRequest());
  brief.brief.seed += 1;
  throwsLike(() => Generator.normalizeRequest(brief), /brief digest|request digest/);
  const request = clone(Generator.buildExampleRequest());
  request.goal += ' changed';
  throwsLike(() => Generator.normalizeRequest(request), /request digest/);
});

test('bundle and packet forgery are detected by deterministic rebuild', () => {
  const request = Generator.buildExampleRequest();
  const content = Generator.generate(request);
  content.packet.moduleBundle.files.find((item) => item.path === 'game.js').content = Buffer.from('forged').toString('base64');
  assert.strictEqual(Generator.verifyGeneration(content, request).pass, false);
});

test('portable path validator rejects Windows aliases and traversal', () => {
  const Core = require('./semantic-candidate-generator-v1');
  for (const candidate of ['../game.js', 'C:/game.js', '//host/share/game.js', 'CON.txt', 'folder/name:stream', 'AUX/file.js', 'game.js.', 'folder//game.js']) {
    throwsLike(() => Core.normalizePortablePath(candidate), /path|segment|portable|reserved|colon|empty/i);
  }
  assert.strictEqual(Core.pathKey('Folder/Game.js'), Core.pathKey('folder/game.js'));
});

test('seed changes candidate bytes without changing authority', () => {
  const first = Generator.buildExampleRequest();
  const changedCore = clone(first.brief);
  delete changedCore.briefDigest;
  changedCore.seed += 1;
  const changed = clone(first);
  delete changed.requestDigest;
  changed.brief = Generator.sealBrief(changedCore);
  const sealed = Generator.sealRequest(changed);
  const a = Generator.generate(first), b = Generator.generate(sealed);
  assert.notStrictEqual(a.packet.packetDigest, b.packet.packetDigest);
  assert.strictEqual(b.packet.authority, 'NONE');
  assert.strictEqual(b.packet.truth.installed, false);
});

process.stdout.write('PASS deterministic game candidate generator (' + passed + ' cases)\n');
