'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./schema-registry-core');

const OUTPUT = 'registry/generated/city-schemas.json';

function inside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function load(repositoryRoot) {
  repositoryRoot = fs.realpathSync(path.resolve(repositoryRoot));
  const graphPath = path.join(repositoryRoot, 'registry', 'generated', 'city-graph.json');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const entries = [];
  for (const descriptor of graph.schemas || []) {
    const file = path.resolve(repositoryRoot, descriptor.path);
    if (!inside(repositoryRoot, file)) throw new Core.SchemaRegistryError('SCHEMA_PATH_ESCAPE', `Schema path escapes repository: ${descriptor.path}`);
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    entries.push({ id: descriptor.id, path: descriptor.path, sha256: descriptor.sha256, value });
  }
  const unresolvedSockets = (graph.unresolved || []).filter(row => row.code === 'UNRESOLVED_SCHEMA').map(row => `${row.blockId}:${row.socket}`);
  return Core.compile({ graphDigest: graph.semanticDigest, entries, adapters: [], unresolvedSockets });
}

function render(registry) {
  return JSON.stringify(registry, null, 2) + '\n';
}

function check(repositoryRoot) {
  const registry = load(repositoryRoot);
  const target = path.join(repositoryRoot, OUTPUT);
  const expected = render(registry);
  const actual = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  return { state: actual === expected ? 'PASS' : 'FAIL', code: actual === null ? 'SCHEMA_REGISTRY_MISSING' : actual === expected ? null : 'SCHEMA_REGISTRY_DRIFT', registry };
}

function write(repositoryRoot) {
  repositoryRoot = fs.realpathSync(path.resolve(repositoryRoot));
  const registry = load(repositoryRoot);
  const target = path.join(repositoryRoot, OUTPUT);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, render(registry), { flag: 'wx' });
  fs.renameSync(temporary, target);
  return registry;
}

module.exports = { OUTPUT, inside, load, render, check, write };
