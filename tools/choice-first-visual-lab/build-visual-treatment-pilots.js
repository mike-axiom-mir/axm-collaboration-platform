#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const Treatment = require("../../shared/asset-hands/visual-treatment-core");
const Raster = require("../../shared/asset-hands/raster-codec");

const ROOT = __dirname;
const OUT = path.join(ROOT, "pilots", "visual-treatments");
const PBR_OUT = path.join(ROOT, "pilots", "pbr-materials");

const PILOTS = [
  {
    slug: "ferris-aetherglass-neon",
    request: {
      identity_id: "axm.park.ferris-wheel",
      profile_id: "pixel-16bit-3d",
      animation_state: "running",
      style_layers: [{ id: "aetherglass-cinematic", weight: 1 }],
      effect_modules: [{ id: "material.aetherglass", params: { roughness: 0.18 } }, { id: "light.neon-edge-glow", params: { intensity: 0.72 } }, { id: "motion.idle-pulse", params: { intensity: 0.34 } }],
      material_family: "glass",
      story: { title: "SAME RIDE / NEW LIGHT", nodes: [{ id: "truth", caption: "THE WHEEL STAYS THE WHEEL.", duration_s: 2, focus_component: "wheel-axis" }, { id: "choice", caption: "THE TREATMENT BECOMES A CHOICE.", duration_s: 2, focus_component: "visual-fx-halo" }] }
    }
  },
  {
    slug: "carousel-comic-neon-paper",
    request: {
      identity_id: "axm.park.carousel-horse",
      profile_id: "pixel-16bit-3d",
      animation_state: "running",
      style_layers: [{ id: "character-comic-vanguard", weight: 0.84 }, { id: "neon-paper-selective", weight: 0.56 }],
      effect_modules: [{ id: "light.neon-edge-glow", params: { intensity: 0.64 } }, { id: "depth.layered-shadow", params: {} }],
      material_family: "painted-metal",
      story: { title: "COMIC HORSE / NEON NIGHT", nodes: [{ id: "identity", caption: "ONE HORSE, ANOTHER DIRECTION.", duration_s: 2, focus_component: "horse-root" }] }
    }
  },
  {
    slug: "gate-accessible-night",
    request: {
      identity_id: "axm.park.ticket-gate",
      profile_id: "pixel-8bit-3d",
      animation_state: "open",
      style_layers: [{ id: "accessible-night-edge", weight: 1 }],
      effect_modules: [{ id: "material.dark-shell", params: {} }, { id: "focus.halo", params: {} }, { id: "light.soft-bloom-halo", params: { intensity: 0.4 } }],
      material_family: "painted-metal",
      story: { title: "READABLE AT NIGHT", nodes: [{ id: "gate", caption: "ACCESS STAYS LEGIBLE.", duration_s: 2, focus_component: "gate-arm" }] }
    }
  },
  {
    slug: "sofa-oceanic-glass",
    request: {
      identity_id: "axm.home.starter-sofa",
      profile_id: "pixel-16bit-3d",
      animation_state: "sit",
      style_layers: [{ id: "world-oceanic-glass", weight: 0.78 }],
      effect_modules: [{ id: "material.frosted-panel", params: {} }, { id: "light.reflection-streak", params: {} }, { id: "atmosphere.ambient-field", params: {} }],
      material_family: "glass",
      story: { title: "SAME SOFA / NEW FINISH", nodes: [{ id: "continuity", caption: "REPAIR IT. REFIT IT. KEEP ITS HISTORY.", duration_s: 3, focus_component: "sofa-root" }] }
    }
  }
];

