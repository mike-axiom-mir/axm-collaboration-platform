# Code Capability Fabric signed Git object-inventory comparator v1

Status: `TEST`

This is the next small reliability rung after exact schema-packet comparison. A trusted host supplies two inert Git object inventory records, one labelled `SOURCE` and one labelled `MIRROR`. Each inventory is canonically sealed and signed by an Ed25519 observation key that the exact grounded-consent request binds. The pure comparator then emits `MATCH` or typed `DRIFT` over object identifiers, declared object types, and declared sizes.

`SOURCE` and `MIRROR` are directional evidence labels, not rank, ownership, or authority. A `MATCH` means only that the two exact signed host-supplied observations contain the same canonical records. It does not prove that either host enumerated a repository completely, that an object identifier matches real object bytes, that a clone is complete, or that transport and recovery work.

## Consent and authority

The four AXM roots are the first technical gate. The request, both byte-length-bound inventory artifacts, trusted observer keys, action, empty permissions, disabled network, false lifecycle effects, resource ceilings, and required evidence schemas are fixed before comparison. An exact interactive declaration is still required after policy evaluation.

That declaration is not cryptographic human identity, informed-understanding proof, replay prevention, live revocation, or trusted time. Those remain explicit gaps. Mike remains the final merge gate. The comparator grants no permission and cannot merge, install, publish, promote, change `CANON`, activate a machine default, or admit persistent learning.

## Execution boundary

The module imports no filesystem, process, Git, transport, or network primitive. It opens no repository, invokes no Git command, reads or rehashes no object bytes, and retains no object content. The calling host owns enumeration and signing. That makes this useful as a deterministic evidence contract now, while keeping a future host enumerator and future clone/runtime work separately reviewable.

Each inventory is capped at 2,048 records and 1 TiB of declared aggregate object size. Observation lifetime is at most one hour and cross-host observation skew is at most five minutes. Conservative verifier input and exact receipt output byte ceilings are enforced. Memory, duration, and attempt ceilings are consent declarations only; this pure function has no external runtime governor and does not claim those ceilings were enforced.

## Deliberately deferred

The next evidence rungs remain Git ref-set comparison, sender and receiver transport receipts, clone-completeness proof, recovery replay, and an independently verified host enumerator. The unfinished `mirror-code-clone` module is not imported, connected, or executed by this work.
