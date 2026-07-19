# Mirror Typed-Trace Language Shadow — TEST action report

Date: 2026-07-18  
Status: TEST, shadow-only, not CANON  
Steward acceptance: not requested and not inferred

## Outcome

Mirror now has a first machine-grounded learned language rung. It is a real,
reloadable learned categorical surface-plan classifier. It consumes only six
typed features projected from an `axm.mirror.trace/v1` decision: bounded
decision state, explicit unknown presence, contradiction presence, hard
boundary violation, missing evidence, and repairability gap.

The model may propose one of seven audited section orders. It cannot write
factual slots. A deterministic organ fills the selected action, declared goal,
evidence count, unknown IDs, contradiction pairs, and authority boundary from
the machine trace. Existing human prose in `trace.human` is never read.

This is not an active runtime language organ, general language model, neutral
oracle, calibrated truth estimator, reasoning authority, or evidence that
Mirror understands wisdom. `STATUS.json` therefore retains
`languageOrgan: false` and `learnedWeights: false` for the active runtime.

## Corpus and learned evidence

- Corpus: 28 permissioned abstract typed situations.
- Training: 21 source groups.
- Held out: 7 disjoint source groups, one for each plan family.
- Private conversations, hidden reasoning, runtime state, Workshop state,
  logs, and external data: zero sources.
- Learner: Laplace-smoothed categorical maximum likelihood, deterministic,
  dependency-free, no random initialization and no gradient epochs.
- Model digest:
  `e0496874733e4477f8dff2989e4bebc92a7aae8de4742d5df47b2cf003f4bff2`.
- Held-out plan classification: 7/7 matched, 0 mismatch.
- Minimum held-out top score: `0.490701001431`.
- Minimum held-out margin: `0.327134000954`.

The scores are model-relative surface-plan posteriors. They are explicitly not
probabilities of truth, safety, permission, neutrality, or correctness. The
held-out set was authored for this development gate and is not independent
external validation.

## Hard organ supplied because the learned organ is small

The learned classifier is surrounded by a new hard-coded typed-trace language
organ. This is intentional anatomy, not a concealed substitute for learning.
The hard organ:

1. projects the typed trace without consulting fluent source prose;
2. derives the compatible plan family independently;
3. rejects a learned plan that contradicts the trace;
4. rejects a plan below confidence `0.45` or margin `0.25`;
5. renders only audited sections and trace-bound slots;
6. preserves zero authority for facts, decisions, permissions, tools, memory,
   training admission, runtime promotion, or world action.

The learned weights therefore affect expression order, while machine meaning
and authority remain outside learned weights.

## Falsification exercised

Focused tests passed 4/4 and include:

- deterministic retraining and byte-equivalent reloadable artifact;
- all seven source-group-held-out surface-plan families;
- supported, supported-with-unknown, contradiction hold, missing-evidence
  hold, repairability hold, explicit hold, and hard refusal traces;
- a fluent source-human decoy saying “Permission granted” that was ignored;
- poisoned learned weights selecting a refusal plan for a supported trace,
  which the independent verifier held;
- ambiguous learned weights, which the confidence gate held;
- modified learned counts with a stale digest, which were refused;
- train/held-out group leakage, which was refused;
- a corpus example without explicit training permission, which was refused.

The Model BOM tests also proved that the artifact is hash-locked and remains
outside the active runtime. Mirror Doctor reported structure PASS.

The full non-live Mirror regression surface passed 157/157 after the shared
immutable batch-store repair was integrated. The live Workshop integration
was first deferred because the steward reported ten new modules and additional
hand work being written concurrently. Once the shared source was declared
settled, the live relational integration passed 1/1, for 158/158 combined
checks. Its old
historical assertions for exactly six assessed hands, five declared providers,
and one declaration gap were replaced with conservation relations: every
assessment must resolve into exactly one typed classification, downstream
counts must equal their upstream sources, every proposed exam must retain four
untested hypotheses, every binding matrix must retain three positive
hypotheses, and every authority-sensitive decoy must be rejected. This permits
real discovery growth without weakening the test or treating yesterday's
Workshop population as canon.

