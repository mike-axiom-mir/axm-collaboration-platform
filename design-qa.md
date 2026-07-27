# AXM Sentient Atrium — Design QA

**Comparison target**

- Source visual truth: `%CODEX_HOME%\generated_images\019fa17c-894e-7b03-a481-ea429e8e9f83\exec-6112db9c-8863-4ba2-92be-0ceda9ea847e.png`
- Browser-rendered implementation: `hub\qa\sentient-atrium-live-home-final.jpg`
- Full-view comparison: `hub\qa\sentient-atrium-comparison-pass1.jpg`
- Focused hero comparison: `hub\qa\sentient-atrium-comparison-focus.jpg`
- Local route: `http://127.0.0.1:8788/hub/index.html`
- State: Home, Advanced view, local Sentient Atrium skin, navigation expanded, Manage menu closed.
- Viewport: implementation 1280 × 720 CSS px at device density 1.
- Pixel dimensions: source 1487 × 1058; implementation 1280 × 720.
- Normalization: the full comparison preserves both aspect ratios and normalizes them to 720 px image height. The source is a taller design board, so its horizontal canvas is narrower at normalized height; no stretch or false 1:1 crop was used. The focused comparison uses native source and implementation regions, normalized to 600 px height.

**Findings**

- No actionable P0, P1, or P2 fidelity differences remain.
- Typography: the live shell preserves the editorial sans/monospace hierarchy, strong optical weight, mint `make` accent, readable body copy, and intentional compact instrumentation. At the narrower live viewport the headline wraps to three lines instead of the source's two; this is an acceptable responsive adaptation that preserves the hero, intent field, system state, and creation lanes above the fold.
- Spacing and layout rhythm: navigation, hero, intent control, quick lanes, tower, and system-state rail retain the source hierarchy. The live shell is denser because it carries the real 101-tool navigation and full command ribbon, but there is no overlap, clipping, or horizontal overflow at 1280 × 720.
- Colors and visual tokens: deep ink, cyan, mint, violet, and coral states map coherently to the source. Contrast remains clear across active navigation, status nodes, the primary CTA, and small labels.
- Image quality: the generated living-core asset matches the selected target's subject, palette, dimensional flow, and right-weighted crop. The reviewed WebP is sharp at the live crop and lightweight at 148,704 bytes. It is a real generated raster asset, not CSS or inline-SVG substitution.
- Copy and content: the selected prompt and supporting copy are preserved. Existing product labels remain truthful; `Show me where` is intentionally more explicit than the mock's arrow-only CTA.
- Icons and interaction states: visible controls use the existing AXM icon family. Home navigation, Manage open/close, Settings open/close, the active module surface, and the primary shell states were exercised in the live browser.
- Accessibility: the signal canvas is non-semantic and pointer-inert, reduced motion has a deterministic still state, focusable controls retain semantic names, and the new Hub files produced no findings in the static accessibility report. The repository-wide audit still reports 396 established findings across 41 older files; none point to `hub/index.html` or the Sentient Atrium files.

**Focused comparison evidence**

- `sentient-atrium-comparison-focus.jpg` makes the display type, supporting copy, intent field, creation lanes, tower crop, and system facts large enough to inspect. The five required fidelity surfaces are readable there, so no additional crop is needed.

**Comparison history**

- Iteration 0 — P2: the saved skin overrode the new hero image, runtime hydration removed the `make` accent, and the saved wordmark made AXM appear twice. Fix: raised the reviewed hero asset's presentation specificity, added a deterministic title enhancer, and made the saved wordmark resolve to the single `Hub` destination label. Post-fix evidence: `sentient-atrium-live-home-final.jpg` and both comparison images.
- Iteration 1 — P2: the workspace stacking context painted over the expanded Manage deck, leaving its controls visually hidden and non-interactive. Fix: restored the command ribbon above the workspace while keeping the status bar and content layers bounded; added a regression assertion. Post-fix browser evidence: the menu is visible from y=63 to y=424, its Settings control is the hit target, and Settings opens as `overlay show` with 12 rows.
- Iteration 2 — final comparison: source and live Home were placed in the same full-view and focused comparison inputs. No actionable P0/P1/P2 difference remained.

**Verification evidence**

- Live: 1280 px document width equals 1280 px client width; command ribbon ends at 1280; local time ends at x=1272; hero uses `sentient-atrium-core.webp`; Home is visible and the module iframe is hidden.
- Runtime diagnostics: no browser console entries were reported during the final interaction pass.
- Deterministic visual self-test: 21/21 passed.
- Full Workshop suite: passed.
- Workshop verifier: 0 failures; existing backlog warnings remain outside this visual change.

**Implementation checklist**

- [x] Match the selected living-system composition and asset direction.
- [x] Keep AXM identity singular and the navigation/task hierarchy readable.
- [x] Preserve real product controls and authority boundaries.
- [x] Verify Home, module continuity, Manage, and Settings in the live browser.
- [x] Verify deterministic replay, reduced motion, asset weight, and menu layering.
- [x] Compare source and implementation together at full-view and focused scales.

**Follow-up polish**

- P3: a future toolbar-specific pass could further simplify rarely used command indicators at narrow desktop widths, but the current controls are reachable, unclipped, and intentionally compact.
- Residual test gap: alternate tablet/mobile widths were reviewed through responsive rules rather than a second live device viewport in this pass.

final result: passed
