'use strict';

const { deepEqual } = require('../core/utils');

function walk(before, after, prefix, changes) {
  if (deepEqual(before, after)) return;
  const beforeObject = before && typeof before === 'object' && !Array.isArray(before);
  const afterObject = after && typeof after === 'object' && !Array.isArray(after);
  if (beforeObject && afterObject) {
    const keys = new Set(Object.keys(before).concat(Object.keys(after)));
    Array.from(keys).sort().forEach(function (key) {
      walk(before[key], after[key], prefix ? prefix + '.' + key : key, changes);
    });
    return;
  }
  changes.push({
    path: prefix || '$',
    before: before === undefined ? null : before,
    after: after === undefined ? null : after,
    kind: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed'
  });
}

function diff(before, after) {
  const changes = [];
  walk(before, after, '', changes);
  return { changed: changes.length > 0, count: changes.length, changes };
}

module.exports = { diff };
