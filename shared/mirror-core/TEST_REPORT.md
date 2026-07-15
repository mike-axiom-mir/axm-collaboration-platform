# Test report

Build: AXM Mirror Core 0.1.0-local-prototype  
Date: 2026-07-14  
Node: v24.14.0  
npm: 11.9.0  
Source head: `33a87549259d8b4a7ce4753ee1fab49e0ee8091d`

## Result summary

| Area | Result | Evidence |
|---|---|---|
| JavaScript syntax | PASS | Every package `.js` file passed `node --check`. |
| JSON parse/schema registry | PASS | All JSON parsed; schema IDs unique; required schemas present. |
| Automated Node suite | PASS | 35 tests, 0 failed, 0 skipped. |
| Real HTTP API | PASS | Loopback server completed create → validate → propose → review → preview → approve → apply → verify → rollback and clean shutdown. |
| Demo end to end | PASS | 8 world + 6 platform imports; 5-change preview; verifier pass; reverse reject; stale conflict blocked; native and core rollback pass; 106-event chain valid. |
| Foundation harness | PASS | Source SHA, honest standalone state, local discovery, proposal-first boundary, gate authority, control separation, and no default AI fill all passed. |
| Safe-file fixture | PASS | Traversal/action allowlists enforced; approved JSON write, verification, and rollback passed. |
| Tamper detection | PASS | Modified event content failed hash-chain verification. |
| Build verifier | PASS | Required files, JSON/schema IDs, source/boundaries, zero runtime dependencies, static safety scan, loopback binding, and 103 manifest file hashes passed. |
| ZIP integrity | PASS | `unzip -t` reported no compressed-data errors. |
| Restored package | PASS | Tests, demo, Foundation harness, and build verification passed from a fresh extraction without packaged runtime state. |
| Rendered dashboard browser | UNRUN | Playwright is installed, but no Chromium executable is available. No UI pass is claimed. |

## Commands actually run

Syntax and JSON parse:

```sh
for file in $(rg --files AXM_MIRROR_CORE_LOCAL_v0_1 -g '*.js'); do node --check "$file"; done
node -e "/* recursive JSON.parse check over package JSON files */"
```

Automated suite:

```sh
npm test
```

Final observed test-run result:

```text
tests 35
pass 35
fail 0
cancelled 0
skipped 0
todo 0
```

The suite includes a real server socket on an ephemeral loopback port; it is not a mocked API substitute.

Demo and Foundation harness:

```sh
npm run demo
npm run foundation:harness
```

Observed demo facts:

```text
status PASS
world imported 8
platform imported 6
primary preview changes 5
primary preview conflicts 0
primary verifier true
reverse proposal REJECTED
stale proposal CONFLICTED
rollback ROLLED_BACK
platform restored true
Mirror core effects reversed true
journal events 106, hash chain true
```

Start-script launch:

```sh
AXM_MIRROR_PORT=0 ./START_MIRROR_CORE.sh
```

Result: PASS. It bound to `127.0.0.1` on an ephemeral port and was deliberately stopped with Ctrl+C.

Build manifest and verifier:

```sh
npm run manifest
npm run verify
```

Result: PASS. `BUILD_MANIFEST.json` contains 103 non-runtime files with byte counts and SHA-256 hashes.

Archive/restored-copy sequence:

```sh
zip -qr AXM_MIRROR_CORE_LOCAL_v0_1.zip AXM_MIRROR_CORE_LOCAL_v0_1 \
  -x 'AXM_MIRROR_CORE_LOCAL_v0_1/storage/runtime/*' \
  -x 'AXM_MIRROR_CORE_LOCAL_v0_1/*.zip'
unzip -t AXM_MIRROR_CORE_LOCAL_v0_1.zip
unzip -q AXM_MIRROR_CORE_LOCAL_v0_1.zip -d RESTORE_DIR
cd RESTORE_DIR/AXM_MIRROR_CORE_LOCAL_v0_1
npm test
npm run demo
npm run foundation:harness
npm run verify
npm run test:browser
```

Result: package integrity PASS; restored tests/demo/harness/verifier PASS; browser check UNRUN for the reason below.

Browser command:

```sh
npm run test:browser
```

Observed result:

```text
UNRUN
Playwright is installed but no Chromium executable is present in this local environment.
checks_completed: false
```

## Coverage highlights

- Missing IDs, unknown versions, invalid truth facets, invalid type extensions, safely retained unknown extensions, and executable-looking operation content.
- Duplicate source identities, same-name separation, one-to-many proposed mappings, duplicate endpoints, unresolved relations, and graph cycles.
- Default-deny permission scopes; read/propose/apply separation; AI attribution; revoked, expired, and wrong-scope consent.
- Every main packet transition and terminal/illegal transition refusal.
- Stale revision, same-field collision, independent field preservation, changed authority, disconnected/wrong-mode adapter, missing target, unsupported operation, incompatible packet, and duplicate mapping.
- Separate native exports, approved receipts, verifier mismatch, target rollback, Mirror-side rollback, safe-file path/action allowlists.
- Event order, previous-hash links, altered-event detection, snapshot references, and actor/packet attribution.
- Shared-control uneven teams, no AI autofill, actor-neutral surface, no hidden machine actions, and rejection of authoritative/omniscient AI observations.

## Not run / not tested

- Rendered browser assertions in `tests/browser-smoke.js`: UNRUN, no browser executable.
- Windows batch files on native Windows: UNTESTED. Their commands match the tested npm/Node entry points.
- Active PR #13 Foundation installation and all real adapters: UNTESTED and not claimed.
