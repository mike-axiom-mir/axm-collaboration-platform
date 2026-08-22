import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  listGameSurfaceCategories,
  listPerformanceProfiles,
  listPreskins,
  listSkinMolds,
  listTreatmentMolds
} from "../style-fabric/src/index.mjs";
import { MATERIAL_FAMILIES } from "../../tools/pbr-material-baker/pbr-baker-core.mjs";

const require = createRequire(import.meta.url);
const VisualFX = require("../visual-fx/fx-blocks.js");
const here = path.dirname(fileURLToPath(import.meta.url));
const workshop = path.resolve(here, "../..");

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableStringify(value, space = 0) {
  return JSON.stringify(stableValue(value), null, space);
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(workshop, relative), "utf8"));
}

const adapterSources = [
  { id: "style-fabric", manifest: "shared/style-fabric/manifest.json", integration: "DIRECT", entry: "shared/style-fabric/src/index.mjs" },
  { id: "aetherglass", manifest: "shared/aetherglass/MODULE_MANIFEST.json", integration: "DIRECT_WEB", entry: "shared/aetherglass/axm-skin-bridge.js" },
  { id: "visual-fx", contract: "shared/visual-fx/service.contract.json", integration: "DIRECT", entry: "shared/visual-fx/fx-blocks.js" },
  { id: "visual-grammar", matrix: "shared/visual-grammar/capability-matrix.json", integration: "ROUTABLE", entry: "shared/visual-grammar/visual-grammar-core.js" },
  { id: "visual-kernel", contract: "shared/visual-kernel/service.contract.json", integration: "ROUTABLE", entry: "shared/visual-kernel/visual-kernel.js" },
  { id: "visual-actions", contract: "shared/visual-actions/service.contract.json", integration: "ROUTABLE", entry: "shared/visual-actions/visual-actions.js" },
  { id: "aetherfx", manifest: "tools/aetherfx/manifest.json", contract: "tools/aetherfx/module.contract.json", integration: "DIRECT_WEB", entry: "tools/aetherfx/runtime/index.html" },
  { id: "visual-mold-foundry", manifest: "tools/visual-mold-foundry/manifest.json", contract: "tools/visual-mold-foundry/module.contract.json", integration: "ROUTABLE", entry: "tools/visual-mold-foundry/index.html" },
  { id: "pbr-material-baker", manifest: "tools/pbr-material-baker/manifest.json", contract: "tools/pbr-material-baker/module.contract.json", integration: "DIRECT", entry: "tools/pbr-material-baker/pbr-baker-core.mjs" },
  { id: "lighting-probe-baker", manifest: "tools/lighting-probe-baker/manifest.json", contract: "tools/lighting-probe-baker/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/lighting-probe-baker/index.html" },
  { id: "texture-trimsheet-decal-studio", manifest: "tools/texture-trimsheet-decal-studio/manifest.json", contract: "tools/texture-trimsheet-decal-studio/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/texture-trimsheet-decal-studio/index.html" },
  { id: "vfx-particle-shader-studio", manifest: "tools/vfx-particle-shader-studio/manifest.json", contract: "tools/vfx-particle-shader-studio/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/vfx-particle-shader-studio/index.html" },
  { id: "modern-asset-forge", manifest: "tools/modern-asset-forge/manifest.json", contract: "tools/modern-asset-forge/module.contract.json", integration: "CONDITIONAL_NATIVE", entry: "tools/modern-asset-forge/runner.js" },
  { id: "ps2-asset-forge", manifest: "tools/ps2-asset-forge/manifest.json", contract: "tools/ps2-asset-forge/module.contract.json", integration: "ROUTABLE", entry: "tools/ps2-asset-forge/index.html" },
  { id: "universal-object-fabric", manifest: "tools/universal-object-fabric/manifest.json", contract: "tools/universal-object-fabric/module.contract.json", integration: "ROUTABLE", entry: "tools/universal-object-fabric/index.html" },
  { id: "spatial-studio", manifest: "tools/spatial-studio/manifest.json", contract: "tools/spatial-studio/module.contract.json", integration: "ROUTABLE", entry: "tools/spatial-studio/index.html" },
  { id: "local-3d-game-runtime", manifest: "tools/local-3d-game-runtime/manifest.json", contract: "tools/local-3d-game-runtime/module.contract.json", integration: "DIRECT_WEB", entry: "tools/local-3d-game-runtime/native-renderer.mjs" },
  { id: "reference-to-3d-reconstruction-lab", manifest: "tools/reference-to-3d-reconstruction-lab/manifest.json", contract: "tools/reference-to-3d-reconstruction-lab/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/reference-to-3d-reconstruction-lab/index.html" },
  { id: "procedural-city-interior-studio", manifest: "tools/procedural-city-interior-studio/manifest.json", contract: "tools/procedural-city-interior-studio/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/procedural-city-interior-studio/index.html" },
  { id: "modular-environment-kit-builder", manifest: "tools/modular-environment-kit-builder/manifest.json", contract: "tools/modular-environment-kit-builder/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/modular-environment-kit-builder/index.html" },
  { id: "terrain-biome-studio", manifest: "tools/terrain-biome-studio/manifest.json", contract: "tools/terrain-biome-studio/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/terrain-biome-studio/index.html" },
  { id: "world-tile-foundry", manifest: "tools/world-tile-foundry/manifest.json", contract: "tools/world-tile-foundry/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/world-tile-foundry/index.html" },
  { id: "vehicle-assembly-damage-studio", manifest: "tools/vehicle-assembly-damage-studio/manifest.json", contract: "tools/vehicle-assembly-damage-studio/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/vehicle-assembly-damage-studio/index.html" },
  { id: "lod-hlod-impostor-builder", manifest: "tools/lod-hlod-impostor-builder/manifest.json", contract: "tools/lod-hlod-impostor-builder/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/lod-hlod-impostor-builder/index.html" },
  { id: "mesh-retopology-optimizer", manifest: "tools/mesh-retopology-optimizer/manifest.json", contract: "tools/mesh-retopology-optimizer/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/mesh-retopology-optimizer/index.html" },
  { id: "uv-lightmap-studio", manifest: "tools/uv-lightmap-studio/manifest.json", contract: "tools/uv-lightmap-studio/module.contract.json", integration: "SCENARIO_ONLY", entry: "tools/uv-lightmap-studio/index.html" },
  { id: "technical-art-validator", manifest: "tools/technical-art-validator/manifest.json", contract: "tools/technical-art-validator/module.contract.json", integration: "ROUTABLE", entry: "tools/technical-art-validator/index.html" },
  { id: "css-skin-fabric", manifest: "shared/css-skin-fabric/manifest.json", contract: "shared/css-skin-fabric/module.contract.json", integration: "ROUTABLE", entry: "shared/css-skin-fabric/index.html" },
  { id: "text-fabric", manifest: "tools/text-fabric/manifest.json", contract: "tools/text-fabric/module.contract.json", integration: "ROUTABLE", entry: "tools/text-fabric/index.html" },
  { id: "ui-fx", manifest: "tools/ui-fx/manifest.json", contract: "tools/ui-fx/module.contract.json", integration: "ROUTABLE", entry: "tools/ui-fx/index.html" }
];

