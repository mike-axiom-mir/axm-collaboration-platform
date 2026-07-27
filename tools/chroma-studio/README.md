# AXM Chroma Studio (TEST)

Chroma Studio promotes the deterministic browser hand from
`exports/chroma-batch/` and joins it to the existing Device Handoff inbox.
It does not create another QR server.

## Day-to-day flow

1. Drop or send an image. Browser Downloads is the ready default outside the
   Workshop; choose a dedicated output folder only if you want to change it.
2. Open **Phone drop**, scan its expiring QR and select up to eight images.
3. Chroma Studio observes new JPEG, PNG and WebP files through the existing
   read-only asset index, keys them sequentially, and writes transparent PNGs
   into the chosen folder.
4. Uncertain cuts remain visible as `NEEDS MANUAL` and are never saved.

Local drag/drop is also supported. **Browser Downloads** is the frictionless
external default. The in-memory previews disappear when the page closes; the
receipt retains names, verdicts and keying metadata, not raw pixels.

The UI theme is the promoted shared copy of
`exports/command-deck-concept/axm-ui-theme.css` at
`shared/elements/axm-ui-theme.css`.

Run `node selftest.js` for the deterministic keyer and contract checks.
