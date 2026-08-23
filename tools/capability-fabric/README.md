# Capability Fabric workbench

This is the human and machine front door for
`shared/capability-fabric`. The browser workbench validates, plans, builds in
memory, and offers an explicit deterministic ZIP download. `machine.js`
exposes the same pure operations without filesystem authority.

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
