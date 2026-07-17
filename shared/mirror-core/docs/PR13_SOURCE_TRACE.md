# PR 13 source trace

Trace status: VERIFIED READ-ONLY at `33a87549259d8b4a7ce4753ee1fab49e0ee8091d` on 2026-07-14.

Repository: `mike-axiom-mir/axm-collaboration-platform`  
Pull request: `#13 — Stage consolidated AXM workspaces for next milestone`  
Head branch: `agent/axm-consolidated-workspaces-next`  
Head SHA: `33a87549259d8b4a7ce4753ee1fab49e0ee8091d`  
Base SHA: `cda6b0629968cd7f276283ad7362cfdafb64926e`  
Observed state: draft, open, 203 changed files. No repository, branch, commit, push, or pull-request write was performed.

This is a source trace, not a claim that Mirror Core is installed in Foundation. Blob identifiers below freeze the exact files cross-analysed through the connected GitHub source.

## Foundation seams

| PR 13 source path | Blob | Verified direction | Local use |
|---|---:|---|---|
| `shared/engines/README.md` | `b537f1894e1ebab6c87c7d684a4c1010bebadbf3` | Shared engines are reusable contracts, not tool-owned forks. | Mirror entities and adapters remain system-neutral. |
| `shared/engines/axm-shared-engines.js` | `e01925080e8419cb8a6cbc62e5645dd75730aa75` | Shared project, asset, evidence, collaboration, and AI-action mechanics are implemented as a background library. | Mirror reuses the separation of shared mechanics from native documents. |
| `shared/engines/engine-contract.json` | `db883a1c65d488d10be9ca9686efa247d4d115aa` | `AIAction` owns an identical human/machine action shape, proposal, decision, and receipt; it explicitly does not own special machine permissions or automatic execution. | Actor-neutral attribution; AI proposals still need consent, review, and apply authority. |
| `shared/services/axm-foundation-services.js` | `b2f633aae23aeff8615015236cff9e60032f007b` | The nine Foundation services stay represented across lifecycle states and explicit controls. | `foundation-adapter/pr13-compatibility.js` supplies a future discovery descriptor without pretending to be a tenth installed service. |
| `shared/services/service-contract.json` | `80bc1dc895356def5f89c070d6b886dc0c567218` | The permanent service plane keeps explicit control and honest `AVAILABLE`/offline/degraded states. | The local descriptor reports `standalone_foundation_compatibility_harness`, never `foundation_installed`. |
| `shared/profile/README.md` | `6b1c6ff157b538d2f4c645b6b398b539623b9ce6` | Shared identity/profile is a cross-tool seam. | Mirror actors reference stable actor IDs; Mirror Core does not replace Profile. |
| `shared/profile/axm-profile-core.js` | `c9edf2fb94bdf14fe872b38e11441f11fe8bd5fc` | Actor/profile records remain separate from tool state. | Actor attribution is copied into receipts for audit; authority is evaluated locally. |
| `shared/profile/axm-profile-client.js` | `17075b3798af0028ea7d0d5ab3ef9d11472de753` | Client access is mediated through the shared profile interface. | A future wrapper resolves Foundation actors before invoking Mirror Gate. |
| `launcher/axm-foundation.js` | `7f4ac73ac8712c651888279f681c4d17873996fb` | Foundation owns shared bootstrap. | Candidate discovery is `/foundation/discovery`; this package does not alter launcher code. |
| `launcher/axm-registry.js` | `8b28d29eb94e50282200f865b2492fedb580c713` | Registry writes are gated, cross-tool, proposal-first for AI, structured, and avoid payload logging. | Mirror adds its own default-deny gate; future registration is reference-only until approved. |
| `launcher/axm-settings.js` | `ee5a3d2d8630064006042864a99df1d0914e2472` | Shared settings are visible and local-first. | Connection mode and consent remain explicit, inspectable local state. |
| `verify.js` | `2b75e08f4e168e4fcdad8d9d1b2d1e044b53dcd9` | Verification and restore checks are release boundaries. | Local verifier, hash-chain check, package verifier, and restored-copy test are required. |
| `PACKAGE_MANIFEST.json` | `582710206e9dee324dd60217b09a179420ff2dea` | Public-safe package inventory, hashes, secret scan, and excluded sensitive files are explicit. | `BUILD_MANIFEST.json` records hashes and boundary flags while excluding mutable runtime state. |
| `README.md` | `92ca656e42a56a211a9617a70a086f8904e76a9e` | Consolidated tools share a Foundation without collapsing tool ownership. | Mirror coordinates representations while keeping systems separate. |

