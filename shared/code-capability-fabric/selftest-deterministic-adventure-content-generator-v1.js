'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Generator = require('./deterministic-adventure-content-generator-v1');
const FirstGame = require('./deterministic-game-candidate-generator-v1');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function throwsLike(fn, pattern) { assert.throws(fn, pattern); }
function resignDecision(decision) {
  delete decision.decisionDigest;
  return Generator.sealDecision(decision);
}
function resignRequest(request) {
  delete request.requestDigest;
  return Generator.sealRequest(request);
}

test('schemas and contract are closed at the packet boundary', () => {
  const expected = new Map([
    ['game-test-promotion-decision.schema.json', Generator.DECISION_SCHEMA],
    ['adventure-content-growth-request.schema.json', Generator.REQUEST_SCHEMA],
    ['adventure-content-release-packet.schema.json', Generator.PACKET_SCHEMA],
    ['four-roots-adventure-content.schema.json', Generator.CONTENT_SCHEMA]
  ]);
  for (const [name, id] of expected) {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    assert.strictEqual(schema.$id, id);
    assert.strictEqual(schema.additionalProperties, false);
  }
  const decisionSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'game-test-promotion-decision.schema.json'), 'utf8'));
  for (const field of ['source', 'target', 'authorizes', 'refuses', 'publicReuseRights']) assert.strictEqual(decisionSchema.properties[field].additionalProperties, false, field + ' must be schema-closed');
  const packetSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'adventure-content-release-packet.schema.json'), 'utf8'));
  for (const field of ['generator', 'contentFile', 'contentSummary', 'installPlan', 'declaredAuthority', 'resources', 'reuseRights', 'truth']) assert.strictEqual(packetSchema.properties[field].additionalProperties, false, field + ' must be schema-closed');
  const contract = require('./module-deterministic-adventure-content-generator-v1.contract.json');
  assert.strictEqual(contract.status, 'TEST');
  assert.deepStrictEqual(contract.permissions, []);
  for (const refusal of ['runtime-execution', 'workspace-write', 'network-use', 'automatic-installation', 'automatic-canon', 'foundation-mutation']) assert(contract.boundaries.refuses.includes(refusal));
});

test('identical requests produce byte-identical content packets', () => {
  const request = Generator.buildExampleRequest();
  const first = Generator.generate(request);
  const second = Generator.generate(clone(request));
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(Generator.verifyGeneration(first, request), { pass: true, errors: [] });
  assert.strictEqual(first.packet.contentFile.path, Generator.CONTENT_PATH);
  const decoded = Buffer.from(first.packet.contentFile.content, 'base64');
  assert.strictEqual(Generator.hashBuffer(decoded), first.packet.contentFile.sha256);
  assert.strictEqual(decoded.length, first.packet.contentFile.byteLength);
});

test('the exact proven v0.1 candidate is the immutable ancestor', () => {
  const first = FirstGame.generate(FirstGame.buildExampleRequest());
  assert.strictEqual(first.request.requestDigest, Generator.ANCESTOR.requestDigest);
  assert.strictEqual(first.packet.packetDigest, Generator.ANCESTOR.packetDigest);
  const bundleBytes = Buffer.from(JSON.stringify(first.packet.moduleBundle, null, 2) + '\n');
  const bundleDigest = 'sha256:' + crypto.createHash('sha256').update(bundleBytes).digest('hex');
  assert.strictEqual(bundleDigest, Generator.ANCESTOR.bundleDigest);
});

test('promotion is exact TEST scope and not cryptographic identity proof', () => {
  const decision = Generator.buildExampleDecision();
  assert.strictEqual(decision.scope, 'INTERNAL_WORKSHOP_TEST');
  assert.strictEqual(decision.target.status, 'TEST');
  assert.strictEqual(decision.authenticatedIdentityProven, false);
  assert.strictEqual(decision.refuses.canon, true);
  assert.strictEqual(decision.refuses.publicRelease, true);
  assert.strictEqual(decision.publicReuseRights.state, 'HOLD');
});

test('target, ancestor, CANON, and public-rights drift fail closed', () => {
  const mutations = [
    (value) => { value.target.slot = '021'; },
    (value) => { value.source.packetDigest = 'sha256:' + '0'.repeat(64); },
    (value) => { value.refuses.canon = false; },
    (value) => { value.publicReuseRights.directPublicReuseAllowed = true; },
    (value) => { value.authenticatedIdentityProven = true; }
  ];
  for (const mutate of mutations) {
    const decision = clone(Generator.buildExampleDecision());
    delete decision.decisionDigest;
    mutate(decision);
    throwsLike(() => Generator.sealDecision(decision), /decision|ancestor|target|refusal|reuse|identity|scope/i);
  }
});

