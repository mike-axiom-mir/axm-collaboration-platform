# AXM Local GameHub isolated depot receipt

Status: **TEST / LOCAL PASS / RELEASE HOLD**  
Date: 16 August 2026

## Candidate identity

- Product boundary: one AXM Local GameHub application containing 19 games.
- Payload: 764 declared files, 159,142,693 bytes.
- Content SHA-256: `2485ea92ae807c00e45a013e5eb37cb4168301fa49f5058c274ececda13714b6`.
- Safety scan: PASS for forbidden paths, symbolic links, machine-user paths,
  private-key blocks, and high-confidence service-token patterns.
- Candidate status: TEST; human approval false; Steam upload performed false.

The candidate was built in a fresh directory outside the Workshop. The source
worktree was concurrently changing, so this hash identifies the observed TEST
snapshot; a later build must be treated as a new candidate and reverified.

## Independent scripted proof

`steam-depot-selftest.js` built another temporary candidate, verified all
declared file hashes and 19 game manifests, rejected excluded development and
authoring paths, started the staged bundled Windows runtime, and launched
District Party through the staged GameHub. It verified the nine-slot local save
API, the external per-game state route, an external GameHub result ledger, and
an unchanged depot content digest after session end. The exact temporary tree
was then removed.

## Live browser proof

The identified TEST snapshot above was launched with external local application
data and dedicated ports. Direct observation showed:

- `AXM Local GameHub`, visible TEST notice, `ONLINE · 19 GAMES`, 19 game
  options, zero world options, and no dead link back to the blocked Workshop.
- Workshop Hub, profile, and asset-inbox routes returned 404; direct asset
  authoring returned 403.
- Bonk & Bolt launched from the staged GameHub, entered active Kettlewick play
  as a Human Panzer, accepted keyboard movement, and later restored the saved
  world in the corrected payload.
- The pre-fix ready/launch journey exposed a roster synchronization race. The
  UI now locks launch and lobby polling around party synchronization; the
  corrected candidate launched immediately after readiness confirmation with
  `ROOM AXM1 · LIVE`.
- After the session ended, the candidate verified again at the same content
  SHA-256. The result ledger existed under local application data, outside the
  candidate.

Observed gameplay frame hashes from the first isolated Bonk journey were
`555a58b12fdfb3c4fe16b51bb09f82b8ccfe1295c880f28308fd9be867524674`
before movement and
`301f6427d8c4db4810b4ac53e289265f41dbefba9d2135cae9c146d44464761b`
after movement. They differ and accompanied a settled semantic state showing
`HUMAN · PANZER`, `KETTLEWICK`, health, clock, actions, and world HUD.

## Not proved

This is not a Steam-client install, clean second-Windows-machine pass, physical
phone/controller pass, offline/restart/uninstall matrix, rights clearance,
selected release build, upload, Valve review, or Mike Tobi release approval.
Those gates remain HOLD.
