'use strict';

const Codec = require('./canonical');

const EXECUTOR = Object.freeze({ id: 'axm.fixture.declarative-writer', version: '1.0.0' });
const VERIFIER = Object.freeze({ id: 'axm.fixture.claim-verifier', version: '1.0.0' });

function create() {
  const executor = {
    identity: EXECUTOR,
    async execute(context) {
      const fixture = context.package.fixture;
      if (!fixture || !Array.isArray(fixture.artifacts)) throw new Error('fixture package needs inert declared artifacts');
      return {
        artifacts: fixture.artifacts.map((artifact) => ({ path: artifact.path, content: String(artifact.content) })),
        facts: Codec.clone(fixture.facts || {})
      };
    }
  };
  const verifier = {
    identity: VERIFIER,
    verify(context) {
      const facts = context.facts && context.facts.claims || {};
      return {
        schema: 'axm.verification-receipt/v2',
        id: 'fixture-verification-' + context.package.id,
        verifier: { id: VERIFIER.id, version: VERIFIER.version, category: 'game' },
        subject: { id: context.package.id, kind: 'game-production-package', version: context.package.version, digest: context.package.digest },
        target_profile: 'game-production-runner-fixture',
        claims: context.package.claims.map((claim) => {
          let status = 'MISSING_VALIDATOR';
          if (claim.kind === 'human') status = 'HUMAN_REVIEW';
          else if (facts[claim.id] === true) status = 'PASS';
          else if (facts[claim.id] === false) status = 'FAIL';
          return {
            id: claim.id,
            status,
            required: claim.required,
            risk: claim.kind === 'behavior' ? 'medium' : claim.kind === 'human' ? 'high' : 'low',
            summary: claim.pass_condition,
            evidence: status === 'PASS' || status === 'FAIL' ? [{ kind: 'fixture-declaration', detail: 'Inert fixture fact for runner contract testing only.' }] : [],
            limitations: ['Fixture evidence does not prove a native game runtime.']
          };
        }),
        created_at: '2000-01-01T00:00:00.000Z'
      };
    }
  };
  return { executors: [executor], verifiers: [verifier], inventory: { executors: [EXECUTOR], verifiers: [VERIFIER] } };
}

module.exports = { EXECUTOR, VERIFIER, create };
