(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AXMDirectionReview = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '0.1.0';
  var ARTIFACT_SCHEMA = 'axm.workshop-direction.review-artifact/v1';
  var ASSESSMENT_SCHEMA = 'axm.workshop-direction.steward-assessment/v1';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))); }
  function criterion(id, label, score, evidence) {
    score = clamp(score);
    return { id: id, label: label, score: score, state: score >= 80 ? 'STRONG' : score >= 60 ? 'WATCH' : 'HOLD', evidence: evidence };
  }

  function artifact(plan) {
    if (!plan || plan.schema !== 'axm.workshop-direction.plan/v1') throw new Error('compiled Workshop Direction plan required');
    return {
      schema: ARTIFACT_SCHEMA,
      version: VERSION,
      request: clone(plan.request),
      verdict: plan.verdict,
      routes: (plan.routes || []).map(function (route) {
        return {
          routeId: route.routeId,
          capabilityId: route.capabilityId,
          moduleId: route.moduleId,
          action: route.action,
          outputs: clone(route.outputs || []),
          qualityExams: clone(route.qualityExams || []),
          execution: clone(route.execution || {}),
          status: route.status
        };
      }),
      handRequests: (plan.handRequests || []).map(function (hand) {
        return { handRequestId: hand.handRequestId, kind: hand.kind, targetModuleId: hand.targetModuleId, desiredContract: hand.desiredContract, status: hand.status };
      }),
      limits: clone(plan.limits || {}),
      trace: clone(plan.trace || {})
    };
  }

  function judge(plan) {
    var proposal = artifact(plan);
    var routes = plan.routes || [], hands = plan.handRequests || [];
    var descriptionLength = String(plan.request && plan.request.description || '').length;
    var available = routes.filter(function (route) { return route.execution && route.execution.mode !== 'UNAVAILABLE'; }).length;
    var bounded = routes.every(function (route) {
      var authority = String(route.execution && route.execution.authority || 'NONE');
      return ['NONE', 'workspace-local-only', 'incubator-candidate-only', 'disposable-lineage-only'].indexOf(authority) >= 0;
    });
    var exams = routes.reduce(function (sum, route) { return sum + (route.qualityExams || []).length; }, 0);
    var routeCount = Math.max(1, routes.length);
    var maxPulses = Number(plan.request && plan.request.maxPulsesPerRoute || 0);
    var limitsOkay = routes.length > 0 && routes.length <= 8 && maxPulses >= 1 && maxPulses <= 8 && plan.limits && plan.limits.promotionAuthority === 'NONE' && plan.limits.releaseAuthority === 'NONE';
    var reviewSignals = routes.filter(function (route) { return (route.qualityExams || []).some(function (exam) { return /review|receipt|provenance|rollback/.test(exam); }); }).length;
    var criteria = [
      criterion('clarity', 'Goal clarity', descriptionLength >= 80 ? 92 : descriptionLength >= 30 ? 74 : 48, descriptionLength + ' characters of direction detail.'),
      criterion('coverage', 'Capability coverage', Math.round(100 * available / routeCount), available + ' of ' + routes.length + ' routes point to an installed capability.'),
      criterion('authority', 'Authority containment', bounded ? 100 : 0, bounded ? 'Every route remains candidate-only, local-only, or unavailable.' : 'At least one route declares authority outside the allowed direction boundary.'),
      criterion('resources', 'Resource bounds', limitsOkay ? 100 : 25, routes.length + ' route(s), up to ' + maxPulses + ' pulse(s) per automatic route; promotion and release authority remain NONE.'),
      criterion('verification', 'Evidence and exams', Math.min(100, Math.round(exams / routeCount * 24)), exams + ' named quality exam(s) across ' + routes.length + ' route(s).'),
      criterion('reversibility', 'Review and recovery', Math.round(55 + 45 * reviewSignals / routeCount), reviewSignals + ' of ' + routes.length + ' routes name review, receipt, provenance, or rollback evidence.')
    ];
    var weights = { clarity: 1, coverage: 1.5, authority: 2, resources: 1.5, verification: 1.25, reversibility: 1 };
    var totalWeight = 0, weighted = 0;
    criteria.forEach(function (item) { var weight = weights[item.id] || 1; totalWeight += weight; weighted += item.score * weight; });
    var score = clamp(weighted / totalWeight);
    var hardRefusal = !bounded || !limitsOkay || !routes.length;
    var suggestedVerdict = hardRefusal ? 'DOWN' : (hands.length || available !== routes.length || score < 78 ? 'HOLD' : 'UP');
    var reasons = [];
    if (hardRefusal) reasons.push('A hard authority or resource boundary is not satisfied.');
    if (hands.length) reasons.push(hands.length + ' missing or operator-only hand request(s) remain visible.');
    if (available !== routes.length) reasons.push((routes.length - available) + ' route(s) do not have an installed capability.');
    if (!reasons.length) reasons.push('The plan is bounded, reviewable, and covered by installed capabilities.');
    return {
      schema: ASSESSMENT_SCHEMA,
      version: VERSION,
      directionId: plan.request.requestId,
      score: score,
      suggestedVerdict: suggestedVerdict,
      label: suggestedVerdict === 'UP' ? 'Looks ready for your review' : suggestedVerdict === 'HOLD' ? 'Repair or decide before proceeding' : 'Do not proceed as written',
      criteria: criteria,
      reasons: reasons,
      artifact: proposal,
      truth: { advisoryOnly: true, automaticVote: false, fillsReviewSeat: false, startsExecution: false, grantsAuthority: false }
    };
  }

  return { VERSION: VERSION, ARTIFACT_SCHEMA: ARTIFACT_SCHEMA, ASSESSMENT_SCHEMA: ASSESSMENT_SCHEMA, artifact: artifact, judge: judge };
});
