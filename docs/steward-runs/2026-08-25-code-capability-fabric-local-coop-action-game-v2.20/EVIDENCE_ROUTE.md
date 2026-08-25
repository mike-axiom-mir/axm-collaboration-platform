# Evidence route — deterministic local co-op action game v2.20

Status before implementation: `BLOCKED`

## Claims

### deterministic-two-player-candidate

- Claim: a second exact native recipe emits a complete two-player action co-op
  candidate and repeated generation from the same sealed request is byte-identical.
- Kind: existence, lineage, and deterministic behavior.
- Risk: high.
- Pass condition: schema, request, recipe identity, all 11 file bytes, bundle,
  packet, resource totals, and rebuild digest agree exactly.
- Primary surface: focused generator and packet selftests.
- Counterevidence: ambiguous recipe selection, missing file, digest drift, clock,
  random, provider, network, undeclared dependency, or non-repeatable output.
- Secondary surface: disposable-sandbox static inspection and recursive Fabric tests.
- Before verdict: `FAIL`; only the single-player recipe exists.

### independent-local-seats

- Claim: P1 and P2 have distinct keyboard mappings and each input changes only
  its declared player unless a shared game rule explicitly applies.
- Kind: deterministic behavior and human interaction.
- Risk: high.
- Pass condition: pure-engine countertests and browser key journeys separately
  move, attack, and dash each seat while visible state retains both identities.
- Primary surface: trusted-host execution of byte-verified candidate code plus
  live browser keyboard observation.
- Counterevidence: merged seats, hidden control path, stuck key, focus-dependent
  loss, one player controlling both avatars, or omitted visible control help.
- Secondary surface: generated contract, manifest, and accessibility inspection.
- Before verdict: `FAIL`; the existing recipe aliases arrows and WASD to one seat.

### shared-coop-rules

- Claim: both players protect one reactor, can revive a downed teammate, and
  receive one shared victory or loss.
- Kind: deterministic gameplay behavior.
- Risk: high.
- Pass condition: exact input traces prove shared reactor damage, partner revive,
  joint wave victory, both-downed loss, reset, and identical replay state.
- Primary surface: pure deterministic simulation tests.
- Counterevidence: independent contradictory outcomes, self-revive, revival from
  outside the declared range, unbounded entity growth, or unreachable win/loss.
- Secondary surface: live browser state and rendered status observations.
- Before verdict: `FAIL`; no generated co-op rules exist.

### detached-live-preview

- Claim: the candidate visibly renders and responds to start, pause, restart,
  P1 keys, and P2 keys inside the existing detached local sandbox.
- Kind: visual and interactive behavior.
- Risk: high.
- Pass condition: actual browser render/click/key journeys at desktop and narrow
  viewport show two players, reactor, enemies, status, controls, and state changes.
- Primary surface: in-app browser observation with selected screenshots.
- Counterevidence: blank canvas, script exception, unreadable controls, broken
  resize, click interception, nonresponsive seat, or mismatch with public state.
- Secondary surface: syntax, DOM, and static server checks.
- Before verdict: `UNKNOWN`; no candidate exists yet.

### bounded-zero-authority

- Claim: generation and preview grant no provider, network, filesystem, install,
  integration, publication, learning admission, promotion, merge, or CANON authority.
- Kind: authorization, privacy, and resource boundary.
- Risk: critical.
- Pass condition: exact request, packet, contract, sandbox receipt, CSP, static
  source scan, and resource measurement all retain empty authority and false
  lifecycle effects; the generator never executes the candidate.
- Primary surface: parsed records, hostile-request tests, and static inspection.
- Counterevidence: any permission, network domain, storage API, dynamic code,
  automatic lifecycle effect, or source/private output retained as durable evidence.
- Secondary surface: required Workshop checks and Git diff.
- Before verdict: `PASS` for the existing substrate; the new recipe still needs proof.

### continuity-preserved

- Claim: Four Roots Run remains byte-identical and dependent Workshop organs do
  not regress while the generator gains one bounded new recipe.
- Kind: continuity and deterministic behavior.
- Risk: high.
- Pass condition: the sealed legacy packet digest is unchanged, its existing
  tests pass, the adventure-content lineage remains valid, all focused/recursive
  tests pass, and every `AGENTS.md` check passes.
- Primary surface: legacy packet fixture and full test suites.
- Counterevidence: old digest drift, changed ancestor identity, stale schema,
  broken sandbox, or unrelated diff.
- Secondary surface: final clean-workspace and target-drift checks.
- Before verdict: `UNKNOWN` until final verification.

Motion is sampled through repeated browser observations. Unless the host exposes
`visual.capture.ephemeral-rolling-buffer/v1`, frame-perfect cadence, transient
flicker absence, and performance timing remain `LIMITED`, not `PASS`.

## Final routed verdicts

- `deterministic-two-player-candidate`: `PASS` for packet
  `sha256:e2a9b257857fa140caa0ec8294ce3fe1a1b0c60f27080e9fc35fd2bd975c3287`.
- `independent-local-seats`: `PASS` in 17 focused engine cases and one actual
  browser key journey; P1 and P2 movement, dash, and attack stayed distinct.
- `shared-coop-rules`: `PASS` for exact pure-engine traces covering partner
  revive, self/distance countertests, shared reactor loss, both-downed loss,
  final-wave victory, replay identity, and the 18-enemy ceiling.
- `detached-live-preview`: `PASS` for render, click, keyboard, pause, resume,
  restart, reload, desktop, and 480-pixel narrow slices. Frame-perfect motion
  quality remains `LIMITED` because the rolling-buffer hand is absent.
- `bounded-zero-authority`: `PASS`; generation used no provider or network,
  the Sandbox used zero candidate processes, and every lifecycle effect remains
  false or separately gated.
- `continuity-preserved`: `PASS`; the legacy packet remains
  `sha256:3f2548636dc9f6b5836d55faa6fc1569706536595361ac43bf2c19bb12df140d`,
  the focused suites pass, the recursive Fabric sweep is `52/52`, and all ten
  required Workshop checks pass.

These verdicts make the exact v2.20 rung `READY` for review. They do not prove
arbitrary game generation, public reuse rights, installation readiness,
frame-perfect performance, controller support, online co-op, persistence,
promotion, merge, or `CANON`.
