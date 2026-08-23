'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Planner = require('../../shared/code-capability-fabric/workshop-contract-repair-planner-v1');
const Shadow = require('./workshop-contract-repair-sandbox-v1');

const WORKSHOP = path.resolve(__dirname, '../..');
const TEST_PARENT = path.join(Shadow.CONTRACT_REPAIR_STATE_ROOT, 'contract-repair-v0.6-selftest');
const FIXTURE_PARENT = path.join(WORKSHOP, 'state', 'workshop-contract-repair-fixtures');
const SOURCE = path.join(FIXTURE_PARENT, 'legacy-workshop');
const NOW = '2026-08-23T05:00:00.000Z';
const TOOL = 'legacy-tool';
let passed = 0;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function check(name, fn) { return Promise.resolve().then(fn).then(() => { passed += 1; process.stdout.write('PASS ' + name + '\n'); }, (error) => { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }); }
function writableTree(root) { if (!fs.existsSync(root)) return; for (const entry of fs.readdirSync(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isDirectory() && !entry.isSymbolicLink()) writableTree(target); else if (entry.isFile()) { try { fs.chmodSync(target, 0o644); } catch {} } } try { fs.chmodSync(root, 0o755); } catch {} }
function cleanup() { for (const root of [TEST_PARENT, FIXTURE_PARENT]) { writableTree(root); fs.rmSync(root, { recursive: true, force: true }); } }
function writeJson(target, value) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n'); }
function legacyManifest(note = 'fixture') { return { id: TOOL, name: 'Legacy Fixture', version: '0.1.0', status: 'TEST', entry: 'index.js', contract: 'module.contract.json', type: 'local-module', audience: 'human-machine', uses: [], permissions: [], tags: ['fixture'], notes: note }; }
function moduleContract() { return { schema: 'axm.module-contract/v1', id: TOOL, version: '0.1.0', provides: ['fixture.observe'], consumes: [], permissions: [], handoffs: { emits: [], accepts: [] }, boundaries: { writes: [], refuses: ['automatic-installation', 'automatic-canon'] }, lifecycle: { state_owner: 'none', reload: 'not-applicable', disconnect: 'not-applicable', cleanup: 'not-applicable' } }; }
function makeFixture() { const root = path.join(SOURCE, 'tools', TOOL); fs.mkdirSync(root, { recursive: true }); writeJson(path.join(root, 'manifest.json'), legacyManifest()); writeJson(path.join(root, 'module.contract.json'), moduleContract()); fs.writeFileSync(path.join(root, 'index.js'), "'use strict';\nmodule.exports = 'fixture';\n"); fs.writeFileSync(path.join(root, 'selftest.js'), "'use strict';\nif (require('./index') !== 'fixture') process.exitCode = 1;\n"); }
function treeDigest(root) { const hash = crypto.createHash('sha256'); function walk(folder) { for (const entry of fs.readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const target = path.join(folder, entry.name), relative = path.relative(root, target).split(path.sep).join('/'); hash.update(relative + '\0' + (entry.isDirectory() ? 'd' : 'f') + '\n'); if (entry.isDirectory() && !entry.isSymbolicLink()) walk(target); else if (entry.isFile()) hash.update(fs.readFileSync(target)); } } walk(root); return hash.digest('hex'); }
function request() { return Planner.buildExampleRequest(NOW, 'fixture-current-workshop', TOOL); }
function httpRequest(port, pathname, method = 'GET') { return new Promise((resolve, reject) => { const req = http.request({ hostname: '127.0.0.1', port, path: pathname, method }, (res) => { const chunks = []; res.on('data', (chunk) => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })); }); req.on('error', reject); req.end(); }); }
function allFiles(root) { const result = []; function walk(folder) { for (const entry of fs.readdirSync(folder, { withFileTypes: true })) { const target = path.join(folder, entry.name); if (entry.isDirectory()) walk(target); else if (entry.isFile()) result.push(target); } } walk(root); return result; }

