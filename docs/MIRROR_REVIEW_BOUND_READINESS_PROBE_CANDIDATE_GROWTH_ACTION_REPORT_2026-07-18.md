# Mirror review-bound readiness probe candidate growth action report

Status: **TEST**. This is research evidence, not CANON. Only Mike may accept CANON.

Date: 2026-07-18  
Identity: `axm.machine.mirror/seed-0`

## Outcome

Mirror now has the small hard-coded organ that the readiness-hand evidence justified.
It does not contain six service-specific implementations. Instead it accepts an exact,
content-digested recipe bound to a current readiness-hand request and generates one of
two deliberately narrow disposable candidates:

- `FILE_EXISTS`;
- `DIRECTORY_EXISTS`.

This is the reusable reasoning foundation between “a hand is missing” and “someone
must write another organ.” A new requirement ID can use the same builder without a
Mirror code change. The service-specific target still requires attributed human review;
Mirror does not guess that semantic fact.

## What was added

The independent `readiness-probe-recipe-cell` seals and verifies:

- current hand request ID and digest;
- attributed `HUMAN` reviewer, time, and reason;
- normalized relative target with no traversal, absolute path, drive prefix, empty part,
  or hidden critical field;
- exact `files:read` requirement without granting it;
- `AVAILABLE` as the only positive state and `UNKNOWN` as the failure state;
- `liveExecutionApproved: false`.

The `reasoning-readiness-probe-candidate-builder` then:

1. verifies the source hand-planner batch;
2. independently re-evaluates the sealed recipe;
3. runs an authority-closed Reasoning Foundation comparison that selects the typed
   admission and rejects review bypass;
4. generates deterministic `probe.js`, `contract.json`, and `test.js` bytes only under
   ignored Mirror state;
5. runs disposable positive, missing, wrong-type, outside-root, and invalid-time cases;
6. content-digests every candidate file and refuses tampered reuse.

Generated probes require an explicit absolute root, reject symbolic path components,
stay inside that root, perform no writes or network calls, and never emit `READY`.

## Current real state

Mirror's six current hands remain unreviewed and untouched. Automatic practice is not
allowed to impersonate a reviewer, so the current immutable batch is deliberately empty:

- batch: `reasoning-readiness-probe-candidates-9ed2a22cda6d3c0c6ce7`;
- input digest: `9ed2a22cda6d3c0c6ce7a74f2fe64741610dc04b65ca944e43132cbfdf78af24`;
- batch digest: `9fbeb8b8e79da21b3a53c95d62f713e4f879542c48fbc1a96981ca94a29480ca`;
- source hand batch: `reasoning-readiness-hands-41460a1609d15d43cae9`;
- source hand digest: `b02b2ab40ad6cc1afb3f50ec5b42c9e8555fc16cc915bace3e8db0749b7c1fca`;
- batch file SHA-256: `85f1ff81677c8d2cf1103124afc9adc517751619e21002675b5674bb63a4089d`;
- batch file bytes: 4,588.

Its result is: zero reviewed recipes, approved recipes, held recipes, candidates,
generated candidate files, fixture suites, installs, live executions, Workshop file
changes, starts, repairs, permission grants, training receipts, and world actions.

The automatic practice report
`curriculum-20260718140015390-66cd4d4b903c` independently records the same empty
state. Its ignored private file is 12,824 bytes with SHA-256
`804cf0d24450395707899f518a686c862f1c61cf7f3052b9f9affd8c883763f8`.

## Explicit runtime route

`POST /axm/v1/growth/readiness-probe-review` lets an attributed authenticated human
supply the decision, reason, and any approved probe fields while Mirror supplies the
current hand digest, reviewer binding, review time, recipe ID, and digest. The bridge
builds nothing. A `HOLD` seals with `probe: null`, so preserving uncertainty requires no
invented target or manually computed hash.

`POST /axm/v1/growth/readiness-probe-candidates` requires an authenticated explicit
session. A non-empty recipe set additionally requires a session actor whose kind is
`HUMAN` and whose ID exactly matches every recipe reviewer. Empty inspection is allowed
without pretending a review occurred.

