#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Library = require("./library");
const Builder = require("./build-catalog");

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write(`PASS ${label}\n`);
}

const catalog = Library.catalog();
check("catalog preserves exactly 100 unique experimental components", () => {
  assert.equal(catalog.summary.components, 100);
  assert.equal(catalog.summary.uniqueIds, 100);
  assert.equal(catalog.components.filter(row => row.status === "EXPERIMENTAL").length, 100);
});
check("authored health telemetry helper stays separately labeled", () => {
  assert.equal(catalog.summary.supportAdapters, 1);
  assert.equal(catalog.summary.loadableSurfaces, 101);
  assert.equal(catalog.supportAdapters[0].sourceDeclaration, "AUTHORED_HELPER_WITH_SELFTEST_NO_SOURCE_MANIFEST_OR_CONTRACT");
  assert.equal(catalog.supportAdapters[0].authority, "OBSERVE_ONLY");
});
check("all component permissions and automatic mutation remain held", () => {
  assert.equal(catalog.summary.emptyPermissions, 100);
  assert.equal(catalog.summary.automaticMutationFalse, 100);
});
check("catalog is reproducible from bundled source", () => {
  assert.deepEqual(Builder.build(), catalog);
});
check("search finds heartbeat and verification components", () => {
  assert(Library.search("heartbeat lease").some(row => row.slug === "heartbeat-lease-monitor"));
  assert(Library.search("verification proof").some(row => row.slug === "verification-harness"));
  assert(Library.search("health telemetry packet").some(row => row.slug === "health-telemetry-integration"));
});
check("unknown and unsafe component paths fail closed", () => {
  assert.throws(() => Library.inspectComponent("../server"), /invalid component id/);
  assert.throws(() => Library.inspectComponent("not-present"), /unknown repair component/);
});
check("every catalog row resolves to a manifest, contract, source and selftest", () => {
  for (const row of catalog.components) {
    const dir = path.join(__dirname, "components", row.slug);
    for (const file of ["manifest.json", "module.contract.json", "index.js", "selftest.js"]) {
      assert(fs.existsSync(path.join(dir, file)), `${row.slug}/${file}`);
    }
    const view = Library.inspectComponent(row.slug);
    assert.equal(view.manifest.id, row.id);
    assert.equal(view.contract.id, row.id);
    assert.equal(view.authority.executionAuthorized, false);
  }
  const helper = Library.inspectComponent("health-telemetry-integration");
  assert.equal(helper.manifest, null);
  assert.equal(helper.contract, null);
  assert.equal(helper.supportDescriptor.authority, "OBSERVE_ONLY");
});
check("all component APIs load and expose their declared symbols", () => {
  for (const row of [...catalog.components, ...catalog.supportAdapters]) {
    const loaded = Library.loadComponent(row.slug);
    assert(row.exportedSymbols.length > 0, row.slug);
    for (const symbol of row.exportedSymbols) assert(symbol in loaded.api, `${row.slug}:${symbol}`);
  }
});
check("heartbeat component produces deterministic observe-only status", () => {
  const heartbeat = Library.loadComponent("heartbeat-lease-monitor").api;
  const lease = heartbeat.createLease({ leaseId: "test", issuedAtMs: 1000, lastBeatAtMs: 1000, intervalMs: 1000, graceMs: 250 });
  const status = heartbeat.evaluateLease(lease, 2300);
  assert.equal(status.state, "EXPIRED");
  assert.equal(status.authority, "OBSERVE_ONLY");
});
check("effectful components stay visible rather than silently trusted", () => {
  assert.equal(catalog.summary.networkSurface, 0);
  assert.equal(catalog.summary.filesystemSurface, 3);
  assert.equal(catalog.summary.processSurface, 2);
});
check("all 100 seed and one integration selftests pass through the installed wrapper", () => {
  const result = Library.runAllSelftests();
  assert.equal(result.tests, 101);
  assert.equal(result.passed, 101);
  assert.equal(result.failed, 0);
  assert.equal(result.authority, "EVIDENCE_ONLY_NO_PROMOTION");
});

process.stdout.write(`Repair & Resilience Library self-test passed: ${checks} checks\n`);
