# Fabrication Readiness Lab — visual verification

Date: 2026-07-22  
Verdict: **PASS**

- **Claim:** the page visibly distinguishes an advertising signal from verified fabrication readiness and cannot initiate hardware action.
- **Surface / route:** `http://127.0.0.1:8788/tools/fabrication-readiness-lab/index.html`
- **Visual backend:** browser primary; no fallback required.
- **Viewport:** current desktop browser viewport.
- **Baseline evidence:** page rendered with `No printer attached`, `UNVERIFIED ADVERTISING`, `No purchase decision`, `TECHNICAL REVIEW REQUIRED`, and a disabled bounded-package button.
- **Action:** supplied all five synthetic evidence/review declarations and selected **Evaluate readiness** once.
- **Expected visible change:** the bounded-package action becomes available while automatic execution remains forbidden.
- **Observed:** status changed to `BOUNDED EXTERNAL TEST PACKAGE READY`; the page retained `AUTOMATIC EXECUTION — FORBIDDEN`, `HARDWARE COMMAND — NONE`, and `PURCHASE DECISION — NONE`.
- **Second action:** selected **Prepare one bounded test package** once.
- **Observed result:** a typed `axm.fabrication-bounded-test-package/v1` preview appeared; no navigation, download, network action, printer connection, or hardware command occurred.
- **Console:** no error entries.
- **Named seam:** none in the bounded desktop journey. Responsive/mobile rendering remains separately unobserved.
- **Temporary capture:** no local recording or screenshot file was created; browser frames were ephemeral.
- **Cleanup:** complete; no temporary paths to delete.
- **Next cheapest test:** when an actual service or makerspace is selected, validate one vendor-neutral exported file independently before considering any hardware adapter.
