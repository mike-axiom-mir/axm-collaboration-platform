#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const permissionService = read('shared/operations/permission-service.js');
const secretService = read('shared/operations/secrets-service.js');
const serviceTest = read('shared/operations/selftest.js');
const api = read('shared/operations/operations-api.js');
const app = read('tools/secrets-permissions-console/app.js');
const html = read('tools/secrets-permissions-console/index.html');
const installer = read('tools/module-installer/index.html');
const contract = JSON.parse(read('tools/secrets-permissions-console/module.contract.json'));
const manifest = JSON.parse(read('tools/secrets-permissions-console/manifest.json'));
const catalogFunction = permissionService.slice(permissionService.indexOf('function catalog()'), permissionService.indexOf('function read()'));
const protectedRoutes = Array.from(api.matchAll(/requirePermission\('([^']+)'\s*,\s*'([^']+)'\)/g)).map(match => ({ moduleId: match[1], permission: match[2] }));
const protectedRoutesDeclared = protectedRoutes.every(route => {
  try { return (JSON.parse(read('tools/' + route.moduleId + '/manifest.json')).permissions || []).includes(route.permission); } catch (_) { return false; }
});

const checks = [
  ['Grantable catalog reads manifest.permissions only', catalogFunction.includes('permissions: unique(manifest.permissions)')],
  ['Dependencies are returned as separate read-only context', catalogFunction.includes('dependencies: unique(manifest.uses)') && !catalogFunction.includes('concat')],
  ['Dependency-only authority is refused in execution', serviceTest.includes('dependency-only capability cannot be granted as permission')],
  ['Every protected operations route uses a manifest-declared permission', protectedRoutes.length > 0 && protectedRoutesDeclared],
  ['Permission decisions require a reason', permissionService.includes('permission decision reason is required')],
  ['Invalid and past permission expiries are refused', permissionService.includes('permission expiry is invalid') && permissionService.includes('permission expiry must be in the future')],
  ['No permission decision defaults to ineffective DENY', permissionService.includes("return 'UNDECIDED'") && permissionService.includes("defaultDecision: 'DENY'")],
  ['Effective permission status observation is read only', serviceTest.includes('permission status observation does not mutate the decision ledger')],
  ['Permission API retains explicit header and typed confirmation', api.includes("explicit(req, 'x-axm-permission', 'explicit-decision')") && api.includes("parsed.confirmation !== 'SET MODULE PERMISSION'")],
  ['Secret expiries are validated before value persistence', secretService.indexOf('normalizeExpiry(input.expiresAt)') < secretService.indexOf('values[id] = value')],
  ['Secret status exposes state but never value', secretService.includes("schema: 'axm.secret-vault-status/v1'") && secretService.includes('valuesExposedToBrowser: false')],
  ['Secret API requires exact revocation confirmation', api.includes("parsed.confirmation !== 'REVOKE SECRET'")],
  ['Browser revoke stays disabled without selection unlock and phrase', app.includes("revokeConfirm.value === 'REVOKE SECRET'") && app.includes('vaultData.unlocked')],
  ['Browser grant stays disabled without reason and phrase', app.includes("grantConfirm.value === 'SET MODULE PERMISSION'") && app.includes('reason.value.trim()')],
  ['Browser clears passphrase and secret inputs after capture', app.includes("field.value = ''") && app.includes("valueField.value = ''")],
  ['Browser cannot read stored secret values or shadow service truth', !/readSecret|localStorage|sessionStorage/.test(app)],
  ['Deep links select context only', app.includes("params.get('module')") && html.includes('This link selects context only; it does not grant anything.') === false && app.includes('does not grant anything')],
  ['Installer links the exact declared permission context', installer.includes('module=module-installer&amp;permission=module.install')],
  ['Visible language explains dependency and permission overlap precisely', html.includes('Never grant authority by themselves') && html.includes("manifest.permissions") && app.includes('separately declared permission')],
  ['Contract refuses authority collapse and automatic grants', contract.boundaries.refuses.includes('dependency-as-permission') && contract.boundaries.refuses.includes('automatic-grant') && contract.boundaries.refuses.includes('one-click-secret-revocation')],
  ['Console remains a TEST product behind the human gate', manifest.kind === 'product' && manifest.status === 'TEST']
];

let failed = 0;
checks.forEach(([name, pass]) => {
  console.log((pass ? 'PASS  ' : 'OPEN  ') + name);
  if (!pass) failed += 1;
});
console.log('Secrets & Permissions discovery seam review: ' + (failed ? 'OPEN ' + failed : 'PASS - 21 controls'));
if (failed) process.exit(1);
