#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const AccessibilityAudit = require('../../scripts/accessibility-static-audit');

const root = __dirname;
const htmlPath = path.join(root, 'index.html');
const page = fs.readFileSync(htmlPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
let failures = 0, checks = 0;

function check(label, condition) {
  checks += 1;
  if (condition) console.log('PASS ' + label);
  else { console.error('FAIL ' + label); failures += 1; }
}

check('manifest identifies the Forge entry point', manifest.id === 'forge' && manifest.entry === 'index.html');
check('manifest uses the modern product schema', manifest.schema === ContractVerifier.MANIFEST_SCHEMA && manifest.kind === 'product');
check('manifest declares only the documented powers', Array.isArray(manifest.uses) && manifest.uses.includes('storage') && manifest.uses.includes('export'));
check('generated manifests retain an explicit TEST status', page.includes("status:'TEST'"));
check('generated saves retain a version marker', page.includes('{ format:1, yourData }'));
check('generated shells keep the local AXM foundation boundary', page.includes('<scr' + "'+'ipt src=\"axm-foundation.js\""));
check('generated shells make AI optional and honest', page.includes('if (a.noAI) { work without it'));
check('generated shells retain the meaningful-action gate', page.includes("AXMGate.submit({action:\"'+id+'.thing\""));
check('generated shells retain the 44px accessibility floor', page.includes('min-height:44px'));
check('Forge requires a tool name and plain-language purpose', page.includes("if(!nm) return alert('Name the tool first.')") && page.includes("if(!desc) return alert('Say what it does"));
check('official ids retain an explicit human confirmation', page.includes('OFFICIAL tool id') && page.includes('confirm('));
check('manifest declares a matching valid contract', manifest.contract === 'module.contract.json' && contract.id === manifest.id && contract.version === manifest.version && ContractVerifier.validateContract(contract, manifest).errors.length === 0);
check('Forge form controls have accessible names', AccessibilityAudit.auditHtml(htmlPath).filter(item => item.code === 'FORM_NAME_MISSING').length === 0);
check('downloads release their temporary object URLs', page.includes('URL.revokeObjectURL(url)'));
check('contract refuses installation registry mutation and automatic promotion', ['automatic-tool-installation', 'automatic-registry-write', 'automatic-workshop-mutation', 'automatic-status-promotion', 'canon-authority'].every(boundary => contract.boundaries.refuses.includes(boundary)));
check('contract grants only explicit export authority', JSON.stringify(contract.permissions) === JSON.stringify(['export']));
check('manifest permission declaration exactly matches the contract', JSON.stringify(manifest.permissions) === JSON.stringify(contract.permissions));
check('manifest describes download-only behavior honestly', manifest.notes.includes('never installs, registers, or mutates'));

if (failures) process.exitCode = 1;
else console.log('Tool Forge selftest: PASS - ' + checks + ' checks');
