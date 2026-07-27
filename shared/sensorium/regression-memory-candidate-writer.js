'use strict';

const C = require('./core');

function propose(input) {
  input = input || {};
  if (input.verifiedFailure !== true) throw new Error('verified failure evidence is required');
  if (input.repairVerified !== true) throw new Error('verified repair evidence is required');
  if (input.independentReproduction !== 'PASS') throw new Error('independent reproduction must PASS');
  const candidate = {
    schema: 'axm.sensorium-regression-candidate/v1', candidateId: 'regression-' + C.digest(input.failureSignature).slice(0, 20),
    failureSignature: C.assertExactIdentifier(input.failureSignature, 'failureSignature'), capabilityId: C.assertExactIdentifier(input.capabilityId, 'capabilityId'),
    verifierCase: C.clone(input.verifierCase || {}), failureEvidenceDigest: C.digest(input.failureEvidence), repairEvidenceDigest: C.digest(input.repairEvidence),
    independentReproduction: 'PASS', status: 'PROPOSED_FOR_HUMAN_APPROVAL', binding: false, promotionGate: 'Mike', automaticPromotion: false
  };
  candidate.digest = C.digest(candidate);
  return candidate;
}

module.exports = { propose };
