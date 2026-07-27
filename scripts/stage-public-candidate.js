#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Planner = require('../tools/workshop-packager/package-planner');

function args(values) {
  const out = {};
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i].startsWith('--')) continue;
    out[values[i].slice(2)] = values[i + 1] && !values[i + 1].startsWith('--') ? values[++i] : true;
  }
  return out;
}

function under(child, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function main() {
  const parsed = args(process.argv.slice(2));
  const root = path.resolve(parsed.root || path.join(__dirname, '..'));
  if (!parsed.destination) throw new Error('--destination is required');
  const destination = path.resolve(parsed.destination);
  if (!fs.statSync(root).isDirectory()) throw new Error('Workshop root is not a directory');
  if (under(destination, root) || under(root, destination)) throw new Error('public candidate destination must be separate from the Workshop');
  if (fs.existsSync(destination)) throw new Error('public candidate destination already exists');

  const collected = Planner.collectFiles(root, []);
  const rows = [];
  for (const relative of Array.from(collected.files.keys()).sort()) {
    const source = collected.files.get(relative);
    const target = path.join(destination, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    const bytes = fs.statSync(target).size;
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    rows.push({ path: relative, bytes, sha256 });
  }
  const digest = crypto.createHash('sha256').update(rows.map(row => row.path + '\0' + row.bytes + '\0' + row.sha256).join('\n')).digest('hex');
  process.stdout.write('public candidate staged: ' + rows.length + ' files, digest ' + digest + '\n');
}

try { main(); }
catch (error) { console.error(error.stack || error.message || error); process.exitCode = 1; }
