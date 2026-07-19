'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Inventory = require('./foundation-public-source-inventory-cell');

const CELL_ID = 'axm.mirror.foundation-public-body-integrity-cell/v1';
const INTEGRITY_SCHEMA = 'axm.mirror.foundation-public-body-integrity/v1';
const PASS_STATE = 'PASS_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY';
const HOLD_STATE = 'HOLD_BOUNDED_PUBLIC_BODY_STRUCTURAL_INTEGRITY';
const MODULE_SCHEMA = 'axm.ai-native-module/v1';
const TEST_PATTERN = /(^|\/)tests\/.*\.test\.(?:c?js|mjs)$/;
const ACTIVE_ORGAN_PATTERN = /^organs\/[^/]+-organ\.js$/;

function stable(value) { return Inventory.stable(value); }
function digest(value) { return Inventory.digest(value); }
function forward(value) { return String(value).replace(/\\/g, '/'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function byteDigest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function bounded(root, relative) {
  const base = path.resolve(root);
  const target = path.resolve(base, relative);
  const prefix = base.endsWith(path.sep) ? base : `${base}${path.sep}`;
  if (target === base || !target.startsWith(prefix)) throw new Error(`public body path escaped root: ${relative}`);
  return target;
}

function sourceMap(inventory) {
  return new Map(inventory.files.map(item => [item.path, item]));
}

function readBound(root, record) {
  const absolute = bounded(root, record.path);
  const before = fs.lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.size !== record.bytes) throw new Error(`public body source boundary changed: ${record.path}`);
  const bytes = fs.readFileSync(absolute);
  const after = fs.lstatSync(absolute);
  if (!after.isFile() || after.isSymbolicLink() || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error(`public body source changed during inspection: ${record.path}`);
  if (bytes.length !== record.bytes || byteDigest(bytes) !== record.sha256) throw new Error(`public body source seal changed: ${record.path}`);
  return bytes.toString('utf8');
}

function hold(holds, code, file, detail) {
  holds.push({ code, path: file || null, detail: String(detail || code).slice(0, 500) });
}

function resolveRequire(from, specifier, files) {
  if (!specifier.startsWith('.')) return null;
  const raw = forward(path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier)));
  if (raw === '..' || raw.startsWith('../') || raw.startsWith('/')) return null;
  const candidates = [raw, `${raw}.js`, `${raw}.cjs`, `${raw}.mjs`, `${raw}/index.js`, `${raw}/index.cjs`, `${raw}/index.mjs`];
  return candidates.find(item => files.has(item)) || null;
}

function identifierCharacter(value) { return !!value && /[A-Za-z0-9_$]/.test(value); }

function staticRequires(source) {
  const found = [];
  let index = 0;
  function skipQuoted(quote) {
    index += 1;
    while (index < source.length) {
      if (source[index] === '\\') { index += 2; continue; }
      if (source[index] === quote) { index += 1; return; }
      index += 1;
    }
  }
  while (index < source.length) {
    const character = source[index];
    if (character === '/' && source[index + 1] === '/') {
      index += 2;
      while (index < source.length && !/[\r\n]/.test(source[index])) index += 1;
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index = Math.min(source.length, index + 2);
      continue;
    }
    if (character === "'" || character === '"' || character === '`') { skipQuoted(character); continue; }
    if (source.startsWith('require', index) && !identifierCharacter(source[index - 1]) && !identifierCharacter(source[index + 7])) {
      let cursor = index + 7;
      while (/\s/.test(source[cursor] || '')) cursor += 1;
      if (source[cursor] !== '(') { index += 7; continue; }
      cursor += 1;
      while (/\s/.test(source[cursor] || '')) cursor += 1;
      const quote = source[cursor];
      if (quote !== "'" && quote !== '"') { index += 7; continue; }
      cursor += 1;
      let specifier = '';
      let valid = true;
      while (cursor < source.length && source[cursor] !== quote) {
        if (source[cursor] === '\\' || /[\r\n]/.test(source[cursor])) { valid = false; break; }
        specifier += source[cursor];
        cursor += 1;
      }
      if (!valid || source[cursor] !== quote) { index += 7; continue; }
      cursor += 1;
      while (/\s/.test(source[cursor] || '')) cursor += 1;
      if (source[cursor] === ')') found.push(specifier);
      index = cursor + 1;
      continue;
    }
    index += 1;
  }
  return Array.from(new Set(found)).sort();
}

