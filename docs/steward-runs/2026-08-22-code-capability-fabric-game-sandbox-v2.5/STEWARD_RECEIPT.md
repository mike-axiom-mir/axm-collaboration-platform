# Code Capability Fabric game-sandbox v2.5 steward receipt

Status: `TEST`

Run opened 2026-08-22 and sealed 2026-08-23 Europe/Amsterdam. This receipt is
append-only evidence for a review branch. It is not an installation,
integration, publication, promotion, or `CANON` receipt.

## Lineage

- Worktree: clean dedicated lane; machine-local path not retained.
- Branch: `codex/code-capability-fabric-game-sandbox-v2.5`.
- Selected target base at branch creation: `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`.
- Verified semantic Fabric v2.4 source: `76346de7328944684690df7490223862edba3ee9`.
- Branch-only prerequisite merge: `f43300a2e3663600dee9c4fee821e087c404d323`.
- Bounded v2.5 technical source commit: `458f79bb346116d707513bf24755b0b2db663f35`.
- Canonical target observed before seal: branch `codex/workshop-recovery-fabric-integration-20260822`, commit `3d6daa4ff6af7f0d48a345e5d30e038c40c8fa47`.
- Target drift since the selected base: four commits. Changed-path intersection with this steward run: none.
- Canonical checkout remained busy with five unrelated Sensorium/Foundation Planet paths and was not edited.

The exact 28 changed paths are listed in `CHANGED_PATHS.txt`.

## What changed

1. Added sealed `axm.game-generation-brief/v1`,
   `axm.game-candidate-generation-request/v1`, and
   `axm.game-candidate-packet/v1` contracts.
2. Added a provider-neutral native recipe that emits a deterministic 11-file
   Game Forge-compatible static game candidate. It calls no provider, executes
   no candidate code, writes nothing, uses no network, and grants no authority.
3. Anchored all eight reused Workshop component contracts to their exact local
   bytes so a self-consistent counterfeit contract cannot enter by ID alone.
4. Extended the existing Sandbox with a separate exact-packet service. It
   materializes four disjoint roots, validates without execution, creates new
   immutable repair iterations, resumes from append-only evidence, and emits
   inactive privacy-safe lesson candidates.
5. Added a trusted fixed-file loopback preview. Candidate JavaScript runs only
   in an iframe with `sandbox="allow-scripts"`; CSP denies connections, forms,
   objects, child frames, and workers. The service launches no candidate child
   process and passes no host environment or credentials.
6. Added adversarial generator and Sandbox suites covering forged/stale
   lineage, authority drift, Windows aliases, symlink/junction boundaries,
   network expansion, resource ceilings, evidence privacy, immutable repair,
   session resume, HTTP traversal, and installation/CANON holds.
7. Ran one exact detached game through real browser render, click, keyboard
   play, responsive, victory, and reload checks. The first frame exposed a host
   `Cross-Origin-Resource-Policy` seam that blocked iframe subresources; the
   host boundary was repaired and re-observed. Candidate bytes were unchanged.
8. Compared capability requirements before and after. Required first-game
   status moved from `BLOCKED` to `READY`; future durable persistence remains
   optional `DEGRADED`.

## Exact candidate evidence

- Request digest: `sha256:d3b129dff29b3c045633513057d88d0fd8155d28711f8cfee4fab1370ac9c86d`.
- Packet digest: `sha256:0f92db03251710f34c8b50ea13d30e2a910336d3d0d6ceb884824d68951416c7`.
- Module-bundle digest: `sha256:934c6600a6f5e919f0189e6efc0d60c0f35b0e46bbc1096f3c33c9054afe8358`.
- Candidate source: 11 files, 27,078 bytes.
- Live Sandbox iteration digest:
  `sha256:9ad3bfe37db7c90e6d98ff24636d1a1b39c04b58ab4714401b1b521de286a408`.
- Browser journey: visible-button move passed; ordered keyboard route passed;
  victory visible at move 20; reload reset to move 0; 600×800 controls visible
  and clickable.
