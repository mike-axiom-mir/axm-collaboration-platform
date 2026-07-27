#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Runner = require('./runner');
const Toolchain = require('./toolchain');

function argumentsMap(values) {
  const out = { _: [] };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) out._.push(value);
    else {
      const key = value.slice(2);
      if (!key || index + 1 >= values.length || values[index + 1].startsWith('--')) throw new Error('--' + key + ' requires a value');
      out[key] = values[index + 1];
      index += 1;
    }
  }
  return out;
}

async function main() {
  const args = argumentsMap(process.argv.slice(2));
  const command = args._[0];
  if (command === 'capabilities') {
    const result = await Toolchain.discover({});
    process.stdout.write(JSON.stringify(result.inventory, null, 2) + '\n');
    return;
  }
  if (command === 'run') {
    if (!args.request) throw new Error('run requires --request <relative-or-absolute-json-file>');
    const requestPath = path.resolve(args.request);
    const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
    const result = await Runner.run(request, {
      workspaceRoot: args['workspace-root'] ? path.resolve(args['workspace-root']) : Runner.WORKSHOP_ROOT,
      vaultRoot: args['vault-root'] ? path.resolve(args['vault-root']) : Runner.DEFAULT_VAULT_ROOT
    });
    process.stdout.write(JSON.stringify({ status: result.receipt.status, job_id: result.receipt.job_id, output_root: result.receipt.output_root, digest: result.receipt.digest, canonical_delivery_emitted: result.receipt.canonical_delivery_emitted }, null, 2) + '\n');
    if (result.receipt.status === 'FAIL') process.exitCode = 1;
    return;
  }
  process.stdout.write('Modern Asset Forge\n\n  node tools/modern-asset-forge/cli.js capabilities\n  node tools/modern-asset-forge/cli.js run --request <request.json> [--workspace-root <root>] [--vault-root <root>]\n');
}

main().catch(error => {
  process.stderr.write('Modern Asset Forge: ' + error.message + '\n');
  process.exitCode = 1;
});
