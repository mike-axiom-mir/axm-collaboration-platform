# Evidence routes — phone QA to Grounded Growth

Status: `TEST`

| Claim | Native evidence required | Current state |
|---|---|---|
| Campaign item exists | Exact `axm.voluntary-phone-qa-campaign/v1` digest and selected warning entry | PASS for `002-robo-pong` |
| Device candidate is complete | Native `axm.device-qa-evidence/v1` digest with all six phone observations | `NOT_RUN` |
| Candidate was accepted for separate review | Campaign review bound to the exact device receipt digest | `NOT_RUN` |
| Game warning is closed | Later passing `axm.game-package-verification/v1` report with the selected warning absent | `NOT_RUN` |
| Human usefulness is established | Admitted `axm.grounded-growth-human-handoff-package/v1` for the same capability, claim, scope, and game-manifest surface | `NOT_RUN` |
| Combined evidence is present | Both the device-behavior and human-usefulness keys pass | `NOT_RUN` |

The current route does not count ChatGPT mobile remote control, desktop source
inspection, candidate review alone, or warning closure alone as human benefit.
The human route remains voluntary, claim-scoped, and separate from the device
campaign. The gate performs no writes and cannot update a manifest or portfolio.
