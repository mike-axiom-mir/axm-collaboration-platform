# Deterministic Organ Fabric runtime

> Capability Fabric v1 reuses this module as its deterministic kernel and
> keeps this field-pack API as the specialized organ compatibility surface.
> New cross-domain code, creation-hand, and adapter builds enter through
> `shared/capability-fabric`; this kernel is not duplicated or replaced.

This shared `EXPERIMENTAL` compiler turns a reviewed `axm.organ-intent/v1` and an exact field pack into three declarative strategies, evaluates them in a trusted in-memory runtime, packages only valid results, and computes advisory integer metrics.

The bound runtime contract is [`runtime-contract.json`](runtime-contract.json). Its digest covers the grammar, ceilings, canonical representation, explicit-seed algorithm, and operation-cost model. The score profile is independently bound by [`metric-profiles/balanced-v1.json`](metric-profiles/balanced-v1.json).

Generated `organ.js` files are package material. The factory does not execute them. Explicit selftests may execute a detached candidate later as a separate verification route.

No AI, provider, model, API key, network, install, promotion, permission grant, Foundation mutation, or CANON action is part of the normal runtime.