(async () => {
  cleanup(); makeFixture(); fs.mkdirSync(TEST_PARENT, { recursive: true });
  const inputRequest = request(); let prepared, session;
  try {
    await check('receipt schema is closed and trusted generator lineage is fixed', () => {
      const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'workshop-contract-repair-draft-receipt.schema.json'), 'utf8'));
      const walk = (node) => { if (!node || typeof node !== 'object') return; if (node.type === 'object' && node.properties) assert.strictEqual(node.additionalProperties, false); Object.values(node).forEach(walk); }; walk(schema);
      assert.deepStrictEqual(Shadow.GENERATOR_PATHS, ['tools/sandbox/workshop-contract-repair-sandbox-v1.js', 'shared/code-capability-fabric/workshop-contract-repair-planner-v1.js', 'shared/readiness/tool-readiness.js', 'hub/module-contract-verifier.js', 'tools/deterministic-json-core/index.js']);
    });
    await check('identical current bytes produce byte-identical detached alternatives', () => {
      prepared = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest }); const second = Shadow.prepare({ sourceRoot: SOURCE, request: clone(inputRequest) });
      assert.strictEqual(prepared.preparedDigest, second.preparedDigest); assert.deepStrictEqual(prepared.outputRefs, second.outputRefs); prepared.outputs.forEach((output, index) => assert.strictEqual(Buffer.compare(output.bytes, second.outputs[index].bytes), 0));
      assert.strictEqual(prepared.plan.finding, 'LEGACY_MANIFEST_SCHEMA_AND_KIND_MISSING'); assert.strictEqual(prepared.plan.status, 'DRAFT_ALTERNATIVES_PLANNED');
    });
    await check('five alternatives add only schema and kind and remain unranked', () => {
      assert.deepStrictEqual(prepared.candidate.alternatives.map((entry) => entry.kind), Planner.ALLOWED_KINDS); assert.strictEqual(prepared.candidate.comparison.selectedAlternative, null); assert.strictEqual(prepared.candidate.comparison.ranking, 'NONE');
      const original = legacyManifest();
      for (const alternative of prepared.candidate.alternatives) { const output = prepared.outputs.find((entry) => entry.path === alternative.candidateRef.path), value = JSON.parse(output.bytes); assert.strictEqual(value.schema, 'axm.tool-manifest/v1'); assert.strictEqual(value.kind, alternative.kind); delete value.schema; delete value.kind; assert.deepStrictEqual(value, original); assert.strictEqual(alternative.manifestValidation.pass, true); assert.strictEqual(alternative.contractValidation.pass, true); assert.strictEqual(alternative.semanticFitness, 'UNKNOWN'); }
    });
    await check('required tests are exact inert argv and none are reported as run', () => { assert.strictEqual(prepared.plan.requiredTests.length, 4); assert(prepared.plan.requiredTests.every((test) => test.command[0] === 'node' && test.status === 'NOT_RUN' && test.evidenceRefs.length === 0)); });
    await check('materialization creates disjoint immutable roots without changing source', () => {
      const before = treeDigest(SOURCE); session = Shadow.createSession({ parentRoot: TEST_PARENT, sessionId: 'legacy-contract-repair', prepared }); assert.strictEqual(treeDigest(SOURCE), before); assert.strictEqual(session.latest.id, 'iteration-000');
      const roots = Object.values(Shadow.ROOT_NAMES).map((name) => fs.realpathSync.native(path.join(session.sessionRoot, name)).toLowerCase()); assert.strictEqual(new Set(roots).size, 3); assert.strictEqual(session.latest.receipt.outputRefs.length, 6); assert.strictEqual(session.latest.receipt.authority, 'NONE');
    });
    await check('durable evidence excludes source bytes, machine paths, stdout, and stderr', () => {
      const evidenceFiles = [...allFiles(path.join(session.sessionRoot, 'source')), ...allFiles(path.join(session.sessionRoot, 'evidence'))];
      for (const file of evidenceFiles) { const text = fs.readFileSync(file, 'utf8'); assert(!text.includes(SOURCE)); assert(!text.includes(WORKSHOP)); assert(!text.includes('Legacy Fixture')); assert(!text.includes('stdoutContent')); assert(!text.includes('stderrContent')); }
      assert.strictEqual(session.latest.receipt.privacy.sourceBytesInEvidence, false); assert.strictEqual(session.latest.receipt.privacy.candidateBytesInOutput, true);
    });
    await check('unchanged relevant bytes create no duplicate iteration', () => { const result = Shadow.refreshSession(session); assert.strictEqual(result.status, 'CURRENT_NO_NEW_ITERATION'); assert.deepStrictEqual(fs.readdirSync(path.join(session.sessionRoot, 'output')), ['iteration-000']); });
    let stale;
    await check('changed bytes block stale writes and stale preview', async () => {
      stale = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest }); writeJson(path.join(SOURCE, 'tools', TOOL, 'manifest.json'), legacyManifest('changed'));
      assert.throws(() => Shadow.createSession({ parentRoot: TEST_PARENT, sessionId: 'stale-repair', prepared: stale }), /lineage drifted|source changed before write/); assert.strictEqual(fs.existsSync(path.join(TEST_PARENT, 'stale-repair')), false); await assert.rejects(() => Shadow.startPreview(session), /STALE_REFRESH_REQUIRED/);
    });
    await check('refresh appends one new immutable current-source iteration', () => { const before = fs.readFileSync(path.join(session.latest.outputRoot, 'candidate-packet.json')); const result = Shadow.refreshSession(session); assert.strictEqual(result.status, 'NEW_ITERATION_DRAFTED'); session = result.session; assert.strictEqual(session.latest.id, 'iteration-001'); assert.strictEqual(Buffer.compare(before, fs.readFileSync(path.join(session.sessionRoot, 'output', 'iteration-000', 'candidate-packet.json'))), 0); });
    await check('resume revalidates request, generator, observation, plan, packet, and all candidate bytes', () => { const resumed = Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest }); assert.strictEqual(resumed.latest.id, 'iteration-001'); assert.strictEqual(resumed.latest.candidate.candidateDigest, session.latest.candidate.candidateDigest); });
    await check('forged candidate, plan, and receipt fields fail closed', () => {
      const candidatePath = path.join(session.latest.outputRoot, 'alternatives', 'kind-product', 'manifest.json'), original = fs.readFileSync(candidatePath); fs.chmodSync(candidatePath, 0o644); fs.writeFileSync(candidatePath, Buffer.from('{}\n')); assert.throws(() => Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest }), /output bytes drifted/); fs.writeFileSync(candidatePath, original); fs.chmodSync(candidatePath, 0o444);
      const planPath = path.join(session.sessionRoot, 'evidence', 'iteration-001.plan.json'), planBytes = fs.readFileSync(planPath), forgedPlan = JSON.parse(planBytes); forgedPlan.ranking = 'PREFERRED'; fs.chmodSync(planPath, 0o644); fs.writeFileSync(planPath, JSON.stringify(forgedPlan) + '\n'); assert.throws(() => Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest }), /identity drifted|digest mismatch/); fs.writeFileSync(planPath, planBytes); fs.chmodSync(planPath, 0o444);
      const receiptPath = path.join(session.sessionRoot, 'evidence', 'iteration-001.receipt.json'), receiptBytes = fs.readFileSync(receiptPath), forgedReceipt = JSON.parse(receiptBytes); forgedReceipt.extra = true; fs.chmodSync(receiptPath, 0o644); fs.writeFileSync(receiptPath, JSON.stringify(forgedReceipt) + '\n'); assert.throws(() => Shadow.resumeSession({ sourceRoot: SOURCE, parentRoot: TEST_PARENT, sessionId: session.sessionId, request: inputRequest }), /fields are not exact/); fs.writeFileSync(receiptPath, receiptBytes); fs.chmodSync(receiptPath, 0o444);
    });
    await check('duplicate top-level records and malformed authority records fail closed', () => {
      const manifestPath = path.join(SOURCE, 'tools', TOOL, 'manifest.json'), original = fs.readFileSync(manifestPath); fs.writeFileSync(manifestPath, '{"id":"legacy-tool","id":"forged"}\n'); assert.throws(() => Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest }), /duplicate top-level field/); fs.writeFileSync(manifestPath, original);
      const forged = clone(inputRequest); forged.authorization.machineSelection = true; delete forged.requestDigest; assert.throws(() => Planner.sealRequest(forged), /authorization drifted/);
    });
    await check('trusted preview exposes inert alternatives and exact authority controls only', async () => {
      const preview = await Shadow.startPreview(session); try { const parsed = new URL(preview.url), root = await httpRequest(parsed.port, '/'); assert.strictEqual(parsed.hostname, '127.0.0.1'); assert.strictEqual(root.status, 200); assert(root.headers['content-security-policy'].includes("default-src 'none'")); assert(!root.body.toString().includes('<script')); assert(root.body.toString().includes('<details>')); assert(root.body.toString().includes('Nothing selected'));
        const packet = JSON.parse((await httpRequest(parsed.port, '/candidate/candidate-packet.json')).body); assert.strictEqual(packet.comparison.selectedAlternative, null); const manifest = JSON.parse((await httpRequest(parsed.port, '/candidate/alternatives/kind-product/manifest.json')).body); assert.strictEqual(manifest.kind, 'product'); const meta = JSON.parse((await httpRequest(parsed.port, '/meta')).body); assert.strictEqual(meta.candidateExecuted, false); assert.strictEqual(meta.testsExecuted, false); assert.strictEqual(meta.authority, 'NONE'); assert.strictEqual((await httpRequest(parsed.port, '/', 'POST')).status, 405); assert.strictEqual((await httpRequest(parsed.port, '/candidate/../evidence/iteration-001.receipt.json')).status, 404);
        const sourceManifest = path.join(SOURCE, 'tools', TOOL, 'manifest.json'), sourceBytes = fs.readFileSync(sourceManifest); writeJson(sourceManifest, legacyManifest('preview-drift')); assert.strictEqual((await httpRequest(parsed.port, '/')).status, 409); fs.writeFileSync(sourceManifest, sourceBytes); assert.strictEqual((await httpRequest(parsed.port, '/')).status, 200);
      } finally { await preview.close(); }
    });
    await check('Windows aliases, traversal, broad roots, and junctions fail closed', () => {
      for (const value of ['C:/tools/x/manifest.json', '//server/share/file', 'tools/x:stream/manifest.json', 'tools/../manifest.json', 'tools/CON/manifest.json']) assert.throws(() => Planner.portablePath(value, 'path'), /portable|Windows-unsafe/);
      assert.throws(() => Shadow.createSession({ parentRoot: path.parse(WORKSHOP).root, sessionId: 'broad-root', prepared: Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest }) }), /contained|state root|direct child/);
      const alias = path.join(FIXTURE_PARENT, 'source-alias'); let linked = false; try { fs.symlinkSync(SOURCE, alias, process.platform === 'win32' ? 'junction' : 'dir'); linked = true; } catch {} if (linked) { assert.throws(() => Shadow.prepare({ sourceRoot: alias, request: inputRequest }), /ordinary|symlink|junction|alias/); fs.unlinkSync(alias); }
    });
    await check('a modern declared manifest emits no candidate and cannot materialize', () => {
      const modern = { schema: 'axm.tool-manifest/v1', kind: 'product', ...legacyManifest('modern') }; writeJson(path.join(SOURCE, 'tools', TOOL, 'manifest.json'), modern); const current = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest }); assert.strictEqual(current.plan.status, 'CURRENT_NO_DRAFT'); assert.strictEqual(current.candidate, null); assert.strictEqual(current.outputs.length, 0); assert.throws(() => Shadow.createSession({ parentRoot: TEST_PARENT, sessionId: 'no-draft', prepared: current }), /only planned/);
    });
    await check('additional manifest defects produce HOLD rather than a partial repair', () => { const broken = legacyManifest('broken'); delete broken.entry; writeJson(path.join(SOURCE, 'tools', TOOL, 'manifest.json'), broken); const held = Shadow.prepare({ sourceRoot: SOURCE, request: inputRequest }); assert.strictEqual(held.plan.status, 'HOLD'); assert.strictEqual(held.plan.finding, 'ADDITIONAL_DEFECTS_REQUIRE_SEPARATE_REQUEST'); assert.strictEqual(held.outputs.length, 0); });
    await check('resource and lifecycle receipts retain zero execution and zero authority', () => { const receipt = session.latest.receipt; assert.strictEqual(receipt.resources.inputFiles, 3); assert.strictEqual(receipt.resources.outputFiles, 6); assert.strictEqual(receipt.resources.networkRequests, 0); assert.strictEqual(receipt.resources.childProcesses, 0); for (const key of ['sourceWritten', 'machineSelected', 'candidateExecuted', 'testsExecuted', 'installed', 'integrated', 'published', 'promoted', 'canonChanged']) assert.strictEqual(receipt.truth[key], false); assert.strictEqual(receipt.authority, 'NONE'); });
    process.stdout.write('PASS Workshop contract repair sandbox (' + passed + ' cases)\n');
  } finally { cleanup(); }
})().catch((error) => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
