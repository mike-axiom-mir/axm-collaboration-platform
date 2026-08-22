# AXM LEGO City Workflow Transit

Status: **EXPERIMENTAL**

Workflow Transit compiles a route into a deterministic plan and advances only
receipt-backed state. It never executes steps. A domain profile may remove
steps or lower retry budgets, but cannot add a step, restore a removed
dependency, increase a budget, or change an effect.

A successful effect with missing, stale, or unknown verification enters HOLD.
Only `SUCCESS` plus `PASS` becomes `VERIFIED`, and only verified dependencies
unlock downstream steps. Checkpoints are digest-bound; resume refuses drift.
