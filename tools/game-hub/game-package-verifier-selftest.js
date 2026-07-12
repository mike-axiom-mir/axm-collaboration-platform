'use strict';
const path = require('path');
const fs = require('fs');
const V = require('./game-package-verifier');
const gameDir = path.join(__dirname, 'game-library', '002-robo-pong');
const base = JSON.parse(fs.readFileSync(path.join(gameDir, 'game.manifest.json'), 'utf8'));
let pass = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); pass++; }
ok(V.validateManifest(base, { gameDir, syntaxCheck: false }).length === 0, 'current 002 manifest passes structural verification');
let bad = JSON.parse(JSON.stringify(base)); bad.launch.server_entry = '../../game-hub-server.js';
ok(V.validateManifest(bad, { gameDir, syntaxCheck: false }).some(x => x.includes('escapes')), 'server entry escape is refused');
bad = JSON.parse(JSON.stringify(base)); delete bad.launch.client_entry;
ok(V.validateManifest(bad, { gameDir, syntaxCheck: false }).some(x => x.includes('client_entry')), 'missing client route is refused');
bad = JSON.parse(JSON.stringify(base)); bad.max_players = 99;
ok(V.validateManifest(bad, { gameDir, syntaxCheck: false }).some(x => x.includes('max_players')), 'invalid player cap is refused');
bad = JSON.parse(JSON.stringify(base)); bad.package.required_paths.push('runtime/definitely-missing.file');
ok(V.validateManifest(bad, { gameDir, syntaxCheck: false }).some(x => x.includes('required path missing')), 'missing runtime evidence is refused');
console.log('PASS game package verifier: ' + pass + ' assertions');
