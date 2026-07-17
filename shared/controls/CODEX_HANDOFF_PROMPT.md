# Codex handoff prompt

Copy the text below to the Codex working inside the target local game/platform and attach this whole port-kit ZIP.

---

Implement the attached **AXM Shared Controls + AI-Native Port Kit v0.1.0** in this local game/platform.

Requirements:

1. Inspect the existing game, its launcher/Game Hub contract, controller routes, player/seat model, input vocabulary, rendering camera, and host authority before editing.
2. Preserve the current Foundation. Do not invent a second lobby, identity layer, or seat system.
3. Reuse the physical control core from `src/browser/axm-virtual-stick.mjs` and `src/browser/axm-controller-runtime.mjs`. Do not fork the stick math unless a verified target limitation requires it.
4. Select the closest profile from `profiles/`, then create a target-game profile containing only the semantic differences needed by this game.
5. Keep phone controls lightweight. Phones send intentions; the host owns positions, collisions, hits, damage, cooldowns, inventory, scores, and mission results.
6. Route selected `human` and connected `adapter` seats through the same token, sequence, sanitation, timeout, and pulse gate.
7. Keep optional built-in `ai` seats separate. Never auto-fill empty seats unless the existing host explicitly enables that option.
8. Give each connected AI only its own binding and a screen-bounded public observation. Do not expose raw world state, hidden opponents, host tokens, AI paths, random seeds, or future authority state.
9. A party/shared/spectator screen must never instantiate the controller or send player input.
10. Preserve local-first behavior and do not add telemetry, cloud runtime, public tunnels, or remote assets.
11. Add target-specific tests for profile mapping, token rejection, stale sequence rejection, quick pulses, seat isolation, observation visibility, disconnect neutralization, and lifecycle return to the launcher.
12. Run the real tests. Clearly mark physical phones, real connected AI, browser rendering, and stress tests as UNTESTED/UNRUN unless actually performed.
13. Work only in the local target workspace. Do not commit, push, or change GitHub unless separately authorized.

Use `PORTING_GUIDE.md`, `AI_NATIVE_CONTRACT.md`, `SECURITY_MODEL.md`, and `INTEGRATION_CHECKLIST.md` as the acceptance contract. Keep a short action report showing files changed, tests run, passes, and remaining limitations.

---

