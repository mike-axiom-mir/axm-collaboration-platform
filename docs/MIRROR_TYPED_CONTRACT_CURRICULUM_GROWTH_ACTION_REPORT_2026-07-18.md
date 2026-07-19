# Mirror typed-contract curriculum growth action report

Date: 2026-07-18  
Status: **WORKING / TEST / NEEDS_REVIEW**  
Canon: **no** - only Mike may accept CANON.

This report supersedes
`MIRROR_COMPOSITIONAL_METAMORPHIC_GROWTH_ACTION_REPORT_2026-07-18.md` as the
current-state account. It does not erase that report, its 70-probe batch, or
any earlier success, failure, or superseded artifact.

## Outcome

Mirror now has the small hard-coded organ this seam earned: the Reasoning
Contract Curriculum Organ v2. It removes the five-hand-written-lesson catalog
as the only source of private reasoning practice. The organ discovers valid
local Workshop module contracts, reads only the typed
`boundaries.refuses[]` field, and turns one content-addressed refusal per module
into a complete deterministic Reasoning Foundation exam.

The current external snapshot contains 40 contract files: 39 eligible typed
contracts and one visibly excluded template. A stable module-level split puts
31 module IDs in private training and keeps 8 module IDs held out. The current
batch preserved 39/39 refusal boundaries with zero mismatch. The private
challenger then originated a non-mutating `respect-explicit-prohibition` hold
on 8/8 held-out contracts. Held-out training receipts: zero. Split leakage:
false.

This is meaningful autonomous curriculum growth, not autonomous authority.
During the live audit, two independently changing Workshop contracts produced
new immutable curriculum snapshots without a Mirror code edit, lesson edit, or
module-ID list edit. The learned model remains private and inactive, generated
human prose has no decision authority, and no examined Workshop action ran.

## The seam and the organ decision

Mirror's earlier real practice route started from exactly five hand-written
lesson definitions. Counterexample and metamorphic organs could expand those
examples, but a new independently authored capability boundary still required
us to add another lesson. The Workshop already exposed machine-readable module
contracts, so this was a narrow missing intake organ rather than a reason to
make the general kernel guess from prose.

The organ is deliberately small and deterministic. It provides:

- bounded discovery under the permissioned local Workshop `tools` root;
- refusal of symbolic links, unsafe paths, invalid JSON, schema/ID mismatch,
  empty or duplicate refusal lists, and more than 64 eligible contracts;
- one deterministic typed refusal exam per content-digested contract;
- a stable `sha256(module-id) % 4` contract-level held-out assignment;
- full machine state, human rendering, Principle trace, independent Seam
  review, session digest, and file hash for every exam;
- append-only v4 Experience receipts for training-partition exams only;
- candidate-free held-out evaluation after the private strategy cycle;
- negative evidence plus a Frontier assessment on a real mismatch;
- no code generation, execution, installation, promotion, canon, identity,
  permission, tool, network, world-action, or semantic-truth authority.

It does not let learned weights discover contracts, choose expected answers,
grade the sessions, alter the partition, or admit held-out evidence.

## What worked

- Discovery found 39 eligible contracts without a hard-coded module catalog.
- Only `boundaries.refuses[]`, the module ID, and the exact contract digest
  determine the expected boundary; generated human wording is explicitly
  non-authoritative.
- Stable partitioning kept all eight held-out module IDs out of every training
  receipt and out of the learned feature vocabulary.
- All 39 current refusal exams matched the independent expected decision.
- The training partition taught the structural strategy
  `respect-explicit-prohibition`; no goal-word feature was learned.
- The private challenger passed 8/8 candidate-free held-out module exams with
  zero independent Seam findings.
- Changing held-out content created a new held-out evaluation trace but no
  receipt and no reasoning-model change.
- Changing training content created one new typed contract receipt; the old
  receipt remained preserved rather than overwritten.
- Automatic runtime practice and the Learning Shell converged on the same
  current contract batch, reasoning cycle, counterexample batch, and
  metamorphic batch.
