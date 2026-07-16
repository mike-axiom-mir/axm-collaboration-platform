'use strict';

const fs = require('fs');
const path = require('path');
const { normalize } = require('../training/teacher-artifact');

const ROOT = path.resolve(__dirname, '..');
const inputFile = process.argv[2] && path.resolve(process.argv[2]);
if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Usage: node scripts/intake-teacher-artifact.js <reviewable-artifact.json>');
  process.exit(2);
}
try {
  const artifact = normalize(JSON.parse(fs.readFileSync(inputFile, 'utf8')));
  const outDir = path.join(ROOT, 'training', 'candidates');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, artifact.artifactId.replace(/[^a-zA-Z0-9._-]/g, '-') + '.json');
  if (fs.existsSync(out)) throw new Error('candidate artifact already exists; intake never silently overwrites lineage');
  fs.writeFileSync(out, JSON.stringify(artifact, null, 2) + '\n', 'utf8');
  console.log(`CANDIDATE saved: ${out}`);
  console.log('No training or canon promotion occurred.');
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exit(1);
}
