#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Composer = require("./play-composer");
const UCP = require("./universal-component");

const input = {
  title: "Human-made revive badge",
  label: "UP",
  shape: "diamond",
  primary: "#35e6ff",
  secondary: "#ff58c7",
  background: "#07101d",
  angle: 42,
  roundness: 0.31,
  scale: 0.66,
  stroke: 4,
  glow: 9,
  x: 0.48,
  y: 0.53,
};

const first = Composer.buildDraft(input);
const second = Composer.buildDraft(input);
assert.deepEqual(first, second, "same human controls must emit the same draft");
assert.equal(first.schema, Composer.DRAFT_SCHEMA);
assert.equal(first.components.length, 4);
assert(first.components.every((component) => UCP.validateComponent(component).pass));
assert(UCP.validateReceipt(first.receipt, first.graph).pass);
assert.equal(first.receipt.status, "READY_CONTRACT");
assert.equal(first.preview.ephemeral, true);
assert.equal(first.preview.persisted, false);
assert.equal(first.truth.ai_required, false);
assert.equal(first.truth.rendered_final, false);
assert.equal(first.truth.visually_approved, false);
assert(Composer.validateDraft(first).pass);

const changed = Composer.buildDraft(Object.assign({}, input, { angle: 43 }));
assert.notEqual(changed.input_digest, first.input_digest);
assert.notEqual(changed.graph.digest, first.graph.digest);
assert.notEqual(changed.preview.digest, first.preview.digest);

const directed = Composer.directedVariation(input, "silhouette", 3, 1);
const directedAgain = Composer.directedVariation(input, "silhouette", 3, 1);
assert.deepEqual(directed, directedAgain);
assert.equal(directed.growth_direction, "silhouette");
assert.equal(directed.growth_energy, 3);
assert.equal(directed.branch, 1);
assert(/^[a-f0-9]{64}$/.test(directed.parent_input_digest));
assert.notEqual(directed.shape, Composer.normalizeSpec(input).shape);
assert.equal(directed.primary, Composer.normalizeSpec(input).primary);
const directedDraft = Composer.buildDraft(directed);
assert.equal(
  directedDraft.components.find((component) => component.kind === "composition")
    .payload.growth.direction,
  "silhouette",
);

const tampered = JSON.parse(JSON.stringify(first));
tampered.preview.svg = tampered.preview.svg.replace("UP", "NO");
assert.equal(Composer.validateDraft(tampered).pass, false);

console.log(
  "AXM Play Composer selftest PASS (human controls -> deterministic UCP pieces -> typed graph -> ephemeral preview; zero AI dependency)",
);
