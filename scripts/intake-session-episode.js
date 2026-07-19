'use strict';

const fs = require('fs');
const path = require('path');
const Episode = require('../training/session-episode');

const ROOT = path.resolve(__dirname, '..');
const inputFile = process.argv[2] && path.resolve(process.argv[2]);
if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Usage: node scripts/intake-session-episode.js <reviewable-session.json>');
  process.exit(2);
}
try {
  const episode = Episode.normalize(JSON.parse(fs.readFileSync(inputFile, 'utf8')));
  const outDir = path.join(ROOT, 'training', 'candidates', 'episodes');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, episode.episodeId.replace(/[^a-zA-Z0-9._-]/g, '-') + '.json');
  if (fs.existsSync(out)) throw new Error('candidate episode already exists; intake never silently overwrites lineage');
  fs.writeFileSync(out, JSON.stringify(episode, null, 2) + '\n', 'utf8');
  console.log(`CANDIDATE saved: ${out}`);
  console.log(`Review digest: ${episode.digest}`);
  console.log('No training or promotion occurred.');
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exit(1);
}
