'use strict';

const TYPE_WEIGHT = { HAND: 15, SKILL: 14, EVIDENCE: 16, CONTRACT: 12, SUBSTRATE: 10, AUTHORITY: 0, UNKNOWN: 8 };
function rank(gaps, hypotheses, experiments) {
  const hypothesisByGap = new Map(hypotheses.map(item => [item.gapId, item]));
  const experimentByGap = new Map(experiments.map(item => [item.gapId, item]));
  const items = gaps.map(gap => {
    const factors = {
      declaredPriority: Number(gap.priority) || 0,
      required: gap.required ? 30 : 0,
      blockingStatus: ['MISSING', 'OPEN'].includes(gap.status) ? 20 : gap.status === 'UNKNOWN' ? 12 : 8,
      gapType: TYPE_WEIGHT[gap.gapType] || 0
    };
    const score = Object.values(factors).reduce((sum, value) => sum + value, 0);
    return {
      id: 'backlog-' + gap.id,
      gapId: gap.id,
      title: gap.title,
      capabilityId: gap.capabilityId,
      gapType: gap.gapType,
      queue: gap.gapType === 'AUTHORITY' ? 'STEWARD' : 'BUILDER',
      score,
      scoreFactors: factors,
      proposedRoute: hypothesisByGap.get(gap.id).routeType,
      cheapestTest: experimentByGap.get(gap.id).id,
      status: 'RESEARCH_CANDIDATE',
      automaticAssignment: false
    };
  }).sort((a, b) => b.score - a.score || a.capabilityId.localeCompare(b.capabilityId) || a.id.localeCompare(b.id));
  return {
    schema: 'axm.research-backlog/v1',
    scoringFormula: 'declaredPriority + required(30) + blockingStatus(20|12|8) + gapTypeWeight',
    builders: items.filter(item => item.queue === 'BUILDER'),
    stewards: items.filter(item => item.queue === 'STEWARD'),
    automaticAssignment: false,
    automaticPromotion: false
  };
}

module.exports = { rank };
