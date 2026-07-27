#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Zip = require('../../shared/asset-hands/substrate-pack/zip');
const U = require('../../shared/operations/operations-utils');
const ReturnedPackage = require('../../shared/operations/workshop-package-return');
const Installer = require('../../shared/operations/installer-service');

const archivePath = path.resolve(String(process.argv[2] || ''));
if (!archivePath || !fs.existsSync(archivePath)) throw new Error('pass a real Workshop Packager modular ZIP path');
const archive = fs.readFileSync(archivePath), entries = Zip.list(archive);
const manifests = entries.filter(entry => entry.name === 'PACKAGE_MANIFEST.json' || entry.name.endsWith('/PACKAGE_MANIFEST.json'));
assert.equal(manifests.length, 1, 'package must contain one manifest');
const suffix = '/PACKAGE_MANIFEST.json';
const archivePrefix = manifests[0].name.endsWith(suffix) ? manifests[0].name.slice(0, -suffix.length) : '';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-build-on-return-selftest-'));

try {
  const extracted = path.join(temp, 'extracted');
  Zip.extractBuffer(archive, extracted, { stripPrefix:archivePrefix });
  assert.throws(() => ReturnedPackage.inspect({ schema:ReturnedPackage.RETURN_SCHEMA, archiveBase64:archive.toString('base64') }, { root:path.resolve(__dirname, '..', '..'), tempRoot:path.join(temp, 'no-change') }), /contains no changes/, 'unchanged export must not create a candidate');
  const manifest = JSON.parse(fs.readFileSync(path.join(extracted, 'PACKAGE_MANIFEST.json'), 'utf8').replace(/^\uFEFF/, ''));
  const moduleScope = manifest.selection.scopes.find(scope => /^tools\/[a-z0-9-]+$/.test(scope));
  assert(moduleScope, 'package must select an installable module');
  const readme = path.join(extracted, moduleScope, 'README.md');
  assert(fs.existsSync(readme), 'selected module needs README.md for this non-code interoperability edit');
  fs.appendFileSync(readme, '\n<!-- return interoperability selftest edit -->\n');
  const returnedZip = path.join(temp, 'returned.zip');
  U.zipDirectory(extracted, returnedZip, { maxFiles:ReturnedPackage.MAX_FILES, maxBytes:ReturnedPackage.MAX_EXPANDED_BYTES });
  const prepared = ReturnedPackage.inspect({ schema:ReturnedPackage.RETURN_SCHEMA, archiveBase64:fs.readFileSync(returnedZip).toString('base64') }, { root:path.resolve(__dirname, '..', '..'), tempRoot:path.join(temp, 'inspect') });
  const decoded = Installer.decodeBundle(prepared.bundle), validation = Installer.inspectDecoded(decoded);
  assert(validation.pass, validation.errors.join('; '));
  assert.equal(prepared.intake.baseBinding, 'EXACT_MATCH');
  assert(prepared.intake.changes.modified.includes(moduleScope + '/README.md'));
  console.log('PASS real Packager ZIP -> exact-base return intake -> valid installer candidate (' + moduleScope + ')');
} finally {
  const resolved = path.resolve(temp), tempPrefix = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(tempPrefix) || !path.basename(resolved).startsWith('axm-build-on-return-selftest-')) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive:true, force:true });
}
