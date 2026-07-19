'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clean(value, max) { return String(value == null ? '' : value).trim().slice(0, max || 1000); }

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function review(runDir, input) {
  runDir = path.resolve(runDir);
  input = input || {};
  const cycleFile = path.join(runDir, 'cycle.json');
  const seamFile = path.join(runDir, 'seam-report.json');
  if (!fs.existsSync(cycleFile) || !fs.existsSync(seamFile)) throw new Error('promotion review requires a complete cycle and seam report');
  const cycleBytes = fs.readFileSync(cycleFile);
  const cycle = JSON.parse(cycleBytes.toString('utf8'));
  const seamReport = JSON.parse(fs.readFileSync(seamFile, 'utf8'));
  const reviewer = clean(input.reviewer, 120);
  const statement = clean(input.statement, 1000);
  const expectedCycleDigest = clean(input.expectedCycleDigest, 64);
  if (!reviewer || !statement || !expectedCycleDigest) throw new Error('review requires reviewer, statement, and expectedCycleDigest');
  if (sha(cycleBytes) !== expectedCycleDigest) throw new Error('cycle digest does not match the reviewed bytes');
  if (cycle.promotion.state !== 'PROPOSE_HUMAN_REVIEW') throw new Error(`cycle is not eligible for review proposal: ${cycle.promotion.state}`);
  if (seamReport.summary.open !== 0 || seamReport.summary.blocked !== 0) throw new Error('open or blocked seams refuse a promotion proposal');
  if (cycle.promotion.automatic !== false || cycle.promotion.runtimePointerChanged !== false || cycle.promotion.reviewRequired !== true) throw new Error('promotion boundary contract is not intact');
  if (!cycle.evaluation.canaries.every(canary => canary.status === 'PASS')) throw new Error('failed behavioral canary refuses a promotion proposal');
  if (!(Number(cycle.evaluation.challenger.testPerplexity) < Number(cycle.evaluation.baseline.testPerplexity))) throw new Error('challenger did not beat the frozen baseline');
  for (const artifact of cycle.artifacts) {
    const file = path.resolve(runDir, artifact.path);
    if (!inside(runDir, file) || !fs.existsSync(file)) throw new Error(`artifact path is missing or escapes the cycle: ${artifact.path}`);
    if (sha(fs.readFileSync(file)) !== artifact.sha256) throw new Error(`artifact hash mismatch: ${artifact.path}`);
  }
  const receipt = {
    schema: 'axm.mirror.promotion-proposal-receipt/v1',
    cycleId: cycle.cycleId,
    cycleSha256: expectedCycleDigest,
    seamReportId: seamReport.reportId,
    reviewer,
    reviewedAt: clean(input.reviewedAt, 80) || null,
    statement,
    state: 'REVIEWED_PROPOSAL_ONLY',
    runtimePointerChanged: false,
    canonChanged: false,
    toolAuthorityChanged: false,
    nextGate: 'A separate future promotion implementation and explicit authority decision would still be required.',
    boundary: 'This receipt reviews a proposal. It does not load weights or alter Mirror.'
  };
  receipt.sha256 = sha(Buffer.from(JSON.stringify(receipt), 'utf8'));
  return receipt;
}

module.exports = { review, sha };
