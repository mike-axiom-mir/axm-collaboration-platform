# AXM interface fabric migration audit

Date: 2026-07-28

## Verdict

Use CSS Skin Fabric 0.2 as the shared foundation for interfaces. Keep Style Fabric 0.6 focused on game skins. The Hub now consumes the interface fabric through a bounded compatibility adapter, so its behavior and module code remain unchanged while new interface work can move to the native `.axm-*` molds.

The original desktop composition had a strong AXM identity, but its stacked visual layers produced an unusable phone state: the navigation rail opened over the heading, description, search, and creation controls. The package reference provided the better semantic token system and responsive behavior. The migration therefore retained the desktop art direction while replacing the shell values and narrow-screen layout with governed fabric values.

## Evidence

| State | Desktop | Phone |
| --- | --- | --- |
| Before | [01-before-hub-desktop.png](01-before-hub-desktop.png) | [02-before-hub-mobile.png](02-before-hub-mobile.png) |
| Package reference | [03-reference-desktop.png](03-reference-desktop.png) | [04-reference-mobile.png](04-reference-mobile.png) |
| Integrated Hub | [08-after-hub-desktop.png](08-after-hub-desktop.png) | [06-after-hub-mobile.png](06-after-hub-mobile.png) |
| Integrated navigation | — | [07-after-hub-mobile-nav.png](07-after-hub-mobile-nav.png) |

## Implemented

- Loaded the 149-token interface foundation before legacy Hub styles.
- Added a final adapter that maps legacy Hub values to semantic canvas, surface, border, text, accent, focus, spacing, radius, shadow, and motion tokens.
- Selected the packaged `aetherglass` interface theme with balanced effects.
- Rebuilt the phone opening into a clean single-column surface with a two-column quick-action grid.
- Disabled the decorative vortex on phones and made the navigation drawer opaque and independently controllable.
- Starts the phone drawer closed without overwriting the user's desktop rail preference.
- Added keyboard focus treatment and reduced-motion behavior.

## Verification

- CSS pack validator: pass (34 CSS files, 149 tokens, 16 components, 11 materials).
- CSS pack intake manifest: pass for 98 files; the Windows path-normalization repair is separately pinned.
- Style Fabric 0.6 release manifest: pass for 151 files.
- Style Fabric unit suite: 109/109 pass.
- Hub selftest: pass.
- Sentient Atrium selftest: pass.
- Package script-path selftest: pass.
- Live mobile navigation expand/collapse: pass.
- Live desktop and phone screenshots: visually inspected.
- Browser console errors on the final Hub route: none.

Screenshots establish the reviewed layouts and states, not complete accessibility conformance across every Hub route.
