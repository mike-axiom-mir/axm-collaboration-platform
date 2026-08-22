# AXM Local AI Delta Intake — 2026-08-15

`EXPERIMENTAL` · candidate knowledge only · no Foundation change

This capsule preserves the useful semantic deltas from the user-provided
`AXM_LOCAL_AI_DELTA_LOG_2026-08-15.txt` without treating that file's embedded
recommendations as authority. The source file remains user-owned and was not
copied, executed, deleted, installed, promoted, or canonized. Its stable
identity is recorded in `INTAKE_RECEIPT.json`.

## Intake result

Five subject areas have useful first-party support:

- Ollama changed the implicit `repeat_penalty` default from `1.1` to `1.0` in
  v0.32.10. This directly supports pinning runtime defaults in reproducible
  behavior fingerprints.
- Ollama v0.32.11–v0.32.13 added agent-shell launch integrations, web search in
  the compatible Responses API, Qwen 3.8 27B support, and Qwen developer
  instructions. These are compatibility candidates, not proof of model quality.
- llama.cpp builds b10429–b10434 added live metrics/slot access during decode,
  virtual iGPU devices, recurrent-state rollback work, and explicit
  `reasoning_effort` template plumbing.
- Anthropic's current pricing page confirms that Sonnet 5's `$2/$10` per-million
  input/output token price is now standard and the planned `$3/$15` increase
  will not occur.
- LM Studio's official material supports the broader LAN/authentication pattern:
  v0.4.20 added an enterprise internal-network model endpoint, while its native
  API supports token configuration.

One claim group remains held:

- LM Studio v0.4.21 and the claimed local-server-key plus mmap/mlock/direct-I/O
  release bundle could not be confirmed from LM Studio's current official
  changelog. Do not attach those details to v0.4.21 until the first-party release
  page is visible and pinned.

## Reusable AXM knowledge

The durable insight is that model behavior is a function of more than weights:

```text
observed behavior
= model identity
+ runtime build
+ resolved chat template
+ explicit sampling defaults
+ reasoning controls
+ context/session state
+ enabled capabilities
+ endpoint/network policy
```

A verification-sensitive runtime fingerprint should therefore record, when
supported:

- model identifier and hash;
- runtime and exact version/build;
- requested and resolved template identity;
- temperature, top-p, top-k, repeat penalty, seed, and context size;
- requested reasoning mode/effort separately from observed behavior;
- slot/session identity and context use;
- relevant health metrics;
- endpoint bind mode, authentication mode, and network-capability switches.

Engine defaults must not be relied on for benchmarked or authority-sensitive
runs. Network tools, including web search exposed through a compatible API,
remain explicit capabilities and default off in isolated-local mode.

## Bounded route

1. `P1 CANDIDATE` — extend the runtime fingerprint/behavior ledger contract.
2. `P1 CANDIDATE` — specify localhost-default and trusted-LAN opt-in endpoint
   modes with authentication and runtime identity logging.
3. `P1 CANDIDATE` — pin sampling parameters for benchmark and verifier paths.
4. `P2 CANDIDATE` — evaluate llama.cpp reasoning and live-metrics adapter seams.
5. `P2 CANDIDATE` — add Ollama Responses/agent-shell compatibility fixtures
   with web access disabled unless explicitly granted.
6. `P3 CANDIDATE` — evaluate Qwen 3.8 27B and Muse Glimmer only when suitable
   local hardware and repeatable tests are available.

This route does not install a runtime, download a model, expose a LAN endpoint,
enable web search, edit the Foundation, register an organ, or grant authority.

## First-party sources checked

- [LM Studio 0.4.20 changelog](https://lmstudio.ai/changelog/lmstudio-v0.4.20)
- [LM Studio API changelog](https://lmstudio.ai/docs/developer/api-changelog)
- [Ollama v0.32.10](https://github.com/ollama/ollama/releases/tag/v0.32.10)
- [Ollama v0.32.11](https://github.com/ollama/ollama/releases/tag/v0.32.11)
- [Ollama v0.32.12](https://github.com/ollama/ollama/releases/tag/v0.32.12)
- [Ollama v0.32.13](https://github.com/ollama/ollama/releases/tag/v0.32.13)
- [llama.cpp b10429](https://github.com/ggml-org/llama.cpp/releases/tag/b10429)
- [llama.cpp b10430](https://github.com/ggml-org/llama.cpp/releases/tag/b10430)
- [llama.cpp b10431](https://github.com/ggml-org/llama.cpp/releases/tag/b10431)
- [llama.cpp b10434](https://github.com/ggml-org/llama.cpp/releases/tag/b10434)
- [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)

The attached source's architectural interpretations are preserved as candidate
reasoning. Vendor quality/performance descriptions are not AXM benchmark proof.

