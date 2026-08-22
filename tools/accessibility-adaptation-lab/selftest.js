#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Service = require('../../shared/accessibility-adaptation/accessibility-adaptation-service');

const root = path.join(__dirname, '..', '..');
const service = Service.create({ root });
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert.equal(manifest.id, contract.id);
assert.equal(manifest.version, contract.version);
assert.deepEqual(manifest.permissions, contract.permissions);
const catalog = service.catalog();
assert.equal(catalog.moduleCount, 100);
assert.equal(catalog.familyCount, 10);
assert.equal(catalog.packageCount, 8);
assert.equal(catalog.adapterOrEvidenceBoundCount, 19);
assert.equal(catalog.previewPreferenceCount, 6);
assert.equal(catalog.truth.allPacketsDisabled, true);
assert.equal(catalog.truth.realUserOrDeviceEvidenceRun, false);
assert.equal(catalog.truth.conformanceProven, false);
assert(catalog.modules.every(row => row.realEvidence === 'NOT_RUN'));
assert(catalog.modules.every(row => row.realAccessibilityEffect === 'NOT_PROVEN'));

const keyboard = service.recommend({ goals: ['keyboard focus'] });
assert(keyboard.modules.some(row => row.id === 'axm.access.full-keyboard-route'));
assert(keyboard.modules.some(row => row.id === 'axm.access.focus-visibility-enhancer'));
const plan = service.plan({ goals: ['vision contrast'], profile: { textScale: 170, contrast: 'high', spacing: 'relaxed', density: 'reduced', focus: 'enhanced', language: 'plain' } });
assert.equal(plan.profile.textScale, 160);
assert.equal(plan.profile.contrast, 'high');
assert.equal(plan.automaticApply, false);
assert.equal(plan.canon, false);
assert.equal(plan.authority, 'NONE');
assert(plan.recommendedModules.some(row => row.id === 'axm.access.contrast-theme-selector'));

assert(html.includes('class="skip-link"'));
assert(html.includes('aria-live="polite"'));
assert(css.includes('prefers-reduced-motion:reduce'));
assert(server.includes('/api/accessibility-adaptation/catalog'));
assert(server.includes('/api/accessibility-adaptation/plan'));

console.log('accessibility adaptation lab selftest: PASS (100 packets, 10 families, 6 local preview preferences)');
