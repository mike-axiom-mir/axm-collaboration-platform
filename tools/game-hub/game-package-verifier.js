#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const LIBRARY_DIR = __dirname + path.sep + 'game-library';
const ALLOWED_SEAT_TYPES = new Set(['human', 'adapter', 'ai', 'spectator']);

function inside(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  return target === base || target.startsWith(base + path.sep);
}

function validateManifest(manifest, context) {
  const errors = [];
  const gameDir = context.gameDir;
  const exists = context.exists || fs.existsSync;
  const syntaxCheck = context.syntaxCheck !== false;
  const requiredText = ['game_id', 'name', 'status', 'version'];
  requiredText.forEach(key => { if (!String(manifest && manifest[key] || '').trim()) errors.push(key + ' is required'); });
  if (!/^\d{3}$/.test(String(manifest && manifest.slot || ''))) errors.push('slot must be exactly three digits');
  if (manifest && manifest.slot && manifest.game_id && !String(manifest.game_id).startsWith(String(manifest.slot) + '-')) errors.push('game_id must start with slot + "-"');
  const min = Number(manifest && manifest.min_players), max = Number(manifest && manifest.max_players);
  if (!Number.isInteger(min) || min < 1) errors.push('min_players must be a positive integer');
  if (!Number.isInteger(max) || max < min || max > 8) errors.push('max_players must be between min_players and 8');
  if (!Array.isArray(manifest && manifest.allowed_seat_types) || !manifest.allowed_seat_types.length) errors.push('allowed_seat_types must be a non-empty array');
  else manifest.allowed_seat_types.forEach(type => { if (!ALLOWED_SEAT_TYPES.has(type)) errors.push('unsupported seat type: ' + type); });

  const launch = manifest && manifest.launch;
  if (!launch || typeof launch !== 'object') errors.push('launch block is required');
  else {
    const serverEntry = String(launch.server_entry || '');
    if (!serverEntry) errors.push('launch.server_entry is required');
    else {
      const serverAbs = path.resolve(gameDir, serverEntry);
      if (!inside(gameDir, serverAbs)) errors.push('launch.server_entry escapes the game folder');
      else if (!exists(serverAbs)) errors.push('launch.server_entry does not exist: ' + serverEntry);
      else if (!/\.(?:c?js)$/i.test(serverAbs)) errors.push('launch.server_entry must be .js or .cjs');
      else if (syntaxCheck) {
        const check = childProcess.spawnSync(process.execPath, ['--check', serverAbs], { encoding: 'utf8', windowsHide: true });
        if (check.status !== 0) errors.push('server syntax check failed: ' + String(check.stderr || check.stdout || '').trim());
      }
    }
    const expectedPrefix = '/games/' + String(manifest.slot || '') + '/';
    if (!String(launch.client_entry || '').startsWith(expectedPrefix)) errors.push('launch.client_entry must start with ' + expectedPrefix);
    if (launch.spectator_client_entry && !String(launch.spectator_client_entry).startsWith(expectedPrefix)) errors.push('launch.spectator_client_entry must start with ' + expectedPrefix);
    if (launch.controller_path) {
      if (!String(launch.controller_path).startsWith('/')) errors.push('launch.controller_path must be an absolute runtime path');
      if (!String(launch.controller_path).includes('{player}')) errors.push('launch.controller_path must contain {player}');
      if (String(launch.controller_path).includes('..')) errors.push('launch.controller_path cannot contain path traversal');
    }
    const port = Number(launch.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) errors.push('launch.port must be an integer from 1024 to 65535');
    if (launch.start_command !== 'managed-by-game-hub') errors.push('launch.start_command must be managed-by-game-hub');
    if (launch.local_only_default !== true) errors.push('launch.local_only_default must be true');
  }

  const pkg = manifest && manifest.package;
  if (!pkg || !Array.isArray(pkg.required_paths) || !pkg.required_paths.length) errors.push('package.required_paths must declare the runtime evidence');
  else pkg.required_paths.forEach(rel => {
    const abs = path.resolve(gameDir, String(rel || ''));
    if (!inside(gameDir, abs)) errors.push('required path escapes the game folder: ' + rel);
    else if (!exists(abs)) errors.push('required path missing: ' + rel);
  });
  if (!manifest || !manifest.rules || manifest.rules.no_hidden_players !== true) errors.push('rules.no_hidden_players must be true');
  if (!manifest || !manifest.rules || manifest.rules.host_launch_required !== true) errors.push('rules.host_launch_required must be true');
  return errors;
}

function verifyGameDir(gameDir) {
  const manifestPath = path.join(gameDir, 'game.manifest.json');
  if (!fs.existsSync(manifestPath)) return { game: path.basename(gameDir), manifest: manifestPath, errors: ['game.manifest.json is missing'] };
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { return { game: path.basename(gameDir), manifest: manifestPath, errors: ['manifest JSON is invalid: ' + e.message] }; }
  return { game: manifest.game_id || path.basename(gameDir), slot: manifest.slot || null, manifest: manifestPath, errors: validateManifest(manifest, { gameDir }) };
}

function verifyLibrary(libraryDir) {
  const dirs = fs.readdirSync(libraryDir, { withFileTypes: true }).filter(x => x.isDirectory() && x.name.charAt(0) !== '_');
  const games = dirs.map(x => verifyGameDir(path.join(libraryDir, x.name)));
  const ports = new Map();
  games.forEach(result => {
    if (result.errors.length) return;
    const manifest = JSON.parse(fs.readFileSync(result.manifest, 'utf8'));
    const port = manifest.launch.port;
    if (ports.has(port)) {
      result.errors.push('launch.port conflicts with ' + ports.get(port));
      const other = games.find(x => x.game === ports.get(port));
      if (other) other.errors.push('launch.port conflicts with ' + result.game);
    } else ports.set(port, result.game);
  });
  return { schema: 'axm.game-package-verification/v1', scope: path.resolve(libraryDir), checkedAt: new Date().toISOString(), games, pass: games.every(x => !x.errors.length), failCount: games.reduce((n, x) => n + x.errors.length, 0) };
}

function main() {
  const report = verifyLibrary(LIBRARY_DIR);
  console.log('AXM GAME PACKAGE VERIFY · game-library only');
  report.games.forEach(g => {
    console.log((g.errors.length ? 'FAIL ' : 'PASS ') + (g.slot ? g.slot + ' · ' : '') + g.game);
    g.errors.forEach(e => console.log('  - ' + e));
  });
  console.log(report.failCount + ' failure(s) · ' + report.games.length + ' game folder(s) checked');
  if (!report.pass) process.exitCode = 1;
  return report;
}

if (require.main === module) main();
module.exports = { inside, validateManifest, verifyGameDir, verifyLibrary };
