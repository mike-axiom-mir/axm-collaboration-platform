'use strict';

const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');
const Zip = require('../asset-hands/substrate-pack/zip');

const RETURN_SCHEMA = 'axm.workshop-package-return/v1';
const PACKAGE_SCHEMA = 'axm.workshop-package/v1';
const MAX_ARCHIVE_BYTES = 30 * 1024 * 1024;
const MAX_FILES = 320;
const MAX_EXPANDED_BYTES = 30 * 1024 * 1024;
const CONTROL_FILES = new Set(['PACKAGE_MANIFEST.json', 'BUILD_ON_GUIDE.md']);

function rowDigest(rows, stripPrefix) {
  const prefix = String(stripPrefix || '');
  const normalized = rows.map(row => ({
    path: prefix && row.path.startsWith(prefix) ? row.path.slice(prefix.length) : row.path,
    sha256: row.sha256
  })).sort((a, b) => a.path.localeCompare(b.path));
  return U.sha256(Buffer.from(JSON.stringify(normalized)));
}

function fileRows(folder, workshopPrefix) {
  return U.walk(folder, { maxFiles: MAX_FILES, maxBytes: MAX_EXPANDED_BYTES }).files.map(file => ({
    path: workshopPrefix + file.relative,
    bytes: file.bytes,
    sha256: U.fileSha256(file.absolute)
  })).sort((a, b) => a.path.localeCompare(b.path));
}

function compareRows(baseRows, nextRows) {
  const base = new Map(baseRows.map(row => [row.path, row]));
  const next = new Map(nextRows.map(row => [row.path, row]));
  const added = [], modified = [], removed = [], unchanged = [];
  for (const [file, row] of next) {
    if (!base.has(file)) added.push(file);
    else if (base.get(file).sha256 !== row.sha256) modified.push(file);
    else unchanged.push(file);
  }
  for (const file of base.keys()) if (!next.has(file)) removed.push(file);
  return { added: added.sort(), modified: modified.sort(), removed: removed.sort(), unchanged: unchanged.length };
}

function validateBaseRows(manifest) {
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > MAX_FILES) throw new Error('package base ledger must contain 1-' + MAX_FILES + ' files');
  const seen = new Set();
  return manifest.files.map((item, index) => {
    const relative = U.safeRelative(item.path);
    if (seen.has(relative.toLowerCase())) throw new Error('duplicate base-ledger path: ' + relative);
    seen.add(relative.toLowerCase());
    const sha256 = String(item.sha256 || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('invalid base-ledger SHA-256 at file ' + index);
    const bytes = Number(item.bytes);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_EXPANDED_BYTES) throw new Error('invalid base-ledger byte count at file ' + index);
    return { path: relative, bytes, sha256 };
  });
}

function manifestLocation(entries) {
  const matches = entries.filter(entry => !entry.directory && (entry.name === 'PACKAGE_MANIFEST.json' || entry.name.endsWith('/PACKAGE_MANIFEST.json')));
  if (matches.length !== 1) throw new Error('returned ZIP needs exactly one PACKAGE_MANIFEST.json');
  const suffix = '/PACKAGE_MANIFEST.json';
  return { entry: matches[0], prefix: matches[0].name.endsWith(suffix) ? matches[0].name.slice(0, -suffix.length) : '' };
}

function moduleScopes(manifest, extracted) {
  const raw = manifest.selection && Array.isArray(manifest.selection.scopes) ? manifest.selection.scopes : [];
  const scopes = raw.map(scope => U.safeRelative(scope));
  const modules = scopes.map(scope => {
    const match = /^tools\/([a-z0-9][a-z0-9-]{1,79})$/.exec(scope);
    if (!match) return null;
    const folder = path.join(extracted, 'tools', match[1]);
    return fs.existsSync(path.join(folder, 'manifest.json')) && fs.existsSync(path.join(folder, 'module.contract.json'))
      ? { id: match[1], scope, folder }
      : null;
  }).filter(Boolean);
  return { scopes, modules };
}

function outsideTargetChanges(baseRows, returnedRows, targetPrefix) {
  const relevantBase = baseRows.filter(row => !CONTROL_FILES.has(row.path) && !row.path.startsWith(targetPrefix));
  const relevantReturned = returnedRows.filter(row => !CONTROL_FILES.has(row.path) && !row.path.startsWith(targetPrefix));
  return compareRows(relevantBase, relevantReturned);
}

