#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Core = require('../../shared/deterministic-pr-checkpoint/checkpoint-core');

function usage() {
  return [
    'AXM Deterministic PR Checkpoint',
    '',
    'Inspect:',
    '  node pr-checkpoint-cli.js inspect --repo <git-root> --policy <policy.json> [--evidence <evidence.json>] [--out <checkpoint.json>]',
    'Verify:',
    '  node pr-checkpoint-cli.js verify --packet <checkpoint.json> [--repo <git-root>] [--out <verification.json>]',
    'Render:',
    '  node pr-checkpoint-cli.js render --packet <checkpoint.json> --metadata <metadata.json> [--repo <git-root>] [--out <review-packet.json>]',
    '',
    'The CLI never fetches, stages, commits, pushes, creates a PR, merges, promotes, or canonizes.'
  ].join('\n');
}

function parseArguments(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help:true };
  const action = argv[0];
  if (!['inspect', 'verify', 'render'].includes(action)) throw new Error('action must be inspect, verify, or render');
  const values = { action };
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!/^--[a-z-]+$/.test(flag) || value === undefined || value.startsWith('--')) throw new Error('flags require one explicit value');
    const key = flag.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(values, key)) throw new Error('duplicate flag: ' + flag);
    values[key] = value;
  }
  return values;
}

function readJson(file, label) {
  if (!file) throw new Error(label + ' is required');
  const absolute = path.resolve(file);
  const stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error(label + ' must be a JSON file no larger than 10 MiB');
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function emit(value, options) {
  const serialized = JSON.stringify(value, null, 2) + '\n';
  if (!options.out) {
    process.stdout.write(serialized);
    return;
  }
  if (!options.repo) throw new Error('--repo is required when --out is used so source-tree writes can be refused');
  const repositoryRoot = fs.realpathSync(path.resolve(options.repo));
  const output = path.resolve(options.out);
  if (fs.existsSync(output)) throw new Error('output already exists; overwrite is refused');
  const parent = path.dirname(output);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error('output parent directory must already exist');
  const realOutput = path.join(fs.realpathSync(parent), path.basename(output));
  if (isInside(repositoryRoot, realOutput)) throw new Error('output must be outside the inspected repository');
  const temporary = path.join(path.dirname(realOutput), '.' + path.basename(realOutput) + '.axm-tmp-' + process.pid);
  if (fs.existsSync(temporary)) throw new Error('temporary output path already exists');
  try {
    fs.writeFileSync(temporary, serialized, { encoding:'utf8', flag:'wx' });
    fs.renameSync(temporary, realOutput);
  } catch (error) {
    try { fs.rmSync(temporary, { force:true }); } catch (_) {}
    throw error;
  }
}

function main(argv) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(usage() + '\n');
    return 0;
  }
  let result;
  if (options.action === 'inspect') {
    if (!options.repo) throw new Error('--repo is required');
    result = Core.inspectRepository({
      repositoryRoot:options.repo,
      policy:readJson(options.policy, '--policy'),
      evidence:options.evidence ? readJson(options.evidence, '--evidence') : undefined
    });
  } else if (options.action === 'verify') {
    result = Core.verifyCheckpoint(readJson(options.packet, '--packet'));
  } else {
    result = Core.renderReviewPacket(readJson(options.packet, '--packet'), readJson(options.metadata, '--metadata'));
  }
  emit(result, options);
  return result.state === 'HELD' || result.state === 'FAIL' ? 2 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('REFUSED: ' + String(error.message || error).replace(/[\r\n]+/g, ' ').slice(0,1000) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { usage, parseArguments, isInside, emit, main };
