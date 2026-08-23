# Workshop Shadow Sandbox v1

Status: `TEST`

This is one narrow, provider-neutral improvement loop over an exact current
Workshop snapshot. It is not a general code improver, recovery system, hidden
agent, or executor.

The first allowlisted recipe compares `tools-index.json` with a deterministic
rebuild from the current privacy-scoped tool declarations, contracts, discovered
selftests, entry/readme/discovery state, and promotion ladder. If the source
digest is stale, the service writes only this detached shape:

```text
state/workshop-shadow-sandboxes/<session>/
  source/    immutable byte-reference snapshot records; no raw source
  output/    immutable iteration-NNN/tools-index.json candidates
  evidence/  immutable deterministic plans and privacy-safe receipts
```

The source Workshop is opened for scoped reads and has no write path in this
module. The candidate is inert JSON. Preview is a trusted, script-free loopback
review page; it never imports or executes candidate code. Every preview
re-observes the scoped source and refuses a stale draft. Refresh appends a new
iteration only when the scoped source-state digest changes.

Each receipt binds the request, source snapshot, plan, candidate bytes, and the
exact trusted generator implementation files. It reports measured input,
snapshot, output, and evidence bytes. Network requests and child processes are
fixed at zero for generation; the trusted review shell alone opens loopback HTTP.

The four-root technical gate must be `PASS` before drafting. The result has
authority `NONE` and cannot write back, execute, install, integrate, publish,
promote, or alter `CANON`. A later integration remains a separate Mike decision.

This first scope does **not** detect or restore arbitrary missing Workshop files.
Repository recovery and merge reconciliation remain separate evidence-driven
work.

Run:

```powershell
node shared/code-capability-fabric/selftest-workshop-shadow-improvement-planner-v1.js
node tools/sandbox/selftest-workshop-shadow-sandbox-v1.js
```

For an explicit live review of a current source checkout:

```powershell
node tools/sandbox/workshop-shadow-preview-v1.js --source-root <absolute-clean-or-busy-workshop-path> --session-id <portable-id>
```
