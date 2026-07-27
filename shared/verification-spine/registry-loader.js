'use strict';

const fs = require('fs');
const path = require('path');

function inside(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  return target === base || target.startsWith(base + path.sep);
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function loadRegistry(root) {
  root = path.resolve(root || __dirname);
  const registryPath = path.join(root, 'registry.json');
  const registry = readJson(registryPath);
  if (registry.schema !== 'axm.verification-registry/v1') throw new Error('verification registry schema mismatch');
  const ids = new Set();
  function loadEntries(entries, expectedSchema, kind) {
    return (entries || []).map(function (entry) {
      if (!entry.id || ids.has(kind + ':' + entry.id)) throw new Error('duplicate or missing ' + kind + ' id');
      ids.add(kind + ':' + entry.id);
      const target = path.resolve(root, entry.path || '');
      if (!inside(root, target)) throw new Error(kind + ' path escapes verification registry: ' + entry.path);
      const value = readJson(target);
      if (value.schema !== expectedSchema) throw new Error(kind + ' schema mismatch: ' + entry.id);
      if (value.id !== entry.id) throw new Error(kind + ' id mismatch: ' + entry.id);
      return value;
    });
  }
  const categories = loadEntries(registry.categories, 'axm.verification-category-pack/v1', 'category');
  const profiles = loadEntries(registry.profiles, 'axm.verification-target-profile/v1', 'profile');
  categories.forEach(function (category) {
    if (!Array.isArray(category.baseline_claims) || !category.baseline_claims.length) throw new Error('category baseline claims missing: ' + category.id);
    const claimIds = new Set();
    category.baseline_claims.forEach(function (claim) {
      if (!claim.id || !claim.need || !claim.evidence) throw new Error('category baseline claim is incomplete: ' + category.id);
      if (claimIds.has(claim.id)) throw new Error('duplicate category baseline claim: ' + claim.id);
      claimIds.add(claim.id);
    });
  });
  return { schema: registry.schema, version: registry.version, categories: categories, profiles: profiles };
}

module.exports = { inside, loadRegistry };
