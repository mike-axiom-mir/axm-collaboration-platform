'use strict';

const { TRUTH_FACETS } = require('./constants');
const { clone } = require('./utils');

const ORDER = {
  verification: {
    unverified: 0,
    schema_valid: 1,
    simulated: 2,
    tested: 3,
    evidence_supported: 4,
    independently_checked: 5
  },
  physical_status: {
    not_evaluated: 0,
    approximate: 1,
    simulated: 2,
    physically_tested: 3,
    measurement_backed: 4
  }
};

function validate(facets) {
  const errors = [];
  if (!facets || typeof facets !== 'object') return { ok: false, errors: ['truth_facets object required'] };
  Object.keys(TRUTH_FACETS).forEach(function (key) {
    if (!TRUTH_FACETS[key].includes(facets[key])) {
      errors.push('invalid truth facet ' + key + ': ' + String(facets[key]));
    }
  });
  return { ok: errors.length === 0, errors };
}

function isDowngrade(facet, before, after) {
  if (before === after) return false;
  if (after === 'failed' || after === 'disputed' || after === 'contradicted') return false;
  const order = ORDER[facet];
  return !!(order && order[before] !== undefined && order[after] !== undefined && order[after] < order[before]);
}

function update(facets, facet, value, allowDowngrade) {
  if (!TRUTH_FACETS[facet]) throw new Error('unknown truth facet: ' + facet);
  if (!TRUTH_FACETS[facet].includes(value)) throw new Error('invalid ' + facet + ' value: ' + value);
  const out = clone(facets);
  if (isDowngrade(facet, out[facet], value) && !allowDowngrade) {
    throw new Error('truth downgrade requires explicit promote_truth_status authority');
  }
  out[facet] = value;
  return out;
}

module.exports = { validate, isDowngrade, update, values: clone(TRUTH_FACETS) };
