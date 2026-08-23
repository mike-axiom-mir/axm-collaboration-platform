'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

const root = __dirname;
assert.equal(manifest.id, path.basename(root));
assert.equal(manifest.contract, 'module.contract.json');
assert.equal(contract.id, manifest.id);
assert.equal(contract.version, manifest.version);
assert.deepEqual(contract.permissions, manifest.permissions);
assert(contract.provides.includes('code.recipe.csv-json.ingest/v1'));
assert(contract.provides.includes('code.recipe.intake.receipt/v1'));
assert(contract.provides.includes('code.recipe.catalog.installed/v1'));
assert(contract.provides.includes('code.recipe.review.hold/v1'));
assert(contract.provides.includes('code.recipe.syntax.audit/v1'));
assert(contract.provides.includes('code.recipe.creation-evidence/v1'));
assert(contract.handoffs.emits.includes('axm.code-recipe-pack/v1'));
assert(contract.handoffs.emits.includes('axm.code-recipe-evidence-packet/v1'));
assert(contract.handoffs.accepts.includes('text/csv'));
assert(contract.boundaries.refuses.includes('snippet-execution'));
assert(contract.boundaries.refuses.includes('automatic-library-download'));
assert(contract.boundaries.refuses.includes('automatic-promotion'));
assert(contract.boundaries.refuses.includes('review-hold-clipboard-copy'));
assert(contract.boundaries.refuses.includes('syntax-pass-as-runtime-proof'));
assert(contract.boundaries.refuses.includes('snippet-byte-copy-into-evidence-packet'));
assert(contract.boundaries.refuses.includes('recipe-as-capability-proof'));
assert(contract.boundaries.refuses.includes('recipe-as-provider-proof'));
assert(contract.boundaries.refuses.includes('provider-authority-grant'));
['index.html', 'styles.css', 'app.js', 'recipe-core.js', 'bundle-ingest.js', 'syntax-audit.js', 'selftest.js', 'README.md', 'WORKSHOP_INTAKE_RECEIPT.md', 'CREATION_FABRIC_SEAM.md', 'creation-fabric-bridge.js', 'creation-fabric-bridge-selftest.js', 'design/capability-gap-report-recovered.json', 'design/capability-gap-report-integrations.json', 'catalog/code-cheats-1000.code-recipes.json', 'catalog/code-cheats-1000.intake-receipt.json', 'catalog/code-cheats-1000.syntax-audit.json', 'catalog/SOURCE_README.md', 'catalog/source-quality-report.json'].forEach(file => {
  assert(fs.existsSync(path.join(root, file)), file + ' missing');
});
console.log('Code Recipe Foundry discovery seam: PASS');
