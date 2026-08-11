#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Core = require('../../shared/deterministic-continuation-capsule/continuation-core');
const Host = require('../../shared/deterministic-continuation-capsule/continuation-host');

function usage() {
  return [
    'AXM Deterministic Continuation Capsule',
    '',
    'Compile:',
    '  node continuation-cli.js compile --repo <git-root> --declaration <declaration.json> --source-root <root> [--out <capsule.json>]',
    'Reverify declaration and linked files:',
    '  node continuation-cli.js verify --repo <git-root> --capsule <capsule.json> --declaration <declaration.json> --source-root <root> [--out <verification.json>]',
    'Render compact resume card:',
    '  node continuation-cli.js render --repo <git-root> --capsule <capsule.json> [--out <card.json>]',
    'Verify resume card:',
    '  node continuation-cli.js verify-card --repo <git-root> --card <card.json> [--out <verification.json>]',
    '',
    'Outputs are create-new and outside the repository. Source contents and input paths are never embedded.',
    'REPROBE_REQUIRED remains mandatory for volatile external facts. No action, permission, memory authority, promotion, roots, or CANON change is granted.'
  ].join('\n');
}

function parseArguments(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) return { help:true };
  const action = argv[0];
  if (!['compile','verify','render','verify-card'].includes(action)) throw new Error('action must be compile, verify, render, or verify-card');
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

function main(argv) {
  const options = parseArguments(argv);
  if (options.help) { process.stdout.write(usage() + '\n'); return 0; }
  let result;
  if (options.action === 'compile') {
    if (!options.sourceRoot) throw new Error('--source-root is required');
    const declaration = readJson(options.declaration, '--declaration');
    result = Host.compile({ declaration, sourceRoot:options.sourceRoot });
  } else if (options.action === 'verify') {
    if (!options.sourceRoot) throw new Error('--source-root is required');
    result = Host.reverify({ capsule:readJson(options.capsule, '--capsule'), declaration:readJson(options.declaration, '--declaration'), sourceRoot:options.sourceRoot });
  } else if (options.action === 'render') result = Core.buildResumeCard(readJson(options.capsule, '--capsule'));
  else result = Core.verifyResumeCard(readJson(options.card, '--card'));
  emit(result, options);
  return ['HELD','FAIL'].includes(result.state) ? 2 : 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) { process.stderr.write('REFUSED: ' + Host.publicError(error) + '\n'); process.exitCode = 1; }
}

module.exports = { usage, parseArguments, readJson, isInside, emit, main };
