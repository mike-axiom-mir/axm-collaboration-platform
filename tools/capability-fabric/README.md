# Capability Fabric workbench

This is the human and machine front door for
`shared/capability-fabric`. The browser workbench validates, plans, builds in
memory, and offers an explicit deterministic ZIP download. `machine.js`
exposes the same pure operations without filesystem authority.

Every recipe and candidate is now explicitly typed as `HAND` or `SKILL`.
Active v1 recipes remain reviewed `HAND` builders. The dependent Capability
Recipe Foundry carries the first inactive portable `SKILL` pilot through source
review without activating it.

Builder code is no longer selected by hard-coded branches in the Fabric core.
A digest-bound modular registry supplies the three active builders and retains
the Foundry validator HAND and portable review SKILL as non-executable review
candidates. The separate Capability Recipe Admission Gate can prove the exact
evidence and prospective catalog diff, but cannot activate either candidate.

Explicit local materialization is CLI-only:

```text
node tools/capability-fabric/cli.js build \
  --request capability-request.json \
  --output-parent /existing/detached-candidate-parent
```

The destination must not exist. Writes use new-file semantics, package bytes
are read back and verified, and the detached Nursery must report
`READY_FOR_LATER_INTAKE`. Generated `selftest.js` is not executed by the CLI.
If writing, readback, or Nursery inspection fails, the CLI removes only the
fresh candidate directory it created and preserves the explicit output parent.

That Nursery label is structural only. Run the emitted test from an explicit
trusted host entry point and obtain separate live visual evidence for creation
hands before making broader claims.
