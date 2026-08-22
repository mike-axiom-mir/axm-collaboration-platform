# Frontier audit — v4.7

Status: `TEST`

## Starting evidence

The clean starting point was v4.6 commit
`d8e6644ce9d5bfd54fd0f122ebd9ebccbb2f7849`. Its readiness diagnostic
redactor covered known and residual machine paths at both production writers and
readiness ingestion. Five high-confidence synthetic credential surfaces—an
authorization header, named environment assignment, CLI flag, URI user-info,
and access-token query—were byte-unchanged through the exact parent blob. The
current twelve retained failure tails contained no recognized credential
indicators.

## Chosen seam

The highest-value bounded seam was preventive redaction of recognized
credential evidence before failure diagnostics become durable. It directly
advances the repository rule against committing API keys and authorization
headers while reusing the existing sanitizer boundary.

The accepted surface is deliberately finite:

- authorization, proxy authorization, API-key, auth-token, cookie, and
  set-cookie header values;
- recognized environment, JSON/config, npm-style, and CLI credential names;
- URI user-info plus recognized query or fragment assignments;
- PEM private-key blocks;
- selected OpenAI, GitHub, Slack, Google, AWS, Stripe, and JWT-like
  fingerprints.

The retained marker makes redaction observable. Ordinary prose such as “token
count” or “secret ballot,” relative diagnostics, URL hosts/paths, raw-output
digests, and all existing tools-index result semantics remain available.

## Alternatives held

Arbitrary secret discovery was rejected as a completion claim: novel,
encoded, split, compressed, encrypted, or context-dependent credentials cannot
be proven absent by a bounded pattern set. Retrospective Git rewriting was also
outside this lane and would be destructive governance work.

An interrupted-retirement cancellation or withdrawal action remains deferred.
Safely composing it with retirement recovery requires serialized settlement to
avoid cancellation/recovery races; adding an uncoordinated state toggle would
weaken rather than improve the operation boundary.

## Remaining frontier

Still open: arbitrary and encoded secret detection, arbitrary diagnostic fields,
ignored or external histories, historical rewriting, full-repository privacy
audit, protected cross-process diagnostic custody, real review and human
participation, human benefit, learning, consequential adoption, promotion,
merge, and `CANON`.

