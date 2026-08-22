"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const Fabric = require("./index.js");
const Blocks = require("../procedural-animation-blocks/index.js");

const fixturePath = path.join(__dirname, "fixtures", "modular-motion.recipe.json");
const recipe = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFailure(mutator, pattern) {
  const candidate = clone(recipe);
  mutator(candidate);
  assert.throws(() => Fabric.compileRecipe(candidate), pattern);
}

const compiled = Fabric.compileRecipe(recipe);
assert.equal(compiled.schema, "axm.deterministic-animation-compiled/v1");
assert.equal(compiled.recipe_digest, "fnv1a32:553e327b");
assert.equal(compiled.timebase.ticks_per_frame, 1000);
assert.equal(compiled.timebase.frame_count, 24);
assert.equal(compiled.nodes.some((node) => node.id === "horizontal/wave"), true);
assert.equal(compiled.nodes.some((node) => node.id === "vertical/value"), true);
assert.equal(compiled.determinism.call_time_randomness, false);
assert.equal(Object.isFrozen(compiled), true);

const reorderedKeys = JSON.parse(Fabric.canonicalStringify(recipe));
assert.equal(Fabric.compileRecipe(reorderedKeys).recipe_digest, compiled.recipe_digest);

const firstBake = Fabric.bake(compiled);
const secondBake = Fabric.bake(recipe);
assert.deepEqual(firstBake, secondBake);
assert.equal(firstBake.digest, "fnv1a32:f744814a");
assert.equal(firstBake.frames.length, 24);
assert.equal(firstBake.tracks.length, 5);
assert.equal(firstBake.events[1].frame_index, 12);
assert.equal(firstBake.authority.canonical, false);
assert.equal(firstBake.tracks.every((track) => track.samples_i.every(Number.isSafeInteger)), true);

const shuffledTick = firstBake.frames[7].tick;
const expectedFrame = firstBake.frames[7];
Fabric.sampleCompiled(compiled, firstBake.frames[19].tick);
const replayed = Fabric.sampleCompiled(compiled, shuffledTick);
assert.deepEqual(
  Object.fromEntries(replayed.values.map((value) => [value.id, value.value_i])),
  expectedFrame.values_i,
  "sampling must not depend on call order or elapsed-time partitioning",
);

const changedSeed = clone(recipe);
changedSeed.seed = "axm-motion-proof-02";
assert.notEqual(Fabric.bake(changedSeed).digest, firstBake.digest);
const unchangedSeed = clone(recipe);
assert.equal(Fabric.bake(unchangedSeed).digest, firstBake.digest);

const css = Fabric.renderCssKeyframes(firstBake);
const svg = Fabric.renderFilmstripSvg(firstBake, recipe.presentation);
assert.equal(css, Fabric.renderCssKeyframes(secondBake));
assert.equal(svg, Fabric.renderFilmstripSvg(secondBake, recipe.presentation));
assert.match(css, /@keyframes axm-motion-mark/);
assert.match(css, /100%/);
assert.match(svg, /deterministic animation filmstrip/);
assert.match(svg, /f23/);

const receipt = Fabric.verify(recipe);
assert.equal(receipt.status, "PASS");
assert.equal(receipt.bake_digest, firstBake.digest);
assert.equal(receipt.checks.find((check) => check.id === "repeat-bake").status, "PASS");
assert.ok(receipt.claims.does_not_prove.includes("motion taste"));
assert.equal(receipt.authority.human_visual_review_required, true);

const adapted = Fabric.fromProceduralMotion(Blocks.create("idle-bob").payload, {
  id: "adapted-idle-bob",
  target: "body",
  duration_ms: 2200,
  frames_per_second: 20,
  mappings: { offsetY: { property: "transform.y", unit: "px" } },
});
const adaptedCompiled = Fabric.compileRecipe(adapted);
const adaptedBake = Fabric.bake(adaptedCompiled);
assert.equal(adapted.adapter.source_schema, "axm.procedural-motion/v1");
assert.equal(adapted.adapter.losses.length, 1);
assert.equal(adaptedCompiled.tracks[0].property, "transform.y");
assert.equal(adaptedBake.frames.length, 45);
assert.equal(Fabric.verify(adapted).status, "PASS");

