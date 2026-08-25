# Code Capability Fabric v2.23 steward run

Status: `TEST`

## Outcome

The deterministic local co-op candidate gained an exact game-first experience
flow and Mike then directed its promotion into Workshop as an internal `TEST`.
Game Hub slot `023-twin-sparks` contains the exact fourteen candidate files plus
a separate trusted local host frame. The frame states the current installation
truth while leaving the candidate's original detached-generation record
unchanged.

This is not `CANON`, a public release, a Foundation change, or permission for
the generated candidate to install or promote itself.

## Commit lineage

- Selected v2.22 base: `e5e0163e513e02f147c791fecd98decd3caec87c`
- Deterministic experience-flow source: `146155f6307a27f13c3073098616f6771cbba26c`
- Internal `TEST` promotion: `7ed85cf56f2852cae64c45da0410da9f62a4dc8c`
- Review branch: `codex/code-capability-fabric-game-experience-director-v2.23`

## Changed

- Added the closed `axm.game-experience-flow-plan/v1` contract and pure
  experience director with lobby, mission, transition, boss, pause, victory,
  and defeat scenes.
- Rebuilt Twin Sparks v0.4 as a byte-identical, fourteen-file deterministic
  candidate with staged review truth instead of a permanently dominant test
  panel.
- Added provider-neutral internal-test promotion and installation-receipt
  schemas.
- Installed the exact candidate at Game Hub slot 023 behind a local-only trusted
  frame and byte-bound the candidate and host shell separately.
- Closed candidate ID/version pairs so legacy and v0.4 identities cannot be
  combined ambiguously.
- Refreshed the deterministic city, schema-registry, twin, and tools-index views
  required by the new schemas and installed package.
- Clarified that resource envelopes preserve quality: version ceilings are
  implementation limits, not permanent creative ceilings. Insufficient
  resources must remain an explicit expansion hold, never a silent downgrade.

## Exact promoted identity

- Request: `sha256:a90bc132033619c47f9f78a0fc8bd3876b775fab67ddd9cb940d30981f885f29`
- Candidate packet: `sha256:6680703ed8ed2bbe652c60a07be9504981292972896f9466ea56a9b67538c246`
- Module bundle: `sha256:cab406d01d3b3ca8b273ff51ccef605c27e6cb20d180a6a8c31d913c47bf3358`
- Live iteration: `sha256:34c4b50a855f4c75de4dcf6a91aa88587206a55cc5c531f4a13fa9627b0c1640`
- Mike direction record: `sha256:333da5163f1eeb748cf4a4a8cf294902ce6f415088e42a63f70f3a4225a2c347`
- Installation receipt: `sha256:5ecdb1385df50ada097e9297358271be957d3699c91cefbbd63185513f56a5ad`

## Verification

All required `AGENTS.md` commands exited successfully. `node verify.js` ended
with `0 FAIL · 26 warn`; warnings remain visible. The focused suites passed:

- Experience director: 5 cases.
- Deterministic generator: 12 cases.
- Local co-op recipe: 26 cases.
- Disposable candidate sandbox: 13 cases.
- Game package verifier: 21 assertions.
- Game-night discovery, Game Hub, and promoted-package selftests: pass.

An actual installed browser render and click/keyboard journey passed at the
trusted local Game Hub route: lobby, Enter/start, Escape pause/resume, review
drawer, Warden route, and reset. A transient screenshot was inspected to confirm
the installed frame and rendered lobby; it is not retained in durable evidence.

## Still open

- Two humans have not yet completed a physical shared-keyboard play session.
- Gamepad support is absent and remains one visible verifier warning.
- Long-run frame cadence, balance, accessibility taste, and content depth still
  require real play evidence.
- Adaptive resource negotiation is a next contract gap. This run records the
  policy correction but does not pretend a new expansion planner exists.
- Generated source remains on direct-public-reuse hold.
- Public release, promotion beyond `TEST`, merge, and `CANON` were not performed.

Mike remains the final merge gate.
