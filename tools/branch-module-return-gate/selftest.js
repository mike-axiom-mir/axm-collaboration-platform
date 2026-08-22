'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Gate = require('./return-gate-core');
const ModularIntake = require('../../shared/modular-intake/modular-intake-service');

function json(value) { return JSON.stringify(value, null, 2) + '\n'; }

function baseFixture() {
  const manifest = {
    schema: 'axm.tool-manifest/v1',
    kind: 'tool',
    id: 'portable-proof-module',
    name: 'Portable proof module',
    version: 'v0.1',
    status: 'TEST',
    entry: 'app.js',
    contract: 'module.contract.json',
    uses: ['storage'],
    permissions: ['storage']
  };
  const contract = {
    schema: 'axm.module-contract/v1',
    id: 'portable-proof-module',
    version: 'v0.1',
    provides: ['portable-proof.result'],
    consumes: ['storage'],
    permissions: ['storage'],
    handoffs: { emits: ['portable-proof.result'], accepts: ['portable-proof.request'] },
    lifecycle: { state_owner: 'caller', reload: 'restart', disconnect: 'not-applicable', cleanup: 'explicit' }
  };
  const declaration = {
    schema: 'axm.branch-module-return/v1',
    module: { id: manifest.id, version: manifest.version, title: manifest.name, summary: 'A deterministic fixture proving the branch return route.' },
    source: { project: 'selftest-branch', repository: null, branch: 'test/portable-proof', commit: 'fixture-001' },
    selection: { files: ['app.js', 'axm-branch-return.json', 'manifest.json', 'module.contract.json', 'selftest.js'] },
    portability: {
      target: 'axm-workshop-dependency-free',
      branchRuntimeRequired: false,
      networkRequired: false,
      packageManagerRequired: false,
      hostCommandsRequired: false,
      externalPackages: [],
      remoteServices: [],
      nativeComponents: [],
      hostCommands: [],
      absolutePaths: [],
      workshopCapabilities: ['storage'],
      permissions: ['storage']
    },
    verification: { selftest: 'selftest.js' },
    requiredSeats: 'dual'
  };
  return {
    declaration,
    files: {
      'manifest.json': json(manifest),
      'module.contract.json': json(contract),
      'app.js': "'use strict';\nconst path = require('path');\nmodule.exports = value => path.basename(String(value));\n",
      'selftest.js': "'use strict';\nglobalThis.__axmBranchCandidateExecuted = true;\n"
    }
  };
}

function createFixture(parent, name, mutate) {
  const root = path.join(parent, name);
  fs.mkdirSync(root, { recursive: true });
  const fixture = baseFixture();
  if (mutate) mutate(fixture);
  fixture.files['axm-branch-return.json'] = json(fixture.declaration);
  Object.keys(fixture.files).sort().forEach(relative => {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, fixture.files[relative], 'utf8');
  });
  return root;
}

