'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const PublicProofBatch1 = require('./public-proof-batch1/public-proof-batch1-service');
const PublicProofIntake = require('./public-proof-intake/public-proof-intake-service');

const SCHEMA = 'axm.verification-proof-service/v1';
const CALLABLE_INPUT = /\b(callable|predicate|executor|implementation_step)\b/i;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function clean(value, limit) {
  return String(value == null ? '' : value).trim().slice(0, limit || 400);
}

function pythonCommand() {
  return clean(process.env.AXM_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), 260);
}

function create(options) {
  const root = path.resolve(options && options.root || path.join(__dirname, '..', '..'));
  const intakeRoot = path.resolve(options && options.intakeRoot || path.join(root, 'intakes', 'verification-proof-99-v0.1'));
  const modulesRoot = path.join(intakeRoot, 'modules');
  const cliPath = path.resolve(options && options.cliPath || path.join(root, 'tools', 'verification-proof-lab', 'verification-cli.py'));
  const publicProofBatch1 = PublicProofBatch1.create({ root });
  const publicProofIntake = PublicProofIntake.create({ root });

  function modules() {
    if (!fs.existsSync(modulesRoot)) throw new Error('curated verification intake is missing');
    return fs.readdirSync(modulesRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const moduleRoot = path.join(modulesRoot, entry.name);
        const status = readJson(path.join(moduleRoot, 'STATUS.json'));
        const contract = readJson(path.join(moduleRoot, 'module.contract.json'));
        const intake = readJson(path.join(moduleRoot, 'INTERFACE.json'));
        const sideEffects = clean(intake.side_effects, 300);
        const requiresInProcessAdapter = CALLABLE_INPUT.test(clean(intake.input_contract, 1000));
        const memoryOnly = sideEffects.toLowerCase().startsWith('none');
        return {
          id: entry.name,
          seed: Number(status.source_seed),
          name: clean(status.source_seed_name || entry.name, 160),
          family: clean(status.family, 180),
          purpose: clean(contract.purpose, 600),
          operation: clean(intake.operation, 100),
          primarySymbol: clean(intake.primary_symbol, 160),
          symbolKind: clean(intake.symbol_kind, 40),
          inputContract: clean(intake.input_contract, 1000),
          outputSchema: clean(intake.output_schema_version, 180),
          sideEffects,
          referenceTests: Number(status.reference_test_count),
          status: 'TEST_HOLD',
          apiExecutable: memoryOnly && !requiresInProcessAdapter,
          holdReason: !memoryOnly
            ? 'CALLER_PATH_WRITE_REQUIRES_SEPARATE_AUTHORITY'
            : requiresInProcessAdapter
              ? 'CALLABLE_INPUT_REQUIRES_IN_PROCESS_ADAPTER'
              : null,
          contractUrl: '/intakes/verification-proof-99-v0.1/modules/' + encodeURIComponent(entry.name) + '/module.contract.json',
          intakeUrl: '/intakes/verification-proof-99-v0.1/modules/' + encodeURIComponent(entry.name) + '/INTAKE.md'
        };
      })
      .sort((left, right) => left.seed - right.seed);
  }

  function catalog() {
    const rows = modules();
    return {
      ok: true,
      schema: 'axm.verification-proof-runtime-catalog/v1',
      status: 'TEST_HOLD',
      canon: false,
      authority: 'NONE',
      moduleCount: rows.length,
      apiExecutableCount: rows.filter(row => row.apiExecutable).length,
      guardedCount: rows.filter(row => !row.apiExecutable).length,
      sourceHeldCount: 1,
      sourceHeldModule: 'axm.verify.clock-timezone-locale-controller',
      modules: rows,
      truth: {
        executionIsApproval: false,
        executionIsNativeProof: false,
        inputEvidenceReverified: false,
        writesAllowed: false
      }
    };
  }

  function run(input) {
    return new Promise((resolve, reject) => {
      const request = input && typeof input === 'object' ? input : {};
      const moduleId = clean(request.moduleId, 180);
      const selected = modules().find(row => row.id === moduleId);
      if (!selected) return reject(new Error('unknown verification organ'));
      if (!selected.apiExecutable) return reject(new Error(selected.holdReason || 'organ is not API executable'));
      const envelope = request.envelope && typeof request.envelope === 'object' && !Array.isArray(request.envelope)
        ? request.envelope
        : {};
      const encoded = JSON.stringify(envelope);
      if (Buffer.byteLength(encoded, 'utf8') > 200000) return reject(new Error('verification call envelope is too large'));

      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(value);
      };
      const child = childProcess.spawn(pythonCommand(), [cliPath, '--run', moduleId, '--input', '-'], {
        cwd: path.dirname(cliPath),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: Object.assign({}, process.env, {
          PYTHONDONTWRITEBYTECODE: '1',
          PYTHONNOUSERSITE: '1'
        })
      });
      const timer = setTimeout(() => {
        child.kill();
        finish(new Error('verification organ timed out'));
      }, 12000);
      child.on('error', error => finish(new Error('Python runtime unavailable: ' + clean(error.message, 240))));
      child.stdout.on('data', chunk => {
        stdout += chunk;
        if (Buffer.byteLength(stdout, 'utf8') > 1024 * 1024) {
          child.kill();
          finish(new Error('verification result exceeded one megabyte'));
        }
      });
      child.stderr.on('data', chunk => {
        stderr += chunk;
        if (Buffer.byteLength(stderr, 'utf8') > 256 * 1024) {
          child.kill();
          finish(new Error('verification error output exceeded its bound'));
        }
      });
      child.on('close', code => {
        if (settled) return;
        if (code !== 0) return finish(new Error(clean(stderr || stdout || ('organ exited ' + code), 1000)));
        try {
          const result = JSON.parse(stdout);
          finish(null, Object.assign({ ok: true, serviceSchema: SCHEMA }, result));
        } catch (error) {
          finish(new Error('verification organ returned invalid JSON'));
        }
      });
      child.stdin.on('error', error => finish(error));
      child.stdin.end(encoded);
    });
  }

  return {
    catalog,
    modules,
    run,
    publicProofBatch1Catalog: publicProofBatch1.catalog,
    validatePublicProofBatch1: publicProofBatch1.validate,
    selftestPublicProofBatch1: publicProofBatch1.selftest,
    publicProofIntakeCatalog: publicProofIntake.catalog,
    validatePublicProofIntake: publicProofIntake.validate,
    selftestPublicProofIntake: publicProofIntake.selftest,
    schema: SCHEMA
  };
}

module.exports = { create, SCHEMA };
