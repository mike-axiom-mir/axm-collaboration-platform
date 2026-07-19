'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SCHEMA = 'axm.mirror.workshop-root-resolution/v1';
const DEFAULT_WINDOWS_ROOT = 'C:\\axm workshop';

function clean(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function configuredValue(configRoot) {
  const root = path.resolve(configRoot || path.resolve(__dirname, '..'));
  const local = readJson(path.join(root, 'config', 'mirror.config.local.json'));
  const example = readJson(path.join(root, 'config', 'mirror.config.example.json'));
  const localValue = clean(local && local.workshopRoot);
  if (localValue) return { value: localValue, source: 'config/mirror.config.local.json' };
  const exampleValue = clean(example && example.workshopRoot);
  return exampleValue ? { value: exampleValue, source: 'config/mirror.config.example.json' } : null;
}

function resolveWithEvidence(options = {}) {
  const environment = options.environment || process.env;
  const explicit = clean(options.workshopRoot);
  const fromEnvironment = clean(environment.AXM_WORKSHOP_ROOT);
  const suppliedConfig = clean(options.config && options.config.workshopRoot);
  const fromFile = configuredValue(options.configRoot);
  let candidate;
  let source;
  if (explicit) { candidate = explicit; source = 'explicit-option'; }
  else if (fromEnvironment) { candidate = fromEnvironment; source = 'AXM_WORKSHOP_ROOT'; }
  else if (suppliedConfig) { candidate = suppliedConfig; source = 'supplied-config'; }
  else if (fromFile) { candidate = fromFile.value; source = fromFile.source; }
  else if ((options.platform || process.platform) === 'win32') { candidate = DEFAULT_WINDOWS_ROOT; source = 'platform-default-windows'; }
  else { candidate = path.join(options.homeDirectory || os.homedir(), 'axm-workshop'); source = 'platform-default-posix-home'; }
  return { schema: SCHEMA, root: path.resolve(candidate), source };
}

function resolve(options = {}) {
  return resolveWithEvidence(options).root;
}

function inspect(options = {}) {
  const resolution = resolveWithEvidence(options);
  let directory = false;
  try { directory = fs.statSync(resolution.root).isDirectory(); } catch (_) {}
  return Object.assign({}, resolution, {
    state: directory ? 'WORKSHOP_AVAILABLE' : 'WORKSHOP_ABSENT',
    available: directory,
    reason: directory ? 'The resolved Workshop root exists as a directory.' : `The resolved Workshop root is absent: ${resolution.root}`
  });
}

module.exports = { SCHEMA, DEFAULT_WINDOWS_ROOT, configuredValue, resolveWithEvidence, resolve, inspect };
