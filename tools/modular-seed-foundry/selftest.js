'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Seed = require('./seed-core');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

check(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product', 'versioned product manifest is declared');
check(manifest.id === 'modular-seed-foundry' && manifest.permissions.length === 0, 'Foundry requests no permissions');
check(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates against the manifest');
check(contract.boundaries.refuses.includes('automatic-platform-run') && contract.boundaries.refuses.includes('seed-as-runtime-proof'), 'authority and truth boundaries are explicit');

const input = {
  title: 'Living Interface Organism',
  subject: 'a platform-native adjustable interaction system',
  goal: 'Grow reusable human-machine interface organs with evidence and rollback.',
  targetPlatform: 'ChatGPT platform workspace',
  kind: 'organ-system',
  depth: 'deep',
  seedCount: 8,
  suggestedRuns: 7,
  maxChildrenPerSeed: 3,
  tracks: ['core', 'interface', 'evidence', 'safety', 'exchange', 'evolution'],
  constraints: ['local-first', 'no automatic publication'],
  existingCapabilities: ['visual-kernel/v1', 'review-inbox/v1'],
  createdAt: '2026-07-27T12:00:00.000Z',
  operator: 'Mike'
};
const first = Seed.compile(input);
const later = Seed.compile(Object.assign({}, input, { createdAt: '2030-01-01T00:00:00.000Z' }));
const digest = Seed.nodeDigest(first);
const packet = Seed.attachDigest(first, digest);
const validation = Seed.validate(packet);

check(validation.pass, 'compiled seed pack validates: ' + validation.errors.join('; '));
check(packet.modules.length === 8 && new Set(packet.modules.map(item => item.id)).size === 8, 'requested seed count has unique identities');
check(new Set(packet.modules.map(item => item.lane)).size === 6, 'six modular growth lanes are represented');
check(packet.modules.every(item => item.status === 'SEED' && item.evidenceStatus === 'UNTESTED' && item.authority === 'NONE'), 'every module remains an untested no-authority seed');
check(packet.modules.every(item => item.contract.permissions.length === 0 && item.work.files.includes('selftest.js')), 'every seed requires no permissions and an executable selftest');
check(packet.growthBudget.maximumCandidatesPerRun === 24 && packet.growthBudget.automaticRun === false, 'growth multiplier is a bounded per-run ceiling');
check(packet.intake.target === 'modular-intake-gate' && packet.intake.humanReviewRequired && !packet.intake.installAuthority, 'intake remains human reviewed and non-installing');
check(Seed.nodeDigest(first) === Seed.nodeDigest(later), 'semantic digest ignores only creation time');
check(first.seedId === later.seedId, 'stable intent keeps one seed identity across sessions');
check(/^[a-f0-9]{64}$/.test(packet.integrity.semanticDigest), 'portable pack carries a complete SHA-256 digest');
const brief = Seed.platformBrief(packet);
check(brief.includes('one explicitly requested run at a time') && brief.includes('Do not install, merge, publish or promote it.'), 'platform brief preserves bounded human initiation');
check(brief.includes(JSON.stringify(packet, null, 2)), 'platform brief embeds the complete machine-readable packet');
check(brief.includes('`SKIP`') && brief.includes('`PARK`') && brief.includes('`REVIEW`'), 'platform brief carries intake dispositions');

const tampered = JSON.parse(JSON.stringify(packet));
tampered.modules[0].authority = 'APPLY';
check(!Seed.validate(tampered).pass, 'authority escalation invalidates a seed pack');
const tooLarge = Seed.compile(Object.assign({}, input, { seedCount: 999, maxChildrenPerSeed: 999 }));
check(tooLarge.modules.length === 12 && tooLarge.growthBudget.maximumCandidatesPerRun === 48, 'seed and growth ceilings clamp deterministically');
check(JSON.parse(fs.readFileSync(path.join(__dirname, 'schemas', 'modular-growth-seed.schema.json'), 'utf8')).$id === Seed.SCHEMA, 'portable JSON schema matches the runtime schema');
check(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').includes('Download platform brief'), 'explicit platform handoff exists in the UI');

console.log('Modular Seed Foundry selftest: PASS - ' + checks + ' checks');
