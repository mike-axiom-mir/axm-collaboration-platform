AXM HUB SHELL — v1.0  (Opus handoff build)
Outer stable. Inner flexible.
============================================================

WHAT THIS IS
------------
A stable outer shell that hosts modules in a center viewport, the way
GameHub switches games. The shell owns the chrome (top bar, sidebar
switcher, bottom action/status log, shared settings/permission/export
screens, error fallback, save/reopen). Modules own only their insides.

Modules load by <iframe> from /tools/<folder>/<entry> — the SAME URL the
old launcher opened in a new tab. So every existing tool works inside the
hub UNCHANGED. Nothing in your project was rewritten; the spine hash is
untouched (418f9ce4fb050602) and your verifier still exits 0.

HOW TO RUN
----------
1. Unzip these files over your AXM_WORKSHOP/ folder (they only ADD files).
2. Start the workshop as usual (START_AXM.bat / start.sh — Node server on
   127.0.0.1:8788). No server change was needed; it already serves /hub.
3. Open:  http://127.0.0.1:8788/hub/
   (Your existing launcher at / still works exactly as before — the hub is
    an addition, not a replacement. Pick whichever you prefer.)

MODULES ARE OPT-IN (add only what you need)
-------------------------------------------
You don't carry every module. The top-bar "＋ Modules" button (and the
dashed card on Home) opens a catalog of every AVAILABLE module with Add /
Remove. Only ADDED modules show in the sidebar — but an added module is
part of the ONE system (same top bar, log, settings), not a separate app.

- First run seeds the added-set with everything already discovered, so an
  upgrade never makes a tool vanish (no-loss). After that, your choice rules.
- Removing a module hides it and KEEPS its saved data, so adding it back
  restores it. Removing the module you're in drops you to Home.
- The added-set persists (localStorage axm.hub.enabled) and survives reopen.
- A minimal install that ships only the shell + template starts small; you
  grow it by adding modules.

ADD / REMOVE YOUR OWN CHECKS (Verifier module)
----------------------------------------------
The core gate (verify.js) is your safety floor — spine, manifests, DOM
order, trust files. It stays locked: you cannot delete those, because a
check you can silently switch off stops catching drift.

On top of that you own a config file, verify.config.json, for YOUR checks.
Open the Verifier module in the hub to add/remove them with a form (no
code editing), then Download verify.config.json and drop it in the project
root. Check kinds: file-exists, file-contains, json-has-field,
manifest-present. Removing a check you added is fine — it's yours.

Run the combined gate:
  node hub/verify-plus.js
It runs your REAL verify.js first (unchanged), then your own checks. Core
failures OR your-check failures fail the run. verify.js alone still works
exactly as before.

Acknowledged warnings: a core WARN can be annotated with a reason in
verify.config.json (acknowledgedWarnings). It still prints — it is never
hidden or turned into a pass. Non-hidden by design.

Retiring a core check (as tech changes):
A core check can be RETIRED when it's become obsolete — but never silently.
In the Verifier module, paste a phrase from the FAIL/warn line (click your
last report to fill it), give a REASON (required), and confirm. A retirement:
  - still PRINTS in every verify-plus run, reclassified RETD with your reason;
  - is announced in a banner at the top so you can't forget it's off;
  - is appended to exports/verify-retirements.log (permanent provenance);
  - can be un-retired anytime;
  - with NO reason is ignored — it cannot become a silent kill-switch.
Only then is that line excluded from the fail count. Retire ≠ hide.

LAYERS (spaces for modules)
---------------------------
Modules group into layers. Three ship by default and you own them after that:
  Open       default, no door, human
  Private    a door sign for collaborators (see below)
  AI-Native  machine-native modules, HIDDEN from the sidebar by default

Top bar → ▤ Layers: rename, delete, create new named layers (Entertainment,
Creative, whatever), set/remove a door sign, hide/show a layer, and assign
modules. Deleting a layer moves its modules to the first layer — never
deletes them. A module lands in a layer by: your assignment > its manifest
"layer" > its manifest "audience":"machine" (auto-routes to AI-Native, so a
human never has to sort machine tools) > Open. An unknown layer id falls back
to Open rather than making a module disappear.

WHY AI-NATIVE EXISTS
  So machine-only modules — things a human has no use for, and a future
  hosted/remote setup — don't clutter a human's sidebar. It is a NOISE
  FILTER, not a privilege boundary.

THREE RULES, ALL ENFORCED IN CODE AND TESTED
  1. A DOOR SIGN IS NOT A LOCK. The passphrase only stops someone walking in
     by accident. It is not security: files sit on this machine, the check
     runs in the browser. The phrase is stored hashed so a casual glance
     doesn't reveal it — that's all. Unlocks are session-only.
  2. HIDDEN IS NOT SECRET. A hidden layer keeps machine modules out of the
     way, but the sidebar always reports "N machine modules hidden" and one
     click shows them. Nothing disappears without saying so.
  3. A LAYER NEVER GRANTS ANYTHING. Layers organise; passports authorise.
     A hidden machine module goes through the exact same permission gate as
     anything in Open — same-gates root. The self-test asserts identical
     grants across all layers, and that a hidden module is still denied an
     undeclared permission. If a layer ever changes what a module may do,
     that's a bug.

RESERVED, NOT BUILT
  Each layer carries a "host" field (currently always "local"). It is a
  placeholder for a future hosted/remote layer and is IGNORED by every code
  path today — declared so the shape exists, not faked into looking done.
  A test asserts it changes nothing.

