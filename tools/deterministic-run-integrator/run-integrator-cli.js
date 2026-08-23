#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Core = require('../../shared/deterministic-run-integrator/run-integrator-core');
const Host = require('../../shared/deterministic-run-integrator/run-integrator-host');

function usage() {
  return [
    'AXM Deterministic Run Integrator',
    '',
    'Create one exact isolated run lane:',
    '  node run-integrator-cli.js begin --repo <clean-target-root> --lane <new-path-outside-repo> --policy <policy.json> --confirmation "' + Core.BEGIN_CONFIRMATION + '" --out <receipt.json>',
    'Plan declared integration after the authorized builder and focused tests finish:',
    '  node run-integrator-cli.js plan --repo <clean-target-root> --lane <run-lane-root> --policy <policy.json> [--out <plan.json>]',
    'Verify a plan:',
    '  node run-integrator-cli.js verify-plan --packet <plan.json> [--repo <target-root>] [--out <verification.json>]',
    'Seal, fast-forward, and clean up one exact READY run:',
    '  node run-integrator-cli.js apply --repo <clean-target-root> --lane <run-lane-root> --policy <policy.json> --plan <plan.json> --confirmation "' + Core.APPLY_CONFIRMATION + '" --out <receipt.json>',
    'Verify a receipt:',
    '  node run-integrator-cli.js verify-receipt --packet <receipt.json> [--repo <target-root>] [--out <verification.json>]',
    '',
    'Outputs are create-new and must remain outside the target repository. This tool never runs builders or tests, writes a remote or main, rewrites history, promotes, changes roots, or changes CANON.'
  ].join('\n');
}

function parseArguments(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help: true };
  const action = argv[0];
  if (!['begin', 'plan', 'verify-plan', 'apply', 'verify-receipt'].includes(action)) {
    throw new Error('action must be begin, plan, verify-plan, apply, or verify-receipt');
  }
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
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error(label + ' must be a JSON file no larger than 20 MiB');
  return JSON.parse(fs.readFileSync(absolute, 'utf8').replace(/^\uFEFF/, ''));
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
  if (!options.repo) throw new Error('--repo is required when --out is used');
  const repositoryRoot = fs.realpathSync(path.resolve(options.repo));
  const output = path.resolve(options.out);
  if (fs.existsSync(output)) throw new Error('output already exists; overwrite is refused');
  const parent = path.dirname(output);
  if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) throw new Error('output parent directory must already exist');
  const realOutput = path.join(fs.realpathSync(parent), path.basename(output));
  if (isInside(repositoryRoot, realOutput)) throw new Error('output must remain outside the repository');
  const temporary = path.join(path.dirname(realOutput), '.' + path.basename(realOutput) + '.axm-tmp-' + process.pid);
  try {
    fs.writeFileSync(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, realOutput);
  } catch (error) {
    try { fs.rmSync(temporary, { force: true }); } catch (_) {}
    throw error;
  }
}

function main(argv, dependencies) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(usage() + '\n');
    return 0;
  }
  let result;
  if (options.action === 'verify-plan') {
    result = Core.verifyPlan(readJson(options.packet, '--packet'));
  } else if (options.action === 'verify-receipt') {
    result = Core.verifyReceipt(readJson(options.packet, '--packet'));
  } else {
    if (!options.repo || !options.lane) throw new Error('--repo and --lane are required');
    const policy = readJson(options.policy, '--policy');
    const common = {
      repositoryRoot: options.repo,
      laneRoot: options.lane,
      policy,
      runner: dependencies && dependencies.runner
    };
    if (options.action === 'begin') {
      if (!options.out) throw new Error('begin requires --out so the lane-creation receipt is preserved outside the repository');
      result = Host.beginExact(Object.assign({}, common, { confirmation: options.confirmation }));
    } else if (options.action === 'plan') {
      result = Host.buildPlan(common);
    } else {
      if (!options.out) throw new Error('apply requires --out so the local mutation receipt is preserved outside the repository');
      result = Host.applyExact(Object.assign({}, common, {
        plan: readJson(options.plan, '--plan'),
        confirmation: options.confirmation
      }));
    }
  }
  emit(result, options);
  return ['HELD', 'FAIL', 'REFUSED', 'RECOVERY_REQUIRED'].includes(result.state) ? 2 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('REFUSED: ' + Host.publicError(error) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { usage, parseArguments, readJson, isInside, emit, main };
