'use strict';

const Core = require('./core');

const TEMPLATES = {
  HAND: id => 'What is the smallest bounded executable hand that can provide ' + id + ', and which runtime test would disprove its claim?',
  SKILL: id => 'Which repeatable judgment procedure can produce ' + id + ', and which held-out cases distinguish it from a plausible-looking guess?',
  AUTHORITY: id => 'Which named steward may authorize ' + id + ', from what exact evidence, and what decision must remain unavailable to machinery?',
  SUBSTRATE: id => 'Which compute, storage, device, data, or network substrate is minimally required for ' + id + ', and what measured limit would refute sufficiency?',
  EVIDENCE: id => 'Which native proof surface can verify or refute ' + id + ' without substituting a weaker kind of evidence?',
  CONTRACT: id => 'Which existing interfaces can exchange ' + id + ' through a versioned adapter, and which incompatibility test would block that route?',
  UNKNOWN: id => 'What is the cheapest observation that can classify the current state of ' + id + ' as available, degraded, unavailable, or still unknown?'
};

function compile(gaps) {
  return gaps.map(gap => ({
    schema: 'axm.research-question/v1',
    id: Core.id('question', gap.id),
    gapId: gap.id,
    gapType: gap.gapType,
    capabilityId: gap.capabilityId,
    question: (TEMPLATES[gap.gapType] || TEMPLATES.UNKNOWN)(gap.capabilityId || gap.title),
    falsifiable: true,
    answerState: 'OPEN',
    automaticTruthPromotion: false
  }));
}

module.exports = { compile };
