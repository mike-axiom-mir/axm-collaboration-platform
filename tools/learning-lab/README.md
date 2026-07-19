# AXM Learning Lab

Learning Lab is parent workspace **#10**: one guided-practice room for human, AI and machine learners. It combines interactive lessons, flashcards, assessments, deterministic labs, local classroom discussion, a notebook, guided coding and draft course authoring without combining learner identities or granting authority from scores.

## Working now

- attributed learner profiles with explicit per-learner opt-in;
- two built-in courses and a local draft course builder;
- ordered learning sessions with evidence required for every completed step;
- flashcard confidence receipts and deterministic assessments;
- an evidence-pressure simulation with replayable inputs and verdicts;
- a time-limited, network-blocked JavaScript exercise sandbox;
- local classroom messages and private/shared notebook entries;
- portable project export and restoration;
- the existing AI Learning Forge embedded as a child doorway with live service/track status.

## Parent and child boundary

`learning-lab-core.js` owns the portable learning project and guarded state transitions. `learning-lab-app.js` connects it to the interface, local storage, shared engines, downloads, the code sandbox and the local Forge status API.

Mirror's existing `mirror-learning-shell` remains independently executable. Learning Lab only frames the doorway and can create an explicit attributed session proposal. Mirror's identity, memory, weights, private lessons, challenge runs and promotion gates stay in Mirror's own body.

Project Room, Knowledge Canvas, Game Forge and AI Team remain independent workspaces. Learning Lab links to them and consumes their public contracts rather than copying their code.

## Honest missing adapters

Networked classrooms, external question banks, additional simulation domains, additional code runtimes and future attributed model adapters are visible extension slots. The current classroom is local, the current lab is deterministic and the current code runtime is sandboxed JavaScript only.

Run `node selftest.js` and `node discovery-seam-review.js` for focused verification.
