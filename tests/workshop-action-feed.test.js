'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Feed = require('../training/workshop-action-feed');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-action-feed-'));
  return { root, stateDir: path.join(root, 'state'), episodeDir: path.join(root, 'episodes') };
}

function action(ok = true) {
  return {
    schema: 'axm.action/v1',
    id: ok ? 'action-success-1' : 'action-failure-1',
    name: 'Render bounded preview',
    tool: 'studio',
    operation: 'render-preview',
    inputs: { secretPrompt: 'MUST_NOT_ENTER_CORPUS' },
    proposal: 'MUST_NOT_ENTER_CORPUS_EITHER',
    requestedPermission: 'studio:preview',
    actor: { id: 'codex', kind: 'machine', name: 'Codex' },
    state: ok ? 'COMPLETE' : 'FAILED',
    approval: { decision: 'APPROVED', actor: { id: 'mike', kind: 'human', name: 'Mike' }, reason: 'Bounded local preview.', at: '2026-07-18T00:00:00.000Z' },
    receipt: {
      ok,
      evidence: [{ id: 'preview-check', kind: 'test', status: ok ? 'PASS' : 'FAIL', statement: ok ? 'Preview rendered.' : 'Renderer refused malformed geometry.', sha256: 'a'.repeat(64) }],
      output: { privatePixels: 'MUST_NOT_ENTER_CORPUS_OUTPUT' },
      error: ok ? '' : 'Malformed geometry held for repair.',
      actor: { id: 'studio-renderer', kind: 'service', name: 'Studio renderer' },
      at: '2026-07-18T00:00:01.000Z'
    }
  };
}

test('package default is opted out and stores no disabled action', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  assert.equal(Feed.status(options).enabled, false);
  assert.equal(Feed.status(options).packageDefault, false);
  const result = Feed.ingest(action(true), options);
  assert.equal(result.state, 'OPTED_OUT');
  assert.equal(fs.existsSync(options.episodeDir), false);
});

test('only a human can change local lesson intake', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  assert.throws(() => Feed.configure({ enabled: true, actor: { id: 'service', kind: 'service' } }, options), /human steward/);
  const settings = Feed.configure({ enabled: true, actor: { id: 'mike', kind: 'human', name: 'Mike' } }, options);
  assert.equal(settings.enabled, true);
  assert.equal(settings.packageDefault, false);
});

test('opted-in receipt becomes a reviewed redacted lesson and deduplicates', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  Feed.configure({ enabled: true, actor: { id: 'mike', kind: 'human', name: 'Mike' } }, options);
  const first = Feed.ingest(action(true), options);
  assert.equal(first.state, 'ADMITTED_PRIVATE_LESSON');
  const second = Feed.ingest(action(true), options);
  assert.equal(second.state, 'REUSED_EQUIVALENT_LESSON');
  const file = path.join(options.episodeDir, `${first.episodeId}.json`);
  const text = fs.readFileSync(file, 'utf8');
  const episode = JSON.parse(text);
  assert.equal(episode.review.state, 'APPROVED');
  assert.equal(episode.source.capturedBy, 'workshop-action-lesson-feed');
  assert.equal(text.includes('MUST_NOT_ENTER_CORPUS'), false);
  assert.match(text, /Preview rendered/);
});

test('failed receipts teach a repair boundary instead of fake completion', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  Feed.configure({ enabled: true, actor: { id: 'mike', kind: 'human', name: 'Mike' } }, options);
  const result = Feed.ingest(action(false), options);
  const episode = JSON.parse(fs.readFileSync(path.join(options.episodeDir, `${result.episodeId}.json`), 'utf8'));
  assert.match(episode.decision, /Preserve the failure/);
  assert.match(episode.outcome, /Malformed geometry held for repair/);
  assert.ok(episode.repairs.length > 0);
});

test('unapproved and evidence-free actions are refused', t => {
  const options = fixture();
  t.after(() => fs.rmSync(options.root, { recursive: true, force: true }));
  Feed.configure({ enabled: true, actor: { id: 'mike', kind: 'human', name: 'Mike' } }, options);
  const unapproved = action(true); unapproved.approval.decision = 'REJECTED';
  assert.throws(() => Feed.ingest(unapproved, options), /explicit approval/);
  const noEvidence = action(true); noEvidence.receipt.evidence = [];
  assert.throws(() => Feed.ingest(noEvidence, options), /receipt evidence/);
});
