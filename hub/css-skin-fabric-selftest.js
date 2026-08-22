#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css-skin-fabric-adapter.css'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'hub-shell.js'), 'utf8');
let failures = 0;
function test(condition, label) {
  if (condition) console.log('PASS ' + label);
  else { failures++; console.error('FAIL ' + label); }
}

test(/shared\/css-skin-fabric\/src\/css\/index\.css/.test(html), 'Hub loads the shared interface fabric');
test(/hub\/css-skin-fabric-adapter\.css/.test(html), 'Hub loads its bounded fabric adapter last');
test(/data-theme="aetherglass"/.test(html), 'Hub declares the selected interface theme');
test(/--space:\s*var\(--axm-sem-canvas\)/.test(css), 'legacy shell canvas maps to semantic tokens');
test(/@media\s*\(max-width:\s*760px\)/.test(css), 'adapter owns a narrow-screen layout');
test(/container:\s*axm-front-platform\s*\/\s*inline-size/.test(css) && /@container\s+axm-front-platform/.test(css), 'front platform responds to its own available space');
test(/data-sidebar-collapsed="true"\]\s+\.sidebar\s*\{[\s\S]*?width:\s*0\s*!important/.test(css), 'collapsed phone navigation cannot paint over Home');
test(/\.home-grid::before\s*\{\s*display:\s*none/.test(css), 'workbench no longer presents as a second page inside Home');
test(!/atrium-vortex\.(?:css|js)/.test(html), 'the retired vortex layer is not loaded over the semantic platform');
test(/narrowSidebar\s*=.*matchMedia\('\(max-width: 760px\)'\)/.test(shell), 'narrow navigation starts closed');
test(/setSidebarCollapsed\(narrowSidebar \|\| savedSidebar, true, !narrowSidebar\)/.test(shell), 'phone-only collapse does not overwrite the desktop preference');
test(!/url\(https?:/i.test(css), 'adapter has no remote visual dependency');

if (failures) process.exit(1);
console.log('AXM Hub CSS Skin Fabric selftest: PASS');
