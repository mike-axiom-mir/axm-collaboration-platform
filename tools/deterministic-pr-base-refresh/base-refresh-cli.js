#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Core = require('../../shared/deterministic-pr-base-refresh/base-refresh-core');
const Host = require('../../shared/deterministic-pr-base-refresh/base-refresh-host');

function usage() {
  return [
    'AXM Deterministic PR Base Refresh',
    '',
    'Plan (remote reads plus immutable Git object preparation; refs and worktree remain unchanged):',
    '  node base-refresh-cli.js plan --repo <git-root> --publish-root <authorized-root> --checkpoint <checkpoint.json> --verification <verification.json> [--out <plan.json>]',
    'Verify plan:',
    '  node base-refresh-cli.js verify-plan --packet <plan.json> [--repo <git-root>] [--out <verification.json>]',
    'Apply one exact local merge commit:',
    '  node base-refresh-cli.js apply --repo <git-root> --publish-root <authorized-root> --checkpoint <checkpoint.json> --verification <verification.json> --plan <plan.json> --confirmation "' + Core.CONFIRMATION + '" --out <receipt.json>',
    'Verify receipt:',
    '  node base-refresh-cli.js verify-receipt --packet <receipt.json> [--repo <git-root>] [--out <verification.json>]',
    '',
    'This tool never pushes, edits a PR, writes main, rebases, resets, force-updates history, promotes, changes roots, or changes CANON.'
  ].join('\n');
}

function parseArguments(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help:true };
  const action = argv[0];
  if (!['plan','verify-plan','apply','verify-receipt'].includes(action)) throw new Error('action must be plan, verify-plan, apply, or verify-receipt');
  const values = { action };
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index], value = argv[index + 1];
    if (!/^--[a-z-]+$/.test(flag) || value === undefined || value.startsWith('--')) throw new Error('flags require one explicit value');
    const key = flag.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(values, key)) throw new Error('duplicate flag: ' + flag);
    values[key] = value;
  }
  return values;
}

function readJson(file, label) {
  if (!file) throw new Error(label + ' is required');
  const absolute = path.resolve(file), stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > 20 * 1024 * 1024) throw new Error(label + ' must be a JSON file no larger than 20 MiB');
  return JSON.parse(fs.readFileSync(absolute, 'utf8').replace(/^\uFEFF/, ''));
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function emit(value, options) {
  const serialized = JSON.stringify(value, null, 2) + '\n';
  if (!options.out) { process.stdout.write(serialized); return; }
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
    fs.writeFileSync(temporary, serialized, { encoding:'utf8', flag:'wx' });
    fs.renameSync(temporary, realOutput);
  } catch (error) {
    try { fs.rmSync(temporary, { force:true }); } catch (_) {}
    throw error;
  }
}

function packets(options) {
  return { checkpoint:readJson(options.checkpoint, '--checkpoint'), verification:readJson(options.verification, '--verification') };
}

function main(argv, dependencies) {
  const options = parseArguments(argv);
  if (options.help) { process.stdout.write(usage() + '\n'); return 0; }
  let result;
  if (options.action === 'verify-plan') result = Core.verifyPlan(readJson(options.packet, '--packet'));
  else if (options.action === 'verify-receipt') result = Core.verifyReceipt(readJson(options.packet, '--packet'));
  else {
    if (!options.repo || !options.publishRoot) throw new Error('--repo and --publish-root are required');
    const source = packets(options);
    if (options.action === 'plan') {
      result = Core.buildPlan(Object.assign({}, source, { facts:Host.inspectHost({ repositoryRoot:options.repo, publishRoot:options.publishRoot, checkpoint:source.checkpoint, runner:dependencies && dependencies.runner }) }));
    } else {
      if (!options.out) throw new Error('apply requires --out so its local mutation receipt is preserved outside the repository');
      result = Host.applyExact(Object.assign({}, source, {
        repositoryRoot:options.repo,
        publishRoot:options.publishRoot,
        plan:readJson(options.plan, '--plan'),
        confirmation:options.confirmation,
        runner:dependencies && dependencies.runner
      }));
    }
  }
  emit(result, options);
  return ['HELD','FAIL','REFUSED','ROLLED_BACK','RECOVERY_REQUIRED'].includes(result.state) ? 2 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { process.stderr.write('REFUSED: ' + Host.publicError(error) + '\n'); process.exitCode = 1; }
}

module.exports = { usage, parseArguments, readJson, isInside, emit, main };
