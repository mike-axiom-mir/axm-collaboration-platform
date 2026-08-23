'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRuntime, CONTENT_FILE } = require('../runtime/server');

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-four-roots-restart-'));
const alteredContent = path.join(dataRoot, 'altered-content.json');
try {
  const first = createRuntime({ dataRoot });
  let view = first.view();
  view = first.apply({ action: 'move', direction: 'up', expectedRevision: view.revision });
  view = first.apply({ action: 'interact', expectedRevision: view.revision });
  const savedRevision = view.revision;
  const savedMessage = view.message;
  assert.strictEqual(view.progress.quests[0].complete, true);
  assert.ok(fs.existsSync(first.stateFile));
  assert.strictEqual(fs.readdirSync(path.dirname(first.stateFile)).filter((name) => name.endsWith('.tmp')).length, 0, 'atomic save must leave no temp file');

  const restarted = createRuntime({ dataRoot });
  view = restarted.view();
  assert.strictEqual(view.revision, savedRevision);
  assert.strictEqual(view.message, savedMessage);
  assert.strictEqual(view.player.y, 4);
  assert.strictEqual(view.progress.quests[0].complete, true);
  assert.strictEqual(restarted.contentDigest, first.contentDigest);

  assert.throws(() => restarted.apply({ action: 'move', direction: 'left', expectedRevision: 0 }), /stale revision/);
  view = restarted.reset({ confirm: true, expectedRevision: view.revision });
  assert.strictEqual(view.revision, savedRevision + 1);
  assert.strictEqual(view.progress.quests[0].complete, false);
  assert.strictEqual(view.progress.moves, 0);

  const resetRestart = createRuntime({ dataRoot });
  assert.strictEqual(resetRestart.view().revision, savedRevision + 1);
  assert.strictEqual(resetRestart.view().progress.moves, 0);

  const changed = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  changed.tagline += ' Altered only for the restart lineage countertest.';
  fs.writeFileSync(alteredContent, JSON.stringify(changed, null, 2) + '\n');
  const drifted = createRuntime({ dataRoot, contentFile: alteredContent });
  assert.strictEqual(drifted.view().revision, 0, 'content digest drift must not inherit an incompatible save');
  assert.match(drifted.view().message, /different content/);
  assert.notStrictEqual(drifted.contentDigest, first.contentDigest);

  fs.writeFileSync(first.stateFile, '{not-json');
  const corrupt = createRuntime({ dataRoot });
  assert.strictEqual(corrupt.view().revision, 0);
  assert.match(corrupt.view().message, /unreadable/);

  console.log('PASS Four Roots Adventure restart persistence (20 assertions)');
} finally {
  fs.rmSync(dataRoot, { recursive: true, force: true });
}
