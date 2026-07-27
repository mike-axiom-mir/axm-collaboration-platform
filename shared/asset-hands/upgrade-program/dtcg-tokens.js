'use strict';

const U = require('./foundation-utils');
const RoundTrip = require('./roundtrip-ledger');

const DOCUMENT_SCHEMA = 'axm.dtcg-2025.10-document/v1';
const MEDIA_TYPE = 'application/design-tokens+json';
const NAME_FORBIDDEN = /[{}.]/;

function isObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function isToken(value) { return isObject(value) && (Object.prototype.hasOwnProperty.call(value, '$value') || Object.prototype.hasOwnProperty.call(value, '$ref')); }

function validName(name, allowRoot) {
  if (allowRoot && name === '$root') return true;
  return !String(name).startsWith('$') && !NAME_FORBIDDEN.test(String(name));
}

function pointer(root, reference) {
  U.ensure(typeof reference === 'string' && reference.startsWith('#/'), 'local JSON Pointer reference required');
  const parts = reference.slice(2).split('/').map((item) => item.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current = root;
  for (const part of parts) {
    U.ensure(current && Object.prototype.hasOwnProperty.call(current, part), 'unresolved JSON Pointer: ' + reference);
    current = current[part];
  }
  return current;
}

function dotted(root, reference) {
  U.ensure(/^\{[^{}]+\}$/.test(reference), 'curly reference must contain one complete token path');
  const parts = reference.slice(1, -1).split('.');
  let current = root;
  for (const part of parts) {
    U.ensure(current && Object.prototype.hasOwnProperty.call(current, part), 'unresolved token reference: ' + reference);
    current = current[part];
  }
  return current;
}

function deepMerge(base, local) {
  if (!isObject(base) || !isObject(local) || isToken(base) || isToken(local)) return U.clone(local);
  const result = U.clone(base);
  for (const key of Object.keys(local)) result[key] = Object.prototype.hasOwnProperty.call(result, key) ? deepMerge(result[key], local[key]) : U.clone(local[key]);
  return result;
}

function materializeExtensions(document) {
  const root = U.clone(document);
  const memo = new Map();
  function groupAt(path) {
    let current = root;
    for (const part of path) current = current[part];
    return current;
  }
  function resolveGroup(path, stack) {
    const key = path.join('.');
    if (memo.has(key)) return U.clone(memo.get(key));
    U.ensure(!stack.includes(key), 'circular group extension: ' + stack.concat(key).join(' -> '));
    const group = groupAt(path);
    U.ensure(isObject(group) && !isToken(group), '$extends target must be a group: ' + key);
    let result = {};
    if (group.$extends) {
      const raw = group.$extends;
      let targetPath;
      if (/^\{[^{}]+\}$/.test(raw)) targetPath = raw.slice(1, -1).split('.');
      else if (String(raw).startsWith('#/')) targetPath = raw.slice(2).split('/').map((item) => item.replace(/~1/g, '/').replace(/~0/g, '~'));
      else throw new Error('$extends must use a local curly or JSON Pointer reference');
      const inherited = resolveGroup(targetPath, stack.concat(key));
      result = deepMerge(result, inherited);
    }
    const local = U.clone(group);
    delete local.$extends;
    for (const childName of Object.keys(local)) {
      if (!childName.startsWith('$') && isObject(local[childName]) && !isToken(local[childName])) local[childName] = resolveGroup(path.concat(childName), stack.concat(key));
    }
    result = deepMerge(result, local);
    memo.set(key, result);
    return U.clone(result);
  }
  const result = {};
  for (const key of Object.keys(root)) {
    if (key.startsWith('$')) result[key] = U.clone(root[key]);
    else if (isObject(root[key]) && !isToken(root[key])) result[key] = resolveGroup([key], []);
    else result[key] = U.clone(root[key]);
  }
  return result;
}

function parse(value) {
  const originalText = typeof value === 'string' ? value : JSON.stringify(value);
  U.ensure(Buffer.byteLength(originalText, 'utf8') <= 10 * 1024 * 1024, 'design-token document exceeds 10 MiB');
  const original = typeof value === 'string' ? JSON.parse(value) : U.clone(value);
  U.ensure(isObject(original), 'design-token root must be an object');
  const document = materializeExtensions(original);
  const tokens = new Map();
  const errors = [];
  function collect(group, path, inheritedType) {
    const groupType = typeof group.$type === 'string' ? group.$type : inheritedType;
    if (group.$extensions != null && !isObject(group.$extensions)) errors.push(path.join('.') + ': $extensions must be an object');
    for (const name of Object.keys(group)) {
      if (name.startsWith('$')) continue;
      const valueAtName = group[name];
      if (!validName(name, false)) errors.push(path.concat(name).join('.') + ': token and group names cannot start with $ or contain { } .');
      if (!isObject(valueAtName)) { errors.push(path.concat(name).join('.') + ': token or group must be an object'); continue; }
      if (isToken(valueAtName)) {
        const tokenPath = path.concat(name).join('.');
        const childNames = Object.keys(valueAtName).filter((key) => !key.startsWith('$'));
        if (childNames.length) errors.push(tokenPath + ': a token cannot also contain child tokens or groups');
        if (valueAtName.$extensions != null && !isObject(valueAtName.$extensions)) errors.push(tokenPath + ': $extensions must be an object');
        tokens.set(tokenPath, { path: tokenPath, raw: valueAtName, inherited_type: groupType });
      } else collect(valueAtName, path.concat(name), groupType);
    }
    if (Object.prototype.hasOwnProperty.call(group, '$root')) {
      const rootToken = group.$root;
      if (!isToken(rootToken)) errors.push(path.concat('$root').join('.') + ': $root must be a token');
      else tokens.set(path.concat('$root').join('.'), { path: path.concat('$root').join('.'), raw: rootToken, inherited_type: groupType });
    }
  }
  collect(document, [], null);
  U.ensure(tokens.size <= 100000, 'design-token count exceeds limit');
  const resolving = [];
  const resolved = new Map();
  function tokenFromTarget(target, label) {
    U.ensure(isObject(target), 'reference target is not an object: ' + label);
    if (isToken(target)) return target;
    throw new Error('reference target is not a token: ' + label);
  }
  function resolveArbitrary(valueAtPath, rootDocument, stack) {
    if (typeof valueAtPath === 'string' && /^\{[^{}]+\}$/.test(valueAtPath)) {
      const target = tokenFromTarget(dotted(rootDocument, valueAtPath), valueAtPath);
      const targetPath = valueAtPath.slice(1, -1);
      return resolveToken(targetPath, stack).value;
    }
    if (isObject(valueAtPath) && typeof valueAtPath.$ref === 'string') {
      const target = pointer(rootDocument, valueAtPath.$ref);
      if (isToken(target)) {
        const found = Array.from(tokens.values()).find((item) => item.raw === target || U.canonical(item.raw) === U.canonical(target));
        if (found) return resolveToken(found.path, stack).value;
        return Object.prototype.hasOwnProperty.call(target, '$value') ? resolveArbitrary(target.$value, rootDocument, stack) : resolveArbitrary(pointer(rootDocument, target.$ref), rootDocument, stack);
      }
      return U.clone(target);
    }
    if (Array.isArray(valueAtPath)) return valueAtPath.map((item) => resolveArbitrary(item, rootDocument, stack));
    if (isObject(valueAtPath)) {
      const result = {};
      for (const key of Object.keys(valueAtPath)) result[key] = resolveArbitrary(valueAtPath[key], rootDocument, stack);
      return result;
    }
    return U.clone(valueAtPath);
  }
  function resolveToken(path, stack) {
    if (resolved.has(path)) return U.clone(resolved.get(path));
    U.ensure(tokens.has(path), 'unresolved token path: ' + path);
    U.ensure(!stack.includes(path), 'circular token reference: ' + stack.concat(path).join(' -> '));
    const token = tokens.get(path);
    const rawValue = Object.prototype.hasOwnProperty.call(token.raw, '$value') ? token.raw.$value : { $ref: token.raw.$ref };
    let valueResolved;
    let referenceTarget = null;
    if (typeof rawValue === 'string' && /^\{[^{}]+\}$/.test(rawValue)) {
      referenceTarget = rawValue.slice(1, -1);
      valueResolved = resolveToken(referenceTarget, stack.concat(path)).value;
    } else {
      valueResolved = resolveArbitrary(rawValue, document, stack.concat(path));
      if (isObject(rawValue) && rawValue.$ref) {
        const target = pointer(document, rawValue.$ref);
        const found = Array.from(tokens.values()).find((item) => U.canonical(item.raw) === U.canonical(target));
        if (found) referenceTarget = found.path;
      } else if (token.raw.$ref) {
        const target = pointer(document, token.raw.$ref);
        const found = Array.from(tokens.values()).find((item) => U.canonical(item.raw) === U.canonical(target));
        if (found) referenceTarget = found.path;
      }
    }
    let type = typeof token.raw.$type === 'string' ? token.raw.$type : token.inherited_type;
    if (!type && referenceTarget) type = resolveToken(referenceTarget, stack.concat(path)).type;
    if (!type) errors.push(path + ': token type cannot be determined; value inspection is forbidden');
    const item = { path, type: type || null, value: U.clone(valueResolved), raw: U.clone(token.raw), reference: referenceTarget };
    resolved.set(path, item);
    return U.clone(item);
  }
  for (const path of tokens.keys()) {
    try { resolveToken(path, resolving); } catch (error) { errors.push(path + ': ' + error.message); }
  }
  const result = {
    schema: DOCUMENT_SCHEMA,
    version: '2025.10',
    media_type: MEDIA_TYPE,
    original: U.clone(original),
    materialized: document,
    tokens: Array.from(resolved.values()).sort((a, b) => a.path.localeCompare(b.path)),
    validation: { pass: errors.length === 0, errors },
    source_digest: U.sha256(originalText),
  };
  result.digest = U.sha256(result);
  return result;
}

function exportDocument(parsed, options) {
  U.ensure(parsed && parsed.schema === DOCUMENT_SCHEMA, 'parsed DTCG document required');
  U.ensure(parsed.validation.pass, 'cannot export an invalid DTCG document');
  const document = options && options.materialized === true ? parsed.materialized : parsed.original;
  return { mime: MEDIA_TYPE, text: JSON.stringify(document, null, options && options.pretty === false ? 0 : 2), document: U.clone(document) };
}

function createRoundTripAdapter() {
  return RoundTrip.createAdapter({
    id: 'dtcg-2025.10', version: '1.0.0', input_mime: MEDIA_TYPE, output_mime: MEDIA_TYPE, known_losses: [],
    import_content(content) {
      const parsed = parse(content.toString('utf8'));
      U.ensure(parsed.validation.pass, parsed.validation.errors.join('; '));
      return { document: parsed.original, facts: parsed.original };
    },
    export_content(document) { return { mime: MEDIA_TYPE, content: JSON.stringify(document, null, 2), losses: [] }; },
  });
}

module.exports = { DOCUMENT_SCHEMA, MEDIA_TYPE, parse, exportDocument, createRoundTripAdapter };
