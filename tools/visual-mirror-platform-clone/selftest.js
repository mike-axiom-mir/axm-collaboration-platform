"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const INTAKE = path.join(ROOT, "intakes", "visual-mirror-platform-clone-v0.7.0-2026-07-28");
const WORKSPACE = path.join(INTAKE, "platform-workspace");
const CLONE_ID = "AXM_CLONE_VISUAL_PLATFORM_STEWARD_001";
const WEAVE_ID = "weave-978b8b131c5073c373f1";
const WEAVE = path.join(WORKSPACE, "12_REPORTS", "workshop", "capability_weaves", WEAVE_ID, "weave.json");
const ADAPTED_MANIFEST = path.join(INTAKE, "platform-adapted", "PACKAGE_MANIFEST.json");

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const manifest = readJson(path.join(__dirname, "manifest.json"));
const contract = readJson(path.join(__dirname, "module.contract.json"));
const dnaPath = path.join(__dirname, "clone_dna.json");
const dna = readJson(dnaPath);
const proof = readJson(path.join(__dirname, "platform-proof.json"));
const weave = readJson(WEAVE);
const runtimeDnaPath = path.join(WORKSPACE, "02_CLONES", CLONE_ID, "dna", "clone_dna.json");
const runtimeManifest = readJson(path.join(WORKSPACE, "02_CLONES", CLONE_ID, "clone_manifest.json"));

assert.equal(manifest.id, "visual-mirror-platform-clone");
assert.equal(manifest.status, "TEST");
assert.deepEqual(manifest.permissions, []);
assert.equal(contract.id, manifest.id);
assert.deepEqual(contract.permissions, []);
for (const refusal of ["workshop-source-mutation", "workshop-code-execution", "automatic-promotion", "canon-mutation"]) {
  assert(contract.boundaries.refuses.includes(refusal), `missing refusal: ${refusal}`);
}

assert.equal(dna.clone_id, CLONE_ID);
assert.equal(dna.status, "APPRENTICE");
assert.equal(dna.canonical_write, false);
assert.equal(dna.network_access, "DENY_BY_DEFAULT");
assert.deepEqual(dna.allowed_tools, []);
assert.equal(dna.platform_binding.weave_id, WEAVE_ID);

assert.equal(proof.status, "PASS");
assert.equal(proof.binding.weave_id, WEAVE_ID);
assert.equal(proof.binding.weave_sha256, sha256(WEAVE));
assert.equal(proof.binding.adapted_package_manifest_sha256, sha256(ADAPTED_MANIFEST));
assert.equal(weave.status, "PASS");
assert.equal(weave.cycle_id, WEAVE_ID);
assert.equal(weave.summary.capability_families_observed, 28);
assert.equal(weave.summary.multiple_routes_preserved, 28);
assert.equal(weave.summary.workshop_files_written, 0);
assert.equal(weave.summary.workshop_files_copied, 0);
assert.equal(weave.summary.workshop_code_executed, 0);
assert.equal(weave.summary.network_calls, 0);
assert.equal(weave.authority.write_workshop, false);
assert.equal(weave.authority.merge, false);
assert.equal(weave.authority.delete, false);

assert.equal(sha256(runtimeDnaPath), sha256(dnaPath));
assert.equal(runtimeManifest.clone_id, CLONE_ID);
assert.equal(runtimeManifest.status, "HATCHED");
assert.equal(runtimeManifest.dna_sha256, sha256(dnaPath));
assert.equal(runtimeManifest.canonical_write, false);

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert(html.includes("Visual Mirror"));
assert(html.includes("Platform Clone"));
assert(!/<script[^>]+src=["']https?:/i.test(html), "external scripts are forbidden");

console.log("PASS Visual Mirror Platform Clone - exact weave, hatched DNA, zero-authority view");
