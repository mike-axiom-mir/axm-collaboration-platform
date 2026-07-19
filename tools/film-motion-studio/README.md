# AXM Film & Motion Studio

Film & Motion is one visible production parent. Its capabilities remain modular underneath it so a stronger implementation can replace one route without rebuilding the whole workspace.

## Capability routes

| Route | Current capability | Replaceable boundary |
| --- | --- | --- |
| Plan | Storyboards and shot records | `axm.film-motion.project/v1` scene and board data |
| Cut | Frame timeline, tracks, clips and EDL | shared Timeline engine plus `axm.film.edl/v1` |
| Create | Layers, keyframes and procedural motion | shared Scene engine and ordinary editable keyframes |
| Visual sources | Shared Asset Hands | explicit `axm.asset-hand-result/v1` candidate handoff |
| Finish | Non-destructive clip effects and frame proof | future evidence-bearing renderer adapter |
| Review | Dailies, questions, comments and approvals | attributable review records; no automatic approval |
| Capture | Manual/imported tracking and camera preview | versioned capture packets and explicit device start |
| Deliver | Project, EDL, PNG proof and Publish inbox | explicit download or unreviewed Publish handoff |

## Asset Hands boundary

Film embeds the shared Asset Hands workbench; it does not copy any Hand implementation. A result is accepted only when:

- the message came from Film's own embedded workbench;
- the result uses `axm.asset-hand-result/v1`;
- its technical receipt passes;
- it contains a bounded SVG visual source.

The candidate enters only the current media session with its hand id, hand version, result digest and artifact digest. It is not placed on the timeline, approved, finished or published automatically. After a refresh the project keeps the provenance record but honestly asks for the visual source to be reconnected.

## Honest unavailable routes

- final encoded video requires a registered renderer that returns output evidence;
- automatic camera/object tracking requires a registered solver and evidence;
- rights clearance and creative approval remain human or governed review decisions;
- local source files and generated session URLs are never claimed as persistent project media.

Run the focused proof with:

```powershell
node tools/film-motion-studio/selftest.js
node tools/film-motion-studio/discovery-seam-review.js
```
