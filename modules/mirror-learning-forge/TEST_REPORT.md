# TEST REPORT — AXM Mirror Learning Forge local v0.7

Date: 2026-07-17

## Automated suite

Command:

```text
npm test
```

Result:

```text
94 tests
94 pass
0 fail
0 skipped
0 cancelled
```

## Adaptive Communication controls

Verified:

1. Adaptive catalog is explicit and authority-free.
2. Mirror may choose a class but cannot approve it.
3. Steward approval remains challenger-only.
4. Grounded sample preserves protected meaning.
5. Protected-field mutation triggers repair.
6. MAINTAIN is accepted when the current form works.
7. Truth cannot override privacy.
8. Over-accommodation is rejected.
9. Under-accommodation is rejected.
10. Audience facts and assumptions remain separated.
11. Agreement is not treated as success.
12. Adaptivity profile is developmental, not a benchmark.
13. Adaptive episodes keep protected and delivery fields separate.
14. Adaptive fixtures and curriculum are packaged and frozen.
15. Rooted class `Adaptation Without Submission` is present.
16. Authority from adaptivity grades remains NONE.

## Adaptive demo

Command:

```text
npm run adaptivity:demo
```

Observed:

```text
Mirror class choice: AWAITING_REVIEW
Steward review: APPROVED · challenger-only
Adaptive grade: PASS · 100
Adaptation is not submission: true
Semantic preservation requires verification: true
Audience model is tentative: true
Communicative success is not agreement: true
Authority from grade: none
```

## Static syntax checks

Passed:

- `core/adaptive-communication.js`
- `core/forge.js`
- `server/server.js`
- `ui/app.js`
- `scripts/build-manifest.js`
- `scripts/verify-build.js`

No submitted learner code was executed by these checks.

## Existing regression suite

All earlier v0.6 systems remained passing:

- cumulative token learner and inherited counts;
- challenger isolation;
- held-out-suite freezing;
- Native Seam Cell;
- promotion and rollback;
- growth governor and forecast;
- JSON truth boundary;
- coding static analysis and execution refusal;
- Studio class selection, assigned layers and screenshot boundary;
- Rooted Intelligence anti-parroting, tension and dissent;
- Reasoning School receipts, transfer profile and no-IQ boundary;
- journal hash chain;
- proposal-only Mirror Core packet.

## Local HTTP smoke

Loopback server started on `127.0.0.1:8801`.

Verified:

- `/api/health` returned service version `0.7.0`;
- adaptive-school boundary was true;
- adaptation-is-not-submission was true;
- semantic-preservation-required was true;
- audience-model-is-tentative was true;
- agreement-is-not-success was true;
- adaptivity-authority-from-grade was false;
- runtime remained local-only with no automatic promotion.

## Growth forecast regression

The forecast still separates intake pressure from authority:

- 1.25× scenario, cycle 20: 694 uncapped sessions, promotions capped at 1;
- 1.60× scenario, cycle 20: 75,558 uncapped sessions, promotions capped at 1;
- 2.00× scenario, cycle 20: 5,242,880 uncapped sessions, promotions capped at 1.

These remain scenarios, not predictions.

## Build boundaries

- Loopback host only
- External network: false
- Automatic training: false
- Automatic promotion: false
- Live Mirror apply: false
- Code execution authority: false
- Studio pixel authority: false
- Root canon-edit authority: false
- Single IQ score: false
- Hidden chain-of-thought required: false
- Adaptive Communication School: true
- Adaptation is submission: false
- Semantic preservation required: true
- Audience model certainty: false
- Agreement as success: false
- Authority from adaptivity grade: false

## Manifest and packaged-state verification

- Build manifest: **136 files**
- Hash verification: **136 / 136 PASS**
- Runtime consent: **OPTED_OUT**
- Revision: **0**
- Authority revision: **0**
- Journal entries: **0**
- Models, sessions, lessons, tasks, grades, curricula and dissent records: **empty**

## Final status

**WORKING LOCAL TEST**

The package proves that the Learning Forge can teach and inspect bounded adaptation without rewarding submission, agreement, manipulation, core drift or self-granted authority.

It does not yet prove native Mirror adaptivity; that remains the explicit Codex integration seam.
