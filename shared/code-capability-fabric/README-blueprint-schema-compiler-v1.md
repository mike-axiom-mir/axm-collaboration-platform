# Code Capability Fabric blueprint schema compiler v1

Status: `TEST`

This is one incremental rung after the inert blueprint composer. It verifies the exact blueprint bytes, the exact prior composition-receipt bytes, their object digests, and their shared intent lineage. With a separate grounded-consent scope and an exact interactive declaration, it deterministically derives:

- one strict Draft 2020-12 input JSON Schema;
- one strict Draft 2020-12 output JSON Schema;
- one acceptance matrix that routes every blueprint claim to the evidence able to prove or refute it;
- one byte-bound schema-compilation receipt.

Every acceptance verdict remains `UNRUN`. Desired outcomes remain `HUMAN_REVIEW_REQUIRED`. Generating a schema does not prove that a future implementation validates against it, behaves correctly, stays within runtime budgets, is useful, or is approved.

## Authority boundary

The trusted host supplies exactly two consent-bound public generated artifacts: the inert blueprint and its composition receipt. The compiler verifies both before use. It does not inspect arbitrary workspace content. One invocation may write exactly four JSON files under one new direct-child root. It uses no network, spawns no child process, emits no executable code, and executes no candidate or schema-validation runtime. A failed attempt cleans only its newly owned root.

The Fabric does not grant the disposable write authority used by the host. The interactive declaration is not cryptographic identity, informed-understanding proof, replay prevention, trusted time, or live revocation. Direct-reuse rights for any future generated code remain undecided and held.

## Honest interpretation

This adds machine-checkable interface shape and a grounded future evidence plan. It does not add a code provider, executor, runtime proof, automatic growth, installation, promotion, merge authority, or CANON authority. Mike remains the final merge gate; the four AXM roots are the technical gate evaluated first.