- Five selected proof frames were observed and SHA-256 hashed. Raw images were
  not written to the repository or durable session evidence.

## Verification

All required `AGENTS.md` commands passed:

- `node verify.js` — `0 FAIL · 22 warn · spine b618c5762240070c`.
- `node hub/hub-selftest.js` — `0 FAIL`.
- `node hub/route-selftest.js` — `0 FAIL`.
- `node hub/graft-selftest.js` — `0 FAIL`.
- `node hub/skin-selftest.js` — `0 FAIL`.
- `node hub/verify-plus.js` — passed; Verification Spine v2 reported
  `VERIFIED_WITH_LIMITS` and the same 22 verifier warnings.
- `node tests/html-script-syntax-test.js` — `55 PASS · 0 FAIL`.
- `node tests/tool-forge-package-test.js` — passed; transient proof cleaned;
  installed false.
- `node tools/agent-tool-forge/selftest.js` — `17 PASS · 0 FAIL`.
- `node tools/evidence-desk/selftest.js` — `36 PASS · 0 FAIL`.

Focused continuity also passed:

- Every `shared/code-capability-fabric/selftest*.js` suite passed, including
  v2.4 semantic generation (104 checks), v2 routing (74), v1 routing (18), and
  the new deterministic game generator (12 cases).
- Existing Sandbox Session-1 suite: `27 PASS · 0 FAIL`.
- Disposable candidate Sandbox suite: `11 cases` passed.
- Capability comparator after the work: `READY` for all required rows, no
  missing capability, no proposed hand.
- Real in-app-browser evidence is recorded in `visual-play-evidence.json` and
  routed in `CLAIM_EVIDENCE_MATRIX.md`.

The original intake note named 41 verifier warnings. The selected and advanced
Workshop target now reports 22. This run did not hide or repair those 22
warnings; they remain visible baseline work.

## Unrun, unsupported, or still uncertain

- Durable save/recovery is not implemented. Reload reset was proven because
  the first candidate explicitly declares `SESSION_ONLY`.
- Browser renderer CPU, memory, and wall-time budgets were not independently
  measured or enforced. File, byte, attempt, cost, child-process, and iteration
  ceilings are enforced. This is an exact static-game preview, not a general
  untrusted-code executor.
- Exit-before-roots was not independently countertested; the fixed path crosses
  the ordered checkpoints naturally.
- No gamepad, physical touch device, audio, multiplayer, AI challenger, model
  training, hardware actuation, installation adapter, publication adapter, or
  public reuse-rights determination was tested.
- The app retained the review tab, but browser visibility control reported the
  tab remained backgrounded. The trusted preview command and exact packet are
  available for Mike's review.
- Authenticated human identity, nonce/replay ledger, expiry, and revocation are
  still future tier-control work. The current authorization is an exact recorded
  Mike direction with authority `NONE` beyond this bounded steward run.

## Decisions preserved

- Growth inside the exact detached Sandbox is authorized for build, preview,
  immutable repair, comparison, and inactive lesson candidates.
- Growth does not grant installation. Install, integrate, publish, promote,
  active-library admission, and `CANON` remain separate decisions.
- Generated source remains `RESEARCH_ONLY_HOLD`; direct reuse is false until
  Mike resolves rights.
- Four-root `HOLD` or `FAIL` remains non-overridable by a click. Mike may always
  hold or reject after a technical pass and remains the final merge gate.

## Safe integration route

Do not use the busy canonical checkout. First re-check its branch, HEAD, and
dirty paths. In a new clean review worktree based on the then-current target,
confirm that the feature branch tip equals the final handoff hash, then stage a
reviewable merge without committing it:

```powershell
git merge --no-ff --no-commit codex/code-capability-fabric-game-sandbox-v2.5
```

Then rerun every command in the Verification section plus both Sandbox suites
and the deterministic game generator suite. Re-run the browser render/click
journey if any preview, Sandbox, CSP, game, or hosting path changed during
target drift. Mike may then commit the merge or run `git merge --abort`. This
receipt does not authorize either action and the busy canonical checkout must
not be used as the review worktree.
