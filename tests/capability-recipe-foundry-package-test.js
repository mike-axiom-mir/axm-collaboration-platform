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

    ['authoring-intent.schema.json', 'modular-capability-review-contract.schema.json', 'review-packet.schema.json', 'foundry-receipt.schema.json'].forEach((file) => {
      JSON.parse(fs.readFileSync(path.join(toolRoot, 'schemas', file), 'utf8'));
      passed += 1; process.stdout.write('PASS ' + file + ' parses\n');
    });

    const intent = Foundry.example();
    const skillIntent = Foundry.exampleSkill();
    const first = Foundry.forge(intent);
    const second = Foundry.forge(intent);
    check(Foundry.canonicalJson(first) === Foundry.canonicalJson(second), 'pilot packet rebuild is byte-identical');
    check(first.receipt.truth.builderSourceExecuted === false && first.receipt.truth.testsExecuted === false, 'Foundry receipt honestly leaves executable evidence unrun');
    const staticPilotRoots = fs.readdirSync(path.join(toolRoot, 'pilots'), { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.startsWith(Cli.ROOT_PREFIX) && fs.existsSync(path.join(toolRoot, 'pilots', entry.name, 'packet.json')));
    check(staticPilotRoots.length === 2, 'repository contains detached materialized HAND and SKILL pilot packets');
    [intent, skillIntent].forEach((pilotIntent) => {
      const expected = Foundry.forge(pilotIntent);
      const staticRoot = staticPilotRoots.map((entry) => path.join(toolRoot, 'pilots', entry.name)).find((rootPath) => JSON.parse(fs.readFileSync(path.join(rootPath, 'packet.json'), 'utf8')).target.capabilityKind === pilotIntent.recipe.capabilityKind);
      const staticPacket = JSON.parse(fs.readFileSync(path.join(staticRoot, 'packet.json'), 'utf8'));
      const staticReceipt = JSON.parse(fs.readFileSync(path.join(staticRoot, 'foundry-receipt.json'), 'utf8'));
      const staticFiles = Object.fromEntries(staticPacket.files.map((row) => [row.path, fs.readFileSync(path.join(staticRoot, row.path), 'utf8')]));
      const staticResult = { schema: expected.schema, version: expected.version, status: 'COMPLETE', plan: expected.plan, packet: staticPacket, files: staticFiles, receipt: staticReceipt, authority: expected.authority };
      check(Foundry.verify(staticResult).ok && staticPacket.packetDigest === expected.packet.packetDigest, 'committed ' + pilotIntent.recipe.capabilityKind + ' pilot is the exact deterministic Foundry output');
    });
    const activeStateBefore = { catalogDigest: Fabric.loadCatalog().catalogDigest, builderPresent: Fabric.ALLOWED_BUILDERS.includes(intent.recipe.builderId), recipePresent: Fabric.loadCatalog().recipes.some((recipe) => recipe.id === intent.recipe.id) };
    const materialized = Cli.materialize(first, root);
    check(materialized.status === 'MATERIALIZED_FOR_SOURCE_REVIEW' && materialized.fileCount === 10, 'CLI materializes exactly eight HAND review files plus packet and receipt');
    check(materialized.builderSourceExecuted === false && materialized.generatedCodeExecuted === false && materialized.testsExecuted === false, 'materialization executes no authored or generated code');
    const names = fs.readdirSync(materialized.directory).sort();
    check(names.includes('builder-contribution.js') && names.includes('builder-contribution.selftest.js') && names.includes('modular-capability.contract.json') && names.includes('packet.json') && names.includes('foundry-receipt.json'), 'materialized packet contains source, modular contract, external selftest, packet, and receipt');

    const explicitRun = childProcess.spawnSync(process.execPath, [path.join(materialized.directory, 'builder-contribution.selftest.js')], { encoding: 'utf8', timeout: 10000 });
    check(explicitRun.status === 0 && /builder contribution selftest PASS/.test(explicitRun.stdout), 'pilot builder and generated validator pass when explicitly run by trusted test host');
    const builder = require(path.join(materialized.directory, 'builder-contribution.js'));
    const parameters = intent.recipe.exampleRequest.parameters;
    const built = builder.build(parameters);
    check(built.source === builder.build(parameters).source && built.selftest === builder.build(parameters).selftest && built.capabilityKind === 'HAND', 'HAND pilot builder output is deterministic and explicitly typed');
    check(built.provides[0] === parameters.resultSchemaId && built.consumes[0] === parameters.inputSchemaId, 'pilot builder declares exact consumed and produced contracts');
    assert.throws(() => builder.build(Object.assign({}, parameters, { schema: Object.assign({}, parameters.schema, { additionalProperties: true }) })), /additionalProperties must be false/);
    passed += 1; process.stdout.write('PASS pilot builder refuses an open object schema\n');
    assert.throws(() => builder.build(Object.assign({}, parameters, { maxInputBytes: 1000000 })), /outside the bounded range/);
    passed += 1; process.stdout.write('PASS pilot builder refuses an excessive input budget\n');

    const proposal = JSON.parse(fs.readFileSync(path.join(materialized.directory, 'recipe-proposal.json'), 'utf8'));
    check(Fabric.validateCompiledArtifact(proposal.recipe, built).ok, 'Capability Fabric accepts the HAND builder artifact contract');
    const inspected = Fabric.importRecipeProposal(proposal);
    check(inspected.ok && inspected.active === false && inspected.requiresSourceReview && inspected.requiresMikeMerge, 'materialized proposal remains inactive and source-review held');
    const activeStateAfter = { catalogDigest: Fabric.loadCatalog().catalogDigest, builderPresent: Fabric.ALLOWED_BUILDERS.includes(proposal.recipe.builderId), recipePresent: Fabric.loadCatalog().recipes.some((recipe) => recipe.id === proposal.recipe.id) };
    check(activeStateBefore.builderPresent && activeStateBefore.recipePresent && Foundry.canonicalJson(activeStateAfter) === Foundry.canonicalJson(activeStateBefore), 'materialization preserves the separately reviewed active state without causing activation');

    const skillActiveStateBefore = { catalogDigest: Fabric.loadCatalog().catalogDigest, builderPresent: Fabric.ALLOWED_BUILDERS.includes(skillIntent.recipe.builderId), recipePresent: Fabric.loadCatalog().recipes.some((recipe) => recipe.id === skillIntent.recipe.id) };
    const skillResult = Foundry.forge(skillIntent), skillMaterialized = Cli.materialize(skillResult, root);
    check(skillMaterialized.fileCount === 10 && skillMaterialized.builderSourceExecuted === false, 'CLI materializes the eight-file SKILL review packet without execution');
    const skillRun = childProcess.spawnSync(process.execPath, [path.join(skillMaterialized.directory, 'builder-contribution.selftest.js')], { cwd: skillMaterialized.directory, encoding: 'utf8', timeout: 10000 });
    check(skillRun.status === 0 && /portable skill builder contribution selftest PASS/.test(skillRun.stdout), 'portable SKILL builder and emitted skill selftest pass only in the explicit trusted host');
    const skillBuilder = require(path.join(skillMaterialized.directory, 'builder-contribution.js'));
    const builtSkill = skillBuilder.build(skillIntent.recipe.exampleRequest.parameters);
    const skillProposal = JSON.parse(fs.readFileSync(path.join(skillMaterialized.directory, 'recipe-proposal.json'), 'utf8'));
    check(Fabric.validateCompiledArtifact(skillProposal.recipe, builtSkill).ok && builtSkill.capabilityKind === 'SKILL', 'Capability Fabric accepts the exact portable SKILL artifact contract');
    check(Object.keys(builtSkill.portableFiles).sort().join(',') === 'SKILL.md,skill.contract.json,skill.selftest.js', 'SKILL builder emits the exact portable three-file set');
    const portableContract = JSON.parse(builtSkill.portableFiles['skill.contract.json']);
    check(portableContract.authorityInherited === false && portableContract.installed === false && portableContract.promoted === false && portableContract.canon === false, 'portable SKILL contract inherits no authority');
    const skillActiveStateAfter = { catalogDigest: Fabric.loadCatalog().catalogDigest, builderPresent: Fabric.ALLOWED_BUILDERS.includes(skillProposal.recipe.builderId), recipePresent: Fabric.loadCatalog().recipes.some((recipe) => recipe.id === skillProposal.recipe.id) };
    check(skillActiveStateBefore.builderPresent && skillActiveStateBefore.recipePresent && Foundry.canonicalJson(skillActiveStateAfter) === Foundry.canonicalJson(skillActiveStateBefore), 'SKILL materialization preserves its separately reviewed active state without causing activation');
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
