# Evidence routes — voluntary physical-phone QA campaign

Status: `TEST`

| Claim | Native evidence | Current result |
|---|---|---|
| Current warning queue | Passing `axm.game-package-verification/v1` report, exact digest, and warning-count consistency | 17 physical-phone warnings across 19 games |
| Candidate-capture capability | Exact QA Lab manifest/contract plus its focused service and browser tests | Available under explicit `qa.run` permission |
| Campaign queue privacy | Sanitized output inspection and machine-path negative checks | Game id, slot, status, and digests only; no source paths or notes |
| Session boundedness | Deterministic session construction plus exact queue coverage assertions | Six optional sessions, maximum three games each |
| Human agency | Explicit policy and per-session stop/skip flags | Available by choice; never automatic |
| Candidate existence | Candidate receipt from the existing Lab tied to one game | Not supplied to this campaign |
| Candidate review | Explicit voluntary review record tied to candidate digest | Not supplied to this campaign |
| Physical-phone behavior | Real interaction journey on a separate physical phone | `NOT_RUN` |
| Human usefulness | Explicit human judgment after using the campaign and Lab | `NOT_RUN` |
| Warning closure | Per-game evidence review followed by the existing manifest/verifier gate | All 17 warnings remain open |

Source compilation, desktop responsive frames, ChatGPT mobile remote control,
candidate creation, and campaign completion cannot independently prove physical
phone behavior or clear a verifier warning.

