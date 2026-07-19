# Mirror autonomous reasoning experience loop action report

Date: 2026-07-18  
Status: **WORKING / TEST / NEEDS_REVIEW**  
Canon: **no** — only Mike may accept CANON.

This report supersedes
`MIRROR_REASONING_COMPOSITION_AND_EXPERIENCE_ACTION_REPORT_2026-07-18.md`
as the current-state account. The earlier report and private cycles remain
preserved as historical evidence.

## Outcome

Mirror's AXM-native Learning Shell can now turn an independently evaluated,
deterministic local reasoning episode into append-only private experience
without a fixture-list edit. A later private cycle discovers the receipt and
learns from it. Worked and failed episodes are represented separately:

- `WORKED` supplies positive episodic strategy evidence and, only for bounded
  ask/observe/hold behavior, a safe proposal prototype;
- `DID_NOT_WORK` supplies negative episodic evidence and no success prototype;
- neither may write semantic truth, roots, permissions, evidence, canon,
  identity, tools, the runtime pointer, or the Workshop world.

This is a bounded growth loop, not autonomous general intelligence. The learned
strategy model remains a private challenger with `activeRuntime=false`.

## New hard-coded organ

Because Mirror is small, the missing experience boundary was implemented as a
narrow hard-coded organ rather than asking learned weights to invent their own
admission policy:

- organ: `axm.mirror.organ/reasoning-experience-intake-v2`;
- receipt: `axm.mirror.reasoning-experience-receipt/v2`;
- route: `POST /axm/v1/reasoning/experience`;
- storage: append-only ignored private
  `training/datasets/reasoning-receipts/`;
- input gate: deterministic Reasoning Foundation session, standing local
  Workshop permission, independent evaluator identity and content digest,
  explicit observed and expected decisions, outcome verification, and no world
  mutation or runtime-pointer change;
- refusals: learned-model self-training, evaluator self-reference, unknown
  rights, held-out mutation, overwrite, hidden/private reasoning, authority
  expansion, tool use, or semantic truth write.

The Learning Shell now invokes this organ automatically at Lesson Admission.
It binds the curriculum contract, expected decision, and expected seam set into
a deterministic evaluator digest. Challenger Training then discovers verified
receipts through the ordinary private-cycle scan.

## Actual local experience

Five real local Workshop curricula produced five positive episodic receipts.
All recorded `worldMutations=0`, `runtimePointerChanged=false`, and
`semanticConsolidation=false`.

| Lesson | Receipt | Learned structural tag | Receipt digest |
|---|---|---|---|
| Studio reversible own layer | `reasoning-experience-f651c7358873413cd61d2e63` | `bounded-reversible-action` | `b223f576c7efb8fa10b606c44a2bef07f2ec07d37fe31331e7883f31805c9665` |
| Project Room missing permission | `reasoning-experience-8a74ba7c504e4bccfc140b27` | `respect-missing-permission` | `fb94f50fa08ac95aed1238dfdfd9688cac206b56dcc396fb691be094a37466ee` |
| Game Hub missing recovery | `reasoning-experience-2372192bf92ae4e9754707b3` | `require-recovery-before-action` | `d2307d47a41bab9c68bdc96fd048a198e2e62dfbf1678bf67ccbc612b63a797c` |
| Publish blocking evidence | `reasoning-experience-fa263669430a9637c7f61313` | `ask-blocking-unknown` | `64a0208add0619fa0c092d8e0aee82cf2b750e24421fa236b3cd624ac352d8fc` |
| Finance contradiction | `reasoning-experience-99fe1a9eaab8165df8f12e09` | `discriminate-conflict` | `bf57236aa6b72e5089473f8e5df8ba9060af7998252d808aadbd28b60b74812d` |

Three tags—`bounded-reversible-action`,
`require-recovery-before-action`, and `respect-missing-permission`—were absent
from the fixed fixture corpus and learned without adding them to a compiled
model label list. The other two receipts reinforced already evidenced
structural behavior.

## What did not work

The first experience-fed cycle,
`reasoning-skill-24279ebe452c6b95be56`, returned `HOLD_REPAIR`:

- supplied-path evaluation still passed 12/12;
- candidate-free challenger evaluation fell to 6/12;
- candidate-free adversarial transfer fell to 3/8;
- three independent seams remained open.

Cause: the three newly learned single strategies entered the fixed-size
candidate shortlist even when their structural obligation was not observable.
They crowded out ordered strategies and rewarded guessing from learned prior
rather than present evidence.

The failed model, evaluation, lineage, cycle, and Seam Cell report remain under
ignored private state. They were not overwritten or relabelled as success.

