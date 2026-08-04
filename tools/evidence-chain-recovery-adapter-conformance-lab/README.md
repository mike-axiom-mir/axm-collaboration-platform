# AXM Evidence Chain Recovery Adapter Conformance Lab

Status: `TEST`

This Lab closes `capability.verify.evidence-chain-recovery-adapter/v1`. It does not close `capability.apply.evidence-chain-reviewed-recovery/v1`.

It binds a fixture adapter profile to the exact source, candidate, review-plan, and profile digests. The Node runner then opens isolated in-memory sessions and probes:

1. synthetic permission denial before any application;
2. exact apply confirmation;
3. stale preview refusal;
4. candidate digest substitution refusal;
5. current-state drift refusal before safety copy or application;
6. apply, independent candidate-digest inspection, fresh rollback preview, exact rollback confirmation, rollback, and source-digest inspection;
7. digest-only response and receipt privacy.

Passing returns `axm.evidence-chain-recovery-adapter-conformance-receipt/v1` with status `PASS_WITH_LIMITS`.

## Adapter interface

The caller must preload trusted adapter code and pass the object to `conformance-runner.js`. The Lab deliberately has no command that accepts or loads an adapter module path. Files and generated packages remain data until a trusted host imports them.

The adapter exposes `descriptor` and `openFixture(input)`. A fixture session exposes `preview`, `apply`, `inspect`, `injectTestFault`, `previewRollback`, `rollback`, `audit`, and `close`. The profile must declare:

- `fixtureOnly: true`;
- no live-target, filesystem, network, persistent-write, or real-permission access;
- permission name `recovery.apply`, represented only by a synthetic fixture flag;
- a bounded preview TTL;
- the exact apply and rollback confirmation phrases;
- the complete ordered method list.

`reference-fixture-adapter.js` is a deterministic in-memory example, not a production adapter. Its deliberate defect switches exist only so the selftest can prove the runner rejects weak implementations.

## Machine use

```js
const { run } = require('./conformance-runner');
const trustedFixtureAdapter = require('./trusted-fixture-adapter');

const receipt = await run(trustedFixtureAdapter, sourceJsonl, candidateJsonl, applicationPlan, {
  confirmPlanId: applicationPlan.planId,
  acknowledgeFixtureOnly: true,
  acknowledgeNoAuthority: true,
  now: new Date().toISOString()
});
```

The caller remains responsible for deciding that `trusted-fixture-adapter` is executable code. This Lab never discovers, imports, installs, or evaluates an adapter supplied as data.

## Limits preserved

- No Recovery Center API is called.
- No live target is read or written.
- No real permission or allowed/denied identity is exercised.
- No filesystem, network, or persistent state is used by the Lab contract.
- A fixture pass cannot prove production authorization, transport, persistence, or operational rollback.
- Human review and fresh independent live-authorization evidence remain required before any consequential application.
- Nothing is installed, promoted, or made CANON.
