# Deterministic PR Publisher service

This service composes the read-only Deterministic PR Checkpoint with an explicit,
host-authorized GitHub transport adapter.

`publisher-core.js` is deterministic and side-effect free. It validates packet
digests, exact local/remote facts, review material, branch routing, and merge
refusal, then emits a plan digest or typed holds.

`publisher-host.js` is the only side-effect surface. After the exact one-use
confirmation it may perform one ordinary fast-forward feature-branch push and
create or update one draft pull request. It verifies both the remote branch and
GitHub PR receiver state before emitting a receipt. It contains no stage,
commit, force-push, ready, close, merge, delete, promotion, roots, or CANON path.

The host provides its own authenticated GitHub CLI session. No credential is an
input or output contract.
