#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const K = require('./mirror-code-clone-kernel');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function fixture(id, permissions, declaredPermissions) {
  return {
    manifest: {
      schema: 'axm.tool-manifest/v1', id, name: id, version: 'v0.1', status: 'TEST', entry: 'index.html',
      contract: 'module.contract.json', type: 'hub-module', hubApiVersion: '1.0', uses: [], permissions: declaredPermissions
    },
    contract: {
      schema: 'axm.module-contract/v1', id, version: 'v0.1', provides: [], consumes: [], permissions,
      handoffs: { emits: [], accepts: [] }, boundaries: { writes: [], refuses: ['automatic-promotion'] },
      lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'automatic' }
    }
  };
}

function createTrialRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-code-clone-trial-'));
  writeJson(path.join(root, K.MARKER), { schema: K.CANDIDATE_SCHEMA, writeScope: 'this-root-only', label: 'autonomous-held-out-trial' });
  const cases = [
    fixture('healthy-observer', [], []),
    fixture('zeta-two-edits', ['export', 'storage'], []),
    fixture('alpha-one-edit', ['export'], [])
  ];
  for (const item of cases) {
    const moduleRoot = path.join(root, 'tools', item.manifest.id);
    writeJson(path.join(moduleRoot, 'manifest.json'), item.manifest);
    writeJson(path.join(moduleRoot, 'module.contract.json'), item.contract);
    fs.writeFileSync(path.join(moduleRoot, 'index.html'), '<!doctype html><title>' + item.manifest.id + '</title>\n');
  }
  return root;
}

function main() {
  const command = process.argv[2] || 'help';
  if (command === 'trial') {
    const root = createTrialRoot();
    const receipt = K.improveCandidate(root);
    const receiptPath = K.writeReceipt(root, receipt);
    const selected = JSON.parse(fs.readFileSync(path.join(root, 'tools', receipt.evidence.moduleId, 'manifest.json'), 'utf8'));
    const independentlyPasses = receipt.status === 'IMPROVED_CANDIDATE' && selected.permissions.includes('export');
    console.log(JSON.stringify({ command, independentlyPasses, receiptPath, candidateRoot: root, receipt }, null, 2));
    if (!independentlyPasses) process.exitCode = 1;
    return;
  }
  if (command === 'improve') {
    const root = process.argv[3];
    if (!root) throw new Error('usage: improve <marked-candidate-root>');
    const receipt = K.improveCandidate(root);
    const receiptPath = K.writeReceipt(root, receipt);
    console.log(JSON.stringify({ receiptPath, receipt }, null, 2));
    return;
  }
  console.log('Mirror Code Clone\n  trial                         autonomous held-out capability trial\n  improve <candidate-root>      choose and repair one marked disposable candidate');
}

try { main(); } catch (error) { console.error('Mirror Code Clone refused: ' + error.message); process.exitCode = 1; }