const generated = Fabric.createCandidateRecipe({
  id: "generated-motion-proof",
  seed: "candidate-seed",
  width: 96,
  height: 64,
  frames_per_second: 24,
  frame_count: 48,
});
assert.equal(Fabric.verify(generated).status, "PASS");
assert.deepEqual(Fabric.createCandidateRecipe({ id: "generated-motion-proof", seed: "candidate-seed", width: 96, height: 64, frames_per_second: 24, frame_count: 48 }), generated);

const composition = Fabric.createCandidateComposition({
  id: "layered-motion-proof",
  seed: "composition-seed",
  width: 96,
  height: 96,
  frames_per_second: 30,
  frame_count: 60,
});
const compiledComposition = Fabric.compileComposition(composition);
const compositionBake = Fabric.bakeComposition(compiledComposition);
assert.equal(Fabric.ENGINE_VERSION, "1.1.0");
assert.equal(Fabric.COMPOSITION_SCHEMA, "axm.deterministic-animation-composition/v1");
assert.equal(compiledComposition.composition_digest, "fnv1a32:d11e6e38");
assert.equal(compositionBake.digest, "fnv1a32:a29cd768");
assert.equal(compiledComposition.sources.length, 2);
assert.equal(compiledComposition.layers.length, 2);
assert.deepEqual(compiledComposition.layers.map((layer) => layer.playback), ["loop", "ping-pong"]);
assert.equal(Fabric.verifyComposition(composition).status, "PASS");
assert.deepEqual(Fabric.bake(composition), compositionBake, "generic bake dispatch must preserve composition semantics");
assert.deepEqual(
  Fabric.sampleComposition(compiledComposition, compositionBake.frames[17].tick),
  Fabric.sampleComposition(compiledComposition, compositionBake.frames[17].tick),
);
assert.ok(compiledComposition.losses.some((loss) => /events are not implicitly remapped/.test(loss)));

const halfSpeed = clone(composition);
halfSpeed.id = "half-speed-proof";
halfSpeed.layers = [clone(halfSpeed.layers[0])];
halfSpeed.layers[0].rate = { numerator: 1, denominator: 2 };
halfSpeed.layers[0].playback = "clamp";
const halfCompiled = Fabric.compileComposition(halfSpeed);
const halfSample = Fabric.sampleComposition(halfCompiled, 2000);
const halfSource = Fabric.sampleCompiled(halfCompiled.sources.find((source) => source.id === "primary").compiled, 1000);
assert.deepEqual(
  halfSample.values.map((value) => value.value_i),
  halfSource.values.map((value) => value.value_i),
  "rational layer time mapping must sample the exact source tick",
);

const additive = clone(composition);
additive.id = "fixed-blend-proof";
additive.sources[0].recipe.nodes = [{ id: "value", type: "constant", value: 10 }];
additive.sources[0].recipe.instances = [];
additive.sources[0].recipe.tracks = [{ id: "value-track", target: "hero", property: "transform.x", node: "value", unit: "px" }];
additive.sources[0].recipe.events = [];
additive.sources[1].recipe.nodes = [{ id: "value", type: "constant", value: 4 }];
additive.sources[1].recipe.instances = [];
additive.sources[1].recipe.tracks = [{ id: "value-track", target: "hero", property: "transform.x", node: "value", unit: "px" }];
additive.sources[1].recipe.events = [];
additive.layers[1].properties = ["transform.x"];
additive.layers[1].playback = "clamp";
additive.layers[1].rate = { numerator: 1, denominator: 1 };
additive.layers[1].source_in_tick = 0;
additive.layers[1].weight = 0.5;
assert.equal(Fabric.sampleComposition(Fabric.compileComposition(additive), 0).values[0].value_i, 12 * Fabric.PRECISION);

