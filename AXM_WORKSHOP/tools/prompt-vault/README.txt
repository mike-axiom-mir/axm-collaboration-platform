============================================================
AXM PROMPT VAULT — Workshop tool v0.1
============================================================

Status: TEST branch build
Branch: integration/full-workshop-test

WHAT IT IS
  A local-first tool for storing prompt cards, reusable templates,
  model-role tags, provider notes, research notes, and handoff packets.

CORE CORRECTION
  This is not just for ChatGPT.
  The vault is model-agnostic first.
  ChatGPT, Claude, Grok, local models, future models, and human helpers
  are possible routes, not cages.

HOW IT FITS THE FOUNDATION
  - Loads the shared Workshop spine from /launcher/axm-foundation.js.
  - Saves through AXM.store.
  - Uses AXMGate.submit for meaningful actions.
  - Works without AI connected.
  - Routes exports through /api/export when the Workshop server is running.

NO FAKE DONE
  - Storing a prompt does not prove it is good.
  - Role/provider tags are starting routing guidance, not canon.
  - Automatic prompt benchmarking is not built in v0.1.

PROMOTION RULE
  TEST -> WORKING only after save/reload, export, import backup,
  handoff packet, role filtering, provider-note clarity, and local
  device testing pass.
============================================================
