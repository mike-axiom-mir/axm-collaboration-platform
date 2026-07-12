'use strict';
const V = require('./module-contract-verifier');
let pass = 0;
function ok(value, label) { if (!value) throw new Error('FAIL: ' + label); pass++; }
const manifest = { id: 'studio', uses: ['storage', 'ai'] };
const good = { schema: V.SCHEMA, id: 'studio', version: 'v1', provides: ['canvas'], consumes: ['identity'], permissions: ['storage'], handoffs: { emits: [], accepts: [] }, boundaries: { refuses: ['silent-write'] } };
ok(V.validateContract(good, manifest).pass, 'valid declared contract accepted');
ok(!V.validateContract(Object.assign({}, good, { id: 'other' }), manifest).pass, 'manifest id mismatch refused');
ok(!V.validateContract(Object.assign({}, good, { permissions: ['network'] }), manifest).pass, 'undeclared permission refused');
ok(!V.validateContract(Object.assign({}, good, { schema: 'future/v9' }), manifest).pass, 'unknown schema refused');
console.log('PASS module contract verifier: ' + pass + ' assertions');
