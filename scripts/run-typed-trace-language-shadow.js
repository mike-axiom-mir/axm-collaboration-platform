'use strict';

const fs = require('fs');
const path = require('path');
const Organ = require('../organs/typed-trace-language-organ');

const ROOT = path.resolve(__dirname, '..');
const MODEL_PATH = path.join(ROOT, 'learned', 'language-trace-1', 'surface-plan-model.json');
const MAX_TRACE_BYTES = 2 * 1024 * 1024;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const supplied = argument('--trace');
  if (!supplied) throw new Error('usage: node scripts/run-typed-trace-language-shadow.js --trace <trace.json>');
  const tracePath = path.resolve(process.cwd(), supplied);
  const stat = fs.statSync(tracePath);
  if (!stat.isFile() || stat.size > MAX_TRACE_BYTES) throw new Error('trace must be one bounded JSON file at most 2 MiB');
  const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  const model = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  const response = Organ.render(trace, model);
  process.stdout.write(JSON.stringify(response, null, 2) + '\n');
}

if (require.main === module) main();
module.exports = { ROOT, MODEL_PATH, MAX_TRACE_BYTES, main };
