'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, 'Start-AxmSurface.ps1');
const script = fs.readFileSync(scriptPath, 'utf8');

assert.match(script, /function Test-ExpectedService\s*\{/);
assert.match(script, /Invoke-RestMethod[^\r\n]+127\.0\.0\.1/);
assert.match(script, /-HealthPath '\/api\/health' -HealthProperty 'body' -HealthValue 'axm-workshop'/);
assert.match(script, /-HealthPath '\/health' -HealthProperty 'name' -HealthValue 'AXM Game Hub'/);
assert.doesNotMatch(script, /if \(Test-LocalPort \$Port\) \{ return \}/);
assert.match(script, /port \$Port belongs to a different or stale service/);

console.log('start-axm-surface selftest: PASS');
