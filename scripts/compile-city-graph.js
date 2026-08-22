#!/usr/bin/env node
'use strict';

const path = require('path');
const Host = require('../shared/city-graph/city-map-host');

function usage() {
  return [
    'AXM LEGO City Map Compiler — EXPERIMENTAL',
    '',
    'Usage:',
    '  node scripts/compile-city-graph.js --check',
    '  node scripts/compile-city-graph.js --write',
    '  node scripts/compile-city-graph.js --print',
    '',
    '--check is read-only and fails when any generated city view is missing or stale.',
    '--write only rewrites the named generated views; it does not install, execute, promote, merge, canonize, or alter roots.'
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(usage() + '\n');
    return;
  }
  const modes = ['--check', '--write', '--print'].filter(mode => args.includes(mode));
  if (modes.length !== 1) throw new Error('exactly one of --check, --write, or --print is required');
  const rootArg = args.find(value => value.startsWith('--root='));
  const root = path.resolve(rootArg ? rootArg.slice('--root='.length) : path.join(__dirname, '..'));
  const observedSourceCommit = Host.sourceCommit(root);
  if (modes[0] === '--print') {
    const graph = Host.compileRepository(root);
    process.stdout.write(JSON.stringify(graph, null, 2) + '\n');
    return;
  }
  if (modes[0] === '--write') {
    const result = Host.writeRepositoryViews(root);
    process.stdout.write(JSON.stringify({ schema: 'axm.city-map-command-result/v1', state: 'PASS', mode: 'WRITE_GENERATED_VIEWS', observedSourceCommit, sourceBinding: result.graph.source, graphDigest: result.graph.semanticDigest, blocks: result.graph.summary.blocks, files: Object.keys(result.files), authority: { install: false, execute: false, networkWrite: false, promote: false, merge: false, canon: false, roots: false } }, null, 2) + '\n');
    return;
  }
  const result = Host.checkRepository(root);
  process.stdout.write(JSON.stringify({ schema: 'axm.city-map-command-result/v1', state: result.state, mode: 'READ_ONLY_CHECK', observedSourceCommit, graphDigest: result.graphDigest, failures: result.failures }, null, 2) + '\n');
  if (result.state !== 'PASS') process.exitCode = 1;
}

try { main(); }
catch (error) {
  process.stderr.write(JSON.stringify({ schema: 'axm.city-map-command-error/v1', state: 'FAIL', code: error.code || 'UNCAUGHT_ERROR', message: error.message, details: error.details || null }, null, 2) + '\n');
  process.exitCode = 1;
}