function javascriptCoverage(root, inventory, holds) {
  const files = sourceMap(inventory);
  const javascript = inventory.files.filter(item => /\.(?:c?js|mjs)$/.test(item.path));
  const dependencies = new Map();
  const syntaxChecked = [];
  const esmHeld = [];
  for (const record of javascript) {
    const source = readBound(root, record);
    if (record.path.endsWith('.mjs')) {
      esmHeld.push(record.path);
      hold(holds, 'ESM_SYNTAX_EVALUATOR_UNAVAILABLE', record.path, 'Node runtime exposes no non-executing SourceTextModule parser');
    } else {
      try {
        const compilable = source.startsWith('#!') ? source.replace(/^#![^\r\n]*(?:\r?\n|$)/, '') : source;
        new vm.Script(compilable, { filename: record.path, displayErrors: false });
        syntaxChecked.push(record.path);
      } catch (error) {
        hold(holds, 'JAVASCRIPT_SYNTAX_INVALID', record.path, error && error.name || 'SyntaxError');
      }
    }
    const found = [];
    for (const specifier of staticRequires(source)) {
      const target = resolveRequire(record.path, specifier, files);
      if (target && !found.includes(target)) found.push(target);
    }
    dependencies.set(record.path, found.sort());
  }
  const tests = javascript.map(item => item.path).filter(item => TEST_PATTERN.test(item)).sort();
  const activeOrgans = javascript.map(item => item.path).filter(item => ACTIVE_ORGAN_PATTERN.test(item) && !item.includes('known-fail')).sort();
  const reachableByTest = new Map(activeOrgans.map(item => [item, []]));
  for (const test of tests) {
    const pending = [test];
    const seen = new Set();
    while (pending.length) {
      const current = pending.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      if (reachableByTest.has(current)) reachableByTest.get(current).push(test);
      for (const dependency of dependencies.get(current) || []) pending.push(dependency);
    }
  }
  const organTestReachability = activeOrgans.map(organPath => {
    const witnesses = Array.from(new Set(reachableByTest.get(organPath))).sort();
    if (!witnesses.length) hold(holds, 'ACTIVE_ORGAN_HAS_NO_STATIC_TEST_REACHABILITY_WITNESS', organPath, 'No public test has an exact relative require path to this organ');
    return { path: organPath, testWitnesses: witnesses };
  });
  return { syntaxChecked: syntaxChecked.sort(), esmHeld: esmHeld.sort(), organTestReachability };
}

function jsonCoverage(root, inventory, holds) {
  const parsed = new Map();
  const jsonFiles = inventory.files.filter(item => item.path.endsWith('.json'));
  for (const record of jsonFiles) {
    try { parsed.set(record.path, JSON.parse(readBound(root, record))); }
    catch (error) { hold(holds, 'JSON_PARSE_INVALID', record.path, error && error.name || 'SyntaxError'); }
  }
  const contractSchemas = [];
  const ids = new Map();
  for (const record of jsonFiles.filter(item => /^contracts\/[^/]+\.schema\.json$/.test(item.path))) {
    const document = parsed.get(record.path);
    if (!document || typeof document !== 'object' || Array.isArray(document)) continue;
    const schemaId = typeof document.$id === 'string' ? document.$id : null;
    const schemaDialect = typeof document.$schema === 'string' ? document.$schema : null;
    const closedRoot = Object.prototype.hasOwnProperty.call(document, 'additionalProperties');
    const knownFail = document['x-axm-status'] === 'KNOWN_FAIL';
    const supersededBy = typeof document['x-axm-superseded-by'] === 'string' ? document['x-axm-superseded-by'] : null;
    if (!schemaId) hold(holds, 'CONTRACT_SCHEMA_ID_MISSING', record.path, '$id is absent');
    if (!schemaDialect) hold(holds, 'CONTRACT_SCHEMA_DIALECT_MISSING', record.path, '$schema is absent');
    if (document.type !== 'object') hold(holds, 'CONTRACT_SCHEMA_ROOT_NOT_OBJECT', record.path, 'root type is not object');
    if (knownFail && (!supersededBy || !parsed.has(supersededBy))) hold(holds, 'KNOWN_FAIL_CONTRACT_SUPERSESSION_MISSING', record.path, supersededBy || 'superseding path absent');
    if (!closedRoot && !knownFail) hold(holds, 'CONTRACT_SCHEMA_ROOT_CLOSURE_UNDECLARED', record.path, 'root additionalProperties is undeclared');
    if (schemaId) {
      if (ids.has(schemaId)) hold(holds, 'DUPLICATE_CONTRACT_SCHEMA_ID', record.path, `also declared by ${ids.get(schemaId)}`);
      else ids.set(schemaId, record.path);
    }
    contractSchemas.push({ path: record.path, id: schemaId, dialect: schemaDialect, rootAdditionalPropertiesDeclared: closedRoot, knownFail, supersededBy });
  }
  return { parsed, paths: Array.from(parsed.keys()).sort(), contractSchemas: contractSchemas.sort((a, b) => a.path.localeCompare(b.path)) };
}

function moduleCoverage(inventory, parsed, holds) {
  const files = sourceMap(inventory);
  const manifests = inventory.files.filter(item => /^modules\/[^/]+\/manifest\.json$/.test(item.path)).sort((a, b) => a.path.localeCompare(b.path));
  return manifests.map(record => {
    const document = parsed.get(record.path);
    const directory = path.posix.dirname(record.path);
    const directoryId = path.posix.basename(directory);
    const entry = document && typeof document.entry === 'string' ? forward(path.posix.normalize(path.posix.join(directory, document.entry))) : null;
    const contractPath = `${directory}/module.contract.json`;
    const contract = parsed.get(contractPath);
    if (!document) return { path: record.path, moduleId: null, entry: null, contractPath, state: 'HOLD_INVALID_MANIFEST_JSON' };
    if (document.schema !== MODULE_SCHEMA) hold(holds, 'MODULE_MANIFEST_SCHEMA_INVALID', record.path, `expected ${MODULE_SCHEMA}`);
    if (typeof document.id !== 'string' || document.id !== directoryId) hold(holds, 'MODULE_MANIFEST_ID_DIRECTORY_MISMATCH', record.path, `expected ${directoryId}`);
    if (!entry || entry === directory || !entry.startsWith(`${directory}/`) || !files.has(entry)) hold(holds, 'MODULE_ENTRY_MISSING_OR_OUTSIDE_MODULE', record.path, document.entry || 'entry absent');
    if (!files.has(contractPath) || !contract) hold(holds, 'MODULE_COMPANION_CONTRACT_MISSING', record.path, contractPath);
    else if (contract.id !== document.id) hold(holds, 'MODULE_CONTRACT_ID_MISMATCH', contractPath, `expected ${document.id}`);
    return { path: record.path, moduleId: document.id || null, entry, contractPath, state: 'STATIC_DECLARATION_WITNESS_NOT_RUNTIME_READINESS' };
  });
}

function inspect(root, suppliedInventory) {
  const absoluteRoot = path.resolve(root);
  const inventory = suppliedInventory ? clone(suppliedInventory) : Inventory.collect(absoluteRoot);
  Inventory.verify(inventory, absoluteRoot);
  const holds = [];
  const javascript = javascriptCoverage(absoluteRoot, inventory, holds);
  const json = jsonCoverage(absoluteRoot, inventory, holds);
  const modules = moduleCoverage(inventory, json.parsed, holds);
  holds.sort((a, b) => a.code.localeCompare(b.code) || String(a.path).localeCompare(String(b.path)));
  const unparsed = {};
  for (const record of inventory.files) {
    const extension = path.posix.extname(record.path) || '(none)';
    if (!/\.(?:c?js|mjs|json)$/.test(record.path)) unparsed[extension] = (unparsed[extension] || 0) + 1;
  }
  const report = {
    schema: INTEGRITY_SCHEMA,
    digest: null,
    cell: { id: CELL_ID, learnedWeights: false, sourceExecutionAuthority: false, repairAuthority: false },
    identity: 'axm.machine.mirror/seed-0',
    state: holds.length ? HOLD_STATE : PASS_STATE,
    source: { inventorySchema: inventory.schema, inventoryDigest: inventory.digest, publicFiles: inventory.summary.files, publicBytes: inventory.summary.totalBytes },
    coverage: {
      javascriptSyntaxChecked: javascript.syntaxChecked,
      esmSyntaxHeld: javascript.esmHeld,
      jsonParsed: json.paths,
      contractSchemas: json.contractSchemas,
      modules,
      activeOrganTestReachability: javascript.organTestReachability,
      staticRequireReachabilityClaim: 'STATIC_EXACT_RELATIVE_REQUIRE_WITNESS_NOT_TEST_EXECUTION_OR_BEHAVIORAL_CORRECTNESS',
      unparsedExtensions: Object.keys(unparsed).sort().map(extension => ({ extension, files: unparsed[extension] }))
    },
    holds,
    summary: {
      javascriptSyntaxChecked: javascript.syntaxChecked.length,
      esmSyntaxHeld: javascript.esmHeld.length,
      jsonParsed: json.paths.length,
      contractSchemasChecked: json.contractSchemas.length,
      knownFailContractSchemasPreserved: json.contractSchemas.filter(item => item.knownFail).length,
      moduleManifestsChecked: modules.length,
      activeOrgansChecked: javascript.organTestReachability.length,
      activeOrgansWithTestReachability: javascript.organTestReachability.filter(item => item.testWitnesses.length).length,
      holds: holds.length,
      sourceExecutions: 0,
      repairs: 0
    },
    authority: { sourceExecution: false, capabilityClaim: false, correctnessClaim: false, repair: false, permissionGrant: false, trainingAdmission: false, runtimePromotion: false, canonChange: false, worldAction: false },
    boundary: 'This report proves bounded current-source structural parsing, schema declaration shape, module reference presence, and static test-require reachability only. It does not execute source or tests, prove behavior or capability, select repairs, grant permission, train, promote, change canon, or act.'
  };
  report.digest = digest(Object.assign({}, report, { digest: null }));
  return stable(report);
}

function verify(report, root, suppliedInventory) {
  if (!report || report.schema !== INTEGRITY_SCHEMA || report.digest !== digest(Object.assign({}, report, { digest: null }))) throw new Error('foundation public body integrity digest changed');
  if (Object.values(report.authority || {}).some(Boolean) || report.cell.sourceExecutionAuthority !== false || report.cell.repairAuthority !== false) throw new Error('foundation public body integrity authority changed');
  const current = inspect(root, suppliedInventory);
  if (JSON.stringify(current) !== JSON.stringify(stable(report))) throw new Error('foundation public body integrity evidence changed');
  return true;
}

module.exports = { CELL_ID, INTEGRITY_SCHEMA, PASS_STATE, HOLD_STATE, MODULE_SCHEMA, stable, digest, staticRequires, inspect, verify };
