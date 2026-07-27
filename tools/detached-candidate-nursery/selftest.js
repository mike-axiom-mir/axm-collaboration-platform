#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('./core/nursery-core');

let passed = 0;
function check(condition, label) {
  assert(condition, label);
  passed += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function json(file, value) {
  write(file, JSON.stringify(value, null, 2) + '\n');
}

function manifest(id) {
  return {
    id,
    name: id,
    version: 'v0.1',
    status: 'EXPERIMENTAL',
    entry: 'index.html',
    contract: 'module.contract.json',
    uses: ['storage'],
    permissions: ['storage']
  };
}

function contract(id) {
  return {
    schema: Core.CONTRACT_SCHEMA,
    id,
    version: 'v0.1',
    provides: ['fixture'],
    consumes: [],
    permissions: ['storage'],
    handoffs: { emits: [], accepts: [] },
    lifecycle: {
      state_owner: 'filesystem',
      reload: 'reset',
      disconnect: 'not-applicable',
      cleanup: 'explicit'
    },
    boundaries: { writes: [], refuses: ['automatic-installation'] }
  };
}

function receipt(id) {
  return {
    schema: Core.RECEIPT_SCHEMA,
    candidate: { id, version: 'v0.1' },
    authority: {
      installed: false,
      registered: false,
      staged: false,
      promoted: false,
      canonChanged: false,
      permissionsChanged: false
    }
  };
}

function buildBundle(folder, overrideFiles) {
  const relativeFiles = overrideFiles || ['manifest.json', 'module.contract.json', 'index.html', 'candidate.receipt.json'];
  const files = relativeFiles.map(relative => {
    const bytes = fs.readFileSync(path.join(folder, relative));
    return {
      path: relative,
      encoding: 'base64',
      content: bytes.toString('base64'),
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    };
  });
  json(path.join(folder, 'module-bundle.json'), { schema: Core.BUNDLE_SCHEMA, requiredSeats: 1, files });
}

function createCandidate(root, id, withBundle) {
  const folder = path.join(root, id);
  json(path.join(folder, 'manifest.json'), manifest(id));
  json(path.join(folder, 'module.contract.json'), contract(id));
  write(path.join(folder, 'index.html'), '<!doctype html><title>' + id + '</title>\n');
  json(path.join(folder, 'candidate.receipt.json'), receipt(id));
  if (withBundle) buildBundle(folder);
  return folder;
}

function safelyRemove(root) {
  const resolved = path.resolve(root);
  const prefix = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith('axm-nursery-selftest-')) {
    throw new Error('temporary cleanup boundary refused');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-nursery-selftest-'));
  try {
    const readyFolder = createCandidate(root, 'ready-one', true);
    createCandidate(root, 'draft-one', false);
    const invalidFolder = createCandidate(root, 'invalid-one', false);
    const unsafeFolder = createCandidate(root, 'unsafe-one', false);
    write(path.join(invalidFolder, 'manifest.json'), '{broken');
    const unsafeManifest = manifest('unsafe-one');
    const unsafeContract = contract('unsafe-one');
    const unsafeReceipt = receipt('unsafe-one');
    const unsafeBundle = {
      schema: Core.BUNDLE_SCHEMA,
      files: [
        { path: '../escape.js', encoding: 'utf8', content: 'no', sha256: Core.sha256(Buffer.from('no')) },
        { path: 'manifest.json', encoding: 'utf8', content: JSON.stringify(unsafeManifest), sha256: Core.sha256(Buffer.from(JSON.stringify(unsafeManifest))) },
        { path: 'module.contract.json', encoding: 'utf8', content: JSON.stringify(unsafeContract), sha256: Core.sha256(Buffer.from(JSON.stringify(unsafeContract))) },
        { path: 'candidate.receipt.json', encoding: 'utf8', content: JSON.stringify(unsafeReceipt), sha256: Core.sha256(Buffer.from(JSON.stringify(unsafeReceipt))) }
      ]
    };
    json(path.join(unsafeFolder, 'module-bundle.json'), unsafeBundle);
    write(path.join(root, 'ready-one.zip'), 'fixture archive');

    const one = Core.scanSupply(root, { now: '2026-07-25T08:00:00.000Z' });
    const two = Core.scanSupply(root, { now: '2026-07-25T09:00:00.000Z' });
    const byId = id => one.candidates.find(item => item.id === id);
    check(one.schema === Core.REGISTRY_SCHEMA, 'registry uses the declared schema');
    check(one.source.fingerprint === two.source.fingerprint, 'registry fingerprint ignores measurement time');
    check(one.summary.total === 4, 'four detached folders are counted');
    check(one.summary.readyForLaterIntake === 1, 'one exact candidate is ready for later intake');
    check(one.summary.drafts === 1, 'missing bundle remains a visible draft');
    check(one.summary.needsRepair === 2, 'invalid and unsafe candidates need repair');
    check(byId('ready-one').bundle.exactFolderParity === true, 'ready bundle exactly matches its folder');
    check(byId('ready-one').authority.installed === false, 'detached authority stays explicit');
    check(byId('draft-one').status === 'DRAFT', 'draft is not mislabeled ready');
    check(one.candidates.find(item => item.folder === 'invalid-one').errors.some(item => item.code === 'INVALID_JSON'), 'invalid manifest is preserved as an error');
    check(byId('unsafe-one').errors.some(item => item.code === 'BUNDLE_PATH_UNSAFE'), 'unsafe bundle path is refused');
    check(one.archives.length === 1 && /^[a-f0-9]{64}$/.test(one.archives[0].sha256), 'sibling archive receives a digest without extraction');
    check(one.truth.candidateCodeExecuted === false && one.truth.archiveExtracted === false, 'scan executes and extracts nothing');
    check(one.truth.stagingPerformed === false && one.truth.installationPerformed === false, 'scan performs no intake action');

    write(path.join(readyFolder, 'index.html'), '<!doctype html><title>changed after bundle</title>\n');
    const drifted = Core.scanSupply(root);
    const driftedReady = drifted.candidates.find(item => item.id === 'ready-one');
    check(driftedReady.status === 'NEEDS_REPAIR', 'folder byte drift blocks ready status');
    check(driftedReady.errors.some(item => item.code === 'BUNDLE_FOLDER_DRIFT'), 'byte drift names the exact failure');

    const excluded = Core.scanSupply(root, { excludeFolders: ['draft-one'] });
    check(excluded.summary.total === 3 && excluded.source.excludedFolders.includes('draft-one'), 'explicit self-style exclusion remains visible');
    const archiveExcluded = Core.scanSupply(root, { excludeArchives: ['ready-one.zip'] });
    check(archiveExcluded.archives.length === 0 && archiveExcluded.source.excludedArchives.includes('ready-one.zip'), 'explicit self-archive exclusion remains visible');

    const liveRoot = process.argv[2] || process.env.AXM_CANDIDATE_ROOT;
    if (liveRoot) {
      const live = Core.scanSupply(liveRoot, {
        excludeFolders: ['detached-candidate-nursery'],
        excludeArchives: ['AXM_Detached_Candidate_Nursery_EXPERIMENTAL_2026-07-25.zip']
      });
      const census = live.candidates.find(item => item.id === 'workshop-census-observatory');
      check(Boolean(census), 'live detached supply contains the accepted Census Observatory');
      check(census.status === 'READY_FOR_LATER_INTAKE', 'accepted Census bundle still exactly matches its folder');
      check(live.truth.automaticAction === false && live.truth.canonChanged === false, 'live nursery scan carries no automatic or CANON authority');
    }

    process.stdout.write('\nDetached Candidate Nursery selftest: PASS (' + passed + ' checks)\n');
  } finally {
    safelyRemove(root);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write((error && error.stack || error) + '\n');
  process.exitCode = 1;
}
