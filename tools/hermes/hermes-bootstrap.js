#!/usr/bin/env node
/* AXM Hermes Bootstrap v0.1
   Goal: reduce Hermes setup pain.
   This wrapper does not vendor Hermes into AXM.
   It prepares a local external runtime folder, checks tools, and gives one start path.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = __dirname;
const EXTERNAL = path.join(ROOT, 'external');
const HERMES_DIR = path.join(EXTERNAL, 'hermes-agent');
const CONFIG_FILE = path.join(ROOT, 'hermes-source.local.json');
const EXAMPLE_FILE = path.join(ROOT, 'hermes-source.example.json');

function exists(p) { try { fs.accessSync(p); return true; } catch (e) { return false; } }
function run(cmd, args, opts) {
  console.log('> ' + cmd + ' ' + args.join(' '));
  return cp.spawnSync(cmd, args, Object.assign({ stdio: 'inherit', shell: process.platform === 'win32' }, opts || {}));
}
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n'); }

function ensureExample() {
  if (!exists(EXAMPLE_FILE)) {
    writeJson(EXAMPLE_FILE, {
      note: 'Copy this to hermes-source.local.json and set the real Hermes source once verified.',
      repo_url: 'https://github.com/REPLACE/WITH-REAL-HERMES-SOURCE.git',
      branch: 'main',
      install: 'manual',
      start_command: 'hermes --help'
    });
  }
}
function check(cmd) {
  const r = cp.spawnSync(cmd, ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' });
  return r.status === 0;
}

const action = process.argv[2] || 'doctor';
fs.mkdirSync(EXTERNAL, { recursive: true });
ensureExample();

if (action === 'doctor') {
  const cfg = readJson(CONFIG_FILE);
  console.log('AXM Hermes Bootstrap doctor');
  console.log('git:    ' + (check('git') ? 'ok' : 'missing'));
  console.log('python: ' + (check('python') || check('python3') ? 'ok' : 'missing'));
  console.log('node:   ' + (check('node') ? 'ok' : 'missing'));
  console.log('config: ' + (cfg ? 'ok' : 'missing hermes-source.local.json'));
  console.log('local Hermes folder: ' + (exists(HERMES_DIR) ? 'present' : 'missing'));
  if (!cfg) {
    console.log('\nNext: copy hermes-source.example.json to hermes-source.local.json and set the real Hermes repo URL after source verification.');
  }
  process.exit(0);
}

if (action === 'install') {
  const cfg = readJson(CONFIG_FILE);
  if (!cfg || !cfg.repo_url || cfg.repo_url.includes('REPLACE/')) {
    console.error('No verified Hermes source configured. Refusing to guess.');
    console.error('Create hermes-source.local.json from hermes-source.example.json first.');
    process.exit(1);
  }
  if (!check('git')) {
    console.error('git is missing. Install Git first.');
    process.exit(1);
  }
  if (!exists(HERMES_DIR)) {
    const args = ['clone'];
    if (cfg.branch) args.push('--branch', cfg.branch);
    args.push(cfg.repo_url, HERMES_DIR);
    const r = run('git', args);
    if (r.status !== 0) process.exit(r.status || 1);
  } else {
    console.log('Hermes folder already exists: ' + HERMES_DIR);
  }
  console.log('\nInstall step finished as far as AXM can safely automate without locking the exact Hermes source/install command.');
  console.log('If Hermes has its own installer, run it inside: ' + HERMES_DIR);
  process.exit(0);
}

if (action === 'start') {
  const cfg = readJson(CONFIG_FILE);
  if (!cfg || !cfg.start_command) {
    console.error('Missing start_command in hermes-source.local.json.');
    process.exit(1);
  }
  if (!exists(HERMES_DIR)) {
    console.error('Hermes folder missing. Run: node hermes-bootstrap.js install');
    process.exit(1);
  }
  console.log('Starting configured Hermes command in: ' + HERMES_DIR);
  const parts = cfg.start_command.split(' ').filter(Boolean);
  const cmd = parts.shift();
  const r = run(cmd, parts, { cwd: HERMES_DIR });
  process.exit(r.status || 0);
}

console.log('Usage: node hermes-bootstrap.js doctor|install|start');
process.exit(0);
