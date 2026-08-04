#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const AccessibilityAudit = require('../../scripts/accessibility-static-audit');

const dir = __dirname;
const root = path.join(dir, '..', '..');
const htmlPath = path.join(dir, 'index.html');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(dir, 'module.contract.json'), 'utf8'));
const page = fs.readFileSync(htmlPath, 'utf8');
const foundationPath = path.join(root, 'launcher', 'axm-foundation.js');
let checks = 0;
let failures = 0;

function check(label, condition) {
  checks += 1;
  if (condition) console.log('PASS ' + label);
  else { console.error('FAIL ' + label); failures += 1; }
}

const inlineScripts = Array.from(page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi), match => match[1]);
let inlineScriptsCompile = true;
try { inlineScripts.forEach(source => new Function(source)); }
catch (_) { inlineScriptsCompile = false; }
let foundationCompiles = fs.existsSync(foundationPath);
try { if (foundationCompiles) new Function(fs.readFileSync(foundationPath, 'utf8')); }
catch (_) { foundationCompiles = false; }

check('manifest identifies the TEST proposal entry point', manifest.id === 'launcher-card-installer' && manifest.status === 'TEST' && manifest.entry === 'index.html');
check('manifest uses the modern product schema', manifest.schema === ContractVerifier.MANIFEST_SCHEMA && manifest.kind === 'product');
check('manifest declares the matching contract and only used dependencies', manifest.contract === 'module.contract.json' && JSON.stringify(manifest.uses) === JSON.stringify(['gate', 'registry', 'export']));
check('declared contract is valid and matches the manifest', contract.id === manifest.id && contract.version === manifest.version && ContractVerifier.validateContract(contract, manifest).errors.length === 0);
check('contract grants export authority only', JSON.stringify(contract.permissions) === JSON.stringify(['export']));
check('manifest permission declaration exactly matches the contract', JSON.stringify(manifest.permissions) === JSON.stringify(contract.permissions));
check('proposal output declares its schema and non-applied effect', page.includes("schema:'axm.launcher-card-proposal/v1'") && page.includes("effect:'proposal-only'") && page.includes('applied:false'));
check('tool catalog access is read only', page.includes("fetch('/api/tools')") && !/method\s*:\s*['\"](?:POST|PUT|PATCH|DELETE)/i.test(page));
check('meaningful-action gate precedes proposal download', page.indexOf('AXMGate.submit') >= 0 && page.indexOf('AXMGate.submit') < page.indexOf('URL.createObjectURL'));
check('download object URLs are released', page.includes('URL.revokeObjectURL'));
check('visible and declared no-fake-done boundaries agree', page.includes('NO FAKE DONE') && Array.isArray(manifest.no_fake_done) && manifest.no_fake_done.length === 3);
check('manifest names the absent write route honestly', manifest.notes.includes('no /api/tool-card write route'));
check('contract refuses Workshop mutation installation promotion and CANON', ['manifest-write', 'registry-write', 'skin-pack-installation', 'automatic-tool-installation', 'automatic-status-promotion', 'canon-authority'].every(boundary => contract.boundaries.refuses.includes(boundary)));
check('contract emits only the proposal handoff', JSON.stringify(contract.handoffs.emits) === JSON.stringify(['axm.launcher-card-proposal/v1']));
check('contract owns no persistent state', contract.lifecycle.state_owner === 'none' && contract.lifecycle.reload === 'reset');
check('static accessibility audit has no definite findings', AccessibilityAudit.auditHtml(htmlPath).length === 0);
check('the single inline application script compiles', inlineScripts.length === 1 && inlineScriptsCompile);
check('the referenced launcher foundation exists and compiles', page.includes('src="/launcher/axm-foundation.js"') && foundationCompiles);

if (failures) process.exitCode = 1;
else console.log('Launcher Card Installer selftest: PASS - ' + checks + ' checks');
