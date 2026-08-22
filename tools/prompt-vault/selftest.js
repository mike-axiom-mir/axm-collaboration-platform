#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const ContractVerifier = require("../../hub/module-contract-verifier");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
);
const contract = JSON.parse(
  fs.readFileSync(path.join(root, "module.contract.json"), "utf8"),
);
const compact = html.replace(/\s+/g, "");
let pass = 0;

function test(name, fn) {
  try {
    fn();
    pass += 1;
    console.log("PASS " + name);
  } catch (error) {
    console.error("FAIL " + name + "\n  " + error.stack);
    process.exitCode = 1;
  }
}

function attr(tag, name) {
  const match = String(tag).match(
    new RegExp("\\s" + name + "\\s*=\\s*([\"'])([\\s\\S]*?)\\1", "i"),
  );
  return match ? match[2] : null;
}

test("manifest declares the matching versioned module contract", () => {
  assert.equal(manifest.schema, ContractVerifier.MANIFEST_SCHEMA);
  assert.equal(manifest.kind, "product");
  assert.equal(manifest.contract, "module.contract.json");
  assert.equal(contract.schema, "axm.module-contract/v1");
  assert.equal(contract.id, manifest.id);
  assert.equal(contract.version, manifest.version);
  assert(
    html.includes(
      "AXM.init({id:'prompt-vault',name:'AXM Prompt Vault',version:'v0_2'})",
    ),
  );
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest).errors, []);
  assert.deepEqual(manifest.permissions, contract.permissions);
  contract.permissions.forEach((permission) =>
    assert(manifest.uses.includes(permission), "undeclared permission: " + permission),
  );
});

test("every prompt input has an accessible name", () => {
  const markup = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const labelIds = new Set(
    Array.from(
      markup.matchAll(/<label\b[^>]*\bfor\s*=\s*(["'])(.*?)\1/gi),
      (match) => match[2],
    ),
  );
  const controls = Array.from(
    markup.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi),
    (match) => match[0],
  );
  const unnamed = controls
    .filter((tag) => {
      const id = attr(tag, "id");
      return (
        !attr(tag, "aria-label") &&
        !attr(tag, "aria-labelledby") &&
        !attr(tag, "title") &&
        !(id && labelIds.has(id))
      );
    })
    .map((tag) => attr(tag, "id") || tag);
  assert.equal(controls.length, 24);
  assert.deepEqual(unnamed, []);
});

test("stored and imported backups use the observed v2 envelope", () => {
  assert(compact.includes("format:'axm-prompt-vault',v:2"));
  assert(html.includes("AXM.store.save('vault',getProject()"));
  assert(html.includes("AXM.store.startAutosave(getProject,8000"));
  assert(html.includes("d.format!=='axm-prompt-vault'"));
  assert(html.includes("gate('import-backup'"));
  assert(contract.handoffs.emits.includes("application/json:axm-prompt-vault/v2"));
  assert(contract.handoffs.accepts.includes("application/json:axm-prompt-vault/v2"));
});

test("exports preserve the explicit sink, server, then browser fallback chain", () => {
  const registry = html.indexOf("kind:'asset.sink'");
  const server = html.indexOf("fetch('/api/export'");
  const browser = html.indexOf("server export unavailable · downloaded instead");
  assert(registry >= 0 && server > registry && browser > server);
  assert(contract.boundaries.writes.includes("server-export:explicit-user-request"));
  assert(contract.boundaries.writes.includes("browser-download:explicit-user-request"));
});

test("page-local prompt source supports only list, read and resolve", () => {
  assert(html.includes("id:'prompt-vault.records',kind:'prompt.source'"));
  assert(html.includes("q.action==='list'"));
  assert(html.includes("q.action==='read'||q.action==='resolve'"));
  assert(html.includes("active while Prompt Vault page is open"));
  assert(
    contract.boundaries.refuses.includes(
      "persistent-server-wide-prompt-registry",
    ),
  );
});

test("AI assistance is optional and cannot masquerade as evaluation", () => {
  assert(html.includes("await AXM.ask("));
  assert(html.includes("if(r.noAI)return status('no AI connected')"));
  assert(html.includes("automatic prompt benchmarking not built"));
  assert(contract.boundaries.refuses.includes("automatic-prompt-benchmarking"));
  assert(contract.boundaries.refuses.includes("prompt-quality-proof"));
  assert(contract.boundaries.refuses.includes("automatic-winner-selection"));
});

test("AI Team comparison is explicit and schema-bound", () => {
  assert(html.includes("new URLSearchParams(location.search).get('ai-team')!=='1'"));
  assert(html.includes("gate('compare-models'"));
  assert(html.includes("schema:'axm.ai-team-prompt/v1'"));
  assert(html.includes("parent.postMessage("));
  assert(contract.handoffs.emits.includes("axm.ai-team-prompt/v1"));
});

test("contract denies promotion and canon authority", () => {
  assert(contract.boundaries.refuses.includes("automatic-canon-promotion"));
  assert(contract.boundaries.refuses.includes("promotion-authority"));
  assert(contract.boundaries.refuses.includes("canon-authority"));
  assert(
    manifest.no_fake_done.some((claim) =>
      claim.includes("does not automatically prove a prompt or choose a winner"),
    ),
  );
});

if (!process.exitCode) {
  console.log("\n" + pass + " PASS · 0 FAIL · prompt-vault " + manifest.version);
}
