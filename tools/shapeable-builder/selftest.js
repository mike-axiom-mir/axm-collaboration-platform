'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = __dirname;
let failed = 0;
function check(condition, message) {
  if (condition) console.log('PASS  ' + message);
  else { failed += 1; console.error('FAIL  ' + message); }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

check(manifest.id === 'shapeable-builder' && manifest.status === 'EXPERIMENTAL', 'candidate manifest identity is explicit');
check(contract.id === manifest.id && contract.permissions.every((item) => manifest.uses.includes(item)), 'contract permissions are declared by the manifest');
check(html.includes('id="mobileCanvasButton"') && html.includes('aria-label="Show canvas"'), 'narrow-screen canvas return is visible and named');
check(app.includes('dom.mobileCanvasButton.addEventListener("click"') && app.includes('dom.inspectorPanel.classList.remove("open")'), 'narrow-screen canvas return closes covering panels');
check(app.includes('window.matchMedia("(max-width: 1050px)").matches'), 'active layer can return a narrow-screen user to the canvas');
check(html.includes('<dialog class="confirm-overlay hidden"'), 'confirmation owns a native top-layer dialog');
check(app.includes('dom.confirmOverlay.showModal()') && app.includes('dom.confirmOverlay.close()'), 'confirmation opens above other dialogs and closes explicitly');
check(app.includes('confirmReturnDialog.close()') && app.includes('returnDialog.showModal()'), 'confirmation suspends and restores the prior native dialog across paint frames');
check(app.includes('dom.confirmOverlay.addEventListener("cancel"'), 'confirmation Escape route is bounded and returns through cancel');

for (const script of ['tests/model_influence_system.cjs', 'tests/model_agent_protocol.cjs']) {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  check(result.status === 0, script + ' remains green');
}

if (failed) process.exit(1);
console.log('shapeable-builder selftest: PASS · local candidate · no canon promotion');
