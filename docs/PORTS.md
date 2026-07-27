# AXM local port map

As of 2026-07-23, this table records source defaults. A port appearing here does not prove that its process is running.

| Default | Owner | Default bind | Lifecycle and boundary |
|---:|---|---|---|
| 8787 | AXM local AI bridge | `127.0.0.1` | Separate explicit process; provider egress only after a valid origin/token and configured key. |
| 8788 | Workshop Hub | `127.0.0.1` | Main local server; may select a nearby free local port. |
| 8789 | Game Hub runtime | `0.0.0.0` | Started by the full launcher for phone/LAN play. This is an intentional LAN surface, not a loopback claim. Override with `AXM_GAME_HUB_HOST=127.0.0.1` for local-only play. |
| 8799 | isolated Mirror Core | `127.0.0.1` | Explicit start/stop; refuses non-loopback hosts. |
| 8801 | Mirror Learning Forge | external process | Workshop proxy target; availability does not grant authority. |
| 8818 | Mirror Native | external process | Workshop proxy target with token injection; private state is not served to browsers. |
| 8822 | Discord bridge | `127.0.0.1` | Default off; explicit process and token boundary. |
| 8902 | PS2 Asset Forge | `127.0.0.1` | Explicit local authoring runtime. |
| 8903 | Modern Asset Forge | `127.0.0.1` | Explicit local authoring/runtime verification service. |
| dynamic | device handoff / multiplayer transport | `0.0.0.0` only after explicit action | Temporary tokenized LAN listeners with declared TTL or stop behavior; they do not expose the Workshop server itself. |

Several packaged games have their own explicit LAN hosts. Those belong to each game package’s runtime contract and are not silently covered by the core Hub claim.
