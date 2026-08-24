'use strict';

const assert = require('assert');
const plane = require('./code-developer-relationship-plane.js');
const diagnostics = require('./code-developer-diagnostics.js');
const keyboard = require('./machine-code-keyboard-router.js');

const graph = plane.buildGraph({ observations: [
  {
    sourceClass: 'LSP',
    nodes: [
      { id: 'file:game.js', kind: 'FILE', label: 'game.js', languageId: 'javascript', path: 'src/game.js', digest: 'sha256:game-v2' },
      { id: 'file:main.js', kind: 'FILE', label: 'main.js', languageId: 'javascript', path: 'src/main.js', digest: 'sha256:main-v1' },
      { id: 'sym:update', kind: 'SYMBOL', label: 'update', languageId: 'javascript' },
      { id: 'sym:main', kind: 'SYMBOL', label: 'main', languageId: 'javascript' },
      { id: 'sym:sink', kind: 'SYMBOL', label: 'renderState', languageId: 'javascript' }
    ],
    edges: [
      { from: 'file:game.js', to: 'sym:update', class: 'DEFINES', evidenceDigest: 'sha256:def-update' },
      { from: 'file:main.js', to: 'sym:main', class: 'DEFINES', evidenceDigest: 'sha256:def-main' },
      { from: 'sym:main', to: 'sym:update', class: 'CALLS', evidenceDigest: 'sha256:call-main-update' },
      { from: 'file:main.js', to: 'file:game.js', class: 'IMPORTS', evidenceDigest: 'sha256:import-game' }
    ]
  },
  {
    sourceClass: 'CODEQL',
    edges: [
      { from: 'sym:update', to: 'sym:sink', class: 'FLOWS_TO', evidenceDigest: 'sha256:flow-update-sink' }
    ]
  },
  {
    sourceClass: 'BUILD_SYSTEM',
    nodes: [
      { id: 'target:browser-game', kind: 'BUILD_TARGET', label: 'browser-game' },
      { id: 'action:bundle', kind: 'BUILD_ACTION', label: 'bundle browser game' },
      { id: 'artifact:bundle.js', kind: 'ARTIFACT', label: 'bundle.js' }
    ],
    edges: [
      { from: 'target:browser-game', to: 'file:game.js', class: 'BUILDS_FROM', evidenceDigest: 'sha256:target-game' },
      { from: 'target:browser-game', to: 'file:main.js', class: 'BUILDS_FROM', evidenceDigest: 'sha256:target-main' },
      { from: 'action:bundle', to: 'target:browser-game', class: 'CONSUMES', evidenceDigest: 'sha256:bundle-target' },
      { from: 'action:bundle', to: 'artifact:bundle.js', class: 'PRODUCES', evidenceDigest: 'sha256:bundle-output' }
    ]
  },
  {
    sourceClass: 'TEST_COVERAGE',
    nodes: [
      { id: 'test:update', kind: 'TEST', label: 'update regression test' },
      { id: 'verifier:eslint', kind: 'VERIFIER', label: 'eslint changed-scope verifier' }
    ],
    edges: [
      { from: 'test:update', to: 'sym:update', class: 'TESTS', evidenceDigest: 'sha256:test-update' },
      { from: 'test:update', to: 'file:game.js', class: 'COVERS', evidenceDigest: 'sha256:cover-game' },
      { from: 'verifier:eslint', to: 'file:game.js', class: 'TESTS', evidenceDigest: 'sha256:lint-game' }
    ]
  },
  {
    sourceClass: 'PACKAGE_MANIFEST',
    nodes: [
      { id: 'package:phaser', kind: 'EXTERNAL_DEPENDENCY', label: 'phaser' }
    ],
    edges: [
      { from: 'file:game.js', to: 'package:phaser', class: 'DEPENDS_ON', evidenceDigest: 'sha256:game-phaser' },
      { from: 'missing:generated-schema', to: 'file:game.js', class: 'DEPENDS_ON', evidenceDigest: 'sha256:unknown-edge' }
    ]
  }
] });

assert(['GRAPH_READY', 'GRAPH_READY_WITH_CONFLICTS'].includes(graph.result));
assert.strictEqual(graph.conflicts.length, 0);
assert.strictEqual(graph.unresolvedEdges.length, 1);
assert.strictEqual(graph.coverage.graphCoverageCompleteClaimed, false);
assert(graph.coverage.sourceClasses.includes('LSP'));
assert(graph.coverage.sourceClasses.includes('BUILD_SYSTEM'));

const impact = plane.impact({ graph, changedNodeIds: ['sym:update'], maxDepth: 10 });
assert.strictEqual(impact.result, 'IMPACT_READY');
const affectedIds = new Set(impact.affected.map(x => x.id));
for (const id of [
  'file:game.js', 'sym:main', 'file:main.js', 'sym:sink', 'test:update', 'verifier:eslint',
  'target:browser-game', 'action:bundle', 'artifact:bundle.js'
]) assert(affectedIds.has(id), `expected affected ${id}`);
assert(impact.affectedTests.includes('test:update'));
assert(impact.affectedVerifiers.includes('verifier:eslint'));
assert(impact.affectedBuildTargets.includes('target:browser-game'));
assert(impact.affectedBuildActions.includes('action:bundle'));
assert(impact.affectedArtifacts.includes('artifact:bundle.js'));

