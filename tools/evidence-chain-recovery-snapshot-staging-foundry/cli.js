#!/usr/bin/env node
'use strict';

const fs = require('fs');
const Materializer = require('./snapshot-staging-materializer');

function usage() {
  return 'Usage: node cli.js --source FILE --candidate FILE --plan FILE --conformance FILE --integration FILE --target-relative state/evidence-retention/.../events.jsonl --output-root NEW_ABSOLUTE_ROOT --confirm PACKET_ID --target-path-private --retain-staging --no-live-placement --no-authority';
}

function parse(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (['--target-path-private', '--retain-staging', '--no-live-placement', '--no-authority', '--help'].includes(item)) { options[item.slice(2)] = true; continue; }
    if (!item.startsWith('--')) throw new Error('unexpected argument ' + item);
    if (index + 1 >= argv.length) throw new Error('missing value for ' + item);
    options[item.slice(2)] = argv[index + 1]; index += 1;
  }
  return options;
}

function read(file, label) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(label + ' file is required');
  if (fs.statSync(file).size > 2 * 1024 * 1024) throw new Error(label + ' exceeds the 2 MiB limit');
  return fs.readFileSync(file, 'utf8');
}

async function main() {
  const options = parse(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (!options['target-path-private'] || !options['retain-staging'] || !options['no-live-placement'] || !options['no-authority']) throw new Error('all four staging boundary flags are required');
  const receipt = await Materializer.execute({
    source: read(options.source, 'source'),
    candidate: read(options.candidate, 'candidate'),
    plan: JSON.parse(read(options.plan, 'plan')),
    conformanceReceipt: JSON.parse(read(options.conformance, 'conformance receipt')),
    integrationPacket: JSON.parse(read(options.integration, 'integration packet')),
    targetRelativePath: options['target-relative'],
    outputRoot: options['output-root'],
    options: {
      confirmPacketId: options.confirm,
      acknowledgePrivateTargetPath: true,
      acknowledgeRetainedStaging: true,
      acknowledgeNoLivePlacement: true,
      acknowledgeNoAuthority: true,
      now: new Date().toISOString()
    }
  });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}

main().catch(error => {
  console.error(error.message || error);
  console.error(usage());
  process.exit(1);
});
