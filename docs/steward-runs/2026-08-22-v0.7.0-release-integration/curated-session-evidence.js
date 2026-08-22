'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const releaseCurationFile = path.join(__dirname, 'CODE_FABRIC_CURATION_RECEIPT.json');

function load(runRoot, expectedEventLines) {
  const eventFile = path.join(runRoot, 'SESSION_EVENTS.jsonl');
  const seal = JSON.parse(fs.readFileSync(path.join(runRoot, 'SESSION_SEAL.json'), 'utf8'));
  assert.equal(seal.parseStatus, 'valid');
  assert.equal(seal.invalidJsonLines, 0);
  assert.equal(seal.eventLines, expectedEventLines);

  if (fs.existsSync(eventFile)) {
    const bytes = fs.readFileSync(eventFile);
    const events = bytes.toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.equal(events.length, expectedEventLines);
    assert.equal(seal.sha256, crypto.createHash('sha256').update(bytes).digest('hex'));
    return { bytes, events, seal, omitted:false };
  }

  const releaseCuration = JSON.parse(fs.readFileSync(releaseCurationFile, 'utf8'));
  assert.equal(releaseCuration.curation.raw_session_jsonl_omitted, 8);
  assert.equal(releaseCuration.claims.canon, false);
  assert.equal(releaseCuration.claims.promotion, false);
  assert.match(seal.sha256, /^[a-f0-9]{64}$/);
  return { bytes:Buffer.alloc(0), events:null, seal, omitted:true };
}

module.exports = { load };
