#!/usr/bin/env node
'use strict';

const Materializer = require('./snapshot-placement-materializer');

function usage() {
  return [
    'Usage:',
    '  node tools/evidence-chain-recovery-snapshot-placement-foundry/cli.js',
    '    --staging-root <absolute retained staging root>',
    '    --packager-output <absolute existing exports/workshop-packages>',
    '    --confirm-snapshot <exact snapshot id>',
    '    --place-in-packager-output --private-local-data --retain-staging --no-restore-authority'
  ].join('\n');
}

function parse(argv) {
  const values = {};
  const flags = new Set();
  const valueFlags = new Set(['--staging-root', '--packager-output', '--confirm-snapshot']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (valueFlags.has(arg)) {
      if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error('missing value for ' + arg);
      values[arg] = argv[index + 1];
      index += 1;
    } else if (['--place-in-packager-output', '--private-local-data', '--retain-staging', '--no-restore-authority'].includes(arg)) flags.add(arg);
    else if (arg === '--help' || arg === '-h') values.help = true;
    else throw new Error('unknown argument: ' + arg);
  }
  return { values, flags };
}

async function main() {
  const parsed = parse(process.argv.slice(2));
  if (parsed.values.help) { process.stdout.write(usage() + '\n'); return; }
  const required = ['--staging-root', '--packager-output', '--confirm-snapshot'];
  required.forEach(flag => { if (!parsed.values[flag]) throw new Error('missing required argument ' + flag); });
  const receipt = await Materializer.execute({
    stagingRoot: parsed.values['--staging-root'],
    packagerOutputRoot: parsed.values['--packager-output'],
    options: {
      confirmSnapshotId: parsed.values['--confirm-snapshot'],
      acknowledgePackagerOutputPlacement: parsed.flags.has('--place-in-packager-output'),
      acknowledgePrivateLocalData: parsed.flags.has('--private-local-data'),
      acknowledgeRetainedStaging: parsed.flags.has('--retain-staging'),
      acknowledgeNoRestoreAuthority: parsed.flags.has('--no-restore-authority')
    }
  });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write('Placement refused: ' + error.message + '\n');
    process.exitCode = 1;
  });
}

module.exports = { parse, usage, main };
