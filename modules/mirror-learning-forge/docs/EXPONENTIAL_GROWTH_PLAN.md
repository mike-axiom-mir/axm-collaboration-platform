# Exponential growth plan

This Forge treats growth as two separate curves:

1. **Experience pressure** may grow exponentially.
2. **Authority and promotion** remain deliberately bounded.

A scenario is not a prediction. The calculator exposes what happens if raw sessions grow by a repeated factor while permission, approval, episode creation, held-out cases and challenger branches follow configured rates.

## Reference calculation

Starting with 10 raw sessions:

| Growth factor per cycle | Cycle 4 | Cycle 8 | Cycle 12 | Cycle 20 |
|---:|---:|---:|---:|---:|
| 1.25× | 20 | 48 | 116 | 694 |
| 1.60× | 41 | 268 | 1,759 | 75,558 |
| 2.00× | 80 | 1,280 | 20,480 | 5,242,880 |

The important result is not that Mirror should ingest those numbers. It is that unbounded intake quickly outruns review, evaluation and storage. Therefore v0.2 adds a growth governor.

## Governor strategy

- deduplicate reviewed episodes before training;
- score evidence quality and select a diverse bounded curriculum;
- cap episodes and challenger branches per growth stage;
- preserve the baseline model's learned counts and token identities;
- freeze the held-out suite before training;
- compare multiple metrics and independent case wins;
- allow at most one human-reviewed promotion per cycle;
- keep tool authority, root changes and stage unlocks separate.

## Stage direction

`SEED → SPROUT → SAPLING`

A stage is not unlocked by time or raw volume. It requires verified promotions, sufficient unseen cases and a clean or repaired rollback history. Even then, the unlock remains a human-reviewed proposal.

## Central rule

> Experience may grow exponentially. Authority may not.
