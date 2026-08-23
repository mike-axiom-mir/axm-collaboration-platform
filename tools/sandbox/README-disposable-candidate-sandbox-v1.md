# Disposable Candidate Sandbox v1

Status: `TEST`

This is a narrow static-game service, not a universal executor. It receives the
exact deterministic game-generation request and packet, verifies the packet by
rebuilding it, and materializes four direct-child roots:

```text
source/    original byte-bound packet snapshot
output/    immutable iteration-000, iteration-001, ...
evidence/  digests, measured counts, checks, and verdicts only
lessons/   inactive privacy-safe capability-lesson candidates
```

The service accepts no arbitrary command. Candidate code gets no child process,
host environment, credentials, filesystem API, or network. Static validation
parses `game.js` without running it and rejects network/authority tokens,
inline scripts, unsupported Game Forge terrain, authority drift, installation
claims, path aliases, and byte/resource drift.

A repair plan is bound to the exact prior iteration digest and the expected
digest of each replaced file. The service copies the prior iteration into a
temporary next root, applies allowlisted replacements, reruns static validation,
and atomically publishes the new iteration only on `PASS`. Failed temporary
iterations are removed; source and prior iterations remain unchanged.

Preview uses a trusted Node loopback server only as a fixed-file carrier. The
candidate is rendered in an iframe with `sandbox="allow-scripts"`; CSP denies
connections, objects, forms, workers, child frames, and top-level authority.
Preview proves only the behavior actually observed through a browser test.

Lessons store typed finding codes, changed paths, and byte-bound iteration
references. They retain no source, prompt, stdout, stderr, private content, or
machine paths. They are not active library knowledge until a separate Tier 3
human decision and new immutable library release.

Run:

```powershell
node tools/sandbox/selftest-disposable-candidate-sandbox-v1.js
```

After the focused tests pass, a human can start the exact first review candidate
with the trusted example entry point. It creates a new fixed detached session
and refuses to overwrite an existing one:

```powershell
node tools/sandbox/preview-example-game-v1.js
```