## Workspace consumers and evidence seams

| PR 13 source path | Blob | Verified seam | Mirror boundary |
|---|---:|---|---|
| `tools/project-room/module.contract.json` | `4d51b972de0f052a878ee1ef52b1e6fa2dc0b22a` | Project Room exposes project concepts through a module contract. | Only approved mapping references may be exposed; Mirror never silently creates a real project. |
| `tools/project-room/project-room-core.js` | `788cfb7f3e2d1d022aaf30fe70e2b1b2bc006cea` | Project state remains Project Room-owned. | A future adapter applies an approved packet and returns a receipt. |
| `tools/studio/module.contract.json` | `857390008fcf335eb99bf8bb68ccebc669461c9d` | Studio has a versioned tool contract. | Studio may query approved entities/evidence; no direct registry mutation. |
| `tools/studio/studio-core.js` | `e920fb9cd570a82ab13db65b8b6d3b25d1142aba` | Studio logic stays tool-owned. | Mirror does not become a creative runtime. |
| `tools/game-forge/module.contract.json` | `d21e07cdff4c55ad03074d65e47d7f417b5fa292` | Game Forge consumes shared concepts through a contract. | Future game/build metadata can be mirrored; engine execution is excluded. |
| `tools/game-forge/game-forge-core.js` | `ecb28ce9cf549bdad4d1fd4b6d4a1a637fb97f11` | Game authoring remains Game Forge-owned. | Mirror proposals may reference assets/projects, never execute builds. |
| `tools/game-forge/package-service.js` | `e9c24e0c942323bd7dea8c5855143619328c788d` | Packaging is bounded and verifiable. | Mirror package verification follows the same public-safe direction. |
| `tools/knowledge-canvas/module.contract.json` | `2a6fa0df2583c10526f9dfc78a4c8a17927ce313` | Knowledge Canvas consumes structured knowledge records. | It may receive entity/evidence references after approval. |
| `tools/knowledge-canvas/knowledge-canvas-core.js` | `a16188c31bdfbdd2a8d8c314c2f77e266414cfe0` | Knowledge state is not Foundation registry state. | Mirror exports references; Knowledge Canvas remains authoritative for native records. |
| `tools/publish-library/module.contract.json` | `932d6208d31b11dd4fd3253792a33229b8db88a4` | Publish & Library is a separate module boundary. | Mirror Core never publishes. |
| `tools/publish-library/publish-library-core.js` | `8697e2669e0a9ecbf5b327dff98fc2c8a3992fa6` | Publication requires its own workflow. | Public exposure is a future, independently approved adapter action. |
| `tools/ai-team/module.contract.json` | `fb2887c06143de7d2af2a736a0d3fcea23676c50` | AI Team represents machine collaboration through a module boundary. | AI Team may supply an attributed actor; it receives no hidden Mirror permissions. |
| `tools/ai-team/ai-team-core.js` | `950e5642defb04ea9f540697a1d317bf2ab3f596` | AI participation stays explicit. | AI actor parity is preserved, while approval authority stays separate. |
| `tools/chatgpt-connector/module.contract.json` | `89798276dc00ce5a4dc88b73aa4705d6e0bf9af1` | External assistant connectivity is connector-owned. | Mirror contains no ChatGPT/network runtime connector. |
| `tools/evidence-desk/manifest.json` | `042588966b8085c92e819623b9bdf351da751b3e` | Evidence Desk is the evidence consumer/organiser seam. | `evidenceDeskReference()` transfers a bounded reference, hash, claim scope, and limitations—not an unlogged payload. |
| `tools/asset-vault/manifest.json` | `964e36c6f5549a86719543bbba05a0fe3b4b449d` | Asset Vault owns asset records. | Mirror entities may reference assets but do not duplicate vault authority. |

## Game Hub and incoming shared-controls seam

