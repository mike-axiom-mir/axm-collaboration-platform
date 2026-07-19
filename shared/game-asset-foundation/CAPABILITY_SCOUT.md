# Game Asset Foundation capability scout

Target: a coherent, original, reusable urban asset production floor comparable in presentation class to 2002-2006 console/PC games. This does not claim the copyrighted style, content, authorship, polish, or exact production quality of any named title.

Outcome: the software-rendered candidate was technically valid but **rejected by Mike as visually below the floor**. Its generated outputs are not retained or promotable. The successor is `tools/ps2-asset-forge`, which uses real local GLB sources, WebGL, textures, lighting, animation, procedural surfaces, and a human-gated export.

## Reused local capabilities

- deterministic OBJ and glTF 2.0 delivery;
- procedural geometry, raster, PNG, KTX2 and ZIP codecs;
- real UV/tangent/PBR channel baking through Asset Hands;
- collision/navigation candidates and machine-readable receipts;
- local Canvas preview and no required external runtime package.

## Gaps found in the previous baseline

The former pack was structurally real but visually below the requested minimum: crude 68-triangle pedestrians, 188-triangle vehicles, 212-triangle buildings, sixteen mostly flat materials, only twenty visible assets, and an animated proxy that was not the reviewed visible character mesh. A family count and a valid file container could not honestly prove 2002-2006 presentation quality.

## Technical capabilities added in the rejected route

- 27 assets across five gameplay families with category geometry floors and ceilings;
- category-specific facade, road, prop, vehicle and human detail;
- a 1024 atlas with 32 semantic procedural materials and four complete style variants;
- a 13-joint walk rig built directly from each visible character's LOD0 triangle mesh;
- four 1600 x 1200 contact sheets and one 1600 x 900 composed street scene;
- a release-authority boundary that keeps visual, native runtime, and public-release approval false.

## Remaining gaps

Native Blender/Godot/Unity/Unreal execution is still missing and must not be claimed. Human art review is still required. PS3 and PS4 features are future tiers documented in `QUALITY_LADDER.md`; they are not silently included in the PS2 technical pass.

## Promotion gate

The foundation may emit `PS2_TECHNICAL_CANDIDATE_PASS` only for structural checks. That receipt does not authorize promotion. This candidate's human art verdict is `REJECTED`, so public release and Library promotion are forbidden even though the technical receipt exists.
