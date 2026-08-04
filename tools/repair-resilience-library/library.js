"use strict";

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

const ROOT = __dirname;
const COMPONENT_ROOT = path.join(ROOT, "components");
const CATALOG_FILE = path.join(ROOT, "catalog.json");
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function catalog() {
  const value = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
  if (value.schema !== "axm.repair-resilience.catalog/v1" || value.summary.components !== 100 || value.summary.supportAdapters !== 1) {
    throw new Error("repair resilience catalog is invalid or incomplete");
  }
  return value;
}

function rows(value = catalog()) {
  return [...value.components, ...(value.supportAdapters || [])];
}

function normalizeSlug(value) {
  const slug = String(value || "").replace(/^axm\.repair\./, "").toLowerCase();
  if (!SAFE_SLUG.test(slug)) throw new Error("invalid component id");
  return slug;
}

function rowFor(value) {
  const slug = normalizeSlug(value);
  const row = rows().find(item => item.slug === slug);
  if (!row) throw new Error(`unknown repair component: ${slug}`);
  return row;
}

function inspectComponent(value) {
  const row = rowFor(value);
  const dir = path.join(COMPONENT_ROOT, row.slug);
  const isSeed = row.kind === "seed";
  return {
    schema: "axm.repair-resilience.component-view/v1",
    catalog: clone(row),
    manifest: isSeed ? JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) : null,
    contract: isSeed ? JSON.parse(fs.readFileSync(path.join(dir, "module.contract.json"), "utf8")) : null,
    supportDescriptor: isSeed ? null : clone(row),
    authority: {
      executionAuthorized: false,
      automaticRepairAuthorized: false,
      promotionAuthorized: false,
      canonAuthorized: false
    }
  };
}

function loadComponent(value) {
  const row = rowFor(value);
  const view = inspectComponent(row.slug);
  const entry = path.join(COMPONENT_ROOT, row.slug, row.entry || view.manifest?.entry || "index.js");
  return { ...view, api: require(entry) };
}

function search(query) {
  const terms = String(query || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!terms.length) return clone(rows());
  return rows()
    .map(row => {
      const haystack = [row.id, row.slug, row.name, row.summary, row.category, ...(row.actions || []), ...(row.tags || [])].join(" ").toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { row, score };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.row.name.localeCompare(right.row.name))
    .map(item => clone(item.row));
}

function runSelftest(value, timeoutMs = 10000) {
  const row = rowFor(value);
  const started = process.hrtime.bigint();
  const result = childProcess.spawnSync(process.execPath, [path.join(COMPONENT_ROOT, row.slug, "selftest.js")], {
    cwd: path.join(COMPONENT_ROOT, row.slug),
    encoding: "utf8",
    timeout: Math.max(100, Math.min(Number(timeoutMs) || 10000, 60000))
  });
  const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
  return {
    slug: row.slug,
    pass: result.status === 0 && !result.error,
    exitCode: result.status,
    signal: result.signal,
    timedOut: Boolean(result.error && result.error.code === "ETIMEDOUT"),
    wallMs: Number(wallMs.toFixed(3)),
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim()
  };
}

function runAllSelftests(timeoutMs = 10000) {
  const results = rows().map(row => runSelftest(row.slug, timeoutMs));
  const passed = results.filter(row => row.pass).length;
  return {
    schema: "axm.repair-resilience.selftest-summary/v1",
    tests: results.length,
    passed,
    failed: results.length - passed,
    rows: results,
    authority: "EVIDENCE_ONLY_NO_PROMOTION"
  };
}

module.exports = {
  catalog,
  inspectComponent,
  loadComponent,
  normalizeSlug,
  runAllSelftests,
  runSelftest,
  search
};
