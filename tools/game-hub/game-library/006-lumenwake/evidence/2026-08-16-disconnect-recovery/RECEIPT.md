# Lumenwake disconnect-recovery receipt

Date: 2026-08-16  
Status: WORKING evidence for one bounded disconnect seam; not CANON  
Lane: `tools/game-hub/game-library/006-lumenwake`

## Outcome

The production phone-controller view now tells the truth about its local link. A
transport cut moves the page to `LOCAL LINK · LOST · RETRYING`, clears queued
local input, and disables the map, start, Pulse, Dash, and movement-stick
surfaces. The existing server-side 700 ms human-input TTL remains the authority
that expires a direction already accepted before the cut. The same page polls
and reconnects without a reload, then accepts fresh input.

This does not close physical-phone QA. The live browser check used a desktop
browser at 1280 x 720, DPR 1.25, with `controller=1` to select the phone surface.
Touch ergonomics, real phone layout, shared-screen recovery, and server-process
restart recovery were not tested.

## Live visual observation

Claim: P2's production controller visibly fails closed through a local
transport cut and recovers on the same page.

Surface / route: fault proxy to the production Lumenwake runtime,
`/?room=AXM1&player=p2&controller=1`.

Visual backend: BROWSER_PRIMARY; no Windows fallback.

Viewport / seat: 1280 x 720, DPR 1.25; P2 Human, Nova; Aurora Basin.

Baseline:

- `LOCAL LINK · LIVE`
- map, start, Pulse, Dash enabled; movement stick `aria-disabled=false`
- baseline frame digest:
  `018797557037a73febf70bbe16b060bbdd7d5303e9b416cfbcee0322643c9da2`

Actions and observed sequence:

1. Clicked `START SHARED RUN` and waited through the authoritative countdown.
2. Cut all proxy traffic while leaving the origin server alive.
3. First and settled post-cut frames both showed
   `LOCAL LINK · LOST · RETRYING`; Pulse and Dash were disabled, the hidden
   between-run buttons were disabled, the movement stick exposed
   `aria-disabled=true`, and the control surface visibly dimmed.
4. Restored the proxy. The same page returned to `LOCAL LINK · LIVE`; Pulse and
   Dash re-enabled and the stick returned to `aria-disabled=false`.
5. Clicked `PULSE COMBO`; P2's authoritative pulse count changed from 0 to 1.

Post-cut frame digest:
`e39a582838e3d23322fe458970cee66885137a93460ee25c294d5aecc50d8961`

Recovered frame digest:
`34d72adf2f7085a574a16ef268af6ceef56b2c0151f5b2a0f8dec049351e5da7`

Runtime identity observed during and after the cut:

```text
phase: running
createdAt: 1786882224411
startedAt: 1786882293196
endsAt: 1786882503196
map: aurora-basin
P2 position: 50, 41
P2 pulses after recovery action: 1
```

Verdict: PASS for the named desktop-proxy controller seam.

Named remaining seams: physical-phone QA, real touch input, shared-screen
transport recovery, server-process restart recovery.

Buffer digest: the three selected frame digests above; repeated screenshots,
not rolling video, were sufficient for the discrete state transition.

Temporary paths deleted: none were created. In-memory image buffers were nulled,
the browser tab was closed, the harness exited 0, and ports 54300 and 26339 had
no remaining listeners. Cleanup complete: yes.

Browser console history was not captured, so this receipt makes no claim about
console cleanliness. The rendered page showed no error overlay; source syntax
was checked separately.

## Focused verification

```text
node --test tools/game-hub/game-library/006-lumenwake/tests/disconnect-recovery.test.js tools/game-hub/game-library/006-lumenwake/tests/blocking-overlay-escape.test.js
PASS · 3 tests · 0 fail

node tools/game-hub/game-library/006-lumenwake/selftest.js
PASS

node tools/game-hub/game-library/006-lumenwake/balance-selftest.js
PASS · solo 19/20 · pair 18/20 · four-seat 19/20

node tools/game-hub/game-library/006-lumenwake/adapter-seat-selftest.cjs
PASS

node tests/html-script-syntax-test.js
PASS · 55 HTML files · 0 fail
```

The two-test transport suite started the real server behind a fault proxy,
verified that a pre-cut held direction expired, compared the unchanged run
identity through the cut, restored the proxy, and proved a fresh movement input
was accepted.

## Files and boundaries

Changed in this lane:

- `runtime/lumenwake-client.html`
- `tests/disconnect-recovery-browser-harness.js`
- `tests/disconnect-recovery.test.js`
- `game.manifest.json`
- this receipt

Untouched production authorities:

- `runtime/lumenwake-server.cjs`
- `runtime/lumenwake-core.cjs`
- `runtime/seat-interface.cjs`

The manifest was the only shared seam patched. It was read immediately before
and after the additive verification/evidence update. Living Globe 010 completed
its own disconnect manifest and receipt concurrently; those files were
preserved. During the broad checkpoint, Casino 007 independently changed its
client script, stylesheet, and test runner, then added two disconnect test files.
Those files were also preserved. Lumenwake's client, server, core, seat
interface, tests, and manifest hashes remained stable across the checkpoint.

## Broad gate

All commands ran from `<AXM_WORKSHOP>` against the stable lane
checkpoint:

```text
node verify.js
PASS · 0 FAIL · 17 warn · spine b618c5762240070c
RepairBuddy: 17 evidence-only warnings · 0 replayable · 0 repair design

node hub/hub-selftest.js
PASS · exit 0

node hub/route-selftest.js
PASS · exit 0

node hub/graft-selftest.js
PASS · exit 0

node hub/skin-selftest.js
PASS · exit 0

node hub/verify-plus.js
PASS · VERIFIED_WITH_LIMITS · exit 0

node tests/html-script-syntax-test.js
PASS · 55 HTML files · 0 fail

node tests/tool-forge-package-test.js
PASS · package ok · installed false
fingerprint: 8d43927820e0177361638a008a6cbb8d713ec83b98a67353eeed4b7391653268

node tools/agent-tool-forge/selftest.js
PASS · 17 pass · 0 fail

node tools/evidence-desk/selftest.js
PASS · 36 pass · 0 fail

node shared/readiness/selftest.js
PASS · 218 tools · 1907 capabilities
```

The verifier warning count moved from 19 to 17 at this checkpoint because this
Lumenwake lane and the separately completed Living Globe lane each closed one
software-verifiable disconnect warning. The remaining warnings were preserved;
passing these checks does not canonize or promote the package.

Final workspace classification: `MOVING_WORKSPACE` globally because Casino 007
was active; stable for the Lumenwake lane. The read-only snapshot moved from
12,170 to 12,172 status entries exactly as Casino's two new test paths appeared.
No Lumenwake overlap or unresolved same-file collision was observed.