function mkdir(target) { fs.mkdirSync(target, { recursive: true }); }
function writeJson(target, value) { fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n", "utf8"); }
function bytesFromDataUrl(value) { return Buffer.from(String(value).slice(String(value).indexOf(",") + 1), "base64"); }
function rgbaBytes(value) { return value instanceof Uint8Array ? value : new Uint8Array(value.buffer, value.byteOffset, value.byteLength); }

async function main() {
  mkdir(OUT);
  mkdir(PBR_OUT);
  const packages = [];
  for (const pilot of PILOTS) {
    const request = Object.assign({
      schema: Treatment.SCHEMAS.request,
      version: "1.0.0",
      id: pilot.slug,
      accessibility: { reduced_motion: false, high_contrast: false, effect_scale: 1 },
      authority: "candidate-only"
    }, pilot.request);
    const result = Treatment.buildPackage(request);
    if (result.status !== "READY" || result.receipt.status !== "PASS") throw new Error(pilot.slug + " failed: " + JSON.stringify(result.missing || result.receipt));
    const dir = path.join(OUT, pilot.slug);
    mkdir(dir);
    fs.writeFileSync(path.join(dir, pilot.slug + ".glb"), bytesFromDataUrl(result.glb.dataUrl));
    fs.writeFileSync(path.join(dir, pilot.slug + "-story.svg"), result.storyboard_svg, "utf8");
    fs.writeFileSync(path.join(dir, pilot.slug + ".css"), result.portable_css, "utf8");
    writeJson(path.join(dir, pilot.slug + "-request.json"), request);
    writeJson(path.join(dir, pilot.slug + "-recipe.json"), result.recipe);
    writeJson(path.join(dir, pilot.slug + "-receipt.json"), result.receipt);
    writeJson(path.join(dir, pilot.slug + "-scene.json"), result.scene);
    writeJson(path.join(dir, pilot.slug + "-representation-set.json"), result.representation_set);
    packages.push({ slug: pilot.slug, identity_id: result.identity.id, profile_id: result.profile.id, glb: "visual-treatments/" + pilot.slug + "/" + pilot.slug + ".glb", story_svg: "visual-treatments/" + pilot.slug + "/" + pilot.slug + "-story.svg", treatment_digest: result.receipt.treatment_digest, glb_digest: result.receipt.glb_digest, routes: result.receipt.routes, known_losses: result.receipt.known_losses });
  }

  const [Baker, Verifier] = await Promise.all([
    import(pathToFileURL(path.resolve(ROOT, "../pbr-material-baker/pbr-baker-core.mjs")).href),
    import(pathToFileURL(path.resolve(ROOT, "../pbr-material-baker/pbr-baker-verifier.mjs")).href)
  ]);
  const materialSets = [];
  for (const family of Object.keys(Baker.MATERIAL_FAMILIES).sort()) {
    const bake = Baker.bakeMaterial({ family, seed: "choice-first-" + family, size: 128 });
    const verification = Verifier.verifyMaterialBake(bake);
    if (verification.status !== "pass") throw new Error(family + " PBR verification failed");
    const dir = path.join(PBR_OUT, family);
    mkdir(dir);
    for (const name of ["albedo", "normal", "orm", "emissive", "height"]) {
      const png = Raster.encodeRgba(128, 128, rgbaBytes(bake.maps[name]), { colourSpace: name === "albedo" || name === "emissive" ? "srgb" : null });
      fs.writeFileSync(path.join(dir, family + "-" + name + ".png"), Buffer.from(png.bytes));
    }
    const preview = Raster.encodeRgba(128, 128, rgbaBytes(Baker.renderMaterialBall(bake)), { colourSpace: "srgb" });
    fs.writeFileSync(path.join(dir, family + "-preview.png"), Buffer.from(preview.bytes));
    writeJson(path.join(dir, family + "-verification.json"), verification);
    materialSets.push({ family, preview: "pbr-materials/" + family + "/" + family + "-preview.png", maps: ["albedo", "normal", "orm", "emissive", "height"].map((name) => "pbr-materials/" + family + "/" + family + "-" + name + ".png"), verification: verification.status });
  }

  const manifest = {
    schema: "axm.visual-treatment-pilot-manifest/v1",
    version: "1.0.0",
    status: "PASS",
    catalog_digest: Treatment.CATALOG.digest,
    packages,
    pbr_material_sets: materialSets,
    counts: { treated_identity_packages: packages.length, pbr_material_sets: materialSets.length, style_choices: Treatment.listChoices().styles.length, aetherfx_modules: Treatment.CATALOG.counts.aetherfx_modules, portable_fx_blocks: Treatment.CATALOG.counts.portable_fx_blocks, adapters: Treatment.CATALOG.counts.adapters },
    boundaries: { installed: false, promoted: false, canonical: false, visual_approval: "HUMAN_REVIEW_REQUIRED", whole_game_conversion: false, fallback_used: false }
  };
  writeJson(path.join(ROOT, "pilots", "visual-treatment-pilot-manifest.json"), manifest);
  console.log("Visual treatment pilots PASS (" + packages.length + " treated GLBs, " + materialSets.length + " verified PBR map sets, catalog " + Treatment.CATALOG.digest + ")");
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
