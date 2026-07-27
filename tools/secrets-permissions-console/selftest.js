'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Crypto = require('../../shared/operations/secrets-service');
const Permissions = require('../../shared/operations/permission-service');
const dir = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
const contract = JSON.parse(fs.readFileSync(path.join(dir, 'module.contract.json')));
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'secrets-permissions-console.css'), 'utf8');

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert(manifest.produces.includes('axm.permission-status/v1'));
assert(manifest.produces.includes('axm.secret-vault-status/v1'));
assert(contract.provides.includes('dependency-permission-separation'));
assert(contract.provides.includes('deny-by-default-permission-status'));
assert(contract.boundaries.refuses.includes('dependency-as-permission'));
assert(contract.boundaries.refuses.includes('one-click-secret-revocation'));
assert(contract.boundaries.refuses.includes('automatic-grant'));
assert(html.includes('Dependency entries') && html.includes('Never grant authority by themselves'));
assert(html.includes('SET MODULE PERMISSION') && html.includes('REVOKE SECRET'));
assert(html.includes('id="permissionBoundary"') && html.includes('id="secretCustody"') && html.includes('id="secretInventory"') && html.includes('id="revokePanel"'));
assert(app.includes("grantConfirm.value === 'SET MODULE PERMISSION'") && app.includes('reason.value.trim()'));
assert(app.includes("revokeConfirm.value === 'REVOKE SECRET'"));
assert(app.includes("params.get('module')") && app.includes("params.get('permission')"));
assert(app.includes('separately declared permission'));
assert(app.includes("field.value = ''") && app.includes("valueField.value = ''"));
assert(!/readSecret|localStorage|sessionStorage/.test(app));
assert(css.includes('.authority-strip') && css.includes('.dependency-box') && css.includes('.revoke-panel'));

const salt = Buffer.alloc(16, 1).toString('base64');
const key = Crypto.derive('long-test-passphrase', salt);
const blob = Crypto.encrypt(key, { x: 'secret' });
assert.deepEqual(Crypto.decrypt(key, blob), { x: 'secret' });
assert.equal(Crypto.secretState({ revoked: false, expiresAt: '2000-01-01T00:00:00.000Z' }), 'EXPIRED');
assert.equal(Permissions.stateOf(null, true, Date.now()), 'UNDECIDED');

console.log('PASS Secrets & Permissions - dependency separation, default deny, effective state, metadata-only secrets, typed revocation');
