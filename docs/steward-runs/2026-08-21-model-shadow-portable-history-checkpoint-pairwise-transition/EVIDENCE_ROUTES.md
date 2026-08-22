# Evidence routes

Status: `TEST`

| Claim | Primary evidence | Verifier | Counterevidence / boundary |
|---|---|---|---|
| Both caller-presented v2.2 anchored packages exact-rebuild before comparison | `exactAnchored` in the v2.3 runtime | Focused success, tampered-candidate, oversized-receipt, and fresh-process cases | v2.2 self-validation still does not authenticate checkpoint origin or pin |
| Stable cryptographic policy posture is compared across packages | `witnessContinuityProfile` and `anchorContinuityProfile` normalize SPKI fingerprints, declared digests, thresholds, age bounds, identities, and anchor epoch | Stable policies pass despite expected per-checkpoint policy digest changes; anchor epoch, witness key profile, and policy ID changes each produce typed holds | Profile equality proves no authenticated policy authority or authorized rotation |
| Every v2.1 ledger identity dimension is compared | `identityComparison` covers log id digest, manifest, genesis, receiver/challenger digests, and receiver policy | Focused log-id drift is held and names the exact changed dimension | Identity digests are caller-presented data, not authenticated real-world identity |
| Forward classification preserves complete settlement history | `buildComparison` requires both proposal and settlement arrays to be exact prefixes | Two independently persisted candidate ledgers each pass from one previous checkpoint; prefix counts are asserted | Pairwise success proves no global uniqueness, retention, or future currentness |
| Exact package replay, exact-history re-checkpoint, rollback, fork, equivocation, and metadata drift remain distinct | Closed `CLASSIFICATIONS`, `classify`, transition schema, and zero-action decision | Focused suite observes all 15 classifications and schema enum equals runtime | Caller times are untrusted; detection is not prevention |
| Withheld forks remain invisible | Truth map and README | Two real fork candidates independently pass from the same previous checkpoint; co-presentation then yields `HOLD_HISTORY_REPLACEMENT_OR_FORK` | A never-presented candidate cannot be observed or excluded |
| Joint pair replacement remains possible | Focused joint-replacement package uses new checkpoint IDs/digests, policies, keys, signatures, and expected anchors for both sides | The replaced pair still classifies as a forward candidate while `originalPairContinuityProven` remains false | No authenticated original pin, external retention, or protected monotonic state exists |
| Runtime is pure and public receipt is data-minimized | Runtime, contract, and receipt constructors | Source scan excludes filesystem/network/signing/private-key APIs; receipt scan excludes PEMs, signatures, private keys, and ledger paths | Caller inputs contain policies/signatures and may contain ledger-derived checkpoint data; the module stores none of it |
| Broader grounded-growth authority remains open | `CAPABILITY_GAP_AFTER.json`, contract refusals, and truth map | Evidence selftest requires all 18 broader routes to remain `OPTIONAL_UNKNOWN` | No provider execution, evaluation, human benefit, learning, execution/adoption authority, promotion, merge, or `CANON` evidence |

Browser render/click evidence is not applicable: v2.3 is a pure nonvisual Node.js adapter with no browser route or visual surface.
