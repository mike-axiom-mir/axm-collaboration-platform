# Academy Source Contract

This contract is the additive doorway from a Workshop organ into the Academy. It lets a future builder register a local data source without editing the Academy interface or lesson compiler.

## Source of truth

Registrations live in `academy-source-catalog.json` and conform to `academy-source-catalog.schema.json`. The browser and the self-test pass the same catalog through `AXMAcademyCatalog.validateCatalog()` before any source is fetched or translated.

```json
{
  "id": "example-organ-data",
  "category": "organ-building",
  "adapter": "molds",
  "organ": "Example Organ",
  "title": "How the example organ is assembled",
  "level": "FOUNDATION",
  "path": "../example-organ/evidence/catalog.json",
  "summary": "A clear description of what a learner can understand from this local data source.",
  "boundary": "A clear statement of what this source does not prove, predict, authorize or generalize.",
  "tool": "../example-organ/index.html"
}
```

## Admission gates

A registration is held unless all of these are true:

1. the catalog schema and version are exact;
2. every source ID is unique and machine-safe;
3. the category and adapter are explicitly supported;
4. the data file and producing route are local relative paths;
5. the summary and non-claim boundary are present and bounded;
6. the adapter finds real, internally consistent source data;
7. extraction yields 4–12 labeled facts with an explanation of their meaning.

An admitted source receives a four-check receipt: catalog contract, local route, bounded extraction and explicit non-claim boundary. Only an admitted snapshot can compile into a human lesson.

## Register an organ

1. Choose an existing adapter whose data shape genuinely matches the organ.
2. Add one entry to `academy-source-catalog.json`.
3. Run `node tools/learning-lab/selftest.js`.
4. Open `/tools/learning-lab/`, choose **Academy**, and confirm the source reads `ADMITTED 4/4`.
5. Inspect the extracted facts and boundary as a human. Passing shape checks does not replace domain review.

## Add a new adapter

When no existing adapter fits, add a small deterministic inspector in `academy-catalog.js`, add its ID to the schema and allowlist, and provide positive plus refusal tests using a real local fixture. An adapter may extract facts; it may not execute source code, fetch a network URL, infer hidden meaning, publish a lesson, enroll a learner, or grant authority.

Use the built-in `module-contract` adapter when an organ already declares an `axm.module-contract/v1`. It requires a named ID and version, at least one capability, explicit incoming and outgoing handoff arrays, and at least one refusal. It extracts capability, dependency, handoff, refusal and extension-slot counts plus a deterministic 16-character change receipt over their complete declared values. The receipt detects a renamed promise even when the counts stay the same; it is not a cryptographic signature or runtime verification.

## Learning path contract

Optional teaching sequences live separately in `academy-learning-path-catalog.json` and conform to `academy-learning-path-catalog.schema.json`. The browser and self-test pass them through `AXMAcademyCatalog.validateLearningPaths()` with the already-admitted source catalog. A path is held unless every stage names a unique admitted source and includes a bounded human reason for its position.

Paths may suggest an audience, outcomes and order. They may not carry authority or canon fields, add a course, create or opt in a learner, begin a session, certify mastery or force the next stage. `learningPathProgress()` is a non-mutating view over current source snapshots, courses and one explicitly selected learner's sessions. Only an attributed `COMPLETE` session for the exact current fingerprint advances current completion. `SHELVED` means the current lesson is available locally, not that anyone studied it.

When source semantics or the compiler recipe changes, earlier evidence is preserved without being relabeled. `REVIEW UPDATED` means a prior edition was completed and the current edition awaits inspection. `OLD IN PROGRESS` means an attributed earlier session is still open. `UPDATE AVAILABLE` means only a different edition is shelved. Historical completion has its own count and never silently inflates current progress. The interface action selects the current source for inspection; the existing named learner handoff remains the sole start boundary.

When adding a path, preserve this distinction in tests: validate an unknown source refusal, validate duplicated-stage refusal, prove progress leaves its inputs unchanged, prove a learner's next stage changes only after an explicit completed session review, and prove a changed fingerprint keeps the earlier completion visible without counting it as current.

## Inheritance rule

The lesson must remain challengeable by someone after us. Preserve the source path, producing organ, extracted facts, boundary and admission receipt in course provenance. If the source disappears or no longer matches its adapter, the Academy holds it visibly instead of teaching from stale assumptions.

The portable inheritance seam is `axm.academy.inheritance-packet/v1`. Export always normalizes the lesson to its immutable fingerprinted edition ID. A packet is capped at 256 KiB, is deliberately lesson-only and declares that learner profiles, sessions, attempts, notebook entries and classroom messages are absent. It must not contain private evidence or any project-level learner state.

Import is fail-closed. The Academy requires the exact packet, privacy, course, provenance, fingerprint, fact, admission and step fields; reconstructs a source snapshot; recomputes the lesson fingerprint; and recompiles all five steps. An unexpected field, teaching field that no longer matches its fingerprint/compiler receipt, authority other than `NONE`, mismatched edition identity or enabled privacy field refuses the packet.

The packet envelope remains `v1`, but current admission requires the v2 fingerprint algorithm and named recipe. An older packet is preserved as external evidence and refused rather than silently upgraded. Re-open its named local source in the current Academy, inspect the newly compiled edition, and export a fresh packet through the human gate.

A valid packet does not mutate the project. It opens a human admission review showing the producing organ, source path, edition fingerprint, teaching scope, non-claim boundary, privacy exclusions and non-authenticity warning. **Add lesson to shelf** is the separate admission action; cancel, close or Escape discards the pending packet and leaves the project unchanged. Admission never creates a learner, enrolls, begins a session or merges identity, and an already-installed matching fingerprint is opened instead of duplicated. The structural checks prove internal consistency, not the identity of the packet author or the authenticity of the named source.

## When teaching data changes

Every admitted snapshot receives a deterministic `dual-fnv1a32/v2` fingerprint over the complete semantic compiler payload: source identity and route, category, organ, title, level, summary, non-claim boundary, extracted facts, the named `source-observe-organ-boundary-model-inheritance/v1` recipe and the exact five generated steps. `fingerprintSemantics()` exposes that payload for inspection. This binds compiler output to the edition automatically; changing a generated body, prompt, duration, type or order changes the edition receipt. The fingerprint is explicitly not a cryptographic signature of the source file or author.

- An installed lesson with the same fingerprint is `CURRENT EDITION`.
- A different fingerprint is `SOURCE CHANGED`.
- An older algorithm or compiler recipe is `COMPILER UPDATED`.
- A pre-fingerprint lesson is `UNVERIFIED EDITION`.
- Accepting changed teaching data creates a separate fingerprinted course edition.

Never update an existing course in place merely to match new data. Sessions and evidence must continue pointing to the edition the learner actually encountered. Human review remains required before adding or beginning the revised edition.
