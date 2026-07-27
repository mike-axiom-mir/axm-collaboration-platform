'use strict';

const {
  fail,
  canonicalStringify,
  clone,
  digestValue,
  boundedJson
} = require('./util');

const PATCH_PLAN_SCHEMA = 'axm.module-evolution-ledger.bounded-patch-plan/v1';
const PATCH_RESULT_SCHEMA = 'axm.module-evolution-ledger.patch-evaluation/v1';
const ALLOWED_OPERATIONS = new Set(['set_if_missing', 'replace', 'remove', 'append_unique', 'add_unique_values']);
const FORBIDDEN_TOKENS = new Set(['__proto__', 'prototype', 'constructor']);
const MISSING = Symbol('missing');

function pointerTokens(pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/') || pointer.length > 512) {
    fail('INVALID_PATCH_PATH', 'Patch paths must be bounded JSON Pointers beginning with /');
  }
  const tokens = pointer.slice(1).split('/').map(token => token.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (!tokens.length || tokens.length > 12 || tokens.some(token => !token || FORBIDDEN_TOKENS.has(token))) {
    fail('INVALID_PATCH_PATH', 'Patch paths must contain 1-12 safe object-property tokens');
  }
  return tokens;
}

function readAt(document, pointer) {
  let cursor = document;
  for (const token of pointerTokens(pointer)) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor) || !Object.prototype.hasOwnProperty.call(cursor, token)) {
      return { exists: false, value: MISSING };
    }
    cursor = cursor[token];
  }
  return { exists: true, value: cursor };
}

function parentAt(document, pointer) {
  const tokens = pointerTokens(pointer);
  const leaf = tokens.pop();
  let cursor = document;
  for (const token of tokens) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor) || !Object.prototype.hasOwnProperty.call(cursor, token)) {
      return { exists: false, parent: null, leaf };
    }
    cursor = cursor[token];
  }
  if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return { exists: false, parent: null, leaf };
  return { exists: true, parent: cursor, leaf };
}

function setAt(document, pointer, value) {
  const location = parentAt(document, pointer);
  if (!location.exists) fail('PATCH_PARENT_CHANGED', `Parent object is unavailable at ${pointer}`);
  location.parent[location.leaf] = clone(value);
}

function removeAt(document, pointer) {
  const location = parentAt(document, pointer);
  if (!location.exists) fail('PATCH_PARENT_CHANGED', `Parent object is unavailable at ${pointer}`);
  delete location.parent[location.leaf];
}

function scalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function uniqueWitness(array, key) {
  if (key) {
    const identities = new Set();
    return array.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !Object.prototype.hasOwnProperty.call(item, key)) {
        fail('INVALID_PATCH_BASE', `append_unique base item ${index} does not expose key ${key}`);
      }
      const identity = canonicalStringify(item[key]);
      if (identities.has(identity)) fail('INVALID_PATCH_BASE', `append_unique base contains duplicate key ${identity}`);
      identities.add(identity);
      return { identity, digest: digestValue(item) };
    });
  }
  const digests = array.map(digestValue);
  if (new Set(digests).size !== digests.length) fail('INVALID_PATCH_BASE', 'append_unique base contains duplicate values');
  return digests.map(digest => ({ digest }));
}

