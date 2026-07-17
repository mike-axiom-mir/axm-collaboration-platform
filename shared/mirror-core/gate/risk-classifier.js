'use strict';

const WEIGHTS = {
  create_entity: 1,
  update_fields: 2,
  add_relation: 1,
  remove_relation: 2,
  archive_entity: 3,
  attach_evidence: 1,
  update_truth_facet: 3,
  register_capability: 2,
  map_native_entity: 2,
  request_adapter_action: 4
};

function classify(operations) {
  let score = 0;
  (operations || []).forEach(function (operation) {
    score += WEIGHTS[operation.type] || 5;
    if (operation.irreversible === true) score += 5;
  });
  return { score, level: score >= 12 ? 'critical' : score >= 7 ? 'high' : score >= 3 ? 'medium' : 'low' };
}

module.exports = { classify, WEIGHTS };
