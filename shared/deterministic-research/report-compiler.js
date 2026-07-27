'use strict';

const Core = require('./core');

function compile(parts) {
  const report = {
    schema: 'axm.deterministic-research-report/v1',
    version: '0.1.0',
    observedAt: parts.observedAt,
    goal: parts.goal,
    workshop: {
      snapshotDigest: parts.snapshot.snapshotDigest,
      summary: parts.snapshot.summary,
      evidence: parts.snapshot.evidence
    },
    route: parts.classified.comparison.overall,
    goalComparison: parts.classified.comparison,
    gaps: parts.classified.gaps,
    questions: parts.questions,
    hypotheses: parts.hypotheses,
    experiments: parts.experiments,
    backlog: parts.backlog,
    ledger: { schema: parts.ledger.schema, ledgerDigest: parts.ledger.ledgerDigest, claims: parts.ledger.claims },
    truth: {
      deterministicCore: true,
      sameSemanticInputsProduceSameResearchDigest: true,
      declaredCapabilityIsNotRuntimeProof: true,
      semanticLeadsNeverSatisfyExactRequirements: true,
      recommendationsGrantNoAuthority: true,
      automaticBuild: false,
      automaticPromotion: false,
      automaticPermission: false
    }
  };
  const digestInput = Core.clone(report); delete digestInput.observedAt;
  if (digestInput.workshop.evidence.verifyReport) delete digestInput.workshop.evidence.verifyReport.modifiedAt;
  report.researchDigest = Core.digest(digestInput);
  return report;
}
function markdown(report) {
  const lines = [
    '# Deterministic Research Report', '',
    '**Goal:** ' + report.goal.title, '',
    report.goal.objective, '',
    '**Route:** ' + report.route + '  ',
    '**Research digest:** `' + report.researchDigest + '`  ',
    '**Observed Workshop:** ' + report.workshop.summary.modules + ' modules, ' + report.workshop.summary.exactCapabilities + ' exact declared capabilities, ' + report.gaps.length + ' open research gaps.', '',
    '## Builder queue', ''
  ];
  report.backlog.builders.slice(0, 50).forEach((item, index) => lines.push((index + 1) + '. **' + item.capabilityId + '** — ' + item.proposedRoute.replace(/_/g, ' ') + ' (score ' + item.score + ')'));
  if (!report.backlog.builders.length) lines.push('No builder gap is currently proven.');
  lines.push('', '## Steward queue', '');
  report.backlog.stewards.slice(0, 50).forEach((item, index) => lines.push((index + 1) + '. **' + item.capabilityId + '** — explicit steward decision required.'));
  if (!report.backlog.stewards.length) lines.push('No authority decision is currently queued.');
  lines.push('', '## Research boundary', '', 'This report recommends questions, tests, adapters, and build candidates. It cannot assign builders, grant permission, execute experiments, promote claims, or change Workshop Direction.', '');
  return lines.join('\n');
}

module.exports = { compile, markdown };
