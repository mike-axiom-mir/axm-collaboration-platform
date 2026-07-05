============================================================
AXM PROMPT VAULT — Workshop tool v0.1
============================================================

Status: TEST branch build
Branch: chatgpt/prompt-vault-v0-1

WHAT IT IS
  A local-first tool for storing prompt cards, reusable templates,
  model-fit tags, research notes, and handoff packets.

WHY IT EXISTS
  AXM needs a place for prompt-related building that is not scattered
  across chats. This tool keeps prompts visible, labeled, reusable,
  testable, and honest about model fit.

HOW IT FITS THE FOUNDATION
  - Loads the shared Workshop spine from /launcher/axm-foundation.js.
  - Loads global defaults from /launcher/axm-settings.js.
  - Loads the shared registry from /launcher/axm-registry.js.
  - Saves only through AXM.store.
  - Uses AXMGate.submit for meaningful actions.
  - Uses AXM.ask only for optional AI refinement/summaries.
  - Works without AI connected.
  - Registers prompt-vault.records as a tool-local prompt.source while open.
  - Routes exports through AXMRegistry when available.
  - Keeps direct /api/export and browser download as backup routes.

STARTING MODEL TAGS
  These are routing tags, not final truth:

  - chatgpt-visual
      Visual direction, image prompts, UI vibe, command cards,
      concept phrasing, broad synthesis.

  - claude-structure
      Code planning, careful docs, repair notes, step-by-step build
      instructions, long-form cleanup.

  - grok-scout
      Challenge prompts, rough outside reaction, beta-pressure tests,
      contradiction hunting. Treat output as material, not authority.

  - local-nova
      Offline analysis, safe local notes, lightweight review, private
      scratch work where internet/cloud is not needed.

  - generic
      Works for any model or human helper.

PROMPT TYPES
  - image-prompt
  - code-build
  - repair-check
  - research-scout
  - model-routing
  - handoff
  - doctrine-note
  - template
  - test-plan

NO FAKE DONE
  - Storing a prompt does not prove it is good.
  - Model tags are starting routing guidance, not canon.
  - Automatic prompt benchmarking is not built in v0.1.
  - Registry connector is page-runtime local, not permanent server-wide yet.

PROMOTION RULE
  TEST -> WORKING only after save/reload, export, import backup,
  handoff packet, model tag filtering, and local device testing pass.
============================================================
