# Phone-QA contract and runtime closure

Status: `TEST`

This milestone closes the previously recorded `CONTRACT` and deterministic
representation gaps between the Browser, LAN & Hardware QA Lab, the voluntary
phone-QA campaign, and the existing two-key Grounded Growth evidence gate.

The QA Lab now exposes a real bounded candidate path: one bounded slot/game id,
six structured observations, explicit voluntary confirmation, no raw notes,
native digest binding, isolated persistence/reload proof, and visible refusal
when consent is absent. The downstream campaign review rejects ids outside the
current warning queue. The campaign now uses the shared strict deterministic
JSON core.

The wider runtime inventory is 13/13 strict: all 169 unsafe fixture pairs are
refused and all 78 safe fixture pairs retain exact canonical bytes.

The current campaign receipt uses a semantic digest that excludes the
verifier report's volatile timestamp and machine-local source hash. Game ids,
slots, warnings, decisions, manifest/contract references, and every other
campaign field remain bound, so a clean replay is deterministic without
retaining machine paths. The verification runner invokes `verify.js` before
every report consumer, so a clean checkout does not depend on ignored local
report state. Source-file references normalize CRLF and legacy CR line endings
to LF before hashing, keeping receipts portable across Windows checkout modes.

This does **not** claim that a physical phone was used, a controller joined, a
game warning was cleared, or a human found the experience useful. Those remain
separate voluntary evidence routes. No candidate receipt was fabricated during
the live browser check.

Primary checks:

```powershell
node tools/browser-lan-hardware-qa-lab/selftest.js
node shared/operations/wave2-selftest.js
node shared/voluntary-phone-qa-campaign/selftest.js
node shared/grounded-growth-phone-evidence-gate/selftest.js
node tests/shared-runtime-deterministic-json-test.js
node docs/steward-runs/2026-08-20-phone-qa-contract-runtime-closure/selftest.js
node docs/steward-runs/2026-08-20-phone-qa-contract-runtime-closure/verification-selftest.js
```

This branch is review material. It is not merged, promoted, or `CANON`.
