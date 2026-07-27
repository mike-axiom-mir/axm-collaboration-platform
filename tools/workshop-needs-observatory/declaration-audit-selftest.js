'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const serviceFactory = require('../../shared/modular-intake/needs-observatory-service');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-declaration-audit-'));
const tools = path.join(root, 'tools');
fs.mkdirSync(tools, { recursive: true });

function moduleFolder(name, manifest, files) {
  const folder = path.join(tools, name);
  fs.mkdirSync(folder, { recursive: true });
  if (manifest !== undefined) fs.writeFileSync(path.join(folder, 'manifest.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  Object.keys(files || {}).forEach(file => fs.writeFileSync(path.join(folder, file), files[file]));
}

moduleFolder('good', { id: 'good', entry: 'index.html', contract: 'module.contract.json' }, { 'index.html': '', 'module.contract.json': '{}' });
moduleFolder('legacy', { id: 'legacy', entry: 'index.html' }, { 'index.html': '' });
moduleFolder('alias-folder', { id: 'alias-id', entry: 'index.html', contract: 'module.contract.json' }, { 'index.html': '', 'module.contract.json': '{}' });
moduleFolder('broken-json', '{', {});
moduleFolder('missing-manifest', undefined, { 'index.html': '' });

const intake = { status() { return { promoted: [], candidates: [], backup: { configured: true, truth: 'configured' } }; } };
const service = serviceFactory.create({ root, stateRoot: path.join(root, 'state'), modularIntakeService: intake });
const audit = service.declarationAudit();
const codes = audit.findings.map(item => item.code);

assert.equal(audit.schema, 'axm.declaration-drift-audit/v1');
assert.equal(audit.scanned, 5);
assert.ok(codes.includes('MODULE_CONTRACT_NOT_DECLARED'));
assert.ok(codes.includes('ID_FOLDER_MISMATCH'));
assert.ok(codes.includes('INVALID_MANIFEST'));
assert.ok(codes.includes('MISSING_MANIFEST'));
assert.equal(audit.findings.some(item => item.folder === 'good'), false);
assert.equal(audit.summary.blocking, 2);
assert.equal(audit.summary.review, 1);
assert.equal(audit.summary.legacy, 1);

fs.rmSync(root, { recursive: true, force: true });
console.log('workshop declaration drift audit self-test passed · 8 assertions');
