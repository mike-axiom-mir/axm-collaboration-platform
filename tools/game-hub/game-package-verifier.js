#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const UniversalControls = require('./universal-control-policy');

const LIBRARY_DIR = __dirname + path.sep + 'game-library';
const ALLOWED_SEAT_TYPES = new Set(['human', 'adapter', 'ai', 'spectator']);
const GAME_NIGHT_SEAM_SCHEMA = 'axm.game-night-seams/v1';
const CONTROLLER_DELIVERY = new Set(['shared-runtime', 'dedicated-path', 'runtime-issued']);
const EVIDENCE_STATES = new Set(['verified', 'pending', 'not-applicable']);

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

function validateGameNightSeams(manifest, context) {
  const errors = [];
  const warnings = [];
  const gameDir = context.gameDir;
  const exists = context.exists || fs.existsSync;
  const controls = manifest && manifest.controls || {};
  const join = manifest && manifest.join || {};
  const seam = manifest && manifest.verification && manifest.verification.game_night;
  const universalGamepad = UniversalControls.evaluateUniversalGamepad(manifest);

  if (universalGamepad.status === 'opted-out' && !universalGamepad.opt_out_reason) {
    errors.push('shared-screen party co-op universal gamepad opt-out requires controls.universal_gamepad_opt_out_reason');
  } else if (universalGamepad.status === 'mapping-required') {
    warnings.push('universal gamepad is the default but this game still needs a gamepad mapping');
  } else if (universalGamepad.status === 'adapter-migration-required') {
    warnings.push('gamepad exists but still needs migration to ' + UniversalControls.DEFAULT_INPUT_PROFILE);
  }

  if (!seam || typeof seam !== 'object') {
    errors.push('verification.game_night contract is required');
    return { errors, warnings };
  }
  if (seam.schema !== GAME_NIGHT_SEAM_SCHEMA) errors.push('verification.game_night.schema must be ' + GAME_NIGHT_SEAM_SCHEMA);
  if (!CONTROLLER_DELIVERY.has(seam.controller_delivery)) errors.push('verification.game_night.controller_delivery is unsupported');
  if (seam.state_authority !== 'server') errors.push('verification.game_night.state_authority must be server');
  if (!['game-hub-active-launch', 'native-resume'].includes(seam.host_reload_recovery)) errors.push('verification.game_night.host_reload_recovery must declare an active resume route');
  if (seam.shared_screen_occupies_seat !== false) errors.push('verification.game_night.shared_screen_occupies_seat must be false');

  ['disconnect_recovery', 'blocking_overlay_escape', 'physical_phone_qa'].forEach(field => {
    if (!EVIDENCE_STATES.has(seam[field])) errors.push('verification.game_night.' + field + ' must be verified, pending, or not-applicable');
    else if (seam[field] === 'pending') warnings.push(field.replace(/_/g, ' ') + ' is pending');
  });

  const physicalPhoneScope = String(seam.physical_phone_qa_scope || '').trim();
  if (seam.physical_phone_qa === 'not-applicable') {
    if (controls.phone_controller === true || controls.touch === true) {
      errors.push('verification.game_night.physical_phone_qa cannot be not-applicable while phone-controller or touch input is advertised');
    }
    if (!physicalPhoneScope) errors.push('not-applicable physical phone QA requires verification.game_night.physical_phone_qa_scope');
  }
  if (seam.physical_phone_qa === 'verified') {
    if (!physicalPhoneScope) errors.push('verified physical phone QA requires verification.game_night.physical_phone_qa_scope');
    if (!Array.isArray(seam.physical_phone_qa_evidence) || !seam.physical_phone_qa_evidence.length) {
      errors.push('verified physical phone QA requires verification.game_night.physical_phone_qa_evidence');
    } else seam.physical_phone_qa_evidence.forEach(rel => {
      const abs = path.resolve(gameDir, String(rel || ''));
      if (!inside(gameDir, abs)) errors.push('physical phone QA evidence escapes the game folder: ' + rel);
      else if (!exists(abs)) errors.push('physical phone QA evidence missing: ' + rel);
    });
  }

  const hasExternalAdapter = Array.isArray(manifest && manifest.allowed_seat_types)
    && manifest.allowed_seat_types.includes('adapter');
  if (hasExternalAdapter) {
    if (!EVIDENCE_STATES.has(seam.adapter_state_interface) || seam.adapter_state_interface === 'not-applicable') {
      errors.push('verification.game_night.adapter_state_interface must be verified or pending for an adapter seat');
    } else if (seam.adapter_state_interface === 'pending') {
      warnings.push('external collaborator state interface is pending');
    } else {
      const rules = manifest && manifest.rules || {};
      if (controls.intent_protocol !== 'axm-semantic-input-v1') errors.push('verified adapter seat requires controls.intent_protocol=axm-semantic-input-v1');
      if (controls.adapter_observation !== 'axm-seat-screen-semantics-v1') errors.push('verified adapter seat requires controls.adapter_observation=axm-seat-screen-semantics-v1');
      if (rules.human_and_adapter_same_input_gate !== true) errors.push('verified adapter seat requires rules.human_and_adapter_same_input_gate=true');
      if (rules.adapter_observation_is_seat_visible_only !== true) errors.push('verified adapter seat requires rules.adapter_observation_is_seat_visible_only=true');
      if (!Array.isArray(seam.adapter_state_evidence) || !seam.adapter_state_evidence.length) {
        errors.push('verified adapter seat requires verification.game_night.adapter_state_evidence');
      } else seam.adapter_state_evidence.forEach(rel => {
        const abs = path.resolve(gameDir, String(rel || ''));
        if (!inside(gameDir, abs)) errors.push('adapter state evidence escapes the game folder: ' + rel);
        else if (!exists(abs)) errors.push('adapter state evidence missing: ' + rel);
      });
    }
  }

  if (!Array.isArray(seam.controller_evidence) || !seam.controller_evidence.length) {
    errors.push('verification.game_night.controller_evidence must name inspectable files');
  } else {
    let viewportEvidence = false;
    seam.controller_evidence.forEach(rel => {
      const abs = path.resolve(gameDir, String(rel || ''));
      if (!inside(gameDir, abs)) return errors.push('controller evidence escapes the game folder: ' + rel);
      if (!exists(abs)) return errors.push('controller evidence missing: ' + rel);
      if (/\.html?$/i.test(abs)) {
        try { if (/name=["']viewport["']/i.test(fs.readFileSync(abs, 'utf8'))) viewportEvidence = true; } catch (_) {}
      }
    });
    if (controls.phone_controller === true && !viewportEvidence) errors.push('phone controller evidence must include responsive viewport HTML');
  }

  if (controls.phone_controller === true) {
    if (controls.touch !== true) errors.push('controls.phone_controller requires controls.touch=true');
    if (join.supports_lan_link !== true) errors.push('controls.phone_controller requires join.supports_lan_link=true');
  }
  if (join.supports_qr === true && controls.phone_controller !== true) errors.push('join.supports_qr requires controls.phone_controller=true');
  if (seam.controller_delivery === 'dedicated-path' && !(manifest.launch && manifest.launch.controller_path)) errors.push('dedicated-path controller delivery requires launch.controller_path');
  if (seam.controller_delivery === 'runtime-issued') {
    const endpoint = String(seam.runtime_metadata_endpoint || '');
    if (!endpoint.startsWith('/api/')) errors.push('runtime-issued controller delivery requires an /api/ runtime_metadata_endpoint');
  }
  return { errors, warnings };
}

function verifyGameDir(gameDir) {
  const manifestPath = path.join(gameDir, 'game.manifest.json');
  if (!fs.existsSync(manifestPath)) return {
    game: path.basename(gameDir),
    manifest: manifestPath,
    errors: [],
    warnings: ['construction folder ignored until game.manifest.json exists'],
    incomplete: true
  };
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
  catch (e) { return { game: path.basename(gameDir), manifest: manifestPath, errors: ['manifest JSON is invalid: ' + e.message] }; }
  const errors = validateManifest(manifest, { gameDir });
  const seams = validateGameNightSeams(manifest, { gameDir });
  return { game: manifest.game_id || path.basename(gameDir), slot: manifest.slot || null, manifest: manifestPath, errors: errors.concat(seams.errors), warnings: seams.warnings };
}

function validateRecoveryRegressions(libraryDir) {
  const errors = [];
  const read = file => fs.readFileSync(file, 'utf8');
  const json = file => JSON.parse(read(file));
  const contract = json(path.join(__dirname, 'GAME_NIGHT_CONTRACT.json'));
  const ui = read(path.join(__dirname, 'index.html'));
  const client = read(path.join(__dirname, 'game-night.js'));
  const hubSource = read(path.join(__dirname, 'game-hub-server.js'));
  const hub = require('./game-hub-server');
  const manifests = fs.readdirSync(libraryDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.charAt(0) !== '_')
    .map(entry => path.join(libraryDir, entry.name, 'game.manifest.json'))
    .filter(manifestPath => fs.existsSync(manifestPath))
    .map(manifestPath => json(manifestPath));
  const byId = new Map(manifests.map(manifest => [manifest.game_id, manifest]));
  (contract.featuredGames || []).forEach(id => { if (!byId.has(id)) errors.push('featured game id is stale or missing: ' + id); });
  if (!ui.includes('id="openGame"') || !ui.includes('Open shared TV screen')) errors.push('playable game and shared display actions are not visibly separate');
  if (!client.includes('lastLaunch.client_url') || !client.includes('lastLaunch.spectator_url||lastLaunch.client_url')) errors.push('launch UI no longer routes playable and spectator URLs separately');
  if (!client.includes('Preview game controls') || !client.includes("call('/active-launch')")) errors.push('controller preview or refresh recovery route is missing');
  if (hub.runtimeBrowserUrl(8799, '/games/009/') !== 'http://127.0.0.1:8799/') errors.push('direct child runtime URL still carries its Workshop /games prefix');
  if (!hubSource.includes('clientUrl: runtimeBrowserUrl(port, clientUrl)') || !hubSource.includes('spectatorUrl: runtimeBrowserUrl(port, displayPath')) errors.push('Game Hub may overwrite the playable URL with display metadata');

  const casino = byId.get('007-casino-alpha');
  if (!casino) errors.push('Casino current package id is missing');
  else {
    const story = (casino.play_modes || []).find(mode => mode.id === 'backroom_story');
    const war = (casino.play_modes || []).find(mode => mode.id === 'house_war');
    if (!story || story.party_rule !== 'party-a-only' || !war || war.party_rule !== 'balanced-parties') errors.push('Casino solo/story and balanced multiplayer mode contracts drifted');
    try { hub.validatePlayModeRoster(war, [{ slot: 1 }, { slot: 5 }]); }
    catch (error) { errors.push('Casino House War no longer accepts 1v1: ' + error.message); }
    const casinoApp = read(path.join(libraryDir, '007-casino', 'alpha', 'client', 'app.js'));
    const storyTitle = String(story.label || '').split(' - ')[0].trim();
    const warTitle = String(war.label || '').split(' - ')[0].trim();
    if (!storyTitle || !warTitle || !casinoApp.includes(storyTitle) || !casinoApp.includes(warTitle) || !casinoApp.includes('Start local alpha')) errors.push('Casino title/setup route no longer exposes its manifest-declared modes and a start action');
    if (!(casino.controls && casino.controls.keyboard === true && casino.controls.phone_controller === true)) errors.push('Casino must retain laptop and optional phone controls');
  }

  const circuitseed = byId.get('009-circuitseed-protocol-wilds');
  if (!circuitseed || circuitseed.launch.client_entry === circuitseed.launch.spectator_client_entry) errors.push('Circuitseed playable client and party display are not distinct');
  const circuitServer = read(path.join(libraryDir, '009-circuitseed-protocol-wilds', 'server', 'server.js'));
  if (!circuitServer.includes('/api/launcher-state')) errors.push('Circuitseed no longer exposes launch metadata to the Game Hub');

  const globe = byId.get('010-living-globe-tycoon');
  if (!globe || !Array.isArray(globe.play_modes) || globe.play_modes[0].id !== 'walkable-globe') errors.push('Living Globe visible world is no longer the default Tycoon experience');
  const globeRuntime = require(path.join(libraryDir, '010-living-globe-tycoon', 'runtime', 'server.js'));
  if (globeRuntime.selectedMode({}) !== 'walkable-globe') errors.push('Living Globe runtime no longer defaults to the visible globe');
  return errors;
}

function verifyLibrary(libraryDir) {
  const dirs = fs.readdirSync(libraryDir, { withFileTypes: true }).filter(x => x.isDirectory() && x.name.charAt(0) !== '_');
  const games = dirs.map(x => verifyGameDir(path.join(libraryDir, x.name)));
  const ports = new Map();
  games.forEach(result => {
    if (result.errors.length || result.incomplete) return;
    const manifest = JSON.parse(fs.readFileSync(result.manifest, 'utf8'));
    const port = manifest.launch.port;
    if (ports.has(port)) {
      result.errors.push('launch.port conflicts with ' + ports.get(port));
      const other = games.find(x => x.game === ports.get(port));
      if (other) other.errors.push('launch.port conflicts with ' + result.game);
    } else ports.set(port, result.game);
  });
  const recoveryErrors = validateRecoveryRegressions(libraryDir);
  if (recoveryErrors.length) games.push({ game: 'game-hub-experience-recovery', slot: null, manifest: path.join(__dirname, 'GAME_NIGHT_CONTRACT.json'), errors: recoveryErrors, warnings: [] });
  return { schema: 'axm.game-package-verification/v1', scope: path.resolve(libraryDir), checkedAt: new Date().toISOString(), games, pass: games.every(x => !x.errors.length), failCount: games.reduce((n, x) => n + x.errors.length, 0), warningCount: games.reduce((n, x) => n + ((x.warnings || []).length), 0) };
}

function main() {
  const report = verifyLibrary(LIBRARY_DIR);
  console.log('AXM GAME PACKAGE VERIFY · game-library only');
  report.games.forEach(g => {
    console.log((g.errors.length ? 'FAIL ' : 'PASS ') + (g.slot ? g.slot + ' · ' : '') + g.game);
    g.errors.forEach(e => console.log('  - ' + e));
    (g.warnings || []).forEach(e => console.log('  warn ' + e));
  });
  console.log(report.failCount + ' failure(s) · ' + report.warningCount + ' warning(s) · ' + report.games.length + ' game folder(s) checked');
  if (!report.pass) process.exitCode = 1;
  return report;
}

if (require.main === module) main();
module.exports = { GAME_NIGHT_SEAM_SCHEMA, inside, validateManifest, validateGameNightSeams, validateRecoveryRegressions, verifyGameDir, verifyLibrary };
