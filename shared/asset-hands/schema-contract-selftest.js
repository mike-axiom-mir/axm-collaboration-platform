#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Hands = require('./asset-hands');
const contract = require('./service.contract.json');

const root = __dirname;
const sharedRoot = path.resolve(root, '..');
const schemas = new Map();

function readSchema(filename) {
  const absolute = path.resolve(root, filename);
  const relative = path.relative(sharedRoot, absolute);
  assert(relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative), 'schema path must remain inside shared modules');
  const schema = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  schemas.set(filename, schema);
  return schema;
}

function pointer(document, fragment) {
  if (!fragment || fragment === '#') return document;
  assert(fragment.startsWith('#/'), 'only local JSON Pointer fragments are supported');
  return fragment.slice(2).split('/').reduce((value, part) => {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    assert(value && Object.prototype.hasOwnProperty.call(value, key), 'missing schema pointer ' + fragment);
    return value[key];
  }, document);
}

function walkReferences(value, sourceFile) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.$ref === 'string' && !/^https?:/.test(value.$ref)) {
    const parts = value.$ref.split('#');
    const targetFile = parts[0] || sourceFile;
    const target = schemas.get(targetFile) || readSchema(targetFile);
    pointer(target, parts.length > 1 ? '#' + parts[1] : '#');
  }
  Object.keys(value).forEach(key => walkReferences(value[key], sourceFile));
}

const ids = new Set();
Object.entries(contract.schemaFiles).forEach(([schemaId, filename]) => {
  assert(!path.isAbsolute(filename), 'schema declaration must be portable');
  const schema = readSchema(filename);
  assert.equal(typeof schema.$id, 'string', filename + ' must declare a portable JSON Schema id');
  if (schema.properties && schema.properties.schema && schema.properties.schema.const) {
    assert.equal(schema.properties.schema.const, schemaId, filename + ' runtime schema tag must match the service contract');
  }
  assert(!ids.has(schema.$id), 'schema ids must be unique');
  ids.add(schema.$id);
});
schemas.forEach((schema, filename) => walkReferences(schema, filename));

function required(schemaId, value, label) {
  const filename = contract.schemaFiles[schemaId];
  const schema = schemas.get(filename);
  assert(schema, label + ' schema must be declared');
  (schema.required || []).forEach(key => assert(Object.prototype.hasOwnProperty.call(value, key), label + ' is missing ' + key));
  if (schema.properties && schema.properties.schema && schema.properties.schema.const) assert.equal(value.schema, schema.properties.schema.const, label + ' schema tag');
}

const createdAt = '2026-07-19T00:00:00.000Z';
const host = {capabilities:['svg','json','canvas-2d'], permissions:[], accepts:[Hands.RESULT_SCHEMA,'image/svg+xml','application/json']};
const brief = Hands.normalizeBrief({
  id:'schema-contract-proof', title:'Schema contract proof', kind:'icon', intended_use:'icon',
  target_canvas:{medium:'ui',dimensions:{width:64,height:64,unit:'px'},colour:{space:'srgb',transparency:'required',minimum_contrast_ratio:4.5},behaviour:['static','responsive'],intended_use:'icon'},
  required_outputs:['image/svg+xml'], editable_recipe_formats:['axm.vector-geometry-recipe/v1']
});
const result = Hands.create('vector-form', brief, {seed:'schema-contract-proof', createdAt, host});
const family = Hands.createFamily(brief, {seed:'schema-contract-family', createdAt, host, maxHands:2});
required('axm.asset-brief/v1', brief, 'normalized brief');
required('axm.asset-hand-result/v1', result, 'hand result');
required('axm.asset-hand-family/v1', family, 'hand family');
required('axm.asset-hand/v2', result.hand, 'hand descriptor');
required('axm.asset-artifact/v1', result.artifacts[0], 'artifact');
required('axm.asset-creation-recipe/v1', result.creation_recipe, 'creation recipe');
required('axm.asset-validation-receipt/v1', result.validation_receipt, 'validation receipt');
assert.equal(result.status, 'READY');
assert.equal(result.validation_receipt.status, 'PASS');
assert.equal(family.status, 'READY');

console.log('Asset Hands schema contract selftest PASS (' + schemas.size + ' schemas, all local references resolved)');
