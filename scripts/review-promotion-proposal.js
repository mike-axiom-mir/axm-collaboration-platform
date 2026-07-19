'use strict';

const fs = require('fs');
const path = require('path');
const Promotion = require('../training/promotion-review');

const ROOT = path.resolve(__dirname, '..');
const [runArg, reviewer, expectedCycleDigest, ...statementParts] = process.argv.slice(2);
const runDir = runArg && path.resolve(runArg);
const statement = statementParts.join(' ').trim();
if (!runDir || !reviewer || !expectedCycleDigest || !statement) {
  console.error('Usage: node scripts/review-promotion-proposal.js <cycle-directory> <reviewer> <cycle-sha256> <review-statement>');
  process.exit(2);
}
try {
  const receipt = Promotion.review(runDir, { reviewer, expectedCycleDigest, statement, reviewedAt: new Date().toISOString() });
  const outDir = path.join(ROOT, 'state', 'promotion-reviews');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${receipt.cycleId}.json`);
  if (fs.existsSync(out)) throw new Error('promotion review already exists; review never silently overwrites lineage');
  fs.writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
  console.log(`REVIEWED PROPOSAL receipt saved: ${out}`);
  console.log('No weights loaded. Runtime, canon, permissions, and tool authority remain unchanged.');
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exit(1);
}
