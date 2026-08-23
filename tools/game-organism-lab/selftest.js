'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Engine = require('../../shared/game-organism/game-organism');
const Examples = require('../../shared/game-organism/examples');
const Cartoon3D = require('../../shared/game-organism/cartoon-3d-evidence');
const AudioMusic = require('../../shared/game-organism/audio-music-evidence');
const SimLiving = require('../../shared/game-organism/sim-living-evidence');

const root = __dirname;
const workshopRoot = path.resolve(root, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
assert.equal(ContractVerifier.validateContract(contract, manifest).pass, true, 'module contract must validate');
assert.equal(manifest.status, 'EXPERIMENTAL');
assert.equal(manifest.permissions.length, 0);
assert.ok(contract.boundaries.refuses.includes('canonical-game-write'));
assert.ok(contract.boundaries.refuses.includes('automatic-promotion'));

['index.html', 'styles.css', 'app.js'].forEach(file => assert.ok(fs.existsSync(path.join(root, file)), file + ' must exist'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /CANDIDATE ONLY/);
assert.match(html, /Sever physics seam/);
assert.match(html, /Download receipt/);
assert.doesNotMatch(html, /Start organs|Install candidate|Promote automatically/);

const example = Examples.createStreetLifeExample();
const receipt = Engine.compile(example.blueprint, example.registry);
assert.equal(receipt.verdict, 'CANDIDATE_READY');
assert.equal(receipt.truth.executionStarted, false);
assert.equal(receipt.truth.canonicalGameChanged, false);
assert.equal(receipt.truth.humanReleaseRequired, true);

const retainedEvidencePaths = [
  path.join(workshopRoot, 'intakes', 'cartoon-3d-run100', 'evidence', 'organ-registry.json'),
  path.join(workshopRoot, 'intakes', 'audio-music-live-run106', 'evidence', 'module-registry.json'),
  path.join(workshopRoot, 'intakes', 'sim-living-run102', 'evidence', 'module-registry.json'),
  path.join(workshopRoot, 'intakes', 'sim-living-run102', 'game-wiring.js')
];
if (retainedEvidencePaths.some(file => !fs.existsSync(file))) {
  console.log('game-organism-lab selftest: PASS WITH TEST_HOLD · core candidate plan passed · retained local evidence intakes absent · human release preserved');
  process.exit(0);
}

const SimLivingGameWiring = require('../../intakes/sim-living-run102/game-wiring');
const toonEvidence = Cartoon3D.createToonGameEvidenceExample();
assert.equal(toonEvidence.receipt.verdict, 'CANDIDATE_READY');
assert.equal(toonEvidence.evidenceOrgan.verification.automatic_checks.length, 100);
assert.equal(toonEvidence.receipt.evidence_plan.filter(item => item.includes('cartoon-3d:')).length, 100);
assert.equal(toonEvidence.receipt.truth.executionStarted, false);
assert.equal(toonEvidence.receipt.truth.canonicalGameChanged, false);
assert.equal(toonEvidence.receipt.truth.humanReleaseRequired, true);

const audioEvidence = AudioMusic.createAudioGameEvidenceExample();
assert.equal(audioEvidence.receipt.verdict, 'CANDIDATE_READY');
assert.equal(audioEvidence.sourceRegistry.modules.length, 100);
assert.equal(audioEvidence.sourceRegistry.local_stewardship_regression.checks, 3373);
assert.equal(audioEvidence.receipt.evidence_plan.filter(item => item.includes('audio-module:')).length, 100);
assert.equal(audioEvidence.receipt.truth.executionStarted, false);
assert.equal(audioEvidence.receipt.truth.canonicalGameChanged, false);
assert.equal(audioEvidence.receipt.truth.humanReleaseRequired, true);
assert.equal(AudioMusic.readiness().later_python_audio_regressions, 'BLOCKED_MISSING_DEPENDENCIES');

const simLivingEvidence = SimLiving.createSimLivingGameEvidenceExample();
assert.equal(simLivingEvidence.receipt.verdict, 'CANDIDATE_READY');
assert.equal(simLivingEvidence.sourceRegistry.modules.length, 100);
assert.equal(simLivingEvidence.sourceRegistry.operation_count, 400);
assert.equal(simLivingEvidence.receipt.evidence_plan.filter(item => item.includes('sim-living-module:')).length, 100);
assert.equal(simLivingEvidence.receipt.truth.executionStarted, false);
assert.equal(simLivingEvidence.receipt.truth.canonicalGameChanged, false);
assert.equal(simLivingEvidence.receipt.truth.humanReleaseRequired, true);
assert.equal(SimLiving.readiness().executable_source_modules_proven, false);

const simLivingWiring = SimLivingGameWiring.buildArtifacts();
assert.equal(simLivingWiring.mapping.mappings.length, 100);
assert.equal(simLivingWiring.forge.systems.length, 100);
assert.equal(simLivingWiring.experiment.world.artifacts.filter(item => item.kind === 'sim-living-blueprint').length, 100);
assert.equal(simLivingWiring.world.batches.flatMap(batch => batch.operations).length, 100);
assert.equal(simLivingWiring.world.applyCalled, false);
assert.equal(simLivingWiring.verification.report.verdict, 'HELD');
assert.equal(simLivingWiring.receipt.capabilityStatus.staticGameSystemWiring, 'READY');

console.log('game-organism-lab selftest: PASS · candidate plan only · human release preserved');
