'use strict';

const EvidenceBridge = require('../../shared/code-capability-fabric/recipe-evidence-bridge-v1');

function buildCreationEvidence(pack, query, options) {
  return EvidenceBridge.buildEvidencePacket(pack, query, options || {});
}

function verifyCreationEvidence(packet) {
  return EvidenceBridge.verifyPacket(packet);
}

module.exports = {
  schema: 'axm.code-recipe-evidence-packet/v1',
  capability: 'code.recipe.creation-evidence/v1',
  authority: 'NONE',
  buildCreationEvidence,
  verifyCreationEvidence
};
