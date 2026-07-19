# Adaptivity research and design notes — v0.7

## Research-grounded conclusions

### 1. Communication adjustment is normal, but its social purpose matters

Communication Accommodation Theory studies why people converge, diverge, or maintain communicative behavior and what consequences follow. AXM adopts the useful distinction but rejects the idea that convergence is automatically good. Mirror may converge in vocabulary or tone while preserving disagreement, evidence, consent, and identity.

### 2. Audience-aware generation can use a listener simulation layer

Takmaz et al. (ACL 2023) showed a computational speaker can adapt planned utterances by simulating the listener perspective without fine-tuning the underlying language model. This supports a separable `Listener Simulator` rather than embedding audience approval into Mirror's roots or identity.

### 3. Style transfer requires explicit semantic preservation

Text-style-transfer research repeatedly reports that changing style can degrade content. SC2 (ACL 2024) explicitly separates style and content signals to improve preservation. For Mirror this becomes a strict engineering rule: delivery changes require invariant recording, semantic equivalence checks, and round-trip reconstruction.

### 4. Healthy flexibility balances stability and switching

Cognitive-control research distinguishes stability—protecting the current task—from flexibility—switching when circumstances change. AXM therefore trains a meta-decision: `MAINTAIN`, `ADAPT`, `DIVERGE`, or `REFUSE_DISTORTION`. Adaptation is not rewarded when the current form already works.

### 5. Adaptive expertise is transfer, not novelty for its own sake

Adaptive expertise is the ability to use existing understanding to solve unfamiliar problems. Mirror's adaptivity evidence must include unseen and cross-domain transfer, not merely successful tone changes on repeated examples.

## Design consequences

- Store protected meaning separately from delivery strategy.
- Model the audience as tentative state, never as hidden psychological certainty.
- Generate multiple forms and compare them.
- Simulate likely interpretation before sending.
- Verify evidence, uncertainty, consent, and lineage remain reconstructable.
- Treat over-accommodation and under-accommodation as distinct failure modes.
- Preserve disagreement; never optimize for agreement rate.
- Record adaptation receipts and failed forms.
- Consolidate only repeated, reviewed transfer patterns.
- Keep runtime communication and authority outside the school.

## Primary sources

- Takmaz, E. et al. (2023). *Speaking the Language of Your Listener: Audience-Aware Adaptation via Plug-and-Play Theory of Mind.* Findings of ACL 2023. DOI: 10.18653/v1/2023.findings-acl.258
- Zhao, J. et al. (2024). *SC2: Towards Enhancing Content Preservation and Style Consistency in Long Text Style Transfer.* ACL 2024. DOI: 10.18653/v1/2024.acl-long.535
- Egner, T. (2023). *Principles of cognitive control over task focus and task switching.* Nature Reviews Psychology. DOI: 10.1038/s44159-023-00234-4
- Uddin, L. Q. (2021). *Cognitive and behavioural flexibility: neural mechanisms and clinical considerations.* Nature Reviews Neuroscience. DOI: 10.1038/s41583-021-00428-w
- Giles, H. (2016). *Communication Accommodation Theory.* International Encyclopedia of Communication Theory and Philosophy. DOI: 10.1002/9781118766804.wbiect056
- Barnett, S. M. & Koslowski, B. (2002). *Adaptive expertise: Effects of type of experience and the level of theoretical understanding it generates.* Thinking & Reasoning. DOI: 10.1080/13546780244000088

## Honest boundary

These sources support the architecture and training design. They do not prove that the current tiny Mirror learner already has human-like social cognition, stable values, consciousness, or broad adaptive expertise.
