#!/usr/bin/env node
'use strict';

const path = require('path');
const Host = require('../shared/schema-registry/schema-registry-host');

function main() {
  const args = process.argv.slice(2);
  const modes = ['--check', '--write', '--print'].filter(mode => args.includes(mode));
  if (modes.length !== 1) throw new Error('exactly one of --check, --write, or --print is required');
  const rootArg = args.find(value => value.startsWith('--root='));
  const root = path.resolve(rootArg ? rootArg.slice(7) : path.join(__dirname, '..'));
  if (modes[0] === '--print') {
    process.stdout.write(JSON.stringify(Host.load(root), null, 2) + '\n');
    return;
  }
  if (modes[0] === '--write') {
    const registry = Host.write(root);
    process.stdout.write(JSON.stringify({ schema: 'axm.schema-registry-command/v1', state: 'PASS', mode: 'WRITE_GENERATED_VIEW', graphDigest: registry.graphDigest, registryDigest: registry.registryDigest, entries: registry.entries.length, unresolvedSockets: registry.unresolvedSockets.length, authority: { migrate: false, rewrite: false, executeAdapter: false, promote: false, canon: false } }, null, 2) + '\n');
    return;
  }
  const result = Host.check(root);
  process.stdout.write(JSON.stringify({ schema: 'axm.schema-registry-command/v1', state: result.state, mode: 'READ_ONLY_CHECK', code: result.code, graphDigest: result.registry.graphDigest, registryDigest: result.registry.registryDigest }, null, 2) + '\n');
  if (result.state !== 'PASS') process.exitCode = 1;
}

try { main(); }
catch (error) {
  process.stderr.write(JSON.stringify({ schema: 'axm.schema-registry-command-error/v1', state: 'FAIL', code: error.code || 'UNCAUGHT_ERROR', message: error.message, details: error.details || null }, null, 2) + '\n');
  process.exitCode = 1;
}