function normalizeOperation(baseDocument, operation, index) {
  if (!operation || typeof operation !== 'object' || Array.isArray(operation)) fail('INVALID_PATCH', `Patch operation ${index} must be an object`);
  const op = String(operation.op || '');
  if (!ALLOWED_OPERATIONS.has(op)) fail('INVALID_PATCH', `Unsupported patch operation: ${op || '<empty>'}`);
  const path = String(operation.path || '');
  pointerTokens(path);
  const base = readAt(baseDocument, path);
  const normalized = { op, path };

  if (op === 'set_if_missing') {
    if (base.exists) fail('INVALID_PATCH_BASE', `set_if_missing path already exists in the declared base: ${path}`);
    if (!parentAt(baseDocument, path).exists) fail('INVALID_PATCH_BASE', `set_if_missing parent is absent from the declared base: ${path}`);
    normalized.value = boundedJson(operation.value, `operation ${index} value`, 16 * 1024);
    normalized.baseWitness = { kind: 'absent' };
  } else if (op === 'replace' || op === 'remove') {
    if (!base.exists) fail('INVALID_PATCH_BASE', `${op} path is absent from the declared base: ${path}`);
    if (op === 'replace') normalized.value = boundedJson(operation.value, `operation ${index} value`, 16 * 1024);
    normalized.baseWitness = { kind: 'exact', digest: digestValue(base.value) };
  } else if (op === 'append_unique') {
    const key = operation.key === undefined ? null : String(operation.key);
    if (key !== null && !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)) fail('INVALID_PATCH', 'append_unique key is invalid');
    if (base.exists && !Array.isArray(base.value)) fail('INVALID_PATCH_BASE', `append_unique target is not an array: ${path}`);
    if (!base.exists && !parentAt(baseDocument, path).exists) fail('INVALID_PATCH_BASE', `append_unique parent is absent from the declared base: ${path}`);
    normalized.value = boundedJson(operation.value, `operation ${index} value`, 16 * 1024);
    if (key && (!normalized.value || typeof normalized.value !== 'object' || Array.isArray(normalized.value) || !Object.prototype.hasOwnProperty.call(normalized.value, key))) {
      fail('INVALID_PATCH', `append_unique value must expose key ${key}`);
    }
    normalized.key = key;
    normalized.baseWitness = { kind: 'array-superset', wasAbsent: !base.exists, entries: uniqueWitness(base.exists ? base.value : [], key) };
  } else if (op === 'add_unique_values') {
    if (base.exists && (!Array.isArray(base.value) || !base.value.every(scalar))) fail('INVALID_PATCH_BASE', `add_unique_values target must be a scalar array: ${path}`);
    if (!base.exists && !parentAt(baseDocument, path).exists) fail('INVALID_PATCH_BASE', `add_unique_values parent is absent from the declared base: ${path}`);
    if (!Array.isArray(operation.values) || !operation.values.length || operation.values.length > 64 || !operation.values.every(scalar)) {
      fail('INVALID_PATCH', 'add_unique_values requires 1-64 scalar values');
    }
    normalized.values = boundedJson(operation.values, `operation ${index} values`, 16 * 1024);
    normalized.baseWitness = { kind: 'scalar-array-superset', wasAbsent: !base.exists, digests: (base.exists ? base.value : []).map(digestValue) };
  }
  return normalized;
}

function preparePatch(baseDocument, operations) {
  const base = boundedJson(baseDocument, 'base document', 256 * 1024);
  if (!Array.isArray(operations) || !operations.length || operations.length > 32) fail('INVALID_PATCH', 'Patch plan requires 1-32 operations');
  const normalized = operations.map((operation, index) => normalizeOperation(base, operation, index));
  const paths = normalized.map(operation => operation.path);
  for (let left = 0; left < paths.length; left += 1) {
    for (let right = left + 1; right < paths.length; right += 1) {
      if (paths[left] === paths[right] || paths[left].startsWith(`${paths[right]}/`) || paths[right].startsWith(`${paths[left]}/`)) {
        fail('OVERLAPPING_PATCH_PATHS', `Patch operations overlap at ${paths[left]} and ${paths[right]}`);
      }
    }
  }
  const body = { schema: PATCH_PLAN_SCHEMA, baseDocumentDigest: digestValue(base), operations: normalized };
  const plan = { ...body, patchPlanDigest: digestValue(body) };
  boundedJson(plan, 'patch plan', 64 * 1024);
  return clone(plan);
}

function arrayPreservesWitness(current, witness, key) {
  if (!Array.isArray(current)) return { pass: false, reason: 'TARGET_IS_NOT_ARRAY' };
  if (key) {
    const currentByIdentity = new Map();
    for (const item of current) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !Object.prototype.hasOwnProperty.call(item, key)) continue;
      const identity = canonicalStringify(item[key]);
      if (currentByIdentity.has(identity)) return { pass: false, reason: 'DUPLICATE_UNIQUE_KEY' };
      currentByIdentity.set(identity, digestValue(item));
    }
    for (const entry of witness.entries) {
      if (!currentByIdentity.has(entry.identity)) return { pass: false, reason: 'BASE_LIST_ITEM_REMOVED' };
      if (currentByIdentity.get(entry.identity) !== entry.digest) return { pass: false, reason: 'BASE_LIST_ITEM_CHANGED' };
    }
    return { pass: true, currentByIdentity };
  }
  const currentDigests = new Set(current.map(digestValue));
  return witness.entries.every(entry => currentDigests.has(entry.digest))
    ? { pass: true, currentDigests }
    : { pass: false, reason: 'BASE_LIST_ITEM_REMOVED_OR_CHANGED' };
}

