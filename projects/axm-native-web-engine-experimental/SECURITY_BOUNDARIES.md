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
  Policy and no active page controls.
- Artifact commands require explicit output paths, refuse source-path overwrite,
  refuse final-component symbolic-link outputs (including dangling links), and
  require `--force` for existing regular files.

## Not implemented

- OS process sandboxing, site isolation, trusted Browser Shell, Network Broker,
  Web Content process, decoder process, compositor, or AXM local-authority broker.
- Decompression, image/font/audio/video decoding, TLS, certificates, DNS,
  redirects, cookies, cache, downloads, navigation, or site-render hardening.
- Race-free privileged filesystem mediation; the CLI is an unprivileged local
  proof and must not be embedded in a privileged host as-is.
- Fuzzing, sanitizers, fault injection, or a hostile corpus beyond focused
  parser and output-escaping fixtures.

## Target boundary for later phases

```text
trusted Browser Shell
  -> explicit Network Broker
  -> untrusted Web Content process(es)
  -> separately bounded decoder process(es)
  -> renderer/compositor
  -> explicit AXM local-authority broker
```

Web content must never inherit provider keys, Mirror private state, Workshop
filesystem access, local execution, LAN discovery, native adapters, or project
state. Rust may reduce memory-unsafety exposure in future native components; it
must never be described as the sandbox itself.