function expectHeld(root, pattern) {
  const report = Gate.inspectSource(root);
  assert.strictEqual(report.pass, false, 'fixture should be held');
  assert.match(report.findings.errors.join('\n'), pattern);
  assert.strictEqual(report.truth.candidateCodeExecuted, false);
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function run() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-branch-return-'));
  const checks = [];
  try {
    delete globalThis.__axmBranchCandidateExecuted;
    const validRoot = createFixture(temp, 'valid');
    const firstInspection = Gate.inspectSource(validRoot);
    assert.strictEqual(firstInspection.status, 'READY_FOR_GOVERNED_INTAKE');
    assert.strictEqual(firstInspection.pass, true);
    assert.strictEqual(firstInspection.truth.candidateCodeExecuted, false);
    assert.strictEqual(globalThis.__axmBranchCandidateExecuted, undefined, 'candidate self-test must not execute during inspection');
    checks.push('valid candidate passes structural portability without code execution');

    const first = Gate.buildPackage(validRoot);
    const second = Gate.buildPackage(validRoot);
    assert.strictEqual(JSON.stringify(first.package), JSON.stringify(second.package), 'identical input must produce identical package bytes');
    assert.strictEqual(first.receipt.packageDigest, second.receipt.packageDigest, 'identical input must produce identical package digest');
    assert.strictEqual(first.receipt.authority.installed, false);
    assert.strictEqual(first.receipt.authority.promoted, false);
    checks.push('repeated builds are byte-stable and authority remains false');

    const verified = Gate.verifyPackage(first.package, first.receipt);
    assert.strictEqual(verified.pass, true, verified.errors.join('; '));
    checks.push('package and receipt digests verify');

    const intake = ModularIntake.create({
      root: path.resolve(__dirname, '..', '..'),
      stateRoot: path.join(temp, 'intake-state'),
      reviewService: {},
      installerService: {}
    });
    const compatibility = intake.inspect(first.package);
    assert.strictEqual(compatibility.pass, true, compatibility.errors.join('; '));
    assert.strictEqual(compatibility.status, 'COMPATIBLE_CONTRACT');
    assert.strictEqual(compatibility.packageDigest, first.receipt.packageDigest);
    checks.push('real shared/modular-intake service accepts the exact digest as a module contract');

    expectHeld(createFixture(temp, 'external-package', fixture => {
      fixture.declaration.selection.files.push('package.json');
      fixture.files['package.json'] = json({ dependencies: { lodash: '^4.17.21' } });
    }), /dependencies must be empty/);
    checks.push('external package dependency is refused');

    expectHeld(createFixture(temp, 'remote-runtime', fixture => {
      fixture.files['app.js'] = "fetch('https://example.invalid/runtime');\n";
    }), /remote runtime URL/);
    checks.push('remote runtime URL is refused');

    expectHeld(createFixture(temp, 'missing-import', fixture => {
      fixture.files['app.js'] = "module.exports = require('./not-selected');\n";
    }), /missing or escaping local import/);
    checks.push('missing local resource is refused');

    expectHeld(createFixture(temp, 'canon', fixture => {
      const manifest = JSON.parse(fixture.files['manifest.json']);
      manifest.status = 'CANON';
      fixture.files['manifest.json'] = json(manifest);
    }), /CANON material cannot cross/);
    checks.push('branch CANON claim is refused');

    expectHeld(createFixture(temp, 'branch-runtime', fixture => {
      fixture.declaration.portability.branchRuntimeRequired = true;
    }), /branchRuntimeRequired must be false/);
    checks.push('branch runtime dependency is refused');

    expectHeld(createFixture(temp, 'undeclared-file', fixture => {
      fixture.files['hidden-helper.js'] = 'module.exports = 1;\n';
    }), /undeclared file is refused/);
    checks.push('undeclared files are refused');

    const tampered = clone(first.package);
    tampered.files[0].content += 'AA==';
    const tamperCheck = Gate.verifyPackage(tampered, first.receipt);
    assert.strictEqual(tamperCheck.pass, false);
    assert.match(tamperCheck.errors.join('\n'), /digest mismatch/);
    checks.push('content tampering is detected');

    const traversal = clone(first.package);
    traversal.files[0].path = '../outside.js';
    assert.strictEqual(Gate.verifyPackage(traversal, null).pass, false);
    checks.push('path traversal is refused');

    const duplicate = clone(first.package);
    duplicate.files.push(clone(duplicate.files[0]));
    assert.strictEqual(Gate.verifyPackage(duplicate, null).pass, false);
    checks.push('duplicate package paths are refused');

    assert.strictEqual(globalThis.__axmBranchCandidateExecuted, undefined, 'candidate code must remain unexecuted after all tests');
    return {
      schema: 'axm.branch-return-selftest/v1',
      pass: true,
      checks,
      compatibility: { service: 'shared/modular-intake', status: compatibility.status, packageDigest: compatibility.packageDigest },
      authority: { staged: false, installed: false, promoted: false, candidateCodeExecuted: false }
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

try { process.stdout.write(json(run())); }
catch (error) {
  process.stderr.write((error.stack || error.message) + '\n');
  process.exitCode = 1;
}

