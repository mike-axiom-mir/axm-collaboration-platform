============================================================
AXM REASONING SHELL v0.1 — BRANCH DOCUMENTATION
BRANCH ONLY · NOT CANON · NOT FOUNDATION · INHERITS FROM THE
BACKBONE, DOES NOT OWN IT · SUGGESTION, NOT TRUTH
============================================================
FILE MAP: index.html (module+UI, schemas inline, format:1) ·
profiles.json (1 real: small-local-model v0.1 · 6 placeholders,
schema-complete, labeled) · manifest.json · this file.

FLOW (built): task -> profile frames ONE small step -> AXM.ask
(same bridge; noAI = honest manual mode) -> CHECKPOINT judged by
human -> accepted (step recorded) or rejected (ROUTE captured,
rejection_reason REQUIRED — empty fails validation, proven) ->
repair context feeds next step -> AFTER-ACTION report (fake-done
+ context-loss flags, repairs list) -> TWEAK PROPOSAL, status
always 'proposal' — a human edits profiles.json or nothing
happens. Session saved via AXM.store (format:1) + exportable.

SAFETY RULES (enforced in code): no auto-write · no auto-tweak ·
no profile mutation · every session/step/checkpoint/proposal
passes AXMGate.submit like any tool · no network beyond AXM.ask.

[INTEGRATION] STUBS (documented, NOT built): registry connector
('shell.profile.source') would register here when a second
consumer exists; measurement harness comparing shell-on vs
shell-off runs — schemas are ready, harness is TODO.

TEST PLAN (for Mike/Opus): same task ± shell on a small local
model (Nova) — count fake-done, repairs, completion; on strong
models with overconfident profile — count unlabeled claims.
STOP CRITERIA: stop and flag if any change needs autonomy,
compute allocation, sandboxing, own internet access, gate/
registry logic changes, shared shell-only directories, or
template-type definitions for other modules. None crossed here.

FAILURE MODES (known): shell theater (steps ritualized, not
honest — watch unlabeled-claim rate) · checkpoint fatigue (human
rubber-stamps — keep sessions short) · profile overfit (tweaks
encode one session's noise — hence proposal-only + evidence).

MERGEGATE CHECKLIST: [x] shell-only functionality [x] no gate/
registry modification [x] no shared shell directories [x] empty
rejection_reason fails (proven) [x] STOP criteria present
[ ] measurement evidence (REQUIRED before any canon talk)
[ ] Opus cleanup: real registry integration, SOURCE_LINEAGE
headers, cluster INDEX, harness build, overbuild trim.
UNTESTED: everything on real models. No fake done.
============================================================
