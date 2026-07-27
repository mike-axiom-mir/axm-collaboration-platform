# Dual Door Observatory focused test report

Status: `PASS` for the focused fixture and live Workshop checks. Candidate
status remains detached `EXPERIMENTAL`.

- 34 focused checks passed.
- The fixture proves present, missing, unsafe, incomplete, and symlink-refused
  entry states without loading or rendering entry files.
- String-array and object-map machine action declarations remain distinct;
  identifiers and declaration-detail presence are preserved without inferring
  semantics.
- Optional machine-door absence remains visible and is not a defect.
- The generated `axm.door-review-request/v1` selects only the Evidence Desk
  machine door and its declared `validate` action. Four checks are requested
  and zero are run; no command, arguments, environment values, or fixture is
  included.
- It also proves no source writes, time-independent source fingerprinting, TTL
  states, no absolute-root leak, and explicit non-authority.
- Live scan measured `2026-07-27T03:47:14.265Z` with fingerprint
  `18a4bc21ef10e80a8f8171a8e4946bbfb7fcda3ded6782691b0f5f09cf2b8e01`.
- All 81 live modules declare present human entries with zero human-door
  issues.
- Agent Tool Forge and Evidence Desk declare the two present machine doors.
  Their one string array and one object map declare 10 total action IDs.
- The other 79 modules have no explicit machine door; this is recorded as
  optional absence, with zero machine-door issues.
- Browser visual judgment is `NOT_RUN`.
- No request execution, entry loading, rendering, route, action, parity,
  semantics, readiness, grant, staging, install, permission, rollback,
  promotion, GitHub, network, or CANON claim was made.
