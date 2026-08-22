#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const ReviewService = require('../../../shared/operations/review-service');
const V29 = require('../../../shared/model-shadow-retention-audit-review-request/model-shadow-retention-audit-review-request');
const Fixture = require('../../../shared/model-shadow-retention-audit-review-request/selftest-fixture');

const ROOT = path.resolve(__dirname, '../../..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-review-view-visual-'));
let closed = false;
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function removeTemp() {
  if (closed) return;
  closed = true;
  const resolved = path.resolve(tempRoot), parent = path.resolve(os.tmpdir());
  if (!resolved.startsWith(parent + path.sep) || !path.basename(resolved).startsWith('axm-review-view-visual-')) throw new Error('visual harness cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}

const fixture = Fixture.build(tempRoot, 'visual');
const request = V29.buildReviewRequest(Fixture.requestInput(fixture, { requestId: 'v30-review-view:visual-exact' }));
const stateRoot = path.join(tempRoot, 'review-state'); fs.mkdirSync(stateRoot);
const service = ReviewService.create({ stateRoot });
const exact = service.submit(copy(request.reviewCandidate));
exact.title = 'Exact held retention audit';
const mismatch = copy(exact);
mismatch.id = exact.id + '-mismatch';
mismatch.title = 'Digest-mismatched held audit';
mismatch.summary = 'Synthetic counterevidence: the Review Inbox item digest does not match its embedded artifact.';
mismatch.artifactDigest = '0'.repeat(64);
const generic = {
  schema: 'axm.review-item/v1',
  id: exact.id + '-generic',
  kind: 'proposal',
  title: 'Generic exact-digest proposal',
  sourceRef: 'visual-harness:generic',
  artifactDigest: '1'.repeat(64),
  summary: 'Generic item used to verify that the typed held-audit view does not take over unrelated reviews.',
  requiredSeats: 1,
  action: { type: 'inspect-generic-proposal', automaticApply: false },
  state: 'PENDING',
  votes: [],
  discussion: [],
  createdAt: exact.createdAt,
  updatedAt: exact.updatedAt,
  expiresAt: null
};
const items = [exact, mismatch, generic];

const files = {
  '/tools/review-inbox/index.html': ['tools/review-inbox/index.html', 'text/html; charset=utf-8'],
  '/tools/review-inbox/app.js': ['tools/review-inbox/app.js', 'application/javascript; charset=utf-8'],
  '/tools/review-inbox/review-inbox.css': ['tools/review-inbox/review-inbox.css', 'text/css; charset=utf-8'],
  '/tools/review-inbox/retention-audit-review-view.js': ['tools/review-inbox/retention-audit-review-view.js', 'application/javascript; charset=utf-8'],
  '/tools/deterministic-json-core/index.js': ['tools/deterministic-json-core/index.js', 'application/javascript; charset=utf-8'],
  '/shared/operations/operations-client.js': ['shared/operations/operations-client.js', 'application/javascript; charset=utf-8'],
  '/shared/operations/operations-ui.css': ['shared/operations/operations-ui.css', 'text/css; charset=utf-8']
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') {
    res.writeHead(302, { location: '/tools/review-inbox/index.html' }); res.end(); return;
  }
  if (url.pathname === '/api/reviews' && req.method === 'GET') {
    const state = url.searchParams.get('state');
    const visible = state ? items.filter(item => item.state === state) : items;
    const body = JSON.stringify({ ok: true, result: {
      items: visible,
      summary: { total: visible.length, byState: visible.reduce((all, item) => { all[item.state] = (all[item.state] || 0) + 1; return all; }, {}) },
      structuralReview: { state: 'CURRENT', summary: { contractsValid: 0, topLevelSelftests: 0, legacyKinds: 0 }, reviewCandidates: [] }
    } });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(body); return;
  }
  if (url.pathname.startsWith('/api/') && req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'visual harness is read only' })); return;
  }
  const mapped = files[url.pathname];
  if (!mapped) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': mapped[1], 'cache-control': 'no-store' });
  fs.createReadStream(path.join(ROOT, mapped[0])).pipe(res);
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  process.stdout.write('HARNESS http://127.0.0.1:' + address.port + '/tools/review-inbox/index.html\n');
});
function shutdown() { server.close(() => { removeTemp(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => { if (!closed) removeTemp(); });
