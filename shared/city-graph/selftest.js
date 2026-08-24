'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./city-map-core');
const Host = require('./city-map-host');

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

function expectCode(code, fn) {
  let observed = null;
  try { fn(); } catch (error) { observed = error; }
  check(observed && observed.code === code, `expected ${code}, observed ${observed && observed.code}`);
  return observed;
}

function declaration(id, options) {
  options = options || {};
  const permissions = options.permissions || [];
  const manifest = {
    id,
    name: options.name || id,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry: options.entry || 'index.js',
    kind: options.kind || 'machine-capability',
    permissions: options.manifestPermissions || permissions,
    uses: [],
    accepts: options.accepts || [],
    produces: options.emits || [],
    tags: options.tags || []
  };
  const contract = {
    id,
    version: 'v0.1',
    permissions: options.contractPermissions || permissions,
    provides: options.provides || [],
    consumes: options.consumes || [],
    handoffs: { accepts: options.accepts || [], emits: options.emits || [] },
    boundaries: { writes: options.writes || [], refuses: ['automatic-promotion'] }
  };
  const root = `tools/${options.folder || id}`;
  return {
    root,
    folder: options.folder || id,
    declarations: [
      { path: `${root}/manifest.json`, sha256: Core.sha256(JSON.stringify(manifest)) },
      { path: `${root}/module.contract.json`, sha256: Core.sha256(JSON.stringify(contract)) }
    ],
    manifest: { path: `${root}/manifest.json`, sha256: Core.sha256(JSON.stringify(manifest)), value: manifest },
    contract: { path: `${root}/module.contract.json`, sha256: Core.sha256(JSON.stringify(contract)), value: contract },
    selftests: [{ path: `${root}/selftest.js`, sha256: Core.sha256('selftest') }],
    evidence: []
  };
}

