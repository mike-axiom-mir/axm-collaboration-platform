'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const K = require('./mirror-code-clone-kernel');
const ContractVerifier = require('../../hub/module-contract-verifier');

let checks = 0;
function ok(value, message) { assert.ok(value, message); checks++; }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function moduleFixture(root, id, contractPermissions, manifestPermissions) {
  const moduleRoot = path.join(root, 'tools', id);
  const manifest = { schema: 'axm.tool-manifest/v1', id, name: id, version: 'v0.1', status: 'TEST', entry: 'index.html', contract: 'module.contract.json', type: 'hub-module', hubApiVersion: '1.0', uses: [], permissions: manifestPermissions };
  const contract = { schema: 'axm.module-contract/v1', id, version: 'v0.1', provides: [], consumes: [], permissions: contractPermissions, handoffs: { emits: [], accepts: [] }, boundaries: { writes: [], refuses: [] }, lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'automatic' } };
  writeJson(path.join(moduleRoot, 'manifest.json'), manifest);
  writeJson(path.join(moduleRoot, 'module.contract.json'), contract);
  fs.writeFileSync(path.join(moduleRoot, 'index.html'), '<!doctype html><title>' + id + '</title>\n');
  return moduleRoot;
}
function trialRoot(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-code-clone-test-'));
  writeJson(path.join(root, K.MARKER), { schema: K.CANDIDATE_SCHEMA, writeScope: 'this-root-only', label });
  return root;
}

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
ok(manifest.id === 'mirror-code-clone' && contract.id === manifest.id, 'manifest and contract identity');
ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates');
ok(contract.boundaries.refuses.includes('workshop-source-mutation') && contract.boundaries.refuses.includes('pure-mirror-mutation'), 'original source and pure Mirror are outside authority');
ok(contract.boundaries.refuses.includes('automatic-promotion') && contract.boundaries.refuses.includes('automatic-publish'), 'promotion and publishing remain human-gated');

const root = trialRoot('selection-test');
moduleFixture(root, 'healthy', [], []);
moduleFixture(root, 'zeta-two-edits', ['export', 'storage'], []);
moduleFixture(root, 'alpha-one-edit', ['export'], []);
const scan = K.scanCandidate(root);
ok(scan.summary.inspected === 3 && scan.summary.repairable === 2, 'clone distinguishes healthy and repairable candidates');
ok(scan.selected.moduleId === 'alpha-one-edit', 'clone chooses the smallest repair without a named target');
const receipt = K.improveCandidate(root);
ok(receipt.status === 'IMPROVED_CANDIDATE' && receipt.changed, 'candidate improves autonomously');
ok(receipt.evidence.moduleId === 'alpha-one-edit' && receipt.evidence.selectedWithoutNamedTarget, 'receipt proves autonomous selection');
ok(receipt.evidence.addedPermissions.join() === 'export', 'only the contract-requested permission was added');
const repairedManifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'alpha-one-edit', 'manifest.json'), 'utf8'));
const repairedContract = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'alpha-one-edit', 'module.contract.json'), 'utf8'));
ok(ContractVerifier.validateContract(repairedContract, repairedManifest).pass, 'independent contract verifier accepts the result');
ok(receipt.evidence.beforeSha256 !== receipt.evidence.finalSha256 && receipt.evidence.finalSha256 === receipt.evidence.proposedSha256, 'receipt hashes bind the kept edit');
const otherManifest = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'zeta-two-edits', 'manifest.json'), 'utf8'));
ok(otherManifest.permissions.length === 0, 'unselected candidate was untouched');
ok(receipt.boundaries.sourceWorkshopWriteAttempted === false && receipt.boundaries.originalMirrorWriteAttempted === false, 'receipt records the write boundary');
const receiptPath = K.writeReceipt(root, receipt);
ok(fs.existsSync(receiptPath), 'hash-bound receipt is persisted inside the candidate root');

const rollbackRoot = trialRoot('rollback-test');
const rollbackModule = moduleFixture(rollbackRoot, 'rollback-me', ['export'], []);
const exactBefore = fs.readFileSync(path.join(rollbackModule, 'manifest.json'), 'utf8');
const rollbackReceipt = K.improveCandidate(rollbackRoot, { verifyCandidate: () => ({ pass: false, errors: ['independent verifier rejected candidate'] }) });
ok(rollbackReceipt.status === 'ROLLED_BACK' && rollbackReceipt.evidence.rolledBack, 'failed post-verification triggers rollback');
ok(fs.readFileSync(path.join(rollbackModule, 'manifest.json'), 'utf8') === exactBefore, 'rollback restores exact original bytes');

const unmarked = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-code-clone-unmarked-'));
let unmarkedRefused = false;
try { K.scanCandidate(unmarked); } catch (error) { unmarkedRefused = /marker/.test(error.message); }
ok(unmarkedRefused, 'unmarked roots are refused');
let workshopRefused = false;
try { K.scanCandidate(path.resolve(__dirname, '..', '..')); } catch (error) { workshopRefused = /outside|source|marker/.test(error.message); }
ok(workshopRefused, 'Workshop root is refused');

fs.rmSync(root, { recursive: true, force: true });
fs.rmSync(rollbackRoot, { recursive: true, force: true });
fs.rmSync(unmarked, { recursive: true, force: true });
console.log('Mirror Code Clone self-test: PASS (' + checks + ' checks; autonomous candidate repair, verification, receipt, rollback, original-source refusal)');
