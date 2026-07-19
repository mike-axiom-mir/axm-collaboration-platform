# Paste-ready Workshop prompt: Cognitive Resource Meter and Economics Hand

```text
/goal Inspect the current AXM Workshop before changing anything. Search all
module contracts, manifests, shared services, provider declarations, Hands,
Technical Glasses, tests, and current Cognitive Work Ledger work. Extend the
exact existing owner when present. Create a new module only when no compatible
owner exists, and record the missing provider relation that proves the need.

PURPOSE

Build the Workshop producer side for honest cognitive-resource economics. It
must capture content-bound machine receipts and versioned rate/hardware
profiles that Mirror can independently transform into money, energy, and
carbon intervals. It must never pretend tokens are universal compute, never
double count overlapping accounting meters, and never choose the cheapest
model, hardware, provider, or plan.

MIRROR CONTRACTS

Produce exact JSON compatible with these versioned Mirror contracts by copied
contract digest or declared provider binding, never by an absolute Mirror path:

1. axm.mirror.cognitive-work-observation-draft/v1
2. axm.mirror.cognitive-resource-economics-profile-draft/v1

Authoritative public filenames for contract review:

- contracts/cognitive-work-observation-draft.schema.json
- contracts/cognitive-resource-economics-profile-draft.schema.json

Do not write into Mirror. Emit typed outputs such as
COGNITIVE_WORK_OBSERVATION_DRAFT and
COGNITIVE_RESOURCE_ECONOMICS_PROFILE_DRAFT through normal Workshop Hands.

RESOURCE RECEIPT

Reuse the existing cognitive-work receipt contract. Capture source, objective,
privacy-safe start/end state digests, work shape, pre-existing implementation
state, model/tool/environment/hardware digests, exact provider token-meter and
compute-meter IDs and coverage, observed quantities, timing, verification,
outcome, cost basis, and permission. Missing values stay null/UNKNOWN; provider
units are never relabelled as FLOPs. Do not capture prompts, responses, hidden
reasoning, secrets, identities, private memories, or content snapshots.

ECONOMICS PROFILE

The profile draft has exactly: schema, source, scope, components, permission.

Bind sourceSystemId, sourceRecordId, sourceRecordDigest, collectionMethod,
authorshipState, rateScheduleDigest, effectiveWindowId, and freshnessState.
Freshness may be CURRENT_DECLARED_NOT_CERTIFIED, HISTORICAL, or UNKNOWN; the
Workshop cannot certify external freshness merely because it fetched a page.

Support exactly three separated accounting modes:

- PROVIDER_TOKEN_BILLING
- PROVIDER_COMPUTE_UNIT_BILLING
- LOCAL_HARDWARE_TIME

Bind currency, modelProfileDigest, hardwareProfileDigest,
tokenMeterDefinitionId, and computeMeterDefinitionId as required by the exact
mode. Components use one metric, a positive quantityDenominator, and nullable
moneyMicrosPerQuantity, energyMilliwattHoursPerQuantity, and
carbonMilligramsPerQuantity. At least one rate must be present.

Allowed metrics:

- INPUT_TOKENS
- CACHED_INPUT_TOKENS
- OUTPUT_TOKENS
- REASONING_TOKENS
- TOTAL_TOKENS
- PROVIDER_COMPUTE_UNITS_MICROS
- CPU_CORE_MILLISECONDS
- ACCELERATOR_MILLISECONDS

Never combine TOTAL_TOKENS with token-component rates in one profile. Never put
token metrics in local-hardware accounting, hardware time in provider-token
billing, or provider compute units in a hardware-time profile. Never combine
separate currencies or silently refresh a rate schedule in place. Append or
supersede with source lineage.

MODULAR HANDS

Build or connect reusable typed Hands for:

1. provider-specific goal/run token and timing receipt capture;
2. provider compute-unit telemetry capture where directly exposed;
3. privacy-safe model, environment, and hardware profile sealing;
4. versioned billing-rate schedule capture;
5. local hardware time-to-money/energy/carbon rate-profile capture;
6. exact Mirror observation-draft export;
7. exact Mirror economics-profile-draft export;
8. append-only archive/rollback with hot digests and recoverable cold detail.

Provider adapters remain replaceable. Names, selectors, consumers, or files do
not prove provider identity. Missing provider declarations must hold and route
through the normal hand/declaration research path.

BOUNDARIES

- Evidence producer only; do not calculate or certify Mirror's result.
- No automatic outside-network price refresh. A separately permissioned fetch
  may create a new source record, never mutate an old profile.
- No nonlinear billing claim unless a later version explicitly models minimums,
  tiers, reservations, taxes, credits, concurrency, and effective periods.
- No measured or billed cost claim from a profile-derived calculation.
- An 80% resource-prediction target remains lineage, not 80% cost accuracy.
- Keep money, energy, carbon, time, human attention, privacy, risk, and
  verification as separate dimensions; no composite intelligence or value score.
- No automatic ranking, optimization, model/hardware/provider selection,
  budget allocation, permission, training, release, canon, or world action.

TESTS

Add deterministic adversarial tests for exact schemas, extra-field refusal,
mutation detachment, source/rate digest drift, stale/historical/unknown
freshness, permission holds, currency mismatch, missing model/hardware/meter
bindings, total-plus-component token double counting, cross-mode metric mixing,
missing quantities, partial meters, zero and very large safe-integer rates,
rounding boundaries, cost/energy/carbon separation, secrets and identity
exclusion, path traversal, symlinks, tamper, divergent content-address
collisions, concurrent identical append, no required third-party installs, and
zero automatic ranking/selection/authority.

DELIVERY

Follow Workshop roots: truth before story, agency/non-domination, continuity
and lineage, wisdom over speed, and no fake done. Keep status TEST until Mike
accepts CANON. Run focused tests, full Workshop tests, inventory, Doctor,
Technical Glasses, and declared self-tests. Preserve failed attempts and report
changed files, reused providers, new Hands, source/contract digests, tests run
and not run, private-state exclusions, rollback, and known limits.

End with a paste-ready Mirror handoff containing module ID, contract and
provider-declaration paths/digests, output kinds, hand IDs, test evidence, and
the strongest claim ceiling:

TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER

It may not claim universal token-to-compute conversion, current-price
certification, nonlinear billing, measured/billed cost, calibrated cost
accuracy, cheapest-path authority, or automatic selection.
```
