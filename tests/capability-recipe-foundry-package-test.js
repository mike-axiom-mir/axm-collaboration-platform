#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const Foundry = require('../tools/capability-recipe-foundry/foundry-core.js');
const Cli = require('../tools/capability-recipe-foundry/cli.js');
const Fabric = require('../shared/capability-fabric/index.js');

let passed = 0;
function check(condition, label) { assert(condition, label); passed += 1; process.stdout.write('PASS ' + label + '\n'); }
function safeRemove(root) {
  const resolved = path.resolve(root);
  const parent = path.resolve(os.tmpdir());
  if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith('axm-capability-recipe-foundry-test-')) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-capability-recipe-foundry-test-'));
  try {
    const toolRoot = path.join(__dirname, '../tools/capability-recipe-foundry');
    const manifest = JSON.parse(fs.readFileSync(path.join(toolRoot, 'manifest.json'), 'utf8'));
    const contract = JSON.parse(fs.readFileSync(path.join(toolRoot, 'module.contract.json'), 'utf8'));
    const html = fs.readFileSync(path.join(toolRoot, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(toolRoot, 'app.js'), 'utf8');
    check(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product', 'tool manifest uses modern product schema');
    check(manifest.status === 'EXPERIMENTAL' && manifest.installed === false && manifest.promoted === false, 'tool remains explicitly experimental and detached');
    check(manifest.permissions.length === 0 && contract.permissions.length === 0, 'Foundry requires no permissions');
    check(contract.boundaries.refuses.includes('builder source execution') && contract.boundaries.refuses.includes('recipe activation'), 'contract refuses source execution and activation');
    check(contract.boundaries.refuses.includes('Foundation mutation') && contract.boundaries.refuses.includes('CANON change'), 'contract refuses Foundation and CANON mutation');
    check(html.includes('Capability Recipe') && html.includes('ONE PACKET DEFAULT'), 'human workbench exposes the intended one-packet route');
    check(html.includes('/shared/capability-fabric/core.js') && html.includes('/tools/hand-verification-lab/hand-verification-core.js'), 'workbench visibly reuses Capability Fabric and verification contracts');
    check(!/openai|anthropic|gemini|api[_ -]?key/i.test(app), 'browser workbench has no provider or credential path');
    new Function(app); check(true, 'browser workbench script parses');

    ['authoring-intent.schema.json', 'review-packet.schema.json', 'foundry-receipt.schema.json'].forEach((file) => {
      JSON.parse(fs.readFileSync(path.join(toolRoot, 'schemas', file), 'utf8'));
      passed += 1; process.stdout.write('PASS ' + file + ' parses\n');
    });

    const intent = Foundry.example();
    const first = Foundry.forge(intent);
    const second = Foundry.forge(intent);
    check(Foundry.canonicalJson(first) === Foundry.canonicalJson(second), 'pilot packet rebuild is byte-identical');
    check(first.receipt.truth.builderSourceExecuted === false && first.receipt.truth.testsExecuted === false, 'Foundry receipt honestly leaves executable evidence unrun');
    const staticPilotRoot = fs.readdirSync(path.join(toolRoot, 'pilots'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith(Cli.ROOT_PREFIX));
    check(staticPilotRoot.length === 1, 'repository contains one detached materialized pilot packet');
    const staticRoot = path.join(toolRoot, 'pilots', staticPilotRoot[0].name);
    const staticPacket = JSON.parse(fs.readFileSync(path.join(staticRoot, 'packet.json'), 'utf8'));
    const staticReceipt = JSON.parse(fs.readFileSync(path.join(staticRoot, 'foundry-receipt.json'), 'utf8'));
    const staticFiles = Object.fromEntries(staticPacket.files.map((row) => [row.path, fs.readFileSync(path.join(staticRoot, row.path), 'utf8')]));
    const staticResult = { schema: first.schema, version: first.version, status: 'COMPLETE', plan: first.plan, packet: staticPacket, files: staticFiles, receipt: staticReceipt, authority: first.authority };
    check(Foundry.verify(staticResult).ok && staticPacket.packetDigest === first.packet.packetDigest, 'committed pilot is the exact deterministic Foundry output');
    const materialized = Cli.materialize(first, root);
    check(materialized.status === 'MATERIALIZED_FOR_SOURCE_REVIEW' && materialized.fileCount === 9, 'CLI materializes exactly seven review files plus packet and receipt');
    check(materialized.builderSourceExecuted === false && materialized.generatedCodeExecuted === false && materialized.testsExecuted === false, 'materialization executes no authored or generated code');
    const names = fs.readdirSync(materialized.directory).sort();
    check(names.includes('builder-contribution.js') && names.includes('builder-contribution.selftest.js') && names.includes('packet.json') && names.includes('foundry-receipt.json'), 'materialized packet contains source, external selftest, descriptor, and receipt');

    const explicitRun = childProcess.spawnSync(process.execPath, [path.join(materialized.directory, 'builder-contribution.selftest.js')], { encoding: 'utf8', timeout: 10000 });
    check(explicitRun.status === 0 && /builder contribution selftest PASS/.test(explicitRun.stdout), 'pilot builder and generated validator pass when explicitly run by trusted test host');
    const builder = require(path.join(materialized.directory, 'builder-contribution.js'));
    const parameters = intent.recipe.exampleRequest.parameters;
    const built = builder.build(parameters);
    check(built.source === builder.build(parameters).source && built.selftest === builder.build(parameters).selftest, 'pilot builder output is deterministic under independent host execution');
    check(built.provides[0] === parameters.resultSchemaId && built.consumes[0] === parameters.inputSchemaId, 'pilot builder declares exact consumed and produced contracts');
    assert.throws(() => builder.build(Object.assign({}, parameters, { schema: Object.assign({}, parameters.schema, { additionalProperties: true }) })), /additionalProperties must be false/);
    passed += 1; process.stdout.write('PASS pilot builder refuses an open object schema\n');
    assert.throws(() => builder.build(Object.assign({}, parameters, { maxInputBytes: 1000000 })), /outside the bounded range/);
    passed += 1; process.stdout.write('PASS pilot builder refuses an excessive input budget\n');

    const proposal = JSON.parse(fs.readFileSync(path.join(materialized.directory, 'recipe-proposal.json'), 'utf8'));
    const inspected = Fabric.importRecipeProposal(proposal);
    check(inspected.ok && inspected.active === false && inspected.requiresSourceReview && inspected.requiresMikeMerge, 'materialized proposal remains inactive and source-review held');
    check(!Fabric.ALLOWED_BUILDERS.includes(proposal.recipe.builderId) && !Fabric.loadCatalog().recipes.some((recipe) => recipe.id === proposal.recipe.id), 'materialization does not activate the builder or catalog recipe');
    assert.throws(() => Cli.materialize(first, root), (error) => error && error.receipt && error.receipt.code === 'OUTPUT_OVERWRITE_REFUSED');
    passed += 1; process.stdout.write('PASS CLI refuses exact packet overwrite\n');

    const rollbackParent = path.join(root, 'rollback'); fs.mkdirSync(rollbackParent);
    assert.throws(() => Cli.materialize(first, rollbackParent, { faultAfterFile: 3 }), /bounded injected materialization fault/);
    check(fs.readdirSync(rollbackParent).length === 0, 'failed materialization rolls back only its fresh owned root');
    check(Cli.safeFile(materialized.directory, 'safe.json') === path.join(materialized.directory, 'safe.json'), 'CLI accepts a safe direct-child file');
    assert.throws(() => Cli.safeFile(materialized.directory, '../escape.json'));
    passed += 1; process.stdout.write('PASS CLI refuses traversal paths\n');

    process.stdout.write('Capability Recipe Foundry package test PASS · ' + passed + ' checks\n');
  } finally { safeRemove(root); }
}

main();
