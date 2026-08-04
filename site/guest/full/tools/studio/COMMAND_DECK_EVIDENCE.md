# Studio Command Deck visual verification

Date: 2026-07-24  
Surface: `http://127.0.0.1:8123/tools/studio/index.html` served from the local Workshop  
Visual backend: `BROWSER_PRIMARY` (Codex in-app browser)  
Capture policy: bounded semantic snapshots and screenshots only; no video or rolling buffer was required for these static interaction claims. The temporary browser tab was finalized and the local verification server was stopped.

## Claim 1 — core commands are discoverable and reach real Studio controls

- viewport: 1280 × 720
- baseline: Studio rendered with its mode rail, canvas, tool panels, and a visible `Commands · Ctrl K` entry point.
- action: opened Command Deck, searched `eraser`, selected `Select Eraser`.
- expected: deck closes, named schema-checked route reaches the existing canvas control, Eraser becomes visibly active.
- observed: deck closed; shell status became `Select Eraser ready`; the Eraser control gained the active outline; canvas status read `Tool selected: Eraser.`
- typed observation: `{coreResults:32, disabledWhenCanvasReady:0, routedAction:"tool.eraser", visibleActiveTool:"Eraser"}`
- verdict: **PASS**
- named seams found and repaired: search focus/ready timing was checked; an explicit `axm-studio-canvas-ready` handshake now removes cached-iframe timing dependence.
- temporary paths deleted: none created
- cleanup complete: yes

## Claim 2 — advanced access remains available and contextual

- viewport: 1280 × 720
- baseline: Command Deck opened with 32 core actions in Paint.
- action: enabled `Advanced + specialist`, cleared search, switched to Vector through the deck, then searched `path`.
- expected: advanced actions become available without replacing core actions; Vector exposes only relevant path controls plus the mode route.
- observed: Paint expanded to 70 context-valid actions across core, advanced, and specialist levels. Vector search returned seven entries: close/open, delete, duplicate, finish, start, smooth, and the Vector mode route.
- typed observation: `{paintExpandedResults:70, levels:["core","advanced","specialist"], vectorPathResults:7, bindingConflicts:0}`
- verdict: **PASS**
- named seam: none remaining in the tested route
- temporary paths deleted: none created
- cleanup complete: yes

## Claim 3 — the command layer and creative workspace remain usable on mobile

- viewport: 390 × 844
- baseline: the previous desktop-only iframe columns overflowed and obscured the canvas during the first narrow observation.
- action: added the narrow embedded layout, reloaded, opened the compact Command Deck, enabled advanced actions.
- expected: no outer horizontal overflow; canvas visible first; tools and supporting panels preserved below it; Command Deck fully inside viewport with a stable spoken label.
- observed: outer horizontal overflow was false; canvas rendered at the top; tools followed in the iframe scroll; Command Deck bounds were `{x:8,y:8,width:374,height:828}` inside the 390 × 844 viewport; 32 core and 77 Vector-context expanded actions were available; button name was `Open Command Deck`.
- typed observation: `{horizontalOverflow:false, panelClipped:false, mobileCoreResults:32, mobileExpandedResults:77, commandButtonName:"Open Command Deck"}`
- verdict: **PASS**
- named seam found and repaired: `MOBILE_IFRAME_DESKTOP_COLUMNS`
- temporary paths deleted: none created
- cleanup complete: yes

Next cheapest test: when a second visual tool adopts `shared/visual-actions`, run the same three checks against that host catalog and verify it declares no handler that the host cannot provide.
