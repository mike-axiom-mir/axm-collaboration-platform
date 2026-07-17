'use strict';

const { clone, sha256, stableStringify } = require('../core/utils');

function contentForHash(event) {
  const copy = clone(event);
  delete copy.event_hash;
  return stableStringify(copy);
}

function hashEvent(event) {
  return sha256(contentForHash(event));
}

function verify(events) {
  const errors = [];
  let previous = null;
  (events || []).forEach(function (event, index) {
    if (event.previous_hash !== previous) errors.push('event ' + index + ' previous_hash mismatch');
    const expected = hashEvent(event);
    if (event.event_hash !== expected) errors.push('event ' + index + ' hash mismatch');
    previous = event.event_hash;
  });
  return { ok: errors.length === 0, errors, count: (events || []).length, head: previous };
}

module.exports = { contentForHash, hashEvent, verify };
