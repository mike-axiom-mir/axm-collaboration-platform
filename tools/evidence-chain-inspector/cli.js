#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./evidence-chain-core');

function usage() {
  return [
    'AXM Evidence Chain Inspector',
    '  node cli.js --stdin',
    '  node cli.js --file <explicit-segment.jsonl>',
    '',
    'The CLI reads exactly one explicit input and writes only the digest-only JSON receipt to stdout.'
  ].join('\n');
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    process.stdin.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > Core.MAX_BYTES) {
        reject(new Error('stdin exceeds the 10 MiB inspection limit'));
        process.stdin.destroy();
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', reject);
  });
}

async function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(usage() + '\n');
    return 0;
  }
  const fileIndex = argv.indexOf('--file');
  const stdinMode = argv.includes('--stdin');
  if ((fileIndex >= 0) === stdinMode) throw new Error('choose exactly one input mode: --file or --stdin');
  let source;
  let label;
  if (fileIndex >= 0) {
    const supplied = argv[fileIndex + 1];
    if (!supplied || supplied.startsWith('--')) throw new Error('--file requires an explicit path');
    const absolute = path.resolve(supplied);
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) throw new Error('--file target must be a regular file');
    if (stat.size > Core.MAX_BYTES) throw new Error('file exceeds the 10 MiB inspection limit');
    source = fs.readFileSync(absolute, 'utf8');
    label = 'explicit-file';
  } else {
    source = await readStdin();
    label = 'stdin';
  }
  const report = await Core.inspect(source, { label });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  return report.verdict === 'PASS' ? 0 : (report.verdict === 'FAIL' ? 2 : 3);
}

main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
  process.stderr.write('Evidence Chain Inspector refused: ' + error.message + '\n');
  process.exitCode = 1;
});
