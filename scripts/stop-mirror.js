'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'mirror.config.example.json'), 'utf8'));
const local = path.join(ROOT, 'config', 'mirror.config.local.json');
let override = {};
try { override = JSON.parse(fs.readFileSync(local, 'utf8')); } catch (_) {}
const port = Number(process.env.AXM_MIRROR_PORT || override.port || config.port);
let token;
try { token = fs.readFileSync(path.join(ROOT, 'state', 'runtime-token.txt'), 'utf8').trim(); } catch (_) {}
if (!token) {
  console.error('Mirror token not found; runtime is probably already offline.');
  process.exit(1);
}
fetch(`http://127.0.0.1:${port}/axm/v1/runtime/stop`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'x-axm-mirror-action': 'explicit-stop', 'content-type': 'application/json' },
  body: '{}'
}).then(async response => {
  console.log(JSON.stringify(await response.json(), null, 2));
  if (!response.ok) process.exitCode = 1;
}).catch(error => { console.error(`Mirror stop failed: ${error.message}`); process.exitCode = 1; });