| PR 13 source path | Blob | What is present at the frozen SHA | Decision for the next contract |
|---|---:|---|---|
| `tools/game-hub/manifest.json` | `a129f6624af746e6db928fa4822aa03d2d8643b0` | Game Hub v0.4 is a local lobby/controller/runtime and playtest view. | Preserve the eight-seat ceiling but do not freeze current lobby assumptions. |
| `tools/game-hub/module.contract.json` | `b91012918ae027a2b2365c515dcd5cb7c00be05c` | The module contract is v0.2 while the manifest is v0.4. | Treat it as migration input, not the final shared-controls authority. |
| `tools/game-hub/seats/SEAT_TABLE_TEMPLATE.json` | `233ad8f96ca323278d18609f4ae54a440b5a6612` | Eight explicit empty seats exist: four visible plus four optional; seat types include human, adapter, and AI. | Require visible `seat-binding/v1`; AI is optional and never silently substituted. |
| `tools/game-hub/sessions/SESSION_TEMPLATE.json` | `0d2eb6b91a405c869c5047520351f82b72e7918c` | Sessions expose seat-map visibility, visible adapter seats, and local-first authority. | Allow 1–8 occupied seats and arbitrary, uneven team layouts. |
| `tools/game-hub/index.html` | `ddf0ad6140c29b8847460a5588b7c49579189c14` | The current visible lobby still loads a temporary four-person party (`Mike`, `Errol`, `Nova`, `Codex`). | Remove default occupants; an empty seat must stay empty. |
| `tools/game-hub/game-engine/ENGINE_STATE_TEMPLATE.json` | `6cb966fa0f74f1b79944f7d4a1a003e072f53ca1` | The engine declares local authority, client input intentions, and no hidden AI. | Observations must be seat-scoped and never expose omniscient state. |
| `tools/game-hub/game-engine/engine-core.js` | `34838a6706ac4788ea096d9614537a13072fb305` | Core creates eight seats and routes queued input into the authoritative tick loop. | Human and connected AI use the same allowlisted, seat-bound intention contract. |
| `tools/game-hub/game-hub-server.js` | `f0a279f34137028e08792e1f9206ee2a5066c8dc` | The server owns the live session loop and game-process lifecycle. | Mirror must not enter the tick/input loop. |
| `tools/game-hub/asset-handoff.js` | `66002581e6009e0e2a268baebec3e3ceb3de2998` | Asset handoff is explicit and bounded. | Asset references cross Mirror only through approved mappings/evidence. |
| `tools/game-hub/game-library/003-robo-pong-cross/game.manifest.json` | `125bc4b16dad962d8a37d9bc68648989be942d19` | Four-player game declares seat types and controls in its manifest. | Compile a versioned actor-neutral control surface per game. |
| `tools/game-hub/game-library/004-relaybound/game.manifest.json` | `cc1df1fe33a5f868ae8572234d8540ee1783c18e` | Two-player human/AI game confirms manifest-owned seat and control metadata. | Intended pairings remain game rules, never automatic universal AI fill. |
| `hub/foundation-services.js` | `518980f698d43446d9d0d7cb1f6ad76c35ee91f2` | Hub probes and renders Foundation service state with explicit controls. | Future shared-controls discovery belongs here or in shared services after the incoming update lands. |
| `hub/ai-vision-loop.js` | `18ce1bc900a6bf32664ec9f2af5f077fd0654313` | Screen sharing is explicit, finite-budget, observation-only, and stoppable. | A future AI seat observation must be separately scoped to that seat; Mirror does not capture screens. |
| `hub/ai-presence.js` | `0ceaf37a13e34991253bee59207e9fd22174e5d7` | Presence is a separate, pausable concern. | Seat occupancy/binding may reference presence; Mirror does not infer occupants. |
| `server.js` | `dbc416f417233d1a116066f75de6b7e76a3d92e6` | Repository server assembles current tools and APIs. | Local Mirror server stays separate until explicit integration and regression tests. |

## Cross-analysis conclusion

PR 13 provides the right foundation: shared contracts, actor-neutral action envelopes, proposal/decision/receipt patterns, local-first services, evidence boundaries, and verification. It does **not** provide permission to claim that this package is installed, nor does its current lobby implement the incoming shared-controls vision.

The compatibility rule is therefore:

1. Reuse Foundation identity, service discovery, evidence references, and structured envelopes through an adapter.
2. Keep Mirror Gate authoritative and default-deny. PR 13's current Foundation Gate is advisory when no rule matches, which is insufficient for cross-system writes by itself.
3. Keep live game actions out of durable Mirror packets.
4. Bind every human or AI controller to a visible seat and the same versioned control surface.
5. Give an AI only a representation demonstrably derived from that seat's player-visible view.
6. Wait for the incoming shared-controls code, re-pin its exact SHA, and run contract tests before adapting Foundation.

## Source-integrity statement

The Foundation code was inspected, not copied wholesale and not executed as an installed dependency. All compatibility claims in this package are either supported by the frozen paths and full blob SHAs above or labelled future/standalone. The authoritative repository revision is the full PR head SHA.