## What works

- Machine state, not prose, supplies the rendered facts.
- Learned weights make a measurable plan selection and can be reloaded.
- Unknown IDs and contradiction pairs survive into the proposed rendering.
- A learned mismatch becomes HOLD rather than a fluent correction of reality.
- The training corpus expresses operational wisdom habits instead of slogans:
  preserve uncertainty, do not erase contradiction, demand evidence, retain
  repairability, and refuse hard boundary violations.
- No npm packages, network, Workshop write, runtime restart, or permission
  expansion is required.

## What does not work yet

- It cannot converse, understand arbitrary language, answer open questions, or
  generate original prose.
- It learns seven coarse surface plans from a very small abstract corpus.
- Its score is not calibrated under distribution shift.
- The fixed renderer is English-only.
- The development held-out set is small and authored in the same research
  effort; independent authorship and adversarial review remain missing.
- It has not yet been shadow-evaluated over a substantial append-only stream of
  real Reasoning Foundation traces.
- It has no tokenizer or generative decoder connection. Seed-0's separate BPE,
  trigram, and count-smoothed transition artifacts remain unfit for factual
  rendering.
- It is not loaded by the live runtime or Learning Shell.

## Append-only real-trace shadow evidence

The next gate was implemented without promoting the model. The evaluator
discovers verified permissioned `REAL_LOCAL_LESSON` receipts by source type,
not by receipt ID, and stores immutable results under ignored private state.

Batch `typed-trace-language-shadow-evaluation-d86eb9c6bbc8865494696432`
bound seven distinct real-local source groups. All 7/7 plans passed the hard
trace gate, all 7/7 hostile fluent-human-prose decoys left the plan and output
unchanged, and zero fallbacks or curriculum gaps appeared. Training admissions,
automatic retraining runs, model changes, runtime promotions, and world actions
were all zero. An identical second run verified the batch and reused it.

This strengthens the result from abstract development cases to local
operational traces, but it remains a very small and locally produced sample.
There are still zero independently authored external held-out traces.

## Next gate

Acquire independently authored, permissioned typed traces and frozen
distribution-shift cases without exposing private content. Evaluate them in
shadow mode before any corpus change. A real negative mismatch must remain
visible, produce a review-only curriculum gap, and demonstrate that the gap can
be repaired with new source-group-separated evidence without lowering existing
thresholds or regressing prior groups.

Only after independent held-out traces, distribution-shift tests, stable
fidelity evidence, and human review should a separately gated active-rendering
experiment be proposed.

## Artifact hashes

- `learning/typed-trace-language-model.js` —
  `18f02e5378f88710621a42aea047130f09f148c94ab5b4d9e08691187e2a0e6d`
- `organs/typed-trace-language-organ.js` —
  `a89a3e86b077ad277d42a0047f23e8177c232e784df1825918e74af193de0df3`
- `training/build-typed-trace-language-organ.js` —
  `f6dd1e541884f2a7b185d6615ee05bf19bc927050f9b4c8059742d5b7d924633`
- `training/typed-trace-language-wisdom.json` —
  `3ea005d816d663c9bac7f04555bc9c3c25ebf94174e07055631a4cc054adc547`
- `learned/language-trace-1/surface-plan-model.json` —
  `48d57e8fa48b883a67667eda73c4fae15c16adcf0c68ac175ff85cbf125829c8`
- `learned/language-trace-1/report.json` —
  `9f6ed10af900bf694cb090ab9b64ccb731622e93042755ca61b376b8892921f6`
- `organs/typed-trace-language-shadow-evaluation-organ.js` —
  `eb44e2afc1700040a7ecf1ee778c5987c9ce33cf7a5358e812b650b1a6687ec9`
- private real-trace batch file —
  `c6689d6ca5e7e8c5c6f114faf021453ce478de1e408b0b5a731287982021799c`

These hashes bind the implementation at the time of this report. Later edits
must supersede this report; they must not silently reuse its evidence.
