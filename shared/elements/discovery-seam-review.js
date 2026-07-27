#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const categories = require("./category-registry.json");
const registry = require("../verification-spine/registry.json");

const elementPack = path.join(__dirname, "..", "verification-spine", "category-packs", "element.json");
assert(fs.existsSync(path.join(__dirname, "element.schema.json")), "element schema exists");
assert(fs.existsSync(path.join(__dirname, "element-composition.schema.json")), "composition schema exists");
assert(fs.existsSync(path.join(__dirname, "element-receipt.schema.json")), "receipt schema exists");
assert(fs.existsSync(elementPack), "element verification category pack exists");
assert(registry.categories.some((entry) => entry.id === "element" && entry.path === "category-packs/element.json"), "verification registry exposes element category");
assert.equal(categories.categories.length, 8, "initial taxonomy remains explicit");
assert(categories.categories.every((category) => category.verifier && category.required_any.length), "every category owns a verifier and facet gate");
console.log("AXM Element discovery seam review PASS (schemas, taxonomy, category verification and registry exposure remain connected)");
