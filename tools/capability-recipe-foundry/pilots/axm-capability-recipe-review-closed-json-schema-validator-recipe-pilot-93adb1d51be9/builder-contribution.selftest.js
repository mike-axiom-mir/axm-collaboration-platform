'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const builder = require('./builder-contribution.js');
const parameters = {
  inputSchemaId: 'axm.example.schema-validation-subject/v1',
  resultSchemaId: 'axm.schema-validation-result/v1',
  maxInputBytes: 4096,
  schema: { type: 'object', additionalProperties: false, required: ['name','attempts','enabled'], properties: { name: { type: 'string', minLength: 1, maxLength: 80 }, attempts: { type: 'integer', minimum: 0, maximum: 10 }, enabled: { type: 'boolean' } } }
};
const first = builder.build(parameters);
const second = builder.build(parameters);
assert.strictEqual(builder.id, 'closed-json-schema-validator-v1');
assert.deepStrictEqual(first, second);
assert.deepStrictEqual(first.provides, [parameters.resultSchemaId]);
assert.deepStrictEqual(first.consumes, [parameters.inputSchemaId]);
new Function(first.source);
new Function(first.selftest);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-schema-validator-builder-test-'));
try {
  fs.writeFileSync(path.join(root, 'capability.js'), first.source, { flag: 'wx' });
  fs.writeFileSync(path.join(root, 'selftest.js'), first.selftest, { flag: 'wx' });
  const run = childProcess.spawnSync(process.execPath, [path.join(root, 'selftest.js')], { encoding: 'utf8', timeout: 5000 });
  assert.strictEqual(run.status, 0, run.stderr);
  assert.match(run.stdout, /PASS/);
} finally {
  const resolved = path.resolve(root);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('axm-schema-validator-builder-test-')) throw new Error('temporary cleanup boundary refused');
  fs.rmSync(resolved, { recursive: true, force: true });
}
process.stdout.write('closed JSON schema validator builder contribution selftest PASS\n');
