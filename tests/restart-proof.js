#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const gameVerifier = require('../tools/game-hub/game-package-verifier');

const ROOT = path.resolve(__dirname, '..');
const checks = [];
function record(id, pass, detail) { checks.push({ id, pass: !!pass, detail: String(detail || '') }); }
function get(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 4000 }, res => {
      let body = ''; res.on('data', d => { body += d; if (body.length > 5e6) req.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, body, json: (() => { try { return JSON.parse(body); } catch (e) { return null; } })() }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject);
  });
}
async function checkedGet(id, url, test) {
  try { const r = await get(url); const verdict = test(r); record(id, verdict.pass, verdict.detail); }
  catch (e) { record(id, false, e.message); }
}

async function main() {
  await checkedGet('workshop.new-modules', 'http://127.0.0.1:8788/api/tools', r => { const ids = (r.json && r.json.tools || []).map(x => x.id); return { pass: ids.includes('ai-task-talk') && ids.includes('workshop-packager') && ids.includes('project-room') && ids.includes('ui-ux-builder'), detail: ['ai-task-talk','workshop-packager','project-room','ui-ux-builder'].filter(id => ids.includes(id)).join(', ') || 'new modules missing' }; });
  await checkedGet('ai-task-talk.contract-ui', 'http://127.0.0.1:8788/tools/ai-task-talk/index.html', r => ({ pass: r.status === 200 && r.body.includes('resumeDispatch') && r.body.includes('taskCompletion') && r.body.includes('NEEDS CLARIFICATION'), detail: r.status + ' · task finish, persistent opt-in, and agency seams present' }));
  await checkedGet('project-room.planning-ui', 'http://127.0.0.1:8788/tools/project-room/index.html', r => ({ pass: r.status === 200 && r.body.includes('Ideas Inbox') && r.body.includes('cardEvidence') && r.body.includes('project-room-core.js') && r.body.includes('app.js'), detail: r.status + ' · ideas, evidence gate, and local planning scripts present' }));
  await checkedGet('ui-ux-builder.human-flow', 'http://127.0.0.1:8788/tools/ui-ux-builder/index.html', r => ({ pass: r.status === 200 && r.body.includes('Start with the person') && r.body.includes('Human check') && r.body.includes('Nothing is applied automatically') && r.body.includes('ui-ux-core.js'), detail: r.status + ' · human brief, live preview, audit, and proposal-only boundary present' }));
  await checkedGet('chatgpt-connector.status', 'http://127.0.0.1:8788/api/chatgpt-connector/status', r => { const s = r.json && r.json.status || {}, seat = s.codingSeat || {}, mcp = s.platformMcp || {}; return { pass: r.status === 200 && typeof seat.loginVerified === 'boolean' && mcp.state === 'manual' && mcp.connected === false && !/token|credential|auth\.json/i.test(JSON.stringify(s)), detail: r.status + ' · sanitized Codex login probe · Platform MCP manual/unconnected' }; });
  await checkedGet('hub.radio-ui', 'http://127.0.0.1:8788/hub/index.html', r => ({ pass: r.status === 200 && r.body.includes('btnRadio') && r.body.includes('hubRadioAudio') && r.body.includes('/hub/radio.js'), detail: r.status + ' · shell-owned radio controls present' }));
  await checkedGet('hub.ai-presence-ui', 'http://127.0.0.1:8788/hub/ai-presence.js', r => ({ pass: r.status === 200 && r.body.includes("BRIDGE+'/health'") && r.body.includes("BRIDGE+'/local-models'") && r.body.includes("BRIDGE+'/agents/pause'") && r.body.includes('/api/chatgpt-connector/status') && r.body.includes("id:'codex',name:'Codex'") && r.body.includes('platform.connected===true&&platform.safeTunnel===true') && r.body.includes("label:'APP'") && r.body.includes('axm-llama-3.1-8b') && r.body.includes('gemini-local'), detail: r.status + ' · Codex coding seat, guarded ChatGPT platform status, identity truth, and master agent pause gate present' }));
  await checkedGet('hub.spotify-connect-ui', 'http://127.0.0.1:8788/hub/spotify.js', r => ({ pass: r.status === 200 && r.body.includes('code_challenge_method') && r.body.includes('user-modify-playback-state') && r.body.includes('/me/player'), detail: r.status + ' · PKCE and playback-control seams present' }));
  await checkedGet('hub.radio-local-seam', 'http://127.0.0.1:8788/assets/audio/radio/index.json', r => ({ pass: r.status === 200 && r.json && r.json.schema === 'axm.local-radio/v1' && Array.isArray(r.json.tracks), detail: r.status + ' · local playlist manifest ready' }));
  await checkedGet('workshop-packager.history', 'http://127.0.0.1:8788/api/workshop-packages', r => { const items = r.json && r.json.packages || []; return { pass: r.status === 200 && items.some(x => /-full-.*\.zip$/i.test(x.name)) && items.some(x => /-public-.*\.zip$/i.test(x.name)), detail: items.filter(x => x.kind === 'package').length + ' verified package(s) listed' }; });
  await checkedGet('workshop.health', 'http://127.0.0.1:8788/api/health', r => ({ pass: r.status === 200 && r.json && r.json.ok, detail: r.status + ' · ' + (r.json && r.json.build || 'no build') }));
  await checkedGet('bridge.health', 'http://127.0.0.1:8787/health', r => ({ pass: r.status === 200 && r.json && r.json.ok && r.json.providers && r.json.providers.local, detail: r.status + ' · local provider ' + !!(r.json && r.json.providers && r.json.providers.local) }));
  await checkedGet('game-hub.health', 'http://127.0.0.1:8788/game-api/health', r => ({ pass: r.status === 200 && r.json && r.json.ok, detail: r.status + ' · ' + (r.json && r.json.default_tick_rate || '?') + ' TPS' }));
  await checkedGet('game-hub.modular-games', 'http://127.0.0.1:8788/game-api/games', r => { const games = r.json && r.json.games || [], ids = games.map(g => g.game_id); return { pass: ids.includes('002-robo-pong') && ids.includes('003-robo-pong-cross') && ids.includes('005-briarfront'), detail: ids.join(', ') || 'no games' }; });
  try {
    const hub = await get('http://127.0.0.1:8788/game-api/state'), selected = hub.json && hub.json.state && hub.json.state.session && hub.json.state.session.selected_game, slot = selected && String(selected.game_id || '').slice(0, 3);
    if (!/^\d{3}$/.test(slot || '')) record('game-hub.active-route', false, 'no active modular game');
    else await checkedGet('game-hub.active-route', 'http://127.0.0.1:8788/games/' + slot + '/state', r => ({ pass: r.status === 200 && r.json && r.json.version, detail: r.status + ' · ' + selected.game_id + ' · ' + (r.json && r.json.version || 'runtime unavailable') }));
  } catch (e) { record('game-hub.active-route', false, e.message); }
  await checkedGet('studio.duet-ui', 'http://127.0.0.1:8788/tools/studio/index.html', r => ({ pass: r.status === 200 && r.body.includes('duetPanel') && r.body.includes('AXMIdentityRegistry') && r.body.includes('focusCanvas'), detail: r.status + ' · duet + focus seams present' }));
  await checkedGet('skin-vault.duet-assets', 'http://127.0.0.1:8788/assets/local/skin-vault/index.json', r => ({ pass: r.status === 200 && r.json && r.json.assets && r.json.assets['nova-robo-rumble-bg-v1'] && r.json.assets['gemini-circuit-singularity-bg-v1'], detail: r.status + ' · ' + Object.keys(r.json && r.json.assets || {}).length + ' registered assets' }));
  await checkedGet('lm-studio.models-api', 'http://127.0.0.1:1234/v1/models', r => { const ids = (r.json && r.json.data || []).map(x => x.id); return { pass: r.status === 200 && ids.includes('gemini-local') && ids.includes('axm-llama-3.1-8b'), detail: ids.filter(x => x === 'gemini-local' || x === 'axm-llama-3.1-8b').join(', ') || 'identifiers missing' }; });
  try {
    const ps = childProcess.spawnSync('lms', ['ps'], { encoding: 'utf8', windowsHide: true });
    const out = String(ps.stdout || '') + String(ps.stderr || '');
    record('lm-studio.models-loaded', ps.status === 0 && out.includes('gemini-local') && out.includes('axm-llama-3.1-8b'), out.includes('gemini-local') && out.includes('axm-llama-3.1-8b') ? 'both identity models loaded' : 'one or both identity models not loaded');
  } catch (e) { record('lm-studio.models-loaded', false, e.message); }
  try {
    const games = gameVerifier.verifyLibrary(path.join(ROOT, 'tools', 'game-hub', 'game-library'));
    record('game-packages.scoped-verifier', games.pass, games.failCount + ' failure(s) across ' + games.games.length + ' game folder(s)');
  } catch (e) { record('game-packages.scoped-verifier', false, e.message); }

  const report = { schema: 'axm.restart-proof/v1', status: checks.every(x => x.pass) ? 'PASS' : 'FAIL', checkedAt: new Date().toISOString(), scope: 'local AXM services, loaded identity models, Task & Talk scheduling, Workshop packages, Studio duet seams, skin assets, modular game packages', checks };
  const exportsDir = path.join(ROOT, 'exports'); fs.mkdirSync(exportsDir, { recursive: true });
  fs.writeFileSync(path.join(exportsDir, 'restart-proof.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(exportsDir, 'restart-proof.txt'), 'AXM RESTART PROOF · ' + report.status + '\n' + checks.map(x => (x.pass ? 'PASS ' : 'FAIL ') + x.id + ' · ' + x.detail).join('\n') + '\n');
  console.log('AXM RESTART PROOF · ' + report.status);
  checks.forEach(x => console.log((x.pass ? 'PASS ' : 'FAIL ') + x.id + ' · ' + x.detail));
  if (report.status !== 'PASS') process.exitCode = 1;
  return report;
}

main().catch(e => { console.error(e.stack || e); process.exitCode = 1; });
