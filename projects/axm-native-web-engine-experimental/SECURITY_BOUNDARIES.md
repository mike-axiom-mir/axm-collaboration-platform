# Security boundaries

The Internet is hostile input. This experimental core remains offline and
separates data preservation from execution authority.

## Implemented in this slice

- Local bytes are bounded before fatal UTF-8 decoding.
- Token count, attributes per element, open-tree depth, semantic item count,
  derived text, viewport, and canvas height are bounded.
- JavaScript, CSS, resources, iframes, canvas, media, and unknown elements are
  inert data; held/unsupported features stay visible.
- No `eval`, VM execution, dynamic module loading, provider call, socket,
  listener, URL fetch, browser storage, Workshop state, shell, or native adapter
  route exists in the core.
- Network-looking CLI inputs fail with typed held/unsupported results.
- Source bytes remain preserved under an exact SHA-256/length binding. Headless
  envelopes may omit raw bytes while retaining the binding.
- Structure Layout and Display List carry source/Page Model lineage. The
  Modification Ledger records identical before/after source digests,
  `pageCodeExecuted: false`, and `networkUsed: false`.
- The SVG renderer accepts only rectangles, lines, and escaped text; it emits no
  scripts, anchors, events, foreign objects, or external resource references.
- The HTML snapshot wraps that SVG with a deny-by-default Content Security
  Policy and adds semantic HTML plus trusted same-document outline anchors.
  Original page links and forms remain inert text; no page script runs.
- Artifact commands require explicit output paths, refuse source-path overwrite,
  refuse final-component symbolic-link outputs (including dangling links), and
  require `--force` for existing regular files.
- Local sessions accept only the entry file and additional regular files named
  explicitly by the caller. Links resolve against that closed set; unlisted
  files, schemes, and HTTP(S) targets stay held. Reload reparses the same
  authorized set and records per-source before/after digests.
- `serve-local` binds an ephemeral listener to `127.0.0.1`, scopes routes under
  a random capability path, validates the exact Host header, and requires every
  mutation request to carry the exact loopback shell Origin. Missing Origin,
  cross-origin mutation, non-JSON action, oversized action, and unknown routes
  fail before session mutation. The host emits no CORS permission.
- Loopback HTML and JSON responses use no-store, no-sniff, no-referrer, frame
  denial, `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-origin`, and a Permissions Policy denying
  camera, microphone, geolocation, display capture, USB, serial, HID, and
  Bluetooth. The shell CSP includes `frame-ancestors 'none'` in addition to its
  deny-by-default resource, worker, base, and form restrictions.
- The human shell runs one CSP-hash-bound package controller. Page-derived
  values are assigned as DOM text. Page scripts, forms, resources, and unlisted
  link targets do not inherit shell execution authority.
- `axm.web.local-browser-shell-policy/v1` exposes those trusted-shell controls as
  a deterministic read-only policy receipt before any listener starts. It is
  derived from the same host helpers, binds the controller/CSP and response
  policy, and explicitly grants no mutation, network, install, promotion, or
  canon authority. A policy receipt describes package intent; it is not proof
  that a specific host instance is running or isolated.
- Serialized local Browser Sessions can be checked by a read-only verifier that
  recomputes bundle/session digests and checks bounded structural invariants.
  Verification does not grant source truth, trust, install, promotion, canon,
  or mutation authority; CI retains a separately implemented counter-verifier.

## Not implemented

- OS process sandboxing, site isolation, native Browser Shell, external Network Broker,
  Web Content process, decoder process, compositor, or AXM local-authority broker.
- Decompression, image/font/audio/video decoding, TLS, certificates, DNS,
  redirects, cookies, cache, downloads, external navigation, or site-render
  hardening.
- Race-free privileged filesystem mediation; the CLI is an unprivileged local
  proof and must not be embedded in a privileged host as-is.
- Fuzzing, sanitizers, fault injection, or a hostile corpus beyond focused
  parser and output-escaping fixtures plus independent source/artifact sentinels.

## Target boundary for later phases

```text
trusted Browser Shell
  -> explicit Network Broker
  -> untrusted Web Content process(es)
  -> separately bounded decoder process(es)
  -> renderer/compositor
  -> explicit AXM local-authority broker
```

The current loopback shell is an experimental trusted-shell adapter in front of
local bound sources. Same-origin headers and exact-Origin mutation checks harden
that trusted-shell surface; they are not a substitute for the held Network
Broker or an untrusted Web Content process and do not close either isolation
gate.

Web content must never inherit provider keys, Mirror private state, Workshop
filesystem access, local execution, LAN discovery, native adapters, or project
state. Rust may reduce memory-unsafety exposure in future native components; it
must never be described as the sandbox itself.
