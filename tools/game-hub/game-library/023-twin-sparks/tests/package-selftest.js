'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKSHOP = path.resolve(ROOT, '..', '..', '..', '..');
const Generator = require(path.join(WORKSHOP, 'shared', 'code-capability-fabric', 'deterministic-game-candidate-generator-v1'));
const PackageVerifier = require(path.join(WORKSHOP, 'tools', 'game-hub', 'game-package-verifier'));
const Server = require(path.join(ROOT, 'runtime', 'server'));

function read(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(read(relative).toString('utf8')); }
function hash(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function without(value, key) { const copy = JSON.parse(JSON.stringify(value)); delete copy[key]; return copy; }
function request(port, pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const call = http.request({ hostname: '127.0.0.1', port, path: pathname, method }, (response) => {
      const chunks = []; response.on('data', (chunk) => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    }); call.on('error', reject); call.end();
  });
}

async function main() {
  const manifest = json('game.manifest.json');
  assert.strictEqual(manifest.slot, '023');
  assert.strictEqual(manifest.game_id, '023-twin-sparks');
  assert.strictEqual(manifest.version, '0.4.0');
  assert.ok(manifest.status.startsWith('TEST'));
  assert.deepStrictEqual(manifest.allowed_seat_types, ['human']);
  assert.strictEqual(manifest.min_players, 2); assert.strictEqual(manifest.max_players, 2);
  assert.strictEqual(manifest.launch.port, 8823); assert.strictEqual(manifest.launch.local_only_default, true);
  assert.strictEqual(manifest.rules.outbound_network_allowed, false);
  assert.strictEqual(manifest.rules.canon_effect, 'none');
  assert.strictEqual(manifest.package.installed, true); assert.strictEqual(manifest.package.promoted_to_test, true);
  assert.strictEqual(manifest.package.promoted_beyond_test, false); assert.strictEqual(manifest.package.public_release, false);
  for (const required of manifest.package.required_paths) assert(fs.existsSync(path.join(ROOT, required)), 'missing required path ' + required);

  const requestInput = Generator.buildCoopExampleRequest();
  const generated = Generator.generate(requestInput);
  assert.strictEqual(generated.packet.packetDigest, 'sha256:6680703ed8ed2bbe652c60a07be9504981292972896f9466ea56a9b67538c246');
  assert.strictEqual(generated.packet.moduleBundleRef.sha256, 'sha256:cab406d01d3b3ca8b273ff51ccef605c27e6cb20d180a6a8c31d913c47bf3358');
  assert.strictEqual(generated.packet.sourceFiles.length, 14);
  for (const file of generated.packet.moduleBundle.files) {
    const installed = read('candidate/' + file.path);
    assert.strictEqual(installed.toString('base64'), file.content, 'installed bytes drifted: ' + file.path);
    assert.strictEqual(hash(installed), 'sha256:' + file.sha256, 'installed digest drifted: ' + file.path);
  }
  const ancestorReceipt = json('candidate/candidate.receipt.json');
  assert.strictEqual(ancestorReceipt.truth.gameCodeExecuted, false);
  assert.strictEqual(ancestorReceipt.authority.installed, false);
  const gap = json('candidate/installation-gap.json');
  assert.strictEqual(gap.installAllowed, false);
  const flow = json('candidate/experience-flow-plan.json');
  assert.strictEqual(flow.intent.mode, 'GAME_FIRST_STAGED_DISCLOSURE');
  assert.strictEqual(flow.disclosure.mayHideTruth, false);
  assert.strictEqual(flow.authority, 'NONE');
  const html = read('candidate/index.html').toString('utf8');
  assert.match(html, /id="scene-overlay"/); assert.match(html, /<details id="review-drawer"/);
  assert.doesNotMatch(html, /class="layout"|class="panel"|class="asset-strip"/);

  const decision = json('promotion/mike-test-promotion-decision.json');
  assert.strictEqual(Generator.hashValue(without(decision, 'decisionDigest')), decision.decisionDigest);
  assert.strictEqual(decision.source.sourceCommit, '146155f6307a27f13c3073098616f6771cbba26c');
  assert.strictEqual(decision.source.packetDigest, generated.packet.packetDigest);
  assert(decision.rootsGate.every((root) => root.verdict === 'PASS'));
  assert.strictEqual(decision.authorizes.installExactCandidateBytes, true);
  assert.strictEqual(decision.refuses.canon, true); assert.strictEqual(decision.refuses.publicRelease, true);

  for (const [file, id] of [
    ['game-internal-test-promotion-decision.schema.json', 'axm.game-internal-test-promotion-decision/v1'],
    ['game-internal-test-installation-receipt.schema.json', 'axm.game-internal-test-installation-receipt/v1']
  ]) {
    const schema = JSON.parse(fs.readFileSync(path.join(WORKSHOP, 'shared', 'code-capability-fabric', file), 'utf8'));
    assert.strictEqual(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.strictEqual(schema.$id, id); assert.strictEqual(schema.additionalProperties, false);
  }

  const packageReport = PackageVerifier.verifyGameDir(ROOT);
  assert.deepStrictEqual(packageReport.errors, [], packageReport.errors.join('\n'));
  assert(Server.safeStaticFile('/games/023/') === path.join(ROOT, 'runtime', 'host.html'));
  assert(Server.safeStaticFile('/games/023/candidate/') === path.join(ROOT, 'candidate', 'index.html'));
  for (const blocked of ['/candidate/game.config.json', '/%2e%2e/game.manifest.json', '/C:/Windows/win.ini', '/games/023/prebuild-plan.json']) assert.strictEqual(Server.safeStaticFile(blocked), null);

  const server = Server.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const port = server.address().port;
    const health = await request(port, '/health'); assert.strictEqual(health.status, 200); assert.strictEqual(JSON.parse(health.body).gameId, '023-twin-sparks');
    const page = await request(port, '/games/023/'); assert.strictEqual(page.status, 200); assert.match(page.body.toString('utf8'), /WORKSHOP INTERNAL TEST/);
    const candidatePage = await request(port, '/games/023/candidate/'); assert.strictEqual(candidatePage.status, 200); assert.match(candidatePage.body.toString('utf8'), /TWIN SPARKS/);
    const script = await request(port, '/games/023/candidate/game.js', 'HEAD'); assert.strictEqual(script.status, 200); assert.strictEqual(script.body.length, 0);
    const privateRecord = await request(port, '/games/023/game.config.json'); assert.strictEqual(privateRecord.status, 404);
    const post = await request(port, '/games/023/', 'POST'); assert.strictEqual(post.status, 405);
  } finally { await new Promise((resolve) => server.close(resolve)); }

  const receipt = json('promotion/test-installation-receipt.json');
  assert.strictEqual(Generator.hashValue(without(receipt, 'receiptDigest')), receipt.receiptDigest);
  for (const file of receipt.installedFiles.concat(receipt.hostFiles)) {
    const bytes = read(file.path); assert.strictEqual(bytes.length, file.byteLength, 'receipt byte length drifted: ' + file.path);
    assert.strictEqual(hash(bytes), file.sha256, 'receipt digest drifted: ' + file.path);
  }
  assert.strictEqual(receipt.decisionRef.sha256, decision.decisionDigest);
  assert.strictEqual(receipt.ancestorRef.sha256, generated.packet.packetDigest);
  assert.strictEqual(receipt.application.generatedCodePerformedInstall, false);
  assert.strictEqual(receipt.application.installedInCanonicalCheckout, false);
  assert.strictEqual(receipt.authority.internalTestInstalled, true);
  assert.strictEqual(receipt.authority.promotedBeyondTest, false);
  assert.strictEqual(receipt.authority.canonChanged, false);

  process.stdout.write('PASS Twin Sparks promoted TEST package (exact candidate bytes + local host boundary)\n');
}

main().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
