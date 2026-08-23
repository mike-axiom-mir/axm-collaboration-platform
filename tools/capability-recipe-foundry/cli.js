#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Foundry = require('./foundry-core.js');

const ROOT_PREFIX = 'axm-capability-recipe-review-';
const EXTRA_FILES = ['packet.json', 'foundry-receipt.json'];

function safeRoot(parent, name) {
  const resolvedParent = path.resolve(String(parent || ''));
  if (!fs.existsSync(resolvedParent) || !fs.lstatSync(resolvedParent).isDirectory()) throw new Error('output parent must be an existing directory');
  if (fs.lstatSync(resolvedParent).isSymbolicLink()) throw new Error('output parent must not be a symbolic link');
  if (!String(name || '').startsWith(ROOT_PREFIX) || !/^[a-z0-9-]+$/.test(name)) throw new Error('output root name violates the fixed Foundry boundary');
  const root = path.resolve(resolvedParent, name);
  if (path.dirname(root) !== resolvedParent) throw new Error('output root must be one direct child of the selected parent');
  return { parent: resolvedParent, root: root, name: name };
}

function safeFile(root, relative) {
  if (typeof relative !== 'string' || !relative || /^(?:[A-Za-z]:|[\\/])/.test(relative)) throw new Error('unsafe packet file path');
  const target = path.resolve(root, relative);
  if (path.dirname(target) !== root) throw new Error('packet files must remain direct children of the owned root');
  return target;
}

function cleanupOwned(boundary, allowed) {
  if (!fs.existsSync(boundary.root)) return;
  const stat = fs.lstatSync(boundary.root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.dirname(boundary.root) !== boundary.parent) throw new Error('refusing cleanup because output root identity changed');
  const entries = fs.readdirSync(boundary.root, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink() || !allowed.has(entry.name))) throw new Error('refusing cleanup because output root contains an unexpected entry');
  entries.forEach((entry) => fs.unlinkSync(path.join(boundary.root, entry.name)));
  fs.rmdirSync(boundary.root);
}

function materialize(result, parent, options) {
  options = options || {};
  const checked = Foundry.verify(result);
  if (!checked.ok) throw new Error('review packet verification failed: ' + checked.errors.map((row) => row.code).join(', '));
  const packet = result.packet;
  const rootName = ROOT_PREFIX + packet.id + '-' + packet.packetDigest.slice(7, 19);
  const boundary = safeRoot(parent, rootName);
  if (fs.existsSync(boundary.root)) {
    const error = new Error('refusing to overwrite an existing review packet');
    error.receipt = { schema: 'axm.capability-recipe-foundry-materialization/v1', status: 'HELD', code: 'OUTPUT_OVERWRITE_REFUSED', directory: boundary.root };
    throw error;
  }
  const outputFiles = Object.assign({}, result.files, {
    'packet.json': JSON.stringify(packet, null, 2) + '\n',
    'foundry-receipt.json': JSON.stringify(result.receipt, null, 2) + '\n'
  });
  const allowed = new Set(Object.keys(outputFiles));
  let created = false;
  try {
    fs.mkdirSync(boundary.root);
    created = true;
    Object.keys(outputFiles).sort().forEach((relative, index) => {
      fs.writeFileSync(safeFile(boundary.root, relative), outputFiles[relative], { flag: 'wx' });
      if (options.faultAfterFile === index + 1) throw new Error('bounded injected materialization fault');
    });
    packet.files.forEach((row) => {
      const observed = fs.readFileSync(safeFile(boundary.root, row.path), 'utf8');
      if (Foundry.digest(observed) !== row.digest) throw new Error('materialized file readback digest mismatch: ' + row.path);
    });
    const readPacket = JSON.parse(fs.readFileSync(path.join(boundary.root, 'packet.json'), 'utf8'));
    const readReceipt = JSON.parse(fs.readFileSync(path.join(boundary.root, 'foundry-receipt.json'), 'utf8'));
    const readResult = { schema: result.schema, version: result.version, status: 'COMPLETE', plan: result.plan, packet: readPacket, files: Object.fromEntries(packet.files.map((row) => [row.path, fs.readFileSync(path.join(boundary.root, row.path), 'utf8')])), receipt: readReceipt, authority: result.authority };
    if (!Foundry.verify(readResult).ok) throw new Error('materialized review packet failed exact readback verification');
    return {
      schema: 'axm.capability-recipe-foundry-materialization/v1',
      status: 'MATERIALIZED_FOR_SOURCE_REVIEW',
      directory: boundary.root,
      packetDigest: packet.packetDigest,
      fileCount: Object.keys(outputFiles).length,
      builderSourceExecuted: false,
      generatedCodeExecuted: false,
      testsExecuted: false,
      installed: false,
      promoted: false,
      canon: false
    };
  } catch (error) {
    if (created) cleanupOwned(boundary, allowed);
    throw error;
  }
}

function main(argv) {
  if ((argv.length !== 2 && argv.length !== 4) || argv[0] !== '--pilot' || !argv[1] || (argv.length === 4 && argv[2] !== '--kind')) {
    process.stderr.write('Usage: node tools/capability-recipe-foundry/cli.js --pilot <existing-output-parent> [--kind HAND|SKILL|ADAPTER]\n');
    process.exitCode = 2;
    return;
  }
  const kind = String(argv[3] || 'HAND').toUpperCase();
  if (kind !== 'HAND' && kind !== 'SKILL' && kind !== 'ADAPTER') { process.stderr.write('Kind must be HAND, SKILL, or ADAPTER.\n'); process.exitCode = 2; return; }
  const intent = kind === 'SKILL' ? Foundry.exampleSkill() : kind === 'ADAPTER' ? Foundry.exampleAdapter() : Foundry.example();
  const result = Foundry.forge(intent);
  process.stdout.write(JSON.stringify(materialize(result, argv[1]), null, 2) + '\n');
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { ROOT_PREFIX: ROOT_PREFIX, EXTRA_FILES: EXTRA_FILES, safeRoot: safeRoot, safeFile: safeFile, materialize: materialize };
