import test from "node:test";
import assert from "node:assert/strict";
import {
  HOSTED_POLICY_EXAMPLE,
  calculateSkinIntegrity,
  compileStyleIntent,
  sha256Hex,
  validateSkinPack,
  verifyEmbeddedAssets,
  verifySkinIntegrity
} from "../src/index.mjs";

function validPack() {
  return compileStyleIntent({
    type: "axm.style-intent",
    version: "1.0",
    name: "Validator Test",
    seed: "validator-1",
    scope: ["global"],
    keywords: ["matte"],
    intensity: 0.5,
    accessibility: {}
  });
}

test("authority fields are rejected", () => {
  const pack = validPack();
  pack.gameplay = { damage: 500 };
  const report = validateSkinPack(pack);
  assert.equal(report.ok, false);
  assert(report.errors.some((entry) => entry.code === "FORBIDDEN_KEY"));
});

test("prototype-pollution keys are rejected", () => {
  const pack = validPack();
  pack.tokens = JSON.parse('{"__proto__":{"polluted":true}}');
  const report = validateSkinPack(pack);
  assert.equal(report.ok, false);
  assert(report.errors.some((entry) => entry.code === "FORBIDDEN_KEY"));
});

test("remote asset sources are rejected", () => {
  const pack = validPack();
  pack.assets["asset.remote"] = {
    mime: "image/png",
    role: "texture",
    source: { kind: "remote", url: "https://example.invalid/a.png" },
    sha256: "0".repeat(64),
    provenance: { origin: "test" }
  };
  const report = validateSkinPack(pack);
  assert.equal(report.ok, false);
  assert(report.errors.some((entry) => entry.code === "ASSET_SOURCE_DENIED"));
});

test("raw SVG assets are denied", () => {
  const pack = validPack();
  pack.assets["asset.vector"] = {
    mime: "image/svg+xml",
    role: "texture",
    source: { kind: "embedded-data", data: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" },
    sha256: "0".repeat(64),
    provenance: { origin: "test" }
  };
  const report = validateSkinPack(pack);
  assert.equal(report.ok, false);
  assert(report.errors.some((entry) => entry.code === "ASSET_MIME_DENIED"));
});

test("material NaN and out-of-range values are rejected", () => {
  const pack = validPack();
  pack.materials["world.base"].metallic = 4;
  pack.materials["world.base"].roughness = Number.NaN;
  const report = validateSkinPack(pack);
  assert.equal(report.ok, false);
  assert.equal(
    report.errors.filter((entry) => entry.code === "MATERIAL_VALUE_OUT_OF_RANGE").length,
    2
  );
});

test("integrity detects mutation", async () => {
  const pack = validPack();
  pack.integrity = await calculateSkinIntegrity(pack);
  assert.equal((await verifySkinIntegrity(pack)).ok, true);
  pack.metadata.name = "Silently changed";
  assert.equal((await verifySkinIntegrity(pack)).ok, false);
});

test("hosted policy requires finalized integrity", () => {
  const report = validateSkinPack(validPack(), HOSTED_POLICY_EXAMPLE);
  assert.equal(report.ok, false);
  assert(report.errors.some((entry) => entry.code === "INTEGRITY_REQUIRED"));
});

test("embedded raster bytes must match declared MIME and hash", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7RkAAAAASUVORK5CYII=",
    "base64"
  );
  const pack = validPack();
  pack.assets["asset.pixel"] = {
    mime: "image/png",
    role: "texture",
    source: { kind: "embedded-data", data: `data:image/png;base64,${png.toString("base64")}` },
    sha256: await sha256Hex(png),
    provenance: { origin: "test" }
  };
  assert.equal((await verifyEmbeddedAssets(pack)).ok, true);

  pack.assets["asset.pixel"].mime = "image/jpeg";
  const mismatch = await verifyEmbeddedAssets(pack);
  assert.equal(mismatch.ok, false);
  assert(mismatch.errors.some((entry) => entry.code === "RASTER_MIME_MISMATCH"));
});

test("embedded raster hash mutation is rejected", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7RkAAAAASUVORK5CYII=",
    "base64"
  );
  const pack = validPack();
  pack.assets["asset.pixel"] = {
    mime: "image/png",
    role: "texture",
    source: { kind: "embedded-data", data: `data:image/png;base64,${png.toString("base64")}` },
    sha256: "0".repeat(64),
    provenance: { origin: "test" }
  };
  const report = await verifyEmbeddedAssets(pack);
  assert.equal(report.ok, false);
  assert(report.errors.some((entry) => entry.code === "ASSET_HASH_MISMATCH"));
});
