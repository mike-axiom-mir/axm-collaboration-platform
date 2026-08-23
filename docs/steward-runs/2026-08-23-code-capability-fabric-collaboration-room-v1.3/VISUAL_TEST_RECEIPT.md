# Visual Test Receipt — Fabric Collaboration Room v1.3

Status: `PASS` for the bounded visual and interaction claims

Visual backend: `BROWSER_PRIMARY` — Codex in-app browser  
Local route: `/tools/fabric-collaboration-room/index.html`  
Server mode: local safe mode, GET/HEAD only

## Desktop composition

- claim: Seven collaborators, the shared goal, four roots and exact-role
  inspector are visibly distinct.
- viewport: default browser viewport; captured frame `1265 × 712`.
- baseline evidence: initial PLAN route with Mike selected.
- action: select AI Challenger, then select Try a candidate.
- expected visible change: inspector changes to AI/OFF BY DEFAULT and route
  changes to CONTRACT GAP with executor authorization still required.
- observed sequence: both states changed exactly; active connector styling moved
  to the trial route; no live-provider claim appeared.
- verdict: `PASS`.

## Human decision boundary

- claim: The visual form refuses an incomplete trial and emits only an inert
  draft for complete visible inputs.
- action: select Prepare trial without a digest; then enter a synthetic exact
  SHA-256, a bounded note and the draft-only acknowledgement; select Prepare
  trial again.
- expected visible change: first action refuses; second emits
  `UNAUTHENTICATED_DRAFT` with `authority: NONE`, `effect: NONE`, false lifecycle
  fields and authenticated-human-decision as the next gate.
- observed sequence: matched exactly. Clear reset the output; HOLD emitted a
  Tier-0 draft; reload returned the page to `NO DRAFT`.
- verdict: `PASS`.

## Review route

- claim: Exact review remains in the existing Review Inbox.
- action: open the `Open exact Review Inbox` link.
- expected visible change: local navigation to
  `/tools/review-inbox/index.html`.
- observed sequence: route and page title changed to AXM Review Inbox, then the
  browser returned to the Collaboration Room.
- verdict: `PASS`.

## Narrow viewport

- claim: The surface remains usable at `390 × 844`.
- measured state: `innerWidth 390`, `clientWidth 375`, `scrollWidth 375`,
  horizontal overflow `false`; seven actors, three scenarios and three decision
  actions remained present.
- action: select Install / integrate, inspect Mirror, and create a HOLD draft.
- expected visible change: LOCKED route, Mirror inspector with LIVE UNKNOWN,
  vertically stacked decision controls and an unauthenticated HOLD draft.
- observed sequence: matched exactly; no overlap or clipped horizontal control
  was observed.
- verdict: `PASS`.

Browser console errors/warnings: none observed.  
Motion cadence: not claimed; only settled interactive states were tested.  
Buffer digest: `NOT_CREATED_REPEATED_SCREENSHOTS_ONLY`.  
Temporary paths deleted: none; the browser verifier created no local capture
file or recording.  
Cleanup complete: yes.  
Named seam: live AI and Mirror connections remain `UNKNOWN`; screenshots cannot
prove provider presence, transport, authentication or installation.
