#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Protocol = require("./element-protocol");
const UCP = require("../asset-hands/universal-component");
const categories = require("./category-registry.json");
const catalog = require("./core-element-seeds.json");

assert.deepEqual(Protocol.validateCategoryRegistry(categories), { pass: true, errors: [] });
assert.equal(categories.categories.length, 8);
assert.equal(catalog.seeds.length, 16);

const createdAt = "2026-07-23T00:00:00.000Z";
const sourceDigest = Protocol.sha256("axm-element-core-catalog-v1");
function seal(seed) {
  const category = categories.categories.find((item) => item.id === seed.category);
  return Protocol.sealElement(Object.assign({
    version: "1.0.0",
    dependencies: [],
    artifact_refs: [],
    provenance: { origin_type: "authored", source_id: "axm-element-core-catalog-v1", source_digest: sourceDigest, license_id: "AXM-LOCAL", created_by: "axiom-mir", created_at: createdAt },
    resource_profile: { cpu: "light", gpu: "none", peak_memory_bytes: 4096, working_storage_bytes: 4096, native_runtime: null },
    verification: { category_verifier: category.verifier, automatic_checks: ["schema-and-digest", "category-facet-fit"], human_judgments: ["meaning and appearance in intended context"], assurance_ceiling: "contract and deterministic structure; rendered quality requires live review" },
    mutability: "versioned",
  }, seed), categories);
}

const elements = catalog.seeds.map(seal);
const covered = Array.from(new Set(elements.map((element) => element.category))).sort();
assert.deepEqual(covered, categories.categories.map((category) => category.id).sort());
elements.forEach((element) => {
  assert(Protocol.validateElement(element, categories).pass, element.id);
  const component = Protocol.toUniversalComponent(element, categories);
  assert(UCP.validateComponent(component).pass, element.id + " UCP adaptation");
  assert.equal(component.kind, "element." + element.category + "." + element.kind);
  assert.equal(component.payload.element_schema, Protocol.ELEMENT_SCHEMA);
});

const registry = Protocol.createRegistry(categories, elements);
assert.equal(registry.list().length, 16);
assert.throws(() => registry.register(Object.assign({}, elements[0], { title: "Collision" })), /digest mismatch/);
const validCollision = seal(Object.assign({}, catalog.seeds[0], { title: "Same version, different sealed content" }));
assert.throws(() => registry.register(validCollision), /version collision/);

const chosen = [
  registry.get("axm.element.visual.cosmic-field", "1.0.0"),
  registry.get("axm.element.interface.command-panel", "1.0.0"),
  registry.get("axm.element.content.identity-title", "1.0.0"),
  registry.get("axm.element.interaction.primary-action", "1.0.0"),
];
const composition = Protocol.sealComposition({
  id: "axm.element-composition.future-nexus",
  title: "Future Nexus",
  target: { context: "tool", canvas: "screen-2d", allowed_categories: categories.categories.map((category) => category.id) },
  elements: chosen.map((element, index) => ({ instance_id: "element-" + (index + 1), element_id: element.id, element_version: element.version, element_digest: element.digest, configuration: {} })),
  placements: chosen.map((element, index) => ({ instance_id: "element-" + (index + 1), region: index === 0 ? "background" : "primary", order: index, configuration: {} })),
  bindings: [],
  outputs: [{ id: "surface", instance_id: "element-2", port: "surface", role: "editable-interface-surface" }],
});
const validation = Protocol.validateComposition(composition, registry);
assert.deepEqual(validation.errors, []);
const receipt = Protocol.compose(composition, registry, categories, { createdAt });
assert.equal(receipt.status, "READY_CONTRACT");
assert.equal(receipt.ucp_components.length, 4);
assert.equal(receipt.truth.rendered, false);
assert.equal(receipt.truth.visually_approved, false);
assert.equal(receipt.truth.installed, false);
assert(Protocol.validateReceipt(receipt, composition).pass);

const missing = Protocol.sealComposition(Object.assign({}, composition, {
  elements: composition.elements.map((item, index) => index ? item : Object.assign({}, item, { element_digest: "0".repeat(64) })),
  digest: undefined,
}));
assert.equal(Protocol.compose(missing, registry, categories, { createdAt }).status, "MISSING_ELEMENT");

const conflict = Protocol.sealComposition(Object.assign({}, composition, {
  target: { context: "tool", canvas: "screen-2d", allowed_categories: ["interface", "content", "interaction"] },
  digest: undefined,
}));
assert.equal(Protocol.compose(conflict, registry, categories, { createdAt }).status, "CATEGORY_CONFLICT");

const unknownCategory = Protocol.sealComposition(Object.assign({}, composition, {
  target: { context: "tool", canvas: "screen-2d", allowed_categories: categories.categories.map((category) => category.id).concat(["undeclared-category"]) },
  digest: undefined,
}));
assert.equal(Protocol.compose(unknownCategory, registry, categories, { createdAt }).status, "CATEGORY_CONFLICT");

const malformedCollections = Protocol.sealComposition(Object.assign({}, composition, {
  bindings: { not: "an array" },
  digest: undefined,
}));
const malformedValidation = Protocol.validateComposition(malformedCollections, registry);
assert.equal(malformedValidation.pass, false);
assert.match(malformedValidation.errors.join("; "), /bindings must be an array/);

assert.throws(() => seal(Object.assign({}, catalog.seeds[0], {
  id: "axm.element.bad.script",
  facets: { behavior: { action: "javascript:alert(1)" } },
})), /declarative/);
assert.throws(() => seal(Object.assign({}, catalog.seeds[0], {
  id: "axm.element.bad.category",
  category: "fabrication",
})), /not allowed|requires one of/);
assert.throws(() => seal(Object.assign({}, catalog.seeds[0], {
  id: "axm.element.bad.path",
  artifact_refs: [{ id: "source", role: "image", mime: "image/png", digest: Protocol.sha256("source"), storage_ref: "C:\\private\\source.png", bytes: 10 }],
})), /storage_ref must be portable/);
assert.throws(() => Protocol.sealElement(Object.assign({}, elements[0], {
  provenance: Object.assign({}, elements[0].provenance, { origin_type: "mystery" }),
  digest: undefined,
}), categories), /origin_type/);
assert.throws(() => Protocol.sealElement(Object.assign({}, elements[0], {
  resource_profile: Object.assign({}, elements[0].resource_profile, { peak_memory_bytes: -1 }),
  digest: undefined,
}), categories), /peak_memory_bytes/);

console.log("AXM Modular Element Protocol selftest PASS (8 declared category routes, 16 seeds, separated facets, exact registry, fail-closed composition, UCP adaptation and contract-only receipts)");
