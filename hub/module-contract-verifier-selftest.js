'use strict';
const V = require('./module-contract-verifier');
let pass = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); pass++; }
const manifest = { schema: V.MANIFEST_SCHEMA, id: 'studio', uses: ['storage', 'ai'], permissions: ['export'] };
const good = { schema: V.SCHEMA, id: 'studio', version: 'v1', provides: ['canvas'], consumes: ['identity'], permissions: ['export'], handoffs: { emits: [], accepts: [] }, boundaries: { refuses: ['silent-write'] } };
ok(V.validateContract(good, manifest).pass, 'valid declared contract accepted');
ok(!manifest.uses.includes('export'), 'modern permission need not be duplicated as a dependency');
ok(!V.validateContract(Object.assign({}, good, { id: 'other' }), manifest).pass, 'manifest id mismatch refused');
ok(!V.validateContract(Object.assign({}, good, { permissions: ['storage'] }), manifest).pass, 'dependency alone does not grant permission authority');
ok(!V.validateContract(good, Object.assign({}, manifest, { permissions: [] })).pass, 'contract permission absent from manifest permissions is refused');
ok(!V.validateContract(Object.assign({}, good, { permissions: [] }), manifest).pass, 'manifest permission absent from contract permissions is refused');
ok(!V.validateContract(Object.assign({}, good, { schema: 'future/v9' }), manifest).pass, 'unknown schema refused');
ok(V.validateContract(Object.assign({}, good, { lifecycle: { state_owner: 'browser', reload: 'resume', disconnect: 'not-applicable', cleanup: 'explicit' } }), manifest).pass, 'valid lifecycle seam declaration accepted');
ok(!V.validateContract(Object.assign({}, good, { lifecycle: { state_owner: 'browser', reload: 'magic', disconnect: 'not-applicable', cleanup: 'explicit' } }), manifest).pass, 'invalid lifecycle seam declaration refused');
const legacyManifest = { id: 'studio', uses: ['storage'] };
const legacyContract = Object.assign({}, good, { permissions: ['storage'] });
ok(V.validateContract(legacyContract, legacyManifest).pass, 'unversioned legacy uses-based authority remains readable until migration');
console.log('PASS module contract verifier: ' + pass + ' assertions');
