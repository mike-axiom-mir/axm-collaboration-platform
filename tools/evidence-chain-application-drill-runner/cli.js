#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');
const Runner = require('./sandbox-drill-executor');

function usage() {
  return 'Usage: node cli.js --source FILE --candidate FILE --plan FILE --sandbox-root NEW_ABSOLUTE_ROOT --confirm PLAN_ID --sandbox-only --cleanup';
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--sandbox-only' || item === '--cleanup' || item === '--help') { options[item.slice(2)] = true; continue; }
    if (!['--source', '--candidate', '--plan', '--sandbox-root', '--confirm'].includes(item)) throw new Error('unsupported CLI argument');
    if (index + 1 >= argv.length) throw new Error(item + ' needs a value');
    options[item.slice(2)] = argv[++index];
  }
  return options;
}

function readBounded(file, maxBytes, label) {
  try {
    const absolute = path.resolve(String(file || ''));
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) throw new Error('not-file');
    if (stat.size > maxBytes) throw new Error('too-large');
    return fs.readFileSync(absolute, 'utf8');
  } catch (error) {
    throw new Error(label + ' could not be read within its size limit');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  ['source', 'candidate', 'plan', 'sandbox-root', 'confirm'].forEach(field => { if (!options[field]) throw new Error(field + ' is required'); });
  if (options['sandbox-only'] !== true || options.cleanup !== true) throw new Error('--sandbox-only and --cleanup are both required');
  const source = readBounded(options.source, Inspector.MAX_BYTES, 'source');
  const candidate = readBounded(options.candidate, Inspector.MAX_BYTES, 'candidate');
  const planText = readBounded(options.plan, 2 * 1024 * 1024, 'plan');
  let plan;
  try { plan = JSON.parse(planText); }
  catch (error) { throw new Error('plan JSON is invalid'); }
  const receipt = await Runner.execute({
    source,
    candidate,
    plan,
    sandboxRoot: options['sandbox-root'],
    confirmPlanId: options.confirm,
    acknowledgeSandboxOnly: true,
    acknowledgeEphemeralCleanup: true
  });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
  if (receipt.status !== 'PASS_WITH_LIMITS') process.exitCode = 2;
}

main().catch(error => {
  console.error('Evidence Chain Application Drill Runner refused: ' + error.message);
  console.error(usage());
  process.exitCode = 1;
});
