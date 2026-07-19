(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXMJudgementCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DIMENSIONS = [
    { id: 'purpose', title: 'Purpose & lived value', short: 'WHY', prompt: 'Does it serve the stated need, remain understandable, and respect human experience?' },
    { id: 'truth', title: 'Technical truth', short: 'PROOF', prompt: 'Can the claim be proved by the evidence and capabilities that actually exist?' },
    { id: 'care', title: 'Consequences & care', short: 'IMPACT', prompt: 'Are safety, rights, reversibility, resource cost, and affected people honestly handled?' },
    { id: 'growth', title: 'Growth & reuse', short: 'FUTURE', prompt: 'Does it add useful possibility, modular reuse, learning, or honest novelty instead of noise?' }
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce(function (out, key) { out[key] = stable(value[key]); return out; }, {});
    return value;
  }
  function canonical(value) { return JSON.stringify(stable(value)); }
  function emptyDimensions() {
    return DIMENSIONS.reduce(function (out, item) { out[item.id] = { rating: 0, finding: '', evidence: '' }; return out; }, {});
  }
  function completeness(dimensions) {
    var input = dimensions || {}, missing = [];
    DIMENSIONS.forEach(function (item) {
      var row = input[item.id] || {};
      if (!(Number(row.rating) >= 1 && Number(row.rating) <= 5)) missing.push(item.title + ' rating');
      if (!String(row.finding || '').trim()) missing.push(item.title + ' finding');
      if (!String(row.evidence || '').trim()) missing.push(item.title + ' evidence or named gap');
    });
    return { ready: missing.length === 0, missing: missing };
  }
  function flowState(review) {
    var state = String(review && review.state || 'DRAFT').toUpperCase();
    if (state === 'APPROVED') return { key: 'ready', title: 'Both keys agree', detail: 'Ready for the owning module to consider. Nothing is applied automatically.' };
    if (state === 'REJECTED') return { key: 'repair', title: 'A seat said no', detail: 'The exact item is closed. Discuss, route to repair, change the artifact, then re-submit.' };
    if (state === 'HOLD') return { key: 'repair', title: 'A seat needs evidence', detail: 'Keep the item in the middle until the missing proof or question is resolved.' };
    if (state === 'REPAIR') return { key: 'repair', title: 'Repair route is open', detail: 'Make a real change. The revised item must receive a new digest and fresh votes.' };
    if (state === 'CANCELLED') return { key: 'closed', title: 'Closed without promotion', detail: 'The reasons remain visible in review history.' };
    if (state === 'SUPERSEDED') return { key: 'closed', title: 'Replaced by a changed artifact', detail: 'Open the newer exact digest for current judgement.' };
    return { key: state === 'DRAFT' ? 'draft' : 'waiting', title: state === 'DRAFT' ? 'Build the exact judgement' : 'Independent seats are waiting', detail: state === 'DRAFT' ? 'Complete all four corners before opening a vote.' : 'Human and machine record their own reasons against this digest.' };
  }
  function deepArtifact(subject, dimensions) {
    return {
      schema: 'axm.deep-judgement-artifact/v1',
      subject: clone(subject || {}),
      dimensions: clone(dimensions || emptyDimensions()),
      rules: { exactDigest: true, independentSeats: ['human', 'machine'], automaticVote: false, automaticApply: false, oneScoreIsNotTaste: true }
    };
  }
  function reviewNeedsMiddle(review) { return ['HOLD', 'REJECTED', 'REPAIR'].indexOf(String(review && review.state || '').toUpperCase()) >= 0; }

  return { DIMENSIONS: DIMENSIONS, canonical: canonical, emptyDimensions: emptyDimensions, completeness: completeness, flowState: flowState, deepArtifact: deepArtifact, reviewNeedsMiddle: reviewNeedsMiddle };
});
