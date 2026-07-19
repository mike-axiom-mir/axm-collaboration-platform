'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const digest = (bytes) => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;

function parseGlb(name) {
  const bytes = fs.readFileSync(path.join(root, name));
  assert.strictEqual(bytes.toString('utf8', 0, 4), 'glTF', `${name}: magic`);
  assert.strictEqual(bytes.readUInt32LE(4), 2, `${name}: version`);
  assert.strictEqual(bytes.readUInt32LE(8), bytes.length, `${name}: declared length`);
  const jsonLength = bytes.readUInt32LE(12);
  assert.strictEqual(bytes.toString('utf8', 16, 20), 'JSON', `${name}: JSON chunk`);
  return { bytes, document: JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)) };
}

(async () => {
  const manifest = json('manifest.json');
  const contract = json('module.contract.json');
  const catalog = json('generated/source-catalog.json');
  const sourceManifest = json('generated/source-manifest.json');
  const html = read('index.html');
  const app = read('app.js');
  const postProcess = read('post-process.mjs');

  assert.strictEqual(manifest.id, 'ps2-asset-forge');
  assert.strictEqual(manifest.category, 'Create');
  assert.deepStrictEqual(manifest.permissions, contract.permissions);
  assert(contract.boundaries.refuses.includes('automatic-generated-variant-retention'));
  assert(contract.boundaries.refuses.includes('glb-export-before-human-approval'));

  assert.strictEqual(catalog.schema, 'axm.ps2-asset-forge.catalog/v1');
  assert.strictEqual(catalog.policy.runtimeNetworkRequired, false);
  assert(catalog.assets.length >= 280, 'expected a broad curated source pool');
  assert(catalog.assets.length < 350, 'unused prototype volume should remain pruned');
  assert(catalog.packs.length >= 5, 'expected independent source packs');
  assert(!catalog.packs.some((pack) => pack.id === 'kenney-prototype-kit'), 'gray-box prototype pack must stay pruned');
  assert(catalog.kinds.vehicle >= 20);
  assert(catalog.kinds.building >= 10);
  assert(catalog.kinds.road >= 50);
  assert(catalog.kinds.pedestrian >= 4);
  assert(catalog.totals.animatedAssets >= 4);
  assert(catalog.totals.texturedAssets >= 280);
  const ids = catalog.assets.map((asset) => asset.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'source ids must be unique');
  assert(catalog.assets.every((asset) => asset.license === 'CC0-1.0'));
  assert(catalog.assets.every((asset) => !/^https?:/i.test(asset.model)));

  for (const asset of catalog.assets) {
    const modelPath = path.join(root, asset.model);
    assert(fs.existsSync(modelPath), `${asset.id}: missing local model`);
    assert.strictEqual(digest(fs.readFileSync(modelPath)), asset.sha256, `${asset.id}: digest drift`);
  }
  assert.strictEqual(sourceManifest.runtimeNetworkRequired, false);
  assert(sourceManifest.files.length >= catalog.assets.length);

  assert(html.includes('id="export-glb" disabled'));
  assert(html.includes('source parts'));
  assert(html.includes('<option value="native">PS2 Native</option>'));
  assert(html.includes('<option value="preview">PS3 Preview</option>'));
  assert(html.includes('<option value="high">PS3 High Preview</option>'));
  assert(html.includes('ALPHA 02'));
  assert(app.includes('preview only exists in memory'));
  assert(app.includes('dom.exportGlb.disabled = verdict !== \'approved\''));
  assert(app.includes("if (!exportRoot.children.length || dom.exportGlb.disabled) return;"));
  assert(!/fetch\(['\"]https?:/i.test(app), 'runtime must not fetch remote sources');
  assert(!/https?:\/\//i.test(postProcess), 'post stack must remain local-first');
  assert(postProcess.includes("initialProfile = 'native'"), 'PS2-native rendering must remain the default');
  assert(postProcess.includes('WebGLRenderTarget'));
  assert(postProcess.includes('#include <colorspace_fragment>'), 'final composite must encode for the display color space');
  assert(postProcess.includes('#include <tonemapping_fragment>'), 'final composite must apply the renderer tone map exactly once');
  assert(postProcess.includes('bloomScale: 0.35'));
  assert(postProcess.includes('bloomScale: 0.6'));
  assert(postProcess.includes('type: THREE.HalfFloatType'), 'linear scene and bloom targets must preserve highlights before tone mapping');
  assert(!postProcess.includes('upgradeMaterials'), 'post stack must not rewrite source materials');
  assert(!postProcess.includes('DirectionalLight'), 'post stack must not duplicate scene lighting');

  const core = await import(`file://${path.join(root, 'forge-core.mjs').replace(/\\/g, '/')}`);
  const post = await import(`file://${path.join(root, 'post-process.mjs').replace(/\\/g, '/')}`);
  assert.deepStrictEqual(Object.keys(post.RENDER_PROFILES), ['native', 'preview', 'high']);
  assert.strictEqual(post.RENDER_PROFILES.native.post, false);
  assert.strictEqual(post.RENDER_PROFILES.preview.post, true);
  assert.strictEqual(post.RENDER_PROFILES.high.post, true);
  const first = core.createRecipe({ seed: 'same', target: 'street', palette: 'rust', wear: 42, density: 3 });
  const second = core.createRecipe({ seed: 'same', target: 'street', palette: 'rust', wear: 42, density: 3 });
  assert.deepStrictEqual(first, second, 'recipe must be deterministic');
  assert.strictEqual(first.runtimeNetworkRequired, false);
  assert.strictEqual(first.retentionPolicy.previewPersistence, 'memory-only-replaced-on-next-forge');
  assert.strictEqual(first.retentionPolicy.automaticPromotion, false);
  assert.strictEqual(first.retentionPolicy.exportRequiresHumanApproval, true);
  assert.strictEqual(core.validateRecipe(first).ok, true);
  const handoff = core.buildHandoff(first, []);
  assert.strictEqual(handoff.constraints.generatedVariantsAreRetainedAutomatically, false);

  const pedestrian = parseGlb('proof/exports/animated-pedestrian.glb');
  assert(pedestrian.document.skins?.length > 0, 'pedestrian export must preserve skins');
  assert(pedestrian.document.animations?.length >= 1, 'pedestrian export must preserve animation');
  const pedestrianReceipt = json('proof/exports/animated-pedestrian.recipe.json');
  assert.strictEqual(pedestrianReceipt.recipe.retentionPolicy.automaticPromotion, false);
  assert.strictEqual(pedestrianReceipt.handoff.constraints.generatedVariantsAreRetainedAutomatically, false);
  const storefront = parseGlb('proof/exports/storefront-technical-proof.glb');
  assert(storefront.document.textures?.length >= 1, 'storefront export must embed generated textures');
  assert(storefront.document.images?.length >= 1, 'storefront export must embed generated images');

  for (const proof of ['street-benchmark-final.jpg', 'storefront-benchmark-final.jpg', 'storefront-night-final.jpg', 'pedestrian-frame-a.jpg', 'pedestrian-frame-b.jpg', 'postprocess-ps2-native.jpg', 'postprocess-ps3-preview.jpg']) {
    assert(fs.statSync(path.join(root, 'proof', proof)).size > 30000, `${proof}: visual proof is unexpectedly small`);
  }

  console.log(`PS2 Asset Forge selftest: PASS (${catalog.assets.length} source parts, ${catalog.packs.length} packs, preview retention gated, 2 GLB proofs)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
