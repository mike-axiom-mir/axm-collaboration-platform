# AXM Verification & Proof — curated 99-organ intake

This is the deduplicated, platform-linked intake of
`AXM_VERIFICATION_PROOF_COMPLETE_100_ORGANS_FINAL_ALL_IN_ONE_2026-07-27.zip`.

## What was accepted

- 99 detached Python reference organs.
- One source file, one test file, one fixture, one contract, one intake
  interface, one status record, one intake card, and one README per organ.
- 990 reference tests passed on this machine across the accepted organs.
- The 792 retained files have 792 distinct SHA-256 content hashes.

The intake is deliberately `TEST_HOLD`, `DETACHED`, `NOT CANON`, and has no
approval authority. The Workshop now exposes the useful memory-only subset
through Verification Proof Lab: 91 organs accept bounded JSON calls through
the browser, local API, or CLI. Eight organs remain guarded because they write
caller-selected paths or require caller-supplied Python callables. Execution is
always explicit and every result remains non-canonical with authority `NONE`.

## What was held out

`axm.verify.clock-timezone-locale-controller` failed its Windows-host test.
Its contract says "Python standard library only", but `zoneinfo` could not
load `Europe/Amsterdam` because no IANA timezone database or `tzdata` package
was available. That undeclared portability dependency must be repaired or
explicitly declared before intake.

## What was not copied

- 200 packaged `.pyc` cache files and every `__pycache__` directory.
- 10 nested checkpoint ZIPs.
- `RUNS`, `ROLLBACKS`, `CHECKPOINTS`, build tools, and repeated receipts.
- 100 identical per-organ `VERSION` files; version `0.1.0` remains declared
  in each organ's status, interface, and contract.
- The bundle's own exact duplicate copies. The source manifest contained 129
  redundant copies in 22 duplicate-content groups.

The original ZIP was not changed or deleted and remains the rollback source.
See `INTAKE_RECEIPT.json` for exact digests, counts, and verification results.

## Verify

```powershell
npm.cmd run test:modular-intake
```

Open `tools/verification-proof-lab/index.html` through the Workshop server, or
use `tools/verification-proof-lab/verification-cli.py` for local JSON calls.
