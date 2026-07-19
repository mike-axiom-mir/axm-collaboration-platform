# AXM Asset Fabric v0.9

Asset Fabric is an independent experimental creation line for recurring asset
needs. It does not live inside Studio and does not continuously call an image
generator.

Every new need declares an `axm.target-canvas/v1` before generation, including
medium, dimensions/units, colour, physical constraints, behaviour, performance
budgets and intended use. It also declares quality requirements, required
outputs and editable recipe formats. The shared registry matches the complete
request to a capable hand before creation.

Nineteen modular local creators cover screen/vector work, native game and screen
raster textures, ETC1S/BasisLZ KTX2 texture delivery, UI, pixel/sprite families,
compositions, print, fabric repeats, physical engraving, cut layouts, Visual
Kernel themes, responsive layouts, read-only inspection, DeviceCMYK PDF, APNG
animation, bounded OBJ/GLB geometry, MaterialX materials and editable
AXM/EDL/OTIO timelines.
`UNSUPPORTED_CANVAS` and `MISSING_HAND` are visible results; when the registry is
present they never trigger the legacy SVG fallback.

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