function snapshot(rows, options) {
  options = options || {};
  return {
    sourceCommit: options.sourceCommit || 'a'.repeat(40),
    roots: ['tools'],
    declarations: rows,
    schemas: options.schemas || [{ id: 'axm.example/v1', path: 'shared/schemas/example.schema.json', sha256: 'b'.repeat(64) }],
    strictSchemas: options.strictSchemas === true
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function hostFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-city-map-'));
  fs.mkdirSync(path.join(root, 'tools', 'fixture-sensor'), { recursive: true });
  fs.mkdirSync(path.join(root, 'shared', 'city-graph'), { recursive: true });
  fs.mkdirSync(path.join(root, 'worlds'), { recursive: true });
  writeJson(path.join(root, 'shared', 'city-graph', 'city-roots.json'), {
    schema: 'axm.city-roots/v1',
    roots: [
      { path: 'tools', mode: 'DIRECT_CHILDREN', declarations: ['manifest.json', 'module.contract.json'] },
      { path: 'shared', mode: 'DIRECT_CHILDREN', idMode: 'ROOT_QUALIFIED', declarations: ['manifest.json', 'module.contract.json'] },
      { path: 'worlds', mode: 'DIRECT_CHILDREN', idMode: 'ROOT_QUALIFIED', declarations: ['world.manifest.json', 'module.contract.json'] }
    ]
  });
  const row = declaration('fixture-sensor', { tags: ['observer'], emits: ['axm.fixture/v1'] });
  writeJson(path.join(root, 'tools', 'fixture-sensor', 'manifest.json'), row.manifest.value);
  writeJson(path.join(root, 'tools', 'fixture-sensor', 'module.contract.json'), row.contract.value);
  fs.writeFileSync(path.join(root, 'tools', 'fixture-sensor', 'selftest.js'), "console.log('fixture');\n");
  writeJson(path.join(root, 'tools', 'fixture-sensor', 'fixture.schema.json'), { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'axm.fixture/v1', type: 'object' });
  return root;
}

function run() {
  check(Host.textSha256(Buffer.from('same\r\ntext\r\n')) === Host.textSha256(Buffer.from('same\ntext\n')), 'text source digests are newline-transport stable');
  const alpha = declaration('alpha-sensor', { provides: ['cap.alpha'], emits: ['axm.example/v1'], tags: ['observer'] });
  const beta = declaration('beta-room', { consumes: ['cap.alpha'], entry: 'index.html', kind: 'product' });
  const graph = Core.compileSnapshot(snapshot([alpha, beta], { strictSchemas: true }));
  check(graph.schema === Core.GRAPH_SCHEMA, 'graph schema');
  check(graph.summary.blocks === 2, 'block count');
  check(graph.summary.edges === 1, 'capability edge');
  check(graph.blocks.find(row => row.id === 'alpha-sensor').classification.kind === 'SENSOR', 'sensor classification');
  check(graph.blocks.find(row => row.id === 'beta-room').classification.kind === 'ROOM', 'room classification');
  check(graph.blocks.every(row => row.authority.availableIsAuthorized === false && row.authority.grants.length === 0), 'authority remains closed');
  check(Core.validateGraph(graph).pass, 'graph validates');
  check(graph.source.commitBinding === 'EXPLICIT_EXTERNAL_SNAPSHOT', 'explicit source snapshot is labelled');
  check(graph.source.snapshotIdentity === graph.source.declarationDigest, 'declaration digest is the snapshot identity');

  const views = Core.buildViews(graph);
  const compared = Core.compareGenerated(graph, views);
  check(compared.state === 'PASS', 'byte-exact generated views pass');
  check(Object.keys(views).length === 9, 'all generated views exist');
  check(views['docs/generated/LEGO_CITY_MAP.md'].includes(graph.semanticDigest), 'human view binds graph digest');

  const timestampA = { value: 1, generatedAt: '2026-01-01T00:00:00Z', path: 'C:\\one\\workspace' };
  const timestampB = { value: 1, generatedAt: '2030-01-01T00:00:00Z', path: 'D:\\other\\workspace' };
  check(Core.semanticDigest(timestampA) === Core.semanticDigest(timestampB), 'timestamps and machine paths do not change semantic digest');

  expectCode('DUPLICATE_BLOCK_ID', () => Core.compileSnapshot(snapshot([alpha, { ...alpha, root: 'tools/other-alpha' }])));
  expectCode('UNRESOLVED_SCHEMA', () => Core.compileSnapshot(snapshot([declaration('schema-miss', { emits: ['axm.missing/v1'] })], { strictSchemas: true })));
  expectCode('EFFECT_PERMISSION_DRIFT', () => Core.compileSnapshot(snapshot([declaration('permission-drift', { manifestPermissions: ['export'], contractPermissions: [] })])));

  const baselineGraph = Core.compileSnapshot(snapshot([alpha]));
  const currentGraph = Core.compileSnapshot(snapshot([alpha, beta]));
  const omission = Core.compareGenerated(currentGraph, Core.buildViews(baselineGraph));
  check(omission.failures.some(row => row.code === 'UNINDEXED_MODULE' && row.modules.includes('beta-room')), 'UNINDEXED_MODULE is explicit');
  check(omission.failures.some(row => row.code === 'CITY_GRAPH_DRIFT'), 'CITY_GRAPH_DRIFT is explicit');

  const authorityDrift = { ...views, 'registry/generated/city-authority-map.json': views['registry/generated/city-authority-map.json'] + ' ' };
  check(Core.compareGenerated(graph, authorityDrift).failures.some(row => row.code === 'AUTHORITY_MAP_STALE'), 'AUTHORITY_MAP_STALE is explicit');
  const humanDrift = { ...views, 'docs/generated/LEGO_CITY_MAP.md': views['docs/generated/LEGO_CITY_MAP.md'] + 'drift\n' };
  check(Core.compareGenerated(graph, humanDrift).failures.some(row => row.code === 'HUMAN_VIEW_DRIFT'), 'HUMAN_VIEW_DRIFT is explicit');

  const root = hostFixture();
  try {
    const unboundGraph = Host.compileRepository(root, { strictSchemas: true });
    check(unboundGraph.source.commit === null, 'committed default avoids self-referential HEAD binding');
    check(unboundGraph.source.commitBinding === 'UNBOUND_SELF_REFERENTIAL_OUTPUT', 'unbound source state is explicit');
    const hostGraph = Host.compileRepository(root, { sourceCommit: 'c'.repeat(40), strictSchemas: true });
    check(hostGraph.summary.blocks === 1, 'host discovers declared module');
    check(hostGraph.schemas.some(row => row.id === 'axm.fixture/v1'), 'host discovers schemas');
    writeJson(path.join(root, 'tools', 'fixture-sensor', '.pytest_cache', 'README.md'), { local: true });
    writeJson(path.join(root, 'tools', 'fixture-sensor', '__pycache__', 'cache.json'), { local: true });
    writeJson(path.join(root, 'tools', 'fixture-sensor', 'workspace', 'attempt.json'), { local: true });
    fs.mkdirSync(path.join(root, 'tools', 'fixture-sensor', 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tools', 'fixture-sensor', 'runtime', 'bridge_token.txt'), 'local-only\n');
    const localStateGraph = Host.compileRepository(root, { sourceCommit: 'c'.repeat(40), strictSchemas: true });
    check(localStateGraph.semanticDigest === hostGraph.semanticDigest, 'host ignores local caches, workspaces, and secret-log files');
    const written = Host.writeRepositoryViews(root, { sourceCommit: 'c'.repeat(40), strictSchemas: true });
    check(written.graph.semanticDigest === hostGraph.semanticDigest, 'host write preserves graph digest');
    check(Host.checkRepository(root, { sourceCommit: 'c'.repeat(40), strictSchemas: true }).state === 'PASS', 'host check passes exact generated views');
    fs.writeFileSync(path.join(root, 'docs', 'generated', 'LEGO_CITY_MAP.md'), 'drift\n');
    check(Host.checkRepository(root, { sourceCommit: 'c'.repeat(40), strictSchemas: true }).failures.some(row => row.code === 'HUMAN_VIEW_DRIFT'), 'host sees human drift');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }

  check(graph.truth.automaticInstall === false, 'no automatic install');
  check(graph.truth.automaticExecution === false, 'no automatic execution');
  check(graph.truth.automaticPromotion === false, 'no automatic promotion');
  check(graph.truth.automaticCanon === false, 'no automatic CANON');
  process.stdout.write(`city-map selftest passed: ${assertions} assertions\n`);
  return assertions;
}

if (require.main === module) run();

module.exports = { run };