function evaluatePatch(baseDocument, currentDocument, patchPlan) {
  const base = boundedJson(baseDocument, 'base document', 256 * 1024);
  const current = boundedJson(currentDocument, 'current document', 256 * 1024);
  if (!patchPlan || patchPlan.schema !== PATCH_PLAN_SCHEMA || digestValue({ schema: patchPlan.schema, baseDocumentDigest: patchPlan.baseDocumentDigest, operations: patchPlan.operations }) !== patchPlan.patchPlanDigest) {
    fail('INVALID_PATCH_PLAN', 'Patch plan schema or digest is invalid');
  }
  const baseDigest = digestValue(base);
  const currentDigest = digestValue(current);
  if (baseDigest !== patchPlan.baseDocumentDigest) fail('STALE_PATCH_BASE_DOCUMENT', 'Supplied base document does not match the staged patch plan');
  const result = clone(current);
  const applied = [];
  const noops = [];
  const conflicts = [];

  for (let index = 0; index < patchPlan.operations.length; index += 1) {
    const operation = patchPlan.operations[index];
    const observed = readAt(result, operation.path);
    try {
      if (operation.op === 'set_if_missing') {
        if (!observed.exists) {
          setAt(result, operation.path, operation.value);
          applied.push(index);
        } else if (digestValue(observed.value) === digestValue(operation.value)) {
          noops.push(index);
        } else {
          conflicts.push({ index, path: operation.path, reason: 'PATH_NOW_PRESENT' });
        }
      } else if (operation.op === 'replace') {
        if (observed.exists && digestValue(observed.value) === operation.baseWitness.digest) {
          setAt(result, operation.path, operation.value);
          applied.push(index);
        } else if (observed.exists && digestValue(observed.value) === digestValue(operation.value)) {
          noops.push(index);
        } else {
          conflicts.push({ index, path: operation.path, reason: 'TOUCHED_PATH_CHANGED' });
        }
      } else if (operation.op === 'remove') {
        if (!observed.exists) {
          noops.push(index);
        } else if (digestValue(observed.value) === operation.baseWitness.digest) {
          removeAt(result, operation.path);
          applied.push(index);
        } else {
          conflicts.push({ index, path: operation.path, reason: 'TOUCHED_PATH_CHANGED' });
        }
      } else if (operation.op === 'append_unique') {
        if (!observed.exists) {
          setAt(result, operation.path, []);
        }
        const target = readAt(result, operation.path).value;
        const preserved = arrayPreservesWitness(target, operation.baseWitness, operation.key);
        if (!preserved.pass) {
          conflicts.push({ index, path: operation.path, reason: preserved.reason });
          continue;
        }
        if (operation.key) {
          const identity = canonicalStringify(operation.value && operation.value[operation.key]);
          const match = target.find(item => item && typeof item === 'object' && !Array.isArray(item) && canonicalStringify(item[operation.key]) === identity);
          if (!match) {
            target.push(clone(operation.value));
            applied.push(index);
          } else if (digestValue(match) === digestValue(operation.value)) {
            noops.push(index);
          } else {
            conflicts.push({ index, path: operation.path, reason: 'UNIQUE_KEY_COLLISION' });
          }
        } else if (target.some(item => digestValue(item) === digestValue(operation.value))) {
          noops.push(index);
        } else {
          target.push(clone(operation.value));
          applied.push(index);
        }
      } else if (operation.op === 'add_unique_values') {
        if (!observed.exists) setAt(result, operation.path, []);
        const target = readAt(result, operation.path).value;
        if (!Array.isArray(target) || !target.every(scalar)) {
          conflicts.push({ index, path: operation.path, reason: 'TARGET_IS_NOT_SCALAR_ARRAY' });
          continue;
        }
        const currentDigests = new Set(target.map(digestValue));
        if (!operation.baseWitness.digests.every(digest => currentDigests.has(digest))) {
          conflicts.push({ index, path: operation.path, reason: 'BASE_LIST_VALUE_REMOVED' });
          continue;
        }
        let changed = false;
        for (const value of operation.values) {
          const digest = digestValue(value);
          if (!currentDigests.has(digest)) {
            target.push(clone(value));
            currentDigests.add(digest);
            changed = true;
          }
        }
        (changed ? applied : noops).push(index);
      }
    } catch (error) {
      if (error.code === 'PATCH_PARENT_CHANGED') conflicts.push({ index, path: operation.path, reason: 'PARENT_CHANGED' });
      else throw error;
    }
  }

  if (conflicts.length) {
    return { schema: PATCH_RESULT_SCHEMA, state: 'REBASE_HOLD', baseDocumentDigest: baseDigest, currentDocumentDigest: currentDigest, patchPlanDigest: patchPlan.patchPlanDigest, conflicts, appliedOperations: [], noopOperations: [], document: null, resultDocumentDigest: null };
  }
  const rebased = currentDigest !== baseDigest;
  return { schema: PATCH_RESULT_SCHEMA, state: rebased ? 'REBASE_SAFE' : 'CURRENT_BASE', baseDocumentDigest: baseDigest, currentDocumentDigest: currentDigest, patchPlanDigest: patchPlan.patchPlanDigest, conflicts: [], appliedOperations: applied, noopOperations: noops, document: result, resultDocumentDigest: digestValue(result) };
}

module.exports = { PATCH_PLAN_SCHEMA, PATCH_RESULT_SCHEMA, ALLOWED_OPERATIONS: Array.from(ALLOWED_OPERATIONS), preparePatch, evaluatePatch };
