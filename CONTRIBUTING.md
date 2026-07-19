# Contributing to AXM Workshop

Thank you for helping test or improve AXM. The project values small truthful
claims over impressive but unverified ones.

## Before changing code

1. Read `AGENTS.md` and `AI_START_HERE.md` when using an AI collaborator.
2. Check the generated Technical Glasses view instead of assuming this README
   lists the current architecture.
3. Keep changes inside a clear module or ownership lane when other builders are
   using the same workspace.
4. Never commit secrets, local state, personal data, generated logs, saves,
   caches, or private intake material.

## A useful change includes

- the problem or goal;
- the smallest implementation that honestly addresses it;
- tests appropriate to the claim;
- visual or controller evidence when behavior is visual or interactive;
- explicit limitations and missing capabilities;
- provenance and permission for any supplied assets.

## Foundation verification

Run the full suite when practical:

```sh
npm test
```

The focused public foundation checks are:

```sh
node verify.js
node hub/hub-selftest.js
node hub/route-selftest.js
node hub/graft-selftest.js
node hub/skin-selftest.js
node hub/verify-plus.js
node tests/html-script-syntax-test.js
node tests/tool-forge-package-test.js
node tools/agent-tool-forge/selftest.js
node tools/evidence-desk/selftest.js
```

Tests prove only what they actually observe. A syntax pass does not prove a UI
looks right, and a screenshot does not prove persistence, transport, or
authorization behavior.

## Pull requests

Keep the title concrete. In the description, include:

- what changed and why;
- user-visible impact;
- verification performed;
- limitations or known failures;
- whether new assets, network access, permissions, or runtime state are added.

Do not silently rewrite another builder's work or use a green badge to hide a
missing verifier.
