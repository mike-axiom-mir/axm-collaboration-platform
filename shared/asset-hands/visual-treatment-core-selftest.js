"use strict";
const assert = require("node:assert/strict");
const Core = require("./visual-treatment-core");
const Codec = require("./pixel-3d-codec");

function request(overrides) {
  return Object.assign({
    schema: Core.SCHEMAS.request,
    version: "1.0.0",
    id: "visual-treatment-test",
    identity_id: "axm.park.ferris-wheel",
    profile_id: "pixel-16bit-3d",
    animation_state: "running",
    style_layers: [{ id: "aetherglass-cinematic", weight: 1 }],
    effect_modules: [{ id: "material.aetherglass", params: { roughness: 0.18 } }, { id: "light.neon-edge-glow", params: { intensity: 0.72 } }, { id: "motion.idle-pulse", params: { intensity: 0.34 } }],
    material_family: "glass",
    story: { title: "SAME RIDE / NEW LIGHT", nodes: [{ id: "identity", caption: "THE WHEEL STAYS THE WHEEL.", duration_s: 2, focus_component: "wheel-axis" }, { id: "choice", caption: "THE TREATMENT BECOMES A CHOICE.", duration_s: 2, focus_component: "visual.fx.halo" }] },
    accessibility: { reduced_motion: false, high_contrast: false, effect_scale: 1 },
    authority: "candidate-only"
  }, overrides || {});
}

function main() {
  assert.equal(Core.CATALOG.schema, Core.SCHEMAS.catalog);
  assert.equal(Core.CATALOG.counts.style_presets, 25);
  assert.equal(Core.CATALOG.counts.treatment_molds, 3);
  assert.equal(Core.CATALOG.counts.aetherfx_modules, 64);
  assert.equal(Core.CATALOG.counts.portable_fx_blocks, 15);
  assert.equal(Core.CATALOG.counts.pbr_material_families, 6);
  assert.equal(Core.CATALOG.counts.adapters, 30);

  const first = Core.buildPackage(request()), second = Core.buildPackage(request());
  assert.equal(first.status, "READY");
  assert.equal(first.receipt.status, "PASS");
  assert.equal(first.receipt.glb_digest, second.receipt.glb_digest);
  assert.equal(first.receipt.treatment_digest, second.receipt.treatment_digest);
  assert.equal(first.storyboard_svg, second.storyboard_svg);
  assert.equal(first.portable_css, second.portable_css);
  assert.equal(first.identity.id, "axm.park.ferris-wheel");
  assert.equal(first.profile.id, "pixel-16bit-3d");
  assert.equal(first.representation_set.compatibility.simulation_state_shared, true);
  assert.equal(first.receipt.fallback_used, false);
  assert.equal(first.receipt.nearest_substitute_used, false);
  assert(first.storyboard_svg.includes("SUPPLIED COPY ONLY"));
  assert(first.portable_css.includes("--fx-edge-intensity") || first.portable_css.includes("--fx"));
  const inspected = Codec.inspect(first.glb.bytes);
  assert.equal(inspected.pass, true);
  assert.equal(inspected.json.extras.axm.visual_treatment.catalog_digest, Core.CATALOG.digest);
  assert(inspected.json.extensionsUsed.includes("KHR_materials_emissive_strength"));

  const allStyles = Core.listChoices().styles;
  allStyles.forEach((style, index) => {
    const output = Core.buildPackage(request({ id: `style-${index}`, identity_id: index % 2 ? "axm.home.starter-sofa" : "axm.park.ticket-gate", profile_id: index % 3 ? "pixel-16bit-3d" : "pixel-8bit-3d", animation_state: index % 2 ? "sit" : "open", style_layers: [{ id: style.id, weight: 1 }], effect_modules: [], material_family: undefined, story: undefined }));
    assert.equal(output.status, "READY", `style ${style.id}`);
    assert.equal(output.receipt.adapter_results[0].id, style.id);
  });

  Core.CATALOG.pbr_material_families.forEach((family) => {
    const output = Core.buildPackage(request({ id: `material-${family.id}`, style_layers: [{ id: "axm-balanced", weight: 1 }], effect_modules: [], material_family: family.id, story: undefined }));
    assert.equal(output.status, "READY", `material ${family.id}`);
    assert(output.receipt.adapter_results.some((entry) => entry.id === family.id));
  });

  const allEffects = Core.CATALOG.aetherfx_modules.map((module) => ({ id: module.id, params: {} }));
  const everyEffect = Core.buildPackage(request({ id: "all-aetherfx-modules", identity_id: "axm.park.ticket-gate", animation_state: "open", style_layers: [{ id: "axm-balanced", weight: 1 }], effect_modules: allEffects, material_family: undefined, story: undefined, accessibility: { reduced_motion: true, high_contrast: true, effect_scale: 0.5 } }));
  assert.equal(everyEffect.status, "READY");
  assert.equal(everyEffect.receipt.measures.requested_effect_modules, 64);
  assert(everyEffect.receipt.measures.resolved_effect_leaves >= 64);
  assert(everyEffect.receipt.adapter_results.some((entry) => entry.route === "PORTABLE_WEB_ONLY"));
  assert(everyEffect.receipt.adapter_results.some((entry) => entry.route === "TOKEN_ONLY"));
  assert(everyEffect.receipt.adapter_results.some((entry) => entry.route === "APPLIED_3D_AND_PORTABLE_WEB"));
  assert.equal(everyEffect.scene.animations[0].channels.some((channel) => channel.node_id === "visual-fx-halo"), false);

  const comic = Core.buildPackage(request({ id: "comic", style_layers: [{ id: "character-comic-vanguard", weight: 1 }], effect_modules: [{ id: "light.neon-edge-glow", params: { intensity: 0.4 } }], material_family: "painted-metal" }));
  assert.equal(comic.status, "READY");
  assert.notEqual(comic.receipt.glb_digest, first.receipt.glb_digest);

  const missingStyle = Core.buildPackage(request({ style_layers: [{ id: "cinematic-impossible", weight: 1 }] }));
  assert.equal(missingStyle.status, "MISSING_VISUAL_CAPABILITY");
  assert.equal(missingStyle.fallback_used, false);
  const missingEffect = Core.buildPackage(request({ effect_modules: [{ id: "light.fake-nearest-glow", params: {} }] }));
  assert.equal(missingEffect.status, "MISSING_VISUAL_CAPABILITY");
  assert.equal(missingEffect.nearest_substitute_used, false);

  console.log(`Visual Treatment Core selftest PASS (${allStyles.length} exact styles, 64 AetherFX modules, 6 PBR families, animated emissive GLB, Storycraft SVG, portable CSS, deterministic no-fallback receipts)`);
}

main();
