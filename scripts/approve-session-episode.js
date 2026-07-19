'use strict';

const fs = require('fs');
const path = require('path');
const Episode = require('../training/session-episode');

const ROOT = path.resolve(__dirname, '..');
const [inputArg, reviewer, expectedDigest, ...statementParts] = process.argv.slice(2);
const inputFile = inputArg && path.resolve(inputArg);
const statement = statementParts.join(' ').trim();
if (!inputFile || !fs.existsSync(inputFile) || !reviewer || !expectedDigest || !statement) {
  console.error('Usage: node scripts/approve-session-episode.js <candidate.json> <reviewer> <expected-digest> <review-statement>');
  process.exit(2);
}
try {
  const candidate = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const approved = Episode.approve(candidate, { reviewer, expectedDigest, statement, reviewedAt: new Date().toISOString() });
  const outDir = path.join(ROOT, 'training', 'datasets', 'episodes');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, approved.episodeId.replace(/[^a-zA-Z0-9._-]/g, '-') + '.json');
  if (fs.existsSync(out)) throw new Error('approved episode already exists; approval never silently overwrites lineage');
  fs.writeFileSync(out, JSON.stringify(approved, null, 2) + '\n', 'utf8');
  console.log(`APPROVED episode saved: ${out}`);
  console.log('Approval allows future cycle intake only; runtime and canon remain unchanged.');
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exit(1);
}
