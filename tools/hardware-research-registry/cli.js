#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Hardware = require('../../shared/hardware-research-registry');

const sourceRoot = path.resolve(__dirname, '..', '..');
const realSourceRoot = fs.realpathSync(sourceRoot);
function readJson(file) { return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
function isWithin(base, target) {
  const relative = path.relative(base, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}
function parse(argv) {
  const args = argv.slice();
  const at = args.indexOf('--out');
  let out = null;
  if (at >= 0) {
    if (!args[at + 1] || at + 2 !== args.length) throw new Error('--out must be the final option with one path');
    out = args[at + 1]; args.splice(at, 2);
  }
  return { args, out };
}
function externalOutput(file, payload) {
  if (!file) { process.stdout.write(JSON.stringify(payload, null, 2) + '\n'); return; }
  const target = path.resolve(file);
  const parent = path.dirname(target);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error('output parent must be an existing non-link directory');
  const realTarget = path.join(fs.realpathSync(parent), path.basename(target));
  if (isWithin(realSourceRoot, realTarget)) throw new Error('output must remain outside the Workshop source tree');
  if (fs.existsSync(target)) throw new Error('output path already exists; derived artifacts are not overwritten');
  const temp = target + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(temp, JSON.stringify(payload, null, 2) + '\n', {flag:'wx'});
    fs.renameSync(temp, target);
  } catch (error) {
    if (fs.existsSync(temp)) fs.rmSync(temp, {force:true});
    throw error;
  }
}
function usage() {
  return [
    'Hardware Research & Build Registry v0.1',
    '  compile INTAKE.json [--out PACKAGE.json]',
    '  verify PACKAGE.json',
    '  merge PACKAGE_A.json PACKAGE_B.json [...] [--out MERGED.json]',
    '  create-ledger PACKAGE.json [--out LEDGER.json]',
    '  ingest-evidence LEDGER.json OBSERVATION.json [--out NEXT_LEDGER.json]',
    '  snapshot PACKAGE.json LEDGER.json [--out SNAPSHOT.json]'
  ].join('\n');
}
function main() {
  const parsed = parse(process.argv.slice(2)), [command, ...args] = parsed.args;
  if (!command || command === 'help' || command === '--help') { console.log(usage()); return; }
  if (command === 'compile' && args.length === 1) return externalOutput(parsed.out, Hardware.compile(readJson(args[0])));
  if (command === 'verify' && args.length === 1 && !parsed.out) {
    const result = Hardware.verify(readJson(args[0])); console.log(JSON.stringify(result, null, 2)); if (!result.pass) process.exitCode = 1; return;
  }
  if (command === 'merge' && args.length >= 2) return externalOutput(parsed.out, Hardware.merge(args.map(readJson)));
  if (command === 'create-ledger' && args.length === 1) return externalOutput(parsed.out, Hardware.createEvidenceLedger(readJson(args[0])));
  if (command === 'ingest-evidence' && args.length === 2) return externalOutput(parsed.out, Hardware.ingestEvidence(readJson(args[0]), readJson(args[1])));
  if (command === 'snapshot' && args.length === 2) return externalOutput(parsed.out, Hardware.snapshot(readJson(args[0]), readJson(args[1])));
  throw new Error('invalid command\n' + usage());
}
try { main(); } catch (error) { console.error('Hardware registry refused: ' + error.message); process.exitCode = 1; }
