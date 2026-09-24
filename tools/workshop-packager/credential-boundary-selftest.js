#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Planner = require('./package-planner');

const dir = __dirname;
const policy = JSON.parse(fs.readFileSync(path.join(dir, 'public-safety-policy.json'), 'utf8'));
const publicPackager = fs.readFileSync(path.join(dir, 'package-workshop.ps1'), 'utf8');

assert.equal(policy.schema, 'axm.workshop-public-safety-policy/v1');
assert(policy.always_private_filenames.length > 0);
assert(publicPackager.includes("$PublicSafetyPolicyPath = Join-Path $ToolDir 'public-safety-policy.json'"));
assert(publicPackager.includes('$alwaysPrivateFileNames -contains $_.Name.ToLowerInvariant()'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-packager-credential-boundary-'));
try {
  const scope = path.join(root, 'tools', 'demo', 'nested');
  fs.mkdirSync(scope, { recursive: true });
  fs.writeFileSync(path.join(scope, 'public.txt'), 'public fixture\n');
  for (const name of policy.always_private_filenames) {
    fs.writeFileSync(
      path.join(scope, name),
      'opaque-local-credential-without-a-provider-specific-pattern\n'
    );
  }

  const planned = Planner.collectFiles(root, ['tools/demo']);
  assert(planned.files.has('tools/demo/nested/public.txt'), 'ordinary public file must remain packageable');
  for (const name of policy.always_private_filenames) {
    const relative = 'tools/demo/nested/' + name;
    assert(!planned.files.has(relative), relative + ' must never enter a public-safe plan');
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(
  'PASS Workshop Packager credential boundary - ' +
  policy.always_private_filenames.length +
  ' always-private credential filenames excluded'
);
