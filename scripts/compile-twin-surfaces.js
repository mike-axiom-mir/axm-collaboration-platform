#!/usr/bin/env node
'use strict';

const path = require('path');
const Host = require('../shared/twin-surfaces/twin-surfaces-host');
function main() {
  const args = process.argv.slice(2), modes = ['--check', '--write', '--print'].filter(mode => args.includes(mode));
  if (modes.length !== 1) throw new Error('exactly one of --check, --write, or --print is required');
  const rootArg = args.find(value => value.startsWith('--root='));
  const root = path.resolve(rootArg ? rootArg.slice(7) : path.join(__dirname, '..'));
  if (modes[0] === '--print') { process.stdout.write(JSON.stringify(Host.load(root), null, 2) + '\n'); return; }
  if (modes[0] === '--write') { const twin = Host.write(root); process.stdout.write(JSON.stringify({ schema: 'axm.twin-command/v1', state: 'PASS', mode: 'WRITE_GENERATED_VIEWS', twinDigest: twin.twinDigest, blocks: twin.machinePackets.length, authority: { execute: false, grant: false, promote: false, canon: false } }, null, 2) + '\n'); return; }
  const result = Host.check(root); process.stdout.write(JSON.stringify({ schema: 'axm.twin-command/v1', state: result.state, mode: 'READ_ONLY_CHECK', twinDigest: result.twin.twinDigest, failures: result.failures }, null, 2) + '\n'); if (result.state !== 'PASS') process.exitCode = 1;
}
try { main(); } catch (error) { process.stderr.write(JSON.stringify({ schema: 'axm.twin-command-error/v1', state: 'FAIL', code: error.code || 'UNCAUGHT_ERROR', message: error.message }, null, 2) + '\n'); process.exitCode = 1; }