The final live runtime is PID `31584`, started at
`2026-07-18T14:00:11.894Z`, loopback-only on port 8818, with learned weights disabled.
The live authority canary refused a nonhuman review with HTTP 403. The live empty-build
check used session `session-af68341ca400403d8922be8e` and returned:

- response digest: `eda54a46b5c93ac320ba9c90fbf6f4f386baeb9fddc2c33cc10e44eb3a732e3b`;
- state: `NO_REVIEWED_RECIPES_SUBMITTED`;
- source batch: `reasoning-readiness-probe-candidates-9ed2a22cda6d3c0c6ce7`;
- zero candidates, files, fixtures, installs, live probes, Workshop changes, or runtime
  changes.

The older planner-only PID `29484` was verified by executable, command line, and owning
listen socket before replacement. PIDs `31128`, `19160`, and `23652` were intermediate
tested restarts, replaced after authentication and human-review bridge refinements. PID
`31584` is the final process.

## What worked

- Two unseen synthetic requirement IDs generated file and directory candidates through
  the same implementation; there is no requirement- or module-ID switch.
- Exact human-review, hand, recipe, source-code, schema, candidate-byte, and fixture
  lineage is content-digested.
- Unsafe paths, AI-attributed review, `READY`, live approval, wrong hand binding, unknown
  critical fields, and tampered candidate reuse are refused.
- Positive presence yields only `AVAILABLE`; missing, wrong type, outside-root, invalid
  time, or read failure yields `UNKNOWN`.
- Automatic practice and the Learning Shell both record the honest empty reviewed-input
  state rather than creating code from the six hand proposals.
- The human review bridge removes manual digest construction, refuses nonhuman review,
  and records `HOLD` without demanding a fake service target.

## What did not work or remains unknown

- The first package-script invocation was refused by local PowerShell execution policy
  because `npm.ps1` is disabled. The same checked-in runner passed when invoked directly
  with Node. `npm.cmd` was not needed.
- No current service-specific recipe has been reviewed, so no real current candidate was
  generated or tested. This report does not claim those six hands are implemented.
- Disposable fixtures establish structural behavior only. They do not prove that file or
  directory presence is a semantically correct readiness signal for a real service.
- The generated code rejects symbolic path components, but a platform-dependent
  privileged symlink fixture was not run on this Windows host. Outside-root containment
  was exercised without requiring symlink privileges.
- No candidate was run against live Workshop, installed, wired into Technical Glasses,
  promoted, or admitted to training. Those remain separate future gates.

## Verification

- Mirror core: **110/110 passed** on the final rerun. The first full run exposed one
  missing `confirmedMatchTraining: false` BOM declaration for the new review bridge
  (**109/110**); that failed evidence was not erased, the BOM was corrected, and the
  complete core suite was rerun.
- Mirror Learning Forge: **99/99 passed**.
- AXM Native Learning Shell: **6/6 passed**.
- Builder/review/runtime-focused checks: **7/7 passed** before full regressions.
- Doctor: **PASS**.
- Node parsed all **141** Git-visible JSON files successfully. PowerShell's
  `ConvertFrom-Json` refused the existing Forge `package-lock.json` key shape, so that
  parser was not used as evidence.
- `git diff --check`: no whitespace errors; only expected Windows LF-to-CRLF notices.
- Private batch, practice report, token, and runtime logs: confirmed ignored by Git.

## Authority boundary

The organ has two positive implementation authorities only:
`disposableCandidateWrite` and `sandboxFixtureExecution`, both limited to ignored private
state. It has no readiness claim, installed-runtime write, Workshop write, install,
automatic start, automatic repair, permission grant, live probe, training admission,
tool, network, world action, semantic truth, model change, runtime promotion, canon, or
identity authority.

The result is TEST evidence for a small reusable organ, not a claim that Mirror can yet
invent arbitrary integrations or grow without stewardship.