## Repair and corrected evaluation

The repair made candidate origination evidence-dependent:

1. derive only obligations visible in the candidate-free problem state;
2. originate only learned sequences compatible with those obligations;
3. rank exact observable obligation coverage ahead of learned prior;
4. originate nothing and return `HOLD_UNDERSPECIFIED` when the removed
   candidate profiles contained the only evidence for a desired action.

This also corrected an earlier evaluation overclaim. Removing both candidate
actions and their profiles erased the only tool-need signal in two cases and
part of the expected sequence in two more. Therefore 12/12 exact recovery was
not an evidence-supported candidate-free target.

Final preserved private cycle: `reasoning-skill-fff18bda65b97c3b14f1`.

- inputs digest:
  `fff18bda65b97c3b14f1969a854aee61707cb80457c6e227d6f1146539c53a9c`;
- model: `reasoning-strategy-c5168a2153a81974efcecc0a`;
- model digest:
  `87d61a8627126cc8e9492edc6e2d7c4c7aa840661c0accc350d24e095c1ad5a5`;
- supplied-path baseline/challenger: 0/12 -> 12/12;
- supplied ordered mixed-signal exact: 4/4;
- adversarial supplied transfer: 8/8;
- candidate-free observable baseline/challenger: 2/12 -> 12/12;
- candidate-free observable ordered composition: 2/2;
- safe under-specified holds: 2/2;
- corrected legacy exact diagnostic: 8/12;
- behavior and authority canaries: 15/15;
- independent open implementation seams: 0;
- receipts: 5 positive, 0 negative;
- promotion state: `PROPOSE_HUMAN_REVIEW`, never automatic.

Artifact hashes:

- `reasoning-strategy-model.json`:
  `3ef1ee0fe0cb15d4c05befc2d7ea50b6a449abfa0f89f1bcc3e6a18464d661a7`;
- `evaluation.json`:
  `f4ab553843df866915570c59f0bdf3c47fce6a968d8e00017984c3152350af3b`;
- `training-session-lineage.json`:
  `7a842c14692e8c6320018e27992e17257d2a958098e7ea84d6da8bdd4dd36b66`.

## End-to-end shell proof

Session `learning-shell-mrq5jmu3-e46cb131` completed Context, Analysis,
Reasoning, Seam Review, Lesson Admission, Challenger Training, and Judgement.
It reused the Studio episode and receipt and reused the final reasoning cycle.
The reasoning track reached `PROPOSE_HUMAN_REVIEW`; token cycle
`cycle-880f4618246242a42273` remained `HOLD_REPAIR` because the independent
token track still has only 5,566 training tokens. The overall shell verdict
therefore remained `HOLD_REPAIR`. No authority or runtime pointer changed.

## Live runtime

The exact prior process was verified as `node runtime/server.js` and restarted
once from PID `24416` to PID `28844` after tests. Live `/health` at
`127.0.0.1:8818` reports:

- organ `axm.mirror.organ/reasoning-experience-intake-v2`;
- automatic Shell capture `true`;
- positive and negative episodic evidence `true`;
- semantic truth write authority `false`;
- learned self-training `false`;
- `learnedWeights=false`;
- active learned strategy model: none.

## Verification

- core: 78/78 tests passed;
- Mirror Learning Forge: 99/99 tests passed;
- AXM Native Learning Shell: 5/5 tests passed;
- Forge build integrity: 148/148 files passed;
- Mirror Doctor: PASS;
- JSON parse sweep: 115 documents passed;
- final reasoning cycle rerun: deterministic `REUSED`;
- private receipts, cycles, and shell sessions: confirmed ignored by Git;
- network used by tests or training: no.

## Known limits and next evidence gates

- Five bounded deterministic curricula are not broad reasoning evidence.
- All five actual receipts are positive. Negative evidence storage and model
  suppression passed synthetic tests, but no real failed local lesson receipt
  has entered a preserved cycle yet.
- Candidate-free exact legacy agreement is 8/12, not 12/12. The observable
  contract is the defensible 12/12 result.
- The private challenger is not loaded by the active runtime.
- The separate token corpus remains below its evidence gate.
- No human acceptance, CANON status, general intelligence, consciousness,
  safety proof, or self-directed authority is claimed.

The next honest step is to accumulate diverse, independently evaluated real
episodes—including real failures and verified repairs—then repeat held-out,
counterexample, regression, source-isolation, and authority-canary evaluation.
A recurring narrow gap may earn another hard-coded organ only through the
existing Organ Admission Cell and Mike's review.
