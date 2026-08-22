# AXM LEGO City Hands Rail

Status: **EXPERIMENTAL**

The Hands Rail registers typed executor declarations and dispatches only a
caller-injected handler after the Authority Grid validates the exact request.
No shell, process, browser, network, or filesystem executor is bundled.

Every executor declares effects, budgets, cancellation, cleanup, denial probes,
and known gaps. A substrate name never proves confinement. One-use decisions
are consumed before the handler starts, including when the handler later fails.
Receipts distinguish success, partial completion, failure, and cancellation;
cleanup runs in all dispatched outcomes.
