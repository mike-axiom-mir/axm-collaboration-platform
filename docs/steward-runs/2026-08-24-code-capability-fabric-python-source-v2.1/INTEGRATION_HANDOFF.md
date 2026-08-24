# Integration handoff

Review source implementation commit:
`ff3269778298796776bbb0e90eb45eaf65e2d297`.

This is a stacked review rung. Its assumed target is PR #50 branch
`codex/code-capability-fabric-code-family-extension-base-v2.0` at
`ee0c63743f4ecca1e49f14d4d8f24b429672e564`.

Changed path groups:

- `shared/capability-fabric/`
- `shared/code-capability-fabric/`
- `registry/generated/`
- `docs/generated/`
- `docs/steward-runs/2026-08-24-code-capability-fabric-python-source-v2.1/`

Before integration, fetch and confirm the target branch still names the assumed
base. If it does, Mike can review and merge the stacked pull request in GitHub.
Equivalent explicit local review, without touching a busy checkout:

```powershell
git -C D:\AXM_ACTIVE\workshop fetch origin
git -C D:\AXM_ACTIVE\workshop diff --stat ee0c63743f4ecca1e49f14d4d8f24b429672e564...origin/codex/code-capability-fabric-python-source-v2.1
```

Do not silently merge into `D:\AXM_ACTIVE\workshop`. Mike decides whether and
when the stacked base and this rung are integrated.

