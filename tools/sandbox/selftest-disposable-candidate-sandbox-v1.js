'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Generator = require('../../shared/code-capability-fabric/deterministic-game-candidate-generator-v1');
const Sandbox = require('./disposable-candidate-sandbox-v1');

const WORKSHOP = path.resolve(__dirname, '../..');
const TEST_PARENT = path.join(Sandbox.SANDBOX_STATE_ROOT, 'sandbox-v2.5-selftest');
let count = 0;
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => { count += 1; process.stdout.write('PASS ' + name + '\n'); }, (error) => { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; });
}
function writableTree(root) {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) writableTree(target);
    else if (entry.isFile()) { try { fs.chmodSync(target, 0o644); } catch {} }
  }
  try { fs.chmodSync(root, 0o755); } catch {}
}
function cleanup() { writableTree(TEST_PARENT); fs.rmSync(TEST_PARENT, { recursive: true, force: true }); }
function sourceText(session, iteration, file) { return fs.readFileSync(path.join(session.roots.output, iteration, file), 'utf8'); }
function request(port, pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method }, (res) => {
      const chunks = []; res.on('data', (chunk) => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end();
  });
}

(async () => {
  cleanup();
  fs.mkdirSync(TEST_PARENT, { recursive: true });
  const generationRequest = Generator.buildExampleRequest();
  const generation = Generator.generate(generationRequest);
  let session;
  try {
    await check('creates four disjoint roots and an immutable byte-bound iteration', () => {
      session = Sandbox.createSession({ parentRoot: TEST_PARENT, sessionId: 'four-roots-session', request: generationRequest, generationResult: generation });
      const realRoots = Object.values(session.roots).map((item) => fs.realpathSync.native(item).toLowerCase());
      assert.strictEqual(new Set(realRoots).size, 4);
      assert.strictEqual(session.receipt.truth.sourceOutputEvidenceDisjoint, true);
      assert.strictEqual(session.receipt.truth.sourceImmutable, true);
      assert.strictEqual(session.receipt.resources.candidateProcesses, 0);
      assert.strictEqual(session.receipt.truth.candidateCodeExecuted, false);
      const iteration = Sandbox.readIteration(session, 'iteration-000');
      assert.strictEqual(iteration.iterationDigest, session.currentIteration.digest);
      assert.strictEqual(iteration.staticEvidence.verdict, 'PASS');
    });

    await check('durable evidence excludes source, streams, and machine paths', () => {
      for (const file of fs.readdirSync(session.roots.evidence)) {
        const text = fs.readFileSync(path.join(session.roots.evidence, file), 'utf8');
        assert(!text.includes(WORKSHOP));
        assert(!text.includes('replacementContent'));
        assert(!text.includes(sourceText(session, 'iteration-000', 'game.js').slice(0, 80)));
        const record = JSON.parse(text);
        const encoded = JSON.stringify(record);
        assert(!encoded.includes('stdoutContent'));
        assert(!encoded.includes('stderrContent'));
      }
    });

    await check('accepts only the exact two-seat co-op shape and binds the seat count', () => {
      const coopRequest = Generator.buildCoopExampleRequest();
      const coopGeneration = Generator.generate(coopRequest);
      const coopSession = Sandbox.createSession({ parentRoot: TEST_PARENT, sessionId: 'twin-reactor-coop-session', request: coopRequest, generationResult: coopGeneration });
      const inspected = Sandbox.readIteration(coopSession, 'iteration-000');
      assert.strictEqual(coopGeneration.packet.moduleBundle.requiredSeats, 2);
      assert.strictEqual(inspected.staticEvidence.requiredSeats, 2);
      assert(inspected.staticEvidence.checks.includes('exact-seat-contract'));
      const decoded = Sandbox.decodeBundle(coopGeneration.packet.moduleBundle, coopRequest.resources);
      assert.throws(() => Sandbox.validateStaticFiles(decoded.files, coopRequest.resources, 1), /seat count differs/);
      const unknownSeats = clone(coopGeneration.packet.moduleBundle); unknownSeats.requiredSeats = 3;
      assert.throws(() => Sandbox.decodeBundle(unknownSeats, coopRequest.resources), /bundle identity mismatch/);
      const prototypeAlias = decoded.files.map((file) => ({ ...file, bytes: Buffer.from(file.bytes) }));
      const configFile = prototypeAlias.find((file) => file.path === 'game.config.json');
      const config = JSON.parse(configFile.bytes); config.schema = '__proto__';
      configFile.bytes = Buffer.from(JSON.stringify(config), 'utf8'); configFile.byteLength = configFile.bytes.length;
      assert.throws(() => Sandbox.validateStaticFiles(prototypeAlias, coopRequest.resources, 2), /recipe or seat scope is unsupported/);
    });

    await check('forged candidate bytes fail before a session is retained', () => {
      const forged = clone(generation);
      forged.packet.moduleBundle.files.find((file) => file.path === 'game.js').content = Buffer.from('forged').toString('base64');
      assert.throws(() => Sandbox.createSession({ parentRoot: TEST_PARENT, sessionId: 'forged-session', request: generationRequest, generationResult: forged }), /deterministic verification/);
      assert.strictEqual(fs.existsSync(path.join(TEST_PARENT, 'forged-session')), false);
    });

    await check('junction or symlink parent aliases are rejected when the host supports them', () => {
      const actual = path.join(Sandbox.SANDBOX_STATE_ROOT, 'sandbox-v2.5-selftest-ordinary');
      const alias = path.join(Sandbox.SANDBOX_STATE_ROOT, 'sandbox-v2.5-selftest-alias');
      fs.mkdirSync(actual);
      let linked = false;
      try { fs.symlinkSync(actual, alias, process.platform === 'win32' ? 'junction' : 'dir'); linked = true; } catch {}
      if (linked) {
        assert.throws(() => Sandbox.createSession({ parentRoot: alias, sessionId: 'alias-session', request: generationRequest, generationResult: generation }), /symlink|junction|alias|reparse/);
        fs.unlinkSync(alias);
      }
      fs.rmSync(actual, { recursive: true, force: true });
    });

    await check('network-expanding repair is rejected without changing prior bytes', () => {
      const before = Sandbox.readIteration(session, 'iteration-000');
      const badScript = sourceText(session, 'iteration-000', 'game.js') + '\nfetch("https://example.invalid");\n';
      const plan = Sandbox.repairPlan(session, ['NETWORK_TOKEN_ADVERSARIAL_TEST'], { 'game.js': badScript });
      assert.throws(() => Sandbox.applyRepair(session, plan), /forbidden authority or network token/);
      assert.strictEqual(fs.existsSync(path.join(session.roots.output, '.iteration-001.tmp')), false);
      assert.strictEqual(fs.existsSync(path.join(session.roots.output, 'iteration-001')), false);
      assert.strictEqual(Sandbox.readIteration(session, 'iteration-000').iterationDigest, before.iterationDigest);
    });

    let stalePlan;
    await check('valid repair creates an immutable iteration and privacy-safe inactive lesson', () => {
      const repairedCss = sourceText(session, 'iteration-000', 'styles.css') + '\n/* bounded repair: clearer review focus */\n';
      const plan = Sandbox.repairPlan(session, ['FOCUS_VISIBILITY_REVIEW'], { 'styles.css': repairedCss });
      stalePlan = clone(plan);
      const outcome = Sandbox.applyRepair(session, plan);
      assert.strictEqual(outcome.iteration.id, 'iteration-001');
      assert.notStrictEqual(outcome.iteration.digest, session.receipt.iteration.digest);
      assert.strictEqual(sourceText(session, 'iteration-000', 'styles.css').includes('bounded repair'), false);
      assert.strictEqual(sourceText(session, 'iteration-001', 'styles.css').includes('bounded repair'), true);
      assert.strictEqual(outcome.lesson.status, 'EXPERIMENTAL');
      assert.strictEqual(outcome.lesson.admission.active, false);
      assert.strictEqual(outcome.lesson.admission.installed, false);
      assert(Object.values(outcome.lesson.privacy).every((value) => value === false));
      const lessonText = JSON.stringify(outcome.lesson);
      assert(!lessonText.includes('replacementContent'));
      assert(!lessonText.includes(WORKSHOP));
    });

    await check('stale byte-bound repair plans cannot target a newer iteration', () => {
      assert.throws(() => Sandbox.applyRepair(session, stalePlan), /stale or bound to different bytes/);
    });

    await check('resource iteration ceiling is enforced independently', () => {
      const updatedReadme = sourceText(session, 'iteration-001', 'README.md') + '\nSecond bounded repair.\n';
      Sandbox.applyRepair(session, Sandbox.repairPlan(session, ['README_CLARITY'], { 'README.md': updatedReadme }));
      assert.strictEqual(session.currentIteration.id, 'iteration-002');
      const beyond = sourceText(session, 'iteration-002', 'README.md') + '\nNot allowed.\n';
      assert.throws(() => Sandbox.applyRepair(session, Sandbox.repairPlan(session, ['ITERATION_CEILING_TEST'], { 'README.md': beyond })), /iteration ceiling reached/);
      assert.strictEqual(fs.existsSync(path.join(session.roots.output, 'iteration-003')), false);
    });

    await check('session resume reconstructs the latest immutable iteration from append-only evidence', () => {
      const resumed = Sandbox.resumeSession({ parentRoot: TEST_PARENT, sessionId: session.sessionId, request: generationRequest, generationResult: generation });
      assert.strictEqual(resumed.currentIteration.id, 'iteration-002');
      assert.strictEqual(resumed.currentIteration.digest, session.currentIteration.digest);
    });

    await check('trusted loopback preview serves only allowlisted static candidate bytes', async () => {
      const preview = await Sandbox.startPreview(session);
      try {
        const parsed = new URL(preview.url);
        assert.strictEqual(parsed.hostname, '127.0.0.1');
        assert.strictEqual(preview.candidateProcesses, 0);
        const root = await request(parsed.port, '/');
        assert.strictEqual(root.status, 200);
        assert(root.body.includes('sandbox="allow-scripts"'));
        assert(root.body.includes('not installed'));
        const game = await request(parsed.port, '/candidate/index.html');
        assert.strictEqual(game.status, 200);
        assert(game.headers['content-security-policy'].includes("connect-src 'none'"));
        assert.strictEqual(game.headers['cross-origin-resource-policy'], undefined);
        const post = await request(parsed.port, '/candidate/index.html', 'POST');
        assert.strictEqual(post.status, 405);
        const traversal = await request(parsed.port, '/candidate/%2e%2e%2fevidence%2fsession.receipt.json');
        assert.strictEqual(traversal.status, 404);
        const evidence = await request(parsed.port, '/evidence/session.receipt.json');
        assert.strictEqual(evidence.status, 404);
        const meta = await request(parsed.port, '/meta');
        const metaRecord = JSON.parse(meta.body);
        assert.strictEqual(metaRecord.candidateProcesses, 0);
        assert.strictEqual(metaRecord.authority, 'NONE');
      } finally { await preview.close(); }
    });

    await check('Windows path aliases and authority metadata are not repairable', () => {
      for (const file of ['../game.js', 'C:/game.js', '//server/share/game.js', 'game.js:stream', 'CON.txt', 'module.contract.json', 'candidate.receipt.json']) {
        assert.throws(() => Sandbox.repairPlan(session, ['PATH_ADVERSARIAL_TEST'], { [file]: 'x' }), /path|allowlisted|reserved|colon/i);
      }
      assert.throws(() => Sandbox.createSession({ parentRoot: path.parse(WORKSHOP).root, sessionId: 'broad-root', request: generationRequest, generationResult: generation }), /contained child|Sandbox state root|direct child/);
    });

    process.stdout.write('PASS disposable candidate sandbox (' + count + ' cases)\n');
  } finally {
    cleanup();
  }
})().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
