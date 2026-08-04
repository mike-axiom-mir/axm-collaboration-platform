# Visual intake receipt — 2026-07-28

## Direct Workshop route

- claim: the protected Foundry opens through the AXM tool route and renders a usable desktop workspace
- surface / route: `/tools/visual-mold-foundry/` → `/shared/visual-mold-foundry/app/index.html`
- visual backend: BROWSER_PRIMARY — Codex in-app browser
- viewport: default desktop viewport
- baseline evidence: Overview rendered with 21 navigation areas, protected-count summary, first-run recovery guide, and no blank or clipped primary surface
- action: opened Mold Atlas
- expected visible change: the main panel changes to the searchable 32-mold catalog while the Foundry navigation remains available
- observed sequence: Overview → Mold Atlas; 32 shown / 32 usable; search and category/status/theme controls; preview cards rendered
- typed observation: desktop navigation and mold-card rendering are usable
- verdict: PASS
- named seam: none
- buffer digest: not applicable — bounded still-frame inspection only
- temporary paths deleted: none created
- cleanup complete: yes

## Responsive and theme behavior

- claim: the Foundry remains usable at a narrow mobile viewport and its light theme is a real rendered state
- surface / route: protected application route
- visual backend: BROWSER_PRIMARY — Codex in-app browser
- viewport: 390×844
- baseline evidence: Mold Atlas at dark theme
- action: applied the viewport override, then toggled Interface from dark to light
- expected visible change: navigation becomes horizontally scrollable, controls stack vertically, cards use one column, and semantic colours change without horizontal page overflow
- observed sequence: dark narrow Atlas → light narrow Atlas; document width stayed within viewport (`scrollWidth=375`, `innerWidth=390`); theme state reported `light`; cards and filters remained readable
- typed observation: responsive stacking, deliberate navigation overflow, and light-theme state work at the tested breakpoint
- verdict: PASS
- named seam: none
- buffer digest: not applicable — bounded still-frame inspection only
- temporary paths deleted: none created
- cleanup complete: yes

## Primary views and Hub integration

- claim: the useful Foundry rooms open and the existing Hub can expose and host the workspace
- surface / route: `/hub/index.html`, Create room, Visual Mold Foundry card
- visual backend: BROWSER_PRIMARY — Codex in-app browser
- viewport: default desktop viewport
- baseline evidence: Hub loaded 102 visible tools; Create contained the Visual Mold Foundry card after the one-time arrival migration
- action: opened Editor, Proof, Project Composer, Data Batch Builder, Recovery + Intake, System Status, then opened the Foundry from its Hub card
- expected visible change: each named room shows its own level-two heading, and the Hub iframe shows the protected application rather than an empty or error surface
- observed sequence: all six named rooms rendered their expected headings; the Hub-hosted Overview rendered at full working height; browser log inspection returned zero warnings/errors
- typed observation: primary read-only navigation and the Hub entry route are live; no import, approval, export, restore, or other governed mutation was triggered
- verdict: PASS
- named seam: fixed during intake — existing Hub profiles initially needed a one-time visibility migration
- buffer digest: not applicable — bounded still-frame inspection only
- temporary paths deleted: none created
- cleanup complete: yes

Full external Windows Chrome or Edge inspection and all target-engine adapter parity checks remain outside this receipt.
