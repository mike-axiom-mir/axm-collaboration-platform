# AXM local browser session contract

## Purpose

The local browser session is the first state-owning AXM Browser Shell slice. It
lets a human and a headless caller navigate the same explicitly allowed set of
local HTML files through one shared engine and one deterministic session state
machine. It does not authorize Internet intake or page-code execution.

## Explicit source authority

The trusted caller names one entry file and every additional allowed page on
the command line. A document link never grants file authority. Relative and
root-relative targets resolve only when the resulting regular file is already
in that explicit set.

Session inputs are bounded by default to:

- 16 explicitly allowed pages;
- 4 MiB combined source bytes, with the existing per-source bound also active;
- 128 history entries;
- 512 recorded session transitions; further actions are refused before mutation;
- 16 KiB per loopback action request.

Final-component symbolic-link page inputs, non-files, duplicate paths, unlisted
local targets, URL schemes, HTTP(S) targets, and query-bearing locators fail or
remain visibly held.

## Shared human/headless lineage

Every allowed page is processed by `src/engine.js` into its Source Record,
Document Tree, Page Model, and Structure Index. The immutable
`axm.web.local-browser-bundle/v1` binds the source, document, Page Model, and
Structure Index digests for every page and records all resolved and held links.

`src/browser-session.js` owns the sole navigation state machine. The headless
`session` command applies actions directly to it. The human shell sends the
same typed actions to the same process-owned object; it does not implement a
second navigation algorithm in browser code.

Supported actions are:

- activate a current-page link entry;
- open an exact bundled locator or same-document fragment; query components
  remain held until they have defined semantics;
- back and forward;
- reload;
- focus or scroll to a stable Structure Index entry.

The resulting `axm.web.local-browser-session/v1` records bounded history,
cursor, current lineage, focus/scroll references, every applied/held/no-op
transition up to the hard 512-transition lifecycle bound, reparse receipts, and
a deterministic session digest.

## Reload

Reload rereads and reparses every explicitly allowed source. It preserves
history by stable locator-derived page IDs, sanitizes stale focus/scroll entry
references against the new Structure Index, and emits before/after source
digests plus a `changed` verdict per page. A failed reparse does not replace the
previous in-memory bundle.

## Read-only session verification

`src/session-verifier.js` and `scripts/verify-session.js` provide a separate
read-only verification path for a serialized `axm.web.local-browser-session/v1`.
The verifier recomputes the bundle and session digests and checks structural
invariants across pages, entries, active and held link targets, history, current
state, transition sequence/continuity, reload counts, and the 512-transition
lifecycle bound.

The verifier accepts at most 8 MiB by default, requires valid UTF-8 and JSON,
bounds findings to 128, and emits
`axm.web.local-browser-session-verification/v1`. A verification PASS means only
that the supplied session record is internally consistent with these checks. It
does not prove the source pages were truthful, safe, standards-conformant, or
produced by a trusted machine.

The verification receipt is explicitly unable to mutate, install, promote, or
canonize anything. CI also retains a separately implemented verifier outside the
browser package so package code does not become its only judge.

## Trusted loopback shell

`serve-local` binds an ephemeral HTTP listener to `127.0.0.1` only and prints an
`axm.web.local-browser-host-receipt/v1`. Routes live beneath a random capability
path. The host checks the exact `Host` header, rejects cross-origin mutations,
accepts action mutations only as bounded `application/json`, exposes no CORS
permission, and sends no-store, no-sniff, no-referrer, frame-denial, and
deny-by-default Content Security Policy headers.

One CSP-hash-bound AXM controller script is active. It renders page-derived
values through DOM text nodes, never through HTML injection. Page scripts are
not executed, original forms are not controls, external resources are not
loaded, and only links whose target is already in the explicit local bundle get
an enabled activation control.

The loopback transport is trusted-shell transport, not the future Network
Broker and not evidence that hostile web input is isolated.

## Lifecycle and cleanup

Session state belongs to the local process. `Ctrl+C` or process shutdown closes
the listener and discards state. There is no persistence, restore after process
death, tab model, download, cookie/cache, service worker, page JavaScript,
external network, privileged host embedding, or OS content-process isolation.

Status remains `EXPERIMENTAL`; installation, promotion, merge, and canon require
their existing human gates.
