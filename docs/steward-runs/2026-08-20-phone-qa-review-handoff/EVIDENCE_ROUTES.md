# Evidence routes

Status: `TEST`

## Exact candidate to shared inbox

- Claim: QA Lab opens one Review Inbox item bound to the candidate's verified native digest.
- Primary evidence: `shared/operations/wave2-selftest.js` in an isolated temporary state root.
- Pass: native digest recomputation, exact source/action binding, idempotent open, one required seat, and reload equality.
- Counterevidence: accepted digest drift, parallel review storage, duplicate open items, mismatched game/slot, or lost state after service recreation.

## Human review to campaign input

- Claim: only the latest exact human vote can produce the existing campaign's five fields.
- Primary evidence: operations selftest plus `shared/voluntary-phone-qa-campaign/selftest.js`.
- Pass: non-human latest vote is non-exportable; human approve maps complete to acceptance; incomplete maps to `INCOMPLETE`; notes never cross the handoff.
- Counterevidence: machine vote exported, sixth field added, review note retained, unauthenticated identity claimed, or incomplete candidate accepted.

## Authority boundary

- Claim: review does not prove hardware, clear a warning, mutate a manifest, or establish human usefulness.
- Primary evidence: exact action object, handoff truth object, campaign selftest, and the existing two-key phone evidence gate.
- Pass: all authority fields remain false and the warning-free verifier/human-usefulness routes remain separate.
- Counterevidence: any review path changes a game manifest, clears a warning, sets physical proof, or passes the human-usefulness key.

## Live browser route

- Claim: the new handoff is visible and understandable in the real local UI at 1280×720.
- Primary evidence: `LIVE_VISUAL_RECEIPT.json` from a bounded in-app-browser journey.
- Pass: disabled baseline, truthful incomplete capture, enabled open action, explicit no-warning-cleared notice, visible inbox item and false authority flags, no horizontal overflow.
- Counterevidence: hidden/clipped control, silent mutation, missing digest, misleading proof language, or overflow.

## Actual physical phone and human decisions

- Physical-phone behavior verdict: `NOT_RUN`.
- Actual human review verdict: `NOT_RUN`.
- Human usefulness verdict: `NOT_RUN`.
- Scripted votes prove deterministic routing only. The all-false live fixture proves UI transport only.

