# AXM Model Lab — experimental

Model Lab runs the same small evidence-oriented probe suite through selected AXM model connectors. It records raw responses, latency, deterministic pass/fail signals, and concrete improvement proposals.

Boundaries:

- A score is a diagnostic signal, not truth, quality certification, or permission to promote a model.
- Runs are explicit and sequential at temperature 0. Nothing calls a model on page load.
- Raw responses are kept beside scores so a human can audit every conclusion.
- Results are stored locally through AXMStore and can be exported as JSON.
- Provider failures remain failures; the evaluator disables fallback so one model cannot silently answer for another.

Targets are discovered through the locked local bridge (`127.0.0.1:8787`). The bridge brokers both keyed cloud providers and an OpenAI-compatible local server (`127.0.0.1:1234`, such as LM Studio), so the model server does not need unsafe browser-wide CORS. Keys stay inside the bridge.

Run the pure scoring tests with:

```text
node selftest.js
```