const unknownImpact = plane.impact({ graph, changedNodeIds: ['sym:update', 'unknown:root'] });
assert.strictEqual(unknownImpact.result, 'IMPACT_READY_WITH_UNKNOWN_CHANGE_ROOTS');
assert(unknownImpact.unknownChangedNodeIds.includes('unknown:root'));

const keyProgram = keyboard.program({ languageId: 'javascript', presses: [{ keyId: 'K24', arguments: { condition: 'playing' } }] });
assert.strictEqual(keyProgram.result, 'EDIT_PROGRAM_READY');
const reanalysis = plane.planReanalysis({ graph, impactReport: impact, invalidatedPlanes: keyProgram.invalidates });
assert.strictEqual(reanalysis.result, 'REANALYSIS_PLAN_READY');
assert(reanalysis.analysisPlanesToRefresh.includes('SYMBOL_REFERENCE_GRAPH'));
assert(reanalysis.analysisPlanesToRefresh.includes('DATA_FLOW_GRAPH'));
assert(reanalysis.analysisPlanesToRefresh.includes('BUILD_ACTION_GRAPH'));
assert(reanalysis.analysisPlanesToRefresh.includes('TEST_COVERAGE_MAP'));
assert(reanalysis.affectedTaskCandidates.includes('TEST:test:update'));
assert(reanalysis.affectedTaskCandidates.includes('VERIFY:verifier:eslint'));
assert(reanalysis.uncoveredWarning);

const actionA = plane.actionIdentity({
  actionId: 'bundle-browser-game',
  inputs: [{ id: 'game.js', digest: 'sha256:game-v2' }, { id: 'main.js', digest: 'sha256:main-v1' }],
  toolchainDigest: 'sha256:bundler-v1',
  configDigest: 'sha256:config-v1',
  environmentDigest: 'sha256:env-v1'
});
const actionSame = plane.actionIdentity({
  actionId: 'bundle-browser-game',
  inputs: [{ id: 'main.js', digest: 'sha256:main-v1' }, { id: 'game.js', digest: 'sha256:game-v2' }],
  toolchainDigest: 'sha256:bundler-v1',
  configDigest: 'sha256:config-v1',
  environmentDigest: 'sha256:env-v1'
});
const actionChanged = plane.actionIdentity({
  actionId: 'bundle-browser-game',
  inputs: [{ id: 'main.js', digest: 'sha256:main-v1' }, { id: 'game.js', digest: 'sha256:game-v3' }],
  toolchainDigest: 'sha256:bundler-v1',
  configDigest: 'sha256:config-v1',
  environmentDigest: 'sha256:env-v1'
});
assert.strictEqual(actionA.result, 'ACTION_IDENTITY_READY');
assert.strictEqual(actionA.actionSha256, actionSame.actionSha256);
assert.strictEqual(plane.compareActionIdentity(actionA, actionSame).result, 'CACHE_REUSE_CANDIDATE');
assert.strictEqual(plane.compareActionIdentity(actionA, actionChanged).result, 'RECOMPUTE_REQUIRED');
assert.strictEqual(plane.actionIdentity({ actionId: 'incomplete', inputs: [{ id: 'x', digest: null }] }).result, 'ACTION_IDENTITY_HELD_UNKNOWN_INPUT');

const depDiff = plane.dependencyDiff({
  before: [
    { ecosystem: 'npm', name: 'phaser', version: '3.80.0', relationship: 'DIRECT', manifest: 'package-lock.json' },
    { ecosystem: 'npm', name: 'eventemitter3', version: '5.0.1', relationship: 'TRANSITIVE', manifest: 'package-lock.json' }
  ],
  after: [
    { ecosystem: 'npm', name: 'phaser', version: '3.90.0', relationship: 'DIRECT', manifest: 'package-lock.json', vulnerabilities: ['GHSA-fixture-only'] },
    { ecosystem: 'npm', name: 'eventemitter3', version: '5.0.1', relationship: 'TRANSITIVE', manifest: 'package-lock.json' },
    { ecosystem: 'npm', name: 'new-transitive', version: '1.0.0', relationship: 'TRANSITIVE', manifest: 'package-lock.json' }
  ]
});
assert.strictEqual(depDiff.result, 'DEPENDENCY_CHANGES_OBSERVED');
assert.strictEqual(depDiff.updated.length, 1);
assert.strictEqual(depDiff.transitiveAdditions.length, 1);
assert.strictEqual(depDiff.callerSuppliedVulnerabilityEvidence.length, 1);