function inspect(input, options) {
  if (!input || input.schema !== RETURN_SCHEMA) throw new Error('return schema must be ' + RETURN_SCHEMA);
  const archive = Buffer.from(String(input.archiveBase64 || ''), 'base64');
  if (!archive.length || archive.length > MAX_ARCHIVE_BYTES) throw new Error('returned ZIP must be 1 byte to 30 MiB');
  if (archive.readUInt32LE(0) !== 0x04034b50) throw new Error('returned file is not a ZIP archive');
  const entries = Zip.list(archive), expanded = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (entries.length > MAX_FILES || expanded > MAX_EXPANDED_BYTES) throw new Error('returned ZIP exceeds the 320-file or 30-MiB expanded safety limit');
  const located = manifestLocation(entries), root = path.resolve(options.root), tempRoot = path.resolve(options.tempRoot);
  if (located.prefix) {
    const outsideTopFolder = entries.filter(entry => entry.name !== located.prefix && !entry.name.startsWith(located.prefix + '/'));
    if (outsideTopFolder.length) throw new Error('returned ZIP contains entries outside its build-on top folder');
  }
  const temp = path.join(tempRoot, 'return-' + U.uid('zip'));
  U.assertUnder(temp, tempRoot);
  fs.mkdirSync(tempRoot, { recursive: true });
  try {
    Zip.extractBuffer(archive, temp, { stripPrefix: located.prefix });
    const manifestFile = path.join(temp, 'PACKAGE_MANIFEST.json');
    if (!fs.existsSync(manifestFile)) throw new Error('PACKAGE_MANIFEST.json was not restored at the archive root');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''));
    if (manifest.schema !== PACKAGE_SCHEMA || manifest.mode !== 'module' || manifest.package_kind !== 'workshop-modular-slice') throw new Error('returned ZIP must come from the Workshop modular packager');
    const handoff = manifest.collaboration;
    if (!handoff || handoff.schema !== 'axm.build-on-handoff/v1' || handoff.role !== 'current-local-build-on-source' || handoff.intended_return_schema !== RETURN_SCHEMA) {
      throw new Error('returned ZIP is not marked as a current build-on handoff; create a fresh Current build-on ZIP');
    }
    const exportId = String(handoff.export_id || '');
    if (!/^axm-workshop-module-[a-zA-Z0-9-]{8,100}$/.test(exportId)) throw new Error('build-on handoff export id is missing or invalid');
    const baseRows = validateBaseRows(manifest), discovered = moduleScopes(manifest, temp);
    if (!discovered.modules.length) throw new Error('returned ZIP contains no selected installable module');
    let moduleId = String(input.moduleId || '').trim();
    if (!moduleId && discovered.modules.length > 1) throw new Error('returned ZIP contains multiple modules; choose one target id: ' + discovered.modules.map(item => item.id).join(', '));
    moduleId = U.cleanId(moduleId || discovered.modules[0].id, 'moduleId');
    const selected = discovered.modules.find(item => item.id === moduleId);
    if (!selected) throw new Error('chosen module is not an installable selected scope: ' + moduleId);

    const extractedRows = fileRows(temp, '');
    const unexpected = extractedRows.filter(row => !CONTROL_FILES.has(row.path) && !discovered.scopes.some(scope => row.path === scope || row.path.startsWith(scope + '/')));
    if (unexpected.length) throw new Error('returned ZIP added files outside its exported scopes: ' + unexpected.slice(0, 8).map(row => row.path).join(', '));

    const targetPrefix = selected.scope + '/', baseTarget = baseRows.filter(row => row.path.startsWith(targetPrefix));
    if (!baseTarget.length) throw new Error('package base ledger contains no files for ' + selected.scope);
    const liveTarget = path.join(root, 'tools', moduleId);
    if (!fs.existsSync(liveTarget)) throw new Error('build-on return targets an unavailable live module: ' + moduleId);
    const currentRows = fileRows(liveTarget, targetPrefix), baseDrift = compareRows(baseTarget, currentRows);
    if (baseDrift.added.length || baseDrift.modified.length || baseDrift.removed.length) {
      throw new Error('STALE_BUILD_ON_BASE: the live module changed after this ZIP was exported; create a fresh build-on ZIP instead');
    }

    const returnedTarget = fileRows(selected.folder, targetPrefix), changes = compareRows(baseTarget, returnedTarget);
    const contextChanges = outsideTargetChanges(baseRows, extractedRows, targetPrefix);
    if (contextChanges.added.length || contextChanges.modified.length || contextChanges.removed.length) {
      throw new Error('returned ZIP changed context outside the chosen module; return each improved module separately');
    }
    if (!changes.added.length && !changes.modified.length && !changes.removed.length) throw new Error('returned ZIP contains no changes to ' + moduleId);

    const moduleRows = U.walk(selected.folder, { maxFiles: 300, maxBytes: MAX_EXPANDED_BYTES }).files;
    const bundle = {
      schema: 'axm.module-bundle/v1',
      requiredSeats: 1,
      files: moduleRows.map(file => ({ path: file.relative, encoding: 'base64', content: fs.readFileSync(file.absolute).toString('base64'), sha256: U.fileSha256(file.absolute) }))
    };
    return {
      bundle,
      intake: {
        schema: RETURN_SCHEMA,
        source: 'workshop-modular-slice',
        exportId,
        archiveSha256: U.sha256(archive),
        packageManifestSha256: U.fileSha256(manifestFile),
        packageCreatedAt: manifest.created_at || null,
        exportedScopes: discovered.scopes,
        targetScope: selected.scope,
        baseModuleDigest: rowDigest(baseTarget, targetPrefix),
        currentModuleDigestAtStage: rowDigest(currentRows, targetPrefix),
        changes,
        selftestPresent: fs.existsSync(path.join(selected.folder, 'selftest.js')),
        baseBinding: 'EXACT_MATCH'
      }
    };
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { recursive: true, force: true });
  }
}

module.exports = { RETURN_SCHEMA, PACKAGE_SCHEMA, MAX_ARCHIVE_BYTES, MAX_FILES, MAX_EXPANDED_BYTES, compareRows, fileRows, rowDigest, inspect };
