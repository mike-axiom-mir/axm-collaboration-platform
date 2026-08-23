'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Planner = require('../../shared/code-capability-fabric/workshop-shadow-improvement-planner-v1');
const Readiness = require('../../shared/readiness/tool-readiness');
const Shadow = require('./workshop-shadow-sandbox-v1');

const WORKSHOP = path.resolve(__dirname, '../..');
const TEST_PARENT = path.join(Shadow.SHADOW_STATE_ROOT, 'shadow-v0.5-selftest');
const FIXTURE_PARENT = path.join(WORKSHOP, 'state', 'workshop-shadow-fixtures');
const SOURCE = path.join(FIXTURE_PARENT, 'shadow-v0.5-source');
const NOW = '2026-08-23T03:00:00.000Z';
let passed = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function check(name, fn) {
  return Promise.resolve().then(fn).then(() => { passed += 1; process.stdout.write('PASS ' + name + '\n'); }, (error) => { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; });
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
function cleanup() {
  for (const root of [TEST_PARENT, FIXTURE_PARENT]) { writableTree(root); fs.rmSync(root, { recursive: true, force: true }); }
}
function writeJson(target, value) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n'); }
function alphaManifest(version) {
  return { schema: 'axm.tool-manifest/v1', kind: 'product', id: 'alpha', name: 'Alpha Fixture', version, status: 'TEST', entry: 'index.js', contract: 'module.contract.json', audience: 'human', uses: [], permissions: [], tags: ['fixture'] };
}
function moduleContract(id) {
  return { schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [id + '.capability'], consumes: [], permissions: [], handoffs: { emits: [], accepts: [] }, boundaries: { writes: [], refuses: ['automatic-installation', 'automatic-canon'] }, lifecycle: { state_owner: 'none', reload: 'not-applicable', disconnect: 'not-applicable', cleanup: 'not-applicable' } };
}
function makeTool(root, id, version) {
  const folder = path.join(root, 'tools', id);
  fs.mkdirSync(folder, { recursive: true });
  writeJson(path.join(folder, 'manifest.json'), id === 'alpha' ? alphaManifest(version) : { ...alphaManifest(version), id, name: 'Beta Fixture' });
  writeJson(path.join(folder, 'module.contract.json'), moduleContract(id));
  fs.writeFileSync(path.join(folder, 'index.js'), "'use strict';\nmodule.exports = Object.freeze({ id: '" + id + "' });\n");
  fs.writeFileSync(path.join(folder, 'selftest.js'), "'use strict';\nif (require('./index').id !== '" + id + "') process.exitCode = 1;\n");
  fs.writeFileSync(path.join(folder, 'README.md'), '# ' + id + '\n');
}
function makeFixture() {
  fs.mkdirSync(path.join(SOURCE, 'shared', 'readiness'), { recursive: true });
  fs.mkdirSync(path.join(SOURCE, 'tools'), { recursive: true });
  fs.writeFileSync(path.join(SOURCE, 'verify.js'), "'use strict';\n");
  writeJson(path.join(SOURCE, 'shared', 'readiness', 'promotion-ladder.json'), { schema: 'axm.promotion-ladder/v1', freshnessDays: 30 });
  makeTool(SOURCE, 'alpha', '1.0.0');
  const current = Readiness.buildIndex(SOURCE, { now: NOW, promotionLadderFile: path.join(SOURCE, 'shared', 'readiness', 'promotion-ladder.json') });
  writeJson(path.join(SOURCE, 'tools-index.json'), current);
  writeJson(path.join(SOURCE, 'tools', 'alpha', 'manifest.json'), alphaManifest('1.0.1'));
}
function treeDigest(root) {
  const hash = crypto.createHash('sha256');
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(folder, entry.name), relative = path.relative(root, target).split(path.sep).join('/');
      hash.update(relative + '\0' + (entry.isDirectory() ? 'd' : 'f') + '\n');
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(target);
      else if (entry.isFile()) hash.update(fs.readFileSync(target));
    }
  }
  walk(root); return hash.digest('hex');
}
function request() { return Planner.buildExampleRequest(NOW, 'fixture-current-workshop'); }
function httpRequest(port, pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method }, (res) => {
      const chunks = []; res.on('data', (chunk) => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject); req.end();
  });
}

