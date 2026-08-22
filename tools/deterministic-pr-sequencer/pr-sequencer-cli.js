#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../../shared/deterministic-pr-sequencer/sequencer-core');
const Host = require('../../shared/deterministic-pr-sequencer/sequencer-host');

function usage() {
  return [
    'AXM Deterministic PR Sequencer',
    '',
    'Plan from live GitHub reads:',
    '  node pr-sequencer-cli.js plan --policy <policy.json> [--handoff <platform-handoff.json> ...] [--workspace-root <git-root>] [--out <plan.json>]',
    'Verify plan:',
    '  node pr-sequencer-cli.js verify-plan --packet <plan.json> [--workspace-root <git-root>] [--out <verification.json>]',
    'Render compact platform handoff:',
    '  node pr-sequencer-cli.js render-handoff --packet <plan.json> [--workspace-root <git-root>] [--out <handoff.json>]',
    'Verify platform handoff:',
    '  node pr-sequencer-cli.js verify-handoff --packet <handoff.json> [--workspace-root <git-root>] [--out <verification.json>]',
    '',
    'This tool reads GitHub through the host-authenticated gh session and optionally writes one create-new output file.',
    'It cannot mark a PR ready, edit, close, merge, write a branch, promote, change roots, or change CANON.'
  ].join('\n');
}

function parseArguments(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help:true, handoff:[] };
  const action = argv[0];
  if (!['plan', 'verify-plan', 'render-handoff', 'verify-handoff'].includes(action)) throw new Error('action must be plan, verify-plan, render-handoff, or verify-handoff');
  const values = { action, handoff:[] };
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index], value = argv[index + 1];
    if (!/^--[a-z-]+$/.test(flag) || value === undefined || value.startsWith('--')) throw new Error('flags require one explicit value');
    const key = flag.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    if (key === 'handoff') values.handoff.push(value);
    else {
      if (Object.prototype.hasOwnProperty.call(values, key)) throw new Error('duplicate flag: ' + flag);
      values[key] = value;
    }
  }
  return values;
}

function readJson(file, label) {
  if (!file) throw new Error(label + ' is required');
  const absolute = path.resolve(file), stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error(label + ' must be a JSON file no larger than 20 MiB');
  const bytes = fs.readFileSync(absolute);
  return {
    packet:JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')),
    fileSha256:crypto.createHash('sha256').update(bytes).digest('hex')
  };
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
  if (!options.workspaceRoot) throw new Error('--workspace-root is required when --out is used');
  const workspaceRoot = fs.realpathSync(path.resolve(options.workspaceRoot));
  const output = path.resolve(options.out);
  if (fs.existsSync(output)) throw new Error('output already exists; overwrite is refused');
  const parent = path.dirname(output);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error('output parent directory must already exist');
  const realOutput = path.join(fs.realpathSync(parent), path.basename(output));
  if (isInside(workspaceRoot, realOutput)) throw new Error('output must remain outside the workspace repository');
  const temporary = path.join(path.dirname(realOutput), '.' + path.basename(realOutput) + '.axm-tmp-' + process.pid);
  try {
    fs.writeFileSync(temporary, serialized, { encoding:'utf8', flag:'wx' });
    fs.renameSync(temporary, realOutput);
  } catch (error) {
    try { fs.rmSync(temporary, { force:true }); } catch (_) {}
    throw error;
  }
}

function main(argv, dependencies) {
  const options = parseArguments(argv);
  if (options.help) { process.stdout.write(usage() + '\n'); return 0; }
  let result;
  if (options.action === 'plan') {
    const policy = readJson(options.policy, '--policy').packet;
    const handoffs = options.handoff.map(file => readJson(file, '--handoff'));
    const facts = Host.inspectGitHub({ policy, runner:dependencies && dependencies.runner });
    result = Core.buildPlan({ policy, handoffs, facts });
  } else {
    const packet = readJson(options.packet, '--packet').packet;
    if (options.action === 'verify-plan') result = Core.verifyPlan(packet);
    else if (options.action === 'render-handoff') result = Core.buildPlatformHandoff(packet);
    else result = Core.verifyPlatformHandoff(packet);
  }
  emit(result, options);
  return ['HELD', 'FAIL'].includes(result.state) ? 2 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('REFUSED: ' + Host.publicError(error) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { usage, parseArguments, readJson, isInside, emit, main };
