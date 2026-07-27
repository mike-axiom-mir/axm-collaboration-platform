# District Party v0.2.9 city-texture intake receipt

## Source

- Package: `AXM_DISTRICT_PARTY_TILBURG_LOCAL_v0_2_9_CITY_TEXTURE_PASS_COMPLETE.zip`
- SHA-256: `8C1316374E2BBD75D8A8119532E34CC892B3F40E14FC639AC51A8EFE3869D3B5`
- Intake boundary: focused `CITY_TEXTURE_PORT_FILES.txt` overlay only

## Installed

- Continuous, topology-aware source-tile surfaces
- Public roads and sidewalks rendered above overlapping source roofs
- Deterministic road, sidewalk, park, water, rail, and roof texture variation
- v0.2.9 city-art profile, focused verification, documentation, and preview receipts

The authoritative map, source index, 96 map chunks, mission state, phone/controller
transport, multiplayer/session logic, and save logic were not replaced.

## Preserved Workshop seam

The incoming renderer made single-frame modern player art primary. The installed
Workshop game intentionally keeps animated legacy player sheets primary and modern
art as a fallback. That ordering was preserved while retaining the v0.2.9 map renderer.

## Verification

- Incoming complete package: 178/178 tests passed before intake
- Installed baseline before intake: 176/176 tests passed
- Focused city-art and user-art seam: 9/9 passed after merge
- CLI lifecycle: PASS, including 96 map chunks and 13 art districts
- Installed complete suite after merge: 178/178 passed
- Live local session: launcher, Party A screen, game canvas, and full-map overlay opened
- Browser console: no warnings or errors during the live check
- Visual comparison: the previous roof carpet was replaced by separated building
  blocks with an openly readable street network

Local preview regeneration reported `UNRUN` because the optional
`@napi-rs/canvas` build dependency is not installed. Runtime gameplay does not
depend on that package; the supplied renderer previews and live browser canvas were
both inspected instead.

## Rollback

The overwritten pre-intake files were copied to the Workshop rollback area before
the focused overlay was applied.
