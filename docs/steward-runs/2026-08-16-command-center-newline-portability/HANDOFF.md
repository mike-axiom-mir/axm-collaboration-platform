# Command Center newline portability handoff

Status: **TEST**  
Base: remote `main` at `7147b97f4852401b118a50422d4d58cdb92c9923`  
Branch: `codex/command-center-newline-portability-v0.1`

This branch is review material. It is not CANON, has not been pushed, and changed no live Workshop, browser, or GitHub state.

## Reproduced defect

On a clean Windows checkout with `core.autocrlf=true`:

```text
node tools/workshop-command-center/selftest.js
AssertionError: batch control must restore the exact settled queue label
```

The runtime source contains the required `finally` block. The selftest loaded `app.js` with CRLF working-tree bytes, then searched it for a multiline literal containing LF. The raw lookup was false; the same lookup after CRLF-to-LF canonicalization was true.

Git reports the Command Center source and selftest as `i/lf w/crlf`. Canonical LF hashes of the four inspected live Command Center files exactly matched the remote-main blobs, confirming that the observed live modifications were checkout newline transforms rather than a source-semantic divergence.

## Bounded correction

Only the Command Center selftest reader changed:

- all text inspected by the selftest passes through one `canonicalText` helper;
- the helper converts CRLF to LF;
- lone CR remains unchanged and is covered by an assertion;
- JSON parsing, runtime source, browser behavior, contracts, and repository-wide Git attributes are unchanged.

This keeps multiline structural assertions stable across Windows and Unix without weakening their required source content.

## Files changed

- `tools/workshop-command-center/selftest.js`
- this handoff

The corresponding live Command Center files were modified paths and therefore classified foreign/unknown. The live selftest hash was checked again after the isolated edit and remained unchanged.

## Evidence

- FAIL before correction: Command Center selftest at the exact settled-queue assertion
- PASS after correction: Command Center selftest
- PASS: explicit CRLF-to-LF fixture
- PASS: lone-CR preservation fixture
- PASS: Command Center discovery seam — 10 checks
- PASS: HTML script syntax — 55 pages, 0 failures
- PASS: `git diff --check` with Windows line-ending conversion warnings only

All ten repository-required commands returned exit 0:

- `node verify.js`
- `node hub/hub-selftest.js`
- `node hub/route-selftest.js`
- `node hub/graft-selftest.js`
- `node hub/skin-selftest.js`
- `node hub/verify-plus.js`
- `node tests/html-script-syntax-test.js`
- `node tests/tool-forge-package-test.js`
- `node tools/agent-tool-forge/selftest.js`
- `node tools/evidence-desk/selftest.js`

The verifier remained `VERIFIED_WITH_LIMITS`: 43 known/open warnings and a warning delta matching its baseline.

## Aggregate boundary

Full `npm test` was not rerun as proof for this independent branch. Its remote-main base still contains the earlier Windows observatory raw-byte digest failure, repaired separately by commit `064eaf426804c9cbdbe0f7fd950f3385c4d069cd` on `codex/observatory-digest-cross-platform-v0.1`. An integration lane must combine both reviewed commits before aggregate Windows testing can fairly assess the next boundary.

## Not run

- combined two-branch `npm test`
- GitHub Actions on this unpushed branch
- Linux or macOS runtime execution
- browser render/click testing; no browser runtime source changed

Mike remains the review and merge gate. Passing these source checks does not canonize the Command Center or the portability policy.
