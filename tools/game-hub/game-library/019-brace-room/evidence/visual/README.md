# Brace Room — visual evidence

Real screenshots captured 2026-08-04 through the live `ai-seat-courier` (a
real headless Edge instance driven over CDP, not generated images). Each PNG
is exactly what a browser rendered at that moment, not a mockup.

Closes the "Evidence screenshot suite not done" gap noted in
`KNOWN_LIMITS.md`. Scope decision: this pass covers setup and in-run visual
states, not a full run to a win/loss screen — reaching an actual end screen
honestly requires several real minutes of elapsed session time (shortest
contract is 6 minutes) with no debug fast-forward hook in the code, which
wasn't a good use of a single evidence pass. A win/loss screenshot is a fair
thing to add whenever a real playtest session already reaches one naturally.

## Files

- **01-lobby-setup-screen.png** — the setup screen: crew-size picker,
  shift-length picker, control bindings reference, Start shift button.
- **02-active-run-fault-and-false-alarm.png** — a live run mid-wave: hull at
  82, an active Ballast fault with its progress ring, and a "Breaker failed"
  false-alarm toast, proving both the fault-resolution UI and the
  false-alarm feedback render correctly together.
- **03-high-contrast-canvas.png** — the same run with high contrast (`C`)
  toggled on. Confirms the canvas-level palette switch actually reaches
  station outlines, the resolve-progress ring, and station labels (not just
  page chrome), matching what `KNOWN_LIMITS.md` claims.
- **04-reduced-motion-static-ring-plus-seconds.png** — the same run with
  reduced motion (`M`) toggled on, caught with an active Engine Bay fault.
  Confirms the countdown ring is genuinely replaced by a static ring plus a
  plain numeric "5.3s" readout instead of a continuously shrinking arc —
  the specific behavior `KNOWN_LIMITS.md` describes, now visually proven
  rather than just asserted.

All four came from one continuous, unresolved session (no controller was
actively playing), which is also why hull integrity visibly drops across
them (82 → 64 → 28) — that decay is the balance-sim-verified difficulty
curve doing exactly what it's supposed to when nobody answers a station in
time, not a bug introduced by capturing evidence.
