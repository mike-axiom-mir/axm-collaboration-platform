# AXM Code Language Organs v2.2 — 102-language evidence coverage receipt

Status: `TEST`

This receipt records a bounded CI result for PR #52. It does **not** rename
parser/validator/interpreter evidence into a literal compiler where the code body
is not a compiled programming language.

## Source binding

- Repository: `mike-axiom-mir/axm-collaboration-platform`
- Pull request: `#52`
- PR head branch: `codex/code-capability-fabric-language-organs-v1`
- PR head SHA: `bd34a25181f81255a57668eed72933482c4457bf`
- Stacked base branch: `codex/code-capability-fabric-python-source-v2.1`
- Stacked base SHA / PR #51 head: `085a4b4e32d626d212babbfa0c5fd1d33e8f7ff4`
- GitHub tested synthetic merge SHA: `b84e40ee2aba9bb38acfe2da9305d2d88ba35db7`

## Passing workflow runs

- `AXM Code Language Organs Gate` run `32692436496` — PASS.
- `AXM LEGO City Map Gate` run `32692436487` — PASS.

The Code Language Organs Gate retained `contents: read` only. External parser,
compiler and interpreter installs occurred in disposable GitHub-hosted runners;
they were not installed into AXM, promoted, or granted repository write authority.

## Exact 102-organ union result

The final fail-closed union gate loaded the exact 102 language organ descriptors
from the tested source and consumed three independently produced CI evidence
artifacts.

```text
expectedOrganCount: 102
coveredCount: 102
uncoveredCount: 0
stockNativeSmokePassCount: 32
grammarPackPassCount: 92
lastMilePassCount: 9
daxFullParserEvidence: true
coverageDigest: 5d6a614fbdd2710472f7af82f686889e95a08e8e4a7bacca317fab21c60961bb
```

The counts overlap. They are evidence layers, not an invalid `32 + 92 + 9`
claim. Coverage is the set union over the exact registry language IDs.

The union artifact ZIP SHA-256 reported by GitHub Actions is:
`42df2c9f870fdec9854d7005d95546766a7d1ac35f1ffafe5fca7da7a30e3a3e`.

Input artifact ZIP digests observed by the union job:

- stock native toolchain census: `752fb2c0b73d61f97150c44c98fd9214ff7511f176bd6031020680201177a0c6`
- Tree-sitter grammar census: `2c954af56836471335d4b94f80d486b289c871bb63106cf187e80f33884cf287`
- last-mile census: `86aa4d0b874f38cac2d579076654609e5e4e42b65abfe2a8180994da2b6a5dca`

## Evidence layers

### Stock native host probes

32 organs passed bounded smoke probes using toolchains already resolvable on the
GitHub runner. This layer includes compiler/parser/interpreter/validator classes
and records the exact command result instead of treating PATH presence as proof.

### Structural grammar pack

`tree-sitter-language-pack==1.14.3` parsed fixtures for 92 organs. The census
keeps direct language grammars separate from representation-level grammars such
as YAML, JSON or XML surfaces. A representation parse is not promoted into a
semantic correctness claim for the higher-level format.

### Nine-organ last-mile lane

The remaining last-mile lane passed all nine targeted organs:

- Vyper — compiler front-end
- Raku — compiler/interpreter syntax check
- ABAP — ABAPLint parser + syntax rule
- DAX — `dax-sql-parser==0.1.0` full ANTLR-backed parser path
- Power Query M — Microsoft Power Query parser AST path
- Stata — dedicated Tree-sitter Stata grammar pinned to commit `a47d1bb771d45da5058953f5d935759fac16d854`
- PLC Structured Text — IEC 61131-3 Structured Text Tree-sitter grammar
- COBOL — GnuCOBOL compiler syntax path
- T-SQL — SQLFluff parser with explicit `tsql` dialect

Other exact last-mile pins used by the passing workflow include:

- `vyper==0.4.3`
- `sqlfluff==4.3.0`
- `tree-sitter==0.26.0`
- `tree-sitter-iec61131-3-st==0.1.2`
- `@abaplint/cli@2.120.31`
- `@microsoft/powerquery-parser@0.19.0`
- `tree-sitter-cli@0.26.9`
- Ubuntu `gnucobol3` `3.1.2-5.1ubuntu1`
- Ubuntu `raku` `6.d.7` / Rakudo `2022.12`

The pinned Stata grammar is an **external CI test dependency only**. Its source is
not vendored into AXM by this PR and this receipt is not a code-admission or
license-relicensing decision.

## Gate behavior

`.github/ci/code-language-coverage-union.py` fails unless all of these are true:

1. the repository still exposes exactly 102 unique language IDs;
2. all evidence IDs belong to that exact registry;
3. every expected language ID has at least one passing bounded evidence path;
4. DAX specifically has `ANTLR_FULL_PARSER` evidence rather than lexer-only evidence;
5. `uncoveredCount` is zero.

Therefore future source or evidence drift cannot silently preserve a green
`102/102` claim.

## Truth boundary

This receipt supports this statement:

> All 102 AXM code-language organs have at least one bounded CI-proven structural
> parser, compiler/front-end, interpreter, validator or equivalent code-body
> handling path in the tested PR integration state.

It does **not** support any of these stronger statements:

- all 102 are literal compilers;
- all 102 have proven runtime semantic correctness;
- all toolchains are installed locally in AXM;
- all language ecosystems or versions are fully covered;
- grammar acceptance proves safe refactoring;
- a passing fixture proves arbitrary real-world programs will pass;
- external CI dependencies have been admitted into AXM source;
- installation, integration, promotion, publication or `CANON` authority exists.

The union report explicitly records:

```text
semanticCorrectnessClaimed: false
runtimeCorrectnessClaimed: false
allAreLiteralCompilersClaimed: false
authority: NONE
```

Capability is not authority. Mike remains the merge gate.
