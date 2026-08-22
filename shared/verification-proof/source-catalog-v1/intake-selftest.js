'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MODULES = path.join(ROOT, 'modules');
const RECEIPT = JSON.parse(fs.readFileSync(path.join(ROOT, 'INTAKE_RECEIPT.json'), 'utf8'));
const HELD_ID = 'axm.verify.clock-timezone-locale-controller';
const ROOT_FILES = ['INTAKE.md', 'INTERFACE.json', 'README.md', 'STATUS.json', 'module.contract.json'];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
}

function json(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const moduleIds = fs.readdirSync(MODULES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.equal(RECEIPT.status, 'TEST_HOLD');
assert.equal(RECEIPT.integration, 'DETACHED_REFERENCE');
assert.equal(RECEIPT.canon, false);
assert.equal(RECEIPT.authority, 'NONE');
assert.equal(moduleIds.length, RECEIPT.accepted.module_count);
assert.equal(moduleIds.includes(HELD_ID), false);

let totalFiles = 0;
let totalBytes = 0;
let totalReferenceTests = 0;
const contentHashes = new Map();
const optionalUpstreams = new Set();

for (const moduleId of moduleIds) {
  assert.match(moduleId, /^axm\.verify\.[a-z0-9-]+$/);
  const moduleRoot = path.join(MODULES, moduleId);
  const relativeFiles = walk(moduleRoot).map((file) => path.relative(moduleRoot, file).replaceAll('\\', '/'));

  for (const required of ROOT_FILES) assert(relativeFiles.includes(required), `${moduleId} missing ${required}`);
  assert.equal(relativeFiles.filter((file) => file.startsWith('fixtures/')).length, 1, `${moduleId} fixture count`);
  assert.equal(relativeFiles.filter((file) => file.startsWith('src/') && file.endsWith('.py')).length, 1, `${moduleId} source count`);
  assert.equal(relativeFiles.filter((file) => file.startsWith('tests/') && file.endsWith('.py')).length, 1, `${moduleId} test count`);
  assert.equal(relativeFiles.length, 8, `${moduleId} curated file count`);

  const status = json(path.join(moduleRoot, 'STATUS.json'));
  const contract = json(path.join(moduleRoot, 'module.contract.json'));
  const intake = json(path.join(moduleRoot, 'INTERFACE.json'));
  assert.equal(status.id, moduleId);
  assert.equal(contract.module_id, moduleId);
  assert.equal(intake.module_id, moduleId);
  assert.equal(status.version, contract.contract_version);
  assert.equal(status.version, intake.version);
  assert.equal(status.status, 'TEST_HOLD');
  assert.equal(status.integration, 'DETACHED');
  assert.equal(status.canon, false);
  assert.equal(status.approval_authority, false);
  assert.equal(intake.status, 'TEST_HOLD');
  assert.equal(intake.integration, 'DETACHED');
  assert.equal(intake.canon, false);
  assert.equal(intake.authority, 'NONE');
  assert.equal(status.reference_test_count, intake.reference_test_count);
  totalReferenceTests += status.reference_test_count;
  for (const upstream of intake.optional_upstream_modules || []) optionalUpstreams.add(upstream);

  for (const file of walk(moduleRoot)) {
    const relative = path.relative(ROOT, file).replaceAll('\\', '/');
    assert.equal(/(^|\/)(__pycache__|RUNS|ROLLBACKS|CHECKPOINTS)(\/|$)/.test(relative), false, `forbidden directory ${relative}`);
    assert.equal(/\.(pyc|zip)$/i.test(relative), false, `forbidden artifact ${relative}`);
    assert.notEqual(path.basename(file), 'VERSION', `repeated VERSION file ${relative}`);
    const bytes = fs.readFileSync(file);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(contentHashes.has(digest), false, `duplicate content: ${relative} and ${contentHashes.get(digest)}`);
    contentHashes.set(digest, relative);
    totalFiles += 1;
    totalBytes += bytes.length;
  }
}

for (const upstream of optionalUpstreams) assert(moduleIds.includes(upstream), `unresolved optional upstream ${upstream}`);
assert.equal(totalFiles, RECEIPT.accepted.module_file_count);
assert.equal(totalBytes, RECEIPT.accepted.module_bytes);
assert.equal(contentHashes.size, RECEIPT.accepted.unique_content_hashes);
assert.equal(totalReferenceTests, RECEIPT.accepted.reference_test_count);

console.log(`Verification Proof curated intake: PASS (${moduleIds.length} organs, ${totalFiles} unique files, ${totalReferenceTests} reference tests recorded)`);