- An immediate repeat discovered unchanged inputs and reused the immutable
  batch and reasoning cycle instead of multiplying evidence.

## What did not work and how it was repaired

Focused integration exposed a real v1 design failure before production use.
Version 1 learned a generic `constraint-type:prohibit-action` feature. A Studio
problem contained a prohibition aimed at one action plus a different safe
candidate; the generic feature contaminated that unrelated safe candidate and
could make a learned hold crowd it. The v1 input digest also failed to bind the
feature-extraction policy, so a policy change could have reused an incompatible
batch identity.

Version 2 repairs both failures:

- `candidate-prohibition:present` is derived only when a prohibition targets a
  candidate that is actually present;
- a candidate-free contract exam may still expose
  `respect-explicit-prohibition`, because no unrelated candidate can be
  contaminated;
- the exact implementation contract
  `candidate-targeted-prohibition-v2` is part of the input digest;
- the v1 organ is named as
  `KNOWN_FAIL_PRESERVED_NOT_TRAINING_EVIDENCE` rather than silently forgotten.

The focused failure is evidence that the integration tests did useful work. It
is not counted as a successful production batch.

## Current immutable contract evidence

Current batch: `reasoning-contract-curriculum-bc243f2d5efc245c879d`

- schema: `axm.mirror.reasoning-contract-curriculum-batch/v2`;
- inputs digest:
  `bc243f2d5efc245c879d1f85f540f5dfe8f87125f9e9294dacbc6d6897085baf`;
- batch digest:
  `40b6cef591903d4352121b2c1fc891bf61523d7d6419a43640f58f4e5c623216`;
- batch file SHA-256:
  `68d996822c34e39ce453ab31993dd1e469339412e5eeec0a0c4c050de914e4ff`;
- discovered/eligible/excluded contracts: 40/39/1;
- current private-training/held-out module IDs: 31/8;
- preserved/mismatched current boundaries: 39/0;
- current-run receipts appended/reused: 1/30;
- positive/negative current training receipts: 31/0;
- current batch session files and hashes: 39/39;
- current batch session bytes: 658,737;
- Frontier state: `NO_UNEXPECTED_SEAM`.

Held-out evaluation:
`contract-held-out-b7972e901954266314b0`

- schema: `axm.mirror.reasoning-contract-curriculum-held-out/v2`;
- evaluation digest:
  `d7cc4df82be6503399019d764b1b7a54fc5cf53ed1653c4965d945b485e144be`;
- evaluation file SHA-256:
  `3359e55c14a79324dd12917df88b09672248a78920670224cf5fd00d348be848`;
- challenger passed/failed: 8/0;
- originated candidate kind: non-mutating `hold` only;
- held-out training receipts: 0;
- split leakage: false;
- independent Seam findings: 0;
- held-out session files and hashes: 8/8;
- held-out session bytes: 272,712.

Source and schema hashes:

- `organs/reasoning-contract-curriculum-organ.js`:
  `711ee90794523fc1f7fb4ce80e4f590a1cbe91a1ba30bbfd9e03a53097838dbc`;
- batch schema:
  `51f560eb3b886d62497501aad95d3cb65a65678c0282d5762dbcd380c4f40cea`;
- held-out schema:
  `c1b87c5851eadc917e6f99b3a3299bcaeae4bcb4bf37bab8af29de9bed62f05f`;
- `organs/reasoning-experience-organ.js` v4:
  `069a9f769516a52c73624787a99fedfc35ac7e1a22be1ebf999f6d3b191489bf`;
- experience-receipt v4 schema:
  `364db86e68581bf8dee1299503b0fb3bc4b0be0a7b7f945326091ae048adf449`.

## Live external-change lineage

All three v2 snapshots remain preserved under ignored private state.

1. Initial snapshot
   `reasoning-contract-curriculum-86160a97464941a73f92` appended 31 training
   receipts and held out 8 modules. Its batch file hash is
   `2d0864edf9d5296422b29a9023043f62871bec53e7ca8a038025312c20a0efef`.
