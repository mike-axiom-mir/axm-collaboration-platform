# Capability Recipe Admission Gate

This `EXPERIMENTAL` gate closes the deterministic seam between an inactive
Capability Recipe Foundry packet and Capability Fabric's reviewed builder
registry/catalog. It never applies that change itself.

The gate has four separate proof stages:

1. `inspect` verifies the exact ten-file Foundry directory, packet byte/digest
   bindings, inactive proposal, closed authority, and matching compiled
   `REVIEW_CANDIDATE` registry entry without executing source.
2. `test` requires `RUN EXACT REVIEW CANDIDATE SELFTEST`, executes only the
   bound builder-contribution selftest under a sanitized environment, and
   emits a create-new receipt outside the repository.
3. `review` binds nine exact source/evidence review cases after the reviewer
   supplies `I REVIEWED THE EXACT RECIPE SOURCE AND EVIDENCE`.
4. `decision` requires reviewer `Mike Tobi` and
   `ACCEPT EXACT EXPERIMENTAL RECIPE FOR REVIEWED MERGE`.

Only then can `plan` return `READY_FOR_REVIEWED_MERGE`. Its result contains the
prospective active recipe, catalog, and builder-registry descriptors. It still
writes none of them. A normal reviewed source diff and Workshop verification
remain required.

The registry now contains four active HAND builders. The closed-schema
validator entered through this exact reviewed-merge route; its inactive Foundry
packet and external receipts remain provenance, not an activation surface. The
portable evidence-review SKILL remains the one inactive review candidate.

The gate cannot activate a recipe, install, register, stage, promote, mutate
Foundation, or change CANON.
