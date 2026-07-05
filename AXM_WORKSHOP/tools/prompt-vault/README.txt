============================================================
AXM PROMPT VAULT — Workshop tool v0.1
============================================================

Status: TEST branch build
Branch: chatgpt/prompt-vault-v0-1

WHAT IT IS
  A local-first tool for storing prompt cards, reusable templates,
  model-role tags, provider notes, research notes, and handoff packets.

WHY IT EXISTS
  AXM needs a place for prompt-related building that is not scattered
  across chats. This tool keeps prompts visible, labeled, reusable,
  testable, and honest about model fit.

CORE CORRECTION
  This is NOT just for ChatGPT.
  The vault is model-agnostic first.
  ChatGPT, Claude, Grok, local models, future models, and human helpers
  are possible routes, not cages.

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

STARTING ROLE TAGS
  These are routing tags, not final truth:

  - any-model
      General prompt that can be used by any capable model or human helper.

  - visual-generator
      Image prompts, visual direction, UI vibe, command cards,
      composition, style sheets.

  - structure-coder
      Code plans, architecture, docs, refactors, repair notes,
      implementation checklists.

  - research-scout
      Research questions, outside checks, contradiction hunting,
      source gathering, pressure tests.

  - challenge-model
      Adversarial review, beta-pressure tests, weak-point hunting.
      Output is material, not authority.

  - local-private
      Offline/local review, private scratch notes, low-risk analysis
      where cloud is not needed.

  - human-helper
      Clear copy-paste instructions for a person, teammate, tester,
      or future contributor.

  - future-model
      Reserved for new models not known yet. Route by observed strength,
      not brand loyalty.

  - provider-openai / provider-anthropic / provider-xai
      Optional provider notes for cases where a specific provider matters.
      They are secondary, not the root structure.

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
  - evaluation

NO FAKE DONE
  - Storing a prompt does not prove it is good.
  - Role/provider tags are starting routing guidance, not canon.
  - Automatic prompt benchmarking is not built in v0.1.
  - Registry connector is page-runtime local, not permanent server-wide yet.

PROMOTION RULE
  TEST -> WORKING only after save/reload, export, import backup,
  handoff packet, role filtering, provider-note clarity, and local
  device testing pass.
============================================================