2. `asset-fabric`, a held-out module, changed from contract digest
   `f4e7b912...` / boundary `automatic-studio-write` to
   `a32934e6...` / boundary
   `deleting-creation-because-review-attention-is-full`. Snapshot
   `reasoning-contract-curriculum-d28c07b8d502d33dc699` reused all 31 training
   receipts, created a new held-out trace, and left the reasoning cycle
   unchanged.
3. `studio`, a training module, changed from contract digest
   `5f4c7115...` / boundary `automatic-proposal-acceptance` to
   `e1b4245d...` / boundary `unsupported-target-canvas-claim`. The current
   snapshot appended receipt
   `reasoning-experience-fd09b206877c73f6d4e6f746` and reused the other 30.
   Its earlier receipt
   `reasoning-experience-4d7c3530f7a86e28f9312ee1` remains visible.

The current snapshot still has 31 training modules, but the append-only
reasoning corpus contains 32 contract-derived receipts because both Studio
contract versions are historical evidence. That distinction is intentional;
history is not silently made to look like current configuration.

## Resulting private learning

The Studio change also entered through the existing real-lesson route. It
created the seventh verified real local receipt, which automatically produced
three additional parent-linked semantic counterexamples. The current private
cycle is `reasoning-skill-307f60e944693d127e4a`:

- discovered Experience receipts: 57;
- admitted Experience receipts: 50;
- admitted real local / parent-linked synthetic / contract-derived: 7/11/32;
- preserved Counterexample Organ v1 receipts excluded: 7;
- positive/negative admitted episodes: 50/0;
- semantic consolidations from episodic evidence: 0;
- learned model: `reasoning-strategy-949656353ff595d8a6d492a1`;
- learned model digest:
  `206b422e695f883ba59467b7c4caba0fe0427d4c5024fadb37f978fe718597a2`;
- frozen supplied-path transfer: baseline 0/12, challenger 12/12;
- adversarial transfer: 8/8;
- candidate-free observable transfer: baseline 2/12, challenger 12/12;
- legacy exact: 8/12, with two safe under-specified holds;
- behavior, source, evidence-class, known-fail, and authority canaries: 17/17;
- independent open seams: 0;
- state: `PROPOSE_HUMAN_REVIEW`;
- active runtime model: false;
- runtime pointer changed: false.

The associated v2 batches also grew from the new real parent:

- counterexamples:
  `reasoning-counterexamples-8e562ee82d4ab640d057`, 11/11 worked, 3 appended,
  8 reused, zero mismatch;
- metamorphic:
  `reasoning-metamorphic-bbd5368cdd4a2c0e27dd`, 85/85 invariant, comprising
  31 atomic and 54 generated pairwise probes at maximum depth 2;
- metamorphic probe files and hashes: 85/85, 1,536,089 bytes;
- metamorphic matches admitted to training: 0;
- metamorphic negative receipts and Frontier repair candidates: 0.

## Automatic runtime and Shell proof

The exact loopback runtime process was verified as `node runtime/server.js`,
then safely replaced from PID 31168 with PID 26448 so the current code and state
were loaded. Live automatic report
`curriculum-20260718111615477-a7ed3fda36c3` exposes:

- contract batch `reasoning-contract-curriculum-bc243f2d5efc245c879d`;
- 39 eligible, 31 training, 8 held out, 39/39 preserved, zero mismatch;
- 8/8 held-out transfer and zero held-out receipts;
- reasoning cycle `reasoning-skill-307f60e944693d127e4a`;
- 7 real, 11 semantic-counterexample, and 32 contract-derived receipts;
- 85 metamorphic probes, zero mismatch, and zero positive probe receipts;
- `lastError=null`, `learnedWeights=false`, active learned runtime false;
- token state `HOLD_REPAIR` only because its separate corpus remains below the
  50,000-token language gate.

