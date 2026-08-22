# AXM Academy · Learning Lab

The Academy is the teaching front door of parent workspace **#10**. It turns curated local Workshop data into categorized human lessons while Learning Lab remains the guided-practice room for human, AI and machine learners. The two layers share one route: Academy makes knowledge teachable; Learning Lab preserves attributed attempts, evidence and review.

## Academy foundation

`academy-source-catalog.json` starts with six real local sources across four fields:

- **Visual language:** Style Fabric preskins and Aetherglass guardrails;
- **Organ building:** Style Fabric semantic mold kits and the Learning Lab's own module contract;
- **Living systems:** Foundation Planet's explicit truth and non-claim map;
- **Evidence stewardship:** Design Lineage Lab's compact review contract.

The catalog is validated before its sources are fetched. Each admitted adapter reads a named local JSON source, extracts 4–12 bounded facts and compiles a five-step human course: read the source, meet the producing organ, find the claim boundary, build a small teaching model, and leave a repeatable path for the next learner. The generic `module-contract` adapter turns an honest `axm.module-contract/v1` into a lesson about capabilities, dependencies, handoffs, extension slots and explicit refusals; its first source makes the Academy explain its own architecture. The resulting draft keeps its source path, organ, extracted facts, boundary and admission receipt in `provenance`. Nothing is published, promoted or enrolled automatically. See [`ACADEMY_SOURCE_CONTRACT.md`](ACADEMY_SOURCE_CONTRACT.md) to register the next organ without changing the interface.

`academy-learning-path-catalog.json` adds the optional foundation trail **From evidence to teachable living systems**. It explains why a future human might study Design Lineage first, then visual variation, reusable molds, Aetherglass guardrails, the Academy's own teaching contract and finally a bounded living-system model. The path is validated against admitted source IDs before display. Progress joins an attributed session to the exact current lesson fingerprint. Completion of an older source or compiler edition remains visible as preserved history and becomes `REVIEW UPDATED`, rather than silently counting as completion of material the learner never encountered. Its next action only opens the suggested current lesson for inspection. It does not add a course, create a learner, enroll anyone, certify mastery or make curriculum canon.

Every admitted lesson also has a learner handoff. A person can choose an existing attributed learner or name a new local human learner, explicitly opt in through the begin action, and add plus start the lesson in one step. If that learner already has practice open, the Academy resumes it instead of silently creating a competing session. Course, learner, exact step and evidence live in the portable Learning Lab project, so a reload returns to the same practice state.

At the final review gate, the learner sees the latest evidence response beside every original step prompt before completion is available. Any one step can be explicitly reopened for a focused repair. The earlier attempt remains in session history, the repair adds a second attributed attempt, and the learner returns directly to the evidence review instead of repeating unrelated steps. Completion remains a session receipt with no authority.

Compiled teaching semantics carry a deterministic `dual-fnv1a32/v2` lesson fingerprint. Its inspectable receipt covers the source-bearing fields, the named compiler recipe and all five generated teaching steps. It is a change detector, not a cryptographic source signature. When extracted facts, boundaries or other source-bearing fields change, the Academy marks the installed lineage `SOURCE CHANGED`. When an older compiler receipt is encountered, it shows `COMPILER UPDATED`; the earlier course and its attempts stay intact while the current recipe becomes a separate reviewed edition. Lessons without a usable fingerprint remain `UNVERIFIED EDITION`.

Each admitted lesson can also leave as an `axm.academy.inheritance-packet/v1` file. The bounded packet contains one immutable fingerprinted course edition and its inspectable source provenance—never learner profiles, sessions, attempts, notebook entries, classroom messages or private evidence. Import reconstructs the source snapshot, recomputes its fingerprint, recompiles the lesson and refuses unknown fields or teaching fields that no longer match those receipts. A valid packet first opens a non-mutating human review with its organ, source path, edition, boundary and privacy exclusions. Only the separate **Add lesson to shelf** action admits it; cancel or Escape leaves the project unchanged. Admission does not enroll or start anyone, and an edition with the same fingerprint is opened rather than duplicated. The fingerprint is still a non-cryptographic change detector, not proof of source authorship or authenticity.

## Working now

- attributed learner profiles with explicit per-learner opt-in;
- a categorized Academy shelf backed by live local organ data;
- a versioned data-driven source registry with exact local-path and non-claim gates;
- a generic module-contract inspector that can turn future organs' declared contracts into bounded lessons;
- a validated optional foundation trail with revision-aware, non-enrolling next-lesson guidance;
- deterministic source-to-lesson compilation with provenance and visible non-claims;
- visible curriculum freshness with source-and-compiler fingerprints and immutable revised editions;
- strict lesson-only inheritance packets with privacy exclusions, deterministic verification and a preview-first human admission gate;
- explicit add-and-begin, progress labels and exact-step resume after reload;
- two built-in courses and a local draft course builder;
- ordered learning sessions with evidence required for every completed step;
- a learner-visible evidence recap with non-destructive, single-step repair and explicit completion review;
- flashcard confidence receipts and deterministic assessments;
- an evidence-pressure simulation with replayable inputs and verdicts;
- a time-limited, network-blocked JavaScript exercise sandbox;
- local classroom messages and private/shared notebook entries;
- portable project export and restoration;
- the existing AI Learning Forge embedded as a child doorway with live service/track status.

## Parent and child boundary

`academy-source-catalog.json` owns source registrations. `academy-learning-path-catalog.json` owns optional teaching sequence and reasons, but no authority. `academy-catalog.js` validates both catalogs and owns deterministic lesson blueprints and non-mutating path progress. `learning-lab-core.js` owns the portable learning project and guarded state transitions. `learning-lab-app.js` connects those layers to the interface, local storage, shared engines, downloads, the code sandbox and the local Forge status API.

Mirror's existing `mirror-learning-shell` remains independently executable. Learning Lab only frames the doorway and can create an explicit attributed session proposal. Mirror's identity, memory, weights, private lessons, challenge runs and promotion gates stay in Mirror's own body.

Project Room, Knowledge Canvas, Game Forge and AI Team remain independent workspaces. Learning Lab links to them and consumes their public contracts rather than copying their code.

## Honest missing adapters

Networked classrooms, external question banks, additional simulation domains, additional code runtimes and future attributed model adapters are visible extension slots. The current classroom is local, the current lab is deterministic and the current code runtime is sandboxed JavaScript only.

Run `node selftest.js` and `node discovery-seam-review.js` for focused verification.
