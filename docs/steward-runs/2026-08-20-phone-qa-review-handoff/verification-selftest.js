#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const here = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(here, name), 'utf8'));
let checks = 0;
function check(value, label) { assert.ok(value, label); checks += 1; console.log('PASS ' + label); }

const seal = read('SESSION_SEGMENT.seal.json');
const receipt = read('CURATION_RECEIPT.json');
const index = read('SESSION_INDEX.json');
const segmentBytes = fs.readFileSync(path.join(here, 'SESSION_SEGMENT.jsonl'));
const segmentDigest = crypto.createHash('sha256').update(segmentBytes).digest('hex');

check(seal.schema === 'session-seal/v1' && seal.source === 'SESSION_SEGMENT.jsonl', 'seal identifies the append-only session segment');
check(seal.parseStatus === 'valid' && seal.eventLines === 6 && seal.validJsonLines === 6 && seal.invalidJsonLines === 0, 'all six curated event lines parse as JSON objects');
check(segmentDigest === seal.sha256, 'session segment bytes match the sealed SHA-256 digest');
check(receipt.sealDigest === 'sha256:' + seal.sha256, 'curation receipt binds the exact session seal');
check(receipt.deletion.performed === true && receipt.deletion.recoverableFromThisPack === false && receipt.deletion.realUserPhoneEvidenceDeleted === false, 'receipt records irreversible fixture cleanup without claiming deletion of real phone evidence');
check(receipt.openClaims.includes('actual voluntary human review') && receipt.openClaims.includes('physical-phone behavior') && receipt.openClaims.includes('human usefulness'), 'curation receipt preserves every open real-world claim');
check(index.status === 'TEST' && index.authority.merged === false && index.authority.promoted === false && index.authority.canon === false, 'session index preserves TEST and human merge boundaries');
check([...Object.values(index.integrity), ...index.capabilityEvidence, ...index.verificationEvidence, ...index.replay].every(name => fs.existsSync(path.join(here, name))), 'every indexed evidence and replay artifact exists');

console.log('\nPhone-QA review handoff verification selftest: PASS (' + checks + ' checks)');

