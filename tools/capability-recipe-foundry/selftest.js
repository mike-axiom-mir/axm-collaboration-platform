#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Foundry = require('./foundry-core.js');
const Machine = require('./machine.js');
const Fabric = require('../../shared/capability-fabric/index.js');

let passed = 0;
function check(condition, label) { assert(condition, label); passed += 1; process.stdout.write('PASS ' + label + '\n'); }
function exactResealIntent(intent) { const copy = Foundry.clone(intent); delete copy.intentDigest; intent.intentDigest = Foundry.digest(copy); }
function resealPacket(packet) { const copy = Foundry.clone(packet); delete copy.packetDigest; packet.packetDigest = Foundry.digest(copy); }

(async function main() {
  const intent = Foundry.example();
  const validation = Foundry.validateIntent(intent);
  check(validation.ok, 'schema-validator pilot intent satisfies the closed authoring contract');
  check(intent.sourceKind === 'CODEX' && intent.status === 'EXPERIMENTAL' && intent.authority === 'NONE', 'pilot preserves exact author provenance and no authority');
  check(intent.verificationPlan.target.specificationFingerprint === require('../hand-verification-lab/hand-verification-core.js').fingerprint(intent.specification), 'verification plan is bound to the exact specification');

  const plan = Foundry.plan(intent);
  check(plan.status === 'READY' && plan.capabilityKind === 'HAND' && plan.outputStatus === 'INACTIVE_PROPOSAL' && plan.outputFileCount === 8, 'valid HAND intent plans one inactive eight-file modular packet');
  check(plan.executesBuilderSource === false && plan.executesGeneratedCode === false, 'planning executes no authored or generated source');

  const first = Foundry.forge(intent);
  const second = Foundry.forge(intent);
  check(first.status === 'COMPLETE' && first.packet.status === 'EXPERIMENTAL_REVIEW_PACKET', 'Foundry completes one experimental review packet');
  check(Foundry.canonicalJson(first) === Foundry.canonicalJson(second), 'identical sealed input produces a byte-identical result');
  check(Foundry.verify(first).ok, 'complete review packet verifies');
  check(first.packet.files.length === 8 && first.packet.totalBytes <= Foundry.MAX_PACKET_BYTES, 'packet stays inside exact file and byte ceilings');
  check(Object.values(first.authority).every((value) => value === false) && Object.values(first.packet.authority).every((value) => value === false), 'result and packet carry no authority');
  check(first.receipt.truth.builderSourceExecuted === false && first.receipt.truth.generatedCodeExecuted === false && first.receipt.truth.testsExecuted === false, 'receipt refuses execution claims');

  const proposal = JSON.parse(first.files[Foundry.FILES.proposal]);
  const inspection = Fabric.importRecipeProposal(proposal);
  check(inspection.ok && inspection.active === false && inspection.requiresMikeMerge === true, 'Capability Fabric imports the pilot only as an inactive proposal');
  check(Fabric.ALLOWED_BUILDERS.includes(proposal.recipe.builderId), 'reviewed HAND pilot builder is now present through the explicit admission merge');
  const catalog = Fabric.loadCatalog();
  check(catalog.recipes.some((recipe) => recipe.id === proposal.recipe.id && recipe.activation === Fabric.ACTIVE_RECIPE), 'reviewed HAND pilot recipe is now present in the active recipe catalog');
  check(proposal.sourceKind === 'CODEX' && proposal.recipe.activation === 'INACTIVE_PROPOSAL', 'proposal keeps truthful Codex provenance and inactive activation');
  const handContract = JSON.parse(first.files[Foundry.FILES.modularContract]);
  check(proposal.recipe.capabilityKind === 'HAND' && handContract.kind === 'HAND' && handContract.runtime.entry === 'capability.js' && handContract.portable.form === 'NONE', 'HAND proposal binds an executable modular contract without a portable skill form');

  const stale = Foundry.clone(intent); stale.recipe.summary += ' drift';
  check(!Foundry.validateIntent(stale).ok && Foundry.plan(stale).status === 'HELD', 'stale intent digest becomes a typed authoring hold');
  const wrongPlan = Foundry.clone(intent); wrongPlan.verificationPlan.target.specificationFingerprint = 'fnv1a32:00000000'; exactResealIntent(wrongPlan);
  check(!Foundry.validateIntent(wrongPlan).ok, 'verification plan bound to another source is refused even after intent reseal');
  const activeInput = Foundry.clone(intent); activeInput.recipe.activation = 'ACTIVE_SOURCE_REVIEWED'; exactResealIntent(activeInput);
  check(!Foundry.validateIntent(activeInput).ok, 'unknown active recipe field cannot enter the authoring contract');
  const mismatchedBuilder = Foundry.clone(intent); mismatchedBuilder.contribution.builderId = 'another-builder-v1'; exactResealIntent(mismatchedBuilder);
  check(!Foundry.validateIntent(mismatchedBuilder).ok, 'builder contribution identity mismatch is refused');
  const noncanonical = Foundry.clone(intent); noncanonical.contribution.builderSource = noncanonical.contribution.builderSource.replace(/\n/g, '\r\n'); exactResealIntent(noncanonical);
  check(!Foundry.validateIntent(noncanonical).ok, 'non-canonical source line endings are refused');

  const tamperedFile = Foundry.clone(first); tamperedFile.files[Foundry.FILES.builder] += '// drift\n';
  check(!Foundry.verify(tamperedFile).ok, 'builder source byte tampering fails packet verification');
  const authorityDrift = Foundry.clone(first); authorityDrift.packet.authority.promoted = true; resealPacket(authorityDrift.packet); authorityDrift.receipt.packetRef.digest = authorityDrift.packet.packetDigest; const receiptCopy = Foundry.clone(authorityDrift.receipt); delete receiptCopy.receiptDigest; authorityDrift.receipt.receiptDigest = Foundry.digest(receiptCopy);
  check(!Foundry.verify(authorityDrift).ok, 'rehashing cannot hide packet promotion authority');
  const overclaim = Foundry.clone(first); overclaim.packet.truth.sourceReviewed = true; resealPacket(overclaim.packet); overclaim.receipt.packetRef.digest = overclaim.packet.packetDigest; const overclaimReceipt = Foundry.clone(overclaim.receipt); delete overclaimReceipt.receiptDigest; overclaim.receipt.receiptDigest = Foundry.digest(overclaimReceipt);
  check(!Foundry.verify(overclaim).ok, 'rehashing cannot turn deterministic assembly into source-review proof');
  const activeProposalResult = Foundry.clone(first); const activeProposal = JSON.parse(activeProposalResult.files[Foundry.FILES.proposal]); activeProposal.recipe.activation = Fabric.ACTIVE_RECIPE; activeProposal.proposalDigest = Fabric.digest(activeProposal.recipe); activeProposalResult.files[Foundry.FILES.proposal] = JSON.stringify(activeProposal, null, 2) + '\n';
  check(!Foundry.verify(activeProposalResult).ok, 'active proposal tampering is refused');
  const injected = Foundry.clone(first); injected.files['install.js'] = "'use strict';\n"; injected.packet.files.push({ path: 'install.js', bytes: Buffer.byteLength(injected.files['install.js']), digest: Foundry.digest(injected.files['install.js']) }); injected.packet.files.sort((left, right) => left.path.localeCompare(right.path)); injected.packet.totalBytes += Buffer.byteLength(injected.files['install.js']); resealPacket(injected.packet); injected.receipt.packetRef.digest = injected.packet.packetDigest; injected.receipt.output.fileCount += 1; injected.receipt.output.totalBytes = injected.packet.totalBytes; const injectedReceipt = Foundry.clone(injected.receipt); delete injectedReceipt.receiptDigest; injected.receipt.receiptDigest = Foundry.digest(injectedReceipt);
  check(!Foundry.verify(injected).ok, 'rehashing cannot add an undeclared executable file to the exact review packet');

  const skillIntent = Foundry.exampleSkill();
  check(Foundry.validateIntent(skillIntent).ok && skillIntent.recipe.capabilityKind === 'SKILL', 'portable SKILL pilot satisfies the same closed authoring route');
  const skillFirst = Foundry.forge(skillIntent), skillSecond = Foundry.forge(skillIntent);
  check(Foundry.canonicalJson(skillFirst) === Foundry.canonicalJson(skillSecond) && Foundry.verify(skillFirst).ok, 'SKILL packet rebuild is byte-identical and verifies');
  const skillProposal = JSON.parse(skillFirst.files[Foundry.FILES.proposal]), skillContract = JSON.parse(skillFirst.files[Foundry.FILES.modularContract]);
  check(skillProposal.recipe.capabilityKind === 'SKILL' && skillContract.kind === 'SKILL' && skillContract.portable.form === 'SKILL_MD' && skillContract.portable.path === 'SKILL.md' && skillContract.runtime.mode === 'HOST_MEDIATED' && skillContract.runtime.entry === null, 'SKILL proposal binds portable SKILL.md and an explicit host-mediated runtime');
  check(Fabric.importRecipeProposal(skillProposal).ok && Fabric.importRecipeProposal(skillProposal).active === false && Fabric.ALLOWED_BUILDERS.includes(skillProposal.recipe.builderId) && Fabric.loadCatalog().recipes.some((recipe) => recipe.id === skillProposal.recipe.id && recipe.activation === Fabric.ACTIVE_RECIPE), 'inactive SKILL proposal remains provenance while its separately reviewed recipe and builder are active');
  const skillAuthorityDrift = Foundry.clone(skillFirst), skillModular = JSON.parse(skillAuthorityDrift.files[Foundry.FILES.modularContract]); skillModular.installed = true; skillAuthorityDrift.files[Foundry.FILES.modularContract] = JSON.stringify(skillModular, null, 2) + '\n';
  check(!Foundry.verify(skillAuthorityDrift).ok, 'portable SKILL contract authority drift is refused');
  const skillSemanticDrift = Foundry.clone(skillFirst), semanticContract = JSON.parse(skillSemanticDrift.files[Foundry.FILES.modularContract]); semanticContract.runtime.operation = 'promote'; delete semanticContract.contractDigest; semanticContract.contractDigest = Foundry.digest(semanticContract); skillSemanticDrift.files[Foundry.FILES.modularContract] = JSON.stringify(semanticContract, null, 2) + '\n'; const semanticRow = skillSemanticDrift.packet.files.find((row) => row.path === Foundry.FILES.modularContract); const oldBytes = semanticRow.bytes; semanticRow.bytes = Buffer.byteLength(skillSemanticDrift.files[Foundry.FILES.modularContract]); semanticRow.digest = Foundry.digest(skillSemanticDrift.files[Foundry.FILES.modularContract]); skillSemanticDrift.packet.totalBytes += semanticRow.bytes - oldBytes; resealPacket(skillSemanticDrift.packet); skillSemanticDrift.receipt.packetRef.digest = skillSemanticDrift.packet.packetDigest; skillSemanticDrift.receipt.output.totalBytes = skillSemanticDrift.packet.totalBytes; const semanticReceipt = Foundry.clone(skillSemanticDrift.receipt); delete semanticReceipt.receiptDigest; skillSemanticDrift.receipt.receiptDigest = Foundry.digest(semanticReceipt);
  check(!Foundry.verify(skillSemanticDrift).ok, 'rehashing cannot drift SKILL runtime semantics away from the reviewed proposal');

  const machinePilot = await Machine.run({ action: 'pilot.example' });
  check(machinePilot.ok && machinePilot.builderSourceExecuted === false && machinePilot.providerCalled === false, 'machine pilot route is pure and provider-free');
  const machineSkillPilot = await Machine.run({ action: 'pilot.example', input: { capabilityKind: 'SKILL' } });
  check(machineSkillPilot.ok && machineSkillPilot.intent.recipe.capabilityKind === 'SKILL' && machineSkillPilot.builderSourceExecuted === false, 'machine pilot route exposes the SKILL contract without execution');
  const machineBuild = await Machine.run({ action: 'packet.forge', input: { intent: intent } });
  check(machineBuild.ok && machineBuild.result.packet.packetDigest === first.packet.packetDigest, 'machine door assembles the exact same packet');
  const forbidden = await Machine.run({ action: 'builder.execute' });
  check(!forbidden.ok && forbidden.refused && forbidden.code === 'FORBIDDEN_ACTION', 'machine door refuses builder execution');
  const activate = await Machine.run({ action: 'recipe.activate' });
  check(!activate.ok && activate.code === 'FORBIDDEN_ACTION', 'machine door refuses recipe activation');
  const unsupported = await Machine.run({ action: 'surprise' });
  check(!unsupported.ok && unsupported.code === 'UNSUPPORTED_ACTION', 'machine door types unsupported actions separately');

  process.stdout.write('Capability Recipe Foundry selftest PASS · ' + passed + ' checks\n');
})().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
