# AXM Verification Proof Lab

This tool makes the useful part of the curated 99-organ verification intake
callable from the AXM Hub and from a local CLI.

Version v0.3 also binds the internal, read-only service seam for all one hundred
Public Proof contracts. Fifty-two Run 39-eligible seeds can be validated;
forty-eight research/dependency-held seeds produce hard refusal receipts. The
metadata-only overlap map preserves reviewed Batch 1 ownership and leaves weak
or genuinely new ownership unassigned.

The original v0.2 seam for the ten approved Public Proof Run 40 Batch 1
contracts remains intact. It validates preserved
schemas and forty synthetic fixtures, quarantines privacy canaries, and checks
deterministic rollback without exposing a live HTTP execution route or granting
publication, runtime-proof, approval, or CANON authority.

- 91 memory-only organs accept bounded JSON call envelopes.
- 5 organs that require caller-supplied Python callables remain guarded.
- 3 organs that can write to caller-selected paths remain guarded.
- The source timezone organ remains held outside the curated intake until its
  dependency contract is repaired.

The six featured examples cover verdict normalization, claim-to-proof routing,
evidence sufficiency, proof freshness, test-gap detection, and release-gate
packet assembly. They are immediately runnable in the browser workbench.

## CLI

```powershell
python tools\verification-proof-lab\verification-cli.py --list
python tools\verification-proof-lab\verification-cli.py --describe axm.verify.verdict-state-normalizer
$call = @{construct=@{args=@();kwargs=@{}};call=@{args=@('PASS','selftest');kwargs=@{}}} | ConvertTo-Json -Depth 10 -Compress
$call | python tools\verification-proof-lab\verification-cli.py --run axm.verify.verdict-state-normalizer --input -
```

Every result remains `TEST_HOLD`, `authority: NONE`, and `canon: false`.
