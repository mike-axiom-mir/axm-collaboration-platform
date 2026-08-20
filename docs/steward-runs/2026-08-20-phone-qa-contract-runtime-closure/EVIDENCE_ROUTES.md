# Evidence routes

Status: `TEST`

## Deterministic representation

- Claim: the voluntary phone campaign no longer accepts or transforms unsafe JSON state.
- Primary surface: runtime fixture scan and `tests/shared-runtime-deterministic-json-test.js`.
- Pass: 13/13 exported runtime modules refuse all 13 unsafe fixtures; all 78 safe pairs remain byte-exact.
- Counterevidence: any accepted/transformed unsafe fixture or safe-byte drift.

## Candidate contract and persistence

- Claim: the QA Lab can construct and persist a bounded phone-observation candidate.
- Primary surface: manifest/contract validation plus `shared/operations/wave2-selftest.js` using an isolated temporary state root and recreated service.
- Pass: one exact game/slot, six booleans, explicit voluntary confirmation, native digest, reload equality, raw-note refusal.
- Counterevidence: undeclared handoff, accepted raw notes, digest drift, lost candidate after restart, or physical-proof truth set true.

## Browser refusal journey

- Claim: the desktop UI makes the optional candidate controls visible and refuses capture without consent.
- Primary surface: live in-app browser at 1280×720 and `LIVE_VISUAL_RECEIPT.json`.
- Pass: all controls visible, no horizontal overflow, visible refusal, zero receipts before and after.
- Counterevidence: clipped controls, silent action, hidden warning, or persisted receipt.

## Physical-phone behavior

- Claim: a separate physical phone joined, acted, disconnected, and recovered.
- Required surface: a voluntary real-device journey plus candidate review and later per-game warning-closure evidence.
- Current verdict: `NOT_RUN`.
- A desktop browser frame, service fixture, or remote-control connection cannot prove this claim.

## Human usefulness

- Claim: the controller experience helps a declared human or cohort.
- Required surface: the existing independent Grounded Growth human handoff and two-key gate.
- Current verdict: `NOT_RUN`.
- Device behavior cannot substitute for human judgment.
