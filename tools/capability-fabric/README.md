# Capability Fabric workbench

This is the human and machine front door for
`shared/capability-fabric`. The browser workbench validates, plans, builds in
memory, and offers an explicit deterministic ZIP download. `machine.js`
exposes the same pure operations without filesystem authority.

Every recipe and candidate is explicitly typed as `HAND` or `SKILL`. Active v1
recipes include ten reviewed executable `HAND` builders and one reviewed
host-mediated portable `SKILL` builder.

Builder code is no longer selected by hard-coded branches in the Fabric core.
A digest-bound modular registry supplies all eleven active builders. The validator,
semantic HTML renderer, bounded JavaScript string-record transform, bounded CSS token-stylesheet renderer, strict text-only
SVG status-badge renderer, bounded Python record-transform HAND, and strict
closed primitive-object contract adapter, bounded record query, and handler-free
portable FSM definition are all
selected through exact recipe and builder digests. The generated JavaScript,
CSS, SVG, and Python source and selftests remain inert candidate data and are not executed by
this workbench. The portable FSM definition composes with the existing shared
Game FSM runtime; it neither copies that runtime nor embeds handlers. The
portable review SKILL was admitted through the reviewed merge gate. The
separate Capability Recipe Admission Gate can prove exact evidence and a
prospective catalog diff for future candidates, but cannot activate one itself.

The registry retains the exact inactive v1 object-contract adapter review
candidate for historical Recipe Foundry evidence, but normal builds compile
only the separately hardened active v2 adapter. V2 makes copied, renamed,
defaulted, and dropped fields explicit; rejects non-plain or non-primitive
records; enforces property and independent byte ceilings; and proves only
structural output compatibility. Shared use still requires Mike's merge
decision. A v1 admission replay is a typed no-effect recipe-id collision.

The v0.2 composition door deterministically connects reviewed candidates through
exact `consumes` / `provides` identities. It refuses cycles, self-edges,
duplicate or ambiguous bindings, unbound inputs, undeclared outputs, unavailable
child builds, and node/edge/byte budget excess. Its evidence route explicitly
keeps runtime payload semantics, node tests, host authority, and end-to-end
behavior unproven until checked on their native surfaces.

Explicit local materialization is CLI-only:

```text
node tools/capability-fabric/cli.js build \
  --request capability-request.json \
  --output-parent /existing/detached-candidate-parent
```

Composition validation, planning, and explicit materialization use:

```text
node tools/capability-fabric/cli.js compose-validate --request composition.json
node tools/capability-fabric/cli.js compose-plan --request composition.json
node tools/capability-fabric/cli.js compose-build \
  --request composition.json \
  --output-parent /existing/detached-composition-parent
```

`compose-build` creates one fresh composition root with the sealed request,
plan, receipt, node-package index, and one independently verified candidate
folder per node. It reconstructs the complete build from disk and requires every
node to reach Nursery `READY_FOR_LATER_INTAKE`; any failure rolls back only that
fresh composition root.

The destination must not exist. Writes use new-file semantics, package bytes
are read back and verified, and the detached Nursery must report
`READY_FOR_LATER_INTAKE`. Generated `selftest.js` or `skill.selftest.js` is not
executed by the CLI.
If writing, readback, or Nursery inspection fails, the CLI removes only the
fresh candidate directory it created and preserves the explicit output parent.

That Nursery label is structural only. Run the emitted test from an explicit
trusted host entry point and obtain separate live visual evidence for creation
hands before making broader claims.