const lspBatch = diagnostics.fromLsp({
  uri: 'file:///src/game.js',
  serverId: 'javascript-lsp-fixture',
  diagnostics: [
    { range: { start: { line: 3, character: 2 }, end: { line: 3, character: 8 } }, severity: 1, code: 'E100', source: 'fixture-lsp', message: 'Undefined symbol fixture' },
    { range: { start: { line: 7, character: 0 }, end: { line: 7, character: 5 } }, severity: 2, code: 'W200', source: 'fixture-lsp', message: 'Suspicious branch fixture' }
  ]
});
assert.strictEqual(lspBatch.result, 'DIAGNOSTICS_NORMALIZED');
assert.strictEqual(lspBatch.summary.counts.ERROR, 1);
assert.strictEqual(lspBatch.summary.counts.WARNING, 1);

const sarifBatch = diagnostics.fromSarif({ sarif: {
  version: '2.1.0',
  runs: [{
    tool: { driver: { name: 'fixture-codeql', semanticVersion: '1.0.0' } },
    results: [{
      ruleId: 'fixture/data-flow', level: 'warning', message: { text: 'Fixture data-flow path' },
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/game.js' }, region: { startLine: 4, startColumn: 3 } } }],
      partialFingerprints: { primaryLocationLineHash: 'fixture-fingerprint' },
      codeFlows: [{ threadFlows: [{ locations: [
        { location: { physicalLocation: { artifactLocation: { uri: 'src/game.js' }, region: { startLine: 4 } }, message: { text: 'source' } } },
        { location: { physicalLocation: { artifactLocation: { uri: 'src/render.js' }, region: { startLine: 9 } }, message: { text: 'sink' } } }
      ] }] }]
    }]
  }]
} });
assert.strictEqual(sarifBatch.result, 'DIAGNOSTICS_NORMALIZED');
assert.strictEqual(sarifBatch.findings.length, 1);
assert.strictEqual(sarifBatch.findings[0].flowPath.length, 2);
assert.strictEqual(sarifBatch.findings[0].truth.sourceCodeRetained, false);

const mergedDiagnostics = diagnostics.mergeBatches([lspBatch, sarifBatch]);
assert.strictEqual(mergedDiagnostics.result, 'DIAGNOSTICS_MERGED');
assert.strictEqual(mergedDiagnostics.findings.length, 3);
assert.strictEqual(mergedDiagnostics.summary.counts.ERROR, 1);
assert.strictEqual(mergedDiagnostics.summary.counts.WARNING, 2);

const cycleGraph = plane.buildGraph({ observations: [{
  sourceClass: 'LSP',
  nodes: [{ id: 'file:a', kind: 'FILE' }, { id: 'file:b', kind: 'FILE' }],
  edges: [{ from: 'file:a', to: 'file:b', class: 'IMPORTS' }, { from: 'file:b', to: 'file:a', class: 'IMPORTS' }]
}] });
assert.strictEqual(cycleGraph.cycles.length, 1);
assert.deepStrictEqual(cycleGraph.cycles[0].members, ['file:a', 'file:b']);

const svg = plane.renderImpactSvg({ graph, impactReport: impact, title: 'Browser Game Change Impact' });
assert(svg.includes('<svg'));
assert(svg.includes('Browser Game Change Impact'));
assert(svg.includes('sym:update'));
assert(svg.includes('affected does not mean broken'));

const snapshot = plane.snapshot();
assert.strictEqual(snapshot.firstClassFoundationCount, 8);
assert.strictEqual(snapshot.sourceClassCount, 15);
assert.strictEqual(snapshot.nodeKindCount, 13);
assert.strictEqual(snapshot.edgeClassCount, 16);
assert.strictEqual(snapshot.authority, 'NONE');

console.log(JSON.stringify({
  ok: true,
  graphNodes: graph.coverage.nodeCount,
  graphEdges: graph.coverage.edgeCount,
  unresolvedEdges: graph.coverage.unresolvedEdgeCount,
  affectedCount: impact.affected.length,
  affectedTests: impact.affectedTests,
  affectedVerifiers: impact.affectedVerifiers,
  affectedBuildTargets: impact.affectedBuildTargets,
  affectedBuildActions: impact.affectedBuildActions,
  affectedArtifacts: impact.affectedArtifacts,
  reanalysisPlanes: reanalysis.analysisPlanesToRefresh,
  affectedTaskCandidates: reanalysis.affectedTaskCandidates,
  cacheSame: plane.compareActionIdentity(actionA, actionSame).result,
  cacheChanged: plane.compareActionIdentity(actionA, actionChanged).result,
  dependencyUpdated: depDiff.updated.length,
  transitiveAdditions: depDiff.transitiveAdditions.length,
  normalizedDiagnostics: mergedDiagnostics.findings.length,
  sarifFlowPathLength: sarifBatch.findings[0].flowPath.length,
  observedImportCycles: cycleGraph.cycles.length,
  snapshotSha256: snapshot.snapshotSha256,
  authority: snapshot.authority
}, null, 2));