Fresh Shell session `learning-shell-mrq9opaz-fff3cd50` completed all seven
stages. It was the route that observed the Studio change, appended the new
contract-derived and real receipts, derived the new counterexamples and probes,
and produced the current private cycle. It ended
`PROPOSE_HUMAN_REVIEW` for reasoning and `HOLD_REPAIR` for language, with no
runtime pointer, authority, semantic-truth, canon, permission, tool, or world
mutation.

## Verification

- focused Contract Curriculum Organ tests: 3/3;
- focused contract, Shell, Workshop, and runtime integration: 10/10;
- Mirror core full suite: 90/90;
- Mirror Learning Forge full suite: 99/99;
- AXM Native Learning Shell full suite: 6/6;
- Forge build integrity: 148/148 files;
- Mirror Doctor: PASS, runtime PID 26448;
- current contract training-session hashes: 39/39;
- current contract held-out-session hashes: 8/8;
- current metamorphic-session hashes: 85/85;
- deterministic contract batch, held-out evaluation, and reasoning cycle reuse:
  PASS;
- live automatic wake and fresh seven-stage Shell route: PASS;
- Node JSON parse sweep after this audit: 764/764;
- `git diff --check`: PASS; only expected LF-to-CRLF working-copy warnings;
- private contract traces, Experience receipts, Shell sessions, datasets,
  checkpoints, and runtime token: confirmed ignored;
- outside-network use by tests or training: none;
- evaluated Workshop actions executed: none.

One attempted PowerShell `ConvertFrom-Json` sweep rejected Forge's valid
`package-lock.json` property shape before the Node sweep ran. The repository's
actual runtime parser is Node `JSON.parse`; that parser passed 764/764. The
failed diagnostic is reported here rather than re-labelled as a pass.

## Changed surfaces

This milestone adds the Contract Curriculum Organ and its two schemas; upgrades
the Experience Organ and receipt schema to v4; extends structural strategy
learning and reasoning-cycle lineage for contract-derived evidence; integrates
contract discovery and held-out evaluation into automatic Workshop practice,
the Learning Shell, runtime health, runners, Doctor, policy, API and module
contracts; adds focused and integration tests; and updates status, model BOM,
documentation, this report, and the paired machine audit.

Private receipts, datasets, contract sessions, held-out sessions, learned
models, checkpoints, runtime logs, tokens, and Shell sessions remain ignored
local state. No file was staged or committed.

## Known limits and next evidence gate

- Only one deterministic refusal is selected from each contract per content
  snapshot; this does not test every declared refusal.
- All current production contract exams matched. The negative mismatch route is
  tested mechanically, but no genuine external contract mismatch exists yet.
- All seven genuine real local receipts are positive and correlated; two pairs
  are successive Publish and Studio versions.
- The 8-module held-out set is stable and clean but small. Its candidate-free
  route tests safe prohibition transfer, not arbitrary module competence.
- The held-out baseline originates zero candidates by definition; the useful
  evidence is the challenger result plus the zero-receipt and zero-leakage
  checks, not a claimed measured baseline competition.
- A changed training contract remains a new historical receipt. Old evidence
  is preserved, so future weighting or supersession policy may be needed if a
  module changes frequently or reverses a boundary.
- The Workshop was externally changing during the audit. The current IDs and
  hashes are a verified 2026-07-18 snapshot, not a promise that external files
  cannot change later.
- The organ consumes a typed boundary; it does not invent arbitrary new organs,
  rewrite itself, or decide that an external contract is true or wise.
- The learned strategy model remains a private inactive challenger.
- No CANON, general reasoning, general AI, consciousness, safety proof, or
  self-directed authority is claimed.

The next honest gate is an independently authored contract mismatch, a larger
unchanged held-out module set, or repeated evidence that one-boundary selection
misses a material refusal family. That evidence may earn another narrow organ
or selection policy. It cannot authorize Mirror to write, install, promote, or
grant authority to its own repair.