const atlasOptions = {
  frame_width: 96,
  frame_height: 96,
  image: "layered-motion-proof-atlas.svg",
  name: "Layered Motion Proof",
};
const atlasManifest = Fabric.createSpriteAtlasManifest(compositionBake, atlasOptions);
const atlasSvg = Fabric.renderSpriteAtlasSvg(compositionBake, Object.assign({}, atlasOptions, composition.presentation));
assert.equal(atlasManifest.schema, "axm.sprite-atlas/v1");
assert.equal(atlasManifest.frameCount, compositionBake.frames.length);
assert.equal(atlasManifest.frames.length, compositionBake.frames.length);
assert.equal(atlasManifest.frames[59].id, "frame-0059");
assert.match(atlasSvg, /deterministic sprite atlas/);
assert.match(atlasSvg, new RegExp(compositionBake.digest));
assert.equal(atlasSvg, Fabric.renderSpriteAtlasSvg(compositionBake, Object.assign({}, atlasOptions, composition.presentation)));
const overAtlasBoundary = Fabric.bake(Fabric.createCandidateRecipe({ id: "over-atlas-boundary", seed: "bounded", width: 16, height: 16, frames_per_second: 30, frame_count: 257 }));
assert.throws(() => Fabric.renderSpriteAtlasSvg(overAtlasBoundary, { frame_width: 16, frame_height: 16 }), /256 frame boundary/);

expectFailure((candidate) => {
  candidate.timebase.ticks_per_second = 1000;
}, /exactly divisible/);
expectFailure((candidate) => {
  candidate.nodes.push({ id: "cycle-a", type: "abs", input: "cycle-b" });
  candidate.nodes.push({ id: "cycle-b", type: "abs", input: "cycle-a" });
}, /animation node cycle/);
expectFailure((candidate) => {
  candidate.tracks[1].target = candidate.tracks[0].target;
  candidate.tracks[1].property = candidate.tracks[0].property;
}, /exactly one deterministic track/);
expectFailure((candidate) => {
  candidate.instances[0].parameters.typo = 1;
}, /unknown parameter typo/);
expectFailure((candidate) => {
  candidate.instances[0].block = "missing.block/v1";
}, /unknown animation block/);

const missingCompositionSource = clone(composition);
missingCompositionSource.layers[0].source = "absent";
assert.throws(() => Fabric.compileComposition(missingCompositionSource), /missing source absent/);
const invalidCompositionWeight = clone(composition);
invalidCompositionWeight.layers[0].weight = 1.01;
assert.throws(() => Fabric.compileComposition(invalidCompositionWeight), /weight must stay between zero and one/);

const childScript = [
  "const fs=require('node:fs')",
  "const F=require(" + JSON.stringify(path.join(__dirname, "index.js")) + ")",
  "const r=JSON.parse(fs.readFileSync(" + JSON.stringify(fixturePath) + ",'utf8'))",
  "process.stdout.write(F.bake(r).digest)",
].join(";");
const child = spawnSync(process.execPath, ["-e", childScript], { encoding: "utf8" });
assert.equal(child.status, 0, child.stderr);
assert.equal(child.stdout, firstBake.digest, "a fresh Node process must reproduce the bake digest");

const compositionChildScript = [
  "const F=require(" + JSON.stringify(path.join(__dirname, "index.js")) + ")",
  "const c=F.createCandidateComposition({id:'layered-motion-proof',seed:'composition-seed',width:96,height:96,frames_per_second:30,frame_count:60})",
  "process.stdout.write(F.bakeComposition(c).digest)",
].join(";");
const compositionChild = spawnSync(process.execPath, ["-e", compositionChildScript], { encoding: "utf8" });
assert.equal(compositionChild.status, 0, compositionChild.stderr);
assert.equal(compositionChild.stdout, compositionBake.digest, "a fresh Node process must reproduce the composition bake digest");

for (const schemaFile of ["recipe.schema.json", "composition.schema.json", "bake.schema.json", "verification.schema.json", "service.contract.json"])
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(__dirname, schemaFile), "utf8")));

console.log(
  "Deterministic Animation Fabric selftest PASS " +
    "(fixed ticks, fixed-point DAG, clip layers, rational time remap, ordered blends, sprite atlas, cross-process digests, authority gate open)",
);