test('four-root HOLD, FAIL, missing evidence, and order drift fail closed', () => {
  for (const mutation of [
    (request) => { request.rootsGate[1].verdict = 'HOLD'; },
    (request) => { request.rootsGate[2].verdict = 'FAIL'; },
    (request) => { request.rootsGate[0].evidenceRefs = []; },
    (request) => { [request.rootsGate[0], request.rootsGate[1]] = [request.rootsGate[1], request.rootsGate[0]]; }
  ]) {
    const request = clone(Generator.buildExampleRequest());
    delete request.requestDigest;
    mutation(request);
    throwsLike(() => Generator.sealRequest(request), /ROOTS_GATE_HOLD|root evidence/i);
  }
});

test('resource, runtime process, network, and authority escalation fail closed', () => {
  for (const mutation of [
    (request) => { request.resources.maxFiles = 2; },
    (request) => { request.resources.maxRuntimeProcesses = 1; },
    (request) => { request.resources.maxNetworkRequests = 1; },
    (request) => { request.resources.maxPacketBytes = 2000000; },
    (request) => { request.authority = 'HOST'; }
  ]) {
    const request = clone(Generator.buildExampleRequest());
    delete request.requestDigest;
    mutation(request);
    throwsLike(() => Generator.sealRequest(request), /resource|envelope|identity/i);
  }
});

test('request, decision, and ancestor digest drift fail closed', () => {
  const request = clone(Generator.buildExampleRequest());
  request.goal += ' forged';
  throwsLike(() => Generator.normalizeRequest(request), /request digest/);

  const decision = clone(Generator.buildExampleRequest());
  decision.decision.statementDigest = 'sha256:' + '1'.repeat(64);
  throwsLike(() => Generator.normalizeRequest(decision), /decision digest/);

  const ancestor = clone(Generator.buildExampleRequest());
  delete ancestor.requestDigest;
  ancestor.ancestorPacketRef.sha256 = 'sha256:' + '2'.repeat(64);
  throwsLike(() => Generator.sealRequest(ancestor), /ancestor packet drift/);
});

test('recipe is a complete five-zone adventure with ending and root order', () => {
  const { content } = Generator.readRecipe();
  assert.deepStrictEqual(content.roots.map((root) => root.id), Generator.ROOTS);
  assert.strictEqual(content.zones.length, 5);
  assert.strictEqual(content.zones.reduce((sum, zone) => sum + zone.actors.length, 0), 25);
  assert.strictEqual(content.quests.length, 6);
  assert.strictEqual(content.zones.some((zone) => zone.actors.some((actor) => actor.complete)), true);
  assert.strictEqual(content.ending.title, 'A Door Into Review');
});

test('malformed maps, aliases, actor references, and authority claims are rejected', () => {
  const base = Generator.readRecipe().content;
  const mutations = [
    (value) => { value.zones[0].map[0] = '../evil........'; },
    (value) => { value.zones[0].actors[0].id = 'CON'; },
    (value) => { value.zones[1].actors[1].grants.items = ['missing-item']; },
    (value) => { value.authority.runtimeCanUseOutboundNetwork = true; },
    (value) => { value.zones[0].actors[1].travel.zoneId = 'C:/outside'; }
  ];
  for (const mutate of mutations) {
    const content = clone(base); mutate(content);
    throwsLike(() => Generator.validateContent(content), /map|portable|unknown|authority|travel|zone/i);
  }
});

test('generated content cannot install, execute, call providers, or change CANON', () => {
  const packet = Generator.generate(Generator.buildExampleRequest()).packet;
  assert.deepStrictEqual(packet.declaredAuthority, { permissions: [], networkDomains: [], lifecycleEffects: [] });
  assert.strictEqual(packet.installPlan.requiresHostApplication, true);
  assert.strictEqual(packet.installPlan.overwriteExisting, false);
  assert.strictEqual(packet.installPlan.canon, false);
  assert.strictEqual(packet.truth.providerCalled, false);
  assert.strictEqual(packet.truth.runtimeExecuted, false);
  assert.strictEqual(packet.truth.workspaceWritten, false);
  assert.strictEqual(packet.truth.installedByGenerator, false);
  assert.strictEqual(packet.truth.canonChanged, false);
});

test('portable install and content paths remain relative and collision-safe', () => {
  assert.strictEqual(CorePath(Generator.CONTENT_PATH), 'content/adventure-content.v0.2.json');
  assert.strictEqual(CorePath(Generator.INSTALL_TARGET), Generator.INSTALL_TARGET);
  for (const bad of ['../content.json', 'C:/content.json', '//host/share/content.json', 'content/CON.json', 'content/file.json:stream']) throwsLike(() => CorePath(bad), /path|reserved|colon/i);
});

test('mutated packet and content bytes fail deterministic verification', () => {
  const request = Generator.buildExampleRequest();
  const result = Generator.generate(request);
  result.packet.contentFile.content = Buffer.from('{}').toString('base64');
  assert.strictEqual(Generator.verifyGeneration(result, request).pass, false);
});

function CorePath(value) { return require('./semantic-candidate-generator-v1').normalizePortablePath(value); }

process.stdout.write('PASS deterministic adventure content generator (' + passed + ' cases)\n');
