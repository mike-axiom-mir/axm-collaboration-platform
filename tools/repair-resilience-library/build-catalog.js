#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const componentRoot = path.join(root, "components");
const output = path.join(root, "catalog.json");

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function build() {
  const components = fs.readdirSync(componentRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(componentRoot, entry.name, "manifest.json")))
    .map(entry => {
      const dir = path.join(componentRoot, entry.name);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
      const contract = JSON.parse(fs.readFileSync(path.join(dir, "module.contract.json"), "utf8"));
      const code = fs.readFileSync(path.join(dir, manifest.entry || "index.js"), "utf8");
      const dependencies = [...code.matchAll(/require\(["']([^"']+)["']\)/g)].map(match => match[1]);
      const exported = code.match(/module\.exports\s*=\s*\{([^}]+)\}/s);
      const exportedSymbols = exported
        ? exported[1].split(",").map(value => value.trim().split(":")[0].trim()).filter(Boolean)
        : [];
      return {
        kind: "seed",
        id: manifest.id,
        slug: entry.name,
        name: manifest.name,
        version: manifest.version,
        entry: manifest.entry || "index.js",
        status: manifest.status,
        category: manifest.category,
        risk: manifest.risk,
        summary: manifest.summary,
        tags: manifest.tags || [],
        actions: manifest.actions || [],
        accepts: manifest.accepts || [],
        produces: manifest.produces || [],
        exportedSymbols,
        effects: {
          filesystem: dependencies.includes("fs"),
          process: dependencies.includes("child_process"),
          network: dependencies.some(name => ["http", "https", "net", "tls", "dgram"].includes(name))
        },
        permissions: manifest.permissions || [],
        automaticMutation: contract.authority && contract.authority.automaticMutation,
        sourceDigest: digest(code)
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const supportDescriptors = JSON.parse(fs.readFileSync(path.join(root, "support-adapters.json"), "utf8"));
  const supportAdapters = supportDescriptors.adapters.map(descriptor => {
    const dir = path.join(componentRoot, descriptor.slug);
    const code = fs.readFileSync(path.join(dir, descriptor.entry), "utf8");
    const dependencies = [...code.matchAll(/require\(["']([^"']+)["']\)/g)].map(match => match[1]);
    const exported = code.match(/module\.exports\s*=\s*\{([^}]+)\}/s);
    const exportedSymbols = exported
      ? exported[1].split(",").map(value => value.trim().split(":")[0].trim()).filter(Boolean)
      : [];
    return {
      ...descriptor,
      kind: "support-adapter",
      exportedSymbols,
      effects: {
        filesystem: dependencies.includes("fs"),
        process: dependencies.includes("child_process"),
        network: dependencies.some(name => ["http", "https", "net", "tls", "dgram"].includes(name))
      },
      permissions: [],
      automaticMutation: null,
      sourceDigest: digest(code)
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const core = {
    schema: "axm.repair-resilience.catalog/v1",
    source: {
      package: "AXM_100_SEED_LOCAL_INTAKE_RUNS_001_100_2026-07-27",
      archiveSha256: "f4563beaa3b1ce33bcca909a4b03b2d6def01c4939ce86515c905bfe00e20bda",
      sourceManifestFilesVerified: 1786,
      checkpointChecksPassed: 2608,
      hardeningAssertionsPassed: 6095
    },
    posture: {
      wrapperStatus: "WORKING",
      componentStatus: "EXPERIMENTAL",
      automaticExecution: false,
      automaticRepair: false,
      automaticPromotion: false,
      canon: false
    },
    summary: {
      components: components.length,
      supportAdapters: supportAdapters.length,
      loadableSurfaces: components.length + supportAdapters.length,
      uniqueIds: new Set(components.map(row => row.id)).size,
      emptyPermissions: components.filter(row => row.permissions.length === 0).length,
      automaticMutationFalse: components.filter(row => row.automaticMutation === false).length,
      filesystemSurface: components.filter(row => row.effects.filesystem).length,
      processSurface: components.filter(row => row.effects.process).length,
      networkSurface: components.filter(row => row.effects.network).length,
      exportedSymbols: components.reduce((sum, row) => sum + row.exportedSymbols.length, 0)
    },
    components,
    supportAdapters
  };
  return { ...core, catalogDigest: digest(JSON.stringify(core)) };
}

if (require.main === module) {
  const value = build();
  fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
  process.stdout.write(`Catalog built: ${value.summary.components} components, ${value.catalogDigest}\n`);
}

module.exports = { build };
