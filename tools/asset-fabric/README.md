# AXM Asset Fabric v0.15

Asset Fabric is an independent experimental creation line for recurring asset
needs. It does not live inside Studio and does not continuously call an image
generator.

Every new need declares an `axm.target-canvas/v1` before generation, including
medium, dimensions/units, colour, physical constraints, behaviour, performance
budgets and intended use. It also declares quality requirements, required
outputs and editable recipe formats. The shared registry matches the complete
request to a capable hand before creation.

The runtime registry's modular local creation providers cover screen/vector
work, native game and screen raster textures, ETC1S/BasisLZ KTX2 texture
delivery, UI, source-preserving pixel transforms, engine-neutral 8-bit/16-bit
pixel animation workflows, compositions, print, fabric repeats, physical engraving,
cut layouts, Visual Kernel themes, responsive layouts, read-only inspection,
DeviceCMYK PDF, animation and video, bounded OBJ/GLB/OpenUSD geometry,
MaterialX materials, accessibility/localization, MIDI/MusicXML, spatial
navigation and permission-gated native application handoffs. The registry and
runtime diagnostics remain authoritative if that count changes.
`UNSUPPORTED_CANVAS` and `MISSING_HAND` are visible results; when the registry is
present they never trigger the legacy SVG fallback.

The Identity-Bound Pixel 3D Representation Hand adds an exact
`pixel-8bit-3d` / `pixel-16bit-3d` route for the four pilot identities. It emits
real animated GLB 2.0 models, editable scene recipes, persistent identity and
profile contracts, representation sets, and deterministic validation receipts.
The GLBs preserve footprint, pivots, sockets, and semantic animation state.
High-detail and cinematic requests remain typed missing representations, and
four pilot models are explicitly not a complete whole-game walkable-3D pack.

The Game Visual Pack Selection Hand adds a game-wide seam over those asset
representations. It checks complete semantic slot coverage, exact pack and game
contract digests, declared hardware requirements, installed inventory, and the
bundled old-machine baseline. It can recommend a compatible pack, but only an
explicit player choice can produce a selection receipt. Missing, incompatible,
or contract-mismatched packs are refused without changing saves, simulation, or
the currently active layer.

The compatibility panel consumes `axm.asset-hand-gap-report/v1`. When no route
exists it shows the missing kind, target medium and required output so a future
Hand Forge can scaffold the capability without weakening the request.

Every hand result keeps its target canvas, creation recipe, preview, validation
receipt, provider/engine versions, real source artifacts, hashes, declared
losses, limits and candidate-only authority. Primary delivery and preview are
separate: SVG, PDF, PNG, APNG, KTX2, JSON, DXF, OBJ, GLB, MaterialX and OTIO
remain distinct artifact types.
Technical failures are held; safe behavioral novelty and different value
trade-offs may coexist.

## Universal components and Play Composer

Asset Fabric accepts the `axm.universal-component/v1` protocol: small immutable
pieces with typed ports, exact ids, versions and digests, canvas compatibility,
provenance, resource costs and honest assurance ceilings. A versioned
`axm.universal-component-graph/v1` connects those pieces without granting code
execution. Its `READY_CONTRACT` receipt proves only that the graph resolves and
is type/canvas compatible. It does not claim a final render, good taste,
accessibility, game fitness or manufacturing safety.

The Play Composer reverses the machine-facing path for a human. Friendly
controls create an `axm.play-compose-draft/v1` containing the exact normalized
control state, four immutable components, a typed graph and an ephemeral SVG
preview. The same input is deterministic and works without AI, cloud calls or a
network. **Grow directed variant** changes only one declared design axis
(palette, silhouette, weight, balance or contrast), records its parent digest,
energy and branch, and leaves the other axes available for comparison. Nothing
is stored until **Keep in incubator** is explicitly chosen; keeping it creates a
normal unvoted Fabric candidate rather than approving or publishing it.

JSON makes 2D, 3D, audio, document and physical recipes addressable through one
composition language. It does not make every output executable by itself: each
target still requires a matching hand, renderer/exporter and field-specific
validator. Missing realization capability remains `MISSING_HAND` or
`UNSUPPORTED_CANVAS`.

Asset Fabric consumes normalized `axm.asset-hand/v2` capabilities and retains
the old v1 state schema. The shared workbench also supports create, edit,
inspect and validate requests with bounded typed source artifacts; host
permissions and network policy are matched before execution.

The browser cannot cast the machine seat. It exports an exact candidate review
request and accepts `axm.asset-fabric.machine-review-receipt/v1`. The receipt
must name the machine identity, connector issuer, candidate id and generic
candidate digest, verdict, time and evidence. A candidate enters the shared
vocabulary only after an explicit Mike vote and a separate digest-bound
Axiom/Mir connector receipt.

Solo use remains available: any candidate artifact may be downloaded directly
with an `unreviewed` label. Governance controls entry into this installation's
shared vocabulary; it does not make creative capability depend on two connected
identities.

The original `axm.asset-fabric.v1` browser key and
`axm.asset-fabric.state/v1` schema remain in use. Old needs gain an explicitly
marked legacy-inferred target canvas in memory; candidate ids, votes, vocabulary,
archive state and dual-approval records are retained. New candidates use a
format-neutral digest while old SVG digests remain valid.

The heartbeat defaults off, stops when the page closes, and never writes into a
game package, Studio project, Asset Vault or public release.
