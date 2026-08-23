'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Adapter = require('./creation-fabric-bridge');

const packPath = path.join(__dirname, 'catalog', 'code-cheats-1000.code-recipes.json');
const auditPath = path.join(__dirname, 'catalog', 'code-cheats-1000.syntax-audit.json');
assert(fs.existsSync(packPath), 'installed 1,000-recipe pack missing');

const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const audit = fs.existsSync(auditPath) ? JSON.parse(fs.readFileSync(auditPath, 'utf8')) : null;
assert.equal(pack.schema, 'axm.code-recipe-pack/v1');
assert.equal(pack.recipes.length, 1000);
assert.equal(Adapter.authority, 'NONE');

const probe = pack.recipes[0];
assert(probe && probe.title, 'deterministic probe recipe missing title');
const packet = Adapter.buildCreationEvidence(pack, {terms: probe.title, maxResults: 4}, {
  syntaxAudit: audit,
  generatedAt: '2026-08-23T10:00:00Z'
});

assert.equal(packet.schema, 'axm.code-recipe-evidence-packet/v1');
assert.equal(packet.summary.recipesScanned, 1000);
assert(packet.summary.eligibleMatches + packet.summary.heldMatches >= 1, 'probe produced no visible evidence');
assert.equal(packet.boundaries.snippetBytesIncluded, false);
assert.equal(packet.boundaries.snippetsExecuted, false);
assert.equal(packet.boundaries.recipeIsCapability, false);
assert.equal(packet.boundaries.recipeIsProvider, false);
assert.equal(packet.boundaries.automaticPromotion, false);
assert(Adapter.verifyCreationEvidence(packet).pass, 'packet digest failed verification');

const serialized = JSON.stringify(packet);
for (const row of packet.candidates.concat(packet.heldMatches)) {
  assert.equal(row.recipe.snippetRef.bytesIncluded, false);
}
assert(!serialized.includes(String(probe.snippet)), 'probe snippet bytes leaked into evidence packet');

console.log('Code Recipe Foundry creation-fabric bridge: PASS');
