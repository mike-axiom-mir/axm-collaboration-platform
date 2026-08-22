# Code Capability Fabric — Semantic Candidate Generator v1

Status: `TEST`

This rung adds semantic generation without adding an executor. It is a pure,
provider-neutral data transform. Its default and first-class path is native-only.
It can also accept one already-produced AI challenger candidate as untrusted,
host-supplied data through an exact Fabric v2 provider route.

```text
exact blueprint + compiled schemas + scoped consent + four-root PASS
  -> versioned native recipe
  -> detached EXPERIMENTAL candidate packet
  -> optional, separately identified AI challenger packet
  -> unranked structural comparison
  -> plain-language Review Inbox card data
  -> authenticated human decision still required
```

The generator does not call an AI provider, load provider code, execute generated
code, read or write a workspace, use a network, spawn a process, grant permission,
install, integrate, publish, learn, promote, or alter `CANON`.

## Implemented native recipe

`creation-review-card-adapter@1.0.0` composes a detached adapter candidate from
six typed operations:

- validation;
- mapping;
- filtering;
- comparison;
- summarization;
- plain-language rendering.

The emitted adapter candidate is source data in an `axm.module-bundle/v1`. Its
test plan starts entirely `UNRUN`. The generator's selftest statically inspects
those bytes but never imports or executes `adapter.js`.

## AI challenger boundary

AI is off by default. The challenger lane requires all of the following:

- `NATIVE_WITH_AI_CHALLENGER` mode;
- one exact provider id, version, and descriptor digest;
- one deterministic `ROUTE_PLANNED` Fabric v2 record rebuilt from its source
  request, provider, and host observation;
- exact blueprint bytes in the route input;
- a strictly byte-bound module bundle;
- candidate permissions and network domains within the request policy; and
- `RESEARCH_ONLY_HOLD` with direct reuse disabled.

Native-generated candidate source also remains `RESEARCH_ONLY_HOLD` until Mike
resolves the deferred direct-reuse/public-copying decision. The native recipe
itself is usable Workshop code; that does not silently grant reuse rights to
each generated output.

The comparison exposes file, permission, network, evidence, and test-plan
differences. It has no rank, winner, selection, or merge field. Combining
alternatives requires a new request and exact consent.

## Consent tiers

This implementation is Tier 1 only: create one native candidate and at most one
parallel challenger packet under fixed resource declarations. Tier 0 remains the
existing inspect/plan Fabric. Tiers 2 through 5 are not inherited:

| Tier | Meaning | v1 state |
|---|---|---|
| 0 | inspect and plan | existing Fabric only |
| 1 | create detached inert candidates | implemented here |
| 2 | run one exact candidate in a disposable sandbox | held; Mike authorization required |
| 3 | admit a reviewed lesson to a new library version | held |
| 4 | install, integrate, or publish | held; separate Mike decision |
| 5 | model training or physical actuation | held under separate policies |

Any subject, bytes, permissions, provider, resources, evidence, expiry, or
lifecycle change requires a new request and re-consent. A four-root `HOLD` or
`FAIL` causes generation to stop; no review-card control can turn it into `PASS`.

## Resource truth

The generator enforces complete sealed-request bytes, complete emitted-result
bytes, candidate count, file count, per-file bytes, total source bytes,
canonical base64, SHA-256, portable relative paths, case aliases, and one
attempt per invocation. There is no durable cross-invocation attempt ledger.
Duration and memory are declared but are not independently enforced, and the
output says so.

## First use

```powershell
node shared/code-capability-fabric/selftest-semantic-candidate-generator-v1.js
```

The selftest generates data in memory only. Browser behavior is not claimed or
tested because this rung does not modify the live Review Inbox surface.

## Still open

- authenticated human decision, nonce, expiry, revocation, and replay ledger;
- repaired disposable executor and independent budget measurement;
- actual Review Inbox rendering and browser/accessibility evidence;
- versioned capability-lesson admission and held-out regressions;
- direct reuse rights for AI-supplied source; and
- domain expansion beyond the first code recipe.

Passing this suite means the `TEST` contracts hold for the tested data. It does
not make the generated adapter `WORKING`, installed, integrated, promoted, or
`CANON`.