function sourceDocument(relative) {
  if (!relative) return null;
  const absolute = path.join(workshop, relative);
  return fs.existsSync(absolute) ? readJson(relative) : null;
}

function adapterRecord(source) {
  const manifest = sourceDocument(source.manifest);
  const contract = sourceDocument(source.contract);
  const matrix = sourceDocument(source.matrix);
  const id = source.id;
  return {
    id,
    name: manifest?.name || contract?.name || id,
    version: String(manifest?.version || contract?.version || manifest?.module_id && manifest?.version || "unversioned"),
    lifecycle_status: String(manifest?.status || contract?.status || "TEST"),
    integration: source.integration,
    entry: source.entry,
    provides: [...new Set([...(contract?.provides || []), ...(manifest?.capabilities || []), ...(matrix?.capabilities || [])])].sort(),
    accepts: [...new Set([...(manifest?.accepts || []), ...(contract?.accepts || []), ...(contract?.consumes || [])])].sort(),
    produces: [...new Set([...(manifest?.produces || []), ...(contract?.produces || [])])].sort(),
    selftest: fs.existsSync(path.join(workshop, path.dirname(source.entry), "selftest.js")) || fs.existsSync(path.join(workshop, source.entry.replace(/[^/]+$/, "selftest.js"))),
    automatic_apply: false,
    canon_authority: false,
    source_digest: sha256(stableStringify({ manifest, contract, matrix }))
  };
}

