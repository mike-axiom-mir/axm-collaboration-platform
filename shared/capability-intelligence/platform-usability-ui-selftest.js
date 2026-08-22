#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'hub', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'hub', 'hub-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'hub', 'capability-guide.css'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'generated', 'platform-usability', 'catalog.json'), 'utf8'));
const receipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'generated', 'platform-usability', 'coverage-receipt.json'), 'utf8'));

const checks = {
  catalog_contract: catalog.schema === 'axm.platform-human-usability-catalog/v1',
  registered_coverage: catalog.coverage.all_registered_modules_guided === true && catalog.items.length === 214,
  unique_module_guides: new Set(catalog.items.map(item => item.module_id)).size === catalog.items.length,
  module_chain_complete: catalog.items.every(item => item.module1 && item.module2 && item.module3),
  world_fit_complete: catalog.items.every(item => item.module2.world_fit && item.module2.world_fit.world_context_sha256),
  world_sources_tracked: receipt.module_chain.interface_world.sources === 8 && receipt.module_chain.interface_world.source_states.TRACKED === 8,
  world_authority_closed: catalog.items.every(item => item.module2.world_fit.truth.automatic_execution === false && item.module2.world_fit.truth.automatic_canon === false && item.module2.world_fit.truth.interface_change_applied === false),
  no_authority_leak: catalog.items.every(item => item.truth.automatic_execution === false && item.truth.automatic_canon === false),
  receipt_pass: receipt.verdict === 'PASS' && receipt.module_chain.module3.authority_remains_closed === true,
  active_module_button: /id="humanGuideQuick"[^>]+aria-controls="humanGuideScreen"/.test(html),
  accessible_dialog: /id="humanGuideScreen"[^>]+role="dialog"[^>]+aria-modal="true"/.test(html) && /id="humanGuideState"[^>]+aria-live="polite"/.test(html),
  catalog_fetch: /platform-usability\/catalog\.json/.test(js) && /all_registered_modules_guided/.test(js),
  module_open_updates_guide: /this\.active = id;[\s\S]{0,180}updateHumanGuideQuick\(\)/.test(js),
  home_hides_guide: /this\.active = null;[\s\S]{0,700}updateHumanGuideQuick\(\)/.test(js),
  search_results_include_guide: /className='human-usability'/.test(js) && /openHumanGuide\(human\.module_id\)/.test(js),
  guide_renders_all_three_modules: /MODULE 1 · UNDERSTAND/.test(js) && /MODULE 2 · INTERFACE/.test(js) && /MODULE 3 · EVOLVE SAFELY/.test(js),
  truth_boundary_visible: /does not execute, change permissions, prove runtime behavior, or grant CANON/.test(html),
  responsive_styles: /\.human-guide-body/.test(css) && /@media\(max-width:720px\)[^{]*\{\.human-guide-body/.test(css),
};

const failed = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name);
console.log(JSON.stringify({status: failed.length ? 'FAIL' : 'PASS', checks, failed}, null, 2));
process.exitCode = failed.length ? 1 : 0;
