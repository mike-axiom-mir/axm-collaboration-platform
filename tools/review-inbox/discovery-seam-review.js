#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const api = read('shared/operations/operations-api.js');
const observer = read('shared/readiness/readiness-observer.js');
const observerTest = read('shared/readiness/readiness-observer-selftest.js');
const service = read('shared/operations/review-service.js');
const app = read('tools/review-inbox/app.js');
const html = read('tools/review-inbox/index.html');
const contract = JSON.parse(read('tools/review-inbox/module.contract.json'));
const structuralFunction = app.slice(app.indexOf('function renderStructural'), app.indexOf('function select'));

const checks = [
  ['GET /api/reviews includes a fresh shared structural observation', api.includes('structuralReview: readinessObserver.snapshot()') && api.includes("require('../readiness/readiness-observer')")],
  ['Structural candidates carry module and exact evidence routes', observer.includes('moduleRoute:') && observer.includes('evidencePaths:')],
  ['Observer proves current, stale, invalid and unavailable states', observerTest.includes("assert.equal(current.state, 'CURRENT')") && observerTest.includes("'STALE'") && observerTest.includes("'INVALID'") && observerTest.includes("'UNAVAILABLE'")],
  ['Non-current structural evidence produces no candidate cards', structuralFunction.includes("view.state !== 'CURRENT'") && structuralFunction.includes('No module is shown as ready for inspection')],
  ['Structural rendering has no mutation or vote call', !structuralFunction.includes('O.post') && !structuralFunction.includes('/api/reviews/vote')],
  ['Exact-digest voting remains separately confirmed', api.includes("parsed.confirmation !== 'REVIEW EXACT DIGEST'") && app.includes("'x-axm-review': 'exact-digest-vote'")],
  ['Digest mismatch still blocks a vote', service.includes('vote digest does not match the reviewed artifact')],
  ['Approval still has no automatic apply route', contract.boundaries.refuses.includes('automatic-apply') && contract.boundaries.refuses.includes('automatic-promotion')],
  ['Structural evidence cannot impersonate digest approval', contract.boundaries.refuses.includes('structural-candidate-as-digest-approval')],
  ['Structural candidates cannot auto-enter the durable queue', contract.boundaries.refuses.includes('structural-review-auto-queue')],
  ['The two review domains are visibly named', html.includes('STRUCTURAL EVIDENCE · READ ONLY') && html.includes('EXACT-DIGEST DECISION QUEUE')],
  ['Human boundary language is visible', html.includes('not digest approvals, promotions, CANON status, runtime proof, or accepted needs')],
  ['Browser storage does not shadow service truth', !/localStorage|sessionStorage/.test(app)],
  ['Review Inbox remains TEST behind Mike’s gate', JSON.parse(read('tools/review-inbox/manifest.json')).status === 'TEST']
];

let failed = 0;
checks.forEach(([name, pass]) => {
  console.log((pass ? 'PASS  ' : 'OPEN  ') + name);
  if (!pass) failed += 1;
});
console.log('Review Inbox discovery seam review: ' + (failed ? 'OPEN ' + failed : 'PASS - 14 controls'));
if (failed) process.exit(1);
