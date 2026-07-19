'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const WorkshopRoot = require('../config/workshop-root');

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function measure(root, extension) {
  const resolvedRoot = path.resolve(root);
  const suffix = `.${String(extension || '').replace(/^\./, '').toLowerCase()}`;
  const documents = [];
  const refusedSymbolicLinks = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const target = path.join(directory, entry.name);
      const relativePath = path.relative(resolvedRoot, target).replace(/\\/g, '/');
      if (entry.isSymbolicLink()) { refusedSymbolicLinks.push(relativePath); continue; }
      if (entry.isDirectory()) { walk(target); continue; }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== suffix) continue;
      const bytes = fs.readFileSync(target);
      documents.push({ relativePath, bytes: bytes.length, sha256: digest(bytes) });
    }
  }
  walk(resolvedRoot);
  documents.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return {
    schema: 'axm.mirror.workshop-inventory/v1',
    root: resolvedRoot,
    extension: suffix,
    files: documents.length,
    bytes: documents.reduce((sum, item) => sum + item.bytes, 0),
    digest: digest(JSON.stringify(documents)),
    refusedSymbolicLinks: refusedSymbolicLinks.sort()
  };
}

function run() {
  const workshopRoot = WorkshopRoot.resolve({ configRoot: path.resolve(__dirname, '..') });
  const observation = WorkshopRoot.inspect({ workshopRoot });
  if (!observation.available) throw new Error(`WORKSHOP_ABSENT: ${observation.reason}`);
  const result = {
    schema: 'axm.mirror.workshop-inventory-set/v1',
    workshopRootResolution: observation,
    inventories: [
      measure(workshopRoot, 'js'),
      measure(workshopRoot, 'json'),
      measure(path.join(workshopRoot, 'shared'), 'js'),
      measure(path.join(workshopRoot, 'shared'), 'json')
    ]
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  try { run(); } catch (error) { console.error(String(error.message || error)); process.exitCode = 1; }
}

module.exports = { digest, measure, run };
