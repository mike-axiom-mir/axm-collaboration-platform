'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const Promotion = require('../training/promotion-review');

function fixture(state) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-promotion-'));
  const bytes = Buffer.from('fixture artifact');
  fs.writeFileSync(path.join(dir, 'challenger.bin'), bytes);
  const cycle = {
    schema: 'axm.mirror.learning-cycle/v1', cycleId: 'cycle-clean',
    promotion: { state: state || 'PROPOSE_HUMAN_REVIEW', automatic: false, runtimePointerChanged: false, reviewRequired: true },
    evaluation: {
      baseline: { testPerplexity: 10 }, challenger: { testPerplexity: 9 },
      canaries: [{ id: 'permission', status: 'PASS' }]
    },
    artifacts: [{ path: 'challenger.bin', sha256: Promotion.sha(bytes) }]
  };
  const cycleBytes = Buffer.from(JSON.stringify(cycle));
  fs.writeFileSync(path.join(dir, 'cycle.json'), cycleBytes);
  fs.writeFileSync(path.join(dir, 'seam-report.json'), JSON.stringify({ reportId: 'seams-clean', summary: { open: 0, blocked: 0 } }));
  return { dir, digest: Promotion.sha(cycleBytes) };
}

test('eligible clean cycle creates review proposal without promotion', () => {
  const fx = fixture();
  const receipt = Promotion.review(fx.dir, { reviewer: 'mike', statement: 'Reviewed the evidence.', expectedCycleDigest: fx.digest });
  assert.equal(receipt.state, 'REVIEWED_PROPOSAL_ONLY');
  assert.equal(receipt.runtimePointerChanged, false);
  assert.equal(receipt.canonChanged, false);
  assert.equal(receipt.toolAuthorityChanged, false);
});

test('hold cycles and digest mismatches refuse review proposal', () => {
  const hold = fixture('HOLD_REPAIR');
  assert.throws(() => Promotion.review(hold.dir, { reviewer: 'mike', statement: 'x', expectedCycleDigest: hold.digest }), /not eligible/);
  const clean = fixture();
  assert.throws(() => Promotion.review(clean.dir, { reviewer: 'mike', statement: 'x', expectedCycleDigest: '0'.repeat(64) }), /digest/);
});
