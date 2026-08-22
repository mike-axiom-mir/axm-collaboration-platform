# Known limits

- The second shared-screen seat can be Human, Connected AI, or built-in Moxie.
  There is no split-screen camera or separate remote-player viewport.
- The terrain presentation is now hybrid low-poly WebGL plus authoritative
  Canvas gameplay. Characters, collision, aim, and effects remain Canvas 2D;
  this is not a skeletal-animation or full 3D collision pipeline.
- Gamepad mapping is implemented but still needs a physical-device play pass.
- Physical phone controls are not part of this build.
- The managed server retains a session across browser reloads, but a server
  process restart begins a new run.
- Port 8803 now runs the current hardened authority and transport from a fresh
  story state. As above, any later managed server restart begins another new run.
- District, meeting, activity, and unlock progress is run-local. Restarting the
  run deliberately clears it; there is no profile save or long-term unlock tree.
- Five watch receipts are bounded to the current run and appear in the victory
  result; they are not profile persistence or Steam achievement proof.
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
- Steam packaging, store integration, achievements, controller certification,
  and release-candidate performance remain unbuilt/unverified in this lane.
