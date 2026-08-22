# AXM Human Interface Intelligence v0.5.0 — Action Report

## Shared-contract version

`axm.capability-interface-contract` `0.1.0`

The shared contract was **not changed** by this increment. New v0.5 outputs are Module-2-specific envelopes and do not add private fields to the shared Capability Record or Interface Recommendation schemas.

## Genuinely implemented

1. **Quarantine signal retention**
   - Converts blocked/failed intake findings into signal-only packets.
   - Explicitly disables execution authority, automatic canon, source mutation, and contract mutation.
   - Failed records are not promoted to accepted facts.

2. **Bounded robustness probing**
   - Runs deterministic synthetic counterfactual contexts without modifying the original context or capability.
   - Probe surface is bounded to a maximum of eight per record.
   - Distinguishes non-blocked stability, stable-blocked outcomes, pattern sensitivity, and status sensitivity.

3. **Pattern coverage analysis**
   - Counts selected and top-three interface patterns for a batch.
   - Reports unused patterns while explicitly refusing to treat one-batch non-use as deletion evidence.

4. **Decision drift classification**
   - Compares decision receipts and identifies changed capability, context, registry, engine, contract, or decision fingerprints.
   - Reports candidate change causes without claiming causal sufficiency when multiple inputs changed.

5. **Shadow signal packet for Module 3**
   - Converts sensitivity and coverage outputs into non-authoritative research signals.
   - Marks synthetic counterfactuals as non-observed evidence.

6. **Append-only signal-ledger preview**
   - Hash-chains quarantine and shadow signal packets.
   - Verifies sequence, previous-entry hash, entry hash, and packet hash.
   - Explicitly reports `NOT_WRITTEN_TO_LOCAL_LEDGER`.

7. **CLI additions**
   - `robustness`
   - `decision-drift`
   - `signal-lab`

8. **Documentation and schemas**
   - Signal-first intake guide.
   - Robustness/drift guide.
   - Updated three-module intake guide.
   - Module-specific schemas for robustness, coverage, quarantine signals, drift, signal lab, and ledger preview.

## What remains design/preparation only

- Persistent local signal-ledger storage.
- Module 3 ingestion of these packets in the real local runtime.
- Empirical calibration against human usability studies.
- Automatic discovery of new interface patterns.
- Any change to the shared contract beyond `0.1.0`.
- Repair of the Module 1 contract conflict.

## Automated verification

- **87 tests collected**.
- **87 passed**.
- **0 failed**.
- Python compile verification passed.
- Module capability declaration validates against the shared Capability Record schema.
- Dependency lock: **5/5 PASS**.
- Generated signal-lab reports validate against their module-specific schema.
- Ledger mutation tests detect tampering of signed fields.

## Authoritative ten-fixture result

- Cross-module consistency: **10 PASS**.
- Direct recommendation: **4**.
- Conditional recommendation: **4**.
- Insufficient information: **1**.
- No safe match: **1**.

This distinction remains intentional: consistency is not the same as execution readiness.

## Shadow robustness result

- 4 `stable_under_bounded_probes`.
- 2 `stable_blocked_under_bounded_probes`.
- 2 `pattern_sensitive`.
- 2 `status_sensitive`.

Specific sensitivity signals observed:

- image background replacement can switch away from live-preview controls when declared tools are removed, and can become conditional under tighter compute;
- real-time visual editing remains on live-preview controls but becomes conditional under tighter compute or missing tools;
- game-controller input remains on controller-style input but becomes conditional under tighter compute or missing tools;
- long-running automation can switch from automation recipe builder to approval/confirmation when skill is reduced or supporting tools disappear.

These are synthetic counterfactual findings, not observed user behavior and not proof that the base decisions are wrong.

## Current Module 1 anchor

The supplied stable anchor remains **BLOCKED before Capability Record consumption** because of the previously documented shared-contract identity conflict.

v0.5.0 does not hide or adapt that conflict. It now retains the blocked boundary as signal, but:

- recommendations: `NOT_RUN`;
- robustness probes: `NOT_RUN`;
- pattern coverage: `NOT_RUN`.

## Assumptions still present

- The deterministic score weights are engineering policy, not empirically calibrated utility values.
- Current fixture coverage is intentionally small and cannot represent all human/device/accessibility contexts.
- Counterfactual probe dimensions are bounded heuristics selected for diagnostic value.
- A stable result under bounded probes is not proof of global robustness.

## Capability/tool gaps

- No live Module 1 repaired anchor was supplied in this pass.
- Module 3 was not available here as a concrete intake package to execute against.
- No local AXM persistence API was invoked for the signal ledger.
- No real human-interface usability telemetry is present.

## Compatibility risk for local merge

**Module 2 internal risk: low-to-moderate.** The authoritative path is preserved and new logic is separate/shadow by default.

**Cross-module boundary risk: still blocked on the current Module 1 anchor.** The local intake should use the latest Module 1 package/anchor rather than assuming the older conflict disappeared.

The new signal packets are module-specific. Module 3 should consume them as optional advisory evidence rather than treating them as shared-contract fields.

## Recommended next integration step

At local intake:

1. verify Module 2's dependency lock;
2. inspect the latest Module 1 anchor rather than the old blocked one;
3. run the authoritative paired gate first;
4. run `signal-lab` regardless of PASS/BLOCKED so the intake outcome itself is retained as signal;
5. pass only explicitly advisory observation/signal packets to Module 3;
6. let the existing AXM merge authority decide what becomes persistent or canonical.

## Screenshot

A genuine screenshot of the local AXM work environment is **not available in this execution environment**. No fake progress image was generated.
