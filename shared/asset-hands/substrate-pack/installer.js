#!/usr/bin/env node
'use strict';

const Pack = require('./pack-core');

function parse(argv) {
  const result = { command: argv[0] || 'status', ids: [] };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') result.root = argv[++index];
    else if (value === '--id') result.ids.push(argv[++index]);
    else if (value === '--all') result.all = true;
    else if (value === '--yes') result.yes = true;
    else if (value === '--accept-local-test-license-review') result.acceptLicence = true;
    else if (value === '--request') result.request = argv[++index];
    else throw new Error('unknown argument: ' + value);
  }
  return result;
}

function usage() {
  return [
    'AXM external substrate pack',
    '  node installer.js status [--root DIRECTORY]',
    '  node installer.js resolve --request REQUEST [--root DIRECTORY]',
    '  node installer.js install (--id ID ... | --all) --root DIRECTORY --yes --accept-local-test-license-review',
    '',
    'Install is the only network- or installer-executing command. Status and resolve are read-only.',
    'Receipts never retain private installation paths.'
  ].join('\n');
}

async function main(argv) {
  const options = parse(argv || process.argv.slice(2));
  if (options.command === 'help' || options.command === '--help') return { output: usage(), code: 0 };
  if (options.command === 'status' || options.command === 'verify') return { output: JSON.stringify(Pack.inventory({ root: options.root }), null, 2), code: 0 };
  if (options.command === 'resolve') {
    if (!options.request) throw new Error('resolve requires --request');
    const result = Pack.resolveRequest({ id: options.request }, { root: options.root });
    return { output: JSON.stringify(result, null, 2), code: result.status === 'READY' ? 0 : 2 };
  }
  if (options.command === 'install') {
    if (!options.root) throw new Error('install requires an explicit --root directory');
    if (!options.yes || !options.acceptLicence) throw new Error('install requires --yes and --accept-local-test-license-review');
    const lock = Pack.loadLock();
    const ids = options.all ? lock.entries.map((entry) => entry.id) : options.ids;
    if (!ids.length) throw new Error('install requires --id or --all');
    const receipts = [];
    for (const id of ids) receipts.push(await Pack.installOne(id, { root: options.root, lock }));
    return { output: JSON.stringify({ schema: 'axm.external-substrate-install-batch/v1', receipts, inventory: Pack.inventory({ root: options.root, lock }) }, null, 2), code: 0 };
  }
  throw new Error('unknown command: ' + options.command + '\n' + usage());
}

if (require.main === module) {
  main().then((result) => { process.stdout.write(result.output + '\n'); process.exitCode = result.code; })
    .catch((error) => { process.stderr.write(JSON.stringify({ schema: 'axm.external-substrate-cli-error/v1', status: 'ERROR', reason: Pack.cleanText(error.message, 2000) }, null, 2) + '\n'); process.exitCode = 1; });
}

module.exports = { parse, usage, main };
