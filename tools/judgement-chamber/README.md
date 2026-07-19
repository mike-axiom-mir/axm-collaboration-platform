# AXM Judgement Chamber

An independent leaf module for deep Human + Machine judgement. It adds detail to the existing review service; it does not replace Asset Fabric, Workshop Direction, Review Inbox, or their state.

## Shape

- The exact subject stays visible at the top, including its source, effect, and digest.
- Four corners judge purpose, technical truth, consequences, and growth/reuse. Every corner requires a rating, a written finding, and evidence or an explicitly named evidence gap.
- Human and machine seats record separate attributed votes against the same SHA-256 digest.
- Any `NO` or `HOLD` remains visible in the central disagreement flow. A repair must change the artifact, receive a new digest, and collect fresh votes.
- The extra Fabric/Workshop goal composer previews and saves through the existing Workshop Direction API. The full Direction page remains available and unchanged.

## Truth boundaries

Approval here means the required independent seats approved one exact digest. It does not run, publish, promote, install, or modify the judged artifact. A machine seat is never filled automatically. External review items without Chamber metadata remain inspectable, with their declared action shown honestly.

## Verify

```text
node tools/judgement-chamber/selftest.js
```
