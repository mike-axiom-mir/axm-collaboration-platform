#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const runtime = path.join(root, 'runtime');

function candidate(command, prefix, source) {
  return { command, prefix: prefix || [], source };
}

function pythonCandidates(environment) {
  const env = environment || process.env;
  const rows = [];
  if (env.AXM_PYTHON) rows.push(candidate(env.AXM_PYTHON, [], 'AXM_PYTHON'));
  if (env.PYTHON) rows.push(candidate(env.PYTHON, [], 'PYTHON'));

  rows.push(candidate(
    path.join(root, '..', '..', 'runtime', 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3'),
    [],
    'workshop-runtime'
  ));

  if (process.platform === 'win32' && env.USERPROFILE) {
    rows.push(candidate(
      path.join(env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe'),
      [],
      'codex-runtime'
    ));
  }

  rows.push(candidate(process.platform === 'win32' ? 'python.exe' : 'python3', [], 'PATH'));
  if (process.platform === 'win32') rows.push(candidate('py.exe', ['-3'], 'Python launcher'));

  const seen = new Set();
  return rows.filter(row => {
    const key = row.command + '\0' + row.prefix.join('\0');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function probePython(row) {
  if (path.isAbsolute(row.command) && !fs.existsSync(row.command)) return null;
  const probe = childProcess.spawnSync(row.command, row.prefix.concat(['--version']), {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: 5000
  });
  if (probe.error || probe.status !== 0) return null;
  const version = String(probe.stdout || probe.stderr || '').trim();
  return /^Python 3\.(?:1\d|\d)(?:\.|$)/.test(version)
    ? Object.assign({}, row, { version })
    : null;
}

function findPython(environment) {
  for (const row of pythonCandidates(environment)) {
    const found = probePython(row);
    if (found) return found;
  }
  return null;
}

function pythonEnvironment(environment) {
  return Object.assign({}, environment || process.env, {
    PYTHONDONTWRITEBYTECODE: '1',
    PYTHONUTF8: '1',
    PYTHONPATH: runtime
  });
}

function run(argv, options) {
  options = options || {};
  const found = options.python || findPython(options.environment);
  if (!found) {
    process.stderr.write(
      'AXM Text Fabric needs Python 3.10 or newer for the CLI. ' +
      'Set AXM_PYTHON to an explicit executable path.\n'
    );
    return 2;
  }
  if (!Array.isArray(argv) || argv.length === 0) {
    process.stderr.write('Usage: npm run text-fabric -- <command> [arguments]\n');
    return 2;
  }
  const result = childProcess.spawnSync(
    found.command,
    found.prefix.concat(['-B', '-m', 'axm_text_fabric.cli']).concat(argv),
    {
      cwd: runtime,
      env: pythonEnvironment(options.environment),
      stdio: options.stdio || 'inherit',
      encoding: options.stdio ? undefined : 'utf8',
      windowsHide: true,
      shell: false
    }
  );
  if (result.error) {
    process.stderr.write('AXM Text Fabric CLI failed to start: ' + result.error.message + '\n');
    return 2;
  }
  return Number.isInteger(result.status) ? result.status : 2;
}

if (require.main === module) process.exitCode = run(process.argv.slice(2));

module.exports = {
  findPython,
  pythonCandidates,
  pythonEnvironment,
  probePython,
  run,
  runtime
};
