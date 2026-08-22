# Known limits

- This Game Night beta intentionally supports one human plus one AI companion;
  there is no second-human or split-screen mode.
- The world and characters are native Canvas 2D toon art, not a 3D character
  pipeline or skeletal animation proof.
- Gamepad mapping is implemented but still needs a physical-device play pass.
- Physical phone controls are not part of this build.
- The managed server retains a session across browser reloads, but a server
  process restart begins a new run.
- Port 8803 now runs the current hardened authority and transport from a fresh
  story state. As above, any later managed server restart begins another new run.
- District, meeting, activity, and unlock progress is run-local. Restarting the
  run deliberately clears it; there is no profile save or long-term unlock tree.
- Neighbor interactions are authored introductions and unlock clues, not a
  branching dialogue or relationship simulation.
- Color wisps and range blooms are one-time activities per run; there are no
  procedural side quests or daily objectives yet.
- Performance evidence is a short local workload sample, not a broad hardware
  certification.
- Continuous rolling visual capture was unavailable. Repeated screenshots and
  authoritative state checks cover key states but cannot prove every frame
  between samples.
- Fresh in-app-browser proof covers the current entry, combat, windups, perfect
  dodge, armed Prism Counter, distinct ×2 projectile and impact, offscreen-safe
  compact confirmation, pause lifecycle, and story-one handoff. Exact
  between-frame cadence remains unclaimed without rolling capture.
- Sound is synthesized locally and starts muted because browsers require a
  user gesture.
- Gameplay quality and difficulty require Mike's human review.
