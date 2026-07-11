AXM SKIN GALLERY
================
Share skins here. Freedom in safety.

WHY THERE IS NO "UPLOAD" BUTTON
-------------------------------
The hub is local-first. There is no server, no account, nothing to upload
to — and a button that pretended otherwise would be a lie. Sharing works
the way everything else here works: files, in the open, checked before use.

Your own saved skins live in the Skinner ("My skins"). Export one as
skin.config.json, or export your whole library as skins.pack.json. Send it
to anyone. They import it, the gate checks it, done. No network involved.

GETTING A SKIN FROM THE WEB
--------------------------
Found a skin someone shared online? Two ways in, both gated identically:
  · Import file…      pick the downloaded .json
  · Paste             copy the JSON, paste it into the Skinner
Pasting works even when file downloads are broken on your device.

A shared skin may reference assets you do not have (vault:some_background).
That is not a refusal — the colours still work — but the hub TELLS you which
assets are missing and that those parts will not appear. It never leaves a
silent blank where a background was meant to be.

TO SHARE WITH EVERYONE
----------------------
1. Export your skin from the Skinner.
2. Drop it in this folder as <name>.skin.json.
3. Open a pull request on the public repo.
4. It is checked with the same gate the hub uses:

     node hub/skin-check.js exports/skins/<name>.skin.json

   Exit 0 means it passes. Exit 1 prints exactly what it would have
   broken. No skin is merged that fails.

WHAT SIZE SHOULD MY ASSETS BE?
------------------------------
Run:  node hub/skin-assets.js          (or --json)
Or open the Skinner: "Assets a designer can supply" -> Copy spec.

10 slots, ALL OPTIONAL. A skin with zero assets is a complete skin. Sizes are
derived from the shell's own CSS, so the sheet can never drift from what the
gate accepts. An undeclared slot is refused, and the legal ones are named.

  brand.mark            30 x 30      svg|png   top bar glyph
  brand.wordmark        120 x 24     svg|png   replaces the "AXM Hub" text
  nav.icon.default      20 x 20      svg       sidebar + 62px rail; currentColor
  sidebar.background    210 x 1200   png|webp  cropped to 62px in rail mode
  viewport.background   1600 x 900   png|webp  centre-cropped, outer 15% may cut
  home.hero             1200 x 320   png|webp  text sits on the left third
  card.texture          400 x 260    png|webp  shell applies a 14px radius
  statusbar.background  1600 x 40    png|webp  log text sits on it
  overlay.backdrop      1600 x 900   png|webp  blurred and darkened by the shell
  viewport.empty        480 x 360    png|svg   the error/recovery card

Author at @2x. Vector where offered. No URLs — vault: references only.
An image never exempts a skin from the readability floor.


WHAT THE GATE REFUSES, AND WHY
------------------------------
A skin is DATA, never code. It may recolour everything, move the nav,
change density, radius and font. It may NOT:

  · carry raw css, script, url(javascript:), var() or calc()
  · reach any token outside the declared editable surface
  · pull assets off the internet (vault: references only — local-first)
  · remove or hide the module list, action log, permissions screen,
    layers screen, or the active-module name
  · make a warning unreadable

That last one is the important one. Blocking display:none is not enough:
a warning painted black on black is just as hidden. So every truth-bearing
colour pair must clear a contrast floor (WCAG AA 4.5:1 for warnings, errors
and body text; 3.0:1 for secondary text like the hidden-module count).

A light theme, a wood theme, a neon theme — all fine. A theme that quietly
erases the "2 machine modules hidden" line is not. Don't cage, only protect.

ON AUTHOR NAMES
---------------
The "author" field in a skin file is a CLAIM typed by whoever made the
file. Nothing in this system verifies identity. The hub records it as
"author claimed", stamps where the file actually came from, and shows you
a 16-character fingerprint of the look itself so two people can confirm
they hold the same skin. The fingerprint is non-cryptographic: it catches
accident and drift, not a determined forger.

FINGERPRINTS
------------
Same look = same fingerprint, regardless of name, id, or key order.
Change one digit of one colour and it changes. Use it to check that the
skin you received is the skin that was reviewed.

WHAT IS IN HERE NOW
-------------------
  daylight.skin.json     a full light theme          (15 changes)
  cozy-wood.skin.json    warm, right-hand nav, compact (14 changes)

Both pass the gate. Fork them rather than starting from a blank page.
