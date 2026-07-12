============================================================
AXM WORKSHOP — private local launcher body   (v0.1)
Steam-like, offline, for YOUR tools. This machine only.
============================================================

START (Windows)   double-click START_AXM.bat
WITH AI BRIDGE    double-click START_AXM_FULL.bat instead —
                  starts workshop + bridge together as two
                  separate windows (bridge = the only key
                  holder; close its window to cut AI off).
                  The /bridge folder is INCLUDED (v0.2, with the
                  lock) — just set ANTHROPIC_API_KEY, no copying.
                  No bridge / no key = workshop starts alone,
                  everything works, AI stays optional.
START (Mac/Linux) run ./start.sh
NEEDS             Node.js once (nodejs.org — the same install
                  the AI Bridge needs; one install covers both)
STOP              Ctrl+C or close the black window
THEN              browser opens http://127.0.0.1:8788 -> the Library

WHAT THIS BODY IS
  The launcher serves everything from ONE address, which means
  every tool finally shares the same spine storage naturally —
  the thing browser file-opening could never guarantee. The
  library builds itself from the filesystem: every folder in
  /tools with a manifest.json becomes a card. Drop in, appears.

ADD A TOOL
  1. Make a folder in /tools (e.g. /tools/studio)
  2. Put the tool's html inside (one file is fine)
  3. Add manifest.json — copy prehub's and change the values:
     { "id","name","version","status","entry","tags","notes" }
  4. Refresh the library.
  STATUS LABELS: TEST / WORKING / CANON / SHELL / BROKEN —
  edit them in the manifest with any text editor. Honest labels,
  your call, same meaning as scratch->canon in the pocket hub.

TWO BODIES, ONE SPINE (important)
  WORKSHOP (this) = PC body. Needs Node. Full powers: real
    folders, real exports, auto-discovery, shared storage.
  POCKET (/pocket) = phone body. Zero install, one-file, the
    hub+locker you already device-tested. Unchanged, still yours.
  Same foundation, same gates, same rules in both.

HONEST MIGRATION NOTE
  Browsers wall storage by origin. Things you saved while
  opening files directly (file://) live in THOSE walls — they
  will NOT appear at 127.0.0.1. Old prehub text: open the old
  way once, copy, paste into the workshop prehub. From then on
  everything lives in one shared home. One-time cost, said out
  loud rather than discovered.

THE SERVER (server.js — read it, it's short on purpose)
  - binds 127.0.0.1 ONLY: nothing outside this machine can
    reach it, ever. No accounts, no cloud, nothing phones home.
  - writes ONLY inside /exports and /logs. Never deletes.
  - refuses path tricks; sanitizes every export filename.
  - /api/health · /api/tools · /api/export · /api/log

FOLDERS
  /tools     the library (folder + manifest = card)
  /projects  yours — server never writes here
  /assets    shared media, served read-only
  /saves     manual save exports (live saves are in spine storage)
  /exports   Action Reports + tool exports (real files)
  /logs      append-only workshop.log
  /backups   yours, manual in v0.1: copy the whole folder
  /pocket    the phone body, zero-install, unchanged

THE BRIDGE LOCK (v0.2 — why other websites can't spend your key)
  While the bridge runs, websites in your browser can knock on
  localhost. v0.2 answers only two knocks: requests stamped as
  coming FROM THE WORKSHOP (browsers stamp origins; hostile pages
  can't fake it), or requests carrying the DOOR KEY from
  bridge/bridge-token.txt (a local file websites can't read).
  Everything else: 403, logged in bridge/bridge.log, key untouched.
  Also new: 30 asks/minute cap so nothing drains the key quietly.
  Habit that still helps: close the bridge window when not using AI.

LATER, BY CHOICE (not built, not pretended)
  The hosted/public body (your page-5 plan) would be this same
  shape served on a VM with accounts and consent — a SEPARATE
  body, opt-in, much stronger rules. Nothing in v0.1 phones
  anywhere; the door exists in the architecture, closed.

NO FAKE DONE (v0.1 gaps, named)
  manifest editor UI · cartridge import button · backups
  automation · cover art on cards · pending-merge review UI.
  Nothing here is canon but the core.
============================================================
