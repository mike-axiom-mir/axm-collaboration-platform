'use strict';

const crypto = require('node:crypto');
const Canonical = require('./canonical-json');

function sha256Hex(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonicalDigest(value) {
  return sha256Hex(Canonical.stringify(value));
}

module.exports = { sha256Hex, canonicalDigest };
