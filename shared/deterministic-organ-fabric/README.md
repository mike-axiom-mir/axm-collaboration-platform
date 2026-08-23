# Deterministic Organ Fabric runtime

This shared `EXPERIMENTAL` compiler turns a reviewed `axm.organ-intent/v1` and an exact field pack into three declarative strategies, evaluates them in a trusted in-memory runtime, packages only valid results, and computes advisory integer metrics.

The bound runtime contract is [`runtime-contract.json`](runtime-contract.json). Its digest covers the grammar, ceilings, canonical representation, explicit-seed algorithm, and operation-cost model. The score profile is independently bound by [`metric-profiles/balanced-v1.json`](metric-profiles/balanced-v1.json).

Generated `organ.js` files are package material. The factory does not execute them. Explicit selftests may execute a detached candidate later as a separate verification route.

The first admitted implementation is the selected balanced Workshop verification-route organ. Its admission contract binds the reviewed intent, generation run, comparison, package, and selection digests. The trusted adapter rebuilds those artifacts in memory and evaluates only the declarative graph through this runtime. It emits Evidence Desk and Verification Spine prefills with open `UNKNOWN` claims; it neither runs the proposed checks nor imports packaged `organ.js`.

Archive selection and supersession are append-only receipt events. Supersession changes only the rebuildable view: the prior choice becomes `HISTORICAL_SUPERSEDED`, its immutable package and original selection receipt remain present, and the replacement is the sole active selection.

No AI, provider, model, API key, network, install, promotion, permission grant, Foundation mutation, or CANON action is part of the normal runtime.
