'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('../../shared/design-lineage/design-lineage-core.js');
const { validateContract } = require('../../hub/module-contract-verifier.js');

const digestA = 'a'.repeat(64);
const recordA = {
  source: { ref: 'chat-a#icon', digest: digestA, type: 'chat-extract' }, subject: 'revive icon', kind: 'lesson', decision: 'accepted', criterion: 'readability', observation: 'Silhouette A reads at 24 px.', reasons: ['distinct outer shape'], rules: [{ statement: 'Prefer distinct silhouettes at small sizes.', polarity: 'prefer', scope: 'game-ui/icons' }]
};
const bundle = {
  schema: Core.BUNDLE_SCHEMA,
  source_bundle_ref: 'test-bundle',
  records: [
    recordA,
    JSON.parse(JSON.stringify(recordA)),
    { ...recordA, source: { ref: 'chat-b#icon', digest: 'b'.repeat(64), type: 'chat-extract' } },
    { ...recordA, source: { ref: 'chat-c#icon', type: 'chat-extract' }, decision: 'rejected', observation: 'The same candidate failed when reduced below 16 px.', reasons: ['inner detail collapsed'], rules: [{ statement: 'Avoid inner-detail-only differences below 16 px.', polarity: 'avoid', scope: 'game-ui/icons' }] }
  ]
};

(async () => {
  const first = await Core.compileBundle(bundle);
  const second = await Core.compileBundle(bundle);
  assert.equal(first.id, second.id, 'same evidence compiles to the same ledger id');
  assert.equal(first.stats.submitted, 4);
  assert.equal(first.stats.admitted, 3, 'one exact evidence duplicate is removed');
  assert.equal(first.stats.exact_duplicates, 1);
  assert.equal(first.stats.repeated_lesson_groups, 1, 'same exact lesson from a second source stays visible');
  assert.equal(first.stats.conflicts, 1, 'accepted and rejected evidence is not silently merged');
  assert.equal(first.stats.exact_provenance, 2);
  assert.equal(first.stats.partial_provenance, 1);
  assert.equal(first.stats.vocabulary_candidates, 2);
  assert.ok(first.vocabulary_candidates.every(candidate => candidate.status === 'REVIEW_REQUIRED'));
  const raw = await Core.compileBundle({ schema: Core.BUNDLE_SCHEMA, records: [{ ...recordA, image_data: 'AAAA' }] });
  assert.equal(raw.stats.invalid, 1, 'raw media payloads are refused');
  assert.equal(raw.stats.admitted, 0);

  const dir = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(dir, 'module.contract.json'), 'utf8'));
  const checked = validateContract(contract, manifest);
  assert.equal(checked.pass, true, checked.errors.join('; '));
  assert.ok(contract.boundaries.refuses.includes('automatic-design-vocabulary-promotion'));
  assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('Design Lineage Lab'));
  console.log('design lineage lab self-test passed · 16 assertions');
})().catch(error => { console.error(error); process.exitCode = 1; });

