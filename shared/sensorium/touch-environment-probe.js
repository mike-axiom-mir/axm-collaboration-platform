'use strict';

const fs = require('fs');
const path = require('path');
const C = require('./core');
const CAPABILITY = 'sense.environment.touch/v1';
const RECEIPT_SCHEMA = 'axm.touch-environment-probe/v1';

function defaultAdapter() {
  return {
    os: function () { return process.platform; },
    separator: function () { return path.sep; },
    pathExists: function (target) { return fs.existsSync(target); },
    toolVersion: function () { return null; }
  };
}

function create(options) {
  options = options || {};
  const adapter = Object.assign(defaultAdapter(), options.adapter || {});
  const store = C.createReceiptStore(options.receiptLimit);
  function probe(contract) {
    contract = contract || {};
    const mismatches = [], unknown = [];
    const actualOs = C.compact(adapter.os(), 80), actualSeparator = C.compact(adapter.separator(), 8);
    if (contract.os && C.compact(contract.os) !== actualOs) mismatches.push({ kind: 'os', assumed: C.compact(contract.os), actual: actualOs });
    if (contract.separator && C.compact(contract.separator) !== actualSeparator) mismatches.push({ kind: 'separator', assumed: C.compact(contract.separator), actual: actualSeparator });
    const paths = (contract.paths || []).slice(0, 40).map(function (entry) {
      const target = C.assertExactIdentifier(typeof entry === 'string' ? entry : entry.path, 'probe path');
      const expected = typeof entry === 'string' ? true : entry.exists !== false;
      const actual = adapter.pathExists(target) === true;
      if (actual !== expected) mismatches.push({ kind: 'path', assumed: target + ' exists=' + expected, actual: target + ' exists=' + actual });
      return { path: target, expectedExists: expected, actualExists: actual };
    });
    const tools = (contract.tools || []).slice(0, 20).map(function (entry) {
      const name = C.assertExactIdentifier(entry.name, 'tool name');
      const actual = adapter.toolVersion(name);
      if (actual == null) unknown.push({ kind: 'tool-version', tool: name });
      else if (entry.version && C.compact(entry.version) !== C.compact(actual)) mismatches.push({ kind: 'tool-version', assumed: name + '@' + entry.version, actual: name + '@' + actual });
      return { name: name, expectedVersion: C.compact(entry.version), actualVersion: actual == null ? null : C.compact(actual) };
    });
    const receipt = {
      schema: RECEIPT_SCHEMA, capability: CAPABILITY,
      contract_assumptions_probed: { os: !!contract.os, separator: !!contract.separator, paths: paths.length, tools: tools.length },
      os_assumed_vs_actual: { assumed: C.compact(contract.os), actual: actualOs }, paths_assumed_vs_actual_exists: paths,
      tools_versions_assumed_vs_actual: tools, separator_assumed_vs_actual: { assumed: C.compact(contract.separator), actual: actualSeparator },
      mismatches: mismatches, environment_seam: mismatches.length ? 'ENVIRONMENT_SEAM' : '', unknown_environment_hold: unknown,
      safe_to_proceed_as_contracted: mismatches.length === 0 && unknown.length === 0,
      probe_digest: C.digest({ mismatches, unknown }), raw_probe_material_released: true, temporary_bytes_released: 0,
      next_cheapest_probe: unknown.length ? 'Provide a bounded version adapter for the named tool only.' : 'No further environment probe required for this contract.'
    };
    return store.push(receipt);
  }
  return { capability: CAPABILITY, probe, receipts: store.list, status: function () { return C.status(store); } };
}

module.exports = { CAPABILITY, RECEIPT_SCHEMA, create, defaultAdapter };