(async () => {
  cleanup(); makeFixture(); fs.mkdirSync(TEST_PARENT, { recursive: true });
  const inputRequest = request();
  let prepared, session;
  try {
    await check('receipt schema is closed and the module exposes fixed trusted generator inputs', () => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'workshop-shadow-draft-receipt.schema.json'), 'utf8'));
      const walk = (node) => { if (!node || typeof node !== 'object') return; if (node.type === 'object' && node.properties) assert.strictEqual(node.additionalProperties, false); Object.values(node).forEach(walk); };
      walk(schema);
      assert.deepStrictEqual(Shadow.GENERATOR_PATHS, [
        'tools/sandbox/workshop-shadow-sandbox-v1.js', 'shared/code-capability-fabric/workshop-shadow-improvement-planner-v1.js', 'shared/readiness/tool-readiness.js', 'hub/module-contract-verifier.js', 'tools/deterministic-json-core/index.js'
      ]);
      Shadow.GENERATOR_PATHS.forEach((relative) => assert(fs.existsSync(path.join(WORKSHOP, ...relative.split('/')))));
    });

    await check('identical exact source and request prepare byte-identical plans and drafts', () => {
      prepared = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest });
      const second = Shadow.prepare({ sourceRoot: SOURCE, request: clone(inputRequest) });
      assert.strictEqual(prepared.preparedDigest, second.preparedDigest);
      assert.deepStrictEqual(prepared.snapshot, second.snapshot);
      assert.deepStrictEqual(prepared.plan, second.plan);
      assert.strictEqual(Buffer.compare(prepared.rebuiltBytes, second.rebuiltBytes), 0);
      assert.strictEqual(prepared.plan.finding, 'TOOLS_INDEX_SOURCE_DIGEST_STALE');
      assert.strictEqual(prepared.plan.status, 'DRAFT_PLANNED');
    });

    await check('snapshot is privacy-scoped, byte-bound, and includes the source-local ladder', () => {
      const refs = prepared.snapshot.inputRefs;
      assert(refs.some((ref) => ref.path === 'shared/readiness/promotion-ladder.json'));
      assert(refs.some((ref) => ref.path === 'tools/alpha/manifest.json'));
      assert(refs.some((ref) => ref.path === 'tools/alpha/module.contract.json'));
      assert(refs.some((ref) => ref.path === 'tools/alpha/selftest.js'));
      assert.strictEqual(prepared.snapshot.resources.inputFiles, refs.length);
      assert.strictEqual(prepared.snapshot.resources.inputBytes, refs.reduce((sum, ref) => sum + ref.byteLength, 0));
      assert.deepStrictEqual(prepared.snapshot.privacy, { rawSourceRetained: false, machinePathsRetained: false, secretsRead: false });
    });

    await check('creates disjoint immutable roots without changing one source byte', () => {
      const before = treeDigest(SOURCE);
      session = Shadow.createSession({ parentRoot: TEST_PARENT, sessionId: 'current-workshop-shadow', prepared });
      assert.strictEqual(treeDigest(SOURCE), before);
      const roots = ['source', 'output', 'evidence'].map((name) => fs.realpathSync.native(path.join(session.sessionRoot, name)).toLowerCase());
      assert.strictEqual(new Set(roots).size, 3);
      assert.strictEqual(session.latest.id, 'iteration-000');
      assert.strictEqual(session.latest.receipt.truth.sourceWritten, false);
      assert.strictEqual(session.latest.receipt.truth.candidateExecuted, false);
      assert.strictEqual(session.latest.receipt.truth.installed, false);
      assert.strictEqual(session.latest.receipt.authority, 'NONE');
      assert.strictEqual(session.latest.receipt.generatorRefs.length, 5);
    });

    await check('durable snapshot, plan, receipt, and candidate retain no machine path or raw source', () => {
      for (const rootName of ['source', 'output', 'evidence']) {
        const root = path.join(session.sessionRoot, rootName);
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          const files = entry.isDirectory() ? fs.readdirSync(path.join(root, entry.name)).map((name) => path.join(root, entry.name, name)) : [path.join(root, entry.name)];
          for (const file of files) {
            const text = fs.readFileSync(file, 'utf8');
            assert(!text.includes(SOURCE)); assert(!text.includes(WORKSHOP)); assert(!text.includes("module.exports = Object.freeze"));
            assert(!text.includes('stdoutContent')); assert(!text.includes('stderrContent')); assert(!text.includes('authorization header'));
          }
        }
      }
    });

    await check('unchanged scoped source creates no duplicate immutable iteration', () => {
      const before = fs.readFileSync(path.join(session.latest.outputRoot, 'tools-index.json'));
      const result = Shadow.refreshSession(session);
      assert.strictEqual(result.status, 'CURRENT_NO_NEW_ITERATION');
      assert.deepStrictEqual(fs.readdirSync(path.join(session.sessionRoot, 'output')), ['iteration-000']);
      assert.strictEqual(Buffer.compare(before, fs.readFileSync(path.join(session.latest.outputRoot, 'tools-index.json'))), 0);
    });

    let stalePrepared;
    await check('changed source blocks stale materialization and stale preview', async () => {
      stalePrepared = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest });
      makeTool(SOURCE, 'beta', '1.0.0');
      assert.throws(() => Shadow.createSession({ parentRoot: TEST_PARENT, sessionId: 'stale-prepared', prepared: stalePrepared }), /SOURCE_CHANGED_BEFORE_SHADOW_WRITE/);
      assert.strictEqual(fs.existsSync(path.join(TEST_PARENT, 'stale-prepared')), false);
      await assert.rejects(() => Shadow.startPreview(session), /SHADOW_DRAFT_STALE_REFRESH_REQUIRED/);
    });

    await check('refresh appends a new byte-bound iteration and preserves the old bytes', () => {
      const oldBytes = fs.readFileSync(path.join(session.latest.outputRoot, 'tools-index.json'));
      const result = Shadow.refreshSession(session);
      assert.strictEqual(result.status, 'REFRESHED_WITH_NEW_DRAFT');
      assert.strictEqual(session.latest.id, 'iteration-001');
      assert.deepStrictEqual(fs.readdirSync(path.join(session.sessionRoot, 'output')), ['iteration-000', 'iteration-001']);
      assert.strictEqual(Buffer.compare(oldBytes, fs.readFileSync(path.join(session.sessionRoot, 'output', 'iteration-000', 'tools-index.json'))), 0);
      assert(session.latest.plan.comparison.addedToolIds.includes('beta'));
      assert.strictEqual(session.latest.receipt.sourceStateDigest, result.prepared.snapshot.sourceStateDigest);
    });

    await check('resume revalidates contiguous receipt, request, generator, and output lineage', () => {
      const resumed = Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest });
      assert.strictEqual(resumed.latest.id, 'iteration-001');
      assert.strictEqual(resumed.latest.receipt.outputRef.sha256, session.latest.receipt.outputRef.sha256);
      assert.deepStrictEqual(resumed.latest.receipt.generatorRefs, session.latest.receipt.generatorRefs);
    });

    await check('forged candidate bytes and forged durable records fail closed', () => {
      const output = path.join(session.latest.outputRoot, 'tools-index.json'), original = fs.readFileSync(output);
      fs.chmodSync(output, 0o644); fs.writeFileSync(output, Buffer.from('{}\n'));
      assert.throws(() => Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest }), /output bytes drifted/);
      fs.writeFileSync(output, original); fs.chmodSync(output, 0o444);
      const planPath = path.join(session.sessionRoot, 'evidence', 'iteration-001.plan.json'), originalPlan = fs.readFileSync(planPath), forgedPlan = JSON.parse(originalPlan.toString('utf8'));
      forgedPlan.extra = true; fs.chmodSync(planPath, 0o644); fs.writeFileSync(planPath, JSON.stringify(forgedPlan, null, 2) + '\n');
      assert.throws(() => Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest }), /snapshot or plan lineage drifted/);
      fs.writeFileSync(planPath, originalPlan); fs.chmodSync(planPath, 0o444);
      const receiptPath = path.join(session.sessionRoot, 'evidence', 'iteration-001.receipt.json'), originalReceipt = fs.readFileSync(receiptPath), forgedReceipt = JSON.parse(originalReceipt.toString('utf8'));
      forgedReceipt.extra = true; delete forgedReceipt.receiptDigest; forgedReceipt.receiptDigest = Shadow.hashValue(forgedReceipt); fs.chmodSync(receiptPath, 0o644); fs.writeFileSync(receiptPath, JSON.stringify(forgedReceipt, null, 2) + '\n');
      assert.throws(() => Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest }), /fields are not closed/);
      fs.writeFileSync(receiptPath, originalReceipt); fs.chmodSync(receiptPath, 0o444);
      const forged = clone(stalePrepared); forged.snapshot.sourceStateDigest = Planner.hashValue('forged');
      assert.throws(() => Shadow.verifyPrepared(forged), /snapshot digest mismatch|lineage drifted/);
    });

    await check('trusted preview serves a script-free review shell and inert JSON only', async () => {
      const preview = await Shadow.startPreview(session);
      try {
        const parsed = new URL(preview.url);
        assert.strictEqual(parsed.hostname, '127.0.0.1');
        assert.strictEqual(preview.candidateProcesses, 0);
        assert.strictEqual(preview.candidateExecuted, false);
        assert.strictEqual(preview.installed, false);
        const root = await httpRequest(parsed.port, '/');
        assert.strictEqual(root.status, 200);
        assert(root.headers['content-security-policy'].includes("default-src 'none'"));
        assert(!root.body.toString('utf8').includes('<script'));
        assert(root.body.toString('utf8').includes('<details>'));
        assert(root.body.toString('utf8').includes('no source write-back'));
        const candidate = await httpRequest(parsed.port, '/candidate/tools-index.json');
        assert.strictEqual(candidate.status, 200);
        assert.strictEqual(candidate.headers['x-content-type-options'], 'nosniff');
        assert.strictEqual(JSON.parse(candidate.body.toString('utf8')).schema, 'axm.tools-index/v1');
        const meta = JSON.parse((await httpRequest(parsed.port, '/meta')).body.toString('utf8'));
        assert.strictEqual(meta.candidateExecuted, false); assert.strictEqual(meta.installed, false); assert.strictEqual(meta.authority, 'NONE');
        assert.strictEqual((await httpRequest(parsed.port, '/', 'POST')).status, 405);
        assert.strictEqual((await httpRequest(parsed.port, '/evidence/iteration-001.receipt.json')).status, 404);
        assert.strictEqual((await httpRequest(parsed.port, '/candidate/%2e%2e%2fevidence%2fiteration-001.receipt.json')).status, 404);
      } finally { await preview.close(); }
    });

    await check('Windows aliases, ADS, traversal, broad state roots, and junction roots fail closed', () => {
      for (const value of ['C:/tools-index.json', '//server/share/tools-index.json', '..\\tools-index.json', 'tools-index.json:stream', 'CON.json']) assert.throws(() => Planner.portablePath(value, 'path'), /portable relative path/);
      assert.throws(() => Shadow.createSession({ parentRoot: path.parse(WORKSHOP).root, sessionId: 'broad-root', prepared: Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest }) }), /contained|shadow state root|direct child/);
      const alias = path.join(FIXTURE_PARENT, 'source-alias'); let linked = false;
      try { fs.symlinkSync(SOURCE, alias, process.platform === 'win32' ? 'junction' : 'dir'); linked = true; } catch {}
      if (linked) { assert.throws(() => Shadow.prepare({ sourceRoot: alias, request: inputRequest }), /symlink|junction|alias/); fs.unlinkSync(alias); }
    });

    await check('a source with the exact current index emits no detached draft', () => {
      const fresh = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest });
      fs.writeFileSync(path.join(SOURCE, 'tools-index.json'), fresh.rebuiltBytes);
      const current = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest });
      assert.strictEqual(current.plan.status, 'CURRENT_NO_DRAFT');
      assert.strictEqual(current.plan.finding, 'NONE');
      assert.throws(() => Shadow.createSession({ parentRoot: TEST_PARENT, sessionId: 'no-change', prepared: current }), /NO_SHADOW_IMPROVEMENT_TO_DRAFT/);
      assert.strictEqual(fs.existsSync(path.join(TEST_PARENT, 'no-change')), false);
    });

    await check('fixed resources remain measured and every lifecycle authority stays false', () => {
      const receipt = session.latest.receipt;
      assert.strictEqual(receipt.resources.snapshotFiles, 1);
      assert.strictEqual(receipt.resources.outputFiles, 1);
      assert.strictEqual(receipt.resources.evidenceFiles, 2);
      assert.strictEqual(receipt.resources.networkRequests, 0);
      assert.strictEqual(receipt.resources.childProcesses, 0);
      assert.strictEqual(receipt.resources.enforced, true);
      for (const key of ['sourceWritten', 'candidateExecuted', 'previewStarted', 'installed', 'integrated', 'published', 'promoted', 'canonChanged']) assert.strictEqual(receipt.truth[key], false);
    });

    process.stdout.write('PASS Workshop shadow sandbox (' + passed + ' cases)\n');
  } finally { cleanup(); }
})().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
