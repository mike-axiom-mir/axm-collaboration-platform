# Live Visual Receipt

## Initial review surface

```text
claim: the local review UI renders the 24-card matrix and its hard boundaries at a normal desktop viewport
surface / route: http://127.0.0.1:8765/tools/external-pattern-observatory/
visual backend and fallback reason: BROWSER_PRIMARY; no fallback required
viewport / device / seat: 1280 x 720, desktop browser
baseline evidence: 24 cards; metrics 24 / 24 / 24 / 24; fatal message hidden; semantic snapshot exposed all filters and cards
action: open local route
expected visible change: loading copy settles into metrics, filters, cards, and a review panel
observed sequence: local page and five local assets returned 200/304; deterministic report rendered; no console warning or error observed
typed observation: the initial review surface rendered with explicit EXPERIMENTAL, installed:false, promoted:false, unverified-source, and blocked-reuse labels
verdict: PASS
named seam: none
buffer digest: sha256:65c6251cf3847e4411d5fa75269d8b21b44c7787e44c5e09c38ca5dea1512aad
temporary paths deleted: no temporary file paths were created; screenshot bytes stayed in memory
cleanup complete: yes
next cheapest test: select a card and observe the review detail
```

## Card inspection and corrected overflow seam

```text
claim: selecting a pattern exposes its source, freshness, license, warnings, and reuse gate without horizontal overflow
surface / route: local review UI, ollama card
visual backend and fallback reason: BROWSER_PRIMARY; no fallback required
viewport / device / seat: 1280 x 720, desktop browser
baseline evidence: ollama card visible in the 24-card queue
action: click the ollama card
expected visible change: ollama becomes pressed and its complete review detail appears in the sticky inspection panel
observed sequence: first observation selected the card but long state tokens caused horizontal overflow; CSS grid bounds were corrected and the same click was repeated
typed observation: after correction aria-pressed=true, selected title=ollama, document clientWidth=scrollWidth=1265, inspection clientWidth=scrollWidth=377, and the full blocked-reuse state wraps inside the panel
verdict: PASS after one preserved and repaired VISUAL_SEAM
named seam: initial long-token inspection overflow, now corrected
buffer digest: initial-fail sha256:51d7d73305fa8ade7b01f27ecd0c01fcac88694ffa8462f0dd349b707e8559d8; corrected sha256:f7c94625691b752fcc45c96da51de8467080e84ee7c2e50ce0a84626ae9eee39
temporary paths deleted: no temporary file paths were created; screenshot bytes stayed in memory
cleanup complete: yes
next cheapest test: filter the queue so the selected card leaves the visible set
```

## Filter and selection coherence

```text
claim: search filtering updates the visible count and does not leave a hidden card presented as the active visible selection
surface / route: local review UI search field
visual backend and fallback reason: BROWSER_PRIMARY; no fallback required
viewport / device / seat: 1280 x 720, desktop browser
baseline evidence: ollama selected with 24 cards visible
action: enter credential in Search
expected visible change: four matching cards remain and the out-of-filter ollama inspection is cleared
observed sequence: the first filter observation correctly showed four cards but retained ollama in the inspection panel; selection-reset behavior was added and the same journey repeated
typed observation: visible count=4; cards=gemini-cli, n8n, openclaw, tooljet; inspection title=Choose a visible pattern; document clientWidth=scrollWidth=1265
verdict: PASS after one preserved and repaired interaction seam
named seam: initial stale selection after filtering, now corrected
buffer digest: initial sha256:e47f7d39179a7611c2043eb69064cd93b3361daeaa3ba55f39472dbcb3f47748; corrected sha256:d01bf5916deea370405f5ddf5e74b23a5ed2a827abffe35d066f9b34cea24865
temporary paths deleted: no temporary file paths were created; screenshot bytes stayed in memory
cleanup complete: yes
next cheapest test: repeat at the narrow breakpoint
```

## Narrow responsive layout

```text
claim: the review surface remains readable and avoids horizontal overflow at a narrow mobile-sized viewport
surface / route: local review UI
visual backend and fallback reason: BROWSER_PRIMARY; no fallback required
viewport / device / seat: 390 x 844, narrow responsive viewport
baseline evidence: fresh reload with all 24 cards
action: apply the declared narrow viewport and scroll to the page top
expected visible change: hero/status stack, two-column metrics, and single-column workspace/filter/card layouts fit the viewport
observed sequence: page reflowed; top frame showed the complete hero, status pills, hard boundary, and metric grid; no fatal message or console error was observed
typed observation: clientWidth=scrollWidth=375; metrics=2 columns; filters=1 column; cards=1 column; workspace=1 column; 24 cards loaded
verdict: PASS
named seam: none
buffer digest: sha256:2f2493cac31637cacd4af1b29093f6c900b990d37d8e5e8fe8da3b10ce139135
temporary paths deleted: no temporary file paths were created; screenshot bytes stayed in memory
cleanup complete: yes; viewport override reset, agent-created tab closed, loopback server stopped
next cheapest test: human taste/accessibility review if this candidate is considered for promotion
```
