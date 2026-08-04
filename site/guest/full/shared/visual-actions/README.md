# AXM Visual Actions

Status: **TEST shared service**. It describes and routes named actions; it is not a native automation authority.

Visual Actions turns app-specific shortcut research into a host-neutral action contract. A host owns its catalog and binds each action to a named local handler. The shared registry validates entries, searches them, separates core from advanced/specialist controls, formats platform-aware trigger labels, detects exact binding conflicts, and refuses actions whose capability or handler is missing.

The service never evaluates command text, executes scripts from catalog data, or treats a familiar shortcut as proof that an external application can be controlled. Destructive host actions must keep their existing confirmation gate.

Studio is the first consumer. Its catalog exposes all currently bindable Studio modes, tools, filters, vector/timeline controls, project operations, exports, and shared services through a searchable Command Deck. Other visual tools can provide their own catalogs without copying the search, gating, or conflict logic.

Focused verification:

```powershell
node shared/visual-actions/selftest.js
node tools/studio/selftest.js
node tools/studio/discovery-seam-review.js
```
