# Circuitseed blocking-overlay Escape repair

Date: 2026-08-16  
Status: `TEST`  
Manifest state: `verified`  
Canon: no; Mike Tobi / AXM review remains the merge gate

## Outcome

Escape now closes the top user-controlled overlay instead of reopening an
already-visible journey menu. With no dismissible overlay during active play,
Escape opens the journey menu. On the title screen it remains inert. The
authoritative starter choice and encounter state are not discarded in the
client; they bridge to the reversible journey menu, which retains Resume and
Save/End controls.

The manifest moved to `verified` only after a second browser pass exercised
every current blocking surface in the production client. A test-only server
harness staged authoritative starter, discovery, and encounter states without
adding a production route or bypassing the real client behavior.

## Failure preserved before repair

- Claim: pressing Escape closes the open journey menu.
- Surface / route: local Circuitseed shared screen.
- Visual backend: `BROWSER_PRIMARY`; no fallback.
- Viewport: 1280 x 720 CSS pixels, device pixel ratio 1.25.
- Baseline: `menuPanel` was the sole visible blocker.
- Action: one Escape keypress.
- Observed: `menuPanel` remained visible and its class remained `modal`.
- Verdict: `FAIL`.
- Screenshot-buffer SHA-256: `2478d71e51e6f2bcbbb344af45df99c0614156fe38347c61af4f70da1c68e952`.

## Repaired live observations

| Claim | Before action | Action | Settled observation | Verdict |
| --- | --- | --- | --- | --- |
| Journey menu is reversible | No visible blocker | Escape, then Escape | `menuPanel` opened as the only blocker, then closed; game remained visible | `PASS` |
| Workbench drawer is reversible | `workbenchPanel` only | Escape | No visible blocker | `PASS` |
| Profile dialog is reversible | `profilePanel` only; menu already closed | Escape | No visible blocker | `PASS` |
| Settings dialog is reversible | `settingsPanel` only; menu already closed | Escape | No visible blocker | `PASS` |
| Title does not acquire a stale menu | Title visible after a clean session end | Escape | Title remained visible; no blocker and no menu | `PASS` |

The repaired menu-open frame hashed to
`afe92f374844c1b2508ed8bc9c1306d55fe83011fd44d0466571293bea78839e`;
the settled world frame after Escape hashed to
`6da868e898be931b1403c4c048de975a01a076f3504ef51dad3f89c3dc573425`.
No browser warnings or errors were recorded during the repaired journey.

## Complete staged blocker journey

The second pass used the production client with two occupied human seats at
1280 x 720 CSS pixels and device pixel ratio 1.25. The isolated harness staged
only server-owned state; all visible controls and Escape handling remained the
shipping client implementation.

| Blocking state | Live action | Settled observation | Verdict |
| --- | --- | --- | --- |
| Journey menu | Escape on Resume | Menu closed; no blocker remained | `PASS` |
| Workbench drawer | Escape on its close control | Drawer closed; no blocker remained | `PASS` |
| Profile dialog | Escape on its close control | Profile closed; menu stayed closed | `PASS` |
| Settings dialog | Escape on its close control | Settings closed; menu stayed closed | `PASS` |
| Discovery reveal | Escape on the visible discovery close control | Reveal closed; menu stayed closed | `PASS` |
| Starter choice | Escape, then Escape | Journey menu appeared above the still-authoritative starter; the second press returned to the unchanged starter | `PASS` |
| Encounter | Escape on a tactical control, then Escape on Resume | Journey menu appeared above the running encounter; the second press restored all eight tactical controls | `PASS` |
| Title | Escape on New Journey after a clean session end | Title remained visible; no menu or blocker appeared | `PASS` |

Selected ephemeral frame digests:

- starter baseline: `d66e0ef7a6df5c8e79dad1c88523e2539e2b1661e706d45b2696d32bf786982c`
- starter-to-menu bridge: `ad385f3ecccafe1cade1d93a5a8c30e5ebdeba2eea5c535afccb9125f2ec5b5c`
- discovery baseline: `6a3f4e1802af92b47a6653c5787f7a92977c671560085574951e2885e7243d82`
- encounter baseline: `9dec08606d8e01d1f71cdf3a0a715ec018d3cd479f48650bdf230d06133984c2`
- encounter-to-menu bridge: `aa198581ba72d26f946e614d3fd5079e4653c5392654cf70fd6a8e1204bfca2e`
- encounter restored: `11dbb95f3cb5524bc7e69890d04a45e6bf5252c186dd2bbf7d0d24951d020c7b`

One generic low-level browser key injection closed the discovery card and then
opened the menu. A focused, single Escape keypress on the visible discovery
control closed only the card, as the source policy specifies. This is retained
as an `INPUT_SURFACE_SEAM` in the automation surface rather than erased from
the receipt; it did not reproduce through the focused keyboard path used for
the verdict. Browser warnings and errors remained empty.

The earlier low-poly visual pass also retains pointer-driven menu and Resume
frames in `../2026-08-16-low-poly-three-pass-01/after/07-menu-overlay.png` and
`../2026-08-16-low-poly-three-pass-01/after/08-world-resumed.png`.

## Source and tests

- `client/app.js` start SHA-256:
  `855cdd3d4901bc8bea87c6c7ac751e042761708482be65f96ada33b4e83e7c6d`
- `client/app.js` repaired SHA-256:
  `f38220d2297814c1aa41e865610dd3a1865cf5540121d1a9b7654d50e6d9f1fe`
- `tests/blocking-overlay-escape.test.js` SHA-256:
  `de9e680e61fb0329a0bf6e4838cfee61c1bec8b2d4ce3402eaa24e6a4361ce5b`
- `tests/blocking-overlay-browser-harness.js` SHA-256:
  `6751f4846656443a4b928c128a67759c1ff018fa2df8f27339eefaf193223a50`
- `tests/blocking-overlay-browser-harness.test.js` SHA-256:
  `a61ea64fc703bbf7ce27953fd772a62cf22a853a4bd352f9aaf7345b3b865a0d`
- `node --check client/app.js`: pass
- focused overlay tests: 3 pass, 0 fail

## Evidence retention and limits

No raw screenshot or video file was created; only typed observations and the
selected frame digests were retained. The second-pass browser tab and server
process were closed, its harness-owned temporary root was removed, and a scan
found zero matching harness folders. Cleanup for this pass is `COMPLETE`.

The earlier first-pass isolated test folder remains outside the repository
because the execution policy rejected its bounded cleanup. No machine path or
session data is recorded here. That older cleanup seam does not broaden the
verified interaction scope.

Still unobserved and unclaimed in this lane: full focus trapping, physical
screen-reader behavior, physical phone input, and LAN behavior.
