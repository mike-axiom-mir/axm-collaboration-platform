# Identity Shell Fabric receipt-binding steward run v0.1

Status: `TEST` · capability route: `DEGRADED` only by three optional runtime/authority gaps

This append-only run records a third bounded hardening pass on the EXPERIMENTAL AXM Identity Shell Fabric. The product snapshot is commit `b5937f50c2ba6ab4d718dd2eb1d04d9c125c4aac` on `codex/identity-shell-fabric-keel-trial-v0.1`.

The pass began with counterevidence: an arbitrary reference schema could mark continuity accepted; a succession authorization could name a retirement subject with empty evidence; and neither primary nor independent standalone build/lineage receipt verifiers existed. The product commit closes those seams without changing the proposed Keel shell manifest digest.

What is now evidenced:

- exact `axm.human-acceptance/v1` references are required for accepted continuity events, without claiming that the compiler authenticates a human;
- human authorization receipts bind decision, proposal type, one exact parent manifest, and explicit continuity evidence, while compilation binds those references to its lineage input;
- build/gap and lineage receipts can be checked independently of compilation through primary and separate verifier implementations;
- 105 focused receipt assertions reject 13 re-signed build attacks and 13 re-signed lineage attacks through both verification boundaries;
- a fresh process that never imports the compiler accepts the two committed Keel receipts and rejects four re-signed receipt variants;
- 20 receipt-corpus processes, 20 fresh receipt-verifier processes, and 20 Keel trial processes have zero failures; all Keel trials produce the same manifest digest;
- all ten required Workshop checks exit 0. `verify.js` reports zero failures and 41 warnings, and `verify-plus` remains `VERIFIED_WITH_LIMITS`.

The pass does not provide a live host, authenticated human acceptance, authenticated human decisions, model execution, runtime continuity observation, robotic actuation, browser UI, installation, promotion, merge, or `CANON`. A valid receipt is not an identity claim, a consciousness claim, or proof of subjective continuity.

## Integration route

Mike remains the merge gate. Review the product commit and this receipt commit on the branch, then merge or cherry-pick them into the intended Workshop branch only after human review. No shared registry, Hub surface, Foundation file, Code Capability Fabric file, Mirror Garden file, or canonical checkout was edited by this run.

## Receipt contents

- `CAPABILITY_REQUIREMENTS.json`, `CAPABILITY_INVENTORY.json`, and generated `CAPABILITY_GAP.json` preserve the capability decision.
- `CHECK_RESULTS.json` preserves commands, outcomes, warnings, adversarial counts, and unrun surfaces.
- `EVIDENCE_ROUTES.md` states what each evidence class can and cannot prove.
- `SESSION_SEGMENT.jsonl`, its seal, `SESSION_SUMMARY.md`, and `CURATION_RECEIPT.md` preserve a compact append-only session record without raw terminal retention.
- `FILE_HASHES.json` binds the changed product files and evidence documents by SHA-256.
