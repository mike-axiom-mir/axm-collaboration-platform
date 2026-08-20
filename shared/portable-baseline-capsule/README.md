# Portable Baseline Capsule

Status: `TEST`

This leaf binds a caller-observed baseline to exact references without scanning,
executing, installing, promoting, or changing it. It supports three adapter
kinds:

- `SOFTWARE_REPOSITORY` keeps the version/commit and dirty-worktree receipt
  separate.
- `MIRROR_STATE` keeps Original Mirror, private lessons, and a disposable
  challenger separate.
- `SPECIALIST_MASK` binds the host model, mask package, allowed capabilities,
  and evidence ceiling while preserving `permissionGrant: NONE` and
  `identityEffect: OVERLAY_ONLY`.

Generated views declare `CURRENT`, `STALE`, or `UNKNOWN`. Freshness only routes
a refresh; it is not semantic truth. Unsupported source fields may be retained
as digest-bound `preservedSourceFields` references rather than silently dropped
or embedded.

`compare()` returns `NO_NEW_INFORMATION` only when the substantive baseline and
information inputs are unchanged. Any change produces a reviewable receipt and
no automatic action.

The module can emit the narrow baseline-reference shape consumed by the
Verified Capability Loop. That compatibility transfers no authority.
