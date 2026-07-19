'use strict';

const fs = require('fs');
const path = require('path');
const Skill = require('../adapters/workshop/human-discovery-skill');

const ROOT = path.resolve(__dirname, '..');
const inputFile = process.argv[2] && path.resolve(process.argv[2]);
if (!inputFile || !fs.existsSync(inputFile)) {
  console.error('Usage: node scripts/run-human-discovery-skill.js <explicit-review-request.json>');
  process.exit(2);
}
try {
  const result = Skill.run(JSON.parse(fs.readFileSync(inputFile, 'utf8')));
  const sessionId = result.bundle.session.id.replace(/[^a-zA-Z0-9._-]/g, '-');
  const outDir = path.join(ROOT, 'state', 'human-discovery');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${sessionId}.json`);
  if (fs.existsSync(out)) throw new Error('review result already exists; skill never silently overwrites a prior view');
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`ADVISORY review saved: ${out}`);
  console.log('No native seam, permission, runtime, learning, or canon state changed.');
} catch (error) {
  console.error(`REFUSED: ${error.message}`);
  process.exit(1);
}
