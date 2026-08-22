'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const DeterministicJson = require('../../../../tools/deterministic-json-core');
const Independent = require('../../independent-verifier');

function canonical(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(Buffer.from(typeof value === 'string' ? value : canonical(value), 'utf8')).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resignManifest(value) {
  delete value.manifestDigest;
  value.manifestDigest = sha256(value);
  return value;
}

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'keel-workshop-collaborator.manifest.json'), 'utf8'));
assert.strictEqual(Independent.verify(manifest).verdict, 'PASS');

const portabilityExpansion = clone(manifest);
portabilityExpansion.portability.machinePathsIncluded = true;
assert.strictEqual(Independent.verify(resignManifest(portabilityExpansion)).verdict, 'FAIL');

const falseEmptyContinuity = clone(manifest);
falseEmptyContinuity.continuity.acceptedReceiptDigests = [sha256('fresh-process-false-history')];
const continuityCore = clone(falseEmptyContinuity.continuity);
delete continuityCore.stateDigest;
falseEmptyContinuity.continuity.stateDigest = sha256(continuityCore);
assert.strictEqual(Independent.verify(resignManifest(falseEmptyContinuity)).verdict, 'FAIL');

const coercedResource = clone(manifest);
coercedResource.components[1].descriptor.resourceRequest.computeUnits = '10';
coercedResource.components[1].descriptorRef.sha256 = sha256(coercedResource.components[1].descriptor);
assert.strictEqual(Independent.verify(resignManifest(coercedResource)).verdict, 'FAIL');

process.stdout.write(JSON.stringify({
  status: 'PASS',
  verifierProcess: 'FRESH_NODE_PROCESS',
  importsCompiler: false,
  validManifest: 'PASS',
  resignedAdversariesRejected: 3,
  evidenceCeiling: 'static-manifest-only'
}) + '\n');
