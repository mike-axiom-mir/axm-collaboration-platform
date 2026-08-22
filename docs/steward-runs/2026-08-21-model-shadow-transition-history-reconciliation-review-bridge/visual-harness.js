#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const ReviewService = require('../../../shared/operations/review-service');
const Bridge = require('../../../shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request/model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-request');
const V39 = require('../../../shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer');
const V39Fixture = require('../../../shared/model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observer/selftest-fixture');
const V29 = require('../../../shared/model-shadow-retention-audit-review-request/model-shadow-retention-audit-review-request');
const V29Fixture = require('../../../shared/model-shadow-retention-audit-review-request/selftest-fixture');

const ROOT = path.resolve(__dirname, '../../..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v40-review-view-visual-'));
let closed = false;
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function removeTemp() {
  if (closed) return;
  closed = true;
  const resolved = path.resolve(tempRoot), parent = path.resolve(os.tmpdir());
  if (!resolved.startsWith(parent + path.sep) || !path.basename(resolved).startsWith('axm-v40-review-view-visual-')) throw new Error('visual harness cleanup boundary refused');
  fs.rmSync(resolved, { recursive:true, force:true });
}

const v39Root = path.join(tempRoot, 'v39'); fs.mkdirSync(v39Root);
const scenario = V39Fixture.buildScenario(v39Root);
const left = V39Fixture.startLane(v39Root, 'visual-left', scenario.sourceAOptions, 'v40-visual-left');
const right = V39Fixture.startLane(v39Root, 'visual-right', scenario.sourceBOptions, 'v40-visual-right');
V39Fixture.appendExact(left, scenario.entryAInput, scenario.entryA, 'visual-left');
V39Fixture.appendExact(right, scenario.entryBInput, scenario.entryB, 'visual-right');
const latestAt = Date.parse(left.latestAt) > Date.parse(right.latestAt) ? left.latestAt : right.latestAt;
const observationInput = V39Fixture.pairInput(left.serviceOptions, right.serviceOptions, 'visual-divergence', latestAt);
const observationReceipt = V39.buildObservation(copy(observationInput));
const reconciliationRequest = Bridge.buildReviewRequest({
  requestId:'v40-history-reconciliation-review:visual-exact',
  generatedAt:V39Fixture.add(observationReceipt.observedAt, 1000),
  requiredSeats:2,
  observationInput:copy(observationInput),
  observationReceipt:copy(observationReceipt)
});
const stateRoot = path.join(tempRoot, 'review-state'); fs.mkdirSync(stateRoot);
const service = ReviewService.create({ stateRoot });
const exact = service.submit(copy(reconciliationRequest.reviewCandidate));
exact.title = 'Exact transition-history divergence';
const mismatch = copy(exact);
mismatch.id = exact.id + '-mismatch';
mismatch.title = 'Digest-mismatched transition-history divergence';
mismatch.summary = 'Synthetic counterevidence: the Review Inbox item digest does not match its embedded v4.0 artifact.';
mismatch.artifactDigest = '0'.repeat(64);

const v29Root = path.join(tempRoot, 'v29'); fs.mkdirSync(v29Root);
const v29Fixture = V29Fixture.build(v29Root, 'visual-regression');
const v29Request = V29.buildReviewRequest(V29Fixture.requestInput(v29Fixture, { requestId:'v40-history-reconciliation-review:visual-v29-regression' }));
const heldAudit = service.submit(copy(v29Request.reviewCandidate));
heldAudit.title = 'Existing held retention-audit view';
const generic = {
  schema:'axm.review-item/v1', id:exact.id + '-generic', kind:'proposal', title:'Generic exact-digest proposal',
  sourceRef:'visual-harness:generic', artifactDigest:'1'.repeat(64),
  summary:'Generic item used to verify that neither typed view takes over unrelated reviews.', requiredSeats:1,
  action:{ type:'inspect-generic-proposal', automaticApply:false }, state:'PENDING', votes:[], discussion:[],
  createdAt:exact.createdAt, updatedAt:exact.updatedAt, expiresAt:null
};
const items = [exact, mismatch, heldAudit, generic];

const files = {
  '/tools/review-inbox/index.html':['tools/review-inbox/index.html','text/html; charset=utf-8'],
  '/tools/review-inbox/app.js':['tools/review-inbox/app.js','application/javascript; charset=utf-8'],
  '/tools/review-inbox/review-inbox.css':['tools/review-inbox/review-inbox.css','text/css; charset=utf-8'],
  '/tools/review-inbox/retention-audit-review-view.js':['tools/review-inbox/retention-audit-review-view.js','application/javascript; charset=utf-8'],
  '/tools/review-inbox/history-reconciliation-review-view.js':['tools/review-inbox/history-reconciliation-review-view.js','application/javascript; charset=utf-8'],
  '/tools/deterministic-json-core/index.js':['tools/deterministic-json-core/index.js','application/javascript; charset=utf-8'],
  '/shared/operations/operations-client.js':['shared/operations/operations-client.js','application/javascript; charset=utf-8'],
  '/shared/operations/operations-ui.css':['shared/operations/operations-ui.css','text/css; charset=utf-8']
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') { res.writeHead(302, { location:'/tools/review-inbox/index.html' }); res.end(); return; }
  if (url.pathname === '/api/reviews' && req.method === 'GET') {
    const state = url.searchParams.get('state');
    const visible = state ? items.filter(item => item.state === state) : items;
    const result = {
      items:visible,
      summary:{ total:visible.length, byState:visible.reduce((all, item) => { all[item.state] = (all[item.state] || 0) + 1; return all; }, {}) },
      structuralReview:{ state:'CURRENT', summary:{ contractsValid:0, topLevelSelftests:0, legacyKinds:0 }, reviewCandidates:[] }
    };
    res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' });
    res.end(JSON.stringify({ ok:true, result })); return;
  }
  if (url.pathname.startsWith('/api/') && req.method !== 'GET') {
    res.writeHead(405, { 'content-type':'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok:false, error:'visual harness is read only' })); return;
  }
  const mapped = files[url.pathname];
  if (!mapped) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type':mapped[1], 'cache-control':'no-store' });
  fs.createReadStream(path.join(ROOT, mapped[0])).pipe(res);
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write('HARNESS http://127.0.0.1:' + server.address().port + '/tools/review-inbox/index.html\n');
});
function shutdown() { server.close(() => { removeTemp(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => { if (!closed) removeTemp(); });
