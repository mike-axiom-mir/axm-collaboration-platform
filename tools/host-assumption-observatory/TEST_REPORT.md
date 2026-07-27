# Host Assumption Observatory v0.2 focused test report

Status: `PASS` for the focused fixture and live Workshop checks. Candidate
status remains detached `EXPERIMENTAL`.

- 33 focused checks passed.
- The v0.1 syntax classifier remains covered across filesystem, host, browser,
  network, runtime/tool, operating-system, absolute-path, backslash-path, and
  environment-variable declaration forms.
- v0.2 adds deterministic selection of exactly one module, module-scoped
  assumptions, deduplicated requested checks, time-independent request
  fingerprinting, and refusal of unknown or assumption-free selections.
- Every generated check is `REQUEST_NOT_RUN`; observations and decisions are
  null, no secret value is requested, and Touch Environment Probe remains the
  execution owner.
- Live map measured `2026-07-27T03:07:50.766Z` with fingerprint
  `60020b002fcef917bec1bc854d5c0178b2d1071beb04f0bde7cec003b8a9b1f5`.
- The selected `body-pulse` handoff contains three classified assumptions,
  four declaration occurrences, three requested checks, and zero run checks.
- Request fingerprint:
  `6563937a18f94ab2c652b121a18fc63579ba234142be3e6a1f3815d7f282a4f0`.
- Browser visual judgment is `NOT_RUN`.
- No probe execution, environment-value capture, compatibility, readiness,
  availability, grant, install, rewrite, staging, permission, rollback,
  promotion, GitHub, network, or CANON claim was made.