const aetherglass = readJson("shared/aetherglass/MODULE_MANIFEST.json");
const aetherfx = readJson("tools/aetherfx/runtime/library/default-catalog.json");
const preskins = listPreskins().map((preset) => ({
  id: preset.id,
  name: preset.name,
  family: preset.family,
  tagline: preset.tagline,
  swatches: preset.swatches,
  intent: preset.intent,
  source: "shared/style-fabric"
}));
const treatments = listTreatmentMolds().map((mold) => ({ ...mold, source: "shared/style-fabric" }));
const pbrFamilies = Object.entries(MATERIAL_FAMILIES).map(([id, value]) => ({ id, ...value, source: "tools/pbr-material-baker" }));
const portableFx = Object.keys(VisualFX.Blocks).sort().map((id) => {
  const output = VisualFX.Blocks[id]({});
  return { id, kind: output.kind, css: Boolean(output.css), svg: Boolean(output.svgFilter || output.svgDefs), tokens: Boolean(output.tokens), source: "shared/visual-fx" };
});

const catalog = {
  schema: "axm.visual-capability-catalog/v1",
  version: "1.0.0",
  status: "EXPERIMENTAL",
  style_presets: preskins,
  treatment_molds: treatments,
  style_fabric: {
    performance_profiles: listPerformanceProfiles(),
    skin_molds: listSkinMolds().map((mold) => ({ id: mold.id, name: mold.name, scopes: mold.scopes })),
    game_surface_categories: listGameSurfaceCategories()
  },
  aetherfx_modules: aetherfx.modules.map((module) => ({
    id: module.id,
    name: module.name,
    kind: module.kind,
    category: module.category,
    parameters: module.parameters || [],
    quality: module.quality || {},
    renderer: module.renderer || null,
    source: "tools/aetherfx"
  })),
  portable_fx_blocks: portableFx,
  pbr_material_families: pbrFamilies,
  aetherglass: {
    version: aetherglass.version,
    visual_axes: aetherglass.visual_axes,
    capabilities: aetherglass.capabilities,
    production_presets: aetherglass.production_presets,
    authoring_blueprints: aetherglass.authoring_blueprints,
    storycraft: aetherglass.storycraft_layer,
    storycraft_journeys: aetherglass.storycraft_journeys,
    shared_runtime_scope: ["core-atmosphere", "luminous-layer-forge"],
    full_release_scope: "available as source data; not silently mounted into games"
  },
  adapters: adapterSources.map(adapterRecord),
  routing_policy: {
    exact_ids_only: true,
    nearest_substitution: false,
    declared_is_not_executed: true,
    conditional_substrates_remain_conditional: true,
    human_visual_review_required: true
  },
  authority: { candidate_only: true, installed: false, promoted: false, canonical: false }
};
catalog.counts = {
  style_presets: catalog.style_presets.length,
  treatment_molds: catalog.treatment_molds.length,
  aetherfx_modules: catalog.aetherfx_modules.length,
  portable_fx_blocks: catalog.portable_fx_blocks.length,
  pbr_material_families: catalog.pbr_material_families.length,
  adapters: catalog.adapters.length
};
catalog.digest = sha256(catalog);

const jsonPath = path.join(here, "visual-capability-catalog.generated.json");
const jsPath = path.join(here, "visual-capability-catalog.generated.js");
fs.writeFileSync(jsonPath, stableStringify(catalog, 2) + "\n");
const payload = stableStringify(catalog);
fs.writeFileSync(jsPath, `(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AXMVisualCapabilityCatalog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';return Object.freeze(${payload});});\n`);
console.log(JSON.stringify({ status: "PASS", counts: catalog.counts, digest: catalog.digest, files: [path.relative(workshop, jsonPath), path.relative(workshop, jsPath)] }, null, 2));
