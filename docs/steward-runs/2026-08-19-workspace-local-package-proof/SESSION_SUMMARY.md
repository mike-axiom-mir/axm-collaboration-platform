# Sealed session summary

Session: `workspace-local-package-proof:2026-08-19`

The required Tool Forge package proof was confirmed to persist an
`EXPERIMENTAL`, uninstalled ZIP through Windows OS temp on C. The product
package builder itself remained pure and unchanged; the defect was isolated to
the repository test's proof-storage route.

The test now uses a unique transient directory under the current Workshop's
`state/test-scratch/agent-tool-forge` lane, reads the archive back byte-for-byte,
records its byte length and SHA-256, and removes the run directory before
returning. The route is workspace-local rather than hard-coded to one drive.

Focused verification passed 21 checks, including execution with cwd, `TEMP`,
and `TMP` all pointed at C-temp. All ten repository-required Node checks passed.
Both observations found zero new C-temp proof ZIPs and zero remaining D scratch
run directories.

The observed C-temp baseline is 174 matching ZIPs. One exact hash-identified
file is the diagnostic reproduction from this session; deletion was refused by
the execution policy. It remains non-canonical and uninstalled. Historical
cleanup was not inferred from the routing repair.

Integrity:

- source segment: `session.jsonl`
- structural seal: `session.seal.json`
- SHA-256: `41ca7b8e36280539755cf02976e8a21ba9c578efac477c8f6e224763d150a47d`
- events: 6 valid JSON lines, 0 invalid lines