STARTING + RUNNING WITHOUT HUNTING FOR FILES
--------------------------------------------
Start straight into the hub: double-click START_HUB.bat (Windows) or run
start-hub.sh (mac/linux). Same as your START_AXM.bat but it opens
/hub/ instead of the old launcher. Your original launchers are untouched.

Run checks from inside the hub: add the Runner module (＋ Modules → Add).
Buttons for Run verify, Run verify-plus, Health check — output shows inline,
no terminal. This needs one small route in server.js; it is OPT-IN and was
NOT added for you. See SERVER_PATCH.txt for the exact block to paste and why
it's safe (allowlist: verify / verify-plus / health only — no arbitrary
commands, no shell). Until you paste it, the Runner shows a note explaining
this and everything else keeps working.

Note: starting the server itself can't come from inside the hub — the hub is
a page the server serves, so the server must already be up. That's what the
START_HUB launcher is for.

THE MODULE PASSPORT (contract)
------------------------------
A first-class module includes ONE small script — /hub/axm-hub-module.js
(NOT the spine) — and announces itself:

  AXMHub.ready({ id, name, version, hubApiVersion:'1.0',
                 icon, permissions:[], settingsSchema:{...},
                 savesState, handlesShutdown });

Then it can use:
  AXMHub.log(msg)                append to the shared action log
  AXMHub.settings.get()/set()    per-module settings the hub persists
  AXMHub.permission.request(p)   only granted if declared in the passport
  AXMHub.save(state)             checkpoint; survives reopen
  AXMHub.onInit(fn)              receive {settings, moduleState, granted}
  AXMHub.onShutdown(fn)          flush before the hub switches away/closes

A legacy tool that includes none of this STILL loads and renders — it just
gets a manifest-derived passport with no elevated permissions. No blank
screen either way: a failed/empty frame shows a recovery card, not a void.

Copy tools/_module-template/ to start a new module (drop the underscore,
give it a unique id).

STATUS LABELS (hub lifecycle — separate from a manifest's build status)
-----------------------------------------------------------------------
CLAIMED           appears in the registry, not yet opened/verified
NEEDS VERIFY      opened, checks not yet run (shown as TEST in the sidebar)
WORKING           Test Room's six checks passed for it
SAVED CHECKPOINT  its state was persisted and survived a reload
TEST-HOLD         parked at the merge gate
CANON CANDIDATE   proposed for canon (human sets this)

These are tracked by the shell (localStorage axm.hub.life.<id>) and shown
as a badge in the sidebar. They do NOT touch the manifest "status" field,
which stays in the verifier's legal set (TEST/WORKING/CANON/SHELL/BROKEN).

VERIFICATION (do not trust "it appeared once")
----------------------------------------------
Browser: open the hub, switch to Test Room, click "Run all checks". It runs
the six criteria live and shows PASS/FAIL:
  1 files are saved            4 module opens without blank screen
  2 hub can restart/reopen     5 settings survive switch away & back
  3 module list survives reload 6 action log records what happened
For the reopen checks: click "Arm reopen test", then fully reload the hub
(F5) and Run again — check 2 flips to PASS when the armed value survived.
On all-six-pass, Test Room tells the shell to mark itself WORKING.

Node (logic half, no browser needed):
  node hub/hub-selftest.js   -> persistence round-trip + passport + reducer
  node verify.js             -> your whole-project audit still exits 0

WHAT WORKS NOW
--------------
- One shell hosting all 15 existing tools in-viewport by iframe.
- Sidebar switcher built live from /api/tools; Home screen from the registry.
- Bottom action/status log; shared settings, permission, export overlays.
- Persistence: last module, per-module settings, per-module state, lifecycle,
  cached module list, and the action log all survive reopen (localStorage).
- Blank-screen guard + error/recovery card.
- postMessage bridge + pure reducer; permissions gated to the passport.
- Node self-test 19/19 PASS; project verifier 71/71 PASS, spine intact.

WHAT IS NOT FINISHED YET (honest)
---------------------------------
- The mockup's Bridge / Templates / Logs-Memory are shown as target modules
  but don't exist as tools in /api/tools yet, so they don't appear until
  built. The shell will list them the moment their folders exist.
- Existing legacy tools don't yet call AXMHub.ready, so they show as CLAIMED
  and expose no settings schema until each opts into the bridge (one line).
- Visual polish is aligned to your tokens, not a pixel clone of all 5 screens.
- onShutdown flush-before-switch is wired on the child side; the shell asks
  for it on close but not yet on every away-switch (safe: state also saves on
  explicit AXMHub.save).
- All persistence is localStorage (per-browser). Cross-device sync is out of
  scope for this shell.

FILES ADDED (nothing existing modified)
---------------------------------------
  hub/index.html            shell chrome + shared-screen markup
  hub/hub-tokens.css        palette (mirrors launcher tokens.css)
  hub/module-contract.js    passport schema + validation + pure reducer
  hub/hub-shell.js          HubStore + registry + DOM controller
  hub/axm-hub-module.js     child bridge shim (modules include this)
  hub/hub-selftest.js       Node logic test (0/1 exit)
  hub/HUB_SHELL_README.txt  this file
  tools/_module-template/   copy-me starter module (underscore = shelf)
  tools/hub-test-room/       live six-check verifier module ("Test Room")
