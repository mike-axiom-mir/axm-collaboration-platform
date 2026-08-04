# AXM Adapters & Translation Garden

This integrated `WORKING` tool contains the useful current code from the Run 105
Adapters & Translation intake:

- 90 local Python prototypes;
- 10 high-risk contract-only shadow locks;
- 68 shared core files;
- 74 typed JSON contracts;
- the source assurance and compatibility evidence;
- 419 bundled IANA TZif files for Windows portability.

The 90 selective ZIP packs were byte-for-byte duplicates of the copies inside
the current garden archive, so they remain in intake evidence and are not
installed again. Rollback and historical checkpoint carriers also remain in
intake evidence rather than the live runtime.

## Browse

Open `index.html` through the AXM Hub to search the 100-organ catalog. The page
is an inventory; opening it does not execute a Python organ.

## Machine use

List or inspect organs:

```powershell
python tools\adapter-translation-garden\translation-cli.py --list
python tools\adapter-translation-garden\translation-cli.py --describe 85
```

Run a working organ with an explicit JSON call envelope:

```powershell
python tools\adapter-translation-garden\translation-cli.py --run 85 --input '{"args":[{"a":1},{"a":2}],"kwargs":{}}'
```

Shadow organs refuse execution. Inputs are read from the named JSON value,
`@file`, or stdin (`-`). Results go to stdout; the CLI performs no network
access, installation, promotion, or native write.

## Verification

```powershell
node tools\adapter-translation-garden\selftest.js
```

The self-test intentionally hides host timezone data, proving the bundled
Windows fallback before it runs 972 installed-runtime tests. The 32 source
tests concerned only the 90 byte-duplicate selective ZIP carriers; those ran
as part of the 1,004-test pre-integration source suite and remain in intake
evidence instead of forcing 14 MB of duplicate archives into the live tool.
