# Security boundaries

The Internet is hostile input. This Phase 1 core therefore starts offline and
records the gap between memory-safe-ish implementation choices and real
isolation.

## Implemented in this slice

- Local bytes are bounded before UTF-8 decoding.
- Invalid UTF-8 fails visibly.
- Token count, attributes per element, and open-tree depth are bounded.
- JavaScript, CSS, resource, iframe, canvas, media, and unknown elements are
  inert data; held/unsupported features are reported.
- No `eval`, dynamic module loading, VM execution, provider call, socket,
  listener, URL fetch, browser storage, Workshop state, shell, or native adapter
  route exists in the core.
- Network-looking CLI inputs fail with a typed held/unsupported result.
- Source bytes are preserved in a digest-bound Source Record. The CLI can omit
  raw bytes from an envelope while keeping a digest/length binding.
- Machine paths are not resolved or added by the core; the Source Record carries
  only the caller-supplied locator.

## Not implemented

- OS process sandboxing and site isolation.
- A trusted Browser Shell, Network Broker, Web Content process, decoder process,
  compositor, or AXM local-authority broker.
- Decompression, archive, image, font, audio, video, TLS, certificate, DNS,
  redirect, cache, cookie, download, or navigation hardening.
- Resource budgets backed by real host metrics.
- Fuzzing, sanitizer, fault-injection, or adversarial corpus beyond small parser
  fixtures.

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
