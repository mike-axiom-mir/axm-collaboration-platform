============================================================
AXM WORKSHOP v1.9.1 + TOOL FACTORY v0.2
PUBLIC-SAFE · EXPERIMENTAL · LOCAL-FIRST
Founder / public collaboration name: Mike Tobi
============================================================

WHAT THIS BODY IS
A modular local Workshop where human-facing Hub screens and machine-facing
adapters can use the same bounded cores. The Workshop serves files from one
local origin, discovers modules from /tools, keeps AI optional, and records
workspace actions without archiving conversations.

QUICK START
  Windows Hub:       START_HUB.bat
  Windows launcher:  START_AXM.bat
  Windows + bridge:  START_AXM_FULL.bat
  macOS/Linux Hub:   ./start-hub.sh
  macOS/Linux + AI:  ./start-full.sh

Node.js is required. The server binds to 127.0.0.1 by default.

IMPORTANT LOCAL-FOLDER RULE
Extract to a fully local folder. Do not rely on an online-only OneDrive Desktop
placeholder. The Hub was manually proven through an alternate fully local BAT
route; the OneDrive Desktop attempt failed at the environment/file-availability
layer rather than the Hub logic.

DISCOVERY
The current public-safe audit found 23 manifest-bearing tool folders:
  - 22 discoverable tools/modules
  - 2 underscore template shelves intentionally skipped

LEGAL WORKSHOP STATUS LABELS
  EXPERIMENTAL · TEST · WORKING · CANON · SHELL · BROKEN

Using or testing a module does not make it canon. Promotion remains an explicit
review decision.

TOOL FACTORY v0.2
Human door:
  Hub screen -> tools/agent-tool-forge/index.html -> forge-core.js

Machine door:
  host adapter -> tools/agent-tool-forge/machine.js -> forge-core.js

Both doors share normalized draft, validation, rendering, and fingerprint logic.
The machine adapter requires a host-supplied authorization decision and refuses
unknown actions, including install.

Factory capabilities:
  YES  draft bounded packages
  YES  validate required fields and boundaries
  YES  render a complete file set
  YES  deterministic SHA-256 fingerprints
  YES  preview every generated file
  YES  local save/resume through AXM Foundation
  YES  export actual module ZIP or review JSON

Governed boundaries:
  NO   install
  NO   overwrite
  NO   execute generated code
  NO   delete
  NO   promote
  NO   canonize

Every generated manifest starts EXPERIMENTAL. LOW / MEDIUM / HIGH risk is a
separate field and never substitutes for lifecycle status.

PUBLIC-SAFE BRIDGE
No real API keys or bridge token ship here. Keys are read only from environment
variables. When the bridge first starts without bridge-token.txt, it generates
a fresh random token locally. Token and runtime logs are excluded by .gitignore.
See bridge/BRIDGE_SETUP.txt.

MAIN FOLDERS
  /tools       module library
  /hub         operational one-inner-screen Hub
  /launcher    launcher body
  /bridge      optional local AI bridge
  /prompts     identity/method/wisdom assets; intentionally retained publicly
  /assets      shared local assets/templates
  /exports     local generated evidence and exports; examples only in Git
  /logs        local action log location; examples only in Git
  /projects    user-controlled project files
  /saves       user-controlled exports/checkpoints
  /backups     user-controlled backups
  /pocket      zero-install phone body

PRIVACY MODEL
The public package keeps project names, module names, Mike Tobi attribution,
Tilburg context, and identity-wisdom material. It removes real secrets, real
bridge tokens, private runtime histories, and machine-specific paths.

CONTACT / COLLABORATION
No email address is published. Search for Mike Tobi and the AXM raw Facebook
development log to follow the build or propose collaboration.

CURRENT BOUNDARY
WORKING PROOF · PUBLIC-SAFE CHECKPOINT · NOT CANON · NOT PRODUCTION
============================================================
