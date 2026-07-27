# Contributing to AXM Workshop

Thank you for helping AXM become clearer, safer, and more useful. Small truthful
changes with strong evidence are preferred over broad unverified claims.

## Choose the right door

- Reproducible problem: open a **Bug report**.
- New direction or module: open a **Feature request**.
- Question or early design discussion: use **GitHub Discussions**.
- Security problem: use the
  [private vulnerability report](https://github.com/mike-axiom-mir/axm-collaboration-platform/security/advisories/new),
  never a public issue.

## Before changing code

1. Read [`AI_START_HERE.md`](AI_START_HERE.md) when using an AI collaborator.
2. Check manifests, contracts, generated registries, and executable tests rather
   than assuming the README is runtime authority.
3. Work inside one clear module or ownership lane.
4. Never commit secrets, personal data, local state, generated logs, saves,
   caches, downloaded runtimes, or private intake material.

## A useful change includes

- the problem or outcome;
- the smallest implementation that honestly addresses it;
- tests appropriate to the claim;
- visual or controller evidence when behavior is visual or interactive;
- explicit limitations and missing capabilities;
- provenance and permission for supplied assets.

## Verification

Run the focused public checks first:

```sh
npm run discovery:verify
node tests/beginner-launch-selftest.js
node verify.js
```

Run the complete configured suite when the scope justifies it:

```sh
npm test
```

A syntax pass does not prove visual quality. A screenshot does not prove
persistence, transport, or authorization. Match evidence to the claim.

## Pull requests

Keep the title concrete. Include:

- what changed and why;
- user-visible impact;
- checks performed and their exact verdicts;
- limitations or known failures;
- new assets, network access, permissions, or runtime state.

Do not silently rewrite another builder's work or use a green badge to hide a
missing verifier.
